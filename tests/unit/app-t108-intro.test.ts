/**
 * T108 단위 테스트: /intro 시안 CSS 통째 복사. 기대값 출처: `tasks/T108.md` 완료 기준, 시안 `docs/design/mockup-v4/scene1/Scene1.dc.html`.
 * 파일 읽기 + 정적 렌더만 한다 (서버·AI·PayPal 호출 0회).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { INTRO_SAMPLE } from './intro-sample';

vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch: () => {} }) }));
(globalThis as { React?: typeof React }).React = React;
const { IntroScreen } = await import('@/app/demo/seller-dashboard/intro-screen');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const MOCK = read('docs/design/mockup-v4/scene1/Scene1.dc.html');
const SCENE1 = read('src/app/demo/seller-dashboard/scene1.css');
const INTRO = read('src/app/demo/seller-dashboard/intro.css');
const html = renderToStaticMarkup(React.createElement(IntroScreen, { data: INTRO_SAMPLE }));

/** 시안 <style> 블록의 규칙(선택자{본문}) 목록. */
const mockRules = (() => {
  const block = /<style>([\s\S]*?)<\/style>/.exec(MOCK)?.[1] ?? '';
  const rules: { selector: string; body: string }[] = [];
  for (const m of block.matchAll(/([^{}]+)\{((?:[^{}]|\{[^{}]*\})*)\}/g)) rules.push({ selector: m[1].trim(), body: m[2].trim() });
  return rules;
})();

describe('T108 /intro 시안 CSS 복사', () => {
  it('시안 <style> 블록의 모든 규칙 본문(값·keyframes)이 scene1.css에 그대로 있다', () => {
    expect(mockRules.length).toBeGreaterThanOrEqual(20);
    for (const rule of mockRules) {
      if (rule.selector === 'body') continue; // 범위 밖 (globals가 margin 0)
      expect(SCENE1, rule.selector).toContain(rule.body);
    }
  });

  it('시안 선택자가 모두 있고(앞에 .intro 범위만 붙음), 시안 줄 번호 주석이 있다', () => {
    for (const rule of mockRules) {
      if (rule.selector === 'body') continue;
      if (rule.selector.startsWith('@keyframes')) {
        expect(SCENE1, rule.selector).toContain(rule.selector);
        continue;
      }
      for (const sel of rule.selector.split(',')) {
        const bare = sel.trim().replace(/^\.pp\s*/, '');
        expect(SCENE1, sel).toContain(bare);
      }
    }
    expect(SCENE1).toMatch(/\/\* L19 \*\//);
  });

  it('범위: 규칙 선택자는 모두 .intro 아래다 (다른 화면 영향 0)', () => {
    const css = SCENE1.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const line of css.split('\n').filter((l) => l.trim() && !l.trim().startsWith('@keyframes'))) {
      for (const m of line.matchAll(/(?:^|\})\s*([^{}]+)\{/g)) {
        for (const sel of m[1].split(',')) expect(sel.trim(), sel).toMatch(/^(:where\(\.intro\)|\.intro)\s/);
      }
    }
  });

  it('화면 루트 기본값 = 시안 루트 값이고, globals body 값(16px·overflow-wrap·글꼴 매끄럽게)이 안으로 내려오지 않는다', () => {
    expect(MOCK).toContain('min-height: 100vh; background: #F1EFEA; color: #000000; font-family: Figtree, \'Noto Sans KR\', Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.5');
    const root = /\n\.intro\s*\{([^}]*)\}/.exec(INTRO)?.[1] ?? '';
    for (const decl of [
      'min-height: 100vh',
      'background: #f1efea',
      'color: #000000',
      "font-family: Figtree, 'Noto Sans KR', Helvetica, Arial, sans-serif",
      'font-size: 15px',
      'line-height: 1.5',
      'overflow-wrap: normal',
      '-webkit-font-smoothing: auto',
    ]) {
      expect(root, decl).toContain(decl);
    }
  });

  it('시안 클래스가 실제 요소에 쓰인다 (tab, card, btn, b-black, b-line, ico, al-icon, pulse, rise, row, chip, rlink)', () => {
    for (const cls of ['tab on', 'card', 'btn b-black', 'btn b-line', 'ico', 'al-icon pulse', 'rise', 'row', 'chip', 'rlink']) {
      expect(html, cls).toContain(`class="${cls}`);
    }
  });
});
