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
 * - `{{offerAmount}}` 같은 실행 자리표시자는 건드리지 않는다. 토큰으로도 세지 않고, 사실값 검사에서도 뺀다.
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

/** 실행 자리표시자. 이 자리는 토큰도 사실값도 아니다 (실행 층이 채운다). */
const EXEC_PLACEHOLDER = /\{\{[^{}]*\}\}/g;

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
/** 천 단위 구분과 소수 둘째 자리까지 허용한 수. */
const NUM = `${D}+(?:[,，]${D}{3})*(?:[.．]${D}{1,2})?`;
/** 반각·전각 통화 기호. */
const CURRENCY_SYMBOL = '[$＄¢₩￦€£¥￥￡]';
/** 통화 코드. 낱말 경계를 둔다 (`USDA` 같은 낱말에 걸리지 않게). */
const CURRENCY_CODE = '(?<![A-Za-z])(?:USD|KRW|EUR|GBP|JPY)(?![A-Za-z])';
/** 통화 이름. `3 weeks`·`2 items` 같은 단위·수량은 들어 있지 않다. */
const CURRENCY_WORD = '(?:달러|센트|원|유로|ドル|円|ユーロ|(?:U\\.?\\s?S\\.?\\s?)?(?:dollars?|cents?|bucks?|euros?))';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 달 이름 (영어 전체·약칭, 독일어). 긴 것부터 둬서 `November`가 `Nov`보다 먼저 맞는다. */
const MONTH_WORDS = [...new Set([...MONTHS_EN, ...MONTHS_DE, ...MONTHS_EN_SHORT])]
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join('|');
const MONTH = `(?<![A-Za-zÄÖÜäöü])(?:${MONTH_WORDS})(?![A-Za-zÄÖÜäöü])`;

/**
 * 값을 직접 쓴 모양. 위에 있는 것을 먼저 받고, 겹치는 아래 모양은 버린다
 * (`$7.20`을 받았으면 그 안의 `7.20`은 따로 세지 않는다).
 *
 * 막지 않는 것: 기간(`3 weeks`, `3주`, `2 days`), 수량(`1개`, `2 items`), 비율(`15%`), 일반 낱말.
 * 경계는 `tests/unit/tokens.test.ts`의 표에 적어 둔다.
 */
const LITERAL_SHAPES: { shape: string; pattern: RegExp; keep?: (text: string) => boolean }[] = [
  // 금액: `$24`, `$7.20`, `US$7`, `＄７`, `₩9,600`
  { shape: 'amountSymbolBefore', pattern: new RegExp(`(?:US)?${CURRENCY_SYMBOL}\\s*${NUM}`, 'gi') },
  // 금액: `USD 7.20`, `usd7.20`
  { shape: 'amountCodeBefore', pattern: new RegExp(`${CURRENCY_CODE}\\s*${NUM}`, 'gi') },
  // 금액: `7.20 dollars`, `7달러`, `24ドル`, `24 Dollar`, `20 cents`, `7.20 USD`
  { shape: 'amountWordAfter', pattern: new RegExp(`${NUM}\\s*(?:${CURRENCY_CODE}|${CURRENCY_WORD})`, 'gi') },
  // 금액: 통화 표기 없이 소수 둘째 자리까지 적힌 수 (`7.20`, `７.２０`). 실행 층과 같은 기준
  { shape: 'amountDecimal', pattern: new RegExp(`(?<!${D})${D}+[.．]${D}{2}(?!${D})`, 'g') },
  // 날짜: `11월 17일`
  { shape: 'dateKo', pattern: new RegExp(`${D}{1,2}\\s*월\\s*${D}{1,2}\\s*일`, 'g') },
  // 날짜: `11月17日`
  { shape: 'dateJa', pattern: new RegExp(`${D}{1,2}\\s*月\\s*${D}{1,2}\\s*日`, 'g') },
  // 날짜: `November 17`, `Nov 17`, `Nov. 17`, `November 17th`
  { shape: 'dateMonthDay', pattern: new RegExp(`${MONTH}\\.?\\s*${D}{1,2}(?:st|nd|rd|th)?(?!${D})`, 'gi') },
  // 날짜: `17 November`, `17. November`, `17th Nov`
  { shape: 'dateDayMonth', pattern: new RegExp(`(?<!${D})${D}{1,2}(?:st|nd|rd|th)?\\.?\\s*${MONTH}`, 'gi') },
  // 날짜: `11/17`, `11/17/2026`
  { shape: 'dateSlash', pattern: new RegExp(`(?<![0-9０-９])${D}{1,2}/${D}{1,2}(?:/${D}{2,4})?(?![0-9０-９])`, 'g') },
  // 날짜: `2026-11-17`
  { shape: 'dateIso', pattern: new RegExp(`(?<![0-9０-９])${D}{4}-${D}{1,2}-${D}{1,2}(?![0-9０-９])`, 'g') },
  // 추적번호: 영문 대문자와 숫자가 섞인 10자 이상 열 (`1Z999AA10123456784`, `EE123456789KR`)
  {
    shape: 'tracking',
    pattern: /(?<![A-Za-z0-9])[A-Z0-9]{10,}(?![A-Za-z0-9])/g,
    keep: (text) => /[A-Z]/.test(text) && /[0-9]/.test(text),
  },
];

type Span = { start: number; end: number; report: string | null };

/** 겹치는 자리는 한 번만 센다. `report`가 `null`이면 "여기는 사실값이 아니다"는 표시다. */
function collector() {
  const spans: Span[] = [];
  return {
    add(start: number, end: number, report: string | null): void {
      if (spans.some((span) => start < span.end && span.start < end)) return;
      spans.push({ start, end, report });
    },
    reported(): string[] {
      const out: string[] = [];
      for (const span of [...spans].sort((a, b) => a.start - b.start)) {
        if (span.report !== null && !out.includes(span.report)) out.push(span.report);
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
  { group: 'guarantee', terms: ['guarantee', '보장', '保証', 'garantier'] },
  { group: 'promise', terms: ['promise', '약속드', '約束', 'versprech'] },
  { group: 'certainty', terms: ['definitely', '100%', 'without fail', '반드시', '틀림없이', '무조건', '必ず', 'auf jeden Fall'] },
];

/** 초안에는 없는데 전송본에 생긴 약속 표현. 대소문자는 무시한다. */
function findNewPromises(draft: string, outgoing: string): string[] {
  const draftLower = draft.toLowerCase();
  const outgoingLower = outgoing.toLowerCase();
  const found: { at: number; text: string }[] = [];
  for (const { terms } of PROMISE_GROUPS) {
    if (terms.some((term) => draftLower.includes(term.toLowerCase()))) continue;
    for (const term of terms) {
      const at = outgoingLower.indexOf(term.toLowerCase());
      if (at !== -1) found.push({ at, text: outgoing.slice(at, at + term.length) });
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
