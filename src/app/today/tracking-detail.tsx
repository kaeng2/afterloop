/**
 * Today 오른쪽 상세 — 추적 항목 (T060 틀 → T061 → T067). 한 줄 설명 + [Add both to PayPal] + 주문 표
 * (주문 키 · 구매자 · 상품 · 상태). 분쟁이 걸린 미등록 주문은 회색 "In dispute — excluded"로 함께 보인다
 * (수에도, 버튼 대상에도 들지 않는다). 머리 줄·보통 줄·회색 줄이 한 표의 같은 열을 쓴다.
 *
 * 버튼은 서버 액션(`register`, `page.tsx`가 `addTrackingAction`을 넘긴다)만 부른다. 대상 주문은 서버가 다시 정하고,
 * 게이트는 `liveGateFromEnv` — 스위치가 꺼져 있으면 "Simulated · nothing was sent to PayPal". 이 파일은 PayPal을 부르지 않는다.
 */
import { t } from '../_shared/copy';
import type { TrackingOrderView, TrackingSummary } from './model';
import { TrackingRegister } from './tracking-register';
import { addButtonLabel, type TrackingOutcome } from './tracking-result';

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
}: {
  tracking: TrackingSummary;
  /** 등록 서버 액션. 없으면 버튼을 그리지 않는다 (견본·테스트). */
  register?: () => Promise<TrackingOutcome>;
}) {
  const count = tracking.untracked.length;
  return (
    <section className="stack tracking-detail" aria-labelledby="tracking-title">
      <h2 className="today-detail-title" id="tracking-title">
        {count === 1 ? t('today.tracking.titleOne', { count }) : t('today.tracking.title', { count })}
      </h2>
      <p>{count === 1 ? t('today.tracking.detailOne', { count }) : t('today.tracking.detail', { count })}</p>
      {register === undefined || count === 0 ? null : (
        <TrackingRegister label={addButtonLabel(count)} action={register} />
      )}
      <div className="card">
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
      </div>
    </section>
  );
}
