/**
 * 단위 테스트: detectReplyFeatures (SPEC v2.11 8-2장). 작업 T075.
 * 특징마다 영어·한국어 각 1개 이상, 문장 hits, 날짜 꼴, 긴 입력 시간.
 */
import { describe, expect, it } from 'vitest';

import { detectReplyFeatures, splitSentences } from '@/engine/reply-features';
import type { ReplyFeatureKey } from '@/types';

const on = (text: string, key: ReplyFeatureKey) => detectReplyFeatures(text).features[key];

describe('특징별 규칙 (영어·한국어)', () => {
  const cases: [ReplyFeatureKey, string[], string[]][] = [
    ['apology', ['Sorry for the wait.', 'We apologize.'], ['죄송합니다.', '미안해요.'] ],
    ['cause', ['It is held at customs.', 'The colour looks different.'], ['세관에 있어요.', '통관이 늦어요.', '색상 차이예요.'] ],
    ['ask', ['Reply with your code.', 'Please send your PCCC.', 'Send me your customs ID.'], ['통관번호를 알려주세요.', '개인통관고유부호 보내주세요.'] ],
    ['date', ['By November 17.', 'by Nov. 17', 'on Nov 3', 'on 17 November', 'by 11/17', 'by Dec 2'], ['11월 17일까지요.', '11월17일'] ],
    ['blame', ['This is not our responsibility.', 'Please contact customs yourself.'], ['저희 책임이 아니에요.', '세관에 직접 문의하세요.'] ],
    ['vague', ['It should arrive soon.', 'It will come eventually.'], ['곧 도착해요.', '조만간 갈 거예요.'] ],
    ['refundNow', ['I have refunded the full amount.', 'I issued a full refund.'], ['환불해 드렸어요.', '환불 완료했습니다.'] ],
  ];
  for (const [key, en, ko] of cases) {
    it(`${key}: 영어·한국어`, () => {
      for (const t of [...en, ...ko]) expect(on(t, key), t).toBe(true);
    });
  }

  it('걸리지 않는 글', () => {
    const plain = 'Thanks for your order. Have a nice day.';
    const { features } = detectReplyFeatures(plain);
    expect(Object.values(features).every((v) => v === false)).toBe(true);
  });

  it('"refund"라는 말만으로 refundNow가 되지 않는다 (환불 약속 특징 없음)', () => {
    expect(on('We can discuss a refund later.', 'refundNow')).toBe(false);
    expect(Object.keys(detectReplyFeatures('x').features).sort()).toEqual(
      ['apology', 'ask', 'blame', 'cause', 'date', 'lang', 'refundNow', 'vague'].sort(),
    );
  });

  it('날짜 아닌 숫자는 날짜가 아니다', () => {
    expect(on('Order 1234 was shipped.', 'date')).toBe(false);
    expect(on('Version 11/123', 'date')).toBe(false);
    expect(on('You may 2x check.', 'date')).toBe(true); // 알려진 한계: "may 2"는 날짜로 본다
  });
});

describe('lang (구매자 언어)', () => {
  it('한글·가나가 있으면 참, 영어만이면 거짓, translated면 참, 빈 글은 늘 거짓', () => {
    expect(on('안녕하세요', 'lang')).toBe(true);
    expect(on('ありがとうございます', 'lang')).toBe(true);
    expect(on('Hello there', 'lang')).toBe(false);
    expect(detectReplyFeatures('Hello there', { translated: true }).features.lang).toBe(true);
    expect(detectReplyFeatures('   ', { translated: true }).features.lang).toBe(false);
  });
});

describe('hits와 문장 나누기', () => {
  it('특징마다 걸린 첫 문장', () => {
    const { hits } = detectReplyFeatures('Hello. Sorry for the wait! It is at customs. Sorry again.');
    expect(hits.apology).toBe('Sorry for the wait!');
    expect(hits.cause).toBe('It is at customs.');
    expect(hits.blame).toBeUndefined();
  });

  it('"Nov. 17"은 한 문장, 줄바꿈과 。에서 끊는다', () => {
    expect(splitSentences('I will update you by Nov. 17. Thanks.')).toEqual(['I will update you by Nov. 17.', 'Thanks.']);
    expect(splitSentences('하나\n둘。 셋')).toEqual(['하나', '둘。', '셋']);
    expect(splitSentences('')).toEqual([]);
  });

  it('같은 글이면 같은 결과', () => {
    const t = 'Sorry. Customs. Reply with it by 11/17.';
    expect(detectReplyFeatures(t)).toEqual(detectReplyFeatures(t));
  });
});

describe('긴 입력 (이차 시간 금지)', () => {
  const inputs: [string, string][] = [
    ['한 문장 10만 자', 'a'.repeat(100_000)],
    ['공백 10만 자', ' '.repeat(100_000)],
    ['짧은 문장 반복', 'Sorry for the wait. '.repeat(5_000)],
    ['마침표 반복', '.'.repeat(100_000)],
    ['숫자·슬래시 반복', '11/'.repeat(33_000)],
    ['월 이름 반복', 'Nov '.repeat(25_000)],
    ['한국어 반복', '세관에 직접 '.repeat(15_000)],
  ];
  for (const [name, text] of inputs) {
    it(`${name}: 200ms 이내`, () => {
      const t0 = performance.now();
      detectReplyFeatures(text);
      expect(performance.now() - t0).toBeLessThan(200);
    });
  }

  it('길이를 4배로 늘려도 시간이 대략 선형 (16배 미만)', () => {
    const unit = 'Hello there my friend how are you ';
    const time = (n: number) => {
      const text = unit.repeat(n);
      const t0 = performance.now();
      for (let i = 0; i < 3; i += 1) detectReplyFeatures(text);
      return performance.now() - t0;
    };
    time(200); // 데우기
    const small = Math.max(time(750), 1);
    const big = time(3000);
    expect(big / small).toBeLessThan(16);
  });
});
