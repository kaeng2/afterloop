/**
 * Today 탭 보기용 값 (T060, SPEC v2.10 2장). **그리지 않고 계산하지 않는다** — 엔진 결과를 옮겨 목록을 만든다.
 *
 * 목록은 데이터에서 만든다 (손으로 쓴 목록이 없다):
 * - 분쟁 항목: `loadDemoDisputes`가 연결 표(`showOnScreen`)로 걸러 낸 분쟁. 묶음은 엔진 `decideAutopilot` 판정
 *   (악용 의심으로 건너뜀 → Routine, 그 밖 → Needs you). 위험 배지는 엔진 `escalationRisk`.
 * - 추적 항목: `listUntracked`(조회만)에서 분쟁이 걸리지 않은 미등록 주문 수. 조회에 실패하면 항목이 없다.
 * - Prevent 항목: `simulateStore`(처방 4개 모두)의 상품별 결과에서 처방 전·후 평균 손실이 **줄어드는 비율**이
 *   가장 큰 상품 (컨트롤 타워 결정 2026-11-10, T060 재시도 1번). 같으면 처방 전 손실이 큰 쪽.
 *
 * 금액 표시는 `toDollarsRounded` 한 곳. 글자는 `today.*`·`case.view.lang.*` 문구에서 읽는다.
 * 이 파일은 PayPal·LLM을 부르지 않는다 (서버 읽기는 `../_server/today.ts`).
 */
import { decideAutopilot } from '@/engine/autopilot';
import { escalationRisk } from '@/engine/escalation';
import { paramsFromConfig, rulesFromConfig } from '@/engine/params';
import { recommend } from '@/engine/recommend';
import { FIX_ORDER } from '@/engine/sim';
import { simulateStore } from '@/engine/storefront';
import type {
  AutopilotDecision,
  BoardState,
  Evaluation,
  ParamsConfig,
  PolicyConfig,
  SeedBuyer,
  SeedProduct,
} from '@/types';

import type { RiskBand } from '../_shared/badge-keys';
import { copyTables, t } from '../_shared/copy';
import { pickBoard, type LoadedDispute } from '../_shared/dispute-view';
import { toDollarsRounded } from '../_shared/money';

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
  /** 작은 위험 배지. 없으면 `null`. */
  band: RiskBand | null;
  /**
   * 위험 배지 대신 보이는 회색 표시 문구 키 (Routine = 엔진이 자동 처리하지 않기로 한 항목 → `today.skipped`).
   * 있으면 목록은 위험 배지 대신 이것을 보인다. 없으면 `null`.
   */
  chipKey: string | null;
  /** 정렬용 엔진 점수 (분쟁만). */
  score: number | null;
  /** 정렬용 응답 기한 (분쟁만, ISO 8601. 모르면 빈 글자). */
  dueDate: string;
};

export type TodayGroup = { key: TodayGroupKey; title: string; items: TodayItem[] };

/** 추적 등록 안 된 주문 한 줄 (보기용). */
export type TrackingOrderView = { key: string; buyerName: string | null; productName: string | null };

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
  /** 목록에 실제로 보이는 항목 수 (위쪽 막대 Today (N)). */
  count: number;
  tracking: TrackingSummary | null;
};

export type TodayInput = {
  disputes: LoadedDispute[];
  tracking: TrackingSummary | null;
  products: readonly SeedProduct[];
  now: Date;
  params?: ParamsConfig;
  rules?: PolicyConfig;
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

/** Routine 항목의 회색 표시 (엔진 `decideAutopilot`이 건너뛴 항목). */
const SKIPPED_CHIP_KEY = 'today.skipped';

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

  return {
    id: loaded.disputeId,
    kind: 'dispute',
    group: routine ? 'routine' : 'needsYou',
    href: `/?item=${encodeURIComponent(loaded.disputeId)}`,
    name: loaded.buyer === null ? t('today.buyerUnknown') : buyerShortName(loaded.buyer.name),
    label: kindLabel(board.cause?.subtype, board.buyerPriorInrDisputes),
    sub: subLine(loaded, decision, best),
    band: risk?.band ?? null,
    chipKey: routine ? SKIPPED_CHIP_KEY : null,
    score: risk?.score ?? null,
    dueDate: board.dueDate,
  };
}

function trackingItem(tracking: TrackingSummary): TodayItem | null {
  const count = tracking.untracked.length;
  if (count === 0) return null;
  return {
    id: TRACKING_ITEM_ID,
    kind: 'tracking',
    group: 'needsYou',
    href: `/?item=${TRACKING_ITEM_ID}`,
    name: count === 1 ? t('today.tracking.titleOne', { count }) : t('today.tracking.title', { count }),
    label: null,
    sub: null,
    band: UNTRACKED_FIXED_WATCH_BAND,
    chipKey: null,
    score: null,
    dueDate: '',
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

export type PreventPick = { sku: string; beforeCents: number; afterCents: number; cutPercent: number };

/**
 * 처방 4개를 다 켰을 때 평균 손실이 줄어드는 비율이 가장 큰 상품 (`(before − after) / before`).
 * 처방 전 손실이 0인 상품은 뺀다. 비율이 같으면 처방 전 손실이 큰 쪽. 비교는 정수 곱셈으로 한다 (부동소수 비교 없음).
 */
export function pickPrevent(rows: readonly { sku: string; beforeCents: number; afterCents: number }[]): PreventPick | null {
  let best: { sku: string; beforeCents: number; afterCents: number } | null = null;
  for (const row of rows) {
    if (row.beforeCents <= 0) continue;
    if (best === null) {
      best = row;
      continue;
    }
    // (b1 − a1) / b1  vs  (b2 − a2) / b2  →  (b1 − a1) × b2  vs  (b2 − a2) × b1
    const mine = (row.beforeCents - row.afterCents) * best.beforeCents;
    const theirs = (best.beforeCents - best.afterCents) * row.beforeCents;
    if (mine > theirs || (mine === theirs && row.beforeCents > best.beforeCents)) best = row;
  }
  if (best === null) return null;
  const cutPercent = Math.round(((best.beforeCents - best.afterCents) * 100) / best.beforeCents);
  return { ...best, cutPercent };
}

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
    chipKey: null,
    score: null,
    dueDate: '',
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
  const tracking = input.tracking === null ? null : trackingItem(input.tracking);
  if (tracking !== null) needsYou.push(tracking);
  needsYou.sort(compareNeedsYou);

  const pick = pickPrevent(
    store.products.map(({ sku, result }) => ({
      sku,
      beforeCents: result.before.meanLossCents,
      afterCents: result.after.meanLossCents,
    })),
  );
  const pickedProduct = pick === null ? undefined : input.products.find((product) => product.sku === pick.sku);
  const prevent = pick === null || pickedProduct === undefined ? [] : [preventItem(pick, pickedProduct)];

  const groups: TodayGroup[] = (
    [
      { key: 'needsYou', items: needsYou },
      { key: 'prevent', items: prevent },
      { key: 'routine', items: routine },
    ] as const
  )
    .filter((group) => group.items.length > 0)
    .map((group) => ({ key: group.key, title: t(`today.group.${group.key}`), items: [...group.items] }));

  return {
    dateLine: dateLine(input.now),
    storeLine: {
      beforeCents: store.beforeCents,
      afterCents: store.afterCents,
      text: t('today.storeLine', { before: toDollarsRounded(store.beforeCents), after: toDollarsRounded(store.afterCents) }),
    },
    groups,
    count: groups.reduce((sum, group) => sum + group.items.length, 0),
    tracking: input.tracking,
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
