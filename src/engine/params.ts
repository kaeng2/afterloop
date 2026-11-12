/**
 * 가정값·정책 설정 읽기와 검증 (SPEC v2.1 5장·6장·12장).
 *
 * 가정값은 `config/params.json`, 정책 기준값은 `config/rules.json`에서만 온다.
 * 이 파일에 숫자를 직접 쓰지 않는다 (CLAUDE.md 공통 규칙).
 *
 * LLM이 만든 원인(`board.cause`)과 PayPal 응답에서 온 보드는 신뢰하지 않는 입력이므로
 * 계산에 쓰기 전에 zod로 검증한다: 확률 0~1, 금액 0 이상 정수, offerRate ≤ rules.offer.maxRate.
 */
import { z } from 'zod';

import paramsConfigJson from '../../config/params.json';
import rulesConfigJson from '../../config/rules.json';
import type { BoardState, Params, ParamsConfig, PolicyConfig, Subtype } from '@/types';

const probability = z.number().min(0).max(1);
const cents = z.number().int().nonnegative();
const count = z.number().int().nonnegative();

/**
 * 세부 유형 16개. `Record<Subtype, ...>`으로 적어서 유형이 빠지면 컴파일이 깨지게 한다
 * (`src/types.ts`의 `Subtype`이 늘어나면 여기도 늘려야 한다).
 */
const pWinShape: Record<Subtype, typeof probability> = {
  A1: probability,
  A2: probability,
  A3: probability,
  A4: probability,
  B1: probability,
  B2: probability,
  B3: probability,
  B4: probability,
  B5: probability,
  C1: probability,
  C2: probability,
  C3: probability,
  D1: probability,
  E1: probability,
  F1: probability,
  F2: probability,
};

/** 0 이상 정수인 설정값 (`escalation.ts`의 확대 위험 가중치 검증도 이 스키마를 쓴다). */
export const nonNegativeIntSchema = count;

/** 세부 유형 목록 (고정 순서). */
export const SUBTYPES = Object.keys(pWinShape) as [Subtype, ...Subtype[]];

const subtypeSchema = z.enum(SUBTYPES);
const categorySchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F']);
const channelSchema = z.enum(['INTERNAL', 'EXTERNAL']);
const stageSchema = z.enum(['INQUIRY', 'CHARGEBACK', 'PRE_ARBITRATION', 'ARBITRATION']);
/** 실행 API와 수 (`plan.ts`의 평가 검증도 같은 스키마를 쓴다). */
export const apiMoveSchema = z.enum(['send_message', 'make_offer', 'provide_evidence', 'accept_claim']);
export const moveSchema = z.enum(['fight', 'offer', 'refund', 'repair']);

/** 기대 손실 가정값 (SPEC 5장). pWin은 16개 유형 전부, pWinWithTracking은 일부만 있어도 된다. */
export const ParamsSchema = z.object({
  feeCents: cents,
  timeCostCents: cents,
  offerRate: probability,
  pAccept: probability,
  repairCostCents: cents.optional(),
  pAcceptRepair: probability.optional(),
  pWin: z.object(pWinShape),
  pWinWithTracking: z.object(pWinShape).partial(),
});

/** 정책·오토파일럿 기준값 (SPEC 6장). `note` 같은 설명 필드는 버린다. */
export const PolicyConfigSchema = z.object({
  version: z.string(),
  offer: z.object({
    eligibleSubtypes: z.array(subtypeSchema),
    maxRate: probability,
  }),
  repair: z.object({ eligibleSubtypes: z.array(subtypeSchema) }).optional(),
  autopilot: z.object({
    skipCategories: z.array(categorySchema),
    skipChannels: z.array(channelSchema),
    minConfidence: probability,
    moneyMoves: z.array(moveSchema),
  }),
  abuse: z.object({ minPriorInrDisputes: count }),
  escalation: z.object({
    cardCompanyMention: z.number(),
    unanswered: z.number(),
    angryTone: z.number(),
    dueWithin72h: z.number(),
    watchFrom: z.number(),
    highFrom: z.number(),
  }),
  classification: z.object({ minConfidence: probability }),
});

/** 분쟁 보드. 금액은 센트 정수, 확신도는 0~1. */
export const BoardStateSchema = z.object({
  disputeId: z.string(),
  reason: z.string(),
  stage: stageSchema,
  channel: channelSchema,
  dueDate: z.string(),
  amountCents: cents,
  currency: z.literal('USD'),
  allowedMoves: z.array(apiMoveSchema),
  hasTracking: z.boolean(),
  hasDeliveredTracking: z.boolean(),
  buyerPriorInrDisputes: count,
  isDemo: z.boolean(),
  cause: z
    .object({
      subtype: subtypeSchema,
      confidence: probability,
      evidence: z.array(z.string()),
      needsReview: z.boolean(),
      source: z.enum(['rule', 'llm']),
      causeNote: z.string().optional(),
    })
    .optional(),
});

/** 검증을 통과한 엔진 입력. 엔진은 원본 대신 이 값만 읽는다 (입력 객체를 바꾸지 않는다). */
export type EngineInput = { board: BoardState; params: Params; rules: PolicyConfig };

const EngineInputSchema = z
  .object({ board: BoardStateSchema, params: ParamsSchema, rules: PolicyConfigSchema })
  .superRefine((input, ctx) => {
    // SPEC 6장: 판매자 한도를 넘는 제안률은 설정 오류다.
    if (input.params.offerRate > input.rules.offer.maxRate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['params', 'offerRate'],
        message: `offerRate ${input.params.offerRate} exceeds rules.offer.maxRate ${input.rules.offer.maxRate}`,
      });
    }
  });

const paramsConfig = paramsConfigJson as unknown as ParamsConfig;

/** `config/params.json`에서 `value`만 꺼내 `Params`로 만든다 (검증 전). */
export function paramsFromConfig(config: ParamsConfig = paramsConfig): Params {
  const entries = Object.entries(config.params).map(([key, sourced]) => [key, sourced.value]);
  return Object.fromEntries(entries) as unknown as Params;
}

/** `config/rules.json` 원본 (검증 전). */
export function rulesFromConfig(): PolicyConfig {
  return rulesConfigJson as unknown as PolicyConfig;
}

/**
 * `config/params.json` 원본 (검증 전). `sim.ts`가 처방 배수·지금 습관·상품별 분쟁 확률을 읽는다
 * (`paramsFromConfig`는 기대 손실 가정값만 꺼내므로 그 세 가지가 빠진다).
 */
export function paramsConfigFromFile(): ParamsConfig {
  return paramsConfig;
}

/**
 * 보드·가정값·규칙을 검증한다. params·rules를 안 넘기면 config 파일에서 읽는다.
 * 어기면 ZodError를 던진다.
 */
export function resolveEngineInput(board: BoardState, params?: Params, rules?: PolicyConfig): EngineInput {
  return EngineInputSchema.parse({
    board,
    params: params ?? paramsFromConfig(),
    rules: rules ?? rulesFromConfig(),
  }) as EngineInput;
}
