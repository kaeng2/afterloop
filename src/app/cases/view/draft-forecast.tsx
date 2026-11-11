'use client';

/**
 * 답장 칸의 지금 예측을 위쪽 위험 곡선 카드와 함께 쓰는 상자 (T076). 답장 칸이 글을 바꿀 때마다 어댑터
 * (`forecast-client.ts`)의 값을 넣고, 곡선 카드가 "Your draft" 점과 큰 %로 읽는다. 값을 만들지 않는다.
 *
 * T098b: Send 뒤 칸(`../progress/case-progress.tsx`)이 보인 단계의 엔진 `scenarioRisk` 값을 `trail`에 넣으면
 * 곡선이 단계마다 점을 하나씩 늘린다 (시안 liveP). 칸을 떠나면 빈 배열로 되돌린다.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ReplyForecast } from '@/types';

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
  const [trail, setTrail] = useState<readonly number[]>(NO_TRAIL);
  const value = useMemo(() => ({ forecast, setForecast, trail, setTrail }), [forecast, trail]);
  return <DraftForecastContext.Provider value={value}>{children}</DraftForecastContext.Provider>;
}

export function useDraftForecast(): DraftForecastState {
  return useContext(DraftForecastContext);
}
