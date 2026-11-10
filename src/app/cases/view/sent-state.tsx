'use client';

/**
 * "이 화면에서 방금 보냈다" 한 가지 상태 (T061 전송 상태 표시). 답장 칸이 전송 성공 때 켜고 [Reset] 때 끈다.
 * 머리글의 위험 배지가 이 값을 보고 보낸 뒤 엔진 값(`riskAfterReply`)으로 바뀐다 — 화면은 값을 옮기기만 한다.
 *
 * 서버 전용 코드를 import하지 않는다.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type SentState = { sent: boolean; setSent: (value: boolean) => void };

const SentContext = createContext<SentState>({ sent: false, setSent: () => {} });

export function SentProvider({ children }: { children: ReactNode }) {
  const [sent, setSent] = useState(false);
  const value = useMemo(() => ({ sent, setSent }), [sent]);
  return <SentContext.Provider value={value}>{children}</SentContext.Provider>;
}

export function useSent(): SentState {
  return useContext(SentContext);
}
