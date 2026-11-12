/**
 * 정책 판정 (SPEC v2.1 5장 "수 → API", 6장). 숫자 계산은 `oracle.ts`가 하고 여기서는 걸러내고 고른다.
 */
import type { BoardState, Category, Evaluation, MoveType, PolicyConfig, Recommendation, Subtype } from '@/types';

/** 차단 이유. `Evaluation.blockedBy`에 들어간다. */
export const BLOCKED = {
  /** 부분 환불 제안 대상(B1·B2)이 아니다 (SPEC 5장). */
  offerScope: 'OFFER_SCOPE',
  /** 수선 제안 가정값(repairCostCents·pAcceptRepair)이 설정에 없다 (SPEC v2.16). */
  repairParams: 'REPAIR_PARAMS',
  /** 원인이 아직 없어 p_win을 정할 수 없다 (SPEC 5장 p_win, 6장 3번 규칙). */
  noCause: 'NO_CAUSE',
} as const;

/** 동점일 때 고르는 고정 순서 (SPEC 5장). `all`의 순서도 이 순서다. */
export const MOVE_ORDER: readonly Evaluation['move'][] = ['fight', 'offer', 'refund'];

/**
 * 수선 제안을 포함한 평가·동점 순서 (SPEC v2.16). repair는 맨 뒤라 기존 세 수의 순서·동점 결과는 그대로다.
 * `sim.ts`는 세 수만 다루므로 `MOVE_ORDER`를 계속 쓴다.
 */
export const ALL_MOVE_ORDER: readonly Evaluation['move'][] = [...MOVE_ORDER, 'repair'];

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
  if (move === 'repair') return board.allowedMoves.includes('send_message') ? 'send_message' : null;
  const required: MoveType = move === 'offer' ? 'make_offer' : 'accept_claim';
  return board.allowedMoves.includes(required) ? required : null;
}

/** 부분 환불 제안은 색상·사이즈(B1·B2)만 평가한다 (SPEC 5장). */
export function isOfferInScope(board: BoardState, rules: PolicyConfig): boolean {
  const subtype = board.cause?.subtype;
  return subtype !== undefined && rules.offer.eligibleSubtypes.includes(subtype);
}

/**
 * 무료 수선 제안은 `rules.repair.eligibleSubtypes`(B3 품질)만 평가한다 (SPEC v2.16).
 * 규칙에 `repair`가 없으면 어느 유형도 대상이 아니다.
 */
export function isRepairInScope(board: BoardState, rules: PolicyConfig): boolean {
  const subtype = board.cause?.subtype;
  return subtype !== undefined && (rules.repair?.eligibleSubtypes ?? []).includes(subtype);
}

/**
 * SPEC v2.6 9-4 "제안이 먼저": 추천이 제안이고 지금 `make_offer`가 허용돼 있으면 참 —
 * 이때 메시지를 먼저 보내면 안 된다.
 *
 * 판매자가 메시지를 보내면 PayPal은 구매자 답을 기다리는 상태가 되고 `make_offer` 링크가 사라진다
 * (2026-11-10 연습용 분쟁에서 확인). 그래서 제안 추천인 분쟁은 make-offer를 첫 번째 행동으로 보낸다.
 * `make_offer`가 이미 허용돼 있지 않으면 제안할 방법이 없으므로 막을 이유도 없다 (거짓).
 *
 * `recommendation`은 같은 `board`로 만든 것이라고 가정한다. 여기서 다시 계산하지 않는다.
 * 순수 함수 — 입력을 변형하지 않는다. 화면과 앱 서버 코드는 이 결과를 옮기기만 한다 (SPEC 3장).
 */
export function offerComesFirst(board: BoardState, recommendation: Recommendation): boolean {
  return recommendation.best?.move === 'offer' && board.allowedMoves.includes('make_offer');
}

/**
 * 기대 손실이 가장 작은 수. 차단된 수와 계산하지 않은 수는 고르지 않는다.
 * 동점이면 ALL_MOVE_ORDER 순서(fight → offer → refund → repair), 고를 수 없으면 null ("직접 처리").
 */
export function pickBest(all: Evaluation[]): Evaluation | null {
  const candidates = all.filter((e) => e.blockedBy === undefined && e.expectedLossCents !== null);
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) =>
      (a.expectedLossCents as number) - (b.expectedLossCents as number) ||
      ALL_MOVE_ORDER.indexOf(a.move) - ALL_MOVE_ORDER.indexOf(b.move),
  )[0];
}
