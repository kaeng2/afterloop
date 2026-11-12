/**
 * 화면 문구 읽기 (T047, SPEC v2.6 12장).
 *
 * 화면에 찍히는 글자는 모두 `config/copy.<언어>.json`에서 온다 (T081: EN | 한국어, 기본 영어). 코드에 글자를 직접 쓰지 않는다.
 * `t(key, params, locale)`의 `locale`을 안 주면 요청의 언어(서버: `_server/locale.ts`가 등록한 읽기 함수, 클라이언트:
 * `useT()`가 내려받은 언어)를 쓰고, 그런 것이 없으면 영어다. 언어는 **글자만** 바꾼다 — 숫자·AI 글·구매자 원문·계산·전송은 무관.
 *
 * 없는 키는 **예외**다. 빈 글자를 내면 화면에 빈 칸이 생기고 아무도 모른 채 넘어간다.
 * 자리표시자(`{{이름}}`)도 채우지 못하면 예외다 — 숫자가 빠진 문장이 그대로 나가지 않게 한다.
 *
 * 숫자·금액은 이 파일이 만들지 않는다. 엔진이 준 값을 `./money`로 표기만 바꿔 `params`로 넘긴다.
 */
import copyEn from '../../../config/copy.en.json';
import copyKo from '../../../config/copy.ko.json';

/** 문구 파일에서 문구가 아닌 키 (화면에 찍히지 않는다). */
const META_KEYS: readonly string[] = ['version', 'note'];

/** `{{이름}}` 한 자리. 이름은 영문·숫자·점만 (`{{amount}}`, `{{fields}}`). */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9.]+)\s*\}\}/g;

type CopyTable = Record<string, string>;

const EN = copyEn as CopyTable;
const KO = copyKo as CopyTable;

/** 문구 키 목록 (`version`·`note`는 뺀다). 두 파일이 같은지 보는 데도 쓴다. */
export function copyKeys(table: CopyTable = EN): string[] {
  return Object.keys(table)
    .filter((key) => !META_KEYS.includes(key))
    .sort();
}

/** 영어·한국어 문구 표 (시험과 정적 검사용. 화면은 `t`만 쓴다). */
export const copyTables = { en: EN, ko: KO } as const;

export type Locale = 'en' | 'ko';
export const LOCALES: readonly Locale[] = ['en', 'ko'];
export const LOCALE_COOKIE = 'afterloop_lang';

/** 모르는 값·없는 값은 영어. */
export function parseLocale(value: unknown): Locale {
  return value === 'ko' ? 'ko' : 'en';
}

/**
 * 클라이언트 묶음(브라우저·서버 렌더의 클라이언트 층)의 언어. `LocaleProvider`가 렌더 맨 앞에서 정한다 — 컴포넌트 밖
 * 순수 함수(`desk-model` 등)가 `t(key)`만 불러도 같은 언어가 나오게 하려는 것이다. 서버 층은 아래 resolver가 따로 정한다.
 */
let clientLocale: Locale = 'en';
export function setClientLocale(locale: Locale): void {
  clientLocale = locale;
}

let resolveAmbient: () => Locale = () => clientLocale;
/** 서버가 요청 언어 읽는 함수를 등록한다 (`_server/locale.ts`). 등록이 없으면 영어. */
export function setLocaleResolver(fn: () => Locale): void {
  resolveAmbient = fn;
}

/** 지금 화면 언어 (`t`가 쓰는 것과 같은 값). T107: 한국어 화면의 말풍선은 번역 줄 없이 날짜만 (시안 DI.ko). */
export function currentLocale(): Locale {
  return resolveAmbient();
}

export type CopyParams = Record<string, string | number>;

/**
 * 문구 1개. 없는 키면 예외, 채우지 못한 자리표시자가 남으면 예외.
 * `params`에 남는 값이 있어도 예외다 (키를 잘못 짚은 것을 조용히 넘기지 않는다).
 */
export function t(key: string, params?: CopyParams, locale: Locale = resolveAmbient()): string {
  const table = locale === 'ko' ? KO : EN;
  const template = table[key];
  if (typeof template !== 'string' || META_KEYS.includes(key)) {
    throw new Error(`화면 문구가 없다: ${key} (config/copy.${locale}.json에 키를 더한다)`);
  }

  const used = new Set<string>();
  const filled = template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      throw new Error(`문구 ${key}의 자리표시자 {{${name}}}를 채우지 못했다`);
    }
    used.add(name);
    return String(value);
  });

  for (const name of Object.keys(params ?? {})) {
    if (!used.has(name)) throw new Error(`문구 ${key}에 없는 자리표시자를 넘겼다: ${name}`);
  }

  return filled;
}
