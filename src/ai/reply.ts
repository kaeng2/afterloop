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
 * - `detail`에는 구매자 글·초안·프롬프트·키를 싣지 않는다. `ReplyFailureDetail`에 적힌 고정 사유 코드만
 *   쓴다 (오류 이름도 그대로 붙이지 않는다. T050 6번).
 *
 * 판매자가 고친 초안도 신뢰하지 않는 입력이다: `translateReply`는 **호출 전에** 그 초안을 검사해서
 * 사실값을 글자로 쓴 글·연락처가 든 글을 거부한다 (T050 3·4번. `draftInputProblem`).
 *
 * 호출 횟수는 고정이다: `draftReply` 1회, `translateReply` 2회(번역·역번역).
 * `buyerLocale === 'en'`이거나 판매자 초안이 위 검사를 통과하지 못하면 `translateReply`는 0회다.
 * 다시 묻지 않는다 (분류기와 달리 재요청이 없다 — 판매자가 화면에서 다시 누르는 것이 재요청이다).
 */
import { z } from 'zod';

import rulesConfigJson from '../../config/rules.json';
import { findCommitments, type CommitmentCategory } from '@/ai/commitments';
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
import { SUBTYPES } from '@/engine/params';
import type { Cause, FactToken, LlmCaller, ReplyDraftPolicy, TokenCheck } from '@/types';

export type { ReplyMove };
export type { CommitmentCategory };

// ───────────────────────────── 계약 (아직 `src/types.ts`에 넣지 않는다) ─────────────────────────────

export type ReplyInput = {
  /** 구매자 글 원문 (한국어 등). 신뢰하지 않는 입력 */
  buyerMessages: string[];
  buyerLocale: FactLocale;
  // 이름 칸(`buyerFirstName`·`sellerName`)은 T056에서 없앴다. 이름은 `facts`의 `⟦BUYER_NAME_1⟧`·
  // `⟦SELLER_NAME_1⟧`로만 넘긴다 (`src/ai/names.ts`의 `nameFactsPair`). 값은 모델에 가지 않는다
  /** 분류 결과 (`subtype`, `causeNote`) */
  cause: Cause;
  /** 엔진이 추천한 수 = 답장의 목적 */
  move: ReplyMove;
  /** 코드가 준 사실값. 초안은 이 토큰만 쓸 수 있다 */
  facts: FactToken[];
  /**
   * 토큰 하나의 뜻 한 줄 (T053). 프롬프트의 `<facts>`에 그대로 간다.
   * 답장 후 확인 기한 토큰(`FOLLOW_UP_DATE_TOKEN`)의 뜻은 정책이 정하므로 여기 적어도 쓰이지 않고,
   * 적지 않은 토큰은 종류별 기본 한 줄이 쓰인다 (`src/ai/prompts/reply.ts`).
   */
  factMeanings?: Record<string, string>;
};

export type ReplyFailureReason = 'ai_unavailable' | 'invalid_output' | 'refused';

/**
 * `detail`에 쓸 수 있는 **고정 사유 코드 전부** (T050 6번, `reports/T042-verify.md` ⑤).
 *
 * 목록을 타입으로 둬서 구매자 글·초안·프롬프트·키·오류 메시지가 `detail`에 들어갈 길이 없게 한다 —
 * 새 사유를 쓰려면 여기에 먼저 적어야 한다. LLM 쪽 실패는 `src/ai/llm.ts`가 던지는 클래스 이름만
 * 받고, 모르는 이름은 `unknown_error`다 (이름을 그대로 붙이지 않는다).
 */
export type ReplyFailureDetail =
  // LLM 호출
  | 'llm_failed:LlmError'
  | 'llm_failed:LlmApiError'
  | 'llm_failed:LlmConfigError'
  | 'llm_failed:LlmResponseError'
  | 'llm_refused'
  | 'unknown_error'
  | 'output_schema'
  // 모델이 쓴 초안
  | 'draft_empty'
  | 'draft_too_long'
  | 'draft_unknown_placeholder'
  | 'draft_unknown_tokens'
  | 'draft_literal_facts'
  // 판매자가 고친 초안 (`translateReply`의 입력)
  | 'draft_has_personal_data'
  | 'draft_has_literal_facts'
  // 코칭·구매자 글 번역
  | 'coaching_too_few'
  | 'buyer_message_empty'
  | 'buyer_message_too_long'
  // 전송본·역번역
  | 'outgoing_empty'
  | 'outgoing_too_long'
  | 'back_translation_empty'
  | 'back_translation_too_long';

/**
 * 쓸 수 없는 결과. `detail`은 `ReplyFailureDetail` 하나이거나, 초안 검증처럼 사유가 여럿일 때
 * 그 코드들을 `,`로 이은 것이다. 구매자 글·초안·프롬프트·키는 담지 않는다.
 */
export type ReplyFailure = { ok: false; reason: ReplyFailureReason; detail: string };

export type ReplyDraft =
  | {
      ok: true;
      buyerMessageEn: string;
      coaching: string[];
      draftEn: string;
      /**
       * 영어 초안에서 찾은 **정책 밖** 돈이 드는 약속 (T053, SPEC v2.7 3장).
       * 비어 있지 않으면 화면이 판매자에게 그 범주를 확인받고, 확인한 범주를
       * `TranslateInput.confirmedCommitments`로 넘긴다. `ok: true`는 그대로다 —
       * 초안 자체는 쓸 수 있고, 막는 것은 전송이다.
       */
      outsidePolicy: CommitmentCategory[];
    }
  | ReplyFailure;

export type TranslateInput = {
  draftEn: string;
  buyerLocale: FactLocale;
  facts: FactToken[];
  /** 답장의 목적. 환불이 실행 계획인지(`offer`·`refund`) 정책 밖 약속인지 가른다 (T053) */
  move: ReplyMove;
  /** 판매자가 화면에서 확인한 약속 범주. 확인한 것만 전송을 막지 않는다 (T053) */
  confirmedCommitments?: CommitmentCategory[];
  /** 토큰의 뜻 한 줄. `ReplyInput.factMeanings`와 같은 값을 넘기면 두 호출의 뜻이 같아진다 */
  factMeanings?: Record<string, string>;
};

export type ReplyTranslation =
  | {
      ok: true;
      outgoing: string;
      backTranslationEn: string;
      check: TokenCheck;
      sendable: boolean;
      /** 초안(입력 `draftEn`)에서 찾은 정책 밖 약속. 판매자가 확인하면 전송을 막지 않는다 */
      outsidePolicy: CommitmentCategory[];
      /**
       * 전송본에는 있는데 초안에는 없는 약속 범주 = 번역이 약속을 더했다.
       * 판매자가 읽은 글에 없던 약속이므로 **확인으로도 풀리지 않는다** (SPEC v2.7 3장).
       */
      addedInTranslation: CommitmentCategory[];
      /**
       * 이름 토큰 둘레의 문제 (T056). 고정 사유 코드만 담는다. 비어 있지 않으면 `sendable`이 false다.
       * `honorific_after_name`: 전송본이 `⟦BUYER_NAME_1⟧ 님`처럼 호칭을 덧붙였다 — 값에 이미 호칭이 있어
       * 채우면 "서연 님 님"이 된다. 접어서 고치지 않는다 (판매자가 다시 번역한다).
       */
      nameProblems: ReplyNameProblem[];
    }
  | ReplyFailure;

/** 이름 토큰 둘레의 문제 사유 코드 (T056). */
export type ReplyNameProblem = 'honorific_after_name';

export type ReplyDeps = { llm: LlmCaller };

// ───────────────────────────── 초안 정책 (설정에서 읽는다) ─────────────────────────────

/**
 * 답장 초안 정책 (`config/rules.json`의 `reply`. 계약은 `src/types.ts`의 `ReplyDraftPolicy`).
 * 인수 테스트 AC31이 설정 내용을 지키고, 여기서는 **모양만** 본다 (틀리면 예외 — 설정이 깨진 채로
 * 프롬프트가 나가면 모델이 날짜의 뜻을 제멋대로 고르기 때문이다. T053 배경).
 *
 * `note`·`followUpDays` 같은 다른 칸은 버린다 (`strict`가 아니다. `followUpDays`는
 * `src/engine/followup.ts`가 같은 덩어리에서 따로 읽는다).
 */
const ReplyDraftPolicySchema: z.ZodType<ReplyDraftPolicy> = z.object({
  followUpDateMeaning: z.string().trim().min(1),
  allowedCommitments: z.array(
    z.object({
      id: z.string().trim().min(1),
      text: z.string().trim().min(1),
      subtypes: z.array(z.enum(SUBTYPES)),
    }),
  ),
});

/**
 * 쓸 정책. 인자를 주면 그것을(모양 검사는 그대로 한다), 안 주면 설정을 읽는다.
 * 단위 테스트는 정책을 직접 넘겨서 설정 파일에 기대지 않는다 (지시서 1번).
 */
export function replyDraftPolicy(policy?: ReplyDraftPolicy): ReplyDraftPolicy {
  return ReplyDraftPolicySchema.parse(policy ?? (rulesConfigJson as { reply?: unknown }).reply);
}

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
 * 추천 수에서 쓸 수 있는 돈이 드는 약속 (T053, SPEC v2.7 3장 "정책 밖 약속 막기").
 *
 * `offer`·`refund`일 때의 환불은 모델이 만든 약속이 아니라 **엔진이 고른 실행 계획**이므로 약속으로
 * 세지 않는다 (금액은 자리표시자로만 쓴다. 그것은 `ALLOWED_SLOTS`가 따로 지킨다).
 * 그 밖의 범주는 지금 허용 항목이 없다 — 설정의 `allowedCommitments`에 적힌 약속은 돈이 들지 않는
 * 것들이고(AC31이 그 글에 이런 낱말이 없음을 지킨다), 그래서 이 표를 설정에서 읽지 않는다.
 */
const ALLOWED_COMMITMENTS: Readonly<Record<ReplyMove, readonly CommitmentCategory[]>> = {
  fight: [],
  offer: ['refund'],
  refund: ['refund'],
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

function failure(
  reason: ReplyFailureReason,
  detail: ReplyFailureDetail | readonly ReplyFailureDetail[],
): ReplyFailure {
  return { ok: false, reason, detail: typeof detail === 'string' ? detail : detail.join(',') };
}

/**
 * 아는 오류 이름만 사유 코드로 옮긴다 (`src/ai/llm.ts`가 던지는 클래스 이름).
 * 객체가 아니라 `Map`을 쓴다 — `error.name`은 무엇이든 될 수 있고, 객체 색인은 `toString` 같은
 * 상속 키에도 맞는다.
 */
const LLM_ERROR_DETAILS = new Map<string, ReplyFailureDetail>([
  ['LlmError', 'llm_failed:LlmError'],
  ['LlmApiError', 'llm_failed:LlmApiError'],
  ['LlmConfigError', 'llm_failed:LlmConfigError'],
  ['LlmResponseError', 'llm_failed:LlmResponseError'],
]);

/**
 * LLM 예외를 결과로 접는다. 거절은 `refused`, 그 밖은 `ai_unavailable`이다.
 * `src/ai/llm.ts`가 `name`으로 약속한 값만 본다 (분류기와 같은 이유로 SDK를 끌어오지 않는다).
 *
 * 예외 메시지도, **오류 이름도 그대로 싣지 않는다** (T050 6번): 깨진 JSON 본문이 섞여 구매자 글이
 * 되돌아와 있을 수 있고, `name`은 임의 문자열일 수 있다 (`reports/T042-verify.md` ⑤).
 * 목록에 없는 이름은 `unknown_error`다.
 */
function fromError(error: unknown): ReplyFailure {
  const name = error instanceof Error ? error.name : '';
  if (name === 'LlmRefusalError') return failure('refused', 'llm_refused');
  return failure('ai_unavailable', LLM_ERROR_DETAILS.get(name) ?? 'unknown_error');
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
function lengthProblem(
  text: string,
  max: number,
  what: 'draft' | 'buyer_message' | 'outgoing' | 'back_translation',
): ReplyFailureDetail | null {
  if (text === '') return `${what}_empty`;
  if (text.length > max) return `${what}_too_long`;
  return null;
}

/**
 * 글 한 토막에 사실값을 글자로 썼는가. `checkTokens`에 같은 글을 두 번 넣어 `literalFacts`만 본다
 * (`draftProblems`와 같은 방식 — 글자로 쓴 사실값 탐지를 여기서 다시 구현하지 않는다).
 */
function hasLiteralFacts(text: string, facts: FactToken[]): boolean {
  return checkTokens(text, text, facts).literalFacts.length > 0;
}

/**
 * 글에서 찾은 돈이 드는 약속 중 이 수에서 허용되지 않은 것 (`src/ai/commitments.ts`가 글을 본다).
 * 순서는 `COMMITMENT_CATEGORIES` 고정 순서다.
 */
function outsidePolicy(text: string, locale: FactLocale, move: ReplyMove): CommitmentCategory[] {
  const allowed = ALLOWED_COMMITMENTS[move];
  return findCommitments(text, locale).filter((category) => !allowed.includes(category));
}

// ───────────────────────────── 1. 초안 ─────────────────────────────

/**
 * 초안이 사실값 규칙을 지켰는지 코드가 본다 (지시서 1번의 "코드가 하는 검증").
 *
 * `checkTokens`를 초안과 초안 자신을 비교하는 데 쓴다 — 그러면 `missing`·`newPromises`는 늘 비고
 * `extra`에 "`facts`에 없는 토큰과 형식 오류", `literalFacts`에 "글자로 쓴 사실값"만 남는다.
 * 글자로 쓴 사실값 탐지를 여기서 다시 구현하지 않기 위한 자리다 (지시서: `tokens.ts`의 기존 함수를 쓴다).
 */
function draftProblems(draftEn: string, facts: FactToken[], move: ReplyMove): ReplyFailureDetail[] {
  const problems: ReplyFailureDetail[] = [];

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
 * `policy`를 안 주면 `config/rules.json`의 `reply`를 읽는다 (T053). 정책은 두 군데에 쓰인다:
 * 프롬프트의 `<facts>` 뜻·`<allowed_commitments>`, 그리고 초안에서 찾은 정책 밖 약속(`outsidePolicy`).
 *
 * 입력 객체는 바꾸지 않는다. 같은 입력·같은 LLM 응답이면 같은 결과다 (`Math.random`·`Date`를 읽지 않는다).
 */
export async function draftReply(
  input: ReplyInput,
  deps: ReplyDeps,
  policy?: ReplyDraftPolicy,
): Promise<ReplyDraft> {
  const draftPolicy = replyDraftPolicy(policy);
  const asked = await ask(
    deps.llm,
    { system: DRAFT_SYSTEM, user: buildDraftUser(input, draftPolicy), jsonSchema: DRAFT_OUTPUT_SCHEMA },
    DraftSchema,
  );
  if (!asked.ok) return asked;

  const draftEn = clean(asked.value.draft_en);
  const problems = draftProblems(draftEn, input.facts, input.move);
  if (problems.length > 0) return failure('invalid_output', problems);

  // 코칭 줄도 사실값 검사를 받는다 (T050 5번, `reports/T042-verify.md` ④). 코칭은 구매자에게 가지
  // 않지만 화면에 그대로 보이고, 모델은 값을 받지 않으므로 코칭에 적힌 날짜·금액은 지어낸 값이다 —
  // 판매자가 그것을 초안에 옮길 수 있다. 그 줄만 버리고(판정 자체를 버리지 않는다) 3줄이 안 되면 거부한다
  //
  // 정책 밖 약속이 적힌 줄도 같은 자리에서 버린다 (T053 3번). "Offer a refund if it is late"는
  // 판매자가 그대로 따라 쓰기 쉬운 지시이고, 그렇게 쓴 초안은 전송 전에 판매자 확인을 받아야 한다 —
  // 코칭이 그 길로 떠미는 것을 막는다 (수가 `offer`·`refund`면 환불은 실행 계획이므로 남는다)
  const coaching = asked.value.coaching
    .map((line) => oneLine(line, COACHING_LINE_MAX))
    .filter(
      (line) =>
        line !== '' &&
        !hasLiteralFacts(line, input.facts) &&
        outsidePolicy(line, 'en', input.move).length === 0,
    )
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

  // 정책 밖 약속은 초안을 거부하는 사유가 아니다 (SPEC v2.7 3장: 전송 가능으로 두지 않고 판매자가
  // 확인한다). 판매자가 초안을 고쳐 지울 수도 있으므로, 전송을 가르는 판정은 `translateReply`가 다시 한다
  return { ok: true, buyerMessageEn, coaching, draftEn, outsidePolicy: outsidePolicy(draftEn, 'en', input.move) };
}

// ───────────────────────────── 2. 전송본 + 역번역 ─────────────────────────────

/**
 * 판매자가 고친 초안을 쓸 수 있는지 **번역을 부르기 전에** 본다 (T050 3·4번, `reports/T042-verify.md` ③).
 * 쓸 수 없으면 호출 0회로 거부한다 — 쓸 수 없는 글을 돈을 들여 번역하지 않는다.
 *
 * 왜 전송본 검사(`checkTokens(draft, outgoing, …)`)로는 모자라는가: 번역 프롬프트는 "사실값을 글자로
 * 쓰지 말 것"·"가림 표식을 베끼지 말 것"을 지시하므로, **지시를 잘 따르는 모델은 판매자가 글자로 적은
 * 날짜·금액·연락처를 조용히 빼고** 번역한다. 그러면 초안·전송본을 견주는 검사는 통과해
 * (`sendable: true`) 판매자가 적은 내용이 사라진 글이 구매자에게 간다.
 *
 * `buyerLocale === 'en'`도 같은 길을 지난다 — 그 경로는 가리는 단계가 아예 없어서 판매자가 적은
 * 이메일·전화번호가 그대로 구매자에게 갔다 (SPEC 10장: 분쟁 메시지에 연락처를 넣지 않는다).
 *
 * 순서: 개인정보를 먼저 본다. 개인통관고유부호는 사실값 검사(`literalFacts`)에도 걸리므로 순서가
 * 사유 코드를 정한다 — 더 좁은 쪽(연락처·부호)을 먼저 알려 준다.
 */
function draftInputProblem(draftEn: string, facts: FactToken[]): ReplyFailureDetail | null {
  if (maskPersonal(draftEn) !== draftEn) return 'draft_has_personal_data';
  if (hasLiteralFacts(draftEn, facts)) return 'draft_has_literal_facts';
  return null;
}

/**
 * 전송을 가르는 판정 (T053). `check.ok`에 돈이 드는 약속 두 가지를 더해서 본다:
 * - 번역이 더한 약속(`addedInTranslation`)은 판매자가 읽은 글에 없던 것이므로 **확인으로도 풀리지 않는다.**
 * - 초안에 있던 정책 밖 약속(`outsidePolicy`)은 판매자가 화면에서 확인한 범주(`confirmedCommitments`)에
 *   모두 들어 있을 때만 풀린다.
 */
function sendableNow(
  check: TokenCheck,
  outside: CommitmentCategory[],
  added: CommitmentCategory[],
  confirmed: CommitmentCategory[],
  nameProblems: ReplyNameProblem[],
): boolean {
  return (
    check.ok &&
    added.length === 0 &&
    nameProblems.length === 0 &&
    outside.every((category) => confirmed.includes(category))
  );
}

/**
 * 구매자 이름 토큰에 덧붙인 호칭 (T056 4번). 구매자 이름 값에는 그 언어의 호칭이 이미 들어 있다
 * (`서연 님`). 토큰 **바로 뒤**(사이에 공백만)의 한국어 `님`·`씨`, 일본어 `様`·`さん`·`さま`·`殿`와
 * 토큰 **바로 앞**의 독일어 `Herr`·`Frau`를 잡는다. 공백 길이에 상한을 둬서 역추적이 커지지 않게 한다.
 * `님께`·`님이`처럼 조사가 붙은 꼴도 호칭이므로 뒤 경계를 두지 않는다.
 */
const HONORIFIC_AFTER_NAME = /⟦BUYER_NAME_[1-9][0-9]*⟧[ \t 　]{0,4}(?:님|씨|様|さん|さま|殿)/;
const HONORIFIC_BEFORE_NAME = /(?<![A-Za-zÄÖÜäöüß])(?:Herr|Frau)[ \t ]{1,4}⟦BUYER_NAME_[1-9][0-9]*⟧/;

/** 전송본의 이름 토큰 둘레 문제. */
function nameProblemsOf(outgoing: string): ReplyNameProblem[] {
  return HONORIFIC_AFTER_NAME.test(outgoing) || HONORIFIC_BEFORE_NAME.test(outgoing) ? ['honorific_after_name'] : [];
}

/**
 * 구매자 언어 전송본 + 역번역 + 검사. LLM 호출 2회 (번역, 역번역).
 * `buyerLocale === 'en'`이면 호출 0회로 초안을 그대로 돌려준다.
 * `policy`를 안 주면 `config/rules.json`의 `reply`를 읽는다 (프롬프트의 `<facts>` 뜻에 쓴다).
 *
 * `ok: true`는 "글을 만들었다"는 뜻이고, 보내도 되는지는 `sendable`이 정한다.
 * 토큰이 빠지거나 늘거나, 값을 글자로 썼거나, 초안에 없는 약속이 생겼거나, 정책 밖 약속이 판매자 확인을
 * 받지 않았으면 `sendable`이 false다.
 * 토큰에 값을 채우는 일은 여기서 하지 않는다 — 전송 직전 단계가 `fillTokens`로 한다.
 */
export async function translateReply(
  input: TranslateInput,
  deps: ReplyDeps,
  policy?: ReplyDraftPolicy,
): Promise<ReplyTranslation> {
  const draftPolicy = replyDraftPolicy(policy);
  const draftEn = input.draftEn.trim();
  const draftProblem = lengthProblem(draftEn, DRAFT_INPUT_MAX_CHARS, 'draft');
  if (draftProblem !== null) return failure('invalid_output', draftProblem);

  const inputProblem = draftInputProblem(draftEn, input.facts);
  if (inputProblem !== null) return failure('invalid_output', inputProblem);

  // 초안에서 찾은 정책 밖 약속. 판매자가 고친 글을 보므로 초안에서 지웠으면 여기서도 사라진다
  const outside = outsidePolicy(draftEn, 'en', input.move);
  const inDraft = findCommitments(draftEn, 'en');
  const confirmed = input.confirmedCommitments ?? [];

  if (input.buyerLocale === 'en') {
    // 영어는 번역이 없으므로 약속이 더해질 자리도 없다 (초안이 그대로 전송본이다)
    const check = checkTokens(draftEn, draftEn, input.facts);
    const nameProblems = nameProblemsOf(draftEn);
    return {
      ok: true,
      outgoing: draftEn,
      backTranslationEn: draftEn,
      check,
      sendable: sendableNow(check, outside, [], confirmed, nameProblems),
      outsidePolicy: outside,
      addedInTranslation: [],
      nameProblems,
    };
  }

  const translated = await ask(
    deps.llm,
    {
      system: TRANSLATE_SYSTEM,
      user: buildTranslateUser(
        {
          draftEn,
          buyerLocale: input.buyerLocale,
          facts: input.facts,
          factMeanings: input.factMeanings,
        },
        draftPolicy,
      ),
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
  // 전송본의 약속을 구매자 언어로 찾아서 초안에 없던 범주를 가린다 (T053 5번). `checkTokens`의
  // `newPromises`("반드시"·"보장")와는 다른 겹이다 — 저기는 말투의 확언, 여기는 돈이 드는 약속이다
  const addedInTranslation = findCommitments(outgoing, input.buyerLocale).filter(
    (category) => !inDraft.includes(category),
  );
  const nameProblems = nameProblemsOf(outgoing);
  return {
    ok: true,
    outgoing,
    backTranslationEn,
    check,
    sendable: sendableNow(check, outside, addedInTranslation, confirmed, nameProblems),
    outsidePolicy: outside,
    addedInTranslation,
    nameProblems,
  };
}
