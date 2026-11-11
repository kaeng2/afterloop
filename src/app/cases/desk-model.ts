/**
 * 사례 화면 시안 v4 보기용 값 (T076, SPEC v2.11 2장 "화면 구조 v4"). **순수 함수만 둔다** — 브라우저 묶음에도 들어간다.
 *
 * **계산하지 않는다.** 기대 손실은 `recommend` 값, 차지백 %·위험 곡선·예상 반응은 어댑터(`forecast-source.ts`·
 * `forecast-client.ts`)가 준 엔진 값을 옮긴다. 어댑터 값이 `null`이면 그 칸의 보기용 값도 `null`(화면이 숨긴다).
 * 확률은 `toPercentRounded`, 금액은 `toDollarsRounded`로 **표기만** 바꾼다. 곡선의 좌표는 그리기 위한 자리 값이다
 * (확률 값을 바꾸지 않고 0~1을 그림 높이에 놓기만 한다).
 *
 * 글자는 문구 키(`case.*`)에서. 이 파일에 화면 문장이 없다.
 */
import type {
  BoardState,
  CaseEvent,
  CaseEventKind,
  EscalationSignals,
  Evaluation,
  Recommendation,
  ReplyFeatureHits,
  ReplyFeatureKey,
  ReplyFeatures,
  ReplyForecast,
  RiskPoint,
  SeedBuyer,
  Subtype,
} from '@/types';

import { copyTables, t } from '../_shared/copy';
import { toDollarsRounded } from '../_shared/money';
import { riskTone, type RiskTone } from '../_shared/motion';
import { toPercentRounded } from '../_shared/percent';
import { shortDate } from '../_shared/short-date';
import type { CaseView, MoneyView } from './model';

// ───────────────────────────── 상품 아이콘 · 범주 알약 ─────────────────────────────

export type ProductIconKind = 'cardigan' | 'sweater' | 'coat' | 'beanie' | 'multi';

/** 상품 이름 낱말로 아이콘을 고른다 (그림 고르기일 뿐 판정이 아니다). 모르면 `multi`. */
export function productIconOf(itemName: string | null | undefined): ProductIconKind {
  const name = (itemName ?? '').toLowerCase();
  if (name.includes('cardigan')) return 'cardigan';
  if (name.includes('sweater')) return 'sweater';
  if (name.includes('coat')) return 'coat';
  if (name.includes('beanie') || name.includes('scarf')) return 'beanie';
  return 'multi';
}

const has = (key: string): boolean => typeof copyTables.en[key] === 'string';

/**
 * 범주 알약 글자 ("Not received · Customs hold"). PayPal 사유(`reason`)의 짧은 이름 + 엔진 원인 세부 유형의 짧은 이름.
 * 문구가 없으면 있는 쪽만, 둘 다 없으면 `null`.
 */
export function categoryLabel(reason: string, subtype: Subtype | undefined): string | null {
  const reasonKey = `case.cat.reason.${reason}`;
  const kindKey =
    subtype === undefined
      ? null
      : has(`case.cat.kind.${subtype}`)
        ? `case.cat.kind.${subtype}`
        : has(`case.view.subtypeShort.${subtype}`)
          ? `case.view.subtypeShort.${subtype}`
          : null;
  const parts = [has(reasonKey) ? t(reasonKey) : null, kindKey === null ? null : t(kindKey)].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? null : parts.join(' · ');
}

// ───────────────────────────── 이름 · 나라 ─────────────────────────────

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

/** 시드 이름의 라틴 글자 부분 (한글 낱말을 뺀 나머지). 라틴 부분이 없으면 이름 그대로. */
export function latinName(seedName: string): string {
  const words = seedName.trim().split(/\s+/).filter((word) => word !== '');
  const latin = words.filter((word) => !HANGUL.test(word));
  return (latin.length === 0 ? words : latin).join(' ');
}

/** 나라 코드 → 이름 ("KR" → "Korea"). 문구가 없으면 코드 그대로. */
export function countryName(code: string): string {
  return has(`case.country.${code}`) ? t(`case.country.${code}`) : code;
}

// ───────────────────────────── 머리글 둘째 줄 ─────────────────────────────

/** "<금액> · <이름> · <나라> · reads <언어> · Open N days" 조각. 모르는 칸은 뺀다. */
export function headMetaParts(input: {
  amountDisplay: string;
  buyer: Pick<SeedBuyer, 'name' | 'country'> | null;
  languageKey: string | null;
  openDays: number | null;
}): string[] {
  const parts: string[] = [input.amountDisplay];
  if (input.buyer !== null) {
    parts.push(latinName(input.buyer.name));
    parts.push(countryName(input.buyer.country));
  }
  if (input.languageKey !== null) parts.push(t('case.head.reads', { language: t(input.languageKey) }));
  if (input.openDays !== null) {
    parts.push(input.openDays === 1 ? t('case.head.openOne') : t('case.head.open', { days: input.openDays }));
  }
  return parts;
}

// ───────────────────────────── 1. 선택지 카드 ─────────────────────────────

/** 선택지 카드의 수별 예상 차지백 위험 (엔진 수별 예측에서 옮긴 값. 어댑터 `loadMoveForecasts`). */
export type MoveForecast = { move: Evaluation['move']; pChargeback: number };

export type ChoiceView = {
  move: Evaluation['move'];
  titleKey: string;
  howKey: string;
  /** 엔진 `recommend`의 최선 수. */
  best: boolean;
  /** 엔진이 막은 수 (흐리게 + 이유). */
  blocked: boolean;
  blockedKey: string | null;
  /** 기대 손실 = `recommend` 평가 값 그대로. 막혔으면 `null`. */
  expectedLoss: MoneyView | null;
  /** 예상 차지백 % (어댑터). 없으면 `null` → 숨김. */
  chargeback: string | null;
  /** 차지백 % 글자색 단계 (시안 `cbSt`: 50% 이상 빨강). 기준값은 config/motion.json. 없으면 `null`. */
  chargebackTone: 'high' | 'low' | null;
};

const BLOCKED_KEY_PREFIX = 'case.choice.blocked.';

/**
 * 선택지 카드 (엔진 `recommend(board)`의 수별 평가). 순서는 엔진이 준 순서. 차지백 %는 어댑터 값이 있을 때만.
 */
export function choicesView(rec: Recommendation, forecasts: readonly MoveForecast[] | null): ChoiceView[] {
  return rec.all.map((evaluation) => {
    const blocked = evaluation.blockedBy !== undefined || evaluation.expectedLossCents === null;
    const blockedKey =
      evaluation.blockedBy !== undefined && has(`${BLOCKED_KEY_PREFIX}${evaluation.blockedBy}`)
        ? `${BLOCKED_KEY_PREFIX}${evaluation.blockedBy}`
        : blocked
          ? `${BLOCKED_KEY_PREFIX}other`
          : null;
    const forecast = blocked ? undefined : forecasts?.find((item) => item.move === evaluation.move);
    return {
      move: evaluation.move,
      titleKey: `case.choice.${evaluation.move}.title`,
      howKey: `case.choice.${evaluation.move}.how`,
      best: !blocked && rec.best?.move === evaluation.move,
      blocked,
      blockedKey,
      expectedLoss:
        evaluation.expectedLossCents === null
          ? null
          : { cents: evaluation.expectedLossCents, display: toDollarsRounded(evaluation.expectedLossCents) },
      chargeback: forecast === undefined ? null : toPercentRounded(forecast.pChargeback),
      chargebackTone: forecast === undefined ? null : riskTone(forecast.pChargeback) === 'high' ? 'high' : 'low',
    };
  });
}

// ───────────────────────────── 사건 기록 · 위험 곡선 ─────────────────────────────

export type HistoryTone = 'buyer' | 'bad' | 'seller' | 'sys';

export type HistoryRowView = {
  date: string;
  text: string;
  kind: CaseEventKind;
  tone: HistoryTone;
  /** 시드 사건이면 참 → 'Demo data'. */
  demo: boolean;
  /** 표시 문구 키 (`case.history.flag.*`). */
  flagKeys: string[];
};

export type HistoryView = {
  count: number;
  /** 첫 사건부터 오늘까지 날 수. 모르면 `null`. */
  spanDays: number | null;
  rows: HistoryRowView[];
  /** AI 요약 (어댑터). 없으면 `null` → 줄을 숨긴다. */
  summary: string | null;
  usesDemo: boolean;
};

function toneOf(event: CaseEvent): HistoryTone {
  if (event.kind === 'tracking_missing') return 'bad';
  if (event.kind === 'buyer_message') return event.flags?.includes('threat') === true ? 'bad' : 'buyer';
  if (event.kind === 'seller_reply') return 'seller';
  return 'sys';
}

export function historyView(events: readonly CaseEvent[], spanDays: number | null, summary: string | null): HistoryView | null {
  if (events.length === 0) return null;
  const rows = events.map((event) => ({
    date: shortDate(event.at),
    text: event.text,
    kind: event.kind,
    tone: toneOf(event),
    demo: event.source === 'seed',
    flagKeys: (event.flags ?? []).map((flag) => `case.history.flag.${flag}`),
  }));
  return {
    count: events.length,
    spanDays,
    rows,
    summary: summary === null || summary.trim() === '' ? null : summary.trim(),
    usesDemo: rows.some((row) => row.demo),
  };
}

/** 그림 상자 (자리 값. 확률과 상관없는 그리기 크기). */
export const CURVE_BOX = { width: 640, height: 150, top: 20, bottom: 120 } as const;

export type CurveDot = { x: number; y: number; kind: CaseEventKind; label: string };

export type CurveView = {
  dots: CurveDot[];
  /** 사건 점을 잇는 선 (SVG points 글자). */
  line: string;
  /** 선 아래 옅은 면. */
  area: string;
  /** "Your draft" 점. 답장 예측이 없으면 `null`. */
  draft: { x: number; y: number; from: { x: number; y: number } } | null;
  /** 큰 % (답장 예측이 있으면 그 값, 없으면 마지막 사건 점). */
  headline: string;
  /** 큰 % 글자색 단계 (시안 `riskCol`). */
  headlineTone: RiskTone;
  /** 큰 % 아래 글자 키 ("with your draft" / "now"). */
  headlineKey: string;
  /** "89% → 8%" (답장 예측이 있을 때만). */
  fromTo: string | null;
};

/** 0~1 → 그림 높이 (위가 100%). 확률 값을 바꾸지 않고 자리에 놓기만 한다. */
const yOf = (p: number): number =>
  CURVE_BOX.bottom - (CURVE_BOX.bottom - CURVE_BOX.top) * Math.min(1, Math.max(0, p));

/**
 * 위험 곡선 (어댑터 `RiskPoint[]` + 답장 예측의 `pChargeback`). 점이 없으면 `null` (카드를 숨긴다).
 * 사건 점 수 = `points` 길이 그대로. 답장 예측이 있으면 맨 끝에 "Your draft" 점 하나를 더 그린다 (점선).
 */
export function curveView(points: readonly RiskPoint[] | null, draftP: number | null): CurveView | null {
  if (points === null || points.length === 0) return null;
  const slots = points.length + (draftP === null ? 0 : 1);
  const step = slots <= 1 ? 0 : CURVE_BOX.width / (slots - 1);
  const dots = points.map((point, index) => ({
    x: Math.round(index * step),
    y: Math.round(yOf(point.pChargeback)),
    kind: point.kind,
    label: shortDate(point.at),
  }));
  const last = dots[dots.length - 1];
  const lastP = points[points.length - 1].pChargeback;
  const line = dots.map((dot) => `${dot.x},${dot.y}`).join(' ');
  const area = `${dots[0].x},${CURVE_BOX.bottom} ${line} ${last.x},${CURVE_BOX.bottom}`;
  const draft =
    draftP === null ? null : { x: Math.round((slots - 1) * step), y: Math.round(yOf(draftP)), from: { x: last.x, y: last.y } };
  return {
    dots,
    line,
    area,
    draft,
    headline: toPercentRounded(draftP ?? lastP),
    headlineTone: riskTone(draftP ?? lastP),
    headlineKey: draftP === null ? 'case.curve.now' : 'case.curve.withDraft',
    fromTo: draftP === null ? null : t('case.curve.fromTo', { from: toPercentRounded(lastP), to: toPercentRounded(draftP) }),
  };
}

// ───────────────────────────── 사례 화면 묶음 (서버가 만든다) ─────────────────────────────

/** 시안 v4 칸의 값 (`case-detail.tsx`가 엔진·어댑터·사건 기록에서 만든다). */
export type CaseDesk = {
  icon: ProductIconKind;
  /** "PP-R-… · Wool Sweater". */
  title: string;
  category: string | null;
  categoryTone: 'high' | 'neutral';
  /** 머리글 둘째 줄 조각 (`headMetaParts`). */
  meta: string[];
  /** 선택지 카드 (`choicesView`). 답장 칸이 없으면 빈 배열. */
  choices: ChoiceView[];
  /** "PayPal data only: Full refund $74" (배송사 기록 전 보드의 엔진 값). 후 보드가 없으면 `null`. */
  paypalOnly: string | null;
  history: HistoryView | null;
  /** 위험 곡선 점 (어댑터). 없으면 `null`. */
  curvePoints: RiskPoint[] | null;
};

export type CaseDeskInput = {
  view: CaseView;
  /** 화면이 보는 보드(`pickBoard`) — 범주 알약·선택지 카드. */
  board: BoardState;
  buyer: Pick<SeedBuyer, 'name' | 'country'> | null;
  productName: string | null;
  /** 분쟁 접수 뒤 날 수 (`daysBetween(openedAt, now)`). 모르면 `null`. */
  openDays: number | null;
  /** `recommend(board)`. `null`이면 선택지 카드를 그리지 않는다 (Routine 등). */
  recommendation: Recommendation | null;
  moveForecasts: readonly MoveForecast[] | null;
  history: HistoryView | null;
  curvePoints: RiskPoint[] | null;
  /** 위험 단계 (머리글 범주 알약 색). */
  band: 'High' | 'Watch' | 'Low' | null;
};

/**
 * 사례 화면 묶음. 숫자는 옮기기만: 선택지 기대 손실 = `recommendation`(엔진) 평가, "PayPal data only" =
 * `view.compare.before`(실제 보드의 엔진 최선 수). 후 보드가 없으면(배송사 기록이 없으면) 그 줄은 없다.
 */
export function buildCaseDesk(input: CaseDeskInput): CaseDesk {
  const { view } = input;
  const before = view.compare.before;
  const paypalOnly =
    view.compare.after === null || before.expectedLoss === null
      ? null
      : t('case.choice.paypalOnly', { action: t(before.actionKey), amount: before.expectedLoss.display });
  return {
    icon: productIconOf(input.productName),
    title: t('case.head.title', {
      disputeId: view.header.disputeId,
      product: view.header.productName ?? t('case.view.productUnknown'),
    }),
    category: categoryLabel(input.board.reason, input.board.cause?.subtype),
    categoryTone: input.band === 'High' ? 'high' : 'neutral',
    meta: headMetaParts({
      amountDisplay: view.header.amount.display,
      buyer: input.buyer,
      languageKey: view.header.languageKey,
      openDays: input.openDays,
    }),
    choices: input.recommendation === null ? [] : choicesView(input.recommendation, input.moveForecasts),
    paypalOnly,
    history: input.history,
    curvePoints: input.curvePoints,
  };
}

/**
 * 보기용 값만 있을 때의 묶음 (머리글만 — 선택지·사건 기록·곡선 없음). 상품 이름·금액·언어는 `view` 그대로.
 * 서버 화면은 `buildCaseDesk`를 쓴다. 이 함수는 묶음 없이 그릴 때(견본·시험)의 기본값이다.
 */
export function deskFromView(view: CaseView): CaseDesk {
  return {
    icon: productIconOf(view.header.productName),
    title: t('case.head.title', {
      disputeId: view.header.disputeId,
      product: view.header.productName ?? t('case.view.productUnknown'),
    }),
    category: null,
    categoryTone: 'neutral',
    meta: headMetaParts({
      amountDisplay: view.header.amount.display,
      buyer: null,
      languageKey: view.header.languageKey,
      openDays: null,
    }),
    choices: [],
    paypalOnly: null,
    history: null,
    curvePoints: null,
  };
}

// ───────────────────────────── 구매자 메시지 "AI read" 태그 ─────────────────────────────

export type ReadTag = { key: string; tone: 'bad' | 'neutral'; by: 'ai' | 'code' };

/**
 * 말풍선 아래 태그 — **있는 판정만**: 카드사 언급(엔진 신호 + 그 글에 표시가 있음, 'Code decides'),
 * 화난 어조(AI 어조 판정이 참일 때 마지막 실제 글에만, 'AI suggests').
 */
export function readTags(input: { marked: boolean; isLastReal: boolean; signals: EscalationSignals | null }): ReadTag[] {
  const tags: ReadTag[] = [];
  if (input.marked && input.signals?.mentionsCardCompany === true) {
    tags.push({ key: 'case.read.threat', tone: 'bad', by: 'code' });
  }
  if (input.isLastReal && input.signals?.angryTone === true) tags.push({ key: 'case.read.angry', tone: 'neutral', by: 'ai' });
  return tags;
}

// ───────────────────────────── 2. 답장 — "As you type" · 예상 반응 ─────────────────────────────

/** 좋은 특징 (있으면 ✓) · 조심할 특징 (있으면 !). 계약의 `ReplyFeatureKey` 그대로. */
export const GOOD_FEATURES: readonly ReplyFeatureKey[] = ['apology', 'cause', 'ask', 'date', 'lang'];
export const WARN_FEATURES: readonly ReplyFeatureKey[] = ['blame', 'vague', 'refundNow'];

export type FeatureChipView = { key: ReplyFeatureKey; labelKey: string; good: boolean; hit: string | null };

/** 엔진 특징 판정 → 칩 (참인 특징만, 좋은 것 먼저). 판정이 없으면 `null` (지금 칩을 그대로 쓴다). */
export function featureChips(result: { features: ReplyFeatures; hits: ReplyFeatureHits } | null): FeatureChipView[] | null {
  if (result === null) return null;
  const chip = (key: ReplyFeatureKey, good: boolean): FeatureChipView => ({
    key,
    labelKey: `case.feature.${key}`,
    good,
    hit: result.hits[key] ?? null,
  });
  return [
    ...GOOD_FEATURES.filter((key) => result.features[key]).map((key) => chip(key, true)),
    ...WARN_FEATURES.filter((key) => result.features[key]).map((key) => chip(key, false)),
  ];
}

export type ReactionPart = { key: 'wait' | 'refund' | 'chargeback'; labelKey: string; p: number; display: string };

export type ReactionView = {
  parts: ReactionPart[];
  /** 기대 비용 (엔진 `expectedCostCents` 표기). */
  cost: string;
  moodKey: string;
  /** 지금 기분 (AI 어조 판정이 참일 때만 "angry"). 없으면 `null`. */
  nowMoodKey: string | null;
  /** 입력칸 모서리 "Chargeback 8%". */
  chargeback: string;
  /** 알약·입력칸 테두리 빨강 (시안 `fc.p.cb >= 0.5`, 기준값 config). */
  chargebackHigh: boolean;
  /** "Her mood next" 빨강 (시안 `mood < -0.5` = 엔진 기분 단계 angry). */
  moodBad: boolean;
};

/** 엔진 답장 예측 → 막대·기대 비용·기분. 예측이 없으면 `null` (숨김). */
export function reactionView(forecast: ReplyForecast | null, angryTone: boolean | null): ReactionView | null {
  // 기대 비용은 센트 정수여야 한다 (엔진 계약). 아니면 숫자를 고치지 않고 칸을 숨긴다
  if (forecast === null || !Number.isInteger(forecast.expectedCostCents)) return null;
  const part =(key: ReactionPart['key'], p: number): ReactionPart => ({
    key,
    labelKey: `case.reaction.${key}`,
    p,
    display: toPercentRounded(p),
  });
  return {
    parts: [part('wait', forecast.pWait), part('refund', forecast.pRefund), part('chargeback', forecast.pChargeback)],
    cost: toDollarsRounded(forecast.expectedCostCents),
    moodKey: `case.mood.${forecast.moodBand}`,
    nowMoodKey: angryTone === true ? 'case.mood.angry' : null,
    chargeback: toPercentRounded(forecast.pChargeback),
    chargebackHigh: riskTone(forecast.pChargeback) === 'high',
    moodBad: forecast.moodBand === 'angry',
  };
}
