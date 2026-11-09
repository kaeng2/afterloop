/**
 * 단위 테스트: 상품 진단 시뮬레이션 (SPEC v2.2 8장, 원문 9장). 작업 T015.
 *
 * 기대값은 `config/params.json`·`config/rules.json`에서 계산한다 (원문 숫자 $195/$43를 기대값으로 쓰지 않는다).
 * 확인하는 것: 결정론, 같은 난수(After ⊆ Before), 폭포 단조성, 통계 건전성, 요약·분포의 모양, 경계, 성능, 검증.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { paramsConfigFromFile, paramsFromConfig } from '@/engine/params';
import { DEFAULT_FUTURES, FIX_ORDER, simInputFor, simulate, simulatePass } from '@/engine/sim';
import { mulberry32, seedFromString } from '@/engine/rng';
import type { FixId, Params, ParamsConfig, SimInput, Subtype } from '@/types';

import products from '../../seed/products.json';

const CONFIG: ParamsConfig = paramsConfigFromFile();
const P: Params = paramsFromConfig();
const ALL_FIXES: FixId[] = [...FIX_ORDER];

/** 시드 데이터의 4개 상품 (가격·재고만 읽는다). */
const PRODUCTS = products as { sku: string; priceCents: number; stock: number }[];

/** 상품별 주문당 분쟁 확률 (config). */
function ratesFor(sku: string): Partial<Record<Subtype, number>> {
  return CONFIG.productRates[sku].value;
}

/** 손으로 만든 입력 (한 유형만, 재고 1 → 미래마다 분쟁 1건). */
function input(over: Partial<SimInput> = {}): SimInput {
  return {
    sku: 'TEST-SKU',
    priceCents: 4800,
    stock: 120,
    rates: ratesFor('FK-CD-OAT'),
    fixes: [],
    futures: DEFAULT_FUTURES,
    seed: 12345,
    ...over,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('결정론: 같은 입력이면 항상 같은 결과', () => {
  it('같은 입력 100회가 모두 같은 결과', () => {
    const base = simInputFor('FK-CD-OAT', PRODUCTS[0], ALL_FIXES);
    const first = JSON.stringify(simulate(base));
    for (let i = 0; i < 100; i += 1) {
      expect(JSON.stringify(simulate({ ...base, rates: { ...base.rates }, fixes: [...base.fixes] }))).toBe(first);
    }
  });

  it('Math.random·Date.now·performance.now를 부르지 않는다', () => {
    const random = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    const perf = vi.spyOn(performance, 'now');

    simulate(simInputFor('FK-CD-OAT', PRODUCTS[0], ALL_FIXES));

    expect(random).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(perf).not.toHaveBeenCalled();
  });

  it('소스에 Math.random·new Date·performance.now가 없다 (sim.ts, rng.ts)', () => {
    for (const file of ['sim.ts', 'rng.ts']) {
      const source = readFileSync(path.resolve(__dirname, `../../src/engine/${file}`), 'utf8');
      const code = source
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join('\n');
      expect(code, file).not.toMatch(/Math\.random/);
      expect(code, file).not.toMatch(/new Date|Date\.now/);
      expect(code, file).not.toMatch(/performance\.now/);
    }
  });

  it('시드가 다르면 결과가 다르고, PRNG는 [0, 1) 값을 돌려준다', () => {
    const a = simulate(input({ seed: 1 }));
    const b = simulate(input({ seed: 2 }));
    expect(a.before.meanLossCents).not.toBe(b.before.meanLossCents);

    const random = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(mulberry32(7)()).toBe(mulberry32(7)());
  });

  it('시드는 SKU에서 결정적으로 나온다 (FNV-1a)', () => {
    expect(seedFromString('FK-CD-OAT')).toBe(seedFromString('FK-CD-OAT'));
    expect(seedFromString('FK-CD-OAT')).not.toBe(seedFromString('FK-SW-NV'));
    expect(simInputFor('FK-CD-OAT', PRODUCTS[0], []).seed).toBe(seedFromString('FK-CD-OAT'));
  });
});

describe('같은 난수: 처방을 켜도 분쟁이 새로 생기지 않는다', () => {
  it('4개 상품 × 처방 묶음 5종에서 미래별 분쟁 주문 집합이 Before의 부분집합', () => {
    const bundles: FixId[][] = [
      ['tracking_24h'],
      ['color_note'],
      ['kr_customs_notice'],
      ['settle_first'],
      ALL_FIXES,
    ];

    for (const product of PRODUCTS) {
      const simInput = simInputFor(product.sku, product, []);
      const before = simulatePass(simInput, []);

      for (const fixes of bundles) {
        const after = simulatePass(simInput, fixes);
        for (let future = 0; future < simInput.futures; future += 1) {
          const beforeOrders = new Set(before.disputeOrders[future]);
          for (const order of after.disputeOrders[future]) {
            expect(beforeOrders.has(order), `${product.sku} ${fixes.join('+')} future ${future} order ${order}`).toBe(true);
          }
          expect(after.disputes[future]).toBeLessThanOrEqual(before.disputes[future]);
        }
      }
    }
  });

  it('합의 우선 처방만 켜면 분쟁 수는 그대로다 (손실만 바뀐다)', () => {
    const simInput = simInputFor('FK-CD-OAT', PRODUCTS[0], []);
    const before = simulatePass(simInput, []);
    const settle = simulatePass(simInput, ['settle_first']);
    expect(settle.disputeOrders).toEqual(before.disputeOrders);
    expect(settle.lossCents).not.toEqual(before.lossCents);
  });
});

describe('폭포: 단계마다 평균 손실이 늘지 않는다', () => {
  it('4개 상품 모두 as_is → 처방 4개가 단조 비증가, 마지막 = after', () => {
    for (const product of PRODUCTS) {
      const result = simulate(simInputFor(product.sku, product, ALL_FIXES));

      expect(result.waterfall.map((step) => step.step)).toEqual(['as_is', ...ALL_FIXES]);
      expect(result.waterfall[0].meanLossCents).toBe(result.before.meanLossCents);
      expect(result.waterfall[result.waterfall.length - 1].meanLossCents).toBe(result.after.meanLossCents);

      for (let i = 1; i < result.waterfall.length; i += 1) {
        expect(
          result.waterfall[i].meanLossCents,
          `${product.sku}: ${result.waterfall[i - 1].step} → ${result.waterfall[i].step}`,
        ).toBeLessThanOrEqual(result.waterfall[i - 1].meanLossCents);
      }
    }
  });

  it('켠 처방만 폭포에 들어간다 (고정 순서)', () => {
    const result = simulate(simInputFor('FK-CD-OAT', PRODUCTS[0], ['settle_first', 'tracking_24h']));
    expect(result.waterfall.map((step) => step.step)).toEqual(['as_is', 'tracking_24h', 'settle_first']);
  });
});

describe('통계 건전성', () => {
  /** 재고 × Σ(확률 × 배수) = 평균 분쟁 수의 기댓값. */
  function expectedDisputes(simInput: SimInput, fixes: readonly FixId[]): number {
    let total = 0;
    for (const [subtype, rate] of Object.entries(simInput.rates) as [Subtype, number][]) {
      let multiplier = 1;
      for (const fix of fixes) multiplier *= CONFIG.fixes[fix].value.rateMultiplier[subtype] ?? 1;
      total += rate * multiplier;
    }
    return simInput.stock * total;
  }

  /** 분쟁 1건의 '지금 습관' 기대 손실 × 분쟁 수 (손 계산). */
  function expectedHabitLossCents(simInput: SimInput): number {
    const share = CONFIG.habitRefundShare.value;
    let total = 0;
    for (const [subtype, rate] of Object.entries(simInput.rates) as [Subtype, number][]) {
      const pWin = P.pWin[subtype];
      const fight = (1 - pWin) * (simInput.priceCents + P.feeCents) + P.timeCostCents;
      const refund = simInput.priceCents + P.timeCostCents;
      total += rate * (share * refund + (1 - share) * fight);
    }
    return simInput.stock * total;
  }

  it('가디건 Before 평균 분쟁 수가 120 × 3.6%와 ±0.4 안', () => {
    const simInput = simInputFor('FK-CD-OAT', PRODUCTS[0], ALL_FIXES);
    const result = simulate(simInput);
    expect(expectedDisputes(simInput, [])).toBeCloseTo(4.32, 2);
    expect(Math.abs(result.before.meanDisputes - expectedDisputes(simInput, []))).toBeLessThanOrEqual(0.4);
  });

  it('4개 상품 모두 Before·After 평균 분쟁 수가 손 계산과 ±0.4 안', () => {
    for (const product of PRODUCTS) {
      const simInput = simInputFor(product.sku, product, ALL_FIXES);
      const result = simulate(simInput);
      expect(Math.abs(result.before.meanDisputes - expectedDisputes(simInput, [])), product.sku).toBeLessThanOrEqual(0.4);
      expect(Math.abs(result.after.meanDisputes - expectedDisputes(simInput, ALL_FIXES)), product.sku).toBeLessThanOrEqual(0.4);
    }
  });

  it('4개 상품 모두 Before 평균 손실이 "분쟁 수 × 분쟁당 기대 손실(습관)"과 ±10% 안', () => {
    for (const product of PRODUCTS) {
      const simInput = simInputFor(product.sku, product, []);
      const hand = expectedHabitLossCents(simInput);
      const actual = simulate(simInput).before.meanLossCents;
      expect(Math.abs(actual - hand) / hand, `${product.sku}: ${actual}¢ vs ${hand.toFixed(0)}¢`).toBeLessThanOrEqual(0.1);
    }
  });

  it('P10 ≤ 평균 ≤ ... P90 순서이고 분위수가 미래 손실 안에 있는 값', () => {
    const simInput = simInputFor('FK-BN-SET', PRODUCTS[3], ALL_FIXES);
    const result = simulate(simInput);
    const losses = simulatePass(simInput, []).lossCents;
    expect(result.before.p10LossCents).toBeLessThanOrEqual(result.before.p90LossCents);
    expect(losses).toContain(result.before.p10LossCents);
    expect(losses).toContain(result.before.p90LossCents);
    // nearest-rank: P10은 50번째, P90은 450번째로 작은 값 (futures 500)
    const sorted = [...losses].sort((a, b) => a - b);
    expect(result.before.p10LossCents).toBe(sorted[49]);
    expect(result.before.p90LossCents).toBe(sorted[449]);
  });
});

describe('분쟁 1건의 실현 손실은 oracle.ts의 분기 값만 나온다', () => {
  /** 재고 1 + 확률 1 → 미래마다 분쟁 1건. 손실 값의 집합으로 대응 방식을 확인한다. */
  function lossSet(fixes: FixId[], rates: Partial<Record<Subtype, number>>): Set<number> {
    return new Set(simulatePass(input({ stock: 1, rates, fixes: [] }), fixes).lossCents);
  }

  const A = 4800;
  const win = P.timeCostCents;
  const lose = A + P.feeCents + P.timeCostCents;
  const refund = A + P.timeCostCents;

  it('지금 습관: 전액 환불 또는 다툼 승/패 세 값만 (B1)', () => {
    expect(lossSet([], { B1: 1 })).toEqual(new Set([refund, win, lose]));
  });

  it('합의 우선: B1은 제안(x·A + t)을 고른다 — 전액 환불은 나오지 않는다', () => {
    const offerCents = Math.round(P.offerRate * A) + P.timeCostCents;
    expect(lossSet(['settle_first'], { B1: 1 })).toEqual(new Set([offerCents, win, lose]));
  });

  it('합의 우선: 제안 대상이 아닌 A1은 환불이 가장 작아 환불을 고른다 (pWin 0.15)', () => {
    const fightLossCents = (1 - P.pWin.A1) * (A + P.feeCents) + P.timeCostCents;
    expect(fightLossCents).toBeGreaterThan(refund);
    expect(lossSet(['settle_first'], { A1: 1 })).toEqual(new Set([refund]));
  });

  it('합의 우선: 추적 처방으로 A1 승률이 오르면 다툼을 고른다', () => {
    const pWin = CONFIG.fixes.tracking_24h.value.pWinOverride?.A1 ?? 0;
    expect((1 - pWin) * (A + P.feeCents) + P.timeCostCents).toBeLessThan(refund);
    // 추적 처방은 A1 확률도 ×0.25로 낮추므로 분쟁이 없는 미래(손실 0)가 섞인다
    expect(lossSet(['settle_first', 'tracking_24h'], { A1: 1 })).toEqual(new Set([0, win, lose]));
  });

  it('추적 24시간 등록은 A1 승률을 올린다 (지금 습관으로 다퉈도 더 많이 이긴다)', () => {
    const plain = simulatePass(input({ stock: 1, rates: { A1: 1 } }), []);
    const tracked = simulatePass(input({ stock: 1, rates: { A1: 1 } }), ['tracking_24h']);
    const winShare = (pass: { lossCents: number[]; disputes: number[] }) =>
      pass.lossCents.filter((loss) => loss === win).length / pass.disputes.reduce((a, b) => a + b, 0);

    expect(P.pWin.A1).toBeLessThan(CONFIG.fixes.tracking_24h.value.pWinOverride?.A1 ?? 0);
    expect(winShare(tracked)).toBeGreaterThan(winShare(plain));
    expect(tracked.lossCents.reduce((a, b) => a + b, 0)).toBeLessThan(plain.lossCents.reduce((a, b) => a + b, 0));
  });
});

describe('요약·분포의 모양', () => {
  it('요약 값은 정수 센트, 평균 분쟁 수는 소수 둘째 자리까지', () => {
    for (const product of PRODUCTS) {
      const result = simulate(simInputFor(product.sku, product, ALL_FIXES));
      for (const summary of [result.before, result.after]) {
        expect(Number.isInteger(summary.meanLossCents), product.sku).toBe(true);
        expect(Number.isInteger(summary.p10LossCents), product.sku).toBe(true);
        expect(Number.isInteger(summary.p90LossCents), product.sku).toBe(true);
        expect(Number.isInteger(Math.round(summary.meanDisputes * 100)), product.sku).toBe(true);
        expect(summary.meanDisputes * 100).toBeCloseTo(Math.round(summary.meanDisputes * 100), 9);
      }
      for (const step of result.waterfall) expect(Number.isInteger(step.meanLossCents), product.sku).toBe(true);
    }
  });

  it('히스토그램: 열의 합 = futures, 구간이 빈틈없이 이어지고 Before·After가 같은 구간', () => {
    for (const product of PRODUCTS) {
      const simInput = simInputFor(product.sku, product, ALL_FIXES);
      const result = simulate(simInput);

      expect(result.histogram.reduce((total, bin) => total + bin.before, 0), product.sku).toBe(simInput.futures);
      expect(result.histogram.reduce((total, bin) => total + bin.after, 0), product.sku).toBe(simInput.futures);
      expect(result.histogram[0].fromCents).toBe(0);
      for (let i = 0; i < result.histogram.length; i += 1) {
        const bin = result.histogram[i];
        expect(Number.isInteger(bin.fromCents) && Number.isInteger(bin.toCents), product.sku).toBe(true);
        expect(bin.toCents).toBeGreaterThan(bin.fromCents);
        if (i > 0) expect(bin.fromCents).toBe(result.histogram[i - 1].toCents);
      }
    }
  });

  it('히스토그램이 Before·After의 가장 큰 손실까지 덮는다', () => {
    const simInput = simInputFor('FK-CT-GR', PRODUCTS[2], ALL_FIXES);
    const result = simulate(simInput);
    const maxLoss = Math.max(
      ...simulatePass(simInput, []).lossCents,
      ...simulatePass(simInput, ALL_FIXES).lossCents,
    );
    expect(result.histogram[result.histogram.length - 1].toCents).toBeGreaterThan(maxLoss);
  });
});

describe('경계', () => {
  it('재고 0이면 손실 0', () => {
    const result = simulate(input({ stock: 0, fixes: ALL_FIXES }));
    expect(result.before).toEqual({ meanLossCents: 0, p10LossCents: 0, p90LossCents: 0, meanDisputes: 0 });
    expect(result.after).toEqual(result.before);
    expect(result.waterfall.every((step) => step.meanLossCents === 0)).toBe(true);
    expect(result.histogram.reduce((total, bin) => total + bin.before, 0)).toBe(DEFAULT_FUTURES);
  });

  it('확률이 전부 0이면 분쟁이 없다', () => {
    const result = simulate(input({ rates: { A1: 0, B1: 0 }, fixes: ALL_FIXES }));
    expect(result.before.meanDisputes).toBe(0);
    expect(result.before.meanLossCents).toBe(0);
    expect(result.after).toEqual(result.before);
  });

  it('미래 0개면 요약이 0이고 히스토그램 열의 합도 0', () => {
    const result = simulate(input({ futures: 0 }));
    expect(result.before.meanLossCents).toBe(0);
    expect(result.before.p90LossCents).toBe(0);
    expect(result.histogram.reduce((total, bin) => total + bin.before, 0)).toBe(0);
  });

  it('처방이 없으면 before = after, 폭포는 as_is 한 단계', () => {
    const result = simulate(input({ fixes: [] }));
    expect(result.after).toEqual(result.before);
    expect(result.waterfall).toEqual([{ step: 'as_is', meanLossCents: result.before.meanLossCents }]);
    expect(result.histogram.every((bin) => bin.before === bin.after)).toBe(true);
  });

  it('처방 순서를 바꿔 넣거나 중복으로 넣어도 같은 결과', () => {
    const base = simulate(input({ fixes: ALL_FIXES }));
    const reversed = simulate(input({ fixes: [...ALL_FIXES].reverse() }));
    const duplicated = simulate(input({ fixes: [...ALL_FIXES, ...ALL_FIXES] }));
    expect(reversed).toEqual(base);
    expect(duplicated).toEqual(base);
  });

  it('가격 0이면 손실은 수수료·시간 비용만 (구간 폭은 1¢ 이상)', () => {
    const result = simulate(input({ priceCents: 0, rates: { B1: 1 }, stock: 1 }));
    expect(result.before.meanLossCents).toBeGreaterThan(0);
    expect(result.histogram[0].toCents).toBeGreaterThan(result.histogram[0].fromCents);
  });
});

describe('입력을 바꾸지 않는다', () => {
  it('깊게 얼린 입력으로 호출해도 예외가 없고, 결과를 고쳐도 다음 결과가 그대로다', () => {
    const simInput = Object.freeze({
      ...input({ fixes: ALL_FIXES }),
      rates: Object.freeze({ ...ratesFor('FK-CD-OAT') }),
      fixes: Object.freeze([...ALL_FIXES]),
    }) as SimInput;

    const first = simulate(simInput);
    const snapshot = JSON.stringify(first);
    first.before.meanLossCents = -1;
    first.histogram.length = 0;
    first.waterfall.push({ step: 'as_is', meanLossCents: -1 });

    expect(JSON.stringify(simulate(simInput))).toBe(snapshot);
    expect(simInput.fixes).toEqual(ALL_FIXES);
  });
});

describe('검증 (zod)', () => {
  it('재고·미래는 0 이상 정수여야 한다', () => {
    expect(() => simulate(input({ stock: -1 }))).toThrow(ZodError);
    expect(() => simulate(input({ stock: 1.5 }))).toThrow(ZodError);
    expect(() => simulate(input({ futures: -1 }))).toThrow(ZodError);
    expect(() => simulate(input({ futures: 1.5 }))).toThrow(ZodError);
    expect(() => simulate(input({ priceCents: -1 }))).toThrow(ZodError);
    expect(() => simulate(input({ priceCents: 10.5 }))).toThrow(ZodError);
  });

  it('확률은 0~1이어야 한다', () => {
    expect(() => simulate(input({ rates: { B1: 1.2 } }))).toThrow(ZodError);
    expect(() => simulate(input({ rates: { B1: -0.1 } }))).toThrow(ZodError);
    expect(() => simulate(input({ rates: { B1: Number.NaN } }))).toThrow(ZodError);
  });

  it('모르는 처방 ID와 모르는 세부 유형을 거부한다', () => {
    expect(() => simulate(input({ fixes: ['free_shipping'] as unknown as FixId[] }))).toThrow(ZodError);
    expect(() => simulate(input({ rates: { Z9: 0.1 } as unknown as Partial<Record<Subtype, number>> }))).toThrow(ZodError);
  });

  it('시드는 정수여야 한다', () => {
    expect(() => simulate(input({ seed: 1.5 }))).toThrow(ZodError);
  });

  it('제안률이 한도를 넘으면 설정 오류 (recommend·planMove와 같은 검증)', () => {
    const overLimit: ParamsConfig = {
      ...CONFIG,
      params: { ...CONFIG.params, offerRate: { ...CONFIG.params.offerRate, value: 0.25 } },
    };
    expect(() => simulate(input({ fixes: ['settle_first'] }), overLimit)).toThrow(ZodError);
  });

  it('처방 배수가 1을 넘으면 설정 오류 (같은 난수 전제가 깨진다)', () => {
    const badFix: ParamsConfig = {
      ...CONFIG,
      fixes: {
        ...CONFIG.fixes,
        color_note: { ...CONFIG.fixes.color_note, value: { rateMultiplier: { B1: 1.5 } } },
      },
    };
    expect(() => simulate(input({ fixes: ['color_note'] }), badFix)).toThrow(ZodError);
  });
});

describe('simInputFor: 상품 + config → SimInput', () => {
  it('가격·재고는 상품에서, 확률은 config productRates에서, 미래는 500개', () => {
    const simInput = simInputFor('FK-SW-NV', PRODUCTS[1], ['tracking_24h']);
    expect(simInput.priceCents).toBe(PRODUCTS[1].priceCents);
    expect(simInput.stock).toBe(PRODUCTS[1].stock);
    expect(simInput.rates).toEqual(ratesFor('FK-SW-NV'));
    expect(simInput.fixes).toEqual(['tracking_24h']);
    expect(simInput.futures).toBe(DEFAULT_FUTURES);
  });

  it('config에 없는 SKU는 예외', () => {
    expect(() => simInputFor('NOPE', { priceCents: 100, stock: 1 }, [])).toThrow(/productRates/);
  });

  it('4개 상품 모두 입력을 만들 수 있다 (화면과 합계가 같은 입력을 쓴다)', () => {
    for (const product of PRODUCTS) {
      const simInput = simInputFor(product.sku, product, ALL_FIXES);
      expect(simInput.sku).toBe(product.sku);
      expect(Object.keys(simInput.rates).length).toBeGreaterThan(0);
    }
  });
});

describe('성능 (원문 F4: 처방 토글 후 0.5초 재계산)', () => {
  it('가디건(재고 120, 미래 500, 처방 4개) 한 번이 50ms 이내', () => {
    const simInput = simInputFor('FK-CD-OAT', PRODUCTS[0], ALL_FIXES);
    simulate(simInput); // 워밍업 (JIT)

    const started = performance.now();
    simulate(simInput);
    const elapsed = performance.now() - started;

    expect(elapsed, `${elapsed.toFixed(1)}ms`).toBeLessThan(50);
  });
});
