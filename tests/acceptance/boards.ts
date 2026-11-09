/**
 * 인수 테스트 공용 입력 (잠금 파일)
 * 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
 * 기준: SPEC v1
 *
 * 가디건 SNAD 분쟁. 필드 형태는 tests/fixtures/dispute-detail.inquiry-waiting-seller.json
 * (실제 샌드박스 응답, 합의 단계 INQUIRY)을 따른다. 합의 단계에는 provide_evidence 링크가 없다.
 *
 * 가정값·규칙은 라이브 config/가 아니라 고정 사본(params.fixture.json, rules.fixture.json)을 쓴다.
 * 이 파일은 엔진을 import하지 않는다 (실행 레인 테스트가 엔진 없이 돌도록).
 */
import type { BoardState, Evaluation, Params, ParamsConfig, RootCause, RulesConfig } from '@/types';

import paramsFixture from './params.fixture.json';
import rulesFixture from './rules.fixture.json';

/** 고정 가정값 (params.fixture.json의 value만 꺼낸 것) */
export const P: Params = Object.fromEntries(
  Object.entries((paramsFixture as ParamsConfig).params).map(([k, v]) => [k, v.value]),
) as Params;

/** 고정 정책 규칙 */
export const R = rulesFixture as unknown as RulesConfig;

export const CARDIGAN: BoardState = {
  disputeId: 'PP-R-TEST-CARDIGAN',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-29T06:09:25.608Z',
  amountCents: 4800,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  buyerDisputeCount90d: 0,
  hasDeliveredTracking: false,
  cause: { rootCause: 'B_EXPECTATION', confidence: 0.9, signals: ['color and size differ'], needsReview: false },
};

export function withCause(board: BoardState, rootCause: RootCause): BoardState {
  return { ...board, cause: { rootCause, confidence: 0.9, signals: ['test'], needsReview: false } };
}

export function byMove(all: Evaluation[], move: Evaluation['move']): Evaluation {
  const found = all.find((e) => e.move === move);
  if (!found) throw new Error(`${move} 평가가 없음`);
  return found;
}
