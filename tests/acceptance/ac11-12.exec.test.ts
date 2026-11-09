/**
 * 인수 테스트 AC11~AC12: 메시지 금액 일치, 승인 없이는 실행 안 함 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
 * 기준: SPEC v1.1. 실행 계약: SPEC.md 5장·7장. 엔진 구현 없이 돌도록 ActionPlan을 직접 만들고, PayPal 호출은 mock으로 받는다.
 * v1.1: 한 계획에 호출 1회. 제안은 make-offer 1회(메시지는 note), send-message는 제안이 없을 때만 (2026-11-09 결정).
 */
import { describe, expect, it, vi } from 'vitest';

import { executeMove } from '@/exec/execute';
import type { ActionPlan, ApiRequest, Approval, ExecuteInput, ExecuteResult } from '@/types';

import { CARDIGAN } from './boards';

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09. 가디건 $48의 15% = 720¢ = "7.20"
const OFFER_PLAN: ActionPlan = {
  planId: 'plan-test-offer',
  disputeId: CARDIGAN.disputeId,
  move: 'offer',
  apiMove: 'make_offer',
  amountCents: 720,
  currency: 'USD',
  refundType: 'REFUND',
  messageRequired: false,
  requiresApproval: true,
};

const REFUND_PLAN: ActionPlan = {
  ...OFFER_PLAN,
  planId: 'plan-test-refund',
  move: 'refund',
  apiMove: 'accept_claim',
  amountCents: 4800,
};

const approve = (plan: ActionPlan, extra: Partial<Approval> = {}): Approval => ({
  planId: plan.planId,
  approvedBy: 'seller@test',
  approvedAt: '2026-11-09T00:00:00.000Z',
  ...extra,
});

const OFFER_TEMPLATE =
  '안녕하세요. 상품이 설명과 달라 불편을 드려 죄송합니다. 상품은 그대로 두시고 {{offerAmount}}를 부분 환불해 드리고 싶습니다.';

function mockCaller() {
  const requests: ApiRequest[] = [];
  const call = vi.fn(async (req: ApiRequest) => {
    requests.push(req);
    return { status: 200, body: {} };
  });
  return { call, requests };
}

/** 예외로 거부하든 ok:false로 거부하든 같은 거부로 본다 */
async function settle(p: Promise<ExecuteResult>): Promise<ExecuteResult | { ok: false; thrown: unknown }> {
  try {
    return await p;
  } catch (thrown) {
    return { ok: false, thrown };
  }
}

/** 요청 본문에 실린 사람이 읽는 문장(note, message) */
function messagesOf(requests: ApiRequest[]): string[] {
  return requests.flatMap((r) =>
    ['note', 'message'].map((k) => r.body[k]).filter((v): v is string => typeof v === 'string'),
  );
}

/** 문장 안의 달러 금액 표기 ("$7.20", "$ 7.20") */
const dollarAmounts = (text: string) => [...text.matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)].map((m) => m[1]);

/** 호출한 대응 엔드포인트 목록 (경로 마지막 부분) */
const endpoints = (requests: ApiRequest[]) => requests.map((r) => r.path.split('/').pop());

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC11 메시지 초안 안의 금액 = 실행할 API 금액', () => {
  it('make_offer: make-offer 1회만 (send-message 없음), 메시지는 note, offer_amount "7.20" USD, 메시지 속 금액도 모두 $7.20', async () => {
    const { call, requests } = mockCaller();
    const input: ExecuteInput = { board: CARDIGAN, plan: OFFER_PLAN, messageTemplate: OFFER_TEMPLATE, approval: approve(OFFER_PLAN) };
    const result = await executeMove(input, { call });

    expect(result.ok).toBe(true);
    expect(endpoints(requests)).toEqual(['make-offer']);
    const offer = requests[0];
    expect(offer.path).toBe(`/v1/customer/disputes/${CARDIGAN.disputeId}/make-offer`);
    expect(offer.body.offer_amount).toEqual({ currency_code: 'USD', value: '7.20' });
    expect(offer.body.note).toEqual(expect.stringContaining('$7.20'));

    const messages = messagesOf(requests);
    expect(messages.length).toBeGreaterThan(0);
    const amounts = messages.flatMap(dollarAmounts);
    expect(amounts.length).toBeGreaterThan(0);
    for (const a of amounts) expect(a).toBe('7.20');
    for (const m of messages) expect(m).not.toContain('{{');
  });

  it('accept_claim: 본문 refund_amount "48.00" USD, 메시지 속 금액도 모두 $48.00', async () => {
    const { call, requests } = mockCaller();
    const input: ExecuteInput = {
      board: CARDIGAN,
      plan: REFUND_PLAN,
      messageTemplate: '요청하신 대로 {{refundAmount}} 전액을 환불해 드립니다.',
      approval: approve(REFUND_PLAN, { confirmAcceptClaim: true }),
    };
    const result = await executeMove(input, { call });

    expect(result.ok).toBe(true);
    expect(endpoints(requests)).toEqual(['accept-claim']);
    const accept = requests[0];
    expect(accept.body.refund_amount).toEqual({ currency_code: 'USD', value: '48.00' });
    const amounts = messagesOf(requests).flatMap(dollarAmounts);
    expect(amounts.length).toBeGreaterThan(0);
    for (const a of amounts) expect(a).toBe('48.00');
  });

  it('send_message (제안 없음): send-message 1회, 메시지 속 금액은 분쟁 금액 $48.00', async () => {
    const plan: ActionPlan = {
      ...OFFER_PLAN,
      planId: 'plan-test-message',
      move: 'fight',
      apiMove: 'send_message',
      amountCents: null,
      refundType: null,
      messageRequired: true,
    };
    const { call, requests } = mockCaller();
    const input: ExecuteInput = {
      board: CARDIGAN,
      plan,
      messageTemplate: '{{disputeAmount}} 결제 건은 배송 완료 기록을 확인했습니다. 추적 정보를 함께 보내 드립니다.',
      approval: approve(plan),
    };
    const result = await executeMove(input, { call });

    expect(result.ok).toBe(true);
    expect(endpoints(requests)).toEqual(['send-message']);
    expect(requests[0].body.message).toEqual(expect.stringContaining('$48.00'));
    for (const a of messagesOf(requests).flatMap(dollarAmounts)) expect(a).toBe('48.00');
  });

  it.each([
    ['$ 금액을 직접 쓴 초안', '상품은 그대로 두시고 $5.00를 환불해 드리겠습니다.'],
    ['USD 금액을 직접 쓴 초안', '상품은 그대로 두시고 5 USD를 환불해 드리겠습니다.'],
    ['모르는 자리표시자', '상품은 그대로 두시고 {{discount}}를 환불해 드리겠습니다.'],
  ])('%s → API를 호출하지 않고 거부', async (_name, template) => {
    const { call } = mockCaller();
    const input: ExecuteInput = { board: CARDIGAN, plan: OFFER_PLAN, messageTemplate: template, approval: approve(OFFER_PLAN) };
    const result = await settle(executeMove(input, { call }));
    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC12 승인 없이는 API 호출 안 됨', () => {
  const base: ExecuteInput = { board: CARDIGAN, plan: OFFER_PLAN, messageTemplate: OFFER_TEMPLATE, approval: null };

  it.each<[string, ExecuteInput]>([
    ['승인 없음', base],
    ['다른 계획에 대한 승인', { ...base, approval: approve(REFUND_PLAN) }],
    [
      'accept_claim인데 확인 플래그 없음',
      { ...base, plan: REFUND_PLAN, messageTemplate: '{{refundAmount}} 환불', approval: approve(REFUND_PLAN) },
    ],
  ])('%s → 거부, PayPal 호출 0회', async (_name, input) => {
    const { call } = mockCaller();
    const result = await settle(executeMove(input, { call }));
    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('대조: 같은 계획에 맞는 승인이 있으면 호출한다', async () => {
    const { call } = mockCaller();
    const result = await executeMove({ ...base, approval: approve(OFFER_PLAN) }, { call });
    expect(result.ok).toBe(true);
    expect(call).toHaveBeenCalled();
  });
});
