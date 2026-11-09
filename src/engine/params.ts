import { z } from 'zod';

import type { Params } from './types';

const probability = z.number().min(0).max(1);
const cents = z.number().int().nonnegative();

/** 가정값 스키마. 확률은 0~1, 금액은 0 이상의 센트 정수. 모르는 키는 거부한다. */
export const ParamsSchema = z
  .object({
    pWinBase: probability,
    feeCents: cents,
    tFightCents: cents,
    tOfferCents: cents,
    repurchaseValueCents: cents,
    cFight: probability,
    cAccept: probability,
    cRefund: probability,
    offerRate: probability,
  })
  .strict() satisfies z.ZodType<Params>;

/** PRD 6-2 기본 가정값. 판매자 설정으로 덮어쓸 수 있다. */
export const DEFAULT_PARAMS: Readonly<Params> = Object.freeze({
  pWinBase: 0.4,
  feeCents: 1500,
  tFightCents: 1000,
  tOfferCents: 500,
  repurchaseValueCents: 6000,
  cFight: 0.5,
  cAccept: 0.2,
  cRefund: 0.15,
  offerRate: 0.15,
});

/** 기본값에 판매자 설정을 덮어쓰고 검증한다. 잘못된 값이면 ZodError. */
export function resolveParams(overrides: Partial<Params> = {}): Params {
  return ParamsSchema.parse({ ...DEFAULT_PARAMS, ...overrides });
}
