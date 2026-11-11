/**
 * 확률 표시 (T076). **표기만 바꾼다** — 확률을 만들거나 고치지 않는다. 엔진(또는 어댑터)이 준 0~1 값을
 * "8%" 같은 글자로만 바꾼다. 반올림은 이 파일 한 곳에서만 한다 (`money.ts`와 같은 규칙).
 */

/** 0~1 → "8%" (사사오입, 정수 %). 범위 밖 값은 0%·100%로 자른다. 숫자가 아니면 예외. */
export function toPercentRounded(p: number): string {
  if (!Number.isFinite(p)) throw new Error('확률은 유한한 숫자여야 한다');
  const clipped = Math.min(1, Math.max(0, p));
  return `${Math.round(clipped * 100)}%`;
}
