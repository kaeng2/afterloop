/**
 * T122g (SPEC v2.16): 메시지 전송이 엔진 추천 repair(무료 수선 안내)도 허용한다.
 *
 * 기대값 출처: `tasks/T122g.md`. 관문(공개 모드 simulated, 약속·토큰·서버 재검사)은 그대로다.
 * 실제 PayPal·LLM 호출 없음 — 모두 횟수를 세는 가짜. `.env`를 읽지 않는다.
 */
import { describe, expect, it, vi } from 'vitest';

import { withMoveFacts } from '@/app/cases/view/load';
import { caseReplyFacts } from '@/app/cases/reply-facts';
import { recommend } from '@/engine/recommend';
import { parseDisputeDetail } from '@/paypal/disputes';
import type { ApiRequest, BoardState, DemoLink } from '@/types';

import { D1_JIHO, P, R, withSubtype } from '../acceptance/boards';

vi.mock('server-only', () => ({}));

const { sendReply } = await import('@/app/_server/send');
type PreparedReply = import('@/app/_server/send').PreparedReply;
type SendReplyDeps = import('@/app/_server/send').SendReplyDeps;
type LoadResult = Awaited<ReturnType<SendReplyDeps['load']>>;

const ID = 'PP-R-TEST-REPAIR';
const NOW = '2026-11-10T03:00:00Z';
const DUE = '2026-11-30T00:37:00Z';

const REPAIR_BOARD: BoardState = { ...withSubtype(D1_JIHO, 'B3', 1), disputeId: ID, dueDate: DUE };
const LINKS: DemoLink[] = [{ paypalDisputeId: ID, seedDisputeId: 'D1', carrierOrderId: 'O02', showOnScreen: true, liveSendAllowed: true }];

const DRAFT_EN =
  "I'm so sorry it started unraveling. If you cover the round-trip shipping, I'll do a free repair. The repair takes about ⟦DAYS_1⟧ from the day you receive it.\n\n⟦SELLER_NAME_1⟧";
const OUTGOING =
  '올이 풀려서 속상하셨겠어요. 왕복 배송비만 부담해 주시면 무료로 수선해 드릴게요. 수선은 받은 날부터 ⟦DAYS_1⟧ 정도 걸려요.\n\n⟦SELLER_NAME_1⟧';

function reply(board: BoardState, move: string): PreparedReply {
  const facts = withMoveFacts(caseReplyFacts({ now: NOW, dueDate: board.dueDate, buyerId: null, buyerLocale: 'ko' }), move).outgoing;
  return {
    disputeId: ID,
    draftSource: 'ai',
    draftEn: DRAFT_EN,
    outgoing: OUTGOING,
    outsidePolicy: [],
    addedInTranslation: [],
    nameProblems: [],
    facts,
    buyerLocale: 'ko',
  };
}

function fakes(board: BoardState) {
  const live: ApiRequest[] = [];
  const simulated: ApiRequest[] = [];
  const loaded: LoadResult = {
    disputes: [
      {
        key: 'D1',
        disputeId: ID,
        statusCode: 'WAITING_FOR_SELLER_RESPONSE',
        buyer: null,
        product: null,
        buyerMessages: [],
        boardReal: board,
        boardDemo: null,
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
  const deps: SendReplyDeps = {
    mode: 'simulated',
    load: async () => loaded,
    readDetail: async (disputeId) =>
      parseDisputeDetail({
        dispute_id: disputeId,
        reason: 'MERCHANDISE_NOT_AS_DESCRIBED',
        dispute_life_cycle_stage: 'INQUIRY',
        dispute_channel: 'INTERNAL',
        dispute_amount: { currency_code: 'USD', value: '72.00' },
        messages: [{ posted_by: 'BUYER', content: '...' }],
      }),
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

const input = (r: PreparedReply) => ({ disputeId: ID, reply: r, confirmedCommitments: [], approved: true });

describe('T122g: repair 추천 사건의 메시지 전송', () => {
  it('전제: 엔진 추천은 repair', () => {
    expect(recommend(REPAIR_BOARD, P, R).best?.move).toBe('repair');
  });

  it('공개 모드(simulated): 서버 재검사 통과, 가짜 1회, 실제 호출 0회', async () => {
    const f = fakes(REPAIR_BOARD);
    const outcome = await sendReply(input(reply(REPAIR_BOARD, 'repair')), f.deps);
    expect(outcome).toEqual({ ok: true, mode: 'simulated', disputeId: ID });
    expect(f.live).toHaveLength(0);
    expect(f.simulated).toHaveLength(1);
  });

  it('수선 기간 사실값이 빠진 답장은 서버 재검사에서 막힌다 (호출 0회)', async () => {
    const f = fakes(REPAIR_BOARD);
    const outcome = await sendReply(input(reply(REPAIR_BOARD, 'fight')), f.deps);
    expect(outcome.ok).toBe(false);
    expect(f.live.length + f.simulated.length).toBe(0);
  });

  it('fight 추천 사건은 결과 무변경 (기간 사실값 없이 통과, repair 값이면 막힘)', async () => {
    const fightBoard: BoardState = { ...withSubtype(D1_JIHO, 'A2', 1), disputeId: ID, dueDate: DUE };
    const best = recommend(fightBoard, P, R).best;
    expect(best?.move).not.toBe('repair');
    const f = fakes(fightBoard);
    const bad = await sendReply(input(reply(fightBoard, 'repair')), f.deps);
    expect(bad.ok).toBe(false);
    expect(f.live.length + f.simulated.length).toBe(0);
  });
});
