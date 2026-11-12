/**
 * T092 단위 테스트: 시안 맞추기 C — Send 뒤 "What happens next · Simulated" (SPEC v2.15 8-4장, 시안 Desk.dc.html phase 'sent').
 *
 * 기대값 출처: `tasks/T092.md` "만들 것"·"모션"·"완료 기준", DECISIONS 2026-11-11 22:55 예외 목록.
 * **실호출 0회** — PayPal·AI·배송사 없음. 서버 액션은 가짜(spy), 서랍 기록기는 시험용으로 비운 뒤 0줄인지 본다.
 * 개발 서버 없음 (`renderToStaticMarkup`, 단계마다 `initial` 상태로 그린다). 숫자는 엔진 함수 결과와 비교만 한다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { copyTables, t } from '@/app/_shared/copy';
import { toDollarsRounded } from '@/app/_shared/money';
import { toPercentRounded } from '@/app/_shared/percent';
import { forecastReply, scenarioRisk } from '@/engine/forecast';
import { actionSavings } from '@/engine/savings';
import type { BoardState, EscalationSignals } from '@/types';

import { cause } from '../acceptance/boards';

vi.mock('server-only', () => ({}));
const sendSpy = vi.fn();
vi.mock('@/app/cases/actions', () => ({ sendReplyAction: (...args: unknown[]) => sendSpy(...args) }));
(globalThis as { React?: typeof React }).React = React;

const { CaseProgress } = await import('@/app/cases/progress/case-progress');
const model = await import('@/app/cases/progress/progress-model');
const client = await import('@/app/cases/progress/progress-client');
const activity = await import('@/app/_server/activity');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const SEOYEON: BoardState = {
  disputeId: 'PP-R-TEST-D2',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:00:00Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  hasTracking: true,
  hasDeliveredTracking: false,
  buyerPriorInrDisputes: 0,
  isDemo: false,
  cause: cause('A2', 1, 'rule'),
};
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 400,
};
const ANCHOR =
  'Hello Seo-yeon, sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. ' +
  'Reply with it and I will pass it to the carrier right away. I will check with the carrier and contact you again by November 17.';
const OUTGOING = '서연 님, 기다리게 해서 죄송해요. 스웨터가 한국 세관에서 개인통관고유부호를 기다리고 있어요.';
const INPUT = { text: ANCHOR, anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 1, translated: true };
const STEPS = ['sent', 'buyer_reply', 'forwarded', 'cleared'] as const;
const POINTS = scenarioRisk(INPUT, [...STEPS]);
const BASE = forecastReply(INPUT);

type State = { shown: 1 | 2 | 3 | 4; typing: boolean };
const STATES: State[] = [
  { shown: 1, typing: true },
  { shown: 2, typing: false },
  { shown: 3, typing: false },
  { shown: 4, typing: false },
];

function render(state: State, over: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(CaseProgress, {
      disputeId: SEOYEON.disputeId,
      live: false,
      language: 'Korean',
      buyerShort: 'Seo-yeon',
      sentText: OUTGOING,
      sentLocale: 'ko',
      scenarioInput: INPUT,
      baseForecast: BASE,
      onReplay: () => undefined,
      initial: state,
      ...over,
    }),
  );
}

/** 단계 줄 (`<li class="cprog-step" …>…</li>`) 하나씩. */
const stepsOf = (markup: string): string[] => markup.match(/<li class="cprog-step"[\s\S]*?<\/li>/g) ?? [];

// ───────────────────────────── 1. 순서 · Forward 전에는 멈춤 ─────────────────────────────

describe('완료 기준 1: Send(가짜) → 단계 순서대로, Forward 전에는 멈춤, 누르면 다음', () => {
  it('상태 기계: 시작 → (타이머) 손님 답장 → 멈춤 → [Forward] → (타이머) 세관 통과', () => {
    let s = model.PROGRESS_START;
    expect(s).toEqual({ shown: 1, typing: true });
    expect(model.progressRunning(s)).toBe(true);
    s = model.buyerReplied(s);
    expect(s).toEqual({ shown: 2, typing: false });
    expect(model.awaitingForward(s)).toBe(true);
    expect(model.progressRunning(s)).toBe(false);
    // 타이머가 와도 판매자가 누르기 전에는 그대로 (사람 결정 C: Auto 없음)
    expect(model.customsCleared(s)).toBe(s);
    expect(model.buyerReplied(s)).toBe(s);
    s = model.forwardToCarrier(s);
    expect(s.shown).toBe(3);
    expect(model.progressRunning(s)).toBe(true);
    expect(model.forwardToCarrier(s)).toBe(s);
    s = model.customsCleared(s);
    expect(s.shown).toBe(4);
    expect(model.progressFinished(s)).toBe(true);
    expect(model.progressRunning(s)).toBe(false);
  });

  it('화면: 단계마다 줄 순서가 시안 순서, [Forward to carrier]는 손님 답장 뒤에만 보이고 누른 뒤 사라진다', () => {
    const titles = [
      t('case.progress.sent.title', { language: 'Korean' }),
      t('case.progress.buyer.title', { name: 'Seo-yeon' }),
      t('case.progress.forwarded.title'),
      t('case.progress.cleared.title'),
    ];
    const button = `>${t('case.progress.forward.button')}</button>`;
    const counts = STATES.map((s) => stepsOf(render(s)).length);
    expect(counts).toEqual([1, 3, 3, 4]); // shown 2 = 보낸 답장 · 손님 답장 · 전달 대기 줄
    const m1 = render(STATES[0]);
    expect(m1).not.toContain(button);
    expect(m1).toContain('cprog-typing');
    const m2 = render(STATES[1]);
    expect(m2).toContain(button);
    expect(m2).toContain(t('case.progress.forward.title'));
    expect(m2).not.toContain('cprog-typing');
    expect(m2).not.toContain('cprog-running'); // 판매자를 기다릴 때는 점 세 개 없음
    const m4 = render(STATES[3]);
    expect(m4).not.toContain(button);
    const at = titles.map((title) => m4.indexOf(title));
    for (const index of at) expect(index).toBeGreaterThan(-1);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(m4).toContain(`>${t('case.progress.replay')}</button>`);
  });

  it('간격은 config/motion.json caseProgress (시안 1300 * (k - 1) + 400), 시안 파일 값과 같다', () => {
    const motion = model.progressMotion();
    const mockup = read('docs/design/mockup-v4/Desk.dc.html');
    expect(mockup).toContain(`}, ${motion.stepMs} * (k - 1) + ${motion.firstStepMs});`);
    expect(model.stepDelayMs(2)).toBe(motion.stepMs + motion.firstStepMs);
    const sec = (v: string) => v.replace(/^0\./, '.');
    expect(mockup).toContain(`.step{display:grid;grid-template-columns:34px minmax(0,1fr);gap:12px;animation:rise ${sec(motion.step.duration)} ${motion.step.easing} both}`);
    expect(mockup).toContain(`animation:ndot ${motion.typingDot.duration} infinite ${motion.typingDot.easing}`);
    expect(mockup).toContain(`.ndots span:nth-child(2){animation-delay:${sec(motion.typingDot.stagger)}}`);
    expect(mockup).toContain(`.flash{animation:flash ${motion.flash.duration} ${motion.flash.easing}}`);
    expect(mockup).toContain(`animation:rise ${sec(motion.toast.duration)} ${motion.toast.easing}}`);
    expect(mockup).toContain(`.rise{animation:rise ${sec(motion.bubble.duration)} ${motion.bubble.easing} both}`);
    expect(mockup).toContain(`}, ${motion.toast.hideMs}); }`);
  });

  it('css는 --cprog-* 변수만 쓰고(시간 값 직접 없음), 진행 칸이 보이면 선택지 카드·머리 줄을 숨긴다', () => {
    const css = strip(read('src/app/cases/progress/case-progress.css'));
    expect(css).not.toMatch(/(animation|transition)[^;:]*:[^;]*\b\d*\.?\d+m?s\b/);
    expect(css).toMatch(/\.cprog-step\s*\{[^}]*animation:\s*cprog-rise var\(--cprog-step\) both/);
    expect(css).toMatch(/\.cprog-flash\s*\{[^}]*animation:\s*cprog-flash var\(--cprog-flash\)/);
    expect(css).toMatch(/\.work:has\(\.cprog\) > \.desk-step/);
    const vars = model.progressMotionVars();
    expect(vars['--cprog-step']).toBe(`${model.progressMotion().step.duration} ${model.progressMotion().step.easing}`);
  });

  it('답장 칸: 보내기 성공(공개 모드 Simulated 포함) 뒤에만 진행 칸으로 바뀐다 (전환 지점 한 곳)', () => {
    const panel = strip(read('src/app/cases/reply/reply-panel.tsx'));
    expect(panel.match(/<CaseProgress\b/g)?.length).toBe(1);
    expect(panel).toMatch(/if \(sendState === 'done' && outcome !== null && outcome\.ok\) \{\s*return \(\s*<CaseProgress/);
  });
});

// ───────────────────────────── 2. 호출 0회 · 서랍 0줄 ─────────────────────────────

describe('완료 기준 2: 진행 중 PayPal 호출 0회, 서랍 기록 0줄', () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    activity.resetActivityForTest();
    sendSpy.mockReset();
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('모든 단계를 그리고 상태를 끝까지 돌려도 fetch·서버 액션 0회, PayPal activity 0줄', () => {
    for (const s of STATES) render(s);
    let s = model.PROGRESS_START;
    s = model.customsCleared(model.forwardToCarrier(model.buyerReplied(s)));
    expect(s.shown).toBe(4);
    client.scenarioRiskClient(INPUT);
    client.actionSavingsClient(SEOYEON, 'fight');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
    expect(activity.listActivity()).toEqual([]);
  });

  it('진행 칸 파일은 서버 액션·서랍·PayPal·fetch를 부르지 않는다, "POST carrier" 줄·Auto 단계 없음', () => {
    for (const file of ['case-progress.tsx', 'progress-model.ts', 'progress-client.ts']) {
      const source = strip(read(`src/app/cases/progress/${file}`));
      expect(source, file).not.toMatch(/from '[^']*(actions|activity|_server|paypal|@\/ai)[^']*'/);
      expect(source, file).not.toMatch(/\bfetch\(/);
    }
    for (const s of STATES) {
      const markup = render(s);
      expect(markup).not.toMatch(/POST|carrier\/customs|trackers|· 200/);
      expect(markup).not.toMatch(/>Auto</);
    }
    const copy = JSON.stringify(copyTables.en) + JSON.stringify(copyTables.ko);
    expect(copy).not.toMatch(/customs-clearance/);
  });
});

// ───────────────────────────── 3. 통관번호 가림 ─────────────────────────────

describe('완료 기준 3: 통관번호 원문이 DOM 어디에도 없음, 가린 꼴만', () => {
  it('maskCustomsIds: P + 숫자 → P•••••••9012 (가짜 번호도)', () => {
    expect(model.maskCustomsIds('P123456789012 보내드려요')).toBe('P•••••••9012 보내드려요');
    expect(model.hasRawCustomsId('P123456789012')).toBe(true);
    expect(model.hasRawCustomsId('P•••••••9012')).toBe(false);
  });

  it('모든 단계 화면·copy 파일에 원문 번호 없음, 손님 답장 문장 안에 가린 꼴', () => {
    for (const s of STATES) {
      const markup = render(s);
      expect(markup).not.toMatch(/P\d{8,}/);
      expect(markup).not.toContain('123456789012');
      if (s.shown >= 2) {
        expect(markup).toContain('P•••••••9012');
        expect(markup).toContain(model.buyerReplyText().original);
      }
    }
    for (const table of [copyTables.en, copyTables.ko]) {
      for (const value of Object.values(table)) expect(model.hasRawCustomsId(String(value))).toBe(false);
    }
  });
});

// ───────────────────────────── 4. 위험 % · Assumption · Simulated ─────────────────────────────

describe('완료 기준 4: 단계별 % = scenarioRisk, Assumption, 손님 답장부터 모든 단계에 Simulated', () => {
  it('제목 "What happens next · Simulated" + Assumption 배지', () => {
    const markup = render(STATES[0]);
    expect(copyTables.en['case.progress.title']).toBe('What happens next · Simulated');
    expect(markup).toContain(t('case.progress.title'));
    expect(markup).toContain(t('badge.assumption'));
  });

  it('단계 칩 = toPercentRounded(scenarioRisk) (보낸 답장 줄은 시안처럼 칩 없음)', () => {
    const steps = stepsOf(render(STATES[3]));
    const expected = [null, POINTS[1], POINTS[2], POINTS[3]].map((p) =>
      p === null ? null : t('case.progress.risk', { percent: toPercentRounded(p.pChargeback) }),
    );
    steps.forEach((step, index) => {
      const chip = step.match(/class="cprog-chip[^"]*"[^>]*>([^<]*)</)?.[1] ?? null;
      expect(chip, `step ${index}`).toBe(expected[index]);
    });
    // 엔진 기본 설정에서는 단계마다 내려간다 → 곡선 끝점도 같이
    expect(model.currentRisk(STATES[0], POINTS)).toBe(POINTS[0].pChargeback);
    expect(model.currentRisk(STATES[0], POINTS)).toBe(BASE.pChargeback);
    expect(model.currentRisk(STATES[3], POINTS)).toBe(POINTS[3].pChargeback);
    expect(model.currentRisk(STATES[1], null)).toBeNull();
  });

  it('엔진 값이 없으면 칩·Assumption 없음 (숫자를 지어내지 않는다)', () => {
    const markup = render(STATES[3], { scenarioInput: null });
    expect(markup).not.toContain('cprog-chip');
    expect(markup).not.toContain(t('badge.assumption'));
  });

  it('Simulated: 공개 모드는 모든 단계에, 녹화 모드는 Send만 빼고 모두', () => {
    const sim = `>${t('case.progress.simulated')}</span>`;
    for (const live of [false, true]) {
      const steps = stepsOf(render(STATES[3], { live }));
      expect(steps).toHaveLength(4);
      steps.forEach((step, index) => {
        expect(step.includes(sim), `live=${live} step ${index}`).toBe(index === 0 ? !live : true);
      });
    }
    // 대기 줄([Forward to carrier])도 Simulated
    const waiting = stepsOf(render(STATES[1], { live: true }));
    expect(waiting[2]).toContain(sim);
    // 손님 답장 말풍선: "Simulated reply" + Simulated
    const m = render(STATES[1]);
    expect(m).toContain(t('case.progress.simReply'));
    expect(m).toMatch(/cprog-bubble-sim/);
  });

  it('사건은 CaseEvent.source = simulated (실제 기록 아님). 녹화 모드 보낸 답장은 실제 기록이라 만들지 않는다', () => {
    const args = { points: POINTS, disputeId: 'D', language: 'Korean', buyerName: 'Seo-yeon', at: '2026-11-12T00:00:00.000Z' };
    const rows = model.stepRows({ ...args, state: STATES[3], live: false });
    expect(rows.map((row) => row.event?.source)).toEqual(['simulated', 'simulated', 'simulated', 'simulated']);
    expect(rows.map((row) => row.event?.kind)).toEqual(['seller_reply', 'buyer_message', 'carrier_event', 'carrier_event']);
    const liveRows = model.stepRows({ ...args, state: STATES[3], live: true });
    expect(liveRows[0].event).toBeNull();
    expect(model.stepRows({ ...args, state: STATES[1], live: false })[2].event).toBeNull(); // 대기 줄은 사건 아님
    expect(render(STATES[3])).toContain('data-source="simulated"');
  });

  it('이름을 모르면 대명사 없이 "The buyer"', () => {
    const markup = render(STATES[1], { buyerShort: null });
    expect(markup).toContain(t('case.progress.buyer.titleUnknown'));
    expect(t('case.progress.buyer.titleUnknown')).not.toMatch(/\b(she|her|he|his)\b/i);
  });
});

// ───────────────────────────── 5. 토스트 금액 · 문구 ─────────────────────────────

describe('토스트 금액 = 엔진 actionSavings, 문구는 copy (en=ko 키)', () => {
  it('어댑터는 엔진 값 그대로, 토스트 글자는 toDollarsRounded', () => {
    const cents = actionSavings(SEOYEON, 'fight');
    expect(client.actionSavingsClient(SEOYEON, 'fight')).toBe(cents);
    expect(client.scenarioRiskClient(INPUT)).toEqual(POINTS);
    expect(t('case.progress.toast', { amount: toDollarsRounded(cents) })).toContain(toDollarsRounded(cents));
  });

  it('새 키는 en·ko 둘 다 있다', () => {
    const keys = Object.keys(copyTables.en).filter((key) => key.startsWith('case.progress.'));
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) expect(copyTables.ko[key as keyof typeof copyTables.ko], key).toBeDefined();
  });
});
