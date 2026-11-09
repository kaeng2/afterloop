import { describe, expect, it } from 'vitest';

import { resolveParams } from '@/engine/params';
import { recommend } from '@/engine/recommend';
import { adjustParams } from '@/engine/rules';
import type { BoardState, Evaluation, RootCause } from '@/engine/types';

/** 합의 단계 기본 판. 허용 대응은 실제 샌드박스 응답(tests/fixtures/dispute-detail.inquiry-waiting-seller.json)과 같다. */
const base: BoardState = {
  disputeId: 'PP-R-TEST-RULES',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-29T06:09:25.608Z',
  amountCents: 4800,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  buyerDisputeCount90d: 0,
  hasDeliveredTracking: false,
  cause: { rootCause: 'B_EXPECTATION', confidence: 0.9, signals: [], needsReview: false },
};

/** 클레임 단계 판 (provide_evidence 가능) */
const claimStage: Partial<BoardState> = {
  stage: 'CHARGEBACK',
  allowedMoves: ['provide_evidence', 'make_offer', 'accept_claim', 'send_message'],
};

const board = (patch: Partial<BoardState> = {}, cause?: RootCause, needsReview = false): BoardState => ({
  ...base,
  ...patch,
  cause: cause ? { rootCause: cause, confidence: 0.9, signals: [], needsReview } : (patch.cause ?? base.cause),
});

const find = (evals: Evaluation[], move: Evaluation['move']) => evals.find((e) => e.move === move);
const get = (evals: Evaluation[], move: Evaluation['move']) => {
  const e = find(evals, move);
  if (!e) throw new Error(`${move} 평가가 없음`);
  return e;
};

describe('R1 금액 $50 이하이고 원인 B → 제안 비율 최대 20%', () => {
  it('R1a: $48, 원인 B, offerRate 0.25 → 0.20으로 제한', () => {
    const b = board({ amountCents: 4800 }, 'B_EXPECTATION');
    expect(adjustParams(b, resolveParams({ offerRate: 0.25 })).offerRate).toBe(0.2);

    const rec = recommend(b, { offerRate: 0.25 });
    const offer = get(rec.all, 'offer');
    expect(offer.offerRate).toBe(0.2);
    // 수락 분기 손실 = 0.20 × 4800 + 0.2 × 6000 = 2160 (0.25였다면 2400)
    expect(offer.branches[0].lossCents).toBe(2160);
    expect(rec.appliedRules).toContain('R1');
  });

  it('R1b: $72, 원인 B → R1 미적용', () => {
    const b = board({ amountCents: 7200 }, 'B_EXPECTATION');
    expect(adjustParams(b, resolveParams({ offerRate: 0.25 })).offerRate).toBe(0.25);
    const rec = recommend(b, { offerRate: 0.25 });
    expect(get(rec.all, 'offer').offerRate).toBe(0.25);
    expect(rec.appliedRules).not.toContain('R1');
  });

  it('경계: $50.00은 적용, $50.01은 미적용', () => {
    expect(adjustParams(board({ amountCents: 5000 }), resolveParams({ offerRate: 0.25 })).offerRate).toBe(0.2);
    expect(adjustParams(board({ amountCents: 5001 }), resolveParams({ offerRate: 0.25 })).offerRate).toBe(0.25);
  });

  it('원인이 B가 아니면 미적용, 이미 20% 이하이면 그대로', () => {
    expect(adjustParams(board({}, 'A_DELIVERY'), resolveParams({ offerRate: 0.25 })).offerRate).toBe(0.25);
    expect(adjustParams(board({}, 'B_EXPECTATION'), resolveParams({ offerRate: 0.15 })).offerRate).toBe(0.15);
    expect(recommend(board({}, 'B_EXPECTATION')).appliedRules).not.toContain('R1');
  });
});

describe('R2 금액 $150 이상 → 환불은 반품 조건 필수', () => {
  it('$189: offer와 refund 모두 REFUND_WITH_RETURN', () => {
    const rec = recommend(board({ amountCents: 18900 }, 'C_BILLING'));
    expect(get(rec.all, 'offer').offerType).toBe('REFUND_WITH_RETURN');
    expect(get(rec.all, 'refund').offerType).toBe('REFUND_WITH_RETURN');
    expect(rec.appliedRules).toContain('R2');
  });

  it('경계: $150.00은 반품 조건, $149.99는 일반 환불', () => {
    expect(get(recommend(board({ amountCents: 15000 })).all, 'refund').offerType).toBe('REFUND_WITH_RETURN');
    const under = recommend(board({ amountCents: 14999 }));
    expect(get(under.all, 'refund').offerType).toBe('REFUND');
    expect(get(under.all, 'offer').offerType).toBe('REFUND');
    expect(under.appliedRules).not.toContain('R2');
  });
});

describe('R3 원인 A이고 배송 완료 추적 있음 → 증빙 제출 + 안내 메시지', () => {
  it('합의 단계: 추천은 fight(send_message로 소명), 메시지 동반, offer·refund는 R3로 차단', () => {
    const rec = recommend(board({ hasDeliveredTracking: true }, 'A_DELIVERY'));
    expect(rec.best?.move).toBe('fight');
    expect(rec.best?.apiMove).toBe('send_message');
    expect(rec.best?.attachMessage).toBe(true);
    expect(get(rec.all, 'offer').blockedBy).toBe('R3');
    expect(get(rec.all, 'refund').blockedBy).toBe('R3');
    expect(rec.appliedRules).toContain('R3');
  });

  it('클레임 단계: 추천은 provide_evidence + 메시지 동반', () => {
    const rec = recommend(board({ ...claimStage, hasDeliveredTracking: true }, 'A_DELIVERY'));
    expect(rec.best?.move).toBe('fight');
    expect(rec.best?.apiMove).toBe('provide_evidence');
    expect(rec.best?.attachMessage).toBe(true);
  });

  it('배송 완료 추적이 없으면 미적용 (기대 손실로 고름)', () => {
    const rec = recommend(board({ hasDeliveredTracking: false }, 'A_DELIVERY'));
    expect(rec.appliedRules).not.toContain('R3');
    expect(rec.best?.move).toBe('offer');
    expect(get(rec.all, 'fight').attachMessage).toBeFalsy();
  });
});

describe('R4 원인 F 또는 90일 내 분쟁 2회 이상 구매자 → 제안 금지', () => {
  it('R4a: 원인 F → offer 차단, blockedBy "R4"', () => {
    const offer = get(recommend(board({}, 'F_ABUSE')).all, 'offer');
    expect(offer.expectedLossCents).toBeNull();
    expect(offer.blockedBy).toBe('R4');
  });

  it('R4b: 원인 B지만 90일 내 분쟁 2회 → offer 차단', () => {
    const rec = recommend(board({ buyerDisputeCount90d: 2 }, 'B_EXPECTATION'));
    expect(get(rec.all, 'offer').blockedBy).toBe('R4');
    expect(rec.best?.move).not.toBe('offer');
  });

  it('90일 내 1회면 차단하지 않음', () => {
    expect(get(recommend(board({ buyerDisputeCount90d: 1 })).all, 'offer').blockedBy).toBeUndefined();
  });
});

describe('R5 channel EXTERNAL → 협상 없이 증빙 대응', () => {
  const rec = recommend(board({ ...claimStage, channel: 'EXTERNAL' }, 'B_EXPECTATION'));

  it('offer 차단 (blockedBy "R5")', () => {
    expect(get(rec.all, 'offer').blockedBy).toBe('R5');
    expect(rec.appliedRules).toContain('R5');
  });

  it('협상 메시지 차단: fight는 provide_evidence로만 실행, 메시지 동반 없음', () => {
    expect(get(rec.all, 'fight').apiMove).toBe('provide_evidence');
    expect(rec.all.some((e) => e.apiMove === 'send_message')).toBe(false);
    expect(rec.all.every((e) => !e.attachMessage)).toBe(true);
  });

  it('provide_evidence가 허용되지 않으면 fight도 평가에서 빠진다 (send_message로 대신하지 않음)', () => {
    const r = recommend(
      board({ stage: 'CHARGEBACK', channel: 'EXTERNAL', allowedMoves: ['send_message', 'accept_claim'] }),
    );
    expect(find(r.all, 'fight')).toBeUndefined();
  });
});

describe('공통 규칙', () => {
  it('G1: allowedMoves에 make_offer가 없으면 offer 평가 제외', () => {
    const rec = recommend(board({ allowedMoves: ['send_message', 'accept_claim'] }));
    expect(find(rec.all, 'offer')).toBeUndefined();
    expect(rec.all.map((e) => e.move)).toEqual(['fight', 'refund']);
    expect(rec.best?.move).toBe('refund');
  });

  it('G2: allowedMoves가 비어 있으면 best = null, "직접 처리" 상태', () => {
    const rec = recommend(board({ allowedMoves: [] }));
    expect(rec.best).toBeNull();
    expect(rec.all).toEqual([]);
    expect(rec.status).toBe('manual');
  });

  it('G2: 남은 수가 모두 규칙에 막혀도 "직접 처리"', () => {
    // R3로 offer·refund 차단, fight(send_message)는 허용 목록에 없음
    const rec = recommend(board({ hasDeliveredTracking: true, allowedMoves: ['make_offer', 'accept_claim'] }, 'A_DELIVERY'));
    expect(rec.best).toBeNull();
    expect(rec.status).toBe('manual');
  });

  it('평소에는 status "ready"', () => {
    expect(recommend(base).status).toBe('ready');
  });

  it('G3: 원인 E는 엄격 승인(별도 확인) 대상, requiresApproval true', () => {
    const rec = recommend(board({}, 'E_FRAUD'));
    expect(rec.requiresApproval).toBe(true);
    expect(rec.strictApproval).toBe(true);
  });

  it('G3: 원인 F도 엄격 승인 대상', () => {
    expect(recommend(board({}, 'F_ABUSE')).strictApproval).toBe(true);
  });

  it('G3: accept_claim 평가는 항상 엄격 승인, 추천이 accept_claim이면 추천 전체도 엄격 승인', () => {
    const rec = recommend(board({ allowedMoves: ['send_message', 'accept_claim'] }));
    expect(get(rec.all, 'refund').strictApproval).toBe(true);
    expect(rec.best?.apiMove).toBe('accept_claim');
    expect(rec.strictApproval).toBe(true);
  });

  it('G3: 원인 B, 추천 make_offer이면 엄격 승인은 아니지만 승인은 필요', () => {
    const rec = recommend(base);
    expect(rec.best?.apiMove).toBe('make_offer');
    expect(rec.strictApproval).toBe(false);
    expect(rec.requiresApproval).toBe(true);
  });

  it('G4: 원인 분류 needsReview true → 추천은 계산하되 "판매자 확인 필요"', () => {
    const reviewed = recommend(board({}, 'B_EXPECTATION', true));
    const normal = recommend(board({}, 'B_EXPECTATION', false));
    expect(reviewed.best).toEqual(normal.best);
    expect(reviewed.needsSellerReview).toBe(true);
    expect(normal.needsSellerReview).toBe(false);
  });

  it('G4: 원인 분류가 아직 없으면 "판매자 확인 필요"', () => {
    const { cause: _omit, ...noCause } = base;
    const rec = recommend(noCause);
    expect(rec.best).not.toBeNull();
    expect(rec.needsSellerReview).toBe(true);
  });
});

describe('규칙 적용 후에도 결정론 유지', () => {
  it('규칙이 여럿 걸린 판도 100번 같은 결과', () => {
    const b = board({ ...claimStage, channel: 'EXTERNAL', amountCents: 18900, buyerDisputeCount90d: 3 }, 'E_FRAUD');
    const first = JSON.stringify(recommend(b, { offerRate: 0.25 }));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(recommend(b, { offerRate: 0.25 }))).toBe(first);
  });
});
