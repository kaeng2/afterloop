/**
 * T091 단위 테스트: 시안 맞추기 B — 누르면 일어나는 일 (선택지·칩·Details·목록·+$N·필터 + 모션).
 *
 * 기대값 출처: `tasks/T091.md` "만들 것" 1~7·"모션"·"완료 기준", SPEC v2.15 8-4장, 시안 `docs/design/mockup-v4/Desk.dc.html`.
 * **실호출 0회** — AI는 가짜 LlmCaller, PayPal은 부르지 않는다. 개발 서버 없음 (`renderToStaticMarkup`). `.env`를 읽지 않는다.
 * 숫자는 엔진 함수 결과와 비교만 한다 (시험이 기대값을 계산하지 않는다).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { copyKeys, copyTables, t } from '@/app/_shared/copy';
import { toDollarsRounded } from '@/app/_shared/money';
import { chipPopDelay, loadMotion, motionVars, riskTone, typeOutTiming } from '@/app/_shared/motion';
import {
  applyChip,
  draftForMove,
  effectRows,
  filledSnippets,
  lintSummary,
  nextTyped,
  ppText,
  quoteCut,
  refundMoveText,
  typeOutFrames,
} from '@/app/cases/desk-actions';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, editGate, type ReplyViewInput } from '@/app/cases/reply-model';
import { actionSavingsDisplay, trackingSavingsDisplay } from '@/app/today/savings-values';
import { appendSentence, forecastMoves, forecastReply, removeSentence, replyFeatureEffects } from '@/engine/forecast';
import { detectReplyFeatures } from '@/engine/reply-features';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import { actionSavings, trackingSavings } from '@/engine/savings';
import { replySnippetsFor } from '@/engine/snippets';
import type { BoardState, Cause, EscalationSignals, FactToken, LlmCaller, ReplyFeatureEffect, Subtype } from '@/types';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { React?: typeof React }).React = React;

const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');
const { ChoiceCards } = await import('@/app/cases/view/choice-cards');
const { DeskSelectionProvider } = await import('@/app/cases/view/desk-selection');
const { choicesView, curveView, reactionView } = await import('@/app/cases/desk-model');
const { TrackingDetail } = await import('@/app/today/tracking-detail');
const { WeeklyBumpCell, SavingsProvider } = await import('@/app/today/savings');
const { countsAsDone } = await import('@/app/today/tracking-register');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── 서연 (A2 통관 보류) 보기용 데이터 — app-t090과 같은 꼴 ─────────────────────

const D2 = 'PP-R-GMS-10197661';
const cause = (subtype: Subtype): Cause => ({ subtype, confidence: 1, evidence: [], needsReview: false, source: 'rule' });
const AFTER: BoardState = {
  disputeId: D2,
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
  cause: cause('A2'),
};
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};
const DELAY = 2;
const FACT_SETS = caseReplyFacts({ now: '2026-11-10T03:00:00Z', dueDate: AFTER.dueDate, buyerId: 'B01', buyerLocale: 'ko' });
const FACTS: FactToken[] = FACT_SETS.outgoing;
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
  const draft: ReplyDraft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: AFTER.cause as Cause, move: 'fight', facts: FACTS },
    { llm: fakeLlm({ buyer_message_en: 'It has not arrived.', coaching: ['a', 'b', 'c', 'd', 'e'], draft_en: DRAFT_EN }) },
  );
  const translation: ReplyTranslation = await translateReply(
    { draftEn: DRAFT_EN, buyerLocale: 'ko', facts: FACTS, move: 'fight' },
    { llm: fakeLlm({ outgoing: OUTGOING }, { back_translation_en: 'Back translation.' }) },
  );
  const best = recommend(AFTER).best;
  return {
    draft,
    translation,
    facts: FACTS,
    draftFacts: FACT_SETS.draft,
    board: AFTER,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyerLocale: 'ko',
    plan: best === null ? null : planMove(AFTER, best),
    offerFirst: false,
    mode: 'simulated',
    draftSource: 'ai',
    riskAfterReply: null,
  };
}

const anchorOf = (b: Base): string => buildReplyView({ ...b, confirmed: [], sendState: 'idle', outcome: null }).draftEn?.text as string;
const input = (text: string, anchor: string) => ({ text, anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: DELAY, translated: true });
const snippets = () => filledSnippets(replySnippetsFor('A2'), FACT_SETS.draft);

function panel(b: Base, over: Record<string, unknown> = {}) {
  return createElement(ReplyPanel, {
    disputeId: D2,
    base: b,
    replyId: 'r-1',
    languageKey: 'case.view.lang.KO',
    buyerShort: 'Seo-yeon',
    forecastBase: { signals: SIGNALS, delayDays: DELAY, translated: true },
    paypalOnly: null,
    ...over,
  });
}

const REFUND_NOTE = t('case.reply.refundDraft', { name: 'Seo-yeon' });

// ───────────────────────────── 1. 선택지 카드 ─────────────────────────────

describe('만들 것 1 · 완료 기준 1: 선택지 카드 누르기', () => {
  it('카드 = 버튼. 처음 고른 수 = 엔진 최선 수, 막힌 수(서연 부분 환불)는 aria-disabled + 누를 함수 없음', () => {
    const choices = choicesView(recommend(AFTER), null);
    const markup = html(
      createElement(
        DeskSelectionProvider,
        { initialPath: recommend(AFTER).best?.move ?? null },
        createElement(ChoiceCards, { choices }),
      ),
    );
    const best = recommend(AFTER).best?.move;
    expect(best).toBe('fight');
    expect(markup).toMatch(/data-on="true"><button type="button" class="choice-button" aria-pressed="true" data-move="fight"/);
    const offer = recommend(AFTER).all.find((e) => e.move === 'offer');
    expect(offer?.blockedBy).toBeDefined();
    expect(markup).toContain('aria-disabled="true" data-move="offer"');
    expect(markup).not.toMatch(/aria-pressed="[a-z]+" [^>]*data-move="offer"/);
    expect(markup).toContain('aria-pressed="false" data-move="refund"');
    // 막힌 카드는 onClick을 달지 않는다 (정적 검사)
    expect(strip(read('src/app/cases/view/choice-cards.tsx'))).toMatch(/onClick=\{choice\.blocked \? undefined :/);
  });

  it('환불 카드를 고르면 "Refund done · Simulated" (실제 환불 없음: 카드·답장 칸이 PayPal·서버 액션을 부르지 않는다)', () => {
    const choices = choicesView(recommend(AFTER), null);
    const markup = html(createElement(DeskSelectionProvider, { initialPath: 'refund' }, createElement(ChoiceCards, { choices })));
    expect(markup).toContain(`<span class="choice-simulated">${t('case.reply.refundDone')}</span>`);
    expect(t('case.reply.refundDone')).toBe('Refund done · Simulated');
    const cards = strip(read('src/app/cases/view/choice-cards.tsx'));
    const selection = strip(read('src/app/cases/view/desk-selection.tsx'));
    for (const file of [cards, selection]) {
      expect(file).not.toMatch(/fetch\(|sendReplyAction|addTrackingAction|api-m\.sandbox|\/refund/);
    }
  });

  it('카드의 초안: 최선 수 = AI 초안(새 AI 호출 없음), 환불 = 환불 안내 글, 초안 없는 수 = 바꾸지 않음', async () => {
    const b = await base();
    const anchor = anchorOf(b);
    const drafts = { fight: anchor, refund: REFUND_NOTE };
    expect(draftForMove('fight', drafts)).toBe(anchor);
    expect(draftForMove('refund', drafts)).toBe(REFUND_NOTE);
    expect(draftForMove('offer', drafts)).toBeNull();
    // 답장 칸은 LLM을 부르지 않는다 (정적 검사)
    expect(strip(read('src/app/cases/reply/reply-panel.tsx'))).not.toMatch(/draftReply|translateReply|getLlm/);
  });

  it('환불 카드의 글이면 위험 %·반응 막대·곡선 끝점·칩이 엔진 값으로 바뀐다 (화면 그대로)', async () => {
    const b = await base();
    const anchor = anchorOf(b);
    const before = forecastReply(input(anchor, anchor));
    const after = forecastReply(input(REFUND_NOTE, anchor));
    expect(after.pChargeback).not.toBe(before.pChargeback);
    const markup = html(panel(b, { initialText: REFUND_NOTE }));
    const r = reactionView(after, true);
    expect(markup).toContain(t('case.choice.chargeback', { percent: r?.chargeback as string }));
    expect(markup).toContain(t('case.reaction.cost', { amount: r?.cost as string }));
    for (const part of r?.parts ?? []) expect(markup).toContain(`style="--seg:${part.p}"`);
    // 곡선 끝점 = 같은 예측 값 (curveView가 draft 점으로 그린다)
    const curve = curveView([{ at: '2026-11-09T00:00:00Z', kind: 'buyer_message', pChargeback: 0.5 }], after.pChargeback);
    expect(curve?.headline).toBe(r?.chargeback);
    // 칩: 환불 완료 칩 + 빠진 것 없음 (시안 `if (!f.refundNow)`)
    expect(markup).toContain(t('case.reply.refundDone'));
    expect(markup).not.toContain('class="reply-lint reply-lint-missing"');
    // 보내는 글은 그대로 — 글이 다르면 Send는 관문이 끈다
    expect(markup).toMatch(/<button type="button" class="reply-button" disabled=""/);
    expect(markup).toContain(t('case.reply.autoTr', { language: t('case.view.lang.KO') }));
  });

  it('환불 카드를 고른 상태: 큰 위험 %·반응 막대 = 카드 숫자 (엔진 forecastMoves refund, 컨트롤 타워 결정 2026-11-12)', async () => {
    const b = await base();
    const anchor = anchorOf(b);
    const card = forecastMoves({ anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: DELAY, translated: true }).find(
      (m) => m.move === 'refund',
    );
    expect(card?.pChargeback).not.toBeNull();
    const choice = choicesView(recommend(AFTER), [{ move: 'refund', pChargeback: card?.pChargeback as number }]).find(
      (c) => c.move === 'refund',
    );
    // 환불 안내 글의 refundNow 문장 + AI 초안 = 그 수의 엔진 값 (같은 수 — 반올림 없이 같다)
    const hit = detectReplyFeatures(REFUND_NOTE, { translated: true }).hits.refundNow;
    expect(hit).toBeDefined();
    const moveText = refundMoveText(anchor, hit) as string;
    const engine = forecastReply(input(moveText, anchor));
    expect(engine.pChargeback).toBeCloseTo(card?.pChargeback as number, 12);
    // 환불 안내 글 자체의 예측과는 다르다 (그래서 바꾼다)
    expect(forecastReply(input(REFUND_NOTE, anchor)).pChargeback).not.toBeCloseTo(engine.pChargeback, 6);

    const markup = html(
      createElement(DeskSelectionProvider, { initialPath: 'refund' }, panel(b, { initialText: REFUND_NOTE })),
    );
    const r = reactionView(engine, true);
    expect(r?.chargeback).toBe(choice?.chargeback);
    expect(markup).toContain(t('case.choice.chargeback', { percent: choice?.chargeback as string }));
    for (const part of r?.parts ?? []) expect(markup).toContain(`style="--seg:${part.p}"`);
    // 입력칸 글은 환불 안내 글 그대로 (보이는 글은 바꾸지 않는다)
    expect(markup).toContain(REFUND_NOTE);
    // 고치면 custom → 다시 글 그대로 예측 (기존 시험과 같은 길)
    expect(refundMoveText(anchor, undefined)).toBeNull();
  });
});

// ───────────────────────────── 2. 칩 Add · Remove ─────────────────────────────

describe('만들 것 2 · 완료 기준 2: Missing + Add / ! Remove', () => {
  const RUSHED = t('case.reply.rushedExample');

  it('Add → snippets 문장이 글 끝에 들어가고 위험이 내려간다. 넣는 문장은 config/reply-snippets.json(자리표시자 채움)뿐', async () => {
    const b = await base();
    const anchor = anchorOf(b);
    const effects = replyFeatureEffects(input(RUSHED, anchor), snippets());
    const rows = effectRows(effects, false);
    expect(rows?.missing.length).toBeGreaterThan(0);
    const allowed = new Set(Object.values(snippets()));
    for (const row of rows?.missing ?? []) {
      expect(allowed.has(row.sentence as string)).toBe(true);
      expect(row.sentence).not.toMatch(/⟦|⟧|refund|deliver/i);
      const next = applyChip(RUSHED, row);
      expect(next).toBe(appendSentence(RUSHED, row.sentence as string));
      expect(forecastReply(input(next, anchor)).pChargeback).toBeLessThan(forecastReply(input(RUSHED, anchor)).pChargeback);
    }
    // 빠진 것 순서 = 효과 큰 것부터 (시안 sort)
    const deltas = (rows?.missing ?? []).map((row) => effects.find((e) => e.key === row.key && e.kind === 'missing')?.deltaPp as number);
    expect([...deltas].sort((x, y) => x - y)).toEqual(deltas);
  });

  it('Remove → 걸린 문장이 빠진다 (탓하기·모호함)', async () => {
    const b = await base();
    const anchor = anchorOf(b);
    const rows = effectRows(replyFeatureEffects(input(RUSHED, anchor), snippets()), false);
    const bad = rows?.bad ?? [];
    expect(bad.map((row) => row.key).sort()).toEqual(['blame', 'vague']);
    for (const row of bad) {
      expect(row.action).toBe('remove');
      const next = applyChip(RUSHED, row);
      expect(next).toBe(removeSentence(RUSHED, row.sentence as string));
      expect(next).not.toContain(row.sentence as string);
    }
  });

  it('화면: 나쁜 줄 [Remove], 빠진 줄 "Missing: …" [+ Add], %p = 엔진 deltaPp 반올림', async () => {
    const b = await base();
    const anchor = anchorOf(b);
    const markup = html(panel(b, { initialText: RUSHED }));
    const effects = replyFeatureEffects(input(RUSHED, anchor), snippets());
    for (const effect of effects.filter((e) => e.kind !== 'good')) {
      const at = markup.indexOf(`data-chip="${effect.key}"`);
      expect(at, effect.key).toBeGreaterThan(-1);
      const line = markup.slice(at, markup.indexOf('</div>', at));
      expect(line).toContain(t('case.reply.pts', { value: ppText(effect.deltaPp) }));
      expect(line).toContain(effect.kind === 'bad' ? t('case.reply.remove') : t('case.reply.add'));
      if (effect.kind === 'missing') expect(line).toContain(t('case.reply.missing', { label: t(`case.feature.${effect.key}`) }));
    }
    // 요약 알약 (0인 것은 뺀다)
    const rows = effectRows(effects, false);
    for (const item of lintSummary(rows as NonNullable<typeof rows>)) expect(markup).toContain(t(item.key, { count: item.count }));
  });

  it('넣는 문장에 환불 약속·도착 보장 없음 (config/reply-snippets.json 그대로)', () => {
    const all = [replySnippetsFor(null), replySnippetsFor('B1')].flatMap((m) => Object.values(m));
    for (const sentence of all) expect(sentence).not.toMatch(/refund|expected delivery|will arrive|guarantee/i);
    // 화면 코드에 넣는 문장을 직접 쓰지 않는다
    expect(strip(read('src/app/cases/desk-actions.ts'))).not.toMatch(/customs ID|Sorry for the wait/);
  });

  it('빈 글이면 칩 줄 대신 "Start typing — each sentence is checked."', async () => {
    const markup = html(panel(await base(), { initialText: '' }));
    expect(markup).toContain(t('case.reply.lintEmpty'));
    expect(markup).not.toContain('class="reply-lint reply-lint-missing"');
    expect(markup).toContain('class="reply-editor reply-editor-empty"');
  });
});

// ───────────────────────────── 3. Details ─────────────────────────────

describe('만들 것 3 · 완료 기준 3: Details에 칩별 %p = 엔진 값', () => {
  it('✓ 칩마다 문장과 %p (replyFeatureEffects), 역번역·검사 3개·PayPal data only도 같은 칸', async () => {
    const b = await base();
    const anchor = anchorOf(b);
    const markup = html(panel(b, { paypalOnly: 'PayPal data only: Full refund $74' }));
    const details = markup.slice(markup.indexOf('class="reply-details"'));
    const goods = replyFeatureEffects(input(anchor, anchor), snippets()).filter((e: ReplyFeatureEffect) => e.kind === 'good');
    expect(goods.length).toBeGreaterThan(0);
    for (const effect of goods) {
      const at = details.indexOf(`data-effect="${effect.key}"`);
      expect(at, effect.key).toBeGreaterThan(-1);
      const row = details.slice(at, details.indexOf('</li>', at));
      expect(row).toContain(t('case.reply.pts', { value: ppText(effect.deltaPp) }));
      expect(row).toContain(quoteCut(effect.sentence, Number.POSITIVE_INFINITY).replace(/'/g, '&#x27;'));
    }
    for (const needle of ['PayPal data only: Full refund $74', 'Back-translation to English', 'Facts match', 'No new promises']) {
      expect(details).toContain(needle);
    }
  });

  it('%p 표기: 반올림 + 부호 (시안 effTxt)', () => {
    expect(ppText(-12.4)).toBe('−12');
    expect(ppText(3.6)).toBe('+4');
    expect(ppText(0.2)).toBe('0');
    expect(quoteCut('x'.repeat(50))).toBe(`“${'x'.repeat(39)}…”`);
  });
});

// ───────────────────────────── 4·5. 왼쪽 목록 ─────────────────────────────

describe('만들 것 5 · 완료 기준 4: 지호 Send offer · Add all N은 기존 관문 그대로', () => {
  it('추적: "Add tracking to N orders in PayPal" + [Add all N], 버튼은 넘겨받은 서버 액션만 부른다', () => {
    const tracking = { untracked: [{ key: 'O05', buyerName: 'Yuki T.', productName: 'Beanie' }, { key: 'O07', buyerName: 'Lena K.', productName: 'Cardigan' }], excluded: [] };
    const markup = html(createElement(TrackingDetail, { tracking, register: async () => ({ kind: 'nothing' as const, line: '', rows: [] }) }));
    expect(markup).toContain(t('today.tracking.actTitle', { count: 2 }));
    expect(markup).toContain('>Add all 2</button>');
    const register = strip(read('src/app/today/tracking-register.tsx'));
    expect(register).toMatch(/const next = await action\(\);/);
    expect(register).not.toMatch(/fetch\(|api-m\.sandbox/);
    // "+$N"은 끝난 결과(가짜 포함)만
    expect(countsAsDone('simulated')).toBe(true);
    expect(countsAsDone('added')).toBe(true);
    for (const kind of ['failed', 'nothing', 'unavailable', 'error'] as const) expect(countsAsDone(kind)).toBe(false);
  });

  it('답장·제안 보내기 경로·관문 무변경 (replyId만, 관문 파일 손대지 않음)', () => {
    const panelSrc = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(panelSrc).toMatch(/sendReplyAction\(\{ disputeId, kind, replyId, confirmedCommitments: confirmed \}\)/);
    expect(panelSrc).toMatch(/if \(next\.ok\) report\(savings\);/);
    // 글을 바꾸면(카드·칩) Send는 지금 관문이 끈다
    expect(editGate({ ok: true, reasonKey: null }, 'changed', 'anchor').ok).toBe(false);
    expect(editGate({ ok: true, reasonKey: null }, 'anchor', 'anchor').ok).toBe(true);
  });
});

// ───────────────────────────── 6. +$N just now ─────────────────────────────

describe('만들 것 6 · 완료 기준 5: "+$N just now" = 엔진 값', () => {
  it('분쟁: actionSavings, 추적: trackingSavings (표기만 toDollarsRounded)', () => {
    const best = recommend(AFTER).best?.move ?? null;
    expect(actionSavingsDisplay(AFTER, best)).toBe(toDollarsRounded(actionSavings(AFTER, best as 'fight')));
    expect(actionSavingsDisplay(AFTER, 'refund')).toBeNull(); // 엔진이 0 → 아무것도 더하지 않는다
    const orders = [{ sku: 'FK-BN-SC', amountCents: 3800 }, { sku: 'FK-CD-OT', amountCents: 6400 }];
    const tracking = { untracked: orders.map((o, i) => ({ key: `O0${i}`, buyerName: null, productName: null, ...o })), excluded: [] };
    const cents = trackingSavings(orders);
    expect(trackingSavingsDisplay(tracking)).toBe(cents > 0 ? toDollarsRounded(cents) : null);
    expect(trackingSavingsDisplay({ untracked: [{ key: 'X', buyerName: null, productName: null }], excluded: [] })).toBeNull();
  });

  it('처음(액션 전)에는 "+$N"이 없다 — 서버 값은 바꾸지 않는다 (화면 상태만)', () => {
    const markup = html(createElement(SavingsProvider, {}, createElement(WeeklyBumpCell, { className: 'weekly-cell' }, 'x')));
    expect(markup).toBe('<div class="weekly-cell">x</div>');
    const src = strip(read('src/app/today/savings.tsx'));
    expect(src).not.toMatch(/fetch\(|sendReplyAction|revalidate|router/);
    expect(t('today.weekly.bump', { amount: '$37' })).toBe('+$37 just now');
  });
});

// ───────────────────────────── 7. 상품 칩 필터 · 머리글 ─────────────────────────────

describe('만들 것 7: 상품 칩 필터 · 머리글 sticky', () => {
  it('상품 칩 줄은 위쪽 막대 아래에 붙는다 (위쪽 막대는 이미 sticky)', () => {
    const css = read('src/app/today/today.css');
    expect(css).toMatch(/\.product-filter \{\s*position: sticky;/);
    expect(read('src/app/_shared/shell.css')).toMatch(/\.shell-bar \{\s*position: sticky;\s*top: 0;/);
  });
});

// ───────────────────────────── 모션 ─────────────────────────────

describe('모션: 시안 값 그대로 (config/motion.json)', () => {
  const mock = read('docs/design/mockup-v4/Desk.dc.html');

  it('타이핑 34ms마다 2글자 (시안 typeOut), 움직임 줄이기면 바로 전체', () => {
    expect(mock).toMatch(/i = Math\.min\(text\.length, i \+ 2\)/);
    expect(mock).toMatch(/\}, 34\);/);
    expect(typeOutTiming()).toEqual({ intervalMs: 34, step: 2 });
    expect(nextTyped(0, 5, 2)).toBe(2);
    expect(nextTyped(4, 5, 2)).toBe(5);
    expect(typeOutFrames('abcde', 2, false)).toEqual(['ab', 'abcd', 'abcde']);
    expect(typeOutFrames('abcde', 2, true)).toEqual(['abcde']);
  });

  it('타이핑 중에는 Send를 막는다 (관문 앞에 둔다)', () => {
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(src).toMatch(/const screenGate: SendGate = typing\s*\?\s*\{ ok: false, reasonKey: null \}/);
    expect(src).toMatch(/const gate: SendGate = editGate\(screenGate,/);
    expect(src).toMatch(/readOnly=\{busy \|\| typing\}/);
  });

  it('✓ 칩 pop .45s cubic-bezier(.2,1.4,.4,1) + n × 0.12s, 줄 rise .3s, 화살표 .2s, 색 .3s, 깜빡임 1.6s, 알림 3000ms', () => {
    const m = loadMotion().desk;
    expect(mock).toContain('.gchip{background:#FFFFFF;color:#0A1B3D;box-shadow:inset 0 0 0 1px #E4E6E9;animation:pop .45s cubic-bezier(.2,1.4,.4,1) both}');
    expect(m.chipPop).toMatchObject({ duration: '0.45s', easing: 'cubic-bezier(.2,1.4,.4,1)', staggerS: 0.12 });
    expect(chipPopDelay(0)).toBe('0s');
    expect(chipPopDelay(2)).toBe('0.24s');
    expect(mock).toContain('.nlint{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:14px;animation:rise .3s ease both}');
    expect(m.lintRise).toMatchObject({ duration: '0.3s', easing: 'ease' });
    expect(mock).toContain("histChevSt: 'display:inline-block;transition:transform .2s ease;'");
    expect(m.caret).toMatchObject({ duration: '0.2s', easing: 'ease' });
    expect(mock).toContain('transition:color .3s ease');
    expect(m.colorFade).toMatchObject({ duration: '0.3s', easing: 'ease' });
    expect(mock).toContain('.flash{animation:flash 1.6s ease}');
    expect(m.flash).toMatchObject({ duration: '1.6s', easing: 'ease' });
    expect(mock).toContain('}, 3000); }');
    expect(m.toast.durationMs).toBe(3000);
    const vars = motionVars();
    expect(vars['--motion-pop']).toBe('0.45s cubic-bezier(.2,1.4,.4,1)');
    expect(vars['--motion-caret']).toBe('0.2s ease');
  });

  it('css는 변수만 쓰고, 움직임 줄이기면 새 변수도 0s', () => {
    const reply = read('src/app/cases/reply/reply.css');
    expect(reply).toMatch(/animation: motion-pop var\(--motion-pop\) both;/);
    expect(reply).toMatch(/animation: motion-rise var\(--motion-lint-rise\) both;/);
    expect(reply).toMatch(/transition: transform var\(--motion-caret\);/);
    expect(read('src/app/cases/view/case.css')).toMatch(/\.desk-caret \{\s*display: inline-block;\s*transition: transform var\(--motion-caret\);/);
    const globals = read('src/app/globals.css');
    const reduced = globals.slice(globals.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const name of ['--motion-pop', '--motion-lint-rise', '--motion-fold', '--motion-caret', '--motion-color', '--motion-flash', '--motion-toast']) {
      expect(reduced).toContain(`${name}: 0s !important;`);
    }
    expect(reduced).toContain('animation: none !important;');
  });

  it('보충 22:50: 색 기준값은 config (위험 % riskCol, 알약 50%, 기분 angry)', () => {
    expect(mock).toContain("const riskCol = (p) => p >= 0.5 ? '#C4321F' : p >= 0.2 ? '#000000' : '#0066F5';");
    expect(loadMotion().desk.riskColor).toEqual(expect.objectContaining({ highFrom: 0.5, midFrom: 0.2 }));
    expect(riskTone(0.5)).toBe('high');
    expect(riskTone(0.2)).toBe('mid');
    expect(riskTone(0.19)).toBe('low');
    const fc = forecastReply({ text: t('case.reply.rushedExample'), anchorText: DRAFT_EN, board: AFTER, signals: SIGNALS, delayDays: 9, translated: true });
    const r = reactionView(fc, true);
    expect(r?.moodBad).toBe(fc.moodBand === 'angry');
    expect(r?.chargebackHigh).toBe(fc.pChargeback >= 0.5);
    // 반응 막대 세 칸 모두 width .35s (T090 그대로)
    expect(read('src/app/cases/reply/reply.css')).toMatch(/\.reaction-seg \{[^}]*transition: width var\(--motion-bar\);/);
  });
});

describe('문구 키', () => {
  it('en·ko 키 집합 같음, T091 새 키가 있다', () => {
    expect(copyKeys(copyTables.en)).toEqual(copyKeys(copyTables.ko));
    for (const key of [
      'case.reply.sumFix',
      'case.reply.sumMiss',
      'case.reply.missing',
      'case.reply.add',
      'case.reply.remove',
      'case.reply.pts',
      'case.reply.lintEmpty',
      'case.reply.autoTr',
      'case.reply.refundDone',
      'today.weekly.bump',
      'today.weekly.toast',
      'today.tracking.actTitle',
    ]) {
      expect(copyTables.en[key], key).toBeTypeOf('string');
    }
    expect(t('case.reply.autoTr', { language: 'Korean' })).toBe('Translated to Korean when you send.');
  });
});
