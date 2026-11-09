/**
 * 메시지 초안의 자리표시자 채우기 (SPEC v2.1 9-1장, 보강 T027).
 *
 * LLM 초안은 신뢰하지 않는 입력이다. 금액은 자리표시자로만 받는다. 호출 전에 거부하는 것:
 * - 금액을 직접 쓴 초안 (통화 기호·통화 이름·통화 코드·소수 둘째 자리 수)
 * - 모르는 자리표시자, 금액이 없는 계획의 금액 자리표시자
 * - 채운 뒤에도 남은 토큰 (`{{…}}`, 사실값 토큰 `⟦…⟧`)
 * - 채운 뒤 빈 메시지
 *
 * 거부 문구에 초안 내용과 토큰 이름을 싣지 않는다 (구매자 정보가 토큰 안에 들어올 수 있다).
 * `⟦…⟧`는 이 층에서 채우지 않는다 (채우는 것은 ai 레인의 토큰 검사, T010).
 */
import type { ActionPlan, BoardState } from '@/types';

import { centsToDisplay } from './amount';
import { EXEC_COPY, format, type Rejection } from './copy';

/** 자리표시자 이름 → 금액 출처. plan = `plan.amountCents`, board = `board.amountCents`. */
const SOURCES = new Map<string, 'plan' | 'board'>([
  ['offerAmount', 'plan'],
  ['refundAmount', 'plan'],
  ['disputeAmount', 'board'],
]);

/** `{{offerAmount}}`, `{{ offerAmount }}` 모두 잡는다. */
const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** 반각·전각 숫자 (전각 `７`도 금액이다). */
const DIGIT = '[0-9０-９]';
/** 반각·전각 통화 기호: `$ ＄ ¢ ₩ ￦ € £ ¥ ￥ ￡`. */
const CURRENCY_SYMBOL = '[$＄¢₩￦€£¥￥￡]';
/** 통화 코드. */
const CURRENCY_CODE = '(?:USD|KRW|EUR|GBP|JPY)';
/** 통화 이름 (`U.S. dollars`의 `U.S.`도 허용). */
const CURRENCY_WORD = `(?:달러|센트|(?:U\\.?\\s?S\\.?\\s?)?(?:dollars?|cents?|bucks?))`;

/**
 * 금액을 직접 쓴 부분 (SPEC 9-1장 "메시지 안 금액 = API 본문 금액").
 * 금액이 아닌 수는 막지 않는다: 날짜(`11/12`, `2026-11-12`), 긴 숫자열(주문·추적번호), `3 weeks`·`3주`, `15%`.
 * 경계는 `tests/unit/execute.test.ts`의 표에 적어 둔다.
 */
const LITERAL_AMOUNT: { pattern: RegExp; shape: string }[] = [
  // `$7.20`, `$ 7.20`, `US$7`, `$`+줄바꿈+`7.20`, `＄７`, `₩9,600`, `€7`
  { pattern: new RegExp(`${CURRENCY_SYMBOL}\\s*${DIGIT}`), shape: EXEC_COPY.literalShapeSymbolBefore },
  // `7.20 USD`, `7.20USD`, `5 usd`, `7달러`, `7.20달러`, `7 dollars`, `7 U.S. dollars`, `20 cents`
  { pattern: new RegExp(`${DIGIT}\\s*(?:${CURRENCY_CODE}|${CURRENCY_WORD})`, 'i'), shape: EXEC_COPY.literalShapeCurrencyWordAfter },
  // `USD 7.20`, `USD7.20`
  { pattern: new RegExp(`${CURRENCY_CODE}\\s*${DIGIT}`, 'i'), shape: EXEC_COPY.literalShapeCurrencyCodeBefore },
  // 통화 표기 없이 소수 둘째 자리까지 적힌 수: `7.20`, `７.２０`. 셋째 자리 이상은 금액 표기가 아니다
  { pattern: new RegExp(`${DIGIT}[.．]${DIGIT}{2}(?!${DIGIT})`), shape: EXEC_COPY.literalShapeDecimal },
];

/** 채운 뒤에도 남아 있으면 안 되는 토큰 조각: `{{…}}`와 사실값 토큰 `⟦…⟧` (SPEC 3장). */
const LEFTOVER_TOKEN = /\{\{|\}\}|⟦|⟧/;

export type FillResult = { ok: true; message: string } | ({ ok: false } & Rejection);

function reject(error: string, nextAction: string): FillResult {
  return { ok: false, error, nextAction };
}

/**
 * 초안의 자리표시자를 `plan`·`board` 금액으로 바꾼다. 표기는 `$7.20`.
 * 통과한 메시지는 토큰이 없고 비어 있지 않다 (`request.ts`가 그대로 본문에 담는다).
 */
export function fillMessage(template: string, plan: ActionPlan, board: BoardState): FillResult {
  for (const { pattern, shape } of LITERAL_AMOUNT) {
    if (pattern.test(template)) {
      return reject(format(EXEC_COPY.literalAmount, { shape }), EXEC_COPY.nextFixDraft);
    }
  }

  const names = [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
  if (names.some((name) => !SOURCES.has(name))) {
    return reject(EXEC_COPY.unknownPlaceholder, EXEC_COPY.nextFixDraft);
  }

  for (const name of new Set(names)) {
    if (SOURCES.get(name) === 'plan' && plan.amountCents === null) {
      return reject(EXEC_COPY.placeholderWithoutAmount, EXEC_COPY.nextFixPlan);
    }
  }

  const message = template.replace(PLACEHOLDER, (_whole, name: string) =>
    centsToDisplay(SOURCES.get(name) === 'plan' ? (plan.amountCents as number) : board.amountCents),
  );

  if (LEFTOVER_TOKEN.test(message)) {
    return reject(EXEC_COPY.tokensRemaining, EXEC_COPY.nextRegenerateDraft);
  }
  if (message.trim() === '') {
    return reject(EXEC_COPY.messageEmpty, EXEC_COPY.nextFixDraft);
  }

  return { ok: true, message };
}
