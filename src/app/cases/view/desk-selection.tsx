'use client';

/**
 * 선택지 카드 ↔ 답장 칸 연결 (T091, 시안 `state.path`·`state.busy`). 값을 만들지 않는다.
 *
 * - `path`: 지금 고른 수 (처음 = 엔진 최선 수). 글을 직접 고치면 `custom` (시안과 같다).
 * - `busy`: 초안 타이핑 효과 중 (카드·도구 버튼·Send가 꺼진다).
 * - `pick(move)`: 카드를 누르면 답장 칸이 등록한 처리 함수를 부른다 (답장 칸이 글·타이핑을 들고 있다).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import type { DeskPath } from '../desk-actions';
import type { Evaluation } from '@/types';

type Picker = (move: Evaluation['move']) => void;

export type DeskSelection = {
  path: DeskPath | null;
  busy: boolean;
  setPath: (path: DeskPath | null) => void;
  setBusy: (busy: boolean) => void;
  pick: (move: Evaluation['move']) => void;
  /** 답장 칸이 자기 처리 함수를 넣는다 (렌더 밖에서). */
  pickerRef: { current: Picker | null };
};

const noop = () => undefined;

const DeskSelectionContext = createContext<DeskSelection>({
  path: null,
  busy: false,
  setPath: noop,
  setBusy: noop,
  pick: noop,
  pickerRef: { current: null },
});

export function DeskSelectionProvider({ initialPath, children }: { initialPath: DeskPath | null; children?: ReactNode }) {
  const [path, setPath] = useState<DeskPath | null>(initialPath);
  const [busy, setBusy] = useState(false);
  const pickerRef = useRef<Picker | null>(null);
  const pick = useCallback((move: Evaluation['move']) => {
    pickerRef.current?.(move);
  }, []);
  const value = useMemo(() => ({ path, busy, setPath, setBusy, pick, pickerRef }), [path, busy, pick]);
  return <DeskSelectionContext.Provider value={value}>{children}</DeskSelectionContext.Provider>;
}

export function useDeskSelection(): DeskSelection {
  return useContext(DeskSelectionContext);
}
