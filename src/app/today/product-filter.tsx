'use client';

/**
 * 상품 거르개 줄 (T076 → T106, 시안 L109-116). 칩은 `<button aria-pressed>`(시안 L111)이고, 누르면 화면 안 상태
 * (`selection.tsx`)만 바뀐다 — 서버 왕복 없음, 고른 항목은 그대로 (시안 L688).
 *
 * T106 (F1-22, 시안 L683-686): 칩 배지·칩 아래 글·"N open cases"는 **done이 아닌 분쟁 항목 수**를 센다
 * (`openCaseCount`, 이 화면에서 끝낸 항목 = `useSavings().done`). 화면 상태만 — 새로고침하면 서버 값 그대로.
 * 상품 수·재고 수는 서버 값(`ProductFilterView`)을 그대로 옮긴다. 계산·읽기·쓰기 없음.
 */
import { useT } from '../_shared/locale-context';
import { ProductTile } from '../_shared/product-icon';
import type { DoneMap } from './done-groups';
import type { ProductFilterView } from './model';
import { useSavings } from './savings';
import { openCaseCount, type OpenCase } from './screen-model';
import { useTodaySelection } from './selection';

type Props = { filter: ProductFilterView; cases: readonly OpenCase[] };

/** 화면용: 끝낸 항목·고른 상품을 화면 상자에서 읽는다 (상자 밖이면 서버가 고른 SKU 그대로). */
export function ProductFilterBar({ filter, cases }: Props) {
  const { done } = useSavings();
  const selection = useTodaySelection();
  return (
    <ProductFilterBarView
      filter={filter}
      cases={cases}
      done={done}
      selectedSku={selection === null ? filter.selectedSku : selection.sku}
      onPick={selection?.setSku}
    />
  );
}

/** 값을 직접 받는 모양 (테스트·견본용). */
export function ProductFilterBarView({
  filter,
  cases,
  done,
  selectedSku,
  onPick,
}: Props & { done: DoneMap; selectedSku: string | null; onPick?: (sku: string | null) => void }) {
  const t = useT();
  const total = openCaseCount(cases, done);
  return (
    <nav className="product-filter" aria-label={t('today.filter.label')}>
      <ul className="product-filter-list">
        {filter.chips.map((chip) => {
          const open = chip.sku === null ? total : openCaseCount(cases, done, chip.sku);
          const sub =
            chip.sku === null
              ? chip.sub
              : open === 0
                ? t('today.filter.subNone', { units: chip.units })
                : t(open === 1 ? 'today.filter.subOne' : 'today.filter.sub', { units: chip.units, cases: open });
          return (
            <li key={chip.sku ?? 'all'}>
              <button
                type="button"
                className={selectedSku === chip.sku ? 'product-filter-chip pf on' : 'product-filter-chip pf'}
                aria-pressed={selectedSku === chip.sku}
                data-sku={chip.sku ?? ''}
                onClick={() => onPick?.(chip.sku)}
              >
                <ProductTile kind={chip.icon} badge={chip.sku === null ? undefined : open} />
                <span className="product-filter-text">
                  <span className="product-filter-name">{chip.name}</span>
                  <span className="product-filter-sub num">{sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <span className="product-filter-summary num">
        {t('today.filter.summary', { products: filter.products, units: filter.units, cases: total })}
      </span>
    </nav>
  );
}
