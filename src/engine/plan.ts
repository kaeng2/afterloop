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
import type { EngineInput } from './params';
import { apiMoveSchema, moveSchema, resolveEngineInput } from './params';
import { recommend } from './recommend';

/** 계획을 만들 수 없는 평가 (예외 문구). 숫자·구매자 정보는 넣지 않는다. */
const ERROR = {
  blocked: (move: Evaluation['move'], blockedBy: string) =>
    `planMove: ${move} 평가는 차단되어 있어 계획을 만들 수 없습니다 (${blockedBy})`,
  noApiMove: (move: Evaluation['move']) =>
    `planMove: ${move} 평가에 실행 API가 없어 계획을 만들 수 없습니다 (apiMove: null)`,
  noExpectedLoss: (move: Evaluation['move']) =>
    `planMove: ${move} 평가에 기대 손실이 없어 계획을 만들 수 없습니다 (expectedLossCents: null)`,
  apiMoveMismatch: (move: Evaluation['move'], apiMove: string) =>
    `planMove: ${move}는 ${apiMove}로 실행할 수 없습니다 (SPEC 5장 "수 → API")`,
  notThisBoard: (move: Evaluation['move'], apiMove: string, why: string) =>
    `planMove: 평가가 이 보드의 것이 아님 (${move}/${apiMove}: ${why})`,
  offerNotPositive: (move: Evaluation['move']) =>
    `planMove: ${move} 제안 금액이 0¢ 이하여서 계획을 만들 수 없습니다 (제안률·분쟁 금액 확인)`,
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
 * - repair → `send_message`, 금액 없음, 메시지 필요 (v2.16)
 * - fight → 평가의 실행 API(`provide_evidence` 또는 `send_message`), 금액 없음, 메시지 필요
 */
function movePlan(board: BoardState, evaluation: Evaluation, params: Params, apiMove: NonNullable<Evaluation['apiMove']>): MovePlan {
  if (evaluation.move === 'offer') {
    if (apiMove !== 'make_offer') throw new Error(ERROR.apiMoveMismatch(evaluation.move, apiMove));
    const amountCents = offerAmountCents(board, params);
    // 0¢ 제안은 구매자에게 보낼 수 없는 계획이다 (x = 0이거나 x·A < 0.5¢인 아주 작은 분쟁).
    if (amountCents <= 0) throw new Error(ERROR.offerNotPositive(evaluation.move));
    return {
      apiMove,
      amountCents,
      refundType: 'REFUND',
      messageRequired: false,
    };
  }

  if (evaluation.move === 'refund') {
    if (apiMove !== 'accept_claim') throw new Error(ERROR.apiMoveMismatch(evaluation.move, apiMove));
    return { apiMove, amountCents: board.amountCents, refundType: 'REFUND', messageRequired: false };
  }

  // repair(v2.16): 무료 수선 안내 메시지만 보낸다. 돈이 움직이지 않는다.
  if (evaluation.move === 'repair') {
    if (apiMove !== 'send_message') throw new Error(ERROR.apiMoveMismatch(evaluation.move, apiMove));
    return { apiMove, amountCents: null, refundType: null, messageRequired: true };
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
 * 넘겨받은 평가가 **이 보드의 평가인지** 확인한다 (T018).
 *
 * 평가는 화면이 만들어 넘길 수도 있고, 분쟁을 다시 불러온 뒤 예전 보드의 평가가 섞일 수도 있다.
 * 그래서 같은 보드·가정값·규칙으로 `recommend`를 다시 돌려, 같은 수의 평가가 지금도
 * ① 있고 ② 같은 실행 API이고 ③ 차단되지 않았는지(`blockedBy`·`expectedLossCents`) 본다.
 * 이것으로 제안 대상이 아닌 유형(A1 등)의 offer, 원인 없는 보드, `allowedMoves`에 없는 수가 함께 막힌다.
 *
 * `expectedLossCents` 값까지 같은지는 보지 않는다: 인수 테스트 AC4가 x 0.15로 만든 평가를 x 0.20으로
 * 넘겨 계획을 만든다 (금액은 평가가 아니라 지금 보드·가정값에서 나온다). 보고서에 적어 두었다.
 */
function assertEvaluationFromBoard(input: EngineInput, evaluation: Evaluation, apiMove: NonNullable<Evaluation['apiMove']>): void {
  const current = recommend(input.board, input.params, input.rules).all.find((e) => e.move === evaluation.move);

  if (current === undefined) {
    throw new Error(ERROR.notThisBoard(evaluation.move, apiMove, '이 보드에서 둘 수 없는 수'));
  }
  if (current.blockedBy !== undefined) {
    throw new Error(ERROR.notThisBoard(evaluation.move, apiMove, current.blockedBy));
  }
  if (current.expectedLossCents === null) {
    throw new Error(ERROR.notThisBoard(evaluation.move, apiMove, '이 보드에서 계산되지 않는 수'));
  }
  if (current.apiMove !== apiMove) {
    throw new Error(ERROR.notThisBoard(evaluation.move, apiMove, `이 보드의 실행 API는 ${current.apiMove}`));
  }
}

/**
 * 승인용 실행 계획 1건. params·rules를 넘기지 않으면 config/params.json·config/rules.json을 읽는다.
 * 차단된 평가(`blockedBy`)나 실행 API가 없는 평가(`apiMove: null`), 기대 손실이 없는 평가
 * (`expectedLossCents: null`), 이 보드의 것이 아닌 평가면 예외를 던진다.
 */
export const planMove: PlanMoveFn = (board, evaluation, params, rules) => {
  const input = resolveEngineInput(board, params, rules);
  const checked = EvaluationSchema.parse(evaluation) as Evaluation;

  if (checked.blockedBy !== undefined) throw new Error(ERROR.blocked(checked.move, checked.blockedBy));
  if (checked.apiMove === null) throw new Error(ERROR.noApiMove(checked.move));
  // 계산되지 않은 수(`expectedLossCents: null`)는 `blockedBy`가 없어도 계획을 만들지 않는다
  // (T018 검증 보고 "발견한 문제" 1. 값의 크기는 대조하지 않는다 — 그 이유는 위 함수 주석).
  if (checked.expectedLossCents === null) throw new Error(ERROR.noExpectedLoss(checked.move));
  assertEvaluationFromBoard(input, checked, checked.apiMove);

  const parts = {
    disputeId: input.board.disputeId,
    move: checked.move,
    ...movePlan(input.board, checked, input.params, checked.apiMove),
  };

  return { planId: planIdFor(parts), ...parts, currency: 'USD', requiresApproval: true };
};
