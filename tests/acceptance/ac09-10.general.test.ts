/**
 * 인수 테스트 AC9~AC10: 허용된 수 필터, 결정론 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
 * 기준: SPEC v1. 가정값·규칙: params.fixture.json, rules.fixture.json (P, R)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';

import { CARDIGAN, P, R, withCause } from './boards';

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC9 allowedMoves에 없는 수는 평가에서 제외', () => {
  it('make_offer가 없으면 offer 평가가 없고 추천도 offer가 아님', () => {
    const rec = recommend({ ...CARDIGAN, allowedMoves: ['send_message', 'accept_claim'] }, P, R);
    expect(rec.all.map((e) => e.move)).not.toContain('offer');
    expect(rec.best?.move).not.toBe('offer');
  });

  it('accept_claim이 없으면 refund 평가가 없음', () => {
    const rec = recommend({ ...CARDIGAN, allowedMoves: ['send_message', 'make_offer'] }, P, R);
    expect(rec.all.map((e) => e.move)).not.toContain('refund');
  });

  it('allowedMoves가 비어 있으면 best = null (직접 처리), 그래도 승인 필요', () => {
    const rec = recommend({ ...CARDIGAN, allowedMoves: [] }, P, R);
    expect(rec.all).toEqual([]);
    expect(rec.best).toBeNull();
    expect(rec.requiresApproval).toBe(true);
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC10 결정론: 같은 입력 100회 동일 결과', () => {
  afterEach(() => vi.restoreAllMocks());

  const inputs = [
    { name: '원인 B 기본값', board: CARDIGAN, params: P },
    { name: '원인 F p_win 0.55', board: withCause(CARDIGAN, 'F_ABUSE'), params: { ...P, pWinBase: 0.55 } },
  ];

  it.each(inputs)('$name: recommend와 planMove 결과가 100회 모두 같다', ({ board, params }) => {
    const run = () => {
      const rec = recommend(board, params, R);
      const plan = rec.best ? planMove(board, rec.best, params, R) : null;
      return JSON.stringify({ rec, plan });
    };
    const first = run();
    for (let i = 0; i < 100; i++) expect(run()).toBe(first);
  });

  it('난수와 현재 시각을 읽지 않는다', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    const rec = recommend(CARDIGAN, P, R);
    planMove(CARDIGAN, rec.best!, P, R);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const before = JSON.stringify({ CARDIGAN, P, R });
    const params = { ...P, pWinBase: 0.55 };
    const rec = recommend(CARDIGAN, params, R);
    planMove(CARDIGAN, rec.best!, params, R);
    expect(JSON.stringify({ CARDIGAN, P, R })).toBe(before);
  });
});
