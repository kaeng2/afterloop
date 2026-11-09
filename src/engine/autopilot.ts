/**
 * 오토파일럿 판정 (SPEC v2.1 6장). 순서대로 첫 번째로 걸리는 규칙만 적용한다.
 *
 *   1 원인 대분류 F        → skipped / suspected_abuse
 *   2 channel EXTERNAL     → skipped / card_company_case
 *   3 확신도 미만 또는 원인 없음 → skipped / low_confidence
 *   4 best가 돈이 움직이는 수 → awaiting_approval / money_moves
 *   5 그 외                → awaiting_approval / seller_review
 *
 * 분쟁에 대해서는 자동 실행(`auto`)이 없다. `auto`는 분쟁이 아닌 자주 묻는 질문(common_questions)뿐이고
 * 그 판정은 이 함수가 아니라 받은 메일을 다루는 쪽에서 한다.
 *
 * `reason`은 화면 로그 한 줄로 쓰는 영어 한 문장이다 (원문 8장 S4 문체). 숫자는 코드가 채우고
 * 구매자 개인정보는 넣지 않는다.
 */
import type { AutopilotDecision, BoardState, Evaluation, PolicyConfig } from '@/types';

import { categoryOf } from './policy';

/** 센트를 로그 문구용 달러로 (1953 → "$19.53"). */
function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** 1 → "1st", 3 → "3rd". 로그 문구용. */
function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** 악용 의심 로그에 붙는 근거 (반복 미수령 주장 + 배송 완료 기록). */
function abuseDetail(board: BoardState, rules: PolicyConfig): string {
  const repeated = board.buyerPriorInrDisputes >= rules.abuse.minPriorInrDisputes;
  if (!repeated || !board.hasDeliveredTracking) return '';
  return ` (${ordinal(board.buyerPriorInrDisputes + 1)} "not received" claim with delivery proof)`;
}

/** 분쟁 1건의 오토파일럿 판정. `best`는 추천 수 (없으면 null). */
export function decideAutopilot(
  board: BoardState,
  best: Evaluation | null,
  rules: PolicyConfig,
): AutopilotDecision {
  const cause = board.cause;
  const { skipCategories, skipChannels, minConfidence, moneyMoves } = rules.autopilot;

  if (cause && skipCategories.includes(categoryOf(cause.subtype))) {
    return {
      verdict: 'skipped',
      rule: 'suspected_abuse',
      reason: `Skipped: cause ${cause.subtype} is suspected abuse${abuseDetail(board, rules)}, so autopilot never acts on this dispute.`,
    };
  }

  if (skipChannels.includes(board.channel)) {
    return {
      verdict: 'skipped',
      rule: 'card_company_case',
      reason: 'Skipped: this is a card-company dispute raised outside PayPal, so autopilot never acts on it.',
    };
  }

  if (!cause) {
    return {
      verdict: 'skipped',
      rule: 'low_confidence',
      reason: 'Skipped: no cause has been classified yet, so check the type before anything is sent.',
    };
  }

  if (cause.confidence < minConfidence) {
    return {
      verdict: 'skipped',
      rule: 'low_confidence',
      reason: `Skipped: cause ${cause.subtype} confidence ${cause.confidence.toFixed(2)} is below ${minConfidence.toFixed(2)}, so check the type before anything is sent.`,
    };
  }

  if (best && moneyMoves.includes(best.move)) {
    return {
      verdict: 'awaiting_approval',
      rule: 'money_moves',
      reason: `Waiting for your approval: ${best.move} is the lowest expected-loss option (${usd(best.expectedLossCents as number)}) and it moves money.`,
    };
  }

  return {
    verdict: 'awaiting_approval',
    rule: 'seller_review',
    reason: best
      ? `Waiting for your review: ${best.move} is the lowest expected-loss option (${usd(best.expectedLossCents as number)}) and no money moves yet.`
      : 'Waiting for your review: no allowed move is available, so this dispute needs manual handling.',
  };
}
