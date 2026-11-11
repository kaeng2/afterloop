/**
 * 답장 칩 "Missing: … + Add"가 넣을 미리 정한 문장 (SPEC v2.14 8-4장, `config/reply-snippets.json`). 작업 T093.
 * 문장은 설정에서만 읽는다. 자리표시자(⟦BUYER_NAME_1⟧·⟦DATE_1⟧)는 채우지 않고 그대로 돌려준다 — 채우는 것은 화면의 토큰 채움.
 */
import { z } from 'zod';

import snippetsJson from '../../config/reply-snippets.json';
import type { ReplyFeatureKey, ReplySnippets, Subtype } from '@/types';

const sentence = z.string().min(1);
const SnippetMapSchema = z
  .object({ apology: sentence, cause: sentence, ask: sentence, date: sentence })
  .partial()
  .strict(); // lang·blame·vague·refundNow는 넣을 문장이 없다

const ReplySnippetsFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  note: z.string().optional(),
  snippets: SnippetMapSchema,
  bySubtype: z.record(z.string(), SnippetMapSchema).optional(),
});

export type ReplySnippetsFile = ReplySnippets & { note?: string; bySubtype?: Record<string, Partial<Record<ReplyFeatureKey, string>>> };

/** `config/reply-snippets.json` (검증한 것). */
export function replySnippetsFromConfig(): ReplySnippetsFile {
  return ReplySnippetsFileSchema.parse(snippetsJson) as ReplySnippetsFile;
}

/** 이 분쟁 세부 유형에 쓸 문장: 기본 위에 bySubtype[subtype]을 덮어쓴다. subtype이 없거나 따로 없으면 기본. */
export function replySnippetsFor(subtype?: Subtype | null, file: ReplySnippetsFile = replySnippetsFromConfig()): Partial<Record<ReplyFeatureKey, string>> {
  const checked = ReplySnippetsFileSchema.parse(file);
  const over = subtype ? checked.bySubtype?.[subtype] : undefined;
  return { ...checked.snippets, ...(over ?? {}) };
}
