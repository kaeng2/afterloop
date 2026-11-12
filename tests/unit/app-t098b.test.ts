/**
 * T098b 단위 테스트: 시안 맞추기 마무리 — Desk + 넘겨받은 것.
 *
 * 기대값 출처: `tasks/T098.md` T098b "만들 것" ①②③, 시안 `docs/design/mockup-v4/Desk.dc.html`
 * (`send()`·liveP·`curve.dash`·`toast()`·`.toast`·CSS 그림자), DECISIONS 2026-11-11 22:55.
 * **실호출 0회**, 개발 서버 없음 (`renderToStaticMarkup`). 숫자는 엔진 `scenarioRisk` 결과와 비교만 한다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { toPercentRounded } from '@/app/_shared/percent';
import { scenarioRisk } from '@/engine/forecast';
import type { BoardState, RiskPoint, ScenarioPoint } from '@/types';

import { cause } from '../acceptance/boards';

vi.mock('server-only', () => ({}));
(globalThis as { React?: typeof React }).React = React;

const { curveView } = await import('@/app/cases/desk-model');
const { RiskCurveGraphic } = await import('@/app/cases/view/risk-curve');
const model = await import('@/app/cases/progress/progress-model');
const client = await import('@/app/cases/progress/progress-client');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const HISTORY: RiskPoint[] = [
  { at: '2026-10-19T00:00:00Z', kind: 'order_paid', pChargeback: 0.05 },
  { at: '2026-10-28T00:00:00Z', kind: 'buyer_message', pChargeback: 0.22 },
  { at: '2026-11-09T00:00:00Z', kind: 'buyer_message', pChargeback: 0.89 },
];

const BOARD: BoardState = {
  disputeId: 'PP-R-TEST-T098B',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:00:00Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  hasTracking: true,
  hasDeliveredTracking: false,
  buyerPriorInrDisputes: 0,
  isDemo: false,
  cause: cause('A2', 1, 'rule'),
};
const ANCHOR =
  'Hello Seo-yeon, sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. ' +
  'Reply with it and I will pass it to the carrier right away. I will check with the carrier and contact you again by November 17.';

/** 엔진 값 (T092 시험과 같은 입력). 화면이 이 값을 그대로 옮기는지만 본다. */
function enginePoints(): ScenarioPoint[] {
  const signals = { mentionsCardCompany: true, secondMessageUnanswered: true, unansweredOver24h: true, angryTone: true, hoursToDue: 400 };
  const points = scenarioRisk(
    { text: ANCHOR, anchorText: ANCHOR, board: BOARD, signals, delayDays: 1, translated: true },
    [...client.SCENARIO_STEPS],
  );
  expect(points.map((point) => point.step)).toEqual(['sent', 'buyer_reply', 'forwarded', 'cleared']);
  return points;
}

describe('T098b ①: Send 뒤 단계마다 곡선에 점이 하나씩 늘어난다 (scenarioRisk 값)', () => {
  it('riskTrail = 보인 단계의 엔진 값 순서 그대로 (shown 1→4에 1→4개)', () => {
    const points = enginePoints();
    const states = [
      { shown: 1, typing: true },
      { shown: 2, typing: false },
      { shown: 3, typing: false },
      { shown: 4, typing: false },
    ] as const;
    states.forEach((state, index) => {
      const trail = model.riskTrail(state, points);
      expect(trail).toEqual(points.slice(0, index + 1).map((point) => point.pChargeback));
      expect(model.currentRisk(state, points)).toBe(points[index].pChargeback);
    });
    expect(model.riskTrail({ shown: 4, typing: false }, null)).toEqual([]);
  });

  it('curveView: trail이 있으면 보낸 답장 점 + 단계 점(칸의 0.8배 간격), 실선, 큰 % = 마지막 엔진 값', () => {
    const points = enginePoints();
    const before = curveView(HISTORY, points[0].pChargeback);
    expect(before?.sent).toBe(false);
    expect(before?.steps).toEqual([]);
    for (let shown = 1; shown <= 4; shown += 1) {
      const trail = points.slice(0, shown).map((point) => point.pChargeback);
      const curve = curveView(HISTORY, points[0].pChargeback, trail);
      expect(curve?.sent).toBe(true);
      expect(curve?.steps).toHaveLength(shown - 1);
      expect(curve?.headline).toBe(toPercentRounded(trail[trail.length - 1]));
      expect(curve?.headlineKey).toBe('case.curve.now');
      // 점은 오른쪽으로만 늘고 그림 상자를 넘지 않는다
      const xs = [curve!.dots[curve!.dots.length - 1].x, curve!.draft!.x, ...curve!.steps.map((step) => step.x)];
      for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
      expect(xs[xs.length - 1]).toBeLessThanOrEqual(640);
      if (shown >= 3) {
        const slot = curve!.draft!.x - curve!.dots[curve!.dots.length - 1].x;
        expect(Math.abs(curve!.steps[1].x - curve!.steps[0].x - slot * 0.8)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('그림: 단계 점 circle이 늘고, Send 뒤 선은 실선 클래스 (시안 curve.dash 0), 물결 원은 마지막 점에', () => {
    const points = enginePoints();
    const trail = points.map((point) => point.pChargeback);
    const curve = curveView(HISTORY, trail[0], trail)!;
    const markup = renderToStaticMarkup(createElement(RiskCurveGraphic, { curve }));
    expect(markup.match(/curve-dot-step/g) ?? []).toHaveLength(3);
    expect(markup).toContain('class="curve-draft curve-draft-sent"');
    const last = curve.steps[curve.steps.length - 1];
    expect(markup).toMatch(new RegExp(`class="curve-ping" cx="${last.x}" cy="${last.y}"`));
    expect(strip(read('src/app/cases/view/case.css'))).toMatch(/\.curve-draft-sent\s*\{\s*stroke-dasharray:\s*none;/);
    const before = renderToStaticMarkup(createElement(RiskCurveGraphic, { curve: curveView(HISTORY, trail[0])! }));
    expect(before).not.toContain('curve-draft-sent');
    expect(before).not.toContain('curve-dot-step');
  });

  it('진행 칸이 곡선에 trail을 넘기고, 떠날 때 비운다 (값을 만들지 않는다)', () => {
    const src = strip(read('src/app/cases/progress/case-progress.tsx'));
    // T104: 분기(outcome)도 넘긴다 (refund·cb는 보낸 답장 점 하나)
    expect(src).toMatch(/useMemo\(\(\) => riskTrail\(state, points, outcome\), \[state, points, outcome\]\)/);
    expect(src).toMatch(/setTrail\(trail\)/);
    expect(src).toMatch(/setTrail\(\[\]\)/);
  });
});

describe('T098b ②: 움직임 줄이기여도 토스트는 3초 보인다 (애니메이션만 끈다)', () => {
  it('토스트 숨김 타이머는 prefers-reduced-motion을 보지 않고 config hideMs(3000)를 그대로 쓴다', () => {
    // T104 F5-25: Send 뒤 토스트는 한 번만 — 진행 칸은 자기 토스트를 띄우지 않고 마지막 단계 때 Today 토스트(savings.tsx)를 부른다
    const src = strip(read('src/app/cases/progress/case-progress.tsx'));
    expect(src).not.toMatch(/setToast|cprog-toast/);
    expect(src).toMatch(/finishRef\.current\?\.\(outcome\)/);
    expect(model.progressMotion().toast.hideMs).toBe(3000);
    // Today 토스트(savings.tsx)도 같은 3초, 줄이기 분기 없음
    const savings = strip(read('src/app/today/savings.tsx'));
    expect(savings).toMatch(/setTimeout\(\(\) => setToast\(null\), toastDurationMs\(\)\)/);
    expect(savings).not.toMatch(/prefersReducedMotion/);
    // 애니메이션은 globals.css 줄이기 규칙이 끈다
    expect(strip(read('src/app/globals.css'))).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
  });
});

describe('T098b ③: 시안 그림자·색 값 그대로 (outline·테두리 대체 되돌림)', () => {
  const globals = strip(read('src/app/globals.css'));
  const val = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(globals)?.[1].trim();

  it('그림자 변수 = 시안 값', () => {
    expect(val('--shadow-ai')).toBe('rgba(0, 102, 245, 0.35) 0 2px 8px');
    expect(val('--shadow-row-on')).toBe('inset 4px 0 0 #0066f5');
    expect(val('--shadow-bubble')).toBe('rgba(0, 0, 0, 0.05) 0 1px 3px');
    expect(val('--shadow-work')).toBe('rgba(0, 41, 145, 0.1) 0 10px 32px, rgba(0, 0, 0, 0.05) 0 2px 6px');
    expect(val('--shadow-focus')).toBe('#ffffff 0 0 0 2px');
    expect(val('--shadow-hairline')).toBe('inset 0 0 0 1px #e4e6e9');
    expect(val('--shadow-ghost')).toBe('inset 0 0 0 2px #e8796b');
    expect(val('--shadow-toast')).toBe('rgba(0, 0, 0, 0.25) 0 8px 24px');
  });

  it('색 변수 = 시안 값 (b-tint·hover·focus·sub·zone·곡선 면·이번 주 칸)', () => {
    expect(val('--color-tint')).toBe('#05378214');
    expect(val('--color-tint-hover')).toBe('#05378227');
    expect(val('--color-ink-hover')).toBe('#333333');
    expect(val('--color-focus')).toBe('#097ff5');
    expect(val('--color-sub')).toBe('#6c7378');
    expect(val('--color-row-hover')).toBe('#f5f7fb');
    expect(val('--color-zone')).toBe('#eef1f5');
    expect(val('--color-curve-area')).toBe('rgba(196, 50, 31, 0.08)');
    expect(val('--color-on-accent-cell')).toBe('rgba(255, 255, 255, 0.08)');
  });

  it('시안 자리마다 그 변수를 쓴다', () => {
    const rule = (file: string, selector: string) => {
      const css = strip(read(file));
      const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    };
    expect(rule('src/app/_shared/shell.css', '.desk-button-tint')).toContain('var(--color-tint)');
    expect(rule('src/app/_shared/shell.css', '.desk-button-tint:hover')).toContain('var(--color-tint-hover)');
    expect(rule('src/app/cases/reply/reply.css', '.reply-button:hover:not(:disabled)')).toContain('var(--color-ink-hover)');
    expect(rule('src/app/cases/reply/reply.css', '.reply-button:disabled')).toContain('opacity: 0.45');
    expect(rule('src/app/today/today.css', '.today-item:hover')).toContain('var(--color-row-hover)');
    expect(rule('src/app/cases/view/case.css', '.curve-area')).toContain('var(--color-curve-area)');
    expect(rule('src/app/cases/view/case.css', '.work-head > .ai-pill')).toContain('var(--shadow-ai)');
    expect(rule('src/app/cases/view/case.css', '.history-summary')).toContain('var(--color-accent-pale)');
    expect(rule('src/app/cases/reply/reply.css', '.reply-details-toggle:focus-visible')).toContain('var(--color-focus)');
    // 시안에 없는 회색(#5a5e66)을 Desk 화면 css에서 쓰지 않는다
    for (const file of ['src/app/today/today.css', 'src/app/cases/view/case.css', 'src/app/cases/reply/reply.css']) {
      expect(strip(read(file)), file).not.toContain('var(--color-muted)');
    }
  });
});
