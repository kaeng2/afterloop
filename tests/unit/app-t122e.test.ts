/**
 * T122e 단위 테스트: 시안 v6 표시 데이터 연결 (seed/demo-display, 결정 2026-11-12 20:35 ③). 기준 SPEC v2.16.
 *
 * - 표시 번호 #1042(서연)·#1047(마이크), PP-R-… 은 보조 줄 (`ref`)
 * - 손님·상품 표기 = 시드 값, Demo data
 * - 서연 기록 = 시드 8줄 (Nov 9 줄은 실제 PayPal 글이 있으면 그것), "Before DisputeLess" 칩은 bad 줄에만
 * - 예방 줄: 표시 "5 orders"(Demo data) ↔ 실제 등록 대상 2건(O05·O07) — 카드 머리에서 둘 다 보인다
 */
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { t } from '@/app/_shared/copy';
import { displayLabelFor, preventRowLabel, seoyeonHistoryRows } from '@/app/_shared/demo-display';
import { buildCaseDesk, demoHistoryView } from '@/app/cases/desk-model';
import { CaseHistoryCard } from '@/app/cases/view/case-history';
import { buildToday, type TrackingSummary } from '@/app/today/model';
import { WorkHeader } from '@/app/today/work-card';
import type { CaseEvent } from '@/types';

import { seedDemoDisplay, seedProducts } from '../../seed/index';

// 화면 파일은 JSX 자동 변환 없이 `React`를 전역으로 찾는다 (다른 화면 시험과 같은 방식)
(globalThis as { React?: typeof React }).React = React;

const D2 = 'PP-R-GMS-10197661';
const D3 = 'PP-R-FYT-10197651';
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe('표시 줄 (displayLabelFor)', () => {
  it('실제 분쟁 번호로 시드 짝을 찾는다: 서연 #1042, 마이크 #1047. 짝이 없으면 null', () => {
    expect(displayLabelFor(D2, 'en')).toMatchObject({
      key: 'seoyeon',
      displayNo: '#1042',
      paypalRef: D2,
      who: 'Seo-yeon Kim · KR',
      product: 'Wool Sweater',
      displaySku: 'FK-SW-NV',
    });
    expect(displayLabelFor(D3, 'en')).toMatchObject({ key: 'mike', displayNo: '#1047', who: 'buyer_m · US' });
    expect(displayLabelFor('PP-R-MBJ-10197650', 'en')).toBeNull(); // 지호: 시드 paypalRef 없음 (T119 뒤)
    expect(displayLabelFor('PP-R-HEY-10197767', 'en')).toBeNull();
  });

  it('한국어는 시드 ko 값', () => {
    expect(displayLabelFor(D2, 'ko')).toMatchObject({ who: '김서연 · 한국', product: '울 스웨터', displayNo: '#1042' });
  });
});

describe('서연 사건 기록 (seoyeonHistoryRows → demoHistoryView)', () => {
  const realBuyer: CaseEvent = {
    at: '2026-11-10T03:00:00.000Z',
    kind: 'buyer_message',
    source: 'sandbox',
    text: 'Buyer: I will contact my card company.',
  };
  const opened: CaseEvent = { at: '2026-11-10T04:00:00.000Z', kind: 'dispute_opened', source: 'sandbox', text: 'Dispute opened in PayPal' };
  const seedOnly: CaseEvent = { at: '2026-10-19T00:00:00.000Z', kind: 'order_paid', source: 'seed', text: 'Order paid' };

  it('실제 글이 없으면 시드 8줄 그대로, 모두 Demo data', () => {
    const rows = seoyeonHistoryRows([seedOnly], 'en');
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.text)).toEqual(seedDemoDisplay.seoyeonHistory.map((l) => l.text));
    expect(rows.every((r) => r.demo)).toBe(true);
  });

  it('Nov 9 줄(source paypal)은 실제 샌드박스 구매자 글로, 분쟁 접수 줄은 실제 값으로 더한다 (Demo data 없음)', () => {
    const rows = seoyeonHistoryRows([seedOnly, realBuyer, opened], 'en');
    expect(rows).toHaveLength(9);
    const real = rows.filter((r) => r.paypal);
    expect(real.map((r) => [r.text, r.demo])).toEqual([
      [realBuyer.text, false],
      [opened.text, false],
    ]);
    expect(rows.filter((r) => r.demo)).toHaveLength(7);
  });

  it('"Before DisputeLess" 칩은 판매자 실수(bad) 줄에만 — "Promise missed"(sys)는 칩이 아니다', () => {
    const rows = seoyeonHistoryRows([], 'en');
    const flagged = rows.filter((r) => r.flag !== null);
    expect(flagged.every((r) => r.tone === 'bad')).toBe(true);
    expect(flagged.map((r) => r.flag)).toEqual(['No tracking in PayPal', 'Late · English · no date', 'Promise without carrier data']);
    expect(rows.some((r) => r.flag === 'Promise missed')).toBe(false);
  });

  it('카드: 8줄, bad 줄 3개에 빨간 칩, 시드 줄에 Demo data, 실제 줄엔 없음', () => {
    const view = demoHistoryView(seoyeonHistoryRows([realBuyer], 'en'), 22, null);
    expect(view?.count).toBe(8);
    expect(view?.rows.map((r) => r.tone)).toEqual(['sys', 'bad', 'buyer', 'bad', 'buyer', 'bad', 'sys', 'buyer']);
    const markup = html(createElement(CaseHistoryCard, { history: view! }));
    expect(markup.match(/desk-chip desk-chip-bad/g)).toHaveLength(3);
    expect(markup).toContain(t('case.history.beforeTag', { flag: 'Late · English · no date' }));
    expect(markup.match(/Demo data/g)?.length).toBe(7);
    expect(markup).toContain('Order paid · $72');
  });

  it('한국어 문장', () => {
    expect(seoyeonHistoryRows([], 'ko')[0].text).toBe('결제 완료 · $72');
  });
});

describe('Today 목록·머리', () => {
  const tracking: TrackingSummary = {
    untracked: [
      { key: 'O05', buyerName: null, productName: 'Knit Cardigan, Oat' },
      { key: 'O07', buyerName: null, productName: 'Beanie + Scarf Set' },
    ],
    excluded: [],
  };
  const view = buildToday({ disputes: [], tracking, products: seedProducts, now: new Date('2026-11-10T17:00:00.000Z') });
  const prevent = view.groups.find((g) => g.key === 'prevent')!;

  it('추적 줄: 머리 "5 orders"(Demo data), 실제 대상 수 2는 이름·아래 줄에 그대로 — 표시 수와 실제 수가 다르다는 글', () => {
    const item = prevent.items.find((i) => i.id === 'tracking')!;
    expect(item.row.head).toBe('5 orders');
    expect(item.row.demo).toBe(true);
    expect(item.name).toBe(t('today.tracking.title', { count: 2 }));
    const label = preventRowLabel('tracking', 'en')!;
    expect(label.realTargets).toEqual(['O05', 'O07']);
    expect(item.row.who).toBe(t('today.prevent.demoCount', { who: label.who, real: 2 }));
    // 카드 머리(WorkHeader)에 표시 수·Demo data 안내·실제 2건이 함께 보인다
    const head = html(createElement(WorkHeader, { row: item.row }));
    expect(head).toContain('5 orders');
    expect(head).toContain('Demo data');
    expect(head).toContain('2 real sandbox orders');
  });

  it('통관번호 줄: "3 orders · Customs ID missing" (Demo data, 버튼·대상 없음)', () => {
    const item = prevent.items.find((i) => i.id === 'customs-id')!;
    expect([item.row.head, item.row.category, item.row.demo]).toEqual(['3 orders', 'Customs ID missing', true]);
    expect(item.name).toBe('3 orders · Customs ID missing');
    expect(item.prevent).toBeUndefined();
    expect(item.row.who).toBe('Korean buyers · ship this week');
  });
});

describe('사례 머리글 (buildCaseDesk display)', () => {
  it('표시 짝이 있으면 제목 "#1042 · Wool Sweater", ref = PP-R-…, Demo data. 없으면 옛 제목', () => {
    const minimal = {
      view: {
        header: { disputeId: D2, productName: 'Wool Sweater, Navy', amount: { display: '$72' }, languageKey: null },
        compare: { before: { expectedLoss: null, actionKey: 'x' }, after: null },
      },
      board: { reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', cause: undefined },
      buyer: null,
      productName: 'Wool Sweater, Navy',
      openDays: null,
      recommendation: null,
      moveForecasts: null,
      history: null,
      curvePoints: null,
      band: null,
    } as unknown as Parameters<typeof buildCaseDesk>[0];
    const shown = buildCaseDesk({ ...minimal, display: displayLabelFor(D2, 'en') });
    expect([shown.title, shown.ref, shown.demoTitle]).toEqual(['#1042 · Wool Sweater', D2, true]);
    const plain = buildCaseDesk(minimal);
    expect([plain.title, plain.ref, plain.demoTitle]).toEqual([`${D2} · Wool Sweater, Navy`, null, false]);
  });
});
