/**
 * T122a 단위 테스트: 시안 v6 Desk — 처음 상태 · "✦ AI Respond now" 스위치 · 답장 칸 문구.
 *
 * 기대값 출처: `tasks/T122a.md` 범위 1·2·3·9, 시안 `docs/design/mockup-v6/Desk.dc.html` (L49 `.tg`, L323–L399 답장 카드 분기,
 * L773 초기 state, L1044–L1061 showSimple·toggleAi·rFrom/rTo), 차이 목록 `reports/design-match/v6-diff.md` B7–B9·C·E·F.
 * **실호출 0회** (AI는 가짜 LlmCaller, PayPal 없음), 개발 서버 없음, `.env`를 읽지 않는다.
 * 확률은 엔진 `forecastReply` 결과와 비교만 한다 (시험이 확률을 계산하지 않는다).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply } from '@/ai/reply';
import { copyTables, t } from '@/app/_shared/copy';
import { toPercentRounded } from '@/app/_shared/percent';
import { aiToggleStep } from '@/app/cases/desk-actions';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, type ReplyViewInput } from '@/app/cases/reply-model';
import { forecastReply } from '@/engine/forecast';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import type { BoardState, Cause, EscalationSignals, LlmCaller, ReplyForecastInput } from '@/types';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { React?: typeof React }).React = React;

const { NO_REPLY_DAYS } = await import('@/app/cases/desk-model');
const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');
const { DeskSelectionProvider } = await import('@/app/cases/view/desk-selection');
const { WorkZone, AiSwitch } = await import('@/app/cases/view/work-zone');
const { SentProvider } = await import('@/app/cases/view/sent-state');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const MOCK = read('docs/design/mockup-v6/Desk.dc.html');
const DESK_CSS = read('src/app/(app)/desk.css');

const cause: Cause = { subtype: 'A2', confidence: 1, evidence: [], needsReview: false, source: 'rule' };
const BOARD: BoardState = {
  disputeId: 'PP-R-GMS-10197661',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:37:00.000Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  hasTracking: true,
  hasDeliveredTracking: false,
  buyerPriorInrDisputes: 0,
  isDemo: true,
  cause,
};
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};
const DELAY = 1;
const FACT_SETS = caseReplyFacts({ now: '2026-11-10T03:00:00Z', dueDate: BOARD.dueDate, buyerId: 'B01', buyerLocale: 'ko' });
const DRAFT_EN =
  "Sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧.";
const OUTGOING =
  '기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요.';

function fakeLlm(...answers: unknown[]): LlmCaller {
  let n = 0;
  return async () => answers[Math.min(n++, answers.length - 1)];
}

type Base = Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;

async function base(): Promise<Base> {
  const draft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause, move: 'fight', facts: FACT_SETS.outgoing },
    { llm: fakeLlm({ buyer_message_en: 'It has not arrived.', coaching: ['a', 'b', 'c', 'd', 'e'], draft_en: DRAFT_EN }) },
  );
  const translation = await translateReply(
    { draftEn: DRAFT_EN, buyerLocale: 'ko', facts: FACT_SETS.outgoing, move: 'fight' },
    { llm: fakeLlm({ outgoing: OUTGOING }, { back_translation_en: 'Back translation.' }) },
  );
  const best = recommend(BOARD).best;
  return {
    draft,
    translation,
    facts: FACT_SETS.outgoing,
    draftFacts: FACT_SETS.draft,
    board: BOARD,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyerLocale: 'ko',
    plan: best === null ? null : planMove(BOARD, best),
    offerFirst: false,
    mode: 'simulated',
    draftSource: 'ai',
    riskAfterReply: null,
  };
}

function panel(b: Base, over: Record<string, unknown> = {}) {
  return createElement(ReplyPanel, {
    disputeId: BOARD.disputeId,
    base: b,
    replyId: 'r-1',
    languageKey: 'case.view.lang.KO',
    buyerShort: 'Seo-yeon',
    forecastBase: { signals: SIGNALS, delayDays: DELAY, translated: true },
    paypalOnly: null,
    ...over,
  });
}

/** 실제 화면처럼 공급자 안 (처음 = 스위치 꺼짐, path custom). */
const inDesk = (child: React.ReactElement, aiOn = false) =>
  createElement(SentProvider, null, createElement(DeskSelectionProvider, { initialPath: 'custom', initialAiOn: aiOn }, child));

// ───────────────────────────── 1. 처음 상태 ─────────────────────────────

describe('범위 1: 처음 상태 — 답장 칸이 비어 있고 위험은 무응답 예측', () => {
  it('시안 v6 초기 state: aiOn false, draft "", path custom (L772–L773)', () => {
    expect(MOCK).toMatch(/aiOn: false/);
    expect(MOCK).toMatch(/draft: '', path: 'custom'/);
    // 실제 화면은 path custom으로 시작한다 (최선 수 초안은 스위치를 켤 때 타이핑)
    expect(strip(read('src/app/cases/case-detail.tsx'))).toMatch(/<DeskSelectionProvider initialPath="custom">/);
  });

  it('스위치 꺼짐: 빈 입력칸 하나 (placeholder "Write a reply…") + 힌트 + 꺼진 [Send]. AI 입력칸·tray·선택지는 없다', async () => {
    const markup = html(inDesk(panel(await base())));
    expect(markup).toMatch(/^<section class="reply reply-simple"/);
    expect(markup).toMatch(/<textarea[^>]*class="reply-simple-input"[^>]*rows="4"[^>]*placeholder="Write a reply…"><\/textarea>/);
    expect(markup).toContain(`class="reply-simple-hint">${t('case.reply.simpleHint')}<`);
    expect(t('case.reply.simpleHint')).toBe('Write in any language. It is translated for the buyer when you send.');
    expect(markup).toMatch(/<button type="button" class="reply-button" disabled=""[^>]*>Send<\/button>/);
    expect(markup).not.toContain('class="reply-textarea"');
    expect(markup).not.toContain('class="reply-tray"');
    expect(markup).not.toContain('class="reaction"');
    // 안전장치: 전송 모드 글자 (Simulated)는 그대로
    expect(markup).toContain(`class="reply-mode">${t('case.send.mode.simulated')}`);
  });

  it('처음 위험 = 무응답 예측: 엔진에 빈 글 + (delayDays + noReplyDays)', async () => {
    const seen: ReplyForecastInput[] = [];
    const forecaster = (input: ReplyForecastInput) => {
      seen.push(input);
      return forecastReply(input);
    };
    html(inDesk(panel(await base(), { forecaster })));
    expect(seen.length).toBeGreaterThan(0);
    for (const input of seen) {
      expect(input.text).toBe('');
      expect(input.delayDays).toBe(DELAY + (NO_REPLY_DAYS ?? 0));
    }
  });
});

// ───────────────────────────── 2. 스위치 ─────────────────────────────

describe('범위 2: "✦ AI Respond now" 스위치', () => {
  it('스위치 마크업 = 시안 L325/L332: button.tg role=switch aria-checked + AI 알약 + "Respond now" + 트랙·손잡이', () => {
    const off = html(inDesk(createElement(AiSwitch)));
    expect(off).toBe(
      `<button type="button" class="tg" role="switch" aria-checked="false"><span class="ai-pill" aria-hidden="true">` +
        off.slice(off.indexOf('<svg'), off.indexOf('</svg>') + 6) +
        `${t('badge.aiSuggests')}</span>${t('case.work.title')}<span class="tg-tr" aria-hidden="true"><span class="tg-kn"></span></span></button>`,
    );
    const on = html(inDesk(createElement(AiSwitch), true));
    expect(on).toMatch(/^<button type="button" class="tg on" role="switch" aria-checked="true">/);
  });

  it('꺼짐: 흰 카드 "Your reply" + 스위치, 선택지 자리는 비어 있다. 켜짐: zone-work + 부제 + 선택지', () => {
    const choices = createElement('div', { className: 'choice-list' }, 'cards');
    const zone = (on: boolean) => html(inDesk(createElement(WorkZone, { titleId: 'work-title', ai: choices }, 'reply'), on));
    const off = zone(false);
    expect(off).toMatch(/^<section class="work work-simple" aria-labelledby="work-title">/);
    expect(off).toContain(`<h2 class="desk-card-title" id="work-title">${t('case.reply.title')}</h2>`);
    expect(off).not.toContain('choice-list');
    expect(off).not.toContain(t('case.work.sub'));
    expect(off).toMatch(/<\/div>reply<\/section>$/);
    const on = zone(true);
    expect(on).toMatch(new RegExp(`^<section class="work zone-work" aria-label="${t('case.work.title')}">`));
    expect(on).toContain(`<span class="desk-card-sub">${t('case.work.sub')}</span>`);
    expect(on).toMatch(/<div class="choice-list">cards<\/div>reply<\/section>$/);
  });

  it('켜면서 빈 글이면 AI 초안 타이핑, 쓴 글은 그대로, 끄면 빈 답장 (결정 20:40 2번)', () => {
    expect(aiToggleStep(true, '', 'Draft')).toEqual({ kind: 'type', text: 'Draft' });
    expect(aiToggleStep(true, '   ', 'Draft')).toEqual({ kind: 'type', text: 'Draft' });
    expect(aiToggleStep(true, 'my words', 'Draft')).toEqual({ kind: 'none' });
    expect(aiToggleStep(true, '', null)).toEqual({ kind: 'none' });
    expect(aiToggleStep(false, 'Draft', 'Draft')).toEqual({ kind: 'clear' });
    // 답장 칸이 처리 함수를 렌더 밖(useEffect)에서 등록한다 (T103: 렌더 중 상태 변경 없음)
    const code = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(code).toMatch(/useEffect\(\(\) => \{\s*aiRef\.current = onAi;/);
    expect(code).toMatch(/const step = aiToggleStep\(on, text, anchor\);/);
  });

  it('켜짐(초안 타이핑이 끝난 상태): 1 선택지 아래 2 "Write and check" + 입력칸 = AI 초안 + 점검·예상 반응', async () => {
    const b = await base();
    const markup = html(inDesk(panel(b, { forecaster: forecastReply }), true));
    const anchor = buildReplyView({ ...b, confirmed: [], sendState: 'idle', outcome: null }).draftEn?.text as string;
    expect(markup).toMatch(/^<section class="reply desk-step"/);
    expect(markup).toContain(`>${t('case.reply.writeTitle')}</label>`);
    expect(t('case.reply.writeTitle')).toBe('Write and check');
    expect(markup).toContain('class="reply-textarea"');
    expect(markup).toContain(anchor.replace(/'/g, '&#x27;'));
    expect(markup).toContain('class="reply-tray"');
    expect(markup).toContain('class="reaction"');
  });

  it('T118 교훈: 답장 칸은 두 상태 모두 같은 자리 (스위치를 바꿔도 다시 마운트되지 않음). 렌더 중 setState 없음', () => {
    const zone = strip(read('src/app/cases/view/work-zone.tsx'));
    expect(zone.match(/<section\b/g)).toHaveLength(1);
    expect(zone).toMatch(/\{aiOn \? ai : null\}\s*\{children\}/);
    const selection = strip(read('src/app/cases/view/desk-selection.tsx'));
    expect(selection).toMatch(/const toggleAi = useCallback\(\(\) => \{/);
  });
});

// ───────────────────────────── 3. 답장 칸 문구 ─────────────────────────────

describe('범위 3: 답장 칸 문구 (시안 v6 DI.en / DI.ko)', () => {
  const mockEn = (key: string) => new RegExp(`${key}: '([^']*)'`).exec(MOCK)?.[1];
  const mockKo = (key: string) => [...MOCK.matchAll(new RegExp(`${key}: '([^']*)'`, 'g'))][1]?.[1];

  it('EN·KO 문구 = 시안 값', () => {
    expect(copyTables.en['case.reply.writeTitle']).toBe(mockEn('writeT'));
    expect(copyTables.ko['case.reply.writeTitle']).toBe(mockKo('writeT'));
    expect(copyTables.en['case.send.button']).toBe(mockEn('send'));
    expect(copyTables.ko['case.send.button']).toBe(mockKo('send'));
    expect(copyTables.en['case.reply.phSimple']).toBe(mockEn('phSimple'));
    expect(copyTables.ko['case.reply.phSimple']).toBe(mockKo('phSimple'));
    expect(copyTables.en['case.reply.simpleHint']).toBe(mockEn('simpleHint'));
    expect(copyTables.ko['case.reply.simpleHint']).toBe(mockKo('simpleHint'));
    expect(copyTables.en['case.reply.title']).toBe(mockEn('replyT'));
    expect(copyTables.ko['case.reply.title']).toBe(mockKo('replyT'));
    expect(copyTables.en['case.reaction.riskTitle']).toBe(mockEn('riskT'));
    expect(copyTables.ko['case.reaction.riskTitle']).toBe(mockKo('riskT'));
  });

  it('번역 칸 제목 "Translation (Korean)" — 언어 이름은 구매자 언어 (데이터)', () => {
    expect(t('case.reply.translationTitle', { language: t('case.view.lang.KO') }, 'en')).toBe(mockEn('sheSees'));
    expect(t('case.reply.translationTitle', { language: '한국어' }, 'ko')).toBe(mockKo('sheSees'));
    expect(t('case.reply.translationTitle', { language: 'German' }, 'en')).toBe('Translation (German)');
  });

  it('켜짐: 번역 칸은 editor 안쪽 아래 (시안 v6 L366), tray는 오른쪽 칸 (L368)', async () => {
    const markup = html(inDesk(panel(await base()), true));
    const editor = markup.slice(markup.indexOf('class="reply-editor'), markup.indexOf('class="reply-tray"'));
    expect(editor.indexOf('class="reply-textarea"')).toBeLessThan(editor.indexOf('class="reply-block reply-box reply-box-in"'));
    expect(editor).toContain(`class="reply-box-title">Translation (Korean)<`);
    expect(editor).toContain('lang="ko"');
  });

  it('꺼짐에서 쓴 글은 [Translate & check]를 지나야 Send가 켜진다 (안전장치 그대로)', async () => {
    const markup = html(inDesk(panel(await base(), { initialText: 'Hi, your order is on the way.' })));
    expect(markup).toContain(`>${t('case.reply.translateCheck').replace('&', '&amp;')}</button>`);
    expect(markup).toMatch(/<button type="button" class="reply-button" disabled=""[^>]*>Send<\/button>/);
  });
});

// ───────────────────────────── 위험 상자 (B31) ─────────────────────────────

describe('B31: 위험 상자 오른쪽 = "Dispute risk" 무응답 % (취소선) → 지금 % + "mood next · mood"', () => {
  it('"전" 값 = 엔진 무응답 예측 (시안 고정 89% 대신), "후" = 지금 글 예측', async () => {
    const b = await base();
    const markup = html(inDesk(panel(b, { forecaster: forecastReply }), true));
    const anchor = buildReplyView({ ...b, confirmed: [], sendState: 'idle', outcome: null }).draftEn?.text as string;
    const input = { anchorText: anchor, board: BOARD, signals: SIGNALS, translated: true };
    const none = forecastReply({ ...input, text: '', delayDays: DELAY + (NO_REPLY_DAYS ?? 0) });
    const now = forecastReply({ ...input, text: anchor, delayDays: DELAY });
    const mood = markup.slice(markup.indexOf('class="reaction-mood"'));
    expect(mood).toContain(`class="reaction-mood-label">${t('case.reaction.riskTitle')}<`);
    expect(mood).toContain(`class="reaction-risk-from">${toPercentRounded(none.pChargeback)}<`);
    expect(mood).toMatch(new RegExp(`class="reaction-risk-to[^"]*">${toPercentRounded(now.pChargeback)}<`));
    expect(mood).toContain(t('case.reaction.moodNext', { name: 'Seo-yeon' }).replace(/'/g, '&#x27;') + ' · ');
    expect(mood).not.toContain('reaction-mood-now');
  });
});

// ───────────────────────────── 9. 글자 크기·간격·색 = 시안 ─────────────────────────────

describe('범위 9: 이 영역의 CSS = 시안 v6 값', () => {
  it('.tg 스위치 규칙 = 시안 L49 그대로 (앞에 .dk만)', () => {
    const line = MOCK.split('\n').find((l) => l.startsWith('.tg{')) as string;
    expect(line).toBeDefined();
    const scoped = line.replace(/(^|\})\.tg/g, '$1.dk .tg');
    expect(DESK_CSS).toContain(scoped);
  });

  it('꺼짐 카드·textarea·힌트 = 시안 L324–L327 인라인 값', () => {
    expect(MOCK).toContain('border-radius: 24px; border: 1px solid #E4E6E9; background: #FFFFFF; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: rgba(0,0,0,0.04) 0 2px 8px');
    expect(DESK_CSS).toContain('.dk .work.work-simple{border-radius:24px;border:1px solid #E4E6E9;background:#FFFFFF;padding:18px 20px;display:flex;flex-direction:column;gap:12px;box-shadow:rgba(0,0,0,0.04) 0 2px 8px}');
    expect(DESK_CSS).toContain('.dk .reply-simple-input{width:100%;resize:vertical;border:1px solid #CFD3D8;border-radius:16px;padding:14px 16px;font:inherit;font-size:15px;line-height:1.5;color:#0B0F14;background:#FFFFFF;outline:none;display:block}');
    expect(DESK_CSS).toContain('.dk .reply-simple-hint{font-size:12px;color:#6C7378}');
  });

  it('번역 칸·tray·위험 상자 = 시안 L366 · L368 · L392–L393 · L1059', () => {
    expect(DESK_CSS).toContain('border-top:1px solid #E4E6E9;background:#F6F7F9;padding:10px 14px 12px');
    expect(DESK_CSS).toContain('.dk .reply-pair>.reply-tray{border:1px solid #E4E6E9;border-radius:18px;align-self:stretch;min-width:0');
    expect(DESK_CSS).toMatch(/\.dk \.reaction\{display:grid;grid-template-columns:minmax\(0, 1fr\) 200px;/);
    expect(DESK_CSS).toContain('.dk .reaction-risk-from{font-size:16px;font-weight:700;color:#9AA0A6;text-decoration:line-through}');
    expect(DESK_CSS).toContain('font-size:30px;line-height:1.1;font-weight:900;letter-spacing:-0.5px;font-variant-numeric:tabular-nums;transition:color .3s ease');
    expect(DESK_CSS).toContain('.dk .case-bubble-tr{font-weight:700;color:#0070E0}');
  });
});
