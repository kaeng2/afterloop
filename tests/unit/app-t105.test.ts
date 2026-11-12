/**
 * T105 단위 테스트: 위험 곡선 · 빈 답장 상태 (차이 목록 F3-10·11·13·17·22, F4-32).
 *
 * 기대값 출처: `tasks/T105.md` "고칠 것" 1~5, 시안 `docs/design/mockup-v4/Desk.dc.html` M:727-750 (xStep·liveP·whoCol·NNONE·riskNow),
 * `inbox/2026-11-12-desk-diff.md`. **실호출 0회** (AI는 가짜 LlmCaller, PayPal 없음), 개발 서버 없음, `.env`를 읽지 않는다.
 * 확률은 엔진 `forecastReply` 결과와 비교만 한다 (시험이 확률을 계산하지 않는다).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply } from '@/ai/reply';
import { copyTables, t } from '@/app/_shared/copy';
import { toPercentRounded } from '@/app/_shared/percent';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { buildReplyView, type ReplyViewInput } from '@/app/cases/reply-model';
import { forecastReply } from '@/engine/forecast';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import type { BoardState, CaseEvent, Cause, EscalationSignals, LlmCaller, ReplyForecastInput, RiskPoint } from '@/types';

import replyModelJson from '../../config/reply-model.json';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { React?: typeof React }).React = React;

const { curveView, historyView, toneOf, CURVE_BOX, NO_REPLY_DAYS, noReplyByLabel, noReplyDaysOf } = await import(
  '@/app/cases/desk-model'
);
const { RiskCurveGraphic, RiskCurveCard } = await import('@/app/cases/view/risk-curve');
const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const block = (css: string, selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(strip(css))?.[2] ?? '';

/** 시안 M:727 `xStep = W / 12`, `x = i * xStep + 8`. */
const X_STEP = 640 / 12;
const xAt = (i: number) => Math.round((i * X_STEP + 8) * 10) / 10;

const EVENTS: CaseEvent[] = [
  { at: '2026-10-19T00:00:00Z', kind: 'order_paid', source: 'seed', text: 'Order paid' },
  { at: '2026-10-21T00:00:00Z', kind: 'tracking_missing', source: 'seed', text: 'No tracking in PayPal' },
  { at: '2026-10-28T00:00:00Z', kind: 'buyer_message', source: 'seed', text: 'Where is my order?' },
  { at: '2026-10-31T00:00:00Z', kind: 'seller_reply', source: 'seed', text: 'Please wait' },
  { at: '2026-11-02T00:00:00Z', kind: 'buyer_message', source: 'seed', text: 'Tracking has not moved', flags: ['unanswered'] },
  { at: '2026-11-05T00:00:00Z', kind: 'carrier_event', source: 'seed', text: 'Customs hold' },
  { at: '2026-11-09T00:00:00Z', kind: 'buyer_message', source: 'sandbox', text: 'Card company', flags: ['threat', 'angry'] },
  { at: '2026-11-10T00:00:00Z', kind: 'dispute_opened', source: 'sandbox', text: 'Dispute opened in PayPal' },
];
const POINTS: RiskPoint[] = EVENTS.map((event, i) => ({ at: event.at, kind: event.kind, pChargeback: 0.05 + i * 0.1 }));

// ───────────────────────────── 1·2. x 배치 (F3-10·F3-11) ─────────────────────────────

describe('F3-10 · F3-11: 곡선 x 배치 = 시안 xStep 고정, Send 뒤 단계는 덧붙이기만', () => {
  it('사건 i의 x = i × (640/12) + 8, 초안 점 = 마지막 사건 + 칸, 오른쪽 1/3은 빈칸 (눈금 글자와 안 겹침)', () => {
    const curve = curveView(POINTS, 0.4)!;
    expect(curve.dots.map((dot) => dot.x)).toEqual(POINTS.map((_, i) => xAt(i)));
    expect(curve.draft!.x).toBe(xAt(POINTS.length));
    expect(curve.draft!.x).toBeCloseTo(434.7, 1);
    // 오른쪽 끝 100%/50% 눈금 글자 자리(x=640)와 끝점·물결 원(r 최대 20)이 떨어져 있다
    expect(curve.draft!.x + 20).toBeLessThan(CURVE_BOX.width - 40);
  });

  it('Send 뒤 단계 점이 늘어도 사건 점·보낸 답장 점 자리는 그대로, 단계 점은 칸 × 0.8씩 오른쪽에', () => {
    const before = curveView(POINTS, 0.4)!;
    const trails = [[0.4], [0.4, 0.3], [0.4, 0.3, 0.2], [0.4, 0.3, 0.2, 0.05]];
    for (const trail of trails) {
      const curve = curveView(POINTS, 0.4, trail)!;
      expect(curve.dots.map((dot) => dot.x)).toEqual(before.dots.map((dot) => dot.x));
      expect(curve.draft!.x).toBe(before.draft!.x);
      curve.steps.forEach((step, index) => {
        expect(step.x).toBeCloseTo(xAt(POINTS.length) + (index + 1) * X_STEP * 0.8, 0);
      });
      expect(curve.steps[curve.steps.length - 1]?.x ?? 0).toBeLessThanOrEqual(CURVE_BOX.width);
    }
  });

  it('사건이 아주 많으면(폭을 넘으면) 칸을 줄여 그림 안에 둔다 — 단계 수와는 상관없다', () => {
    const many: RiskPoint[] = Array.from({ length: 14 }, () => ({ at: '2026-11-01T00:00:00Z', kind: 'buyer_message', pChargeback: 0.5 }));
    const a = curveView(many, 0.4, [0.4, 0.3, 0.2, 0.1])!;
    const b = curveView(many, 0.4)!;
    expect(a.dots.map((dot) => dot.x)).toEqual(b.dots.map((dot) => dot.x));
    expect(a.steps[a.steps.length - 1].x).toBeLessThanOrEqual(CURVE_BOX.width);
  });
});

// ───────────────────────────── 3. 점·ping transition 없음 (F3-17) ─────────────────────────────

describe('F3-17: 초안 점·물결 원은 즉시 옮기고, 점선 polyline만 시안 transition', () => {
  const css = read('src/app/cases/view/case.css');
  it('.curve-ping · .curve-dot-draft · .curve-dot에 transition 없음', () => {
    for (const selector of ['.curve-ping', '.curve-dot-draft', '.curve-dot', '.curve-dot-step']) {
      expect(block(css, selector), selector).not.toMatch(/transition/);
    }
    expect(strip(css)).not.toMatch(/\.curve-(ping|dot)[^{]*\{[^}]*transition/);
  });
  it('.curve-draft(점선)는 시안 값 transition: all var(--motion-curve) 그대로', () => {
    expect(block(css, '.curve-draft')).toMatch(/transition:\s*all var\(--motion-curve\)/);
  });
});

// ───────────────────────────── 4. 색 규칙 (F3-13) ─────────────────────────────

describe('F3-13: 곡선 점과 점줄 색 = 시안 whoCol 하나 (buyer · bad · sys)', () => {
  it('사건 → 색: 추적번호 없음·판매자 답장·위협 메시지 = bad, 구매자 글 = buyer, 나머지 = sys', () => {
    expect(EVENTS.map((event) => toneOf(event))).toEqual(['sys', 'bad', 'buyer', 'bad', 'buyer', 'sys', 'bad', 'sys']);
  });

  it('같은 사건이 곡선 점·사건 기록 점줄에서 같은 색 (서버 줄 tone을 그대로 넘긴다)', () => {
    const history = historyView(EVENTS, 22, null)!;
    const tones = history.rows.map((row) => row.tone);
    const curve = curveView(POINTS, 0.4, [], { tones })!;
    expect(curve.dots.map((dot) => dot.tone)).toEqual(tones);
    const markup = html(createElement(RiskCurveGraphic, { curve }));
    const classes = [...markup.matchAll(/<circle class="curve-dot curve-dot-(\w+)"/g)].map((m) => m[1]);
    expect(classes).toEqual(tones);
    // 위협 메시지(Nov 9)는 곡선에서도 빨강(bad)
    expect(curve.dots[6].tone).toBe('bad');
    expect(history.rows[6].tone).toBe('bad');
  });

  it('css: 곡선·점줄 모두 buyer=--color-text, bad=--color-dot-high, sys=--color-dot-neutral. 판매자 파랑·검정 없음', () => {
    const css = read('src/app/cases/view/case.css');
    expect(block(css, '.curve-dot-buyer')).toMatch(/fill:\s*var\(--color-text\)/);
    expect(block(css, '.curve-dot-bad')).toMatch(/fill:\s*var\(--color-dot-high\)/);
    expect(block(css, '.curve-dot-sys')).toMatch(/fill:\s*var\(--color-dot-neutral\)/);
    expect(block(css, '.history-dot-buyer')).toMatch(/background:\s*var\(--color-text\)/);
    expect(block(css, '.history-dot-bad')).toMatch(/background:\s*var\(--color-dot-high\)/);
    expect(block(css, '.history-dot-sys')).toMatch(/background:\s*var\(--color-dot-neutral\)/);
    expect(strip(css)).not.toMatch(/\.history-dot-seller|\.curve-dot-seller_reply|\.curve-dot-buyer_message/);
    const globals = read('src/app/globals.css');
    expect(globals).toMatch(/--color-text:\s*#3f4144/i);
    expect(globals).toMatch(/--color-dot-high:\s*#c4321f/i);
    expect(globals).toMatch(/--color-dot-neutral:\s*#9aa0a6/i);
  });

  it('사례 화면이 사건 기록 줄의 tone을 곡선 카드에 넘긴다', () => {
    expect(strip(read('src/app/cases/view/case-view.tsx'))).toMatch(
      /<RiskCurveCard points=\{desk\.curvePoints\} tones=\{desk\.history\?\.rows\.map\(\(row\) => row\.tone\) \?\? null\} \/>/,
    );
  });
});

// ───────────────────────────── 5. 빈 답장 = 무응답 예측 (F3-22 · F4-32) ─────────────────────────────

const cause: Cause = { subtype: 'A2', confidence: 1, evidence: [], needsReview: false, source: 'rule' };
const BOARD: BoardState = {
  disputeId: 'PP-R-GMS-10197661',
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
  cause,
};
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};
const DELAY = 1;
const FACT_SETS = caseReplyFacts({ now: '2026-11-10T03:00:00Z', dueDate: BOARD.dueDate, buyerId: 'B01', buyerLocale: 'ko' });
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
  const draft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause, move: 'fight', facts: FACT_SETS.outgoing },
    { llm: fakeLlm({ buyer_message_en: 'It has not arrived.', coaching: ['a', 'b', 'c', 'd', 'e'], draft_en: DRAFT_EN }) },
  );
  const translation = await translateReply(
    { draftEn: DRAFT_EN, buyerLocale: 'ko', facts: FACT_SETS.outgoing, move: 'fight' },
    { llm: fakeLlm({ outgoing: OUTGOING }, { back_translation_en: 'Back translation.' }) },
  );
  const best = recommend(BOARD).best;
  return {
    draft,
    translation,
    facts: FACT_SETS.outgoing,
    draftFacts: FACT_SETS.draft,
    board: BOARD,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyerLocale: 'ko',
    plan: best === null ? null : planMove(BOARD, best),
    offerFirst: false,
    mode: 'simulated',
    draftSource: 'ai',
    riskAfterReply: null,
  };
}

function panel(b: Base, over: Record<string, unknown> = {}) {
  return createElement(ReplyPanel, {
    disputeId: BOARD.disputeId,
    base: b,
    replyId: 'r-1',
    languageKey: 'case.view.lang.KO',
    buyerShort: 'Seo-yeon',
    forecastBase: { signals: SIGNALS, delayDays: DELAY, translated: true },
    paypalOnly: null,
    ...over,
  });
}

describe('F3-22 · F4-32: 빈 답장 = 무응답 예측 (엔진 빈 글 + 늦은 날 수 noReplyDays)', () => {
  it('config: reply-model.json noReplyDays = 시안 N_DELAY 자리 2 (엔진 로더는 모르는 키를 버린다 → 엔진 값 그대로)', () => {
    expect(NO_REPLY_DAYS).toBe(2);
    expect(noReplyDaysOf(replyModelJson)).toBe(2);
    expect(noReplyDaysOf({})).toBeNull();
    expect(noReplyDaysOf({ noReplyDays: -1 })).toBeNull();
    expect(noReplyDaysOf({ noReplyDays: 1.5 })).toBeNull();
    // 엔진이 이 키를 받아도 기존 예측이 같다 (키를 뺀 설정과 비교)
    const input: ReplyForecastInput = { text: DRAFT_EN, anchorText: DRAFT_EN, board: BOARD, signals: SIGNALS, delayDays: DELAY };
    const { noReplyDays: _drop, ...without } = replyModelJson as typeof replyModelJson & { noReplyDays?: number };
    void _drop;
    expect(forecastReply(input)).toEqual(forecastReply(input, undefined, undefined, without as never));
  });

  it('날짜: 오늘 + noReplyDays, shortDate 표기 ("by Nov 12")', () => {
    expect(noReplyByLabel('2026-11-10T03:00:00Z', 2)).toBe('Nov 12');
    expect(noReplyByLabel('not a date', 2)).toBeNull();
  });

  it('곡선: 무응답이면 큰 % = 넘긴 예측값, 아래 글 "if no reply by {date}", "N% → M%" 없음', () => {
    const p = 0.89;
    const curve = curveView(POINTS, p, [], { noReplyBy: 'Nov 12' })!;
    expect(curve.headline).toBe(toPercentRounded(p));
    expect(curve.headlineKey).toBe('case.curve.ifNoReply');
    expect(t(curve.headlineKey, curve.headlineVars)).toBe('if no reply by Nov 12');
    expect(curve.fromTo).toBeNull();
    expect(curve.draft).not.toBeNull();
    // 글이 생기면 지금처럼
    const typed = curveView(POINTS, p, [], { noReplyBy: null })!;
    expect(typed.headlineKey).toBe('case.curve.withDraft');
    expect(typed.fromTo).not.toBeNull();
    // Send 뒤에는 무응답 상태를 보지 않는다
    expect(curveView(POINTS, p, [0.4], { noReplyBy: 'Nov 12' })!.headlineKey).toBe('case.curve.now');
  });

  it('곡선 카드 그림: 무응답 문구가 보이고 fromTo 줄이 없다', () => {
    // 정적 렌더에서는 효과가 돌지 않으므로 카드 아래 글 규칙은 curveView로, 그림은 카드가 vars를 넘기는지 소스로 본다
    expect(strip(read('src/app/cases/view/risk-curve.tsx'))).toMatch(/t\(curve\.headlineKey, curve\.headlineVars\)/);
    expect(strip(read('src/app/cases/view/risk-curve.tsx'))).toMatch(/curveView\(points, forecast\?\.pChargeback \?\? null, trail, \{ tones, noReplyBy \}\)/);
    expect(html(createElement(RiskCurveCard, { points: POINTS }))).not.toContain('if no reply');
  });

  it('답장 칸: 빈 글이면 엔진에 빈 글 + (delayDays + noReplyDays)를 넘기고, 알약 = 그 값', async () => {
    const seen: ReplyForecastInput[] = [];
    const forecaster = (input: ReplyForecastInput) => {
      seen.push(input);
      return forecastReply(input);
    };
    const markup = html(panel(await base(), { initialText: '', forecaster }));
    expect(seen.length).toBeGreaterThan(0);
    const last = seen[seen.length - 1];
    expect(last.text).toBe('');
    expect(last.delayDays).toBe(DELAY + 2);
    const expected = forecastReply({ ...last, text: '', delayDays: DELAY + 2 });
    expect(markup).toContain(`>${t('case.choice.chargeback', { percent: toPercentRounded(expected.pChargeback) })}<`);
  });

  it('답장 칸: 글이 있으면 지금처럼 delayDays 그대로', async () => {
    const seen: ReplyForecastInput[] = [];
    const forecaster = (input: ReplyForecastInput) => {
      seen.push(input);
      return forecastReply(input);
    };
    const b = await base();
    html(panel(b, { forecaster }));
    const anchor = buildReplyView({ ...b, confirmed: [], sendState: 'idle', outcome: null }).draftEn?.text as string;
    expect(seen[seen.length - 1].text).toBe(anchor);
    expect(seen[seen.length - 1].delayDays).toBe(DELAY);
  });

  it('답장 칸이 곡선 상자에 무응답 날짜를 넣는다 (글이 있으면 null)', () => {
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(src).toMatch(/setNoReplyBy\(emptyDraft && forecast !== null \? noReplyByLabel\(new Date\(\)\.toISOString\(\), NO_REPLY_DAYS \?\? 0\) : null\)/);
  });

  it('문구: case.curve.ifNoReply en/ko 둘 다, 날짜 자리표시자', () => {
    expect(copyTables.en['case.curve.ifNoReply']).toBe('if no reply by {{date}}');
    expect(copyTables.ko['case.curve.ifNoReply']).toContain('{{date}}');
    expect(Object.keys(copyTables.en).sort()).toEqual(Object.keys(copyTables.ko).sort());
  });
});
