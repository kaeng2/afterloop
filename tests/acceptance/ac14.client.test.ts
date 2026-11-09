/**
 * 인수 테스트 AC14: PayPal OAuth 클라이언트 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09 (AC14 작성 승인 2026-11-09)
 * 기준: SPEC v1.1 5-1장. 작업: T002
 *
 * 네트워크·시간·대기는 모두 가짜로 주입한다 (ClientDeps). 실제 PayPal을 부르지 않는다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createPayPalClient } from '@/paypal/client';
import type { ClientDeps, PayPalEnv } from '@/types';

const BASE = 'https://api-m.sandbox.paypal.com';
const ENV: PayPalEnv = { clientId: 'AC14-client-id', clientSecret: 'AC14-SECRET-must-not-leak', baseUrl: BASE };
const BASIC = Buffer.from(`${ENV.clientId}:${ENV.clientSecret}`).toString('base64');
const TOKENS = ['AC14-TOKEN-ONE-aaaaaaaaaaaa', 'AC14-TOKEN-TWO-bbbbbbbbbbbb', 'AC14-TOKEN-THREE-cccccccccc'];
const EXPIRES_IN = 3600; // 초

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

const respond = (r: Reply) =>
  new Response(r.body === undefined ? null : JSON.stringify(r.body), {
    status: r.status,
    headers: { 'content-type': 'application/json', ...(r.headers ?? {}) },
  });

const header = (init: RequestInit | undefined, name: string) => new Headers(init?.headers).get(name);

/**
 * 가짜 PayPal. apiReplies는 순서대로 쓰고, 마지막 응답은 계속 반복한다.
 * 토큰 엔드포인트는 기본으로 TOKENS를 차례로 발급한다.
 */
function harness(apiReplies: Reply[] = [{ status: 200, body: { ok: true } }], tokenReplies?: Reply[]) {
  let clock = 1_700_000_000_000;
  let tokenIdx = 0;
  const api: { url: string; init?: RequestInit; at: number }[] = [];
  const tokenCalls: { init?: RequestInit; at: number }[] = [];
  const logs: string[] = [];
  const queue = [...apiReplies];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === `${BASE}/v1/oauth2/token`) {
      tokenCalls.push({ init, at: clock });
      const r = tokenReplies?.[Math.min(tokenIdx, tokenReplies.length - 1)] ?? {
        status: 200,
        body: { access_token: TOKENS[Math.min(tokenIdx, TOKENS.length - 1)], token_type: 'Bearer', expires_in: EXPIRES_IN },
      };
      tokenIdx++;
      return respond(r);
    }
    api.push({ url, init, at: clock });
    const r = queue.length > 1 ? queue.shift()! : queue[0];
    return respond(r);
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

/** 에러를 문자열로 모은다 (메시지, toString, 직접 붙인 속성) */
async function errorText(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as Error & Record<string, unknown>;
    return [err?.message, String(err), JSON.stringify({ ...err }), err?.cause ? JSON.stringify(err.cause) : ''].join('\n');
  }
  throw new Error('예외가 나야 하는데 나지 않음');
}

const leaks = (text: string) =>
  [ENV.clientSecret, BASIC, ...TOKENS].filter((s) => text.includes(s));

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC14 OAuth 클라이언트: 토큰', () => {
  it('토큰을 한 번 받아 만료 전까지 재사용한다 (Basic 인증으로 발급, Bearer로 호출)', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    const first = await client.get('/v1/customer/disputes');
    h.advance(10 * 60_000);
    await client.get('/v1/customer/disputes');

    expect(first).toEqual({ status: 200, body: { ok: true } });
    expect(h.tokenCalls).toHaveLength(1);
    expect(header(h.tokenCalls[0].init, 'authorization')).toBe(`Basic ${BASIC}`);
    expect(h.api).toHaveLength(2);
    expect(h.api[0].url).toBe(`${BASE}/v1/customer/disputes`);
    for (const c of h.api) expect(header(c.init, 'authorization')).toBe(`Bearer ${TOKENS[0]}`);
  });

  it('만료 60초 전 안으로 들어오면 새 토큰을 받는다', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    await client.get('/v1/customer/disputes');
    h.advance(EXPIRES_IN * 1000 - 30_000);
    await client.get('/v1/customer/disputes');

    expect(h.tokenCalls).toHaveLength(2);
    expect(header(h.api[1].init, 'authorization')).toBe(`Bearer ${TOKENS[1]}`);
  });

  it('401이면 토큰을 1회 갱신하고 재시도한다', async () => {
    const h = harness([{ status: 401 }, { status: 200, body: { ok: true } }]);
    const client = createPayPalClient(ENV, h.deps);
    const res = await client.get('/v1/customer/disputes');

    expect(res.status).toBe(200);
    expect(h.tokenCalls).toHaveLength(2);
    expect(h.api).toHaveLength(2);
    expect(header(h.api[1].init, 'authorization')).toBe(`Bearer ${TOKENS[1]}`);
  });

  it('갱신 후에도 401이면 에러 (더 재시도하지 않음)', async () => {
    const h = harness([{ status: 401 }]);
    const client = createPayPalClient(ENV, h.deps);
    await expect(client.get('/v1/customer/disputes')).rejects.toThrow();
    expect(h.tokenCalls).toHaveLength(2);
    expect(h.api).toHaveLength(2);
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC14 OAuth 클라이언트: 재시도와 속도 제한', () => {
  it('429면 Retry-After초만큼 기다렸다가 재시도', async () => {
    const h = harness([{ status: 429, headers: { 'retry-after': '3' } }, { status: 200, body: { ok: true } }]);
    const res = await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes');
    expect(res.status).toBe(200);
    expect(h.sleep).toHaveBeenCalledWith(3000);
  });

  it('Retry-After가 없으면 30초 기다린다', async () => {
    const h = harness([{ status: 429 }, { status: 200, body: { ok: true } }]);
    await createPayPalClient(ENV, h.deps).get('/v1/customer/disputes');
    expect(h.sleep).toHaveBeenCalledWith(30_000);
  });

  it('429가 계속되면 최대 2회 재시도 후 에러 (호출 3회)', async () => {
    const h = harness([{ status: 429, headers: { 'retry-after': '1' } }]);
    await expect(createPayPalClient(ENV, h.deps).get('/v1/customer/disputes')).rejects.toThrow();
    expect(h.api).toHaveLength(3);
  });

  it('POST: 5xx면 2초 후 재시도하고, 재시도에도 같은 PayPal-Request-Id를 보낸다', async () => {
    const h = harness([{ status: 503 }, { status: 201, body: { id: 'x' } }]);
    const body = { note: 'hello', offer_amount: { currency_code: 'USD', value: '7.20' } };
    const res = await createPayPalClient(ENV, h.deps).call({
      method: 'POST',
      path: '/v1/customer/disputes/PP-R-TEST/make-offer',
      body,
      requestId: 'ac14-plan:make-offer',
    });

    expect(res.status).toBe(201);
    expect(h.sleep).toHaveBeenCalledWith(2000);
    expect(h.api).toHaveLength(2);
    for (const c of h.api) {
      expect(c.url).toBe(`${BASE}/v1/customer/disputes/PP-R-TEST/make-offer`);
      expect(c.init?.method).toBe('POST');
      expect(header(c.init, 'paypal-request-id')).toBe('ac14-plan:make-offer');
      expect(JSON.parse(String(c.init?.body))).toEqual(body);
    }
  });

  it('최근 60초 동안 30회를 넘지 않는다 (31번째 호출은 기다린다)', async () => {
    const h = harness();
    const client = createPayPalClient(ENV, h.deps);
    for (let i = 0; i < 31; i++) await client.get(`/v1/customer/disputes?i=${i}`);

    expect(h.api).toHaveLength(31);
    expect(h.sleep).toHaveBeenCalled();
    for (let i = 30; i < h.api.length; i++) {
      expect(h.api[i].at - h.api[i - 30].at).toBeGreaterThanOrEqual(60_000);
    }
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC14 OAuth 클라이언트: 비밀값 비노출', () => {
  it('토큰 발급 실패, 401 반복, 429 반복의 에러 메시지와 로그에 Secret·토큰·Basic 값이 없다', async () => {
    const texts: string[] = [];

    const tokenFail = harness(undefined, [
      { status: 401, body: { error: 'invalid_client', error_description: 'Client Authentication failed' } },
    ]);
    texts.push(await errorText(createPayPalClient(ENV, tokenFail.deps).get('/v1/customer/disputes')));

    const unauthorized = harness([{ status: 401 }]);
    texts.push(await errorText(createPayPalClient(ENV, unauthorized.deps).get('/v1/customer/disputes')));

    const limited = harness([{ status: 429, headers: { 'retry-after': '1' } }]);
    texts.push(await errorText(createPayPalClient(ENV, limited.deps).get('/v1/customer/disputes')));

    const ok = harness();
    await createPayPalClient(ENV, ok.deps).get('/v1/customer/disputes');

    const all = [...texts, ...tokenFail.logs, ...unauthorized.logs, ...limited.logs, ...ok.logs].join('\n');
    expect(leaks(all)).toEqual([]);
  });

  it('프론트 코드(src/app)가 클라이언트를 import하지 않고, NEXT_PUBLIC_ 이름으로 Secret을 쓰지 않는다', () => {
    const root = path.resolve(__dirname, '../../src');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|jsx)$/.test(name)) files.push(p);
      }
    };
    walk(root);
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const rel = path.relative(root, f);
      expect(src, rel).not.toMatch(/NEXT_PUBLIC_[A-Z_]*SECRET/);
      if (rel.startsWith(`app${path.sep}`) && /['"]use client['"]/.test(src)) {
        expect(src, rel).not.toMatch(/@\/paypal\/client|paypal\/client['"]/);
      }
    }
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC14 OAuth 클라이언트: 샌드박스만', () => {
  it.each([['https://api-m.paypal.com'], ['http://api-m.sandbox.paypal.com'], ['https://example.com']])(
    'baseUrl %s → 만들 때 에러, 호출 0회',
    (baseUrl) => {
      const h = harness();
      expect(() => createPayPalClient({ ...ENV, baseUrl }, h.deps)).toThrow();
      expect(h.fetchMock).not.toHaveBeenCalled();
    },
  );
});
