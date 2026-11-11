/**
 * Today 추적 항목의 입력 (T060). **조회만 한다** — `listUntracked`(`src/paypal/track.ts`)가 주문 상세를 GET으로
 * 읽는다. 등록(POST)은 이 작업에 없다 (T063).
 *
 * - 분쟁이 걸린 주문은 `listUntracked`가 조회하지 않고 빼 둔다 → 수에서 빠진다.
 * - 분쟁이 걸리지 않은 주문 중 하나라도 읽지 못했으면 수를 믿을 수 없으므로 `null` (화면은 항목을 숨긴다).
 * - 회색 "In dispute — excluded" 줄: 분쟁이 걸린 미등록 주문(샌드박스 기록 `tracked: false`) 중 연습용·시연 제외
 *   분쟁만 걸린 주문은 넣지 않는다 (화면에 내지 않는 분쟁).
 *
 * 구매자 이름은 시드 주문(없으면 그 주문에 걸린 시드 분쟁) → 시드 구매자 → `buyerShortName`. 상품 이름은 시드 상품.
 */
import { listUntracked } from '@/paypal/track';
import { TrackManifestSchema, readTrackOrders } from '@/paypal/track-orders';
import type { PayPalClient, SeedBuyer, SeedDispute, SeedOrder, SeedProduct } from '@/types';

import manifestJson from '../../../tests/sandbox/manifest.json';
import { buyerShortName, type TrackingOrderView, type TrackingSummary } from './model';

export type TrackingSeed = {
  orders: readonly (Pick<SeedOrder, 'id' | 'buyerId'> & Partial<Pick<SeedOrder, 'amountCents'>>)[];
  /** 시드 주문에 없는 샌드박스 주문(O13 등)은 그 주문에 걸린 시드 분쟁의 구매자로 찾는다. */
  disputes: readonly Pick<SeedDispute, 'id' | 'buyerId'>[];
  buyers: readonly Pick<SeedBuyer, 'id' | 'name'>[];
  products: readonly (Pick<SeedProduct, 'sku' | 'itemName'> & Partial<Pick<SeedProduct, 'priceCents'>>)[];
};

export async function summarizeTracking(
  client: PayPalClient,
  seed: TrackingSeed,
  manifest: unknown = manifestJson,
): Promise<TrackingSummary | null> {
  try {
    const data = readTrackOrders(manifest);
    const recorded = TrackManifestSchema.parse(manifest);
    const rows = await listUntracked(client, data.orders, data.disputes);

    if (rows.some((row) => !row.excluded && row.state === 'unknown')) return null;

    const orderOf = new Map(data.orders.map((order) => [order.key, order]));
    const view = (key: string): TrackingOrderView => {
      const order = orderOf.get(key);
      const viaDispute = data.disputes
        .filter((dispute) => dispute.orderKey === key)
        .map((dispute) => seed.disputes.find((d) => d.id === dispute.key)?.buyerId)
        .find((id) => id !== undefined);
      const buyerId = seed.orders.find((o) => o.id === key)?.buyerId ?? viaDispute;
      const buyer = seed.buyers.find((b) => b.id === buyerId);
      const product = seed.products.find((p) => p.sku === order?.sku);
      // T091: 주문 금액 = 시드 주문 값, 없으면(샌드박스만 있는 주문) 시드 상품 가격. 둘 다 없으면 넣지 않는다
      const amountCents = seed.orders.find((o) => o.id === key)?.amountCents ?? product?.priceCents;
      return {
        key,
        buyerName: buyer === undefined ? null : buyerShortName(buyer.name),
        productName: product?.itemName ?? null,
        ...(order?.sku === undefined || amountCents === undefined ? {} : { sku: order.sku, amountCents }),
      };
    };

    const untracked = rows.filter((row) => !row.excluded && row.state === 'untracked').map((row) => view(row.key));

    const recordedUntracked = new Set(recorded.orders.filter((order) => !order.tracked).map((order) => order.key));
    const excluded = rows
      .filter((row) => row.excluded && recordedUntracked.has(row.key))
      .filter((row) =>
        data.disputes.some((dispute) => dispute.orderKey === row.key && dispute.demoExcluded !== true),
      )
      .map((row) => view(row.key));

    return { untracked, excluded };
  } catch {
    return null; // 목록 모양이 틀렸거나 호출기가 던졌다 → 지어내지 않고 숨긴다
  }
}
