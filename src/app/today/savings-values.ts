/**
 * "+$N just now"의 N (T091, SPEC v2.14 8-4장). **엔진 값을 옮기고 표기만 바꾼다** — 계산은 `actionSavings`·
 * `trackingSavings`(src/engine/savings.ts)가 한다. 0이거나 엔진이 예외를 던지면 `null` (아무것도 더하지 않는다).
 */
import { actionSavings, trackingSavings } from '@/engine/savings';
import type { BoardState, Evaluation } from '@/types';

import { toDollarsRounded } from '../_shared/money';
import type { TrackingSummary } from './model';

const display = (cents: number): string | null => (Number.isFinite(cents) && cents > 0 ? toDollarsRounded(cents) : null);

/** 분쟁에 이 수를 실행했을 때 (`actionSavings`). */
export function actionSavingsDisplay(board: BoardState, move: Evaluation['move'] | null): string | null {
  if (move === null) return null;
  try {
    return display(actionSavings(board, move));
  } catch {
    return null;
  }
}

/** 추적번호를 넣을 주문들 (`trackingSavings`). 금액·SKU를 모르는 주문은 넘기지 않는다 (엔진이 지어내지 않게). */
export function trackingSavingsDisplay(tracking: TrackingSummary): string | null {
  const orders = tracking.untracked.flatMap((order) =>
    order.sku === undefined || order.amountCents === undefined ? [] : [{ sku: order.sku, amountCents: order.amountCents }],
  );
  if (orders.length === 0) return null;
  try {
    return display(trackingSavings(orders));
  } catch {
    return null;
  }
}
