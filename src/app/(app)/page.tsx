/**
 * Today 탭 `/` (T060 → T076 시안 v4). 위: 상품 거르개 줄. 아래: 왼쪽 이번 주 카드 + 할 일 묶음, 오른쪽 고른 항목의 상세.
 *
 * - 고른 항목은 주소에 둔다 (`/?item=<분쟁 번호>`, 추적 항목은 `/?item=tracking`). 없거나 모르는 값이면 목록 첫 항목.
 * - 상품 거르개도 주소에 둔다 (`/?sku=<SKU>`). 같은 읽기 결과를 다시 묶기만 한다 (PayPal을 다시 읽지 않는다).
 * - 목록은 `loadTodayScreen`(위쪽 막대와 같은 요청 안에서 한 번만 읽는다)의 엔진 결과를 옮긴 값이다.
 * - 이 화면은 POST를 보내지 않는다 (전송은 답장 칸 버튼 → 서버 액션, 추적 등록은 추적 상세 버튼 → 서버 액션만.
 *   추적 등록은 `liveGateFromEnv` 스위치가 꺼져 있으면 dry run).
 */
import { applyLangParam } from '@/app/_server/locale';
import { loadTodayScreen } from '@/app/_server/today';
import { reasonCopyKey } from '@/app/_shared/availability';
import { t } from '@/app/_shared/copy';
import { CaseDetail } from '@/app/cases/case-detail';
import { addTrackingAction } from '@/app/today/actions';
import { selectItem } from '@/app/today/model';
import { ProductFilterBar, TodayList } from '@/app/today/today-list';
import { TrackingDetail } from '@/app/today/tracking-detail';

import '@/app/today/today.css';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ item?: string | string[]; sku?: string | string[]; lang?: string | string[] }> };

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function TodayPage({ searchParams }: Props) {
  const params = await searchParams;
  await applyLangParam('/', params);
  const requested = first(params.item);
  const { view, paypal, weekly } = await loadTodayScreen(first(params.sku));
  const selected = selectItem(view, requested);

  const paypalNotice = paypal.ok
    ? null
    : [t('common.paypalUnavailable'), paypal.reason === undefined ? null : t(reasonCopyKey(paypal.reason))]
        .filter((part): part is string => part !== null)
        .join(' · ');

  return (
    <div className="today-page">
      <ProductFilterBar view={view} />
      <div className="today">
        <TodayList view={view} weekly={weekly} selectedId={selected?.id ?? null} paypalNotice={paypalNotice} />
        <section className="today-detail" aria-label={t('today.detailLabel')}>
          {selected === null ? (
            <p className="small muted">{t('today.empty')}</p>
          ) : selected.kind === 'tracking' && view.tracking !== null ? (
            <TrackingDetail tracking={view.tracking} register={addTrackingAction} />
          ) : selected.kind === 'dispute' ? (
            <CaseDetail key={selected.id} disputeId={selected.id} />
          ) : null}
        </section>
      </div>
    </div>
  );
}
