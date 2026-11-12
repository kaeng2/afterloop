/**
 * T122d: v6 목록 후속 — 위험 단계 config, "Avg. dispute risk" 엔진 자리, Lena·Yuki 데모 항목 연결, Mike 칩 없음.
 * PayPal·AI·개발 서버를 부르지 않는다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { seedDemoDisplay, seedProducts } from '../../seed/index';
import { setLocaleResolver } from '@/app/_shared/copy';
import { curveView } from '@/app/cases/desk-model';
import { dashboardMeanRisk } from '@/app/today/mean-risk';
import { STATUS_DEMO, buildToday, type TodayItem } from '@/app/today/model';
import { buildOverview } from '@/app/today/overview-model';
import { riskLevelOf } from '@/app/today/risk-level';
import type { RiskPoint } from '@/types';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { React?: typeof React }).React = React;

const { TodayGroupsView } = await import('@/app/today/today-groups');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const NOW = new Date('2026-11-10T17:00:00.000Z');
const items = (view: ReturnType<typeof buildToday>): TodayItem[] => view.groups.flatMap((group) => group.items);

describe('T122d-1: 위험 단계 = config desk.riskLevel (목록 칩 · All products · 위험 상자 "지금 %")', () => {
  it('설정 값을 읽는다 (코드에 45·20을 쓰지 않는다)', () => {
    const motion = JSON.parse(read('config/motion.json')) as { desk: { riskLevel: { highFrom: number; midFrom: number } } };
    expect(motion.desk.riskLevel).toMatchObject({ highFrom: 0.45, midFrom: 0.2 });
    expect(read('src/app/today/risk-level.ts')).not.toMatch(/0\.45|0\.2\b/);
    expect(read('src/app/today/risk-values.tsx')).toMatch(/riskLevelOf/);
  });

  it('위험 상자 "지금 %" 글자색도 같은 기준: 47% → high (riskColor 50%였으면 mid)', () => {
    const points = (p: number): RiskPoint[] => [{ at: '2026-11-09T00:00:00Z', kind: 'buyer_message', pChargeback: p }];
    expect(curveView(points(0.47), null)?.headlineTone).toBe('high');
    expect(curveView(points(0.3), null)?.headlineTone).toBe('mid');
    expect(curveView(points(0.1), null)?.headlineTone).toBe('low');
    expect(riskLevelOf(0.47)).toBe('high');
    expect(read('src/app/cases/desk-model.ts')).toMatch(/headlineTone: riskLevelTone\(/);
  });
});

describe('T122d-2: "Avg. dispute risk" = 엔진 meanRisk 자리 (T120d)', () => {
  it('화면은 상품 줄마다 최고 위험 목록만 넘기고 평균을 내지 않는다', () => {
    const view = buildToday({ disputes: [], tracking: null, products: seedProducts, now: NOW });
    const ov = buildOverview({ groups: view.groups, filter: view.filter, done: {}, risk: { lena: 0.4 }, severalName: 'S' });
    expect(ov.kpis.topRisks).toEqual([0.4]);
    expect(dashboardMeanRisk([0.4, 0.2])).toBeCloseTo(0.3, 10);
    expect(dashboardMeanRisk([])).toBeNull();
    const overview = read('src/app/today/overview.tsx');
    expect(overview).toMatch(/dashboardMeanRisk\(kpis\.topRisks\)/);
    expect(overview).not.toMatch(/\.reduce\(/);
  });
});

describe('T122d-3: 데모 항목 Lena #1029 (Reply needed) · Yuki #1051 (Questions) — Demo data', () => {
  const view = buildToday({ disputes: [], tracking: null, products: seedProducts, now: NOW });
  const demo = items(view).filter((item) => item.kind === 'demo');

  it('id = 시드 key (T122c 카드와 같은 id), 묶음·번호·상태 알약 Demo data', () => {
    expect(demo.map((item) => [item.id, item.group, item.row.head])).toEqual([
      ['lena', 'needsYou', '#1029'],
      ['yuki', 'routine', '#1051'],
    ]);
    for (const item of demo) {
      expect(item.status).toEqual(STATUS_DEMO);
      expect(item.band).toBeNull();
      expect(item.dot).toBe('neutral');
      expect(item.score).toBeNull();
    }
    expect(seedDemoDisplay.demoItems.map((item) => item.key)).toEqual(['lena', 'yuki']);
  });

  it('시드 값을 그대로 옮긴다 (카드 입력 `demo`, 상품 = 시드 SKU)', () => {
    const [lena, yuki] = demo;
    expect(lena.demo).toBe(seedDemoDisplay.demoItems[0]);
    expect(yuki.demo).toBe(seedDemoDisplay.demoItems[1]);
    expect(lena.row).toMatchObject({ category: 'Refund promised', who: 'Lena K. · DE', skus: ['FK-BN-SET'], due: null });
    expect(yuki.row).toMatchObject({ category: 'Question · Size', who: 'Yuki T. · JP', skus: ['FK-CD-OAT'] });
  });

  it('한국어 화면은 시드 한국어 글', () => {
    setLocaleResolver(() => 'ko');
    try {
      const ko = items(buildToday({ disputes: [], tracking: null, products: seedProducts, now: NOW })).filter(
        (item) => item.kind === 'demo',
      );
      expect(ko.map((item) => item.row.category)).toEqual(['환불 약속', '문의 · 사이즈']);
    } finally {
      setLocaleResolver(() => 'en');
    }
  });

  it('열린 분쟁 수·상품 칩 사건 수에 넣지 않는다 (PayPal 사건이 아님)', () => {
    expect(view.openDisputes).toBe(0);
    expect(view.filter.chips.every((chip) => chip.cases === 0)).toBe(true);
  });

  it('위험 칩: 시드·엔진 값이 없으면 그리지 않는다 (지어내지 않는다). 값이 있으면 그 값', () => {
    const none = renderToStaticMarkup(createElement(TodayGroupsView, { groups: view.groups, done: {}, selectedId: null }));
    expect(none).toContain('#1029');
    expect(none).toContain('#1051');
    expect(none).not.toMatch(/today-risk /);
    const withValue = renderToStaticMarkup(
      createElement(TodayGroupsView, { groups: view.groups, done: {}, selectedId: null, risk: { lena: 0.31 } }),
    );
    expect(withValue).toContain('31% · Medium');
  });

  it('목록 값 서버(risk-source)는 분쟁만 읽는다 — 데모 항목은 PayPal·AI 읽기 없음', () => {
    expect(read('src/app/today/risk-source.ts')).toMatch(/item\.kind === 'dispute'/);
    const page = read('src/app/(app)/page.tsx');
    expect(page).toMatch(/item\.kind === 'demo'\) return null/);
  });
});

describe('T122d-4: Mike 위험 칩 없음 (예외 — DECISIONS 2026-11-12 컨트롤 타워)', () => {
  it('Routine(악용 의심) 분쟁은 값 표에 넣지 않는다', () => {
    expect(read('src/app/today/risk-source.ts')).toMatch(/routineLine\(board, decideFor\(board\)\) !== null\) return null/);
  });
});
