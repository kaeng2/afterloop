/**
 * 실행 계획 (SPEC v2.1 5장 "수 → API", 6장 제안률, 9-1장). 공개 함수는 `planMove` 하나다.
 *
 * 판매자에게 보여 주고 승인되면 실행 레인(`executeMove`)이 그대로 실행하는 계획이다.
 * **금액(amountCents)을 정하는 곳은 여기뿐이다.** 제안 금액은 `oracle.ts`가 기대 손실에 쓰는
 * 함수(`offerAmountCents`)에서 그대로 가져오므로, 화면의 기대 손실과 실제 제안 금액이 어긋나지 않는다.
 *
 * 입력(보드·가정값·규칙)은 `recommend`와 같은 zod 검증을 거친다. `Math.random`·`Date`·
 * `performance.now`를 읽지 않으므로 같은 입력이면 항상 같은 계획(planId 포함)이 나온다.
 * 입력 객체는 바꾸지 않는다.
 */
import { z } from 'zod';

import type { ActionPlan, BoardState, Evaluation, Params, PlanMoveFn } from '@/types';

import { offerAmountCents } from './oracle';
import { apiMoveSchema, moveSchema, resolveEngineInput } from './params';

/** 계획을 만들 수 없는 평가 (예외 문구). 숫자·구매자 정보는 넣지 않는다. */
const ERROR = {
  blocked: (move: Evaluation['move'], blockedBy: string) =>
    `planMove: ${move} 평가는 차단되어 있어 계획을 만들 수 없습니다 (${blockedBy})`,
  noApiMove: (move: Evaluation['move']) =>
    `planMove: ${move} 평가에 실행 API가 없어 계획을 만들 수 없습니다 (apiMove: null)`,
  apiMoveMismatch: (move: Evaluation['move'], apiMove: string) =>
    `planMove: ${move}는 ${apiMove}로 실행할 수 없습니다 (SPEC 5장 "수 → API")`,
} as const;

/**
 * 평가는 엔진 안에서 온 값이지만 화면이 직접 만들어 넘길 수도 있으므로 모양을 검증한다.
 * 수·실행 API는 `params.ts`의 같은 스키마를 쓴다.
 */
const EvaluationSchema = z.object({
  move: moveSchema,
  apiMove: apiMoveSchema.nullable(),
  expectedLossCents: z.number().int().nonnegative().nullable(),
  blockedBy: z.string().optional(),
  branches: z.array(z.object({ label: z.string(), prob: z.number(), lossCents: z.number() })),
});

/** 수별 실행 계획 (SPEC 5장 표 + 9-1장). fight만 메시지가 따로 필요하다. */
type MovePlan = Pick<ActionPlan, 'apiMove' | 'amountCents' | 'refundType' | 'messageRequired'>;

/**
 * SPEC 5장 표대로 수를 계획으로 바꾼다.
 * - offer → `make_offer`, 금액 x·A, `REFUND` (안내 문구는 make-offer의 `note`로 가므로 메시지 불필요)
 * - refund → `accept_claim`, 금액 A, `REFUND`
 * - fight → 평가의 실행 API(`provide_evidence` 또는 `send_message`), 금액 없음, 메시지 필요
 */
function movePlan(board: BoardState, evaluation: Evaluation, params: Params, apiMove: NonNullable<Evaluation['apiMove']>): MovePlan {
  if (evaluation.move === 'offer') {
    if (apiMove !== 'make_offer') throw new Error(ERROR.apiMoveMismatch(evaluation.move, apiMove));
    return {
      apiMove,
      amountCents: offerAmountCents(board, params),
      refundType: 'REFUND',
      messageRequired: false,
    };
  }

  if (evaluation.move === 'refund') {
    if (apiMove !== 'accept_claim') throw new Error(ERROR.apiMoveMismatch(evaluation.move, apiMove));
    return { apiMove, amountCents: board.amountCents, refundType: 'REFUND', messageRequired: false };
  }

  if (apiMove !== 'provide_evidence' && apiMove !== 'send_message') {
    throw new Error(ERROR.apiMoveMismatch(evaluation.move, apiMove));
  }
  return { apiMove, amountCents: null, refundType: null, messageRequired: true };
}

/**
 * 계획 식별자. 같은 입력이면 항상 같은 문자열이고, 분쟁·수·실행 API·금액·환불 종류 중 하나라도
 * 다르면 다른 문자열이다 (난수·시각·전역 상태를 쓰지 않는다).
 *
 * 형식: `plan-<disputeId>-<move>-<apiMove>-<금액|none>-<환불종류|none>`
 * 예: `plan-PP-R-TEST-D1-offer-make_offer-720-refund`
 *
 * 뒤에서부터 네 조각이 수·실행 API·금액·환불 종류로 고정이고 그 앞이 분쟁 ID라서,
 * 분쟁 ID에 하이픈이 있어도 두 계획의 문자열이 겹치지 않는다.
 */
function planIdFor(plan: Omit<ActionPlan, 'planId' | 'requiresApproval' | 'currency'>): string {
  const amount = plan.amountCents === null ? 'none' : String(plan.amountCents);
  const refundType = plan.refundType === null ? 'none' : plan.refundType.toLowerCase();
  return `plan-${plan.disputeId}-${plan.move}-${plan.apiMove}-${amount}-${refundType}`;
}

/**
 * 승인용 실행 계획 1건. params·rules를 넘기지 않으면 config/params.json·config/rules.json을 읽는다.
 * 차단된 평가(`blockedBy`)나 실행 API가 없는 평가(`apiMove: null`)면 예외를 던진다.
 */
export const planMove: PlanMoveFn = (board, evaluation, params, rules) => {
  const input = resolveEngineInput(board, params, rules);
  const checked = EvaluationSchema.parse(evaluation) as Evaluation;

  if (checked.blockedBy !== undefined) throw new Error(ERROR.blocked(checked.move, checked.blockedBy));
  if (checked.apiMove === null) throw new Error(ERROR.noApiMove(checked.move));

  const parts = {
    disputeId: input.board.disputeId,
    move: checked.move,
    ...movePlan(input.board, checked, input.params, checked.apiMove),
  };

  return { planId: planIdFor(parts), ...parts, currency: 'USD', requiresApproval: true };
};
