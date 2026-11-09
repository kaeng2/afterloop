/**
 * 사실값 토큰 + 번역 검사 단위 테스트 (T010, SPEC v2.2 3장).
 *
 * 모양 검사의 경계는 아래 "막을 것 / 막지 않을 것" 표에 적어 둔다. 표를 고치는 것이
 * 곧 경계를 고치는 것이므로, 새 경계가 필요하면 표에 줄을 더한다.
 */
import { describe, expect, it } from 'vitest';

import { PROMISE_GROUPS, PROMISE_TERMS, checkTokens, extractTokens, fillTokens, formatFact } from '@/ai/tokens';
import type { FactToken } from '@/types';

/** 서연 SC4 (통관 안내): 날짜와 추적번호를 토큰으로만 쓴다. */
const SC4_FACTS: FactToken[] = [
  { token: '⟦DATE_1⟧', kind: 'DATE', value: '2026-11-17' },
  { token: '⟦TRACKING_1⟧', kind: 'TRACKING', value: 'EE123456789KR' },
];
const SC4_DRAFT = 'Your parcel cleared customs on ⟦DATE_1⟧. Tracking: ⟦TRACKING_1⟧.';
const SC4_OUTGOING = '고객님의 소포는 ⟦DATE_1⟧에 통관을 마쳤습니다. 추적번호: ⟦TRACKING_1⟧.';

/** 사실값 모양만 보고 싶을 때. 초안을 비우면 토큰·약속 검사는 비어 있다. */
function literalsOf(outgoing: string, facts: FactToken[] = []): string[] {
  return checkTokens('', outgoing, facts).literalFacts;
}

describe('extractTokens', () => {
  it('나온 순서대로, 중복까지 센다', () => {
    expect(extractTokens('⟦TRACKING_1⟧ then ⟦DATE_1⟧ and ⟦DATE_1⟧ again')).toEqual([
      '⟦TRACKING_1⟧',
      '⟦DATE_1⟧',
      '⟦DATE_1⟧',
    ]);
  });

  it('토큰이 없으면 빈 배열', () => {
    expect(extractTokens('no tokens here {{offerAmount}}')).toEqual([]);
  });

  it('형식 오류는 토큰이 아니다', () => {
    expect(extractTokens('⟦PCCC⟧ ⟦date_1⟧ ⟦DATE_0⟧ ⟦DATE⟧ ⟦CUSTOMS_STATUS_1⟧')).toEqual(['⟦CUSTOMS_STATUS_1⟧']);
  });

  it('네 종류 모두와 두 자리 이상 번호를 받는다', () => {
    const text = '⟦DATE_1⟧⟦AMOUNT_2⟧⟦TRACKING_10⟧⟦CUSTOMS_STATUS_3⟧';
    expect(extractTokens(text)).toEqual(['⟦DATE_1⟧', '⟦AMOUNT_2⟧', '⟦TRACKING_10⟧', '⟦CUSTOMS_STATUS_3⟧']);
  });
});

describe('checkTokens: 서연 SC4', () => {
  it('두 토큰이 그대로 있으면 ok', () => {
    expect(checkTokens(SC4_DRAFT, SC4_OUTGOING, SC4_FACTS)).toEqual({
      ok: true,
      missing: [],
      extra: [],
      literalFacts: [],
      newPromises: [],
    });
  });

  it('전송본에서 토큰이 빠지면 missing', () => {
    const outgoing = '고객님의 소포는 통관을 마쳤습니다. 추적번호: ⟦TRACKING_1⟧.';
    const check = checkTokens(SC4_DRAFT, outgoing, SC4_FACTS);
    expect(check.missing).toEqual(['⟦DATE_1⟧']);
    expect(check.extra).toEqual([]);
    expect(check.ok).toBe(false);
  });

  it('토큰이 현지 표기로 바뀌면 missing + literalFacts', () => {
    const outgoing = '고객님의 소포는 11월 17일에 통관을 마쳤습니다. 추적번호: ⟦TRACKING_1⟧.';
    const check = checkTokens(SC4_DRAFT, outgoing, SC4_FACTS);
    expect(check.missing).toEqual(['⟦DATE_1⟧']);
    expect(check.literalFacts).toEqual(['11월 17일']);
    expect(check.ok).toBe(false);
  });

  it('추적번호를 직접 쓰면 literalFacts', () => {
    const outgoing = '고객님의 소포는 ⟦DATE_1⟧에 통관을 마쳤습니다. 추적번호: EE123456789KR.';
    const check = checkTokens(SC4_DRAFT, outgoing, SC4_FACTS);
    expect(check.missing).toEqual(['⟦TRACKING_1⟧']);
    expect(check.literalFacts).toEqual(['EE123456789KR']);
  });

  it('개수까지 비교한다 (초안 2번, 전송본 1번 → 1번 부족)', () => {
    const draft = '⟦DATE_1⟧ and ⟦DATE_1⟧';
    expect(checkTokens(draft, '⟦DATE_1⟧만 있습니다', SC4_FACTS).missing).toEqual(['⟦DATE_1⟧']);
    expect(checkTokens('⟦DATE_1⟧만 있습니다', draft, SC4_FACTS).extra).toEqual(['⟦DATE_1⟧']);
    expect(checkTokens(draft, draft, SC4_FACTS).ok).toBe(true);
  });
});

describe('checkTokens: extra', () => {
  it('초안에 없던 토큰은 extra', () => {
    const outgoing = '고객님의 소포는 ⟦DATE_1⟧에 통관을 마쳤습니다. 추적번호: ⟦TRACKING_1⟧. ⟦AMOUNT_1⟧';
    const facts = [...SC4_FACTS, { token: '⟦AMOUNT_1⟧', kind: 'AMOUNT', value: '720' } as FactToken];
    expect(checkTokens(SC4_DRAFT, outgoing, facts).extra).toEqual(['⟦AMOUNT_1⟧']);
  });

  it('facts에 없는 토큰은 extra', () => {
    const draft = `${SC4_DRAFT} ⟦CUSTOMS_STATUS_1⟧`;
    const outgoing = `${SC4_OUTGOING} ⟦CUSTOMS_STATUS_1⟧`;
    expect(checkTokens(draft, outgoing, SC4_FACTS).extra).toEqual(['⟦CUSTOMS_STATUS_1⟧']);
  });

  it('형식 오류는 원문 그대로 extra', () => {
    const outgoing = `${SC4_OUTGOING} ⟦PCCC⟧ ⟦date_1⟧ ⟦DATE_0⟧`;
    expect(checkTokens(SC4_DRAFT, outgoing, SC4_FACTS).extra).toEqual(['⟦PCCC⟧', '⟦date_1⟧', '⟦DATE_0⟧']);
  });

  it('짝이 맞지 않는 괄호도 extra', () => {
    const check = checkTokens('', '⟦ 반쪽 괄호', []);
    expect(check.extra).toEqual(['⟦']);
    expect(check.ok).toBe(false);
  });

  it('형식 오류 안의 개인통관고유부호는 가린다', () => {
    const check = checkTokens('', '⟦P123456789012⟧', []);
    expect(check.extra).toEqual(['⟦P************⟧']);
    expect(JSON.stringify(check)).not.toContain('123456789012');
  });
});

describe('checkTokens: newPromises', () => {
  it('초안에 없는 약속 표현은 newPromises', () => {
    const check = checkTokens(SC4_DRAFT, `${SC4_OUTGOING} 반드시 내일 도착합니다.`, SC4_FACTS);
    expect(check.newPromises).toEqual(['반드시']);
    expect(check.ok).toBe(false);
  });

  it('초안에 guarantee가 있으면 전송본의 보장은 통과', () => {
    const draft = `${SC4_DRAFT} We guarantee delivery.`;
    const outgoing = `${SC4_OUTGOING} 배송을 보장합니다.`;
    const check = checkTokens(draft, outgoing, SC4_FACTS);
    expect(check.newPromises).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it('언어가 달라도 같은 묶음이면 통과한다', () => {
    const pairs: [string, string][] = [
      ['We guarantee it.', '保証します'],
      ['We promise.', '약속드립니다'],
      ['I promise', 'Ich versprechen es'],
      ['definitely', '必ず届きます'],
      ['without fail', 'auf jeden Fall'],
      ['100% safe', '무조건 괜찮습니다'],
    ];
    for (const [draft, outgoing] of pairs) {
      expect(checkTokens(draft, outgoing, []).newPromises, `${draft} / ${outgoing}`).toEqual([]);
    }
  });

  it('다른 묶음이면 새 약속이다', () => {
    expect(checkTokens('We guarantee it.', '반드시 도착합니다', []).newPromises).toEqual(['반드시']);
    expect(checkTokens('We guarantee it.', 'Ich versprechen es', []).newPromises).toEqual(['versprech']);
  });

  it('대소문자를 무시한다', () => {
    expect(checkTokens('nothing here', 'We GUARANTEE it', []).newPromises).toEqual(['GUARANTEE']);
    expect(checkTokens('We GUARANTEE it', 'we guarantee it', []).newPromises).toEqual([]);
  });

  it('약속 표현이 없으면 빈 배열', () => {
    expect(checkTokens('', '배송은 보통 3주 걸립니다.', []).newPromises).toEqual([]);
  });

  it('언어별 목록은 묶음 표가 빠짐없이 덮는다', () => {
    const grouped = PROMISE_GROUPS.flatMap((entry) => entry.terms);
    for (const terms of Object.values(PROMISE_TERMS)) {
      for (const term of terms) {
        expect(grouped.filter((other) => other === term), term).toHaveLength(1);
      }
    }
    const listed = Object.values(PROMISE_TERMS).flat();
    for (const term of grouped) expect(listed, term).toContain(term);
  });
});

// ───────────────────────────── 모양 표 (막을 것 / 막지 않을 것) ─────────────────────────────

/** 금액 모양: 막을 것. */
const AMOUNT_BLOCKED = [
  '$24',
  '$7.20',
  '$ 7.20',
  'US$7',
  '＄７',
  '₩9,600',
  '€7',
  'USD 7.20',
  'usd7.20',
  '7.20 USD',
  '7.20 dollars',
  '7 U.S. dollars',
  '20 cents',
  '5 bucks',
  '7달러',
  '9600원',
  '24ドル',
  '24 Dollar',
  '7.20',
  '７.２０',
];

/** 금액 모양: 막지 않을 것. */
const AMOUNT_ALLOWED = [
  '3 weeks',
  '3주',
  '2 days',
  '1개',
  '2 items',
  '15%',
  '배송은 3~5 영업일 걸립니다',
  'in 3-5 business days',
  'we have 2 left',
  'size 2',
  '2026년에 주문하셨습니다',
  'Order status updated',
  '7.205',
  '50 percent',
  '재고 2개 남았습니다',
];

/** 날짜 모양: 막을 것. */
const DATE_BLOCKED = [
  '11월 17일',
  '1월 5일',
  '11月17日',
  'November 17',
  'Nov 17',
  'Nov. 17',
  'November 17th',
  '17 November',
  '17. November',
  '17th November',
  '17. Dezember',
  '5. Mai',
  '11/17',
  '11/17/2026',
  '2026-11-17',
];

/** 날짜 모양: 막지 않을 것. */
const DATE_ALLOWED = [
  '3 weeks',
  '3주',
  '2 days',
  '영업일 3일 안에',
  'next week',
  '다음 주',
  'in two weeks',
  'tomorrow',
  'November',
  '11월',
  '10-15 days',
  '2026년',
  'Monday',
  '1개',
  '2 items',
];

/** 추적번호 모양: 막을 것 (영문 대문자 + 숫자, 10자 이상). */
const TRACKING_BLOCKED = [
  '1Z999AA10123456784',
  'EE123456789KR',
  'LY123456789CN',
  'RR123456789US',
  'CP123456789KR',
  'ABC1234567',
  'A123456789',
  'XY1234567890',
  '7LZ12345678',
  'TRACK12345678',
  '1Z2345678901234567',
  'Tracking: EE123456789KR',
];

/** 추적번호 모양: 막지 않을 것. */
const TRACKING_ALLOWED = [
  'ABCDEFGHIJ',
  'INTERNATIONAL',
  'DELIVERED',
  '1234567890',
  'ABC123',
  'EE12345KR',
  'abc1234567890',
  'tracking number',
  'USPS',
  'DHL EXPRESS',
  '2 items',
  '우체국 등기',
];

describe('checkTokens: literalFacts 모양 표', () => {
  const tables: [string, string[], string[]][] = [
    ['금액', AMOUNT_BLOCKED, AMOUNT_ALLOWED],
    ['날짜', DATE_BLOCKED, DATE_ALLOWED],
    ['추적번호', TRACKING_BLOCKED, TRACKING_ALLOWED],
  ];

  for (const [name, blocked, allowed] of tables) {
    it(`${name}: 막을 것 ${blocked.length}개`, () => {
      expect(blocked.length).toBeGreaterThanOrEqual(10);
      for (const text of blocked) {
        expect(literalsOf(text), text).not.toEqual([]);
      }
    });

    it(`${name}: 막지 않을 것 ${allowed.length}개`, () => {
      expect(allowed.length).toBeGreaterThanOrEqual(10);
      for (const text of allowed) {
        expect(literalsOf(text), text).toEqual([]);
      }
    });
  }

  it('겹치는 모양은 한 번만 센다', () => {
    expect(literalsOf('환불 $7.20 입니다')).toEqual(['$7.20']);
    expect(literalsOf('USD 7.20 입니다')).toEqual(['USD 7.20']);
  });

  it('여러 개면 나온 순서대로 넣는다', () => {
    expect(literalsOf('11월 17일에 $7.20을 EE123456789KR로 보냈습니다')).toEqual([
      '11월 17일',
      '$7.20',
      'EE123456789KR',
    ]);
  });

  it('토큰과 실행 자리표시자 자리는 사실값으로 세지 않는다', () => {
    expect(literalsOf('⟦TRACKING_1⟧ ⟦AMOUNT_1⟧ {{offerAmount}} {{refundAmount}}')).toEqual([]);
  });
});

describe('checkTokens: 실제 문장은 막히지 않는다', () => {
  /** 네 언어의 전송본 예시. 사실값은 토큰·실행 자리표시자로만 들어 있다. */
  const clean = [
    '안녕하세요. 주문하신 상품은 ⟦DATE_1⟧에 통관을 마쳤습니다. 추적번호 ⟦TRACKING_1⟧로 조회하실 수 있습니다. 배송은 보통 3~5 영업일 걸립니다.',
    'Hello, your order cleared customs on ⟦DATE_1⟧. Tracking: ⟦TRACKING_1⟧. Delivery usually takes 3 to 5 business days.',
    'こんにちは。お荷物は⟦DATE_1⟧に通関しました。追跡番号は⟦TRACKING_1⟧です。配送には3〜5営業日かかります。',
    'Hallo, Ihre Sendung wurde am ⟦DATE_1⟧ verzollt. Sendungsnummer: ⟦TRACKING_1⟧. Die Lieferung dauert in der Regel 3 bis 5 Werktage.',
    '환불 {{refundAmount}}을 오늘 처리했습니다. 2~3 영업일 안에 결제 수단으로 들어갑니다.',
    'I have issued a refund of {{refundAmount}} today. It takes 2 to 3 business days to appear.',
    '주문 2건 중 1개만 도착했다고 들었습니다. 15% 할인 쿠폰을 드리겠습니다.',
  ];

  for (const outgoing of clean) {
    it(`통과: ${outgoing.slice(0, 24)}…`, () => {
      expect(checkTokens(outgoing, outgoing, SC4_FACTS)).toEqual({
        ok: true,
        missing: [],
        extra: [],
        literalFacts: [],
        newPromises: [],
      });
    });
  }
});

describe('checkTokens: literalFacts와 facts 값', () => {
  it('facts의 value가 그대로 적히면 넣는다', () => {
    const facts: FactToken[] = [{ token: '⟦CUSTOMS_STATUS_1⟧', kind: 'CUSTOMS_STATUS', value: '통관 완료' }];
    expect(literalsOf('현재 통관 완료 상태입니다', facts)).toEqual(['통관 완료']);
    expect(literalsOf('현재 통관 중입니다', facts)).toEqual([]);
  });

  it('값의 현지 표기 4개 언어를 모두 찾는다', () => {
    const facts: FactToken[] = [{ token: '⟦DATE_1⟧', kind: 'DATE', value: '2026-11-17' }];
    for (const written of ['2026-11-17', '11월 17일', 'November 17', '11月17日', '17. November']) {
      expect(literalsOf(`통관일은 ${written} 입니다`, facts), written).toContain(written);
    }
  });

  it('값이 이미 현지 표기여도 그대로 찾는다', () => {
    const facts: FactToken[] = [{ token: '⟦AMOUNT_1⟧', kind: 'AMOUNT', value: '$7.20' }];
    expect(literalsOf('환불액은 $7.20 입니다', facts)).toEqual(['$7.20']);
  });

  it('센트 값이 그대로 적히면 넣는다', () => {
    const facts: FactToken[] = [{ token: '⟦AMOUNT_1⟧', kind: 'AMOUNT', value: '720' }];
    expect(literalsOf('내부 값 720 노출', facts)).toEqual(['720']);
    expect(literalsOf('주문번호 7201234', facts)).toEqual([]);
  });
});

describe('checkTokens: 개인통관고유부호', () => {
  it('전송본에 있으면 가린 값으로 넣는다', () => {
    const check = checkTokens('', '개인통관고유부호 P123456789012 로 접수했습니다', []);
    expect(check.literalFacts).toEqual(['P************']);
    expect(JSON.stringify(check)).not.toContain('123456789012');
  });

  it('초안에 있어도 가린 값으로 넣는다', () => {
    const check = checkTokens('PCCC P123456789012 on file', '접수했습니다', []);
    expect(check.literalFacts).toEqual(['P************']);
    expect(JSON.stringify(check)).not.toContain('123456789012');
  });

  it('초안과 전송본에 함께 있어도 한 번만 넣는다', () => {
    const check = checkTokens('P123456789012', 'P123456789012', []);
    expect(check.literalFacts).toEqual(['P************']);
  });
});

describe('fillTokens', () => {
  it('토큰을 값으로 바꾸고 괄호를 남기지 않는다', () => {
    const filled = fillTokens(SC4_OUTGOING, [
      { token: '⟦DATE_1⟧', kind: 'DATE', value: formatFact('DATE', '2026-11-17', 'ko') },
      SC4_FACTS[1],
    ]);
    expect(filled).toBe('고객님의 소포는 11월 17일에 통관을 마쳤습니다. 추적번호: EE123456789KR.');
    expect(filled).not.toMatch(/[⟦⟧]/);
  });

  it('실행 자리표시자는 건드리지 않는다', () => {
    const text = '환불 {{refundAmount}}을 ⟦DATE_1⟧에 보냅니다. {{offerAmount}}';
    const filled = fillTokens(text, [{ token: '⟦DATE_1⟧', kind: 'DATE', value: '11월 17일' }]);
    expect(filled).toBe('환불 {{refundAmount}}을 11월 17일에 보냅니다. {{offerAmount}}');
  });

  it('facts에 없는 토큰이면 예외', () => {
    expect(() => fillTokens(SC4_OUTGOING, [SC4_FACTS[0]])).toThrow('⟦TRACKING_1⟧');
  });

  it('형식 오류가 있으면 예외', () => {
    expect(() => fillTokens('⟦PCCC⟧', SC4_FACTS)).toThrow();
    expect(() => fillTokens('⟦ 반쪽', SC4_FACTS)).toThrow();
  });

  it('예외 문구에 초안 내용을 싣지 않는다', () => {
    try {
      fillTokens('⟦P123456789012⟧ 구매자 메모', SC4_FACTS);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('123456789012');
      expect((error as Error).message).not.toContain('구매자 메모');
    }
  });

  it('사실값에 괄호가 들어 있으면 예외', () => {
    expect(() => fillTokens('⟦DATE_1⟧', [{ token: '⟦DATE_1⟧', kind: 'DATE', value: '⟦DATE_2⟧' }])).toThrow();
  });

  it('토큰이 없으면 그대로 돌려준다', () => {
    expect(fillTokens('토큰 없는 문장', SC4_FACTS)).toBe('토큰 없는 문장');
  });

  it('같은 토큰이 여러 번이면 모두 바꾼다', () => {
    const filled = fillTokens('⟦DATE_1⟧ / ⟦DATE_1⟧', [{ token: '⟦DATE_1⟧', kind: 'DATE', value: '11월 17일' }]);
    expect(filled).toBe('11월 17일 / 11월 17일');
  });
});

describe('formatFact', () => {
  it('DATE: 4개 언어', () => {
    expect(formatFact('DATE', '2026-11-17', 'ko')).toBe('11월 17일');
    expect(formatFact('DATE', '2026-11-17', 'en')).toBe('November 17');
    expect(formatFact('DATE', '2026-11-17', 'ja')).toBe('11月17日');
    expect(formatFact('DATE', '2026-11-17', 'de')).toBe('17. November');
  });

  it('DATE: 앞자리 0을 떼고, 시간대를 쓰지 않는다 (입력 문자열만 본다)', () => {
    expect(formatFact('DATE', '2026-01-05', 'ko')).toBe('1월 5일');
    expect(formatFact('DATE', '2026-01-05', 'en')).toBe('January 5');
    expect(formatFact('DATE', '2026-01-05', 'ja')).toBe('1月5日');
    expect(formatFact('DATE', '2026-01-05', 'de')).toBe('5. Januar');
    expect(formatFact('DATE', '2026-12-31', 'ko')).toBe('12월 31일');
    expect(formatFact('DATE', '2024-02-29', 'en')).toBe('February 29');
  });

  it('DATE: 날짜가 아니면 예외', () => {
    for (const bad of ['2026-11-17T00:00:00Z', '2026.11.17', '26-11-17', '2026-13-01', '2026-02-30', '11월 17일', '']) {
      expect(() => formatFact('DATE', bad, 'ko'), bad).toThrow();
    }
  });

  it('DATE: 점 표기를 만들지 않는다 (실행 층의 금액 검사)', () => {
    // src/exec/message.ts의 금액 모양 검사와 같은 기준. 여기서 만든 문장이 그 검사에 걸리면 전송이 막힌다
    const execLiteralAmount = [
      /[$＄¢₩￦€£¥￥￡]\s*[0-9０-９]/,
      /[0-9０-９]\s*(?:USD|KRW|EUR|GBP|JPY|달러|센트|(?:U\.?\s?S\.?\s?)?(?:dollars?|cents?|bucks?))/i,
      /(?:USD|KRW|EUR|GBP|JPY)\s*[0-9０-９]/i,
      /[0-9０-９][.．][0-9０-９]{2}(?![0-9０-９])/,
    ];
    for (const raw of ['2026-11-17', '2026-01-05', '2026-12-31', '2026-02-28']) {
      for (const locale of ['ko', 'en', 'ja', 'de'] as const) {
        const text = formatFact('DATE', raw, locale);
        for (const pattern of execLiteralAmount) {
          expect(pattern.test(text), `${text} / ${pattern}`).toBe(false);
        }
      }
    }
  });

  it('AMOUNT: 센트 정수를 $7.20으로 (언어 공통)', () => {
    expect(formatFact('AMOUNT', '720', 'ko')).toBe('$7.20');
    expect(formatFact('AMOUNT', '720', 'de')).toBe('$7.20');
    expect(formatFact('AMOUNT', '0', 'en')).toBe('$0.00');
    expect(formatFact('AMOUNT', '7', 'en')).toBe('$0.07');
    expect(formatFact('AMOUNT', '2400', 'en')).toBe('$24.00');
    expect(formatFact('AMOUNT', '123456', 'en')).toBe('$1,234.56');
    expect(formatFact('AMOUNT', '123456789', 'en')).toBe('$1,234,567.89');
  });

  it('AMOUNT: 센트 정수가 아니면 예외', () => {
    for (const bad of ['7.20', '$7.20', '0720', '7 ', '', 'abc']) {
      expect(() => formatFact('AMOUNT', bad, 'en'), bad).toThrow();
    }
  });

  it('TRACKING·CUSTOMS_STATUS는 그대로', () => {
    expect(formatFact('TRACKING', 'EE123456789KR', 'ko')).toBe('EE123456789KR');
    expect(formatFact('CUSTOMS_STATUS', '통관 완료', 'de')).toBe('통관 완료');
  });
});

describe('같은 입력 같은 결과, 입력 불변', () => {
  it('checkTokens를 100회 불러도 결과가 같다', () => {
    const draft = `${SC4_DRAFT} We guarantee delivery. PCCC P123456789012`;
    const outgoing = `${SC4_OUTGOING} 보장합니다. 11월 17일 $7.20 ⟦PCCC⟧ 반드시`;
    const first = checkTokens(draft, outgoing, SC4_FACTS);
    for (let i = 0; i < 100; i += 1) {
      expect(checkTokens(draft, outgoing, SC4_FACTS)).toEqual(first);
    }
  });

  it('입력을 바꾸지 않는다', () => {
    const facts: FactToken[] = SC4_FACTS.map((fact) => Object.freeze({ ...fact }));
    Object.freeze(facts);
    const before = JSON.stringify(facts);
    for (let i = 0; i < 100; i += 1) {
      checkTokens(SC4_DRAFT, SC4_OUTGOING, facts as FactToken[]);
      extractTokens(SC4_OUTGOING);
      fillTokens(SC4_OUTGOING, facts as FactToken[]);
    }
    expect(JSON.stringify(facts)).toBe(before);
  });

  it('fillTokens를 100회 불러도 결과가 같다', () => {
    const first = fillTokens(SC4_OUTGOING, SC4_FACTS);
    for (let i = 0; i < 100; i += 1) expect(fillTokens(SC4_OUTGOING, SC4_FACTS)).toBe(first);
  });
});
