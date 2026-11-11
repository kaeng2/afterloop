/**
 * T088: 읽기 캐시 stale-while-revalidate (가짜 시계 · 가짜 클라이언트 · 실제 PayPal 호출 없음).
 *
 * - 90초 안 → 호출 0, 90초~10분 → 지난 값을 바로 + 뒤에서 1회 + 다음 요청은 새 값, 10분 뒤 → 기다려서 읽음
 * - 뒤에서 읽는 중 쓰기 → 키 지움, 늦게 온 옛 응답이 다시 채우지 않음
 * - 뒤에서 읽기 실패 → 지난 값 유지, unhandled rejection 없음
 * - 뒤에서 읽기도 기록기(서랍)에 한 줄 남는다
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { listActivity, recordClient, resetActivityForTest } from '@/app/_server/activity';
import { createReadCache, READ_CACHE_STALE_MAX_MS, READ_CACHE_TTL_MS } from '@/app/_server/read-cache';
import type { ApiRequest, PayPalClient } from '@/types';

type Res = { status: number; body: unknown };

/** 응답을 손으로 끝내는 가짜 클라이언트. `get`마다 대기 중 하나가 생긴다. */
function manualClient() {
  const waiting: { path: string; resolve: (r: Res) => void; reject: (e: unknown) => void }[] = [];
  const calls: ApiRequest[] = [];
  const client: PayPalClient = {
    get: (path) => new Promise<Res>((resolve, reject) => waiting.push({ path, resolve, reject })),
    call: async (req) => {
      calls.push(req);
      return { status: 201, body: { ok: true } };
    },
  };
  return { client, waiting, calls, gets: () => waiting.length };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const PATH = '/v1/customer/disputes/PP-D-1';

function setup() {
  let clock = 1_000_000;
  const cache = createReadCache({ now: () => clock });
  const fake = manualClient();
  const reader = cache.wrap(fake.client);
  return { cache, fake, reader, advance: (ms: number) => (clock += ms) };
}

/** 첫 읽기를 v1로 채운다. */
async function fill(s: ReturnType<typeof setup>, body: unknown = { v: 1 }) {
  const first = s.reader.get(PATH);
  s.fake.waiting[s.fake.waiting.length - 1].resolve({ status: 200, body });
  return first;
}

const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown) => unhandled.push(reason);
beforeEach(() => {
  resetActivityForTest();
  unhandled.length = 0;
  process.on('unhandledRejection', onUnhandled);
});
afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
});

describe('T088 1: 가짜 시계 — 90초 / 90초~10분 / 10분 뒤', () => {
  it('상수: 90초, 10분', () => {
    expect(READ_CACHE_TTL_MS).toBe(90_000);
    expect(READ_CACHE_STALE_MAX_MS).toBe(600_000);
  });

  it('90초 안 → 호출 0', async () => {
    const s = setup();
    await fill(s);
    s.advance(READ_CACHE_TTL_MS - 1);
    expect((await s.reader.get(PATH)).body).toEqual({ v: 1 });
    expect(s.fake.gets()).toBe(1);
  });

  it('90초~10분 → 지난 값을 바로(기다림 없이) + 뒤에서 1회 + 다음 요청은 새 값', async () => {
    const s = setup();
    await fill(s);
    s.advance(READ_CACHE_TTL_MS);
    // 뒤에서 읽기가 끝나지 않았는데도 바로 돌아온다
    expect((await s.reader.get(PATH)).body).toEqual({ v: 1 });
    expect(s.fake.gets()).toBe(2);
    // 진행 중이면 다시 시작하지 않는다
    expect((await s.reader.get(PATH)).body).toEqual({ v: 1 });
    expect((await s.reader.get(PATH)).body).toEqual({ v: 1 });
    expect(s.fake.gets()).toBe(2);
    s.fake.waiting[1].resolve({ status: 200, body: { v: 2 } });
    await flush();
    expect((await s.reader.get(PATH)).body).toEqual({ v: 2 });
    expect(s.fake.gets()).toBe(2); // 새 값은 다시 90초 동안 그대로
  });

  it('10분 끝 바로 전까지는 지난 값, 10분이 지나면 기다려서 읽는다', async () => {
    const s = setup();
    await fill(s);
    s.advance(READ_CACHE_STALE_MAX_MS - 1);
    expect((await s.reader.get(PATH)).body).toEqual({ v: 1 });
    s.fake.waiting[1].reject(new Error('down')); // 실패 → 지난 값 유지
    await flush();
    s.advance(1);
    let settled = false;
    const p = s.reader.get(PATH).then((r) => {
      settled = true;
      return r;
    });
    await flush();
    expect(settled).toBe(false); // 기다린다
    expect(s.fake.gets()).toBe(3);
    s.fake.waiting[2].resolve({ status: 200, body: { v: 3 } });
    expect((await p).body).toEqual({ v: 3 });
  });
});

describe('T088 2: 뒤에서 읽는 중 쓰기', () => {
  it('쓰기 → 키 지움, 늦게 온 옛 응답이 다시 채우지 않음, 다음 읽기는 새로 기다려서', async () => {
    const s = setup();
    await fill(s);
    s.advance(READ_CACHE_TTL_MS + 1);
    await s.reader.get(PATH); // 지난 값 + 뒤에서 읽기 시작 (waiting[1])
    await s.reader.call({ method: 'POST', path: '/v1/customer/disputes/PP-D-1/send-message', body: {}, requestId: 'r' });
    expect(s.cache.snapshot()).toHaveLength(0);
    // 쓰기 뒤 읽기 → 기다려서 새로 (waiting[2])
    const after = s.reader.get(PATH);
    await flush();
    expect(s.fake.gets()).toBe(3);
    // 옛 응답이 늦게 도착
    s.fake.waiting[1].resolve({ status: 200, body: { v: 'old' } });
    await flush();
    expect(s.cache.snapshot()).toHaveLength(0);
    s.fake.waiting[2].resolve({ status: 200, body: { v: 'new' } });
    expect((await after).body).toEqual({ v: 'new' });
    expect(s.cache.snapshot().map((e) => e.value.body)).toEqual([{ v: 'new' }]);
  });

  it('쓰기 뒤 아무도 안 읽어도 옛 응답은 지운 키를 채우지 않는다', async () => {
    const s = setup();
    await fill(s);
    s.advance(READ_CACHE_TTL_MS + 1);
    await s.reader.get(PATH);
    s.cache.invalidate('/v1/customer/disputes/PP-D-1/make-offer');
    s.fake.waiting[1].resolve({ status: 200, body: { v: 'old' } });
    await flush();
    expect(s.cache.snapshot()).toHaveLength(0);
  });
});

describe('T088 3: 뒤에서 읽기 실패', () => {
  it('예외 → 지난 값 유지, 다음 요청이 다시 뒤에서 읽기, unhandled rejection 없음', async () => {
    const s = setup();
    await fill(s);
    s.advance(READ_CACHE_TTL_MS + 1);
    await s.reader.get(PATH);
    s.fake.waiting[1].reject(new Error('network down'));
    await flush();
    await flush();
    expect(unhandled).toEqual([]);
    expect(s.cache.snapshot().map((e) => e.value.body)).toEqual([{ v: 1 }]);
    expect((await s.reader.get(PATH)).body).toEqual({ v: 1 });
    expect(s.fake.gets()).toBe(3); // 실패 뒤에는 다시 시도할 수 있다
  });

  it('5xx·4xx → 지난 값 유지', async () => {
    const s = setup();
    await fill(s);
    s.advance(READ_CACHE_TTL_MS + 1);
    await s.reader.get(PATH);
    s.fake.waiting[1].resolve({ status: 503, body: { name: 'SERVICE_UNAVAILABLE' } });
    await flush();
    expect((await s.reader.get(PATH)).body).toEqual({ v: 1 });
    s.fake.waiting[2].resolve({ status: 404, body: {} });
    await flush();
    expect(s.cache.snapshot().map((e) => e.value.body)).toEqual([{ v: 1 }]);
    expect(unhandled).toEqual([]);
  });
});

describe('T088 4: 뒤에서 읽기도 서랍에 실제 호출 한 줄', () => {
  it('채우기 1줄 + 뒤에서 읽기 1줄, 지난 값을 준 것은 줄이 없다', async () => {
    let n = 0;
    const base: PayPalClient = {
      get: async () => ({ status: 200, body: { n: ++n } }),
      call: async () => ({ status: 201, body: {} }),
    };
    let clock = 0;
    const cache = createReadCache({ now: () => clock });
    const reader = cache.wrap(recordClient(base));
    await reader.get(PATH);
    clock += READ_CACHE_TTL_MS + 1;
    expect((await reader.get(PATH)).body).toEqual({ n: 1 });
    await flush();
    expect((await reader.get(PATH)).body).toEqual({ n: 2 });
    const rows = listActivity().filter((r) => r.path === PATH);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.cached === false)).toBe(true);
  });
});
