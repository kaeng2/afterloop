/**
 * T106: Today 목록·칩 화면 안 고르기 · 지호/추적 zone-work 카드 · Added ✓ · 0원 알림 · 배지 감소 · sticky·링크 줄 없음.
 * (차이 목록 F1-16 · 18 · 19 · 22 · 33 · 47 · 55 · 56 · 58 · 59 · 63)
 *
 * 테스트 환경이 node라 클릭은 정적 검사(링크·router 이동 없음, 버튼이 상자 함수를 부름) + 순수 함수 + 정적 그리기로 본다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { copyKeys, copyTables, t } from '@/app/_shared/copy';
import type { ProductFilterView, TodayGroup, TodayGroupKey, TodayItem, TrackingSummary } from '@/app/today/model';
import { casesOf, filterGroups, openCaseCount, todaySearch } from '@/app/today/screen-model';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/app/cases/actions', () => ({ sendReplyAction: vi.fn(), prepareEditedAction: vi.fn() }));
(globalThis as { React?: typeof React }).React = React;

const { TodayGroups, TodayGroupsView } = await import('@/app/today/today-groups');
const { ProductFilterBarView, ProductFilterBar } = await import('@/app/today/product-filter');
const { TodaySelectionProvider, DetailPane } = await import('@/app/today/selection');
const { TrackingDetail } = await import('@/app/today/tracking-detail');
const { OfferWork } = await import('@/app/today/offer-work');
const { toastText } = await import('@/app/today/savings');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const SEO = 'PP-R-GMS-10197661';
const JIHO = 'PP-R-MBJ-10197650';
const MIKE = 'PP-R-FYT-10197651';

function item(id: string, group: TodayGroupKey, skus: string[], kind: TodayItem['kind'] = 'dispute'): TodayItem {
  return {
    id,
    kind,
    group,
    href: `/?item=${id}`,
    name: id,
    label: null,
    sub: null,
    band: 'High',
    dot: 'high',
    status: { key: 'badge.riskHigh', tone: 'high' },
    score: 1,
    dueDate: '',
    row: { icon: 'sweater', head: id, product: 'Wool Sweater', category: 'Not received', categoryTone: 'high', due: null, who: 'Ji-ho Park · KR', skus },
  };
}

const group = (key: TodayGroupKey, items: TodayItem[]): TodayGroup => ({
  key,
  title: t(`today.group.${key}`),
  hint: t(`today.groupHint.${key}`),
  items,
});

const GROUPS: TodayGroup[] = [
  group('needsYou', [item(SEO, 'needsYou', ['FK-SW-NV']), item(JIHO, 'needsYou', ['FK-CD-OAT'])]),
  group('prevent', [item('tracking', 'prevent', ['FK-CD-OAT', 'FK-BN-SET'], 'tracking')]),
  group('routine', [item(MIKE, 'routine', ['FK-CD-OAT'])]),
];

const FILTER: ProductFilterView = {
  chips: [
    { sku: null, name: 'All products', sub: '4 products · 630 units', icon: 'multi', cases: 3, units: 630, href: '/', selected: true },
    { sku: 'FK-SW-NV', name: 'Wool Sweater', sub: '', icon: 'sweater', cases: 1, units: 120, href: '/?sku=FK-SW-NV', selected: false },
    { sku: 'FK-CD-OAT', name: 'Knit Cardigan', sub: '', icon: 'cardigan', cases: 2, units: 240, href: '/?sku=FK-CD-OAT', selected: false },
  ],
  summary: 'x',
  selectedSku: null,
  products: 4,
  units: 630,
};

// ───────────────────────────── 1. 화면 안 고르기 ─────────────────────────────

describe('T106-1 (F1-18 · F1-19 · F1-47): 항목·칩 클릭은 서버 요청 없이 화면 안 상태', () => {
  it('항목·칩·고르기 파일에 링크·router 이동·fetch가 없다 (버튼 + 상자 함수만)', () => {
    for (const file of ['src/app/today/today-groups.tsx', 'src/app/today/product-filter.tsx', 'src/app/today/selection.tsx']) {
      const code = strip(read(file));
      expect(code, file).not.toMatch(/next\/link|<Link\b|router\.(push|replace)|useRouter|fetch\(|href=/);
    }
    expect(strip(read('src/app/today/today-groups.tsx'))).toMatch(/<button\s+type="button"[\s\S]*onClick=\{\(\) => onSelect\(item\.id\)\}/);
    expect(strip(read('src/app/today/product-filter.tsx'))).toMatch(/<button\s+type="button"[\s\S]*aria-pressed=\{selectedSku === chip\.sku\}[\s\S]*onClick=\{\(\) => onPick\?\.\(chip\.sku\)\}/);
    // 주소는 history.replaceState로만 맞춘다
    expect(strip(read('src/app/today/selection.tsx'))).toMatch(/window\.history\.replaceState\(/);
  });

  it('항목은 <button>, 칩은 <button aria-pressed> (키보드로 고를 수 있다)', () => {
    const list = html(createElement(TodayGroupsView, { groups: GROUPS, done: {}, selectedId: JIHO }));
    expect(list).toContain(`<button type="button" class="today-item it on" aria-current="true" data-item="${JIHO}"`);
    expect(list.match(/aria-current="true"/g)).toHaveLength(1);
    expect(list).not.toContain('href=');
    const bar = html(createElement(ProductFilterBarView, { filter: FILTER, cases: casesOf(GROUPS), done: {}, selectedSku: 'FK-CD-OAT' }));
    expect(bar.match(/<button type="button" class="product-filter-chip pf( on)?"/g)).toHaveLength(3);
    expect(bar.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(bar).toMatch(/aria-pressed="true" data-sku="FK-CD-OAT"/);
    expect(bar).not.toContain('href=');
  });

  it('상자 안: 처음 상품으로 목록을 거르고 고른 항목을 그대로 둔다 (칩을 눌러도 고른 항목 유지 = 상자의 setSku는 itemId를 바꾸지 않는다)', () => {
    const markup = html(
      createElement(
        TodaySelectionProvider,
        { initialItem: SEO, initialSku: 'FK-CD-OAT' },
        createElement(ProductFilterBar, { filter: FILTER, cases: casesOf(GROUPS) }),
        createElement(TodayGroups, { groups: GROUPS, selectedId: null }),
        createElement(DetailPane, { id: SEO }, 'SEO-DETAIL'),
        createElement(DetailPane, { id: JIHO }, 'JIHO-DETAIL'),
      ),
    );
    // 거른 목록: 서연(스웨터)은 빠지고 지호·추적·Mike
    expect(markup).not.toMatch(new RegExp(`class="today-item it[^"]*"[^>]*data-item="${SEO}"`));
    expect(markup).toContain(`class="today-item it" data-item="${JIHO}"`);
    expect(markup).toContain(`class="today-item it" data-item="${MIKE}"`);
    // 처음 상태로 받은 고른 상세는 보인다
    expect(markup).toMatch(new RegExp(`data-item="${SEO}">SEO-DETAIL`));
    expect(markup).toMatch(new RegExp(`data-item="${JIHO}" hidden="">JIHO-DETAIL`));
    expect(markup).toMatch(/aria-pressed="true" data-sku="FK-CD-OAT"/);
    // T122b (시안 v6 pickProduct): 칩을 누르면 그 상품의 첫 항목을 고른다 (T106 "고른 항목 유지"는 v6에서 바뀌었다).
    // All products(null)면 고른 항목 없음 → 전체 현황
    const code = strip(read('src/app/today/selection.tsx'));
    expect(code).toMatch(/const itemId = next === null \? null : firstItemFor\(groups, next, done\);\s*syncAddress\(next, itemId\);/);
  });

  it('상세는 첫 요청에 모두 그려 두고 고른 것만 보인다 (나머지 분쟁은 Suspense로 나중에)', () => {
    const page = strip(read('src/app/(app)/page.tsx'));
    expect(page).toMatch(/items\.map\(\(item\) => \(\s*<DetailPane key=\{item\.id\} id=\{item\.id\}>/);
    expect(page).toMatch(/<Suspense fallback=/);
    expect(page).toMatch(/loadTodayScreen\(undefined\)/);
    expect(page).not.toMatch(/<Link\b|router/);
  });

  it('filterGroups = buildToday 거르기와 같은 규칙, todaySearch는 item·sku만 맞추고 나머지는 둔다', () => {
    expect(filterGroups(GROUPS, null)).toEqual(GROUPS);
    expect(filterGroups(GROUPS, 'FK-SW-NV').map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([['needsYou', [SEO]]]);
    expect(filterGroups(GROUPS, 'FK-BN-SET').map((g) => g.key)).toEqual(['prevent']);
    // T122b: All products는 `?sku=all` (주소에 sku가 없으면 처음 상태 = 첫 항목의 상품이라서)
    expect(todaySearch('', null, SEO)).toBe(`?sku=all&item=${SEO}`);
    expect(todaySearch(`?lang=ko&item=${SEO}`, 'FK-CD-OAT', SEO)).toBe(`?lang=ko&item=${SEO}&sku=FK-CD-OAT`);
    expect(todaySearch('?sku=FK-CD-OAT&item=tracking', null, 'tracking')).toBe('?sku=all&item=tracking');
    expect(todaySearch('?sku=A', null, null)).toBe('?sku=all');
  });
});

// ───────────────────────────── 2. zone-work 카드 ─────────────────────────────

const TRACKING: TrackingSummary = {
  untracked: [
    { key: 'O05', buyerName: 'Yuki T.', productName: 'Beanie + Scarf Set' },
    { key: 'O07', buyerName: 'Lena K.', productName: 'Knit Cardigan, Oat' },
  ],
  excluded: [{ key: 'O02', buyerName: 'Ji-ho', productName: 'Knit Cardigan, Oat' }],
};

// T122c: 아래 T106-2 시험은 시안 v6 한 장 카드 틀(`one-card.tsx`)로 바뀐 구조를 본다 (자세한 시험은 app-t122c.test.ts)
describe('T106-2 → T122c: 지호·추적·Prevent·Mike 상세 = 시안 v6 한 장 카드 틀', () => {
  it('추적: 머리(52px 타일·제목·범주 칩·who) + 한 장 카드(AI 알약·제목·설명·단계·주문 표·On approval·[Add all N])', () => {
    const row = GROUPS[1].items[0].row;
    const markup = html(
      createElement(TrackingDetail, {
        tracking: TRACKING,
        register: async () => ({ kind: 'nothing' as const, line: '', rows: [] }),
        row,
      }),
    );
    expect(markup).toMatch(/class="work-head"><span class="product-tile ptile product-tile-lg"/);
    expect(markup).toContain('class="work-head-title num"');
    expect(markup).toContain('class="today-pill today-pill-high">Not received</span>');
    expect(markup).toContain('class="work-head-who">Ji-ho Park · KR</span>');
    expect(markup).toMatch(/<section class="zone-work oc" aria-labelledby="tracking-title"><div class="oc-top"><div class="oc-top-text"><span class="ai-pill"/);
    expect(markup).toContain(`id="tracking-title">${t('today.tracking.actTitle', { count: 2 })}</h3>`);
    expect(markup).toContain(`class="oc-body">${t('today.tracking.detail', { count: 2 })}</div>`);
    expect(markup).toContain(`>${t('today.tracking.addMany', { count: 2 })}</button>`);
    // 주문 표 = 카드 안 `.ag` 틀 (지우지 않는다). 분쟁 걸린 주문은 "In dispute — excluded"
    expect(markup).toContain('class="oc-ag" role="grid"');
    for (const key of ['O05', 'O07', 'O02']) expect(markup).toContain(key);
    expect(markup).toContain(t('today.tracking.excluded'));
    expect(markup).toContain(t('card.api.track', { count: 2 }));
  });

  it('CSS: zone-work 시안 값 (r24 · padding 22/22/20 · gap 18 · 그림자 변수 · 위 4px 그라데이션), 머리 24px 900', () => {
    const css = read('src/app/today/today.css');
    const rule = (sel: string) => css.match(new RegExp(`\\n${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule('.zone-work')).toMatch(/padding: 22px 22px 20px;/);
    expect(rule('.zone-work')).toMatch(/border-radius: 24px;/);
    expect(rule('.zone-work')).toMatch(/gap: 18px;/);
    expect(rule('.zone-work')).toMatch(/box-shadow: var\(--shadow-work\);/);
    expect(rule('.zone-work::before')).toMatch(/height: 4px;[\s\S]*background: var\(--gradient-ai-line\);/);
    expect(rule('.work-head-title')).toMatch(/font-size: 1\.5em;\s*font-weight: 900;/);
    const desk = read('src/app/(app)/desk.css');
    expect(desk).toContain('.dk .oc-title{margin:0;font-size:20px;font-weight:700;');
    expect(desk).toContain('.dk .oc-body{font-size:15px;color:#3F4144}');
  });

  it('지호(제안 갈래): 한 장 카드 + AI 알약 + 엔진 금액 제목 + [Send] (관문 = canSendOffer, 보내기 = sendReplyAction kind)', () => {
    const markup = html(
      createElement(OfferWork, {
        disputeId: JIHO,
        base: {
          draft: { ok: false, reason: 'ai_unavailable', detail: 'test' },
          translation: null,
          facts: [],
          buyerLocale: 'ko',
          plan: null,
          offerFirst: true,
          mode: 'simulated',
          draftSource: 'ai',
          riskAfterReply: null,
        },
        replyId: null,
        title: 'Offer 15% back ($7.20), the buyer keeps it',
        body: 'Lowest expected loss for this case.',
        amount: '$7.20',
        languageName: 'Korean',
        api: t('card.api.makeOffer'),
      }),
    );
    expect(markup).toMatch(/<section class="zone-work oc offer-work" aria-labelledby="offer-work-title-PP-R-MBJ-10197650"><div class="oc-top"><div class="oc-top-text"><span class="ai-pill"/);
    expect(markup).toContain('>Offer 15% back ($7.20), the buyer keeps it</h3>');
    // 버튼 글자에 금액을 따로 쓰지 않는다 (3차 리뷰: 버튼 "$7" vs 본문 "$7.20")
    expect(markup).toMatch(/<button type="button" class="btn b-black" disabled=""[^>]*>Send<\/button>/);
    expect(markup).not.toMatch(/Send · \$/);
    // Simulated 표시 (서버가 정한 전송 모드 그대로)
    expect(markup).toContain(t('case.send.mode.simulated'));
    expect(markup).toContain(`<code class="oc-api">${t('card.api.makeOffer')}</code>`);
    expect(markup).not.toContain('reply-risk-after');
    expect(markup).not.toContain(t('case.reply.riskAfter'));

    const code = strip(read('src/app/today/offer-work.tsx'));
    expect(code).toMatch(/canSendOffer\(view\)/);
    expect(code).toMatch(/action\(\{ disputeId, kind, replyId, confirmedCommitments: confirmed \}\)/);
    expect(code).toMatch(/action = sendReplyAction/);
    expect(code).toMatch(/view\.mode === 'live' && !window\.confirm\(/);
    expect(code).toMatch(/disabled=\{!gate\.ok \|\| sendState === 'sending' \|\| sent\}/);
    // T116 F1-45: 누르는 즉시(낙관적) "Sent ✓" — 결과가 실패면 되돌린다
    expect(code).toMatch(/const done = sent \|\| optimistic;/);
    expect(code).toMatch(/done \? t\('card\.sent'\)/);
    expect(copyTables.en['card.sent']).toBe('Sent ✓');
  });

  it('Prevent·Routine(Mike)도 같은 틀 — 코드·엔진 값이라 AI 알약 없음, 버튼 없음', async () => {
    const { PreventCard } = await import('@/app/today/prevent-card');
    const markup = html(
      createElement(PreventCard, {
        detail: { sku: 'FK-CD-OAT', name: 'Knit Cardigan, Oat', stock: 240, beforeCents: 21600, afterCents: 4400, cutPercent: 80, fixes: [] },
        row: GROUPS[0].items[1].row,
      }),
    );
    expect(markup).toMatch(/class="work-head"/);
    expect(markup).toMatch(/<section class="zone-work oc" aria-labelledby="prevent-title"><div class="oc-top"><div class="oc-top-text"><h3/);
    expect(markup).not.toContain('ai-pill');
    expect(markup).not.toMatch(/<(button|a|form)\b/);
    const routine = strip(read('src/app/cases/routine-detail.tsx'));
    expect(routine).toMatch(/<OneCard[\s\S]*?ai=\{false\}/);
    expect(routine).not.toMatch(/<button|ReplyPanel|loadReply|approval=/);
  });

  it('case-detail: 지호 분기만 바꾼다 (repair 또는 제안이 먼저 → OfferWork 한 장 카드. 곡선·데스크는 그리지 않는다)', () => {
    const code = strip(read('src/app/cases/case-detail.tsx'));
    expect(code).toMatch(/if \(reply !== null && \(rec\.best\?\.move === 'repair' \|\| caseView\.messageSend\.blocked\)\) \{[\s\S]*jihoWork\(reply, row,/);
    expect(code).toMatch(/plan\.apiMove !== 'make_offer'/);
    expect(code).toMatch(/const amount = toDollarsCents\(plan\.amountCents\)/);
    // 지호 분기는 예측·곡선을 만들기 전에 돌아간다
    expect(code.indexOf('jihoWork(reply, row,')).toBeLessThan(code.indexOf('loadRiskCurve('));
  });
});

describe('T106-3 (F1-59): 추적 버튼은 끝나면 꺼진 채 "Added ✓"', () => {
  it('끝난 결과(added·simulated)면 꺼짐 + Added ✓, Simulated 결과 줄은 그대로', async () => {
    const { TrackingRegister } = await import('@/app/today/tracking-register');
    const simulated = html(
      createElement(TrackingRegister, {
        label: 'Add all 2',
        action: async () => ({ kind: 'nothing' as const, line: '', rows: [] }),
        initial: { kind: 'simulated' as const, line: t('today.tracking.result.simulated'), rows: [] },
      }),
    );
    expect(simulated).toMatch(/<button type="button" class="tracking-button" disabled="">Added ✓<\/button>/);
    expect(simulated).toContain(t('today.tracking.result.simulated'));
    const failed = html(
      createElement(TrackingRegister, {
        label: 'Add all 2',
        action: async () => ({ kind: 'nothing' as const, line: '', rows: [] }),
        initial: { kind: 'error' as const, line: 'x', rows: [] },
      }),
    );
    expect(failed).toMatch(/<button type="button" class="tracking-button">Add all 2<\/button>/);
    // T116 F1-45: 끝났거나(finished) 낙관적으로 끝난 것처럼 보이는 동안(shownDone)은 다시 누를 수 없다
    expect(strip(read('src/app/today/tracking-register.tsx'))).toMatch(/const shownDone = finished \|\| optimistic;/);
    expect(strip(read('src/app/today/tracking-register.tsx'))).toMatch(/if \(pending \|\| shownDone\) return;/);
  });
});

describe('T106-4 (F1-63): 저장 금액 0인 완료에도 알림 (금액 없이)', () => {
  it('toastText: 금액 없으면 "Dashboard updated", 있으면 금액 문구', () => {
    expect(toastText(null, t)).toBe('Dashboard updated');
    expect(toastText('', t)).toBe('Dashboard updated');
    expect(toastText('$41', t)).toBe('Dashboard updated · +$41 kept');
    const code = strip(read('src/app/today/savings.tsx'));
    expect(code).not.toMatch(/if \(amount === null \|\| amount === ''\) return;/);
  });
});

describe('T106-5 (F1-22): 처리 뒤 칩 배지·"N open cases"는 done이 아닌 분쟁 수', () => {
  it('done 항목을 빼고 센다 (추적은 세지 않는다)', () => {
    const cases = casesOf(GROUPS);
    expect(cases.map((c) => c.id)).toEqual([SEO, JIHO, MIKE]);
    expect(openCaseCount(cases, {})).toBe(3);
    expect(openCaseCount(cases, { [JIHO]: { simulated: true }, tracking: { simulated: true } })).toBe(2);
    expect(openCaseCount(cases, { [JIHO]: { simulated: true } }, 'FK-CD-OAT')).toBe(1);

    const before = html(createElement(ProductFilterBarView, { filter: FILTER, cases, done: {}, selectedSku: null }));
    expect(before).toContain(t('today.filter.summary', { products: 4, units: 630, cases: 3 }));
    expect(before).toContain('product-tile-badge num">2<');
    const after = html(createElement(ProductFilterBarView, { filter: FILTER, cases, done: { [JIHO]: { simulated: true } }, selectedSku: null }));
    expect(after).toContain(t('today.filter.summary', { products: 4, units: 630, cases: 2 }));
    expect(after).not.toContain('product-tile-badge num">2<');
    expect(after).toContain(t('today.filter.subOne', { units: 240, cases: 1 }));
  });
});

// ───────────────────────────── 6. sticky·링크 줄 ─────────────────────────────

describe('T106-6 (F1-16 · F1-33): 칩 줄 sticky 없음, 이번 주 카드 아래 링크 줄 없음', () => {
  it('today.css에 .product-filter sticky가 없고, today-list에 weekly-link가 없다', () => {
    const css = strip(read('src/app/today/today.css'));
    expect(css).not.toMatch(/\.product-filter\s*\{[^}]*sticky/);
    expect(css).not.toContain('.weekly-link');
    expect(strip(read('src/app/today/today-list.tsx'))).not.toMatch(/weekly-link|storeLine/);
  });
});

describe('T106 문구', () => {
  it('en/ko 키 집합이 같다 (새 키 포함)', () => {
    expect(copyKeys(copyTables.ko)).toEqual(copyKeys(copyTables.en));
    for (const key of ['today.tracking.addedDone', 'today.tracking.ordersLabel', 'today.offer.send', 'today.offer.sent', 'today.weekly.toastDone']) {
      expect(typeof copyTables.en[key], key).toBe('string');
      expect(typeof copyTables.ko[key], key).toBe('string');
    }
  });
});
