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
import { shortDate } from '@/app/_shared/short-date';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, OFFER_STATUS, replyChips, type ReplyViewInput } from '@/app/cases/reply-model';
import { CaseView, headLine } from '@/app/cases/view/case-view';
import { buildCaseDesk } from '@/app/cases/desk-model';
import { toDollarsCents } from '@/app/_shared/money';
import { toPercentRounded } from '@/app/_shared/percent';
import { recommend } from '@/engine/recommend';
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
// T076: 시안 v4 칸 (선택지 카드 = 엔진 recommend, 예측 어댑터 없음 = null)
const DESK = buildCaseDesk({
  view: VIEW,
  board: AFTER,
  buyer: SEOYEON,
  productName: SWEATER.itemName,
  openDays: 5,
  recommendation: recommend(AFTER, P, R),
  moveForecasts: null,
  history: null,
  curvePoints: null,
  band: VIEW.risk?.band ?? null,
});

async function fullMarkup(over: Partial<ReplyViewInput> = {}, draftOverride?: ReplyDraft): Promise<string> {
  const { draft, translation } = await prepare();
  const reply = createElement(ReplyPanel, {
    disputeId: ID,
    base: replyBase(draftOverride ?? draft, translation, over),
    replyId: null,
    languageKey: 'case.view.lang.KO',
    buyerShort: 'Seo-yeon',
    // T090: "PayPal data only" 줄은 Details 첫 줄 (case-detail.tsx가 desk.paypalOnly를 넘긴다)
    paypalOnly: DESK.paypalOnly,
    // 예측 어댑터가 쓸 수 없을 때의 칩(AI 칩 "Suggested reply covers")을 본다. 엔진 칩은 app-t079 시험
    forecaster: () => null,
    detector: () => null,
  });
  return html(createElement(CaseView, { view: VIEW, desk: DESK, llmOk: true, reply }));
}

/** Details ⌄ 안 (T090). 첫 `</ul>`까지가 검사 줄이다. */
function detailsOf(markup: string): string {
  const start = markup.indexOf('class="reply-details"');
  return start < 0 ? '' : markup.slice(start, markup.indexOf('</ul>', start) + '</ul>'.length);
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
  it('T076 순서: 머리글 → 구매자 메시지 → Respond now(1 선택지 카드 → 2 입력칸·칩 → 전송본) → 검사 줄 + 보내기', async () => {
    const { draft } = await prepare();
    if (!draft.ok) throw new Error('draft failed');
    const markup = await fullMarkup({}, { ...draft, chips: ['Apology', 'Follow-up: ⟦DATE_1⟧'] } as ReplyDraft);
    const at = (needle: string) => {
      const index = markup.indexOf(needle);
      expect(index, needle).toBeGreaterThanOrEqual(0);
      return index;
    };
    const order = [
      at('class="case-head"'),
      at('id="case-conversation"'),
      at('id="work-title"'),
      at('class="choice-list"'),
      at('class="reply-textarea"'),
      // T122a 시안 v6 L366–L368: 번역 칸은 입력칸 아래(editor 안), 점검 tray는 그 오른쪽
      at('class="reply-block reply-box reply-box-in"'),
      at('class="reply-tray-chips"'),
      at('class="reply-foot"'),
      at('>Send</button>'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // 예측 어댑터가 없으면(null) 위험 곡선 카드는 그리지 않는다. 비교 카드는 선택지 카드로 바뀌었다
    expect(markup).not.toContain('class="curve-card"');
    expect(markup).not.toContain('class="card cc-card"');
  });

  it('T090: "PayPal data only" 한 줄 = 배송사 기록 전 보드의 엔진 값, 선택지 카드 아래가 아니라 Details 첫 줄', async () => {
    const markup = await fullMarkup();
    expect(markup).not.toContain('class="choice-paypal-only');
    const before = recommend(BEFORE, P, R).best;
    expect(before?.move).toBe('refund');
    const details = detailsOf(markup);
    const line = t('case.choice.paypalOnly', {
      action: t('case.view.action.refund'),
      amount: toDollarsRounded(before?.expectedLossCents as number),
    });
    expect(details).toContain(line);
    // 첫 줄 → 역번역 → 검사 순서
    expect(details.indexOf(line)).toBeLessThan(details.indexOf('Back-translation to English'));
    expect(details.indexOf('Back-translation to English')).toBeLessThan(details.indexOf('Facts match'));
  });

  it('대화 → 답장은 늘 한 열 (컨테이너 질의가 .case-body를 두 칸으로 바꾸지 않는다)', () => {
    const css = read('src/app/cases/view/case.css');
    expect(css.match(/\.case-body\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/grid-template-columns:\s*minmax\(0, 1fr\);/);
    for (const block of css.match(/@container[^{]*\{[\s\S]*?\n\}/g) ?? []) expect(block).not.toMatch(/\.case-body/);
  });

  it('말풍선은 내용 폭만큼 (왼쪽 정렬, 최대 폭만 둔다)', () => {
    const bubble = read('src/app/cases/view/case.css').match(/\.case-bubble\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bubble).toMatch(/align-self:\s*flex-start/);
    expect(bubble).toMatch(/max-width:/);
  });

  it('T122a 두 칸 나란히(시안 v6): 왼쪽 editor = 입력칸 + 아래 "Translation (Korean)" 검사받은 전송본, 오른쪽 점검 tray', async () => {
    const markup = await fullMarkup();
    const pair = markup.slice(markup.indexOf('class="reply-pair"'), markup.indexOf('class="reply-foot"'));
    const editor = pair.slice(0, pair.indexOf('class="reply-block reply-box reply-box-in"'));
    expect(editor).toMatch(/<textarea[^>]*class="reply-textarea"[^>]*lang="en"/);
    const outgoing = pair.slice(pair.indexOf('class="reply-block reply-box reply-box-in"'), pair.indexOf('class="reply-tray"'));
    // 제목은 시안 v6 문구 그대로, 언어 이름만 데이터(구매자 언어)에서
    expect(outgoing).toContain(t('case.reply.translationTitle', { language: t('case.view.lang.KO') }));
    expect(outgoing).toContain('Translation (Korean)');
    expect(outgoing).toContain('lang="ko"');
    // 출처 표시: "Use AI draft" 단추의 AI 알약 (미리보기 칸에는 배지를 두지 않는다 — 시안)
    expect(markup).toContain('class="ai-pill ai-pill-small"');
    const box = read('src/app/cases/reply/reply.css').match(/\.reply-box\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(box).toMatch(/background:\s*var\(--color-panel\)/);
    expect(box).toMatch(/border:\s*0/);

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

  it('T090: 역번역은 칩 줄 오른쪽 "Details ⌄" 안 (두 칸 안, 맨 아래 줄 위), 코칭 접기는 없다', async () => {
    const markup = await fullMarkup();
    const foot = markup.indexOf('class="reply-foot"');
    const toggle = markup.indexOf('class="reply-details-toggle"');
    const back = markup.indexOf('Back-translation to English');
    expect(toggle).toBeGreaterThan(markup.indexOf('class="reply-tray-chips"'));
    expect(back).toBeGreaterThan(toggle);
    expect(back).toBeLessThan(foot);
    expect(markup).not.toMatch(/<summary class="reply-fold-summary"><span>Back-translation/);
    expect(markup).not.toContain('coaching tips');
  });

  it('T090 맨 아래 한 줄: 검사 줄 없음(Details 안 3개), 전송 모드 작은 글씨가 [Send] 왼쪽 (T122a 시안 v6 "Send")', async () => {
    const markup = await fullMarkup();
    const foot = markup.slice(markup.indexOf('class="reply-foot"'), markup.indexOf('class="reply-result"'));
    expect(foot).not.toContain('Facts match');
    expect(foot).not.toContain('More checks');
    expect(foot).not.toContain(copyTables.en['badge.codeDecides']);
    const details = detailsOf(markup);
    expect((details.match(/class="reply-check/g) ?? []).length).toBe(3);
    expect(details).toContain('Facts match');
    expect(details).toContain('No new promises');
    expect(details).toContain('11월 17일');
    // 통과면 접혀 있다
    expect(details).toMatch(/^class="reply-details"[^>]*hidden/);
    expect(markup).toMatch(/class="reply-details-toggle" aria-expanded="false"/);

    const actions = foot.slice(foot.indexOf('class="reply-actions"'));
    expect(actions).toContain(`class="reply-mode">${t('case.send.mode.simulated')}`);
    expect(actions.indexOf(t('case.send.mode.simulated'))).toBeLessThan(actions.indexOf('>Send</button>'));
    expect(actions).toMatch(/<button type="button" class="reply-button"[^>]*>Send</);
  });

  it('켜짐이면 버튼 옆 글자가 "Live · PayPal sandbox"', async () => {
    const markup = await fullMarkup({ mode: 'live', liveAllowed: true });
    const actions = markup.slice(markup.indexOf('class="reply-actions"'));
    expect(actions).toContain(`class="reply-mode reply-mode-live">${t('case.send.mode.live')}`);
  });

  it('T090 안전장치: 실패한 검사(보조 검사여도)는 Details가 자동으로 펼쳐져 보이고 [Send]는 꺼진다', async () => {
    const { draft, translation } = await prepare();
    if (!translation.ok) throw new Error('translation failed');
    const failing: ReplyTranslation = { ...translation, check: { ...translation.check, ok: false, literalFacts: ['11월 17일'] }, sendable: false };
    const markup = html(
      createElement(ReplyPanel, { disputeId: ID, base: replyBase(draft, failing), replyId: 'r-0', languageKey: 'case.view.lang.KO' }),
    );
    const details = detailsOf(markup);
    expect(details).not.toMatch(/^class="reply-details"[^>]*hidden/);
    expect(markup).toMatch(/class="reply-details-toggle" aria-expanded="true"/);
    expect(details).toMatch(/class="reply-check reply-check-failed"[\s\S]*?No dates or amounts typed in directly/);
    expect(markup).toMatch(/<button[^>]*class="reply-button"[^>]*disabled/);
  });

  it('T090 출처 표시 3종: Assumption · Demo data · AI 알약은 있고, Code decides·AI suggests 점선 배지는 없다', async () => {
    const markup = await fullMarkup();
    expect(markup).toContain(copyTables.en['badge.assumption']);
    // (Demo data는 이 꼴(시연용 문의 없음)에서는 "PayPal data only" 줄에만 있었다 — 그 줄의 배지는 T090에서 뺐다.
    //  시연용 말풍선·사건 줄의 Demo data는 app-t090 시험이 본다)
    expect(markup).toContain('class="ai-pill"');
    expect(markup).not.toContain('Code decides');
    expect(markup).not.toContain('AI suggests');
    expect(markup).not.toContain('badge-border-dashed');
    expect(markup).not.toContain('badge-border-solid');
    // 기대 손실(선택지 카드)에 Assumption
    const step = markup.slice(markup.indexOf('class="desk-step"'), markup.indexOf('class="case-body-reply"'));
    expect(step).toContain(copyTables.en['badge.assumption']);
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

  it('`chips`가 없거나 빈 배열이면 코칭 줄을 그대로 (줄이지 않는다)', async () => {
    const { draft } = await prepare();
    if (!draft.ok) throw new Error('draft failed');
    expect(replyChips(draft)).toEqual(draft.coaching);
    expect(replyChips({ ...draft, chips: [] } as ReplyDraft)).toEqual(draft.coaching);
    const noField = { ...draft } as Record<string, unknown>;
    delete noField.chips;
    expect(replyChips(noField as ReplyDraft)).toEqual(draft.coaching);
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
    // 재시도 4번: 칩 안의 날짜는 짧은 달 이름. 같은 날짜 값의 표시만 바뀐다
    expect(view.chips[1]).toBe(`Follow-up: ${shortDate(date!.value)}`);
    expect(view.chips[1]).toBe('Follow-up: Nov 17');
    expect(view.chips.join(' ')).not.toMatch(/⟦|⟧/);
    // 보내는 글·검사 줄의 날짜 꼴은 그대로 (영어 초안은 formatFact 그대로 "November 17")
    expect(view.draftEn?.text).toContain(formatFact('DATE', date!.value, 'en'));
    expect(formatFact('DATE', date!.value, 'en')).toBe('November 17');

    const markup = await fullMarkup({}, withChips);
    // T076: 칩은 입력칸 아래 받침 (특징 판정 어댑터가 null일 때 지금 칩 그대로)
    const row = markup.slice(markup.indexOf('class="reply-tray-chips"'), markup.indexOf('class="reply-block reply-box"'));
    expect(row).toContain('Suggested reply covers:');
    expect(row).toContain(`<li class="reply-chip">${view.chips[1]}</li>`);
    // T090: 칩 줄 오른쪽 끝은 "Details ⌄" (출처 배지 없음)
    expect(row).toContain('class="reply-details-toggle"');
  });

  it('코칭 줄 대체에서도 토큰은 채운다', async () => {
    const { draft, translation } = await prepare();
    const view = buildReplyView({ ...replyBase(draft, translation), confirmed: [], sendState: 'idle', outcome: null });
    expect(view.chips.length).toBeGreaterThan(0);
    expect(view.chips.join(' ')).not.toMatch(/⟦|⟧/);
  });

  it('빈 chips면 코칭 줄이 칩으로 보인다', async () => {
    const { draft } = await prepare();
    if (!draft.ok) throw new Error('draft failed');
    const markup = await fullMarkup({}, { ...draft, chips: [] } as ReplyDraft);
    expect(markup).toContain('class="reply-tray-chips"');
    expect(markup).toContain('Suggested reply covers:');
  });

  it('칩도 코칭 줄도 없으면(초안 실패) 칩 줄을 숨긴다', async () => {
    const markup = await fullMarkup({}, { ok: false, reason: 'ai_unavailable', detail: 'test' } as ReplyDraft);
    expect(markup).not.toContain('class="reply-tray-chips"');
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

describe('지호 꼴 (T076 시안 v4 짧은 카드): "Offer N% back ($X), the buyer keeps it" + [Send offer · $N]', () => {
  it('제안 카드: 제목의 금액 = 엔진 계획 금액, 비율 = 엔진 가정값, 버튼 하나(관문 그대로), 메시지 버튼 없음', async () => {
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
        offerRate: P.offerRate,
      }),
    );
    expect(markup).toContain('class="reply offer-card"');
    expect(markup).toContain(
      t('case.offer.title.keep', { percent: toPercentRounded(P.offerRate), amount: toDollarsCents(700) }).replace(/\$/g, '$'),
    );
    const actions = markup.slice(markup.indexOf('class="reply-actions"'));
    expect(actions).toMatch(
      new RegExp(`<button type="button" class="reply-button"[^>]*>${t('case.send.offerButton', { amount: toDollarsRounded(700) }).replace(/[$·]/g, '.')}</button>`),
    );
    // 메시지만 보내는 버튼은 없다 (제안이 먼저인 건에서 늘 꺼져 있던 버튼 — 관문 판정은 그대로)
    expect(actions).not.toContain('>Send</button>');
    expect((actions.match(/<button/g) ?? []).length).toBe(1);
    const css = read('src/app/cases/reply/reply.css');
    expect(css.match(/\.reply-send\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/flex-direction:\s*column/);
    expect(css.match(/\.reply-foot\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/flex-wrap:\s*nowrap/);
  });
});

// ── 재시도 (컨트롤 타워 2026-11-10 실제 스크린샷) ─────────────────────────────

const JIHO_EN = 'The color is completely different from the photo. I want a partial refund.';

function jihoMessages(english: string | null) {
  return caseMessages({
    buyerMessages: [JIHO_EN],
    buyerMessageEn: english,
    buyerId: 'B02',
    inquiries: [],
    includeInquiries: false,
  });
}

describe('재시도 2번: 원문이 영어면 번역 줄 없음 (영어가 두 번 나오지 않는다)', () => {
  const KO = { name: 'Buyer KO', language: 'KO' as const };

  it('KO 구매자인데 원문이 영어(한글 없음) → english null, 번역 배지 없음, originalIsEnglish', () => {
    // AI 번역 글이 원문과 조금 달라도 원문이 영어면 숨긴다
    const view = buildCaseView(caseInput({ buyer: KO, messages: jihoMessages('The colour is totally different from the photo. Partial refund please.') }), P, R);
    const message = view.messages[0];
    expect(message.originalIsEnglish).toBe(true);
    expect(message.english).toBeNull();
    expect(message.englishBadges).toEqual([]);
  });

  it('번역이 원문과 같으면 숨긴다 (라틴 문자권 언어도)', () => {
    const DE = { name: 'Buyer DE', language: 'DE' as const };
    const view = buildCaseView(caseInput({ buyer: DE, messages: jihoMessages(JIHO_EN.toUpperCase()) }), P, R);
    expect(view.messages[0].english).toBeNull();
    expect(view.messages[0].originalIsEnglish).toBe(true);
  });

  it('독일어 원문 + 다른 번역이면 그대로 둔다', () => {
    const DE = { name: 'Buyer DE', language: 'DE' as const };
    const messages = caseMessages({
      buyerMessages: ['Die Farbe ist anders als auf dem Foto.'],
      buyerMessageEn: 'The color is different from the photo.',
      buyerId: 'B05',
      inquiries: [],
      includeInquiries: false,
    });
    const view = buildCaseView(caseInput({ buyer: DE, messages }), P, R);
    expect(view.messages[0].originalIsEnglish).toBe(false);
    expect(view.messages[0].english).not.toBeNull();
  });

  it('그림: 원문만 한 번, "English translation unavailable"·AI suggests 없음, 꼬리 줄은 남는다', () => {
    const view = buildCaseView(caseInput({ buyer: KO, messages: jihoMessages(JIHO_EN), signals: null }), P, R);
    const markup = html(createElement(CaseView, { view, llmOk: true }));
    const thread = markup.slice(markup.indexOf('class="case-thread"'), markup.indexOf('</ol>'));
    expect(thread.split(JIHO_EN).length - 1).toBe(1);
    expect(thread).toContain('<p class="case-bubble-original" lang="en">');
    expect(thread).not.toContain(copyTables.en['case.view.englishUnavailable']);
    expect(thread).not.toContain(copyTables.en['case.view.translated']);
    expect(thread).not.toContain('class="ai-pill"');
    // T090: 꼬리 줄은 날짜만 (시안 "Translated · 영어 · 날짜"의 날짜. "From PayPal" 글자는 뺐다 — 실제 글은 Demo data가 없다)
    expect(thread).toContain(copyTables.en['case.view.dateUnknown']);
    expect(thread).not.toContain(copyTables.en['badge.demo']);
  });

  it('서연(한국어 원문)은 그대로: 원문 + 영어 번역 + AI suggests', () => {
    const message = VIEW.messages[0];
    expect(message.originalIsEnglish).toBe(false);
    expect(message.english).not.toBeNull();
    expect(message.englishBadges).toEqual(['aiSuggests']);
  });
});

describe('재시도 1번: 1920×1080 한 화면 (세로 자리 줄이기)', () => {
  it('T090: "Buyer messages" 제목 줄(시안 v4) + 말풍선 아래 한 줄 "Translated · 영어 · 날짜"', async () => {
    const markup = await fullMarkup();
    expect(markup).toMatch(/<h2 class="desk-card-title" id="case-conversation"><b>Buyer messages<\/b><\/h2>/);
    const start = markup.indexOf('class="case-bubble"');
    const bubble = markup.slice(start, markup.indexOf('</li>', start));
    const sub = bubble.slice(bubble.indexOf('class="case-bubble-sub"'));
    // T122a 시안 v6 L314: "Translated"는 굵은 파랑 <b>
    expect(sub).toContain(`<b class="case-bubble-tr">${copyTables.en['case.view.translated']}</b> · <span lang="en">`);
    expect(sub.split('</p>')[0]).toMatch(/ · <span class="num">[^<]+<\/span>/);
    expect(markup).not.toContain('<p class="case-bubble-meta"');
    const css = read('src/app/cases/view/case.css');
    expect(css.match(/\.case-sr-only\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/clip-path/);
  });

  it('답장 두 칸은 내용 높이 (늘리지 않는다)', () => {
    const css = read('src/app/cases/reply/reply.css');
    expect(css.match(/\.reply-pair\s*\{([^}]*)\}/)?.[1] ?? '').toMatch(/align-items:\s*start/);
  });
});

describe('재시도 4번: 칩 날짜는 짧은 달 이름', () => {
  it('칩만 "Nov 17", 검사 줄은 "11월 17일", 영어 초안은 "November 17" 그대로', async () => {
    const { draft } = await prepare();
    if (!draft.ok) throw new Error('draft failed');
    const markup = await fullMarkup({}, { ...draft, chips: ['Apology', 'Follow-up: ⟦DATE_1⟧'] } as ReplyDraft);
    const row = markup.slice(markup.indexOf('class="reply-tray-chips"'), markup.indexOf('class="reply-block reply-box"'));
    expect(row).toContain('<li class="reply-chip">Follow-up: Nov 17</li>');
    // T076: 영어 초안은 입력칸의 처음 글
    expect(markup.slice(markup.indexOf('class="reply-textarea"'))).toContain('November 17');
    // T090: 검사 줄은 Details 안
    expect(detailsOf(markup)).toContain('11월 17일');
  });

  it('shortDate는 표시만: ISO 날짜 → "Nov 17", 날짜 꼴이 아니면 그대로', () => {
    expect(shortDate('2026-11-17')).toBe('Nov 17');
    expect(shortDate('soon')).toBe('soon');
  });
});
