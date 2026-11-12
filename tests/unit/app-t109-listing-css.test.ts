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
const { ListingScreenView } = await import('@/app/demo/store/new-product/listing-view');
const { buildView, initialState } = await import('@/app/demo/store/new-product/model');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const RAW = read('src/app/demo/store/new-product/listing.css');
const CSS = strip(RAW);


describe('T109 /listing 시안 CSS 통째 복사', () => {


  it('다른 화면에 새지 않는다: 모든 규칙이 .ls 아래(또는 ls- 접두 class, body:has(.ls), keyframes·media)이고, 이 CSS는 /listing 화면에서만 import한다', () => {
    const top = CSS.replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, '$1').replace(/@keyframes [a-zA-Z]+\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '');
    for (const m of top.matchAll(/([^{}]+)\{[^}]*\}/g)) {
      for (const sel of m[1].split(',').map((s) => s.trim())) {
        if (sel === '') continue;
        expect(/^(\.ls(\s|\{|:|\.|$)|\.ls[:{]|\.ls-[a-z0-9-]+|body:has\(\.ls\))/.test(sel), `범위 밖 선택자: ${sel}`).toBe(true);
      }
    }
    const importers = ['src/app/demo/store/new-product/listing-screen.tsx', 'src/app/demo/store/new-product/page.tsx', 'src/app/demo/store/new-product/listing-view.tsx']
      .filter((f) => read(f).includes("'./listing.css'"));
    expect(importers).toEqual(['src/app/demo/store/new-product/listing-screen.tsx']);
  });

  it('화면은 시안 class 이름을 쓴다 (btn·b-black·b-tint·card·fld·lab·ph·addph·addic·phl·snav·apib·livedot)', () => {
    const html = renderToStaticMarkup(React.createElement(ListingScreenView, { view: buildView(initialState('en'), 'en') }));
    for (const cls of ['btn b-black', 'btn b-tint', 'card ls-editor', 'fld', 'lab', 'ph', 'addph', 'addic', 'phl', 'snav on', 'apib', 'livedot']) {
      expect(html, cls).toContain(`class="${cls}"`);
    }
    // 화면 코드에 색·그림자 값을 쓰지 않는다 (값은 listing.css에만)
    expect(read('src/app/demo/store/new-product/listing-view.tsx')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|style=\{\{[^}]*(color|background)/);
  });
});
