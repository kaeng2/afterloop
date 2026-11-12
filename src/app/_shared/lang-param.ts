/**
 * 주소의 `?lang=ko|en` → 언어 쿠키를 쓰는 `/lang` 주소 (T081 → T113). 순수 함수 (서버·시험 공용).
 *
 * 알 수 없는 값·없는 값이면 `null` (쿠키 그대로). 나머지 검색 값은 `next`에 그대로 싣는다.
 */
type SearchParams = Record<string, string | string[] | undefined> | undefined;

export function langRedirectTarget(pathname: string, searchParams: SearchParams): string | null {
  const raw = searchParams?.lang;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value !== 'ko' && value !== 'en') return null;
  const rest = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams ?? {})) {
    if (k === 'lang' || v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) rest.append(k, item);
  }
  const qs = rest.toString();
  return `/lang?set=${value}&next=${encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)}`;
}
