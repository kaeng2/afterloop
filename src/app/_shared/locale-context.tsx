'use client';
/**
 * 클라이언트 컴포넌트가 쓰는 화면 언어 (T081). 루트 layout이 쿠키에서 읽은 언어를 내려 준다.
 * `useT()`는 그 언어로 묶인 `t`를 돌려준다 — 글자만 바꾼다.
 */
import { createContext, useCallback, useContext } from 'react';

import { setClientLocale, t as translate, type CopyParams, type Locale } from './copy';

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  setClientLocale(locale);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): (key: string, params?: CopyParams) => string {
  const locale = useLocale();
  return useCallback((key, params) => translate(key, params, locale), [locale]);
}
