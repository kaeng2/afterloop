/**
 * 새 상품 등록 전 점검 (Scene 3, SPEC v2.12 8-3장). 작업 T085.
 *
 * 브라우저에서도 돈다: 순수 함수만 두고 node 전용 모듈(fs 등)·서버 코드를 import하지 않는다.
 * 모델 값은 `config/listing-model.json`, 수수료·시간 비용·환불 몫은 `config/params.json`에서만 온다.
 *
 * 시뮬레이션 절차 (SPEC 8-3장 고정 — AC34 숫자가 여기에 묶인다):
 * 난수 = mulberry32(seedBase + units) 하나. run → 주문 o → 유형 j 순서로 매번 u, v, w 3개를 뽑는다
 * (이미 분쟁이 난 주문에서도 뽑는다). 아직 분쟁이 없고 u < q[k]면 분쟁 1건:
 * v < refundShare면 price + t, 아니면 w < 승률이면 t, 아니면 price + f + t. 실수 그대로 비교.
 */
import { z } from 'zod';

import listingModelJson from '../../config/listing-model.json';
import paramsConfigJson from '../../config/params.json';
import { mulberry32 } from './rng';
import type {
  CheckListingFn,
  CreateListingSimFn,
  DetectListingFeaturesFn,
  ListingCheckInput,
  ListingCheckResult,
  ListingDisputeType,
  ListingFeatures,
  ListingFields,
  ListingFixGains,
  ListingFixGainsFn,
  ListingFixKey,
  ListingModelConfig,
  ListingParams,
  ListingSim,
  ListingTypeResult,
} from '@/types';

/** 고칠 점 6개 (화면·판정 순서). */
export const LISTING_FIX_KEYS: readonly ListingFixKey[] = ['size', 'color', 'ship', 'customs', 'bf', 'ret'];

/** 판매 수량 상한. 500회 × 수량 × 5유형 × 3난수 — 5000이면 3750만 개 (브라우저에서 수 초 안). */
export const LISTING_MAX_UNITS = 5000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const InputSchema = z.object({
  fields: z.object({ desc: z.string(), size: z.string(), ship: z.string(), ret: z.string() }),
  priceCents: z.number().int().positive(),
  units: z.number().int().positive().max(LISTING_MAX_UNITS),
  saleFrom: z.string().regex(DATE),
  saleTo: z.string().regex(DATE),
});

const ParamsSchema = z.object({
  feeCents: z.number().int().nonnegative(),
  timeCostCents: z.number().int().nonnegative(),
  refundShare: z.number().min(0).max(1),
});

const defaultModel = listingModelJson as unknown as ListingModelConfig;

/** `config/params.json`의 feeCents·timeCostCents·habitRefundShare → ListingParams. */
export function listingParamsFromConfig(): ListingParams {
  const pc = paramsConfigJson as unknown as {
    params: { feeCents: { value: number }; timeCostCents: { value: number } };
    habitRefundShare: { value: number };
  };
  return ParamsSchema.parse({
    feeCents: pc.params.feeCents.value,
    timeCostCents: pc.params.timeCostCents.value,
    refundShare: pc.habitRefundShare.value,
  });
}

/** `config/listing-model.json` 원본. */
export function listingModelFromConfig(): ListingModelConfig {
  return defaultModel;
}

export const detectListingFeatures: DetectListingFeaturesFn = (fields: ListingFields, model = defaultModel) => {
  const out = {} as ListingFeatures;
  for (const k of LISTING_FIX_KEYS) {
    const rule = model.rules[k];
    out[k] = new RegExp(rule.pattern, rule.flags).test(fields[rule.field] ?? '');
  }
  return out;
};

/** 판매 기간이 성수기 구간과 겹치면 참 (문자열 비교, SPEC 8-3장). */
export function isPeak(saleFrom: string, saleTo: string, model: ListingModelConfig = defaultModel): boolean {
  return saleFrom <= model.peak.to && saleTo >= model.peak.from;
}

/** 유형별 확률 q[k]와 승률 (SPEC 8-3장). */
export function listingRates(
  features: ListingFeatures,
  peak: boolean,
  model: ListingModelConfig = defaultModel,
): { q: Record<ListingDisputeType, number>; pWin: Record<ListingDisputeType, number> } {
  const q = {} as Record<ListingDisputeType, number>;
  const pWin = {} as Record<ListingDisputeType, number>;
  for (const k of model.types) {
    let rate = model.baseRate[k];
    if (peak) rate *= model.peak.multiplier[k] ?? 1;
    for (const fx of LISTING_FIX_KEYS) {
      if (features[fx]) rate *= model.fixMultiplier[fx]?.[k] ?? 1;
    }
    q[k] = rate;
    const wf = model.pWinWithFix[k];
    pWin[k] = wf && features[wf.fix] ? wf.value : model.pWin[k];
  }
  return { q, pWin };
}

type Prepared = {
  input: ListingCheckInput;
  params: ListingParams;
  model: ListingModelConfig;
  features: ListingFeatures;
  peak: boolean;
};

function prepare(input: ListingCheckInput, params: ListingParams | undefined, model: ListingModelConfig): Prepared {
  const parsedInput = InputSchema.parse(input) as ListingCheckInput;
  const parsedParams = params === undefined ? listingParamsFromConfig() : ParamsSchema.parse(params);
  return {
    input: parsedInput,
    params: parsedParams,
    model,
    features: detectListingFeatures(parsedInput.fields, model),
    peak: isPeak(parsedInput.saleFrom, parsedInput.saleTo, model),
  };
}

/** 판정 결과(features)를 받아 단계 계산기를 만든다. listingFixGains가 판정을 바꿔 다시 쓴다. */
function simFromFeatures(p: Prepared, features: ListingFeatures): ListingSim {
  const { model, params } = p;
  const { units, priceCents } = p.input;
  const { q, pWin } = listingRates(features, p.peak, model);
  const types = model.types;
  const nTypes = types.length;
  const qArr = types.map((k) => q[k]);
  const wArr = types.map((k) => pWin[k]);
  const t = params.timeCostCents;
  const refundLoss = priceCents + t;
  const loseLoss = priceCents + params.feeCents + t;
  const runs = model.runs;
  const rand = mulberry32(model.seedBase + units);

  const runLoss: number[] = [];
  const countByType = new Array<number>(nTypes).fill(0);
  const lossByType = new Array<number>(nTypes).fill(0);
  let totalDisputes = 0;
  let totalLoss = 0;
  let finished = 0;

  const runOnce = () => {
    let loss = 0;
    for (let o = 0; o < units; o += 1) {
      let disputed = false;
      for (let j = 0; j < nTypes; j += 1) {
        const u = rand();
        const v = rand();
        const w = rand();
        if (!disputed && u < qArr[j]) {
          disputed = true;
          const l = v < params.refundShare ? refundLoss : w < wArr[j] ? t : loseLoss;
          loss += l;
          countByType[j] += 1;
          lossByType[j] += l;
          totalDisputes += 1;
        }
      }
    }
    runLoss.push(loss);
    totalLoss += loss;
    finished += 1;
  };

  const build = (): ListingCheckResult => {
    const sorted = [...runLoss].sort((a, b) => a - b);
    const byType = {} as Record<ListingDisputeType, ListingTypeResult>;
    types.forEach((k, j) => {
      const expectedDisputes = countByType[j] / runs;
      byType[k] = { expectedDisputes, pPerOrder: expectedDisputes / units, meanLossCents: Math.round(lossByType[j] / runs) };
    });
    const expectedDisputes = totalDisputes / runs;
    return {
      features: { ...features },
      peak: p.peak,
      runs,
      units,
      expectedDisputes,
      pPerOrder: expectedDisputes / units,
      meanLossCents: Math.round(totalLoss / runs),
      p10LossCents: sorted[Math.floor(runs * 0.1)],
      p90LossCents: sorted[Math.floor(runs * 0.9)],
      byType,
    };
  };

  return {
    total: runs,
    step: (maxRuns: number) => {
      const n = Number.isFinite(maxRuns) ? Math.max(0, Math.floor(maxRuns)) : runs;
      const end = Math.min(runs, finished + n);
      while (finished < end) runOnce();
      return finished;
    },
    done: () => finished >= runs,
    result: () => {
      if (finished < runs) throw new Error(`listing sim not finished: ${finished} / ${runs}`);
      return build();
    },
  };
}

function runToEnd(sim: ListingSim): ListingCheckResult {
  sim.step(sim.total);
  return sim.result();
}

export const createListingSim: CreateListingSimFn = (input, params, model = defaultModel) => {
  const p = prepare(input, params, model);
  return simFromFeatures(p, p.features);
};

export const checkListing: CheckListingFn = (input, params, model = defaultModel) =>
  runToEnd(createListingSim(input, params, model));

export const listingFixGains: ListingFixGainsFn = (input, params, model = defaultModel) => {
  const p = prepare(input, params, model);
  const base = runToEnd(simFromFeatures(p, p.features)).pPerOrder;
  const out = {} as ListingFixGains;
  for (const k of LISTING_FIX_KEYS) {
    if (p.features[k]) out[k] = 0;
    else if (k === 'bf' && !p.peak) out[k] = null;
    else out[k] = base - runToEnd(simFromFeatures(p, { ...p.features, [k]: true })).pPerOrder;
  }
  return out;
};
