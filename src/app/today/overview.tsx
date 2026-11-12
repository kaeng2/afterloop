'use client';

/**
 * "All products" 전체 현황 (T122b, 시안 v6 L179-229 `isAll`). 오른쪽 칸에서 All products 칩 + 고른 항목 없음일 때만 보인다.
 *
 * - 요약 카드 5개: Open cases · Reply needed · Prevent · Questions · Avg. dispute risk. 숫자는 목록 항목 수(세기만).
 *   평균은 엔진 `meanRisk`(T120d) 자리(`mean-risk.ts`)가 낸다 — 병합 전이면 "—" (화면에서 평균을 내지 않는다).
 * - **AG Grid 표 2개** (공용 설정 `_shared/grid/grid.ts`): "Products" · "Cases by risk". 열 머리를 누르면 정렬(↓/↑),
 *   행을 누르면(또는 Enter·Space) 사건을 연다 — 화면 안 고르기 상자(`selection.tsx`)만 바뀐다. 위험 열 = 막대 + %(엔진
 *   무응답 pChargeback, 값 없으면 "—"). 높은 위험 행은 옅은 빨강(시안 `.hi`), 마지막으로 연 행은 강조.
 *   표 아래 "N rows · Sorted by …", 제목 옆 "AG Grid" 꼬리표 (시안).
 * - 서버 렌더·붙기 전에는 AG Grid를 그리지 않고 같은 행의 단추 목록을 그린다 (자바스크립트 없이도 깨지지 않는다).
 *
 * 읽기·쓰기·계산 없음 (값은 `overview-model.ts`가 센 것, 위험 %는 `toPercentRounded` 표기만).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  CellKeyDownEvent,
  ColDef,
  ColumnHeaderClickedEvent,
  GetRowIdParams,
  ICellRendererParams,
  IHeaderParams,
  RowClassParams,
  RowClickedEvent,
  SortChangedEvent,
  SortDirection,
} from 'ag-grid-community';

import {
  DESK_OV_COLS,
  DESK_GRID_HEADER_HEIGHT,
  DESK_GRID_ROW_HEIGHT,
  GRID_MODULES,
  baseGridOptions,
  deskGridTheme,
  isSelectKey,
  sortableCol,
} from '../_shared/grid/grid';
import { useT } from '../_shared/locale-context';
import { ProductTile } from '../_shared/product-icon';
import type { ProductFilterView, TodayGroup } from './model';
import {
  SECTION_ORDER,
  SECTION_TITLE_KEY,
  buildOverview,
  compareRisk,
  type OvCaseRow,
  type OvProductRow,
  type OvTop,
} from './overview-model';
import { dashboardMeanRisk } from './mean-risk';
import { riskChipParts } from './risk-values';
import { useRiskValues } from './risk-values';
import { useSavings } from './savings';
import { isOverview, useTodaySelection } from './selection';

type T = ReturnType<typeof useT>;

// ───────────────────────────── 셀 ─────────────────────────────

/** 위험 막대 + % (시안 `riskCells`). 값이 없으면 "—". */
function RiskCell({ value }: { value: number | null | undefined }) {
  const t = useT();
  if (value === null || value === undefined) {
    return (
      <b className="ov-risk-txt ov-risk-none">
        <span>{t('today.ov.none')}</span>
      </b>
    );
  }
  const { percent, level } = riskChipParts(value);
  return (
    <>
      <span className="ov-bar" aria-hidden="true">
        <span className={`ov-bar-fill ov-tone-${level}`} style={{ width: percent }} />
      </span>
      <b className={`ov-risk-txt ov-risk-${level}`}>
        <span>{percent}</span>
      </b>
    </>
  );
}

function topHead(t: T, top: OvTop): string {
  return top.head.startsWith('#') ? t('today.ov.orderNo', { order: top.head }) : top.head;
}

function ProductCell({ data }: ICellRendererParams<OvProductRow>) {
  const t = useT();
  if (data === undefined) return null;
  return (
    <span className="ov-prod">
      <ProductTile kind={data.icon} />
      <span className="ov-two">
        <b className="ov-two-main">
          <span>{data.name}</span>
        </b>
        <span className="ov-two-sub">
          <span>{data.units === null ? t('today.ov.prevOnly') : t('today.ov.units', { units: data.units })}</span>
        </span>
      </span>
    </span>
  );
}

function ReplyCountCell({ value }: ICellRendererParams<OvProductRow, number>) {
  return (
    <span className={value ? 'ov-reply-pill' : 'ov-zero'}>
      <span>{value ?? 0}</span>
    </span>
  );
}

/** 숫자·글자 셀: 시안 `{{r.prevent}}`·`{{r.who}}` 자리표(안쪽 span). `bold`면 시안 `<b>{{r.open}}</b>`. */
function TextCell({ value, valueFormatted, bold }: ICellRendererParams & { bold?: boolean }) {
  const text = <span>{String(valueFormatted ?? value ?? '')}</span>;
  return bold === true ? <b>{text}</b> : text;
}

function TopCell({ data }: ICellRendererParams<OvProductRow>) {
  const t = useT();
  if (data === undefined) return null;
  return (
    <span className="ov-two">
      <b className="ov-top-main">
        <span>{data.top === null ? t('today.ov.none') : topHead(t, data.top)}</span>
      </b>
      <span className="ov-two-sub">
        <span>{data.top === null ? t('today.ov.noneSub') : (data.top.category ?? '')}</span>
      </span>
    </span>
  );
}

function CaseCell({ data }: ICellRendererParams<OvCaseRow>) {
  const t = useT();
  if (data === undefined) return null;
  return (
    <span className="ov-two">
      <b className="ov-case-main">
        <span>{data.head}</span>
      </b>
      <span className="ov-two-sub">
        <span>{data.product ?? t('today.row.severalProducts')}</span>
      </span>
    </span>
  );
}

function TypeCell({ value }: ICellRendererParams<OvCaseRow, string | null>) {
  return value === null || value === undefined ? null : (
    <span className="chip ov-type">
      <span>{value}</span>
    </span>
  );
}

function StatusCell({ data }: ICellRendererParams<OvCaseRow>) {
  const t = useT();
  if (data === undefined) return null;
  return (
    <span className={`ov-status ov-status-${data.section}`}>
      <span>{t(SECTION_TITLE_KEY[data.section])}</span>
    </span>
  );
}

// ───────────────────────────── 머리 ─────────────────────────────

/**
 * 시안 `.ag-hc` 머리 안쪽: 이름 + ↓/↑ (T124b). 시안 단추(`role=columnheader`)의 모양(padding·테두리·글자·파랑)은 AG Grid
 * 머리 칸(`.ag-header-cell`, 같은 역할)이 `desk.css`에서 맡는다 — 머리 칸 안에 단추를 또 두지 않는다.
 * 정렬: 마우스는 표의 `onColumnHeaderClicked`(머리 칸 전체), 키보드 Enter는 AG Grid 머리 칸 기본 동작.
 */
function SortHeader(props: IHeaderParams & { right?: boolean }) {
  const { column, displayName, right } = props;
  const [sort, setSort] = useState<SortDirection | undefined>(column.getSort());
  useEffect(() => {
    const update = () => setSort(column.getSort());
    column.addEventListener('sortChanged', update);
    return () => column.removeEventListener('sortChanged', update);
  }, [column]);
  return (
    <span className={`ov-hc${right === true ? ' num' : ''}`}>
      <span>{displayName}</span>
      <span className="ag-ind">
        <span>{sort === 'desc' ? '↓' : sort === 'asc' ? '↑' : ''}</span>
      </span>
    </span>
  );
}

/**
 * 머리 설정. `right` = 시안 `.ag-hc.num`(오른쪽 맞춤), `numericSort` = 처음 누르면 높은 순(시안 `c.num || c.k === 'risk'`).
 * 위험 열은 시안처럼 왼쪽 맞춤 + 높은 순.
 */
const header = (right: boolean, numericSort: boolean = right) => ({
  headerComponent: SortHeader,
  headerComponentParams: { right },
  ...sortableCol(numericSort),
});

/** 머리 칸을 누르면 정렬 한 단계 (시안 `sortHead.pick`: 같은 열이면 반대로, 다른 열이면 그 열의 첫 방향). */
export function nextSort(current: SortDirection | undefined, order: readonly unknown[] | undefined): 'asc' | 'desc' {
  const list = (order ?? ['asc', 'desc']).filter((dir): dir is 'asc' | 'desc' => dir === 'asc' || dir === 'desc');
  if (current !== 'asc' && current !== 'desc') return list[0] ?? 'asc';
  return current === 'asc' ? 'desc' : 'asc';
}

// ───────────────────────────── 열 ─────────────────────────────

/** 시안 `pCols` (폭은 `DESK_OV_COLS.products`) */
export function productColumns(t: T): ColDef<OvProductRow>[] {
  const W = DESK_OV_COLS.products;
  const num = (colId: 'open' | 'reply' | 'prevent' | 'questions', label: string, extra: ColDef<OvProductRow> = {}): ColDef<OvProductRow> => ({
    colId,
    field: colId,
    headerName: label,
    ...W[colId],
    type: 'rightAligned',
    cellClass: 'ov-cell ov-num',
    ...header(true),
    ...extra,
  });
  return [
    { colId: 'name', field: 'name', headerName: t('today.ov.col.product'), ...W.name, cellClass: 'ov-cell', cellRenderer: ProductCell, ...header(false) },
    num('open', t('today.ov.col.open'), { cellRenderer: TextCell, cellRendererParams: { bold: true } }),
    num('reply', t('today.ov.kReply'), { cellRenderer: ReplyCountCell }),
    num('prevent', t('today.ov.kPrevent'), { cellRenderer: TextCell }),
    num('questions', t('today.ov.kQuestions'), { cellRenderer: TextCell }),
    {
      colId: 'risk',
      field: 'risk',
      headerName: t('today.ov.col.risk'),
      ...W.risk,
      cellClass: 'ov-cell',
      cellRenderer: (params: ICellRendererParams<OvProductRow, number | null>) => <RiskCell value={params.value} />,
      comparator: compareRisk,
      initialSort: 'desc',
      ...header(false, true),
    },
    {
      colId: 'top',
      headerName: t('today.ov.col.top'),
      valueGetter: (params) => params.data?.top?.head ?? '~',
      ...W.top,
      cellClass: 'ov-cell',
      cellRenderer: TopCell,
      ...header(false),
    },
  ];
}

/** 시안 `cCols` (폭은 `DESK_OV_COLS.cases`) */
export function caseColumns(t: T): ColDef<OvCaseRow>[] {
  const W = DESK_OV_COLS.cases;
  return [
    {
      colId: 'risk',
      field: 'risk',
      headerName: t('today.ov.col.risk'),
      ...W.risk,
      cellClass: 'ov-cell',
      cellRenderer: (params: ICellRendererParams<OvCaseRow, number | null>) => <RiskCell value={params.value} />,
      comparator: compareRisk,
      initialSort: 'desc',
      ...header(false, true),
    },
    { colId: 'case', field: 'head', headerName: t('today.ov.col.case'), ...W.case, cellClass: 'ov-cell', cellRenderer: CaseCell, ...header(false) },
    { colId: 'type', field: 'category', headerName: t('today.ov.col.type'), ...W.type, cellClass: 'ov-cell', cellRenderer: TypeCell, ...header(false) },
    {
      colId: 'status',
      headerName: t('today.ov.col.status'),
      valueGetter: (params) => (params.data === undefined ? 0 : SECTION_ORDER[params.data.section]),
      ...W.status,
      cellClass: 'ov-cell',
      cellRenderer: StatusCell,
      ...header(false),
    },
    { colId: 'buyer', field: 'who', headerName: t('today.ov.col.buyer'), ...W.buyer, cellClass: 'ov-cell ov-plain', cellRenderer: TextCell, ...header(false) },
    {
      colId: 'due',
      headerName: t('today.ov.col.due'),
      valueGetter: (params) => params.data?.dueMs ?? Number.POSITIVE_INFINITY,
      valueFormatter: (params) => params.data?.due ?? t('today.ov.none'),
      ...W.due,
      cellClass: 'ov-cell ov-plain',
      cellRenderer: TextCell,
      ...header(false),
    },
  ];
}

// ───────────────────────────── 표 ─────────────────────────────

type SortState = { colId: string; dir: 'asc' | 'desc' } | null;

const INITIAL_SORT: SortState = { colId: 'risk', dir: 'desc' };

/** 표 하나: 시안 `.ag` 상자 안에 AG Grid + 아래 `.ag-f` 줄. */
function OverviewGrid<Row extends { key?: string; id?: string }>({
  label,
  rows,
  columns,
  rowId,
  rowClass,
  onPick,
  sort,
  onSort,
}: {
  label: string;
  rows: Row[];
  columns: ColDef<Row>[];
  rowId: (row: Row) => string;
  rowClass: (row: Row) => string;
  onPick: (row: Row) => void;
  /** 정렬 상태는 바깥(전체 현황)이 들고 있다 — 사건을 열었다 돌아와도 같은 정렬 (시안 `pSort`·`cSort` state). */
  sort: SortState;
  onSort: (sort: SortState) => void;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const setSort = onSort;

  const options = useMemo(
    () =>
      baseGridOptions<Row>({
        getRowId: (params: GetRowIdParams<Row>) => rowId(params.data),
        rowHeight: DESK_GRID_ROW_HEIGHT,
        headerHeight: DESK_GRID_HEADER_HEIGHT,
        domLayout: 'autoHeight',
      }),
    [rowId],
  );
  const getRowClass = useCallback((params: RowClassParams<Row>) => (params.data === undefined ? '' : rowClass(params.data)), [rowClass]);

  const sortedName = sort === null ? null : columns.find((column) => column.colId === sort.colId)?.headerName ?? null;
  const footer = (
    <div className="ag-f">
      <span>
        <span>{t('today.ov.rows', { count: rows.length })}</span>
      </span>
      <span>
        <span>
          {sort === null || sortedName === null
            ? ''
            : t(sort.dir === 'desc' ? 'today.ov.sortedDesc' : 'today.ov.sortedAsc', { column: sortedName })}
        </span>
      </span>
    </div>
  );

  return (
    <div className="ag ov-grid" aria-label={label}>
      {mounted ? (
        <AgGridReact<Row>
          modules={GRID_MODULES}
          theme={deskGridTheme}
          gridOptions={options}
          columnDefs={columns}
          rowData={rows}
          getRowClass={getRowClass}
          onGridReady={(event) => {
            if (sort !== null) {
              event.api.applyColumnState({ state: [{ colId: sort.colId, sort: sort.dir }], defaultState: { sort: null } });
            }
          }}
          onColumnHeaderClicked={(event: ColumnHeaderClickedEvent<Row>) => {
            const column = event.column;
            if (!('getSort' in column) || column.getColDef().sortable !== true) return;
            const dir = nextSort(column.getSort(), column.getColDef().sortingOrder ?? undefined);
            event.api.applyColumnState({ state: [{ colId: column.getColId(), sort: dir }], defaultState: { sort: null } });
          }}
          onRowClicked={(event: RowClickedEvent<Row>) => {
            if (event.data !== undefined) onPick(event.data);
          }}
          onCellKeyDown={(event: CellKeyDownEvent<Row>) => {
            const key = (event.event as KeyboardEvent | null | undefined)?.key;
            if (key !== undefined && isSelectKey(key) && event.data !== undefined) {
              event.event?.preventDefault();
              onPick(event.data);
            }
          }}
          onSortChanged={(event: SortChangedEvent<Row>) => {
            const sorted = event.api.getColumnState().find((state) => state.sort === 'asc' || state.sort === 'desc');
            setSort(sorted === undefined ? null : { colId: sorted.colId, dir: sorted.sort === 'asc' ? 'asc' : 'desc' });
          }}
        />
      ) : (
        <ul className="ov-grid-fallback" data-grid-fallback="true">
          {rows.map((row) => (
            <li key={rowId(row)}>
              <button type="button" className={`ov-fallback-row ${rowClass(row)}`} onClick={() => onPick(row)}>
                {String((row as { name?: string; head?: string }).name ?? (row as { head?: string }).head ?? '')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {footer}
    </div>
  );
}

// ───────────────────────────── 화면 ─────────────────────────────

/**
 * Products 행을 눌렀을 때 (시안 `pRows.pick`): 상품 줄 → 그 상품 칩(목록을 거르고 첫 항목), "Several products" 줄 →
 * 그 줄의 가장 위험한 항목을 연다 (All products 그대로 → "← All products overview").
 */
export function productRowAction(row: OvProductRow): { kind: 'sku'; sku: string } | { kind: 'item'; id: string } | null {
  if (row.sku !== null) return { kind: 'sku', sku: row.sku };
  return row.top === null ? null : { kind: 'item', id: row.top.id };
}

const productRowId = (row: OvProductRow) => row.key;
const caseRowId = (row: OvCaseRow) => row.id;

/**
 * 요약 카드 하나 (시안 `.ov-k`). 값·설명은 안쪽 span (`{{k.val}}`·`{{k.sub}}`). 이름은 시안처럼 점 옆 글 그대로
 * (T125b: 시안 라벨 span이 점+글을 함께 품는다 — gap 8px·카드 폭).
 * `hi` = 시안 `k.hi`(평균이 높음 단계): 점·숫자 빨강. 아니면 `big` 숫자 파랑.
 */
function Kpi({ tone, label, value, sub, big = false, hi = false }: { tone: string; label: string; value: string; sub: string; big?: boolean; hi?: boolean }) {
  return (
    <div className="ov-k">
      <span className="ov-k-label">
        <span className={`ov-k-dot ov-k-dot-${hi ? 'reply' : tone}`} />
        {label}
      </span>
      <b className={`ov-k-val${hi ? ' ov-k-val-hi' : big ? ' ov-k-val-big' : ''}`}>
        <span>{value}</span>
      </b>
      <span className="ov-k-sub">
        <span>{sub}</span>
      </span>
    </div>
  );
}

export function OverviewPane({ groups, filter }: { groups: TodayGroup[]; filter: ProductFilterView }) {
  const t = useT();
  const selection = useTodaySelection();
  const { done } = useSavings();
  const risk = useRiskValues();
  const [lastId, setLastId] = useState<string | null>(null);
  const [pSort, setPSort] = useState<SortState>(INITIAL_SORT);
  const [cSort, setCSort] = useState<SortState>(INITIAL_SORT);
  const shown = isOverview(selection);

  const overview = useMemo(
    () => buildOverview({ groups, filter, done, risk, severalName: t('today.row.severalProducts') }),
    [groups, filter, done, risk, t],
  );
  const pColumns = useMemo(() => productColumns(t), [t]);
  const cColumns = useMemo(() => caseColumns(t), [t]);

  const pickProduct = useCallback(
    (row: OvProductRow) => {
      const action = productRowAction(row);
      if (selection === null || action === null) return;
      if (action.kind === 'sku') {
        selection.setSku(action.sku);
      } else {
        setLastId(action.id);
        selection.select(action.id);
      }
    },
    [selection],
  );
  const pickCase = useCallback(
    (row: OvCaseRow) => {
      setLastId(row.id);
      selection?.select(row.id);
    },
    [selection],
  );
  const highOf = (value: number | null) => value !== null && riskChipParts(value).level === 'high';
  const productClass = useCallback((row: OvProductRow) => (highOf(row.risk) ? 'ov-row-hi' : ''), []);
  const caseClass = useCallback(
    (row: OvCaseRow) =>
      [row.done ? 'ov-row-dn' : highOf(row.risk) ? 'ov-row-hi' : '', row.id === lastId ? 'ov-row-on' : ''].filter(Boolean).join(' '),
    [lastId],
  );

  const { kpis } = overview;
  const avg = dashboardMeanRisk(kpis.topRisks);
  return (
    <section className="today-overview" hidden={!shown} aria-label={t('today.ov.title')}>
      <div className="ov-head">
        <div className="ov-titles">
          <h2 className="ov-title">
            <span>{t('today.ov.title')}</span>
          </h2>
          <span className="ov-sub">
            <span>{t('today.ov.sub')}</span>
          </span>
        </div>
        <span className="ag-tag">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 4h18v16H3zM3 10h18M3 15h18M9 4v16M15 4v16" fill="none" className="ag-tag-stroke" strokeWidth="1.8" />
          </svg>
          {t('today.ov.agTag')}
        </span>
      </div>
      <div className="ov-kpis">
        <Kpi tone="open" label={t('today.ov.kOpen')} value={String(kpis.open)} sub={t('today.ov.kOpenSub', { products: kpis.products, units: kpis.units })} />
        <Kpi tone="reply" label={t('today.ov.kReply')} value={String(kpis.reply)} sub={t('today.groupHint.needsYou')} />
        <Kpi tone="prevent" label={t('today.ov.kPrevent')} value={String(kpis.prevent)} sub={t('today.groupHint.prevent')} />
        <Kpi tone="questions" label={t('today.ov.kQuestions')} value={String(kpis.questions)} sub={t('today.groupHint.routine')} />
        {/* T122d: 평균은 엔진 `meanRisk`(T120d) 자리 — 상품 줄마다 최고 위험 목록을 넘긴다. 값이 없으면 "—" */}
        <Kpi
          tone="avg"
          label={t('today.ov.kAvg')}
          value={avg === null ? t('today.ov.none') : riskChipParts(avg).percent}
          sub={t('today.ov.kAvgSub', { count: kpis.topRows })}
          big
          hi={avg !== null && riskChipParts(avg).level === 'high'}
        />
      </div>

      <div className="ov-block">
        <div className="ov-block-head">
          <b className="ov-block-title">
            <span>{t('today.ov.gridProducts')}</span>
          </b>
          <span className="ov-block-hint">
            <span>{`${t('today.ov.productsHint')} · ${t('today.ov.hint')}`}</span>
          </span>
        </div>
        {shown ? (
          <OverviewGrid
            label={t('today.ov.gridProducts')}
            rows={overview.products}
            columns={pColumns}
            rowId={productRowId}
            rowClass={productClass}
            onPick={pickProduct}
            sort={pSort}
            onSort={setPSort}
          />
        ) : null}
      </div>

      <div className="ov-block">
        <div className="ov-block-head">
          <b className="ov-block-title">
            <span>{t('today.ov.gridCases')}</span>
          </b>
          <span className="ov-block-hint">
            <span>{t('today.ov.hint')}</span>
          </span>
        </div>
        {shown ? (
          <OverviewGrid
            label={t('today.ov.gridCases')}
            rows={overview.cases}
            columns={cColumns}
            rowId={caseRowId}
            rowClass={caseClass}
            onPick={pickCase}
            sort={cSort}
            onSort={setCSort}
          />
        ) : null}
      </div>
    </section>
  );
}
