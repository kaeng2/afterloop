/**
 * 가게 합계와 점 그림용 "대표 미래" (SPEC v2.7 8장). 작업 T048.
 *
 * - `simulateStore`: S1(Today)의 "가게 전체 예상 손실 전 → 후". 상품별 `simulate` 결과의
 *   평균 손실(센트 정수)을 **정수 덧셈만** 해서 더한다. 합계에서 다시 반올림하지 않는다.
 *   P10·P90은 더할 수 없으므로 합계에 넣지 않는다 (상품별 결과는 `products`에 그대로 있다).
 *   달러 표시 반올림은 화면의 `toDollarsRounded` 한 곳에서만 한다. 엔진은 센트만 돌려준다.
 * - `pickRepresentativeFuture`: S2(Product check) 점 그림에 그릴 미래 하나.
 *   Before 패스의 평균 분쟁 수에 분쟁 수가 가장 가까운 미래 (동점이면 작은 번호).
 *   Before 패스만 보고 고르므로 처방을 켜고 꺼도 같은 미래가 뽑힌다. After는 같은 미래 번호를 쓴다.
 *
 * `Math.random`·`Date`·`performance.now`를 읽지 않는다. 입력 객체는 바꾸지 않는다.
 */
import { z } from 'zod';

import type { FixId, ParamsConfig, PolicyConfig, SimInput, SimResult, Subtype } from '@/types';

import { nonNegativeIntSchema, paramsConfigFromFile } from './params';
import { simInputFor, simulate, simulatePass } from './sim';

/** 가게 합계의 상품 한 줄. `result`는 `simulate` 결과 그대로다. */
export type StoreProductResult = { sku: string; result: SimResult };

/** 가게 합계 (센트 정수). */
export type StoreTotal = {
  /** Σ 상품별 `before.meanLossCents` */
  beforeCents: number;
  /** Σ 상품별 `after.meanLossCents` */
  afterCents: number;
  /** `before.meanLossCents` 큰 순서. 같으면 입력 순서 (안정 정렬) */
  products: StoreProductResult[];
};

/** 점 그림의 점 하나 = 주문 하나. */
export type DotOrder = {
  /** 주문 번호 0..stock-1 */
  index: number;
  disputedBefore: boolean;
  /** 참이면 `disputedBefore`도 참이다 (처방 배수 ≤ 1, 같은 난수) */
  disputedAfter: boolean;
  /** 분쟁 난 세부 유형. 분쟁이 없으면 null */
  subtypeBefore: Subtype | null;
  subtypeAfter: Subtype | null;
};

/** 점 그림에 그릴 미래 하나. */
export type RepresentativeFuture = {
  /** Before·After가 함께 쓰는 미래 번호 */
  futureIndex: number;
  /** 길이 = stock, 주문 번호 순 */
  orders: DotOrder[];
  disputesBefore: number;
  disputesAfter: number;
};

/** 가게 합계 입력의 상품 한 개 (가격·재고만 읽는다. 다른 칸은 무시한다). */
const StoreProductSchema = z.object({
  sku: z.string().min(1),
  priceCents: nonNegativeIntSchema,
  stock: nonNegativeIntSchema,
});

/**
 * 가게 전체 예상 손실. `fixes`를 모든 상품에 똑같이 쓴다 (S1은 `[...FIX_ORDER]`를 넘긴다).
 * 상품별 입력은 `simInputFor`로 만들므로 S2가 같은 상품을 같은 처방으로 돌린 값과 같다.
 * `params`를 안 넘기면 `config/params.json`, `rules`를 안 넘기면 `config/rules.json`을 읽는다.
 */
export function simulateStore(
  products: readonly { sku: string; priceCents: number; stock: number }[],
  fixes: readonly FixId[],
  params?: ParamsConfig,
  rules?: PolicyConfig,
): StoreTotal {
  const checked = z.array(StoreProductSchema).parse(products);
  const config = params ?? paramsConfigFromFile();

  const rows: StoreProductResult[] = checked.map((product) => ({
    sku: product.sku,
    result: simulate(simInputFor(product.sku, product, fixes, config), config, rules),
  }));

  let beforeCents = 0;
  let afterCents = 0;
  for (const row of rows) {
    beforeCents += row.result.before.meanLossCents;
    afterCents += row.result.after.meanLossCents;
  }

  // Array.prototype.sort는 안정 정렬이다 (ES2019). 같은 값이면 입력 순서가 남는다.
  const sorted = [...rows].sort((a, b) => b.result.before.meanLossCents - a.result.before.meanLossCents);

  return { beforeCents, afterCents, products: sorted };
}

/**
 * Before 분쟁 수가 평균에 가장 가까운 미래 번호. 동점이면 작은 번호.
 * 부동소수점 비교를 피하려고 `|분쟁 수 × futures − Σ 분쟁 수|`(정수)로 비교한다.
 */
function closestToMean(disputes: readonly number[]): number {
  const futures = disputes.length;
  let total = 0;
  for (const count of disputes) total += count;

  let best = 0;
  let bestDistance = Infinity;
  for (let future = 0; future < futures; future += 1) {
    const distance = Math.abs(disputes[future] * futures - total);
    if (distance < bestDistance) {
      best = future;
      bestDistance = distance;
    }
  }
  return best;
}

/** 미래 하나의 분쟁 주문 → 주문 번호별 세부 유형. */
function subtypeByOrder(orders: readonly number[], subtypes: readonly Subtype[]): Map<number, Subtype> {
  const map = new Map<number, Subtype>();
  orders.forEach((order, position) => map.set(order, subtypes[position]));
  return map;
}

/**
 * 점 그림용 대표 미래. Before = 처방 없음, After = `input.fixes` (빈 배열이면 After = Before).
 * `futures`가 0이면 고를 미래가 없으므로 예외를 던진다. `stock`이 0이면 `orders`는 빈 배열이다.
 * 잘못된 입력은 `simulate`와 같은 zod 예외를 던진다.
 */
export function pickRepresentativeFuture(
  input: SimInput,
  params?: ParamsConfig,
  rules?: PolicyConfig,
): RepresentativeFuture {
  const config = params ?? paramsConfigFromFile();
  const before = simulatePass(input, [], config, rules);
  const after = input.fixes.length === 0 ? before : simulatePass(input, input.fixes, config, rules);

  if (before.disputes.length === 0) {
    throw new Error('pickRepresentativeFuture: futures가 0이라 고를 미래가 없습니다');
  }

  const futureIndex = closestToMean(before.disputes);
  const beforeMap = subtypeByOrder(before.disputeOrders[futureIndex], before.disputeSubtypes[futureIndex]);
  const afterMap = subtypeByOrder(after.disputeOrders[futureIndex], after.disputeSubtypes[futureIndex]);

  const orders: DotOrder[] = Array.from({ length: input.stock }, (_unused, index) => {
    const subtypeBefore = beforeMap.get(index) ?? null;
    const subtypeAfter = afterMap.get(index) ?? null;
    return {
      index,
      disputedBefore: subtypeBefore !== null,
      disputedAfter: subtypeAfter !== null,
      subtypeBefore,
      subtypeAfter,
    };
  });

  return {
    futureIndex,
    orders,
    disputesBefore: before.disputes[futureIndex],
    disputesAfter: after.disputes[futureIndex],
  };
}
