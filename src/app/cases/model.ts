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
import type { DemoField } from '../_shared/dispute-view';
import { toDollarsCents, toDollarsRounded } from '../_shared/money';

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
  /** 한 줄 설명 (`causeNote`). 없으면 `null`. */
  note: string | null;
  /** 규칙이 정했으면 `code` ('Code decides'), LLM이면 `ai` ('AI suggests'). */
  decidedBy: 'code' | 'ai';
  badge: BadgeKind;
  needsReview: boolean;
};

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
    buyerName: string | null;
    productName: string | null;
    /** 분쟁 금액 (센트까지). */
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

// ───────────────────────────── 글 조각 (카드사 언급 표시) ─────────────────────────────

/**
 * 글을 조각으로 가른다. `terms`가 `null`이면 한 조각이다.
 * 낱말 목록은 엔진(`CARD_COMPANY_TERMS`, T044)의 것을 그대로 쓴다 — 이 파일에 낱말을 따로 두지 않는다.
 * 대소문자를 가리지 않는다 (엔진과 같다).
 */
export function segmentsOf(text: string, terms: readonly string[] | null): TextSegment[] {
  if (terms === null || terms.length === 0 || text === '') return [{ text, mark: false }];
  const lower = text.toLowerCase();
  const lowered = terms.map((term) => term.toLowerCase()).filter((term) => term !== '');

  const out: TextSegment[] = [];
  let plainFrom = 0;
  let i = 0;
  while (i < text.length) {
    // 이 자리에서 시작하는 가장 긴 낱말 ("credit card company"가 "card company"보다 먼저)
    let hit = 0;
    for (const term of lowered) {
      if (term.length > hit && lower.startsWith(term, i)) hit = term.length;
    }
    if (hit === 0) {
      i += 1;
      continue;
    }
    if (i > plainFrom) out.push({ text: text.slice(plainFrom, i), mark: false });
    out.push({ text: text.slice(i, i + hit), mark: true });
    i += hit;
    plainFrom = i;
  }
  if (plainFrom < text.length) out.push({ text: text.slice(plainFrom), mark: false });
  return out.length === 0 ? [{ text, mark: false }] : out;
}

const hasMark = (segments: TextSegment[] | null): boolean => (segments ?? []).some((segment) => segment.mark);

// ───────────────────────────── 조각별 만들기 ─────────────────────────────

function compareSide(
  board: BoardState,
  recommendation: Recommendation,
  sourceKey: string,
  badges: BadgeKind[],
): CompareSideView {
  const best = recommendation.best;
  const cents = best?.expectedLossCents ?? null;
  return {
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
    note: cause.causeNote === undefined || cause.causeNote.trim() === '' ? null : maskPersonal(cause.causeNote),
    decidedBy,
    badge: decidedBy === 'code' ? 'codeDecides' : 'aiSuggests',
    needsReview: cause.needsReview,
  };
}

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

function messageView(message: CaseMessageInput, terms: readonly string[] | null): CaseMessageView {
  const english = message.english === null ? null : segmentsOf(maskPersonal(message.english), terms);
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
  const messages = input.messages.map((message) => messageView(message, terms));

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
      buyerName: input.buyer?.name ?? null,
      productName: input.product?.itemName ?? null,
      amount: { cents: input.boardReal.amountCents, display: toDollarsCents(input.boardReal.amountCents) },
      languageKey: input.buyer === null ? null : `case.view.lang.${input.buyer.language}`,
      buyerLocale: input.buyer === null ? null : LOCALE[input.buyer.language],
    },
    messages,
    carrier,
    compare: {
      labelKey: 'case.view.expectedLoss',
      badges: ['assumption'],
      before: compareSide(input.boardReal, recReal, 'case.view.paypalOnly', []),
      after:
        input.boardDemo === null || recDemo === null
          ? null
          : compareSide(input.boardDemo, recDemo, 'case.view.withCarrier', ['demo']),
    },
    cause: {
      before: causeView(input.boardReal.cause),
      after: input.boardDemo === null ? null : causeView(input.boardDemo.cause),
    },
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
