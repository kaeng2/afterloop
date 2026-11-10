/**
 * AI 답장: 코칭 + 영어 초안 + 구매자 언어 전송본 + 역번역 (T042, SPEC v2.4 3장, 원문 10-5와 S5 화면).
 *
 * 화면(S5)이 서버에서 부르는 함수 두 개다. 둘로 나눠 둔 이유: 판매자가 영어 초안을 고친 뒤 전송본만
 * 다시 만들 수 있어야 한다 (`translateReply`의 `draftEn`은 판매자가 고친 글일 수 있다).
 *
 * 경계 (SPEC 3장 "생성과 판정"):
 * - 숫자 판정(기대 손실·확률·금액·제안 비율)은 하지 않는다. 어떤 수도 계산하지 않는다.
 * - 사실값은 LLM이 쓰지 않는다. 날짜·금액·추적번호·통관 상태는 `⟦DATE_1⟧` 같은 토큰과
 *   `{{offerAmount}}` 같은 실행 자리표시자로만 나오고, 값은 전송 직전 단계가 채운다
 *   (`fillTokens`·`src/exec/message.ts`). 프롬프트에는 토큰 이름과 종류만 가고 **값은 가지 않는다**
 *   (`src/ai/prompts/reply.ts`).
 * - 토큰 검사와 새 약속 차단은 코드가 한다. `src/ai/tokens.ts`의 `checkTokens`를 그대로 쓰고
 *   여기서 다시 구현하지 않는다.
 *
 * LLM 출력은 신뢰하지 않는 입력이다:
 * - zod로 검증하고, **예외를 던지지 않는다**. 실패하면 `ok: false` + 사유를 돌려주고 화면이
 *   "AI unavailable"로 내려간다 (SPEC 3장).
 * - 돌려주기 전에 개인정보를 한 번 더 가린다 (`maskPersonal`). 가려진 자리는 `⟦EMAIL⟧`처럼 토큰 형식이
 *   아닌 괄호 표기가 되므로 `checkTokens`가 형식 오류로 잡아 초안이 거부된다 — 막는 쪽으로 틀린다.
 * - `detail`에는 구매자 글·초안·프롬프트·키를 싣지 않는다. 고정된 사유 코드만 쓴다.
 *
 * 호출 횟수는 고정이다: `draftReply` 1회, `translateReply` 2회(번역·역번역).
 * `buyerLocale === 'en'`이면 `translateReply`는 0회다. 다시 묻지 않는다 (분류기와 달리 재요청이 없다 —
 * 판매자가 화면에서 다시 누르는 것이 재요청이다).
 */
import { z } from 'zod';

import { maskPersonal } from '@/ai/prompts/classify';
import {
  BACK_TRANSLATE_OUTPUT_SCHEMA,
  BACK_TRANSLATE_SYSTEM,
  DRAFT_OUTPUT_SCHEMA,
  DRAFT_SYSTEM,
  TRANSLATE_OUTPUT_SCHEMA,
  TRANSLATE_SYSTEM,
  buildBackTranslateUser,
  buildDraftUser,
  buildTranslateUser,
  type ReplyMove,
} from '@/ai/prompts/reply';
import { checkTokens, type FactLocale } from '@/ai/tokens';
import type { Cause, FactToken, LlmCaller, TokenCheck } from '@/types';

export type { ReplyMove };

// ───────────────────────────── 계약 (아직 `src/types.ts`에 넣지 않는다) ─────────────────────────────

export type ReplyInput = {
  /** 구매자 글 원문 (한국어 등). 신뢰하지 않는 입력 */
  buyerMessages: string[];
  buyerLocale: FactLocale;
  /** 인사말용 이름. 이메일·주소·개인통관고유부호는 받지 않는다 */
  buyerFirstName?: string;
  /** 서명용 판매자 이름 */
  sellerName?: string;
  /** 분류 결과 (`subtype`, `causeNote`) */
  cause: Cause;
  /** 엔진이 추천한 수 = 답장의 목적 */
  move: ReplyMove;
  /** 코드가 준 사실값. 초안은 이 토큰만 쓸 수 있다 */
  facts: FactToken[];
};

export type ReplyFailureReason = 'ai_unavailable' | 'invalid_output' | 'refused';

/** 쓸 수 없는 결과. `detail`은 고정 사유 코드이고 구매자 글·초안을 담지 않는다. */
export type ReplyFailure = { ok: false; reason: ReplyFailureReason; detail: string };

export type ReplyDraft =
  | { ok: true; buyerMessageEn: string; coaching: string[]; draftEn: string }
  | ReplyFailure;

export type TranslateInput = { draftEn: string; buyerLocale: FactLocale; facts: FactToken[] };

export type ReplyTranslation =
  | { ok: true; outgoing: string; backTranslationEn: string; check: TokenCheck; sendable: boolean }
  | ReplyFailure;

export type ReplyDeps = { llm: LlmCaller };

// ───────────────────────────── 한계값 ─────────────────────────────

/** 영어 초안의 길이 상한 (지시서: 1200자 초과면 `invalid_output`). */
export const DRAFT_MAX_CHARS = 1200;
/**
 * 전송본·역번역·구매자 글 번역의 길이 상한. 초안 상한의 두 배로 둔다 — 같은 뜻을 옮기면 언어에 따라
 * 길어질 수 있고(독일어 합성어, 한국어 존댓말 어미), 그보다 길면 모델이 번역 말고 다른 것을 쓴 것이다.
 */
export const TRANSLATED_MAX_CHARS = DRAFT_MAX_CHARS * 2;
/**
 * `translateReply`에 들어오는 판매자 초안의 상한. 판매자가 고친 글이라 LLM 출력보다 느슨하게 두지만,
 * 끝이 없으면 안 된다 — 길이가 터진 요청을 돈을 들여 보내고 오류를 받는 대신 호출 없이 거부한다.
 */
export const DRAFT_INPUT_MAX_CHARS = DRAFT_MAX_CHARS * 4;

/** 코칭 개수 (지시서: 3~5개). 넘치면 앞에서 5개만 쓰고, 모자라면 `invalid_output`. */
export const COACHING_MIN = 3;
export const COACHING_MAX = 5;
/** 코칭 한 줄의 길이 상한. 프롬프트는 60자쯤을 요구하고, 넘으면 자른다 (화면 한 줄에 들어갈 만큼). */
export const COACHING_LINE_MAX = 80;

/**
 * 초안이 쓸 수 있는 실행 자리표시자. 이름은 `src/exec/message.ts`의 `SOURCES`와 같아야 한다 —
 * 거기 없는 이름은 실행 층이 거부하므로 여기서 먼저 막는다.
 * `disputeAmount`(분쟁 금액 = 구매자가 낸 돈)는 어느 수에서나 언급할 수 있고,
 * 제안·환불 금액은 그 수일 때만 쓴다.
 */
const ALLOWED_SLOTS: Readonly<Record<ReplyMove, readonly string[]>> = {
  fight: ['disputeAmount'],
  offer: ['offerAmount', 'disputeAmount'],
  refund: ['refundAmount', 'disputeAmount'],
};

/**
 * 실행 자리표시자 한 자리. 이름 길이에 상한을 두는 것은 `src/ai/tokens.ts`와 같은 이유다
 * (신뢰하지 않는 입력에서 역추적이 폭발하지 않게). 상한보다 긴 이름은 자리표시자로 세지 않고,
 * 그 안에 금액 글자가 있으면 `checkTokens`의 `literalFacts`가 잡는다.
 */
const EXEC_PLACEHOLDER = /\{\{([^{}]{0,200})\}\}/g;

// ───────────────────────────── 응답 스키마 ─────────────────────────────

/** 스키마에 없는 키(금액·확률 같은 숫자 판정 필드)는 zod가 버린다. */
const DraftSchema = z.object({
  buyer_message_en: z.string(),
  coaching: z.array(z.string()),
  draft_en: z.string(),
});

const TranslateSchema = z.object({ outgoing: z.string() });

const BackTranslateSchema = z.object({ back_translation_en: z.string() });

// ───────────────────────────── 작은 도구 ─────────────────────────────

function failure(reason: ReplyFailureReason, detail: string): ReplyFailure {
  return { ok: false, reason, detail };
}

/**
 * LLM 예외를 결과로 접는다. 거절은 `refused`, 그 밖은 `ai_unavailable`이다.
 * `src/ai/llm.ts`가 `name`으로 약속한 값만 본다 (분류기와 같은 이유로 SDK를 끌어오지 않는다).
 * 예외 메시지는 싣지 않는다 — 깨진 JSON 본문이 섞여 구매자 글이 되돌아와 있을 수 있다.
 */
function fromError(error: unknown): ReplyFailure {
  const name = error instanceof Error ? error.name : 'unknown';
  if (name === 'LlmRefusalError') return failure('refused', 'llm_refused');
  return failure('ai_unavailable', `llm_failed:${name}`);
}

/** 여러 줄을 지키면서 양끝만 다듬고 개인정보를 가린다 (문단이 있는 초안·전송본용). */
function clean(text: string): string {
  return maskPersonal(text).trim();
}

/** 한 줄로 만들고 길이를 깎는다 (코칭용). */
function oneLine(text: string, max: number): string {
  const line = maskPersonal(text).replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** 글에 적힌 실행 자리표시자 이름 (`{{ offerAmount }}` → `offerAmount`). */
function slotNames(text: string): string[] {
  return [...text.matchAll(EXEC_PLACEHOLDER)].map((match) => match[1].trim());
}

type Asked<T> = { ok: true; value: T } | ReplyFailure;

/** 호출 1회 + zod 검증. 다시 묻지 않는다 (호출 수를 고정으로 두는 것이 지시서 요구다). */
async function ask<T>(
  llm: LlmCaller,
  req: { system: string; user: string; jsonSchema: Record<string, unknown> },
  schema: z.ZodType<T>,
): Promise<Asked<T>> {
  let raw: unknown;
  try {
    raw = await llm(req);
  } catch (error) {
    return fromError(error);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return failure('invalid_output', 'output_schema');
  return { ok: true, value: parsed.data };
}

/** 길이만 보는 검사. 비었거나 상한을 넘으면 사유 코드를 돌려준다. */
function lengthProblem(text: string, max: number, what: string): string | null {
  if (text === '') return `${what}_empty`;
  if (text.length > max) return `${what}_too_long`;
  return null;
}

// ───────────────────────────── 1. 초안 ─────────────────────────────

/**
 * 초안이 사실값 규칙을 지켰는지 코드가 본다 (지시서 1번의 "코드가 하는 검증").
 *
 * `checkTokens`를 초안과 초안 자신을 비교하는 데 쓴다 — 그러면 `missing`·`newPromises`는 늘 비고
 * `extra`에 "`facts`에 없는 토큰과 형식 오류", `literalFacts`에 "글자로 쓴 사실값"만 남는다.
 * 글자로 쓴 사실값 탐지를 여기서 다시 구현하지 않기 위한 자리다 (지시서: `tokens.ts`의 기존 함수를 쓴다).
 */
function draftProblems(draftEn: string, facts: FactToken[], move: ReplyMove): string[] {
  const problems: string[] = [];

  const tooLong = lengthProblem(draftEn, DRAFT_MAX_CHARS, 'draft');
  if (tooLong !== null) return [tooLong];

  const allowed = ALLOWED_SLOTS[move];
  if (slotNames(draftEn).some((name) => !allowed.includes(name))) problems.push('draft_unknown_placeholder');

  const check = checkTokens(draftEn, draftEn, facts);
  if (check.extra.length > 0) problems.push('draft_unknown_tokens');
  if (check.literalFacts.length > 0) problems.push('draft_literal_facts');

  return problems;
}

/**
 * 코칭 + 영어 초안 (+ 구매자 글 영어 번역). LLM 호출 1회.
 *
 * 입력 객체는 바꾸지 않는다. 같은 입력·같은 LLM 응답이면 같은 결과다 (`Math.random`·`Date`를 읽지 않는다).
 */
export async function draftReply(input: ReplyInput, deps: ReplyDeps): Promise<ReplyDraft> {
  const asked = await ask(
    deps.llm,
    { system: DRAFT_SYSTEM, user: buildDraftUser(input), jsonSchema: DRAFT_OUTPUT_SCHEMA },
    DraftSchema,
  );
  if (!asked.ok) return asked;

  const draftEn = clean(asked.value.draft_en);
  const problems = draftProblems(draftEn, input.facts, input.move);
  if (problems.length > 0) return failure('invalid_output', problems.join(','));

  const coaching = asked.value.coaching
    .map((line) => oneLine(line, COACHING_LINE_MAX))
    .filter((line) => line !== '')
    .slice(0, COACHING_MAX);
  if (coaching.length < COACHING_MIN) return failure('invalid_output', 'coaching_too_few');

  // 구매자 글 번역은 판매자가 읽기만 하는 글이다 (구매자에게 가지 않는다). 구매자가 쓴 날짜·금액이
  // 그대로 들어 있어야 하므로 사실값 검사를 하지 않는다. 길이와 개인정보만 본다
  const buyerMessageEn = clean(asked.value.buyer_message_en);
  const buyerProblem =
    input.buyerMessages.length === 0
      ? null // 구매자 글이 없으면 번역도 비어 있는 것이 맞다
      : lengthProblem(buyerMessageEn, TRANSLATED_MAX_CHARS, 'buyer_message');
  if (buyerProblem !== null) return failure('invalid_output', buyerProblem);

  return { ok: true, buyerMessageEn, coaching, draftEn };
}

// ───────────────────────────── 2. 전송본 + 역번역 ─────────────────────────────

/**
 * 구매자 언어 전송본 + 역번역 + 검사. LLM 호출 2회 (번역, 역번역).
 * `buyerLocale === 'en'`이면 호출 0회로 초안을 그대로 돌려준다.
 *
 * `ok: true`는 "글을 만들었다"는 뜻이고, 보내도 되는지는 `sendable`(= `check.ok`)이 정한다.
 * 토큰이 빠지거나 늘거나, 값을 글자로 썼거나, 초안에 없는 약속이 생기면 `sendable`이 false다.
 * 토큰에 값을 채우는 일은 여기서 하지 않는다 — 전송 직전 단계가 `fillTokens`로 한다.
 */
export async function translateReply(input: TranslateInput, deps: ReplyDeps): Promise<ReplyTranslation> {
  const draftEn = input.draftEn.trim();
  const draftProblem = lengthProblem(draftEn, DRAFT_INPUT_MAX_CHARS, 'draft');
  if (draftProblem !== null) return failure('invalid_output', draftProblem);

  if (input.buyerLocale === 'en') {
    const check = checkTokens(draftEn, draftEn, input.facts);
    return { ok: true, outgoing: draftEn, backTranslationEn: draftEn, check, sendable: check.ok };
  }

  const translated = await ask(
    deps.llm,
    {
      system: TRANSLATE_SYSTEM,
      user: buildTranslateUser({ draftEn, buyerLocale: input.buyerLocale, facts: input.facts }),
      jsonSchema: TRANSLATE_OUTPUT_SCHEMA,
    },
    TranslateSchema,
  );
  if (!translated.ok) return translated;

  const outgoing = clean(translated.value.outgoing);
  const outgoingProblem = lengthProblem(outgoing, TRANSLATED_MAX_CHARS, 'outgoing');
  if (outgoingProblem !== null) return failure('invalid_output', outgoingProblem);

  // 역번역 호출에는 전송본만 준다 (영어 초안을 주면 검사가 뜻을 잃는다. 원문 10-5 2번)
  const back = await ask(
    deps.llm,
    {
      system: BACK_TRANSLATE_SYSTEM,
      user: buildBackTranslateUser({ outgoing, buyerLocale: input.buyerLocale }),
      jsonSchema: BACK_TRANSLATE_OUTPUT_SCHEMA,
    },
    BackTranslateSchema,
  );
  if (!back.ok) return back;

  const backTranslationEn = clean(back.value.back_translation_en);
  const backProblem = lengthProblem(backTranslationEn, TRANSLATED_MAX_CHARS, 'back_translation');
  if (backProblem !== null) return failure('invalid_output', backProblem);

  const check = checkTokens(draftEn, outgoing, input.facts);
  return { ok: true, outgoing, backTranslationEn, check, sendable: check.ok };
}
