/**
 * 단위 테스트: 승인된 수 실행 (T008 + 보강 T027, SPEC v2.1 9-1장)
 *
 * 실제 네트워크 호출은 없다. PayPal 호출은 `deps.call`에 가짜 함수를 넣어 확인한다.
 * 인수 테스트(tests/acceptance/ac11-12.exec.test.ts)가 보는 계약은 여기서 다시 검사하지 않고,
 * 지시서의 단위 테스트 항목만 본다:
 * T008 — 중복 승인, provide_evidence, 2xx 아님, requestId, 금액 표기.
 * T027 — 직접 쓴 금액의 경계(표), 남은 토큰, 빈 메시지, 검증 순서, 응답 상태, 영어 문구, 본문 키.
 */
import { describe, expect, it, vi } from 'vitest';

import { centsToApiValue, centsToDisplay } from '@/exec/amount';
import { EXEC_COPY } from '@/exec/copy';
import { executeMove } from '@/exec/execute';
import type { ActionPlan, ApiRequest, Approval, BoardState, ExecuteInput, PayPalCaller } from '@/types';

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

const MESSAGE_PLAN: ActionPlan = {
  ...OFFER_PLAN,
  planId: 'unit-message',
  move: 'fight',
  apiMove: 'send_message',
  amountCents: null,
  refundType: null,
  messageRequired: true,
};

const ACCEPT_PLAN: ActionPlan = {
  ...OFFER_PLAN,
  planId: 'unit-accept',
  move: 'refund',
  apiMove: 'accept_claim',
  amountCents: BOARD.amountCents,
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

/** 한 번 쓰고 버리는 계획 (중복 승인 기억이 테스트끼리 섞이지 않게) */
let planSeq = 0;
function freshPlan(base: ActionPlan = OFFER_PLAN, overrides: Partial<ActionPlan> = {}): ActionPlan {
  planSeq += 1;
  return { ...base, planId: `${base.planId}-${planSeq}`, ...overrides };
}

describe('중복 승인', () => {
  it('같은 계획을 두 번 실행해도 PayPal 호출은 1회, 두 번째는 이전 결과를 돌려준다', async () => {
    const { call, requests } = mockCaller();
    const plan = freshPlan();
    const first = await executeMove(input({ plan, approval: approve(plan) }), { call });
    const second = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(call).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
  });

  it('호출이 실패하면 기억하지 않는다 (다시 실행하면 다시 호출한다)', async () => {
    const plan = freshPlan(OFFER_PLAN, { planId: 'unit-offer-retry' });
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
    expect(result.nextAction).toBe(EXEC_COPY.nextEvidence);
    expect(result.nextAction).toContain('PayPal dispute screen');
    expect(call).not.toHaveBeenCalled();
  });
});

describe('2xx가 아닌 응답', () => {
  it('에러 문구에 단계(엔드포인트)와 상태 코드, nextAction에 사람이 할 일을 담는다', async () => {
    const plan = freshPlan(OFFER_PLAN, { planId: 'unit-offer-422' });
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
    const plan = freshPlan(OFFER_PLAN, { planId: 'unit-offer-throw' });
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
    const plan: ActionPlan = { ...ACCEPT_PLAN, planId: 'unit-accept-id' };
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
    const plan = freshPlan(OFFER_PLAN, { planId: `unit-amount-${cents}`, amountCents: cents });
    const { call, requests } = mockCaller();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(true);
    expect(requests[0].body.note).toContain(display);
    expect(requests[0].body.offer_amount).toEqual({ currency_code: 'USD', value: apiValue });
  });

  it('{{disputeAmount}}는 분쟁 금액으로 채운다', async () => {
    const plan = freshPlan(MESSAGE_PLAN, { planId: 'unit-message-dispute' });
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

// ───────────────────────── T027 보강 ─────────────────────────

describe('요청 본문 (T027 7)', () => {
  it.each<['REFUND' | 'REFUND_WITH_RETURN']>([['REFUND'], ['REFUND_WITH_RETURN']])(
    'make_offer: offer_type = plan.refundType (%s), 본문에 다른 키가 없다',
    async (refundType) => {
      const plan = freshPlan(OFFER_PLAN, { refundType });
      const { call, requests } = mockCaller();
      const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

      expect(result.ok).toBe(true);
      expect(requests[0].body).toEqual({
        note: '$7.20를 부분 환불해 드리고 싶습니다.',
        offer_amount: { currency_code: 'USD', value: '7.20' },
        offer_type: refundType,
      });
    },
  );

  it.each<['REFUND' | 'REFUND_WITH_RETURN']>([['REFUND'], ['REFUND_WITH_RETURN']])(
    'accept_claim: accept_claim_type = plan.refundType (%s), 본문에 다른 키가 없다',
    async (refundType) => {
      const plan = freshPlan(ACCEPT_PLAN, { refundType });
      const { call, requests } = mockCaller();
      const result = await executeMove(
        {
          board: BOARD,
          plan,
          messageTemplate: '{{refundAmount}} 전액을 환불해 드립니다.',
          approval: approve(plan, { confirmAcceptClaim: true }),
        },
        { call },
      );

      expect(result.ok).toBe(true);
      expect(requests[0].body).toEqual({
        note: '$48.00 전액을 환불해 드립니다.',
        accept_claim_type: refundType,
        refund_amount: { currency_code: 'USD', value: '48.00' },
      });
    },
  );

  it('send_message: 본문은 message 하나뿐', async () => {
    const plan = freshPlan(MESSAGE_PLAN);
    const { call, requests } = mockCaller();
    const result = await executeMove(
      { board: BOARD, plan, messageTemplate: '추적 정보를 보내 드립니다.', approval: approve(plan) },
      { call },
    );

    expect(result.ok).toBe(true);
    expect(requests[0].body).toEqual({ message: '추적 정보를 보내 드립니다.' });
  });
});

/**
 * 직접 쓴 금액의 경계 (T027 1).
 * 거부 쪽: 통화 기호·통화 코드·통화 이름이 붙은 수, 전각 표기, 통화 표기 없이 소수 둘째 자리까지 적힌 수.
 * 통과 쪽: 날짜, 긴 숫자열(주문·추적번호), 기간·비율·개수처럼 금액이 아닌 수.
 */
describe('직접 쓴 금액 거부 (T027 1)', () => {
  const REJECTED: [string, string][] = [
    ['$ 뒤 숫자', '상품은 그대로 두시고 $7.20를 환불해 드리겠습니다.'],
    ['$와 공백', '$ 7.20를 환불해 드리겠습니다.'],
    ['US$', 'US$7를 환불해 드리겠습니다.'],
    ['$와 줄바꿈', '환불 금액은 $\n7.20입니다.'],
    ['숫자 뒤 USD', '7.20 USD를 환불해 드리겠습니다.'],
    ['공백 없는 USD', '7.20USD를 환불해 드리겠습니다.'],
    ['소문자 usd', '5 usd를 환불해 드리겠습니다.'],
    ['USD가 앞', 'USD 7.20를 환불해 드리겠습니다.'],
    ['공백 없이 USD가 앞', 'USD7.20를 환불해 드리겠습니다.'],
    ['dollars', 'We can refund 7.20 dollars.'],
    ['정수 + dollars', 'We can refund 7 dollars.'],
    ['U.S. dollars', 'We can refund 7 U.S. dollars.'],
    ['cents', 'We can refund 20 cents.'],
    ['숫자 뒤 달러', '7.20달러를 환불해 드리겠습니다.'],
    ['정수 + 달러', '7달러를 환불해 드리겠습니다.'],
    ['달러 + 센트', '7달러 20센트를 환불해 드리겠습니다.'],
    ['전각 $ + 전각 숫자', '＄７을 환불해 드리겠습니다.'],
    ['반각 $ + 전각 숫자', '$７을 환불해 드리겠습니다.'],
    ['전각 숫자 + 달러', '７달러를 환불해 드리겠습니다.'],
    ['전각 소수 둘째 자리', '７．２０을 환불해 드리겠습니다.'],
    ['통화 기호 없는 소수 둘째 자리', '7.20을 환불해 드리겠습니다.'],
    ['원화 기호', '₩9,600을 환불해 드리겠습니다.'],
    ['전각 원화 기호', '￦9600을 환불해 드리겠습니다.'],
    ['유로 기호', '€7을 환불해 드리겠습니다.'],
    ['파운드 기호', '£7을 환불해 드리겠습니다.'],
    ['엔 기호', '¥700을 환불해 드리겠습니다.'],
    ['자리표시자와 섞임', '{{offerAmount}} 또는 $9.99를 환불해 드리겠습니다.'],
    // 과차단(안전한 쪽): 점으로 쓴 날짜 `11.12`는 금액 표기와 구별할 수 없어 거부한다
    ['점으로 쓴 날짜 (과차단)', '11.12까지 처리해 드립니다.'],
  ];

  it.each(REJECTED)('%s → 거부, 호출 0회', async (_name, messageTemplate) => {
    const { call } = mockCaller();
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan), messageTemplate }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('writes an amount directly');
    expect(result.nextAction).toBe(EXEC_COPY.nextFixDraft);
    expect(call).not.toHaveBeenCalled();
  });

  const ALLOWED: [string, string][] = [
    ['자리표시자만', '{{offerAmount}}를 부분 환불해 드리겠습니다.'],
    ['자리표시자 여러 번', '{{disputeAmount}} 중 {{offerAmount}}, 다시 {{offerAmount}}를 제안합니다.'],
    ['자리표시자 안 공백', '{{ offerAmount }}를 제안합니다.'],
    ['슬래시 날짜', '11/12까지 처리해 드립니다.'],
    ['ISO 날짜', '2026-11-12까지 처리해 드립니다.'],
    ['추적번호', '추적번호 1Z999AA10123456784로 등록했습니다.'],
    ['긴 숫자열', '주문번호 123456789012를 확인했습니다.'],
    ['영어 기간', 'We will ship within 3 weeks.'],
    ['한국어 기간', '3주 안에 배송됩니다.'],
    ['시간', '24시간 안에 답변드립니다.'],
    ['비율', '15% 할인 쿠폰을 보내 드립니다.'],
    ['개수', '주문 2건을 함께 보내 드립니다.'],
    ['소수 첫째 자리', '사이즈가 2.5 차이 납니다.'],
    ['소수 셋째 자리', '무게는 1.205 kg입니다.'],
  ];

  it.each(ALLOWED)('%s → 통과, 호출 1회', async (_name, messageTemplate) => {
    const { call, requests } = mockCaller();
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan), messageTemplate }), { call });

    expect(result.ok).toBe(true);
    expect(requests).toHaveLength(1);
  });

  it('모르는 자리표시자는 거부하고 이름을 문구에 되울리지 않는다', async () => {
    const { call } = mockCaller();
    const plan = freshPlan();
    const result = await executeMove(
      input({ plan, approval: approve(plan), messageTemplate: '{{buyer@example.com}}님께 {{discount}}를 드립니다.' }),
      { call },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(EXEC_COPY.unknownPlaceholder);
    expect(`${result.error} ${result.nextAction}`).not.toMatch(/buyer|discount|@/);
    expect(call).not.toHaveBeenCalled();
  });

  it('금액이 없는 계획의 금액 자리표시자는 거부한다', async () => {
    const { call } = mockCaller();
    const plan = freshPlan(MESSAGE_PLAN);
    const result = await executeMove(
      { board: BOARD, plan, messageTemplate: '{{offerAmount}}를 제안합니다.', approval: approve(plan) },
      { call },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(EXEC_COPY.placeholderWithoutAmount);
    expect(call).not.toHaveBeenCalled();
  });
});

describe('남은 토큰 거부 (T027 2)', () => {
  const LEFTOVER: [string, string][] = [
    ['사실값 토큰 ⟦…⟧', '⟦AMOUNT_1⟧을 ⟦DATE_1⟧까지 환불해 드립니다.'],
    ['사실값 토큰 하나', '⟦DATE_1⟧까지 처리해 드립니다.'],
    ['닫히지 않은 ⟦', '⟦DATE_1까지 처리해 드립니다.'],
    ['닫히지 않은 {{', '{{offerAmount를 제안합니다.'],
    ['짝 없는 }}', 'offerAmount}}를 제안합니다.'],
  ];

  it.each(LEFTOVER)('%s → 거부, 호출 0회, 초안을 다시 만들라고 안내', async (_name, messageTemplate) => {
    const { call } = mockCaller();
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan), messageTemplate }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(EXEC_COPY.tokensRemaining);
    expect(result.nextAction).toBe(EXEC_COPY.nextRegenerateDraft);
    expect(call).not.toHaveBeenCalled();
  });

  it('⟦…⟧는 이 층에서 채우지 않는다 (채워진 자리표시자와 섞여 있어도 거부)', async () => {
    const { call } = mockCaller();
    const plan = freshPlan();
    const result = await executeMove(
      input({ plan, approval: approve(plan), messageTemplate: '{{offerAmount}}를 ⟦DATE_1⟧까지 환불합니다.' }),
      { call },
    );

    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });
});

describe('빈 메시지 거부 (T027 3)', () => {
  const EMPTY: [string, string][] = [
    ['빈 문자열', ''],
    ['공백만', '   '],
    ['줄바꿈·탭만', '\n\t '],
  ];

  it.each(EMPTY)('make_offer: %s → 거부, 호출 0회', async (_name, messageTemplate) => {
    const { call } = mockCaller();
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan), messageTemplate }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(EXEC_COPY.messageEmpty);
    expect(call).not.toHaveBeenCalled();
  });

  it.each(EMPTY)('send_message: %s → 거부, 호출 0회', async (_name, messageTemplate) => {
    const { call } = mockCaller();
    const plan = freshPlan(MESSAGE_PLAN);
    const result = await executeMove({ board: BOARD, plan, messageTemplate, approval: approve(plan) }, { call });

    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it.each(EMPTY)('accept_claim: %s → 거부, 호출 0회', async (_name, messageTemplate) => {
    const { call } = mockCaller();
    const plan = freshPlan(ACCEPT_PLAN);
    const result = await executeMove(
      { board: BOARD, plan, messageTemplate, approval: approve(plan, { confirmAcceptClaim: true }) },
      { call },
    );

    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });
});

describe('검증 순서 (T027 4)', () => {
  /** 한 번 성공시킨 뒤, 같은 `call`·같은 `planId`로 거부 대상 입력을 보낸다 */
  async function succeedThen(overrides: Partial<ExecuteInput>) {
    const { call } = mockCaller();
    const plan = freshPlan();
    const first = await executeMove(input({ plan, approval: approve(plan) }), { call });
    expect(first.ok).toBe(true);

    const second = await executeMove(input({ plan, approval: approve(plan), ...overrides }), { call });
    return { second, call };
  }

  it('승인이 없어지면 이전 성공 결과를 돌려주지 않는다', async () => {
    const { second, call } = await succeedThen({ approval: null });
    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('이번 초안에 금액을 직접 썼으면 거부한다', async () => {
    const { second, call } = await succeedThen({ messageTemplate: '$9.99를 환불해 드리겠습니다.' });
    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('이번 초안에 토큰이 남아 있으면 거부한다', async () => {
    const { second, call } = await succeedThen({ messageTemplate: '⟦AMOUNT_1⟧을 환불해 드립니다.' });
    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('이번에 허용되지 않는 수가 되었으면 거부한다', async () => {
    const { second, call } = await succeedThen({ board: { ...BOARD, allowedMoves: ['send_message'] } });
    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('accept_claim: 성공 뒤 확인란 없이 다시 실행하면 거부한다', async () => {
    const { call } = mockCaller();
    const plan = freshPlan(ACCEPT_PLAN);
    const template = '{{refundAmount}} 전액을 환불해 드립니다.';
    const first = await executeMove(
      { board: BOARD, plan, messageTemplate: template, approval: approve(plan, { confirmAcceptClaim: true }) },
      { call },
    );
    const second = await executeMove(
      { board: BOARD, plan, messageTemplate: template, approval: approve(plan) },
      { call },
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe(EXEC_COPY.acceptClaimUnconfirmed);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('이번 입력도 통과하면 이전 성공 결과를 돌려준다 (호출 1회)', async () => {
    const { call } = mockCaller();
    const plan = freshPlan();
    const first = await executeMove(input({ plan, approval: approve(plan) }), { call });
    const second = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(second).toEqual(first);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe('응답 상태 (T027 5)', () => {
  it.each([[200], [201], [202], [204], [299]])('%i → 성공', async (status) => {
    const { call } = mockCaller(status);
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sent).toEqual([{ path: `/v1/customer/disputes/${BOARD.disputeId}/make-offer`, status }]);
  });

  it.each([[199], [300], [302], [400], [500]])('%i → 실패, 기억하지 않는다', async (status) => {
    const { call } = mockCaller(status);
    const plan = freshPlan();
    const first = await executeMove(input({ plan, approval: approve(plan) }), { call });
    const second = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(first.ok).toBe(false);
    if (first.ok) return;
    expect(first.error).toContain(String(status));
    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(2);
  });

  /** 계약(`PayPalCaller`)을 지키지 않는 응답. 성공으로 보지 않는다 */
  const BAD_STATUS: [string, unknown][] = [
    ['status 없음', { body: {} }],
    ['status가 문자열', { status: '200', body: {} }],
    ['status가 NaN', { status: Number.NaN, body: {} }],
    ['status가 null', { status: null, body: {} }],
    ['status가 소수', { status: 200.5, body: {} }],
    ['응답이 null', null],
    ['응답이 undefined', undefined],
  ];

  it.each(BAD_STATUS)('%s → 실패, 기억하지 않는다', async (_name, response) => {
    const call = vi.fn(async () => response) as unknown as PayPalCaller;
    const plan = freshPlan();
    const first = await executeMove(input({ plan, approval: approve(plan) }), { call });
    const second = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('status가 없으면 상태 코드 대신 "읽을 수 없는 응답"으로 알린다', async () => {
    const call = vi.fn(async () => ({ body: {} })) as unknown as PayPalCaller;
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('make-offer');
    expect(result.error).toContain('without a usable status code');
    expect(result.error).not.toMatch(/undefined|NaN/);
  });
});

describe('문구 (T027 6)', () => {
  /** 한글 음절·자모가 하나라도 있으면 판매자 화면(영어)에 그대로 쓸 수 없다 */
  const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;

  const REJECTIONS: [string, Partial<ExecuteInput>][] = [
    ['승인 없음', { approval: null }],
    ['다른 계획 승인', { approval: approve({ ...OFFER_PLAN, planId: 'unit-other-plan' }) }],
    ['분쟁 불일치', { plan: { ...OFFER_PLAN, disputeId: 'PP-D-OTHER' } }],
    ['허용되지 않은 수', { board: { ...BOARD, allowedMoves: ['send_message'] } }],
    ['허용 목록이 빔', { board: { ...BOARD, allowedMoves: [] } }],
    ['금액이 센트 정수가 아님', { plan: { ...OFFER_PLAN, amountCents: 7.5 } }],
    ['직접 쓴 금액', { messageTemplate: '$9.99를 환불합니다.' }],
    ['모르는 자리표시자', { messageTemplate: '{{discount}}를 드립니다.' }],
    ['남은 토큰', { messageTemplate: '⟦DATE_1⟧까지' }],
    ['빈 메시지', { messageTemplate: '  ' }],
    ['환불 유형 없음', { plan: { ...OFFER_PLAN, refundType: null } }],
  ];

  it.each(REJECTIONS)('%s: error·nextAction에 한글이 없다', async (_name, overrides) => {
    const { call } = mockCaller();
    const plan = overrides.plan ?? freshPlan();
    const result = await executeMove(
      input({ plan, approval: approve(plan), ...overrides }),
      { call },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toMatch(HANGUL);
    expect(result.nextAction).not.toMatch(HANGUL);
    expect(result.error.length).toBeGreaterThan(0);
    expect(result.nextAction.length).toBeGreaterThan(0);
  });

  it('accept_claim 확인란 없음: 영어 문구', async () => {
    const { call } = mockCaller();
    const plan = freshPlan(ACCEPT_PLAN);
    const result = await executeMove(
      { board: BOARD, plan, messageTemplate: '{{refundAmount}} 환불', approval: approve(plan) },
      { call },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toMatch(HANGUL);
    expect(result.nextAction).not.toMatch(HANGUL);
  });

  it.each([[422], [500]])('%i 실패 문구에 한글이 없다', async (status) => {
    const { call } = mockCaller(status);
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toMatch(HANGUL);
    expect(result.nextAction).not.toMatch(HANGUL);
  });

  it('예외 경로 문구에 한글이 없다', async () => {
    const call = vi.fn(async () => {
      throw new Error('network down');
    });
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toMatch(HANGUL);
    expect(result.nextAction).not.toMatch(HANGUL);
  });

  it('문구에 채우지 않은 자리표시자가 남지 않는다', async () => {
    const { call } = mockCaller(422);
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(`${result.error} ${result.nextAction}`).not.toMatch(/\{\{|\}\}/);
  });
});

describe('그 밖의 거부 (호출 0회)', () => {
  it('허용되지 않은 수', async () => {
    const board: BoardState = { ...BOARD, allowedMoves: ['send_message'] };
    const { call } = mockCaller();
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan), board }), { call });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('make_offer');
    expect(result.error).toContain('send_message');
    expect(call).not.toHaveBeenCalled();
  });

  it('계획의 분쟁과 보드의 분쟁이 다름', async () => {
    const plan = freshPlan(OFFER_PLAN, { disputeId: 'PP-D-OTHER' });
    const { call } = mockCaller();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });
    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('제안 계획에 금액이 없음', async () => {
    const plan = freshPlan(OFFER_PLAN, { amountCents: null });
    const { call } = mockCaller();
    const result = await executeMove(
      input({ plan, approval: approve(plan), messageTemplate: '부분 환불해 드립니다.' }),
      { call },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('make_offer');
    expect(call).not.toHaveBeenCalled();
  });

  it('제안 계획에 환불 유형이 없음', async () => {
    const plan = freshPlan(OFFER_PLAN, { refundType: null });
    const { call } = mockCaller();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('refundType');
    expect(call).not.toHaveBeenCalled();
  });

  it.each([[7.5], [Number.NaN], [Number.POSITIVE_INFINITY]])('금액이 센트 정수가 아님 (%s)', async (amountCents) => {
    const plan = freshPlan(OFFER_PLAN, { amountCents });
    const { call } = mockCaller();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(EXEC_COPY.amountNotInteger);
    expect(call).not.toHaveBeenCalled();
  });

  it('분쟁 금액이 센트 정수가 아님', async () => {
    const { call } = mockCaller();
    const plan = freshPlan();
    const result = await executeMove(
      input({ plan, approval: approve(plan), board: { ...BOARD, amountCents: 48.5 } }),
      { call },
    );
    expect(result.ok).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('승인 플래그가 true가 아닌 값이면 accept_claim을 실행하지 않는다', async () => {
    const { call } = mockCaller();
    const plan = freshPlan(ACCEPT_PLAN);
    for (const confirmAcceptClaim of [false, undefined] as const) {
      const result = await executeMove(
        {
          board: BOARD,
          plan,
          messageTemplate: '{{refundAmount}} 환불',
          approval: approve(plan, { confirmAcceptClaim }),
        },
        { call },
      );
      expect(result.ok).toBe(false);
    }
    expect(call).not.toHaveBeenCalled();
  });

  it('결과와 문구에 응답 본문·토큰·구매자 이메일을 넣지 않는다', async () => {
    const leaky = {
      status: 401,
      body: {
        access_token: 'A21AA-secret-token',
        name: 'AUTHENTICATION_FAILURE',
        debug_id: 'debug-9f8e7d6c',
        buyer_email: 'seoyeon@example.com',
        message: 'Bearer A21AA-secret-token rejected',
      },
    };
    const call = vi.fn(async () => leaky);
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = `${result.error} ${result.nextAction}`;
    expect(text).not.toMatch(/Bearer|@|A21AA|debug|AUTHENTICATION|seoyeon/);
    expect(text).toContain('401');
  });

  it('예외 메시지에 비밀값이 있어도 문구에 싣지 않는다', async () => {
    const call = vi.fn(async () => {
      throw new Error('Bearer A21AA-secret-token failed for seoyeon@example.com');
    });
    const plan = freshPlan();
    const result = await executeMove(input({ plan, approval: approve(plan) }), { call });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const text = `${result.error} ${result.nextAction}`;
    expect(text).not.toMatch(/Bearer|@|A21AA|seoyeon/);
  });
});
