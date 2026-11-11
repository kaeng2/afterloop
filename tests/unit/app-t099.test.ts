/**
 * T099 단위 테스트: 미리보기 제목에 구매자 이름(대명사 없음), Prevent 행의 짧은 카드(/products 링크 없음).
 * 실호출 0회 — 분쟁은 손으로 만든 값, 엔진 숫자는 엔진 함수를 다시 불러 비교한다. 시험은 아무것도 쓰지 않는다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { copyTables, t } from '@/app/_shared/copy';
import { toDollarsRounded } from '@/app/_shared/money';
import { NAV_ITEMS } from '@/app/_shared/nav-items';
import { buildToday, selectItem } from '@/app/today/model';
import { PreventCard } from '@/app/today/prevent-card';
import { TodayList } from '@/app/today/today-list';
import { FIX_ORDER, fixSavings, simInputFor } from '@/engine/sim';
import { pickPreventProduct, simulateStore } from '@/engine/storefront';
import { seedProducts } from '../../seed/index';

(globalThis as { React?: typeof React }).React = React;

const ROOT =path.resolve(__dirname, '../..');
const view = buildToday({ disputes: [], tracking: null, products: seedProducts, now: new Date('2026-11-10T09:00:00Z') });
const prevent = view.groups.flatMap((group) => group.items).find((item) => item.kind === 'prevent');

describe('T099 미리보기 제목 = 구매자 이름', () => {
  it('서연·지호 각각 이름으로, 대명사가 없다 (en·ko)', () => {
    const KO = t('case.view.lang.KO');
    expect(t('case.reply.sheSees', { name: 'Seo-yeon', language: KO })).toBe('Seo-yeon will see (Korean)');
    expect(t('case.reply.sheSees', { name: 'Ji-ho', language: KO })).toBe('Ji-ho will see (Korean)');
    for (const table of [copyTables.en, copyTables.ko]) {
      expect(table['case.reply.sheSees']).toContain('{{name}}');
      expect(table['case.reply.sheSees']).not.toMatch(/\b(She|He)\b/);
    }
  });

  it('화면은 이름을 buyerShort(데이터)에서 넘긴다', () => {
    const src = readFileSync(path.join(ROOT, 'src/app/cases/reply/reply-panel.tsx'), 'utf8');
    expect(src).toMatch(/t\('case\.reply\.sheSees', \{ name: buyerShort, language \}\)/);
  });
});

describe('T099 Prevent 짧은 카드', () => {
  it('주소는 /?item=<SKU> (Products로 가지 않는다)', () => {
    expect(prevent?.href).toBe(`/?item=${prevent?.id}`);
    const html = renderToStaticMarkup(createElement(TodayList, { view, selectedId: null, paypalNotice: null }));
    expect(html).not.toMatch(/href="[^"]*\/(products|listing)/);
  });

  it('주소로 고르면 카드가 열리고, 처음에는 고르지 않는다', () => {
    expect(selectItem(view, prevent?.id)?.kind).toBe('prevent');
    expect(selectItem(view, undefined)?.kind).not.toBe('prevent');
  });

  it('숫자는 엔진 값 (pickPreventProduct · fixSavings)', () => {
    const store = simulateStore(seedProducts, [...FIX_ORDER]);
    const pick = pickPreventProduct(store);
    const product = seedProducts.find((p) => p.sku === pick?.sku);
    expect(pick).not.toBeNull();
    const detail = prevent?.prevent;
    expect(detail).toMatchObject({
      sku: pick?.sku,
      stock: product?.stock,
      beforeCents: pick?.beforeCents,
      afterCents: pick?.afterCents,
      cutPercent: pick?.cutPercent,
    });
    const savings = fixSavings(simInputFor(product!.sku, product!, []))
      .filter((row) => row.savingCents > 0)
      .map((row) => ({ fix: row.fix, savingCents: row.savingCents }));
    expect(detail?.fixes).toEqual(savings);

    const html = renderToStaticMarkup(createElement(PreventCard, { detail: detail! }));
    expect(html).toContain(toDollarsRounded(pick!.beforeCents));
    expect(html).toContain(toDollarsRounded(pick!.afterCents));
    expect(html).toContain(`${pick!.cutPercent}%`);
    for (const row of savings) expect(html).toContain(toDollarsRounded(row.savingCents));
  });

  it('카드에 버튼·링크·폼이 없다 (쓰기 0), 카드 코드는 PayPal·AI·서버 액션을 부르지 않는다', () => {
    const html = renderToStaticMarkup(createElement(PreventCard, { detail: prevent!.prevent! }));
    expect(html).not.toMatch(/<(button|a|form)\b/);
    const src = readFileSync(path.join(ROOT, 'src/app/today/prevent-card.tsx'), 'utf8');
    expect(src).not.toMatch(/from '@\/(paypal|ai|exec)|actions'|fetch\(/);
  });
});

describe('T099 /products·/listing 링크 0', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const file = path.join(dir, name);
      return statSync(file).isDirectory() ? walk(file) : [file];
    });

  it('Desk(Today·사례) 코드에 /products·/listing 로 가는 링크가 없다', () => {
    const files = [
      ...walk(path.join(ROOT, 'src/app/today')),
      ...walk(path.join(ROOT, 'src/app/cases')),
      path.join(ROOT, 'src/app/(app)/page.tsx'),
    ].filter((file) => /\.tsx?$/.test(file));
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/href=["'{`][^>]*\/(listing|products)/);
      expect(src, file).not.toMatch(/`\/products\?sku=/);
    }
  });

  it('탭 목록에 /products가 없다', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(['/']);
  });
});
