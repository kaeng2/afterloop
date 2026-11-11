/**
 * T084 속도 개선 ②: 프로세스당 클라이언트 하나 + 요청 사이 읽기 캐시(90초) + 병렬 + 로딩 표시.
 *
 * 실제 PayPal·AI 호출 0회 (가짜 fetch·가짜 LlmCaller). 개발 서버 없음. 시계는 가짜다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { listActivity, resetActivityForTest } from '@/app/_server/activity';
import { loadDemoDisputes } from '@/app/_server/disputes';
import { cachedLlm, createRateLimiter, emptyLlmCache } from '@/app/_server/llm-cache';
import { createSharedPayPal, SIMULATED_WRITE, type PayPalEnvVars } from '@/app/_server/paypal';
import { createReadCache, invalidatorFor, isCachedReadPath, READ_CACHE_TTL_MS } from '@/app/_server/read-cache';
import { registerTrackingFromScreen } from '@/app/_server/tracking-register';
import { copyTables } from '@/app/_shared/copy';
import { demoLinks } from '@/app/_shared/demo-links';
import type { ClientDeps, DemoLink, LlmCaller, PayPalClient } from '@/types';

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

// ── 가짜 PayPal (fetch 수준) ────────────────────────────────────────────────

const SECRET = 'test-secret-T084-XYZ';
const TOKEN = 'fake-access-token-T084-ABC';
const ENV_PUBLIC: PayPalEnvVars = {
  PAYPAL_CLIENT_ID: 'test-client-id',
  PAYPAL_CLIENT_SECRET: SECRET,
  PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
};
const ENV_RECORDING: PayPalEnvVars = { ...ENV_PUBLIC, DEMO_MODE: 'recording' };

type Seen = { method: string; path: string; headers: Record<string, string> };

function fakeFetch() {
  const seen: Seen[] = [];
  const fetchFake = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    seen.push({ method, path: url.pathname, headers: { ...((init?.headers ?? {}) as Record<string, string>) } });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v1/oauth2/token') return json(200, { access_token: TOKEN, expires_in: 32400, token_type: 'Bearer' });
    if (method === 'GET' && url.pathname === '/v1/customer/disputes') return json(200, { items: [], links: [] });
    const dispute = url.pathname.match(/^\/v1\/customer\/disputes\/([^/]+)$/);
    if (method === 'GET' && dispute !== null) return json(200, { dispute_id: decodeURIComponent(dispute[1]), messages: [] });
    const order = url.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)$/);
    if (method === 'GET' && order !== null) return json(200, { id: decodeURIComponent(order[1]), status: 'COMPLETED', purchase_units: [] });
    if (method === 'GET') return json(200, { transaction_details: [] });
    return json(201, { ok: true });
  }) as typeof fetch;
  return {
    fetchFake,
    seen,
    tokens: () => seen.filter((s) => s.path === '/v1/oauth2/token').length,
    reads: () => seen.filter((s) => s.method === 'GET'),
    writes: () => seen.filter((s) => s.method !== 'GET' && s.path !== '/v1/oauth2/token'),
  };
}

function setup(env: PayPalEnvVars, start = 1_000_000) {
  let clock = start;
  const now = () => clock;
  const paypal = fakeFetch();
  const deps: ClientDeps = { fetch: paypal.fetchFake, now, sleep: async () => {} };
  const cache = createReadCache({ now });
  const makeDeps = vi.fn(() => deps);
  const shared = createSharedPayPal({ env: () => env, deps: makeDeps, cache });
  return { paypal, cache, shared, makeDeps, advance: (ms: number) => (clock += ms) };
}

const okClient = (r: ReturnType<ReturnType<typeof createSharedPayPal>['client']>): PayPalClient => {
  if (!r.ok) throw new Error(`client unavailable: ${r.reason}`);
  return r.client;
};

const D1 = demoLinks.find((l) => l.seedDisputeId === 'D1')?.paypalDisputeId ?? 'PP-R-MBJ-10197650';

beforeEach(() => resetActivityForTest());

// ── 1. 클라이언트 하나 ──────────────────────────────────────────────────────

describe('T084 1: 프로세스당 클라이언트 하나 — 토큰 재사용', () => {
  it('요청 두 번(각각 새로 꺼냄)에 토큰 발급 1회', async () => {
    const { paypal, shared, makeDeps } = setup(ENV_PUBLIC);
    // 요청 1
    await okClient(shared.client()).get(`/v1/customer/disputes/${D1}`);
    // 요청 2 (캐시를 보지 않는 입구라 실제 GET이 한 번 더 나간다 — 토큰은 다시 받지 않는다)
    await okClient(shared.client()).get(`/v1/customer/disputes/${D1}`);
    await okClient(shared.reader()).get('/v1/reporting/transactions?x=1');
    expect(paypal.tokens()).toBe(1);
    expect(paypal.reads()).toHaveLength(3);
    expect(makeDeps).toHaveBeenCalledTimes(1); // 바탕 클라이언트를 한 번만 만들었다
  });

  it('모드가 바뀌면 새로 만든다 (열쇠에 비밀값 없음 — 모드·주소·채움 여부만)', async () => {
    let env: PayPalEnvVars = ENV_PUBLIC;
    const paypal = fakeFetch();
    const deps: ClientDeps = { fetch: paypal.fetchFake, now: () => 0, sleep: async () => {} };
    const makeDeps = vi.fn(() => deps);
    const shared = createSharedPayPal({ env: () => env, deps: makeDeps, cache: createReadCache({ now: () => 0 }) });
    const first = okClient(shared.client());
    expect(okClient(shared.client())).toBe(first);
    env = ENV_RECORDING;
    expect(okClient(shared.client())).not.toBe(first);
    expect(makeDeps).toHaveBeenCalledTimes(2);
    // 비밀값만 바뀌어도 같은 클라이언트를 쓴다 = 열쇠에 비밀값이 들어가지 않았다
    const recording = okClient(shared.client());
    env = { ...ENV_RECORDING, PAYPAL_CLIENT_SECRET: 'another-secret' };
    expect(okClient(shared.client())).toBe(recording);
    const source = read('src/app/_server/paypal.ts');
    const keyFn = source.match(/function sharedKeyOf[\s\S]*?\n}/)?.[0] ?? '';
    expect(keyFn).not.toMatch(/PAYPAL_CLIENT_SECRET|clientSecret|PAYPAL_CLIENT_ID|clientId/);
  });

  it('설정이 없으면 쓸 수 없음 (붙잡아 두지 않는다)', () => {
    const { shared } = setup({});
    expect(shared.client()).toEqual({ ok: false, reason: 'not_configured' });
    expect(shared.reader()).toEqual({ ok: false, reason: 'not_configured' });
  });
});

// ── 2. 읽기 캐시 ─────────────────────────────────────────────────────────────

describe('T084 2: 요청 사이 읽기 캐시 (90초, 가짜 시계)', () => {
  it('90초 안 같은 조회 → 실제 호출 1회, 90초 뒤 → 다시 호출', async () => {
    const { paypal, shared, advance } = setup(ENV_PUBLIC);
    const detail = `/v1/customer/disputes/${D1}`;
    const first = await okClient(shared.reader()).get(detail);
    advance(READ_CACHE_TTL_MS - 1);
    const second = await okClient(shared.reader()).get(detail);
    expect(second).toEqual(first);
    expect(paypal.reads().filter((s) => s.path === detail)).toHaveLength(1);
    advance(1);
    await okClient(shared.reader()).get(detail);
    expect(paypal.reads().filter((s) => s.path === detail)).toHaveLength(2);
    expect(READ_CACHE_TTL_MS).toBe(90_000);
  });

  it('분쟁 목록·상세·주문 조회만 담는다 (거래 조회는 담지 않는다)', () => {
    expect(isCachedReadPath('/v1/customer/disputes')).toBe(true);
    expect(isCachedReadPath('/v1/customer/disputes?page_size=50')).toBe(true);
    expect(isCachedReadPath(`/v1/customer/disputes/${D1}`)).toBe(true);
    expect(isCachedReadPath('/v2/checkout/orders/5O190127TN364715T')).toBe(true);
    expect(isCachedReadPath('/v2/checkout/orders/5O190127TN364715T/track')).toBe(false);
    expect(isCachedReadPath('/v1/reporting/transactions?start_date=x')).toBe(false);
    expect(isCachedReadPath('/v1/oauth2/token')).toBe(false);
  });

  it('쓰기 성공 뒤 → 그 분쟁 상세·목록은 다시 호출 (recording), 다른 분쟁·주문은 캐시 그대로', async () => {
    const { paypal, shared } = setup(ENV_RECORDING);
    const reader = okClient(shared.reader());
    const other = '/v1/customer/disputes/PP-R-OTHER-1';
    const order = '/v2/checkout/orders/ORDER1';
    for (const p of ['/v1/customer/disputes?page_size=50', `/v1/customer/disputes/${D1}`, other, order]) await reader.get(p);
    expect(paypal.reads()).toHaveLength(4);

    const res = await okClient(shared.client()).call({
      method: 'POST',
      path: `/v1/customer/disputes/${D1}/send-message`,
      body: { message: 'x' },
      requestId: 'r-1',
    });
    expect(res.status).toBe(201);
    expect(paypal.writes()).toHaveLength(1);

    for (const p of ['/v1/customer/disputes?page_size=50', `/v1/customer/disputes/${D1}`, other, order]) await reader.get(p);
    // 목록·D1 상세만 다시 읽었다
    expect(paypal.reads().map((s) => s.path).slice(4)).toEqual(['/v1/customer/disputes', `/v1/customer/disputes/${D1}`]);
  });

  it('추적 등록 뒤 → 그 주문 조회는 다시 호출', async () => {
    const { paypal, shared } = setup(ENV_RECORDING);
    const reader = okClient(shared.reader());
    await reader.get('/v2/checkout/orders/ORDER1');
    await reader.get('/v2/checkout/orders/ORDER2');
    await reader.call({ method: 'POST', path: '/v2/checkout/orders/ORDER1/track', body: {}, requestId: 'r-2' });
    await reader.get('/v2/checkout/orders/ORDER1');
    await reader.get('/v2/checkout/orders/ORDER2');
    expect(paypal.reads().map((s) => s.path)).toEqual([
      '/v2/checkout/orders/ORDER1',
      '/v2/checkout/orders/ORDER2',
      '/v2/checkout/orders/ORDER1',
    ]);
  });

  it('모르는 쓰기 경로는 전부 지운다 · 실패한 응답(4xx)은 담지 않는다', async () => {
    expect(invalidatorFor('/v1/something/else')('/v2/checkout/orders/X')).toBe(true);
    let n = 0;
    const flaky: PayPalClient = {
      get: async () => ({ status: n++ === 0 ? 404 : 200, body: {} }),
      call: async () => ({ status: 200, body: {} }),
    };
    const cache = createReadCache({ now: () => 0 });
    const client = cache.wrap(flaky);
    await client.get('/v2/checkout/orders/X');
    await client.get('/v2/checkout/orders/X');
    await client.get('/v2/checkout/orders/X');
    expect(n).toBe(2); // 404는 담지 않았고, 200은 담았다
  });

  it('같은 조회가 동시에 들어오면 실제 호출 1회', async () => {
    const { paypal, shared } = setup(ENV_PUBLIC);
    const reader = okClient(shared.reader());
    const results = await Promise.all([1, 2, 3].map(() => reader.get(`/v1/customer/disputes/${D1}`)));
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
    expect(paypal.reads()).toHaveLength(1);
  });

  it('꺼낸 값을 고쳐도 캐시는 바뀌지 않는다', async () => {
    const { shared } = setup(ENV_PUBLIC);
    const reader = okClient(shared.reader());
    const a = await reader.get(`/v1/customer/disputes/${D1}`);
    (a.body as Record<string, unknown>).dispute_id = 'changed';
    const b = await reader.get(`/v1/customer/disputes/${D1}`);
    expect((b.body as Record<string, unknown>).dispute_id).toBe(D1);
  });

  it('캐시 키·값에 토큰·client_secret·Authorization이 없다', async () => {
    const { paypal, shared, cache } = setup(ENV_RECORDING);
    const reader = okClient(shared.reader());
    await reader.get('/v1/customer/disputes?page_size=50');
    await reader.get(`/v1/customer/disputes/${D1}`);
    await reader.get('/v2/checkout/orders/ORDER1');
    // 실제로 Bearer 토큰이 나갔는지 먼저 확인 (그 값이 캐시에 섞이지 않았는지 보려고)
    expect(paypal.reads().every((s) => s.headers.authorization === `Bearer ${TOKEN}`)).toBe(true);
    const dump = JSON.stringify(cache.snapshot());
    expect(cache.snapshot()).toHaveLength(3);
    const basic = Buffer.from(`test-client-id:${SECRET}`).toString('base64');
    for (const needle of [TOKEN, SECRET, basic, 'client_secret', 'client_credentials', 'Authorization', 'authorization', 'Bearer', 'access_token']) {
      expect(dump, needle).not.toContain(needle);
    }
  });

  it('캐시에서 꺼낸 것은 서랍에 새 줄을 남기지 않는다 (실제 호출만 한 줄)', async () => {
    const { shared } = setup(ENV_PUBLIC);
    const reader = okClient(shared.reader());
    await reader.get(`/v1/customer/disputes/${D1}`);
    await reader.get(`/v1/customer/disputes/${D1}`);
    await reader.get(`/v1/customer/disputes/${D1}`);
    const rows = listActivity().filter((r) => r.path === `/v1/customer/disputes/${D1}`);
    expect(rows).toHaveLength(1);
    expect(rows[0].cached).toBe(false);
  });
});

// ── 3. 공개 모드 쓰기 0회 (클라이언트 하나·캐시가 생긴 뒤에도) ─────────────────

describe('T084 3: public — 보내기·제안·추적 등록 → 실제 POST 0회', () => {
  it('client()·reader() 어느 입구로 보내도 관문이 막는다 (Simulated · not sent)', async () => {
    const { paypal, shared } = setup(ENV_PUBLIC);
    for (const entry of [shared.client(), shared.reader(), shared.client()]) {
      const client = okClient(entry);
      for (const [p, id] of [
        [`/v1/customer/disputes/${D1}/send-message`, 'r-a'],
        [`/v1/customer/disputes/${D1}/make-offer`, 'r-b'],
        ['/v2/checkout/orders/ORDER1/track', 'r-c'],
      ] as const) {
        const res = await client.call({ method: 'POST', path: p, body: {}, requestId: id });
        expect(res).toEqual({ status: SIMULATED_WRITE.status, body: { simulated: true } });
      }
    }
    expect(paypal.writes()).toHaveLength(0);
    expect(paypal.seen).toHaveLength(0); // 토큰도 받지 않았다
    const simulated = listActivity().filter((r) => r.method === 'POST');
    expect(simulated.length).toBeGreaterThan(0);
    expect(simulated.every((r) => r.simulated && r.status === null)).toBe(true);
  });

  it('추적 등록 화면 길 (registerTrackingFromScreen) → POST 0회, 두 번 눌러도', async () => {
    const { paypal, shared } = setup(ENV_PUBLIC);
    const env = { ...ENV_PUBLIC, AFTERLOOP_TRACK_LIVE: '1', AFTERLOOP_TRACK_LIVE_ORDERS: 'O05,O07', AFTERLOOP_TRACK_RECORDING: '1' };
    const first = await registerTrackingFromScreen({ paypal: shared.client(), env });
    const second = await registerTrackingFromScreen({ paypal: shared.client(), env });
    expect(first.kind).toBe('simulated');
    expect(second.kind).toBe('simulated');
    expect(paypal.writes()).toHaveLength(0);
    expect(paypal.tokens()).toBe(1);
  });

  it('관문 → 기록기 순서 그대로 (paypal.ts 원문)', () => {
    const source = read('src/app/_server/paypal.ts');
    expect(source).toMatch(/resolveDemoMode\(env\) === 'recording' \? client : blockWrites\(client\)/);
    expect(source).toMatch(/return \{ ok: true, client: recordClient\(gated\) \}/);
  });
});

// ── 4. 병렬로 바꾼 곳: 결과가 같다 ───────────────────────────────────────────

const INR = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
const SNAD = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';
const LINK_IDS = { D1: 'PP-R-MBJ-10197650', D2: 'PP-R-GMS-10197661', D3: 'PP-R-FYT-10197651' };
const LINKS: DemoLink[] = [
  { paypalDisputeId: LINK_IDS.D1, seedDisputeId: 'D1', carrierOrderId: 'O02', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: LINK_IDS.D2, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: LINK_IDS.D3, seedDisputeId: 'D3', carrierOrderId: 'O08', showOnScreen: true, liveSendAllowed: false },
];

function detailOf(id: string, reason: string, payer: string, text?: string): Record<string, unknown> {
  return {
    dispute_id: id,
    reason,
    status: 'WAITING_FOR_SELLER_RESPONSE',
    dispute_state: 'REQUIRED_ACTION',
    dispute_life_cycle_stage: 'INQUIRY',
    dispute_channel: 'INTERNAL',
    dispute_amount: { currency_code: 'USD', value: '48.00' },
    seller_response_due_date: '2026-11-30T00:37:00.000Z',
    create_time: '2026-11-08T00:00:00.000Z',
    disputed_transactions: [{ buyer_transaction_id: 'BUYERTXN000000001', buyer: { payer_id: payer } }],
    links: ['send_message', 'make_offer', 'accept_claim'].map((rel) => ({
      rel,
      href: `https://api-m.sandbox.paypal.com/v1/customer/disputes/${id}`,
      method: 'POST',
    })),
    messages: text === undefined ? [] : [{ posted_by: 'BUYER', content: text, time_posted: '2026-11-09T02:00:00.000Z' }],
    evidences: [],
  };
}

const DETAILS: Record<string, Record<string, unknown>> = {
  [LINK_IDS.D1]: detailOf(LINK_IDS.D1, SNAD, 'PAYERJIHO00001', 'The color is not what the photo showed!!'),
  [LINK_IDS.D2]: detailOf(LINK_IDS.D2, INR, 'PAYERSEOYEON01', 'It still has not arrived. I am really upset.'),
  [LINK_IDS.D3]: detailOf(LINK_IDS.D3, INR, 'PAYERBUYERM001'),
};

/** 응답 늦춤을 정할 수 있는 가짜 읽기 클라이언트. */
function delayedClient(delayOf: (path: string) => number): PayPalClient {
  return {
    call: async () => {
      throw new Error('POST 없음');
    },
    get: async (p: string) => {
      await new Promise((resolve) => setTimeout(resolve, delayOf(p)));
      if (p.startsWith('/v1/customer/disputes?')) {
        const items = Object.values(DETAILS).map((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'messages' && k !== 'evidences')));
        return { status: 200, body: { items, links: [] } };
      }
      const id = p.slice('/v1/customer/disputes/'.length);
      return DETAILS[id] === undefined ? { status: 404, body: {} } : { status: 200, body: structuredClone(DETAILS[id]) };
    },
  };
}

/** 프롬프트로만 답이 정해지는 가짜 LLM (늦춤만 다르게). 꼴이 틀린 답은 분류기·어조가 규칙으로 내려간다. */
function fakeLlm(delayOf: (n: number) => number): LlmCaller {
  let n = 0;
  return async (req) => {
    const i = n++;
    await new Promise((resolve) => setTimeout(resolve, delayOf(i)));
    const angry = /upset|!!/.test(req.user);
    return { angry, angryTone: angry, subtype: 'unknown', confidence: 0.2 };
  };
}

describe('T084 4: 병렬로 바꾼 곳의 결과 = 순차 때 결과 (toEqual)', () => {
  it('분쟁 상세 3건·보드·어조: 응답이 거꾸로 끝나도 결과·순서가 같다', async () => {
    const NOW = '2026-11-10T17:00:00.000Z';
    // 순차와 같은 꼴: 늦춤 없음 (먼저 시작한 것이 먼저 끝난다)
    const inOrder = await loadDemoDisputes({ client: delayedClient(() => 0), llm: fakeLlm(() => 0), links: LINKS, now: NOW });
    // 거꾸로 끝나게: 뒤 분쟁일수록 빨리, 앞 LLM 호출일수록 늦게
    const order = [LINK_IDS.D1, LINK_IDS.D2, LINK_IDS.D3];
    const reversed = await loadDemoDisputes({
      client: delayedClient((p) => (order.findIndex((id) => p.endsWith(id)) === -1 ? 0 : (3 - order.findIndex((id) => p.endsWith(id))) * 5)),
      llm: fakeLlm((i) => Math.max(0, 20 - i * 2)),
      links: LINKS,
      now: NOW,
    });
    expect(reversed).toEqual(inOrder);
    expect(inOrder.disputes.map((d) => d.key)).toEqual(['D1', 'D2', 'D3']);
  });

  it('AI 캐시: 같은 키가 동시에 들어와도 실제 호출 1회 (횟수 제한도 1회)', async () => {
    let calls = 0;
    const inner: LlmCaller = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true };
    };
    const limiter = createRateLimiter(1, () => 0);
    const llm = cachedLlm(inner, { cache: emptyLlmCache(), mode: 'public', limiter });
    const req = { system: 's', user: 'u', jsonSchema: {} };
    const out = await Promise.all([llm(req), llm(req), llm(req)]);
    expect(out).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(calls).toBe(1);
    expect(await llm(req)).toEqual({ ok: true }); // 캐시 적중 — 한도 1을 넘지 않는다
  });
});

// ── 5. 로딩 표시·Suspense·startTransition ─────────────────────────────────────

describe('T084 5: 로딩 표시 · Today (N) Suspense · 처방 토글 startTransition', () => {
  it('로딩 문구 키가 en·ko 둘 다 있고 키 집합이 같다', () => {
    expect(copyTables.en['common.loading']).toBeTruthy();
    expect(copyTables.ko['common.loading']).toBeTruthy();
    const keys = (table: Record<string, string>) => Object.keys(table).sort();
    expect(keys(copyTables.ko)).toEqual(keys(copyTables.en));
  });

  it('(app)/loading.tsx는 문구 파일·강조색만 쓴다', () => {
    const loading = read('src/app/(app)/loading.tsx');
    expect(loading).toMatch(/t\('common\.loading'\)/);
    const css = read('src/app/_shared/shell.css');
    const block = css.slice(css.indexOf('.app-loading'));
    expect(block).toMatch(/var\(--color-accent\)/);
    expect(block.match(/#[0-9a-fA-F]{3,8}\b/)).toBeNull(); // 새 색 값 없음
  });

  it('(app)/layout은 Today (N)을 Suspense로 뗀다', () => {
    const layout = read('src/app/(app)/layout.tsx');
    expect(layout).toMatch(/<Suspense fallback=\{<TopBar /);
    // T081 때문에 layout은 initLocale()을 await하는 async다. 뜻은 "layout 본문이 Today를 기다리지 않는다".
    const barStart = layout.indexOf('async function TopBarWithCount');
    const layoutStart = layout.indexOf('export default async function AppLayout');
    expect(barStart).toBeGreaterThan(-1);
    expect(layoutStart).toBeGreaterThan(barStart);
    const barBody = layout.slice(barStart, layoutStart);
    const layoutBody = layout.slice(layoutStart);
    expect(barBody).toMatch(/await loadTodayForRequest\(\)/);
    expect(layoutBody).not.toMatch(/loadTodayForRequest/);
  });

  it('처방 토글 다시 계산은 startTransition 안에서', () => {
    const screen = read('src/app/products/products-screen.tsx');
    expect(screen).toMatch(/onToggle=\{\(id\) => startTransition\(\(\) => setFixesOn/);
    expect(screen).toMatch(/onAllOn=\{\(\) => startTransition\(\(\) => setFixesOn/);
  });
});
