/**
 * 서버 전용 LLM 호출 (T006, `src/types.ts` 6부 `LlmCaller`).
 *
 * 공식 SDK `@anthropic-ai/sdk`만 쓴다 (`fetch`로 직접 부르지 않는다). 요청 모양은 `claude-api`
 * 스킬 문서에 있는 것만 쓴다:
 * - 구조화 출력: `output_config.format = { type: 'json_schema', schema }`
 * - 추론 깊이: `output_config.effort` (`thinking`·`temperature`·`budget_tokens`는 보내지 않는다 — 400)
 * - 거절: `stop_reason === 'refusal'`이면 `content`를 읽지 않고 예외로 돌린다
 * - 서버 쪽 거절 대체: `fallbacks: 'default'` + 베타 헤더 `server-side-fallback-2026-07-01`
 *   (스킬 문서 권장. 배열 꼴은 `-2026-06-01`이라 섞어 쓰면 400)
 * - 오류: SDK의 타입 있는 예외 클래스로 구분한다. 429·5xx는 SDK 기본 재시도(2회)에 맡기고,
 *   그 뒤에도 실패하면 예외로 올려 분류기가 기본 유형 + `needsReview`로 내려가게 한다.
 *
 * 비밀값·개인정보 (SPEC 10장, CLAUDE.md):
 * - 키는 `.env`의 `LLM_API_KEY`에서만 읽고 어디에도 싣지 않는다 (로그·예외 메시지·보고서).
 * - 로그에는 모델·effort·`stop_reason`·토큰 수만 남긴다. 프롬프트 전문은 남기지 않는다.
 *
 * 이 파일은 네트워크로 나가지 않는 단위 테스트를 위해 SDK 클라이언트를 주입받는다
 * (`createLlmCaller(env, { client })`). 주입하지 않으면 `new Anthropic({ apiKey })`를 만든다.
 */
import Anthropic from '@anthropic-ai/sdk';

import type { LlmCaller } from '@/types';

/**
 * 기본 모델.
 *
 * ⚠ T006 지시서는 기본값을 `claude-opus-5-5`로 적었지만 그 모델 ID는 `claude-api` 스킬의 모델 표에
 * 없다 (Opus 계열 현행 ID는 `claude-opus-5`). 스킬 문서는 "표에 없는 ID를 만들어 쓰지 말 것"을
 * 분명히 하므로 문서에 있는 `claude-opus-5`를 기본값으로 둔다. `LLM_MODEL`로 바꿀 수 있다.
 * 컨트롤 타워 확인 요청: `reports/T006-impl.md`.
 */
export const DEFAULT_LLM_MODEL = 'claude-opus-5';

/** 추론 깊이 기본값. 분류는 짧은 판단이라 `low` (T006). `LLM_EFFORT`로 바꾼다. */
export const DEFAULT_LLM_EFFORT: LlmEffort = 'low';

/** 분류 응답(JSON 한 덩어리)에 넉넉한 상한. 생각 토큰까지 함께 센다. */
export const LLM_MAX_TOKENS = 1024;

/** `fallbacks: 'default'` 꼴이 요구하는 베타 헤더. 배열 꼴(`-2026-06-01`)과 섞어 쓰면 400이다. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** `output_config.effort`가 받는 값. */
export type LlmEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

const EFFORTS: readonly LlmEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** 읽는 환경 변수. 값은 사람이 `.env`에 넣는다 (AI는 읽지 않는다). */
export type LlmEnv = {
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  LLM_EFFORT?: string;
};

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type BetaMessage = Anthropic.Beta.Messages.BetaMessage;

/** 이 파일이 쓰는 SDK 클라이언트의 부분. 테스트는 가짜 클라이언트를 넣는다. */
export type LlmClient = {
  beta: { messages: { create: (params: CreateParams) => Promise<BetaMessage> } };
};

/** 주입값. `client`를 넣으면 키 없이도 돈다 (테스트). `log`에는 비밀값·프롬프트를 넘기지 않는다. */
export type LlmDeps = {
  client?: LlmClient;
  log?: (line: string) => void;
};

// ───────────────────────────── 예외 ─────────────────────────────

/** 이 파일이 던지는 모든 예외의 밑바탕. 메시지에 키·프롬프트·구매자 개인정보를 담지 않는다. */
export class LlmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LlmError';
  }
}

/** 설정 문제 (키 없음, effort 값이 틀림, 브라우저에서 호출). 호출 자체를 하지 않는다. */
export class LlmConfigError extends LlmError {
  constructor(message: string) {
    super(message);
    this.name = 'LlmConfigError';
  }
}

/**
 * 모델이 안전상 거절했다 (`stop_reason === 'refusal'`). 내용은 읽지 않는다.
 *
 * 분류기는 이 예외를 보면 다시 묻지 않고 기본 유형 + `needsReview`로 내려간다.
 * `name === 'LlmRefusalError'`가 그 약속이다 (`src/ai/classify.ts`가 이름으로 알아본다 —
 * 분류기가 SDK를 끌어오지 않게 하려고 클래스 대신 이름을 본다).
 */
export class LlmRefusalError extends LlmError {
  /** 거절 분류 (`stop_details.category`). 없으면 null. */
  readonly category: string | null;

  constructor(category: string | null) {
    super(`LLM refused the request (category: ${category ?? 'unknown'})`);
    this.name = 'LlmRefusalError';
    this.category = category;
  }
}

/** API 오류. SDK의 타입 있는 예외를 종류로 접어 둔다. */
export class LlmApiError extends LlmError {
  readonly kind: 'auth' | 'bad_request' | 'rate_limit' | 'connection' | 'api' | 'unknown';
  readonly status?: number;

  constructor(kind: LlmApiError['kind'], status: number | undefined, options?: { cause?: unknown }) {
    super(`LLM call failed (${kind}${status === undefined ? '' : ` ${status}`})`, options);
    this.name = 'LlmApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** 응답을 JSON으로 읽을 수 없었다 (텍스트 블록 없음, 깨진 JSON, 길이 초과). */
export class LlmResponseError extends LlmError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LlmResponseError';
  }
}

// ───────────────────────────── 환경 읽기 ─────────────────────────────

function readModel(env: LlmEnv): string {
  const model = env.LLM_MODEL?.trim();
  return model ? model : DEFAULT_LLM_MODEL;
}

function readEffort(env: LlmEnv): LlmEffort {
  const raw = env.LLM_EFFORT?.trim();
  if (!raw) return DEFAULT_LLM_EFFORT;
  if ((EFFORTS as readonly string[]).includes(raw)) return raw as LlmEffort;
  throw new LlmConfigError(`LLM_EFFORT must be one of ${EFFORTS.join(', ')}`);
}

/** 키가 없으면 호출하지 않고 예외. 키 값은 메시지에 싣지 않는다. */
function createClient(env: LlmEnv): LlmClient {
  const apiKey = env.LLM_API_KEY?.trim();
  if (!apiKey) throw new LlmConfigError('LLM_API_KEY is not set');
  return new Anthropic({ apiKey });
}

// ───────────────────────────── 응답 읽기 ─────────────────────────────

function refusalCategory(response: BetaMessage): string | null {
  const details = response.stop_details;
  if (details && details.type === 'refusal') return details.category ?? null;
  return null;
}

/** 텍스트 블록만 이어 붙인다. 생각 블록 등은 버린다. */
function textOf(response: BetaMessage): string {
  return response.content
    .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

// ───────────────────────────── 오류 접기 ─────────────────────────────

/** SDK 예외를 종류로 접는다. 가장 좁은 것부터 본다 (문자열 비교는 하지 않는다). */
function toLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error;
  if (error instanceof Anthropic.AuthenticationError) return new LlmApiError('auth', error.status, { cause: error });
  if (error instanceof Anthropic.BadRequestError) return new LlmApiError('bad_request', error.status, { cause: error });
  if (error instanceof Anthropic.RateLimitError) return new LlmApiError('rate_limit', error.status, { cause: error });
  if (error instanceof Anthropic.APIConnectionError) return new LlmApiError('connection', undefined, { cause: error });
  if (error instanceof Anthropic.APIError) return new LlmApiError('api', error.status, { cause: error });
  return new LlmApiError('unknown', undefined, { cause: error });
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * `LlmCaller`를 만든다. 서버에서만 쓴다.
 *
 * 만들 때는 아무것도 던지지 않는다 (설정이 틀렸어도). 모델·effort·키는 호출할 때 읽고, 틀리면
 * 그 호출이 거부된다 — 분류기가 예외를 받아 기본 유형 + `needsReview`로 내려가므로 화면이 멈추지 않는다.
 */
export function createLlmCaller(env: LlmEnv = process.env as LlmEnv, deps: LlmDeps = {}): LlmCaller {
  const log = deps.log;

  return async (req) => {
    if (typeof window !== 'undefined') {
      throw new LlmConfigError('LLM calls are server-only');
    }

    const model = readModel(env);
    const effort = readEffort(env);
    const client = deps.client ?? createClient(env);

    let response: BetaMessage;
    try {
      response = await client.beta.messages.create({
        model,
        max_tokens: LLM_MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        output_config: {
          effort,
          format: { type: 'json_schema', schema: req.jsonSchema },
        },
        // 고정 시스템 프롬프트만 캐시한다. 분쟁별 값은 user에만 있다.
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: req.user }],
      });
    } catch (error) {
      const failure = toLlmError(error);
      log?.(`llm: model=${model} effort=${effort} error=${failure.name}`);
      throw failure;
    }

    log?.(
      `llm: model=${response.model} effort=${effort} stop_reason=${response.stop_reason ?? 'null'}` +
        ` input_tokens=${response.usage.input_tokens} output_tokens=${response.usage.output_tokens}`,
    );

    // 거절이면 내용을 읽지 않는다 (스키마를 지키지 않을 수 있고, 읽을 이유도 없다).
    if (response.stop_reason === 'refusal') {
      throw new LlmRefusalError(refusalCategory(response));
    }
    if (response.stop_reason === 'max_tokens') {
      throw new LlmResponseError('LLM response hit max_tokens before finishing');
    }

    const text = textOf(response);
    if (text.trim() === '') {
      throw new LlmResponseError('LLM response had no text block');
    }

    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      // 깨진 JSON 본문은 로그·예외에 싣지 않는다 (구매자 글이 되돌아와 있을 수 있다).
      throw new LlmResponseError('LLM response was not valid JSON', { cause: error });
    }
  };
}
