/**
 * 상품 진단 시뮬레이션 (SPEC v2.2 8장, 원문 9장). 작업 T015.
 * 공개 함수는 `simulate`(SimulateFn)와 편의 함수 `simInputFor`다.
 *
 * 남은 재고만큼의 주문을 미래 500개에 걸쳐 돌려, '지금 그대로'(before)와 '처방 적용'(after)의
 * 평균 손실·P10~P90·평균 분쟁 수·손실 분포·처방별 폭포를 낸다.
 * **모든 화면의 예상 손실은 이 함수 하나에서 나온다** (원문 F3, SPEC 8장).
 *
 * 설계 원칙 (CLAUDE.md 공통 규칙):
 * - 가정값(f, t, x, p_acc, p_win, 처방 배수, 지금 습관, 상품별 확률)은 `config/params.json`에서만 읽는다.
 * - 분쟁 1건의 기대 손실과 분기 손실은 `oracle.ts`의 함수를 그대로 쓴다 (식을 다시 쓰지 않는다).
 *   합의 우선 처방이 고르는 수도 `policy.ts`의 `pickBest`(T004와 같은 기준)를 그대로 쓴다.
 * - `Math.random`·`Date`·`performance.now`를 읽지 않는다. 난수는 `rng.ts`의 시드 고정 PRNG뿐이라
 *   같은 입력이면 항상 같은 결과다. 입력 객체는 바꾸지 않는다 (zod가 검증한 사본만 읽는다).
 *
 * 같은 난수 (common random numbers, SPEC 8장): 미래·주문마다 **고정된 순서와 개수**로 난수를 뽑는다.
 * 분쟁이 나든 안 나든 같은 개수를 소비하므로, Before·After·폭포의 각 단계가 같은 난수 위에서 돌아간다.
 * 처방 배수는 1 이하여서 처방을 켜면 분쟁이 줄기만 한다 (After의 분쟁 주문 집합 ⊆ Before).
 */
import { z } from 'zod';

import type {
  BoardState,
  Evaluation,
  FixId,
  MoveType,
  Params,
  ParamsConfig,
  PolicyConfig,
  SeedProduct,
  SimInput,
  SimResult,
  SimSummary,
  SimulateFn,
  Subtype,
} from '@/types';

import type { MoveLoss } from './oracle';
import { fightLoss, offerLoss, refundLoss, roundCents } from './oracle';
import { nonNegativeIntSchema, paramsConfigFromFile, paramsFromConfig, resolveEngineInput, SUBTYPES } from './params';
import { apiMoveFor, BLOCKED, isOfferInScope, MOVE_ORDER, pickBest } from './policy';
import { mulberry32, seedFromString } from './rng';

/** 폭포에서 처방을 더하는 고정 순서 (SPEC 8장, 원문 9-1 처방 표). */
export const FIX_ORDER = ['tracking_24h', 'color_note', 'kr_customs_notice', 'settle_first'] as const satisfies readonly FixId[];

/** 미래 개수 (SPEC 8장 "미래 500개"). `SimInput.futures`로 넘기지 않을 때 `simInputFor`가 쓰는 값. */
export const DEFAULT_FUTURES = 500;

/** P10·P90 분위수. 보간하지 않는 nearest-rank 방식이다 (`quantileCents` 주석). */
const LOW_QUANTILE = 0.1;
const HIGH_QUANTILE = 0.9;

/**
 * 히스토그램 구간 폭 후보 = 상품 가격 × 이 배수 (구간 하나가 "상품 몇 개 값"이라 화면에서 읽기 쉽다).
 * 구간 수가 10에 가장 가까워지는 폭을 쓰고, 같으면 더 좁은 폭을 쓴다 (`binWidthFor`).
 */
const BIN_WIDTH_FACTORS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
const TARGET_BINS = 10;

/** 시뮬레이션 안의 가상 분쟁에서는 네 수 모두 둘 수 있다고 본다 (실제 보드의 `allowedMoves`가 아니다). */
const SIM_ALLOWED_MOVES: readonly MoveType[] = ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'];

const probability = z.number().min(0).max(1);

/**
 * 세부 유형별 숫자 지도 (확률·처방 배수·승률 상향). 값은 모두 0~1이다.
 * 배수가 1을 넘으면 처방이 분쟁을 늘릴 수 있어 "같은 난수" 전제(After ⊆ Before)가 깨지므로 설정 오류로 본다.
 * 모르는 세부 유형 키도 거부한다 (오타가 조용히 확률 0으로 바뀌지 않게).
 */
const subtypeNumbersShape = Object.fromEntries(SUBTYPES.map((subtype) => [subtype, probability])) as Record<
  Subtype,
  typeof probability
>;
const subtypeNumbersSchema = z.object(subtypeNumbersShape).partial().strict();

const fixIdSchema = z.enum(FIX_ORDER);

/** 처방 하나의 설정값. `source`·`note`는 보지 않는다. */
const sourcedFixSchema = z.object({
  value: z.object({
    rateMultiplier: subtypeNumbersSchema,
    pWinOverride: subtypeNumbersSchema.optional(),
  }),
});

/** 시뮬레이션이 쓰는 `config/params.json` 조각 (기대 손실 가정값은 `ParamsSchema`가 본다). */
const SimConfigSchema = z.object({
  fixes: z.object({
    tracking_24h: sourcedFixSchema,
    color_note: sourcedFixSchema,
    kr_customs_notice: sourcedFixSchema,
    settle_first: sourcedFixSchema,
  }),
  habitRefundShare: z.object({ value: probability }),
});

/** 시뮬레이션 입력. 화면이 만들어 넘기는 값이라 신뢰하지 않고 검증한다 (SPEC 8장). */
const SimInputSchema = z.object({
  sku: z.string().min(1),
  priceCents: nonNegativeIntSchema,
  stock: nonNegativeIntSchema,
  rates: subtypeNumbersSchema,
  fixes: z.array(fixIdSchema),
  futures: nonNegativeIntSchema,
  seed: z.number().int(),
});

type SimFixesConfig = z.infer<typeof SimConfigSchema>['fixes'];

/** 검증을 통과한 가정값·정책·처방 설정. 패스마다 다시 읽지 않는다. */
type SimContext = {
  params: Params;
  rules: PolicyConfig;
  fixes: SimFixesConfig;
  /** 지금 습관: 분쟁마다 전액 환불할 확률 (나머지는 다툼) */
  habitRefundShare: number;
};

/** 세부 유형 하나의 분쟁 1건에서 실현될 수 있는 손실 (모두 `oracle.ts`의 트리 분기에서 가져온 값). */
type DisputeLosses = {
  subtype: Subtype;
  /** 주문 1건당 이 유형의 분쟁 확률 = 기본 확률 × 켠 처방들의 배수 */
  probability: number;
  pWin: number;
  /** 다퉈 이김 = t */
  winCents: number;
  /** 다퉈 짐 = A + f + t */
  loseCents: number;
  /** 전액 환불 = A + t */
  refundCents: number;
  /** 제안 수락 = x·A + t. 제안 대상(B1·B2)이 아니면 null */
  acceptCents: number | null;
  /** 합의 우선 처방이 고르는 수 */
  settleMove: Evaluation['move'];
};

/** 패스 1회(처방 묶음 하나)의 미래별 결과. */
export type SimPass = {
  /** 미래별 손실 합 (센트 정수) */
  lossCents: number[];
  /** 미래별 분쟁 수 */
  disputes: number[];
  /** 미래별로 분쟁이 난 주문 번호 (0부터, 오름차순). "같은 난수" 확인용 */
  disputeOrders: number[][];
};

/**
 * 시뮬레이션 안의 가상 분쟁 1건을 `oracle.ts`·`policy.ts`에 넘기기 위한 보드.
 * 금액은 상품 가격 A, 네 수 모두 가능, 기한·구매자 이력은 쓰지 않는다 (시간을 읽지 않는다).
 * p_win은 처방까지 반영해 `pWinWithFixes`가 직접 정하므로 `hasTracking`은 false로 둔다
 * (`params.pWinWithTracking`은 실제 분쟁 보드용이고, 시뮬레이션은 SPEC 8장대로 처방 상향값을 쓴다).
 */
function disputeBoard(input: SimInput, subtype?: Subtype): BoardState {
  return {
    disputeId: `sim-${input.sku}`,
    reason: 'SIMULATED',
    stage: 'INQUIRY',
    channel: 'INTERNAL',
    dueDate: '',
    amountCents: input.priceCents,
    currency: 'USD',
    allowedMoves: [...SIM_ALLOWED_MOVES],
    hasTracking: false,
    hasDeliveredTracking: false,
    buyerPriorInrDisputes: 0,
    isDemo: true,
    cause:
      subtype === undefined
        ? undefined
        : { subtype, confidence: 1, evidence: [], needsReview: false, source: 'rule' },
  };
}

/**
 * 가정값·정책·처방 설정을 한 번 검증한다.
 * 가정값과 제안률 한도(x ≤ `rules.offer.maxRate`)는 `recommend`·`planMove`와 같은 검증을 쓴다.
 */
function resolveContext(input: SimInput, config: ParamsConfig, rules?: PolicyConfig): SimContext {
  const simConfig = SimConfigSchema.parse(config);
  const engine = resolveEngineInput(disputeBoard(input), paramsFromConfig(config), rules);
  return {
    params: engine.params,
    rules: engine.rules,
    fixes: simConfig.fixes,
    habitRefundShare: simConfig.habitRefundShare.value,
  };
}

/** 켠 처방을 고정 순서의 중복 없는 목록으로 만든다 (넣은 순서를 바꿔도 같은 결과). */
function canonicalFixes(fixes: readonly FixId[]): FixId[] {
  const picked = new Set(z.array(fixIdSchema).parse(fixes));
  return FIX_ORDER.filter((fix) => picked.has(fix));
}

/** 켠 처방들의 확률 배수 곱 (그 유형에 배수가 없는 처방은 1). */
function multiplierFor(subtype: Subtype, ctx: SimContext, fixes: readonly FixId[]): number {
  let multiplier = 1;
  for (const fix of fixes) multiplier *= ctx.fixes[fix].value.rateMultiplier[subtype] ?? 1;
  return multiplier;
}

/**
 * 다퉜을 때 이길 확률. 켠 처방에 승률 상향값(`pWinOverride`, 지금은 `tracking_24h`뿐)이 있으면 그 값,
 * 없으면 `params.pWin`. 상향값이 여러 처방에 있으면 `FIX_ORDER`에서 앞선 처방을 쓴다.
 */
function pWinWithFixes(subtype: Subtype, ctx: SimContext, fixes: readonly FixId[]): number {
  for (const fix of fixes) {
    const override = ctx.fixes[fix].value.pWinOverride?.[subtype];
    if (override !== undefined) return override;
  }
  return ctx.params.pWin[subtype];
}

/** `oracle.ts`가 낸 트리 분기 하나의 손실. 분기 이름이 바뀌면 조용히 틀리지 않게 예외를 던진다. */
function branchCents(loss: MoveLoss, label: string): number {
  const branch = loss.branches.find((candidate) => candidate.label === label);
  if (branch === undefined) throw new Error(`simulate: oracle.ts에 ${label} 분기가 없습니다`);
  return branch.lossCents;
}

/**
 * 합의 우선 처방이 고르는 수. 기대 손실이 가장 작은 수를 `policy.ts`의 `pickBest`로 고른다
 * (제안은 B1·B2만, 동점이면 fight → offer → refund). T004·`recommend`와 같은 기준이다.
 */
function settleMoveFor(board: BoardState, fight: MoveLoss, offer: MoveLoss | null, refund: MoveLoss): Evaluation['move'] {
  const all: Evaluation[] = MOVE_ORDER.map((move) => {
    const apiMove = apiMoveFor(move, board);
    if (move === 'fight') return { move, apiMove, ...fight };
    if (move === 'refund') return { move, apiMove, ...refund };
    return offer === null
      ? { move, apiMove: null, expectedLossCents: null, blockedBy: BLOCKED.offerScope, branches: [] }
      : { move, apiMove, ...offer };
  });

  const best = pickBest(all);
  if (best === null) throw new Error('simulate: 분쟁 1건에서 고를 수 있는 수가 없습니다');
  return best.move;
}

/**
 * 처방 묶음 하나에서 쓸 유형별 확률·손실 표. `rates`에 있는 유형만, `SUBTYPES` 고정 순서로 담는다
 * (이 순서가 주문마다 유형을 판정하는 순서이자 난수를 뽑는 순서다).
 */
function lossTableFor(input: SimInput, ctx: SimContext, fixes: readonly FixId[]): DisputeLosses[] {
  const table: DisputeLosses[] = [];

  for (const subtype of SUBTYPES) {
    const rate = input.rates[subtype];
    if (rate === undefined) continue;

    const board = disputeBoard(input, subtype);
    const pWin = pWinWithFixes(subtype, ctx, fixes);
    const fight = fightLoss(board, ctx.params, pWin);
    const refund = refundLoss(board, ctx.params);
    const offer = isOfferInScope(board, ctx.rules) ? offerLoss(board, ctx.params, pWin) : null;

    table.push({
      subtype,
      probability: rate * multiplierFor(subtype, ctx, fixes),
      pWin,
      winCents: branchCents(fight, 'win'),
      loseCents: branchCents(fight, 'lose'),
      refundCents: branchCents(refund, 'refund'),
      acceptCents: offer === null ? null : branchCents(offer, 'accept'),
      settleMove: settleMoveFor(board, fight, offer, refund),
    });
  }

  return table;
}

/** 다툼의 실현 손실 (승패 난수). */
function fightOutcomeCents(dispute: DisputeLosses, winDraw: number): number {
  return winDraw < dispute.pWin ? dispute.winCents : dispute.loseCents;
}

/** 지금 습관: 난수 < `habitRefundShare`면 전액 환불, 아니면 다툼 (SPEC 8장). */
function habitLossCents(dispute: DisputeLosses, ctx: SimContext, choiceDraw: number, winDraw: number): number {
  if (choiceDraw < ctx.habitRefundShare) return dispute.refundCents;
  return fightOutcomeCents(dispute, winDraw);
}

/** 합의 우선: 기대 손실이 가장 작은 수를 그대로 실현한다 (제안은 수락 난수 → 거절이면 다툼 분기). */
function settleLossCents(dispute: DisputeLosses, ctx: SimContext, choiceDraw: number, winDraw: number): number {
  if (dispute.settleMove === 'refund') return dispute.refundCents;
  if (dispute.settleMove === 'fight') return fightOutcomeCents(dispute, winDraw);
  if (dispute.acceptCents === null) throw new Error('simulate: 제안 대상이 아닌데 제안을 고를 수 없습니다');
  return choiceDraw < ctx.params.pAccept ? dispute.acceptCents : fightOutcomeCents(dispute, winDraw);
}

/**
 * 패스 1회: 미래 `futures`개 × 주문 `stock`개를 돌린다.
 *
 * 주문 1건에서 뽑는 난수는 항상 `유형 수 + 2`개다 (유형 판정 + 습관/수락 + 승패).
 * 분쟁이 나도 유형 판정 난수를 끝까지 뽑고, 분쟁이 없어도 대응 난수 2개를 뽑는다.
 * 그래서 처방을 켜고 끄더라도 같은 주문이 같은 난수를 받는다 (common random numbers).
 */
function runPass(input: SimInput, ctx: SimContext, fixes: readonly FixId[]): SimPass {
  const table = lossTableFor(input, ctx, fixes);
  const settleFirst = fixes.includes('settle_first');
  const random = mulberry32(input.seed);

  const lossCents: number[] = [];
  const disputes: number[] = [];
  const disputeOrders: number[][] = [];

  for (let future = 0; future < input.futures; future += 1) {
    let futureLossCents = 0;
    const orders: number[] = [];

    for (let order = 0; order < input.stock; order += 1) {
      // ① 유형 판정: 고정 순서대로 유형 수만큼. 주문당 최대 1건(첫 번째로 걸린 유형)
      let hit: DisputeLosses | null = null;
      for (let index = 0; index < table.length; index += 1) {
        const draw = random();
        if (hit === null && draw < table[index].probability) hit = table[index];
      }

      // ② 대응 결과: 항상 2개 (습관 선택 또는 제안 수락, 승패)
      const choiceDraw = random();
      const winDraw = random();
      if (hit === null) continue;

      orders.push(order);
      futureLossCents += settleFirst
        ? settleLossCents(hit, ctx, choiceDraw, winDraw)
        : habitLossCents(hit, ctx, choiceDraw, winDraw);
    }

    lossCents.push(futureLossCents);
    disputes.push(orders.length);
    disputeOrders.push(orders);
  }

  return { lossCents, disputes, disputeOrders };
}

function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** 평균 손실 (센트 정수). 미래가 0개면 0. */
function meanCents(values: readonly number[]): number {
  return values.length === 0 ? 0 : roundCents(sum(values) / values.length);
}

/**
 * 분위수 (nearest-rank, 보간 없음): 오름차순으로 정렬해 `ceil(q × n)`번째로 작은 값을 쓴다.
 * n = 500이면 P10은 50번째, P90은 450번째 값이다. 미래가 0개면 0.
 */
function quantileCents(values: readonly number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(quantile * sorted.length)));
  return sorted[rank - 1];
}

/** 평균 분쟁 수는 소수 둘째 자리까지 (화면 문구 "약 4.3건"). */
function meanDisputes(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round((sum(values) / values.length) * 100) / 100;
}

function summarize(pass: SimPass): SimSummary {
  return {
    meanLossCents: meanCents(pass.lossCents),
    p10LossCents: quantileCents(pass.lossCents, LOW_QUANTILE),
    p90LossCents: quantileCents(pass.lossCents, HIGH_QUANTILE),
    meanDisputes: meanDisputes(pass.disputes),
  };
}

/** 손실 `maxLossCents`까지 덮는 구간 수 (구간 i = [i·폭, (i+1)·폭)). */
function binCount(maxLossCents: number, widthCents: number): number {
  return Math.floor(maxLossCents / widthCents) + 1;
}

/** 구간 폭: 상품 가격의 배수 중 구간 수가 `TARGET_BINS`에 가장 가까운 것 (같으면 더 좁은 쪽). */
function binWidthFor(priceCents: number, maxLossCents: number): number {
  const base = Math.max(1, priceCents);
  let best = base;
  let bestDistance = Infinity;

  for (const factor of BIN_WIDTH_FACTORS) {
    const width = Math.max(1, Math.round(base * factor));
    const distance = Math.abs(binCount(maxLossCents, width) - TARGET_BINS);
    if (distance < bestDistance) {
      best = width;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * 손실 분포. Before·After가 **같은 구간**을 쓰고 (두 쪽 최대 손실까지 덮는다),
 * 미래는 모두 어느 한 구간에 들어가므로 각 열의 합은 `futures`와 같다.
 */
function histogramFor(priceCents: number, before: readonly number[], after: readonly number[]): SimResult['histogram'] {
  const maxLossCents = Math.max(0, ...before, ...after);
  const width = binWidthFor(priceCents, maxLossCents);
  const bins = binCount(maxLossCents, width);
  const rows = Array.from({ length: bins }, (_unused, index) => ({
    fromCents: index * width,
    toCents: (index + 1) * width,
    before: 0,
    after: 0,
  }));

  for (const loss of before) rows[Math.min(bins - 1, Math.floor(loss / width))].before += 1;
  for (const loss of after) rows[Math.min(bins - 1, Math.floor(loss / width))].after += 1;

  return rows;
}

/**
 * 패스 1회를 그대로 돌려준다 (미래별 손실·분쟁 수·분쟁 주문).
 * `simulate`가 Before·After·폭포에 쓰고, 단위 테스트가 "같은 난수" 전제를 확인하는 데 쓴다.
 */
export function simulatePass(
  input: SimInput,
  fixes: readonly FixId[],
  params?: ParamsConfig,
  rules?: PolicyConfig,
): SimPass {
  const checked = SimInputSchema.parse(input) as SimInput;
  return runPass(checked, resolveContext(checked, params ?? paramsConfigFromFile(), rules), canonicalFixes(fixes));
}

/**
 * 상품 1개의 진단. `params`를 안 넘기면 `config/params.json`, `rules`를 안 넘기면 `config/rules.json`을 읽는다.
 *
 * - `before`: 처방 없음 (지금 습관으로 대응)
 * - `after`: `input.fixes` 전부 적용
 * - `waterfall`: `as_is` → `FIX_ORDER` 순서로 `input.fixes`에 있는 처방을 하나씩 누적한 평균 손실
 *   (마지막 단계 = `after.meanLossCents`)
 * - `histogram`: 미래별 손실 분포 (Before·After 같은 구간)
 */
export const simulate: SimulateFn = (input, params, rules) => {
  const checked = SimInputSchema.parse(input) as SimInput;
  const ctx = resolveContext(checked, params ?? paramsConfigFromFile(), rules);
  const fixes = canonicalFixes(checked.fixes);

  const beforePass = runPass(checked, ctx, []);
  // 처방이 없으면 after는 before와 같은 패스다 (같은 난수·같은 표).
  const afterPass = fixes.length === 0 ? beforePass : runPass(checked, ctx, fixes);

  const waterfall: SimResult['waterfall'] = [{ step: 'as_is', meanLossCents: meanCents(beforePass.lossCents) }];
  const applied: FixId[] = [];
  for (const fix of fixes) {
    applied.push(fix);
    const pass = applied.length === fixes.length ? afterPass : runPass(checked, ctx, [...applied]);
    waterfall.push({ step: fix, meanLossCents: meanCents(pass.lossCents) });
  }

  return {
    before: summarize(beforePass),
    after: summarize(afterPass),
    histogram: histogramFor(checked.priceCents, beforePass.lossCents, afterPass.lossCents),
    waterfall,
  };
};

/**
 * 상품(가격·재고)과 `config/params.json`의 `productRates[sku]`로 `SimInput`을 만든다.
 * 시드는 SKU에서 결정적으로 만들므로(FNV-1a), 화면과 S1 합계가 같은 입력·같은 결과를 본다.
 */
export function simInputFor(
  sku: string,
  product: Pick<SeedProduct, 'priceCents' | 'stock'>,
  fixes: readonly FixId[],
  config: ParamsConfig = paramsConfigFromFile(),
): SimInput {
  const sourced = config.productRates[sku];
  if (sourced === undefined) {
    throw new Error(`simInputFor: ${sku}의 주문당 분쟁 확률이 config/params.json productRates에 없습니다`);
  }

  return SimInputSchema.parse({
    sku,
    priceCents: product.priceCents,
    stock: product.stock,
    rates: sourced.value,
    fixes,
    futures: DEFAULT_FUTURES,
    seed: seedFromString(sku),
  }) as SimInput;
}
