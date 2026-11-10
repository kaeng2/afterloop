/**
 * 추적번호 일괄 등록 — 앱 서버가 부르는 함수 (T011, SPEC v2.7 9-3).
 *
 * 안전 규칙
 *  - 열린 분쟁이 있는 주문(연습용·시연 제외 포함)에는 GET도 POST도 하지 않는다. 판정은 이 파일 안에서 다시 한다.
 *  - 기본은 `dry_run`: 스위치가 꺼져 있으면 PayPal 호출 0회.
 *  - 스위치가 켜져 있어도 허용 목록(기본 O03)에 없는 주문은 호출하지 않는다. O05·O07은 녹화 확인이 있어야 허용된다.
 *  - `/v1/shipping/trackers*`는 쓰지 않는다. 주문별 `POST /v2/checkout/orders/{id}/track`만.
 *  - 환경 변수는 `liveGateFromEnv`만 읽는다 (서버에서 한 번 만들어 넘긴다).
 * 비밀값·구매자 개인정보·요청 본문은 결과에 싣지 않는다 (오류는 name·details[].issue·debug_id만).
 */
import type { PayPalClient } from '@/types';
import type { TrackDispute, TrackOrders } from './track-orders';

// ── 가상 추적번호 (scripts/sandbox/setup-steps.ts 와 같은 값. 테스트가 묶는다) ──

const CARRIER = 'OTHER';
export const CARRIER_NAME_OTHER = 'Fernwood Knits demo carrier';
export const trackingNumberFor = (orderKey: string): string => `FKAL${orderKey.replace(/\D/g, '').padStart(2, '0')}2026`;
export const trackRequestId = (orderKey: string): string => `afterloop-track-${orderKey}`;

// ── 분쟁이 걸린 주문 (정본) ──

export const TRACK_DISPUTED_NOTE = '분쟁 진행 중이라 제외';

export function disputedOrderKeys<D extends { orderKey: string }>(disputes: D[]): Map<string, D[]> {
  const byOrderKey = new Map<string, D[]>();
  for (const dispute of disputes) {
    byOrderKey.set(dispute.orderKey, [...(byOrderKey.get(dispute.orderKey) ?? []), dispute]);
  }
  return byOrderKey;
}

/** 보고서·로그용 긴 사유. 화면에는 `TRACK_DISPUTED_NOTE`만 쓴다. */
export const trackDisputedNote = (disputes: { key: string; demoExcluded?: boolean }[]): string => {
  const labels = disputes.map((d) => (d.demoExcluded === true ? `${d.key} · 시연 제외` : d.key));
  return labels.length === 0 ? TRACK_DISPUTED_NOTE : `${TRACK_DISPUTED_NOTE} (${labels.join(', ')})`;
};

// ── 응답 읽기 ──

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asText = (v: unknown): string => (typeof v === 'string' ? v : '');

const orderUnits = (body: unknown): unknown[] => asArray(asRecord(body).purchase_units);
const orderCaptures = (body: unknown): unknown[] =>
  orderUnits(body).flatMap((u) => asArray(asRecord(asRecord(u).payments).captures));
const orderTrackers = (body: unknown): unknown[] => [
  ...orderUnits(body).flatMap((u) => asArray(asRecord(asRecord(u).shipping).trackers)),
  ...orderCaptures(body).flatMap((c) => asArray(asRecord(c).trackers)),
];
const firstCaptureId = (body: unknown): string => asText(asRecord(orderCaptures(body)[0]).id);

/** 미등록 판정: 살아 있는(CANCELLED가 아닌) 추적이 없으면 true. `hasTracker`(scripts)와 같은 규칙. */
export const isOrderUntracked = (orderDetailBody: unknown): boolean =>
  !orderTrackers(orderDetailBody).some((t) => asText(asRecord(t).status) !== 'CANCELLED');

/** 오류 요약: name, details[].issue, debug_id만. */
function errorSummary(body: unknown): string {
  const f = asRecord(body);
  const name = asText(f.name) || asText(f.error);
  const issues = asArray(f.details)
    .map((d) => asText(asRecord(d).issue))
    .filter((s) => s !== '');
  const debugId = asText(f.debug_id);
  const parts: string[] = [];
  if (name !== '') parts.push(name);
  if (issues.length > 0) parts.push(issues.join(', '));
  if (debugId !== '') parts.push(`debug_id=${debugId}`);
  return parts.length === 0 ? '(응답에 name·issue가 없다)' : parts.join(' · ');
}

/** 던져진 오류: error.name·status·debugId만 싣는다 (message는 쓰지 않는다). */
function thrownSummary(error: unknown): { status: number | null; note: string } {
  const e = asRecord(error);
  const status = typeof e.status === 'number' ? e.status : null;
  const name = error instanceof Error ? error.name : 'Error';
  const debugId = asText(e.debugId);
  return {
    status,
    note: `호출 실패 · ${name}${status === null ? '' : ` · ${status}`}${debugId === '' ? '' : ` · debug_id=${debugId}`}`,
  };
}

// ── 스위치 ──

/** 녹화용 주문. `AFTERLOOP_TRACK_RECORDING=1`이 있어야만 허용 목록에 들어간다. */
export const RECORDING_ORDER_KEYS = ['O05', 'O07'] as const;
const DEFAULT_LIVE_ORDERS = ['O03'];

export type LiveGate = {
  /** `AFTERLOOP_TRACK_LIVE === '1'` */
  enabled: boolean;
  /** 호출을 허용하는 주문 키 */
  allowedKeys: string[];
  /** `AFTERLOOP_TRACK_RECORDING === '1'` */
  recordingConfirmed: boolean;
};

export const DRY_RUN_GATE: LiveGate = { enabled: false, allowedKeys: [], recordingConfirmed: false };

const isRecordingKey = (key: string): boolean => (RECORDING_ORDER_KEYS as readonly string[]).includes(key);

/**
 * 서버에서 한 번 부른다. `AFTERLOOP_TRACK_LIVE`·`AFTERLOOP_TRACK_LIVE_ORDERS`·`AFTERLOOP_TRACK_RECORDING`만 읽는다
 * (`NEXT_PUBLIC_` 이름은 읽지 않는다). `knownKeys`를 주면 manifest에 없는 키는 무시한다.
 */
export function liveGateFromEnv(env: Record<string, string | undefined>, knownKeys?: string[]): LiveGate {
  const enabled = env.AFTERLOOP_TRACK_LIVE === '1';
  const recordingConfirmed = env.AFTERLOOP_TRACK_RECORDING === '1';
  const raw = env.AFTERLOOP_TRACK_LIVE_ORDERS;
  const listed =
    raw === undefined || raw.trim() === ''
      ? DEFAULT_LIVE_ORDERS
      : raw
          .split(',')
          .map((k) => k.trim().toUpperCase())
          .filter((k) => k !== '');
  const allowedKeys = [...new Set(listed)]
    .filter((k) => knownKeys === undefined || knownKeys.includes(k))
    .filter((k) => recordingConfirmed || !isRecordingKey(k));
  return { enabled, allowedKeys, recordingConfirmed };
}

// ── 목록 ──

export type UntrackedRow = {
  key: string;
  orderId: string;
  state: 'untracked' | 'tracked' | 'unknown';
  excluded: boolean;
  /** 분쟁 키 (보고서·로그용. 화면에 내지 않는다) */
  disputeKeys?: string[];
  /** `unknown`일 때 이유 */
  note?: string;
};

export async function listUntracked(
  client: PayPalClient,
  orders: TrackOrders['orders'],
  disputes: TrackDispute[],
): Promise<UntrackedRow[]> {
  const disputed = disputedOrderKeys(disputes);
  const rows: UntrackedRow[] = [];
  for (const order of orders) {
    const base = { key: order.key, orderId: order.orderId };
    const found = disputed.get(order.key);
    if (found !== undefined) {
      rows.push({ ...base, state: 'unknown', excluded: true, disputeKeys: found.map((d) => d.key), note: TRACK_DISPUTED_NOTE });
      continue;
    }
    try {
      const res = await client.get(`/v2/checkout/orders/${encodeURIComponent(order.orderId)}`);
      if (res.status !== 200) {
        rows.push({ ...base, state: 'unknown', excluded: false, note: `주문 조회 → ${errorSummary(res.body)}` });
      } else {
        rows.push({ ...base, state: isOrderUntracked(res.body) ? 'untracked' : 'tracked', excluded: false });
      }
    } catch (error) {
      rows.push({ ...base, state: 'unknown', excluded: false, note: thrownSummary(error).note });
    }
  }
  return rows;
}

// ── 등록 ──

export type TrackResultKind =
  | 'added'
  | 'failed'
  | 'skipped_already_tracked'
  | 'excluded_dispute'
  | 'not_allowed'
  | 'dry_run'
  | 'unknown_order';

export type TrackItemResult = {
  dryRun: boolean;
  key: string;
  orderId: string | null;
  result: TrackResultKind;
  status: number | null;
  trackingNumber: string | null;
  note: string;
  virtualTracking: true;
};

export type TrackBatchResult = {
  results: TrackItemResult[];
  mode: 'live' | 'dry_run';
  dryRun: boolean;
  counts: { added: number; failed: number; skipped: number; excluded: number; notAllowed: number; dryRun: number };
  /** 성공한 건의 실제 상태 코드 (중복 없이) */
  statusCodes: number[];
};

export async function registerTrackers(
  client: PayPalClient,
  input: { data: TrackOrders; selectedKeys: string[]; live: LiveGate },
): Promise<TrackBatchResult> {
  const { orders, disputes } = input.data;
  const { live } = input;
  const dryRun = !live.enabled;
  const disputed = disputedOrderKeys(disputes);
  const selected = new Set(input.selectedKeys);
  const known = new Set(orders.map((o) => o.key));

  const results: TrackItemResult[] = [];
  const item = (
    key: string,
    orderId: string | null,
    result: TrackResultKind,
    status: number | null,
    trackingNumber: string | null,
    note: string,
  ): TrackItemResult => ({ dryRun, key, orderId, result, status, trackingNumber, note, virtualTracking: true });

  for (const order of orders) {
    if (!selected.has(order.key)) continue;
    const { key, orderId } = order;

    // 1) 분쟁: 무엇보다 먼저, 호출 0회
    if (disputed.has(key)) {
      results.push(item(key, orderId, 'excluded_dispute', null, null, TRACK_DISPUTED_NOTE));
      continue;
    }
    // 2) 스위치 꺼짐: 호출 0회
    if (dryRun) {
      results.push(item(key, orderId, 'dry_run', null, trackingNumberFor(key), 'Dry run — no call was made'));
      continue;
    }
    // 3) 허용 목록 (녹화용은 녹화 확인도 필요)
    if (!live.allowedKeys.includes(key) || (isRecordingKey(key) && !live.recordingConfirmed)) {
      results.push(item(key, orderId, 'not_allowed', null, null, '허용 목록에 없다'));
      continue;
    }

    const orderPath = `/v2/checkout/orders/${encodeURIComponent(orderId)}`;
    try {
      const detail = await client.get(orderPath);
      if (detail.status !== 200) {
        results.push(item(key, orderId, 'failed', detail.status, null, `주문 조회 → ${errorSummary(detail.body)}`));
        continue;
      }
      if (!isOrderUntracked(detail.body)) {
        results.push(item(key, orderId, 'skipped_already_tracked', 200, null, '이미 추적이 붙어 있다'));
        continue;
      }
      const captureId = order.captureId ?? firstCaptureId(detail.body);
      if (captureId === '') {
        results.push(item(key, orderId, 'failed', 200, null, '캡처가 없다'));
        continue;
      }
      const trackingNumber = trackingNumberFor(key);
      const res = await client.call({
        method: 'POST',
        path: `${orderPath}/track`,
        requestId: trackRequestId(key),
        body: {
          capture_id: captureId,
          tracking_number: trackingNumber,
          carrier: CARRIER,
          carrier_name_other: CARRIER_NAME_OTHER,
          notify_payer: false,
        },
      });
      results.push(
        res.status < 300
          ? item(key, orderId, 'added', res.status, trackingNumber, 'ok')
          : item(key, orderId, 'failed', res.status, trackingNumber, errorSummary(res.body)),
      );
    } catch (error) {
      const t = thrownSummary(error);
      results.push(item(key, orderId, 'failed', t.status, null, t.note));
    }
  }

  // manifest에 없는 키는 호출 없이 맨 뒤에 (중복 키는 Set이라 한 번만)
  for (const key of selected) {
    if (!known.has(key)) results.push(item(key, null, 'unknown_order', null, null, '목록에 없는 주문'));
  }

  const count = (kind: TrackResultKind): number => results.filter((r) => r.result === kind).length;
  const statusCodes = [...new Set(results.filter((r) => r.result === 'added' && r.status !== null).map((r) => r.status as number))];
  return {
    results,
    mode: dryRun ? 'dry_run' : 'live',
    dryRun,
    counts: {
      added: count('added'),
      failed: count('failed'),
      skipped: count('skipped_already_tracked'),
      excluded: count('excluded_dispute'),
      notAllowed: count('not_allowed'),
      dryRun: count('dry_run'),
    },
    statusCodes,
  };
}
