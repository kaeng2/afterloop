/**
 * 원인 분류: 규칙 먼저, 나머지는 LLM (T006, SPEC v2.2 4장).
 *
 * 규칙으로 정할 수 있는 건 코드가 정하고(LLM 호출 0회), 나머지만 LLM이 16개 세부 유형 중 하나를 고른다.
 * **실패해도 예외를 던지지 않는다**: 거절·오류·스키마 위반이면 사유별 기본 유형에 `confidence: 0`,
 * `needsReview: true`, `evidence: ['classifier_unavailable']`을 붙여 돌려준다 (`src/types.ts` `ClassifyFn`).
 *
 * 경계:
 * - 숫자 판정(기대 손실·확률·금액·제안 비율)은 하지 않는다. LLM이 그런 키를 보내와도 zod가 버린다.
 * - 기준값은 `config/rules.json`에서 읽는다 (`abuse.minPriorInrDisputes`, `classification.minConfidence`).
 * - 개인정보: 구매자 메시지·택배사 이벤트는 LLM에 보내기 전에 개인통관고유부호를 가린다
 *   (`src/ai/prompts/classify.ts`의 `maskPersonal`. 이메일·전화번호도 함께 가린다 — T032).
 *   LLM이 돌려준 근거·설명도 같은 가림을 한 번 더 거친다 (SPEC 3장·10장).
 * - LLM 출력은 신뢰하지 않는 입력이다. zod로 검증하고, 길이와 개수를 깎는다.
 */
import { z } from 'zod';

import {
  CLASSIFY_OUTPUT_SCHEMA,
  CLASSIFY_SYSTEM,
  buildClassifyUser,
  maskPersonal,
  maskTruncatedPccc,
} from '@/ai/prompts/classify';
import { SUBTYPES, rulesFromConfig } from '@/engine/params';
import type { Cause, ClassifyFn, ClassifyInput, LlmCaller, PolicyConfig, Subtype } from '@/types';

// ───────────────────────────── 사유 코드 ─────────────────────────────

/** 미수령 (INR). */
const INR = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
/** 상품 불일치 (SNAD). */
const SNAD = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';
/** 도용 결제. */
const UNAUTHORISED = 'UNAUTHORISED';

/**
 * LLM이 답을 못 줬을 때 쓰는 사유별 기본 유형 (T006).
 * `UNAUTHORISED`는 규칙 1번이 먼저 잡지만, 규칙을 건너뛴 경로를 위해 함께 적어 둔다.
 */
const DEFAULT_SUBTYPE_BY_REASON: Readonly<Record<string, Subtype>> = {
  [INR]: 'A2',
  [SNAD]: 'B3',
  CREDIT_NOT_PROCESSED: 'C1',
  DUPLICATE_TRANSACTION: 'C2',
  INCORRECT_AMOUNT: 'C3',
  CANCELED_RECURRING_BILLING: 'D1',
  [UNAUTHORISED]: 'E1',
};

/** 표에 없는 사유 코드일 때. 어차피 `needsReview`가 켜져 판매자가 고친다. */
const UNKNOWN_REASON_SUBTYPE: Subtype = 'B3';

/** 통관 보류 판정에 쓰는 말 (대소문자 무시). */
const CUSTOMS_HOLD = 'customs hold';

/** LLM이 답을 못 줬다는 표시 (화면 배지용). */
const UNAVAILABLE_EVIDENCE = 'classifier_unavailable';

/** 스키마 위반·오류일 때 다시 묻는 횟수를 더한 총 호출 상한 (T006: "1회만 다시 요청"). */
const MAX_ATTEMPTS = 2;

/** 근거 한 조각의 길이 상한. LLM이 길게 써 보내도 화면 배지에 들어갈 만큼만 남긴다. */
const SNIPPET_MAX = 120;

/** `causeNote`의 길이 상한. 화면 배지에 들어가는 한 줄 요약이다 (T032). */
const CAUSE_NOTE_MAX = 80;

/** 근거 개수 상한. */
const EVIDENCE_MAX = 5;

// ───────────────────────────── 검증 스키마 ─────────────────────────────

/**
 * 이 파일이 읽는 기준값만 본다 (`config/rules.json` 전체를 넘겨도 되고, 테스트가 이 두 가지만
 * 담은 객체를 넘겨도 된다). zod는 모르는 키를 버리므로 `PolicyConfig` 전체가 그대로 통과한다.
 */
const ClassifyRulesSchema = z.object({
  abuse: z.object({ minPriorInrDisputes: z.number().int().nonnegative() }),
  classification: z.object({ minConfidence: z.number().min(0).max(1) }),
});

/**
 * LLM 응답. 스키마에 없는 키(금액·확률·손실 같은 숫자 판정 필드)는 zod가 버린다.
 * 여기서 걸리면 한 번 다시 묻고, 또 걸리면 기본 유형으로 내려간다.
 */
const LlmCauseSchema = z.object({
  subtype: z.enum(SUBTYPES),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  cause: z.string().optional(),
});

// ───────────────────────────── 작은 도구 ─────────────────────────────

/** 공백을 한 칸으로 줄이고 양끝을 자른다. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 화면·보고에 남길 한 조각: 개인정보 가림 + 한 줄 + 길이 제한 (SPEC 3장·10장).
 *
 * 순서가 중요하다 (T032 재시도): **가림 → 공백 정리 → 다시 가림 → 자르기 → 꼬리 가림.**
 * 공백을 줄이면 줄바꿈·탭·겹공백으로 나뉘어 있던 부호가 `P 1234 5678 9012` 꼴로 드러나므로
 * 공백 정리 뒤에 한 번 더 가리고, 길이로 자른 뒤에도 반쯤 잘린 부호 꼬리를 한 번 더 없앤다.
 */
function clip(text: string, max: number): string {
  const line = maskPersonal(oneLine(maskPersonal(text)));
  return line.length > max ? `${maskTruncatedPccc(line.slice(0, max - 1))}…` : line;
}

/** 근거 한 조각 (120자). */
function snippet(text: string): string {
  return clip(text, SNIPPET_MAX);
}

/** `causeNote` 한 줄 요약 (80자). 추적 이벤트 한 줄 전체가 그대로 가지 않게 깎는다 (T032). */
function causeNoteOf(text: string): string {
  return clip(text, CAUSE_NOTE_MAX);
}

/** 사유 코드 비교용 꼴 (앞뒤 공백·대소문자 차이를 없앤다). */
function normalizeReason(reason: string): string {
  return reason.trim().toUpperCase();
}

/**
 * 거절이면 다시 묻지 않는다 (같은 프롬프트를 또 보내도 같은 거절이다).
 * `src/ai/llm.ts`의 `LlmRefusalError`가 `name`으로 약속한 값만 본다 — 분류기가 SDK를 끌어오지 않게.
 */
function isRefusal(error: unknown): boolean {
  return error instanceof Error && error.name === 'LlmRefusalError';
}

/**
 * 다시 물을 값이 있는 오류인가 (T032).
 *
 * 다시 묻지 않는 것: 거절, 그리고 `src/ai/llm.ts`가 `retryable: false`로 표시한 오류
 * (설정 오류 = 키 없음·값 틀림, 인증 401, 권한 403, 잘못된 요청 400). 같은 요청을 또 보내도
 * 같은 결과이고, 키가 없을 때는 네트워크로 나가지도 않는다.
 *
 * 다시 묻는 것: 스키마 위반·깨진 JSON·`max_tokens` 잘림·일시적 오류(429, 5xx, 연결 오류, 제한 시간).
 * 종류를 알 수 없는 예외도 일시적인 쪽으로 본다 (`retryable`이 없으면 다시 묻는다).
 * 클래스가 아니라 속성으로 보는 이유는 분류기가 SDK를 끌어오지 않게 하기 위해서다.
 */
function canRetry(error: unknown): boolean {
  if (isRefusal(error)) return false;
  if (typeof error !== 'object' || error === null) return true;
  return (error as { retryable?: unknown }).retryable !== false;
}

// ───────────────────────────── 규칙 (LLM 호출 0회) ─────────────────────────────

/**
 * 규칙으로 정할 수 있으면 `Cause`, 아니면 null. 순서대로 첫 번째가 이긴다 (SPEC 4장).
 * 규칙으로 정한 원인은 `source: 'rule'`, `confidence: 1`이므로 `needsReview`는 늘 false다.
 */
function byRule(input: ClassifyInput, minPriorInrDisputes: number): Cause | null {
  const reason = normalizeReason(input.reason);

  // 1. 도용 결제 주장은 사유 코드만으로 정해진다.
  if (reason === UNAUTHORISED) {
    return rule('E1', [`reason:${UNAUTHORISED}`]);
  }

  // 2. 같은 구매자의 이전 미수령 분쟁이 기준 이상 + 배송 완료 기록 → 반복 주장 (검토 M5).
  if (reason === INR && input.buyerPriorInrDisputes >= minPriorInrDisputes && input.hasDeliveredTracking) {
    return rule('F1', [
      `reason:${INR}`,
      `prior_inr_disputes:${input.buyerPriorInrDisputes}`,
      'delivered_tracking',
    ]);
  }

  // 3. 추적번호가 없는 미수령 주장 → 미발송.
  if (reason === INR && !input.hasTracking) {
    return rule('A1', [`reason:${INR}`, 'no_tracking']);
  }

  // 4. 추적 이벤트에 통관 보류 → 통관 지연. `causeNote`에 그 이벤트를 한 줄로 남긴다.
  const held = input.trackingEvents.find((event) => event.toLowerCase().includes(CUSTOMS_HOLD));
  if (held !== undefined) {
    return rule('A2', ['tracking_event:customs_hold'], causeNoteOf(held));
  }

  return null;
}

function rule(subtype: Subtype, evidence: string[], causeNote?: string): Cause {
  return {
    subtype,
    confidence: 1,
    evidence,
    needsReview: false,
    source: 'rule',
    ...(causeNote === undefined ? {} : { causeNote }),
  };
}

// ───────────────────────────── LLM 경로 ─────────────────────────────

/** 사유별 기본 유형 + `needsReview`. LLM이 끝내 답을 못 줬을 때 (예외 대신 이것을 돌려준다). */
function unavailable(input: ClassifyInput): Cause {
  const reason = normalizeReason(input.reason);
  return {
    subtype: DEFAULT_SUBTYPE_BY_REASON[reason] ?? UNKNOWN_REASON_SUBTYPE,
    confidence: 0,
    evidence: [UNAVAILABLE_EVIDENCE],
    needsReview: true,
    source: 'llm',
  };
}

/** 검증을 통과한 LLM 응답을 `Cause`로 옮긴다. 숫자 판정은 하지 않고 옮기기만 한다. */
function fromLlm(parsed: z.infer<typeof LlmCauseSchema>, minConfidence: number): Cause {
  const evidence = parsed.evidence
    .map(snippet)
    .filter((line) => line !== '')
    .slice(0, EVIDENCE_MAX);
  const causeNote = parsed.cause === undefined ? '' : causeNoteOf(parsed.cause);

  return {
    subtype: parsed.subtype,
    confidence: parsed.confidence,
    evidence,
    needsReview: parsed.confidence < minConfidence,
    source: 'llm',
    ...(causeNote === '' ? {} : { causeNote }),
  };
}

/**
 * LLM에 묻는다. 스키마 위반이나 일시적 오류면 한 번만 다시 묻고, 그래도 안 되면 null
 * (부른 쪽이 기본 유형으로 내려간다). 거절·설정 오류·인증·권한·잘못된 요청은 다시 묻지 않는다
 * (`canRetry`, T032).
 */
async function askLlm(input: ClassifyInput, llm: LlmCaller, minConfidence: number): Promise<Cause | null> {
  const req = {
    system: CLASSIFY_SYSTEM,
    user: buildClassifyUser(input),
    jsonSchema: CLASSIFY_OUTPUT_SCHEMA,
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let raw: unknown;
    try {
      raw = await llm(req);
    } catch (error) {
      if (!canRetry(error)) return null;
      continue;
    }

    const parsed = LlmCauseSchema.safeParse(raw);
    if (parsed.success) return fromLlm(parsed.data, minConfidence);
  }

  return null;
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * 분쟁 1건의 원인을 정한다. 규칙으로 정해지면 LLM을 부르지 않는다.
 * 입력 객체는 바꾸지 않는다. 같은 입력·같은 LLM 응답이면 같은 결과다.
 */
export const classifyDispute: ClassifyFn = async (
  input: ClassifyInput,
  deps: { llm: LlmCaller },
  rules?: PolicyConfig,
): Promise<Cause> => {
  const { abuse, classification } = ClassifyRulesSchema.parse(rules ?? rulesFromConfig());

  const ruled = byRule(input, abuse.minPriorInrDisputes);
  if (ruled !== null) return ruled;

  const asked = await askLlm(input, deps.llm, classification.minConfidence);
  return asked ?? unavailable(input);
};
