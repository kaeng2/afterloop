/**
 * T122f (SPEC v2.16): repair 초안 연결 + Lena·Yuki 상세 연결.
 *
 * 기대값 출처: `tasks/T122f.md` 1·2번, `reports/T122c-impl.md` "컨트롤 타워에 요청할 결정" 1·2,
 * `src/ai/repair.ts` (`reply.repairDays` → `⟦DAYS_1⟧`).
 * 실제 PayPal·LLM 호출 없음 — PayPal 읽기는 정해 둔 분쟁을 돌려주는 가짜, LLM은 정해 둔 답을 내고 받은 요청을 모으는 가짜.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { repairDaysFromConfig } from '@/ai/repair';
import type { LoadedDispute } from '@/app/_shared/dispute-view';
import type { LoadDemoDisputesResult } from '@/app/_server/disputes';
import { buildReplyView, canSend, OFFER_STATUS } from '@/app/cases/reply-model';
import { recommend } from '@/engine/recommend';
import type { BoardState, LlmCaller } from '@/types';

import { seedBuyers, seedDemoDisplay } from '../../seed/index';
import { D1_JIHO, withSubtype } from '../acceptance/boards';

type LlmRequest = Parameters<LlmCaller>[0];
const llmCalls: LlmRequest[] = [];
let llmAnswers: unknown[] = [];
const fakeLlm: LlmCaller = async (req) => {
  llmCalls.push(req);
  return llmAnswers[Math.min(llmCalls.length - 1, llmAnswers.length - 1)];
};

let loadedNow: LoadDemoDisputesResult = { disputes: [], paypal: { ok: false }, llm: { ok: false } };

vi.mock('server-only', () => ({}));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputesForRequest: async () => loadedNow,
  loadDemoDisputes: async () => loadedNow,
}));
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: true, llm: fakeLlm }) }));

(globalThis as { React?: typeof React }).React = React;

const ROOT = path.resolve(__dirname, '../..');

/** 실제 연결 표의 지호 분쟁 번호 (호출은 모두 가짜다). */
const D1_ID = 'PP-R-MBJ-10197650';
const inTwentyDays = new Date(Date.now() + 20 * 24 * 3_600_000).toISOString();
// 지호 = B3 품질(반품 기간 지남) → 엔진 추천 repair (v2.16)
const JIHO_REPAIR: BoardState = { ...withSubtype(D1_JIHO, 'B3', 1), disputeId: D1_ID, dueDate: inTwentyDays };

function jihoLoaded(): LoadedDispute {
  const buyer = seedBuyers.find((b) => b.id === 'B02');
  if (buyer === undefined) throw new Error('seed buyer B02');
  return {
    key: 'B02',
    disputeId: D1_ID,
    statusCode: OFFER_STATUS,
    buyer,
    product: null,
    buyerMessages: ['산 지 5주 정도 됐는데 소매 쪽 올이 풀려서 입을 수가 없어요.'],
    boardReal: JIHO_REPAIR,
    boardDemo: null,
    demoFields: [],
    carrierEvents: [],
    signals: null,
    signalsAfterReply: null,
    liveSendAllowed: false,
  };
}

const DRAFT =
  "Hello ⟦BUYER_NAME_1⟧, I'm so sorry it started unraveling so soon. The return period has passed, so a return isn't possible. " +
  "Instead, if you cover the round-trip shipping, I'll do a free repair of the sleeve. " +
  'The repair takes about ⟦DAYS_1⟧ from the day you receive it.\n\n⟦SELLER_NAME_1⟧';
const OUTGOING =
  '안녕하세요 ⟦BUYER_NAME_1⟧, 올이 풀려서 정말 속상하셨겠어요. 반품 기간이 지나 반품은 어려워요. ' +
  '대신 왕복 배송비만 부담해 주시면 소매 부분을 무료로 수선해 드릴게요. 수선은 받은 날부터 ⟦DAYS_1⟧ 정도 걸려요.\n\n⟦SELLER_NAME_1⟧';
const BACK =
  "Hello ⟦BUYER_NAME_1⟧, I'm sorry the sleeve unraveled. The return period has passed, so a return is difficult. " +
  'Instead, if you cover the round-trip shipping, I will repair the sleeve for free. The repair takes about ⟦DAYS_1⟧ from the day you receive it.\n\n⟦SELLER_NAME_1⟧';

function answer(draftEn = DRAFT) {
  llmCalls.length = 0;
  llmAnswers = [
    {
      buyer_message_en: 'The sleeve is unraveling and I cannot wear it.',
      coaching: ['Apologize', 'Explain the return window', 'Offer the free repair'],
      chips: ['Apology', 'Return window', 'Free repair'],
      draft_en: draftEn,
    },
    { outgoing: OUTGOING },
    { back_translation_en: BACK },
  ];
}

const view_factLabels = (facts: { kind: string }[]) => facts.map((fact) => fact.kind);

async function freshLoad() {
  vi.resetModules();
  return import('@/app/cases/reply/load');
}

beforeEach(() => {
  llmCalls.length = 0;
});

describe('1번: repair 수도 AI 초안·번역 경로를 탄다', () => {
  it('전제: 지호(B3) 보드의 엔진 추천은 repair, 설정 수선 기간은 5', () => {
    expect(recommend(JIHO_REPAIR).best?.move).toBe('repair');
    expect(repairDaysFromConfig()).toBe(5);
  });

  it('초안 1 + 번역 1 + 역번역 1 호출, 프롬프트엔 ⟦DAYS_1⟧ 토큰만 (값은 모델에 가지 않는다)', async () => {
    loadedNow = { disputes: [jihoLoaded()], paypal: { ok: true }, llm: { ok: true } };
    answer();
    const { loadReply } = await freshLoad();
    const reply = await loadReply(D1_ID);
    expect(reply).not.toBeNull();
    expect(llmCalls.length).toBe(3);
    expect(llmCalls[0]!.user).toContain('move: repair');
    expect(llmCalls[0]!.user).toContain('⟦DAYS_1⟧ (DAYS)');
    expect(llmCalls[1]!.user).toContain('⟦DAYS_1⟧ (DAYS)');
    for (const call of llmCalls) expect(`${call.system}\n${call.user}`).not.toMatch(/영업일|business days/);
  });

  it('"What the buyer will receive (Korean)" 미리보기에 기간이 코드로 채워지고 [Send]가 켜진다 (Simulated)', async () => {
    loadedNow = { disputes: [jihoLoaded()], paypal: { ok: true }, llm: { ok: true } };
    answer();
    const { loadReply } = await freshLoad();
    const reply = (await loadReply(D1_ID))!;
    expect(reply.replyId).not.toBeNull();
    expect(reply.base.plan?.move).toBe('repair');
    expect(reply.base.plan?.apiMove).toBe('send_message');
    expect(reply.base.mode).toBe('simulated');
    // 원래 값(영업일 수)만 — 언어별 표기는 화면·전송의 `fillFactTokens`가 만든다
    expect(reply.base.facts.find((fact) => fact.token === '⟦DAYS_1⟧')?.value).toBe('5');
    expect((reply.base.draftFacts ?? []).find((fact) => fact.token === '⟦DAYS_1⟧')?.value).toBe('5');
    expect(view_factLabels(reply.base.facts)).toContain('DAYS');
    const view = buildReplyView({ ...reply.base, confirmed: [], sendState: 'idle', outcome: null });
    expect(view.draftEn?.text).toContain('about 5 business days');
    expect(view.outgoing?.text).toContain('받은 날부터 5영업일 정도');
    expect(view.outgoing?.text).not.toContain('⟦');
    expect(canSend(view)).toEqual({ ok: true, reasonKey: null });
  });

  it('약속 검사 그대로: 환불을 약속한 repair 초안은 확인 전까지 [Send]가 꺼진다', async () => {
    loadedNow = { disputes: [jihoLoaded()], paypal: { ok: true }, llm: { ok: true } };
    answer(DRAFT.replace('\n\n⟦SELLER_NAME_1⟧', ' If the repair does not work, I will refund you.\n\n⟦SELLER_NAME_1⟧'));
    const { loadReply } = await freshLoad();
    const reply = (await loadReply(D1_ID))!;
    expect(reply.base.draft.ok && reply.base.draft.outsidePolicy).toContain('refund');
    const view = buildReplyView({ ...reply.base, confirmed: [], sendState: 'idle', outcome: null });
    expect(canSend(view).ok).toBe(false);
  });

  it('임시 코드("T120b 전")가 없다', () => {
    for (const file of ['src/app/cases/reply/load.ts', 'src/app/cases/view/load.ts']) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      expect(source, file).not.toContain('T120b 전');
      expect(source, file).not.toMatch(/move === 'repair' \? null/);
    }
  });
});

describe('2번: Lena·Yuki 상세 = DemoItemCard (CaseDetail을 부르지 않는다)', () => {
  it('page.tsx 상세 Pane이 시드 demoItems id로 DemoItemCard를 그린다 (CaseDetail 앞)', () => {
    const source = readFileSync(path.join(ROOT, 'src/app/(app)/page.tsx'), 'utf8');
    const pane = source.slice(source.indexOf('function Pane('), source.indexOf('async function RiskLoader'));
    expect(pane).toContain('<DemoItemCard item={demo} row={item.row} doneId={item.id} />');
    expect(pane.indexOf('DemoItemCard')).toBeLessThan(pane.indexOf('<CaseDetail'));
    expect(source).toContain('seedDemoDisplay.demoItems.find((demo) => demo.key === id)');
  });

  it('시드 Lena·Yuki 줄을 그대로 넘기면 카드가 그려진다 (Demo data · Simulated)', async () => {
    const { DemoItemCard } = await import('@/app/today/demo-item-card');
    const keys = seedDemoDisplay.demoItems.map((demo) => demo.key);
    expect(keys).toEqual(['lena', 'yuki']);
    for (const demo of seedDemoDisplay.demoItems) {
      const html = renderToStaticMarkup(createElement(DemoItemCard, { item: demo, row: null, doneId: demo.key }));
      expect(html).toContain('Demo data');
      expect(html).toContain('Simulated');
      expect(html).toContain(`demo-item-title-${demo.key}`);
    }
  });
});
