/**
 * T070 공개 데모 모드 — AI 캐시 · 읽기 · 상태 확인 · 배포 파일 (가짜 호출기만).
 *
 * 기대값 출처: `tasks/T070.md` "만들 것" 2(읽기)·3·4, 완료 기준 4~7.
 *
 * **실제 호출 없음.** PayPal은 `fetch`를 바꿔 끼운 가짜, LLM은 받은 요청을 세는 가짜다. `.env`를 읽지 않는다.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply } from '@/ai/reply';
import { demoLinks } from '@/app/_shared/demo-links';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import type { Cause, ClientDeps, LlmCaller } from '@/types';

vi.mock('server-only', () => ({}));

const {
  AI_RATE_LIMITED,
  DEFAULT_AI_LIVE_LIMIT_PER_HOUR,
  cachedLlm,
  createRateLimiter,
  emptyLlmCache,
  llmCacheKey,
  parseLlmCache,
  resolveLiveLimit,
  serializeLlmCache,
  startCacheRecording,
  stopCacheRecording,
} = await import('@/app/_server/llm-cache');
const { getLlm } = await import('@/app/_server/llm');
const { getPayPalClient } = await import('@/app/_server/paypal');
const { loadDemoDisputes } = await import('@/app/_server/disputes');
const { healthBody } = await import('@/app/_server/health');
const { buildAiCache } = await import('../../scripts/ai-cache/build-lib');

const ROOT = path.resolve(__dirname, '../..');
const DETAIL_FIXTURE = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/dispute-detail.inquiry-waiting-seller.json'), 'utf8'));

type LlmRequest = Parameters<LlmCaller>[0];

const DRAFT = 'Hello ⟦BUYER_NAME_1⟧, sorry for the wait. I will check with the carrier and get back to you by ⟦DATE_1⟧.\n\n⟦SELLER_NAME_1⟧';
const OUTGOING = '안녕하세요 ⟦BUYER_NAME_1⟧, 기다리게 해서 죄송해요. ⟦DATE_1⟧까지 운송사에 확인해서 다시 연락드릴게요.\n\n⟦SELLER_NAME_1⟧';
const BACK = 'Hello ⟦BUYER_NAME_1⟧, sorry for the wait. I will contact you again by ⟦DATE_1⟧.\n\n⟦SELLER_NAME_1⟧';

/** 요청을 세는 가짜 LLM. 출력 꼴(jsonSchema의 칸 이름)을 보고 그 꼴의 답을 낸다. */
function countingLlm() {
  const calls: LlmRequest[] = [];
  const llm: LlmCaller = async (req) => {
    calls.push(req);
    const props = Object.keys((req.jsonSchema.properties ?? {}) as Record<string, unknown>);
    // `draftReply`는 코칭 3~5줄(COACHING_MIN)과 칩(T069)을 요구한다 — 계약을 지키는 답을 낸다
    if (props.includes('draft_en'))
      return {
        buyer_message_en: 'It has not arrived.',
        coaching: ['Say sorry first.', 'Name the next check-in date.', 'Keep it short and calm.'],
        chips: ['Warmer', 'Shorter', 'More formal'],
        draft_en: DRAFT,
      };
    if (props.includes('outgoing')) return { outgoing: OUTGOING };
    if (props.includes('back_translation_en')) return { back_translation_en: BACK };
    if (props.includes('angryTone')) return { angryTone: false, evidence: [] };
    // 분류 (고정 글 = 색·크기 차이): B1
    return { subtype: 'B1', confidence: 0.9, evidence: ['Color and size differ from listing'] };
  };
  return { llm, calls };
}

const REQ = (n: number): LlmRequest => ({ system: `system ${n}`, user: `user ${n}`, jsonSchema: { type: 'object', properties: { n: { type: 'number' } } } });

afterEach(() => {
  stopCacheRecording();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ── 키 ────────────────────────────────────────────────────────────────

describe('T070 3: 캐시 키', () => {
  it('sha256(system \\0 user \\0 JSON(jsonSchema)) — 64자 16진, 같은 요청 같은 키, 한 글자만 달라도 다른 키', () => {
    const key = llmCacheKey(REQ(1));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(llmCacheKey(REQ(1))).toBe(key);
    expect(llmCacheKey({ ...REQ(1), user: 'user 1 ' })).not.toBe(key);
    expect(llmCacheKey({ ...REQ(1), jsonSchema: {} })).not.toBe(key);
    // 칸 경계가 섞이지 않는다 ("ab"+"c" ≠ "a"+"bc")
    expect(llmCacheKey({ system: 'ab', user: 'c', jsonSchema: {} })).not.toBe(llmCacheKey({ system: 'a', user: 'bc', jsonSchema: {} }));
  });

  it('같은 분쟁, 다른 now → 초안·번역·역번역 요청 키가 같다 (프롬프트에 날짜·이름 값이 없다)', async () => {
    const cause: Cause = { subtype: 'A2', confidence: 1, evidence: [], needsReview: false, source: 'rule', causeNote: 'Customs hold' };
    const due = '2026-12-20T00:00:00Z';
    const keysAt = async (now: string) => {
      const { llm, calls } = countingLlm();
      const facts = caseReplyFacts({ now, dueDate: due, buyerId: 'B01', buyerLocale: 'ko' });
      const draft = await draftReply({ buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause, move: 'fight', facts: facts.draft }, { llm });
      expect(draft.ok).toBe(true);
      const translation = await translateReply({ draftEn: DRAFT, buyerLocale: 'ko', facts: facts.outgoing, move: 'fight' }, { llm });
      expect(translation.ok).toBe(true);
      expect(calls).toHaveLength(3);
      // 날짜 값이 프롬프트에 없다
      for (const fact of [...facts.draft, ...facts.outgoing]) {
        for (const call of calls) expect(`${call.system}\n${call.user}`).not.toContain(fact.value);
      }
      return calls.map(llmCacheKey);
    };
    const first = await keysAt('2026-11-11T03:00:00Z');
    const second = await keysAt('2026-11-14T15:30:00Z');
    expect(second).toEqual(first);
  });
});

// ── 캐시 호출기 ───────────────────────────────────────────────────────

describe('T070 3: 캐시 호출기', () => {
  it('적중이면 실제 호출 0 (public·recording 모두, 한도 0이어도)', async () => {
    const cache = emptyLlmCache();
    cache.entries[llmCacheKey(REQ(1))] = { response: { cached: true }, createdAt: '2026-11-11T00:00:00Z' };
    for (const mode of ['public', 'recording'] as const) {
      const { llm, calls } = countingLlm();
      const caller = cachedLlm(llm, { cache, mode, limiter: createRateLimiter(0) });
      expect(await caller(REQ(1))).toEqual({ cached: true });
      expect(calls).toHaveLength(0);
    }
  });

  it('public: 없으면 시간당 N회까지만 실제로 부르고, 그 뒤는 "AI unavailable" 꼴(예외). 받은 응답은 기억한다', async () => {
    let clock = 0;
    const limiter = createRateLimiter(3, () => clock);
    const { llm, calls } = countingLlm();
    const caller = cachedLlm(llm, { cache: emptyLlmCache(), mode: 'public', limiter });
    for (let i = 1; i <= 3; i += 1) await caller(REQ(i));
    expect(calls).toHaveLength(3);
    await expect(caller(REQ(4))).rejects.toThrow(AI_RATE_LIMITED);
    expect(calls).toHaveLength(3);
    // 이미 받은 것은 한도와 무관하게 기억에서
    await caller(REQ(2));
    expect(calls).toHaveLength(3);
    // 한 시간이 지나면 다시 하나
    clock += 3_600_000;
    await caller(REQ(4));
    expect(calls).toHaveLength(4);
  });

  it('recording: 한도가 0이어도 제한 없음 (캐시는 쓴다)', async () => {
    const { llm, calls } = countingLlm();
    const caller = cachedLlm(llm, { cache: emptyLlmCache(), mode: 'recording', limiter: createRateLimiter(0) });
    for (let i = 1; i <= 30; i += 1) await caller(REQ(i));
    await caller(REQ(1));
    expect(calls).toHaveLength(30);
  });

  it('실패한 응답은 기억하지 않는다', async () => {
    let fail = true;
    let n = 0;
    const flaky: LlmCaller = async () => {
      n += 1;
      if (fail) throw new Error('boom');
      return { ok: 1 };
    };
    const caller = cachedLlm(flaky, { cache: emptyLlmCache(), mode: 'recording', limiter: createRateLimiter(0) });
    await expect(caller(REQ(1))).rejects.toThrow();
    fail = false;
    expect(await caller(REQ(1))).toEqual({ ok: 1 });
    expect(n).toBe(2);
  });

  it('AI_LIVE_LIMIT_PER_HOUR: 0 이상의 정수만, 그 밖은 기본 20', () => {
    expect(DEFAULT_AI_LIVE_LIMIT_PER_HOUR).toBe(20);
    expect(resolveLiveLimit({})).toBe(20);
    for (const bad of ['', ' ', 'abc', '-1', '1.5', '1e3', 'NaN', '20x']) expect(resolveLiveLimit({ AI_LIVE_LIMIT_PER_HOUR: bad }), bad).toBe(20);
    expect(resolveLiveLimit({ AI_LIVE_LIMIT_PER_HOUR: '0' })).toBe(0);
    expect(resolveLiveLimit({ AI_LIVE_LIMIT_PER_HOUR: ' 5 ' })).toBe(5);
  });

  it('캐시 파일: 키·응답·만든 시각만. 꼴이 틀리면 빈 캐시', () => {
    const cache = emptyLlmCache();
    cache.entries[llmCacheKey(REQ(2))] = { response: { a: 1 }, createdAt: '2026-11-11T00:00:00Z' };
    cache.entries[llmCacheKey(REQ(1))] = { response: { b: 2 }, createdAt: '2026-11-11T00:00:00Z' };
    const text = serializeLlmCache(cache);
    expect(parseLlmCache(text)).toEqual(cache);
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed)).toEqual(['version', 'entries']);
    for (const entry of Object.values(parsed.entries) as Record<string, unknown>[]) expect(Object.keys(entry)).toEqual(['response', 'createdAt']);
    for (const broken of ['', '{', '[]', '{"version":1}', '{"version":99,"entries":{}}', '{"version":1,"entries":{"not-a-key":{"response":1,"createdAt":"x"}}}']) {
      expect(parseLlmCache(broken), broken).toEqual(emptyLlmCache());
    }
  });

  it('getLlm: 키가 없으면 지금처럼 not_configured, 기록 중에는 기록 호출기', async () => {
    expect(getLlm({})).toEqual({ ok: false, reason: 'not_configured' });
    const { llm, calls } = countingLlm();
    const session = startCacheRecording(llm);
    const resolved = getLlm({});
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    await resolved.llm(REQ(1));
    await resolved.llm(REQ(1));
    expect(calls).toHaveLength(1);
    expect(Object.keys(session.cache.entries)).toEqual([llmCacheKey(REQ(1))]);
    stopCacheRecording();
    expect(getLlm({}).ok).toBe(false);
  });

  it('getLlm(키 있음)은 호출 전에는 아무것도 부르지 않는다 (캐시 감싼 호출기를 돌려준다)', () => {
    const resolved = getLlm({ LLM_API_KEY: 'test-key-not-real' });
    expect(resolved.ok).toBe(true);
  });
});

// ── PayPal 가짜 (fetch) ──────────────────────────────────────────────

const FAKE_PAYPAL = {
  PAYPAL_CLIENT_ID: 'test-client-id',
  PAYPAL_CLIENT_SECRET: 'test-client-secret',
  PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
};
const ALL_IDS = demoLinks.map((link) => link.paypalDisputeId);
const HIDDEN = demoLinks.filter((link) => !link.showOnScreen).map((link) => link.paypalDisputeId);
const SHOWN = demoLinks.filter((link) => link.showOnScreen).map((link) => link.paypalDisputeId);

function fakePayPalFetch() {
  const seen: { method: string; path: string }[] = [];
  const fetchFake = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    seen.push({ method, path: url.pathname });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v1/oauth2/token') return json(200, { access_token: 'fake-token', expires_in: 32400, token_type: 'Bearer' });
    if (method === 'GET' && url.pathname === '/v1/customer/disputes') {
      return json(200, { items: ALL_IDS.map((id) => ({ ...DETAIL_FIXTURE, dispute_id: id })), links: [] });
    }
    const dispute = url.pathname.match(/^\/v1\/customer\/disputes\/([^/]+)$/);
    if (method === 'GET' && dispute !== null) return json(200, { ...DETAIL_FIXTURE, dispute_id: decodeURIComponent(dispute[1]) });
    if (method === 'GET' && url.pathname.startsWith('/v2/checkout/orders/')) return json(200, { purchase_units: [] });
    return json(200, { id: 'fake' });
  }) as typeof fetch;
  const writes = () => seen.filter((s) => s.method !== 'GET' && s.path !== '/v1/oauth2/token');
  return { fetchFake, seen, writes };
}
const fakeDeps = (fetchFake: typeof fetch): ClientDeps => ({ fetch: fetchFake, now: () => Date.now(), sleep: async () => {} });

describe('T070 2: public에서도 읽기(GET)는 실제 샌드박스로, 연습용(HEY)·옛 서연(GAH)은 숨김', () => {
  it('목록·상세 GET이 나가고, 숨김 분쟁은 상세도 읽지 않고 결과에도 없다. 쓰기 0회', async () => {
    expect(HIDDEN.some((id) => id.includes('HEY'))).toBe(true);
    expect(HIDDEN.some((id) => id.includes('GAH'))).toBe(true);
    const paypal = fakePayPalFetch();
    const resolved = getPayPalClient({ ...FAKE_PAYPAL }, fakeDeps(paypal.fetchFake)); // DEMO_MODE 없음 = public
    if (!resolved.ok) throw new Error('client');
    const { llm } = countingLlm();
    const result = await loadDemoDisputes({ client: resolved.client, llm, links: demoLinks, now: '2026-11-11T03:00:00Z' });

    expect(result.paypal.ok).toBe(true);
    expect(result.disputes.map((d) => d.disputeId)).toEqual(SHOWN);
    const gets = paypal.seen.filter((s) => s.method === 'GET').map((s) => s.path);
    expect(gets).toContain('/v1/customer/disputes');
    for (const id of SHOWN) expect(gets).toContain(`/v1/customer/disputes/${id}`);
    for (const id of HIDDEN) {
      expect(gets.some((p) => p.endsWith(id)), id).toBe(false);
      expect(JSON.stringify(result)).not.toContain(id);
    }
    expect(paypal.writes()).toHaveLength(0);
  });
});

// ── 캐시 만들기 스크립트 (가짜 LlmCaller만) ─────────────────────────────

describe('T070 3: scripts/ai-cache/build — 앱과 같은 서버 함수로 기록', () => {
  beforeEach(() => {
    for (const key of ['DEMO_MODE', 'LLM_API_KEY', 'AFTERLOOP_REAL_SEND', 'AFTERLOOP_FIXED_DRAFT']) vi.stubEnv(key, undefined);
    for (const [key, value] of Object.entries(FAKE_PAYPAL)) vi.stubEnv(key, value);
  });

  it('서연·지호·Mike 상세의 초안·번역·역번역 + 분류·어조를 기록한다. PayPal 쓰기 0회, 다시 돌리면 적중만 (호출 0)', async () => {
    const paypal = fakePayPalFetch();
    vi.stubGlobal('fetch', paypal.fetchFake);
    const { llm, calls } = countingLlm();

    const built = await buildAiCache({ inner: llm });
    expect(built.paypal.ok).toBe(true);
    expect(built.cases.map((c) => c.disputeId)).toEqual(SHOWN);
    const keys = Object.keys(built.cache.entries);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).toMatch(/^[0-9a-f]{64}$/);
    // 같은 키는 한 번만 불렀다
    expect(built.calls).toBe(keys.length);
    expect(calls).toHaveLength(keys.length);
    expect(new Set(calls.map(llmCacheKey)).size).toBe(calls.length);
    // 초안·번역·역번역이 들어 있다 (꼴로 본다)
    const kinds = calls.map((c) => Object.keys((c.jsonSchema.properties ?? {}) as Record<string, unknown>).join(','));
    expect(kinds.some((k) => k.includes('draft_en'))).toBe(true);
    expect(built.cases.some((c) => c.draft)).toBe(true);
    // 전송본까지 간 분쟁이 있으면 번역·역번역 요청도 기록돼 있다
    if (built.cases.some((c) => c.reply)) {
      expect(kinds.some((k) => k === 'outgoing')).toBe(true);
      expect(kinds.some((k) => k === 'back_translation_en')).toBe(true);
    }
    // 파일 꼴: 키·응답·시각만 (env 값·헤더 없음)
    const text = serializeLlmCache(built.cache);
    for (const value of Object.values(FAKE_PAYPAL)) expect(text).not.toContain(value);
    expect(text).not.toMatch(/authorization|bearer|fake-token/i);
    expect(paypal.writes()).toHaveLength(0);

    // 그 캐시로 다시: 화면 경로의 모든 요청이 적중 → 실제 호출 0
    const again = countingLlm();
    const fromCache = cachedLlm(again.llm, { cache: built.cache, mode: 'public', limiter: createRateLimiter(0) });
    const rebuilt = await buildAiCache({ inner: fromCache });
    expect(again.calls).toHaveLength(0);
    expect(Object.keys(rebuilt.cache.entries).sort()).toEqual([...keys].sort());
  });

  it('진입점은 import만으로 돌지 않고, 응답·env 값을 찍지 않는다 (출력은 건수·번호·사유 코드)', () => {
    const code = readFileSync(path.join(ROOT, 'scripts/ai-cache/build.ts'), 'utf8');
    expect(code).toMatch(/path\.basename\(process\.argv\[1\]\) === path\.basename\(__filename\)/);
    expect(code).toMatch(/--conditions=react-server/);
    expect(code).not.toMatch(/console\.(log|error)\([^)]*(response|LLM_API_KEY\}|process\.env\.[A-Z_]+\s*[,)])/);
  });
});

// ── 상태 확인 ─────────────────────────────────────────────────────────

describe('T070 4: /api/health', () => {
  it('{ ok, mode }만 (커밋은 16진일 때 앞 7자리). env 값·비밀값을 내지 않는다', () => {
    const secretish = {
      ...FAKE_PAYPAL,
      LLM_API_KEY: 'test-llm-key-not-real',
      AFTERLOOP_REAL_SEND: '1',
      AI_LIVE_LIMIT_PER_HOUR: '7',
    };
    expect(healthBody(secretish)).toEqual({ ok: true, mode: 'public' });
    expect(healthBody({ ...secretish, DEMO_MODE: 'recording' })).toEqual({ ok: true, mode: 'recording' });
    expect(healthBody({ RENDER_GIT_COMMIT: '0de5541abcdef0123456789abcdef0123456789a' })).toEqual({ ok: true, mode: 'public', commit: '0de5541' });
    expect(healthBody({ RENDER_GIT_COMMIT: 'not-a-commit; secret' })).toEqual({ ok: true, mode: 'public' });
    const text = JSON.stringify(healthBody({ ...secretish, RENDER_GIT_COMMIT: 'abcdef1' }));
    for (const value of Object.values(secretish)) {
      if (value.length > 1) expect(text).not.toContain(value);
    }
  });

  it('라우트는 healthBody만 돌려주고 PayPal·AI를 부르지 않는다', () => {
    const route = readFileSync(path.join(ROOT, 'src/app/api/health/route.ts'), 'utf8');
    expect(route).toMatch(/export function GET\(\)/);
    expect(route).toMatch(/healthBody\(\)/);
    expect(route).not.toMatch(/getPayPalClient|getLlm|loadDemoDisputes|fetch\(/);
    const server = readFileSync(path.join(ROOT, 'src/app/_server/health.ts'), 'utf8');
    expect(server).not.toMatch(/getPayPalClient|getLlm|fetch\(/);
  });
});

// ── 배포 파일 정적 검사 ─────────────────────────────────────────────────

/** 비밀값처럼 보이는 글자: 40자 넘는 영숫자 덩어리, `sk-`, PayPal 키 꼴(`A`/`E`로 시작하는 긴 덩어리, 특히 `AY`·`EL`). */
function secretLike(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/[A-Za-z0-9_-]{41,}/g)) found.push(m[0]);
  for (const m of text.matchAll(/\bsk-[A-Za-z0-9_-]+/g)) found.push(m[0]);
  for (const m of text.matchAll(/\b(?:AY|AZ|AV|AU|EL|EM|EN|EP)[A-Za-z0-9_-]{20,}/g)) found.push(m[0]);
  return found;
}

describe('T070 4: render.yaml · reports/deploy.md에 비밀값이 없다', () => {
  const renderYaml = readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
  const deployMd = readFileSync(path.join(ROOT, 'reports/deploy.md'), 'utf8');

  it('비밀값 꼴 글자가 없다', () => {
    expect(secretLike(renderYaml)).toEqual([]);
    expect(secretLike(deployMd)).toEqual([]);
    // 검사 자체가 잡는지 (가짜 꼴)
    expect(secretLike(`x ${'A'.repeat(2)}${'b'.repeat(45)} sk-abc`).length).toBeGreaterThan(0);
  });

  it('render.yaml: 웹 서비스 1개, 빌드·시작·상태 확인 경로·Node 22, 비밀 이름은 sync: false (값 없음), DEMO_MODE 기본 public', () => {
    expect(renderYaml).toMatch(/type:\s*web/);
    expect(renderYaml).toMatch(/runtime:\s*node/);
    expect(renderYaml).toMatch(/buildCommand:\s*npm ci && npm run build/);
    expect(renderYaml).toMatch(/startCommand:\s*npm run start -- -p \$PORT/);
    expect(renderYaml).toMatch(/healthCheckPath:\s*\/api\/health/);
    const nvmrc = readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim();
    expect(renderYaml).toMatch(new RegExp(`key:\\s*NODE_VERSION\\s*\\n\\s*value:\\s*"?${nvmrc}"?`));
    expect(renderYaml).toMatch(/key:\s*DEMO_MODE\s*\n\s*value:\s*public/);
    for (const name of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'LLM_API_KEY']) {
      expect(renderYaml, name).toMatch(new RegExp(`key:\\s*${name}\\s*\\n\\s*sync:\\s*false`));
    }
    // 녹화용 스위치는 공개 배포 설정에 넣지 않는다
    for (const name of ['AFTERLOOP_REAL_SEND', 'AFTERLOOP_TRACK_LIVE', 'AFTERLOOP_TRACK_LIVE_ORDERS', 'AFTERLOOP_TRACK_RECORDING']) {
      expect(renderYaml, name).not.toContain(name);
    }
  });

  it('deploy.md: 이름 목록·순서·녹화 날·되돌리기·캐시 명령이 있다', () => {
    for (const name of [
      'PAYPAL_CLIENT_ID',
      'PAYPAL_CLIENT_SECRET',
      'PAYPAL_BASE_URL',
      'LLM_API_KEY',
      'DEMO_MODE',
      'AI_LIVE_LIMIT_PER_HOUR',
      'AFTERLOOP_REAL_SEND',
      'AFTERLOOP_TRACK_LIVE',
      'AFTERLOOP_TRACK_LIVE_ORDERS',
      'AFTERLOOP_TRACK_RECORDING',
    ]) {
      expect(deployMd, name).toContain(name);
    }
    expect(deployMd).toContain('npx tsx --env-file=.env scripts/ai-cache/build.ts');
    expect(deployMd).toContain('/api/health');
  });

  it('캐시 파일 자리가 있다 (파일 자체는 컨트롤 타워가 만든다)', () => {
    expect(existsSync(path.join(ROOT, 'data/ai-cache/README.md'))).toBe(true);
  });
});
