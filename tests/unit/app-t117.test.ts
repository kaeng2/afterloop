/**
 * T117 단위 테스트: 이름 없는 고친 글을 Translate & check하면 "Facts match failed ⟦BUYER_NAME_1⟧"로 막히던 버그.
 *
 * 기대값 출처: `tasks/T117.md` "고칠 것"·"완료 기준", T104 보고서 "컨트롤 타워에 요청할 결정".
 * **실호출 0회** — AI는 가짜 LlmCaller (번역 프롬프트의 `<facts>`에 있는 토큰을 전부 붙이는 욕심 많은 번역기).
 * PayPal은 부르지 않는다 (`load`는 가짜). 개발 서버 없음. `.env`를 읽지 않는다.
 */
import { describe, expect, it, vi } from 'vitest';

import { checkTokens } from '@/ai/tokens';
import type { LoadDemoDisputesResult } from '@/app/_server/disputes';
import { t } from '@/app/_shared/copy';
import { applyChip, effectRows, filledSnippets } from '@/app/cases/desk-actions';
import { factsInText, revertToTokens } from '@/app/cases/edited-reply';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { fillFactTokens } from '@/app/cases/reply-model';
import { replyFeatureEffects } from '@/engine/forecast';
import { replySnippetsFor } from '@/engine/snippets';
import type { BoardState, Cause, DemoLink, EscalationSignals, FactToken, LlmCaller, Subtype } from '@/types';

import { P, R } from '../acceptance/boards';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/app/cases/actions', () => ({ sendReplyAction: vi.fn(), prepareEditedAction: vi.fn() }));

const { prepareEditedReply } = await import('@/app/_server/send');
type PreparedReply = import('@/app/_server/send').PreparedReply;

// ── 서연 (A2 통관 보류) — app-t104와 같은 꼴 ─────────────────────────────

const D2 = 'PP-R-TEST-T117';
const cause = (subtype: Subtype): Cause => ({ subtype, confidence: 1, evidence: [], needsReview: false, source: 'rule' });
const BASE_BOARD: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause' | 'isDemo'> = {
  disputeId: D2,
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:37:00.000Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  buyerPriorInrDisputes: 0,
};
const BEFORE: BoardState = { ...BASE_BOARD, hasTracking: false, hasDeliveredTracking: false, isDemo: false, cause: cause('A1') };
const AFTER: BoardState = { ...BASE_BOARD, hasTracking: true, hasDeliveredTracking: false, isDemo: true, cause: cause('A2') };
const SIGNALS: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: 464,
};
const NOW = '2026-11-10T03:00:00Z';
const FACT_SETS = caseReplyFacts({ now: NOW, dueDate: AFTER.dueDate, buyerId: 'B01', buyerLocale: 'ko' });
const FACTS: FactToken[] = FACT_SETS.outgoing;
const DRAFT_EN =
  "Sorry for the wait, ⟦BUYER_NAME_1⟧. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧. ⟦SELLER_NAME_1⟧";
const OUTGOING =
  '⟦BUYER_NAME_1⟧, 기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요. ⟦SELLER_NAME_1⟧';
const RUSHED = t('case.reply.rushedExample');
const ANCHOR = fillFactTokens(DRAFT_EN, FACT_SETS.draft, 'en');

const LINKS: DemoLink[] = [{ paypalDisputeId: D2, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true }];

function loaded(): LoadDemoDisputesResult {
  return {
    disputes: [
      {
        key: 'D2',
        disputeId: D2,
        statusCode: 'WAITING_FOR_SELLER_RESPONSE',
        buyer: { id: 'B01', name: 'Seo-yeon Park', country: 'KR', language: 'KO', sandbox: true, role: 'buyer' },
        product: null,
        buyerMessages: [],
        boardReal: BEFORE,
        boardDemo: AFTER,
        demoFields: [],
        carrierEvents: [],
        signals: null,
        signalsAfterReply: null,
        liveSendAllowed: true,
      },
    ],
    paypal: { ok: true },
    llm: { ok: true },
  } as LoadDemoDisputesResult;
}

const aiReply = (): PreparedReply => ({
  disputeId: D2,
  draftSource: 'ai',
  draftEn: DRAFT_EN,
  outgoing: OUTGOING,
  outsidePolicy: [],
  addedInTranslation: [],
  nameProblems: [],
  facts: FACTS,
  buyerLocale: 'ko',
});

const TOKEN_RE = /⟦[A-Z_]+_\d+⟧/g;

/**
 * 욕심 많은 가짜 번역기: 받은 `<draft>`의 토큰을 그대로 두고, `<facts>`에 있는데 글에 없는 토큰은 **전부** 끝에 붙인다
 * (3차 리뷰에서 본 ⟦SELLER_NAME_1⟧·⟦BUYER_NAME_1⟧ 붙이기의 최악). 역번역은 고정 글.
 */
function greedyTranslator(): { calls: string[]; factsSeen: string[][]; llm: LlmCaller } {
  const calls: string[] = [];
  const factsSeen: string[][] = [];
  return {
    calls,
    factsSeen,
    llm: async (req) => {
      calls.push(req.user);
      if (req.system.startsWith('You translate a small online')) {
        const draft = /<draft>\n([\s\S]*?)\n<\/draft>/.exec(req.user)?.[1] ?? '';
        const factBlock = /<facts>\n([\s\S]*?)\n<\/facts>/.exec(req.user)?.[1] ?? '';
        const listed = [...new Set(factBlock.match(TOKEN_RE) ?? [])];
        factsSeen.push(listed);
        const inDraft: string[] = draft.match(TOKEN_RE) ?? [];
        const added = listed.filter((tk) => !inDraft.includes(tk));
        return { outgoing: `번역: ${[...inDraft, ...added].join(' ')}`.trim() };
      }
      return { back_translation_en: 'Back translation of the edited reply.' };
    },
  };
}

function chipFixedRushed(): string {
  const effects = replyFeatureEffects(
    { text: RUSHED, anchorText: ANCHOR, board: AFTER, signals: SIGNALS, delayDays: 2, translated: true },
    filledSnippets(replySnippetsFor('A2'), FACT_SETS.draft),
  );
  let text = RUSHED;
  for (const row of effectRows(effects, false)?.bad ?? []) text = applyChip(text, row);
  for (const row of effectRows(effects, false)?.missing ?? []) text = applyChip(text, row);
  return text;
}

async function prepare(text: string) {
  const ai = greedyTranslator();
  const result = await prepareEditedReply(
    { disputeId: D2, reply: aiReply(), text },
    { load: async () => loaded(), llm: ai.llm, now: NOW, links: LINKS, params: P, rules: R },
  );
  return { ai, result };
}

const NAME_VALUES = /Hannah|Fernwood|Seo-yeon|서연|박서연/;

describe('T117: 이름 없는 고친 글 → 번역이 facts의 토큰을 붙여도 막히지 않는다', () => {
  it('재현: 예전처럼 전체 facts를 주면 욕심 많은 번역이 ⟦BUYER_NAME_1⟧을 붙여 토큰 검사가 실패한다', () => {
    const tokenized = revertToTokens(RUSHED, FACT_SETS.draft, { plan: null, board: AFTER }, DRAFT_EN);
    expect(tokenized).not.toContain('⟦BUYER_NAME_1⟧');
    const check = checkTokens(tokenized, `${tokenized} ⟦BUYER_NAME_1⟧`, FACTS);
    expect(check.ok).toBe(false);
    expect(check.extra).toContain('⟦BUYER_NAME_1⟧');
  });

  it('factsInText: 글에 있는 토큰만, 원래 순서대로 (BUYER_NAME·SELLER_NAME·DATE 같은 규칙)', () => {
    const kinds = (text: string) => factsInText(text, FACTS).map((f) => f.token);
    expect(kinds('Hi. ⟦SELLER_NAME_1⟧')).toEqual(['⟦SELLER_NAME_1⟧']);
    expect(kinds('Hi, ⟦BUYER_NAME_1⟧, by ⟦DATE_1⟧.')).toEqual(
      FACTS.map((f) => f.token).filter((tk) => tk === '⟦BUYER_NAME_1⟧' || tk === '⟦DATE_1⟧'),
    );
    expect(kinds('Hi.')).toEqual([]);
    expect(kinds(DRAFT_EN)).toEqual(FACTS.map((f) => f.token));
    // 입력 배열을 바꾸지 않는다
    const copy = FACTS.map((f) => ({ ...f }));
    factsInText('Hi.', FACTS);
    expect(FACTS).toEqual(copy);
  });

  for (const [label, make] of [
    ['급한 답장 그대로', () => RUSHED],
    // 칩 문장은 구매자 이름을 채워 넣는다 ("Sorry for the wait, Seo-yeon.") → 판매자가 이름을 지운 글
    ['칩으로 고치고 이름을 지운 급한 답장', () => chipFixedRushed().replace(/,\s*Seo-yeon\b/g, '')],
  ] as const) {
    it(`${label}: 통과 · 번호 발급, translateReply의 facts에 영어 글에 없는 토큰이 없다, 이름 값이 AI에 없다`, async () => {
      const text = make();
      expect(text).not.toMatch(NAME_VALUES);
      const { ai, result } = await prepare(text);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.draftEn).not.toContain('⟦BUYER_NAME_1⟧');
      expect(result.translation.ok).toBe(true);
      if (!result.translation.ok) return;
      expect(result.translation.check.extra).toEqual([]);
      expect(result.translation.check.missing).toEqual([]);
      expect(result.translation.check.ok).toBe(true);
      expect(result.replyId).toMatch(/^r-[0-9a-f]{32}$/);
      // 번역 프롬프트의 <facts> = 토큰 글에 있는 토큰만
      expect(ai.factsSeen).toHaveLength(1);
      const inDraft = new Set(result.draftEn.match(TOKEN_RE) ?? []);
      for (const token of ai.factsSeen[0]) expect(inDraft.has(token)).toBe(true);
      expect(ai.factsSeen[0]).not.toContain('⟦BUYER_NAME_1⟧');
      for (const call of ai.calls) expect(call).not.toMatch(NAME_VALUES);
    });
  }

  it('이름 있는 글(채워 보인 AI 초안을 조금 고침)은 그대로 통과하고 facts는 전부 간다', async () => {
    const text = ANCHOR.replace('Sorry for the wait', 'So sorry for the wait');
    const { ai, result } = await prepare(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draftEn).toBe(DRAFT_EN.replace('Sorry for the wait', 'So sorry for the wait'));
    expect(result.translation.ok && result.translation.check.ok).toBe(true);
    expect(result.replyId).toMatch(/^r-[0-9a-f]{32}$/);
    expect([...ai.factsSeen[0]].sort()).toEqual(FACTS.map((f) => f.token).sort());
    for (const call of ai.calls) expect(call).not.toMatch(NAME_VALUES);
  });

  it('칩으로 고친 급한 답장(칩이 이름을 넣음): 이름이 토큰으로 돌아가 그 토큰도 facts에 간다 → 통과', async () => {
    const text = chipFixedRushed();
    expect(text).toContain('Seo-yeon');
    const { ai, result } = await prepare(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draftEn).toContain('⟦BUYER_NAME_1⟧');
    expect(result.translation.ok && result.translation.check.ok).toBe(true);
    expect(result.replyId).toMatch(/^r-[0-9a-f]{32}$/);
    expect(ai.factsSeen[0]).toContain('⟦BUYER_NAME_1⟧');
    for (const call of ai.calls) expect(call).not.toMatch(NAME_VALUES);
  });

  it('checkTokens는 그대로 엄격: 토큰 빼기 · 두 번 · 다른 토큰 추가 → 실패', () => {
    const tokenized = revertToTokens(chipFixedRushed(), FACT_SETS.draft, { plan: null, board: AFTER }, DRAFT_EN);
    expect(tokenized).toContain('⟦SELLER_NAME_1⟧');
    expect(checkTokens(tokenized, tokenized, FACTS).ok).toBe(true);
    expect(checkTokens(tokenized, tokenized.replace('⟦SELLER_NAME_1⟧', ''), FACTS).ok).toBe(false);
    expect(checkTokens(tokenized, `${tokenized} ⟦SELLER_NAME_1⟧`, FACTS).ok).toBe(false);
    expect(checkTokens(tokenized, `${tokenized} ⟦BUYER_NAME_1⟧`, FACTS).ok).toBe(false);
    // 줄인 facts로 검사해도 목록 밖 토큰은 extra로 잡힌다
    const narrowed = factsInText(tokenized, FACTS);
    expect(checkTokens(tokenized, `${tokenized} ⟦BUYER_NAME_1⟧`, narrowed).extra).toContain('⟦BUYER_NAME_1⟧');
  });
});
