/**
 * 단위 테스트: recommend (SPEC v2.1 5장). 작업 T004.
 * 인수 테스트(AC1~AC3, AC5·AC6·AC8, AC9·AC10)가 보는 곳 말고, 검증·필터·동점·설정 읽기를 본다.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { paramsFromConfig, rulesFromConfig } from '@/engine/params';
import { BLOCKED, MOVE_ORDER } from '@/engine/policy';
import { recommend } from '@/engine/recommend';
import type { BoardState, Evaluation, Params, PolicyConfig, Subtype } from '@/types';

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

function subtype(s: Subtype, confidence = 0.9): Partial<BoardState> {
  return { cause: { subtype: s, confidence, evidence: ['x'], needsReview: confidence < 0.7, source: 'llm' } };
}

function byMove(all: Evaluation[], move: Evaluation['move']): Evaluation | undefined {
  return all.find((e) => e.move === move);
}

describe('설정 읽기: params·rules를 안 넘기면 config 파일을 쓴다', () => {
  it('config를 직접 넘긴 결과와 같다', () => {
    expect(JSON.stringify(recommend(board()))).toBe(JSON.stringify(recommend(board(), P, R)));
  });

  it('config의 f = 1500¢, t = 200¢가 쓰인다 (refund = A + t)', () => {
    expect(byMove(recommend(board()).all, 'refund')?.expectedLossCents).toBe(4800 + P.timeCostCents);
    expect(byMove(recommend(board()).all, 'fight')?.expectedLossCents).toBe(
      Math.round((1 - P.pWin.B1) * (4800 + P.feeCents) + P.timeCostCents),
    );
  });
});

describe('입력 검증 (zod)', () => {
  it('금액이 음수면 ZodError', () => {
    expect(() => recommend(board({ amountCents: -1 }), P, R)).toThrow(ZodError);
  });

  it('금액이 정수가 아니면 ZodError', () => {
    expect(() => recommend(board({ amountCents: 48.5 }), P, R)).toThrow(ZodError);
  });

  it('확신도가 1을 넘으면 ZodError', () => {
    expect(() => recommend(board(subtype('B1', 1.2)), P, R)).toThrow(ZodError);
  });

  it('확률이 아닌 p_acc면 ZodError', () => {
    expect(() => recommend(board(), { ...P, pAccept: 1.5 }, R)).toThrow(ZodError);
  });

  it('제안률이 한도(0.20)를 넘으면 ZodError', () => {
    expect(() => recommend(board(), { ...P, offerRate: 0.25 }, R)).toThrow(ZodError);
    expect(() => recommend(board(), { ...P, offerRate: R.offer.maxRate }, R)).not.toThrow();
  });

  it('수수료가 정수 센트가 아니면 ZodError', () => {
    expect(() => recommend(board(), { ...P, feeCents: 1500.5 }, R)).toThrow(ZodError);
  });

  it('없는 세부 유형이면 ZodError', () => {
    const bad = { ...board(), cause: { subtype: 'Z9', confidence: 0.9, evidence: [], needsReview: false, source: 'llm' } };
    expect(() => recommend(bad as unknown as BoardState, P, R)).toThrow(ZodError);
  });
});

describe('원인이 없으면 계산하지 않는다', () => {
  const rec = recommend(board({ cause: undefined }), P, R);

  it('세 수 모두 차단 (NO_CAUSE), 기대 손실 null, 분기 없음', () => {
    expect(rec.all.map((e) => e.move)).toEqual(['fight', 'offer', 'refund']);
    for (const e of rec.all) {
      expect(e.blockedBy).toBe(BLOCKED.noCause);
      expect(e.expectedLossCents).toBeNull();
      expect(e.branches).toEqual([]);
      expect(e.apiMove).toBeNull();
    }
  });

  it('추천이 없고(best null) 승인은 여전히 필요하다', () => {
    expect(rec.best).toBeNull();
    expect(rec.requiresApproval).toBe(true);
  });

  it('오토파일럿은 건너뜀 (low_confidence)', () => {
    expect(rec.autopilot.verdict).toBe('skipped');
    expect(rec.autopilot.rule).toBe('low_confidence');
  });
});

describe('수 → API와 허용된 수 필터 (SPEC 5장)', () => {
  it('목록 순서는 항상 fight → offer → refund', () => {
    expect(recommend(board(), P, R).all.map((e) => e.move)).toEqual([...MOVE_ORDER]);
  });

  it('증빙 링크만 있으면 fight는 provide_evidence', () => {
    const rec = recommend(board({ allowedMoves: ['provide_evidence'] }), P, R);
    expect(byMove(rec.all, 'fight')?.apiMove).toBe('provide_evidence');
    expect(rec.all.map((e) => e.move)).toEqual(['fight']);
  });

  it('증빙·메시지 둘 다 없으면 fight 평가가 없다', () => {
    const rec = recommend(board({ allowedMoves: ['make_offer', 'accept_claim'] }), P, R);
    expect(byMove(rec.all, 'fight')).toBeUndefined();
    expect(rec.best?.move).toBe('offer');
  });

  it('제안 대상이 아니면 차단만 하고 목록에는 남긴다 (OFFER_SCOPE)', () => {
    const offer = byMove(recommend(board(subtype('A1')), P, R).all, 'offer');
    expect(offer?.blockedBy).toBe(BLOCKED.offerScope);
    expect(offer?.apiMove).toBeNull();
    expect(offer?.expectedLossCents).toBeNull();
  });

  it('make_offer가 허용되지 않으면 제안 대상이어도 목록에서 뺀다', () => {
    const rec = recommend(board({ allowedMoves: ['send_message', 'accept_claim'] }), P, R);
    expect(byMove(rec.all, 'offer')).toBeUndefined();
  });
});

describe('추천 고르기', () => {
  it('차단된 수는 추천하지 않는다 (A1: offer 차단 → fight 또는 refund)', () => {
    const rec = recommend(board(subtype('A1')), P, R);
    expect(rec.best?.move).not.toBe('offer');
    expect(rec.best?.blockedBy).toBeUndefined();
  });

  it('추적 기록이 생기면 다투기 손실이 줄어 추천이 바뀐다 (A1)', () => {
    const noTracking = recommend(board(subtype('A1')), P, R);
    const tracked = recommend(board({ ...subtype('A1'), hasTracking: true, hasDeliveredTracking: true }), P, R);
    expect(noTracking.best?.move).toBe('refund');
    expect(tracked.best?.move).toBe('fight');
  });

  it('동점이면 fight → offer → refund 순서 (fight 5000¢ = refund 5000¢)', () => {
    // (1 − p_win)(4800 + 1500) + 200 = 5000 → p_win = 1 − 4800/6300
    const pWin = 1 - 4800 / 6300;
    const params: Params = { ...P, pWin: { ...P.pWin, B3: pWin } };
    const rec = recommend(board(subtype('B3')), params, R);
    expect(byMove(rec.all, 'fight')?.expectedLossCents).toBe(5000);
    expect(byMove(rec.all, 'refund')?.expectedLossCents).toBe(5000);
    expect(rec.best?.move).toBe('fight');
  });

  it('허용된 수가 없으면 best = null', () => {
    const rec = recommend(board({ allowedMoves: [] }), P, R);
    expect(rec.all).toEqual([]);
    expect(rec.best).toBeNull();
  });
});

describe('결정론과 불변', () => {
  it('입력 보드를 바꾸지 않는다 (동결된 객체도 통과)', () => {
    const b = board();
    Object.freeze(b);
    Object.freeze(b.cause);
    Object.freeze(b.allowedMoves);
    const before = JSON.stringify(b);
    expect(() => recommend(b, P, R)).not.toThrow();
    expect(JSON.stringify(b)).toBe(before);
  });

  it('가정값·규칙 객체를 바꾸지 않는다', () => {
    const before = JSON.stringify({ P, R });
    recommend(board(), P, R);
    expect(JSON.stringify({ P, R })).toBe(before);
  });
});
