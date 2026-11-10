/**
 * 거래 조회 (Transaction Search) + 캐시 (T019, SPEC v2.8 2장·9-4장). **조회(GET)만** 한다.
 *
 * 화면(S2)이 "PayPal sandbox · 거래 N건 · cached" 한 줄을 보이기 위한 읽기 전용 경로다.
 * 이 결과는 시뮬레이션 입력이 아니다 (엔진에 들어가지 않고 예상 손실을 바꾸지 않는다).
 * 숫자 판정은 하지 않는다: 읽은 거래를 화면용 모양으로 바꾸고 행을 세는 것까지만 한다.
 *
 * 응답은 신뢰하지 않는 입력이다. zod 스키마에는 필요한 칸만 적는다 — 구매자 이름·이메일·주소·전화·
 * `payer_id` 같은 칸은 스키마에 아예 없으므로 읽히지 않는다 (나라 코드만 받는다). 로그(`console.*`)는 남기지 않고,
 * 오류는 고정 코드로만 돌려준다 (PayPal 응답 본문·URL·헤더·예외 메시지를 옮기지 않는다).
 *
 * 시각은 인자(`deps.now`)로만 받는다. `Date.now()`를 직접 부르지 않는다.
 */
import { z } from 'zod';

import type { PayPalClient } from '@/types';

// ── 상수 ─────────────────────────────────────────────────────────────────────

export const TRANSACTIONS_PATH = '/v1/reporting/transactions';
/** PayPal이 한 번에 받는 기간 (일). */
export const MAX_RANGE_DAYS_PER_CALL = 31;
/** 이 함수가 받는 전체 기간 (일). 시드 90일 창 + 여유. 31일 × 3번 호출. */
export const MAX_RANGE_DAYS_TOTAL = 93;
/** 메모리 캐시 유효 시간 (컨트롤 타워 결정 3번: 15분). `config/`를 못 고치므로 여기에 둔다. */
export const TRANSACTION_CACHE_TTL_MS = 15 * 60 * 1000;
/** 기간 조각 하나에서 따라갈 쪽 수 상한. 넘으면 일부만 세지 않고 실패한다. */
export const MAX_PAGES_PER_CHUNK = 20;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;
const DAY_MS = 86_400_000;

// ── 타입 ─────────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD', UTC, 양 끝 포함. */
export type TransactionRange = { startDate: string; endDate: string };

export type SaleRow = {
  /** 화면에 응답 ID를 그대로 보이기 위함. 비밀값 아님 */
  transactionId: string;
  /** 'YYYY-MM-DD' (UTC) */
  date: string;
  itemName: string;
  quantity: number;
  /** 정수 센트. 글자로 잘라 만든다. USD가 아니면 null */
  amountCents: number | null;
  currency: string;
  /** `payer_info.country_code`만 */
  countryCode: string | null;
};

export type TransactionSummary = {
  source: 'paypal_transaction_search';
  range: TransactionRange;
  sales: SaleRow[];
  saleCount: number;
  refundCount: number;
  byItem: { itemName: string; orderCount: number; units: number }[];
  byCountry: { countryCode: string; orderCount: number }[];
  lastRefreshedAt: string | null;
};

type FailureReason = 'invalid_range' | 'paypal_unavailable' | 'not_permitted' | 'rate_limited' | 'unexpected_response';
type RefreshFailure = 'paypal_unavailable' | 'not_permitted' | 'rate_limited';

export type TransactionsResult =
  | {
      ok: true;
      summary: TransactionSummary;
      /** true면 화면이 'cached' 배지를 붙인다 */
      cached: boolean;
      /** 이 값을 PayPal에서 읽은 시각 (ISO). 캐시면 그때의 시각 */
      fetchedAt: string;
      /** 새로 읽다 실패해서 옛 캐시를 돌려줄 때만 */
      refreshFailed?: RefreshFailure;
    }
  | { ok: false; reason: FailureReason };

export type TransactionCache = {
  get(key: string): { value: TransactionSummary; storedAtMs: number } | undefined;
  set(key: string, value: TransactionSummary, storedAtMs: number): void;
};

/** 읽기 실패를 고정 코드로 나르는 내부 예외. 메시지는 비워 둔다. */
class TransactionsError extends Error {
  readonly reason: Exclude<FailureReason, 'invalid_range'>;
  constructor(reason: Exclude<FailureReason, 'invalid_range'>) {
    super(reason);
    this.name = 'TransactionsError';
    this.reason = reason;
  }
}

// ── 기간 (순수 함수) ─────────────────────────────────────────────────────────

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' → UTC 자정 ms. 달력에 없는 날(2월 30일 등)이나 꼴이 틀리면 null. */
function dayToMs(text: string): number | null {
  const m = typeof text === 'string' ? DATE_PATTERN.exec(text) : null;
  if (m === null) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(ms)) return null;
  return msToDay(ms) === text ? ms : null;
}

function msToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 범위를 검사해 (시작 ms, 끝 ms)를 돌려준다. 잘못되면 null. */
function checkRange(range: TransactionRange): { startMs: number; endMs: number } | null {
  if (typeof range !== 'object' || range === null) return null;
  const startMs = dayToMs(range.startDate);
  const endMs = dayToMs(range.endDate);
  if (startMs === null || endMs === null || startMs > endMs) return null;
  const days = Math.round((endMs - startMs) / DAY_MS) + 1;
  if (days > MAX_RANGE_DAYS_TOTAL) return null;
  return { startMs, endMs };
}

/** 오늘(UTC)을 끝으로 하는 `days`일 구간. 예: days=90 → 오늘 포함 90일. */
export function lastDays(nowMs: number, days: number): TransactionRange {
  const todayMs = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    new Date(nowMs).getUTCDate(),
  );
  const span = Number.isInteger(days) && days >= 1 ? days : 1;
  return { startDate: msToDay(todayMs - (span - 1) * DAY_MS), endDate: msToDay(todayMs) };
}

/** 31일 이하 조각들. 조각끼리 겹치지 않고 처음·끝이 입력과 같다. 잘못된 기간이면 빈 배열. */
export function splitRange(range: TransactionRange): TransactionRange[] {
  const checked = checkRange(range);
  if (checked === null) return [];
  const out: TransactionRange[] = [];
  let cursor = checked.startMs;
  while (cursor <= checked.endMs) {
    const chunkEnd = Math.min(cursor + (MAX_RANGE_DAYS_PER_CALL - 1) * DAY_MS, checked.endMs);
    out.push({ startDate: msToDay(cursor), endDate: msToDay(chunkEnd) });
    cursor = chunkEnd + DAY_MS;
  }
  return out;
}

/**
 * 조회 경로. 쿼리는 `URLSearchParams`로 퍼센트 인코딩한다 (`+0000`의 `+`는 `%2B`가 된다).
 * 한 번에 받는 기간(31일)을 넘거나 날짜가 틀리거나 `page_size`가 1~500이 아니면 예외.
 */
export function buildTransactionsPath(range: TransactionRange, page: number, pageSize: number = DEFAULT_PAGE_SIZE): string {
  const checked = checkRange(range);
  if (checked === null) throw new Error('거래 조회 기간이 올바르지 않다');
  if ((checked.endMs - checked.startMs) / DAY_MS + 1 > MAX_RANGE_DAYS_PER_CALL) {
    throw new Error(`한 번에 조회하는 기간은 ${MAX_RANGE_DAYS_PER_CALL}일 이하여야 한다`);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new Error(`page_size는 1~${MAX_PAGE_SIZE}의 정수여야 한다`);
  }
  if (!Number.isInteger(page) || page < 1) throw new Error('page는 1 이상의 정수여야 한다');

  const query = new URLSearchParams();
  query.set('start_date', `${range.startDate}T00:00:00+0000`);
  query.set('end_date', `${range.endDate}T23:59:59+0000`);
  query.set('fields', 'all');
  query.set('page_size', String(pageSize));
  query.set('page', String(page));
  return `${TRANSACTIONS_PATH}?${query.toString()}`;
}

// ── 응답 스키마 (필요한 칸만) ─────────────────────────────────────────────────

const moneySchema = z.object({ currency_code: z.string().min(1), value: z.string() });

const itemSchema = z.object({
  item_name: z.string().min(1),
  item_quantity: z.union([z.string(), z.number()]),
  total_item_amount: moneySchema.optional(),
});

const detailSchema = z.object({
  transaction_info: z.object({
    transaction_id: z.string().min(1),
    transaction_initiation_date: z.string(),
    transaction_status: z.string().min(1),
    transaction_amount: moneySchema,
  }),
  // 이름·이메일·주소·전화·payer_id는 일부러 적지 않는다. 나라 코드만 받는다.
  payer_info: z.object({ country_code: z.string().optional() }).optional(),
  cart_info: z.object({ item_details: z.array(itemSchema).optional() }).optional(),
});

const pageSchema = z.object({
  transaction_details: z.array(detailSchema).optional().default([]),
  total_pages: z.number().int().min(0).optional().default(1),
  last_refreshed_datetime: z.string().optional(),
});

// ── 값 변환 (글자로 자른다. 소수 계산을 하지 않는다) ──────────────────────────

const AMOUNT_PATTERN = /^(-?)(\d{1,12})(?:\.(\d{1,2}))?$/;
const QUANTITY_PATTERN = /^\d{1,6}$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function unexpected(): never {
  throw new TransactionsError('unexpected_response');
}

/** "48.00" → { negative:false, cents:4800 }. "1,234.50"처럼 PayPal이 주지 않는 꼴은 unexpected_response. */
function parseAmount(value: string): { negative: boolean; cents: number } {
  const m = AMOUNT_PATTERN.exec(value);
  if (m === null) return unexpected();
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents)) return unexpected();
  return { negative: m[1] === '-' && cents > 0, cents };
}

/** PayPal 시각(`2014-07-11T04:03:52-0700`) → UTC ms. 꼴이 틀리면 unexpected_response. */
function parseDateTime(text: string): number {
  const m = DATETIME_PATTERN.exec(text);
  if (m === null) return unexpected();
  const dayMs = dayToMs(m[1]);
  const [h, mi, s] = [Number(m[2]), Number(m[3]), Number(m[4])];
  if (dayMs === null || h > 23 || mi > 59 || s > 59) return unexpected();
  let offsetMin = 0;
  if (m[5] !== 'Z') {
    const digits = m[5].replace(':', '');
    offsetMin = (digits[0] === '-' ? -1 : 1) * (Number(digits.slice(1, 3)) * 60 + Number(digits.slice(3, 5)));
  }
  return dayMs + ((h * 60 + mi) * 60 + s) * 1000 - offsetMin * 60_000;
}

type RawDetail = z.infer<typeof detailSchema>;

type ParsedTx = {
  id: string;
  kind: 'sale' | 'refund' | 'other';
  rows: SaleRow[];
  countryCode: string | null;
};

function parseTransaction(detail: RawDetail): ParsedTx {
  const info = detail.transaction_info;
  const dateMs = parseDateTime(info.transaction_initiation_date);
  const amount = parseAmount(info.transaction_amount.value);
  const id = info.transaction_id;

  if (info.transaction_status !== 'S') return { id, kind: 'other', rows: [], countryCode: null };
  if (amount.negative) return { id, kind: 'refund', rows: [], countryCode: null };
  if (amount.cents === 0) return { id, kind: 'other', rows: [], countryCode: null };

  const rawCountry = detail.payer_info?.country_code;
  const countryCode = rawCountry !== undefined && COUNTRY_PATTERN.test(rawCountry) ? rawCountry : null;
  const items = detail.cart_info?.item_details ?? [];
  const date = msToDay(dateMs);

  const rows: SaleRow[] = items.map((item) => {
    const quantityText = String(item.item_quantity);
    if (!QUANTITY_PATTERN.test(quantityText) || Number(quantityText) < 1) return unexpected();
    // 품목 금액이 있으면 그것을, 없고 품목이 하나뿐이면 거래 금액을 쓴다. 그 밖에는 모른다(null).
    const money = item.total_item_amount ?? (items.length === 1 ? info.transaction_amount : undefined);
    let amountCents: number | null = null;
    let currency = info.transaction_amount.currency_code;
    if (money !== undefined) {
      currency = money.currency_code;
      const parsed = parseAmount(money.value);
      amountCents = currency === 'USD' ? parsed.cents : null;
    }
    return { transactionId: id, date, itemName: item.item_name, quantity: Number(quantityText), amountCents, currency, countryCode };
  });
  return { id, kind: 'sale', rows, countryCode };
}

// ── 읽기와 변환 ──────────────────────────────────────────────────────────────

/** 호출이 던진 예외 또는 응답 상태를 고정 코드로. 메시지·본문은 옮기지 않는다. */
function reasonForStatus(status: unknown): Exclude<FailureReason, 'invalid_range' | 'unexpected_response'> {
  if (status === 401 || status === 403) return 'not_permitted';
  if (status === 429) return 'rate_limited';
  return 'paypal_unavailable';
}

async function getPage(client: PayPalClient, path: string): Promise<z.infer<typeof pageSchema>> {
  let res: { status: number; body: unknown };
  try {
    res = await client.get(path);
  } catch (error) {
    const status = typeof error === 'object' && error !== null ? (error as { status?: unknown }).status : undefined;
    throw new TransactionsError(reasonForStatus(status));
  }
  if (res.status !== 200) throw new TransactionsError(reasonForStatus(res.status));
  const parsed = pageSchema.safeParse(res.body);
  if (!parsed.success) return unexpected();
  return parsed.data;
}

/**
 * 기간의 완료 거래를 모두 읽어 화면용 요약으로 바꾼다. `client.get`만 쓴다.
 * 실패하면 `TransactionsError`(고정 코드)를 던진다. 공개 진입점은 `getTransactions`다.
 */
export async function fetchTransactions(client: PayPalClient, range: TransactionRange): Promise<TransactionSummary> {
  const chunks = splitRange(range);
  if (chunks.length === 0) throw new Error('거래 조회 기간이 올바르지 않다');

  const seen = new Set<string>();
  const sales: SaleRow[] = [];
  const itemOrders = new Map<string, Set<string>>();
  const itemUnits = new Map<string, number>();
  const countryOrders = new Map<string, number>();
  let saleCount = 0;
  let refundCount = 0;
  let refreshedMs: number | null = null;
  let refreshedText: string | null = null;

  for (const chunk of chunks) {
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page += 1) {
      if (page > MAX_PAGES_PER_CHUNK) return unexpected(); // 일부만 세지 않는다
      const data = await getPage(client, buildTransactionsPath(chunk, page));
      if (page === 1) totalPages = data.total_pages;

      if (data.last_refreshed_datetime !== undefined) {
        const ms = parseDateTime(data.last_refreshed_datetime);
        if (refreshedMs === null || ms < refreshedMs) {
          refreshedMs = ms;
          refreshedText = data.last_refreshed_datetime;
        }
      }

      for (const detail of data.transaction_details) {
        const tx = parseTransaction(detail);
        if (seen.has(tx.id)) continue; // 조각 경계에서 두 번 온 거래
        seen.add(tx.id);
        if (tx.kind === 'refund') refundCount += 1;
        if (tx.kind !== 'sale') continue;

        saleCount += 1;
        sales.push(...tx.rows);
        if (tx.countryCode !== null) {
          countryOrders.set(tx.countryCode, (countryOrders.get(tx.countryCode) ?? 0) + 1);
        }
        for (const row of tx.rows) {
          const orders = itemOrders.get(row.itemName) ?? new Set<string>();
          orders.add(row.transactionId);
          itemOrders.set(row.itemName, orders);
          itemUnits.set(row.itemName, (itemUnits.get(row.itemName) ?? 0) + row.quantity);
        }
      }
    }
  }

  const byItem = [...itemOrders.entries()]
    .map(([itemName, orders]) => ({ itemName, orderCount: orders.size, units: itemUnits.get(itemName) ?? 0 }))
    .sort((a, b) => (a.itemName < b.itemName ? -1 : a.itemName > b.itemName ? 1 : 0));
  const byCountry = [...countryOrders.entries()]
    .map(([countryCode, orderCount]) => ({ countryCode, orderCount }))
    .sort((a, b) => (a.countryCode < b.countryCode ? -1 : a.countryCode > b.countryCode ? 1 : 0));

  return {
    source: 'paypal_transaction_search',
    range: { startDate: range.startDate, endDate: range.endDate },
    sales,
    saleCount,
    refundCount,
    byItem,
    byCountry,
    lastRefreshedAt: refreshedText,
  };
}

// ── 캐시와 공개 함수 ─────────────────────────────────────────────────────────

/** 서버 메모리 캐시 (컨트롤 타워 결정 2번). 비밀·개인정보가 디스크에 남을 길이 없다. 서버가 다시 뜨면 빈다. */
export function createMemoryTransactionCache(): TransactionCache {
  const store = new Map<string, { value: TransactionSummary; storedAtMs: number }>();
  return {
    get: (key) => store.get(key),
    set: (key, value, storedAtMs) => {
      store.set(key, { value, storedAtMs });
    },
  };
}

/**
 * 화면이 부르는 함수. 캐시가 TTL 안이면 호출 없이 `cached: true`, 아니면 읽는다.
 * 읽다 실패했는데 옛 캐시가 있으면 옛 값을 `cached: true` + `refreshFailed`로 돌려준다.
 * `client === null`이면 호출 없이 캐시만 본다.
 */
export async function getTransactions(
  client: PayPalClient | null,
  range: TransactionRange,
  deps: { now: () => number; cache: TransactionCache },
  opts?: { forceRefresh?: boolean },
): Promise<TransactionsResult> {
  if (checkRange(range) === null) return { ok: false, reason: 'invalid_range' };

  const key = `${range.startDate}_${range.endDate}`;
  const nowMs = deps.now();
  const entry = deps.cache.get(key);
  const fromCache = (refreshFailed?: RefreshFailure): TransactionsResult => {
    if (entry === undefined) return { ok: false, reason: 'paypal_unavailable' };
    return {
      ok: true,
      summary: entry.value,
      cached: true,
      fetchedAt: new Date(entry.storedAtMs).toISOString(),
      ...(refreshFailed === undefined ? {} : { refreshFailed }),
    };
  };

  const fresh = entry !== undefined && nowMs - entry.storedAtMs >= 0 && nowMs - entry.storedAtMs < TRANSACTION_CACHE_TTL_MS;
  if (fresh && opts?.forceRefresh !== true) return fromCache();

  if (client === null) {
    if (entry === undefined) return { ok: false, reason: 'paypal_unavailable' };
    return fromCache(fresh ? undefined : 'paypal_unavailable');
  }

  try {
    const summary = await fetchTransactions(client, range);
    deps.cache.set(key, summary, nowMs);
    return { ok: true, summary, cached: false, fetchedAt: new Date(nowMs).toISOString() };
  } catch (error) {
    const reason: Exclude<FailureReason, 'invalid_range'> =
      error instanceof TransactionsError ? error.reason : 'paypal_unavailable';
    if (entry === undefined) return { ok: false, reason };
    // 옛 캐시가 있으면 그것을 돌려준다. 응답 꼴이 틀린 경우도 화면에는 "새로 읽지 못함"으로만 알린다.
    return fromCache(reason === 'unexpected_response' ? 'paypal_unavailable' : reason);
  }
}
