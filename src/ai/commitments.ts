/**
 * 돈이 드는 약속 찾기 (T053, SPEC v2.7 3장 "정책 밖 약속 막기").
 *
 * AI 초안은 재발송·환불·할인·무료 배송·보상처럼 **판매자에게 돈이 드는 약속을 스스로 만들지 못한다.**
 * 대안으로 쓸 수 있는 것은 판매자 정책(`config/rules.json`의 `reply.allowedCommitments`)에 적힌 것뿐이다.
 * 프롬프트로 지시는 하되(`src/ai/prompts/reply.ts`), **지켜졌는지는 코드가 본다** — 이 파일이 그 자리다
 * (SPEC 3장 "생성과 판정 분리". 실제 AI 시험에서 모델이 스스로 "재발송을 준비하겠다"를 써 왔다).
 *
 * LLM을 부르지 않는 순수 코드다. `Math.random`·`Date`를 읽지 않으므로 같은 입력이면 같은 결과이고,
 * 입력 문자열을 바꾸지 않는다.
 *
 * 막는 쪽으로 틀린다:
 * - 부정문도 잡는다 ("we cannot offer a refund"). 판매자가 화면에서 확인하면 풀리므로, 놓치는 것보다
 *   한 번 더 묻는 쪽이 싸다 (지시서 4번).
 * - 낱말 목록이므로 비슷한 말을 돌려 쓴 약속은 놓칠 수 있다. 그래서 이 함수는 전송을 막는 **한 겹**이고,
 *   판매자가 영어 초안과 역번역을 읽는 것이 마지막 겹이다.
 *
 * 놓치지 않으려고 넓게 잡으면 안 되는 자리도 있다: "credit card"·"card company"는 구매자가 카드사에
 * 이의제기한다는 말이고(서연 건 구매자 글), "customs clearance code"·"carrier"는 허용한 약속의 낱말이다.
 * 그 둘을 약속으로 보면 정상 초안이 매번 판매자 확인을 받아야 해서 화면이 못 쓰게 된다.
 */
import { FACT_LOCALES, type FactLocale } from '@/ai/tokens';

/** 돈이 드는 약속의 범주 (지시서 4번). 고정 순서는 `COMMITMENT_CATEGORIES`다. */
export type CommitmentCategory = 'refund' | 'reship' | 'replacement' | 'discount' | 'free_shipping' | 'compensation';

/** 보고·비교에 쓰는 고정 순서. 화면이 같은 순서로 묻게 하려고 코드가 정해 둔다. */
export const COMMITMENT_CATEGORIES: readonly CommitmentCategory[] = [
  'refund',
  'reship',
  'replacement',
  'discount',
  'free_shipping',
  'compensation',
];

// ───────────────────────────── 낱말 목록 (범주 × 언어) ─────────────────────────────
//
// 영어는 초안(판매자가 읽는 글)용이고, 한국어·일본어·독일어는 전송본(구매자에게 가는 글)용이다.
// 라틴 문자 낱말은 **낱말 앞에서만** 맞춘다 (뒤는 열어 둬서 활용형을 잡는다: `refunded`, `erstattet`).
// 독일어는 어미가 붙으므로 어간으로 적는다 (`erstatt` → `erstatten`·`erstattet`·`Erstattung`).

/** 환불: `refund`, `money back`, `reimburse` / `환불`, `환급` / `返金` / `Rückerstattung`, `erstatten` */
const REFUND_EN = ['refund', 'money back', 'reimburse', 'pay you back', 'return your money'];
const REFUND_KO = ['환불', '환급', '돈을 돌려', '전액 돌려'];
const REFUND_JA = ['返金', 'お返し'];
const REFUND_DE = ['Rückerstatt', 'erstatt', 'zurückzahl', 'Geld zurück'];

/** 재발송: `reship`, `resend`, `send again` … / `재발송`, `재배송`, `다시 보내` / `再送` / `erneut senden` */
// "send it again"·"ship another"처럼 사이에 한 낱말이 끼는 꼴도 적어 둔다. 사이를 정규식으로 열어 두지
// 않는 것은 "please send the code again"(구매자가 통관부호를 다시 보내는 것)을 약속으로 보면
// 정상 초안이 매번 판매자 확인을 받게 되기 때문이다 (A2 답장이 늘 쓰는 문장이다)
const RESHIP_EN = [
  'reship',
  're-ship',
  'resend',
  're-send',
  'send again',
  'send it again',
  'send another',
  'send a new',
  'ship again',
  'ship it again',
  'ship another',
  'ship a new',
  'send you another',
];
const RESHIP_KO = ['재발송', '재배송', '다시 보내', '다시 발송', '다시 배송', '새 제품을 보내', '새로 보내', '한 번 더 보내'];
const RESHIP_JA = ['再送', '再発送', 'もう一度送'];
const RESHIP_DE = [
  'erneut senden',
  'erneut versenden',
  'neu versenden',
  'neu senden',
  'noch einmal schicken',
  'neu schicken',
];

/** 교환·대체품: `replacement`, `replace` / `교환`, `대체품` / `交換` / `Ersatz`, `umtauschen` */
const REPLACEMENT_EN = ['replacement', 'replace', 'swap', 'exchange it', 'exchange the item'];
const REPLACEMENT_KO = ['교환', '대체품', '바꿔 드리', '바꿔 드릴'];
const REPLACEMENT_JA = ['交換', '取り替え'];
const REPLACEMENT_DE = ['Ersatz', 'umtausch', 'Umtausch', 'austausch'];

/** 할인·쿠폰: `discount`, `coupon`, `% off` / `할인`, `쿠폰` / `割引`, `クーポン` / `Rabatt`, `Gutschein` */
const DISCOUNT_EN = [
  'discount',
  'coupon',
  '% off',
  '%off',
  'percent off',
  'half price',
  'money off',
  'voucher',
  'promo code',
];
const DISCOUNT_KO = ['할인', '쿠폰', '깎아'];
const DISCOUNT_JA = ['割引', 'クーポン', '割り引'];
const DISCOUNT_DE = ['Rabatt', 'Gutschein', 'Nachlass'];

/** 무료 배송: `free shipping`, `shipping on us` / `무료 배송`, `배송비는 저희가` / `送料無料` */
const FREE_SHIPPING_EN = [
  'free shipping',
  'free delivery',
  'shipping on us',
  'cover the shipping',
  'pay the shipping',
  'pay for the shipping',
  'shipping is on us',
  'shipping is on me',
  'at no cost',
  'at no extra cost',
  'free of charge',
];
const FREE_SHIPPING_KO = ['무료 배송', '무료배송', '배송비는 저희가', '배송비를 저희가', '배송비는 받지 않', '무료로 보내'];
const FREE_SHIPPING_JA = ['送料無料', '送料は無料', '送料は当店'];
const FREE_SHIPPING_DE = ['kostenloser Versand', 'kostenlosen Versand', 'kostenlose Lieferung', 'Versand übernehm'];

/**
 * 보상·적립: `compensat`, `store credit`, `credit`(낱말 단위) / `보상`, `적립금` / `補償` / `Entschädigung`, `Gutschrift`.
 * `credit`만 낱말 단위로 보고 뒤에 `card`가 오면 약속이 아니다 (`credit card` = 구매자의 카드사 이야기).
 */
const COMPENSATION_EN = ['compensat', 'store credit', 'credit', 'make it up to you', 'as an apology', 'gift card'];
const COMPENSATION_KO = ['보상', '적립금', '사은품'];
const COMPENSATION_JA = ['補償', 'お詫びの品'];
const COMPENSATION_DE = ['Entschädigung', 'entschädig', 'Gutschrift', 'Wiedergutmachung'];

/** 범주 × 언어 낱말 표. 영어는 초안용이고 나머지는 전송본용이다. */
const TERMS: Readonly<Record<CommitmentCategory, Readonly<Record<FactLocale, readonly string[]>>>> = {
  refund: { en: REFUND_EN, ko: REFUND_KO, ja: REFUND_JA, de: REFUND_DE },
  reship: { en: RESHIP_EN, ko: RESHIP_KO, ja: RESHIP_JA, de: RESHIP_DE },
  replacement: { en: REPLACEMENT_EN, ko: REPLACEMENT_KO, ja: REPLACEMENT_JA, de: REPLACEMENT_DE },
  discount: { en: DISCOUNT_EN, ko: DISCOUNT_KO, ja: DISCOUNT_JA, de: DISCOUNT_DE },
  free_shipping: { en: FREE_SHIPPING_EN, ko: FREE_SHIPPING_KO, ja: FREE_SHIPPING_JA, de: FREE_SHIPPING_DE },
  compensation: { en: COMPENSATION_EN, ko: COMPENSATION_KO, ja: COMPENSATION_JA, de: COMPENSATION_DE },
};

/**
 * 낱말 목록으로 못 쓰는 꼴(사이에 낱말이 끼는 것)은 정규식 원문으로 적는다 (T054).
 * 상한 있는 반복(`{n,m}`)만 쓴다 — 입력 길이에 선형이다. 영어는 낱말 앞 경계를 붙여 쓴다.
 */
const PATTERNS: readonly { category: CommitmentCategory; locale: FactLocale; source: string }[] = [
  { category: 'reship', locale: 'en', source: 'send(?:\\s{1,4}you)?\\s{1,4}(?:a|an)\\s{1,4}new(?![A-Za-z])' },
  { category: 'reship', locale: 'en', source: 'send\\s{1,4}(?:it|one|another)(?:\\s{1,4}out)?\\s{1,4}again(?![A-Za-z])' },
  { category: 'reship', locale: 'en', source: 'ship(?:\\s{1,4}you)?\\s{1,4}another(?![A-Za-z])' },
  { category: 'reship', locale: 'ja', source: '新しい.{0,20}をお?送' },
  { category: 'reship', locale: 'de', source: 'schick[a-z]{0,3}\\s{1,4}(?:Ihnen\\s{1,4})?eine?[nsrm]?\\s{1,4}neue[nsrm]?(?![A-Za-z])' },
  // 숫자 앞에 숫자가 오지 않는 자리에서만 시작하고 길이에 상한을 둔다 (입력 길이에 선형)
  { category: 'discount', locale: 'en', source: '(?<![\\d.])\\d{1,9}(?:\\.\\d{1,9})?\\s{0,2}percent\\s{1,4}off(?![A-Za-z])' },
  { category: 'discount', locale: 'en', source: '\\$\\s{0,2}\\d{1,9}(?:\\.\\d{1,9})?\\s{0,2}off(?![A-Za-z])' },
  { category: 'free_shipping', locale: 'en', source: 'free\\s{1,4}return\\s{1,4}(?:label|shipping)(?![A-Za-z])' },
  { category: 'free_shipping', locale: 'en', source: 'cover\\s{1,4}(?:the\\s{1,4})?(?:return\\s{1,4})?shipping(?![A-Za-z])' },
  { category: 'free_shipping', locale: 'en', source: 'pay\\s{1,4}(?:for\\s{1,4})?the\\s{1,4}shipping(?![A-Za-z])' },
  { category: 'free_shipping', locale: 'en', source: 'shipping\\s{1,4}is\\s{1,4}on\\s{1,4}(?:us|me)(?![A-Za-z])' },
  { category: 'free_shipping', locale: 'en', source: 'at\\s{1,4}no\\s{1,4}(?:extra\\s{1,4})?cost(?![A-Za-z])' },
];

/**
 * 같은 문장에 두 낱말이 함께 있어야 약속으로 보는 꼴 (T054). 한 낱말만으로는 정상 문장에도 나온다:
 * `돌려 드리`는 돈·결제 낱말과 함께일 때만, `another one`은 send·ship과 함께일 때만 약속이다.
 */
const SENTENCE_PAIRS: readonly { category: CommitmentCategory; locales: readonly FactLocale[]; all: readonly RegExp[] }[] = [
  { category: 'refund', locales: ['ko'], all: [/돌려\s{0,2}드리/, /금액|돈|결제|대금/] },
  { category: 'reship', locales: ['en', 'ko', 'ja', 'de'], all: [/(?<![A-Za-z])another\s{1,4}one(?![A-Za-z])/i, /(?<![A-Za-z])(?:send|ship)/i] },
];

/** 문장 나누기: 마침표·물음표·느낌표·줄바꿈 단위. */
function splitSentences(text: string): string[] {
  return text.split(/[.!?。！？\n]+/);
}

// ───────────────────────────── 맞추기 ─────────────────────────────

/** 라틴 문자 낱말 앞 경계. `prepaid`의 `paid`처럼 낱말 가운데에서 맞지 않게 한다. */
const LATIN_HEAD = '(?<![A-Za-zÄÖÜäöüß])';
/** 라틴 문자 낱말 뒤 경계. 낱말 단위로 봐야 하는 낱말에만 쓴다. */
const LATIN_TAIL = '(?![A-Za-zÄÖÜäöüß])';

/**
 * 낱말 단위로만 보는 라틴 문자 낱말과, 뒤에 오면 약속이 아닌 말.
 * `credit`은 `store credit`(보상)과 `credit card`(카드사)에 모두 들어 있어서 뒤를 봐야 한다.
 * 공백 수에 상한을 둔다 — 신뢰하지 않는 입력에서 역추적이 길어지지 않게 (`src/ai/tokens.ts`와 같은 이유).
 */
const WORD_UNIT_TAILS: Readonly<Record<string, string>> = {
  credit: `${LATIN_TAIL}(?!\\s{0,4}(?:card|cards))`,
};

/** 라틴 문자(영어·독일어) 낱말인가. 한글·가나·한자는 낱말 경계가 없어 그대로 찾는다. */
function isLatin(term: string): boolean {
  return !/[가-힣ぁ-ゖァ-ヺ一-龥]/.test(term);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 낱말 하나를 찾는 정규식. 라틴 문자 낱말에만 앞 경계를 둔다 — 한글·가나·한자는 낱말을 띄어 쓰지 않아
 * 경계를 두면 `주문환불`처럼 붙여 쓴 글을 놓친다. 전역 플래그는 쓰지 않는다
 * (`test`가 `lastIndex`를 남겨 다음 호출 결과를 바꾸지 않게. `src/ai/tokens.ts`와 같은 이유).
 */
function matcher(term: string): RegExp {
  const head = isLatin(term) ? LATIN_HEAD : '';
  const tail = WORD_UNIT_TAILS[term.toLowerCase()] ?? '';
  // 낱말 사이 공백은 1~4칸의 공백·줄바꿈으로 본다 (두 칸 띄어 쓴 글을 놓치지 않게. 상한이 있어 선형이다)
  return new RegExp(`${head}${escapeRegExp(term).replace(/ /g, '\\s{1,4}')}${tail}`, 'i');
}

/**
 * 언어별로 볼 정규식. **영어 낱말은 어느 언어에서나 함께 본다** — 번역이 `refund`·`reship` 같은 낱말을
 * 영어 그대로 남겨 두는 일이 있고, 그때 약속이 생긴 것을 놓치면 안 된다 (막는 쪽으로 틀린다).
 * 모듈을 읽을 때 한 번만 만든다 (글마다 정규식을 다시 만들지 않게).
 */
const MATCHERS = new Map<string, RegExp[]>();
for (const category of COMMITMENT_CATEGORIES) {
  for (const locale of FACT_LOCALES) {
    const terms = locale === 'en' ? TERMS[category].en : [...TERMS[category][locale], ...TERMS[category].en];
    const extra = PATTERNS.filter((p) => p.category === category && (p.locale === locale || p.locale === 'en')).map(
      (p) => new RegExp(isLatin(p.source) ? `${LATIN_HEAD}${p.source}` : p.source, 'i'),
    );
    MATCHERS.set(`${category}:${locale}`, [...new Set(terms)].map(matcher).concat(extra));
  }
}

/**
 * 토큰(`⟦DATE_1⟧`)과 실행 자리표시자(`{{refundAmount}}`) 안의 글자는 보지 않는다 (지시서 4번).
 * 자리표시자 이름에 `refund`가 들어 있어도 그것은 **실행 계획의 금액 자리**이지 모델이 쓴 약속이 아니다.
 * 공백으로 바꿔서 앞뒤 낱말이 붙지 않게 한다. 이름 길이 상한은 `src/ai/tokens.ts`와 같다.
 */
function withoutPlaceholders(text: string): string {
  return text.replace(/⟦[^⟦⟧]*⟧/g, ' ').replace(/\{\{[^{}]{0,200}\}\}/g, ' ');
}

/**
 * 글에서 찾은 돈이 드는 약속의 범주. 중복 없이 `COMMITMENT_CATEGORIES` 순서로 돌려준다.
 *
 * `locale`은 글의 언어다: 초안은 `'en'`, 전송본은 구매자 언어다. 허용 여부는 여기서 보지 않는다 —
 * 추천 수·판매자 확인과 견주는 일은 `src/ai/reply.ts`가 한다 (이 파일은 "글에 무엇이 적혀 있나"만 본다).
 */
export function findCommitments(text: string, locale: FactLocale): CommitmentCategory[] {
  const scanned = withoutPlaceholders(text);
  const found: CommitmentCategory[] = [];
  const lines = splitSentences(scanned);
  for (const category of COMMITMENT_CATEGORIES) {
    const patterns = MATCHERS.get(`${category}:${locale}`) ?? [];
    const pairs = SENTENCE_PAIRS.filter((p) => p.category === category && p.locales.includes(locale));
    if (
      patterns.some((pattern) => pattern.test(scanned)) ||
      pairs.some((pair) => lines.some((line) => pair.all.every((re) => re.test(line))))
    ) {
      found.push(category);
    }
  }
  return found;
}
