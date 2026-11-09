/**
 * 단위 테스트: PayPal 공통 클라이언트 (T002, SPEC v2.1 9-2장)
 *
 * AC14(인수 테스트)가 보는 큰 줄기 밖의 자세한 동작을 확인한다.
 * 네트워크·시간·대기는 모두 가짜로 주입한다 (`ClientDeps`). 실제 PayPal을 부르지 않고
 * 실제 시간도 기다리지 않는다 (`sleep`은 가짜 시계만 앞으로 옮긴다).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createPayPalClient } from '@/paypal/client';
import type { ApiRequest, ClientDeps, PayPalEnv } from '@/types';

const BASE = 'https://api-m.sandbox.paypal.com';
const ENV: PayPalEnv = { clientId: 'unit-client-id', clientSecret: 'unit-SECRET-must-not-leak', baseUrl: BASE };
const TOKEN = 'unit-TOKEN-must-not-leak';
const TOKEN2 = 'unit-TOKEN-TWO-must-not-leak';
const BASIC = Buffer.from(`${ENV.clientId}:${ENV.clientSecret}`).toString('base64');
/** 어떤 문구에도 나오면 안 되는 값들. */
const SECRETS = [ENV.clientSecret, BASIC, TOKEN, TOKEN2];

type Reply = { status: number; body?: string; headers?: Record<string, string> } | Error;

const tokenReply = (value: string, expiresIn: number | null = 3600): Reply => ({
  status: 200,
  body: JSON.stringify({ access_token: value, token_type: 'Bearer', ...(expiresIn === null ? {} : { expires_in: expiresIn }) }),
});

const OK_TOKEN: Reply = tokenReply(TOKEN);

/**
 * 가짜 PayPal. `replies`를 순서대로 쓰고 마지막 응답을 계속 반복한다.
 * 토큰 경로와 그 밖의 경로를 따로 둔다. `Error`를 넣으면 네트워크 오류가 된다.
 */
function harness(apiReplies: Reply[] = [{ status: 200, body: '{"ok":true}' }], tokenReplies: Reply[] = [OK_TOKEN]) {
  let clock = 1_700_000_000_000;
  const api: { url: string; init?: RequestInit; at: number }[] = [];
  const tokenCalls: { at: number }[] = [];
  const logs: string[] = [];
  const next = (queue: Reply[], used: number) => queue[Math.min(used, queue.length - 1)];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const isToken = url === `${BASE}/v1/oauth2/token`;
    const reply = isToken ? next(tokenReplies, tokenCalls.length) : next(apiReplies, api.length);
    if (isToken) tokenCalls.push({ at: clock });
    else api.push({ url, init, at: clock });
    if (reply instanceof Error) throw reply;
    return new Response(reply.body ?? null, {
      status: reply.status,
      headers: { 'content-type': 'application/json', ...(reply.headers ?? {}) },
    });
  });

  const sleep = vi.fn(async (ms: number) => {
    clock += ms;
  });
  const deps: ClientDeps = {
    fetch: fetchMock as unknown as typeof fetch,
    now: () => clock,
    sleep,
    log: (line: string) => logs.push(line),
  };
  return { deps, api, tokenCalls, logs, sleep, fetchMock, advance: (ms: number) => (clock += ms) };
}

const header = (init: RequestInit | undefined, name: string) => new Headers(init?.headers).get(name);

const POST: ApiRequest = {
  method: 'POST',
  path: '/v1/customer/disputes/PP-D-1/send-message',
  body: { message: 'hello' },
  requestId: 'unit-plan:send-message',
};

/** 던진 에러를 받아 돌려준다 (안 던지면 테스트 실패). */
async function caught(p: Promise<unknown>): Promise<Error & Record<string, unknown>> {
  try {
    await p;
  } catch (e) {
    return e as Error & Record<string, unknown>;
  }
  throw new Error('예외가 나야 하는데 나지 않음');
}

describe('클라이언트: 응답 읽기', () => {
  it('빈 본문은 null로 돌려준다', async () => {
    const h = harness([{ status: 204 }]);
    expect(await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes')).toEqual({ status: 204, body: null });
  });

  it('JSON이 아닌 본문은 원문 그대로 돌려준다', async () => {
    const h = harness([{ status: 200, body: 'not json' }]);
    expect(await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes')).toEqual({ status: 200, body: 'not json' });
  });

  it('404·422처럼 재시도 대상이 아닌 응답은 에러로 만들지 않고 그대로 돌려준다 (호출 1회)', async () => {
    const h = harness([{ status: 422, body: '{"name":"UNPROCESSABLE_ENTITY"}' }]);
    const res = await createPayPalClient(ENV, h.deps).call(POST);
    expect(res).toEqual({ status: 422, body: { name: 'UNPROCESSABLE_ENTITY' } });
    expect(h.api).toHaveLength(1);
  });
});

describe('클라이언트: 요청 만들기', () => {
  it('GET에는 PayPal-Request-Id와 Content-Type을 보내지 않는다', async () => {
    const h = harness();
    await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes?page_size=10');
    expect(h.api[0].url).toBe(`${BASE}/v1/customer/disputes?page_size=10`);
    expect(h.api[0].init?.method).toBe('GET');
    expect(h.api[0].init?.body).toBeUndefined();
    expect(header(h.api[0].init, 'paypal-request-id')).toBeNull();
    expect(header(h.api[0].init, 'content-type')).toBeNull();
  });

  it('POST는 JSON 본문과 PayPal-Request-Id를 보낸다', async () => {
    const h = harness([{ status: 201, body: '{"id":"x"}' }]);
    await createPayPalClient(ENV, h.deps).call(POST);
    expect(header(h.api[0].init, 'content-type')).toBe('application/json');
    expect(header(h.api[0].init, 'paypal-request-id')).toBe(POST.requestId);
    expect(JSON.parse(String(h.api[0].init?.body))).toEqual(POST.body);
  });

  it('requestId가 비어 있으면 호출하기 전에 에러 (fetch 0회)', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    await expect(client.call({ ...POST, requestId: '' })).rejects.toThrow();
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('baseUrl 끝의 슬래시는 허용하고 경로를 두 번 겹치지 않는다', async () => {
    const h = harness();
    await createPayPalClient({ ...ENV, baseUrl: `${BASE}/` }, h.deps).get('/v1/customer/disputes');
    expect(h.api[0].url).toBe(`${BASE}/v1/customer/disputes`);
  });
});

describe('클라이언트: 토큰', () => {
  it('call과 get이 같은 토큰을 함께 쓴다 (발급 1회)', async () => {
    const h = harness([{ status: 200, body: '{"ok":true}' }]);
    const client = createPayPalClient(ENV, h.deps);
    await client.get('/v1/customer/disputes');
    await client.call(POST);
    expect(h.tokenCalls).toHaveLength(1);
    expect(h.api).toHaveLength(2);
    for (const c of h.api) expect(header(c.init, 'authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('expires_in이 없으면 만료를 믿지 않고 호출마다 새로 받는다', async () => {
    const h = harness(undefined, [{ status: 200, body: JSON.stringify({ access_token: TOKEN, token_type: 'Bearer' }) }]);
    const client = createPayPalClient(ENV, h.deps);
    await client.get('/v1/customer/disputes');
    await client.get('/v1/customer/disputes');
    expect(h.tokenCalls).toHaveLength(2);
  });

  it('토큰 응답에 access_token이 없으면 에러 (API는 부르지 않는다)', async () => {
    const h = harness(undefined, [{ status: 200, body: '{"token_type":"Bearer"}' }]);
    await expect(createPayPalClient(ENV, h.deps).get('/v1/customer/disputes')).rejects.toThrow();
    expect(h.api).toHaveLength(0);
  });

  it('토큰 발급이 5xx면 2초 기다렸다가 다시 받고, 이어서 API를 부른다', async () => {
    const h = harness(undefined, [{ status: 503 }, OK_TOKEN]);
    const res = await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes');
    expect(res.status).toBe(200);
    expect(h.tokenCalls).toHaveLength(2);
    expect(h.sleep).toHaveBeenCalledWith(2000);
  });
});

describe('클라이언트: 재시도', () => {
  it('네트워크 오류는 2초 → 4초 기다렸다가 재시도하고, 세 번째도 실패하면 에러 (상태 없음)', async () => {
    const h = harness([new Error('socket hang up')]);
    const err = await caught(createPayPalClient(ENV, h.deps).get('/v1/customer/disputes'));
    expect(h.api).toHaveLength(3);
    expect(h.sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000]);
    expect(err.status).toBeNull();
    expect(err.path).toBe('/v1/customer/disputes');
  });

  it('네트워크 오류 뒤 성공하면 같은 PayPal-Request-Id로 다시 보낸다', async () => {
    const h = harness([new Error('ECONNRESET'), { status: 201, body: '{"id":"x"}' }]);
    const res = await createPayPalClient(ENV, h.deps).call(POST);
    expect(res.status).toBe(201);
    expect(h.api).toHaveLength(2);
    for (const c of h.api) expect(header(c.init, 'paypal-request-id')).toBe(POST.requestId);
  });

  it('5xx가 계속되면 2회 재시도 후 에러 (호출 3회, 에러에 상태가 남는다)', async () => {
    const h = harness([{ status: 500 }]);
    const err = await caught(createPayPalClient(ENV, h.deps).get('/v1/customer/disputes'));
    expect(h.api).toHaveLength(3);
    expect(h.sleep.mock.calls.map(([ms]) => ms)).toEqual([2000, 4000]);
    expect(err.status).toBe(500);
  });

  it('Retry-After가 숫자가 아니면 30초 기다린다', async () => {
    const h = harness([{ status: 429, headers: { 'retry-after': 'Wed, 21 Oct 2026 07:28:00 GMT' } }, { status: 200, body: '{"ok":true}' }]);
    await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes');
    expect(h.sleep).toHaveBeenCalledWith(30_000);
  });

  it('401 뒤 성공한 재시도는 POST 본문과 요청 ID를 그대로 보낸다', async () => {
    const h = harness([{ status: 401 }, { status: 201, body: '{"id":"x"}' }], [OK_TOKEN]);
    const res = await createPayPalClient(ENV, h.deps).call(POST);
    expect(res.status).toBe(201);
    expect(h.tokenCalls).toHaveLength(2);
    for (const c of h.api) {
      expect(header(c.init, 'paypal-request-id')).toBe(POST.requestId);
      expect(JSON.parse(String(c.init?.body))).toEqual(POST.body);
    }
  });
});

describe('클라이언트: 속도 제한', () => {
  it('토큰 발급도 60초 창에 세어, 30번째 자리를 넘으면 기다린다', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    // 토큰 1회 + API 29회 = 30자리
    for (let i = 0; i < 29; i++) await client.get(`/v1/customer/disputes?i=${i}`);
    expect(h.sleep).not.toHaveBeenCalled();

    await client.get('/v1/customer/disputes?i=29');
    expect(h.sleep).toHaveBeenCalled();
  });

  it('60초가 지나면 창이 비어 기다리지 않는다', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    for (let i = 0; i < 29; i++) await client.get(`/v1/customer/disputes?i=${i}`);
    h.advance(60_000);
    await client.get('/v1/customer/disputes?last');
    expect(h.sleep).not.toHaveBeenCalled();
    expect(h.api).toHaveLength(30);
  });
});

describe('클라이언트: 비밀값 비노출', () => {
  it('성공·실패 로그에 Secret·Basic·토큰이 없다', async () => {
    const basic = Buffer.from(`${ENV.clientId}:${ENV.clientSecret}`).toString('base64');
    const ok = harness([{ status: 429, headers: { 'retry-after': '1' } }, { status: 200, body: '{"ok":true}' }]);
    await createPayPalClient(ENV, ok.deps).get('/v1/customer/disputes');

    const broken = harness([{ status: 500 }]);
    const err = await caught(createPayPalClient(ENV, broken.deps).get('/v1/customer/disputes'));

    const all = [...ok.logs, ...broken.logs, err.message, String(err), JSON.stringify({ ...err })].join('\n');
    expect(all).not.toBe('');
    for (const secret of [ENV.clientSecret, basic, TOKEN]) expect(all).not.toContain(secret);
  });

  it('요청·응답 본문을 로그에 남기지 않는다 (구매자 개인정보, SPEC 10장)', async () => {
    const h = harness([{ status: 201, body: '{"buyer_note":"P1234567890123"}' }]);
    await createPayPalClient(ENV, h.deps).call({ ...POST, body: { message: 'personal-customs-code-P1234567890123' } });
    const logs = h.logs.join('\n');
    expect(logs).not.toContain('P1234567890123');
    expect(logs).toContain(`POST ${POST.path} → 201`);
  });

  it('log을 주지 않아도 동작한다', async () => {
    const h = harness();
    const deps: ClientDeps = { fetch: h.deps.fetch, now: h.deps.now, sleep: h.deps.sleep };
    expect((await createPayPalClient(ENV, deps).get('/v1/customer/disputes')).status).toBe(200);
  });
});

describe('클라이언트: 주입한 시간만 쓴다', () => {
  it('소스에서 Date.now·setTimeout·setInterval을 직접 부르지 않는다', () => {
    const src = readFileSync(path.resolve(__dirname, '../../src/paypal/client.ts'), 'utf8');
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).not.toMatch(/setTimeout\s*\(/);
    expect(src).not.toMatch(/setInterval\s*\(/);
  });
});

// ── 재시도(검증 보고서 반영): 토큰 발급 단일화 ────────────────────────────────
describe('클라이언트: 동시 호출은 토큰 발급 하나를 함께 쓴다', () => {
  it('토큰이 없는 상태에서 동시 GET 5개 → 토큰 발급 1회', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    const results = await Promise.all([0, 1, 2, 3, 4].map((i) => client.get(`/v1/customer/disputes?i=${i}`)));

    expect(h.tokenCalls).toHaveLength(1);
    expect(h.api).toHaveLength(5);
    for (const r of results) expect(r.status).toBe(200);
    for (const c of h.api) expect(header(c.init, 'authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('동시 GET이 20개여도 토큰 발급은 1회', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    await Promise.all(Array.from({ length: 20 }, (_, i) => client.get(`/v1/customer/disputes?i=${i}`)));

    expect(h.tokenCalls).toHaveLength(1);
    expect(h.api).toHaveLength(20);
  });

  it('토큰이 만료된 뒤 동시 GET 5개 → 발급은 1회만 더 (합계 2회)', async () => {
    const h = harness(undefined, [OK_TOKEN, tokenReply(TOKEN2)]);
    const client = createPayPalClient(ENV, h.deps);
    await client.get('/v1/customer/disputes');
    expect(h.tokenCalls).toHaveLength(1);

    h.advance(3600 * 1000 - 30_000); // 만료 60초 안
    await Promise.all([0, 1, 2, 3, 4].map((i) => client.get(`/v1/customer/disputes?i=${i}`)));

    expect(h.tokenCalls).toHaveLength(2);
    for (const c of h.api.slice(1)) expect(header(c.init, 'authorization')).toBe(`Bearer ${TOKEN2}`);
  });

  it('동시에 401을 받은 호출 5개가 갱신 1회를 함께 쓴다 (발급 합계 2회, 모두 성공)', async () => {
    // 처음 5번(동시 호출)은 401, 그 뒤 재시도는 200
    const replies: Reply[] = [
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 401 },
      { status: 200, body: '{"ok":true}' },
    ];
    const h = harness(replies, [OK_TOKEN, tokenReply(TOKEN2)]);
    const client = createPayPalClient(ENV, h.deps);
    const results = await Promise.all([0, 1, 2, 3, 4].map((i) => client.get(`/v1/customer/disputes?i=${i}`)));

    for (const r of results) expect(r.status).toBe(200);
    expect(h.tokenCalls).toHaveLength(2);
    expect(h.api).toHaveLength(10);
    for (const c of h.api.slice(5)) expect(header(c.init, 'authorization')).toBe(`Bearer ${TOKEN2}`);
  });
});

// ── 재시도(검증 보고서 반영): path 검사 ──────────────────────────────────────
describe('클라이언트: path 검사', () => {
  const BAD_PATHS: [string, string][] = [
    ['빈 경로', ''],
    ['슬래시로 시작하지 않음', 'v1/customer/disputes'],
    ['점으로 시작 (호스트가 바뀐다)', '.evil.example/steal'],
    ['포트가 붙는다', ':8443/steal'],
    ['userinfo가 붙는다', '@evil.example/steal'],
    ['//로 시작', '//evil.example/steal'],
    ['스킴 포함 (절대 URL)', 'https://evil.example/steal'],
    ['스킴 포함 (경로 안)', '/v1/https://evil.example/steal'],
    ['역슬래시 포함', '/\\evil.example/steal'],
    ['공백 포함', '/v1/customer/ disputes'],
    ['줄바꿈 포함', '/v1/customer\ndisputes'],
    ['탭 포함', '/v1/customer\tdisputes'],
    ['제어문자 포함', '/v1/customer\u0000disputes'],
  ];

  it.each(BAD_PATHS)('GET %s → 토큰 발급·fetch 전에 거부 (fetch 0회)', async (_label, badPath) => {
    const h = harness();
    const err = await caught(createPayPalClient(ENV, h.deps).get(badPath));
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(h.tokenCalls).toHaveLength(0);
    expect(err.status).toBeNull();
  });

  it.each(BAD_PATHS)('POST %s → 토큰 발급·fetch 전에 거부 (fetch 0회)', async (_label, badPath) => {
    const h = harness();
    await expect(createPayPalClient(ENV, h.deps).call({ ...POST, path: badPath })).rejects.toThrow();
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('"/" 한 개로 시작하는 경로와 쿼리 문자열은 그대로 보낸다', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    await client.get('/v1/customer/disputes/PP-D-1');
    await client.get('/v1/customer/disputes?page_size=10&status=OPEN');
    expect(h.api.map((c) => c.url)).toEqual([
      `${BASE}/v1/customer/disputes/PP-D-1`,
      `${BASE}/v1/customer/disputes?page_size=10&status=OPEN`,
    ]);
  });
});

// ── 재시도(검증 보고서 반영): 비밀값 비노출 ──────────────────────────────────
/** 에러와 로그에서 비밀값을 찾을 수 있는 모든 표면을 모은다. */
function surfaces(err: Error & Record<string, unknown>, logs: string[]): string {
  return [
    err.message,
    String(err),
    err.stack ?? '',
    JSON.stringify({ ...err }),
    err.cause === undefined ? '' : String(err.cause),
    ...Object.values(err).map((v) => String(v)),
    ...logs,
  ].join('\n');
}

describe('클라이언트: 비밀값 비노출 (계약 밖 입력)', () => {
  it.each([
    ['baseUrl 뒤에 Secret이 붙은 값', `${BASE}/${ENV.clientSecret}`],
    ['userinfo에 Secret이 들어간 값', `https://unit-client-id:${ENV.clientSecret}@api-m.sandbox.paypal.com`],
    ['live 주소에 Secret이 붙은 값', `https://api-m.paypal.com?s=${ENV.clientSecret}`],
    ['Basic 값이 들어간 값', `https://example.com/${BASIC}`],
  ])('샌드박스 외 baseUrl(%s) 예외 문구에 받은 값이 없다', (_label, baseUrl) => {
    const h = harness();
    let thrown: (Error & Record<string, unknown>) | null = null;
    try {
      createPayPalClient({ ...ENV, baseUrl }, h.deps);
    } catch (e) {
      thrown = e as Error & Record<string, unknown>;
    }
    expect(thrown).not.toBeNull();
    const text = surfaces(thrown as Error & Record<string, unknown>, []);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(text).not.toContain(baseUrl);
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('path에 액세스 토큰이 들어 있어도 에러·로그에 나오지 않는다', async () => {
    const h = harness([{ status: 200, body: '{"ok":true}' }, { status: 500 }]);
    const client = createPayPalClient(ENV, h.deps);
    await client.get('/v1/customer/disputes'); // 토큰을 먼저 받아 둔다 (첫 응답만 200)
    const err = await caught(client.get(`/v1/customer/disputes/${TOKEN}`));

    const text = surfaces(err, h.logs);
    expect(text).not.toBe('');
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(err.path).toContain('[redacted]');
  });

  it('path에 Secret이 들어 있어도 에러·로그에 나오지 않는다', async () => {
    const h = harness([{ status: 500 }]);
    const err = await caught(createPayPalClient(ENV, h.deps).get(`/v1/customer/disputes/${ENV.clientSecret}`));
    const text = surfaces(err, h.logs);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
  });

  it('거부된 path의 에러 문구에도 비밀값이 없다', async () => {
    const h = harness();
    const err = await caught(createPayPalClient(ENV, h.deps).get(`https://evil.example/steal?s=${ENV.clientSecret}`));
    const text = surfaces(err, h.logs);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('에러와 로그의 경로에서 쿼리 문자열을 뺀다 (구매자 식별값이 들어갈 수 있다)', async () => {
    const h = harness([{ status: 500 }]);
    const err = await caught(createPayPalClient(ENV, h.deps).get('/v1/customer/disputes?buyer=P1234567890123'));

    expect(err.path).toBe('/v1/customer/disputes');
    const text = surfaces(err, h.logs);
    expect(text).not.toContain('P1234567890123');
    expect(text).not.toContain('buyer=');
  });

  // T002 재검증 보고 문제 1: 가리기보다 제어문자 지우기가 먼저여야 한다.
  it.each([
    ['줄바꿈', '\n'],
    ['캐리지 리턴', '\r'],
    ['탭', '\t'],
    ['NUL', '\u0000'],
    ['DEL', '\u007f'],
    ['여러 제어문자', '\r\n\t'],
  ])('제어문자(%s)로 쪼갠 Secret이 거부된 path의 에러·로그에서 다시 이어 붙지 않는다', async (_label, splitter) => {
    const half = Math.floor(ENV.clientSecret.length / 2);
    const split = `${ENV.clientSecret.slice(0, half)}${splitter}${ENV.clientSecret.slice(half)}`;
    const h = harness();
    // 제어문자가 든 path는 거부된다 (여기서 보는 것은 거부 에러의 문구다)
    const err = await caught(createPayPalClient(ENV, h.deps).get(`/v1/customer/disputes/${split}`));

    const text = surfaces(err, h.logs);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(err.path).toContain('[redacted]');
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('제어문자로 쪼갠 액세스 토큰도 에러·로그에서 다시 이어 붙지 않는다', async () => {
    const h = harness([{ status: 200, body: '{"ok":true}' }]);
    const client = createPayPalClient(ENV, h.deps);
    await client.get('/v1/customer/disputes'); // 토큰을 먼저 받아 둔다
    const split = `${TOKEN.slice(0, 8)}\n${TOKEN.slice(8)}`;
    const err = await caught(client.get(`/v1/customer/disputes/${split}`));

    const text = surfaces(err, h.logs);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(h.api).toHaveLength(1); // 거부된 호출은 나가지 않는다
  });

  it('제어문자 지우기를 먼저 해도 정상 경로의 로그는 그대로다', async () => {
    const h = harness([{ status: 404, body: '{}' }]);
    await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes/PP-R-XWI-10197379?page_size=10');

    expect(h.logs).toContain('GET /v1/customer/disputes/PP-R-XWI-10197379 → 404');
  });

  it('requestId가 빈 POST의 에러 문구에도 경로의 쿼리·비밀값이 없다', async () => {
    const h = harness();
    const err = await caught(
      createPayPalClient(ENV, h.deps).call({ ...POST, path: `/v1/x?s=${ENV.clientSecret}`, requestId: '' }),
    );
    const text = surfaces(err, h.logs);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    expect(err.path).toBe('/v1/x');
    expect(h.fetchMock).not.toHaveBeenCalled();
  });
});

// ── 재시도(검증 보고서 반영): Retry-After ────────────────────────────────────
describe('클라이언트: Retry-After 해석', () => {
  const wait = async (value: string | null) => {
    const headers = value === null ? undefined : { 'retry-after': value };
    const h = harness([{ status: 429, headers }, { status: 200, body: '{"ok":true}' }]);
    await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes');
    return h.sleep.mock.calls.map(([ms]) => ms as number);
  };

  it.each([
    ['헤더 없음', null],
    ['빈 값', ''],
    ['공백만', '   '],
    ['숫자 아님', 'abc'],
    ['음수', '-5'],
    ['소수', '1.5'],
    ['지수 표기', '1e3'],
    ['16진수 표기', '0x10'],
    ['부호 붙은 정수', '+5'],
    ['HTTP 날짜', 'Wed, 21 Oct 2026 07:28:00 GMT'],
    ['Infinity', 'Infinity'],
  ])('Retry-After %s → 기본 30초', async (_label, value) => {
    expect(await wait(value)).toEqual([30_000]);
  });

  it.each([
    ['0', 0],
    ['3', 3_000],
    ['60', 60_000],
  ] as [string, number][])('Retry-After %s초 → 그대로 기다린다', async (value, expected) => {
    expect(await wait(value)).toEqual([expected]);
  });

  it.each([['61'], ['86400'], ['999999999999999999999']])('Retry-After %s초 → 상한 60초', async (value) => {
    expect(await wait(value)).toEqual([60_000]);
  });
});

// ── 재시도(검증 보고서 반영): requestId 검사 ─────────────────────────────────
describe('클라이언트: requestId 검사', () => {
  it.each([['빈 문자열', ''], ['공백만', '   '], ['탭·줄바꿈만', '\t\n']])(
    'requestId가 %s이면 호출 전에 거부 (fetch 0회)',
    async (_label, requestId) => {
      const h = harness();
      await expect(createPayPalClient(ENV, h.deps).call({ ...POST, requestId })).rejects.toThrow();
      expect(h.fetchMock).not.toHaveBeenCalled();
    },
  );

  it('양끝에 공백이 있어도 값이 있으면 보낸다 (헤더 값은 전송 규칙대로 양끝이 다듬어진다)', async () => {
    const h = harness([{ status: 201, body: '{"id":"x"}' }]);
    await createPayPalClient(ENV, h.deps).call({ ...POST, requestId: ' unit-plan:send-message ' });
    expect(header(h.api[0].init, 'paypal-request-id')).toBe('unit-plan:send-message');
  });
});

// ── 재시도(검증 보고서 반영): 5xx 소진 에러의 debug_id ───────────────────────
describe('클라이언트: 재시도를 다 쓴 5xx 에러', () => {
  it('status와 PayPal debug_id를 싣고 응답 본문은 싣지 않는다', async () => {
    const body = JSON.stringify({
      name: 'INTERNAL_SERVER_ERROR',
      message: 'buyer P1234567890123',
      debug_id: 'dbg-unit-abc123',
    });
    const h = harness([{ status: 500, body }]);
    const err = await caught(createPayPalClient(ENV, h.deps).get('/v1/customer/disputes'));

    expect(err.status).toBe(500);
    expect(err.debugId).toBe('dbg-unit-abc123');
    expect(err.message).toContain('dbg-unit-abc123');
    const text = surfaces(err, h.logs);
    expect(text).not.toContain('P1234567890123');
    expect(text).not.toContain('INTERNAL_SERVER_ERROR');
  });

  it('본문이 JSON이 아니거나 debug_id가 없으면 debugId는 null (본문을 싣지 않는다)', async () => {
    const h = harness([{ status: 503, body: '<html>oops P1234567890123</html>' }]);
    const err = await caught(createPayPalClient(ENV, h.deps).get('/v1/customer/disputes'));
    expect(err.status).toBe(503);
    expect(err.debugId).toBeNull();
    expect(surfaces(err, h.logs)).not.toContain('oops');

    const h2 = harness([{ status: 500, body: '{"name":"X"}' }]);
    const err2 = await caught(createPayPalClient(ENV, h2.deps).get('/v1/customer/disputes'));
    expect(err2.debugId).toBeNull();
  });
});

// ── 재시도(검증 보고서 반영): 버리는 응답의 본문 닫기 ────────────────────────
describe('클라이언트: 재시도로 버리는 응답', () => {
  it('본문을 닫는다 (body.cancel이 있으면). 읽은 응답은 닫지 않는다', async () => {
    /** 본문 닫힘을 셀 수 있는 가짜 응답 (실제 Response는 cancel을 들여다볼 수 없다). */
    const fakeResponse = (status: number, text: string, headers: Record<string, string> = {}) => {
      const cancel = vi.fn(async () => {});
      let used = false;
      const res = {
        status,
        headers: new Headers(headers),
        body: { cancel },
        get bodyUsed() {
          return used;
        },
        text: async () => {
          used = true;
          return text;
        },
      };
      return { res: res as unknown as Response, cancel };
    };

    let clock = 1_700_000_000_000;
    const made: { status: number; cancel: ReturnType<typeof vi.fn> }[] = [];
    // 401 → 토큰 갱신 → 429 → 503 → 200
    const apiPlan: { status: number; body?: string; headers?: Record<string, string> }[] = [
      { status: 401 },
      { status: 429, headers: { 'retry-after': '1' } },
      { status: 503 },
      { status: 200, body: '{"ok":true}' },
    ];
    let apiUsed = 0;

    const deps: ClientDeps = {
      fetch: (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === `${BASE}/v1/oauth2/token`) {
          const made1 = fakeResponse(200, JSON.stringify({ access_token: TOKEN, token_type: 'Bearer', expires_in: 3600 }));
          made.push({ status: 200, cancel: made1.cancel });
          return made1.res;
        }
        const plan = apiPlan[Math.min(apiUsed, apiPlan.length - 1)];
        apiUsed += 1;
        const f = fakeResponse(plan.status, plan.body ?? '', plan.headers);
        made.push({ status: plan.status, cancel: f.cancel });
        return f.res;
      }) as unknown as typeof fetch,
      now: () => clock,
      sleep: async (ms: number) => {
        clock += ms;
      },
    };

    const res = await createPayPalClient(ENV, deps).get('/v1/customer/disputes');
    expect(res).toEqual({ status: 200, body: { ok: true } });

    const canceledStatuses = made.filter((m) => m.cancel.mock.calls.length > 0).map((m) => m.status);
    expect(canceledStatuses.sort()).toEqual([401, 429, 503]);
    // 본문을 읽은 응답(토큰 200, 마지막 200)은 닫지 않는다
    for (const m of made.filter((x) => x.status === 200)) expect(m.cancel).not.toHaveBeenCalled();
  });
});
