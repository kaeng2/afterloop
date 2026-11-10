/**
 * 단위 테스트: 추적번호 일괄 등록 (T011). 가짜 클라이언트만 쓴다 — 실제 PayPal 호출 0회.
 * manifest·스크립트는 읽기 용도로만 import한다.
 */
import { describe, expect, it } from 'vitest';
import manifestJson from '../../tests/sandbox/manifest.json';
import { ManifestSchema } from '../../scripts/sandbox/manifest';
import { hasTracker } from '../../scripts/sandbox/paypal';
import * as script from '../../scripts/sandbox/setup-steps';
import {
  CARRIER_NAME_OTHER,
  DRY_RUN_GATE,
  disputedOrderKeys,
  isOrderUntracked,
  listUntracked,
  liveGateFromEnv,
  registerTrackers,
  trackDisputedNote,
  trackRequestId,
  trackingNumberFor,
  type LiveGate,
} from '@/paypal/track';
import { readTrackOrders, TrackManifestSchema } from '@/paypal/track-orders';
import type { PayPalClient } from '@/types';

const data = readTrackOrders();
const keys = data.orders.map((o) => o.key);
const disputedKeys = [...disputedOrderKeys(data.disputes).keys()];
const freeKeys = keys.filter((k) => !disputedKeys.includes(k));
const orderIdOf = (key: string): string => data.orders.find((o) => o.key === key)!.orderId;

type Call = { method: 'GET' | 'POST'; path: string; body?: Record<string, unknown>; requestId?: string };
type Reply = { status: number; body: unknown } | Error;

function fake(handler: (call: Call) => Reply = () => ({ status: 200, body: { purchase_units: [] } })) {
  const calls: Call[] = [];
  const run = async (call: Call) => {
    calls.push(call);
    const r = handler(call);
    if (r instanceof Error) throw r;
    return r;
  };
  const client: PayPalClient = {
    get: (path) => run({ method: 'GET', path }),
    call: (req) => run({ method: 'POST', path: req.path, body: req.body, requestId: req.requestId }),
  };
  return { client, calls };
}

const trackedBody = { purchase_units: [{ shipping: { trackers: [{ status: 'SHIPPED' }] } }] };
const liveGate = (allowed: string[], recording = false): LiveGate => ({ enabled: true, allowedKeys: allowed, recordingConfirmed: recording });

describe('manifest 읽기', () => {
  it('정적 import한 manifest가 두 스키마를 같은 결과로 통과한다', () => {
    const ours = TrackManifestSchema.parse(manifestJson);
    const theirs = ManifestSchema.parse(manifestJson);
    expect(ours).toEqual(theirs);
    expect(data.orders.length).toBeGreaterThan(0);
  });

  it('틀린 모양은 둘 다 거부한다', () => {
    for (const bad of [{ orders: [{ key: 'O1' }] }, { orders: 3 }, { disputes: [{ key: 'D1', orderKey: 'O1' }] }]) {
      expect(TrackManifestSchema.safeParse(bad).success).toBe(false);
      expect(ManifestSchema.safeParse(bad).success).toBe(false);
      expect(() => readTrackOrders(bad)).toThrow();
    }
  });

  it('분쟁 걸린 주문 키 집합과 사유 글이 스크립트와 같다', () => {
    const ours = disputedOrderKeys(data.disputes);
    const theirs = script.disputedOrderKeys(ManifestSchema.parse(manifestJson).disputes);
    expect([...ours.keys()].sort()).toEqual([...theirs.keys()].sort());
    for (const [k, list] of theirs) {
      expect(ours.get(k)?.map((d) => d.key)).toEqual(list.map((d) => d.key));
      expect(trackDisputedNote(ours.get(k)!)).toBe(script.trackDisputedNote(list));
    }
    expect(trackDisputedNote([])).toBe(script.trackDisputedNote([]));
  });

  it('추적번호·요청 번호·운송사 이름이 스크립트와 같다', () => {
    for (const k of [...keys, 'O03', 'O7']) {
      expect(trackingNumberFor(k)).toBe(script.trackingNumberFor(k));
      expect(trackRequestId(k)).toBe(script.trackRequestId(k));
    }
    expect(trackingNumberFor('O03')).toBe('FKAL032026');
    expect(trackRequestId('O03')).toBe('afterloop-track-O03');
    expect(CARRIER_NAME_OTHER).toBe(script.CARRIER_NAME_OTHER);
  });

  it('주문 배분: O01·O02·O04·O08·O13은 분쟁, O03·O05·O07은 아니다', () => {
    for (const k of ['O01', 'O02', 'O04', 'O08', 'O13']) expect(disputedKeys).toContain(k);
    for (const k of ['O03', 'O05', 'O07']) expect(disputedKeys).not.toContain(k);
  });
});

describe('isOrderUntracked', () => {
  const bodies = [
    {},
    null,
    trackedBody,
    { purchase_units: [{ shipping: { trackers: [{ status: 'CANCELLED' }] } }] },
    { purchase_units: [{ payments: { captures: [{ id: 'C', trackers: [{ status: 'SHIPPED' }] }] } }] },
    { purchase_units: [{ payments: { captures: [{ id: 'C', trackers: [{ status: 'CANCELLED' }] }] } }] },
  ];
  it('scripts의 hasTracker와 반대로 같은 동작', () => {
    for (const b of bodies) expect(isOrderUntracked(b)).toBe(!hasTracker(b));
    expect(isOrderUntracked(bodies[3])).toBe(true);
  });
});

describe('listUntracked', () => {
  it('분쟁 걸린 주문은 GET 없이 excluded, 조회 실패는 그 행만 unknown', async () => {
    const failing = freeKeys[0]!;
    const { client, calls } = fake((c) => {
      if (c.path.includes(orderIdOf(failing))) return new Error('boom Authorization: Bearer SECRET');
      return { status: 200, body: {} };
    });
    const rows = await listUntracked(client, data.orders, data.disputes);
    expect(rows).toHaveLength(keys.length);
    for (const k of disputedKeys) {
      expect(rows.find((r) => r.key === k)?.excluded).toBe(true);
      expect(calls.some((c) => c.path.includes(orderIdOf(k)))).toBe(false);
    }
    expect(rows.find((r) => r.key === failing)?.state).toBe('unknown');
    expect(JSON.stringify(rows)).not.toContain('SECRET');
    expect(rows.filter((r) => r.state === 'untracked').length).toBe(freeKeys.length - 1);
  });
});

describe('registerTrackers', () => {
  const run = (client: PayPalClient, selectedKeys: string[], live: LiveGate) => registerTrackers(client, { data, selectedKeys, live });

  it('분쟁 걸린 주문은 selectedKeys에 넣어도 호출 0회', async () => {
    const { client, calls } = fake();
    const r = await run(client, disputedKeys, liveGate(disputedKeys));
    expect(calls).toHaveLength(0);
    expect(r.results.map((x) => x.result)).toEqual(disputedKeys.map(() => 'excluded_dispute'));
    expect(r.results.every((x) => x.note === '분쟁 진행 중이라 제외')).toBe(true);
    expect(r.counts.excluded).toBe(disputedKeys.length);
  });

  it('미등록 주문은 GET 1 + POST 1, 요청 번호·본문이 스크립트와 같다 (두 번 보내도 같다)', async () => {
    const { client, calls } = fake((c) => (c.method === 'GET' ? { status: 200, body: { purchase_units: [{ payments: { captures: [{ id: 'CAP1' }] } }] } } : { status: 200, body: {} }));
    const live = liveGate(['O03']);
    const r1 = await run(client, ['O03'], live);
    await run(client, ['O03'], live);
    const posts = calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0]!.requestId).toBe('afterloop-track-O03');
    expect(posts[1]!.requestId).toBe(posts[0]!.requestId);
    expect(posts[0]!.path).toBe(`/v2/checkout/orders/${orderIdOf('O03')}/track`);
    expect(posts[0]!.body).toEqual({
      capture_id: data.orders.find((o) => o.key === 'O03')!.captureId ?? 'CAP1',
      tracking_number: 'FKAL032026',
      carrier: 'OTHER',
      carrier_name_other: 'Fernwood Knits demo carrier',
      notify_payer: false,
    });
    expect(r1.counts.added).toBe(1);
    expect(r1.statusCodes).toEqual([200]);
    expect(r1.mode).toBe('live');
    expect(r1.results[0]).toMatchObject({ dryRun: false, virtualTracking: true, result: 'added' });
    expect(calls.every((c) => !c.path.includes('/v1/shipping/trackers'))).toBe(true);
  });

  it('이미 추적이 있으면 POST 0회, 취소된 추적만 있으면 미등록', async () => {
    const a = fake(() => ({ status: 200, body: trackedBody }));
    const r = await run(a.client, ['O03'], liveGate(['O03']));
    expect(r.results[0]!.result).toBe('skipped_already_tracked');
    expect(a.calls.filter((c) => c.method === 'POST')).toHaveLength(0);

    const b = fake((c) => (c.method === 'GET' ? { status: 200, body: { purchase_units: [{ shipping: { trackers: [{ status: 'CANCELLED' }] } }] } } : { status: 200, body: {} }));
    expect((await run(b.client, ['O03'], liveGate(['O03']))).results[0]!.result).toBe('added');
  });

  it('일부 실패해도 나머지는 계속: 4xx·예외', async () => {
    const free = ['O03', 'O05', 'O07'].filter((k) => keys.includes(k));
    expect(free).toHaveLength(3);
    const { client } = fake((c) => {
      if (c.method === 'GET') return { status: 200, body: {} };
      if (c.path.includes(orderIdOf('O05'))) return { status: 422, body: { name: 'UNPROCESSABLE', details: [{ issue: 'ITEM_NOT_FOUND', description: 'buyer@example.com' }], debug_id: 'dbg1' } };
      return { status: 200, body: {} };
    });
    const r = await run(client, free, liveGate(free, true));
    expect(r.results.map((x) => x.result)).toEqual(['added', 'failed', 'added']);
    expect(r.results[1]!.note).toContain('ITEM_NOT_FOUND');
    expect(JSON.stringify(r)).not.toContain('buyer@example.com');

    const thrower = fake((c) => (c.path.includes(orderIdOf('O05')) ? Object.assign(new Error('Authorization: Bearer SECRET client_secret'), { status: 500 }) : { status: 200, body: {} }));
    const r2 = await run(thrower.client, free, liveGate(free, true));
    expect(r2.results.map((x) => x.result)).toEqual(['added', 'failed', 'added']);
    expect(JSON.stringify(r2)).not.toMatch(/SECRET|Bearer|client_secret/);
  });

  it('스위치가 꺼져 있으면 호출 0회 + dry_run', async () => {
    const { client, calls } = fake();
    const r = await run(client, ['O03', 'O05', 'O07', 'O02'], DRY_RUN_GATE);
    expect(calls).toHaveLength(0);
    expect(r.dryRun).toBe(true);
    expect(r.mode).toBe('dry_run');
    expect(r.statusCodes).toEqual([]);
    expect(r.counts.added).toBe(0);
    const free = r.results.filter((x) => x.result === 'dry_run');
    expect(free.map((x) => x.key)).toEqual(['O03', 'O05', 'O07']);
    expect(free.every((x) => x.dryRun && x.status === null && x.trackingNumber !== null)).toBe(true);
  });

  it('스위치만 켜면 O03만 나가고 O05·O07은 not_allowed', async () => {
    const { client, calls } = fake();
    const gate = liveGateFromEnv({ AFTERLOOP_TRACK_LIVE: '1' }, keys);
    expect(gate.allowedKeys).toEqual(['O03']);
    const r = await run(client, ['O03', 'O05', 'O07'], gate);
    expect(r.results.map((x) => x.result)).toEqual(['added', 'not_allowed', 'not_allowed']);
    expect(calls.filter((c) => c.path.includes(orderIdOf('O05')) || c.path.includes(orderIdOf('O07')))).toHaveLength(0);
  });

  it('녹화 확인이 없으면 O05를 목록에 넣어도 빠진다. registerTrackers도 다시 막는다', async () => {
    const gate = liveGateFromEnv({ AFTERLOOP_TRACK_LIVE: '1', AFTERLOOP_TRACK_LIVE_ORDERS: ' o03, O05 ,O07,ZZ99' }, keys);
    expect(gate.allowedKeys).toEqual(['O03']);
    const forced = fake();
    const r = await run(forced.client, ['O05'], { enabled: true, allowedKeys: ['O05'], recordingConfirmed: false });
    expect(r.results[0]!.result).toBe('not_allowed');
    expect(forced.calls).toHaveLength(0);
  });

  it('세 변수를 모두 켜면 O05·O07이 나간다', async () => {
    const gate = liveGateFromEnv(
      { AFTERLOOP_TRACK_LIVE: '1', AFTERLOOP_TRACK_LIVE_ORDERS: 'O05,O07', AFTERLOOP_TRACK_RECORDING: '1' },
      keys,
    );
    expect(gate).toEqual({ enabled: true, allowedKeys: ['O05', 'O07'], recordingConfirmed: true });
    const { client, calls } = fake();
    const r = await run(client, ['O03', 'O05', 'O07'], gate);
    expect(r.results.map((x) => x.result)).toEqual(['not_allowed', 'added', 'added']);
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2);
  });

  it('liveGateFromEnv는 1이 아닌 값과 NEXT_PUBLIC_ 이름을 무시한다', () => {
    for (const v of [undefined, '0', 'true', 'yes', '']) {
      expect(liveGateFromEnv({ AFTERLOOP_TRACK_LIVE: v }).enabled).toBe(false);
    }
    const g = liveGateFromEnv({ NEXT_PUBLIC_AFTERLOOP_TRACK_LIVE: '1', NEXT_PUBLIC_AFTERLOOP_TRACK_RECORDING: '1', AFTERLOOP_TRACK_LIVE_ORDERS: 'O05' });
    expect(g.enabled).toBe(false);
    expect(g.recordingConfirmed).toBe(false);
    expect(g.allowedKeys).toEqual([]);
  });

  it('모르는 키·중복 키·빈 목록', async () => {
    const { client, calls } = fake();
    const r = await run(client, ['O03', 'O03', 'NOPE'], DRY_RUN_GATE);
    expect(r.results.map((x) => [x.key, x.result])).toEqual([['O03', 'dry_run'], ['NOPE', 'unknown_order']]);
    expect(calls).toHaveLength(0);
    const empty = await run(client, [], liveGate(['O03']));
    expect(empty.results).toEqual([]);
    expect(empty.counts).toMatchObject({ added: 0, failed: 0 });
  });

  it('결과는 manifest 순서', async () => {
    const { client } = fake();
    const r = await run(client, [...keys].reverse(), DRY_RUN_GATE);
    expect(r.results.map((x) => x.key)).toEqual(keys);
  });
});
