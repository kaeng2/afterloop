/**
 * `POST /api/listing-check` (T087, DECISIONS "Scene 3 정직성" ④). 쇼핑몰이 상품 등록 전에 부르는 점검 API.
 * 화면(/listing)이 브라우저에서 돌리는 것과 **같은 엔진 함수** `checkListing`을 부른다 — 같은 입력이면 같은 숫자.
 *
 * - 입력은 zod(`ListingCheckInput` 모양)로 검사. 잘못되면 400 `{ error: 'invalid_input' }`.
 * - PayPal·AI 호출 없음. 가정값(`config/listing-model.json`·`config/params.json`)으로만 계산한다.
 */
import { z } from 'zod';

import { LISTING_MAX_UNITS, checkListing } from '@/engine/listing';
import type { ListingCheckInput } from '@/types';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT = z.string().max(4000);

const BodySchema = z
  .object({
    fields: z.object({ desc: TEXT, size: TEXT, ship: TEXT, ret: TEXT }).strict(),
    priceCents: z.number().int().positive().max(10_000_000),
    units: z.number().int().positive().max(LISTING_MAX_UNITS),
    saleFrom: z.string().regex(DATE),
    saleTo: z.string().regex(DATE),
  })
  .strict()
  .refine((b) => b.saleFrom <= b.saleTo, { message: 'saleFrom after saleTo' });

const bad = () => Response.json({ error: 'invalid_input' }, { status: 400 });

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad();
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return bad();
  const input: ListingCheckInput = parsed.data;
  try {
    return Response.json({ result: checkListing(input) });
  } catch {
    return bad();
  }
}
