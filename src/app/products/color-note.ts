/**
 * AI 색상 문구 서버 함수 (T062, T020 "화면(S2)이 부르는 방법"). **서버에서만 부른다** (`actions.ts`가 감싼다).
 *
 * SKU 하나만 받는다. 시드에 없는 SKU이거나 LLM을 쓸 수 없으면 부르지 않는다. 구매자 글은 서버가 시드에서 모은다.
 * 실패(AI 없음·검사 걸림·색상 문제 아님)면 null — 화면은 그 자리를 숨긴다 (기본 문구 없음).
 * 이 결과는 시뮬레이션과 무관하다 (엔진에 넘기지 않는다).
 */
import 'server-only';

import { writeColorNote } from '@/ai/color-note';
import type { LlmCaller } from '@/types';

import { seedDisputes, seedInquiries, seedProducts } from '../../../seed/index';
import { colorComplaintsFor, colorNoteView, type ColorNoteView } from './model';

export async function colorNoteFor(sku: string, llm: LlmCaller | null): Promise<ColorNoteView | null> {
  try {
    const product = seedProducts.find((p) => p.sku === sku);
    if (product === undefined || llm === null) return null;
    const complaints = colorComplaintsFor(sku, seedDisputes, seedInquiries);
    if (complaints.length === 0) return null;
    return colorNoteView(await writeColorNote({ productName: product.itemName, complaints }, { llm }));
  } catch {
    return null;
  }
}
