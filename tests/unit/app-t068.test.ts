/**
 * T068 단위 테스트: 서연·지호 상세를 "위에서 아래로 한 줄기"로 (T061 재배치) + 칩 보기 함수 `replyChips`.
 *
 * 기대값 출처: `tasks/T068.md` "배치"·"칩"·"완료 기준".
 * **실호출 0회** — PayPal·LLM은 모두 가짜다. `.env`를 읽지 않는다. 숫자 기대값은 적어 두지 않고 데이터·엔진과 같은지로 본다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { copyTables, t } from '@/app/_shared/copy';
import { toDollarsRounded } from '@/app/_shared/money';
import { buildCaseView, caseMessages, productShortName, type CaseViewInput } from '@/app/cases/model';
import { formatFact } from '@/ai/tokens';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, OFFER_STATUS, replyChips, type ReplyViewInput } from '@/app/cases/reply-model';
import { CaseView, headLine } from '@/app/cases/view/case-view';
import type { ActionPlan, BoardState, Cause, EscalationSignals, FactToken, LlmCaller, SeedBuyer, SeedProduct } from '@/types';

import { P, R } from '../acceptance/boards';
import { seedBuyers, seedProducts } from '../../seed/index';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputes: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }),
  loadDemoDisputesForRequest: async () => ({ disputes: [], paypal: { ok: false }, llm: { ok: false } }),
}));
(globalThis as { React?: typeof React }).React = React;

const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);

// ── 공용 입력 (서연 꼴) ────────────────────────────────────────────────

const ruleCause = (subtype: Cause['subtype'], causeNote?: string): Cause => ({
  subtype,
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
  ...(causeNote === undefined ? {} : { causeNote }),
});

const ID = 'PP-R-TEST-T068';
const CUSTOMS_EVENT = 'Customs hold – recipient customs ID missing';
const BASE: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause'> = {
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
const BEFORE: BoardState = { ...BASE, hasTracking: false, hasDeliveredTracking: false, cause: ruleCause('A1') };
const AFTER: BoardState = { ...BASE, hasTracking: true, hasDeliveredTracking: false, isDemo: true, cause: ruleCause('A2', CUSTOMS_EVENT) };
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};

const SEOYEON = seedBuyers.find((b) => b.id === 'B01') as SeedBuyer;
const SWEATER = seedProducts.find((p) => p.sku === 'FK-SW-NV') as SeedProduct;

function caseInput(overrides: Partial<CaseViewInput> = {}): CaseViewInput {
  return {
    disputeId: ID,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyer: { name: SEOYEON.name, language: SEOYEON.language },
    product: { itemName: SWEATER.itemName },
    messages: caseMessages({
      buyerMessages: ['벌써 3주째인데 아직도 안 왔어요. 연락 없으면 카드사에 이의제기할게요.'],
      buyerMessageEn: "It's been 3 weeks and it still hasn't arrived. If I don't hear back, I'll file a dispute with my card company.",
      buyerId: 'B01',
      inquiries: [],
      includeInquiries: false,
    }),
    boardReal: BEFORE,
    boardDemo: AFTER,
    carrierEvents: [{ orderId: 'O01', date: '2026-10-30', status: 'customs_hold', text: CUSTOMS_EVENT, isDemo: true }],
    signals: SIGNALS,
    signalsAfterReply: { ...SIGNALS, secondMessageUnanswered: false, unansweredOver24h: false, angryTone: null },
    demoFields: ['carrierEvents', 'hasTracking', 'cause'],
    ...overrides,
  };
}

const NOW = '2026-11-10T03:00:00Z';
const FACT_SETS = caseReplyFacts({ now: NOW, dueDate: BASE.dueDate, buyerId: null, buyerLocale: 'ko' });
const FACTS: FactToken[] = FACT_SETS.outgoing;
const DRAFT_EN =
  "Sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧.";
const OUTGOING =
  '기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요.';
const COACHING = ['Say sorry first.', 'Explain the hold.', 'Ask for the code.', 'Pass it on.', 'Give a follow-up date: ⟦DATE_1⟧.'];

function fakeLlm(...answers: unknown[]): LlmCaller {
  let n = 0;
  return async () => answers[Math.min(n++, answers.length - 1)];
}

async function prepare(): Promise<{ draft: ReplyDraft; translation: ReplyTranslation }> {
  const draft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: AFTER.cause as Cause, move: 'fight', facts: FACTS },
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
    draftFacts: FACT_SETS.draft,
    board: AFTER,
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

const VIEW = buildCaseView(caseInput(), P, R);

async function fullMarkup(over: Partial<ReplyViewInput> = {}, draftOverride?: ReplyDraft): Promise<string> {
  const { draft, translation } = await prepare();
  const reply = createElement(ReplyPanel, {
    disputeId: ID,
    base: replyBase(draftOverride ?? draft, translation, over),
    replyId: null,
    languageKey: 'case.view.lang.KO',
    buyerShort: 'Seo-yeon',
  });
  return html(createElement(CaseView, { view: VIEW, llmOk: true, reply }));
}

// ── 1. 머리글 ──────────────────────────────────────────────────────────

describe('1번: 머리글 "Case … · Wool Sweater $72 · Waiting for your reply" (데이터에서)', () => {
  it('상품 = 시드 상품 이름의 쉼표 앞, 금액 = 분쟁 금액 달러 반올림', () => {
    expect(productShortName(SWEATER.itemName)).toBe(SWEATER.itemName.split(',')[0].trim());
    expect(VIEW.header.productName).toBe(productShortName(SWEATER.itemName));
    expect(VIEW.header.amount.display).toBe(toDollarsRounded(BASE.amountCents));
    expect(headLine(VIEW.header)).toBe(
      `Case ${ID} · ${productShortName(SWEATER.itemName)} ${toDollarsRounded(BASE.amountCents)} · ${copyTables.en['case.status.WAITING_FOR_SELLER_RESPONSE']}`,
    );
    expect(headLine(VIEW.header)).not.toContain(',');
  });

  it('쉼표 없는 이름은 그대로, 앞 부분이 비면 이름 그대로', () => {
    expect(productShortName('Linen Shirt')).toBe('Linen Shirt');
    expect(productShortName(', Navy')).toBe(', Navy');
  });

  it('화면 코드(머리글·답장)에 72가 적혀 있지 않다', () => {
    const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const file of ['src/app/cases/view/case-view.tsx', 'src/app/cases/model.ts', 'src/app/cases/reply/reply-panel.tsx']) {
      expect(strip(read(file)), file).not.toMatch(/\b72\b/);
    }
  });
});

// ── 2~6. 한 열 배치 ────────────────────────────────────────────────────

describe('배치: 한 열, 위에서 아래로', () => {
  it('순서: 머리글 → 비교 카드(안에 한 줄 요약) → 대화 → 칩 → 답장 두 칸 → 검사 줄 + 보내기', async () => {
    const markup = await fullMarkup();
    const at = (needle: string) => {
      const index = markup.indexOf(needle);
      expect(index, needle).toBeGreaterThanOrEqual(0);
      return index;
    };
    const order = [
      at('class="case-head"'),
      at('class="card cc-card"'),
      at('class="case-summary"'),
      at('id="case-conversation"'),
      at('class="reply-chips"'),
      at('class="reply-pair"'),
      at('class="reply-foot"'),
      at('Send in Korean'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('한 줄 요약은 비교 카드 **안** (카드 맨 아래), 따로 있던 회색 요약 상자(section)는 없다', async () => {
    const markup = await fullMarkup();
    const card = markup.slice(markup.indexOf('class="card cc-card"'), markup.indexOf('id="case-conversation"'));
    expect(card).toContain('class="label cc-footer"><div class="case-summary"');
    expect(card).toContain(copyTables.en['case.view.summary.A1_A2'].replace(/'/g, '&#x27;'));
    expect(card).toContain(copyTables.en['badge.codeDecides']);
    expect(card).toMatch(/class="case-summary-codes num">A1 → A2</);
    expect(markup).not.toContain('<section class="case-summary"');

    const css = read('src/app/cases/view/case.css');
    const box = css.match(/\.case-summary\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(box).not.toMatch(/background|border/);
  });

  it('비교 카드는 상세에서 가로 전체 폭 (fit-content 해제), 대화 → 답장은 늘 한 열', () => {
    const css = read('src/app/cases/view/case.css');
    expect(css.match(/\.case-hero \.cc-card\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/width:\s*auto/);
    expect(css.match(/\.case-body\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    expect(css).not.toMatch(/@container/);
  });

  it('말풍선은 내용 폭만큼 (왼쪽 정렬, 최대 폭만 둔다)', () => {
    const bubble = read('src/app/cases/view/case.css').match(/\.case-bubble\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bubble).toMatch(/align-self:\s*flex-start/);
    expect(bubble).toMatch(/max-width:/);
  });

  it('답장 두 칸 나란히: 왼쪽 "You write (English)", 오른쪽 "Seo-yeon reads (Korean)", 둘 다 AI suggests', async () => {
    const markup = await fullMarkup();
    const pair = markup.slice(markup.indexOf('class="reply-pair"'), markup.indexOf('class="reply-foot"'));
    const boxes = pair.split('class="reply-block reply-box"').slice(1);
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toContain('You write (English)');
    expect(boxes[0]).toContain('lang="en"');
    expect(boxes[1]).toContain('Seo-yeon reads (Korean)');
    expect(boxes[1]).toContain('lang="ko"');
    for (const box of boxes) expect(box).toContain(copyTables.en['badge.aiSuggests']);
    // 대명사 없음 (성별 데이터가 없다)
    expect(markup).not.toMatch(/\b(She|He) reads\b/);

    const css = read('src/app/cases/reply/reply.css');
    expect(css.match(/\.reply-pair\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  });

  it('두 칸 글자 크기 같다: 한 규칙이 같은 변수(본문 크기)를 쓴다', () => {
    const css = read('src/app/cases/reply/reply.css');
    expect(css).toMatch(/--reply-text-size:\s*var\(--text-md\)/);
    const rule = css.match(/\.reply-english,\s*\.reply-outgoing\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/font-size:\s*var\(--reply-text-size\)/);
    // 다른 곳에서 두 칸 중 하나만 크기를 바꾸지 않는다
    const rest = css.replace(/\.reply-english,\s*\.reply-outgoing\s*\{[^}]*\}/, '');
    expect(rest).not.toMatch(/\.reply-(english|outgoing)[^{]*\{[^}]*font-size/);
  });

  it('역번역은 두 칸 아래 "Back-translation ▸" 접기, 코칭 접기는 없다', async () => {
    const markup = await fullMarkup();
    const foot = markup.indexOf('class="reply-foot"');
    const back = markup.indexOf('<summary class="reply-fold-summary"><span>Back-translation');
    expect(back).toBeGreaterThan(markup.indexOf('class="reply-pair"'));
    expect(back).toBeLessThan(foot);
    expect(markup).not.toContain('coaching tips');
  });

  it('맨 아래 한 줄: 왼쪽 검사 3개(✓) + More checks, 오른쪽 전송 모드 작은 글씨 + [Send in Korean]', async () => {
    const markup = await fullMarkup();
    const foot = markup.slice(markup.indexOf('class="reply-foot"'), markup.indexOf('class="reply-result"'));
    const checks = foot.slice(0, foot.indexOf('class="reply-actions"'));
    const inline = checks.slice(checks.indexOf('class="reply-inline'), checks.indexOf('</ul>'));
    expect((inline.match(/class="reply-check/g) ?? []).length).toBe(3);
    expect(inline).toContain('Facts match');
    expect(inline).toContain('No new promises');
    expect(inline).toContain('11월 17일');
    expect(checks).toContain('More checks');
    expect(checks).toContain(copyTables.en['badge.codeDecides']);

    const actions = foot.slice(foot.indexOf('class="reply-actions"'));
    expect(actions).toContain(`class="reply-mode">${t('case.send.mode.simulated')}`);
    expect(actions.indexOf(t('case.send.mode.simulated'))).toBeLessThan(actions.indexOf('Send in Korean'));
    expect(actions).toMatch(/<button type="button" class="reply-button"[^>]*>Send in Korean</);
  });

  it('켜짐이면 버튼 옆 글자가 "Live · PayPal sandbox"', async () => {
    const markup = await fullMarkup({ mode: 'live', liveAllowed: true });
    const actions = markup.slice(markup.indexOf('class="reply-actions"'));
    expect(actions).toContain(`class="reply-mode reply-mode-live">${t('case.send.mode.live')}`);
  });

  it('실패한 검사는 More checks에 접혀 있어도 맨 아래 줄에 보인다 (지금 규칙 그대로)', async () => {
    const { draft, translation } = await prepare();
    if (!translation.ok) throw new Error('translation failed');
    const failing: ReplyTranslation = { ...translation, check: { ...translation.check, ok: false, literalFacts: ['11월 17일'] }, sendable: false };
    const markup = html(
      createElement(ReplyPanel, { disputeId: ID, base: replyBase(draft, failing), replyId: 'r-0', languageKey: 'case.view.lang.KO' }),
    );
    const inline = markup.slice(markup.indexOf('class="reply-inline'), markup.indexOf('More checks'));
    expect(inline).toMatch(/class="reply-check reply-check-failed"[\s\S]*?No dates or amounts typed in directly/);
  });

  it('출처 배지 4종(Assumption · Demo data · AI suggests · Code decides)이 모두 남아 있다', async () => {
    const markup = await fullMarkup();
    for (const key of ['badge.assumption', 'badge.demo', 'badge.aiSuggests', 'badge.codeDecides']) {
      expect(markup, key).toContain(copyTables.en[key]);
    }
    const card = markup.slice(markup.indexOf('class="card cc-card"'), markup.indexOf('class="label cc-footer"'));
    expect(card).toContain(copyTables.en['badge.assumption']);
    expect(card).toContain(copyTables.en['badge.demo']);
  });
});

// ── 칩 ────────────────────────────────────────────────────────────────

describe('칩: replyChips(draft)', () => {
  it('`chips`가 있으면 그것 (T069 칩)', async () => {
    const { draft } = await prepare();
    if (!draft.ok) throw new Error('draft failed');
    const withChips = { ...draft, chips: ['Apology', 'Customs hold', 'Follow-up: ⟦DATE_1⟧'] } as ReplyDraft;
    expect(replyChips(withChips)).toEqual(['Apology', 'Customs hold', 'Follow-up: ⟦DATE_1⟧']);
  });

  it('`chips`가 없으면 코칭 줄을 그대로 (줄이지 않는다)', async () => {
    const { draft } = await prepare();
    if (!draft.ok) throw new Error('draft failed');
    expect(replyChips(draft)).toEqual(draft.coaching);
  });

  it('초안이 없으면 빈 배열', () => {
    expect(replyChips({ ok: false, reason: 'ai_unavailable', detail: 'test' } as ReplyDraft)).toEqual([]);
  });

  it('칩 글자의 토큰은 실제 값으로 채워 보인다 ("Follow-up: Nov 17")', async () => {
    const { draft, translation } = await prepare();
    if (!draft.ok) throw new Error('draft failed');
    const withChips = { ...draft, chips: ['Apology', 'Follow-up: ⟦DATE_1⟧'] } as ReplyDraft;
    const view = buildReplyView({ ...replyBase(withChips, translation), confirmed: [], sendState: 'idle', outcome: null });
    const date = FACT_SETS.draft.find((fact) => fact.kind === 'DATE');
    expect(date).toBeDefined();
    expect(view.chips[1]).toBe(`Follow-up: ${formatFact('DATE', date!.value, 'en')}`);
    expect(view.chips[1]).toMatch(/^Follow-up: Nov(ember)? 17$/);
    expect(view.chips.join(' ')).not.toMatch(/⟦|⟧/);

    const markup = await fullMarkup({}, withChips);
    const row = markup.slice(markup.indexOf('class="reply-chips"'), markup.indexOf('class="reply-pair"'));
    expect(row).toContain('Suggested reply covers:');
    expect(row).toContain(`<li class="reply-chip">${view.chips[1]}</li>`);
    expect(row).toContain(copyTables.en['badge.aiSuggests']);
  });

  it('코칭 줄 대체에서도 토큰은 채운다', async () => {
    const { draft, translation } = await prepare();
    const view = buildReplyView({ ...replyBase(draft, translation), confirmed: [], sendState: 'idle', outcome: null });
    expect(view.chips.length).toBeGreaterThan(0);
    expect(view.chips.join(' ')).not.toMatch(/⟦|⟧/);
  });

  it('빈 배열이면 칩 줄을 숨긴다', async () => {
    const { draft } = await prepare();
    if (!draft.ok) throw new Error('draft failed');
    const markup = await fullMarkup({}, { ...draft, chips: [] } as ReplyDraft);
    expect(markup).not.toContain('class="reply-chips"');
    expect(markup).not.toContain('Suggested reply covers:');
  });

  it('화면 코드에 칩 글자를 지어내지 않는다 (시안 칩 글자가 코드에 없다)', () => {
    const files = ['src/app/cases/reply-model.ts', 'src/app/cases/reply/reply-panel.tsx'].map(read).join('\n');
    for (const word of ['Apology', 'Customs hold', 'Ask for code', 'Fallback', 'full refund']) {
      expect(files).not.toContain(`'${word}`);
    }
  });

  it('문구 키 case.reply.covers가 두 문구 파일에 있다', () => {
    expect(copyTables.en['case.reply.covers']).toBe('Suggested reply covers:');
    expect(typeof copyTables.ko['case.reply.covers']).toBe('string');
  });
});

// ── 지호 꼴 (제안이 먼저) ────────────────────────────────────────────────

describe('지호 꼴: 같은 틀, 주 버튼 "Send offer · $N" + 메시지 버튼 꺼짐 안내', () => {
  it('맨 아래 줄 오른쪽에 제안 버튼(강조) → 메시지 버튼(조용), 꺼짐 이유 글자 그대로', async () => {
    const { draft, translation } = await prepare();
    const plan: ActionPlan = {
      planId: 'p-test',
      disputeId: ID,
      move: 'offer',
      apiMove: 'make_offer',
      amountCents: 700,
      currency: 'USD',
      refundType: 'REFUND',
      messageRequired: false,
      requiresApproval: true,
    };
    const markup = html(
      createElement(ReplyPanel, {
        disputeId: ID,
        base: replyBase(draft, translation, { plan, offerFirst: true, statusCode: OFFER_STATUS }),
        replyId: 'r-1',
        languageKey: 'case.view.lang.KO',
      }),
    );
    const actions = markup.slice(markup.indexOf('class="reply-actions"'));
    const offer = actions.indexOf(t('case.send.offerButton', { amount: toDollarsRounded(700) }));
    const message = actions.indexOf('Send in Korean');
    expect(offer).toBeGreaterThan(0);
    expect(message).toBeGreaterThan(offer);
    expect(actions).toMatch(/class="reply-button-quiet" disabled=""/);
    expect(actions).toContain(t('case.view.offerFirst'));
  });
});
