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
import type { CommitmentCategory, ReplyDraft, ReplyTranslation } from '@/ai/reply';
import { fillTokens, formatFact, type FactLocale } from '@/ai/tokens';
import type { ActionPlan, FactToken, TokenCheck } from '@/types';

import type { BadgeKind } from '../_shared/badge-keys';
import type { RiskView } from './model';

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
  /** 서버가 만든 사실값 (원래 값). */
  facts: FactToken[];
  /** 구매자 언어. 모르면 `null` (전송본을 만들 수 없다). */
  buyerLocale: FactLocale | null;
  /** "후" 보드의 답장 계획 (`planMove`). 만들 수 없으면 `null`. */
  plan: ActionPlan | null;
  /** 1부 보기용 값의 `messageSend.blocked` (`offerComesFirst`). */
  offerFirst: boolean;
  mode: SendMode;
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
};

export type FactRowView = { token: string; labelKey: string; value: string };

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
  /** 영어 초안 (영어 표기로 채움). */
  draftEn: FilledText | null;
  /** 구매자 언어 전송본 (구매자 언어 표기로 채움). */
  outgoing: FilledText | null;
  backTranslationEn: string | null;
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
  planIsReply: boolean;
  offerFirst: boolean;
  sendState: SendState;
};

// ───────────────────────────── 문구 키 ─────────────────────────────

export const REPLY_KEYS = {
  unavailable: 'common.llmUnavailable',
  fixedDraft: 'case.reply.fixedDraft',
  modeSimulated: 'case.send.mode.simulated',
  modeLive: 'case.send.mode.live',
} as const;

/** 막힌 이유 키. `canSend`가 고른다. */
export const BLOCK_KEYS = {
  noDraft: 'case.send.blocked.noDraft',
  noTranslation: 'case.send.blocked.noTranslation',
  offerFirst: 'case.view.offerFirst',
  noPlan: 'case.send.blocked.noPlan',
  addedInTranslation: 'case.send.blocked.addedInTranslation',
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

/** 토큰을 채운 글. 채울 수 없으면(토큰 형식 오류·없는 토큰) 원래 글을 `filled: false`로. */
export function filledText(text: string, facts: FactToken[], locale: FactLocale): FilledText {
  const local = localizedFacts(facts, locale);
  if (local === null) return { text, filled: false };
  try {
    return { text: fillTokens(text, local), filled: true };
  } catch {
    return { text, filled: false };
  }
}

function checkRows(check: TokenCheck): CheckRowView[] {
  return [
    { labelKey: 'case.reply.check.tokens', ok: check.missing.length === 0 && check.extra.length === 0, items: [...check.missing, ...check.extra] },
    { labelKey: 'case.reply.check.literal', ok: check.literalFacts.length === 0, items: [...check.literalFacts] },
    { labelKey: 'case.reply.check.promises', ok: check.newPromises.length === 0, items: [...check.newPromises] },
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

  const draftEn = draft === null ? null : filledText(draft.draftEn, input.facts, 'en');
  const outgoing =
    translation === null || input.buyerLocale === null ? null : filledText(translation.outgoing, input.facts, input.buyerLocale);

  const localFacts = input.buyerLocale === null ? null : localizedFacts(input.facts, input.buyerLocale);
  const factRows: FactRowView[] =
    draft === null || localFacts === null
      ? []
      : localFacts.map((fact) => ({ token: fact.token, labelKey: FACT_LABEL[fact.kind], value: fact.value }));

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
    commitmentsCleared: checkOk && added.length === 0 && unconfirmed === 0,
    addedInTranslation: added.length,
    outsidePolicy: outside.length,
    unconfirmed,
    planIsReply: input.plan !== null && input.plan.apiMove === 'send_message',
    offerFirst: input.offerFirst,
    sendState: input.sendState,
  };

  return {
    available: draftOk,
    unavailableKey: draftOk ? null : REPLY_KEYS.unavailable,
    draftSource: input.draftSource,
    sourceBadges: draftOk && !fixed ? ['aiSuggests'] : [],
    fixedDraftKey: draftOk && fixed ? REPLY_KEYS.fixedDraft : null,
    coaching: draft?.coaching ?? [],
    draftEn,
    outgoing,
    backTranslationEn: translation?.backTranslationEn ?? null,
    translationUnavailable: draftOk && (translation === null || outgoing === null),
    check: translation?.check ?? null,
    checkRows: translation === null ? [] : checkRows(translation.check),
    factRows,
    commitments,
    addedInTranslation: added.map((category) => ({ category, labelKey: commitmentKey(category) })),
    mode: input.mode,
    modeKey: input.mode === 'live' ? REPLY_KEYS.modeLive : REPLY_KEYS.modeSimulated,
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
  if (!g.hasDraft) return blocked(BLOCK_KEYS.noDraft);
  if (!g.hasTranslation) return blocked(BLOCK_KEYS.noTranslation);
  if (g.addedInTranslation > 0) return blocked(BLOCK_KEYS.addedInTranslation);
  if (!g.checkOk) return blocked(BLOCK_KEYS.checkFailed);
  if (g.unconfirmed > 0) return blocked(BLOCK_KEYS.unconfirmed);
  // 확인할 약속이 없으면 모듈의 `sendable`이 그대로 답이다. 확인한 뒤에는 다시 맞춘 값이 답이다
  const sendableNow = g.outsidePolicy === 0 ? g.sendable : g.commitmentsCleared;
  if (!sendableNow) return blocked(BLOCK_KEYS.checkFailed);
  if (g.sendState === 'sending') return blocked(BLOCK_KEYS.sending);
  if (g.sendState === 'done') return blocked(BLOCK_KEYS.sent);
  if (g.sendState === 'failed') return blocked(BLOCK_KEYS.failed);
  return { ok: true, reasonKey: null };
}
