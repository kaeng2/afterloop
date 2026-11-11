'use client';
/**
 * 언어 버튼 `EN | 한국어` (T081). 위쪽 막대 오른쪽, 판매자 칩 옆. 고르면 쿠키에 적고 화면을 다시 읽는다
 * (서버가 쿠키의 언어로 글자를 다시 그린다). 글자만 바뀐다 — 숫자·AI 글·구매자 원문은 그대로다.
 * `aria-pressed`로 지금 언어를 알리고, 버튼이라 키보드(Tab·Enter·Space)로 고를 수 있다.
 */
import { LOCALE_COOKIE, type Locale } from './copy';
import { useLocale, useT } from './locale-context';

const ONE_YEAR = 60 * 60 * 24 * 365;

/** 고른 언어를 쿠키에 적는다 (브라우저에서만). */
export function writeLocaleCookie(locale: Locale): void {
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  } catch {
    // 쿠키를 못 써도 화면은 이번 한 번 바뀐다
  }
}

const OPTIONS: readonly { locale: Locale; labelKey: string }[] = [
  { locale: 'en', labelKey: 'shell.lang.en' },
  { locale: 'ko', labelKey: 'shell.lang.ko' },
];

export function LanguageSwitch() {
  const t = useT();
  const current = useLocale();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    writeLocaleCookie(locale);
    window.location.reload();
  };

  return (
    <div className="lang-switch" role="group" aria-label={t('shell.lang.label')}>
      {OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          lang={option.locale}
          aria-pressed={current === option.locale}
          onClick={() => choose(option.locale)}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}
