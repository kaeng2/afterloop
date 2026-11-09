/**
 * `sandbox:setup`의 `track`·`disputes` 단계 (T001, SPEC v2.2 9-5장).
 *
 * 여기에는 진입점이 없다 (단위 테스트가 그대로 import한다). 명령줄 처리는 `setup.ts`가 한다.
 * 분쟁 상태를 바꾸는 호출(send-message, make-offer, accept-claim, escalate 등)은 만들지 않는다.
 */
import type { Manifest, ManifestDispute } from './manifest';
import { asArray, asRecord, asText, errorSummary, failureLine, firstCaptureId, hasTracker, query } from './paypal';
import type { PayPalClient } from '@/types';

/** 분쟁 키 → 주문 키 (T001 "주문 12건 배정" 표가 정본). */
export const DISPUTE_ORDER_KEY: Record<string, string> = { D1: 'O02', D2: 'O01', D3: 'O08' };

/** Orders v2 `/track`은 상태를 SHIPPED만 넣을 수 있다 (SPEC 9-3). 운송사는 가상이므로 OTHER. */
const CARRIER = 'OTHER';
export const CARRIER_NAME_OTHER = 'Fernwood Knits demo carrier';

/** 가상 추적번호: 주문 키로 정해지므로 다시 실행해도 같다. */
export const trackingNumberFor = (orderKey: string): string => `FKAL${orderKey.replace(/\D/g, '').padStart(2, '0')}2026`;

/** 추적 등록 요청 ID: 주문 키 기준 (재시도해도 같은 값). */
export const trackRequestId = (orderKey: string): string => `afterloop-track-${orderKey}`;

// ── track ──────────────────────────────────────────────────────────────────────

export type TrackOutcome = {
  key: string;
  orderId: string;
  result: 'added' | 'skipped' | 'failed';
  status: number | null;
  trackingNumber: string | null;
  note: string;
};

/**
 * manifest에서 `tracked: true`인 주문에 추적번호를 1건씩 등록한다.
 * 이미 추적이 붙어 있으면 건너뛴다 (다시 실행해도 안전하다).
 */
export async function runTrack(client: PayPalClient, manifest: Manifest): Promise<TrackOutcome[]> {
  const outcomes: TrackOutcome[] = [];

  for (const entry of manifest.orders) {
    if (!entry.tracked) continue;
    const orderPath = `/v2/checkout/orders/${encodeURIComponent(entry.orderId)}`;
    const base = { key: entry.key, orderId: entry.orderId };

    try {
      const detail = await client.get(orderPath);
      if (detail.status !== 200) {
        outcomes.push({ ...base, result: 'failed', status: detail.status, trackingNumber: null, note: `주문 조회 → ${errorSummary(detail.body)}` });
        continue;
      }
      if (hasTracker(detail.body)) {
        outcomes.push({ ...base, result: 'skipped', status: 200, trackingNumber: null, note: '이미 추적이 붙어 있다' });
        continue;
      }

      const captureId = entry.captureId ?? firstCaptureId(detail.body);
      if (captureId === '') {
        outcomes.push({ ...base, result: 'failed', status: 200, trackingNumber: null, note: '캡처가 없다 (capture 단계를 먼저 돌린다)' });
        continue;
      }

      const trackingNumber = trackingNumberFor(entry.key);
      const res = await client.call({
        method: 'POST',
        path: `${orderPath}/track`,
        requestId: trackRequestId(entry.key),
        body: {
          capture_id: captureId,
          tracking_number: trackingNumber,
          carrier: CARRIER,
          carrier_name_other: CARRIER_NAME_OTHER,
          notify_payer: false,
        },
      });

      outcomes.push(
        res.status < 300
          ? { ...base, result: 'added', status: res.status, trackingNumber, note: 'ok' }
          : { ...base, result: 'failed', status: res.status, trackingNumber, note: errorSummary(res.body) },
      );
    } catch (error) {
      outcomes.push({ ...base, result: 'failed', status: null, trackingNumber: null, note: failureLine(error) });
    }
  }

  return outcomes;
}

// ── disputes ───────────────────────────────────────────────────────────────────

export type DisputeOutcome = {
  key: string;
  orderKey: string;
  disputeId: string | null;
  status: number | null;
  note: string;
};

/**
 * 분쟁 D1~D3을 찾는다: 주문의 캡처 ID로 `GET /v1/customer/disputes?disputed_transaction_id=...`를 부른다.
 * 분쟁 목록 응답에는 `seller_transaction_id`가 없어서(tests/fixtures/dispute-list.json)
 * 캡처 ID를 질의 조건으로 넘겨 거는 쪽이 확실하다.
 */
export async function runDisputes(
  client: PayPalClient,
  manifest: Manifest,
): Promise<{ outcomes: DisputeOutcome[]; disputes: ManifestDispute[] }> {
  const orderByKey = new Map(manifest.orders.map((order) => [order.key, order]));
  const outcomes: DisputeOutcome[] = [];
  const disputes: ManifestDispute[] = [];

  for (const key of Object.keys(DISPUTE_ORDER_KEY).sort()) {
    const orderKey = DISPUTE_ORDER_KEY[key];
    const order = orderByKey.get(orderKey);
    const base = { key, orderKey };

    if (order === undefined) {
      outcomes.push({ ...base, disputeId: null, status: null, note: `manifest에 주문 ${orderKey}가 없다 (orders 단계를 먼저 돌린다)` });
      continue;
    }

    try {
      let captureId = order.captureId ?? '';
      if (captureId === '') {
        const detail = await client.get(`/v2/checkout/orders/${encodeURIComponent(order.orderId)}`);
        if (detail.status !== 200) {
          outcomes.push({ ...base, disputeId: null, status: detail.status, note: `주문 조회 → ${errorSummary(detail.body)}` });
          continue;
        }
        captureId = firstCaptureId(detail.body);
      }
      if (captureId === '') {
        outcomes.push({ ...base, disputeId: null, status: null, note: '캡처가 없다 (capture 단계를 먼저 돌린다)' });
        continue;
      }

      const res = await client.get(`/v1/customer/disputes?${query({ disputed_transaction_id: captureId, page_size: 10 })}`);
      if (res.status !== 200) {
        outcomes.push({ ...base, disputeId: null, status: res.status, note: errorSummary(res.body) });
        continue;
      }

      const ids = asArray(asRecord(res.body).items)
        .map((item) => asText(asRecord(item).dispute_id))
        .filter((id) => id !== '');
      if (ids.length === 0) {
        outcomes.push({ ...base, disputeId: null, status: 200, note: '이 캡처에 걸린 분쟁이 없다 (사람이 분쟁을 접수했는지 확인한다)' });
        continue;
      }

      disputes.push({ key, disputeId: ids[0], orderKey });
      outcomes.push({
        ...base,
        disputeId: ids[0],
        status: 200,
        note: ids.length === 1 ? 'ok' : `분쟁이 ${ids.length}건 걸려 있어 첫 건을 적었다 (${ids.join(' ')})`,
      });
    } catch (error) {
      outcomes.push({ ...base, disputeId: null, status: null, note: failureLine(error) });
    }
  }

  return { outcomes, disputes };
}
