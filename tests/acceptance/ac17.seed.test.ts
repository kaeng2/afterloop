/**
 * 인수 테스트 AC17: 시드 데이터 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD v2 6장(6-1·6-2·6-4·6-5), 4-1 / tasks/T001.md "주문 12건 배정" 표 /
 *   기획자 결정 2026-11-09: Q8(종결 손실은 f = 1500¢, 수수료는 질 때만 → 합 41300¢),
 *   Q10(국가 비율·이름 없는 구매자 X…는 현행 유지, SeedDispute.orderId·SeedOrder.date 추가)
 * 기준: SPEC v2.2. 작업: T007, T028
 *
 * seed/의 JSON 파일만 읽는다. seed/의 코드(data.ts, schemas.ts)는 import하지 않는다.
 * 수수료는 라이브 config가 아니라 고정 사본(params.fixture.json)의 feeCents를 쓴다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ParamsConfig, SeedBuyer, SeedDispute, SeedInquiry, SeedOrder, SeedProduct } from '@/types';

import paramsFixture from './params.fixture.json';

const ROOT = path.resolve(__dirname, '../..');
function load<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(ROOT, 'seed', name), 'utf8')) as T;
}

const products = load<SeedProduct[]>('products.json');
const buyers = load<SeedBuyer[]>('buyers.json');
const inquiries = load<SeedInquiry[]>('inquiries.json');
const disputes = load<SeedDispute[]>('disputes.json');
const orders = load<SeedOrder[]>('orders.json');

const FEE = (paramsFixture as unknown as ParamsConfig).params.feeCents.value; // 1500

/** 시연 시점 2026-11-10 (SPEC 7장) 기준 90일 창 */
const WINDOW_FROM = '2026-08-12';
const WINDOW_TO = '2026-11-10';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const price = (sku: string) => products.find((p) => p.sku === sku)!.priceCents;
const orderById = (id: string) => orders.find((o) => o.id === id);

// 기대값 출처: PRD v2 6-1 / 기획자 승인 2026-11-09
describe('AC17 상품 4개 (원문 6-1)', () => {
  it.each([
    ['FK-CD-OAT', 'Knit Cardigan, Oat', 4800, 120, 62, 4],
    ['FK-SW-NV', 'Wool Sweater, Navy', 7200, 80, 48, 1],
    ['FK-CT-GR', 'Cashmere Coat, Grey', 18900, 25, 33, 1],
    ['FK-BN-SET', 'Beanie + Scarf Set', 3500, 150, 71, 3],
  ] as const)('%s %s', (sku, itemName, priceCents, stock, orders90d, disputes90d) => {
    const p = products.find((x) => x.sku === sku);
    expect(p).toMatchObject({ sku, itemName, priceCents, stock, orders90d, disputes90d });
  });

  it('상품은 4개뿐이다', () => {
    expect(products).toHaveLength(4);
  });
});

// 기대값 출처: PRD v2 6-2 / 기획자 승인 2026-11-09
describe('AC17 구매자 12명 (원문 6-2)', () => {
  it.each([
    ['B01', 'KR', 'KO', true],
    ['B02', 'KR', 'KO', true],
    ['B03', 'JP', 'JA', true],
    ['B04', 'US', 'EN', true],
    ['B05', 'DE', 'DE', true],
    ['B06', 'KR', 'KO', false],
    ['B07', 'KR', 'KO', false],
    ['B08', 'US', 'EN', false],
    ['B09', 'US', 'EN', false],
    ['B10', 'US', 'EN', false],
    ['B11', 'US', 'EN', false],
    ['B12', 'GB', 'EN', false],
  ] as const)('%s: %s, %s, 샌드박스 %s', (id, country, language, sandbox) => {
    expect(buyers.find((b) => b.id === id)).toMatchObject({ id, country, language, sandbox });
  });

  it('구매자는 12명뿐이고 이름이 비어 있지 않다', () => {
    expect(buyers).toHaveLength(12);
    for (const b of buyers) expect(b.name.trim().length).toBeGreaterThan(0);
  });
});

// 기대값 출처: PRD v2 6-3 / 기획자 승인 2026-11-09
describe('AC17 문의 31건 (원문 6-3)', () => {
  it('31건, 모두 Demo data, 날짜는 90일 창 안', () => {
    expect(inquiries).toHaveLength(31);
    for (const q of inquiries) {
      expect(q.isDemo).toBe(true);
      expect(q.date).toMatch(ISO_DATE);
      expect(q.date >= WINDOW_FROM && q.date <= WINDOW_TO, q.date).toBe(true);
    }
  });

  it('서연의 대표 문의 원문이 그대로 있다', () => {
    const texts = inquiries.filter((q) => q.buyerId === 'B01').map((q) => q.original);
    expect(texts).toContain('벌써 3주째인데 아직도 안 왔어요. 연락 없으면 카드사에 이의제기할게요.');
  });

  // Q10: 이름 없는 구매자 X…는 현행 유지
  it('문의의 구매자는 12명 중 하나이거나, 주문이 있는 이름 없는 구매자(X…)다', () => {
    const named = new Set(buyers.map((b) => b.id));
    const withOrders = new Set(orders.map((o) => o.buyerId));
    for (const q of inquiries) {
      if (named.has(q.buyerId)) continue;
      expect(q.buyerId).toMatch(/^X\d{3}$/);
      expect(withOrders.has(q.buyerId), q.buyerId).toBe(true);
    }
  });
});

// 기대값 출처: PRD v2 4-1·6-1·6-5 + tasks/T001.md 표 + Q10 / 기획자 승인 2026-11-09
describe('AC17 주문 214건', () => {
  it('214건, ID가 겹치지 않는다', () => {
    expect(orders).toHaveLength(214);
    expect(new Set(orders.map((o) => o.id)).size).toBe(214);
  });

  it('상품별 62 · 48 · 33 · 71, 금액 = 상품 가격', () => {
    const count = (sku: string) => orders.filter((o) => o.sku === sku).length;
    expect(count('FK-CD-OAT')).toBe(62);
    expect(count('FK-SW-NV')).toBe(48);
    expect(count('FK-CT-GR')).toBe(33);
    expect(count('FK-BN-SET')).toBe(71);
    for (const o of orders) expect(o.amountCents, o.id).toBe(price(o.sku));
  });

  it('샌드박스 12건 + 시드 202건', () => {
    expect(orders.filter((o) => o.source === 'sandbox')).toHaveLength(12);
    expect(orders.filter((o) => o.source === 'seed')).toHaveLength(202);
  });

  // tasks/T001.md "주문 12건 배정" 표 (정본)
  it.each([
    ['O01', 'B01', 'FK-SW-NV', true],
    ['O02', 'B02', 'FK-CD-OAT', false],
    ['O03', 'B03', 'FK-CD-OAT', false],
    ['O04', 'B03', 'FK-SW-NV', false],
    ['O05', 'B03', 'FK-BN-SET', false],
    ['O06', 'B05', 'FK-BN-SET', true],
    ['O07', 'B05', 'FK-CD-OAT', false],
    ['O08', 'B04', 'FK-BN-SET', true],
    ['O09', 'B04', 'FK-BN-SET', true],
    ['O10', 'B04', 'FK-BN-SET', true],
    ['O11', 'B04', 'FK-BN-SET', true],
    ['O12', 'B04', 'FK-CD-OAT', true],
  ] as const)('샌드박스 %s: 구매자 %s, %s, 추적 %s', (id, buyerId, sku, tracked) => {
    expect(orderById(id)).toMatchObject({ id, buyerId, sku, tracked, source: 'sandbox' });
  });

  // Q10: 영국 구매자(B12) 4건을 뺀 210건을 US 45 · KR 25 · JP 15 · DE 15로 나눈 현행 값
  it('국가 분포 US 95 · KR 53 · JP 31 · DE 31 · GB 4', () => {
    const count = (c: string) => orders.filter((o) => o.country === c).length;
    expect({ US: count('US'), KR: count('KR'), JP: count('JP'), DE: count('DE'), GB: count('GB') }).toEqual({
      US: 95,
      KR: 53,
      JP: 31,
      DE: 31,
      GB: 4,
    });
  });

  it('추적 등록 약 60% (58~62%)', () => {
    const ratio = orders.filter((o) => o.tracked).length / orders.length;
    expect(ratio).toBeGreaterThanOrEqual(0.58);
    expect(ratio).toBeLessThanOrEqual(0.62);
  });

  // v2.2: SeedOrder.date
  it('모든 주문에 주문일(YYYY-MM-DD)이 있고 90일 창 안이다', () => {
    for (const o of orders) {
      expect(o.date, o.id).toMatch(ISO_DATE);
      expect(o.date >= WINDOW_FROM && o.date <= WINDOW_TO, `${o.id} ${o.date}`).toBe(true);
    }
  });

  it('서연의 주문 O01은 "3주째" 문의(11/9)보다 3주 이상 앞선다', () => {
    expect(orderById('O01')!.date <= '2026-10-19').toBe(true);
  });
});

// 기대값 출처: PRD v2 6-4 + Q8·Q10 / 기획자 승인 2026-11-09
// 종결 손실 (센트): 전액 환불 = 상품 가격, 패소 = 상품 가격 + f(1500), 승소 = 0. 수수료는 질 때만 (SPEC 5장)
describe('AC17 분쟁 9건 (원문 6-4)', () => {
  it.each([
    ['D1', 'B02', 'FK-CD-OAT', 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', 'B1', 'open', null, 'sandbox', 'O02'],
    ['D2', 'B01', 'FK-SW-NV', 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', 'A2', 'open', null, 'sandbox', 'O01'],
    ['D3', 'B04', 'FK-BN-SET', 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', 'F1', 'open', null, 'sandbox', 'O08'],
    ['D4', 'B08', 'FK-CD-OAT', 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', 'B1', 'closed', 4800, 'seed', null],
    ['D5', 'B07', 'FK-CD-OAT', 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', 'B1', 'closed', 6300, 'seed', null],
    ['D6', 'B09', 'FK-CD-OAT', 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', 'A1', 'closed', 6300, 'seed', null],
    ['D7', 'B04', 'FK-BN-SET', 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', 'F1', 'closed', 3500, 'seed', 'O09'],
    ['D8', 'B04', 'FK-BN-SET', 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', 'F1', 'closed', 0, 'seed', 'O10'],
    ['D9', 'B11', 'FK-CT-GR', 'UNAUTHORISED', 'E1', 'closed', 20400, 'seed', null],
  ] as const)('%s: %s, %s, %s → %s, %s, 손실 %s', (id, buyerId, sku, reason, subtype, status, lossCents, source, orderId) => {
    const d = disputes.find((x) => x.id === id);
    expect(d).toMatchObject({ id, buyerId, sku, reason, subtype, status, lossCents, source });
    if (orderId !== null) expect(d!.orderId).toBe(orderId);
  });

  it('분쟁은 9건뿐이고 종결 6건의 손실 합은 41300¢ ($413)', () => {
    expect(disputes).toHaveLength(9);
    const closed = disputes.filter((d) => d.status === 'closed');
    expect(closed).toHaveLength(6);
    expect(closed.reduce((s, d) => s + (d.lossCents ?? 0), 0)).toBe(41300);
  });

  it('종결 손실은 상품 가격과 고정 수수료에서 나온 값이다 (전액 환불 = 가격, 패소 = 가격 + f)', () => {
    expect(FEE).toBe(1500);
    const loss = (id: string) => disputes.find((d) => d.id === id)!.lossCents;
    expect(loss('D4')).toBe(price('FK-CD-OAT'));
    expect(loss('D5')).toBe(price('FK-CD-OAT') + FEE);
    expect(loss('D6')).toBe(price('FK-CD-OAT') + FEE);
    expect(loss('D7')).toBe(price('FK-BN-SET'));
    expect(loss('D8')).toBe(0);
    expect(loss('D9')).toBe(price('FK-CT-GR') + FEE);
  });

  // v2.2: SeedDispute.orderId
  it('모든 분쟁이 실제 주문을 가리키고, 그 주문의 구매자·상품이 분쟁과 같다', () => {
    for (const d of disputes) {
      const o = orderById(d.orderId);
      expect(o, `${d.id} → ${d.orderId}`).toBeDefined();
      expect(o!.buyerId, d.id).toBe(d.buyerId);
      expect(o!.sku, d.id).toBe(d.sku);
    }
    expect(new Set(disputes.map((d) => d.orderId)).size).toBe(9); // 한 주문에 분쟁 하나
  });

  it('미발송 주장(D6)의 주문은 추적 미등록, 배송 증빙으로 이긴 D8과 D3의 주문은 추적 등록', () => {
    expect(orderById(disputes.find((d) => d.id === 'D6')!.orderId)!.tracked).toBe(false);
    expect(orderById(disputes.find((d) => d.id === 'D8')!.orderId)!.tracked).toBe(true);
    expect(orderById(disputes.find((d) => d.id === 'D3')!.orderId)!.tracked).toBe(true);
  });

  it('상품별 90일 분쟁 수가 상품 표(6-1)와 맞는다: 가디건 4 · 스웨터 1 · 코트 1 · 비니 세트 3', () => {
    for (const p of products) expect(disputes.filter((d) => d.sku === p.sku).length, p.sku).toBe(p.disputes90d);
  });
});

// 기대값 출처: SPEC v2.2 10장 / 기획자 승인 2026-11-09
describe('AC17 개인정보', () => {
  const allText = ['products.json', 'buyers.json', 'inquiries.json', 'disputes.json', 'orders.json']
    .map((f) => readFileSync(path.join(ROOT, 'seed', f), 'utf8'))
    .join('\n');

  it('이메일 주소가 없다', () => {
    expect(allText).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });

  it('개인통관고유부호 값(P + 숫자 12자리)이 없다', () => {
    expect(allText).not.toMatch(/P\d{12}/);
  });
});
