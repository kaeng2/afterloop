/**
 * 확대 위험 신호 뽑기 (SPEC v2.5 7장). 공개 함수는 `buildEscalationSignals` 하나다.
 *
 * 분쟁 1건의 데이터(구매자 글, 판매자 답장 시각, 지금 시각, 응답 기한)에서 `EscalationSignals`를 만든다.
 * 신호 → 점수는 이 파일이 하지 않는다 (`src/engine/escalation.ts`의 `escalationRisk`).
 * 네 신호 가운데 `angryTone`만 LLM 판별이고(그대로 옮긴다), 나머지는 코드가 데이터로 정한다.
 *
 * `Date.now()`·로컬 시간대·`Math.random`을 읽지 않으므로 같은 입력이면 항상 같은 결과다.
 * 글의 순서는 보장되지 않으므로 시각 비교로만 판단한다 (배열 순서를 믿지 않는다).
 * 입력 객체는 바꾸지 않는다 (zod `parse`가 만든 사본만 읽는다).
 */
import { z } from 'zod';

import type { EscalationSignals } from '@/types';

import { MS_PER_HOUR, parseUtcInstant } from './followup';

/**
 * 응답 기한이 없는 분쟁(PayPal 심사 중 등 `dueDate`가 빈 값)의 `hoursToDue`.
 * SPEC 7장은 "응답 기한이 없는 분쟁은 기한 점수 0"이라고 정하고, `escalationRisk`는
 * 유한한 수만 받는다(`z.number().finite()`). 그래서 `Infinity` 대신 **유한한 큰 수**를 쓴다.
 * 100년 = 876,000시간이므로 어떤 기준값(72시간)보다 확실히 크다.
 */
export const HOURS_TO_DUE_NONE = 24 * 365 * 100;

/** SPEC 7장 "24시간 넘게 무응답". 24시간과 **같을 때는** 참이 아니다 (넘어야 한다). */
const UNANSWERED_HOURS = 24;
/** SPEC 7장 "두 번째 문의에 무응답". 답하지 않은 구매자 글이 연달아 이만큼 쌓이면 참이다. */
const CONSECUTIVE_UNANSWERED = 2;

/**
 * 은행·카드사·chargeback 언급 낱말 (SPEC 7장, +3). 한곳에서만 고친다.
 *
 * - 한국어: `카드사`, `이의제기`(띄어 쓴 `이의 제기`도 같은 말이다)
 * - 영어: 대소문자를 가리지 않는다. `bank`·`card` 한 낱말은 넣지 않는다 —
 *   `bank holiday`, `카드로 결제했어요`처럼 분쟁과 상관없는 글이 걸린다
 * - 일본어: `カード会社`, `チャージバック` / 독일어: `Kreditkartenunternehmen`, `Rückbuchung`, `meine Bank`
 */
export const CARD_COMPANY_TERMS: readonly string[] = [
  '카드사',
  '이의제기',
  '이의 제기',
  'chargeback',
  'card company',
  'credit card company',
  'my bank',
  'dispute with my card',
  'カード会社',
  'チャージバック',
  'Kreditkartenunternehmen',
  'Rückbuchung',
  'meine Bank',
];

/**
 * 비교하기 전 글을 고르는 방법: 소문자로 바꾸고(라틴 문자만 바뀐다) 이어진 공백·줄바꿈을 한 칸으로 줄인다.
 * 여러 줄에 걸쳐 쓴 `credit card\ncompany`도 같은 낱말로 본다.
 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ');
}

const NORMALIZED_TERMS = CARD_COMPANY_TERMS.map(normalize);

/** 구매자 글 가운데 하나라도 낱말 목록에 걸리면 참. 판매자가 답장한 뒤에도 유지된다 (SPEC 7장 "답장 후 3"). */
function mentionsCardCompanyIn(texts: string[]): boolean {
  return texts.some((text) => {
    const haystack = normalize(text);
    return NORMALIZED_TERMS.some((term) => haystack.includes(term));
  });
}

// ───────────────────────────── 입력 ─────────────────────────────

/**
 * 신호를 만드는 데 쓰는 분쟁 1건의 데이터.
 * `at`은 ISO 날짜(`2026-11-02`, 그날 00:00 UTC로 본다) 또는 날짜시각이다. 순서는 보장되지 않는다.
 */
export type SignalInput = {
  /** 구매자 글 (이전 문의 + 분쟁 접수 글) */
  buyerMessages: { text: string; at: string }[];
  /** 판매자가 답한 시각들 */
  sellerReplies: { at: string }[];
  now: string;
  /** 응답 기한. `''` = 기한 없음 */
  disputeDueDate: string;
  /** 화난 어조 (LLM 판별, T043). 없으면 null */
  angryTone: boolean | null;
};

const SignalInputSchema = z.object({
  buyerMessages: z.array(z.object({ text: z.string(), at: z.string() })),
  sellerReplies: z.array(z.object({ at: z.string() })),
  now: z.string(),
  disputeDueDate: z.string(),
  angryTone: z.boolean().nullable(),
});

/** 빈 배열에서도 안전하게 가장 늦은 시각 (`Math.max(...arr)`는 배열이 길면 호출 자리가 넘친다). */
function latest(instants: number[]): number | null {
  return instants.reduce<number | null>((max, at) => (max === null || at > max ? at : max), null);
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * 분쟁 1건의 확대 위험 신호.
 *
 * - `mentionsCardCompany`: 구매자 글의 낱말로만 정한다. 판매자가 답장해도 사라지지 않는다.
 * - `secondMessageUnanswered`: 답하지 않은 구매자 글이 연달아 2건 이상이고 마지막 글 뒤에 답장이 없을 때.
 * - `unansweredOver24h`: 마지막 구매자 글 뒤에 답장이 없고, 그 글에서 `now`까지 24시간을 넘겼을 때.
 * - 판매자가 마지막 구매자 글 **뒤에** 답했으면 위 두 신호는 거짓이고 `angryTone`은 `null`이다
 *   (SPEC 7장: 판매자가 답장한 뒤에는 구매자의 다음 메시지가 올 때까지 0). 그 뒤 구매자가 다시 쓰면 입력값 그대로.
 * - 같은 시각의 구매자 글과 판매자 답장은 "답장이 뒤"로 보지 않는다 (답하지 않은 것으로 본다 — 막는 쪽).
 * - 구매자 글이 없으면 언급·무응답은 거짓, `angryTone`은 `null`이다.
 *
 * 시각이 ISO 날짜·날짜시각이 아니면 예외다 (`parseUtcInstant`).
 */
export function buildEscalationSignals(input: SignalInput): EscalationSignals {
  const checked = SignalInputSchema.parse(input);

  const nowMs = parseUtcInstant(checked.now, 'now');
  const buyerAt = checked.buyerMessages.map((message, i) => parseUtcInstant(message.at, `buyerMessages[${i}].at`));
  const replyAt = checked.sellerReplies.map((reply, i) => parseUtcInstant(reply.at, `sellerReplies[${i}].at`));

  const hoursToDue =
    checked.disputeDueDate === ''
      ? HOURS_TO_DUE_NONE
      : (parseUtcInstant(checked.disputeDueDate, 'disputeDueDate') - nowMs) / MS_PER_HOUR;

  const mentionsCardCompany = mentionsCardCompanyIn(checked.buyerMessages.map((message) => message.text));
  const quiet = { secondMessageUnanswered: false, unansweredOver24h: false, angryTone: null } as const;

  const lastBuyerAt = latest(buyerAt);
  // 구매자 글이 없으면 무응답을 셀 기준이 없고 어조도 판정할 글이 없다
  if (lastBuyerAt === null) return { mentionsCardCompany, ...quiet, hoursToDue };

  const lastReplyAt = latest(replyAt);
  // 마지막 구매자 글 뒤에 답장이 있으면 (같은 시각은 "뒤"가 아니다) 무응답·어조는 0이다
  if (lastReplyAt !== null && lastReplyAt > lastBuyerAt) return { mentionsCardCompany, ...quiet, hoursToDue };

  /*
   * 답하지 않은 구매자 글의 수. 판매자의 마지막 답장보다 늦은(또는 같은 시각의) 글이 곧
   * "그 뒤로 답장이 없는 글"이고, 그 글들은 저절로 마지막 쪽에 연달아 모인다.
   * 배열 순서를 쓰지 않으므로 글이 뒤섞여 들어와도 결과가 같다.
   */
  const unanswered = buyerAt.filter((at) => lastReplyAt === null || at >= lastReplyAt).length;

  return {
    mentionsCardCompany,
    secondMessageUnanswered: unanswered >= CONSECUTIVE_UNANSWERED,
    unansweredOver24h: (nowMs - lastBuyerAt) / MS_PER_HOUR > UNANSWERED_HOURS,
    angryTone: checked.angryTone,
    hoursToDue,
  };
}
