/**
 * 화난 어조 판별 (T043, SPEC v2.5 3장·7장).
 *
 * 확대 위험 신호 네 개 중 **이것 하나만** LLM이 본다 (`src/types.ts`의 `EscalationSignals.angryTone`).
 * 이 함수는 "화났는가"만 답한다. 점수(+1)·구간(Low/Watch/High)·판매자 답장 뒤의 0 처리는
 * 모두 `src/engine/`이 한다 (SPEC 7장). 여기서는 어떤 수도 계산하지 않는다.
 *
 * 경계:
 * - LLM 호출 1회. 다시 묻지 않는다 — 어조는 한 번의 짧은 판단이고, 재요청은 판정 보류보다 비싸다
 *   (`src/ai/reply.ts`와 같은 방식. 재요청이 있는 쪽은 분류기뿐이다).
 * - **실패해도 예외를 던지지 않는다**: 오류·거절·스키마 위반·빈 응답이면 `{ angryTone: null, evidence: [] }`다.
 *   `null`은 "판정 보류"이고 엔진이 그 신호를 0점으로 둔다 — 화남을 지어내는 쪽으로 틀리지 않는다.
 * - 근거는 코드가 확인한다. 구매자 글에 실제로 들어 있지 않은 구절은 버린다 (모델이 지어낸 근거를
 *   화면에 내지 않는다). 확인 기준은 **모델이 본 글**(가림·각괄호 무력화를 거친 글)이다 — 모델에
 *   보여 주지 않은 글자를 되살려 온 구절도 지어낸 근거이므로 함께 버려진다.
 * - 화면에 나가는 글자는 **구매자 글에 있는 그대로**다 (맞은 자리의 원문 조각). 맞춰 볼 때만 대소문자를
 *   무시한다 — 모델이 인용하며 바꾼 대소문자는 구매자가 쓴 것이 아니므로 화면에 내지 않는다 (T050 7번).
 * - 로그를 남기지 않는다. 결과에는 근거 구절만 담고 구매자 글 전체는 담지 않는다 (SPEC 10장).
 */
import { z } from 'zod';

import {
  EMAIL_PLACEHOLDER,
  PCCC_PLACEHOLDER,
  PHONE_PLACEHOLDER,
  maskPersonal,
  maskTruncatedPccc,
  sanitizeUntrusted,
} from '@/ai/prompts/classify';
import { TONE_OUTPUT_SCHEMA, TONE_SYSTEM, buildToneUser } from '@/ai/prompts/tone';
import type { LlmCaller } from '@/types';

// ───────────────────────────── 계약 (아직 `src/types.ts`에 넣지 않는다) ─────────────────────────────

/** 구매자 글 원문 (신뢰하지 않는 입력). 여러 건이면 마지막 글이 가장 중요하다. */
export type ToneInput = { buyerMessages: string[] };

/** `angryTone: null`은 판정 보류다 (엔진이 0점으로 둔다). `evidence`는 구매자 글에서 확인된 구절뿐이다. */
export type ToneResult = { angryTone: boolean | null; evidence: string[] };

export type ToneDeps = { llm: LlmCaller };

// ───────────────────────────── 한계값 ─────────────────────────────

/** 화면에 내보내는 근거 개수 상한 (지시서: 최대 3개). 더 와도 앞에서부터 3개만 쓴다. */
export const TONE_EVIDENCE_MAX = 3;

/**
 * 근거 한 조각의 길이 상한. `src/ai/classify.ts`의 근거와 같은 120자로 둔다 — 같은 화면의 같은 배지다.
 * 길이를 넘으면 앞에서 자른다 (자른 조각도 구매자 글에서 온 것이다 — 자르기는 확인 **뒤에** 한다).
 */
export const TONE_SNIPPET_MAX = 120;

// ───────────────────────────── 검증 스키마 ─────────────────────────────

/**
 * LLM 응답. 스키마에 없는 키(점수·확률·금액 같은 숫자 판정 필드)는 zod가 버린다.
 * 두 필드 모두 필수다 — `angryTone`이 `"yes"`처럼 불리언이 아니거나 `evidence`가 없으면 판정 보류다
 * (한쪽만 지켜진 응답은 모델이 스키마를 못 지킨 응답이고, 어조 판정은 그럴 때 비워 두는 쪽이 맞다).
 */
const LlmToneSchema = z.object({
  angryTone: z.boolean(),
  evidence: z.array(z.string()),
});

// ───────────────────────────── 작은 도구 ─────────────────────────────

/** 판정 보류. 부를 때마다 새 객체를 만든다 (부른 쪽이 배열을 고쳐도 다음 결과에 번지지 않게). */
function undecided(): ToneResult {
  return { angryTone: null, evidence: [] };
}

/**
 * 비교용 꼴: 공백을 한 칸으로 줄이고 양끝을 자르고 소문자로 만든다.
 *
 * 공백을 줄이는 이유는 모델이 줄바꿈을 한 칸 공백으로 옮겨 적어도 "그대로 따온" 구절로 보기 위해서다.
 * 소문자로 만드는 이유는 영어 글에서 첫 글자 대소문자가 달라지는 일이 흔하기 때문이다.
 * 글자 자체를 바꾸거나 지우지는 않는다 — 그러면 지어낸 근거가 통과할 수 있다.
 */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * 근거를 맞춰 볼 건초더미: **모델에 보여 준 글**을 글마다 따로 다듬어 줄바꿈으로 이어 붙인다.
 * 두 벌을 만든다 — `display`는 구매자가 쓴 글자 그대로, `lower`는 맞춰 보기용 소문자다
 * (자리를 그대로 쓸 수 있게 `display`를 그 자리에서 소문자로 바꾼 것이다).
 *
 * 글마다 따로 다듬고 줄바꿈으로 잇는 이유: 다듬은 구절에는 줄바꿈이 남지 않으므로, 서로 다른 두 글의
 * 끝과 시작을 이어 붙여 만든 구절은 어디에도 들어 있지 않게 된다 (모델이 두 글을 꿰매 만든 인용은
 * 구매자가 쓴 말이 아니다).
 */
type Haystack = { display: string; lower: string };

function haystackOf(messages: string[]): Haystack {
  const display = messages.map((message) => normalizeSpace(sanitizeUntrusted(message))).join('\n');
  return { display, lower: display.toLowerCase() };
}

/** 가림 표식. 이 표식이 든 구절은 근거에서 뺀다 (아래 `verifiedEvidence`). */
const MASK_MARKERS: readonly string[] = [PCCC_PLACEHOLDER, EMAIL_PLACEHOLDER, PHONE_PLACEHOLDER];

/**
 * 화면·보고에 남길 한 조각: 개인정보 가림 + 한 줄 + 길이 제한 (SPEC 3장·10장).
 *
 * 순서는 `src/ai/classify.ts`의 근거 조각과 같다 (**가림 → 공백 정리 → 다시 가림 → 자르기 → 꼬리 가림**):
 * 공백을 줄이면 줄바꿈·탭으로 나뉘어 있던 부호가 `P 1234 5678 9012` 꼴로 드러나므로 한 번 더 가리고,
 * 길이로 자른 뒤에는 반쯤 잘린 부호 꼬리를 없앤다. 근거는 이미 가려진 글에서 따온 것이지만,
 * 모델이 가리지 않은 글자를 섞어 보냈을 때 그것이 화면까지 가지 않게 한 번 더 거친다.
 */
function snippet(text: string): string {
  const line = maskPersonal(normalizeSpace(maskPersonal(text)));
  return line.length > TONE_SNIPPET_MAX
    ? `${maskTruncatedPccc(line.slice(0, TONE_SNIPPET_MAX - 1))}…`
    : line;
}

/** 공백을 한 칸으로 줄이고 양끝을 자른다 (소문자로 만들지 않는다 — 화면에 그대로 나가는 글이다). */
function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 모델이 보낸 근거 중 **구매자 글에서 확인된 것만** 남긴다 (지시서: 지어낸 근거는 화면에 내지 않는다).
 *
 * 화면에 내보내는 글자는 **구매자 글에 있는 그대로**다 — 맞은 자리의 원문 조각을 쓰고 모델이 보낸
 * 글자는 쓰지 않는다 (T050 7번, `reports/T043-verify.md` M1). 맞춰 볼 때만 대소문자를 무시하므로,
 * 구매자가 `you are a scammer`라고 쓴 것을 모델이 `YOU ARE A SCAMMER`로 인용해도 화면에는 구매자가
 * 쓴 소문자가 나간다 (대문자는 프롬프트 스스로 화남의 신호로 꼽는 "shouting"이다 — 구매자가 쓰지
 * 않은 신호를 화면에 내지 않는다).
 *
 * 버리는 것: 빈 구절, 구매자 글에 없는 구절, 이미 쓴 구절과 같은 구절 (같은 말을 세 번 보내면 근거가
 * 한 개뿐인 것과 같다), 가림 표식이 든 구절 (`⟦PCCC⟧`·`⟦EMAIL⟧`·`⟦PHONE⟧`. 가려진 자리를 인용한
 * 것은 구매자가 쓴 말이 아니고 화면에 뜻도 없다. `reports/T043-verify.md` R2).
 * 남은 것 중 앞에서부터 `TONE_EVIDENCE_MAX`개까지만 쓴다.
 */
function verifiedEvidence(raw: string[], messages: string[]): string[] {
  const haystack = haystackOf(messages);
  // 소문자로 바꿀 때 길이가 달라지는 글자가 섞여 있으면 자리를 믿을 수 없다 (예: `İ` → 두 글자).
  // 그때는 원문 조각을 떠 오지 않고 모델이 보낸 글자를 쓴다 — 확인은 그대로 하므로 지어낸 근거는 막힌다
  const aligned = haystack.lower.length === haystack.display.length;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    if (out.length >= TONE_EVIDENCE_MAX) break;
    const key = normalize(item);
    if (key === '' || seen.has(key)) continue;
    const at = haystack.lower.indexOf(key);
    if (at === -1) continue;
    const quoted = aligned ? haystack.display.slice(at, at + key.length) : normalizeSpace(item);
    if (MASK_MARKERS.some((marker) => quoted.includes(marker))) continue;
    const line = snippet(quoted);
    if (line === '') continue;
    seen.add(key);
    out.push(line);
  }

  return out;
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * 구매자 글의 어조가 화났는지 묻는다. LLM 호출 1회 (글이 없거나 공백뿐이면 0회).
 *
 * 입력 객체는 바꾸지 않는다. 같은 입력·같은 LLM 응답이면 같은 결과다
 * (`Math.random`·`Date`를 읽지 않는다).
 */
export async function judgeTone(input: ToneInput, deps: ToneDeps): Promise<ToneResult> {
  // 공백뿐인 글은 어조가 없다. 빈 태그를 보내 모델에게 "없는 어조"를 묻는 호출을 아낀다
  const messages = input.buyerMessages.filter((message) => message.trim() !== '');
  if (messages.length === 0) return undecided();

  let raw: unknown;
  try {
    raw = await deps.llm({
      system: TONE_SYSTEM,
      user: buildToneUser({ buyerMessages: messages }),
      jsonSchema: TONE_OUTPUT_SCHEMA,
    });
  } catch {
    // 오류·거절을 가리지 않고 판정 보류다. 예외 메시지는 담지 않는다 — 깨진 JSON 본문이 섞여
    // 구매자 글이 되돌아와 있을 수 있다 (`src/ai/llm.ts`의 `LlmResponseError`)
    return undecided();
  }

  const parsed = LlmToneSchema.safeParse(raw);
  if (!parsed.success) return undecided();

  return {
    angryTone: parsed.data.angryTone,
    evidence: verifiedEvidence(parsed.data.evidence, messages),
  };
}
