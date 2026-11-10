/**
 * 단위 테스트: 가게 합계 + 점 그림용 대표 미래 (SPEC v2.7 8장). 작업 T048.
 *
 * 숫자를 기대값으로 적는 것은 고정 사본(`tests/acceptance/params.fixture.json`, `rules.fixture.json`)으로
 * 계산할 때뿐이다. 라이브 `config/`로 돌리는 테스트는 관계(합 = 상품별 합, ⊆ 등)만 확인한다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { paramsConfigFromFile } from '@/engine/params';
import { DEFAULT_FUTURES, FIX_ORDER, simInputFor, simulate, simulatePass } from '@/engine/sim';
import { pickPreventProduct, pickRepresentativeFuture, simulateStore } from '@/engine/storefront';
import type { FixId, ParamsConfig, PolicyConfig, SimInput } from '@/types';

import paramsFixture from '../acceptance/params.fixture.json';
import rulesFixture from '../acceptance/rules.fixture.json';
import products from '../../seed/products.json';

const FIXTURE_PARAMS = paramsFixture as unknown as ParamsConfig;
const FIXTURE_RULES = rulesFixture as unknown as PolicyConfig;
const CONFIG: ParamsConfig = paramsConfigFromFile();
const ALL_FIXES: FixId[] = [...FIX_ORDER];
const PRODUCTS = (products as { sku: string; priceCents: number; stock: number }[]).map(({ sku, priceCents, stock }) => ({
  sku,
  priceCents,
  stock,
}));

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

/** 손으로 만든 입력 */
function input(over: Partial<SimInput> = {}): SimInput {
  return {
    sku: 'TEST-SKU',
    priceCents: 4800,
    stock: 40,
    rates: { A1: 0.05, B1: 0.05 },
    fixes: [],
    futures: 50,
    seed: 777,
    ...over,
  };
}

/** 테스트 안의 단순 구현: Before 평균 분쟁 수에 가장 가까운 미래 (동점이면 작은 번호). */
function naiveClosest(disputes: number[]): number {
  const mean = disputes.reduce((a, b) => a + b, 0) / disputes.length;
  let best = -1;
  for (let i = 0; i < disputes.length; i += 1) {
    if (best === -1 || Math.abs(disputes[i] - mean) < Math.abs(disputes[best] - mean) - 1e-12) best = i;
  }
  return best;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('simulateStore: 가게 합계', () => {
  it('고정 사본 가정값으로 시드 상품 4개, 처방 4개 모두 켬 → 71718 / 25316', () => {
    const total = simulateStore(PRODUCTS, ALL_FIXES, FIXTURE_PARAMS, FIXTURE_RULES);
    expect(total.beforeCents).toBe(71718);
    expect(total.afterCents).toBe(25316);
    // 정렬: before 큰 순서 (고정 사본 값)
    expect(total.products.map((row) => row.sku)).toEqual(['FK-BN-SET', 'FK-CD-OAT', 'FK-CT-GR', 'FK-SW-NV']);
    expect(total.products.map((row) => row.result.before.meanLossCents)).toEqual([25460, 21619, 13651, 10988]);
    expect(total.products.map((row) => row.result.after.meanLossCents)).toEqual([7078, 4366, 11310, 2562]);
  });

  it('합계 = 상품별 평균 손실의 정수 합 (라이브 config)', () => {
    const total = simulateStore(PRODUCTS, ALL_FIXES);
    let before = 0;
    let after = 0;
    for (const product of PRODUCTS) {
      const result = simulate(simInputFor(product.sku, product, ALL_FIXES, CONFIG));
      before += result.before.meanLossCents;
      after += result.after.meanLossCents;
    }
    expect(total.beforeCents).toBe(before);
    expect(total.afterCents).toBe(after);
    expect(Number.isInteger(total.beforeCents)).toBe(true);
    expect(Number.isInteger(total.afterCents)).toBe(true);
  });

  it('상품별 결과는 simulate 결과 그대로', () => {
    const total = simulateStore(PRODUCTS, ['color_note']);
    for (const row of total.products) {
      const product = PRODUCTS.find((p) => p.sku === row.sku)!;
      expect(row.result).toEqual(simulate(simInputFor(product.sku, product, ['color_note'], CONFIG)));
    }
  });

  it('상품 1개: 합계 = 그 상품의 simulate 값', () => {
    const one = PRODUCTS[0];
    const total = simulateStore([one], ALL_FIXES);
    const result = simulate(simInputFor(one.sku, one, ALL_FIXES, CONFIG));
    expect(total.beforeCents).toBe(result.before.meanLossCents);
    expect(total.afterCents).toBe(result.after.meanLossCents);
    expect(total.products).toEqual([{ sku: one.sku, result }]);
  });

  it('빈 배열: 0 / 0 / []', () => {
    expect(simulateStore([], ALL_FIXES)).toEqual({ beforeCents: 0, afterCents: 0, products: [] });
  });

  it('재고 0 상품: 손실 0으로 더해진다', () => {
    const total = simulateStore([{ ...PRODUCTS[0], stock: 0 }], ALL_FIXES);
    expect(total.beforeCents).toBe(0);
    expect(total.afterCents).toBe(0);
  });

  it('정렬: before 큰 순서 (라이브 config)', () => {
    const values = simulateStore(PRODUCTS, ALL_FIXES).products.map((row) => row.result.before.meanLossCents);
    expect(values).toEqual([...values].sort((x, y) => y - x));
  });

  it('동점이면 입력 순서 (안정 정렬). 입력 배열을 바꾸지 않는다', () => {
    // 재고 0인 상품 둘은 손실이 모두 0 → 동점. 재고가 있는 상품이 앞, 동점 둘은 넣은 순서대로.
    const big = PRODUCTS.find((p) => p.sku === 'FK-BN-SET')!;
    const x = { ...PRODUCTS.find((p) => p.sku === 'FK-SW-NV')!, stock: 0 };
    const y = { ...PRODUCTS.find((p) => p.sku === 'FK-CD-OAT')!, stock: 0 };

    const forward = deepFreeze([x, y, big]);
    expect(simulateStore(forward, ALL_FIXES).products.map((row) => row.sku)).toEqual(['FK-BN-SET', 'FK-SW-NV', 'FK-CD-OAT']);
    expect(forward.map((p) => p.sku)).toEqual(['FK-SW-NV', 'FK-CD-OAT', 'FK-BN-SET']);

    const backward = deepFreeze([y, x, big]);
    expect(simulateStore(backward, ALL_FIXES).products.map((row) => row.sku)).toEqual(['FK-BN-SET', 'FK-CD-OAT', 'FK-SW-NV']);
  });

  it('잘못된 입력은 zod 예외', () => {
    expect(() => simulateStore([{ ...PRODUCTS[0], stock: -1 }], ALL_FIXES)).toThrow(ZodError);
    expect(() => simulateStore([{ ...PRODUCTS[0], priceCents: 1.5 }], ALL_FIXES)).toThrow(ZodError);
    expect(() => simulateStore(PRODUCTS, ['nope' as FixId])).toThrow(ZodError);
  });

  it('입력 객체를 바꾸지 않는다 (deep freeze)', () => {
    const frozen = deepFreeze(PRODUCTS.map((p) => ({ ...p })));
    const fixes = deepFreeze([...ALL_FIXES]);
    expect(() => simulateStore(frozen, fixes)).not.toThrow();
  });
});

describe('pickRepresentativeFuture: 점 그림용 대표 미래', () => {
  it('고정 사본 가정값: 시드 상품 4개의 미래 번호와 분쟁 수', () => {
    const picked = Object.fromEntries(
      PRODUCTS.map((product) => {
        const future = pickRepresentativeFuture(
          simInputFor(product.sku, product, ALL_FIXES, FIXTURE_PARAMS),
          FIXTURE_PARAMS,
          FIXTURE_RULES,
        );
        return [product.sku, [future.futureIndex, future.disputesBefore, future.disputesAfter]];
      }),
    );
    expect(picked).toEqual({
      'FK-CD-OAT': [1, 4, 2],
      'FK-SW-NV': [0, 2, 1],
      'FK-CT-GR': [1, 1, 1],
      'FK-BN-SET': [5, 6, 6],
    });
  });

  it('같은 미래 번호: simulatePass의 disputeOrders와 정확히 같다', () => {
    for (const product of PRODUCTS) {
      const simInput = simInputFor(product.sku, product, ALL_FIXES, CONFIG);
      const future = pickRepresentativeFuture(simInput);
      const before = new Set(simulatePass(simInput, []).disputeOrders[future.futureIndex]);
      const after = new Set(simulatePass(simInput, ALL_FIXES).disputeOrders[future.futureIndex]);

      expect(future.orders).toHaveLength(product.stock);
      future.orders.forEach((order, i) => {
        expect(order.index).toBe(i);
        expect(order.disputedBefore).toBe(before.has(i));
        expect(order.disputedAfter).toBe(after.has(i));
      });
    }
  });

  it('After ⊆ Before, 분쟁 수 = 참인 주문 수', () => {
    for (const product of PRODUCTS) {
      const future = pickRepresentativeFuture(simInputFor(product.sku, product, ALL_FIXES, CONFIG));
      for (const order of future.orders) if (order.disputedAfter) expect(order.disputedBefore).toBe(true);
      expect(future.disputesAfter).toBeLessThanOrEqual(future.disputesBefore);
      expect(future.disputesBefore).toBe(future.orders.filter((o) => o.disputedBefore).length);
      expect(future.disputesAfter).toBe(future.orders.filter((o) => o.disputedAfter).length);
    }
  });

  it('고른 미래 = 500개 미래를 전부 훑는 단순 구현과 같은 번호', () => {
    for (const product of PRODUCTS) {
      const simInput = simInputFor(product.sku, product, ALL_FIXES, CONFIG);
      expect(simInput.futures).toBe(DEFAULT_FUTURES);
      const future = pickRepresentativeFuture(simInput);
      expect(future.futureIndex).toBe(naiveClosest(simulatePass(simInput, []).disputes));
    }
  });

  it('동점이면 작은 번호 (futures: 4, 손으로 만든 입력)', () => {
    // 여러 시드 중 분쟁 수 거리가 동점인 미래가 생기는 경우를 찾아 확인한다.
    let checkedTie = false;
    for (let seed = 1; seed <= 200 && !checkedTie; seed += 1) {
      const simInput = input({ futures: 4, stock: 6, rates: { A1: 0.2 }, seed });
      const disputes = simulatePass(simInput, []).disputes;
      const total = disputes.reduce((a, b) => a + b, 0);
      const distances = disputes.map((d) => Math.abs(d * 4 - total));
      const min = Math.min(...distances);
      const tied = distances.map((d, i) => (d === min ? i : -1)).filter((i) => i >= 0);
      if (tied.length < 2) continue;
      // 서로 다른 분쟁 수가 같은 거리인 경우(평균 위·아래)를 우선 찾는다
      const distinct = new Set(tied.map((i) => disputes[i]));
      if (distinct.size < 2) continue;
      expect(pickRepresentativeFuture(simInput).futureIndex).toBe(tied[0]);
      checkedTie = true;
    }
    expect(checkedTie).toBe(true);
  });

  it('fixes를 [], 일부, 전부로 바꿔도 futureIndex와 disputedBefore가 같다', () => {
    for (const product of PRODUCTS) {
      const base = pickRepresentativeFuture(simInputFor(product.sku, product, [], CONFIG));
      for (const fixes of [['color_note'], ['tracking_24h', 'settle_first'], ALL_FIXES] as FixId[][]) {
        const other = pickRepresentativeFuture(simInputFor(product.sku, product, fixes, CONFIG));
        expect(other.futureIndex).toBe(base.futureIndex);
        expect(other.orders.map((o) => [o.disputedBefore, o.subtypeBefore])).toEqual(
          base.orders.map((o) => [o.disputedBefore, o.subtypeBefore]),
        );
        expect(other.disputesBefore).toBe(base.disputesBefore);
      }
    }
  });

  it('fixes가 []이면 After = Before', () => {
    const future = pickRepresentativeFuture(simInputFor('FK-CD-OAT', PRODUCTS[0], [], CONFIG));
    for (const order of future.orders) {
      expect(order.disputedAfter).toBe(order.disputedBefore);
      expect(order.subtypeAfter).toBe(order.subtypeBefore);
    }
    expect(future.disputesAfter).toBe(future.disputesBefore);
  });

  it('분쟁 난 주문만 세부 유형이 있고, 유형은 그 상품 rates에 있는 것뿐', () => {
    for (const product of PRODUCTS) {
      const simInput = simInputFor(product.sku, product, ALL_FIXES, CONFIG);
      const allowed = new Set(Object.keys(simInput.rates));
      const future = pickRepresentativeFuture(simInput);
      for (const order of future.orders) {
        expect(order.subtypeBefore !== null).toBe(order.disputedBefore);
        expect(order.subtypeAfter !== null).toBe(order.disputedAfter);
        if (order.subtypeBefore !== null) expect(allowed.has(order.subtypeBefore)).toBe(true);
        if (order.subtypeAfter !== null) expect(allowed.has(order.subtypeAfter)).toBe(true);
      }
    }
  });

  it('처방을 켜면 같은 주문이 다른 유형으로 걸릴 수 있다 (앞 유형이 빠지고 뒤 유형이 남음)', () => {
    // A1(×0.25 tracking_24h) 다음 B1. A1이 처방으로 빠지면 B1 판정 난수가 남아 B1로 걸릴 수 있다.
    const simInput = input({ stock: 200, futures: 1, rates: { A1: 0.5, B1: 0.5 }, fixes: ['tracking_24h'] });
    const future = pickRepresentativeFuture(simInput);
    const changed = future.orders.filter(
      (o) => o.subtypeBefore !== null && o.subtypeAfter !== null && o.subtypeBefore !== o.subtypeAfter,
    );
    expect(changed.length).toBeGreaterThan(0);
    for (const order of changed) {
      expect(order.subtypeBefore).toBe('A1');
      expect(order.subtypeAfter).toBe('B1');
    }
  });

  it('SimPass.disputeSubtypes는 disputeOrders와 같은 모양', () => {
    const pass = simulatePass(simInputFor('FK-CD-OAT', PRODUCTS[0], [], CONFIG), []);
    expect(pass.disputeSubtypes).toHaveLength(pass.disputeOrders.length);
    pass.disputeOrders.forEach((orders, f) => expect(pass.disputeSubtypes[f]).toHaveLength(orders.length));
  });

  it('stock: 0 → 빈 orders, 분쟁 0', () => {
    const future = pickRepresentativeFuture(input({ stock: 0, fixes: ALL_FIXES }));
    expect(future).toEqual({ futureIndex: 0, orders: [], disputesBefore: 0, disputesAfter: 0 });
  });

  it('futures: 0 → 명확한 예외', () => {
    expect(() => pickRepresentativeFuture(input({ futures: 0 }))).toThrow(/futures가 0/);
  });

  it('잘못된 입력은 zod 예외', () => {
    expect(() => pickRepresentativeFuture(input({ stock: -1 }))).toThrow(ZodError);
    expect(() => pickRepresentativeFuture(input({ fixes: ['nope' as FixId] }))).toThrow(ZodError);
    expect(() => pickRepresentativeFuture(input({ rates: { A1: 2 } }))).toThrow(ZodError);
  });

  it('입력 객체를 바꾸지 않는다 (deep freeze)', () => {
    const frozen = deepFreeze(simInputFor('FK-CD-OAT', PRODUCTS[0], ALL_FIXES, CONFIG));
    expect(() => pickRepresentativeFuture(frozen)).not.toThrow();
  });
});

describe('결정론', () => {
  it('같은 입력 100회 → 결과 JSON이 모두 같다', () => {
    const store = JSON.stringify(simulateStore(PRODUCTS, ALL_FIXES));
    const simInput = simInputFor('FK-CD-OAT', PRODUCTS[0], ALL_FIXES, CONFIG);
    const future = JSON.stringify(pickRepresentativeFuture(simInput));
    for (let i = 0; i < 100; i += 1) {
      expect(JSON.stringify(simulateStore(PRODUCTS.map((p) => ({ ...p })), [...ALL_FIXES]))).toBe(store);
      expect(JSON.stringify(pickRepresentativeFuture({ ...simInput, rates: { ...simInput.rates }, fixes: [...simInput.fixes] }))).toBe(
        future,
      );
    }
  });

  it('Math.random·Date.now·performance.now를 부르지 않는다', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    const perf = vi.spyOn(performance, 'now');

    simulateStore(PRODUCTS, ALL_FIXES);
    pickRepresentativeFuture(simInputFor('FK-CD-OAT', PRODUCTS[0], ALL_FIXES, CONFIG));

    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(perf).not.toHaveBeenCalled();
  });

  it('소스에 Math.random·Date·performance.now·toDollarsRounded가 없다', () => {
    const source = readFileSync(path.resolve(__dirname, '../../src/engine/storefront.ts'), 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join('\n');
    expect(code).not.toMatch(/Math\.random/);
    expect(code).not.toMatch(/new Date|Date\.now/);
    expect(code).not.toMatch(/performance\.now/);
    expect(code).not.toMatch(/toDollarsRounded/);
    expect(code).not.toMatch(/from ['"]@\/app/);
  });
});

describe('pickPreventProduct (T066)', () => {
  const row = (sku: string, before: number, after: number) => ({
    sku,
    result: { before: { meanLossCents: before }, after: { meanLossCents: after } },
  });
  const store = (rows: ReturnType<typeof row>[]) =>
    ({ beforeCents: 0, afterCents: 0, products: rows }) as unknown as Parameters<typeof pickPreventProduct>[0];

  it('현재 설정·시드: 가디건, 80%', () => {
    const pick = pickPreventProduct(simulateStore(PRODUCTS, ALL_FIXES));
    expect(pick?.sku).toBe('FK-CD-OAT');
    expect(pick?.cutPercent).toBe(80);
  });

  it('비율이 같으면 before가 큰 쪽', () => {
    expect(pickPreventProduct(store([row('A', 100, 50), row('B', 200, 100)]))?.sku).toBe('B');
  });

  it('비율·before가 같으면 입력 순서 앞', () => {
    expect(pickPreventProduct(store([row('A', 100, 50), row('B', 100, 50)]))?.sku).toBe('A');
  });

  it('before 0은 제외, 대상 없으면 null', () => {
    expect(pickPreventProduct(store([row('Z', 0, 0), row('A', 100, 90)]))?.sku).toBe('A');
    expect(pickPreventProduct(store([row('Z', 0, 0)]))).toBeNull();
    expect(pickPreventProduct(store([]))).toBeNull();
  });
});
