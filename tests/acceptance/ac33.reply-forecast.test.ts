/**
 * AC33 답장 예측·위험 곡선·이번 주 요약 (SPEC v2.11 8-2장, 사람 결정 2026-11-11 20:40 — 계약·인수 테스트 변경 승인)
 *
 * 기대값 출처:
 * - 숫자 일치 조건: "AI 기본 초안일 때 예상 반응 막대의 기대 비용 = 답장 선택지 카드 비용 = 엔진의 기존 답장 기대 손실(서연 $36.80)"
 * - 가중치: config/reply-model.json (source "가정(기획 시안)"), backup·noRefund 없음
 * - 서연 보드(배송사 기록 반영 뒤): A2 통관 지연, 추적 있음 → recommend의 fight 기대 손실 3680¢ (AC18 1번과 같은 고정 가정값)
 *
 * 엔진 모듈(src/engine/forecast.ts, reply-features.ts)이 아직 없으면 이 파일의 시험은 건너뛴다 (T075가 만든다).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type {
  BoardState,
  DetectReplyFeaturesFn,
  EscalationSignals,
  ForecastReplyFn,
  RecommendFn,
  ReplyModelConfig,
  RiskCurveFn,
  WeeklySummaryFn,
  CaseEvent,
} from '@/types';
import { D1_JIHO, P, R, cause } from './boards';

const ROOT = path.resolve(__dirname, '../..');
const model = JSON.parse(readFileSync(path.join(ROOT, 'config/reply-model.json'), 'utf8')) as ReplyModelConfig;

type ForecastModule = { forecastReply: ForecastReplyFn; riskCurve: RiskCurveFn; weeklySummary: WeeklySummaryFn };
type FeatureModule = { detectReplyFeatures: DetectReplyFeaturesFn };
let fc: ForecastModule | null = null;
let ft: FeatureModule | null = null;
let recommend: RecommendFn;

beforeAll(async () => {
  recommend = (await import('@/engine/recommend')).recommend;
  // 경로를 변수로 두어 모듈이 없을 때 번들러가 미리 막지 않게 한다
  const f = '@/engine/forecast';
  const g = '@/engine/reply-features';
  fc = (await import(/* @vite-ignore */ f).catch(() => null)) as ForecastModule | null;
  ft = (await import(/* @vite-ignore */ g).catch(() => null)) as FeatureModule | null;
});

/** 서연 (배송사 기록 반영 뒤): $72, INR → A2 통관 지연, 추적 있음, 합의 단계 */
const SEOYEON_AFTER: BoardState = {
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
const SEOYEON_SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 400,
};
/** 시험용 대역 기본 초안 (AC18 6번 대역 글 v2.9 꼴, 토큰 채운 영어) */
const ANCHOR =
  'Hello Seo-yeon, sorry for the wait. Your sweater is at Korean customs, waiting for your personal customs code. ' +
  'Reply with it and I will pass it to the carrier right away. I will check with the carrier and contact you again by November 17. Hannah, Fernwood Knits';
const OTHER_ANCHOR = 'Sorry for the wait. I will check with the carrier.';
const BLAME = ' This is not our responsibility, please contact customs yourself.';

const skip = () => fc === null || ft === null;

describe('AC33 설정 (데이터만)', () => {
  it('source가 "가정(기획 시안)"이고 환불 약속 특징(backup·noRefund)이 없다', () => {
    expect(model.source).toBe('가정(기획 시안)');
    expect(Object.keys(model.features).sort()).toEqual(['apology', 'ask', 'blame', 'cause', 'date', 'lang', 'refundNow', 'vague'].sort());
    expect(JSON.stringify(model)).not.toMatch(/backup|noRefund/);
  });
});

describe('AC33 답장 예측 (엔진)', () => {
  it.skipIf(skip())('숫자 일치: 글 = 기본 초안이면 기대 비용 = recommend의 답장(fight) 기대 손실 3680¢', () => {
    const fight = recommend(SEOYEON_AFTER, P, R).all.find((e) => e.move === 'fight');
    expect(fight?.expectedLossCents).toBe(3680);
    const f = fc!.forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: SEOYEON_AFTER, signals: SEOYEON_SIGNALS, delayDays: 0 }, P, R, model);
    expect(f.expectedCostCents).toBe(3680);
  });

  it.skipIf(skip())('숫자 일치는 기본 초안이 무엇이든 성립한다 (AI 초안은 열 때마다 다르다)', () => {
    const f = fc!.forecastReply({ text: OTHER_ANCHOR, anchorText: OTHER_ANCHOR, board: SEOYEON_AFTER, signals: SEOYEON_SIGNALS, delayDays: 0 }, P, R, model);
    expect(f.expectedCostCents).toBe(3680);
  });

  it.skipIf(skip())('세 확률은 0..1이고 합이 1, 같은 입력이면 같은 결과', () => {
    const input = { text: ANCHOR, anchorText: ANCHOR, board: SEOYEON_AFTER, signals: SEOYEON_SIGNALS, delayDays: 0 };
    const a = fc!.forecastReply(input, P, R, model);
    const b = fc!.forecastReply(input, P, R, model);
    expect(a).toEqual(b);
    for (const p of [a.pWait, a.pRefund, a.pChargeback]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(a.pWait + a.pRefund + a.pChargeback).toBeCloseTo(1, 9);
    expect(['calm', 'okay', 'annoyed', 'angry']).toContain(a.moodBand);
  });

  it.skipIf(skip())('탓하는 문장을 더하면 차지백 위험과 기대 비용이 오른다', () => {
    const base = fc!.forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: SEOYEON_AFTER, signals: SEOYEON_SIGNALS, delayDays: 0 }, P, R, model);
    const worse = fc!.forecastReply({ text: ANCHOR + BLAME, anchorText: ANCHOR, board: SEOYEON_AFTER, signals: SEOYEON_SIGNALS, delayDays: 0 }, P, R, model);
    expect(worse.pChargeback).toBeGreaterThan(base.pChargeback);
    expect(worse.expectedCostCents).toBeGreaterThan(base.expectedCostCents);
  });

  it.skipIf(skip())('빈 글(답장 안 함)은 기본 초안보다 차지백 위험이 높다', () => {
    const base = fc!.forecastReply({ text: ANCHOR, anchorText: ANCHOR, board: SEOYEON_AFTER, signals: SEOYEON_SIGNALS, delayDays: 0 }, P, R, model);
    const none = fc!.forecastReply({ text: '', anchorText: ANCHOR, board: SEOYEON_AFTER, signals: SEOYEON_SIGNALS, delayDays: 0 }, P, R, model);
    expect(none.pChargeback).toBeGreaterThan(base.pChargeback);
  });

  it.skipIf(skip())('특징은 코드 규칙: 사과·원인·요청·날짜를 찾고, 환불 약속 특징은 없다', () => {
    const { features } = ft!.detectReplyFeatures(ANCHOR);
    expect(features.apology && features.cause && features.ask && features.date).toBe(true);
    expect(features.blame).toBe(false);
    expect(Object.keys(features)).not.toContain('backup');
    expect(ft!.detectReplyFeatures(ANCHOR + BLAME).features.blame).toBe(true);
  });
});

describe('AC33 위험 곡선·이번 주 요약 (엔진)', () => {
  const EVENTS: CaseEvent[] = [
    { at: '2026-10-18T00:00:00Z', kind: 'shipped', source: 'seed', text: 'Shipped' },
    { at: '2026-10-18T00:00:00Z', kind: 'tracking_missing', source: 'sandbox', text: 'No tracking in PayPal' },
    { at: '2026-10-30T00:00:00Z', kind: 'carrier_event', source: 'seed', text: 'Customs hold – recipient customs ID missing' },
    { at: '2026-11-02T00:00:00Z', kind: 'buyer_message', source: 'seed', text: 'Tracking has been stuck on customs hold for days.', flags: ['unanswered'] },
    { at: '2026-11-10T00:00:00Z', kind: 'dispute_opened', source: 'sandbox', text: 'Dispute opened', flags: ['threat', 'angry'] },
  ];

  it.skipIf(skip())('점은 사건 하나에 하나, 0..1, 같은 입력이면 같은 결과, 입력 사건을 그대로 따른다', () => {
    const a = fc!.riskCurve(EVENTS, SEOYEON_AFTER, P, R, model);
    expect(a).toEqual(fc!.riskCurve(EVENTS, SEOYEON_AFTER, P, R, model));
    expect(a).toHaveLength(EVENTS.length);
    a.forEach((pt, i) => {
      expect(pt.at).toBe(EVENTS[i].at);
      expect(pt.kind).toBe(EVENTS[i].kind);
      expect(pt.pChargeback).toBeGreaterThanOrEqual(0);
      expect(pt.pChargeback).toBeLessThanOrEqual(1);
    });
    // 위협·무응답이 쌓인 마지막 점이 첫 점보다 높다
    expect(a[a.length - 1].pChargeback).toBeGreaterThan(a[0].pChargeback);
  });

  it.skipIf(skip())('이번 주 요약: 열린 분쟁 수와 Σ(전액 환불 − 최선의 수)가 recommend와 맞는다', () => {
    const boards = [SEOYEON_AFTER, D1_JIHO];
    const s = fc!.weeklySummary({ boards, aiDrafts: 3, usesDemoData: true }, P, R);
    expect(s.openDisputes).toBe(2);
    expect(s.aiDrafts).toBe(3);
    expect(s.usesDemoData).toBe(true);
    const expected = boards.reduce((sum, b) => {
      const rec = recommend(b, P, R);
      const refund = rec.all.find((e) => e.move === 'refund')?.expectedLossCents ?? 0;
      return sum + (refund - (rec.best?.expectedLossCents ?? refund));
    }, 0);
    expect(s.keepableCents).toBe(expected);
  });
});
