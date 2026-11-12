/**
 * T118: 3차 리뷰 작은 것 3개 (알약 가림, Mike Demo data 배지, 빈 Respond now 머리).
 * 실제 AI·PayPal 호출 없음.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { t } from '@/app/_shared/copy';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
const sentFlag = vi.hoisted(() => ({ value: false }));
vi.mock('@/app/cases/view/sent-state', () => ({ useSent: () => ({ sent: sentFlag.value, setSent: () => {} }) }));
(globalThis as { React?: typeof React }).React = React;

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const px = (value: string) => value.split(/\s+/).map((part) => Number.parseFloat(part));

const { WorkZone } = await import('@/app/cases/view/work-zone');
const { WorkCard } = await import('@/app/today/work-card');
const { Badge } = await import('@/app/_shared/badges');

describe('1. 알약이 답장 글을 덮지 않는다 (시안 L58 padding 14/16/46 · L840 bottom 12px)', () => {
  const css = strip(read('src/app/cases/reply/reply.css'));
  const field = css.match(/\.reply-editor-field \{([^}]*)\}/)?.[1] ?? '';
  const area = css.match(/\.reply-textarea \{([^}]*)\}/)?.[1] ?? '';

  it('아래 여백은 스크롤되지 않는 칸 쪽에 있고, 합은 시안 46px 그대로', () => {
    const fieldBottom = Number.parseFloat(field.match(/padding-bottom: ([\d.]+)px/)?.[1] ?? 'NaN');
    const [top, side, areaBottom] = px(area.match(/padding: ([^;]+);/)?.[1] ?? '');
    expect(top).toBe(14);
    expect(side).toBe(16);
    expect(fieldBottom + (areaBottom ?? Number.NaN)).toBe(46);
    expect(field).toMatch(/position: relative;/);
  });

  it('알약 위 끝(bottom 12 + 4 + 13px×1.5 + 4 = 39.5px)이 스크롤되지 않는 여백 안에 있다 → 글자와 겹치지 않음', () => {
    const fieldBottom = Number.parseFloat(field.match(/padding-bottom: ([\d.]+)px/)?.[1] ?? 'NaN');
    const desk = read('src/app/(app)/desk.css');
    expect(desk).toMatch(/\.dk \.reply-editor-pill\{right:12px;bottom:12px;padding:4px 12px;[^}]*font-size:13px/);
    // 알약은 줄 높이를 물려받는다 (.dk line-height 1.5, 알약 규칙에 line-height 없음)
    expect(desk).toMatch(/\.dk\{[^}]*line-height:1\.5\}/);
    expect(desk.match(/\.dk \.reply-editor-pill\{([^}]*)\}/)?.[1]).not.toMatch(/line-height/);
    const pillTop = 12 + 4 + 13 * 1.5 + 4;
    expect(pillTop).toBeLessThanOrEqual(fieldBottom);
  });
});

describe('2. Mike 주장 줄에 Demo data 배지', () => {
  it('routine-detail이 상태 문장 옆에 기존 Badge kind="demo"를 단다 (두 화면 모두)', () => {
    const code = strip(read('src/app/cases/routine-detail.tsx'));
    expect(code).toMatch(/\{line\} <Badge kind="demo" \/>/);
    expect(code).toMatch(/body=\{claim\}/);
    expect(code).toMatch(/<p className="case-summary-text">\{claim\}<\/p>/);
  });

  it('그린 카드에 Mike 문장과 다른 곳과 같은 모양의 배지가 함께 나온다', () => {
    const line = t('case.routine.F1.delivered', { ordinal: '3rd' });
    const markup = renderToStaticMarkup(
      createElement(WorkCard, {
        titleId: 'r',
        ai: false,
        title: 'Status',
        body: createElement(React.Fragment, null, line, ' ', createElement(Badge, { kind: 'demo' })),
      }),
    );
    const badge = renderToStaticMarkup(createElement(Badge, { kind: 'demo' }));
    expect(markup).toContain("3rd &#x27;not received&#x27; claim in 90 days with a delivery record");
    expect(markup).toContain(badge);
  });
});

describe('3. Send 뒤 빈 "Respond now" 머리 숨김', () => {
  // T122a: 머리는 WorkZone이 그린다 ("Your reply" + 부제 + "✦ AI Respond now" 스위치). 공급자 없음 = 켜짐
  const render = () => renderToStaticMarkup(createElement(WorkZone, { titleId: 'work-title' }, 'x'));

  it('보내기 전: 머리가 나온다', () => {
    sentFlag.value = false;
    const markup = render();
    expect(markup).toMatch(new RegExp(`^<section class="work zone-work" aria-label="${t('case.work.title')}"><div class="work-head">`));
    expect(markup).toContain(`<h2 class="desk-card-title" id="work-title">${t('case.reply.title')}</h2>`);
    expect(markup).toContain('role="switch" aria-checked="true"');
    expect(markup).toMatch(/<\/div>x<\/section>$/);
  });

  it('보낸 뒤: 머리 없이 "Case progress" 칸만', () => {
    sentFlag.value = true;
    expect(render()).toBe(`<section class="work zone-work" aria-label="${t('case.progress.zone')}">x</section>`);
    sentFlag.value = false;
  });

  it('두 상태 모두 children이 같은 자리 (section 하나, head 자리는 null로 유지) → Send 때 다시 마운트되지 않음', () => {
    const code = strip(read('src/app/cases/view/work-zone.tsx'));
    expect(code.match(/<section\b/g)).toHaveLength(1);
    // T122a: 머리 자리 → 선택지 카드 자리(꺼짐이면 null) → children. 스위치를 바꿔도 children 자리는 그대로
    expect(code).toMatch(/\{aiOn \? ai : null\}\s*\{children\}/);
    expect(code).toMatch(/\{sent \? null : \(/);
    expect(code).not.toMatch(/return sent \?/);
    expect(code).not.toMatch(/return aiOn \?/);
  });

  it('Desk 화면이 선택지 카드를 ai 자리로 넘긴다 (답장 칸은 children)', () => {
    const view = strip(read('src/app/cases/view/case-view.tsx'));
    expect(view).toMatch(/<WorkZone\s+titleId="work-title"\s+ai=\{/);
  });
});
