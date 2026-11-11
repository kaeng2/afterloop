/**
 * 예측 자리 — **서버용 어댑터** (T076 → T079, SPEC v2.11 8-2장, 계약 9부). **서버에서만** 부른다.
 *
 * 엔진 예측(T075 `src/engine/forecast.ts`)을 그대로 부르고 결과를 옮긴다. 화면은 이 파일의 함수만 부르고,
 * 숫자를 만들지 않는다. 엔진이 예외를 던지면(설정이 깨졌을 때 등) `null`(쓸 수 없음) → 화면은 그 칸만 숨긴다.
 *
 * - `loadRiskCurve` → `riskCurve(events, board, …, { calibration })`. 보정 값은 **답장 예측과 같은 것**
 *   (`replyCalibration` = `forecastReply`의 기본 초안 보정)을 넘긴다 → 곡선 마지막 점 = 같은 상황의 빈 글 위험,
 *   "Your draft" 점 = 답장 칸의 `forecastReply` 값 (같은 보정 위).
 * - `loadWeeklySummary` → `weeklySummary({ boards, aiDrafts, usesDemoData })`. `aiDrafts`는 AI 캐시 파일에서
 *   답장 초안 응답(`draft_en` 칸이 있는 항목) 수를 **센다** (`countCachedDrafts`). 캐시가 없으면 그 칸을 숨긴다.
 * - `loadMoveForecasts` → `forecastMoves(...)`. `pChargeback`만 옮긴다 (막힌 수는 null → 빼고 넘긴다).
 *   기대 손실은 화면이 `recommend` 값을 쓴다 (이 함수의 금액을 쓰지 않는다).
 *
 * `translated`: 답장이 보낼 때 구매자 언어로 번역되면 참 (`replyTranslated`). 답장 칸(`forecast-client.ts`)과
 * 같은 값을 넘겨야 보정이 같다 — 사례 화면(`case-detail.tsx`)이 한 번 정해 양쪽에 준다.
 */
import 'server-only';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { forecastMoves, replyCalibration, riskCurve, weeklySummary } from '@/engine/forecast';
import type { BoardState, CaseEvent, EscalationSignals, RiskPoint, WeeklySummary } from '@/types';

import { LLM_CACHE_RELATIVE_PATH, parseLlmCache } from '../_server/llm-cache';
import type { MoveForecast } from './desk-model';

export type { MoveForecast };

/** 답장 예측의 기준 상황 (답장 칸과 같은 값). 기본 초안·신호가 없으면 곡선은 보정 없이(c = 0) 그린다. */
export type ForecastAnchor = {
  signals: EscalationSignals | null;
  delayDays: number;
  anchorText: string | null;
  translated: boolean;
};

/** 보낼 글이 구매자 언어로 번역되는가 (영어가 아닌 구매자 언어를 알 때). 답장 칸·곡선·선택지가 같은 값을 쓴다. */
export function replyTranslated(buyerLocale: string | null | undefined): boolean {
  return typeof buyerLocale === 'string' && buyerLocale !== '' && buyerLocale !== 'en';
}

/** 답장 예측과 같은 보정 상수. 기준 초안·신호가 없으면 `undefined` (엔진이 c = 0으로 본다). */
function calibrationFor(board: BoardState, anchor: ForecastAnchor | undefined): number | undefined {
  if (anchor === undefined || anchor.signals === null || anchor.anchorText === null) return undefined;
  return replyCalibration({
    anchorText: anchor.anchorText,
    board,
    signals: anchor.signals,
    delayDays: anchor.delayDays,
    translated: anchor.translated,
  });
}

/** 위험 곡선: 사건마다 점 하나 (`events`와 길이·순서 같음). 쓸 수 없으면 `null`. */
export function loadRiskCurve(
  events: readonly CaseEvent[],
  board: BoardState,
  anchor?: ForecastAnchor,
): RiskPoint[] | null {
  if (events.length === 0) return null;
  try {
    const calibration = calibrationFor(board, anchor);
    return riskCurve([...events], board, undefined, undefined, undefined, { calibration });
  } catch {
    return null;
  }
}

// ───────────────────────────── AI 캐시의 초안 수 ─────────────────────────────

let cachedCount: { file: string; count: number | null } | null = null;

/**
 * AI 캐시 파일에서 답장 초안 응답(`draft_en` 글자 칸이 있는 항목) 수를 센다 — 셈이지 계산이 아니다.
 * 파일이 없거나 깨졌거나 항목이 하나도 없으면 `null` (0이라고 보이지 않고 칸을 숨긴다).
 * 앱 실행 중에 새로 받은 응답(프로세스 기억)은 세지 않는다 — 파일 기준 (계약: "캐시 기준").
 */
export function countCachedDrafts(file: string = path.join(process.cwd(), LLM_CACHE_RELATIVE_PATH)): number | null {
  if (cachedCount !== null && cachedCount.file === file) return cachedCount.count;
  let count: number | null = null;
  try {
    if (existsSync(file)) {
      const cache = parseLlmCache(readFileSync(file, 'utf8'));
      const entries = Object.values(cache.entries);
      count =
        entries.length === 0
          ? null
          : entries.filter((entry) => {
              const response = entry.response;
              return (
                typeof response === 'object' &&
                response !== null &&
                typeof (response as { draft_en?: unknown }).draft_en === 'string'
              );
            }).length;
    }
  } catch {
    count = null;
  }
  cachedCount = { file, count };
  return count;
}

/** 시험용: 센 값 기억을 지운다. */
export function resetCachedDraftCount(): void {
  cachedCount = null;
}

/** 이번 주 카드 값. `aiDraftsCounted`가 거짓이면 AI 초안 칸을 숨긴다 (캐시 없음). */
export type WeeklyLoad = { summary: WeeklySummary; aiDraftsCounted: boolean };

/** 왼쪽 "이번 주" 카드. 쓸 수 없으면 `null` (열린 분쟁 수와 사실 한 줄만 보인다). */
export function loadWeeklySummary(input: {
  boards: readonly BoardState[];
  usesDemoData: boolean;
  /** 시험용: 초안 수를 세는 함수 (기본은 AI 캐시 파일). */
  countDrafts?: () => number | null;
}): WeeklyLoad | null {
  try {
    const drafts = (input.countDrafts ?? countCachedDrafts)();
    const summary = weeklySummary({
      boards: [...input.boards],
      aiDrafts: drafts ?? 0,
      usesDemoData: input.usesDemoData,
    });
    return { summary, aiDraftsCounted: drafts !== null };
  } catch {
    return null;
  }
}

/** 선택지 카드의 수별 예상 차지백 %. 쓸 수 없으면 `null` (% 줄을 숨긴다). */
export function loadMoveForecasts(input: {
  board: BoardState;
  signals: EscalationSignals | null;
  delayDays: number;
  anchorText: string | null;
  translated?: boolean;
}): MoveForecast[] | null {
  if (input.signals === null || input.anchorText === null) return null;
  try {
    const moves = forecastMoves({
      anchorText: input.anchorText,
      board: input.board,
      signals: input.signals,
      delayDays: input.delayDays,
      translated: input.translated === true,
    });
    return moves.flatMap((item) => (item.pChargeback === null ? [] : [{ move: item.move, pChargeback: item.pChargeback }]));
  } catch {
    return null;
  }
}
