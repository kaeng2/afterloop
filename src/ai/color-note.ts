/**
 * AI 색상 문구: 공통 불만 찾기 + EN·KO·JA·DE 문구 + 역번역 (T020, SPEC v2.8 3장, 원문 S2·F5).
 *
 * 화면(S2)이 서버에서 부르는 함수 하나(`writeColorNote`)다. 이 함수는 PayPal·시드를 읽지 않는다 —
 * 부르는 쪽이 구매자 글만 모아서 넘긴다.
 *
 * 경계 (SPEC 3장 "생성과 판정"):
 * - 어떤 수도 계산하지 않는다. 시뮬레이션의 `color_note` 처방(B1 확률 배수)은 엔진이 **처방을 켰는지**로만
 *   계산하고, 이 함수는 엔진에 아무 값도 주지 않으며 결과에 "몇 % 줄어든다" 같은 수를 싣지 않는다.
 * - 이 문구는 상품 페이지에 올라가는 **공개 글**이다. 사실값(숫자·날짜·금액·추적번호)을 아예 쓰지 않는다 —
 *   숫자가 하나라도 있으면 거부한다. 색 이름은 사실값이 아니라 괜찮다.
 * - 판정은 코드가 한다: 숫자·토큰·개인정보·돈이 드는 약속(`findCommitments`)·확언(`checkTokens`의
 *   `newPromises`)·효과 주장·길이·문장 수. 하나라도 걸리면 AI 결과 전체를 버린다.
 *
 * 실패 처리 (컨트롤 타워 결정 3, 2026-11-10): **기본 문구를 만들지 않는다.** AI가 실패하거나 검사에
 * 걸리면 `ok: false` + 고정 사유 코드를 돌려주고, S2는 그 자리를 숨긴다 (T013 규칙 4) — 사람이 검수하지
 * 않은 4개 언어 문구를 상품 페이지 후보로 보이지 않는다.
 *
 * LLM 출력은 신뢰하지 않는 입력이다: zod로 검증하고 **예외를 던지지 않는다**. `detail`에는 구매자 글·
 * 문구·프롬프트·키·오류 메시지를 싣지 않고 `ColorNoteDetail`의 고정 코드만 쓴다 (`src/ai/reply.ts`와 같은
 * 방식). 로그(`console.*`)를 남기지 않는다.
 *
 * 호출 수는 고정이다: 구매자 글이 없으면 0회, `color_issue_found: false`이거나 문구가 검사에 걸리면 1회,
 * 그 밖에는 2회(문구·역번역). 다시 묻지 않는다 — 판매자가 화면에서 다시 누르는 것이 재요청이다.
 */
import { z } from 'zod';

import { findCommitments } from '@/ai/commitments';
import { maskPersonal } from '@/ai/prompts/classify';
import {
  BACK_TRANSLATE_OUTPUT_SCHEMA,
  BACK_TRANSLATE_SYSTEM,
  WRITE_OUTPUT_SCHEMA,
  WRITE_SYSTEM,
  buildBackTranslateUser,
  buildWriteUser,
} from '@/ai/prompts/color-note';
import { checkTokens, type FactLocale } from '@/ai/tokens';
import type { LlmCaller } from '@/types';

// ───────────────────────────── 계약 (아직 `src/types.ts`에 넣지 않는다) ─────────────────────────────

export type ColorNoteInput = {
  /** 예: 'Knit Cardigan, Oat' */
  productName: string;
  /** 구매자 글 원문 (한국어·영어 등). 신뢰하지 않는 입력. 이름·이메일·주소는 받지 않는다 */
  complaints: string[];
  /** 판매자가 쓴 상품 설명. 없으면 불만 글만으로 쓴다 (컨트롤 타워 결정 1) */
  productDescription?: string;
  /** 판매자가 확인한 사실 한 줄들 (영어). 문구가 상품에 대해 말할 수 있는 것은 여기와 설명에 있는 것뿐 (결정 2) */
  knownFacts?: string[];
};

export type ColorNoteLocale = FactLocale; // 'en' | 'ko' | 'ja' | 'de'

export const COLOR_NOTE_LOCALES: readonly ColorNoteLocale[] = ['en', 'ko', 'ja', 'de'];

export type ColorNoteText = {
  /** 상품 페이지에 넣을 문구 (1~2문장) */
  text: string;
  /** 영어 문구는 null (역번역이 필요 없다). 나머지 세 언어는 영어로 되옮긴 글 */
  backTranslationEn: string | null;
};

/** 쓸 수 없는 이유. 고정 코드만 (구매자 글·프롬프트·키·오류 메시지를 싣지 않는다). */
export type ColorNoteFailure =
  | 'no_complaints'
  | 'no_color_issue'
  | 'ai_unavailable'
  | 'refused'
  | 'invalid_output'
  | 'check_failed';

/** 검사 대상 칸. `back_*`는 역번역이다. */
export type ColorNoteField = 'finding' | `note_${ColorNoteLocale}` | `back_${Exclude<ColorNoteLocale, 'en'>}`;

/** 검사 하나의 이름. */
export type ColorNoteProblem =
  | 'empty'
  | 'too_long'
  | 'too_many_sentences'
  | 'digits'
  | 'tokens'
  | 'personal_data'
  | 'commitment'
  | 'promise'
  | 'effect_claim';

/**
 * `detail`에 쓸 수 있는 **고정 코드 전부**. 목록을 타입으로 둬서 구매자 글·문구·오류 메시지가 들어갈 길이
 * 없게 한다 (`src/ai/reply.ts`의 `ReplyFailureDetail`과 같은 이유).
 */
export type ColorNoteDetail =
  | 'no_complaints'
  | 'no_color_issue'
  | 'llm_failed:LlmError'
  | 'llm_failed:LlmApiError'
  | 'llm_failed:LlmConfigError'
  | 'llm_failed:LlmResponseError'
  | 'llm_refused'
  | 'unknown_error'
  | 'output_schema'
  | `${ColorNoteField}:${ColorNoteProblem}`;

export type ColorNote =
  | {
      ok: true;
      /** 영어 한 줄: 구매자들이 공통으로 말한 것 */
      finding: string;
      notes: Record<ColorNoteLocale, ColorNoteText>;
    }
  | {
      ok: false;
      reason: ColorNoteFailure;
      /** `ColorNoteDetail` 하나이거나, 검사 사유가 여럿이면 그 코드들을 `,`로 이은 것 */
      detail: string;
    };

export type ColorNoteDeps = { llm: LlmCaller };

// ───────────────────────────── 한계값 ─────────────────────────────

/** 문구 한 개의 글자 수 상한 (지시서: 280자 이하). */
export const NOTE_MAX_CHARS = 280;
/** 문구 한 개의 문장 수 상한 (지시서: 1~2문장). */
export const NOTE_MAX_SENTENCES = 2;
/** `finding`(영어 한 줄)의 글자 수 상한. 화면 한 줄에 들어갈 만큼. */
export const FINDING_MAX_CHARS = 200;
/** 역번역 한 개의 상한. 같은 뜻을 영어로 옮기면 길어질 수 있어 문구 상한의 두 배로 둔다. */
export const BACK_TRANSLATION_MAX_CHARS = NOTE_MAX_CHARS * 2;

// ───────────────────────────── 응답 스키마 ─────────────────────────────

/** 스키마에 없는 키(금액·확률 같은 숫자 판정 필드)는 zod가 버린다. */
const WriteSchema = z.object({
  color_issue_found: z.boolean(),
  finding: z.string(),
  notes: z.object({ en: z.string(), ko: z.string(), ja: z.string(), de: z.string() }),
});

const BackSchema = z.object({ ko: z.string(), ja: z.string(), de: z.string() });

// ───────────────────────────── 검사 (판정은 코드) ─────────────────────────────

/** 숫자: 모든 문자 체계의 십진 숫자 (반각 0-9, 전각 ０-９ 포함). */
const DIGIT = /\p{Nd}/u;

/** 토큰·자리표시자 글자. 짝이 안 맞는 반쪽도 거부한다 (`checkTokens`의 형식 오류 검사와 겹으로 둔다). */
const TOKEN_MARKS = /[⟦⟧]|\{\{|\}\}/;

/**
 * 효과 주장·분쟁 이야기 낱말 (지시서 검사 4: "분쟁이 줄어요", "반품 없음"). 색상 안내문에는 분쟁·반품·불만을
 * 꺼낼 이유가 없으므로 그 화제 낱말 자체를 막고, "줄어든다"류 효과 동사도 막는다.
 *
 * 확언("보장·반드시·100%")은 여기 두지 않는다 — `checkTokens`의 `newPromises`가 본다 (다시 구현하지 않는다).
 * 돌려 쓴 효과 주장("안심하고 고르실 수 있어요")은 낱말 목록으로 못 잡는다. 판매자가 읽는 것이 마지막 겹이다.
 *
 * `vermeiden`(피하다)·`prevent`·`예방`은 넣지 않았다 — "놀라지 않으시도록" 같은 자연스러운 안내문을
 * 막을 수 있어서다 (막는 쪽보다 판매자 확인 쪽으로 남긴다).
 */
const EFFECT_TERMS: Readonly<Record<ColorNoteLocale, readonly string[]>> = {
  en: ['dispute', 'complain', 'complaint', 'chargeback', 'return', 'fewer', 'reduce', 'no more'],
  ko: ['분쟁', '반품', '불만', '클레임', '민원', '줄어', '줄여', '줄일', '줄입'],
  ja: ['紛争', '返品', '苦情', 'クレーム', '減ら', '減り', '減少'],
  de: ['Streit', 'Reklamation', 'Beschwerde', 'Rücksend', 'Retoure', 'Rückgabe', 'reduzier', 'verringer'],
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 라틴 문자 언어는 낱말 앞에서만 맞춘다 (`reduce`는 `reduced`도 잡고, `ireduce` 같은 꼴은 없다). */
const EFFECT_PATTERNS: Readonly<Record<ColorNoteLocale, RegExp>> = Object.fromEntries(
  COLOR_NOTE_LOCALES.map((locale) => {
    const head = locale === 'en' || locale === 'de' ? '(?<![A-Za-zÄÖÜäöüß])' : '';
    return [locale, new RegExp(`${head}(?:${EFFECT_TERMS[locale].map(escapeRegExp).join('|')})`, 'i')];
  }),
) as Record<ColorNoteLocale, RegExp>;

/**
 * 문장 수. 마침표·물음표·느낌표(전각·일본어 `。` 포함) 덩어리로 자른 비어 있지 않은 토막의 수다.
 * 마침표 없이 끝나는 문장도 한 문장으로 센다.
 */
function sentenceCount(text: string): number {
  return text
    .split(/[.!?。！？]+/u)
    .map((part) => part.trim())
    .filter((part) => part !== '').length;
}

/** 한 줄로 접고 양끝을 다듬는다. 개인정보는 여기서 가리지 않는다 — 가려야 하는 글이면 거부한다. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 글 한 토막이 상품 페이지에 올라갈 수 있는지 (지시서 검사 1~5). 걸린 검사 이름을 모두 돌려준다.
 *
 * - 숫자: 하나라도 있으면 거부.
 * - 토큰: `⟦…⟧`·`{{…}}` 글자, 그리고 `checkTokens('', text, [])`의 `extra`·`literalFacts`
 *   (`facts`가 비어 있으므로 올바른 꼴의 토큰도 모두 `extra`다).
 * - 확언: 같은 호출의 `newPromises`. 빈 초안과 견주므로 글에 있는 약속 표현이 모두 "새 약속"으로 나온다.
 * - 돈이 드는 약속: `findCommitments(text, locale)`. 색상 문구에는 허용한 약속이 없다.
 * - 개인정보: `maskPersonal`을 지나 달라지면 거부.
 *
 * `locale`은 글의 언어다 (역번역·`finding`은 `'en'`).
 */
export function colorTextProblems(text: string, locale: ColorNoteLocale, maxChars: number): ColorNoteProblem[] {
  if (text === '') return ['empty'];
  const problems: ColorNoteProblem[] = [];
  if (text.length > maxChars) problems.push('too_long');
  if (sentenceCount(text) > NOTE_MAX_SENTENCES) problems.push('too_many_sentences');
  if (DIGIT.test(text)) problems.push('digits');

  const solo = checkTokens('', text, []);
  if (TOKEN_MARKS.test(text) || solo.extra.length > 0 || solo.literalFacts.length > 0) problems.push('tokens');
  if (solo.newPromises.length > 0) problems.push('promise');

  if (maskPersonal(text) !== text) problems.push('personal_data');
  if (findCommitments(text, locale).length > 0) problems.push('commitment');
  if (EFFECT_PATTERNS[locale].test(text)) problems.push('effect_claim');
  return problems;
}

/**
 * 네 문구 + `finding` 검사 (역번역 호출 전). 걸린 것이 있으면 역번역을 부르지 않는다 — 버릴 글을 돈을 들여
 * 옮기지 않는다.
 *
 * 지시서 검사 2의 `checkTokens(영어, 번역, [])`도 언어마다 부른다 (영어 = draft, 번역 = outgoing).
 * 위 단독 검사가 이미 더 넓게 보지만, 지시서가 정한 비교를 그대로 남겨 둔다.
 */
function noteProblems(finding: string, notes: Record<ColorNoteLocale, string>): ColorNoteDetail[] {
  const details: ColorNoteDetail[] = [];
  for (const problem of colorTextProblems(finding, 'en', FINDING_MAX_CHARS)) details.push(`finding:${problem}`);
  for (const locale of COLOR_NOTE_LOCALES) {
    const problems = new Set(colorTextProblems(notes[locale], locale, NOTE_MAX_CHARS));
    if (locale !== 'en' && notes[locale] !== '' && !checkTokens(notes.en, notes[locale], []).ok) {
      problems.add(TOKEN_MARKS.test(notes[locale]) ? 'tokens' : 'promise');
    }
    for (const problem of problems) details.push(`note_${locale}:${problem}`);
  }
  return details;
}

/**
 * 역번역 검사 (지시서 검사 6 + 한 겹 더). 비어 있으면 거부하고, 영어로 되옮긴 글에도 같은 검사를 영어 목록으로
 * 한다 — 한국어·일본어·독일어 문구에서 언어별 목록이 놓친 약속·효과 주장·숫자 낱말이 영어로 드러나면 잡힌다.
 */
function backProblems(back: Record<'ko' | 'ja' | 'de', string>): ColorNoteDetail[] {
  const details: ColorNoteDetail[] = [];
  for (const locale of ['ko', 'ja', 'de'] as const) {
    for (const problem of colorTextProblems(back[locale], 'en', BACK_TRANSLATION_MAX_CHARS)) {
      // 역번역은 문장 수를 따지지 않는다 — 문구 쪽에서 이미 봤고, 직역은 문장을 나눌 수 있다
      if (problem !== 'too_many_sentences') details.push(`back_${locale}:${problem}`);
    }
  }
  return details;
}

// ───────────────────────────── 작은 도구 ─────────────────────────────

type Failure = Extract<ColorNote, { ok: false }>;

function failure(reason: ColorNoteFailure, detail: ColorNoteDetail | readonly ColorNoteDetail[]): Failure {
  return { ok: false, reason, detail: typeof detail === 'string' ? detail : detail.join(',') };
}

/**
 * 아는 오류 이름만 사유 코드로 옮긴다 (`src/ai/llm.ts`가 던지는 클래스 이름). `Map`을 쓰는 이유는
 * `src/ai/reply.ts`와 같다 (`error.name`은 무엇이든 될 수 있고 객체 색인은 상속 키에도 맞는다).
 */
const LLM_ERROR_DETAILS = new Map<string, ColorNoteDetail>([
  ['LlmError', 'llm_failed:LlmError'],
  ['LlmApiError', 'llm_failed:LlmApiError'],
  ['LlmConfigError', 'llm_failed:LlmConfigError'],
  ['LlmResponseError', 'llm_failed:LlmResponseError'],
]);

/** LLM 예외를 결과로 접는다. 메시지도 오류 이름도 그대로 싣지 않는다. */
function fromError(error: unknown): Failure {
  const name = error instanceof Error ? error.name : '';
  if (name === 'LlmRefusalError') return failure('refused', 'llm_refused');
  return failure('ai_unavailable', LLM_ERROR_DETAILS.get(name) ?? 'unknown_error');
}

type Asked<T> = { ok: true; value: T } | Failure;

/** 호출 1회 + zod 검증. 다시 묻지 않는다. */
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

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * 색상 문구를 쓴다. **예외를 던지지 않고** 늘 `ColorNote`를 돌려준다.
 *
 * 입력 객체는 바꾸지 않는다. 같은 입력·같은 LLM 응답이면 같은 결과다 (`Math.random`·`Date`를 읽지 않는다).
 */
export async function writeColorNote(input: ColorNoteInput, deps: ColorNoteDeps): Promise<ColorNote> {
  try {
    return await write(input, deps);
  } catch {
    // 위의 모든 길은 예외를 결과로 접는다. 그래도 새는 것(입력이 계약과 다른 모양 등)은 여기서 막는다
    return failure('ai_unavailable', 'unknown_error');
  }
}

async function write(input: ColorNoteInput, deps: ColorNoteDeps): Promise<ColorNote> {
  const complaints = input.complaints.filter((complaint) => complaint.trim() !== '');
  if (complaints.length === 0) return failure('no_complaints', 'no_complaints');

  // 1. 문구 (호출 1회)
  const written = await ask(
    deps.llm,
    {
      system: WRITE_SYSTEM,
      user: buildWriteUser({
        productName: input.productName,
        complaints,
        productDescription: input.productDescription,
        knownFacts: input.knownFacts,
      }),
      jsonSchema: WRITE_OUTPUT_SCHEMA,
    },
    WriteSchema,
  );
  if (!written.ok) return written;
  if (!written.value.color_issue_found) return failure('no_color_issue', 'no_color_issue');

  const finding = normalize(written.value.finding);
  const notes: Record<ColorNoteLocale, string> = {
    en: normalize(written.value.notes.en),
    ko: normalize(written.value.notes.ko),
    ja: normalize(written.value.notes.ja),
    de: normalize(written.value.notes.de),
  };
  const problems = noteProblems(finding, notes);
  if (problems.length > 0) return failure('check_failed', problems);

  // 2. 역번역 (호출 1회). 한국어·일본어·독일어 문구만 준다 — 영어 문구와 `finding`은 주지 않는다
  const back = await ask(
    deps.llm,
    {
      system: BACK_TRANSLATE_SYSTEM,
      user: buildBackTranslateUser({ ko: notes.ko, ja: notes.ja, de: notes.de }),
      jsonSchema: BACK_TRANSLATE_OUTPUT_SCHEMA,
    },
    BackSchema,
  );
  if (!back.ok) return back;

  const backEn = { ko: normalize(back.value.ko), ja: normalize(back.value.ja), de: normalize(back.value.de) };
  const backIssues = backProblems(backEn);
  if (backIssues.length > 0) return failure('check_failed', backIssues);

  return {
    ok: true,
    finding,
    notes: {
      en: { text: notes.en, backTranslationEn: null },
      ko: { text: notes.ko, backTranslationEn: backEn.ko },
      ja: { text: notes.ja, backTranslationEn: backEn.ja },
      de: { text: notes.de, backTranslationEn: backEn.de },
    },
  };
}
