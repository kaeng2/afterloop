/**
 * 엔진 데이터 계약. 금액은 모두 센트 정수이고, PayPal API로 보낼 때만 "7.20" 같은 문자열로 바꾼다.
 */

export type RootCause = 'A_DELIVERY' | 'B_EXPECTATION' | 'C_BILLING' | 'D_SUBSCRIPTION' | 'E_FRAUD' | 'F_ABUSE';
export type Stage = 'INQUIRY' | 'CHARGEBACK' | 'PRE_ARBITRATION' | 'ARBITRATION';
export type MoveType = 'send_message' | 'make_offer' | 'provide_evidence' | 'accept_claim';

export type BoardState = {
  disputeId: string;
  reason: string;
  stage: Stage;
  channel: 'INTERNAL' | 'EXTERNAL';
  dueDate: string;
  amountCents: number;
  currency: 'USD';
  /** PayPal 응답의 links[].rel에서 변환 (escalate 같은 MoveType 밖의 rel은 제외) */
  allowedMoves: MoveType[];
  buyerDisputeCount90d: number;
  hasDeliveredTracking: boolean;
  cause?: { rootCause: RootCause; confidence: number; signals: string[]; needsReview: boolean };
};

export type Params = {
  pWinBase: number;
  feeCents: number;
  tFightCents: number;
  tOfferCents: number;
  repurchaseValueCents: number;
  cFight: number;
  cAccept: number;
  cRefund: number;
  /** MVP는 판매자 설정 고정값, 기본 0.15 (최적화하지 않음) */
  offerRate: number;
};

export type Branch = { label: string; prob: number; lossCents: number };

export type Evaluation = {
  move: 'fight' | 'offer' | 'refund';
  apiMove: MoveType | null;
  expectedLossCents: number | null;
  blockedBy?: string;
  /** 트리 화면용. 시간 비용(t)은 분기에 넣지 않는다: Σ(prob × lossCents) + t = expectedLossCents */
  branches: Branch[];
  // ── 이하 섹션 2에서 추가한 선택 필드 (기존 계약과 호환) ──
  /** offer: 실제 계산에 쓴 제안 비율 (R1 적용 후) */
  offerRate?: number;
  /** offer·refund: PayPal offer_type / accept_claim_type (R2: $150 이상이면 REFUND_WITH_RETURN) */
  offerType?: RefundType;
  /** fight: 안내 메시지 동반 (R3) */
  attachMessage?: boolean;
  /** accept_claim처럼 되돌릴 수 없는 수: 승인 외에 별도 확인 필요 (G3) */
  strictApproval?: boolean;
};

export type RefundType = 'REFUND' | 'REFUND_WITH_RETURN';

export type Recommendation = {
  best: Evaluation | null;
  all: Evaluation[];
  requiresApproval: true;
  // ── 이하 섹션 2에서 추가한 필드 ──
  /** 'manual': 추천할 수 있는 수가 없어 판매자가 직접 처리 (G2) */
  status: 'ready' | 'manual';
  /** 원인 분류 needsReview 또는 분류 없음 → "판매자 확인 필요" 표시 (G4) */
  needsSellerReview: boolean;
  /** 원인 E·F 또는 추천이 accept_claim → 별도 확인 플래그 없이는 실행 불가 (G3) */
  strictApproval: boolean;
  /** 이 판에 실제로 영향을 준 규칙 ID (화면 표시용) */
  appliedRules: string[];
};
