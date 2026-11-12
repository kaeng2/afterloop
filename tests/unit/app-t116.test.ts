/**
 * T116: Desk 차이 목록 남은 항목 (reports/design-match/desk-diff-recheck-20261112.md).
 * 항목마다 시험 하나 이상. 실제 AI·PayPal 호출 없음 (서버 액션은 가짜).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { copyTables, t } from '@/app/_shared/copy';
import { applyChip } from '@/app/cases/desk-actions';
import { reactionView } from '@/app/cases/desk-model';
import { editAdditions } from '@/app/cases/edited-reply';
import { buildCaseEvents, englishLookup } from '@/app/cases/history';
import { detectReplyFeatures } from '@/engine/reply-features';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/app/cases/actions', () => ({ sendReplyAction: vi.fn(), prepareEditedAction: vi.fn() }));
(globalThis as { React?: typeof React }).React = React;

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const html = (node: React.ReactElement) => renderToStaticMarkup(node);

const { WeeklyBumpCell } = await import('@/app/today/savings');
const { TrackingRegister } = await import('@/app/today/tracking-register');
const { WorkZone } = await import('@/app/cases/view/work-zone');
const { SentProvider } = await import('@/app/cases/view/sent-state');
const { DeskSelectionProvider } = await import('@/app/cases/view/desk-selection');

describe('1. F1-35 이번 주 카드: 앞 3칸 모두 깜빡임, "+$N"은 Money 칸만', () => {
  it('Open·Money·Replies 칸이 모두 WeeklyBumpCell이고, Money 외에는 금액을 달지 않는다', () => {
    const code = strip(read('src/app/today/today-list.tsx'));
    const cells = code.match(/<WeeklyBumpCell className="weekly-cell"( showAmount=\{false\})?>/g) ?? [];
    expect(cells).toHaveLength(3);
    expect(cells.filter((cell) => cell.includes('showAmount={false}'))).toHaveLength(2);
  });

  it('showAmount=false면 깜빡임 칸만 (bump 없을 때는 그대로)', () => {
    const markup = html(createElement(WeeklyBumpCell, { className: 'weekly-cell', showAmount: false }, 'x'));
    expect(markup).toBe('<div class="weekly-cell">x</div>');
    expect(strip(read('src/app/today/savings.tsx'))).toMatch(/bump === null \|\| !showAmount \? null/);
  });
});

describe('2. F1-45 낙관적 표시 + 실패면 되돌림', () => {
  it('추적: 누르는 즉시 Added ✓ + Done today(Simulated로), 실패면 unmarkDone', () => {
    const code = strip(read('src/app/today/tracking-register.tsx'));
    const click = code.slice(code.indexOf('const onClick'), code.indexOf('return ('));
    expect(click.indexOf('setOptimistic(true)')).toBeLessThan(click.indexOf('await action()'));
    expect(click.indexOf('markDone(doneId, { simulated: true })')).toBeLessThan(click.indexOf('await action()'));
    expect(click).toMatch(/else if \(doneId !== null\) \{\s*unmarkDone\(doneId\);/);
    // report("+$N")는 결과가 끝난 것일 때만
    expect(click).toMatch(/if \(countsAsDone\(next\.kind\)\) \{\s*report\(savings\);/);
    expect(code).toMatch(/shownDone \? t\('today\.tracking\.addedDone'\)/);
  });

  it('추적: 실패 결과면 버튼이 다시 켜진다 (성공처럼 남지 않는다)', () => {
    const failed = html(
      createElement(TrackingRegister, {
        label: 'Add all 2',
        action: async () => ({ kind: 'error' as const, line: 'x', rows: [] }),
        initial: { kind: 'error' as const, line: 'x', rows: [] },
      }),
    );
    expect(failed).toMatch(/<button type="button" class="tracking-button">Add all 2<\/button>/);
  });

  it('지호 Send offer: 확인 뒤 즉시 Offer sent ✓ + Done today, 실패면 unmarkDone', () => {
    const code = strip(read('src/app/today/offer-work.tsx'));
    const send = code.slice(code.indexOf('async function send()'), code.indexOf('function retry()'));
    expect(send.indexOf('window.confirm')).toBeLessThan(send.indexOf('setOptimistic(true)'));
    expect(send.indexOf('markDone(disputeId, { simulated: true })')).toBeLessThan(send.indexOf('await action('));
    expect(send).toMatch(/\} else \{\s*unmarkDone\(disputeId\);/);
  });

  it('서연 메시지 Send는 T104대로 마지막 단계 때 (send 안에서 markDone 없음)', () => {
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    const send = src.slice(src.indexOf('async function send('), src.indexOf('function completeAction('));
    expect(send).not.toMatch(/\bmarkDone\(/);
  });
});

describe('3. F3-36 사건 기록 구매자 글 줄 = 대화 칸의 번역 글', () => {
  const base = {
    orderDate: null,
    carrierEvents: [],
    hasTrackingInPayPal: null,
    inquiries: [],
    buyerMessages: [{ text: '벌써 3주째인데 아직도 안 왔어요.', at: '2026-11-10T07:40:00Z' }],
    sellerReplies: [],
    openedAt: null,
    angryTone: false,
  };

  it('englishOf가 있으면 영어, 없으면 원문 그대로 (지금처럼)', () => {
    const lookup = englishLookup([{ original: '벌써 3주째인데 아직도 안 왔어요.', english: "It's already been three weeks." }]);
    const shown = buildCaseEvents({ ...base, englishOf: lookup });
    expect(shown[0].text).toBe(t('case.history.event.buyer_message', { text: "It's already been three weeks." }));
    const raw = buildCaseEvents(base);
    expect(raw[0].text).toContain('벌써 3주째');
  });

  it('번역이 없으면 원문으로 (지어내지 않는다)', () => {
    const lookup = englishLookup([{ original: '벌써 3주째인데 아직도 안 왔어요.', english: null }]);
    expect(lookup('벌써 3주째인데 아직도 안 왔어요.')).toBeNull();
    expect(buildCaseEvents({ ...base, englishOf: lookup })[0].text).toContain('벌써 3주째');
  });

  it('load: 화면용(eventsShown)만 번역, AI 요약·곡선 입력(events)은 그대로. 한국어 화면은 원문', () => {
    const load = strip(read('src/app/cases/view/load.ts'));
    expect(load).toMatch(/loadHistorySummary\(events,/);
    expect(load).toMatch(/currentLocale\(\) === 'ko' \? events : caseEventsFor\(loaded, seedInquiries, englishLookup\(input\.messages\)\)/);
    const detail = strip(read('src/app/cases/case-detail.tsx'));
    expect(detail).toMatch(/historyView\(loaded\.eventsShown,/);
    expect(detail).toMatch(/loadRiskCurve\(loaded\.events,/);
  });
});

describe('4. F4-41 bad 칩 이름', () => {
  it('EN "Refund done", KO "환불 완료" (시안 fx.refundNow)', () => {
    expect(copyTables.en['case.feature.refundNow']).toBe('Refund done');
    expect(copyTables.ko['case.feature.refundNow']).toBe('환불 완료');
  });
});

describe('5. F4-46 Remove = 그 규칙에 걸리는 문장 모두', () => {
  it('같은 규칙 문장이 둘이면 둘 다 지운다 (엔진 판정 hit을 반복)', () => {
    const text = 'Sorry for the wait. It is your fault for not sending the ID. Expected Nov 17. It is your fault the box is late.';
    const hit = detectReplyFeatures(text).hits.blame;
    expect(hit).toBe('It is your fault for not sending the ID.');
    const hitsOf = (value: string) => detectReplyFeatures(value).hits;
    // 엔진 removeSentence 하나만이면 두 번째 탓 문장이 남는다 (이전 동작)
    const once = applyChip(text, { action: 'remove', sentence: hit ?? '' });
    expect(detectReplyFeatures(once).features.blame).toBe(true);
    const all = applyChip(text, { action: 'remove', sentence: hit ?? '', key: 'blame' }, hitsOf);
    expect(detectReplyFeatures(all).features.blame).toBe(false);
    expect(all).toBe('Sorry for the wait. Expected Nov 17.');
  });

  it('Add와 key 없는 Remove는 지금처럼 (엔진 removeSentence 하나)', () => {
    expect(applyChip('A. B.', { action: 'remove', sentence: 'B.' })).toBe('A.');
    expect(applyChip('A.', { action: 'add', sentence: 'B.' }, () => ({}))).toContain('B.');
  });

  it('화면은 엔진 특징 판정(detector)의 hit로만 반복한다', () => {
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(src).toMatch(/applyChip\(now, row, \(value\) => detector\(value, \{ translated \}\)\?\.hits \?\? null\)/);
    expect(strip(read('src/engine/forecast.ts'))).toMatch(/export function removeSentence\(text: string, sentence: string\): string \{/);
  });
});

describe('6. F4-65 "now: angry" 소문자', () => {
  it('EN 소문자, KO 시안 DI.ko', () => {
    expect(reactionView({ pWait: 0.7, pRefund: 0.2, pChargeback: 0.1, expectedCostCents: 100, mood: 0, moodBand: 'okay' } as never, true)?.nowMoodKey).toBe(
      'case.moodNow.angry',
    );
    expect(t('case.reaction.moodNow', { mood: t('case.moodNow.angry', undefined, 'en') }, 'en')).toBe('now: angry');
    expect(t('case.reaction.moodNow', { mood: t('case.moodNow.angry', undefined, 'ko') }, 'ko')).toBe('지금: 화남');
  });
});

describe('7. F4-67 입력 중 새 약속 경고', () => {
  it('서버와 같은 editAdditions — AI 초안에 없던 약속이면 경고, 같으면 없음', () => {
    const anchor = 'Sorry for the wait. Your sweater is at customs.';
    expect(editAdditions(anchor, anchor, [])).toEqual({ commitments: [], promises: [] });
    const added = editAdditions(anchor, `${anchor} I will refund you in full and guarantee delivery tomorrow.`, []);
    expect(added.promises.length + added.commitments.length).toBeGreaterThan(0);
  });

  it('문구는 시안 그대로 (EN·KO), 맨 아래 왼쪽 빨간 글', () => {
    expect(copyTables.en['case.reply.warnPromise']).toBe('! New promise — needs your approval');
    expect(copyTables.ko['case.reply.warnPromise']).toBe('! 새 약속 — 승인 필요');
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(src).toMatch(/const added = editAdditions\(anchor, text, draftFacts \?\? \[\]\);/);
    expect(src).toMatch(/<p className="reply-warn" role="status">/);
    expect(read('src/app/cases/reply/reply.css')).toMatch(/\.reply-warn \{[^}]*font-size: 13px;[^}]*font-weight: 700;/);
  });
});

describe('8. F5-3 Send 뒤 랜드마크 이름 "Case progress"', () => {
  it('보내기 전 (T122a 시안 v6): 스위치 꺼짐 = aria-labelledby "Your reply" 제목, 켜짐 = aria-label "Respond now" (시안 workT)', () => {
    const off = html(
      createElement(SentProvider, null, createElement(DeskSelectionProvider, { initialPath: 'custom' }, createElement(WorkZone, { titleId: 'work-title' }, 'x'))),
    );
    expect(off).toMatch(/^<section class="work work-simple" aria-labelledby="work-title">/);
    const on = html(
      createElement(
        SentProvider,
        null,
        createElement(DeskSelectionProvider, { initialPath: 'custom', initialAiOn: true }, createElement(WorkZone, { titleId: 'work-title' }, 'x')),
      ),
    );
    expect(on).toMatch(new RegExp(`^<section class="work zone-work" aria-label="${t('case.work.title')}">`));
  });

  it('보낸 뒤: aria-label = case.progress.zone, 보이는 제목 문구는 그대로', () => {
    const code = strip(read('src/app/cases/view/work-zone.tsx'));
    expect(code).toMatch(/aria-label=\{sent \? t\('case\.progress\.zone'\) : aiOn \? t\('case\.work\.title'\) : undefined\}/);
    expect(code).toMatch(/aria-labelledby=\{sent \|\| aiOn \? undefined : titleId\}/);
    expect(copyTables.en['case.progress.zone']).toBe('Case progress');
    expect(copyTables.en['case.progress.title']).toBe('What happens next · Simulated');
    expect(strip(read('src/app/cases/view/case-view.tsx'))).toMatch(/<WorkZone\s+titleId="work-title"/);
  });
});

describe('9·10·11. F5-19·21·24 Send 뒤 말풍선·단계', () => {
  const code = strip(read('src/app/cases/progress/case-progress.tsx'));

  it('F5-19 → T122a 시안 v6 L534: 보낸 말풍선 "Sent · translated" (· Simulated 그대로, "auto" 표기 없음 — Send 이후 예외)', () => {
    expect(t('case.progress.sentAutoBubble', undefined, 'en')).toBe('Sent · translated');
    expect(t('case.progress.sentBubble', undefined, 'en')).toBe('Sent · translated');
    expect(t('case.progress.sentBubble', undefined, 'ko')).toBe('보냄');
    expect(copyTables.en['case.progress.sentAutoBubble']).not.toMatch(/auto/i);
    expect(code).toMatch(/t\(sentEdited \? 'case\.progress\.sentAutoBubble' : 'case\.progress\.sentBubble'\)/);
    expect(code).toMatch(/\{live \? null : ` · \$\{t\('case\.progress\.simulated'\)\}`\}/);
    const panel = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(panel).toMatch(/sentEdited=\{sentSnap !== null && anchor !== null && sentSnap\.text !== anchor\}/);
  });

  it('F5-21: 시뮬레이션 답장은 태그 "Simulated reply"만 (번역 줄 없음, 영어는 title)', () => {
    const sim = code.slice(code.indexOf('cprog-bubble-sim'), code.indexOf('case-read'));
    expect(sim).toMatch(/t\('case\.progress\.simReply'\)/);
    expect(sim).not.toMatch(/case\.view\.translated/);
    expect(sim).toMatch(/title=\{reply\.english\}/);
  });

  it('F5-24: 단계 key에 pending/done을 넣지 않는다', () => {
    expect(code).toMatch(/<Step key=\{row\.step\} row=\{row\} onApprove=\{approve\} \/>/);
    expect(code).not.toMatch(/'pending' : 'done'/);
  });
});
