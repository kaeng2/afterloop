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
      // 재시도: 원래 초안은 `100% safe`였다. `100%`는 뒤에 보장류 낱말이 올 때만 약속이므로
      // (`100% wool` 같은 상품 설명이 약속 표현의 면죄부가 되지 않게) 같은 뜻 묶음은 `definitely`로 본다
      ['definitely delivered', '무조건 괜찮습니다'],
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

// ───────────────────────────── 재시도 (검증 보고서 2026-11-09 23:24 KST) ─────────────────────────────

/** 문제 1: 수 뒤에 통화 기호·낱말을 적은 표기, 쉼표 소수, 글로 쓴 수 + 통화 낱말. */
const AMOUNT_AFTER_BLOCKED = [
  '24 $',
  '24$',
  '7 $',
  '7,20 $',
  '24,00 $',
  '24,- $',
  '24 US$',
  '24 €',
  '24€',
  '24,00 €',
  '24 US-Dollar',
  '24,00 US-Dollar',
  '24米ドル',
  '7USドル',
  '24불',
  '24 US달러',
  '24 미국 달러',
  '7,20',
  'seven dollars',
  'twenty-four dollars',
  '칠 달러',
  '七ドル',
  'sieben Dollar',
];

/** 문제 1의 모양을 더해도 막지 않을 것 (문제 3의 통화 낱말 오탐과 같은 자리). */
const AMOUNT_AFTER_ALLOWED = [
  '60 centimeters',
  '96 centimeters',
  '30 centimeter',
  '2 europäische Länder',
  '사이즈 2 원하시면',
  '3 원단',
  '3 円形',
  '5 bucket',
  '이불을 보내드립니다',
  '사원이 확인했습니다',
  '14 Tage',
  '3 bis 5 Werktage',
  '7〜10日',
  '1サイズ大きめ',
  '15% off',
  '100%',
];

/** 문제 3: 날짜·추적번호 모양의 오탐 (보내지 못하는 쪽). */
const SHAPE_FALSE_POSITIVES = [
  '24/7',
  '3/4 sleeve',
  '1/2',
  '50/50',
  'Size 8 may run small',
  'Item 2 may arrive later',
  'you may 1) return it',
  'Your order of 2 may arrive later',
  'We are available 24/7 for you',
  'The 3/4 sleeve version is in stock',
  'FERNWOOD15',
  'Use code FERNWOOD15 at checkout',
  'WELCOME10',
  'the 2nd order',
  'March 2026',
  'May 2026',
];

/** 문제 2(권장): 이번에 더 잡는 날짜 표기. */
const DATE_MORE_BLOCKED = ['17th of November', 'November the 17th', 'the 17th', '17. Dez', '9. Okt', '十一月十七日', '2026/11/17'];

/** 문제 2에서 일부러 남긴 것: 기간 표현과 모양이 같아 오탐 없이 가릴 수 없다. */
const DATE_STILL_ALLOWED = ['17일', '17日', '11-17', '영업일 3일 안에', '30일 이내', '10-15 days', '3주', '2 days'];

describe('재시도: literalFacts 모양 표', () => {
  const tables: [string, string[], string[]][] = [
    ['수 뒤 통화 표기', AMOUNT_AFTER_BLOCKED, AMOUNT_AFTER_ALLOWED],
    ['날짜 표기', DATE_MORE_BLOCKED, DATE_STILL_ALLOWED],
    ['모양 오탐', [], SHAPE_FALSE_POSITIVES],
  ];

  for (const [name, blocked, allowed] of tables) {
    if (blocked.length > 0) {
      it(`${name}: 막을 것 ${blocked.length}개`, () => {
        for (const text of blocked) {
          expect(literalsOf(`환불 ${text} 처리했습니다`), text).not.toEqual([]);
        }
      });
    }

    it(`${name}: 막지 않을 것 ${allowed.length}개`, () => {
      for (const text of allowed) {
        expect(literalsOf(`안내드립니다 ${text} 참고해 주세요`), text).toEqual([]);
      }
    });
  }

  it('수 뒤 기호·쉼표 소수는 값 전체를 보고한다', () => {
    expect(literalsOf('환불 24,00 $ 처리')).toEqual(['24,00 $']);
    expect(literalsOf('환불 24,00 USD 처리')).toEqual(['24,00 USD']);
    expect(literalsOf('환불 1,234.56 처리')).toEqual(['1,234.56']);
  });

  it('추적번호는 숫자가 6자 이상인 열만 본다', () => {
    expect(literalsOf('쿠폰 FERNWOOD15 를 쓰세요')).toEqual([]);
    expect(literalsOf('추적번호 EE123456789KR 입니다')).toEqual(['EE123456789KR']);
  });

  it('소수 둘째 자리 수는 그대로 막는다 (실행 층도 같은 기준으로 막는다)', () => {
    // 일부러 남긴 오탐이다. 고치면 `7.20`·`24,00` 같은 금액이 함께 빠져나간다
    expect(literalsOf('무게는 0.45 kg 입니다')).not.toEqual([]);
    expect(literalsOf('1인치는 2.54 cm 입니다')).not.toEqual([]);
  });
});

describe('재시도: newPromises', () => {
  it('100%는 뒤에 보장류 낱말이 올 때만 약속이다', () => {
    expect(checkTokens('nothing', 'It is 100% guaranteed.', []).newPromises).toContain('100%');
    expect(checkTokens('nothing', '100% 보장합니다.', []).newPromises).toContain('100%');
    expect(checkTokens('pure wool', 'It is 100% wool.', []).newPromises).toEqual([]);
    expect(checkTokens('nothing', '울 100% 제품입니다.', []).newPromises).toEqual([]);
  });

  it('초안의 상품 설명 100%가 새 약속을 통과시키지 않는다', () => {
    const check = checkTokens('It is 100% wool.', '울 100% 제품입니다. 반드시 내일 도착합니다.', []);
    expect(check.newPromises).toEqual(['반드시']);
    expect(check.ok).toBe(false);
  });

  it('초안에 보장 표현이 있으면 100% 보장은 통과한다', () => {
    expect(checkTokens('We guarantee it.', '100% 보장합니다.', []).newPromises).toEqual([]);
  });

  it('영어·독일어는 낱말 안에 든 약속 표현을 잡지 않는다', () => {
    expect(checkTokens('nothing', 'Let us find a compromise.', []).newPromises).toEqual([]);
    expect(checkTokens('nothing', 'It is delayed indefinitely.', []).newPromises).toEqual([]);
    expect(checkTokens('Let us find a compromise.', '약속드립니다.', []).newPromises).toEqual(['약속드']);
  });

  it('활용형은 그대로 잡는다', () => {
    expect(checkTokens('nothing', 'It is guaranteed.', []).newPromises).toEqual(['guarantee']);
    expect(checkTokens('nothing', 'He promises a refund.', []).newPromises).toEqual(['promise']);
    expect(checkTokens('nothing', 'Das ist garantiert.', []).newPromises).toEqual(['garantier']);
  });

  it('보고 문자열이 밀리지 않는다 (소문자로 바꾸면 길이가 달라지는 글자 뒤)', () => {
    expect(checkTokens('nothing', 'İİİ guarantee', []).newPromises).toEqual(['guarantee']);
  });

  it('일부러 남긴 것: 낱말 경계가 없는 언어는 부분 문자열로 잡는다', () => {
    // 일본어·한국어는 낱말 경계를 쓸 수 없다. `必ずしも`(부분 부정)는 사람이 보고 판단한다
    expect(checkTokens('nothing', '必ずしも届くとは限りません。', []).newPromises).toEqual(['必ず']);
  });
});

describe('재시도: 실행 자리표시자 개수', () => {
  const slots = (draft: string, outgoing: string) => checkTokens(draft, outgoing, []);

  it('초안의 자리표시자가 전송본에서 사라지면 missing', () => {
    const check = slots('I can offer {{offerAmount}} today.', '오늘 제안드립니다.');
    expect(check.missing).toEqual(['{{offerAmount}}']);
    expect(check.ok).toBe(false);
  });

  it('자리표시자가 금액 글자로 바뀌면 missing + literalFacts', () => {
    const check = slots('I can offer {{offerAmount}} today.', 'Ich kann Ihnen heute 24,00 $ anbieten.');
    expect(check.missing).toEqual(['{{offerAmount}}']);
    expect(check.literalFacts).toEqual(['24,00 $']);
    expect(check.ok).toBe(false);
  });

  it('초안에 없던 자리표시자는 extra', () => {
    const check = slots('오늘 제안드립니다.', 'I can offer {{offerAmount}} today.');
    expect(check.extra).toEqual(['{{offerAmount}}']);
    expect(check.ok).toBe(false);
  });

  it('개수까지 비교한다', () => {
    expect(slots('{{offerAmount}} {{offerAmount}}', '{{offerAmount}}').missing).toEqual(['{{offerAmount}}']);
    expect(slots('{{offerAmount}}', '{{offerAmount}} {{offerAmount}}').extra).toEqual(['{{offerAmount}}']);
  });

  it('이름이 바뀌면 missing과 extra에 함께 들어간다', () => {
    const check = slots('Refund {{refundAmount}}.', '{{disputeAmount}}을 환불합니다.');
    expect(check.missing).toEqual(['{{refundAmount}}']);
    expect(check.extra).toEqual(['{{disputeAmount}}']);
  });

  it('이름 양쪽 공백은 실행 층과 같이 무시한다', () => {
    expect(slots('Refund {{refundAmount}} now.', '{{ refundAmount }}을 환불합니다.').ok).toBe(true);
  });

  it('fillTokens는 여전히 자리표시자를 건드리지 않는다', () => {
    const text = '{{offerAmount}}을 ⟦DATE_1⟧에 보냅니다. {{ refundAmount }}';
    const filled = fillTokens(text, [{ token: '⟦DATE_1⟧', kind: 'DATE', value: '11월 17일' }]);
    expect(filled).toBe('{{offerAmount}}을 11월 17일에 보냅니다. {{ refundAmount }}');
  });
});

describe('재시도: 데모 정상 문장은 ok: true', () => {
  const DEMO_FACTS: FactToken[] = [
    { token: '⟦DATE_1⟧', kind: 'DATE', value: '2026-11-17' },
    { token: '⟦TRACKING_1⟧', kind: 'TRACKING', value: 'EE123456789KR' },
    { token: '⟦CUSTOMS_STATUS_1⟧', kind: 'CUSTOMS_STATUS', value: '통관 완료' },
  ];

  /** 초안(판매자가 본 영어) ↔ 전송본(구매자 언어). 사실값은 토큰·실행 자리표시자로만 들어 있다. */
  const demos: [string, string, string][] = [
    [
      '서연 ko 통관 안내',
      'Your parcel cleared customs on ⟦DATE_1⟧ and is on the way. Tracking: ⟦TRACKING_1⟧. Status: ⟦CUSTOMS_STATUS_1⟧. Delivery usually takes 2 to 3 business days after customs.',
      '고객님의 소포는 ⟦DATE_1⟧에 통관을 마치고 배송 중입니다. 추적번호는 ⟦TRACKING_1⟧입니다. 현재 상태는 ⟦CUSTOMS_STATUS_1⟧입니다. 통관 후 보통 2~3 영업일 안에 받으실 수 있습니다.',
    ],
    [
      '서연 ko 통관 안내 (개인통관고유부호 설명)',
      'For customs you need a personal clearance code: the letter P followed by 12 digits. You can get it from the customs website.',
      '통관을 위해 개인통관고유부호가 필요합니다. P로 시작하는 13자리이고, 관세청 홈페이지에서 발급받으실 수 있습니다.',
    ],
    [
      '지호 ko 제안 메시지',
      'I am sorry the color looks different. I can offer a partial refund of {{offerAmount}} and you keep the cardigan.',
      '색상이 달라 보여 불편을 드려 죄송합니다. {{offerAmount}}을 부분 환불로 드리고 가디건은 그대로 사용하시면 어떨까요?',
    ],
    [
      '지호 ko 사이즈 교환 안내',
      'If you want a different size we will send it again. Please tell us the size you want.',
      '원하시는 사이즈로 다시 보내드리겠습니다. 사이즈 2 원하시면 알려 주세요.',
    ],
    [
      'Yuki ja 사이즈 안내',
      'The Oatmeal Cardigan runs small, so one size up is a good idea. The body width is 52 cm and the length is 64 cm.',
      'オートミールカーディガンは小さめなので、1サイズ大きめをおすすめします。身幅は52cm、着丈は64cmです。',
    ],
    [
      'Yuki ja 발송 안내',
      'Your order shipped on ⟦DATE_1⟧. Tracking: ⟦TRACKING_1⟧. International delivery takes 7 to 10 days.',
      'ご注文は⟦DATE_1⟧に発送しました。追跡番号は⟦TRACKING_1⟧です。国際配送には7〜10日かかります。',
    ],
    [
      'Lena de 환불 안내',
      'I have issued a refund of {{refundAmount}} today. It takes 3 to 5 business days to appear on your statement.',
      'Ich habe heute eine Rückerstattung von {{refundAmount}} veranlasst. Es dauert 3 bis 5 Werktage, bis sie auf Ihrer Abrechnung erscheint.',
    ],
    [
      'Lena de 반품 도착 + 환불',
      'Your return arrived on ⟦DATE_1⟧. I am sending the refund of {{refundAmount}} right away.',
      'Ihre Rücksendung ist am ⟦DATE_1⟧ angekommen. Ich veranlasse die Rückerstattung von {{refundAmount}} sofort.',
    ],
  ];

  for (const [name, draft, outgoing] of demos) {
    it(`통과: ${name}`, () => {
      expect(checkTokens(draft, outgoing, DEMO_FACTS)).toEqual({
        ok: true,
        missing: [],
        extra: [],
        literalFacts: [],
        newPromises: [],
      });
    });
  }

  it('같은 문장에 값을 직접 적으면 막는다', () => {
    const [, draft, outgoing] = demos[0];
    const literal = outgoing.replace('⟦DATE_1⟧', '11월 17일').replace('⟦TRACKING_1⟧', 'EE123456789KR');
    const check = checkTokens(draft, literal, DEMO_FACTS);
    expect(check.missing).toEqual(['⟦DATE_1⟧', '⟦TRACKING_1⟧']);
    expect(check.literalFacts).toEqual(['11월 17일', 'EE123456789KR']);
    expect(check.ok).toBe(false);
  });

  it('제안 금액을 독일어식으로 직접 적으면 막는다', () => {
    const check = checkTokens(demos[6][1], demos[6][2].replace('{{refundAmount}}', '24,00 $'), DEMO_FACTS);
    expect(check.missing).toEqual(['{{refundAmount}}']);
    expect(check.literalFacts).toEqual(['24,00 $']);
    expect(check.ok).toBe(false);
  });
});

// ───────────────────────────── T031 (재검증 보고서의 새 문제 ①②③) ─────────────────────────────

/**
 * **통과해야 하는 한국어 문장.** 서연·지호에게 보낼 법한 말투로 쓴다.
 * 한국어 답장이 데모의 핵심 장면이므로, 이 표가 막히면 전송 버튼이 꺼져 데모가 멈춘다.
 * 앞 세 문장은 재검증 보고서가 "새로 막힘"으로 적은 문장이다.
 */
const KO_CLEAN_SENTENCES = [
  '색상이 불만족스러우셨다면 정말 죄송합니다.',
  '이번 일이 원만히 해결되기를 바랍니다.',
  '고객님이 불이익을 받지 않도록 하겠습니다.',
  '불편을 드려 죄송합니다.',
  '불만족스러우셨다면 말씀해 주세요.',
  '이 불량 건은 새 상품으로 교환해 드리겠습니다.',
  '원만히 해결되도록 돕겠습니다.',
  '원하시면 교환해 드리겠습니다.',
  '원래 색상은 오트밀입니다.',
  '이 원단은 메리노 울 혼방입니다.',
  '일이 원활하게 진행되고 있습니다.',
  '고객님이 원하시는 사이즈로 다시 보내드리겠습니다.',
  '사이즈 2 원하시면 알려 주세요.',
  '한 번 더 확인해 보겠습니다.',
  '이번 주 안에 답변드리겠습니다.',
  '삼일 안에 답변드리겠습니다.',
  '이 일로 불편을 드려 죄송합니다.',
  '만약 원하신다면 반품도 가능합니다.',
  '천천히 확인해 보시고 알려 주세요.',
  '오 분 정도 걸립니다.',
  '십 분 뒤에 다시 확인해 주세요.',
  '이만 줄이겠습니다. 좋은 하루 보내세요.',
  '백 퍼센트 울 제품입니다.',
  '배송이 불과 3일 만에 끝났습니다.',
  '택배 기사 불만 접수는 택배사에서 처리합니다.',
  '택배사 불만은 저희가 대신 전달하겠습니다.',
  '주문 2 불만 사항을 확인했습니다.',
  '사이즈 1 원만하게 교환해 드리겠습니다.',
  '문의하신 사항이 원만하게 해결되도록 돕겠습니다.',
  '고객님이 불만을 느끼셨다면 사과드립니다.',
  '혹시 이 불만 사항이 해결되지 않으면 알려 주세요.',
  '담당 사원이 확인했습니다.',
  '포근한 이불을 함께 보내드립니다.',
  '3 원단 샘플을 먼저 보내드릴까요?',
  '원인을 확인하고 바로 알려 드리겠습니다.',
  '불가피하게 발송이 늦어졌습니다.',
  '불량품은 왕복 배송비 없이 교환해 드립니다.',
  '이 불편이 반복되지 않도록 하겠습니다.',
  '구김이 불규칙하게 생겼다면 다림질을 권합니다.',
  '사십 분 안에 처리해 드리겠습니다.',
];

/**
 * **계속 막아야 하는 금액 표기.** T010 검증 보고서 1차·재검증의 "막혀야 하는 표기"를 한국어 중심으로 모았다
 * (라틴·일본어 표기는 위 `AMOUNT_BLOCKED`·`AMOUNT_AFTER_BLOCKED` 표가 계속 지킨다).
 */
const KO_AMOUNT_BLOCKED = [
  '24불',
  '24 불',
  '7불',
  '24불 정도',
  '24,000원',
  '24000 원',
  '9600원',
  '24,000원이',
  '9,600원을',
  '2만 4천원',
  '2만 원',
  '만 원',
  '이만 사천 원',
  '삼십 달러',
  '칠 달러',
  '이십사 달러',
  '24달러',
  '24 달러',
  '24 US달러',
  '24 미국 달러',
  '7달러',
  '7.20달러',
  '₩9,600',
  '24,000 KRW',
  '24ドル',
  '七ドル',
  '二十四ドル',
  '$24',
  '24 $',
  '24,00 $',
  '24 US-Dollar',
  '7米ドル',
  'USD 7.20',
  'seven dollars',
  'sieben Dollar',
  'twenty-four dollars',
];

describe('T031: 한국어 정상 문장 / 금액 표기', () => {
  it(`통과해야 하는 한국어 문장 ${KO_CLEAN_SENTENCES.length}개`, () => {
    expect(KO_CLEAN_SENTENCES.length).toBeGreaterThanOrEqual(30);
    for (const text of KO_CLEAN_SENTENCES) {
      expect(literalsOf(text), text).toEqual([]);
      expect(checkTokens(text, text, []).ok, text).toBe(true);
    }
  });

  it(`막아야 하는 금액 표기 ${KO_AMOUNT_BLOCKED.length}개 (모양만 / 문장 속 둘 다)`, () => {
    for (const text of KO_AMOUNT_BLOCKED) {
      expect(literalsOf(text), text).not.toEqual([]);
      expect(literalsOf(`오늘 ${text} 환불해 드렸습니다`), text).not.toEqual([]);
    }
  });

  it('한글 통화 낱말: 숫자가 바로 붙으면 조사가 와도 금액으로 본다', () => {
    // 조사는 전방탐색으로만 확인하므로 보고 문자열에는 들어가지 않는다
    expect(literalsOf('24,000원만 결제해 주세요')).toEqual(['24,000원']);
    expect(literalsOf('24불이 환불되었습니다')).toEqual(['24불']);
    expect(literalsOf('9,600원을 환불했습니다')).toEqual(['9,600원']);
  });

  it('한글 통화 낱말: 수와 떨어져 있으면 낱말인지 가린다', () => {
    expect(literalsOf('주문 2 불만 사항')).toEqual([]);
    expect(literalsOf('사이즈 1 원만하게')).toEqual([]);
    expect(literalsOf('24 불 환불')).toEqual(['24 불']);
    expect(literalsOf('24000 원 환불')).toEqual(['24000 원']);
  });

  it('한글 수 + 원: 두 글자 이상이거나 자릿수 낱말일 때만', () => {
    expect(literalsOf('이만 사천 원')).toEqual(['사천 원']);
    expect(literalsOf('만 원')).toEqual(['만 원']);
    expect(literalsOf('이 원단은 부드럽습니다')).toEqual([]);
    expect(literalsOf('사원이 확인했습니다')).toEqual([]);
  });

  it('쉼표 소수 뒤에 길이·무게 단위가 오면 금액이 아니다', () => {
    for (const text of ['1,50 m', '2,54 cm', '0,45 kg', '1,50m', '52,50 cm', '0,75 l']) {
      expect(literalsOf(`Die Maße: ${text} insgesamt`), text).toEqual([]);
    }
    // 통화가 붙거나 단위가 없으면 그대로 금액 후보다
    expect(literalsOf('24,00 $')).toEqual(['24,00 $']);
    expect(literalsOf('24,00 USD')).toEqual(['24,00 USD']);
    expect(literalsOf('환불 24,00 처리')).toEqual(['24,00']);
    // 점 소수는 그대로 막는다 (실행 층과 같은 기준)
    expect(literalsOf('0.45 kg')).not.toEqual([]);
  });
});

describe('T031: 실행 자리표시자 안의 개인통관고유부호', () => {
  const PCCC_SLOT = '{{P123456789012}}';

  it('전송본에만 있으면 extra에 가린 이름으로 넣는다', () => {
    const check = checkTokens('code on file', `부호 ${PCCC_SLOT} 접수했습니다`, []);
    expect(check.extra).toEqual(['{{P************}}']);
    expect(JSON.stringify(check)).not.toContain('123456789012');
    expect(check.ok).toBe(false);
  });

  it('초안에만 있으면 missing에 가린 이름으로 넣는다', () => {
    const check = checkTokens(`code ${PCCC_SLOT}`, '접수했습니다', []);
    expect(check.missing).toEqual(['{{P************}}']);
    expect(JSON.stringify(check)).not.toContain('123456789012');
  });

  it('이름에 다른 글자가 섞여 있어도 부호만 가린다', () => {
    const check = checkTokens('', '{{pccc P123456789012}}', []);
    expect(check.extra).toEqual(['{{pccc P************}}']);
    expect(JSON.stringify(check)).not.toContain('123456789012');
  });

  it('양쪽에 같은 개수로 있으면 literalFacts만 가린 값으로 남는다', () => {
    const check = checkTokens(`a ${PCCC_SLOT}`, `가 ${PCCC_SLOT}`, []);
    expect(check.missing).toEqual([]);
    expect(check.extra).toEqual([]);
    expect(check.literalFacts).toEqual(['P************']);
    expect(JSON.stringify(check)).not.toContain('123456789012');
  });
});

describe('T031: 100%만 있는 약속', () => {
  /** 재료·성분 낱말이 둘레에 있으면 상품 설명이다. */
  const PERCENT_MATERIAL = [
    '100% wool',
    '100% 울',
    '100 % Baumwolle',
    '울 100%입니다',
    '100%綿です',
    '100% コットン',
    '100% cotton blend',
    'zu 100 % aus Wolle',
    '１００％ 울 제품',
    '100% 캐시미어',
    '100% 순면 소재',
    '100% Merinowolle',
  ];

  /** 그 밖의 `100%`는 약속 표현이다. */
  const PERCENT_PROMISE = [
    '100% 환불해 드립니다',
    '100% 보장',
    'I am 100% sure it will arrive tomorrow',
    '100% 내일 도착합니다',
    '100%届きます',
    'Es kommt zu 100 % sicher morgen an',
    'It is 100% guaranteed',
    '１００％ 보장합니다',
    '100 % 환불',
    '100% 책임지겠습니다',
  ];

  it(`재료 낱말이 함께 오면 약속이 아니다 (${PERCENT_MATERIAL.length}개)`, () => {
    for (const text of PERCENT_MATERIAL) {
      expect(checkTokens('nothing here', text, []).newPromises, text).toEqual([]);
    }
  });

  it(`그 밖의 100%는 새 약속이다 (${PERCENT_PROMISE.length}개)`, () => {
    for (const text of PERCENT_PROMISE) {
      expect(checkTokens('nothing here', text, []).newPromises, text).not.toEqual([]);
    }
  });

  it('초안에 같은 뜻의 약속이 있으면 통과한다', () => {
    expect(checkTokens('We guarantee a full refund.', '100% 환불해 드립니다.', []).newPromises).toEqual([]);
    expect(checkTokens('I am 100% sure.', '보장합니다.', []).newPromises).toEqual([]);
  });

  it('초안의 상품 설명 100%는 새 약속을 통과시키지 않는다', () => {
    const check = checkTokens('It is 100% wool.', '울 100% 제품입니다. 100% 환불해 드립니다.', []);
    expect(check.newPromises).toEqual(['100%']);
    expect(check.ok).toBe(false);
  });
});

// ───────────────────── T031 재시도 (검증 보고서 2026-11-10 00:40 KST의 문제 1·2·3) ─────────────────────

/** 검증 보고서가 "자리표시자는 그대로 둔 채 금액 문장을 덧붙이면 통과한다"고 적은 운반 문장. */
const CARRIER_DRAFT = 'I refunded {{refundAmount}} to you today. It usually shows up within 3 to 5 business days.';
const CARRIER_BODY = '지호 님, 오늘 {{refundAmount}}을 환불해 드렸습니다. 보통 영업일 기준 3~5일 안에 표시됩니다.';

/** 덧붙인 문장만 바꿔 검사한다 (자리표시자 개수는 그대로이므로 `missing`·`extra`가 비어 있다). */
function appended(sentence: string) {
  return checkTokens(CARRIER_DRAFT, `${CARRIER_BODY} ${sentence}`, []);
}

/**
 * **문제 1: 띄어 쓴 금액 + 조사 `이`·`만`·`과`.** 검증 보고서의 12문장 그대로.
 * 기준 코드(`d9f626f`)는 모두 막았고 T031 1차에서 통과하게 됐다.
 */
const SPACED_AMOUNT_BLOCKED = [
  '오늘 삼만 원이 환불됩니다.',
  '이만 사천 원이 환불될 예정입니다.',
  '이번에는 삼만 원만 환불해 드립니다.',
  '삼만 원과 배송비를 함께 돌려 드립니다.',
  '24 불이 환불됩니다.',
  '24 불만 환불해 드립니다.',
  '24 불과 배송비를 돌려 드립니다.',
  '24,000 원이 환불됩니다.',
  '24000 원만 환불해 드립니다.',
  '2만 원이 환불됩니다.',
  '만 원이 환불됩니다.',
  '2만 4천 원이 환불됩니다.',
  // 지시서가 더 든 꼴
  '24,000 원과 배송비를 돌려 드립니다.',
  '2만 원만 환불해 드립니다.',
  '만 원과 배송비를 돌려 드립니다.',
  '이만 사천 원이 들어갑니다.',
];

/**
 * **조사 뒤에 한글이 이어지면 낱말이다.** 검증 보고서가 통과로 확인한 문장과 지시서가 든 낱말
 * (`원만히`·`불만족`·`원이름`). 한 글자 수사 + `불`(`칠 불`)은 지시서 1항대로 계속 통과한다.
 */
const SPACED_WORD_ALLOWED = [
  '이번 일이 원만히 해결되기를 바랍니다.',
  '색상이 불만족스러우셨다면 정말 죄송합니다.',
  '이 제품의 원이름은 그대로 두었습니다.',
  '고객님이 불이익을 받지 않도록 하겠습니다.',
  '문의하신 사항이 원만하게 해결되도록 돕겠습니다.',
  '배송이 불과 3일 만에 끝났습니다.',
  '택배 기사 불만 접수는 택배사에서 처리합니다.',
  '혹시 이 불만 사항이 해결되지 않으면 알려 주세요.',
  '주문 2 불만 사항을 확인했습니다.',
  '사이즈 1 원만하게 교환해 드리겠습니다.',
  '만약 원하신다면 반품도 가능합니다.',
  '교환 만 원하시면 알려 주세요.',
  '천천히 원하시는 대로 알려 주세요.',
  '담당 사원이 확인했습니다.',
  '포근한 이불을 함께 보내드립니다.',
  '이 원단은 메리노 울 혼방입니다.',
  '백 퍼센트 울 제품입니다.',
  '이만 줄이겠습니다. 좋은 하루 보내세요.',
  // 지시서 1항·4항대로 그대로 두는 꼴 (한 글자 수사 + `불`)
  '칠 불 정도 차이가 납니다.',
  '오 불 정도입니다.',
];

describe('T031 재시도: 띄어 쓴 금액 뒤의 조사 이·만·과', () => {
  it(`막아야 하는 문장 ${SPACED_AMOUNT_BLOCKED.length}개`, () => {
    for (const sentence of SPACED_AMOUNT_BLOCKED) {
      const check = appended(sentence);
      expect(check.literalFacts, sentence).not.toEqual([]);
      expect(check.ok, sentence).toBe(false);
      // 자리표시자를 건드리지 않았으므로 막는 이유는 금액 글자뿐이다
      expect(check.missing, sentence).toEqual([]);
      expect(check.extra, sentence).toEqual([]);
    }
  });

  it(`통과해야 하는 문장 ${SPACED_WORD_ALLOWED.length}개`, () => {
    for (const sentence of SPACED_WORD_ALLOWED) {
      expect(literalsOf(sentence), sentence).toEqual([]);
      expect(appended(sentence).ok, sentence).toBe(true);
    }
  });

  it('조사 바로 뒤가 한글이 아닐 때만 통화의 조사로 본다', () => {
    expect(literalsOf('오늘 삼만 원이 환불됩니다.')).toEqual(['삼만 원']);
    expect(literalsOf('이 상품 원이름이 더 깁니다.')).toEqual([]);
    expect(literalsOf('24 불만 환불해 드립니다.')).toEqual(['24 불만']);
    expect(literalsOf('색상이 불만족스러우셨다면')).toEqual([]);
    expect(literalsOf('만 원과 배송비를 돌려 드립니다.')).toEqual(['만 원']);
  });

  it('한 글자 수 + 띄어쓰기 + 조사는 수량·목록 번호로 본다 (기존 경계 그대로)', () => {
    expect(literalsOf('주문 2 불만 사항')).toEqual([]);
    expect(literalsOf('사이즈 1 원만하게')).toEqual([]);
    expect(literalsOf('24 불만 환불')).toEqual(['24 불만']);
    expect(literalsOf('2만 원만 환불')).toEqual(['2만 원만']);
  });
});

describe('T031 재시도: 긴 입력에서도 검사가 끝난다', () => {
  /** 정규식 역추적이 터지면 끝나지 않던 입력들 (`{{` + 공백 2만 자에서 멈췄다). */
  const LONG_INPUTS: [string, string][] = [
    ['{{ + 공백 5만 자', `{{${' '.repeat(50000)}`],
    ['⟦ + 글자 5만 자', `⟦${'가'.repeat(50000)}`],
    ['숫자 5만 자', '1'.repeat(50000)],
    ['한글 5만 자', '이만 원이 '.repeat(10000)],
    ['$ + 공백 5만 자', `$${' '.repeat(50000)}`],
    ['보통 문장 5만 자', '안녕하세요. 주문하신 상품은 통관을 마쳤습니다. 배송은 3~5 영업일 걸립니다. '.repeat(1250)],
  ];

  for (const [name, text] of LONG_INPUTS) {
    it(`${name}: 200ms 안에 끝난다`, () => {
      const started = performance.now();
      const check = checkTokens(text, text, []);
      const elapsed = performance.now() - started;
      expect(typeof check.ok, name).toBe('boolean');
      expect(elapsed, `${name}: ${elapsed.toFixed(1)}ms`).toBeLessThan(200);
    });
  }

  it('자리표시자 이름 양쪽 공백은 길어도 같은 이름으로 센다', () => {
    const check = checkTokens('{{offerAmount}}', `{{${' '.repeat(50)}offerAmount${' '.repeat(50)}}}`, []);
    expect(check.missing).toEqual([]);
    expect(check.extra).toEqual([]);
  });
});

describe('T031 재시도: 100% 재료 낱말은 낱말 단위로 본다', () => {
  /** 낱말 안에 든 `울`·`면`을 재료로 읽으면 약속을 놓친다 (검증 보고서 문제 3). */
  const PERCENT_PROMISE_MORE = [
    '서울에 계신 고객님께는 100% 도착합니다.',
    '원하시면 제가 책임지고 꼭 100% 환불해 드립니다.',
    '서울까지 100% 도착합니다.',
    '이 스웨터는 울이지만 100% 환불해 드립니다.',
  ];

  /** 재료 목록에 더한 낱말 (검증 보고서 문제 2). */
  const PERCENT_MATERIAL_MORE = [
    '메리노울 100%입니다.',
    '램스울 100% 제품입니다.',
    '코튼 100% 제품입니다.',
    '100% lambswool',
    '100 % Schurwolle',
    'Er besteht zu 100 % aus Schurwolle.',
    '100% extra fine merino wool',
    '메리노 울 100%입니다.',
    '울 100% 소재입니다.',
  ];

  it(`낱말 안에 든 글자는 재료가 아니다 (${PERCENT_PROMISE_MORE.length}개)`, () => {
    for (const text of PERCENT_PROMISE_MORE) {
      expect(checkTokens('nothing here', text, []).newPromises, text).toEqual(['100%']);
    }
  });

  it(`재료 목록에 더한 낱말은 약속이 아니다 (${PERCENT_MATERIAL_MORE.length}개)`, () => {
    for (const text of PERCENT_MATERIAL_MORE) {
      expect(checkTokens('nothing here', text, []).newPromises, text).toEqual([]);
    }
  });

  it('초안의 재료 설명 100%는 전송본의 새 약속을 통과시키지 않는다', () => {
    expect(checkTokens('It is 100% lambswool.', '램스울 제품입니다. 내일 도착을 보장합니다.', []).newPromises).toEqual([
      '보장',
    ]);
    expect(
      checkTokens('It is 100% lambswool.', 'Es ist Lammwolle. Wir garantieren die Lieferung morgen.', []).newPromises,
    ).toEqual(['garantier']);
  });

  it('초안에 약속으로 쓴 100%가 있으면 전송본의 보장은 그대로 통과한다', () => {
    expect(checkTokens('I am 100% sure it will arrive.', '내일 도착을 보장합니다.', []).newPromises).toEqual([]);
  });
});

describe('T031 재시도 2: 100% 재료 낱말 뒤의 조사·종결', () => {
  /**
   * 재료 문맥 — `100%`에 바로 붙은 재료 낱말 뒤에 조사·종결이 와도 상품 설명이다
   * (재검증 보고서 문제 1. 영어 초안 ↔ 한국어 전송본 짝도 함께 본다).
   */
  const MATERIAL_WITH_PARTICLE: [string, string][] = [
    ['It is 100% wool.', '이 스웨터는 100% 울입니다.'],
    ['This sweater is 100% wool, so it may shrink a little after washing.', '이 스웨터는 100% 울이라 세탁 후 조금 줄어들 수 있습니다.'],
    ['The coat is 100% cashmere.', '소재는 100% 캐시미어입니다.'],
    ['The lining is 100% cotton.', '안감은 100% 면으로 되어 있습니다.'],
    ['It is 100% wool.', '100% 울이에요.'],
    ['It is 100% wool, not a blend.', '혼방이 아니라 100% 울입니다.'],
    ['It is 100% merino wool.', '100% 메리노울이에요.'],
    ['It is 100% cotton.', '100% 면으로 만들었습니다.'],
    ['It is 100% wool.', '100% 울이며 안감은 없습니다.'],
    ['It is 100% wool.', '100% 울로 만들었습니다.'],
    ['It is 100% wool.', '100% 울이라서 손세탁을 권합니다.'],
    ['It is 100% cashmere.', '100% 캐시미어라서 손세탁을 권합니다.'],
    ['It is 100% lambswool.', '100% 램스울입니다.'],
    ['It is 100% cotton.', '100% 코튼입니다.'],
    ['It is 100% cotton.', '100% 순면이에요.'],
    ['nothing here', '소재는 울 100%이고 안감은 면입니다.'],
    ['nothing here', '겉감은 울 80%, 안감은 면 100%입니다.'],
    ['nothing here', '메리노울 100%입니다.'],
    ['nothing here', '100% 울 소재입니다.'],
  ];

  /** 재료 낱말이 `100%`와 떨어져 있거나 낱말 안에 든 글자면 약속이다. */
  const PERCENT_PROMISE_PARTICLE = [
    '이 스웨터는 울이지만 100% 환불해 드립니다.',
    '울로 만든 제품이지만 100% 환불해 드립니다.',
    '면이라 100% 환불됩니다.',
    '서울에 계신 고객님께는 100% 도착합니다.',
    '서울까지 100% 도착합니다.',
    '울산까지 100% 도착합니다.',
    '겨울 전에 100% 도착합니다.',
    '거울처럼 100% 똑같습니다.',
    '원하시면 제가 책임지고 꼭 100% 환불해 드립니다.',
    '면세 한도 안이라 100% 통과합니다.',
    '면목 없지만 100% 환불해 드립니다.',
    '100% 환불해 드립니다. 캐시미어 제품입니다.',
    'I am 100% sure it will arrive tomorrow',
    '100% 내일 도착합니다.',
  ];

  it(`재료 낱말 + 조사·종결은 약속이 아니다 (${MATERIAL_WITH_PARTICLE.length}개)`, () => {
    for (const [draft, outgoing] of MATERIAL_WITH_PARTICLE) {
      const check = checkTokens(draft, outgoing, []);
      expect(check.newPromises, outgoing).toEqual([]);
      expect(check.ok, outgoing).toBe(true);
    }
  });

  it(`재료 낱말이 떨어져 있으면 약속이다 (${PERCENT_PROMISE_PARTICLE.length}개)`, () => {
    for (const text of PERCENT_PROMISE_PARTICLE) {
      expect(checkTokens('nothing here', text, []).newPromises, text).toEqual(['100%']);
    }
  });

  it('재료 문맥인 100%를 빼도 같은 문장의 다른 약속 낱말은 잡는다', () => {
    expect(checkTokens('It is 100% lambswool.', '100% 램스울입니다. 내일 도착을 보장합니다.', []).newPromises).toEqual([
      '보장',
    ]);
    expect(checkTokens('It is 100% wool.', '100% 울입니다. 반드시 내일 도착합니다.', []).newPromises).toEqual(['반드시']);
  });

  it('재료 낱말 앞이 한글이면 재료가 아니다', () => {
    expect(checkTokens('nothing here', '서울 100% 도착합니다.', []).newPromises).toEqual(['100%']);
    expect(checkTokens('nothing here', '100% 울입니다.', []).newPromises).toEqual([]);
  });
});

describe('T031 재시도 2: 천 단위 쉼표 사슬도 선형이다', () => {
  /** 쉼표 뒤마다 수 모양이 다시 시작해 길이의 제곱이 됐다 (5만 자 1.28초. 재검증 보고서 문제 2). */
  const COMMA_CHAINS: [string, string][] = [
    ['000, 사슬 5만 자', '000,'.repeat(12500)],
    ['1,000 사슬 5만 자 + 소수', `1${',000'.repeat(12499)}.5`],
    ['사람이 쓰는 금액 표기 5만 자', '1,234,567 '.repeat(5000)],
  ];

  for (const [name, text] of COMMA_CHAINS) {
    it(`${name}: 200ms 안에 끝난다`, () => {
      const started = performance.now();
      const check = checkTokens(text, text, []);
      const elapsed = performance.now() - started;
      expect(typeof check.ok, name).toBe('boolean');
      expect(elapsed, `${name}: ${elapsed.toFixed(1)}ms`).toBeLessThan(200);
    });
  }

  it('천 단위 쉼표가 든 금액 표기는 그대로 막는다 (묶음 상한을 둔 뒤에도)', () => {
    const blocked: [string, string][] = [
      ['24,000원', '24,000원'],
      ['1,234,567원', '1,234,567원'],
      ['123,456,789,012원', '123,456,789,012원'],
      ['12,345,678.90', '12,345,678.90'],
      ['환불 금액은,24,000원입니다.', '24,000원'],
      ['총액,1,234.56 USD', '1,234.56 USD'],
      ['9,24,000원', '24,000원'],
      ['24,0000원', '0000원'],
    ];
    for (const [text, reported] of blocked) {
      expect(checkTokens('', text, []).literalFacts, text).toEqual([reported]);
    }
  });
});
