/**
 * S5 Case 2부 답장 보기용 값 (T009 2부, SPEC v2.7 3·9-1·9-4·10장, AC18 초안 6~11번).
 *
 * **순수 함수만 둔다.** DOM·네트워크·시계·난수를 쓰지 않는다. 브라우저 묶음에도 들어간다 (답장 칸이
 * 확인 상자·전송 상태가 바뀔 때마다 다시 부른다) — 서버 전용 코드·환경 변수 이름을 두지 않는다.
 *
 * **판정하지 않는다.** 토큰 검사는 `translateReply(...).check`(= `checkTokens`), 정책 밖 약속은
 * `outsidePolicy`·`addedInTranslation`(T053), "제안이 먼저"는 1부 보기용 값의 `messageSend`
 * (`offerComesFirst`)를 그대로 옮긴다. 낱말을 직접 찾지 않는다.
 *
 * 한 가지만 다시 맞춘다: `translateReply`의 `sendable`은 **확인한 약속 없이** 부른 값이다. 판매자가
 * 화면에서 범주를 확인한 뒤의 값은 답장 모듈과 같은 규칙(`check.ok` · 번역이 더한 약속 없음 ·
 * 정책 밖 약속이 모두 확인됨)으로 모듈이 준 칸만 엮어 다시 만든다 (`commitmentsCleared`).
 * 서버의 전송 코드(`send.ts`)도 같은 규칙으로 다시 본다.
 *
 * 글자는 만들지 않는다. 문구 **키**만 고른다 (`case.reply.*`, `case.send.*`). 답장 문장은 AI(T042)가
 * 쓴 것 또는 사람이 켠 고정 초안만 들어온다 — 이 파일·문구 파일에 답장 문장이 없다.
 *
 * 사실값 (지시서 "사실값 토큰 쓰는 법"): `facts`는 서버가 `replyFacts`로 만든 **원래 값**(ISO 날짜)이다.
 * 보여 줄 글만 `formatFact`로 현지 표기한 사본을 `fillTokens`에 넣어 채운다.
 */
import type { CommitmentCategory, ReplyDraft, ReplyNameProblem, ReplyTranslation } from '@/ai/reply';
import { extractTokens, fillTokens, formatFact, type FactLocale } from '@/ai/tokens';
import { fillMessage } from '@/exec/message';
import type { ActionPlan, BoardState, FactToken, TokenCheck } from '@/types';

import type { BadgeKind } from '../_shared/badge-keys';
import { toDollarsRounded } from '../_shared/money';
import { shortDate } from '../_shared/short-date';
import type { RiskView } from './model';

/**
 * make-offer는 이 PayPal 상태에서만 된다 (실제로 확인한 사실, 지시서 2부 재시도 4번).
 * PayPal API의 상태 코드라 정책값이 아니다 — 화면과 서버(`send.ts`)가 이 한 값을 함께 쓴다.
 */
export const OFFER_STATUS = 'WAITING_FOR_SELLER_RESPONSE';

/** 보내는 수 두 가지. `message` = send-message, `offer` = make-offer (메시지는 `note`에 담는다). */
export type SendKind = 'message' | 'offer';

// ───────────────────────────── 전송 방식·결과 (서버와 함께 쓰는 꼴) ─────────────────────────────

/** 전송 방식. 기본은 `simulated` (네트워크를 타지 않는다). `live`는 사람이 켠 스위치일 때만. */
export type SendMode = 'simulated' | 'live';

/** 초안 출처. `fixed`는 사람이 켠 비상용 고정 초안 ("Demo draft"). */
export type DraftSource = 'ai' | 'fixed';

/**
 * 실패 종류 (지시서 "실패했을 때 화면" 표).
 * - `blocked`: 서버가 호출 전에 막았다 (화면 밖 분쟁, 허용 목록 밖, 검사 실패, 제안이 먼저 …)
 * - `rejected`: `executeMove`가 호출 전에 거부했다 (승인·토큰·계획)
 * - `paypal_error`: PayPal이 2xx가 아닌 상태로 답했다
 * - `network`: 호출(또는 전송 직전 다시 읽기)이 예외로 끝났다
 * - `already_replied`: 전송 직전 다시 읽은 분쟁에 판매자 글이 이미 있다
 */
export type SendFailure = 'blocked' | 'rejected' | 'paypal_error' | 'network' | 'already_replied';

/** 서버 액션이 돌려주는 값. 직렬화할 수 있는 값만 담는다 (응답 본문·토큰·구매자 정보 없음). */
export type SendOutcome =
  | { ok: true; mode: 'live'; disputeId: string; endpoint: string; status: number }
  | { ok: true; mode: 'simulated'; disputeId: string }
  | { ok: false; mode: SendMode; failure: SendFailure; error: string; nextAction: string };

/** 답장 칸의 전송 상태. `failed`면 [Try again]을 눌러야 `idle`로 돌아간다 (저절로 켜지지 않는다). */
export type SendState = 'idle' | 'sending' | 'done' | 'failed';

// ───────────────────────────── 입력 ─────────────────────────────

export type ReplyViewInput = {
  /** 코칭 + 영어 초안 (T042 `draftReply`, 또는 고정 초안을 같은 꼴로). */
  draft: ReplyDraft;
  /** 전송본 + 역번역 + 검사 (T042 `translateReply`). 부르지 못했으면 `null`. */
  translation: ReplyTranslation | null;
  /** 서버가 만든 사실값 (원래 값). **전송본용** 벌 (이름은 구매자 언어 꼴, `caseReplyFacts(...).outgoing`). */
  facts: FactToken[];
  /** 영어 초안·코칭·역번역용 벌 (이름은 영어 꼴, `caseReplyFacts(...).draft`). 없으면 `facts`. */
  draftFacts?: FactToken[];
  /**
   * "후" 보드. 미리보기의 금액 자리표시자(`{{disputeAmount}}`)를 실행 층과 같은 함수(`fillMessage`)로
   * 채우는 데만 쓴다. 없으면 금액 자리표시자를 채우지 않는다.
   */
  board?: BoardState | null;
  /** PayPal 상태 코드 (`OFFER_STATUS`일 때만 제안 버튼이 켜진다). */
  statusCode?: string;
  /** 구매자 언어. 모르면 `null` (전송본을 만들 수 없다). */
  buyerLocale: FactLocale | null;
  /** "후" 보드의 답장 계획 (`planMove`). 만들 수 없으면 `null`. */
  plan: ActionPlan | null;
  /** 1부 보기용 값의 `messageSend.blocked` (`offerComesFirst`). */
  offerFirst: boolean;
  mode: SendMode;
  /**
   * 연결 표에서 이 분쟁의 실제 전송이 허용되는가 (`liveSendAllowed`, 서버가 정한 값). 스위치가 켜져 있어도
   * 거짓이면 "Live" 글자를 보이지 않는다 (T061 전송 상태 표시). 주지 않으면 허용으로 본다.
   */
  liveAllowed?: boolean;
  draftSource: DraftSource;
  /** 판매자가 화면에서 확인한 약속 범주. */
  confirmed: CommitmentCategory[];
  sendState: SendState;
  outcome: SendOutcome | null;
  /** 1부 보기용 값의 `riskAfterReply` (`escalationRisk(signalsAfterReply)`). */
  riskAfterReply: RiskView | null;
};

// ───────────────────────────── 보기용 값 ─────────────────────────────

/** 채운 글. `filled`가 거짓이면 토큰을 채우지 못해 원래 글(토큰 그대로)을 보인다. */
export type FilledText = { text: string; filled: boolean };

export type CheckRowView = {
  /** 검사 이름 키 (`case.reply.check.tokens` …). */
  labelKey: string;
  ok: boolean;
  /** 걸린 글자 (토큰 이름·직접 쓴 값·약속 표현). 통과면 빈 배열. */
  items: string[];
  /**
   * 늘 보이는 줄인가 (T061 6번: Facts match · No new promises). 거짓인 줄은 "More checks" 접기 안에 두되,
   * **실패하면 접기와 상관없이 보인다** (`visibleChecks`).
   */
  primary: boolean;
};

/** 사실값 줄. `primary`면 늘 보인다 (확인 기한 날짜). 나머지(이름·서명)는 접기 안. */
export type FactRowView = { token: string; labelKey: string; value: string; primary: boolean };

export type CommitmentView = { category: CommitmentCategory; labelKey: string; confirmed: boolean };

export type ResultView =
  | { kind: 'simulated' }
  | { kind: 'sent'; endpoint: string; status: number; disputeId: string }
  | { kind: 'failed'; failure: SendFailure; error: string; nextAction: string; nothingSent: boolean };

export type SendGate = { ok: boolean; reasonKey: string | null };

export type ReplyView = {
  /** AI 초안(또는 고정 초안)이 있는가. 없으면 "AI unavailable — showing rules only". */
  available: boolean;
  unavailableKey: string | null;
  draftSource: DraftSource;
  /** 초안·전송본 칸의 배지. AI면 'AI suggests', 고정 초안이면 없음 (대신 `fixedDraftKey`). */
  sourceBadges: BadgeKind[];
  fixedDraftKey: string | null;
  coaching: string[];
  /** "Suggested reply covers:" 칩 (`replyChips` + 토큰 채움). 빈 배열이면 칩 줄을 숨긴다. */
  chips: string[];
  /** 영어 초안 (영어 표기로 채움). */
  draftEn: FilledText | null;
  /** 구매자 언어 전송본 (구매자 언어 표기로 채움). 실제로 나갈 글자와 같다 (`screenText`). */
  outgoing: FilledText | null;
  /** 역번역 (영어 표기로 채움). */
  backTranslationEn: string | null;
  /** 제안이 먼저인 분쟁의 주 버튼 ("Send offer · $7"). 제안 계획이 없으면 `null`. */
  offer: OfferView | null;
  /** 전송본을 만들지 못했으면 참 (초안은 있는데 번역이 없음). */
  translationUnavailable: boolean;
  /** 코드 검사 결과 그대로 + 줄 셋. 'Code decides'. */
  check: TokenCheck | null;
  checkRows: CheckRowView[];
  /** 채운 사실값 (예: 확인 기한 "11월 17일"). */
  factRows: FactRowView[];
  /** 정책 밖 약속 (판매자가 범주마다 확인해야 한다). */
  commitments: CommitmentView[];
  /** 번역이 더한 약속 (확인으로 풀리지 않는다). */
  addedInTranslation: { category: CommitmentCategory; labelKey: string }[];
  mode: SendMode;
  modeKey: string;
  gate: GateFacts;
  result: ResultView | null;
  /** 가짜 전송이 끝난 뒤에만 [Reset]. 실제 전송에는 없다. */
  canReset: boolean;
  /** 실패 뒤에만 [Try again]. */
  canRetry: boolean;
  /** 답장 후 위험 (성공했을 때만. 실패하면 보이지 않는다). */
  riskAfterReply: RiskView | null;
};

/** `canSend`가 보는 값 (보기용 값에 함께 둔다 — 화면이 따로 판정하지 않게). */
export type GateFacts = {
  hasDraft: boolean;
  hasTranslation: boolean;
  /** `check.ok` (토큰 일치·직접 쓴 값 없음·새 약속 없음). */
  checkOk: boolean;
  /** `translateReply`가 준 `sendable` (확인 없이 부른 값). */
  sendable: boolean;
  /** 확인한 범주를 넣고 다시 맞춘 값 (위 머리 설명). */
  commitmentsCleared: boolean;
  addedInTranslation: number;
  /** 정책 밖 약속 범주 수 / 그 가운데 확인하지 않은 수. */
  outsidePolicy: number;
  unconfirmed: number;
  /** 이름 토큰 둘레 문제 수 (`translateReply(...).nameProblems`, T056). 확인으로 풀리지 않는다. */
  nameProblems: number;
  planIsReply: boolean;
  /** 계획이 make-offer이고 금액이 있다 (제안 버튼). */
  planIsOffer: boolean;
  /** PayPal 상태가 `OFFER_STATUS`다. */
  statusAllowsOffer: boolean;
  offerFirst: boolean;
  sendState: SendState;
};

/** 제안 버튼. 금액은 엔진 계획(`planMove` → `recommend`의 제안)의 `amountCents`를 달러 반올림한 표기. */
export type OfferView = { amountDisplay: string; amountCents: number };

// ───────────────────────────── 문구 키 ─────────────────────────────

export const REPLY_KEYS = {
  unavailable: 'common.llmUnavailable',
  fixedDraft: 'case.reply.fixedDraft',
  modeSimulated: 'case.send.mode.simulated',
  modeLive: 'case.send.mode.live',
  modeLiveNotAllowed: 'case.send.mode.liveNotAllowed',
} as const;

/**
 * 전송 모드 글자 키 (T061 전송 상태 표시). 모드는 서버가 정한다 — 화면은 옮기기만.
 * - 스위치 꺼짐 → "Simulated send — nothing goes to PayPal"
 * - 켜짐 + 연결 표 허용 → "Live · PayPal sandbox"
 * - 켜짐 + 연결 표 불허 → "Live send not allowed for this case — nothing goes to PayPal" (보내면 서버가 거부한다)
 */
export function sendModeKey(mode: SendMode, liveAllowed: boolean): string {
  if (mode !== 'live') return REPLY_KEYS.modeSimulated;
  return liveAllowed ? REPLY_KEYS.modeLive : REPLY_KEYS.modeLiveNotAllowed;
}

/**
 * "Suggested reply covers:" 칩 글자 (T068). **화면은 칩 글자를 짓지 않는다.**
 * - 초안에 `chips`(T069, AI가 만든 짧은 칩)가 있으면 그것을 그대로.
 * - 비었거나 없으면(걸러져 `chips: []`, T069 병합 전, 고정 초안) 코칭 줄을 그대로 칩으로 쓴다 (긴 글자도 줄이지 않는다).
 * - 초안이 없으면 빈 배열 (칩 줄을 숨긴다).
 * 토큰(⟦DATE_1⟧ …)은 여기서 채우지 않는다 — `buildReplyView`가 영어 초안과 같은 길(`screenText`)로 채운다.
 */
export function replyChips(draft: ReplyDraft): string[] {
  if (!draft.ok) return [];
  const chips = (draft as { chips?: unknown }).chips;
  if (Array.isArray(chips) && chips.every((chip): chip is string => typeof chip === 'string')) {
    const kept = chips.map((chip) => chip.trim()).filter((chip) => chip !== '');
    if (kept.length > 0) return kept;
  }
  return draft.coaching.map((line) => line.trim()).filter((line) => line !== '');
}

/** 검사 줄 나누기: 보이는 줄(늘 보이는 줄 + 실패한 줄)과 접기 안의 줄(통과한 나머지). */
export function visibleChecks(rows: CheckRowView[]): { shown: CheckRowView[]; folded: CheckRowView[] } {
  return {
    shown: rows.filter((row) => row.primary || !row.ok),
    folded: rows.filter((row) => !row.primary && row.ok),
  };
}

/** 막힌 이유 키. `canSend`가 고른다. */
export const BLOCK_KEYS = {
  noDraft: 'case.send.blocked.noDraft',
  noTranslation: 'case.send.blocked.noTranslation',
  offerFirst: 'case.view.offerFirst',
  noPlan: 'case.send.blocked.noPlan',
  noOffer: 'case.send.blocked.noOffer',
  offerStatus: 'case.send.blocked.offerStatus',
  addedInTranslation: 'case.send.blocked.addedInTranslation',
  nameHonorific: 'case.send.blocked.nameHonorific',
  checkFailed: 'case.send.blocked.checkFailed',
  unconfirmed: 'case.send.blocked.unconfirmed',
  sending: 'case.send.blocked.sending',
  sent: 'case.send.blocked.sent',
  failed: 'case.send.blocked.failed',
} as const;

const commitmentKey = (category: CommitmentCategory) => `case.reply.commitment.${category}`;

/** 사실값 종류 → 이름 키. 날짜는 "판매자가 다시 연락하는 날"이다 (SPEC v2.7. "Delivery date"가 아니다). */
const FACT_LABEL: Record<FactToken['kind'], string> = {
  DATE: 'case.reply.fact.DATE',
  AMOUNT: 'case.reply.fact.AMOUNT',
  TRACKING: 'case.reply.fact.TRACKING',
  CUSTOMS_STATUS: 'case.reply.fact.CUSTOMS_STATUS',
  BUYER_NAME: 'case.reply.fact.BUYER_NAME',
  SELLER_NAME: 'case.reply.fact.SELLER_NAME',
};

/** 이름 토큰 둘레 문제 → 검사 줄에 보일 글자 키. */
const NAME_PROBLEM_KEY: Record<ReplyNameProblem, string> = {
  honorific_after_name: 'case.reply.check.nameHonorific',
};

// ───────────────────────────── 조각 ─────────────────────────────

/** 사실값을 현지 표기로 바꾼 사본 (원래 값은 바꾸지 않는다). 표기할 수 없으면 `null`. */
export function localizedFacts(facts: FactToken[], locale: FactLocale): FactToken[] | null {
  try {
    return facts.map((fact) => ({ ...fact, value: formatFact(fact.kind, fact.value, locale) }));
  } catch {
    return null;
  }
}

/**
 * 사실값 토큰만 채운다: 원래 값 → `formatFact`(그 언어 표기) → `fillTokens`. 이름 값은 그대로 들어간다.
 * 서버의 전송 코드(`send.ts`)도 이 함수로 `messageTemplate`을 만든다. 채울 수 없으면 예외.
 */
export function fillFactTokens(text: string, facts: FactToken[], locale: FactLocale): string {
  const local = facts.map((fact) => ({ ...fact, value: formatFact(fact.kind, fact.value, locale) }));
  return fillTokens(text, local);
}

/** 금액 자리표시자를 채울 출처 (`fillMessage`가 `plan.amountCents`·`board.amountCents`만 읽는다). */
export type MoneySource = { plan: ActionPlan; board: BoardState };

/**
 * 화면에 보이는 글. **보내는 글(전송본)이면 실제로 나갈 글자와 똑같다** — 전송 경로와 같은 두 단계다:
 *  1. `fillFactTokens` (사실값 토큰)
 *  2. 실행 층의 `fillMessage` (금액 자리표시자 → `$7.00`, 남은 토큰·직접 쓴 금액 거부). `executeMove`가
 *     `messageTemplate`에 하는 것과 같은 함수다.
 * 금액 출처가 없으면 2단계를 건너뛰고, 그때 `{{…}}`가 남으면 채우지 못한 것으로 본다.
 * 채우지 못하면 원래 글을 `filled: false`로 (보내기도 같은 자리에서 막힌다).
 */
export function screenText(text: string, facts: FactToken[], locale: FactLocale, money: MoneySource | null): FilledText {
  let withFacts: string;
  try {
    withFacts = fillFactTokens(text, facts, locale);
  } catch {
    return { text, filled: false };
  }
  if (money === null) {
    return /\{\{|\}\}|⟦|⟧/.test(withFacts) ? { text, filled: false } : { text: withFacts, filled: true };
  }
  const filled = fillMessage(withFacts, money.plan, money.board);
  return filled.ok ? { text: filled.message, filled: true } : { text, filled: false };
}

/**
 * 칩 글자 (T068 재시도 4번). 날짜 토큰만 **짧은 달 이름**("Nov 17")으로 먼저 채우고, 나머지는 영어 초안과
 * 같은 길(`screenText`, 영어 벌)이다. 같은 날짜 값의 표시만 바꾼다 — 날짜를 계산하지 않고, 보내는 글·검사 줄의
 * 날짜 꼴(`formatFact`)은 그대로다. 날짜 값이 ISO 꼴이 아니면 짧게 바꾸지 않는다 (`screenText`가 그대로 다룬다).
 */
export function chipText(chip: string, facts: FactToken[], money: MoneySource | null): string {
  let text = chip;
  for (const fact of facts) {
    if (fact.kind !== 'DATE') continue;
    const short = shortDate(fact.value);
    if (short === fact.value) continue;
    text = text.split(fact.token).join(short);
  }
  return screenText(text, facts, 'en', money).text;
}

/** 토큰을 채운 글 (금액 자리표시자 없음). 채울 수 없으면 원래 글을 `filled: false`로. */
export function filledText(text: string, facts: FactToken[], locale: FactLocale): FilledText {
  return screenText(text, facts, locale, null);
}

/**
 * 검사 줄. 코드가 하는 검사만 줄이 된다: 토큰 셋(`checkTokens`) + 이름 호칭(`nameProblems`, T056).
 * 이름 줄은 문제 코드마다 이름 키가 다르다 (지금은 `honorific_after_name` 하나).
 */
function checkRows(check: TokenCheck, nameProblems: ReplyNameProblem[]): CheckRowView[] {
  return [
    {
      labelKey: 'case.reply.check.tokens',
      ok: check.missing.length === 0 && check.extra.length === 0,
      items: [...check.missing, ...check.extra],
      primary: true,
    },
    { labelKey: 'case.reply.check.literal', ok: check.literalFacts.length === 0, items: [...check.literalFacts], primary: false },
    { labelKey: 'case.reply.check.promises', ok: check.newPromises.length === 0, items: [...check.newPromises], primary: true },
    {
      labelKey: NAME_PROBLEM_KEY.honorific_after_name,
      ok: !nameProblems.includes('honorific_after_name'),
      items: [],
      primary: false,
    },
  ];
}

function resultView(outcome: SendOutcome | null): ResultView | null {
  if (outcome === null) return null;
  if (outcome.ok && outcome.mode === 'simulated') return { kind: 'simulated' };
  if (outcome.ok && outcome.mode === 'live') {
    return { kind: 'sent', endpoint: outcome.endpoint, status: outcome.status, disputeId: outcome.disputeId };
  }
  if (outcome.ok) return null;
  return {
    kind: 'failed',
    failure: outcome.failure,
    error: outcome.error,
    nextAction: outcome.nextAction,
    // PayPal이 2xx가 아닌 상태로 답했을 때 "nothing was sent"를 함께 보인다 (지시서 실패 표 2번째 줄)
    nothingSent: outcome.failure === 'paypal_error',
  };
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * 답장 칸 보기용 값. 같은 입력이면 같은 값이다.
 *
 * - 초안이 없으면 (`draft.ok === false`) `available: false` + "AI unavailable". 1부 내용은 그대로다.
 * - 전송본은 `translation.outgoing`을 구매자 언어 표기로 채운 글. 영어 초안은 영어 표기로 채운다.
 * - 검사 줄은 `translation.check`의 칸을 옮긴다. 코드가 하지 않는 검사는 줄로 만들지 않는다.
 */
export function buildReplyView(input: ReplyViewInput): ReplyView {
  const draftOk = input.draft.ok;
  const draft = input.draft.ok ? input.draft : null;
  const translation = input.translation !== null && input.translation.ok ? input.translation : null;
  const fixed = input.draftSource === 'fixed';

  const draftFacts = input.draftFacts ?? input.facts;
  const money: MoneySource | null =
    input.plan === null || input.board === undefined || input.board === null ? null : { plan: input.plan, board: input.board };

  // 미리보기는 모두 채운 글 (지시서 2부 재시도 3번). 영어 글은 영어 벌, 전송본은 전송본 벌
  const draftEn = draft === null ? null : screenText(draft.draftEn, draftFacts, 'en', money);
  const outgoing =
    translation === null || input.buyerLocale === null
      ? null
      : screenText(translation.outgoing, input.facts, input.buyerLocale, money);
  const coaching = (draft?.coaching ?? []).map((line) => screenText(line, draftFacts, 'en', money).text);
  const chips = replyChips(input.draft).map((chip) => chipText(chip, draftFacts, money));
  const backTranslationEn =
    translation === null ? null : screenText(translation.backTranslationEn, draftFacts, 'en', money).text;
  const nameProblems = translation?.nameProblems ?? [];
  const planIsOffer = input.plan !== null && input.plan.apiMove === 'make_offer' && input.plan.amountCents !== null;
  const offer: OfferView | null =
    input.offerFirst && planIsOffer && input.plan !== null && input.plan.amountCents !== null
      ? { amountCents: input.plan.amountCents, amountDisplay: toDollarsRounded(input.plan.amountCents) }
      : null;

  const usedInDraft = new Set(draft === null ? [] : extractTokens(draft.draftEn));
  const localFacts = input.buyerLocale === null ? null : localizedFacts(input.facts, input.buyerLocale);
  const factRows: FactRowView[] =
    draft === null || localFacts === null
      ? []
      : localFacts
          // 영어 초안에 실제로 쓰인 토큰만 보인다 (T058). 쓰이지 않은 사실값 줄은 숨긴다 — 표시만 거른다
          .filter((fact) => usedInDraft.has(fact.token))
          .map((fact) => ({
            token: fact.token,
            labelKey: FACT_LABEL[fact.kind],
            value: fact.value,
            primary: fact.kind === 'DATE',
          }));

  // 정책 밖 약속: 전송본을 만들 때 모듈이 다시 본 값이 있으면 그것, 없으면 초안의 값 (T053)
  const outside = translation?.outsidePolicy ?? draft?.outsidePolicy ?? [];
  const added = translation?.addedInTranslation ?? [];
  const commitments: CommitmentView[] = outside.map((category) => ({
    category,
    labelKey: commitmentKey(category),
    confirmed: input.confirmed.includes(category),
  }));
  const unconfirmed = commitments.filter((commitment) => !commitment.confirmed).length;

  const checkOk = translation?.check.ok ?? false;
  const result = resultView(input.outcome);
  const succeeded = input.sendState === 'done' && input.outcome !== null && input.outcome.ok;

  const gate: GateFacts = {
    hasDraft: draftOk,
    hasTranslation: translation !== null && outgoing !== null,
    checkOk,
    sendable: translation?.sendable ?? false,
    commitmentsCleared: checkOk && added.length === 0 && unconfirmed === 0 && nameProblems.length === 0,
    addedInTranslation: added.length,
    outsidePolicy: outside.length,
    unconfirmed,
    nameProblems: nameProblems.length,
    planIsReply: input.plan !== null && input.plan.apiMove === 'send_message',
    planIsOffer,
    statusAllowsOffer: input.statusCode === OFFER_STATUS,
    offerFirst: input.offerFirst,
    sendState: input.sendState,
  };

  return {
    available: draftOk,
    unavailableKey: draftOk ? null : REPLY_KEYS.unavailable,
    draftSource: input.draftSource,
    sourceBadges: draftOk && !fixed ? ['aiSuggests'] : [],
    fixedDraftKey: draftOk && fixed ? REPLY_KEYS.fixedDraft : null,
    coaching,
    chips,
    draftEn,
    outgoing,
    backTranslationEn,
    offer,
    translationUnavailable: draftOk && (translation === null || outgoing === null),
    check: translation?.check ?? null,
    checkRows: translation === null ? [] : checkRows(translation.check, nameProblems),
    factRows,
    commitments,
    addedInTranslation: added.map((category) => ({ category, labelKey: commitmentKey(category) })),
    mode: input.mode,
    modeKey: sendModeKey(input.mode, input.liveAllowed ?? true),
    gate,
    result,
    canReset: input.mode === 'simulated' && succeeded,
    canRetry: input.sendState === 'failed',
    riskAfterReply: succeeded ? input.riskAfterReply : null,
  };
}

/**
 * 전송 버튼을 켜도 되는가 (지시서 "전송 버튼이 켜지는 조건" + 제안이 먼저 + 정책 밖 약속).
 * 이유는 먼저 걸린 것 하나만 돌려준다 (문구 키). 순서: 제안이 먼저 → 답장 계획 없음 → 초안 없음 →
 * 전송본 없음 → 번역이 더한 약속 → 토큰 검사 → 확인 안 한 약속 → 전송 상태.
 */
export function canSend(view: Pick<ReplyView, 'gate'>): SendGate {
  const g = view.gate;
  const blocked = (reasonKey: string): SendGate => ({ ok: false, reasonKey });

  // 분쟁 자체가 메시지를 받을 수 없는 이유가 먼저다 (초안이 없어도 그 이유가 보이게)
  if (g.offerFirst) return blocked(BLOCK_KEYS.offerFirst);
  if (!g.planIsReply) return blocked(BLOCK_KEYS.noPlan);
  return contentGate(g);
}

/**
 * 제안 버튼("Send offer · $7")을 켜도 되는가. 메시지 보내기와 **같은 글 검사**를 지난다 (`contentGate`).
 * 앞에 둘을 더 본다: 제안이 먼저인 분쟁 + make-offer 계획이 있는가, PayPal 상태가 `OFFER_STATUS`인가.
 * 서버(`send.ts`)도 같은 판정을 다시 한다.
 */
export function canSendOffer(view: Pick<ReplyView, 'gate'>): SendGate {
  const g = view.gate;
  if (!g.offerFirst || !g.planIsOffer) return { ok: false, reasonKey: BLOCK_KEYS.noOffer };
  if (!g.statusAllowsOffer) return { ok: false, reasonKey: BLOCK_KEYS.offerStatus };
  return contentGate(g);
}

/** 입력칸 글이 검사받은 초안과 다를 때의 이유 키 (T076). */
export const EDITED_KEY = 'case.reply.editedCantSend';

/**
 * 답장 입력칸(T076)의 관문. **보내는 글은 늘 서버가 기억한 검사 통과 초안**이다 — 입력칸 글은 예측을 바꾸는 용도이고
 * 서버로 가지 않는다. 그래서 입력칸 글이 초안(`anchor`)과 한 글자라도 다르면 [Send]를 끈다 (이유: "use AI draft").
 * 같으면 지금 관문(`canSend`) 결과를 **그대로** 돌려준다.
 */
export function editGate(gate: SendGate, text: string, anchor: string | null): SendGate {
  if (anchor === null || text === anchor) return gate;
  return { ok: false, reasonKey: EDITED_KEY };
}

/** 두 버튼이 함께 쓰는 글 검사 + 전송 상태. 순서: 초안 → 전송본 → 번역이 더한 약속 → 토큰 → 이름 → 약속 확인 → 상태. */
function contentGate(g: GateFacts): SendGate {
  const blocked = (reasonKey: string): SendGate => ({ ok: false, reasonKey });
  if (!g.hasDraft) return blocked(BLOCK_KEYS.noDraft);
  if (!g.hasTranslation) return blocked(BLOCK_KEYS.noTranslation);
  if (g.addedInTranslation > 0) return blocked(BLOCK_KEYS.addedInTranslation);
  if (!g.checkOk) return blocked(BLOCK_KEYS.checkFailed);
  if (g.nameProblems > 0) return blocked(BLOCK_KEYS.nameHonorific);
  if (g.unconfirmed > 0) return blocked(BLOCK_KEYS.unconfirmed);
  // 확인할 약속이 없으면 모듈의 `sendable`이 그대로 답이다. 확인한 뒤에는 다시 맞춘 값이 답이다
  const sendableNow = g.outsidePolicy === 0 ? g.sendable : g.commitmentsCleared;
  if (!sendableNow) return blocked(BLOCK_KEYS.checkFailed);
  if (g.sendState === 'sending') return blocked(BLOCK_KEYS.sending);
  if (g.sendState === 'done') return blocked(BLOCK_KEYS.sent);
  if (g.sendState === 'failed') return blocked(BLOCK_KEYS.failed);
  return { ok: true, reasonKey: null };
}
