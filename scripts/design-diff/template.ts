// <x-dc> 템플릿 파서·렌더러 (dc-runtime 규칙의 필요한 부분만).
// - {{a.b}} : 값 경로. 속성값이 {{…}} 하나뿐이면 원래 값(함수·불리언) 그대로
// - <sc-for list="{{xs}}" as="x"> : 반복
// - <sc-if value="{{c}}"> : 참일 때만
// 브라우저 없이 "지금 화면에 어떤 버튼이 있나"를 구하는 데 쓴다.

export interface TNode {
  type: 'el' | 'text';
  tag?: string;
  attrs?: Record<string, string>;
  children?: TNode[];
  text?: string;
  line?: number;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}

export function parseTemplate(html: string): TNode[] {
  const root: TNode = { type: 'el', tag: '#root', attrs: {}, children: [] };
  const stack: TNode[] = [root];
  let i = 0;
  const lineAt = (pos: number) => html.slice(0, pos).split('\n').length;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    const top = stack[stack.length - 1];
    if (lt < 0) {
      top.children!.push({ type: 'text', text: html.slice(i) });
      break;
    }
    if (lt > i) top.children!.push({ type: 'text', text: html.slice(i, lt) });
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    const gt = html.indexOf('>', lt);
    if (gt < 0) {
      top.children!.push({ type: 'text', text: html.slice(lt) });
      break;
    }
    const inner = html.slice(lt + 1, gt);
    if (inner.startsWith('/')) {
      const tag = inner.slice(1).trim().toLowerCase();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === tag) {
          stack.length = k;
          break;
        }
      }
      i = gt + 1;
      continue;
    }
    if (inner.startsWith('!')) {
      i = gt + 1;
      continue;
    }
    const tm = /^([a-zA-Z][\w:-]*)/.exec(inner);
    if (!tm) {
      top.children!.push({ type: 'text', text: '<' });
      i = lt + 1;
      continue;
    }
    const tag = tm[1].toLowerCase();
    const selfClose = inner.endsWith('/');
    const attrs = parseAttrs(inner.slice(tm[1].length, selfClose ? -1 : undefined));
    const node: TNode = { type: 'el', tag, attrs, children: [], line: lineAt(lt) };
    top.children!.push(node);
    i = gt + 1;
    if (RAW.has(tag)) {
      const close = html.toLowerCase().indexOf('</' + tag, i);
      const end = close < 0 ? html.length : close;
      if (end > i) node.children!.push({ type: 'text', text: html.slice(i, end) });
      const cgt = close < 0 ? html.length : html.indexOf('>', close);
      i = cgt < 0 ? html.length : cgt + 1;
      continue;
    }
    if (!selfClose && !VOID.has(tag)) stack.push(node);
  }
  return root.children!;
}

// ---------- 값 경로 ----------
type Scope = Record<string, unknown>;

export function resolvePath(scope: Scope, expr: string): unknown {
  const e = expr.trim();
  if (e === 'true') return true;
  if (e === 'false') return false;
  if (e === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  let cur: unknown = scope;
  for (const part of e.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

const ONE = /^\s*\{\{([\s\S]+?)\}\}\s*$/;

export function interpolate(scope: Scope, s: string): string {
  return s.replace(/\{\{([\s\S]+?)\}\}/g, (_, e: string) => {
    const v = resolvePath(scope, e);
    return v === undefined || v === null || typeof v === 'function' ? '' : String(v);
  });
}

export function attrValue(scope: Scope, raw: string): unknown {
  const m = ONE.exec(raw);
  if (m) return resolvePath(scope, m[1]);
  return interpolate(scope, raw);
}

// ---------- 렌더 ----------
export interface RNode {
  type: 'el' | 'text';
  tag?: string;
  attrs?: Record<string, unknown>;
  children?: RNode[];
  text?: string;
  line?: number;
}

export function render(nodes: TNode[], scope: Scope): RNode[] {
  const out: RNode[] = [];
  for (const n of nodes) {
    if (n.type === 'text') {
      out.push({ type: 'text', text: interpolate(scope, n.text ?? '') });
      continue;
    }
    const a = n.attrs ?? {};
    if (n.tag === 'helmet' || n.tag === 'script' || n.tag === 'style') continue;
    if (n.tag === 'sc-if') {
      if (attrValue(scope, a.value ?? '')) out.push(...render(n.children ?? [], scope));
      continue;
    }
    if (n.tag === 'sc-for') {
      const list = attrValue(scope, a.list ?? '');
      const as = a.as ?? 'item';
      if (Array.isArray(list)) {
        list.forEach((item, idx) => {
          const sub = Object.create(scope) as Scope;
          sub[as] = item;
          sub[as + 'Index'] = idx;
          out.push(...render(n.children ?? [], sub));
        });
      }
      continue;
    }
    const attrs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(a)) {
      attrs[k] = attrValue(scope, v);
      if (k === 'onClick' || k === 'onclick') attrs.__onExpr = (ONE.exec(v)?.[1] ?? v).trim();
    }
    out.push({ type: 'el', tag: n.tag, attrs, line: n.line, children: render(n.children ?? [], scope) });
  }
  return out;
}

// ---------- 역할·이름표 (page-scripts.ts의 브라우저 쪽 규칙과 같게) ----------
export function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function implicitRole(tag: string, attrs: Record<string, unknown>): string {
  const r = attrs.role;
  if (typeof r === 'string' && r) return r;
  switch (tag) {
    case 'button':
    case 'summary':
      return 'button';
    case 'a':
      return attrs.href ? 'link' : '';
    case 'textarea':
      return 'textbox';
    case 'select':
      return 'combobox';
    case 'input': {
      const t = String(attrs.type ?? 'text');
      return t === 'checkbox' ? 'checkbox' : t === 'radio' ? 'radio' : t === 'button' || t === 'submit' ? 'button' : 'textbox';
    }
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'heading';
    default:
      return '';
  }
}

export function ownText(n: RNode): string {
  return collapse((n.children ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(''));
}

/** 이름표: 자기 글자. 없으면 자손 중 처음 나오는 자기 글자 (숫자만인 배지는 건너뜀) */
export function labelOf(n: RNode): string {
  const own = ownText(n);
  if (own) return own;
  const walk = (x: RNode): string => {
    for (const c of x.children ?? []) {
      if (c.type !== 'el') continue;
      const t = ownText(c);
      if (t && !/^\d+$/.test(t)) return t;
      const d = walk(c);
      if (d) return d;
    }
    return '';
  };
  return walk(n);
}

export function isDisabled(attrs: Record<string, unknown>): boolean {
  if (!('disabled' in attrs)) return false;
  const d = attrs.disabled;
  return d === true || d === '' || d === 'true' || d === 'disabled';
}

export interface Clickable {
  role: string;
  text: string;
  nth: number;
  tag: string;
  line?: number;
  disabled: boolean;
  handler: (e?: unknown) => unknown;
  handlerExpr: string;
}

/** 렌더 결과에서 onClick이 있는 요소들 (문서 순서) */
export function clickables(tree: RNode[]): Clickable[] {
  const out: Clickable[] = [];
  const seen = new Map<string, number>();
  const walk = (ns: RNode[]) => {
    for (const n of ns) {
      if (n.type !== 'el') continue;
      const a = n.attrs ?? {};
      const h = a.onClick ?? a.onclick;
      if (typeof h === 'function') {
        const role = implicitRole(n.tag ?? '', a);
        const text = labelOf(n);
        const k = role + '|' + text;
        const nth = seen.get(k) ?? 0;
        seen.set(k, nth + 1);
        out.push({
          role,
          text,
          nth,
          tag: n.tag ?? '',
          line: n.line,
          disabled: isDisabled(a),
          handler: h as (e?: unknown) => unknown,
          handlerExpr: typeof a.__onExpr === 'string' ? a.__onExpr : '',
        });
      }
      walk(n.children ?? []);
    }
  };
  walk(tree);
  return out;
}

export interface Binding {
  expr: string;
  event: string;
  tag: string;
  line: number;
  label: string;
  context: string[];
}

/** 정적: 템플릿의 모든 이벤트 바인딩 (sc-for/sc-if 안쪽 포함) */
export function bindings(nodes: TNode[], ctx: string[] = []): Binding[] {
  const out: Binding[] = [];
  for (const n of nodes) {
    if (n.type !== 'el') continue;
    const a = n.attrs ?? {};
    let next = ctx;
    if (n.tag === 'sc-for') next = [...ctx, `for ${a.as} in ${a.list}`];
    else if (n.tag === 'sc-if') next = [...ctx, `if ${a.value}`];
    for (const [k, v] of Object.entries(a)) {
      if (/^on[A-Z]/.test(k) || /^on[a-z]+$/.test(k)) {
        const m = ONE.exec(v);
        out.push({
          expr: m ? m[1].trim() : v,
          event: k,
          tag: n.tag ?? '',
          line: n.line ?? 0,
          label: collapse(
            (n.children ?? [])
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join(''),
          ),
          context: next,
        });
      }
    }
    out.push(...bindings(n.children ?? [], next));
  }
  return out;
}
