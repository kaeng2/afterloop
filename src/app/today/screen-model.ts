/**
 * Today 화면 상태의 순수 함수 (T106, 차이 목록 F1-18 · F1-19 · F1-22 · F1-47). 브라우저 묶음에도 들어간다 —
 * 타입 말고는 아무것도 import하지 않는다 (엔진·서버 코드가 브라우저로 가지 않게).
 *
 * - 상품 거르개: 서버가 만든 묶음(`TodayGroup[]`, 거르지 않은 전체)을 SKU로 거르기만 한다 (`buildToday`와 같은 규칙).
 * - 열린 사건 수: **done이 아닌 분쟁 항목을 센다** (데이터 개수에서 done 개수를 빼지 않는다. 시안 L683-686 `open`).
 * - 주소: 고른 항목·상품을 `?item`·`?sku`에 맞춘다 (다른 값 — 예: `lang` — 은 그대로 둔다).
 */
import type { DoneMap } from './done-groups';
import type { TodayGroup, TodayItem } from './model';

/** 상품 거르개 (`buildToday`의 거르기와 같다): 그 SKU가 걸린 항목만, 빈 묶음은 뺀다. `null`이면 그대로. */
export function filterGroups(groups: readonly TodayGroup[], sku: string | null): TodayGroup[] {
  if (sku === null) return [...groups];
  return groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.row.skus.includes(sku)) }))
    .filter((group) => group.items.length > 0);
}

/** 상품 칩 배지·요약에 쓰는 사건 하나 (분쟁 항목만). */
export type OpenCase = { id: string; skus: readonly string[] };

/** 묶음에서 분쟁 항목만 (Routine 포함, 추적·Prevent 제외 — `productFilter`의 `disputeItems`와 같은 범위). */
export function casesOf(groups: readonly TodayGroup[]): OpenCase[] {
  return groups
    .flatMap((group) => group.items)
    .filter((item: TodayItem) => item.kind === 'dispute')
    .map((item) => ({ id: item.id, skus: item.row.skus }));
}

/** done이 아닌 사건 수. `sku`가 있으면 그 상품에 걸린 것만 센다. */
export function openCaseCount(cases: readonly OpenCase[], done: DoneMap, sku: string | null = null): number {
  return cases.filter((item) => !Object.hasOwn(done, item.id) && (sku === null || item.skus.includes(sku))).length;
}

/** 지금 주소의 검색 글(`?a=b`)에 고른 상품·항목을 맞춘다. 비면 빈 글. */
export function todaySearch(current: string, sku: string | null, item: string | null): string {
  const params = new URLSearchParams(current);
  if (sku === null) params.delete('sku');
  else params.set('sku', sku);
  if (item === null) params.delete('item');
  else params.set('item', item);
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
