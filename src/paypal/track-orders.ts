/**
 * 추적 등록 화면이 쓰는 주문 목록 읽기 (T011, SPEC v2.7 9-3).
 *
 * 주문 13건과 분쟁(연습용·시연 제외 포함)은 `tests/sandbox/manifest.json`에 있다.
 * 배포 묶음에 들어가도록 JSON을 정적으로 import한다 (`fs`로 읽지 않는다).
 * `scripts/`는 import하지 않으므로 `ManifestSchema`와 같은 모양을 여기서 한 번 더 정의한다
 * (둘이 같은 결과를 내는지는 `tests/unit/track.test.ts`가 묶는다).
 * 읽은 값에 PayPal 비밀값·구매자 개인정보는 없다.
 */
import { z } from 'zod';
import manifestJson from '../../tests/sandbox/manifest.json';

export const TrackOrderSchema = z.object({
  key: z.string().min(1),
  orderId: z.string().min(1),
  buyer: z.string().min(1),
  sku: z.string().min(1),
  tracked: z.boolean(),
  captureId: z.string().min(1).optional(),
  previousOrderIds: z.array(z.string().min(1)).optional(),
});

export const TrackDisputeSchema = z.object({
  key: z.string().min(1),
  disputeId: z.string().min(1),
  orderKey: z.string().min(1),
  demoExcluded: z.boolean().optional(),
  note: z.string().min(1).optional(),
});

export const TrackManifestSchema = z.object({
  orders: z.array(TrackOrderSchema).default([]),
  disputes: z.array(TrackDisputeSchema).default([]),
});

export type TrackOrder = { key: string; orderId: string; buyer: string; sku: string; captureId?: string };
export type TrackDispute = { key: string; disputeId?: string; orderKey: string; demoExcluded?: boolean };
export type TrackOrders = { orders: TrackOrder[]; disputes: TrackDispute[] };

/**
 * manifest 전체를 읽는다 (주문과 분쟁을 항상 함께 — 호출하는 쪽이 분쟁을 빼먹을 수 없다).
 * 모양이 틀리면 던진다 (추측하지 않는다).
 */
export function readTrackOrders(source: unknown = manifestJson): TrackOrders {
  const parsed = TrackManifestSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`주문 목록 모양이 맞지 않는다: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  }
  return {
    orders: parsed.data.orders.map(({ key, orderId, buyer, sku, captureId }) => ({
      key,
      orderId,
      buyer,
      sku,
      ...(captureId === undefined ? {} : { captureId }),
    })),
    disputes: parsed.data.disputes.map(({ key, disputeId, orderKey, demoExcluded }) => ({
      key,
      disputeId,
      orderKey,
      ...(demoExcluded === undefined ? {} : { demoExcluded }),
    })),
  };
}
