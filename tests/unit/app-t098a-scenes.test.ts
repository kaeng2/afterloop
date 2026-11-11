/**
 * T098a 단위 테스트: Scene 1 (/intro)·Scene 3 (/listing) 시안 맞추기.
 * 기대값 출처: 시안 파일 자체 (`docs/design/mockup-v4/scene1/Scene1.dc.html`, `docs/design/mockup-v4/scene3/Main.dc.html`)
 * — DECISIONS 2026-11-11 22:55 "기준은 시안 파일 자체". 줄 번호는 시안 파일 줄.
 * 파일 읽기 + 정적 렌더만 한다 (서버·AI·PayPal 호출 0회).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: false }) }));

(globalThis as { React?: typeof React }).React = React;
const { IntroScreen } = await import('@/app/intro/intro-screen');
const { ListingScreenView } = await import('@/app/listing/listing-view');
const { buildView, initialState, makeReducer } = await import('@/app/listing/model');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const INTRO = strip(read('src/app/intro/intro.css'));
const LS = strip(read('src/app/listing/listing.css'));
const rule = (css: string, sel: string) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';
};
const v = (css: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim().toLowerCase();

describe('T098a Scene 1 /intro', () => {
  const html = renderToStaticMarkup(React.createElement(IntroScreen));

  it('L20 활성 탭 밑줄과 로고 자리 글자색은 #002991 (강조색 #0066F5가 아님)', () => {
    expect(v(INTRO, '--i-deep')).toBe('#002991');
    expect(rule(INTRO, '.intro-tab.on')).toMatch(/border-bottom-color:\s*var\(--i-deep\)/);
    expect(rule(INTRO, '.intro-logo')).toMatch(/color:\s*var\(--i-deep\)/);
  });

  it('L27 focus-visible = 흰 고리 box-shadow #FFFFFF 0 0 0 2px + outline 2px solid #097FF5 (offset 2px)', () => {
    expect(v(INTRO, '--i-focus')).toBe('#097ff5');
    expect(v(INTRO, '--i-shadow-focus')).toBe('#ffffff 0 0 0 2px');
    const focus = /\.intro \.intro-btn:focus-visible[^{]*\{([^}]*)\}/.exec(INTRO)?.[1] ?? '';
    expect(focus).toMatch(/box-shadow:\s*var\(--i-shadow-focus\)/);
    expect(focus).toMatch(/outline:\s*2px solid var\(--i-focus\)/);
    expect(focus).toMatch(/outline-offset:\s*2px/);
  });

  it('L26·L28·L29 아이콘: 그림자 rgba(0,112,224,.45) 0 4px 14px, pulse는 box-shadow 0→16px 고리 1.6s ease-out infinite', () => {
    expect(v(INTRO, '--i-shadow-icon')).toBe('rgba(0, 112, 224, 0.45) 0 4px 14px');
    expect(rule(INTRO, '.intro-al-icon')).toMatch(/box-shadow:\s*var\(--i-shadow-icon\)/);
    expect(rule(INTRO, '.intro-pulse')).toMatch(/animation:\s*intro-pulse 1\.6s ease-out infinite/);
    const kf = /@keyframes intro-pulse\s*\{([\s\S]*?)\n\}/.exec(INTRO)?.[1] ?? '';
    expect(kf).toMatch(/0%\s*\{\s*box-shadow:\s*var\(--i-shadow-pulse-from\)/);
    expect(kf).toMatch(/100%\s*\{\s*box-shadow:\s*var\(--i-shadow-pulse-to\)/);
    expect(v(INTRO, '--i-shadow-pulse-from')).toBe('0 0 0 0 rgba(0, 102, 245, 0.55)');
    expect(v(INTRO, '--i-shadow-pulse-to')).toBe('0 0 0 16px rgba(0, 102, 245, 0)');
    expect(html).toMatch(/class="intro-al-icon intro-pulse"/);
    expect(INTRO).not.toMatch(/intro-al-icon::after/);
  });

  it('L62·L64 말풍선: 그림자 rgba(0,0,0,.25) 0 12px 32px, NEW 꼬리표 그라디언트 #0066F5→#60CDFF', () => {
    expect(v(INTRO, '--i-shadow-coach')).toBe('rgba(0, 0, 0, 0.25) 0 12px 32px');
    expect(rule(INTRO, '.intro-coach')).toMatch(/box-shadow:\s*var\(--i-shadow-coach\)/);
    expect(v(INTRO, '--i-grad-new')).toBe('linear-gradient(120deg, #0066f5, #60cdff)');
    expect(rule(INTRO, '.intro-new')).toMatch(/background:\s*var\(--i-grad-new\)/);
  });

  it('L104 Handle all 버튼 그라디언트 120deg #002991, #0066F5 60%, #60CDFF · gap 10px, L23 검정 버튼 hover #333333', () => {
    expect(v(INTRO, '--i-grad-cta')).toBe('linear-gradient(120deg, #002991, #0066f5 60%, #60cdff)');
    expect(rule(INTRO, '.intro-btn-accent')).toMatch(/background:\s*var\(--i-grad-cta\)/);
    expect(rule(INTRO, '.intro-btn-accent')).toMatch(/gap:\s*10px/);
    expect(rule(INTRO, '.intro-btn')).toMatch(/gap:\s*8px/);
    expect(rule(INTRO, '.intro-btn')).toMatch(/white-space:\s*nowrap/);
    expect(v(INTRO, '--i-black-hover')).toBe('#333333');
    expect(rule(INTRO, '.intro-btn-black:hover')).toMatch(/background:\s*var\(--i-black-hover\)/);
  });

  it('L44 "Demo mock" 칩 (#ECEEF0 바탕, #3F4144 글자)이 가게 종류 옆에 있다', () => {
    expect(html).toContain('<span class="intro-chip intro-chip-mock">Demo mock</span>');
    expect(rule(INTRO, '.intro-chip-mock')).toMatch(/background:\s*var\(--i-chip-bg\)/);
    expect(v(INTRO, '--i-chip-bg')).toBe('#eceef0');
  });

  it('누를 수 있는 것 4개(아이콘·말풍선 버튼·Respond·Handle all)는 모두 Today(서연)로 간다', () => {
    const links = [...html.matchAll(/<a [^>]*class="([^"]+)"[^>]*href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(links.map((l) => l[0]).sort()).toEqual(
      ['intro-al-icon intro-pulse', 'intro-btn intro-btn-white', 'intro-rlink', 'intro-rlink', 'intro-btn intro-btn-accent'].sort(),
    );
    for (const [, href] of links) expect(href).toBe('/?item=PP-R-GMS-10197661');
  });

  it('움직임 줄이기: pulse·말풍선 rise를 끈다', () => {
    expect(INTRO).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.intro-pulse,\s*\.intro-coach\s*\{\s*animation:\s*none/);
  });
});

describe('T098a Scene 3 /listing', () => {
  const view = (step?: (s: ReturnType<typeof initialState>) => ReturnType<typeof initialState>) => {
    const s0 = initialState('en');
    return buildView(step ? step(s0) : s0, 'en');
  };
  const render = (photos: string[] = []) =>
    renderToStaticMarkup(React.createElement(ListingScreenView, { view: view(), userPhotos: photos }));

  it('L20 검정 버튼은 #000000 (잉크 #0B0F14가 아님), L21 연한 버튼은 #05378214 / hover #05378227', () => {
    expect(v(LS, '--ls-black')).toBe('#000000');
    expect(rule(LS, '.ls-b-black')).toMatch(/background:\s*var\(--ls-black\)/);
    expect(v(LS, '--ls-tint')).toBe('#05378214');
    expect(v(LS, '--ls-tint-hover')).toBe('#05378227');
  });

  it('L126 결과판 바탕 #EEF1F5, L537·L555 좋아졌을 때 확률 색은 #002991', () => {
    expect(v(LS, '--ls-panel')).toBe('#eef1f5');
    expect(rule(LS, '.ls-panel')).toMatch(/background:\s*var\(--ls-panel\)/);
    expect(rule(LS, '.ls-big.good')).toMatch(/color:\s*var\(--ls-accent-deep\)/);
    expect(rule(LS, '.ls-done-prob.good')).toMatch(/color:\s*var\(--ls-accent-deep\)/);
  });

  it('L58·L59 flashA/B는 #E3F3FF → #FFFFFF', () => {
    for (const name of ['ls-flashA', 'ls-flashB']) {
      const kf = new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(LS)?.[1] ?? '';
      expect(kf).toMatch(/0%\s*\{\s*background:\s*var\(--ls-accent-flash\)/);
      expect(kf).toMatch(/100%\s*\{\s*background:\s*var\(--ls-surface\)/);
    }
  });

  it('시안 그림자: snav.on·사진 inset 1px #E4E6E9, Insert inset 2px #99C2FF, 체크 inset 2px #CFD3D8, livedot 3px 고리, 툴팁·모달·더하기 그림자', () => {
    expect(rule(LS, '.ls-snav.on')).toMatch(/box-shadow:\s*var\(--ls-shadow-line\)/);
    expect(rule(LS, '.ls-ph')).toMatch(/box-shadow:\s*var\(--ls-shadow-line\)/);
    expect(rule(LS, '.ls-ins')).toMatch(/box-shadow:\s*var\(--ls-shadow-ins\)/);
    expect(rule(LS, '.ls-ins')).toMatch(/border:\s*0/);
    expect(rule(LS, '.ls-check-ic')).toMatch(/box-shadow:\s*var\(--ls-shadow-check\)/);
    expect(rule(LS, '.ls-livedot')).toMatch(/box-shadow:\s*var\(--ls-shadow-live\)/);
    expect(rule(LS, '.ls-tipb')).toMatch(/box-shadow:\s*var\(--ls-shadow-tip\)/);
    expect(rule(LS, '.ls-sheet')).toMatch(/box-shadow:\s*var\(--ls-shadow-sheet\)/);
    expect(rule(LS, '.ls-addic')).toMatch(/box-shadow:\s*var\(--ls-shadow-addic\)/);
    expect(v(LS, '--ls-shadow-line')).toBe('inset 0 0 0 1px #e4e6e9');
    expect(v(LS, '--ls-shadow-ins')).toBe('inset 0 0 0 2px #99c2ff');
    expect(v(LS, '--ls-shadow-check')).toBe('inset 0 0 0 2px #cfd3d8');
  });

  it('L38 .btn·.fld·.ins focus-visible = 흰 고리 + outline #097FF5', () => {
    const focus = /\.ls \.ls-btn:focus-visible,\s*\.ls \.ls-fld:focus-visible,\s*\.ls \.ls-ins:focus-visible\s*\{([^}]*)\}/.exec(LS)?.[1] ?? '';
    expect(focus).toMatch(/box-shadow:\s*var\(--ls-shadow-focus\)/);
    expect(v(LS, '--ls-shadow-focus')).toBe('#ffffff 0 0 0 2px');
    expect(rule(LS, '.ls :focus-visible')).toMatch(/outline:\s*2px solid var\(--ls-focus\)/);
  });

  it('L93 Add photo: 파일 입력이 있고, 고른 사진은 "Your photo"로 사진 줄에 붙는다 (hover·focus-within·transition 시안 값)', () => {
    const plain = render();
    expect(plain).toMatch(/<label class="ls-addph"><input type="file" accept="image\/\*" aria-label="Add photo"/);
    expect(plain).not.toContain('data-user-photo');
    const withPhoto = render(['blob:local-1']);
    expect(withPhoto).toContain('<div class="ls-ph" data-user-photo=""><img src="blob:local-1" alt="Your photo"/><span class="ls-phl">Your photo</span></div>');
    expect(rule(LS, '.ls-addph')).toMatch(/transition:\s*border-color 0\.15s,\s*background-color 0\.15s/);
    expect(rule(LS, '.ls-addph:hover')).toMatch(/border-color:\s*var\(--ls-navy\)/);
    expect(rule(LS, '.ls-addph:hover')).toMatch(/background:\s*var\(--ls-bg\)/);
    expect(rule(LS, '.ls-addph:focus-within')).toMatch(/outline:\s*2px solid var\(--ls-focus\)/);
    expect(read('src/app/listing/listing-screen.tsx')).toMatch(/URL\.createObjectURL\(file\)/);
  });

  it('L73 왼쪽 메뉴 6개는 선 아이콘 + 글자, "PayPal payments"는 아이콘 없음(로고 예외)', () => {
    const html = render();
    const items = [...html.matchAll(/<button type="button" class="ls-snav( on)?" aria-disabled="true"><svg width="18" height="18"/g)];
    expect(items).toHaveLength(6);
    expect(html).toMatch(/<button type="button" class="ls-snav" aria-disabled="true">PayPal payments<\/button>/);
  });

  it('L183·L184 점검 모달: 회전 고리는 #002991→#60CDFF 그라디언트, 가운데 그래프 아이콘이 pulse 1.2s', () => {
    const reducer = makeReducer('en');
    const sheet = view((s) => reducer(s, { type: 'publish' }));
    const html = renderToStaticMarkup(React.createElement(ListingScreenView, { view: sheet }));
    expect(html).toContain('<linearGradient id="ls-spg"');
    expect(html).toContain('<stop offset="0" class="ls-spg-a"></stop>');
    expect(html).toContain('class="ls-pulse-ic"');
    expect(rule(LS, '.ls-spin-arc')).toMatch(/stroke:\s*url\(#ls-spg\)/);
    expect(rule(LS, '.ls-spg-a')).toMatch(/stop-color:\s*var\(--ls-accent-deep\)/);
    expect(rule(LS, '.ls-spg-b')).toMatch(/stop-color:\s*var\(--ls-accent-light\)/);
    expect(rule(LS, '.ls-run-t')).toMatch(/font-size:\s*12px/);
    expect(html).toMatch(/class="ls-run-t" data-progress="0\/500"/);
  });

  it('L42 칩 white-space:nowrap, L43 AI 칩 gap 4px, 읽기 전용 입력칸도 흰 바탕(L40)', () => {
    expect(rule(LS, '.ls-chip')).toMatch(/white-space:\s*nowrap/);
    expect(rule(LS, '.ls-ai')).toMatch(/gap:\s*4px/);
    expect(LS).not.toMatch(/\.ls-fld\[readonly\]/);
  });
});
