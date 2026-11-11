'use client';

/**
 * Products 상품 표 (T065, AG Grid Community). 설정은 `grid.ts`, 행은 `buildProductRows`(T062) 그대로.
 *
 * - 서버 렌더와 첫 그림에서는 AG Grid를 그리지 않고 같은 행의 단순 링크 목록을 그린다 (자바스크립트 없이도 상품을 고를 수 있다).
 *   브라우저에 붙은 뒤(`useEffect`) AG Grid로 바꾼다. 그래서 서버 렌더에서 깨지지 않는다.
 * - 행을 누르거나, 셀에 초점을 두고 Enter·Space를 누르면 그 상품을 고른다 (`?sku=`).
 * - 계산하지 않는다. 금액 글자는 `row.valuesText`를 옮기기만 한다.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AgGridReact } from 'ag-grid-react';
import type { CellKeyDownEvent, RowClickedEvent } from 'ag-grid-community';

import { t } from '../_shared/copy';
import { isSelectKey, PRODUCT_GRID_MODULES, productGridOptions, productGridTheme } from './grid';
import type { ProductRow } from './model';

/** 서버 렌더·자바스크립트 없을 때의 목록 (T062 임시 목록과 같은 행) */
export function ProductRowsFallback({ rows }: { rows: readonly ProductRow[] }) {
  return (
    <ul className="products-rows" data-grid-fallback="true">
      {rows.map((row) => (
        <li key={row.sku}>
          <Link href={row.href} className="products-row" aria-current={row.selected ? 'page' : undefined} data-sku={row.sku}>
            <span className="products-row-name">{row.name}</span>
            <span className="small muted num">{row.stockText}</span>
            <span className="products-row-values num" data-as-is={row.asIs.cents} data-with-fixes={row.withFixes.cents}>
              {row.valuesText}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProductGrid({ rows }: { rows: readonly ProductRow[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options = useMemo(() => productGridOptions(), []);
  // AG Grid는 행 배열을 바꾸지 않지만 readonly 타입을 받지 않는다
  const rowData = useMemo(() => [...rows], [rows]);

  if (!mounted) return <ProductRowsFallback rows={rows} />;

  const select = (row: ProductRow | undefined) => {
    if (row !== undefined && !row.selected) router.push(row.href, { scroll: false });
  };

  return (
    <div className="products-grid" aria-label={t('product.grid.label')}>
      <AgGridReact<ProductRow>
        modules={PRODUCT_GRID_MODULES}
        theme={productGridTheme}
        gridOptions={options}
        rowData={rowData}
        onRowClicked={(event: RowClickedEvent<ProductRow>) => select(event.data)}
        onCellKeyDown={(event: CellKeyDownEvent<ProductRow>) => {
          const key = (event.event as KeyboardEvent | null | undefined)?.key;
          if (key !== undefined && isSelectKey(key)) {
            event.event?.preventDefault();
            select(event.data);
          }
        }}
      />
    </div>
  );
}
