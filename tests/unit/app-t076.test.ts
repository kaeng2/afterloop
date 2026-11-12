/**
 * T076 단위 테스트: 기획 시안 v4 배치 (Today·사례·Rehearsal·서랍) + 예측 자리(어댑터).
 *
 * 기대값 출처: `tasks/T076.md` "완료 기준", SPEC v2.11 2장 "화면 구조 v4"·8-2장, 계약 `src/types.ts` 9부.
 * **실호출 0회** — PayPal·LLM은 모두 가짜다. 예측 값은 계약 타입 모양의 가짜 값(엔진 T075가 아직 없다)이다 —
 * 화면이 그 값을 **그대로** 보이는지만 본다 (화면이 숫자를 만들지 않는다).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { copyTables, t } from '@/app/_shared/copy';
import type { LoadedDispute } from '@/app/_shared/dispute-view';
import { toDollarsRounded } from '@/app/_shared/money';
import { toPercentRounded } from '@/app/_shared/percent';
import {
  buildCaseDesk,
  categoryLabel,
  choicesView,
  curveView,
  featureChips,
  historyView,
  latinName,
  NO_REPLY_DAYS,
  reactionView,
  readTags,
  type MoveForecast,
} from '@/app/cases/desk-model';
import { detectReplyFeaturesClient, forecastReplyClient } from '@/app/cases/forecast-client';
import { buildCaseEvents, caseEventsFor, daysBetween, historySpanDays, unansweredDays } from '@/app/cases/history';
import { buildCaseView, caseMessages, type CaseViewInput } from '@/app/cases/model';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, canSend, editGate, EDITED_KEY, type ReplyViewInput } from '@/app/cases/reply-model';
import { CaseView } from '@/app/cases/view/case-view';
import { RiskCurveCard } from '@/app/cases/view/risk-curve';
import { CaseHistoryCard } from '@/app/cases/view/case-history';
import { buildToday, weeklyView, type TrackingSummary } from '@/app/today/model';
import { casesOf } from '@/app/today/screen-model';
import { ProductFilterBar, TodayList } from '@/app/today/today-list';
import { forecastReply } from '@/engine/forecast';
import { recommend } from '@/engine/recommend';
import { detectReplyFeatures } from '@/engine/reply-features';
import type {
  BoardState,
  Cause,
  EscalationSignals,
  FactToken,
  LlmCaller,
  ReplyFeatureHits,
  ReplyFeatures,
  ReplyForecast,
  RiskPoint,
  SeedBuyer,
  SeedProduct,
  Subtype,
  WeeklySummary,
} from '@/types';

import { P, R } from '../acceptance/boards';
import { carrierEventsFor, seedBuyers, seedInquiries, seedOrders, seedProducts } from '../../seed/index';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputes: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }),
  loadDemoDisputesForRequest: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }),
}));
(globalThis as { React?: typeof React }).React = React;

const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');

const ROOT = path.resolve(__dirname, '../..');
const APP = path.join(ROOT, 'src/app');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

function filesUnder(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, exts));
    else if (exts.some((ext) => name.endsWith(ext))) out.push(full);
  }
  return out;
}

// ── 공용 입력 (서연 꼴) ────────────────────────────────────────────────

const D1 = 'PP-R-MBJ-10197650';
const D2 = 'PP-R-GMS-10197661';
const D3 = 'PP-R-FYT-10197651';
const SEOYEON = seedBuyers.find((b) => b.id === 'B01') as SeedBuyer;
const SWEATER = seedProducts.find((p) => p.sku === 'FK-SW-NV') as SeedProduct;

const cause = (subtype: Subtype, note?: string): Cause => ({
  subtype,
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
  ...(note === undefined ? {} : { causeNote: note }),
});

function board(spec: Partial<BoardState> & { disputeId: string; subtype: Subtype }): BoardState {
  const { subtype, ...rest } = spec;
  return {
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
    cause: cause(subtype),
    ...rest,
  };
}

const BEFORE = board({ disputeId: D2, subtype: 'A1' });
const AFTER = board({ disputeId: D2, subtype: 'A2', hasTracking: true, isDemo: true });
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};
const REAL_KO = '벌써 3주째인데 아직도 안 왔어요. 연락 없으면 카드사에 이의제기할게요.';
const REAL_EN = "It's been 3 weeks and it still hasn't arrived. If I don't hear back, I'll file a dispute with my card company.";
const OPENED_AT = '2026-11-09T13:12:00.000Z';
const NOW = '2026-11-11T03:00:00.000Z';

/** 서연 실제 분쟁 모양 (샌드박스 시각 + 시드 배송사·문의·주문일). */
function seoyeonLoaded(over: Partial<LoadedDispute> = {}): LoadedDispute {
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
    ...over,
  };
}

function caseInput(over: Partial<CaseViewInput> = {}): CaseViewInput {
  return {
    disputeId: D2,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyer: { name: SEOYEON.name, language: SEOYEON.language },
    product: { itemName: SWEATER.itemName },
    messages: caseMessages({ buyerMessages: [REAL_KO], buyerMessageEn: REAL_EN, buyerId: 'B01', inquiries: [], includeInquiries: false }),
    boardReal: BEFORE,
    boardDemo: AFTER,
    carrierEvents: carrierEventsFor('O01'),
    signals: SIGNALS,
    signalsAfterReply: null,
    demoFields: ['carrierEvents', 'hasTracking', 'cause'],
    ...over,
  };
}

const VIEW = buildCaseView(caseInput(), P, R);

// ── 가짜 예측 값 (계약 타입 모양. 엔진이 아니라 시험이 정한 값) ─────────────────

const FAKE_POINTS = (events: { at: string; kind: RiskPoint['kind'] }[]): RiskPoint[] =>
  events.map((event, index) => ({ at: event.at, kind: event.kind, pChargeback: 0.1 + index * 0.1 }));
const FAKE_FORECAST: ReplyForecast = {
  pWait: 0.71,
  pRefund: 0.17,
  pChargeback: 0.12,
  expectedCostCents: 3680,
  mood: 0.1,
  moodBand: 'okay',
  parts: [{ key: 'intercept', weight: -0.5 }],
};
const FAKE_FEATURES: { features: ReplyFeatures; hits: ReplyFeatureHits } = {
  features: { apology: true, cause: true, ask: false, date: true, lang: false, blame: true, vague: false, refundNow: false },
  hits: { apology: 'Sorry for the wait.', blame: "That's not our responsibility." },
};
const FAKE_MOVES: MoveForecast[] = [
  { move: 'fight', pChargeback: 0.12 },
  { move: 'refund', pChargeback: 0.03 },
];
const FAKE_WEEKLY: WeeklySummary = { openDisputes: 3, keepableCents: 4321, aiDrafts: 7, usesDemoData: true };

// ── 답장 칸 입력 ───────────────────────────────────────────────────────

const FACT_SETS = caseReplyFacts({ now: '2026-11-10T03:00:00Z', dueDate: AFTER.dueDate, buyerId: null, buyerLocale: 'ko' });
const FACTS: FactToken[] = FACT_SETS.outgoing;
const DRAFT_EN =
  "Sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧.";
const OUTGOING =
  '기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요.';

function fakeLlm(...answers: unknown[]): LlmCaller {
  let n = 0;
  return async () => answers[Math.min(n++, answers.length - 1)];
}

async function prepare(): Promise<{ draft: ReplyDraft; translation: ReplyTranslation }> {
  const draft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: AFTER.cause as Cause, move: 'fight', facts: FACTS },
    {
      llm: fakeLlm({
        buyer_message_en: 'It has not arrived.',
        coaching: ['Say sorry first.', 'Explain the hold.', 'Ask for the code.', 'Pass it on.', 'Give a date.'],
        draft_en: DRAFT_EN,
      }),
    },
  );
  const translation = await translateReply(
    { draftEn: DRAFT_EN, buyerLocale: 'ko', facts: FACTS, move: 'fight' },
    { llm: fakeLlm({ outgoing: OUTGOING }, { back_translation_en: 'Back translation.' }) },
  );
  return { draft, translation };
}

async function replyBase(): Promise<Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>> {
  const { draft, translation } = await prepare();
  return {
    draft,
    translation,
    facts: FACTS,
    draftFacts: FACT_SETS.draft,
    board: AFTER,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyerLocale: 'ko',
    plan: null,
    offerFirst: false,
    mode: 'simulated',
    draftSource: 'ai',
    riskAfterReply: null,
  };
}

// ───────────────────────────── 1. 어댑터 null = 대체안 화면 ─────────────────────────────

describe('완료 기준 1: 어댑터가 null이면 화면이 깨지지 않고 예측 칸만 숨는다', () => {
  it('브라우저 어댑터는 엔진 순수 함수 결과를 그대로 돌려준다 (T079)', () => {
    const input = { text: 'x', anchorText: 'x', board: AFTER, signals: SIGNALS, delayDays: 0 };
    expect(forecastReplyClient(input)).toEqual(forecastReply(input));
    expect(detectReplyFeaturesClient('Sorry')).toEqual(detectReplyFeatures('Sorry'));
  });

  it('서버 어댑터 파일은 server-only (T079: 몸통은 엔진·AI 호출)', () => {
    for (const file of ['src/app/cases/forecast-source.ts', 'src/app/cases/history-summary-source.ts']) {
      const code = read(file);
      expect(code, file).toMatch(/import 'server-only';/);
    }
  });

  it('보기용 값: 곡선·반응·칩·이번 주 돈·차지백 %는 null, 나머지는 그대로', () => {
    expect(curveView(null, null)).toBeNull();
    expect(reactionView(null, true)).toBeNull();
    expect(featureChips(null)).toBeNull();
    const weekly = weeklyView(3, null, true);
    expect(weekly).toEqual({ openDisputes: 3, keepable: null, aiDrafts: null, usesDemoData: true });
    const choices = choicesView(recommend(AFTER, P, R), null);
    expect(choices.length).toBe(3);
    for (const choice of choices) expect(choice.chargeback).toBeNull();
  });

  it('그림: 위험 곡선 카드·예상 반응·입력칸 % 없음, 요약 줄 없음, 선택지 카드·입력칸·전송본·검사·보내기는 있다', async () => {
    const desk = buildCaseDesk({
      view: VIEW,
      board: AFTER,
      buyer: SEOYEON,
      productName: SWEATER.itemName,
      openDays: 2,
      recommendation: recommend(AFTER, P, R),
      moveForecasts: null,
      history: historyView(caseEventsFor(seoyeonLoaded(), seedInquiries), 25, null),
      curvePoints: null,
      band: 'High',
    });
    const reply = createElement(ReplyPanel, {
      disputeId: D2,
      base: await replyBase(),
      replyId: 'r-1',
      languageKey: 'case.view.lang.KO',
      buyerShort: 'Seo-yeon',
      forecastBase: { signals: SIGNALS, delayDays: 2 },
      // 어댑터가 쓸 수 없음(null)을 돌려주는 경우 (T079 뒤에는 엔진이 예외를 던질 때)
      forecaster: () => null,
      detector: () => null,
    });
    const markup = html(createElement(CaseView, { view: VIEW, desk, llmOk: true, reply }));
    expect(markup).not.toContain('class="curve-card"');
    expect(markup).not.toContain('class="reaction"');
    expect(markup).not.toContain('reply-editor-pill');
    expect(markup).not.toContain('class="history-summary"');
    expect(markup).not.toMatch(/Chargeback \d+%/);
    // T122a: 전송본 제목은 시안 v6 "Translation (Korean)", 버튼은 "Send"
    const sheSees = t('case.reply.translationTitle', { language: t('case.view.lang.KO') });
    for (const needle of ['class="history-card"', 'class="choice-list"', 'class="reply-textarea"', sheSees, 'class="reply-foot"', '>Send</button>']) {
      expect(markup, needle).toContain(needle);
    }
    // 특징 판정이 없으면 지금 칩("Suggested reply covers")
    expect(markup).toContain(copyTables.en['case.reply.covers']);
    expect(markup).not.toContain(copyTables.en['case.reply.asYouType']);
  });

  it('왼쪽 이번 주 카드: 요약이 없으면 열린 분쟁 수 + 사실 한 줄만 (돈·초안 칸 없음)', () => {
    const view = buildToday({ disputes: [seoyeonLoaded()], tracking: null, products: seedProducts, now: new Date(NOW) });
    const markup = html(createElement(TodayList, { view, weekly: weeklyView(view.openDisputes, null, false), selectedId: null, paypalNotice: null }));
    expect(markup).toContain(t('today.weekly.open'));
    expect(markup).toContain(t('today.weekly.fact'));
    expect(markup).not.toContain(t('today.weekly.keepable'));
    expect(markup).not.toContain(t('today.weekly.drafts'));
  });
});

// ───────────────────────────── 2. 가짜 값을 넣으면 그대로 ─────────────────────────────

describe('완료 기준 2: 어댑터에 가짜 값(계약 타입)을 넣으면 그 값이 그대로 보인다', () => {
  const events = caseEventsFor(seoyeonLoaded(), seedInquiries);
  const points = FAKE_POINTS(events);

  it('위험 곡선: 점 수 = RiskPoint 수, 큰 % = 마지막 점(답장 예측이 없을 때)', () => {
    const curve = curveView(points, null);
    expect(curve?.dots).toHaveLength(points.length);
    expect(curve?.headline).toBe(toPercentRounded(points[points.length - 1].pChargeback));
    expect(curve?.draft).toBeNull();
    const markup = html(createElement(RiskCurveCard, { points }));
    expect(markup.match(/<circle class="curve-dot curve-dot-/g)).toHaveLength(points.length);
    expect(markup).toContain(`class="curve-headline num">${toPercentRounded(points[points.length - 1].pChargeback)}<`);
    expect(markup).toContain(copyTables.en['badge.assumption']);
  });

  it('위험 곡선 + 답장 예측: 끝에 "Your draft" 점 하나 + 큰 % = 예측 pChargeback + "89% → 8%" 꼴', () => {
    const curve = curveView(points, FAKE_FORECAST.pChargeback);
    expect(curve?.dots).toHaveLength(points.length);
    expect(curve?.draft).not.toBeNull();
    expect(curve?.headline).toBe(toPercentRounded(FAKE_FORECAST.pChargeback));
    expect(curve?.headlineKey).toBe('case.curve.withDraft');
    expect(curve?.fromTo).toBe(
      t('case.curve.fromTo', { from: toPercentRounded(points[points.length - 1].pChargeback), to: toPercentRounded(FAKE_FORECAST.pChargeback) }),
    );
  });

  it('예상 반응: 막대 3분할 비율 = 예측 확률 그대로(T090: --seg → width, transition), 기대 비용·기분·지금 기분', async () => {
    const reaction = reactionView(FAKE_FORECAST, true);
    expect(reaction?.parts.map((part) => [part.key, part.p, part.display])).toEqual([
      ['wait', 0.71, '71%'],
      ['refund', 0.17, '17%'],
      ['chargeback', 0.12, '12%'],
    ]);
    expect(reaction?.cost).toBe(toDollarsRounded(FAKE_FORECAST.expectedCostCents));
    expect(reaction?.moodKey).toBe('case.mood.okay');
    expect(reaction?.nowMoodKey).toBe('case.moodNow.angry');

    const markup = html(
      createElement(ReplyPanel, {
        disputeId: D2,
        base: await replyBase(),
        replyId: 'r-1',
        languageKey: 'case.view.lang.KO',
        buyerShort: 'Seo-yeon',
        forecastBase: { signals: SIGNALS, delayDays: 2 },
        forecaster: () => FAKE_FORECAST,
        detector: () => FAKE_FEATURES,
        // T091: 칩 효과 어댑터가 없을 때(null)의 칩 줄 = 특징 판정 칩 (이 시험이 보는 길)
        effects: () => null,
      }),
    );
    const bar = markup.slice(markup.indexOf('class="reaction-bar"'), markup.indexOf('class="reaction-legend"'));
    expect(bar).toContain('style="--seg:0.71"');
    expect(bar).toContain('style="--seg:0.17"');
    expect(bar).toContain('style="--seg:0.12"');
    expect(markup).toContain(t('case.reaction.cost', { amount: toDollarsRounded(3680) }));
    expect(markup).toContain(t('case.reaction.title', { name: 'Seo-yeon' }).replace(/'/g, '&#x27;'));
    expect(markup).toContain(`class="reaction-mood-value">${t('case.mood.okay')}<`);
    // T122a 시안 v6 L393: "now: angry" 줄은 없다 (오른쪽 칸 = Dispute risk 전 → 후 + "mood next · mood")
    expect(markup).not.toContain(t('case.reaction.moodNow', { mood: t('case.moodNow.angry') }));
    expect(markup).toContain(`class="reaction-mood-label">${t('case.reaction.riskTitle')}<`);
    // 입력칸 모서리 "Chargeback 12%"
    expect(markup).toContain(`class="reply-editor-pill num">${t('case.choice.chargeback', { percent: '12%' })}`);
    // T090: 입력칸 모서리 알약 안 Assumption은 뺐다 (Assumption은 반응 막대 쪽 하나만)
    const pill = markup.slice(markup.indexOf('class="reply-editor-pill num"'), markup.indexOf('class="reply-tray"'));
    expect(pill).not.toContain(copyTables.en['badge.assumption']);
    const reactionHead = markup.slice(markup.indexOf('class="reaction-head"'), markup.indexOf('class="reaction-bar"'));
    expect(reactionHead).toContain(copyTables.en['badge.assumption']);
    // As you type 칩: 참인 특징만, 좋은 것 ✓ 먼저, 조심할 것 ! (걸린 문장은 title)
    const tray = markup.slice(markup.indexOf('class="reply-tray-chips"'), markup.indexOf('class="reply-block reply-box"'));
    expect(tray).toContain(t('case.reply.asYouType'));
    expect(tray).toContain(t('case.reply.goodCount', { count: 3 }));
    expect([...tray.matchAll(/class="reply-chip reply-chip-(good|warn)"/g)].map((m) => m[1])).toEqual(['good', 'good', 'good', 'warn']);
    expect(tray).toContain('title="Sorry for the wait."');
    expect(tray).not.toContain(copyTables.en['case.reply.covers']);
  });

  it('예측 함수는 입력칸 글·기준 초안·보드·신호·늦은 날 수를 그대로 받는다', async () => {
    const calls: unknown[] = [];
    const base = await replyBase();
    html(
      createElement(ReplyPanel, {
        disputeId: D2,
        base,
        replyId: 'r-1',
        languageKey: 'case.view.lang.KO',
        forecastBase: { signals: SIGNALS, delayDays: 4 },
        forecaster: (input) => {
          calls.push(input);
          return null;
        },
      }),
    );
    const anchor = buildReplyView({ ...base, confirmed: [], sendState: 'idle', outcome: null }).draftEn?.text;
    // T122a: 두 번째 호출 = 위험 상자 "전" 값의 무응답 예측 (빈 글 + 늦은 날 수 noReplyDays)
    expect(calls).toEqual([
      { text: anchor, anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: 4, translated: false },
      { text: '', anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: 4 + (NO_REPLY_DAYS ?? 0), translated: false },
    ]);
  });

  it('선택지 카드 차지백 % = 수별 예측 그대로 (막힌 수·예측 없는 수는 없음)', () => {
    const choices = choicesView(recommend(AFTER, P, R), FAKE_MOVES);
    const byMove = Object.fromEntries(choices.map((choice) => [choice.move, choice.chargeback]));
    expect(byMove.fight).toBe('12%');
    expect(byMove.refund).toBe('3%');
    expect(byMove.offer).toBeNull(); // 서연 보드에서 제안은 엔진이 막는다
  });

  it('이번 주 카드: WeeklySummary 값 그대로 (열린 분쟁 · 지킬 수 있는 돈 · AI 초안 수 · Demo data)', () => {
    const weekly = weeklyView(99, FAKE_WEEKLY, false);
    expect(weekly).toEqual({ openDisputes: 3, keepable: toDollarsRounded(4321), aiDrafts: 7, usesDemoData: true });
    const view = buildToday({ disputes: [seoyeonLoaded()], tracking: null, products: seedProducts, now: new Date(NOW) });
    const markup = html(createElement(TodayList, { view, weekly, selectedId: null, paypalNotice: null }));
    expect(markup).toContain(`class="weekly-value num">${toDollarsRounded(4321)}<`);
    expect(markup).toContain('class="weekly-value num">7<');
    expect(markup).toContain('class="weekly-value num">3<');
    expect(markup).toContain(copyTables.en['badge.demo']);
    expect(markup).toContain(copyTables.en['badge.assumption']);
  });

  it('사건 기록 AI 요약: 값이 있을 때만 줄 + AI suggests', () => {
    const history = historyView(events, 25, 'She asked twice with no reply.');
    const markup = html(createElement(CaseHistoryCard, { history: history! }));
    expect(markup).toContain('She asked twice with no reply.');
    expect(markup).toContain(copyTables.en['badge.aiSuggests']);
    expect(html(createElement(CaseHistoryCard, { history: historyView(events, 25, null)! }))).not.toContain('history-summary');
  });
});

// ───────────────────────────── 3. 선택지 카드 = recommend ─────────────────────────────

describe('완료 기준 3: 선택지 카드 기대 손실 = recommend, "PayPal data only" = 배송사 기록 전 보드의 엔진 값', () => {
  it('수마다 기대 손실(센트)이 recommend(board).all 그대로, 최선 = best, 막힌 수 = blockedBy', () => {
    const rec = recommend(AFTER, P, R);
    const choices = choicesView(rec, null);
    for (const evaluation of rec.all) {
      const choice = choices.find((c) => c.move === evaluation.move);
      expect(choice?.expectedLoss?.cents ?? null).toBe(evaluation.expectedLossCents);
      expect(choice?.blocked).toBe(evaluation.blockedBy !== undefined || evaluation.expectedLossCents === null);
    }
    expect(choices.filter((c) => c.best).map((c) => c.move)).toEqual([rec.best?.move]);
    const offer = choices.find((c) => c.move === 'offer');
    expect(offer?.blockedKey).toBe('case.choice.blocked.OFFER_SCOPE');
  });

  it('"PayPal data only" 줄 = recommend(boardReal).best (서연: Full refund)', () => {
    const desk = buildCaseDesk({
      view: VIEW,
      board: AFTER,
      buyer: SEOYEON,
      productName: SWEATER.itemName,
      openDays: null,
      recommendation: recommend(AFTER, P, R),
      moveForecasts: null,
      history: null,
      curvePoints: null,
      band: null,
    });
    const before = recommend(BEFORE, P, R).best;
    expect(desk.paypalOnly).toBe(
      t('case.choice.paypalOnly', { action: t('case.view.action.refund'), amount: toDollarsRounded(before?.expectedLossCents as number) }),
    );
    const noCarrier = buildCaseDesk({
      view: buildCaseView(caseInput({ boardDemo: null }), P, R),
      board: BEFORE,
      buyer: null,
      productName: null,
      openDays: null,
      recommendation: recommend(BEFORE, P, R),
      moveForecasts: null,
      history: null,
      curvePoints: null,
      band: null,
    });
    expect(noCarrier.paypalOnly).toBeNull();
  });
});

// ───────────────────────────── 4. 사건 기록 = 실제 데이터만 ─────────────────────────────

describe('완료 기준 4: CaseEvent[]는 실제 데이터에서만 (서연)', () => {
  const events = caseEventsFor(seoyeonLoaded(), seedInquiries);

  it('사건 목록: 주문 → 발송 → 추적 없음 → 배송사 2줄 → 시드 문의 2건 → 실제 분쟁 글 → 분쟁 접수 (지어낸 사건 없음)', () => {
    expect(events.map((e) => e.kind)).toEqual([
      'order_paid',
      'shipped',
      'tracking_missing',
      'carrier_event',
      'carrier_event',
      'buyer_message',
      'buyer_message',
      'buyer_message',
      'dispute_opened',
    ]);
    // 판매자 답장·약속 같은 없는 사건이 없다
    expect(events.some((e) => e.kind === 'seller_reply')).toBe(false);
    expect(events.map((e) => e.text).join('\n')).not.toMatch(/promise|Nov 5|refund/i);
  });

  it('날짜는 데이터 그대로, 시드 사건은 source "seed", 실제 사건은 "sandbox"', () => {
    const order = seedOrders.find((o) => o.id === 'O01');
    const carrier = carrierEventsFor('O01');
    const ofSeoyeon = seedInquiries.filter((i) => i.buyerId === 'B01').map((i) => i.date).sort();
    expect(events[0]).toMatchObject({ at: `${order?.date}T00:00:00.000Z`, source: 'seed' });
    expect(events[1]).toMatchObject({ at: `${carrier[0].date}T00:00:00.000Z`, source: 'seed' });
    expect(events[2]).toMatchObject({ kind: 'tracking_missing', at: `${carrier[0].date}T00:00:00.000Z`, source: 'sandbox' });
    expect(events.slice(3, 5).map((e) => e.at.slice(0, 10))).toEqual(carrier.slice(1).map((c) => c.date));
    expect(events.slice(3, 5).every((e) => e.source === 'seed')).toBe(true);
    expect(events.slice(5, 7).map((e) => e.at.slice(0, 10))).toEqual(ofSeoyeon);
    expect(events.slice(5, 7).every((e) => e.source === 'seed')).toBe(true);
    expect(events[7]).toMatchObject({ kind: 'buyer_message', at: OPENED_AT, source: 'sandbox' });
    expect(events[8]).toEqual({ at: OPENED_AT, kind: 'dispute_opened', source: 'sandbox', text: t('case.history.event.dispute_opened') });
  });

  it('표시: 카드사 언급 = threat, 마지막 실제 글 + AI 화남 = angry, 답장 없음 = unanswered', () => {
    const real = events[7];
    expect(real.flags).toEqual(['threat', 'angry', 'unanswered']);
    expect(events[5].flags).toEqual(['unanswered']); // Nov 2 문의
    const replied = buildCaseEvents({
      orderDate: null,
      carrierEvents: [],
      hasTrackingInPayPal: null,
      inquiries: [],
      buyerMessages: [{ text: 'Where is it?', at: '2026-11-01T00:00:00Z' }],
      sellerReplies: [{ at: '2026-11-02T00:00:00Z' }],
      openedAt: null,
      angryTone: false,
    });
    expect(replied.map((e) => e.kind)).toEqual(['buyer_message', 'seller_reply']);
    expect(replied[0].flags).toBeUndefined();
  });

  it('같은 글이면(시드 문의 = 실제 글) 실제 것 하나만, 추적이 PayPal에 있으면 "추적 없음" 줄이 없다', () => {
    const same = caseEventsFor(
      seoyeonLoaded({
        boardReal: { ...BEFORE, hasTracking: true },
        timeline: {
          openedAt: null,
          buyerMessages: [{ text: seedInquiries[1].original, at: '2026-11-02T10:00:00Z' }],
          sellerReplies: [],
          orderDate: null,
        },
      }),
      seedInquiries,
    );
    const messages = same.filter((e) => e.kind === 'buyer_message');
    expect(messages.map((e) => e.source)).toEqual(['sandbox', 'seed']);
    expect(same.some((e) => e.kind === 'tracking_missing')).toBe(false);
  });

  it('날짜 차: 열린 날 수·기록 날 수·늦은 날 수는 달력 날짜 빼기만', () => {
    expect(daysBetween(OPENED_AT, NOW)).toBe(2);
    expect(historySpanDays(events, NOW)).toBe(daysBetween(events[0].at, NOW));
    // 답장한 적이 없으면 첫 구매자 글(Nov 2)부터
    expect(unansweredDays(events, NOW)).toBe(daysBetween('2026-11-02', NOW));
    expect(unansweredDays([], NOW)).toBe(0);
  });

  it('사건 기록 카드: N events · D days, 시드 줄에 Demo data, 표시 알약', () => {
    const history = historyView(events, 25, null)!;
    const markup = html(createElement(CaseHistoryCard, { history }));
    expect(markup).toContain(t('case.history.sub', { count: events.length, days: 25 }));
    expect(markup.match(/class="history-row"/g)).toHaveLength(events.length);
    expect(markup).toContain(copyTables.en['badge.demo']);
    expect(markup).toContain(t('case.history.flag.threat'));
  });
});

// ───────────────────────────── 5. 입력칸 글 ≠ 초안 → 보내기 꺼짐 ─────────────────────────────

describe('완료 기준 5: 입력칸 글이 초안과 다르면 [Send]가 꺼지고, 같으면 지금 관문 그대로', () => {
  // T100: "고친 글은 보낼 수 없음" → "고친 글은 번역·검사를 거쳐야 보낼 수 있음" (검사 전에는 그대로 꺼짐)
  it('editGate: 같으면 받은 관문 그대로, 다르면 검사 전까지 꺼짐 ("Edited — translate and check it before sending")', () => {
    const ok = { ok: true, reasonKey: null };
    const blocked = { ok: false, reasonKey: 'case.send.blocked.checkFailed' };
    expect(editGate(ok, 'same', 'same')).toEqual({ ...ok, translate: false });
    expect(editGate(blocked, 'same', 'same')).toEqual({ ...blocked, translate: false });
    expect(editGate(ok, 'edited', 'same')).toEqual({ ok: false, reasonKey: EDITED_KEY, translate: true });
    // 빈 글은 번역하지 않는다. T104 F4-69: 시안처럼 이유 글 없이 꺼진다
    expect(editGate(ok, '', 'same')).toEqual({ ok: false, reasonKey: null, translate: false });
    expect(editGate(ok, 'anything', null)).toEqual({ ...ok, translate: false }); // 초안이 없으면(입력칸 없음) 관문 그대로
    expect(t(EDITED_KEY)).toBe('Edited — translate and check it before sending');
  });

  it('처음 그림(입력칸 = 초안): 보내기 버튼은 지금 관문(canSend) 그대로 — 계획이 있으면 켜짐', async () => {
    const base = await replyBase();
    const plan = {
      planId: 'p-1',
      disputeId: D2,
      move: 'fight' as const,
      apiMove: 'send_message' as const,
      amountCents: null,
      currency: 'USD' as const,
      refundType: null,
      messageRequired: true,
      requiresApproval: true as const,
    };
    const withPlan = { ...base, plan };
    expect(canSend(buildReplyView({ ...withPlan, confirmed: [], sendState: 'idle', outcome: null }))).toEqual({ ok: true, reasonKey: null });
    const markup = html(createElement(ReplyPanel, { disputeId: D2, base: withPlan, replyId: 'r-1', languageKey: 'case.view.lang.KO' }));
    expect(markup).toMatch(/<button type="button" class="reply-button" aria-describedby="reply-send-why">Send<\/button>/);
    expect(markup).not.toContain(t(EDITED_KEY));
  });

  it('보내는 경로는 그대로: 버튼은 서버가 기억한 답장 번호만 보낸다 (입력칸 글은 보내기 서버 액션으로 가지 않는다)', () => {
    const panel = read('src/app/cases/reply/reply-panel.tsx');
    // T100: 고친 글이면 서버가 검사하고 기억한 번호(sendId), 아니면 AI 초안 번호 — 어느 쪽이든 번호만
    expect(panel).toMatch(/sendReplyAction\(\{ disputeId, kind, replyId: sendId, confirmedCommitments: confirmed \}\)/);
    expect(panel).toMatch(/const gate: EditedGate = editGate\(/);
    // 보내기 관문·모드 파일은 이 작업에서 바뀌지 않는다 (판정 함수 이름 그대로)
    expect(read('src/app/_server/send.ts')).toMatch(/export async function sendReply/);
  });
});

// ───────────────────────────── 6. 목록 ─────────────────────────────

describe('완료 기준 6: 목록 — Lena·Yuki·통관부호 없음, HEY·GAH 없음, 번호 PP-R-…, 서연 마감 11/30', () => {
  const mike = board({ disputeId: D3, subtype: 'F1', stage: 'CHARGEBACK', allowedMoves: ['accept_claim'], amountCents: 3500, hasDeliveredTracking: true, hasTracking: true, buyerPriorInrDisputes: 2 });
  const jiho = board({ disputeId: D1, subtype: 'B1', reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', amountCents: 4800 });
  const disputes: LoadedDispute[] = [
    seoyeonLoaded(),
    seoyeonLoaded({
      key: 'D1',
      disputeId: D1,
      buyer: seedBuyers.find((b) => b.id === 'B02') ?? null,
      product: seedProducts.find((p) => p.sku === 'FK-CD-OAT') ?? null,
      boardReal: jiho,
      boardDemo: null,
      demoFields: [],
      carrierEvents: [],
      signals: { ...SIGNALS, mentionsCardCompany: false, angryTone: false, secondMessageUnanswered: false },
    }),
    seoyeonLoaded({
      key: 'D3',
      disputeId: D3,
      buyer: seedBuyers.find((b) => b.id === 'B04') ?? null,
      product: seedProducts.find((p) => p.sku === 'FK-BN-SET') ?? null,
      boardReal: mike,
      boardDemo: mike,
      demoFields: [],
      carrierEvents: [],
    }),
  ];
  const tracking: TrackingSummary = {
    untracked: [
      { key: 'O05', buyerName: null, productName: 'Knit Cardigan, Oat' },
      { key: 'O07', buyerName: null, productName: 'Beanie + Scarf Set' },
    ],
    excluded: [],
  };
  const view = buildToday({ disputes, tracking, products: seedProducts, now: new Date(NOW) });
  const markup = html(createElement(TodayList, { view, selectedId: D2, paypalNotice: null }));

  it('묶음 (T122b → T122d 시안 v6): Reply needed(서연·지호·Lena 데모·Mike 맨 뒤) / Prevent(추적 2건·가디건) / Questions(Yuki 데모)', () => {
    expect(view.groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([
      ['Reply needed', [D2, D1, 'lena', D3]],
      ['Prevent', ['tracking', 'FK-CD-OAT']],
      ['Questions', ['yuki']],
    ]);
    expect(view.groups.map((g) => g.hint)).toEqual([
      t('today.groupHint.needsYou'),
      t('today.groupHint.prevent'),
      t('today.groupHint.routine'),
    ]);
  });

  it('분쟁 줄 머리 = PayPal 분쟁 번호, 서연 "Reply by Nov 30", 구매자 · 나라, 범주 알약', () => {
    const seoyeon = view.groups[0].items[0];
    expect(seoyeon.row.head).toBe(D2);
    expect(seoyeon.row.head).toMatch(/^PP-R-/);
    expect(seoyeon.row.due).toBe('Reply by Nov 30');
    expect(seoyeon.row.who).toBe(`${latinName(SEOYEON.name)} · ${SEOYEON.country}`);
    expect(seoyeon.row.category).toBe(categoryLabel(AFTER.reason, 'A2'));
    expect(seoyeon.row.categoryTone).toBe('high');
    for (const item of view.groups.flatMap((g) => g.items).filter((i) => i.kind === 'dispute')) {
      expect(item.row.head).toMatch(/^PP-R-[A-Z]+-\d+$/);
    }
  });

  it('통관부호 묶음·HEY·GAH가 없다. #10xx 번호는 시드 데모 항목(Lena #1029·Yuki #1051, Demo data — DECISIONS v2.16 20:35 ③)뿐', () => {
    expect(markup).not.toMatch(/customs ID missing|Customs ID|HEY-|GAH-/);
    expect([...markup.matchAll(/#10\d\d/g)].map((m) => m[0])).toEqual(['#1029', '#1051']);
    const demo = view.groups.flatMap((g) => g.items).filter((i) => i.kind === 'demo');
    expect(demo.map((i) => [i.id, i.row.head, i.status.key])).toEqual([
      ['lena', '#1029', 'badge.demo'],
      ['yuki', '#1051', 'badge.demo'],
    ]);
  });

  it('상품 거르개: ?sku=로 목록을 거르고, 숫자는 시드 재고·분쟁 수를 센 것', () => {
    const all = view.filter.chips[0];
    const units = seedProducts.reduce((sum, p) => sum + p.stock, 0);
    expect(all.sub).toBe(t('today.filter.allSub', { count: seedProducts.length, units }));
    expect(view.filter.summary).toBe(t('today.filter.summary', { products: seedProducts.length, units, cases: 3 }));
    const sweater = view.filter.chips.find((c) => c.sku === 'FK-SW-NV');
    expect(sweater?.cases).toBe(1);
    expect(sweater?.href).toBe('/?sku=FK-SW-NV');

    const filtered = buildToday({ disputes, tracking, products: seedProducts, now: new Date(NOW), sku: 'FK-CD-OAT' });
    expect(filtered.groups.flatMap((g) => g.items.map((i) => i.id))).toEqual([D1, 'tracking', 'FK-CD-OAT', 'yuki']);
    expect(filtered.groups[0].items[0].href).toBe(`/?sku=FK-CD-OAT&item=${D1}`);
    expect(filtered.count).toBe(view.count); // 위쪽 막대 Today (N)은 거르개와 상관없이 전체
    expect(buildToday({ disputes, tracking, products: seedProducts, now: new Date(NOW), sku: 'NOPE' }).filter.selectedSku).toBeNull();

    // T106: 칩은 `<button aria-pressed>` (시안 L111). 상자 밖에서는 서버가 고른 SKU를 그대로 보인다
    const bar = html(createElement(ProductFilterBar, { filter: filtered.filter, cases: casesOf(view.groups) }));
    expect(bar.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(bar).toContain(filtered.filter.summary);
    expect(bar).toContain('Knit Cardigan');
  });
});

// ───────────────────────────── 7·8. 금지 색·숫자·문구 ─────────────────────────────

describe('완료 기준 7·8: 화면 코드에 금액·확률 숫자·근거 없는 성과 숫자·환불 약속 문구가 없다', () => {
  const screenFiles = [
    'src/app/cases/desk-model.ts',
    'src/app/cases/history.ts',
    'src/app/cases/view/case-view.tsx',
    'src/app/cases/view/case-history.tsx',
    'src/app/cases/view/risk-curve.tsx',
    'src/app/cases/reply/reply-panel.tsx',
    'src/app/today/today-list.tsx',
    'src/app/today/model.ts',
    'src/app/_shared/top-bar.tsx',
  ];

  it('금액·확률 숫자가 코드에 없다 ($, %, 0.xx 확률, 72·74·37·312 같은 금액)', () => {
    for (const file of screenFiles) {
      const code = strip(read(file));
      expect(code, file).not.toMatch(/\$\d/);
      expect(code, file).not.toMatch(/\b\d+(\.\d+)?%/);
      expect(code, file).not.toMatch(/(?<![\w.])0\.\d+(?![\w.])/);
      expect(code, file).not.toMatch(/\b(72|74|37|312|7\.20)\b/);
    }
  });

  it('"Refund backup"·"refund you in full"·근거 없는 성과(막은 분쟁·$312·14 min)·보낸 뒤 가상 진행 단계가 없다', () => {
    // T116 F5-3: Send 뒤 바깥 칸의 aria 이름(`case.progress.zone` = "Case progress", 지시서 승인) 한 키만 뺀다.
    // 보이는 제목·가상 단계 문구로 "Case progress"가 다시 들어오면 여전히 걸린다
    const withoutZone = (table: Record<string, string>) =>
      Object.fromEntries(Object.entries(table).filter(([key]) => key !== 'case.progress.zone'));
    const texts = [
      ...filesUnder(APP, ['.ts', '.tsx']).map((file) => strip(readFileSync(file, 'utf8'))),
      JSON.stringify(withoutZone(copyTables.en)),
      JSON.stringify(withoutZone(copyTables.ko)),
    ].join('\n');
    expect(texts).not.toMatch(/refund backup|refund you in full|Disputes prevented|Money kept|First reply time|14 min|Case progress|전액 환불해 드릴게요|환불 약속/i);
    expect(texts).not.toMatch(/Expected delivery/i);
  });

  it('2차 리뷰 ⑤: 서랍 Close 한 줄 (T114: AG Grid 상품 이름 규칙은 /products와 함께 지웠다)', () => {
    const shell = read('src/app/_shared/shell.css');
    expect(shell.match(/\.drawer-close\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/white-space:\s*nowrap/);
  });

  it('출처 배지 5종이 남아 있다 (Demo data · Assumption · AI suggests · Code decides · cached)', () => {
    for (const key of ['badge.demo', 'badge.assumption', 'badge.aiSuggests', 'badge.codeDecides', 'badge.cached']) {
      expect(typeof copyTables.en[key], key).toBe('string');
    }
  });

  it('"AI read" 태그는 있는 판정만: 카드사 언급(엔진 신호 + 표시) · 화남(AI 어조, 마지막 실제 글)', () => {
    expect(readTags({ marked: true, isLastReal: true, signals: SIGNALS }).map((tag) => tag.key)).toEqual(['case.read.threat', 'case.read.angry']);
    expect(readTags({ marked: true, isLastReal: false, signals: { ...SIGNALS, mentionsCardCompany: false } })).toEqual([]);
    expect(readTags({ marked: false, isLastReal: true, signals: { ...SIGNALS, angryTone: null } })).toEqual([]);
    expect(readTags({ marked: true, isLastReal: true, signals: null })).toEqual([]);
  });
});
