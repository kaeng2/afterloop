import { describe, expect, it } from 'vitest';
import { compareStyles, loosePairs } from '../../scripts/design-diff/compare';
import { parseArgs } from '../../scripts/design-diff/args';
import { stylesMd } from '../../scripts/design-diff/report';
import { CAPTURE, FIND_TARGET } from '../../scripts/design-diff/page-scripts';
import type { ElementSnap } from '../../scripts/design-diff/types';

// CAPTURE·FIND_TARGET(브라우저 코드)을 작은 가짜 DOM으로 실행한다.
type Css = Record<string, string>;
type FNode = { nodeType: 1 | 3; tagName: string; nodeValue?: string; attrs: Record<string, string>; childNodes: FNode[]; children: FNode[]; parentElement: FNode | null; css: Css; rect: { width: number; height: number } };
const T = (s: string): FNode => ({ nodeType: 3, tagName: '', nodeValue: s, attrs: {}, childNodes: [], children: [], parentElement: null, css: {}, rect: { width: 0, height: 0 } });
const E = (tag: string, attrs: Record<string, string>, kids: FNode[], css: Css = {}, rect = { width: 100, height: 20 }): FNode => {
  const n: FNode = { nodeType: 1, tagName: tag.toUpperCase(), attrs, childNodes: kids, children: kids.filter((k) => k.nodeType === 1), parentElement: null, css, rect };
  for (const k of kids) k.parentElement = n;
  return n;
};
const interp = (s: string) => E('span', { class: 'sc-interp' }, [T(s)]);
const SR = { position: 'absolute', clipPath: 'inset(50%)', overflow: 'hidden' };

function dom(roots: FNode[]) {
  const all: FNode[] = [];
  const walk = (n: FNode) => {
    all.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  for (const n of all) {
    const a = n as unknown as Record<string, unknown>;
    a.getAttribute = (k: string) => n.attrs[k] ?? null;
    a.hasAttribute = (k: string) => k in n.attrs;
    a.scrollIntoView = () => {};
    a.closest = () => null;
    a.getBoundingClientRect = () => ({ left: 0, top: 0, ...n.rect });
  }
  const doc = { querySelectorAll: (sel: string) => (sel === 'body *' ? all : []) };
  const gcs = (el: FNode) => {
    const c: Css = { visibility: 'visible', display: 'block', clipPath: 'none', clip: 'auto', overflow: 'visible', ...el.css };
    return { ...c, getPropertyValue: (k: string) => c[k] ?? '' };
  };
  return { doc, gcs };
}
function capture(roots: FNode[]): ElementSnap[] {
  const { doc, gcs } = dom(roots);
  return new Function('document', 'getComputedStyle', 'scrollX', 'scrollY', `return ${CAPTURE}([])`)(doc, gcs, 0, 0);
}
function find(roots: FNode[], step: object): { ok: boolean } {
  const { doc, gcs } = dom(roots);
  return new Function('document', 'getComputedStyle', `return ${FIND_TARGET}(${JSON.stringify(step)})`)(doc, gcs);
}
const keys = (r: FNode[]) => capture(r).map((e) => e.key);

describe('CAPTURE: 시안 sc-interp span (A)', () => {
  it('h2 안의 sc-interp 글자를 h2 자기 글자로 합치고 span은 따로 잡지 않는다', () => {
    expect(keys([E('h2', {}, [interp('Case history')])])).toEqual(['heading|Case history']);
  });
  it('글자와 섞여도 문서 순서대로 합친다', () => {
    const k = keys([E('div', {}, [T('Total: '), interp('$12.00'), T(' due')])]);
    expect(k).toEqual(['div|Total: $12.00 due']);
  });
  it('앱(직접 글자)과 key가 같아진다', () => {
    const mock = capture([E('h2', {}, [interp('Case history')])]);
    const app = capture([E('h2', {}, [T('Case history')])]);
    expect(compareStyles('s', 1440, mock, app).filter((d) => d.kind !== 'style')).toEqual([]);
  });
  it('sc-interp가 아닌 span은 예전처럼 따로 잡는다', () => {
    expect(keys([E('div', {}, [E('span', { class: 'pill' }, [T('New')])])])).toEqual(['span|New']);
  });
  it('FIND_TARGET도 sc-interp 글자를 버튼 이름표로 본다', () => {
    expect(find([E('button', {}, [interp('Send'), T(' reply')])], { role: 'button', text: 'Send reply' }).ok).toBe(true);
  });
});

describe('CAPTURE: 투명 감싸개 span (후속 4)', () => {
  const PILL = { display: 'inline-flex', 'background-color': 'rgba(5, 55, 130, 0.08)', padding: '2px 8px' };
  const BARE = { display: 'inline', 'background-color': 'rgba(0, 0, 0, 0)', padding: '0px', margin: '0px', 'border-top-width': '0px' };
  const bare = (s: string, css: Css = BARE) => E('span', {}, [T(s)], css);
  const pill = (kid: FNode) => E('span', { class: 'pill' }, [kid], PILL);

  it('앱 겉 알약>안쪽 맨 span ↔ 시안 겉 알약>sc-interp: 같은 key, 겉 스타일끼리 비교', () => {
    const mock = capture([pill(interp('for PayPal sellers'))]);
    const app = capture([pill(bare('for PayPal sellers'))]);
    expect(mock.map((e) => e.key)).toEqual(['span|for PayPal sellers']);
    expect(app.map((e) => e.key)).toEqual(['span|for PayPal sellers']);
    expect(app[0].styles['background-color']).toBe('rgba(5, 55, 130, 0.08)');
    expect(compareStyles('s', 1440, mock, app)).toEqual([]);
  });
  it('숫자 배지·칩도 (여러 겹 맨 span도 합친다)', () => {
    expect(keys([pill(bare('2'))])).toEqual(['span|2']);
    expect(keys([E('div', { class: 'chip' }, [E('span', {}, [bare('Not received · Customs hold')], BARE)], PILL)])).toEqual(['div|Not received · Customs hold']);
  });
  it('안쪽 span에 자기 스타일이 있으면 감싸개가 아니다', () => {
    expect(keys([pill(bare('x', { ...BARE, 'background-color': 'red' }))])).toEqual(['span|x']);
    expect(keys([pill(bare('x', { ...BARE, padding: '0px 4px' }))])).toEqual(['span|x']);
    expect(keys([pill(bare('x', { ...BARE, display: 'inline-block' }))])).toEqual(['span|x']);
    expect(keys([pill(bare('x', { ...BARE, 'border-top-width': '1px' }))])).toEqual(['span|x']);
  });
  it('형제 요소가 있거나 부모 글자를 다 갖지 않으면 감싸개가 아니다', () => {
    expect(keys([E('div', {}, [bare('a'), bare('b')])])).toEqual(['span|a', 'span|b']);
    expect(keys([E('div', {}, [T('Total: '), bare('$5')])])).toEqual(['div|Total:', 'span|$5']);
  });
  it('FIND_TARGET: 버튼>맨 span 글자를 버튼 이름표로 본다', () => {
    expect(find([E('button', {}, [bare('Send reply')])], { role: 'button', text: 'Send reply' }).ok).toBe(true);
  });
});

describe('CAPTURE: 화면 읽기 전용 글자 (B)', () => {
  it('clip-path inset(50%) 요소는 세지 않는다', () => {
    expect(keys([E('div', {}, [T('Shown'), E('span', { class: 'sr-only' }, [T('Hidden label')], SR, { width: 1, height: 1 })])])).toEqual(['div|Shown']);
  });
  it('clip rect(0 0 0 0)', () => {
    expect(keys([E('span', {}, [T('x')], { position: 'absolute', clip: 'rect(0px, 0px, 0px, 0px)' })])).toEqual([]);
  });
  it('1px×1px + overflow hidden (clip 없이)', () => {
    expect(keys([E('span', {}, [T('x')], { overflow: 'hidden' }, { width: 1, height: 1 })])).toEqual([]);
  });
  it('sr-only 조상 아래 자손도 세지 않는다', () => {
    expect(keys([E('span', {}, [E('b', {}, [T('inner')])], SR, { width: 1, height: 1 })])).toEqual([]);
  });
  it('1px 이하라도 overflow가 보이면 센다 · 보통 clip-path는 센다', () => {
    expect(keys([E('span', {}, [T('dot')], {}, { width: 1, height: 1 })])).toEqual(['span|dot']);
    expect(keys([E('span', {}, [T('pill')], { clipPath: 'inset(0px round 8px)' })])).toEqual(['span|pill']);
  });
});

const el = (key: string, tag: string, role: string, text: string, styles: Record<string, string> = {}): ElementSnap => ({ key, tag, role, text, styles, matches: [] });

describe('compareStyles --loose-tags (C)', () => {
  const mock = [el('heading|Case history', 'h3', 'heading', 'Case history', { color: 'red' }), el('span|Total', 'span', '', 'Total')];
  const app = [el('b|Case history', 'b', '', 'Case history', { color: 'blue' }), el('strong|Total', 'strong', '', 'Total')];
  it('기본(꺼짐)은 예전처럼 시안에만/앱에만', () => {
    expect(compareStyles('s', 1440, mock, app).map((d) => d.kind)).toEqual(['missing', 'missing', 'extra', 'extra']);
  });
  it('켜면 태그 다름 한 줄 + 스타일 비교 계속', () => {
    const d = compareStyles('s', 1440, mock, app, { looseTags: true });
    expect(d.map((x) => `${x.kind}:${x.key}:${x.prop ?? ''}:${x.mock ?? ''}`)).toEqual(['tag:heading|Case history:tag:h3', 'style:heading|Case history:color:red', 'tag:span|Total:tag:span']);
    expect(d[0].app).toBe('b (b|Case history)');
    expect(stylesMd({ state: 's', widths: [1440], diffs: d, pixels: [], unexplained: d.length, pass: false }, [])).toContain('## 태그만 다른 요소');
  });
  it('글자가 다르거나 역할 있는 요소(button 등)는 짝짓지 않는다', () => {
    const m = [el('button|Send', 'button', 'button', 'Send'), el('h2|A', 'h2', 'heading', 'A')];
    const a = [el('span|Send', 'span', '', 'Send'), el('b|B', 'b', '', 'B')];
    expect(loosePairs(m, a).size).toBe(0);
  });
  it('key로 이미 짝지은 것은 건드리지 않고, 같은 글자가 여럿이면 문서 순서', () => {
    const m = [el('heading|X', 'h2', 'heading', 'X'), el('heading|X#2', 'h2', 'heading', 'X')];
    const a = [el('heading|X', 'h2', 'heading', 'X'), el('span|X', 'span', '', 'X'), el('b|X', 'b', '', 'X')];
    const p = loosePairs(m, a);
    expect([...p].map(([k, v]) => `${k}->${v.key}`)).toEqual(['heading|X#2->span|X']);
    expect(compareStyles('s', 1440, m, a, { looseTags: true }).map((d) => `${d.kind}:${d.key}`)).toEqual(['tag:heading|X#2', 'extra:b|X']);
  });
  it('parseArgs --loose-tags', () => {
    expect(parseArgs(['--mock', 'd', '--app', 'u']).looseTags).toBe(false);
    expect(parseArgs(['--mock', 'd', '--app', 'u', '--loose-tags']).looseTags).toBe(true);
  });
});
