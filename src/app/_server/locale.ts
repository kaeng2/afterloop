/**
 * 요청 언어 (T081). 쿠키 `afterloop_lang`에서 읽는다 (`?lang=ko`는 각 page가 쿠키로 바꿔 다시 보낸다 — `applyLangParam`).
 * 화면 글자(`t`)만 바꾼다 — 데이터·계산·전송 함수는 언어를 받지 않는다.
 *
 * 레이아웃·page·서버 액션이 맨 앞에서 `await initLocale()`을 부르면 같은 요청 안의 `t(key, params)`가 그 언어를 쓴다
 * (React `cache`로 요청마다 한 칸). 부르지 않았거나 요청 밖(시험)이면 영어.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { LOCALE_COOKIE, parseLocale, setLocaleResolver, type Locale } from '../_shared/copy';

const store = cache((): { locale: Locale } => ({ locale: 'en' }));
setLocaleResolver(() => store().locale);

/** 쿠키에서 언어를 읽어 이 요청의 언어로 정한다. */
export async function initLocale(): Promise<Locale> {
  let locale: Locale = 'en';
  try {
    locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  } catch {
    locale = 'en';
  }
  store().locale = locale;
  return locale;
}

type SearchParams = Record<string, string | string[] | undefined> | undefined;

/**
 * page 맨 앞에서. 주소에 `?lang=ko|en`이 있으면 (주소가 쿠키보다 우선) `/lang`이 쿠키를 쓰고 같은 화면으로 돌려보낸다.
 * 알 수 없는 값은 무시하고 쿠키 그대로(없으면 영어).
 */
export async function applyLangParam(pathname: string, searchParams: SearchParams): Promise<Locale> {
  const raw = searchParams?.lang;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'ko' || value === 'en') {
    const rest = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (k === 'lang' || v === undefined) continue;
      for (const item of Array.isArray(v) ? v : [v]) rest.append(k, item);
    }
    const qs = rest.toString();
    redirect(`/lang?set=${value}&next=${encodeURIComponent(qs ? `${pathname}?${qs}` : pathname)}`);
  }
  return initLocale();
}
