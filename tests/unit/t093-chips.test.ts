/**
 * 단위 테스트 T093: replyFeatureEffects·scenarioRisk·actionSavings·trackingSavings·reply-snippets (SPEC v2.14 8-4장).
 */
import { describe, expect, it } from 'vitest';

import { forecastReply, replyFeatureEffects, replyModelFromConfig, riskCurve, scenarioRisk, appendSentence, removeSentence } from '@/engine/forecast';
import { paramsConfigFromFile } from '@/engine/params';
import { detectReplyFeatures } from '@/engine/reply-features';
import { recommend } from '@/engine/recommend';
import { actionSavings, trackingSavings } from '@/engine/savings';
import { expectedOrderLossCents, simulate } from '@/engine/sim';
import { replySnippetsFor, replySnippetsFromConfig } from '@/engine/snippets';
import type { BoardState, EscalationSignals, ReplyFeatureKey, ReplyModelConfig, ScenarioStepKind } from '@/types';

import { D1_JIHO, P, R, cause } from '../acceptance/boards';

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
const ANCHOR =
  'Hello Seo-yeon, sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. ' +
  'Reply with it and I will pass it to the carrier right away. I will check with the carrier and contact you again by November 17. Hannah, Fernwood Knits';
const RUSHED = 'Hi, the package is held at customs. That’s not our responsibility, please contact customs yourself. It should arrive soon.';

const fill = (s: string): string => s.replace('⟦BUYER_NAME_1⟧', 'Seo-yeon').replace('⟦DATE_1⟧', 'November 17');
const filledSnippets = (): Partial<Record<ReplyFeatureKey, string>> =>
  Object.fromEntries(Object.entries(replySnippetsFor('A2')).map(([k, v]) => [k, fill(v as string)]));

const input = (text: string, extra: object = {}) => ({ text, anchorText: ANCHOR, board: SEOYEON, signals: SIGNALS, delayDays: 1, ...extra });
const pcb = (text: string) => forecastReply(input(text), P, R, model).pChargeback;

describe('기존 함수 결과 무변경', () => {
  it('AC33 기본 초안 3680¢, fight 3680, refund 7400', () => {
    expect(forecastReply(input(ANCHOR), P, R, model).expectedCostCents).toBe(3680);
    const all = recommend(SEOYEON, P, R).all;
    expect(all.find((e) => e.move === 'fight')?.expectedLossCents).toBe(3680);
    expect(all.find((e) => e.move === 'refund')?.expectedLossCents).toBe(7400);
  });
  it('scenario 블록이 있는 설정과 없는 설정의 forecastReply·riskCurve가 같다', () => {
    const bare = { ...(model as ReplyModelConfig & { scenario?: unknown }) };
    delete bare.scenario;
    expect(forecastReply(input(RUSHED), P, R, bare as ReplyModelConfig)).toEqual(forecastReply(input(RUSHED), P, R, model));
    const ev = [{ at: '2026-11-08T00:00:00Z', kind: 'buyer_message' as const, source: 'seed' as const, text: 'x', flags: ['unanswered' as const] }];
    expect(riskCurve(ev, SEOYEON, P, R, bare as ReplyModelConfig)).toEqual(riskCurve(ev, SEOYEON, P, R, model));
  });
});

describe('replyFeatureEffects', () => {
  it('서연 기본 초안: good 칩 deltaPp 모두 ≤ 0, 없는 날짜는 missing 아님, refundNow 칩 없음', () => {
    const eff = replyFeatureEffects(input(ANCHOR), filledSnippets(), P, R, model);
    const good = eff.filter((e) => e.kind === 'good');
    expect(good.map((e) => e.key).sort()).toEqual(['apology', 'ask', 'cause', 'date'].sort());
    for (const e of good) {
      expect(e.deltaPp).toBeLessThanOrEqual(0);
      expect(typeof e.sentence).toBe('string');
      expect(ANCHOR.includes(e.sentence as string)).toBe(true);
    }
    expect(eff.some((e) => e.key === 'refundNow')).toBe(false);
    expect(eff.filter((e) => e.kind === 'missing')).toEqual([]);
  });

  it('good: deltaPp = (지금 − 문장 뺀 글) × 100', () => {
    const eff = replyFeatureEffects(input(ANCHOR), filledSnippets(), P, R, model);
    const date = eff.find((e) => e.key === 'date');
    expect(date).toBeDefined();
    const expected = (pcb(ANCHOR) - pcb(removeSentence(ANCHOR, date?.sentence as string))) * 100;
    expect(date?.deltaPp).toBeCloseTo(expected, 12);
    expect(date?.deltaPp).toBeLessThan(0);
  });

  it('rushed 글: bad 칩(blame·vague) deltaPp < 0, 빠진 것 넣으면 위험이 내려감', () => {
    const eff = replyFeatureEffects(input(RUSHED), filledSnippets(), P, R, model);
    const bad = eff.filter((e) => e.kind === 'bad');
    expect(bad.map((e) => e.key).sort()).toEqual(['blame', 'vague']);
    for (const e of bad) expect(e.deltaPp).toBeLessThan(0);
    const missing = eff.filter((e) => e.kind === 'missing');
    expect(missing.map((e) => e.key).sort()).toEqual(['apology', 'ask', 'date']);
    for (const e of missing) {
      expect(e.deltaPp).toBeLessThan(0);
      expect(e.deltaPp).toBeCloseTo((pcb(appendSentence(RUSHED, e.sentence as string)) - pcb(RUSHED)) * 100, 12);
    }
    // 빠진 것을 다 넣고 나쁜 문장을 다 빼면 처음보다 위험이 낮다
    let t = RUSHED;
    for (const e of bad) t = removeSentence(t, e.sentence as string);
    for (const e of missing) t = appendSentence(t, e.sentence as string);
    expect(pcb(t)).toBeLessThan(pcb(RUSHED));
  });

  it('lang: 있으면 good(특징 하나 끈 차이), 없으면 missing으로 내지 않음', () => {
    const tr = replyFeatureEffects(input(ANCHOR, { translated: true }), filledSnippets(), P, R, model);
    const lang = tr.find((e) => e.key === 'lang');
    expect(lang?.kind).toBe('good');
    expect(lang?.deltaPp).toBeLessThan(0);
    const en = replyFeatureEffects(input(RUSHED), { ...filledSnippets(), lang: 'x' }, P, R, model);
    expect(en.some((e) => e.key === 'lang')).toBe(false);
  });

  it('빈 글: 모두 missing, 같은 입력 같은 결과', () => {
    const a = replyFeatureEffects(input(''), filledSnippets(), P, R, model);
    expect(a.map((e) => e.kind)).toEqual(['missing', 'missing', 'missing', 'missing']);
    expect(a).toEqual(replyFeatureEffects(input(''), filledSnippets(), P, R, model));
  });
});

describe('scenarioRisk', () => {
  const STEPS: ScenarioStepKind[] = ['sent', 'buyer_reply', 'forwarded', 'cleared'];
  it('첫 점 = forecastReply, 0..1, 같은 입력 같은 결과', () => {
    for (const text of [ANCHOR, RUSHED, '']) {
      const pts = scenarioRisk(input(text), STEPS, P, R, model);
      expect(pts.map((p) => p.step)).toEqual(STEPS);
      expect(pts[0].pChargeback).toBe(pcb(text));
      for (const p of pts) {
        expect(p.pChargeback).toBeGreaterThanOrEqual(0);
        expect(p.pChargeback).toBeLessThanOrEqual(1);
      }
      expect(pts).toEqual(scenarioRisk(input(text), STEPS, P, R, model));
    }
  });
  it('기본 설정에서는 단계마다 내려간다 (설정값의 결과)', () => {
    const pts = scenarioRisk(input(ANCHOR), STEPS, P, R, model).map((p) => p.pChargeback);
    for (let i = 1; i < pts.length; i += 1) expect(pts[i]).toBeLessThan(pts[i - 1]);
  });
  it('설정을 바꾸면 그 값을 그대로 따른다 (단조를 강제하지 않음)', () => {
    const up = {
      ...model,
      scenario: { source: 't', steps: { sent: {}, buyer_reply: { shift: 1 }, forwarded: {}, cleared: {} } },
    } as unknown as ReplyModelConfig;
    const pts = scenarioRisk(input(ANCHOR), ['sent', 'buyer_reply'], P, R, up);
    expect(pts[1].pChargeback).toBeGreaterThan(pts[0].pChargeback);
  });
});

describe('actionSavings', () => {
  it('서연 fight 3720¢, refund 0, 막힌 offer 0', () => {
    expect(actionSavings(SEOYEON, 'fight', P, R)).toBe(3720);
    expect(actionSavings(SEOYEON, 'refund', P, R)).toBe(0);
    expect(recommend(SEOYEON, P, R).all.find((e) => e.move === 'offer')?.blockedBy).toBeDefined();
    expect(actionSavings(SEOYEON, 'offer', P, R)).toBe(0);
  });
  it('지호 offer = refund − offer 기대 손실 (0 이상)', () => {
    const all = recommend(D1_JIHO, P, R).all;
    const r = all.find((e) => e.move === 'refund')?.expectedLossCents as number;
    const o = all.find((e) => e.move === 'offer')?.expectedLossCents as number;
    expect(actionSavings(D1_JIHO, 'offer', P, R)).toBe(Math.max(0, r - o));
  });
});

describe('trackingSavings', () => {
  const config = paramsConfigFromFile();
  it('식: Σ(E[처방 없음] − E[tracking_24h]) 반올림, 모르는 SKU는 0, 빈 목록 0', () => {
    const orders = [
      { sku: 'FK-SW-NV', amountCents: 7200 },
      { sku: 'FK-CD-OAT', amountCents: 6800 },
      { sku: 'UNKNOWN', amountCents: 9999 },
    ];
    const one = (sku: string, a: number) => {
      const i = { sku, priceCents: a, stock: 1, rates: config.productRates[sku].value, fixes: [], futures: 0, seed: 0 };
      return expectedOrderLossCents(i, [], config, R) - expectedOrderLossCents(i, ['tracking_24h'], config, R);
    };
    expect(trackingSavings(orders, config, R)).toBe(Math.round(one('FK-SW-NV', 7200) + one('FK-CD-OAT', 6800)));
    expect(trackingSavings(orders, config, R)).toBeGreaterThan(0);
    expect(trackingSavings([], config, R)).toBe(0);
    expect(trackingSavings([{ sku: 'UNKNOWN', amountCents: 100 }], config, R)).toBe(0);
  });
  it('기대값 식이 시뮬레이션 평균과 같은 뜻 (재고 많을 때 평균 ≈ 재고 × 주문 1건 기대값)', () => {
    const rates = config.productRates['FK-CD-OAT'].value;
    const sim = simulate({ sku: 'FK-CD-OAT', priceCents: 6800, stock: 200, rates, fixes: [], futures: 500, seed: 7 }, config, R);
    const e = 200 * expectedOrderLossCents({ sku: 'FK-CD-OAT', priceCents: 6800, stock: 1, rates, fixes: [], futures: 0, seed: 0 }, [], config, R);
    expect(Math.abs(sim.before.meanLossCents - e) / e).toBeLessThan(0.1);
  });
});

describe('config/reply-snippets.json', () => {
  const file = replySnippetsFromConfig();
  const keys = ['apology', 'cause', 'ask', 'date'] as const;
  it('source 가정(기획 시안)', () => {
    expect(file.source).toBe('가정(기획 시안)');
  });
  for (const sub of [undefined, 'A2', 'B1'] as const) {
    it(`각 문장이 자기 특징으로 걸림, 숫자·환불·도착 약속 없음 (${sub ?? '기본'})`, () => {
      const s = replySnippetsFor(sub);
      for (const k of keys) {
        const raw = s[k] as string;
        expect(raw).toBeTypeOf('string');
        expect(detectReplyFeatures(fill(raw)).features[k]).toBe(true);
        // 자리표시자 토큰(⟦…_1⟧)을 뺀 글에 숫자·금액·환불·도착 약속이 없다
        expect(raw.replace(/⟦[A-Z_]+_\d+⟧/g, '')).not.toMatch(/\d|\$|refund|arriv|deliver|guarantee|promise/i);
      }
    });
  }
});
