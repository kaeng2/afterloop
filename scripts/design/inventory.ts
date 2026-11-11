/**
 * T097: 시안 파일에서 색·모션·상호작용·접힘·조건부 스타일 목록을 자동 추출해
 * reports/design-match/inventory.md 를 만든다. 시안은 읽기만 한다.
 *
 * 실행: npx tsx scripts/design/inventory.ts
 *
 * 규칙
 *  - 목록은 손으로 고르지 않는다. 정규식·괄호 짝 맞추기로만 뽑는다.
 *  - 같은 시안이면 같은 출력 (행은 키 순 정렬). 바뀐 것이 없으면 파일을 다시 쓰지 않는다.
 *  - 다시 돌려도 사람이 채운 "상태"·"근거" 칸은 유지한다 (행 키 = 파일 + 표 번호 + 값).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- 타입

export interface Row {
  key: string; // 값 (행 키의 일부)
  count: number;
  first: string; // 첫 자리 (L줄 요소/클래스/속성)
  note: string; // 내용 (keyframes 본문, 결과 상태 등)
}

export type Tables = Record<TableId, Row[]>;
export type TableId = 1 | 2 | 3 | 4 | 5;

export const TABLE_TITLES: Record<TableId, string> = {
  1: '색 토큰',
  2: '모션·타이밍 (hover·focus 포함)',
  3: '누를 수 있는 것과 결과 상태',
  4: '접힘·펼침',
  5: '조건부 스타일',
};

export interface MockupInput {
  /** 저장소 기준 상대 경로 */
  file: string;
  text: string;
}

export interface Filled {
  status: string;
  basis: string;
}

// ---------------------------------------------------------------- 텍스트 도구

function lineStarts(text: string): number[] {
  const s = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') s.push(i + 1);
  return s;
}

function lineOf(starts: number[], idx: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= idx) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const cap = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/** open 위치의 ( [ { 와 짝이 맞는 닫는 괄호 위치. 문자열 안은 건너뛴다. 못 찾으면 -1. */
export function matchClose(text: string, open: number, limit = 8000): number {
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const stack: string[] = [];
  const end = Math.min(text.length, open + limit);
  for (let i = open; i < end; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {
      i = skipString(text, i, end);
      if (i < 0) return -1;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

function skipString(text: string, start: number, end: number): number {
  const q = text[start];
  for (let i = start + 1; i < end; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === q) return i;
    else if (q !== '`' && text[i] === '\n') return i; // 닫히지 않은 따옴표(영어 아포스트로피 등)는 줄 끝에서 끊는다
  }
  return end - 1;
}

/** 최상위 쉼표로 나눈다 (괄호·문자열 안은 건너뜀). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"' || c === '`') {
      i = skipString(s, i, s.length);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      out.push(s.slice(last, i));
      last = i + 1;
    }
  }
  out.push(s.slice(last));
  return out;
}

/** 줄 안 위치의 요소·클래스·속성 이름 (첫 자리 표시용). */
function contextAt(text: string, idx: number): string {
  const ls = text.lastIndexOf('\n', idx - 1) + 1;
  const before = text.slice(ls, idx);
  // 1) CSS 규칙 안
  const ob = before.lastIndexOf('{');
  const cb = before.lastIndexOf('}');
  if (ob > cb) {
    const sel = before.slice(cb + 1, ob).trim();
    if (
      sel &&
      /^[@.#*\w:[]/.test(sel) &&
      !/[=;'"(){}]/.test(sel.replace(/\([^)]*\)/g, '')) &&
      !/^(const|let|var|return|if|else|for|function|style)\b/.test(sel)
    ) {
      return cap(squash(sel), 60);
    }
  }
  // 2) 여는 태그 안
  const lt = before.lastIndexOf('<');
  if (lt >= 0 && before.indexOf('>', lt) === -1) {
    const m = /^<([A-Za-z][\w-]*)/.exec(before.slice(lt));
    if (m) {
      const gt = text.indexOf('>', idx);
      const tagText = text.slice(ls + lt, gt < 0 ? idx : gt);
      const cls = /class="([^"]*)"/.exec(tagText);
      const first = cls ? cls[1].trim().split(/\s+/)[0] : '';
      return first ? `${m[1]}.${first}` : `<${m[1]}>`;
    }
  }
  // 3) 속성·키
  let key = '';
  for (const k of before.matchAll(/([A-Za-z_$][\w$-]*)\s*[:=]/g)) key = k[1];
  return key ? `~${key}` : '~';
}

function place(text: string, starts: number[], idx: number): string {
  return `L${lineOf(starts, idx)} ${contextAt(text, idx)}`;
}

function lineText(text: string, starts: number[], idx: number): string {
  const n = lineOf(starts, idx);
  const end = n < starts.length ? starts[n] - 1 : text.length;
  return squash(text.slice(starts[n - 1], end));
}

function placeLine(starts: number[], idx: number): string {
  return `L${lineOf(starts, idx)}`;
}

class Bag {
  private m = new Map<string, Row>();
  add(key: string, first: string, note = '') {
    const k = squash(key);
    const r = this.m.get(k);
    if (r) r.count++;
    else this.m.set(k, { key: k, count: 1, first, note });
  }
  rows(): Row[] {
    return [...this.m.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }
}

// ---------------------------------------------------------------- 1. 색 토큰

const GRADIENT_RE = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/g;
const RGBA_RE = /rgba?\([^()]*\)/g;
const HEX_RE = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w])/g;

function extractColors(text: string, starts: number[]): Row[] {
  const bag = new Bag();
  for (const m of text.matchAll(GRADIENT_RE)) {
    const open = (m.index as number) + m[0].length - 1;
    const close = matchClose(text, open, 600);
    if (close < 0) continue;
    bag.add(squash(text.slice(m.index as number, close + 1)).replace(/\s*([,()])\s*/g, '$1'), place(text, starts, m.index as number));
  }
  for (const m of text.matchAll(RGBA_RE)) {
    bag.add(m[0].replace(/\s+/g, '').toLowerCase(), place(text, starts, m.index as number));
  }
  for (const m of text.matchAll(HEX_RE)) {
    const before = text.slice(Math.max(0, (m.index as number) - 6), m.index as number);
    if (/href="$/.test(before)) continue; // 앵커 링크
    if (/^#\d{4}$/.test(m[0])) continue; // 주문 번호(#1029 등)
    bag.add(m[0].toUpperCase(), place(text, starts, m.index as number));
  }
  return bag.rows();
}

// ---------------------------------------------------------------- 2. 모션·타이밍

function extractMotion(text: string, starts: number[]): Row[] {
  const bag = new Bag();

  for (const m of text.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    const open = (m.index as number) + m[0].length - 1;
    const close = matchClose(text, open, 2000);
    const body = close < 0 ? '' : squash(text.slice(open + 1, close));
    bag.add(`@keyframes ${m[1]}`, placeLine(starts, m.index as number), cap(body, 240));
  }

  const decl =
    /(?<![\w-])(animation(?:-delay|-duration|-name|-iteration-count|-fill-mode|-timing-function)?|transition(?:-delay|-duration|-property|-timing-function)?)\s*:\s*([^;"}]*)/g;
  for (const m of text.matchAll(decl)) {
    const v = squash(m[2]);
    if (!v) continue;
    bag.add(`${m[1]}: ${cap(v, 100)}`, place(text, starts, m.index as number));
  }

  // :hover / :focus 규칙
  const pseudo = /([^{}]*?:(?:hover|focus-visible|focus-within|focus|active)[^{}]*)\{([^{}]*)\}/g;
  for (const m of text.matchAll(pseudo)) {
    const sel = squash(m[1]);
    if (!sel || /['"]/.test(sel)) continue;
    const idx = (m.index as number) + m[0].indexOf(m[1].trim());
    bag.add(`${sel}`, placeLine(starts, idx), cap(squash(m[2]), 200));
  }

  // setTimeout / setInterval / this.later(fn, ms)
  for (const m of text.matchAll(/(?<![\w$])(setTimeout|setInterval|(?:this\.)?later)\s*\(/g)) {
    const open = (m.index as number) + m[0].length - 1;
    const close = matchClose(text, open, 4000);
    if (close < 0) continue;
    const args = splitTop(text.slice(open + 1, close));
    if (args.length < 2) continue;
    const ms = squash(args[args.length - 1]);
    const fn = m[1].replace(/^this\./, '');
    // 정의(`later(fn, ms) {`)는 건너뛴다: 마지막 인자가 식별자 `ms`뿐인 경우
    if (/^[A-Za-z_$][\w$]*$/.test(ms) && /\)\s*\{/.test(text.slice(close, close + 6))) continue;
    bag.add(`${fn} ${cap(ms, 60)}`, place(text, starts, m.index as number), cap(lineText(text, starts, m.index as number), 160));
  }
  return bag.rows();
}

// ---------------------------------------------------------------- 3. 누를 수 있는 것과 결과 상태

const SKIP_CALLS = new Set(['setState', 'later', 'toast', 'bind']);

function bodiesOf(text: string, name: string): string[] {
  const esc = name.replace(/[$]/g, '\\$');
  const out: string[] = [];
  const arrow = new RegExp(`(?<![\\w$.])${esc}\\s*[:=]\\s*(?:async\\s*)?(?:\\([^)]*\\)|[\\w$]+)\\s*=>`, 'g');
  for (const m of text.matchAll(arrow)) out.push(bodyFrom(text, (m.index as number) + m[0].length));
  const method = new RegExp(`(?<![\\w$.])${esc}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  for (const m of text.matchAll(method)) {
    const open = (m.index as number) + m[0].length - 1;
    const close = matchClose(text, open);
    if (close > 0) out.push(text.slice(open, close + 1));
  }
  return out;
}

function bodyFrom(text: string, from: number): string {
  let i = from;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] === '{') {
    const close = matchClose(text, i);
    return close > 0 ? text.slice(i, close + 1) : text.slice(i, i + 600);
  }
  // 식 본문: 최상위 쉼표·세미콜론·짝 없는 닫는 괄호에서 끝
  let depth = 0;
  const end = Math.min(text.length, i + 2000);
  let j = i;
  for (; j < end; j++) {
    const c = text[j];
    if (c === "'" || c === '"' || c === '`') {
      j = skipString(text, j, end);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break;
      depth--;
    } else if ((c === ',' || c === ';') && depth === 0) break;
  }
  return text.slice(i, j);
}

function stateEffects(text: string, body: string, seen: Set<string>, depth = 0): { keys: Set<string>; calls: Set<string> } {
  const keys = new Set<string>();
  const calls = new Set<string>();
  for (const m of body.matchAll(/setState\s*\(/g)) {
    const open = (m.index as number) + m[0].length - 1;
    const close = matchClose(body, open);
    if (close < 0) continue;
    const arg = body.slice(open + 1, close).trim();
    if (arg.startsWith('{')) {
      const objClose = matchClose(arg, 0);
      const inner = objClose > 0 ? arg.slice(1, objClose) : arg.slice(1);
      for (const part of splitTop(inner)) {
        const km = /^\s*([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(part);
        if (km) keys.add(km[1]);
      }
    } else if (arg) keys.add('(함수형 setState)');
  }
  for (const m of body.matchAll(/this\.([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (SKIP_CALLS.has(name)) continue;
    calls.add(name);
    if (depth < 2 && !seen.has(name)) {
      seen.add(name);
      for (const b of bodiesOf(text, name)) {
        const sub = stateEffects(text, b, seen, depth + 1);
        sub.keys.forEach((k) => keys.add(k));
      }
    }
  }
  return { keys, calls };
}

function extractClickables(text: string, starts: number[]): Row[] {
  const bag = new Bag();
  const attr = /\b(on(?:Click|Change|Input|KeyDown|KeyUp|Submit|Focus|Blur|MouseDown|MouseEnter|PointerDown))\s*=\s*"([^"]*)"/g;
  const resolved = new Map<string, string>();
  for (const m of text.matchAll(attr)) {
    const expr = squash((/\{\{\s*([\s\S]*?)\s*\}\}/.exec(m[2]) ?? [, m[2]])[1] as string);
    const key = `${m[1]} ${expr}`;
    if (!resolved.has(key)) {
      const simple = /^[\w$.]+$/.test(expr);
      let note = '(식 직접)';
      if (simple) {
        const name = expr.split('.').pop() as string;
        const bodies = bodiesOf(text, name);
        if (!bodies.length) note = '(정의 못 찾음)';
        else {
          const keys = new Set<string>();
          const calls = new Set<string>();
          for (const b of bodies) {
            const e = stateEffects(text, b, new Set([name]));
            e.keys.forEach((k) => keys.add(k));
            e.calls.forEach((c) => calls.add(c));
          }
          const k = [...keys].sort().join(', ');
          const c = [...calls].sort().join(', ');
          note = `setState: ${k || '(없음)'}${c ? ` · 호출: ${c}` : ''}`;
        }
      }
      resolved.set(key, note);
    }
    bag.add(key, place(text, starts, m.index as number), resolved.get(key) as string);
  }
  return bag.rows();
}

// ---------------------------------------------------------------- 4. 접힘·펼침

function extractFolds(text: string, starts: number[]): Row[] {
  const bag = new Bag();
  for (const m of text.matchAll(/<sc-if\s+value\s*=\s*"\{\{\s*([\s\S]*?)\s*\}\}"/g)) {
    bag.add(`sc-if ${squash(m[1])}`, `${placeLine(starts, m.index as number)} <sc-if>`);
  }
  for (const m of text.matchAll(/aria-expanded\s*=\s*"([^"]*)"/g)) {
    bag.add(`aria-expanded ${squash(m[1])}`, place(text, starts, m.index as number));
  }
  for (const m of text.matchAll(/<(details|summary)\b/g)) {
    bag.add(`<${m[1]}>`, place(text, starts, m.index as number));
  }
  for (const m of text.matchAll(/(?<![\w$])([a-z][\w$]*Open)(?![\w$])/g)) {
    bag.add(`state ${m[1]}`, place(text, starts, m.index as number));
  }
  // more / less
  for (const m of text.matchAll(/(?<![\w$'"])((?:[a-z][\w$]*)?(?:[Mm]ore|[Ll]ess)[\w$]*)\s*:/g)) {
    bag.add(`more/less ${m[1]}`, place(text, starts, m.index as number));
  }
  for (const m of text.matchAll(/\.([\w-]*(?:more|less)[\w-]*)(?=[\s{.:,>[])/gi)) {
    bag.add(`more/less .${m[1]}`, place(text, starts, m.index as number));
  }
  for (const m of text.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (/(?:more|less)/i.test(c) && !c.includes('{{')) bag.add(`more/less .${c}`, place(text, starts, m.index as number));
  }
  for (const m of text.matchAll(/rotate\([^)]*\)/g)) {
    bag.add(m[0].replace(/\s+/g, ''), place(text, starts, m.index as number));
  }
  return bag.rows();
}

// ---------------------------------------------------------------- 5. 조건부 스타일

const COLOR_ANY = /#[0-9a-fA-F]{3,8}\b|rgba?\(|gradient\(/;
const STYLE_WORD = /(?:color|background|border|opacity|transform|font-|display|shadow|width|height|visibility|text-decoration)/i;
const CLASS_TOGGLE = /'\s[\w-]+'|"\s[\w-]+"/;

function ternaryAt(text: string, q: number): string | null {
  // 앞쪽 경계
  let depth = 0;
  let s = q - 1;
  for (; s >= 0 && q - s < 300; s--) {
    const c = text[s];
    if (c === '\n') break;
    if (c === "'" || c === '"' || c === '`') {
      const j = text.lastIndexOf(c, s - 1);
      if (j < 0 || s - j > 300) return null;
      s = j;
      continue;
    }
    if (c === ')' || c === ']' || c === '}') depth++;
    else if (c === '(' || c === '[' || c === '{') {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && (c === ',' || c === ';')) break;
    else if (depth === 0 && c === '=' && text[s - 1] !== '=' && text[s - 1] !== '!' && text[s - 1] !== '<' && text[s - 1] !== '>' && text[s + 1] !== '=') break;
    else if (depth === 0 && c === '>' && text[s - 1] === '=') break; // =>
  }
  // 뒤쪽 경계
  depth = 0;
  let e = q + 1;
  for (; e < text.length && e - q < 400; e++) {
    const c = text[e];
    if (c === '\n') break;
    if (c === "'" || c === '"' || c === '`') {
      e = skipString(text, e, text.length);
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && (c === ',' || c === ';')) break;
  }
  const snippet = squash(text.slice(s + 1, e));
  return snippet.includes(':') ? snippet : null;
}

function extractConditional(text: string, starts: number[]): Row[] {
  const bag = new Bag();
  for (const m of text.matchAll(/(?<![?.])\?(?![?.])/g)) {
    const q = m.index as number;
    const snip = ternaryAt(text, q);
    if (!snip) continue;
    // 삼항식 모양: ? 뒤에 : 가 있어야 하고, 색·스타일·클래스 토글이어야 한다
    if (!(COLOR_ANY.test(snip) || STYLE_WORD.test(snip) || CLASS_TOGGLE.test(snip))) continue;
    if (/^[\w\s]*\?$/.test(snip)) continue;
    // 색 값 없이 style 단어만 문장 안에 나온 경우(문구)는 따옴표 밖에 `?`가 없다 → 위에서 걸러진다
    bag.add(cap(snip, 220), place(text, starts, q));
  }
  // 색·톤을 고르는 함수 (riskCol 등)
  const fn = /(?<![\w$.])([A-Za-z_$][\w$]*(?:Col|Color|Colour|Tone|Tint|Bg))\s*[:=]\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>/g;
  for (const m of text.matchAll(fn)) {
    bag.add(`fn ${m[1]}: ${cap(squash(bodyFrom(text, (m.index as number) + m[0].length)), 200)}`, place(text, starts, m.index as number));
  }
  return bag.rows();
}

// ---------------------------------------------------------------- 조립

export function extractTables(text: string): Tables {
  const starts = lineStarts(text);
  return {
    1: extractColors(text, starts),
    2: extractMotion(text, starts),
    3: extractClickables(text, starts),
    4: extractFolds(text, starts),
    5: extractConditional(text, starts),
  };
}

// ---------------------------------------------------------------- 마크다운 (출력·병합)

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
/** 키 정규화: 출력과 파싱이 같은 값을 얻도록 백틱·공백을 맞춘다 */
const normKey = (s: string) => squash(s.replace(/`/g, "'"));
const rowKey = (file: string, table: number, value: string) => `${file}\u0000${table}\u0000${normKey(value)}`;

const FILE_ORDER_NOTE = '파일 순서·행 정렬은 고정이다 (같은 시안 → 같은 출력).';

export function sha12(buf: string | Buffer): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 12);
}

export interface RenderOptions {
  timestamp: string;
  inputs: MockupInput[];
  tables: Tables[];
  filled: Map<string, Filled>;
  /** 새 목록에 없는데 채워져 있던 행 */
  orphans?: { key: string; file: string; table: number; value: string; f: Filled }[];
}

export function render(o: RenderOptions): string {
  const totals = o.tables.map((t) => ([1, 2, 3, 4, 5] as TableId[]).reduce((n, id) => n + t[id].length, 0));
  const lines: string[] = [];
  lines.push('# 시안 인벤토리 (T097, 자동 생성)');
  lines.push('');
  lines.push(`- 만든 시각: ${o.timestamp} KST`);
  lines.push('- 만든 방법: `npx tsx scripts/design/inventory.ts` (손으로 고른 목록이 아님. 다시 돌려도 채운 칸은 유지)');
  lines.push('- 시안 파일 해시 (sha256 앞 12자)와 행 수:');
  o.inputs.forEach((f, i) => {
    const per = ([1, 2, 3, 4, 5] as TableId[]).map((id) => o.tables[i][id].length).join('/');
    lines.push(`  - \`${f.file}\` — \`${sha12(f.text)}\` — 행 ${totals[i]} (표 1~5: ${per})`);
  });
  lines.push(`- 행 수 합계: ${totals.reduce((a, b) => a + b, 0)}`);
  lines.push('- 칸 설명: **상태** = `구현함` / `예외`. **근거** = 구현 파일·시험, 또는 예외 이유(DECISIONS 11/11 22:55 예외 목록 중 무엇인지). 빈칸이 없어야 끝.');
  lines.push(`- ${FILE_ORDER_NOTE}`);
  lines.push('- 색 토큰의 그라디언트는 안쪽 색도 따로 센다. 모션 표에는 hover·focus 규칙과 `setTimeout`·`setInterval`·`this.later(fn, ms)`가 같이 있다.');
  lines.push('');

  o.inputs.forEach((f, i) => {
    lines.push(`## ${f.file}`);
    lines.push('');
    ([1, 2, 3, 4, 5] as TableId[]).forEach((id) => {
      const rows = o.tables[i][id];
      lines.push(`### ${id}. ${TABLE_TITLES[id]} (${rows.length}행)`);
      lines.push('');
      if (!rows.length) {
        lines.push('_(없음)_');
        lines.push('');
        return;
      }
      lines.push('| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |');
      lines.push('|---|---|---|---|---|---|');
      for (const r of rows) {
        const fl = o.filled.get(rowKey(f.file, id, r.key));
        lines.push(`| \`${esc(normKey(r.key))}\` | ${r.count} | ${esc(r.first)} | ${esc(r.note)} | ${esc(fl?.status ?? '')} | ${esc(fl?.basis ?? '')} |`);
      }
      lines.push('');
    });
  });

  if (o.orphans && o.orphans.length) {
    lines.push('## 사라진 행 (채운 값이 있었으나 시안에서 더는 안 나옴)');
    lines.push('');
    lines.push('| 파일 | 표 | 값 | 상태 | 근거 |');
    lines.push('|---|---|---|---|---|');
    for (const x of o.orphans) lines.push(`| ${esc(x.file)} | ${x.table} | \`${esc(x.value)}\` | ${esc(x.f.status)} | ${esc(x.f.basis)} |`);
    lines.push('');
  }
  return lines.join('\n');
}

function splitCells(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && i + 1 < line.length) {
      cur += line[i + 1];
      i++;
    } else if (c === '|') {
      cells.push(cur);
      cur = '';
    } else cur += c;
  }
  cells.push(cur);
  // 앞뒤 파이프로 생긴 빈 셀 제거
  return cells.slice(1, -1).map((s) => s.trim());
}

/** 이전 inventory.md 에서 채운 상태·근거를 읽는다. */
export function parseFilled(md: string): Map<string, Filled> {
  const out = new Map<string, Filled>();
  let file = '';
  let table = 0;
  let orphan = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('## ')) {
      orphan = line.startsWith('## 사라진 행');
      file = orphan ? '' : line.slice(3).trim();
      table = 0;
      continue;
    }
    const th = /^### (\d)\./.exec(line);
    if (th) {
      table = Number(th[1]);
      continue;
    }
    if (!line.startsWith('|') || /^\|[-| ]+\|$/.test(line) || line.startsWith('| 값 |') || line.startsWith('| 파일 |')) continue;
    const cells = splitCells(line);
    if (orphan) {
      if (cells.length < 5) continue;
      const [f, t, v, status, basis] = cells;
      if (status || basis) out.set(rowKey(f, Number(t), v.replace(/^`|`$/g, '')), { status, basis });
      continue;
    }
    if (!file || !table || cells.length < 6) continue;
    const value = cells[0].replace(/^`|`$/g, '');
    const status = cells[cells.length - 2];
    const basis = cells[cells.length - 1];
    if (status || basis) out.set(rowKey(file, table, value), { status, basis });
  }
  return out;
}

export function buildInventory(inputs: MockupInput[], prevMd: string | null, now: string): { md: string; changed: boolean; tables: Tables[] } {
  const tables = inputs.map((f) => extractTables(f.text));
  const filled = prevMd ? parseFilled(prevMd) : new Map<string, Filled>();
  const present = new Set<string>();
  inputs.forEach((f, i) => ([1, 2, 3, 4, 5] as TableId[]).forEach((id) => tables[i][id].forEach((r) => present.add(rowKey(f.file, id, r.key)))));
  const orphans: NonNullable<RenderOptions['orphans']> = [];
  for (const [k, f] of filled) {
    if (present.has(k)) continue;
    const [file, table, value] = k.split('\u0000');
    orphans.push({ key: k, file, table: Number(table), value, f });
  }
  orphans.sort((a, b) => (a.key < b.key ? -1 : 1));

  // 같은 시안이면 같은 출력: 이전 시각으로 먼저 그려 보고, 같으면 그대로 둔다.
  const prevTime = prevMd ? /^- 만든 시각: (.+) KST$/m.exec(prevMd)?.[1] : undefined;
  if (prevMd && prevTime) {
    const same = render({ timestamp: prevTime, inputs, tables, filled, orphans });
    if (same === prevMd) return { md: prevMd, changed: false, tables };
  }
  return { md: render({ timestamp: now, inputs, tables, filled, orphans }), changed: true, tables };
}

// ---------------------------------------------------------------- CLI

export const MOCKUP_FILES = [
  'docs/design/mockup-v4/Desk.dc.html',
  'docs/design/mockup-v4/scene1/Scene1.dc.html',
  'docs/design/mockup-v4/scene3/Main.dc.html',
];
export const OUT_FILE = 'reports/design-match/inventory.md';

function kstNow(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const inputs: MockupInput[] = MOCKUP_FILES.map((file) => ({ file, text: readFileSync(path.join(root, file), 'utf8') }));
  const outPath = path.join(root, OUT_FILE);
  const prev = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
  const { md, changed, tables } = buildInventory(inputs, prev, kstNow());
  if (changed) {
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, md);
  }
  inputs.forEach((f, i) => {
    const per = ([1, 2, 3, 4, 5] as TableId[]).map((id) => `${id}:${tables[i][id].length}`).join(' ');
    console.log(`${f.file}  ${per}`);
  });
  const orphanCount = (md.match(/^## 사라진 행/m) ? md.split('## 사라진 행')[1].split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| 파일') ).length : 0);
  console.log(changed ? `wrote ${OUT_FILE}` : `${OUT_FILE} 변경 없음 (같은 시안)`);
  if (orphanCount) console.log(`주의: 채운 값이 있던 행 ${orphanCount}개가 시안에서 사라짐 (파일 끝 "사라진 행" 절)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
