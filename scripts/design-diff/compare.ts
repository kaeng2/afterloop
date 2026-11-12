// 비교·예외 대조·판정. 브라우저 없이 시험할 수 있는 순수 함수만 둔다.
import type { AnimSnap, DiffItem, ElementSnap, ExceptionRule, MotionSnap, PixelResult, StateResult } from './types';

export const PIXEL_LIMIT = 0.005; // 상태당 0.5%
export const STYLE_TOL = 0.5; // px 값 허용 오차
export const GEOM_TOL = 1; // x·y·width·height 허용 오차
const GEOM = new Set(['x', 'y', 'width', 'height']);

/** 숫자를 뺀 뼈대가 같고 숫자마다 tol 안이면 같다고 본다 */
export function sameValue(a: string, b: string, tol: number): boolean {
  if (a === b) return true;
  const na = a.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const nb = b.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  if (na.length !== nb.length) return false;
  const sk = (s: string) => s.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, '#').replace(/\s+/g, ' ').trim();
  if (sk(a) !== sk(b)) return false;
  return na.every((x, i) => Math.abs(Number(x) - Number(nb[i])) <= tol);
}

/** font-family 첫 글꼴만 비교 (대체 글꼴 목록 차이는 무시) */
function normalize(prop: string, v: string): string {
  if (prop === 'font-family') return (v.split(',')[0] ?? '').replace(/["']/g, '').trim().toLowerCase();
  return v.trim();
}

/** --loose-tags에서 서로 짝지어도 되는 글자 태그 (h1~h6 ↔ b/strong/span) */
const LOOSE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'strong', 'span']);
const looseOk = (e: ElementSnap) => LOOSE_TAGS.has(e.tag) && (e.role === '' || e.role === 'heading');

/** key로 짝 못 찾은 것끼리 태그만 다르고 글자가 같으면 문서 순서대로 짝짓는다. 시안 key → 앱 요소 */
export function loosePairs(mock: ElementSnap[], app: ElementSnap[]): Map<string, ElementSnap> {
  const ak = new Set(app.map((e) => e.key));
  const mk = new Set(mock.map((e) => e.key));
  const pool = new Map<string, ElementSnap[]>();
  for (const a of app) {
    if (mk.has(a.key) || !looseOk(a) || !a.text) continue;
    const l = pool.get(a.text) ?? [];
    l.push(a);
    pool.set(a.text, l);
  }
  const out = new Map<string, ElementSnap>();
  for (const m of mock) {
    if (ak.has(m.key) || !looseOk(m) || !m.text) continue;
    const a = pool.get(m.text)?.shift();
    if (a) out.set(m.key, a);
  }
  return out;
}

export interface CompareOpts {
  /** 태그만 다르고 글자가 같은 h1~h6 ↔ b/strong/span을 '태그 다름' 한 줄로 짝짓고 스타일 비교를 계속한다 */
  looseTags?: boolean;
}

export function compareStyles(state: string, width: number, mock: ElementSnap[], app: ElementSnap[], opts: CompareOpts = {}): DiffItem[] {
  const out: DiffItem[] = [];
  const am = new Map(app.map((e) => [e.key, e]));
  const mm = new Map(mock.map((e) => [e.key, e]));
  const loose = opts.looseTags ? loosePairs(mock, app) : new Map<string, ElementSnap>();
  const pairedApp = new Set([...loose.values()].map((a) => a.key));
  for (const m of mock) {
    let a = am.get(m.key);
    if (!a) {
      a = loose.get(m.key);
      if (!a) {
        out.push({ state, width, kind: 'missing', key: m.key, role: m.role, text: m.text, selectors: m.matches, exceptions: [] });
        continue;
      }
      out.push({ state, width, kind: 'tag', key: m.key, role: m.role, text: m.text, prop: 'tag', mock: m.tag, app: `${a.tag} (${a.key})`, selectors: [...new Set([...m.matches, ...a.matches])], exceptions: [] });
    }
    for (const prop of Object.keys(m.styles)) {
      const mv = normalize(prop, m.styles[prop] ?? '');
      const av = normalize(prop, a.styles[prop] ?? '');
      if (!sameValue(mv, av, GEOM.has(prop) ? GEOM_TOL : STYLE_TOL)) {
        out.push({
          state,
          width,
          kind: 'style',
          key: m.key,
          role: m.role,
          text: m.text,
          prop,
          mock: m.styles[prop],
          app: a.styles[prop],
          selectors: [...new Set([...m.matches, ...a.matches])],
          exceptions: [],
        });
      }
    }
  }
  for (const a of app) {
    if (!mm.has(a.key) && !pairedApp.has(a.key)) out.push({ state, width, kind: 'extra', key: a.key, role: a.role, text: a.text, selectors: a.matches, exceptions: [] });
  }
  return out;
}

function animKey(a: AnimSnap): string {
  return `${a.type}|${a.name}|${a.target}`;
}

export function compareMotion(state: string, width: number, mock: MotionSnap, app: MotionSnap): DiffItem[] {
  const out: DiffItem[] = [];
  const am = new Map<string, AnimSnap>();
  for (const a of app.animations) am.set(animKey(a), a);
  const mm = new Map<string, AnimSnap>();
  for (const m of mock.animations) mm.set(animKey(m), m);
  const fmt = (a: AnimSnap) => `${a.duration}ms · delay ${a.delay} · ${a.easing} · ×${a.iterations}`;
  for (const [k, m] of mm) {
    const a = am.get(k);
    if (!a) {
      out.push({ state, width, kind: 'motion', key: k, text: m.target, prop: m.name || m.type, mock: fmt(m), app: '(없음)', selectors: [], exceptions: [] });
      continue;
    }
    for (const f of ['duration', 'delay', 'easing', 'iterations'] as const) {
      if (!sameValue(m[f], a[f], 1)) out.push({ state, width, kind: 'motion', key: k, text: m.target, prop: `${m.name || m.type}.${f}`, mock: m[f], app: a[f], selectors: [], exceptions: [] });
    }
  }
  for (const [k, a] of am) {
    if (!mm.has(k)) out.push({ state, width, kind: 'motion', key: k, text: a.target, prop: a.name || a.type, mock: '(없음)', app: fmt(a), selectors: [], exceptions: [] });
  }
  // 타이머: 시안이 쓰는 간격이 앱에 있는지만 본다 (앱 프레임워크 내부 타이머는 참고로만 motion.md에 적는다)
  const appMs = new Set(app.timers.map((t) => `${t.kind}:${t.ms}`));
  for (const t of mock.timers) {
    if (t.ms < 16) continue;
    if (!appMs.has(`${t.kind}:${t.ms}`)) {
      out.push({ state, width, kind: 'motion', key: `timer|${t.kind}|${t.ms}`, prop: `${t.kind} ${t.ms}ms`, mock: `${t.ms}ms ×${t.count}`, app: '(없음)', selectors: [], exceptions: [] });
    }
  }
  return out;
}

export function pixelDiff(state: string, p: PixelResult, limit = PIXEL_LIMIT): DiffItem | null {
  if (p.ratio <= limit) return null;
  return { state, width: p.width, kind: 'pixel', key: `pixel|${p.width}`, prop: 'ratio', mock: '', app: (p.ratio * 100).toFixed(2) + '%', selectors: [], exceptions: [] };
}

// ---------- 예외 대조 ----------
export function parseExceptions(raw: unknown): ExceptionRule[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { exceptions?: unknown }).exceptions) ? (raw as { exceptions: unknown[] }).exceptions : null;
  if (!list) throw new Error('exceptions.json: 배열 또는 { "exceptions": [...] } 이어야 한다');
  return list.map((r, i) => {
    const o = r as ExceptionRule;
    if (!o || typeof o.id !== 'string' || !o.id) throw new Error(`exceptions.json ${i}번째 줄: id가 없다`);
    if (!o.match || typeof o.match !== 'object') throw new Error(`exceptions.json ${o.id}: match가 없다`);
    return o;
  });
}

function textMatch(pattern: string, s: string): boolean {
  const re = /^\/([\s\S]*)\/([a-z]*)$/.exec(pattern);
  if (re) return new RegExp(re[1], re[2]).test(s);
  return s.includes(pattern);
}

function globMatch(pattern: string, s: string): boolean {
  const re = new RegExp('^' + pattern.split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return re.test(s);
}

export function ruleMatches(rule: ExceptionRule, d: DiffItem): boolean {
  const m = rule.match;
  if (m.kind !== undefined && !(Array.isArray(m.kind) ? m.kind : [m.kind]).includes(d.kind)) return false;
  if (m.state !== undefined && !globMatch(m.state, d.state)) return false;
  if (m.width !== undefined && m.width !== d.width) return false;
  if (m.role !== undefined && m.role !== (d.role ?? '')) return false;
  if (m.text !== undefined && !textMatch(m.text, d.text ?? '')) return false;
  if (m.key !== undefined && !textMatch(m.key, d.key)) return false;
  if (m.prop !== undefined) {
    const props = Array.isArray(m.prop) ? m.prop : [m.prop];
    const p = d.prop ?? '';
    if (!props.some((x) => p === x || p.startsWith(x + '.') || globMatch(x, p))) return false;
  }
  if (m.selector !== undefined && !d.selectors.includes(m.selector)) return false;
  return true;
}

export function applyExceptions(diffs: DiffItem[], rules: ExceptionRule[]): DiffItem[] {
  return diffs.map((d) => ({ ...d, exceptions: rules.filter((r) => ruleMatches(r, d)).map((r) => r.id) }));
}

export function selectorsOf(rules: ExceptionRule[]): string[] {
  return [...new Set(rules.map((r) => r.match.selector).filter((s): s is string => !!s))];
}

/** 판정: 설명 없는 차이 0 (픽셀 0.5% 초과도 예외로 설명돼야 함) */
export function judge(state: string, widths: number[], diffs: DiffItem[], pixels: PixelResult[]): StateResult {
  const unexplained = diffs.filter((d) => d.exceptions.length === 0).length;
  return { state, widths, diffs, pixels, unexplained, pass: unexplained === 0 };
}
