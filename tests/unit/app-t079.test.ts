/**
 * T079 연결 시험: 화면 어댑터 → 엔진 예측(T075)·AI 요약(T077), /intro 정리, 이번 주 카드 배지.
 *
 * 실제 AI·PayPal 호출 0회 (가짜 LlmCaller, PayPal 읽기 함수는 가짜). 개발 서버 없음 (`renderToStaticMarkup`).
 * 숫자는 엔진 함수 결과와 비교만 한다 — 시험이 기대값을 계산하지 않는다.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { copyTables, t } from '@/app/_shared/copy';
import type { LoadedDispute } from '@/app/_shared/dispute-view';
import { toDollarsRounded } from '@/app/_shared/money';
import { toPercentRounded } from '@/app/_shared/percent';
import { choicesView, curveView, reactionView } from '@/app/cases/desk-model';
import { detectReplyFeaturesClient, forecastReplyClient } from '@/app/cases/forecast-client';
import { caseEventsFor, unansweredDays } from '@/app/cases/history';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, canSend, editGate, EDITED_KEY, type ReplyViewInput } from '@/app/cases/reply-model';
import { weeklyView } from '@/app/today/model';
import { WeeklyCard } from '@/app/today/today-list';
import { forecastMoves, forecastReply, replyCalibration, riskCurve, weeklySummary } from '@/engine/forecast';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import type {
  BoardState,
  Cause,
  CaseEvent,
  EscalationSignals,
  FactToken,
  LlmCaller,
  SeedBuyer,
  SeedProduct,
  Subtype,
} from '@/types';

import { carrierEventsFor, seedBuyers, seedInquiries, seedOrders, seedProducts } from '../../seed/index';

// ── 가짜: PayPal 읽기·Today 읽기 횟수를 센다 ────────────────────────────────

const calls = vi.hoisted(() => ({ disputes: 0, paypal: 0 }));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next/font/google', () => ({
  Figtree: () => ({ variable: 'font-figtree' }),
  Noto_Sans_KR: () => ({ variable: 'font-noto-kr' }),
}));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputes: async () => {
    calls.disputes += 1;
    return { disputes: [], paypal: { ok: false, reason: 'not_configured' }, llm: { ok: false } };
  },
  loadDemoDisputesForRequest: async () => {
    calls.disputes += 1;
    return { disputes: [], paypal: { ok: false, reason: 'not_configured' }, llm: { ok: false } };
  },
}));
vi.mock('@/app/_server/paypal', () => ({
  getPayPalClient: () => {
    calls.paypal += 1;
    return { ok: false, reason: 'not_configured' };
  },
  // T084: 화면 읽기는 요청 사이 캐시가 붙은 입구를 쓴다
  getPayPalReadClient: () => {
    calls.paypal += 1;
    return { ok: false, reason: 'not_configured' };
  },
}));
(globalThis as { React?: typeof React }).React = React;

const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');
const { CaseView } = await import('@/app/cases/view/case-view');
const { buildCaseView, caseMessages } = await import('@/app/cases/model');
const { buildCaseDesk, historyView } = await import('@/app/cases/desk-model');
const { countCachedDrafts, loadMoveForecasts, loadRiskCurve, loadWeeklySummary, replyTranslated, resetCachedDraftCount } =
  await import('@/app/cases/forecast-source');
const { loadHistorySummary, tokenizeHistoryNames } = await import('@/app/cases/history-summary-source');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── 서연 보기용 데이터 (가짜 AI 초안) ─────────────────────────────────────

const D2 = 'PP-R-GMS-10197661';
const SEOYEON = seedBuyers.find((b) => b.id === 'B01') as SeedBuyer;
const SWEATER = seedProducts.find((p) => p.sku === 'FK-SW-NV') as SeedProduct;
const NOW = '2026-11-11T03:00:00.000Z';
const OPENED_AT = '2026-11-09T13:12:00.000Z';
const REAL_KO = '벌써 3주째인데 아직도 안 왔어요. 연락 없으면 카드사에 이의제기할게요.';

const cause = (subtype: Subtype): Cause => ({
  subtype,
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
});

function board(over: Partial<BoardState>): BoardState {
  return {
    disputeId: D2,
    reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    stage: 'INQUIRY',
    channel: 'INTERNAL',
    dueDate: '2026-11-30T00:37:00.000Z',
    amountCents: 7200,
    currency: 'USD',
    allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
    hasTracking: false,
    hasDeliveredTracking: false,
    buyerPriorInrDisputes: 0,
    isDemo: false,
    cause: cause('A1'),
    ...over,
  };
}

const BEFORE = board({});
const AFTER = board({ cause: cause('A2'), hasTracking: true, isDemo: true });
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};

function seoyeonLoaded(): LoadedDispute {
  return {
    key: 'D2',
    disputeId: D2,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyer: SEOYEON,
    product: SWEATER,
    buyerMessages: [REAL_KO],
    boardReal: BEFORE,
    boardDemo: AFTER,
    demoFields: ['carrierEvents', 'hasTracking', 'cause', 'earlierInquiries'],
    carrierEvents: carrierEventsFor('O01'),
    signals: SIGNALS,
    signalsAfterReply: { ...SIGNALS, secondMessageUnanswered: false, unansweredOver24h: false, angryTone: null },
    liveSendAllowed: true,
    timeline: {
      openedAt: OPENED_AT,
      buyerMessages: [{ text: REAL_KO, at: OPENED_AT }],
      sellerReplies: [],
      orderDate: seedOrders.find((o) => o.id === 'O01')?.date ?? null,
    },
  };
}

const FACT_SETS = caseReplyFacts({ now: '2026-11-10T03:00:00Z', dueDate: AFTER.dueDate, buyerId: null, buyerLocale: 'ko' });
const FACTS: FactToken[] = FACT_SETS.outgoing;
const DRAFT_EN =
  "Sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧.";
const OUTGOING =
  '기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요.';
const BLAME = " That's not our responsibility, it's the customs office's fault.";

function fakeLlm(...answers: unknown[]): LlmCaller {
  let n = 0;
  return async () => answers[Math.min(n++, answers.length - 1)];
}

async function replyBase(): Promise<Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>> {
  const draft: ReplyDraft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: AFTER.cause as Cause, move: 'fight', facts: FACTS },
    {
      llm: fakeLlm({
        buyer_message_en: 'It has not arrived.',
        coaching: ['Say sorry first.', 'Explain the hold.', 'Ask for the code.', 'Pass it on.', 'Give a date.'],
        draft_en: DRAFT_EN,
      }),
    },
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

const EVENTS = caseEventsFor(seoyeonLoaded(), seedInquiries);
const DELAY = unansweredDays(EVENTS, NOW);
const TRANSLATED = replyTranslated('ko');

async function anchorOf(): Promise<{ base: Awaited<ReturnType<typeof replyBase>>; anchor: string }> {
  const base = await replyBase();
  const anchor = buildReplyView({ ...base, confirmed: [], sendState: 'idle', outcome: null }).draftEn?.text;
  if (anchor === undefined) throw new Error('no anchor');
  return { base, anchor };
}

// ───────────────────────────── 1. 숫자 일치 ─────────────────────────────

describe('숫자 일치: 반응 막대 기대 비용 = 선택지 Reply 기대 손실 = recommend fight', () => {
  it('서연, AI 기본 초안: 센트까지 같고 화면 글자도 같다', async () => {
    const { base, anchor } = await anchorOf();
    const fight = recommend(AFTER).all.find((e) => e.move === 'fight');
    expect(fight?.expectedLossCents).not.toBeNull();

    // 브라우저 어댑터 (답장 칸이 부르는 값) — 엔진 forecastReply와 같은 값
    const forecast = forecastReplyClient({ text: anchor, anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: DELAY, translated: TRANSLATED });
    expect(forecast).not.toBeNull();
    expect(forecast?.expectedCostCents).toBe(fight?.expectedLossCents);

    // 선택지 카드 (서버 어댑터 + recommend 그대로)
    const moves = loadMoveForecasts({ board: AFTER, signals: SIGNALS, delayDays: DELAY, anchorText: anchor, translated: TRANSLATED });
    const choices = choicesView(recommend(AFTER), moves);
    const reply = choices.find((c) => c.move === 'fight');
    expect(reply?.expectedLoss?.cents).toBe(fight?.expectedLossCents);

    // 화면 글자: 같은 반올림 함수 → 같은 글자
    const reaction = reactionView(forecast, true);
    expect(reaction?.cost).toBe(reply?.expectedLoss?.display);    expect(reaction?.cost).toBe(toDollarsRounded(fight?.expectedLossCents as number));

    // 실제 그림: 기본 어댑터로 그린 답장 칸의 기대 비용 글자 = 선택지 카드 글자
    const panel = html(
      createElement(ReplyPanel, {
        disputeId: D2,
        base,
        replyId: 'r-1',
        languageKey: 'case.view.lang.KO',
        buyerShort: 'Seo-yeon',
        forecastBase: { signals: SIGNALS, delayDays: DELAY, translated: TRANSLATED },
      }),
    );
    expect(panel).toContain(t('case.reaction.cost', { amount: reply?.expectedLoss?.display as string }));
    expect(panel).toContain('class="reaction"');
    expect(panel).toContain(t('case.reply.asYouType'));
  });

  it('선택지 차지백 % = forecastMoves 그대로, 막힌 수는 없음', async () => {
    const { anchor } = await anchorOf();
    const input = { board: AFTER, signals: SIGNALS, delayDays: DELAY, anchorText: anchor, translated: TRANSLATED };
    const moves = loadMoveForecasts(input);
    const engine = forecastMoves({ ...input, anchorText: anchor });
    expect(moves).toEqual(engine.filter((m) => m.pChargeback !== null).map((m) => ({ move: m.move, pChargeback: m.pChargeback })));
    const fightP = engine.find((m) => m.move === 'fight')?.pChargeback;
    const forecast = forecastReply({ text: anchor, anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: DELAY, translated: TRANSLATED });
    expect(fightP).toBe(forecast.pChargeback);
    for (const blocked of engine.filter((m) => m.blockedBy !== undefined)) {
      expect(moves?.some((m) => m.move === blocked.move)).toBe(false);
    }
    const choices = choicesView(recommend(AFTER), moves);
    expect(choices.find((c) => c.move === 'fight')?.chargeback).toBe(toPercentRounded(forecast.pChargeback));
  });

  it('신호나 기본 초안이 없으면 차지백 % 칸을 숨긴다 (null)', () => {
    expect(loadMoveForecasts({ board: AFTER, signals: null, delayDays: 0, anchorText: 'x' })).toBeNull();
    expect(loadMoveForecasts({ board: AFTER, signals: SIGNALS, delayDays: 0, anchorText: null })).toBeNull();
  });
});

// ───────────────────────────── 2. 위험 곡선 ─────────────────────────────

describe('위험 곡선: 같은 보정, 마지막 "Your draft" 점 = 답장 예측 pChargeback', () => {
  it('loadRiskCurve = riskCurve(… { calibration: forecastReply의 보정 })', async () => {
    const { anchor } = await anchorOf();
    const forecast = forecastReply({ text: anchor, anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: DELAY, translated: TRANSLATED });
    const c = forecast.parts.find((p) => p.key === 'calibration')?.weight;
    expect(c).toBe(replyCalibration({ anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: DELAY, translated: TRANSLATED }));

    const points = loadRiskCurve(EVENTS, AFTER, { signals: SIGNALS, delayDays: DELAY, anchorText: anchor, translated: TRANSLATED });
    expect(points).toEqual(riskCurve([...EVENTS], AFTER, undefined, undefined, undefined, { calibration: c }));
    expect(points).toHaveLength(EVENTS.length);
    // 보정 없이 그린 곡선과 다르다 (보정을 실제로 넘겼다)
    expect(points).not.toEqual(riskCurve([...EVENTS], AFTER));

    const curve = curveView(points, forecast.pChargeback);
    expect(curve?.draft).not.toBeNull();
    expect(curve?.headline).toBe(toPercentRounded(forecast.pChargeback));
    expect(curve?.headlineKey).toBe('case.curve.withDraft');
  });

  it('기본 초안이 없으면 보정 0, 사건이 없으면 null', () => {
    expect(loadRiskCurve(EVENTS, AFTER)).toEqual(riskCurve([...EVENTS], AFTER));
    expect(loadRiskCurve([], AFTER)).toBeNull();
  });
});

// ───────────────────────────── 3. 입력칸 글 → 예측 바뀜, Send 꺼짐 ─────────────────────────────

describe('입력칸 글을 바꾸면 예측이 바뀌고 Send는 꺼진다', () => {
  it('탓하는 문장을 더하면 위험이 오르고, 관문은 "Edited text"로 막는다', async () => {
    const { base, anchor } = await anchorOf();
    const edited = anchor + BLAME;
    const input = { anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: DELAY, translated: TRANSLATED };
    const before = forecastReplyClient({ ...input, text: anchor });
    const after = forecastReplyClient({ ...input, text: edited });
    expect(after?.pChargeback).toBeGreaterThan(before?.pChargeback as number);
    expect(after?.expectedCostCents).toBeGreaterThan(before?.expectedCostCents as number);
    expect(detectReplyFeaturesClient(edited, { translated: TRANSLATED })?.features.blame).toBe(true);
    expect(detectReplyFeaturesClient(anchor, { translated: TRANSLATED })?.features.blame).toBe(false);

    const view = buildReplyView({ ...base, confirmed: [], sendState: 'idle', outcome: null });
    const gate = canSend(view);
    expect(gate.ok).toBe(true);
    expect(editGate(gate, anchor, anchor)).toEqual({ ...gate, translate: false });
    // T100: 고친 글은 번역·검사 전이면 꺼지고 [Translate & check]가 켜진다
    expect(editGate(gate, edited, anchor)).toEqual({ ok: false, reasonKey: EDITED_KEY, translate: true });
  });

  it('번역해서 보내는 답장이면 "구매자 언어" 특징이 켜진다 (영어 구매자는 꺼짐)', async () => {
    const { anchor } = await anchorOf();
    expect(replyTranslated('ko')).toBe(true);
    expect(replyTranslated('en')).toBe(false);
    expect(replyTranslated(null)).toBe(false);
    expect(detectReplyFeaturesClient(anchor, { translated: true })?.features.lang).toBe(true);
    expect(detectReplyFeaturesClient(anchor)?.features.lang).toBe(false);
  });
});

// ───────────────────────────── 4. 사건 기록 요약 ─────────────────────────────

describe('사건 기록 요약: 이름 토큰화 뒤 AI에 넘김, 실패하면 줄 숨김', () => {
  const named: CaseEvent[] = [
    ...EVENTS,
    { at: '2026-11-10T01:00:00.000Z', kind: 'buyer_message', source: 'sandbox', text: 'Buyer wrote: "This is Seo-yeon Kim. 서연이에요, 김서연."' },
    { at: '2026-11-10T02:00:00.000Z', kind: 'seller_reply', source: 'sandbox', text: 'Seller replied — Hannah, Fernwood Knits' },
  ];

  it('가짜 LlmCaller가 받은 글에 "Seo-yeon"·"서연"·판매자 이름이 없고 토큰만 있다', async () => {
    const seen: string[] = [];
    const llm: LlmCaller = async (req) => {
      seen.push(req.system, req.user);
      return { summary: '⟦BUYER_NAME_1⟧ asked again and has no reply yet.' };
    };
    const summary = await loadHistorySummary(named, { buyerId: 'B01', buyerName: SEOYEON.name }, { llm });
    expect(seen).toHaveLength(2);
    const sent = seen.join('\n');
    for (const name of ['Seo-yeon', '서연', '김서연', 'Kim', 'Hannah', 'Fernwood']) expect(sent, name).not.toContain(name);
    expect(sent).toContain('⟦BUYER_NAME_1⟧');
    // 요약 속 토큰은 코드가 영어 이름 꼴로 채운다
    expect(summary).toBe('Seo-yeon asked again and has no reply yet.');
    // 화면에 보이는 사건 글은 그대로 (사본만 바꾼다)
    expect(named[named.length - 2].text).toContain('Seo-yeon');
  });

  it('이름 꼴이 없는 구매자: 토큰은 "the buyer"로 채운다', async () => {
    const llm: LlmCaller = async () => ({ summary: '⟦BUYER_NAME_1⟧ is waiting.' });
    expect(await loadHistorySummary(EVENTS, { buyerId: null, buyerName: null }, { llm })).toBe('the buyer is waiting.');
  });

  it('AI 실패·검사 탈락이면 null (줄을 숨긴다), 예외를 던지지 않는다', async () => {
    const who = { buyerId: 'B01', buyerName: SEOYEON.name };
    const throwing: LlmCaller = async () => {
      throw new Error('down');
    };
    expect(await loadHistorySummary(EVENTS, who, { llm: throwing })).toBeNull();
    expect(await loadHistorySummary(EVENTS, who, { llm: async () => ({ nope: 1 }) })).toBeNull();
    // 입력에 없는 날짜 → 검사 탈락
    expect(await loadHistorySummary(EVENTS, who, { llm: async () => ({ summary: 'Nothing since Feb 29.' }) })).toBeNull();
    // 환불 약속 → 검사 탈락
    expect(await loadHistorySummary(EVENTS, who, { llm: async () => ({ summary: 'We will refund you.' }) })).toBeNull();
    expect(await loadHistorySummary([], who, { llm: async () => ({ summary: 'x' }) })).toBeNull();
  });

  it('토큰화는 순수: 원본을 바꾸지 않고 같은 입력이면 같은 글 (캐시 키가 같다)', () => {
    const who = { buyerId: 'B01', buyerName: SEOYEON.name };
    const a = tokenizeHistoryNames(named, who);
    const b = tokenizeHistoryNames(named, who);
    expect(a).toEqual(b);
    expect(a).toHaveLength(named.length);
    expect(a.map((e) => e.text).join('\n')).not.toMatch(/Seo-yeon|서연|Hannah/);
    expect(named.map((e) => e.text).join('\n')).toMatch(/Seo-yeon/);
  });

  it('부르는 곳: loadCase의 AI 초안 길(draft !== false)에서 구매자 번호·이름을 넘긴다', () => {
    const code = strip(read('src/app/cases/view/load.ts'));
    expect(code).toMatch(/options\.draft === false\s*\?\s*null\s*:\s*await loadHistorySummary\(events, \{ buyerId: loaded\.buyer\?\.id \?\? null, buyerName: loaded\.buyer\?\.name \?\? null \}\)/);
  });
});

// ───────────────────────────── 5. 이번 주 카드 ─────────────────────────────

describe('이번 주 카드: 엔진 weeklySummary + AI 캐시 초안 수, Demo data 배지', () => {
  beforeEach(() => resetCachedDraftCount());

  it('AI 캐시 파일에서 draft_en 항목만 센다. 파일이 없거나 비면 null', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 't079-'));
    const file = path.join(dir, 'llm-cache.json');
    expect(countCachedDrafts(file)).toBeNull();
    resetCachedDraftCount();
    const key = (n: number) => String(n).repeat(64).slice(0, 64);
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        entries: {
          [key(1)]: { response: { draft_en: 'a', coaching: [] }, createdAt: NOW },
          [key(2)]: { response: { draft_en: 'b' }, createdAt: NOW },
          [key(3)]: { response: { outgoing: 'c' }, createdAt: NOW },
          [key(4)]: { response: { angryTone: true }, createdAt: NOW },
        },
      }),
    );
    expect(countCachedDrafts(file)).toBe(2);
    resetCachedDraftCount();
    writeFileSync(file, JSON.stringify({ version: 1, entries: {} }));
    expect(countCachedDrafts(file)).toBeNull();
    resetCachedDraftCount();
    writeFileSync(file, 'not json');
    expect(countCachedDrafts(file)).toBeNull();
  });

  it('저장소의 캐시 파일: 초안 수 = draft_en 항목 수', () => {
    const cache = JSON.parse(read('data/ai-cache/llm-cache.json')) as { entries: Record<string, { response: Record<string, unknown> }> };
    const expected = Object.values(cache.entries).filter((e) => typeof e.response?.draft_en === 'string').length;
    expect(countCachedDrafts(path.join(ROOT, 'data/ai-cache/llm-cache.json'))).toBe(expected);
  });

  it('loadWeeklySummary = 엔진 weeklySummary, 캐시가 없으면 초안 칸만 숨긴다', () => {
    const boards = [AFTER];
    const counted = loadWeeklySummary({ boards, usesDemoData: true, countDrafts: () => 3 });
    expect(counted).toEqual({ summary: weeklySummary({ boards, aiDrafts: 3, usesDemoData: true }), aiDraftsCounted: true });
    const view = weeklyView(1, counted?.summary ?? null, true, { aiDraftsCounted: counted?.aiDraftsCounted });
    expect(view.aiDrafts).toBe(3);
    expect(view.keepable).toBe(toDollarsRounded(counted?.summary.keepableCents as number));

    const missing = loadWeeklySummary({ boards, usesDemoData: true, countDrafts: () => null });
    expect(missing?.aiDraftsCounted).toBe(false);
    const hidden = weeklyView(1, missing?.summary ?? null, true, { aiDraftsCounted: missing?.aiDraftsCounted });
    expect(hidden.aiDrafts).toBeNull();
    expect(hidden.keepable).not.toBeNull();
    const markup = html(createElement(WeeklyCard, { weekly: hidden, storeLine: 'x' }));
    expect(markup).not.toContain(t('today.weekly.drafts'));
    expect(markup).toContain(t('today.weekly.keepable'));
    // 지킬 수 있는 돈 옆 Assumption 배지
    expect(markup).toContain(copyTables.en['badge.assumption']);
  });

  it('Demo data 배지: 채운 꼴(fill)은 그대로, 보라 카드 위에서는 반투명 바탕 + 밝은 테두리 (흰 상자 아님)', () => {
    const view = weeklyView(1, null, true);
    const markup = html(createElement(WeeklyCard, { weekly: view, storeLine: 'x' }));
    expect(markup).toMatch(/class="badge badge-border-fill"/);
    const css = read('src/app/today/today.css');
    const rule = css.match(/\.weekly \.badge-border-fill\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/background:\s*var\(--color-on-accent-fill\)/);
    expect(rule).toMatch(/border-color:\s*var\(--color-on-accent-muted\)/);
    const globals = read('src/app/globals.css');
    // T096: 밝은 화면만 (어두운 모드 없음)
    expect(globals.match(/--color-on-accent-fill:/g)).toHaveLength(1);
  });
});

// ───────────────────────────── 6. 예측 칸의 Assumption 배지 ─────────────────────────────

describe('예측 칸에 Assumption 배지', () => {
  it('위험 곡선 카드·선택지 머리·반응 막대·입력칸 모서리 % 모두', async () => {
    const { base, anchor } = await anchorOf();
    const assumption = copyTables.en['badge.assumption'];
    const caseView = buildCaseView({
      disputeId: D2,
      statusCode: 'WAITING_FOR_SELLER_RESPONSE',
      buyer: { name: SEOYEON.name, language: SEOYEON.language },
      product: { itemName: SWEATER.itemName },
      messages: caseMessages({ buyerMessages: [REAL_KO], buyerMessageEn: null, buyerId: 'B01', inquiries: [], includeInquiries: false }),
      boardReal: BEFORE,
      boardDemo: AFTER,
      carrierEvents: carrierEventsFor('O01'),
      signals: SIGNALS,
      signalsAfterReply: null,
      demoFields: ['carrierEvents', 'hasTracking', 'cause'],
    });
    const anchorInput = { signals: SIGNALS, delayDays: DELAY, anchorText: anchor, translated: TRANSLATED };
    const desk = buildCaseDesk({
      view: caseView,
      board: AFTER,
      buyer: SEOYEON,
      productName: SWEATER.itemName,
      openDays: 2,
      recommendation: recommend(AFTER),
      moveForecasts: loadMoveForecasts({ board: AFTER, ...anchorInput }),
      history: historyView(EVENTS, 25, null),
      curvePoints: loadRiskCurve(EVENTS, AFTER, anchorInput),
      band: 'High',
    });
    const reply = createElement(ReplyPanel, {
      disputeId: D2,
      base,
      replyId: 'r-1',
      languageKey: 'case.view.lang.KO',
      buyerShort: 'Seo-yeon',
      forecastBase: { signals: SIGNALS, delayDays: DELAY, translated: TRANSLATED },
    });
    const markup = html(createElement(CaseView, { view: caseView, desk, llmOk: true, reply }));
    const section = (from: string, to: string) => markup.slice(markup.indexOf(from), markup.indexOf(to, markup.indexOf(from)));
    expect(markup).toContain('class="curve-card"');
    expect(section('class="curve-card"', '</section>')).toContain(assumption);
    expect(section('class="choice-list"', '</ul>').length).toBeGreaterThan(0);
    expect(markup).toMatch(/Chargeback \d+%/);
    // T090: 입력칸 모서리 알약 안 Assumption은 뺐다 — Assumption은 반응 막대 쪽 하나만
    expect(section('class="reply-editor-pill num"', 'class="reply-tray"')).not.toContain(assumption);
    expect(section('class="reaction"', 'class="reaction-bar"')).toContain(assumption);
    const choiceHead = markup.slice(markup.lastIndexOf('class="desk-step-head"', markup.indexOf('class="choice-list"')), markup.indexOf('class="choice-list"'));
    expect(choiceHead).toContain(assumption);
  });
});

// ───────────────────────────── 7. /intro 정리 ─────────────────────────────

describe('/intro: 루트 layout은 Today·PayPal을 읽지 않는다 (라우트 그룹 (app))', () => {
  it('정적: 루트 layout에 Today 읽기·위쪽 막대 없음, (app)/layout에 있음, intro는 그룹 밖', () => {
    const root = strip(read('src/app/layout.tsx'));
    // 언어 읽기(`_server/locale`, T081)만 허용 — 쿠키 한 값을 읽을 뿐 데이터·PayPal을 부르지 않는다
    expect(root.replace(/_server\/locale/g, '')).not.toMatch(/loadTodayForRequest|_server|TopBar|loadReplyNames/);
    const app = strip(read('src/app/(app)/layout.tsx'));
    // T096: 위쪽 막대에 탭이 없어 (app)/layout도 Today를 읽지 않는다
    expect(app).not.toMatch(/loadTodayForRequest/);
    expect(app).toMatch(/<TopBar/);
    expect(read('src/app/intro/page.tsx')).toBeTruthy();
    for (const page of ['src/app/(app)/page.tsx', 'src/app/(app)/products/page.tsx', 'src/app/(app)/cases/[disputeId]/page.tsx']) {
      expect(read(page), page).toBeTruthy();
    }
    // T078 덮개(position: fixed)를 걷었다
    expect(read('src/app/intro/intro.css').match(/\.intro\s*\{([^}]*)\}/)?.[1] ?? '').not.toMatch(/position:\s*fixed/);
  });

  it('실행: /intro 그림 = 루트 layout + intro 페이지 → Today 읽기·PayPal 조회 0회 (가짜 클라이언트)', async () => {
    const { default: RootLayout } = await import('@/app/layout');
    const { default: IntroPage } = await import('@/app/intro/page');
    calls.disputes = 0;
    calls.paypal = 0;
    const page = await IntroPage({ searchParams: Promise.resolve({}) });
    const markup = html((await RootLayout({ children: page })) as React.ReactElement);
    expect(calls.disputes).toBe(0);
    expect(calls.paypal).toBe(0);
    expect(markup).not.toContain('class="skip-link"');
    expect(markup).not.toContain(t('nav.skipToContent'));
    expect(markup).toContain('class="intro"');
  });

  it('T096: 앱 화면 layout의 위쪽 막대는 탭이 없어 Today·PayPal 읽기를 하지 않는다', async () => {
    const { default: AppLayout } = await import('@/app/(app)/layout');
    calls.disputes = 0;
    calls.paypal = 0;
    const element = (await AppLayout({ children: createElement('p', null, 'x') })) as React.ReactElement;
    const markup = html(element);
    expect(markup).toContain('class="shell-bar"');
    expect(markup).not.toContain('shell-tab');
    expect(calls.disputes).toBe(0);
    expect(calls.paypal).toBe(0);
  });
});
