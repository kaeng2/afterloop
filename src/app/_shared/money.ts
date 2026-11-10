/**
 * 금액 표시 (T047, SPEC v2.6 2장 "엔진 값은 센트 그대로 두고 화면 표시만 반올림").
 *
 * **표기만 바꾼다.** 새 금액을 만들지 않고, 센트 값을 고치지 않는다. 엔진이 준 센트 정수는 보기용 값
 * 묶음에 그대로 함께 둔다 — 화면은 이 두 함수로 글자만 만든다.
 *
 * 반올림은 **이 파일 한 곳에서만** 한다. 다른 화면 코드에서 `/ 100`이나 `toFixed`를 쓰지 않는다.
 * 나눗셈·`toFixed` 같은 부동소수 연산을 쓰지 않고 `src/exec/amount.ts`처럼 자리수 문자열로 가른다.
 */
import { centsToDisplay } from '@/exec/amount';

/** 사사오입 기준: 센트 두 자리가 50 이상이면 1달러 올린다. */
const ROUND_UP_FROM = 50;

/** 센트 정수를 달러 자리와 센트 자리로 가른다 (나눗셈 없이). */
function splitCents(cents: number): { negative: boolean; dollars: number; fraction: number } {
  if (!Number.isInteger(cents)) throw new Error('금액은 센트 정수여야 한다');
  const digits = String(Math.abs(cents)).padStart(3, '0');
  return {
    negative: cents < 0,
    dollars: Number(digits.slice(0, -2)),
    fraction: Number(digits.slice(-2)),
  };
}

/** 천 단위 구분 (1234 → "1,234"). */
function group(dollars: number): string {
  return String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 달러로 반올림한 표기 (사사오입). 7400 → `"$74"`, 3680 → `"$37"`, 3650 → `"$37"`, 3649 → `"$36"`, 0 → `"$0"`.
 * 음수는 0에서 먼 쪽으로 올린다 (-3650 → `"-$37"`).
 *
 * 기대 손실·절감액처럼 "대략 얼마"를 읽는 칸에 쓴다. 정확한 금액(분쟁 금액, 제안 금액, 메시지 안
 * 금액)에는 `toDollarsCents`를 쓴다 — 그 값은 API 본문 금액과 글자까지 같아야 한다 (SPEC 9-1).
 */
export function toDollarsRounded(cents: number): string {
  const { negative, dollars, fraction } = splitCents(cents);
  const rounded = fraction >= ROUND_UP_FROM ? dollars + 1 : dollars;
  return `${negative ? '-' : ''}$${group(rounded)}`;
}

/** 센트까지 적는 표기. 7200 → `"$72.00"`. `centsToDisplay`를 그대로 부른다 (같은 글자를 두 군데서 만들지 않는다). */
export function toDollarsCents(cents: number): string {
  return centsToDisplay(cents);
}
