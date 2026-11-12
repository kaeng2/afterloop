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

import replyModelJson from '../../../config/reply-model.json';
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

/**
 * T105 (시안 whoCol, M:740-741): 사건 기록 점줄과 위험 곡선 점이 **같이** 쓰는 색 규칙 —
 * buyer #3F4144 · bad(판매자 잘못) #C4321F · sys #9AA0A6. 시안에 없는 판매자 파랑·검정은 없다.
 */
export type HistoryTone = 'buyer' | 'bad' | 'sys';

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

/**
 * 사건 하나의 색 (시안 whoCol). 시안은 판매자 쪽 사건(추적번호 미등록·늦은 답장·지키지 못한 약속)을 모두 bad로 칠한다 →
 * 추적번호 없음·판매자 답장 = bad. 구매자 글은 buyer, 카드사 위협이 표시된 글은 bad. 나머지(결제·발송·배송사·분쟁 접수) = sys.
 */
export function toneOf(event: Pick<CaseEvent, 'kind' | 'flags'>): HistoryTone {
  if (event.kind === 'tracking_missing' || event.kind === 'seller_reply') return 'bad';
  if (event.kind === 'buyer_message') return event.flags?.includes('threat') === true ? 'bad' : 'buyer';
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

/**
 * T105 (시안 M:727-735): 사건 점 x 배치 (그리기 자리 값 — 확률 아님). 칸 너비 = 그림 폭의 1/12 고정, 사건 i의 x = i × 칸 + 8,
 * 초안 점 = 마지막 사건 + 칸. 오른쪽(약 1/3)은 Send 뒤 단계 점 자리로 비워 둔다 → 초안 점·물결 원이 오른쪽 눈금 글자와 겹치지 않는다.
 * `reserveSlots` = 시안에서 마지막 사건 뒤에 남는 칸 수(12 − 8). 사건이 많아 이 자리가 폭을 넘을 때만 칸을 줄인다.
 */
export const CURVE_X = { slots: 12, left: 8, reserveSlots: 4 } as const;

/** 시안 `lx += xStep * 0.8`: Send 뒤 단계 점 사이 간격 (칸 너비에 대한 몫 4/5, 그리기 자리 값 — 확률 아님). */
const TRAIL_GAP = 4 / 5;

export type CurveDot = { x: number; y: number; kind: CaseEventKind; tone: HistoryTone; label: string };

/** 곡선 그리기 선택 값. */
export type CurveOptions = {
  /**
   * 사건마다 색 (서버의 사건 기록 줄 `HistoryView.rows[].tone`). 같은 사건이 곡선·점줄에서 같은 색이 되게 그대로 넘긴다.
   * 없거나 길이가 점 수와 다르면 점의 `kind`만으로 `toneOf`를 쓴다.
   */
  tones?: readonly HistoryTone[] | null;
  /**
   * T105 (시안 NNONE · riskNow): 답장 칸의 글이 비었을 때 = 무응답 예측. `draftP`가 이미 엔진의 빈 글 예측값이고,
   * 여기는 큰 % 아래 글의 날짜("if no reply by {date}")만 받는다. `null`·없음 = 글이 있는 상태 (지금처럼).
   */
  noReplyBy?: string | null;
};

export type CurveView = {
  dots: CurveDot[];
  /** 사건 점을 잇는 선 (SVG points 글자). */
  line: string;
  /** 선 아래 옅은 면. */
  area: string;
  /** "Your draft" 점. 답장 예측이 없으면 `null`. */
  draft: { x: number; y: number; from: { x: number; y: number } } | null;
  /**
   * T098b: Send 뒤 단계 점 (시안 liveP — 보낸 답장 점 다음부터 단계마다 하나씩, 간격은 칸의 0.8배). 보내기 전이면 빈 배열.
   * 값은 엔진 `scenarioRisk` 그대로(`trail`), 여기서는 자리에 놓기만 한다.
   */
  steps: { x: number; y: number }[];
  /** Send 뒤인가 (시안 `curve.dash`: 보낸 뒤 실선 '0', 전에는 점선 '6 5'). */
  sent: boolean;
  /** 큰 % (답장 예측이 있으면 그 값, 없으면 마지막 사건 점). */
  headline: string;
  /** 큰 % 글자색 단계 (시안 `riskCol`). */
  headlineTone: RiskTone;
  /** 큰 % 아래 글자 키 ("with your draft" / "now" / "if no reply by {date}"). */
  headlineKey: string;
  /** 큰 % 아래 글자 채움 값 (무응답이면 `{ date }`, 아니면 빈 묶음). */
  headlineVars: Record<string, string>;
  /** "89% → 8%" (답장 예측이 있을 때만. 빈 답장 = 무응답이면 `null` — 시안 `hasFrom`). */
  fromTo: string | null;
};

/** 그리기 좌표 소수 한 자리 (시안 `toFixed(1)`). */
const tenth = (v: number): number => Math.round(v * 10) / 10;

/** 0~1 → 그림 높이 (위가 100%). 확률 값을 바꾸지 않고 자리에 놓기만 한다. */
const yOf = (p: number): number =>
  tenth(CURVE_BOX.bottom - (CURVE_BOX.bottom - CURVE_BOX.top) * Math.min(1, Math.max(0, p)));

/**
 * 칸 너비 — **사건 수로만** 정한다 (Send 뒤 단계가 늘어도 바뀌지 않는다 → 앞 점 재배치·점프 없음).
 * 시안 값 폭/12, 사건이 많아 초안·단계 자리가 폭을 넘을 때만 줄인다.
 */
function curveStep(eventCount: number): number {
  const fixed = CURVE_BOX.width / CURVE_X.slots;
  return Math.min(fixed, (CURVE_BOX.width - CURVE_X.left) / Math.max(1, eventCount - 1 + CURVE_X.reserveSlots));
}

/**
 * 위험 곡선 (어댑터 `RiskPoint[]` + 답장 예측의 `pChargeback`). 점이 없으면 `null` (카드를 숨긴다).
 * 사건 점 수 = `points` 길이 그대로. 답장 예측이 있으면 마지막 사건 다음 칸에 "Your draft" 점 하나를 더 그린다 (점선).
 *
 * T098b (시안 `send()` 뒤 liveP): `trail`이 있으면(Send 뒤 보인 단계의 엔진 `scenarioRisk` 값, 첫 값 = 보낸 답장)
 * 첫 값이 "Your draft" 자리에, 나머지는 단계마다 칸의 0.8배씩 오른쪽에 점 하나씩 붙는다. 선은 실선, 큰 % = 마지막 값.
 * T105: 앞 점 자리는 단계 수와 상관없이 그대로다 (시안 M:736-738).
 */
export function curveView(
  points: readonly RiskPoint[] | null,
  draftP: number | null,
  trail: readonly number[] = [],
  options: CurveOptions = {},
): CurveView | null {
  if (points === null || points.length === 0) return null;
  const sent = trail.length > 0;
  const firstLive = sent ? trail[0] : draftP;
  const step = curveStep(points.length);
  const tones = options.tones?.length === points.length ? options.tones : null;
  const xOf = (index: number): number => index * step + CURVE_X.left;
  const dots = points.map((point, index) => ({
    x: tenth(xOf(index)),
    y: yOf(point.pChargeback),
    kind: point.kind,
    tone: tones?.[index] ?? toneOf({ kind: point.kind }),
    label: shortDate(point.at),
  }));
  const last = dots[dots.length - 1];
  const lastP = points[points.length - 1].pChargeback;
  const line = dots.map((dot) => `${dot.x},${dot.y}`).join(' ');
  const area = `${line} ${last.x},${CURVE_BOX.bottom} ${dots[0].x},${CURVE_BOX.bottom}`;
  const draftX = xOf(points.length);
  const draft = firstLive === null ? null : { x: tenth(draftX), y: yOf(firstLive), from: { x: last.x, y: last.y } };
  const steps = trail.slice(1).map((p, index) => ({ x: tenth(draftX + (index + 1) * step * TRAIL_GAP), y: yOf(p) }));
  const shownP = sent ? trail[trail.length - 1] : draftP;
  // 무응답 상태 (시안 c.empty && !sent): 답장 예측값은 이미 엔진의 빈 글 예측, 아래 글만 바꾸고 "N% → M%"는 숨긴다
  const noReply = !sent && draftP !== null && typeof options.noReplyBy === 'string' ? options.noReplyBy : null;
  return {
    dots,
    line,
    area,
    draft,
    steps,
    sent,
    headline: toPercentRounded(shownP ?? lastP),
    headlineTone: riskTone(shownP ?? lastP),
    headlineKey:
      sent || draftP === null ? 'case.curve.now' : noReply !== null ? 'case.curve.ifNoReply' : 'case.curve.withDraft',
    headlineVars: noReply === null ? {} : { date: noReply },
    fromTo:
      shownP === null || noReply !== null
        ? null
        : t('case.curve.fromTo', { from: toPercentRounded(lastP), to: toPercentRounded(shownP) }),
  };
}

// ───────────────────────────── 빈 답장 = 무응답 예측 (T105, 시안 NNONE) ─────────────────────────────

/**
 * 무응답 예측에 더할 늦은 날 수 (`config/reply-model.json` `noReplyDays`, 시안 `nForecast({}, 2, true)`의 2).
 * 엔진 로더는 모르는 키를 버리므로(zod object) 엔진 계산에는 영향이 없다. 값이 0 이상 정수가 아니면 `null`
 * (무응답 상태를 따로 보이지 않고 지금처럼 그린다).
 */
export function noReplyDaysOf(config: unknown): number | null {
  const value = (config as { noReplyDays?: unknown } | null)?.noReplyDays;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/** `config/reply-model.json`의 `noReplyDays` (답장 칸·곡선이 같이 쓴다). */
export const NO_REPLY_DAYS: number | null = noReplyDaysOf(replyModelJson);

/** "if no reply by {date}"의 날짜: 오늘(ISO) + `days`일, `shortDate` 표기. 날짜 표기일 뿐 확률·금액이 아니다. */
export function noReplyByLabel(nowIso: string, days: number): string | null {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return null;
  return shortDate(new Date(now + days * 24 * 60 * 60 * 1000).toISOString());
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
