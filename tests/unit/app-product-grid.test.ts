/**
 * T065 단위 테스트: Products 상품 표 (AG Grid Community).
 *
 * 기대값 출처: `tasks/T065.md` "만들 것"·"완료 기준". 숫자 기대값은 적지 않는다 —
 * **같은 입력으로 엔진(`simulate`·`simulateStore`)을 불러 얻은 값과 같다**로 본다. 실호출 0회.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { copyTables, t } from '@/app/_shared/copy';
import { toDollarsRounded } from '@/app/_shared/money';
import {
  isSelectKey,
  PRODUCT_GRID_MODULES,
  PRODUCT_GRID_THEME_PARAMS,
  productGridColumns,
  productGridOptions,
  productGridRowId,
  productGridTheme,
  SELECTED_ROW_CLASS,
} from '@/app/products/grid';
import { buildProductRows, orderedFixes, type ProductRow } from '@/app/products/model';
import { FIX_ORDER, simInputFor, simulate } from '@/engine/sim';
import { simulateStore } from '@/engine/storefront';
import type { FixId, ParamsConfig, PolicyConfig } from '@/types';
import { HighlightChangesModule } from 'ag-grid-community';

import { seedProducts } from '../../seed/index';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));
(globalThis as { React?: typeof React }).React = React;

const { ProductList } = await import('@/app/products/views');
const { ProductGrid } = await import('@/app/products/product-grid');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const P = JSON.parse(read('tests/acceptance/params.fixture.json')) as ParamsConfig;
const R = JSON.parse(read('tests/acceptance/rules.fixture.json')) as PolicyConfig;
const engine = { config: P, rules: R };
const CARDIGAN_SKU = 'FK-CD-OAT';

/** AG Grid가 셀 값을 읽는 방식 그대로 (field) */
const cellValue = (row: ProductRow, colId: string) => {
  const col = productGridColumns().find((c) => c.colId === colId);
  return row[col?.field as keyof ProductRow];
};

describe('행 데이터 = T062 보기용 함수 결과', () => {
  it('표에 들어가는 행 = buildProductRows 결과 그대로 (순서 = simulateStore)', () => {
    const rows = buildProductRows(seedProducts, [...FIX_ORDER], CARDIGAN_SKU, engine);
    const store = simulateStore(seedProducts, [...FIX_ORDER], P, R);
    expect(rows.map((r) => r.sku)).toEqual(store.products.map((p) => p.sku));
    // 서버 렌더(첫 그림)는 같은 행을 그대로 그린다
    const markup = renderToStaticMarkup(createElement(ProductGrid, { rows }));
    for (const row of rows) {
      expect(markup).toContain(row.valuesText);
      expect(markup).toContain(`data-sku="${row.sku}"`);
    }
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('data-grid-fallback="true"');
  });

  it('열 3개: Product · Left · As-is → With fixes (마지막 열 = valuesText, 두 값을 함께)', () => {
    const cols = productGridColumns();
    expect(cols.map((c) => c.colId)).toEqual(['product', 'left', 'values']);
    expect(cols.map((c) => c.field)).toEqual(['name', 'stock', 'valuesText']);
    expect(cols.map((c) => c.headerName)).toEqual([
      t('product.grid.col.product'),
      t('product.grid.col.left'),
      t('product.grid.col.values'),
    ]);
    const rows = buildProductRows(seedProducts, [...FIX_ORDER], null, engine);
    for (const row of rows) {
      expect(cellValue(row, 'values')).toBe(
        t('product.row.values', { asIs: row.asIs.text, withFixes: row.withFixes.text }),
      );
      expect(cellValue(row, 'product')).toBe(row.name);
      expect(cellValue(row, 'left')).toBe(row.stock);
    }
  });

  it('문구 키는 두 언어 모두 있다', () => {
    for (const key of ['product.grid.label', 'product.grid.col.product', 'product.grid.col.left', 'product.grid.col.values']) {
      expect(copyTables.en[key], key).toBeTruthy();
      expect(copyTables.ko[key], key).toBeTruthy();
    }
  });
});

describe('처방 토글 → 바뀐 셀만 깜빡임', () => {
  const subsets: FixId[][] = [[], ['tracking_24h'], ['color_note', 'settle_first'], [...FIX_ORDER]];

  it('토글 뒤 각 행의 With fixes 값 = 그 상품 simulate 결과', () => {
    for (const fixes of subsets) {
      const rows = buildProductRows(seedProducts, fixes, CARDIGAN_SKU, engine);
      for (const row of rows) {
        const product = seedProducts.find((p) => p.sku === row.sku);
        expect(product).toBeDefined();
        const result = simulate(simInputFor(row.sku, product!, orderedFixes(fixes), P), P, R);
        expect(row.withFixes.cents).toBe(result.after.meanLossCents);
        expect(row.asIs.cents).toBe(result.before.meanLossCents);
        expect(cellValue(row, 'values')).toBe(
          t('product.row.values', {
            asIs: toDollarsRounded(result.before.meanLossCents),
            withFixes: toDollarsRounded(result.after.meanLossCents),
          }),
        );
      }
    }
  });

  it('처방 하나를 끄면 값이 바뀐 행이 있고, 행 ID(sku)는 그대로다 (표 전체를 다시 그리지 않는다)', () => {
    const on = buildProductRows(seedProducts, [...FIX_ORDER], CARDIGAN_SKU, engine);
    const off = buildProductRows(seedProducts, FIX_ORDER.filter((f) => f !== 'settle_first'), CARDIGAN_SKU, engine);
    const ids = (rows: ProductRow[]) => rows.map((data) => productGridRowId({ data } as never));
    expect(ids(on)).toEqual(ids(off));
    expect(ids(on)).toEqual(on.map((r) => r.sku));
    const changed = on.filter((row, i) => cellValue(row, 'values') !== cellValue(off[i], 'values'));
    expect(changed.length).toBeGreaterThan(0);
    // 상품·재고 열은 토글로 바뀌지 않는다 → 깜빡이지 않는다
    on.forEach((row, i) => {
      expect(cellValue(row, 'product')).toBe(cellValue(off[i], 'product'));
      expect(cellValue(row, 'left')).toBe(cellValue(off[i], 'left'));
    });
  });

  it('깜빡임 설정이 켜져 있다 (With fixes 열만, 모듈 포함)', () => {
    const cols = productGridColumns();
    expect(cols.find((c) => c.colId === 'values')?.enableCellChangeFlash).toBe(true);
    expect(cols.filter((c) => c.enableCellChangeFlash).map((c) => c.colId)).toEqual(['values']);
    expect(PRODUCT_GRID_MODULES).toContain(HighlightChangesModule);
    const options = productGridOptions();
    expect(options.getRowId).toBe(productGridRowId);
    // 깜빡임을 끄는 설정(시간 0)을 쓰지 않는다
    expect(options.cellFlashDuration).not.toBe(0);
  });
});

describe('표 동작·모양', () => {
  it('정렬·필터·열 메뉴·열 옮기기를 끈다', () => {
    const options = productGridOptions();
    expect(options.defaultColDef).toMatchObject({
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
    });
    expect(options.suppressMovableColumns).toBe(true);
    for (const col of productGridColumns()) {
      expect(col.sortable).not.toBe(true);
      expect(col.filter).toBeFalsy();
    }
  });

  it('고른 상품 행에 클래스가 붙는다 (주소 ?sku=)', () => {
    const rows = buildProductRows(seedProducts, [...FIX_ORDER], CARDIGAN_SKU, engine);
    const rule = productGridOptions().rowClassRules?.[SELECTED_ROW_CLASS];
    expect(typeof rule).toBe('function');
    const picked = rows.filter((data) => (rule as (p: { data: ProductRow }) => boolean)({ data }));
    expect(picked.map((r) => r.sku)).toEqual([CARDIGAN_SKU]);
    expect(picked[0].href).toBe(`/products?sku=${CARDIGAN_SKU}`);
  });

  it('키보드: Enter·Space로 고른다', () => {
    expect(isSelectKey('Enter')).toBe(true);
    expect(isSelectKey(' ')).toBe(true);
    expect(isSelectKey('ArrowDown')).toBe(false);
    expect(isSelectKey('Tab')).toBe(false);
  });

  it('테마 = 디자인 변수만 (강조색 하나, 글꼴 = 지금 글꼴)', () => {
    expect(productGridTheme).toBeDefined();
    expect(PRODUCT_GRID_THEME_PARAMS.accentColor).toBe('var(--color-accent)');
    expect(PRODUCT_GRID_THEME_PARAMS.fontFamily).toBe('var(--font-sans)');
    expect(PRODUCT_GRID_THEME_PARAMS.borderColor).toBe('var(--color-border)');
    for (const [key, value] of Object.entries(PRODUCT_GRID_THEME_PARAMS)) {
      if (typeof value === 'string' && /color$/i.test(key) && key !== 'browserColorScheme') {
        // 디자인 변수 그대로이거나, 강조색(--color-accent)을 옅게 섞은 값
        expect(value, key).toMatch(/^var\(--|^color-mix\(in srgb, var\(--color-accent\) \d+%, transparent\)$/);
      }
    }
    // 숫자 열은 폭 일정
    for (const id of ['left', 'values']) {
      expect(String(productGridColumns().find((c) => c.colId === id)?.cellClass)).toContain('num');
    }
  });

  it('ProductList는 표를 감싸고 제목·Demo 배지를 유지한다', () => {
    const rows = buildProductRows(seedProducts, [...FIX_ORDER], CARDIGAN_SKU, engine);
    const markup = renderToStaticMarkup(createElement(ProductList, { rows }));
    expect(markup).toContain('class="products-list"');
    expect(markup).toContain(t('product.list.title'));
  });
});

describe('정적 검사', () => {
  const files = ['src/app/products/grid.ts', 'src/app/products/product-grid.tsx', 'src/app/products/views.tsx', 'src/app/products/products.css'];

  it('표 코드에 금액 숫자·계산 없음', () => {
    for (const file of files.slice(0, 3)) {
      const source = read(file);
      expect(source, file).not.toMatch(/\$\s?\d/);
      expect(source, file).not.toMatch(/\/\s*100\b|toFixed|Math\.round/);
    }
  });

  it('AG Grid 기본 파랑 색 값이 없다', () => {
    for (const file of files) {
      const source = read(file).toLowerCase();
      expect(source, file).not.toMatch(/#2196f3|rgb\(\s*33\s*,\s*150\s*,\s*243\s*\)/);
    }
  });

  it('클라이언트 컴포넌트다 (서버 렌더에서 AG Grid를 그리지 않는다)', () => {
    expect(read('src/app/products/product-grid.tsx').startsWith("'use client'")).toBe(true);
  });
});
