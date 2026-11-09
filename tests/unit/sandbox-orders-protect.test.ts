/**
 * 단위 테스트: 주문 스크립트 보호 (T030). 가짜 PayPal 클라이언트와 **임시 폴더**로만 돈다 —
 * 실제 샌드박스를 부르지 않고, 저장소의 `tests/sandbox/manifest.json`·`reports/sandbox-approve-links.md`도
 * 읽거나 쓰지 않는다 (모드 함수에 `root`로 임시 폴더를 넘긴다).
 *
 * 확인하는 것 (지시서 "고칠 것" 1~6번)
 *  1. `captureId`가 적힌 주문은 상태 조회가 404·403이거나 실패해도 새로 만들지 않는다 (경고 한 줄)
 *  2. 옵션 없는 실행: manifest에 있는 키는 POST하지 않는다. 12건이 다 있으면 호출 0회·종료 0, 파일 불변
 *  3. `--fresh`: `APPROVED`·`COMPLETED`는 보존, `CREATED`·`PAYER_ACTION_REQUIRED`·404만 새로,
 *     상태를 읽지 못한 주문은 `skipped (status unknown)` + 종료 코드 1
 *  4. 전부 실패한 `--fresh`는 manifest·링크 파일을 건드리지 않는다. 일부만 성공하면 12행을 모두 유지한다
 *  5. `--` 없이 준 옵션(`npm_config_fresh`)은 호출하기 전에 멈춘다 (종료 코드 1)
 *  6. 캡처 결과: `COMPLETED`·`PENDING`·`DECLINED` 구분, `captureId`가 있는 주문은 다시 캡처하지 않는다
 */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALREADY_CREATED_NOTE,
  APPROVED_CELL,
  CAPTURED_CELL,
  main,
  readApproveLinkCells,
  readSandboxOrderSpecs,
  runCreateMode,
  runFreshMode,
  runFreshOrders,
  writeApproveLinks,
  type ApproveRow,
  type OrdersDeps,
} from '../../scripts/create-sandbox-orders';
import { runCapture } from '../../scripts/capture-sandbox-orders';
import { manifestPath, readManifest, writeManifest, type Manifest, type ManifestOrder } from '../../scripts/sandbox/manifest';
import { npmConfigKeys, swallowedOptions } from '../../scripts/sandbox/npm-args';
import type { ApiRequest, PayPalClient } from '@/types';

type Seen = { method: 'GET' | 'POST'; path: string; requestId?: string };
type Reply = { status: number; body?: unknown } | (() => { status: number; body?: unknown });

const SANDBOX_APPROVE = 'https://www.sandbox.paypal.com/checkoutnow?token=';
const SUFFIX_NOW = new Date('2026-11-10T00:31:00Z'); // KST 09:31 → 접미사 r202611100931

/** 경로로 답을 고르는 가짜 클라이언트. 답을 함수로 주면 던질 수도 있다. 모르는 경로는 404. */
function fakeClient(replies: Record<string, Reply>): { client: PayPalClient; seen: Seen[] } {
  const seen: Seen[] = [];
  const answer = (key: string) => {
    const reply = replies[key];
    if (reply === undefined) return { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } };
    return typeof reply === 'function' ? reply() : reply;
  };
  return {
    seen,
    client: {
      get: async (p: string) => {
        seen.push({ method: 'GET', path: p });
        const { status, body = {} } = answer(`GET ${p}`);
        return { status, body };
      },
      call: async (req: ApiRequest) => {
        seen.push({ method: 'POST', path: req.path, requestId: req.requestId });
        const { status, body = {} } = answer(`POST ${req.path}`);
        return { status, body };
      },
    },
  };
}

const orderCreated = (orderId: string) => ({
  id: orderId,
  status: 'CREATED',
  links: [{ href: `${SANDBOX_APPROVE}${orderId}`, rel: 'approve', method: 'GET' }],
});

const orderDetail = (status: string, captureId?: string) => ({
  id: 'ORDER-X',
  status,
  purchase_units: [{ payments: { captures: captureId === undefined ? [] : [{ id: captureId, status: 'COMPLETED' }] } }],
});

/** manifest 12건 (주문 ID는 `ORDER-O01` 꼴). */
const manifest12 = (): Manifest => ({
  orders: readSandboxOrderSpecs().map((spec) => ({
    key: spec.key,
    orderId: `ORDER-${spec.key}`,
    buyer: spec.buyer,
    sku: spec.sku,
    tracked: spec.tracked,
  })),
  disputes: [{ key: 'D1', disputeId: 'PP-D-1', orderKey: 'O01' }],
});

/** 임시 폴더 + 지난 실행이 쓴 manifest·링크 파일. 저장소 파일은 건드리지 않는다. */
function tempRoot(manifest: Manifest = manifest12()): { root: string; linkFile: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'afterloop-t030-'));
  mkdirSync(path.join(root, 'reports'), { recursive: true });
  mkdirSync(path.join(root, 'tests/sandbox'), { recursive: true });
  writeManifest(manifest, root);
  const rows: ApproveRow[] = readSandboxOrderSpecs().map((spec) => ({
    key: spec.key,
    buyer: spec.buyer,
    amount: spec.amount,
    approveUrl: `${SANDBOX_APPROVE}OLD-${spec.key}`,
    note: 'ok',
  }));
  const linkFile = writeApproveLinks(rows, new Date('2026-11-09T14:00:00Z'), root);
  return { root, linkFile };
}

const bytes = (file: string): string => readFileSync(file, 'utf8');

describe('T030 보호 (가짜 클라이언트·임시 폴더)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const logs = (): string => (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0])).join('\n');
  const errors = (): string => (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => String(c[0])).join('\n');

  // ── 1. 캡처된 주문은 어떤 경로로도 다시 만들지 않는다 ────────────────────────

  describe('캡처된 주문 보호 (`--fresh`)', () => {
    const captured = (): Manifest => {
      const manifest = manifest12();
      manifest.orders[0] = { ...manifest.orders[0], captureId: 'CAP-O01' };
      return manifest;
    };

    it('captureId가 있고 상태 조회가 404면 새로 만들지 않고 경고를 적는다', async () => {
      const { client, seen } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': { status: 404, body: { name: 'RESOURCE_NOT_FOUND', debug_id: 'dbg-1' } },
      });

      const { rows, orders, problems } = await runFreshOrders(client, readSandboxOrderSpecs().slice(0, 1), captured(), 'r1');

      expect(seen.filter((s) => s.method === 'POST')).toEqual([]);
      expect(rows[0].result).toBe('kept-captured');
      expect(rows[0].note).toContain('경고');
      expect(orders[0]).toEqual({ key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true, captureId: 'CAP-O01' });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('캡처 ID');
    });

    it('403·400·200(CREATED)·조회 예외에서도 captureId를 지키고 POST하지 않는다', async () => {
      const cases: Reply[] = [
        { status: 403, body: { name: 'NOT_AUTHORIZED' } },
        { status: 400, body: { name: 'INVALID_REQUEST' } },
        { status: 200, body: orderDetail('CREATED') },
        () => {
          throw new Error('PayPal GET /v2/checkout/orders 실패: 네트워크');
        },
      ];

      for (const reply of cases) {
        const { client, seen } = fakeClient({ 'GET /v2/checkout/orders/ORDER-O01': reply });
        const { rows, orders, problems } = await runFreshOrders(client, readSandboxOrderSpecs().slice(0, 1), captured(), 'r1');

        expect(seen.filter((s) => s.method === 'POST')).toEqual([]);
        expect(rows[0].result).toBe('kept-captured');
        expect(orders[0].captureId).toBe('CAP-O01');
        expect(orders[0].orderId).toBe('ORDER-O01');
        expect(problems).toHaveLength(1);
      }
    });

    it('captureId가 있고 200 COMPLETED면 경고 없이 그대로 둔다', async () => {
      const { client, seen } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail('COMPLETED', 'CAP-O01') },
      });

      const { rows, problems } = await runFreshOrders(client, readSandboxOrderSpecs().slice(0, 1), captured(), 'r1');

      expect(seen.filter((s) => s.method === 'POST')).toEqual([]);
      expect(rows[0].result).toBe('kept-captured');
      expect(rows[0].note).not.toContain('경고');
      expect(problems).toEqual([]);
    });
  });

  // ── 2. 옵션 없는 실행 ────────────────────────────────────────────────────────

  describe('옵션 없는 `npm run sandbox:orders`', () => {
    it('12건이 모두 manifest에 있으면 POST 0회·종료 0이고 파일을 쓰지 않는다', async () => {
      const { root, linkFile } = tempRoot();
      const manifestFile = manifestPath(root);
      const before = { manifest: bytes(manifestFile), links: bytes(linkFile) };
      const { client, seen } = fakeClient({
        'POST /v2/checkout/orders': () => {
          throw new Error('POST를 보내면 안 된다');
        },
      });

      const code = await runCreateMode({ client, root }, readSandboxOrderSpecs(), readManifest(root), SUFFIX_NOW);

      expect(code).toBe(0);
      expect(seen).toEqual([]);
      expect(logs()).toContain(ALREADY_CREATED_NOTE);
      expect(bytes(manifestFile)).toBe(before.manifest);
      expect(bytes(linkFile)).toBe(before.links);
    });

    it('없는 키만 만들고 captureId·previousOrderIds·disputes를 지우지 않는다', async () => {
      const manifest = manifest12();
      const kept: ManifestOrder = { ...manifest.orders[0], captureId: 'CAP-O01', previousOrderIds: ['ORDER-OLDEST'] };
      manifest.orders = [kept]; // O01만 있고 나머지 11건은 비어 있다
      const { root, linkFile } = tempRoot(manifest);
      let n = 0;
      const { client, seen } = fakeClient({
        'POST /v2/checkout/orders': () => {
          n += 1;
          return { status: 201, body: orderCreated(`NEW-${n}`) };
        },
      });

      const code = await runCreateMode({ client, root }, readSandboxOrderSpecs(), readManifest(root), SUFFIX_NOW);

      expect(code).toBe(0);
      expect(seen.filter((s) => s.method === 'POST')).toHaveLength(11);
      expect(seen.some((s) => s.requestId === 'afterloop-order-O01')).toBe(false);

      const after = readManifest(root);
      expect(after.orders).toHaveLength(12);
      expect(after.orders.find((o) => o.key === 'O01')).toEqual(kept);
      expect(after.disputes).toEqual(manifest.disputes);

      // 링크 파일은 12행: O01은 지난 링크 그대로, 나머지는 새 링크
      const cells = readApproveLinkCells(root);
      expect(cells.size).toBe(12);
      expect(cells.get('O01')).toBe(`${SANDBOX_APPROVE}OLD-O01`);
      expect(cells.get('O02')).toBe(`${SANDBOX_APPROVE}NEW-1`);
      expect(bytes(linkFile)).toContain('승인 링크 12건 / 주문 12건');
    });

    // T034 완료 기준 3: payment_source를 보내면 응답이 PAYER_ACTION_REQUIRED · payer-action일 수 있다.
    it('응답이 PAYER_ACTION_REQUIRED · payer-action이어도 manifest·링크 파일에 12건이 정상 기록된다', async () => {
      const { root, linkFile } = tempRoot({ orders: [], disputes: manifest12().disputes });
      let n = 0;
      const { client, seen } = fakeClient({
        'POST /v2/checkout/orders': () => {
          n += 1;
          return {
            status: 201,
            body: {
              id: `NEW-${n}`,
              status: 'PAYER_ACTION_REQUIRED',
              links: [{ href: `${SANDBOX_APPROVE}NEW-${n}`, rel: 'payer-action', method: 'GET' }],
            },
          };
        },
      });

      const code = await runCreateMode({ client, root }, readSandboxOrderSpecs(), readManifest(root), SUFFIX_NOW);

      expect(code).toBe(0);
      expect(seen.filter((s) => s.method === 'POST')).toHaveLength(12);

      const after = readManifest(root);
      expect(after.orders).toHaveLength(12);
      expect(after.orders.map((o) => o.orderId)).toEqual(Array.from({ length: 12 }, (_, i) => `NEW-${i + 1}`));
      expect(after.disputes).toEqual(manifest12().disputes);

      const cells = readApproveLinkCells(root);
      expect(cells.size).toBe(12);
      expect(cells.get('O01')).toBe(`${SANDBOX_APPROVE}NEW-1`);
      expect(cells.get('O12')).toBe(`${SANDBOX_APPROVE}NEW-12`);
      expect(bytes(linkFile)).toContain('승인 링크 12건 / 주문 12건');
      expect(bytes(linkFile)).not.toContain('승인 링크 없음');
    });
  });

  // ── 3. `--fresh`는 살아 있는 주문을 버리지 않는다 ─────────────────────────────

  describe('`--fresh` 건별 판정', () => {
    it('APPROVED 3건 + CREATED 9건이면 9건만 새로 만들고 3건을 보존한다', async () => {
      const approved = ['O01', 'O02', 'O03'];
      const replies: Record<string, Reply> = {};
      for (const order of manifest12().orders) {
        replies[`GET /v2/checkout/orders/${order.orderId}`] = {
          status: 200,
          body: orderDetail(approved.includes(order.key) ? 'APPROVED' : 'CREATED'),
        };
      }
      let n = 0;
      replies['POST /v2/checkout/orders'] = () => {
        n += 1;
        return { status: 201, body: orderCreated(`FRESH-${n}`) };
      };
      const { client, seen } = fakeClient(replies);

      const { rows, orders, problems } = await runFreshOrders(client, readSandboxOrderSpecs(), manifest12(), 'r1');

      expect(seen.filter((s) => s.method === 'POST')).toHaveLength(9);
      expect(rows.filter((r) => r.result === 'kept-approved').map((r) => r.key)).toEqual(approved);
      expect(rows.filter((r) => r.result === 'recreated')).toHaveLength(9);
      for (const key of approved) {
        expect(orders.find((o) => o.key === key)?.orderId).toBe(`ORDER-${key}`);
      }
      expect(problems).toEqual([]);
    });

    it('PAYER_ACTION_REQUIRED·만료(404)는 새로 만든다', async () => {
      const { client, seen } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail('PAYER_ACTION_REQUIRED') },
        'GET /v2/checkout/orders/ORDER-O02': { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } },
        'POST /v2/checkout/orders': { status: 201, body: orderCreated('FRESH-1') },
      });

      const { rows } = await runFreshOrders(client, readSandboxOrderSpecs().slice(0, 2), manifest12(), 'r1');

      expect(rows.map((r) => r.result)).toEqual(['recreated', 'recreated']);
      expect(seen.filter((s) => s.method === 'POST')).toHaveLength(2);
    });

    it('상태 조회가 네트워크·5xx로 실패한 주문은 건드리지 않고 skipped로 적는다', async () => {
      const { client, seen } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': () => {
          throw new Error('PayPal GET /v2/checkout/orders 실패: 네트워크');
        },
        'GET /v2/checkout/orders/ORDER-O02': { status: 500, body: { name: 'INTERNAL_SERVER_ERROR', debug_id: 'dbg-5' } },
        'POST /v2/checkout/orders': { status: 201, body: orderCreated('FRESH-1') },
      });

      const { rows, orders, problems } = await runFreshOrders(client, readSandboxOrderSpecs().slice(0, 2), manifest12(), 'r1');

      expect(seen.filter((s) => s.method === 'POST')).toEqual([]);
      expect(rows.map((r) => r.result)).toEqual(['skipped', 'skipped']);
      // 두 건 모두 manifest 항목이 그대로다 (나머지 10건은 이번 명세에 없어 그대로 남는다)
      expect(orders.slice(0, 2).map((o) => o.orderId)).toEqual(['ORDER-O01', 'ORDER-O02']);
      expect(orders).toHaveLength(12);
      expect(problems).toHaveLength(2);
    });

    it('`--fresh`가 다루지 않는 상태(VOIDED)도 건드리지 않는다', async () => {
      const { client, seen } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail('VOIDED') },
      });

      const { rows, problems } = await runFreshOrders(client, readSandboxOrderSpecs().slice(0, 1), manifest12(), 'r1');

      expect(seen.filter((s) => s.method === 'POST')).toEqual([]);
      expect(rows[0].result).toBe('skipped');
      expect(rows[0].note).toContain('VOIDED');
      expect(problems).toHaveLength(1);
    });

    it('조회 실패가 있으면 종료 코드 1이다', async () => {
      const { root } = tempRoot();
      const { client } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': { status: 500, body: { name: 'INTERNAL_SERVER_ERROR' } },
      });

      const code = await runFreshMode({ client, root }, readSandboxOrderSpecs().slice(0, 1), readManifest(root), SUFFIX_NOW);

      expect(code).toBe(1);
    });
  });

  // ── 4. 전부 실패한 `--fresh`는 파일을 덮지 않는다 ────────────────────────────

  describe('`--fresh`의 파일 쓰기', () => {
    it('새로 만든 주문이 0건이면 manifest·링크 파일이 한 글자도 바뀌지 않는다', async () => {
      const { root, linkFile } = tempRoot();
      const manifestFile = manifestPath(root);
      const before = { manifest: bytes(manifestFile), links: bytes(linkFile) };
      const replies: Record<string, Reply> = {};
      for (const order of manifest12().orders) {
        replies[`GET /v2/checkout/orders/${order.orderId}`] = { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } };
      }
      // 토큰 401처럼 한 건도 만들지 못하는 경우
      replies['POST /v2/checkout/orders'] = { status: 401, body: { name: 'AUTHENTICATION_FAILURE' } };
      const { client } = fakeClient(replies);

      const code = await runFreshMode({ client, root }, readSandboxOrderSpecs(), readManifest(root), SUFFIX_NOW);

      expect(code).toBe(1);
      expect(bytes(manifestFile)).toBe(before.manifest);
      expect(bytes(linkFile)).toBe(before.links);
      expect(logs()).toContain('새로 만든 주문이 0건');
    });

    it('일부만 성공하면 성공한 행만 바꾸고 링크 파일에 12행을 모두 남긴다', async () => {
      const manifest = manifest12();
      manifest.orders[0] = { ...manifest.orders[0], captureId: 'CAP-O01' }; // O01: 캡처됨
      const { root, linkFile } = tempRoot(manifest);

      const replies: Record<string, Reply> = {
        'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail('COMPLETED', 'CAP-O01') },
        'GET /v2/checkout/orders/ORDER-O02': { status: 200, body: orderDetail('APPROVED') }, // 승인됨
        'GET /v2/checkout/orders/ORDER-O03': { status: 500, body: { name: 'INTERNAL_SERVER_ERROR' } }, // 상태 모름
      };
      for (const order of manifest.orders.slice(3)) {
        replies[`GET /v2/checkout/orders/${order.orderId}`] = { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } };
      }
      let n = 0;
      replies['POST /v2/checkout/orders'] = () => {
        n += 1;
        if (n === 1) return { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'CURRENCY_NOT_SUPPORTED' }] } };
        return { status: 201, body: orderCreated(`FRESH-${n}`) };
      };
      const { client } = fakeClient(replies);

      const code = await runFreshMode({ client, root }, readSandboxOrderSpecs(), readManifest(root), SUFFIX_NOW);

      expect(code).toBe(1); // 실패·skipped가 있다

      const after = readManifest(root);
      expect(after.orders.find((o) => o.key === 'O01')).toEqual({ ...manifest.orders[0] }); // 캡처 그대로
      expect(after.orders.find((o) => o.key === 'O02')?.orderId).toBe('ORDER-O02'); // 승인 그대로
      expect(after.orders.find((o) => o.key === 'O03')?.orderId).toBe('ORDER-O03'); // 상태 모름 → 그대로
      expect(after.orders.find((o) => o.key === 'O04')?.orderId).toBe('ORDER-O04'); // 422 실패 → 그대로
      expect(after.orders.find((o) => o.key === 'O05')?.orderId).toBe('FRESH-2'); // 새로 만듦
      expect(after.disputes).toEqual(manifest.disputes);

      const cells = readApproveLinkCells(root);
      expect(cells.size).toBe(12);
      expect(cells.get('O01')).toBe(CAPTURED_CELL);
      expect(cells.get('O02')).toBe(APPROVED_CELL);
      expect(cells.get('O03')).toBe(`${SANDBOX_APPROVE}OLD-O03`); // 바뀌지 않은 행은 기존 링크
      expect(cells.get('O04')).toBe(`${SANDBOX_APPROVE}OLD-O04`);
      expect(cells.get('O05')).toBe(`${SANDBOX_APPROVE}FRESH-2`);
      expect(bytes(linkFile)).not.toContain('@');
    });

    it('링크 파일 안내에 "마지막 실행이 쓴 것만 쓴다"와 승인 뒤 `--fresh` 금지가 적힌다', () => {
      const { root, linkFile } = tempRoot();
      expect(readApproveLinkCells(root).size).toBe(12);
      const text = bytes(linkFile);
      expect(text).toContain('마지막 실행이 쓴 것만 쓴다');
      expect(text).toContain('승인을 시작한 뒤에는 `--fresh`를 다시 실행하지 않는다');
    });
  });

  // ── 5. `--`를 빼먹은 실행 ────────────────────────────────────────────────────

  describe('`--` 없이 준 옵션', () => {
    const noCalls = (root: string) => ({
      root,
      loadEnv: () => {
        throw new Error('자격 증명을 읽으면 안 된다');
      },
      makeClient: () => {
        throw new Error('클라이언트를 만들면 안 된다');
      },
    });

    it('npm_config_fresh만 있고 인자가 없으면 호출 0회·종료 1이다', async () => {
      const { root, linkFile } = tempRoot();
      const before = { manifest: bytes(manifestPath(root)), links: bytes(linkFile) };

      const code = await main([], SUFFIX_NOW, { npm_config_fresh: 'true' }, noCalls(root));

      expect(code).toBe(1);
      expect(errors()).toContain('옵션은 `--` 뒤에: npm run sandbox:orders -- --fresh');
      expect(bytes(manifestPath(root))).toBe(before.manifest);
      expect(bytes(linkFile)).toBe(before.links);
    });

    it('npm_config_status도 같이 막는다', async () => {
      const { root } = tempRoot();
      const code = await main([], SUFFIX_NOW, { npm_config_status: 'true' }, noCalls(root));
      expect(code).toBe(1);
      expect(errors()).toContain('-- --status');
    });

    it('`-- --fresh`로 제대로 주면 옵션 보호에 걸리지 않는다', async () => {
      const { root } = tempRoot();
      const code = await main(['--fresh'], SUFFIX_NOW, { npm_config_fresh: 'true' }, noCalls(root));
      expect(code).toBe(1); // 주입한 loadEnv가 던져서 1이다
      expect(errors()).not.toContain('옵션은 `--` 뒤에');
      expect(errors()).toContain('자격 증명');
    });

    it('npm 환경 변수가 없으면 평소대로 진행한다', async () => {
      const { root } = tempRoot();
      const code = await main([], SUFFIX_NOW, {}, noCalls(root));
      expect(code).toBe(1); // 주입한 loadEnv가 던져서 1이다
      expect(errors()).not.toContain('옵션은 `--` 뒤에');
    });

    it('옵션 이름의 `-`는 `_`로도 본다', () => {
      expect(npmConfigKeys('--probe-request-id')).toEqual(['npm_config_probe-request-id', 'npm_config_probe_request_id']);
      expect(swallowedOptions(['--json'], [], { 'npm_config_json': 'true' })).toEqual(['--json']);
      expect(swallowedOptions(['--json'], ['--json'], { 'npm_config_json': 'true' })).toEqual([]);
      expect(swallowedOptions(['--json'], [], {})).toEqual([]);
    });
  });

  // ── 6. 캡처 결과 구분 ────────────────────────────────────────────────────────

  describe('캡처 결과 (`npm run sandbox:capture`)', () => {
    const one: ManifestOrder = { key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true };
    const capture = (status: string, reason?: string) => ({
      id: 'ORDER-O01',
      status: 'COMPLETED',
      purchase_units: [
        { payments: { captures: [{ id: 'CAP-O01', status, ...(reason === undefined ? {} : { status_details: { reason } }) }] } },
      ],
    });

    const run = async (body: unknown) => {
      const { client, seen } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail('APPROVED') },
        'POST /v2/checkout/orders/ORDER-O01/capture': { status: 201, body },
      });
      const outcome = await runCapture(client, { orders: [one], disputes: [] });
      return { ...outcome, seen };
    };

    it('captures[].status가 COMPLETED일 때만 captured · ok이고 captureId를 적는다', async () => {
      const { rows, orders, problems } = await run(capture('COMPLETED'));

      expect(rows[0].result).toBe('captured');
      expect(rows[0].label).toBe('captured · ok');
      expect(orders[0].captureId).toBe('CAP-O01');
      expect(problems).toEqual([]);
    });

    it('PENDING은 captureId를 적되 captured · pending (사유)로 적는다', async () => {
      const { rows, orders, problems } = await run(capture('PENDING', 'PENDING_REVIEW'));

      expect(rows[0].result).toBe('captured_pending');
      expect(rows[0].label).toBe('captured · pending (PENDING_REVIEW)');
      expect(orders[0].captureId).toBe('CAP-O01');
      expect(problems[0]).toContain('PENDING_REVIEW');
    });

    it('DECLINED·FAILED는 capture failed로 적고 captureId를 적지 않는다', async () => {
      for (const status of ['DECLINED', 'FAILED']) {
        const { rows, orders, problems } = await run(capture(status));

        expect(rows[0].result).toBe('failed');
        expect(rows[0].label).toBe(`capture failed (${status})`);
        expect(rows[0].captureId).toBe('');
        expect(orders[0].captureId).toBeUndefined();
        expect(problems[0]).toContain(status);
      }
    });

    it('캡처 상태를 읽지 못하면 끝났다고 적지 않는다', async () => {
      const { rows, problems } = await run({ purchase_units: [{ payments: { captures: [{ id: 'CAP-O01' }] } }] });

      expect(rows[0].result).toBe('captured_pending');
      expect(rows[0].label).toContain('캡처 상태');
      expect(problems).toHaveLength(1);
    });

    // T034 4번: payment_source를 보낸 뒤의 새 주문 상태도 "승인 전"으로 다뤄야 한다.
    it('주문 상태 PAYER_ACTION_REQUIRED는 승인 전으로 보고 캡처하지 않는다', async () => {
      const { client, seen } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail('PAYER_ACTION_REQUIRED') },
        'POST /v2/checkout/orders/ORDER-O01/capture': () => {
          throw new Error('승인 전 주문을 캡처하면 안 된다');
        },
      });

      const notes: string[] = [];
      const { rows, orders, problems } = await runCapture(client, { orders: [one], disputes: [] }, (line) => notes.push(line));

      expect(seen.filter((s) => s.method === 'POST')).toEqual([]);
      expect(rows[0].result).toBe('not_approved');
      expect(rows[0].note).toBe('not approved yet');
      expect(notes[0]).toContain('PAYER_ACTION_REQUIRED');
      expect(orders[0].captureId).toBeUndefined();
      expect(problems).toEqual([]);
    });

    it('manifest에 captureId가 있는 주문은 조회·캡처를 하지 않는다', async () => {
      const { client, seen } = fakeClient({
        'GET /v2/checkout/orders/ORDER-O01': () => {
          throw new Error('조회하면 안 된다');
        },
        'POST /v2/checkout/orders/ORDER-O01/capture': () => {
          throw new Error('다시 캡처하면 안 된다');
        },
      });

      const { rows, orders, problems } = await runCapture(client, { orders: [{ ...one, captureId: 'CAP-O01' }], disputes: [] });

      expect(seen).toEqual([]);
      expect(rows[0].result).toBe('skipped');
      expect(rows[0].captureId).toBe('CAP-O01');
      expect(orders[0]).toEqual({ ...one, captureId: 'CAP-O01' });
      expect(problems).toEqual([]);
    });
  });
});

/** 임시 폴더 테스트가 저장소 파일을 쓰지 않았다는 확인 (경로가 임시 폴더 안이다). */
describe('임시 폴더만 쓴다', () => {
  it('manifest·링크 파일 경로가 임시 폴더 안이다', () => {
    const { root, linkFile } = tempRoot();
    expect(manifestPath(root).startsWith(root)).toBe(true);
    expect(linkFile.startsWith(root)).toBe(true);
    expect(root).not.toContain('afterloop-wt');
  });
});

/** 타입 쓰임새가 바뀌면 컴파일 단계에서 걸리게 (런타임 확인은 위에서 한다). */
export type _Deps = OrdersDeps;
