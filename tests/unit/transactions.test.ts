/**
 * 단위 테스트: 거래 조회 + 캐시 (T019). 실제 PayPal을 부르지 않는다 (가짜 `PayPalClient`만).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  MAX_RANGE_DAYS_TOTAL,
  TRANSACTIONS_PATH,
  TRANSACTION_CACHE_TTL_MS,
  buildTransactionsPath,
  createMemoryTransactionCache,
  fetchTransactions,
  getTransactions,
  lastDays,
  splitRange,
} from '@/paypal/transactions';
import type { TransactionRange } from '@/paypal/transactions';
import type { PayPalClient } from '@/types';

const FIXTURE = JSON.parse(
  readFileSync(path.resolve(__dirname, '../fixtures/transaction-search.json'), 'utf8'),
) as { pages: Record<string, unknown> };

/** 46일 → 조각 2개 (08-01~08-31, 09-01~09-15) */
const RANGE: TransactionRange = { startDate: '2026-08-01', endDate: '2026-09-15' };
const SHORT: TransactionRange = { startDate: '2026-08-01', endDate: '2026-08-02' };

type Reply = { status: number; body: unknown };

/** 쿼리의 start_date·page로 fixture 쪽을 고르는 가짜 클라이언트. */
function fixtureClient(override?: (path: string) => Reply | undefined) {
  const paths: string[] = [];
  const call = vi.fn(async () => {
    throw new Error('조회는 POST를 부르지 않는다');
  });
  const client: PayPalClient = {
    call,
    get: vi.fn(async (p: string) => {
      paths.push(p);
      const o = override?.(p);
      if (o !== undefined) return o;
      const q = new URL(`https://x.test${p}`).searchParams;
      const chunk = q.get('start_date')?.startsWith('2026-08-01') ? 'c1' : 'c2';
      const body = FIXTURE.pages[`${chunk}p${q.get('page')}`];
      return body === undefined ? { status: 404, body: null } : { status: 200, body };
    }),
  };
  return { client, paths, call };
}

function statusClient(status: number): PayPalClient {
  return { call: vi.fn(), get: vi.fn(async () => ({ status, body: null })) };
}

describe('splitRange / lastDays', () => {
  it('31일 이하는 조각 1개', () => {
    expect(splitRange({ startDate: '2026-08-01', endDate: '2026-08-31' })).toEqual([
      { startDate: '2026-08-01', endDate: '2026-08-31' },
    ]);
  });

  it('90일은 3조각, 겹치지 않고 처음과 끝이 입력과 같다', () => {
    const range = lastDays(Date.UTC(2026, 10, 10, 5), 90);
    expect(range).toEqual({ startDate: '2026-08-13', endDate: '2026-11-10' });
    const chunks = splitRange(range);
    expect(chunks).toHaveLength(3);
    expect(chunks[0].startDate).toBe(range.startDate);
    expect(chunks[2].endDate).toBe(range.endDate);
    for (let i = 1; i < chunks.length; i += 1) {
      const prevEnd = Date.parse(`${chunks[i - 1].endDate}T00:00:00Z`);
      expect(Date.parse(`${chunks[i].startDate}T00:00:00Z`) - prevEnd).toBe(86_400_000);
    }
  });

  it('달·윤년 경계를 지나도 맞다', () => {
    const chunks = splitRange({ startDate: '2028-01-20', endDate: '2028-03-10' });
    expect(chunks).toEqual([
      { startDate: '2028-01-20', endDate: '2028-02-19' },
      { startDate: '2028-02-20', endDate: '2028-03-10' },
    ]);
  });
});

describe('buildTransactionsPath', () => {
  it('ISO 꼴 기간, fields=all, page, page_size', () => {
    const p = buildTransactionsPath({ startDate: '2026-08-01', endDate: '2026-08-31' }, 2, 50);
    expect(p.startsWith(`${TRANSACTIONS_PATH}?`)).toBe(true);
    const q = new URL(`https://x.test${p}`).searchParams;
    expect(q.get('start_date')).toBe('2026-08-01T00:00:00+0000');
    expect(q.get('end_date')).toBe('2026-08-31T23:59:59+0000');
    expect(q.get('fields')).toBe('all');
    expect(q.get('page')).toBe('2');
    expect(q.get('page_size')).toBe('50');
    expect(p).not.toMatch(/\s/);
    expect(p).not.toContain('://');
  });

  it('기본 page_size 100, 501은 거부', () => {
    expect(buildTransactionsPath(SHORT, 1)).toContain('page_size=100');
    expect(() => buildTransactionsPath(SHORT, 1, 501)).toThrow();
    expect(() => buildTransactionsPath(SHORT, 1, 0)).toThrow();
  });
});

describe('fetchTransactions', () => {
  it('손으로 센 값과 같다 (2쪽 + 조각 2개, 환불·미완료·중복 처리)', async () => {
    const { client } = fixtureClient();
    const s = await fetchTransactions(client, RANGE);
    expect(s.source).toBe('paypal_transaction_search');
    expect(s.saleCount).toBe(5); // A1 A2 A5 A6 A7 (A2는 두 조각에 있지만 한 번)
    expect(s.refundCount).toBe(1); // A3
    expect(s.sales).toHaveLength(6);
    expect(s.byItem).toEqual([
      { itemName: 'Linen Shirt', orderCount: 2, units: 2 },
      { itemName: 'Sticker', orderCount: 2, units: 3 },
      { itemName: 'Wool Scarf', orderCount: 2, units: 4 },
    ]);
    expect(s.byCountry).toEqual([
      { countryCode: 'DE', orderCount: 1 },
      { countryCode: 'US', orderCount: 3 },
    ]);
    const ids = s.sales.map((r) => r.transactionId);
    expect(ids).not.toContain('FAKETX0000000000A3'); // 환불
    expect(ids).not.toContain('FAKETX0000000000A4'); // 상태 P
    expect(s.lastRefreshedAt).toBe('2026-09-16T00:30:00+0000'); // 더 이른 쪽
  });

  it('금액은 글자로 센트로 바꾸고 USD가 아니면 null, 날짜는 UTC', async () => {
    const { client } = fixtureClient();
    const s = await fetchTransactions(client, RANGE);
    const row = (id: string, item: string) => s.sales.find((r) => r.transactionId === id && r.itemName === item);
    expect(row('FAKETX0000000000A1', 'Linen Shirt')?.amountCents).toBe(4800);
    expect(row('FAKETX0000000000A2', 'Sticker')?.amountCents).toBe(10);
    expect(row('FAKETX0000000000A7', 'Sticker')?.amountCents).toBe(5); // 단일 품목 → 거래 금액 "0.05"
    expect(row('FAKETX0000000000A5', 'Wool Scarf')?.amountCents).toBeNull();
    expect(row('FAKETX0000000000A5', 'Wool Scarf')?.currency).toBe('EUR');
    expect(row('FAKETX0000000000A2', 'Sticker')?.date).toBe('2026-09-01'); // 08-31 23:30 -0700 → UTC 다음 날
    expect(row('FAKETX0000000000A7', 'Sticker')?.countryCode).toBeNull();
  });

  it('PayPal이 주지 않는 금액 꼴은 unexpected_response', async () => {
    const bad = (value: string) => ({
      total_pages: 1,
      transaction_details: [
        {
          transaction_info: {
            transaction_id: 'FAKETX9',
            transaction_initiation_date: '2026-08-03T10:15:00+0000',
            transaction_amount: { currency_code: 'USD', value },
            transaction_status: 'S',
          },
        },
      ],
    });
    for (const value of ['1,234.50', '12.345', 'abc', '']) {
      const { client } = fixtureClient(() => ({ status: 200, body: bad(value) }));
      const r = await getTransactions(client, SHORT, { now: () => 1, cache: createMemoryTransactionCache() });
      expect(r).toEqual({ ok: false, reason: 'unexpected_response' });
    }
  });

  it('필요한 칸이 틀리면 일부만 세지 않고 실패한다', async () => {
    const { client } = fixtureClient(() => ({ status: 200, body: { transaction_details: [{ transaction_info: {} }] } }));
    const r = await getTransactions(client, SHORT, { now: () => 1, cache: createMemoryTransactionCache() });
    expect(r).toEqual({ ok: false, reason: 'unexpected_response' });
  });

  it('GET만, 경로는 모두 /v1/reporting/transactions로 시작', async () => {
    const { client, paths, call } = fixtureClient();
    await fetchTransactions(client, RANGE);
    expect(paths).toHaveLength(3);
    expect(paths.every((p) => p.startsWith('/v1/reporting/transactions'))).toBe(true);
    expect(call).not.toHaveBeenCalled();
  });
});

describe('개인정보', () => {
  const PII = ['fake.buyer', 'Fakegiven', 'Fakesurname', '123 Fake Street', 'Faketown', 'FAKEPAYERID', '5550100', 'example.test'];

  it('요약 글자에 이름·이메일·주소·payer_id가 없다', async () => {
    const { client } = fixtureClient();
    const text = JSON.stringify(await fetchTransactions(client, RANGE));
    for (const needle of PII) expect(text).not.toContain(needle);
  });

  it('오류 결과·refreshFailed에도 없다', async () => {
    const cache = createMemoryTransactionCache();
    const { client } = fixtureClient();
    await getTransactions(client, RANGE, { now: () => 1000, cache });
    const failing: PayPalClient = {
      call: vi.fn(),
      get: vi.fn(async () => ({ status: 403, body: { name: 'fake.buyer@example.test' } })),
    };
    const stale = JSON.stringify(await getTransactions(failing, RANGE, { now: () => 1000 + TRANSACTION_CACHE_TTL_MS, cache }));
    const none = JSON.stringify(await getTransactions(failing, RANGE, { now: () => 5, cache: createMemoryTransactionCache() }));
    expect(stale).toContain('refreshFailed');
    for (const needle of PII) {
      expect(stale).not.toContain(needle);
      expect(none).not.toContain(needle);
    }
  });
});

describe('getTransactions 캐시', () => {
  it('첫 호출 cached:false, TTL 안 두 번째는 호출 0회 cached:true, fetchedAt은 첫 시각', async () => {
    const cache = createMemoryTransactionCache();
    const { client, paths } = fixtureClient();
    const t0 = Date.UTC(2026, 8, 16, 1, 0, 0);
    const first = await getTransactions(client, RANGE, { now: () => t0, cache });
    expect(first.ok && first.cached).toBe(false);
    expect(paths).toHaveLength(3);

    const second = await getTransactions(client, RANGE, { now: () => t0 + 60_000, cache });
    expect(paths).toHaveLength(3);
    expect(second).toMatchObject({ ok: true, cached: true, fetchedAt: new Date(t0).toISOString() });
    expect(second.ok && second.refreshFailed).toBeUndefined();
  });

  it('TTL이 지나면 다시 읽고, forceRefresh는 TTL 안에서도 다시 읽는다', async () => {
    const cache = createMemoryTransactionCache();
    const { client, paths } = fixtureClient();
    await getTransactions(client, RANGE, { now: () => 0, cache });
    await getTransactions(client, RANGE, { now: () => TRANSACTION_CACHE_TTL_MS, cache });
    expect(paths).toHaveLength(6);
    await getTransactions(client, RANGE, { now: () => TRANSACTION_CACHE_TTL_MS + 10, cache }, { forceRefresh: true });
    expect(paths).toHaveLength(9);
  });

  it('읽다 실패 + 옛 캐시 → cached:true + refreshFailed (401/403 not_permitted, 429 rate_limited, 그 밖 paypal_unavailable)', async () => {
    const cases: [number, string][] = [
      [401, 'not_permitted'],
      [403, 'not_permitted'],
      [429, 'rate_limited'],
      [500, 'paypal_unavailable'],
    ];
    for (const [status, reason] of cases) {
      const cache = createMemoryTransactionCache();
      const { client } = fixtureClient();
      await getTransactions(client, RANGE, { now: () => 0, cache });
      const r = await getTransactions(statusClient(status), RANGE, { now: () => TRANSACTION_CACHE_TTL_MS + 1, cache });
      expect(r).toMatchObject({ ok: true, cached: true, refreshFailed: reason, fetchedAt: new Date(0).toISOString() });
      const empty = await getTransactions(statusClient(status), RANGE, { now: () => 1, cache: createMemoryTransactionCache() });
      expect(empty).toEqual({ ok: false, reason });
    }
  });

  it('클라이언트가 상태 코드를 단 예외를 던져도 가른다', async () => {
    const throwing: PayPalClient = {
      call: vi.fn(),
      get: vi.fn(async () => {
        throw Object.assign(new Error('some message'), { status: 401 });
      }),
    };
    expect(await getTransactions(throwing, RANGE, { now: () => 1, cache: createMemoryTransactionCache() })).toEqual({
      ok: false,
      reason: 'not_permitted',
    });
    const net: PayPalClient = {
      call: vi.fn(),
      get: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    expect(await getTransactions(net, RANGE, { now: () => 1, cache: createMemoryTransactionCache() })).toEqual({
      ok: false,
      reason: 'paypal_unavailable',
    });
  });

  it('client === null: 호출 0회, 캐시 있으면 cached:true, 없으면 paypal_unavailable', async () => {
    const cache = createMemoryTransactionCache();
    expect(await getTransactions(null, RANGE, { now: () => 0, cache })).toEqual({ ok: false, reason: 'paypal_unavailable' });
    const { client } = fixtureClient();
    await getTransactions(client, RANGE, { now: () => 0, cache });
    expect(await getTransactions(null, RANGE, { now: () => 10, cache })).toMatchObject({ ok: true, cached: true });
  });

  it('잘못된 기간은 호출 0회로 invalid_range', async () => {
    const { client, paths } = fixtureClient();
    const deps = { now: () => 0, cache: createMemoryTransactionCache() };
    const tooLong = lastDays(Date.UTC(2026, 10, 10), MAX_RANGE_DAYS_TOTAL + 1);
    for (const range of [
      { startDate: '2026-09-02', endDate: '2026-09-01' },
      tooLong,
      { startDate: 'yesterday', endDate: '2026-09-01' },
      { startDate: '2026-02-30', endDate: '2026-03-01' },
    ]) {
      expect(await getTransactions(client, range, deps)).toEqual({ ok: false, reason: 'invalid_range' });
    }
    expect(paths).toHaveLength(0);
    // 93일은 기간 검사를 통과해 호출이 나간다 (404를 주는 가짜라 paypal_unavailable)
    const notFound = statusClient(404);
    const edge = await getTransactions(notFound, lastDays(Date.UTC(2026, 10, 10), MAX_RANGE_DAYS_TOTAL), deps);
    expect(edge).toEqual({ ok: false, reason: 'paypal_unavailable' });
    expect(notFound.get).toHaveBeenCalled();
  });
});
