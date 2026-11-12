/**
 * 공용 AG Grid 설정 (T114). T065 Products 상품 표에서 **화면 전용이 아닌 부분만** 옮겼다
 * (11/12 11:15 결정으로 /products 화면은 지웠고, AG Grid 패키지·설정은 남긴다).
 *
 * - 모듈: 표에 필요한 AG Grid Community 모듈만 (AllCommunityModule을 다 싣지 않는다).
 *   `HighlightChangesModule`이 있어 열에 `enableCellChangeFlash: true`를 주면 **값이 바뀐 셀만** 깜빡인다
 *   (깜빡임 시간은 AG Grid 기본값. 0으로 끄지 않는다).
 * - 테마: Quartz에 우리 디자인 변수(`globals.css`)를 넣는다. 강조색은 `--color-accent` 하나 (AG Grid 기본 파랑을 쓰지 않는다).
 *   값이 CSS 변수라 어두운 화면에서도 `globals.css`가 바꾼 값을 그대로 따른다.
 * - 기본 열 설정: 정렬·필터·열 메뉴·열 옮기기·열 너비 바꾸기를 끈다 (작은 표).
 *
 * T122b: Desk 오른쪽 "All products" 전체 현황의 표 2개(`src/app/today/overview.tsx`)가 쓴다 (`deskGridTheme`·`sortableCol`).
 * DOM·네트워크 없음. 계산하지 않는다.
 */
import {
  CellStyleModule,
  ClientSideRowModelModule,
  HighlightChangesModule,
  RowAutoHeightModule,
  RowStyleModule,
  themeQuartz,
  type ColDef,
  type GridOptions,
  type Module,
} from 'ag-grid-community';

/** 공용 표가 쓰는 AG Grid Community 모듈 */
export const GRID_MODULES: Module[] = [
  ClientSideRowModelModule,
  HighlightChangesModule,
  RowStyleModule,
  CellStyleModule,
  RowAutoHeightModule,
];

/** 강조색을 바탕색에 섞은 옅은 색 (비율은 CSS 퍼센트) */
const accentTint = (percent: string) => `color-mix(in srgb, var(--color-accent) ${percent}, transparent)`;

/** 표 모양: 우리 디자인 변수만 쓴다 */
export const GRID_THEME_PARAMS = {
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

export const gridTheme = themeQuartz.withParams(GRID_THEME_PARAMS);

/**
 * Desk "All products" 표 모양 (T122b, 시안 v6 `.ag`·`.ag-h`·`.ag-hc`·`.ag-r`·`.ag-c`). 색은 `desk.css`의 `--dk-ag-*`
 * 변수(시안 값)에서 읽는다 — 코드에 색을 쓰지 않는다. 바깥 테두리·둥근 모서리는 `.ag` 상자(시안)가 그린다.
 */
export const DESK_GRID_THEME_PARAMS = {
  ...GRID_THEME_PARAMS,
  accentColor: 'var(--dk-ag-accent)',
  backgroundColor: 'var(--dk-ag-bg)',
  foregroundColor: 'var(--dk-ag-fg)',
  textColor: 'var(--dk-ag-fg)',
  subtleTextColor: 'var(--dk-ag-muted)',
  borderColor: 'var(--dk-ag-border)',
  chromeBackgroundColor: 'var(--dk-ag-head-bg)',
  headerBackgroundColor: 'var(--dk-ag-head-bg)',
  headerTextColor: 'var(--dk-ag-head-fg)',
  headerCellHoverBackgroundColor: 'var(--dk-ag-head-hover)',
  headerFontWeight: 700,
  headerFontSize: 12,
  fontSize: 14,
  fontFamily: 'inherit',
  cellHorizontalPadding: 14,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  rowBorder: { color: 'var(--dk-ag-row-border)' },
  headerRowBorder: { color: 'var(--dk-ag-border)' },
  rowHoverColor: 'var(--dk-ag-hover)',
  selectedRowBackgroundColor: 'var(--dk-ag-hover)',
} satisfies Parameters<typeof themeQuartz.withParams>[0];

export const deskGridTheme = themeQuartz.withParams(DESK_GRID_THEME_PARAMS);

/** 시안 `.ag-r{min-height:52px}`·`.ag-hc{padding:10px 14px; font-size:12px}`(12 × 1.5 + 20) */
export const DESK_GRID_ROW_HEIGHT = 52;
export const DESK_GRID_HEADER_HEIGHT = 38;

/**
 * 열 폭(px) — 시안 그대로. Products `pCols` = minmax(170px,2fr) 104px 112px 84px 92px minmax(132px,1.2fr) minmax(160px,1.5fr),
 * Cases `cCols` = 132px minmax(150px,1.5fr) minmax(170px,1.5fr) 128px minmax(120px,1.1fr) 120px.
 * `fr`는 AG Grid `flex`, `minmax(Npx, …)`는 `minWidth`, 고정 폭은 `width`.
 */
export const DESK_OV_COLS = {
  products: {
    name: { flex: 2, minWidth: 170 },
    open: { width: 104 },
    reply: { width: 112 },
    prevent: { width: 84 },
    questions: { width: 92 },
    risk: { flex: 1.2, minWidth: 132 },
    top: { flex: 1.5, minWidth: 160 },
  },
  cases: {
    risk: { width: 132 },
    case: { flex: 1.5, minWidth: 150 },
    type: { flex: 1.5, minWidth: 170 },
    status: { width: 128 },
    buyer: { flex: 1.1, minWidth: 120 },
    due: { width: 120 },
  },
} as const satisfies Record<string, Record<string, ColDef>>;

/**
 * 정렬할 수 있는 열 (T122b 시안 `sortHead`): 숫자·위험 열은 처음 누르면 높은 순(↓), 글자 열은 낮은 순(↑).
 * 다시 누르면 반대로 — "정렬 없음"으로 돌아가지 않는다 (시안 `d: -st.d`).
 */
export const sortableCol = (numeric: boolean) =>
  ({ sortable: true, sortingOrder: numeric ? ['desc', 'asc'] : ['asc', 'desc'] }) as const satisfies ColDef;

/** 정렬·필터·열 메뉴·열 옮기기·열 너비 바꾸기를 끈 기본 열 설정 */
export const GRID_DEFAULT_COL_DEF = {
  sortable: false,
  filter: false,
  resizable: false,
  suppressMovable: true,
  suppressHeaderMenuButton: true,
  suppressHeaderContextMenu: true,
} as const satisfies ColDef;

/** 값이 바뀐 셀만 깜빡이게 하는 열 설정 (열 설정에 펼쳐 넣는다) */
export const FLASH_ON_CHANGE = { enableCellChangeFlash: true } as const satisfies ColDef;

/**
 * 공용 표 옵션. 행 ID(`getRowId`)를 `extra`로 주면 행 데이터가 바뀌어도 표 전체를 다시 그리지 않고
 * 깜빡임 열(`FLASH_ON_CHANGE`)의 바뀐 셀만 깜빡인다.
 */
export function baseGridOptions<T>(extra: GridOptions<T> = {}): GridOptions<T> {
  return {
    defaultColDef: { ...GRID_DEFAULT_COL_DEF },
    domLayout: 'autoHeight',
    suppressMovableColumns: true,
    suppressDragLeaveHidesColumns: true,
    animateRows: false,
    ...extra,
  };
}

/** 키보드: Enter·Space면 그 행을 고른다 */
export const isSelectKey = (key: string): boolean => key === 'Enter' || key === ' ';
