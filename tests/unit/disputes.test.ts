/**
 * 단위 테스트: 분쟁 목록·상세 조회 (T003, SPEC v2.2 9-4장)
 *
 * 실제 PayPal을 부르지 않는다. `PayPalClient`를 가짜로 끼우고, 한 곳에서만 실제 클라이언트
 * (`createPayPalClient`)에 가짜 `fetch`·`now`·`sleep`을 넣어 만든 경로가 path 검사를 지나는지 본다.
 * 가짜 `sleep`은 가짜 시계를 함께 옮긴다 (분당 30회 제한에서 테스트가 멈추지 않게).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createPayPalClient } from '@/paypal/client';
import {
  MAX_PAGES,
  buildListPath,
  getDispute,
  listDisputes,
  nextPath,
  parseDisputeDetail,
} from '@/paypal/disputes';
import type { ClientDeps, PayPalClient, PayPalEnv } from '@/types';

const BASE = 'https://api-m.sandbox.paypal.com';

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.resolve(__dirname, `../fixtures/${name}`), 'utf8')) as Record<string, unknown>;

const LIST = fixture('dispute-list.json');
const DETAIL = fixture('dispute-detail.inquiry-waiting-seller.json');

type Reply = { status: number; body: unknown };

/** 가짜 `PayPalClient`. `get`에 들어온 경로를 기록하고 큐의 응답을 순서대로 돌려준다. */
function fakeClient(replies: Reply[]) {
  const paths: string[] = [];
  const client: PayPalClient = {
    call: vi.fn(async () => {
      throw new Error('조회 작업은 POST를 부르지 않는다');
    }),
    get: vi.fn(async (p: string) => {
      paths.push(p);
      const reply = replies[Math.min(paths.length - 1, replies.length - 1)];
      return { status: reply.status, body: reply.body };
    }),
  };
  return { client, paths };
}

const ok = (body: unknown): Reply => ({ status: 200, body });

/** `links`를 바꿔 끼운 목록 응답. */
const listPage = (items: unknown[], links: { rel: string; href?: string }[] = []) => ({ items, links });

const nextLink = (href: string) => ({ rel: 'next', href, method: 'GET' });

/** 던진 에러를 받아 돌려준다 (안 던지면 테스트 실패). */
async function caught(p: Promise<unknown>): Promise<Error> {
  try {
    await p;
  } catch (e) {
    return e as Error;
  }
  throw new Error('예외가 나야 하는데 나지 않음');
}

describe('listDisputes: 경로와 쿼리', () => {
  it('기본 경로는 "/"로 시작하고 page_size를 담는다', async () => {
    const h = fakeClient([ok(LIST)]);
    await listDisputes(h.client);

    expect(h.paths).toHaveLength(1);
    expect(h.paths[0].startsWith('/v1/customer/disputes?')).toBe(true);
    expect(h.paths[0]).toContain('page_size=50');
  });

  it('쿼리 값을 퍼센트 인코딩한다 (공백·콜론·쉼표가 날것으로 나가지 않는다)', () => {
    const p = buildListPath({
      pageSize: 10,
      disputeState: ['REQUIRED_ACTION', 'UNDER_REVIEW'],
      startTime: '2026-11-01T00:00:00Z',
      disputedTransactionId: '0YA 47116',
    });

    expect(p.startsWith('/v1/customer/disputes?')).toBe(true);
    expect(p).toContain('page_size=10');
    expect(p).toContain('dispute_state=REQUIRED_ACTION%2CUNDER_REVIEW');
    expect(p).toContain('start_time=2026-11-01T00%3A00%3A00Z');
    expect(p).toContain('disputed_transaction_id=0YA+47116');
    // 클라이언트의 path 검사가 막는 문자들 (T002 재검증 의견 5)
    expect(p).not.toMatch(/[\s\\\u0000-\u001f\u007f]/);
    expect(p).not.toContain('://');
  });

  it('pageSize가 1~50의 정수가 아니면 호출 전에 예외', async () => {
    for (const pageSize of [0, -1, 51, 1.5, Number.NaN]) {
      const h = fakeClient([ok(LIST)]);
      await expect(listDisputes(h.client, { pageSize })).rejects.toThrow(/pageSize/);
      expect(h.paths).toHaveLength(0);
    }
  });
});

describe('listDisputes: 쪽 넘기기', () => {
  it('next 링크를 따라 2쪽을 이어 읽는다', async () => {
    const page2Path = '/v1/customer/disputes?page_size=50&next_page_token=TOKEN2';
    const second = { ...(LIST.items as unknown[])[0] as Record<string, unknown>, dispute_id: 'PP-R-XWI-10197380' };
    const h = fakeClient([
      ok(listPage(LIST.items as unknown[], [nextLink(`${BASE}${page2Path}`)])),
      ok(listPage([second])),
    ]);

    const items = await listDisputes(h.client);

    expect(items.map((d) => d.dispute_id)).toEqual(['PP-R-XWI-10197379', 'PP-R-XWI-10197380']);
    expect(h.paths).toHaveLength(2);
    expect(h.paths[1]).toBe(page2Path);
  });

  it('next가 없으면 한 쪽만 읽는다', async () => {
    const h = fakeClient([ok(LIST)]);
    expect(await listDisputes(h.client)).toHaveLength(1);
    expect(h.paths).toHaveLength(1);
  });

  it('next가 샌드박스를 벗어나면 예외 (그 쪽은 부르지 않는다)', async () => {
    const h = fakeClient([ok(listPage(LIST.items as unknown[], [nextLink('https://evil.example/v1/customer/disputes')]))]);
    const err = await caught(listDisputes(h.client));

    expect(err.message).toContain('샌드박스');
    expect(h.paths).toHaveLength(1);
  });

  it('next가 해석할 수 없는 주소면 예외', async () => {
    const h = fakeClient([ok(listPage(LIST.items as unknown[], [nextLink('not a url')]))]);
    await expect(listDisputes(h.client)).rejects.toThrow(/다음 쪽 링크/);
  });

  it('next가 지금 쪽을 다시 가리키면 멈춘다 (제자리 돌기)', async () => {
    const self = `${BASE}/v1/customer/disputes?page_size=50`;
    const h = fakeClient([ok(listPage(LIST.items as unknown[], [nextLink(self)]))]);

    expect(await listDisputes(h.client)).toHaveLength(1);
    expect(h.paths).toHaveLength(1);
  });

  it('next가 끝없이 이어져도 MAX_PAGES쪽에서 멈춘다', async () => {
    let n = 0;
    const client: PayPalClient = {
      call: vi.fn(async () => ({ status: 200, body: null })),
      get: vi.fn(async () => {
        n += 1;
        return { status: 200, body: listPage([], [nextLink(`${BASE}/v1/customer/disputes?p=${n}`)]) };
      }),
    };

    expect(await listDisputes(client)).toEqual([]);
    expect(n).toBe(MAX_PAGES);
  });
});

describe('listDisputes: 응답 검증', () => {
  it('200이 아니면 예외 (본문은 싣지 않는다)', async () => {
    const h = fakeClient([{ status: 403, body: { name: 'NOT_AUTHORIZED', message: 'buyer@example.com' } }]);
    const err = await caught(listDisputes(h.client));

    expect(err.message).toContain('403');
    expect(err.message).not.toContain('buyer@example.com');
  });

  it('필수 필드가 없으면 어떤 필드인지 알 수 있는 예외 (값은 싣지 않는다)', async () => {
    const broken = { ...(LIST.items as unknown[])[0] as Record<string, unknown> };
    delete broken.dispute_amount;
    const h = fakeClient([ok(listPage([broken]))]);
    const err = await caught(listDisputes(h.client));

    expect(err.message).toContain('items.0.dispute_amount');
    expect(err.message).not.toContain('BUYERPAYERID01');
    expect(err.message).not.toContain('buyer@example.com');
  });

  it('items가 없는 응답은 빈 배열', async () => {
    const h = fakeClient([ok({ links: [] })]);
    expect(await listDisputes(h.client)).toEqual([]);
  });

  it('모르는 필드와 구매자 개인정보는 버린다 (payer_id만 남는다)', async () => {
    const h = fakeClient([ok(LIST)]);
    const [item] = await listDisputes(h.client);
    const text = JSON.stringify(item);

    expect(text).not.toContain('buyer@example.com');
    expect(text).not.toContain('Test Buyer');
    expect(text).not.toContain('seller@example.com');
    expect(item.disputed_transactions[0].buyer?.payer_id).toBe('BUYERPAYERID01');
  });
});

describe('getDispute', () => {
  it('경로는 /v1/customer/disputes/{id}이고 검증한 상세를 돌려준다', async () => {
    const h = fakeClient([ok(DETAIL)]);
    const detail = await getDispute(h.client, 'PP-R-XWI-10197379');

    expect(h.paths).toEqual(['/v1/customer/disputes/PP-R-XWI-10197379']);
    expect(detail.dispute_id).toBe('PP-R-XWI-10197379');
    expect(detail.dispute_amount).toEqual({ currency_code: 'USD', value: '48.00' });
  });

  it.each([
    ['상대 경로 올라가기', '../x'],
    ['공백', ' '],
    ['쿼리 붙이기', 'PP-1?x=1'],
    ['빈 문자열', ''],
    ['소문자', 'pp-1'],
    ['PP- 없음', 'D1'],
    ['슬래시', 'PP-1/x'],
    ['줄바꿈', 'PP-1\n'],
    ['퍼센트 인코딩', 'PP-1%2F..'],
  ])('이상한 ID(%s)는 호출 0회로 예외', async (_label, id) => {
    const h = fakeClient([ok(DETAIL)]);
    await expect(getDispute(h.client, id)).rejects.toThrow(/분쟁 ID/);
    expect(h.paths).toHaveLength(0);
  });

  it('예외 문구에 받은 ID 값을 싣지 않는다 (비밀값이 섞여 올 수 있다)', async () => {
    const h = fakeClient([ok(DETAIL)]);
    const err = await caught(getDispute(h.client, 'PP-1?secret=LEAK-ME-NOT'));

    expect(err.message).not.toContain('LEAK-ME-NOT');
    expect(h.paths).toHaveLength(0);
  });

  it('200이 아니면 예외 (본문은 싣지 않는다)', async () => {
    const h = fakeClient([{ status: 404, body: { message: 'Test Buyer' } }]);
    const err = await caught(getDispute(h.client, 'PP-R-XWI-10197379'));

    expect(err.message).toContain('404');
    expect(err.message).not.toContain('Test Buyer');
  });

  it('상세 응답에서도 구매자 이름·이메일·주소는 버린다 (메시지 원문만 남는다)', async () => {
    const h = fakeClient([ok(DETAIL)]);
    const detail = await getDispute(h.client, 'PP-R-XWI-10197379');
    const text = JSON.stringify(detail);

    expect(text).not.toContain('buyer@example.com');
    expect(text).not.toContain('Test Buyer');
    expect(detail.messages[0].content).toBe('Color and size differ from listing');
  });
});

describe('parseDisputeDetail · nextPath', () => {
  it('단계·채널은 문자열로 받아 둔다 (아는 값인지는 mapper가 본다)', () => {
    const detail = parseDisputeDetail({ ...DETAIL, dispute_life_cycle_stage: 'SOMETHING_NEW' });
    expect(detail.dispute_life_cycle_stage).toBe('SOMETHING_NEW');
  });

  it('links·disputed_transactions·messages가 없으면 빈 배열', () => {
    const detail = parseDisputeDetail({
      dispute_id: 'PP-X-1',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      dispute_life_cycle_stage: 'INQUIRY',
      dispute_channel: 'INTERNAL',
      dispute_amount: { currency_code: 'USD', value: '10.00' },
    });
    expect(detail.links).toEqual([]);
    expect(detail.disputed_transactions).toEqual([]);
    expect(detail.messages).toEqual([]);
  });

  it('next가 없거나 href가 비면 null', () => {
    expect(nextPath([])).toBeNull();
    expect(nextPath([{ rel: 'self', href: `${BASE}/v1/customer/disputes` }])).toBeNull();
    expect(nextPath([{ rel: 'next', href: '' }])).toBeNull();
  });
});

// ── 실제 클라이언트와 맞물리는지 (가짜 fetch·시계) ──────────────────────────────
describe('만든 경로가 클라이언트의 path 검사를 지난다', () => {
  const ENV: PayPalEnv = { clientId: 'unit-id', clientSecret: 'unit-SECRET-must-not-leak', baseUrl: BASE };

  function harness(bodies: unknown[]) {
    let clock = 1_700_000_000_000;
    const urls: string[] = [];
    const logs: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `${BASE}/v1/oauth2/token`) {
        return new Response(JSON.stringify({ access_token: 'unit-TOKEN', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      urls.push(url);
      const body = bodies[Math.min(urls.length - 1, bodies.length - 1)];
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const deps: ClientDeps = {
      fetch: fetchMock as unknown as typeof fetch,
      now: () => clock,
      sleep: async (ms: number) => {
        clock += ms; // 가짜 시계도 함께 옮긴다
      },
      log: (line) => logs.push(line),
    };
    return { deps, urls, logs };
  }

  it('listDisputes의 쿼리와 getDispute의 ID가 그대로 샌드박스로 나간다', async () => {
    const h = harness([listPage(LIST.items as unknown[]), DETAIL]);
    const client = createPayPalClient(ENV, h.deps);

    const items = await listDisputes(client, { pageSize: 10, disputeState: ['REQUIRED_ACTION'], startTime: '2026-11-01T00:00:00Z' });
    const detail = await getDispute(client, 'PP-R-XWI-10197379');

    expect(items).toHaveLength(1);
    expect(detail.dispute_id).toBe('PP-R-XWI-10197379');
    expect(h.urls[0]).toBe(
      `${BASE}/v1/customer/disputes?page_size=10&dispute_state=REQUIRED_ACTION&start_time=2026-11-01T00%3A00%3A00Z`,
    );
    expect(h.urls[1]).toBe(`${BASE}/v1/customer/disputes/PP-R-XWI-10197379`);
    // 로그에 쿼리·본문·비밀값이 남지 않는다
    for (const line of h.logs) {
      expect(line).not.toContain('start_time');
      expect(line).not.toContain('unit-SECRET-must-not-leak');
      expect(line).not.toContain('buyer@example.com');
    }
  });

  it('이어 읽는 쪽의 경로도 path 검사를 지난다', async () => {
    const page2 = '/v1/customer/disputes?page_size=50&next_page_token=T2';
    const h = harness([listPage([], [nextLink(`${BASE}${page2}`)]), listPage([])]);
    const client = createPayPalClient(ENV, h.deps);

    await listDisputes(client);

    expect(h.urls).toHaveLength(2);
    expect(h.urls[1]).toBe(`${BASE}${page2}`);
  });
});
