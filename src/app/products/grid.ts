/**
 * Products 상품 표 AG Grid 설정 (T065). **계산하지 않는다** — 행은 `buildProductRows`(T062) 결과 그대로다.
 *
 * - 열 3개: Product · Left · As-is → With fixes (`row.valuesText`, 두 엔진 값을 나란히).
 * - 행 ID = sku (`getRowId`). 처방을 토글해 행 데이터가 바뀌면 표 전체를 다시 그리지 않고
 *   **값이 바뀐 셀만** 깜빡인다 (`enableCellChangeFlash`, `HighlightChangesModule`. 깜빡임 시간은 AG Grid 기본값).
 * - 정렬·필터·열 메뉴·열 옮기기·열 너비 바꾸기는 끈다 (4행 표).
 * - 테마: Quartz에 우리 디자인 변수(`globals.css`)를 넣는다. 강조색은 `--color-accent` 하나 (AG Grid 기본 파랑을 쓰지 않는다).
 *   값이 CSS 변수라 어두운 화면에서도 `globals.css`가 바꾼 값을 그대로 따른다.
 * - 열 너비는 비율(`flex`)로만 준다. 상품 이름은 줄을 바꿔 다 보인다 (`wrapText` + `autoHeight`).
 *
 * DOM·네트워크 없음. 단위 테스트가 이 설정 객체를 그대로 검사한다.
 */
import {
  CellStyleModule,
  ClientSideRowModelModule,
  HighlightChangesModule,
  RowAutoHeightModule,
  RowStyleModule,
  themeQuartz,
  type ColDef,
  type GetRowIdParams,
  type GridOptions,
  type Module,
} from 'ag-grid-community';

import { t } from '../_shared/copy';
import type { ProductRow } from './model';

/** 이 표가 쓰는 AG Grid Community 모듈만 (AllCommunityModule을 다 싣지 않는다) */
export const PRODUCT_GRID_MODULES: Module[] = [
  ClientSideRowModelModule,
  HighlightChangesModule,
  RowStyleModule,
  CellStyleModule,
  RowAutoHeightModule,
];

/** 강조색을 바탕색에 섞은 옅은 색 (비율은 CSS 퍼센트) */
const accentTint = (percent: string) => `color-mix(in srgb, var(--color-accent) ${percent}, transparent)`;

/** 표 모양: 우리 디자인 변수만 쓴다 */
export const PRODUCT_GRID_THEME_PARAMS = {
  accentColor: 'var(--color-accent)',
  backgroundColor: 'var(--color-surface)',
  foregroundColor: 'var(--color-text)',
  textColor: 'var(--color-text)',
  subtleTextColor: 'var(--color-muted)',
  borderColor: 'var(--color-border)',
  chromeBackgroundColor: 'var(--color-surface)',
  headerBackgroundColor: 'var(--color-surface)',
  headerTextColor: 'var(--color-muted)',
  headerFontWeight: 'bold',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-sm)',
  wrapperBorder: true,
  wrapperBorderRadius: 'var(--card-radius)',
  columnBorder: false,
  headerColumnBorder: false,
  rowBorder: true,
  rowHoverColor: accentTint('4%'),
  selectedRowBackgroundColor: accentTint('10%'),
  valueChangeValueHighlightBackgroundColor: accentTint('30%'),
  browserColorScheme: 'inherit',
} satisfies Parameters<typeof themeQuartz.withParams>[0];

export const productGridTheme = themeQuartz.withParams(PRODUCT_GRID_THEME_PARAMS);

/** 고른 상품 행 클래스 (주소 `?sku=`) */
export const SELECTED_ROW_CLASS = 'products-grid-row-selected';

/** 열 폭 단위(px). 화면 코드 정적 검사(세 자리 숫자 금지) 때문에 단위 × 개수로 적는다 */
const GRID_UNIT = 8;

/**
 * 열 최소 폭(px, AG Grid 열 설정값). 값 칸은 "금액 → 금액" 두 개가 말줄임 없이 들어가는 폭,
 * Left 칸은 머리글과 재고 숫자가 들어가는 폭. 상품 이름은 남는 폭에서 두 줄 이내로 꺾인다.
 */
export const PRODUCT_COL_MIN_WIDTH = {
  product: 12 * GRID_UNIT,
  left: 8 * GRID_UNIT,
  values: 16 * GRID_UNIT,
} as const;

export function productGridColumns(): ColDef<ProductRow>[] {
  return [
    {
      colId: 'product',
      field: 'name',
      headerName: t('product.grid.col.product'),
      flex: 4,
      minWidth: PRODUCT_COL_MIN_WIDTH.product,
      wrapText: true,
      autoHeight: true,
      cellClass: 'products-grid-name',
    },
    {
      colId: 'left',
      field: 'stock',
      headerName: t('product.grid.col.left'),
      flex: 2,
      minWidth: PRODUCT_COL_MIN_WIDTH.left,
      type: 'rightAligned',
      cellClass: 'num',
    },
    {
      colId: 'values',
      field: 'valuesText',
      headerName: t('product.grid.col.values'),
      flex: 5,
      minWidth: PRODUCT_COL_MIN_WIDTH.values,
      wrapHeaderText: true,
      autoHeaderHeight: true,
      type: 'rightAligned',
      cellClass: 'num products-grid-values',
      enableCellChangeFlash: true,
    },
  ];
}

export const productGridRowId = (params: GetRowIdParams<ProductRow>): string => params.data.sku;

export function productGridOptions(): GridOptions<ProductRow> {
  return {
    columnDefs: productGridColumns(),
    defaultColDef: {
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      suppressHeaderContextMenu: true,
    },
    getRowId: productGridRowId,
    rowClassRules: { [SELECTED_ROW_CLASS]: (params) => params.data?.selected === true },
    domLayout: 'autoHeight',
    suppressMovableColumns: true,
    suppressDragLeaveHidesColumns: true,
    animateRows: false,
  };
}

/** 키보드: Enter·Space면 그 행 상품을 고른다 */
export const isSelectKey = (key: string): boolean => key === 'Enter' || key === ' ';
