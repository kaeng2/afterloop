/**
 * 실행 결과 문구 (SPEC v2.1 1장 "화면은 영어", T027).
 *
 * `ExecuteResult`의 `error`·`nextAction`은 판매자 화면에 그대로 나갈 수 있으므로 영어 문장이다.
 * 문구는 `src/exec/` 안의 이 파일 한 곳에만 둔다.
 *
 * **상수 이름이 안정적인 키다.** 나중에 ui 레인이 `config/copy.*.json`으로 옮길 때
 * 키는 `exec.<상수 이름>`이 된다 (예: `exec.approvalMissing`). 이름을 바꾸면 그 키가 깨진다.
 * 값에 숫자를 직접 쓰지 않고 `{{endpoint}}` 같은 자리표시자로 둔다 (`config/copy.en.json` 규칙).
 *
 * 자리표시자에 넣어도 되는 값: 엔드포인트 이름, 상태 코드, `apiMove`, `board.allowedMoves`.
 * 넣으면 안 되는 값: 응답 본문, 구매자 정보, 메시지 초안과 그 안의 토큰, 비밀값 (CLAUDE.md).
 */

/** 거부 결과의 두 문장. `ExecuteResult`의 `ok: false` 쪽과 같은 모양이다. */
export type Rejection = { error: string; nextAction: string };

/** `config/copy.*.json`으로 옮길 때 붙는 키 앞머리. 키 = `exec.<상수 이름>`. */
export const EXEC_COPY_KEY_PREFIX = 'exec.';

export const EXEC_COPY = {
  // 승인
  approvalMissing: 'This plan has not been approved, so nothing was sent to PayPal.',
  approvalMismatch: 'The approval on file is for a different plan (planId mismatch), so nothing was sent.',
  nextApprove: 'Review this plan on the dispute screen, approve it, and run it again.',

  // 보낼 수 있는 수인지
  disputeMismatch: 'This plan belongs to a different dispute than the one on screen (disputeId mismatch).',
  moveNotAllowed: 'PayPal does not allow this move on this dispute: {{apiMove}} (allowed: {{allowed}}).',
  allowedNone: 'none',
  acceptClaimUnconfirmed: 'A full refund (accept_claim) needs the extra confirmation before it runs.',
  nextConfirm: 'Tick the full-refund confirmation box and run it again.',
  evidenceUnsupported: 'Evidence upload (provide_evidence) is not sent from this app.',
  nextEvidence: 'Submit the evidence directly on the PayPal dispute screen.',
  moveUnsupported: 'This app does not send {{apiMove}} yet.',
  nextFixPlan: 'Rebuild the plan on the dispute screen and run it again.',

  // 금액
  amountNotInteger: 'The amount on this plan is not a whole number of cents, so nothing was sent.',
  amountMissing: 'This plan has no amount, so the {{apiMove}} request body cannot be built.',
  refundTypeMissing: 'This plan has no refund type (refundType), so the {{apiMove}} request body cannot be built.',

  // 메시지 초안 (LLM 출력은 신뢰하지 않는 입력이다)
  literalAmount: 'The draft message writes an amount directly ({{shape}}). Amounts are only accepted as placeholders.',
  literalShapeSymbolBefore: 'a currency symbol before a number',
  literalShapeCurrencyWordAfter: 'a number followed by a currency name',
  literalShapeCurrencyCodeBefore: 'a currency code before a number',
  literalShapeDecimal: 'a number with two decimal places',
  unknownPlaceholder:
    'The draft message uses a placeholder this app does not fill. Amounts are only accepted as the offerAmount, refundAmount or disputeAmount placeholder.',
  placeholderWithoutAmount: 'This plan has no amount, so the amount placeholder in the draft cannot be filled.',
  nextFixDraft: 'Fix the draft message, approve it again, and run it.',
  tokensRemaining: 'The draft message still contains unfilled tokens, so nothing was sent to the buyer.',
  nextRegenerateDraft: 'Generate the draft message again, check that every token is filled, and run it.',
  messageEmpty: 'The draft message is empty, so nothing was sent.',

  // 호출 결과 (엔드포인트 이름과 상태 코드만 남긴다. 응답 본문은 읽지 않는다)
  callFailed: 'The {{endpoint}} call failed (status code {{status}}).',
  callNoStatus: 'The {{endpoint}} call came back without a usable status code, so it is not treated as sent.',
  nextCheckPayPal:
    'Check the {{endpoint}} result on the PayPal dispute screen. Running the same plan again reuses the same PayPal-Request-Id, so it will not send twice.',
  callErrored: 'The {{endpoint}} call ended with an error.',
  nextRetry:
    'Run the same plan again in a moment. It reuses the same PayPal-Request-Id, so it will not send twice.',
} as const;

export type ExecCopyKey = keyof typeof EXEC_COPY;

/** `{{name}}`을 넘긴 값으로 바꾼다. 없는 이름은 그대로 둔다 (배선 실수를 숨기지 않게). */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}
