/**
 * Today 오른쪽 상세 — 추적 항목 (T060 틀). 한 줄 설명 + 주문 목록 (주문 키 · 구매자 · 상품).
 * 분쟁이 걸린 미등록 주문은 회색 "In dispute — excluded"로 함께 보인다 (수에는 들지 않는다).
 * **등록 버튼은 아직 없다** (T063). 이 파일은 PayPal을 부르지 않는다.
 */
import { t } from '../_shared/copy';
import type { TrackingOrderView, TrackingSummary } from './model';

function Row({ order, excluded }: { order: TrackingOrderView; excluded: boolean }) {
  return (
    <li className={excluded ? 'tracking-row tracking-row-excluded' : 'tracking-row'}>
      <span className="num">{order.key}</span>
      <span>{order.buyerName ?? t('today.buyerUnknown')}</span>
      <span>{order.productName ?? t('common.noValue')}</span>
      {excluded ? <span className="small">{t('today.tracking.excluded')}</span> : <span />}
    </li>
  );
}

export function TrackingDetail({ tracking }: { tracking: TrackingSummary }) {
  const count = tracking.untracked.length;
  return (
    <section className="stack tracking-detail" aria-labelledby="tracking-title">
      <h2 className="today-detail-title" id="tracking-title">
        {count === 1 ? t('today.tracking.titleOne', { count }) : t('today.tracking.title', { count })}
      </h2>
      <p>{count === 1 ? t('today.tracking.detailOne', { count }) : t('today.tracking.detail', { count })}</p>
      <div className="card stack">
        <div className="tracking-row tracking-row-head small muted" aria-hidden="true">
          <span>{t('today.tracking.order')}</span>
          <span>{t('today.tracking.buyer')}</span>
          <span>{t('today.tracking.product')}</span>
          <span />
        </div>
        <ul className="tracking-rows">
          {tracking.untracked.map((order) => (
            <Row key={order.key} order={order} excluded={false} />
          ))}
          {tracking.excluded.map((order) => (
            <Row key={order.key} order={order} excluded />
          ))}
        </ul>
      </div>
    </section>
  );
}
