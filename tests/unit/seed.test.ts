/**
 * T007·T028·T045 단위 테스트: 시드 데이터가 원문 6장과 기획자 결정과 같은지.
 *
 * 기대값 출처: PRD v2 (inbox/2026-11-09-prd-v2.md) 4-1, 6-1 ~ 6-5. SPEC v2.2 9-5·13장 Q8·Q10.
 * 배송사 이벤트(T045)는 SPEC v2.5 12장·2장 + 원문 S5 화면 예시.
 * 아래 표는 원문에서 따로 옮겨 적은 것이다. `seed/data.ts`를 가져다 쓰지 않고 값을 그대로 비교한다.
 * 국가는 원문의 한글 표기를 ISO 코드로 옮긴다 (한국 KR · 미국 US · 일본 JP · 독일 DE · 영국 GB).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import paramsConfig from '../../config/params.json';
import {
  FEE_CENTS,
  GENERATED_INQUIRY_TYPE_TOTALS,
  buildSeed,
  generatedInquirySpecs,
  type InquiryType,
} from '../../seed/data';
import { carrierEventsFor, seedCarrierEvents } from '../../seed/index';
import {
  ORDER_DATE_WINDOW,
  carrierEventProblems,
  disputeOrderProblems,
  seedBuyersSchema,
  seedCarrierEventsSchema,
  seedDisputesSchema,
  seedInquiriesSchema,
  seedOrdersSchema,
  seedProductsSchema,
} from '../../seed/schemas';

const SEED_DIR = path.resolve(__dirname, '../../seed');
const readSeed = (file: string): unknown => JSON.parse(readFileSync(path.join(SEED_DIR, file), 'utf8'));

const products = seedProductsSchema.parse(readSeed('products.json'));
const buyers = seedBuyersSchema.parse(readSeed('buyers.json'));
const inquiries = seedInquiriesSchema.parse(readSeed('inquiries.json'));
const disputes = seedDisputesSchema.parse(readSeed('disputes.json'));
const orders = seedOrdersSchema.parse(readSeed('orders.json'));
const carrierEvents = seedCarrierEventsSchema.parse(readSeed('carrier-events.json'));

const countBy = <T>(rows: readonly T[], key: (t: T) => string): Record<string, number> =>
  rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [key(r)]: (acc[key(r)] ?? 0) + 1 }), {});

// ───────────────────────────── 원문 표 (따로 옮겨 적음) ─────────────────────────────

/** 원문 6-1 */
const TABLE_6_1 = [
  { sku: 'FK-CD-OAT', itemName: 'Knit Cardigan, Oat', priceCents: 4800, stock: 120, orders90d: 62, disputes90d: 4, gaps: 3 },
  { sku: 'FK-SW-NV', itemName: 'Wool Sweater, Navy', priceCents: 7200, stock: 80, orders90d: 48, disputes90d: 1, gaps: 1 },
  { sku: 'FK-CT-GR', itemName: 'Cashmere Coat, Grey', priceCents: 18900, stock: 25, orders90d: 33, disputes90d: 1, gaps: 1 },
  { sku: 'FK-BN-SET', itemName: 'Beanie + Scarf Set', priceCents: 3500, stock: 150, orders90d: 71, disputes90d: 3, gaps: 0 },
];

/** 원문 6-2. orders·inquiries·disputes는 표의 '주문 / 문의 / 분쟁' 칸 */
const TABLE_6_2 = [
  { id: 'B01', name: '김서연 Seo-yeon Kim', country: 'KR', language: 'KO', sandbox: true, role: '대표 시나리오: 통관 보류 + "카드사에 이의제기" (SC4)', orders: 1, inquiries: 2, disputes: 1 },
  { id: 'B02', name: '박지호 Ji-ho Park', country: 'KR', language: 'KO', sandbox: true, role: '품질 분쟁(소매 올 풀림, 반품 기간 지남), 오토파일럿이 승인 대기로 올림 (SC5)', orders: 1, inquiries: 1, disputes: 1 },
  { id: 'B03', name: 'Yuki T.', country: 'JP', language: 'JA', sandbox: true, role: '사이즈 문의 → 오토파일럿 자동 답변 (SC5)', orders: 3, inquiries: 1, disputes: 0 },
  { id: 'B04', name: 'Mike Morgan', country: 'US', language: 'EN', sandbox: true, role: '반복 미수령 주장, 자동 처리 제외 (SC5)', orders: 5, inquiries: 4, disputes: 3 },
  { id: 'B05', name: 'Lena K.', country: 'DE', language: 'DE', sandbox: true, role: '환불 약속 4일 경과 (SC3, P1)', orders: 2, inquiries: 1, disputes: 0 },
  { id: 'B06', name: '정다은 Da-eun Jung', country: 'KR', language: 'KO', sandbox: false, role: '개인통관고유부호 문의 (통관 신호)', orders: 1, inquiries: 1, disputes: 0 },
  { id: 'B07', name: '이수민 Su-min Lee', country: 'KR', language: 'KO', sandbox: false, role: '색상 불만, 다투다 패소', orders: 1, inquiries: 0, disputes: 1 },
  { id: 'B08', name: 'Olivia R.', country: 'US', language: 'EN', sandbox: false, role: '색상 불만, 전액 환불', orders: 1, inquiries: 0, disputes: 1 },
  { id: 'B09', name: 'Mia L.', country: 'US', language: 'EN', sandbox: false, role: '추적번호 없이 미발송 주장', orders: 1, inquiries: 2, disputes: 1 },
  { id: 'B10', name: 'Chris D.', country: 'US', language: 'EN', sandbox: false, role: '코트 첫 구매, 배송지 변경 요청 (사기 신호)', orders: 1, inquiries: 1, disputes: 0 },
  { id: 'B11', name: 'Alex W.', country: 'US', language: 'EN', sandbox: false, role: '코트 도용 결제', orders: 1, inquiries: 0, disputes: 1 },
  { id: 'B12', name: 'Sophie B.', country: 'GB', language: 'EN', sandbox: false, role: '우수 고객 (비교용)', orders: 4, inquiries: 0, disputes: 0 },
];

/** 원문 6-3 표 8건. english가 "(원문)"인 줄은 original과 같은 문장 */
const TABLE_6_3 = [
  {
    date: '2026-11-09',
    buyer: '김서연',
    original:
      '벌써 3주째인데 아직도 안 왔어요. 배송 조회를 해 봐도 며칠째 같은 단계에서 멈춰 있고, 판매자에게 메시지를 보냈는데 답도 없어요. 선물하려고 산 스웨터라 더 기다리기 어렵습니다. 이번 주 안에 연락 없으면 카드사에 이의제기할게요.',
    english:
      "It's been 3 weeks and it still hasn't arrived. Tracking has been stuck at the same step for days, and I messaged the seller but got no reply. I bought this sweater as a gift, so I can't wait much longer. If I don't hear back this week, I'll file a dispute with my card company.",
    signal: 'A2',
  },
  {
    date: '2026-11-02',
    buyer: '김서연',
    original: '배송 조회가 일주일째 그대로예요. 확인해 주실 수 있나요?',
    english: "Tracking hasn't moved in a week. Could you check?",
    signal: 'A2',
  },
  {
    date: '2026-11-08',
    buyer: 'Chris D.',
    original: 'Can you ship to a different address than my billing address?',
    english: 'Can you ship to a different address than my billing address?',
    signal: 'E1',
  },
  {
    date: '2026-11-05',
    buyer: '정다은',
    original: '개인통관고유부호는 어디에 입력하면 되나요?',
    english: 'Where do I enter my personal customs clearance code?',
    signal: 'A2',
  },
  {
    date: '2026-10-29',
    buyer: 'Lena K.',
    original: 'Sie hatten mir eine Rückerstattung versprochen. Wann kommt sie?',
    english: 'You promised me a refund. When will it come?',
    signal: 'C1',
  },
  {
    date: '2026-11-09',
    buyer: '박지호',
    original: '산 지 5주 정도 됐는데 소매 쪽 올이 풀려서 입을 수가 없어요. 반품 기간이 지난 건 알지만 너무 속상해요. 방법이 없을까요?',
    english: "I bought it about 5 weeks ago and the sleeve is unraveling, so I can't wear it. I know the return window has passed, but I'm really upset. Is there anything you can do?",
    signal: 'B3',
  },
  {
    date: '2026-10-11',
    buyer: 'buyer_m***',
    original: "Package says delivered but I don't have it.",
    english: "Package says delivered but I don't have it.",
    signal: 'F1',
  },
  {
    date: '2026-09-15',
    buyer: 'Yuki T.',
    original: 'Mサイズの着丈は何cmですか？',
    english: 'What is the length of size M in cm?',
    signal: 'B2',
  },
];

/** 원문 6-3의 구매자 칸 → 6-2의 ID */
const BUYER_ID_BY_TABLE_NAME: Record<string, string> = {
  '김서연': 'B01',
  '박지호': 'B02',
  'Yuki T.': 'B03',
  'buyer_m***': 'B04',
  'Lena K.': 'B05',
  '정다은': 'B06',
  'Chris D.': 'B10',
};

const INR = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
const SNAD = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';

/**
 * 원문 6-4 + 기획자 결정 2026-11-09 Q8·Q10 (tasks/T028.md 표에서 따로 옮겨 적음).
 * 손실: 전액 환불 = 상품 가격, 패소 = 상품 가격 + f(1500¢), 승소 = 0. 수수료는 **질 때만** (SPEC 5장).
 * 합 41300¢ ($413). `orderId`가 null인 줄은 그 구매자의 같은 상품 시드 주문이면 된다 (ID를 못 박지 않음).
 * 사유 코드는 PayPal reason 값 (SNAD / INR / UNAUTHORISED).
 */
const TABLE_6_4 = [
  { id: 'D1', buyer: '박지호', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B3', status: 'open', lossCents: null, source: 'sandbox', outcome: null, orderId: 'O02' },
  { id: 'D2', buyer: '김서연', sku: 'FK-SW-NV', reason: INR, subtype: 'A2', status: 'open', lossCents: null, source: 'sandbox', outcome: null, orderId: 'O01' },
  { id: 'D3', buyer: 'buyer_m***', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'open', lossCents: null, source: 'sandbox', outcome: null, orderId: 'O08' },
  { id: 'D4', buyer: 'Olivia R.', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B1', status: 'closed', lossCents: 4800, source: 'seed', outcome: 'full_refund', orderId: null },
  { id: 'D5', buyer: '이수민', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B1', status: 'closed', lossCents: 6300, source: 'seed', outcome: 'lost', orderId: null },
  { id: 'D6', buyer: 'Mia L.', sku: 'FK-CD-OAT', reason: INR, subtype: 'A1', status: 'closed', lossCents: 6300, source: 'seed', outcome: 'lost', orderId: null },
  { id: 'D7', buyer: 'buyer_m***', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'closed', lossCents: 3500, source: 'seed', outcome: 'full_refund', orderId: 'O09' },
  { id: 'D8', buyer: 'buyer_m***', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'closed', lossCents: 0, source: 'seed', outcome: 'won', orderId: 'O10' },
  { id: 'D9', buyer: 'Alex W.', sku: 'FK-CT-GR', reason: 'UNAUTHORISED', subtype: 'E1', status: 'closed', lossCents: 20400, source: 'seed', outcome: 'lost', orderId: null },
];

/** 기획자 결정 Q8: 분쟁 수수료 f = $15 (config/params.json의 params.feeCents) */
const TABLE_FEE_CENTS = 1500;

/** 주문일 창 (기획자 결정 Q10: 시연 시점 2026-11-10 기준 90일, 양끝 포함) */
const TABLE_WINDOW = { from: '2026-08-12', to: '2026-11-10' };

/** 진행 중 분쟁이 걸린 주문은 최근 4주 안 (2026-10-14 ~ 2026-11-10) */
const RECENT_4W_FROM = '2026-10-14';

/** 원문 6-4의 구매자 칸 → ID (6-3에 없는 이름만 더함) */
const DISPUTE_BUYER_ID: Record<string, string> = {
  ...BUYER_ID_BY_TABLE_NAME,
  '이수민': 'B07',
  'Olivia R.': 'B08',
  'Mia L.': 'B09',
  'Alex W.': 'B11',
};

/** 원문 6-5 / SPEC 9-5: 샌드박스 구매자별 주문 수 (합 12) */
const SANDBOX_ORDERS_PER_BUYER: Record<string, number> = { B01: 1, B02: 1, B03: 3, B05: 2, B04: 5 };

/**
 * `tasks/T001.md` "주문 12건 배정" 표. **그 표가 샌드박스 12건의 정본이다.**
 * 여기 값은 표에서 따로 옮겨 적었다 (상품은 표의 이름·금액 그대로. SKU는 6-1의 상품명으로 찾는다).
 * 구매자 칸은 manifest의 `buyer` 키다 → 6-2 ID 대응은 아래 `BUYER_ID_BY_MANIFEST_KEY`.
 */
const TABLE_T001_SANDBOX_ORDERS = [
  { key: 'O01', buyer: 'seoyeon', itemName: 'Wool Sweater, Navy', priceCents: 7200, tracked: true, dispute: 'D2' },
  { key: 'O02', buyer: 'jiho', itemName: 'Knit Cardigan, Oat', priceCents: 4800, tracked: false, dispute: 'D1' },
  { key: 'O03', buyer: 'yuki', itemName: 'Knit Cardigan, Oat', priceCents: 4800, tracked: false, dispute: null },
  { key: 'O04', buyer: 'yuki', itemName: 'Wool Sweater, Navy', priceCents: 7200, tracked: false, dispute: null },
  { key: 'O05', buyer: 'yuki', itemName: 'Beanie + Scarf Set', priceCents: 3500, tracked: false, dispute: null },
  { key: 'O06', buyer: 'lena', itemName: 'Beanie + Scarf Set', priceCents: 3500, tracked: true, dispute: null },
  { key: 'O07', buyer: 'lena', itemName: 'Knit Cardigan, Oat', priceCents: 4800, tracked: false, dispute: null },
  { key: 'O08', buyer: 'buyer_m', itemName: 'Beanie + Scarf Set', priceCents: 3500, tracked: true, dispute: 'D3' },
  { key: 'O09', buyer: 'buyer_m', itemName: 'Beanie + Scarf Set', priceCents: 3500, tracked: true, dispute: null },
  { key: 'O10', buyer: 'buyer_m', itemName: 'Beanie + Scarf Set', priceCents: 3500, tracked: true, dispute: null },
  { key: 'O11', buyer: 'buyer_m', itemName: 'Beanie + Scarf Set', priceCents: 3500, tracked: true, dispute: null },
  { key: 'O12', buyer: 'buyer_m', itemName: 'Knit Cardigan, Oat', priceCents: 4800, tracked: true, dispute: null },
];

/** `tasks/T001.md`: "추적: 등록 7 (O01, O06, O08~O12) · 미등록 5 (O02~O05, O07)" */
const TABLE_T001_TRACKED_KEYS = ['O01', 'O06', 'O08', 'O09', 'O10', 'O11', 'O12'];
const TABLE_T001_UNTRACKED_KEYS = ['O02', 'O03', 'O04', 'O05', 'O07'];

/** T001 표·manifest의 구매자 키 → 원문 6-2 ID (T001 "개인 계정 5개": 서연·지호·Yuki·Lena·buyer_m) */
const BUYER_ID_BY_MANIFEST_KEY: Record<string, string> = {
  seoyeon: 'B01',
  jiho: 'B02',
  yuki: 'B03',
  lena: 'B05',
  buyer_m: 'B04',
};

// ───────────────────────────── 건수 ─────────────────────────────

describe('T007 건수 (원문 4-1, 6-1 ~ 6-4)', () => {
  it('상품 4 · 구매자 12 · 문의 31 · 분쟁 9 · 주문 214', () => {
    expect(products).toHaveLength(4);
    expect(buyers).toHaveLength(12);
    expect(inquiries).toHaveLength(31);
    expect(disputes).toHaveLength(9);
    expect(orders).toHaveLength(214);
  });

  it('주문이 상품별로 62 · 48 · 33 · 71이고 products.orders90d와 같다', () => {
    const bySku = countBy(orders, (o) => o.sku);
    expect(bySku).toEqual({ 'FK-CD-OAT': 62, 'FK-SW-NV': 48, 'FK-CT-GR': 33, 'FK-BN-SET': 71 });
    for (const p of products) expect(bySku[p.sku], p.sku).toBe(p.orders90d);
  });

  it('분쟁이 상품별 products.disputes90d와 같고 합이 9다', () => {
    const bySku = countBy(disputes, (d) => d.sku);
    for (const p of products) expect(bySku[p.sku] ?? 0, p.sku).toBe(p.disputes90d);
    expect(products.reduce((s, p) => s + p.disputes90d, 0)).toBe(9);
  });

  it('ID가 겹치지 않는다', () => {
    for (const rows of [products.map((p) => p.sku), buyers.map((b) => b.id), disputes.map((d) => d.id), orders.map((o) => o.id)]) {
      expect(new Set(rows).size, rows.slice(0, 3).join(',')).toBe(rows.length);
    }
  });
});

// ───────────────────────────── 6-1 상품 ─────────────────────────────

describe('T007 상품 (원문 6-1)', () => {
  it('SKU 순서·상품명·가격·재고·주문·분쟁이 표와 같다', () => {
    expect(products.map((p) => p.sku)).toEqual(TABLE_6_1.map((r) => r.sku));
    for (const row of TABLE_6_1) {
      const p = products.find((x) => x.sku === row.sku)!;
      expect(p.itemName, row.sku).toBe(row.itemName);
      expect(p.priceCents, row.sku).toBe(row.priceCents);
      expect(p.stock, row.sku).toBe(row.stock);
      expect(p.orders90d, row.sku).toBe(row.orders90d);
      expect(p.disputes90d, row.sku).toBe(row.disputes90d);
    }
  });

  it('체크리스트 빈 항목 개수가 표와 같다 (비니 세트는 "없음" → 0)', () => {
    for (const row of TABLE_6_1) {
      const p = products.find((x) => x.sku === row.sku)!;
      expect(p.checklistGaps.length, row.sku).toBe(row.gaps);
    }
  });

  it('상품명이 AC13의 purchase_units[].items[].name 목록과 같다', () => {
    expect(products.map((p) => p.itemName)).toEqual([
      'Knit Cardigan, Oat',
      'Wool Sweater, Navy',
      'Cashmere Coat, Grey',
      'Beanie + Scarf Set',
    ]);
  });
});

// ───────────────────────────── 6-2 구매자 ─────────────────────────────

describe('T007 구매자 (원문 6-2)', () => {
  it('ID·이름·국가·언어·샌드박스 여부·역할이 한 글자도 다르지 않다', () => {
    expect(buyers.map((b) => b.id)).toEqual(TABLE_6_2.map((r) => r.id));
    for (const row of TABLE_6_2) {
      const b = buyers.find((x) => x.id === row.id)!;
      expect(b.name, row.id).toBe(row.name);
      expect(b.country, row.id).toBe(row.country);
      expect(b.language, row.id).toBe(row.language);
      expect(b.sandbox, row.id).toBe(row.sandbox);
      expect(b.role, row.id).toBe(row.role);
    }
  });

  it('샌드박스 구매자는 B01~B05 다섯 명이다 (SPEC 9-5)', () => {
    expect(buyers.filter((b) => b.sandbox).map((b) => b.id)).toEqual(['B01', 'B02', 'B03', 'B04', 'B05']);
  });

  it('구매자별 주문·문의·분쟁 건수가 표와 같다', () => {
    for (const row of TABLE_6_2) {
      expect(orders.filter((o) => o.buyerId === row.id), `${row.id} 주문`).toHaveLength(row.orders);
      expect(inquiries.filter((q) => q.buyerId === row.id), `${row.id} 문의`).toHaveLength(row.inquiries);
      expect(disputes.filter((d) => d.buyerId === row.id), `${row.id} 분쟁`).toHaveLength(row.disputes);
    }
  });
});

// ───────────────────────────── 6-3 문의 ─────────────────────────────

describe('T007 문의 (원문 6-3)', () => {
  const tableRows = inquiries.slice(0, 8);
  const generated = inquiries.slice(8);

  it('앞 8건이 표의 날짜·구매자·원문·영어·해석과 한 글자도 다르지 않다', () => {
    expect(tableRows).toHaveLength(TABLE_6_3.length);
    TABLE_6_3.forEach((row, i) => {
      const q = tableRows[i];
      expect(q.date, `${i}`).toBe(row.date);
      expect(q.buyerId, `${i}`).toBe(BUYER_ID_BY_TABLE_NAME[row.buyer]);
      expect(q.original, `${i}`).toBe(row.original);
      expect(q.english, `${i}`).toBe(row.english);
      expect(q.signal, `${i}`).toBe(row.signal);
    });
  });

  it('모든 문의에 isDemo: true가 붙는다', () => {
    for (const q of inquiries) expect(q.isDemo).toBe(true);
  });

  it('자동 생성이 23건이고 유형 분포가 배송 12 · 사이즈 6 · 색상 3 · 기타 2다', () => {
    expect(generated).toHaveLength(23);
    expect(generatedInquirySpecs).toHaveLength(23);
    expect(countBy(generatedInquirySpecs, (s) => s.type)).toEqual(GENERATED_INQUIRY_TYPE_TOTALS);
    expect(GENERATED_INQUIRY_TYPE_TOTALS).toEqual({ shipping: 12, size: 6, color: 3, other: 2 } satisfies Record<InquiryType, number>);
  });

  it('자동 생성 23건의 원문·영어가 템플릿 그대로다 (LLM 생성 없음)', () => {
    generated.forEach((q, i) => {
      expect(q.original, `${i}`).toBe(generatedInquirySpecs[i].original);
      expect(q.english, `${i}`).toBe(generatedInquirySpecs[i].english);
    });
  });

  it('자동 생성 한국어가 절반 ±1건이다', () => {
    const ko = generated.filter((q) => /[가-힣]/.test(q.original)).length;
    expect(Math.abs(ko - generated.length / 2)).toBeLessThanOrEqual(1);
    expect(ko).toBe(generatedInquirySpecs.filter((s) => s.lang === 'KO').length);
  });

  it('날짜가 90일 안이고 시연 시점(2026-11-10)보다 과거다', () => {
    for (const q of inquiries) {
      expect(q.date >= '2026-08-13', q.date).toBe(true);
      expect(q.date < '2026-11-10', q.date).toBe(true);
    }
  });

  it('구매자가 모두 실존 행이다 (B01~B12 또는 주문이 있는 자동 생성 구매자)', () => {
    const buyerIds = new Set(buyers.map((b) => b.id));
    const orderBuyers = new Set(orders.map((o) => o.buyerId));
    for (const q of inquiries) expect(buyerIds.has(q.buyerId) || orderBuyers.has(q.buyerId), q.buyerId).toBe(true);
  });

  it('한국어 자동 문의는 한국 주문 구매자에게 붙는다', () => {
    const countryOf = new Map(orders.map((o) => [o.buyerId, o.country]));
    for (const q of generated.filter((g) => /[가-힣]/.test(g.original) && !g.buyerId.startsWith('B'))) {
      expect(countryOf.get(q.buyerId), q.buyerId).toBe('KR');
    }
  });
});

// ───────────────────────────── 6-4 분쟁 ─────────────────────────────

describe('T007·T028 분쟁 (원문 6-4, SPEC 13장 Q8·Q10)', () => {
  const priceOf = (sku: string) => products.find((p) => p.sku === sku)!.priceCents;
  const orderById = (id: string) => orders.find((o) => o.id === id);

  it('9건의 ID·구매자·상품·사유·세부 유형·상태·손실·출처가 표와 같다', () => {
    expect(disputes.map((d) => d.id)).toEqual(TABLE_6_4.map((r) => r.id));
    for (const row of TABLE_6_4) {
      const d = disputes.find((x) => x.id === row.id)!;
      expect(d.buyerId, row.id).toBe(DISPUTE_BUYER_ID[row.buyer]);
      expect(d.sku, row.id).toBe(row.sku);
      expect(d.reason, row.id).toBe(row.reason);
      expect(d.subtype, row.id).toBe(row.subtype);
      expect(d.status, row.id).toBe(row.status);
      expect(d.lossCents, row.id).toBe(row.lossCents);
      expect(d.source, row.id).toBe(row.source);
    }
  });

  it('종결 6건 손실 합이 41300¢ ($413)다 (Q8: 수수료는 질 때만)', () => {
    const closed = disputes.filter((d) => d.status === 'closed');
    expect(closed).toHaveLength(6);
    expect(closed.reduce((s, d) => s + (d.lossCents ?? 0), 0)).toBe(41300);
  });

  it('종결 손실이 결과 종류 · 상품 가격 · f에서 나온 값이다 (전액 환불 = 가격, 패소 = 가격 + f, 승소 = 0)', () => {
    for (const row of TABLE_6_4.filter((r) => r.status === 'closed')) {
      const expected =
        row.outcome === 'won' ? 0 : priceOf(row.sku) + (row.outcome === 'lost' ? TABLE_FEE_CENTS : 0);
      expect(expected, `${row.id} 표 값`).toBe(row.lossCents);
      expect(disputes.find((d) => d.id === row.id)!.lossCents, row.id).toBe(expected);
    }
  });

  it('f를 config/params.json에서 읽는다 (코드에 적지 않는다)', () => {
    expect(FEE_CENTS).toBe(paramsConfig.params.feeCents.value);
    expect(FEE_CENTS).toBe(TABLE_FEE_CENTS);
  });

  it('종결 손실은 세 가지 값 중 하나뿐이다 (대응 시간 비용 t는 더하지 않는다 — 원문 6-4 식에 없다)', () => {
    for (const d of disputes.filter((x) => x.status === 'closed')) {
      expect([0, priceOf(d.sku), priceOf(d.sku) + TABLE_FEE_CENTS], d.id).toContain(d.lossCents);
    }
  });

  it('진행 중 3건은 D1~D3이고 lossCents가 null, source가 sandbox다', () => {
    const open = disputes.filter((d) => d.status === 'open');
    expect(open.map((d) => d.id)).toEqual(['D1', 'D2', 'D3']);
    for (const d of open) {
      expect(d.lossCents, d.id).toBeNull();
      expect(d.source, d.id).toBe('sandbox');
    }
  });

  it('분쟁마다 같은 구매자·같은 상품의 주문이 있다', () => {
    for (const d of disputes) {
      const matching = orders.filter((o) => o.buyerId === d.buyerId && o.sku === d.sku);
      expect(matching.length, `${d.id} (${d.buyerId} ${d.sku})`).toBeGreaterThanOrEqual(
        disputes.filter((x) => x.buyerId === d.buyerId && x.sku === d.sku).length,
      );
    }
  });

  // ── v2.2 (Q10): orderId ──

  it('못 박은 주문 연결이 표와 같다 (D1 O02 · D2 O01 · D3 O08 · D7 O09 · D8 O10)', () => {
    for (const row of TABLE_6_4.filter((r) => r.orderId)) {
      expect(disputes.find((d) => d.id === row.id)!.orderId, row.id).toBe(row.orderId);
    }
  });

  it('ID를 못 박지 않은 4건(D4·D5·D6·D9)도 그 구매자의 같은 상품 시드 주문을 가리킨다', () => {
    for (const row of TABLE_6_4.filter((r) => !r.orderId)) {
      const o = orderById(disputes.find((d) => d.id === row.id)!.orderId)!;
      expect(o, row.id).toBeDefined();
      expect(o.buyerId, row.id).toBe(DISPUTE_BUYER_ID[row.buyer]);
      expect(o.sku, row.id).toBe(row.sku);
      expect(o.source, row.id).toBe('seed');
    }
  });

  it('참조 무결성 검사(schemas.disputeOrderProblems)가 깨끗하다 — 한 주문에 분쟁 하나', () => {
    expect(disputeOrderProblems(disputes, orders)).toEqual([]);
    expect(new Set(disputes.map((d) => d.orderId)).size).toBe(9);
  });

  it('미발송 주장(D6)의 주문은 추적 미등록, 배송 증빙으로 이긴 D8·반복 주장 D3의 주문은 추적 등록', () => {
    const trackedOf = (id: string) => orderById(disputes.find((d) => d.id === id)!.orderId)!.tracked;
    expect(trackedOf('D6')).toBe(false);
    expect(trackedOf('D8')).toBe(true);
    expect(trackedOf('D3')).toBe(true);
  });

  it('buyer_m의 주장 순서가 D7(O09) → D8(O10) → D3(O08)이다 (세 번째 주장이 진행 중 건)', () => {
    const dateOf = (id: string) => orderById(disputes.find((d) => d.id === id)!.orderId)!.date;
    expect(dateOf('D7') < dateOf('D8')).toBe(true);
    expect(dateOf('D8') < dateOf('D3')).toBe(true);
  });

  it('종결 분쟁의 주문은 창의 앞쪽·중간, 진행 중 분쟁의 주문은 최근 4주 안이다', () => {
    const middle = '2026-09-26'; // 창(91일)의 가운데
    for (const d of disputes.filter((x) => x.status === 'closed')) {
      expect(orderById(d.orderId)!.date <= middle, `${d.id} ${orderById(d.orderId)!.date}`).toBe(true);
    }
    for (const d of disputes.filter((x) => x.status === 'open')) {
      expect(orderById(d.orderId)!.date >= RECENT_4W_FROM, `${d.id} ${orderById(d.orderId)!.date}`).toBe(true);
    }
  });
});

// ───────────────────────────── 6-5 / 4-1 주문 ─────────────────────────────

describe('T007 주문 (원문 6-5, 4-1)', () => {
  const sandbox = orders.filter((o) => o.source === 'sandbox');
  const seeded = orders.filter((o) => o.source === 'seed');

  it('샌드박스 12건 · 시드 202건', () => {
    expect(sandbox).toHaveLength(12);
    expect(seeded).toHaveLength(202);
  });

  it('샌드박스 주문 ID가 manifest 키 O01~O12와 같다', () => {
    expect(sandbox.map((o) => o.id)).toEqual(Array.from({ length: 12 }, (_, i) => `O${String(i + 1).padStart(2, '0')}`));
  });

  it('샌드박스 주문이 구매자별 서연 1 · 지호 1 · Yuki 3 · Lena 2 · buyer_m 5다', () => {
    expect(countBy(sandbox, (o) => o.buyerId)).toEqual(SANDBOX_ORDERS_PER_BUYER);
  });

  it('샌드박스 추적번호가 7건 등록 · 5건 미등록이다', () => {
    expect(sandbox.filter((o) => o.tracked)).toHaveLength(7);
    expect(sandbox.filter((o) => !o.tracked)).toHaveLength(5);
  });

  it('국가 비율이 US 45 · KR 25 · JP 15 · DE 15에 맞는다 (영국 B12 4건 제외)', () => {
    const byCountry = countBy(orders, (o) => o.country);
    expect(byCountry).toEqual({ US: 95, KR: 53, JP: 31, DE: 31, GB: 4 });
    const target: Record<string, number> = { US: 0.45, KR: 0.25, JP: 0.15, DE: 0.15 };
    for (const [c, share] of Object.entries(target)) {
      expect(Math.abs(byCountry[c] / orders.length - share), c).toBeLessThan(0.01);
    }
    expect(byCountry.GB, 'GB는 6-2의 Sophie B. 주문 4건만').toBe(4);
  });

  it('추적 등록이 약 60%다', () => {
    const tracked = orders.filter((o) => o.tracked).length;
    expect(tracked).toBe(128);
    expect(Math.abs(tracked / orders.length - 0.6)).toBeLessThan(0.01);
  });

  it('금액이 상품 가격 그대로다 (주문에서 계산하지 않는다)', () => {
    const priceOf = new Map(products.map((p) => [p.sku, p.priceCents]));
    for (const o of orders) expect(o.amountCents, o.id).toBe(priceOf.get(o.sku));
  });

  // ── v2.2 (Q10): date ──

  it('모든 주문에 주문일(YYYY-MM-DD)이 있고 90일 창 안이다', () => {
    expect(ORDER_DATE_WINDOW).toEqual(TABLE_WINDOW);
    for (const o of orders) {
      expect(o.date, o.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(o.date >= TABLE_WINDOW.from && o.date <= TABLE_WINDOW.to, `${o.id} ${o.date}`).toBe(true);
    }
  });

  it('서연의 O01은 11/09 문의 "벌써 3주째"보다 3주 이상 앞이다', () => {
    expect(orders.find((o) => o.id === 'O01')!.date <= '2026-10-19').toBe(true);
  });

  it('"배송이 안 온다"는 문의를 한 구매자는 그 문의보다 먼저 주문했다', () => {
    const DELIVERY = ['A1', 'A2', 'A3', 'A4', 'F1'];
    const complaints = inquiries.filter((q) => q.signal && DELIVERY.includes(q.signal));
    expect(complaints.length).toBeGreaterThan(0);
    for (const q of complaints) {
      const own = orders.filter((o) => o.buyerId === q.buyerId).map((o) => o.date).sort();
      expect(own.length, q.buyerId).toBeGreaterThan(0);
      expect(own[0] < q.date, `${q.buyerId} 첫 주문 ${own[0]} vs 문의 ${q.date}`).toBe(true);
    }
  });

  it('주문일이 창 전체에 퍼져 있다 (한 날짜에 몰리지 않는다)', () => {
    const byDay = countBy(orders, (o) => o.date);
    expect(Object.keys(byDay).length).toBeGreaterThanOrEqual(80); // 창 91일 중 80일 이상에 주문이 있다
    expect(Math.max(...Object.values(byDay))).toBeLessThanOrEqual(8);
    const byMonth = countBy(orders, (o) => o.date.slice(0, 7));
    expect(Object.keys(byMonth).sort()).toEqual(['2026-08', '2026-09', '2026-10', '2026-11']);
  });

  it('주문일에 Date.now·Math.random을 쓰지 않는다 (buildSeed를 다시 불러도 같다)', () => {
    expect(buildSeed().orders.map((o) => o.date)).toEqual(orders.map((o) => o.date));
  });

  it('원문 6-2 구매자(B01~B12)의 주문 22건 외에는 자동 생성 구매자다', () => {
    const named = orders.filter((o) => /^B\d{2}$/.test(o.buyerId));
    expect(named).toHaveLength(22);
    for (const o of orders) expect(/^(B\d{2}|X\d{3})$/.test(o.buyerId), o.buyerId).toBe(true);
  });
});

// ─────────────── 샌드박스 12건 = tasks/T001.md "주문 12건 배정" 표 (정본) ───────────────

describe('T007 샌드박스 12건이 tasks/T001.md 배정 표와 행마다 같다', () => {
  const sandbox = orders.filter((o) => o.source === 'sandbox');
  const skuByItemName = new Map(products.map((p) => [p.itemName, p.sku]));

  it('12행의 키·구매자·상품·금액·추적 여부가 표와 같다', () => {
    expect(sandbox.map((o) => o.id)).toEqual(TABLE_T001_SANDBOX_ORDERS.map((r) => r.key));
    for (const row of TABLE_T001_SANDBOX_ORDERS) {
      const o = sandbox.find((x) => x.id === row.key)!;
      expect(o, row.key).toBeDefined();
      expect(o.buyerId, `${row.key} 구매자`).toBe(BUYER_ID_BY_MANIFEST_KEY[row.buyer]);
      expect(o.sku, `${row.key} 상품`).toBe(skuByItemName.get(row.itemName));
      expect(o.amountCents, `${row.key} 금액`).toBe(row.priceCents);
      expect(o.tracked, `${row.key} 추적`).toBe(row.tracked);
    }
  });

  it('추적 등록 7건(O01, O06, O08~O12) · 미등록 5건(O02~O05, O07)이 표의 목록과 같다', () => {
    expect(sandbox.filter((o) => o.tracked).map((o) => o.id)).toEqual(TABLE_T001_TRACKED_KEYS);
    expect(sandbox.filter((o) => !o.tracked).map((o) => o.id)).toEqual(TABLE_T001_UNTRACKED_KEYS);
    expect(TABLE_T001_TRACKED_KEYS).toHaveLength(7);
    expect(TABLE_T001_UNTRACKED_KEYS).toHaveLength(5);
  });

  it('표의 분쟁 칸(O01 D2 · O02 D1 · O08 D3)이 그 주문의 구매자·상품과 맞고, 분쟁의 orderId가 그 주문이다', () => {
    for (const row of TABLE_T001_SANDBOX_ORDERS.filter((r) => r.dispute)) {
      const d = disputes.find((x) => x.id === row.dispute)!;
      expect(d, row.dispute!).toBeDefined();
      expect(d.buyerId, `${row.dispute} 구매자`).toBe(BUYER_ID_BY_MANIFEST_KEY[row.buyer]);
      expect(d.sku, `${row.dispute} 상품`).toBe(skuByItemName.get(row.itemName));
      expect(d.source, `${row.dispute} 출처`).toBe('sandbox');
      expect(d.orderId, `${row.dispute} 주문`).toBe(row.key); // v2.2 (Q10)
    }
  });
});

// ─────────────── 자동 생성 문의가 그 구매자의 주문과 어긋나지 않는다 ───────────────

describe('T007 자동 생성 문의와 주문의 맞물림', () => {
  const ordersOf = (buyerId: string) => orders.filter((o) => o.buyerId === buyerId);

  it('상품을 가리키는 문장은 그 상품을 주문한 구매자에게 붙는다', () => {
    generatedInquirySpecs.forEach((spec, i) => {
      if (!spec.requireSkus) return;
      const q = inquiries[8 + i];
      const skus = ordersOf(q.buyerId).map((o) => o.sku);
      expect(skus.some((s) => spec.requireSkus!.includes(s)), `${q.buyerId} "${spec.original}"`).toBe(true);
    });
  });

  it('추적 상태를 가리키는 문장은 그 상태의 주문을 가진 구매자에게 붙는다', () => {
    generatedInquirySpecs.forEach((spec, i) => {
      if (spec.requireTracked === undefined) return;
      const q = inquiries[8 + i];
      const states = ordersOf(q.buyerId).map((o) => o.tracked);
      expect(states.includes(spec.requireTracked), `${q.buyerId} "${spec.original}"`).toBe(true);
    });
  });
});

// ─────────────── 시연용 배송사 데이터 (T045, SPEC v2.5 12장 / 원문 S5) ───────────────

/**
 * SPEC v2.5 12장 + `tasks/T045.md`에서 따로 옮겨 적은 표. 통관 보류 글은 원문 S5 화면 예시
 * 그대로다 (가운데 줄표는 en dash `–`).
 */
const TABLE_CARRIER_EVENTS = [
  { orderId: 'O01', date: '2026-10-18', status: 'shipped' },
  { orderId: 'O01', date: '2026-10-21', status: 'in_transit' },
  { orderId: 'O01', date: '2026-10-30', status: 'customs_hold', text: 'Customs hold – recipient customs ID missing' },
  { orderId: 'O08', date: '2026-10-17', status: 'shipped' },
  { orderId: 'O08', date: '2026-10-19', status: 'in_transit' },
  { orderId: 'O08', date: '2026-10-21', status: 'out_for_delivery' },
  { orderId: 'O08', date: '2026-10-22', status: 'delivered' },
];

/** buyer_m의 10/28 문의 "Same problem again - the package is not here." (`data.ts`의 자동 생성 문의) */
const BUYER_M_THIRD_COMPLAINT = '2026-10-28';

describe('T045 시연용 배송사 데이터 (SPEC v2.5 12장)', () => {
  const orderDate = (id: string) => orders.find((o) => o.id === id)!.date;

  it('스키마를 통과하고, 주문 2건(O01·O08)의 이벤트 7건뿐이며 전부 isDemo: true다', () => {
    expect(carrierEvents).toHaveLength(TABLE_CARRIER_EVENTS.length);
    expect(seedCarrierEventsSchema.parse(carrierEvents)).toEqual(carrierEvents);
    expect([...new Set(carrierEvents.map((e) => e.orderId))]).toEqual(['O01', 'O08']);
    for (const e of carrierEvents) expect(e.isDemo, `${e.orderId} ${e.status}`).toBe(true);
  });

  it('주문·날짜·상태가 표와 같고, 통관 보류 글이 원문 S5 예시 그대로다', () => {
    TABLE_CARRIER_EVENTS.forEach((row, i) => {
      const e = carrierEvents[i];
      expect(e.orderId, `${i}`).toBe(row.orderId);
      expect(e.date, `${i}`).toBe(row.date);
      expect(e.status, `${i}`).toBe(row.status);
      if (row.text) expect(e.text, `${i}`).toBe(row.text);
    });
  });

  it('주문 맞물림 검사(schemas.carrierEventProblems)가 깨끗하다 — 주문일 이후, 날짜 오름차순', () => {
    expect(carrierEventProblems(carrierEvents, orders)).toEqual([]);
    for (const e of carrierEvents) {
      expect(e.date >= orderDate(e.orderId), `${e.orderId} ${e.date}`).toBe(true);
      expect(e.date <= ORDER_DATE_WINDOW.to, `${e.orderId} ${e.date}`).toBe(true);
    }
  });

  it('O01(서연)은 발송 → 이동 중 → 통관 보류(10/30)로 끝나고 배송 완료가 없다', () => {
    expect(carrierEventsFor('O01').map((e) => e.status)).toEqual(['shipped', 'in_transit', 'customs_hold']);
    const shipped = carrierEventsFor('O01')[0];
    expect(shipped.date >= '2026-10-17' && shipped.date <= '2026-10-19', shipped.date).toBe(true);
  });

  it('O01의 글을 ClassifyInput.trackingEvents로 넣으면 "customs hold"가 들어 있다 (규칙 4 → A2)', () => {
    // 분류기(ai 레인)를 import하지 않는다. SPEC 4장 규칙 4의 입력이 되는 글자만 확인한다
    const trackingEvents: string[] = carrierEventsFor('O01').map((e) => e.text);
    expect(trackingEvents.some((t) => t.toLowerCase().includes('customs hold'))).toBe(true);
  });

  it('O08(buyer_m)은 배송 완료로 끝나고, 그 날짜가 10/28 "같은 문제가 또" 문의보다 앞이다', () => {
    const events = carrierEventsFor('O08');
    expect(events[0].status).toBe('shipped');
    expect(events[events.length - 1].status).toBe('delivered');
    expect(events.map((e) => e.status)).not.toContain('customs_hold');
    expect(events[events.length - 1].date < BUYER_M_THIRD_COMPLAINT).toBe(true);
    // 그 문의가 실제로 시드에 있고 날짜가 같다 (F1 반복 주장 흐름의 근거)
    expect(inquiries.some((q) => q.date === BUYER_M_THIRD_COMPLAINT && q.buyerId === 'B04')).toBe(true);
  });

  it('이벤트가 없는 주문은 빈 배열이다 (없는 주문 ID도 빈 배열)', () => {
    expect(carrierEventsFor('O02')).toEqual([]);
    expect(carrierEventsFor('SO001')).toEqual([]);
    expect(carrierEventsFor('없는-주문')).toEqual([]);
  });

  it('seedCarrierEvents가 파일 그대로다 (index.ts는 옮기기만 한다)', () => {
    expect(seedCarrierEvents).toEqual(carrierEvents);
  });
});

// ───────────────────────────── 결정성·개인정보 ─────────────────────────────

describe('T007 결정성과 개인정보', () => {
  it('buildSeed()를 두 번 불러도 같은 값이다', () => {
    expect(JSON.stringify(buildSeed())).toBe(JSON.stringify(buildSeed()));
  });

  it('파일이 buildSeed() 결과와 같다 (npm run seed를 다시 돌려도 같은 파일)', () => {
    const built = buildSeed();
    expect(JSON.parse(JSON.stringify(built.products))).toEqual(products);
    expect(JSON.parse(JSON.stringify(built.buyers))).toEqual(buyers);
    expect(JSON.parse(JSON.stringify(built.inquiries))).toEqual(inquiries);
    expect(JSON.parse(JSON.stringify(built.disputes))).toEqual(disputes);
    expect(JSON.parse(JSON.stringify(built.orders))).toEqual(orders);
    expect(JSON.parse(JSON.stringify(built.carrierEvents))).toEqual(carrierEvents);
  });

  it('이메일·주소·개인통관고유부호 값이 없다', () => {
    const text = ['products', 'buyers', 'inquiries', 'disputes', 'orders', 'carrier-events']
      .map((f) => readFileSync(path.join(SEED_DIR, `${f}.json`), 'utf8'))
      .join('\n');
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // 이메일
    expect(text).not.toMatch(/\bP\d{12}\b/); // 개인통관고유부호 형식
    expect(text).not.toMatch(/\b\d{9,}\b/); // 긴 숫자 (주문번호·전화·통관번호 등)
  });
});
