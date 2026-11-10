/**
 * 견본 화면의 비교 카드 값 (T047 보완 C). **숫자를 적지 않고 엔진으로 구한다.**
 *
 * 서연 꼴 보드 하나(합의 단계 · 미수령 · 분쟁 금액 · 링크 4개)를 두 벌로 만들어 `recommend`에 넣는다.
 *  - 전: 추적 없음 + 원인 A1 (규칙)  → "PayPal 정보만"
 *  - 후: 추적 있음 + 원인 A2 (규칙)  → "배송사 정보를 더하면"
 * 표시는 `toDollarsRounded`만 한다. 센트 값은 그대로 함께 둔다 (SPEC 2장).
 * PayPal·LLM·네트워크 호출 없음. 견본 데이터다 (`Demo data` 배지를 붙인다).
 */
import { recommend } from '@/engine/recommend';
import type { BoardState, Cause, Evaluation, Params, PolicyConfig } from '@/types';

import { toDollarsRounded } from '../../_shared/money';

/** 입력 보드의 공통 부분 (서연 꼴. 견본이라 분쟁 번호는 가짜다). */
const SAMPLE_BASE: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause'> = {
  disputeId: 'PREVIEW-SAMPLE',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:00:00Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  buyerPriorInrDisputes: 0,
  isDemo: true,
};

function ruleCause(subtype: Cause['subtype']): Cause {
  return { subtype, confidence: 1, evidence: [], needsReview: false, source: 'rule' };
}

export const SAMPLE_BEFORE: BoardState = {
  ...SAMPLE_BASE,
  hasTracking: false,
  hasDeliveredTracking: false,
  cause: ruleCause('A1'),
};

export const SAMPLE_AFTER: BoardState = {
  ...SAMPLE_BASE,
  hasTracking: true,
  hasDeliveredTracking: false,
  cause: ruleCause('A2'),
};

export type CompareSideView = {
  move: Evaluation['move'] | null;
  /** 엔진 값 그대로 (센트). 추천이 없으면 `null`. */
  expectedLossCents: number | null;
  /** 표시 글자. 추천이 없으면 `null` (화면은 `common.noValue`). */
  display: string | null;
};

export type CompareSampleView = { before: CompareSideView; after: CompareSideView };

function sideOf(board: BoardState, params?: Params, rules?: PolicyConfig): CompareSideView {
  const best = recommend(board, params, rules).best;
  const cents = best?.expectedLossCents ?? null;
  return {
    move: best?.move ?? null,
    expectedLossCents: cents,
    display: cents === null ? null : toDollarsRounded(cents),
  };
}

/** 비교 카드 견본 값. `params`·`rules`를 주지 않으면 `config/`의 값을 쓴다. */
export function compareSample(params?: Params, rules?: PolicyConfig): CompareSampleView {
  return { before: sideOf(SAMPLE_BEFORE, params, rules), after: sideOf(SAMPLE_AFTER, params, rules) };
}
