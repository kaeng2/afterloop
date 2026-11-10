/**
 * 단위 테스트: 샌드박스 스크립트의 SPEC v2.3 구성 (T039).
 * 가짜 PayPal 클라이언트와 임시 폴더로만 돈다 — 실제 샌드박스를 부르지 않는다.
 * 저장소의 `tests/sandbox/manifest.json`은 **읽기만** 한다 (쓰지 않는다).
 *
 * 확인하는 것 (지시서 "고칠 것" 1~6번)
 *  1. manifest 왕복: `demoExcluded`·`note`가 지워지지 않는다. 저장소의 정본 파일이 스키마를 통과하고
 *     다시 직렬화한 결과가 파일과 같다
 *  2. 시드에 없는 주문(O13)은 주문 생성(기본·`--fresh`)·캡처·setup 어디서도 지워지거나 POST되지 않는다
 *  3. `check` 보고의 주문 13건·분쟁 4건(시연 제외 1건), `last-run.md`의 "시연 제외" 표시
 *  4. `setup -- disputes` 재실행: `D2-old` 보존, D2는 O13의 분쟁, 시연 제외 ID는 다시 배정되지 않는다
 *  5. 분쟁이 걸린 주문에는 추적 등록 호출이 나가지 않는다 (SPEC 9-3). `tracked: false`도 대상이 아니다
 *  6. 이 스크립트들에 실제 분쟁을 바꾸는 POST 경로가 없다
 *
 * T051에서 더한 것: 연습용 분쟁(`P…`)이 늘어도 위 성질이 그대로인지 (check 보고 · disputes 재실행 · track).
 * 정본 manifest를 읽는 검사는 **수를 고정하지 않는다** — 연습용 분쟁은 사람이 시험할 때마다 늘어난다.
 */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCapture } from '../../scripts/capture-sandbox-orders';
import {
  readSandboxOrderSpecs,
  runCreateMode,
  runFreshMode,
  runStatusMode,
  writeApproveLinks,
  type ApproveRow,
} from '../../scripts/create-sandbox-orders';
import { DEMO_EXCLUDED_CELL, checkSection, runCheck } from '../../scripts/sandbox/check-steps';
import {
  ManifestSchema,
  manifestPath,
  readManifest,
  writeManifest,
  type Manifest,
  type ManifestDispute,
} from '../../scripts/sandbox/manifest';
import {
  TRACK_DISPUTED_NOTE,
  mergeDisputes,
  missingDisputeKeys,
  orderKeyForDispute,
  planTrack,
  runDisputes,
  runTrack,
} from '../../scripts/sandbox/setup-steps';
import type { ApiRequest, PayPalClient } from '@/types';

const ROOT = path.resolve(__dirname, '../..');
const SANDBOX_APPROVE = 'https://www.sandbox.paypal.com/checkoutnow?token=';
const NOW = new Date('2026-11-10T00:31:00Z'); // KST 09:31

/** 시연에서 뺀 분쟁 (SPEC v2.3 9-5). 이 ID로는 아무 조치도 하지 않는다. */
const EXCLUDED_DISPUTE_ID = 'PP-R-GAH-10197649';

type Seen = { method: 'GET' | 'POST'; path: string; requestId?: string };

/** 경로로 답을 고르는 가짜 클라이언트. 모르는 경로는 404. */
function fakeClient(reply: (method: 'GET' | 'POST', p: string) => { status: number; body?: unknown }): {
  client: PayPalClient;
  seen: Seen[];
} {
  const seen: Seen[] = [];
  return {
    seen,
    client: {
      get: async (p: string) => {
        seen.push({ method: 'GET', path: p });
        const { status, body = {} } = reply('GET', p);
        return { status, body };
      },
      call: async (req: ApiRequest) => {
        seen.push({ method: 'POST', path: req.path, requestId: req.requestId });
        const { status, body = {} } = reply('POST', req.path);
        return { status, body };
      },
    },
  };
}

/** 경로 → 답 표를 쓰는 가짜 클라이언트 (모르는 경로는 404). */
const mapClient = (replies: Record<string, { status: number; body?: unknown }>) =>
  fakeClient((method, p) => replies[`${method} ${p}`] ?? { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } });

/** 저장소의 정본 manifest (읽기만 한다). */
const repoManifest = (): Manifest => readManifest(ROOT);

const orderDetail = (options: { captureId?: string; tracked?: boolean } = {}) => ({
  id: 'ORDER-X',
  status: 'COMPLETED',
  payer: { payer_id: 'PAYER1', address: { country_code: 'KR' } },
  purchase_units: [
    {
      items: [{ name: 'Wool Sweater, Navy' }],
      shipping: options.tracked === true ? { trackers: [{ status: 'SHIPPED' }] } : {},
      payments: { captures: options.captureId === undefined ? [] : [{ id: options.captureId, status: 'COMPLETED' }] },
    },
  ],
});

/** 임시 폴더 + 지난 실행이 쓴 manifest·링크 파일. 저장소 파일은 건드리지 않는다. */
function tempRoot(manifest: Manifest): { root: string; manifestFile: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'afterloop-t039-'));
  mkdirSync(path.join(root, 'reports'), { recursive: true });
  mkdirSync(path.join(root, 'tests/sandbox'), { recursive: true });
  writeManifest(manifest, root);
  const rows: ApproveRow[] = manifest.orders.map((order) => ({
    key: order.key,
    buyer: order.buyer,
    amount: '72.00',
    approveUrl: `${SANDBOX_APPROVE}OLD-${order.key}`,
    note: 'ok',
  }));
  writeApproveLinks(rows, NOW, root);
  return { root, manifestFile: manifestPath(root) };
}

/** 시드 12건 + O13 (정본과 같은 모양). O13은 시드에 없다. */
function manifest13(): Manifest {
  const orders = readSandboxOrderSpecs().map((spec) => ({
    key: spec.key,
    orderId: `ORDER-${spec.key}`,
    buyer: spec.buyer,
    sku: spec.sku,
    tracked: spec.tracked,
    captureId: `CAP-${spec.key}`,
  }));
  return {
    orders: [
      ...orders,
      { key: 'O13', orderId: 'ORDER-O13', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: false, captureId: 'CAP-O13' },
    ],
    disputes: [
      { key: 'D1', disputeId: 'PP-D-1', orderKey: 'O02' },
      { key: 'D2', disputeId: 'PP-D-2', orderKey: 'O13' },
      { key: 'D3', disputeId: 'PP-D-3', orderKey: 'O08' },
      { key: 'D2-old', disputeId: EXCLUDED_DISPUTE_ID, orderKey: 'O01', demoExcluded: true, note: '시연 제외 (2026-11-10)' },
    ],
  };
}

const o13Of = (manifest: Manifest) => manifest.orders.find((order) => order.key === 'O13');
const disputeOf = (disputes: ManifestDispute[], key: string) => disputes.find((dispute) => dispute.key === key);

// ── manifest 키 규칙 (AC29와 같다, T051) ───────────────────────────────────────
//
//   `D1`~`D3` = 시연 분쟁 · `P` + 숫자 = 연습용 분쟁(시연 제외) · 그 밖(`D2-old` 등) = 시연 제외
//
// 연습용 분쟁은 사람이 녹화 전 실제 전송을 시험할 때마다 늘어난다. 그래서 **저장소의 정본 manifest를
// 읽는 검사는 수를 고정하지 않는다** — 고정된 수가 필요한 검사는 이 파일에서 만든 가짜 manifest로 한다.

/** 시연에 쓰는 분쟁 키 (이것만 `demoExcluded`가 아니다). */
const DEMO_DISPUTE_KEYS = ['D1', 'D2', 'D3'];
/** 연습용 분쟁 키 (`P1`, `P2`, …). AC29의 `isPractice`와 같은 규칙이다. */
const isPracticeKey = (key: string) => /^P\d+$/.test(key);
const demoDisputes = (disputes: ManifestDispute[]) => disputes.filter((dispute) => dispute.demoExcluded !== true);
const excludedDisputes = (disputes: ManifestDispute[]) => disputes.filter((dispute) => dispute.demoExcluded === true);

/** 연습용 분쟁을 거는 주문 (정본의 P1은 O04에 걸려 있다. O06은 `tracked: true`다). */
const PRACTICE_ORDER_KEYS = ['O04', 'O05', 'O06'];

/** 연습용 분쟁 `P1`~`P{count}` (모두 시연 제외). 정본의 P1과 같은 모양이다. */
const practiceDisputes = (count: number): ManifestDispute[] =>
  PRACTICE_ORDER_KEYS.slice(0, count).map((orderKey, index) => ({
    key: `P${index + 1}`,
    disputeId: `PP-R-PRC-1019776${index + 1}`,
    orderKey,
    demoExcluded: true,
    note: `연습용, 시연 제외 (${orderKey}): 녹화 전 실제 전송 시험용.`,
  }));

/** 시드 12건 + O13 + 연습용 분쟁 `count`건을 넣은 가짜 manifest. */
const manifestWithPractice = (count: number): Manifest => {
  const base = manifest13();
  return { ...base, disputes: [...base.disputes, ...practiceDisputes(count)] };
};

/** 연습용 분쟁을 0건·1건·3건 넣고 모두 돌려 본다 (T051 완료 기준). */
const PRACTICE_COUNTS = [0, 1, 3];

/** manifest에 적힌 주문·분쟁을 그대로 돌려주는 조회용 가짜 클라이언트 (POST는 실패로 표시한다). */
const checkClient = (manifest: Manifest) =>
  fakeClient((method, p) => {
    if (method === 'POST') return { status: 500, body: { name: 'SHOULD_NOT_POST' } };
    if (p.startsWith('/v1/reporting/transactions')) return { status: 200, body: {} };
    if (p === '/v1/customer/disputes?page_size=1') return { status: 200, body: { items: [] } };
    const order = manifest.orders.find((o) => p === `/v2/checkout/orders/${o.orderId}`);
    if (order !== undefined) {
      return { status: 200, body: orderDetail({ captureId: order.captureId, tracked: order.tracked }) };
    }
    const dispute = manifest.disputes.find((d) => p === `/v1/customer/disputes/${d.disputeId}`);
    if (dispute !== undefined) {
      return {
        status: 200,
        body: {
          dispute_id: dispute.disputeId,
          reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
          dispute_life_cycle_stage: dispute.demoExcluded === true ? 'CHARGEBACK' : 'INQUIRY',
          status: 'WAITING_FOR_SELLER_RESPONSE',
          disputed_transactions: [{ seller_transaction_id: `CAP-${dispute.orderKey}` }],
        },
      };
    }
    return { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } };
  });

const capOf = (orderKey: string) => `CAP-${orderKey}`;
const listPath = (captureId: string) => `GET /v1/customer/disputes?disputed_transaction_id=${captureId}&page_size=10`;

describe('T039 1. manifest 형식 (demoExcluded·note)', () => {
  it('저장소의 정본 manifest.json이 스키마를 통과하고, 다시 직렬화한 결과가 파일과 같다', () => {
    const file = manifestPath(ROOT);
    const text = readFileSync(file, 'utf8');
    const parsed = ManifestSchema.safeParse(JSON.parse(text));

    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error?.issues)).toBe(true);
    // 읽고 다시 쓰면 글자 하나도 달라지지 않는다 (지우는 칸이 없다).
    expect(`${JSON.stringify(parsed.data, null, 2)}\n`).toBe(text);
  });

  /**
   * 수를 고정하지 않는다 (T051): 연습용 분쟁(`P…`)은 사람이 실제 전송을 시험할 때마다 늘어난다.
   * 변하지 않는 것만 본다 — 시연에 쓰는 분쟁은 `D1`·`D2`·`D3`뿐이고, 그 밖은 모두 시연 제외다.
   */
  it('정본 manifest: 시연 분쟁은 D1·D2·D3뿐이고 그 밖은 모두 시연 제외다 (수는 보지 않는다)', () => {
    const manifest = repoManifest();

    expect(demoDisputes(manifest.disputes).map((d) => d.key).sort()).toEqual(DEMO_DISPUTE_KEYS);
    // D1~D3이 모두 있다 (스크립트의 마지막 확인과 같은 함수로 본다)
    expect(missingDisputeKeys(manifest.disputes)).toEqual([]);
    // 시연 제외가 아닌 분쟁의 키는 `D…`뿐이다 (연습용이 시연에 섞이지 않는다)
    for (const dispute of demoDisputes(manifest.disputes)) {
      expect(dispute.key.startsWith('D'), dispute.key).toBe(true);
      expect(isPracticeKey(dispute.key), dispute.key).toBe(false);
    }
    // 연습용(`P…`)은 모두 시연 제외다
    for (const dispute of manifest.disputes.filter((d) => isPracticeKey(d.key))) {
      expect(dispute.demoExcluded, dispute.key).toBe(true);
    }
    // 분쟁 ID는 겹치지 않고, 가리키는 주문은 모두 manifest에 있다
    const ids = manifest.disputes.map((d) => d.disputeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const dispute of manifest.disputes) {
      expect(manifest.orders.some((o) => o.key === dispute.orderKey), dispute.key).toBe(true);
    }
  });

  it('정본 manifest: 시연 제외로 적힌 D2-old가 있고, D2는 O13의 분쟁이다 (SPEC 9-5)', () => {
    const manifest = repoManifest();

    expect(disputeOf(manifest.disputes, 'D2-old')).toMatchObject({ disputeId: EXCLUDED_DISPUTE_ID, demoExcluded: true });
    expect(excludedDisputes(manifest.disputes).map((d) => d.disputeId)).toContain(EXCLUDED_DISPUTE_ID);
    expect(disputeOf(manifest.disputes, 'D2')?.orderKey).toBe('O13');
    expect(o13Of(manifest)?.tracked).toBe(false);
    // 시드 주문과 O13이 모두 적혀 있다 (주문 수는 고정하지 않는다)
    for (const spec of readSandboxOrderSpecs()) {
      expect(manifest.orders.some((o) => o.key === spec.key), spec.key).toBe(true);
    }
  });

  it('가짜 manifest에서는 수를 본다 (연습용 0건·1건·3건)', () => {
    for (const count of PRACTICE_COUNTS) {
      const manifest = manifestWithPractice(count);

      expect(manifest.orders, `연습용 ${count}건`).toHaveLength(13);
      expect(manifest.disputes, `연습용 ${count}건`).toHaveLength(4 + count);
      expect(demoDisputes(manifest.disputes).map((d) => d.key), `연습용 ${count}건`).toEqual(DEMO_DISPUTE_KEYS);
      expect(excludedDisputes(manifest.disputes), `연습용 ${count}건`).toHaveLength(1 + count);
      expect(ManifestSchema.safeParse(manifest).success, `연습용 ${count}건`).toBe(true);
    }
  });

  it('임시 폴더에 쓰고 다시 읽어도 demoExcluded·note가 그대로다', () => {
    const { root } = tempRoot(manifest13());
    const before = readManifest(root);

    writeManifest(before, root);
    const after = readManifest(root);

    expect(after).toEqual(before);
    expect(disputeOf(after.disputes, 'D2-old')).toEqual({
      key: 'D2-old',
      disputeId: EXCLUDED_DISPUTE_ID,
      orderKey: 'O01',
      demoExcluded: true,
      note: '시연 제외 (2026-11-10)',
    });
  });
});

describe('T039 2. 시드에 없는 주문(O13) 보존', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** O13의 주문 ID·캡처 ID가 들어간 호출 (어느 메서드든). */
  const touchedO13 = (seen: Seen[]) => seen.filter((s) => s.path.includes('ORDER-O13') || s.path.includes('CAP-O13'));

  it('기본 실행: manifest에 없는 시드 주문만 만들고 O13은 그대로 남는다 (O13 POST 0회)', async () => {
    const full = manifest13();
    // O05만 빼 둔다 — 한 건이라도 만들어야 manifest를 다시 쓴다.
    const before: Manifest = { ...full, orders: full.orders.filter((order) => order.key !== 'O05') };
    const { root, manifestFile } = tempRoot(before);
    const { client, seen } = mapClient({
      'POST /v2/checkout/orders': {
        status: 201,
        body: { id: 'ORDER-NEW-O05', status: 'CREATED', links: [{ href: `${SANDBOX_APPROVE}NEW`, rel: 'approve' }] },
      },
    });

    const code = await runCreateMode({ client, root }, readSandboxOrderSpecs(), readManifest(root), NOW);
    const after = readManifest(root);

    expect(code).toBe(0);
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(1); // O05만
    expect(touchedO13(seen)).toEqual([]);
    expect(o13Of(after)).toEqual(o13Of(full));
    expect(after.orders).toHaveLength(13);
    expect(readFileSync(manifestFile, 'utf8')).toContain('O13');
    // 분쟁 기록(시연 제외 포함)도 그대로다.
    expect(after.disputes).toEqual(full.disputes);
  });

  it('`--fresh`: 만료된 시드 주문을 다시 만들어도 O13은 그대로 남는다 (O13 호출 0회)', async () => {
    const full = manifest13();
    // 캡처 ID가 있으면 `--fresh`가 손대지 않으므로, 시드 12건은 캡처 전 상태로 둔다.
    const before: Manifest = {
      ...full,
      orders: full.orders.map((order) => (order.key === 'O13' ? order : { ...order, captureId: undefined })),
    };
    const { root } = tempRoot(before);
    const { client, seen } = fakeClient((method, p) => {
      if (method === 'POST') {
        return { status: 201, body: { id: `FRESH-${p}`, status: 'CREATED', links: [{ href: `${SANDBOX_APPROVE}F`, rel: 'approve' }] } };
      }
      return { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } }; // 모두 만료
    });

    const code = await runFreshMode({ client, root }, readSandboxOrderSpecs(), readManifest(root), NOW);
    const after = readManifest(root);

    expect(code).toBe(0);
    expect(touchedO13(seen)).toEqual([]);
    expect(o13Of(after)).toEqual(o13Of(full));
    expect(after.orders).toHaveLength(13);
  });

  it('`sandbox:capture`: O13은 캡처 ID가 있어 호출 없이 건너뛰고 manifest에 남는다', async () => {
    const before = manifest13();
    const { client, seen } = mapClient({});

    const { rows, orders } = await runCapture(client, before);

    expect(seen).toEqual([]); // 13건 모두 캡처 ID가 있다
    expect(rows.find((r) => r.key === 'O13')?.result).toBe('skipped');
    expect(orders.find((order) => order.key === 'O13')).toEqual(o13Of(before));
    expect(orders).toHaveLength(13);
  });

  it('`-- --status`: O13도 조회한다 (GET만, manifest는 쓰지 않는다)', async () => {
    const before = manifest13();
    const { root, manifestFile } = tempRoot(before);
    const bytesBefore = readFileSync(manifestFile, 'utf8');
    const { client, seen } = fakeClient(() => ({ status: 200, body: orderDetail({ captureId: 'CAP-X' }) }));

    const code = await runStatusMode({ client, root }, readManifest(root));

    expect(code).toBe(0);
    expect(seen).toHaveLength(13);
    expect(seen.every((s) => s.method === 'GET')).toBe(true);
    expect(seen.map((s) => s.path)).toContain('/v2/checkout/orders/ORDER-O13');
    expect(readFileSync(manifestFile, 'utf8')).toBe(bytesBefore);
  });

  it('`setup -- disputes`가 쓴 manifest에도 O13이 남는다', () => {
    const before = manifest13();
    const merged = mergeDisputes(before.disputes, [{ key: 'D2', disputeId: 'PP-D-2', orderKey: 'O13' }]);
    const { root } = tempRoot(before);

    writeManifest({ ...readManifest(root), disputes: merged }, root);

    expect(o13Of(readManifest(root))).toEqual(o13Of(before));
  });
});

describe('T039 3. sandbox:check 보고 (manifest 기준)', () => {
  it('주문 13건·분쟁 4건을 모두 조회하고 시연 제외 1건에 표시를 붙인다', async () => {
    const manifest = manifest13();
    const { client, seen } = checkClient(manifest);

    const { report, problems } = await runCheck(client, manifest, NOW);

    expect(problems).toEqual([]);
    expect(report.orders).toHaveLength(13);
    expect(report.disputes).toHaveLength(4);
    expect(report.disputes.filter((d) => d.demoExcluded === true).map((d) => d.key)).toEqual(['D2-old']);
    expect(report.disputes.filter((d) => d.demoExcluded !== true).map((d) => d.key)).toEqual(['D1', 'D2', 'D3']);
    expect(seen.every((s) => s.method === 'GET')).toBe(true); // 조회만 한다
  });

  it('추적 등록 수는 manifest 기준이다 (고정 숫자와 비교하지 않는다)', async () => {
    const manifest = manifest13();
    const { client } = checkClient(manifest);

    const { report } = await runCheck(client, manifest, NOW);

    const trackedInManifest = manifest.orders.filter((order) => order.tracked).length;
    expect(report.orders.filter((o) => o.tracked)).toHaveLength(trackedInManifest);
    expect(report.orders.filter((o) => !o.tracked)).toHaveLength(manifest.orders.length - trackedInManifest);
  });

  it('last-run.md 절에 시연 제외 분쟁이 ID와 함께 "시연 제외"로 적힌다', async () => {
    const manifest = manifest13();
    const { client } = checkClient(manifest);

    const { report, calls, problems } = await runCheck(client, manifest, NOW);
    const section = checkSection({ report, calls, problems }, manifest, NOW);

    for (const dispute of manifest.disputes) expect(section).toContain(dispute.disputeId);
    expect(section).toContain(DEMO_EXCLUDED_CELL);
    const excludedLine = section.split('\n').find((line) => line.includes(EXCLUDED_DISPUTE_ID) && line.startsWith('|'));
    expect(excludedLine).toContain(DEMO_EXCLUDED_CELL);
    // 시연 분쟁 행에는 "시연 제외"가 붙지 않는다
    const d1Line = section.split('\n').find((line) => line.startsWith('| D1 |'));
    expect(d1Line).not.toContain(DEMO_EXCLUDED_CELL);
  });

  it('조회가 실패한 분쟁도 last-run.md에 ID가 남는다', async () => {
    const manifest = manifest13();
    const { client } = fakeClient(() => ({ status: 403, body: { name: 'NOT_AUTHORIZED' } }));

    const outcome = await runCheck(client, manifest, NOW);
    const section = checkSection(outcome, manifest, NOW);

    for (const dispute of manifest.disputes) expect(section).toContain(dispute.disputeId);
  });
});

describe('T039 4. setup -- disputes 재실행', () => {
  /** 캡처별 분쟁 목록. O13에는 새 분쟁과 **시연 제외 분쟁**이 같이 걸려 있다. */
  const listReplies = (o13: string[]) => ({
    [listPath(capOf('O02'))]: { status: 200, body: { items: [{ dispute_id: 'PP-R-MBJ-10197650' }] } },
    [listPath(capOf('O08'))]: { status: 200, body: { items: [{ dispute_id: 'PP-R-FYT-10197651' }] } },
    [listPath(capOf('O13'))]: { status: 200, body: { items: o13.map((id) => ({ dispute_id: id })) } },
    [listPath(capOf('O01'))]: { status: 200, body: { items: [{ dispute_id: EXCLUDED_DISPUTE_ID }] } },
  });

  it('D2는 O13의 캡처로 찾는다 (고정 표의 O01이 아니다)', async () => {
    const manifest = manifest13();
    const { client, seen } = mapClient(listReplies(['PP-R-GMS-10197661']));

    const { disputes, outcomes } = await runDisputes(client, manifest);

    expect(disputeOf(disputes, 'D2')).toEqual({ key: 'D2', disputeId: 'PP-R-GMS-10197661', orderKey: 'O13' });
    expect(outcomes.find((o) => o.key === 'D2')?.orderKey).toBe('O13');
    // O01의 캡처로는 조회하지 않는다 (시연 제외 분쟁만 걸려 있는 주문이다)
    expect(seen.map((s) => s.path)).not.toContain(`/v1/customer/disputes?disputed_transaction_id=${capOf('O01')}&page_size=10`);
    expect(seen.every((s) => s.method === 'GET')).toBe(true);
  });

  it('시연 제외 분쟁 ID가 목록에 다시 나와도 D2로 배정하지 않는다', async () => {
    const manifest = manifest13();
    const { client } = mapClient(listReplies([EXCLUDED_DISPUTE_ID, 'PP-R-GMS-10197661']));

    const { disputes, outcomes } = await runDisputes(client, manifest);

    expect(disputeOf(disputes, 'D2')?.disputeId).toBe('PP-R-GMS-10197661');
    expect(disputes.map((d) => d.disputeId)).not.toContain(EXCLUDED_DISPUTE_ID);
    expect(outcomes.find((o) => o.key === 'D2')?.note).toContain('시연 제외');
  });

  it('시연 제외 분쟁만 걸려 있으면 D2를 비워 두고 사유를 적는다', async () => {
    const manifest = manifest13();
    const { client } = mapClient(listReplies([EXCLUDED_DISPUTE_ID]));

    const { disputes, outcomes } = await runDisputes(client, manifest);

    expect(disputeOf(disputes, 'D2')).toBeUndefined();
    expect(outcomes.find((o) => o.key === 'D2')?.disputeId).toBeNull();
    expect(outcomes.find((o) => o.key === 'D2')?.note).toContain('시연 제외');
  });

  it('재실행 뒤 D2-old가 보존되고 D2는 O13의 분쟁으로 남는다', async () => {
    const manifest = manifest13();
    const { client } = mapClient(listReplies(['PP-R-GMS-10197661']));

    const { disputes } = await runDisputes(client, manifest);
    const merged = mergeDisputes(manifest.disputes, disputes);

    expect(merged.map((d) => d.key)).toEqual(['D1', 'D2', 'D2-old', 'D3']);
    expect(disputeOf(merged, 'D2-old')).toEqual(disputeOf(manifest.disputes, 'D2-old'));
    expect(disputeOf(merged, 'D2')).toEqual({ key: 'D2', disputeId: 'PP-R-GMS-10197661', orderKey: 'O13' });
    // 마지막 확인: 시연 제외를 뺀 D1·D2·D3이 모두 있다
    expect(missingDisputeKeys(merged)).toEqual([]);
  });

  it('두 번 돌려도 결과가 같다 (멱등)', async () => {
    const manifest = manifest13();
    const { client } = mapClient(listReplies(['PP-R-GMS-10197661']));

    const first = mergeDisputes(manifest.disputes, (await runDisputes(client, manifest)).disputes);
    const second = mergeDisputes(first, (await runDisputes(client, { ...manifest, disputes: first })).disputes);

    expect(second).toEqual(first);
  });

  it('orderKeyForDispute: manifest의 orderKey가 고정 표보다 먼저다', () => {
    const manifest = manifest13();

    expect(orderKeyForDispute('D2', manifest.disputes)).toBe('O13');
    expect(orderKeyForDispute('D1', manifest.disputes)).toBe('O02');
    expect(orderKeyForDispute('D2', [])).toBe('O01'); // manifest에 없으면 고정 표
  });

  it('mergeDisputes는 시연 제외 항목을 덮지 않고, 같은 분쟁의 메모는 남긴다', () => {
    const existing: ManifestDispute[] = [
      { key: 'D2-old', disputeId: EXCLUDED_DISPUTE_ID, orderKey: 'O01', demoExcluded: true, note: '건드리지 않는다' },
      { key: 'D3', disputeId: 'PP-D-3', orderKey: 'O08', note: '사람 메모' },
    ];

    const merged = mergeDisputes(existing, [
      { key: 'D2-old', disputeId: 'PP-OTHER', orderKey: 'O99' },
      { key: 'D3', disputeId: 'PP-D-3', orderKey: 'O08' },
    ]);

    expect(disputeOf(merged, 'D2-old')).toEqual(existing[0]);
    expect(disputeOf(merged, 'D3')?.note).toBe('사람 메모');
  });

  it('missingDisputeKeys는 시연 제외 항목을 "있다"로 세지 않는다', () => {
    expect(
      missingDisputeKeys([
        { key: 'D1', disputeId: 'PP-D-1', orderKey: 'O02' },
        { key: 'D2', disputeId: EXCLUDED_DISPUTE_ID, orderKey: 'O01', demoExcluded: true },
        { key: 'D3', disputeId: 'PP-D-3', orderKey: 'O08' },
      ]),
    ).toEqual(['D2']);
  });
});

describe('T039 5. 분쟁이 걸린 주문에는 추적번호를 등록하지 않는다 (SPEC 9-3)', () => {
  it('planTrack: tracked: true + 분쟁 없음만 대상이다 (순수 함수)', () => {
    const manifest = manifest13();

    const { targets, blocked } = planTrack(manifest);

    // 분쟁이 걸린 주문: O02(D1) · O13(D2) · O08(D3) · O01(D2-old 시연 제외)
    expect(blocked.map((b) => b.order.key)).toEqual(['O01', 'O08']); // O02·O13은 tracked: false
    expect(targets.map((o) => o.key)).toEqual(['O06', 'O09', 'O10', 'O11', 'O12']);
    // 대상과 제외는 겹치지 않고, tracked: false는 어느 쪽에도 없다
    const touched = new Set([...targets, ...blocked.map((b) => b.order)].map((o) => o.key));
    expect([...touched].every((key) => manifest.orders.find((o) => o.key === key)?.tracked === true)).toBe(true);
  });

  it('planTrack: 시연 제외 분쟁이 가리키는 주문도 제외한다', () => {
    const manifest = manifest13();
    const onlyExcluded: Manifest = {
      ...manifest,
      disputes: manifest.disputes.filter((d) => d.demoExcluded === true),
    };

    const { targets, blocked } = planTrack(onlyExcluded);

    expect(blocked.map((b) => b.order.key)).toEqual(['O01']);
    expect(targets.map((o) => o.key)).not.toContain('O01');
  });

  it('planTrack: 아직 등록 안 된 주문이어도 분쟁이 있으면 대상이 아니다', () => {
    const manifest: Manifest = {
      orders: [{ key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true }],
      disputes: [{ key: 'D2-old', disputeId: EXCLUDED_DISPUTE_ID, orderKey: 'O01', demoExcluded: true }],
    };

    expect(planTrack(manifest).targets).toEqual([]);
    expect(planTrack(manifest).blocked.map((b) => b.order.key)).toEqual(['O01']);
  });

  it('runTrack: 분쟁이 걸린 주문(O01·O02·O08·O13)에는 호출 0회이고 "분쟁 진행 중이라 제외"로 적는다', async () => {
    const manifest = manifest13();
    const { client, seen } = fakeClient((method) =>
      method === 'GET' ? { status: 200, body: orderDetail({ captureId: 'CAP-X' }) } : { status: 200, body: {} },
    );

    const outcomes = await runTrack(client, manifest);

    for (const key of ['O01', 'O02', 'O08', 'O13']) {
      const orderId = manifest.orders.find((o) => o.key === key)?.orderId ?? '';
      expect(seen.filter((s) => s.path.includes(orderId)), key).toEqual([]);
    }
    const disputed = outcomes.filter((o) => o.result === 'disputed');
    expect(disputed.map((o) => o.key)).toEqual(['O01', 'O08']);
    for (const outcome of disputed) {
      expect(outcome.note).toContain(TRACK_DISPUTED_NOTE);
      expect(outcome.status).toBeNull();
      expect(outcome.trackingNumber).toBeNull();
    }
    // 시연 제외 분쟁은 그 사실도 적는다
    expect(disputed.find((o) => o.key === 'O01')?.note).toContain('시연 제외');
  });

  it('runTrack: 분쟁 없는 tracked: true 주문만 등록한다', async () => {
    const manifest = manifest13();
    const { client, seen } = fakeClient((method) =>
      method === 'GET' ? { status: 200, body: orderDetail({ captureId: 'CAP-X' }) } : { status: 201, body: {} },
    );

    const outcomes = await runTrack(client, manifest);

    expect(outcomes.filter((o) => o.result === 'added').map((o) => o.key)).toEqual(['O06', 'O09', 'O10', 'O11', 'O12']);
    expect(seen.filter((s) => s.method === 'POST').map((s) => s.path)).toEqual([
      '/v2/checkout/orders/ORDER-O06/track',
      '/v2/checkout/orders/ORDER-O09/track',
      '/v2/checkout/orders/ORDER-O10/track',
      '/v2/checkout/orders/ORDER-O11/track',
      '/v2/checkout/orders/ORDER-O12/track',
    ]);
  });

  it('표는 manifest 순서대로 나온다 (제외된 행도 제자리)', async () => {
    const manifest = manifest13();
    const { client } = fakeClient((method) =>
      method === 'GET' ? { status: 200, body: orderDetail({ captureId: 'CAP-X' }) } : { status: 201, body: {} },
    );

    const outcomes = await runTrack(client, manifest);

    expect(outcomes.map((o) => o.key)).toEqual(['O01', 'O06', 'O08', 'O09', 'O10', 'O11', 'O12']);
  });
});

describe('T039 6. tracked: false인 주문에는 추적 등록 호출이 나가지 않는다', () => {
  it('manifest의 tracked: false 주문은 조회도 하지 않는다', async () => {
    const manifest: Manifest = {
      orders: [
        { key: 'O02', orderId: 'ORDER-O02', buyer: 'jiho', sku: 'FK-CD-OAT', tracked: false, captureId: 'CAP-O02' },
        { key: 'O13', orderId: 'ORDER-O13', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: false, captureId: 'CAP-O13' },
      ],
      disputes: [],
    };
    const { client, seen } = fakeClient(() => ({ status: 200, body: orderDetail({ captureId: 'CAP-X' }) }));

    const outcomes = await runTrack(client, manifest);

    expect(outcomes).toEqual([]);
    expect(seen).toEqual([]);
  });

  it('tracked: false인 주문은 분쟁이 없어도 대상이 아니다 (O13)', () => {
    const manifest = manifest13();
    const noDisputes: Manifest = { ...manifest, disputes: [] };

    const { targets, blocked } = planTrack(noDisputes);

    expect(targets.map((o) => o.key)).not.toContain('O13');
    expect(blocked).toEqual([]);
    expect(targets.every((order) => order.tracked)).toBe(true);
  });
});

describe('T039 7. 실제 분쟁을 바꾸는 POST 경로가 없다', () => {
  /** 이 태스크가 다루는 스크립트 전부. */
  const SCRIPTS = [
    'scripts/create-sandbox-orders.ts',
    'scripts/capture-sandbox-orders.ts',
    'scripts/sandbox/check.ts',
    'scripts/sandbox/check-steps.ts',
    'scripts/sandbox/setup.ts',
    'scripts/sandbox/setup-steps.ts',
    'scripts/sandbox/disputes.ts',
    'scripts/sandbox/disputes-read.ts',
    'scripts/sandbox/manifest.ts',
    'scripts/sandbox/last-run.ts',
    'scripts/sandbox/paypal.ts',
    'scripts/sandbox/env.ts',
    'scripts/sandbox/npm-args.ts',
  ];

  /** 분쟁 상태를 바꾸는 엔드포인트 (SPEC 9-3: 샌드박스 스크립트는 하나도 부르지 않는다). */
  const DISPUTE_ACTIONS = [
    'send-message',
    'provide-evidence',
    'make-offer',
    'accept-offer',
    'deny-offer',
    'accept-claim',
    'acknowledge-return-item',
    'escalate',
    'appeal',
    'require-evidence',
    'adjudicate',
  ];

  const sources = () => SCRIPTS.map((file) => ({ file, text: readFileSync(path.join(ROOT, file), 'utf8') }));

  it('분쟁 조치 엔드포인트가 어느 스크립트에도 없다', () => {
    for (const { file, text } of sources()) {
      for (const action of DISPUTE_ACTIONS) {
        expect(text.includes(`/${action}`), `${file}: /${action}`).toBe(false);
      }
    }
  });

  it('POST 경로는 주문 생성·캡처·추적 등록뿐이다', () => {
    const allowed = [`'/v2/checkout/orders'`, '${orderPath}/track', '${orderPath}/capture'];
    let seen = 0;
    for (const { file, text } of sources()) {
      const paths = [...text.matchAll(/method: 'POST',\s*\n\s*path: ([^\n]+?),\s*\n/g)].map((m) => m[1]);
      seen += paths.length;
      for (const found of paths) {
        expect(allowed.some((ok) => found.includes(ok)), `${file}: POST ${found}`).toBe(true);
      }
    }
    // 찾은 POST가 0건이면 위 검사가 헛돈 것이다 (주문 생성·probe·캡처·추적 = 5건)
    expect(seen).toBe(5);
  });

  it('시연 제외 분쟁 ID는 스크립트 어디에도 하드코딩되어 있지 않다', () => {
    for (const { file, text } of sources()) {
      expect(text.includes(EXCLUDED_DISPUTE_ID), file).toBe(false);
    }
  });
});

// ── T051: 연습용 분쟁(`P…`)이 늘어도 스크립트가 흔들리지 않는다 ─────────────────
//
// 사람이 녹화 전 실제 전송을 시험할 때마다 연습용 분쟁이 manifest에 쌓인다. 연습용은 `D2-old`와
// 같은 취급(시연 제외)을 받아야 한다: 보고에는 나오고, D1~D3으로 다시 배정되지 않고,
// 그 주문에는 추적 등록 호출이 나가지 않는다. 모두 가짜 클라이언트로만 확인한다 (실호출 0회).

describe('T051 1. sandbox:check — 연습용 분쟁도 "시연 제외"로 보고한다', () => {
  it.each(PRACTICE_COUNTS)('연습용 %i건: manifest의 분쟁 전부를 조회하고 시연 제외에만 표시를 붙인다', async (count) => {
    const manifest = manifestWithPractice(count);
    const { client, seen } = checkClient(manifest);

    const { report, problems } = await runCheck(client, manifest, NOW);

    expect(problems).toEqual([]);
    expect(report.disputes).toHaveLength(manifest.disputes.length);
    expect(report.disputes.filter((d) => d.demoExcluded === true).map((d) => d.key)).toEqual(
      excludedDisputes(manifest.disputes).map((d) => d.key),
    );
    expect(report.disputes.filter((d) => d.demoExcluded !== true).map((d) => d.key)).toEqual(DEMO_DISPUTE_KEYS);
    // 연습용 분쟁도 빠짐없이 조회된다
    for (const dispute of practiceDisputes(count)) {
      expect(report.disputes.find((d) => d.key === dispute.key)?.demoExcluded, dispute.key).toBe(true);
    }
    expect(seen.every((s) => s.method === 'GET')).toBe(true); // 조회만 한다
  });

  it.each(PRACTICE_COUNTS)('연습용 %i건: last-run.md에 D2-old와 같이 ID + "시연 제외"로 적힌다', async (count) => {
    const manifest = manifestWithPractice(count);
    const { client } = checkClient(manifest);

    const outcome = await runCheck(client, manifest, NOW);
    const section = checkSection(outcome, manifest, NOW);
    const lineFor = (id: string) => section.split('\n').find((line) => line.startsWith('|') && line.includes(id));

    for (const dispute of manifest.disputes) expect(section, dispute.key).toContain(dispute.disputeId);
    for (const dispute of excludedDisputes(manifest.disputes)) {
      // 표의 행과 아래 설명 줄 모두 D2-old와 같은 취급이다
      expect(lineFor(dispute.disputeId), dispute.key).toContain(DEMO_EXCLUDED_CELL);
      expect(section, dispute.key).toContain(`- ${dispute.key} (${dispute.disputeId}): ${DEMO_EXCLUDED_CELL}`);
    }
    // 시연 분쟁 행에는 붙지 않는다
    for (const dispute of demoDisputes(manifest.disputes)) {
      expect(lineFor(dispute.disputeId), dispute.key).not.toContain(DEMO_EXCLUDED_CELL);
    }
  });

  it('조회가 모두 실패해도 연습용 분쟁의 ID와 "시연 제외"는 last-run.md에 남는다', async () => {
    const manifest = manifestWithPractice(3);
    const { client } = fakeClient(() => ({ status: 403, body: { name: 'NOT_AUTHORIZED' } }));

    const section = checkSection(await runCheck(client, manifest, NOW), manifest, NOW);

    for (const dispute of practiceDisputes(3)) {
      expect(section, dispute.key).toContain(dispute.disputeId);
      expect(section, dispute.key).toContain(`- ${dispute.key} (${dispute.disputeId}): ${DEMO_EXCLUDED_CELL}`);
    }
  });
});

describe('T051 2. setup -- disputes 재실행 — 연습용 분쟁이 보존된다', () => {
  /** D1~D3이 걸린 캡처만 답한다. 연습용 주문의 캡처는 표에 없다 (물으면 404 = 실수가 드러난다). */
  const listReplies = (o13: string[]) => ({
    [listPath(capOf('O02'))]: { status: 200, body: { items: [{ dispute_id: 'PP-R-MBJ-10197650' }] } },
    [listPath(capOf('O08'))]: { status: 200, body: { items: [{ dispute_id: 'PP-R-FYT-10197651' }] } },
    [listPath(capOf('O13'))]: { status: 200, body: { items: o13.map((id) => ({ dispute_id: id })) } },
  });

  it.each(PRACTICE_COUNTS)('연습용 %i건: 재실행해도 그대로 남고, 마지막 확인(D1·D2·D3)이 통과한다', async (count) => {
    const manifest = manifestWithPractice(count);
    const { client, seen } = mapClient(listReplies(['PP-R-GMS-10197661']));

    const { disputes } = await runDisputes(client, manifest);
    const merged = mergeDisputes(manifest.disputes, disputes);

    // 연습용 항목이 글자 하나 바뀌지 않고 남는다 (메모 포함)
    for (const dispute of practiceDisputes(count)) {
      expect(disputeOf(merged, dispute.key), dispute.key).toEqual(dispute);
    }
    expect(disputeOf(merged, 'D2-old')).toEqual(disputeOf(manifest.disputes, 'D2-old'));
    expect(disputeOf(merged, 'D2')).toEqual({ key: 'D2', disputeId: 'PP-R-GMS-10197661', orderKey: 'O13' });
    expect(merged.map((d) => d.key)).toEqual(['D1', 'D2', 'D2-old', 'D3', ...practiceDisputes(count).map((d) => d.key)]);
    // 마지막 확인: 시연 제외를 뺀 D1·D2·D3이 모두 있다
    expect(missingDisputeKeys(merged)).toEqual([]);
    // 연습용 분쟁이 걸린 주문의 캡처로는 조회하지 않는다
    for (const orderKey of PRACTICE_ORDER_KEYS.slice(0, count)) {
      expect(seen.map((s) => s.path), orderKey).not.toContain(
        `/v1/customer/disputes?disputed_transaction_id=${capOf(orderKey)}&page_size=10`,
      );
    }
    expect(seen.every((s) => s.method === 'GET')).toBe(true);
  });

  it.each(PRACTICE_COUNTS)('연습용 %i건: 그 분쟁 ID가 목록에 나와도 D1~D3으로 배정하지 않는다', async (count) => {
    const practice = practiceDisputes(count);
    const manifest = manifestWithPractice(count);
    // 연습용 분쟁 ID가 D2의 캡처 목록에 섞여 돌아온 경우
    const { client } = mapClient(listReplies([...practice.map((d) => d.disputeId), 'PP-R-GMS-10197661']));

    const { disputes, outcomes } = await runDisputes(client, manifest);
    const merged = mergeDisputes(manifest.disputes, disputes);

    expect(disputeOf(disputes, 'D2')?.disputeId).toBe('PP-R-GMS-10197661');
    for (const dispute of practice) {
      expect(disputes.map((d) => d.disputeId), dispute.key).not.toContain(dispute.disputeId);
      // 연습용 ID는 원래 키에만 남는다 (D1~D3 어디에도 가지 않는다)
      expect(merged.filter((d) => d.disputeId === dispute.disputeId).map((d) => d.key), dispute.key).toEqual([dispute.key]);
    }
    if (count > 0) expect(outcomes.find((o) => o.key === 'D2')?.note).toContain('시연 제외');
    expect(missingDisputeKeys(merged)).toEqual([]);
  });

  it('연습용 분쟁만 걸려 있으면 D2를 비워 두고, 전에 적어 둔 D2가 지워지지 않는다', async () => {
    const practice = practiceDisputes(1);
    const manifest = manifestWithPractice(1);
    const { client } = mapClient(listReplies(practice.map((d) => d.disputeId)));

    const { disputes, outcomes } = await runDisputes(client, manifest);
    const merged = mergeDisputes(manifest.disputes, disputes);

    expect(disputeOf(disputes, 'D2')).toBeUndefined();
    expect(outcomes.find((o) => o.key === 'D2')?.disputeId).toBeNull();
    expect(outcomes.find((o) => o.key === 'D2')?.note).toContain('시연 제외');
    expect(disputeOf(merged, 'D2')).toEqual(disputeOf(manifest.disputes, 'D2')); // 전에 적어 둔 값 그대로
    expect(missingDisputeKeys(merged)).toEqual([]);
  });

  it.each(PRACTICE_COUNTS)('연습용 %i건: 두 번 돌려도 결과가 같다 (멱등)', async (count) => {
    const manifest = manifestWithPractice(count);
    const { client } = mapClient(listReplies(['PP-R-GMS-10197661']));

    const first = mergeDisputes(manifest.disputes, (await runDisputes(client, manifest)).disputes);
    const second = mergeDisputes(first, (await runDisputes(client, { ...manifest, disputes: first })).disputes);

    expect(second).toEqual(first);
  });
});

describe('T051 3. setup -- track — 연습용 분쟁이 걸린 주문에는 호출이 나가지 않는다 (SPEC 9-3)', () => {
  const trackClient = () =>
    fakeClient((method) =>
      method === 'GET' ? { status: 200, body: orderDetail({ captureId: 'CAP-X' }) } : { status: 201, body: {} },
    );

  it.each(PRACTICE_COUNTS)('연습용 %i건: 그 주문은 추적 등록 대상이 아니다 (planTrack, 순수 함수)', (count) => {
    const manifest = manifestWithPractice(count);

    const { targets, blocked } = planTrack(manifest);

    for (const orderKey of PRACTICE_ORDER_KEYS.slice(0, count)) {
      expect(targets.map((o) => o.key), orderKey).not.toContain(orderKey);
    }
    // `tracked: true`인 연습용 주문(O06)은 `blocked`에 들어간다. `tracked: false`는 어느 쪽에도 없다.
    const trackedPractice = PRACTICE_ORDER_KEYS.slice(0, count).filter(
      (key) => manifest.orders.find((o) => o.key === key)?.tracked === true,
    );
    for (const orderKey of trackedPractice) {
      expect(blocked.map((b) => b.order.key), orderKey).toContain(orderKey);
    }
  });

  it.each(PRACTICE_COUNTS)('연습용 %i건: O04를 비롯한 연습용 주문에 호출 0회다 (runTrack)', async (count) => {
    const manifest = manifestWithPractice(count);
    const { client, seen } = trackClient();

    const outcomes = await runTrack(client, manifest);

    for (const orderKey of PRACTICE_ORDER_KEYS.slice(0, count)) {
      const orderId = manifest.orders.find((o) => o.key === orderKey)?.orderId ?? '';
      expect(seen.filter((s) => s.path.includes(orderId)), orderKey).toEqual([]);
    }
    // 등록은 분쟁 없는 `tracked: true` 주문에만 나간다 (연습용이 늘면 그만큼 줄어든다)
    const expectedAdded = planTrack(manifest).targets.map((o) => o.key);
    expect(outcomes.filter((o) => o.result === 'added').map((o) => o.key)).toEqual(expectedAdded);
    expect(seen.filter((s) => s.method === 'POST').map((s) => s.path)).toEqual(
      expectedAdded.map((key) => `/v2/checkout/orders/ORDER-${key}/track`),
    );
  });

  it('연습용 분쟁의 주문이 tracked: true이면 "분쟁 진행 중이라 제외 · 시연 제외"로 적는다', async () => {
    const manifest = manifestWithPractice(3); // P3 → O06 (tracked: true)
    const { client, seen } = trackClient();

    const outcomes = await runTrack(client, manifest);
    const o06 = outcomes.find((o) => o.key === 'O06');

    expect(o06?.result).toBe('disputed');
    expect(o06?.note).toContain(TRACK_DISPUTED_NOTE);
    expect(o06?.note).toContain('P3');
    expect(o06?.note).toContain('시연 제외');
    expect(o06?.status).toBeNull();
    expect(o06?.trackingNumber).toBeNull();
    expect(seen.filter((s) => s.path.includes('ORDER-O06'))).toEqual([]);
  });

  it('연습용 분쟁이 유일한 분쟁이어도 그 주문은 제외한다 (tracked: true)', () => {
    const manifest: Manifest = {
      orders: [{ key: 'O04', orderId: 'ORDER-O04', buyer: 'yuki', sku: 'FK-SW-NV', tracked: true, captureId: 'CAP-O04' }],
      disputes: practiceDisputes(1), // P1 → O04
    };

    expect(planTrack(manifest).targets).toEqual([]);
    expect(planTrack(manifest).blocked.map((b) => b.order.key)).toEqual(['O04']);
  });
});
