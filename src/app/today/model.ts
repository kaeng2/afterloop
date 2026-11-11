/**
 * Today 탭 보기용 값 (T060, SPEC v2.10 2장). **그리지 않고 계산하지 않는다** — 엔진 결과를 옮겨 목록을 만든다.
 *
 * 목록은 데이터에서 만든다 (손으로 쓴 목록이 없다):
 * - 분쟁 항목: `loadDemoDisputes`가 연결 표(`showOnScreen`)로 걸러 낸 분쟁. 묶음은 엔진 `decideAutopilot` 판정
 *   (악용 의심으로 건너뜀 → Routine, 그 밖 → Needs you). 위험 배지는 엔진 `escalationRisk`.
 * - 추적 항목: `listUntracked`(조회만)에서 분쟁이 걸리지 않은 미등록 주문 수. 조회에 실패하면 항목이 없다.
 * - Prevent 항목: `simulateStore`(처방 4개 모두) 결과에 엔진 `pickPreventProduct`(T066)를 부른 상품
 *   (줄어드는 비율이 가장 큰 상품. DECISIONS v2.10).
 * - 목록 한 줄의 점 = 위험 등급, 알약 = 상태 (T067). 둘 다 엔진 판정·묶음에서 고른다.
 *
 * 금액 표시는 `toDollarsRounded` 한 곳. 글자는 `today.*`·`case.view.lang.*` 문구에서 읽는다.
 * 이 파일은 PayPal·LLM을 부르지 않는다 (서버 읽기는 `../_server/today.ts`).
 */
import { decideAutopilot } from '@/engine/autopilot';
import { escalationRisk } from '@/engine/escalation';
import { paramsFromConfig, rulesFromConfig } from '@/engine/params';
import { recommend } from '@/engine/recommend';
import { FIX_ORDER } from '@/engine/sim';
import { pickPreventProduct, simulateStore, type PreventPick } from '@/engine/storefront';
import type {
  AutopilotDecision,
  BoardState,
  Evaluation,
  ParamsConfig,
  PolicyConfig,
  SeedBuyer,
  SeedProduct,
  WeeklySummary,
} from '@/types';

import type { RiskBand } from '../_shared/badge-keys';
import { copyTables, t } from '../_shared/copy';
import { pickBoard, type LoadedDispute } from '../_shared/dispute-view';
import { toDollarsRounded } from '../_shared/money';
import { shortDate } from '../_shared/short-date';
import { categoryLabel, latinName, productIconOf, type ProductIconKind } from '../cases/desk-model';
import { productShortName } from '../cases/model';

// ── 구매자 이름 ─────────────────────────────────────────────────────────────

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

/**
 * 목록에 쓰는 구매자 이름 (T060 재시도 2번). 시드 이름에 한글 낱말이 있으면 한글이 아닌 낱말 중 첫 낱말
 * ("김서연 Seo-yeon Kim" → "Seo-yeon"), 없으면 이름 전체 ("Mike Morgan" → "Mike Morgan").
 */
export function buyerShortName(seedName: string): string {
  const words = seedName.trim().split(/\s+/).filter((word) => word !== '');
  if (!words.some((word) => HANGUL.test(word))) return words.join(' ');
  return words.find((word) => !HANGUL.test(word)) ?? words.join(' ');
}

// ── 날짜 줄 ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

/** 판매자 시간대의 달력 날짜 (`YYYY-MM-DD`). */
function calendarDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function utcDay(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** 판매자 시간대 오늘부터 대목 날짜까지 남은 날 수 (달력 기준). */
export function daysUntil(now: Date, peakDate: string, timeZone: string): number {
  return Math.round((utcDay(peakDate) - utcDay(calendarDate(now, timeZone))) / MS_PER_DAY);
}

/** "Tue, Nov 10 · 17 days to Black Friday". 대목이 지났으면 날짜만. */
export function dateLine(now: Date): string {
  const timeZone = t('today.sellerTimeZone');
  const date = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(now);
  const days = daysUntil(now, t('today.peakDate'), timeZone);
  if (days < 0) return t('today.dateOnly', { date });
  const peak = t('today.peakName');
  return days === 1 ? t('today.dateLineOne', { date, peak }) : t('today.dateLine', { date, days, peak });
}

// ── 목록 항목 ──────────────────────────────────────────────────────────────

export type TodayGroupKey = 'needsYou' | 'prevent' | 'routine';

/** 목록 왼쪽 점 색. */
export type TodayDot = 'high' | 'watch' | 'low' | 'neutral';

/** 목록 오른쪽 상태 알약. `tone`은 배경·글자 색 묶음 (high = 연분홍, watch = 연노랑, neutral = 회색). */
export type TodayStatus = { key: string; tone: 'high' | 'watch' | 'neutral' };

export type TodayItem = {
  /** 주소의 `item` 값 (분쟁 번호 · `tracking` · 상품 SKU). */
  id: string;
  kind: 'dispute' | 'tracking' | 'prevent';
  group: TodayGroupKey;
  href: string;
  /** 첫 줄 굵은 글자 ("Seo-yeon", "2 orders without tracking", "Knit Cardigan, Oat"). */
  name: string;
  /** 첫 줄 뒤 유형 짧은 이름 ("customs hold"). 없으면 `null`. */
  label: string | null;
  /** 아래 줄. 없으면 `null`. */
  sub: string | null;
  /** 엔진 위험 단계 (`escalationRisk`. 추적 항목은 고정 Watch). 없으면 `null`. */
  band: RiskBand | null;
  /** 왼쪽 점 = 위험 등급 색 (T067). Routine·Prevent·위험 없음은 `neutral`. */
  dot: TodayDot;
  /** 오른쪽 상태 알약 = 상태 (T067). 글자는 문구 키, 고르는 기준은 엔진 판정·묶음. */
  status: TodayStatus;
  /** 정렬용 엔진 점수 (분쟁만). */
  score: number | null;
  /** 정렬용 응답 기한 (분쟁만, ISO 8601. 모르면 빈 글자). */
  dueDate: string;
  /** 시안 v4 한 줄 (T076). 글자는 데이터·문구에서, 숫자는 세기만. */
  row: TodayRowView;
};

/** 시안 v4 목록 한 줄: 상품 아이콘 · "PP-R-… · Wool Sweater" · 범주 알약 · "Reply by Nov 30" · "Seo-yeon Kim · KR". */
export type TodayRowView = {
  icon: ProductIconKind;
  /** 굵은 머리 (분쟁 번호 · "2 orders" · 상품 이름). */
  head: string;
  /** 머리 뒤 상품 이름. 없으면 `null`. */
  product: string | null;
  category: string | null;
  categoryTone: 'high' | 'neutral';
  /** "Reply by Nov 30" (PayPal 응답 기한). 없으면 `null`. */
  due: string | null;
  /** 아래 줄 (구매자 · 나라 / 엔진 판정 글). 없으면 `null`. */
  who: string | null;
  /** 이 항목이 걸린 상품 SKU (상품 거르개). */
  skus: string[];
};

export type TodayGroup = { key: TodayGroupKey; title: string; hint: string; items: TodayItem[] };

/** 상품 거르개 줄의 알약 하나. `sku`가 `null`이면 "All products". */
export type ProductChipView = {
  sku: string | null;
  name: string;
  sub: string;
  icon: ProductIconKind;
  /** 이 상품에 걸린 화면 속 열린 분쟁 수 (세기만). */
  cases: number;
  href: string;
  selected: boolean;
};

export type ProductFilterView = { chips: ProductChipView[]; summary: string; selectedSku: string | null };

/** 추적 등록 안 된 주문 한 줄 (보기용). */
export type TrackingOrderView = {
  key: string;
  buyerName: string | null;
  productName: string | null;
  /** T091 "+$N just now"의 엔진 입력 (`trackingSavings`). 모르면 없음 → 그 주문은 더하지 않는다. */
  sku?: string;
  amountCents?: number;
};

/** 추적 항목 입력. `null`이면 조회 실패 → 항목을 숨긴다. */
export type TrackingSummary = {
  /** 분쟁이 걸리지 않은 미등록 주문 (수 = 이 길이). */
  untracked: TrackingOrderView[];
  /** 분쟁이 걸려 빠진 미등록 주문 (연습용·시연 제외 분쟁은 넣지 않는다). */
  excluded: TrackingOrderView[];
};

export type StoreLine = { beforeCents: number; afterCents: number; text: string };

export type TodayView = {
  dateLine: string;
  storeLine: StoreLine;
  groups: TodayGroup[];
  /** 목록에 실제로 보이는 항목 수 (위쪽 막대 Today (N)). 상품 거르개와 상관없이 전체. */
  count: number;
  tracking: TrackingSummary | null;
  /** 상품 거르개 줄 (T076). */
  filter: ProductFilterView;
  /** 화면에 보이는 열린 분쟁 수 (세기만. 이번 주 카드). */
  openDisputes: number;
};

export type TodayInput = {
  disputes: LoadedDispute[];
  tracking: TrackingSummary | null;
  products: readonly SeedProduct[];
  now: Date;
  params?: ParamsConfig;
  rules?: PolicyConfig;
  /** 상품 거르개 (`?sku=`). 모르는 SKU면 거르지 않는다. */
  sku?: string;
};

/**
 * 추적 미등록 주문은 엔진 점수가 없어 고정 표시 (T061 6번). 엔진 `escalationRisk` 결과가 아니라
 * "추적 항목은 늘 Watch로 보인다"는 고정 상태 표시다 — 지시서 T060 3절 "Watch 배지".
 */
const UNTRACKED_FIXED_WATCH_BAND: RiskBand = 'Watch';

const BAND_RANK: Record<RiskBand, number> = { High: 3, Watch: 2, Low: 1 };

/** 1 → "1st", 3 → "3rd" (유형 짧은 이름 "3rd claim"). 엔진 `decideAutopilot` 로그 문구와 같은 규칙. */
export function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

function hasCopy(key: string): boolean {
  return typeof copyTables.en[key] === 'string';
}

/** 유형 짧은 이름. `today.kind.<세부 유형>`이 있으면 그것, 없으면 사례 화면의 짧은 이름. */
function kindLabel(subtype: string | undefined, priorInr: number): string | null {
  if (subtype === undefined) return null;
  const key = `today.kind.${subtype}`;
  if (!hasCopy(key)) return hasCopy(`case.view.subtypeShort.${subtype}`) ? t(`case.view.subtypeShort.${subtype}`) : null;
  return copyTables.en[key].includes('{{ordinal}}') ? t(key, { ordinal: ordinal(priorInr + 1) }) : t(key);
}

function languageOf(buyer: Pick<SeedBuyer, 'language'> | null): string | null {
  if (buyer === null) return null;
  const key = `case.view.lang.${buyer.language}`;
  return hasCopy(key) ? t(key) : null;
}

/** 아래 줄: 엔진 판정·신호에서 고른다. */
function subLine(loaded: LoadedDispute, decision: AutopilotDecision, best: Evaluation | null): string {
  if (decision.verdict === 'skipped') return t(`today.sub.skipped.${decision.rule}`);
  if (loaded.signals?.mentionsCardCompany === true) {
    const language = languageOf(loaded.buyer);
    return language === null ? t('today.sub.cardCompanyOnly') : t('today.sub.cardCompany', { language });
  }
  if (best === null) return t('today.sub.noMove');
  return t(`today.sub.${decision.rule}`, { move: t(`today.move.${best.move}`) });
}

// ── 점과 상태 알약 (T067: 점 = 위험 등급, 알약 = 상태) ───────────────────────

const DOT_OF_BAND: Record<RiskBand, TodayDot> = { High: 'high', Watch: 'watch', Low: 'low' };

/** 엔진이 건너뛴 항목 (Routine 등) → 회색 "Skipped". */
export const STATUS_SKIPPED: TodayStatus = { key: 'today.skipped', tone: 'neutral' };
/** 승인을 기다리는 판정 → 회색 "Waiting approval". */
export const STATUS_WAITING_APPROVAL: TodayStatus = { key: 'today.status.waitingApproval', tone: 'neutral' };
/** Prevent 묶음 → 회색 "Prevent". */
export const STATUS_PREVENT: TodayStatus = { key: 'today.status.prevent', tone: 'neutral' };
const STATUS_HIGH: TodayStatus = { key: 'badge.riskHigh', tone: 'high' };
const STATUS_WATCH: TodayStatus = { key: 'badge.riskWatch', tone: 'watch' };

/** 점: 위험 단계 색. 위험이 없으면 회색. */
export function dotFor(band: RiskBand | null): TodayDot {
  return band === null ? 'neutral' : DOT_OF_BAND[band];
}

/**
 * 상태 알약 고르기 (화면이 판단을 지어내지 않는다 — 엔진 위험 단계·`decideAutopilot` 판정·묶음만 본다):
 * Routine → Skipped · 위험 High → High · 위험 Watch → Watch · 승인 대기 판정 → Waiting approval · 그 밖 건너뜀 → Skipped.
 */
export function disputeStatus(band: RiskBand | null, decision: AutopilotDecision, routine: boolean): TodayStatus {
  if (routine) return STATUS_SKIPPED;
  if (band === 'High') return STATUS_HIGH;
  if (band === 'Watch') return STATUS_WATCH;
  return decision.verdict === 'awaiting_approval' ? STATUS_WAITING_APPROVAL : STATUS_SKIPPED;
}

/**
 * Routine(Mike) 상세의 한 줄 상태 문장 (T061 Today 목록 절). 엔진 판정·규칙 이름에서 문구 키를 고른다:
 * 악용 의심 + F1(반복 미수령 주장) + 미수령 분쟁이면 "3rd 'not received' claim in 90 days …" (배송 완료 기록이
 * 있으면 그 말을 붙인 키), 그 밖의 건너뜀은 일반 문장. 서수는 보드의 `buyerPriorInrDisputes + 1`
 * (엔진 `decideAutopilot` 로그와 같은 규칙). Routine이 아니면 `null`.
 */
export function routineLine(board: BoardState, decision: AutopilotDecision): string | null {
  if (decision.verdict !== 'skipped' || decision.rule !== 'suspected_abuse') return null;
  const f1 = board.cause?.subtype === 'F1' && board.reason.includes('NOT_RECEIVED');
  if (!f1) return t('case.routine.other');
  const ordinalText = ordinal(board.buyerPriorInrDisputes + 1);
  return board.hasDeliveredTracking
    ? t('case.routine.F1.delivered', { ordinal: ordinalText })
    : t('case.routine.F1', { ordinal: ordinalText });
}

/** 보드 하나의 엔진 판정 (목록·Routine 상세가 같은 값을 쓰게). */
export function decideFor(board: BoardState, rules?: PolicyConfig, params?: ParamsConfig): AutopilotDecision {
  const best = recommend(board, params === undefined ? undefined : paramsFromConfig(params), rules).best;
  return decideAutopilot(board, best, rules ?? rulesFromConfig());
}

function disputeItem(loaded: LoadedDispute, rules?: PolicyConfig, params?: ParamsConfig): TodayItem {
  const board = pickBoard(loaded);
  const best = recommend(board, params === undefined ? undefined : paramsFromConfig(params), rules).best;
  const decision = decideFor(board, rules, params);
  const risk = loaded.signals === null ? null : escalationRisk(loaded.signals, rules);
  const routine = decision.verdict === 'skipped' && decision.rule === 'suspected_abuse';
  const band = risk?.band ?? null;

  const who =
    loaded.buyer === null
      ? null
      : t('today.row.who', { name: latinName(loaded.buyer.name), country: loaded.buyer.country });

  return {
    id: loaded.disputeId,
    kind: 'dispute',
    group: routine ? 'routine' : 'needsYou',
    href: `/?item=${encodeURIComponent(loaded.disputeId)}`,
    name: loaded.buyer === null ? t('today.buyerUnknown') : buyerShortName(loaded.buyer.name),
    label: kindLabel(board.cause?.subtype, board.buyerPriorInrDisputes),
    sub: subLine(loaded, decision, best),
    band,
    // Routine(엔진이 손대지 않기로 한 항목)은 순위를 매기지 않으므로 점도 회색
    dot: routine ? 'neutral' : dotFor(band),
    status: disputeStatus(band, decision, routine),
    score: risk?.score ?? null,
    dueDate: board.dueDate,
    row: {
      icon: productIconOf(loaded.product?.itemName),
      head: loaded.disputeId,
      product: loaded.product === null ? null : productShortName(loaded.product.itemName),
      category: categoryLabel(board.reason, board.cause?.subtype),
      categoryTone: !routine && band === 'High' ? 'high' : 'neutral',
      due: board.dueDate === '' ? null : t('today.row.due', { date: shortDate(board.dueDate) }),
      who,
      skus: loaded.product === null ? [] : [loaded.product.sku],
    },
  };
}

/** 추적 미등록 주문의 상품 SKU (상품 이름이 같은 시드 상품). */
function skusOfOrders(orders: readonly TrackingOrderView[], products: readonly SeedProduct[]): string[] {
  const skus = orders
    .map((order) => products.find((product) => product.itemName === order.productName)?.sku)
    .filter((sku): sku is string => sku !== undefined);
  return [...new Set(skus)];
}

/** 추적 미등록 주문 (T076: Prevent 묶음 — 분쟁이 생기기 전에 막는 일). */
function trackingItem(tracking: TrackingSummary, products: readonly SeedProduct[]): TodayItem | null {
  const count = tracking.untracked.length;
  if (count === 0) return null;
  const skus = skusOfOrders(tracking.untracked, products);
  const onlyProduct = skus.length === 1 ? products.find((product) => product.sku === skus[0]) : undefined;
  return {
    id: TRACKING_ITEM_ID,
    kind: 'tracking',
    group: 'prevent',
    href: `/?item=${TRACKING_ITEM_ID}`,
    name: count === 1 ? t('today.tracking.titleOne', { count }) : t('today.tracking.title', { count }),
    label: null,
    sub: null,
    band: UNTRACKED_FIXED_WATCH_BAND,
    dot: dotFor(UNTRACKED_FIXED_WATCH_BAND),
    status: STATUS_WATCH,
    score: null,
    dueDate: '',
    row: {
      icon: onlyProduct === undefined ? 'multi' : productIconOf(onlyProduct.itemName),
      head: count === 1 ? t('today.row.ordersOne', { count }) : t('today.row.orders', { count }),
      product: onlyProduct === undefined ? t('today.row.severalProducts') : productShortName(onlyProduct.itemName),
      category: t('today.row.missingTracking'),
      categoryTone: 'neutral',
      due: null,
      who: count === 1 ? t('today.tracking.detailOne', { count }) : t('today.tracking.detail', { count }),
      skus,
    },
  };
}

export const TRACKING_ITEM_ID = 'tracking';

/**
 * Needs you 순서: 위험 단계 높은 순 → 같은 단계면 추적 항목(여러 주문이 걸린 항목)이 먼저 → 엔진 점수 높은 순
 * → 응답 기한 이른 순 (기한을 모르면 뒤로) → 받은 순서.
 */
function compareNeedsYou(a: TodayItem, b: TodayItem): number {
  const rank = (item: TodayItem) => (item.band === null ? 0 : BAND_RANK[item.band]);
  if (rank(a) !== rank(b)) return rank(b) - rank(a);
  if (a.kind !== b.kind) return a.kind === 'tracking' ? -1 : b.kind === 'tracking' ? 1 : 0;
  if ((a.score ?? -1) !== (b.score ?? -1)) return (b.score ?? -1) - (a.score ?? -1);
  const due = (item: TodayItem) => {
    const ms = Date.parse(item.dueDate);
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
  };
  if (due(a) !== due(b)) return due(a) < due(b) ? -1 : 1;
  return 0;
}

// ── Prevent ────────────────────────────────────────────────────────────────

// 고르기·비율은 엔진 `pickPreventProduct`(T066)가 한다. 화면은 옮기기만 한다.
export type { PreventPick };

function preventItem(pick: PreventPick, product: SeedProduct): TodayItem {
  return {
    id: pick.sku,
    kind: 'prevent',
    group: 'prevent',
    href: `/products?sku=${encodeURIComponent(pick.sku)}`,
    name: product.itemName,
    label: null,
    sub: t('today.prevent.sub', { stock: product.stock, percent: pick.cutPercent }),
    band: null,
    dot: 'neutral',
    status: STATUS_PREVENT,
    score: null,
    dueDate: '',
    row: {
      icon: productIconOf(product.itemName),
      head: productShortName(product.itemName),
      product: null,
      category: t('today.row.rehearsal'),
      categoryTone: 'neutral',
      due: null,
      who: t('today.prevent.sub', { stock: product.stock, percent: pick.cutPercent }),
      skus: [product.sku],
    },
  };
}

// ── 상품 거르개 (T076) ─────────────────────────────────────────────────────

/** 거르개를 지킨 주소. `item`이 있으면 함께. */
export function todayHref(sku: string | null, item: string | null): string {
  const params = new URLSearchParams();
  if (sku !== null) params.set('sku', sku);
  if (item !== null) params.set('item', item);
  const query = params.toString();
  return query === '' ? '/' : `/?${query}`;
}

function productFilter(
  products: readonly SeedProduct[],
  disputeItems: readonly TodayItem[],
  selectedSku: string | null,
): ProductFilterView {
  const casesOf = (sku: string) => disputeItems.filter((item) => item.row.skus.includes(sku)).length;
  const units = products.reduce((sum, product) => sum + product.stock, 0);
  const all: ProductChipView = {
    sku: null,
    name: t('today.filter.all'),
    sub: t('today.filter.allSub', { count: products.length, units }),
    icon: 'multi',
    cases: disputeItems.length,
    href: todayHref(null, null),
    selected: selectedSku === null,
  };
  const chips = products.map((product) => {
    const cases = casesOf(product.sku);
    return {
      sku: product.sku,
      name: productShortName(product.itemName),
      sub:
        cases === 0
          ? t('today.filter.subNone', { units: product.stock })
          : t(cases === 1 ? 'today.filter.subOne' : 'today.filter.sub', { units: product.stock, cases }),
      icon: productIconOf(product.itemName),
      cases,
      href: todayHref(product.sku, null),
      selected: selectedSku === product.sku,
    };
  });
  return {
    chips: [all, ...chips],
    summary: t('today.filter.summary', { products: products.length, units, cases: disputeItems.length }),
    selectedSku,
  };
}

// ── 묶기 ───────────────────────────────────────────────────────────────────

export function buildToday(input: TodayInput): TodayView {
  const store = simulateStore(input.products, [...FIX_ORDER], input.params, input.rules);

  const needsYou: TodayItem[] = [];
  const routine: TodayItem[] = [];
  for (const loaded of input.disputes) {
    const item = disputeItem(loaded, input.rules, input.params);
    (item.group === 'routine' ? routine : needsYou).push(item);
  }
  needsYou.sort(compareNeedsYou);
  const disputeItems = [...needsYou, ...routine];

  // Prevent (T076): 추적 미등록 주문 → 엔진이 고른 상품 순
  const tracking = input.tracking === null ? null : trackingItem(input.tracking, input.products);
  const pick = pickPreventProduct(store);
  const pickedProduct = pick === null ? undefined : input.products.find((product) => product.sku === pick.sku);
  const prevent = [
    ...(tracking === null ? [] : [tracking]),
    ...(pick === null || pickedProduct === undefined ? [] : [preventItem(pick, pickedProduct)]),
  ];

  const allGroups = (
    [
      { key: 'needsYou', items: needsYou },
      { key: 'prevent', items: prevent },
      { key: 'routine', items: routine },
    ] as const
  ).filter((group) => group.items.length > 0);

  // 상품 거르개: 아는 SKU일 때만 거른다. 항목 주소는 거르개를 지킨다
  const selectedSku =
    input.sku !== undefined && input.products.some((product) => product.sku === input.sku) ? input.sku : null;
  const groups: TodayGroup[] = allGroups
    .map((group) => ({
      key: group.key,
      title: t(`today.group.${group.key}`),
      hint: t(`today.groupHint.${group.key}`),
      items: group.items
        .filter((item) => selectedSku === null || item.row.skus.includes(selectedSku))
        .map((item) =>
          selectedSku === null || item.kind === 'prevent' ? item : { ...item, href: todayHref(selectedSku, item.id) },
        ),
    }))
    .filter((group) => group.items.length > 0);

  return {
    dateLine: dateLine(input.now),
    storeLine: {
      beforeCents: store.beforeCents,
      afterCents: store.afterCents,
      text: t('today.storeLine', { before: toDollarsRounded(store.beforeCents), after: toDollarsRounded(store.afterCents) }),
    },
    groups,
    count: allGroups.reduce((sum, group) => sum + group.items.length, 0),
    tracking: input.tracking,
    filter: productFilter(input.products, disputeItems, selectedSku),
    openDisputes: disputeItems.length,
  };
}

// ── 이번 주 카드 (T076) ────────────────────────────────────────────────────

/** 왼쪽 "DisputeLess this week" 카드. 계산 가능한 숫자만 (`WeeklySummary`, 어댑터). */
export type WeeklyView = {
  /** 열린 분쟁 수 (엔진 요약이 있으면 그 값, 없으면 목록에서 센 수). */
  openDisputes: number;
  /** 지킬 수 있는 돈 (`keepableCents` 표기, Assumption). 요약이 없으면 `null` → 숨김. */
  keepable: string | null;
  /** AI 답장 초안 수 (캐시 기준). 요약이 없으면 `null` → 숨김. */
  aiDrafts: number | null;
  /** 시드 값이 섞였으면 참 → Demo data. */
  usesDemoData: boolean;
};

/** `aiDraftsCounted: false` = AI 캐시가 없어 초안 수를 셀 수 없었다 → 0이라고 보이지 않고 칸을 숨긴다. */
export function weeklyView(
  openDisputes: number,
  summary: WeeklySummary | null,
  usesDemoData: boolean,
  options: { aiDraftsCounted?: boolean } = {},
): WeeklyView {
  if (summary === null) return { openDisputes, keepable: null, aiDrafts: null, usesDemoData };
  return {
    openDisputes: summary.openDisputes,
    keepable: Number.isInteger(summary.keepableCents) ? toDollarsRounded(summary.keepableCents) : null,
    aiDrafts: options.aiDraftsCounted === false ? null : summary.aiDrafts,
    usesDemoData: summary.usesDemoData,
  };
}

/**
 * 오른쪽 상세에 보일 항목. 주소의 `item`이 상세가 있는 항목(분쟁·추적)이면 그것, 아니면 목록 첫 항목.
 * Prevent 항목은 Products 탭으로 가므로 고르지 않는다.
 */
export function selectItem(view: Pick<TodayView, 'groups'>, requested: string | undefined): TodayItem | null {
  const selectable = view.groups.flatMap((group) => group.items).filter((item) => item.kind !== 'prevent');
  return selectable.find((item) => item.id === requested) ?? selectable[0] ?? null;
}
