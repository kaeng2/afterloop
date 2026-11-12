/**
 * T115 단위 테스트: /demo/seller-dashboard 시안 차이 수정 + 주소 이름 + 리다이렉트 상대 경로.
 * 기대값 출처: `tasks/T115.md` 완료 기준, `inbox/2026-11-12-scene1-diff.md` A절 1–7, DECISIONS 2026-11-12 11:20.
 * 실호출 0회 — PayPal·AI를 부르지 않는다 (읽기 캐시가 빈 채로 돈다).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { INTRO_SAMPLE } from './intro-sample';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch: () => {} }) }));
(globalThis as { React?: typeof React }).React = React;

const { IntroScreen } = await import('@/app/demo/seller-dashboard/intro-screen');
const { loadIntroData } = await import('@/app/_server/intro-data');
const { createReadCache } = await import('@/app/_server/read-cache');
const { peakDaysLeft, dateLine } = await import('@/app/today/model');
const { GET: langGet } = await import('@/app/lang/route');
const { GET: introGet } = await import('@/app/intro/route');
const { GET: listingGet } = await import('@/app/listing/route');
const { NextRequest } = await import('next/server');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
const NOW = new Date('2026-11-12T03:00:00Z'); // KST 12:00

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...filesUnder(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

describe('T115 (2)-5 숫자를 Desk와 맞춘다', () => {
  const data = loadIntroData(NOW);

  it('사건 줄 3개 = 연결 표의 화면 건 (서연 먼저, 지호, 실제 사건 마이크) — 캐시가 비면 연결 표 고정 기한', () => {
    expect(data.cases.map((k) => k.id)).toEqual(['PP-R-GMS-10197661', 'PP-R-MBJ-10197650', 'PP-R-FYT-10197651']);
    expect(data.cases).toEqual(INTRO_SAMPLE.cases);
    const mike = data.cases[2];
    expect(mike.reason).toBe('MERCHANDISE_OR_SERVICE_NOT_RECEIVED');
    expect(mike.repeat).toBe(true); // "Item not received · repeat claim"
    expect(mike.due).toBeNull(); // DECISIONS v2.2: 심사 단계 — 판매자 응답 기한 없음
  });

  it('배지·"3 open"·Handle all 3·말풍선 3 cases (EN·KO) — 숫자는 사건 줄 수에서', () => {
    const en = renderToStaticMarkup(React.createElement(IntroScreen, { data }));
    expect(en).toContain('3 open');
    expect(en).toContain('Handle all 3 with DisputeLess');
    expect(en).toContain('3 cases need a reply.');
    expect(en).toContain('Item not received · repeat claim · $35.00');
    expect(en).toContain('Mike Morgan');
    expect(en).toContain('Respond by Nov 30 · mentions chargeback');
    expect(en).not.toMatch(/\b2 open|Handle all 2/);
    const two = renderToStaticMarkup(React.createElement(IntroScreen, { data: { ...data, cases: data.cases.slice(0, 2) } }));
    expect(two).toContain('Handle all 2 with DisputeLess');
  });

  it('"Black Friday in N days"는 Desk 위쪽 막대와 같은 함수 (peakDaysLeft)', () => {
    expect(data.peakDays).toBe(peakDaysLeft(NOW));
    expect(dateLine(NOW)).toContain(`in ${data.peakDays} days`);
    const en = renderToStaticMarkup(React.createElement(IntroScreen, { data }));
    expect(en).toContain(`Black Friday in ${data.peakDays} days`);
    expect(strip(read('src/app/today/model.ts'))).toMatch(/const days = peakDaysLeft\(now\);/);
  });

  it('/demo/seller-dashboard는 PayPal을 기다려 읽지 않는다: 사건 줄은 캐시 peek만, 실제 읽기는 응답 뒤 after() 안에서만 (정적)', () => {
    const src = strip(read('src/app/_server/intro-data.ts'));
    const load = src.slice(src.indexOf('export function loadIntroData'), src.indexOf('export function warmTodayReads'));
    expect(load).not.toMatch(/\b(getDispute|listDisputes|getPayPalReadClient|getPayPalClient|fetch)\(/);
    expect(src).toMatch(/peekCachedRead\(/);
    const warm = src.slice(src.indexOf('export function warmTodayReads'));
    expect(warm).toMatch(/after\(async \(\) => \{/);
    expect(read('src/app/demo/seller-dashboard/page.tsx')).not.toMatch(/await\s+warmTodayReads|await\s+loadIntroData/);
  });

  it('읽기 캐시 peek는 읽기를 시작하지 않는다', async () => {
    let gets = 0;
    const cache = createReadCache();
    const client = cache.wrap({ get: async () => (gets++, { status: 200, body: { dispute_id: 'X' } }), call: async () => ({ status: 200, body: {} }) });
    expect(cache.peek('/v1/customer/disputes/X')).toBeUndefined();
    expect(gets).toBe(0);
    await client.get('/v1/customer/disputes/X');
    expect(cache.peek('/v1/customer/disputes/X')?.body).toEqual({ dispute_id: 'X' });
    expect(gets).toBe(1);
  });

  it('문구 파일엔 사건 데이터가 없다 (화면 문구 + 캐시가 빌 때의 기한만)', () => {
    for (const file of ['config/intro.en.json', 'config/intro.ko.json']) {
      const text = read(file);
      expect(text, file).not.toMatch(/"cases"|"openCount"|Seo-yeon Kim · |"title":/);
    }
  });
});

describe('T115 (2)-1·2·3 껍데기 요소와 말풍선', () => {
  const html = renderToStaticMarkup(React.createElement(IntroScreen, { data: INTRO_SAMPLE }));

  it('탭 5개·See all = <a href="#"> (preventDefault), aria-disabled 없음', () => {
    expect(html.match(/<a class="tab( on)?" href="#">/g)).toHaveLength(5);
    expect(html).toMatch(/<a class="rlink" href="#">See all<\/a>/);
    expect(html).not.toContain('aria-disabled');
  });

  it('벨·도움말 = <button type="button" class="ico">, Transfer·Request = <button type="button" class="btn …">', () => {
    expect(html.match(/<button type="button" class="ico" aria-label="(Notifications|Help)">/g)).toHaveLength(2);
    expect(html).toMatch(/<button type="button" class="btn b-black">Transfer money<\/button>/);
    expect(html).toMatch(/<button type="button" class="btn b-line">Request payment<\/button>/);
  });

  it('cursor: 화면 css가 시안 pointer를 default로 덮지 않는다', () => {
    const css = strip(read('src/app/demo/seller-dashboard/intro.css'));
    expect(css).not.toMatch(/cursor:\s*default/);
    expect(css).not.toMatch(/aria-disabled/);
  });

  it('말풍선 버튼: <span>Open DisputeLess</span> + → 따로', () => {
    expect(html).toMatch(/<a class="btn" [^>]*href="\/\?item=PP-R-GMS-10197661"[^>]*><span>Open DisputeLess<\/span> →<\/a>/);
  });

  it('(2)-4 서연 화면 미리 불러오기: router.prefetch(TODAY_HREF)', () => {
    const src = strip(read('src/app/demo/seller-dashboard/intro-screen.tsx'));
    expect(src).toMatch(/router\.prefetch\(TODAY_HREF\)/);
    expect(src).toMatch(/const TODAY_HREF = '\/\?item=' \+ introEn\.targetDisputeId;/);
    expect(read('config/intro.en.json')).toContain('"targetDisputeId": "PP-R-GMS-10197661"');
  });
});

describe('T115 (2)-7 KO 글꼴', () => {
  it('루트 font-family는 Figtree, Noto Sans KR 순서이고 :lang(ko)에서 Noto를 앞에 두지 않는다', () => {
    const css = strip(read('src/app/demo/seller-dashboard/intro.css'));
    expect(css).toMatch(/\.intro \{[^}]*font-family: Figtree, 'Noto Sans KR'/);
    expect(css).not.toMatch(/:lang\(ko\)/);
  });
});

describe('T115 (2)-6·(3) 리다이렉트: Location은 상대 경로, 옛 주소는 308 + 쿼리 유지', () => {
  it('/lang: 프록시 안쪽 주소(https://localhost:10000)로 튕기지 않는다', () => {
    const res = langGet(new NextRequest('https://localhost:10000/lang?set=ko&next=%2Fdemo%2Fseller-dashboard%3Fx%3D1'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/demo/seller-dashboard?x=1');
    expect(res.headers.get('set-cookie')).toMatch(/afterloop_lang=ko/);
    const bad = langGet(new NextRequest('https://localhost:10000/lang?set=en&next=https%3A%2F%2Fevil.example%2F'));
    expect(bad.headers.get('location')).toBe('/');
  });

  it('/intro → /demo/seller-dashboard, /listing → /demo/store/new-product (308, 쿼리 그대로, 상대 경로)', () => {
    const a = introGet(new Request('https://localhost:10000/intro?lang=ko&item=PP-R-GMS-10197661'));
    expect(a.status).toBe(308);
    expect(a.headers.get('location')).toBe('/demo/seller-dashboard?lang=ko&item=PP-R-GMS-10197661');
    const b = listingGet(new Request('https://localhost:10000/listing'));
    expect(b.status).toBe(308);
    expect(b.headers.get('location')).toBe('/demo/store/new-product');
  });

  it('앱의 리다이렉트는 모두 상대 경로다: NextResponse.redirect·new URL(…, request.url) 없음, redirect()는 "/"로 시작', () => {
    for (const file of filesUnder('src/app')) {
      const src = strip(read(file));
      expect(src, file).not.toMatch(/NextResponse\.redirect\(/);
      expect(src, file).not.toMatch(/new URL\([^)]*,\s*request\.url\)/);
      for (const m of src.matchAll(/\bredirect\(\s*([`'"])(.)/g)) expect(m[2], file).toBe('/');
    }
  });

  it('page의 ?lang= 처리는 새 주소로 돌아온다', () => {
    expect(read('src/app/demo/seller-dashboard/page.tsx')).toMatch(/applyLangParam\(SELLER_DASHBOARD_PATH,/);
    expect(read('src/app/demo/store/new-product/page.tsx')).toMatch(/applyLangParam\(NEW_PRODUCT_PATH,/);
    expect(read('src/app/_shared/routes.ts')).toMatch(/SELLER_DASHBOARD_PATH = '\/demo\/seller-dashboard'/);
    expect(read('src/app/_shared/routes.ts')).toMatch(/NEW_PRODUCT_PATH = '\/demo\/store\/new-product'/);
  });

  it('앱 안에 /intro·/listing·/products로 가는 링크가 없다 (옛 주소 route 자신 제외)', () => {
    for (const file of filesUnder('src/app')) {
      if (file === 'src/app/intro/route.ts' || file === 'src/app/listing/route.ts') continue;
      if (file.startsWith('src/app/products/') || file.startsWith('src/app/(app)/products/')) continue; // T114가 지운다
      const src = strip(read(file));
      expect(src, file).not.toMatch(/(href|next|prefetch|push|replace)[=(:]\s*\{?\s*[`'"]\/(intro|listing|products)\b/);
      expect(src, file).not.toMatch(/[`'"]\/(intro|listing)(\?|[`'"])/);
    }
  });
});
