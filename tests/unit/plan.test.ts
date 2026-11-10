/**
 * 단위 테스트: planMove (SPEC v2.1 5장 "수 → API", 6장 제안률, 9-1장). 작업 T005.
 * 인수 테스트(AC4, AC10)가 보는 D1 제안·환불 말고, 수 3종의 계획 필드·예외·planId·불변을 본다.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { paramsFromConfig, rulesFromConfig } from '@/engine/params';
import { planMove } from '@/engine/plan';
import { BLOCKED } from '@/engine/policy';
import { recommend } from '@/engine/recommend';
import type { BoardState, Evaluation, Params, PolicyConfig } from '@/types';

const P: Params = paramsFromConfig();
const R: PolicyConfig = rulesFromConfig();

function board(over: Partial<BoardState> = {}): BoardState {
  return {
    disputeId: 'U-1',
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
    isDemo: false,
    cause: { subtype: 'B1', confidence: 0.9, evidence: ['color'], needsReview: false, source: 'llm' },
    ...over,
  };
}

/** 보드의 수 하나를 평가로 꺼낸다 (`recommend`가 만든 값만 쓴다). */
function evaluationFor(b: BoardState, move: Evaluation['move'], params: Params = P): Evaluation {
  const found = recommend(b, params, R).all.find((e) => e.move === move);
  if (!found) throw new Error(`${move} 평가가 없음`);
  return found;
}

describe('수별 계획 (SPEC 5장 표)', () => {
  it('offer → make_offer, x·A, REFUND, 메시지 불필요', () => {
    const b = board();
    const plan = planMove(b, evaluationFor(b, 'offer'), P, R);
    expect(plan.move).toBe('offer');
    expect(plan.apiMove).toBe('make_offer');
    expect(plan.amountCents).toBe(720); // 4800 × 0.15
    expect(plan.refundType).toBe('REFUND');
    expect(plan.messageRequired).toBe(false);
    expect(plan.disputeId).toBe(b.disputeId);
    expect(plan.currency).toBe('USD');
    expect(plan.requiresApproval).toBe(true);
  });

  it('refund → accept_claim, 분쟁 금액 A (기대 손실 A + t가 아니다), REFUND', () => {
    const b = board();
    const plan = planMove(b, evaluationFor(b, 'refund'), P, R);
    expect(plan.apiMove).toBe('accept_claim');
    expect(plan.amountCents).toBe(4800);
    expect(evaluationFor(b, 'refund').expectedLossCents).toBe(4800 + P.timeCostCents);
    expect(plan.refundType).toBe('REFUND');
    expect(plan.messageRequired).toBe(false);
  });

  it('fight → 평가의 실행 API, 금액 없음, 환불 종류 없음, 메시지 필요', () => {
    const b = board();
    const plan = planMove(b, evaluationFor(b, 'fight'), P, R);
    expect(plan.apiMove).toBe('send_message');
    expect(plan.amountCents).toBeNull();
    expect(plan.refundType).toBeNull();
    expect(plan.messageRequired).toBe(true);
  });

  // 합의 단계(INQUIRY)에서는 두 링크가 함께 와도 send_message가 먼저다 (v2.4, Q15). 그래서
  // provide_evidence 계획을 보려면 합의 단계가 아닌 보드를 쓴다.
  it('합의 단계가 아니고 증빙 링크가 있으면 fight는 provide_evidence로 계획한다', () => {
    const b = board({ stage: 'CHARGEBACK', allowedMoves: ['provide_evidence', 'send_message'] });
    expect(planMove(b, evaluationFor(b, 'fight'), P, R).apiMove).toBe('provide_evidence');
  });

  it('합의 단계에 두 링크가 함께 있으면 fight는 send_message로 계획한다 (v2.4, Q15)', () => {
    const b = board({ allowedMoves: ['provide_evidence', 'send_message'] });
    expect(b.stage).toBe('INQUIRY');
    expect(planMove(b, evaluationFor(b, 'fight'), P, R).apiMove).toBe('send_message');
  });
});

describe('제안 금액은 기대 손실과 같은 함수에서 나온다', () => {
  it('x·A가 정수 센트가 아닌 금액(1050¢ × 0.15 = 157.5)도 트리의 수락 분기와 같다', () => {
    const b = board({ amountCents: 1050 });
    const offer = evaluationFor(b, 'offer');
    const plan = planMove(b, offer, P, R);
    const accept = offer.branches.find((br) => br.label === 'accept')!;
    expect(plan.amountCents).toBe(158);
    expect(plan.amountCents).toBe(accept.lossCents - P.timeCostCents);
  });

  it('가정값 x를 바꾸면 계획 금액도 같이 바뀐다', () => {
    const b = board();
    const params: Params = { ...P, offerRate: 0.1 };
    expect(planMove(b, evaluationFor(b, 'offer', params), params, R).amountCents).toBe(480);
  });
});

describe('계획을 만들 수 없는 평가는 예외', () => {
  it('차단된 평가(OFFER_SCOPE)면 예외', () => {
    const b = board({ cause: { subtype: 'A1', confidence: 0.9, evidence: [], needsReview: false, source: 'llm' } });
    const offer = evaluationFor(b, 'offer');
    expect(offer.blockedBy).toBe(BLOCKED.offerScope);
    expect(() => planMove(b, offer, P, R)).toThrow(/OFFER_SCOPE/);
  });

  it('원인이 없어 차단된 평가(NO_CAUSE)면 예외', () => {
    const b = board({ cause: undefined });
    expect(() => planMove(b, evaluationFor(b, 'refund'), P, R)).toThrow(/NO_CAUSE/);
  });

  it('apiMove가 null이면 예외', () => {
    const b = board();
    const evaluation: Evaluation = { ...evaluationFor(b, 'refund'), apiMove: null };
    expect(() => planMove(b, evaluation, P, R)).toThrow(/apiMove/);
  });

  it('수와 실행 API가 어긋나면 예외 (offer를 send_message로)', () => {
    const b = board();
    const evaluation: Evaluation = { ...evaluationFor(b, 'offer'), apiMove: 'send_message' };
    expect(() => planMove(b, evaluation, P, R)).toThrow(/send_message/);
  });

  it('평가 모양이 깨져 있으면 ZodError', () => {
    const b = board();
    const bad = { ...evaluationFor(b, 'offer'), move: 'settle' };
    expect(() => planMove(b, bad as unknown as Evaluation, P, R)).toThrow(ZodError);
  });
});

describe('평가가 이 보드의 것인지 확인한다 (T018)', () => {
  /** 보드와 상관없이 손으로 만든 "정상" offer 평가 (화면이 직접 만들어 넘기는 경우) */
  const handMadeOffer: Evaluation = {
    move: 'offer',
    apiMove: 'make_offer',
    expectedLossCents: 1953,
    branches: [],
  };

  it('제안 대상이 아닌 유형(A1)에 다른 보드의 offer 평가를 넘기면 예외', () => {
    const a1 = board({ cause: { subtype: 'A1', confidence: 0.9, evidence: [], needsReview: false, source: 'llm' } });
    const fromB1 = evaluationFor(board(), 'offer');
    expect(() => planMove(a1, fromB1, P, R)).toThrow(/OFFER_SCOPE/);
    expect(() => planMove(a1, handMadeOffer, P, R)).toThrow(/보드의 것이 아님/);
  });

  it('원인이 없는 보드에 손으로 만든 평가를 넘기면 예외 (NO_CAUSE)', () => {
    const noCause = board({ cause: undefined });
    expect(() => planMove(noCause, handMadeOffer, P, R)).toThrow(/NO_CAUSE/);
  });

  it('allowedMoves에 없는 수의 평가를 넘기면 예외', () => {
    const noOffer = board({ allowedMoves: ['send_message', 'accept_claim'] });
    expect(() => planMove(noOffer, handMadeOffer, P, R)).toThrow(/보드의 것이 아님/);
    const none = board({ allowedMoves: [] });
    expect(() => planMove(none, evaluationFor(board(), 'refund'), P, R)).toThrow(/보드의 것이 아님/);
  });

  it('이 보드의 실행 API와 다른 평가를 넘기면 예외 (provide_evidence vs send_message)', () => {
    // 합의 단계가 아닌 보드여야 fight가 provide_evidence로 잡힌다 (v2.4, Q15).
    const evidence = board({ stage: 'CHARGEBACK', allowedMoves: ['provide_evidence', 'send_message'] });
    const fight = evaluationFor(evidence, 'fight');
    expect(fight.apiMove).toBe('provide_evidence');
    expect(() => planMove(board(), fight, P, R)).toThrow(/send_message/);
  });

  it('같은 보드에서 recommend가 만든 평가는 그대로 계획이 된다', () => {
    const b = board();
    for (const move of ['fight', 'offer', 'refund'] as const) {
      expect(() => planMove(b, evaluationFor(b, move), P, R)).not.toThrow();
    }
  });

  it('기대 손실이 없는 평가(expectedLossCents: null)는 blockedBy가 없어도 예외 (T018 검증 1)', () => {
    const b = board();
    const noLoss: Evaluation = { ...handMadeOffer, expectedLossCents: null };
    expect(noLoss.blockedBy).toBeUndefined();
    expect(() => planMove(b, noLoss, P, R)).toThrow(/expectedLossCents: null/);
    // 수가 바뀌어도 같다 (refund·fight도 계획이 나오지 않는다)
    expect(() => planMove(b, { ...evaluationFor(b, 'refund'), expectedLossCents: null }, P, R)).toThrow(/기대 손실/);
    expect(() => planMove(b, { ...evaluationFor(b, 'fight'), expectedLossCents: null }, P, R)).toThrow(/기대 손실/);
  });

  it('기대 손실이 0인 평가는 막지 않는다 (null만 막는다)', () => {
    const b = board();
    const zeroLoss: Evaluation = { ...evaluationFor(b, 'refund'), expectedLossCents: 0 };
    expect(planMove(b, zeroLoss, P, R).amountCents).toBe(4800);
  });

  it('가정값만 다른 평가(낡은 평가)는 막지 않는다 — 금액은 지금 가정값 기준 (AC4)', () => {
    const b = board();
    const atPolicyRate = evaluationFor(b, 'offer');
    const raised: Params = { ...P, offerRate: 0.2 };
    // 기대 손실은 가정값에 따라 달라지지만(1953 ≠ 2126), 계획 금액은 지금 가정값으로 다시 계산한다.
    expect(atPolicyRate.expectedLossCents).not.toBe(evaluationFor(b, 'offer', raised).expectedLossCents);
    expect(planMove(b, atPolicyRate, raised, R).amountCents).toBe(960);
  });
});

describe('0¢ 제안 계획은 만들지 않는다 (T018)', () => {
  it('제안률이 0이면 예외', () => {
    const b = board();
    const params: Params = { ...P, offerRate: 0 };
    expect(() => planMove(b, evaluationFor(b, 'offer', params), params, R)).toThrow(/0¢/);
  });

  it('분쟁 금액이 너무 작아 x·A가 0¢로 사사오입되면 예외', () => {
    const tiny = board({ amountCents: 3 }); // 3 × 0.15 = 0.45¢ → 0¢
    expect(() => planMove(tiny, evaluationFor(tiny, 'offer'), P, R)).toThrow(/0¢/);
    const justEnough = board({ amountCents: 4 }); // 0.6¢ → 1¢
    expect(planMove(justEnough, evaluationFor(justEnough, 'offer'), P, R).amountCents).toBe(1);
  });

  it('금액이 0인 보드의 환불·다투기 계획은 막지 않는다 (제안만 본다)', () => {
    const zero = board({ amountCents: 0 });
    expect(planMove(zero, evaluationFor(zero, 'refund'), P, R).amountCents).toBe(0);
    expect(planMove(zero, evaluationFor(zero, 'fight'), P, R).amountCents).toBeNull();
  });
});

describe('입력 검증 (recommend와 같은 zod)', () => {
  it('제안률이 한도(0.20)를 넘으면 ZodError', () => {
    const b = board();
    const offer = evaluationFor(b, 'offer');
    expect(() => planMove(b, offer, { ...P, offerRate: 0.25 }, R)).toThrow(ZodError);
    expect(() => planMove(b, offer, { ...P, offerRate: R.offer.maxRate }, R)).not.toThrow();
  });

  it('한도를 0.10으로 낮추면 정책값 0.15도 ZodError', () => {
    const b = board();
    const rules: PolicyConfig = { ...R, offer: { ...R.offer, maxRate: 0.1 } };
    expect(() => planMove(b, evaluationFor(b, 'offer'), P, rules)).toThrow(ZodError);
  });

  it('금액이 정수가 아니면 ZodError', () => {
    const b = board();
    const offer = evaluationFor(b, 'offer');
    expect(() => planMove({ ...b, amountCents: 48.5 }, offer, P, R)).toThrow(ZodError);
  });

  it('params·rules를 안 넘기면 config 파일을 쓴다', () => {
    const b = board();
    const offer = evaluationFor(b, 'offer');
    expect(JSON.stringify(planMove(b, offer))).toBe(JSON.stringify(planMove(b, offer, P, R)));
  });
});

describe('planId', () => {
  const b = board();

  it('같은 입력이면 같은 값 (50회)', () => {
    const offer = evaluationFor(b, 'offer');
    const first = planMove(b, offer, P, R).planId;
    for (let i = 0; i < 50; i++) expect(planMove(b, offer, P, R).planId).toBe(first);
  });

  it('사람이 읽을 수 있는 형태 (분쟁·수·금액이 보인다)', () => {
    const planId = planMove(b, evaluationFor(b, 'offer'), P, R).planId;
    expect(planId).toBe('plan-U-1-offer-make_offer-720-refund');
  });

  it('수가 다르면 다른 값', () => {
    const ids = (['fight', 'offer', 'refund'] as const).map((m) => planMove(b, evaluationFor(b, m), P, R).planId);
    expect(new Set(ids).size).toBe(3);
  });

  it('분쟁이 다르면 다른 값 (하이픈이 있는 분쟁 ID도 겹치지 않는다)', () => {
    const left = board({ disputeId: 'PP-D-1-offer' });
    const right = board({ disputeId: 'PP-D-1' });
    expect(planMove(left, evaluationFor(left, 'offer'), P, R).planId).not.toBe(
      planMove(right, evaluationFor(right, 'offer'), P, R).planId,
    );
  });

  it('금액이 다르면 다른 값', () => {
    const other = board({ amountCents: 7200 });
    expect(planMove(b, evaluationFor(b, 'offer'), P, R).planId).not.toBe(
      planMove(other, evaluationFor(other, 'offer'), P, R).planId,
    );
  });

  it('실행 API가 다르면 다른 값 (fight: send_message vs provide_evidence)', () => {
    // 합의 단계가 아닌 보드여야 fight가 provide_evidence로 잡힌다 (v2.4, Q15).
    const evidence = board({ stage: 'CHARGEBACK', allowedMoves: ['provide_evidence', 'send_message'] });
    expect(planMove(b, evaluationFor(b, 'fight'), P, R).planId).not.toBe(
      planMove(evidence, evaluationFor(evidence, 'fight'), P, R).planId,
    );
  });

  it('환불 종류를 그대로 담는다 (바뀌면 planId도 바뀐다)', () => {
    // 지금 계획은 REFUND와 null만 쓰지만, planId 마지막 조각이 환불 종류라서
    // REFUND_WITH_RETURN을 쓰게 되면 planId도 달라진다.
    for (const move of ['offer', 'refund'] as const) {
      const plan = planMove(b, evaluationFor(b, move), P, R);
      expect(plan.planId.endsWith(`-${plan.refundType!.toLowerCase()}`)).toBe(true);
    }
    const fight = planMove(b, evaluationFor(b, 'fight'), P, R);
    expect(fight.refundType).toBeNull();
    expect(fight.planId.endsWith('-none')).toBe(true);
  });

  it('금액이 없는 수는 none으로 적는다 (fight)', () => {
    expect(planMove(b, evaluationFor(b, 'fight'), P, R).planId).toBe('plan-U-1-fight-send_message-none-none');
  });
});

describe('불변과 결정론', () => {
  it('보드·평가·가정값·규칙을 바꾸지 않는다 (동결된 객체도 통과)', () => {
    const b = board();
    const offer = evaluationFor(b, 'offer');
    Object.freeze(b);
    Object.freeze(b.cause);
    Object.freeze(b.allowedMoves);
    Object.freeze(offer);
    Object.freeze(offer.branches);
    const before = JSON.stringify({ b, offer, P, R });
    expect(() => planMove(b, offer, P, R)).not.toThrow();
    expect(JSON.stringify({ b, offer, P, R })).toBe(before);
  });

  it('계획을 바꿔도 다음 호출 결과는 그대로다', () => {
    const b = board();
    const offer = evaluationFor(b, 'offer');
    const plan = planMove(b, offer, P, R);
    const before = JSON.stringify(plan);
    plan.amountCents = 1;
    expect(JSON.stringify(planMove(b, offer, P, R))).toBe(before);
  });
});
