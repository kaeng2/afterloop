/**
 * T009 2부: 답장 전송 (`src/app/_server/send.ts`) — 스위치 · 가짜 호출기 · 실제 전송 문지기 · 전송 본체.
 *
 * 기대값 출처: `tests/acceptance/drafts/AC18.md` 7~11번, `tasks/T009.md` 2부 "전송"·"두 번 보내지 않게
 * 하는 장치"·"실패했을 때 화면"·"제안이 먼저"·"정책 밖 약속", SPEC v2.7 3·9-1·9-4·9-5장.
 *
 * **실제 호출 없음.** PayPal 읽기·전송과 LLM은 모두 횟수를 세는 가짜다. `.env`를 읽지 않는다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { draftReply, translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { checkTokens } from '@/ai/tokens';
import type { LoadDemoDisputesResult } from '@/app/_server/disputes';
import { buildReplyView, canSend } from '@/app/cases/reply-model';
import { replyFacts } from '@/engine/followup';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import { parseDisputeDetail, type DisputeDetail } from '@/paypal/disputes';
import type { ApiRequest, BoardState, Cause, DemoLink, FactToken, LlmCaller } from '@/types';

import { D1_JIHO, P, R } from '../acceptance/boards';

vi.mock('server-only', () => ({}));

const {
  createSimulatedCaller,
  fixedTranslation,
  guardLiveSend,
  loadFixedDraft,
  preparedReplyId,
  recallReply,
  rememberReply,
  resolveDraftSource,
  resolveSendMode,
  sendReply,
} = await import('@/app/_server/send');
type PreparedReply = import('@/app/_server/send').PreparedReply;
type SendReplyDeps = import('@/app/_server/send').SendReplyDeps;

// ── 공용 입력 (AC18 초안 "공용 입력") ─────────────────────────────────────

const ruleCause = (subtype: Cause['subtype'], causeNote?: string): Cause => ({
  subtype,
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
  ...(causeNote === undefined ? {} : { causeNote }),
});

const ID = 'PP-R-TEST-D2';
const D2_BASE: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause'> = {
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
const D2_BEFORE: BoardState = { ...D2_BASE, hasTracking: false, hasDeliveredTracking: false, cause: ruleCause('A1') };
const D2_AFTER: BoardState = {
  ...D2_BASE,
  hasTracking: true,
  hasDeliveredTracking: false,
  isDemo: true,
  cause: ruleCause('A2', 'Customs hold – recipient customs ID missing'),
};

const NOW = '2026-11-10T03:00:00Z';
const FACTS: FactToken[] = replyFacts({ now: NOW, disputeDueDate: D2_BASE.dueDate });

/** 연결 표 (시험용): 서연 꼴 · 지호 꼴 · 연습용 · 옛 분쟁(시연 제외) · 화면에는 있지만 실제 전송 불가. */
const LINKS: DemoLink[] = [
  { paypalDisputeId: ID, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: D1_JIHO.disputeId, seedDisputeId: 'D1', carrierOrderId: 'O02', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: 'PP-R-TEST-PRACTICE', seedDisputeId: null, carrierOrderId: null, showOnScreen: false, liveSendAllowed: true },
  { paypalDisputeId: 'PP-R-TEST-OLD', seedDisputeId: null, carrierOrderId: null, showOnScreen: false, liveSendAllowed: false },
  { paypalDisputeId: 'PP-R-TEST-D3', seedDisputeId: 'D3', carrierOrderId: 'O08', showOnScreen: true, liveSendAllowed: false },
];

// 시험용 대역 글 (AC18 초안. 화면·문구 파일에는 넣지 않는다). 맨 끝 환불 문장이 없는 판도 둔다
const DRAFT_EN_AC18 =
  "Sorry for the wait, Seo-yeon. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and it should reach you by ⟦DATE_1⟧. If not, I'll refund you in full.";
const OUTGOING_AC18 =
  '서연 님, 기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 ⟦DATE_1⟧까지 받으실 수 있을 거예요. 그때까지 도착하지 않으면 전액 환불해 드릴게요.';
const DRAFT_EN =
  "Sorry for the wait, Seo-yeon. Your sweater is at Korean customs, waiting for your personal customs code. Reply with it and I'll pass it to the carrier. I'll check with the carrier and get back to you by ⟦DATE_1⟧.";
const OUTGOING =
  '서연 님, 기다리게 해서 죄송해요. 스웨터는 현재 한국 세관에서 개인통관고유부호를 기다리고 있어요. 번호를 답장으로 알려주시면 운송사에 바로 전달할게요. ⟦DATE_1⟧까지 운송사 상황을 확인해서 다시 연락드릴게요.';

type LlmRequest = Parameters<LlmCaller>[0];
function fakeLlm(...answers: unknown[]): { calls: LlmRequest[]; llm: LlmCaller } {
  const calls: LlmRequest[] = [];
  return {
    calls,
    llm: async (req) => {
      calls.push(req);
      return answers[Math.min(calls.length - 1, answers.length - 1)];
    },
  };
}

const COACHING = ['Say sorry for the wait first.', 'Explain the customs hold in one line.', 'Ask for the customs code.'];

async function prepare(draftEn: string, outgoing: string): Promise<{ draft: ReplyDraft; translation: ReplyTranslation }> {
  const draft = await draftReply(
    { buyerMessages: ['배송이 안 와요'], buyerLocale: 'ko', cause: D2_AFTER.cause as Cause, move: 'fight', facts: FACTS },
    { llm: fakeLlm({ buyer_message_en: 'It has not arrived.', coaching: COACHING, draft_en: draftEn }).llm },
  );
  if (!draft.ok) throw new Error(`draft failed: ${draft.detail}`);
  const translation = await translateReply(
    { draftEn: draft.draftEn, buyerLocale: 'ko', facts: FACTS, move: 'fight' },
    { llm: fakeLlm({ outgoing }, { back_translation_en: 'Back translation.' }).llm },
  );
  return { draft, translation };
}

function preparedFrom(draftEn: string, translation: ReplyTranslation, overrides: Partial<PreparedReply> = {}): PreparedReply {
  if (!translation.ok) throw new Error('translation failed');
  return {
    disputeId: ID,
    draftSource: 'ai',
    draftEn,
    outgoing: translation.outgoing,
    outsidePolicy: translation.outsidePolicy,
    addedInTranslation: translation.addedInTranslation,
    facts: FACTS,
    buyerLocale: 'ko',
    ...overrides,
  };
}

function detail(messages: { posted_by: string; content: string }[] = [], disputeId = ID): DisputeDetail {
  return parseDisputeDetail({
    dispute_id: disputeId,
    reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    dispute_life_cycle_stage: 'INQUIRY',
    dispute_channel: 'INTERNAL',
    dispute_amount: { currency_code: 'USD', value: '72.00' },
    messages,
  });
}

function loadedWith(boardReal: BoardState, boardDemo: BoardState | null): LoadDemoDisputesResult {
  return {
    disputes: [
      {
        key: 'D2',
        disputeId: boardReal.disputeId,
        statusCode: 'WAITING_FOR_SELLER_RESPONSE',
        buyer: null,
        product: null,
        buyerMessages: [],
        boardReal,
        boardDemo,
        demoFields: [],
        carrierEvents: [],
        signals: null,
        signalsAfterReply: null,
        liveSendAllowed: true,
      },
    ],
    paypal: { ok: true },
    llm: { ok: true },
  };
}

/** 횟수를 세는 가짜들. `liveStatus`가 함수면 그것이 실제 호출기의 동작이다. */
function fakes(opts: { mode: 'live' | 'simulated'; liveStatus?: number | 'throw'; sellerReplied?: boolean; load?: LoadDemoDisputesResult } ) {
  const live: ApiRequest[] = [];
  const simulated: ApiRequest[] = [];
  let reads = 0;
  let loads = 0;
  const deps: SendReplyDeps = {
    mode: opts.mode,
    load: async () => {
      loads += 1;
      return opts.load ?? loadedWith(D2_BEFORE, D2_AFTER);
    },
    readDetail: async (disputeId) => {
      reads += 1;
      return detail(opts.sellerReplied ? [{ posted_by: 'SELLER', content: 'hello' }] : [{ posted_by: 'BUYER', content: '...' }], disputeId);
    },
    liveCall: async (req) => {
      live.push(req);
      if (opts.liveStatus === 'throw') throw new Error('network down');
      return { status: opts.liveStatus ?? 200, body: {} };
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
  return { deps, live, simulated, counts: () => ({ live: live.length, simulated: simulated.length, reads, loads }) };
}

let PASSING: PreparedReply;
beforeEach(async () => {
  const { translation } = await prepare(DRAFT_EN, OUTGOING);
  PASSING = preparedFrom(DRAFT_EN, translation);
});

const sendInput = (reply: PreparedReply | null, overrides: Partial<Parameters<typeof sendReply>[0]> = {}) => ({
  disputeId: ID,
  reply,
  confirmedCommitments: [],
  approved: true,
  ...overrides,
});

// ── AC18 8번: 스위치 ─────────────────────────────────────────────────────

describe('AC18 8번: 스위치는 정확히 "1"일 때만 켜진다', () => {
  const offValues: (string | undefined)[] = [undefined, 'true', '0', '', ' 1'];

  it('AFTERLOOP_REAL_SEND: 앞의 다섯은 simulated, "1"만 live', () => {
    for (const value of offValues) expect(resolveSendMode({ AFTERLOOP_REAL_SEND: value })).toBe('simulated');
    expect(resolveSendMode({})).toBe('simulated');
    expect(resolveSendMode({ AFTERLOOP_REAL_SEND: '1' })).toBe('live');
  });

  it('AFTERLOOP_FIXED_DRAFT: 앞의 다섯은 ai, "1"만 fixed', () => {
    for (const value of offValues) expect(resolveDraftSource({ AFTERLOOP_FIXED_DRAFT: value })).toBe('ai');
    expect(resolveDraftSource({ AFTERLOOP_FIXED_DRAFT: '1' })).toBe('fixed');
  });

  it('한 변수를 켜도 다른 쪽은 그대로다', () => {
    expect(resolveDraftSource({ AFTERLOOP_REAL_SEND: '1' })).toBe('ai');
    expect(resolveSendMode({ AFTERLOOP_FIXED_DRAFT: '1' })).toBe('simulated');
  });

  it('고정 초안은 사람이 정하기 전까지 "없음"이다', () => {
    expect(loadFixedDraft()).toBeNull();
  });
});

// ── AC18 9번: 가짜 전송 ─────────────────────────────────────────────────

describe('AC18 9번: 가짜 전송은 실제 호출기를 부르지 않는다', () => {
  it('통과하는 글 → 실제 호출기 0회, 가짜 1회, 결과는 simulated', async () => {
    const f = fakes({ mode: 'simulated' });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    expect(outcome).toEqual({ ok: true, mode: 'simulated', disputeId: ID });
    expect(f.counts().live).toBe(0);
    expect(f.counts().simulated).toBe(1);
    expect(f.counts().reads).toBe(0); // 가짜 전송은 전송 직전 다시 읽기(GET)도 하지 않는다
  });

  it('보기용 값에 "Simulated"가 있고, 실제 응답처럼 읽히는 표기가 없다', async () => {
    const f = fakes({ mode: 'simulated' });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    const view = buildReplyView({
      draft: { ok: true, buyerMessageEn: '', coaching: COACHING, draftEn: DRAFT_EN, outsidePolicy: [] },
      translation: null,
      facts: FACTS,
      buyerLocale: 'ko',
      plan: null,
      offerFirst: false,
      mode: 'simulated',
      draftSource: 'ai',
      confirmed: [],
      sendState: 'done',
      outcome,
      riskAfterReply: null,
    });
    expect(view.result).toEqual({ kind: 'simulated' });
    expect(view.canReset).toBe(true);
  });

  it('가짜 호출기는 네트워크 없이 200을 돌려준다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const call = createSimulatedCaller();
    await expect(call({ method: 'POST', path: '/x', body: {}, requestId: 'al-1' })).resolves.toMatchObject({ status: 200 });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

// ── AC18 10번: 실제 전송 + 가짜 호출기 ─────────────────────────────────

describe('AC18 10번: 실제 전송 방식 + 가짜 호출기', () => {
  it('(가) 한 번 → 호출 1회, send-message 경로, 요청 번호 36자 이하, 결과에 상태 코드와 분쟁 번호', async () => {
    const f = fakes({ mode: 'live' });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    expect(f.counts()).toMatchObject({ live: 1, simulated: 0, reads: 1 });
    expect(f.live[0].path).toBe(`/v1/customer/disputes/${ID}/send-message`);
    expect(f.live[0].requestId.length).toBeLessThanOrEqual(36);
    expect(outcome).toEqual({ ok: true, mode: 'live', disputeId: ID, endpoint: 'send-message', status: 200 });
  });

  it('보내는 글은 토큰을 한국어 표기로 채운 전송본이다 (⟦·⟧ 없음, "11월 17일")', async () => {
    const f = fakes({ mode: 'live' });
    await sendReply(sendInput(PASSING), f.deps);
    const message = String(f.live[0].body.message);
    expect(message).toContain('11월 17일');
    expect(message).not.toMatch(/[⟦⟧]/);
  });

  it('(나) 같은 계획·같은 글 두 번 → 호출 1회, 두 번째는 같은 결과', async () => {
    const f = fakes({ mode: 'live' });
    const first = await sendReply(sendInput(PASSING), f.deps);
    const second = await sendReply(sendInput(PASSING), f.deps);
    expect(f.counts().live).toBe(1);
    expect(second).toEqual(first);
  });

  it('(다) 분쟁에 판매자 글이 이미 있음 → 호출 0회, already replied', async () => {
    const f = fakes({ mode: 'live', sellerReplied: true });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    expect(f.counts().live).toBe(0);
    expect(outcome).toMatchObject({ ok: false, failure: 'already_replied' });
    if (!outcome.ok) expect(outcome.error).toMatch(/already replied/);
  });

  it('(라) 허용 목록 밖 번호 · 화면에는 있지만 실제 전송 불가 → 호출 0회', async () => {
    for (const disputeId of ['PP-R-TEST-NOT-IN-TABLE', 'PP-R-TEST-D3']) {
      const f = fakes({ mode: 'live' });
      const outcome = await sendReply(sendInput({ ...PASSING, disputeId }, { disputeId }), f.deps);
      expect(f.counts(), disputeId).toMatchObject({ live: 0, simulated: 0, reads: 0, loads: 0 });
      expect(outcome).toMatchObject({ ok: false, failure: 'blocked' });
    }
  });

  it('(마) 연습용·시연 제외 분쟁 → 실제·가짜 모두 호출 0회 (읽지도 않는다)', async () => {
    for (const mode of ['live', 'simulated'] as const) {
      for (const disputeId of ['PP-R-TEST-PRACTICE', 'PP-R-TEST-OLD']) {
        const f = fakes({ mode });
        const outcome = await sendReply(sendInput({ ...PASSING, disputeId }, { disputeId }), f.deps);
        expect(f.counts(), `${mode} ${disputeId}`).toEqual({ live: 0, simulated: 0, reads: 0, loads: 0 });
        expect(outcome).toMatchObject({ ok: false, failure: 'blocked' });
      }
    }
  });

  it('(바) 승인 없음 → 호출 0회, executeMove의 문장 그대로', async () => {
    const f = fakes({ mode: 'live' });
    const outcome = await sendReply(sendInput(PASSING, { approved: false }), f.deps);
    expect(f.counts().live).toBe(0);
    expect(outcome).toMatchObject({ ok: false, failure: 'rejected' });
    if (!outcome.ok) {
      expect(outcome.error).toMatch(/not been approved/);
      expect(outcome.nextAction).toMatch(/approve/);
    }
  });

  it('실제 호출기를 만들 수 없으면 호출 0회로 거부', async () => {
    const f = fakes({ mode: 'live' });
    const outcome = await sendReply(sendInput(PASSING), { ...f.deps, liveCall: null });
    expect(outcome).toMatchObject({ ok: false, failure: 'blocked' });
    expect(f.counts().simulated).toBe(0);
  });
});

// ── AC18 11번 + 실패 화면 네 가지 ──────────────────────────────────────

describe('AC18 11번 / 실패 화면 네 가지 (가짜 호출기)', () => {
  const view = (outcome: Awaited<ReturnType<typeof sendReply>>) =>
    buildReplyView({
      draft: { ok: true, buyerMessageEn: '', coaching: COACHING, draftEn: DRAFT_EN, outsidePolicy: [] },
      translation: null,
      facts: FACTS,
      buyerLocale: 'ko',
      plan: null,
      offerFirst: false,
      mode: outcome.mode,
      draftSource: 'ai',
      confirmed: [],
      sendState: outcome.ok ? 'done' : 'failed',
      outcome,
      riskAfterReply: { score: 3, band: 'Watch', parts: [] },
    });

  it('① 승인·토큰 검사 실패 (호출 전 거부) → executeMove의 error·nextAction 그대로', async () => {
    const f = fakes({ mode: 'live' });
    const outcome = await sendReply(sendInput(PASSING, { approved: false }), f.deps);
    const v = view(outcome);
    expect(v.result).toMatchObject({ kind: 'failed', failure: 'rejected', nothingSent: false });
    expect(v.canRetry).toBe(true);
    expect(v.riskAfterReply).toBeNull();
    expect(canSend(v).ok).toBe(false);
  });

  it('② PayPal이 422 → 상태 코드 + "nothing was sent" + 같은 요청 번호 안내', async () => {
    const f = fakes({ mode: 'live', liveStatus: 422 });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    expect(f.counts().live).toBe(1);
    const v = view(outcome);
    expect(v.result).toMatchObject({ kind: 'failed', failure: 'paypal_error', nothingSent: true });
    if (v.result?.kind === 'failed') {
      expect(v.result.error).toContain('422');
      expect(v.result.nextAction).toMatch(/will not send twice/);
    }
    expect(v.riskAfterReply).toBeNull();
    expect(canSend(v).ok).toBe(false);
  });

  it('PayPal이 500이어도 같은 꼴이다 (보냄으로 표시하지 않는다)', async () => {
    const f = fakes({ mode: 'live', liveStatus: 500 });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    expect(outcome).toMatchObject({ ok: false, failure: 'paypal_error' });
  });

  it('③ 호출이 예외로 끝남 → 다시 시도 안내', async () => {
    const f = fakes({ mode: 'live', liveStatus: 'throw' });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    const v = view(outcome);
    expect(v.result).toMatchObject({ kind: 'failed', failure: 'network' });
    if (v.result?.kind === 'failed') expect(v.result.nextAction).toMatch(/again/);
    expect(v.riskAfterReply).toBeNull();
    expect(canSend(v).ok).toBe(false);
  });

  it('④ 이미 답장한 분쟁 → "already replied" + PayPal에서 확인하라는 안내', async () => {
    const f = fakes({ mode: 'live', sellerReplied: true });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    const v = view(outcome);
    expect(v.result).toMatchObject({ kind: 'failed', failure: 'already_replied' });
    if (v.result?.kind === 'failed') expect(v.result.nextAction).toMatch(/PayPal sandbox dispute screen/);
    expect(v.canRetry).toBe(true);
  });

  it('실패 뒤 실패 상태가 그대로면 버튼은 꺼져 있다. [Try again](= idle) 뒤에만 다시 켜질 수 있다', async () => {
    const f = fakes({ mode: 'live', liveStatus: 422 });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    const base = {
      draft: { ok: true as const, buyerMessageEn: '', coaching: COACHING, draftEn: DRAFT_EN, outsidePolicy: [] },
      translation: (await prepare(DRAFT_EN, OUTGOING)).translation,
      facts: FACTS,
      buyerLocale: 'ko' as const,
      plan: planMove(D2_AFTER, recommend(D2_AFTER, P, R).best!, P, R),
      offerFirst: false,
      mode: 'live' as const,
      draftSource: 'ai' as const,
      confirmed: [],
      riskAfterReply: null,
    };
    expect(canSend(buildReplyView({ ...base, sendState: 'failed', outcome }))).toEqual({
      ok: false,
      reasonKey: 'case.send.blocked.failed',
    });
    expect(canSend(buildReplyView({ ...base, sendState: 'idle', outcome: null })).ok).toBe(true);
  });

  it('성공(실제)이면 결과에 PayPal sandbox용 값과 답장 후 위험이 있다', async () => {
    const f = fakes({ mode: 'live' });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    const v = view(outcome);
    expect(v.result).toEqual({ kind: 'sent', endpoint: 'send-message', status: 200, disputeId: ID });
    expect(v.riskAfterReply).toEqual({ score: 3, band: 'Watch', parts: [] });
    expect(v.canReset).toBe(false); // 실제 전송에는 [Reset]이 없다
  });
});

// ── AC18 7번: 검사 실패는 서버에서도 호출 0회 ────────────────────────────

describe('AC18 7번: 전송본을 바꾸면 서버 함수도 호출 0회', () => {
  const variants: [string, string][] = [
    ['(가) 날짜를 직접 씀', OUTGOING.replace('⟦DATE_1⟧', '11월 17일')],
    ['(나) 토큰을 뺌', OUTGOING.replace('⟦DATE_1⟧까지 ', '')],
    ['(다) 새 약속 표현', `${OUTGOING} 반드시 환불해 드립니다.`],
  ];

  for (const [name, outgoing] of variants) {
    it(name, async () => {
      for (const mode of ['live', 'simulated'] as const) {
        const f = fakes({ mode });
        const outcome = await sendReply(sendInput({ ...PASSING, outgoing }), f.deps);
        expect(outcome.ok, `${mode}`).toBe(false);
        expect(f.counts().live + f.counts().simulated, `${mode}`).toBe(0);
      }
    });
  }

  it('서버 검사는 checkTokens 그대로다 (화면 결과를 믿지 않는다)', () => {
    expect(checkTokens(DRAFT_EN, OUTGOING, FACTS).ok).toBe(true);
    expect(checkTokens(DRAFT_EN, variants[0][1], FACTS).literalFacts).toContain('11월 17일');
  });
});

// ── 제안이 먼저 / 답장 계획 / 사실값 ────────────────────────────────────

describe('서버가 다시 판정한다', () => {
  it('제안 추천 분쟁(지호 꼴)이면 메시지 전송을 거부한다 (가짜 전송, 호출 0회)', async () => {
    const f = fakes({ mode: 'simulated', load: loadedWith(D1_JIHO, null) });
    const outcome = await sendReply(
      sendInput({ ...PASSING, disputeId: D1_JIHO.disputeId }, { disputeId: D1_JIHO.disputeId }),
      f.deps,
    );
    expect(outcome).toMatchObject({ ok: false, failure: 'blocked' });
    if (!outcome.ok) expect(outcome.nextAction).toMatch(/Send the offer first/);
    expect(f.counts().simulated).toBe(0);
  });

  it('후 보드가 없어 추천이 환불이면 답장 계획이 없어 거부한다 (호출 0회)', async () => {
    const f = fakes({ mode: 'simulated', load: loadedWith(D2_BEFORE, null) });
    const outcome = await sendReply(sendInput(PASSING), f.deps);
    expect(outcome).toMatchObject({ ok: false, failure: 'blocked' });
    expect(f.counts().simulated).toBe(0);
  });

  it('화면을 그린 뒤 날짜가 바뀌었으면 거부한다 (다시 읽게)', async () => {
    const f = fakes({ mode: 'simulated' });
    const outcome = await sendReply(sendInput(PASSING), { ...f.deps, now: '2026-11-11T03:00:00Z' });
    expect(outcome).toMatchObject({ ok: false, failure: 'blocked' });
    expect(f.counts().simulated).toBe(0);
  });

  it('서버 기억에 답장이 없으면(다시 켬·번호 틀림) 거부한다', async () => {
    const f = fakes({ mode: 'live' });
    expect(await sendReply(sendInput(null), f.deps)).toMatchObject({ ok: false, failure: 'blocked' });
    expect(f.counts()).toEqual({ live: 0, simulated: 0, reads: 0, loads: 0 });
  });

  it('PayPal을 읽지 못하면 호출 0회', async () => {
    const f = fakes({ mode: 'live', load: { disputes: [], paypal: { ok: false, reason: 'request_failed' }, llm: { ok: true } } });
    expect(await sendReply(sendInput(PASSING), f.deps)).toMatchObject({ ok: false, failure: 'network' });
    expect(f.counts().live).toBe(0);
  });
});

// ── 정책 밖 약속 ─────────────────────────────────────────────────────────

describe('정책 밖 약속 (SPEC v2.7 3장)', () => {
  it('AC18 대역 글("I\'ll refund you in full")은 정책 밖 약속(refund)이라 확인 전에는 호출 0회, 확인 뒤 1회', async () => {
    const { translation } = await prepare(DRAFT_EN_AC18, OUTGOING_AC18);
    const reply = preparedFrom(DRAFT_EN_AC18, translation);
    expect(reply.outsidePolicy).toEqual(['refund']);
    expect(reply.addedInTranslation).toEqual([]);

    const f = fakes({ mode: 'live' });
    expect(await sendReply(sendInput(reply), f.deps)).toMatchObject({ ok: false, failure: 'blocked' });
    expect(f.counts().live).toBe(0);
    expect(await sendReply(sendInput(reply, { confirmedCommitments: ['refund'] }), f.deps)).toMatchObject({ ok: true });
    expect(f.counts().live).toBe(1);
  });

  it('번역이 더한 약속은 확인해도 호출 0회', async () => {
    const { translation } = await prepare(DRAFT_EN, `${OUTGOING} 늦으면 전액 환불해 드릴게요.`);
    const reply = preparedFrom(DRAFT_EN, translation);
    expect(reply.addedInTranslation).toContain('refund');
    const f = fakes({ mode: 'live' });
    const outcome = await sendReply(sendInput(reply, { confirmedCommitments: ['refund'] }), f.deps);
    expect(outcome).toMatchObject({ ok: false, failure: 'blocked' });
    expect(f.counts().live).toBe(0);
  });
});

// ── 문지기 · 서버 기억 · 고정 초안 ───────────────────────────────────────

describe('guardLiveSend', () => {
  it('허용 목록에 있고 판매자 글이 없을 때만 통과', () => {
    expect(guardLiveSend({ disputeId: ID, allowList: LINKS, detail: detail() })).toEqual({ ok: true });
    expect(guardLiveSend({ disputeId: ID, allowList: LINKS, detail: detail([{ posted_by: 'seller', content: 'x' }]) })).toEqual({
      ok: false,
      reason: 'already_replied',
    });
    expect(guardLiveSend({ disputeId: 'PP-R-TEST-PRACTICE', allowList: LINKS, detail: detail([], 'PP-R-TEST-PRACTICE') })).toEqual({
      ok: false,
      reason: 'not_allowed',
    });
    expect(guardLiveSend({ disputeId: ID, allowList: LINKS, detail: detail([], 'PP-R-OTHER') })).toEqual({
      ok: false,
      reason: 'wrong_dispute',
    });
  });

  it('실제 연결 표: 연습용·옛 서연 분쟁은 통과하지 못한다', async () => {
    const { demoLinks } = await import('@/app/_shared/demo-links');
    for (const link of demoLinks.filter((l) => !l.showOnScreen)) {
      expect(
        guardLiveSend({ disputeId: link.paypalDisputeId, allowList: demoLinks, detail: detail([], link.paypalDisputeId) }).ok,
      ).toBe(false);
    }
  });
});

describe('서버 기억 (rememberReply / recallReply)', () => {
  it('같은 답장 = 같은 번호, 다른 글 = 다른 번호, 꼴은 r- + 32자', () => {
    const id = rememberReply(PASSING);
    expect(id).toMatch(/^r-[0-9a-f]{32}$/);
    expect(rememberReply({ ...PASSING })).toBe(id);
    expect(preparedReplyId({ ...PASSING, outgoing: `${PASSING.outgoing} ` })).not.toBe(id);
    expect(recallReply(id)).toEqual(PASSING);
    expect(recallReply('r-0000')).toBeNull();
  });
});

describe('고정 초안도 같은 검사를 받는다', () => {
  it('토큰이 맞으면 sendable, 직접 쓴 날짜면 sendable이 아니다. LLM은 부르지 않는다', async () => {
    const ok = await fixedTranslation(
      { coaching: COACHING, draftEn: DRAFT_EN, outgoing: OUTGOING, backTranslationEn: 'x' },
      { facts: FACTS, buyerLocale: 'ko', move: 'fight' },
    );
    expect(ok).toMatchObject({ ok: true, sendable: true, outsidePolicy: [], addedInTranslation: [] });
    const bad = await fixedTranslation(
      { coaching: COACHING, draftEn: DRAFT_EN, outgoing: OUTGOING.replace('⟦DATE_1⟧', '11월 17일'), backTranslationEn: 'x' },
      { facts: FACTS, buyerLocale: 'ko', move: 'fight' },
    );
    expect(bad).toMatchObject({ ok: true, sendable: false });
  });
});
