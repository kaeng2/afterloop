/**
 * 사건 기록 요약 (T077, SPEC v2.11). 실제 사건 목록에서만 만든다 — 시안의 문장을 쓰지 않는다.
 *
 * 화면(T076)이 사례를 읽는 서버 함수 안에서 부르고 결과를 AI 캐시에 넣는다.
 * 예외를 던지지 않는다. 실패하면 화면은 그 줄을 숨긴다 (기본 문구 없음).
 *
 * 판정은 코드: 입력에 없는 날짜·숫자, 돈이 드는 약속, 개인정보, 길이·문장 수.
 */
import { z } from 'zod';

import { findCommitments } from '@/ai/commitments';
import { maskPersonal } from '@/ai/prompts/classify';
import {
  BUYER_NAME_TOKEN,
  HISTORY_EVENTS_MAX,
  HISTORY_OUTPUT_SCHEMA,
  HISTORY_SYSTEM,
  SUMMARY_MAX_CHARS,
  SUMMARY_MAX_SENTENCES,
  buildHistoryUser,
} from '@/ai/prompts/history';
import type { CaseEvent, LlmCaller } from '@/types';

export type HistorySummaryInput = { events: CaseEvent[]; buyerFirstNameToken?: string; locale: 'en' };
export type HistorySummary = { ok: true; summary: string } | { ok: false; reason: 'ai_unavailable' | 'invalid_output' };

const OutputSchema = z.object({ summary: z.string() });

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_RE =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const num = (s: string): string => String(Number(s));
const monthIndex = (name: string): number => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;

/** "Nov 5"·"5 Nov"·"11/5" → "11-5" 꼴 키 */
function monthDayPairs(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi'))) {
    out.add(`${monthIndex(m[1]!)}-${num(m[2]!)}`);
  }
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b`, 'gi'))) {
    out.add(`${monthIndex(m[2]!)}-${num(m[1]!)}`);
  }
  for (const m of text.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g)) {
    out.add(`${num(m[1]!)}-${num(m[2]!)}`);
  }
  return out;
}

function digitRuns(text: string): string[] {
  return [...text.matchAll(/\d+/g)].map((m) => num(m[0]));
}

/** 입력 사건에서 나온 허용 값 (날짜 쌍·숫자) */
function allowedFromEvents(events: CaseEvent[]): { pairs: Set<string>; numbers: Set<string> } {
  const pairs = new Set<string>();
  const numbers = new Set<string>();
  for (const e of events) {
    const d = e.at.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (d) {
      pairs.add(`${num(d[2]!)}-${num(d[3]!)}`);
      for (const part of [d[1]!, d[2]!, d[3]!]) numbers.add(num(part));
    }
    for (const p of monthDayPairs(e.text)) pairs.add(p);
    for (const n of digitRuns(e.text)) numbers.add(n);
  }
  return { pairs, numbers };
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?。！？]+/u)
    .map((p) => p.trim())
    .filter((p) => p !== '').length;
}

/** 검사를 통과하면 정리한 요약, 아니면 null */
function validate(raw: string, events: CaseEvent[], buyerToken: string | undefined): string | null {
  const summary = raw.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (summary === '' || summary.length > SUMMARY_MAX_CHARS) return null;
  if (sentenceCount(summary) > SUMMARY_MAX_SENTENCES) return null;

  // 토큰: 입력으로 준 이름 토큰만 허용. 그 밖의 ⟦⟧·{{}}는 거부
  const body = buyerToken === BUYER_NAME_TOKEN ? summary.split(BUYER_NAME_TOKEN).join(' ') : summary;
  if (/[⟦⟧]|\{\{|\}\}/.test(body)) return null;

  if (maskPersonal(body) !== body) return null;
  if (findCommitments(body, 'en').length > 0) return null;

  const { pairs, numbers } = allowedFromEvents(events);
  for (const p of monthDayPairs(body)) if (!pairs.has(p)) return null;
  for (const n of digitRuns(body)) if (!numbers.has(n)) return null;
  return summary;
}

export async function summarizeCaseHistory(
  input: HistorySummaryInput,
  deps: { llm: LlmCaller },
): Promise<HistorySummary> {
  let raw: unknown;
  try {
    raw = await deps.llm({
      system: HISTORY_SYSTEM,
      user: buildHistoryUser(input.events, input.buyerFirstNameToken),
      jsonSchema: HISTORY_OUTPUT_SCHEMA,
    });
  } catch {
    return { ok: false, reason: 'ai_unavailable' };
  }
  const parsed = OutputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid_output' };
  // 프롬프트에 실린 사건만 근거로 본다
  const shown = input.events.slice(-HISTORY_EVENTS_MAX);
  const summary = validate(parsed.data.summary, shown, input.buyerFirstNameToken);
  return summary === null ? { ok: false, reason: 'invalid_output' } : { ok: true, summary };
}
