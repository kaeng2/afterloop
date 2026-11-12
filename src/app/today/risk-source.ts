/**
 * 목록 위험 % 칩·전체 현황 표의 값 (T122b, 시안 v6 `RISKP`). **서버에서만** 부른다. 숫자를 만들지 않는다.
 *
 * 분쟁 하나의 값 = 답장 칸이 글이 비었을 때 보이는 **무응답 예측**의 `pChargeback` (T105와 같은 입력·같은 엔진 함수):
 * `forecastReply({ text: '', anchorText, board, signals, delayDays: 답 없는 날 + noReplyDays, translated })`.
 * 입력은 사례 상세(`case-detail.tsx`)와 같은 읽기(`loadCase`·`loadReply`, 요청 안 `cache`)에서 온다 — 상세와 목록이
 * 같은 값을 보인다.
 *
 * 값이 없는 항목은 표에 넣지 않는다 (칩을 그리지 않는다. 지어내지 않는다):
 * - Routine(악용 의심으로 엔진이 건너뛴 분쟁, Mike): 상세에 답장 칸이 없어 AI 초안(= 예측 기준 글)을 만들지 않는다
 *   (LLM 호출을 늘리지 않는다).
 * - 기준 초안·신호·`noReplyDays` 설정이 없거나, 엔진이 예외를 던지면 없음.
 * - 추적·Prevent 항목: 엔진에 그 항목의 분쟁 확률 값이 없다.
 */
import 'server-only';

import { forecastReply } from '@/engine/forecast';

import { pickBoard } from '../_shared/dispute-view';
import { NO_REPLY_DAYS } from '../cases/desk-model';
import { replyTranslated } from '../cases/forecast-source';
import { unansweredDays } from '../cases/history';
import { loadReply } from '../cases/reply/load';
import { loadCase } from '../cases/view/load';
import { decideFor, routineLine, type TodayItem } from './model';

/** 항목 id → 무응답 `pChargeback` (0~1, 엔진 값 그대로). 값이 없는 항목은 키가 없다. */
export type ListRiskValues = Record<string, number>;

async function noReplyChargeback(disputeId: string, now: string): Promise<number | null> {
  if (NO_REPLY_DAYS === null) return null;
  const light = await loadCase(disputeId, { draft: false });
  if (light.kind !== 'ok') return null;
  const board = pickBoard(light.loaded);
  if (routineLine(board, decideFor(board)) !== null) return null;
  const signals = light.loaded.signals;
  if (signals === null) return null;

  const reply = await loadReply(disputeId);
  if (reply === null || reply.anchorText === null) return null;
  const forecast = forecastReply({
    text: '',
    anchorText: reply.anchorText,
    board: reply.base.board ?? board,
    signals,
    delayDays: unansweredDays(light.events, now) + NO_REPLY_DAYS,
    translated: replyTranslated(reply.base.buyerLocale),
  });
  return Number.isFinite(forecast.pChargeback) ? forecast.pChargeback : null;
}

/** 목록 분쟁 항목들의 값. 하나가 실패해도 나머지는 보인다. */
export async function loadListRisk(items: readonly TodayItem[]): Promise<ListRiskValues> {
  const now = new Date().toISOString();
  const disputes = items.filter((item) => item.kind === 'dispute');
  const values = await Promise.all(
    disputes.map(async (item) => {
      try {
        return [item.id, await noReplyChargeback(item.id, now)] as const;
      } catch {
        return [item.id, null] as const;
      }
    }),
  );
  return Object.fromEntries(values.filter((entry): entry is readonly [string, number] => entry[1] !== null));
}
