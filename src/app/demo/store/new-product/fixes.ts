/**
 * AI 고칠 문구 본체 (T087). 서버 액션(`actions.ts`)이 부른다. 시험은 가짜 호출기를 넘긴다.
 *
 * - `draftListingFixes`를 **한 번** 부른다 (데모 모드 AI 캐시·횟수 제한은 `getLlm`이 감싼 호출기 그대로).
 * - 입력은 상품명과 Publish 시점의 설명뿐 (SPEC 8-3장). zod로 길이를 막는다.
 * - AI를 쓸 수 없으면 null — 화면은 넣기 버튼을 그리지 않는다 (기본 문구 없음).
 */
import { z } from 'zod';

import { draftListingFixes } from '@/ai/listing-fixes';
import type { ListingFixDrafts, LlmCaller } from '@/types';

export const DraftInputSchema = z.object({
  productTitle: z.string().min(1).max(200),
  productDescription: z.string().max(4000),
});

export async function listingFixesFor(raw: unknown, llm: LlmCaller | null): Promise<ListingFixDrafts | null> {
  const parsed = DraftInputSchema.safeParse(raw);
  if (!parsed.success || llm === null) return null;
  return draftListingFixes(parsed.data, { llm });
}
