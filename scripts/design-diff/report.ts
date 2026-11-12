// states.md · styles.md · motion.md · index.html 만들기 (순수 함수)
import type { Analysis } from './analyze';
import { PIXEL_LIMIT } from './compare';
import type { ClickStep, DiffItem, ExceptionRule, MotionSnap, StateDef, StateResult } from './types';

export function mdCell(s: unknown): string {
  return String(s ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .slice(0, 160);
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function stepText(s: ClickStep): string {
  if (s.selector) return `\`${s.selector}\`${s.nth ? ` #${s.nth + 1}` : ''}`;
  return `${s.role ?? '?'} “${s.text ?? ''}”${s.contains ? ' (포함)' : ''}${s.nth ? ` #${s.nth + 1}` : ''}`;
}

export function statesMd(a: Analysis): string {
  const L: string[] = [];
  const f = a.file;
  L.push(`# 상태 목록 (자동 생성)`, '');
  L.push(`- 시안: \`${f.source}\``, `- 만든 때: ${f.generatedAt}`, `- 상태 ${f.states.length}개${a.truncated ? ' (상한에 걸려 잘림 — `--max-states`를 올리세요)' : ''}`);
  L.push(`- 사람이 고칠 곳: \`states.json\` (상태 이름 → \`mock\` 시안 클릭 단계 / \`app\` 앱 클릭 단계: role·text·selector·nth·contains·waitMs, \`appPath\`)`, '');
  L.push('## 상태', '', '| # | 이름 | 클릭 순서 | 마지막 클릭 뒤 타이머 | 바뀐 state |', '|---|---|---|---|---|');
  f.states.forEach((s, i) => {
    const t = s.timers.map((x) => `${x.kind} ${x.ms}ms×${x.count}`).join(', ');
    L.push(`| ${i + 1} | \`${s.name}\` | ${mdCell(s.mock.map(stepText).join(' → ') || '(처음 화면)')} | ${mdCell(t || '—')}${s.settleMs ? ` (끝까지 ${s.settleMs}ms)` : ''} | ${mdCell(s.changed.join(', ') || '—')} |`);
  });
  L.push('', '## 정적 분석', '', '### 템플릿 이벤트 바인딩', '', '| 줄 | 이벤트 | 핸들러 | 태그 | 위치(sc-for/sc-if) | 탐색에서 눌림 |', '|---|---|---|---|---|---|');
  for (const b of a.info.bindings) {
    const pressed = b.event.toLowerCase() === 'onclick' ? (a.pressed.has(b.expr) ? '예' : '**아니오**') : '해당 없음(입력)';
    L.push(`| ${b.line} | ${b.event} | \`${mdCell(b.expr)}\` | ${b.tag} | ${mdCell(b.context.join(' › ') || '—')} | ${pressed} |`);
  }
  const unpressed = a.info.bindings.filter((b) => b.event.toLowerCase() === 'onclick' && !a.pressed.has(b.expr));
  L.push('', unpressed.length ? `> 탐색에서 한 번도 못 누른 onClick ${unpressed.length}개: 조건이 깊거나 입력이 필요하다. \`states.json\`에 손으로 더하세요.` : '> 모든 onClick 바인딩을 탐색에서 적어도 한 번 눌렀다.');
  L.push('', '### setState를 부르는 메서드·핸들러', '', '| 줄 | 이름 | 바꾸는 키 | 부르는 메서드 |', '|---|---|---|---|');
  for (const h of a.info.handlers) L.push(`| ${h.line} | \`${h.name}\` | ${mdCell(h.setsKeys.join(', ') || '—')} | ${mdCell(h.calls.join(', ') || '—')} |`);
  L.push('', '### 타이머', '', '| 줄 | 호출 | 간격 식 | 들어 있는 메서드 |', '|---|---|---|---|');
  for (const t of a.info.timers) L.push(`| ${t.line} | ${t.call} | \`${mdCell(t.delay)}\` | ${t.inside || '—'} |`);
  L.push('', '> 글자 입력(onChange/onInput)으로만 가는 상태는 자동 탐색하지 않는다.', '');
  return L.join('\n');
}

function exCell(d: DiffItem, rules: Map<string, ExceptionRule>): string {
  if (!d.exceptions.length) return '**설명 없음**';
  return d.exceptions.map((id) => `${id}${rules.get(id)?.reason ? ` (${mdCell(rules.get(id)?.reason)})` : ''}`).join(', ');
}

export function stylesMd(r: StateResult, rules: ExceptionRule[]): string {
  const rm = new Map(rules.map((x) => [x.id, x]));
  const L: string[] = [`# ${r.state} · 계산된 스타일·픽셀`, ''];
  for (const p of r.pixels) {
    const over = p.ratio > PIXEL_LIMIT;
    L.push(`- ${p.width}px 픽셀 차이 ${(p.ratio * 100).toFixed(3)}% (${p.diffPixels}/${p.total})${over ? ' — **0.5% 초과**' : ''}`);
  }
  const ds = r.diffs.filter((d) => d.kind !== 'motion');
  L.push(`- 차이 ${ds.length}개 · 설명 없음 ${ds.filter((d) => !d.exceptions.length).length}개`, '');
  const pix = ds.filter((d) => d.kind === 'pixel' || d.kind === 'repro');
  if (pix.length) {
    L.push('## 픽셀 0.5% 초과·재현 실패', '', '| 폭 | 항목 | 값 | 원인(예외) |', '|---|---|---|---|');
    for (const d of pix) L.push(`| ${d.width} | ${d.kind} | ${mdCell(d.app || d.mock)} | ${exCell(d, rm)} |`);
    L.push('');
  }
  const st = ds.filter((d) => d.kind === 'style');
  L.push('## 다른 스타일', '');
  if (!st.length) L.push('없음', '');
  else {
    L.push('| 폭 | 요소 | 항목 | 시안 | 앱 | 예외 |', '|---|---|---|---|---|---|');
    for (const d of st) L.push(`| ${d.width} | \`${mdCell(d.key)}\` | ${d.prop} | ${mdCell(d.mock)} | ${mdCell(d.app)} | ${exCell(d, rm)} |`);
    L.push('');
  }
  const mx = ds.filter((d) => d.kind === 'missing' || d.kind === 'extra');
  L.push('## 짝이 없는 요소', '');
  if (!mx.length) L.push('없음', '');
  else {
    L.push('| 폭 | 쪽 | 요소 | 예외 |', '|---|---|---|---|');
    for (const d of mx) L.push(`| ${d.width} | ${d.kind === 'missing' ? '시안에만' : '앱에만'} | \`${mdCell(d.key)}\` | ${exCell(d, rm)} |`);
    L.push('');
  }
  return L.join('\n');
}

export function motionMd(state: string, byWidth: { width: number; mock: MotionSnap; app: MotionSnap }[], diffs: DiffItem[], rules: ExceptionRule[]): string {
  const rm = new Map(rules.map((x) => [x.id, x]));
  const L: string[] = [`# ${state} · 모션`, ''];
  for (const w of byWidth) {
    L.push(`## ${w.width}px`, '');
    for (const side of ['mock', 'app'] as const) {
      const m = w[side];
      L.push(`### ${side === 'mock' ? '시안' : '앱'}`, '', '| 종류 | 이름 | 대상 | duration | delay | easing | iterations |', '|---|---|---|---|---|---|---|');
      if (!m.animations.length) L.push('| — | — | — | — | — | — | — |');
      for (const a of m.animations) L.push(`| ${a.type} | ${mdCell(a.name)} | ${mdCell(a.target)} | ${a.duration} | ${a.delay} | ${mdCell(a.easing)} | ${a.iterations} |`);
      const t = m.timers.filter((x) => x.ms >= 16);
      L.push('', `타이머 간격: ${t.length ? t.map((x) => `${x.kind} ${x.ms}ms×${x.count}`).join(', ') : '없음'}`);
      const ev = new Map<string, number>();
      for (const e of m.events) ev.set(`${e.type} ${e.name} @ ${e.target}`, (ev.get(`${e.type} ${e.name} @ ${e.target}`) ?? 0) + 1);
      L.push(`이벤트 ${m.events.length}개${ev.size ? ': ' + [...ev].slice(0, 12).map(([k, n]) => `${mdCell(k)}×${n}`).join('; ') : ''}`, '');
    }
  }
  const md = diffs.filter((d) => d.kind === 'motion');
  L.push('## 시안과 다른 것', '');
  if (!md.length) L.push('없음', '');
  else {
    L.push('| 폭 | 대상 | 항목 | 시안 | 앱 | 예외 |', '|---|---|---|---|---|---|');
    for (const d of md) L.push(`| ${d.width} | ${mdCell(d.text || d.key)} | ${mdCell(d.prop)} | ${mdCell(d.mock)} | ${mdCell(d.app)} | ${exCell(d, rm)} |`);
    L.push('');
  }
  L.push('> 앱에만 있는 타이머(프레임워크 내부)는 차이로 세지 않는다. 시안 타이머 간격이 앱에 없을 때만 센다.', '');
  return L.join('\n');
}

export interface IndexMeta {
  mock: string;
  app: string;
  generatedAt: string;
  widths: number[];
  states: StateDef[];
}

/** 사람용 한 장. 모든 경로는 상대 경로라 폴더째 옮겨도 열린다 */
export function indexHtml(results: StateResult[], meta: IndexMeta): string {
  const enc = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  const total = results.reduce((n, r) => n + r.unexplained, 0);
  const passN = results.filter((r) => r.pass).length;
  const rows = results
    .map((r) => {
      const px = meta.widths.map((w) => {
        const p = r.pixels.find((x) => x.width === w);
        return `<td class="${p && p.ratio > PIXEL_LIMIT ? 'bad' : ''}">${p ? (p.ratio * 100).toFixed(2) + '%' : '—'}</td>`;
      });
      return `<tr><td><a href="#${esc(r.state)}">${esc(r.state)}</a></td><td>${r.diffs.length}</td><td class="${r.unexplained ? 'bad' : 'ok'}">${r.unexplained}</td>${px.join('')}<td class="${r.pass ? 'ok' : 'bad'}">${r.pass ? '통과' : '실패'}</td></tr>`;
    })
    .join('\n');
  const sections = results
    .map((r) => {
      const def = meta.states.find((s) => s.name === r.state);
      const steps = def ? def.mock.map(stepText).join(' → ') || '(처음 화면)' : '';
      const d = enc(r.state);
      const widths = meta.widths
        .map(
          (w) => `<h4>${w}px</h4>
<div class="trio">
<figure><figcaption>시안</figcaption><a href="${d}/mock-${w}.png"><img loading="lazy" src="${d}/mock-${w}.png" alt="시안 ${w}"></a></figure>
<figure><figcaption>앱</figcaption><a href="${d}/app-${w}.png"><img loading="lazy" src="${d}/app-${w}.png" alt="앱 ${w}"></a></figure>
<figure><figcaption>차이 (빨강)</figcaption><a href="${d}/diff-${w}.png"><img loading="lazy" src="${d}/diff-${w}.png" alt="차이 ${w}"></a></figure>
</div>
<div class="duo">
<figure><figcaption>시안 녹화</figcaption><video controls muted preload="none" src="${d}/mock-${w}.webm"></video></figure>
<figure><figcaption>앱 녹화</figcaption><video controls muted preload="none" src="${d}/app-${w}.webm"></video></figure>
</div>`,
        )
        .join('\n');
      return `<section id="${esc(r.state)}">
<h3>${esc(r.state)} <span class="${r.pass ? 'ok' : 'bad'}">${r.pass ? '통과' : '실패'}</span></h3>
<p class="sub">${esc(steps)} · 차이 ${r.diffs.length} · 설명 없음 ${r.unexplained} · <a href="${d}/styles.md">styles.md</a> · <a href="${d}/motion.md">motion.md</a></p>
${widths}
</section>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design diff</title>
<style>
:root{--bg:#fff;--fg:#111;--mut:#666;--line:#ddd;--ok:#0a7a3b;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#121212;--fg:#eee;--mut:#aaa;--line:#333;--ok:#5fd38d;--bad:#ff8a80}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
table{border-collapse:collapse;margin:8px 0 24px}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left}
.ok{color:var(--ok);font-weight:700}.bad{color:var(--bad);font-weight:700}.sub{color:var(--mut)}
.trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.duo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}
figure{margin:0;min-width:0}figcaption{font-weight:700;margin-bottom:4px}img,video{width:100%;height:auto;border:1px solid var(--line);display:block}
section{border-top:2px solid var(--line);padding-top:12px;margin-top:24px}
@media (max-width:700px){.trio,.duo{grid-template-columns:1fr}}
</style></head><body>
<h1>시안 ↔ 앱 자동 비교</h1>
<p class="sub">시안 ${esc(meta.mock)} · 앱 ${esc(meta.app)} · ${esc(meta.generatedAt)} · 폭 ${meta.widths.join(', ')}</p>
<p><b>상태 ${results.length}개 · 통과 ${passN} · 설명 없는 차이 합계 <span class="${total ? 'bad' : 'ok'}">${total}</span></b> (판정: 설명 없는 차이 0, 픽셀 상태당 ≤${PIXEL_LIMIT * 100}%)</p>
<p><a href="states.md">states.md</a> · <a href="states.json">states.json</a> · <a href="summary.json">summary.json</a></p>
<table><thead><tr><th>상태</th><th>차이</th><th>설명 없음</th>${meta.widths.map((w) => `<th>픽셀 ${w}</th>`).join('')}<th>판정</th></tr></thead><tbody>
${rows}
</tbody></table>
${sections}
</body></html>
`;
}
