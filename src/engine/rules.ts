/**
 * 정책 규칙 (PRD S7). 결정론적 코드만 둔다.
 *
 *   R1: 금액 $50 이하이고 원인 B → 제안 비율 최대 20%
 *   R2: 금액 $150 이상 → 환불은 반품 조건 필수 (REFUND_WITH_RETURN)
 *   R3: 원인 A이고 배송 완료 추적 있음 → 증빙 제출 + 안내 메시지 (offer·refund 차단)
 *   R4: 원인 F 또는 90일 내 분쟁 2회 이상 구매자 → 제안 금지
 *   R5: channel = EXTERNAL → 협상(제안) 없이 증빙 대응
 *   공통: allowedMoves에 없는 수는 평가에서 제외 (G1), 원인 E·F와 accept_claim은 엄격 승인 (G3)
 *
 * 한 수에 차단 규칙이 여럿 걸리면 blockedBy에는 R4 → R5 → R3 순서로 처음 걸린 것을 적고,
 * 걸린 규칙 전체는 appliedRules에 남긴다.
 */
import type { BoardState, Evaluation, Params, RefundType } from './types';

export const R1_MAX_AMOUNT_CENTS = 5000;
export const R1_MAX_OFFER_RATE = 0.2;
export const R2_RETURN_REQUIRED_FROM_CENTS = 15000;
export const R4_REPEAT_DISPUTE_THRESHOLD = 2;

export const r1Applies = (b: BoardState) =>
  b.amountCents <= R1_MAX_AMOUNT_CENTS && b.cause?.rootCause === 'B_EXPECTATION';
export const r2Applies = (b: BoardState) => b.amountCents >= R2_RETURN_REQUIRED_FROM_CENTS;
export const r3Applies = (b: BoardState) => b.cause?.rootCause === 'A_DELIVERY' && b.hasDeliveredTracking;
export const r4Applies = (b: BoardState) =>
  b.cause?.rootCause === 'F_ABUSE' || b.buyerDisputeCount90d >= R4_REPEAT_DISPUTE_THRESHOLD;
export const r5Applies = (b: BoardState) => b.channel === 'EXTERNAL';

/** 계산 전에 가정값을 규칙에 맞춘다 (R1). 입력 params는 바꾸지 않는다. */
export function adjustParams(board: BoardState, params: Params): Params {
  if (r1Applies(board) && params.offerRate > R1_MAX_OFFER_RATE) {
    return { ...params, offerRate: R1_MAX_OFFER_RATE };
  }
  return params;
}

/** 차단 규칙 목록 (우선순위 순) */
function blockingRules(board: BoardState, move: Evaluation['move']): string[] {
  const rules: string[] = [];
  if (move === 'offer' && r4Applies(board)) rules.push('R4');
  if (move === 'offer' && r5Applies(board)) rules.push('R5');
  if ((move === 'offer' || move === 'refund') && r3Applies(board)) rules.push('R3');
  return rules;
}

export type RuleResult = { evals: Evaluation[]; appliedRules: string[] };

/**
 * 오라클 평가에 규칙을 적용한다.
 * - allowedMoves에 없는 수는 목록에서 제외 (실행할 수 없는 수)
 * - 차단된 수는 목록에 남기되 expectedLossCents null, branches [], blockedBy 규칙 ID
 */
export function applyRules(board: BoardState, evals: Evaluation[], requestedParams?: Params): RuleResult {
  const applied = new Set<string>();
  const refundType: RefundType = r2Applies(board) ? 'REFUND_WITH_RETURN' : 'REFUND';

  const out = evals
    .filter((e) => e.apiMove !== null && board.allowedMoves.includes(e.apiMove))
    .map((e): Evaluation => {
      let next: Evaluation = { ...e };
      if (e.move === 'offer' || e.move === 'refund') {
        next.offerType = refundType;
        if (refundType === 'REFUND_WITH_RETURN') applied.add('R2');
      }
      if (e.move === 'refund') next.strictApproval = true;
      if (e.move === 'fight') next.attachMessage = r3Applies(board) && !r5Applies(board);
      if (e.move === 'offer' && requestedParams && e.offerRate !== requestedParams.offerRate) applied.add('R1');

      const blocks = blockingRules(board, e.move);
      if (blocks.length > 0) {
        blocks.forEach((r) => applied.add(r));
        next = { ...next, expectedLossCents: null, blockedBy: blocks[0], branches: [] };
      }
      return next;
    });

  if (r3Applies(board)) applied.add('R3');
  if (r5Applies(board)) applied.add('R5');
  return { evals: out, appliedRules: [...applied].sort() };
}

/** 원인 E·F는 엄격 승인 대상 (G3) */
export const strictCause = (b: BoardState) =>
  b.cause?.rootCause === 'E_FRAUD' || b.cause?.rootCause === 'F_ABUSE';

/** 원인 분류가 없거나 needsReview이면 판매자 확인 필요 (G4) */
export const needsSellerReview = (b: BoardState) => !b.cause || b.cause.needsReview;
