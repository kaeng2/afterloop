/**
 * 단위 테스트: PayPal 응답 → `BoardState`·`ClassifyInput` 변환 (T003, SPEC v2.2 9-4장)
 *
 * fixture(`tests/fixtures/`)만 읽고 실제 PayPal을 부르지 않는다.
 * 변환 결과를 엔진(`recommend`)에 넣어 맞물리는지도 함께 본다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { recommend } from '@/engine/recommend';
import { type DisputeDetail, type DisputeSummary, parseDisputeDetail, parseDisputeSummary } from '@/paypal/disputes';
import {
  type BoardExtra,
  INR_REASON,
  apiValueToCents,
  buyerKeyOf,
  countPriorInrDisputes,
  toAllowedMoves,
  toBoardState,
  toClassifyInput,
} from '@/paypal/mapper';
import type { Cause } from '@/types';

const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.resolve(__dirname, `../fixtures/${name}`), 'utf8')) as Record<string, unknown>;

/** 합의(INQUIRY) 단계, 판매자 응답 대기. links에 make_offer·send_message·accept_claim·escalate·self */
const WAITING = fixture('dispute-detail.inquiry-waiting-seller.json');
/** PayPal 검토 중. links는 self뿐이고 응답 기한이 없다 */
const UNDER_REVIEW = fixture('dispute-detail.inquiry-under-review-initial.json');
/** 실제 분쟁 D2 꼴 (T037): `messages` 키가 없고 구매자 접수 글이 `evidences[].notes`에만 있다 */
const CLAIM = fixture('dispute-detail.claim-under-review.json');
const LIST = fixture('dispute-list.json');

/** 그 fixture의 구매자 접수 글. 원문을 테스트 파일에 베끼지 않고 fixture에서 읽는다 */
const CLAIM_NOTE = (CLAIM.evidences as { notes: string }[])[0].notes;

const EXTRA: BoardExtra = { hasTracking: false, hasDeliveredTracking: false, buyerPriorInrDisputes: 0, isDemo: false };

const CAUSE: Cause = { subtype: 'B1', confidence: 0.9, evidence: ['color'], needsReview: false, source: 'llm' };

const detail = (over: Record<string, unknown> = {}, base: Record<string, unknown> = WAITING): DisputeDetail =>
  parseDisputeDetail({ ...base, ...over });

/** 목록 항목 1건을 만든다 (`countPriorInrDisputes`용). */
function summary(over: Record<string, unknown> = {}, payerId: string | null = 'BUYERPAYERID01'): DisputeSummary {
  return parseDisputeSummary({
    dispute_id: 'PP-R-XWI-1',
    reason: INR_REASON,
    dispute_life_cycle_stage: 'INQUIRY',
    dispute_channel: 'INTERNAL',
    dispute_amount: { currency_code: 'USD', value: '10.00' },
    disputed_transactions: payerId === null ? [{}] : [{ buyer: { payer_id: payerId } }],
    ...over,
  });
}

describe('toBoardState: fixture 변환', () => {
  it('판매자 응답 대기 fixture의 금액·단계·채널·기한·허용된 수가 fixture 값과 같다', () => {
    const board = toBoardState(detail(), EXTRA);

    expect(board).toEqual({
      disputeId: 'PP-R-XWI-10197379',
      reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
      stage: 'INQUIRY',
      channel: 'INTERNAL',
      dueDate: '2026-11-29T06:09:25.608Z',
      amountCents: 4800,
      currency: 'USD',
      allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
      hasTracking: false,
      hasDeliveredTracking: false,
      buyerPriorInrDisputes: 0,
      isDemo: false,
    });
  });

  it('합의 단계 fixture에는 provide_evidence가 없고, 순서는 타입 선언 순서다', () => {
    const board = toBoardState(detail(), EXTRA);

    expect(board.allowedMoves).not.toContain('provide_evidence');
    // fixture의 links 순서는 make_offer → send_message → accept_claim이지만 결과는 고정 순서다
    expect(board.allowedMoves).toEqual(['send_message', 'make_offer', 'accept_claim']);
  });

  it('links에 make_offer가 없으면 allowedMoves에도 없다 (검토 중 fixture는 self뿐)', () => {
    const board = toBoardState(detail({}, UNDER_REVIEW), EXTRA);

    expect(board.allowedMoves).toEqual([]);
    expect(board.amountCents).toBe(4800);
    expect(board.stage).toBe('INQUIRY');
    expect(board.channel).toBe('INTERNAL');
  });

  it('응답 기한이 둘 다 없으면 빈 문자열이다 (날짜를 지어내지 않는다)', () => {
    expect(toBoardState(detail({}, UNDER_REVIEW), EXTRA).dueDate).toBe('');
  });

  it('seller_response_due_date가 없으면 buyer_response_due_date를 쓴다', () => {
    const board = toBoardState(
      detail({ seller_response_due_date: undefined, buyer_response_due_date: '2026-12-01T00:00:00Z' }),
      EXTRA,
    );
    expect(board.dueDate).toBe('2026-12-01T00:00:00Z');
  });

  it('목록 항목도 같은 값으로 변환된다 (dispute-list.json)', () => {
    const item = parseDisputeSummary((LIST.items as unknown[])[0]);
    const board = toBoardState({ ...item, messages: [], evidences: [] }, EXTRA);

    expect(board.disputeId).toBe('PP-R-XWI-10197379');
    expect(board.amountCents).toBe(4800);
    expect(board.stage).toBe('INQUIRY');
    expect(board.channel).toBe('INTERNAL');
    expect(board.dueDate).toBe('2026-11-29T06:09:25.000Z');
    expect(board.allowedMoves).toEqual([]); // 목록 응답의 links는 self뿐이다
  });

  it('extra 값은 옮기기만 한다 (cause 포함)', () => {
    const board = toBoardState(detail(), {
      hasTracking: true,
      hasDeliveredTracking: true,
      buyerPriorInrDisputes: 2,
      isDemo: true,
      cause: CAUSE,
    });

    expect(board.hasTracking).toBe(true);
    expect(board.hasDeliveredTracking).toBe(true);
    expect(board.buyerPriorInrDisputes).toBe(2);
    expect(board.isDemo).toBe(true);
    expect(board.cause).toEqual(CAUSE);
  });

  it('cause를 안 주면 키 자체가 없다', () => {
    expect('cause' in toBoardState(detail(), EXTRA)).toBe(false);
  });

  it('BoardState에 구매자 이름·이메일·메시지 원문이 없다 (SPEC 10장)', () => {
    const text = JSON.stringify(toBoardState(detail(), EXTRA));

    expect(text).not.toContain('buyer@example.com');
    expect(text).not.toContain('Test Buyer');
    expect(text).not.toContain('BUYERPAYERID01');
    expect(text).not.toContain('Color and size differ from listing');
  });
});

describe('toBoardState: 모르는 값은 예외', () => {
  const leaks = ['BUYERPAYERID01', 'buyer@example.com', 'Test Buyer', 'Color and size differ from listing'];

  it.each([
    ['단계', { dispute_life_cycle_stage: 'ARBITRATION_PENDING' }, 'dispute_life_cycle_stage'],
    ['단계(소문자)', { dispute_life_cycle_stage: 'inquiry' }, 'dispute_life_cycle_stage'],
    ['채널', { dispute_channel: 'ALTERNATE_RESOLUTION' }, 'dispute_channel'],
  ])('모르는 %s는 예외 (조용히 기본값으로 바꾸지 않는다)', (_label, over, field) => {
    let message = '';
    try {
      toBoardState(detail(over), EXTRA);
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toContain(field);
    expect(message).not.toContain(String(Object.values(over)[0]));
    for (const value of leaks) expect(message).not.toContain(value);
  });

  it('USD가 아닌 통화는 예외 (받은 통화 값을 싣지 않는다)', () => {
    let message = '';
    try {
      toBoardState(detail({ dispute_amount: { currency_code: 'EUR', value: '48.00' } }), EXTRA);
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toContain('dispute_amount.currency_code');
    expect(message).not.toContain('EUR');
  });

  it('extra가 계약과 다르면 예외', () => {
    expect(() => toBoardState(detail(), { ...EXTRA, buyerPriorInrDisputes: -1 })).toThrow(/buyerPriorInrDisputes/);
    expect(() => toBoardState(detail(), { ...EXTRA, buyerPriorInrDisputes: 1.5 })).toThrow(/buyerPriorInrDisputes/);
    expect(() =>
      toBoardState(detail(), { ...EXTRA, hasTracking: 'yes' as unknown as boolean }),
    ).toThrow(/hasTracking/);
  });

  it('필수 필드가 없으면 어떤 필드인지 알 수 있는 예외', () => {
    const broken = { ...WAITING };
    delete (broken as Record<string, unknown>).dispute_channel;

    let message = '';
    try {
      toBoardState(broken as unknown as DisputeDetail, EXTRA);
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toContain('dispute_channel');
    for (const value of leaks) expect(message).not.toContain(value);
  });
});

describe('apiValueToCents: 금액 문자열 → 센트 정수', () => {
  it.each([
    ['48.00', 4800],
    ['35', 3500],
    ['0.07', 7],
    ['1234.5', 123450],
    ['0', 0],
    ['0.00', 0],
    ['0.1', 10],
    ['999999.99', 99999999],
  ])('%s → %i', (value, cents) => {
    expect(apiValueToCents(value)).toBe(cents);
  });

  it.each([['48.001'], ['-1'], ['abc'], [''], ['48.'], [' 48.00'], ['48.00 '], ['+48'], ['1e3'], ['4,800'], ['.5'], ['Infinity']])(
    '%s는 예외',
    (value) => {
      expect(() => apiValueToCents(value)).toThrow();
    },
  );

  it('문자열이 아니면 예외 (부동소수를 받지 않는다)', () => {
    for (const value of [48, 48.0, null, undefined, {}, ['48.00']]) {
      expect(() => apiValueToCents(value)).toThrow(/금액 꼴/);
    }
  });

  it('안전한 정수를 넘는 금액은 예외', () => {
    expect(() => apiValueToCents('99999999999999.99')).toThrow(/너무 크다/);
  });

  it('예외 문구에 받은 값을 싣지 않는다', () => {
    let message = '';
    try {
      apiValueToCents('48.001');
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toContain('48.001');
  });
});

describe('toAllowedMoves', () => {
  it('아는 rel만 남기고 중복은 한 번만 센다', () => {
    const moves = toAllowedMoves([
      { rel: 'self' },
      { rel: 'escalate' },
      { rel: 'acknowledge_return_item' },
      { rel: 'provide_evidence' },
      { rel: 'accept_claim' },
      { rel: 'accept_claim' },
      { rel: 'send_message' },
    ]);

    expect(moves).toEqual(['send_message', 'provide_evidence', 'accept_claim']);
  });

  it('아는 rel이 없으면 빈 배열', () => {
    expect(toAllowedMoves([{ rel: 'self' }, { rel: 'escalate' }])).toEqual([]);
  });
});

describe('buyerKeyOf', () => {
  it('payer_id만 쓴다', () => {
    expect(buyerKeyOf(detail())).toBe('BUYERPAYERID01');
    expect(buyerKeyOf(parseDisputeSummary((LIST.items as unknown[])[0]))).toBe('BUYERPAYERID01');
  });

  it('payer_id가 없으면 그 필드가 없다는 예외', () => {
    expect(() => buyerKeyOf(detail({ disputed_transactions: [{ buyer: { } }] }))).toThrow(
      /disputed_transactions\[\]\.buyer\.payer_id/,
    );
    expect(() => buyerKeyOf(detail({ disputed_transactions: [] }))).toThrow(/payer_id/);
  });
});

describe('countPriorInrDisputes', () => {
  it('같은 구매자의 INR 2건 + 이번 건 → 2', () => {
    const disputes = [
      summary({ dispute_id: 'PP-CURRENT' }),
      summary({ dispute_id: 'PP-OLD-1' }),
      summary({ dispute_id: 'PP-OLD-2' }),
    ];

    expect(countPriorInrDisputes(disputes, 'BUYERPAYERID01', 'PP-CURRENT')).toBe(2);
  });

  it('다른 구매자·SNAD는 세지 않는다', () => {
    const disputes = [
      summary({ dispute_id: 'PP-CURRENT' }),
      summary({ dispute_id: 'PP-OTHER-BUYER' }, 'BUYERPAYERID99'),
      summary({ dispute_id: 'PP-SNAD', reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' }),
      summary({ dispute_id: 'PP-NO-BUYER' }, null),
      summary({ dispute_id: 'PP-OLD-1' }),
    ];

    expect(countPriorInrDisputes(disputes, 'BUYERPAYERID01', 'PP-CURRENT')).toBe(1);
  });

  it('같은 분쟁이 여러 쪽에 겹쳐 와도 한 번만 센다', () => {
    const disputes = [summary({ dispute_id: 'PP-OLD-1' }), summary({ dispute_id: 'PP-OLD-1' })];
    expect(countPriorInrDisputes(disputes, 'BUYERPAYERID01', 'PP-CURRENT')).toBe(1);
  });

  it('빈 목록은 0, buyerKey가 비면 예외', () => {
    expect(countPriorInrDisputes([], 'BUYERPAYERID01', 'PP-CURRENT')).toBe(0);
    expect(() => countPriorInrDisputes([summary()], '', 'PP-CURRENT')).toThrow(/buyerKey/);
    expect(() => countPriorInrDisputes([summary()], '   ', 'PP-CURRENT')).toThrow(/buyerKey/);
  });

  it('여러 거래 중 하나라도 같은 구매자면 센다', () => {
    const disputes = [
      summary({
        dispute_id: 'PP-OLD-1',
        disputed_transactions: [{ buyer: { payer_id: 'BUYERPAYERID99' } }, { buyer: { payer_id: 'BUYERPAYERID01' } }],
      }),
    ];
    expect(countPriorInrDisputes(disputes, 'BUYERPAYERID01', 'PP-CURRENT')).toBe(1);
  });
});

describe('toClassifyInput', () => {
  const extra = { hasTracking: true, hasDeliveredTracking: false, buyerPriorInrDisputes: 1, trackingEvents: ['In transit'] };

  it('구매자가 보낸 메시지만 원문으로 넘긴다', () => {
    const input = toClassifyInput(
      detail({
        messages: [
          { posted_by: 'BUYER', content: '물건을 못 받았어요' },
          { posted_by: 'SELLER', content: '확인 중입니다' },
          { posted_by: 'BUYER', content: '  ' },
          { posted_by: 'ARBITER', content: 'PayPal review' },
        ],
        evidences: [], // "messages만 있는 분쟁" — fixture의 evidences[0](같은 글)을 빼고 본다 (T037)
      }),
      extra,
    );

    expect(input).toEqual({
      reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
      buyerMessages: ['물건을 못 받았어요'],
      trackingEvents: ['In transit'],
      hasTracking: true,
      hasDeliveredTracking: false,
      buyerPriorInrDisputes: 1,
    });
  });

  it('개인통관고유부호 모양도 가리지 않고 그대로 넘긴다 (가리는 것은 분류기의 일)', () => {
    const input = toClassifyInput(
      detail({ messages: [{ posted_by: 'BUYER', content: '통관번호 P123456789012 입니다' }], evidences: [] }),
      extra,
    );
    expect(input.buyerMessages).toEqual(['통관번호 P123456789012 입니다']);
  });

  it('메시지가 없으면 빈 배열, trackingEvents는 복사한다', () => {
    const events = ['a'];
    const input = toClassifyInput(detail({ messages: [], evidences: [] }), { ...extra, trackingEvents: events });

    expect(input.buyerMessages).toEqual([]);
    expect(input.trackingEvents).toEqual(['a']);
    expect(input.trackingEvents).not.toBe(events);
  });

  it('trackingEvents가 문자열 배열이 아니면 예외', () => {
    expect(() => toClassifyInput(detail(), { ...extra, trackingEvents: [1] as unknown as string[] })).toThrow(
      /trackingEvents/,
    );
  });
});

// ── 구매자 글: messages + evidences[].notes (T037) ───────────────────────────
describe('toClassifyInput: evidences의 구매자 글도 읽는다', () => {
  const extra = { hasTracking: true, hasDeliveredTracking: false, buyerPriorInrDisputes: 1, trackingEvents: [] };

  /** `messages`·`evidences`만 바꿔 분류 입력을 만든다 (base는 합의 단계 fixture). */
  const classify = (over: Record<string, unknown>, base: Record<string, unknown> = WAITING) =>
    toClassifyInput(detail(over, base), extra).buyerMessages;

  it('messages 키가 없고 evidences에만 구매자 글이 있는 분쟁(D2 꼴)도 1건을 읽는다', () => {
    const input = toClassifyInput(detail({}, CLAIM), extra);

    expect(input.buyerMessages).toEqual([CLAIM_NOTE]);
    expect(input.reason).toBe('MERCHANDISE_OR_SERVICE_NOT_RECEIVED');
  });

  it('messages와 evidences에 같은 글이 있으면 1건이다 (fixture의 접수 글 = messages[0])', () => {
    // 이 fixture는 손대지 않은 그대로 쓴다: messages[0].content와 evidences[0].notes가 같은 글이다
    expect(toClassifyInput(detail(), extra).buyerMessages).toEqual(['Color and size differ from listing']);
  });

  it('앞뒤 공백만 다른 같은 글도 1건이고, 먼저 오는 것을 남긴다', () => {
    expect(
      classify({
        messages: [{ posted_by: 'BUYER', content: '같은 글', time_posted: '2026-11-09T06:00:00Z' }],
        evidences: [{ source: 'SUBMITTED_BY_BUYER', notes: '  같은 글  ', date: '2026-11-09T07:00:00Z' }],
      }),
    ).toEqual(['같은 글']);
  });

  it('글이 다르면 둘 다 넣고 시각순(이른 것부터)으로 세운다', () => {
    expect(
      classify({
        messages: [{ posted_by: 'BUYER', content: '나중 글', time_posted: '2026-11-09T10:00:00Z' }],
        evidences: [{ source: 'SUBMITTED_BY_BUYER', notes: '먼저 글', date: '2026-11-09T06:00:00Z' }],
      }),
    ).toEqual(['먼저 글', '나중 글']);
  });

  it('시각은 Date.parse로 비교한다 (문자열 비교면 거꾸로 선다)', () => {
    // 문자열로 비교하면 `.`(0x2E) < `Z`라서 `...25.608Z`가 `...25Z`보다 앞에 선다
    expect(
      classify({
        messages: [{ posted_by: 'BUYER', content: '늦은 글', time_posted: '2026-11-09T06:09:25.608Z' }],
        evidences: [{ source: 'SUBMITTED_BY_BUYER', notes: '이른 글', date: '2026-11-09T06:09:25Z' }],
      }),
    ).toEqual(['이른 글', '늦은 글']);
  });

  it('시각이 같으면 모은 순서(messages 먼저, 그다음 evidences)를 지킨다', () => {
    expect(
      classify({
        messages: [{ posted_by: 'BUYER', content: 'm', time_posted: '2026-11-09T06:00:00Z' }],
        evidences: [{ source: 'SUBMITTED_BY_BUYER', notes: 'e', date: '2026-11-09T06:00:00Z' }],
      }),
    ).toEqual(['m', 'e']);
  });

  it('시각이 없거나 읽을 수 없는 글은 뒤에, 모은 순서로 붙는다', () => {
    expect(
      classify({
        messages: [
          { posted_by: 'BUYER', content: 'm-시각없음' },
          { posted_by: 'BUYER', content: 'm-못읽는시각', time_posted: '어제' },
          { posted_by: 'BUYER', content: 'm-시각있음', time_posted: '2026-11-09T09:00:00Z' },
        ],
        evidences: [
          { source: 'SUBMITTED_BY_BUYER', notes: 'e-시각없음' },
          { source: 'SUBMITTED_BY_BUYER', notes: 'e-시각있음', date: '2026-11-09T08:00:00Z' },
        ],
      }),
    ).toEqual(['e-시각있음', 'm-시각있음', 'm-시각없음', 'm-못읽는시각', 'e-시각없음']);
  });

  it('같은 입력이면 항상 같은 순서가 나온다', () => {
    const over = {
      messages: [
        { posted_by: 'BUYER', content: 'b', time_posted: '2026-11-09T06:00:00Z' },
        { posted_by: 'BUYER', content: 'a' },
      ],
      evidences: [
        { source: 'SUBMITTED_BY_BUYER', notes: 'c' },
        { source: 'SUBMITTED_BY_BUYER', notes: 'd', date: '2026-11-09T05:00:00Z' },
      ],
    };

    expect(classify(over)).toEqual(classify(over));
    expect(classify(over)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('판매자·PayPal 증빙의 notes, 빈 notes, notes 없는 항목은 넣지 않는다', () => {
    expect(
      classify({
        messages: [],
        evidences: [
          { source: 'SUBMITTED_BY_SELLER', notes: '판매자가 낸 증빙', date: '2026-11-09T01:00:00Z' },
          { source: 'REQUESTED_FROM_SELLER', notes: 'PayPal이 요청한 자료' },
          { source: 'SUBMITTED_BY_BUYER', notes: '   ' },
          { source: 'SUBMITTED_BY_BUYER', date: '2026-11-09T02:00:00Z' },
          { notes: 'source가 없는 증빙' },
          { evidence_type: 'CREATE', source: 'SUBMITTED_BY_BUYER', notes: '구매자 글' },
        ],
      }),
    ).toEqual(['구매자 글']);
  });

  it('evidences 키가 없는 응답도 예외 없이 messages만 읽는다', () => {
    const noEvidences = { ...WAITING };
    delete (noEvidences as Record<string, unknown>).evidences;

    expect(classify({}, noEvidences)).toEqual(['Color and size differ from listing']);
    expect(classify({ messages: [] }, noEvidences)).toEqual([]);
  });

  it('예외 문구에 구매자 글이 들어가지 않는다', () => {
    let message = '';
    try {
      toClassifyInput(detail({}, CLAIM), { ...extra, trackingEvents: [1] as unknown as string[] });
    } catch (e) {
      message = (e as Error).message;
    }

    expect(message).toContain('trackingEvents');
    expect(message).not.toContain(CLAIM_NOTE);
    expect(message).not.toContain(CLAIM_NOTE.slice(0, 8));
  });

  it('BoardState에는 evidences의 구매자 글이 들어가지 않는다 (SPEC 10장)', () => {
    const board = toBoardState(detail({}, CLAIM), EXTRA);
    const text = JSON.stringify(board);

    expect(text).not.toContain(CLAIM_NOTE.slice(0, 8));
    expect(text).not.toContain('testbuyer2@example.com');
    expect(text).not.toContain('Test Buyer Two');
  });

  it('D2 꼴의 BoardState는 지금 그대로다 (CHARGEBACK, 기한 없음, 허용된 수 없음)', () => {
    // `provide_supporting_info`는 계약의 MoveType에 없어서 버려진다 (T037에서 바꾸지 않는다)
    const board = toBoardState(detail({}, CLAIM), EXTRA);

    expect(board.stage).toBe('CHARGEBACK');
    expect(board.channel).toBe('INTERNAL');
    expect(board.dueDate).toBe('');
    expect(board.allowedMoves).toEqual([]);
    expect(board.amountCents).toBe(7200);
  });
});

describe('엔진과 맞물린다', () => {
  it('변환 결과를 recommend에 넣어도 예외 없이 돈다', () => {
    const board = toBoardState(detail(), { ...EXTRA, cause: CAUSE });
    const result = recommend(board);

    expect(result.requiresApproval).toBe(true);
    expect(result.all.length).toBeGreaterThan(0);
    expect(result.best).not.toBeNull();
    expect(result.autopilot.verdict).toBeDefined();
  });

  it('기한·허용된 수가 비어 있는 fixture(검토 중)도 recommend가 받는다', () => {
    const board = toBoardState(detail({}, UNDER_REVIEW), { ...EXTRA, cause: CAUSE });
    expect(() => recommend(board)).not.toThrow();
  });

  it('F1(남용 의심) 입력도 돈다', () => {
    const board = toBoardState(detail(), {
      hasTracking: true,
      hasDeliveredTracking: true,
      buyerPriorInrDisputes: 2,
      isDemo: true,
      cause: { ...CAUSE, subtype: 'F1' },
    });

    expect(() => recommend(board)).not.toThrow();
  });
});
