/**
 * T064 단위 테스트: PayPal activity 기록기 + 서랍.
 *
 * 기대값 출처: `tasks/T064.md` "만들 것"·"완료 기준"·"2026-11-11 배분 메모".
 * **실호출 0회** — PayPal은 `fetch`를 바꿔 끼운 가짜(T070 테스트와 같은 꼴), LLM은 쓰지 않는다. `.env`를 읽지 않는다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildActivityView, type ActivityRecord } from '@/app/_shared/activity-view';
import { t } from '@/app/_shared/copy';
import { getDispute, listDisputes } from '@/paypal/disputes';
import { readTrackOrders } from '@/paypal/track-orders';
import { createMemoryTransactionCache, lastDays } from '@/paypal/transactions';
import type { ClientDeps } from '@/types';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { React?: typeof React }).React = React;

const activity = await import('@/app/_server/activity');
const { getPayPalClient } = await import('@/app/_server/paypal');
const { registerTrackingFromScreen } = await import('@/app/_server/tracking-register');
const { ActivityDrawer } = await import('@/app/_shared/activity-drawer');

const ROOT = path.resolve(__dirname, '../..');
const DETAIL_FIXTURE = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/dispute-detail.inquiry-waiting-seller.json'), 'utf8'));
const TRACK_ORDERS = readTrackOrders();
const orderId = (key: string) => {
  const found = TRACK_ORDERS.orders.find((o) => o.key === key);
  if (found === undefined) throw new Error(key);
  return found.orderId;
};
const UNTRACKED = [orderId('O05'), orderId('O07')];

const D1 = 'PP-R-MBJ-10197650';
const D2 = 'PP-R-GMS-10197661';
const D3 = 'PP-R-FYT-10197651';
const GAH = 'PP-R-GAH-10197649';
const HEY = 'PP-R-HEY-10197767';

/** 가짜 자격 증명 (글자만). */
const FAKE_PAYPAL = {
  PAYPAL_CLIENT_ID: 'test-client-id',
  PAYPAL_CLIENT_SECRET: 'test-client-secret',
  PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
};
const SWITCHES_ON = {
  AFTERLOOP_REAL_SEND: '1',
  AFTERLOOP_TRACK_LIVE: '1',
  AFTERLOOP_TRACK_LIVE_ORDERS: 'O05,O07',
  AFTERLOOP_TRACK_RECORDING: '1',
};
const RECORDING = { ...FAKE_PAYPAL, ...SWITCHES_ON, DEMO_MODE: 'recording' };
const PUBLIC = { ...FAKE_PAYPAL, ...SWITCHES_ON };

const LIST_FIXTURE = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/dispute-list.json'), 'utf8'));
/** 고정 목록의 첫 항목 꼴에 번호만 바꾼다 (구매자 이메일·이름이 들어 있다 — 기록에 들어가면 안 된다). */
const listItem = (id: string) => ({ ...LIST_FIXTURE.items[0], dispute_id: id });

const SECRET_WORDS = ['fake-access-token', 'test-client-secret', 'buyer@example.com', 'Test Buyer', 'TRK-SECRET', 'CAP-', '1 Main St'];

/** 가짜 `fetch`. 모든 요청을 센다. 응답 본문에는 일부러 개인정보 꼴 값을 넣는다 (기록에 들어가면 안 된다). */
function fakePayPalFetch() {
  const seen: { method: string; path: string }[] = [];
  const fetchFake = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    seen.push({ method, path: url.pathname });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v1/oauth2/token') return json(200, { access_token: 'fake-access-token', expires_in: 32400, token_type: 'Bearer' });
    if (url.pathname === '/v1/customer/disputes' && method === 'GET') {
      return json(200, { items: [D1, D2, D3, GAH, HEY].map(listItem), links: [] });
    }
    const dispute = url.pathname.match(/^\/v1\/customer\/disputes\/([^/]+)$/);
    if (method === 'GET' && dispute !== null) return json(200, { ...DETAIL_FIXTURE, dispute_id: decodeURIComponent(dispute[1]) });
    if (url.pathname === '/v1/reporting/transactions') {
      return json(200, {
        transaction_details: [1, 2, 3].map((n) => ({
          transaction_info: {
            transaction_id: `TX${n}`,
            transaction_event_code: 'T0006',
            transaction_status: 'S',
            transaction_initiation_date: '2026-11-01T10:00:00+0000',
            transaction_amount: { currency_code: 'USD', value: '48.00' },
          },
          payer_info: { email_address: 'buyer@example.com', country_code: 'US', payer_name: { alternate_full_name: 'Test Buyer' } },
          shipping_info: { address: { line1: '1 Main St' } },
          cart_info: { item_details: [{ item_name: 'Scarf', item_quantity: '1' }] },
        })),
        total_pages: 1,
        page: 1,
        last_refreshed_datetime: '2026-11-11T00:00:00+0000',
      });
    }
    const order = url.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)$/);
    if (method === 'GET' && order !== null) {
      const id = decodeURIComponent(order[1]);
      const trackers = UNTRACKED.includes(id) ? [] : [{ status: 'SHIPPED' }];
      return json(200, { id, purchase_units: [{ shipping: { trackers, address: { address_line_1: '1 Main St' } }, payments: { captures: [{ id: `CAP-${id}` }] } }] });
    }
    if (method === 'POST') return json(url.pathname.endsWith('/track') ? 201 : 200, { id: 'fake', tracking_number: 'TRK-SECRET' });
    return json(404, { name: 'RESOURCE_NOT_FOUND' });
  }) as typeof fetch;
  return { fetchFake, seen };
}

const fakeDeps = (fetchFake: typeof fetch): ClientDeps => ({ fetch: fetchFake, now: () => Date.now(), sleep: async () => {} });

function clientFor(env: Record<string, string>, fetchFake: typeof fetch) {
  const resolved = getPayPalClient(env, fakeDeps(fetchFake));
  if (!resolved.ok) throw new Error('client');
  return resolved.client;
}

const NOW = Date.parse('2026-11-11T20:00:00Z');
let tick = 0;

beforeEach(() => {
  tick = 0;
  activity.resetActivityForTest(() => NOW + 1000 * tick++);
});

/** 녹화 순서: 분쟁 목록(+상세) → 거래 조회 → 거래 조회(캐시) → 추적 등록 2건 → 서연 send-message. */
async function recordingRun() {
  const paypal = fakePayPalFetch();
  const client = clientFor(RECORDING, paypal.fetchFake);
  const shown = (await listDisputes(client)).map((d) => d.dispute_id).filter((id) => [D1, D2, D3].includes(id));
  for (const id of shown) await getDispute(client, id);

  const cache = createMemoryTransactionCache();
  const range = lastDays(NOW, 30);
  const first = await activity.getTransactionsRecorded(client, range, { now: () => NOW, cache });
  const second = await activity.getTransactionsRecorded(client, range, { now: () => NOW + 60_000, cache });

  const tracked = await registerTrackingFromScreen({ paypal: { ok: true, client }, env: RECORDING });

  // 실제 전송 직전 다시 읽기 + send-message (send.ts의 실제 전송과 같은 클라이언트)
  await getDispute(client, D2);
  await client.call({ method: 'POST', path: `/v1/customer/disputes/${D2}/send-message`, requestId: 'req-1', body: { message: 'Hi Seo-yeon at 1 Main St' } });
  return { paypal, first, second, tracked };
}

describe('T064 1: 녹화 순서', () => {
  it('최신 순으로 Send message 200 · Add tracking 201 ×2 · … · Read sales 200 cached · Read sales 200 · Read cases 200', async () => {
    const run = await recordingRun();
    expect(run.first).toMatchObject({ ok: true, cached: false });
    expect(run.second).toMatchObject({ ok: true, cached: true });
    expect(run.tracked.kind).toBe('added');

    const view = buildActivityView(activity.listActivity(), 'America/New_York');
    const brief = view.rows.map((r) => `${r.title} ${r.badge}${r.cached ? ' cached' : ''}`);
    // 위에서부터 (추적 등록 앞의 주문 확인 읽기는 한 줄로 접혀 Add tracking 아래에 남는다)
    expect(brief).toEqual([
      'Send message 200',
      'Add tracking 201',
      'Add tracking 201',
      'Read order 200',
      'Read sales 200 cached',
      'Read sales 200',
      'Read your open cases 200',
    ]);
    expect(view.rows[0].request).toBe(`POST /v1/customer/disputes/${D2}/send-message`);
    expect(view.rows[1].summary).toBe('O07');
    expect(view.rows[2].summary).toBe('O05');
    expect(view.rows[4].summary).toBe(t('activity.summary.transactions', { count: 3 }));
    expect(view.rows[5].request).toBe('GET /v1/reporting/transactions');
    expect(view.rows[6].summary).toBe(t('activity.summary.cases', { count: 3 }));
    expect(view.rows[6].calls).toBe(4); // 목록 1 + 상세 3
    expect(view.rows.every((r) => r.tone === 'ok')).toBe(true);

    // 건수 = 보이는 기록 수
    expect(view.count).toBe(activity.listActivity().length);
    expect(view.count).toBe(view.rows.reduce((s, r) => s + r.calls, 0));
  });

  it('시각은 판매자 시간대로 적는다', async () => {
    activity.recordCall({ method: 'GET', path: '/v1/customer/disputes', status: 200, body: { items: [] } });
    const [row] = buildActivityView(activity.listActivity(), 'America/New_York').rows;
    expect(row.time).toBe('3:00:00 PM'); // 20:00Z = 15:00 EST
  });

  it('최근 50개만, 최신이 앞', () => {
    for (let i = 0; i < 60; i += 1) activity.recordCall({ method: 'GET', path: `/v2/checkout/orders/${orderId('O05')}`, status: 200 });
    const list = activity.listActivity();
    expect(list).toHaveLength(activity.ACTIVITY_MAX);
    expect(list[0].id).toBe('a60');
  });
});

describe('T064 2: 기록에 본문·토큰·쿼리 문자열·개인정보가 없다', () => {
  it('기록 객체의 칸은 정해진 것뿐이고, 비밀값·개인정보 글자가 없다', async () => {
    const run = await recordingRun();
    const records = activity.listActivity();
    const allowed = new Set(['id', 'at', 'method', 'path', 'title', 'shortId', 'status', 'summary', 'cached', 'simulated']);
    for (const record of records) for (const key of Object.keys(record)) expect(allowed.has(key), key).toBe(true);
    const text = JSON.stringify(records) + JSON.stringify(buildActivityView(records));
    for (const word of SECRET_WORDS) expect(text, word).not.toContain(word);
    expect(text).not.toContain('?');
    expect(text).not.toMatch(/@/);
    // 실제로는 쿼리 문자열이 붙은 요청이 나갔다 (분쟁 목록·거래 조회)
    expect(run.paypal.seen.some((s) => s.path === '/v1/reporting/transactions')).toBe(true);
    for (const record of records) expect(record.path).toMatch(/^\/[A-Za-z0-9/_.~%-]*$/);
  });

  it('전체 주소·쿼리·조각이 붙어 와도 경로만 남는다', () => {
    activity.recordCall({ method: 'GET', path: 'https://api-m.sandbox.paypal.com/v1/customer/disputes?page_size=50&next_page_token=abc#x', status: 200 });
    expect(activity.listActivity()[0].path).toBe('/v1/customer/disputes');
  });
});

describe('T064 3: 연습용(HEY·O04)·시연 제외(GAH)는 보이지 않는다', () => {
  it('HEY·GAH 상세, O04 주문 경로는 남기지 않는다. 목록 요약은 보이는 분쟁만 센다', async () => {
    const paypal = fakePayPalFetch();
    const client = clientFor(RECORDING, paypal.fetchFake);
    await listDisputes(client);
    await getDispute(client, HEY);
    await getDispute(client, GAH);
    await client.get(`/v2/checkout/orders/${orderId('O04')}`);
    await client.call({ method: 'POST', path: `/v1/customer/disputes/${HEY}/send-message`, requestId: 'r', body: {} });

    const records = activity.listActivity();
    expect(records).toHaveLength(1);
    expect(records[0].summary).toEqual({ kind: 'cases', count: 3 });
    const text = JSON.stringify(records);
    for (const word of ['HEY', 'GAH', orderId('O04')]) expect(text).not.toContain(word);
    // 호출은 실제로 나갔다 (기록만 안 한다)
    expect(paypal.seen.filter((s) => s.path.includes(HEY)).length).toBe(2);
  });

  it('서연 주문(O01)·화면 분쟁 주문은 숨기지 않는다', () => {
    expect(activity.isHiddenPath(`/v2/checkout/orders/${orderId('O01')}`)).toBe(false);
    expect(activity.isHiddenPath(`/v2/checkout/orders/${orderId('O13')}`)).toBe(false);
    expect(activity.isHiddenPath(`/v1/customer/disputes/${D2}`)).toBe(false);
  });
});

describe('T064 4: 가짜 전송은 실제 기록(200)으로 보이지 않는다', () => {
  it('public: 관문이 막은 쓰기는 "Simulated · not sent", 응답 코드 없음. PayPal 쓰기 0회', async () => {
    const paypal = fakePayPalFetch();
    const client = clientFor(PUBLIC, paypal.fetchFake);
    const res = await client.call({ method: 'POST', path: `/v1/customer/disputes/${D2}/send-message`, requestId: 'r', body: {} });
    expect(res.status).toBe(200); // T070 관문 동작 그대로
    expect(paypal.seen.filter((s) => s.method === 'POST')).toHaveLength(0);

    const [record] = activity.listActivity();
    expect(record).toMatchObject({ title: 'sendMessage', status: null, simulated: true });
    const [row] = buildActivityView(activity.listActivity()).rows;
    expect(row.badge).toBe(t('activity.simulated'));
    expect(row.badge).not.toMatch(/^\d/);
    expect(row.tone).toBe('none');
  });

  it('public 추적 등록(dry run): POST가 없으니 Add tracking 줄이 없다', async () => {
    const paypal = fakePayPalFetch();
    const outcome = await registerTrackingFromScreen({ paypal: getPayPalClient(PUBLIC, fakeDeps(paypal.fetchFake)), env: PUBLIC });
    expect(outcome.kind).toBe('simulated');
    expect(activity.listActivity().some((r) => r.title === 'addTracking' && !r.simulated)).toBe(false);
  });

  it('스위치 꺼짐 보내기(send.ts 가짜 호출기)는 simulated로 남는다', async () => {
    const call = activity.recordCaller(async () => ({ status: 200, body: { simulated: true } }), { simulated: true });
    await call({ method: 'POST', path: `/v1/customer/disputes/${D2}/send-message`, requestId: 'r', body: {} });
    expect(activity.listActivity()[0]).toMatchObject({ status: null, simulated: true });
    const send = readFileSync(path.join(ROOT, 'src/app/_server/send.ts'), 'utf8');
    expect(send).toMatch(/const SIMULATED_CALLER: PayPalCaller = recordCaller\(createSimulatedCaller\(\), \{ simulated: true \}\)/);
  });

  it('recording의 실제 쓰기는 받은 응답 코드 그대로', async () => {
    const paypal = fakePayPalFetch();
    const client = clientFor(RECORDING, paypal.fetchFake);
    await client.call({ method: 'POST', path: `/v1/customer/disputes/${D1}/make-offer`, requestId: 'r', body: {} });
    expect(activity.listActivity()[0]).toMatchObject({ title: 'sendOffer', status: 200, simulated: false });
  });
});

describe('T064 5: 토큰 발급은 기록하지 않는다', () => {
  it('클라이언트 안의 토큰 발급이 기록에 없고, 직접 넣어도 남지 않는다', async () => {
    const run = await recordingRun();
    expect(run.paypal.seen.some((s) => s.path === '/v1/oauth2/token')).toBe(true);
    expect(activity.listActivity().some((r) => r.path.includes('oauth2'))).toBe(false);
    activity.recordCall({ method: 'POST', path: '/v1/oauth2/token', status: 200 });
    expect(activity.listActivity().some((r) => r.path.includes('oauth2'))).toBe(false);
  });
});

describe('T064 6: 위쪽 막대 건수 = 기록 수, 서랍 줄', () => {
  it('버튼 건수는 줄의 호출 수 합 (= 기록 수)', async () => {
    await recordingRun();
    const view = buildActivityView(activity.listActivity());
    const html = renderToStaticMarkup(createElement(ActivityDrawer, { records: view.rows }));
    expect(html).toMatch(new RegExp(`class="shell-count num"[^>]*>${activity.listActivity().length}<`));
  });

  it('제목 표: 경로 꼴 → 문구', () => {
    expect(activity.classify('GET', '/v1/customer/disputes').title).toBe('readCases');
    expect(activity.classify('GET', `/v1/customer/disputes/${D2}`)).toEqual({ title: 'readCase', shortId: 'GMS-10197661' });
    expect(activity.classify('POST', `/v1/customer/disputes/${D2}/send-message`).title).toBe('sendMessage');
    expect(activity.classify('POST', `/v1/customer/disputes/${D2}/make-offer`).title).toBe('sendOffer');
    expect(activity.classify('POST', '/v2/checkout/orders/X/track').title).toBe('addTracking');
    expect(activity.classify('GET', '/v2/checkout/orders/X').title).toBe('readOrder');
    expect(activity.classify('GET', '/v1/reporting/transactions').title).toBe('readSales');
    expect(t('activity.title.sendMessage')).toBe('Send message');
    expect(t('activity.title.addTracking')).toBe('Add tracking');
    expect(t('activity.title.readSales')).toBe('Read sales');
    expect(t('activity.title.readCases')).toBe('Read your open cases');
    expect(t('shell.drawer.note')).toBe('Every call AfterLoop makes on your behalf. Sandbox.');
  });

  it('응답 코드 배지: 2xx는 ok, 그 밖·응답 없음은 bad', () => {
    activity.recordCall({ method: 'GET', path: '/v1/reporting/transactions', status: 403 });
    activity.recordCall({ method: 'GET', path: '/v1/customer/disputes', status: null });
    const rows = buildActivityView(activity.listActivity()).rows;
    expect(rows.map((r) => [r.badge, r.tone])).toEqual([
      [t('activity.noResponse'), 'bad'],
      ['403', 'bad'],
    ]);
  });

  it('줄 그리기: 제목·배지·METHOD /path(고정폭)·cached 표시', () => {
    const records: ActivityRecord[] = [
      { id: 'a2', at: '2026-11-11T20:00:00Z', method: 'GET', path: '/v1/reporting/transactions', title: 'readSales', status: 200, summary: { kind: 'transactions', count: 3 }, cached: true, simulated: false },
    ];
    const view = buildActivityView(records);
    const code = readFileSync(path.join(ROOT, 'src/app/_shared/activity-drawer.tsx'), 'utf8');
    expect(code).toMatch(/<code className="activity-request">/);
    expect(code).toContain('loadActivityView');
    expect(view.rows[0]).toMatchObject({ title: 'Read sales', badge: '200', cached: true, request: 'GET /v1/reporting/transactions' });
  });
});

describe('T064 7: 연결 — 앱의 PayPal 클라이언트가 기록기를 지난다', () => {
  it('getPayPalClient가 관문 바깥에서 recordClient로 감싼다', () => {
    const code = readFileSync(path.join(ROOT, 'src/app/_server/paypal.ts'), 'utf8');
    expect(code).toMatch(/recordClient\(gated\)/);
    expect(code).toMatch(/resolveDemoMode\(env\) === 'recording' \? client : blockWrites\(client\)/);
  });
});
