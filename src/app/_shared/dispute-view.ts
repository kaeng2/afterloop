/**
 * 화면이 받는 분쟁 1건의 모양 (T047, SPEC v2.6 2·9-4장).
 *
 * `src/app/_server/disputes.ts`가 만들고 화면 5개가 읽는다. 타입과 고르기 규칙만 여기 둔다 — 이 파일은
 * PayPal·LLM을 끌어오지 않아서 클라이언트 묶음에 들어가도 안전하다.
 *
 * **보드가 둘인 이유** (SPEC 2장 서연 장면): `boardReal`은 PayPal에서 읽은 값만 쓴 보드, `boardDemo`는
 * 시연용 배송사 정보·이전 분쟁 기록을 덧씌운 보드다. S5는 이 둘의 엔진 결과를 나란히 보여 준다
 * (전: 추적 없는 미수령 → 환불 추천, 후: 통관 보류 → 답장 추천). 덧씌울 것이 없으면 `boardDemo`는 `null`이다.
 *
 * 개인정보 (SPEC 10장): 구매자 이메일·주소·`payer_id`·PayPal 응답 원문은 담지 않는다. `buyerMessages`는
 * `maskPersonal`을 거친 글이다.
 */
import type { BoardState, EscalationSignals, SeedBuyer, SeedCarrierEvent, SeedProduct } from '@/types';

/** 시연용으로 덧씌운 값의 이름. 화면은 `common.field.*` 문구로 옮겨 'Demo data' 배지 옆에 적는다. */
export type DemoField =
  | 'hasTracking'
  | 'hasDeliveredTracking'
  | 'buyerPriorInrDisputes'
  | 'carrierEvents'
  | 'cause'
  | 'earlierInquiries';

export type LoadedDispute = {
  /** 연결 표의 시드 키 (D1·D2·D3). */
  key: string;
  /** 실제 PayPal 분쟁 번호. */
  disputeId: string;
  /** PayPal 상태 (`WAITING_FOR_SELLER_RESPONSE`, `UNDER_REVIEW` …). 응답에 없으면 빈 문자열. */
  statusCode: string;
  /** 구매자 (시드). 연결 표의 시드 분쟁이 가리키는 구매자. */
  buyer: SeedBuyer | null;
  /** 상품 (시드). */
  product: SeedProduct | null;
  /** 구매자 글. `maskPersonal`을 거친 것이다 (원문이 아니다). */
  buyerMessages: string[];
  /** 실제 값만 쓴 보드. */
  boardReal: BoardState;
  /** 시연용 값을 덧씌운 보드. 덧씌울 것이 없으면 `null`. */
  boardDemo: BoardState | null;
  /**
   * 어느 값이 시연용인지 (배지용). 비어 있으면 이 분쟁에는 시연용 값이 섞이지 않았다.
   * `boardDemo`에 덧씌운 값과 신호가 기대는 시연용 문의(`earlierInquiries`)를 함께 담는다 —
   * `boardDemo`가 `null`이어도 신호가 시연용 문의에 기대면 비어 있지 않다.
   */
  demoFields: DemoField[];
  /** 배송사 이벤트 (시연용). 없으면 빈 배열. */
  carrierEvents: SeedCarrierEvent[];
  /** 확대 위험 신호. 만들 수 없으면 `null`. */
  signals: EscalationSignals | null;
  /** 판매자가 지금 답장했다고 볼 때의 신호 (S5의 전·후 비교). 만들 수 없으면 `null`. */
  signalsAfterReply: EscalationSignals | null;
  /** 이 분쟁에 실제 전송을 해도 되는가 (연결 표의 `liveSendAllowed`). */
  liveSendAllowed: boolean;
  /** 실제 추적 등록 여부를 읽지 못했다 (T082). 참이면 `boardReal.hasTracking`은 자리값(없음)이고, 사건 기록은 "추적 없음"을 쓰지 않는다. */
  trackingUnknown?: boolean;
  /**
   * 사건 기록 재료 (T076, 계약 9부 `CaseEvent`). 실제 값만: 분쟁 접수 시각·구매자/판매자 글 시각(샌드박스),
   * 시드 주문일. 없으면(옛 시험 데이터) 사건 기록은 배송사·문의만으로 만든다.
   */
  timeline?: DisputeTimeline;
};

/** 사건 기록 재료. 구매자 글은 가린 글이다. 판매자 글은 시각만 (글 내용을 싣지 않는다). */
export type DisputeTimeline = {
  /** PayPal 분쟁 `create_time`. 없으면 `null`. */
  openedAt: string | null;
  buyerMessages: { text: string; at: string }[];
  sellerReplies: { at: string }[];
  /** 시드 주문일 (`SeedOrder.date`, 연결 표의 시드 분쟁 → 주문). 모르면 `null`. */
  orderDate: string | null;
};

/**
 * 화면이 기본으로 보여 줄 보드. 시연용 보드가 있으면 그것, 없으면 실제 보드다.
 * 고르기만 한다 — 보드를 고치거나 합치지 않는다.
 */
export function pickBoard(loaded: Pick<LoadedDispute, 'boardReal' | 'boardDemo'>): BoardState {
  return loaded.boardDemo ?? loaded.boardReal;
}

/** 이 분쟁에 시연용 값이 섞였는가 ('Demo data' 배지). */
export function hasDemoValues(loaded: Pick<LoadedDispute, 'demoFields'>): boolean {
  return loaded.demoFields.length > 0;
}
