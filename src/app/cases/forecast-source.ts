/**
 * 예측 자리 — **서버용 어댑터** (T076, SPEC v2.11 8-2장, 계약 9부). **서버에서만** 부른다.
 *
 * 엔진 예측(T075: `riskCurve`·`weeklySummary`·수별 예측)이 아직 이 브랜치에 없다. 화면은 이 파일의 함수만 부르고,
 * 함수는 **지금 모두 `null`(쓸 수 없음)** 을 돌려준다 → 화면은 그 칸(위험 곡선·지금 위험 %·이번 주 "지킬 수 있는 돈"·
 * AI 초안 수·선택지 카드의 차지백 %)을 숨기고 나머지는 그대로 보인다 (= 사람 결정의 대체안 화면).
 *
 * **T079(연결)에서 바꿀 곳은 이 파일의 함수 몸통뿐이다** (부르는 쪽·보기용 값·화면은 그대로):
 * - `loadRiskCurve` → `riskCurve(events, board)` (`@/engine/forecast`)
 * - `loadWeeklySummary` → `weeklySummary({ boards, aiDrafts, usesDemoData })` (aiDrafts = AI 캐시의 답장 초안 수)
 * - `loadMoveForecasts` → T075의 수별 예측 함수 (예: `forecastMoves`). `pChargeback`만 옮긴다 —
 *   기대 손실은 화면이 `recommend` 값을 그대로 쓴다 (이 함수의 금액을 쓰지 않는다)
 *
 * 화면은 숫자를 만들지 않는다 — 여기서 받은 값을 옮기기만 한다.
 */
import 'server-only';

import type { BoardState, CaseEvent, EscalationSignals, RiskPoint, WeeklySummary } from '@/types';

import type { MoveForecast } from './desk-model';

export type { MoveForecast };

/** 위험 곡선: 사건마다 점 하나 (`events`와 길이·순서 같음). 쓸 수 없으면 `null`. */
export function loadRiskCurve(events: readonly CaseEvent[], board: BoardState): RiskPoint[] | null {
  void events;
  void board;
  return null;
}

/** 왼쪽 "이번 주" 카드. 쓸 수 없으면 `null` (열린 분쟁 수와 사실 한 줄만 보인다). */
export function loadWeeklySummary(input: { boards: readonly BoardState[]; usesDemoData: boolean }): WeeklySummary | null {
  void input;
  return null;
}

/** 선택지 카드의 수별 예상 차지백 %. 쓸 수 없으면 `null` (% 줄을 숨긴다). */
export function loadMoveForecasts(input: {
  board: BoardState;
  signals: EscalationSignals | null;
  delayDays: number;
  anchorText: string | null;
}): MoveForecast[] | null {
  void input;
  return null;
}
