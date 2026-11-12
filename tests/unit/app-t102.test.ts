/**
 * T102 단위 테스트: Today 목록 "Done today · Simulated" 묶음 (화면 상태만).
 *
 * 기대값 출처: `tasks/T102.md` "시안 동작"·"만들 것"·"완료 기준", 시안 `docs/design/mockup-v4/Desk.dc.html`
 * (secs·mkItem·`.it.done{opacity:.55}`·secBar.done `#CFD3D8`).
 * **실호출 0회** — AI·PayPal을 부르지 않는다. 개발 서버 없음 (`renderToStaticMarkup`). `.env`를 읽지 않는다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { copyKeys, copyTables, t } from '@/app/_shared/copy';
import { regroupDone, type DoneMap } from '@/app/today/done-groups';
import type { TodayGroup, TodayGroupKey, TodayItem } from '@/app/today/model';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { React?: typeof React }).React = React;

const { TodayGroupsView } = await import('@/app/today/today-groups');
const { countsAsDone } = await import('@/app/today/tracking-register');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const D1 = 'PP-R-AAA-1';
const D2 = 'PP-R-GMS-10197661';
const D3 = 'PP-R-CCC-3';

function item(id: string, group: TodayGroupKey, sku: string, kind: TodayItem['kind'] = 'dispute'): TodayItem {
  return {
    id,
    kind,
    group,
    href: `/?item=${id}`,
    name: id,
    label: null,
    sub: null,
    band: 'High',
    dot: 'high',
    status: { key: 'badge.riskHigh', tone: 'high' },
    score: 1,
    dueDate: '',
    row: { icon: 'sweater', head: id, product: null, category: null, categoryTone: 'neutral', due: null, who: null, skus: [sku] },
  };
}

const group = (key: TodayGroupKey, items: TodayItem[]): TodayGroup => ({
  key,
  title: t(`today.group.${key}`),
  hint: t(`today.groupHint.${key}`),
  items,
});

const GROUPS: TodayGroup[] = [
  group('needsYou', [item(D2, 'needsYou', 'FK-SW-NV'), item(D1, 'needsYou', 'FK-CD-OAT')]),
  group('prevent', [item('tracking', 'prevent', 'FK-CD-OAT', 'tracking')]),
  group('routine', [item(D3, 'routine', 'FK-BN-SET')]),
];

const shape = (done: DoneMap, groups = GROUPS) =>
  regroupDone(groups, done).map((g) => [g.key, g.rows.map((r) => r.item.id)]);

describe('regroupDone (순수 함수)', () => {
  it('done 없음 → 지금과 같다 (제목·힌트·항목 그대로)', () => {
    const out = regroupDone(GROUPS, {});
    expect(out.map((g) => [g.key, g.title, g.hint, g.rows.map((r) => r.item)])).toEqual(
      GROUPS.map((g) => [g.key, g.title, g.hint, g.items]),
    );
    expect(out.every((g) => g.titleKey === null && g.rows.every((r) => !r.done && !r.simulatedLabel))).toBe(true);
  });

  it('분쟁 1개 done → 원래 묶음에서 빠지고 맨 아래 done 묶음 (항목 값은 그대로)', () => {
    expect(shape({ [D2]: { simulated: true } })).toEqual([
      ['needsYou', [D1]],
      ['prevent', ['tracking']],
      ['routine', [D3]],
      ['done', [D2]],
    ]);
    const done = regroupDone(GROUPS, { [D2]: { simulated: true } }).at(-1);
    expect(done?.rows[0].item).toBe(GROUPS[0].items[0]);
    expect(done?.rows[0].done).toBe(true);
    expect(done?.hint).toBeNull();
  });

  it('원래 묶음이 비면 그 묶음은 없다', () => {
    expect(shape({ [D3]: { simulated: true }, tracking: { simulated: true } })).toEqual([
      ['needsYou', [D2, D1]],
      ['done', ['tracking', D3]],
    ]);
  });

  it('상품 거르개가 done 묶음에도 적용된다 (거른 묶음에 없는 항목은 done에도 없다)', () => {
    const filtered = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.row.skus.includes('FK-CD-OAT')) })).filter(
      (g) => g.items.length > 0,
    );
    expect(shape({ [D2]: { simulated: true }, [D1]: { simulated: true } }, filtered)).toEqual([
      ['prevent', ['tracking']],
      ['done', [D1]],
    ]);
  });

  it('모두 simulated → doneSimulated 제목, 줄별 Simulated 없음', () => {
    const done = regroupDone(GROUPS, { [D2]: { simulated: true }, tracking: { simulated: true } }).at(-1);
    expect(done?.titleKey).toBe('today.group.doneSimulated');
    expect(done?.rows.every((r) => !r.simulatedLabel)).toBe(true);
  });

  it('섞임 → done 제목 + simulated 항목 줄에만 Simulated', () => {
    const done = regroupDone(GROUPS, { [D2]: { simulated: true }, tracking: { simulated: false } }).at(-1);
    expect(done?.titleKey).toBe('today.group.done');
    expect(done?.rows.map((r) => [r.item.id, r.simulatedLabel])).toEqual([
      [D2, true],
      ['tracking', false],
    ]);
  });

  it('모두 실제 → done 제목, 줄별 Simulated 없음', () => {
    const done = regroupDone(GROUPS, { [D2]: { simulated: false } }).at(-1);
    expect(done?.titleKey).toBe('today.group.done');
    expect(done?.rows[0].simulatedLabel).toBe(false);
  });
});

describe('목록 그리기 (TodayGroupsView)', () => {
  const html = (done: DoneMap, selectedId: string | null = D2) =>
    renderToStaticMarkup(createElement(TodayGroupsView, { groups: GROUPS, done, selectedId }));

  it('done 없음: done 묶음·흐림 class가 없다', () => {
    const markup = html({});
    expect(markup).not.toContain('today-group-done');
    expect(markup).not.toContain('today-item-done');
    expect(markup).not.toContain(t('today.group.done'));
  });

  it('모두 simulated: "Done today · Simulated" 제목, 개수, 힌트 없음, 흐린 줄·회색 점, 고른 줄은 그대로', () => {
    const markup = html({ [D2]: { simulated: true } });
    expect(t('today.group.doneSimulated')).toBe('Done today · Simulated');
    const at = markup.indexOf('today-group today-group-done');
    expect(at).toBeGreaterThan(markup.indexOf('today-group-routine'));
    const done = markup.slice(at);
    expect(done).toContain(`Done today · Simulated <span class="today-group-count num">(1)</span>`);
    expect(done).not.toContain('today-group-hint');
    expect(done).toContain('class="today-item today-item-done"');
    expect(done).toContain('today-dot today-dot-done');
    expect(done).toMatch(/class="today-item today-item-done" aria-current="true"|aria-current="true"[^>]*today-item-done/);
    // T106: 항목은 링크가 아니라 화면 안 상태를 바꾸는 버튼 (눌러서 다시 볼 수 있는 것은 그대로)
    expect(done).toContain(`data-item="${D2}"`);
    // 상태 글은 엔진 값 그대로 (화면 읽기용)
    expect(done).toContain(t('badge.riskHigh'));
    expect(done).not.toContain('today-item-simulated');
  });

  it('섞임: "Done today" 제목 + simulated 줄에만 작은 Simulated', () => {
    const markup = html({ [D2]: { simulated: true }, tracking: { simulated: false } });
    const done = markup.slice(markup.indexOf('today-group today-group-done'));
    expect(done).toContain(`Done today <span class="today-group-count num">(2)</span>`);
    expect(done.match(/today-item-simulated/g)?.length).toBe(1);
    expect(done).toContain(`<span class="today-item-simulated">${t('case.progress.simulated')}</span>`);
  });

  it('css: 흐림 .55 · 점·막대 #CFD3D8 (--color-line)', () => {
    const css = read('src/app/today/today.css');
    expect(css).toMatch(/\.today-item-done\s*\{\s*opacity:\s*0?\.55;/);
    expect(css).toMatch(/\.today-dot-done\s*\{\s*background:\s*var\(--color-line\);/);
    expect(css).toMatch(/\.today-group-done \.today-group-bar\s*\{\s*background:\s*var\(--color-line\);/);
    expect(read('src/app/globals.css')).toMatch(/--color-line:\s*#cfd3d8;/i);
  });
});

describe('켜는 곳 (성공할 때만)', () => {
  it('답장 칸: markDone은 next.ok일 때만, simulated = mode가 simulated', () => {
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    const calls = src.match(/\bmarkDone\(/g) ?? [];
    expect(calls.length).toBe(1);
    // T104 F5-29: 한 곳(completeAction)에서만. 제안은 성공(next.ok) 순간, 메시지는 Send 뒤 칸 마지막 단계(onFinish) 때.
    // 둘 다 성공한 보내기 뒤에만 오고, simulated = 그 보내기의 mode
    expect(src).toMatch(/function completeAction\(simulated: boolean, amount: string \| null\) \{\s*report\(amount\);\s*markDone\(disputeId, \{ simulated \}\);/);
    expect(src).toMatch(/if \(next\.ok && kind === 'offer'\) completeAction\(next\.mode === 'simulated', savings\);/);
    expect(src).toMatch(/onFinish=\{\(out\) => \{\s*completeAction\(outcome\.mode === 'simulated'/);
    // onFinish는 성공한 보내기 뒤 칸에만 있다
    const progress = src.slice(src.indexOf("if (sendState === 'done' && outcome !== null && outcome.ok)"));
    expect(progress.indexOf('<CaseProgress')).toBeGreaterThan(-1);
    // 실패·확인 취소 경로(return 앞)에는 없다
    const cancel = src.slice(src.indexOf("if (view.mode === 'live' && !window.confirm"), src.indexOf('let next: SendOutcome'));
    expect(cancel).not.toContain('markDone');
  });

  it('추적 등록: countsAsDone(added·simulated)일 때만, dry run은 simulated', () => {
    const src = strip(read('src/app/today/tracking-register.tsx'));
    expect(src).toMatch(
      /if \(countsAsDone\(next\.kind\)\) \{\s*report\(savings\);\s*if \(doneId !== null\) markDone\(doneId, \{ simulated: next\.kind === 'simulated' \}\);\s*\}/,
    );
    for (const kind of ['failed', 'nothing', 'unavailable', 'error'] as const) expect(countsAsDone(kind)).toBe(false);
    expect(strip(read('src/app/today/tracking-detail.tsx'))).toContain('doneId={TRACKING_ITEM_ID}');
  });
});

describe('화면 상태만 (정적 검사)', () => {
  const files = ['src/app/today/done-groups.ts', 'src/app/today/today-groups.tsx', 'src/app/today/savings.tsx'];

  it('새 코드에 fetch·서버 액션·PayPal 호출이 없다', () => {
    for (const file of files) {
      const code = strip(read(file));
      expect(code, file).not.toMatch(/fetch\(|'use server'|actions'|sendReplyAction|addTrackingAction|api-m\.|_server\//);
    }
  });

  it('묶기는 항목 값을 바꾸지 않는다 (상태·위험·숫자 필드를 쓰지 않는다)', () => {
    const code = strip(read('src/app/today/done-groups.ts'));
    expect(code).not.toMatch(/\b(status|band|score|dot)\s*:/);
  });
});

describe('문구', () => {
  it('en/ko 키 집합이 같다 + 새 키', () => {
    expect(copyKeys(copyTables.ko)).toEqual(copyKeys(copyTables.en));
    expect(copyTables.en['today.group.done']).toBe('Done today');
    expect(copyTables.ko['today.group.done']).toBe('오늘 완료');
    expect(copyTables.ko['today.group.doneSimulated']).toBe('오늘 완료 · 시뮬레이션');
  });
});
