/**
 * 샌드박스 스크립트용 PayPal 클라이언트와 응답 읽기 도움 함수 (T001).
 *
 * PayPal 호출은 `createPayPalClient`(`@/paypal/client`) 하나만 쓴다. `fetch`를 직접 쓰지 않는다.
 * 클라이언트가 비밀값을 가려 주므로(`redact`) 로그·에러 문구를 그대로 보여 줘도 된다.
 */
import { createPayPalClient } from '@/paypal/client';
import type { PayPalClient, PayPalEnv } from '@/types';

/** 실제 네트워크·시계로 클라이언트를 만든다. `log`을 주지 않으면 클라이언트는 아무것도 적지 않는다. */
export function createSandboxClient(env: PayPalEnv, log?: (line: string) => void): PayPalClient {
  return createPayPalClient(env, {
    fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => fetch(input, init),
    now: () => Date.now(),
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    log,
  });
}

// ── 응답 읽기 (타입을 믿지 않는다) ──────────────────────────────────────────────

export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/** 중첩된 객체 한 칸 들어가기. 없으면 빈 객체. */
export const child = (value: unknown, key: string): Record<string, unknown> => asRecord(asRecord(value)[key]);

/** 주문 상세(`GET /v2/checkout/orders/{id}`)의 `purchase_units[]`. */
export const orderUnits = (body: unknown): unknown[] => asArray(asRecord(body).purchase_units);

/** 주문 상세의 캡처들 (`purchase_units[].payments.captures[]`). */
export const orderCaptures = (body: unknown): unknown[] =>
  orderUnits(body).flatMap((unit) => asArray(child(unit, 'payments').captures));

/**
 * 주문 상세의 추적 정보 (SPEC 9-3: 미등록 판정은 주문 상세로 한다).
 * `purchase_units[].shipping.trackers`와 캡처의 `trackers` 양쪽을 본다.
 */
export const orderTrackers = (body: unknown): unknown[] => [
  ...orderUnits(body).flatMap((unit) => asArray(child(unit, 'shipping').trackers)),
  ...orderCaptures(body).flatMap((capture) => asArray(asRecord(capture).trackers)),
];

/** 살아 있는 추적이 하나라도 붙어 있는지 (취소된 것은 세지 않는다). */
export const hasTracker = (body: unknown): boolean =>
  orderTrackers(body).some((tracker) => asText(asRecord(tracker).status) !== 'CANCELLED');

/** 첫 캡처 ID. 없으면 빈 문자열. */
export const firstCaptureId = (body: unknown): string => asText(asRecord(orderCaptures(body)[0]).id);

/**
 * PayPal 오류 응답의 요약: `name`, `details[].issue`, `debug_id`만 뽑는다.
 * 사람이 쓴 설명(`description`, `message`)은 요청 본문을 되돌려 줄 수 있어 담지 않는다.
 */
export function errorSummary(body: unknown): string {
  const fields = asRecord(body);
  const name = asText(fields.name) || asText(fields.error);
  const issues = asArray(fields.details)
    .map((d) => asText(asRecord(d).issue))
    .filter((issue) => issue !== '');
  const debugId = asText(fields.debug_id);

  const parts: string[] = [];
  if (name !== '') parts.push(name);
  if (issues.length > 0) parts.push(issues.join(', '));
  if (debugId !== '') parts.push(`debug_id=${debugId}`);
  return parts.length === 0 ? '(응답에 name·issue가 없다)' : parts.join(' · ');
}

/** 클라이언트가 던진 오류에서 보여 줄 수 있는 한 줄. 비밀값은 이미 가려져 있다. */
export function failureLine(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message;
  return '원인을 알 수 없는 오류';
}

/** 클라이언트가 던진 오류가 토큰 발급 단계에서 난 것인지. */
export function isTokenFailure(error: unknown): boolean {
  const path = (error as { path?: unknown } | null)?.path;
  return asText(path) === '/v1/oauth2/token';
}

/** 쿼리 문자열. 값은 퍼센트 인코딩한다 (공백·제어문자가 path에 들어가지 않게). */
export function query(params: Record<string, string | number>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));
  return search.toString();
}
