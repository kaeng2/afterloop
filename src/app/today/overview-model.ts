/**
 * "All products" 전체 현황 값 (T122b, 시안 v6 `renderVals` "All products overview (AG Grid)"). 브라우저 묶음에도
 * 들어간다 — 타입 말고는 아무것도 import하지 않는다.
 *
 * **계산하지 않는다** — 항목 수를 세고, 엔진 위험 값(`ListRiskValues`, 무응답 pChargeback)을 옮기고, 가장 큰 값을 고르기만
 * 한다. 평균은 내지 않는다 — 상품 줄마다 최고 위험 목록(`kpis.topRisks`)을 엔진 `meanRisk`(T120d) 자리(`mean-risk.ts`)에 넘긴다.
 *
 * - Products 표: 칩 상품마다 한 줄 + 한 상품에 걸리지 않은 항목(추적·여러 상품)이 있으면 "Several products" 한 줄
 *   (시안 `multi`). 끝낸 항목(`done`)은 세지 않는다 (시안 `!s.done[i.id]`). 위험 = 그 줄의 값이 있는 항목 중 가장 큰 값.
 * - Cases by risk 표: 목록의 모든 항목 (끝낸 항목 포함 — 흐리게, 상태 "Done today"). 끝낸 항목·값 없는 항목의 위험은 없음.
 */
import type { ProductIconKind } from '../cases/desk-model';
import type { DoneMap } from './done-groups';
import type { ProductFilterView, TodayGroup, TodayGroupKey, TodayItem } from './model';

export type OvSection = TodayGroupKey | 'done';

/** 상태 열 정렬 순서 (시안 `secOrd` + done 3). */
export const SECTION_ORDER: Readonly<Record<OvSection, number>> = { needsYou: 0, prevent: 1, routine: 2, done: 3 };

/** 상태 글자 문구 키 (목록 묶음 제목과 같다). */
export const SECTION_TITLE_KEY: Readonly<Record<OvSection, string>> = {
  needsYou: 'today.group.needsYou',
  prevent: 'today.group.prevent',
  routine: 'today.group.routine',
  done: 'today.group.done',
};

/** "Several products" 줄의 키 (시안 `multi`). */
export const MULTI_KEY = 'multi';

export type OvTop = { id: string; head: string; category: string | null };

export type OvProductRow = {
  key: string;
  /** 칩 SKU. "Several products" 줄은 `null`. */
  sku: string | null;
  name: string;
  icon: ProductIconKind;
  /** 재고 수. "Several products" 줄은 `null` (아래 글 "Prevention tasks"). */
  units: number | null;
  open: number;
  reply: number;
  prevent: number;
  questions: number;
  /** 줄의 가장 큰 엔진 위험 값 (0~1). 값 있는 항목이 없으면 `null`. */
  risk: number | null;
  /** 가장 위험한 항목 (값이 없으면 그 줄 첫 항목). 열린 항목이 없으면 `null`. */
  top: OvTop | null;
};

export type OvCaseRow = {
  id: string;
  risk: number | null;
  head: string;
  product: string | null;
  category: string | null;
  section: OvSection;
  /** 구매자 줄 (분쟁만). 없으면 빈 글. */
  who: string;
  /** "Reply by Nov 30". 없으면 `null`. */
  due: string | null;
  /** 기한 정렬 값 (ms). 모르면 무한대 (뒤로). */
  dueMs: number;
  done: boolean;
};

export type OvKpis = {
  open: number;
  reply: number;
  prevent: number;
  questions: number;
  products: number;
  units: number;
  topRows: number;
  /** 상품 줄마다 최고 위험(엔진 값) 목록 — "Avg. dispute risk" 엔진 평균의 입력 (T122d, 시안 `avgR`). 값 없는 줄은 뺀다. */
  topRisks: number[];
};

export type Overview = { products: OvProductRow[]; cases: OvCaseRow[]; kpis: OvKpis };

type RiskValues = Readonly<Record<string, number>>;

const riskOf = (values: RiskValues, item: TodayItem, done: DoneMap): number | null =>
  Object.hasOwn(done, item.id) || !Object.hasOwn(values, item.id) ? null : values[item.id];

/** 값 큰 순 (값 없음은 뒤). 같으면 원래 순서. */
const byRiskDesc = (values: RiskValues, done: DoneMap) => (a: TodayItem, b: TodayItem) =>
  (riskOf(values, b, done) ?? -1) - (riskOf(values, a, done) ?? -1);

function rowKeyOf(item: TodayItem): string {
  return item.row.skus.length === 1 ? item.row.skus[0] : MULTI_KEY;
}

function dueMsOf(item: TodayItem): number {
  const ms = Date.parse(item.dueDate);
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

export function buildOverview(input: {
  groups: readonly TodayGroup[];
  filter: ProductFilterView;
  done: DoneMap;
  risk: RiskValues;
  /** "Several products" 줄 이름 (문구). */
  severalName: string;
}): Overview {
  const { groups, filter, done, risk } = input;
  const entries = groups.flatMap((group) => group.items.map((item) => ({ item, section: group.key as OvSection })));
  const open = entries.filter((entry) => !Object.hasOwn(done, entry.item.id));
  const count = (list: typeof entries, key: TodayGroupKey) => list.filter((entry) => entry.section === key).length;

  const productRow = (key: string, base: Pick<OvProductRow, 'sku' | 'name' | 'icon' | 'units'>): OvProductRow => {
    const mine = open.filter((entry) => rowKeyOf(entry.item) === key);
    const topItem = mine.map((entry) => entry.item).sort(byRiskDesc(risk, done))[0];
    return {
      key,
      ...base,
      open: mine.length,
      reply: count(mine, 'needsYou'),
      prevent: count(mine, 'prevent'),
      questions: count(mine, 'routine'),
      risk: topItem === undefined ? null : riskOf(risk, topItem, done),
      top: topItem === undefined ? null : { id: topItem.id, head: topItem.row.head, category: topItem.row.category },
    };
  };

  const products = filter.chips
    .filter((chip): chip is typeof chip & { sku: string } => chip.sku !== null)
    .map((chip) => productRow(chip.sku, { sku: chip.sku, name: chip.name, icon: chip.icon, units: chip.units }));
  if (entries.some((entry) => rowKeyOf(entry.item) === MULTI_KEY)) {
    products.push(productRow(MULTI_KEY, { sku: null, name: input.severalName, icon: 'multi', units: null }));
  }

  const cases: OvCaseRow[] = entries.map(({ item, section }) => {
    const isDone = Object.hasOwn(done, item.id);
    return {
      id: item.id,
      risk: riskOf(risk, item, done),
      head: item.row.head,
      product: item.row.product,
      category: item.row.category,
      section: isDone ? 'done' : section,
      who: item.kind === 'dispute' || item.kind === 'demo' ? (item.row.who ?? '') : '',
      due: item.row.due,
      dueMs: dueMsOf(item),
      done: isDone,
    };
  });

  return {
    products,
    cases,
    kpis: {
      open: open.length,
      reply: count(open, 'needsYou'),
      prevent: count(open, 'prevent'),
      questions: count(open, 'routine'),
      products: filter.products,
      units: filter.units,
      topRows: products.filter((row) => row.top !== null).length,
      topRisks: products.flatMap((row) => (row.risk === null ? [] : [row.risk])),
    },
  };
}

/** 위험 열 정렬: 값 없음은 가장 낮게 (시안 끝낸 항목 0과 같은 자리). */
export function compareRisk(a: number | null | undefined, b: number | null | undefined): number {
  return (a ?? -1) - (b ?? -1);
}
