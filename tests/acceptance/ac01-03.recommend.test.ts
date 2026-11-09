/**
 * 인수 테스트 AC1~AC3: 기대 손실, 추천, 오토파일럿 판정 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD v2 10-3 + 검토 M1·M2 / 기획자 승인 2026-11-09
 * 기준: SPEC v2 5장·6장. 작업: T004
 * 가정값·규칙: params.fixture.json, rules.fixture.json (P, R). f 800¢, t 200¢, x 0.15, p_acc 0.72
 */
import { describe, expect, it } from 'vitest';

import { recommend } from '@/engine/recommend';
import type { Recommendation } from '@/types';

import { byMove, D1_JIHO, D3_BUYER_M, P, R, withSubtype } from './boards';

/** 분기 확률 합 1, Σ(확률 × 손실) = 기대 손실 (반올림 오차 0.5¢ 이내) */
function expectBranchesConsistent(rec: Recommendation) {
  for (const e of rec.all) {
    if (e.expectedLossCents === null) continue;
    const probSum = e.branches.reduce((s: number, b) => s + b.prob, 0);
    expect(probSum, e.move).toBeCloseTo(1, 9);
    const total = e.branches.reduce((s: number, b) => s + b.prob * b.lossCents, 0);
    expect(Math.abs(total - e.expectedLossCents), e.move).toBeLessThanOrEqual(0.5);
  }
}

// 기대값 출처: PRD v2 10-3 + 검토 M2 / 기획자 승인 2026-11-09
// p_win 0.30 (B1, 추적 기록 무관)
// fight  = 0.7 × (4800 + 800) + 200 = 4120
// offer  = 0.72 × 0.15 × 4800 + 0.28 × 0.7 × 5600 + 200 = 518.4 + 1097.6 + 200 = 1816
// refund = 4800 + 200 = 5000
describe('AC1 D1 박지호: $48, B1 색상', () => {
  const rec: Recommendation = recommend(D1_JIHO, P, R);

  it('fight 4120¢ / offer 1816¢ / refund 5000¢', () => {
    expect(byMove(rec.all, 'fight').expectedLossCents).toBe(4120);
    expect(byMove(rec.all, 'offer').expectedLossCents).toBe(1816);
    expect(byMove(rec.all, 'refund').expectedLossCents).toBe(5000);
  });

  it('추천 offer (make_offer), 사람 승인 필요', () => {
    expect(rec.best?.move).toBe('offer');
    expect(rec.best?.apiMove).toBe('make_offer');
    expect(rec.requiresApproval).toBe(true);
  });

  it('돈이 움직이는 수라 오토파일럿은 승인 대기 (money_moves)', () => {
    expect(rec.autopilot.verdict).toBe('awaiting_approval');
    expect(rec.autopilot.rule).toBe('money_moves');
  });

  it('트리 분기가 기대 손실과 맞다', () => {
    expectBranchesConsistent(rec);
  });
});

// 기대값 출처: PRD v2 10-3·9-1 + 검토 M2 / 기획자 승인 2026-11-09
// p_win 0.80 (F1, 추적·배송 완료 기록)
// fight  = 0.2 × (3500 + 800) + 200 = 1060
// refund = 3500 + 200 = 3700
// offer  = 제안 대상 아님 (B1·B2만)
describe('AC2 D3 buyer_m***: $35, F1 반복 미수령 주장', () => {
  const rec: Recommendation = recommend(D3_BUYER_M, P, R);

  it('fight 1060¢ / refund 3700¢', () => {
    expect(byMove(rec.all, 'fight').expectedLossCents).toBe(1060);
    expect(byMove(rec.all, 'refund').expectedLossCents).toBe(3700);
  });

  it('offer는 제안 대상 아님 (blockedBy "OFFER_SCOPE", expectedLoss null, 분기 없음)', () => {
    const offer = byMove(rec.all, 'offer');
    expect(offer.blockedBy).toBe('OFFER_SCOPE');
    expect(offer.expectedLossCents).toBeNull();
    expect(offer.branches).toEqual([]);
  });

  it('추천 fight (증빙 대응)', () => {
    expect(rec.best?.move).toBe('fight');
  });

  it('오토파일럿은 건너뜀 (suspected_abuse)', () => {
    expect(rec.autopilot.verdict).toBe('skipped');
    expect(rec.autopilot.rule).toBe('suspected_abuse');
  });

  it('트리 분기가 기대 손실과 맞다', () => {
    expectBranchesConsistent(rec);
  });
});

// 기대값 출처: 검토 M2 / 기획자 승인 2026-11-09
describe('AC3 같은 입력에서 세부 유형만 B1 ↔ F1로 바꾸면 오토파일럿 판정이 바뀐다', () => {
  it('D1: B1 → 승인 대기, F1 → 건너뜀', () => {
    expect(recommend(withSubtype(D1_JIHO, 'B1'), P, R).autopilot.verdict).toBe('awaiting_approval');
    expect(recommend(withSubtype(D1_JIHO, 'F1'), P, R).autopilot.verdict).toBe('skipped');
  });

  it('D3: F1 → 건너뜀, B1 → 승인 대기', () => {
    expect(recommend(withSubtype(D3_BUYER_M, 'F1'), P, R).autopilot.verdict).toBe('skipped');
    expect(recommend(withSubtype(D3_BUYER_M, 'B1'), P, R).autopilot.verdict).toBe('awaiting_approval');
  });
});
