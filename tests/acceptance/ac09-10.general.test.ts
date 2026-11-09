/**
 * 인수 테스트 AC9~AC10 (recommend): 허용된 수 필터, 결정론 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD v2 10-3 / 기획자 승인 2026-11-09
 * 기준: SPEC v2 5장. 작업: T004
 * (planMove 결정론은 ac04.plan, 확대 위험 결정론은 ac07.escalation)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { recommend } from '@/engine/recommend';

import type { Evaluation } from '@/types';

import { D1_JIHO, D3_BUYER_M, P, R } from './boards';

// 기대값 출처: SPEC v2 5장 / 기획자 승인 2026-11-09
describe('AC9 allowedMoves에 없는 수는 평가에서 제외', () => {
  it('make_offer가 없으면 offer 평가가 없고 추천도 offer가 아님', () => {
    const rec = recommend({ ...D1_JIHO, allowedMoves: ['send_message', 'accept_claim'] }, P, R);
    expect(rec.all.map((e: Evaluation) => e.move)).not.toContain('offer');
    expect(rec.best?.move).not.toBe('offer');
  });

  it('accept_claim이 없으면 refund 평가가 없음', () => {
    const rec = recommend({ ...D1_JIHO, allowedMoves: ['send_message', 'make_offer'] }, P, R);
    expect(rec.all.map((e: Evaluation) => e.move)).not.toContain('refund');
  });

  it('allowedMoves가 비어 있으면 best = null (직접 처리), 그래도 승인 필요', () => {
    const rec = recommend({ ...D1_JIHO, allowedMoves: [] }, P, R);
    expect(rec.all).toEqual([]);
    expect(rec.best).toBeNull();
    expect(rec.requiresApproval).toBe(true);
  });
});

// 기대값 출처: PRD v2 9-1 ("같은 입력이면 항상 같은 결과") / 기획자 승인 2026-11-09
describe('AC10 결정론 (recommend)', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['D1 박지호', D1_JIHO],
    ['D3 buyer_m', D3_BUYER_M],
  ])('%s: 100회 모두 같은 결과', (_name, board) => {
    const first = JSON.stringify(recommend(board, P, R));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(recommend(board, P, R))).toBe(first);
  });

  it('난수와 현재 시각을 읽지 않는다', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    recommend(D1_JIHO, P, R);
    recommend(D3_BUYER_M, P, R);
    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const before = JSON.stringify({ D1_JIHO, P, R });
    recommend(D1_JIHO, { ...P, pAccept: 0.5 }, R);
    expect(JSON.stringify({ D1_JIHO, P, R })).toBe(before);
  });
});
