/**
 * 기대 손실 (SPEC v2.1 5장). 순수 함수만 둔다: 같은 입력이면 항상 같은 결과.
 *
 *   L_fight  = (1 − p_win)(A + f) + t
 *   L_offer  = p_acc·x·A + (1 − p_acc)(1 − p_win)(A + f) + t   (거절되면 다투기로 가지만 t는 한 번만)
 *   L_refund = A + t
 *   L_repair = p_rep·R + (1 − p_rep)(1 − p_win)(A + f) + t   (v2.16 B3 품질 무료 수선, R = 수선 판매자 비용)
 *
 * f(분쟁 수수료)는 질 때만 부과한다. 제안이 수락되면, 환불하면 면제 (SPEC 5장, 13장 Q7).
 * 재구매 가치 V·이탈 확률 c·p_acc 곡선은 v2에서 쓰지 않는다.
 *
 * 중간 계산은 실수로 하고, 내보낼 때만 센트로 사사오입한다 (검토 결정 5).
 */
import type { BoardState, Evaluation, Params } from '@/types';

type Branches = Evaluation['branches'];

/**
 * 센트 사사오입. 0.72 × 0.15 × 4800 같은 계산은 부동소수 오차로 1952.9999… 가 될 수 있어
 * 소수 6자리에서 먼저 정리한 뒤 반올림한다. 손실은 0 이상이라 Math.round의 음수 처리 문제는 없다.
 */
export function roundCents(value: number): number {
  return Math.round(Math.round(value * 1e6) / 1e6);
}

/**
 * 다퉈서 이길 확률. 추적(배송) 기록이 있으면 유형별 상향값을 쓰고, 그 유형이 없으면 기본값을 쓴다.
 * 원인이 없으면 계산하지 않는다 (null).
 */
export function pWinFor(board: BoardState, params: Params): number | null {
  const subtype = board.cause?.subtype;
  if (!subtype) return null;
  if (board.hasTracking) return params.pWinWithTracking[subtype] ?? params.pWin[subtype];
  return params.pWin[subtype];
}

/**
 * 부분 환불 제안 금액 x·A (센트 정수). 화면의 기대 손실(`offerLoss`)과 실제로 PayPal에 보내는
 * 계획(`planMove`의 `amountCents`)이 같은 금액을 쓰도록, 금액 계산은 이 함수 하나로만 한다.
 */
export function offerAmountCents(board: BoardState, params: Params): number {
  return roundCents(params.offerRate * board.amountCents);
}

/** 수 하나의 기대 손실과 트리 분기 (SPEC 5장). */
export type MoveLoss = { expectedLossCents: number; branches: Branches };

/** 다투기: 이기면 대응 시간 비용만, 지면 금액 + 수수료 + 시간 비용. */
export function fightLoss(board: BoardState, params: Params, pWin: number): MoveLoss {
  const a = board.amountCents;
  const f = params.feeCents;
  const t = params.timeCostCents;
  return {
    expectedLossCents: roundCents((1 - pWin) * (a + f) + t),
    branches: [
      { label: 'win', prob: pWin, lossCents: roundCents(t) },
      { label: 'lose', prob: 1 - pWin, lossCents: roundCents(a + f + t) },
    ],
  };
}

/**
 * 부분 환불 제안: 수락되면 x·A, 거절되면 다투기 분기로 간다 (t는 한 번만).
 *
 * 제안 금액 x·A는 실제로 PayPal로 보내는 돈이라 센트 정수여야 한다(`"7.20"`). 그래서 x·A만
 * 먼저 센트로 사사오입한 뒤 식에 넣는다. 이렇게 하면 트리 분기(Σ 확률 × 손실)가 기대 손실과
 * 정확히 맞는다. $48처럼 x·A가 이미 정수인 금액에서는 식을 그대로 푼 값과 같다 (720¢).
 */
export function offerLoss(board: BoardState, params: Params, pWin: number): MoveLoss {
  const a = board.amountCents;
  const f = params.feeCents;
  const t = params.timeCostCents;
  const pAcc = params.pAccept;
  const offerCents = offerAmountCents(board, params);
  return {
    expectedLossCents: roundCents(pAcc * offerCents + (1 - pAcc) * (1 - pWin) * (a + f) + t),
    branches: [
      { label: 'accept', prob: pAcc, lossCents: offerCents + t },
      { label: 'reject_win', prob: (1 - pAcc) * pWin, lossCents: roundCents(t) },
      { label: 'reject_lose', prob: (1 - pAcc) * (1 - pWin), lossCents: roundCents(a + f + t) },
    ],
  };
}

/**
 * 무료 수선 제안 (SPEC v2.16, AC35): 수락되면 수선비 R(왕복 배송비는 손님 부담), 거절되면 다투기 분기 (t는 한 번만).
 * 돈이 PayPal로 움직이지 않는다 (실행은 send_message). 수선비는 센트 정수 가정값이라 분기 Σ가 기대 손실과 맞는다.
 */
export function repairLoss(
  board: BoardState,
  params: Params,
  pWin: number,
  repairCostCents: number,
  pAcceptRepair: number,
): MoveLoss {
  const a = board.amountCents;
  const f = params.feeCents;
  const t = params.timeCostCents;
  const pAcc = pAcceptRepair;
  return {
    expectedLossCents: roundCents(pAcc * repairCostCents + (1 - pAcc) * (1 - pWin) * (a + f) + t),
    branches: [
      { label: 'accept', prob: pAcc, lossCents: roundCents(repairCostCents + t) },
      { label: 'reject_win', prob: (1 - pAcc) * pWin, lossCents: roundCents(t) },
      { label: 'reject_lose', prob: (1 - pAcc) * (1 - pWin), lossCents: roundCents(a + f + t) },
    ],
  };
}

/** 전액 환불(클레임 수락): 수수료는 면제, 금액 + 대응 시간 비용. */
export function refundLoss(board: BoardState, params: Params): MoveLoss {
  const total = board.amountCents + params.timeCostCents;
  return {
    expectedLossCents: roundCents(total),
    branches: [{ label: 'refund', prob: 1, lossCents: roundCents(total) }],
  };
}
