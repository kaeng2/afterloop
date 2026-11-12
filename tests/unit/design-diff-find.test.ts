import { describe, expect, it } from 'vitest';
import { FIND_TARGET } from '../../scripts/design-diff/page-scripts';

// FIND_TARGET(브라우저 코드)을 작은 가짜 DOM으로 실행한다.
type FNode = { nodeType: 1 | 3; tagName: string; nodeValue?: string; attrs: Record<string, string>; childNodes: FNode[]; children: FNode[]; parentElement: FNode | null; hidden: boolean; onclick?: unknown };
const T = (s: string): FNode => ({ nodeType: 3, tagName: '', nodeValue: s, attrs: {}, childNodes: [], children: [], parentElement: null, hidden: false });
const E = (tag: string, attrs: Record<string, string>, kids: FNode[], o: { hidden?: boolean } = {}): FNode => {
  const n: FNode = { nodeType: 1, tagName: tag.toUpperCase(), attrs, childNodes: kids, children: kids.filter((k) => k.nodeType === 1), parentElement: null, hidden: !!o.hidden };
  for (const k of kids) k.parentElement = n;
  return n;
};
function runFind(root: FNode[], step: object): { ok: boolean; count: number; x?: number; near?: string[] } {
  const all: FNode[] = [];
  const walk = (n: FNode) => {
    for (const c of n.children) {
      all.push(c);
      walk(c);
    }
  };
  for (const r of root) {
    all.push(r);
    walk(r);
  }
  for (const n of all) {
    const a = n as unknown as Record<string, unknown>;
    a.getAttribute = (k: string) => n.attrs[k] ?? null;
    a.hasAttribute = (k: string) => k in n.attrs;
    a.scrollIntoView = () => {};
    a.getBoundingClientRect = () => (n.hidden ? { left: 0, top: 0, width: 0, height: 0 } : { left: 10, top: 20, width: 100, height: 30 });
  }
  const doc = { querySelectorAll: (sel: string) => (sel === 'body *' ? all : []) };
  const gcs = () => ({ visibility: 'visible', display: 'block' });
  return new Function('document', 'getComputedStyle', `return ${FIND_TARGET}(${JSON.stringify(step)})`)(doc, gcs);
}
const appSwitch = () =>
  E('button', { type: 'button', class: 'tg', role: 'switch', 'aria-checked': 'false' }, [
    E('span', { class: 'ai', 'aria-hidden': 'true' }, [E('svg', {}, []), T('AI')]),
    T('Respond now'),
    E('span', { class: 'tg-tr', 'aria-hidden': 'true' }, [E('span', { class: 'tg-kn' }, [])]),
  ]);

describe('FIND_TARGET (가짜 DOM)', () => {
  it('앱 모양 switch를 role+text로 찾는다', () => {
    expect(runFind([E('div', {}, [appSwitch()])], { role: 'switch', text: 'Respond now' }).ok).toBe(true);
  });
  it('시안 모양(AI span이 aria-hidden 아님)도 찾는다', () => {
    const mock = E('button', { role: 'switch' }, [E('span', { class: 'ai' }, [E('svg', {}, []), T('AI')]), T('Respond now'), E('span', { class: 'tg-tr' }, [])]);
    expect(runFind([mock], { role: 'switch', text: 'Respond now' }).ok).toBe(true);
  });
  it('글자 노드가 쪼개지거나 NBSP·0폭 글자가 끼어도 찾는다', () => {
    const b = E('button', { role: 'switch' }, [T('Respond'), T(' ​now')]);
    expect(runFind([b], { role: 'switch', text: 'Respond now' }).ok).toBe(true);
  });
  it('글자가 자손 span 안에만 있어도 찾는다', () => {
    const b = E('button', { role: 'switch' }, [E('span', { 'aria-hidden': 'true' }, [T('AI')]), E('span', {}, [T('Respond now')])]);
    expect(runFind([b], { role: 'switch', text: 'Respond now' }).ok).toBe(true);
  });
  it('aria-label만 있어도 찾는다', () => {
    const b = E('button', { role: 'switch', 'aria-label': 'Respond now' }, [E('span', {}, [])]);
    expect(runFind([b], { role: 'switch', text: 'Respond now' }).ok).toBe(true);
  });
  it('못 찾으면 같은 역할 요소와 보임 여부를 알려 준다 (상단바 스위치만 있을 때)', () => {
    const top = E('button', { role: 'switch', disabled: '' }, [E('span', { 'aria-hidden': 'true' }, [])]);
    const hid = E('button', { role: 'switch' }, [T('Respond now')], { hidden: true });
    const r = runFind([top, hid], { role: 'switch', text: 'Respond now' });
    expect(r.ok).toBe(false);
    expect(r.near).toEqual(['', 'Respond now (안 보임)']);
  });
});
