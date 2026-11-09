/**
 * 시드 데이터 zod 스키마 (T007, SPEC v2.1 / 원문 6장)
 *
 * `src/types.ts` 8부의 타입과 1:1로 맞춘다. 아래 Assert 줄이 컴파일 단계에서 불일치를 잡는다.
 * 모든 객체는 strict: 계약에 없는 필드가 파일에 들어가면 검증에서 떨어진다.
 */
import { z } from 'zod';
import type { SeedBuyer, SeedDispute, SeedInquiry, SeedOrder, SeedProduct } from '@/types';

/** 시드에 등장하는 국가 (원문 4-1 US·KR·JP·DE + 6-2 B12 영국) */
export const countrySchema = z.enum(['US', 'KR', 'JP', 'DE', 'GB']);

/** `src/types.ts` 1부 Subtype 16개 */
export const subtypeSchema = z.enum([
  'A1', 'A2', 'A3', 'A4',
  'B1', 'B2', 'B3', 'B4', 'B5',
  'C1', 'C2', 'C3',
  'D1',
  'E1',
  'F1', 'F2',
]);

export const seedProductSchema = z
  .object({
    sku: z.string().min(1),
    itemName: z.string().min(1),
    priceCents: z.number().int().positive(),
    stock: z.number().int().nonnegative(),
    orders90d: z.number().int().nonnegative(),
    disputes90d: z.number().int().nonnegative(),
    checklistGaps: z.array(z.string().min(1)),
  })
  .strict();

export const seedBuyerSchema = z
  .object({
    id: z.string().regex(/^B\d{2}$/),
    name: z.string().min(1),
    country: countrySchema,
    language: z.enum(['KO', 'EN', 'JA', 'DE']),
    sandbox: z.boolean(),
    role: z.string().min(1),
  })
  .strict();

export const seedInquirySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    buyerId: z.string().min(1),
    original: z.string().min(1),
    english: z.string().min(1),
    signal: subtypeSchema.optional(),
    isDemo: z.literal(true),
  })
  .strict();

export const seedDisputeSchema = z
  .object({
    id: z.string().regex(/^D[1-9]$/),
    buyerId: z.string().regex(/^B\d{2}$/),
    sku: z.string().min(1),
    reason: z.string().min(1),
    subtype: subtypeSchema,
    status: z.enum(['open', 'closed']),
    lossCents: z.number().int().nonnegative().nullable(),
    source: z.enum(['sandbox', 'seed']),
  })
  .strict();

export const seedOrderSchema = z
  .object({
    id: z.string().min(1),
    buyerId: z.string().min(1),
    sku: z.string().min(1),
    amountCents: z.number().int().positive(),
    country: countrySchema,
    tracked: z.boolean(),
    source: z.enum(['sandbox', 'seed']),
  })
  .strict();

/** 진행 중이면 손실이 없고, 종결이면 손실이 있다 (0도 값이다) */
export const lossMatchesStatus = (d: SeedDispute) =>
  d.status === 'open' ? d.lossCents === null : d.lossCents !== null;

export const seedProductsSchema = z.array(seedProductSchema);
export const seedBuyersSchema = z.array(seedBuyerSchema);
export const seedInquiriesSchema = z.array(seedInquirySchema);
export const seedDisputesSchema = z
  .array(seedDisputeSchema)
  .refine((rows) => rows.every(lossMatchesStatus), {
    message: 'open 분쟁은 lossCents가 null, closed 분쟁은 숫자여야 한다',
  });
export const seedOrdersSchema = z.array(seedOrderSchema);

// ── 계약(`src/types.ts` 8부)과 스키마가 같은 모양인지 컴파일 단계에서 확인한다 ──
type Assert<T extends true> = T;
type Assignable<A, B> = A extends B ? true : false;

// 검증을 통과한 값은 반드시 계약 타입이다 (양방향으로 보는 쪽)
type _p1 = Assert<Assignable<z.infer<typeof seedProductSchema>, SeedProduct>>;
type _p2 = Assert<Assignable<SeedProduct, z.infer<typeof seedProductSchema>>>;
type _i1 = Assert<Assignable<z.infer<typeof seedInquirySchema>, SeedInquiry>>;
type _i2 = Assert<Assignable<SeedInquiry, z.infer<typeof seedInquirySchema>>>;
type _d1 = Assert<Assignable<z.infer<typeof seedDisputeSchema>, SeedDispute>>;
type _d2 = Assert<Assignable<SeedDispute, z.infer<typeof seedDisputeSchema>>>;

// 구매자·주문의 `country`는 계약이 `string`이고 스키마는 시드에 쓰는 5개로 좁힌다.
// 그래서 한쪽 방향(스키마 → 계약)만 성립한다.
type _b1 = Assert<Assignable<z.infer<typeof seedBuyerSchema>, SeedBuyer>>;
type _o1 = Assert<Assignable<z.infer<typeof seedOrderSchema>, SeedOrder>>;
type _c1 = Assert<Assignable<z.infer<typeof countrySchema>, SeedBuyer['country']>>;
type _c2 = Assert<Assignable<z.infer<typeof countrySchema>, SeedOrder['country']>>;

export type SchemaMatchesContract = [_p1, _p2, _i1, _i2, _d1, _d2, _b1, _o1, _c1, _c2];
