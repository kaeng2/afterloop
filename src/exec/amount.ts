/**
 * 금액 표기 (SPEC v2.1 9-1장 "메시지 안 금액 = API 본문 금액").
 *
 * 엔진이 정한 센트 정수를 문자열로 옮기기만 한다. 새 금액을 계산하지 않는다.
 * 센트 → 문자열 변환은 정수·문자열 연산만 쓴다 (`/100` 후 `toFixed` 같은 부동소수 연산 금지):
 * 자리수를 세 자리 이상으로 맞춘 뒤 뒤 두 자리를 소수부로 잘라 쓴다.
 */

/** 센트 정수가 아니면 만들 수 없다 (계약: `ActionPlan.amountCents`, `BoardState.amountCents`는 센트 정수). */
function digitsOf(cents: number): { negative: boolean; whole: string; fraction: string } {
  if (!Number.isInteger(cents)) throw new Error('금액은 센트 정수여야 한다');
  const digits = String(Math.abs(cents)).padStart(3, '0');
  return { negative: cents < 0, whole: digits.slice(0, -2), fraction: digits.slice(-2) };
}

/** API 본문용 값. 천 단위 구분 없는 소수 두 자리 (720 → "7.20", 123456 → "1234.56"). */
export function centsToApiValue(cents: number): string {
  const { negative, whole, fraction } = digitsOf(cents);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** 사람이 읽는 표기. 메시지 안에 들어간다 (720 → "$7.20", 123456 → "$1,234.56"). */
export function centsToDisplay(cents: number): string {
  const { negative, whole, fraction } = digitsOf(cents);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}$${grouped}.${fraction}`;
}
