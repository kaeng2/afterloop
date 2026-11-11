'use client';

/**
 * 답장 칸의 지금 예측을 위쪽 위험 곡선 카드와 함께 쓰는 상자 (T076). 답장 칸이 글을 바꿀 때마다 어댑터
 * (`forecast-client.ts`)의 값을 넣고, 곡선 카드가 "Your draft" 점과 큰 %로 읽는다. 값을 만들지 않는다.
 *
 * T098b: Send 뒤 칸(`../progress/case-progress.tsx`)이 보인 단계의 엔진 `scenarioRisk` 값을 `trail`에 넣으면
 * 곡선이 단계마다 점을 하나씩 늘린다 (시안 liveP). 칸을 떠나면 빈 배열로 되돌린다.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ReplyForecast } from '@/types';

/**
 * T103: 같은 점들이면 같은 배열로 본다. `setTrail`이 내용이 같은 새 배열을 받으면 상태를 바꾸지 않는다 —
 * 바꾸면 이 상자를 읽는 답장 칸이 다시 그려지고, Send 뒤 칸이 또 새 배열을 넣어 끝없이 갱신된다
 * (기본 우선순위 갱신이 멈추지 않아 목록 링크의 라우터 전환이 커밋되지 못했다).
 */
export function sameTrail(a: readonly number[], b: readonly number[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((value, index) => Object.is(value, b[index]));
}

type DraftForecastState = {
  forecast: ReplyForecast | null;
  setForecast: (value: ReplyForecast | null) => void;
  trail: readonly number[];
  setTrail: (value: readonly number[]) => void;
};

const NO_TRAIL: readonly number[] = [];

const DraftForecastContext = createContext<DraftForecastState>({
  forecast: null,
  setForecast: () => undefined,
  trail: NO_TRAIL,
  setTrail: () => undefined,
});

export function DraftForecastProvider({ children }: { children: ReactNode }) {
  const [forecast, setForecast] = useState<ReplyForecast | null>(null);
  const [trail, setTrailState] = useState<readonly number[]>(NO_TRAIL);
  const setTrail = useCallback((next: readonly number[]) => {
    setTrailState((now) => (sameTrail(now, next) ? now : next));
  }, []);
  const value = useMemo(() => ({ forecast, setForecast, trail, setTrail }), [forecast, trail, setTrail]);
  return <DraftForecastContext.Provider value={value}>{children}</DraftForecastContext.Provider>;
}

export function useDraftForecast(): DraftForecastState {
  return useContext(DraftForecastContext);
}
