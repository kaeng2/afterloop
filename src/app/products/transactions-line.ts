/**
 * Products 탭 거래 조회 한 줄 (T062, 옛 T013 "거래 조회 한 줄", T019). **서버에서만 부른다.**
 *
 * "PayPal sandbox · N transactions (last 30 days)" + 캐시 값이면 `cached` 배지. 실패하면 null (줄을 숨긴다).
 * 조회만 한다 (`getTransactions`는 GET만). 시뮬레이션 숫자와 섞지 않는다.
 * 캐시는 서버 프로세스에 하나 (`createMemoryTransactionCache`, T019 결정 2). 비밀값·응답 원문을 싣지 않는다.
 *
 * `src/app/_server/`는 이 작업에서 고치지 않으므로(T070과 겹친다) 이 파일을 `products/` 안에 둔다.
 */
import 'server-only';

import {
  createMemoryTransactionCache,
  getTransactions,
  lastDays,
  type TransactionCache,
} from '@/paypal/transactions';
import type { PayPalClient } from '@/types';

import { getPayPalClient } from '../_server/paypal';
import { transactionLineView, type TransactionLineView } from './model';

/** 조회 기간 (T019 결정 1: 지난 30일). 금액·건수가 아니라 기간이다. */
export const TRANSACTION_DAYS = 30;

const processCache = createMemoryTransactionCache();

export type TransactionLineDeps = {
  /** 없으면 `getPayPalClient()` (쓸 수 없으면 null → 캐시만 본다). 테스트는 가짜를 넣는다. */
  client?: PayPalClient | null;
  now?: () => number;
  cache?: TransactionCache;
};

export async function loadTransactionLine(deps: TransactionLineDeps = {}): Promise<TransactionLineView | null> {
  try {
    const client =
      deps.client !== undefined
        ? deps.client
        : (() => {
            const paypal = getPayPalClient();
            return paypal.ok ? paypal.client : null;
          })();
    const now = deps.now ?? (() => Date.now());
    const result = await getTransactions(client, lastDays(now(), TRANSACTION_DAYS), {
      now,
      cache: deps.cache ?? processCache,
    });
    return transactionLineView(result, TRANSACTION_DAYS);
  } catch {
    // 예외 문장을 싣지 않는다. 줄을 숨긴다.
    return null;
  }
}
