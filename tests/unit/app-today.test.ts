/**
 * T060 단위 테스트: 공용 틀 (위쪽 막대 · Today 목록 · 추적 항목 · 서랍 · 옛 주소 이동).
 *
 * 기대값 출처: `tasks/T060.md` "완료 기준"과 "재시도" 절 (Prevent = 줄어드는 비율 1등, 이름 규칙),
 * SPEC v2.10 2장. **실호출 0회** — 분쟁은 손으로 만든 `LoadedDispute`, PayPal은 `get`만 답하는 가짜 호출기.
 * 숫자 기대값은 적어 두지 않고 엔진 결과와 같은지로 본다 ($717 · $253은 지금 값의 확인용으로만).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { loadReplyNames } from '@/ai/names';
import { ActivityDrawer } from '@/app/_shared/activity-drawer';
import { AutopilotToggle } from '@/app/_shared/autopilot-toggle';
import { copyKeys, copyTables, t } from '@/app/_shared/copy';
import type { LoadedDispute } from '@/app/_shared/dispute-view';
import { toDollarsRounded } from '@/app/_shared/money';
import { NAV_ITEMS, sellerChip } from '@/app/_shared/nav-items';
import {
  TRACKING_ITEM_ID,
  buildToday,
  buyerShortName,
  dateLine,
  daysUntil,
  ordinal,
  selectItem,
  type TodayItem,
  type TrackingSummary,
} from '@/app/today/model';
import { summarizeTracking } from '@/app/today/tracking';
import { TodayList } from '@/app/today/today-list';
import { TrackingDetail } from '@/app/today/tracking-detail';
import { FIX_ORDER } from '@/engine/sim';
import { pickPreventProduct, simulateStore } from '@/engine/storefront';
import type { BoardState, Cause, EscalationSignals, PayPalClient, SeedBuyer, SeedProduct, Subtype } from '@/types';

import manifestJson from '../sandbox/manifest.json';
import { seedBuyers, seedDisputes, seedOrders, seedProducts } from '../../seed/index';

// next/link는 라우터 없이도 <a>로 그려진다. usePathname은 쓰지 않는 컴포넌트만 그린다.
vi.mock('server-only', () => ({}));
(globalThis as { React?: typeof React }).React = React;

const ROOT = path.resolve(__dirname, '../..');
const NOW = new Date('2026-11-10T17:00:00.000Z'); // 뉴욕 11/10 낮

const D1 = 'PP-R-MBJ-10197650';
const D2 = 'PP-R-GMS-10197661';
const D3 = 'PP-R-FYT-10197651';

// ── 손으로 만든 분쟁 (loadDemoDisputes의 결과 모양) ──────────────────────────

const buyer = (id: string): SeedBuyer => seedBuyers.find((b) => b.id === id) as SeedBuyer;
const product = (sku: string): SeedProduct => seedProducts.find((p) => p.sku === sku) as SeedProduct;

const cause = (subtype: Subtype): Cause => ({ subtype, confidence: 1, evidence: [], needsReview: false, source: 'rule' });

function board(spec: Partial<BoardState> & { disputeId: string; subtype: Subtype }): BoardState {
  const { subtype, ...rest } = spec;
  return {
    reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    stage: 'INQUIRY',
    channel: 'INTERNAL',
    dueDate: '2026-11-30T00:37:00.000Z',
    amountCents: 4800,
    currency: 'USD',
    allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
    hasTracking: false,
    hasDeliveredTracking: false,
    buyerPriorInrDisputes: 0,
    isDemo: false,
    cause: cause(subtype),
    ...rest,
  };
}

const quiet: EscalationSignals = {
  mentionsCardCompany: false,
  secondMessageUnanswered: false,
  unansweredOver24h: false,
  angryTone: false,
  hoursToDue: 400,
};

function loaded(spec: {
  disputeId: string;
  buyerId: string;
  sku: string;
  boardReal: BoardState;
  boardDemo?: BoardState | null;
  signals?: EscalationSignals | null;
}): LoadedDispute {
  return {
    key: spec.disputeId,
    disputeId: spec.disputeId,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyer: buyer(spec.buyerId),
    product: product(spec.sku),
    buyerMessages: [],
    boardReal: spec.boardReal,
    boardDemo: spec.boardDemo ?? null,
    demoFields: [],
    carrierEvents: [],
    signals: spec.signals === undefined ? quiet : spec.signals,
    signalsAfterReply: null,
    liveSendAllowed: false,
  };
}

/** 지금 시연 데이터와 같은 모양: 지호(색상, D1) → 서연(통관, D2) → Mike(반복 미수령, D3) 순서로 받는다. */
function demoDisputes(): LoadedDispute[] {
  return [
    loaded({
      disputeId: D1,
      buyerId: 'B02',
      sku: 'FK-CD-OAT',
      boardReal: board({ disputeId: D1, subtype: 'B1', reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' }),
      signals: { ...quiet, unansweredOver24h: true },
    }),
    loaded({
      disputeId: D2,
      buyerId: 'B01',
      sku: 'FK-SW-NV',
      boardReal: board({ disputeId: D2, subtype: 'A1', amountCents: 7400 }),
      boardDemo: board({ disputeId: D2, subtype: 'A2', amountCents: 7400, hasTracking: true, isDemo: true }),
      signals: { ...quiet, mentionsCardCompany: true, secondMessageUnanswered: true },
    }),
    loaded({
      disputeId: D3,
      buyerId: 'B04',
      sku: 'FK-BN-SET',
      boardReal: board({ disputeId: D3, subtype: 'F1', stage: 'CHARGEBACK', allowedMoves: ['accept_claim'] }),
      boardDemo: board({
        disputeId: D3,
        subtype: 'F1',
        stage: 'CHARGEBACK',
        allowedMoves: ['accept_claim'],
        buyerPriorInrDisputes: 2,
        hasTracking: true,
        hasDeliveredTracking: true,
        isDemo: true,
      }),
    }),
  ];
}

const TRACKING: TrackingSummary = {
  untracked: [
    { key: 'O05', buyerName: 'Yuki T.', productName: 'Beanie + Scarf Set' },
    { key: 'O07', buyerName: 'Lena K.', productName: 'Knit Cardigan, Oat' },
  ],
  excluded: [{ key: 'O02', buyerName: 'Ji-ho', productName: 'Knit Cardigan, Oat' }],
};

const today = (tracking: TrackingSummary | null = TRACKING) =>
  buildToday({ disputes: demoDisputes(), tracking, products: seedProducts, now: NOW });

const items = (view: ReturnType<typeof today>) => view.groups.flatMap((group) => group.items);

// ───────────────────────────── 이름 규칙 ─────────────────────────────

describe('T060 구매자 이름 규칙 (재시도 2번)', () => {
  it('한글 낱말이 있으면 한글이 아닌 첫 낱말, 없으면 이름 전체', () => {
    expect(buyerShortName('김서연 Seo-yeon Kim')).toBe('Seo-yeon');
    expect(buyerShortName('박지호 Ji-ho Park')).toBe('Ji-ho');
    expect(buyerShortName('Mike Morgan')).toBe('Mike Morgan');
    expect(buyerShortName('Yuki T.')).toBe('Yuki T.');
    expect(buyerShortName('  Lena   K. ')).toBe('Lena K.');
    expect(buyerShortName('김서연')).toBe('김서연'); // 로마자가 없으면 그대로
  });

  it('시드 구매자 이름에 그대로 쓴다', () => {
    expect(buyerShortName(buyer('B01').name)).toBe('Seo-yeon');
    expect(buyerShortName(buyer('B02').name)).toBe('Ji-ho');
    expect(buyerShortName(buyer('B04').name)).toBe('Mike Morgan');
  });

  it('서수', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th',
    ]);
  });
});

// ───────────────────────────── 날짜 줄 ─────────────────────────────

describe('T060 날짜 줄', () => {
  it('남은 날 수 = 문구 파일의 대목 날짜 − 판매자 시간대 오늘 (11/10 → 17)', () => {
    const peak = t('today.peakDate');
    const zone = t('today.sellerTimeZone');
    expect(daysUntil(NOW, peak, zone)).toBe(17);
    expect(daysUntil(new Date('2026-11-26T15:00:00.000Z'), peak, zone)).toBe(1);
    expect(daysUntil(new Date('2026-11-27T15:00:00.000Z'), peak, zone)).toBe(0);
  });

  it('판매자 시간대로 센다 (UTC로는 다음 날이어도 뉴욕이 아직 11/10이면 17)', () => {
    expect(daysUntil(new Date('2026-11-11T03:00:00.000Z'), t('today.peakDate'), t('today.sellerTimeZone'))).toBe(17);
    expect(daysUntil(new Date('2026-11-11T06:00:00.000Z'), t('today.peakDate'), t('today.sellerTimeZone'))).toBe(16);
  });

  it('"Tue, Nov 10 · Black Friday in 17 days" (T076 시안 v4 꼴, 계산은 그대로)', () => {
    expect(dateLine(NOW)).toBe('Tue, Nov 10 · Black Friday in 17 days');
    expect(dateLine(new Date('2026-11-26T15:00:00.000Z'))).toBe('Thu, Nov 26 · Black Friday in 1 day');
    expect(dateLine(new Date('2026-12-01T15:00:00.000Z'))).toBe('Tue, Dec 1');
  });
});

// ───────────────────────────── 목록 ─────────────────────────────

describe('T060 Today 목록 (데이터에서 만든다)', () => {
  it('T076: Reply needed = 서연 · 지호, Prevent = 추적(2) · 가디건, Routine = Mike', () => {
    const view = today();
    expect(view.groups.map((group) => group.key)).toEqual(['needsYou', 'prevent', 'routine']);
    expect(view.groups.map((group) => group.title)).toEqual(['Reply needed', 'Prevent', 'Routine']);

    const [needsYou, prevent, routine] = view.groups;
    expect(needsYou.items.map((item) => item.id)).toEqual([D2, D1]);
    expect(needsYou.items.map((item) => item.name)).toEqual(['Seo-yeon', 'Ji-ho']);
    expect(prevent.items.map((item) => item.id)).toEqual([TRACKING_ITEM_ID, 'FK-CD-OAT']);
    expect(prevent.items.map((item) => item.name)).toEqual(['2 orders without tracking', 'Knit Cardigan, Oat']);
    expect(routine.items.map((item) => item.name)).toEqual(['Mike Morgan']);
  });

  it('유형 짧은 이름 · 아래 줄 · 위험 배지', () => {
    const [seoyeon, jiho] = today().groups[0].items;
    const tracking = today().groups[1].items[0];
    expect(seoyeon.label).toBe('customs hold');
    expect(seoyeon.sub).toBe('Korean · mentions the card company');
    expect(seoyeon.band).toBe('High');
    expect(tracking.band).toBe('Watch');
    expect(tracking.sub).toBeNull();
    expect(jiho.label).toBe('color case');
    expect(jiho.sub).toBe('offer waiting for your approval');

    const mike = today().groups[2].items[0];
    expect(mike.label).toBe('3rd claim');
    expect(mike.sub).toBe('skipped · suspected abuse');
  });

  it('카드사 신호가 없으면 "mentions the card company"를 쓰지 않는다 (대명사도 없다)', () => {
    const disputes = demoDisputes().map((d) => (d.disputeId === D2 ? { ...d, signals: quiet } : d));
    const view = buildToday({ disputes, tracking: TRACKING, products: seedProducts, now: NOW });
    const seoyeon = items(view).find((item) => item.id === D2);
    expect(seoyeon?.sub).not.toMatch(/card company/);
    for (const table of [copyTables.en]) {
      for (const key of copyKeys(table).filter((k) => k.startsWith('today.'))) {
        expect(table[key], key).not.toMatch(/\b(her|his|she|he)\b/i);
      }
    }
  });

  it('Needs you 순서는 엔진 위험 단계가 정한다 (위험이 바뀌면 순서도 바뀐다)', () => {
    const disputes = demoDisputes().map((d) =>
      d.disputeId === D1 ? { ...d, signals: { ...quiet, mentionsCardCompany: true, unansweredOver24h: true, angryTone: true } } : d,
    );
    const view = buildToday({ disputes, tracking: TRACKING, products: seedProducts, now: NOW });
    // 지호 3+2+1 = 6 > 서연 3+2 = 5 → 지호가 먼저 (추적 항목은 T076부터 Prevent 묶음)
    expect(view.groups[0].items.map((item) => item.id)).toEqual([D1, D2]);
  });

  it('Today (N)의 N = 목록에 보이는 항목 수', () => {
    const view = today();
    expect(view.count).toBe(items(view).length);
    expect(view.count).toBe(5);
    const html = renderToStaticMarkup(createElement(TodayList, { view, selectedId: D2, paypalNotice: null }));
    expect(html.match(/class="today-item"/g)?.length).toBe(view.count);
    expect(t('shell.todayTab', { count: view.count })).toBe('Today (5)');
  });

  it('Lena 환불 · Yuki 사이즈 문의 · 통관부호 문의 항목이 없다', () => {
    const view = today();
    const names = items(view).map((item) => `${item.name} ${item.label ?? ''} ${item.sub ?? ''}`).join('\n');
    expect(names).not.toMatch(/Lena|Yuki|Da-eun|customs code|size/i);
  });

  it('추적 조회 실패(null) → 추적 항목을 숨긴다', () => {
    const view = today(null);
    expect(items(view).some((item) => item.kind === 'tracking')).toBe(false);
    expect(view.groups[0].items.map((item) => item.id)).toEqual([D2, D1]);
    expect(view.count).toBe(4);
  });

  it('미등록 주문이 0건이면 추적 항목이 없다', () => {
    const view = today({ untracked: [], excluded: TRACKING.excluded });
    expect(items(view).some((item) => item.kind === 'tracking')).toBe(false);
  });

  it('PayPal을 읽지 못하면(분쟁 0건) Prevent만 남는다', () => {
    const view = buildToday({ disputes: [], tracking: null, products: seedProducts, now: NOW });
    expect(view.groups.map((group) => group.key)).toEqual(['prevent']);
    expect(view.count).toBe(1);
  });

  it('고른 항목: 주소의 item이 있으면 그것, 없거나 모르면 첫 항목(서연). Prevent는 고르지 않는다', () => {
    const view = today();
    expect(selectItem(view, undefined)?.id).toBe(D2);
    expect(selectItem(view, D1)?.id).toBe(D1);
    expect(selectItem(view, TRACKING_ITEM_ID)?.id).toBe(TRACKING_ITEM_ID);
    expect(selectItem(view, 'PP-R-HEY-10197767')?.id).toBe(D2);
    expect(selectItem(view, 'FK-CD-OAT')?.id).toBe(D2);
  });

  it('주소: 분쟁은 /?item=, 추적은 /?item=tracking, Prevent는 /products?sku=', () => {
    const view = today();
    const byId = Object.fromEntries(items(view).map((item) => [item.id, item.href]));
    expect(byId[D2]).toBe(`/?item=${D2}`);
    expect(byId[TRACKING_ITEM_ID]).toBe('/?item=tracking');
    expect(byId['FK-CD-OAT']).toBe('/products?sku=FK-CD-OAT');
  });

  it('고른 항목에만 aria-current가 붙는다 (링크라 키보드로 고를 수 있다)', () => {
    const view = today();
    const html = renderToStaticMarkup(createElement(TodayList, { view, selectedId: D1, paypalNotice: null }));
    expect(html.match(/aria-current="true"/g)?.length).toBe(1);
    expect(html).toMatch(new RegExp(`aria-current="true" href="/\\?item=${D1}"`));
    // T076: 날짜 줄은 위쪽 막대로 옮겼다 (TopBar dateLine). 가게 전체 한 줄은 이번 주 카드 아래 글 (T096: 링크 아님)
    expect(view.dateLine).toBe('Tue, Nov 10 · Black Friday in 17 days');
    expect(html).not.toContain('href="/products"');
    expect(html).toContain(`class="weekly-link">${view.storeLine.text}</p>`);
  });
});

// ───────────────────────────── 가게 전체 숫자 · Prevent ─────────────────────────────

describe('T060 가게 전체 한 줄 · Prevent (엔진 결과)', () => {
  const store = simulateStore(seedProducts, [...FIX_ORDER]);

  it('맨 위 숫자 = simulateStore 합계의 달러 반올림', () => {
    const view = today();
    expect(view.storeLine.beforeCents).toBe(store.beforeCents);
    expect(view.storeLine.afterCents).toBe(store.afterCents);
    expect(view.storeLine.text).toBe(
      `Stock left could cost ${toDollarsRounded(store.beforeCents)} in disputes · ${toDollarsRounded(store.afterCents)} with fixes →`,
    );
    // 지금 가정값의 값 (확인용)
    expect(view.storeLine.text).toBe('Stock left could cost $717 in disputes · $253 with fixes →');
  });

  it('Prevent = 처방을 다 켰을 때 줄어드는 비율이 가장 큰 상품 (지금 가디건)', () => {
    const rows = store.products.map(({ sku, result }) => ({
      sku,
      beforeCents: result.before.meanLossCents,
      afterCents: result.after.meanLossCents,
    }));
    const pick = pickPreventProduct(store); // T067: 화면은 엔진(T066) 결과를 옮긴다
    expect(pick?.sku).toBe('FK-CD-OAT');
    // 정의 그대로 다시 세어 본다
    const ratios = rows.filter((r) => r.beforeCents > 0).map((r) => ({ sku: r.sku, ratio: (r.beforeCents - r.afterCents) / r.beforeCents }));
    const top = [...ratios].sort((a, b) => b.ratio - a.ratio)[0];
    expect(pick?.sku).toBe(top.sku);
    expect(pick?.cutPercent).toBe(Math.round(top.ratio * 100));

    const prevent = today().groups[1].items.find((item) => item.kind === 'prevent');
    expect(prevent?.sub).toBe(t('today.prevent.sub', { stock: product('FK-CD-OAT').stock, percent: pick?.cutPercent as number }));
    expect(prevent?.sub).toBe('120 left · fixes cut likely loss by about 80%');
    expect(prevent?.row.who).toBe(prevent?.sub);
  });

  it('Prevent 항목은 엔진 `pickPreventProduct` 값 그대로다 (화면에 고르기 함수가 없다, T067)', () => {
    const pick = pickPreventProduct(store);
    const prevent = today().groups[1].items.find((item) => item.kind === 'prevent') as TodayItem;
    expect(prevent.id).toBe(pick?.sku);
    const code = readFileSync(path.join(ROOT, 'src/app/today/model.ts'), 'utf8');
    expect(code).toMatch(/pickPreventProduct\(store\)/);
    expect(code).not.toMatch(/function pickPrevent\b/);
  });
});

// ───────────────────────────── T067: 점 = 위험 등급, 알약 = 상태 ─────────────────────────────

describe('T067 목록 점과 상태 알약 (보기용 데이터)', () => {
  it('서연 High · 추적 Watch · 지호 Waiting approval · 가디건 Prevent · Mike Skipped', () => {
    const [needsYou, prevent, routine] = today().groups;
    const [seoyeon, jiho] = needsYou.items;
    const [tracking, cardigan] = prevent.items;
    const statusText = (item: { status: { key: string } }) => t(item.status.key);

    expect([seoyeon, tracking, jiho, cardigan, routine.items[0]].map(statusText)).toEqual([
      'High',
      'Watch',
      'Waiting approval',
      'Prevent',
      'Skipped',
    ]);
    expect([seoyeon, tracking, jiho, cardigan, routine.items[0]].map((item) => item.status.tone)).toEqual([
      'high',
      'watch',
      'neutral',
      'neutral',
      'neutral',
    ]);
    // 점: 서연 빨강 · 추적 노랑 · 지호는 엔진 위험 등급 색 · 가디건·Mike 회색
    expect(seoyeon.dot).toBe('high');
    expect(tracking.dot).toBe('watch');
    expect(jiho.band).not.toBeNull();
    expect(jiho.dot).toBe(({ High: 'high', Watch: 'watch', Low: 'low' } as const)[jiho.band as 'High' | 'Watch' | 'Low']);
    expect(cardigan.dot).toBe('neutral');
    expect(routine.items[0].dot).toBe('neutral');
  });

  it('알약은 엔진 판정에서 고른다: 지호 위험이 오르면 알약도 위험 단계로 바뀐다', () => {
    const disputes = demoDisputes().map((d) =>
      d.disputeId === D1 ? { ...d, signals: { ...quiet, mentionsCardCompany: true, unansweredOver24h: true } } : d,
    );
    const jiho = items(buildToday({ disputes, tracking: TRACKING, products: seedProducts, now: NOW })).find((item) => item.id === D1);
    expect(jiho?.band).toBe('High');
    expect(jiho?.status).toEqual({ key: 'badge.riskHigh', tone: 'high' });
    expect(jiho?.dot).toBe('high');
  });

  it('목록 마크업 (T076 시안 v4): 아이콘 위 점(장식) + 범주 알약, 상태는 화면 읽기 글자, 위험 기호 부품(RiskLevel)은 쓰지 않는다', () => {
    const view = today();
    const markup = renderToStaticMarkup(createElement(TodayList, { view, selectedId: D2, paypalNotice: null }));
    // 점은 상품 아이콘(장식, aria-hidden) 안 오른쪽 위
    expect(markup).toMatch(/<span class="product-tile product-tile-sm" aria-hidden="true">.*?<span class="product-tile-dot today-dot today-dot-high"><\/span><\/span>/);
    // 알약 = 범주 (서연은 위험 High라 빨강)
    expect(markup).toContain('<span class="today-pill today-pill-high">Not received · Customs hold</span>');
    expect(markup).toContain('<span class="today-pill today-pill-neutral">Not as described · Color</span>');
    expect(markup).toContain('<span class="today-pill today-pill-neutral">Missing tracking</span>');
    expect(markup).toContain('<span class="today-pill today-pill-neutral">Not received · Repeat claim</span>');
    // 상태(High · Watch · Waiting approval · Prevent · Skipped)는 화면 읽기 글자로 남는다
    for (const status of ['High', 'Watch', 'Waiting approval', 'Prevent', 'Skipped']) {
      expect(markup).toMatch(new RegExp(`<span class="today-sr-only">[^<]*· ${status}</span>`));
    }
    expect(markup).not.toMatch(/class="risk /);
    expect(markup.match(/aria-current="true"/g)?.length).toBe(1);
  });

  it('화면 코드에 상태 글자를 직접 쓰지 않는다 (문구 키)', () => {
    for (const file of ['src/app/today/model.ts', 'src/app/today/today-list.tsx']) {
      const code = strip(readFileSync(path.join(ROOT, file), 'utf8'));
      expect(/['"](Waiting approval|Skipped)['"]|>(High|Watch|Prevent|Skipped|Waiting approval)</.test(code), file).toBe(false);
    }
  });
});

// ───────────────────────────── 추적 조회 ─────────────────────────────

type FakeClient = PayPalClient & { paths: string[]; calls: number };

/** 주문 상세 GET만 답한다. 샌드박스 기록(`tracked`)대로 추적을 붙인다. `call`(POST)이 불리면 깨진다. */
function fakeOrders(options: { fail?: string[]; throwOn?: string[] } = {}): FakeClient {
  const orders = (manifestJson as { orders: { orderId: string; tracked: boolean }[] }).orders;
  const client: FakeClient = {
    paths: [],
    calls: 0,
    call: async () => {
      client.calls += 1;
      throw new Error('POST는 이 작업에 없다');
    },
    get: async (p: string) => {
      client.paths.push(p);
      const id = decodeURIComponent(p.split('/').pop() ?? '');
      if (options.throwOn?.includes(id)) throw new Error('network');
      if (options.fail?.includes(id)) return { status: 500, body: { name: 'INTERNAL_SERVER_ERROR' } };
      const order = orders.find((o) => o.orderId === id);
      const trackers = order?.tracked ? [{ id: 'T', status: 'SHIPPED' }] : [];
      return { status: 200, body: { id, purchase_units: [{ shipping: { trackers } }] } };
    },
  } as unknown as FakeClient;
  return client;
}

const SEED = { orders: seedOrders, disputes: seedDisputes, buyers: seedBuyers, products: seedProducts };

describe('T060 추적 항목 조회 (GET만)', () => {
  it('분쟁이 걸리지 않은 미등록 주문 = O05·O07 (2건). 분쟁 걸린 주문은 조회하지 않는다', async () => {
    const client = fakeOrders();
    const summary = await summarizeTracking(client, SEED);
    expect(summary?.untracked.map((o) => o.key)).toEqual(['O05', 'O07']);
    expect(client.calls).toBe(0);
    const disputedOrderIds = ['O01', 'O02', 'O04', 'O08', 'O13'].map(
      (key) => (manifestJson as { orders: { key: string; orderId: string }[] }).orders.find((o) => o.key === key)?.orderId,
    );
    for (const id of disputedOrderIds) expect(client.paths.some((p) => p.endsWith(id as string))).toBe(false);
  });

  it('회색 줄: 분쟁 걸린 미등록 주문 중 화면에 내는 분쟁만 (O02 지호 · O13 서연. 연습용 O04는 없다)', async () => {
    const summary = await summarizeTracking(fakeOrders(), SEED);
    expect(summary?.excluded.map((o) => o.key)).toEqual(['O02', 'O13']);
    expect(summary?.excluded.map((o) => o.buyerName)).toEqual(['Ji-ho', 'Seo-yeon']);
  });

  it('이름·상품은 시드에서', async () => {
    const summary = await summarizeTracking(fakeOrders(), SEED);
    // T091: 금액·SKU("+$N just now"의 엔진 입력)가 붙을 수 있다 — 이름·상품 칸만 본다
    expect(summary?.untracked).toMatchObject([
      { key: 'O05', buyerName: 'Yuki T.', productName: 'Beanie + Scarf Set' },
      { key: 'O07', buyerName: 'Lena K.', productName: 'Knit Cardigan, Oat' },
    ]);
  });

  it('T091: 주문 금액·SKU는 시드 주문 값 (trackingSavings 입력)', async () => {
    const summary = await summarizeTracking(fakeOrders(), SEED);
    for (const order of summary?.untracked ?? []) {
      const seedOrder = seedOrders.find((o) => o.id === order.key);
      if (seedOrder === undefined || order.amountCents === undefined) continue;
      expect(order.amountCents).toBe(seedOrder.amountCents);
      expect(order.sku).toBe(seedOrder.sku);
    }
  });

  it('하나라도 읽지 못하면 null (항목 숨김) — 응답 실패·예외 모두', async () => {
    const o05 = (manifestJson as { orders: { key: string; orderId: string }[] }).orders.find((o) => o.key === 'O05')?.orderId as string;
    expect(await summarizeTracking(fakeOrders({ fail: [o05] }), SEED)).toBeNull();
    expect(await summarizeTracking(fakeOrders({ throwOn: [o05] }), SEED)).toBeNull();
    expect(await summarizeTracking(fakeOrders(), SEED, { orders: 'broken' })).toBeNull();
  });

  it('추적 상세: 한 줄 설명 + 주문 목록, 분쟁 걸린 주문은 "In dispute — excluded", 서버 액션을 안 넘기면 버튼 없음', () => {
    const html = renderToStaticMarkup(createElement(TrackingDetail, { tracking: TRACKING }));
    expect(html).toContain('2 orders shipped 3+ days ago have no tracking in PayPal.');
    expect(html).toContain('In dispute — excluded');
    expect(html.match(/tracking-row-excluded/g)?.length).toBe(1);
    expect(html).not.toMatch(/<button/);
  });
});

// ───────────────────────────── 위쪽 막대 · 서랍 ─────────────────────────────

describe('T060 위쪽 막대', () => {
  it('기본 탭은 Today / Products (T087: "Black Friday rehearsal"은 /listing으로 — 위쪽 막대 TOP_TABS가 끼운다)', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(['/', '/products']);
    expect(NAV_ITEMS.map((item) => t(item.copyKey))).toEqual(['Today', 'Products']);
  });

  it('판매자 칩 글자는 설정의 서명에서 온다', () => {
    const signature = loadReplyNames().sellerSignature;
    const chip = sellerChip(signature);
    expect(chip.shop).toBe(signature.slice(signature.indexOf(',') + 1).trim());
    expect(chip.initial).toBe(signature.trim()[0].toUpperCase());
    expect(sellerChip('ann, Shop Two')).toEqual({ initial: 'A', shop: 'Shop Two' });
    expect(sellerChip('Solo Store')).toEqual({ initial: 'S', shop: 'Solo Store' });
  });

  it('Autopilot 토글은 꺼진 채 비활성이고 툴팁 문구가 있다', () => {
    const html = renderToStaticMarkup(createElement(AutopilotToggle));
    expect(html).toMatch(/role="switch"/);
    expect(html).toMatch(/aria-checked="false"/);
    expect(html).toMatch(/disabled=""/);
    expect(html).toContain(`title="${t('shell.autopilotHint')}"`);
  });

  it('서랍: 닫힌 상태로 그려지고 버튼 건수는 기록 수(0)', () => {
    const html = renderToStaticMarkup(createElement(ActivityDrawer, { records: [] }));
    expect(html).toContain('PayPal activity');
    expect(html).toMatch(/aria-expanded="false"/);
    expect(html).toMatch(/class="shell-count num"[^>]*>0</);
    expect(html).not.toMatch(/role="dialog"/);
  });

  it('서랍 코드: Esc로 닫고, Tab을 가두고, 빈 상태 문구와 닫기 버튼이 있다', () => {
    const code = readFileSync(path.join(ROOT, 'src/app/_shared/activity-drawer.tsx'), 'utf8');
    expect(code).toMatch(/event\.key === 'Escape'/);
    expect(code).toMatch(/event\.key !== 'Tab'/);
    expect(code).toMatch(/aria-modal="true"/);
    expect(code).toContain("t('shell.drawer.empty')");
    expect(code).toContain("t('shell.drawer.close')");
    expect(t('shell.drawer.empty')).toBe('No PayPal calls recorded yet.');
    expect(t('shell.drawer.note')).toBe(`Every call ${t('nav.appName')} makes on your behalf. Sandbox.`);
  });

  it('서랍 폭은 고정 폭 검사에 걸리지 않게 (width: 100% + max-width)', () => {
    const css = readFileSync(path.join(ROOT, 'src/app/_shared/shell.css'), 'utf8');
    const drawer = /\.drawer\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(drawer).toMatch(/width:\s*100%/);
    expect(drawer).toMatch(/max-width:\s*25rem/);
    expect(css).not.toMatch(/box-shadow|100vw/);
  });
});

// ───────────────────────────── 옛 주소 · 정적 검사 ─────────────────────────────

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('T060 옛 주소와 정적 검사', () => {
  it('/cases/<id>는 /?item=<id>로 보낸다 (PayPal을 읽지 않는다)', () => {
    const code = strip(readFileSync(path.join(ROOT, 'src/app/(app)/cases/[disputeId]/page.tsx'), 'utf8'));
    expect(code).toMatch(/redirect\(`\/\?item=\$\{encodeURIComponent\(decode\(disputeId\)\)\}`\)/);
    // 언어 쿠키(T081 `applyLangParam`)만 `_server/locale`에서 읽는다 — 데이터 읽기는 없다
    expect(code.replace("'@/app/_server/locale'", '')).not.toMatch(/loadCase|loadDemoDisputes|_server/);
  });

  it('Today 오른쪽 칸: 분쟁은 사례 상세 + 답장 칸, Routine은 답장 칸 없는 상세 (T061)', () => {
    const detail = readFileSync(path.join(ROOT, 'src/app/cases/case-detail.tsx'), 'utf8');
    expect(detail).toMatch(/<CaseView\b/);
    expect(detail).toMatch(/<ReplyPanel\b/);
    expect(detail).toMatch(/<RoutineDetail\b/);
    const routine = readFileSync(path.join(ROOT, 'src/app/cases/routine-detail.tsx'), 'utf8');
    expect(routine).not.toMatch(/ReplyPanel|loadReply/);
    const page = readFileSync(path.join(ROOT, 'src/app/(app)/page.tsx'), 'utf8');
    expect(page).toMatch(/<CaseDetail /);
  });

  const screenFiles = [
    'src/app/(app)/page.tsx',
    'src/app/layout.tsx',
    'src/app/(app)/layout.tsx',
    'src/app/(app)/products/page.tsx',
    'src/app/cases/case-detail.tsx',
    ...filesUnder(path.join(ROOT, 'src/app/today')).map((f) => path.relative(ROOT, f)),
    'src/app/_server/today.ts',
    'src/app/_shared/top-bar.tsx',
    'src/app/_shared/activity-drawer.tsx',
    'src/app/_shared/autopilot-toggle.tsx',
    'src/app/_shared/nav-items.ts',
  ].filter((f) => /\.(ts|tsx)$/.test(f));

  it('화면 코드에 금액·건수 숫자가 없다 (717·253·120·17·80·79.8·2건)', () => {
    for (const file of screenFiles) {
      const code = strip(readFileSync(path.join(ROOT, file), 'utf8'));
      expect(/(?<![\w.#-])(717|253|71718|25316|120|17|80|79|7400|3680|4800)(?![\w.])/.test(code), file).toBe(false);
      expect(/\$\s*\d/.test(code), file).toBe(false);
    }
  });

  it('화면 코드에 판매자 이름 글자가 없다', () => {
    for (const file of filesUnder(path.join(ROOT, 'src/app')).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const code = readFileSync(file, 'utf8');
      expect(/Hannah|Fernwood/.test(code), path.relative(ROOT, file)).toBe(false);
    }
  });

  it('새 화면 코드는 POST를 보내지 않는다 (.call(·executeMove·registerTrackers 없음)', () => {
    for (const file of screenFiles) {
      const code = strip(readFileSync(path.join(ROOT, file), 'utf8'));
      expect(/\.call\(|executeMove|registerTrackers|method:\s*'POST'/.test(code), file).toBe(false);
    }
  });

  it('클라이언트 컴포넌트는 서버 전용 코드를 import하지 않는다', () => {
    for (const file of screenFiles) {
      const code = readFileSync(path.join(ROOT, file), 'utf8');
      if (!code.startsWith("'use client'")) continue;
      expect(/_server|server-only|@\/paypal|@\/ai/.test(code), file).toBe(false);
    }
  });

  it('새 css는 변수 색만 쓰고 그림자(--shadow-selected 하나 밖)·100vw·360px 넘는 고정 폭이 없다', () => {
    for (const file of ['src/app/_shared/shell.css', 'src/app/today/today.css', 'src/app/products/products.css']) {
      // T067: 그림자는 `box-shadow: var(--shadow-selected)` 하나만 허용 (사람 결정)
      const css = strip(readFileSync(path.join(ROOT, file), 'utf8')).replace(/box-shadow:\s*var\(--shadow-selected\);/g, '');
      expect(css, file).not.toMatch(/box-shadow|100vw|#[0-9a-fA-F]{3,8}\b|rgba?\(/);
      // `@media (min-width: …)` 조건은 폭 지정이 아니므로 뺀다
      for (const match of css.matchAll(/(?<![-\w(])(min-)?width\s*:\s*([0-9.]+)(px|rem)/g)) {
        const px = Number(match[2]) * (match[3] === 'rem' ? 16 : 1);
        expect(px, `${file} ${match[0]}`).toBeLessThanOrEqual(360);
      }
      for (const match of css.matchAll(/font-size\s*:\s*([^;]+);/g)) {
        expect(match[1], `${file} ${match[0]}`).toMatch(/^(var\(--text-[a-z]+\)|[0-9.]+em)$/);
      }
    }
  });

  it('새 문구 키(shell.·today.)가 두 문구 파일에 같이 있다', () => {
    const mine = copyKeys().filter((key) => /^(shell|today)\./.test(key));
    expect(mine.length).toBeGreaterThan(20);
    for (const key of mine) expect(typeof copyTables.ko[key], key).toBe('string');
    expect(copyTables.en['nav.orders']).toBeUndefined();
    expect(copyTables.en['nav.inbox']).toBeUndefined();
  });
});
