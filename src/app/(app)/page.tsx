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

import { initLocale } from '@/app/_server/locale';
import { langRedirectTarget } from '@/app/_shared/lang-param';
import { LangRedirect } from '@/app/_shared/lang-redirect';
import { loadTodayScreen } from '@/app/_server/today';
import { reasonCopyKey } from '@/app/_shared/availability';
import { t } from '@/app/_shared/copy';
import { CaseDetail } from '@/app/cases/case-detail';
import { addTrackingAction } from '@/app/today/actions';
import { selectItem, type TodayItem, type TodayView } from '@/app/today/model';
import { OverviewPane } from '@/app/today/overview';
import { PreventCard } from '@/app/today/prevent-card';
import { loadListRisk } from '@/app/today/risk-source';
import { RiskValuesArrive, RiskValuesProvider } from '@/app/today/risk-values';
import { SavingsProvider } from '@/app/today/savings';
import { trackingSavingsDisplay } from '@/app/today/savings-values';
import { ALL_PRODUCTS_PARAM, casesOf, filterGroups, firstItemFor } from '@/app/today/screen-model';
import { BackToAll, DetailEmpty, DetailPane, TodaySelectionProvider } from '@/app/today/selection';
import { ProductFilterBar, TodayList } from '@/app/today/today-list';
import { TrackingDetail } from '@/app/today/tracking-detail';

import '@/app/today/today.css';
// T107: 시안 Desk.dc.html <style> 통째 복사 (`.dk` 루트 아래로만)
import '@/app/(app)/desk.css';

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

/** 목록 위험 % 칩 값 (엔진 무응답 pChargeback, `risk-source.ts`). 값이 오면 상자에 한 번 넣는다. 아무것도 그리지 않는다. */
async function RiskLoader({ items }: { items: TodayItem[] }) {
  const values = await loadListRisk(items);
  return <RiskValuesArrive values={values} />;
}

/**
 * 처음 상태 (T122b 시안 v6 초기 state `{ sel: 'seo', sku: 'sweater' }`): 주소에 `sku`가 없으면 고른 항목(주소의 `item`,
 * 없으면 목록 첫 항목)의 상품 칩. `?sku=all`이면 All products — `item`이 없으면 전체 현황. 아는 SKU면 그 상품의 항목만,
 * 오른쪽은 주소의 `item`(그 상품 항목일 때) 또는 그 상품의 첫 항목.
 */
function initialSelection(
  view: TodayView,
  requested: string | undefined,
  requestedSku: string | undefined,
): { sku: string | null; selectedId: string | null } {
  const all = view.groups.flatMap((group) => group.items);
  if (requestedSku === ALL_PRODUCTS_PARAM) {
    return { sku: null, selectedId: all.some((item) => item.id === requested) ? (requested ?? null) : null };
  }
  const known = view.filter.chips.some((chip) => chip.sku !== null && chip.sku === requestedSku);
  if (known && requestedSku !== undefined) {
    const mine = filterGroups(view.groups, requestedSku).flatMap((group) => group.items);
    const selectedId = mine.some((item) => item.id === requested) ? (requested ?? null) : firstItemFor(view.groups, requestedSku, {});
    return { sku: requestedSku, selectedId };
  }
  const selected = selectItem({ groups: view.groups }, requested);
  const skus = selected?.row.skus ?? [];
  return { sku: skus.length === 1 ? skus[0] : null, selectedId: selected?.id ?? null };
}

export default async function TodayPage({ searchParams }: Props) {
  const params = await searchParams;
  // T113: `?lang=`은 전체 페이지 이동으로 (loading.tsx Suspense 안의 redirect()는 router 이동이 되어 React #310)
  const langTarget = langRedirectTarget('/', params);
  if (langTarget !== null) return <LangRedirect href={langTarget} />;
  await initLocale();
  const requested = first(params.item);
  const requestedSku = first(params.sku);
  // 거르지 않은 전체를 한 번 읽는다. 거르개는 화면이 같은 값으로 한다 (`filterGroups`)
  const { view, paypal, weekly } = await loadTodayScreen(undefined);
  const { sku, selectedId } = initialSelection(view, requested, requestedSku);
  const items = view.groups.flatMap((group) => group.items);
  const productNames = Object.fromEntries(
    view.filter.chips.flatMap((chip) => (chip.sku === null ? [] : [[chip.sku, chip.name] as const])),
  );

  const paypalNotice = paypal.ok
    ? null
    : [t('common.paypalUnavailable'), paypal.reason === undefined ? null : t(reasonCopyKey(paypal.reason))]
        .filter((part): part is string => part !== null)
        .join(' · ');

  return (
    // T091: "+$N just now"는 화면 상태만 (목록·상세가 같은 상자를 쓴다. 새로고침하면 원래 값)
    // T102: 끝낸 항목("Done today" 묶음)도 같은 상자 (화면 상태만)
    // T106: 고른 항목·상품도 화면 상태 (주소는 화면이 맞춘다)
    // T122b: 위험 % 칩 값 상자 — 값은 아래 `RiskLoader`가 따로 흘려 보낸다 (첫 화면을 늦추지 않는다)
    <SavingsProvider>
      <RiskValuesProvider>
        <TodaySelectionProvider initialItem={selectedId} initialSku={sku} groups={view.groups}>
          <div className="dk today-page">
            <ProductFilterBar filter={view.filter} cases={casesOf(view.groups)} />
            <div className="today">
              <TodayList view={view} weekly={weekly} selectedId={selectedId} paypalNotice={paypalNotice} />
              <section className="today-detail" aria-label={t('today.detailLabel')}>
                {/* T122b 시안 v6 L179-240: 전체 현황 → 돌아가기 단추 → 빈 상품 안내 → 항목 상세 (같은 자리, 보이기만 바뀐다) */}
                <OverviewPane groups={view.groups} filter={view.filter} />
                <BackToAll />
                <DetailEmpty names={productNames} />
                {items.map((item) => (
                  <DetailPane key={item.id} id={item.id}>
                    <Pane item={item} view={view} selected={item.id === selectedId} />
                  </DetailPane>
                ))}
              </section>
            </div>
          </div>
        </TodaySelectionProvider>
        <Suspense fallback={null}>
          <RiskLoader items={items} />
        </Suspense>
      </RiskValuesProvider>
    </SavingsProvider>
  );
}
