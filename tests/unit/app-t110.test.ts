/**
 * T110: Desk 그림 비교 1차 후속 — 정적 시험 (레이아웃 값은 컨트롤 타워가 그림으로 다시 비교한다).
 *  1. 이번 주 카드 머리: 오른쪽에는 AI 알약 하나, Demo data 배지는 부제 줄(`.weekly-sub-row`) 안.
 *  2. desk.css 3부 규칙: 막대 높이·숫자 폭·배지 높이·항목 번호 꺾임 없음·곡선 카드 간격·선택지 숫자 줄.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { weeklyView } from '@/app/today/model';

(globalThis as { React?: typeof React }).React = React;
const { WeeklyCard } = await import('@/app/today/today-list');

const ROOT = path.resolve(__dirname, '../..');
const DESK = readFileSync(path.join(ROOT, 'src/app/(app)/desk.css'), 'utf8');

describe('T110 이번 주 카드 머리', () => {
  it('Demo data는 부제 줄 안, 오른쪽은 AI 알약 하나', () => {
    const html = renderToStaticMarkup(createElement(WeeklyCard, { weekly: weeklyView(3, null, true) }));
    const subRow = /<span class="weekly-sub-row">(.*?)<\/span><\/div>/.exec(html)?.[1] ?? '';
    expect(subRow).toContain('weekly-sub');
    expect(subRow).toContain('badge');
    const end = /<span class="weekly-head-end">(.*?)<\/span><\/div><div class="weekly-grid"/.exec(html)?.[1] ?? '';
    expect(end).not.toContain('badge');
    expect(end).toContain('ai-pill');
  });

  it('시드가 없으면 Demo data 배지 없음', () => {
    const html = renderToStaticMarkup(createElement(WeeklyCard, { weekly: weeklyView(3, null, false) }));
    expect(html).not.toContain('badge-');
  });
});

describe('T110 desk.css 3부', () => {
  it.each([
    'body:has(.dk) .shell-actions{margin-block:-4px}',
    '.dk .num{font-variant-numeric:normal}',
    '.dk .weekly-value,.dk .today-item-name,.dk .history-date,.dk .curve-headline{font-variant-numeric:tabular-nums}',
    '.dk .badge{line-height:16px}',
    '.dk .weekly-title{white-space:nowrap}',
    '.dk .today-item-name{white-space:nowrap;flex-shrink:0}',
    '.dk .case-head+.curve-card{margin-top:-4px}',
    '.dk .choice-numbers{line-height:1.5}',
  ])('%s', (rule) => {
    expect(DESK).toContain(rule);
  });

  it('숫자 폭 되돌리기는 `.dk .num` 뒤에 온다 (같은 명시도 — 뒤가 이긴다)', () => {
    expect(DESK.indexOf('.dk .weekly-value,.dk .today-item-name')).toBeGreaterThan(DESK.indexOf('.dk .num{'));
  });
});
