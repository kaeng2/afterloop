/**
 * 인수 테스트 AC5·AC6·AC8: 제안 대상, 오토파일럿 건너뜀 규칙, 수 → API (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD v2 10-3·10-6 + 검토 M2·M7 / 기획자 승인 2026-11-09
 * 기준: SPEC v2 5장·6장. 작업: T004
 */
import { describe, expect, it } from 'vitest';

import { recommend } from '@/engine/recommend';
import type { BoardState } from '@/types';

import { byMove, D1_JIHO, P, R, withSubtype } from './boards';

// 기대값 출처: PRD v2 10-3 ("색상·사이즈 유형만") / 기획자 승인 2026-11-09
describe('AC5 부분 환불 제안은 B1·B2만', () => {
  it('B2(사이즈)는 offer를 평가한다', () => {
    const offer = byMove(recommend(withSubtype(D1_JIHO, 'B2'), P, R).all, 'offer');
    expect(offer.blockedBy).toBeUndefined();
    expect(typeof offer.expectedLossCents).toBe('number');
  });

  it.each([['A2'], ['B3']] as const)('%s는 제안 대상 아님 (OFFER_SCOPE)', (subtype) => {
    const offer = byMove(recommend(withSubtype(D1_JIHO, subtype), P, R).all, 'offer');
    expect(offer.blockedBy).toBe('OFFER_SCOPE');
    expect(offer.expectedLossCents).toBeNull();
    expect(offer.branches).toEqual([]);
  });
});

// 기대값 출처: PRD v2 10-6 / 기획자 승인 2026-11-09
describe('AC6 오토파일럿 건너뜀 규칙', () => {
  it('카드사 분쟁(EXTERNAL) → 건너뜀 (card_company_case)', () => {
    const rec = recommend({ ...D1_JIHO, channel: 'EXTERNAL' }, P, R);
    expect(rec.autopilot.verdict).toBe('skipped');
    expect(rec.autopilot.rule).toBe('card_company_case');
  });

  it('확신도 0.69 → 건너뜀 (low_confidence)', () => {
    const rec = recommend(withSubtype(D1_JIHO, 'B1', 0.69), P, R);
    expect(rec.autopilot.verdict).toBe('skipped');
    expect(rec.autopilot.rule).toBe('low_confidence');
  });

  it('확신도 0.70 → 건너뛰지 않음', () => {
    expect(recommend(withSubtype(D1_JIHO, 'B1', 0.7), P, R).autopilot.verdict).not.toBe('skipped');
  });

  it('F2(부분환불 노림) → 건너뜀 (suspected_abuse)', () => {
    const rec = recommend(withSubtype(D1_JIHO, 'F2'), P, R);
    expect(rec.autopilot.verdict).toBe('skipped');
    expect(rec.autopilot.rule).toBe('suspected_abuse');
  });
});

// 기대값 출처: SPEC v2 5장 (사전 확인: 합의 단계에는 provide_evidence 링크가 없음) / 기획자 승인 2026-11-09
describe('AC8 수 → API', () => {
  it('합의 단계(증빙 링크 없음): fight는 send_message', () => {
    expect(byMove(recommend(D1_JIHO, P, R).all, 'fight').apiMove).toBe('send_message');
  });

  it('클레임 단계(증빙 링크 있음): fight는 provide_evidence', () => {
    const board: BoardState = {
      ...D1_JIHO,
      stage: 'CHARGEBACK',
      allowedMoves: ['provide_evidence', 'send_message', 'make_offer', 'accept_claim'],
    };
    expect(byMove(recommend(board, P, R).all, 'fight').apiMove).toBe('provide_evidence');
  });
});
