/**
 * 인수 테스트 공용 입력 (잠금 파일)
 * 기대값 출처: PRD v2 10-3 + 검토 M1·M2 / 기획자 승인 2026-11-09
 * 기준: SPEC v2
 *
 * 분쟁 D1(박지호, 가디건 색상)과 D3(buyer_m, 비니 세트 반복 미수령)은 원문 6-4의 샌드박스 분쟁이다.
 * 가정값·규칙은 라이브 config/가 아니라 고정 사본(params.fixture.json, rules.fixture.json)을 쓴다.
 * 이 파일은 엔진을 import하지 않는다 (실행 레인 테스트가 엔진 없이 돌도록).
 */
import type { BoardState, Cause, Evaluation, Params, ParamsConfig, PolicyConfig, Subtype } from '@/types';

import paramsFixture from './params.fixture.json';
import rulesFixture from './rules.fixture.json';

/** 고정 가정값 (params.fixture.json의 params에서 value만 꺼낸 것) */
export const P: Params = Object.fromEntries(
  Object.entries((paramsFixture as unknown as ParamsConfig).params).map(([k, v]) => [k, v.value]),
) as Params;

/** 고정 정책 규칙 */
export const R = rulesFixture as unknown as PolicyConfig;

/** 원인. 확신도 0.7 미만이면 needsReview */
export function cause(subtype: Subtype, confidence = 0.9, source: Cause['source'] = 'llm'): Cause {
  return { subtype, confidence, evidence: ['test'], needsReview: confidence < 0.7, source };
}

/** D1 박지호: Knit Cardigan, Oat $48, SNAD → B1 색상, 합의 단계, 추적 미등록 */
export const D1_JIHO: BoardState = {
  disputeId: 'PP-R-TEST-D1',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-12T17:00:00Z',
  amountCents: 4800,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  hasTracking: false,
  hasDeliveredTracking: false,
  buyerPriorInrDisputes: 0,
  isDemo: false,
  cause: cause('B1'),
};

/** D3 buyer_m***: Beanie + Scarf Set $35, INR → F1 반복 미수령 주장 (이전 미수령 분쟁 2건), 추적·배송 완료 */
export const D3_BUYER_M: BoardState = {
  disputeId: 'PP-R-TEST-D3',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-12T17:00:00Z',
  amountCents: 3500,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  hasTracking: true,
  hasDeliveredTracking: true,
  buyerPriorInrDisputes: 2,
  isDemo: false,
  cause: cause('F1', 1, 'rule'),
};

/** AC11·AC12(실행)용 분쟁. D1과 같다 ($48) */
export const CARDIGAN: BoardState = D1_JIHO;

export function withSubtype(board: BoardState, subtype: Subtype, confidence = 0.9): BoardState {
  return { ...board, cause: cause(subtype, confidence) };
}

export function byMove(all: Evaluation[], move: Evaluation['move']): Evaluation {
  const found = all.find((e) => e.move === move);
  if (!found) throw new Error(`${move} 평가가 없음`);
  return found;
}
