/**
 * 승인된 수 실행 (SPEC v2.1 9-1장, T008 + 보강 T027).
 *
 * 판매자가 승인한 `ActionPlan`을 PayPal 요청 1건으로 바꿔 보낸다.
 * - 승인이 없거나 맞지 않으면 **네트워크 호출 전에** 거부한다 (호출 0회).
 * - 거부 검사를 모두 끝낸 **뒤에** 중복 승인 기억을 본다: 이미 성공한 계획이어도 지금 입력이 거부 대상이면 거부한다.
 * - 메시지 안 금액과 API 본문 금액은 같은 센트 값에서 나온다 (`amount.ts`).
 * - 금액을 계산하지 않는다. 엔진이 `plan`에 넣어 준 값만 쓴다.
 * - 2xx 정수 상태 코드만 성공으로 보고, 성공만 기억한다.
 * - 결과·문구에 응답 본문·토큰·구매자 개인정보를 넣지 않는다 (문구는 `copy.ts`).
 */
import type { ExecuteInput, ExecuteMoveFn, ExecuteResult, PayPalCaller } from '@/types';

import { EXEC_COPY, format, type Rejection } from './copy';
import { fillMessage } from './message';
import { buildRequest } from './request';

function reject(error: string, nextAction: string): ExecuteResult {
  return { ok: false, error, nextAction };
}

function rejectWith({ error, nextAction }: Rejection): ExecuteResult {
  return reject(error, nextAction);
}

/**
 * 이미 성공한 계획 (SPEC 9-1장 중복 승인). 프로세스 메모리 기준이고,
 * 주입된 `call`(= 클라이언트 1개)별로 기억한다. 서버 쪽 중복은 PayPal-Request-Id가 막는다.
 */
const succeeded = new WeakMap<PayPalCaller, Map<string, ExecuteResult>>();

function remember(call: PayPalCaller, planId: string, result: ExecuteResult): void {
  const byPlan = succeeded.get(call) ?? new Map<string, ExecuteResult>();
  byPlan.set(planId, result);
  succeeded.set(call, byPlan);
}

/** 센트 정수가 아니면 표기를 만들 수 없다 (호출 전에 거부). */
function hasIntegerAmounts({ board, plan }: ExecuteInput): boolean {
  if (!Number.isInteger(board.amountCents)) return false;
  return plan.amountCents === null || Number.isInteger(plan.amountCents);
}

/** PayPal이 2xx 정수로 답했을 때만 성공이다 (`status`가 없거나 수가 아니면 실패). */
function isSent(status: unknown): status is number {
  return Number.isInteger(status) && (status as number) >= 200 && (status as number) < 300;
}

export const executeMove: ExecuteMoveFn = async (input, deps) => {
  const { board, plan, messageTemplate, approval } = input;

  // 1. 승인 (호출 0회)
  if (approval === null) return reject(EXEC_COPY.approvalMissing, EXEC_COPY.nextApprove);
  if (approval.planId !== plan.planId) return reject(EXEC_COPY.approvalMismatch, EXEC_COPY.nextApprove);

  // 2. 보낼 수 있는 수인지 (호출 0회)
  if (plan.disputeId !== board.disputeId) return reject(EXEC_COPY.disputeMismatch, EXEC_COPY.nextFixPlan);
  if (plan.apiMove === 'provide_evidence') return reject(EXEC_COPY.evidenceUnsupported, EXEC_COPY.nextEvidence);
  if (!board.allowedMoves.includes(plan.apiMove)) {
    const allowed = board.allowedMoves.join(', ') || EXEC_COPY.allowedNone;
    return reject(format(EXEC_COPY.moveNotAllowed, { apiMove: plan.apiMove, allowed }), EXEC_COPY.nextFixPlan);
  }
  if (plan.apiMove === 'accept_claim' && approval.confirmAcceptClaim !== true) {
    return reject(EXEC_COPY.acceptClaimUnconfirmed, EXEC_COPY.nextConfirm);
  }
  if (!hasIntegerAmounts(input)) return reject(EXEC_COPY.amountNotInteger, EXEC_COPY.nextFixPlan);

  // 3. 자리표시자 채우기 (메시지 안 금액 = 본문 금액, 남은 토큰·빈 메시지 거부)
  const filled = fillMessage(messageTemplate, plan, board);
  if (!filled.ok) return rejectWith(filled);

  // 4. 요청 1건 만들기
  const built = buildRequest(plan, filled.message);
  if (!built.ok) return rejectWith(built);

  // 5. 중복 승인: 거부 검사를 모두 통과한 뒤에만 이전 성공 결과를 돌려준다 (호출 0회)
  const previous = succeeded.get(deps.call)?.get(plan.planId);
  if (previous !== undefined) return previous;

  // 6. 호출 1회
  let response: { status: number; body: unknown } | undefined;
  try {
    response = await deps.call(built.request);
  } catch {
    return reject(
      format(EXEC_COPY.callErrored, { endpoint: built.endpoint }),
      format(EXEC_COPY.nextRetry, { endpoint: built.endpoint }),
    );
  }

  const status: unknown = response?.status;
  if (!isSent(status)) {
    const error = Number.isInteger(status)
      ? format(EXEC_COPY.callFailed, { endpoint: built.endpoint, status: status as number })
      : format(EXEC_COPY.callNoStatus, { endpoint: built.endpoint });
    return reject(error, format(EXEC_COPY.nextCheckPayPal, { endpoint: built.endpoint }));
  }

  const result: ExecuteResult = { ok: true, sent: [{ path: built.request.path, status }] };
  remember(deps.call, plan.planId, result);
  return result;
};
