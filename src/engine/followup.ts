/**
 * 답장 속 확인 기한 날짜 (SPEC v2.5 3장 "답장 속 확인 기한 날짜". 인수 테스트 AC30이 정본).
 *
 * 원문 예시의 "by Nov 17" 같은 날짜는 **코드가 만든다**. AI 초안에는 `⟦DATE_1⟧` 토큰만 들어가고
 * 이 파일이 그 값을 정한다 (SPEC 3장 "사실값은 LLM이 쓰지 않는다").
 *
 * 날짜 = `now`의 UTC 날짜 + `config/rules.json`의 `reply.followUpDays`(7일).
 * 그 날짜가 분쟁 응답 기한 날짜보다 **늦으면** 기한 하루 전으로 당긴다 (같은 날이면 그대로).
 * 당긴 날짜가 오늘보다 앞서지는 않고, 응답 기한이 없으면(빈 문자열) 당기지 않는다.
 *
 * `Date.now()`·로컬 시간대·`Math.random`을 읽지 않으므로 같은 입력이면 항상 같은 결과다.
 * 시각 계산은 모두 UTC 밀리초 정수로 하고, 날짜 표기는 `toISOString`(UTC)만 쓴다.
 * 입력 객체는 바꾸지 않는다 (zod `parse`가 만든 사본만 읽는다).
 */
import { z } from 'zod';

import rulesConfigJson from '../../config/rules.json';
import type { FactToken, FollowUpDateFn, ReplyPolicy } from '@/types';

/** `FollowUpDateFn`의 입력 (계약: `src/types.ts` 9부). */
export type FollowUpInput = { now: string; disputeDueDate: string };

export const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// ───────────────────────────── ISO 8601 → UTC 밀리초 ─────────────────────────────

/**
 * `2026-11-10`, `2026-11-10T17:00:00Z`, `2026-11-30T00:37:46.766Z`, `2026-11-10T02:00:00+09:00`.
 * 날짜만 있으면 그날 00:00 UTC로 본다. 시각에 시간대 표기가 없어도 UTC로 본다 —
 * 로컬 시간대를 끌어들이지 않는 쪽이 "같은 입력이면 같은 결과"에 맞다.
 */
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|z|[+-]\d{2}:?\d{2})?)?$/;

/** 윤년 규칙만 쓴다 (`Date`의 넘침 보정에 기대지 않으려고 자리수를 직접 본다). */
function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * ISO 8601 날짜·날짜시각 → UTC 밀리초. 없는 날짜(`2026-02-30`)와 범위를 넘는 시각은 예외다.
 * `Date` 생성자의 느슨한 해석(`new Date('2026-13-45')`, 로컬 시간대 해석)에 기대지 않는다.
 *
 * 예외 문구에는 **값을 싣지 않는다** (구매자 글의 시각이 로그에 남지 않게. SPEC 10장).
 * `label`은 어느 입력이 잘못됐는지만 알려 준다.
 *
 * 공용 날짜 도우미를 `src/engine/date.ts`에 두는 쪽이 맞지만, T044의 수정 가능 폴더가
 * 이 파일과 `signals.ts`뿐이어서 여기에 두고 `signals.ts`가 가져다 쓴다 (보고서에 적었다).
 */
export function parseUtcInstant(raw: string, label: string): number {
  const parts = ISO_INSTANT.exec(raw);
  if (!parts) throw new Error(`${label}는 ISO 8601 날짜(YYYY-MM-DD) 또는 날짜시각이어야 한다`);

  const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const [hour, minute, second] = [Number(parts[4] ?? 0), Number(parts[5] ?? 0), Number(parts[6] ?? 0)];
  const ms = Number(`${parts[7] ?? ''}000`.slice(0, 3));
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`${label}가 없는 날짜다`);
  }
  if (hour > 23 || minute > 59 || second > 59) throw new Error(`${label}의 시각이 범위를 넘는다`);

  const zone = parts[8];
  let offsetMs = 0;
  if (zone !== undefined && zone !== 'Z' && zone !== 'z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(-2));
    if (offsetHour > 23 || offsetMinute > 59) throw new Error(`${label}의 시간대 표기가 범위를 넘는다`);
    offsetMs = (zone.startsWith('-') ? -1 : 1) * (offsetHour * 60 + offsetMinute) * 60_000;
  }
  return Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMs;
}

/** 그 시각이 든 UTC 날짜의 00:00. 음수(1970 이전)에서도 내림으로 맞는다. */
function startOfUtcDay(ms: number): number {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

/** UTC 날짜 `YYYY-MM-DD`. 로컬 시간대가 끼어들 곳이 없다. */
function utcDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ───────────────────────────── 정책 ─────────────────────────────

/**
 * 답장 정책 (`config/rules.json`의 `reply`). `PolicyConfigSchema`는 건드리지 않는다 —
 * `PolicyConfig`에 `reply`가 없고(계약은 `ReplyPolicy`로 따로 두었다) 이 파일만 쓰는 값이다.
 * `note` 같은 설명 필드는 버린다 (`strict`가 아니다).
 */
const ReplyPolicySchema = z.object({ followUpDays: z.number().int().min(1) });

const FollowUpInputSchema = z.object({ now: z.string(), disputeDueDate: z.string() });

/** `config/rules.json`의 `reply` 원본 (검증 전). 설정에 없으면 zod가 예외를 던진다. */
function replyPolicyFromConfig(): unknown {
  return (rulesConfigJson as { reply?: unknown }).reply;
}

// ───────────────────────────── 공개 함수 ─────────────────────────────

/**
 * 답장에 넣을 확인 기한 날짜 (`YYYY-MM-DD`, UTC 날짜).
 * `policy`를 안 주면 `config/rules.json`의 `reply`를 읽는다.
 * `now`가 날짜가 아니거나, `disputeDueDate`가 비어 있지 않은데 날짜가 아니면 예외다.
 */
export const followUpDate: FollowUpDateFn = (input, policy) => {
  const checked = FollowUpInputSchema.parse(input);
  const { followUpDays } = ReplyPolicySchema.parse(policy ?? replyPolicyFromConfig());

  const today = startOfUtcDay(parseUtcInstant(checked.now, 'now'));
  const target = today + followUpDays * MS_PER_DAY;
  if (checked.disputeDueDate === '') return utcDateString(target);

  const dueDay = startOfUtcDay(parseUtcInstant(checked.disputeDueDate, 'disputeDueDate'));
  if (target <= dueDay) return utcDateString(target);
  // 기한보다 늦으면 하루 전으로 당기되, 오늘보다 앞서지는 않는다 (지난 기한 포함)
  return utcDateString(Math.max(dueDay - MS_PER_DAY, today));
};

/**
 * 답장 초안의 날짜 토큰. 글자가 `src/ai/tokens.ts`의 토큰 문법(`⟦종류_번호⟧`)과 같아야 한다.
 * 그 파일을 import하지 않고 글자만 맞춘다 — 엔진은 ai 레인 코드에 기대지 않는다
 * (글자가 같은지는 `tests/unit/followup.test.ts`가 코드포인트로 확인한다).
 */
export const FOLLOW_UP_DATE_TOKEN = '⟦DATE_1⟧';

/**
 * 답장에 넣는 사실값 묶음. 지금은 확인 기한 날짜 하나다.
 * 값은 ISO 날짜이고, 구매자 언어 표기는 `src/ai/tokens.ts`의 `formatFact`가 만든다.
 */
export function replyFacts(input: FollowUpInput, policy?: ReplyPolicy): FactToken[] {
  return [{ token: FOLLOW_UP_DATE_TOKEN, kind: 'DATE', value: followUpDate(input, policy) }];
}
