/**
 * 인수 테스트 AC35: B3 품질 분쟁의 새 선택지 repair (무료 수선, 왕복 배송비 손님 부담) — 잠금 파일, 실행만 한다
 * 기대값 출처: 사람 결정 2026-11-12 20:35 (계약·인수 테스트 추가 승인), SPEC v2.16. 작업: T120
 * 가정값: params.fixture.json repairCostCents 700¢(≈$7, 시안 v6), pAcceptRepair 0.8, f 1500¢, t 200¢
 *
 * 공식 (offer와 같은 꼴, 수선은 돈이 아니라 수선비가 든다):
 *   repair = pAcceptRepair × repairCost + (1 − pAcceptRepair) × (1 − pWin) × (a + f) + t
 * D1 박지호 $48를 B3로: pWin(B3) 0.30
 *   fight  = 0.7 × 6300 + 200 = 4610
 *   refund = 4800 + 200 = 5000
 *   repair = 0.8 × 700 + 0.2 × 0.7 × 6300 + 200 = 560 + 882 + 200 = 1642
 *   분기: 수락 0.8 → 700+200 = 900 / 거절·승 0.06 → 200 / 거절·패 0.14 → 6500  (Σ = 1642)
 *   "Keeps ≈$N" = refund − repair = 3358¢ (엔진 값)
 */
import { describe, expect, it } from 'vitest';

import { recommend } from '@/engine/recommend';

import { byMove, D1_JIHO, P, R, withSubtype } from './boards';

describe('AC35 repair (B3 품질)', () => {
  const rec = recommend(withSubtype(D1_JIHO, 'B3'), P, R);

  it('fight 4610¢ / refund 5000¢ / repair 1642¢, offer는 B3 대상 아님', () => {
    expect(byMove(rec.all, 'fight').expectedLossCents).toBe(4610);
    expect(byMove(rec.all, 'refund').expectedLossCents).toBe(5000);
    expect(byMove(rec.all, 'repair').expectedLossCents).toBe(1642);
    const offer = rec.all.find((e) => e.move === 'offer');
    expect(offer === undefined || offer.expectedLossCents === null).toBe(true);
  });

  it('추천 repair, 실행은 send_message (돈이 움직이지 않는다), 사람 승인 필요', () => {
    expect(rec.best?.move).toBe('repair');
    expect(rec.best?.apiMove).toBe('send_message');
    expect(rec.requiresApproval).toBe(true);
  });

  it('분기 확률 합 1, Σ = 기대 손실', () => {
    const e = byMove(rec.all, 'repair');
    expect(e.branches.reduce((s, b) => s + b.prob, 0)).toBeCloseTo(1, 9);
    const total = e.branches.reduce((s, b) => s + b.prob * b.lossCents, 0);
    expect(Math.abs(total - 1642)).toBeLessThanOrEqual(0.5);
  });

  it('B1(색상)에는 repair를 만들지 않는다 (AC1 그대로)', () => {
    const b1 = recommend(D1_JIHO, P, R);
    const r = b1.all.find((e) => e.move === 'repair');
    expect(r === undefined || r.expectedLossCents === null).toBe(true);
    expect(b1.best?.move).toBe('offer');
  });

  it('결정론: 같은 입력 20회 → 같은 결과', () => {
    const first = JSON.stringify(recommend(withSubtype(D1_JIHO, 'B3'), P, R));
    for (let i = 0; i < 20; i += 1) expect(JSON.stringify(recommend(withSubtype(D1_JIHO, 'B3'), P, R))).toBe(first);
  });
});
