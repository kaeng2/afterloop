/**
 * T009 2부 재시도 (SPEC v2.9 3장 "이름 토큰"·"판매자 화면의 미리보기"·"제안이 먼저인 분쟁의 주 버튼").
 *
 * 기대값 출처: `tasks/T009.md` "2부 재시도" 1~4번과 완료 기준, `reports/T056-impl.md` "화면이 부르는 방법".
 * 실제 PayPal·LLM 호출 없음 — PayPal 읽기는 정해 둔 분쟁을 돌려주는 가짜, LLM은 정해 둔 답을 내고 받은
 * 요청을 모으는 가짜, 전송은 받은 요청을 모으는 가짜 호출기.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { translateReply, type ReplyTranslation } from '@/ai/reply';
import { copyTables } from '@/app/_shared/copy';
import type { LoadedDispute } from '@/app/_shared/dispute-view';
import type { LoadDemoDisputesResult } from '@/app/_server/disputes';
import { buildCaseView, caseMessages, type CaseViewInput } from '@/app/cases/model';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, canSend, canSendOffer, OFFER_STATUS, screenText, type ReplyViewInput } from '@/app/cases/reply-model';
import { CaseView } from '@/app/cases/view/case-view';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import type { ApiRequest, BoardState, Cause, DemoLink, LlmCaller } from '@/types';

import { seedBuyers } from '../../seed/index';
import { D1_JIHO, P, R } from '../acceptance/boards';

// ── 가짜들 ─────────────────────────────────────────────────────────────

type LlmRequest = Parameters<LlmCaller>[0];
const llmCalls: LlmRequest[] = [];
let llmAnswers: unknown[] = [];
const fakeLlm: LlmCaller = async (req) => {
  llmCalls.push(req);
  return llmAnswers[Math.min(llmCalls.length - 1, llmAnswers.length - 1)];
};

let loadedNow: LoadDemoDisputesResult = { disputes: [], paypal: { ok: false }, llm: { ok: false } };

vi.mock('server-only', () => ({}));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputesForRequest: async () => loadedNow,
  loadDemoDisputes: async () => loadedNow,
}));
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: true, llm: fakeLlm }) }));

const { sendReply } = await import('@/app/_server/send');
type PreparedReply = import('@/app/_server/send').PreparedReply;
type SendReplyDeps = import('@/app/_server/send').SendReplyDeps;
const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');

(globalThis as { React?: typeof React }).React = React;

const ROOT = path.resolve(__dirname, '../..');
const NOW = new Date().toISOString();

// ── 공용 입력 ─────────────────────────────────────────────────────────

const ruleCause = (subtype: Cause['subtype'], causeNote?: string): Cause => ({
  subtype,
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
  ...(causeNote === undefined ? {} : { causeNote }),
});

/** 실제 연결 표의 화면 분쟁 번호 (D2 서연, D1 지호). 호출은 모두 가짜다. */
const D2_ID = 'PP-R-GMS-10197661';
const D1_ID = 'PP-R-MBJ-10197650';

const inTwentyDays = new Date(Date.now() + 20 * 24 * 3_600_000).toISOString();

const D2_BASE: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause'> = {
  disputeId: D2_ID,
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: inTwentyDays,
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  buyerPriorInrDisputes: 0,
  isDemo: false,
};
const D2_BEFORE: BoardState = { ...D2_BASE, hasTracking: false, hasDeliveredTracking: false, cause: ruleCause('A1') };
const D2_AFTER: BoardState = {
  ...D2_BASE,
  hasTracking: true,
  hasDeliveredTracking: false,
  isDemo: true,
  cause: ruleCause('A2', 'Customs hold – recipient customs ID missing'),
};
const JIHO: BoardState = { ...D1_JIHO, disputeId: D1_ID, dueDate: inTwentyDays };

const buyer = (id: string) => {
  const found = seedBuyers.find((b) => b.id === id);
  if (found === undefined) throw new Error(`seed buyer ${id}`);
  return found;
};

function loaded(board: BoardState, demo: BoardState | null, buyerId: string, statusCode = OFFER_STATUS): LoadedDispute {
  return {
    key: buyerId,
    disputeId: board.disputeId,
    statusCode,
    buyer: buyer(buyerId),
    product: null,
    buyerMessages: ['배송이 안 와요'],
    boardReal: board,
    boardDemo: demo,
    demoFields: demo === null ? [] : ['hasTracking', 'cause'],
    carrierEvents: [],
    signals: null,
    signalsAfterReply: null,
    liveSendAllowed: true,
  };
}

const result = (...disputes: LoadedDispute[]): LoadDemoDisputesResult => ({ disputes, paypal: { ok: true }, llm: { ok: true } });

const COACHING = ['Say sorry for the wait first.', 'Explain the customs hold in one line.', 'Ask for the customs code.'];
const NAMED_DRAFT = 'Hello ⟦BUYER_NAME_1⟧, sorry for the wait. I will check with the carrier and get back to you by ⟦DATE_1⟧.\n\n⟦SELLER_NAME_1⟧';
const NAMED_OUTGOING = '안녕하세요 ⟦BUYER_NAME_1⟧, 기다리게 해서 죄송해요. ⟦DATE_1⟧까지 운송사에 확인해서 다시 연락드릴게요.\n\n⟦SELLER_NAME_1⟧';
const NAMED_BACK = 'Hello ⟦BUYER_NAME_1⟧, sorry for the wait. I will contact you again by ⟦DATE_1⟧.\n\n⟦SELLER_NAME_1⟧';
// 지호: 제안 초안 (금액은 자리표시자만)
const OFFER_DRAFT = 'Hello ⟦BUYER_NAME_1⟧, I am sorry the color looks different. I can offer {{offerAmount}} back. I will check again by ⟦DATE_1⟧.\n\n⟦SELLER_NAME_1⟧';
const OFFER_OUTGOING = '안녕하세요 ⟦BUYER_NAME_1⟧, 색이 달라 보여 죄송해요. {{offerAmount}}을 돌려드리는 제안을 드려요. ⟦DATE_1⟧까지 다시 확인할게요.\n\n⟦SELLER_NAME_1⟧';

const NAME_VALUES = ['Seo-yeon', '서연', 'Ji-ho', '지호', 'Hannah', 'Fernwood'];

function answer(draftEn: string, outgoing: string, back = NAMED_BACK) {
  llmCalls.length = 0;
  llmAnswers = [
    { buyer_message_en: 'It has not arrived.', coaching: COACHING, draft_en: draftEn },
    { outgoing },
    { back_translation_en: back },
  ];
}

async function freshLoad() {
  vi.resetModules();
  return import('@/app/cases/reply/load');
}

beforeEach(() => {
  llmCalls.length = 0;
});

// ── 1. 배치 ───────────────────────────────────────────────────────────

describe('1번: 대화·배송사 카드는 왼쪽 열에 위아래로', () => {
  const caseInput = (): CaseViewInput => ({
    disputeId: D2_ID,
    statusCode: OFFER_STATUS,
    buyer: { name: 'Test', language: 'KO' },
    product: { itemName: 'Sweater' },
    messages: caseMessages({ buyerMessages: ['배송이 안 와요'], buyerMessageEn: null, buyerId: 'B01', inquiries: [], includeInquiries: false }),
    boardReal: D2_BEFORE,
    boardDemo: D2_AFTER,
    carrierEvents: [{ orderId: 'O01', date: '2026-10-30', status: 'customs_hold', text: 'Customs hold', isDemo: true }],
    signals: null,
    signalsAfterReply: null,
    demoFields: ['carrierEvents'],
  });

  // T061: 배송사 카드는 없애고 배송사 줄이 대화 안으로 들어갔다. 대화와 답장 칸은 넓은 폭에서 두 칸이다
  it('순서: 비교(case-hero) → 대화(case-body 안), 배송사 줄은 대화 안. 따로 있던 배송사 카드가 없다', () => {
    const html = renderToStaticMarkup(createElement(CaseView, { view: buildCaseView(caseInput(), P, R), llmOk: true }));
    expect(html).not.toContain('id="case-carrier"');
    const body = html.indexOf('class="case-body');
    const conversation = html.indexOf('id="case-conversation"');
    const carrierLine = html.indexOf('class="case-carrier-line"');
    expect(html.indexOf('case-hero')).toBeLessThan(body);
    expect(conversation).toBeGreaterThan(body);
    expect(carrierLine).toBeGreaterThan(conversation);
  });

  it('CSS: 대화 | 답장 두 칸은 오른쪽 칸 폭이 넉넉할 때만 (컨테이너 질의), 기본은 한 열', () => {
    const css = readFileSync(path.join(ROOT, 'src/app/cases/view/case.css'), 'utf8');
    const block = css.match(/\.case-body\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(css).toMatch(/@container \(min-width: [0-9.]+rem\)/);
    expect(css).not.toContain('.case-columns');
  });
});

// ── 2. 이름 ───────────────────────────────────────────────────────────

describe('2번: 이름 토큰 — 값은 AI에 가지 않고 코드가 채운다', () => {
  it('서버 경로(loadCaseDraft → translateReply): system·user에 이름 값이 없고 <facts>에 이름 토큰 두 줄', async () => {
    loadedNow = result(loaded(D2_BEFORE, D2_AFTER, 'B01'));
    answer(NAMED_DRAFT, NAMED_OUTGOING);
    const { loadReply } = await freshLoad();
    const reply = await loadReply(D2_ID);
    expect(reply).not.toBeNull();
    expect(llmCalls.length).toBe(3); // 초안 1 + 번역 1 + 역번역 1
    for (const call of llmCalls) {
      const text = `${call.system}\n${call.user}`;
      for (const name of NAME_VALUES) expect(text, name).not.toContain(name);
    }
    for (const call of llmCalls.slice(0, 2)) {
      expect(call.user).toContain('⟦BUYER_NAME_1⟧ (BUYER_NAME)');
      expect(call.user).toContain('⟦SELLER_NAME_1⟧ (SELLER_NAME)');
    }
  });

  it('미리보기: 영어 "Hello Seo-yeon," · 끝 "Hannah, Fernwood Knits" / 한국어 "안녕하세요 서연 님," (호칭 겹침 없음), 보내기 켜짐', async () => {
    loadedNow = result(loaded(D2_BEFORE, D2_AFTER, 'B01'));
    answer(NAMED_DRAFT, NAMED_OUTGOING);
    const { loadReply } = await freshLoad();
    const reply = (await loadReply(D2_ID))!;
    const view = buildReplyView({ ...reply.base, confirmed: [], sendState: 'idle', outcome: null });
    expect(view.draftEn?.text.startsWith('Hello Seo-yeon,')).toBe(true);
    expect(view.draftEn?.text.endsWith('Hannah, Fernwood Knits')).toBe(true);
    expect(view.outgoing?.text.startsWith('안녕하세요 서연 님,')).toBe(true);
    expect(view.outgoing?.text).not.toContain('님 님');
    expect(view.outgoing?.text.endsWith('Hannah, Fernwood Knits')).toBe(true);
    expect(view.backTranslationEn?.startsWith('Hello Seo-yeon,')).toBe(true);
    expect(canSend(view)).toEqual({ ok: true, reasonKey: null });
    // 사실값 줄에 이름 두 줄 (전송본 꼴)
    expect(view.factRows.map((row) => [row.labelKey, row.value])).toEqual(
      expect.arrayContaining([
        ['case.reply.fact.BUYER_NAME', '서연 님'],
        ['case.reply.fact.SELLER_NAME', 'Hannah, Fernwood Knits'],
      ]),
    );
  });

  it('이름 토큰이 전송본에서 빠지면 missing → 보낼 수 없다', async () => {
    const facts = caseReplyFacts({ now: NOW, dueDate: inTwentyDays, buyerId: 'B01', buyerLocale: 'ko' });
    const translation = await translateReply(
      { draftEn: NAMED_DRAFT, buyerLocale: 'ko', facts: facts.outgoing, move: 'fight' },
      {
        llm: (() => {
          let n = 0;
          const answers = [{ outgoing: NAMED_OUTGOING.replace('⟦BUYER_NAME_1⟧', '고객') }, { back_translation_en: 'Hello, sorry.' }];
          return async () => answers[Math.min(n++, 1)];
        })(),
      },
    );
    expect(translation.ok).toBe(true);
    if (!translation.ok) return;
    expect(translation.check.missing).toContain('⟦BUYER_NAME_1⟧');
    expect(translation.sendable).toBe(false);
  });

  it('호칭 겹침("⟦BUYER_NAME_1⟧ 님") → 검사 줄 실패 + 보내기 꺼짐 + 서버도 호출 0회', async () => {
    loadedNow = result(loaded(D2_BEFORE, D2_AFTER, 'B01'));
    answer(NAMED_DRAFT, NAMED_OUTGOING.replace('⟦BUYER_NAME_1⟧,', '⟦BUYER_NAME_1⟧ 님,'));
    const { loadReply } = await freshLoad();
    const reply = (await loadReply(D2_ID))!;
    const view = buildReplyView({ ...reply.base, confirmed: [], sendState: 'idle', outcome: null });
    const row = view.checkRows.find((r) => r.labelKey === 'case.reply.check.nameHonorific');
    expect(row?.ok).toBe(false);
    expect(canSend(view)).toEqual({ ok: false, reasonKey: 'case.send.blocked.nameHonorific' });
    expect(copyTables.en['case.send.blocked.nameHonorific']).toBeTruthy();

    const translation = reply.base.translation as Extract<ReplyTranslation, { ok: true }>;
    const f = sendFakes('live', loadedNow);
    const outcome = await sendReply(
      { disputeId: D2_ID, reply: prepared(D2_ID, NAMED_DRAFT, translation, reply.base.facts), confirmedCommitments: [], approved: true },
      f.deps,
    );
    expect(outcome).toMatchObject({ ok: false, failure: 'blocked', error: copyTables.en['case.send.error.nameHonorific'] });
    expect(f.calls.length).toBe(0);
  });

  it('표에 없는 구매자(buyer_m, B04)는 구매자 이름 토큰이 없고 서명만 있다', () => {
    const facts = caseReplyFacts({ now: NOW, dueDate: inTwentyDays, buyerId: 'B04', buyerLocale: 'en' });
    expect(facts.draft.map((f) => f.kind)).toEqual(['DATE', 'SELLER_NAME']);
    expect(facts.outgoing.map((f) => f.kind)).toEqual(['DATE', 'SELLER_NAME']);
    expect(facts.outgoing.find((f) => f.kind === 'SELLER_NAME')?.value).toBe('Hannah, Fernwood Knits');
    // 구매자 ID가 없을 때도 같다
    expect(caseReplyFacts({ now: NOW, dueDate: inTwentyDays, buyerId: null, buyerLocale: 'ko' }).outgoing.map((f) => f.kind)).toEqual([
      'DATE',
      'SELLER_NAME',
    ]);
  });

  it('화면 코드에 이름 값을 직접 쓰지 않는다 (src/app/cases, src/app/_server)', () => {
    const files = [
      'src/app/cases/reply-facts.ts',
      'src/app/cases/reply-model.ts',
      'src/app/cases/reply/load.ts',
      'src/app/cases/reply/reply-panel.tsx',
      'src/app/cases/view/load.ts',
      'src/app/_server/send.ts',
    ];
    for (const file of files) {
      const text = readFileSync(path.join(ROOT, file), 'utf8');
      for (const name of NAME_VALUES) expect(text, `${file}: ${name}`).not.toContain(name);
    }
  });
});

// ── 3. 미리보기 = 실제로 나갈 글자 ─────────────────────────────────────

describe('3번: 미리보기는 채운 값으로, 보내는 글 미리보기 = 실제 전송될 글자', () => {
  it('서연: 화면 전송본 미리보기와 send-message 본문 message가 글자까지 같다. {{·⟦가 남지 않는다', async () => {
    loadedNow = result(loaded(D2_BEFORE, D2_AFTER, 'B01'));
    answer(NAMED_DRAFT.replace('sorry for the wait.', 'sorry for the wait on your {{disputeAmount}} order.'),
      NAMED_OUTGOING.replace('죄송해요.', '죄송해요. {{disputeAmount}} 주문 건이에요.'));
    const { loadReply } = await freshLoad();
    const reply = (await loadReply(D2_ID))!;
    const view = buildReplyView({ ...reply.base, confirmed: [], sendState: 'idle', outcome: null });
    for (const text of [view.draftEn!.text, view.outgoing!.text, view.backTranslationEn!, ...view.coaching]) {
      expect(text).not.toMatch(/\{\{|⟦/);
    }
    expect(view.outgoing!.text).toContain('$72.00');

    const translation = reply.base.translation as Extract<ReplyTranslation, { ok: true }>;
    const draftEn = (reply.base.draft as { draftEn: string }).draftEn;
    const f = sendFakes('live', loadedNow);
    const outcome = await sendReply(
      { disputeId: D2_ID, reply: prepared(D2_ID, draftEn, translation, reply.base.facts), confirmedCommitments: [], approved: true },
      f.deps,
    );
    expect(outcome).toMatchObject({ ok: true, mode: 'live', endpoint: 'send-message' });
    expect(f.calls.length).toBe(1);
    expect(f.calls[0].body).toEqual({ message: view.outgoing!.text });
  });

  it('screenText는 전송 경로와 같은 두 단계다: 금액 출처가 없으면 {{…}}를 채우지 못한 것으로 본다', () => {
    const facts = caseReplyFacts({ now: NOW, dueDate: inTwentyDays, buyerId: 'B02', buyerLocale: 'ko' }).outgoing;
    const plan = planMove(JIHO, recommend(JIHO, P, R).best!, P, R);
    expect(screenText(OFFER_OUTGOING, facts, 'ko', null).filled).toBe(false);
    const filled = screenText(OFFER_OUTGOING, facts, 'ko', { plan, board: JIHO });
    expect(filled.filled).toBe(true);
    expect(filled.text).toContain('$7.20');
    expect(filled.text.startsWith('안녕하세요 지호 님,')).toBe(true);
  });
});

// ── 4. 지호: 주 버튼 "Send offer · $7" ───────────────────────────────

describe('4번: 지호 — 주 버튼은 엔진 제안 금액, 메시지 버튼은 꺼짐', () => {
  async function jihoReply(statusCode = OFFER_STATUS) {
    loadedNow = result(loaded(JIHO, null, 'B02', statusCode));
    answer(OFFER_DRAFT, OFFER_OUTGOING, 'Hello ⟦BUYER_NAME_1⟧, I offer {{offerAmount}}.\n\n⟦SELLER_NAME_1⟧');
    const { loadReply } = await freshLoad();
    const reply = (await loadReply(D1_ID))!;
    expect(reply).not.toBeNull();
    return reply;
  }

  it('주 버튼 이름 "Send offer · $7" — 금액은 planMove(recommend(...).best)의 amountCents를 달러 반올림', async () => {
    const reply = await jihoReply();
    const view = buildReplyView({ ...reply.base, confirmed: [], sendState: 'idle', outcome: null });
    const engine = planMove(JIHO, recommend(JIHO, P, R).best!, P, R);
    expect(engine.apiMove).toBe('make_offer');
    expect(view.offer).toEqual({ amountCents: engine.amountCents, amountDisplay: '$7' });
    expect(canSendOffer(view)).toEqual({ ok: true, reasonKey: null });
    expect(canSend(view)).toEqual({ ok: false, reasonKey: 'case.view.offerFirst' });
    expect(llmCalls[0].user).toContain('offer'); // 초안은 move: 'offer'로 만든다

    const html = renderToStaticMarkup(
      createElement(ReplyPanel, { disputeId: D1_ID, base: reply.base, replyId: reply.replyId, languageKey: reply.languageKey }),
    );
    expect(html).toContain(copyTables.en['case.send.offerButton'].replace('{{amount}}', '$7'));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Send in Korean<\/button>/);
    expect(html).toContain(copyTables.en['case.view.offerFirst']);
    // 보내는 글 미리보기에 남은 토큰 없음
    expect(view.outgoing?.text).not.toMatch(/\{\{|⟦/);
  });

  it('PayPal 상태가 WAITING_FOR_SELLER_RESPONSE가 아니면 제안 버튼이 꺼지고 이유가 보인다', async () => {
    const reply = await jihoReply('UNDER_REVIEW');
    const view = buildReplyView({ ...reply.base, confirmed: [], sendState: 'idle', outcome: null });
    expect(canSendOffer(view)).toEqual({ ok: false, reasonKey: 'case.send.blocked.offerStatus' });
  });

  it('화면 코드에 제안 금액(7·700·720)을 쓰지 않는다', () => {
    for (const file of ['src/app/cases/reply-model.ts', 'src/app/cases/reply/reply-panel.tsx', 'src/app/_server/send.ts']) {
      const code = readFileSync(path.join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/\b(?:700|720)\b|\$7\b/);
    }
  });

  describe('서버: 제안은 같은 관문을 모두 지난다 (가짜 호출기)', () => {
    async function preparedJiho(statusCode = OFFER_STATUS) {
      const reply = await jihoReply(statusCode);
      const translation = reply.base.translation as Extract<ReplyTranslation, { ok: true }>;
      expect(translation.ok).toBe(true);
      return { reply, preparedReply: prepared(D1_ID, (reply.base.draft as { draftEn: string }).draftEn, translation, reply.base.facts) };
    }

    it('스위치 꺼짐(가짜 전송) → 실제 호출 0회', async () => {
      const { preparedReply } = await preparedJiho();
      const f = sendFakes('simulated', loadedNow);
      const outcome = await sendReply({ disputeId: D1_ID, kind: 'offer', reply: preparedReply, confirmedCommitments: [], approved: true }, f.deps);
      expect(outcome).toEqual({ ok: true, mode: 'simulated', disputeId: D1_ID });
      expect(f.calls.length).toBe(0);
      expect(f.simulated.length).toBe(1);
    });

    it('스위치 "1" + liveSendAllowed → make-offer 1회, note = 화면의 채운 한국어 글, send-message 0회. 같은 계획 두 번 → 1회', async () => {
      const { reply, preparedReply } = await preparedJiho();
      const view = buildReplyView({ ...reply.base, confirmed: [], sendState: 'idle', outcome: null });
      const f = sendFakes('live', loadedNow);
      const input = { disputeId: D1_ID, kind: 'offer' as const, reply: preparedReply, confirmedCommitments: [], approved: true };
      const outcome = await sendReply(input, f.deps);
      expect(outcome).toMatchObject({ ok: true, mode: 'live', endpoint: 'make-offer', status: 200 });
      expect(f.calls.length).toBe(1);
      expect(f.calls[0].path).toBe(`/v1/customer/disputes/${D1_ID}/make-offer`);
      const engine = planMove(JIHO, recommend(JIHO, P, R).best!, P, R);
      expect(f.calls[0].body).toMatchObject({ note: view.outgoing!.text, offer_type: engine.refundType, offer_amount: { currency_code: 'USD', value: '7.20' } });
      expect(String(f.calls[0].body.note)).toContain('지호 님');
      expect(f.calls.some((call) => call.path.endsWith('/send-message'))).toBe(false);

      await sendReply(input, f.deps);
      expect(f.calls.length).toBe(1);
    });

    it('메시지로 보내려 하면 거부 (제안이 먼저) — 호출 0회', async () => {
      const { preparedReply } = await preparedJiho();
      const f = sendFakes('live', loadedNow);
      const outcome = await sendReply({ disputeId: D1_ID, kind: 'message', reply: preparedReply, confirmedCommitments: [], approved: true }, f.deps);
      expect(outcome).toMatchObject({ ok: false, failure: 'blocked' });
      expect(f.calls.length).toBe(0);
    });

    it('liveSendAllowed: false · 연습용 · 옛 서연 · 표 밖 → 0회', async () => {
      const { preparedReply } = await preparedJiho();
      const cases: { links: DemoLink[]; id: string }[] = [
        { id: D1_ID, links: [{ paypalDisputeId: D1_ID, seedDisputeId: 'D1', carrierOrderId: 'O02', showOnScreen: true, liveSendAllowed: false }] },
        { id: 'PP-R-HEY-10197767', links: [] }, // 실제 표의 연습용 (showOnScreen false)
        { id: 'PP-R-GAH-10197649', links: [] }, // 실제 표의 옛 서연 (showOnScreen false)
        { id: 'PP-R-NOPE-1', links: [] },
      ];
      for (const { id, links } of cases) {
        const f = sendFakes('live', loadedNow, links.length === 0 ? undefined : links);
        const outcome = await sendReply({ disputeId: id, kind: 'offer', reply: { ...preparedReply, disputeId: id }, confirmedCommitments: [], approved: true }, f.deps);
        expect(outcome.ok, id).toBe(false);
        expect(f.calls.length, id).toBe(0);
      }
    });

    it('PayPal 상태가 WAITING_FOR_SELLER_RESPONSE가 아니면 0회', async () => {
      const { preparedReply } = await preparedJiho();
      const f = sendFakes('live', result(loaded(JIHO, null, 'B02', 'UNDER_REVIEW')));
      const outcome = await sendReply({ disputeId: D1_ID, kind: 'offer', reply: preparedReply, confirmedCommitments: [], approved: true }, f.deps);
      expect(outcome).toMatchObject({ ok: false, failure: 'blocked', error: copyTables.en['case.send.error.offerStatus'] });
      expect(f.calls.length).toBe(0);
    });

    it('승인 없음 · 판매자 글이 이미 있음 · 토큰 검사 실패 → 0회', async () => {
      const { preparedReply } = await preparedJiho();
      const base = { disputeId: D1_ID, kind: 'offer' as const, confirmedCommitments: [], approved: true };

      const noApproval = sendFakes('live', loadedNow);
      expect((await sendReply({ ...base, reply: preparedReply, approved: false }, noApproval.deps)).ok).toBe(false);
      expect(noApproval.calls.length).toBe(0);

      const replied = sendFakes('live', loadedNow, undefined, true);
      expect(await sendReply({ ...base, reply: preparedReply }, replied.deps)).toMatchObject({ ok: false, failure: 'already_replied' });
      expect(replied.calls.length).toBe(0);

      const broken = sendFakes('live', loadedNow);
      const tampered = { ...preparedReply, outgoing: preparedReply.outgoing.replace('⟦BUYER_NAME_1⟧', '고객') };
      expect(await sendReply({ ...base, reply: tampered }, broken.deps)).toMatchObject({ ok: false, failure: 'blocked' });
      expect(broken.calls.length).toBe(0);
    });

    it('서연(추천 = 다투기) 분쟁에 제안을 보내려 하면 거부 — 0회', async () => {
      loadedNow = result(loaded(D2_BEFORE, D2_AFTER, 'B01'));
      answer(NAMED_DRAFT, NAMED_OUTGOING);
      const { loadReply } = await freshLoad();
      const reply = (await loadReply(D2_ID))!;
      const translation = reply.base.translation as Extract<ReplyTranslation, { ok: true }>;
      const f = sendFakes('live', loadedNow);
      const outcome = await sendReply(
        { disputeId: D2_ID, kind: 'offer', reply: prepared(D2_ID, NAMED_DRAFT, translation, reply.base.facts), confirmedCommitments: [], approved: true },
        f.deps,
      );
      expect(outcome).toMatchObject({ ok: false, failure: 'blocked', error: copyTables.en['case.send.error.offerNotRecommended'] });
      expect(f.calls.length).toBe(0);
    });
  });
});

// ── 도우미 ─────────────────────────────────────────────────────────────

function prepared(
  disputeId: string,
  draftEn: string,
  translation: Extract<ReplyTranslation, { ok: true }>,
  facts: ReplyViewInput['facts'],
): PreparedReply {
  return {
    disputeId,
    draftSource: 'ai',
    draftEn,
    outgoing: translation.outgoing,
    outsidePolicy: translation.outsidePolicy,
    addedInTranslation: translation.addedInTranslation,
    nameProblems: translation.nameProblems,
    facts,
    buyerLocale: 'ko',
  };
}

/** 실제 호출기 자리에 넣는 가짜 (요청을 모은다). 호출기는 이 묶음마다 하나 (중복 방지 기억이 호출기별이다). */
function sendFakes(mode: 'live' | 'simulated', load: LoadDemoDisputesResult, links?: DemoLink[], sellerReplied = false) {
  const calls: ApiRequest[] = [];
  const simulated: ApiRequest[] = [];
  const deps: SendReplyDeps = {
    mode,
    load: async () => load,
    readDetail: async (disputeId) => ({
      dispute_id: disputeId,
      messages: sellerReplied ? [{ posted_by: 'SELLER', content: 'hi', time_posted: NOW }] : [{ posted_by: 'BUYER', content: '...', time_posted: NOW }],
    }) as unknown as Awaited<ReturnType<SendReplyDeps['readDetail']>>,
    liveCall: async (req) => {
      calls.push(req);
      return { status: 200, body: {} };
    },
    simulatedCall: async (req) => {
      simulated.push(req);
      return { status: 200, body: {} };
    },
    now: NOW,
    params: P,
    rules: R,
    ...(links === undefined ? {} : { links }),
  };
  return { deps, calls, simulated };
}
