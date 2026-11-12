// 시안 HTML(<x-dc> 템플릿 + logic class) → 눌러서 갈 수 있는 상태 목록.
// 1) 정적: 템플릿의 onClick 바인딩, logic의 setState 키, 타이머 호출을 뽑는다.
// 2) 탐색: logic class를 node:vm 샌드박스(가짜 타이머)에서 돌리고, 렌더된 템플릿의 버튼을
//    하나씩 눌러 state가 달라지는 곳을 넓이 우선으로 모은다. 브라우저·네트워크 없음.
import vm from 'node:vm';
import { bindings, clickables, parseTemplate, render, type Binding, type Clickable, type TNode } from './template';
import type { ClickStep, StateDef, StatesFile, TimerUse } from './types';

export interface Extracted {
  template: string;
  script: string;
  scriptLine: number;
}

export function extractDc(html: string): Extracted {
  const open = /<x-dc(?:\s[^>]*)?>/.exec(html);
  const close = html.lastIndexOf('</x-dc>');
  if (!open || close < open.index) throw new Error('<x-dc> 템플릿을 찾지 못했다');
  let template = html.slice(open.index + open[0].length, close);
  // helmet(글꼴·스타일)은 상태와 상관없다. 줄 번호를 지키려고 같은 수의 줄바꿈으로 바꾼다
  template = template.replace(/<helmet>[\s\S]*?<\/helmet>/i, (m) => '\n'.repeat(m.split('\n').length - 1));
  const lead = html.slice(0, open.index + open[0].length).split('\n').length - 1;
  template = '\n'.repeat(lead) + template;
  const sm = /<script\b[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!sm) throw new Error('data-dc-script 스크립트를 찾지 못했다');
  const scriptLine = html.slice(0, sm.index).split('\n').length;
  return { template, script: sm[1], scriptLine };
}

// ---------- 정적 분석 (logic 소스) ----------
export interface StaticTimer {
  call: string;
  delay: string;
  line: number;
  inside: string;
}
export interface StaticHandler {
  name: string;
  line: number;
  setsKeys: string[];
  calls: string[];
}
export interface StaticInfo {
  bindings: Binding[];
  handlers: StaticHandler[];
  timers: StaticTimer[];
}

/** s[open]이 여는 괄호일 때 짝이 맞는 닫는 괄호 위치. 문자열·주석은 건너뛴다 */
export function matchClose(s: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const stack: string[] = [];
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < s.length && s[i] !== c; i++) if (s[i] === '\\') i++;
      continue;
    }
    if (c === '/' && s[i + 1] === '/') {
      i = s.indexOf('\n', i);
      if (i < 0) return -1;
      continue;
    }
    if (c === '/' && s[i + 1] === '*') {
      i = s.indexOf('*/', i);
      if (i < 0) return -1;
      i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === '}' || c === ']') {
      if (stack.pop() !== c) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

/** 호출 인자를 최상위 쉼표로 나눈다 */
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      for (; j < s.length && s[j] !== c; j++) if (s[j] === '\\') j++;
      cur += s.slice(i, j + 1);
      i = j;
      continue;
    }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function setStateKeys(body: string): string[] {
  const keys = new Set<string>();
  const re = /setState\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const open = m.index + m[0].length - 1;
    const close = matchClose(body, open);
    if (close < 0) continue;
    const arg = body.slice(open + 1, close).trim();
    if (!arg.startsWith('{')) continue;
    const objEnd = matchClose(arg, 0);
    const inner = arg.slice(1, objEnd < 0 ? undefined : objEnd);
    for (const part of splitArgs(inner)) {
      const k = /^\[?\s*([A-Za-z_$][\w$]*)\s*\]?\s*:/.exec(part) ?? /^([A-Za-z_$][\w$]*)$/.exec(part);
      if (k) keys.add(part.startsWith('[') ? `[${k[1]}]` : k[1]);
    }
  }
  return [...keys];
}

export function staticScan(ex: Extracted, tmpl: TNode[]): StaticInfo {
  const src = ex.script;
  const lineOf = (pos: number) => ex.scriptLine + src.slice(0, pos).split('\n').length - 1;
  const handlers: StaticHandler[] = [];
  const cls = /class\s+\w+\s+extends\s+\w+\s*\{/.exec(src);
  const methodRe = /(?:^|\n)\s{2}([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  const propRe = /\b([A-Za-z_$][\w$]*)\s*:\s*(?:\(([^)]*)\)|[A-Za-z_$][\w$]*)\s*=>\s*/g;
  const addHandler = (name: string, start: number, body: string) => {
    const keys = setStateKeys(body);
    const calls = [...new Set([...body.matchAll(/this\.([A-Za-z_$][\w$]*)\s*\(/g)].map((x) => x[1]))].filter((c) => c !== 'setState');
    if (keys.length || calls.length) handlers.push({ name, line: lineOf(start), setsKeys: keys, calls });
  };
  if (cls) {
    let m: RegExpExecArray | null;
    while ((m = methodRe.exec(src))) {
      if (m.index < cls.index) continue;
      if (['constructor', 'renderVals', 'if', 'for', 'while', 'switch'].includes(m[1])) continue;
      const open = m.index + m[0].length - 1;
      const close = matchClose(src, open);
      if (close > 0) addHandler(m[1], m.index, src.slice(open, close + 1));
    }
    while ((m = propRe.exec(src))) {
      if (m.index < cls.index) continue;
      const start = m.index + m[0].length;
      let end: number;
      if (src[start] === '{') end = matchClose(src, start) + 1;
      else {
        // 식 본문: 다음 최상위 쉼표/닫는 괄호까지
        let depth = 0;
        end = start;
        for (; end < src.length; end++) {
          const c = src[end];
          if ('([{'.includes(c)) depth++;
          else if (')]}'.includes(c)) {
            if (depth === 0) break;
            depth--;
          } else if (c === ',' && depth === 0) break;
        }
      }
      if (end > start) addHandler(m[1], m.index, src.slice(start, end));
    }
  }
  const timers: StaticTimer[] = [];
  const tre = /\b(setTimeout|setInterval|later)\s*\(/g;
  let t: RegExpExecArray | null;
  while ((t = tre.exec(src))) {
    const open = t.index + t[0].length - 1;
    const close = matchClose(src, open);
    if (close < 0) continue;
    if (/^\s*\{/.test(src.slice(close + 1, close + 4))) continue; // later(fn, ms) { … } 메서드 정의 자체
    const args = splitArgs(src.slice(open + 1, close));
    if (args.length < 2) continue;
    const before = src.slice(0, t.index);
    const owner = [...before.matchAll(/\n\s{2}([A-Za-z_$][\w$]*)\s*\(/g)].pop()?.[1] ?? '';
    timers.push({ call: t[1], delay: args[args.length - 1], line: lineOf(t.index), inside: owner });
  }
  return { bindings: bindings(tmpl), handlers, timers };
}

// ---------- 샌드박스 실행 ----------
interface FakeTimer {
  id: number;
  at: number;
  ms: number;
  fn: () => void;
  interval: boolean;
}

export class FakeClock {
  now = 0;
  private seq = 1;
  private q = new Map<number, FakeTimer>();
  log: { kind: 'timeout' | 'interval'; ms: number }[] = [];
  api() {
    return {
      setTimeout: (fn: () => void, ms = 0) => this.add(fn, ms, false),
      setInterval: (fn: () => void, ms = 0) => this.add(fn, ms, true),
      clearTimeout: (id: number) => void this.q.delete(id),
      clearInterval: (id: number) => void this.q.delete(id),
    };
  }
  private add(fn: () => void, ms: number, interval: boolean) {
    const id = this.seq++;
    const d = Math.max(0, Number(ms) || 0);
    this.q.set(id, { id, at: this.now + d, ms: d, fn, interval });
    this.log.push({ kind: interval ? 'interval' : 'timeout', ms: d });
    return id;
  }
  /** 걸린 타이머를 시간 순서로 모두 돌린다. 돌린 시간(ms)을 돌려준다 */
  runAll(limitMs = 120000, maxTicks = 50000): number {
    const start = this.now;
    for (let n = 0; n < maxTicks && this.q.size; n++) {
      let next: FakeTimer | undefined;
      for (const t of this.q.values()) if (!next || t.at < next.at || (t.at === next.at && t.id < next.id)) next = t;
      if (!next || next.at - start > limitMs) break;
      this.now = next.at;
      if (next.interval) next.at += Math.max(1, next.ms);
      else this.q.delete(next.id);
      next.fn();
    }
    return this.now - start;
  }
}

interface Logic {
  state: Record<string, unknown>;
  renderVals: () => Record<string, unknown>;
  componentDidMount?: () => void;
}

const DC_LOGIC = `class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(p, cb) { var patch = typeof p === 'function' ? p(this.state, this.props) : p; this.state = Object.assign({}, this.state, patch || {}); if (typeof cb === 'function') cb(); }
  forceUpdate() {}
}`;

export class Sim {
  readonly clock = new FakeClock();
  private comp: Logic;
  constructor(script: string, private tmpl: TNode[]) {
    const timers = this.clock.api();
    const ctx = vm.createContext({
      console: { log() {}, warn() {}, error() {}, info() {} },
      ...timers,
      window: {},
      navigator: { userAgent: 'design-diff' },
      Math,
      Date,
      JSON,
      Intl,
    });
    const code = `${DC_LOGIC}\n${script}\n;globalThis.__DC__ = (typeof Component !== 'undefined') ? Component : undefined;`;
    vm.runInContext(code, ctx, { timeout: 5000, filename: 'dc-logic.js' });
    const C = (ctx as Record<string, unknown>).__DC__ as (new (p: unknown) => Logic) | undefined;
    if (!C) throw new Error('logic class(Component)를 찾지 못했다');
    this.comp = new C({});
    this.comp.componentDidMount?.();
    this.clock.runAll();
  }
  get state() {
    return this.comp.state;
  }
  clickables(): Clickable[] {
    return clickables(render(this.tmpl, this.comp.renderVals()));
  }
  /** 단계를 눌러 본다. 못 찾으면 false */
  click(step: ClickStep): { ok: boolean; ms: number; timers: { kind: 'timeout' | 'interval'; ms: number }[] } {
    const list = this.clickables().filter((c) => (step.role === undefined || c.role === step.role) && c.text === step.text);
    const target = list[step.nth ?? 0];
    if (!target || target.disabled) return { ok: false, ms: 0, timers: [] };
    const mark = this.clock.log.length;
    target.handler({ preventDefault() {}, stopPropagation() {}, target: {}, currentTarget: {} });
    const ms = this.clock.runAll();
    return { ok: true, ms, timers: this.clock.log.slice(mark) };
  }
}

export interface ExploreOptions {
  maxDepth?: number;
  maxStates?: number;
  /** 상태 동일성 판단에서 뺄 state 키 (숫자 집계·토스트처럼 화면 구조를 안 바꾸는 것) */
  ignoreKeys?: string[];
}

export const DEFAULT_IGNORE = ['dash', 'flash', 'toast'];

function signature(state: Record<string, unknown>, ignore: string[]): string {
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(state).sort()) if (!ignore.includes(k)) o[k] = state[k];
  return JSON.stringify(o);
}

function diffKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}

export function slug(s: string): string {
  const x = s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
  return x || 'x';
}

function stepKey(s: ClickStep): string {
  return `${s.role ?? ''}|${s.text ?? ''}|${s.nth ?? 0}`;
}

function groupTimers(ts: { kind: 'timeout' | 'interval'; ms: number }[]): TimerUse[] {
  const m = new Map<string, TimerUse>();
  for (const t of ts) {
    const k = t.kind + ':' + t.ms;
    const e = m.get(k);
    if (e) e.count++;
    else m.set(k, { kind: t.kind, ms: t.ms, count: 1 });
  }
  return [...m.values()].sort((a, b) => a.ms - b.ms);
}

export interface Explored {
  states: StateDef[];
  pressed: Set<string>;
  truncated: boolean;
}

export function explore(script: string, tmpl: TNode[], opt: ExploreOptions = {}): Explored {
  const maxDepth = opt.maxDepth ?? 4;
  const maxStates = opt.maxStates ?? 120;
  const ignore = opt.ignoreKeys ?? DEFAULT_IGNORE;
  const base = new Sim(script, tmpl);
  const seen = new Set([signature(base.state, ignore)]);
  const states: StateDef[] = [{ name: 'initial', mock: [], app: [], settleMs: 0, timers: [], changed: [] }];
  const pressed = new Set<string>();
  const names = new Set(['initial']);
  // 첫 화면에서 바로 누를 수 있는 단계 → 그때 바뀌는 state 키
  const single = new Map<string, string[]>();
  for (const c of base.clickables()) {
    if (c.disabled) continue;
    const sim = new Sim(script, tmpl);
    const st = { role: c.role || undefined, text: c.text, nth: c.nth };
    const before0 = { ...sim.state };
    if (sim.click(st).ok) single.set(stepKey(st), diffKeys(before0, sim.state).filter((k) => !ignore.includes(k)));
  }
  // 앞 단계들과 상관없는 클릭(바뀌는 키가 첫 화면에서 누를 때와 같고, 앞 단계가 건드린 키와 겹치지 않음)은
  // 조합 상태를 만들지 않는다. 예: "히스토리 열기" 뒤 "상품 바꾸기"
  const isIndependent = (step: ClickStep, delta: string[], path: ClickStep[]): boolean => {
    const s = single.get(stepKey(step));
    if (!s || s.join() !== delta.join()) return false;
    const touched = new Set(path.flatMap((p) => single.get(stepKey(p)) ?? ['?']));
    return !delta.some((k) => touched.has(k));
  };
  let frontier: { path: ClickStep[]; name: string }[] = [{ path: [], name: '' }];
  let truncated = false;
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) {
      const parent = new Sim(script, tmpl);
      for (const s of node.path) parent.click(s);
      const before = { ...parent.state };
      const parentList = parent.clickables();
      const parentLabels = new Set(parentList.map((x) => x.role + '|' + x.text));
      for (const c of parentList) {
        if (c.disabled) continue;
        const step: ClickStep = { role: c.role || undefined, text: c.text, nth: c.nth };
        if (!step.role) delete step.role;
        const sim = new Sim(script, tmpl);
        let ok = true;
        for (const s of node.path) ok = sim.click(s).ok && ok;
        const r = sim.click(step);
        if (!ok || !r.ok) continue;
        pressed.add(c.handlerExpr);
        const sig = signature(sim.state, ignore);
        if (seen.has(sig)) continue;
        const delta = diffKeys(before, sim.state).filter((k) => !ignore.includes(k));
        if (node.path.length && isIndependent(step, delta, node.path)) continue;
        if (states.length >= maxStates) {
          truncated = true;
          continue;
        }
        seen.add(sig);
        step.waitMs = r.ms ? r.ms + 300 : 300;
        const path = [...node.path, step];
        let name = (node.name ? node.name + '__' : '') + slug(c.text || c.handlerExpr) + (c.nth ? '-' + (c.nth + 1) : '');
        for (let k = 2; names.has(name); k++) name = name.replace(/~\d+$/, '') + '~' + k;
        names.add(name);
        const appSteps = path.map((p) => ({ ...(p.role ? { role: p.role } : {}), text: p.text, ...(p.nth ? { nth: p.nth } : {}), waitMs: p.waitMs }));
        states.push({
          name,
          mock: path,
          app: appSteps,
          settleMs: r.ms,
          timers: groupTimers(r.timers),
          changed: diffKeys(before, sim.state),
        });
        // 새로 누를 거리가 생기지 않은 클릭(정렬, 접기·펴기, 완료 표시)은 끝 상태로 두고 더 넓히지 않는다
        const afterLabels = new Set(sim.clickables().map((x) => x.role + '|' + x.text));
        const fresh = [...afterLabels].filter((l) => !parentLabels.has(l));
        const toggled = fresh.length === 1 && !afterLabels.has(c.role + '|' + c.text);
        if (fresh.length > 0 && !toggled) next.push({ path, name });
      }
    }
    frontier = next;
  }
  return { states, pressed, truncated };
}

export interface Analysis {
  file: StatesFile;
  info: StaticInfo;
  pressed: Set<string>;
  truncated: boolean;
}

export function analyze(html: string, source: string, opt: ExploreOptions = {}): Analysis {
  const ex = extractDc(html);
  const tmpl = parseTemplate(ex.template);
  const info = staticScan(ex, tmpl);
  const { states, pressed, truncated } = explore(ex.script, tmpl, opt);
  return {
    file: { version: 1, source, generatedAt: new Date().toISOString(), states },
    info,
    pressed,
    truncated,
  };
}
