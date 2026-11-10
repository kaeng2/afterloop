'use server';

/**
 * 추적 등록 서버 액션 (T067). Today 추적 상세의 [Add both to PayPal] 버튼이 부른다.
 *
 * 브라우저에서 아무 값도 받지 않는다 — 대상 주문은 서버가 다시 정한다 (`registerTrackingFromScreen`).
 * 게이트는 `liveGateFromEnv(process.env, …)`. 스위치가 꺼져 있으면 dry run (POST 0회).
 * 실제로 하나라도 등록됐으면 Today를 다시 읽어 추적 항목 수가 줄어들게 한다.
 */
import { revalidatePath } from 'next/cache';

import { getPayPalClient } from '../_server/paypal';
import { registerTrackingFromScreen } from '../_server/tracking-register';
import { TRACKING_ERROR, type TrackingOutcome } from './tracking-result';

export async function addTrackingAction(): Promise<TrackingOutcome> {
  try {
    const outcome = await registerTrackingFromScreen({ paypal: getPayPalClient(), env: process.env });
    if (outcome.rows.some((row) => row.ok)) revalidatePath('/');
    return outcome;
  } catch {
    // 예외 문장은 싣지 않는다 (PayPal 응답 문장이 섞일 수 있다)
    return TRACKING_ERROR();
  }
}
