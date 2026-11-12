/**
 * T114 단위 테스트: /products 화면 제거 (11/12 11:15 결정). AG Grid 공용 설정·엔진은 남긴다.
 *
 * - `/products`(쿼리·하위 경로 포함) → `/` 308 영구 이동.
 * - Desk·/intro·/listing·공용 코드에 `/products`로 가는 링크·주소가 0개.
 * - 공용 AG Grid 설정(`_shared/grid/grid.ts`)의 테마(디자인 변수만)·셀 깜빡임·기본 열 설정을 지킨다 (T065에서 옮김).
 * 실호출 0회 (PayPal·AI·개발 서버 없음).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { HighlightChangesModule } from 'ag-grid-community';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { copyTables } from '@/app/_shared/copy';
import {
  baseGridOptions,
  FLASH_ON_CHANGE,
  GRID_DEFAULT_COL_DEF,
  GRID_MODULES,
  GRID_THEME_PARAMS,
  gridTheme,
  isSelectKey,
} from '@/app/_shared/grid/grid';
import { GET, REMOVED_ROUTE_STATUS } from '@/app/products/[[...rest]]/route';

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe('T114 /products → / 308', () => {
  const go = (url: string) => GET(new NextRequest(new URL(url)));

  it('/products는 /로 308 영구 이동', () => {
    const res = go('http://localhost:3000/products');
    expect(REMOVED_ROUTE_STATUS).toBe(308);
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get('location')!, 'http://x').pathname).toBe('/');
  });

  it('Location이 http로 시작하지 않는 상대 경로이고, request.url 호스트가 localhost:10000이어도 그 호스트가 들어가지 않는다', () => {
    const res = go('https://localhost:10000/products?sku=FK-CD-OAT&lang=ko');
    const location = res.headers.get('location')!;
    expect(res.status).toBe(308);
    expect(location).not.toMatch(/^https?:/);
    expect(location).not.toContain('localhost');
    expect(location).not.toContain('10000');
    expect(location).toBe('/?sku=FK-CD-OAT&lang=ko');
    expect(go('https://localhost:10000/products').headers.get('location')).toBe('/');
  });

  it('/products?… 쿼리도 같은 사이트 /로 308 (쿼리는 그대로 넘긴다)', () => {
    const res = go('http://localhost:3000/products?sku=FK-CD-OAT&lang=ko');
    expect(res.status).toBe(308);
    const loc = new URL(res.headers.get('location')!, 'http://localhost:3000');
    expect(loc.origin).toBe('http://localhost:3000');
    expect(loc.pathname).toBe('/');
    expect(loc.searchParams.get('sku')).toBe('FK-CD-OAT');
    expect(loc.searchParams.get('lang')).toBe('ko');
  });

  it('/products/… 하위 경로도 같은 라우트(선택적 모든 경로)가 받는다', () => {
    expect(existsSync(path.join(ROOT, 'src/app/products/[[...rest]]/route.ts'))).toBe(true);
    const res = go('http://localhost:3000/products/FK-SW-NV');
    expect(res.status).toBe(308);
    expect(new URL(res.headers.get('location')!, 'http://x').pathname).toBe('/');
  });

  it('화면 파일이 없다: (app)/products 페이지 없음, products 폴더에는 이동 라우트만', () => {
    expect(existsSync(path.join(ROOT, 'src/app/(app)/products'))).toBe(false);
    const left = filesUnder(path.join(ROOT, 'src/app/products')).map((f) => path.relative(ROOT, f));
    expect(left).toEqual(['src/app/products/[[...rest]]/route.ts']);
  });

  it('이동 라우트는 데이터·PayPal·AI를 부르지 않는다', () => {
    const src = strip(read('src/app/products/[[...rest]]/route.ts'));
    expect(src).not.toMatch(/_server|@\/paypal|@\/ai|@\/engine|seed/);
  });
});

describe('T114 /products 링크·주소 0개', () => {
  const appFiles = filesUnder(path.join(ROOT, 'src/app'))
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .map((f) => path.relative(ROOT, f))
    .filter((f) => !f.startsWith('src/app/products/'));

  it('src/app 코드(주석 뺌)에 /products 주소가 없다 (Desk·/intro·/listing·공용 모두)', () => {
    expect(appFiles.length).toBeGreaterThan(0);
    for (const file of appFiles) {
      expect(strip(read(file)), file).not.toMatch(/['"`]\/products\b|href=\{?['"`]?\/products/);
    }
  });

  it('src/app 어디도 옛 @/app/products 모듈을 import하지 않는다', () => {
    for (const file of appFiles) {
      expect(read(file), file).not.toMatch(/from ['"](@\/app\/products|\.{1,2}\/(\.\.\/)*products)\//);
    }
  });

  it('문구: products 전용 키는 지웠고 Today가 쓰는 처방 제목 4개만 남았다 (en/ko 같은 키)', () => {
    const en = Object.keys(copyTables.en).filter((k) => k.startsWith('product.')).sort();
    const ko = Object.keys(copyTables.ko).filter((k) => k.startsWith('product.')).sort();
    expect(en).toEqual([
      'product.fix.color_note.title',
      'product.fix.kr_customs_notice.title',
      'product.fix.settle_first.title',
      'product.fix.tracking_24h.title',
    ]);
    expect(ko).toEqual(en);
    expect(Object.keys(copyTables.ko).sort()).toEqual(Object.keys(copyTables.en).sort());
  });
});

describe('T114 공용 AG Grid 설정 (T065에서 옮김)', () => {
  it('셀 깜빡임: HighlightChangesModule을 싣고, 깜빡임 열 설정이 켜져 있다', () => {
    expect(GRID_MODULES).toContain(HighlightChangesModule);
    expect(FLASH_ON_CHANGE.enableCellChangeFlash).toBe(true);
    // 깜빡임을 끄는 설정(시간 0)을 쓰지 않는다
    expect(baseGridOptions().cellFlashDuration).not.toBe(0);
  });

  it('기본 열 설정: 정렬·필터·열 메뉴·열 옮기기·너비 바꾸기를 끈다', () => {
    const options = baseGridOptions<{ id: string }>();
    expect(options.defaultColDef).toMatchObject({
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
    });
    expect(options.defaultColDef).toEqual({ ...GRID_DEFAULT_COL_DEF });
    expect(options.suppressMovableColumns).toBe(true);
    const getRowId = ({ data }: { data: { id: string } }) => data.id;
    expect(baseGridOptions<{ id: string }>({ getRowId }).getRowId).toBe(getRowId);
  });

  it('테마 = 디자인 변수만 (강조색 하나, 글꼴 = 지금 글꼴, AG Grid 기본 파랑 없음)', () => {
    expect(gridTheme).toBeDefined();
    expect(GRID_THEME_PARAMS.accentColor).toBe('var(--color-accent)');
    expect(GRID_THEME_PARAMS.fontFamily).toBe('var(--font-sans)');
    expect(GRID_THEME_PARAMS.borderColor).toBe('var(--color-border)');
    for (const [key, value] of Object.entries(GRID_THEME_PARAMS)) {
      if (typeof value === 'string' && /color$/i.test(key) && key !== 'browserColorScheme') {
        expect(value, key).toMatch(/^var\(--|^color-mix\(in srgb, var\(--color-accent\) \d+%, transparent\)$/);
      }
    }
    const source = read('src/app/_shared/grid/grid.ts').toLowerCase();
    expect(source).not.toMatch(/#2196f3|rgb\(\s*33\s*,\s*150\s*,\s*243\s*\)/);
    expect(source).not.toMatch(/\$\s?\d|toFixed|Math\.round/);
  });

  it('키보드: Enter·Space로 고른다', () => {
    expect(isSelectKey('Enter')).toBe(true);
    expect(isSelectKey(' ')).toBe(true);
    expect(isSelectKey('Tab')).toBe(false);
  });

  it('ag-grid 패키지는 package.json에 남아 있다', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.['ag-grid-community']).toBeTruthy();
    expect(pkg.dependencies?.['ag-grid-react']).toBeTruthy();
  });
});
