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
const { IntroScreen } = await import('@/app/demo/seller-dashboard/intro-screen');
const { ListingScreenView } = await import('@/app/demo/store/new-product/listing-view');
const { buildView, initialState, makeReducer } = await import('@/app/demo/store/new-product/model');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const INTRO = strip(read('src/app/demo/seller-dashboard/intro.css'));
const LS = strip(read('src/app/demo/store/new-product/listing.css'));
const rule = (css: string, sel: string) => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';
};
const v = (css: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1].trim().toLowerCase();

describe('T098a Scene 1 /intro', () => {
  const html = renderToStaticMarkup(React.createElement(IntroScreen));

  // T108: 시안 CSS 통째 복사로 바꿔 규칙 이름이 시안 이름(.tab, .al-icon …)이 됐다. 시안 값 자체는 app-t108-intro 시험이 파일 대조로 본다.
  const SCENE1 = strip(read('src/app/demo/seller-dashboard/scene1.css'));

  it('L20·L23·L26·L27·L29 시안 규칙이 scene1.css에 그대로 있다 (밑줄 #002991, hover #333333, 아이콘 그림자, 포커스 고리, pulse)', () => {
    expect(SCENE1).toMatch(/\.tab\.on\{color:#000000;border-bottom-color:#002991\}/);
    expect(SCENE1).toMatch(/\.b-black:hover\{background:#333333\}/);
    expect(SCENE1).toMatch(/box-shadow:rgba\(0,112,224,0\.45\) 0 4px 14px/);
    expect(SCENE1).toMatch(/box-shadow:#FFFFFF 0 0 0 2px;outline:2px solid #097FF5;outline-offset:2px/);
    expect(SCENE1).toMatch(/\.pulse\{animation:pulse 1\.6s ease-out infinite\}/);
    expect(SCENE1).toMatch(/@keyframes pulse\{0%\{box-shadow:0 0 0 0 rgba\(0,102,245,\.55\)\}100%\{box-shadow:0 0 0 16px rgba\(0,102,245,0\)\}\}/);
    expect(html).toMatch(/class="al-icon pulse"/);
  });

  it('L44 "Demo mock" 칩 (#ECEEF0 바탕, #3F4144 글자)이 가게 종류 옆에 있다', () => {
    expect(html).toMatch(/<span class="chip" style="[^"]*background:#ECEEF0;color:#3F4144[^"]*">Demo mock<\/span>/);
  });

  it('누를 수 있는 것 4개(아이콘·말풍선 버튼·Respond·Handle all)는 모두 Today(서연)로 간다', () => {
    const links = [...html.matchAll(/<a [^>]*class="([^"]+)"[^>]*href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(links.map((l) => l[0]).sort()).toEqual(['al-icon pulse', 'btn', 'rlink', 'rlink', 'btn'].sort());
    for (const [, href] of links) expect(href).toBe('/?item=PP-R-GMS-10197661');
  });

  it('움직임 줄이기: pulse·말풍선 rise를 끈다', () => {
    expect(INTRO).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.intro \.pulse,\s*\.intro \.rise\s*\{\s*animation:\s*none/);
  });
});

// T109 (사람 결정 2026-11-12 09:25 "시안 CSS 통째 복사"): /listing은 `--ls-*` 변수 대신 시안 <style>·인라인 값 그대로.
// 아래 기대값은 같은 시안 줄의 값을 그대로 본다 (옛 기대: 변수 이름 `--ls-black` 등 → 지금: 시안 값 `#000000` 등).
describe('T098a Scene 3 /listing', () => {
  const view = (step?: (s: ReturnType<typeof initialState>) => ReturnType<typeof initialState>) => {
    const s0 = initialState('en');
    return buildView(step ? step(s0) : s0, 'en');
  };
  const render = (photos: string[] = []) =>
    renderToStaticMarkup(React.createElement(ListingScreenView, { view: view(), userPhotos: photos }));
  /** 한 줄 규칙 `선택자{…}`의 본문 (시안 복사 형식) */
  const ls = (sel: string) => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[\\s}])${esc}\\{([^}]*)\\}`).exec(LS)?.[1] ?? '';
  };

  it('L20 검정 버튼은 #000000 (잉크 #0B0F14가 아님), L21 연한 버튼은 #05378214 / hover #05378227', () => {
    expect(ls('.ls .b-black')).toBe('background:#000000;color:#FFFFFF');
    expect(ls('.ls .b-tint')).toBe('background:#05378214;color:#000000');
    expect(ls('.ls .b-tint:hover')).toBe('background:#05378227');
    expect(render()).toMatch(/class="btn b-black" data-action="publish"/);
  });

  it('L126 결과판 바탕 #EEF1F5, L537·L555 좋아졌을 때 확률 색은 #002991', () => {
    expect(ls('.ls-panel')).toMatch(/background:#EEF1F5/);
    expect(ls('.ls-big.good')).toBe('color:#002991');
    expect(ls('.ls-done-prob.good')).toBe('color:#002991');
  });

  it('L58·L59 flashA/B는 #E3F3FF → #FFFFFF', () => {
    expect(LS).toContain('@keyframes flashA{0%{background:#E3F3FF}100%{background:#FFFFFF}}');
    expect(LS).toContain('@keyframes flashB{0%{background:#E3F3FF}100%{background:#FFFFFF}}');
  });

  it('시안 그림자: snav.on·사진 inset 1px #E4E6E9, Insert inset 2px #99C2FF, 체크 inset 2px #CFD3D8, livedot 3px 고리, 툴팁·모달·더하기 그림자', () => {
    expect(ls('.ls .snav.on')).toMatch(/box-shadow:inset 0 0 0 1px #E4E6E9/);
    expect(LS).toContain('.ls .ph{background:#FFFFFF;box-shadow:inset 0 0 0 1px #E4E6E9}');
    expect(ls('.ls .ins')).toMatch(/box-shadow:inset 0 0 0 2px #99C2FF/);
    expect(ls('.ls .ins')).toMatch(/border:0/);
    expect(ls('.ls-check-ic')).toMatch(/box-shadow:inset 0 0 0 2px #CFD3D8/);
    expect(ls('.ls .livedot')).toMatch(/box-shadow:0 0 0 3px rgba\(31,157,85,\.18\)/);
    expect(ls('.ls .tipb')).toMatch(/box-shadow:rgba\(0,0,0,0\.25\) 0 8px 24px/);
    expect(ls('.ls .sheet')).toMatch(/box-shadow:rgba\(0,0,0,0\.25\) 0 -12px 40px/);
    expect(ls('.ls .addic')).toMatch(/box-shadow:rgba\(10,27,61,0\.25\) 0 4px 10px/);
  });

  it('L38 .btn·.fld·.ins focus-visible = 흰 고리 + outline #097FF5', () => {
    expect(ls('.ls .btn:focus-visible,.ls .fld:focus-visible,.ls .ins:focus-visible')).toBe(
      'box-shadow:#FFFFFF 0 0 0 2px;outline:2px solid #097FF5;outline-offset:2px',
    );
    expect(ls('.ls :focus-visible')).toMatch(/outline:2px solid #097FF5/);
  });

  it('L93 Add photo: 파일 입력이 있고, 고른 사진은 "Your photo"로 사진 줄에 붙는다 (hover·focus-within·transition 시안 값)', () => {
    const plain = render();
    expect(plain).toMatch(/<label class="addph"><input type="file" accept="image\/\*" aria-label="Add photo"/);
    expect(plain).not.toContain('data-user-photo');
    const withPhoto = render(['blob:local-1']);
    expect(withPhoto).toContain('<div class="ph" data-user-photo=""><img src="blob:local-1" alt="Your photo"/><span class="phl">Your photo</span></div>');
    expect(ls('.ls .addph')).toMatch(/transition:border-color \.15s,background-color \.15s/);
    expect(ls('.ls .addph:hover')).toBe('border-color:#0A1B3D;background:#F6F7F9');
    expect(ls('.ls .addph:focus-within')).toBe('outline:2px solid #097FF5;outline-offset:2px');
    expect(read('src/app/demo/store/new-product/listing-screen.tsx')).toMatch(/URL\.createObjectURL\(file\)/);
  });

  it('L73 왼쪽 메뉴 6개는 선 아이콘 + 글자, "PayPal payments"는 아이콘 없음(로고 예외)', () => {
    const html = render();
    const items = [...html.matchAll(/<button type="button" class="snav( on)?" aria-disabled="true"><svg width="18" height="18"/g)];
    expect(items).toHaveLength(6);
    expect(html).toMatch(/<button type="button" class="snav" aria-disabled="true">PayPal payments<\/button>/);
  });

  it('L183·L184 점검 모달: 회전 고리는 #002991→#60CDFF 그라디언트, 가운데 그래프 아이콘이 pulse 1.2s', () => {
    const reducer = makeReducer('en');
    const sheet = view((s) => reducer(s, { type: 'publish' }));
    const html = renderToStaticMarkup(React.createElement(ListingScreenView, { view: sheet }));
    expect(html).toContain('<linearGradient id="ls-spg"');
    expect(html).toContain('<stop offset="0" class="ls-spg-a"></stop>');
    expect(html).toContain('class="pulse ls-pulse-ic"');
    expect(html).toContain('<svg class="spin" width="96"');
    expect(ls('.ls-spin-arc')).toMatch(/stroke:url\(#ls-spg\)/);
    expect(ls('.ls-spg-a')).toBe('stop-color:#002991');
    expect(ls('.ls-spg-b')).toBe('stop-color:#60CDFF');
    expect(ls('.ls .pulse')).toBe('animation:pl 1.2s ease-in-out infinite');
    expect(ls('.ls-run-t')).toMatch(/font-size:12px/);
    expect(html).toMatch(/class="ls-run-t" data-progress="0\/500"/);
  });

  it('L42 칩 white-space:nowrap, L43 AI 칩 gap 4px, 읽기 전용 입력칸도 흰 바탕(L40)', () => {
    expect(ls('.ls .chip')).toMatch(/white-space:nowrap/);
    expect(ls('.ls .ai')).toMatch(/gap:4px/);
    expect(LS).not.toMatch(/\.fld\[readonly\]/);
  });
});
