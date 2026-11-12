/**
 * 단위 테스트: 무료 수선 repair (SPEC v2.16, AC35). 작업 T120.
 * 실제 config(params.json·rules.json) 값으로 AC35와 같은 숫자가 나오는지, 대상 밖·가정값 없음·실행 계획·
 * "Keeps ≈$N"(actionSavings)·오토파일럿을 본다.
 */
import { describe, expect, it } from 'vitest';

import { paramsFromConfig, rulesFromConfig } from '@/engine/params';
import { planMove } from '@/engine/plan';
import { BLOCKED } from '@/engine/policy';
import { recommend } from '@/engine/recommend';
import { actionSavings } from '@/engine/savings';
import type { BoardState, Params, PolicyConfig, Subtype } from '@/types';

const P: Params = paramsFromConfig();
const R: PolicyConfig = rulesFromConfig();

function board(subtype: Subtype = 'B3', over: Partial<BoardState> = {}): BoardState {
  return {
    disputeId: 'U-REPAIR',
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
    cause: { subtype, confidence: 0.9, evidence: ['quality'], needsReview: false, source: 'llm' },
    ...over,
  };
}

describe('repair (B3 품질, 실제 config)', () => {
  it('config 값이 AC35 fixture와 같다: 700¢, 0.8, B3', () => {
    expect(P.repairCostCents).toBe(700);
    expect(P.pAcceptRepair).toBe(0.8);
    expect(R.repair?.eligibleSubtypes).toEqual(['B3']);
  });

  it('B3 $48: repair 1642¢ 추천, send_message, 분기 3개', () => {
    const rec = recommend(board(), P, R);
    const repair = rec.all.find((e) => e.move === 'repair');
    expect(repair?.expectedLossCents).toBe(1642);
    expect(repair?.apiMove).toBe('send_message');
    expect(repair?.branches.map((b) => b.label)).toEqual(['accept', 'reject_win', 'reject_lose']);
    expect(repair?.branches.map((b) => b.lossCents)).toEqual([900, 200, 6500]);
    expect(rec.best?.move).toBe('repair');
    expect(rec.all.map((e) => e.move)).toEqual(['fight', 'offer', 'refund', 'repair']);
  });

  it('B3가 아닌 유형에는 repair가 목록에 없다 (기존 결과 무변경)', () => {
    for (const s of ['B1', 'B2', 'A1', 'A2', 'F1'] as Subtype[]) {
      expect(recommend(board(s), P, R).all.some((e) => e.move === 'repair')).toBe(false);
    }
  });

  it('원인이 없으면 repair를 만들지 않는다', () => {
    expect(recommend(board('B3', { cause: undefined }), P, R).all.some((e) => e.move === 'repair')).toBe(false);
  });

  it('send_message가 허용되지 않으면 repair는 빠진다', () => {
    const rec = recommend(board('B3', { allowedMoves: ['accept_claim'] }), P, R);
    expect(rec.all.map((e) => e.move)).toEqual(['refund']);
  });

  it('규칙에 repair가 없으면 평가하지 않는다', () => {
    const { repair: _omit, ...rest } = R;
    const rec = recommend(board(), P, rest as PolicyConfig);
    expect(rec.all.some((e) => e.move === 'repair')).toBe(false);
  });

  it('가정값이 없으면 REPAIR_PARAMS로 막는다', () => {
    const { repairCostCents: _a, pAcceptRepair: _b, ...rest } = P;
    const rec = recommend(board(), rest as Params, R);
    const repair = rec.all.find((e) => e.move === 'repair');
    expect(repair?.blockedBy).toBe(BLOCKED.repairParams);
    expect(repair?.expectedLossCents).toBeNull();
    expect(rec.best?.move).not.toBe('repair');
  });

  it('오토파일럿: 돈이 움직이지 않으니 seller_review, 승인은 필요', () => {
    const rec = recommend(board(), P, R);
    expect(rec.requiresApproval).toBe(true);
    expect(rec.autopilot.verdict).toBe('awaiting_approval');
    expect(rec.autopilot.rule).toBe('seller_review');
    expect(R.autopilot.moneyMoves).not.toContain('repair');
  });

  it('"Keeps ≈$N" = refund − repair = 3358¢', () => {
    expect(actionSavings(board(), 'repair', P, R)).toBe(3358);
    expect(actionSavings(board('B1'), 'repair', P, R)).toBe(0);
  });

  it('planMove: send_message, 금액 없음, 메시지 필요', () => {
    const b = board();
    const repair = recommend(b, P, R).all.find((e) => e.move === 'repair');
    if (!repair) throw new Error('repair 없음');
    const plan = planMove(b, repair, P, R);
    expect(plan).toMatchObject({ move: 'repair', apiMove: 'send_message', amountCents: null, refundType: null, messageRequired: true });
  });
});
