/**
 * T109 단위 테스트: /listing (Scene 3) — 시안 CSS 통째 복사 (사람 결정 2026-11-12 09:25).
 * 기대값 출처: 시안 파일 자체 `docs/design/mockup-v4/scene3/Main.dc.html` L15–L62 `<style>`과 L64 루트 div.
 * 파일 읽기 + 정적 렌더만 한다 (서버·AI·PayPal 호출 0회).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

(globalThis as { React?: typeof React }).React = React;
const { ListingScreenView } = await import('@/app/listing/listing-view');
const { buildView, initialState } = await import('@/app/listing/model');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const RAW = read('src/app/listing/listing.css');
const CSS = strip(RAW);
const MOCK = read('docs/design/mockup-v4/scene3/Main.dc.html');

/** 시안 <style> 블록을 규칙 단위로 나눈다 (`@keyframes`는 통째로) */
function mockupRules(): { line: number; selector: string | null; text: string }[] {
  const lines = MOCK.split('\n');
  const start = lines.findIndex((l) => l.trim() === '<style>');
  const end = lines.findIndex((l) => l.trim() === '</style>');
  const out: { line: number; selector: string | null; text: string }[] = [];
  for (let n = start + 1; n < end; n++) {
    const line = lines[n];
    let i = 0;
    while (i < line.length) {
      if (line.startsWith('@keyframes', i)) {
        let depth = 0;
        let j = i;
        for (; j < line.length; j++) {
          if (line[j] === '{') depth++;
          else if (line[j] === '}' && --depth === 0) break;
        }
        out.push({ line: n + 1, selector: null, text: line.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      const open = line.indexOf('{', i);
      const close = line.indexOf('}', open);
      out.push({ line: n + 1, selector: line.slice(i, open), text: line.slice(open, close + 1) });
      i = close + 1;
    }
  }
  return out;
}

const scope = (selector: string) =>
  selector
    .split(',')
    .map((s) => (s.trim() === 'body' ? 'body:has(.ls)' : s.trim().startsWith('.ls ') ? s.trim() : `.ls ${s.trim()}`))
    .join(',');

describe('T109 /listing 시안 CSS 통째 복사', () => {
  it('시안 L15–L62 <style>의 규칙이 모두 같은 값으로 listing.css에 있다 (선택자는 `.ls ` 범위만, 줄 주석 = 시안 줄 번호)', () => {
    const rules = mockupRules();
    expect(rules.length).toBeGreaterThanOrEqual(45);
    for (const r of rules) {
      const want = r.selector === null ? r.text : `${scope(r.selector)}${r.text}`;
      expect(CSS, `시안 L${r.line}: ${want}`).toContain(want);
      expect(RAW, `시안 L${r.line} 줄 주석`).toContain(`/* L${r.line} */`);
    }
    // keyframes 이름도 그대로
    for (const name of ['spin', 'pl', 'up', 'rise', 'flashA', 'flashB']) expect(CSS).toContain(`@keyframes ${name}{`);
  });

  it('화면 루트 .ls = 시안 L64 루트 값 (15px · line-height 1.5 · #000 · 바탕 #F6F7F9 · Figtree/Noto Sans KR) — globals body 값을 다시 정한다', () => {
    const root = /(?:^|\s)\.ls\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(root).toMatch(/min-height:100vh/);
    expect(root).toMatch(/background:#F6F7F9/);
    expect(root).toMatch(/color:#000000/);
    expect(root).toMatch(/font-size:15px/);
    expect(root).toMatch(/line-height:1\.5/);
    expect(root).toMatch(/font-family:var\(--font-figtree\),var\(--font-noto-kr\),Helvetica,Arial,sans-serif/);
    // globals body가 주는 값(overflow-wrap:anywhere, 글꼴 다듬기)도 끊는다
    expect(root).toMatch(/overflow-wrap:normal/);
    expect(root).toMatch(/-webkit-font-smoothing:auto/);
    // 시안 L64 값과 같은지 시안 파일에서 직접 확인
    expect(MOCK).toContain('<div class="ls" style="min-height: 100vh; background: #F6F7F9; color: #000000;');
    expect(MOCK).toContain('font-size: 15px; line-height: 1.5">');
    const html = renderToStaticMarkup(React.createElement(ListingScreenView, { view: buildView(initialState('en'), 'en') }));
    expect(html).toContain('<div class="ls" lang="en"><div class="ls-band" role="note">');
  });

  it('다른 화면에 새지 않는다: 모든 규칙이 .ls 아래(또는 ls- 접두 class, body:has(.ls), keyframes·media)이고, 이 CSS는 /listing 화면에서만 import한다', () => {
    const top = CSS.replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, '$1').replace(/@keyframes [a-zA-Z]+\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
    for (const m of top.matchAll(/([^{}]+)\{[^}]*\}/g)) {
      for (const sel of m[1].split(',').map((s) => s.trim())) {
        if (sel === '') continue;
        expect(/^(\.ls(\s|\{|:|\.|$)|\.ls[:{]|\.ls-[a-z0-9-]+|body:has\(\.ls\))/.test(sel), `범위 밖 선택자: ${sel}`).toBe(true);
      }
    }
    const importers = ['src/app/listing/listing-screen.tsx', 'src/app/listing/page.tsx', 'src/app/listing/listing-view.tsx']
      .filter((f) => read(f).includes("'./listing.css'"));
    expect(importers).toEqual(['src/app/listing/listing-screen.tsx']);
  });

  it('화면은 시안 class 이름을 쓴다 (btn·b-black·b-tint·card·fld·lab·ph·addph·addic·phl·snav·apib·livedot)', () => {
    const html = renderToStaticMarkup(React.createElement(ListingScreenView, { view: buildView(initialState('en'), 'en') }));
    for (const cls of ['btn b-black', 'btn b-tint', 'card ls-editor', 'fld', 'lab', 'ph', 'addph', 'addic', 'phl', 'snav on', 'apib', 'livedot']) {
      expect(html, cls).toContain(`class="${cls}"`);
    }
    // 화면 코드에 색·그림자 값을 쓰지 않는다 (값은 listing.css에만)
    expect(read('src/app/listing/listing-view.tsx')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|style=\{\{[^}]*(color|background)/);
  });
});
