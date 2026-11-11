'use server';

/**
 * AI 고칠 문구 서버 액션 (T087). Publish 때 화면이 한 번 부른다. 받는 것은 상품명·설명뿐.
 * 본체는 `fixes.ts`. AI를 쓸 수 없으면 null (화면은 넣기 버튼을 숨긴다). PayPal 호출 없음.
 */
import type { ListingFixDrafts } from '@/types';

import { getLlm } from '../_server/llm';
import { listingFixesFor } from './fixes';

export async function draftListingFixesAction(input: {
  productTitle: string;
  productDescription: string;
}): Promise<ListingFixDrafts | null> {
  const available = getLlm();
  return listingFixesFor(input, available.ok ? available.llm : null);
}
