/**
 * 고친 답장 보내기 (T100, SPEC v2.15 · DECISIONS 2026-11-12 "Yes, allow edited send").
 *
 * 판매자가 입력칸에서 고친 영어(화면에 채워 보인 글)를 **AI에 보내기 전에** 토큰 글로 되돌리고, 번역 뒤에는 **보낼 글
 * 기준으로** 검사를 다시 엮는다. 순수 함수만 둔다 (DOM·네트워크·시계·난수 없음). 서버의 `send.ts` 입구가 부른다.
 *
 * - `revertToTokens`: `fillTokens`(+ 금액 자리표시자 채움)의 반대. 화면에 채워 보인 값 → `⟦DATE_1⟧`·`⟦BUYER_NAME_1⟧`·
 *   `⟦SELLER_NAME_1⟧`·`{{disputeAmount}}` … 되돌릴 수 없는 값(이름을 다르게 썼다)은 그대로 둔다 — 판정은
 *   `checkTokens`·`nameLeftovers`가 한다.
 * - `nameLeftovers`: 되돌린 뒤에도 이름 조각(구매자 이름의 영어·구매자 언어 꼴, 서명의 낱말)이 남았는가. 남으면 **AI를 부르지 않는다**
 *   (SPEC 3장 v2.9: AI에 이름 값을 보내지 않는다. `checkTokens`의 `literalFacts`는 이름을 보지 않는다).
 * - `withEditChecks`: 번역 결과의 검사에 "검사받은 AI 초안에 없던 약속"을 더한다 (환불·재발송·보장 표현 …).
 *   판매자가 직접 넣은 약속은 확인 상자로 풀리지 않는다 — "No new promises"가 실패해 Send가 꺼지고 Details가 펼쳐진다.
 *
 * 숫자를 만들지 않는다. 금액 표기는 실행 층과 같은 함수(`centsToDisplay`)로 만든 글자를 찾기만 한다.
 */
import { findCommitments, type CommitmentCategory } from '@/ai/commitments';
import type { ReplyTranslation } from '@/ai/reply';
import { checkTokens, formatFact, isNameFact } from '@/ai/tokens';
import { centsToDisplay } from '@/exec/amount';
import type { ActionPlan, BoardState, FactToken } from '@/types';

import { shortDate } from '../_shared/short-date';

/** 되돌릴 짝 하나: 화면에 보인 글자 → 토큰(또는 금액 자리표시자). */
type Pair = { shown: string; token: string };

/** 금액 자리표시자 → 출처 (`src/exec/message.ts`의 `SOURCES`와 같은 짝. 실행 층이 같은 이름만 채운다). */
const AMOUNT_SLOTS: { name: string; from: 'plan' | 'board' }[] = [
  { name: 'offerAmount', from: 'plan' },
  { name: 'refundAmount', from: 'plan' },
  { name: 'disputeAmount', from: 'board' },
];

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 글자 앞뒤가 낱말 글자가 아닐 때만 맞춘다 (`Joanna` 안의 `Ann` 같은 겹침을 막는다). */
function boundedPattern(shown: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(shown)}(?![\\p{L}\\p{N}])`, 'gu');
}

/**
 * 화면에 채워 보인 값 → 토큰. `facts`는 **영어 초안 벌**(`caseReplyFacts(...).draft`, 화면 입력칸이 쓴 값)이다.
 * 날짜는 `formatFact(…,'en')` 꼴("November 17")과 칩 꼴("Nov 17", `shortDate`) 둘 다 되돌린다.
 * 금액은 원래 AI 초안(`originalDraftEn`)에 쓰인 자리표시자 + `{{disputeAmount}}`만 되돌린다 (같은 값이면 초안 쪽 이름이 먼저).
 * 긴 글자부터 바꾼다 (서명 전체 "이름, 가게 이름"이 그 안의 이름 한 낱말보다 먼저).
 */
export function revertToTokens(
  text: string,
  facts: FactToken[],
  money: { plan: ActionPlan | null; board: BoardState | null },
  originalDraftEn: string,
): string {
  const pairs: Pair[] = [];
  for (const fact of facts) {
    let shown: string;
    try {
      shown = formatFact(fact.kind, fact.value, 'en');
    } catch {
      continue;
    }
    if (shown.trim() !== '') pairs.push({ shown, token: fact.token });
    if (fact.kind === 'DATE') {
      const short = shortDate(fact.value);
      if (short !== fact.value && short !== shown) pairs.push({ shown: short, token: fact.token });
    }
  }

  const usedSlots = new Set([...originalDraftEn.matchAll(/\{\{\s*([A-Za-z]+)\s*\}\}/g)].map((m) => m[1]));
  const slots = [...AMOUNT_SLOTS].sort((a, b) => Number(usedSlots.has(b.name)) - Number(usedSlots.has(a.name)));
  const seenAmounts = new Set<string>();
  for (const slot of slots) {
    if (!usedSlots.has(slot.name) && slot.name !== 'disputeAmount') continue;
    const cents = slot.from === 'plan' ? (money.plan?.amountCents ?? null) : (money.board?.amountCents ?? null);
    if (cents === null) continue;
    const shown = centsToDisplay(cents);
    if (seenAmounts.has(shown)) continue;
    seenAmounts.add(shown);
    pairs.push({ shown, token: `{{${slot.name}}}` });
  }

  pairs.sort((a, b) => b.shown.length - a.shown.length);
  let out = text;
  for (const pair of pairs) {
    // 금액은 `$` 앞 경계가 없다 — 그대로 찾는다. 나머지는 낱말 경계
    const pattern = pair.token.startsWith('{{') ? new RegExp(escapeRe(pair.shown), 'g') : boundedPattern(pair.shown);
    out = out.replace(pattern, pair.token);
  }
  return out;
}

/** 이름 조각으로 보지 않는 호칭·짧은 낱말. */
const HONORIFICS = new Set(['님', '씨', '様', 'さん', 'さま', '殿', 'herr', 'frau']);

/** 이름 값 → 조각 ("Ann, Oak Shop" → 전체 · Ann · Oak · Shop, "지수 님" → 전체 · 지수). 두 글자 이상만. 호칭은 뺀다. */
export function nameParts(facts: FactToken[]): string[] {
  const parts = new Set<string>();
  for (const fact of facts) {
    if (!isNameFact(fact)) continue;
    const whole = fact.value.trim();
    if (whole !== '') parts.add(whole);
    for (const piece of whole.split(/[\s,.;:!?·、，。]+/u)) {
      const clean = piece.trim();
      if ([...clean].length < 2 || HONORIFICS.has(clean.toLowerCase())) continue;
      parts.add(clean);
    }
  }
  return [...parts];
}

/**
 * 되돌린 글에 남은 이름 조각 (대소문자 무시). 비어 있지 않으면 그 글을 AI에 보내지 않는다.
 * `facts`에는 두 벌(영어 초안 벌 + 전송본 벌)을 모두 넣는다 — 구매자 언어 꼴(호칭 뺀 이름)로 쓴 것도 잡는다.
 */
export function nameLeftovers(tokenized: string, facts: FactToken[]): string[] {
  const lower = tokenized.toLowerCase();
  return nameParts(facts).filter((part) => {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(part.toLowerCase())}(?![\\p{L}\\p{N}])`, 'u');
    return re.test(lower);
  });
}

/** 검사받은 AI 초안에 없던 약속 (돈이 드는 약속 범주 + 확언 표현). */
export type EditAdditions = { commitments: CommitmentCategory[]; promises: string[] };

export function editAdditions(originalDraftEn: string, editedEn: string, facts: FactToken[]): EditAdditions {
  const before = findCommitments(originalDraftEn, 'en');
  const commitments = findCommitments(editedEn, 'en').filter((category) => !before.includes(category));
  // `checkTokens`의 newPromises = 둘째 글에만 있는 확언 표현. 원래 초안 → 고친 글로 넣어 그 칸만 읽는다
  const promises = checkTokens(originalDraftEn, editedEn, facts).newPromises;
  return { commitments, promises };
}

/**
 * 번역 결과에 고친 글의 검사를 더한다. 더한 약속이 있으면 "No new promises" 줄(`check.newPromises`)에 넣고
 * `check.ok`·`sendable`을 끈다. 번역 실패는 그대로 돌려준다.
 */
export function withEditChecks(translation: ReplyTranslation, additions: EditAdditions): ReplyTranslation {
  if (!translation.ok) return translation;
  const extra = [...additions.promises, ...additions.commitments].filter(
    (item) => !translation.check.newPromises.includes(item),
  );
  if (extra.length === 0) return translation;
  return {
    ...translation,
    check: { ...translation.check, ok: false, newPromises: [...translation.check.newPromises, ...extra] },
    sendable: false,
  };
}
