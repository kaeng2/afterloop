/**
 * AC34 새 상품 등록 전 점검 (SPEC v2.12 8-3장, 사람 결정 2026-11-11 21:40 — 계약·인수 테스트 추가 승인)
 *
 * 기대값 출처:
 * - 모델: config/listing-model.json (기획 시안 scene3/Main.dc.html의 L_BASE·L_PEAK·lRates·lWin·LRX를 옮긴 가정)
 * - 수수료 f = 1500¢, 시간 비용 t = 200¢, 환불 몫 0.5 (params.fixture.json — 시안의 $8·$2 대신, 사람 결정)
 * - 고정 숫자는 컨트롤 타워가 SPEC 8-3장 절차(시드 4242 + 판매 수량, 실수 난수, 횟수당 수량 × 유형 × 3개)를
 *   따로 계산한 값이다 (2026-11-11). 시안 화면 숫자(Float32 난수·$8)와는 조금 다르다.
 *
 * 엔진 모듈(src/engine/listing.ts)이 아직 없으면 엔진 시험은 건너뛴다 (T083이 만든다).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CheckListingFn,
  CreateListingSimFn,
  DetectListingFeaturesFn,
  ListingCheckInput,
  ListingFixGainsFn,
  ListingFixKey,
  ListingModelConfig,
  ListingParams,
  ParamsConfig,
} from '@/types';
import paramsFixture from './params.fixture.json';

const ROOT = path.resolve(__dirname, '../..');
const model = JSON.parse(readFileSync(path.join(ROOT, 'config/listing-model.json'), 'utf8')) as ListingModelConfig;
const PF = paramsFixture as unknown as ParamsConfig;
const LP: ListingParams = {
  feeCents: PF.params.feeCents.value,
  timeCostCents: PF.params.timeCostCents.value,
  refundShare: PF.habitRefundShare.value,
};

type ListingModule = {
  detectListingFeatures: DetectListingFeaturesFn;
  checkListing: CheckListingFn;
  createListingSim: CreateListingSimFn;
  listingFixGains: ListingFixGainsFn;
};
// 모듈은 파일 맨 위에서 읽는다 (skipIf가 모으는 시점에 판단 — AC33과 같은 방식)
const LISTING = '@/engine/listing';
const lm = (await import(/* @vite-ignore */ LISTING).catch(() => null)) as ListingModule | null;
const skip = () => lm === null;

/** 시안 기본 입력 (영어, Ribbed Wool Crewneck, Ivory — $89 × 200, 11/20~12/02) */
const BASE: ListingCheckInput = {
  fields: {
    desc: 'Chunky ribbed knit in a soft wool blend. Relaxed drop-shoulder fit. Also in Oatmeal and Charcoal.',
    size: 'S / M / L',
    ship: 'Ships worldwide.',
    ret: '',
  },
  priceCents: 8900,
  units: 200,
  saleFrom: '2026-11-20',
  saleTo: '2026-12-02',
};

/** 고칠 점 하나씩 (판매자가 쓰거나 AI 문구를 넣은 글 — 숫자는 자리표시자) */
const ADD: Record<ListingFixKey, [keyof ListingCheckInput['fields'], string]> = {
  size: ['size', 'Measurements: chest [__] cm, length [__] cm.'],
  color: ['desc', 'Color note: Ivory is a warm off-white.'],
  ship: ['ship', 'Ships with tracking.'],
  customs: ['ship', 'Please enter your customs ID at checkout.'],
  bf: ['ship', 'Black Friday week: allow extra days.'],
  ret: ['ret', 'Returns accepted.'],
};
const KEYS = Object.keys(ADD) as ListingFixKey[];

function withFix(input: ListingCheckInput, ...keys: ListingFixKey[]): ListingCheckInput {
  const next = structuredClone(input);
  for (const k of keys) {
    const [field, text] = ADD[k];
    next.fields[field] = `${next.fields[field]} ${text}`.trim();
  }
  return next;
}

describe('AC34 설정 (데이터만)', () => {
  it('source가 "가정(기획 시안)"이고 수수료·시간 비용을 따로 두지 않는다 (params.json을 쓴다)', () => {
    expect(model.source).toBe('가정(기획 시안)');
    expect(model.types).toEqual(['A1', 'A2', 'B1', 'B2', 'X']);
    expect(model.runs).toBe(500);
    expect(JSON.stringify(model)).not.toMatch(/"fee|"timeCost|L_FEE|L_T"/);
  });

  it('입력칸 판정 정규식 6개가 모두 읽히고, 각 고칠 점 글에 걸린다', () => {
    for (const k of KEYS) {
      const rule = model.rules[k];
      expect(rule.field).toBe(ADD[k][0]);
      expect(new RegExp(rule.pattern, rule.flags).test(ADD[k][1])).toBe(true);
    }
  });
});

describe('AC34 새 상품 점검 (엔진)', () => {
  it.skipIf(skip())('입력칸 판정: 시안 기본 입력은 6개 모두 거짓, 고칠 점 글을 더하면 그것만 참', () => {
    expect(Object.values(lm!.detectListingFeatures(BASE.fields, model)).some(Boolean)).toBe(false);
    for (const k of KEYS) {
      const f = lm!.detectListingFeatures(withFix(BASE, k).fields, model);
      expect(f[k]).toBe(true);
      expect(KEYS.filter((o) => o !== k && f[o])).toEqual([]);
    }
  });

  it.skipIf(skip())('시안 기본 입력 → 고정 숫자 (성수기, 분쟁 8.994건, 주문당 4.497%, 평균 손실 77030¢, P10 47200¢, P90 114000¢)', () => {
    const r = lm!.checkListing(BASE, LP, model);
    expect(r.peak).toBe(true);
    expect(r.runs).toBe(500);
    expect(r.units).toBe(200);
    expect(r.expectedDisputes).toBeCloseTo(8.994, 9);
    expect(r.pPerOrder).toBeCloseTo(0.04497, 9);
    expect(r.meanLossCents).toBe(77030);
    expect(r.p10LossCents).toBe(47200);
    expect(r.p90LossCents).toBe(114000);
    expect(r.byType.A1.expectedDisputes).toBeCloseTo(1.52, 9);
    expect(r.byType.A2.expectedDisputes).toBeCloseTo(1.896, 9);
    expect(r.byType.B1.expectedDisputes).toBeCloseTo(1.622, 9);
    expect(r.byType.B2.expectedDisputes).toBeCloseTo(3.194, 9);
    expect(r.byType.X.expectedDisputes).toBeCloseTo(0.762, 9);
    expect(r.byType.B2.meanLossCents).toBe(26424);
    expect(r.byType.B2.pPerOrder).toBeCloseTo(3.194 / 200, 9);
  });

  it.skipIf(skip())('고칠 점을 하나씩 더하면 주문당 분쟁 확률이 내려간다 (같은 난수)', () => {
    const base = lm!.checkListing(BASE, LP, model).pPerOrder;
    const expected: Record<ListingFixKey, number> = {
      size: 0.03557, color: 0.04074, ship: 0.04167, customs: 0.04011, bf: 0.04214, ret: 0.04287,
    };
    for (const k of KEYS) {
      const p = lm!.checkListing(withFix(BASE, k), LP, model).pPerOrder;
      expect(p).toBeLessThan(base);
      expect(p).toBeCloseTo(expected[k], 9);
    }
  });

  it.skipIf(skip())('6개 모두 고치면 주문당 2.069%, 평균 손실 32671¢', () => {
    const r = lm!.checkListing(withFix(BASE, ...KEYS), LP, model);
    expect(Object.values(r.features).every(Boolean)).toBe(true);
    expect(r.pPerOrder).toBeCloseTo(0.02069, 9);
    expect(r.meanLossCents).toBe(32671);
  });

  it.skipIf(skip())('같은 입력이면 같은 결과, 단계 계산기를 나눠 돌려도 한 번에 돌린 것과 같다', () => {
    const a = lm!.checkListing(BASE, LP, model);
    expect(lm!.checkListing(BASE, LP, model)).toEqual(a);
    const sim = lm!.createListingSim(BASE, LP, model);
    expect(sim.total).toBe(500);
    expect(sim.done()).toBe(false);
    expect(() => sim.result()).toThrow();
    let doneRuns = 0;
    const seen: number[] = [];
    while (!sim.done()) {
      doneRuns = sim.step(37);
      seen.push(doneRuns);
    }
    expect(doneRuns).toBe(500);
    expect(seen.every((n, i) => i === 0 || n > seen[i - 1])).toBe(true);
    expect(sim.result()).toEqual(a);
  });

  it.skipIf(skip())('성수기 밖(1월)이면 성수기 배수가 빠져 확률이 내려간다', () => {
    const off = lm!.checkListing({ ...BASE, saleFrom: '2027-01-10', saleTo: '2027-01-20' }, LP, model);
    expect(off.peak).toBe(false);
    expect(off.pPerOrder).toBeCloseTo(0.04096, 9);
  });

  it.skipIf(skip())('수수료는 params에서 온다: f를 바꾸면 손실이 바뀌고 분쟁 수는 그대로', () => {
    const a = lm!.checkListing(BASE, LP, model);
    const b = lm!.checkListing(BASE, { ...LP, feeCents: 800 }, model);
    expect(b.expectedDisputes).toBe(a.expectedDisputes);
    expect(b.meanLossCents).toBeLessThan(a.meanLossCents);
  });

  it.skipIf(skip())('고칠 점별 줄어드는 양: 기본 입력에서 모두 양수, 이미 고친 것은 0, 성수기 밖 bf는 null', () => {
    const g = lm!.listingFixGains(BASE, LP, model);
    for (const k of KEYS) expect(g[k]).toBeGreaterThan(0);
    expect(g.size).toBeCloseTo(0.04497 - 0.03557, 9);
    expect(lm!.listingFixGains(withFix(BASE, 'size'), LP, model).size).toBe(0);
    expect(lm!.listingFixGains({ ...BASE, saleFrom: '2027-01-10', saleTo: '2027-01-20' }, LP, model).bf).toBeNull();
  });
});
