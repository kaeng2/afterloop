/**
 * 이름 토큰 단위 테스트 (T056, SPEC v2.9 3장 "이름 토큰"). LLM을 부르지 않는다.
 */
import { describe, expect, it } from 'vitest';

import { BUYER_NAME_TOKEN, SELLER_NAME_TOKEN, loadReplyNames, nameFacts, nameFactsPair } from '@/ai/names';
import { checkTokens, extractTokens, fillTokens, formatFact } from '@/ai/tokens';
import type { ReplyNames } from '@/types';

/** 테스트 데이터. `config/rules.json`과 같은 값이지만 단위 테스트는 설정 파일에 기대지 않는다. */
const NAMES: ReplyNames = {
  sellerSignature: 'Hannah, Fernwood Knits',
  buyers: {
    B01: { en: 'Seo-yeon', ko: '서연 님' },
    B02: { en: 'Ji-ho', ko: '지호 님' },
    B09: { en: 'Only English' },
  },
};

const SELLER = { token: '⟦SELLER_NAME_1⟧', kind: 'SELLER_NAME', value: 'Hannah, Fernwood Knits' };

describe('토큰 문법', () => {
  it('⟦BUYER_NAME_1⟧·⟦SELLER_NAME_1⟧은 올바른 토큰이다', () => {
    expect(extractTokens('Hello ⟦BUYER_NAME_1⟧, … ⟦SELLER_NAME_1⟧')).toEqual(['⟦BUYER_NAME_1⟧', '⟦SELLER_NAME_1⟧']);
    expect(BUYER_NAME_TOKEN).toBe('⟦BUYER_NAME_1⟧');
    expect(SELLER_NAME_TOKEN).toBe('⟦SELLER_NAME_1⟧');
  });

  it('번호 없는 꼴·앞자리 0·모르는 종류는 토큰이 아니다', () => {
    expect(extractTokens('⟦BUYER_NAME⟧ ⟦BUYER_NAME_01⟧ ⟦NAME_1⟧')).toEqual([]);
  });

  it('formatFact: 이름 종류는 값을 그대로 돌려준다', () => {
    for (const locale of ['en', 'ko', 'ja', 'de'] as const) {
      expect(formatFact('BUYER_NAME', '서연 님', locale)).toBe('서연 님');
      expect(formatFact('SELLER_NAME', 'Hannah, Fernwood Knits', locale)).toBe('Hannah, Fernwood Knits');
    }
  });

  it('checkTokens: 이름 토큰 개수가 다르면 missing·extra', () => {
    const facts = nameFacts({ names: NAMES, buyerId: 'B01', locale: 'ko' });
    const draft = 'Hello ⟦BUYER_NAME_1⟧, thanks.\n⟦SELLER_NAME_1⟧';
    expect(checkTokens(draft, '안녕하세요, 감사합니다.\n⟦SELLER_NAME_1⟧', facts).missing).toEqual(['⟦BUYER_NAME_1⟧']);
    const doubled = checkTokens(draft, '안녕하세요 ⟦BUYER_NAME_1⟧, ⟦BUYER_NAME_1⟧.\n⟦SELLER_NAME_1⟧', facts);
    expect(doubled.extra).toEqual(['⟦BUYER_NAME_1⟧']);
    expect(doubled.ok).toBe(false);
  });

  it('checkTokens: 이름 값 글자는 직접 쓴 사실값이 아니다', () => {
    const facts = nameFacts({ names: NAMES, buyerId: 'B01', locale: 'ko' });
    const check = checkTokens('Hello Seo-yeon. Hannah, Fernwood Knits', '서연 님 안녕하세요. Hannah, Fernwood Knits', facts);
    expect(check.literalFacts).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it('fillTokens가 이름 값을 채운다', () => {
    const facts = nameFacts({ names: NAMES, buyerId: 'B01', locale: 'ko' });
    expect(fillTokens('안녕하세요 ⟦BUYER_NAME_1⟧,\n⟦SELLER_NAME_1⟧', facts)).toBe('안녕하세요 서연 님,\nHannah, Fernwood Knits');
  });
});

describe('nameFacts', () => {
  it('B01 + en → "Seo-yeon"과 서명', () => {
    expect(nameFacts({ names: NAMES, buyerId: 'B01', locale: 'en' })).toEqual([
      { token: '⟦BUYER_NAME_1⟧', kind: 'BUYER_NAME', value: 'Seo-yeon' },
      SELLER,
    ]);
  });

  it('B01 + ko → "서연 님"', () => {
    expect(nameFacts({ names: NAMES, buyerId: 'B01', locale: 'ko' })).toEqual([
      { token: '⟦BUYER_NAME_1⟧', kind: 'BUYER_NAME', value: '서연 님' },
      SELLER,
    ]);
  });

  it('B04(buyer_m)처럼 표에 없는 구매자 → 서명만', () => {
    expect(nameFacts({ names: NAMES, buyerId: 'B04', locale: 'ko' })).toEqual([SELLER]);
  });

  it('buyerId 없음 → 서명만', () => {
    expect(nameFacts({ names: NAMES, locale: 'en' })).toEqual([SELLER]);
  });

  it('그 언어 꼴이 없음 → 서명만', () => {
    expect(nameFacts({ names: NAMES, buyerId: 'B01', locale: 'ja' })).toEqual([SELLER]);
  });

  it('상속 키(toString 등)를 구매자로 읽지 않는다', () => {
    expect(nameFacts({ names: NAMES, buyerId: 'toString', locale: 'en' })).toEqual([SELLER]);
    expect(nameFacts({ names: NAMES, buyerId: '__proto__', locale: 'en' })).toEqual([SELLER]);
  });

  it('입력을 바꾸지 않는다', () => {
    const before = JSON.stringify(NAMES);
    nameFacts({ names: NAMES, buyerId: 'B01', locale: 'ko' });
    nameFactsPair({ names: NAMES, buyerId: 'B01', draftLocale: 'en', outgoingLocale: 'ko' });
    expect(JSON.stringify(NAMES)).toBe(before);
  });
});

describe('nameFactsPair', () => {
  it('두 언어 꼴이 다 있으면 토큰 이름은 같고 값만 다르다', () => {
    const pair = nameFactsPair({ names: NAMES, buyerId: 'B01', draftLocale: 'en', outgoingLocale: 'ko' });
    expect(pair.draft.map((fact) => fact.token)).toEqual(pair.outgoing.map((fact) => fact.token));
    expect(pair.draft[0].value).toBe('Seo-yeon');
    expect(pair.outgoing[0].value).toBe('서연 님');
  });

  it('전송본 언어 꼴이 없으면 양쪽 모두 구매자 이름 토큰이 없다', () => {
    const pair = nameFactsPair({ names: NAMES, buyerId: 'B09', draftLocale: 'en', outgoingLocale: 'ko' });
    expect(pair).toEqual({ draft: [SELLER], outgoing: [SELLER] });
  });

  it('영어 꼴이 없으면 양쪽 모두 구매자 이름 토큰이 없다', () => {
    const names: ReplyNames = { ...NAMES, buyers: { B10: { ko: '하나 님' } } };
    const pair = nameFactsPair({ names, buyerId: 'B10', draftLocale: 'en', outgoingLocale: 'ko' });
    expect(pair).toEqual({ draft: [SELLER], outgoing: [SELLER] });
  });

  it('표에 없는 구매자 → 양쪽 서명만', () => {
    const pair = nameFactsPair({ names: NAMES, buyerId: 'B04', draftLocale: 'en', outgoingLocale: 'ko' });
    expect(pair).toEqual({ draft: [SELLER], outgoing: [SELLER] });
  });

  it('영어 구매자 (초안 = 전송본 언어)', () => {
    const pair = nameFactsPair({ names: NAMES, buyerId: 'B09', draftLocale: 'en', outgoingLocale: 'en' });
    expect(pair.draft).toEqual(pair.outgoing);
    expect(pair.outgoing[0].value).toBe('Only English');
  });
});

describe('loadReplyNames', () => {
  it('실제 설정(config/rules.json의 reply.names)을 통과한다', () => {
    const names = loadReplyNames();
    expect(names.sellerSignature.length).toBeGreaterThan(0);
    expect(Object.keys(names.buyers).length).toBeGreaterThan(0);
  });

  it('sellerSignature가 빈 글이면 예외', () => {
    expect(() => loadReplyNames({ sellerSignature: '', buyers: {} })).toThrow();
    expect(() => loadReplyNames({ sellerSignature: '   ', buyers: {} })).toThrow();
  });

  it('모양이 틀리면 예외', () => {
    const broken: unknown[] = [
      null,
      { buyers: {} }, // 서명 없음
      { sellerSignature: 'H' }, // buyers 없음
      { sellerSignature: 'H', buyers: { B01: { ko: '' } } }, // 빈 이름
      { sellerSignature: 'H', buyers: { B01: { ko: 'buyer_m***' } } }, // 마스킹된 아이디
      { sellerSignature: 'H', buyers: { B01: { ko: '⟦DATE_1⟧' } } }, // 토큰 괄호
      { sellerSignature: '{{offerAmount}}', buyers: {} }, // 실행 자리표시자
      { sellerSignature: 'H', buyers: { B01: { ko: 3 } } }, // 글이 아니다
    ];
    for (const source of broken) expect(() => loadReplyNames(source)).toThrow();
  });
});
