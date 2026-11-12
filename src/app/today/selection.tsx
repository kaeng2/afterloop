'use client';

/**
 * Today 화면 안 고르기 상태 (T106, 차이 목록 F1-18 · F1-19 · F1-47, 시안 `setState({sel})`·`setState({sku})`).
 *
 * - 목록 항목·상품 칩을 누르면 **서버 왕복 없이** 이 상자만 바뀐다 (링크·router 이동 없음). 상세는 첫 요청에서
 *   모두 그려 두었고(`page.tsx`), 고른 것만 보인다(`DetailPane`, 나머지는 `hidden`) — 서연 답장 칸·Done today·
 *   "+$N just now" 같은 화면 상태가 항목을 오가도 그대로 남는다.
 * - 칩을 눌러도 고른 항목은 그대로다 (시안 L688).
 * - 주소(`?item`·`?sku`)는 `history.replaceState`로 맞춘다 → 새로고침·공유 때 같은 화면 (서버가 같은 값으로 처음 상태를 정한다).
 *
 * 읽기·쓰기·계산 없음.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { todaySearch } from './screen-model';

type Selection = {
  /** 고른 항목 id (`null` = 없음). */
  itemId: string | null;
  /** 고른 상품 SKU (`null` = All products). */
  sku: string | null;
  select: (itemId: string) => void;
  setSku: (sku: string | null) => void;
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

export function TodaySelectionProvider({
  initialItem,
  initialSku,
  children,
}: {
  initialItem: string | null;
  initialSku: string | null;
  children?: ReactNode;
}) {
  const [itemId, setItemId] = useState<string | null>(initialItem);
  const [sku, setSkuState] = useState<string | null>(initialSku);

  const select = useCallback(
    (next: string) => {
      setItemId(next);
      syncAddress(sku, next);
    },
    [sku],
  );
  const setSku = useCallback(
    (next: string | null) => {
      setSkuState(next);
      // 고른 항목은 그대로 (시안 L688)
      syncAddress(next, itemId);
    },
    [itemId],
  );

  const value = useMemo(() => ({ itemId, sku, select, setSku }), [itemId, sku, select, setSku]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/** 상자 밖(견본·테스트)에서는 `null` — 부르는 쪽이 받은 값을 그대로 쓴다. */
export function useTodaySelection(): Selection | null {
  return useContext(SelectionContext);
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

/** 고른 항목이 없을 때만 보이는 글. */
export function DetailEmpty({ children }: { children?: ReactNode }) {
  const selection = useTodaySelection();
  return selection?.itemId === null || selection === null ? <>{children}</> : null;
}
