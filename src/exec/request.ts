/**
 * 계획 → PayPal 요청 1건 (SPEC v2.1 9-1장).
 *
 * **한 계획에 호출은 1회다.** 제안할 때는 send-message를 부르지 않고 메시지를 make-offer의 `note`에 담는다.
 * 금액은 `plan.amountCents`를 옮기기만 한다 (계산 금지).
 */
import type { ActionPlan, ApiRequest, MoveType } from '@/types';

import { centsToApiValue } from './amount';

/** 분쟁 대응 엔드포인트 이름. `provide_evidence`는 아직 실행하지 않는다 (multipart 업로드, P1). */
export const ENDPOINTS: Partial<Record<MoveType, string>> = {
  make_offer: 'make-offer',
  send_message: 'send-message',
  accept_claim: 'accept-claim',
};

export type BuildResult =
  | { ok: true; request: ApiRequest; endpoint: string }
  | { ok: false; reason: string };

/** 같은 계획을 다시 실행하면 같은 값이 나간다 (`<planId>:<엔드포인트 이름>`). */
function requestIdFor(planId: string, endpoint: string): string {
  return `${planId}:${endpoint}`;
}

/** 돈이 움직이는 수는 금액과 환불 유형이 있어야 본문을 만들 수 있다 (계약: `ActionPlan`). */
function moneyFields(plan: ActionPlan): { ok: true; value: string; refundType: string } | { ok: false; reason: string } {
  if (plan.amountCents === null) return { ok: false, reason: `${plan.apiMove} 계획에 금액이 없습니다` };
  if (plan.refundType === null) return { ok: false, reason: `${plan.apiMove} 계획에 환불 유형(refundType)이 없습니다` };
  return { ok: true, value: centsToApiValue(plan.amountCents), refundType: plan.refundType };
}

/** 검증을 통과한 계획과 채운 메시지로 요청 1건을 만든다. */
export function buildRequest(plan: ActionPlan, message: string): BuildResult {
  const endpoint = ENDPOINTS[plan.apiMove];
  if (endpoint === undefined) return { ok: false, reason: `${plan.apiMove}는 아직 실행하지 않습니다` };

  const base = {
    method: 'POST' as const,
    path: `/v1/customer/disputes/${plan.disputeId}/${endpoint}`,
    requestId: requestIdFor(plan.planId, endpoint),
  };

  if (plan.apiMove === 'send_message') {
    if (message.trim() === '') return { ok: false, reason: '보낼 메시지가 비어 있습니다' };
    return { ok: true, endpoint, request: { ...base, body: { message } } };
  }

  const money = moneyFields(plan);
  if (!money.ok) return money;
  const amount = { currency_code: plan.currency, value: money.value };
  const note = message.trim() === '' ? {} : { note: message };

  if (plan.apiMove === 'make_offer') {
    return {
      ok: true,
      endpoint,
      request: { ...base, body: { ...note, offer_amount: amount, offer_type: money.refundType } },
    };
  }

  return {
    ok: true,
    endpoint,
    request: { ...base, body: { ...note, accept_claim_type: money.refundType, refund_amount: amount } },
  };
}
