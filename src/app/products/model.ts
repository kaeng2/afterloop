/**
 * Products 탭 보기용 값 (T062, SPEC v2.10, PRD v3 8장 S2·9장). **그리지 않고 계산하지 않는다.**
 *
 * 모든 금액·범위·분쟁 수·점은 엔진 결과를 옮긴다:
 * - 큰 숫자·범위 문장: `simulate(simInputFor(sku, product, 켠 처방))`의 `before`·`after`
 * - 점 그림: `pickRepresentativeFuture` (어느 미래를 그릴지는 엔진이 정한다)
 * - 왼쪽 목록: `simulateStore` (행 순서도 엔진 순서 그대로)
 * - 처방 카드의 "켜면/끄면" 값: 그 처방 하나만 바꾼 처방 묶음으로 `simulate`를 다시 부른 `after` 평균.
 *   **두 값을 나란히 적기만 한다** — 화면이 빼서 "절감액"을 만들지 않는다 (엔진이 처방별 절감을 내주지 않는다.
 *   AC23 초안 "절감액·감소 비율은 화면에 적지 않는다").
 * - 기본 상품: Today의 Prevent 상품 = `pickPreventProduct(simulateStore(상품, 처방 4개))`.
 *
 * 금액 표시는 `toDollarsRounded` 한 곳. 글자는 `product.*` 문구. 이 파일은 DOM·네트워크·시계·난수를 쓰지 않는다
 * (브라우저에서도 돌아간다 — 처방 토글을 0.5초 안에 다시 계산하려고 클라이언트 컴포넌트가 부른다).
 */
import type { ColorNote, ColorNoteLocale } from '@/ai/color-note';
import { paramsConfigFromFile } from '@/engine/params';
import { FIX_ORDER, simInputFor, simulate } from '@/engine/sim';
import { pickPreventProduct, pickRepresentativeFuture, simulateStore } from '@/engine/storefront';
import type { TransactionsResult } from '@/paypal/transactions';
import type { FixId, ParamsConfig, PolicyConfig, SeedDispute, SeedInquiry, SeedProduct, SimSummary } from '@/types';

import { t } from '../_shared/copy';
import { toDollarsRounded } from '../_shared/money';

// ── 공용 ───────────────────────────────────────────────────────────────────

/** 엔진 센트 값 + 표시 글자 (센트 값은 그대로 함께 둔다). */
export type MoneyView = { cents: number; text: string };

const money = (cents: number): MoneyView => ({ cents, text: toDollarsRounded(cents) });

/** 분쟁 수 표기 (소수 첫째 자리까지. 표기만 — 값은 `meanDisputes` 그대로 둔다). */
const DISPUTES_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function disputesText(meanDisputes: number): string {
  return DISPUTES_FORMAT.format(meanDisputes);
}

/** 켠 처방을 `FIX_ORDER` 순서로, 중복 없이 (엔진이 받는 순서와 같게). */
export function orderedFixes(fixes: readonly FixId[]): FixId[] {
  return FIX_ORDER.filter((fix) => fixes.includes(fix));
}

/** 처방 하나를 켜거나 끈 묶음. */
export function toggleFix(fixes: readonly FixId[], fix: FixId): FixId[] {
  return fixes.includes(fix) ? orderedFixes(fixes.filter((f) => f !== fix)) : orderedFixes([...fixes, fix]);
}

export const ALL_FIXES: readonly FixId[] = FIX_ORDER;

type EngineConfig = { config?: ParamsConfig; rules?: PolicyConfig };

// ── 기본 상품 (Today의 Prevent 상품과 같다) ────────────────────────────────

/** Today Prevent 항목과 같은 규칙: 처방 4개 모두 켠 가게 합계에서 엔진 `pickPreventProduct`. 없으면 첫 상품. */
export function defaultSku(products: readonly SeedProduct[], engine: EngineConfig = {}): string | null {
  if (products.length === 0) return null;
  const store = simulateStore(products, [...FIX_ORDER], engine.config, engine.rules);
  return pickPreventProduct(store)?.sku ?? products[0].sku;
}

/** 주소의 `sku`가 있는 상품이면 그것, 아니면 기본 상품. */
export function selectSku(
  products: readonly SeedProduct[],
  requested: string | undefined,
  engine: EngineConfig = {},
): string | null {
  if (requested !== undefined && products.some((product) => product.sku === requested)) return requested;
  return defaultSku(products, engine);
}

export const productHref = (sku: string): string => `/products?sku=${encodeURIComponent(sku)}`;

// ── 왼쪽 상품 목록 (T065가 AG Grid 표로 바꿀 때 이 행을 그대로 쓴다) ──────

export type ProductRow = {
  sku: string;
  name: string;
  /** 시드 값 ('Demo data') */
  stock: number;
  stockText: string;
  /** 처방 없음 평균 손실 (엔진) */
  asIs: MoneyView;
  /** 지금 켠 처방의 평균 손실 (엔진). 켠 처방이 없으면 asIs와 같다 */
  withFixes: MoneyView;
  /** "$216 → $44" 꼴 (두 값을 나란히) */
  valuesText: string;
  href: string;
  selected: boolean;
};

/** 상품 행. 순서 = `simulateStore` 순서 (처방 없음 평균 손실이 큰 순, 엔진이 정렬). */
export function buildProductRows(
  products: readonly SeedProduct[],
  fixesOn: readonly FixId[],
  selectedSku: string | null,
  engine: EngineConfig = {},
): ProductRow[] {
  const store = simulateStore(products, orderedFixes(fixesOn), engine.config, engine.rules);
  return store.products.map(({ sku, result }) => {
    const product = products.find((p) => p.sku === sku) as SeedProduct;
    const asIs = money(result.before.meanLossCents);
    const withFixes = money(result.after.meanLossCents);
    return {
      sku,
      name: product.itemName,
      stock: product.stock,
      stockText: t('product.row.stock', { stock: product.stock }),
      asIs,
      withFixes,
      valuesText: t('product.row.values', { asIs: asIs.text, withFixes: withFixes.text }),
      href: productHref(sku),
      selected: sku === selectedSku,
    };
  });
}

// ── 가운데 리허설 ───────────────────────────────────────────────────────────

export type OutcomeView = {
  mean: MoneyView;
  p10: MoneyView;
  p90: MoneyView;
  meanDisputes: number;
  disputesText: string;
};

const outcome = (summary: SimSummary): OutcomeView => ({
  mean: money(summary.meanLossCents),
  p10: money(summary.p10LossCents),
  p90: money(summary.p90LossCents),
  meanDisputes: summary.meanDisputes,
  disputesText: disputesText(summary.meanDisputes),
});

export type DotView = { index: number; redBefore: boolean; redAfter: boolean };

export type DotPlotView = {
  /** 엔진이 고른 미래 번호 */
  futureIndex: number;
  /** 점 하나 = 남은 주문 하나 (길이 = 재고) */
  dots: DotView[];
  redBefore: number;
  redAfter: number;
  beforeLabel: string;
  afterLabel: string;
  legend: string;
};

/** 점 그림. 어느 미래를 그릴지·빨간 점은 `pickRepresentativeFuture` 결과 그대로. */
export function buildDotPlot(
  product: SeedProduct,
  fixesOn: readonly FixId[],
  engine: EngineConfig = {},
): DotPlotView {
  const config = engine.config ?? paramsConfigFromFile();
  const input = simInputFor(product.sku, product, orderedFixes(fixesOn), config);
  const future = pickRepresentativeFuture(input, config, engine.rules);
  return {
    futureIndex: future.futureIndex,
    dots: future.orders.map((order) => ({
      index: order.index,
      redBefore: order.disputedBefore,
      redAfter: order.disputedAfter,
    })),
    redBefore: future.disputesBefore,
    redAfter: future.disputesAfter,
    beforeLabel: t('product.dots.before', { count: future.disputesBefore }),
    afterLabel: t('product.dots.after', { count: future.disputesAfter }),
    legend: t('product.dots.legend'),
  };
}

export type FixBadgeKind = 'paypal' | 'aiWrites' | 'simulated' | 'afterOk';

/** 처방 → 실행 배지 (지시서 T062 "오른쪽 처방 카드"). */
export const FIX_BADGE: Record<FixId, FixBadgeKind> = {
  tracking_24h: 'paypal',
  color_note: 'aiWrites',
  kr_customs_notice: 'simulated',
  settle_first: 'afterOk',
};

export type FixCardView = {
  id: FixId;
  on: boolean;
  title: string;
  description: string;
  badge: { kind: FixBadgeKind; text: string };
  /** 가정값 출처 (`config/params.json` `fixes[fix].source`). 'Assumption' 배지 설명 */
  source: string;
  /**
   * 이 처방 하나만 바꾸면: 지금 평균(from) → 바꾼 묶음의 평균(to). 둘 다 엔진 `simulate`의 `after` 평균.
   * 화면이 빼지 않는다.
   */
  effect: { from: MoneyView; to: MoneyView; text: string };
};

export type ProductView = {
  sku: string;
  name: string;
  /** 시드 값 ('Demo data') */
  stock: number;
  futures: number;
  rehearsalLine: string;
  fixesOn: FixId[];
  allOn: boolean;
  before: OutcomeView;
  /** 켠 처방이 없으면 null (as-is 하나만 크게) */
  after: OutcomeView | null;
  rangeSentence: string;
  /** 상품별 분쟁 확률의 출처 (`productRates[sku].source`). 'Assumption' 배지 설명 */
  rateSource: string;
  dots: DotPlotView;
  fixes: FixCardView[];
};

function meanWith(product: SeedProduct, fixes: readonly FixId[], config: ParamsConfig, rules?: PolicyConfig): number {
  return simulate(simInputFor(product.sku, product, orderedFixes(fixes), config), config, rules).after.meanLossCents;
}

export function buildProductView(
  product: SeedProduct,
  fixesOn: readonly FixId[],
  engine: EngineConfig = {},
): ProductView {
  const config = engine.config ?? paramsConfigFromFile();
  const fixes = orderedFixes(fixesOn);
  const input = simInputFor(product.sku, product, fixes, config);
  const result = simulate(input, config, engine.rules);

  const before = outcome(result.before);
  const after = fixes.length === 0 ? null : outcome(result.after);
  const current = money(result.after.meanLossCents);

  const rangeParts = [
    t('product.range.asIs', {
      disputes: before.disputesText,
      mean: before.mean.text,
      p10: before.p10.text,
      p90: before.p90.text,
    }),
  ];
  if (after !== null) {
    rangeParts.push(
      t('product.range.withFixes', {
        disputes: after.disputesText,
        mean: after.mean.text,
        p10: after.p10.text,
        p90: after.p90.text,
      }),
    );
  }

  const cards: FixCardView[] = FIX_ORDER.map((id) => {
    const on = fixes.includes(id);
    const to = money(meanWith(product, toggleFix(fixes, id), config, engine.rules));
    const kind = FIX_BADGE[id];
    return {
      id,
      on,
      title: t(`product.fix.${id}.title`),
      description: t(`product.fix.${id}.desc`),
      badge: { kind, text: t(`product.fix.badge.${kind}`) },
      source: config.fixes[id].source,
      effect: {
        from: current,
        to,
        text: t(on ? 'product.fix.effect.on' : 'product.fix.effect.off', { from: current.text, to: to.text }),
      },
    };
  });

  return {
    sku: product.sku,
    name: product.itemName,
    stock: product.stock,
    futures: input.futures,
    rehearsalLine: t('product.rehearsal', { futures: input.futures, stock: product.stock }),
    fixesOn: fixes,
    allOn: fixes.length === FIX_ORDER.length,
    before,
    after,
    rangeSentence: rangeParts.join(' '),
    rateSource: config.productRates[product.sku]?.source ?? '',
    dots: buildDotPlot(product, fixes, { config, rules: engine.rules }),
    fixes: cards,
  };
}

// ── 거래 조회 한 줄 (T019) ──────────────────────────────────────────────────

export type TransactionLineView = { text: string; cached: boolean };

/** 거래 조회 결과 → 한 줄. 실패면 null (화면은 줄을 숨긴다). 값은 `summary.saleCount` 그대로. */
export function transactionLineView(result: TransactionsResult, days: number): TransactionLineView | null {
  if (!result.ok) return null;
  return {
    text: t('product.tx.line', { count: result.summary.saleCount, days }),
    cached: result.cached,
  };
}

// ── AI 색상 문구 (T020) ─────────────────────────────────────────────────────

/**
 * 색상 문구에 넘길 구매자 글. 이 상품에 색상(B1) 분쟁 이력이 있을 때만, 시드 문의 중 색상(B1) 신호가 붙은 글의 원문.
 * 시드 문의에는 SKU가 없어서 상품의 B1 분쟁 이력으로 거른다. 없으면 빈 배열 (호출하지 않는다).
 */
export function colorComplaintsFor(
  sku: string,
  disputes: readonly SeedDispute[],
  inquiries: readonly SeedInquiry[],
): string[] {
  const hasColorHistory = disputes.some((dispute) => dispute.sku === sku && dispute.subtype === 'B1');
  if (!hasColorHistory) return [];
  return inquiries.filter((inquiry) => inquiry.signal === 'B1').map((inquiry) => inquiry.original);
}

export type ColorNoteLine = { locale: ColorNoteLocale; label: string; text: string; backTranslation: string | null };

/** 화면용 색상 문구: 한국어 한 줄(크게) + 나머지 언어(접기). 실패면 null (그 자리를 숨긴다. 기본 문구 없음). */
export type ColorNoteView = { ko: ColorNoteLine; others: ColorNoteLine[] };

const OTHER_LOCALES: readonly ColorNoteLocale[] = ['en', 'ja', 'de'];

export function colorNoteView(note: ColorNote): ColorNoteView | null {
  if (!note.ok) return null;
  const line = (locale: ColorNoteLocale): ColorNoteLine => ({
    locale,
    label: t(`product.colorNote.lang.${locale}`),
    text: note.notes[locale].text,
    backTranslation: note.notes[locale].backTranslationEn,
  });
  return { ko: line('ko'), others: OTHER_LOCALES.map(line) };
}
