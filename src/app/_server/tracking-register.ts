/**
 * Today 추적 항목의 [Add both to PayPal] 서버 쪽 (T067, T063 "만들 것"·안전 규칙). **서버에서만** 부른다.
 *
 * 안전 규칙:
 * - 대상은 서버가 다시 정한다: `listUntracked`(GET만)에서 **분쟁이 걸리지 않은 미등록 주문**만 (지금 O05·O07).
 *   분쟁이 걸린 주문(O02·O04·O13 …)은 대상 목록에 들어가지 않는다. 브라우저가 보낸 주문 키는 받지 않는다.
 * - 모드 관문 (T070): `DEMO_MODE`가 `recording`이 아니면(public) 아래 스위치를 보지 않고 dry run — POST 0회.
 *   클라이언트(`getPayPalClient`)도 public이면 쓰기를 막는다 (이중 잠금).
 * - 실제 등록(POST)은 `registerTrackers`가 `liveGateFromEnv(env, …)` 게이트로만 한다. 스위치
 *   (`AFTERLOOP_TRACK_LIVE`·`AFTERLOOP_TRACK_LIVE_ORDERS`·`AFTERLOOP_TRACK_RECORDING`)가 꺼져 있으면 dry run — POST 0회.
 *   `registerTrackers`는 분쟁 판정을 한 번 더 한다 (이중 잠금).
 * - 결과는 `trackingOutcome`으로 글자만 넘긴다 (요청 본문·비밀값·PayPal 응답 문장 없음).
 * - 위쪽 막대 PayPal activity 기록기(T064)는 아직 없다. T064가 이 함수의 결과를 기록기에 지나게 연결한다.
 *
 * 단위 테스트는 가짜 호출기와 가짜 env를 `deps`로 넣는다. 화면 코드는 `process.env`를 넘긴다.
 */
import 'server-only';

import { DRY_RUN_GATE, liveGateFromEnv, listUntracked, registerTrackers } from '@/paypal/track';
import { readTrackOrders } from '@/paypal/track-orders';
import type { PayPalClient } from '@/types';

import { TRACKING_UNAVAILABLE, trackingOutcome, type TrackingOutcome } from '../today/tracking-result';
import { resolveDemoMode } from './mode';

export type RegisterTrackingDeps = {
  /** `getPayPalClient()` 결과 그대로. 쓸 수 없으면 아무것도 부르지 않는다. */
  paypal: { ok: true; client: PayPalClient } | { ok: false };
  /** 스위치를 읽을 환경 변수 (화면 = `process.env`). */
  env: Record<string, string | undefined>;
  /** 주문 목록 (없으면 `tests/sandbox/manifest.json`). */
  manifest?: unknown;
};

/** 분쟁이 걸리지 않은 미등록 주문 키 (조회만). */
export async function registerTargets(client: PayPalClient, manifest?: unknown): Promise<string[]> {
  const data = readTrackOrders(manifest);
  const rows = await listUntracked(client, data.orders, data.disputes);
  return rows.filter((row) => !row.excluded && row.state === 'untracked').map((row) => row.key);
}

export async function registerTrackingFromScreen(deps: RegisterTrackingDeps): Promise<TrackingOutcome> {
  if (!deps.paypal.ok) return TRACKING_UNAVAILABLE();
  const { client } = deps.paypal;
  const data = readTrackOrders(deps.manifest);
  const targets = await registerTargets(client, deps.manifest);
  // 모드 관문 (T070): recording일 때만 스위치를 본다. public이면 스위치 값과 무관하게 dry run (POST 0회)
  const live =
    resolveDemoMode(deps.env) === 'recording'
      ? liveGateFromEnv(
          deps.env,
          data.orders.map((order) => order.key),
        )
      : DRY_RUN_GATE;
  const batch = await registerTrackers(client, { data, selectedKeys: targets, live });
  return trackingOutcome(batch);
}
