/**
 * 단위 테스트: 기대 손실 계산 (SPEC v2.1 5장). 작업 T004.
 * 가정값은 config/params.json을 엔진 로더로 읽는다 (코드에 숫자를 직접 쓰지 않는다).
 */
import { describe, expect, it } from 'vitest';

import { fightLoss, offerLoss, pWinFor, refundLoss, roundCents } from '@/engine/oracle';
import { paramsFromConfig } from '@/engine/params';
import type { BoardState, Params, Subtype } from '@/types';

const P: Params = paramsFromConfig();

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

function withSubtype(subtype: Subtype, over: Partial<BoardState> = {}): BoardState {
  return board({ cause: { subtype, confidence: 0.9, evidence: ['x'], needsReview: false, source: 'llm' }, ...over });
}

describe('roundCents: 마지막에 센트로 사사오입', () => {
  it('0.5는 올림, 0.4는 내림', () => {
    expect(roundCents(1952.5)).toBe(1953);
    expect(roundCents(1952.4)).toBe(1952);
  });

  it('부동소수 오차(1952.9999999999998)는 1953', () => {
    expect(roundCents(0.72 * 0.15 * 4800 + 0.28 * 0.7 * 6300 + 200)).toBe(1953);
    expect(roundCents(1952.9999999999998)).toBe(1953);
  });

  it('이미 정수면 그대로', () => {
    expect(roundCents(5000)).toBe(5000);
  });
});

describe('pWinFor: 추적 기록에 따라 승률을 고른다', () => {
  it('원인이 없으면 계산하지 않는다 (null)', () => {
    expect(pWinFor(board({ cause: undefined }), P)).toBeNull();
  });

  it('추적 없음 → pWin[subtype]', () => {
    expect(pWinFor(withSubtype('F1'), P)).toBe(P.pWin.F1);
    expect(pWinFor(withSubtype('B1'), P)).toBe(P.pWin.B1);
  });

  it('추적 있음 → pWinWithTracking[subtype] (F1 0.15 → 0.80)', () => {
    expect(pWinFor(withSubtype('F1', { hasTracking: true }), P)).toBe(P.pWinWithTracking.F1);
    expect(P.pWinWithTracking.F1).toBeGreaterThan(P.pWin.F1);
  });

  it('추적 있음인데 그 유형의 상향값이 없으면 pWin을 쓴다 (B1)', () => {
    expect(P.pWinWithTracking.B1).toBeUndefined();
    expect(pWinFor(withSubtype('B1', { hasTracking: true }), P)).toBe(P.pWin.B1);
  });
});

describe('기대 손실 식 (SPEC 5장)', () => {
  it('L_fight = (1 − p_win)(A + f) + t', () => {
    // 0.7 × (4800 + 1500) + 200 = 4610
    expect(fightLoss(board(), P, 0.3).expectedLossCents).toBe(4610);
  });

  it('L_offer = p_acc·x·A + (1 − p_acc)(1 − p_win)(A + f) + t', () => {
    // 0.72 × 0.15 × 4800 + 0.28 × 0.7 × 6300 + 200 = 1953.2 → 1953
    expect(offerLoss(board(), P, 0.3).expectedLossCents).toBe(1953);
  });

  it('L_refund = A + t (분쟁 수수료 면제)', () => {
    expect(refundLoss(board(), P).expectedLossCents).toBe(5000);
  });

  it('이길 확률이 1이면 다투기 손실은 시간 비용뿐', () => {
    expect(fightLoss(board(), P, 1).expectedLossCents).toBe(P.timeCostCents);
  });

  it('제안 수락 분기에는 수수료가 없다 (x·A + t)', () => {
    const accept = offerLoss(board(), P, 0.3).branches.find((b) => b.label === 'accept');
    expect(accept?.lossCents).toBe(roundCents(P.offerRate * 4800) + P.timeCostCents);
  });

  it('제안 금액은 센트 정수로 반올림해 식에 넣는다 (A 1050¢ → 157.5 → 158¢)', () => {
    const b = board({ amountCents: 1050 });
    const accept = offerLoss(b, P, 0.3).branches.find((b2) => b2.label === 'accept');
    expect(accept?.lossCents).toBe(158 + P.timeCostCents);
    expect(Number.isInteger(offerLoss(b, P, 0.3).expectedLossCents)).toBe(true);
  });

  it('다투기 패배 분기 = A + f + t', () => {
    const lose = fightLoss(board(), P, 0.3).branches.find((b) => b.label === 'lose');
    expect(lose?.lossCents).toBe(4800 + P.feeCents + P.timeCostCents);
  });
});

describe('트리 분기가 기대 손실과 맞다 (확률 합 1, 오차 0.5¢ 이내)', () => {
  const amounts = [1, 7, 10, 35, 99, 333, 1050, 3500, 4800, 9999, 12345, 200000];
  const pWins = [0, 0.15, 0.3, 0.5, 0.6, 0.8, 1];

  it.each(amounts)('A = %i¢', (amountCents) => {
    for (const pWin of pWins) {
      const b = board({ amountCents });
      for (const loss of [fightLoss(b, P, pWin), offerLoss(b, P, pWin), refundLoss(b, P)]) {
        const probSum = loss.branches.reduce((s, br) => s + br.prob, 0);
        expect(probSum).toBeCloseTo(1, 9);
        const weighted = loss.branches.reduce((s, br) => s + br.prob * br.lossCents, 0);
        expect(Math.abs(weighted - loss.expectedLossCents)).toBeLessThanOrEqual(0.5);
      }
    }
  });
});
