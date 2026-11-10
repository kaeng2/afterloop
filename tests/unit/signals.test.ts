/**
 * 단위 테스트: buildEscalationSignals (SPEC v2.5 7장). 작업 T044.
 * 신호를 데이터에서 뽑는 부분만 본다. 신호 → 점수는 escalationRisk의 몫이지만,
 * SPEC 7장이 못 박은 서연 건 6 (High) → 답장 후 3 (Watch)은 두 함수를 이어서 확인한다.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { escalationRisk } from '@/engine/escalation';
import { rulesFromConfig } from '@/engine/params';
import { CARD_COMPANY_TERMS, HOURS_TO_DUE_NONE, buildEscalationSignals } from '@/engine/signals';
import type { SignalInput } from '@/engine/signals';
import type { EscalationRisk, PolicyConfig } from '@/types';

const R: PolicyConfig = rulesFromConfig();

/** 시연 시점 (SPEC 7장) */
const NOW = '2026-11-10T17:00:00Z';

function input(over: Partial<SignalInput> = {}): SignalInput {
  return {
    buyerMessages: [],
    sellerReplies: [],
    now: NOW,
    disputeDueDate: '',
    angryTone: null,
    ...over,
  };
}

/** 기한 점수 부분만 꺼낸다. */
function duePoints(risk: EscalationRisk): number {
  return risk.parts.find((part) => part.signal === 'dueWithin72h')?.points ?? -1;
}

describe('서연 건 (SPEC 7장, 실제 분쟁 D2 값)', () => {
  /** 시드 11/02 문의 + 11/10 분쟁 접수 글, 판매자 답장 없음 */
  const SEOYEON = input({
    buyerMessages: [
      { at: '2026-11-02', text: '배송 조회가 일주일째 그대로예요. 확인 부탁드려요.' },
      { at: '2026-11-10T00:37:46Z', text: '아직 못 받았어요. 처리 안 되면 카드사에 이의제기할게요.' },
    ],
    disputeDueDate: '2026-11-30T00:37:46.766Z',
    angryTone: true,
  });

  it('답장 전: 카드사 언급 + 두 번째 문의 무응답 + 화난 어조, 기한은 멀다', () => {
    const signals = buildEscalationSignals(SEOYEON);
    expect(signals).toEqual({
      mentionsCardCompany: true,
      secondMessageUnanswered: true,
      // 11/10 00:37 접수 글에서 시연 시점(17:00)까지 약 16시간 — 24시간을 넘지 않았다
      unansweredOver24h: false,
      angryTone: true,
      hoursToDue: signals.hoursToDue,
    });
    expect(signals.hoursToDue).toBeCloseTo(463.63, 1);
  });

  it('답장 전: 점수 3 + 2 + 1 + 0 = 6 (High)', () => {
    const risk = escalationRisk(buildEscalationSignals(SEOYEON), R);
    expect([risk.score, risk.band]).toEqual([6, 'High']);
    expect(risk.parts).toEqual([
      { signal: 'cardCompanyMention', points: 3 },
      { signal: 'unanswered', points: 2 },
      { signal: 'angryTone', points: 1 },
      { signal: 'dueWithin72h', points: 0 },
    ]);
  });

  it('판매자가 답장하면: 3 + 0 + 0 + 0 = 3 (Watch). 카드사 언급은 남는다', () => {
    const replied = buildEscalationSignals({ ...SEOYEON, sellerReplies: [{ at: '2026-11-10T16:00:00Z' }] });
    expect(replied).toMatchObject({
      mentionsCardCompany: true,
      secondMessageUnanswered: false,
      unansweredOver24h: false,
      angryTone: null,
    });
    const risk = escalationRisk(replied, R);
    expect([risk.score, risk.band]).toEqual([3, 'Watch']);
  });

  it('답장 뒤 구매자가 다시 쓰면 어조 판정이 돌아오고 무응답을 다시 센다', () => {
    const again = buildEscalationSignals({
      ...SEOYEON,
      sellerReplies: [{ at: '2026-11-10T10:00:00Z' }],
      buyerMessages: [...SEOYEON.buyerMessages, { at: '2026-11-10T12:00:00Z', text: '언제 되나요?' }],
    });
    expect(again).toMatchObject({
      mentionsCardCompany: true,
      // 답장 뒤 글은 1건뿐이다
      secondMessageUnanswered: false,
      unansweredOver24h: false,
      angryTone: true,
    });
    expect(escalationRisk(again, R).score).toBe(4);
  });
});

describe('지호 건 (카드사 언급 없는 1건)', () => {
  const JIHO = input({
    buyerMessages: [{ at: '2026-11-10T00:00:00Z', text: '색이 사진과 달라요. 교환하고 싶어요.' }],
    angryTone: false,
  });

  it('접수 17시간 뒤: 무응답 두 신호 모두 거짓', () => {
    expect(buildEscalationSignals({ ...JIHO, now: '2026-11-10T17:00:00Z' })).toMatchObject({
      mentionsCardCompany: false,
      secondMessageUnanswered: false,
      unansweredOver24h: false,
      angryTone: false,
    });
  });

  it('접수 25시간 뒤: unansweredOver24h만 참 (글이 1건이라 두 번째 문의는 아니다)', () => {
    expect(buildEscalationSignals({ ...JIHO, now: '2026-11-11T01:00:00Z' })).toMatchObject({
      secondMessageUnanswered: false,
      unansweredOver24h: true,
    });
  });

  it('딱 24시간이면 참이 아니다 (넘어야 한다)', () => {
    expect(buildEscalationSignals({ ...JIHO, now: '2026-11-11T00:00:00Z' }).unansweredOver24h).toBe(false);
    expect(buildEscalationSignals({ ...JIHO, now: '2026-11-11T00:00:00.001Z' }).unansweredOver24h).toBe(true);
  });
});

describe('기한까지 남은 시간 (hoursToDue)', () => {
  it('기한이 없으면 이름 붙인 유한한 큰 상수 → 기한 점수 0', () => {
    const signals = buildEscalationSignals(input({ disputeDueDate: '' }));
    expect(signals.hoursToDue).toBe(HOURS_TO_DUE_NONE);
    expect(Number.isFinite(signals.hoursToDue)).toBe(true);
    expect(duePoints(escalationRisk(signals, R))).toBe(0);
  });

  it('48시간 뒤 기한이면 +1', () => {
    const signals = buildEscalationSignals(input({ disputeDueDate: '2026-11-12T17:00:00Z' }));
    expect(signals.hoursToDue).toBe(48);
    expect(duePoints(escalationRisk(signals, R))).toBe(1);
  });

  it('72시간 경계: 72시간은 +1, 73시간은 0', () => {
    expect(duePoints(escalationRisk(buildEscalationSignals(input({ disputeDueDate: '2026-11-13T17:00:00Z' })), R))).toBe(1);
    expect(duePoints(escalationRisk(buildEscalationSignals(input({ disputeDueDate: '2026-11-13T18:00:00Z' })), R))).toBe(0);
  });

  it('지난 기한은 음수다', () => {
    expect(buildEscalationSignals(input({ disputeDueDate: '2026-11-09T17:00:00Z' })).hoursToDue).toBe(-24);
  });

  it('기한을 날짜로만 주면 그날 00:00 UTC 기준이다', () => {
    expect(buildEscalationSignals(input({ disputeDueDate: '2026-11-11' })).hoursToDue).toBe(7);
  });
});

describe('카드사 언급 낱말 (SPEC 7장 +3)', () => {
  it('목록의 낱말이 들어간 글은 모두 잡는다', () => {
    for (const term of CARD_COMPANY_TERMS) {
      const signals = buildEscalationSignals(input({ buyerMessages: [{ at: NOW, text: `주문 확인 부탁해요. ${term} 쪽으로 진행합니다.` }] }));
      expect(signals.mentionsCardCompany, term).toBe(true);
    }
  });

  it('영어·독일어는 대소문자를 가리지 않는다', () => {
    for (const text of ['I will file a CHARGEBACK.', 'calling my Bank tomorrow', 'Ich fordere eine RÜCKBUCHUNG.', 'my credit card COMPANY said so']) {
      expect(buildEscalationSignals(input({ buyerMessages: [{ at: NOW, text }] })).mentionsCardCompany, text).toBe(true);
    }
  });

  it('여러 줄에 걸쳐 써도 잡는다', () => {
    expect(buildEscalationSignals(input({ buyerMessages: [{ at: NOW, text: 'I will contact my credit card\ncompany today.' }] })).mentionsCardCompany).toBe(true);
  });

  it('상관없는 글은 잡지 않는다 ("카드"만, "bank holiday")', () => {
    for (const text of [
      '카드로 결제했어요',
      '카드 결제가 두 번 됐어요',
      'The delay is because of a bank holiday.',
      'Ich habe mit Karte bezahlt.',
      '배송 조회가 일주일째 그대로예요. 확인 부탁드려요.',
    ]) {
      expect(buildEscalationSignals(input({ buyerMessages: [{ at: NOW, text }] })).mentionsCardCompany, text).toBe(false);
    }
  });

  it('구매자 글 여러 건 가운데 하나만 언급해도 참이고, 판매자 답장 뒤에도 남는다', () => {
    const messages = [
      { at: '2026-11-02', text: '배송이 안 와요.' },
      { at: '2026-11-05', text: '안 되면 카드사에 이의 제기 하겠습니다.' },
    ];
    expect(buildEscalationSignals(input({ buyerMessages: messages })).mentionsCardCompany).toBe(true);
    expect(
      buildEscalationSignals(input({ buyerMessages: messages, sellerReplies: [{ at: '2026-11-06' }] })).mentionsCardCompany,
    ).toBe(true);
  });

  it('판매자 답장에 적힌 낱말은 보지 않는다 (구매자 글만 본다)', () => {
    expect(
      buildEscalationSignals(input({ buyerMessages: [{ at: '2026-11-02', text: '배송이 안 와요.' }], sellerReplies: [{ at: '2026-11-03' }] }))
        .mentionsCardCompany,
    ).toBe(false);
  });
});

describe('무응답 세기', () => {
  const TEXT = '확인 부탁드려요.';

  it('답하지 않은 글이 연달아 2건 이상이면 secondMessageUnanswered', () => {
    const two = [
      { at: '2026-11-08T00:00:00Z', text: TEXT },
      { at: '2026-11-09T00:00:00Z', text: TEXT },
    ];
    expect(buildEscalationSignals(input({ buyerMessages: two })).secondMessageUnanswered).toBe(true);
    // 첫 글에는 답했고 두 번째만 남았으면 연달아 1건이다
    expect(
      buildEscalationSignals(input({ buyerMessages: two, sellerReplies: [{ at: '2026-11-08T12:00:00Z' }] })).secondMessageUnanswered,
    ).toBe(false);
  });

  it('마지막 글 뒤에 답장이 있으면 두 신호 모두 거짓 (오래된 글이라도)', () => {
    const signals = buildEscalationSignals(
      input({
        buyerMessages: [
          { at: '2026-11-01T00:00:00Z', text: TEXT },
          { at: '2026-11-02T00:00:00Z', text: TEXT },
        ],
        sellerReplies: [{ at: '2026-11-02T01:00:00Z' }],
        angryTone: true,
      }),
    );
    expect(signals).toMatchObject({ secondMessageUnanswered: false, unansweredOver24h: false, angryTone: null });
  });

  it('마지막 글과 같은 시각의 답장은 "뒤"로 보지 않는다 — 그 글은 답하지 않은 것으로 센다 (막는 쪽)', () => {
    const signals = buildEscalationSignals(
      input({
        buyerMessages: [
          { at: '2026-11-08T00:00:00Z', text: TEXT },
          { at: '2026-11-09T00:00:00Z', text: TEXT },
        ],
        sellerReplies: [{ at: '2026-11-09T00:00:00Z' }],
        angryTone: true,
      }),
    );
    // 마지막 글은 답하지 않은 것으로 보므로 어조 판정이 살아 있고 24시간 무응답도 센다.
    // 11/08 글에는 11/09 답장이 (같은 시각이 아니라) 뒤에 있으므로 답한 것이고, 연달아 남은 글은 1건이다
    expect(signals).toMatchObject({ secondMessageUnanswered: false, unansweredOver24h: true, angryTone: true });
  });

  it('앞 글과 같은 시각의 답장도 "뒤"가 아니다 — 두 글 모두 답하지 않은 것으로 센다', () => {
    const signals = buildEscalationSignals(
      input({
        buyerMessages: [
          { at: '2026-11-08T00:00:00Z', text: TEXT },
          { at: '2026-11-09T00:00:00Z', text: TEXT },
        ],
        sellerReplies: [{ at: '2026-11-08T00:00:00Z' }],
        angryTone: true,
      }),
    );
    expect(signals).toMatchObject({ secondMessageUnanswered: true, unansweredOver24h: true, angryTone: true });
  });

  it('글 순서가 뒤섞여 들어와도 결과가 같다', () => {
    const messages = [
      { at: '2026-11-09T00:00:00Z', text: TEXT },
      { at: '2026-11-02T00:00:00Z', text: '카드사' },
      { at: '2026-11-05T00:00:00Z', text: TEXT },
    ];
    const replies = [{ at: '2026-11-06T00:00:00Z' }, { at: '2026-11-03T00:00:00Z' }];
    const shuffled = buildEscalationSignals(input({ buyerMessages: messages, sellerReplies: replies, angryTone: true }));
    const sorted = buildEscalationSignals(
      input({
        buyerMessages: [...messages].sort((a, b) => a.at.localeCompare(b.at)),
        sellerReplies: [...replies].sort((a, b) => a.at.localeCompare(b.at)),
        angryTone: true,
      }),
    );
    expect(shuffled).toEqual(sorted);
    // 마지막 답장(11/06) 뒤 글은 11/09 하나뿐이다
    expect(shuffled).toMatchObject({ mentionsCardCompany: true, secondMessageUnanswered: false, unansweredOver24h: true, angryTone: true });
  });

  it('답장이 여러 건이면 가장 늦은 답장만 본다', () => {
    const signals = buildEscalationSignals(
      input({
        buyerMessages: [
          { at: '2026-11-08T00:00:00Z', text: TEXT },
          { at: '2026-11-09T00:00:00Z', text: TEXT },
        ],
        sellerReplies: [{ at: '2026-11-01T00:00:00Z' }, { at: '2026-11-07T00:00:00Z' }],
      }),
    );
    expect(signals.secondMessageUnanswered).toBe(true);
  });
});

describe('구매자 글이 없을 때', () => {
  it('언급·무응답은 거짓, angryTone은 null (입력이 true여도)', () => {
    expect(buildEscalationSignals(input({ angryTone: true, sellerReplies: [{ at: '2026-11-09' }] }))).toEqual({
      mentionsCardCompany: false,
      secondMessageUnanswered: false,
      unansweredOver24h: false,
      angryTone: null,
      hoursToDue: HOURS_TO_DUE_NONE,
    });
  });

  it('점수는 0 Low다', () => {
    const risk = escalationRisk(buildEscalationSignals(input()), R);
    expect([risk.score, risk.band]).toEqual([0, 'Low']);
  });
});

describe('결정론과 입력 검증', () => {
  const SAMPLE = input({
    buyerMessages: [{ at: '2026-11-09T00:00:00Z', text: '카드사에 이의제기할게요.' }],
    disputeDueDate: '2026-11-12T00:00:00Z',
    angryTone: true,
  });

  it('같은 입력으로 100번 만들어도 같다', () => {
    const first = buildEscalationSignals(SAMPLE);
    for (let i = 0; i < 100; i++) expect(buildEscalationSignals(SAMPLE)).toEqual(first);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const before = structuredClone(SAMPLE);
    buildEscalationSignals(SAMPLE);
    expect(SAMPLE).toEqual(before);
  });

  it('angryTone을 빠뜨리거나 꼴이 틀리면 ZodError', () => {
    expect(() => buildEscalationSignals({ ...input(), angryTone: undefined } as unknown as SignalInput)).toThrow(ZodError);
    expect(() => buildEscalationSignals({ ...input(), buyerMessages: [{ at: NOW }] } as unknown as SignalInput)).toThrow(ZodError);
  });

  it('시각이 날짜가 아니면 어느 입력인지 알려 주는 예외', () => {
    expect(() => buildEscalationSignals(input({ now: 'now' }))).toThrow(/^now/);
    expect(() => buildEscalationSignals(input({ buyerMessages: [{ at: 'yesterday', text: '…' }] }))).toThrow(/buyerMessages\[0\]\.at/);
    expect(() => buildEscalationSignals(input({ sellerReplies: [{ at: '2026-02-30' }] }))).toThrow(/sellerReplies\[0\]\.at/);
    expect(() => buildEscalationSignals(input({ disputeDueDate: 'soon' }))).toThrow(/^disputeDueDate/);
  });
});
