/**
 * T090 단위 테스트: 시안 맞추기 A — 배치·작은 UI + 모션 (SPEC v2.15, 시안 `docs/design/mockup-v4/Desk.dc.html`).
 *
 * 기대값 출처: `tasks/T090.md` "만들 것" 1~11·"모션"·"완료 기준", SPEC v2.13 3장(출처 표시 3종)·8-4장(모션).
 * **실호출 0회** — AI는 가짜 LlmCaller, PayPal 읽기는 가짜. 개발 서버 없음 (`renderToStaticMarkup`). `.env`를 읽지 않는다.
 * 숫자는 엔진 함수 결과와 비교만 한다 (시험이 기대값을 계산하지 않는다).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { Badge } from '@/app/_shared/badges';
import { copyKeys, copyTables, t } from '@/app/_shared/copy';
import { toDollarsRounded } from '@/app/_shared/money';
import { loadMotion, motionVars } from '@/app/_shared/motion';
import { caseEventsFor, unansweredDays } from '@/app/cases/history';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, canSend, detailsMustOpen, type ReplyViewInput } from '@/app/cases/reply-model';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import type { BoardState, Cause, CaseEvent, EscalationSignals, FactToken, LlmCaller, SeedBuyer, SeedProduct, Subtype } from '@/types';

import { carrierEventsFor, seedBuyers, seedInquiries, seedOrders, seedProducts } from '../../seed/index';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputes: async () => ({ disputes: [], paypal: { ok: false, reason: 'not_configured' }, llm: { ok: false } }),
  loadDemoDisputesForRequest: async () => ({ disputes: [], paypal: { ok: false, reason: 'not_configured' }, llm: { ok: false } }),
}));
vi.mock('@/app/_server/paypal', () => ({
  getPayPalClient: () => ({ ok: false, reason: 'not_configured' }),
  getPayPalReadClient: () => ({ ok: false, reason: 'not_configured' }),
}));
(globalThis as { React?: typeof React }).React = React;

const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');
const { CaseView } = await import('@/app/cases/view/case-view');
const { Conversation } = await import('@/app/cases/view/conversation');
const { RiskCurveCard } = await import('@/app/cases/view/risk-curve');
const { CaseHistoryCard } = await import('@/app/cases/view/case-history');
const { TopBar } = await import('@/app/_shared/top-bar');
const { buildCaseView, caseMessages } = await import('@/app/cases/model');
const { buildCaseDesk, historyView } = await import('@/app/cases/desk-model');
const { loadMoveForecasts, loadRiskCurve, replyTranslated } = await import('@/app/cases/forecast-source');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

// ── 서연 보기용 데이터 (가짜 AI 초안 — app-t079와 같은 꼴) ─────────────────────

const D2 = 'PP-R-GMS-10197661';
const SEOYEON = seedBuyers.find((b) => b.id === 'B01') as SeedBuyer;
const SWEATER = seedProducts.find((p) => p.sku === 'FK-SW-NV') as SeedProduct;
const NOW = '2026-11-11T03:00:00.000Z';
const OPENED_AT = '2026-11-09T13:12:00.000Z';
const REAL_KO = '벌써 3주째인데 아직도 안 왔어요. 연락 없으면 카드사에 이의제기할게요.';
const REAL_EN = "It's been 3 weeks and it still hasn't arrived. If I don't hear back, I'll file a dispute with my card company.";
const INQUIRY = { date: '2026-11-02', buyerId: 'B01', original: '배송 조회가 일주일째 그대로예요.', english: 'Tracking has not changed in a week.' };

const cause = (subtype: Subtype): Cause => ({ subtype, confidence: 1, evidence: [], needsReview: false, source: 'rule' });

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

type Base = Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;

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

function baseOf(draft: ReplyDraft, translation: ReplyTranslation | null): Base {
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

/** 가짜로 검사 하나를 실패시킨 전송본 (새 약속). 보내는 글은 바꾸지 않는다. */
function failing(translation: ReplyTranslation): ReplyTranslation {
  if (!translation.ok) throw new Error('translation failed');
  return { ...translation, check: { ...translation.check, ok: false, newPromises: ['refund you in full'] }, sendable: false };
}

const EVENTS: CaseEvent[] = caseEventsFor(
  {
    buyer: SEOYEON,
    boardReal: BEFORE,
    demoFields: ['carrierEvents', 'hasTracking', 'cause', 'earlierInquiries'],
    carrierEvents: carrierEventsFor('O01'),
    signals: SIGNALS,
    timeline: {
      openedAt: OPENED_AT,
      buyerMessages: [{ text: REAL_KO, at: OPENED_AT }],
      sellerReplies: [],
      orderDate: seedOrders.find((o) => o.id === 'O01')?.date ?? null,
    },
  },
  seedInquiries,
);
const DELAY = unansweredDays(EVENTS, NOW);
const TRANSLATED = replyTranslated('ko');

const CASE_VIEW = buildCaseView({
  disputeId: D2,
  statusCode: 'WAITING_FOR_SELLER_RESPONSE',
  buyer: { name: SEOYEON.name, language: SEOYEON.language },
  product: { itemName: SWEATER.itemName },
  messages: caseMessages({ buyerMessages: [REAL_KO], buyerMessageEn: REAL_EN, buyerId: 'B01', inquiries: [INQUIRY], includeInquiries: true }),
  boardReal: BEFORE,
  boardDemo: AFTER,
  carrierEvents: carrierEventsFor('O01'),
  signals: SIGNALS,
  signalsAfterReply: null,
  demoFields: ['carrierEvents', 'hasTracking', 'cause', 'earlierInquiries'],
});

/** 서연 화면 전체 (case-detail.tsx와 같은 길: 기본 어댑터 = 엔진). */
async function fullCase(translationOverride?: (t: ReplyTranslation) => ReplyTranslation): Promise<string> {
  const { draft, translation } = await prepare();
  const base = baseOf(draft, translationOverride === undefined ? translation : translationOverride(translation));
  const anchor = buildReplyView({ ...baseOf(draft, translation), confirmed: [], sendState: 'idle', outcome: null }).draftEn?.text ?? null;
  const anchorInput = { signals: SIGNALS, delayDays: DELAY, anchorText: anchor, translated: TRANSLATED };
  const desk = buildCaseDesk({
    view: CASE_VIEW,
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
    paypalOnly: desk.paypalOnly,
  });
  return html(createElement(CaseView, { view: CASE_VIEW, desk, llmOk: true, reply }));
}

const detailsOf = (markup: string): string => {
  const start = markup.indexOf('class="reply-details"');
  return start < 0 ? '' : markup.slice(start, markup.indexOf('</ul>', start) + 5);
};

// ───────────────────────────── 완료 기준 1: 안전장치 ─────────────────────────────

describe('완료 기준 1: 검사 하나 실패(가짜) → Send 꺼짐 + Details 자동 펼침', () => {
  it('통과면 Details는 접혀 있고 Send는 켜진다', async () => {
    const markup = await fullCase();
    expect(markup).toMatch(/class="reply-details-toggle" aria-expanded="false"/);
    expect(detailsOf(markup)).toMatch(/^class="reply-details"[^>]*hidden/);
    expect(markup).toMatch(/<button type="button" class="reply-button"(?![^>]*disabled)[^>]*>Send in Korean/);
  });

  it('새 약속 검사 실패 → Send disabled + Details 펼침(닫을 수 없음) + 실패한 줄이 보인다', async () => {
    const markup = await fullCase(failing);
    expect(markup).toMatch(/<button type="button" class="reply-button" disabled=""[^>]*>Send in Korean/);
    expect(markup).toMatch(/class="reply-details-toggle" aria-expanded="true"[^>]*data-forced="true"/);
    const details = detailsOf(markup);
    expect(details).not.toMatch(/^class="reply-details"[^>]*hidden/);
    expect(details).toMatch(/class="reply-check reply-check-failed"[\s\S]*?No new promises[\s\S]*?refund you in full/);
    expect(markup).toContain(t('case.send.blocked.checkFailed'));
  });

  it('판정은 순수 함수: detailsMustOpen = 검사 실패 또는 번역이 더한 약속, 그때 canSend는 거짓', async () => {
    const { draft, translation } = await prepare();
    const ok = buildReplyView({ ...baseOf(draft, translation), confirmed: [], sendState: 'idle', outcome: null });
    const bad = buildReplyView({ ...baseOf(draft, failing(translation)), confirmed: [], sendState: 'idle', outcome: null });
    expect(detailsMustOpen(ok)).toBe(false);
    expect(canSend(ok).ok).toBe(true);
    expect(detailsMustOpen(bad)).toBe(true);
    expect(canSend(bad).ok).toBe(false);
    expect(detailsMustOpen({ ...ok, addedInTranslation: [{ category: 'refund', labelKey: 'x' }] })).toBe(true);
    // AI 초안이 없으면 펼칠 것도 없다
    expect(detailsMustOpen({ ...ok, available: false })).toBe(false);
  });

  it('Details 순서: "PayPal data only" 한 줄 → 역번역(영어) → 검사 3개(Facts match · No new promises · Follow-up date)', async () => {
    const details = detailsOf(await fullCase());
    const paypalOnly = t('case.choice.paypalOnly', {
      action: t('case.view.action.refund'),
      amount: toDollarsRounded(recommend(BEFORE).best?.expectedLossCents as number),
    });
    const at = [paypalOnly, 'Back-translation to English', 'Facts match', 'No new promises', t('case.reply.fact.DATE')].map((needle) =>
      details.indexOf(needle),
    );
    for (const index of at) expect(index).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect((details.match(/class="reply-check/g) ?? []).length).toBe(3);
  });
});

// ───────────────────────────── 완료 기준 2: 출처 표시 3종 ─────────────────────────────

describe('완료 기준 2: "Code decides"·"AI suggests" 점선 배지 없음, Assumption·Demo data·AI 알약 있음', () => {
  it('Badge: codeDecides는 그리지 않고, aiSuggests는 "AI" 알약', () => {
    expect(html(createElement(Badge, { kind: 'codeDecides' }))).toBe('');
    const pill = html(createElement(Badge, { kind: 'aiSuggests' }));
    expect(pill).toMatch(/^<span class="ai-pill"/);
    expect(pill).toContain('>AI</span>');
    expect(pill).not.toContain('badge-border-dashed');
    expect(copyTables.en['badge.aiSuggests']).toBe('AI');
  });

  it('서연 화면 전체: 알약·Assumption·Demo data 있음, 점선/실선 배지 없음', async () => {
    const markup = await fullCase();
    expect(markup).toContain('class="ai-pill"');
    expect(markup).toContain(copyTables.en['badge.assumption']);
    expect(markup).toContain(copyTables.en['badge.demo']);
    for (const banned of ['Code decides', 'AI suggests', 'badge-border-dashed', 'badge-border-solid']) {
      expect(markup, banned).not.toContain(banned);
    }
  });

  it('화면 코드 어디에도 Code decides 배지를 직접 그리지 않는다 (지호·Mike·Products·서랍·/intro·/listing 포함)', () => {
    for (const file of filesUnder(path.join(ROOT, 'src/app')).filter((f) => /\.tsx$/.test(f))) {
      const text = strip(read(path.relative(ROOT, file)));
      expect(text, path.relative(ROOT, file)).not.toMatch(/kind="codeDecides"|<CodeDecidesBadge/);
    }
  });
});

// ───────────────────────────── 완료 기준 3: 숫자 일치 ─────────────────────────────

describe('완료 기준 3: AC33 반응 막대 = 선택지 Reply = 엔진 fight (화면 그대로)', () => {
  it('같은 화면 안에서 세 글자가 같다', async () => {
    const markup = await fullCase();
    const fight = recommend(AFTER).all.find((e) => e.move === 'fight');
    const amount = toDollarsRounded(fight?.expectedLossCents as number);
    const fightCard = markup.slice(markup.indexOf('class="choice choice-best"'));
    expect(fightCard.slice(0, fightCard.indexOf('</li>'))).toContain(t('case.choice.cost', { amount }));
    expect(markup).toContain(t('case.reaction.cost', { amount }));
  });

  it('전송 관문·모드·기록 파일은 이 태스크에서 손대지 않는다 (공개 모드 쓰기 0회는 app-send·ops-t070 시험 그대로)', () => {
    // 관문은 서버 액션 → send.ts 하나뿐: 답장 칸은 replyId만 보낸다
    const panel = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(panel).toMatch(/sendReplyAction\(\{ disputeId, kind, replyId: sendId, confirmedCommitments: confirmed \}\)/); // T100: 번호만
    expect(panel).not.toMatch(/fetch\(|api-m\.sandbox/);
  });
});

// ───────────────────────────── 완료 기준 4: 문구 키 ─────────────────────────────

describe('완료 기준 4: copy en/ko 키 집합 같음', () => {
  it('두 파일 키가 같고, T090 새 키가 있다', () => {
    expect(copyKeys(copyTables.ko)).toEqual(copyKeys(copyTables.en));
    for (const key of [
      'case.view.translated',
      'case.reply.sheSees',
      'case.reply.details',
      'case.reply.detailsHide',
      'case.history.beforeTag',
      'case.curve.tick100',
      'case.curve.tick50',
    ]) {
      expect(typeof copyTables.en[key], key).toBe('string');
      expect(typeof copyTables.ko[key], key).toBe('string');
    }
  });
});

// ───────────────────────────── 만들 것 1~10: 배치 ─────────────────────────────

describe('만들 것 1: 위쪽 막대 — 로고·꼬리표·날짜 왼쪽, 탭·서랍·언어·판매자 오른쪽에 작게', () => {
  const markup = html(
    createElement(TopBar, { seller: { initial: 'H', shop: 'Fernwood Knits' }, modeNote: t('mode.public'), dateLine: 'Wed, Nov 11' }),
  );

  it('순서: 로고 → 날짜 → (오른쪽 묶음: 공개 데모 글자 → 탭 → PayPal activity → EN/KO → 판매자)', () => {
    const at = (needle: string) => markup.indexOf(needle);
    const order = [
      at('class="shell-brand"'),
      at('class="shell-date"'),
      at('class="shell-actions"'),
      at('class="shell-mode-note"'),
      at('class="shell-seller"'),
    ];
    for (const index of order) expect(index).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // T096: 탭 없음
    expect(markup).not.toContain('shell-tab');
    expect(markup).not.toContain(t('nav.listing'));
  });

  it('"Public demo · simulated sends"는 작은 회색 글자, 탭은 작은 글자', () => {
    const css = read('src/app/_shared/shell.css');
    const note = css.match(/\.shell-mode-note\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(note).toMatch(/font-size:\s*var\(--text-xs\)/);
    expect(note).toMatch(/color:\s*var\(--color-muted\)/);
  });
});

describe('만들 것 2~5·10: 사례 화면', () => {
  it('2: 머리글에 "High · Score 6" 펼침이 없다', async () => {
    const markup = await fullCase();
    expect(markup).not.toContain('case-risk-button');
    expect(markup).not.toMatch(/Score \d/);
  });

  it('3: 위험 곡선 — 100%·50% 눈금 글자, 끝점 둘레 연한 물결 원(r = 설정의 시작 반지름)', () => {
    const points = [
      { at: '2026-10-18', kind: 'shipped' as const, pChargeback: 0.1 },
      { at: '2026-11-09', kind: 'buyer_message' as const, pChargeback: 0.6 },
    ];
    const markup = html(createElement(RiskCurveCard, { points }));
    expect(markup).toContain(`>${t('case.curve.tick100')}</span>`);
    expect(markup).toContain(`>${t('case.curve.tick50')}</span>`);
    expect(markup).toMatch(new RegExp(`<circle class="curve-ping"[^>]*r="${loadMotion().desk.ping.fromRadius}"`));
  });

  it('4: 대화 — 배송사 줄 없음, "Translated · 영어 · 날짜", 태그는 "AI read" + 2개까지, 시연용 말풍선 끝 Demo data 하나', () => {
    const markup = html(
      createElement(Conversation, { messages: CASE_VIEW.messages, carrierLine: CASE_VIEW.carrierLine, locale: 'ko', signals: SIGNALS }),
    );
    expect(markup).not.toContain('case-carrier-line');
    expect(markup).not.toContain('Carrier:');
    expect(markup).toContain(`<span>${t('case.view.translated')}</span> · `);
    for (const tags of markup.match(/<div class="case-read">[\s\S]*?<\/div>/g) ?? []) {
      expect(tags).toContain(t('case.read.label'));
      expect((tags.match(/class="desk-chip/g) ?? []).length).toBeLessThanOrEqual(2);
    }
    const items = markup.split('<li class="case-bubble-wrap">').slice(1);
    const demo = items.filter((item) => item.includes(t('badge.demo')));
    expect(demo).toHaveLength(1);
    expect(demo[0].split(t('badge.demo')).length - 1).toBe(1);
    // 흰 바탕 실선 (점선 시연용 말풍선 모양은 없다)
    const css = read('src/app/cases/view/case.css');
    expect(css.match(/\.case-bubble\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/border:\s*1px solid/);
    expect(css).not.toContain('.case-bubble-demo');
  });

  it('5: 선택지 카드 아래 두 줄(원인 요약 · PayPal data only)이 없다', async () => {
    const markup = await fullCase();
    const step = markup.slice(markup.indexOf('class="choice-list"'), markup.indexOf('class="case-body-reply"'));
    expect(step).not.toContain('class="case-summary"');
    expect(step).not.toContain('choice-paypal-only');
    expect(step).not.toContain('PayPal data only');
  });

  it('6: 입력칸 알약 안 Assumption 없음 · 칩 줄 "As you type · N good" + ✓ 칩 · 경고 칩 빨강 글자 · 오른쪽 Details', async () => {
    const markup = await fullCase();
    const pill = markup.slice(markup.indexOf('class="reply-editor-pill'), markup.indexOf('class="reply-tray"'));
    expect(pill).not.toContain(t('badge.assumption'));
    const tray = markup.slice(markup.indexOf('class="reply-tray-chips"'), markup.indexOf('class="reply-block reply-box"'));
    expect(tray.indexOf(t('case.reply.asYouType'))).toBeLessThan(tray.indexOf('class="reply-tray-sum'));
    expect(tray).toMatch(/class="reply-chip reply-chip-good"[^>]*><span aria-hidden="true">✓ <\/span>/);
    expect(tray.indexOf('class="reply-details-toggle"')).toBeGreaterThan(tray.lastIndexOf('class="reply-chip'));
    const css = read('src/app/cases/reply/reply.css');
    expect(css.match(/\.reply-chip-warn\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/color:\s*var\(--color-pill-high-text\)/);
  });

  it('8: 한국어 미리보기 — 바탕 #F6F7F9(--color-panel), 테두리 없음, 제목 "She’ll see (Korean)" (언어는 데이터에서)', async () => {
    const markup = await fullCase();
    const box = markup.slice(markup.indexOf('class="reply-block reply-box"'));
    expect(box).toContain(t('case.reply.sheSees', { name: 'Seo-yeon', language: t('case.view.lang.KO') }));
    expect(box).toContain('Seo-yeon will see (Korean)');
    expect(box).not.toMatch(/\b(She|He)[’']ll see/);
    expect(read('src/app/globals.css')).toMatch(/--color-panel:\s*#f6f7f9/i);
    const rule = read('src/app/cases/reply/reply.css').match(/\.reply-box\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/background:\s*var\(--color-panel\)/);
    expect(rule).toMatch(/border:\s*0/);
  });

  it('9: 맨 아래에 검사 줄이 없고 "Simulated send" 작은 글씨가 Send 왼쪽', async () => {
    const markup = await fullCase();
    const foot = markup.slice(markup.indexOf('class="reply-foot"'), markup.indexOf('class="reply-result"'));
    expect(foot).not.toContain('Facts match');
    expect(foot).not.toContain('reply-checks');
    expect(foot.indexOf(t('case.send.mode.simulated'))).toBeLessThan(foot.indexOf('Send in Korean'));
  });

  it('10: Show history 펼친 줄 — 날짜·점·사건 + 빨간 "Before DisputeLess · <표시>" (실제 기록의 표시만)', () => {
    const history = historyView(EVENTS, 25, null);
    expect(history).not.toBeNull();
    const markup = html(createElement(CaseHistoryCard, { history: history! }));
    const flagged = history!.rows.filter((row) => row.flagKeys.length > 0);
    expect(flagged.length).toBeGreaterThan(0);
    for (const row of flagged) {
      for (const key of row.flagKeys) {
        expect(markup).toContain(`<span class="desk-chip desk-chip-bad">${t('case.history.beforeTag', { flag: t(key) })}</span>`);
      }
    }
    // 사건 수 = 실제 기록 수 그대로 (없는 사건을 만들지 않는다)
    expect((markup.match(/<li class="history-row">/g) ?? []).length).toBe(EVENTS.length);
  });
});

// ───────────────────────────── 모션 ─────────────────────────────

describe('모션 (SPEC v2.15 8-4): config/motion.json = 시안 값, prefers-reduced-motion이면 끈다', () => {
  const mockup = read('docs/design/mockup-v4/Desk.dc.html');
  const motion = loadMotion();

  it('설정 값이 시안 파일의 값과 같다', () => {
    const sec = (value: string) => value.replace(/^0\./, '.').replace(/s$/, 's');
    expect(mockup).toContain(`transition:background-color ${sec(motion.desk.hover.duration)} ease`);
    expect(mockup).toContain(`transition:border-color ${sec(motion.desk.choiceCard.duration)},background-color ${sec(motion.desk.choiceCard.duration)}`);
    expect(mockup).toContain(`transition: all ${sec(motion.desk.curve.duration)} ease`);
    expect(mockup).toContain(`.ping{animation:ping ${motion.desk.ping.duration} ${motion.desk.ping.easing} infinite}`);
    expect(mockup).toContain(
      `@keyframes ping{0%{r:${motion.desk.ping.fromRadius};opacity:${sec(String(motion.desk.ping.fromOpacity))}}100%{r:${motion.desk.ping.toRadius};opacity:0}}`,
    );
    expect(mockup).toContain(`transition:width ${sec(motion.desk.reactionBar.duration)} ease`);
    expect(mockup).toContain(`transition:border-color ${sec(motion.desk.editorBorder.duration)} ease`);
  });

  it('루트 <html style>에 --motion-* 변수 (설정에서), css는 변수만 쓴다', () => {
    const vars = motionVars();
    expect(vars['--motion-hover']).toBe(`${motion.desk.hover.duration} ${motion.desk.hover.easing}`);
    expect(vars['--motion-ping-duration']).toBe(motion.desk.ping.duration);
    expect(vars['--motion-bar']).toBe(`${motion.desk.reactionBar.duration} ${motion.desk.reactionBar.easing}`);
    expect(strip(read('src/app/layout.tsx'))).toMatch(/style=\{MOTION_STYLE\}/);
    const caseCss = read('src/app/cases/view/case.css');
    const replyCss = read('src/app/cases/reply/reply.css');
    expect(caseCss.match(/\.curve-ping\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/animation:\s*motion-ping var\(--motion-ping-duration\)/);
    expect(caseCss.match(/\.curve-draft\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/transition:\s*all var\(--motion-curve\)/);
    expect(caseCss.match(/\.choice\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/var\(--motion-choice\)/);
    expect(replyCss.match(/\.reaction-seg\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/transition:\s*width var\(--motion-bar\)/);
    expect(replyCss.match(/\.reply-editor\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/transition:\s*border-color var\(--motion-editor\)/);
    // 시간 값을 css에 직접 쓰지 않는다 (T090이 손댄 규칙)
    for (const css of [caseCss, replyCss]) expect(strip(css)).not.toMatch(/transition:[^;]*\b\d*\.?\d+m?s\b/);
  });

  it('prefers-reduced-motion: 변수를 0s로(!important), 전환·애니메이션을 끈다', () => {
    const globals = read('src/app/globals.css');
    const blocks = globals.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g) ?? [];
    const block = blocks.find((b) => b.includes('--motion-')) ?? '';
    for (const name of ['--motion-hover', '--motion-choice', '--motion-curve', '--motion-ping-duration', '--motion-bar', '--motion-editor']) {
      expect(block, name).toMatch(new RegExp(`${name}:\\s*0s !important`));
    }
    expect(block).toMatch(/animation:\s*none !important/);
    expect(block).toMatch(/transition-duration:\s*0s !important/);
  });

  it('틀린 설정은 예외 (조용히 넘어가지 않는다)', () => {
    expect(() => loadMotion({ desk: { ...motion.desk, hover: { duration: 'fast', easing: 'ease' } } })).toThrow();
  });
});
