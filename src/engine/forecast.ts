/**
 * 답장 예측·위험 곡선·이번 주 요약 (SPEC v2.11 8-2장, 계약 `src/types.ts` 9부). 작업 T075.
 *
 * 모델 (기획 시안 v4 꼴, 가중치는 `config/reply-model.json`에서만):
 *   z  = base(intercept + threat·카드사 언급 + unanswered·무응답 + tone·화난 어조) + delayPerDay·늦은 날 + Σ 특징 가중치 + c
 *   qz = refundSplit.intercept + Σ 나눔 가중치(vague·date·ask·cause·blame) + c
 *   pChargeback = σ(z), pRefund = (1 − pCB)·σ(qz) (refundNow면 refundNowShare), pWait = 나머지
 *   기대 비용 = pWait·t + pRefund·(A + t) + pCB·(A + f + t)      (A = board.amountCents, f·t = params)
 *
 * 보정 c (숫자 일치, AC33): 기준 초안(anchorText)의 기대 비용이 recommend의 fight 기대 손실과 같아지는 c를 이분법으로 찾는다.
 * c는 z와 qz에 함께 더한다. 그러면 기대 비용이 c에 대해 엄격히 증가하고 범위가 (t, A + f + t)라서
 * 0 < p_win < 1인 fight 손실 (1 − p_win)(A + f) + t는 기본 초안이 무엇이든 맞출 수 있다.
 * 입력 글은 같은 c 위에서 특징 가중치만큼 움직인다. fight가 없거나 막혔으면 c = 0 (보정 없음).
 *
 * 확률은 통계가 아니라 가정이다. `Math.random`·`Date.now`를 읽지 않는다 → 같은 입력이면 같은 결과.
 */
import { z as zod } from 'zod';

import replyModelJson from '../../config/reply-model.json';
import type {
  BoardState,
  CaseEvent,
  EscalationSignals,
  Evaluation,
  Params,
  PolicyConfig,
  ReplyFeatures,
  ReplyForecast,
  ReplyForecastInput,
  ReplyModelConfig,
  RiskCurveFn,
  RiskPoint,
  WeeklySummaryFn,
  ForecastReplyFn,
} from '@/types';

import { roundCents } from './oracle';
import { resolveEngineInput } from './params';
import { recommend } from './recommend';
import { detectReplyFeatures, noReplyFeatures, REPLY_FEATURE_KEYS } from './reply-features';

// ───────────────────────────── 설정 ─────────────────────────────

const weight = zod.number().finite();
const ReplyModelSchema = zod.object({
  version: zod.string(),
  source: zod.string(),
  note: zod.string().optional(),
  features: zod.object({
    apology: weight,
    cause: weight,
    ask: weight,
    date: weight,
    lang: weight,
    blame: weight,
    vague: weight,
    refundNow: weight,
  }),
  base: zod.object({ intercept: weight, threat: weight, unanswered: weight, tone: weight }),
  delayPerDay: weight,
  refundSplit: zod.object({
    intercept: weight,
    vague: weight,
    date: weight,
    ask: weight,
    cause: weight,
    blame: weight,
    refundNowShare: zod.number().min(0).max(1),
  }),
  mood: zod.object({
    wait: weight,
    refund: weight,
    refundNow: weight,
    chargeback: weight,
    calmFrom: weight,
    okayFrom: weight,
    annoyedFrom: weight,
  }),
});

/** `config/reply-model.json` 원본 (검증 전). */
export function replyModelFromConfig(): ReplyModelConfig {
  return replyModelJson as unknown as ReplyModelConfig;
}

function resolveModel(model?: ReplyModelConfig): ReplyModelConfig {
  return ReplyModelSchema.parse(model ?? replyModelFromConfig()) as ReplyModelConfig;
}

/** 나눔 식(refundSplit)에 쓰는 특징. */
const SPLIT_KEYS = ['vague', 'date', 'ask', 'cause', 'blame'] as const;

/** 이분법 범위와 횟수 (알고리즘 상수 — 가정값이 아니다). σ(±60) ≈ 1e-26이라 양 끝에서 비용이 센트 단위로 수렴한다. */
const CALIBRATION_BOUND = 60;
const BISECTION_STEPS = 200;

// ───────────────────────────── 핵심 계산 ─────────────────────────────

/** 모델에 들어가는 상황 (특징 제외). */
type Situation = { threat: boolean; unanswered: boolean; tone: boolean; delayDays: number };

type Costs = { amountCents: number; feeCents: number; timeCostCents: number };

type Core = {
  pWait: number;
  pRefund: number;
  pChargeback: number;
  cost: number;
  parts: ReplyForecast['parts'];
};

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** 늦은 날 수: 유한한 0 이상 값만 (음수·NaN은 0). */
function cleanDelay(days: number): number {
  return Number.isFinite(days) && days > 0 ? days : 0;
}

function situationFromSignals(signals: EscalationSignals, delayDays: number): Situation {
  return {
    threat: signals.mentionsCardCompany === true,
    unanswered: signals.secondMessageUnanswered === true || signals.unansweredOver24h === true,
    tone: signals.angryTone === true,
    delayDays: cleanDelay(delayDays),
  };
}

/** z의 상황 부분 (보정·특징 제외)과 그 항목들. */
function baseLogit(situation: Situation, model: ReplyModelConfig): { z: number; parts: ReplyForecast['parts'] } {
  const parts: ReplyForecast['parts'] = [{ key: 'intercept', weight: model.base.intercept }];
  if (situation.threat) parts.push({ key: 'threat', weight: model.base.threat });
  if (situation.unanswered) parts.push({ key: 'unanswered', weight: model.base.unanswered });
  if (situation.tone) parts.push({ key: 'tone', weight: model.base.tone });
  if (situation.delayDays > 0) parts.push({ key: 'delay', weight: model.delayPerDay * situation.delayDays });
  return { z: parts.reduce((s, p) => s + p.weight, 0), parts };
}

/** 특징 → 확률·비용. 빈 글(답장 안 함)은 noReplyFeatures()로 들어온다. */
function core(features: ReplyFeatures, situation: Situation, c: number, costs: Costs, model: ReplyModelConfig): Core {
  const base = baseLogit(situation, model);
  const parts = [...base.parts];
  let z = base.z;
  for (const key of REPLY_FEATURE_KEYS) {
    if (!features[key]) continue;
    z += model.features[key];
    parts.push({ key, weight: model.features[key] });
  }
  z += c;
  parts.push({ key: 'calibration', weight: c });

  let qz = model.refundSplit.intercept + c;
  for (const key of SPLIT_KEYS) if (features[key]) qz += model.refundSplit[key];

  const pChargeback = sigmoid(z);
  const share = features.refundNow ? model.refundSplit.refundNowShare : sigmoid(qz);
  const pRefund = (1 - pChargeback) * share;
  const pWait = Math.max(0, 1 - pChargeback - pRefund);

  const { amountCents: a, feeCents: f, timeCostCents: t } = costs;
  const cost = pWait * t + pRefund * (a + t) + pChargeback * (a + f + t);
  return { pWait, pRefund, pChargeback, cost, parts };
}

/**
 * 보정 c: core(anchorFeatures, c).cost = target 인 c (이분법). 비용은 c에 대해 증가한다.
 * 범위 밖 목표(예: 기본 초안에 refundNow가 있어 하한이 높을 때)는 가까운 끝으로 붙는다.
 */
function solveCalibration(anchor: ReplyFeatures, situation: Situation, target: number, costs: Costs, model: ReplyModelConfig): number {
  let lo = -CALIBRATION_BOUND;
  let hi = CALIBRATION_BOUND;
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    const mid = (lo + hi) / 2;
    if (core(anchor, situation, mid, costs, model).cost < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function featuresOf(text: string, translated: boolean | undefined): ReplyFeatures {
  if (typeof text !== 'string' || text.trim() === '') return noReplyFeatures();
  return detectReplyFeatures(text, { translated }).features;
}

function moodOf(core: Core, refundNow: boolean, model: ReplyModelConfig): { mood: number; moodBand: ReplyForecast['moodBand'] } {
  const m = model.mood;
  const mood = m.wait * core.pWait + (refundNow ? m.refundNow : m.refund) * core.pRefund + m.chargeback * core.pChargeback;
  const moodBand = mood >= m.calmFrom ? 'calm' : mood >= m.okayFrom ? 'okay' : mood >= m.annoyedFrom ? 'annoyed' : 'angry';
  return { mood, moodBand };
}

/** fight 평가의 기대 손실 (보정 목표). 없거나 막혔으면 null. */
function fightTarget(all: Evaluation[]): number | null {
  const fight = all.find((e) => e.move === 'fight');
  if (!fight || fight.blockedBy !== undefined || fight.expectedLossCents === null) return null;
  return fight.expectedLossCents;
}

/** 계약 밖 선택 필드: 글이 보낼 때 구매자 언어로 번역되면 true (`lang` 특징). */
export type ForecastInputExtra = { translated?: boolean };

type Prepared = {
  situation: Situation;
  costs: Costs;
  model: ReplyModelConfig;
  calibration: number;
  calibrated: boolean;
  recommendation: ReturnType<typeof recommend>;
  anchorFeatures: ReplyFeatures;
};

function prepare(
  input: Omit<ReplyForecastInput, 'text'> & ForecastInputExtra,
  params?: Params,
  rules?: PolicyConfig,
  model?: ReplyModelConfig,
): Prepared {
  const engine = resolveEngineInput(input.board, params, rules);
  const m = resolveModel(model);
  const recommendation = recommend(engine.board, engine.params, engine.rules);
  const situation = situationFromSignals(input.signals, input.delayDays);
  const costs: Costs = {
    amountCents: engine.board.amountCents,
    feeCents: engine.params.feeCents,
    timeCostCents: engine.params.timeCostCents,
  };
  const anchorFeatures = featuresOf(input.anchorText, input.translated);
  const target = fightTarget(recommendation.all);
  const calibration = target === null ? 0 : solveCalibration(anchorFeatures, situation, target, costs, m);
  return { situation, costs, model: m, calibration, calibrated: target !== null, recommendation, anchorFeatures };
}

function toForecast(c: Core, features: ReplyFeatures, model: ReplyModelConfig): ReplyForecast {
  return {
    pWait: c.pWait,
    pRefund: c.pRefund,
    pChargeback: c.pChargeback,
    expectedCostCents: roundCents(c.cost),
    ...moodOf(c, features.refundNow, model),
    parts: c.parts,
  };
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * 답장 하나의 예측. `text === anchorText`면 expectedCostCents = recommend(board)의 fight 기대 손실 (AC33).
 * 비용은 센트로 사사오입(`roundCents`)한다. 보정 항은 `parts`의 `calibration` (fight가 없으면 0).
 */
export const forecastReply = ((input: ReplyForecastInput & ForecastInputExtra, params?: Params, rules?: PolicyConfig, model?: ReplyModelConfig) => {
  const p = prepare(input, params, rules, model);
  const features = featuresOf(input.text, input.translated);
  return toForecast(core(features, p.situation, p.calibration, p.costs, p.model), features, p.model);
}) satisfies ForecastReplyFn;

/** 이 입력의 보정 상수 (위험 곡선에 같은 보정을 넘길 때 쓴다). fight가 없으면 0. */
export function replyCalibration(
  input: Omit<ReplyForecastInput, 'text'> & ForecastInputExtra,
  params?: Params,
  rules?: PolicyConfig,
  model?: ReplyModelConfig,
): number {
  return prepare(input, params, rules, model).calibration;
}

/** 선택지 카드 한 장. expectedLossCents는 recommend 값 그대로 (막혔으면 null, pChargeback도 null). */
export type MoveForecast = {
  move: Evaluation['move'];
  expectedLossCents: number | null;
  pChargeback: number | null;
  blockedBy?: string;
};

/**
 * 수별 예상 차지백 위험 (계약 밖, 화면의 선택지 카드용). 순서·개수는 recommend(board).all 그대로.
 * - fight: 기본 초안(anchorText)의 pChargeback.
 * - refund: 기본 초안 특징 + refundNow (전액 환불하고 알린다).
 * - offer: 수락되면 해결(차지백 없음), 거절되면 fight로 간다 → (1 − p_acc) × fight의 pChargeback.
 */
export function forecastMoves(
  input: Omit<ReplyForecastInput, 'text'> & ForecastInputExtra,
  params?: Params,
  rules?: PolicyConfig,
  model?: ReplyModelConfig,
): MoveForecast[] {
  const p = prepare(input, params, rules, model);
  const pAccept = resolveEngineInput(input.board, params, rules).params.pAccept;
  const fightP = core(p.anchorFeatures, p.situation, p.calibration, p.costs, p.model).pChargeback;
  const refundP = core({ ...p.anchorFeatures, refundNow: true }, p.situation, p.calibration, p.costs, p.model).pChargeback;
  return p.recommendation.all.map((e) => {
    const blocked = e.blockedBy !== undefined || e.expectedLossCents === null;
    const pChargeback = blocked ? null : e.move === 'fight' ? fightP : e.move === 'refund' ? refundP : (1 - pAccept) * fightP;
    return {
      move: e.move,
      expectedLossCents: e.expectedLossCents,
      pChargeback,
      ...(e.blockedBy !== undefined ? { blockedBy: e.blockedBy } : {}),
    };
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 위험 곡선. 사건 i의 점 = events[0..i]만 보고 같은 모델(답장 특징 없음)로 본 pChargeback.
 * - threat·angry: 그때까지 한 번이라도 표시되면 켜짐.
 * - unanswered: 'unanswered' 표시가 있는 구매자 메시지 뒤에 판매자 답장(seller_reply)이 없으면 켜짐.
 *   늦은 날 수 = 그 메시지(답이 없는 것 중 가장 이른 것)부터 사건 i까지 지난 온전한 날 수.
 * - 추적 없음(tracking_missing): config/reply-model.json에 가중치가 없어 위험에 넣지 않는다.
 * 보정: 계약 밖 선택 인자 `opts.calibration` (forecastReply의 parts `calibration` 값을 넘기면 같은 보정). 없으면 0.
 * 사건을 더하거나 빼지 않는다 (순서·개수 그대로).
 */
export const riskCurve = ((
  events: CaseEvent[],
  board: BoardState,
  params?: Params,
  rules?: PolicyConfig,
  model?: ReplyModelConfig,
  opts?: { calibration?: number },
): RiskPoint[] => {
  const engine = resolveEngineInput(board, params, rules);
  const m = resolveModel(model);
  const costs: Costs = { amountCents: engine.board.amountCents, feeCents: engine.params.feeCents, timeCostCents: engine.params.timeCostCents };
  const c = Number.isFinite(opts?.calibration) ? (opts?.calibration as number) : 0;

  let threat = false;
  let tone = false;
  let unansweredSince: number | null = null;
  return events.map((ev) => {
    const at = Date.parse(ev.at);
    const flags = ev.flags ?? [];
    if (flags.includes('threat')) threat = true;
    if (flags.includes('angry')) tone = true;
    if (ev.kind === 'seller_reply') unansweredSince = null;
    if (flags.includes('unanswered') && unansweredSince === null && Number.isFinite(at)) unansweredSince = at;
    const delayDays = unansweredSince !== null && Number.isFinite(at) ? Math.floor(Math.max(0, at - unansweredSince) / DAY_MS) : 0;
    const situation: Situation = { threat, tone, unanswered: unansweredSince !== null, delayDays };
    return { at: ev.at, kind: ev.kind, pChargeback: core(noReplyFeatures(), situation, c, costs, m).pChargeback };
  });
}) satisfies RiskCurveFn;

/**
 * 이번 주 요약. keepableCents = Σ(refund 평가 기대 손실 − best 기대 손실).
 * refund 평가가 없거나 막힌 분쟁, best가 없는 분쟁은 0을 더한다 (계산할 수 없는 값을 지어내지 않는다).
 */
export const weeklySummary: WeeklySummaryFn = (input, params, rules) => {
  const keepableCents = input.boards.reduce((sum, board) => {
    const rec = recommend(board, params, rules);
    const refund = rec.all.find((e) => e.move === 'refund')?.expectedLossCents ?? null;
    const best = rec.best?.expectedLossCents ?? null;
    if (refund === null || best === null) return sum;
    return sum + (refund - best);
  }, 0);
  return {
    openDisputes: input.boards.length,
    keepableCents,
    aiDrafts: input.aiDrafts,
    usesDemoData: input.usesDemoData,
  };
};
