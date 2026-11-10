/**
 * 추적 등록 결과 → 화면 한 줄 + 주문별 줄 (T067, T063 "결과 표시"). **판정하지 않는다** — `registerTrackers`
 * (`src/paypal/track.ts`)가 돌려준 결과 종류·상태 코드를 문구 키로 옮기기만 한다.
 *
 * 세 가지 결과 줄:
 * - 스위치 꺼짐(dry run): "Simulated · nothing was sent to PayPal" (실제처럼 보이지 않게. 추적번호를 보이지 않는다)
 * - 실제 · 모두 등록: "✓ 2 trackers added · Orders tracking API · 201" + 주문마다 추적번호
 * - 실제 · 하나라도 실패: "1 of 2 not added · …" + 주문마다 이유 (문구 키. PayPal 응답 문장·한국어 메모는 싣지 않는다)
 *
 * 이 파일은 PayPal을 부르지 않는다. 브라우저로 넘어가는 값은 글자뿐이다 (주문 번호·요청 본문·비밀값 없음).
 */
import type { TrackBatchResult, TrackItemResult } from '@/paypal/track';

import { t } from '../_shared/copy';

export type TrackingOutcomeKind = 'simulated' | 'added' | 'failed' | 'nothing' | 'unavailable' | 'error';

export type TrackingOutcomeRow = { key: string; text: string; ok: boolean };

export type TrackingOutcome = { kind: TrackingOutcomeKind; line: string; rows: TrackingOutcomeRow[] };

function reasonText(item: TrackItemResult): string {
  switch (item.result) {
    case 'failed':
      return item.status === null
        ? t('today.tracking.reason.failed')
        : t('today.tracking.reason.failedStatus', { status: item.status });
    case 'skipped_already_tracked':
      return t('today.tracking.reason.alreadyTracked');
    case 'not_allowed':
      return t('today.tracking.reason.notAllowed');
    case 'excluded_dispute':
      return t('today.tracking.reason.excluded');
    case 'unknown_order':
      return t('today.tracking.reason.unknown');
    case 'dry_run':
      return t('today.tracking.row.simulated');
    case 'added':
      return t('today.tracking.row.added', { number: item.trackingNumber ?? t('common.noValue') });
  }
}

function row(item: TrackItemResult): TrackingOutcomeRow {
  return { key: item.key, text: reasonText(item), ok: item.result === 'added' };
}

export function trackingOutcome(batch: TrackBatchResult): TrackingOutcome {
  if (batch.results.length === 0) return { kind: 'nothing', line: t('today.tracking.result.nothing'), rows: [] };

  if (batch.dryRun) {
    return { kind: 'simulated', line: t('today.tracking.result.simulated'), rows: batch.results.map(row) };
  }

  const problems = batch.results.filter((item) => item.result !== 'added');
  if (problems.length === 0) {
    const count = batch.counts.added;
    const status = batch.statusCodes.join(' / ');
    return {
      kind: 'added',
      line: count === 1 ? t('today.tracking.result.addedOne', { count, status }) : t('today.tracking.result.added', { count, status }),
      rows: batch.results.map(row),
    };
  }
  return {
    kind: 'failed',
    line: t('today.tracking.result.failed', { failed: problems.length, total: batch.results.length }),
    rows: batch.results.map(row),
  };
}

export const TRACKING_UNAVAILABLE = (): TrackingOutcome => ({
  kind: 'unavailable',
  line: t('today.tracking.error.unavailable'),
  rows: [],
});

export const TRACKING_ERROR = (): TrackingOutcome => ({
  kind: 'error',
  line: t('today.tracking.error.unexpected'),
  rows: [],
});

/** 버튼 글자: 1건 "Add to PayPal", 2건 "Add both to PayPal", 그보다 많으면 "Add all N to PayPal". */
export function addButtonLabel(count: number): string {
  if (count === 1) return t('today.tracking.addOne');
  if (count === 2) return t('today.tracking.add');
  return t('today.tracking.addMany', { count });
}
