/** T085 새 상품 등록 전 점검 엔진 단위 시험 (SPEC v2.12 8-3장). */
import { describe, expect, it } from 'vitest';

import {
  LISTING_MAX_UNITS,
  checkListing,
  createListingSim,
  detectListingFeatures,
  isPeak,
  listingFixGains,
  listingModelFromConfig,
  listingParamsFromConfig,
  listingRates,
} from '@/engine/listing';
import type { ListingCheckInput, ListingFeatures } from '@/types';

const model = listingModelFromConfig();
const NONE: ListingFeatures = { size: false, color: false, ship: false, customs: false, bf: false, ret: false };

const BASE: ListingCheckInput = {
  fields: { desc: 'Soft wool blend.', size: 'S / M / L', ship: 'Ships worldwide.', ret: '' },
  priceCents: 8900,
  units: 50,
  saleFrom: '2026-11-20',
  saleTo: '2026-12-02',
};

describe('listingParamsFromConfig', () => {
  it('params.json의 feeCents·timeCostCents·habitRefundShare를 쓴다', () => {
    expect(listingParamsFromConfig()).toEqual({ feeCents: 1500, timeCostCents: 200, refundShare: 0.5 });
  });

  it('params를 안 주면 기본값과 같은 결과', () => {
    expect(checkListing(BASE)).toEqual(checkListing(BASE, listingParamsFromConfig()));
  });
});

describe('성수기 경계', () => {
  const { from, to } = model.peak;
  it('겹침이 하루뿐이어도 성수기', () => {
    expect(isPeak('2026-11-01', from, model)).toBe(true);
    expect(isPeak(to, '2026-12-31', model)).toBe(true);
  });
  it('하루 전에 끝나거나 하루 뒤에 시작하면 성수기 아님', () => {
    expect(isPeak('2026-11-01', '2026-11-23', model)).toBe(false);
    expect(isPeak('2026-12-02', '2026-12-31', model)).toBe(false);
  });
  it('checkListing.peak에 반영된다', () => {
    expect(checkListing({ ...BASE, saleFrom: '2026-11-01', saleTo: from }).peak).toBe(true);
    expect(checkListing({ ...BASE, saleFrom: '2026-11-01', saleTo: '2026-11-23' }).peak).toBe(false);
  });
});

describe('유형별 확률·승률', () => {
  it('성수기 배수와 고칠 점 배수를 곱한다', () => {
    const { q } = listingRates({ ...NONE, ship: true, bf: true }, true, model);
    expect(q.A1).toBeCloseTo(0.006 * 1.25 * 0.55 * 0.8, 12);
    expect(q.A2).toBeCloseTo(0.007 * 1.4 * 0.85, 12);
    expect(q.B1).toBe(0.008);
  });
  it('승률은 고칠 점이 참이면 pWinWithFix 값', () => {
    expect(listingRates(NONE, false, model).pWin.B2).toBe(0.35);
    expect(listingRates({ ...NONE, size: true }, false, model).pWin.B2).toBe(0.5);
    expect(listingRates({ ...NONE, ship: true }, false, model).pWin.A1).toBe(0.6);
  });
});

describe('입력칸 판정', () => {
  it('규칙의 입력칸에서만 찾는다 (치수를 설명칸에 써도 size는 거짓)', () => {
    const f = detectListingFeatures({ ...BASE.fields, desc: 'chest 50 cm' }, model);
    expect(f.size).toBe(false);
    expect(detectListingFeatures({ ...BASE.fields, size: 'chest 50 cm' }, model).size).toBe(true);
  });
  it('한국어 문구도 걸린다', () => {
    const f = detectListingFeatures({ desc: '자연광 촬영', size: '가슴 50', ship: '영업일 3~5일, 통관번호 필요', ret: '교환 가능' }, model);
    expect(f).toEqual({ size: true, color: true, ship: true, customs: true, bf: false, ret: true });
  });
});

describe('단계 계산기', () => {
  it('step(0)은 아무것도 안 하고, step(1)은 1회, 남은 것보다 큰 n은 끝까지', () => {
    const sim = createListingSim(BASE);
    expect(sim.step(0)).toBe(0);
    expect(sim.done()).toBe(false);
    expect(sim.step(1)).toBe(1);
    expect(() => sim.result()).toThrow();
    expect(sim.step(501)).toBe(500);
    expect(sim.done()).toBe(true);
    expect(sim.step(10)).toBe(500);
    expect(sim.result()).toEqual(checkListing(BASE));
  });
  it('progressChunkRuns씩 나눠 돌려도 같다', () => {
    const sim = createListingSim(BASE);
    while (!sim.done()) sim.step(model.progressChunkRuns);
    expect(sim.result()).toEqual(checkListing(BASE));
  });
});

describe('고칠 점 효과', () => {
  it('고칠 점을 더하면 배수가 붙은 유형만 줄고, 같은 입력이면 같은 결과', () => {
    const a = checkListing(BASE);
    const b = checkListing({ ...BASE, fields: { ...BASE.fields, size: 'chest 50 cm' } });
    expect(b.features.size).toBe(true);
    expect(b.byType.B2.expectedDisputes).toBeLessThan(a.byType.B2.expectedDisputes);
    expect(checkListing(BASE)).toEqual(a);
  });
  it('listingFixGains: 성수기면 bf도 숫자, 이미 참이면 0', () => {
    const g = listingFixGains(BASE);
    expect(typeof g.bf).toBe('number');
    const g2 = listingFixGains({ ...BASE, fields: { ...BASE.fields, ret: 'Returns accepted.' } });
    expect(g2.ret).toBe(0);
  });
});

describe('입력 검사', () => {
  it('잘못된 입력은 예외', () => {
    expect(() => checkListing({ ...BASE, priceCents: 0 })).toThrow();
    expect(() => checkListing({ ...BASE, priceCents: 89.5 })).toThrow();
    expect(() => checkListing({ ...BASE, units: 0 })).toThrow();
    expect(() => checkListing({ ...BASE, units: LISTING_MAX_UNITS + 1 })).toThrow();
    expect(() => checkListing({ ...BASE, saleFrom: '2026/11/20' })).toThrow();
    expect(() => checkListing(BASE, { feeCents: 1500, timeCostCents: 200, refundShare: 2 })).toThrow();
  });
});
