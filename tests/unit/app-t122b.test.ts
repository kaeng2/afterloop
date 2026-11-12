/**
 * T122b: 시안 v6 Desk — 목록 위험 % 칩 · 묶음(Reply needed / Prevent / Questions / Done today) · "All products" 전체 현황
 * (AG Grid 표 2개) · 상품 칩 거르기.
 *
 * 테스트 환경이 node라 AG Grid를 실제로 그리지 않는다 — 열 설정(정렬·비교 함수·처음 정렬)·행 클릭 동작(순수 함수)·
 * 붙기 전 그림(꼬리표·"N rows · Sorted by …")·정적 검사로 본다. 위험 값은 손으로 넣은 엔진 값(0~1)이다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ColDef } from 'ag-grid-community';
import { describe, expect, it, vi } from 'vitest';

import { copyTables, t } from '@/app/_shared/copy';
import { riskTone } from '@/app/_shared/motion';
import { meanRisk } from '@/engine/mean-risk';
import { riskChipParts as chipParts } from '@/app/today/risk-values';
import { loadRiskLevel, riskLevelOf, riskLevelTone } from '@/app/today/risk-level';
import type { ProductFilterView, TodayGroup, TodayGroupKey, TodayItem } from '@/app/today/model';
import { MULTI_KEY, buildOverview, compareRisk, type OvCaseRow, type OvProductRow } from '@/app/today/overview-model';
import { ALL_PRODUCTS_PARAM, filterGroups, firstItemFor, todaySearch } from '@/app/today/screen-model';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { React?: typeof React }).React = React;

const { TodayGroupsView } = await import('@/app/today/today-groups');
const { TodaySelectionProvider, DetailEmpty, BackToAll } = await import('@/app/today/selection');
const { OverviewPane, productColumns, caseColumns, productRowAction } = await import('@/app/today/overview');
const { RiskValuesProvider, riskChipParts, riskLevel } = await import('@/app/today/risk-values');
const { DESK_OV_COLS, GRID_MODULES, deskGridTheme } = await import('@/app/_shared/grid/grid');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const SEO = 'PP-R-GMS-10197661';
const JIHO = 'PP-R-MBJ-10197650';
const MIKE = 'PP-R-FYT-10197651';
const SW = 'FK-SW-NV';
const CD = 'FK-CD-OAT';
const CO = 'FK-CO-CAM';

function item(id: string, group: TodayGroupKey, skus: string[], kind: TodayItem['kind'] = 'dispute', extra: Partial<TodayItem['row']> = {}): TodayItem {
  return {
    id,
    kind,
    group,
    href: `/?item=${id}`,
    name: id,
    label: null,
    sub: null,
    band: null,
    dot: 'neutral',
    status: { key: 'today.skipped', tone: 'neutral' },
    score: null,
    dueDate: '',
    row: { icon: 'sweater', head: id, product: 'Wool Sweater', category: 'Not received · Customs hold', categoryTone: 'neutral', due: null, who: 'Seo-yeon Kim · KR', skus, ...extra },
  };
}

const group = (key: TodayGroupKey, items: TodayItem[]): TodayGroup => ({ key, title: t(`today.group.${key}`), hint: t(`today.groupHint.${key}`), items });

const GROUPS: TodayGroup[] = [
  group('needsYou', [
    { ...item(SEO, 'needsYou', [SW], 'dispute', { due: 'Reply by Nov 30' }), dueDate: '2026-11-30T00:00:00Z' },
    item(JIHO, 'needsYou', [CD], 'dispute', { product: 'Knit Cardigan', who: 'Ji-ho Park · KR', category: 'Not as described · Color' }),
    item(MIKE, 'needsYou', [SW], 'dispute', { who: 'Mike Morgan · US', category: 'Not received · Repeat claim' }),
  ]),
  group('prevent', [
    item('tracking', 'prevent', [CD, 'FK-BN-SET'], 'tracking', { head: '2 orders', product: 'Several products', category: 'Missing tracking', who: 'x' }),
    item(CD, 'prevent', [CD], 'prevent', { head: 'Knit Cardigan', product: null, category: 'Black Friday rehearsal', who: 'y' }),
  ]),
];

const FILTER: ProductFilterView = {
  chips: [
    { sku: null, name: 'All products', sub: '', icon: 'multi', cases: 3, units: 375, href: '/', selected: true },
    { sku: SW, name: 'Wool Sweater', sub: '', icon: 'sweater', cases: 2, units: 80, href: '', selected: false },
    { sku: CD, name: 'Knit Cardigan', sub: '', icon: 'cardigan', cases: 1, units: 120, href: '', selected: false },
    { sku: CO, name: 'Cashmere Coat', sub: '', icon: 'coat', cases: 0, units: 25, href: '', selected: false },
  ],
  summary: '',
  selectedSku: null,
  products: 4,
  units: 375,
};

/** 엔진 무응답 pChargeback 자리 (손으로 넣은 값). Mike·추적·Prevent는 값 없음 (risk-source가 넣지 않는다). */
const RISK = { [SEO]: 0.89, [JIHO]: 0.38 };

// ───────────────────────────── 4. 목록 위험 % 칩 ─────────────────────────────

describe('T122b-4: 목록 줄마다 위험 % 칩 (엔진 값, 단계·색은 설정 기준)', () => {
  it('단계는 config/motion.json desk.riskLevel(T122d, 시안 riskLvl 45%·20%) 기준: high → High, med → Medium, low → Low', () => {
    expect(loadRiskLevel()).toEqual({ highFrom: 0.45, midFrom: 0.2 });
    expect(() => loadRiskLevel({ desk: {} })).toThrow();
    expect(riskLevelOf(0.3, { highFrom: 0.3, midFrom: 0.1 })).toBe('high');
    expect([0.1, 0.3, 0.5].map((p) => riskLevelTone(p))).toEqual(['low', 'mid', 'high']);
    expect([0.02, 0.19, 0.2, 0.38, 0.449, 0.45, 0.49, 0.5, 0.89].map(riskLevel)).toEqual([
      'low', 'low', 'med', 'med', 'med', 'high', 'high', 'high', 'high',
    ]);
    // 알약·입력칸 테두리 빨강은 따로 riskColor(50%) — 단계 기준과 섞지 않는다
    expect(riskTone(0.49)).toBe('mid');
    expect(riskChipParts(0.89)).toEqual({ percent: '89%', level: 'high', levelKey: 'today.risk.level.high' });
    expect(t('today.risk.chip', { percent: '89%', level: t('today.risk.level.high') })).toBe('89% · High');
    expect(copyTables.ko['today.risk.level.med']).toBe('중간');
  });

  it('값이 있는 줄만 칩 ("89% · High" + 시안 lvl 색 class + riskTip 제목). 값 없는 줄(Mike·추적·Prevent)·끝낸 줄은 칩 없음', () => {
    const list = html(createElement(TodayGroupsView, { groups: GROUPS, done: {}, selectedId: SEO, risk: RISK }));
    expect(list).toContain(`<span class="today-risk today-risk-high" title="${t('today.risk.tip')}">89% · High</span>`);
    expect(list).toMatch(/class="today-risk today-risk-(med|low)"[^>]*>38% · (Medium|Low)</);
    expect(list.match(/class="today-risk /g)).toHaveLength(2);
    // 같은 줄 안: 구매자 + 칩 (시안 L148)
    expect(list).toContain('<span class="today-item-subrow"><span class="today-item-sub">Seo-yeon Kim · KR</span><span class="today-risk today-risk-high"');

    const done = html(createElement(TodayGroupsView, { groups: GROUPS, done: { [SEO]: { simulated: true } }, selectedId: SEO, risk: RISK }));
    expect(done.match(/class="today-risk /g)).toHaveLength(1);
    expect(done).toContain(t('today.group.doneSimulated'));
  });

  it('값이 오기 전(상자 비어 있음)에는 칩이 없다 — 지어내지 않는다', () => {
    const list = html(createElement(RiskValuesProvider, null, createElement(TodayGroupsView, { groups: GROUPS, done: {}, selectedId: SEO })));
    expect(list).not.toContain('today-risk');
  });

  it('묶음 이름: Reply needed / Prevent / Questions / Done today (시안 v6 secs)', () => {
    expect(['needsYou', 'prevent', 'routine', 'done'].map((key) => t(`today.group.${key}`))).toEqual(['Reply needed', 'Prevent', 'Questions', 'Done today']);
    expect(t('today.groupHint.routine')).toBe('AI answered · just check');
    expect(copyTables.ko['today.group.routine']).toBe('단순 문의');
  });

  it('값은 서버 risk-source가 T105와 같은 무응답 예측(forecastReply 빈 글 + noReplyDays)에서 받고, 첫 화면을 막지 않게 따로 흘린다', () => {
    const source = strip(read('src/app/today/risk-source.ts'));
    expect(source).toMatch(/forecastReply\(\{\s*text: '',/);
    expect(source).toMatch(/delayDays: unansweredDays\(light\.events, now\) \+ NO_REPLY_DAYS/);
    expect(source).toMatch(/routineLine\(board, decideFor\(board\)\) !== null\) return null/);
    expect(source).not.toMatch(/Math\.(round|max|min)|\* 100/);
    const page = strip(read('src/app/(app)/page.tsx'));
    expect(page).toMatch(/<Suspense fallback=\{null\}>\s*<RiskLoader items=\{items\} \/>\s*<\/Suspense>/);
  });
});

// ───────────────────────────── 5. 전체 현황 ─────────────────────────────

describe('T122b-5: "All products" 전체 현황 값 (세기만, 엔진 위험 값 그대로)', () => {
  const ov = buildOverview({ groups: GROUPS, filter: FILTER, done: {}, risk: RISK, severalName: 'Several products' });

  it('Products 표: 칩 상품마다 한 줄 + 여러 상품 항목(추적)이 있으면 "Several products" 줄', () => {
    expect(ov.products.map((row) => row.key)).toEqual([SW, CD, CO, MULTI_KEY]);
    const [sw, cd, co, multi] = ov.products;
    expect([sw.open, sw.reply, sw.prevent, sw.questions]).toEqual([2, 2, 0, 0]);
    expect(sw.risk).toBe(0.89);
    expect(sw.top?.id).toBe(SEO);
    expect([cd.open, cd.reply, cd.prevent]).toEqual([2, 1, 1]);
    expect(cd.risk).toBe(0.38);
    expect(co).toMatchObject({ open: 0, risk: null, top: null });
    expect(multi).toMatchObject({ sku: null, units: null, open: 1, prevent: 1, risk: null });
    expect(multi.top?.id).toBe('tracking');
  });

  it('요약 카드 숫자 = 열린 항목 수 (평균은 화면이 내지 않는다 — 상품 줄 최고 위험 목록만 엔진 자리에 넘긴다, T122d)', () => {
    expect(ov.kpis).toEqual({
      open: 5, reply: 3, prevent: 2, questions: 0, products: 4, units: 375, topRows: 3,
      topRisks: ov.products.flatMap((row) => (row.risk === null ? [] : [row.risk])),
    });
    expect(ov.kpis.topRisks.length).toBeGreaterThan(0);
    const done = buildOverview({ groups: GROUPS, filter: FILTER, done: { [SEO]: { simulated: false } }, risk: RISK, severalName: 'S' });
    expect(done.kpis.open).toBe(4);
    expect(done.products[0]).toMatchObject({ open: 1, risk: null, top: { id: MIKE } });
    // Cases 표에는 끝낸 항목도 남는다 (상태 Done today, 위험 없음)
    expect(done.cases.find((row) => row.id === SEO)).toMatchObject({ section: 'done', done: true, risk: null });
  });

  it('Cases by risk 표: 목록 모든 항목, 구매자는 분쟁만, 기한 정렬 값', () => {
    expect(ov.cases.map((row) => row.id)).toEqual([SEO, JIHO, MIKE, 'tracking', CD]);
    expect(ov.cases[0]).toMatchObject({ risk: 0.89, who: 'Seo-yeon Kim · KR', due: 'Reply by Nov 30', section: 'needsYou' });
    expect(ov.cases[3]).toMatchObject({ who: '', risk: null, section: 'prevent', dueMs: Number.POSITIVE_INFINITY });
  });

  it('AG Grid 열: 모두 정렬 가능, 숫자·위험은 ↓ 먼저, 글자는 ↑ 먼저, 처음 정렬 = 위험 ↓, 위험 비교에서 값 없음이 가장 낮다', () => {
    const p = productColumns(t);
    const c = caseColumns(t);
    expect(p.map((col) => col.headerName)).toEqual(['Product', 'Open cases', 'Reply needed', 'Prevent', 'Questions', 'Dispute risk', 'Riskiest case']);
    expect(c.map((col) => col.headerName)).toEqual(['Dispute risk', 'Case', 'Dispute type', 'Status', 'Buyer', 'Due']);
    for (const col of [...p, ...c] as ColDef[]) {
      expect(col.sortable, col.colId).toBe(true);
      expect(col.headerComponent, col.colId).toBeTypeOf('function');
    }
    expect(p.find((col) => col.colId === 'open')?.sortingOrder).toEqual(['desc', 'asc']);
    expect(p.find((col) => col.colId === 'name')?.sortingOrder).toEqual(['asc', 'desc']);
    expect(p.filter((col) => col.initialSort !== undefined).map((col) => [col.colId, col.initialSort])).toEqual([['risk', 'desc']]);
    expect(c.filter((col) => col.initialSort !== undefined).map((col) => [col.colId, col.initialSort])).toEqual([['risk', 'desc']]);

    // AG Grid가 쓰는 비교 함수로 정렬하면 시안 순서 (위험 ↓, 값 없음은 뒤)
    const byRisk = [...ov.cases].sort((a, b) => -compareRisk(a.risk, b.risk)).map((row) => row.id);
    expect(byRisk.slice(0, 2)).toEqual([SEO, JIHO]);
    expect(compareRisk(null, 0)).toBeLessThan(0);
    // 상태 열은 묶음 순서로 (Reply needed → Prevent → Questions → Done today)
    const status = c.find((col) => col.colId === 'status');
    const statusOf = (row: OvCaseRow) => (status?.valueGetter as (p: { data: OvCaseRow }) => number)({ data: row });
    expect(ov.cases.map(statusOf)).toEqual([0, 0, 0, 1, 1]);
    // 열 폭은 시안 pCols·cCols 그대로 (grid.ts)
    expect(p.find((col) => col.colId === 'open')?.width).toBe(DESK_OV_COLS.products.open.width);
    expect(c.find((col) => col.colId === 'due')?.width).toBe(DESK_OV_COLS.cases.due.width);
  });

  it('행 클릭: 상품 줄 → 그 상품 칩, "Several products" 줄 → 가장 위험한 항목, 빈 줄 → 아무것도', () => {
    const [sw, , co, multi] = ov.products;
    expect(productRowAction(sw)).toEqual({ kind: 'sku', sku: SW });
    expect(productRowAction(multi)).toEqual({ kind: 'item', id: 'tracking' });
    expect(productRowAction({ ...co, sku: null } as OvProductRow)).toBeNull();
    // 표는 행 클릭·Enter/Space로 고르기 상자만 부른다 (링크·router 없음)
    const code = strip(read('src/app/today/overview.tsx'));
    expect(code).toMatch(/onRowClicked=\{\(event: RowClickedEvent<Row>\) => \{\s*if \(event\.data !== undefined\) onPick\(event\.data\);/);
    expect(code).toMatch(/isSelectKey\(key\)/);
    expect(code).toMatch(/selection\.setSku\(action\.sku\)/);
    expect(code).toMatch(/selection\?\.select\(row\.id\)/);
    expect(code).not.toMatch(/next\/link|<Link\b|useRouter|fetch\(/);
  });

  it('공용 AG Grid 설정을 쓴다 (모듈·테마는 _shared/grid/grid.ts, 색은 desk.css 변수)', () => {
    const code = strip(read('src/app/today/overview.tsx'));
    expect(code).toMatch(/modules=\{GRID_MODULES\}/);
    expect(code).toMatch(/theme=\{deskGridTheme\}/);
    expect(GRID_MODULES.length).toBeGreaterThan(0);
    expect(deskGridTheme).toBeDefined();
    const css = read('src/app/(app)/desk.css');
    expect(css).toMatch(/\.dk \.ov-grid\{--dk-ag-accent:#002991;[^}]*--dk-ag-head-bg:#F8F9FB/);
    expect(css).toMatch(/\.dk \.ag-tag\{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:1000px;background:#F1F3F6/);
    expect(css).toMatch(/\.dk \.today-overview\[hidden\]\{display:none\}/);
  });

  it('All products + 고른 항목 없음 → 전체 현황: 제목 · "AG Grid" 꼬리표 · 요약 카드 5개 · 표 2개 · "N rows · Sorted by Dispute risk ↓"', () => {
    const markup = html(
      createElement(
        RiskValuesProvider,
        { initial: RISK },
        createElement(TodaySelectionProvider, { initialItem: null, initialSku: null, groups: GROUPS }, createElement(OverviewPane, { groups: GROUPS, filter: FILTER })),
      ),
    );
    expect(markup).toContain('<section class="today-overview" aria-label="All products">');
    expect(markup).toMatch(/<span class="ag-tag"><svg[\s\S]*?<\/svg>AG Grid<\/span>/);
    expect(markup.match(/class="ov-k"/g)).toHaveLength(5);
    expect(markup).toContain('Avg. dispute risk');
    const avgExpected = meanRisk(ov.kpis.topRisks);
    expect(avgExpected).not.toBeNull();
    expect(markup).toContain(`class="ov-k-val ov-k-val-big">${chipParts(avgExpected as number).percent}<`);
    expect(markup).toContain('Riskiest case · 3 products');
    expect(markup.match(/class="ag ov-grid"/g)).toHaveLength(2);
    expect(markup).toContain('<div class="ag-f"><span>4 rows</span><span>Sorted by Dispute risk ↓</span></div>');
    expect(markup).toContain('<div class="ag-f"><span>5 rows</span><span>Sorted by Dispute risk ↓</span></div>');
    expect(markup).toContain('Click a column to sort · click a row to open');
  });

  it('상품을 골랐거나 항목을 열면 전체 현황은 숨는다. 전체 현황에서 연 항목엔 "← All products overview"', () => {
    const picked = html(
      createElement(TodaySelectionProvider, { initialItem: SEO, initialSku: SW, groups: GROUPS }, createElement(OverviewPane, { groups: GROUPS, filter: FILTER }), createElement(BackToAll)),
    );
    expect(picked).toContain('<section class="today-overview" hidden=""');
    expect(picked).not.toContain('class="ag ov-grid"');
    expect(picked).not.toContain('today-back-all');
    const fromAll = html(createElement(TodaySelectionProvider, { initialItem: SEO, initialSku: null, groups: GROUPS }, createElement(BackToAll)));
    expect(fromAll).toContain('← All products overview');
  });
});

// ───────────────────────────── 6. 상품 칩 ─────────────────────────────

describe('T122b-6: 상품 칩 → 그 상품 항목만, 오른쪽은 그 상품의 첫 항목 (All products → 전체 현황)', () => {
  it('첫 항목 = Reply needed → Prevent → Questions 순으로 끝내지 않은 첫 항목, 없으면 null', () => {
    expect(firstItemFor(GROUPS, SW, {})).toBe(SEO);
    expect(firstItemFor(GROUPS, SW, { [SEO]: { simulated: true } })).toBe(MIKE);
    expect(firstItemFor(GROUPS, CD, {})).toBe(JIHO);
    expect(firstItemFor(GROUPS, CD, { [JIHO]: { simulated: true } })).toBe('tracking');
    expect(firstItemFor(GROUPS, CO, {})).toBeNull();
    // 모두 끝냈으면 그 상품의 첫 항목 (Done today에서 다시 볼 수 있다)
    expect(firstItemFor(GROUPS, SW, { [SEO]: { simulated: true }, [MIKE]: { simulated: true } })).toBe(SEO);
  });

  it('칩 거르기: 그 상품 항목만 목록에 남는다', () => {
    expect(filterGroups(GROUPS, SW).flatMap((g) => g.items.map((i) => i.id))).toEqual([SEO, MIKE]);
    expect(filterGroups(GROUPS, CO)).toEqual([]);
    const list = html(
      createElement(
        TodaySelectionProvider,
        { initialItem: SEO, initialSku: SW, groups: GROUPS },
        createElement((() => {
          // 화면용 TodayGroups와 같은 거르기
          return createElement(TodayGroupsView, { groups: filterGroups(GROUPS, SW), done: {}, selectedId: SEO });
        }) as React.FC),
      ),
    );
    expect(list).toContain(`data-item="${SEO}"`);
    expect(list).toContain(`data-item="${MIKE}"`);
    expect(list).not.toContain(`data-item="${JIHO}"`);
  });

  it('빈 상품: 시안 isEmpty 안내 ("No disputes yet" + 상품 이름)', () => {
    const empty = html(createElement(TodaySelectionProvider, { initialItem: null, initialSku: CO, groups: GROUPS }, createElement(DetailEmpty, { names: { [CO]: 'Cashmere Coat' } })));
    expect(empty).toContain('<h2 class="today-empty-title">No disputes yet</h2>');
    expect(empty).toContain('Cashmere Coat has no open disputes or questions.');
    const overview = html(createElement(TodaySelectionProvider, { initialItem: null, initialSku: null, groups: GROUPS }, createElement(DetailEmpty, { names: {} })));
    expect(overview).toBe('');
  });

  it('주소: All products = ?sku=all (sku 없음 = 처음 상태: 첫 항목의 상품, 시안 초기 state)', () => {
    expect(ALL_PRODUCTS_PARAM).toBe('all');
    expect(todaySearch('', null, null)).toBe('?sku=all');
    expect(todaySearch('?lang=ko', SW, SEO)).toBe('?lang=ko&sku=FK-SW-NV&item=PP-R-GMS-10197661');
    const page = strip(read('src/app/(app)/page.tsx'));
    expect(page).toMatch(/requestedSku === ALL_PRODUCTS_PARAM/);
    expect(page).toMatch(/return \{ sku: skus\.length === 1 \? skus\[0\] : null, selectedId: selected\?\.id \?\? null \};/);
    // 칩 → 첫 항목 (상자는 서버 왕복 없이)
    const selection = strip(read('src/app/today/selection.tsx'));
    expect(selection).toMatch(/firstItemFor\(groups, next, done\)/);
  });
});
