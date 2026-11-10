/**
 * 단위 테스트: 중복 방지 기억의 키 — T049, SPEC v2.5 9-1장
 *
 * `executeMove`는 같은 `call`로 이미 성공한 요청을 다시 실행하면 호출 없이 이전 결과를 돌려준다.
 * 그 기억의 키는 **요청 번호**(= hash(계획 ID + 엔드포인트 + 보내는 본문))다.
 * 계획 ID만으로 기억하면 같은 분쟁에 보내는 두 번째 **다른 메시지**가 호출 없이 삼켜진다.
 *
 * 실제 PayPal 호출은 없다 (`deps.call`에 가짜 함수를 넣는다. `.env`를 읽지 않는다).
 */
import { describe, expect, it, vi } from 'vitest';

import { executeMove } from '@/exec/execute';
import type { ActionPlan, ApiRequest, Approval, BoardState, ExecuteInput, PayPalCaller } from '@/types';

const BOARD: BoardState = {
  disputeId: 'PP-D-DEDUPE-1',
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

/** `send_message` 계획은 분쟁마다 하나다 (메시지 내용이 계획 ID에 들어가지 않는다). */
const MESSAGE_PLAN: ActionPlan = {
  planId: 'dedupe-message',
  disputeId: BOARD.disputeId,
  move: 'fight',
  apiMove: 'send_message',
  amountCents: null,
  currency: 'USD',
  refundType: null,
  messageRequired: true,
  requiresApproval: true,
};

const OFFER_PLAN: ActionPlan = {
  ...MESSAGE_PLAN,
  planId: 'dedupe-offer',
  move: 'offer',
  apiMove: 'make_offer',
  amountCents: 720,
  refundType: 'REFUND',
  messageRequired: false,
};

const MESSAGE_A = 'Could you share a photo of the item you received?';
const MESSAGE_B = 'Thanks for the photo. We are checking with the warehouse today.';

function approve(plan: ActionPlan, extra: Partial<Approval> = {}): Approval {
  return { planId: plan.planId, approvedBy: 'seller@test', approvedAt: '2026-11-10T00:00:00.000Z', ...extra };
}

/** 가짜 PayPal 호출. 보낸 요청을 모아 두고, 상태 코드·예외를 바꿔 끼울 수 있다. */
function mockCaller(responses: (number | 'throw')[] = []) {
  const requests: ApiRequest[] = [];
  let seq = 0;
  const call = vi.fn(async (req: ApiRequest) => {
    requests.push(req);
    const next = responses[seq] ?? responses[responses.length - 1] ?? 200;
    seq += 1;
    if (next === 'throw') throw new Error('network down');
    return { status: next, body: {} };
  });
  return { call: call as PayPalCaller & typeof call, requests };
}

function run(plan: ActionPlan, messageTemplate: string, call: PayPalCaller, extra: Partial<ExecuteInput> = {}) {
  return executeMove({ board: BOARD, plan, messageTemplate, approval: approve(plan), ...extra }, { call });
}

describe('send_message: 같은 계획, 다른 메시지 (T049 본문)', () => {
  it('메시지 A → 메시지 B: 호출 2회, 요청 번호가 다르고 둘 다 성공이다', async () => {
    const { call, requests } = mockCaller();

    const first = await run(MESSAGE_PLAN, MESSAGE_A, call);
    const second = await run(MESSAGE_PLAN, MESSAGE_B, call);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(call).toHaveBeenCalledTimes(2);
    expect(requests).toHaveLength(2);
    expect(requests[0].requestId).not.toBe(requests[1].requestId);
    expect(requests[0].body).toEqual({ message: MESSAGE_A });
    expect(requests[1].body).toEqual({ message: MESSAGE_B });
  });

  it('한 글자(마지막 물음표)만 달라도 두 번째 메시지가 실제로 나간다', async () => {
    const { call, requests } = mockCaller();

    await run(MESSAGE_PLAN, MESSAGE_A, call);
    await run(MESSAGE_PLAN, MESSAGE_A.replace(/\?$/, '.'), call);

    expect(call).toHaveBeenCalledTimes(2);
    expect(requests[0].requestId).not.toBe(requests[1].requestId);
  });

  it('A → B → A: 세 번째는 A의 기억에 걸려 호출이 나가지 않는다 (호출 2회)', async () => {
    const { call, requests } = mockCaller();

    const first = await run(MESSAGE_PLAN, MESSAGE_A, call);
    await run(MESSAGE_PLAN, MESSAGE_B, call);
    const third = await run(MESSAGE_PLAN, MESSAGE_A, call);

    expect(call).toHaveBeenCalledTimes(2);
    expect(requests).toHaveLength(2);
    expect(third).toEqual(first);
  });

  it('메시지 A를 두 번: 호출 1회, 두 결과가 같다', async () => {
    const { call, requests } = mockCaller();

    const first = await run(MESSAGE_PLAN, MESSAGE_A, call);
    const second = await run(MESSAGE_PLAN, MESSAGE_A, call);

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(call).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
  });
});

describe('make_offer: 금액과 메모', () => {
  const NOTE = 'We can refund part of your order: {{offerAmount}}.';

  it('같은 금액·같은 메모 두 번: 호출 1회', async () => {
    const { call, requests } = mockCaller();

    const first = await run(OFFER_PLAN, NOTE, call);
    const second = await run(OFFER_PLAN, NOTE, call);

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(call).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
  });

  it('금액은 같고 메모만 다르면: 호출 2회', async () => {
    const { call, requests } = mockCaller();

    await run(OFFER_PLAN, NOTE, call);
    await run(OFFER_PLAN, `${NOTE} Sorry again for the trouble.`, call);

    expect(call).toHaveBeenCalledTimes(2);
    expect(requests[0].requestId).not.toBe(requests[1].requestId);
    expect(requests[0].body).not.toEqual(requests[1].body);
  });

  it('메모는 같고 금액만 다르면: 호출 2회', async () => {
    const { call, requests } = mockCaller();

    await run(OFFER_PLAN, NOTE, call);
    await run({ ...OFFER_PLAN, amountCents: 1200 }, NOTE, call);

    expect(call).toHaveBeenCalledTimes(2);
    expect(requests[0].requestId).not.toBe(requests[1].requestId);
  });

  it('환불 유형만 다르면: 호출 2회', async () => {
    const { call, requests } = mockCaller();

    await run(OFFER_PLAN, NOTE, call);
    await run({ ...OFFER_PLAN, refundType: 'REFUND_WITH_RETURN' }, NOTE, call);

    expect(call).toHaveBeenCalledTimes(2);
    expect(requests[0].requestId).not.toBe(requests[1].requestId);
  });
});

describe('실패는 기억하지 않는다', () => {
  it('500 뒤 같은 입력으로 다시 실행하면 호출이 다시 나간다', async () => {
    const { call, requests } = mockCaller([500, 200]);

    const first = await run(MESSAGE_PLAN, MESSAGE_A, call);
    const second = await run(MESSAGE_PLAN, MESSAGE_A, call);

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(call).toHaveBeenCalledTimes(2);
    expect(requests[0].requestId).toBe(requests[1].requestId);
  });

  it('예외 뒤 같은 입력으로 다시 실행하면 호출이 다시 나간다', async () => {
    const { call } = mockCaller(['throw', 200]);

    const first = await run(MESSAGE_PLAN, MESSAGE_A, call);
    const second = await run(MESSAGE_PLAN, MESSAGE_A, call);

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(true);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('성공한 뒤에는 같은 입력으로 더 실행해도 호출이 늘지 않는다', async () => {
    const { call } = mockCaller([500, 200]);

    await run(MESSAGE_PLAN, MESSAGE_A, call);
    await run(MESSAGE_PLAN, MESSAGE_A, call);
    await run(MESSAGE_PLAN, MESSAGE_A, call);

    expect(call).toHaveBeenCalledTimes(2);
  });
});

describe('기억의 범위', () => {
  it('서로 다른 `call` 사이에는 기억이 섞이지 않는다', async () => {
    const a = mockCaller();
    const b = mockCaller();

    await run(MESSAGE_PLAN, MESSAGE_A, a.call);
    await run(MESSAGE_PLAN, MESSAGE_A, b.call);

    expect(a.call).toHaveBeenCalledTimes(1);
    expect(b.call).toHaveBeenCalledTimes(1);
    // 같은 계획·같은 본문이므로 두 요청 번호는 같다 (PayPal이 서버에서 한 번만 처리한다).
    expect(b.requests[0].requestId).toBe(a.requests[0].requestId);
  });

  it('다른 분쟁의 같은 메시지는 따로 기억한다 (호출 2회)', async () => {
    const { call, requests } = mockCaller();
    const other: BoardState = { ...BOARD, disputeId: 'PP-D-DEDUPE-2' };
    const otherPlan: ActionPlan = { ...MESSAGE_PLAN, planId: 'dedupe-message-2', disputeId: other.disputeId };

    await run(MESSAGE_PLAN, MESSAGE_A, call);
    await run(otherPlan, MESSAGE_A, call, { board: other });

    expect(call).toHaveBeenCalledTimes(2);
    expect(requests[0].requestId).not.toBe(requests[1].requestId);
  });
});

describe('거부 검사는 기억보다 먼저다 (지금 동작 유지)', () => {
  it('성공한 요청이어도 승인이 없으면 거부한다 (호출 0회 추가)', async () => {
    const { call } = mockCaller();

    const first = await run(MESSAGE_PLAN, MESSAGE_A, call);
    const second = await run(MESSAGE_PLAN, MESSAGE_A, call, { approval: null });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('성공한 요청이어도 이번에 허용되지 않는 수면 거부한다', async () => {
    const { call } = mockCaller();

    await run(MESSAGE_PLAN, MESSAGE_A, call);
    const second = await run(MESSAGE_PLAN, MESSAGE_A, call, { board: { ...BOARD, allowedMoves: ['make_offer'] } });

    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('성공한 요청이어도 계획과 보드의 분쟁이 다르면 거부한다', async () => {
    const { call } = mockCaller();

    await run(MESSAGE_PLAN, MESSAGE_A, call);
    const second = await run(MESSAGE_PLAN, MESSAGE_A, call, { board: { ...BOARD, disputeId: 'PP-D-DEDUPE-9' } });

    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
