/**
 * 사실값 토큰과 번역 검사 (SPEC v2.2 3장 "사실값은 LLM이 쓰지 않는다", 원문 10-5).
 *
 * 날짜·금액·추적번호·통관 상태는 모든 AI 초안에서 `⟦DATE_1⟧` 같은 토큰으로만 쓰고 코드가 채운다.
 * 이 파일은 LLM을 부르지 않는 순수 코드다: 토큰을 뽑고(`extractTokens`), 판매자가 본 영어 초안과
 * 구매자 언어 전송본을 비교하고(`checkTokens`), 검사를 통과한 전송본에 값을 채운다(`fillTokens`).
 *
 * `Math.random`·`Date`·`performance.now`를 읽지 않으므로 같은 입력이면 항상 같은 결과다
 * (날짜 표기는 입력 문자열만 쓴다. `Date`를 아예 쓰지 않아 시간대가 끼어들 곳이 없다).
 * 입력 문자열과 `facts` 배열은 바꾸지 않는다.
 *
 * 실행 층(`src/exec/message.ts`)과의 경계:
 * - `{{offerAmount}}` 같은 실행 자리표시자는 값을 채우지 않고(`fillTokens`가 그대로 둔다) 사실값 검사에서도 뺀다.
 *   다만 **개수는 센다**: 초안의 자리표시자가 전송본에 같은 이름·같은 개수로 없으면 `missing`·`extra`에 넣는다
 *   (번역 중에 `{{offerAmount}}`가 금액 글자로 바뀌는 것을 막는 가장 확실한 길이다. 컨트롤 타워 결정, T010 재시도).
 * - `formatFact`의 날짜 표기는 `11.17`·`2026.11.17` 같은 점 표기를 만들지 않는다. 실행 층의 금액 검사가
 *   "숫자 + 점 + 두 자리"를 금액으로 보고 거부하기 때문이다 (`src/exec/message.ts`의 `literalShapeDecimal`).
 *   독일어 `17. November`는 점 뒤에 공백과 달 이름이 오므로 그 검사에 걸리지 않는다.
 * - `formatFact('AMOUNT', …)`가 만드는 `$7.20`은 실행 층이 거부한다. 실행을 거치는 메시지의 금액은
 *   `{{offerAmount}}`·`{{refundAmount}}`·`{{disputeAmount}}`로만 쓴다 (T027). 금액 토큰은 실행을 거치지
 *   않는 안내 문구에서만 쓴다.
 */
import type { CheckTokensFn, FactToken, TokenCheck } from '@/types';

// ───────────────────────────── 토큰 문법 ─────────────────────────────

/** 토큰 종류 (계약: `src/types.ts` 6부 `FactToken['kind']`). */
const KINDS: readonly FactToken['kind'][] = ['DATE', 'AMOUNT', 'TRACKING', 'CUSTOMS_STATUS'];

/** 사실값 표기에 쓰는 언어. */
export type FactLocale = 'ko' | 'en' | 'ja' | 'de';

/** 사실값 검사에서 "현지 표기로 직접 쓴 값"을 찾을 때 훑는 언어. */
export const FACT_LOCALES: readonly FactLocale[] = ['ko', 'en', 'ja', 'de'];

/** 올바른 토큰 하나와 정확히 일치: `⟦` + 종류 + `_` + 1 이상의 정수 + `⟧`. 앞자리 0은 토큰이 아니다. */
const WELL_FORMED_TOKEN = new RegExp(`^⟦(?:${KINDS.join('|')})_[1-9][0-9]*⟧$`);

/** `⟦…⟧` 꼴 전부. 올바른 토큰인지는 `WELL_FORMED_TOKEN`으로 따로 가린다. */
const BRACKETED = /⟦[^⟦⟧]*⟧/g;

/**
 * 실행 자리표시자. 이 자리는 사실값이 아니다 (실행 층이 채운다).
 * 이름 양쪽 공백은 실행 층과 같이 무시하지만, **정규식으로 깎지 않고** 아래에서 `trim`으로 깎는다 —
 * `\s*([^{}]*?)\s*`처럼 겹치는 반복을 쓰면 `{{` 뒤에 공백이 길게 이어지는 입력에서 역추적이 폭발한다
 * (T031 재시도. `{{` + 공백 2만 자에서 검사가 끝나지 않았다).
 * 이름 길이에 상한을 둬서 한 자리에서 보는 경우의 수도 묶어 둔다. 이름이 상한보다 길면 자리표시자로
 * 세지 않으므로, 그 안에 금액 글자가 있으면 `literalFacts`로 걸린다 (막는 쪽으로 틀린다).
 */
const EXEC_PLACEHOLDER = /\{\{([^{}]{0,200})\}\}/g;

/** 전송본·초안의 실행 자리표시자 이름. `{{ offerAmount }}`도 `{{offerAmount}}`와 같은 이름으로 센다. */
function execPlaceholders(text: string): string[] {
  return [...text.matchAll(EXEC_PLACEHOLDER)].map((match) => `{{${match[1].trim()}}}`);
}

/** 개인통관고유부호 `P` + 숫자 12자리 (SPEC 10장: 화면·로그에 남기지 않는다). */
const PCCC = /(?<![A-Za-z0-9])[Pp][0-9]{12}(?![0-9])/g;

/** 개인통관고유부호를 가린 표기. 자리수만 남긴다. */
const PCCC_MASK = 'P************';

/**
 * 한 글에서 올바른 토큰과 형식 오류를 뽑는다.
 * 짝이 맞지 않는 `⟦`·`⟧` 하나도 형식 오류로 센다 (실행 층이 남은 괄호를 거부하기 때문이다).
 */
function scan(text: string): { tokens: string[]; malformed: string[] } {
  const tokens: string[] = [];
  const malformed: string[] = [];
  for (const match of text.matchAll(BRACKETED)) {
    (WELL_FORMED_TOKEN.test(match[0]) ? tokens : malformed).push(match[0]);
  }
  const unpaired = text.replace(BRACKETED, '');
  for (const bracket of ['⟦', '⟧']) {
    if (unpaired.includes(bracket)) malformed.push(bracket);
  }
  return { tokens, malformed };
}

/** 나온 순서대로, 중복 포함. 형식 오류(`⟦PCCC⟧` 등)는 토큰이 아니므로 넣지 않는다. */
export function extractTokens(text: string): string[] {
  return scan(text).tokens;
}

/** `a`에 있는데 `b`에 모자라는 만큼. 개수까지 비교한다 (2번 : 1번 → 1번 부족). `a`의 순서를 지킨다. */
function shortfall(a: string[], b: string[]): string[] {
  const left = new Map<string, number>();
  for (const token of b) left.set(token, (left.get(token) ?? 0) + 1);
  const out: string[] = [];
  for (const token of a) {
    const remaining = left.get(token) ?? 0;
    if (remaining > 0) left.set(token, remaining - 1);
    else out.push(token);
  }
  return out;
}

// ───────────────────────────── 현지 표기 ─────────────────────────────

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_EN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 윤년 규칙만 쓴다 (`Date` 없이). */
function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** ISO 날짜(`2026-11-17`)만 받는다. 점 표기(`11.17`)는 만들지 않는다 (실행 층의 금액 검사). */
function formatDate(raw: string, locale: FactLocale): string {
  const parts = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(raw);
  if (!parts) throw new Error('DATE 값은 ISO 날짜(YYYY-MM-DD)여야 한다');
  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error('DATE 값이 없는 날짜다');
  }
  switch (locale) {
    case 'ko':
      return `${month}월 ${day}일`;
    case 'en':
      return `${MONTHS_EN[month - 1]} ${day}`;
    case 'ja':
      return `${month}月${day}日`;
    case 'de':
      return `${day}. ${MONTHS_DE[month - 1]}`;
    default:
      throw new Error('모르는 언어다');
  }
}

/**
 * 센트 정수 → `$7.20` (모든 언어 공통, USD).
 * 정수·문자열 연산만 쓴다 (`/100` 후 `toFixed` 같은 부동소수 연산 금지. `src/exec/amount.ts`와 같은 방식).
 */
function formatAmount(raw: string): string {
  if (!/^-?(?:0|[1-9][0-9]*)$/.test(raw)) throw new Error('AMOUNT 값은 센트 정수여야 한다');
  const negative = raw.startsWith('-');
  const digits = (negative ? raw.slice(1) : raw).padStart(3, '0');
  const whole = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${whole}.${digits.slice(-2)}`;
}

/**
 * 사실값 하나의 현지 표기.
 * `DATE`: ISO 날짜 → `11월 17일` / `November 17` / `11月17日` / `17. November`.
 * `AMOUNT`: 센트 정수 → `$7.20`. `TRACKING`·`CUSTOMS_STATUS`: 그대로.
 */
export function formatFact(kind: FactToken['kind'], raw: string, locale: FactLocale): string {
  switch (kind) {
    case 'DATE':
      return formatDate(raw, locale);
    case 'AMOUNT':
      return formatAmount(raw);
    case 'TRACKING':
    case 'CUSTOMS_STATUS':
      return raw;
    default:
      throw new Error('모르는 사실값 종류다');
  }
}

// ───────────────────────────── 값을 직접 쓴 부분 (literalFacts) ─────────────────────────────

/** 반각·전각 숫자. */
const D = '[0-9０-９]';
/**
 * 천 단위 구분과 소수 둘째 자리까지 허용한 수. 소수점은 점과 쉼표 둘 다 받는다
 * (독일어는 `24,00`처럼 쉼표를 쓴다). `24,-`도 금액 표기다.
 *
 * 수로 시작하는 모양은 모두 `NUM_HEAD`로 시작한다. 숫자 가운데에서 다시 시작하지 않게 막는 것이고
 * (앞자리를 포함한 더 긴 자리에서 이미 보므로 잡는 것은 그대로다), 숫자가 수만 자 이어지는 입력에서
 * 자리마다 역추적을 다시 하지 않게 하는 것이 목적이다 (T031 재시도).
 */
const NUM = `${D}+(?:[,，]${D}{3})*(?:[.．,，]${D}{1,2}|[,，]-)?`;
const NUM_HEAD = `(?<!${D})`;
/**
 * 모양 안의 공백. 상한을 둬서 공백이 수만 자 이어지는 입력에서 보는 경우의 수를 묶는다 (T031 재시도).
 * 사람이 쓴 글의 금액·날짜 표기는 공백 한두 자다.
 */
const SP = '\\s{0,16}';
const SP1 = '\\s{1,16}';
/** 반각·전각 통화 기호. */
const CURRENCY_SYMBOL = '[$＄¢₩￦€£¥￥￡]';
/** 통화 코드. 낱말 경계를 둔다 (`USDA` 같은 낱말에 걸리지 않게). */
const CURRENCY_CODE = '(?<![A-Za-z])(?:USD|KRW|EUR|GBP|JPY)(?![A-Za-z])';
/** 통화 낱말 앞에 끼는 나라 표기 (`24 US-Dollar`, `24米ドル`, `7USドル`, `24 미국 달러`). */
const CURRENCY_QUALIFIER = '(?:U\\.?\\s?S\\.?|US|미국|미|美国|米国|米|美)';
/** 라틴 문자 통화 낱말 뒤 경계. `60 centimeters`의 `cent`, `2 europäische`의 `euro`를 금액으로 보지 않는다. */
const LATIN_TAIL = '(?![A-Za-zÄÖÜäöüß])';

/**
 * 한글 통화 낱말(`원`·`불`) 뒤 경계. 조사·종결이 오거나 한글이 끝나야 통화다.
 * `KO_PARTICLE`은 숫자가 바로 붙은 금액(`24,000원만`, `24불이`)에만 쓴다. 수와 떨어져 있을 때는
 * `KO_PARTICLE_STRICT`를 써서 `만`·`이`·`과`를 뺀다 — `불만`·`불이익`·`원만히`·`불과` 같은 낱말이
 * 조사보다 훨씬 흔하고, 한국어 정상 문장이 막히면 데모의 핵심 장면이 멈춘다 (T031).
 *
 * `KO_PARTICLE_LOOSE`는 그 `만`·`이`·`과`를 **조사 바로 뒤가 한글이 아닐 때만** 되살린다
 * (`삼만 원이 환불됩니다`, `24 불만 환불해 드립니다`, `만 원과 배송비`는 금액이고,
 * `원만히`·`불만족`·`불이익`·`원이름`처럼 한글이 이어지면 낱말이다. T031 재시도)
 */
const KO_PARTICLE = '[을를이은는의에와과도만로으부까짜입였예요]';
const KO_PARTICLE_STRICT = '[을를은는의에와도로으부까짜입였예요]';
const KO_PARTICLE_LOOSE = '[이만과](?![가-힣])';
const koTail = (particles: string): string => `(?:(?![가-힣])|(?=${particles}))`;
/** 수와 떨어진 꼴의 뒤 경계: 좁은 조사 목록 + 한글이 이어지지 않는 `이`·`만`·`과`. */
const KO_TAIL_SPACED = koTail(`(?:${KO_PARTICLE_STRICT}|${KO_PARTICLE_LOOSE})`);

/** 한글 자릿수 낱말. 아라비아 숫자와 섞어 쓴다 (`4천원`, `2만 원`). */
const KO_UNIT = '[십백천만억]';
/** 한자어 수사 (`이십`, `삼만`, `오천`, `사천`). */
const KO_NUMERAL = '[일이삼사오육칠팔구십백천만억]';

/**
 * 통화 이름. `3 weeks`·`2 items` 같은 단위·수량은 들어 있지 않다.
 * `원`·`불`은 흔한 낱말과 겹쳐서 여기에 두지 않고 아래 `amountKo…` 모양에서 따로 본다 (T031).
 */
const CURRENCY_WORD = [
  `(?:${CURRENCY_QUALIFIER}[-\\s]?)?(?:dollars?|cents?|bucks?|euros?)${LATIN_TAIL}`,
  `(?:${CURRENCY_QUALIFIER}[-\\s]?)?달러`,
  `(?:${CURRENCY_QUALIFIER}[-\\s]?)?ドル`,
  '센트',
  '유로',
  'ユーロ',
  '円(?![々一-龥])',
].join('|');

/** 길이·무게·부피 단위. 쉼표 소수 뒤에 오면 금액이 아니다 (`1,50 m`, `0,45 kg` — 독일어 사이즈 안내). */
const SIZE_UNIT =
  '(?:mm|cm|dm|km|m|kg|mg|g|ml|cl|l|Zoll|inch(?:es)?|Zentimeter|Millimeter|Meter|Gramm|Kilogramm|Kilo)' +
  '(?![A-Za-zÄÖÜäöüß])';

/** 글로 쓴 수 (흔한 것만): `seven dollars`, `twenty-four dollars`, `sieben Dollar`, `칠 달러`, `七ドル`. */
const SMALL_NUMBER_EN =
  '(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[-\\s](?:one|two|three|four|five|six|seven|eight|nine))?' +
  '|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|hundred';
const SMALL_NUMBER_DE =
  'ein(?:s|e|en|em)?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|dreißig|vierzig|fünfzig|hundert';
// 한글 수는 통화 낱말 앞에 띄어쓰기를 둬야 통화로 본다 — `이불`·`사원`처럼 수 글자로 시작하는 낱말을 피한다.
// 앞 글자가 한글이면 수로 보지 않는다 — `색상이 불…`의 `이`, `택배 기사 불…`의 `사`가 수로 읽히던 것을 막는다 (T031)
const NUM_WORD = [
  `(?<![A-Za-zÄÖÜäöüß])(?:${SMALL_NUMBER_EN}|${SMALL_NUMBER_DE})${LATIN_TAIL}${SP}`,
  `(?<![가-힣])${KO_NUMERAL}{1,4}${SP1}`,
  `[〇一二三四五六七八九十百千万]{1,4}${SP}`,
].join('|');

/** 날짜의 일(1~31). 32 이상이나 0은 날짜로 보지 않는다 (`24/7`, `50/50`). */
const DAY = '(?:0?[1-9]|[12][0-9]|3[01]|０?[１-９]|[１２][０-９]|３[０１])';
/** 날짜의 월(1~12). */
const MON = '(?:0?[1-9]|1[0-2]|０?[１-９]|１[０-２])';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 전각 숫자를 반각으로. 날짜 범위 검사에서 수로 읽을 때만 쓴다. */
function toHalfDigits(text: string): string {
  return text.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10));
}

/** 독일어 달 약칭 (`17. Dez`, `9. Okt`). 영어 약칭과 겹치는 것은 아래에서 한 번만 쓴다. */
const MONTHS_DE_SHORT = ['Mär', 'Mrz', 'Okt', 'Dez', 'Sept'];

/** 달 이름 하나. 긴 것부터 둬서 `November`가 `Nov`보다, `Dezember`가 `Dez`보다 먼저 맞는다. */
function monthAlternation(words: readonly string[]): string {
  const sorted = [...new Set(words)]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  return `(?<![A-Za-zÄÖÜäöüß])(?:${sorted})(?![A-Za-zÄÖÜäöüß])`;
}

/** 대소문자를 가리지 않는 달 이름. 조동사 `may`와 겹치는 `May`만 빼고 따로 본다. */
const MONTH_ANYCASE = monthAlternation(
  [...MONTHS_EN, ...MONTHS_DE, ...MONTHS_EN_SHORT, ...MONTHS_DE_SHORT].filter((word) => word !== 'May'),
);
/** 대문자로 시작할 때만 달 이름으로 보는 것: `May` (`Size 8 may run small`을 날짜로 보지 않게). */
const MONTH_CASED = monthAlternation(['May']);

/** `November 17`, `Nov. 17`, `November 17th`, `November the 17th`. */
function monthDayPattern(month: string, flags: string): RegExp {
  return new RegExp(`${month}\\.?${SP}(?:the${SP1})?${DAY}(?:st|nd|rd|th)?(?!${D})`, flags);
}

/** `17 November`, `17. November`, `17th Nov`, `17th of November`, `17. Dez`. */
function dayMonthPattern(month: string, flags: string): RegExp {
  return new RegExp(`${NUM_HEAD}${DAY}(?:st|nd|rd|th)?(?:\\.|${SP1}of)?${SP}${month}`, flags);
}

/**
 * `11/17`인지 `24/7`·`3/4` 같은 분수·관용 표기인지 가른다.
 * 월은 1~12, 일은 1~31이어야 하고, 해가 없으면 일이 13 이상이거나 앞자리 0을 쓴 꼴이어야 날짜로 본다
 * (`3/4`, `1/2`는 분수 쪽으로 둔다. `11/5`처럼 둘 다 12 이하인 날짜는 놓친다 — 재시도 보고서에 적었다).
 */
function slashLooksLikeDate(text: string): boolean {
  const parts = toHalfDigits(text).split('/');
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return false;
  if (parts.length === 3) return true;
  return day >= 13 || /^0\d/.test(parts[0]) || /^0\d/.test(parts[1]);
}

/**
 * 값을 직접 쓴 모양. 위에 있는 것을 먼저 받고, 겹치는 아래 모양은 버린다
 * (`$7.20`을 받았으면 그 안의 `7.20`은 따로 세지 않는다).
 *
 * 막지 않는 것: 기간(`3 weeks`, `3주`, `2 days`), 수량(`1개`, `2 items`), 비율(`15%`),
 * 치수(`60 centimeters`, `52cm`, `1,50 m`), 조동사 `may`, 분수·관용 표기(`24/7`, `3/4`),
 * 쿠폰 코드(`FERNWOOD15`), 그리고 한국어 정상 문장(`불만족`, `원만히`, `불이익`, `원하시면`).
 * 경계는 `tests/unit/tokens.test.ts`의 표에 적어 둔다.
 */
const LITERAL_SHAPES: { shape: string; pattern: RegExp; keep?: (text: string) => boolean }[] = [
  // 금액: `$24`, `$7.20`, `US$7`, `＄７`, `₩9,600`
  { shape: 'amountSymbolBefore', pattern: new RegExp(`(?:US)?${CURRENCY_SYMBOL}${SP}${NUM}`, 'gi') },
  // 금액: 수 뒤에 기호 — `24 $`, `24$`, `7,20 $`, `24,00 $`, `24,- $`, `24 €`, `24€`, `24 US$` (독일어 표기)
  { shape: 'amountSymbolAfter', pattern: new RegExp(`${NUM_HEAD}${NUM}${SP}(?:US)?${CURRENCY_SYMBOL}`, 'gi') },
  // 금액: `USD 7.20`, `usd7.20`, `USD 24,00`
  { shape: 'amountCodeBefore', pattern: new RegExp(`${CURRENCY_CODE}${SP}${NUM}`, 'gi') },
  // 금액: `7.20 dollars`, `7달러`, `24ドル`, `24 Dollar`, `20 cents`, `24 US-Dollar`, `24米ドル`, `7USドル`
  {
    shape: 'amountWordAfter',
    pattern: new RegExp(`${NUM_HEAD}${NUM}${SP}(?:${CURRENCY_CODE}|${CURRENCY_WORD})`, 'gi'),
  },
  // 금액: 숫자가 바로 붙은 `원`·`불` — `9600원`, `24,000원만`, `24불이`, `4천원`, `2만원`.
  // 숫자가 붙어 있으면 금액이라는 증거가 뚜렷하므로 조사까지 받는다
  {
    shape: 'amountKoAttached',
    pattern: new RegExp(`${NUM_HEAD}${NUM}${KO_UNIT}*(?:원|불)${koTail(KO_PARTICLE)}`, 'g'),
  },
  // 금액: 숫자와 `원`·`불`이 떨어진 꼴 — `24 불`, `24000 원`, `2만 원`. 뒤 경계를 좁게 봐서
  // `주문 2 불만 사항`·`사이즈 1 원만하게`를 금액으로 읽지 않는다 (T031)
  {
    shape: 'amountKoSpaced',
    pattern: new RegExp(`${NUM_HEAD}${NUM}${KO_UNIT}*${SP1}(?:원|불)${koTail(KO_PARTICLE_STRICT)}`, 'g'),
  },
  // 금액: 같은 꼴 + 조사 `이`·`만`·`과` — `24 불이 환불됩니다`, `24 불만`, `24,000 원과`.
  // 조사 뒤에 한글이 이어지면(`불만족`, `원만히`) 낱말이므로 `KO_PARTICLE_LOOSE`가 걸러낸다.
  // 수가 한 글자면(`주문 2 불만 사항`, `사이즈 1 원만하게`) 수량·목록 번호 쪽이 훨씬 흔해 금액으로 보지 않는다 (T031 재시도)
  {
    shape: 'amountKoSpacedParticle',
    pattern: new RegExp(`${NUM_HEAD}${NUM}${KO_UNIT}*${SP1}(?:원|불)${KO_PARTICLE_LOOSE}`, 'g'),
    keep: (text) => /^\S{2,}\s/.test(text),
  },
  // 금액: 글로 쓴 수 + 통화 낱말 — `seven dollars`, `twenty-four dollars`, `sieben Dollar`, `칠 달러`, `七ドル`
  { shape: 'amountNumberWord', pattern: new RegExp(`(?:${NUM_WORD})(?:${CURRENCY_CODE}|${CURRENCY_WORD})`, 'gi') },
  // 금액: 글로 쓴 한글 수 + `원` — `이만 사천 원`, `만 원`, `삼만 원이`. 한 글자 수사(`이`, `사`)는 조사·낱말과 겹쳐
  // 오탐이 크므로 두 글자 이상 수 표현이거나 자릿수 낱말일 때만 본다 (`이 원단`, `사원이`는 통과)
  {
    shape: 'amountKoWordWon',
    pattern: new RegExp(`(?<![가-힣])(?:${KO_NUMERAL}{2,4}${SP}|${KO_UNIT}${SP1})원${KO_TAIL_SPACED}`, 'g'),
  },
  // 금액: 천 단위 구분이 있는 소수 (`1,234.56`). 위 모양보다 아래 `amountDecimal`보다 먼저 받아 전체를 보고한다
  { shape: 'amountGrouped', pattern: new RegExp(`(?<!${D})${D}{1,3}(?:[,，]${D}{3})+[.．]${D}{1,2}(?!${D})`, 'g') },
  // 금액: 통화 표기 없이 소수 둘째 자리까지 적힌 수 (`7.20`, `７.２０`). 실행 층과 같은 기준
  { shape: 'amountDecimal', pattern: new RegExp(`(?<!${D})${D}+[.．]${D}{2}(?!${D})`, 'g') },
  // 금액: 쉼표 소수 (`7,20`, `24,00` — 독일어 표기). 뒤에 길이·무게 단위가 오면 치수 안내이므로 금액이 아니다
  // (`1,50 m`, `0,45 kg`). 통화가 붙은 `24,00 $`·`24,00 USD`는 위 모양이 이미 전체로 받는다
  {
    shape: 'amountDecimalComma',
    pattern: new RegExp(`(?<!${D})${D}+[,，]${D}{2}(?!${D})(?!${SP}${SIZE_UNIT})`, 'g'),
  },
  // 날짜: `11월 17일`
  { shape: 'dateKo', pattern: new RegExp(`${NUM_HEAD}${MON}${SP}월${SP}${DAY}${SP}일`, 'g') },
  // 날짜: `11月17日`
  { shape: 'dateJa', pattern: new RegExp(`${NUM_HEAD}${MON}${SP}月${SP}${DAY}${SP}日`, 'g') },
  // 날짜: `十一月十七日` (한자 숫자)
  {
    shape: 'dateKanji',
    pattern: new RegExp(`[〇一二三四五六七八九十百]{1,8}${SP}月${SP}[〇一二三四五六七八九十百]{1,8}${SP}日`, 'g'),
  },
  // 날짜: `November 17`, `Nov 17`, `Nov. 17`, `November 17th`, `November the 17th`
  { shape: 'dateMonthDay', pattern: monthDayPattern(MONTH_ANYCASE, 'gi') },
  // 날짜: `17 November`, `17. November`, `17th Nov`, `17th of November`, `17. Dez`
  { shape: 'dateDayMonth', pattern: dayMonthPattern(MONTH_ANYCASE, 'gi') },
  // 날짜: `May 17`, `17 May` — 대문자로 시작할 때만 (`you may 1) return it`을 날짜로 보지 않게)
  { shape: 'dateMonthDayCased', pattern: monthDayPattern(MONTH_CASED, 'g') },
  { shape: 'dateDayMonthCased', pattern: dayMonthPattern(MONTH_CASED, 'g') },
  // 날짜: `the 17th` — 13~31일만 (`the 2nd order` 같은 순서 표현을 날짜로 보지 않게)
  { shape: 'dateTheOrdinal', pattern: /(?<![A-Za-z])the\s+(?:1[3-9]|2[0-9]|3[01])(?:st|nd|rd|th)(?![A-Za-z0-9])/gi },
  // 날짜: `2026/11/17`
  { shape: 'dateSlashIso', pattern: new RegExp(`(?<!${D})${D}{4}/${MON}/${DAY}(?!${D})`, 'g') },
  // 날짜: `11/17`, `11/17/2026`. `24/7`·`3/4`·`1/2`·`50/50`은 `slashLooksLikeDate`가 걸러낸다
  {
    shape: 'dateSlash',
    pattern: new RegExp(`(?<![0-9０-９/])${D}{1,2}/${D}{1,2}(?:/${D}{2,4})?(?![0-9０-９/])`, 'g'),
    keep: slashLooksLikeDate,
  },
  // 날짜: `2026-11-17`
  { shape: 'dateIso', pattern: new RegExp(`(?<![0-9０-９])${D}{4}-${D}{1,2}-${D}{1,2}(?![0-9０-９])`, 'g') },
  // 추적번호: 영문 대문자와 숫자가 섞인 10자 이상 열 (`1Z999AA10123456784`, `EE123456789KR`).
  // 숫자가 6자 이상이어야 한다 — 쿠폰 코드(`FERNWOOD15`)는 추적번호로 보지 않는다
  {
    shape: 'tracking',
    pattern: /(?<![A-Za-z0-9])[A-Z0-9]{10,}(?![A-Za-z0-9])/g,
    keep: (text) => /[A-Z]/.test(text) && (text.match(/[0-9]/g)?.length ?? 0) >= 6,
  },
];

type Span = { start: number; end: number; report: string | null };

/**
 * 겹치는 자리는 한 번만 센다. `report`가 `null`이면 "여기는 사실값이 아니다"는 표시다.
 * 자리를 시작 위치 순으로 넣어 두고 이웃 둘만 본다 — 이미 넣은 자리끼리는 겹치지 않으므로
 * 그 둘이 안 겹치면 어느 것과도 안 겹친다. 모양이 수천 번 맞는 긴 글에서 비교가 제곱으로 늘지 않게 하는 것이다
 * (T031 재시도).
 */
function collector() {
  const spans: Span[] = [];
  return {
    add(start: number, end: number, report: string | null): void {
      let low = 0;
      let high = spans.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (spans[mid].start < start) low = mid + 1;
        else high = mid;
      }
      const before = spans[low - 1];
      const after = spans[low];
      if (before !== undefined && start < before.end) return;
      if (after !== undefined && after.start < end) return;
      spans.splice(low, 0, { start, end, report });
    },
    reported(): string[] {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const span of spans) {
        if (span.report === null || seen.has(span.report)) continue;
        seen.add(span.report);
        out.push(span.report);
      }
      return out;
    },
  };
}

/** `needle`이 그대로 적힌 자리. 숫자만으로 된 값은 더 긴 숫자열 안에 들어 있으면 세지 않는다. */
function verbatimSpans(text: string, needle: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const digitsOnly = /^[0-9]+$/.test(needle);
  for (let from = text.indexOf(needle); from !== -1; from = text.indexOf(needle, from + 1)) {
    const end = from + needle.length;
    const neighbours = digitsOnly && (/[0-9]/.test(text[from - 1] ?? '') || /[0-9]/.test(text[end] ?? ''));
    if (!neighbours) out.push({ start: from, end });
  }
  return out;
}

/** 사실값 하나를 글에서 찾을 때 쓸 표기들: 값 그대로 + 4개 언어 현지 표기. */
function needlesOf(fact: FactToken): string[] {
  const needles = new Set<string>();
  // 한 글자 값(예: 센트 `7`)은 아무 숫자에나 걸리므로 그대로 찾지 않는다. 현지 표기로만 찾는다
  if (fact.value.trim().length >= 2) needles.add(fact.value);
  for (const locale of FACT_LOCALES) {
    try {
      // 값이 이미 현지 표기면(예: `$7.20`) `formatFact`가 예외를 던진다. 그때는 값 그대로만 쓴다
      needles.add(formatFact(fact.kind, fact.value, locale));
    } catch {
      /* 현지 표기를 만들 수 없는 값은 건너뛴다 */
    }
  }
  needles.delete('');
  return [...needles];
}

function maskPccc(text: string): string {
  return text.replace(PCCC, PCCC_MASK);
}

/**
 * 전송본에서 토큰이 아니라 값을 직접 쓴 부분. 개인통관고유부호는 가린 값으로 넣는다.
 * 토큰 자리와 실행 자리표시자 자리는 뺀다 (`⟦TRACKING_1⟧` 자체가 추적번호 모양으로 걸리지 않게).
 */
function findLiteralFacts(draft: string, outgoing: string, facts: FactToken[]): string[] {
  const hits = collector();
  for (const match of outgoing.matchAll(PCCC)) {
    hits.add(match.index, match.index + match[0].length, PCCC_MASK);
  }
  for (const pattern of [BRACKETED, EXEC_PLACEHOLDER]) {
    for (const match of outgoing.matchAll(pattern)) {
      hits.add(match.index, match.index + match[0].length, null);
    }
  }
  for (const fact of facts) {
    for (const needle of needlesOf(fact)) {
      for (const span of verbatimSpans(outgoing, needle)) hits.add(span.start, span.end, needle);
    }
  }
  for (const { pattern, keep } of LITERAL_SHAPES) {
    for (const match of outgoing.matchAll(pattern)) {
      if (keep && !keep(match[0])) continue;
      hits.add(match.index, match.index + match[0].length, match[0]);
    }
  }
  const found = hits.reported();
  // 초안에 적힌 개인통관고유부호도 가려서 보고한다 (SPEC 10장).
  // `PCCC.test`를 쓰지 않는다 — 전역 정규식의 `test`는 `lastIndex`를 남겨 다음 호출 결과를 바꾼다
  if (maskPccc(draft) !== draft && !found.includes(PCCC_MASK)) found.push(PCCC_MASK);
  return found;
}

// ───────────────────────────── 새 약속 (newPromises) ─────────────────────────────

/** 약속 표현 (영어). */
const PROMISE_EN = ['guarantee', 'promise', 'definitely', '100%', 'without fail'];
/** 약속 표현 (한국어). */
const PROMISE_KO = ['보장', '반드시', '틀림없이', '무조건', '약속드'];
/** 약속 표현 (일본어). */
const PROMISE_JA = ['保証', '必ず', '約束'];
/** 약속 표현 (독일어). */
const PROMISE_DE = ['garantier', 'versprech', 'auf jeden Fall'];

/** 언어별 목록. `PROMISE_GROUPS`가 이 목록을 모두 덮는지는 단위 테스트에서 확인한다. */
export const PROMISE_TERMS: Record<FactLocale, readonly string[]> = {
  en: PROMISE_EN,
  ko: PROMISE_KO,
  ja: PROMISE_JA,
  de: PROMISE_DE,
};

/**
 * 같은 뜻 묶음. 초안에 같은 묶음의 표현이 이미 있으면 새 약속이 아니다
 * (초안 `guarantee` ↔ 전송본 `보장`은 통과).
 */
export const PROMISE_GROUPS: { group: string; terms: readonly string[] }[] = [
  // `100%`는 보장 쪽에 둔다 — 둘레에 재료 낱말이 없을 때만 약속으로 본다 (`100% wool`은 상품 설명이다)
  { group: 'guarantee', terms: ['guarantee', '보장', '保証', 'garantier', '100%'] },
  { group: 'promise', terms: ['promise', '약속드', '約束', 'versprech'] },
  { group: 'certainty', terms: ['definitely', 'without fail', '반드시', '틀림없이', '무조건', '必ず', 'auf jeden Fall'] },
];

/**
 * 낱말 경계를 쓸 수 있는 언어(영어·독일어)의 약속 표현. 낱말 앞에서만 맞춘다 —
 * `compromise`의 `promise`, `indefinitely`의 `definitely`를 약속으로 보지 않는다.
 * 뒤는 열어 둔다 (`guaranteed`, `garantiert`, `versprechen` 같은 활용형을 잡아야 한다).
 */
const WORD_START_TERMS = new Set(['guarantee', 'promise', 'definitely', 'without fail', 'garantier', 'versprech', 'auf jeden Fall']);

/** `100%` 자리. 독일어식 띄어쓰기(`100 %`)와 전각(`１００％`)도 받는다. */
const PERCENT = /(?:100|１００)\s*[%％]/g;

/**
 * 재료·성분 낱말. `100% 울`·`100% wool`·`zu 100 % aus Wolle`는 상품 설명이지 약속이 아니다.
 * 한글 재료는 **낱말 단위로** 본다 — 앞뒤가 모두 한글이 아니어야 한다. `서울에 계신 … 100%`의 `울`,
 * `원하시면 … 100%`의 `면`을 재료로 읽지 않으려는 것이고(T031 재시도), `울 100%`·`100% 울`처럼
 * 독립된 낱말로 있을 때만 재료다. `울소재`처럼 붙여 쓴 꼴은 그 낱말을 목록에 넣어야 걸린다.
 */
const MATERIAL_LATIN = [
  'extra fine merino wool', 'lambswool', 'Schurwolle',
  'wool', 'cotton', 'cashmere', 'merino', 'silk', 'linen', 'polyester', 'acryl', 'alpaca', 'nylon', 'viscose',
  'Wolle', 'Baumwolle', 'Kaschmir', 'Seide', 'Leinen', 'Merinowolle', 'Viskose',
];
const MATERIAL_KO = [
  '울', '면', '순면', '양모', '캐시미어', '메리노', '메리노울', '램스울', '코튼',
  '실크', '린넨', '아크릴', '나일론', '폴리에스터', '비스코스',
];
const MATERIAL_CJK = ['ウール', 'コットン', 'カシミヤ', 'カシミア', 'シルク', 'リネン', 'ポリエステル', 'アクリル', 'ナイロン', '綿', '絹', '麻', '羊毛'];

/** 긴 낱말을 먼저 둔다 (`메리노울`이 `메리노`보다, `lambswool`이 `wool`보다 먼저 맞는다). */
function longestFirst(words: readonly string[]): string {
  return [...new Set(words)]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
}

const MATERIAL = new RegExp(
  [
    // 라틴 문자는 낱말 앞 경계만 본다 (`Baumwollmischung`, `wools` 같은 합성·복수형도 재료다)
    `(?<![A-Za-zÄÖÜäöüß])(?:${longestFirst(MATERIAL_LATIN)})`,
    `(?<![가-힣])(?:${longestFirst(MATERIAL_KO)})(?![가-힣])`,
    `(?:${longestFirst(MATERIAL_CJK)})`,
  ].join('|'),
  'gi',
);

/** `100%` 둘레에서 재료 낱말을 찾을 범위 (앞 12자, 뒤 16자 ≒ 몇 낱말). */
const MATERIAL_BEFORE = 12;
const MATERIAL_AFTER = 16;

/**
 * 약속으로 볼 `100%`의 첫 자리. 둘레 몇 낱말 안에 재료 낱말이 있으면 상품 설명이므로 건너뛴다.
 * 그 밖의 `100%`(`100% 환불해 드립니다`, `I am 100% sure …`)는 약속 표현이다 (T031).
 *
 * 재료 낱말은 **글 전체에서** 찾고 자리만 둘레와 견준다. 글을 먼저 자르고 조각에서 찾으면
 * 자른 자리가 낱말 앞 경계처럼 보여서, `서울에 계신 고객님께는 100% 도착합니다`의 `울`이
 * 재료로 읽혔다 (T031 재시도).
 */
function firstPercentPromise(text: string): { at: number; text: string } | null {
  const percents = [...text.matchAll(PERCENT)];
  if (percents.length === 0) return null;
  const materials = [...text.matchAll(MATERIAL)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
  for (const match of percents) {
    const from = match.index - MATERIAL_BEFORE;
    const to = match.index + match[0].length + MATERIAL_AFTER;
    if (materials.some((span) => span.start < to && from < span.end)) continue;
    return { at: match.index, text: match[0] };
  }
  return null;
}

/** 약속 표현 하나를 찾는 정규식. 대소문자를 무시하고, 보고 문자열은 전송본에 적힌 그대로다. */
const PROMISE_PATTERNS = new Map<string, RegExp>(
  [...new Set([...Object.values(PROMISE_TERMS).flat(), ...PROMISE_GROUPS.flatMap((entry) => entry.terms)])]
    .filter((term) => term !== '100%')
    .map((term) => [
      term,
      new RegExp(`${WORD_START_TERMS.has(term) ? '(?<![A-Za-zÄÖÜäöüß])' : ''}${escapeRegExp(term)}`, 'gi'),
    ]),
);

/** 글에 적힌 약속 표현의 첫 자리. 전역 정규식의 `lastIndex`가 남지 않게 `matchAll`만 쓴다. */
function firstPromise(text: string, term: string): { at: number; text: string } | null {
  if (term === '100%') return firstPercentPromise(text);
  const pattern = PROMISE_PATTERNS.get(term);
  if (!pattern) return null;
  for (const match of text.matchAll(pattern)) return { at: match.index, text: match[0] };
  return null;
}

/** 초안에는 없는데 전송본에 생긴 약속 표현. 대소문자는 무시한다. */
function findNewPromises(draft: string, outgoing: string): string[] {
  const found: { at: number; text: string }[] = [];
  for (const { terms } of PROMISE_GROUPS) {
    if (terms.some((term) => firstPromise(draft, term) !== null)) continue;
    for (const term of terms) {
      const hit = firstPromise(outgoing, term);
      if (hit !== null) found.push(hit);
    }
  }
  const out: string[] = [];
  for (const { text } of found.sort((a, b) => a.at - b.at)) {
    if (!out.some((kept) => kept.toLowerCase() === text.toLowerCase())) out.push(text);
  }
  return out;
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * 초안(판매자가 본 영어, 토큰 포함)과 전송본(구매자 언어, 토큰 포함, 값 채우기 전)을 비교한다.
 * 네 배열이 모두 비어 있을 때만 `ok`가 `true`다 (`ok`가 false면 화면의 전송 버튼을 끈다).
 *
 * `facts`에 없는 토큰과 형식 오류는 `extra`에 넣는다. 초안에만 있고 `facts`에도 없는 토큰은
 * `missing`과 `extra`에 함께 들어갈 수 있다 — 둘 다 전송을 막는 이유이므로 그대로 둔다.
 *
 * 실행 자리표시자(`{{offerAmount}}`)는 사실값 검사에서는 빼지만 이름·개수는 비교해서
 * 모자라면 `missing`, 남거나 초안에 없던 것이면 `extra`에 `{{이름}}` 꼴로 넣는다.
 */
export const checkTokens: CheckTokensFn = (draft: string, outgoing: string, facts: FactToken[]): TokenCheck => {
  const inDraft = scan(draft);
  const inOutgoing = scan(outgoing);

  const known = new Set(facts.map((fact) => fact.token));
  const missing = shortfall(inDraft.tokens, inOutgoing.tokens);
  const extra = shortfall(inOutgoing.tokens, inDraft.tokens);
  for (const token of [...inOutgoing.tokens, ...inDraft.tokens]) {
    if (!known.has(token) && !extra.includes(token)) extra.push(token);
  }
  for (const raw of [...inOutgoing.malformed, ...inDraft.malformed]) {
    // 형식 오류는 원문 그대로 보고하되, 개인통관고유부호가 들어 있으면 가린다 (SPEC 10장)
    const reported = maskPccc(raw);
    if (!extra.includes(reported)) extra.push(reported);
  }

  // 실행 자리표시자도 이름·개수까지 비교한다. 번역하면서 `{{offerAmount}}`가 금액 글자로 바뀌거나
  // 사라지면 여기서 걸린다 (컨트롤 타워 결정, T010 재시도). 값을 채우는 것은 여전히 실행 층 몫이다
  // 개수는 원래 이름으로 비교하고, 보고할 때만 개인통관고유부호를 가린다 (SPEC 10장, T031)
  const draftSlots = execPlaceholders(draft);
  const outgoingSlots = execPlaceholders(outgoing);
  missing.push(...shortfall(draftSlots, outgoingSlots).map(maskPccc));
  extra.push(...shortfall(outgoingSlots, draftSlots).map(maskPccc));

  const literalFacts = findLiteralFacts(draft, outgoing, facts);
  const newPromises = findNewPromises(draft, outgoing);

  return {
    ok: missing.length === 0 && extra.length === 0 && literalFacts.length === 0 && newPromises.length === 0,
    missing,
    extra,
    literalFacts,
    newPromises,
  };
};

/**
 * 토큰을 `value`로 바꾼다. 실행 자리표시자(`{{offerAmount}}`)는 그대로 둔다.
 * 채우지 못한 토큰이 구매자에게 가지 않도록, `facts`에 없는 토큰이나 형식 오류가 있으면 예외를 던진다.
 * 예외 문구에는 초안 내용을 싣지 않는다 (구매자 정보가 들어올 수 있다. 토큰 이름만 적는다).
 */
export function fillTokens(text: string, facts: FactToken[]): string {
  if (scan(text).malformed.length > 0) throw new Error('토큰 형식이 올바르지 않다 (⟦종류_번호⟧만 쓴다)');

  const values = new Map<string, string>();
  for (const fact of facts) {
    if (!values.has(fact.token)) values.set(fact.token, fact.value);
  }

  const filled = text.replace(BRACKETED, (token) => {
    const value = values.get(token);
    if (value === undefined) throw new Error(`facts에 없는 토큰: ${token}`);
    return value;
  });

  if (/[⟦⟧]/.test(filled)) throw new Error('사실값에 ⟦ 또는 ⟧가 들어 있다');
  return filled;
}
