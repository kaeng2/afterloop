/**
 * 수선 답장의 기간 값 (T120b, SPEC v2.16). 기간(영업일)은 `config/rules.json`의 `reply.repairDays`(가정값)에서
 * 읽고, 모델은 숫자를 보지 못한다 — 초안에는 `⟦DAYS_1⟧`만 쓰이고 값은 전송 직전 `fillTokens`가 채운다.
 *
 * 설정에 키가 없거나 모양이 틀리면 `null`이다. 그러면 호출자가 `⟦DAYS_1⟧` 사실값을 `facts`에 넣지 않고,
 * 프롬프트가 "그 토큰이 없으면 기간 문장을 뺀다"고 시키므로 기간을 지어낸 초안이 나가지 않는다.
 */
import { repairDaysFact, type FactLocale } from '@/ai/tokens';
import type { FactToken } from '@/types';

import rulesConfigJson from '../../config/rules.json';

/** 설정의 수선 기간 (영업일, 1 이상 정수). 없거나 틀리면 `null`. */
export function repairDaysFromConfig(config: unknown = rulesConfigJson): number | null {
  const reply = (config as { reply?: { repairDays?: unknown } } | null)?.reply;
  const days = reply?.repairDays;
  return typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= 999 ? days : null;
}

/** 수선 답장에 넘길 사실값. 설정에 기간이 없으면 빈 배열이다 (기간 문장은 빠진다). */
export function repairFacts(locale: FactLocale, config?: unknown): FactToken[] {
  const days = repairDaysFromConfig(config);
  return days === null ? [] : [repairDaysFact(days, locale)];
}
