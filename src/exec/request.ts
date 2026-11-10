/**
 * 계획 → PayPal 요청 1건 (SPEC v2.4 9-1장).
 *
 * **한 계획에 호출은 1회다.** 제안할 때는 send-message를 부르지 않고 메시지를 make-offer의 `note`에 담는다.
 * 금액은 `plan.amountCents`를 옮기기만 한다 (계산 금지).
 * 메시지는 `fillMessage`를 통과한 것만 들어온다 (토큰 없음, 비어 있지 않음). 빈 메시지는 여기서도 한 번 더 막는다.
 * `PayPal-Request-Id`는 본문을 만든 뒤 그 본문에서 해시로 만든다 (아래 `requestIdFor`).
 */
import { createHash } from 'node:crypto';

import type { ActionPlan, ApiRequest, MoveType } from '@/types';

import { centsToApiValue } from './amount';
import { EXEC_COPY, format, type Rejection } from './copy';

/** 분쟁 대응 엔드포인트 이름. `provide_evidence`는 아직 실행하지 않는다 (multipart 업로드, P1). */
export const ENDPOINTS: Partial<Record<MoveType, string>> = {
  make_offer: 'make-offer',
  send_message: 'send-message',
  accept_claim: 'accept-claim',
};

export type BuildResult =
  | { ok: true; request: ApiRequest; endpoint: string }
  | ({ ok: false } & Rejection);

/** 로그에서 AfterLoop가 보낸 요청임을 알아보게 하는 접두. */
const REQUEST_ID_PREFIX = 'al-';
/** `PayPal-Request-Id` 최대 길이 (SPEC v2.4 9-1장, Q11). 주문 API에서 61자가 통과한 적이 있어도 36자로 맞춘다. */
export const REQUEST_ID_MAX_LENGTH = 36;

/** 키 순서가 고정된 JSON 직렬화. 같은 본문이면 꽂은 순서와 무관하게 항상 같은 문자열이 나온다. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`).join(',')}}`;
}

/** 길이 접두를 붙여 이어 붙인다. 구분자가 값 안에 들어 있어도 경계가 모호해지지 않는다. */
function lengthPrefixed(parts: string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join('');
}

/**
 * 요청 번호 = `al-` + sha256(계획 ID + 엔드포인트 이름 + 보내는 본문) 앞 33자 → 정확히 36자, `[a-z0-9-]`.
 *
 * - **결정적**: 같은 계획 + 같은 본문이면 항상 같은 값이다 (재시도·중복 클릭을 PayPal이 한 번만 처리한다).
 *   시각·난수·프로세스 정보를 섞지 않는다.
 * - 메시지가 한 글자라도 다르거나 금액이 다르면 다른 값이다 (같은 분쟁의 두 번째 메시지가 실제로 나간다).
 * - 해시만 들어가므로 메시지 원문·분쟁 ID·금액이 요청 번호에 드러나지 않는다.
 */
function requestIdFor(planId: string, endpoint: string, body: Record<string, unknown>): string {
  const material = lengthPrefixed([planId, endpoint, canonicalJson(body)]);
  const digest = createHash('sha256').update(material, 'utf8').digest('hex');
  return `${REQUEST_ID_PREFIX}${digest}`.slice(0, REQUEST_ID_MAX_LENGTH);
}

/** 돈이 움직이는 수는 금액과 환불 유형이 있어야 본문을 만들 수 있다 (계약: `ActionPlan`). */
function moneyFields(
  plan: ActionPlan,
): { ok: true; value: string; refundType: string } | ({ ok: false } & Rejection) {
  if (plan.amountCents === null) {
    return { ok: false, error: format(EXEC_COPY.amountMissing, { apiMove: plan.apiMove }), nextAction: EXEC_COPY.nextFixPlan };
  }
  if (plan.refundType === null) {
    return { ok: false, error: format(EXEC_COPY.refundTypeMissing, { apiMove: plan.apiMove }), nextAction: EXEC_COPY.nextFixPlan };
  }
  return { ok: true, value: centsToApiValue(plan.amountCents), refundType: plan.refundType };
}

/** PayPal로 나가는 요청 본문. 요청 번호는 이 본문 그대로에서 만든다. */
function bodyFor(
  plan: ActionPlan,
  message: string,
): { ok: true; body: Record<string, unknown> } | ({ ok: false } & Rejection) {
  if (plan.apiMove === 'send_message') {
    return { ok: true, body: { message } };
  }

  const money = moneyFields(plan);
  if (!money.ok) return money;
  const amount = { currency_code: plan.currency, value: money.value };

  if (plan.apiMove === 'make_offer') {
    return { ok: true, body: { note: message, offer_amount: amount, offer_type: money.refundType } };
  }

  return { ok: true, body: { note: message, accept_claim_type: money.refundType, refund_amount: amount } };
}

/** 검증을 통과한 계획과 채운 메시지로 요청 1건을 만든다. */
export function buildRequest(plan: ActionPlan, message: string): BuildResult {
  const endpoint = ENDPOINTS[plan.apiMove];
  if (endpoint === undefined) {
    return { ok: false, error: format(EXEC_COPY.moveUnsupported, { apiMove: plan.apiMove }), nextAction: EXEC_COPY.nextFixPlan };
  }
  if (message.trim() === '') {
    return { ok: false, error: EXEC_COPY.messageEmpty, nextAction: EXEC_COPY.nextFixDraft };
  }

  const built = bodyFor(plan, message);
  if (!built.ok) return built;

  return {
    ok: true,
    endpoint,
    request: {
      method: 'POST',
      path: `/v1/customer/disputes/${plan.disputeId}/${endpoint}`,
      body: built.body,
      requestId: requestIdFor(plan.planId, endpoint, built.body),
    },
  };
}
