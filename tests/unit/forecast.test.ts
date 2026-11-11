/**
 * 단위 테스트: forecastReply·forecastMoves·riskCurve·weeklySummary (SPEC v2.11 8-2장). 작업 T075.
 *
 * 첫 묶음은 AC33(tests/acceptance/ac33.reply-forecast.test.ts)의 단정을 정적 import로 다시 돈다.
 * (AC33 파일은 `it.skipIf(skip())`가 수집 시점에 평가되어 beforeAll의 동적 import 전에 늘 건너뛴다 — 보고서 참고)
 */
import { describe, expect, it } from 'vitest';

import { forecastMoves, forecastReply, replyCalibration, replyModelFromConfig, riskCurve, weeklySummary } from '@/engine/forecast';
import { detectReplyFeatures } from '@/engine/reply-features';
import { recommend } from '@/engine/recommend';
import type { BoardState, CaseEvent, EscalationSignals, ReplyModelConfig } from '@/types';

import { D1_JIHO, D3_BUYER_M, P, R, cause } from '../acceptance/boards';

const model: ReplyModelConfig = replyModelFromConfig();

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
const CALM: EscalationSignals = {
  mentionsCardCompany: false,
  secondMessageUnanswered: false,
  unansweredOver24h: false,
  angryTone: false,
  hoursToDue: 400,
};
const ANCHOR =
  'Hello Seo-yeon, sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. ' +
  'Reply with it and I will pass it to the carrier right away. I will check with the carrier and contact you again by November 17. Hannah, Fernwood Knits';
const BLAME = ' This is not our responsibility, please contact customs yourself.';

const ANCHORS = [
  ANCHOR,
  'Sorry for the wait. I will check with the carrier.',
  'It should arrive soon.',
  'This is not our fault. Contact customs yourself. It will arrive eventually.',
  '안녕하세요 서연님, 기다리게 해서 죄송합니다. 세관에서 통관번호를 기다리고 있어요. 11월 17일까지 다시 연락드릴게요.',
  'Hi.',
  '',
  'x'.repeat(5000),
];

const fightLoss = (b: BoardState) => recommend(b, P, R).all.find((e) => e.move === 'fight')?.expectedLossCents;

describe('AC33 단정 재실행 (정적 import)', () => {
  const input = { text: ANCHOR, anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 0 };

  it('기본 초안이면 기대 비용 = fight 3680¢', () => {
    expect(fightLoss(SEOYEON)).toBe(3680);
    expect(forecastReply(input, P, R, model).expectedCostCents).toBe(3680);
  });

  it('세 확률 0..1, 합 1, 같은 입력 같은 결과', () => {
    const a = forecastReply(input, P, R, model);
    expect(a).toEqual(forecastReply(input, P, R, model));
    for (const p of [a.pWait, a.pRefund, a.pChargeback]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(a.pWait + a.pRefund + a.pChargeback).toBeCloseTo(1, 9);
    expect(['calm', 'okay', 'annoyed', 'angry']).toContain(a.moodBand);
  });

  it('탓하기를 더하면 위험·비용이 오르고, 빈 글은 기본 초안보다 위험이 높다', () => {
    const base = forecastReply(input, P, R, model);
    const worse = forecastReply({ ...input, text: ANCHOR + BLAME }, P, R, model);
    const none = forecastReply({ ...input, text: '' }, P, R, model);
    expect(worse.pChargeback).toBeGreaterThan(base.pChargeback);
    expect(worse.expectedCostCents).toBeGreaterThan(base.expectedCostCents);
    expect(none.pChargeback).toBeGreaterThan(base.pChargeback);
  });

  it('위험 곡선: 사건 하나에 점 하나, 마지막 점이 첫 점보다 높다', () => {
    const events: CaseEvent[] = [
      { at: '2026-10-18T00:00:00Z', kind: 'shipped', source: 'seed', text: 'Shipped' },
      { at: '2026-10-18T00:00:00Z', kind: 'tracking_missing', source: 'sandbox', text: 'No tracking in PayPal' },
      { at: '2026-10-30T00:00:00Z', kind: 'carrier_event', source: 'seed', text: 'Customs hold' },
      { at: '2026-11-02T00:00:00Z', kind: 'buyer_message', source: 'seed', text: 'stuck', flags: ['unanswered'] },
      { at: '2026-11-10T00:00:00Z', kind: 'dispute_opened', source: 'sandbox', text: 'Dispute opened', flags: ['threat', 'angry'] },
    ];
    const a = riskCurve(events, SEOYEON, P, R, model);
    expect(a).toEqual(riskCurve(events, SEOYEON, P, R, model));
    expect(a).toHaveLength(events.length);
    a.forEach((pt, i) => {
      expect(pt.at).toBe(events[i].at);
      expect(pt.kind).toBe(events[i].kind);
    });
    expect(a[a.length - 1].pChargeback).toBeGreaterThan(a[0].pChargeback);
  });
});

describe('보정 (숫자 일치)', () => {
  it.each(ANCHORS.map((a, i) => [i, a]))('기본 초안 %i번에서도 정확히 3680', (_i, anchor) => {
    for (const delayDays of [0, 2, 7]) {
      const f = forecastReply({ text: anchor, anchorText: anchor, board: SEOYEON, signals: SIGNALS, delayDays }, P, R, model);
      expect(f.expectedCostCents).toBe(3680);
    }
  });

  it('신호가 조용한 상황·번역 표시가 있어도 맞는다', () => {
    for (const translated of [false, true]) {
      const f = forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: SEOYEON, signals: CALM, delayDays: 0, translated }, P, R, model);
      expect(f.expectedCostCents).toBe(3680);
    }
  });

  it('지호(B1, 제안이 최선) 보드에서도 fight 손실과 맞고 함수가 깨지지 않는다', () => {
    const fight = fightLoss(D1_JIHO);
    const f = forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: D1_JIHO, signals: SIGNALS, delayDays: 1 }, P, R, model);
    expect(f.expectedCostCents).toBe(fight);
    expect(recommend(D1_JIHO, P, R).best?.move).toBe('offer');
  });

  it('보정 항은 parts의 calibration이고 replyCalibration과 같다', () => {
    const input = { anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 0 };
    const f = forecastReply({ ...input, text: 'anything' }, P, R, model);
    const part = f.parts.find((p) => p.key === 'calibration');
    expect(part?.weight).toBe(replyCalibration(input, P, R, model));
  });

  it('fight가 없는 보드는 보정하지 않는다 (calibration 0)', () => {
    const noFight: BoardState = { ...SEOYEON, allowedMoves: ['accept_claim'] };
    const f = forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: noFight, signals: SIGNALS, delayDays: 0 }, P, R, model);
    expect(f.parts.find((p) => p.key === 'calibration')?.weight).toBe(0);
    expect(f.pWait + f.pRefund + f.pChargeback).toBeCloseTo(1, 9);
  });

  it('원인 없는 보드(NO_CAUSE)도 예외 없이 보정 없이 계산한다', () => {
    const noCause: BoardState = { ...SEOYEON, cause: undefined };
    const f = forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: noCause, signals: SIGNALS, delayDays: 0 }, P, R, model);
    expect(f.parts.find((p) => p.key === 'calibration')?.weight).toBe(0);
  });

  it('좋은 특징을 더하면 위험이 내려간다 (같은 보정 위에서)', () => {
    const anchor = 'Sorry for the wait.';
    const base = forecastReply({ text: anchor, anchorText: anchor, board: SEOYEON, signals: SIGNALS, delayDays: 0 }, P, R, model);
    const better = forecastReply(
      { text: anchor + ' Please send your customs code. I will update you by Nov. 17.', anchorText: anchor, board: SEOYEON, signals: SIGNALS, delayDays: 0 },
      P,
      R,
      model,
    );
    expect(better.pChargeback).toBeLessThan(base.pChargeback);
    expect(better.expectedCostCents).toBeLessThan(base.expectedCostCents);
  });

  it('늦은 날 수는 같은 보정 위에서 빈 글 위험을 올린다; 음수·NaN은 0으로 본다', () => {
    const mk = (delayDays: number) =>
      forecastReply({ text: '', anchorText: ANCHOR, board: SEOYEON, signals: CALM, delayDays }, P, R, model);
    expect(mk(-3)).toEqual(mk(0));
    expect(mk(Number.NaN)).toEqual(mk(0));
  });
});

describe('mood', () => {
  it('시안 식 그대로: mood = wait·pW + refund·pR + chargeback·pCB, 띠는 설정 경계', () => {
    const f = forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 0 }, P, R, model);
    const m = model.mood;
    expect(f.mood).toBeCloseTo(m.wait * f.pWait + m.refund * f.pRefund + m.chargeback * f.pChargeback, 12);
    const band = f.mood >= m.calmFrom ? 'calm' : f.mood >= m.okayFrom ? 'okay' : f.mood >= m.annoyedFrom ? 'annoyed' : 'angry';
    expect(f.moodBand).toBe(band);
  });

  it('refundNow면 환불 몫이 refundNowShare 비율이고 mood에 refundNow 가중치를 쓴다', () => {
    const text = 'I have refunded the full amount.';
    const f = forecastReply({ text, anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 0 }, P, R, model);
    expect(f.pRefund / (1 - f.pChargeback)).toBeCloseTo(model.refundSplit.refundNowShare, 12);
    const m = model.mood;
    expect(f.mood).toBeCloseTo(m.wait * f.pWait + m.refundNow * f.pRefund + m.chargeback * f.pChargeback, 12);
  });

  it('가중치는 모델 인자에서 온다 (설정을 바꾸면 결과가 바뀐다)', () => {
    const changed: ReplyModelConfig = { ...model, features: { ...model.features, blame: model.features.blame + 2 } };
    const input = { text: ANCHOR + BLAME, anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 0 };
    expect(forecastReply(input, P, R, changed).pChargeback).toBeGreaterThan(forecastReply(input, P, R, model).pChargeback);
  });
});

describe('forecastMoves (선택지 카드)', () => {
  for (const [name, board] of [
    ['서연', SEOYEON],
    ['지호', D1_JIHO],
    ['buyer_m', D3_BUYER_M],
  ] as const) {
    it(`${name}: 기대 손실은 recommend 그대로, 순서·개수 같음`, () => {
      const rec = recommend(board, P, R);
      const moves = forecastMoves({ anchorText: ANCHOR, board, signals: SIGNALS, delayDays: 0 }, P, R, model);
      expect(moves.map((m) => m.move)).toEqual(rec.all.map((e) => e.move));
      expect(moves.map((m) => m.expectedLossCents)).toEqual(rec.all.map((e) => e.expectedLossCents));
      for (const m of moves) {
        if (m.pChargeback === null) continue;
        expect(m.pChargeback).toBeGreaterThanOrEqual(0);
        expect(m.pChargeback).toBeLessThanOrEqual(1);
      }
    });
  }

  it('규칙: fight = 기본 초안 위험, offer = (1 − p_acc)·fight, refund < fight', () => {
    const input = { anchorText: ANCHOR, board: D1_JIHO, signals: SIGNALS, delayDays: 0 };
    const moves = forecastMoves(input, P, R, model);
    const by = (k: string) => moves.find((m) => m.move === k)!;
    const anchorP = forecastReply({ ...input, text: ANCHOR }, P, R, model).pChargeback;
    expect(by('fight').pChargeback).toBe(anchorP);
    expect(by('offer').pChargeback).toBeCloseTo((1 - P.pAccept) * anchorP, 12);
    expect(by('refund').pChargeback!).toBeLessThan(anchorP);
  });

  it('막힌 수(서연 offer = OFFER_SCOPE)는 pChargeback null', () => {
    const moves = forecastMoves({ anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 0 }, P, R, model);
    const offer = moves.find((m) => m.move === 'offer');
    expect(offer?.blockedBy).toBe('OFFER_SCOPE');
    expect(offer?.pChargeback).toBeNull();
  });
});

describe('riskCurve 세부', () => {
  const base: CaseEvent = { at: '2026-11-01T00:00:00Z', kind: 'buyer_message', source: 'seed', text: 'x', flags: ['unanswered'] };

  it('빈 사건이면 빈 곡선', () => {
    expect(riskCurve([], SEOYEON, P, R, model)).toEqual([]);
  });

  it('답이 없는 날이 늘면 위험이 오르고, 판매자 답장이 무응답·늦음을 지운다', () => {
    const ev: CaseEvent[] = [
      base,
      { at: '2026-11-04T00:00:00Z', kind: 'carrier_event', source: 'seed', text: 'y' },
      { at: '2026-11-05T00:00:00Z', kind: 'seller_reply', source: 'sandbox', text: 'z' },
    ];
    const [a, b, c] = riskCurve(ev, SEOYEON, P, R, model);
    expect(b.pChargeback).toBeGreaterThan(a.pChargeback);
    expect(c.pChargeback).toBeLessThan(a.pChargeback);
  });

  it('opts.calibration을 넘기면 같은 보정으로 곡선을 그린다 (마지막 점 = 같은 상황의 빈 글 위험)', () => {
    const c = replyCalibration({ anchorText: ANCHOR, board: SEOYEON, signals: CALM, delayDays: 0 }, P, R, model);
    const pts = riskCurve([{ ...base, flags: [] }], SEOYEON, P, R, model, { calibration: c });
    const none = forecastReply({ text: '', anchorText: ANCHOR, board: SEOYEON, signals: CALM, delayDays: 0 }, P, R, model);
    expect(pts[0].pChargeback).toBeCloseTo(none.pChargeback, 12);
  });

  it('입력 사건을 바꾸지 않는다', () => {
    const ev: CaseEvent[] = [base];
    const copy = JSON.parse(JSON.stringify(ev));
    riskCurve(ev, SEOYEON, P, R, model);
    expect(ev).toEqual(copy);
  });
});

describe('weeklySummary', () => {
  it('Σ(refund − best), 입력 그대로 옮기는 값', () => {
    const s = weeklySummary({ boards: [SEOYEON, D1_JIHO, D3_BUYER_M], aiDrafts: 5, usesDemoData: false }, P, R);
    const expected = [SEOYEON, D1_JIHO, D3_BUYER_M].reduce((sum, b) => {
      const rec = recommend(b, P, R);
      return sum + (rec.all.find((e) => e.move === 'refund')!.expectedLossCents! - rec.best!.expectedLossCents!);
    }, 0);
    expect(s).toEqual({ openDisputes: 3, keepableCents: expected, aiDrafts: 5, usesDemoData: false });
  });

  it('refund가 없거나 원인이 없는 분쟁은 0을 더한다', () => {
    const noRefund: BoardState = { ...SEOYEON, allowedMoves: ['send_message'] };
    const noCause: BoardState = { ...SEOYEON, cause: undefined };
    expect(weeklySummary({ boards: [noRefund, noCause], aiDrafts: 0, usesDemoData: true }, P, R).keepableCents).toBe(0);
    expect(weeklySummary({ boards: [], aiDrafts: 0, usesDemoData: false }, P, R).openDisputes).toBe(0);
  });
});

describe('특징 판정이 forecast에 들어간다', () => {
  it('기본 초안 특징 = detectReplyFeatures 결과', () => {
    const { features } = detectReplyFeatures(ANCHOR);
    const f = forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 0 }, P, R, model);
    const keys = f.parts.map((p) => p.key);
    for (const [k, on] of Object.entries(features)) expect(keys.includes(k as never)).toBe(on);
  });
});
