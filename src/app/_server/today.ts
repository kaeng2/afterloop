/**
 * Today 탭 서버 읽기 (T060). **서버에서만** 부른다.
 *
 * - 분쟁: `loadDemoDisputesForRequest` (같은 요청 안에서 PayPal을 한 번만 읽는다. GET만)
 * - 추적: `summarizeTracking` (주문 상세 GET만. 등록 POST 없음). PayPal을 쓸 수 없으면 `null` → 항목 숨김
 * - 목록: `buildToday` (엔진 결과를 옮긴다)
 *
 * 위쪽 막대(Today (N))와 Today 화면이 같은 요청 안에서 함께 부르므로 `cache`로 한 번만 읽는다.
 */
import 'server-only';

import { cache } from 'react';

import { seedBuyers, seedDisputes, seedOrders, seedProducts } from '../../../seed/index';
import type { Availability } from '../_shared/availability';
import { buildToday, type TodayView, type TrackingSummary } from '../today/model';
import { summarizeTracking } from '../today/tracking';
import { loadDemoDisputesForRequest } from './disputes';
import { getPayPalClient } from './paypal';

export type TodayLoad = { view: TodayView; paypal: Availability };

export const loadTrackingForRequest = cache(async (): Promise<TrackingSummary | null> => {
  const resolved = getPayPalClient();
  if (!resolved.ok) return null;
  return summarizeTracking(resolved.client, {
    orders: seedOrders,
    disputes: seedDisputes,
    buyers: seedBuyers,
    products: seedProducts,
  });
});

export const loadTodayForRequest = cache(async (): Promise<TodayLoad> => {
  const [disputes, tracking] = await Promise.all([loadDemoDisputesForRequest(), loadTrackingForRequest()]);
  return {
    view: buildToday({ disputes: disputes.disputes, tracking, products: seedProducts, now: new Date() }),
    paypal: disputes.paypal,
  };
});
