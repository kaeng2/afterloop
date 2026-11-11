/**
 * AI 캐시 만들기 — 본체 (T070). 진입점은 `./build.ts`.
 *
 * **앱과 같은 서버 함수**를 그대로 돌린다. 그동안 `getLlm()`은 기록 호출기(`startCacheRecording`)를 돌려주므로
 * 화면이 부르는 AI 요청이 하나도 빠지지 않고 키·응답으로 모인다:
 *  1. `loadDemoDisputes()` — Today 목록·위쪽 막대·상세가 함께 쓰는 분쟁 읽기. 분류(규칙이 못 정한 보드만)·어조 판정.
 *  2. 화면 분쟁마다(연결 표 `showOnScreen` — 서연·지호·Mike) `loadCase(id)` — 구매자 글 영어 + 코칭 + 영어 초안.
 *  3. 같은 분쟁마다 `loadReply(id)` — 전송본 번역 + 역번역.
 *
 *  4. `/listing` 고칠 문구 — 화면 폼 기본값(en·ko 두 벌: 상품명·설명)으로 서버 액션과 같은 `listingFixesFor`를 한 번씩 (T095).
 *
 * 같은 키는 한 번만 부른다 (2·3이 다시 읽는 분류·어조는 1의 기록으로 끝난다). PayPal은 **읽기(GET)만** 한다 —
 * 이 함수들에는 쓰기 호출이 없다. 결과에는 키·응답·만든 시각만 담는다 (환경변수·헤더·요청 글 없음).
 */
import { getLlm } from '@/app/_server/llm';
import { listingFixesFor } from '@/app/listing/fixes';
import { initialForm, type ListingLocale } from '@/app/listing/model';
import { loadReply } from '@/app/cases/reply/load';
import { loadCase } from '@/app/cases/view/load';
import { loadDemoDisputes } from '@/app/_server/disputes';
import { startCacheRecording, stopCacheRecording, type LlmCacheFile } from '@/app/_server/llm-cache';
import type { Availability } from '@/app/_shared/availability';
import type { LlmCaller } from '@/types';

export type BuiltCase = {
  disputeId: string;
  /** `loadCase`가 초안을 받았는지 (AI 초안 = 구매자 글 영어 + 코칭 + 영어 초안). */
  draft: boolean;
  /** `loadReply`가 전송본(번역 + 역번역)을 받았는지. */
  reply: boolean;
};

/** 한 언어의 고칠 문구 결과: 칸별 ok 수 (글·키 없음). AI를 못 쓰면 null. */
export type BuiltListingFixes = { ok: number; total: number } | null;

export type BuildAiCacheResult = {
  listingFixes: Record<ListingLocale, BuiltListingFixes>;
  cache: LlmCacheFile;
  /** 실제로 AI를 부른 횟수 (같은 키는 한 번). */
  calls: number;
  paypal: Availability;
  cases: BuiltCase[];
};

export async function buildAiCache(deps: { inner: LlmCaller }): Promise<BuildAiCacheResult> {
  const session = startCacheRecording(deps.inner);
  try {
    const all = await loadDemoDisputes();
    const cases: BuiltCase[] = [];
    if (all.paypal.ok) {
      for (const dispute of all.disputes) {
        const loaded = await loadCase(dispute.disputeId);
        const reply = await loadReply(dispute.disputeId);
        cases.push({
          disputeId: dispute.disputeId,
          draft: loaded.kind === 'ok' && loaded.draft.ok,
          reply: reply !== null && reply.base.translation !== null && reply.base.translation.ok,
        });
      }
    }
    const listingFixes = { en: null, ko: null } as Record<ListingLocale, BuiltListingFixes>;
    const available = getLlm();
    for (const locale of ['en', 'ko'] as const) {
      const form = initialForm(locale);
      // 화면(listing-screen)이 Publish 때 넘기는 입력 그대로 — 같은 캐시 키
      const drafts = await listingFixesFor(
        { productTitle: form.title, productDescription: form.desc },
        available.ok ? available.llm : null,
      );
      if (drafts !== null) {
        const list = Object.values(drafts);
        listingFixes[locale] = { ok: list.filter((d) => d.ok).length, total: list.length };
      }
    }
    return { listingFixes, cache: session.cache, calls: session.calls(), paypal: all.paypal, cases };
  } finally {
    stopCacheRecording();
  }
}
