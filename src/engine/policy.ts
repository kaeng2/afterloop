/**
 * 정책 판정 (SPEC v2.1 5장 "수 → API", 6장). 숫자 계산은 `oracle.ts`가 하고 여기서는 걸러내고 고른다.
 */
import type { BoardState, Category, Evaluation, MoveType, PolicyConfig, Subtype } from '@/types';

/** 차단 이유. `Evaluation.blockedBy`에 들어간다. */
export const BLOCKED = {
  /** 부분 환불 제안 대상(B1·B2)이 아니다 (SPEC 5장). */
  offerScope: 'OFFER_SCOPE',
  /** 원인이 아직 없어 p_win을 정할 수 없다 (SPEC 5장 p_win, 6장 3번 규칙). */
  noCause: 'NO_CAUSE',
} as const;

/** 동점일 때 고르는 고정 순서 (SPEC 5장). `all`의 순서도 이 순서다. */
export const MOVE_ORDER: readonly Evaluation['move'][] = ['fight', 'offer', 'refund'];

/** 세부 유형의 대분류 (B1 → B). */
export function categoryOf(subtype: Subtype): Category {
  return subtype[0] as Category;
}

/**
 * 다투기의 실행 API (SPEC v2.4 5장 "수 → API" 표 순서).
 * 합의 단계(`INQUIRY`)에서는 `provide_evidence` 링크가 함께 있어도 메시지가 먼저다 (v2.4, Q15:
 * 실제 합의 단계 분쟁에 두 링크가 함께 오고, 증빙 제출은 아직 실행하지 않는다).
 * 그 밖의 단계에서는 증빙 링크가 있으면 provide_evidence, 없으면 send_message.
 * 둘 다 허용되지 않으면 다툴 방법이 없다 (null → `all`에서 뺀다).
 */
export function fightApiMove(board: BoardState): MoveType | null {
  const canSendMessage = board.allowedMoves.includes('send_message');
  if (board.stage === 'INQUIRY' && canSendMessage) return 'send_message';
  if (board.allowedMoves.includes('provide_evidence')) return 'provide_evidence';
  if (canSendMessage) return 'send_message';
  return null;
}

/** 수를 실행할 API (SPEC 5장 표). 허용되지 않으면 null. */
export function apiMoveFor(move: Evaluation['move'], board: BoardState): MoveType | null {
  if (move === 'fight') return fightApiMove(board);
  const required: MoveType = move === 'offer' ? 'make_offer' : 'accept_claim';
  return board.allowedMoves.includes(required) ? required : null;
}

/** 부분 환불 제안은 색상·사이즈(B1·B2)만 평가한다 (SPEC 5장). */
export function isOfferInScope(board: BoardState, rules: PolicyConfig): boolean {
  const subtype = board.cause?.subtype;
  return subtype !== undefined && rules.offer.eligibleSubtypes.includes(subtype);
}

/**
 * 기대 손실이 가장 작은 수. 차단된 수와 계산하지 않은 수는 고르지 않는다.
 * 동점이면 MOVE_ORDER 순서(fight → offer → refund), 고를 수 없으면 null ("직접 처리").
 */
export function pickBest(all: Evaluation[]): Evaluation | null {
  const candidates = all.filter((e) => e.blockedBy === undefined && e.expectedLossCents !== null);
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) =>
      (a.expectedLossCents as number) - (b.expectedLossCents as number) ||
      MOVE_ORDER.indexOf(a.move) - MOVE_ORDER.indexOf(b.move),
  )[0];
}
