/**
 * 수 평가 → 추천 → 오토파일럿 판정 (SPEC v2.1 5장·6장). 공개 함수는 `recommend` 하나다.
 *
 * LLM 출력은 여기서 직접 쓰지 않는다 (원인 분류 결과는 `board.cause`로만 들어오고, 쓰기 전에 zod로 검증한다).
 * `Math.random`·`Date`·`performance.now`를 읽지 않으므로 같은 입력이면 항상 같은 결과다.
 * 실행은 항상 판매자 승인 후다 (`requiresApproval: true`).
 */
import type { Evaluation, RecommendFn } from '@/types';

import { fightLoss, offerLoss, pWinFor, refundLoss, repairLoss } from './oracle';
import type { EngineInput } from './params';
import { resolveEngineInput } from './params';
import { ALL_MOVE_ORDER, apiMoveFor, BLOCKED, isOfferInScope, isRepairInScope, pickBest } from './policy';
import { decideAutopilot } from './autopilot';

/** 계산하지 않은 수 (차단 이유만 남긴다). */
function blocked(move: Evaluation['move'], blockedBy: string): Evaluation {
  return { move, apiMove: null, expectedLossCents: null, blockedBy, branches: [] };
}

/**
 * 수를 fight → offer → refund → repair 순서로 평가한다.
 * - 대응할 API가 `allowedMoves`에 없는 수는 목록에서 뺀다 (SPEC 5장).
 * - 원인이 없으면 p_win을 정할 수 없어 어느 수도 계산하지 않는다 (`NO_CAUSE`).
 * - 제안은 색상·사이즈(B1·B2)만 계산한다 (`OFFER_SCOPE`).
 * - 무료 수선(repair, v2.16)은 `rules.repair.eligibleSubtypes`(B3) 사건에만 목록에 넣는다. 그 밖의 사건에는
 *   repair가 아예 없으므로 기존 세 수의 결과가 바뀌지 않는다. 가정값이 없으면 `REPAIR_PARAMS`로 막는다.
 */
function evaluateAll({ board, params, rules }: EngineInput): Evaluation[] {
  const pWin = pWinFor(board, params);
  const evaluations: Evaluation[] = [];

  for (const move of ALL_MOVE_ORDER) {
    if (move === 'repair' && !isRepairInScope(board, rules)) continue;
    const apiMove = apiMoveFor(move, board);
    if (apiMove === null) continue;

    if (pWin === null) {
      evaluations.push(blocked(move, BLOCKED.noCause));
      continue;
    }

    if (move === 'fight') {
      evaluations.push({ move, apiMove, ...fightLoss(board, params, pWin) });
      continue;
    }

    if (move === 'offer') {
      evaluations.push(
        isOfferInScope(board, rules)
          ? { move, apiMove, ...offerLoss(board, params, pWin) }
          : blocked(move, BLOCKED.offerScope),
      );
      continue;
    }

    if (move === 'repair') {
      const { repairCostCents, pAcceptRepair } = params;
      evaluations.push(
        repairCostCents === undefined || pAcceptRepair === undefined
          ? blocked(move, BLOCKED.repairParams)
          : { move, apiMove, ...repairLoss(board, params, pWin, repairCostCents, pAcceptRepair) },
      );
      continue;
    }

    evaluations.push({ move, apiMove, ...refundLoss(board, params) });
  }

  return evaluations;
}

/** 분쟁 1건의 추천. params·rules를 넘기지 않으면 config/params.json·config/rules.json을 읽는다. */
export const recommend: RecommendFn = (board, params, rules) => {
  const input = resolveEngineInput(board, params, rules);
  const all = evaluateAll(input);
  const best = pickBest(all);
  return {
    best,
    all,
    requiresApproval: true,
    autopilot: decideAutopilot(input.board, best, input.rules),
  };
};
