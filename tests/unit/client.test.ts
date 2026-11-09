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

type Reply = { status: number; body?: string; headers?: Record<string, string> } | Error;

const OK_TOKEN: Reply = {
  status: 200,
  body: JSON.stringify({ access_token: TOKEN, token_type: 'Bearer', expires_in: 3600 }),
};

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
