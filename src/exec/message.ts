/**
 * 메시지 초안의 자리표시자 채우기 (SPEC v2.1 9-1장).
 *
 * LLM 초안은 신뢰하지 않는 입력이다. 금액은 자리표시자로만 받는다:
 * 초안에 금액을 직접 쓴 부분이나 모르는 자리표시자가 있으면 채우지 않고 거부한다 (호출 0회).
 */
import type { ActionPlan, BoardState } from '@/types';

import { centsToDisplay } from './amount';

/** 자리표시자 이름 → 금액 출처. plan = `plan.amountCents`, board = `board.amountCents`. */
const SOURCES = new Map<string, 'plan' | 'board'>([
  ['offerAmount', 'plan'],
  ['refundAmount', 'plan'],
  ['disputeAmount', 'board'],
]);

/** `{{offerAmount}}`, `{{ offerAmount }}` 모두 잡는다. */
const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** 금액을 직접 쓴 부분: `$` 뒤 숫자, 숫자 뒤 USD·달러 (SPEC 9-1장). */
const LITERAL_AMOUNT: { pattern: RegExp; label: string }[] = [
  { pattern: /\$\s*\d/, label: '$ 뒤에 숫자' },
  { pattern: /\d\s*(?:USD|달러)/i, label: '숫자 뒤에 USD·달러' },
];

export type FillResult = { ok: true; message: string } | { ok: false; reason: string };

/**
 * 초안의 자리표시자를 `plan`·`board` 금액으로 바꾼다. 표기는 `$7.20`.
 * 채운 뒤 남은 중괄호가 있으면 거부한다 (금액 문장이 깨진 채로 나가지 않게).
 */
export function fillMessage(template: string, plan: ActionPlan, board: BoardState): FillResult {
  for (const { pattern, label } of LITERAL_AMOUNT) {
    if (pattern.test(template)) {
      return { ok: false, reason: `메시지 초안에 금액을 직접 썼습니다 (${label}). 금액은 자리표시자로만 받습니다` };
    }
  }

  const names = [...template.matchAll(PLACEHOLDER)].map((m) => m[1]);
  const unknown = [...new Set(names.filter((name) => !SOURCES.has(name)))];
  if (unknown.length > 0) {
    return { ok: false, reason: `메시지 초안에 모르는 자리표시자가 있습니다: ${unknown.map((n) => `{{${n}}}`).join(', ')}` };
  }

  for (const name of new Set(names)) {
    if (SOURCES.get(name) === 'plan' && plan.amountCents === null) {
      return { ok: false, reason: `계획에 금액이 없어 {{${name}}}를 채울 수 없습니다` };
    }
  }

  const message = template.replace(PLACEHOLDER, (_whole, name: string) =>
    centsToDisplay(SOURCES.get(name) === 'plan' ? (plan.amountCents as number) : board.amountCents),
  );

  if (message.includes('{{') || message.includes('}}')) {
    return { ok: false, reason: '메시지 초안에 닫히지 않은 자리표시자가 있습니다' };
  }

  return { ok: true, message };
}
