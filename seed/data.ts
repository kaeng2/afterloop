/**
 * 데모 시드 데이터 (T007, SPEC v2.1 / 원문 6장)
 *
 * 규칙
 * - 결정적이다. `Math.random`을 쓰지 않고 고정 시드 난수(mulberry32)와 고정 할당량만 쓴다.
 *   같은 코드면 항상 같은 파일이 나온다.
 * - 숫자 계산(기대 손실, 확률, 제안 비율)은 하지 않는다. 금액은 원문 6-1의 가격을 옮기기만 한다.
 * - 이름은 모두 가상이다. 이메일·주소·개인통관고유부호 값은 넣지 않는다.
 * - 원문 6-2·6-3·6-4의 이름·국가·문장은 한 글자도 바꾸지 않는다.
 */
import type { SeedBuyer, SeedDispute, SeedInquiry, SeedOrder, SeedProduct, Subtype } from '@/types';

// ───────────────────────────── 공통 도구 ─────────────────────────────

/** 고정 시드 난수. 순서를 섞는 데만 쓴다 (건수는 할당량으로 미리 못 박는다) */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 제자리 섞기 없이 새 배열을 돌려주는 Fisher–Yates */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `{ 값: 개수 }` 할당량을 값 배열로 펼친다 */
function fromQuota<T extends string>(quota: Record<T, number>): T[] {
  return (Object.entries(quota) as [T, number][]).flatMap(([value, n]) => Array.from({ length: n }, () => value));
}

/** 시연 시점 2026-11-10 09:00 PT (원문 4-2) 기준으로 n일 전 날짜 */
const DEMO_TODAY = '2026-11-10';
function daysBefore(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) - n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

// ───────────────────────────── 6-1. 상품 ─────────────────────────────

/**
 * 원문 6-1 그대로. `checklistGaps`는 화면이 영어라서 영어 라벨로 넣는다
 * (원문 라벨 대응은 `seed/README.md`).
 */
export const products: SeedProduct[] = [
  {
    sku: 'FK-CD-OAT',
    itemName: 'Knit Cardigan, Oat',
    priceCents: 4800,
    stock: 120,
    orders90d: 62,
    disputes90d: 4,
    checklistGaps: ['Natural-light photos', 'Color disclosure', 'Size chart in cm'],
  },
  {
    sku: 'FK-SW-NV',
    itemName: 'Wool Sweater, Navy',
    priceCents: 7200,
    stock: 80,
    orders90d: 48,
    disputes90d: 1,
    checklistGaps: ['Korean customs notice'],
  },
  {
    sku: 'FK-CT-GR',
    itemName: 'Cashmere Coat, Grey',
    priceCents: 18900,
    stock: 25,
    orders90d: 33,
    disputes90d: 1,
    checklistGaps: ['Signature on delivery'],
  },
  {
    sku: 'FK-BN-SET',
    itemName: 'Beanie + Scarf Set',
    priceCents: 3500,
    stock: 150,
    orders90d: 71,
    disputes90d: 3,
    checklistGaps: [],
  },
];

const priceOf = (sku: string): number => {
  const p = products.find((x) => x.sku === sku);
  if (!p) throw new Error(`알 수 없는 SKU: ${sku}`);
  return p.priceCents;
};

// ───────────────────────────── 6-2. 구매자 12명 ─────────────────────────────

/** 원문 6-2 그대로. 국가는 ISO 코드 (한국 KR · 미국 US · 일본 JP · 독일 DE · 영국 GB) */
export const buyers: SeedBuyer[] = [
  { id: 'B01', name: '김서연 Seo-yeon Kim', country: 'KR', language: 'KO', sandbox: true, role: '대표 시나리오: 통관 보류 + "카드사에 이의제기" (SC4)' },
  { id: 'B02', name: '박지호 Ji-ho Park', country: 'KR', language: 'KO', sandbox: true, role: '색상 분쟁, 오토파일럿이 승인 대기로 올림 (SC5)' },
  { id: 'B03', name: 'Yuki T.', country: 'JP', language: 'JA', sandbox: true, role: '사이즈 문의 → 오토파일럿 자동 답변 (SC5)' },
  { id: 'B04', name: 'buyer_m***', country: 'US', language: 'EN', sandbox: true, role: '반복 미수령 주장, 자동 처리 제외 (SC5)' },
  { id: 'B05', name: 'Lena K.', country: 'DE', language: 'DE', sandbox: true, role: '환불 약속 4일 경과 (SC3, P1)' },
  { id: 'B06', name: '정다은 Da-eun Jung', country: 'KR', language: 'KO', sandbox: false, role: '개인통관고유부호 문의 (통관 신호)' },
  { id: 'B07', name: '이수민 Su-min Lee', country: 'KR', language: 'KO', sandbox: false, role: '색상 불만, 다투다 패소' },
  { id: 'B08', name: 'Olivia R.', country: 'US', language: 'EN', sandbox: false, role: '색상 불만, 전액 환불' },
  { id: 'B09', name: 'Mia L.', country: 'US', language: 'EN', sandbox: false, role: '추적번호 없이 미발송 주장' },
  { id: 'B10', name: 'Chris D.', country: 'US', language: 'EN', sandbox: false, role: '코트 첫 구매, 배송지 변경 요청 (사기 신호)' },
  { id: 'B11', name: 'Alex W.', country: 'US', language: 'EN', sandbox: false, role: '코트 도용 결제' },
  { id: 'B12', name: 'Sophie B.', country: 'GB', language: 'EN', sandbox: false, role: '우수 고객 (비교용)' },
];

// ───────────────────────────── 6-4. 분쟁 9건 ─────────────────────────────

const INR = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';
const SNAD = 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED';
const UNAUTHORISED = 'UNAUTHORISED';

/**
 * 원문 6-4 그대로. 종결 손실은 원문 값(환불액 + 분쟁 수수료 $8 가정)을 그대로 쓴다.
 * 합 40800¢ = $408. SPEC 13장 Q8에서 "원문 그대로"로 확정됐다.
 */
export const disputes: SeedDispute[] = [
  { id: 'D1', buyerId: 'B02', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B1', status: 'open', lossCents: null, source: 'sandbox' },
  { id: 'D2', buyerId: 'B01', sku: 'FK-SW-NV', reason: INR, subtype: 'A2', status: 'open', lossCents: null, source: 'sandbox' },
  { id: 'D3', buyerId: 'B04', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'open', lossCents: null, source: 'sandbox' },
  { id: 'D4', buyerId: 'B08', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B1', status: 'closed', lossCents: 5600, source: 'seed' },
  { id: 'D5', buyerId: 'B07', sku: 'FK-CD-OAT', reason: SNAD, subtype: 'B1', status: 'closed', lossCents: 5600, source: 'seed' },
  { id: 'D6', buyerId: 'B09', sku: 'FK-CD-OAT', reason: INR, subtype: 'A1', status: 'closed', lossCents: 5600, source: 'seed' },
  { id: 'D7', buyerId: 'B04', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'closed', lossCents: 4300, source: 'seed' },
  { id: 'D8', buyerId: 'B04', sku: 'FK-BN-SET', reason: INR, subtype: 'F1', status: 'closed', lossCents: 0, source: 'seed' },
  { id: 'D9', buyerId: 'B11', sku: 'FK-CT-GR', reason: UNAUTHORISED, subtype: 'E1', status: 'closed', lossCents: 19700, source: 'seed' },
];

// ───────────────────────────── 6-5 / 4-1. 주문 214건 ─────────────────────────────

type OrderDraft = { buyerId: string; sku: string; country: SeedOrder['country']; tracked: boolean };

/**
 * 샌드박스 주문 12건. 자리표시자다: 실제 PayPal 주문 ID는 T001이
 * `tests/sandbox/manifest.json`에 기록하고, 여기 `id`(O01~O12)가 그 `key`와 맞물린다.
 *
 * **아래 12행은 `tasks/T001.md` "주문 12건 배정" 표가 정본이다.** 키·구매자·상품·추적 여부를
 * 행마다 그대로 옮긴다 (T026의 주문 생성 스크립트도 같은 표를 따른다). 바꿀 일이 생기면
 * 시드가 아니라 그 표를 먼저 고친다.
 * 구매자 키 대응: seoyeon B01 · jiho B02 · yuki B03 · lena B05 · buyer_m B04 (원문 6-2).
 * 구매자별 건수 서연 1 · 지호 1 · Yuki 3 · Lena 2 · buyer_m 5, 추적 등록 7 / 미등록 5 (원문 6-5).
 */
export const sandboxOrderDrafts: ({ id: string } & OrderDraft)[] = [
  // D2의 추적 상태 메모가 "Customs hold"라서 서연 주문은 추적 등록된 상태다 (원문 6-5)
  { id: 'O01', buyerId: 'B01', sku: 'FK-SW-NV', country: 'KR', tracked: true }, // D2 INR
  { id: 'O02', buyerId: 'B02', sku: 'FK-CD-OAT', country: 'KR', tracked: false }, // D1 SNAD
  { id: 'O03', buyerId: 'B03', sku: 'FK-CD-OAT', country: 'JP', tracked: false },
  { id: 'O04', buyerId: 'B03', sku: 'FK-SW-NV', country: 'JP', tracked: false },
  { id: 'O05', buyerId: 'B03', sku: 'FK-BN-SET', country: 'JP', tracked: false },
  { id: 'O06', buyerId: 'B05', sku: 'FK-BN-SET', country: 'DE', tracked: true },
  { id: 'O07', buyerId: 'B05', sku: 'FK-CD-OAT', country: 'DE', tracked: false },
  // D3: 배송 완료 기록이 있어야 F1(반복 주장) 규칙이 걸린다 (SPEC rules.abuse).
  // buyer_m의 비니 주문 4건(O08~O11)은 모두 추적 등록이고, 분쟁 D3·D7·D8이 그 중 세 건에 걸린다.
  // `SeedDispute`에 주문 ID가 없어 어느 주문인지는 시드에서 고정하지 않는다.
  { id: 'O08', buyerId: 'B04', sku: 'FK-BN-SET', country: 'US', tracked: true }, // D3 INR
  { id: 'O09', buyerId: 'B04', sku: 'FK-BN-SET', country: 'US', tracked: true },
  { id: 'O10', buyerId: 'B04', sku: 'FK-BN-SET', country: 'US', tracked: true },
  { id: 'O11', buyerId: 'B04', sku: 'FK-BN-SET', country: 'US', tracked: true },
  { id: 'O12', buyerId: 'B04', sku: 'FK-CD-OAT', country: 'US', tracked: true },
];

/** 원문 6-2의 구매자 B06~B12 주문 10건 (샌드박스 아님). 분쟁 상품과 맞춘다 */
export const namedSeedOrderDrafts: OrderDraft[] = [
  { buyerId: 'B06', sku: 'FK-SW-NV', country: 'KR', tracked: true },
  { buyerId: 'B07', sku: 'FK-CD-OAT', country: 'KR', tracked: true }, // D5 증빙 제출 후 패소
  { buyerId: 'B08', sku: 'FK-CD-OAT', country: 'US', tracked: true }, // D4 전액 환불
  { buyerId: 'B09', sku: 'FK-CD-OAT', country: 'US', tracked: false }, // D6 추적번호 없음
  { buyerId: 'B10', sku: 'FK-CT-GR', country: 'US', tracked: false }, // 첫 구매 · 배송지 변경 요청
  { buyerId: 'B11', sku: 'FK-CT-GR', country: 'US', tracked: true }, // D9 도용 결제
  { buyerId: 'B12', sku: 'FK-CD-OAT', country: 'GB', tracked: true },
  { buyerId: 'B12', sku: 'FK-SW-NV', country: 'GB', tracked: true },
  { buyerId: 'B12', sku: 'FK-CT-GR', country: 'GB', tracked: false },
  { buyerId: 'B12', sku: 'FK-BN-SET', country: 'GB', tracked: true },
];

/** 상품별 90일 주문 수 (원문 6-1) */
export const SKU_ORDER_TOTALS: Record<string, number> = {
  'FK-CD-OAT': 62,
  'FK-SW-NV': 48,
  'FK-CT-GR': 33,
  'FK-BN-SET': 71,
};

/**
 * 국가 할당량 (원문 4-1 US 45% · KR 25% · JP 15% · DE 15%).
 * 원문 6-2의 B12(Sophie B.)가 영국이라 GB 4건은 먼저 빼고, 남은 210건을
 * 최대 잉여법으로 나눈다 → US 95 · KR 53 · JP 31 · DE 31 (+ GB 4 = 214).
 */
export const COUNTRY_TOTALS: Record<SeedOrder['country'], number> = { US: 95, KR: 53, JP: 31, DE: 31, GB: 4 };

/** 추적 등록 비율 (원문 4-1 "추적번호 등록 60%"): round(214 × 0.6) = 128건 */
export const TRACKED_TOTAL = 128;

/** 자동 생성 구매자 ID 접두사. 원문 6-2의 '핵심 12명'(B01~B12)과 구분한다 */
export const ANON_BUYER_PREFIX = 'X';

const pad = (n: number, width: number) => String(n).padStart(width, '0');

function buildAnonymousOrderDrafts(): OrderDraft[] {
  const named = [...sandboxOrderDrafts, ...namedSeedOrderDrafts];
  const used = (pick: (o: OrderDraft) => string, key: string) => named.filter((o) => pick(o) === key).length;

  const skuQuota = Object.fromEntries(
    Object.entries(SKU_ORDER_TOTALS).map(([sku, total]) => [sku, total - used((o) => o.sku, sku)]),
  ) as Record<string, number>;
  const countryQuota = Object.fromEntries(
    Object.entries(COUNTRY_TOTALS).map(([c, total]) => [c, total - used((o) => o.country, c)]),
  ) as Record<SeedOrder['country'], number>;

  const trackedNamed = named.filter((o) => o.tracked).length;
  const count = Object.values(skuQuota).reduce((a, b) => a + b, 0);
  const trackedQuota = { yes: TRACKED_TOTAL - trackedNamed, no: count - (TRACKED_TOTAL - trackedNamed) };

  const skus = shuffled(fromQuota(skuQuota), 0x5EED01);
  const countries = shuffled(fromQuota(countryQuota), 0x5EED02);
  const tracked = shuffled(fromQuota(trackedQuota), 0x5EED03);

  return Array.from({ length: count }, (_, i) => ({
    buyerId: `${ANON_BUYER_PREFIX}${pad(i + 1, 3)}`,
    sku: skus[i],
    country: countries[i],
    tracked: tracked[i] === 'yes',
  }));
}

/** 주문 214건: 샌드박스 12건(자리표시자) + 시드 202건 */
export function buildOrders(): SeedOrder[] {
  const sandbox: SeedOrder[] = sandboxOrderDrafts.map((d) => ({
    id: d.id,
    buyerId: d.buyerId,
    sku: d.sku,
    amountCents: priceOf(d.sku),
    country: d.country,
    tracked: d.tracked,
    source: 'sandbox',
  }));

  const seedDrafts = [...namedSeedOrderDrafts, ...buildAnonymousOrderDrafts()];
  const seeded: SeedOrder[] = seedDrafts.map((d, i) => ({
    id: `SO${pad(i + 1, 3)}`,
    buyerId: d.buyerId,
    sku: d.sku,
    amountCents: priceOf(d.sku),
    country: d.country,
    tracked: d.tracked,
    source: 'seed',
  }));

  return [...sandbox, ...seeded];
}

// ───────────────────────────── 6-3. 문의 31건 ─────────────────────────────

/** 원문 6-3 표 8건. 원문·영어 문장을 그대로 옮긴다 ("(원문)"은 영어와 같다는 뜻) */
export const tableInquiries: SeedInquiry[] = [
  {
    date: '2026-11-09',
    buyerId: 'B01',
    original: '벌써 3주째인데 아직도 안 왔어요. 연락 없으면 카드사에 이의제기할게요.',
    english: "It's been 3 weeks and it still hasn't arrived. If I don't hear back, I'll file a dispute with my card company.",
    signal: 'A2',
    isDemo: true,
  },
  {
    date: '2026-11-02',
    buyerId: 'B01',
    original: '배송 조회가 일주일째 그대로예요. 확인 부탁드려요.',
    english: "Tracking hasn't changed in a week. Could you check?",
    signal: 'A2',
    isDemo: true,
  },
  {
    date: '2026-11-08',
    buyerId: 'B10',
    original: 'Can you ship to a different address than my billing address?',
    english: 'Can you ship to a different address than my billing address?',
    signal: 'E1',
    isDemo: true,
  },
  {
    date: '2026-11-05',
    buyerId: 'B06',
    original: '개인통관고유부호는 어디에 입력하면 되나요?',
    english: 'Where do I enter my personal customs clearance code?',
    signal: 'A2',
    isDemo: true,
  },
  {
    date: '2026-10-29',
    buyerId: 'B05',
    original: 'Sie hatten mir eine Rückerstattung versprochen. Wann kommt sie?',
    english: 'You promised me a refund. When will it come?',
    signal: 'C1',
    isDemo: true,
  },
  {
    date: '2026-10-20',
    buyerId: 'B02',
    original: '사진이랑 색이 너무 달라요. 베이지가 아니라 회색이에요.',
    english: "The color is very different from the photo. It's grey, not beige.",
    signal: 'B1',
    isDemo: true,
  },
  {
    date: '2026-10-11',
    buyerId: 'B04',
    original: 'Package says delivered but I don\'t have it.',
    english: 'Package says delivered but I don\'t have it.',
    signal: 'F1',
    isDemo: true,
  },
  {
    date: '2026-09-15',
    buyerId: 'B03',
    original: 'Mサイズの着丈は何cmですか？',
    english: 'What is the length of size M in cm?',
    signal: 'B2',
    isDemo: true,
  },
];

/** 자동 생성 문의의 유형 (원문 6-3: 배송 12 · 사이즈 6 · 색상 3 · 기타 2) */
export type InquiryType = 'shipping' | 'size' | 'color' | 'other';

export const GENERATED_INQUIRY_TYPE_TOTALS: Record<InquiryType, number> = { shipping: 12, size: 6, color: 3, other: 2 };

type GeneratedInquirySpec = {
  type: InquiryType;
  /** 원문 언어. 절반은 한국어 (원문 6-3) */
  lang: 'KO' | 'EN';
  original: string;
  english: string;
  signal?: Subtype;
  /** 원문 6-2의 문의 건수를 맞추려고 지정한 구매자. 없으면 자동 생성 구매자에게 붙는다 */
  buyerId?: string;
  date?: string;
  /** 문장이 특정 상품을 가리키면, 그 상품을 주문한 구매자에게만 붙인다 */
  requireSkus?: readonly string[];
  /** 문장이 추적 상태를 가리키면, 그 상태의 주문을 가진 구매자에게만 붙인다 */
  requireTracked?: boolean;
};

/** 사이즈(어깨 너비·기장·가슴 둘레) 문의가 성립하는 의류 3종. 비니 세트는 제외한다 */
const APPAREL_SKUS = ['FK-CD-OAT', 'FK-SW-NV', 'FK-CT-GR'] as const;

/**
 * 자동 생성 문의 23건의 고정 템플릿. LLM을 쓰지 않는다.
 * 한국어는 존댓말 템플릿이고 팀이 검수한다.
 * 한국어 12건 / 영어 11건 (23건의 절반 ±1건).
 *
 * 문장이 상품이나 추적 상태를 가리키면 `requireSkus`·`requireTracked`로 못 박아서,
 * 그 문의가 붙는 구매자의 주문과 어긋나지 않게 한다.
 */
export const generatedInquirySpecs: GeneratedInquirySpec[] = [
  // ── 배송 12건 ──
  // 원문 6-2: buyer_m***는 문의 4건 (표 1건 + 여기 3건), Mia L.은 2건
  { type: 'shipping', lang: 'EN', buyerId: 'B04', date: '2026-09-20', signal: 'A1', original: 'My order never showed up. Can you check what happened?', english: 'My order never showed up. Can you check what happened?' },
  { type: 'shipping', lang: 'EN', buyerId: 'B04', date: '2026-10-02', signal: 'A1', original: 'Another order of mine is missing. I never got it.', english: 'Another order of mine is missing. I never got it.' },
  { type: 'shipping', lang: 'EN', buyerId: 'B04', date: '2026-10-28', signal: 'F1', original: 'Same problem again - the package is not here.', english: 'Same problem again - the package is not here.' },
  { type: 'shipping', lang: 'EN', buyerId: 'B09', date: '2026-10-05', signal: 'A1', original: 'There is no tracking number on my order. Has it shipped?', english: 'There is no tracking number on my order. Has it shipped?' },
  { type: 'shipping', lang: 'EN', buyerId: 'B09', date: '2026-10-14', signal: 'A1', original: 'Still nothing here and still no tracking. Please advise.', english: 'Still nothing here and still no tracking. Please advise.' },
  { type: 'shipping', lang: 'KO', signal: 'A2', original: '주문한 상품이 아직 도착하지 않았어요. 배송 상황을 알려주실 수 있을까요?', english: "My order hasn't arrived yet. Could you let me know the shipping status?" },
  { type: 'shipping', lang: 'KO', signal: 'A2', original: '통관 중이라고 나오는데 며칠 더 걸릴까요?', english: "It says it's in customs clearance. How many more days will it take?", requireTracked: true },
  { type: 'shipping', lang: 'KO', signal: 'A1', original: '발송 안내를 아직 못 받았는데 언제 보내주시나요?', english: "I haven't received a shipping notice yet. When will it be sent?", requireTracked: false },
  { type: 'shipping', lang: 'KO', signal: 'A1', original: '운송장 번호를 알려주실 수 있나요?', english: 'Could you give me the tracking number?', requireTracked: false },
  { type: 'shipping', lang: 'KO', signal: 'A2', original: '통관에서 멈춘 것 같아요. 필요한 서류가 있으면 알려주세요.', english: "It looks like it's stuck in customs. Please let me know if any documents are needed.", requireTracked: true },
  { type: 'shipping', lang: 'EN', signal: 'A2', original: "My tracking hasn't updated for several days. Any news?", english: "My tracking hasn't updated for several days. Any news?", requireTracked: true },
  { type: 'shipping', lang: 'EN', signal: 'A1', original: 'I still have no shipping confirmation. When does my order go out?', english: 'I still have no shipping confirmation. When does my order go out?', requireTracked: false },

  // ── 사이즈 6건 ──
  { type: 'size', lang: 'KO', signal: 'B2', original: 'M 사이즈 어깨 너비가 몇 cm인가요?', english: 'What is the shoulder width of size M in cm?', requireSkus: APPAREL_SKUS },
  { type: 'size', lang: 'KO', signal: 'B2', original: '키가 165cm인데 S와 M 중 어느 것이 좋을까요?', english: "I'm 165 cm tall. Would S or M suit me better?", requireSkus: APPAREL_SKUS },
  { type: 'size', lang: 'KO', signal: 'B2', original: '사이즈표가 인치로만 있어서요. cm로도 알려주실 수 있나요?', english: 'The size chart is only in inches. Could you give me the measurements in cm as well?', requireSkus: APPAREL_SKUS },
  { type: 'size', lang: 'KO', signal: 'B2', original: '스웨터 소매 길이를 알려주실 수 있나요?', english: 'Could you tell me the sleeve length of the sweater?', requireSkus: ['FK-SW-NV'] },
  { type: 'size', lang: 'EN', signal: 'B2', original: 'Is the cardigan true to size, or should I size up?', english: 'Is the cardigan true to size, or should I size up?', requireSkus: ['FK-CD-OAT'] },
  { type: 'size', lang: 'EN', signal: 'B2', original: 'Could you share the chest measurement for size L in cm?', english: 'Could you share the chest measurement for size L in cm?', requireSkus: APPAREL_SKUS },

  // ── 색상 3건 ──
  { type: 'color', lang: 'KO', signal: 'B1', original: '화면에서 보이는 색과 실제 색이 많이 다른가요?', english: 'Is the actual color very different from what I see on screen?' },
  { type: 'color', lang: 'KO', signal: 'B1', original: '오트 색상이 사진보다 더 회색빛인가요?', english: 'Is the oat color greyer than it looks in the photo?', requireSkus: ['FK-CD-OAT'] },
  { type: 'color', lang: 'EN', signal: 'B1', original: 'Does the oat shade read more beige or more grey in daylight?', english: 'Does the oat shade read more beige or more grey in daylight?', requireSkus: ['FK-CD-OAT'] },

  // ── 기타 2건 (분류 신호 없음) ──
  { type: 'other', lang: 'KO', original: '선물 포장도 해주시나요?', english: 'Do you offer gift wrapping as well?' },
  // 재입고 문의는 재고가 가장 적은 코트(25개)로 둔다. 비니 세트는 재고 150이라 문장과 어긋났다
  { type: 'other', lang: 'EN', original: 'Will you restock the cashmere coat in grey?', english: 'Will you restock the cashmere coat in grey?', requireSkus: ['FK-CT-GR'] },
];

/** 자동 생성 문의 날짜: 90일 안에 고정 간격으로 흩뜨린다 (i마다 다른 날) */
function generatedInquiryDate(i: number): string {
  return daysBefore(DEMO_TODAY, 7 + ((i * 29) % 80));
}

/**
 * 문의 31건 = 원문 6-3 표 8건(앞) + 자동 생성 23건(뒤).
 * 배열 순서가 '표'와 '자동 생성'을 가른다 (`SeedInquiry`에 유형 필드가 없다).
 */
/** 자동 생성 문의를 붙일 나라: 한국어는 한국 주문, 영어는 미국 주문 구매자 */
const INQUIRY_POOL_COUNTRY: Record<'KO' | 'EN', SeedOrder['country']> = { KO: 'KR', EN: 'US' };

/**
 * 구매자를 지정하지 않은 자동 생성 문의에 자동 생성 구매자를 붙인다.
 * 문장이 가리키는 상품·추적 상태(`requireSkus`·`requireTracked`)와 그 구매자의 주문이 맞아야 한다.
 * 조건이 붙은 문의부터 먼저 고르고(제약이 없는 문의가 자리를 먼저 차지하지 않게), 각 단계는
 * 주문 배열 순서대로 첫 번째로 맞는 구매자를 고른다 — 순서가 고정이라 결과도 결정적이다.
 */
function assignAnonBuyers(orders: SeedOrder[]): Map<number, string> {
  const anonOrders = orders.filter((o) => o.buyerId.startsWith(ANON_BUYER_PREFIX));
  const assigned = new Map<number, string>();
  const used = new Set<string>();

  const indexes = generatedInquirySpecs
    .map((spec, i) => ({ spec, i }))
    .filter(({ spec }) => !spec.buyerId);
  const constrained = indexes.filter(({ spec }) => spec.requireSkus || spec.requireTracked !== undefined);
  const free = indexes.filter(({ spec }) => !spec.requireSkus && spec.requireTracked === undefined);

  for (const { spec, i } of [...constrained, ...free]) {
    const match = anonOrders.find(
      (o) =>
        o.country === INQUIRY_POOL_COUNTRY[spec.lang] &&
        !used.has(o.buyerId) &&
        (!spec.requireSkus || spec.requireSkus.includes(o.sku)) &&
        (spec.requireTracked === undefined || o.tracked === spec.requireTracked),
    );
    if (!match) throw new Error(`자동 생성 구매자를 찾지 못했다: ${spec.lang} "${spec.original}"`);
    used.add(match.buyerId);
    assigned.set(i, match.buyerId);
  }

  return assigned;
}

export function buildInquiries(orders: SeedOrder[]): SeedInquiry[] {
  const anonBuyerBySpec = assignAnonBuyers(orders);

  let anonIndex = 0;
  const generated = generatedInquirySpecs.map((spec, i): SeedInquiry => {
    const buyerId = spec.buyerId ?? anonBuyerBySpec.get(i);
    if (!buyerId) throw new Error(`${spec.lang} 자동 생성 구매자가 모자라다`);
    const date = spec.date ?? generatedInquiryDate(anonIndex);
    if (!spec.buyerId) anonIndex++;
    return {
      date,
      buyerId,
      original: spec.original,
      english: spec.english,
      ...(spec.signal ? { signal: spec.signal } : {}),
      isDemo: true,
    };
  });

  return [...tableInquiries, ...generated];
}

// ───────────────────────────── 묶음 ─────────────────────────────

export function buildSeed() {
  const orders = buildOrders();
  return { products, buyers, inquiries: buildInquiries(orders), disputes, orders };
}
