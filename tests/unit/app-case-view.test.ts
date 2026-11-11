/**
 * T009 1부: S5 Case 보기용 값 (`buildCaseView`) · 비교 카드 · 화면 그리기 · 404 판정.
 *
 * 기대값 출처: `tests/acceptance/drafts/AC18.md` 1~5번·12번, `tasks/T009.md` 1부 완료 기준과
 * "비교 카드 다듬기" 절 (사람 결정 2026-11-10), SPEC v2.7 2·3·7·9-4·10장.
 * 가정값·규칙은 인수 테스트 고정 사본(`P`, `R`)을 쓴다. PayPal·LLM 실제 호출 없음 (DOM 도구 없이
 * `react-dom/server`로 글자만 그린다).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { classifyDispute } from '@/ai/classify';
import { copyTables, t } from '@/app/_shared/copy';
import { CompareCard } from '@/app/_shared/compare-card';
import { buildCaseDesk, type CaseDesk } from '@/app/cases/desk-model';
import type { CaseView as CaseViewData } from '@/app/cases/model';
import { toDollarsRounded } from '@/app/_shared/money';
import { actionKeyFor, buildCaseView, caseMessages, segmentsOf, type CaseViewInput } from '@/app/cases/model';
import { CaseView } from '@/app/cases/view/case-view';
import { Conversation } from '@/app/cases/view/conversation';
import { escalationRisk } from '@/engine/escalation';
import { recommend } from '@/engine/recommend';
import type { BoardState, Cause, ClassifyInput, EscalationSignals, LlmCaller, Params } from '@/types';

import { D1_JIHO, P, R } from '../acceptance/boards';

// load.ts는 서버 전용이다. 이 파일에서만 빈 모듈로 바꾸고, PayPal 읽기·LLM은 횟수를 세는 가짜로 둔다
vi.mock('server-only', () => ({}));
const loadSpy = vi.fn(async () => ({ disputes: [], paypal: { ok: true }, llm: { ok: false } }));
vi.mock('@/app/_server/disputes', () => ({ loadDemoDisputesForRequest: () => loadSpy() }));
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: false, reason: 'not_configured' }) }));

// vitest는 tsx를 고전 JSX(`React.createElement`)로 옮긴다 (tsconfig `jsx: preserve`, Next가 실제로 옮긴다).
// 설정 파일을 고치지 않고 이 시험에서만 `React`를 전역에 둔다
(globalThis as { React?: typeof React }).React = React;

const ROOT = path.resolve(__dirname, '../..');

// ── 공용 입력 (AC18 초안 "공용 입력") ─────────────────────────────────────

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
const D2_AFTER: BoardState = {
  ...D2_BASE,
  hasTracking: true,
  hasDeliveredTracking: false,
  isDemo: true,
  cause: ruleCause('A2', CUSTOMS_EVENT),
};

const SEOYEON_START: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};
const SEOYEON_AFTER_REPLY: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: false,
  unansweredOver24h: false,
  angryTone: null,
  hoursToDue: 464,
};

const REAL_TEXT = '이번 주 안에 연락 없으면 카드사에 이의제기할게요. 개인통관고유부호 P123456789012';
const DEMO_INQUIRY = { date: '2026-11-02', buyerId: 'B01', original: '배송 조회가 일주일째 그대로예요.', english: 'Tracking has not changed.' };

/** T076: 시안 v4 칸 (선택지 카드 = 엔진 recommend(board). 예측 어댑터 없음 = null). */
function deskOf(view: CaseViewData, board: BoardState): CaseDesk {
  return buildCaseDesk({
    view,
    board,
    buyer: null,
    productName: 'Wool Sweater, Navy',
    openDays: null,
    recommendation: recommend(board, P, R),
    moveForecasts: null,
    history: null,
    curvePoints: null,
    band: view.risk?.band ?? null,
  });
}

function input(overrides: Partial<CaseViewInput> = {}): CaseViewInput {
  return {
    disputeId: 'PP-R-TEST-D2',
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyer: { name: 'Seo-yeon', language: 'KO' },
    product: { itemName: 'Sweater' },
    messages: caseMessages({
      buyerMessages: [REAL_TEXT],
      buyerMessageEn: null,
      buyerId: 'B01',
      inquiries: [DEMO_INQUIRY],
      includeInquiries: true,
    }),
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

/** 값 묶음 안의 모든 `cents` (금액을 지어 넣지 않았는지 보는 데 쓴다). */
function allCents(value: unknown, out: number[] = []): number[] {
  if (Array.isArray(value)) value.forEach((v) => allCents(v, out));
  else if (value !== null && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'cents' && typeof v === 'number') out.push(v);
      else if (key !== 'evaluation') allCents(v, out);
    }
  }
  return out;
}

// ── AC18 1번: 전 → 후 ─────────────────────────────────────────────────────

describe('AC18 1번: 전·후 칸은 같은 보드로 부른 recommend 결과다', () => {
  const view = buildCaseView(input(), P, R);
  const before = recommend(D2_BEFORE, P, R).best;
  const after = recommend(D2_AFTER, P, R).best;

  it('전: refund · 7400¢ · "$74" / 후: fight · send_message · 3680¢ · "$37"', () => {
    expect(view.compare.before.move).toBe('refund');
    expect(view.compare.before.expectedLoss).toEqual({ cents: 7400, display: '$74' });
    expect(view.compare.after?.move).toBe('fight');
    expect(view.compare.after?.apiMove).toBe('send_message');
    expect(view.compare.after?.expectedLoss).toEqual({ cents: 3680, display: '$37' });
  });

  it('센트·수·실행 API가 recommend(...).best와 같다', () => {
    expect(view.compare.before.expectedLoss?.cents).toBe(before?.expectedLossCents);
    expect(view.compare.before.move).toBe(before?.move);
    expect(view.compare.before.apiMove).toBe(before?.apiMove);
    expect(view.compare.after?.expectedLoss?.cents).toBe(after?.expectedLossCents);
    expect(view.compare.after?.move).toBe(after?.move);
    expect(view.compare.after?.apiMove).toBe(after?.apiMove);
    expect(view.compare.after?.evaluation).toEqual(after);
  });

  it('"Expected loss" 이름표 키와 Assumption 배지가 있다 (카드 머리에는 Assumption만)', () => {
    expect(view.compare.labelKey).toBe('case.view.expectedLoss');
    expect(copyTables.en[view.compare.labelKey]).toBe('Expected loss');
    expect(view.compare.badges).toEqual(['assumption']);
  });

  it('Demo data 배지는 오른쪽(배송사 정보) 칸에만 있다', () => {
    expect(view.compare.before.badges).toEqual([]);
    expect(view.compare.after?.badges).toEqual(['demo']);
  });

  it('행동 글자 키가 엔진의 best.move에서 나온다: 전 "Full refund", 후 "Reply"', () => {
    expect(view.compare.before.actionKey).toBe(actionKeyFor(before?.move ?? null));
    expect(copyTables.en[view.compare.before.actionKey]).toBe('Full refund');
    expect(copyTables.en[view.compare.after?.actionKey ?? '']).toBe('Reply');
    expect(copyTables.en[actionKeyFor('offer')]).toBe('Offer');
    expect(copyTables.en[actionKeyFor(null)]).toBe('Handle manually');
  });

  // T068: 머리글 금액은 달러 반올림 ("Wool Sweater $72"). 센트 값은 그대로
  it('머리글: 분쟁 금액은 달러 반올림 ($72), 분쟁 번호·상태·언어', () => {
    expect(view.header.amount).toEqual({ cents: 7200, display: '$72' });
    expect(view.header.disputeId).toBe('PP-R-TEST-D2');
    expect(view.header.statusCode).toBe('WAITING_FOR_SELLER_RESPONSE');
    expect(copyTables.en[view.header.languageKey ?? '']).toBe('Korean');
    expect(view.header.buyerLocale).toBe('ko');
  });
});

// ── AC18 2번: 가정값을 바꾸면 따라 바뀐다 ──────────────────────────────────

describe('AC18 2번: 숫자를 적어 두지 않았다', () => {
  const P2: Params = { ...P, feeCents: 800 };
  const view = buildCaseView(input(), P2, R);

  it('feeCents 1500 → 800이면 전·후 센트가 recommend(보드, P2, R)와 같고 1번 값과 다르다', () => {
    const before = recommend(D2_BEFORE, P2, R).best;
    const after = recommend(D2_AFTER, P2, R).best;
    expect(view.compare.before.expectedLoss?.cents).toBe(before?.expectedLossCents);
    expect(view.compare.after?.expectedLoss?.cents).toBe(after?.expectedLossCents);
    expect(view.compare.after?.expectedLoss?.cents).not.toBe(3680);
    expect(view.compare.before.expectedLoss?.display).toBe(toDollarsRounded(before?.expectedLossCents as number));
    expect(view.compare.after?.expectedLoss?.display).toBe(toDollarsRounded(after?.expectedLossCents as number));
  });

  it('값 묶음의 모든 금액 센트가 recommend(...).all[].expectedLossCents 또는 board.amountCents다', () => {
    const allowed = new Set<number>([
      D2_BASE.amountCents,
      ...recommend(D2_BEFORE, P2, R).all.map((e) => e.expectedLossCents ?? -1),
      ...recommend(D2_AFTER, P2, R).all.map((e) => e.expectedLossCents ?? -1),
    ]);
    const cents = allCents(view);
    expect(cents.length).toBeGreaterThanOrEqual(3);
    for (const value of cents) expect(allowed.has(value), String(value)).toBe(true);
  });
});

// ── AC18 3번: 원인은 규칙이 정한다 ─────────────────────────────────────────

describe('AC18 3번: 원인은 규칙(코드)이 정한다', () => {
  it('추적 없음 → A1, 통관 보류 이벤트 → A2. 둘 다 rule, LLM 0회, 배지 code', async () => {
    let llmCalls = 0;
    const llm: LlmCaller = async () => {
      llmCalls += 1;
      throw new Error('LLM은 불리면 안 된다');
    };
    const base: ClassifyInput = {
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      buyerMessages: ['아직 안 왔어요'],
      trackingEvents: [],
      hasTracking: false,
      hasDeliveredTracking: false,
      buyerPriorInrDisputes: 0,
    };
    const a = await classifyDispute(base, { llm }, R);
    const b = await classifyDispute(
      { ...base, hasTracking: true, trackingEvents: ['Shipped', 'Customs hold – recipient customs ID (PCCC) missing'] },
      { llm },
      R,
    );
    expect(a.subtype).toBe('A1');
    expect(b.subtype).toBe('A2');
    expect(llmCalls).toBe(0);

    const view = buildCaseView(input({ boardReal: { ...D2_BEFORE, cause: a }, boardDemo: { ...D2_AFTER, cause: b } }), P, R);
    expect(view.cause.before?.subtype).toBe('A1');
    expect(view.cause.after?.subtype).toBe('A2');
    for (const cause of [view.cause.before, view.cause.after]) {
      expect(cause?.decidedBy).toBe('code');
      expect(cause?.badge).toBe('codeDecides');
    }
    expect(view.cause.after?.note).toMatch(/Customs hold/);
  });

  it('LLM이 정한 원인이면 code가 아니다 (AI가 정한 것을 코드로 보이게 하지 않는다)', () => {
    const llmCause: Cause = { subtype: 'A2', confidence: 0.8, evidence: [], needsReview: false, source: 'llm' };
    const view = buildCaseView(input({ boardDemo: { ...D2_AFTER, cause: llmCause } }), P, R);
    expect(view.cause.after?.decidedBy).toBe('ai');
    expect(view.cause.after?.badge).toBe('aiSuggests');
  });
});

// ── AC18 4번: 확대 위험 ───────────────────────────────────────────────────

describe('AC18 4번: 확대 위험은 escalationRisk 결과다', () => {
  const view = buildCaseView(input(), P, R);

  it('지금 6 High (3·2·1·0), 답장 후 3 Watch', () => {
    expect(view.risk?.score).toBe(6);
    expect(view.risk?.band).toBe('High');
    expect(view.risk?.parts.map((p) => p.points)).toEqual([3, 2, 1, 0]);
    expect(view.riskAfterReply?.score).toBe(3);
    expect(view.riskAfterReply?.band).toBe('Watch');
  });

  it('score·band·parts가 escalationRisk(신호, R)와 같다', () => {
    for (const [risk, signals] of [
      [view.risk, SEOYEON_START],
      [view.riskAfterReply, SEOYEON_AFTER_REPLY],
    ] as const) {
      const engine = escalationRisk(signals, R);
      expect(risk?.score).toBe(engine.score);
      expect(risk?.band).toBe(engine.band);
      expect(risk?.parts.map(({ signal, points }) => ({ signal, points }))).toEqual(engine.parts);
    }
  });

  it('어조 판정이 없으면 5로 나온다 (6을 지어내지 않는다)', () => {
    const v = buildCaseView(input({ signals: { ...SEOYEON_START, angryTone: null } }), P, R);
    expect(v.risk?.score).toBe(escalationRisk({ ...SEOYEON_START, angryTone: null }, R).score);
    expect(v.risk?.score).toBe(5);
  });
});

// ── AC18 5번: 없는 것을 지어내지 않는다 ───────────────────────────────────

describe('AC18 5번: 선행 값이 없을 때', () => {
  it('(가) 신호가 null이면 위험 칸이 null이다', () => {
    const view = buildCaseView(input({ signals: null, signalsAfterReply: null }), P, R);
    expect(view.risk).toBeNull();
    expect(view.riskAfterReply).toBeNull();
  });

  it('(나) 후 보드가 null이면 후 칸·배송사 줄·후 원인이 없고 전 칸은 그대로다', () => {
    const full = buildCaseView(input(), P, R);
    const view = buildCaseView(input({ boardDemo: null }), P, R);
    expect(view.compare.after).toBeNull();
    expect(view.carrier).toBeNull();
    expect(view.cause.after).toBeNull();
    expect(view.compare.before).toEqual(full.compare.before);
  });

  it('(나) 후 보드가 없어도 화면이 그려진다 (예외 없음, 화살표·취소선 없음)', () => {
    const view = buildCaseView(input({ boardDemo: null }), P, R);
    const html = renderToStaticMarkup(createElement(CaseView, { view, desk: deskOf(view, D2_BEFORE), llmOk: false }));
    expect(html).toContain('$74');
    // T076: 배송사 기록이 없으면 선택지 카드가 이미 PayPal 정보만의 값이라 "PayPal data only" 줄이 없다
    expect(html).not.toContain('class="choice-paypal-only');
    expect(html).not.toContain('<del');
    expect(html).not.toContain(copyTables.en['case.view.arrow']);
    expect(html).toContain(copyTables.en['case.view.noCarrier']);
    expect(html).toContain(copyTables.en['common.llmUnavailable']);
  });
});

// ── AC18 12번: 가림·배지·문구 ──────────────────────────────────────────────

describe('AC18 12번: 개인정보 가림과 실제·시연용 구분', () => {
  const view = buildCaseView(input(), P, R);
  const flat = (segments: { text: string }[] | null) => (segments ?? []).map((s) => s.text).join('');

  it('글에 개인통관고유부호 꼴이 있으면 가려진다 (원문·영어 모두)', () => {
    const json = JSON.stringify(view);
    expect(json).not.toContain('P123456789012');
    const withEnglish = buildCaseView(
      input({
        messages: [{ source: 'paypal', date: null, original: REAL_TEXT, english: 'code P123456789012', englishSource: 'ai' }],
      }),
      P,
      R,
    );
    expect(JSON.stringify(withEnglish)).not.toContain('P123456789012');
  });

  it('실제 글은 "From PayPal" 표시 + 배지 없음, 11/02 문의는 Demo data', () => {
    const real = view.messages.find((m) => m.source === 'paypal');
    const demo = view.messages.find((m) => m.source === 'demo');
    expect(real?.sourceKey).toBe('case.badge.fromPaypal');
    expect(copyTables.en['case.badge.fromPaypal']).toBe('From PayPal');
    expect(real?.badges).toEqual([]);
    expect(demo?.date).toBe('2026-11-02');
    expect(demo?.badges).toEqual(['demo']);
    expect(demo?.sourceKey).toBeNull();
    // 시연용 문의가 먼저 (분쟁 접수 전)
    expect(view.messages[0].source).toBe('demo');
  });

  it('배송사 줄·무응답 신호·후 칸에 Demo data, 예상 손실에 Assumption', () => {
    expect(view.carrier?.badges).toEqual(['demo']);
    expect(view.carrier?.events.map((e) => e.statusKey)).toEqual([
      'case.view.carrierStatus.shipped',
      'case.view.carrierStatus.customs_hold',
    ]);
    expect(view.risk?.parts.find((p) => p.signal === 'unanswered')?.demo).toBe(true);
    // 실제 글이 카드사를 언급하므로 그 신호는 시연용에 기대지 않는다
    expect(view.risk?.parts.find((p) => p.signal === 'cardCompanyMention')?.demo).toBe(false);
    expect(view.compare.after?.badges).toContain('demo');
    expect(view.compare.badges).toContain('assumption');
  });

  it('시드 문의가 없으면 무응답 줄에 Demo data가 붙지 않는다', () => {
    const v = buildCaseView(input({ demoFields: ['carrierEvents'] }), P, R);
    expect(v.risk?.parts.find((p) => p.signal === 'unanswered')?.demo).toBe(false);
  });

  it('카드사 언급은 엔진 신호가 참일 때만 표시한다', () => {
    const real = view.messages.find((m) => m.source === 'paypal');
    // T061 4번: 짧은 틈("에 ")으로 붙은 두 낱말은 한 표시로 잇는다
    expect(real?.original.filter((s) => s.mark).map((s) => s.text)).toEqual(['카드사에 이의제기']);
    expect(flat(real?.original ?? null)).not.toContain('P123456789012');
    const quiet = buildCaseView(input({ signals: { ...SEOYEON_START, mentionsCardCompany: false } }), P, R);
    expect(quiet.messages.every((m) => m.original.every((s) => !s.mark))).toBe(true);
  });

  it('영어: AI 번역은 AI suggests, 시드 번역은 Demo data, 없으면 null', () => {
    const messages = caseMessages({
      buyerMessages: [REAL_TEXT],
      buyerMessageEn: 'If I do not hear back this week, I will go to my card company.',
      buyerId: 'B01',
      inquiries: [DEMO_INQUIRY],
      includeInquiries: true,
    });
    const v = buildCaseView(input({ messages }), P, R);
    expect(v.messages.find((m) => m.source === 'paypal')?.englishBadges).toEqual(['aiSuggests']);
    expect(v.messages.find((m) => m.source === 'demo')?.englishBadges).toEqual(['demo']);
    expect(view.messages.find((m) => m.source === 'paypal')?.english).toBeNull();
  });

  it('case.* 문구에 금지 문구가 없고 두 문구 파일의 case.* 키가 같다', () => {
    const banned = /guarantee|prediction accuracy|accurate prediction|보장|예측 정확도/i;
    const caseKeys = (table: Record<string, string>) => Object.keys(table).filter((k) => k.startsWith('case.')).sort();
    expect(caseKeys(copyTables.en)).toEqual(caseKeys(copyTables.ko));
    for (const [locale, table] of Object.entries(copyTables)) {
      for (const key of caseKeys(table)) expect(banned.test(table[key]), `${locale} ${key}`).toBe(false);
    }
  });

  it('화면이 쓰는 문구 키가 모두 있다 (세부 유형 16개·배송 상태·신호)', () => {
    for (const subtype of ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'D1', 'E1', 'F1', 'F2']) {
      expect(typeof copyTables.en[`case.view.subtype.${subtype}`], subtype).toBe('string');
    }
    for (const part of view.risk?.parts ?? []) expect(typeof copyTables.en[part.labelKey], part.labelKey).toBe('string');
    for (const status of ['shipped', 'in_transit', 'customs_hold', 'out_for_delivery', 'delivered']) {
      expect(typeof copyTables.en[`case.view.carrierStatus.${status}`], status).toBe('string');
    }
  });
});

// ── 제안이 먼저 (SPEC v2.6 9-4) ───────────────────────────────────────────

describe('제안이 먼저: offerComesFirst 결과를 옮긴다', () => {
  it('지호 꼴(추천 = 제안, make_offer 허용)이면 메시지 보내기가 꺼지고 이유 키가 있다. 후 칸 행동은 "Offer"', () => {
    const jiho = { ...D1_JIHO, cause: ruleCause('B1') };
    expect(recommend(jiho, P, R).best?.move).toBe('offer');
    const view = buildCaseView(input({ boardReal: jiho, boardDemo: { ...jiho, isDemo: true }, carrierEvents: [] }), P, R);
    expect(view.messageSend.blocked).toBe(true);
    expect(typeof copyTables.en[view.messageSend.reasonKey ?? '']).toBe('string');
    expect(copyTables.en[view.compare.after?.actionKey ?? '']).toBe('Offer');
  });

  it('서연 꼴(추천 = 답장)이면 막지 않는다', () => {
    const view = buildCaseView(input(), P, R);
    expect(view.messageSend).toEqual({ blocked: false, reasonKey: null });
  });

  it('제안 링크가 없으면 막을 이유가 없다', () => {
    const jiho = { ...D1_JIHO, cause: ruleCause('B1'), allowedMoves: ['send_message', 'accept_claim'] as BoardState['allowedMoves'] };
    const view = buildCaseView(input({ boardReal: jiho, boardDemo: null }), P, R);
    expect(view.messageSend.blocked).toBe(false);
  });
});

// ── 글 조각 ───────────────────────────────────────────────────────────────

describe('segmentsOf', () => {
  it('가장 긴 낱말을 먼저 잡고, 대소문자를 가리지 않으며, 글을 잃지 않는다', () => {
    const text = 'I will call my Credit Card Company today';
    const segments = segmentsOf(text, ['card company', 'credit card company']);
    expect(segments.map((s) => s.text).join('')).toBe(text);
    expect(segments.filter((s) => s.mark).map((s) => s.text)).toEqual(['Credit Card Company']);
    expect(segmentsOf(text, null)).toEqual([{ text, mark: false }]);
  });
});

// ── 비교 카드 부품 ─────────────────────────────────────────────────────────

describe('비교 카드 다듬기 (부품)', () => {
  const props = {
    label: 'Expected loss',
    badges: createElement('span', { 'data-badge': 'assumption' }, 'A'),
    before: { caption: 'PayPal data only · Full refund', display: '$X' },
    after: { caption: 'With carrier data · Reply', display: '$Y', badge: createElement('span', { 'data-badge': 'demo' }, 'D') },
    arrowLabel: 'changes to',
    previousLabel: 'Previous value',
  };
  const html = renderToStaticMarkup(createElement(CompareCard, props));

  it('왼쪽은 취소선(<del>) + 읽기용 "이전 값", 오른쪽은 .hero-number', () => {
    expect(html).toMatch(/<del class="[^"]*cc-previous[^"]*"><span class="cc-sr-only">Previous value <\/span>\$X<\/del>/);
    expect(html).toMatch(/class="cc-value hero-number">\$Y</);
  });

  it('순서: 왼쪽 → 화살표 → 오른쪽, 화살표 aria-label은 받은 글자', () => {
    const left = html.indexOf('$X');
    const arrow = html.indexOf('aria-label="changes to"');
    const right = html.indexOf('$Y');
    expect(left).toBeGreaterThan(-1);
    expect(arrow).toBeGreaterThan(left);
    expect(right).toBeGreaterThan(arrow);
  });

  it('칸 배지는 오른쪽 칸 이름 옆에만, 머리에는 받은 배지만', () => {
    const afterSide = html.slice(html.indexOf('cc-after'));
    const beforeSide = html.slice(html.indexOf('cc-before'), html.indexOf('cc-arrow'));
    expect(afterSide).toContain('data-badge="demo"');
    expect(beforeSide).not.toContain('data-badge');
    const head = html.slice(0, html.indexOf('cc-grid'));
    expect(head).toContain('data-badge="assumption"');
    expect(head).not.toContain('data-badge="demo"');
  });

  it('카드 폭은 내용에 맞추고, 숫자 줄은 subgrid로 나란히, 좁은 폭에서도 화살표를 숨기지 않는다', () => {
    const css = readFileSync(path.join(ROOT, 'src/app/_shared/compare-card.css'), 'utf8');
    expect(css).toMatch(/\.cc-card\s*\{[^}]*width:\s*fit-content/);
    expect(css).toMatch(/\.cc-side\s*\{[^}]*grid-template-rows:\s*subgrid/);
    expect(css).toMatch(/\.cc-arrow\s*\{[^}]*grid-row:\s*2[^}]*align-self:\s*center/);
    expect(css).toMatch(/\.cc-previous\s*\{[^}]*color:\s*var\(--color-muted\)[^}]*text-decoration:\s*line-through/);
    expect(css).not.toMatch(/display:\s*none/);
  });

  it('넓은 폭: 세 요소의 열이 명시돼 있다 (왼쪽 1 · 화살표 2 · 오른쪽 3). 자동 배치로 "→ $X $Y"가 되지 않게', () => {
    const css = readFileSync(path.join(ROOT, 'src/app/_shared/compare-card.css'), 'utf8');
    const media = css.indexOf('@media');
    const wide = css.slice(0, media);
    const narrow = css.slice(media);
    expect(wide).toMatch(/\.cc-before\s*\{[^}]*grid-column:\s*1\s*;/);
    expect(wide).toMatch(/\.cc-arrow\s*\{[^}]*grid-column:\s*2\s*;/);
    expect(wide).toMatch(/\.cc-after\s*\{[^}]*grid-column:\s*3\s*;/);
    // 좁은 폭: 한 열로 쌓는다 (순서는 DOM 순서 = 왼쪽 → 화살표 → 오른쪽)
    expect(narrow).toMatch(/\.cc-before,\s*\.cc-after\s*\{[^}]*grid-column:\s*1\s*;/);
    expect(narrow).toMatch(/\.cc-arrow\s*\{[^}]*grid-column:\s*1\s*;[^}]*grid-row:\s*auto/);
  });

  it('globals.css에 옛 .compare* 규칙이 남아 있지 않다', () => {
    const globals = readFileSync(path.join(ROOT, 'src/app/globals.css'), 'utf8');
    expect(globals).not.toMatch(/\.compare[\w-]*\s*[{,]/);
  });
});

describe('대화: 같은 배지는 한 번만', () => {
  it('시연용 문의(글도 시드, 번역도 시드)에는 Demo data 배지가 하나다', () => {
    const messages = caseMessages({
      buyerMessages: [REAL_TEXT],
      buyerMessageEn: 'If I do not hear back this week, I will go to my card company.',
      buyerId: 'B01',
      inquiries: [DEMO_INQUIRY],
      includeInquiries: true,
    });
    const v = buildCaseView(input({ messages }), P, R);
    const html = renderToStaticMarkup(createElement(Conversation, { messages: v.messages, carrierLine: null, locale: 'ko' }));
    const demoItem = html.slice(html.indexOf('case-bubble-demo'));
    const demoOnly = demoItem.slice(0, demoItem.indexOf('</li>'));
    const demoLabel = copyTables.en['badge.demo'] ?? 'Demo data';
    expect(demoOnly.split(demoLabel).length - 1).toBe(1);
  });
});

// ── 화면 전체 (글자) ───────────────────────────────────────────────────────

describe('서연 화면 그리기', () => {
  const seoView = buildCaseView(input(), P, R);
  const html = renderToStaticMarkup(createElement(CaseView, { view: seoView, desk: deskOf(seoView, D2_AFTER), llmOk: true }));

  it('T076: 선택지 카드(배송사 기록 반영 보드, 최선 = Best) + "PayPal data only: Full refund $74", 숫자는 엔진 값의 표시', () => {
    expect(html).toContain(
      t('case.choice.paypalOnly', {
        action: t('case.view.action.refund'),
        amount: toDollarsRounded(recommend(D2_BEFORE, P, R).best?.expectedLossCents as number),
      }),
    );
    const best = recommend(D2_AFTER, P, R).best;
    expect(best?.move).toBe('fight');
    const bestCard = html.slice(html.indexOf('class="choice choice-best"'));
    expect(bestCard.slice(0, bestCard.indexOf('</li>'))).toContain(
      t('case.choice.cost', { amount: toDollarsRounded(best?.expectedLossCents as number) }),
    );
    expect(bestCard.slice(0, bestCard.indexOf('</li>'))).toContain(t('case.choice.fight.title'));
    expect(html).toContain('Code decides');
    expect(html).toContain('From PayPal');
    expect(html).not.toContain('P123456789012');
    expect(html).not.toContain(copyTables.en['common.llmUnavailable']);
  });

  it('T076: 최선 수 카드는 하나뿐이고(Best), 막힌 수는 흐리게 + 이유 (지어낸 % 없음 — 예측 어댑터가 null)', () => {
    expect(html.match(/class="choice choice-best"/g)).toHaveLength(1);
    expect(html.match(/choice-best-tag/g)).toHaveLength(1);
    expect(html).not.toMatch(/Chargeback \d+%/);
  });
});

// ── 404: 연습용·시연 제외 분쟁 ─────────────────────────────────────────────

describe('연습용·시연 제외 분쟁은 열 수 없다 (PayPal을 읽지도 않는다)', () => {
  beforeEach(() => loadSpy.mockClear());

  it('연습용(PP-R-HEY-…)·옛 서연(PP-R-GAH-…)·표 밖 번호 → not_found, PayPal 읽기 0회', async () => {
    const { loadCase, isOnScreen } = await import('@/app/cases/view/load');
    for (const id of ['PP-R-HEY-10197767', 'PP-R-GAH-10197649', 'PP-R-NOPE-1']) {
      expect(isOnScreen(id)).toBe(false);
      expect(await loadCase(id)).toEqual({ kind: 'not_found' });
    }
    expect(loadSpy).toHaveBeenCalledTimes(0);
  });

  it('화면에 내는 분쟁(D2)은 읽으러 간다', async () => {
    const { loadCase, isOnScreen } = await import('@/app/cases/view/load');
    expect(isOnScreen('PP-R-GMS-10197661')).toBe(true);
    const result = await loadCase('PP-R-GMS-10197661');
    expect(result.kind).toBe('paypal_unavailable'); // 가짜 목록이 비어 있다 → 지어내지 않는다
    expect(loadSpy).toHaveBeenCalled();
  });
});

// ── 정적 검사 ──────────────────────────────────────────────────────────────

describe('정적 검사', () => {
  function filesUnder(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? filesUnder(full) : [full];
    });
  }
  const caseFiles = filesUnder(path.join(ROOT, 'src/app/cases')).filter((f) => /\.(ts|tsx)$/.test(f));
  const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('화면 코드(src/app/cases)에 74·37·7400·3680·7200이 없다', () => {
    for (const file of caseFiles) {
      const text = strip(readFileSync(file, 'utf8'));
      expect(/(?<![\w.#-])(74|37|7400|3680|7200)(?![\w.])/.test(text), path.relative(ROOT, file)).toBe(false);
    }
  });

  it('화면 코드에서 /100·toFixed로 금액을 바꾸지 않는다 (반올림은 money.ts 한 곳)', () => {
    for (const file of caseFiles) {
      const text = strip(readFileSync(file, 'utf8'));
      expect(/\/\s*100\b|toFixed\(/.test(text), path.relative(ROOT, file)).toBe(false);
    }
  });

  it('클라이언트 컴포넌트는 서버 전용 코드를 import하지 않는다', () => {
    for (const file of caseFiles.filter((f) => f.endsWith('.tsx'))) {
      const text = readFileSync(file, 'utf8');
      if (!text.startsWith("'use client'")) continue;
      expect(/_server|view\/load|from '\.\/load'/.test(text), path.relative(ROOT, file)).toBe(false);
    }
  });

  it('S5 1부 코드는 PayPal에 POST를 보내지 않는다 (client.call·executeMove 없음)', () => {
    for (const file of caseFiles) {
      const text = strip(readFileSync(file, 'utf8'));
      expect(/\.call\(|executeMove|method:\s*'POST'/.test(text), path.relative(ROOT, file)).toBe(false);
    }
  });
});
