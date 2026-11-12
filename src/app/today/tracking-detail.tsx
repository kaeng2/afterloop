/**
 * Today 오른쪽 상세 — 추적 항목 (T060 틀 → T061 → T067 → T106 zone-work → T122c 시안 v6 한 장 카드, `v.ai.trk`, V6-B47 · V6-B48 · V6-B50).
 *
 * 머리(목록 줄 그대로) + 한 장 카드: AI 알약 · "Add tracking to N orders in PayPal" · 설명 · "Keeps ≈$N"(엔진
 * `trackingSavings` 표기) · "How AI handled this" 4단계 · 주문 표(`.ag` 틀, 주문 키 · 구매자 · 상품 — 실제 미등록 주문,
 * 분쟁이 걸린 주문은 "In dispute — excluded"로 함께, 수·버튼 대상에는 들지 않는다) · "On approval" + 실제 호출 이름
 * (`POST /v2/checkout/orders/{id}/track`, 주문마다 한 번) · [Add all N].
 *
 * 버튼은 서버 액션(`register`, `page.tsx`가 `addTrackingAction`을 넘긴다)만 부른다. 대상 주문은 서버가 다시 정하고,
 * 게이트는 `liveGateFromEnv` — 스위치가 꺼져 있으면 "Simulated · nothing was sent to PayPal". 이 파일은 PayPal을 부르지 않는다.
 */
import { t } from '../_shared/copy';
// T102: 등록이 끝나면(가짜 포함) 왼쪽 목록의 추적 항목을 "Done today"로 옮긴다 (화면 상태만)
import { TRACKING_ITEM_ID, type TodayRowView, type TrackingSummary } from './model';
import { OneCard } from './one-card';
import { TrackingRegister } from './tracking-register';
import { addButtonLabel, type TrackingOutcome } from './tracking-result';
import { WorkDetail } from './work-card';

/** 시안 kc 표와 같은 열 폭 (주문 · 구매자 · 상품). 추적 표의 나라·택배사 칸은 실제 주문 값에 없어 두지 않는다. */
const COLUMNS = '90px 1fr 1fr';

export function TrackingDetail({
  tracking,
  register,
  savings = null,
  row = null,
}: {
  tracking: TrackingSummary;
  /** 등록 서버 액션. 없으면 버튼을 그리지 않는다 (견본·테스트). */
  register?: () => Promise<TrackingOutcome>;
  /** T091 "+$N just now" 값 (엔진 `trackingSavings` 표기). 없으면 더하지 않는다. "Keeps ≈$N"도 같은 값. */
  savings?: string | null;
  /** T106: 상세 머리 = 목록의 추적 줄 그대로. 없으면 머리를 그리지 않는다 (견본·테스트). */
  row?: TodayRowView | null;
}) {
  const count = tracking.untracked.length;
  const one = count === 1;
  const shown = count + tracking.excluded.length;
  const rows =
    shown === 0
      ? null
      : {
          head: [t('today.tracking.order'), t('today.tracking.buyer'), t('today.tracking.product')],
          columns: COLUMNS,
          rows: [
            ...tracking.untracked.map((order) => [
              order.key,
              order.buyerName ?? t('today.buyerUnknown'),
              order.productName ?? t('common.noValue'),
            ]),
            ...tracking.excluded.map((order) => [
              order.key,
              order.buyerName ?? t('today.buyerUnknown'),
              t('today.tracking.excluded'),
            ]),
          ],
        };
  return (
    <WorkDetail row={row} className="tracking-detail">
      <OneCard
        titleId="tracking-title"
        title={one ? t('today.tracking.actTitleOne', { count }) : t('today.tracking.actTitle', { count })}
        body={one ? t('today.tracking.detailOne', { count }) : t('today.tracking.detail', { count })}
        keep={savings === null ? null : t('card.keep', { amount: savings })}
        steps={[
          one ? t('card.track.s1One', { count }) : t('card.track.s1', { count }),
          t('card.track.s2'),
          t('card.track.s3'),
          one ? t('card.track.s4One') : t('card.track.s4', { count }),
        ]}
        rows={rows}
        approval={count === 0 ? null : { label: t('card.apiT'), api: one ? t('card.api.trackOne', { count }) : t('card.api.track', { count }) }}
        action={
          register === undefined || count === 0 ? null : (
            <TrackingRegister label={addButtonLabel(count)} action={register} savings={savings} doneId={TRACKING_ITEM_ID} />
          )
        }
      />
    </WorkDetail>
  );
}
