/**
 * Today 탭 `/` (T060, SPEC v2.10 2장). 왼쪽 할 일 목록, 오른쪽 고른 항목의 상세.
 *
 * - 고른 항목은 주소에 둔다 (`/?item=<분쟁 번호>`, 추적 항목은 `/?item=tracking`). 없거나 모르는 값이면 목록 첫 항목.
 * - 목록은 `loadTodayForRequest`(위쪽 막대와 같은 요청 안에서 한 번만 읽는다)의 엔진 결과를 옮긴 값이다.
 * - 분쟁 상세는 지금의 사례 상세를 그대로 넣는다 (`cases/case-detail.tsx`. 구조 변경은 T061).
 * - 이 화면은 POST를 보내지 않는다 (전송은 답장 칸 버튼 → 서버 액션만).
 */
import { loadTodayForRequest } from './_server/today';
import { reasonCopyKey } from './_shared/availability';
import { t } from './_shared/copy';
import { CaseDetail } from './cases/case-detail';
import { selectItem } from './today/model';
import { TodayList } from './today/today-list';
import { TrackingDetail } from './today/tracking-detail';

import './today/today.css';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ item?: string | string[] }> };

export default async function TodayPage({ searchParams }: Props) {
  const { item } = await searchParams;
  const requested = Array.isArray(item) ? item[0] : item;
  const { view, paypal } = await loadTodayForRequest();
  const selected = selectItem(view, requested);

  const paypalNotice = paypal.ok
    ? null
    : [t('common.paypalUnavailable'), paypal.reason === undefined ? null : t(reasonCopyKey(paypal.reason))]
        .filter((part): part is string => part !== null)
        .join(' · ');

  return (
    <div className="today">
      <TodayList view={view} selectedId={selected?.id ?? null} paypalNotice={paypalNotice} />
      <section className="today-detail" aria-label={t('today.detailLabel')}>
        {selected === null ? (
          <p className="small muted">{t('today.empty')}</p>
        ) : selected.kind === 'tracking' && view.tracking !== null ? (
          <TrackingDetail tracking={view.tracking} />
        ) : selected.kind === 'dispute' ? (
          <CaseDetail key={selected.id} disputeId={selected.id} />
        ) : null}
      </section>
    </div>
  );
}
