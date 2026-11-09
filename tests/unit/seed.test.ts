/**
 * T007 단위 테스트: 시드 데이터가 원문 6장과 같은지.
 *
 * 기대값 출처: PRD v2 (inbox/2026-11-09-prd-v2.md) 4-1, 6-1 ~ 6-5. SPEC v2.1 9-5·13장 Q8.
 * 아래 표는 원문에서 따로 옮겨 적은 것이다. `seed/data.ts`를 가져다 쓰지 않고 값을 그대로 비교한다.
 * 국가는 원문의 한글 표기를 ISO 코드로 옮긴다 (한국 KR · 미국 US · 일본 JP · 독일 DE · 영국 GB).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GENERATED_INQUIRY_TYPE_TOTALS,
  buildSeed,
  generatedInquirySpecs,
  type InquiryType,
} from '../../seed/data';
import {
  seedBuyersSchema,
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
  { id: 'B02', name: '박지호 Ji-ho Park', country: 'KR', language: 'KO', sandbox: true, role: '색상 분쟁, 오토파일럿이 승인 대기로 올림 (SC5)', orders: 1, inquiries: 1, disputes: 1 },
  { id: 'B03', name: 'Yuki T.', country: 'JP', language: 'JA', sandbox: true, role: '사이즈 문의 → 오토파일럿 자동 답변 (SC5)', orders: 3, inquiries: 1, disputes: 0 },
  { id: 'B04', name: 'buyer_m***', country: 'US', language: 'EN', sandbox: true, role: '반복 미수령 주장, 자동 처리 제외 (SC5)', orders: 5, inquiries: 4, disputes: 3 },
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
    original: '벌써 3주째인데 아직도 안 왔어요. 연락 없으면 카드사에 이의제기할게요.',
    english: "It's been 3 weeks and it still hasn't arrived. If I don't hear back, I'll file a dispute with my card company.",
    signal: 'A2',
  },
  {
    date: '2026-11-02',
    buyer: '김서연',
    original: '배송 조회가 일주일째 그대로예요. 확인 부탁드려요.',
    english: "Tracking hasn't changed in a week. Could you check?",
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
    date: '2026-10-20',
    buyer: '박지호',
    original: '사진이랑 색이 너무 달라요. 베이지가 아니라 회색이에요.',
    english: "The color is very different from the photo. It's grey, not beige.",
    signal: 'B1',
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
 * 원문 6-4. 손실은 원문 값 그대로 (SPEC 13장 Q8: "원문 그대로, 합 40800¢").
 * 사유 코드는 PayPal reason 값 (SNAD / INR / UNAUTHORISED).
 */
const TABLE_6_4 = [
  { id: 'D1', buyer: '박지호', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B1', status: 'open', lossCents: null, source: 'sandbox' },
  { id: 'D2', buyer: '김서연', sku: 'FK-SW-NV', reason: INR, subtype: 'A2', status: 'open', lossCents: null, source: 'sandbox' },
  { id: 'D3', buyer: 'buyer_m***', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'open', lossCents: null, source: 'sandbox' },
  { id: 'D4', buyer: 'Olivia R.', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B1', status: 'closed', lossCents: 5600, source: 'seed' },
  { id: 'D5', buyer: '이수민', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B1', status: 'closed', lossCents: 5600, source: 'seed' },
  { id: 'D6', buyer: 'Mia L.', sku: 'FK-CD-OAT', reason: INR, subtype: 'A1', status: 'closed', lossCents: 5600, source: 'seed' },
  { id: 'D7', buyer: 'buyer_m***', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'closed', lossCents: 4300, source: 'seed' },
  { id: 'D8', buyer: 'buyer_m***', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'closed', lossCents: 0, source: 'seed' },
  { id: 'D9', buyer: 'Alex W.', sku: 'FK-CT-GR', reason: 'UNAUTHORISED', subtype: 'E1', status: 'closed', lossCents: 19700, source: 'seed' },
];

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

describe('T007 분쟁 (원문 6-4, SPEC 13장 Q8)', () => {
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

  it('종결 6건 손실 합이 40800¢ ($408)다', () => {
    const closed = disputes.filter((d) => d.status === 'closed');
    expect(closed).toHaveLength(6);
    expect(closed.reduce((s, d) => s + (d.lossCents ?? 0), 0)).toBe(40800);
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

  it('표의 분쟁 칸(O01 D2 · O02 D1 · O08 D3)이 그 주문의 구매자·상품과 맞는다', () => {
    for (const row of TABLE_T001_SANDBOX_ORDERS.filter((r) => r.dispute)) {
      const d = disputes.find((x) => x.id === row.dispute)!;
      expect(d, row.dispute!).toBeDefined();
      expect(d.buyerId, `${row.dispute} 구매자`).toBe(BUYER_ID_BY_MANIFEST_KEY[row.buyer]);
      expect(d.sku, `${row.dispute} 상품`).toBe(skuByItemName.get(row.itemName));
      expect(d.source, `${row.dispute} 출처`).toBe('sandbox');
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
  });

  it('이메일·주소·개인통관고유부호 값이 없다', () => {
    const text = ['products', 'buyers', 'inquiries', 'disputes', 'orders']
      .map((f) => readFileSync(path.join(SEED_DIR, `${f}.json`), 'utf8'))
      .join('\n');
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // 이메일
    expect(text).not.toMatch(/\bP\d{12}\b/); // 개인통관고유부호 형식
    expect(text).not.toMatch(/\b\d{9,}\b/); // 긴 숫자 (주문번호·전화·통관번호 등)
  });
});
