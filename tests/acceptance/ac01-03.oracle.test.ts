/**
 * 인수 테스트 AC1~AC3: 기대 손실과 원인별 추천 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
 * 기준: SPEC v1. 계산식: SPEC.md 3장 (PRD 6-2). 반올림은 마지막에 사사오입.
 * 가정값·규칙: params.fixture.json, rules.fixture.json (P, R)
 */
import { describe, expect, it } from 'vitest';

import { recommend } from '@/engine/recommend';

import { byMove, CARDIGAN, P, R, withCause } from './boards';

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
// fight = 0.6·(4800+1500) + 1000 + 0.5·6000 = 7780
// offer = 0.725·(720+1200) + 0.275·7780 + 500 = 4031.5 → 4032 (PRD 화면값 4178은 p_acc 0.7 반올림값이라 쓰지 않음)
// refund = 4800 + 0.15·6000 = 5700
describe('AC1 가디건 $48, 원인 B, 기본 가정값', () => {
  const rec = recommend(CARDIGAN, P, R);

  it('fight 7780¢', () => {
    expect(byMove(rec.all, 'fight').expectedLossCents).toBe(7780);
  });

  it('offer 4032¢ (계산식 값 4031.5¢ 사사오입)', () => {
    expect(byMove(rec.all, 'offer').expectedLossCents).toBe(4032);
  });

  it('refund 5700¢', () => {
    expect(byMove(rec.all, 'refund').expectedLossCents).toBe(5700);
  });

  it('추천 offer (make_offer), 사람 승인 필요', () => {
    expect(rec.best?.move).toBe('offer');
    expect(rec.best?.apiMove).toBe('make_offer');
    expect(rec.requiresApproval).toBe(true);
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
// 원인 F → V = 0. fight = 0.45·6300 + 1000 = 3835, refund = 4800, offer는 R4로 차단
describe('AC2 같은 분쟁, 원인 F (p_win 0.55, V = 0)', () => {
  const board = { ...withCause(CARDIGAN, 'F_ABUSE'), hasDeliveredTracking: true };
  const rec = recommend(board, { ...P, pWinBase: 0.55 }, R);

  it('fight 3835¢', () => {
    expect(byMove(rec.all, 'fight').expectedLossCents).toBe(3835);
  });

  it('offer는 R4로 차단 (expectedLoss null, blockedBy "R4")', () => {
    const offer = byMove(rec.all, 'offer');
    expect(offer.expectedLossCents).toBeNull();
    expect(offer.blockedBy).toBe('R4');
  });

  it('refund 4800¢ (V를 따로 넘기지 않아도 원인 F이면 V = 0)', () => {
    expect(byMove(rec.all, 'refund').expectedLossCents).toBe(4800);
  });

  it('추천 fight', () => {
    expect(rec.best?.move).toBe('fight');
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
// 같은 가정값에서 원인 F: fight = 0.6·6300 + 1000 = 4780 < refund 4800, offer 차단 → fight
describe('AC3 원인만 B ↔ F로 바꾸면 추천이 바뀐다', () => {
  it('B → offer, F → fight', () => {
    const b = recommend(withCause(CARDIGAN, 'B_EXPECTATION'), P, R);
    const f = recommend(withCause(CARDIGAN, 'F_ABUSE'), P, R);
    expect(b.best?.move).toBe('offer');
    expect(f.best?.move).toBe('fight');
  });
});
