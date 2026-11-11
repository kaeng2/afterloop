/**
 * S5 Case 1부 보기용 값 (T009 1부, SPEC v2.7 2·3·7·10장, AC18 초안 1~5번·12번).
 *
 * **순수 함수만 둔다.** DOM·네트워크·시계·난수를 쓰지 않는다. 인수 테스트(AC18)가 직접 부른다.
 *
 * **계산하지 않는다** (CLAUDE.md 공통 규칙). 추천·기대 손실은 `recommend`, 확대 위험은
 * `escalationRisk`, "제안이 먼저"는 `offerComesFirst`를 **그대로 불러** 결과를 옮긴다. 금액은 값마다
 * `{ cents, display }` 두 개를 둔다 — `cents`는 엔진 값 그대로, `display`는 `_shared/money.ts`가
 * 만든 글자다 (반올림은 그 파일 한 곳에서만).
 *
 * 화면 글자는 여기서 만들지 않는다. 문구 **키**만 고른다 (`case.view.*`). 어느 행동인지(환불·답장·제안)는
 * 엔진의 `best.move`에서 고른다 — 이 파일이 "환불"·"답장"을 정하지 않는다.
 *
 * 개인정보 (SPEC 10장): 대화 글은 원문·영어 모두 `maskPersonal`을 거친다 (개인통관고유부호·이메일·전화).
 */
import { maskPersonal } from '@/ai/prompts/classify';
import type { FactLocale } from '@/ai/tokens';
import { escalationRisk } from '@/engine/escalation';
import { paramsFromConfig } from '@/engine/params';
import { offerComesFirst } from '@/engine/policy';
import { recommend } from '@/engine/recommend';
import { CARD_COMPANY_TERMS } from '@/engine/signals';
import type {
  BoardState,
  Cause,
  EscalationRisk,
  EscalationSignals,
  EscalationWeights,
  Evaluation,
  MoveType,
  Params,
  PolicyConfig,
  Recommendation,
  SeedBuyer,
  SeedCarrierEvent,
  SeedProduct,
  Subtype,
} from '@/types';

import type { BadgeKind, RiskBand } from '../_shared/badge-keys';
import { copyTables } from '../_shared/copy';
import type { DemoField } from '../_shared/dispute-view';
import { toDollarsRounded } from '../_shared/money';

// ───────────────────────────── 입력 ─────────────────────────────

/** 대화 글 1건. 실제 글(PayPal)과 시연용 글(시드 문의)을 함께 늘어놓는다. */
export type CaseMessageInput = {
  /** `paypal` = 실제 분쟁 글 ("From PayPal"), `demo` = 시드 문의 ('Demo data'). */
  source: 'paypal' | 'demo';
  /** 날짜 (`YYYY-MM-DD` 또는 ISO 날짜시각). 모르면 `null`. */
  date: string | null;
  /** 구매자가 쓴 글 (한국어 등). 신뢰하지 않는 입력이다 — 여기서 다시 가린다. */
  original: string;
  /** 영어. 없으면 `null` (AI 번역도 시드 번역도 없을 때). */
  english: string | null;
  /** 영어가 어디서 왔는지. `ai` = T042 `draftReply` 번역, `seed` = 시드 문의의 `english`. */
  englishSource: 'ai' | 'seed' | null;
};

export type CaseViewInput = {
  disputeId: string;
  statusCode: string;
  buyer: Pick<SeedBuyer, 'name' | 'language'> | null;
  product: Pick<SeedProduct, 'itemName'> | null;
  messages: CaseMessageInput[];
  /** 실제 값만 쓴 보드 ("PayPal data only"). */
  boardReal: BoardState;
  /** 배송사 정보를 덧씌운 보드 ("With carrier data"). 없으면 `null` — 후 칸과 배송사 줄을 그리지 않는다. */
  boardDemo: BoardState | null;
  carrierEvents: SeedCarrierEvent[];
  signals: EscalationSignals | null;
  signalsAfterReply: EscalationSignals | null;
  demoFields: DemoField[];
};

// ───────────────────────────── 보기용 값 ─────────────────────────────

/** 금액 1개: 엔진 센트 그대로 + 표시 글자. */
export type MoneyView = { cents: number; display: string };

/** 글 조각. `mark`가 참이면 눈에 띄게 그린다 (카드사 언급). */
export type TextSegment = { text: string; mark: boolean };

export type CaseMessageView = {
  source: 'paypal' | 'demo';
  /** 이 글에 붙는 배지 (`demo`면 'Demo data'). 실제 글은 배지 없이 "From PayPal" 표시만. */
  badges: BadgeKind[];
  /** 실제 글의 출처 표시 문구 키 (`case.badge.fromPaypal`). 시연용 글은 `null`. */
  sourceKey: string | null;
  date: string | null;
  original: TextSegment[];
  english: TextSegment[] | null;
  /** 영어에 붙는 배지 (AI 번역 → 'AI suggests', 시드 번역 → 'Demo data'). */
  englishBadges: BadgeKind[];
  /**
   * 원문이 이미 영어인가 (T068 재시도 2번). 참이면 `english`는 `null`이고 번역 줄·그 배지를 두지 않는다.
   * 판단: 구매자 언어가 EN · 번역이 원문과 같음 · 구매자 언어가 한글/가나 문자권(KO·JA)인데 원문에 그 문자가 없고 라틴 글자만 있음.
   */
  originalIsEnglish: boolean;
};

export type CarrierEventView = { date: string; statusKey: string; text: string };

export type CompareSideView = {
  /** 칸 이름 키 (`case.view.paypalOnly` / `case.view.withCarrier`). */
  sourceKey: string;
  /** 엔진이 고른 수. 고를 수 없으면 `null` ("Handle manually"). */
  move: Evaluation['move'] | null;
  apiMove: MoveType | null;
  /** 행동 글자 키. `best.move`에서 고른다 (refund → Full refund, fight → Reply, offer → Offer). */
  actionKey: string;
  /** 기대 손실. 고를 수 없으면 `null`. */
  expectedLoss: MoneyView | null;
  /** 이 칸에만 붙는 배지 (후 칸 = 'Demo data'. 배송사 정보가 시연용이라서). */
  badges: BadgeKind[];
  /**
   * 기대 손실에 든 대응 시간 비용 (가정값 `timeCostCents` — 엔진이 쓰는 값 그대로). 전액 환불 칸에만 둔다:
   * 분쟁 금액과 환불 기대 손실이 같은 화면에 있어 생기는 의문을 "incl. $N of your time"으로 푼다. 그 밖은 `null`.
   */
  timeCost: MoneyView | null;
  /** 엔진 평가 그대로 (2부가 `planMove`에 넘긴다). */
  evaluation: Evaluation | null;
};

export type CompareView = {
  /** "Expected loss" 이름표 키. */
  labelKey: string;
  /** 카드 머리 배지 ('Assumption'만). */
  badges: BadgeKind[];
  before: CompareSideView;
  /** 후 보드가 없으면 `null`. */
  after: CompareSideView | null;
};

export type CauseView = {
  subtype: Subtype;
  subtypeKey: string;
  /** 한 줄 원인 칸에 쓰는 짧은 이름 키 (`case.view.subtypeShort.A1` = "Not shipped"). */
  shortKey: string;
  /** 한 줄 설명 (`causeNote`). 없으면 `null`. */
  note: string | null;
  /** 규칙이 정했으면 `code` ('Code decides'), LLM이면 `ai` ('AI suggests'). */
  decidedBy: 'code' | 'ai';
  badge: BadgeKind;
  needsReview: boolean;
};

/**
 * 한 줄 요약 (T061 3번. 옛 원인 칸을 대체). 문구는 엔진 원인 전환(전 세부 유형 → 후 세부 유형)으로 고른다:
 * `case.view.summary.<전>_<후>`가 있으면 그것, 없으면 결정하는 쪽 원인의 세부 유형 이름(`case.view.subtype.*`).
 * 세부 유형 코드(A1 → A2)는 보조 글자로만 (`codes`).
 */
export type SummaryView = {
  key: string;
  /** 결정하는 쪽 원인의 판정 배지 (규칙 → 'Code decides', LLM → 'AI suggests'). */
  badge: BadgeKind;
  /** 보조 글자용 세부 유형 코드. 전환이면 `before`가 있고, 하나면 `before: null`. */
  codes: { before: Subtype | null; after: Subtype };
  needsReview: boolean;
};

/** 대화 안에 끼우는 배송사 줄 (가장 최근 배송사 기록 1건. 시연용이라 'Demo data'). */
export type CarrierLineView = { date: string; text: string; badges: BadgeKind[] };

export type RiskPartView = {
  signal: keyof EscalationWeights;
  labelKey: string;
  points: number;
  /** 이 신호가 시연용 데이터(시드 문의)에 기대면 참 → 'Demo data'. */
  demo: boolean;
};

export type RiskView = {
  score: number;
  band: RiskBand;
  parts: RiskPartView[];
};

export type CaseView = {
  header: {
    disputeId: string;
    statusCode: string;
    /**
     * PayPal 상태의 쉬운 말 키 (`case.status.WAITING_FOR_SELLER_RESPONSE` = "Waiting for your reply").
     * 문구 표에 없는 상태는 `null` — 화면은 원래 코드만 보인다.
     */
    statusKey: string | null;
    buyerName: string | null;
    /** 상품 이름의 쉼표 앞 부분 (`productShortName`, T068: "Wool Sweater, Navy" → "Wool Sweater"). */
    productName: string | null;
    /** 분쟁 금액. 표시는 달러 반올림 (T068 머리글 "$72"). 센트 값은 그대로. */
    amount: MoneyView;
    /** 언어 문구 키 (`case.view.lang.KO` …). 모르면 `null`. */
    languageKey: string | null;
    /** 답장 칸(2부)이 쓰는 구매자 언어. 모르면 `null`. */
    buyerLocale: FactLocale | null;
  };
  messages: CaseMessageView[];
  /** 배송사 정보. 후 보드가 없거나 이벤트가 없으면 `null`. */
  carrier: { events: CarrierEventView[]; badges: BadgeKind[] } | null;
  compare: CompareView;
  cause: { before: CauseView | null; after: CauseView | null };
  /** 한 줄 요약. 원인이 하나도 없으면 `null`. */
  summary: SummaryView | null;
  /** 대화 안에 날짜 순으로 끼우는 배송사 줄. 배송사 정보가 없으면 `null`. */
  carrierLine: CarrierLineView | null;
  /** 지금 확대 위험. 신호가 없으면 `null` (0이나 다른 값을 넣지 않는다). */
  risk: RiskView | null;
  /** 판매자가 지금 답장했다고 볼 때 (2부가 답장 뒤에 보인다). */
  riskAfterReply: RiskView | null;
  /**
   * "제안이 먼저" (SPEC v2.6 9-4, `offerComesFirst`). 참이면 메시지만 보내는 버튼을 끄고 이유를 보인다.
   * 판정은 답장 계획을 세울 보드(후 보드, 없으면 전 보드)와 그 보드로 방금 만든 추천으로 한다.
   */
  messageSend: { blocked: boolean; reasonKey: string | null };
  demoFields: DemoField[];
};

// ───────────────────────────── 문구 키 고르기 ─────────────────────────────

const ACTION_KEY: Record<Evaluation['move'], string> = {
  refund: 'case.view.action.refund',
  fight: 'case.view.action.fight',
  offer: 'case.view.action.offer',
};
const ACTION_NONE_KEY = 'case.view.action.none';

/** 엔진의 수 → 행동 글자 키. */
export function actionKeyFor(move: Evaluation['move'] | null): string {
  return move === null ? ACTION_NONE_KEY : ACTION_KEY[move];
}

const LOCALE: Record<SeedBuyer['language'], FactLocale> = { KO: 'ko', EN: 'en', JA: 'ja', DE: 'de' };

export const OFFER_FIRST_KEY = 'case.view.offerFirst';

/**
 * 머리글용 상품 이름: 시드 상품 이름의 쉼표 앞 부분 (T068. "Wool Sweater, Navy" → "Wool Sweater").
 * 쉼표가 없거나 앞 부분이 비면 이름 그대로.
 */
export function productShortName(itemName: string): string {
  const head = itemName.split(',')[0]?.trim() ?? '';
  return head === '' ? itemName.trim() : head;
}

/** PayPal 상태 코드 → 쉬운 말 키. 문구 파일(`case.status.*`)에 있는 상태만. 없으면 `null`. */
export function statusKeyFor(statusCode: string): string | null {
  if (!/^[A-Z_]+$/.test(statusCode)) return null;
  const key = `case.status.${statusCode}`;
  return typeof copyTables.en[key] === 'string' ? key : null;
}

// ───────────────────────────── 글 조각 (카드사 언급 표시) ─────────────────────────────

/**
 * 두 표시 사이 틈이 이 길이 이하이고 글자·공백뿐이면 한 표시로 잇는다 ("카드사" + "에 " + "이의제기"
 * → "카드사에 이의제기"). 문장 부호가 끼면 잇지 않는다.
 */
const JOIN_GAP_MAX = 3;
const JOINABLE_GAP = /^[\p{L}\s]*$/u;

/**
 * 글을 조각으로 가른다. `terms`가 `null`이면 한 조각이다.
 * 낱말 목록은 엔진(`CARD_COMPANY_TERMS`, T044)의 것을 그대로 쓴다 — 이 파일에 낱말을 따로 두지 않는다.
 * 대소문자를 가리지 않는다 (엔진과 같다).
 *
 * 모든 자리에서 맞는 낱말을 다 찾아 겹치는 표시를 합친다 — "dispute with my card"와 "card company"가
 * 겹치면 "dispute with my card company" 하나가 된다 (T061 4번). 아주 짧은 틈은 위 규칙으로 잇는다.
 */
export function segmentsOf(text: string, terms: readonly string[] | null): TextSegment[] {
  if (terms === null || terms.length === 0 || text === '') return [{ text, mark: false }];
  const lower = text.toLowerCase();
  const lowered = terms.map((term) => term.toLowerCase()).filter((term) => term !== '');

  // 1. 맞는 구간 전부 [시작, 끝)
  const spans: [number, number][] = [];
  for (let i = 0; i < text.length; i += 1) {
    for (const term of lowered) {
      if (lower.startsWith(term, i)) spans.push([i, i + term.length]);
    }
  }
  if (spans.length === 0) return [{ text, mark: false }];

  // 2. 겹치거나 짧은 틈으로 붙은 구간 합치기
  spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const [from, to] of spans) {
    const last = merged[merged.length - 1];
    if (last !== undefined) {
      const gap = from - last[1];
      if (gap <= 0 || (gap <= JOIN_GAP_MAX && JOINABLE_GAP.test(text.slice(last[1], from)))) {
        last[1] = Math.max(last[1], to);
        continue;
      }
    }
    merged.push([from, to]);
  }

  // 3. 조각으로
  const out: TextSegment[] = [];
  let plainFrom = 0;
  for (const [from, to] of merged) {
    if (from > plainFrom) out.push({ text: text.slice(plainFrom, from), mark: false });
    out.push({ text: text.slice(from, to), mark: true });
    plainFrom = to;
  }
  if (plainFrom < text.length) out.push({ text: text.slice(plainFrom), mark: false });
  return out;
}

const hasMark = (segments: TextSegment[] | null): boolean => (segments ?? []).some((segment) => segment.mark);

// ───────────────────────────── 조각별 만들기 ─────────────────────────────

function compareSide(
  board: BoardState,
  recommendation: Recommendation,
  sourceKey: string,
  badges: BadgeKind[],
  timeCostCents: number,
): CompareSideView {
  const best = recommendation.best;
  const cents = best?.expectedLossCents ?? null;
  return {
    timeCost: best?.move === 'refund' ? { cents: timeCostCents, display: toDollarsRounded(timeCostCents) } : null,
    sourceKey,
    move: best?.move ?? null,
    apiMove: best?.apiMove ?? null,
    actionKey: actionKeyFor(best?.move ?? null),
    expectedLoss: cents === null ? null : { cents, display: toDollarsRounded(cents) },
    badges,
    evaluation: best,
  };
}

function causeView(cause: Cause | undefined): CauseView | null {
  if (cause === undefined) return null;
  const decidedBy = cause.source === 'rule' ? 'code' : 'ai';
  return {
    subtype: cause.subtype,
    subtypeKey: `case.view.subtype.${cause.subtype}`,
    shortKey: `case.view.subtypeShort.${cause.subtype}`,
    note: cause.causeNote === undefined || cause.causeNote.trim() === '' ? null : maskPersonal(cause.causeNote),
    decidedBy,
    badge: decidedBy === 'code' ? 'codeDecides' : 'aiSuggests',
    needsReview: cause.needsReview,
  };
}

/** 한 줄 요약 키 고르기 (위 `SummaryView` 설명). 결정하는 쪽 = 후 원인이 있으면 후, 없으면 전. */
export function summaryOf(before: CauseView | null, after: CauseView | null): SummaryView | null {
  const decider = after ?? before;
  if (decider === null) return null;
  const transition = before !== null && after !== null && before.subtype !== after.subtype;
  const transitionKey = transition ? `case.view.summary.${before.subtype}_${after.subtype}` : null;
  const key = transitionKey !== null && typeof copyTables.en[transitionKey] === 'string' ? transitionKey : decider.subtypeKey;
  return {
    key,
    badge: decider.badge,
    codes: { before: transition ? before.subtype : null, after: decider.subtype },
    needsReview: decider.needsReview,
  };
}

/** 날짜 (`YYYY-MM-DD…`) → "Oct 30". 칩 날짜와 함께 쓰려고 `_shared/short-date.ts`로 옮겼다 (T068 재시도 4번). */
export { shortDate } from '../_shared/short-date';

function riskView(risk: EscalationRisk, demoSignals: ReadonlySet<keyof EscalationWeights>): RiskView {
  return {
    score: risk.score,
    band: risk.band,
    parts: risk.parts.map((part) => ({
      signal: part.signal,
      labelKey: `case.view.signal.${part.signal}`,
      points: part.points,
      demo: part.points > 0 && demoSignals.has(part.signal),
    })),
  };
}

/** 글 비교용: 공백·문장부호·대소문자를 무시한다. */
const comparable = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');

/** 한글·가나·한자. KO·JA 구매자 원문에 이 글자가 하나도 없고 라틴 글자만 있으면 원문이 영어다. */
const CJK = /[\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const LATIN = /\p{Script=Latin}/u;

/**
 * 원문이 영어인가 (T068 재시도 2번: 지호처럼 PayPal 분쟁 글이 영어면 영어가 두 번 나오던 문제).
 * 판단은 데이터만: 구매자 언어, 번역 결과(원문과 같음), 원문의 문자. 독일어처럼 라틴 문자권 언어는
 * 문자로 가를 수 없으므로 번역이 원문과 같을 때만 영어로 본다.
 */
export function originalIsEnglish(
  original: string,
  english: string | null,
  language: SeedBuyer['language'] | null,
): boolean {
  if (language === 'EN') return true;
  if (english !== null && comparable(english) !== '' && comparable(english) === comparable(original)) return true;
  if (language === 'KO' || language === 'JA') return !CJK.test(original) && LATIN.test(original);
  return false;
}

function messageView(
  message: CaseMessageInput,
  terms: readonly string[] | null,
  language: SeedBuyer['language'] | null,
): CaseMessageView {
  const isEnglish = originalIsEnglish(message.original, message.english, language);
  const english = message.english === null || isEnglish ? null : segmentsOf(maskPersonal(message.english), terms);
  const englishBadges: BadgeKind[] =
    english === null ? [] : message.englishSource === 'ai' ? ['aiSuggests'] : message.englishSource === 'seed' ? ['demo'] : [];
  return {
    source: message.source,
    badges: message.source === 'demo' ? ['demo'] : [],
    sourceKey: message.source === 'paypal' ? 'case.badge.fromPaypal' : null,
    date: message.date,
    original: segmentsOf(maskPersonal(message.original), terms),
    english,
    englishBadges,
    originalIsEnglish: isEnglish,
  };
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * S5 1부 보기용 값. `params`·`rules`를 주지 않으면 엔진이 `config/`를 읽는다 (시험은 고정 사본을 넘긴다).
 *
 * - 전·후 칸: `recommend(boardReal)`, `recommend(boardDemo)`의 `best`를 그대로 옮긴다.
 * - 위험: `escalationRisk(signals)`. 신호가 없으면 `null`.
 * - 후 보드가 없으면 후 칸·배송사 줄·후 원인이 `null`이다 (예외 없음).
 */
export function buildCaseView(input: CaseViewInput, params?: Params, rules?: PolicyConfig): CaseView {
  const recReal = recommend(input.boardReal, params, rules);
  const recDemo = input.boardDemo === null ? null : recommend(input.boardDemo, params, rules);

  // 카드사 언급은 엔진 신호가 참일 때만 표시한다 (T044가 준 근거가 있을 때만)
  const terms = input.signals?.mentionsCardCompany === true ? CARD_COMPANY_TERMS : null;
  const messages = input.messages.map((message) => messageView(message, terms, input.buyer?.language ?? null));

  // 신호가 시연용 문의에 기대는지: 무응답은 시드 문의가 있으면 늘 기댄다 (T009 1부 6번).
  // 카드사 언급은 표시한 낱말이 시연용 글에만 있을 때 기댄다.
  const usesDemoInquiries = input.demoFields.includes('earlierInquiries');
  const demoSignals = new Set<keyof EscalationWeights>();
  if (usesDemoInquiries) {
    demoSignals.add('unanswered');
    const realMentions = messages.some((m) => m.source === 'paypal' && (hasMark(m.original) || hasMark(m.english)));
    if (!realMentions) demoSignals.add('cardCompanyMention');
  }

  const replyBoard = input.boardDemo ?? input.boardReal;
  const replyRec = recDemo ?? recReal;
  const offerFirst = offerComesFirst(replyBoard, replyRec);

  const timeCostCents = (params ?? paramsFromConfig()).timeCostCents;
  const causeBefore = causeView(input.boardReal.cause);
  const causeAfter = input.boardDemo === null ? null : causeView(input.boardDemo.cause);
  const lastEvent =
    input.boardDemo === null || input.carrierEvents.length === 0
      ? null
      : [...input.carrierEvents].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))[
          input.carrierEvents.length - 1
        ];

  const carrier =
    input.boardDemo === null || input.carrierEvents.length === 0
      ? null
      : {
          events: input.carrierEvents.map((event) => ({
            date: event.date,
            statusKey: `case.view.carrierStatus.${event.status}`,
            text: event.text,
          })),
          badges: ['demo'] as BadgeKind[],
        };

  return {
    header: {
      disputeId: input.disputeId,
      statusCode: input.statusCode,
      statusKey: statusKeyFor(input.statusCode),
      buyerName: input.buyer?.name ?? null,
      productName: input.product === null || input.product === undefined ? null : productShortName(input.product.itemName),
      amount: { cents: input.boardReal.amountCents, display: toDollarsRounded(input.boardReal.amountCents) },
      languageKey: input.buyer === null ? null : `case.view.lang.${input.buyer.language}`,
      buyerLocale: input.buyer === null ? null : LOCALE[input.buyer.language],
    },
    messages,
    carrier,
    compare: {
      labelKey: 'case.view.expectedLoss',
      badges: ['assumption'],
      before: compareSide(input.boardReal, recReal, 'case.view.paypalOnly', [], timeCostCents),
      after:
        input.boardDemo === null || recDemo === null
          ? null
          : compareSide(input.boardDemo, recDemo, 'case.view.withCarrier', ['demo'], timeCostCents),
    },
    cause: { before: causeBefore, after: causeAfter },
    summary: summaryOf(causeBefore, causeAfter),
    carrierLine: lastEvent === null ? null : { date: lastEvent.date, text: lastEvent.text, badges: ['demo'] },
    risk: input.signals === null ? null : riskView(escalationRisk(input.signals, rules), demoSignals),
    riskAfterReply:
      input.signalsAfterReply === null ? null : riskView(escalationRisk(input.signalsAfterReply, rules), demoSignals),
    messageSend: { blocked: offerFirst, reasonKey: offerFirst ? OFFER_FIRST_KEY : null },
    demoFields: [...input.demoFields],
  };
}

// ───────────────────────────── 대화 글 모으기 (순수) ─────────────────────────────

/** 시드 문의 1건 (필요한 칸만). */
export type InquiryLike = { date: string; buyerId: string; original: string; english: string };

/**
 * 대화 글 배열을 만든다 (순수). 서버가 읽은 값을 넘긴다.
 *
 * - 실제 글: `buyerMessages` (이미 가려진 글). 영어는 `buyerMessageEn`(AI 번역, 실제 글 전체를 한 번에
 *   옮긴 것)이 있으면 마지막 실제 글에 붙인다. 없으면 같은 글의 시드 문의가 있을 때만 그 `english`.
 * - 시연용 글: 같은 구매자의 시드 문의 가운데 실제 글과 같지 않은 것. 날짜 순.
 *   `includeInquiries`가 거짓이면(`demoFields`에 `earlierInquiries`가 없으면) 넣지 않는다.
 */
export function caseMessages(input: {
  buyerMessages: string[];
  buyerMessageEn: string | null;
  buyerId: string | null;
  inquiries: InquiryLike[];
  includeInquiries: boolean;
}): CaseMessageInput[] {
  const own = input.buyerId === null ? [] : input.inquiries.filter((inquiry) => inquiry.buyerId === input.buyerId);
  const sameText = (a: string, b: string) => maskPersonal(a).trim() === maskPersonal(b).trim();

  const real: CaseMessageInput[] = input.buyerMessages.map((text, index) => {
    const isLast = index === input.buyerMessages.length - 1;
    if (isLast && input.buyerMessageEn !== null && input.buyerMessageEn.trim() !== '') {
      return { source: 'paypal', date: null, original: text, english: input.buyerMessageEn, englishSource: 'ai' };
    }
    const seeded = own.find((inquiry) => sameText(inquiry.original, text));
    return seeded === undefined
      ? { source: 'paypal', date: null, original: text, english: null, englishSource: null }
      : { source: 'paypal', date: null, original: text, english: seeded.english, englishSource: 'seed' };
  });

  const demo: CaseMessageInput[] = !input.includeInquiries
    ? []
    : own
        .filter((inquiry) => !input.buyerMessages.some((text) => sameText(inquiry.original, text)))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        .map((inquiry) => ({
          source: 'demo',
          date: inquiry.date,
          original: inquiry.original,
          english: inquiry.english,
          englishSource: 'seed',
        }));

  // 시연용 문의가 먼저 (분쟁 접수 전), 실제 분쟁 글이 뒤
  return [...demo, ...real];
}
