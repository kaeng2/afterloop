/**
 * 화면 문구 읽기 (T047, SPEC v2.6 12장).
 *
 * 화면에 찍히는 글자는 모두 `config/copy.en.json`에서 온다 (화면은 영어). 코드에 글자를 직접 쓰지 않는다.
 * `config/copy.ko.json`은 키를 똑같이 맞춰 두기만 한다 (화면에서 고르지 않는다 — 번역은 AI 레인의 일).
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

export type CopyParams = Record<string, string | number>;

/**
 * 문구 1개. 없는 키면 예외, 채우지 못한 자리표시자가 남으면 예외.
 * `params`에 남는 값이 있어도 예외다 (키를 잘못 짚은 것을 조용히 넘기지 않는다).
 */
export function t(key: string, params?: CopyParams): string {
  const template = EN[key];
  if (typeof template !== 'string' || META_KEYS.includes(key)) {
    throw new Error(`화면 문구가 없다: ${key} (config/copy.en.json에 키를 더한다)`);
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
