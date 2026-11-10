/**
 * `sandbox:setup`의 `track`·`disputes` 단계 (T001·T039, SPEC v2.3 9-3·9-5장).
 *
 * 여기에는 진입점이 없다 (단위 테스트가 그대로 import한다). 명령줄 처리는 `setup.ts`가 한다.
 * 분쟁 상태를 바꾸는 호출(send-message, make-offer, accept-claim, escalate 등)은 만들지 않는다.
 *
 * 안전 규칙 (SPEC 9-3): **분쟁이 걸린 주문에는 추적번호를 등록하지 않는다.** 시연 제외 분쟁도 센다 —
 * 시연에서 뺐을 뿐 PayPal 쪽에서는 살아 있으므로, 그 주문의 배송 근거를 바꾸면 안 된다.
 * 판정은 `planTrack`(순수 함수)이 **호출 전에** 한다.
 */
import type { Manifest, ManifestDispute, ManifestOrder } from './manifest';
import { asArray, asRecord, asText, errorSummary, failureLine, firstCaptureId, hasTracker, query } from './paypal';
import type { PayPalClient } from '@/types';

/**
 * 분쟁 키 → 주문 키의 **기본값**. manifest에 이미 그 키가 적혀 있으면 manifest의 `orderKey`가 이긴다
 * (SPEC v2.3 9-5: D2는 O13의 캡처에 걸린 분쟁이다 — 처음 접수한 O01의 분쟁은 시연에서 뺐다).
 */
export const DISPUTE_ORDER_KEY: Record<string, string> = { D1: 'O02', D2: 'O01', D3: 'O08' };

// ── 분쟁이 걸린 주문 (SPEC 9-3 안전 규칙) ──────────────────────────────────────

/**
 * manifest의 분쟁이 가리키는 주문 키. **시연 제외 분쟁도 센다** — 시연에서 빼도 PayPal 쪽에서는
 * 분쟁이 살아 있으므로, 그 주문에 추적번호를 등록하면 진행 중인 분쟁의 근거를 바꾸게 된다.
 * 순수 함수다 (호출하지 않는다).
 */
export function disputedOrderKeys(disputes: ManifestDispute[]): Map<string, ManifestDispute[]> {
  const byOrderKey = new Map<string, ManifestDispute[]>();
  for (const dispute of disputes) {
    const kept = byOrderKey.get(dispute.orderKey) ?? [];
    byOrderKey.set(dispute.orderKey, [...kept, dispute]);
  }
  return byOrderKey;
}

/** 결과 표에 적는 제외 사유 (SPEC 9-3). */
export const TRACK_DISPUTED_NOTE = '분쟁 진행 중이라 제외';

/** 제외 사유 한 줄 (`분쟁 진행 중이라 제외 (D2-old · 시연 제외)`). */
export const trackDisputedNote = (disputes: ManifestDispute[]): string => {
  const labels = disputes.map((d) => (d.demoExcluded === true ? `${d.key} · 시연 제외` : d.key));
  return labels.length === 0 ? TRACK_DISPUTED_NOTE : `${TRACK_DISPUTED_NOTE} (${labels.join(', ')})`;
};

export type TrackPlan = {
  /** 추적 등록을 호출할 주문 (`tracked: true` + 분쟁 없음) */
  targets: ManifestOrder[];
  /** 분쟁이 걸려 호출에서 뺀 주문 (`tracked`와 무관하게 분쟁이 있는 주문 전부) */
  blocked: { order: ManifestOrder; disputes: ManifestDispute[] }[];
};

/**
 * 추적 등록 대상을 **호출 전에** 가른다 (SPEC 9-3, T039 지시서 5번). 순수 함수다.
 *
 *   - `tracked: false`인 주문은 어느 쪽에도 넣지 않는다 (애초에 대상이 아니다).
 *   - `tracked: true`인데 manifest의 분쟁(시연 제외 포함)이 가리키는 주문은 `blocked`에 넣는다 —
 *     아직 등록이 안 된 주문이어도 호출하지 않는다.
 */
export function planTrack(manifest: Manifest): TrackPlan {
  const byOrderKey = disputedOrderKeys(manifest.disputes);
  const plan: TrackPlan = { targets: [], blocked: [] };

  for (const order of manifest.orders) {
    if (!order.tracked) continue;
    const disputes = byOrderKey.get(order.key);
    if (disputes === undefined) plan.targets.push(order);
    else plan.blocked.push({ order, disputes });
  }

  return plan;
}

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
  /** `disputed`는 분쟁이 걸려 **호출 전에** 뺀 주문이다 (SPEC 9-3). */
  result: 'added' | 'skipped' | 'disputed' | 'failed';
  status: number | null;
  trackingNumber: string | null;
  note: string;
};

/**
 * manifest에서 `tracked: true`인 주문에 추적번호를 1건씩 등록한다.
 * 이미 추적이 붙어 있으면 건너뛴다 (다시 실행해도 안전하다).
 *
 * 분쟁이 걸린 주문은 `planTrack`이 호출 전에 빼므로 조회조차 하지 않는다 (SPEC 9-3).
 */
export async function runTrack(client: PayPalClient, manifest: Manifest): Promise<TrackOutcome[]> {
  const outcomes: TrackOutcome[] = [];
  const plan = planTrack(manifest);
  const blocked = new Map(plan.blocked.map(({ order, disputes }) => [order.key, disputes]));
  const targets = new Set(plan.targets.map((order) => order.key));

  // 표는 manifest 순서대로 적는다 (분쟁으로 빠진 행도 제자리에 보인다).
  for (const entry of manifest.orders) {
    const disputes = blocked.get(entry.key);
    if (disputes !== undefined) {
      outcomes.push({
        key: entry.key,
        orderId: entry.orderId,
        result: 'disputed',
        status: null,
        trackingNumber: null,
        note: trackDisputedNote(disputes),
      });
      continue;
    }
    if (!targets.has(entry.key)) continue;

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
 * 분쟁 키가 가리키는 주문 키. **manifest에 적힌 `orderKey`가 기본 표보다 먼저다** (T039 지시서 4번):
 * 사람이 분쟁을 다시 접수해 다른 주문에 걸렸을 때(D2 = O01 → O13) 기본 표가 되돌리지 않게 한다.
 * 시연 제외 항목의 `orderKey`는 쓰지 않는다 (그 키는 애초에 다시 찾지 않는다). 순수 함수다.
 */
export function orderKeyForDispute(key: string, disputes: ManifestDispute[]): string {
  const before = disputes.find((dispute) => dispute.key === key && dispute.demoExcluded !== true);
  return before?.orderKey ?? DISPUTE_ORDER_KEY[key];
}

/** 시연 제외 분쟁의 ID (다른 키에 다시 배정하지 않는다). 순수 함수다. */
export const demoExcludedDisputeIds = (disputes: ManifestDispute[]): Set<string> =>
  new Set(disputes.filter((dispute) => dispute.demoExcluded === true).map((dispute) => dispute.disputeId));

/**
 * 시연 분쟁 D1~D3을 찾는다: 주문의 캡처 ID로 `GET /v1/customer/disputes?disputed_transaction_id=...`를 부른다.
 * 분쟁 목록 응답에는 `seller_transaction_id`가 없어서(tests/fixtures/dispute-list.json)
 * 캡처 ID를 질의 조건으로 넘겨 거는 쪽이 확실하다.
 *
 * 시연 제외 항목(`demoExcluded: true`)은 다시 찾지 않고, 그 분쟁 ID가 목록에 나와도 **건너뛴다** —
 * 시연에서 뺀 분쟁이 D1~D3 가운데 하나로 다시 배정되지 않게 한다 (T039 지시서 4번).
 */
export async function runDisputes(
  client: PayPalClient,
  manifest: Manifest,
): Promise<{ outcomes: DisputeOutcome[]; disputes: ManifestDispute[] }> {
  const orderByKey = new Map(manifest.orders.map((order) => [order.key, order]));
  const excludedIds = demoExcludedDisputeIds(manifest.disputes);
  const outcomes: DisputeOutcome[] = [];
  const disputes: ManifestDispute[] = [];

  for (const key of Object.keys(DISPUTE_ORDER_KEY).sort()) {
    // 시연 제외로 적힌 키는 건드리지 않는다 (조회도 하지 않는다).
    const excludedEntry = manifest.disputes.find((dispute) => dispute.key === key && dispute.demoExcluded === true);
    if (excludedEntry !== undefined) {
      outcomes.push({
        key,
        orderKey: excludedEntry.orderKey,
        disputeId: excludedEntry.disputeId,
        status: null,
        note: '시연 제외 — 그대로 두었다 (조회하지 않았다)',
      });
      continue;
    }

    const orderKey = orderKeyForDispute(key, manifest.disputes);
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

      const found = asArray(asRecord(res.body).items)
        .map((item) => asText(asRecord(item).dispute_id))
        .filter((id) => id !== '');
      if (found.length === 0) {
        outcomes.push({ ...base, disputeId: null, status: 200, note: '이 캡처에 걸린 분쟁이 없다 (사람이 분쟁을 접수했는지 확인한다)' });
        continue;
      }

      // 시연 제외 분쟁은 다른 키로 다시 배정하지 않는다 (T039 지시서 4번).
      const ids = found.filter((id) => !excludedIds.has(id));
      if (ids.length === 0) {
        outcomes.push({
          ...base,
          disputeId: null,
          status: 200,
          note: `이 캡처에 걸린 분쟁이 모두 시연 제외다 (${found.join(' ')}) — ${key}로 배정하지 않았다`,
        });
        continue;
      }

      const dropped = found.length - ids.length;
      const notes = [
        ids.length === 1 ? 'ok' : `분쟁이 ${ids.length}건 걸려 있어 첫 건을 적었다 (${ids.join(' ')})`,
        ...(dropped === 0 ? [] : [`시연 제외 ${dropped}건은 빼고 골랐다`]),
      ];
      disputes.push({ key, disputeId: ids[0], orderKey });
      outcomes.push({ ...base, disputeId: ids[0], status: 200, note: notes.join(' · ') });
    } catch (error) {
      outcomes.push({ ...base, disputeId: null, status: null, note: failureLine(error) });
    }
  }

  return { outcomes, disputes };
}

/**
 * 이번에 찾은 분쟁을 **이미 적힌 것 위에 덧붙인다** (T029, T001 검증 보고서 "발견한 문제" 1번).
 * 같은 키는 새로 찾은 값으로 갱신하고, 이번에 못 찾은 키는 전에 적힌 값을 그대로 남긴다 —
 * 한 건의 조회만 실패했을 때 manifest에서 다른 분쟁이 지워지지 않게 한다.
 * 결과는 키 순서로 정렬한다 (파일 차이가 조회 순서에 흔들리지 않게).
 *
 * 시연 제외 항목은 덮지 않는다. 같은 분쟁 ID를 다시 찾았을 때는 사람이 적어 둔 `note`를 남긴다
 * (T039 지시서 4번).
 */
export function mergeDisputes(existing: ManifestDispute[], found: ManifestDispute[]): ManifestDispute[] {
  const byKey = new Map(existing.map((dispute) => [dispute.key, dispute]));
  for (const dispute of found) {
    const before = byKey.get(dispute.key);
    if (before?.demoExcluded === true) continue;
    // 같은 분쟁이면 메모를 남긴다. 다른 분쟁으로 바뀌었으면 메모도 따라오지 않게 새 값만 쓴다.
    byKey.set(dispute.key, before !== undefined && before.disputeId === dispute.disputeId ? { ...before, ...dispute } : dispute);
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** D1~D3 가운데 manifest에 아직 없는 키 (키 순서). 시연 제외 항목은 "있다"로 세지 않는다. */
export function missingDisputeKeys(disputes: ManifestDispute[]): string[] {
  const have = new Set(disputes.filter((dispute) => dispute.demoExcluded !== true).map((dispute) => dispute.key));
  return Object.keys(DISPUTE_ORDER_KEY)
    .filter((key) => !have.has(key))
    .sort();
}
