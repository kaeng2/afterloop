/**
 * /listing 화면 상태와 보기 값 (T087, Scene 3, SPEC v2.12 2장·8-3장). 그리지 않는 부분만 둔 순수 파일.
 *
 * - **계산하지 않는다.** 숫자는 엔진(`createListingSim`·`checkListing`·`listingFixGains`·`detectListingFeatures`·
 *   `isPeak`) 결과를 옮긴다. 이 파일이 하는 것: 상태 바꾸기, 글자 만들기(표기), 점 그림 배치(그림일 뿐 숫자를 보이지 않음).
 * - 진행 숫자(`run.done`)는 `progress.ts`가 `sim.step()`이 돌려준 값을 그대로 넣는다 (가짜로 세지 않는다).
 * - 문구는 `config/listing.{en,ko}.json`. AI 고칠 문구는 영어 그대로 (DECISIONS "Scene 3 정직성" ⑤).
 */
import { LISTING_FIX_KEYS, detectListingFeatures, isPeak, listingModelFromConfig, listingParamsFromConfig } from '@/engine/listing';
import type {
  ListingCheckInput,
  ListingCheckResult,
  ListingDisputeType,
  ListingFeatures,
  ListingFields,
  ListingFixDrafts,
  ListingFixGains,
  ListingFixKey,
} from '@/types';

import { toDollarsRounded } from '../_shared/money';
import { count1, fill, pct1, pts1, share0, shortDay } from './format';

import listingEn from '../../../config/listing.en.json';
import listingKo from '../../../config/listing.ko.json';

export type ListingCopy = typeof listingEn;
export type ListingLocale = 'en' | 'ko';
export const LISTING_COPY: Record<ListingLocale, ListingCopy> = { en: listingEn, ko: listingKo as ListingCopy };

const MODEL = listingModelFromConfig();

/** 판정 입력칸 4개 (화면 순서) */
export const FIELD_KEYS: readonly (keyof ListingFields)[] = ['desc', 'size', 'ship', 'ret'];

export type Form = ListingFields & { title: string; from: string; to: string };
export type FormKey = keyof Form;

export type Screen = 'edit' | 'sheet' | 'detail' | 'done';
/** check = Publish 뒤 점검, recalc = Recalculate, publish = 상세에서 Publish (글이 바뀌었으면 다시 계산하고 완료) */
export type RunPurpose = 'check' | 'recalc' | 'publish';
export type Run = { id: number; purpose: RunPurpose; input: ListingCheckInput; done: number; total: number };
/** 엔진 결과 한 벌 (같은 입력으로 checkListing과 같은 값 + 고칠 점별 줄어드는 양) */
export type Calc = { input: ListingCheckInput; result: ListingCheckResult; gains: ListingFixGains };

export type DraftsState =
  | { kind: 'none' }
  | { kind: 'loading'; key: string }
  | { kind: 'ready'; key: string; drafts: ListingFixDrafts };

export type State = {
  screen: Screen;
  form: Form;
  run: Run | null;
  nextRunId: number;
  base: Calc | null;
  current: Calc | null;
  published: Calc | null;
  drafts: DraftsState;
  inserted: Partial<Record<ListingFixKey, true>>;
  flash: { field: keyof ListingFields; n: number } | null;
};

export type Action =
  | { type: 'edit'; key: FormKey; value: string }
  | { type: 'publish' }
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'finished'; id: number; calc: Calc }
  | { type: 'toDetail' }
  | { type: 'publishAnyway' }
  | { type: 'recalc' }
  | { type: 'publishFinal' }
  | { type: 'backEdit' }
  | { type: 'restart' }
  | { type: 'draftsLoading'; key: string }
  | { type: 'drafts'; key: string; drafts: ListingFixDrafts | null }
  | { type: 'insert'; fix: ListingFixKey };

export function initialForm(locale: ListingLocale): Form {
  const init = LISTING_COPY[locale].init;
  return { title: init.title, desc: init.desc, size: init.size, ship: init.ship, ret: init.ret, from: init.from, to: init.to };
}

export function initialState(locale: ListingLocale): State {
  return {
    screen: 'edit',
    form: initialForm(locale),
    run: null,
    nextRunId: 1,
    base: null,
    current: null,
    published: null,
    drafts: { kind: 'none' },
    inserted: {},
    flash: null,
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 날짜가 둘 다 있고 시작 ≤ 끝이면 참 (그래야 엔진에 넘긴다). */
export function datesValid(form: Form): boolean {
  return DATE.test(form.from) && DATE.test(form.to) && form.from <= form.to;
}

/** 화면 입력 → 엔진 입력. 가격·수량은 고정 데모 값 (`config/listing.*.json`의 demo). */
export function toCheckInput(form: Form, locale: ListingLocale = 'en'): ListingCheckInput {
  const demo = LISTING_COPY[locale].demo;
  return {
    fields: { desc: form.desc, size: form.size, ship: form.ship, ret: form.ret },
    priceCents: demo.priceCents,
    units: demo.units,
    saleFrom: form.from,
    saleTo: form.to,
  };
}

/** AI 캐시 열쇠: 상품명 + Publish 시점 설명 (SPEC 8-3장 "입력은 상품명과 Publish 시점의 설명뿐"). */
export function draftsKey(form: Form): string {
  return JSON.stringify([form.title, form.desc]);
}

const sameInput = (a: ListingCheckInput, b: ListingCheckInput) => JSON.stringify(a) === JSON.stringify(b);

function startRun(state: State, purpose: RunPurpose, locale: ListingLocale): State {
  const input = toCheckInput(state.form, locale);
  return { ...state, run: { id: state.nextRunId, purpose, input, done: 0, total: MODEL.runs }, nextRunId: state.nextRunId + 1 };
}

/** 고칠 점 문구를 그 입력칸 끝에 붙인다 (시안 insert와 같은 규칙: 빈 칸이면 그대로, 아니면 빈 줄 하나 띄우고). */
export function appendText(current: string, text: string): string {
  const head = current.trim();
  return head === '' ? text : `${head}\n\n${text}`;
}

/** 고칠 점이 들어가는 입력칸 (`config/listing-model.json` rules[k].field). */
export function fieldOf(fix: ListingFixKey): keyof ListingFields {
  return MODEL.rules[fix].field;
}

export function makeReducer(locale: ListingLocale) {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case 'edit':
        return { ...state, form: { ...state.form, [action.key]: action.value } };
      case 'publish':
        if (state.screen !== 'edit' || state.run !== null || !datesValid(state.form)) return state;
        return { ...startRun(state, 'check', locale), screen: 'sheet', base: null, current: null, published: null };
      case 'progress':
        if (state.run === null || state.run.id !== action.id) return state;
        return { ...state, run: { ...state.run, done: action.done, total: action.total } };
      case 'finished': {
        if (state.run === null || state.run.id !== action.id) return state;
        const purpose = state.run.purpose;
        if (purpose === 'check') return { ...state, run: null, base: action.calc, current: action.calc };
        if (purpose === 'recalc') return { ...state, run: null, current: action.calc };
        return { ...state, run: null, current: action.calc, published: action.calc, screen: 'done' };
      }
      case 'toDetail':
        if (state.screen !== 'sheet' || state.base === null) return state;
        return { ...state, screen: 'detail' };
      case 'publishAnyway':
        if (state.screen !== 'sheet' || state.base === null) return state;
        return { ...state, screen: 'done', published: state.base };
      case 'recalc':
        if (state.screen !== 'detail' || state.run !== null || !datesValid(state.form)) return state;
        return startRun(state, 'recalc', locale);
      case 'publishFinal': {
        if (state.screen !== 'detail' || state.run !== null || state.current === null) return state;
        if (sameInput(state.current.input, toCheckInput(state.form, locale))) {
          return { ...state, screen: 'done', published: state.current };
        }
        if (!datesValid(state.form)) return state;
        return startRun(state, 'publish', locale);
      }
      case 'backEdit':
        if (state.screen !== 'done' || state.base === null) return state;
        return { ...state, screen: 'detail' };
      case 'restart': {
        const fresh = initialState(locale);
        // 같은 상품명·설명이면 받아 둔 AI 문구를 다시 쓴다 (호출 1회)
        return { ...fresh, nextRunId: state.nextRunId, drafts: state.drafts };
      }
      case 'draftsLoading':
        return { ...state, drafts: { kind: 'loading', key: action.key } };
      case 'drafts':
        if (state.drafts.kind !== 'loading' || state.drafts.key !== action.key) return state;
        return action.drafts === null
          ? { ...state, drafts: { kind: 'none' } }
          : { ...state, drafts: { kind: 'ready', key: action.key, drafts: action.drafts } };
      case 'insert': {
        if (state.screen !== 'detail' || state.drafts.kind !== 'ready' || state.inserted[action.fix]) return state;
        const draft = state.drafts.drafts[action.fix];
        if (!draft.ok) return state;
        const field = fieldOf(action.fix);
        return {
          ...state,
          form: { ...state.form, [field]: appendText(state.form[field], draft.text) },
          inserted: { ...state.inserted, [action.fix]: true },
          flash: { field, n: (state.flash?.n ?? 0) + 1 },
        };
      }
      default:
        return state;
    }
  };
}

/** Publish 시점에 AI를 불러야 하는가 (같은 상품명·설명으로 이미 받았거나 받는 중이면 아니다). */
export function needsDrafts(state: State): boolean {
  const key = draftsKey(state.form);
  return !(state.drafts.kind !== 'none' && state.drafts.key === key);
}

// ───────────────────────────── 보기 값 ─────────────────────────────

const TYPES = MODEL.types;

/** 유형별 점 색 이름 (css 변수 꼬리). 색 값은 listing.css에만 있다. */
export const TYPE_TONE: Record<ListingDisputeType, string> = { A1: 't-a1', A2: 't-a2', B1: 't-b1', B2: 't-b2', X: 't-x' };

/**
 * 점 그림: 판매 1건 = 점 1개. 분쟁 점 수 = 평균 건수를 반올림한 값, 유형별 몫은 큰 나머지 순으로 나눈다 (시안 dotsFor와 같다).
 * 그림일 뿐 이 값을 숫자로 보이지 않는다.
 */
export function dotsFor(result: ListingCheckResult): (ListingDisputeType | null)[] {
  const n = result.units;
  const total = Math.round(result.expectedDisputes);
  const parts = TYPES.map((k) => ({ k, e: result.byType[k].expectedDisputes, f: Math.floor(result.byType[k].expectedDisputes) }));
  let left = total - parts.reduce((a, q) => a + q.f, 0);
  for (const q of [...parts].sort((a, b) => b.e - b.f - (a.e - a.f))) {
    if (left <= 0) break;
    q.f += 1;
    left -= 1;
  }
  const seq: ListingDisputeType[] = [];
  for (const q of [...parts].sort((a, b) => b.e - a.e)) for (let i = 0; i < q.f; i += 1) seq.push(q.k);
  const at = new Map<number, ListingDisputeType>();
  seq.forEach((k, j) => at.set(Math.floor(((j + 0.5) * n) / Math.max(1, seq.length)), k));
  return Array.from({ length: n }, (_, i) => at.get(i) ?? null);
}

/** 유형을 평균 건수가 큰 순으로 (표시 순서) */
export function typeOrder(result: ListingCheckResult): ListingDisputeType[] {
  return [...TYPES].sort((a, b) => result.byType[b].expectedDisputes - result.byType[a].expectedDisputes);
}

/** 화면이 보여 줄 고칠 점 (성수기가 아니면 bf를 뺀다 — 엔진이 bf에 null을 준다) */
export function fixKeysFor(gains: ListingFixGains): ListingFixKey[] {
  return LISTING_FIX_KEYS.filter((k) => gains[k] !== null);
}

export type StepLine = { text: string; mark: 'done' | 'now' | 'todo' };

export type FieldView = {
  key: keyof ListingFields;
  id: string;
  label: string;
  value: string;
  rows: number;
  missing: { fix: ListingFixKey; label: string }[];
  inserts: { fix: ListingFixKey; label: string; done: boolean }[];
  inserted: { fix: ListingFixKey; text: string }[];
  flash: number | null;
};

const FIELD_LABEL: Record<keyof ListingFields, keyof ListingCopy> = { desc: 'fDesc', size: 'fSize', ship: 'fShip', ret: 'fRet' };
const FIELD_ROWS: Record<keyof ListingFields, number> = { desc: 4, size: 3, ship: 4, ret: 3 };

export type ResultView = {
  prob: string;
  probSub: string;
  loss: string;
  lossRange: string;
  dots: (ListingDisputeType | null)[];
  dotsL: string;
};

function resultView(r: ListingCheckResult, c: ListingCopy): ResultView {
  return {
    prob: pct1(r.pPerOrder),
    probSub: fill(c.probSub, { d: count1(r.expectedDisputes), n: r.units }),
    loss: toDollarsRounded(r.meanLossCents),
    lossRange: fill(c.lossRange, { p10: toDollarsRounded(r.p10LossCents), p90: toDollarsRounded(r.p90LossCents) }),
    dots: dotsFor(r),
    dotsL: fill(c.dotsL, { n: r.units }),
  };
}

/** 계산 방법 설명: 수수료·시간 비용·환불 몫은 params 값 (DECISIONS "Scene 3 정직성" ②) */
export function lossTip(c: ListingCopy, runs: number): string {
  const p = listingParamsFromConfig();
  return fill(c.lossTip, {
    refundShare: share0(p.refundShare),
    fee: toDollarsRounded(p.feeCents),
    time: toDollarsRounded(p.timeCostCents),
    runs,
  });
}

export function periodText(form: Form, locale: ListingLocale): string {
  return `${shortDay(form.from, locale)}–${shortDay(form.to, locale)}`;
}

export function buildView(state: State, locale: ListingLocale) {
  const c = LISTING_COPY[locale];
  const live: ListingFeatures = detectListingFeatures(toCheckInput(state.form, locale).fields);
  const livePeak = datesValid(state.form) ? isPeak(state.form.from, state.form.to) : false;
  const period = periodText(state.form, locale);
  const run = state.run;
  const isDetail = state.screen === 'detail';
  const drafts = state.drafts.kind === 'ready' ? state.drafts.drafts : null;

  const fields: FieldView[] = FIELD_KEYS.map((key) => {
    const fixes = LISTING_FIX_KEYS.filter((k) => fieldOf(k) === key);
    const missing = fixes.filter((k) => !live[k] && !(k === 'bf' && !livePeak));
    return {
      key,
      id: `ls-${key}`,
      label: c[FIELD_LABEL[key]] as string,
      value: state.form[key],
      rows: FIELD_ROWS[key],
      missing: isDetail ? missing.map((fix) => ({ fix, label: c.fixes[fix] })) : [],
      inserts: isDetail
        ? fixes
            .filter((k) => drafts !== null && drafts[k].ok && (missing.includes(k) || state.inserted[k]))
            .map((fix) => ({ fix, label: c.fixes[fix], done: !!state.inserted[fix] }))
        : [],
      inserted: fixes.flatMap((fix) => {
        const d = drafts?.[fix];
        return state.inserted[fix] && d && d.ok ? [{ fix, text: d.text }] : [];
      }),
      flash: state.flash !== null && state.flash.field === key ? state.flash.n : null,
    };
  });

  const steps: StepLine[] = run
    ? c.anSteps.map((t, i) => ({
        text: fill(t, i === 3 ? { done: run.done, total: run.total } : {}),
        // 1~3 (입력칸 판정·판매 기간·유형별 확률)은 createListingSim이 만들 때 끝낸다. 4번이 실제 n / 500
        mark: i < 3 ? 'done' : run.done >= run.total ? 'done' : 'now',
      }))
    : [];

  const base = state.base;
  const cur = state.current;
  const sheet =
    state.screen === 'sheet'
      ? base === null
        ? {
            kind: 'running' as const,
            anS: fill(c.anS, { period: period + (livePeak ? ` · ${c.peakOn}` : '') }),
            steps,
            done: run?.done ?? 0,
            total: run?.total ?? MODEL.runs,
            runTxt: fill(c.running, { done: run?.done ?? 0, total: run?.total ?? MODEL.runs }),
            // 진행 그림: 칸 i는 끝낸 횟수가 그 칸 몫을 넘으면 켜진다 (숫자는 run.done 그대로)
            cells: Array.from({ length: LISTING_COPY[locale].demo.units }, (_, i) =>
              run ? (i / LISTING_COPY[locale].demo.units) * run.total < run.done : false,
            ),
          }
        : {
            kind: 'ready' as const,
            ...resultView(base.result, c),
            basis: [
              { k: c.basis.units, v: fill(c.unitsV, { n: base.result.units }), chip: '' },
              { k: c.basis.period, v: periodOf(base.input, locale), chip: base.result.peak ? c.peakOn : '' },
              { k: c.basis.price, v: toDollarsRounded(base.input.priceCents), chip: '' },
              { k: c.basis.data, v: fill(c.dataV, { runs: base.result.runs }), chip: '', assumption: true },
            ],
            legend: typeOrder(base.result)
              .slice(0, 3)
              .map((k) => ({ k, name: c.types[k], pct: pct1(base.result.byType[k].pPerOrder) })),
            top: typeOrder(base.result)
              .slice(0, 3)
              .map((k, i) => ({
                k,
                rank: String(i + 1),
                name: c.types[k],
                pct: pct1(base.result.byType[k].pPerOrder),
                of: fill(c.ofUnits, { d: count1(base.result.byType[k].expectedDisputes), n: base.result.units }),
                why: whyFor(k, base.result.features, c),
              })),
            peak: base.result.peak,
            fixes: fixKeysFor(base.gains)
              .filter((k) => (base.gains[k] ?? 0) > 0)
              .sort((a, b) => (base.gains[b] ?? 0) - (base.gains[a] ?? 0))
              .slice(0, 4)
              .map((k) => ({ k, t: c.fixes[k], s: fill(c.probCut, { x: pts1(base.gains[k] ?? 0) }) })),
            lossTip: lossTip(c, base.result.runs),
          }
      : null;

  const recalcRunning = run !== null && run.purpose !== 'check';
  const dirty = cur !== null && !sameInput(cur.input, toCheckInput(state.form, locale));
  const panel =
    isDetail && base !== null && cur !== null
      ? (() => {
          const order = typeOrder(base.result);
          const maxBase = Math.max(...order.map((k) => base.result.byType[k].expectedDisputes), Number.EPSILON);
          const improved = cur.result.pPerOrder < base.result.pPerOrder;
          return {
            ...resultView(cur.result, c),
            improved,
            before: `${c.before} ${pct1(base.result.pPerOrder)}`,
            basisLine: `${fill(c.unitsV, { n: cur.result.units })} · ${periodOf(cur.input, locale)}${cur.result.peak ? ` · ${c.peakOn}` : ''}`,
            dataLine: fill(c.dataV, { runs: cur.result.runs }),
            types: order.map((k) => ({
              k,
              name: c.types[k],
              pct: pct1(cur.result.byType[k].pPerOrder),
              // 막대 길이 = 처음 결과의 가장 큰 유형 대비 (그림 비율)
              ghost: base.result.byType[k].expectedDisputes / maxBase,
              bar: Math.min(1, cur.result.byType[k].expectedDisputes / maxBase),
              down: cur.result.byType[k].expectedDisputes < base.result.byType[k].expectedDisputes,
            })),
            status: recalcRunning ? fill(c.recalcing, { done: run.done, total: run.total }) : dirty ? c.changed : c.upToDate,
            dirty,
            running: recalcRunning,
            progress: recalcRunning ? run.done / run.total : 0,
            recalcDisabled: !dirty || recalcRunning || !datesValid(state.form),
            recalcLabel: recalcRunning ? fill(c.recalcing, { done: run.done, total: run.total }) : c.recalc,
            checks: fixKeysFor(cur.gains).map((k) => ({
              k,
              t: c.fixes[k],
              on: cur.result.features[k],
              s: cur.result.features[k] ? c.fixDone : fill(c.probCut, { x: pts1(cur.gains[k] ?? 0) }),
            })),
            lossTip: lossTip(c, cur.result.runs),
          };
        })()
      : null;

  const done =
    state.screen === 'done' && base !== null && state.published !== null
      ? (() => {
          const pub = state.published.result;
          return {
            title: fill(c.doneS, { title: state.form.title }),
            prob: fill(c.doneProb, { a: pct1(base.result.pPerOrder), b: pct1(pub.pPerOrder) }),
            loss: fill(c.doneLoss, { a: toDollarsRounded(base.result.meanLossCents), b: toDollarsRounded(pub.meanLossCents) }),
            disp: fill(c.doneDisp, { a: count1(base.result.expectedDisputes), b: count1(pub.expectedDisputes) }),
            improved: pub.pPerOrder < base.result.pPerOrder,
            note: fill(c.doneNote, { runs: pub.runs }),
          };
        })()
      : null;

  return {
    c,
    locale,
    screen: state.screen,
    form: state.form,
    priceText: toDollarsRounded(c.demo.priceCents),
    unitsText: String(c.demo.units),
    peak: livePeak,
    datesValid: datesValid(state.form),
    fields,
    aiWriting: isDetail && state.drafts.kind === 'loading',
    anyInserted: fields.some((f) => f.inserted.length > 0),
    sheet,
    panel,
    done,
  };
}

export type ListingView = ReturnType<typeof buildView>;

function periodOf(input: ListingCheckInput, locale: ListingLocale): string {
  return `${shortDay(input.saleFrom, locale)}–${shortDay(input.saleTo, locale)}`;
}

function whyFor(k: ListingDisputeType, features: ListingFeatures, c: ListingCopy): string {
  const fix = (c.typeFix as Partial<Record<ListingDisputeType, ListingFixKey>>)[k];
  return fix !== undefined && features[fix] ? c.whyCovered : c.why[k];
}
