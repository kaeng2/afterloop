/**
 * 인수 테스트 AC4~AC8: 정책 규칙 R1~R5 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
 * 기준: SPEC v1. 규칙 정의: SPEC.md 4장 (PRD S7). 기준값: rules.fixture.json (R)
 * 각 규칙마다 "걸리는 경우"와 "안 걸리는 경우"를 함께 본다.
 */
import { describe, expect, it } from 'vitest';

import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import type { BoardState } from '@/types';

import { byMove, CARDIGAN, P, R, withCause } from './boards';

/** 클레임 단계: 증빙 제출 링크가 열려 있는 상태 */
const CLAIM_MOVES: BoardState['allowedMoves'] = ['provide_evidence', 'send_message', 'make_offer', 'accept_claim'];

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
// x = 0.20 → p_acc 0.85, 수락 분기 = 0.2·4800 + 0.2·6000 = 2160, 제안 금액 960
describe('AC4 R1: A ≤ $50 이고 원인 B → 제안 비율 최대 20%', () => {
  const params = { ...P, offerRate: 0.25 };

  it('$48, offerRate 0.25 → 0.20으로 제한', () => {
    const rec = recommend(CARDIGAN, params, R);
    const offer = byMove(rec.all, 'offer');
    expect(offer.branches[0].prob).toBeCloseTo(0.85, 12);
    expect(offer.branches[0].lossCents).toBe(2160);
    expect(planMove(CARDIGAN, offer, params, R).amountCents).toBe(960);
  });

  it('$50 경계도 제한 → 제안 금액 1000', () => {
    const board = { ...CARDIGAN, amountCents: 5000 };
    const offer = byMove(recommend(board, params, R).all, 'offer');
    expect(planMove(board, offer, params, R).amountCents).toBe(1000);
  });

  it('$72면 R1 미적용 → 제안 금액 1800 (x 0.25 그대로)', () => {
    const board = { ...CARDIGAN, amountCents: 7200 };
    const offer = byMove(recommend(board, params, R).all, 'offer');
    expect(planMove(board, offer, params, R).amountCents).toBe(1800);
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC5 R2: A ≥ $150 → 환불은 반품 조건 필수', () => {
  it('$189 환불 → accept_claim, REFUND_WITH_RETURN, 18900¢', () => {
    const board = { ...CARDIGAN, amountCents: 18900 };
    const refund = byMove(recommend(board, P, R).all, 'refund');
    const plan = planMove(board, refund, P, R);
    expect(plan.apiMove).toBe('accept_claim');
    expect(plan.refundType).toBe('REFUND_WITH_RETURN');
    expect(plan.amountCents).toBe(18900);
  });

  it('$150 경계도 REFUND_WITH_RETURN', () => {
    const board = { ...CARDIGAN, amountCents: 15000 };
    const plan = planMove(board, byMove(recommend(board, P, R).all, 'refund'), P, R);
    expect(plan.refundType).toBe('REFUND_WITH_RETURN');
  });

  it('$48 환불은 반품 조건 없음 (REFUND)', () => {
    const plan = planMove(CARDIGAN, byMove(recommend(CARDIGAN, P, R).all, 'refund'), P, R);
    expect(plan.refundType).toBe('REFUND');
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
// 기대 손실만 보면 offer(4032)가 fight(7780)보다 낫지만, R3이 증빙 대응으로 고정한다
describe('AC6 R3: 원인 A이고 배송 완료 추적 있음 → 증빙 제출 + 안내 메시지', () => {
  const delivered = { ...withCause(CARDIGAN, 'A_DELIVERY'), hasDeliveredTracking: true };

  it('합의 단계: 추천 fight, send_message로 실행, 메시지 동반', () => {
    const rec = recommend(delivered, P, R);
    expect(rec.best?.move).toBe('fight');
    expect(rec.best?.blockedBy).toBeUndefined();
    expect(rec.best?.apiMove).toBe('send_message');
    expect(planMove(delivered, rec.best!, P, R).messageRequired).toBe(true);
  });

  it('클레임 단계(증빙 링크 있음): provide_evidence로 실행, 메시지 동반', () => {
    const board: BoardState = { ...delivered, stage: 'CHARGEBACK', allowedMoves: CLAIM_MOVES };
    const rec = recommend(board, P, R);
    expect(rec.best?.move).toBe('fight');
    expect(rec.best?.apiMove).toBe('provide_evidence');
    expect(planMove(board, rec.best!, P, R).messageRequired).toBe(true);
  });

  it('배송 완료 추적이 없으면 R3 미적용 → 기대 손실대로 offer', () => {
    const rec = recommend(withCause(CARDIGAN, 'A_DELIVERY'), P, R);
    expect(rec.best?.move).toBe('offer');
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC7 R4: 원인 F 또는 90일 내 분쟁 2회 이상 구매자 → 제안 금지', () => {
  it('원인 B라도 90일 내 분쟁 2회면 offer 차단 (blockedBy "R4")', () => {
    const rec = recommend({ ...CARDIGAN, buyerDisputeCount90d: 2 }, P, R);
    const offer = byMove(rec.all, 'offer');
    expect(offer.expectedLossCents).toBeNull();
    expect(offer.blockedBy).toBe('R4');
    expect(offer.branches).toEqual([]);
    expect(rec.best?.move).not.toBe('offer');
  });

  it('90일 내 분쟁 1회면 차단하지 않음 (offer 4032¢)', () => {
    const offer = byMove(recommend({ ...CARDIGAN, buyerDisputeCount90d: 1 }, P, R).all, 'offer');
    expect(offer.blockedBy).toBeUndefined();
    expect(offer.expectedLossCents).toBe(4032);
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
// make_offer가 허용 목록에 있어도 R5가 막는다. send_message가 있어도 fight는 증빙으로만.
describe('AC8 R5: channel EXTERNAL → 협상 없이 증빙 대응', () => {
  const external: BoardState = { ...CARDIGAN, channel: 'EXTERNAL', stage: 'CHARGEBACK', allowedMoves: CLAIM_MOVES };

  it('offer 차단 (blockedBy "R5"), fight는 provide_evidence', () => {
    const rec = recommend(external, P, R);
    const offer = byMove(rec.all, 'offer');
    expect(offer.expectedLossCents).toBeNull();
    expect(offer.blockedBy).toBe('R5');
    expect(byMove(rec.all, 'fight').apiMove).toBe('provide_evidence');
    expect(rec.best?.move).not.toBe('offer');
  });

  it('INTERNAL이면 같은 조건에서 offer가 열려 있다', () => {
    const offer = byMove(recommend({ ...external, channel: 'INTERNAL' }, P, R).all, 'offer');
    expect(offer.blockedBy).toBeUndefined();
  });
});
