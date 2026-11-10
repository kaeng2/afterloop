/**
 * 답장 인사말·서명의 이름 토큰 (T056, SPEC v2.9 3장 "이름 토큰").
 *
 * 이름은 AI에 **값으로 보내지 않는다.** 초안·전송본에는 `⟦BUYER_NAME_1⟧`·`⟦SELLER_NAME_1⟧` 토큰만 나오고,
 * 값은 코드가 `config/rules.json`의 `reply.names`(타입 `ReplyNames`)에서 골라 `fillTokens`로 채운다.
 * 프롬프트에는 다른 사실값처럼 토큰 이름·종류·뜻만 간다 (`src/ai/prompts/reply.ts`).
 *
 * - `⟦SELLER_NAME_1⟧`은 언제나 하나 (값 = `sellerSignature`).
 * - `⟦BUYER_NAME_1⟧`은 `names.buyers[buyerId][locale]`이 있을 때만. 표에 없는 구매자(buyer_m 등)는
 *   이름 토큰을 만들지 않는다 — 마스킹된 아이디를 이름처럼 쓰지 않는다 (AC32).
 * - 구매자 꼴에는 그 언어의 호칭이 이미 들어 있다 (`서연 님`).
 *
 * 순수 코드다. 입력을 바꾸지 않고, 같은 입력이면 같은 결과다.
 */
import { z } from 'zod';

import rulesConfigJson from '../../config/rules.json';
import type { FactLocale } from '@/ai/tokens';
import type { FactToken, ReplyNames } from '@/types';

/** 구매자 이름 토큰. 한 답장에 한 사람이므로 번호는 1뿐이다. */
export const BUYER_NAME_TOKEN = '⟦BUYER_NAME_1⟧';
/** 판매자 서명 토큰. */
export const SELLER_NAME_TOKEN = '⟦SELLER_NAME_1⟧';

/**
 * 이름 값 한 개. 비어 있으면 안 되고, 토큰·자리표시자 괄호와 가림 표시(`*`)가 들어 있으면 안 된다 —
 * 값에 `⟦`가 있으면 `fillTokens`가 거부하고, `{{`가 있으면 실행 층이 자리표시자로 읽고,
 * `*`는 마스킹된 아이디(`buyer_m***`)를 이름으로 쓴 것이다 (AC32와 같은 기준).
 */
const NameValue = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/[*⟦⟧]|\{\{|\}\}/.test(value), { message: '이름 값에 쓸 수 없는 글자가 있다' });

const NameForms = z.object({
  en: NameValue.optional(),
  ko: NameValue.optional(),
  ja: NameValue.optional(),
  de: NameValue.optional(),
});

const ReplyNamesSchema: z.ZodType<ReplyNames> = z.object({
  sellerSignature: NameValue,
  buyers: z.record(z.string(), NameForms),
});

/**
 * `reply.names`를 읽는다. 모양이 틀리면 예외 (설정이 깨진 채로 이름 없는 서명이 나가지 않게).
 * 인자를 주면 그것을 검사한다 (단위 테스트가 깨진 설정을 넘겨 본다). 안 주면 `config/rules.json`.
 */
export function loadReplyNames(source?: unknown): ReplyNames {
  // `??`를 쓰지 않는다 — `null`을 넘기면 설정으로 넘어가지 않고 그대로 검사해서 예외가 나야 한다
  const raw = source === undefined ? (rulesConfigJson as { reply?: { names?: unknown } }).reply?.names : source;
  return ReplyNamesSchema.parse(raw);
}

/**
 * 한 언어의 이름 사실값. 서명 1개 + (있으면) 구매자 이름 1개.
 * `buyerId`가 없거나, 표에 없거나, 그 언어 꼴이 없으면 구매자 이름 토큰을 만들지 않는다.
 */
export function nameFacts(input: { names: ReplyNames; buyerId?: string; locale: FactLocale }): FactToken[] {
  const facts: FactToken[] = [];
  const buyer = buyerName(input.names, input.buyerId, input.locale);
  if (buyer !== undefined) facts.push({ token: BUYER_NAME_TOKEN, kind: 'BUYER_NAME', value: buyer });
  facts.push({ token: SELLER_NAME_TOKEN, kind: 'SELLER_NAME', value: input.names.sellerSignature });
  return facts;
}

/**
 * 같은 분쟁의 초안용(영어)·전송본용(구매자 언어) 이름 사실값. 토큰 이름은 같고 값만 다르다.
 *
 * 구매자 이름은 **두 언어 꼴이 다 있을 때만** 양쪽에 만든다. 한쪽에만 있으면 초안의 `⟦BUYER_NAME_1⟧`이
 * 전송본에 채울 값이 없거나(전송본 언어 꼴 없음) 그 반대가 되어 토큰 검사가 막아 버린다.
 */
export function nameFactsPair(input: {
  names: ReplyNames;
  buyerId?: string;
  draftLocale: FactLocale;
  outgoingLocale: FactLocale;
}): { draft: FactToken[]; outgoing: FactToken[] } {
  const both =
    buyerName(input.names, input.buyerId, input.draftLocale) !== undefined &&
    buyerName(input.names, input.buyerId, input.outgoingLocale) !== undefined;
  const buyerId = both ? input.buyerId : undefined;
  return {
    draft: nameFacts({ names: input.names, buyerId, locale: input.draftLocale }),
    outgoing: nameFacts({ names: input.names, buyerId, locale: input.outgoingLocale }),
  };
}

/** 구매자 이름 한 언어 꼴. `Object.hasOwn`으로 본다 (`toString` 같은 상속 키에 맞지 않게). */
function buyerName(names: ReplyNames, buyerId: string | undefined, locale: FactLocale): string | undefined {
  if (buyerId === undefined || !Object.hasOwn(names.buyers, buyerId)) return undefined;
  const forms = names.buyers[buyerId];
  if (!Object.hasOwn(forms, locale)) return undefined;
  const value = forms[locale]?.trim();
  return value === undefined || value === '' ? undefined : value;
}
