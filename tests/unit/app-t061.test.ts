/**
 * T061 단위 테스트: 서연 상세 합치기 (오른쪽 칸 한 프레임) + 전송 상태 표시 + 연습용 실패 화면 + Today 목록 손질.
 *
 * 기대값 출처: `tasks/T061.md` "완료 기준"과 각 절, 1.5차 리뷰 고칠 것 ①~③ (사람 승인 2026-11-10).
 * **실호출 0회** — PayPal 읽기·전송과 LLM은 모두 가짜다. `.env`를 읽지 않는다.
 * 숫자 기대값은 적어 두지 않고 엔진·가정값과 같은지로 본다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { copyTables, t } from '@/app/_shared/copy';
import { linkFor } from '@/app/_shared/demo-links';
import type { LoadDemoDisputesResult } from '@/app/_server/disputes';
import { buildCaseView, caseMessages, segmentsOf, summaryOf, type CaseViewInput } from '@/app/cases/model';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, sendModeKey, visibleChecks, type ReplyViewInput } from '@/app/cases/reply-model';
import { CaseView, headLine } from '@/app/cases/view/case-view';
import { Conversation, timeline } from '@/app/cases/view/conversation';
import { buildCaseDesk } from '@/app/cases/desk-model';
import { recommend } from '@/engine/recommend';
import { toDollarsRounded } from '@/app/_shared/money';
import { buildToday, routineLine, decideFor } from '@/app/today/model';
import { TodayList } from '@/app/today/today-list';
import { CARD_COMPANY_TERMS } from '@/engine/signals';
import type { ApiRequest, BoardState, Cause, DemoLink, EscalationSignals, FactToken, LlmCaller, Params, SeedBuyer, SeedProduct } from '@/types';

import { P, R } from '../acceptance/boards';
import { seedBuyers, seedProducts } from '../../seed/index';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
// 답장 칸이 부르는 서버 액션 → send.ts → disputes.ts: PayPal을 읽지 않는 가짜로
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputes: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }),
  loadDemoDisputesForRequest: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }),
}));
(globalThis as { React?: typeof React }).React = React;

const { resolveSendMode, sendReply } = await import('@/app/_server/send');
const { applySimulatedFailure, liveSendAllowedFor, resolveSimulatedFailure, SIMULATED_FAILURES } = await import(
  '@/app/cases/practice'
);
type PreparedReply = import('@/app/_server/send').PreparedReply;
type SendReplyDeps = import('@/app/_server/send').SendReplyDeps;
const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');
const { TopBar } = await import('@/app/_shared/top-bar');

const ROOT = path.resolve(__dirname, '../..');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

// ── 공용 입력 (서연 꼴) ────────────────────────────────────────────────

const ruleCause = (subtype: Cause['subtype'], causeNote?: string): Cause => ({
  subtype,
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
  ...(causeNote === undefined ? {} : { causeNote }),
});

const ID = 'PP-R-TEST-D2';
const CUSTOMS_EVENT = 'Customs hold – recipient customs ID missing';
const D2_BASE: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause'> = {
  disputeId: ID,
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
const D2_BEFORE: BoardState = { ...D2_BASE, hasTracking: false, hasDeliveredTracking: false, cause: ruleCause('A1') };
const D2_AFTER: BoardState = { ...D2_BASE, hasTracking: true, hasDeliveredTracking: false, isDemo: true, cause: ruleCause('A2', CUSTOMS_EVENT) };

const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};

const SEOYEON = seedBuyers.find((b) => b.id === 'B01') as SeedBuyer;
const SWEATER = seedProducts.find((p) => p.sku === 'FK-SW-NV') as SeedProduct;
const REAL_KO = '벌써 3주째인데 아직도 안 왔어요. 연락 없으면 카드사에 이의제기할게요.';
const REAL_EN = "It's been 3 weeks and it still hasn't arrived. If I don't hear back, I'll file a dispute with my card company.";
const INQUIRY = { date: '2026-11-02', buyerId: 'B01', original: '배송 조회가 일주일째 그대로예요.', english: 'Tracking has not changed in a week.' };

function input(overrides: Partial<CaseViewInput> = {}): CaseViewInput {
  return {
    disputeId: ID,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyer: { name: SEOYEON.name, language: SEOYEON.language },
    product: { itemName: SWEATER.itemName },
    messages: caseMessages({ buyerMessages: [REAL_KO], buyerMessageEn: REAL_EN, buyerId: 'B01', inquiries: [INQUIRY], includeInquiries: true }),
    boardReal: D2_BEFORE,
    boardDemo: D2_AFTER,
    carrierEvents: [
      { orderId: 'O01', date: '2026-10-18', status: 'shipped', text: 'Shipment picked up', isDemo: true },
      { orderId: 'O01', date: '2026-10-30', status: 'customs_hold', text: CUSTOMS_EVENT, isDemo: true },
    ],
    signals: SIGNALS,
    signalsAfterReply: { ...SIGNALS, secondMessageUnanswered: false, unansweredOver24h: false, angryTone: null },
    demoFields: ['carrierEvents', 'hasTracking', 'cause', 'earlierInquiries'],
    ...overrides,
  };
}

const VIEW = buildCaseView(input(), P, R);
// T076: 시안 v4 칸 (선택지 카드 = 엔진 recommend. 예측 어댑터 없음 = null)
const DESK = buildCaseDesk({
  view: VIEW,
  board: D2_AFTER,
  buyer: SEOYEON,
  productName: SWEATER.itemName,
  openDays: 3,
  recommendation: recommend(D2_AFTER, P, R),
  moveForecasts: null,
  history: null,
  curvePoints: null,
  band: VIEW.risk?.band ?? null,
});
const CASE_HTML = html(createElement(CaseView, { view: VIEW, desk: DESK, llmOk: true }));

// ── 1. 머리글 ──────────────────────────────────────────────────────────

describe('1번: 머리글 (T076 시안 v4) + 작은 위험 배지', () => {
  it('제목 "<PayPal 분쟁 번호> · <상품>" + 범주 알약, 둘째 줄 "$72 · Seo-yeon Kim · Korea · reads Korean · Open N days"', () => {
    // 옛 첫 줄 꼴(headLine)은 화면 읽기·시험용으로 남아 있다
    expect(headLine(VIEW.header)).toBe(
      `Case ${ID} · ${SWEATER.itemName.split(',')[0].trim()} ${toDollarsRounded(D2_BASE.amountCents)} · ${copyTables.en['case.status.WAITING_FOR_SELLER_RESPONSE']}`,
    );
    const title = CASE_HTML.match(/<h2 class="case-title num"[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? '';
    expect(text(title)).toBe(`${ID} · ${SWEATER.itemName.split(',')[0].trim()}`);
    expect(CASE_HTML).toContain('Not received · Customs hold');
    const meta = CASE_HTML.match(/<p class="case-meta num">([\s\S]*?)<\/p>/)?.[1] ?? '';
    expect(text(meta).trim()).toBe(
      `${toDollarsRounded(D2_BASE.amountCents)} · Seo-yeon Kim · Korea · reads Korean · Open 3 days · ${copyTables.en['case.status.WAITING_FOR_SELLER_RESPONSE']}`,
    );
    // T090: 머리글의 "High · Score 6" 펼침은 뺐다 (위험은 곡선 카드)
    expect(CASE_HTML).not.toContain('case-risk-button');
  });
});

// ── 2. 선택지 카드 (T076: 비교 카드 → 엔진 수별 카드) ──────────────────────

describe('2번: 선택지 카드와 대응 시간 비용', () => {
  it('대응 시간 비용(timeCostCents)은 보기용 값에 남아 있고, 환불 카드의 기대 손실은 recommend 값 그대로', () => {
    expect(VIEW.compare.before.move).toBe('refund');
    expect(VIEW.compare.before.timeCost).toEqual({ cents: P.timeCostCents, display: toDollarsRounded(P.timeCostCents) });
    expect(VIEW.compare.after?.timeCost).toBeNull();
    const refund = recommend(D2_AFTER, P, R).all.find((e) => e.move === 'refund');
    expect(DESK.choices.find((c) => c.move === 'refund')?.expectedLoss?.cents).toBe(refund?.expectedLossCents);
  });

  it('가정값을 바꾸면 따라 바뀐다 (숫자를 적어 두지 않았다)', () => {
    const P2: Params = { ...P, timeCostCents: 500 };
    expect(buildCaseView(input(), P2, R).compare.before.timeCost?.display).toBe(toDollarsRounded(500));
  });

  it('Assumption 배지(단계 머리)가 남아 있고, T090부터 "PayPal data only" 줄은 카드 아래에 없다 (답장 칸 Details로)', () => {
    const step = CASE_HTML.slice(CASE_HTML.indexOf('class="desk-step"'));
    expect(step).toContain(copyTables.en['badge.assumption']);
    expect(step).not.toContain('PayPal data only');
    expect(DESK.paypalOnly).toContain('PayPal data only');
  });
});

// ── 3. 한 줄 요약 ──────────────────────────────────────────────────────

describe('3번: 한 줄 요약은 엔진 원인 전환에서', () => {
  it('전 A1 → 후 A2 = case.view.summary.A1_A2, Code decides (보기용 값). T090: 선택지 카드가 있으면 화면에 그리지 않는다', () => {
    expect(VIEW.summary).toEqual({ key: 'case.view.summary.A1_A2', badge: 'codeDecides', codes: { before: 'A1', after: 'A2' }, needsReview: false });
    expect(text(CASE_HTML)).not.toContain(copyTables.en['case.view.summary.A1_A2']);
    // 선택지 카드 없이 그리면(desk 없음) 요약 한 줄이 남는다
    expect(text(html(createElement(CaseView, { view: VIEW, llmOk: true })))).toContain(copyTables.en['case.view.summary.A1_A2']);
  });

  it('원인이 바뀌면 키도 바뀐다 (문구가 없는 전환은 후 원인의 이름)', () => {
    const lost = buildCaseView(input({ boardDemo: { ...D2_AFTER, cause: ruleCause('A3') } }), P, R);
    expect(lost.summary?.key).toBe('case.view.subtype.A3');
    expect(summaryOf(null, null)).toBeNull();
  });

  it('"Not shipped"는 화면 어디에도 없다 (문구 파일 영어·그린 화면)', () => {
    for (const [key, value] of Object.entries(copyTables.en)) expect(value, key).not.toMatch(/not shipped/i);
    expect(CASE_HTML).not.toMatch(/not shipped/i);
    expect(html(createElement(CaseView, { view: buildCaseView(input({ boardDemo: null }), P, R), llmOk: true }))).not.toMatch(
      /not shipped/i,
    );
  });

  it('원인 카드가 없다', () => {
    expect(CASE_HTML).not.toContain('case-cause-card');
  });
});

// ── 4. 대화 ────────────────────────────────────────────────────────────

describe('4번: 대화 — 한국어가 기본, 영어는 아래 작게', () => {
  const conv = html(createElement(Conversation, { messages: VIEW.messages, carrierLine: VIEW.carrierLine, locale: 'ko' }));

  it('말풍선마다 원문(lang=ko, 큰 글자)이 먼저, 아래 한 줄 "Translated · 영어(lang=en, 작은 글자) · 날짜" (T090)', () => {
    const bubbles = conv.match(/<li class="case-bubble-wrap">[\s\S]*?<\/li>/g) ?? [];
    expect(bubbles.length).toBe(2);
    for (const bubble of bubbles) {
      const ko = bubble.indexOf('class="case-bubble-original" lang="ko"');
      const sub = bubble.indexOf('class="case-bubble-sub"');
      const en = bubble.indexOf('lang="en"');
      expect(ko).toBeGreaterThan(0);
      expect(sub).toBeGreaterThan(ko);
      expect(en).toBeGreaterThan(sub);
      expect(text(bubble.slice(bubble.indexOf('>', sub) + 1)).trim()).toMatch(new RegExp(`^${copyTables.en['case.view.translated']} · `));
    }
    expect(conv).not.toContain('Show original');
    const css = readFileSync(path.join(ROOT, 'src/app/cases/view/case.css'), 'utf8');
    expect(css.match(/\.case-bubble-original\s*\{[^}]*font-size:\s*var\(--text-md\)/)).not.toBeNull();
    expect(css.match(/\.case-bubble-sub\s*\{[^}]*font-size:\s*var\(--text-xs\)/)).not.toBeNull();
  });

  it('T090: 말풍선에는 출처 배지 대신 "AI read" 태그 줄(있는 판정만)만 — AI suggests·Code decides 배지 없음', () => {
    expect(conv).not.toContain('Code decides');
    expect(conv).not.toContain('class="ai-pill"');
  });

  it('강조: 한국어 "카드사에 이의제기", 영어 밑줄은 "dispute with my card company"까지', () => {
    const marks = [...conv.matchAll(/<mark class="case-mark"[^>]*>([^<]*)<\/mark>/g)].map((m) => m[1]);
    expect(marks).toContain('카드사에 이의제기');
    expect(marks).toContain('dispute with my card company');
    expect(segmentsOf('call my bank. Then card company', CARD_COMPANY_TERMS).filter((s) => s.mark).map((s) => s.text)).toEqual([
      'my bank',
      'card company',
    ]); // 문장 부호가 끼면 잇지 않는다
  });

  it('날짜 순: Nov 2 문의 → 날짜 모르는 실제 글. T090: 대화 사이 배송사 줄("Carrier: Customs hold")은 그리지 않는다', () => {
    const order = timeline(VIEW.messages, VIEW.carrierLine).map((e) => (e.kind === 'carrier' ? 'carrier' : e.message.source));
    expect(order).toEqual(['carrier', 'demo', 'paypal']);
    expect(conv).not.toContain('class="case-carrier-line"');
    expect(text(conv)).not.toContain(`Oct 30 · Carrier: ${CUSTOMS_EVENT}`);
    const items = conv.match(/<li class="case-bubble-wrap">[\s\S]*?<\/li>/g) ?? [];
    expect(items[0]).toContain(copyTables.en['badge.demo']);
  });

  it('따로 있던 배송사 카드가 없다', () => {
    expect(CASE_HTML).not.toContain('id="case-carrier"');
  });
});

// ── 5~7. 답장 칸 ───────────────────────────────────────────────────────

const NOW = '2026-11-10T03:00:00Z';
const FACTS: FactToken[] = caseReplyFacts({ now: NOW, dueDate: D2_BASE.dueDate, buyerId: null, buyerLocale: 'ko' }).outgoing;
const DRAFT_EN =
  "Sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧.";
const OUTGOING =
  '기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요.';
const COACHING = ['Say sorry first.', 'Explain the hold.', 'Ask for the code.', 'Pass it on.', 'Give a date.'];

function fakeLlm(...answers: unknown[]): LlmCaller {
  let n = 0;
  return async () => answers[Math.min(n++, answers.length - 1)];
}

async function prepare(): Promise<{ draft: ReplyDraft; translation: ReplyTranslation }> {
  const draft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: D2_AFTER.cause as Cause, move: 'fight', facts: FACTS },
    { llm: fakeLlm({ buyer_message_en: 'It has not arrived.', coaching: COACHING, draft_en: DRAFT_EN }) },
  );
  const translation = await translateReply(
    { draftEn: DRAFT_EN, buyerLocale: 'ko', facts: FACTS, move: 'fight' },
    { llm: fakeLlm({ outgoing: OUTGOING }, { back_translation_en: 'Back translation.' }) },
  );
  return { draft, translation };
}

function replyBase(draft: ReplyDraft, translation: ReplyTranslation | null, over: Partial<ReplyViewInput> = {}) {
  return {
    draft,
    translation,
    facts: FACTS,
    board: D2_AFTER,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyerLocale: 'ko' as const,
    plan: null,
    offerFirst: false,
    mode: 'simulated' as const,
    draftSource: 'ai' as const,
    riskAfterReply: null,
    ...over,
  };
}

describe('5~6번: 답장 칸 — 접기와 검사 줄', () => {
  // T076: 왼쪽은 입력칸(영어 초안 미리보기), 오른쪽은 "<이름> reads (Korean)" 검사받은 전송본
  it('코칭 접기 없음(칩으로 대체), 왼쪽 영어 입력칸 → 오른쪽 구매자 글 (이름은 데이터에서)', async () => {
    const { draft, translation } = await prepare();
    const markup = html(
      createElement(ReplyPanel, { disputeId: ID, base: replyBase(draft, translation), replyId: null, languageKey: 'case.view.lang.KO', buyerShort: 'Seo-yeon' }),
    );
    expect(markup).not.toContain('coaching tips');
    // T122a 시안 v6: 입력칸 아래 번역 칸 제목 "Translation (Korean)" (언어 이름은 데이터에서)
    const reads = markup.indexOf(t('case.reply.translationTitle', { language: t('case.view.lang.KO') }));
    const write = markup.indexOf('class="reply-textarea"');
    expect(write).toBeGreaterThan(0);
    expect(reads).toBeGreaterThan(write);
    expect(markup).toContain('class="reply-text reply-outgoing" lang="ko"');
    expect(markup).toMatch(/<textarea[^>]*class="reply-textarea" lang="en"/);
    // T090: 역번역은 Details ⌄ 안 (통과면 접혀 있다)
    const details = markup.slice(markup.indexOf('class="reply-details"'));
    expect(details).toMatch(/^class="reply-details"[^>]*hidden/);
    expect(details).toContain('Back-translation to English');
  });

  it('통과하면 보이는 줄은 3개: Facts match · No new promises · Follow-up date 11월 17일. 나머지는 More checks 안', async () => {
    const { draft, translation } = await prepare();
    const view = buildReplyView({ ...replyBase(draft, translation), confirmed: [], sendState: 'idle', outcome: null });
    const { shown, folded } = visibleChecks(view.checkRows);
    expect(shown.map((r) => t(r.labelKey))).toEqual(['Facts match', 'No new promises']);
    expect(view.factRows.filter((f) => f.primary).map((f) => `${t(f.labelKey)} ${f.value}`)).toEqual(['Follow-up date 11월 17일']);
    expect(folded.map((r) => r.labelKey)).toEqual(['case.reply.check.literal', 'case.reply.check.nameHonorific']);

    const markup = html(createElement(ReplyPanel, { disputeId: ID, base: replyBase(draft, translation), replyId: null, languageKey: 'case.view.lang.KO' }));
    // T090: 검사 줄은 Details ⌄ 안의 3줄 (통과한 보조 검사는 보이지 않는다)
    const start = markup.indexOf('class="reply-details"');
    const visible = markup.slice(start, markup.indexOf('</ul>', start));
    expect((visible.match(/class="reply-check/g) ?? []).length).toBe(3);
    expect(visible).not.toContain(t('case.reply.check.literal'));
  });

  it('실패한 검사는 접기와 상관없이 보인다 (가짜 결과) — 버튼은 꺼진다', async () => {
    const { draft, translation } = await prepare();
    if (!translation.ok) throw new Error('translation failed');
    const failing: ReplyTranslation = {
      ...translation,
      check: { ...translation.check, ok: false, literalFacts: ['11월 17일'] },
      sendable: false,
    };
    const markup = html(createElement(ReplyPanel, { disputeId: ID, base: replyBase(draft, failing), replyId: 'r-0', languageKey: 'case.view.lang.KO' }));
    const before = markup.indexOf('<summary class="reply-fold-summary"><span>More checks');
    const visible = before < 0 ? markup : markup.slice(0, before);
    expect(visible).toMatch(/class="reply-check reply-check-failed"[\s\S]*?No dates or amounts typed in directly/);
    expect(markup).toMatch(/<button type="button" class="reply-button" disabled=""/);
  });
});

// ── 전송 상태 표시 ─────────────────────────────────────────────────────

describe('전송 상태 표시: 모드 글자는 서버 모드에서', () => {
  const LINKS: DemoLink[] = [
    { paypalDisputeId: ID, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true },
    { paypalDisputeId: 'PP-R-TEST-NO', seedDisputeId: 'D3', carrierOrderId: null, showOnScreen: true, liveSendAllowed: false },
  ];

  it('꺼짐 / 켜짐 / 연결 표 불허', () => {
    const off = resolveSendMode({});
    const on = resolveSendMode({ AFTERLOOP_REAL_SEND: '1', DEMO_MODE: 'recording' });
    expect(t(sendModeKey(off, liveSendAllowedFor(ID, LINKS)))).toBe('Simulated send — nothing goes to PayPal');
    expect(t(sendModeKey(on, liveSendAllowedFor(ID, LINKS)))).toBe('Live · PayPal sandbox');
    expect(liveSendAllowedFor('PP-R-TEST-NO', LINKS)).toBe(false);
    expect(t(sendModeKey(on, liveSendAllowedFor('PP-R-TEST-NO', LINKS)))).not.toContain('Live ·');
    expect(liveSendAllowedFor('PP-R-NOT-IN-TABLE', LINKS)).toBe(false);
  });

  // T068: 모드 글자는 답장 칸 맨 위가 아니라 보내기 버튼 옆 작은 글씨
  it('보내기 버튼 옆에 그 글자가 보인다', async () => {
    const { draft, translation } = await prepare();
    for (const [mode, liveAllowed, key] of [
      ['simulated', true, 'case.send.mode.simulated'],
      ['live', true, 'case.send.mode.live'],
      ['live', false, 'case.send.mode.liveNotAllowed'],
    ] as const) {
      const markup = html(
        createElement(ReplyPanel, { disputeId: ID, base: replyBase(draft, translation, { mode, liveAllowed }), replyId: null, languageKey: 'case.view.lang.KO' }),
      );
      const actions = markup.slice(markup.indexOf('class="reply-actions"'), markup.indexOf('>Send</button>'));
      expect(actions).toContain(`class="reply-mode${key === 'case.send.mode.live' ? ' reply-mode-live' : ''}">${t(key)}`);
    }
  });

  it('결과 줄 문구: 실제 = "Sent · send-message 200 · PP-R-…", 가짜 = "Simulated · nothing was sent"', () => {
    expect(t('case.send.sent', { endpoint: 'send-message', status: 200, disputeId: 'PP-R-GMS-10197661' })).toBe(
      'Sent · send-message 200 · PP-R-GMS-10197661',
    );
    expect(t('case.send.simulated')).toBe('Simulated · nothing was sent');
  });

  it('보낸 뒤 위험 배지는 엔진의 답장 뒤 값으로 (답장 칸 → useSent → 머리글 배지)', () => {
    const panel = readFileSync(path.join(ROOT, 'src/app/cases/reply/reply-panel.tsx'), 'utf8');
    expect(panel).toMatch(/setSent\(next\.ok\)/);
    const toggle = readFileSync(path.join(ROOT, 'src/app/cases/view/risk-toggle.tsx'), 'utf8');
    expect(toggle).toMatch(/sent && riskAfterReply !== null \? riskAfterReply : risk/);
    expect(VIEW.riskAfterReply?.score).toBeLessThan(VIEW.risk?.score ?? 0);
  });
});

// ── 연습용 실패 화면 ───────────────────────────────────────────────────

describe('연습용: 가짜 모드는 몇 번이고, 실패 화면 미리 보기', () => {
  async function prepared(): Promise<PreparedReply> {
    const { translation } = await prepare();
    if (!translation.ok) throw new Error('translation failed');
    return {
      disputeId: ID,
      draftSource: 'ai',
      draftEn: DRAFT_EN,
      outgoing: translation.outgoing,
      outsidePolicy: translation.outsidePolicy,
      addedInTranslation: translation.addedInTranslation,
      nameProblems: translation.nameProblems,
      facts: FACTS,
      buyerLocale: 'ko',
    };
  }

  const loaded = (): LoadDemoDisputesResult => ({
    disputes: [
      {
        key: 'D2',
        disputeId: ID,
        statusCode: 'WAITING_FOR_SELLER_RESPONSE',
        buyer: null,
        product: null,
        buyerMessages: [],
        boardReal: D2_BEFORE,
        boardDemo: D2_AFTER,
        demoFields: [],
        carrierEvents: [],
        signals: null,
        signalsAfterReply: null,
        liveSendAllowed: true,
      },
    ],
    paypal: { ok: true },
    llm: { ok: true },
  });

  function deps(mode: 'live' | 'simulated') {
    const live: ApiRequest[] = [];
    const simulated: ApiRequest[] = [];
    const d: SendReplyDeps = {
      mode,
      load: async () => loaded(),
      readDetail: async () => ({ dispute_id: ID, messages: [{ posted_by: 'BUYER', content: '...' }] }) as never,
      liveCall: async (req) => {
        live.push(req);
        return { status: 200, body: {} };
      },
      simulatedCall: async (req) => {
        simulated.push(req);
        return { status: 200, body: {} };
      },
      now: NOW,
      links: [{ paypalDisputeId: ID, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true }],
      params: P,
      rules: R,
    };
    return { d, live, simulated };
  }

  const send = (reply: PreparedReply, d: SendReplyDeps) =>
    sendReply({ disputeId: ID, reply, confirmedCommitments: [], approved: true }, d);

  it('가짜 모드에서 같은 답장을 두 번(세 번) 연습해도 막히지 않는다. 실제 호출기 0회', async () => {
    const reply = await prepared();
    const { d, live } = deps('simulated');
    for (let i = 0; i < 3; i += 1) expect(await send(reply, d)).toEqual({ ok: true, mode: 'simulated', disputeId: ID });
    expect(live).toHaveLength(0);
  });

  it('실제 모드의 중복 방지는 그대로: 같은 답장 두 번 → 실제 호출 1회 (가짜 호출기)', async () => {
    const reply = await prepared();
    const { d, live } = deps('live');
    expect((await send(reply, d)).ok).toBe(true);
    expect((await send(reply, d)).ok).toBe(true);
    expect(live).toHaveLength(1);
  });

  it('가짜 모드에서 연습해도 실제 모드의 기억과 섞이지 않는다 (가짜 뒤 실제 → 실제 호출 1회)', async () => {
    const reply = await prepared();
    const sim = deps('simulated');
    await send(reply, sim.d);
    const real = deps('live');
    await send(reply, real.d);
    expect(real.live).toHaveLength(1);
  });

  it('AFTERLOOP_SIMULATE_FAILURE 네 값이 각각 실패 화면을 낸다 (가짜 성공 결과에 덧씌움, 실제 호출 0회, 문구는 지금 실패 문구)', async () => {
    const reply = await prepared();
    const expected: Record<string, { failure: string; error: string }> = {
      paypal_error: { failure: 'paypal_error', error: 'The send-message call failed (status code 500).' },
      already_replied: { failure: 'already_replied', error: t('case.send.error.alreadyReplied') },
      not_allowed: { failure: 'blocked', error: t('case.send.error.liveNotAllowed') },
      checks_failed: { failure: 'blocked', error: t('case.send.error.checkFailed') },
    };
    expect([...SIMULATED_FAILURES].sort()).toEqual(Object.keys(expected).sort());
    for (const value of SIMULATED_FAILURES) {
      expect(resolveSimulatedFailure({ AFTERLOOP_SIMULATE_FAILURE: value })).toBe(value);
      const { d, live } = deps('simulated');
      const outcome = applySimulatedFailure(await send(reply, d), resolveSimulatedFailure({ AFTERLOOP_SIMULATE_FAILURE: value }), 'message');
      expect(outcome.ok, value).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.mode).toBe('simulated');
      expect(outcome.failure).toBe(expected[value].failure);
      expect(outcome.error).toBe(expected[value].error);
      expect(live).toHaveLength(0);
    }
    // 화면이 실패 화면으로 그리는지 (paypal_error → "Nothing was sent." 줄도)
    const { draft, translation } = await prepare();
    expect(buildReplyView({
      ...replyBase(draft, translation),
      confirmed: [],
      sendState: 'failed',
      outcome: applySimulatedFailure({ ok: true, mode: 'simulated', disputeId: ID }, 'paypal_error', 'message'),
    }).result).toMatchObject({ kind: 'failed', failure: 'paypal_error', nothingSent: true });
  });

  it('그 밖의 값·빈 값은 무시, 실제 모드에서는 변수를 읽지 않고 실제 결과를 바꾸지 않는다', async () => {
    for (const value of [undefined, '', 'PAYPAL_ERROR', 'boom', ' paypal_error']) {
      expect(resolveSimulatedFailure({ AFTERLOOP_SIMULATE_FAILURE: value })).toBeNull();
    }
    const env = new Proxy({ AFTERLOOP_REAL_SEND: '1', DEMO_MODE: 'recording', AFTERLOOP_SIMULATE_FAILURE: 'paypal_error' } as Record<string, string>, {
      get(target, key: string) {
        if (key === 'AFTERLOOP_SIMULATE_FAILURE') throw new Error('실제 모드에서 읽었다');
        return target[key];
      },
    });
    expect(resolveSimulatedFailure(env)).toBeNull();
    // 값이 넘어와도 실제 결과·관문의 진짜 실패는 그대로
    const live = { ok: true as const, mode: 'live' as const, disputeId: ID, endpoint: 'send-message', status: 200 };
    expect(applySimulatedFailure(live, 'already_replied', 'message')).toBe(live);
    const realFail = { ok: false as const, mode: 'simulated' as const, failure: 'blocked' as const, error: 'x', nextAction: 'y' };
    expect(applySimulatedFailure(realFail, 'paypal_error', 'message')).toBe(realFail);
  });

  it('서버 액션만 덧씌우고, 보내기 관문(send.ts)에는 연습용 변수가 없다', () => {
    const actions = readFileSync(path.join(ROOT, 'src/app/cases/actions.ts'), 'utf8');
    expect(actions).toMatch(/resolveSendMode\(\) === 'simulated' \? resolveSimulatedFailure\(\) : null/);
    const send = readFileSync(path.join(ROOT, 'src/app/_server/send.ts'), 'utf8');
    expect(send).not.toMatch(/SIMULATE_FAILURE|simulateFailure/);
  });
});

// ── Today 목록 ─────────────────────────────────────────────────────────

describe('Today 목록: 5줄 · Routine은 Skipped · Autopilot 숨김', () => {
  const quiet: EscalationSignals = { mentionsCardCompany: false, secondMessageUnanswered: false, unansweredOver24h: false, angryTone: false, hoursToDue: 400 };
  const mikeBoard: BoardState = {
    ...D2_BASE,
    disputeId: 'PP-R-FYT-10197651',
    stage: 'CHARGEBACK',
    allowedMoves: ['accept_claim'],
    hasTracking: true,
    hasDeliveredTracking: true,
    buyerPriorInrDisputes: 2,
    cause: ruleCause('F1'),
  };
  const view = buildToday({
    disputes: [
      {
        key: 'D2',
        disputeId: 'PP-R-GMS-10197661',
        statusCode: 'WAITING_FOR_SELLER_RESPONSE',
        buyer: SEOYEON,
        product: SWEATER,
        buyerMessages: [],
        boardReal: { ...D2_BEFORE, disputeId: 'PP-R-GMS-10197661' },
        boardDemo: { ...D2_AFTER, disputeId: 'PP-R-GMS-10197661' },
        demoFields: [],
        carrierEvents: [],
        signals: SIGNALS,
        signalsAfterReply: null,
        liveSendAllowed: true,
      },
      {
        key: 'D1',
        disputeId: 'PP-R-MBJ-10197650',
        statusCode: 'WAITING_FOR_SELLER_RESPONSE',
        buyer: seedBuyers.find((b) => b.id === 'B02') as SeedBuyer,
        product: seedProducts.find((p) => p.sku === 'FK-CD-OAT') as SeedProduct,
        buyerMessages: [],
        boardReal: { ...D2_BEFORE, disputeId: 'PP-R-MBJ-10197650', cause: ruleCause('B1'), reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' },
        boardDemo: null,
        demoFields: [],
        carrierEvents: [],
        signals: quiet,
        signalsAfterReply: null,
        liveSendAllowed: true,
      },
      {
        key: 'D3',
        disputeId: 'PP-R-FYT-10197651',
        statusCode: 'UNDER_REVIEW',
        buyer: seedBuyers.find((b) => b.id === 'B04') as SeedBuyer,
        product: seedProducts.find((p) => p.sku === 'FK-BN-SET') as SeedProduct,
        buyerMessages: [],
        boardReal: mikeBoard,
        boardDemo: null,
        demoFields: [],
        carrierEvents: [],
        signals: quiet,
        signalsAfterReply: null,
        liveSendAllowed: false,
      },
    ],
    tracking: {
      untracked: [
        { key: 'O05', buyerName: null, productName: null },
        { key: 'O07', buyerName: null, productName: null },
      ],
      excluded: [],
    },
    products: seedProducts,
    now: new Date('2026-11-10T17:00:00.000Z'),
  });

  // T122e: Prevent에 시드 표시용 "3 orders · Customs ID missing"(Demo data)이 추적 다음에 온다
  it('6줄 (T076 → T122b → T122e 시안 v6): Reply needed 3 (서연 · 지호 · Mike) + Prevent 3 (추적 · 통관번호 · 가디건). Questions는 질문 항목이 없어 안 보인다', () => {
    expect(view.groups.map((g) => [g.key, g.items.length])).toEqual([
      ['needsYou', 3],
      ['prevent', 3],
    ]);
    expect(view.count).toBe(6);
  });

  it('연습용(HEY)·옛 서연(GAH) 분쟁은 화면에 내지 않는다 (연결 표)', () => {
    expect(linkFor('PP-R-HEY-10197767')?.showOnScreen ?? false).toBe(false);
    expect(linkFor('PP-R-GAH-10197649')?.showOnScreen ?? false).toBe(false);
  });

  it('Routine 항목은 위험 배지 대신 회색 "Skipped" (엔진 판정에서)', () => {
    // T067: 회색 칩 → 회색 상태 알약 + 회색 점 (`status`·`dot`)
    const mike = view.groups[0].items[2];
    expect(mike.status).toEqual({ key: 'today.skipped', tone: 'neutral' });
    expect(mike.dot).toBe('neutral');
    const markup = html(createElement(TodayList, { view, selectedId: null, paypalNotice: null }));
    // T122e: 목록 아래 줄은 시드 표기 "buyer_m · US" — 줄은 항목 id로 찾는다
    const row = markup.slice(markup.indexOf('data-item="PP-R-FYT-10197651"'));
    // T076: 알약은 범주, 상태 "Skipped"는 화면 읽기 글자로
    expect(row.slice(0, row.indexOf('</li>'))).toMatch(/<span class="today-sr-only">[^<]*· Skipped<\/span>/);
    expect(row.slice(0, row.indexOf('</li>'))).not.toContain('risk-low');
    // T122b: Mike(맨 뒤)를 뺀 Reply needed 항목은 Skipped가 아니다
    for (const item of view.groups[0].items.slice(0, -1)) expect(item.status.key).not.toBe('today.skipped');
  });

  it('Mike 상태 문장: "3rd \'not received\' claim in 90 days with a delivery record — <제품 이름> won\'t act on this."', () => {
    const line = routineLine(mikeBoard, decideFor(mikeBoard, R));
    expect(line).toBe(`3rd 'not received' claim in 90 days with a delivery record — ${t('nav.appName')} won't act on this.`);
    expect(routineLine({ ...mikeBoard, hasDeliveredTracking: false }, decideFor(mikeBoard, R))).not.toContain('delivery record');
    expect(routineLine(D2_AFTER, decideFor(D2_AFTER, R))).toBeNull(); // Routine이 아니면 없다
  });

  it('Autopilot 토글이 위쪽 막대에 그려지지 않는다', () => {
    const markup = html(createElement(TopBar, { seller: { initial: 'X', shop: 'Shop' } }));
    expect(markup).not.toContain(t('shell.autopilot'));
    expect(markup).not.toContain('role="switch"');
  });
});

// ── 정적 검사 ──────────────────────────────────────────────────────────

describe('정적 검사 (T061)', () => {
  function filesUnder(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? filesUnder(full) : [full];
    });
  }
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const screen = [
    ...filesUnder(path.join(ROOT, 'src/app/cases')),
    ...filesUnder(path.join(ROOT, 'src/app/today')),
    path.join(ROOT, 'src/app/(app)/page.tsx'),
    path.join(ROOT, 'src/app/_shared/top-bar.tsx'),
  ].filter((f) => /\.(ts|tsx)$/.test(f));

  it('화면 코드에 금액 숫자(72·74·37·2·200 …)가 없다', () => {
    for (const file of screen) {
      const body = strip(readFileSync(file, 'utf8'));
      expect(/\$\s*\d|(?<![\w.#-])(72|74|37|7200|7400|3680|200)(?![\w.])/.test(body), path.relative(ROOT, file)).toBe(false);
    }
  });

  it('화면 코드에 "Hannah"·"Fernwood"가 없다', () => {
    for (const file of screen) {
      const body = readFileSync(file, 'utf8');
      expect(/Hannah|Fernwood/.test(body), path.relative(ROOT, file)).toBe(false);
    }
  });

  it('옛 메뉴 파일 src/app/_shared/nav.tsx가 없다', () => {
    expect(() => statSync(path.join(ROOT, 'src/app/_shared/nav.tsx'))).toThrow();
  });

  it('추적 항목의 Watch는 고정 상태 표시라는 이름이다', () => {
    const model = readFileSync(path.join(ROOT, 'src/app/today/model.ts'), 'utf8');
    expect(model).toMatch(/UNTRACKED_FIXED_WATCH_BAND/);
    expect(model).toMatch(/추적 미등록 주문은 엔진 점수가 없어 고정 표시/);
  });

  it('새 문구 키가 두 문구 파일에 같이 있다', () => {
    for (const key of Object.keys(copyTables.en)) expect(typeof copyTables.ko[key], key).toBe('string');
    for (const key of Object.keys(copyTables.ko)) expect(typeof copyTables.en[key], key).toBe('string');
  });
});
