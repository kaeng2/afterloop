'use client';

/**
 * 선택지 카드 ↔ 답장 칸 연결 (T091, 시안 `state.path`·`state.busy`). 값을 만들지 않는다.
 *
 * - `path`: 지금 고른 수 (T122a 시안 v6: 처음 = `custom` — 빈 답장). 글을 직접 고치면 `custom` (시안과 같다).
 * - `busy`: 초안 타이핑 효과 중 (카드·도구 버튼·Send가 꺼진다).
 * - `pick(move)`: 카드를 누르면 답장 칸이 등록한 처리 함수를 부른다 (답장 칸이 글·타이핑을 들고 있다).
 * - `aiOn` (T122a, 시안 v6 `state.aiOn`, 처음 꺼짐): "✦ AI Respond now" 스위치. 켜면 선택지 카드·AI 초안 타이핑·점검이
 *   펼쳐지고, 끄면 빈 답장 칸으로 돌아간다. `toggleAi()`가 값을 바꾸고 답장 칸이 등록한 처리 함수(`aiRef`)를 부른다
 *   (시안 `toggleAi`: 켜면서 빈 글이면 AI 초안 타이핑). 렌더 중에 상태를 바꾸지 않는다 (T103).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import type { DeskPath } from '../desk-actions';
import type { Evaluation } from '@/types';

type Picker = (move: Evaluation['move']) => void;
type AiHandler = (on: boolean) => void;

export type DeskSelection = {
  path: DeskPath | null;
  busy: boolean;
  setPath: (path: DeskPath | null) => void;
  setBusy: (busy: boolean) => void;
  pick: (move: Evaluation['move']) => void;
  /** 답장 칸이 자기 처리 함수를 넣는다 (렌더 밖에서). */
  pickerRef: { current: Picker | null };
  /** T122a: "✦ AI Respond now" 스위치 (처음 꺼짐). */
  aiOn: boolean;
  toggleAi: () => void;
  /** 답장 칸이 스위치 처리 함수를 넣는다 (렌더 밖에서). */
  aiRef: { current: AiHandler | null };
};

const noop = () => undefined;

// 공급자가 없으면(스위치를 바꿀 수 없는 칸) AI 칸 전체를 보인다 — 꺼진 채 갇히지 않게. 실제 화면(`case-detail.tsx`)은
// 늘 공급자 안에서 처음 꺼짐(시안 v6)으로 시작한다.
const DeskSelectionContext = createContext<DeskSelection>({
  path: null,
  busy: false,
  setPath: noop,
  setBusy: noop,
  pick: noop,
  pickerRef: { current: null },
  aiOn: true,
  toggleAi: noop,
  aiRef: { current: null },
});

export function DeskSelectionProvider({
  initialPath,
  initialAiOn = false,
  children,
}: {
  initialPath: DeskPath | null;
  /** 시험용 (기본 = 시안 v6 처음 상태: 꺼짐). */
  initialAiOn?: boolean;
  children?: ReactNode;
}) {
  const [path, setPath] = useState<DeskPath | null>(initialPath);
  const [busy, setBusy] = useState(false);
  const [aiOn, setAiOn] = useState(initialAiOn);
  const pickerRef = useRef<Picker | null>(null);
  const aiRef = useRef<AiHandler | null>(null);
  const aiNow = useRef(initialAiOn);
  const pick = useCallback((move: Evaluation['move']) => {
    pickerRef.current?.(move);
  }, []);
  const toggleAi = useCallback(() => {
    const on = !aiNow.current;
    aiNow.current = on;
    setAiOn(on);
    aiRef.current?.(on);
  }, []);
  const value = useMemo(
    () => ({ path, busy, setPath, setBusy, pick, pickerRef, aiOn, toggleAi, aiRef }),
    [path, busy, pick, aiOn, toggleAi],
  );
  return <DeskSelectionContext.Provider value={value}>{children}</DeskSelectionContext.Provider>;
}

export function useDeskSelection(): DeskSelection {
  return useContext(DeskSelectionContext);
}
