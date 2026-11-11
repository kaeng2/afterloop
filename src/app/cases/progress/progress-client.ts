/**
 * Send 뒤 "What happens next · Simulated" 칸의 **브라우저용 어댑터** (T092, SPEC v2.15 8-4장).
 *
 * 엔진 순수 함수를 그대로 부른다 (`forecast-client.ts`와 같은 방식). 엔진이 예외를 던지면 `null` → 그 값만 숨는다.
 * - `scenarioRiskClient` → `scenarioRisk(input, SCENARIO_STEPS)` (`@/engine/forecast`, 단계 신호 변화는 config `scenario`, 가정)
 * - `actionSavingsClient` → `actionSavings(board, move)` (`@/engine/savings`, "+$N kept" 토스트 금액)
 *
 * 이 파일은 숫자를 만들지 않는다. PayPal·AI·배송사를 부르지 않는다 (서버 코드 import 없음).
 */
import { scenarioRisk } from '@/engine/forecast';
import { actionSavings } from '@/engine/savings';
import type { BoardState, Evaluation, ReplyForecastInput, ScenarioPoint, ScenarioStepKind } from '@/types';

/** 시안의 진행 순서 (보낸 답장 → 손님 답장 → 배송사에 전달 → 세관 통과). 엔진 `ScenarioStepKind` 그대로. */
export const SCENARIO_STEPS: readonly ScenarioStepKind[] = ['sent', 'buyer_reply', 'forwarded', 'cleared'];

export type ScenarioInput = ReplyForecastInput & { translated?: boolean };
export type ScenarioRiskClient = (input: ScenarioInput) => ScenarioPoint[] | null;
export type ActionSavingsClient = (board: BoardState, move: Evaluation['move']) => number | null;

/** 단계마다 차지백 위험 (엔진). 쓸 수 없으면 `null`. */
export const scenarioRiskClient: ScenarioRiskClient = (input) => {
  try {
    return scenarioRisk(input, [...SCENARIO_STEPS]);
  } catch {
    return null;
  }
};

/** 이 수를 실행했을 때 "이번 주" 카드에 더할 값 (센트, 엔진). 쓸 수 없으면 `null`. */
export const actionSavingsClient: ActionSavingsClient = (board, move) => {
  try {
    return actionSavings(board, move);
  } catch {
    return null;
  }
};
