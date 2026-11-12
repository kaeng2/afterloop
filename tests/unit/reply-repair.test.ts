/**
 * repair 답장 단위 테스트 (T120b, SPEC v2.16). LLM은 전부 가짜다 — 네트워크·`.env`를 쓰지 않는다.
 *
 * 지호 건(B3 품질, 반품 기간 지남): 공감 → 반품 어려움 → 왕복 배송비만 부담하면 무료 수선 → 수선 기간은
 * `⟦DAYS_1⟧`(코드가 채운다). 약속 검사를 통과하고, 환불 같은 정책 밖 약속은 걸러진다.
 */
import { describe, expect, it } from 'vitest';

import { DRAFT_SYSTEM } from '@/ai/prompts/reply';
import { repairDaysFromConfig, repairFacts } from '@/ai/repair';
import { draftReply, translateReply, type ReplyInput } from '@/ai/reply';
import { checkTokens, extractTokens, fillTokens, formatFact, repairDaysFact } from '@/ai/tokens';
import type { Cause, FactToken, LlmCaller, ReplyDraftPolicy } from '@/types';

type LlmRequest = Parameters<LlmCaller>[0];

function fakeLlm(...replies: unknown[]): { calls: LlmRequest[]; llm: LlmCaller } {
  const calls: LlmRequest[] = [];
  const llm: LlmCaller = async (req) => {
    calls.push(req);
    return replies[Math.min(calls.length - 1, replies.length - 1)];
  };
  return { calls, llm };
}

const POLICY: ReplyDraftPolicy = {
  followUpDateMeaning: 'the date the seller will check the status and contact the buyer again. Not a delivery date.',
  allowedCommitments: [],
};

const CAUSE: Cause = {
  subtype: 'B3',
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
  causeNote: 'Sleeve unraveling five weeks after purchase',
};

const DAYS_FACT = repairDaysFact(5, 'ko');
const INPUT: ReplyInput = {
  buyerMessages: ['산 지 5주 정도 됐는데 소매 쪽 올이 풀려서 입을 수가 없어요.'],
  buyerLocale: 'ko',
  cause: CAUSE,
  move: 'repair',
  facts: [DAYS_FACT],
};

const DRAFT =
  "I'm so sorry it started unraveling so soon. The return period has passed, so I'm afraid a return isn't possible. " +
  "Instead, if you cover the round-trip shipping, I'll do a free repair of the sleeve. " +
  'The repair takes about ⟦DAYS_1⟧ from the day you receive it.';

const OUTGOING =
  '올이 풀려서 정말 속상하셨겠어요. 다만 반품 기간이 지나 반품은 어려운 점 양해 부탁드려요. ' +
  '대신 왕복 배송비만 부담해 주시면 소매 부분을 무료로 수선해 드릴게요. 수선은 받은 날부터 ⟦DAYS_1⟧ 정도 걸려요.';

const BACK =
  "I'm sorry the sleeve unraveled. The return period has passed, so a return is difficult. " +
  'Instead, if you cover the round-trip shipping, I will repair the sleeve for free. The repair takes about ⟦DAYS_1⟧ from the day you receive it.';

/** 초안 호출의 응답 JSON (`fakeLlm`은 응답 JSON 자체를 돌려준다). */
function answer(over: Record<string, unknown> = {}): unknown {
  return {
    buyer_message_en: 'The sleeve is unraveling and I cannot wear it.',
    coaching: ['Apologize', 'Explain the return window', 'Offer the free repair', 'Say how long it takes'],
    chips: ['Apology', 'Return window', 'Free repair', 'Repair time'],
    draft_en: DRAFT,
    ...over,
  };
}

describe('repair 초안 (가짜 LLM)', () => {
  it('프롬프트가 repair 순서를 지시하고 일수 값은 모델에 가지 않는다', async () => {
    const { calls, llm } = fakeLlm(answer());
    const draft = await draftReply(INPUT, { llm }, POLICY);

    expect(draft.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(DRAFT_SYSTEM).toContain('- repair:');
    const request = calls[0]!;
    expect(request.user).toContain('move: repair');
    expect(request.user).toContain('⟦DAYS_1⟧ (DAYS) =');
    // 값(5영업일·5 business days)은 어느 쪽에도 없다
    expect(request.user).not.toMatch(/영업일|business days/);
    expect(request.system).not.toMatch(/\b5 business days\b/);
  });

  it('토큰·약속 검사를 통과한다: 환불 약속 없음, 금액 자리표시자 없음', async () => {
    const { llm } = fakeLlm(answer());
    const draft = await draftReply(INPUT, { llm }, POLICY);
    if (!draft.ok) throw new Error('초안이 실패했다');

    expect(draft.outsidePolicy).toEqual([]);
    expect(draft.draftEn).not.toMatch(/\{\{/);
    expect(extractTokens(draft.draftEn)).toEqual(['⟦DAYS_1⟧']);
    expect(checkTokens(draft.draftEn, draft.draftEn, INPUT.facts).literalFacts).toEqual([]);
  });

  it('전송본도 통과하고, 일수는 코드가 채운다 (5영업일)', async () => {
    const { llm } = fakeLlm({ outgoing: OUTGOING }, { back_translation_en: BACK });
    const translation = await translateReply(
      { draftEn: DRAFT, buyerLocale: 'ko', facts: INPUT.facts, move: 'repair' },
      { llm },
    );
    if (!translation.ok) throw new Error('전송본이 실패했다');

    expect(translation.sendable).toBe(true);
    expect(translation.outsidePolicy).toEqual([]);
    expect(translation.addedInTranslation).toEqual([]);
    expect(fillTokens(translation.outgoing, INPUT.facts)).toContain('받은 날부터 5영업일 정도');
  });

  it('환불을 약속한 repair 초안은 판매자 확인 대상이 된다', async () => {
    const refunding = `${DRAFT} If the repair does not work, I will refund you.`;
    const { llm } = fakeLlm(answer({ draft_en: refunding }));
    const draft = await draftReply(INPUT, { llm }, POLICY);
    if (!draft.ok) throw new Error('초안이 실패했다');
    expect(draft.outsidePolicy).toContain('refund');
  });

  it('금액 자리표시자와 모르는 토큰은 거부한다', async () => {
    const withAmount = fakeLlm(answer({ draft_en: `${DRAFT} I will refund {{refundAmount}}.` }));
    const a = await draftReply(INPUT, { llm: withAmount.llm }, POLICY);
    expect(a.ok).toBe(false);

    const withDate = fakeLlm(answer({ draft_en: DRAFT.replace('⟦DAYS_1⟧', '⟦DATE_1⟧') }));
    const b = await draftReply(INPUT, { llm: withDate.llm }, POLICY);
    expect(b.ok).toBe(false);
  });

  it('수선 기간을 글자로 지어 쓰면 거부한다 (날짜 약속)', async () => {
    const literal = fakeLlm(answer({ draft_en: DRAFT.replace('⟦DAYS_1⟧', 'March 3') }));
    const draft = await draftReply(INPUT, { llm: literal.llm }, POLICY);
    expect(draft.ok).toBe(false);
  });
});

describe('수선 기간 사실값', () => {
  it('언어별 표기와 잘못된 값 거부', () => {
    expect(formatFact('DAYS', '5', 'ko')).toBe('5영업일');
    expect(formatFact('DAYS', '5', 'en')).toBe('5 business days');
    expect(formatFact('DAYS', '5', 'ja')).toBe('5営業日');
    expect(formatFact('DAYS', '5', 'de')).toBe('5 Werktage');
    expect(() => formatFact('DAYS', '0', 'ko')).toThrow();
    expect(() => formatFact('DAYS', '2.5', 'en')).toThrow();
  });

  it('repairFacts는 설정의 repairDays를 쓰고, 없으면 사실값을 만들지 않는다', () => {
    const fact: FactToken | undefined = repairFacts('en', { reply: { repairDays: 5 } })[0];
    expect(fact?.token).toBe('⟦DAYS_1⟧');
    expect(fact?.value).toBe('5 business days');
    expect(repairFacts('en', { reply: {} })).toEqual([]);
    expect(repairDaysFromConfig({ reply: { repairDays: 0 } })).toBeNull();
    expect(repairDaysFromConfig({ reply: { repairDays: '5' } })).toBeNull();
  });
});
