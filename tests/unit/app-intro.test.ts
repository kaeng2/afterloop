/**
 * T078 단위 테스트: /intro 껍데기 화면. 기대값 출처: `tasks/T078.md` "만들 것"·"완료 기준".
 * 실호출 0회 — 서버·PayPal·엔진·AI를 부르지 않는 화면이라 파일 읽기와 정적 렌더만 한다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { INTRO_SAMPLE } from './intro-sample';

import introEn from '../../config/intro.en.json';
import introKo from '../../config/intro.ko.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch: () => {} }) }));
(globalThis as { React?: typeof React }).React = React;
const { IntroScreen } = await import('@/app/demo/seller-dashboard/intro-screen');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = renderToStaticMarkup(React.createElement(IntroScreen, { data: INTRO_SAMPLE }));
const SEOYEON = '/?item=PP-R-GMS-10197661';

describe('T078 /intro', () => {
  it('경로 파일이 있다', () => {
    expect(read('src/app/demo/seller-dashboard/page.tsx')).toMatch(/IntroScreen/);
  });

  it('이동 링크는 모두 Today(서연)로 가고, 껍데기 링크(탭 5·See all)는 href="#"이다 (T115)', () => {
    const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
    const moving = hrefs.filter((h) => h !== '#');
    expect(moving.length).toBeGreaterThanOrEqual(3);
    for (const href of moving) expect(href).toBe(SEOYEON);
    expect(hrefs.filter((h) => h === '#')).toHaveLength(6);
    expect(html).toContain('aria-label="Open DisputeLess"');
    expect(html).toContain('Handle all 3 with DisputeLess');
    expect(html).toContain('Respond →');
  });

  it('T115: 껍데기 버튼(벨·도움말·Transfer·Request)은 일반 type="button", aria-disabled 없음. 핸들러는 언어 2개 + 껍데기 링크의 preventDefault뿐', () => {
    expect(html).not.toContain('aria-disabled');
    const buttons = [...html.matchAll(/<button [^>]*>/g)].map((m) => m[0]);
    expect(buttons.length).toBe(6); // EN, 한국어, 벨, 도움말, Transfer, Request
    for (const b of buttons) expect(b).toContain('type="button"');
    const source = read('src/app/demo/seller-dashboard/intro-screen.tsx');
    expect(source.match(/onClick=\{\(\) => choose/g) ?? []).toHaveLength(2);
    expect(source.match(/onClick=\{stay\}/g) ?? []).toHaveLength(6);
    expect(source).toMatch(/const stay = \(event: MouseEvent<HTMLAnchorElement>\) => event\.preventDefault\(\);/);
    expect(source.match(/onClick=/g) ?? []).toHaveLength(8);
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

  it('서버·fetch·엔진·AI import가 없다 (정적 검사). T115: page는 언어 쿠키 + 사건 줄(`_server/intro-data`)만, 화면은 그 타입만', () => {
    const screen = read('src/app/demo/seller-dashboard/intro-screen.tsx').replace(/import type [^;]+_server\/intro-data';/g, '');
    const page = read('src/app/demo/seller-dashboard/page.tsx').replace(/_server\/(locale|intro-data)/g, '');
    for (const [file, text] of [['intro-screen.tsx', screen], ['page.tsx', page]]) {
      expect(/\bfetch\s*\(/.test(text), file).toBe(false);
      expect(/from\s+['"]@\/(engine|ai|exec|paypal)/.test(text), file).toBe(false);
      expect(/_server|server-only|\.\.\/\.\.\/(engine|ai|exec|paypal)/.test(text), file).toBe(false);
    }
  });

  it('T115: 사건 줄·건수는 문구 파일이 아니라 data에서 온다 — 문구 파일엔 cases·openCount가 없고 Lena도 없다', () => {
    for (const copy of [introEn, introKo]) {
      expect(JSON.stringify(copy)).not.toMatch(/Lena/);
      expect('cases' in copy).toBe(false);
      expect('openCount' in copy).toBe(false);
      for (const key of ['rcOpen', 'rcCta', 'coach'] as const) expect(copy[key]).toContain('{{n}}');
      expect(copy.salesSub).toContain('{{days}}');
    }
  });

  it('영어·한국어 문구 파일의 키가 같다', () => {
    const keys = (o: object): string[] => Object.keys(o).sort();
    expect(keys(introKo)).toEqual(keys(introEn));
    expect(keys(introKo.nav)).toEqual(keys(introEn.nav));
    expect(keys(introKo.reasons)).toEqual(keys(introEn.reasons));
    expect(introKo.fallbackDue).toEqual(introEn.fallbackDue);
    expect(introKo.activities).toHaveLength(introEn.activities.length);
    expect(introKo.bars).toEqual(introEn.bars);
  });
});
