/**
 * AI 캐시 (T070). **서버에서만** 부른다.
 *
 * 공개 배포(public)에서 AI를 거의 부르지 않게 `LlmCaller`를 감싼다.
 *
 * - 키 = `sha256(system + "\u0000" + user + "\u0000" + JSON.stringify(jsonSchema))`. 프롬프트에는 날짜·금액·이름
 *   **값**이 들어가지 않고 토큰만 들어가므로(SPEC 3장), 날짜가 바뀌어도 같은 분쟁이면 키가 같다.
 * - 캐시 파일 `data/ai-cache/llm-cache.json` = `{ version, entries: { [key]: { response, createdAt } } }`.
 *   키와 응답만 담는다 (환경변수·헤더·요청 본문 없음). 파일은 컨트롤 타워가 `scripts/ai-cache/build.ts`로 만든다.
 * - 적중이면 그 응답을 그대로 돌려준다 (실제 호출 0).
 * - 없으면: public에서는 프로세스 기준 **시간당 최대 N회**(`AI_LIVE_LIMIT_PER_HOUR`, 기본 20)만 실제로 부르고,
 *   넘으면 예외 — 지금의 `unavailableLlm`과 같은 꼴이다 (분류기·어조·초안이 "AI unavailable"로 내려간다).
 *   recording에서는 제한 없음 (캐시는 쓴다). 실제로 받은 응답은 프로세스 기억에 더해 다시 부르지 않는다.
 *
 * 남기지 않는 것: 응답 글·요청 글을 로그에 쓰지 않는다. 예외 글은 고정 코드뿐이다.
 */
import 'server-only';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { z } from 'zod';

import type { LlmCaller } from '@/types';

import type { DemoMode } from './mode';

export type LlmRequest = Parameters<LlmCaller>[0];

export const LLM_CACHE_VERSION = 1;

/** 앱이 읽는 캐시 파일 (저장소 기준 경로). */
export const LLM_CACHE_RELATIVE_PATH = path.join('data', 'ai-cache', 'llm-cache.json');

export type LlmCacheEntry = { response: unknown; createdAt: string };
export type LlmCacheFile = { version: number; entries: Record<string, LlmCacheEntry> };

const CacheFileSchema = z.object({
  version: z.number(),
  entries: z.record(z.string().regex(/^[0-9a-f]{64}$/), z.object({ response: z.unknown(), createdAt: z.string() })),
});

/** 요청 키. 같은 프롬프트·스키마면 같은 키 (시각·난수를 섞지 않는다). */
export function llmCacheKey(req: LlmRequest): string {
  const material = `${req.system}\u0000${req.user}\u0000${JSON.stringify(req.jsonSchema)}`;
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

export const emptyLlmCache = (): LlmCacheFile => ({ version: LLM_CACHE_VERSION, entries: {} });

/** 캐시 글을 읽는다. 꼴이 틀리면 빈 캐시 (예외를 화면까지 올리지 않는다). */
export function parseLlmCache(text: string): LlmCacheFile {
  try {
    const parsed = CacheFileSchema.safeParse(JSON.parse(text));
    if (!parsed.success || parsed.data.version !== LLM_CACHE_VERSION) return emptyLlmCache();
    return { version: parsed.data.version, entries: parsed.data.entries as Record<string, LlmCacheEntry> };
  } catch {
    return emptyLlmCache();
  }
}

/** 파일에서 읽는다. 없거나 깨졌으면 빈 캐시. */
export function readLlmCacheFile(file: string = path.join(process.cwd(), LLM_CACHE_RELATIVE_PATH)): LlmCacheFile {
  try {
    return parseLlmCache(readFileSync(file, 'utf8'));
  } catch {
    return emptyLlmCache();
  }
}

/** 파일에 쓸 글 (키 순서로 정렬 — 다시 만들어도 차이가 작게). 키·응답·만든 시각만. */
export function serializeLlmCache(cache: LlmCacheFile): string {
  const entries: Record<string, LlmCacheEntry> = {};
  for (const key of Object.keys(cache.entries).sort()) {
    const { response, createdAt } = cache.entries[key];
    entries[key] = { response, createdAt };
  }
  return `${JSON.stringify({ version: LLM_CACHE_VERSION, entries }, null, 2)}\n`;
}

// ───────────────────────────── 횟수 제한 ─────────────────────────────

export const DEFAULT_AI_LIVE_LIMIT_PER_HOUR = 20;
const HOUR_MS = 3_600_000;

/** `AI_LIVE_LIMIT_PER_HOUR`. 0 이상의 정수 글자만 받는다 — 그 밖(없음·빈 값·음수·소수·글자)은 기본 20. */
export function resolveLiveLimit(env: Partial<Record<'AI_LIVE_LIMIT_PER_HOUR', string>> = process.env): number {
  const raw = (env.AI_LIVE_LIMIT_PER_HOUR ?? '').trim();
  if (!/^\d{1,6}$/.test(raw)) return DEFAULT_AI_LIVE_LIMIT_PER_HOUR;
  return Number(raw);
}

export type RateLimiter = { tryTake: () => boolean };

/** 지난 1시간(움직이는 창) 안의 실제 호출 수가 `limit` 미만일 때만 하나를 내준다. */
export function createRateLimiter(limit: number, now: () => number = () => Date.now()): RateLimiter {
  const taken: number[] = [];
  return {
    tryTake() {
      const at = now();
      while (taken.length > 0 && at - taken[0] >= HOUR_MS) taken.shift();
      if (taken.length >= limit) return false;
      taken.push(at);
      return true;
    },
  };
}

// ───────────────────────────── 캐시 호출기 ─────────────────────────────

/** 횟수를 넘었을 때의 예외 글 (고정 코드. 화면에 나가지 않는다). */
export const AI_RATE_LIMITED = 'ai_rate_limited';

export type CachedLlmOptions = {
  cache: LlmCacheFile;
  mode: DemoMode;
  /** public에서만 쓴다. */
  limiter: RateLimiter;
};

/**
 * 캐시를 먼저 보는 호출기. 적중이면 `inner`를 부르지 않는다.
 * 없으면 public은 `limiter`가 허락할 때만, recording은 늘 `inner`를 부르고, 받은 응답을 `cache`에 더한다.
 */
export function cachedLlm(inner: LlmCaller, options: CachedLlmOptions): LlmCaller {
  return async (req) => {
    const key = llmCacheKey(req);
    const hit = options.cache.entries[key];
    if (hit !== undefined) return hit.response;
    if (options.mode === 'public' && !options.limiter.tryTake()) throw new Error(AI_RATE_LIMITED);
    const response = await inner(req);
    options.cache.entries[key] = { response, createdAt: new Date().toISOString() };
    return response;
  };
}

// ───────────────────────────── 프로세스에 하나 ─────────────────────────────

let processCache: LlmCacheFile | null = null;
let processLimiter: { limit: number; limiter: RateLimiter } | null = null;

/** 앱 프로세스의 캐시 (처음 한 번 파일에서 읽는다). */
export function processLlmCache(): LlmCacheFile {
  if (processCache === null) processCache = readLlmCacheFile();
  return processCache;
}

/** 앱 프로세스의 횟수 제한기 (한도가 바뀌면 새로 만든다). */
export function processRateLimiter(limit: number): RateLimiter {
  if (processLimiter === null || processLimiter.limit !== limit) {
    processLimiter = { limit, limiter: createRateLimiter(limit) };
  }
  return processLimiter.limiter;
}

// ───────────────────────────── 캐시 만들기 (스크립트 전용) ─────────────────────────────

export type CacheRecording = {
  /** 이번에 기록한 항목 (키 → 응답). */
  cache: LlmCacheFile;
  /** 실제로 `inner`를 부른 횟수. */
  calls: () => number;
};

let recording: { caller: LlmCaller; session: CacheRecording } | null = null;

/**
 * `scripts/ai-cache/build.ts`만 부른다. 켜 있는 동안 `getLlm()`은 이 기록 호출기를 돌려준다 —
 * 앱의 서버 함수를 그대로 돌리면서 요청 키와 응답을 모은다. 같은 키는 한 번만 부른다. 횟수 제한 없음.
 */
export function startCacheRecording(inner: LlmCaller): CacheRecording {
  const cache = emptyLlmCache();
  let calls = 0;
  const caller: LlmCaller = async (req) => {
    const key = llmCacheKey(req);
    const hit = cache.entries[key];
    if (hit !== undefined) return hit.response;
    calls += 1;
    const response = await inner(req);
    cache.entries[key] = { response, createdAt: new Date().toISOString() };
    return response;
  };
  const session: CacheRecording = { cache, calls: () => calls };
  recording = { caller, session };
  return session;
}

export function stopCacheRecording(): void {
  recording = null;
}

/** 기록 중이면 기록 호출기, 아니면 `null`. */
export function recordingCaller(): LlmCaller | null {
  return recording?.caller ?? null;
}
