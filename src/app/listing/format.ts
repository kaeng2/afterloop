/**
 * /listing 표기 (T087). **표기만 한다** — 엔진이 준 값을 글자로만 바꾼다. 금액은 `_shared/money.ts`.
 */

/** 0~1 → "4.5%" (소수 한 자리). */
export function pct1(p: number): string {
  if (!Number.isFinite(p)) throw new Error('확률은 유한한 숫자여야 한다');
  return `${(Math.round(p * 1000) / 10).toFixed(1)}%`;
}

/** 0~1 확률 차이 → "%p" 숫자 글자 ("0.9"). */
export function pts1(p: number): string {
  if (!Number.isFinite(p)) throw new Error('확률은 유한한 숫자여야 한다');
  return (Math.round(p * 1000) / 10).toFixed(1);
}

/** 평균 건수 → "9.0". */
export function count1(x: number): string {
  if (!Number.isFinite(x)) throw new Error('건수는 유한한 숫자여야 한다');
  return (Math.round(x * 10) / 10).toFixed(1);
}

/** 0~1 몫 → "50%" (가정값 설명용). */
export function share0(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** "{{name}}" 자리표시자를 채운다. 빠진 값은 예외 (문구 파일과 화면이 어긋나지 않게). */
export function fill(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    if (!(name in params)) throw new Error(`자리표시자 값이 없다: ${name}`);
    return String(params[name]);
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-20" → "Nov 20" (en) / "11/20" (ko). 빈 값은 "–". */
export function shortDay(iso: string, locale: 'en' | 'ko'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '–';
  const month = Number(m[2]);
  const day = Number(m[3]);
  return locale === 'ko' ? `${month}/${day}` : `${MONTHS[month - 1] ?? '?'} ${day}`;
}
