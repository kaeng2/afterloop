/**
 * T009 2부: 답장 보기용 값 (`buildReplyView`·`canSend`) · 답장 칸 그리기 · 2부에 함께 넣는 것 1~3번.
 *
 * 기대값 출처: `tests/acceptance/drafts/AC18.md` 6·7·12번, `tasks/T009.md` 2부 표(7~13번)·"전송 버튼이
 * 켜지는 조건"·"제안이 먼저"·"정책 밖 약속"·"2부에 함께 넣는 것", SPEC v2.7 3·10장.
 * PayPal·LLM 실제 호출 없음 (LLM은 정해 둔 답을 내는 가짜). DOM 도구 없이 `react-dom/server`로 글자만 그린다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { checkTokens } from '@/ai/tokens';
import { copyTables } from '@/app/_shared/copy';
import { buildCaseView, caseMessages, statusKeyFor, type CaseViewInput } from '@/app/cases/model';
import { buildReplyView, canSend, type ReplyViewInput } from '@/app/cases/reply-model';
import { CaseView } from '@/app/cases/view/case-view';
import { escalationRisk } from '@/engine/escalation';
import { replyFacts } from '@/engine/followup';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import type { BoardState, Cause, EscalationSignals, FactToken, LlmCaller } from '@/types';

import { D1_JIHO, P, R } from '../acceptance/boards';

vi.mock('server-only', () => ({}));
vi.mock('@/app/_server/disputes', () => ({ loadDemoDisputes: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }) }));

const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');

(globalThis as { React?: typeof React }).React = React;

const ROOT = path.resolve(__dirname, '../..');

// ── 공용 입력 ─────────────────────────────────────────────────────────────

const ruleCause = (subtype: Cause['subtype'], causeNote?: string): Cause => ({
  subtype,
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
  ...(causeNote === undefined ? {} : { causeNote }),
});

const D2_BASE: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause'> = {
  disputeId: 'PP-R-TEST-D2',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:37:00Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  buyerPriorInrDisputes: 0,
  isDemo: false,
};
const CUSTOMS_EVENT = 'Customs hold – recipient customs ID missing';
const D2_BEFORE: BoardState = { ...D2_BASE, hasTracking: false, hasDeliveredTracking: false, cause: ruleCause('A1') };
const D2_AFTER: BoardState = { ...D2_BASE, hasTracking: true, hasDeliveredTracking: false, isDemo: true, cause: ruleCause('A2', CUSTOMS_EVENT) };

const SEOYEON_START: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};
const SEOYEON_AFTER_REPLY: EscalationSignals = { ...SEOYEON_START, secondMessageUnanswered: false, unansweredOver24h: false, angryTone: null };

const FACTS: FactToken[] = [{ token: '⟦DATE_1⟧', kind: 'DATE', value: '2026-11-17' }];

const DRAFT_EN_AC18 =
  "Sorry for the wait, Seo-yeon. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and it should reach you by ⟦DATE_1⟧. If not, I'll refund you in full.";
const OUTGOING_AC18 =
  '서연 님, 기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 ⟦DATE_1⟧까지 받으실 수 있을 거예요. 그때까지 도착하지 않으면 전액 환불해 드릴게요.';
const DRAFT_EN =
  "Sorry for the wait, Seo-yeon. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧.";
const OUTGOING =
  '서연 님, 기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요.';
const COACHING = ['Say sorry for the wait first.', 'Explain the customs hold in one line.', 'Ask for the customs code.'];

function fakeLlm(...answers: unknown[]): LlmCaller {
  let n = 0;
  return async () => answers[Math.min(n++, answers.length - 1)];
}

async function prepare(draftEn: string, outgoing: string): Promise<{ draft: ReplyDraft; translation: ReplyTranslation }> {
  const draft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: D2_AFTER.cause as Cause, move: 'fight', facts: FACTS },
    { llm: fakeLlm({ buyer_message_en: 'It has not arrived.', coaching: COACHING, draft_en: draftEn }) },
  );
  if (!draft.ok) throw new Error(`draft failed: ${draft.detail}`);
  const translation = await translateReply(
    { draftEn: draft.draftEn, buyerLocale: 'ko', facts: FACTS, move: 'fight' },
    { llm: fakeLlm({ outgoing }, { back_translation_en: 'Seo-yeon, sorry for the wait.' }) },
  );
  return { draft, translation };
}

const PLAN = planMove(D2_AFTER, recommend(D2_AFTER, P, R).best!, P, R);

function base(draft: ReplyDraft, translation: ReplyTranslation | null, overrides: Partial<ReplyViewInput> = {}): ReplyViewInput {
  return {
    draft,
    translation,
    facts: FACTS,
    buyerLocale: 'ko',
    plan: PLAN,
    offerFirst: false,
    mode: 'simulated',
    draftSource: 'ai',
    confirmed: [],
    sendState: 'idle',
    outcome: null,
    riskAfterReply: null,
    ...overrides,
  };
}

// ── AC18 6번 ─────────────────────────────────────────────────────────────

describe('AC18 6번: 통과하는 글이면 버튼이 켜진다', () => {
  it('검사 결과가 checkTokens(초안, 전송본, facts)와 같고, 미리보기에 "11월 17일"이 있고 ⟦·⟧가 없다', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    const view = buildReplyView(base(draft, translation));
    expect(view.check).toEqual(checkTokens(DRAFT_EN, OUTGOING, FACTS));
    expect(view.check?.ok).toBe(true);
    expect(view.outgoing?.text).toContain('11월 17일');
    expect(view.outgoing?.text).not.toMatch(/[⟦⟧]/);
    expect(view.draftEn?.text).toContain('November 17');
    expect(canSend(view)).toEqual({ ok: true, reasonKey: null });
  });

  it('AC18 대역 글은 "I\'ll refund you in full"이 정책 밖 약속이라 확인해야 켜진다 (SPEC v2.7 3장)', async () => {
    const { draft, translation } = await prepare(DRAFT_EN_AC18, OUTGOING_AC18);
    const before = buildReplyView(base(draft, translation));
    expect(before.check?.ok).toBe(true);
    expect(before.commitments).toEqual([{ category: 'refund', labelKey: 'case.reply.commitment.refund', confirmed: false }]);
    expect(canSend(before)).toEqual({ ok: false, reasonKey: 'case.send.blocked.unconfirmed' });
    const after = buildReplyView(base(draft, translation, { confirmed: ['refund'] }));
    expect(canSend(after)).toEqual({ ok: true, reasonKey: null });
  });

  it('사실값 줄: 날짜의 이름은 "Follow-up date"이고 값은 한국어 표기다 (Delivery date가 아니다)', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    const view = buildReplyView(base(draft, translation));
    expect(view.factRows).toEqual([{ token: '⟦DATE_1⟧', labelKey: 'case.reply.fact.DATE', value: '11월 17일', primary: true }]);
    expect(copyTables.en['case.reply.fact.DATE']).toBe('Follow-up date');
  });

  it('T058: 초안에 날짜 토큰이 없으면 DATE 줄이 없고, 있으면 있다 (표시만. 사실값 자체는 그대로)', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    expect(buildReplyView(base(draft, translation)).factRows.map((row) => row.token)).toEqual(['⟦DATE_1⟧']);
    if (!draft.ok) throw new Error('draft failed');
    const noDate: ReplyDraft = { ...draft, draftEn: draft.draftEn.replace('⟦DATE_1⟧', 'soon') };
    const input = base(noDate, translation);
    expect(buildReplyView(input).factRows).toEqual([]);
    expect(input.facts).toEqual(FACTS);
  });

  it('T058: 이름·서명 줄도 같은 규칙 (초안에 쓰인 토큰만)', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    if (!draft.ok) throw new Error('draft failed');
    const facts: FactToken[] = [
      ...FACTS,
      { token: '⟦BUYER_NAME_1⟧', kind: 'BUYER_NAME', value: 'Seo-yeon' },
      { token: '⟦SELLER_NAME_1⟧', kind: 'SELLER_NAME', value: 'Hannah' },
    ];
    const named: ReplyDraft = { ...draft, draftEn: `Hello ⟦BUYER_NAME_1⟧, ${draft.draftEn}` };
    const rows = buildReplyView({ ...base(named, translation), facts }).factRows.map((row) => row.labelKey);
    expect(rows).toEqual(['case.reply.fact.DATE', 'case.reply.fact.BUYER_NAME']);
  });

  it('replyFacts가 만든 값을 그대로 쓴다 (서연 기한 11/30, 오늘 11/10 → 11/17)', () => {
    expect(replyFacts({ now: '2026-11-10T03:00:00Z', disputeDueDate: D2_BASE.dueDate })).toEqual(FACTS);
  });
});

// ── AC18 7번 (보기용 값 쪽) ────────────────────────────────────────────

describe('AC18 7번: 전송본이 바뀌면 버튼이 꺼지고 이유가 보인다', () => {
  it('(가) 날짜를 직접 씀 → literalFacts·missing, (나) 토큰을 뺌 → missing, (다) "반드시" → newPromises', async () => {
    const cases: [string, (c: NonNullable<ReturnType<typeof buildReplyView>['check']>) => void][] = [
      [OUTGOING.replace('⟦DATE_1⟧', '11월 17일'), (c) => {
        expect(c.literalFacts).toContain('11월 17일');
        expect(c.missing).toContain('⟦DATE_1⟧');
      }],
      [OUTGOING.replace('⟦DATE_1⟧까지 ', ''), (c) => expect(c.missing).toContain('⟦DATE_1⟧')],
      [`${OUTGOING} 반드시 환불해 드립니다.`, (c) => expect(c.newPromises).toContain('반드시')],
    ];
    for (const [outgoing, expectCheck] of cases) {
      const { draft, translation } = await prepare(DRAFT_EN, outgoing);
      const view = buildReplyView(base(draft, translation));
      expect(view.check).not.toBeNull();
      expectCheck(view.check!);
      const gate = canSend(view);
      expect(gate.ok).toBe(false);
      expect(gate.reasonKey).not.toBeNull();
      expect(view.checkRows.some((row) => !row.ok)).toBe(true);
    }
  });

  it('검사 줄은 코드가 하는 네 가지뿐이다: 토큰 셋 + 이름 호칭(T056) (없는 검사를 체크 표시로 그리지 않는다)', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    expect(buildReplyView(base(draft, translation)).checkRows.map((row) => row.labelKey)).toEqual([
      'case.reply.check.tokens',
      'case.reply.check.literal',
      'case.reply.check.promises',
      'case.reply.check.nameHonorific',
    ]);
  });
});

// ── 버튼 조건 · 제안이 먼저 · 정책 밖 약속 · AI 없음 ─────────────────────

describe('전송 버튼이 켜지는 조건', () => {
  it('답장 계획이 없거나 실행 API가 send_message가 아니면 꺼진다', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    expect(canSend(buildReplyView(base(draft, translation, { plan: null })))).toEqual({ ok: false, reasonKey: 'case.send.blocked.noPlan' });
    expect(canSend(buildReplyView(base(draft, translation, { plan: { ...PLAN, apiMove: 'provide_evidence' } }))).ok).toBe(false);
  });

  it('보내는 중·보낸 뒤에는 꺼진다. 가짜 전송이 끝나면 [Reset]이 있다', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    expect(canSend(buildReplyView(base(draft, translation, { sendState: 'sending' }))).ok).toBe(false);
    const done = buildReplyView(
      base(draft, translation, { sendState: 'done', outcome: { ok: true, mode: 'simulated', disputeId: 'PP-R-TEST-D2' } }),
    );
    expect(canSend(done)).toEqual({ ok: false, reasonKey: 'case.send.blocked.sent' });
    expect(done.canReset).toBe(true);
  });

  it('지호 꼴(추천 = 제안, make_offer 허용) → 메시지 보내기 꺼짐 + 이유 키 / 서연 꼴 → 켜짐', async () => {
    const jiho = buildCaseView(
      { ...caseInput(), disputeId: D1_JIHO.disputeId, boardReal: D1_JIHO, boardDemo: null, carrierEvents: [] },
      P,
      R,
    );
    const seoyeon = buildCaseView(caseInput(), P, R);
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    const jihoView = buildReplyView(base(draft, translation, { offerFirst: jiho.messageSend.blocked }));
    expect(canSend(jihoView)).toEqual({ ok: false, reasonKey: 'case.view.offerFirst' });
    expect(copyTables.en['case.view.offerFirst']).toMatch(/Send the offer first/);
    expect(canSend(buildReplyView(base(draft, translation, { offerFirst: seoyeon.messageSend.blocked }))).ok).toBe(true);
  });

  it('제안이 먼저인 이유는 초안이 없을 때도 보인다', () => {
    const view = buildReplyView(base({ ok: false, reason: 'ai_unavailable', detail: 'llm_failed:LlmConfigError' }, null, { offerFirst: true }));
    expect(canSend(view).reasonKey).toBe('case.view.offerFirst');
  });

  it('정책 밖 약속(outsidePolicy)이 있으면 꺼져 있고, 범주를 확인한 뒤 켜진다', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    if (!translation.ok || !draft.ok) throw new Error('prep');
    const fakeOutside: ReplyTranslation = { ...translation, outsidePolicy: ['reship'], sendable: false };
    expect(canSend(buildReplyView(base(draft, fakeOutside))).ok).toBe(false);
    expect(canSend(buildReplyView(base(draft, fakeOutside, { confirmed: ['reship'] })))).toEqual({ ok: true, reasonKey: null });
    // 다른 범주를 확인해도 풀리지 않는다
    expect(canSend(buildReplyView(base(draft, fakeOutside, { confirmed: ['refund'] }))).ok).toBe(false);
  });

  it('번역이 더한 약속(addedInTranslation)은 확인해도 꺼져 있다', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    if (!translation.ok) throw new Error('prep');
    const added: ReplyTranslation = { ...translation, addedInTranslation: ['refund'], outsidePolicy: ['refund'], sendable: false };
    const view = buildReplyView(base(draft, added, { confirmed: ['refund'] }));
    expect(canSend(view)).toEqual({ ok: false, reasonKey: 'case.send.blocked.addedInTranslation' });
    expect(view.addedInTranslation).toEqual([{ category: 'refund', labelKey: 'case.reply.commitment.refund' }]);
  });

  it('AI 초안이 없으면 "AI unavailable — showing rules only", 버튼 꺼짐', () => {
    const view = buildReplyView(base({ ok: false, reason: 'ai_unavailable', detail: 'llm_failed:LlmConfigError' }, null));
    expect(view.available).toBe(false);
    expect(view.unavailableKey).toBe('common.llmUnavailable');
    expect(copyTables.en['common.llmUnavailable']).toBe('AI unavailable — showing rules only');
    expect(canSend(view)).toEqual({ ok: false, reasonKey: 'case.send.blocked.noDraft' });
  });

  it('초안은 있는데 전송본이 없으면 꺼진다', async () => {
    const { draft } = await prepare(DRAFT_EN, OUTGOING);
    const view = buildReplyView(base(draft, { ok: false, reason: 'ai_unavailable', detail: 'llm_failed:LlmApiError' }));
    expect(view.translationUnavailable).toBe(true);
    expect(canSend(view).reasonKey).toBe('case.send.blocked.noTranslation');
  });
});

// ── AC18 12번 (2부): 고정 초안 표시 ─────────────────────────────────────

describe('AC18 12번: 고정 초안이면 "Demo draft" 배지, AI suggests 없음', () => {
  it('보기용 값', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    const fixed = buildReplyView(base(draft, translation, { draftSource: 'fixed' }));
    expect(fixed.fixedDraftKey).toBe('case.reply.fixedDraft');
    expect(fixed.sourceBadges).toEqual([]);
    expect(copyTables.en['case.reply.fixedDraft']).toBe('Demo draft — written by the team, not generated live');
    const ai = buildReplyView(base(draft, translation));
    expect(ai.fixedDraftKey).toBeNull();
    expect(ai.sourceBadges).toEqual(['aiSuggests']);
  });

  it('그린 화면', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    const html = render(base(draft, translation, { draftSource: 'fixed' }));
    expect(html).toContain('Demo draft — written by the team, not generated live');
    // T090: "AI" 알약(출처 표시)이 없다. "Use AI draft" 단추 안의 작은 장식 알약(ai-pill-small)은 단추 이름이다
    expect(html).not.toMatch(/class="ai-pill"/);
  });
});

// ── 답장 칸 그리기 ───────────────────────────────────────────────────────

function render(input: ReplyViewInput, replyId: string | null = 'r-0123456789abcdef0123456789abcdef'): string {
  const rest: Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'> = {
    draft: input.draft,
    translation: input.translation,
    facts: input.facts,
    buyerLocale: input.buyerLocale,
    plan: input.plan,
    offerFirst: input.offerFirst,
    mode: input.mode,
    draftSource: input.draftSource,
    riskAfterReply: input.riskAfterReply,
  };
  return renderToStaticMarkup(
    // 예측 어댑터가 쓸 수 없을 때의 칩(코칭·AI 칩)을 본다. 엔진 칩은 app-t079 시험
    createElement(ReplyPanel, {
      disputeId: 'PP-R-TEST-D2',
      base: rest,
      replyId,
      languageKey: 'case.view.lang.KO',
      forecaster: () => null,
      detector: () => null,
    }),
  );
}

describe('답장 칸 그리기', () => {
  it('코칭·영어 초안·한국어 전송본·검사·[Send in Korean]·"Simulated send"', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    // 초안의 `chips`가 빈 배열이면 코칭 줄이 칩으로 보인다 (T068/T069)
    const html = render(base(draft, translation));
    for (const line of COACHING) expect(html).toContain(line);
    expect(html).toContain('November 17');
    expect(html).toContain('11월 17일');
    expect(html).not.toMatch(/⟦|⟧/);
    // T122a 시안 v6: [Send] (언어 이름 없음)
    expect(html).toMatch(/class="reply-button"[^>]*>Send<\/button>/);
    expect(html).toContain('Simulated send');
    // T090: "Code decides" 배지는 그리지 않는다. 검사 줄은 Details 안 (통과면 접혀 있다)
    expect(html).not.toContain(copyTables.en['badge.codeDecides']);
    expect(html).toMatch(/class="reply-details"[^>]*hidden/);
    expect(html).toMatch(/<button[^>]*class="reply-button"(?![^>]*disabled)/);
  });

  it('실제 전송 방식이면 "Live · PayPal sandbox"', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    expect(render(base(draft, translation, { mode: 'live' }))).toContain('Live · PayPal sandbox');
  });

  it('검사에 걸리면 버튼이 꺼져 있고 이유가 보인다', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING.replace('⟦DATE_1⟧', '11월 17일'));
    const html = render(base(draft, translation));
    expect(html).toMatch(/<button[^>]*class="reply-button"[^>]*disabled/);
    expect(html).toContain(copyTables.en['case.send.blocked.checkFailed']);
  });

  it('AI 초안이 없으면 "AI unavailable" + 버튼 꺼짐', () => {
    const html = render(base({ ok: false, reason: 'ai_unavailable', detail: 'llm_failed:LlmConfigError' }, null), null);
    expect(html).toContain('AI unavailable — showing rules only');
    expect(html).toMatch(/<button[^>]*class="reply-button"[^>]*disabled/);
  });

  it('제안이 먼저인 분쟁(지호 꼴)은 버튼 자리에 이유가 보인다', async () => {
    const { draft, translation } = await prepare(DRAFT_EN, OUTGOING);
    const html = render(base(draft, translation, { offerFirst: true }));
    expect(html).toMatch(/<button[^>]*class="reply-button"[^>]*disabled/);
    expect(html).toContain(copyTables.en['case.view.offerFirst']);
  });

  it('정책 밖 약속이 있으면 범주별 확인 상자가 보인다', async () => {
    const { draft, translation } = await prepare(DRAFT_EN_AC18, OUTGOING_AC18);
    const html = render(base(draft, translation));
    expect(html).toContain('I confirm this promise: Refund');
    expect(html).toMatch(/type="checkbox"/);
  });
});

// ── 2부에 함께 넣는 것 1~3번 ─────────────────────────────────────────────

function caseInput(overrides: Partial<CaseViewInput> = {}): CaseViewInput {
  return {
    disputeId: 'PP-R-TEST-D2',
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyer: { name: 'Seo-yeon', language: 'KO' },
    product: { itemName: 'Sweater' },
    messages: caseMessages({ buyerMessages: ['배송이 안 와요'], buyerMessageEn: null, buyerId: 'B01', inquiries: [], includeInquiries: false }),
    boardReal: D2_BEFORE,
    boardDemo: D2_AFTER,
    carrierEvents: [
      { orderId: 'O01', date: '2026-10-18', status: 'shipped', text: 'Shipment picked up', isDemo: true },
      { orderId: 'O01', date: '2026-10-30', status: 'customs_hold', text: CUSTOMS_EVENT, isDemo: true },
    ],
    signals: SEOYEON_START,
    signalsAfterReply: SEOYEON_AFTER_REPLY,
    demoFields: ['carrierEvents', 'hasTracking', 'cause', 'earlierInquiries'],
    ...overrides,
  };
}

const renderCase = (input: CaseViewInput) =>
  renderToStaticMarkup(createElement(CaseView, { view: buildCaseView(input, P, R), llmOk: true }));

// T090: 머리글의 "High · Score 6" 펼침은 뺐다 (위험은 곡선 카드가 보여 준다). 보기용 값은 엔진 그대로 남는다
describe('1번 → T090: 머리글에 위험 점수 펼침이 없다', () => {
  it('"Escalation risk" 카드도, 머리글 배지 버튼도 없다', () => {
    const html = renderCase(caseInput());
    expect(html).not.toMatch(/<h2[^>]*>Escalation risk<\/h2>/);
    expect(html).not.toContain('id="case-risk"');
    expect(html).not.toContain('case-risk-button');
  });

  it('보기용 값(점수 부분·답장 뒤 점수)은 escalationRisk(...) 그대로다', () => {
    const view = buildCaseView(caseInput(), P, R);
    const now = escalationRisk(SEOYEON_START, R);
    expect(view.risk?.parts.map(({ signal, points }) => ({ signal, points }))).toEqual(now.parts);
    expect(view.risk?.parts.map((p) => p.points)).toEqual([3, 2, 1, 0]);
    expect(view.riskAfterReply).toMatchObject({ score: escalationRisk(SEOYEON_AFTER_REPLY, R).score, band: 'Watch' });
  });

  it('신호가 없어도 머리글이 그려진다 (버튼 없음)', () => {
    const html = renderCase(caseInput({ signals: null, signalsAfterReply: null }));
    expect(html).not.toContain('case-risk-button');
    expect(html).toContain('class="case-head"');
  });
});

describe('2번: PayPal 상태를 쉬운 말로', () => {
  // T061 1번: 상태 쉬운 말은 머리글 첫 줄에 들어가고, 원래 코드는 그 줄의 title(마우스를 올리면 보임)로 옮겼다
  it('문구 파일의 case.status.*에서 오고, 원래 코드는 머리글 첫 줄의 title로', () => {
    expect(copyTables.en['case.status.WAITING_FOR_SELLER_RESPONSE']).toBe('Waiting for your reply');
    expect(copyTables.en['case.status.WAITING_FOR_BUYER_RESPONSE']).toBe('Waiting for the buyer');
    expect(copyTables.en['case.status.UNDER_REVIEW']).toBe('PayPal is reviewing');
    expect(copyTables.en['case.status.RESOLVED']).toBe('Resolved');
    const html = renderCase(caseInput());
    expect(html).toContain('Waiting for your reply');
    // T076: 머리글 제목(분쟁 번호 · 상품)의 title로
    expect(html).toMatch(/class="case-title num" title="WAITING_FOR_SELLER_RESPONSE"/);
  });

  it('표에 없는 상태는 원래 코드만', () => {
    expect(statusKeyFor('SOMETHING_NEW')).toBeNull();
    expect(statusKeyFor('')).toBeNull();
    const html = renderCase(caseInput({ statusCode: 'SOMETHING_NEW' }));
    expect(html).toContain('SOMETHING_NEW');
    expect(html).not.toContain('case-status-code');
  });
});

// T061 3번: 옛 원인 칸("PayPal data only: A1 … → …")은 없애고 한 줄 요약으로 바꿨다
describe('3번 (T061): 원인 칸 대신 한 줄 요약', () => {
  const summary = (html: string) => {
    // T068: 요약은 비교 카드 안의 한 줄 (회색 상자 section 대신 div)
    const match = html.match(/<div class="case-summary"[\s\S]*?<\/div>/);
    expect(match).not.toBeNull();
    return match![0];
  };

  it('원인 카드가 없고, 요약은 엔진 원인 전환(A1 → A2)의 문구 + 코드는 보조 글자 (T090: Code decides 배지 없음)', () => {
    const html = renderCase(caseInput());
    expect(html).not.toContain('case-cause-card');
    const box = summary(html);
    expect(box).toContain(copyTables.en['case.view.summary.A1_A2'].replace(/'/g, '&#x27;'));
    expect(box).not.toContain(copyTables.en['badge.codeDecides']);
    expect(box).toMatch(/class="case-summary-codes num">A1 → A2</);
  });

  it('통관 보류 상세 문구는 요약에 없고, T090부터 대화 사이 배송사 줄도 없다', () => {
    const html = renderCase(caseInput());
    expect(summary(html)).not.toContain(CUSTOMS_EVENT);
    expect(html).not.toContain('class="case-carrier-line"');
  });

  it('후 보드가 없으면 전 원인 하나 (전환 문구 없음) + "배송사 정보 없음" 한 줄', () => {
    const box = summary(renderCase(caseInput({ boardDemo: null })));
    expect(box).not.toContain('A1 → A2');
    expect(box).toContain(copyTables.en['case.view.subtype.A1']);
    expect(box).toContain(copyTables.en['case.view.noCarrier']);
  });

  it('짧은 이름 키가 세부 유형 16개 모두 두 문구 파일에 있다', () => {
    for (const s of ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'D1', 'E1', 'F1', 'F2']) {
      expect(typeof copyTables.en[`case.view.subtypeShort.${s}`]).toBe('string');
      expect(typeof copyTables.ko[`case.view.subtypeShort.${s}`]).toBe('string');
    }
  });
});

// ── 문구·정적 검사 ───────────────────────────────────────────────────────

describe('문구·정적 검사', () => {
  const caseKeys = (table: Record<string, string>) => Object.keys(table).filter((key) => key.startsWith('case.')).sort();

  it('두 문구 파일의 case.* 키가 같고, 금지 문구가 없다', () => {
    expect(caseKeys(copyTables.ko)).toEqual(caseKeys(copyTables.en));
    for (const key of caseKeys(copyTables.en)) {
      expect(copyTables.en[key], key).not.toMatch(/guarantee|prediction accuracy|accurate prediction/i);
      expect(copyTables.ko[key], key).not.toMatch(/보장|예측 정확도/);
    }
  });

  it('문구 파일·화면 코드에 답장 문장(시험용 대역 글)이 없다', () => {
    const files = [
      ...filesUnder(path.join(ROOT, 'src/app/cases')),
      path.join(ROOT, 'src/app/_server/send.ts'),
      path.join(ROOT, 'config/copy.en.json'),
      path.join(ROOT, 'config/copy.ko.json'),
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const phrase of ['Sorry for the wait', 'customs code', '기다리게 해서', '개인통관고유부호를 기다리고']) {
        expect(text.includes(phrase), `${path.relative(ROOT, file)}: ${phrase}`).toBe(false);
      }
    }
  });

  it('브라우저 묶음에 들어가는 파일에 스위치 이름·비밀값 이름이 없다', () => {
    const clientFiles = filesUnder(path.join(ROOT, 'src/app/cases')).filter((file) => {
      const text = readFileSync(file, 'utf8');
      return text.startsWith("'use client'") || file.endsWith('reply-model.ts') || file.endsWith('model.ts');
    });
    expect(clientFiles.length).toBeGreaterThan(0);
    for (const file of clientFiles) {
      const text = readFileSync(file, 'utf8');
      expect(/AFTERLOOP_REAL_SEND|AFTERLOOP_FIXED_DRAFT|PAYPAL_CLIENT_SECRET|LLM_API_KEY/.test(text), path.relative(ROOT, file)).toBe(false);
      expect(/_server\//.test(text), path.relative(ROOT, file)).toBe(false);
    }
  });

  it('전송은 서버 액션 → _server/send.ts 한 길뿐이다 (src/app/cases에 executeMove·.call( 없음)', () => {
    for (const file of filesUnder(path.join(ROOT, 'src/app/cases')).filter((f) => /\.(ts|tsx)$/.test(f))) {
      const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(/\.call\(|executeMove|method:\s*'POST'/.test(text), path.relative(ROOT, file)).toBe(false);
    }
    const actions = readFileSync(path.join(ROOT, 'src/app/cases/actions.ts'), 'utf8');
    expect(actions.startsWith("'use server'")).toBe(true);
    expect(actions).not.toMatch(/redirect\(|revalidatePath\(/); // 주소가 바뀌지 않는다
  });
});

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}
