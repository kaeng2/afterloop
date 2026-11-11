/**
 * PayPal activity 기록기 (T064). **서버에서만** 부른다.
 *
 * 앱이 쓰는 PayPal 클라이언트(`getPayPalClient`가 돌려주는 것)를 감싸 호출마다 한 줄을 프로세스 메모리에 남긴다
 * (최근 `ACTIVITY_MAX`개, 최신이 앞). 서버를 다시 켜면 사라진다.
 *
 * 기록기는 T070 모드 관문(`blockWrites`) **바깥**에 있다: public에서 막힌 쓰기는 관문이 돌려준
 * `{ simulated: true }`를 보고 "Simulated · not sent"로 남고(응답 코드 없음), 실제로 나간 요청만 응답 코드와 함께 남는다.
 *
 * 남기는 것: 제목 키, 메서드, 경로(쿼리 문자열 제외), 응답 코드, 시각, 한 줄 요약(코드가 센 건수·주문 키),
 * cached / simulated. **남기지 않는 것**: 요청·응답 본문, 토큰, 비밀값, 구매자 개인정보, 쿼리 문자열.
 * 응답 본문은 건수를 세는 데만 읽고 버린다.
 *
 * 연습용·시연 제외 분쟁(연결 표 `showOnScreen: false` — HEY, GAH)과 그 주문(연습용 O04)이 경로에 들어간 호출은
 * **남기지 않는다**. 분쟁 목록 요약의 건수는 화면에 내는 분쟁만 센다.
 *
 * 토큰 발급(`/v1/oauth2/token`)은 클라이언트 안에서 일어나 이 감싸개를 지나지 않는다 (경로로도 한 번 더 거른다).
 */
import 'server-only';

import { TrackManifestSchema } from '@/paypal/track-orders';
import { getTransactions } from '@/paypal/transactions';
import type { PayPalCaller, PayPalClient } from '@/types';

import manifestJson from '../../../tests/sandbox/manifest.json';
import type { ActivityRecord, ActivitySummary, ActivityTitleKey } from '../_shared/activity-view';
import { demoLinks } from '../_shared/demo-links';

export type { ActivityRecord };

/** 메모리에 두는 최근 기록 수. */
export const ACTIVITY_MAX = 50;

const TOKEN_PATH = '/v1/oauth2/token';
const DISPUTES = '/v1/customer/disputes';
const TRANSACTIONS = '/v1/reporting/transactions';

// ───────────────────────────── 숨길 분쟁·주문 (연결 표 + 주문 목록에서) ─────────────────────────────

type HiddenSets = { disputeIds: Set<string>; orderIds: Set<string>; shownDisputeIds: Set<string>; orderKeyById: Map<string, string> };

function buildHiddenSets(): HiddenSets {
  const shownDisputeIds = new Set(demoLinks.filter((l) => l.showOnScreen).map((l) => l.paypalDisputeId));
  const disputeIds = new Set(demoLinks.filter((l) => !l.showOnScreen).map((l) => l.paypalDisputeId));

  const orderKeyById = new Map<string, string>();
  const orderIds = new Set<string>();
  const parsed = TrackManifestSchema.safeParse(manifestJson);
  if (parsed.success) {
    const { orders, disputes } = parsed.data;
    // 화면에 내는 분쟁이 걸린 주문 (연결 표의 carrierOrderId + 주문 목록의 orderKey)은 숨기지 않는다
    const keptKeys = new Set<string>([
      ...demoLinks.filter((l) => l.showOnScreen && l.carrierOrderId !== null).map((l) => l.carrierOrderId as string),
      ...disputes.filter((d) => d.disputeId !== undefined && shownDisputeIds.has(d.disputeId)).map((d) => d.orderKey),
    ]);
    const hiddenKeys = new Set(
      disputes
        .filter((d) => d.demoExcluded === true || (d.disputeId !== undefined && disputeIds.has(d.disputeId)))
        .map((d) => d.orderKey)
        .filter((key) => !keptKeys.has(key)),
    );
    for (const d of disputes) if (d.disputeId !== undefined && !shownDisputeIds.has(d.disputeId)) disputeIds.add(d.disputeId);
    for (const order of orders) {
      const ids = [order.orderId, ...(order.previousOrderIds ?? [])];
      for (const id of ids) {
        orderKeyById.set(id, order.key);
        if (hiddenKeys.has(order.key)) orderIds.add(id);
      }
    }
  }
  return { disputeIds, orderIds, shownDisputeIds, orderKeyById };
}

let hiddenCache: HiddenSets | null = null;
const hidden = (): HiddenSets => (hiddenCache ??= buildHiddenSets());

// ───────────────────────────── 경로 → 제목·요약 (순수) ─────────────────────────────

/** 쿼리 문자열·조각을 떼고, 전체 주소면 경로만. 이상한 글자가 있으면 고정 자리 글자. */
export function cleanPath(raw: string): string {
  let path = typeof raw === 'string' ? raw : '';
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = '';
    }
  }
  path = path.split('?')[0].split('#')[0];
  return /^\/[A-Za-z0-9/_.~%-]*$/.test(path) ? path : '/(path)';
}

const segmentsOf = (path: string) =>
  path
    .split('/')
    .filter((s) => s !== '')
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });

/** 경로에 숨길 분쟁·주문 번호가 들어 있는가. */
export function isHiddenPath(path: string, sets: HiddenSets = hidden()): boolean {
  return segmentsOf(path).some((s) => sets.disputeIds.has(s) || sets.orderIds.has(s));
}

/** 분쟁 번호의 짧은 꼴 (`PP-R-GMS-10197661` → `GMS-10197661`). */
export function shortDisputeId(id: string): string {
  return id.replace(/^PP-[A-Z]-/, '').replace(/^PP-/, '');
}

type Classified = { title: ActivityTitleKey; shortId?: string; orderId?: string };

export function classify(method: string, path: string): Classified {
  const m = method.toUpperCase();
  if (path === DISPUTES && m === 'GET') return { title: 'readCases' };
  const dispute = path.match(/^\/v1\/customer\/disputes\/([^/]+)(\/([^/]+))?$/);
  if (dispute !== null) {
    const id = decodeURIComponent(dispute[1]);
    if (dispute[3] === undefined && m === 'GET') return { title: 'readCase', shortId: shortDisputeId(id) };
    if (dispute[3] === 'send-message' && m === 'POST') return { title: 'sendMessage' };
    if (dispute[3] === 'make-offer' && m === 'POST') return { title: 'sendOffer' };
  }
  const order = path.match(/^\/v2\/checkout\/orders\/([^/]+)(\/track)?$/);
  if (order !== null) {
    const orderId = decodeURIComponent(order[1]);
    if (order[2] === '/track' && m === 'POST') return { title: 'addTracking', orderId };
    if (order[2] === undefined && m === 'GET') return { title: 'readOrder', orderId };
  }
  if (path === TRANSACTIONS && m === 'GET') return { title: 'readSales' };
  return { title: 'other' };
}

/** 응답 본문에서 건수만 센다 (본문은 남기지 않는다). 꼴이 다르면 요약 없음. */
function countItems(body: unknown, field: string, filter?: (item: unknown) => boolean): number | null {
  if (typeof body !== 'object' || body === null) return null;
  const list = (body as Record<string, unknown>)[field];
  if (!Array.isArray(list)) return null;
  return filter === undefined ? list.length : list.filter(filter).length;
}

function summaryFor(c: Classified, status: number | null, body: unknown, sets: HiddenSets): ActivitySummary | undefined {
  if (c.orderId !== undefined) {
    const key = sets.orderKeyById.get(c.orderId);
    return key === undefined ? undefined : { kind: 'order', orderKey: key };
  }
  if (status === null || status < 200 || status >= 300) return undefined;
  if (c.title === 'readCases') {
    const count = countItems(body, 'items', (item) => {
      const id = typeof item === 'object' && item !== null ? (item as Record<string, unknown>).dispute_id : undefined;
      return typeof id === 'string' && sets.shownDisputeIds.has(id);
    });
    return count === null ? undefined : { kind: 'cases', count };
  }
  if (c.title === 'readSales') {
    const count = countItems(body, 'transaction_details');
    return count === null ? undefined : { kind: 'transactions', count };
  }
  return undefined;
}

const isSimulatedBody = (body: unknown) =>
  typeof body === 'object' && body !== null && (body as Record<string, unknown>).simulated === true;

// ───────────────────────────── 메모리 기록 ─────────────────────────────

let records: ActivityRecord[] = [];
let seq = 0;
let clock: () => number = () => Date.now();

function push(record: Omit<ActivityRecord, 'id' | 'at'>): void {
  seq += 1;
  records = [{ id: `a${seq}`, at: new Date(clock()).toISOString(), ...record }, ...records].slice(0, ACTIVITY_MAX);
}

/** 기록 (최신이 앞). 복사본이다. */
export function listActivity(): ActivityRecord[] {
  return records.map((r) => ({ ...r, ...(r.summary === undefined ? {} : { summary: { ...r.summary } }) }));
}

/** 테스트 전용: 비우고 시계를 바꾼다. */
export function resetActivityForTest(now?: () => number): void {
  records = [];
  seq = 0;
  clock = now ?? (() => Date.now());
  hiddenCache = null;
}

/** 호출 1건을 남긴다. 숨길 경로·토큰 발급이면 남기지 않는다. */
export function recordCall(input: { method: string; path: string; status: number | null; body?: unknown; simulated?: boolean }): void {
  try {
    const path = cleanPath(input.path);
    if (path === TOKEN_PATH) return;
    const sets = hidden();
    if (isHiddenPath(path, sets)) return;
    const method = input.method.toUpperCase();
    const c = classify(method, path);
    const simulated = input.simulated === true || (method !== 'GET' && isSimulatedBody(input.body));
    const summary = summaryFor(c, simulated ? null : input.status, input.body, sets);
    push({
      method,
      path,
      title: c.title,
      ...(c.shortId === undefined ? {} : { shortId: c.shortId }),
      status: simulated ? null : input.status,
      ...(summary === undefined ? {} : { summary }),
      cached: false,
      simulated,
    });
  } catch {
    // 기록 실패가 호출을 망치지 않는다
  }
}

/** 거래 조회를 캐시에서 준 경우 (PayPal 호출 없음) 한 줄. */
export function recordCachedSalesRead(count: number): void {
  push({ method: 'GET', path: TRANSACTIONS, title: 'readSales', status: 200, summary: { kind: 'transactions', count }, cached: true, simulated: false });
}

// ───────────────────────────── 감싸개 ─────────────────────────────

/** POST 호출기를 감싼다. `simulated: true`면 결과와 무관하게 가짜 전송으로 남긴다 (`send.ts`의 가짜 호출기). */
export function recordCaller(call: PayPalCaller, opts: { simulated?: boolean } = {}): PayPalCaller {
  return async (req) => {
    try {
      const res = await call(req);
      recordCall({ method: req.method, path: req.path, status: res.status, body: res.body, simulated: opts.simulated });
      return res;
    } catch (error) {
      recordCall({ method: req.method, path: req.path, status: null, simulated: opts.simulated });
      throw error;
    }
  };
}

/** 클라이언트의 읽기·쓰기를 모두 기록한다. 결과·예외는 그대로 돌려준다. */
export function recordClient(client: PayPalClient): PayPalClient {
  return {
    get: async (path) => {
      try {
        const res = await client.get(path);
        recordCall({ method: 'GET', path, status: res.status, body: res.body });
        return res;
      } catch (error) {
        recordCall({ method: 'GET', path, status: null });
        throw error;
      }
    },
    call: recordCaller((req) => client.call(req)),
  };
}

/**
 * `getTransactions`와 같다. 캐시에서 준 값이면(호출 0회) "cached" 한 줄을 남긴다.
 * 화면(`products/transactions-line.ts`)이 이것을 부르면 캐시 적중이 서랍에 보인다.
 */
export async function getTransactionsRecorded(...args: Parameters<typeof getTransactions>): ReturnType<typeof getTransactions> {
  const result = await getTransactions(...args);
  // 캐시 적중(TTL 안) 또는 클라이언트 없음 → PayPal 호출 0회. 새로 읽다 실패한 경우(`refreshFailed`)는 그 호출이 이미 남았다
  if (result.ok && result.cached && result.refreshFailed === undefined) {
    recordCachedSalesRead(result.summary.saleCount + result.summary.refundCount);
  }
  return result;
}
