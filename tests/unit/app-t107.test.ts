/**
 * T107: Desk(`/`) — 시안 `docs/design/mockup-v4/Desk.dc.html` <style> 통째 복사 (사람 결정 2026-11-12 09:25).
 *
 * 정적 시험만 (동작 시험은 T102–T106 시험이 그대로 본다):
 *  1. 시안 L16–L93 규칙이 `src/app/(app)/desk.css`에 모두 있다 — 선언 블록 `{…}`은 글자 그대로, 선택자는 `.dk ` 아래로.
 *     줄마다 시안 줄 번호 주석.
 *  2. 화면 루트 `.dk` = 시안 L96 값 (15px · line-height 1.5 · #000 · #FFF · min-height 100vh). globals body 값을 다시 정한다.
 *  3. desk.css는 `/` 화면(page.tsx)에서만 import하고, 규칙은 모두 `.dk` 아래 또는 `body:has(.dk)` 아래다 (다른 화면에 새지 않음).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { setLocaleResolver, t } from '@/app/_shared/copy';
import type { CaseMessageView } from '@/app/cases/model';

// 화면 파일은 고전 JSX 변환이라 전역 React가 필요하다 (다른 화면 시험과 같은 방법)
(globalThis as { React?: typeof React }).React = React;
const { Conversation } = await import('@/app/cases/view/conversation');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const DESK = read('src/app/(app)/desk.css');

/** 한 줄의 최상위 규칙들 (`@keyframes`처럼 중첩 괄호 포함) */
function rules(line: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '{') depth += 1;
    else if (line[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        out.push(line.slice(start, i + 1));
        start = i + 1;
      }
    }
  }
  return out;
}


describe('T107-3 한국어 화면 말풍선 (시안 DI.ko msgs: 번역 없이 날짜만)', () => {
  const MESSAGE: CaseMessageView = {
    source: 'paypal',
    badges: [],
    sourceKey: null,
    date: '2026-11-02',
    original: [{ text: '배송 조회가 일주일째 그대로예요.', mark: false }],
    english: [{ text: 'Tracking has not changed in a week.', mark: false }],
    englishBadges: [],
    originalIsEnglish: false,
  };
  const render = () => renderToStaticMarkup(createElement(Conversation, { messages: [MESSAGE], locale: 'ko' }));

  it('영어 화면: "Translated · 영어 · 날짜" (그대로)', () => {
    const markup = render();
    // T122a 시안 v6 L314: "Translated" 굵은 파랑 <b>
    expect(markup).toContain(`<b class="case-bubble-tr">${t('case.view.translated', undefined, 'en')}</b>`);
    expect(markup).toContain('Tracking has not changed in a week.');
  });

  it('한국어 화면: 영어 번역 줄 없이 날짜만', () => {
    setLocaleResolver(() => 'ko');
    try {
      const markup = render();
      expect(markup).not.toContain('Tracking has not changed in a week.');
      expect(markup).not.toContain(t('case.view.translated', undefined, 'ko'));
      expect(markup).toMatch(/<div class="case-bubble-sub">[^<]+<\/div>/);
    } finally {
      setLocaleResolver(() => 'en');
    }
  });
});

describe('T107-2 화면 루트 기본값', () => {

  it('page.tsx 화면 루트에 .dk가 있고 desk.css는 page.tsx에서만 import한다', () => {
    const page = read('src/app/(app)/page.tsx');
    expect(page).toMatch(/className="dk today-page"/);
    expect(page).toContain("import '@/app/(app)/desk.css';");
    expect(read('src/app/(app)/layout.tsx')).not.toContain('desk.css');
  });

  it('desk.css 규칙은 모두 .dk 아래 / body:has(.dk) 아래 / @keyframes / 시안 body{margin:0} / @media 안이다', () => {
    const text = DESK.replace(/\/\*[\s\S]*?\*\//g, '');
    const top = rules(text.replace(/\n/g, ' ')).map((rule) => rule.trim());
    for (const rule of top) {
      const selector = rule.slice(0, rule.indexOf('{')).trim();
      if (selector.startsWith('@keyframes') || selector === 'body') continue;
      if (selector.startsWith('@media')) {
        const inner = rule.slice(rule.indexOf('{') + 1, -1);
        for (const nested of rules(inner)) {
          for (const part of nested.slice(0, nested.indexOf('{')).split(',')) expect(part.trim(), nested).toMatch(/^\.dk\b/);
        }
        continue;
      }
      for (const part of selector.split(',')) expect(part.trim(), rule.slice(0, 80)).toMatch(/^(\.dk\b|body:has\(\.dk\))/);
    }
  });
});
