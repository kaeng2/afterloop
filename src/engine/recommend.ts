/**
 * 수 목록 → 평가 → 추천. LLM 출력은 여기서 쓰지 않는다 (원인 분류 결과는 board.cause로만 들어온다).
 */
import { evaluateAll } from './oracle';
import { resolveParams } from './params';
import { adjustParams, applyRules, needsSellerReview, strictCause } from './rules';
import type { BoardState, Evaluation, Params, Recommendation } from './types';

/** 동점일 때 고르는 고정 순서 */
export const MOVE_ORDER: readonly Evaluation['move'][] = ['fight', 'offer', 'refund'];

/** 기대 손실이 가장 작은 수. 동점이면 MOVE_ORDER 순서. 평가 가능한 수가 없으면 null. */
export function pickBest(evals: Evaluation[]): Evaluation | null {
  const candidates = evals.filter((e) => e.expectedLossCents !== null && !e.blockedBy);
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) =>
      (a.expectedLossCents as number) - (b.expectedLossCents as number) ||
      MOVE_ORDER.indexOf(a.move) - MOVE_ORDER.indexOf(b.move),
  )[0];
}

/** 분쟁 1건에 대한 추천. 실행은 항상 판매자 승인 후 (requiresApproval: true). */
export function recommend(board: BoardState, overrides: Partial<Params> = {}): Recommendation {
  const requested = resolveParams(overrides);
  const params = adjustParams(board, requested);
  const { evals: all, appliedRules } = applyRules(board, evaluateAll(board, params), requested);
  const best = pickBest(all);
  return {
    best,
    all,
    requiresApproval: true,
    status: best ? 'ready' : 'manual',
    needsSellerReview: needsSellerReview(board),
    strictApproval: strictCause(board) || best?.apiMove === 'accept_claim',
    appliedRules,
  };
}
