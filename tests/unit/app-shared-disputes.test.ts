/**
 * T047 단위 테스트 2/2: 실제 분쟁 읽기 (`src/app/_server/disputes.ts`).
 *
 * 기대값 출처: `tasks/T047.md` "완료 기준" + AC19 초안 1·9·10·11번, SPEC v2.6 9-4·9-5·10장.
 * **실호출 0회.** PayPal 클라이언트는 `get`·`call` 횟수를 세는 가짜, LLM은 넣은 답만 주는 가짜다.
 */
import { describe, expect, it } from 'vitest';

import { getLlm, unavailableLlm } from '@/app/_server/llm';
import { loadDemoDisputes } from '@/app/_server/disputes';
import { getPayPalClient } from '@/app/_server/paypal';
import { pickBoard } from '@/app/_shared/dispute-view';
import type { DemoLink, LlmCaller, PayPalClient } from '@/types';

// ── 연결 표 (라이브 설정과 같은 번호. 시험은 이 사본만 쓴다) ──────────────────

const D1 = 'PP-R-MBJ-10197650';
const D2 = 'PP-R-GMS-10197661';
const D3 = 'PP-R-FYT-10197651';
const OLD_SEOYEON = 'PP-R-GAH-10197649';
const PRACTICE = 'PP-R-HEY-10197767';

const LINKS: DemoLink[] = [
  { paypalDisputeId: D1, seedDisputeId: 'D1', carrierOrderId: 'O02', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: D2, seedDisputeId: 'D2', carrierOrderId: 'O01', showOnScreen: true, liveSendAllowed: true },
  { paypalDisputeId: D3, seedDisputeId: 'D3', carrierOrderId: 'O08', showOnScreen: true, liveSendAllowed: false },
  { paypalDisputeId: OLD_SEOYEON, seedDisputeId: null, carrierOrderId: null, showOnScreen: false, liveSendAllowed: false },
  { paypalDisputeId: PRACTICE, seedDisputeId: null, carrierOrderId: null, showOnScreen: false, liveSendAllowed: true },
];

// ── 가짜 분쟁 응답 ───────────────────────────────────────────────────────────

const INR = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
const SNAD = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';

const SEOYEON_PAYER = 'PAYERSEOYEON01';
const JIHO_PAYER = 'PAYERJIHO00001';
const BUYER_M_PAYER = 'PAYERBUYERM001';

type Detail = Record<string, unknown>;

type MakeDetail = {
  id: string;
  reason: string;
  payerId: string;
  status?: string;
  stage?: string;
  due?: string;
  amount?: string;
  moves?: string[];
  buyerText?: { text: string; at: string };
  sellerReplyAt?: string;
};

function makeDetail(spec: MakeDetail): Detail {
  return {
    dispute_id: spec.id,
    reason: spec.reason,
    status: spec.status ?? 'WAITING_FOR_SELLER_RESPONSE',
    dispute_state: 'REQUIRED_ACTION',
    dispute_life_cycle_stage: spec.stage ?? 'INQUIRY',
    dispute_channel: 'INTERNAL',
    dispute_amount: { currency_code: 'USD', value: spec.amount ?? '74.00' },
    ...(spec.due === undefined ? {} : { seller_response_due_date: spec.due }),
    disputed_transactions: [
      {
        buyer_transaction_id: 'BUYERTXN000000001',
        // 이름·이메일이 응답에 섞여 있어도 돌려주는 값에는 들어가지 않아야 한다
        buyer: { payer_id: spec.payerId, email: 'buyer@example.com', name: 'Test Buyer' },
      },
    ],
    links: (spec.moves ?? ['send_message', 'make_offer', 'accept_claim']).map((rel) => ({
      rel,
      href: `https://api-m.sandbox.paypal.com/v1/customer/disputes/${spec.id}`,
      method: 'POST',
    })),
    messages: [
      ...(spec.buyerText === undefined
        ? []
        : [{ posted_by: 'BUYER', content: spec.buyerText.text, time_posted: spec.buyerText.at }]),
      ...(spec.sellerReplyAt === undefined
        ? []
        : [{ posted_by: 'SELLER', content: 'Checking now.', time_posted: spec.sellerReplyAt }]),
    ],
    evidences: [],
  };
}

const DUE = '2026-11-30T00:37:00.000Z';
const NOW = '2026-11-10T17:00:00.000Z';

const DETAILS: Record<string, Detail> = {
  [D1]: makeDetail({ id: D1, reason: SNAD, payerId: JIHO_PAYER, due: DUE, amount: '48.00' }),
  [D2]: makeDetail({
    id: D2,
    reason: INR,
    payerId: SEOYEON_PAYER,
    due: DUE,
    amount: '74.00',
    buyerText: { text: 'It still has not arrived. My customs ID is P123456789012.', at: '2026-11-09T02:00:00.000Z' },
  }),
  [D3]: makeDetail({
    id: D3,
    reason: INR,
    payerId: BUYER_M_PAYER,
    status: 'UNDER_REVIEW',
    stage: 'CHARGEBACK',
    amount: '37.00',
    moves: ['accept_claim'],
  }),
  [OLD_SEOYEON]: makeDetail({ id: OLD_SEOYEON, reason: INR, payerId: SEOYEON_PAYER, due: DUE }),
  [PRACTICE]: makeDetail({ id: PRACTICE, reason: SNAD, payerId: 'PAYERYUKI00001', due: DUE }),
};

/** 목록 항목은 상세와 같은 공통 필드를 쓴다 (`messages`·`evidences`만 없다). */
function summaryOf(id: string): Detail {
  return Object.fromEntries(
    Object.entries(DETAILS[id]).filter(([key]) => key !== 'messages' && key !== 'evidences'),
  );
}

type FakeClient = PayPalClient & { getPaths: string[]; callCount: number };

/** `get`만 답하는 가짜 클라이언트. `call`(POST)이 불리면 그 자리에서 시험이 깨진다. */
function fakeClient(listIds: string[], detailIds: string[] = Object.keys(DETAILS)): FakeClient {
  const getPaths: string[] = [];
  const client: FakeClient = {
    getPaths,
    callCount: 0,
    call: async () => {
      client.callCount += 1;
      throw new Error('이 작업은 PayPal에 POST를 보내지 않는다');
    },
    get: async (path: string) => {
      getPaths.push(path);
      if (path.startsWith('/v1/customer/disputes?')) {
        return { status: 200, body: { items: listIds.map(summaryOf), links: [] } };
      }
      const id = path.slice('/v1/customer/disputes/'.length);
      if (detailIds.includes(id)) return { status: 200, body: DETAILS[id] };
      return { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } };
    },
  };
  return client;
}

/** 늘 실패하는 LLM (호출 횟수를 센다). 분류는 규칙으로만, 어조는 판정 보류가 된다. */
function countingLlm(): LlmCaller & { calls: number } {
  const llm = (async () => {
    llm.calls += 1;
    throw new Error('LLM unavailable in unit test');
  }) as unknown as LlmCaller & { calls: number };
  llm.calls = 0;
  return llm;
}

const load = (client: PayPalClient, llm: LlmCaller, links: DemoLink[] = LINKS) =>
  loadDemoDisputes({ client, llm, links, now: NOW });

// ───────────────────────────── 시험 ─────────────────────────────

describe('T047 loadDemoDisputes: 조회만 한다 (AC19 초안 9번)', () => {
  it('POST는 0회이고 `get`만 불린다', async () => {
    const client = fakeClient([D1, D2, D3, OLD_SEOYEON, PRACTICE]);
    await load(client, countingLlm());
    expect(client.callCount).toBe(0);
    expect(client.getPaths.length).toBeGreaterThan(0);
  });

  it('연습용·시연 제외 분쟁은 결과에 없고 그 상세를 읽지도 않는다', async () => {
    const client = fakeClient([D1, D2, D3, OLD_SEOYEON, PRACTICE]);
    const { disputes } = await load(client, countingLlm());

    expect(disputes.map((d) => d.key)).toEqual(['D1', 'D2', 'D3']);
    expect(disputes.map((d) => d.disputeId)).toEqual([D1, D2, D3]);
    for (const excluded of [OLD_SEOYEON, PRACTICE]) {
      expect(client.getPaths.some((path) => path.includes(excluded)), excluded).toBe(false);
    }
  });

  it('표에 없는 분쟁은 화면에 내지 않는다', async () => {
    const client = fakeClient([D1, D2, D3, OLD_SEOYEON, PRACTICE]);
    const onlyD2 = LINKS.filter((link) => link.paypalDisputeId === D2);
    const { disputes } = await load(client, countingLlm(), onlyD2);
    expect(disputes.map((d) => d.disputeId)).toEqual([D2]);
  });
});

describe('T047 loadDemoDisputes: 목록에 없는 분쟁 (AC19 초안 10번)', () => {
  it('목록에 D2가 없어도 번호로 직접 읽어 결과에 넣는다', async () => {
    const client = fakeClient([D1, D3]); // 목록에는 D2가 없다 (방금 접수된 분쟁, SPEC 9-4)
    const { disputes, paypal } = await load(client, countingLlm());
    expect(paypal.ok).toBe(true);
    expect(disputes.map((d) => d.disputeId)).toEqual([D1, D2, D3]);
    expect(client.getPaths.filter((path) => path.endsWith(D2))).toHaveLength(1);
  });

  it('한 건을 읽지 못해도 나머지는 보여 준다', async () => {
    const client = fakeClient([D1, D2, D3], [D1, D3]); // D2 상세가 404
    const { disputes, paypal } = await load(client, countingLlm());
    expect(disputes.map((d) => d.disputeId)).toEqual([D1, D3]);
    expect(paypal.ok).toBe(true);
    expect(paypal.reason).toMatch(/could not be read/);
  });
});

describe('T047 loadDemoDisputes: 이전 미수령 분쟁 수 (AC19 초안 11번)', () => {
  it('서연의 이전 미수령 분쟁 수가 0이다 (시연 제외 분쟁을 세지 않는다)', async () => {
    // 목록에 서연의 미수령 분쟁이 2건 (D2 + 옛 분쟁). 걸러 내지 않으면 1로 나온다
    const client = fakeClient([D1, D2, D3, OLD_SEOYEON]);
    const { disputes } = await load(client, countingLlm());
    const seoyeon = disputes.find((d) => d.key === 'D2');
    expect(seoyeon?.boardReal.buyerPriorInrDisputes).toBe(0);
    expect(seoyeon?.boardDemo?.buyerPriorInrDisputes).toBe(0);
  });
});

describe('T047 loadDemoDisputes: 실제 보드와 시연용 보드', () => {
  it('서연: 실제는 추적 없음(A1), 시연용은 통관 보류(A2)다', async () => {
    const client = fakeClient([D1, D2, D3]);
    const { disputes } = await load(client, countingLlm());
    const seoyeon = disputes.find((d) => d.key === 'D2');

    expect(seoyeon?.boardReal.hasTracking).toBe(false);
    expect(seoyeon?.boardReal.isDemo).toBe(false);
    expect(seoyeon?.boardReal.cause?.subtype).toBe('A1');

    expect(seoyeon?.boardDemo?.hasTracking).toBe(true);
    expect(seoyeon?.boardDemo?.isDemo).toBe(true);
    expect(seoyeon?.boardDemo?.cause?.subtype).toBe('A2');
    expect(seoyeon?.demoFields).toContain('carrierEvents');
    expect(seoyeon?.demoFields).toContain('hasTracking');
    expect(seoyeon?.demoFields).toContain('cause');
    expect(seoyeon?.carrierEvents.some((event) => event.status === 'customs_hold')).toBe(true);
    expect(pickBoard(seoyeon!)).toBe(seoyeon!.boardDemo);
  });

  it('buyer_m: 시연용 보드에 이전 미수령 2건 + 배송 완료가 들어가 F1이 된다', async () => {
    const client = fakeClient([D1, D2, D3]);
    const { disputes } = await load(client, countingLlm());
    const mike = disputes.find((d) => d.key === 'D3');

    expect(mike?.boardReal.buyerPriorInrDisputes).toBe(0);
    expect(mike?.boardReal.hasDeliveredTracking).toBe(false);
    expect(mike?.boardDemo?.buyerPriorInrDisputes).toBe(2);
    expect(mike?.boardDemo?.hasDeliveredTracking).toBe(true);
    expect(mike?.boardDemo?.cause?.subtype).toBe('F1');
    expect(mike?.demoFields).toContain('buyerPriorInrDisputes');
    expect(mike?.demoFields).toContain('hasDeliveredTracking');
  });

  it('지호: 덧씌울 배송사 정보·이전 분쟁이 없어 시연용 보드가 null이다', async () => {
    const client = fakeClient([D1, D2, D3]);
    const { disputes } = await load(client, countingLlm());
    const jiho = disputes.find((d) => d.key === 'D1');

    expect(jiho?.carrierEvents).toEqual([]); // O02에는 배송사 이벤트가 없다
    expect(jiho?.boardDemo).toBeNull();
    expect(jiho?.demoFields).not.toContain('hasTracking');
    expect(jiho?.demoFields).not.toContain('buyerPriorInrDisputes');
    expect(pickBoard(jiho!)).toBe(jiho!.boardReal);
  });

  it('상태 코드와 허용된 수를 PayPal 응답에서 옮긴다 (기한이 없으면 빈 문자열)', async () => {
    const client = fakeClient([D1, D2, D3]);
    const { disputes } = await load(client, countingLlm());
    const mike = disputes.find((d) => d.key === 'D3');

    expect(mike?.statusCode).toBe('UNDER_REVIEW');
    expect(mike?.boardReal.stage).toBe('CHARGEBACK');
    expect(mike?.boardReal.allowedMoves).toEqual(['accept_claim']);
    expect(mike?.boardReal.dueDate).toBe(''); // 날짜를 만들지 않는다
    expect(disputes.find((d) => d.key === 'D2')?.statusCode).toBe('WAITING_FOR_SELLER_RESPONSE');
  });

  it('연결 표의 구매자·상품·전송 허용을 함께 담는다', async () => {
    const client = fakeClient([D1, D2, D3]);
    const { disputes } = await load(client, countingLlm());

    expect(disputes.find((d) => d.key === 'D2')?.buyer?.id).toBe('B01');
    expect(disputes.find((d) => d.key === 'D2')?.product?.sku).toBe('FK-SW-NV');
    expect(disputes.map((d) => d.liveSendAllowed)).toEqual([true, true, false]);
  });
});

describe('T047 loadDemoDisputes: 개인정보 (SPEC 10장)', () => {
  it('구매자 이메일·이름·payer_id·응답 원문이 결과에 없다', async () => {
    const client = fakeClient([D1, D2, D3]);
    const { disputes } = await load(client, countingLlm());
    const dumped = JSON.stringify(disputes);

    for (const secret of ['buyer@example.com', 'Test Buyer', SEOYEON_PAYER, JIHO_PAYER, BUYER_M_PAYER]) {
      expect(dumped.includes(secret), secret).toBe(false);
    }
  });

  it('구매자 글은 개인통관고유부호를 가린 뒤에 담는다', async () => {
    const client = fakeClient([D1, D2, D3]);
    const { disputes } = await load(client, countingLlm());
    const messages = disputes.find((d) => d.key === 'D2')?.buyerMessages ?? [];

    expect(messages.length).toBe(1);
    expect(messages[0]).not.toContain('P123456789012');
    expect(messages[0]).toContain('⟦PCCC⟧');
  });
});

describe('T047 loadDemoDisputes: 확대 위험 신호', () => {
  it('신호 두 벌을 만들고, 답장 뒤에는 무응답 신호가 사라진다 (SPEC 7장)', async () => {
    const client = fakeClient([D1, D2, D3]);
    const { disputes } = await load(client, countingLlm());
    const seoyeon = disputes.find((d) => d.key === 'D2');

    expect(seoyeon?.signals?.mentionsCardCompany).toBe(true); // 11/09 문의의 카드사 언급 (시연용 데이터)
    expect(seoyeon?.signals?.unansweredOver24h).toBe(true);
    expect(seoyeon?.signals?.secondMessageUnanswered).toBe(true);
    expect(seoyeon?.demoFields).toContain('earlierInquiries');

    expect(seoyeon?.signalsAfterReply?.mentionsCardCompany).toBe(true); // 언급은 사라지지 않는다
    expect(seoyeon?.signalsAfterReply?.unansweredOver24h).toBe(false);
    expect(seoyeon?.signalsAfterReply?.secondMessageUnanswered).toBe(false);
    expect(seoyeon?.signalsAfterReply?.angryTone).toBeNull();
  });

  it('LLM을 쓸 수 없으면 어조는 판정 보류이고 화면이 깨지지 않는다 (T043이 없을 때와 같다)', async () => {
    const client = fakeClient([D1, D2, D3]);
    const llm = countingLlm();
    const { disputes, llm: availability } = await loadDemoDisputes({ client, llm, links: LINKS, now: NOW });

    expect(availability.ok).toBe(true); // 가짜를 넣었으므로 "쓸 수 있다"고 본다
    expect(disputes.every((d) => d.signals?.angryTone === null)).toBe(true);
    expect(disputes.every((d) => d.boardReal.cause !== undefined)).toBe(true);
  });

  it('시각을 읽을 수 없는 글이 섞이면 신호를 만들지 않는다 (날짜를 지어내지 않는다)', async () => {
    const broken = { ...DETAILS[D1], messages: [{ posted_by: 'BUYER', content: 'hello', time_posted: 'not-a-date' }] };
    const client: PayPalClient = {
      call: async () => {
        throw new Error('POST 금지');
      },
      get: async (path: string) =>
        path.startsWith('/v1/customer/disputes?')
          ? { status: 200, body: { items: [], links: [] } }
          : { status: 200, body: broken },
    };
    const onlyD1 = LINKS.filter((link) => link.paypalDisputeId === D1);
    const { disputes } = await loadDemoDisputes({ client, llm: countingLlm(), links: onlyD1, now: NOW });

    expect(disputes).toHaveLength(1);
    expect(disputes[0].signals).toBeNull();
    expect(disputes[0].signalsAfterReply).toBeNull();
  });
});

describe('T047 loadDemoDisputes: 결정론', () => {
  it('같은 입력이면 같은 결과다', async () => {
    const first = await load(fakeClient([D1, D2, D3]), countingLlm());
    const second = await load(fakeClient([D1, D2, D3]), countingLlm());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('T047 서버 도구: 환경 변수가 없을 때', () => {
  it('PayPal을 쓸 수 없으면 예외 대신 "쓸 수 없음"이다 (키 이름만 적는다)', () => {
    const missing = getPayPalClient({});
    expect(missing.ok).toBe(false);
    expect(missing.ok === false && missing.reason).toMatch(/PAYPAL_CLIENT_ID/);
    expect(missing.ok === false && missing.reason).not.toMatch(/[A-Za-z0-9]{30}/); // 값은 담지 않는다
  });

  it('live 주소는 거부한다 (샌드박스만)', () => {
    const live = getPayPalClient({
      PAYPAL_CLIENT_ID: 'id',
      PAYPAL_CLIENT_SECRET: 'secret',
      PAYPAL_BASE_URL: 'https://api-m.paypal.com',
    });
    expect(live.ok).toBe(false);
    expect(live.ok === false && live.reason).toMatch(/api-m\.sandbox\.paypal\.com/);
  });

  it('샌드박스 주소면 클라이언트를 만든다 (호출은 하지 않는다)', () => {
    const ok = getPayPalClient({
      PAYPAL_CLIENT_ID: 'id',
      PAYPAL_CLIENT_SECRET: 'secret',
      PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com/',
    });
    expect(ok.ok).toBe(true);
  });

  it('PayPal을 쓸 수 없으면 분쟁 목록이 비고 예외가 나지 않는다', async () => {
    const result = await loadDemoDisputes({ links: LINKS, now: NOW, llm: countingLlm() });
    // 이 시험 환경에는 PayPal 자격 증명이 없다 (.env를 찾지 않는다)
    expect(result.paypal.ok).toBe(false);
    expect(result.disputes).toEqual([]);
  });

  it('LLM 키가 없으면 "쓸 수 없음"이고, 대체 호출기는 예외만 던진다', async () => {
    const missing = getLlm({});
    expect(missing.ok).toBe(false);
    expect(missing.ok === false && missing.reason).toMatch(/LLM_API_KEY/);
    await expect(unavailableLlm()({ system: 's', user: 'u', jsonSchema: {} })).rejects.toThrow();
  });
});
