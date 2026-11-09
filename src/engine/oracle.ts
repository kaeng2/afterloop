/**
 * 기대 손실 계산 (PRD 6-2). 순수 함수만 둔다: 같은 입력이면 항상 같은 출력.
 *
 *   L_fight    = (1 − p_win)(A + f) + t_fight + c_fight·V
 *   L_offer(x) = p_acc(x)·(x·A + c_acc·V) + (1 − p_acc(x))·L_fight + t_offer
 *   L_refund   = A + c_refund·V
 *   p_acc(x)   = min(0.9, 0.35 + 2.5x)
 *   원인 F이면 V = 0
 *
 * 중간 계산은 실수로 하고, 결과를 내보낼 때만 센트 단위로 반올림한다.
 */
import type { BoardState, Evaluation, MoveType, Params } from './types';

export const P_ACCEPT_BASE = 0.35;
export const P_ACCEPT_SLOPE = 2.5;
export const P_ACCEPT_CAP = 0.9;

/** 제안 비율 x에 대한 구매자 수락 확률. */
export function pAccept(x: number): number {
  if (!(x >= 0 && x <= 1)) throw new RangeError(`제안 비율은 0~1이어야 합니다: ${x}`);
  return Math.min(P_ACCEPT_CAP, P_ACCEPT_BASE + P_ACCEPT_SLOPE * x);
}

/**
 * 센트 반올림 (0.5는 올림). 0.725 × 1920 같은 계산은 부동소수 오차로 1391.9999… 이 될 수 있으므로
 * 먼저 소수 6자리에서 정리한 뒤 반올림한다. 손실은 0 이상이라 Math.round의 음수 처리 문제는 없다.
 */
export function roundCents(value: number): number {
  return Math.round(Math.round(value * 1e6) / 1e6);
}

/** 재구매 가치 V. 원인 F(악용)이면 0. */
export function repurchaseValue(board: BoardState, params: Params): number {
  return board.cause?.rootCause === 'F_ABUSE' ? 0 : params.repurchaseValueCents;
}

/**
 * 싸우는 수의 실행 API. 합의 단계(INQUIRY)에는 provide_evidence가 없어서 메시지로 소명한다.
 * 외부 분쟁(EXTERNAL)은 협상 메시지 없이 증빙으로만 대응한다 (R5).
 */
export function fightApiMove(board: BoardState): MoveType {
  if (board.channel === 'EXTERNAL') return 'provide_evidence';
  return board.stage === 'INQUIRY' ? 'send_message' : 'provide_evidence';
}

type Raw = { fight: number; offerAccept: number; offer: number; refund: number; pAcc: number; x: number };

function rawLosses(board: BoardState, params: Params): Raw {
  const A = board.amountCents;
  const V = repurchaseValue(board, params);
  const x = params.offerRate;
  const pAcc = pAccept(x);
  const fight = (1 - params.pWinBase) * (A + params.feeCents) + params.tFightCents + params.cFight * V;
  const offerAccept = x * A + params.cAccept * V;
  const offer = pAcc * offerAccept + (1 - pAcc) * fight + params.tOfferCents;
  const refund = A + params.cRefund * V;
  return { fight, offerAccept, offer, refund, pAcc, x };
}

/**
 * 규칙을 적용하기 전의 세 가지 수 평가. 순서는 항상 fight → offer → refund.
 * params는 resolveParams()로 검증된 값이어야 한다.
 */
export function evaluateAll(board: BoardState, params: Params): Evaluation[] {
  const r = rawLosses(board, params);
  const V = repurchaseValue(board, params);
  const A = board.amountCents;

  const fight: Evaluation = {
    move: 'fight',
    apiMove: fightApiMove(board),
    expectedLossCents: roundCents(r.fight),
    branches: [
      { label: 'win', prob: params.pWinBase, lossCents: roundCents(params.cFight * V) },
      { label: 'lose', prob: 1 - params.pWinBase, lossCents: roundCents(A + params.feeCents + params.cFight * V) },
    ],
  };

  const offer: Evaluation = {
    move: 'offer',
    apiMove: 'make_offer',
    expectedLossCents: roundCents(r.offer),
    offerRate: r.x,
    branches: [
      { label: 'accept', prob: r.pAcc, lossCents: roundCents(r.offerAccept) },
      { label: 'reject', prob: 1 - r.pAcc, lossCents: roundCents(r.fight) },
    ],
  };

  const refund: Evaluation = {
    move: 'refund',
    apiMove: 'accept_claim',
    expectedLossCents: roundCents(r.refund),
    branches: [{ label: 'refund', prob: 1, lossCents: roundCents(r.refund) }],
  };

  return [fight, offer, refund];
}
