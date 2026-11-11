/**
 * T095: AI 캐시 만들기가 /listing 고칠 문구를 화면 서버 액션과 같은 입력으로 부른다 (en·ko). 가짜 LLM만, `.env` 안 읽음.
 * 기대값 출처: `tasks/T095.md` "만들 것"·"가장 중요한 규칙".
 */
import { describe, expect, it, vi } from 'vitest';

import type { LlmCaller } from '@/types';

import listingEn from '../../config/listing.en.json';
import listingKo from '../../config/listing.ko.json';

vi.mock('server-only', () => ({}));

type Req = Parameters<LlmCaller>[0];
const seen: Req[] = [];
const fake: LlmCaller = async (req) => {
  seen.push(req);
  // 규칙을 지키는 짧은 영어 문구 (숫자·약속 없음)
  return {
    size: 'Sizes run small; check the size chart before ordering.',
    color: 'Colors may look different on screen.',
    ship: 'Shipping times depend on the destination.',
    customs: 'Buyers may pay import duties at delivery.',
    bf: 'Orders may ship later during busy sale periods.',
    ret: 'Returns are accepted if the item is unworn.',
  };
};
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: true, llm: (req: Req) => fake(req) }) }));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputes: async () => ({ paypal: { ok: false, reason: 'test' }, disputes: [] }),
}));

const { buildAiCache } = await import('../../scripts/ai-cache/build-lib');
const { draftListingFixesAction } = await import('@/app/listing/actions');

describe('T095 listing fixes in AI cache build', () => {
  it('en·ko 두 번, 화면 서버 액션과 같은 user 문자열로 부른다', async () => {
    seen.length = 0;
    const built = await buildAiCache({ inner: fake });
    const fromBuild = seen.map((r) => r.user);
    expect(fromBuild).toHaveLength(2);

    seen.length = 0;
    for (const copy of [listingEn, listingKo]) {
      await draftListingFixesAction({ productTitle: copy.init.title, productDescription: copy.init.desc });
    }
    const fromScreen = seen.map((r) => r.user);
    expect(fromBuild).toEqual(fromScreen);
    expect(fromBuild[0]).not.toEqual(fromBuild[1]);
    // 결과 요약: 칸별 ok 수만
    expect(built.listingFixes.en).not.toBeNull();
    expect(built.listingFixes.ko).not.toBeNull();
    expect(built.listingFixes.en?.total).toBe(6);
  });
});
