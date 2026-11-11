/**
 * "이번 주" 카드의 "+$N just now" 값 (SPEC v2.14 8-4장, 계약 `ActionSavingsFn`·`TrackingSavingsFn`). 작업 T093.
 * 숫자는 기존 엔진 함수(`recommend`, `sim.ts`의 손실 식)에서만 나온다. 기존 함수의 결과는 바꾸지 않는다.
 */
import type { ActionSavingsFn, TrackingSavingsFn } from '@/types';

import { roundCents } from './oracle';
import { paramsConfigFromFile } from './params';
import { recommend } from './recommend';
import { expectedOrderLossCents } from './sim';

/**
 * 이 수를 실행했을 때 더할 값 = 전액 환불 기대 손실 − 이 수의 기대 손실 (센트, 0 이상).
 * refund 자체, 막힌 수, 값이 없는 수, refund 평가가 막힌 보드는 0.
 */
export const actionSavings: ActionSavingsFn = (board, move, params, rules) => {
  if (move === 'refund') return 0;
  const all = recommend(board, params, rules).all;
  const refund = all.find((e) => e.move === 'refund');
  const target = all.find((e) => e.move === move);
  if (!refund || refund.blockedBy !== undefined || refund.expectedLossCents === null) return 0;
  if (!target || target.blockedBy !== undefined || target.expectedLossCents === null) return 0;
  return Math.max(0, refund.expectedLossCents - target.expectedLossCents);
};

/**
 * 주문들에 추적번호를 넣었을 때 줄어드는 기대 손실 합 (센트, 0 이상 정수).
 *   Σ_주문 [ E(처방 없음) − E(tracking_24h) ]  (E = `expectedOrderLossCents`, 금액 = 주문 금액, 확률 = productRates[sku])
 * 합을 한 번만 반올림한다. productRates에 없는 SKU는 0을 더한다 (확률을 지어내지 않는다).
 */
export const trackingSavings: TrackingSavingsFn = (orders, params, rules) => {
  const config = params ?? paramsConfigFromFile();
  let total = 0;
  for (const order of orders) {
    const rates = config.productRates[order.sku]?.value;
    if (rates === undefined) continue;
    const input = { sku: order.sku, priceCents: order.amountCents, stock: 1, rates, fixes: [], futures: 0, seed: 0 };
    total += expectedOrderLossCents(input, [], config, rules) - expectedOrderLossCents(input, ['tracking_24h'], config, rules);
  }
  return Math.max(0, roundCents(total));
};
