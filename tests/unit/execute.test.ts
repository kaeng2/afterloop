/**
 * 단위 테스트: 승인된 수 실행 (T008, SPEC v2.1 9-1장)
 *
 * 실제 네트워크 호출은 없다. PayPal 호출은 `deps.call`에 가짜 함수를 넣어 확인한다.
 * 인수 테스트(tests/acceptance/ac11-12.exec.test.ts)가 보는 계약은 여기서 다시 검사하지 않고,
 * 지시서의 단위 테스트 항목(중복 승인, provide_evidence, 2xx 아님, requestId, 금액 표기)만 본다.
 */
import { describe, expect, it, vi } from 'vitest';

import { centsToApiValue, centsToDisplay } from '@/exec/amount';
import { executeMove } from '@/exec/execute';
import type { ActionPlan, ApiRequest, Approval, BoardState, ExecuteInput } from '@/types';

const BOARD: BoardState = {
  disputeId: 'PP-D-UNIT-1',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-12T17:00:00Z',
  amountCents: 4800,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  hasTracking: false,
  hasDeliveredTracking: false,
  buyerPriorInrDisputes: 0,
  isDemo: true,
};

const OFFER_PLAN: ActionPlan = {
  planId: 'unit-offer',
  disputeId: BOARD.disputeId,
  move: 'offer',
  apiMove: 'make_offer',
  amountCents: 720,
  currency: 'USD',
  refundType: 'REFUND',
  messageRequired: false,
  requiresApproval: true,
};

const TEMPLATE = '{{offerAmount}}를 부분 환불해 드리고 싶습니다.';

function approve(plan: ActionPlan, extra: Partial<Approval> = {}): Approval {
  return { planId: plan.planId, approvedBy: 'seller@test', approvedAt: '2026-11-09T00:00:00.000Z', ...extra };
}

/** 가짜 PayPal 호출. 상태 코드를 바꿔 끼울 수 있다. */
function mockCaller(status = 200) {
  const requests: ApiRequest[] = [];
  const call = vi.fn(async (req: ApiRequest) => {
    requests.push(req);
    return { status, body: {} };
  });
  return { call, requests };
}

function input(overrides: Partial<ExecuteInput> = {}): ExecuteInput {
  return { board: BOARD, plan: OFFER_PLAN, messageTemplate: TEMPLATE, approval: approve(OFFER_PLAN), ...overrides };
}

describe('중복 승인', () => {
  it('같은 계획을 두 번 실행해도 PayPal 호출은 1회, 두 번째는 이전 결과를 돌려준다', async () => {
    const { call, requests } = mockCaller();
    const first = await executeMove(input(), { call });
    const second = await executeMove(input(), { call });

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(call).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
  });

  it('호출이 실패하면 기억하지 않는다 (다시 실행하면 다시 호출한다)', async () => {
    const plan: ActionPlan = { ...OFFER_PLAN, planId: 'unit-offer-retry' };
    const { call } = mockCaller(500);
    await executeMove(input({ plan, approval: approve(plan) }), { call });
    await executeMove(input({ plan, approval: approve(plan) }), { call });
    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe('provide_evidence', () => {
  it('거부하고 PayPal 화면에서 직접 증빙 제출을 안내한다 (호출 0회)', async () => {
    const plan: ActionPlan = {
      ...OFFER_PLAN,
      planId: 'unit-evidence',
      move: 'fight',
      apiMove: 'provide_evidence',
      amountCents: null,
      refundType: null,
      messageRequired: true,
    };
    const board: BoardState = { ...BOARD, allowedMoves: ['send_message', 'provide_evidence'] };
    const { call } = mockCaller();

    const result = await executeMove(
      { board, plan, messageTemplate: '{{disputeAmount}} 건 증빙을 보냅니다.', approval: approve(plan) },
      { call },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('provide_evidence');
    expect(result.nextAction).toContain('PayPal 화면에서 직접 증빙 제출');
    expect(call).not.toHaveBeenCalled();
  });
});

describe('2xx가 아닌 응답', () => {
  it('에러 문구에 단계(엔드포인트)와 상태 코드, nextAction에 사람이 할 일을 담는다', async () => {
    const plan: ActionPlan = { ...OFFER_PLAN, planId: 'unit-offer-422' };
    const { call } = mockCaller(422);
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('make-offer');
    expect(result.error).toContain('422');
    expect(result.nextAction).toContain('PayPal');
    expect(result.nextAction.length).toBeGreaterThan(0);
  });

  it('호출이 예외로 끝나도 예외를 던지지 않고 거부로 돌려준다', async () => {
    const plan: ActionPlan = { ...OFFER_PLAN, planId: 'unit-offer-throw' };
    const call = vi.fn(async () => {
      throw new Error('network down');
    });
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('make-offer');
  });
});

describe('요청 ID', () => {
  it('같은 계획을 다시 실행하면 같은 requestId가 나간다 (<planId>:<엔드포인트>)', async () => {
    const plan: ActionPlan = { ...OFFER_PLAN, planId: 'unit-offer-id' };
    const a = mockCaller();
    const b = mockCaller();

    await executeMove(input({ plan, approval: approve(plan) }), { call: a.call });
    await executeMove(input({ plan, approval: approve(plan) }), { call: b.call });

    expect(a.requests[0].requestId).toBe('unit-offer-id:make-offer');
    expect(b.requests[0].requestId).toBe(a.requests[0].requestId);
  });

  it('수마다 엔드포인트 이름이 붙는다', async () => {
    const plan: ActionPlan = {
      ...OFFER_PLAN,
      planId: 'unit-accept-id',
      move: 'refund',
      apiMove: 'accept_claim',
      amountCents: BOARD.amountCents,
    };
    const { call, requests } = mockCaller();
    await executeMove(
      { board: BOARD, plan, messageTemplate: '{{refundAmount}} 전액 환불', approval: approve(plan, { confirmAcceptClaim: true }) },
      { call },
    );
    expect(requests[0].requestId).toBe('unit-accept-id:accept-claim');
    expect(requests[0].path).toBe(`/v1/customer/disputes/${BOARD.disputeId}/accept-claim`);
  });
});

describe('금액 표기', () => {
  it.each([
    [5, '$0.05', '0.05'],
    [123456, '$1,234.56', '1234.56'],
    [4800, '$48.00', '48.00'],
    [720, '$7.20', '7.20'],
  ])('%i센트 → 메시지 %s / 본문 %s', (cents, display, apiValue) => {
    expect(centsToDisplay(cents)).toBe(display);
    expect(centsToApiValue(cents)).toBe(apiValue);
  });

  it.each([
    [5, '$0.05', '0.05'],
    [123456, '$1,234.56', '1234.56'],
    [4800, '$48.00', '48.00'],
  ])('실행할 때도 메시지 %s와 본문 %s가 같은 금액이다', async (cents, display, apiValue) => {
    const plan: ActionPlan = { ...OFFER_PLAN, planId: `unit-amount-${cents}`, amountCents: cents };
    const { call, requests } = mockCaller();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(true);
    expect(requests[0].body.note).toContain(display);
    expect(requests[0].body.offer_amount).toEqual({ currency_code: 'USD', value: apiValue });
  });

  it('{{disputeAmount}}는 분쟁 금액으로 채운다', async () => {
    const plan: ActionPlan = {
      ...OFFER_PLAN,
      planId: 'unit-message-dispute',
      move: 'fight',
      apiMove: 'send_message',
      amountCents: null,
      refundType: null,
      messageRequired: true,
    };
    const board: BoardState = { ...BOARD, amountCents: 123456 };
    const { call, requests } = mockCaller();
    const result = await executeMove(
      { board, plan, messageTemplate: '{{disputeAmount}} 결제 건입니다.', approval: approve(plan) },
      { call },
    );

    expect(result.ok).toBe(true);
    expect(requests[0].body.message).toBe('$1,234.56 결제 건입니다.');
  });
});

describe('그 밖의 거부 (호출 0회)', () => {
  it('허용되지 않은 수', async () => {
    const board: BoardState = { ...BOARD, allowedMoves: ['send_message'] };
    const { call } = mockCaller();
    const result = await executeMove(input({ board }), { call });
    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('계획의 분쟁과 보드의 분쟁이 다름', async () => {
    const plan: ActionPlan = { ...OFFER_PLAN, planId: 'unit-other-dispute', disputeId: 'PP-D-OTHER' };
    const { call } = mockCaller();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });
    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('제안 계획에 금액이 없음', async () => {
    const plan: ActionPlan = { ...OFFER_PLAN, planId: 'unit-no-amount', amountCents: null };
    const { call } = mockCaller();
    const result = await executeMove(input({ plan, approval: approve(plan), messageTemplate: '부분 환불해 드립니다.' }), { call });
    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('send_message인데 보낼 메시지가 비어 있음', async () => {
    const plan: ActionPlan = {
      ...OFFER_PLAN,
      planId: 'unit-empty-message',
      move: 'fight',
      apiMove: 'send_message',
      amountCents: null,
      refundType: null,
      messageRequired: true,
    };
    const { call } = mockCaller();
    const result = await executeMove({ board: BOARD, plan, messageTemplate: '   ', approval: approve(plan) }, { call });
    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('결과와 문구에 토큰·구매자 이메일을 넣지 않는다', async () => {
    const plan: ActionPlan = { ...OFFER_PLAN, planId: 'unit-no-secrets' };
    const { call } = mockCaller(401);
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = `${result.error} ${result.nextAction}`;
    expect(text).not.toMatch(/Bearer|@/);
  });
});
