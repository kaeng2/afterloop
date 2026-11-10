/**
 * 돈이 드는 약속 찾기 단위 테스트 (T053, SPEC v2.7 3장 "정책 밖 약속 막기").
 *
 * 순수 코드다 — LLM도 네트워크도 설정 파일도 쓰지 않는다.
 * 경계를 표로 적어 둔다 (`tests/unit/tokens.test.ts`와 같은 방식): 잡아야 하는 글과 잡으면 안 되는 글.
 */
import { describe, expect, it } from 'vitest';

import { COMMITMENT_CATEGORIES, findCommitments, type CommitmentCategory } from '@/ai/commitments';
import type { FactLocale } from '@/ai/tokens';

/** 범주 × 언어 낱말 하나씩. 영어는 초안, 나머지는 전송본에서 온 꼴이다. */
const FOUND: { category: CommitmentCategory; locale: FactLocale; text: string }[] = [
  // 환불
  { category: 'refund', locale: 'en', text: 'I will refund the full price.' },
  { category: 'refund', locale: 'en', text: 'You will get your money back.' },
  { category: 'refund', locale: 'en', text: 'I will reimburse you.' },
  { category: 'refund', locale: 'ko', text: '전액 환불해 드릴게요.' },
  { category: 'refund', locale: 'ko', text: '배송비를 환급해 드려요.' },
  { category: 'refund', locale: 'ja', text: '全額返金いたします。' },
  { category: 'refund', locale: 'de', text: 'Sie erhalten eine Rückerstattung.' },
  { category: 'refund', locale: 'de', text: 'Wir erstatten Ihnen den Betrag.' },
  // 재발송
  { category: 'reship', locale: 'en', text: 'I will arrange a reship.' },
  { category: 'reship', locale: 'en', text: 'We will re-ship it to you.' },
  { category: 'reship', locale: 'en', text: 'I will resend the sweater.' },
  { category: 'reship', locale: 'en', text: 'I will send it again.' },
  { category: 'reship', locale: 'en', text: 'I will send a new one.' },
  { category: 'reship', locale: 'en', text: 'I will ship it again.' },
  { category: 'reship', locale: 'ko', text: '재발송해 드릴게요.' },
  { category: 'reship', locale: 'ko', text: '재배송 처리할게요.' },
  { category: 'reship', locale: 'ko', text: '다시 보내 드릴게요.' },
  { category: 'reship', locale: 'ja', text: '再送いたします。' },
  { category: 'reship', locale: 'ja', text: '再発送の手配をします。' },
  { category: 'reship', locale: 'de', text: 'Wir werden den Artikel erneut senden.' },
  { category: 'reship', locale: 'de', text: 'Wir werden ihn neu versenden.' },
  // 교환·대체품
  { category: 'replacement', locale: 'en', text: 'I will send a replacement.' },
  { category: 'replacement', locale: 'en', text: 'I can replace the cardigan.' },
  { category: 'replacement', locale: 'ko', text: '교환해 드릴 수 있어요.' },
  { category: 'replacement', locale: 'ko', text: '대체품을 보내 드려요.' },
  { category: 'replacement', locale: 'ja', text: '交換いたします。' },
  { category: 'replacement', locale: 'de', text: 'Wir schicken einen Ersatz.' },
  { category: 'replacement', locale: 'de', text: 'Sie können den Artikel umtauschen.' },
  // 할인·쿠폰
  { category: 'discount', locale: 'en', text: 'I can give you a discount.' },
  { category: 'discount', locale: 'en', text: 'Here is a coupon for your next order.' },
  { category: 'discount', locale: 'en', text: 'Your next order is 20% off.' },
  { category: 'discount', locale: 'ko', text: '다음 주문에 할인해 드려요.' },
  { category: 'discount', locale: 'ko', text: '쿠폰을 보내 드릴게요.' },
  { category: 'discount', locale: 'ja', text: '次回は割引いたします。' },
  { category: 'discount', locale: 'ja', text: 'クーポンをお送りします。' },
  { category: 'discount', locale: 'de', text: 'Sie bekommen einen Rabatt.' },
  { category: 'discount', locale: 'de', text: 'Wir senden Ihnen einen Gutschein.' },
  // 무료 배송
  { category: 'free_shipping', locale: 'en', text: 'The next order ships with free shipping.' },
  { category: 'free_shipping', locale: 'en', text: 'The shipping on us this time.' },
  { category: 'free_shipping', locale: 'ko', text: '다음에는 무료 배송으로 보내 드려요.' },
  { category: 'free_shipping', locale: 'ko', text: '배송비는 저희가 부담할게요.' },
  { category: 'free_shipping', locale: 'ja', text: '次回は送料無料です。' },
  { category: 'free_shipping', locale: 'de', text: 'Die Lieferung erfolgt als kostenloser Versand.' },
  // 보상·적립
  { category: 'compensation', locale: 'en', text: 'I will compensate you for the delay.' },
  { category: 'compensation', locale: 'en', text: 'I can give you store credit.' },
  { category: 'compensation', locale: 'en', text: 'I will add a credit to your account.' },
  { category: 'compensation', locale: 'ko', text: '보상해 드릴게요.' },
  { category: 'compensation', locale: 'ko', text: '적립금을 넣어 드려요.' },
  { category: 'compensation', locale: 'ja', text: '補償いたします。' },
  { category: 'compensation', locale: 'de', text: 'Wir zahlen eine Entschädigung.' },
  { category: 'compensation', locale: 'de', text: 'Sie erhalten eine Gutschrift.' },
];

/**
 * 약속이 아닌 글. 정상 초안·전송본이 매번 판매자 확인을 받게 되면 화면을 못 쓰므로 여기가 중요하다.
 * `credit card`·`card company`는 구매자가 카드사에 이의제기한다는 말이고(서연 건 구매자 글),
 * `customs clearance code`·`carrier`는 허용한 약속의 낱말이다.
 */
const NOT_FOUND: { locale: FactLocale; text: string }[] = [
  { locale: 'en', text: 'You paid with a credit card, so the bank sees the case too.' },
  { locale: 'en', text: 'Your card company opened this dispute.' },
  { locale: 'en', text: 'Please send your personal customs clearance code.' },
  { locale: 'en', text: 'I will check the status with the carrier and contact you again.' },
  { locale: 'en', text: 'The parcel is held at customs; credit cards are not involved.' },
  { locale: 'ko', text: '카드사에 이의제기하셨다고 들었어요.' },
  { locale: 'ko', text: '운송사에 상황을 확인해서 다시 연락드릴게요.' },
  { locale: 'ko', text: '개인통관고유부호를 알려주시면 바로 전달해 드릴게요.' },
  { locale: 'ja', text: '運送会社に確認してからご連絡します。' },
  { locale: 'de', text: 'Ich frage beim Versanddienstleister nach und melde mich wieder.' },
];

/** T054: 돌려 쓴 약속 (검증이 찾아낸 표현 포함) */
const FOUND_T054: { category: CommitmentCategory; locale: FactLocale; text: string }[] = [
  { category: 'refund', locale: 'en', text: 'I will pay you back.' },
  { category: 'refund', locale: 'en', text: 'We can give you your money back.' },
  { category: 'refund', locale: 'en', text: 'I will return your money.' },
  { category: 'refund', locale: 'ko', text: '돈을 돌려 드릴게요.' },
  { category: 'refund', locale: 'ko', text: '결제하신 금액을 돌려 드리겠습니다.' },
  { category: 'refund', locale: 'ja', text: 'お返しします。' },
  { category: 'refund', locale: 'de', text: 'Wir werden den Betrag zurückzahlen.' },
  { category: 'refund', locale: 'de', text: 'Sie bekommen Ihr Geld zurück.' },
  { category: 'reship', locale: 'en', text: 'I will send you a new sweater.' },
  { category: 'reship', locale: 'en', text: 'I will send it out again.' },
  { category: 'reship', locale: 'en', text: 'I will ship you another.' },
  { category: 'reship', locale: 'en', text: 'I can send another one.' },
  { category: 'reship', locale: 'ko', text: '새 제품을 보내 드릴게요.' },
  { category: 'reship', locale: 'ko', text: '새로 보내 드려요.' },
  { category: 'reship', locale: 'ko', text: '한 번 더 보내 드릴게요.' },
  { category: 'reship', locale: 'ja', text: 'もう一度送ります。' },
  { category: 'reship', locale: 'ja', text: '新しい商品を送ります。' },
  { category: 'reship', locale: 'de', text: 'Wir werden es noch einmal schicken.' },
  { category: 'reship', locale: 'de', text: 'Wir werden es neu schicken.' },
  { category: 'replacement', locale: 'en', text: 'I can swap it for you.' },
  { category: 'replacement', locale: 'en', text: 'I can exchange the item.' },
  { category: 'replacement', locale: 'ko', text: '바꿔 드릴게요.' },
  { category: 'replacement', locale: 'ja', text: '取り替えます。' },
  { category: 'replacement', locale: 'de', text: 'Wir können es austauschen.' },
  { category: 'discount', locale: 'en', text: 'You get 10 percent off.' },
  { category: 'discount', locale: 'en', text: 'Everything is 10% off.' },
  { category: 'discount', locale: 'en', text: 'It is half price now.' },
  { category: 'discount', locale: 'en', text: 'Here is a voucher.' },
  { category: 'discount', locale: 'en', text: 'Use this promo code.' },
  { category: 'discount', locale: 'ko', text: '가격을 깎아 드릴게요.' },
  { category: 'discount', locale: 'ja', text: '割り引きます。' },
  { category: 'discount', locale: 'de', text: 'Wir gewähren einen Nachlass.' },
  { category: 'free_shipping', locale: 'en', text: 'We will cover the shipping.' },
  { category: 'free_shipping', locale: 'en', text: 'I will pay for the shipping.' },
  { category: 'free_shipping', locale: 'en', text: 'The shipping is on us.' },
  { category: 'free_shipping', locale: 'en', text: 'It comes at no extra cost.' },
  { category: 'free_shipping', locale: 'en', text: 'It is free of charge.' },
  { category: 'free_shipping', locale: 'ko', text: '배송비를 저희가 낼게요.' },
  { category: 'free_shipping', locale: 'ko', text: '배송비는 받지 않을게요.' },
  { category: 'free_shipping', locale: 'ko', text: '무료로 보내 드려요.' },
  { category: 'free_shipping', locale: 'ja', text: '送料は当店が負担します。' },
  { category: 'free_shipping', locale: 'de', text: 'Wir werden den Versand übernehmen.' },
  { category: 'compensation', locale: 'en', text: 'I will make it up to you.' },
  { category: 'compensation', locale: 'en', text: 'Here is a gift as an apology.' },
  { category: 'compensation', locale: 'en', text: 'You get a gift card.' },
  { category: 'compensation', locale: 'ko', text: '사은품을 드릴게요.' },
  { category: 'compensation', locale: 'ja', text: 'お詫びの品をお送りします。' },
  { category: 'compensation', locale: 'de', text: 'Als Wiedergutmachung erhalten Sie etwas.' },
];

/** T054: 서연 건 실제 AI 답장 3개와 정상 문장들. 모두 빈 배열이어야 한다. */
const NOT_FOUND_T054: { locale: FactLocale; text: string }[] = [
  {
    locale: 'en',
    text: 'Could you please send me your personal customs clearance code? I will pass it to the carrier as soon as I receive it, and I will check with the carrier and contact you again by ⟦DATE_1⟧.',
  },
  { locale: 'ko', text: '받는 대로 바로 배송업체에 전달하고, 배송업체에 확인한 후 ⟦DATE_1⟧까지 다시 연락드릴게요.' },
  {
    locale: 'ko',
    text: '개인통관고유부호를 답장으로 보내주실 수 있을까요? 받는 대로 바로 택배사에 전달할게요. 또한 택배사에 직접 상황을 확인하고 ⟦DATE_1⟧까지 다시 연락드릴게요.',
  },
  { locale: 'en', text: 'Please send me your code.' },
  { locale: 'en', text: 'I will send you a message.' },
  { locale: 'en', text: 'I will contact you again.' },
  { locale: 'en', text: 'Please reply again.' },
  { locale: 'ko', text: '다시 연락드릴게요.' },
  { locale: 'ko', text: '보내 주실 수 있을까요?' },
  { locale: 'en', text: 'You paid by credit card.' },
  { locale: 'en', text: 'Your card company opened it.' },
  { locale: 'en', text: 'The shipping status is unchanged.' },
  { locale: 'en', text: 'Please check the shipping label.' },
  { locale: 'en', text: 'The exchange rate is not involved.' },
  { locale: 'en', text: 'There are no extra steps.' },
  { locale: 'ko', text: '결정되면 알려 드리겠습니다.' },
  { locale: 'en', text: 'Is there another one?' },
];

describe('findCommitments: T054 돌려 쓴 약속', () => {
  for (const { category, locale, text } of FOUND_T054) {
    it(`${category} (${locale}): ${text}`, () => {
      expect(findCommitments(text, locale)).toContain(category);
    });
  }
  for (const { locale, text } of NOT_FOUND_T054) {
    it(`잡히지 않는다 (${locale}): ${text.slice(0, 40)}`, () => {
      expect(findCommitments(text, locale)).toEqual([]);
    });
  }
  it('2만 자 입력도 100ms 안에 끝난다', () => {
    const inputs = [
      'send '.repeat(4000),
      'pay '.repeat(5000),
      ' '.repeat(20000),
      '새로 '.repeat(6000),
      'at no ' + ' '.repeat(20000),
      'shipping is on' + ' '.repeat(20000),
    ];
    for (const text of inputs) {
      const start = performance.now();
      findCommitments(text, 'en');
      findCommitments(text, 'ko');
      expect(performance.now() - start).toBeLessThan(100);
    }
  });
});

describe('findCommitments: 범주별 낱말 (네 언어)', () => {
  for (const { category, locale, text } of FOUND) {
    it(`${category} (${locale}): ${text}`, () => {
      expect(findCommitments(text, locale)).toContain(category);
    });
  }
});

describe('findCommitments: 약속이 아닌 글', () => {
  for (const { locale, text } of NOT_FOUND) {
    it(`${locale}: ${text}`, () => {
      expect(findCommitments(text, locale)).toEqual([]);
    });
  }
});

describe('findCommitments: 경계', () => {
  it('부정문도 잡는다 (막는 쪽으로 틀린다)', () => {
    expect(findCommitments('We cannot offer a refund for this order.', 'en')).toEqual(['refund']);
    expect(findCommitments('I am afraid a reship is not possible.', 'en')).toEqual(['reship']);
    expect(findCommitments('환불은 어렵습니다.', 'ko')).toEqual(['refund']);
    expect(findCommitments('재발송은 해 드릴 수 없어요.', 'ko')).toEqual(['reship']);
  });

  it('자리표시자·토큰 안의 글자는 보지 않는다', () => {
    expect(findCommitments('The amount {{refundAmount}} is on its way.', 'en')).toEqual([]);
    expect(findCommitments('{{offerAmount}}을 보내 드릴게요.', 'ko')).toEqual([]);
    expect(findCommitments('⟦refund_or_discount⟧ ⟦DATE_1⟧ ⟦AMOUNT_1⟧', 'en')).toEqual([]);
    // 자리표시자 바깥에 적힌 낱말은 그대로 잡는다
    expect(findCommitments('I will refund {{refundAmount}} today.', 'en')).toEqual(['refund']);
  });

  it('자리표시자를 지워도 앞뒤 낱말이 붙지 않는다', () => {
    expect(findCommitments('a{{x}}refund', 'en')).toEqual(['refund']);
    expect(findCommitments('cre{{x}}dit', 'en')).toEqual([]);
  });

  it('낱말 가운데에서는 맞지 않는다 (영어·독일어)', () => {
    expect(findCommitments('Prepaid customs handling is included.', 'en')).toEqual([]);
    expect(findCommitments('Das Paket wurde gestattet.', 'de')).toEqual([]);
  });

  it('여러 범주가 있으면 고정 순서로, 중복 없이 돌려준다', () => {
    const text =
      'I can give you store credit, a discount, free shipping, a replacement, a reship or a refund - ' +
      'and another refund on top.';
    expect(findCommitments(text, 'en')).toEqual([
      'refund',
      'reship',
      'replacement',
      'discount',
      'free_shipping',
      'compensation',
    ]);
    expect(findCommitments(text, 'en')).toEqual([...COMMITMENT_CATEGORIES]);
  });

  it('전송본에 영어 낱말이 남아 있어도 잡는다 (번역이 낱말을 안 옮긴 경우)', () => {
    expect(findCommitments('그때까지 안 오면 refund 처리해 드려요.', 'ko')).toEqual(['refund']);
  });

  it('빈 글과 대소문자', () => {
    expect(findCommitments('', 'en')).toEqual([]);
    expect(findCommitments('   ', 'ko')).toEqual([]);
    expect(findCommitments('A FULL REFUND IS ON ITS WAY', 'en')).toEqual(['refund']);
  });

  it('같은 글을 두 번 봐도 결과가 같다 (정규식 상태를 남기지 않는다)', () => {
    const text = 'I will refund you and send a replacement.';
    expect(findCommitments(text, 'en')).toEqual(findCommitments(text, 'en'));
  });

  it('입력 글을 바꾸지 않는다', () => {
    const text = 'I will refund {{refundAmount}} by ⟦DATE_1⟧.';
    findCommitments(text, 'en');
    expect(text).toBe('I will refund {{refundAmount}} by ⟦DATE_1⟧.');
  });
});

describe('findCommitments: T054 재시도 — 놓친 표현과 나쁜 입력', () => {
  it('놓쳤던 약속 표현을 잡는다', () => {
    expect(findCommitments('I can give you $5 off', 'en')).toEqual(['discount']);
    expect(findCommitments('free return label', 'en')).toEqual(['free_shipping']);
    expect(findCommitments("we'll cover return shipping", 'en')).toEqual(['free_shipping']);
    expect(findCommitments('전액 돌려 드릴게요', 'ko')).toEqual(['refund']);
    expect(findCommitments('新しい商品をお送りします', 'ja')).toEqual(['reship']);
    expect(findCommitments('Wir schicken Ihnen ein neues Paket', 'de')).toEqual(['reship']);
    expect(findCommitments('take 15 percent off', 'en')).toEqual(['discount']);
  });

  it('정상 글은 계속 빈 배열이다', () => {
    expect(findCommitments('The price is $5. Total off the record: 5 items', 'en')).toEqual([]);
    expect(findCommitments('Please send the code again. The return label is attached.', 'en')).toEqual([]);
    expect(findCommitments('Wir schicken Ihnen den Code', 'de')).toEqual([]);
  });

  const BAD: [string, string][] = [
    ['1×20000+percent', '1'.repeat(20000) + ' percent'],
    ['"1 "×10000', '1 '.repeat(10000)],
    ['공백×20000+off', ' '.repeat(20000) + 'off'],
    ['send ×5000', 'send '.repeat(5000)],
    ['a new ×5000', 'a new '.repeat(5000)],
    ['$1×20000', '$' + '1'.repeat(20000)],
    ['1.×10000+percent', '1.'.repeat(10000) + ' percent'],
    ['schick ×5000', 'schick '.repeat(5000)],
  ];
  for (const [name, text] of BAD) {
    it(`나쁜 입력 ${name}: 2만 자급 100ms, 20만 자급 1초 안`, () => {
      for (const [input, limit] of [
        [text, 100],
        [text.repeat(10), 1000],
      ] as const) {
        for (const l of ['en', 'ko', 'ja', 'de'] as const) {
          const t = performance.now();
          findCommitments(input, l);
          expect(performance.now() - t).toBeLessThan(limit);
        }
      }
    });
  }
});
