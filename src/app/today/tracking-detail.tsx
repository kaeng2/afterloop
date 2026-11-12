/**
 * Today 오른쪽 상세 — 추적 항목 (T060 틀 → T061 → T067 → T106 시안 `.zone-work` 카드 틀, 차이 목록 F1-58).
 *
 * 머리(타일 · "N orders" · 범주 칩 · who, 목록 줄 그대로) + zone-work 카드 "Add tracking to N orders in PayPal" ·
 * 한 줄 설명 · [Add all N]. 주문 표(주문 키 · 구매자 · 상품 · 분쟁 중 제외 줄)는 지우지 않고 카드 아래 접힘 안에 둔다.
 * 분쟁이 걸린 미등록 주문은 회색 "In dispute — excluded"로 함께 보인다 (수에도, 버튼 대상에도 들지 않는다).
 *
 * 버튼은 서버 액션(`register`, `page.tsx`가 `addTrackingAction`을 넘긴다)만 부른다. 대상 주문은 서버가 다시 정하고,
 * 게이트는 `liveGateFromEnv` — 스위치가 꺼져 있으면 "Simulated · nothing was sent to PayPal". 이 파일은 PayPal을 부르지 않는다.
 */
import { t } from '../_shared/copy';
// T102: 등록이 끝나면(가짜 포함) 왼쪽 목록의 추적 항목을 "Done today"로 옮긴다 (화면 상태만)
import { TRACKING_ITEM_ID, type TodayRowView, type TrackingOrderView, type TrackingSummary } from './model';
import { TrackingRegister } from './tracking-register';
import { addButtonLabel, type TrackingOutcome } from './tracking-result';
import { WorkCard, WorkDetail } from './work-card';

function Row({ order, excluded }: { order: TrackingOrderView; excluded: boolean }) {
  return (
    <tr className={excluded ? 'tracking-row tracking-row-excluded' : 'tracking-row'}>
      <td className="num">{order.key}</td>
      <td>{order.buyerName ?? t('today.buyerUnknown')}</td>
      <td>{order.productName ?? t('common.noValue')}</td>
      <td className="small">{excluded ? t('today.tracking.excluded') : null}</td>
    </tr>
  );
}

export function TrackingDetail({
  tracking,
  register,
  savings = null,
  row = null,
}: {
  tracking: TrackingSummary;
  /** 등록 서버 액션. 없으면 버튼을 그리지 않는다 (견본·테스트). */
  register?: () => Promise<TrackingOutcome>;
  /** T091 "+$N just now" 값 (엔진 `trackingSavings` 표기). 없으면 더하지 않는다. */
  savings?: string | null;
  /** T106: 상세 머리 = 목록의 추적 줄 그대로. 없으면 머리를 그리지 않는다 (견본·테스트). */
  row?: TodayRowView | null;
}) {
  const count = tracking.untracked.length;
  const shown = count + tracking.excluded.length;
  return (
    <WorkDetail row={row} className="tracking-detail">
      {/* T091 시안: "Add tracking to N orders in PayPal" + [Add all N] */}
      <WorkCard
        titleId="tracking-title"
        title={count === 1 ? t('today.tracking.actTitleOne', { count }) : t('today.tracking.actTitle', { count })}
        body={count === 1 ? t('today.tracking.detailOne', { count }) : t('today.tracking.detail', { count })}
      >
        {register === undefined || count === 0 ? null : (
          <TrackingRegister label={addButtonLabel(count)} action={register} savings={savings} doneId={TRACKING_ITEM_ID} />
        )}
      </WorkCard>
      {shown === 0 ? null : (
        <details className="tracking-orders">
          <summary className="tracking-orders-summary small">{t('today.tracking.ordersLabel', { count: shown })}</summary>
          <table className="tracking-table">
            <thead>
              <tr className="small muted">
                <th scope="col">{t('today.tracking.order')}</th>
                <th scope="col">{t('today.tracking.buyer')}</th>
                <th scope="col">{t('today.tracking.product')}</th>
                <td />
              </tr>
            </thead>
            <tbody>
              {tracking.untracked.map((order) => (
                <Row key={order.key} order={order} excluded={false} />
              ))}
              {tracking.excluded.map((order) => (
                <Row key={order.key} order={order} excluded />
              ))}
            </tbody>
          </table>
        </details>
      )}
    </WorkDetail>
  );
}
