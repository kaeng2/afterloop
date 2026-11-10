/**
 * "쓸 수 없음" 사유 코드 (T047 보완 D-3).
 *
 * 서버 도구(`_server/paypal.ts`·`llm.ts`·`disputes.ts`)는 `reason`에 **고정 코드만** 싣는다.
 * 예외 문장·환경 변수 값·PayPal 응답 문장은 싣지 않는다. 화면은 코드를 문구 키로 바꿔 보인다
 * (`reasonCopyKey`). 이 파일은 서버 전용이 아니다 (화면과 단위 테스트가 함께 읽는다).
 */

export const UNAVAILABLE_REASONS = [
  /** 환경 변수가 비었다 (`.env`는 사람이 채운다). */
  'not_configured',
  /** `PAYPAL_BASE_URL`이 샌드박스가 아니다. 호출하지 않는다. */
  'not_sandbox',
  /** 클라이언트를 만들지 못했다. */
  'client_error',
  /** 브라우저에서 불렸다 (서버에서만 쓴다). */
  'server_only',
  /** 요청이 실패했다 (목록 조회 실패 등). */
  'request_failed',
  /** 일부 분쟁의 상세를 읽지 못했다 (나머지는 보인다). */
  'partial',
] as const;

export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number];

/** 쓸 수 있었는지 + 사유 코드. `ok`가 참이어도 `partial`이면 `reason`이 붙는다. */
export type Availability = { ok: boolean; reason?: UnavailableReason };

/** 사유 코드 → 문구 키 (`common.reason.*`). */
export function reasonCopyKey(reason: UnavailableReason): string {
  return `common.reason.${reason}`;
}
