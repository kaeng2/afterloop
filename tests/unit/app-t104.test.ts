/**
 * T104 단위·정적 테스트: 답장 칸 · Send 이후 — 버그·논리 (차이 목록 1번: F4-47·52·36·37·69, F5-15·16·25·28, 3차 리뷰 ③).
 *
 * 기대값 출처: `tasks/T104.md` "고칠 것" 1~7, `inbox/2026-11-12-desk-diff.md` 각 줄, 시안 `docs/design/mockup-v4/Desk.dc.html`
 * (L661 `out`, L664-674 `send()`, L784 `eff`, L62 `.gchip`, L24 `.chip`). 숫자는 엔진 함수 결과와 비교만 한다.
 * **실호출 0회** — AI는 가짜 LlmCaller, PayPal은 가짜 호출기 또는 부르지 않음. 개발 서버 없음. `.env`를 읽지 않는다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { checkTokens } from '@/ai/tokens';
import type { LoadDemoDisputesResult } from '@/app/_server/disputes';
import { copyKeys, copyTables, t } from '@/app/_shared/copy';
import { toPercentRounded } from '@/app/_shared/percent';
import { applyChip, effectRows, filledSnippets, ppText, shownDeltaPp } from '@/app/cases/desk-actions';
import { keepSignOff, revertToTokens } from '@/app/cases/edited-reply';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import {
  buildReplyView,
  detailsBackTranslation,
  editGate,
  EDITED_KEY,
  fillFactTokens,
  type ReplyViewInput,
} from '@/app/cases/reply-model';
import { forecastReply, replyFeatureEffects, scenarioRisk } from '@/engine/forecast';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import { replySnippetsFor } from '@/engine/snippets';
import type { BoardState, Cause, DemoLink, EscalationSignals, FactToken, LlmCaller, ReplyFeatureEffect, Subtype } from '@/types';

import { P, R } from '../acceptance/boards';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
const sendSpy = vi.fn();
vi.mock('@/app/cases/actions', () => ({
  sendReplyAction: (...args: unknown[]) => sendSpy(...args),
  prepareEditedAction: (...args: unknown[]) => sendSpy(...args),
}));
(globalThis as { React?: typeof React }).React = React;

const { ReplyPanel } = await import('@/app/cases/reply/reply-panel');
const { CaseProgress } = await import('@/app/cases/progress/case-progress');
const model = await import('@/app/cases/progress/progress-model');
const activity = await import('@/app/_server/activity');
const { prepareEditedReply } = await import('@/app/_server/send');
type PreparedReply = import('@/app/_server/send').PreparedReply;

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── 서연 (A2 통관 보류) — app-t091과 같은 꼴 ─────────────────────────────

const D2 = 'PP-R-TEST-T104';
const cause = (subtype: Subtype): Cause => ({ subtype, confidence: 1, evidence: [], needsReview: false, source: 'rule' });
const BASE_BOARD: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause' | 'isDemo'> = {
  disputeId: D2,
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:37:00.000Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  buyerPriorInrDisputes: 0,
};
const BEFORE: BoardState = { ...BASE_BOARD, hasTracking: false, hasDeliveredTracking: false, isDemo: false, cause: cause('A1') };
const AFTER: BoardState = { ...BASE_BOARD, hasTracking: true, hasDeliveredTracking: false, isDemo: true, cause: cause('A2') };
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};
const DELAY = 2;
const NOW = '2026-11-10T03:00:00Z';
const FACT_SETS = caseReplyFacts({ now: NOW, dueDate: AFTER.dueDate, buyerId: 'B01', buyerLocale: 'ko' });
const FACTS: FactToken[] = FACT_SETS.outgoing;
const DRAFT_EN =
  "Sorry for the wait, ⟦BUYER_NAME_1⟧. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧. ⟦SELLER_NAME_1⟧";
const OUTGOING =
  '⟦BUYER_NAME_1⟧, 기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요. ⟦SELLER_NAME_1⟧';
const BACK = "Sorry for the wait. Your sweater is at Korean customs. I'll get back to you by ⟦DATE_1⟧.";
const RUSHED = t('case.reply.rushedExample');

function fakeLlm(...answers: unknown[]): { calls: Parameters<LlmCaller>[0][]; llm: LlmCaller } {
  const calls: Parameters<LlmCaller>[0][] = [];
  return {
    calls,
    llm: async (req) => {
      calls.push(req);
      const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}

type Base = Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;

async function base(): Promise<Base> {
  const draft: ReplyDraft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: AFTER.cause as Cause, move: 'fight', facts: FACTS },
    { llm: fakeLlm({ buyer_message_en: 'It has not arrived.', coaching: ['a', 'b', 'c', 'd', 'e'], draft_en: DRAFT_EN }).llm },
  );
  const translation: ReplyTranslation = await translateReply(
    { draftEn: DRAFT_EN, buyerLocale: 'ko', facts: FACTS, move: 'fight' },
    { llm: fakeLlm({ outgoing: OUTGOING }, { back_translation_en: BACK }).llm },
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

const anchorOf = (b: Base): string => buildReplyView({ ...b, confirmed: [], sendState: 'idle', outcome: null }).draftEn?.text as string;
const input = (text: string, anchor: string) => ({ text, anchorText: anchor, board: AFTER, signals: SIGNALS, delayDays: DELAY, translated: true });

function panel(b: Base, over: Record<string, unknown> = {}) {
  return createElement(ReplyPanel, {
    disputeId: D2,
    base: b,
    replyId: 'r-1',
    languageKey: 'case.view.lang.KO',
    buyerShort: 'Seo-yeon',
    forecastBase: { signals: SIGNALS, delayDays: DELAY, translated: true },
    paypalOnly: null,
    ...over,
  });
}

// ───────────────────────────── 1. F4-47 bad 줄 %p 부호 ─────────────────────────────

describe('1. F4-47: bad 줄 = "+N pts" (시안 eff(k, true) = p(지금) − p(뺀 글)), 엔진 deltaPp 정의는 그대로', () => {
  it('shownDeltaPp: bad만 부호를 뒤집고 good·missing은 엔진 값 그대로', () => {
    expect(shownDeltaPp({ kind: 'bad', deltaPp: -8.4 })).toBe(8.4);
    expect(shownDeltaPp({ kind: 'good', deltaPp: -5 })).toBe(-5);
    expect(shownDeltaPp({ kind: 'missing', deltaPp: -12 })).toBe(-12);
  });

  it('급한 답장: bad 줄(탓하기·모호함)은 양수 "+N", 화면에도 "+N pts" (빨강 클래스)', async () => {
    const b = await base();
    const anchor = anchorOf(b);
    const effects = replyFeatureEffects(input(RUSHED, anchor), filledSnippets(replySnippetsFor('A2'), FACT_SETS.draft));
    const bad = effects.filter((effect: ReplyFeatureEffect) => effect.kind === 'bad');
    expect(bad.length).toBeGreaterThan(0);
    const rows = effectRows(effects, false);
    for (const effect of bad) {
      // 엔진: 빼면 위험이 내려간다 (음수) → 화면: 이 문장이 위험을 올린다 (양수)
      expect(effect.deltaPp).toBeLessThan(0);
      const row = rows?.bad.find((r) => r.key === effect.key);
      expect(row?.pp).toBe(ppText(-effect.deltaPp));
      expect(row?.pp.startsWith('+')).toBe(true);
    }
    const markup = html(panel(b, { initialText: RUSHED }));
    for (const effect of bad) {
      const at = markup.indexOf(`data-chip="${effect.key}"`);
      const line = markup.slice(at, markup.indexOf('</div>', at));
      expect(line).toContain(`reply-lint-pp reply-lint-pp-bad num">${t('case.reply.pts', { value: ppText(-effect.deltaPp) })}`);
    }
  });
});

// ───────────────────────────── 2. F5-15·16 분기 ─────────────────────────────

describe('2. F5-15·16: 보낸 답장의 예측으로 흐름을 나눈다 (시안 L661 out)', () => {
  it('scenarioOutcome = pWait·pRefund·pChargeback 중 큰 것, 같으면 ok > refund > cb, 예측 없음 = ok', () => {
    const f = (pWait: number, pRefund: number, pChargeback: number) => ({ pWait, pRefund, pChargeback });
    expect(model.scenarioOutcome(f(0.6, 0.3, 0.1))).toBe('ok');
    expect(model.scenarioOutcome(f(0.2, 0.5, 0.3))).toBe('refund');
    expect(model.scenarioOutcome(f(0.1, 0.2, 0.7))).toBe('cb');
    // 동률
    expect(model.scenarioOutcome(f(0.4, 0.4, 0.2))).toBe('ok');
    expect(model.scenarioOutcome(f(0.2, 0.4, 0.4))).toBe('refund');
    expect(model.scenarioOutcome(f(0.4, 0.2, 0.4))).toBe('ok');
    expect(model.scenarioOutcome(f(1 / 3, 1 / 3, 1 / 3))).toBe('ok');
    expect(model.scenarioOutcome(null)).toBe('ok');
  });

  it('엔진 값: AI 초안 = ok 흐름, 급한 답장(위험 높음)은 그 예측대로 ok가 아닌 흐름 (F5-16 논리)', async () => {
    const anchor = anchorOf(await base());
    const aiForecast = forecastReply(input(anchor, anchor));
    expect(model.scenarioOutcome(aiForecast)).toBe('ok');
    const rushed = forecastReply(input(RUSHED, anchor));
    const out = model.scenarioOutcome(rushed);
    const top = Math.max(rushed.pWait, rushed.pRefund, rushed.pChargeback);
    expect(out).toBe(rushed.pWait === top ? 'ok' : rushed.pRefund === top ? 'refund' : 'cb');
    expect(out).not.toBe('ok');
    // 시안과 같은 결과: 급한 답장 → cb 분기 (지금 가정값에서 엔진 pChargeback이 가장 크다)
    expect(out).toBe('cb');
  });

  it('급한 답장을 칩으로 고친 글도 그 글의 예측대로 (글이 바뀌면 분기가 따라간다)', async () => {
    const anchor = anchorOf(await base());
    const effects = replyFeatureEffects(input(RUSHED, anchor), filledSnippets(replySnippetsFor('A2'), FACT_SETS.draft));
    let fixed = RUSHED;
    for (const row of effectRows(effects, false)?.bad ?? []) fixed = applyChip(fixed, row);
    for (const row of effectRows(effects, false)?.missing ?? []) fixed = applyChip(fixed, row);
    const f = forecastReply(input(fixed, anchor));
    expect(model.scenarioOutcome(f)).toBe(model.scenarioOutcome({ pWait: f.pWait, pRefund: f.pRefund, pChargeback: f.pChargeback }));
    expect(f.pChargeback).toBeLessThan(forecastReply(input(RUSHED, anchor)).pChargeback);
  });

  it('상태 기계: refund = 승인 대기 → [Approve] → 손님 확인 (4, typing 없음), cb = 화난 답장 + 대기 → [Approve] (3)', () => {
    expect(model.progressStart('refund')).toEqual({ shown: 1, typing: false });
    expect(model.progressStart('cb')).toEqual({ shown: 1, typing: true });
    expect(model.progressStart('ok')).toEqual(model.PROGRESS_START);
    let s = model.buyerReplied(model.progressStart('cb'));
    expect(model.awaitingForward(s)).toBe(true);
    expect(model.progressFinished(s, 'cb')).toBe(false);
    s = model.approveStep(s);
    expect(model.progressFinished(s, 'cb')).toBe(true);
    expect(model.stepAfterApproval('cb')).toBe(false);
    expect(model.stepAfterApproval('refund')).toBe(true);
    let r = model.approveStep(model.buyerReplied(model.progressStart('refund')));
    expect(model.progressFinished(r, 'refund')).toBe(false);
    r = model.customsCleared(r);
    expect(model.progressFinished(r, 'refund')).toBe(true);
    // ok는 그대로 (4에서 끝)
    expect(model.progressFinished({ shown: 3, typing: false })).toBe(false);
  });
});

// ── Send 뒤 칸 그리기 ─────────────────────────────

type State = { shown: 1 | 2 | 3 | 4; typing: boolean };
const SENT_KO = '안녕하세요. 세관 문제는 저희 책임이 아니에요.';

async function progressHtml(outcome: 'ok' | 'refund' | 'cb', state: State, over: Record<string, unknown> = {}) {
  const anchor = anchorOf(await base());
  return html(
    createElement(CaseProgress, {
      disputeId: D2,
      live: false,
      language: 'Korean',
      buyerShort: 'Seo-yeon',
      sentText: SENT_KO,
      sentLocale: 'ko',
      scenarioInput: input(RUSHED, anchor),
      outcome,
      baseForecast: forecastReply(input(RUSHED, anchor)),
      onReplay: () => undefined,
      initial: state,
      ...over,
    }),
  );
}

const stepsOf = (markup: string): string[] => markup.match(/<li class="cprog-step"[\s\S]*?<\/li>/g) ?? [];
const chipOf = (step: string) => step.match(/class="cprog-chip[^"]*"[^>]*>([^<]*)</)?.[1] ?? null;

describe('2. refund·cb 분기 화면: Simulated + 승인 버튼, 쓰기 0, 계약 밖 단계에는 위험 칩 없음', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    activity.resetActivityForTest();
    sendSpy.mockReset();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('refund: 보낸 답장 → 승인 대기 [Approve refund] → 환불 승인함 → 손님 환불 확인. typing 없음', async () => {
    const waiting = await progressHtml('refund', { shown: 2, typing: false });
    expect(waiting).toContain(t('case.progress.refundAsk.title'));
    expect(waiting).toContain(`>${t('case.progress.refundApprove')}</button>`);
    expect(waiting).not.toContain('cprog-typing');
    const done = await progressHtml('refund', { shown: 4, typing: false });
    const steps = stepsOf(done);
    expect(steps.map((s) => s.match(/data-step="([^"]+)"/)?.[1])).toEqual(['sent', 'refund', 'buyer_refund']);
    expect(done).toContain(t('case.progress.refunded.title'));
    expect(done).toContain(t('case.progress.refundBuyer.title', { name: 'Seo-yeon' }));
    expect(done).toContain(t('case.progress.refundBuyer.original'));
    expect(done).toContain(t('case.progress.refundBuyer.tagConfirmed'));
    // 승인 버튼은 대기 줄에만
    expect(done).not.toContain(`>${t('case.progress.refundApprove')}</button>`);
  });

  it('cb: 보낸 답장 → 화난 답장(차지백 언급, 빨강 칩) + 승인 대기 → 환불 승인함 (끝)', async () => {
    const start = await progressHtml('cb', { shown: 1, typing: true });
    expect(start).toContain('cprog-typing');
    const waiting = await progressHtml('cb', { shown: 2, typing: false });
    expect(waiting).toContain(t('case.progress.angryBuyer.title', { name: 'Seo-yeon' }));
    expect(waiting).toContain(t('case.progress.angryBuyer.original'));
    expect(waiting).toContain(`class="desk-chip desk-chip-bad">${t('case.progress.angryBuyer.tagThreat')}`);
    expect(waiting).toContain(t('case.progress.cbAsk.title'));
    expect(waiting).toContain(`>${t('case.progress.refundApprove')}</button>`);
    // 손님이 차분히 통관번호를 보내는 ok 흐름이 아니다 (F5-16)
    expect(waiting).not.toContain(t('case.progress.buyer.original'));
    expect(waiting).not.toContain(t('case.progress.forward.button'));
    const done = await progressHtml('cb', { shown: 3, typing: false });
    expect(stepsOf(done).map((s) => s.match(/data-step="([^"]+)"/)?.[1])).toEqual(['sent', 'buyer_angry', 'refund']);
  });

  it('위험 칩: 첫 줄 = 보낸 답장의 엔진 pChargeback(scenarioRisk sent), 나머지 줄(계약 밖)은 칩 없음', async () => {
    const anchor = anchorOf(await base());
    const sent = scenarioRisk(input(RUSHED, anchor), ['sent'])[0];
    expect(sent.pChargeback).toBeCloseTo(forecastReply(input(RUSHED, anchor)).pChargeback, 10);
    const expected = t('case.progress.risk', { percent: toPercentRounded(sent.pChargeback) });
    for (const [outcome, state] of [
      ['refund', { shown: 4, typing: false }],
      ['cb', { shown: 3, typing: false }],
    ] as const) {
      const steps = stepsOf(await progressHtml(outcome, state));
      expect(chipOf(steps[0]), outcome).toBe(expected);
      for (const step of steps.slice(1)) expect(chipOf(step), outcome).toBeNull();
    }
    // 곡선 점도 보낸 답장 하나 (지어내지 않는다)
    const points = scenarioRisk(input(RUSHED, anchor), ['sent', 'buyer_reply', 'forwarded', 'cleared']);
    expect(model.riskTrail({ shown: 4, typing: false }, points, 'refund')).toEqual([points[0].pChargeback]);
    expect(model.riskTrail({ shown: 3, typing: false }, points, 'cb')).toEqual([points[0].pChargeback]);
    // ok는 그대로 (단계마다)
    expect(model.riskTrail({ shown: 4, typing: false }, points, 'ok')).toHaveLength(4);
  });

  it('모든 단계·분기를 그려도 fetch·서버 액션 0회, PayPal activity 0줄, 모든 단계 Simulated, 통관번호 원문 없음', async () => {
    const sim = `>${t('case.progress.simulated')}</span>`;
    for (const outcome of ['refund', 'cb'] as const) {
      for (const shown of [1, 2, 3, 4] as const) {
        const markup = await progressHtml(outcome, { shown, typing: shown === 1 && outcome === 'cb' });
        for (const step of stepsOf(markup)) expect(step).toContain(sim);
        expect(markup).not.toMatch(/P\d{8,}/);
        expect(markup).not.toMatch(/POST|· 200|· 201|\/refund/);
      }
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
    expect(activity.listActivity()).toEqual([]);
  });

  it('승인 버튼은 화면 상태만 (진행 칸 파일에 서버 액션·fetch·PayPal import 없음)', () => {
    for (const file of ['case-progress.tsx', 'progress-model.ts']) {
      const source = strip(read(`src/app/cases/progress/${file}`));
      expect(source, file).not.toMatch(/from '[^']*(actions|activity|_server|paypal|@\/ai|@\/exec)[^']*'/);
      expect(source, file).not.toMatch(/\bfetch\(/);
    }
    const src = strip(read('src/app/cases/progress/case-progress.tsx'));
    expect(src).toMatch(/function approve\(\) \{\s*if \(!awaitingForward\(state\)\) return;\s*setState\(approveStep\);/);
  });

  it('문구: 새 키는 en·ko 둘 다, 약속·근거 없는 숫자·금액 없음', () => {
    const keys = copyKeys(copyTables.en).filter((key) => /^case\.progress\.(refund|cbAsk|refunded|refundBuyer|angryBuyer)/.test(key));
    expect(keys.length).toBeGreaterThanOrEqual(17);
    for (const key of keys) {
      expect(copyTables.ko[key], key).toBeDefined();
      for (const table of [copyTables.en, copyTables.ko]) {
        const value = String(table[key]);
        expect(value, key).not.toMatch(/\$\d|\d+%|guarantee|보장|will refund|환불해 드릴게요|refund you/i);
      }
    }
    expect(copyKeys(copyTables.en).sort()).toEqual(copyKeys(copyTables.ko).sort());
  });

  it('답장 칸: 분기 입력 = 보낸 순간의 글(sentSnap)과 그 예측, useMemo로 고정 (T103)', () => {
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(src).toMatch(/const snap = \{ text, forecast \};/);
    expect(src).toMatch(/if \(next\.ok\) setSentSnap\(snap\);/);
    expect(src).toMatch(/const sentText = sentSnap\?\.text \?\? anchor;/);
    expect(src).toMatch(/text: sentText, anchorText: anchor/);
    expect(src).toMatch(/scenarioOutcome\(sentSnap\?\.forecast \?\? null\), \[sentSnap\]\)/);
    expect(src).toMatch(/outcome=\{sentOutcome\}/);
  });
});

// ───────────────────────────── 3. F5-25·28 토스트·번쩍임 1회 ─────────────────────────────

describe('3. F5-25·28·29: 토스트·번쩍임·"+$N"·Done today는 마지막 단계 때 한 번만', () => {
  it('메시지 Send 성공 순간에는 report·markDone을 부르지 않는다 (제안만 바로)', () => {
    const src = strip(read('src/app/cases/reply/reply-panel.tsx'));
    const send = src.slice(src.indexOf('async function send('), src.indexOf('function completeAction('));
    expect(send).not.toMatch(/\breport\(/);
    expect(send).not.toMatch(/\bmarkDone\(/);
    expect(send).toMatch(/if \(next\.ok && kind === 'offer'\) completeAction\(/);
    // 부르는 곳은 completeAction 하나 (report 1번, markDone 1번)
    expect(src.match(/\breport\(/g)).toHaveLength(1);
    expect(src.match(/\bmarkDone\(/g)).toHaveLength(1);
    // 금액은 ok 분기만
    expect(src).toMatch(/out === 'ok' \? savings : null/);
  });

  it('진행 칸: 자기 토스트 없음, 끝(finished) 효과 한 곳에서 flash(ok) + onFinish 한 번', () => {
    const src = strip(read('src/app/cases/progress/case-progress.tsx'));
    expect(src).not.toMatch(/setToast|cprog-toast|savings\(/);
    expect(src.match(/finishRef\.current\?\.\(outcome\)/g)).toHaveLength(1);
    const effect = src.slice(src.indexOf('if (!finished) return;'), src.indexOf('}, [finished]);'));
    expect(effect).toContain("outcome === 'ok'");
    expect(effect).toContain('FLASH_CLASS');
    expect(effect).toContain('finishRef.current?.(outcome)');
    // 마지막 단계 = 분기마다
    expect(model.PROGRESS_STEPS).toEqual({ ok: 4, refund: 4, cb: 3 });
  });

  it('Send 뒤 첫 화면(shown 1)에는 토스트가 없다', async () => {
    const markup = await progressHtml('ok', { shown: 1, typing: true });
    expect(markup).not.toContain('role="status"');
    expect(markup).not.toContain(t('today.weekly.toast', { amount: '' }).slice(0, 10));
  });
});

// ───────────────────────────── 4. F4-52 역번역 ─────────────────────────────

describe('4. F4-52: Details 역번역 = 고친 글의 번역 결과, 없으면 숨김', () => {
  it('detailsBackTranslation', () => {
    const orig = { backTranslationEn: 'ORIGINAL' };
    const editedView = { backTranslationEn: 'EDITED' };
    expect(detailsBackTranslation(false, orig, null)).toBe('ORIGINAL');
    expect(detailsBackTranslation(false, orig, editedView)).toBe('ORIGINAL');
    expect(detailsBackTranslation(true, orig, null)).toBeNull();
    expect(detailsBackTranslation(true, orig, editedView)).toBe('EDITED');
  });

  it('화면: 고친 글(검사 전)이면 원래 초안의 역번역이 Details에 없다, 고치지 않으면 있다', async () => {
    const b = await base();
    const original = html(panel(b));
    const back = buildReplyView({ ...b, confirmed: [], sendState: 'idle', outcome: null }).backTranslationEn as string;
    expect(back.length).toBeGreaterThan(0);
    const details = (markup: string) => markup.slice(markup.indexOf('class="reply-details"'));
    expect(details(original)).toContain(t('case.reply.backTranslation'));
    const edited = html(panel(b, { initialText: RUSHED }));
    expect(details(edited)).not.toContain(t('case.reply.backTranslation'));
    expect(details(edited)).not.toContain(back.replace(/'/g, '&#x27;'));
  });
});

// ───────────────────────────── 5. 3차 리뷰 ③ SELLER_NAME 버그 ─────────────────────────────

const LINKS: DemoLink[] = [{ paypalDisputeId: D2, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true }];

function loaded(): LoadDemoDisputesResult {
  return {
    disputes: [
      {
        key: 'D2',
        disputeId: D2,
        statusCode: 'WAITING_FOR_SELLER_RESPONSE',
        buyer: { id: 'B01', name: 'Seo-yeon Park', country: 'KR', language: 'KO', sandbox: true, role: 'buyer' },
        product: null,
        buyerMessages: [],
        boardReal: BEFORE,
        boardDemo: AFTER,
        demoFields: [],
        carrierEvents: [],
        signals: null,
        signalsAfterReply: null,
        liveSendAllowed: true,
      },
    ],
    paypal: { ok: true },
    llm: { ok: true },
  } as LoadDemoDisputesResult;
}

const aiReply = (): PreparedReply => ({
  disputeId: D2,
  draftSource: 'ai',
  draftEn: DRAFT_EN,
  outgoing: OUTGOING,
  outsidePolicy: [],
  addedInTranslation: [],
  nameProblems: [],
  facts: FACTS,
  buyerLocale: 'ko',
});

/**
 * 번역 프롬프트("⟦SELLER_NAME_1⟧ stays as the sign-off" + 사실값 목록에 서명)를 따르는 가짜 번역기: 받은 영어의 토큰은 그대로
 * 두고, 서명 토큰이 없으면 끝에 붙인다 — 3차 리뷰 ③에서 본 동작. 역번역은 고정 글.
 */
function signingTranslator(): { calls: string[]; llm: LlmCaller } {
  const calls: string[] = [];
  return {
    calls,
    llm: async (req) => {
      calls.push(req.user);
      if (req.system.startsWith('You translate a small online')) {
        const draft = /<draft>\n([\s\S]*?)\n<\/draft>/.exec(req.user)?.[1] ?? '';
        const tokens = draft.match(/⟦[A-Z_]+_\d+⟧/g) ?? [];
        const body = `번역: ${tokens.filter((tk) => tk !== '⟦SELLER_NAME_1⟧').join(' ')}`.trim();
        return { outgoing: `${body} ⟦SELLER_NAME_1⟧` };
      }
      return { back_translation_en: 'Back translation of the edited reply.' };
    },
  };
}

describe('5. 3차 리뷰 ③: 급한 답장 → 칩으로 고치기 → Translate & check가 "Facts match failed ⟦SELLER_NAME_1⟧"로 막히던 버그', () => {
  async function fixedRushed(): Promise<string> {
    const anchor = anchorOf(await base());
    const effects = replyFeatureEffects(input(RUSHED, anchor), filledSnippets(replySnippetsFor('A2'), FACT_SETS.draft));
    let text = RUSHED;
    for (const row of effectRows(effects, false)?.bad ?? []) text = applyChip(text, row);
    for (const row of effectRows(effects, false)?.missing ?? []) text = applyChip(text, row);
    return text;
  }

  it('재현: 서명 없는 토큰 글 + 서명을 붙이는 번역 → 예전 되돌리기로는 토큰 검사 실패 (extra ⟦SELLER_NAME_1⟧)', async () => {
    const text = await fixedRushed();
    expect(text).not.toContain('Hannah');
    // 예전 되돌리기 결과 = 서명 없음 (keepSignOff 이전 단계와 같다: 원래 초안 없이 되돌림)
    const old = revertToTokens(text, FACT_SETS.draft, { plan: null, board: AFTER }, '');
    expect(old).not.toContain('⟦SELLER_NAME_1⟧');
    const check = checkTokens(old, `${old} ⟦SELLER_NAME_1⟧`, FACTS);
    expect(check.ok).toBe(false);
    expect(check.extra).toContain('⟦SELLER_NAME_1⟧');
  });

  it('고침: 원래 초안에 서명이 있으면 서명 토큰을 남긴다 → 같은 번역으로 검사 통과, Send 번호가 나온다', async () => {
    const text = await fixedRushed();
    const ai = signingTranslator();
    const result = await prepareEditedReply(
      { disputeId: D2, reply: aiReply(), text },
      { load: async () => loaded(), llm: ai.llm, now: NOW, links: LINKS, params: P, rules: R },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draftEn.endsWith('⟦SELLER_NAME_1⟧')).toBe(true);
    expect(result.translation.ok).toBe(true);
    if (!result.translation.ok) return;
    expect(result.translation.check.extra).toEqual([]);
    expect(result.translation.check.missing).toEqual([]);
    expect(result.translation.check.ok).toBe(true);
    expect(result.replyId).toMatch(/^r-[0-9a-f]{32}$/);
    // AI에는 이름 값이 가지 않는다 (토큰만)
    for (const call of ai.calls) expect(call).not.toMatch(/Hannah|Fernwood|Seo-yeon|서연/);
  });

  it('사실 검사는 느슨해지지 않았다: 번역이 서명을 빼거나 두 번 쓰면 여전히 실패', async () => {
    const text = await fixedRushed();
    const tokenized = revertToTokens(text, FACT_SETS.draft, { plan: null, board: AFTER }, DRAFT_EN);
    expect(checkTokens(tokenized, tokenized.replace('⟦SELLER_NAME_1⟧', ''), FACTS).ok).toBe(false);
    expect(checkTokens(tokenized, `${tokenized} ⟦SELLER_NAME_1⟧`, FACTS).ok).toBe(false);
    // 다른 사실값(날짜)을 번역이 더해도 실패
    const noDate = tokenized.replace(/⟦DATE_1⟧/g, '');
    expect(checkTokens(noDate, `${noDate} ⟦DATE_1⟧`, FACTS).ok).toBe(false);
  });

  it('keepSignOff: 원래 초안에 서명이 없으면 더하지 않고, 이미 있으면 그대로, 빈 글은 그대로', () => {
    expect(keepSignOff('Hi.', 'Hello.')).toBe('Hi.');
    expect(keepSignOff('Hi. ⟦SELLER_NAME_1⟧', DRAFT_EN)).toBe('Hi. ⟦SELLER_NAME_1⟧');
    expect(keepSignOff('Hi.  ', DRAFT_EN)).toBe('Hi. ⟦SELLER_NAME_1⟧');
    expect(keepSignOff('', DRAFT_EN)).toBe('');
    // 채워 보인 AI 초안은 원래 토큰 글로 그대로 돌아간다 (T100)
    const anchor = fillFactTokens(DRAFT_EN, FACT_SETS.draft, 'en');
    expect(revertToTokens(anchor, FACT_SETS.draft, { plan: null, board: AFTER }, DRAFT_EN)).toBe(DRAFT_EN);
  });
});

// ───────────────────────────── 6. F4-36·37 ✓ 칩 ─────────────────────────────

describe('6. F4-36·37: ✓ 칩 흰 바탕 + inset 1px #E4E6E9, "✓ " 뒤 띄움', () => {
  const css = strip(read('src/app/cases/reply/reply.css'));
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
  };

  it('좋은 칩 규칙이 .reply-chip(회색 바탕)보다 우선 (두 클래스)', () => {
    const good = rule('.reply-chip.reply-chip-good');
    expect(good).toMatch(/background:\s*var\(--color-surface\)/);
    expect(good).toMatch(/box-shadow:\s*var\(--shadow-hairline\)/);
    expect(read('src/app/globals.css')).toMatch(/--shadow-hairline:\s*inset 0 0 0 1px #e4e6e9;/i);
    // 같은 우선순위의 단독 `.reply-chip-good {`가 남아 있지 않다 (순서 버그 재발 방지)
    expect(css).not.toMatch(/(^|\n)\.reply-chip-good\s*\{/);
    expect(rule('.reply-chip')).toMatch(/background:\s*var\(--color-pill-neutral-bg\)/);
    expect(rule('.reply-chip.reply-chip-warn')).toMatch(/background:\s*var\(--color-surface\)/);
  });

  it('.reply-chip gap 4px (시안 .chip gap:4px) → "✓"와 이름 사이가 띄어진다', () => {
    expect(rule('.reply-chip')).toMatch(/gap:\s*0\.25rem/);
  });
});

// ───────────────────────────── 7. F4-69 빈 글 ─────────────────────────────

describe('7. F4-69: 빈 글이면 Send가 이유 글 없이 꺼진다', () => {
  it('editGate: 빈 글 → reasonKey null, 번역 버튼 없음. 고친 글은 그대로 "Edited — translate…"', () => {
    const ok = { ok: true, reasonKey: null };
    expect(editGate(ok, '', 'anchor')).toEqual({ ok: false, reasonKey: null, translate: false });
    expect(editGate(ok, '   ', 'anchor')).toEqual({ ok: false, reasonKey: null, translate: false });
    expect(editGate(ok, 'changed', 'anchor')).toEqual({ ok: false, reasonKey: EDITED_KEY, translate: true });
  });

  it('화면: 빈 글 → Send disabled, 이유 칸 비어 있음', async () => {
    const markup = html(panel(await base(), { initialText: '' }));
    expect(markup).not.toContain(t(EDITED_KEY));
    const why = /<span id="reply-send-why"[^>]*>([^<]*)<\/span>/.exec(markup)?.[1];
    expect(why).toBe('');
    expect(markup).toMatch(/<button type="button" class="reply-button" disabled=""/);
  });
});
