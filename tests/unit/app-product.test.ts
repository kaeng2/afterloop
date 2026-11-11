/**
 * T062 단위 테스트: Products 탭 — 큰 숫자 + 점 그림 + 처방 카드 4개.
 *
 * 기대값 출처: `tasks/T062.md` "화면"·"완료 기준", 옛 `tasks/T013.md` (거래 조회 한 줄·색상 문구 규칙),
 * AC23 초안 (`tests/acceptance/drafts/AC23.md`). 숫자 기대값은 적지 않는다 — **같은 입력으로 엔진을 불러 얻은 값과 같다**로 본다.
 * **실호출 0회** — PayPal·LLM은 모두 가짜다. `.env`를 읽지 않는다.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ColorNote } from '@/ai/color-note';
import { copyTables, t } from '@/app/_shared/copy';
import { toDollarsRounded } from '@/app/_shared/money';
import {
  ALL_FIXES,
  buildDotPlot,
  buildProductRows,
  buildProductView,
  colorComplaintsFor,
  colorNoteView,
  defaultSku,
  disputesText,
  orderedFixes,
  selectSku,
  toggleFix,
  transactionLineView,
} from '@/app/products/model';
import { paramsConfigFromFile } from '@/engine/params';
import { FIX_ORDER, fixSavings, simInputFor, simulate } from '@/engine/sim';
import { pickPreventProduct, pickRepresentativeFuture, simulateStore } from '@/engine/storefront';
import { createMemoryTransactionCache, lastDays, type TransactionSummary } from '@/paypal/transactions';
import type { FixId, LlmCaller, ParamsConfig, PayPalClient, PolicyConfig, SeedProduct } from '@/types';

import { seedDisputes, seedInquiries, seedProducts } from '../../seed/index';

vi.mock('server-only', () => ({}));
// T065: 상품 표(`product-grid.tsx`)가 행 선택에 앱 라우터를 쓴다 (테스트에는 라우터가 없다)
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }) }));
(globalThis as { React?: typeof React }).React = React;

const { loadTransactionLine, TRANSACTION_DAYS } = await import('@/app/products/transactions-line');
const { colorNoteFor } = await import('@/app/products/color-note');
const { ColorNoteResult, ColorNoteSlot } = await import('@/app/products/color-note-card');
const { FixCards, Rehearsal, ProductList } = await import('@/app/products/views');
const { ProductsScreen } = await import('@/app/products/products-screen');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);

const P = JSON.parse(read('tests/acceptance/params.fixture.json')) as ParamsConfig;
const R = JSON.parse(read('tests/acceptance/rules.fixture.json')) as PolicyConfig;

const CARDIGAN = seedProducts.find((p) => p.sku === 'FK-CD-OAT') as SeedProduct;

/** 처방 16가지 조합 */
const ALL_COMBOS: FixId[][] = Array.from({ length: 1 << FIX_ORDER.length }, (_unused, mask) =>
  FIX_ORDER.filter((_fix, i) => (mask & (1 << i)) !== 0),
);

const engineFor = (product: SeedProduct, fixes: readonly FixId[], config: ParamsConfig = P, rules: PolicyConfig = R) =>
  simulate(simInputFor(product.sku, product, fixes, config), config, rules);

// ── 큰 숫자·범위·분쟁 수 = 엔진 ───────────────────────────────────────────

describe('buildProductView: 큰 숫자·범위·분쟁 수는 simulate 결과 그대로', () => {
  for (const fixes of [[], [...FIX_ORDER]] as FixId[][]) {
    it(`가디건, 처방 ${fixes.length}개`, () => {
      const view = buildProductView(CARDIGAN, fixes, { config: P, rules: R });
      const result = engineFor(CARDIGAN, fixes);

      expect(view.before.mean).toEqual({ cents: result.before.meanLossCents, text: toDollarsRounded(result.before.meanLossCents) });
      expect(view.before.p10.cents).toBe(result.before.p10LossCents);
      expect(view.before.p90.cents).toBe(result.before.p90LossCents);
      expect(view.before.meanDisputes).toBe(result.before.meanDisputes);
      expect(view.before.disputesText).toBe(disputesText(result.before.meanDisputes));

      const asIsLine = t('product.range.asIs', {
        disputes: disputesText(result.before.meanDisputes),
        mean: toDollarsRounded(result.before.meanLossCents),
        p10: toDollarsRounded(result.before.p10LossCents),
        p90: toDollarsRounded(result.before.p90LossCents),
      });

      if (fixes.length === 0) {
        expect(view.after).toBeNull();
        expect(view.rangeSentence).toBe(asIsLine);
        const markup = html(createElement(Rehearsal, { view, txLine: null }));
        expect(markup).toContain(t('product.noFixes'));
        expect(markup).not.toContain('data-side="after"');
      } else {
        expect(view.after?.mean).toEqual({ cents: result.after.meanLossCents, text: toDollarsRounded(result.after.meanLossCents) });
        expect(view.after?.p10.cents).toBe(result.after.p10LossCents);
        expect(view.after?.p90.cents).toBe(result.after.p90LossCents);
        expect(view.after?.meanDisputes).toBe(result.after.meanDisputes);
        const withLine = t('product.range.withFixes', {
          disputes: disputesText(result.after.meanDisputes),
          mean: toDollarsRounded(result.after.meanLossCents),
          p10: toDollarsRounded(result.after.p10LossCents),
          p90: toDollarsRounded(result.after.p90LossCents),
        });
        expect(view.rangeSentence).toBe(`${asIsLine} ${withLine}`);
        const markup = html(createElement(Rehearsal, { view, txLine: null }));
        expect(markup).toContain(toDollarsRounded(result.before.meanLossCents));
        expect(markup).toContain(toDollarsRounded(result.after.meanLossCents));
        expect(markup).not.toContain(t('product.noFixes'));
      }
    });
  }

  it('처방 16가지 조합 모두 화면 값 = 엔진 값, 순서를 바꿔 넘겨도 같다', () => {
    for (const fixes of ALL_COMBOS) {
      const view = buildProductView(CARDIGAN, [...fixes].reverse(), { config: P, rules: R });
      const result = engineFor(CARDIGAN, fixes);
      expect(view.before.mean.cents).toBe(result.before.meanLossCents);
      expect((view.after ?? view.before).mean.cents).toBe(result.after.meanLossCents);
      expect(view.fixesOn).toEqual(fixes);
    }
  });

  it('가정값 사본을 바꾸면 화면 값이 엔진 결과대로 바뀐다 (숫자를 적어 두지 않았다)', () => {
    const changed = structuredClone(P);
    changed.fixes.color_note.value.rateMultiplier.B1 = 0.8;
    const base = buildProductView(CARDIGAN, FIX_ORDER, { config: P, rules: R });
    const view = buildProductView(CARDIGAN, FIX_ORDER, { config: changed, rules: R });
    expect(view.after?.mean.cents).toBe(engineFor(CARDIGAN, FIX_ORDER, changed).after.meanLossCents);
    expect(view.after?.mean.cents).not.toBe(base.after?.mean.cents);
  });

  it('위 한 줄: 미래 개수와 재고는 엔진 입력·시드 그대로', () => {
    const view = buildProductView(CARDIGAN, FIX_ORDER, { config: P, rules: R });
    const input = simInputFor(CARDIGAN.sku, CARDIGAN, FIX_ORDER, P);
    expect(view.rehearsalLine).toBe(t('product.rehearsal', { futures: input.futures, stock: CARDIGAN.stock }));
  });

  it('같은 입력이면 같은 결과', () => {
    expect(buildProductView(CARDIGAN, FIX_ORDER, { config: P, rules: R })).toEqual(
      buildProductView(CARDIGAN, FIX_ORDER, { config: P, rules: R }),
    );
  });
});

// ── 점 그림 ────────────────────────────────────────────────────────────────

describe('점 그림: pickRepresentativeFuture 그대로', () => {
  for (const [label, config] of [
    ['고정 사본', P],
    ['라이브 config', paramsConfigFromFile()],
  ] as const) {
    it(`${label}: 빨간 점 수 = 엔진의 전·후 분쟁 수, 점 수 = 재고`, () => {
      const plot = buildDotPlot(CARDIGAN, FIX_ORDER, { config, rules: R });
      const future = pickRepresentativeFuture(simInputFor(CARDIGAN.sku, CARDIGAN, FIX_ORDER, config), config, R);
      expect(plot.futureIndex).toBe(future.futureIndex);
      expect(plot.dots).toHaveLength(CARDIGAN.stock);
      expect(plot.dots.filter((d) => d.redBefore)).toHaveLength(future.disputesBefore);
      expect(plot.dots.filter((d) => d.redAfter)).toHaveLength(future.disputesAfter);
      expect(plot.redBefore).toBe(future.disputesBefore);
      expect(plot.redAfter).toBe(future.disputesAfter);
      // 처방 후 빨간 점은 처방 전 빨간 점의 일부 (같은 난수)
      for (const dot of plot.dots) if (dot.redAfter) expect(dot.redBefore).toBe(true);

      const markup = html(createElement(Rehearsal, { view: buildProductView(CARDIGAN, FIX_ORDER, { config, rules: R }), txLine: null }));
      const before = markup.split('class="dots-panel" data-side="before"')[1].split('</figure>')[0];
      const after = markup.split('class="dots-panel" data-side="after"')[1].split('</figure>')[0];
      expect(before.match(/data-red="true"/g) ?? []).toHaveLength(future.disputesBefore);
      expect(after.match(/data-red="true"/g) ?? []).toHaveLength(future.disputesAfter);
      expect(markup).toContain(t('product.dots.legend'));
    });
  }

  it('빨간 점 클래스는 globals.css의 위험 색 변수를 쓴다', () => {
    expect(read('src/app/products/products.css')).toMatch(/\.dot-red\s*\{[^}]*var\(--color-danger\)/);
  });
});

// ── 처방 카드 ──────────────────────────────────────────────────────────────

describe('처방 카드 4개', () => {
  const view = buildProductView(CARDIGAN, ['tracking_24h', 'color_note'], { config: P, rules: R });

  it('FIX_ORDER 순서, 켠 상태, 실행 배지', () => {
    expect(view.fixes.map((c) => c.id)).toEqual([...FIX_ORDER]);
    expect(view.fixes.map((c) => c.on)).toEqual([true, true, false, false]);
    expect(view.fixes.map((c) => c.badge.text)).toEqual([
      t('product.fix.badge.paypal'),
      t('product.fix.badge.aiWrites'),
      t('product.fix.badge.simulated'),
      t('product.fix.badge.afterOk'),
    ]);
    expect(t('product.fix.badge.simulated')).toMatch(/^Simulated/);
  });

  it('카드 값 = 엔진 fixSavings의 savingCents (화면은 빼지 않는다), 켜짐 꼴 문구', () => {
    const input = simInputFor(CARDIGAN.sku, CARDIGAN, ['tracking_24h', 'color_note'], P);
    const savings = fixSavings(input, P, R);
    for (const card of view.fixes) {
      const saving = savings.find((x) => x.fix === card.id) as { savingCents: number };
      expect(card.effect.saving.cents).toBe(saving.savingCents);
      expect(card.effect.saving.text).toBe(toDollarsRounded(saving.savingCents));
      expect(card.effect.text).toBe(
        t(card.on ? 'product.fix.effect.on' : 'product.fix.effect.off', { saving: card.effect.saving.text }),
      );
      expect(card.source).toBe(P.fixes[card.id].source);
    }
    expect(t('product.fix.effect.off', { saving: '$1' })).toBe('could save $1');
    expect(t('product.fix.effect.on', { saving: '$1' })).toBe('saving $1');
  });

  it('처음 상태(처방 0개): 큰 숫자 = as-is 하나, 카드 4개 모두 꺼짐 꼴 + fixSavings 0개 결과', () => {
    const none = buildProductView(CARDIGAN, [], { config: P, rules: R });
    const result = engineFor(CARDIGAN, []);
    expect(none.fixesOn).toEqual([]);
    expect(none.after).toBeNull();
    expect(none.before.mean.cents).toBe(result.before.meanLossCents);
    const savings = fixSavings(simInputFor(CARDIGAN.sku, CARDIGAN, [], P), P, R);
    expect(none.fixes.map((c) => c.on)).toEqual([false, false, false, false]);
    expect(none.fixes.map((c) => c.effect.saving.cents)).toEqual(savings.map((x) => x.savingCents));
    expect(none.fixes.map((c) => c.effect.saving.text)).toEqual(savings.map((x) => toDollarsRounded(x.savingCents)));
    for (const card of none.fixes) expect(card.effect.text).toMatch(/^could save /);
    const markup = html(createElement(Rehearsal, { view: none, txLine: null }));
    expect(markup).toContain(t('product.noFixes'));
  });

  it('처방 4개 모두 켜면 카드 4개 = fixSavings 4개 결과, 켜짐 꼴', () => {
    const all = buildProductView(CARDIGAN, FIX_ORDER, { config: P, rules: R });
    const savings = fixSavings(simInputFor(CARDIGAN.sku, CARDIGAN, [...FIX_ORDER], P), P, R);
    expect(all.fixes.map((c) => c.effect.saving.cents)).toEqual(savings.map((x) => x.savingCents));
    for (const card of all.fixes) expect(card.effect.text).toMatch(/^saving /);
  });

  it('토글할 때마다 엔진 값으로 다시 (16가지 조합 모두)', () => {
    for (const fixes of ALL_COMBOS) {
      const v = buildProductView(CARDIGAN, fixes, { config: P, rules: R });
      const savings = fixSavings(simInputFor(CARDIGAN.sku, CARDIGAN, fixes, P), P, R);
      expect(v.fixes.map((c) => c.effect.saving.cents)).toEqual(savings.map((x) => x.savingCents));
    }
  });

  it('화면 처음 상태: 켠 처방 0개 (새로고침해도 같다), 처방 상태를 처음에 켜 두지 않는다', () => {
    const source = read('src/app/products/products-screen.tsx');
    expect(source).toMatch(/useState<FixId\[\]>\(\[\]\)/);
    expect(source).not.toMatch(/useState<FixId\[\]>\(\[\.\.\.ALL_FIXES\]\)/);
  });

  it('화면 코드(model.ts)에서 처방 절감을 빼지 않는다', () => {
    const source = read('src/app/products/model.ts');
    expect(source).toContain('fixSavings');
    expect(source).not.toMatch(/\.cents\s*-\s|Cents\s*-\s/);
  });

  it('통관 안내 카드에 Simulated 배지가 눈에 띄는 모양으로 그려진다, 4장', () => {
    const markup = html(createElement(FixCards, { view }));
    expect(markup.match(/data-fix="/g) ?? []).toHaveLength(4);
    const customs = markup.split('data-fix="kr_customs_notice"')[1].split('</li>')[0];
    expect(customs).toContain('fix-badge-simulated');
    expect(customs).toContain(t('product.fix.badge.simulated'));
    expect(read('src/app/products/products.css')).toMatch(/\.fix-badge-simulated\s*\{[^}]*dashed/);
    expect(markup).toContain(t('product.fixes.allOn'));
    expect(markup).toContain(t('product.fixes.footnote'));
  });

  it('처방을 모두 켜면 "Turn all on"이 없다', () => {
    const all = buildProductView(CARDIGAN, FIX_ORDER, { config: P, rules: R });
    expect(all.allOn).toBe(true);
    expect(html(createElement(FixCards, { view: all }))).not.toContain(t('product.fixes.allOn'));
  });

  it('toggleFix·orderedFixes: FIX_ORDER 순서, 중복 없음', () => {
    expect(toggleFix(['settle_first'], 'tracking_24h')).toEqual(['tracking_24h', 'settle_first']);
    expect(toggleFix(['tracking_24h', 'settle_first'], 'tracking_24h')).toEqual(['settle_first']);
    expect(orderedFixes(['settle_first', 'tracking_24h', 'settle_first'])).toEqual(['tracking_24h', 'settle_first']);
  });
});

// ── 색상 문구 ──────────────────────────────────────────────────────────────

const OK_NOTE: ColorNote = {
  ok: true,
  finding: 'Buyers say the oat color reads greyer than the photo.',
  notes: {
    en: { text: 'Oat reads slightly grey in daylight.', backTranslationEn: null },
    ko: { text: '오트 색은 자연광에서 약간 회색빛이 돌아요.', backTranslationEn: 'Oat looks a little grey in daylight.' },
    ja: { text: 'オートは自然光で少しグレーに見えます。', backTranslationEn: 'Oat looks a little grey in natural light.' },
    de: { text: 'Hafer wirkt bei Tageslicht leicht grau.', backTranslationEn: 'Oat looks slightly grey in daylight.' },
  },
};

describe('색상 문구', () => {
  it('실패면 null (자리 없음, 기본 문구 없음)', () => {
    expect(colorNoteView({ ok: false, reason: 'ai_unavailable', detail: 'unknown_error' })).toBeNull();
  });

  it('성공이면 한국어 한 줄이 먼저·크게, 나머지 언어는 접기 안', () => {
    const note = colorNoteView(OK_NOTE);
    expect(note?.ko.text).toBe(OK_NOTE.notes.ko.text);
    expect(note?.others.map((l) => l.locale)).toEqual(['en', 'ja', 'de']);
    const markup = html(createElement(ColorNoteResult, { note: note! }));
    const koAt = markup.indexOf('class="color-note-ko"');
    const detailsAt = markup.indexOf('<details');
    expect(koAt).toBeGreaterThan(-1);
    expect(koAt).toBeLessThan(detailsAt);
    expect(markup.indexOf(OK_NOTE.notes.ja.text)).toBeGreaterThan(detailsAt);
    expect(markup).toContain(t('badge.aiSuggests'));
  });

  it('색상 문구 자리가 없으면 카드 안에 문구 자리가 없다', () => {
    const view = buildProductView(CARDIGAN, FIX_ORDER, { config: P, rules: R });
    const markup = html(createElement(FixCards, { view, colorNoteSlot: null }));
    expect(markup).not.toContain('color-note');
  });

  it('처음엔 [Write the note] 버튼만 (AI를 부르지 않는다)', () => {
    const write = vi.fn(async () => null);
    const markup = html(createElement(ColorNoteSlot, { sku: CARDIGAN.sku, write }));
    expect(markup).toContain(t('product.colorNote.write'));
    expect(write).not.toHaveBeenCalled();
  });

  it('구매자 글: 색상(B1) 분쟁 이력이 있는 상품만 시드 B1 문의 원문', () => {
    const complaints = colorComplaintsFor(CARDIGAN.sku, seedDisputes, seedInquiries);
    expect(complaints).toEqual(seedInquiries.filter((i) => i.signal === 'B1').map((i) => i.original));
    expect(complaints.length).toBeGreaterThan(0);
    for (const product of seedProducts) {
      const hasB1 = seedDisputes.some((d) => d.sku === product.sku && d.subtype === 'B1');
      expect(colorComplaintsFor(product.sku, seedDisputes, seedInquiries).length > 0).toBe(hasB1);
    }
  });

  it('colorNoteFor: 가짜 LLM이 실패하면 null, 모르는 SKU·LLM 없음이면 부르지 않는다', async () => {
    const failing: LlmCaller = vi.fn(async () => {
      throw new Error('fake');
    });
    expect(await colorNoteFor(CARDIGAN.sku, failing)).toBeNull();
    const never: LlmCaller = vi.fn(async () => ({}) as never);
    expect(await colorNoteFor('NOPE', never)).toBeNull();
    expect(await colorNoteFor(CARDIGAN.sku, null)).toBeNull();
    expect(never).not.toHaveBeenCalled();
  });
});

// ── 왼쪽 목록 ──────────────────────────────────────────────────────────────

describe('왼쪽 상품 목록', () => {
  it('행마다 as-is와 with fixes가 함께 (simulateStore 값·순서 그대로)', () => {
    const fixes: FixId[] = ['color_note'];
    const rows = buildProductRows(seedProducts, fixes, CARDIGAN.sku, { config: P, rules: R });
    const store = simulateStore(seedProducts, fixes, P, R);
    expect(rows.map((r) => r.sku)).toEqual(store.products.map((p) => p.sku));
    rows.forEach((row, i) => {
      const result = store.products[i].result;
      expect(row.asIs.cents).toBe(result.before.meanLossCents);
      expect(row.withFixes.cents).toBe(result.after.meanLossCents);
      expect(row.valuesText).toBe(
        t('product.row.values', { asIs: toDollarsRounded(result.before.meanLossCents), withFixes: toDollarsRounded(result.after.meanLossCents) }),
      );
      expect(row.href).toBe(`/products?sku=${row.sku}`);
    });
    expect(rows.filter((r) => r.selected).map((r) => r.sku)).toEqual([CARDIGAN.sku]);
    const markup = html(createElement(ProductList, { rows }));
    for (const row of rows) expect(markup).toContain(row.valuesText);
    expect(markup).toContain('aria-current="page"');
  });

  it('기본 상품 = Today의 Prevent 상품 (pickPreventProduct)', () => {
    const pick = pickPreventProduct(simulateStore(seedProducts, [...FIX_ORDER], P, R));
    expect(defaultSku(seedProducts, { config: P, rules: R })).toBe(pick?.sku);
    expect(selectSku(seedProducts, undefined, { config: P, rules: R })).toBe(pick?.sku);
    expect(selectSku(seedProducts, 'NOPE', { config: P, rules: R })).toBe(pick?.sku);
    expect(selectSku(seedProducts, 'FK-SW-NV')).toBe('FK-SW-NV');
    // 라이브 config에서는 가디건 (Today의 Prevent 상품)
    expect(defaultSku(seedProducts)).toBe(pickPreventProduct(simulateStore(seedProducts, [...FIX_ORDER]))?.sku);
  });
});

// ── 거래 조회 한 줄 ────────────────────────────────────────────────────────

const SUMMARY: TransactionSummary = {
  source: 'paypal_transaction_search',
  range: { startDate: '2026-10-13', endDate: '2026-11-11' },
  sales: [],
  saleCount: 7,
  refundCount: 0,
  byItem: [],
  byCountry: [],
  lastRefreshedAt: null,
};

describe('거래 조회 한 줄', () => {
  it('실패면 null (줄을 숨긴다)', () => {
    expect(transactionLineView({ ok: false, reason: 'paypal_unavailable' }, TRANSACTION_DAYS)).toBeNull();
  });

  it('캐시 값이면 cached 배지, 건수는 saleCount 그대로', async () => {
    const now = Date.UTC(2026, 10, 11, 3);
    const cache = createMemoryTransactionCache();
    const range = lastDays(now, TRANSACTION_DAYS);
    cache.set(`${range.startDate}_${range.endDate}`, SUMMARY, now);
    const get = vi.fn();
    const client: PayPalClient = { call: vi.fn(), get };
    const line = await loadTransactionLine({ client, now: () => now, cache });
    expect(line).toEqual({ text: t('product.tx.line', { count: SUMMARY.saleCount, days: TRANSACTION_DAYS }), cached: true });
    expect(get).not.toHaveBeenCalled();

    const view = buildProductView(CARDIGAN, FIX_ORDER, { config: P, rules: R });
    const markup = html(createElement(Rehearsal, { view, txLine: line }));
    expect(markup).toContain(t('badge.cached'));
    // 예상 손실 카드 안에 넣지 않는다
    const card = markup.split('rehearsal-card')[1].split('tx-line')[0];
    expect(card).not.toContain(line!.text);
  });

  it('캐시 적중은 서랍에 Read sales 200 cached로 남고, 실패해서 줄을 숨길 때는 남지 않는다 (T064 후속)', async () => {
    const activity = await import('@/app/_server/activity');
    const now = Date.UTC(2026, 10, 11, 3);
    activity.resetActivityForTest(() => now);
    const cache = createMemoryTransactionCache();
    const range = lastDays(now, TRANSACTION_DAYS);
    cache.set(`${range.startDate}_${range.endDate}`, SUMMARY, now);
    const client: PayPalClient = { call: vi.fn(), get: vi.fn() };
    const line = await loadTransactionLine({ client, now: () => now, cache });
    expect(line?.cached).toBe(true);
    const rows = activity.listActivity();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'readSales', status: 200, cached: true, summary: { kind: 'transactions', count: SUMMARY.saleCount } });
    expect(client.get).not.toHaveBeenCalled();

    activity.resetActivityForTest(() => now);
    expect(await loadTransactionLine({ client: null, now: () => now, cache: createMemoryTransactionCache() })).toBeNull();
    expect(activity.listActivity()).toHaveLength(0);
  });

  it('PayPal을 읽을 수 없고 캐시도 없으면 숨김 (가짜 클라이언트, GET만)', async () => {
    const client: PayPalClient = { call: vi.fn(), get: vi.fn(async () => ({ status: 503, body: null })) };
    expect(await loadTransactionLine({ client, now: () => Date.UTC(2026, 10, 11), cache: createMemoryTransactionCache() })).toBeNull();
    expect(client.call).not.toHaveBeenCalled();
    expect(await loadTransactionLine({ client: null, cache: createMemoryTransactionCache() })).toBeNull();
  });
});

// ── 화면 전체 + 시간 ───────────────────────────────────────────────────────

describe('화면 전체', () => {
  it('세 칸이 그려지고 폭포·분포 막대·전후 막대가 없다', () => {
    const markup = html(
      createElement(ProductsScreen, {
        products: seedProducts,
        selectedSku: CARDIGAN.sku,
        txLine: null,
        colorNoteSkus: [CARDIGAN.sku],
        writeColorNote: async () => null,
      }),
    );
    expect(markup).toContain('class="products-list"');
    expect(markup).toContain('class="rehearsal"');
    expect(markup).toContain('class="fixes"');
    expect(markup).toContain(t('product.colorNote.write'));
    expect(markup).not.toMatch(/waterfall|histogram/i);

    const sources = readdirSync(path.join(ROOT, 'src/app/products')).map((f) => read(`src/app/products/${f}`));
    for (const source of sources) expect(source).not.toMatch(/\.waterfall|\.histogram/);
  });

  it('토글 한 번의 재계산(가운데 + 처방 카드 + 왼쪽 목록) < 0.5초', () => {
    // 첫 호출(모듈·JIT 준비)은 빼고 잰다
    buildProductView(CARDIGAN, FIX_ORDER);
    const times: number[] = [];
    for (const fixes of ALL_COMBOS) {
      const start = performance.now();
      buildProductView(CARDIGAN, fixes);
      buildProductRows(seedProducts, fixes, CARDIGAN.sku);
      times.push(performance.now() - start);
    }
    const worst = Math.max(...times);
    console.info(`[T062] 토글 재계산 최악 ${worst.toFixed(1)}ms, 평균 ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)}ms`);
    expect(worst).toBeLessThan(500);
  });
});

// ── 정적 검사: 금액·건수 숫자 없음 ─────────────────────────────────────────

const FORBIDDEN_AMOUNTS = ['$195', '$43', '$481', '$143', '$58', '$324', '$113', '$216', '$44', '$718', '$254', '$67', '$360', '$104'];

describe('정적 검사', () => {
  const productKeys = Object.keys(copyTables.en).filter((k) => k.startsWith('product.'));

  it('product.* 키가 두 문구 파일에 똑같이 있다', () => {
    expect(Object.keys(copyTables.ko).filter((k) => k.startsWith('product.')).sort()).toEqual([...productKeys].sort());
  });

  it('문구에 금액·건수 숫자가 없다', () => {
    for (const key of productKeys) {
      for (const table of [copyTables.en, copyTables.ko]) {
        const value = table[key];
        expect(value, key).not.toMatch(/\$\s*\d/);
        expect(value, key).not.toMatch(/\d+(\.\d+)?\s*(disputes|transactions|건|개)/);
        for (const amount of FORBIDDEN_AMOUNTS) expect(value, key).not.toContain(amount);
        expect(value, key).not.toMatch(/guarantee|보장|예측 정확도/i);
      }
    }
  });

  it('화면 코드에 금액·건수 숫자가 없다', () => {
    const files = readdirSync(path.join(ROOT, 'src/app/products')).filter((f) => /\.tsx?$/.test(f));
    for (const file of files) {
      const code = read(`src/app/products/${file}`)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/\$\s*\d/);
      for (const amount of FORBIDDEN_AMOUNTS) expect(code, file).not.toContain(amount);
      // 센트·건수 숫자 (세 자리 이상 정수, 소수) 없음
      expect(code, file).not.toMatch(/[^\w.]\d{3,}[^\w]/);
      expect(code, file).not.toMatch(/\b\d+\.\d+\b/);
    }
  });

  it('화면 코드는 /100·toFixed로 금액을 만들지 않는다', () => {
    const files = readdirSync(path.join(ROOT, 'src/app/products')).filter((f) => /\.tsx?$/.test(f));
    for (const file of files) {
      const code = read(`src/app/products/${file}`);
      expect(code, file).not.toMatch(/\/\s*100\b|toFixed|Math\.round/);
    }
  });

  it('ALL_FIXES = FIX_ORDER', () => {
    expect([...ALL_FIXES]).toEqual([...FIX_ORDER]);
  });
});
