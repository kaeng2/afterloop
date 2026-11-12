import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { analyze, extractDc, FakeClock, matchClose, Sim, slug, splitArgs, staticScan } from '../../scripts/design-diff/analyze';
import { parseArgs } from '../../scripts/design-diff/args';
import { applyExceptions, compareMotion, compareStyles, judge, parseExceptions, pixelDiff, ruleMatches, sameValue, selectorsOf } from '../../scripts/design-diff/compare';
import { retryFind } from '../../scripts/design-diff/browser';
import { padRgba } from '../../scripts/design-diff/pixel';
import { indexHtml, mdCell, motionMd, statesMd, stylesMd } from '../../scripts/design-diff/report';
import { joinUrl, stateDir } from '../../scripts/design-diff/run';
import { pickVendor } from '../../scripts/design-diff/server';
import { clickables, labelOf, parseTemplate, render } from '../../scripts/design-diff/template';
import type { DiffItem, ElementSnap, MotionSnap } from '../../scripts/design-diff/types';

const FIXTURE = `<!doctype html><html><body>
<x-dc>
<helmet><style>.b{color:red}</style></helmet>
<div>
<sc-for list="{{tabs}}" as="t"><button class="{{t.cls}}" onClick="{{t.pick}}">{{t.label}}<span>{{t.n}}</span></button></sc-for>
<sc-if value="{{open}}"><button onClick="{{close}}" role="switch">Close panel</button></sc-if>
<button disabled="{{busy}}" onClick="{{go}}">Go</button>
<button onClick="{{noop}}"><span>3</span><b>Icon only</b></button>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script>
class Component extends DCLogic {
  constructor(p) { super(p); this.state = { tab: 'a', open: false, busy: false, n: 0 }; }
  run() { this.setState({ busy: true }); setTimeout(() => this.setState({ busy: false, n: this.state.n + 1 }), 1300); }
  renderVals() {
    const s = this.state;
    return {
      tabs: ['a', 'b'].map((k) => ({ label: k.toUpperCase(), n: 2, cls: s.tab === k ? 'on' : '', pick: () => this.setState({ tab: k, open: k === 'b' }) })),
      open: s.open, busy: s.busy,
      close: () => this.setState({ open: false }),
      go: () => this.run(),
      noop: () => {}
    };
  }
}
</script></body></html>`;

describe('template', () => {
  it('sc-for·sc-if·속성 값을 렌더하고 클릭 가능한 요소를 문서 순서로 낸다', () => {
    const ex = extractDc(FIXTURE);
    const t = parseTemplate(ex.template);
    let clicked = '';
    const tree = render(t, {
      tabs: [
        { label: 'A', n: 1, pick: () => (clicked = 'a') },
        { label: 'B', n: 1, pick: () => (clicked = 'b') },
      ],
      open: true,
      busy: true,
      close: () => {},
      go: () => {},
      noop: () => {},
    });
    const cs = clickables(tree);
    expect(cs.map((c) => `${c.role}:${c.text}`)).toEqual(['button:A', 'button:B', 'switch:Close panel', 'button:Go', 'button:Icon only']);
    expect(cs[3].disabled).toBe(true);
    expect(cs[0].handlerExpr).toBe('t.pick');
    cs[1].handler();
    expect(clicked).toBe('b');
  });
  it('이름표: 숫자 배지는 건너뛰고 자손의 자기 글자를 쓴다', () => {
    const [n] = render(parseTemplate('<button><span>12</span><b>Wool Sweater</b></button>'), {});
    expect(labelOf(n)).toBe('Wool Sweater');
  });
});

describe('analyze (logic 샌드박스 탐색)', () => {
  it('가짜 타이머는 시간 순서로 돌고 간격을 기록한다', () => {
    const c = new FakeClock();
    const api = c.api();
    const seen: number[] = [];
    let k = 0;
    const iv = api.setInterval(() => {
      seen.push(c.now);
      if (++k === 3) api.clearInterval(iv);
    }, 32);
    api.setTimeout(() => seen.push(c.now), 50);
    expect(c.runAll()).toBe(96);
    expect(seen).toEqual([32, 50, 64, 96]);
    expect(c.log).toEqual([
      { kind: 'interval', ms: 32 },
      { kind: 'timeout', ms: 50 },
    ]);
  });
  it('괄호 짝·인자 나누기', () => {
    const s = 'f(a, "x,)", g(1, 2), {k: [1,2]})';
    expect(matchClose(s, 1)).toBe(s.length - 1);
    expect(splitArgs(s.slice(2, -1))).toEqual(['a', '"x,)"', 'g(1, 2)', '{k: [1,2]}']);
  });
  it('fixture: 상태·타이머·정적 바인딩', () => {
    const a = analyze(FIXTURE, 'fixture.html');
    const names = a.file.states.map((s) => s.name);
    expect(names[0]).toBe('initial');
    expect(names).toContain('b');
    expect(names).toContain('b__close-panel');
    const go = a.file.states.find((s) => s.name === 'go');
    expect(go?.timers).toEqual([{ kind: 'timeout', ms: 1300, count: 1 }]);
    expect(go?.settleMs).toBe(1300);
    expect(go?.mock[0]).toMatchObject({ role: 'button', text: 'Go', waitMs: 1600 });
    expect(go?.app[0]).toMatchObject({ role: 'button', text: 'Go' });
    expect(go?.changed).toContain('n');
    // 아무것도 안 바꾸는 버튼은 상태가 아니다
    expect(names.some((n) => n.includes('icon-only'))).toBe(false);
    expect(a.info.bindings.map((b) => b.expr)).toEqual(['t.pick', 'close', 'go', 'noop']);
    expect(a.info.bindings[1].context).toEqual(['if {{open}}']);
    expect(a.info.timers.map((t) => t.delay)).toEqual(['1300']);
    expect(a.info.handlers.find((h) => h.name === 'run')?.setsKeys).toEqual(['busy', 'n']);
  });
  it('Sim.click: 없는 단계·비활성 단계는 실패', () => {
    const ex = extractDc(FIXTURE);
    const sim = new Sim(ex.script, parseTemplate(ex.template));
    expect(sim.click({ role: 'button', text: 'Nope' }).ok).toBe(false);
    expect(sim.click({ role: 'switch', text: 'Close panel' }).ok).toBe(false);
    expect(sim.click({ role: 'button', text: 'B' }).ok).toBe(true);
    expect(sim.state.tab).toBe('b');
  });
  it('slug', () => {
    expect(slug('Refund $72 now')).toBe('refund-72-now');
    expect(slug('#1047')).toBe('1047');
    expect(slug('!!')).toBe('x');
  });

  it('mockup v6: 주요 상태와 타이머(타이핑 32ms, 단계 1300ms 식)를 찾는다', () => {
    const file = path.join(process.cwd(), 'docs/design/mockup-v6/Desk.dc.html');
    const html = readFileSync(file, 'utf8');
    const a = analyze(html, 'docs/design/mockup-v6/Desk.dc.html');
    const names = a.file.states.map((s) => s.name);
    expect(a.truncated).toBe(false);
    for (const n of ['initial', 'all-products', 'show-history', 'respond-now', 'respond-now__send', 'respond-now__try-a-rushed-reply__send', 'all-products__product']) expect(names).toContain(n);
    const send = a.file.states.find((s) => s.name === 'respond-now__send')!;
    expect(send.mock.map((s) => s.text)).toEqual(['Respond now', 'Send']);
    expect(send.changed).toContain('phase');
    expect(send.settleMs).toBeGreaterThan(5000);
    expect(a.file.states.find((s) => s.name === 'respond-now')!.timers).toEqual([{ kind: 'interval', ms: 32, count: 1 }]);
    const delays = a.info.timers.map((t) => t.delay);
    expect(delays).toContain('32');
    expect(delays).toContain('1300 * (k - 1) + 400');
    // 모든 onClick 바인딩을 적어도 한 번 누른다 (입력 onChange는 대상 아님)
    const onClick = a.info.bindings.filter((b) => b.event === 'onClick').map((b) => b.expr);
    expect(onClick.filter((e) => !a.pressed.has(e))).toEqual([]);
    const md = statesMd(a);
    expect(md).toContain('| 1 | `initial` |');
    expect(md).toContain('모든 onClick 바인딩을');
  });
});

const el = (key: string, styles: Record<string, string>, matches: string[] = []): ElementSnap => {
  const [role, text] = key.split('|');
  return { key, role, text: text.replace(/#\d+$/, ''), tag: 'button', styles, matches };
};

describe('compare', () => {
  it('sameValue: 숫자 허용 오차와 뼈대', () => {
    expect(sameValue('10px', '10.4px', 0.5)).toBe(true);
    expect(sameValue('10px', '11px', 0.5)).toBe(false);
    expect(sameValue('rgb(0, 0, 0)', 'rgb(0, 0, 0)', 0.5)).toBe(true);
    expect(sameValue('rgb(0, 0, 0) 0px 2px 8px', 'rgb(0, 0, 0) 0px 2px', 0.5)).toBe(false);
    expect(sameValue('none', 'auto', 0.5)).toBe(false);
  });
  it('글자·역할로 짝짓고 다른 항목·짝 없는 요소를 낸다', () => {
    const mock = [el('button|Send', { color: 'rgb(0, 0, 0)', x: '10', 'font-family': 'Figtree, sans-serif' }, ['.btn']), el('button|Send#2', { color: 'red' }), el('heading|Title', {})];
    const app = [el('button|Send', { color: 'rgb(1, 0, 0)', x: '10.8', 'font-family': '"Figtree", system-ui' }), el('button|Send#2', { color: 'red' }), el('button|Extra', {})];
    const d = compareStyles('s', 1440, mock, app);
    expect(d.map((x) => `${x.kind}:${x.key}:${x.prop ?? ''}`)).toEqual(['style:button|Send:color', 'missing:heading|Title:', 'extra:button|Extra:']);
    expect(d[0].selectors).toEqual(['.btn']);
  });
  it('모션: 없는 애니메이션·다른 duration·시안 타이머 간격', () => {
    const a = { type: 'CSSTransition', name: 'background-color', target: 'button|Send', duration: '150', delay: '0', easing: 'ease', iterations: '1' };
    const mock: MotionSnap = { animations: [a, { ...a, name: 'transform', target: 'span|x' }], events: [], timers: [{ kind: 'interval', ms: 32, count: 200 }, { kind: 'timeout', ms: 0, count: 5 }] };
    const app: MotionSnap = { animations: [{ ...a, duration: '300' }], events: [], timers: [{ kind: 'timeout', ms: 1300, count: 2 }] };
    const d = compareMotion('s', 1440, mock, app);
    expect(d.map((x) => x.prop)).toEqual(['background-color.duration', 'transform', 'interval 32ms']);
  });
  it('픽셀: 0.5% 이하는 차이가 아니다', () => {
    expect(pixelDiff('s', { width: 1440, ratio: 0.005, diffPixels: 5, total: 1000 })).toBeNull();
    expect(pixelDiff('s', { width: 1440, ratio: 0.0051, diffPixels: 6, total: 1000 })?.kind).toBe('pixel');
  });
  it('예외 대조와 판정', () => {
    const rules = parseExceptions({
      exceptions: [
        { id: 'EX-1', reason: '데모 표시', match: { kind: 'extra', text: 'Demo data' } },
        { id: 'EX-2', match: { kind: 'style', selector: '.ag', prop: ['font-family'] } },
        { id: 'EX-3', match: { kind: 'pixel', state: 'all-*', width: 1440 } },
        { id: 'EX-4', match: { text: '/^#\\d+$/' } },
      ],
    });
    expect(selectorsOf(rules)).toEqual(['.ag']);
    const base = { width: 1440, selectors: [] as string[], exceptions: [] as string[] };
    const ds: DiffItem[] = [
      { ...base, state: 'x', kind: 'extra', key: 'span|Demo data', text: 'Demo data' },
      { ...base, state: 'x', kind: 'style', key: 'k', prop: 'font-family', selectors: ['.ag'] },
      { ...base, state: 'x', kind: 'style', key: 'k', prop: 'color', selectors: ['.ag'] },
      { ...base, state: 'all-products', kind: 'pixel', key: 'pixel|1440' },
      { ...base, state: 'x', kind: 'missing', key: 'button|#1047', text: '#1047' },
    ];
    const out = applyExceptions(ds, rules);
    expect(out.map((d) => d.exceptions)).toEqual([['EX-1'], ['EX-2'], [], ['EX-3'], ['EX-4']]);
    const r = judge('x', [1440], out, []);
    expect(r.unexplained).toBe(1);
    expect(r.pass).toBe(false);
    expect(judge('x', [1440], out.filter((d) => d.exceptions.length), []).pass).toBe(true);
    expect(ruleMatches(rules[2], { ...ds[3], width: 1920 })).toBe(false);
    expect(() => parseExceptions([{ match: {} }])).toThrow(/id/);
  });
});

describe('report', () => {
  const rules = parseExceptions([{ id: 'EX-1', reason: '앱 전용 | 표시', match: { kind: 'extra' } }]);
  const diffs = applyExceptions(
    [
      { state: 's', width: 1440, kind: 'style', key: 'button|Send', prop: 'color', mock: 'a|b', app: 'c', selectors: [], exceptions: [] },
      { state: 's', width: 1440, kind: 'extra', key: 'span|Demo', selectors: [], exceptions: [] },
      { state: 's', width: 1440, kind: 'pixel', key: 'pixel|1440', prop: 'ratio', app: '1.20%', selectors: [], exceptions: [] },
    ],
    rules,
  );
  const r = judge('s', [1440], diffs, [{ width: 1440, ratio: 0.012, diffPixels: 12, total: 1000 }]);
  it('styles.md: 표·예외·설명 없음·0.5% 초과', () => {
    const md = stylesMd(r, rules);
    expect(md).toContain('| 1440 | `button\\|Send` | color | a\\|b | c | **설명 없음** |');
    expect(md).toContain('EX-1 (앱 전용 \\| 표시)');
    expect(md).toContain('**0.5% 초과**');
    expect(md).toContain('설명 없음 2개');
  });
  it('motion.md', () => {
    const m: MotionSnap = { animations: [{ type: 'CSSAnimation', name: 'pop', target: 'x', duration: '200', delay: '0', easing: 'ease-out', iterations: '1' }], events: [{ type: 'animationstart', name: 'pop', target: 'x' }], timers: [{ kind: 'interval', ms: 32, count: 3 }] };
    const md = motionMd('s', [{ width: 1440, mock: m, app: { animations: [], events: [], timers: [] } }], compareMotion('s', 1440, m, { animations: [], events: [], timers: [] }), []);
    expect(md).toContain('| CSSAnimation | pop | x | 200 | 0 | ease-out | 1 |');
    expect(md).toContain('interval 32ms×3');
    expect(md).toContain('## 시안과 다른 것');
    expect(md).toContain('**설명 없음**');
  });
  it('index.html: 상대 경로만 쓰고 판정을 보인다', () => {
    const html = indexHtml([r], { mock: 'm', app: 'http://localhost:3000/', generatedAt: 't', widths: [1440], states: [{ name: 's', mock: [{ role: 'button', text: 'Go' }], app: [], settleMs: 0, timers: [], changed: [] }] });
    expect(html).toContain('src="s/mock-1440.png"');
    expect(html).toContain('src="s/diff-1440.png"');
    expect(html).toContain('src="s/app-1440.webm"');
    expect(html).toContain('href="s/styles.md"');
    expect(html).not.toMatch(/(src|href)="\//);
    expect(html).toContain('실패');
    expect(html).toContain('button “Go”');
  });
  it('mdCell은 줄바꿈·파이프를 지운다', () => {
    expect(mdCell('a|b\nc')).toBe('a\\|b c');
  });
});

describe('cli·도우미', () => {
  it('parseArgs', () => {
    const a = parseArgs(['--mock', 'd', '--app', 'http://x/', '--out', 'o', '--states', 'a, b', '--widths', '1440']);
    expect(a).toMatchObject({ mock: 'd', app: 'http://x/', out: 'o', states: ['a', 'b'], widths: [1440] });
    expect(parseArgs(['--mock', 'd', '--analyze-only'])).toMatchObject({ widths: [1440, 1920], analyzeOnly: true });
    expect(() => parseArgs(['--mock', 'd'])).toThrow(/--app/);
    expect(parseArgs(['--mock', 'd', '--app', 'u']).appReady).toBeUndefined();
    expect(parseArgs(['--mock', 'd', '--app', 'u', '--app-ready', '[role=switch]']).appReady).toBe('[role=switch]');
    expect(() => parseArgs(['--mock', 'd', '--app', 'u', '--app-ready'])).toThrow(/값이 없다/);
    expect(() => parseArgs(['--bogus'])).toThrow(/모르는 인자/);
  });
  it('joinUrl·stateDir·pickVendor·padRgba', () => {
    expect(joinUrl('http://h:3000', 'today')).toBe('http://h:3000/today');
    expect(joinUrl('http://h:3000/app', undefined)).toBe('http://h:3000/app');
    expect(stateDir('/o', 'a/b c')).toBe(path.join('/o', 'a-b-c'));
    expect(pickVendor(['react.production.min.js', 'react-dom.development.js', 'support.js'])).toEqual({ react: 'react.production.min.js', reactDom: 'react-dom.development.js' });
    const p = padRgba(new Uint8Array([1, 2, 3, 4]), 1, 1, 2, 1);
    expect([...p]).toEqual([1, 2, 3, 4, 255, 0, 255, 255]);
  });
  it('staticScan은 추출 줄 번호를 원본 기준으로 낸다', () => {
    const ex = extractDc(FIXTURE);
    const info = staticScan(ex, parseTemplate(ex.template));
    const lines = FIXTURE.split('\n');
    const go = info.bindings.find((b) => b.expr === 'go')!;
    expect(lines[go.line - 1]).toContain('onClick="{{go}}"');
    const t = info.timers[0];
    expect(lines[t.line - 1]).toContain('setTimeout');
  });
});

describe('retryFind', () => {
  it('후보가 나올 때까지 다시 찾는다', async () => {
    let n = 0;
    const waits: number[] = [];
    const r = await retryFind(
      async () => ({ ok: ++n >= 3, count: n }),
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(r).toEqual({ ok: true, count: 3 });
    expect(waits).toHaveLength(2);
  });
  it('시간이 지나도 없으면 마지막 결과(ok false)를 돌려준다', async () => {
    let n = 0;
    const r = await retryFind(
      async () => ({ ok: false, count: ++n }),
      async () => undefined,
      1000,
      250,
    );
    expect(r.ok).toBe(false);
    expect(r.count).toBe(5);
  });
  it('처음부터 있으면 기다리지 않는다', async () => {
    const waits: number[] = [];
    await retryFind(
      async () => ({ ok: true }),
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(waits).toHaveLength(0);
  });
});
