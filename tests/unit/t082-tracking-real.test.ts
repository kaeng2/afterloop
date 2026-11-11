/**
 * T082: 분쟁이 걸린 주문의 실제 추적 등록 여부 → 사건 기록 "No tracking in PayPal".
 * 가짜 PayPal 클라이언트(GET만)·가짜 LLM. 실호출 0회.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadDemoDisputes } from '@/app/_server/disputes';
import { caseEventsFor } from '@/app/cases/history';
import type { DemoLink, LlmCaller, PayPalClient } from '@/types';

const D1 = 'PP-R-MBJ-10197650'; // 지호, O02 (미등록)
const D2 = 'PP-R-GMS-10197661'; // 서연, O13 (미등록)
const D3 = 'PP-R-FYT-10197651'; // Mike, O08 (등록됨)
const ORDER: Record<string, string> = {
  [D1]: '87436118KN796644C',
  [D2]: '02C95899V2403943M',
  [D3]: '8NW11847PM518611D',
};
const LINKS: DemoLink[] = [
  { paypalDisputeId: D1, seedDisputeId: 'D1', carrierOrderId: 'O02', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: D2, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: D3, seedDisputeId: 'D3', carrierOrderId: 'O08', showOnScreen: true, liveSendAllowed: false },
];
const NOW = '2026-11-10T17:00:00.000Z';

const detailOf = (id: string, reason: string, payer: string) => ({
  dispute_id: id,
  reason,
  status: 'WAITING_FOR_SELLER_RESPONSE',
  dispute_state: 'REQUIRED_ACTION',
  dispute_life_cycle_stage: 'INQUIRY',
  dispute_channel: 'INTERNAL',
  create_time: '2026-11-09T01:00:00.000Z',
  dispute_amount: { currency_code: 'USD', value: '74.00' },
  seller_response_due_date: '2026-11-30T00:37:00.000Z',
  disputed_transactions: [{ buyer_transaction_id: 'TXN1', buyer: { payer_id: payer } }],
  links: [{ rel: 'send_message', href: 'https://api-m.sandbox.paypal.com/x', method: 'POST' }],
  messages: [],
  evidences: [],
});
const INR = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
const DETAILS: Record<string, unknown> = {
  [D1]: detailOf(D1, 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', 'PAYERJIHO00001'),
  [D2]: detailOf(D2, INR, 'PAYERSEOYEON01'),
  [D3]: detailOf(D3, INR, 'PAYERBUYERM001'),
};

type Fake = PayPalClient & { getPaths: string[]; callCount: number };
/** orders: orderId → 'tracked' | 'untracked' | 'fail' (없으면 404) */
function fake(orders: Record<string, 'tracked' | 'untracked' | 'fail'>): Fake {
  const c: Fake = {
    getPaths: [],
    callCount: 0,
    call: async () => {
      c.callCount += 1;
      throw new Error('POST 금지');
    },
    get: async (path: string) => {
      c.getPaths.push(path);
      if (path.startsWith('/v1/customer/disputes?')) {
        return { status: 200, body: { items: Object.values(DETAILS), links: [] } };
      }
      if (path.startsWith('/v1/customer/disputes/')) {
        return { status: 200, body: DETAILS[path.slice('/v1/customer/disputes/'.length)] };
      }
      const mode = orders[path.slice('/v2/checkout/orders/'.length)];
      if (mode === 'fail') throw new Error('boom');
      if (mode === undefined) return { status: 404, body: {} };
      const trackers = mode === 'tracked' ? [{ status: 'SHIPPED' }] : [];
      return { status: 200, body: { purchase_units: [{ shipping: { trackers } }] } };
    },
  };
  return c;
}
const llm: LlmCaller = (async () => {
  throw new Error('no llm');
}) as unknown as LlmCaller;

type Result = Awaited<ReturnType<typeof loadDemoDisputes>>;
const run = (client: PayPalClient) => loadDemoDisputes({ client, llm, links: LINKS, now: NOW });
const byKey = (r: Result, key: string) => {
  const d = r.disputes.find((x) => x.key === key);
  if (d === undefined) throw new Error(key);
  return d;
};
const kinds = (d: Result['disputes'][number]) => caseEventsFor(d, []).map((e) => e.kind);

describe('T082 사건 기록: 실제로 확인한 경우에만 "추적 없음"', () => {
  it('Mike(등록됨) → 없음 / 서연·지호(미등록) → 있음', async () => {
    const r = await run(fake({ [ORDER[D1]]: 'untracked', [ORDER[D2]]: 'untracked', [ORDER[D3]]: 'tracked' }));
    expect(byKey(r, 'D3').boardReal.hasTracking).toBe(true);
    expect(kinds(byKey(r, 'D3'))).not.toContain('tracking_missing');
    for (const key of ['D1', 'D2']) {
      expect(byKey(r, key).boardReal.hasTracking).toBe(false);
      expect(kinds(byKey(r, key))).toContain('tracking_missing');
    }
  });

  it('조회 실패(예외·404) → 모름 → 사건 없음, 보드는 기존 자리값(없음)', async () => {
    const r = await run(fake({ [ORDER[D1]]: 'fail' })); // D1 예외, D2·D3 404
    for (const key of ['D1', 'D2', 'D3']) {
      const d = byKey(r, key);
      expect(d.trackingUnknown).toBe(true);
      expect(d.boardReal.hasTracking).toBe(false);
      expect(kinds(d)).not.toContain('tracking_missing');
    }
  });

  it('GET만 쓴다 (POST 0회), 같은 주문은 한 번만 읽는다', async () => {
    const client = fake({ [ORDER[D1]]: 'untracked', [ORDER[D2]]: 'untracked', [ORDER[D3]]: 'tracked' });
    await run(client);
    expect(client.callCount).toBe(0);
    const orderGets = client.getPaths.filter((p) => p.startsWith('/v2/checkout/orders/'));
    expect(orderGets).toHaveLength(3);
    expect(new Set(orderGets).size).toBe(3);
  });

  it('서연(O13 실제 미등록)의 보드·신호는 "모름" 때와 같다 ($74 비교 불변)', async () => {
    const known = byKey(await run(fake({ [ORDER[D2]]: 'untracked' })), 'D2');
    const unknown = byKey(await run(fake({})), 'D2');
    expect(known.boardReal).toEqual(unknown.boardReal);
    expect(known.boardDemo).toEqual(unknown.boardDemo);
    expect(known.signals).toEqual(unknown.signals);
    expect(known.signalsAfterReply).toEqual(unknown.signalsAfterReply);
  });

  it('주입한 realTracking은 그대로 쓴다 (기존 호출부 호환)', async () => {
    const r = await loadDemoDisputes({
      client: fake({}),
      llm,
      links: LINKS,
      now: NOW,
      realTracking: () => ({ hasTracking: false, hasDeliveredTracking: false }),
    });
    expect(byKey(r, 'D3').trackingUnknown).toBeUndefined();
    expect(kinds(byKey(r, 'D3'))).toContain('tracking_missing');
  });
});
