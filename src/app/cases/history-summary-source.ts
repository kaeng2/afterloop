/**
 * 사건 기록 AI 요약 자리 — **서버용 어댑터** (T076, SPEC v2.11 2장). **서버에서만** 부른다.
 *
 * AI 요약(T077: `summarizeCaseHistory(input, deps)`, `src/ai/history.ts`)이 아직 이 브랜치에 없다.
 * **지금은 `null`** 을 돌려준다 → 사건 기록 카드의 요약 줄을 숨긴다.
 *
 * 부르는 곳은 사례를 읽는 서버 함수 `view/load.ts`의 `loadCase`(AI 초안을 만드는 같은 길)다 — AI 캐시 만들기
 * 스크립트가 도는 경로라 T079 뒤에는 요약도 캐시에 들어간다.
 *
 * **T079(연결)에서 바꿀 곳은 이 함수 몸통뿐이다**:
 * ```ts
 * const llm = getLlm(); if (!llm.ok) return null;
 * const result = await summarizeCaseHistory({ events: [...events], locale: 'en' }, { llm: llm.llm });
 * return result.ok ? result.summary : null; // invalid_output·ai_unavailable이면 줄을 숨긴다
 * ```
 */
import 'server-only';

import type { CaseEvent } from '@/types';

/** 사건 기록 요약 (영어 1~2문장). 쓸 수 없으면 `null`. */
export async function loadHistorySummary(events: readonly CaseEvent[]): Promise<string | null> {
  void events;
  return null;
}
