/**
 * 사건 기록 AI 요약 — **서버용 어댑터** (T076 → T079, SPEC v2.11 2장). **서버에서만** 부른다.
 *
 * `summarizeCaseHistory`(T077, `src/ai/history.ts`)를 부른다. 성공하면 요약 글, 실패(`ai_unavailable`·
 * `invalid_output`)·키 없음이면 `null` → 사건 기록 카드의 요약 줄을 숨긴다 (기본 문구 없음).
 *
 * **이름은 AI에 값으로 보내지 않는다** (SPEC 3장 이름 토큰, T077 검증): 사건 글 속 구매자 이름(시드 이름의 각 낱말,
 * `reply.names`의 구매자 꼴)은 `⟦BUYER_NAME_1⟧`로, 판매자 서명(`reply.names.sellerSignature`)은 "the seller"로
 * 바꾼 사건 목록을 넘긴다. 화면에 보이는 사건 기록 글은 바꾸지 않는다 (AI에 넘기는 사본만).
 * 요약에 `⟦BUYER_NAME_1⟧`이 나오면 코드가 영어 이름 꼴로 채운다 (꼴이 없으면 "the buyer").
 *
 * 부르는 곳은 사례를 읽는 서버 함수 `view/load.ts`의 `loadCase`(AI 초안을 만드는 같은 길)다 — AI 캐시 만들기
 * 스크립트가 도는 경로라 요약도 캐시에 들어간다.
 */
import 'server-only';

import { summarizeCaseHistory } from '@/ai/history';
import { BUYER_NAME_TOKEN, loadReplyNames } from '@/ai/names';
import type { CaseEvent, LlmCaller, ReplyNames } from '@/types';

import { getLlm } from '../_server/llm';

/** 판매자 이름 대신 쓰는 말 (토큰이 아니다 — 요약 검사는 구매자 토큰만 받는다). */
const SELLER_WORDS = 'the seller';
/** 이름 꼴이 없을 때 요약 속 토큰을 채우는 말. */
const BUYER_WORDS = 'the buyer';

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const HONORIFIC = /\s*님$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 이름 낱말 목록 (긴 것 먼저). 두 글자 미만은 뺀다 (한 글자 낱말로 다른 말을 지우지 않게). */
function nameWords(values: readonly string[]): string[] {
  const words = new Set<string>();
  for (const raw of values) {
    const value = raw.replace(HONORIFIC, '').trim();
    if (value.length >= 2) words.add(value);
    for (const part of value.split(/[\s,]+/)) {
      const word = part.trim();
      if (word.length >= 2) words.add(word);
    }
  }
  return [...words].sort((a, b) => b.length - a.length);
}

/** 낱말 하나를 바꾸는 정규식. 라틴 글자는 낱말 경계, 한글은 붙은 조사가 있어도 바꾼다. */
function wordPattern(word: string): RegExp {
  const body = escapeRegExp(word);
  return HANGUL.test(word) ? new RegExp(body, 'g') : new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu');
}

function replaceWords(text: string, words: readonly string[], by: string): string {
  return words.reduce((out, word) => out.replace(wordPattern(word), by), text);
}

export type HistoryNames = {
  /** 시드 구매자 번호 (`reply.names.buyers`의 키). */
  buyerId: string | null;
  /** 시드 구매자 이름 ("김서연 Seo-yeon Kim"). */
  buyerName: string | null;
};

/**
 * AI에 넘길 사건 사본: 구매자 이름 → `⟦BUYER_NAME_1⟧`, 판매자 서명 → "the seller". 화면 글은 그대로 둔다.
 * 순수 함수 (시험용으로 내보낸다).
 */
export function tokenizeHistoryNames(
  events: readonly CaseEvent[],
  who: HistoryNames,
  names: ReplyNames = loadReplyNames(),
): CaseEvent[] {
  const buyerForms =
    who.buyerId !== null && Object.hasOwn(names.buyers, who.buyerId) ? Object.values(names.buyers[who.buyerId]) : [];
  const buyer = nameWords([...(who.buyerName === null ? [] : [who.buyerName]), ...buyerForms.filter((v): v is string => typeof v === 'string')]);
  const seller = nameWords([names.sellerSignature]);
  return events.map((event) => ({
    ...event,
    text: replaceWords(replaceWords(event.text, buyer, BUYER_NAME_TOKEN), seller, SELLER_WORDS),
  }));
}

/** 요약 속 토큰을 채운다: 영어 이름 꼴(`reply.names.buyers[id].en`), 없으면 "the buyer". */
function fillBuyer(summary: string, buyerId: string | null, names: ReplyNames): string {
  const en = buyerId !== null && Object.hasOwn(names.buyers, buyerId) ? names.buyers[buyerId].en?.trim() : undefined;
  return summary.split(BUYER_NAME_TOKEN).join(en === undefined || en === '' ? BUYER_WORDS : en);
}

/** 사건 기록 요약 (영어 1~2문장). 쓸 수 없으면 `null`. `llm`은 시험용 주입 (기본 = `getLlm()`). */
export async function loadHistorySummary(
  events: readonly CaseEvent[],
  who: HistoryNames = { buyerId: null, buyerName: null },
  deps: { llm?: LlmCaller; names?: ReplyNames } = {},
): Promise<string | null> {
  if (events.length === 0) return null;
  let llm = deps.llm;
  if (llm === undefined) {
    const resolved = getLlm();
    if (!resolved.ok) return null;
    llm = resolved.llm;
  }
  try {
    const names = deps.names ?? loadReplyNames();
    const result = await summarizeCaseHistory(
      { events: tokenizeHistoryNames(events, who, names), buyerFirstNameToken: BUYER_NAME_TOKEN, locale: 'en' },
      { llm },
    );
    return result.ok ? fillBuyer(result.summary, who.buyerId, names) : null;
  } catch {
    return null;
  }
}
