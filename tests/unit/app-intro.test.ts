/**
 * T078 단위 테스트: /intro 껍데기 화면. 기대값 출처: `tasks/T078.md` "만들 것"·"완료 기준".
 * 실호출 0회 — 서버·PayPal·엔진·AI를 부르지 않는 화면이라 파일 읽기와 정적 렌더만 한다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import introEn from '../../config/intro.en.json';
import introKo from '../../config/intro.ko.json';

(globalThis as { React?: typeof React }).React = React;
const { IntroScreen } = await import('@/app/demo/seller-dashboard/intro-screen');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = renderToStaticMarkup(React.createElement(IntroScreen));
const SEOYEON = '/?item=PP-R-GMS-10197661';

describe('T078 /intro', () => {
  it('경로 파일이 있다', () => {
    expect(read('src/app/demo/seller-dashboard/page.tsx')).toMatch(/IntroScreen/);
  });

  it('링크는 세 곳(아이콘, 말풍선 버튼 포함 4개 중 같은 길)만 있고 모두 Today(서연)로 간다', () => {
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of hrefs) expect(href).toBe(SEOYEON);
    expect(html).toContain('aria-label="Open DisputeLess"');
    expect(html).toContain('Handle all 2 with DisputeLess');
    expect(html).toContain('Respond →');
  });

  it('나머지 버튼은 type="button" + aria-disabled이고 핸들러가 없다 (언어 선택 제외)', () => {
    const buttons = [...html.matchAll(/<button [^>]*>/g)].map((m) => m[0]);
    const inert = buttons.filter((b) => b.includes('aria-disabled="true"'));
    expect(inert.length).toBeGreaterThanOrEqual(9);
    for (const b of inert) expect(b).toContain('type="button"');
    const source = read('src/app/demo/seller-dashboard/intro-screen.tsx');
    const onClicks = source.match(/onClick=/g) ?? [];
    expect(onClicks).toHaveLength(2); // EN / KO 언어 선택뿐
  });

  it('"Demo mock — not a real PayPal page" 띠가 있고, 로고 자리 글자는 Seller dashboard다', () => {
    expect(html).toContain('Demo mock — not a real PayPal page');
    expect(html).toMatch(/<span class="intro-logo" style="[^"]*">Seller dashboard<\/span>/);
    expect(introKo.mockBand).toContain('PayPal');
    expect(introEn.brand).toBe('Seller dashboard');
  });

  it('화면 코드·css에 남보라가 없고 PayPal 글꼴·로고도 없다 (T089: 시안 v4 파랑은 허용)', () => {
    for (const file of ['src/app/demo/seller-dashboard/intro-screen.tsx', 'src/app/demo/seller-dashboard/intro.css', 'src/app/demo/seller-dashboard/page.tsx']) {
      const text = read(file);
      for (const violet of ['#5b3cc4', '#a996f0', 'rgba(91, 60, 196']) expect(text.toLowerCase(), file).not.toContain(violet);
      expect(/font-family\s*:[^;]*paypal/i.test(text), file).toBe(false);
      expect(/PayPal/.test(text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), file).toBe(false);
    }
  });

  it('서버·fetch·엔진·AI import가 없다 (정적 검사)', () => {
    for (const file of ['src/app/demo/seller-dashboard/intro-screen.tsx', 'src/app/demo/seller-dashboard/page.tsx']) {
      const text = read(file).replace(/_server\/locale/g, '');
      expect(/\bfetch\s*\(/.test(text), file).toBe(false);
      expect(/from\s+['"]@\/(engine|ai|exec|paypal)/.test(text), file).toBe(false);
      // 언어 쿠키 읽기(`_server/locale`, T081)만 허용 — 데이터·PayPal을 부르지 않는다
      expect(/_server|server-only|\.\.\/\.\.\/(engine|ai|exec|paypal)/.test(text), file).toBe(false);
    }
  });

  it('Lena가 없고, 서연·지호 번호와 마감이 실제 값이며, 남은 분쟁 수와 문구가 맞다', () => {
    for (const copy of [introEn, introKo]) {
      expect(JSON.stringify(copy)).not.toMatch(/Lena/);
      expect(copy.cases.map((k) => k.id)).toEqual(['PP-R-GMS-10197661', 'PP-R-MBJ-10197650']);
      expect(copy.openCount).toBe(String(copy.cases.length));
      expect(copy.rcCta).toContain(String(copy.cases.length));
      expect(copy.coach).toContain(String(copy.cases.length));
    }
    expect(introEn.cases[0].due).toContain('Nov 30');
    expect(introKo.cases[0].due).toContain('11/30');
  });

  it('영어·한국어 문구 파일의 키가 같다', () => {
    const keys = (o: object): string[] => Object.keys(o).sort();
    expect(keys(introKo)).toEqual(keys(introEn));
    expect(keys(introKo.nav)).toEqual(keys(introEn.nav));
    expect(introKo.activities).toHaveLength(introEn.activities.length);
    expect(introKo.bars).toEqual(introEn.bars);
  });
});
