/**
 * T070 공개 데모 모드 — PayPal 쓰기 막기 (가짜 호출기만).
 *
 * 기대값 출처: `tasks/T070.md` "가장 중요한 규칙" 1·2, "만들 것" 1·2, 완료 기준 1~3.
 *
 * **실제 호출 없음.** PayPal은 `fetch`를 바꿔 끼운 가짜(요청을 모두 센다), LLM은 정해 둔 답을 내는 가짜다.
 * `.env`를 읽지 않는다. 환경 변수는 `vi.stubEnv`로 시험 안에서만 넣는다 (값은 가짜 글자).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadedDispute } from '@/app/_shared/dispute-view';
import type { LoadDemoDisputesResult } from '@/app/_server/disputes';
import { OFFER_STATUS } from '@/app/cases/reply-model';
import { registerTrackers } from '@/paypal/track';
import { readTrackOrders } from '@/paypal/track-orders';
import type { BoardState, Cause, ClientDeps, LlmCaller } from '@/types';

import { seedBuyers } from '../../seed/index';
import { D1_JIHO } from '../acceptance/boards';

// ── 가짜들 ─────────────────────────────────────────────────────────────

let llmAnswers: unknown[] = [];
let llmCount = 0;
const fakeLlm: LlmCaller = async () => llmAnswers[Math.min(llmCount++, llmAnswers.length - 1)];

let loadedNow: LoadDemoDisputesResult = { disputes: [], paypal: { ok: false }, llm: { ok: false } };

vi.mock('server-only', () => ({}));
vi.mock('@/app/_server/disputes', () => ({
  loadDemoDisputesForRequest: async () => loadedNow,
  loadDemoDisputes: async () => loadedNow,
}));
vi.mock('@/app/_server/llm', () => ({ getLlm: () => ({ ok: true, llm: fakeLlm }), unavailableLlm: () => fakeLlm }));

const { resolveDemoMode } = await import('@/app/_server/mode');
const { resolveSendMode } = await import('@/app/_server/send');
const { getPayPalClient, SIMULATED_WRITE } = await import('@/app/_server/paypal');
const { registerTrackingFromScreen } = await import('@/app/_server/tracking-register');

const ROOT = path.resolve(__dirname, '../..');
const TRACK_ORDERS = readTrackOrders();
const UNTRACKED_ORDER_IDS = TRACK_ORDERS.orders.filter((o) => o.key === 'O05' || o.key === 'O07').map((o) => o.orderId);
const DETAIL_FIXTURE = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/dispute-detail.inquiry-waiting-seller.json'), 'utf8'));

/** 실제 연결 표의 화면 분쟁 번호 (D2 서연, D1 지호). 호출은 모두 가짜다. */
const D2_ID = 'PP-R-GMS-10197661';
const D1_ID = 'PP-R-ZOK-10200237'; // 지호 새 품질 사건 (2026-11-12 20:35, 시드 D1 = B3)

/** 가짜 자격 증명 (글자만. 실제 값이 아니다). */
const FAKE_PAYPAL = {
  PAYPAL_CLIENT_ID: 'test-client-id',
  PAYPAL_CLIENT_SECRET: 'test-client-secret',
  PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com',
};
/** 실제 전송 스위치를 **모두** 켠 상태. */
const ALL_SWITCHES_ON = {
  AFTERLOOP_REAL_SEND: '1',
  AFTERLOOP_TRACK_LIVE: '1',
  AFTERLOOP_TRACK_LIVE_ORDERS: 'O05,O07',
  AFTERLOOP_TRACK_RECORDING: '1',
};

type Seen = { method: string; path: string };

/**
 * PayPal 샌드박스 자리에 끼우는 가짜 `fetch`. 모든 요청을 센다.
 * 토큰 → 가짜 토큰, 분쟁 상세 → 고정 글(번호만 바꿈, 판매자 글 없음), 주문 상세 → 미등록 주문, 쓰기 → 200/201.
 */
function fakePayPalFetch() {
  const seen: Seen[] = [];
  const fetchFake = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    seen.push({ method, path: url.pathname });
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v1/oauth2/token') return json(200, { access_token: 'fake-token', expires_in: 32400, token_type: 'Bearer' });
    const dispute = url.pathname.match(/^\/v1\/customer\/disputes\/([^/]+)$/);
    if (method === 'GET' && dispute !== null) return json(200, { ...DETAIL_FIXTURE, dispute_id: decodeURIComponent(dispute[1]) });
    const order = url.pathname.match(/^\/v2\/checkout\/orders\/([^/]+)$/);
    if (method === 'GET' && order !== null) {
      const id = decodeURIComponent(order[1]);
      // O05·O07만 미등록, 나머지는 이미 추적이 붙어 있다 (T067 시험과 같은 상태)
      const trackers = UNTRACKED_ORDER_IDS.includes(id) ? [] : [{ status: 'SHIPPED' }];
      return json(200, { id, purchase_units: [{ shipping: { trackers }, payments: { captures: [{ id: `CAP-${id}` }] } }] });
    }
    if (method === 'POST') return json(url.pathname.endsWith('/track') ? 201 : 200, { id: 'fake' });
    return json(404, { name: 'RESOURCE_NOT_FOUND' });
  }) as typeof fetch;
  /** 토큰 발급을 뺀 쓰기 (POST/PATCH/PUT/DELETE). */
  const writes = () => seen.filter((s) => s.method !== 'GET' && s.path !== '/v1/oauth2/token');
  const reads = () => seen.filter((s) => s.method === 'GET');
  return { fetchFake, seen, writes, reads };
}

const fakeDeps = (fetchFake: typeof fetch): ClientDeps => ({ fetch: fetchFake, now: () => Date.now(), sleep: async () => {} });

// ── 공용 입력 (app-case-reply-retry와 같은 꼴) ───────────────────────────

const ruleCause = (subtype: Cause['subtype'], causeNote?: string): Cause => ({
  subtype,
  confidence: 1,
  evidence: [],
  needsReview: false,
  source: 'rule',
  ...(causeNote === undefined ? {} : { causeNote }),
});
const inTwentyDays = new Date(Date.now() + 20 * 24 * 3_600_000).toISOString();
const D2_BASE: Omit<BoardState, 'hasTracking' | 'hasDeliveredTracking' | 'cause'> = {
  disputeId: D2_ID,
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: inTwentyDays,
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
  isDemo: true,
  hasDeliveredTracking: false,
  cause: ruleCause('A2', 'Customs hold – recipient customs ID missing'),
};
/**
 * 제안(make-offer) 경로를 지키는 보드: 원인을 **B1(색상)**으로 시험 안에서 고정한다.
 * 시드 D1은 2026-11-12 20:35부터 B3(품질 → repair·send-message)이지만, 제안 관문 검사는 그대로 둔다.
 */
const JIHO: BoardState = { ...D1_JIHO, disputeId: D1_ID, dueDate: inTwentyDays, cause: ruleCause('B1') };
/** 지금 시드의 지호 (B3 품질) — repair 추천, send-message로 보낸다. */
const JIHO_B3: BoardState = { ...JIHO, cause: ruleCause('B3') };

function loaded(board: BoardState, demo: BoardState | null, buyerId: string): LoadedDispute {
  const buyer = seedBuyers.find((b) => b.id === buyerId);
  if (buyer === undefined) throw new Error(`seed buyer ${buyerId}`);
  return {
    key: buyerId,
    disputeId: board.disputeId,
    statusCode: OFFER_STATUS,
    buyer,
    product: null,
    buyerMessages: ['배송이 안 와요'],
    boardReal: board,
    boardDemo: demo,
    demoFields: demo === null ? [] : ['hasTracking', 'cause'],
    carrierEvents: [],
    signals: null,
    signalsAfterReply: null,
    liveSendAllowed: true,
  };
}
const result = (...disputes: LoadedDispute[]): LoadDemoDisputesResult => ({ disputes, paypal: { ok: true }, llm: { ok: true } });

const COACHING = ['Say sorry for the wait first.', 'Explain the customs hold in one line.', 'Ask for the customs code.'];
const SEOYEON_DRAFT = 'Hello ⟦BUYER_NAME_1⟧, sorry for the wait. I will check with the carrier and get back to you by ⟦DATE_1⟧.\n\n⟦SELLER_NAME_1⟧';
const SEOYEON_OUT = '안녕하세요 ⟦BUYER_NAME_1⟧, 기다리게 해서 죄송해요. ⟦DATE_1⟧까지 운송사에 확인해서 다시 연락드릴게요.\n\n⟦SELLER_NAME_1⟧';
const SEOYEON_BACK = 'Hello ⟦BUYER_NAME_1⟧, sorry for the wait. I will contact you again by ⟦DATE_1⟧.\n\n⟦SELLER_NAME_1⟧';
const JIHO_DRAFT = 'Hello ⟦BUYER_NAME_1⟧, I am sorry the color looks different. I can offer {{offerAmount}} back. I will check again by ⟦DATE_1⟧.\n\n⟦SELLER_NAME_1⟧';
const JIHO_OUT = '안녕하세요 ⟦BUYER_NAME_1⟧, 색이 달라 보여 죄송해요. {{offerAmount}}을 돌려드리는 제안을 드려요. ⟦DATE_1⟧까지 다시 확인할게요.\n\n⟦SELLER_NAME_1⟧';
const JIHO_BACK = 'Hello ⟦BUYER_NAME_1⟧, I offer {{offerAmount}}.\n\n⟦SELLER_NAME_1⟧';

function answer(draftEn: string, outgoing: string, back: string) {
  llmCount = 0;
  llmAnswers = [{ buyer_message_en: 'It has not arrived.', coaching: COACHING, draft_en: draftEn }, { outgoing }, { back_translation_en: back }];
}

/** 화면과 같은 길: 답장 칸을 그려(서버 기억에 답장을 둔다) → 서버 액션이 부르는 `sendFromScreen`. */
async function pressSend(disputeId: string, kind: 'message' | 'offer') {
  vi.resetModules();
  const { loadReply } = await import('@/app/cases/reply/load');
  const { sendFromScreen } = await import('@/app/_server/send');
  const reply = await loadReply(disputeId);
  expect(reply?.replyId ?? null, 'reply prepared').not.toBeNull();
  return sendFromScreen({ disputeId, kind, replyId: reply!.replyId!, confirmedCommitments: [] });
}

const seoyeon = () => {
  loadedNow = result(loaded(D2_BEFORE, D2_AFTER, 'B01'));
  answer(SEOYEON_DRAFT, SEOYEON_OUT, SEOYEON_BACK);
};
const jiho = () => {
  loadedNow = result(loaded(JIHO, null, 'B02'));
  answer(JIHO_DRAFT, JIHO_OUT, JIHO_BACK);
};
/** 지금 시드의 지호 (B3 품질 → repair, send-message). 금액·약속 없는 수선 안내 (⟦DAYS_1⟧은 코드가 채운다). */
const JIHO_REPAIR_DRAFT = 'Hello ⟦BUYER_NAME_1⟧, I am sorry the sleeve unraveled. I can repair it; it takes about ⟦DAYS_1⟧.\n\n⟦SELLER_NAME_1⟧';
const JIHO_REPAIR_OUT = '안녕하세요 ⟦BUYER_NAME_1⟧, 올이 풀려 죄송해요. 수선해 드릴게요. ⟦DAYS_1⟧ 정도 걸려요.\n\n⟦SELLER_NAME_1⟧';
const JIHO_REPAIR_BACK = 'Hello ⟦BUYER_NAME_1⟧, sorry the sleeve unraveled. I will repair it. It takes about ⟦DAYS_1⟧.\n\n⟦SELLER_NAME_1⟧';
const jihoB3 = () => {
  loadedNow = result(loaded(JIHO_B3, null, 'B02'));
  answer(JIHO_REPAIR_DRAFT, JIHO_REPAIR_OUT, JIHO_REPAIR_BACK);
};

let paypal: ReturnType<typeof fakePayPalFetch>;

beforeEach(() => {
  vi.unstubAllEnvs();
  // 시험 환경에 있을지 모르는 값을 지운다 (없는 것과 같게)
  for (const key of ['DEMO_MODE', ...Object.keys(ALL_SWITCHES_ON), ...Object.keys(FAKE_PAYPAL)]) vi.stubEnv(key, undefined);
  paypal = fakePayPalFetch();
  vi.stubGlobal('fetch', paypal.fetchFake);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const stubEnv = (env: Record<string, string>) => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
};

// ── 1. 모드 ───────────────────────────────────────────────────────────

describe('T070 1: resolveDemoMode — 정확히 "recording"만 recording', () => {
  it('없음·빈 값·public·오타·대문자·공백은 전부 public', () => {
    for (const value of [undefined, '', ' ', 'public', 'Recording', 'RECORDING', ' recording', 'recording ', 'record', 'recordings', '1', 'true']) {
      expect(resolveDemoMode({ DEMO_MODE: value }), String(value)).toBe('public');
    }
    expect(resolveDemoMode({})).toBe('public');
    expect(resolveDemoMode({ DEMO_MODE: 'recording' })).toBe('recording');
  });

  it('process.env에 없으면 public (공개 배포 기본)', () => {
    expect(resolveDemoMode()).toBe('public');
  });
});

// ── 2. 전송 모드 · PayPal 클라이언트 ─────────────────────────────────────

describe('T070 2: 모드 관문은 스위치 앞에 있다', () => {
  it('public이면 AFTERLOOP_REAL_SEND=1이어도 simulated, recording + "1"만 live', () => {
    for (const mode of [undefined, '', 'public', 'Recording', ' recording']) {
      expect(resolveSendMode({ ...ALL_SWITCHES_ON, DEMO_MODE: mode }), String(mode)).toBe('simulated');
    }
    expect(resolveSendMode({ ...ALL_SWITCHES_ON, DEMO_MODE: 'recording' })).toBe('live');
    expect(resolveSendMode({ DEMO_MODE: 'recording' })).toBe('simulated');
    expect(resolveSendMode({ DEMO_MODE: 'recording', AFTERLOOP_REAL_SEND: 'true' })).toBe('simulated');
  });

  it('public 클라이언트: call(쓰기)은 네트워크 0회 · Simulated 결과, get(읽기)은 나간다', async () => {
    const resolved = getPayPalClient({ ...FAKE_PAYPAL, ...ALL_SWITCHES_ON }, fakeDeps(paypal.fetchFake));
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const res = await resolved.client.call({ method: 'POST', path: `/v1/customer/disputes/${D1_ID}/make-offer`, body: {}, requestId: 'r-1' });
    expect(res).toEqual({ status: SIMULATED_WRITE.status, body: { simulated: true } });
    expect(paypal.seen).toHaveLength(0); // 토큰도 받지 않는다

    const read = await resolved.client.get(`/v1/customer/disputes/${D1_ID}`);
    expect(read.status).toBe(200);
    expect(paypal.reads().map((s) => s.path)).toEqual([`/v1/customer/disputes/${D1_ID}`]);
    expect(paypal.writes()).toHaveLength(0);
  });

  it('recording 클라이언트: call은 실제로(가짜 fetch까지) 나간다', async () => {
    const resolved = getPayPalClient({ ...FAKE_PAYPAL, DEMO_MODE: 'recording' }, fakeDeps(paypal.fetchFake));
    if (!resolved.ok) throw new Error('client');
    await resolved.client.call({ method: 'POST', path: `/v1/customer/disputes/${D1_ID}/make-offer`, body: {}, requestId: 'r-2' });
    expect(paypal.writes().map((s) => s.path)).toEqual([`/v1/customer/disputes/${D1_ID}/make-offer`]);
  });
});

// ── 3. 버튼을 눌렀을 때 (서버 액션과 같은 길) ─────────────────────────────

describe('T070 3: public — 스위치를 모두 켜고 눌러도 PayPal 쓰기 0회', () => {
  it('서연 보내기 → Simulated, 쓰기 0회', async () => {
    stubEnv({ ...FAKE_PAYPAL, ...ALL_SWITCHES_ON });
    seoyeon();
    const outcome = await pressSend(D2_ID, 'message');
    expect(outcome).toEqual({ ok: true, mode: 'simulated', disputeId: D2_ID });
    expect(paypal.writes()).toHaveLength(0);
  });

  it('지호 제안 → Simulated, 쓰기 0회', async () => {
    stubEnv({ ...FAKE_PAYPAL, ...ALL_SWITCHES_ON, DEMO_MODE: 'public' });
    jiho();
    const outcome = await pressSend(D1_ID, 'offer');
    expect(outcome).toEqual({ ok: true, mode: 'simulated', disputeId: D1_ID });
    expect(paypal.writes()).toHaveLength(0);
  });

  it('DEMO_MODE 오타(Recording)도 public — 쓰기 0회', async () => {
    stubEnv({ ...FAKE_PAYPAL, ...ALL_SWITCHES_ON, DEMO_MODE: 'Recording' });
    jiho();
    const outcome = await pressSend(D1_ID, 'offer');
    expect(outcome.mode).toBe('simulated');
    expect(paypal.writes()).toHaveLength(0);
  });

  it('추적 등록 → Simulated (dry run), 쓰기 0회. 조회(GET)는 나간다', async () => {
    const env = { ...FAKE_PAYPAL, ...ALL_SWITCHES_ON };
    const outcome = await registerTrackingFromScreen({ paypal: getPayPalClient(env, fakeDeps(paypal.fetchFake)), env });
    expect(outcome.kind).toBe('simulated');
    expect(paypal.writes()).toHaveLength(0);
    expect(paypal.reads().length).toBeGreaterThan(0);
  });

  it('이중 잠금: 게이트를 억지로 켜도 public 클라이언트는 PayPal로 POST하지 않는다', async () => {
    const resolved = getPayPalClient({ ...FAKE_PAYPAL }, fakeDeps(paypal.fetchFake));
    if (!resolved.ok) throw new Error('client');
    await registerTrackers(resolved.client, {
      data: TRACK_ORDERS,
      selectedKeys: ['O05', 'O07'],
      live: { enabled: true, allowedKeys: ['O05', 'O07'], recordingConfirmed: true },
    });
    expect(paypal.writes()).toHaveLength(0);
  });
});

describe('T070 3: recording — 지금과 같다', () => {
  it('스위치 켜짐 + 허용 → 지호 make-offer 1회, send-message 0회', async () => {
    stubEnv({ ...FAKE_PAYPAL, ...ALL_SWITCHES_ON, DEMO_MODE: 'recording' });
    jiho();
    const outcome = await pressSend(D1_ID, 'offer');
    expect(outcome).toMatchObject({ ok: true, mode: 'live', endpoint: 'make-offer', status: 200 });
    const writes = paypal.writes();
    expect(writes.map((w) => w.path)).toEqual([`/v1/customer/disputes/${D1_ID}/make-offer`]);
    expect(writes.some((w) => w.path.endsWith('/send-message'))).toBe(false);
  });

  it('스위치 꺼짐 → 0회 (Simulated)', async () => {
    stubEnv({ ...FAKE_PAYPAL, DEMO_MODE: 'recording' });
    jiho();
    const outcome = await pressSend(D1_ID, 'offer');
    expect(outcome).toEqual({ ok: true, mode: 'simulated', disputeId: D1_ID });
    expect(paypal.writes()).toHaveLength(0);
  });

  it('지금 시드 지호(B3 품질 → repair): 스위치 켜짐 + 허용 → send-message 1회, make-offer 0회', async () => {
    stubEnv({ ...FAKE_PAYPAL, ...ALL_SWITCHES_ON, DEMO_MODE: 'recording' });
    jihoB3();
    const outcome = await pressSend(D1_ID, 'message');
    expect(outcome).toMatchObject({ ok: true, mode: 'live', endpoint: 'send-message', status: 200 });
    const writes = paypal.writes();
    expect(writes.map((w) => w.path)).toEqual([`/v1/customer/disputes/${D1_ID}/send-message`]);
    expect(writes.some((w) => w.path.endsWith('/make-offer'))).toBe(false);
  });

  it('지금 시드 지호(B3): public이면 스위치를 켜도 Simulated, 쓰기 0회', async () => {
    stubEnv({ ...FAKE_PAYPAL, ...ALL_SWITCHES_ON, DEMO_MODE: 'public' });
    jihoB3();
    const outcome = await pressSend(D1_ID, 'message');
    expect(outcome).toEqual({ ok: true, mode: 'simulated', disputeId: D1_ID });
    expect(paypal.writes()).toHaveLength(0);
  });

  it('추적: recording + 스위치 켜짐 → O05·O07 POST, recording + 꺼짐 → 0회', async () => {
    const on = { ...FAKE_PAYPAL, ...ALL_SWITCHES_ON, DEMO_MODE: 'recording' };
    const added = await registerTrackingFromScreen({ paypal: getPayPalClient(on, fakeDeps(paypal.fetchFake)), env: on });
    expect(added.kind).toBe('added');
    expect(paypal.writes()).toHaveLength(2);
    expect(paypal.writes().every((w) => /^\/v2\/checkout\/orders\/[^/]+\/track$/.test(w.path))).toBe(true);

    const second = fakePayPalFetch();
    const off = { ...FAKE_PAYPAL, DEMO_MODE: 'recording' };
    const dry = await registerTrackingFromScreen({ paypal: getPayPalClient(off, fakeDeps(second.fetchFake)), env: off });
    expect(dry.kind).toBe('simulated');
    expect(second.writes()).toHaveLength(0);
  });
});
