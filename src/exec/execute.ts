/**
 * 승인된 수 실행 (SPEC v2.1 9-1장, T008).
 *
 * 판매자가 승인한 `ActionPlan`을 PayPal 요청 1건으로 바꿔 보낸다.
 * - 승인이 없거나 맞지 않으면 **네트워크 호출 전에** 거부한다 (호출 0회).
 * - 메시지 안 금액과 API 본문 금액은 같은 센트 값에서 나온다 (`amount.ts`).
 * - 금액을 계산하지 않는다. 엔진이 `plan`에 넣어 준 값만 쓴다.
 * - 결과·문구에 토큰과 구매자 개인정보를 넣지 않는다.
 */
import type { ExecuteInput, ExecuteMoveFn, ExecuteResult, PayPalCaller } from '@/types';

import { fillMessage } from './message';
import { buildRequest } from './request';

/**
 * 거부·실패 문구. 한 곳에 모은다.
 * (화면 문구는 원래 `config/`에서 읽는 규칙이지만 실행 결과 문구는 아직 `config/copy.*.json`에 없고
 *  이 작업의 수정 가능 폴더 밖이라 여기에 둔다. 보고서에서 컨트롤 타워에 결정을 요청한다.)
 */
const COPY = {
  approvalMissing: '판매자 승인이 없어 실행하지 않았습니다',
  approvalMismatch: '승인한 계획과 실행할 계획이 다릅니다 (planId 불일치)',
  disputeMismatch: '계획의 분쟁과 보드의 분쟁이 다릅니다 (disputeId 불일치)',
  acceptClaimUnconfirmed: '전액 환불(accept_claim)은 추가 확인(confirmAcceptClaim)이 필요합니다',
  evidenceUnsupported: '증빙 제출(provide_evidence)은 이 앱에서 보내지 않습니다',
  amountNotInteger: '금액이 센트 정수가 아닙니다',
  nextApprove: '분쟁 화면에서 이 계획을 다시 확인하고 승인한 뒤 실행하세요.',
  nextConfirm: '전액 환불 확인란을 체크한 뒤 다시 실행하세요.',
  nextEvidence: 'PayPal 화면에서 직접 증빙 제출을 진행하세요.',
  nextFixDraft: '메시지 초안을 고친 뒤 다시 승인하고 실행하세요.',
  nextFixPlan: '분쟁 화면에서 계획을 다시 만든 뒤 실행하세요.',
} as const;

function reject(error: string, nextAction: string): ExecuteResult {
  return { ok: false, error, nextAction };
}

function notAllowed(apiMove: string, allowed: readonly string[]): string {
  return `이 분쟁에서 허용되지 않는 수입니다: ${apiMove} (허용: ${allowed.join(', ') || '없음'})`;
}

/** PayPal이 2xx로 답하지 않았을 때. 엔드포인트와 상태 코드를 남긴다 (응답 본문은 남기지 않는다). */
function callFailed(endpoint: string, status: number): ExecuteResult {
  return reject(
    `${endpoint} 호출이 실패했습니다 (상태 코드 ${status})`,
    `PayPal 분쟁 화면에서 ${endpoint} 결과를 확인하세요. 같은 계획을 다시 실행하면 같은 PayPal-Request-Id로 나가 중복되지 않습니다.`,
  );
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

export const executeMove: ExecuteMoveFn = async (input, deps) => {
  const { board, plan, messageTemplate, approval } = input;

  // 1. 승인 (호출 0회)
  if (approval === null) return reject(COPY.approvalMissing, COPY.nextApprove);
  if (approval.planId !== plan.planId) return reject(COPY.approvalMismatch, COPY.nextApprove);

  // 2. 중복 승인: 같은 계획이 이미 성공했으면 다시 호출하지 않고 이전 결과를 돌려준다
  const previous = succeeded.get(deps.call)?.get(plan.planId);
  if (previous !== undefined) return previous;

  // 3. 보낼 수 있는 수인지 (호출 0회)
  if (plan.disputeId !== board.disputeId) return reject(COPY.disputeMismatch, COPY.nextFixPlan);
  if (plan.apiMove === 'provide_evidence') return reject(COPY.evidenceUnsupported, COPY.nextEvidence);
  if (!board.allowedMoves.includes(plan.apiMove)) return reject(notAllowed(plan.apiMove, board.allowedMoves), COPY.nextFixPlan);
  if (plan.apiMove === 'accept_claim' && approval.confirmAcceptClaim !== true) {
    return reject(COPY.acceptClaimUnconfirmed, COPY.nextConfirm);
  }
  if (!hasIntegerAmounts(input)) return reject(COPY.amountNotInteger, COPY.nextFixPlan);

  // 4. 자리표시자 채우기 (메시지 안 금액 = 본문 금액)
  const filled = fillMessage(messageTemplate, plan, board);
  if (!filled.ok) return reject(filled.reason, COPY.nextFixDraft);

  // 5. 요청 1건 만들기
  const built = buildRequest(plan, filled.message);
  if (!built.ok) return reject(built.reason, COPY.nextFixPlan);

  // 6. 호출 1회
  let status: number;
  try {
    status = (await deps.call(built.request)).status;
  } catch {
    return reject(
      `${built.endpoint} 호출이 오류로 끝났습니다`,
      `잠시 뒤 같은 계획을 다시 실행하세요. 같은 PayPal-Request-Id로 나가 중복되지 않습니다.`,
    );
  }
  if (status < 200 || status >= 300) return callFailed(built.endpoint, status);

  const result: ExecuteResult = { ok: true, sent: [{ path: built.request.path, status }] };
  remember(deps.call, plan.planId, result);
  return result;
};
