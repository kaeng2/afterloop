/**
 * T100 단위 테스트: 칩으로 고친 답장도 보내기 — 토큰 되돌리기 → 번역·검사 → 기존 관문으로 보내기.
 *
 * 기대값 출처: `tasks/T100.md` "가장 중요한 규칙" 1~6 · "만들 것" 1~3 (a)~(e), DECISIONS 2026-11-12
 * "Yes, allow edited send", SPEC v2.15 3장(v2.9 이름 토큰).
 * **실호출 0회** — AI는 호출을 기록하는 가짜 LlmCaller, PayPal은 횟수를 세는 가짜 호출기. 개발 서버 없음. `.env`를 읽지 않는다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { formatFact } from '@/ai/tokens';
import type { LoadDemoDisputesResult } from '@/app/_server/disputes';
import { t } from '@/app/_shared/copy';
import { filledSnippets } from '@/app/cases/desk-actions';
import { editAdditions, nameLeftovers, revertToTokens, withEditChecks } from '@/app/cases/edited-reply';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import {
  buildReplyView,
  canSend,
  detailsMustOpen,
  EDIT_KEYS,
  EDITED_KEY,
  editGate,
  fillFactTokens,
  type EditedPrepareOutcome,
  type ReplyViewInput,
} from '@/app/cases/reply-model';
import { appendSentence } from '@/engine/forecast';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import { replySnippetsFor } from '@/engine/snippets';
import { parseDisputeDetail, type DisputeDetail } from '@/paypal/disputes';
import type { ApiRequest, BoardState, Cause, DemoLink, FactToken, LlmCaller } from '@/types';

import { P, R } from '../acceptance/boards';

vi.mock('server-only', () => ({}));

const { prepareEditedReply, recallReply, rememberReply, resolveSendMode, sendReply } = await import('@/app/_server/send');
type PreparedReply = import('@/app/_server/send').PreparedReply;
type SendReplyDeps = import('@/app/_server/send').SendReplyDeps;

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

// ── 서연 (A2 통관 보류) 꼴 분쟁 · 시드 구매자 B01 (이름 토큰 있음) ─────────────────

const ID = 'PP-R-TEST-T100';
const cause = (subtype: Cause['subtype']): Cause => ({ subtype, confidence: 1, evidence: [], needsReview: false, source: 'rule' });
const BASE: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause'> = {
  disputeId: ID,
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-30T00:37:00Z',
  amountCents: 7200,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
  buyerPriorInrDisputes: 0,
  isDemo: false,
};
const BEFORE: BoardState = { ...BASE, hasTracking: false, hasDeliveredTracking: false, cause: cause('A1') };
const AFTER: BoardState = { ...BASE, hasTracking: true, hasDeliveredTracking: false, isDemo: true, cause: cause('A2') };
const NOW = '2026-11-10T03:00:00Z';
const BOTH = caseReplyFacts({ now: NOW, dueDate: BASE.dueDate, buyerId: 'B01', buyerLocale: 'ko' });
const FACTS: FactToken[] = BOTH.outgoing;
const DRAFT_FACTS: FactToken[] = BOTH.draft;

const LINKS: DemoLink[] = [
  { paypalDisputeId: ID, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: 'PP-R-TEST-NOLIVE', seedDisputeId: 'D3', carrierOrderId: 'O08', showOnScreen: true, liveSendAllowed: false },
];

/** 검사받은 AI 초안 (토큰 글). 화면 입력칸에는 이것을 영어 벌로 채운 글이 보인다. */
const DRAFT_EN =
  "Sorry for the wait, ⟦BUYER_NAME_1⟧. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. ⟦SELLER_NAME_1⟧";
const OUTGOING =
  '⟦BUYER_NAME_1⟧, 기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦SELLER_NAME_1⟧';
/** 날짜 칩(Add)을 넣은 글의 가짜 번역. */
const OUTGOING_WITH_DATE =
  '⟦BUYER_NAME_1⟧, 기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사에 확인해서 다시 연락드릴게요. ⟦SELLER_NAME_1⟧';

const ANCHOR = fillFactTokens(DRAFT_EN, DRAFT_FACTS, 'en');
const DATE_SNIPPET = filledSnippets(replySnippetsFor('A2'), DRAFT_FACTS).date as string;

const NAMES = ['Seo-yeon', '서연', 'Hannah', 'Fernwood'];

type LlmRequest = Parameters<LlmCaller>[0];
function fakeLlm(...answers: unknown[]): { calls: LlmRequest[]; llm: LlmCaller } {
  const calls: LlmRequest[] = [];
  return {
    calls,
    llm: async (req) => {
      calls.push(req);
      const answer = answers[Math.min(calls.length - 1, answers.length - 1)];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}

function loaded(disputeId = ID): LoadDemoDisputesResult {
  return {
    disputes: [
      {
        key: 'D2',
        disputeId,
        statusCode: 'WAITING_FOR_SELLER_RESPONSE',
        buyer: { id: 'B01', name: 'Seo-yeon Park', country: 'KR', language: 'KO', sandbox: true, role: 'buyer' },
        product: null,
        buyerMessages: [],
        boardReal: { ...BEFORE, disputeId },
        boardDemo: { ...AFTER, disputeId },
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

function aiReply(disputeId = ID): PreparedReply {
  return {
    disputeId,
    draftSource: 'ai',
    draftEn: DRAFT_EN,
    outgoing: OUTGOING,
    outsidePolicy: [],
    addedInTranslation: [],
    nameProblems: [],
    facts: FACTS,
    buyerLocale: 'ko',
  };
}

const prepDeps = (llm: LlmCaller | null, disputeId = ID) => ({ load: async () => loaded(disputeId), llm, now: NOW, links: LINKS, params: P, rules: R });

function sendFakes(mode: 'live' | 'simulated', opts: { sellerReplied?: boolean; disputeId?: string } = {}) {
  const live: ApiRequest[] = [];
  const simulated: ApiRequest[] = [];
  const detail = (id: string): DisputeDetail =>
    parseDisputeDetail({
      dispute_id: id,
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      dispute_life_cycle_stage: 'INQUIRY',
      dispute_channel: 'INTERNAL',
      dispute_amount: { currency_code: 'USD', value: '72.00' },
      messages: opts.sellerReplied ? [{ posted_by: 'SELLER', content: 'hi' }] : [{ posted_by: 'BUYER', content: '...' }],
    });
  const deps: SendReplyDeps = {
    mode,
    load: async () => loaded(opts.disputeId ?? ID),
    readDetail: async (id) => detail(id),
    liveCall: async (req) => {
      live.push(req);
      return { status: 200, body: {} };
    },
    simulatedCall: async (req) => {
      simulated.push(req);
      return { status: 200, body: {} };
    },
    now: NOW,
    links: LINKS,
    params: P,
    rules: R,
  };
  return { deps, live, simulated };
}

/** 고친 글 보기용 값 (화면이 하는 것과 같다: 초안 = 되돌린 토큰 글, 번역 = 서버 결과). */
function editedViewOf(result: Extract<EditedPrepareOutcome, { ok: true }>) {
  const best = recommend(AFTER, P, R).best;
  const input: ReplyViewInput = {
    draft: { ok: true, buyerMessageEn: '', coaching: [], draftEn: result.draftEn, outsidePolicy: [] },
    translation: result.translation,
    facts: FACTS,
    draftFacts: DRAFT_FACTS,
    board: AFTER,
    statusCode: 'WAITING_FOR_SELLER_RESPONSE',
    buyerLocale: 'ko',
    plan: best === null ? null : planMove(AFTER, best, P, R),
    offerFirst: false,
    mode: 'simulated',
    draftSource: 'ai',
    confirmed: [],
    sendState: 'idle',
    outcome: null,
    riskAfterReply: null,
  };
  return buildReplyView(input);
}

// ───────────────────────────── 만들 것 2: 값 → 토큰 되돌리기 ─────────────────────────────

describe('만들 것 2: 값 → 토큰 되돌리기 (fillTokens의 반대)', () => {
  it('채워 보인 AI 초안은 원래 토큰 글로 돌아간다', () => {
    expect(ANCHOR).toContain('Seo-yeon');
    expect(revertToTokens(ANCHOR, DRAFT_FACTS, { plan: null, board: AFTER }, DRAFT_EN)).toBe(DRAFT_EN);
  });

  it('날짜 칩(Add)의 날짜 · 짧은 날짜 · 금액 표기도 되돌린다', () => {
    const date = DRAFT_FACTS.find((f) => f.kind === 'DATE') as FactToken;
    const long = formatFact('DATE', date.value, 'en');
    expect(DATE_SNIPPET).toContain(long);
    const edited = appendSentence(ANCHOR, DATE_SNIPPET);
    const back = revertToTokens(edited, DRAFT_FACTS, { plan: null, board: AFTER }, DRAFT_EN);
    expect(back).toContain('⟦DATE_1⟧');
    expect(back).not.toContain(long);
    expect(revertToTokens('By Nov 17 or so.', [{ token: '⟦DATE_1⟧', kind: 'DATE', value: '2026-11-17' }], { plan: null, board: null }, '')).toBe(
      'By ⟦DATE_1⟧ or so.',
    );
    expect(revertToTokens('Your $72.00 order.', [], { plan: null, board: AFTER }, '')).toBe('Your {{disputeAmount}} order.');
  });

  it('되돌릴 수 없는 이름(다르게 쓴 값)은 그대로 두고, 남은 조각을 찾는다', () => {
    const odd = ANCHOR.replace('Seo-yeon', '서연');
    const back = revertToTokens(odd, DRAFT_FACTS, { plan: null, board: AFTER }, DRAFT_EN);
    expect(back).toContain('서연');
    expect(nameLeftovers(back, [...DRAFT_FACTS, ...FACTS])).toContain('서연');
    expect(nameLeftovers(revertToTokens('Thanks, Hannah', DRAFT_FACTS, { plan: null, board: null }, ''), DRAFT_FACTS)).toContain('Hannah');
    expect(nameLeftovers(DRAFT_EN, [...DRAFT_FACTS, ...FACTS])).toEqual([]);
  });
});

// ───────────────────────────── (a) Add 칩으로 고친 글 → 번역 → Simulated 보내기 ─────────────────────────────

describe('(a) Add 칩으로 고친 글 → 가짜 번역 → sendable → 공개 모드 Simulated, POST 0', () => {
  it('서버가 토큰 글로 번역·검사하고 번호를 준다 → 기존 sendReply로 Simulated (실제 호출기 0회)', async () => {
    const edited = appendSentence(ANCHOR, DATE_SNIPPET);
    const ai = fakeLlm({ outgoing: OUTGOING_WITH_DATE }, { back_translation_en: 'Back translation.' });
    const result = await prepareEditedReply({ disputeId: ID, reply: aiReply(), text: edited }, prepDeps(ai.llm));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ai.calls).toHaveLength(2); // 번역 + 역번역
    expect(result.translation.sendable).toBe(true);
    expect(result.replyId).toMatch(/^r-[0-9a-f]{32}$/);
    expect(result.draftEn).toContain('⟦DATE_1⟧');

    // 화면: 고친 글 기준 보기용 값 → Send 켜짐, 전송본은 채운 한국어
    const view = editedViewOf(result);
    expect(canSend(view)).toEqual({ ok: true, reasonKey: null });
    expect(view.outgoing?.text).toContain('서연 님');
    expect(editGate({ ok: false, reasonKey: null }, edited, ANCHOR, { status: { state: 'ready', gate: canSend(view) } }).ok).toBe(true);

    // 공개 모드(기본) = Simulated. 보내기는 기억한 번호로 기존 관문을 그대로 지난다
    expect(resolveSendMode({})).toBe('simulated');
    const f = sendFakes('simulated');
    const outcome = await sendReply(
      { disputeId: ID, reply: recallReply(result.replyId as string), confirmedCommitments: [], approved: true },
      f.deps,
    );
    expect(outcome).toEqual({ ok: true, mode: 'simulated', disputeId: ID });
    expect(f.live).toHaveLength(0);
    expect(f.simulated).toHaveLength(1);
  });

  it('고친 글 입구는 PayPal 쓰기 호출기를 받지 않는다 (의존성에 호출기 없음 · 이 입구에 POST 없음)', () => {
    const src = read('src/app/_server/send.ts');
    const entry = src.slice(src.indexOf('export async function prepareEditedReply'));
    expect(entry).not.toMatch(/liveCall|simulatedCall|executeMove|\.call\(/);
  });
});

// ───────────────────────────── (b) 손으로 넣은 새 약속 → 검사 실패 ─────────────────────────────

describe('(b) "I will refund you in full"을 손으로 넣음 → 검사 실패 → Send 꺼짐 + Details 펼침', () => {
  it('환불 약속: "No new promises" 실패, 번호 없음, 관문 꺼짐, Details 자동 펼침', async () => {
    const edited = `${ANCHOR} If it does not arrive, I will refund you in full.`;
    const ai = fakeLlm({ outgoing: `${OUTGOING} 도착하지 않으면 전액 환불해 드릴게요.` }, { back_translation_en: 'Back.' });
    const result = await prepareEditedReply({ disputeId: ID, reply: aiReply(), text: edited }, prepDeps(ai.llm));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.replyId).toBeNull(); // 서버가 기억하지 않는다 → 보낼 번호가 없다
    expect(result.translation.sendable).toBe(false);
    expect(result.translation.check.ok).toBe(false);
    expect(result.translation.check.newPromises).toContain('refund');
    const view = editedViewOf(result);
    expect(canSend(view).ok).toBe(false);
    expect(detailsMustOpen(view)).toBe(true);
    expect(view.checkRows.find((row) => row.labelKey === 'case.reply.check.promises')?.ok).toBe(false);
  });

  it('확언 표현("guarantee")도 원래 초안과 견줘 막는다', () => {
    const add = editAdditions(DRAFT_EN, `${DRAFT_EN} I guarantee it arrives.`, FACTS);
    expect(add.promises.length).toBeGreaterThan(0);
    expect(editAdditions(DRAFT_EN, DRAFT_EN, FACTS)).toEqual({ commitments: [], promises: [] });
  });

  it('withEditChecks: 더한 것이 없으면 번역 결과 그대로', () => {
    const ok = {
      ok: true as const,
      outgoing: OUTGOING,
      backTranslationEn: 'b',
      check: { ok: true, missing: [], extra: [], literalFacts: [], newPromises: [] },
      sendable: true,
      outsidePolicy: [],
      addedInTranslation: [],
      nameProblems: [],
    };
    expect(withEditChecks(ok, { commitments: [], promises: [] })).toBe(ok);
    const blocked = withEditChecks(ok, { commitments: ['reship'], promises: [] });
    expect(blocked.ok && blocked.sendable).toBe(false);
  });
});

// ───────────────────────────── (c) AI에 이름 값을 보내지 않는다 ─────────────────────────────

describe('(c) 가짜 LLM이 받은 글에 "Seo-yeon"·"서연"·"Hannah" 없음 (토큰만)', () => {
  it('번역·역번역 요청 어디에도 이름 값이 없고, 토큰은 있다', async () => {
    const edited = appendSentence(ANCHOR, DATE_SNIPPET);
    const ai = fakeLlm({ outgoing: OUTGOING_WITH_DATE }, { back_translation_en: 'Back.' });
    await prepareEditedReply({ disputeId: ID, reply: aiReply(), text: edited }, prepDeps(ai.llm));
    expect(ai.calls).toHaveLength(2);
    const sent = ai.calls.map((c) => `${c.system}\n${c.user}`).join('\n');
    for (const name of NAMES) expect(sent).not.toContain(name);
    expect(ai.calls[0].user).toContain('⟦BUYER_NAME_1⟧');
  });

  it('이름을 다르게 썼으면(되돌릴 수 없음) AI를 부르지 않는다 → 이유 한 줄', async () => {
    for (const text of [ANCHOR.replace('Seo-yeon', '서연'), `${ANCHOR} Hannah`, ANCHOR.replace('Seo-yeon', 'seo-yeon')]) {
      const ai = fakeLlm({ outgoing: OUTGOING }, { back_translation_en: 'Back.' });
      const result = await prepareEditedReply({ disputeId: ID, reply: aiReply(), text }, prepDeps(ai.llm));
      expect(result).toEqual({ ok: false, reasonKey: EDIT_KEYS.nameLiteral });
      expect(ai.calls).toHaveLength(0);
    }
    expect(t(EDIT_KEYS.nameLiteral)).toBe('Write names the way the AI draft shows them');
  });
});

// ───────────────────────────── (d) AI 없음 ─────────────────────────────

describe('(d) AI 없음 → Send 꺼짐 + 이유 ("AI unavailable — use the AI draft")', () => {
  it('호출기 없음 · 호출 실패(한도 초과 등) 모두 같은 이유, 번호 없음', async () => {
    const edited = appendSentence(ANCHOR, DATE_SNIPPET);
    expect(await prepareEditedReply({ disputeId: ID, reply: aiReply(), text: edited }, prepDeps(null))).toEqual({
      ok: false,
      reasonKey: EDIT_KEYS.aiUnavailable,
    });
    const failing = fakeLlm(new Error('rate_limited'));
    expect(await prepareEditedReply({ disputeId: ID, reply: aiReply(), text: edited }, prepDeps(failing.llm))).toEqual({
      ok: false,
      reasonKey: EDIT_KEYS.aiUnavailable,
    });
    const gate = editGate({ ok: true, reasonKey: null }, edited, ANCHOR, { status: { state: 'failed', reasonKey: EDIT_KEYS.aiUnavailable } });
    expect(gate).toEqual({ ok: false, reasonKey: EDIT_KEYS.aiUnavailable, translate: false });
    expect(t(EDIT_KEYS.aiUnavailable)).toBe('AI unavailable — use the AI draft');
  });

  it('번역 중: Send 꺼짐 + "Translating…"', () => {
    const gate = editGate({ ok: true, reasonKey: null }, 'x', 'y', { status: { state: 'translating' } });
    expect(gate).toEqual({ ok: false, reasonKey: EDIT_KEYS.translating, translate: false });
    expect(t(EDIT_KEYS.translating)).toBe('Translating…');
    expect(t(EDITED_KEY)).toBe('Edited — translate and check it before sending');
  });

  it('기억한 AI 답장이 없거나(서버 재시작) 다른 분쟁 것이면 AI를 부르지 않는다', async () => {
    const ai = fakeLlm({ outgoing: OUTGOING });
    expect((await prepareEditedReply({ disputeId: ID, reply: null, text: ANCHOR }, prepDeps(ai.llm))).ok).toBe(false);
    expect((await prepareEditedReply({ disputeId: ID, reply: aiReply('PP-R-OTHER'), text: ANCHOR }, prepDeps(ai.llm))).ok).toBe(false);
    expect(ai.calls).toHaveLength(0);
  });
});

// ───────────────────────────── (e) 녹화 모드에서도 관문 그대로 ─────────────────────────────

describe('(e) 녹화 모드에서도 관문 그대로 (허용 목록 · 판매자 글 다시 읽기 · 승인)', () => {
  async function editedId(disputeId = ID): Promise<string> {
    const ai = fakeLlm({ outgoing: OUTGOING_WITH_DATE }, { back_translation_en: 'Back.' });
    const r = await prepareEditedReply(
      { disputeId, reply: aiReply(disputeId), text: appendSentence(ANCHOR, DATE_SNIPPET) },
      prepDeps(ai.llm, disputeId),
    );
    if (!r.ok || r.replyId === null) throw new Error('prepare failed');
    return r.replyId;
  }

  it('녹화 + 스위치 = live. 판매자 글이 이미 있으면 거부 (실제 호출 0)', async () => {
    expect(resolveSendMode({ DEMO_MODE: 'recording', AFTERLOOP_REAL_SEND: '1' })).toBe('live');
    const f = sendFakes('live', { sellerReplied: true });
    const outcome = await sendReply({ disputeId: ID, reply: recallReply(await editedId()), confirmedCommitments: [], approved: true }, f.deps);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.failure).toBe('already_replied');
    expect(f.live).toHaveLength(0);
  });

  it('허용 목록 밖 분쟁은 live에서 거부 · 승인 없으면 거부 (실제 호출 0)', async () => {
    const id2 = 'PP-R-TEST-NOLIVE';
    const f = sendFakes('live', { disputeId: id2 });
    const blocked = await sendReply({ disputeId: id2, reply: recallReply(await editedId(id2)), confirmedCommitments: [], approved: true }, f.deps);
    expect(blocked.ok).toBe(false);
    const g = sendFakes('live');
    const unapproved = await sendReply({ disputeId: ID, reply: recallReply(await editedId()), confirmedCommitments: [], approved: false }, g.deps);
    expect(unapproved.ok).toBe(false);
    expect(f.live).toHaveLength(0);
    expect(g.live).toHaveLength(0);
  });

  it('관문을 모두 지나면 live 1회 — 이름 값은 보내기 직전에 서버가 채운다 (AI에는 토큰만 갔다)', async () => {
    const f = sendFakes('live');
    const outcome = await sendReply({ disputeId: ID, reply: recallReply(await editedId()), confirmedCommitments: [], approved: true }, f.deps);
    expect(outcome.ok).toBe(true);
    expect(f.live).toHaveLength(1);
    expect(JSON.stringify(f.live[0].body)).toContain('서연 님');
    expect(JSON.stringify(f.live[0].body)).not.toContain('⟦');
  });

  it('기존 관문 코드(sendReply·sendFromScreen·resolveSendMode)는 그대로 있다', () => {
    const src = read('src/app/_server/send.ts');
    expect(src).toMatch(/export async function sendReply\(input: SendReplyInput, deps: SendReplyDeps\)/);
    expect(src).toMatch(/if \(resolveDemoMode\(env\) !== 'recording'\) return 'simulated';/);
    expect(src).toMatch(/return env\.AFTERLOOP_REAL_SEND === '1' \? 'live' : 'simulated';/);
  });
});

// ───────────────────────────── 6. 환불 상태에서는 보내지 않는다 ─────────────────────────────

describe('6. 환불 카드 상태에서는 Send 꺼짐 + 이유 · 고친 글 경로에도 막는 검사', () => {
  it('editGate: 환불 상태면 글이 초안과 같아도 꺼짐 ("Refund is simulated in this demo — nothing is sent")', () => {
    const ok = { ok: true, reasonKey: null };
    expect(editGate(ok, ANCHOR, ANCHOR, { refund: true })).toEqual({ ok: false, reasonKey: EDIT_KEYS.refundSimulated, translate: false });
    expect(editGate(ok, 'Refunded.', ANCHOR, { refund: true, status: { state: 'ready', gate: ok } }).ok).toBe(false);
    expect(t(EDIT_KEYS.refundSimulated)).toBe('Refund is simulated in this demo — nothing is sent');
  });

  it('서버: 환불 안내 글(Refund done)을 보내려 하면 AI를 부르지 않고 거부', async () => {
    const refundNote = t('case.reply.refundDraft', { name: 'Seo-yeon' });
    const ai = fakeLlm({ outgoing: OUTGOING }, { back_translation_en: 'Back.' });
    for (const text of [refundNote, `${ANCHOR} I have refunded the full amount of your order.`]) {
      const result = await prepareEditedReply({ disputeId: ID, reply: aiReply(), text }, prepDeps(ai.llm));
      expect(result).toEqual({ ok: false, reasonKey: EDIT_KEYS.refundSimulated });
    }
    expect(ai.calls).toHaveLength(0);
  });

  it('화면: 환불 카드(path refund)·환불했다는 글이면 관문에 refund를 넘긴다', () => {
    const src = read('src/app/cases/reply/reply-panel.tsx');
    expect(src).toMatch(/const refundState = desk\.path === 'refund' \|\| \(edited && detectedNow\?\.features\.refundNow === true\);/);
    expect(src).toMatch(/refund: view\.offer === null && refundState,/);
  });
});

// ───────────────────────────── 문구 · 화면 연결 ─────────────────────────────

describe('문구 en=ko, 화면은 번호만 보낸다', () => {
  it('새 문구 키가 두 파일에 있다', async () => {
    const { copyTables } = await import('@/app/_shared/copy');
    for (const key of [
      EDITED_KEY,
      'case.reply.translateCheck',
      EDIT_KEYS.translating,
      EDIT_KEYS.aiUnavailable,
      EDIT_KEYS.nameLiteral,
      EDIT_KEYS.invalid,
      EDIT_KEYS.refundSimulated,
      'case.reply.editedChecked',
    ]) {
      expect(copyTables.en[key], key).toBeTypeOf('string');
      expect(copyTables.ko[key], key).toBeTypeOf('string');
    }
    expect(copyTables.en['case.reply.editedCantSend']).toBeUndefined();
  });

  it('보내기 서버 액션에는 번호만, 고친 글은 번역·검사 액션으로만', () => {
    const panel = read('src/app/cases/reply/reply-panel.tsx');
    expect(panel).toMatch(/sendReplyAction\(\{ disputeId, kind, replyId: sendId, confirmedCommitments: confirmed \}\)/);
    expect(panel).toMatch(/prepareEditedAction\(\{ disputeId, replyId, text: sentFor \}\)/);
    const actions = read('src/app/cases/actions.ts');
    expect(actions).toMatch(/export async function prepareEditedAction/);
    expect(actions).toMatch(/text: z\.string\(\)\.min\(1\)\.max\(DRAFT_INPUT_MAX_CHARS\)/);
  });

  it('rememberReply는 그대로 — 같은 글이면 같은 번호', () => {
    expect(rememberReply(aiReply())).toBe(rememberReply(aiReply()));
  });
});
