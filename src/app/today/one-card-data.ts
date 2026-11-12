/**
 * 한 장 카드(T122c)에 넣을 값 모으기. **계산하지 않는다** — 엔진 결과(`Recommendation.all`의 기대 손실)와
 * 데이터(분쟁 글·시드)를 골라 표기만 바꾼다 (`toDollarsRounded`). 문구는 `config/copy.*.json`의 `card.*`.
 */
import type { Evaluation, Recommendation } from '@/types';

import { copyTables, currentLocale, t, type CopyParams, type Locale } from '../_shared/copy';
import { toDollarsRounded } from '../_shared/money';
import type { CaseMessageView } from '../cases/model';
import { translatedFor, type OneCardMessage } from './one-card';

/**
 * 문구 하나를 채우되, 그 언어의 문구에 있는 자리표시자만 넘긴다. 시안 en·ko 문장은 쓰는 값이 다르다
 * (예: en "Read her Korean message" ↔ ko "지호 님의 메시지를 읽었어요") — `t`는 남는 값을 예외로 보므로 걸러 준다.
 */
export function tPick(key: string, params: CopyParams, locale: Locale = currentLocale()): string {
  const template = copyTables[locale][key] ?? '';
  const used = Object.fromEntries(Object.entries(params).filter(([name]) => template.includes(`{{${name}}}`)));
  return t(key, used, locale);
}

/** 구매자 언어 코드(`ko-KR`·`KO`·`ko`) → 두 글자 소문자. 모르면 `null`. */
export function langCode(locale: string | null | undefined): string | null {
  if (locale === null || locale === undefined) return null;
  const code = locale.trim().slice(0, 2).toLowerCase();
  return /^[a-z]{2}$/.test(code) ? code : null;
}

/** 언어 이름 (시안 `langOf`). 표에 없는 언어면 `null`. */
export function languageName(code: string | null): string | null {
  if (code === null) return null;
  const key = `card.langOf.${code}`;
  return copyTables.en[key] === undefined ? null : t(key);
}

/** 엔진이 이 수에 낸 기대 손실 표기 ("$16"). 막혔거나 없으면 `null`. */
export function lossOf(rec: Pick<Recommendation, 'all'>, move: Evaluation['move']): string | null {
  const found = rec.all.find((evaluation) => evaluation.move === move);
  if (found === undefined || found.expectedLossCents === null) return null;
  return toDollarsRounded(found.expectedLossCents);
}

const plain = (segments: { text: string }[] | null): string | null =>
  segments === null ? null : segments.map((segment) => segment.text).join('');

/**
 * 분쟁 글 가운데 마지막 구매자 글 (실제 PayPal 글을 먼저). 없으면 `null`.
 * 번역은 화면 언어가 영어이고 원문이 영어가 아닐 때만 (KO 화면은 영어 번역을 붙이지 않는다 — 시안 ko 사전 `tr: ''`).
 */
export function buyerMessage(
  messages: readonly CaseMessageView[],
  buyerLocale: string | null,
  uiLocale: 'en' | 'ko',
): OneCardMessage | null {
  const real = messages.filter((message) => message.source === 'paypal');
  const pool = real.length > 0 ? real : messages;
  const last = pool[pool.length - 1];
  if (last === undefined) return null;
  const original = plain(last.original);
  if (original === null || original.trim() === '') return null;
  const code = last.originalIsEnglish ? 'en' : langCode(buyerLocale);
  const english = last.originalIsEnglish || uiLocale !== 'en' ? null : plain(last.english);
  return {
    languageName: languageName(code),
    code,
    original,
    translated: translatedFor(english, code, uiLocale),
    tags: [],
  };
}
