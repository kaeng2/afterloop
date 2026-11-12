/**
 * T047 보완: 디자인 기준 검사 (파일을 읽어 검색·계산한다. DOM 도구 없음).
 *
 * 기대값 출처: `tasks/T047.md` "보완" B·C 절과 "완료 기준 (보완)".
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BADGES, BADGE_COPY_KEYS, BADGE_HINT_KEYS, BADGE_ORDER } from '@/app/_shared/badge-keys';
import { copyTables } from '@/app/_shared/copy';
import { toDollarsRounded } from '@/app/_shared/money';
import { SAMPLE_AFTER, SAMPLE_BEFORE, compareSample } from '@/app/preview/styleguide/sample';
import { recommend } from '@/engine/recommend';
import type { Params } from '@/types';

const ROOT = path.resolve(__dirname, '../..');
const APP = path.join(ROOT, 'src/app');
const CSS = readFileSync(path.join(APP, 'globals.css'), 'utf8');

function filesUnder(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, exts));
    else if (exts.some((ext) => name.endsWith(ext))) out.push(full);
  }
  return out;
}

const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** 블록 하나의 `--이름: 값;` 정의. */
function varsIn(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[match[1]] = match[2].trim();
  return out;
}

/** 첫 `:root { … }` (밝은 모드 — T096부터 유일한 모드). */
function themeVars(): { light: Record<string, string> } {
  const css = stripComments(CSS);
  const lightBlock = /^:root\s*\{([\s\S]*?)\n\}/m.exec(css)?.[1] ?? '';
  return { light: varsIn(lightBlock) };
}

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const HEX = /(?<![\w&-])#[0-9a-fA-F]{3,8}(?![\w-])/;
const RGB_FN = /\b(rgba?|hsla?)\s*\(/;

// T107 (사람 결정 2026-11-12 09:25 "시안 CSS 통째 복사 — 토큰으로 옮기지 않는다"): 시안 <style>·인라인 값을 그대로 복사한
// 화면 전용 css는 색·그림자 변수 규칙(T047 B-1·B-3)에서 뺀다. 대신 값이 시안 파일에 있는지는 `app-t107.test.ts`가 본다.
const MOCKUP_COPIES = new Set(['(app)/desk.css']);

describe('T047 보완 B-1: 색은 변수로만', () => {
  it('src/app의 tsx·css에 변수 정의 자리 밖의 색 값이 없다', () => {
    for (const file of filesUnder(APP, ['.tsx', '.css', '.ts'])) {
      if (MOCKUP_COPIES.has(path.relative(APP, file))) continue;
      const text = stripComments(readFileSync(file, 'utf8'));
      for (const [index, line] of text.split('\n').entries()) {
        const isVarDefinition = file.endsWith('.css') && /^\s*--[a-z0-9-]+\s*:/.test(line);
        if (isVarDefinition) continue;
        const where = `${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`;
        expect(HEX.test(line), where).toBe(false);
        expect(RGB_FN.test(line), where).toBe(false);
      }
    }
  });

  it('T089: 강조색은 밝은·어두운 모드 모두 6자리 색이고, 밝은 모드는 시안 v4 #0066F5이며, 흰 글자 대비가 3:1 이상(큰 글자·굵은 버튼 글자)이다', () => {
    const { light } = themeVars();
    for (const accent of [light['--color-accent']]) {
      expect(accent).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(light['--color-accent'].toLowerCase()).toBe('#0066f5');
    expect(contrast(light['--color-accent'], '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(light['--color-accent-deep'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light['--color-navy-ink'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('위험 3색·성공·실패 색은 강조색과 다른 변수이고 값도 다르다', () => {
    const { light } = themeVars();
    for (const vars of [light]) {
      for (const name of ['--color-risk-high', '--color-risk-watch', '--color-risk-low', '--color-success', '--color-danger']) {
        expect(vars[name], name).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(vars[name].toLowerCase(), name).not.toBe(vars['--color-accent'].toLowerCase());
      }
    }
  });

  it('밝은 모드 글자색 대비가 4.5:1 이상이다 (바탕·카드 바탕 위)', () => {
    const { light } = themeVars();
    const textVars = [
      '--color-text',
      '--color-muted',
      '--color-accent',
      '--color-risk-high',
      '--color-risk-watch',
      '--color-risk-low',
      '--color-success',
      '--color-danger',
    ];
    for (const [mode, vars] of Object.entries({ light })) {
      for (const bg of ['--color-bg', '--color-surface']) {
        for (const fg of textVars) {
          const ratio = contrast(vars[fg], vars[bg]);
          expect(ratio, `${mode} ${fg} on ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it('T096: 밝은 모드 고정 — color-scheme: light 가 있고 어두운 모드 분기는 src/app 어디에도 없다', () => {
    expect(stripComments(CSS)).toMatch(/color-scheme:\s*light/);
    expect(stripComments(CSS)).not.toMatch(/color-scheme:\s*dark/);
    for (const file of filesUnder(APP, ['.css', '.tsx', '.ts'])) {
      expect(stripComments(readFileSync(file, 'utf8')), path.relative(ROOT, file)).not.toMatch(/prefers-color-scheme:\s*dark/);
    }
    const { light } = themeVars();
    expect(Object.keys(light).filter((name) => name.startsWith('--color-')).length).toBeGreaterThanOrEqual(11);
  });
});

describe('T047 보완 B-2: 글꼴과 글자 크기', () => {
  // T067 (사람 결정 2026-11-10): "외부 글꼴 금지" → Figtree + Noto Sans KR을 `next/font/google`로 (빌드 때 받아 자체 제공).
  // `next/font/google`은 layout.tsx 한 곳에서 이 두 글꼴만. 브라우저가 Google에 직접 요청하는 길(@import url, fonts.googleapis)은 여전히 금지.
  it('글꼴 이름에 PayPal이 없고, 글꼴은 layout.tsx의 next/font/google Figtree·Noto Sans KR뿐이다 (@import url 없음)', () => {
    expect(/paypal/i.test(themeVars().light['--font-sans'])).toBe(false);
    for (const file of filesUnder(APP, ['.tsx', '.ts', '.css'])) {
      const text = readFileSync(file, 'utf8');
      if (path.relative(APP, file) !== 'layout.tsx') expect(/next\/font\/google/.test(text), file).toBe(false);
      expect(/@import\s+url|fonts\.googleapis/.test(text), file).toBe(false);
      expect(/font-family\s*:[^;]*paypal/i.test(text), file).toBe(false);
    }
    const layout = readFileSync(path.join(APP, 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/import\s*\{\s*Figtree,\s*Noto_Sans_KR\s*\}\s*from\s*'next\/font\/google'/);
    expect(layout).toMatch(/variable:\s*'--font-figtree'/);
    expect(layout).toMatch(/variable:\s*'--font-noto-kr'/);
    const { light } = themeVars();
    expect(light['--font-sans']).toMatch(/^var\(--font-figtree\),\s*var\(--font-noto-kr\)/);
    expect(light['--font-ko']).toMatch(/^var\(--font-noto-kr\)/);
    expect(stripComments(CSS)).toMatch(/:lang\(ko\)\s*\{[^}]*font-family:\s*var\(--font-ko\)/);
  });

  it('글자 크기 단계는 변수 5개이고, 다른 규칙은 font-size에 변수만 쓴다', () => {
    const steps = Object.keys(themeVars().light).filter((name) => name.startsWith('--text-'));
    expect(steps).toHaveLength(5);
    for (const match of stripComments(CSS).matchAll(/font-size\s*:\s*([^;]+);/g)) {
      expect(match[1], match[0]).toMatch(/^(var\(--text-[a-z]+\)|[0-9.]+em)$/);
    }
  });

  it('숫자 폭이 일정한 공용 클래스(.num)와 주인공 숫자 클래스(.hero-number)가 있다', () => {
    expect(CSS).toMatch(/\.num\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
    expect(CSS).toMatch(/\.hero-number\s*\{[^}]*font-size:\s*var\(--text-hero\)/);
  });
});

describe('T047 보완 B-3: 카드 규칙 하나', () => {
  // T067 (사람 결정 2026-11-10): 카드 1px·8px → 시안 값 2px #E4E6E9 · 모서리 16~24px. 그림자 금지 → `--shadow-selected` 하나만.
  it('카드 테두리·모서리·여백·간격이 변수 하나씩이고, 테두리 2px #E4E6E9 · 모서리 16~24px · 알약은 완전히 둥글다', () => {
    const vars = themeVars().light;
    for (const name of ['--card-padding', '--card-radius', '--card-border', '--card-gap']) expect(vars[name], name).toBeDefined();
    expect(CSS).toMatch(/\.card\s*\{[^}]*padding:\s*var\(--card-padding\)[^}]*border:\s*var\(--card-border\)[^}]*border-radius:\s*var\(--card-radius\)/);
    expect(vars['--card-border']).toBe('2px solid var(--color-border)');
    expect(vars['--color-border'].toLowerCase()).toBe('#e4e6e9');
    const radius = Number(/^(\d+)px$/.exec(vars['--card-radius'])?.[1]);
    expect(radius).toBeGreaterThanOrEqual(16);
    expect(radius).toBeLessThanOrEqual(24);
    expect(vars['--radius-pill']).toBe('999px');
  });

  // T098b (사람 결정 2026-11-11 22:55 "기준은 시안 파일 자체"): "그림자 하나만"(T067) → 시안 그림자 목록 그대로.
  // 그림자는 여전히 `--shadow-*` 변수로만 쓰고, 변수 값은 시안 파일에 있는 box-shadow 값이어야 한다 (지어낸 그림자 없음).
  it('그림자는 `--shadow-*` 변수로만 쓰고, 변수 값은 모두 시안 파일(Desk·v3)의 box-shadow 값이다', () => {
    const { light } = themeVars();
    expect(light['--shadow-selected']).toBe('rgba(0, 0, 0, 0.14) 4px 4px 28px 6px');
    const norm = (value: string) =>
      value
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ',')
        .replace(/\b0\.(\d)0\b/g, '0.$1')
        .replace(/(^|[ ,(])\.(\d)/g, '$10.$2')
        .trim();
    const desk = readFileSync(path.join(ROOT, 'docs/design/mockup-v4/Desk.dc.html'), 'utf8');
    const mockupShadows = new Set(
      [...desk.matchAll(/box-shadow\s*:\s*([^;}"]+)/g)].map((match) => norm(match[1])).filter((value) => value !== 'none'),
    );
    mockupShadows.add(norm('rgba(0, 0, 0, 0.14) 4px 4px 28px 6px')); // 시안 v3 (/listing 카드, T067)
    const shadowVars = Object.entries(light).filter(([name]) => name.startsWith('--shadow-'));
    expect(shadowVars.length).toBeGreaterThanOrEqual(2);
    for (const [name, value] of shadowVars) expect(mockupShadows.has(norm(value)), `${name}: ${value}`).toBe(true);
    for (const file of filesUnder(APP, ['.css'])) {
      // T098a (DECISIONS 11/11 22:55 "기준은 시안 파일 자체 — 그림자 포함"): /intro·/listing은 시안 그림자를
      // 그 화면 css의 `--i-shadow-*`/`--ls-shadow-*` 변수로만 쓴다 (값은 아래 "T098a 시안 그림자" 시험이 본다).
      const rel = path.relative(APP, file);
      if (MOCKUP_COPIES.has(rel)) continue;
      const scene =rel.startsWith('intro/') ? 'i' : rel.startsWith('listing/') ? 'ls' : null;
      for (const match of stripComments(readFileSync(file, 'utf8')).matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
        const value = match[1].trim();
        const where = `${path.relative(ROOT, file)}: ${match[0]}`;
        const own = scene === null ? '' : `|var\\(--${scene}-shadow-[a-z-]+\\)|none`;
        expect(value, where).toMatch(new RegExp(`^(var\\(--shadow-[a-z-]+\\)${own})$`));
        if (value.startsWith('var(--shadow-')) expect(value.slice(4, -1) in light, where).toBe(true);
      }
    }
    for (const file of filesUnder(APP, ['.tsx'])) {
      expect(/boxShadow/.test(readFileSync(file, 'utf8')), path.relative(ROOT, file)).toBe(false);
    }
  });

  it('T098b: 시안 그림자 자리마다 그 그림자를 쓴다 (outline·테두리로 바꿔 그리지 않는다)', () => {
    const css = (rel: string) => stripComments(readFileSync(path.join(APP, rel), 'utf8'));
    const rule = (text: string, selector: string) => {
      const at = text.indexOf(`${selector} {`);
      expect(at, selector).toBeGreaterThanOrEqual(0);
      return text.slice(at, text.indexOf('}', at));
    };
    const reply = css('cases/reply/reply.css');
    const kase = css('cases/view/case.css');
    const today = css('today/today.css');
    expect(rule(reply, '.reply-editor:focus-within')).toContain('var(--shadow-editor-focus)');
    expect(rule(reply, '.reply-editor:focus-within')).not.toContain('outline');
    expect(rule(reply, '.reply-lint-button-ghost')).toContain('var(--shadow-ghost)');
    expect(rule(reply, '.reply-lint-button-ghost')).not.toContain('border:');
    expect(rule(reply, '.reply-chip-good')).toContain('var(--shadow-hairline)');
    expect(rule(kase, '.case-bubble')).toContain('var(--shadow-bubble)');
    expect(rule(kase, '.work')).toContain('var(--shadow-work)');
    expect(rule(today, ".today-item[aria-current='true']")).toContain('var(--shadow-row-on)');
    expect(rule(today, '.savings-toast')).toContain('var(--shadow-toast)');
    expect(rule(css('cases/progress/case-progress.css'), '.cprog-toast')).toContain('var(--shadow-toast)');
    const { light } = themeVars();
    expect(light['--shadow-editor-focus']).toBe('#ffffff 0 0 0 2px, #097ff5 0 0 0 4px');
    expect(light['--color-focus']).toBe('#097ff5');
  });

  it('T098a 시안 그림자: /intro·/listing 그림자 변수 값은 시안 Scene1·Main 파일에 있는 값 그대로다', () => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/(^|[^\d])0\./g, '$1.');
    const cases: [string, string, string][] = [
      ['src/app/intro/intro.css', 'docs/design/mockup-v4/scene1/Scene1.dc.html', '--i-shadow-'],
      ['src/app/listing/listing.css', 'docs/design/mockup-v4/scene3/Main.dc.html', '--ls-shadow-'],
    ];
    for (const [cssFile, mockFile, prefix] of cases) {
      const css = stripComments(readFileSync(path.join(ROOT, cssFile), 'utf8'));
      const mock = norm(readFileSync(path.join(ROOT, mockFile), 'utf8'));
      const defs = Object.entries(varsIn(css)).filter(([name]) => name.startsWith(prefix));
      expect(defs.length, cssFile).toBeGreaterThan(0);
      for (const [name, value] of defs) expect(mock.includes(norm(value)), `${cssFile} ${name}: ${value}`).toBe(true);
      // 쓰는 변수는 모두 정의돼 있다
      for (const m of css.matchAll(new RegExp(`box-shadow\\s*:\\s*var\\((${prefix}[a-z-]+)\\)`, 'g'))) {
        expect(defs.map(([n]) => n), `${cssFile} ${m[1]}`).toContain(m[1]);
      }
    }
  });
});

describe('T047 보완 B-4·B-5: 배지 5종과 위험 3종', () => {
  it('배지·위험 문구 키 8개가 두 문구 파일에 있다 (+ 배지 설명 5개)', () => {
    expect(BADGE_COPY_KEYS).toHaveLength(8);
    expect(BADGE_COPY_KEYS).toContain('badge.cached');
    for (const key of [...BADGE_COPY_KEYS, ...BADGE_HINT_KEYS]) {
      expect(typeof copyTables.en[key], key).toBe('string');
      expect(typeof copyTables.ko[key], key).toBe('string');
    }
  });

  it('배지 5종의 테두리 꼴과 앞머리 기호가 서로 다르다 (흑백에서도 구분)', () => {
    expect(BADGE_ORDER).toHaveLength(5);
    const borders = BADGE_ORDER.map((kind) => BADGES[kind].border);
    const glyphs = BADGE_ORDER.map((kind) => BADGES[kind].glyph);
    expect(new Set(borders).size).toBe(5);
    expect(new Set(glyphs).size).toBe(5);
    for (const border of borders) expect(CSS, border).toMatch(new RegExp(`\\.badge-border-${border}\\s*\\{`));
  });

  it('배지는 채도 높은 색 면을 쓰지 않는다 (배지 규칙에 강조·위험 색이 없다)', () => {
    const badgeRules = [...stripComments(CSS).matchAll(/\.badge[a-z-]*\s*\{[^}]*\}/g)].map((m) => m[0]).join('\n');
    expect(badgeRules).not.toMatch(/--color-(accent|risk|success|danger)/);
    expect(badgeRules).toMatch(/font-size:\s*var\(--text-xs\)/); // 본문보다 작다
  });
});

describe('T047 보완 C: 비교 카드 견본은 엔진 값이다', () => {
  it('두 값이 `recommend(...).best.expectedLossCents`와 같고 표시는 `toDollarsRounded`다', () => {
    const view = compareSample();
    const before = recommend(SAMPLE_BEFORE).best;
    const after = recommend(SAMPLE_AFTER).best;
    expect(view.before.expectedLossCents).toBe(before?.expectedLossCents);
    expect(view.after.expectedLossCents).toBe(after?.expectedLossCents);
    expect(view.before.display).toBe(toDollarsRounded(before?.expectedLossCents as number));
    expect(view.after.display).toBe(toDollarsRounded(after?.expectedLossCents as number));
    // 지금의 가정값으로는 서연 장면과 같다 (SPEC 2장: 환불 → 답장, 7400¢ → 3680¢)
    expect(view.before.move).toBe('refund');
    expect(view.after.move).toBe('fight');
  });

  it('가정값을 바꾸면 견본 값도 따라 바뀐다 (숫자를 적어 두지 않았다)', async () => {
    const { paramsFromConfig } = await import('@/engine/params');
    const params = paramsFromConfig();
    const changed: Params = { ...params, feeCents: params.feeCents - 700 };
    const view = compareSample(changed);
    expect(view.after.expectedLossCents).toBe(recommend(SAMPLE_AFTER, changed).best?.expectedLossCents);
    expect(view.after.expectedLossCents).not.toBe(compareSample().after.expectedLossCents);
  });

  it('화면 코드에 74·37·7400·3680이 없다', () => {
    const screenFiles = [
      ...filesUnder(APP, ['.tsx']),
      ...filesUnder(path.join(APP, 'preview'), ['.ts']),
    ];
    for (const file of screenFiles) {
      const text = stripComments(readFileSync(file, 'utf8'));
      expect(/(?<![\w.#-])(74|37|7400|3680)(?![\w.])/.test(text), path.relative(ROOT, file)).toBe(false);
    }
  });
});

describe('T047 보완 A: 가로 넘침과 메뉴', () => {
  it('본문 컨테이너는 고정 폭이 없고 max-width + min-width: 0 이다', () => {
    const main = /\.main\s*\{([^}]*)\}/.exec(stripComments(CSS))?.[1] ?? '';
    expect(main).toMatch(/max-width:\s*var\(--content-max\)/);
    expect(main).toMatch(/min-width:\s*0/);
    expect(main).not.toMatch(/(^|[^-])width:\s*\d+(px|rem)/);
  });

  it('css 어디에도 360px보다 넓은 고정 폭이 없고 100vw를 쓰지 않는다', () => {
    const css = stripComments(CSS);
    expect(css).not.toMatch(/100vw/);
    for (const match of css.matchAll(/(?<![-\w])(min-)?width\s*:\s*([0-9.]+)(px|rem)/g)) {
      const px = Number(match[2]) * (match[3] === 'rem' ? 16 : 1);
      expect(px, match[0]).toBeLessThanOrEqual(360);
    }
  });

  it('메뉴는 줄바꿈 없이 가로로 넘겨 볼 수 있다', () => {
    const nav = /\.nav\s*\{([^}]*)\}/.exec(stripComments(CSS))?.[1] ?? '';
    expect(nav).toMatch(/overflow-x:\s*auto/);
    expect(nav).toMatch(/min-width:\s*0/);
  });

  it('첫 화면 본문에 메뉴 목록을 다시 늘어놓지 않는다', () => {
    const page = readFileSync(path.join(APP, '(app)/page.tsx'), 'utf8');
    expect(page).not.toMatch(/NAV_ITEMS/);
    expect(page).not.toMatch(/<ul/);
  });
});
