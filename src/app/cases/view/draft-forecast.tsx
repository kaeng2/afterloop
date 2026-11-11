'use client';

/**
 * 답장 칸의 지금 예측을 위쪽 위험 곡선 카드와 함께 쓰는 상자 (T076). 답장 칸이 글을 바꿀 때마다 어댑터
 * (`forecast-client.ts`)의 값을 넣고, 곡선 카드가 "Your draft" 점과 큰 %로 읽는다. 값을 만들지 않는다.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { ReplyForecast } from '@/types';

type DraftForecastState = { forecast: ReplyForecast | null; setForecast: (value: ReplyForecast | null) => void };

const DraftForecastContext = createContext<DraftForecastState>({ forecast: null, setForecast: () => undefined });

export function DraftForecastProvider({ children }: { children: ReactNode }) {
  const [forecast, setForecast] = useState<ReplyForecast | null>(null);
  const value = useMemo(() => ({ forecast, setForecast }), [forecast]);
  return <DraftForecastContext.Provider value={value}>{children}</DraftForecastContext.Provider>;
}

export function useDraftForecast(): DraftForecastState {
  return useContext(DraftForecastContext);
}
