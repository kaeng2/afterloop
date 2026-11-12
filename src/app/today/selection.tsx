'use client';

/**
 * Today 화면 안 고르기 상태 (T106 → T122b 시안 v6 `setState({sel})`·`pickProduct(sku)`).
 *
 * - 목록 항목·상품 칩·표 행을 누르면 **서버 왕복 없이** 이 상자만 바뀐다 (링크·router 이동 없음). 상세는 첫 요청에서
 *   모두 그려 두었고(`page.tsx`), 고른 것만 보인다(`DetailPane`, 나머지는 `hidden`) — 서연 답장 칸·Done today·
 *   "+$N just now" 같은 화면 상태가 항목을 오가도 그대로 남는다.
 * - v6 칩 동작 (T106의 "칩을 눌러도 고른 항목 유지"는 바뀌었다): 상품 칩 → 그 상품 항목만 남고 오른쪽은 그 상품의 첫 항목
 *   (`firstItemFor`). "All products" → 고른 항목 없음 = 오른쪽 전체 현황(`OverviewPane`). 전체 현황에서 항목을 고르면
 *   "← All products overview" 단추로 돌아간다 (`showBack`).
 * - 주소(`?item`·`?sku`)는 `history.replaceState`로 맞춘다 → 새로고침·공유 때 같은 화면 (서버가 같은 값으로 처음 상태를 정한다).
 *
 * 읽기·쓰기·계산 없음.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useT } from '../_shared/locale-context';
import type { TodayGroup } from './model';
import { useSavings } from './savings';
import { firstItemFor, todaySearch } from './screen-model';

type Selection = {
  /** 고른 항목 id (`null` = 없음). */
  itemId: string | null;
  /** 고른 상품 SKU (`null` = All products). */
  sku: string | null;
  select: (itemId: string) => void;
  setSku: (sku: string | null) => void;
  /** 전체 현황으로 (All products + 고른 항목 없음). */
  backToAll: () => void;
};

const SelectionContext = createContext<Selection | null>(null);

function syncAddress(sku: string | null, itemId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const { pathname, search, hash } = window.location;
    const next = `${pathname}${todaySearch(search, sku, itemId)}${hash}`;
    if (next !== `${pathname}${search}${hash}`) window.history.replaceState(window.history.state, '', next);
  } catch {
    // 주소를 못 맞춰도 화면은 그대로 쓴다
  }
}

const NO_GROUPS: readonly TodayGroup[] = [];

export function TodaySelectionProvider({
  initialItem,
  initialSku,
  groups = NO_GROUPS,
  children,
}: {
  initialItem: string | null;
  initialSku: string | null;
  /** 거르지 않은 전체 묶음 (칩을 눌렀을 때 첫 항목을 고른다). */
  groups?: readonly TodayGroup[];
  children?: ReactNode;
}) {
  const { done } = useSavings();
  const [state, setState] = useState<{ itemId: string | null; sku: string | null }>({
    itemId: initialItem,
    sku: initialSku,
  });

  const select = useCallback((next: string) => {
    setState((current) => {
      syncAddress(current.sku, next);
      return { ...current, itemId: next };
    });
  }, []);
  const setSku = useCallback(
    (next: string | null) => {
      const itemId = next === null ? null : firstItemFor(groups, next, done);
      syncAddress(next, itemId);
      setState({ sku: next, itemId });
    },
    [groups, done],
  );
  const backToAll = useCallback(() => {
    setState((current) => {
      syncAddress(current.sku, null);
      return { ...current, itemId: null };
    });
  }, []);

  const value = useMemo(
    () => ({ itemId: state.itemId, sku: state.sku, select, setSku, backToAll }),
    [state, select, setSku, backToAll],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/** 상자 밖(견본·테스트)에서는 `null` — 부르는 쪽이 받은 값을 그대로 쓴다. */
export function useTodaySelection(): Selection | null {
  return useContext(SelectionContext);
}

/** 전체 현황이 보이는가 (All products + 고른 항목 없음, 시안 `isAll`). */
export function isOverview(selection: Pick<Selection, 'itemId' | 'sku'> | null): boolean {
  return selection !== null && selection.sku === null && selection.itemId === null;
}

/** 오른쪽 상세 하나. 고른 항목일 때만 보인다 (나머지는 숨김 — 다시 그리지 않아 화면 상태를 잃지 않는다). */
export function DetailPane({ id, children }: { id: string; children?: ReactNode }) {
  const selection = useTodaySelection();
  const shown = selection?.itemId === id;
  return (
    <div className="today-pane" data-item={id} hidden={!shown}>
      {children}
    </div>
  );
}

/**
 * 고른 상품에 항목이 없을 때의 안내 (시안 v6 `isEmpty`, L234-240). 상품 이름은 칩 값 그대로.
 * 상자 밖(견본·테스트)에서는 그리지 않는다.
 */
export function DetailEmpty({ names }: { names: Readonly<Record<string, string>> }) {
  const t = useT();
  const selection = useTodaySelection();
  if (selection === null || selection.itemId !== null || selection.sku === null) return null;
  return (
    <section className="today-empty-product">
      <span className="today-empty-icon" aria-hidden="true">
        <svg width="36" height="36" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M3 13l2.6-7.2A1.2 1.2 0 0 1 6.7 5h10.6a1.2 1.2 0 0 1 1.1.8L21 13v5.8a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 18.8z M3 13h5l1.2 2.6h5.6L16 13h5"
            fill="none"
            stroke="#6C7378"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h2 className="today-empty-title">{t('today.emptyTitle')}</h2>
      <p className="today-empty-sub">{t('today.emptySub', { product: names[selection.sku] ?? selection.sku })}</p>
    </section>
  );
}

/** 전체 현황에서 항목을 열었을 때만 보이는 "← All products overview" (시안 L231 `showBack`). */
export function BackToAll() {
  const t = useT();
  const selection = useTodaySelection();
  if (selection === null || selection.sku !== null || selection.itemId === null) return null;
  return (
    <button type="button" className="btn b-tint b-sm today-back-all" onClick={selection.backToAll}>
      ← {t('today.ov.back')}
    </button>
  );
}
