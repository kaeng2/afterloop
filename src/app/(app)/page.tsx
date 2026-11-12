/**
 * Today 탭 `/` (T060 → T076 시안 v4 → T106 화면 안 고르기). 위: 상품 거르개 줄. 아래: 왼쪽 이번 주 카드 + 할 일 묶음,
 * 오른쪽 고른 항목의 상세.
 *
 * - T106 (F1-18 · F1-19 · F1-47): 항목·상품 칩을 누르면 **서버 왕복 없이** 화면 안 상태만 바뀐다 (`selection.tsx`).
 *   첫 요청에서 목록 항목들의 상세를 모두 그려 두고 고른 것만 보인다 (`DetailPane`). 고르지 않은 분쟁 상세는
 *   `Suspense`로 나중에 흘려 보내 첫 화면을 늦추지 않는다. 주소(`?item`·`?sku`)는 화면이 `history.replaceState`로 맞추고,
 *   새로고침·공유 때는 이 파일이 같은 값으로 처음 상태를 정한다 (모르는 값이면 목록 첫 항목 / All products).
 * - 상품 거르개는 같은 읽기 결과를 다시 묶기만 한다 (PayPal을 다시 읽지 않는다).
 * - 목록은 `loadTodayScreen`(위쪽 막대와 같은 요청 안에서 한 번만 읽는다)의 엔진 결과를 옮긴 값이다.
 * - 이 화면은 POST를 보내지 않는다 (전송은 답장 칸·제안 카드 버튼 → 서버 액션, 추적 등록은 추적 상세 버튼 → 서버 액션만.
 *   추적 등록은 `liveGateFromEnv` 스위치가 꺼져 있으면 dry run).
 */
import { Suspense } from 'react';

import { applyLangParam } from '@/app/_server/locale';
import { loadTodayScreen } from '@/app/_server/today';
import { reasonCopyKey } from '@/app/_shared/availability';
import { t } from '@/app/_shared/copy';
import { CaseDetail } from '@/app/cases/case-detail';
import { addTrackingAction } from '@/app/today/actions';
import { selectItem, type TodayItem, type TodayView } from '@/app/today/model';
import { PreventCard } from '@/app/today/prevent-card';
import { SavingsProvider } from '@/app/today/savings';
import { trackingSavingsDisplay } from '@/app/today/savings-values';
import { casesOf, filterGroups } from '@/app/today/screen-model';
import { DetailEmpty, DetailPane, TodaySelectionProvider } from '@/app/today/selection';
import { ProductFilterBar, TodayList } from '@/app/today/today-list';
import { TrackingDetail } from '@/app/today/tracking-detail';

import '@/app/today/today.css';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ item?: string | string[]; sku?: string | string[]; lang?: string | string[] }> };

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** 항목 하나의 상세. 고르지 않은 분쟁은 나중에 흘려 보낸다 (첫 화면을 기다리게 하지 않는다). */
function Pane({ item, view, selected }: { item: TodayItem; view: TodayView; selected: boolean }) {
  if (item.kind === 'tracking') {
    return view.tracking === null ? null : (
      <TrackingDetail
        tracking={view.tracking}
        register={addTrackingAction}
        savings={trackingSavingsDisplay(view.tracking)}
        row={item.row}
      />
    );
  }
  if (item.kind === 'prevent') return item.prevent === undefined ? null : <PreventCard detail={item.prevent} row={item.row} />;
  const detail = <CaseDetail key={item.id} disputeId={item.id} row={item.row} />;
  return selected ? (
    detail
  ) : (
    <Suspense fallback={<p className="small muted">{t('common.loading')}</p>}>{detail}</Suspense>
  );
}

export default async function TodayPage({ searchParams }: Props) {
  const params = await searchParams;
  await applyLangParam('/', params);
  const requested = first(params.item);
  const requestedSku = first(params.sku);
  // 거르지 않은 전체를 한 번 읽는다. 거르개는 화면이 같은 값으로 한다 (`filterGroups`)
  const { view, paypal, weekly } = await loadTodayScreen(undefined);
  const sku = view.filter.chips.some((chip) => chip.sku !== null && chip.sku === requestedSku) ? (requestedSku ?? null) : null;
  const selected = selectItem({ groups: filterGroups(view.groups, sku) }, requested);
  const items = view.groups.flatMap((group) => group.items);

  const paypalNotice = paypal.ok
    ? null
    : [t('common.paypalUnavailable'), paypal.reason === undefined ? null : t(reasonCopyKey(paypal.reason))]
        .filter((part): part is string => part !== null)
        .join(' · ');

  return (
    // T091: "+$N just now"는 화면 상태만 (목록·상세가 같은 상자를 쓴다. 새로고침하면 원래 값)
    // T102: 끝낸 항목("Done today" 묶음)도 같은 상자 (화면 상태만)
    // T106: 고른 항목·상품도 화면 상태 (주소는 화면이 맞춘다)
    <SavingsProvider>
      <TodaySelectionProvider initialItem={selected?.id ?? null} initialSku={sku}>
        <div className="today-page">
          <ProductFilterBar filter={view.filter} cases={casesOf(view.groups)} />
          <div className="today">
            <TodayList view={view} weekly={weekly} selectedId={selected?.id ?? null} paypalNotice={paypalNotice} />
            <section className="today-detail" aria-label={t('today.detailLabel')}>
              <DetailEmpty>
                <p className="small muted">{t('today.empty')}</p>
              </DetailEmpty>
              {items.map((item) => (
                <DetailPane key={item.id} id={item.id}>
                  <Pane item={item} view={view} selected={item.id === selected?.id} />
                </DetailPane>
              ))}
            </section>
          </div>
        </div>
      </TodaySelectionProvider>
    </SavingsProvider>
  );
}
