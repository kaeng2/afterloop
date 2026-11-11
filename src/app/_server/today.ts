/**
 * Today 탭 서버 읽기 (T060 → T076). **서버에서만** 부른다.
 *
 * - 분쟁: `loadDemoDisputesForRequest` (같은 요청 안에서 PayPal을 한 번만 읽는다. GET만)
 * - 추적: `summarizeTracking` (주문 상세 GET만. 등록 POST 없음). PayPal을 쓸 수 없으면 `null` → 항목 숨김
 * - 목록: `buildToday` (엔진 결과를 옮긴다). 상품 거르개(`?sku=`)는 같은 읽기 결과로 다시 묶기만 한다
 * - 이번 주 카드: 예측 어댑터 `loadWeeklySummary` (T079: 엔진 `weeklySummary` + AI 캐시 초안 수)
 *
 * 위쪽 막대(Today (N))와 Today 화면이 같은 요청 안에서 함께 부르므로 `cache`로 한 번만 읽는다.
 */
import 'server-only';

import { cache } from 'react';

import { seedBuyers, seedDisputes, seedOrders, seedProducts } from '../../../seed/index';
import type { Availability } from '../_shared/availability';
import { hasDemoValues, pickBoard, type LoadedDispute } from '../_shared/dispute-view';
import { loadWeeklySummary } from '../cases/forecast-source';
import { buildToday, weeklyView, type TodayView, type TrackingSummary, type WeeklyView } from '../today/model';
import { summarizeTracking } from '../today/tracking';
import { loadDemoDisputesForRequest } from './disputes';
import { getPayPalReadClient } from './paypal';

export type TodayLoad = { view: TodayView; paypal: Availability; disputes: LoadedDispute[]; tracking: TrackingSummary | null };

export const loadTrackingForRequest = cache(async (): Promise<TrackingSummary | null> => {
  // 요청 사이 90초 읽기 캐시 (T084). 추적 등록이 끝나면 그 주문의 캐시가 지워진다
  const resolved = getPayPalReadClient();
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
    disputes: disputes.disputes,
    tracking,
  };
});

/** Today 화면용: 상품 거르개를 넣어 다시 묶은 목록 + 이번 주 카드. PayPal은 다시 읽지 않는다. */
export async function loadTodayScreen(sku: string | undefined): Promise<TodayLoad & { weekly: WeeklyView }> {
  const base = await loadTodayForRequest();
  const view =
    sku === undefined
      ? base.view
      : buildToday({ disputes: base.disputes, tracking: base.tracking, products: seedProducts, now: new Date(), sku });
  const usesDemoData = base.disputes.some(hasDemoValues);
  // 보이는 분쟁만 (거르개를 건 목록이 아니라 화면에 내는 분쟁 전체 — 열린 분쟁 수와 같은 범위)
  const weekly = loadWeeklySummary({ boards: base.disputes.map(pickBoard), usesDemoData });
  return {
    ...base,
    view,
    weekly: weeklyView(view.openDisputes, weekly?.summary ?? null, usesDemoData, {
      aiDraftsCounted: weekly?.aiDraftsCounted ?? false,
    }),
  };
}
