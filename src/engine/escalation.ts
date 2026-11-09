/**
 * 확대 위험 점수 (SPEC v2.1 7장). 공개 함수는 `escalationRisk` 하나다.
 *
 * 분쟁이 카드사 분쟁(chargeback)으로 커질 위험을 신호 네 개의 가중 합으로 낸다.
 * 신호를 **만드는** 일(메시지에서 카드사 언급 찾기, 어조 판별, 기한까지 남은 시간 계산)은
 * 이 파일이 하지 않는다. 여기서는 신호 → 점수만 한다 (`EscalationSignals` → `EscalationRisk`).
 *
 * 가중치와 구간 기준은 `config/rules.json`의 `escalation`에서만 온다.
 * `Math.random`·`Date`·`performance.now`를 읽지 않으므로 같은 입력이면 항상 같은 결과다.
 * 입력 객체는 바꾸지 않는다 (zod `parse`가 만든 사본만 읽는다).
 */
import { z } from 'zod';

import type { EscalationRisk, EscalationRiskFn, EscalationWeights } from '@/types';

import { nonNegativeIntSchema, rulesFromConfig } from './params';

/**
 * 응답 기한이 임박한 것으로 보는 시간 (SPEC 7장 "응답 기한 72시간 이내").
 * `PolicyConfig`에 이 기준을 담을 필드가 없어서 이 파일의 상수로 둔다
 * (계약에 넣어야 한다고 보면 보고서의 "컨트롤 타워에 요청할 결정"에 적는다).
 */
const DUE_SOON_HOURS = 72;

/** `parts`에 항상 이 순서로 네 개가 들어간다 (SPEC 7장 표 순서). */
const SIGNAL_ORDER = ['cardCompanyMention', 'unanswered', 'angryTone', 'dueWithin72h'] as const;

type SignalName = (typeof SIGNAL_ORDER)[number];

/**
 * 가중치·구간 기준. 점수는 정수로만 더하고(화면에 "3.5점"이 나오지 않게), 구간은 Watch가
 * High보다 높을 수 없다. 어기면 설정 오류이므로 ZodError를 던진다.
 */
const EscalationWeightsSchema = z
  .object({
    cardCompanyMention: nonNegativeIntSchema,
    unanswered: nonNegativeIntSchema,
    angryTone: nonNegativeIntSchema,
    dueWithin72h: nonNegativeIntSchema,
    watchFrom: nonNegativeIntSchema,
    highFrom: nonNegativeIntSchema,
  })
  .superRefine((weights, ctx) => {
    if (weights.watchFrom > weights.highFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['watchFrom'],
        message: `watchFrom ${weights.watchFrom} exceeds highFrom ${weights.highFrom}`,
      });
    }
  });

/**
 * 신호. `angryTone`은 LLM 판별이라 신뢰하지 않는 입력이고, `hoursToDue`는 화면이 계산해서
 * 넘기므로 유한한 수여야 한다 (NaN·Infinity는 설정·계산 오류).
 */
const EscalationSignalsSchema = z.object({
  mentionsCardCompany: z.boolean(),
  secondMessageUnanswered: z.boolean(),
  unansweredOver24h: z.boolean(),
  angryTone: z.boolean().nullable(),
  hoursToDue: z.number().finite(),
});

/**
 * 분쟁 1건의 확대 위험. rules를 넘기지 않으면 `config/rules.json`을 읽는다.
 *
 * - 무응답 두 신호(두 번째 문의 무응답, 24시간 넘게 무응답)는 둘 다여도 한 번만 더한다.
 * - `angryTone: null`은 판정 보류이므로 0점이다 (판매자가 답장한 뒤 구매자의 다음 메시지 전).
 * - 기한이 이미 지난 음수 시간도 "72시간 이내"에 든다.
 */
export const escalationRisk: EscalationRiskFn = (signals, rules) => {
  const checked = EscalationSignalsSchema.parse(signals);
  const weights = EscalationWeightsSchema.parse((rules ?? rulesFromConfig()).escalation) as EscalationWeights;

  const hit: Record<SignalName, boolean> = {
    cardCompanyMention: checked.mentionsCardCompany,
    unanswered: checked.secondMessageUnanswered || checked.unansweredOver24h,
    angryTone: checked.angryTone === true,
    dueWithin72h: checked.hoursToDue <= DUE_SOON_HOURS,
  };

  const parts: EscalationRisk['parts'] = SIGNAL_ORDER.map((signal) => ({
    signal,
    points: hit[signal] ? weights[signal] : 0,
  }));
  const score = parts.reduce((sum, part) => sum + part.points, 0);
  const band: EscalationRisk['band'] =
    score >= weights.highFrom ? 'High' : score >= weights.watchFrom ? 'Watch' : 'Low';

  return { score, band, parts };
};
