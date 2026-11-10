/**
 * 화면용 LLM 호출기 (T047, SPEC v2.6 3장).
 *
 * **서버에서만 부른다.** `LLM_API_KEY`가 브라우저 묶음에 들어가지 않게, 이 파일은 서버 컴포넌트·
 * 서버 액션·라우트 핸들러에서만 import한다 (`server-only`가 막는다).
 *
 * 키가 없으면 **예외를 화면까지 올리지 않고** "쓸 수 없음"을 돌려준다 — 화면은
 * `common.llmUnavailable`("AI unavailable — showing rules only")을 보이고 규칙 결과만 쓴다
 * (SPEC 3장). 분류기는 LLM이 실패해도 예외 없이 `needsReview: true`로 내려간다.
 *
 * `reason`은 고정 코드다 (`_shared/availability.ts`).
 */
import 'server-only';

import { createLlmCaller, type LlmEnv } from '@/ai/llm';
import type { LlmCaller } from '@/types';

import type { UnavailableReason } from '../_shared/availability';

export type LlmAvailability =
  | { ok: true; llm: LlmCaller }
  | { ok: false; reason: UnavailableReason };

/**
 * `LlmCaller`를 만든다. 던지지 않는다.
 *
 * `createLlmCaller`는 만들 때 아무것도 던지지 않으므로(모델·키는 호출할 때 읽는다) 여기서는 키가
 * 있는지만 미리 보고 없으면 "쓸 수 없음"으로 돌려준다 — 화면이 쓸데없이 호출을 걸고 기다리지 않게.
 */
export function getLlm(env: LlmEnv = process.env as LlmEnv): LlmAvailability {
  if (typeof window !== 'undefined') {
    return { ok: false, reason: 'server_only' };
  }

  if ((env.LLM_API_KEY ?? '').trim() === '') {
    return { ok: false, reason: 'not_configured' };
  }

  return { ok: true, llm: createLlmCaller(env) };
}

/**
 * 늘 실패하는 호출기. LLM을 쓸 수 없을 때 분류기·어조 판정에 넣는다 —
 * 두 곳 모두 예외를 받아 "규칙 결과만"으로 내려가므로 화면이 멈추지 않는다.
 * 예외 글은 사유 코드뿐이다 (화면에 나가지 않는다).
 */
export function unavailableLlm(reason: UnavailableReason = 'not_configured'): LlmCaller {
  return async () => {
    throw new Error(reason);
  };
}
