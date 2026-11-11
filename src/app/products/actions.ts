'use server';

/**
 * AI 색상 문구 서버 액션 (T062). 색상 문구 카드의 [Write the note]가 부른다.
 * 브라우저에서 받는 것은 SKU 하나뿐이다. 본체는 `color-note.ts`. 실패면 null (화면은 그 자리를 숨긴다).
 */
import { getLlm } from '../_server/llm';
import { colorNoteFor } from './color-note';
import type { ColorNoteView } from './model';

export async function writeColorNoteAction(sku: string): Promise<ColorNoteView | null> {
  if (typeof sku !== 'string') return null;
  const available = getLlm();
  return colorNoteFor(sku, available.ok ? available.llm : null);
}
