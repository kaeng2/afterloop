/**
 * AI 새 상품 고칠 문구 6개 (T086, SPEC v2.12 8-3장, Scene 3).
 *
 * `draftListingFixes`는 AI를 **한 번** 불러 size·color·ship·customs·bf·ret 문구를 영어로 받는다.
 * 이 문구는 판매자가 검토해 상품 등록 입력칸에 붙여 넣는 글이다.
 *
 * 경계:
 * - 숫자를 계산하거나 쓰지 않는다. 숫자 자리는 판매자가 채울 자리표시자 `[__]`다 — 글에 숫자(0-9)가 있으면 그 칸을 거부한다.
 * - 새 약속 금지: T020 검사(`findCommitments`, `checkTokens`의 newPromises)를 재사용하고, "free returns"·
 *   "will arrive by"·"guarantee" 같은 표현을 이 파일에서 한 겹 더 막는다.
 * - 판정은 코드: 각 칸은 `config/listing-model.json`의 `rules[칸]` 정규식에 걸려야 ok다. 안 걸리면 그 칸만 `ok:false`.
 *   **기본 문구를 만들지 않는다** (T020 규칙).
 *
 * 실패 처리: 칸별로 `{ ok:false, reason: 고정 코드 }`. 응답 전체가 깨지거나 호출이 실패하면 6칸 모두 `ok:false`.
 * 예외를 던지지 않고 로그(`console.*`)를 남기지 않는다. `reason`에는 문구·프롬프트·오류 메시지를 싣지 않는다.
 * 호출 수는 1회로 고정이다. 다시 묻지 않는다.
 */
import { z } from 'zod';

import { findCommitments } from '@/ai/commitments';
import {
  LISTING_FIX_OUTPUT_SCHEMA,
  LISTING_FIX_SYSTEM,
  buildListingFixUser,
} from '@/ai/prompts/listing-fixes';
import { maskPersonal } from '@/ai/prompts/classify';
import { checkTokens } from '@/ai/tokens';
import type { ListingFixDraft, ListingFixDraftInput, ListingFixDrafts, ListingFixKey, LlmCaller } from '@/types';

import listingModelJson from '../../config/listing-model.json';

// ───────────────────────────── 한계값 ─────────────────────────────

export const LISTING_FIX_KEYS: readonly ListingFixKey[] = ['size', 'color', 'ship', 'customs', 'bf', 'ret'];
/** 칸 하나의 글자 수 상한 */
export const LISTING_FIX_MAX_CHARS = 300;
/** 칸 하나의 줄 수 상한 (비어 있지 않은 줄) */
export const LISTING_FIX_MAX_LINES = 3;

/** 칸이 실패한 이유. 고정 코드만. */
export type ListingFixReason =
  | 'ai_unavailable'
  | 'refused'
  | 'invalid_output'
  | 'empty'
  | 'too_long'
  | 'too_many_lines'
  | 'digits'
  | 'tokens'
  | 'personal_data'
  | 'commitment'
  | 'promise'
  | 'rule_mismatch';

// ───────────────────────────── 검사 (판정은 코드) ─────────────────────────────

const ResponseSchema = z.object({
  size: z.string(),
  color: z.string(),
  ship: z.string(),
  customs: z.string(),
  bf: z.string(),
  ret: z.string(),
});

/** 모든 문자 체계의 십진 숫자 (전각 포함) */
const DIGIT = /\p{Nd}/u;
const TOKEN_MARKS = /[⟦⟧]|\{\{|\}\}/;

/** T020 검사가 못 잡는 영어 약속: 도착 약속, 무료 반품, 확언 낱말 */
const EXTRA_PROMISES: readonly RegExp[] = [
  /\bwill\s+(?:arrive|be\s+delivered|be\s+there)\b/i,
  /\barrives?\s+by\b/i,
  /\bfree\s+(?:returns?|shipping|exchanges?|refunds?)\b/i,
  /\bguarantee/i,
  /\bpromise/i,
  /\b100\s*%/,
  /\bdefinitely\b/i,
  /\bmoney[-\s]back\b/i,
  /\bfull\s+refund\b/i,
];

type RuleConfig = { pattern: string; flags: string };

function ruleFor(key: ListingFixKey, rules: Record<ListingFixKey, RuleConfig>): RegExp {
  return new RegExp(rules[key].pattern, rules[key].flags);
}

function normalize(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
}

/** 칸 하나를 검사한다. 걸린 첫 이유를 돌려주고, 통과하면 null. */
export function listingFixProblem(
  key: ListingFixKey,
  text: string,
  rules: Record<ListingFixKey, RuleConfig> = listingModelJson.rules as Record<ListingFixKey, RuleConfig>,
): ListingFixReason | null {
  if (text === '') return 'empty';
  if (text.length > LISTING_FIX_MAX_CHARS) return 'too_long';
  if (text.split('\n').length > LISTING_FIX_MAX_LINES) return 'too_many_lines';
  if (DIGIT.test(text)) return 'digits';
  const solo = checkTokens('', text, []);
  if (TOKEN_MARKS.test(text) || solo.extra.length > 0 || solo.literalFacts.length > 0) return 'tokens';
  if (maskPersonal(text) !== text) return 'personal_data';
  if (solo.newPromises.length > 0 || EXTRA_PROMISES.some((re) => re.test(text))) return 'promise';
  if (findCommitments(text, 'en').length > 0) return 'commitment';
  if (!ruleFor(key, rules).test(text)) return 'rule_mismatch';
  return null;
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

function allFailed(reason: ListingFixReason): ListingFixDrafts {
  const fail: ListingFixDraft = { ok: false, reason };
  return { size: fail, color: fail, ship: fail, customs: fail, bf: fail, ret: fail };
}

/**
 * 고칠 문구 6개를 쓴다. **예외를 던지지 않고** 늘 6칸을 돌려준다. 입력 객체는 바꾸지 않는다.
 */
export async function draftListingFixes(input: ListingFixDraftInput, deps: { llm: LlmCaller }): Promise<ListingFixDrafts> {
  try {
    let raw: unknown;
    try {
      raw = await deps.llm({
        system: LISTING_FIX_SYSTEM,
        user: buildListingFixUser(input),
        jsonSchema: LISTING_FIX_OUTPUT_SCHEMA,
      });
    } catch (error) {
      return allFailed(error instanceof Error && error.name === 'LlmRefusalError' ? 'refused' : 'ai_unavailable');
    }
    const parsed = ResponseSchema.safeParse(raw);
    if (!parsed.success) return allFailed('invalid_output');

    const out = {} as ListingFixDrafts;
    for (const key of LISTING_FIX_KEYS) {
      const text = normalize(parsed.data[key]);
      const problem = listingFixProblem(key, text);
      out[key] = problem === null ? { ok: true, text } : { ok: false, reason: problem };
    }
    return out;
  } catch {
    return allFailed('ai_unavailable');
  }
}
