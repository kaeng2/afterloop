/**
 * 시안 v6 표시용 데이터 (T121, SPEC v2.16, 결정 2026-11-12 20:35 ③). 전부 **Demo data**다.
 *
 * 기준: `docs/design/mockup-v6/Desk.dc.html`의 `histT`(서연 사건 기록 8줄)·`pname`·`who`·`cats`·`other`.
 * 계산하지 않는다 — 위험 %·"Keeps ≈$N"·기대 손실은 엔진이 만든다. 여기엔 글·번호·날짜·건수만 있다.
 *
 * 실제 PayPal 값과의 경계:
 * - 서연 기록의 **Nov 9 구매자 메시지**와 **분쟁 접수 줄**은 실제 PayPal 값(샌드박스 분쟁 D2)이 쓴다.
 *   시드는 Nov 9 줄에 `source: 'paypal'` 표시만 하고, 접수 줄은 아예 싣지 않는다 (화면이 API 값으로 채운다).
 * - 표시용 주문 번호(#1042 …)는 화면용이다. PP-R-… 분쟁 번호는 보조 줄에 남기도록 `paypalRef`에 같이 둔다.
 * - 지호 #1038은 새 사건이다. PayPal 분쟁과의 연결(demo-links)은 T119 뒤 컨트롤 타워가 따로 지시한다 → `paypalRef: null`.
 * - Lena #1029·Yuki #1051은 PayPal 사건이 아니다 (`paypalRef: null`, Demo data).
 * - 예방 줄의 건수("5 orders"·"3 orders")는 표시용이다. **실제 추적 등록 대상은 O05·O07만** (`realTrackingTargets`).
 */
import type { DemoDisplay } from './demo-schema';

/** 시연 시점 (SPEC 7장). 지호 구매일을 이 날짜에서 5주 전으로 센다 */
export const DEMO_TODAY = '2026-11-10';

export const demoDisplay: DemoDisplay = {
  version: 'demo-display-2026-11-12.v1',
  note: '시안 v6 표시용 시드 (전부 Demo data). 숫자 계산 없음 — 엔진이 한다.',
  isDemo: true,

  // 서연 사건 기록 = 시안 histT 8줄 (en/ko 문장은 시안 그대로)
  seoyeonHistory: [
    {
      date: '2026-10-19',
      actor: 'sys',
      text: 'Order paid · $72',
      textKo: '결제 완료 · $72',
      merchantMistake: false,
      source: 'seed',
    },
    {
      date: '2026-10-21',
      actor: 'bad',
      text: 'Shipped. Tracking not added to PayPal.',
      textKo: '발송. PayPal에 추적번호 미등록.',
      flag: 'No tracking in PayPal',
      flagKo: 'PayPal 추적번호 없음',
      merchantMistake: true,
      source: 'seed',
    },
    {
      date: '2026-10-28',
      actor: 'buyer',
      text: 'She asked: “Where is my order?”',
      textKo: '구매자 문의: “주문한 거 어디 있어요?”',
      merchantMistake: false,
      source: 'seed',
    },
    {
      date: '2026-10-31',
      actor: 'bad',
      text: 'You replied 3 days later, in English: “Please wait, it’s coming.”',
      textKo: '3일 뒤 영어로 답장: “Please wait, it’s coming.”',
      flag: 'Late · English · no date',
      flagKo: '늦음 · 영어 · 날짜 없음',
      merchantMistake: true,
      source: 'seed',
    },
    {
      date: '2026-11-02',
      actor: 'buyer',
      text: 'She asked again: tracking hasn’t moved in a week.',
      textKo: '재문의: 배송 조회가 일주일째 그대로.',
      merchantMistake: false,
      source: 'seed',
    },
    {
      date: '2026-11-03',
      actor: 'bad',
      text: 'You promised: “It will arrive by Nov 5.”',
      textKo: '약속: “11월 5일까지 도착해요.”',
      flag: 'Promise without carrier data',
      flagKo: '택배사 확인 없는 약속',
      merchantMistake: true,
      source: 'seed',
    },
    {
      date: '2026-11-05',
      actor: 'sys',
      text: 'Nov 5 passed. Parcel still held at customs.',
      textKo: '11/5 지남. 여전히 세관 보류.',
      flag: 'Promise missed',
      flagKo: '약속 어김',
      merchantMistake: false,
      source: 'seed',
    },
    {
      // 실제 PayPal 값(분쟁 D2의 11/09 구매자 글)이 이 줄 자리에 온다. 아래 문장은 시안 값이고 실제 글이 없을 때만 쓴다.
      date: '2026-11-09',
      actor: 'buyer',
      text: 'She threatened a chargeback. No reply since.',
      textKo: '차지백 예고. 이후 무응답.',
      merchantMistake: false,
      source: 'paypal',
    },
  ],

  // 표시용 주문 번호 (PP-R-… 는 보조 줄)
  orderLabels: [
    {
      key: 'seoyeon',
      displayNo: '#1042',
      paypalRef: 'PP-R-GMS-10197661',
      seedDisputeId: 'D2',
      orderId: 'O01',
      buyerId: 'B01',
      displaySku: 'FK-SW-NV',
      buyerLabel: 'Seo-yeon Kim · KR',
      buyerLabelKo: '김서연 · 한국',
      productName: 'Wool Sweater',
      productNameKo: '울 스웨터',
      category: 'Not received · Customs hold',
      categoryKo: '미수령 · 통관 보류',
    },
    {
      key: 'jiho',
      displayNo: '#1038',
      paypalRef: 'PP-R-ZOK-10200237', // T121b: 새 품질 분쟁 (PayPal 응답 기한 없음 — 기한은 시드 Demo data)
      seedDisputeId: null,
      orderId: null,
      buyerId: 'B02',
      displaySku: 'FK-CD-OAT',
      buyerLabel: 'Ji-ho Park · KR',
      buyerLabelKo: '박지호 · 한국',
      productName: 'Knit Cardigan',
      productNameKo: '니트 가디건',
      category: 'Not as described · Quality',
      categoryKo: '설명과 다름 · 품질',
    },
    {
      key: 'mike',
      displayNo: '#1047',
      paypalRef: 'PP-R-FYT-10197651',
      seedDisputeId: 'D3',
      orderId: 'O08',
      buyerId: 'B04',
      displaySku: 'FK-SW-NV', // 시안은 스웨터. 실제 시드 주문 O08은 비니 세트 — 화면 표기만 시안을 따른다 (가격·판정은 엔진·실제 값)
      buyerLabel: 'buyer_m · US',
      buyerLabelKo: 'buyer_m · 미국',
      productName: 'Wool Sweater',
      productNameKo: '울 스웨터',
      category: 'Not received · Repeat claim',
      categoryKo: '미수령 · 반복 주장',
    },
  ],

  // 지호 #1038 구매일·반품 기간 (시드). 구매 5주(35일) 전, 반품 30일
  jihoPurchase: { orderDate: '2026-10-06', returnWindowDays: 30, weeksAgo: 5 },

  // 상품 표기 (시안 pname)
  productNames: [
    { sku: 'FK-CD-OAT', key: 'cardigan', name: 'Knit Cardigan', nameKo: '니트 가디건' },
    { sku: 'FK-SW-NV', key: 'sweater', name: 'Wool Sweater', nameKo: '울 스웨터' },
    { sku: 'FK-CT-GR', key: 'coat', name: 'Cashmere Coat', nameKo: '캐시미어 코트' },
    { sku: 'FK-BN-SET', key: 'beanie', name: 'Beanie + Scarf', nameKo: '비니+머플러' },
  ],

  // 손님 표기 (시안 who: 이름 · 국가)
  guestLabels: [
    { buyerId: 'B01', label: 'Seo-yeon Kim · KR', labelKo: '김서연 · 한국' },
    { buyerId: 'B02', label: 'Ji-ho Park · KR', labelKo: '박지호 · 한국' },
    { buyerId: 'B05', label: 'Lena K. · DE', labelKo: 'Lena K. · 독일' },
    { buyerId: 'B03', label: 'Yuki T. · JP', labelKo: 'Yuki T. · 일본' },
    { buyerId: 'B04', label: 'buyer_m · US', labelKo: 'buyer_m · 미국' },
  ],

  // 예방 줄 (표시용 시드). 실제 추적 등록 대상은 O05·O07만 — 등록 코드는 그대로
  preventRows: [
    {
      key: 'tracking',
      count: 5,
      line: '5 orders · Missing tracking',
      lineKo: '5건 · 추적번호 없음',
      who: 'Shipped 3+ days ago · 4 countries',
      whoKo: '발송 3일 지남 · 4개국',
      realTrackingTargets: ['O05', 'O07'],
    },
    {
      key: 'customs-id',
      count: 3,
      line: '3 orders · Customs ID missing',
      lineKo: '3건 · 통관번호 없음',
      who: 'Korean buyers · ship this week',
      whoKo: '한국 구매자 · 이번 주 발송',
      realTrackingTargets: [],
    },
  ],

  // 데모 항목 (PayPal 사건이 아님). 버튼 동작은 화면 작업(T122c)
  demoItems: [
    {
      key: 'lena',
      displayNo: '#1029',
      paypalRef: null,
      buyerId: 'B05',
      displaySku: 'FK-BN-SET',
      country: 'DE',
      category: 'Refund promised',
      categoryKo: '환불 약속',
      buyerLabel: 'Lena K. · DE',
      buyerLabelKo: 'Lena K. · 독일',
      refundCents: 2400,
      promisedDate: '2026-11-06',
      title: 'Refund the $24 you promised',
      titleKo: '약속한 $24 환불',
      body: 'Promised Nov 6. Late refunds often become disputes.',
      bodyKo: '11/6 약속. 늦은 환불은 분쟁이 되기 쉬워요.',
      action: 'Refund $24',
      actionKo: '$24 환불',
    },
    {
      key: 'yuki',
      displayNo: '#1051',
      paypalRef: null,
      buyerId: 'B03',
      displaySku: 'FK-CD-OAT',
      country: 'JP',
      category: 'Question · Size',
      categoryKo: '문의 · 사이즈',
      buyerLabel: 'Yuki T. · JP',
      buyerLabelKo: 'Yuki T. · 일본',
      aiAnswer: 'AI answered: size M is 64 cm long',
      aiAnswerKo: 'AI 답변: M 사이즈 총장 64cm',
      body: 'Answered in Japanese from your size chart.',
      bodyKo: '사이즈표를 보고 일본어로 답했어요.',
      action: 'Looks good',
      actionKo: '확인',
    },
  ],
};
