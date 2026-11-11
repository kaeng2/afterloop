/**
 * 공개 데모 모드 (T070). **서버에서만** 부른다.
 *
 * - `DEMO_MODE`가 **정확히** `"recording"`일 때만 `recording`이다. 없음·빈 값·`"public"`·오타·대소문자 다름·
 *   앞뒤 공백은 모두 `public`. 공개 배포의 기본은 public이다.
 * - public에서는 PayPal 쓰기 호출(POST 등)이 0회다. 실제 전송 스위치(`AFTERLOOP_REAL_SEND`, 추적
 *   `AFTERLOOP_TRACK_LIVE`·`AFTERLOOP_TRACK_LIVE_ORDERS`·`AFTERLOOP_TRACK_RECORDING`)는 recording일 때만 읽힌다.
 *   이 파일은 "모드 관문" 하나만 둔다 — 그 뒤의 보내기 관문 순서·규칙은 그대로다.
 * - 화면에는 모드 **이름**만 내려보낸다 (env 값은 내려보내지 않는다).
 */
import 'server-only';

export type DemoMode = 'public' | 'recording';

export type DemoModeEnv = Partial<Record<'DEMO_MODE', string>>;

/** `"recording"`만 recording. 그 밖은 전부 public. */
export function resolveDemoMode(env: DemoModeEnv = process.env as DemoModeEnv): DemoMode {
  return env.DEMO_MODE === 'recording' ? 'recording' : 'public';
}

/** 실제 쓰기 스위치를 볼 수 있는가 (= recording). public이면 스위치 값과 무관하게 거짓. */
export function writesMayGoLive(env: DemoModeEnv = process.env as DemoModeEnv): boolean {
  return resolveDemoMode(env) === 'recording';
}
