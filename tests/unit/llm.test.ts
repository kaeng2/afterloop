/**
 * 서버 전용 LLM 호출 단위 테스트 (T006).
 *
 * **실제 호출은 하지 않는다.** 가짜 SDK 클라이언트를 주입해 보낸 요청(모델·`output_config`·시스템 프롬프트)과
 * 거절·오류·깨진 JSON 처리를 본다. 키는 가짜 문자열이고 네트워크로 나가는 길이 없다.
 */
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LLM_MAX_RETRIES,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TIMEOUT_MS,
  LLM_MAX_TOKENS,
  LlmApiError,
  LlmConfigError,
  LlmError,
  LlmRefusalError,
  LlmResponseError,
  type LlmClient,
  type LlmClientOptions,
  type LlmEnv,
  createLlmCaller,
  readClientOptions,
} from '@/ai/llm';

type CreateParams = Parameters<LlmClient['beta']['messages']['create']>[0];
type BetaMessage = Awaited<ReturnType<LlmClient['beta']['messages']['create']>>;

/** 가짜 키. 로그에 새지 않는지 보는 표식으로도 쓴다. */
const FAKE_KEY = 'sk-ant-FAKE-DO-NOT-USE-0001';

const REQ = {
  system: 'SYSTEM-PROMPT-MARKER: classify the dispute',
  user: 'USER-PROMPT-MARKER: buyer said the color differs',
  jsonSchema: { type: 'object', properties: { subtype: { type: 'string' } } } as Record<string, unknown>,
};

/** 응답 한 개. 계약에서 쓰는 칸만 채우고 나머지는 SDK 타입으로 맞춘다. */
function reply(over: Record<string, unknown> = {}): BetaMessage {
  return {
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: '{"subtype":"B1","confidence":0.9,"evidence":["color"]}', citations: null }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 42, output_tokens: 17 },
    ...over,
  } as unknown as BetaMessage;
}

/** 가짜 SDK 클라이언트. 보낸 요청을 기록하고, 정해 둔 응답이나 예외를 돌려준다. */
function fakeClient(outcome: BetaMessage | { fail: unknown }): {
  sent: CreateParams[];
  client: LlmClient;
} {
  const sent: CreateParams[] = [];
  const client: LlmClient = {
    beta: {
      messages: {
        create: async (params) => {
          sent.push(params);
          if (outcome !== null && typeof outcome === 'object' && 'fail' in outcome) throw outcome.fail;
          return outcome;
        },
      },
    },
  };
  return { sent, client };
}

function env(over: Partial<LlmEnv> = {}): LlmEnv {
  return { LLM_API_KEY: FAKE_KEY, ...over };
}

describe('보낸 요청', () => {
  it('기본 모델·effort·max_tokens와 구조화 출력', async () => {
    const { sent, client } = fakeClient(reply());
    await createLlmCaller(env(), { client })(REQ);

    expect(sent).toHaveLength(1);
    const params = sent[0];
    expect(params.model).toBe(DEFAULT_LLM_MODEL);
    expect(params.max_tokens).toBe(LLM_MAX_TOKENS);
    expect(params.output_config).toEqual({
      effort: 'low',
      format: { type: 'json_schema', schema: REQ.jsonSchema },
    });
    expect(params.output_config?.format?.schema).toBe(REQ.jsonSchema);
  });

  it('거절 대체를 서버 쪽에 맡긴다 (fallbacks: default + 베타 헤더)', async () => {
    const { sent, client } = fakeClient(reply());
    await createLlmCaller(env(), { client })(REQ);

    expect(sent[0].fallbacks).toBe('default');
    expect(sent[0].betas).toEqual(['server-side-fallback-2026-07-01']);
  });

  it('시스템 프롬프트는 system에, 분쟁별 값은 user에 넣고 시스템 쪽을 캐시한다', async () => {
    const { sent, client } = fakeClient(reply());
    await createLlmCaller(env(), { client })(REQ);

    expect(sent[0].system).toEqual([
      { type: 'text', text: REQ.system, cache_control: { type: 'ephemeral' } },
    ]);
    expect(sent[0].messages).toEqual([{ role: 'user', content: REQ.user }]);
  });

  it('thinking·temperature·budget_tokens는 보내지 않는다 (이 모델에서 400)', async () => {
    const { sent, client } = fakeClient(reply());
    await createLlmCaller(env(), { client })(REQ);

    expect(sent[0]).not.toHaveProperty('thinking');
    expect(sent[0]).not.toHaveProperty('temperature');
    expect(sent[0]).not.toHaveProperty('top_p');
    expect(sent[0]).not.toHaveProperty('top_k');
    expect(sent[0]).not.toHaveProperty('budget_tokens');
  });

  it('LLM_MODEL·LLM_EFFORT로 바꿀 수 있다', async () => {
    const { sent, client } = fakeClient(reply());
    await createLlmCaller(env({ LLM_MODEL: 'claude-sonnet-5', LLM_EFFORT: 'high' }), { client })(REQ);

    expect(sent[0].model).toBe('claude-sonnet-5');
    expect(sent[0].output_config?.effort).toBe('high');
  });

  it('LLM_EFFORT 값이 틀리면 호출하지 않고 예외', async () => {
    const { sent, client } = fakeClient(reply());
    const call = createLlmCaller(env({ LLM_EFFORT: 'turbo' }), { client });

    await expect(call(REQ)).rejects.toBeInstanceOf(LlmConfigError);
    expect(sent).toHaveLength(0);
  });
});

describe('키', () => {
  it('키가 없으면 호출하지 않고 "LLM_API_KEY is not set"', async () => {
    const call = createLlmCaller({});

    await expect(call(REQ)).rejects.toThrowError('LLM_API_KEY is not set');
    await expect(call(REQ)).rejects.toBeInstanceOf(LlmConfigError);
  });

  it('만들 때는 아무것도 던지지 않는다 (설정이 비어 있어도)', () => {
    expect(() => createLlmCaller({})).not.toThrow();
  });

  it('키 값은 예외 메시지에 싣지 않는다', async () => {
    const { client } = fakeClient({ fail: new Anthropic.AuthenticationError(401, {}, 'bad key', new Headers()) });

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect(String(error)).not.toContain(FAKE_KEY);
  });
});

describe('응답 읽기', () => {
  it('텍스트 블록을 JSON으로 읽어 그대로 돌려준다 (검증은 분류기가 한다)', async () => {
    const { client } = fakeClient(reply());
    const value = await createLlmCaller(env(), { client })(REQ);

    expect(value).toEqual({ subtype: 'B1', confidence: 0.9, evidence: ['color'] });
  });

  it('거절이면 내용을 읽지 않고 예외', async () => {
    const { client } = fakeClient(
      reply({
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: 'no' },
        content: [{ type: 'text', text: 'REFUSAL-BODY-MARKER', citations: null }],
      }),
    );

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmRefusalError);
    expect((error as LlmRefusalError).name).toBe('LlmRefusalError');
    expect((error as LlmRefusalError).category).toBe('cyber');
    expect(String(error)).not.toContain('REFUSAL-BODY-MARKER');
  });

  it('거절 분류가 없으면 null로 남긴다', async () => {
    const { client } = fakeClient(reply({ stop_reason: 'refusal', stop_details: null }));

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect((error as LlmRefusalError).category).toBeNull();
  });

  it('깨진 JSON이면 예외 (본문을 메시지에 싣지 않는다)', async () => {
    const { client } = fakeClient(
      reply({ content: [{ type: 'text', text: '{"subtype":"B1" BROKEN-JSON-MARKER', citations: null }] }),
    );

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmResponseError);
    expect(String(error)).not.toContain('BROKEN-JSON-MARKER');
  });

  it('텍스트 블록이 없으면 예외', async () => {
    const { client } = fakeClient(reply({ content: [] }));

    await expect(createLlmCaller(env(), { client })(REQ)).rejects.toBeInstanceOf(LlmResponseError);
  });

  it('길이 초과(max_tokens)면 예외', async () => {
    const { client } = fakeClient(reply({ stop_reason: 'max_tokens' }));

    await expect(createLlmCaller(env(), { client })(REQ)).rejects.toBeInstanceOf(LlmResponseError);
  });
});

describe('오류 구분 (SDK 타입 있는 예외)', () => {
  it.each([
    ['rate_limit', 429, new Anthropic.RateLimitError(429, {}, 'slow down', new Headers())],
    ['bad_request', 400, new Anthropic.BadRequestError(400, {}, 'bad', new Headers())],
    ['auth', 401, new Anthropic.AuthenticationError(401, {}, 'bad key', new Headers())],
    ['api', 503, new Anthropic.APIError(503, {}, 'overloaded', new Headers())],
  ])('%s', async (kind, status, thrown) => {
    const { client } = fakeClient({ fail: thrown });

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmApiError);
    expect((error as LlmApiError).kind).toBe(kind);
    expect((error as LlmApiError).status).toBe(status);
  });

  it('연결 오류', async () => {
    const { client } = fakeClient({ fail: new Anthropic.APIConnectionError({ message: 'socket closed' }) });

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect((error as LlmApiError).kind).toBe('connection');
  });

  it('SDK 예외가 아니면 unknown', async () => {
    const { client } = fakeClient({ fail: 'just a string' });

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect((error as LlmApiError).kind).toBe('unknown');
  });
});

describe('로그', () => {
  it('모델·effort·stop_reason·토큰 수만 남기고 키·프롬프트는 남기지 않는다', async () => {
    const lines: string[] = [];
    const { client } = fakeClient(reply());
    await createLlmCaller(env(), { client, log: (line) => lines.push(line) })(REQ);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('model=claude-opus-5');
    expect(lines[0]).toContain('effort=low');
    expect(lines[0]).toContain('stop_reason=end_turn');
    expect(lines[0]).toContain('input_tokens=42');
    expect(lines[0]).toContain('output_tokens=17');
    expect(lines[0]).not.toContain(FAKE_KEY);
    expect(lines[0]).not.toContain('SYSTEM-PROMPT-MARKER');
    expect(lines[0]).not.toContain('USER-PROMPT-MARKER');
  });

  it('오류일 때도 키·프롬프트를 남기지 않는다', async () => {
    const lines: string[] = [];
    const { client } = fakeClient({ fail: new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()) });
    await createLlmCaller(env(), { client, log: (line) => lines.push(line) })(REQ).catch(() => undefined);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('error=LlmApiError');
    expect(lines.join('\n')).not.toContain(FAKE_KEY);
    expect(lines.join('\n')).not.toContain('SYSTEM-PROMPT-MARKER');
    expect(lines.join('\n')).not.toContain('USER-PROMPT-MARKER');
  });

  it('로그 한 줄도 개인정보 가림을 거친다 (줄을 늘려도 부호가 남지 않게)', async () => {
    const lines: string[] = [];
    const { client } = fakeClient(reply({ model: 'claude-opus-5-5 P123456789012' }));
    await createLlmCaller(env(), { client, log: (line) => lines.push(line) })(REQ);

    expect(lines[0]).toContain('⟦PCCC⟧');
    expect(lines[0]).not.toContain('P123456789012');
  });
});

// ───────────────────────────── T032 ─────────────────────────────

describe('T032: 기본 모델', () => {
  it('기본 모델 ID는 claude-opus-5-5 (날짜 접미사 없음)', async () => {
    expect(DEFAULT_LLM_MODEL).toBe('claude-opus-5-5');
    expect(DEFAULT_LLM_MODEL).not.toMatch(/-20[0-9]{6}$/);

    const { sent, client } = fakeClient(reply());
    await createLlmCaller(env(), { client })(REQ);
    expect(sent[0].model).toBe('claude-opus-5-5');
  });

  it('LLM_MODEL로 덮어쓸 수 있다', async () => {
    const { sent, client } = fakeClient(reply());
    await createLlmCaller(env({ LLM_MODEL: 'claude-opus-5' }), { client })(REQ);

    expect(sent[0].model).toBe('claude-opus-5');
  });
});

describe('T032: 제한 시간·재시도 옵션', () => {
  /** 클라이언트를 만들 때 들어가는 옵션을 받아 둔다 (실제 SDK 클라이언트를 만들지 않는다). */
  function capturing(): { seen: (LlmClientOptions & { apiKey: string })[]; deps: Parameters<typeof createLlmCaller>[1] } {
    const seen: (LlmClientOptions & { apiKey: string })[] = [];
    const { client } = fakeClient(reply());
    return {
      seen,
      deps: {
        createClient: (options) => {
          seen.push(options);
          return client;
        },
      },
    };
  }

  it('기본값: timeout 20000ms, maxRetries 1', () => {
    expect(DEFAULT_LLM_TIMEOUT_MS).toBe(20_000);
    expect(DEFAULT_LLM_MAX_RETRIES).toBe(1);
    expect(readClientOptions({})).toEqual({ timeout: 20_000, maxRetries: 1 });
  });

  it('클라이언트를 만들 때 키와 함께 들어간다', async () => {
    const { seen, deps } = capturing();
    await createLlmCaller(env(), deps)(REQ);

    expect(seen).toHaveLength(1);
    expect(seen[0].timeout).toBe(20_000);
    expect(seen[0].maxRetries).toBe(1);
    expect(seen[0].apiKey).toBe(FAKE_KEY);
  });

  it('환경 변수로 바뀐다', async () => {
    expect(readClientOptions({ LLM_TIMEOUT_MS: '5000', LLM_MAX_RETRIES: '0' })).toEqual({
      timeout: 5000,
      maxRetries: 0,
    });

    const { seen, deps } = capturing();
    await createLlmCaller(env({ LLM_TIMEOUT_MS: ' 7500 ', LLM_MAX_RETRIES: '3' }), deps)(REQ);
    expect(seen[0]).toMatchObject({ timeout: 7500, maxRetries: 3 });
  });

  it.each([
    ['LLM_TIMEOUT_MS 음수', { LLM_TIMEOUT_MS: '-1' }],
    ['LLM_TIMEOUT_MS 숫자 아님', { LLM_TIMEOUT_MS: 'soon' }],
    ['LLM_TIMEOUT_MS 소수', { LLM_TIMEOUT_MS: '20.5' }],
    ['LLM_TIMEOUT_MS 0', { LLM_TIMEOUT_MS: '0' }],
    ['LLM_MAX_RETRIES 음수', { LLM_MAX_RETRIES: '-2' }],
    ['LLM_MAX_RETRIES 숫자 아님', { LLM_MAX_RETRIES: 'many' }],
  ])('잘못된 값은 설정 오류 — %s', async (_name, over) => {
    expect(() => readClientOptions(over)).toThrow(LlmConfigError);

    const { sent, client } = fakeClient(reply());
    const call = createLlmCaller(env(over), { client });
    await expect(call(REQ)).rejects.toBeInstanceOf(LlmConfigError);
    expect(sent).toHaveLength(0);
  });

  it('설정 오류 문구에 키를 싣지 않는다', async () => {
    const { client } = fakeClient(reply());
    const error = await createLlmCaller(env({ LLM_TIMEOUT_MS: 'soon' }), { client })(REQ).catch((e: unknown) => e);

    expect(String(error)).not.toContain(FAKE_KEY);
  });
});

describe('T032: 오류 종류와 다시 묻기', () => {
  it.each([
    ['permission', 403, new Anthropic.PermissionDeniedError(403, {}, 'forbidden', new Headers()), false],
    ['server', 500, new Anthropic.InternalServerError(500, {}, 'boom', new Headers()), true],
    ['timeout', 408, new Anthropic.RequestTimeoutError(408, {}, 'too slow', new Headers()), true],
    ['auth', 401, new Anthropic.AuthenticationError(401, {}, 'bad key', new Headers()), false],
    ['bad_request', 400, new Anthropic.BadRequestError(400, {}, 'bad', new Headers()), false],
    ['rate_limit', 429, new Anthropic.RateLimitError(429, {}, 'slow down', new Headers()), true],
  ])('%s (%i) → retryable %s', async (kind, status, thrown, retryable) => {
    const { client } = fakeClient({ fail: thrown });

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LlmApiError);
    expect((error as LlmApiError).kind).toBe(kind);
    expect((error as LlmApiError).status).toBe(status);
    expect((error as LlmApiError).retryable).toBe(retryable);
  });

  it('제한 시간(연결 시간 초과)은 timeout이고 다시 물을 수 있다', async () => {
    const { client } = fakeClient({ fail: new Anthropic.APIConnectionTimeoutError({ message: 'timed out' }) });

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect((error as LlmApiError).kind).toBe('timeout');
    expect((error as LlmApiError).retryable).toBe(true);
  });

  it('설정 오류·거절은 다시 묻지 않고, 응답을 읽지 못한 것은 다시 묻는다', () => {
    expect(new LlmConfigError('LLM_API_KEY is not set').retryable).toBe(false);
    expect(new LlmRefusalError('cyber').retryable).toBe(false);
    expect(new LlmResponseError('LLM response was not valid JSON').retryable).toBe(true);
    expect(new LlmError('something else').retryable).toBe(true);
  });

  it('종류를 알 수 없는 예외도 다시 물을 수 있다', async () => {
    const { client } = fakeClient({ fail: 'just a string' });

    const error = await createLlmCaller(env(), { client })(REQ).catch((e: unknown) => e);
    expect((error as LlmApiError).kind).toBe('unknown');
    expect((error as LlmApiError).retryable).toBe(true);
  });
});
