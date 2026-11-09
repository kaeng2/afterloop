/**
 * 단위 테스트: 샌드박스 스크립트 (T001 1단계).
 * 가짜 PayPal 클라이언트로만 돈다 — 실제 샌드박스를 부르지 않는다.
 *
 * 확인하는 것
 *  - `runTrack`: 추적 대상만 고르기, 이미 붙은 주문 건너뛰기, 요청 ID·본문 모양, 실패 기록
 *  - `runDisputes`: 캡처 ID로 분쟁 찾기, D1~D3 ↔ 주문 키 짝(T001 표), 못 찾은 경우
 *  - `runCheck`: 기능 확인 상태 코드, 빈 manifest 건너뛰기, --json이 내보내는 모양
 *  - `last-run.md` 절 쓰기, 자격 증명 검사
 */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSandboxEnv, SandboxEnvError } from '../../scripts/sandbox/env';
import { writeLastRunSection } from '../../scripts/sandbox/last-run';
import { probeRequestId, runCheck } from '../../scripts/sandbox/check-steps';
import { DISPUTE_ORDER_KEY, runDisputes, runTrack, trackRequestId, trackingNumberFor } from '../../scripts/sandbox/setup-steps';
import type { Manifest } from '../../scripts/sandbox/manifest';
import type { ApiRequest, PayPalClient } from '@/types';

type Seen = { method: 'GET' | 'POST'; path: string; requestId?: string; body?: Record<string, unknown> };
type Reply = { status: number; body?: unknown };

/** 경로(그리고 POST면 메서드)로 답을 고르는 가짜 클라이언트. 모르는 경로는 404. */
function fakeClient(replies: Record<string, Reply | (() => Reply)>): { client: PayPalClient; seen: Seen[] } {
  const seen: Seen[] = [];
  const answer = (key: string): Reply => {
    const reply = replies[key];
    if (reply === undefined) return { status: 404, body: { name: 'NOT_FOUND' } };
    return typeof reply === 'function' ? reply() : reply;
  };
  const client: PayPalClient = {
    get: async (p: string) => {
      seen.push({ method: 'GET', path: p });
      const { status, body = {} } = answer(`GET ${p}`);
      return { status, body };
    },
    call: async (req: ApiRequest) => {
      seen.push({ method: 'POST', path: req.path, requestId: req.requestId, body: req.body });
      const { status, body = {} } = answer(`POST ${req.path}`);
      return { status, body };
    },
  };
  return { client, seen };
}

const orderDetail = (options: { captureId?: string; trackers?: { status: string }[]; itemName?: string } = {}) => ({
  id: 'ORDER-X',
  status: 'COMPLETED',
  payer: { payer_id: 'PAYER1', address: { country_code: 'KR' } },
  purchase_units: [
    {
      items: [{ name: options.itemName ?? 'Wool Sweater, Navy' }],
      shipping: options.trackers === undefined ? {} : { trackers: options.trackers },
      payments: { captures: options.captureId === undefined ? [] : [{ id: options.captureId }] },
    },
  ],
});

const manifestWith = (orders: Manifest['orders']): Manifest => ({ orders, disputes: [] });

describe('runTrack (추적 등록)', () => {
  it('tracked: true인 주문만 등록하고, 미등록 주문은 건드리지 않는다', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail({ captureId: 'CAP-O01' }) },
      'POST /v2/checkout/orders/ORDER-O01/track': { status: 200, body: {} },
    });

    const outcomes = await runTrack(
      client,
      manifestWith([
        { key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true },
        { key: 'O02', orderId: 'ORDER-O02', buyer: 'jiho', sku: 'FK-CD-OAT', tracked: false },
      ]),
    );

    expect(outcomes.map((o) => [o.key, o.result])).toEqual([['O01', 'added']]);
    expect(seen.map((s) => s.path)).toEqual(['/v2/checkout/orders/ORDER-O01', '/v2/checkout/orders/ORDER-O01/track']);
  });

  it('요청 ID는 주문 키 기준이고 본문은 가상 추적번호 + carrier OTHER다', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O06': { status: 200, body: orderDetail({ captureId: 'CAP-O06' }) },
      'POST /v2/checkout/orders/ORDER-O06/track': { status: 201, body: {} },
    });

    await runTrack(client, manifestWith([{ key: 'O06', orderId: 'ORDER-O06', buyer: 'lena', sku: 'FK-BN-SET', tracked: true }]));

    const post = seen.find((s) => s.method === 'POST');
    expect(post?.requestId).toBe('afterloop-track-O06');
    expect(post?.body).toEqual({
      capture_id: 'CAP-O06',
      tracking_number: trackingNumberFor('O06'),
      carrier: 'OTHER',
      carrier_name_other: 'Fernwood Knits demo carrier',
      notify_payer: false,
    });
  });

  it('manifest의 captureId가 있으면 그것을 쓴다', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O08': { status: 200, body: orderDetail({ captureId: 'CAP-FROM-DETAIL' }) },
      'POST /v2/checkout/orders/ORDER-O08/track': { status: 200, body: {} },
    });

    await runTrack(
      client,
      manifestWith([{ key: 'O08', orderId: 'ORDER-O08', buyer: 'buyer_m', sku: 'FK-BN-SET', tracked: true, captureId: 'CAP-FROM-MANIFEST' }]),
    );

    expect(seen.find((s) => s.method === 'POST')?.body?.capture_id).toBe('CAP-FROM-MANIFEST');
  });

  it('이미 추적이 붙어 있으면 POST하지 않고 건너뛴다 (다시 실행해도 안전)', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O09': {
        status: 200,
        body: orderDetail({ captureId: 'CAP-O09', trackers: [{ status: 'SHIPPED' }] }),
      },
    });

    const outcomes = await runTrack(client, manifestWith([{ key: 'O09', orderId: 'ORDER-O09', buyer: 'buyer_m', sku: 'FK-BN-SET', tracked: true }]));

    expect(outcomes[0].result).toBe('skipped');
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(0);
  });

  it('취소된 추적만 있으면 다시 등록한다', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O10': {
        status: 200,
        body: orderDetail({ captureId: 'CAP-O10', trackers: [{ status: 'CANCELLED' }] }),
      },
      'POST /v2/checkout/orders/ORDER-O10/track': { status: 200, body: {} },
    });

    const outcomes = await runTrack(client, manifestWith([{ key: 'O10', orderId: 'ORDER-O10', buyer: 'buyer_m', sku: 'FK-BN-SET', tracked: true }]));

    expect(outcomes[0].result).toBe('added');
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(1);
  });

  it('캡처가 없으면 실패로 적고 POST하지 않는다', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O11': { status: 200, body: orderDetail({}) },
    });

    const outcomes = await runTrack(client, manifestWith([{ key: 'O11', orderId: 'ORDER-O11', buyer: 'buyer_m', sku: 'FK-BN-SET', tracked: true }]));

    expect(outcomes[0].result).toBe('failed');
    expect(outcomes[0].note).toContain('캡처가 없다');
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(0);
  });

  it('등록이 422면 오류 name·issue를 적고 다른 주문은 계속 돈다', async () => {
    const { client } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O12': { status: 200, body: orderDetail({ captureId: 'CAP-O12' }) },
      'POST /v2/checkout/orders/ORDER-O12/track': {
        status: 422,
        body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'TRACKER_ALREADY_EXISTS' }], debug_id: 'dbg-1' },
      },
      'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail({ captureId: 'CAP-O01' }) },
      'POST /v2/checkout/orders/ORDER-O01/track': { status: 200, body: {} },
    });

    const outcomes = await runTrack(
      client,
      manifestWith([
        { key: 'O12', orderId: 'ORDER-O12', buyer: 'buyer_m', sku: 'FK-CD-OAT', tracked: true },
        { key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true },
      ]),
    );

    expect(outcomes[0].result).toBe('failed');
    expect(outcomes[0].note).toBe('UNPROCESSABLE_ENTITY · TRACKER_ALREADY_EXISTS · debug_id=dbg-1');
    expect(outcomes[1].result).toBe('added');
  });

  it('추적번호와 요청 ID는 주문 키로 정해진다 (다시 실행해도 같다)', () => {
    expect(trackingNumberFor('O01')).toBe(trackingNumberFor('O01'));
    expect(trackingNumberFor('O01')).not.toBe(trackingNumberFor('O02'));
    expect(trackRequestId('O01')).toBe('afterloop-track-O01');
  });
});

describe('runDisputes (분쟁 ID 수집)', () => {
  const manifest = manifestWith([
    { key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true, captureId: 'CAP-O01' },
    { key: 'O02', orderId: 'ORDER-O02', buyer: 'jiho', sku: 'FK-CD-OAT', tracked: false, captureId: 'CAP-O02' },
    { key: 'O08', orderId: 'ORDER-O08', buyer: 'buyer_m', sku: 'FK-BN-SET', tracked: true, captureId: 'CAP-O08' },
  ]);

  const listFor = (captureId: string, disputeId: string) => ({
    [`GET /v1/customer/disputes?disputed_transaction_id=${captureId}&page_size=10`]: {
      status: 200,
      body: { items: [{ dispute_id: disputeId }] },
    },
  });

  it('T001 표대로 D1↔O02, D2↔O01, D3↔O08을 manifest 모양으로 돌려준다', async () => {
    const { client } = fakeClient({
      ...listFor('CAP-O01', 'PP-R-AAA-1'),
      ...listFor('CAP-O02', 'PP-R-BBB-2'),
      ...listFor('CAP-O08', 'PP-R-CCC-3'),
    });

    const { disputes, outcomes } = await runDisputes(client, manifest);

    expect(disputes).toEqual([
      { key: 'D1', disputeId: 'PP-R-BBB-2', orderKey: 'O02' },
      { key: 'D2', disputeId: 'PP-R-AAA-1', orderKey: 'O01' },
      { key: 'D3', disputeId: 'PP-R-CCC-3', orderKey: 'O08' },
    ]);
    expect(outcomes.every((o) => o.note === 'ok')).toBe(true);
    expect(DISPUTE_ORDER_KEY).toEqual({ D1: 'O02', D2: 'O01', D3: 'O08' });
  });

  it('조회만 한다 (POST 없음)', async () => {
    const { client, seen } = fakeClient({
      ...listFor('CAP-O01', 'PP-R-AAA-1'),
      ...listFor('CAP-O02', 'PP-R-BBB-2'),
      ...listFor('CAP-O08', 'PP-R-CCC-3'),
    });

    await runDisputes(client, manifest);

    expect(seen.every((s) => s.method === 'GET')).toBe(true);
  });

  it('캡처에 걸린 분쟁이 없으면 manifest에 넣지 않고 그대로 적는다', async () => {
    const { client } = fakeClient({
      ...listFor('CAP-O01', 'PP-R-AAA-1'),
      [`GET /v1/customer/disputes?disputed_transaction_id=CAP-O02&page_size=10`]: { status: 200, body: { items: [] } },
      ...listFor('CAP-O08', 'PP-R-CCC-3'),
    });

    const { disputes, outcomes } = await runDisputes(client, manifest);

    expect(disputes.map((d) => d.key)).toEqual(['D2', 'D3']);
    expect(outcomes.find((o) => o.key === 'D1')?.disputeId).toBeNull();
    expect(outcomes.find((o) => o.key === 'D1')?.note).toContain('분쟁이 없다');
  });

  it('manifest에 captureId가 없으면 주문 상세에서 읽어 쓴다', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail({ captureId: 'CAP-O01' }) },
      ...listFor('CAP-O01', 'PP-R-AAA-1'),
    });

    const { disputes } = await runDisputes(client, manifestWith([{ key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true }]));

    expect(disputes).toEqual([{ key: 'D2', disputeId: 'PP-R-AAA-1', orderKey: 'O01' }]);
    expect(seen[0].path).toBe('/v2/checkout/orders/ORDER-O01');
  });

  it('주문이 manifest에 없으면 그 분쟁만 건너뛴다', async () => {
    const { client } = fakeClient({ ...listFor('CAP-O01', 'PP-R-AAA-1') });

    const { disputes, outcomes } = await runDisputes(
      client,
      manifestWith([{ key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true, captureId: 'CAP-O01' }]),
    );

    expect(disputes.map((d) => d.key)).toEqual(['D2']);
    expect(outcomes.find((o) => o.key === 'D1')?.note).toContain('manifest에 주문 O02가 없다');
  });
});

describe('runCheck (조회)', () => {
  const FEATURES = {
    'GET /v1/customer/disputes?page_size=1': { status: 200, body: { items: [] } },
  };
  const txPath = (seen: Seen[]) => seen.map((s) => s.path).find((p) => p.startsWith('/v1/reporting/transactions')) ?? '';

  it('빈 manifest면 기능 확인만 하고 orders·disputes는 빈 배열이다', async () => {
    const { client, seen } = fakeClient({
      ...FEATURES,
      'GET /v1/reporting/transactions?start_date=2026-10-11T00%3A00%3A00-0000&end_date=2026-11-09T00%3A00%3A00-0000&fields=transaction_info&page_size=1&page=1':
        { status: 200, body: {} },
    });

    const { report, problems } = await runCheck(client, { orders: [], disputes: [] }, new Date('2026-11-09T00:00:00Z'));

    expect(report).toEqual({ token: { ok: true }, features: { disputes: 200, transactionSearch: 200 }, orders: [], disputes: [] });
    expect(problems).toEqual([]);
    expect(seen).toHaveLength(2);
    expect(txPath(seen)).toContain('start_date=2026-10-11T00%3A00%3A00-0000');
  });

  it('기능 확인이 403이면 상태 코드를 그대로 싣고 "반영 대기"를 적는다', async () => {
    const { client, seen } = fakeClient({
      'GET /v1/customer/disputes?page_size=1': { status: 403, body: { name: 'NOT_AUTHORIZED' } },
    });

    const { report, problems } = await runCheck(client, { orders: [], disputes: [] }, new Date('2026-11-09T00:00:00Z'));

    expect(report.features.disputes).toBe(403);
    expect(report.token.ok).toBe(true);
    expect(problems.join(' ')).toContain('반영 대기');
    expect(seen).toHaveLength(2); // 403이어도 나머지 기능 확인은 계속한다
  });

  it('주문·분쟁 상세에서 AC13이 읽는 값만 뽑는다', async () => {
    const { client } = fakeClient({
      ...FEATURES,
      'GET /v1/reporting/transactions?start_date=2026-10-11T00%3A00%3A00-0000&end_date=2026-11-09T00%3A00%3A00-0000&fields=transaction_info&page_size=1&page=1':
        { status: 200, body: {} },
      'GET /v2/checkout/orders/ORDER-O01': {
        status: 200,
        body: orderDetail({ captureId: 'CAP-O01', trackers: [{ status: 'SHIPPED' }] }),
      },
      'GET /v1/customer/disputes/PP-R-AAA-1': {
        status: 200,
        body: {
          dispute_id: 'PP-R-AAA-1',
          reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
          dispute_life_cycle_stage: 'INQUIRY',
          status: 'WAITING_FOR_SELLER_RESPONSE',
          disputed_transactions: [{ seller_transaction_id: 'CAP-O01' }],
        },
      },
    });

    const { report, problems } = await runCheck(
      client,
      {
        orders: [{ key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true }],
        disputes: [{ key: 'D2', disputeId: 'PP-R-AAA-1', orderKey: 'O01' }],
      },
      new Date('2026-11-09T00:00:00Z'),
    );

    expect(problems).toEqual([]);
    expect(report.orders).toEqual([
      {
        key: 'O01',
        orderId: 'ORDER-O01',
        status: 'COMPLETED',
        itemNames: ['Wool Sweater, Navy'],
        payerId: 'PAYER1',
        payerCountry: 'KR',
        captureId: 'CAP-O01',
        tracked: true,
      },
    ]);
    expect(report.disputes).toEqual([
      {
        key: 'D2',
        disputeId: 'PP-R-AAA-1',
        reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
        stage: 'INQUIRY',
        status: 'WAITING_FOR_SELLER_RESPONSE',
        captureIds: ['CAP-O01'],
      },
    ]);
  });

  it('토큰 발급이 실패하면 뒤 호출을 하지 않는다', async () => {
    const seen: Seen[] = [];
    const client: PayPalClient = {
      get: async (p: string) => {
        seen.push({ method: 'GET', path: p });
        throw Object.assign(new Error('PayPal /v1/oauth2/token → 401: 액세스 토큰 발급 실패'), { path: '/v1/oauth2/token', status: 401 });
      },
      call: async () => ({ status: 500, body: {} }),
    };

    const { report, problems } = await runCheck(client, { orders: [], disputes: [] }, new Date('2026-11-09T00:00:00Z'));

    expect(report.token.ok).toBe(false);
    expect(problems[0]).toContain('토큰 발급 실패');
    expect(seen).toHaveLength(1);
  });
});

describe('probeRequestId (요청 ID 길이 확인)', () => {
  it('61자 ID로 두 번, 36자 ID로 한 번 POST하고 멱등 여부를 적는다', async () => {
    let n = 0;
    const { client, seen } = fakeClient({
      'POST /v2/checkout/orders': () => {
        n += 1;
        return { status: 201, body: { id: n <= 2 ? 'ORDER-61' : 'ORDER-36' } };
      },
    });

    const { rows, notes } = await probeRequestId(client);

    expect(seen.map((s) => s.requestId?.length)).toEqual([61, 61, 36]);
    expect(seen[0].requestId).toBe(seen[1].requestId);
    expect(rows.map((r) => [r.idLength, r.status, r.orderId])).toEqual([
      [61, 201, 'ORDER-61'],
      [61, 201, 'ORDER-61'],
      [36, 201, 'ORDER-36'],
    ]);
    expect(notes.join(' ')).toContain('멱등: 같은 61자 ID로 두 번');
    expect(seen[0].body).toMatchObject({ intent: 'CAPTURE' });
  });

  it('거부되면 오류 name·issue를 적는다', async () => {
    const { client } = fakeClient({
      'POST /v2/checkout/orders': { status: 400, body: { name: 'INVALID_REQUEST', details: [{ issue: 'INVALID_PARAMETER_SYNTAX' }] } },
    });

    const { rows, notes } = await probeRequestId(client);

    expect(rows[0].note).toBe('INVALID_REQUEST · INVALID_PARAMETER_SYNTAX');
    expect(notes[0]).toContain('400');
  });
});

describe('last-run.md', () => {
  it('절마다 따로 덮어쓰고 다른 절은 남긴다', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'afterloop-lastrun-'));
    const file = path.join(root, 'tests/sandbox/last-run.md');
    mkdirSync(path.dirname(file), { recursive: true });

    writeLastRunSection('check', '조회 1회차', root);
    writeLastRunSection('probe', '요청 ID 확인 결과', root);
    writeLastRunSection('check', '조회 2회차', root);

    const text = readFileSync(file, 'utf8');
    expect(text).toContain('조회 2회차');
    expect(text).not.toContain('조회 1회차');
    expect(text).toContain('요청 ID 확인 결과');
    expect(text.indexOf('조회 2회차')).toBeLessThan(text.indexOf('요청 ID 확인 결과'));
  });

  it('여러 번 써도 절 제목이 쌓이지 않는다', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'afterloop-lastrun-'));
    mkdirSync(path.join(root, 'tests/sandbox'), { recursive: true });

    writeLastRunSection('check', '1회차', root);
    writeLastRunSection('probe', '요청 ID', root);
    writeLastRunSection('check', '2회차', root);
    writeLastRunSection('check', '3회차', root);

    const text = readFileSync(path.join(root, 'tests/sandbox/last-run.md'), 'utf8');
    expect(text.split('## 조회').length - 1).toBe(1);
    expect(text.split('## 요청 ID 길이 확인').length - 1).toBe(1);
  });
});

describe('loadSandboxEnv', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('PAYPAL_BASE_URL이 샌드박스가 아니면 던진다 (호출하지 않는다)', () => {
    process.env.PAYPAL_CLIENT_ID = 'id';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
    process.env.PAYPAL_BASE_URL = 'https://api-m.paypal.com';

    expect(() => loadSandboxEnv('/nonexistent-root')).toThrow(SandboxEnvError);
  });

  it('샌드박스면 환경 변수 값을 그대로 돌려준다 (끝 슬래시는 뗀다)', () => {
    process.env.PAYPAL_CLIENT_ID = 'id';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
    process.env.PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com/';

    expect(loadSandboxEnv('/nonexistent-root')).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      baseUrl: 'https://api-m.sandbox.paypal.com',
    });
  });

  it('오류 문구에 값은 담기지 않는다', () => {
    process.env.PAYPAL_CLIENT_ID = 'id';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
    process.env.PAYPAL_BASE_URL = 'https://api-m.paypal.com/secret-looking-path';

    try {
      loadSandboxEnv('/nonexistent-root');
      expect.unreachable('던져야 한다');
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-looking-path');
      expect((error as Error).message).not.toContain('secret');
    }
  });
});
