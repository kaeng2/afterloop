/**
 * AfterLoop 데이터 계약 (잠금 파일)
 *
 * 이 파일은 Claude Code 설정(.claude/settings.json permissions.deny)으로 편집이 막혀 있다.
 * 바꿔야 하면 SPEC.md·DECISIONS.md에 이유를 적고 사람 승인을 받은 뒤 컨트롤 타워가 고친다.
 *
 * 기준: SPEC v2.7 (v2 이후 바뀐 것: v2.2 8부 시드 필드 2개, v2.5 3부 `DemoLink`·`ReplyPolicy`, 8부 `SeedCarrierEvent`, 9부 `FollowUpDateFn`, v2.7 3부 `ReplyCommitment`·`ReplyDraftPolicy`). 바뀌면 SPEC 버전을 올리고 DECISIONS.md에 기록한다.
 * 1부: 분쟁 보드와 기대 손실 (v2: 16개 세부 유형, V·c·p_acc 곡선 삭제)
 * 2부: 실행 계약 (v1.1 그대로)
 * 3부: 설정 파일 (v2)
 * 4부: PayPal 클라이언트 (v1.1 그대로)
 * 5부: 정책·오토파일럿·확대 위험 (v2)
 * 6부: AI 분류·토큰 (v2)
 * 7부: 상품 진단 시뮬레이션 (v2)
 * 8부: 시드 데이터 (v2, v2.2에서 SeedDispute.orderId·SeedOrder.date 추가)
 *
 * 금액은 모두 센트 정수. API로 보낼 때만 "7.20" 같은 문자열로 바꾼다.
 */

// ───────────────────────────── 1부: 분쟁 보드와 기대 손실 ─────────────────────────────

/** 원인 대분류 (원문 5장) */
export type Category = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** 원인 세부 유형 16개 (원문 5장) */
export type Subtype =
  | 'A1' | 'A2' | 'A3' | 'A4'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5'
  | 'C1' | 'C2' | 'C3'
  | 'D1'
  | 'E1'
  | 'F1' | 'F2';

export type Stage = 'INQUIRY' | 'CHARGEBACK' | 'PRE_ARBITRATION' | 'ARBITRATION';
export type MoveType = 'send_message' | 'make_offer' | 'provide_evidence' | 'accept_claim';

/** 분쟁 원인. 규칙(코드)으로 정했는지 LLM이 정했는지 남긴다 */
export type Cause = {
  subtype: Subtype;
  confidence: number; // 0~1. 규칙으로 정했으면 1
  evidence: string[]; // 근거 단어
  needsReview: boolean; // confidence < rules.classification.minConfidence
  source: 'rule' | 'llm';
  causeNote?: string; // 예: "PCCC missing". 화면 설명용, 계산에 쓰지 않음
};

export type BoardState = {
  disputeId: string;
  reason: string; // PayPal reason (예: MERCHANDISE_OR_SERVICE_NOT_RECEIVED)
  stage: Stage;
  channel: 'INTERNAL' | 'EXTERNAL';
  dueDate: string; // seller_response_due_date (ISO 8601)
  amountCents: number;
  currency: 'USD';
  allowedMoves: MoveType[]; // PayPal 응답 links[].rel에서 변환
  hasTracking: boolean; // 추적번호가 PayPal에 등록됨
  hasDeliveredTracking: boolean; // 배송 완료 기록
  buyerPriorInrDisputes: number; // 같은 구매자의 이전 미수령(INR) 분쟁 수 (이번 건 제외)
  isDemo: boolean; // 시드 데이터면 true ('Demo data' 배지)
  cause?: Cause;
};

/** 기대 손실 가정값 (SPEC 5장). 값은 config/params.json */
export type Params = {
  feeCents: number; // f
  timeCostCents: number; // t (한 분쟁에 한 번)
  offerRate: number; // x. 정책값, 최적화하지 않음
  pAccept: number; // p_acc
  pWin: Record<Subtype, number>; // 추적 기록이 없을 때 다퉈서 이길 확률
  pWinWithTracking: Partial<Record<Subtype, number>>; // 추적(배송) 기록이 있을 때. 없는 유형은 pWin 사용
};

export type Evaluation = {
  move: 'fight' | 'offer' | 'refund';
  apiMove: MoveType | null;
  expectedLossCents: number | null; // 차단되면 null
  blockedBy?: string; // 예: 'OFFER_SCOPE'
  branches: { label: string; prob: number; lossCents: number }[]; // 트리 화면용
};

export type Recommendation = {
  best: Evaluation | null;
  all: Evaluation[];
  requiresApproval: true;
  autopilot: AutopilotDecision; // 5부
};

// ───────────────────────────── 2부: 실행 계약 (v1.1 그대로) ─────────────────────────────

/**
 * 판매자에게 보여주고, 승인되면 그대로 실행하는 계획. src/engine/이 만든다.
 * 금액(amountCents)을 정하는 곳은 엔진뿐이다. 실행 레인과 메시지 초안은 이 값을 옮기기만 한다.
 */
export type ActionPlan = {
  planId: string; // 같은 입력이면 같은 값 (결정론). 승인과 계획을 묶는 키
  disputeId: string;
  move: Evaluation['move'];
  apiMove: MoveType;
  amountCents: number | null; // make_offer: 제안 금액, accept_claim: 환불 금액, 그 외 null
  currency: 'USD';
  refundType: 'REFUND' | 'REFUND_WITH_RETURN' | null; // make_offer의 offer_type / accept_claim의 accept_claim_type
  messageRequired: boolean; // 증빙과 함께 안내 메시지를 보내야 함
  requiresApproval: true;
};

/** 판매자 승인. 화면(src/app/)이 만든다. 시각은 화면이 넣고 엔진은 시간을 읽지 않는다. */
export type Approval = {
  planId: string; // 승인한 계획의 planId와 같아야 실행된다
  approvedBy: string;
  approvedAt: string; // ISO 8601
  confirmAcceptClaim?: boolean; // accept_claim은 이 값이 true여야 실행
};

/** PayPal로 나가는 요청 1건. 실제 HTTP 전송은 src/paypal/client.ts가 한다. */
export type ApiRequest = {
  method: 'POST';
  path: string; // 예: /v1/customer/disputes/{id}/make-offer
  body: Record<string, unknown>;
  requestId: string; // PayPal-Request-Id (같은 계획을 재시도하면 같은 값)
};

export type PayPalCaller = (req: ApiRequest) => Promise<{ status: number; body: unknown }>;

export type ExecuteInput = {
  board: BoardState;
  plan: ActionPlan;
  /** LLM이 쓴 메시지 초안. 금액은 {{offerAmount}} 같은 자리표시자로만 들어 있다. */
  messageTemplate: string;
  approval: Approval | null;
};

export type ExecuteResult =
  | { ok: true; sent: { path: string; status: number }[] }
  | { ok: false; error: string; nextAction: string };

// ───────────────────────────── 3부: 설정 파일 (v2) ─────────────────────────────

/** config/params.json의 값 하나. source: "가정" | "가정(임시)" | "공개 통계: <출처>" | "PayPal 데이터" */
export type Sourced<T> = { value: T; source: string; note?: string };

/** 처방 ID (원문 9-1) */
export type FixId = 'tracking_24h' | 'color_note' | 'kr_customs_notice' | 'settle_first';

/** config/params.json 전체 */
export type ParamsConfig = {
  version: string;
  note?: string;
  params: { [K in keyof Params]: Sourced<Params[K]> };
  /** 처방별 세부 유형 확률 배수와 p_win 변경 (원문 9-1) */
  fixes: {
    [F in FixId]: Sourced<{
      rateMultiplier: Partial<Record<Subtype, number>>;
      pWinOverride?: Partial<Record<Subtype, number>>;
    }>;
  };
  /** 지금 습관: 분쟁마다 전액 환불할 확률 (나머지는 다툼) */
  habitRefundShare: Sourced<number>;
  /** 상품별 주문 1건당 세부 유형 분쟁 확률 (원문 6-1, sim.js PRODUCTS) */
  productRates: Record<string, Sourced<Partial<Record<Subtype, number>>>>;
};

/** config/rules.json 전체 (note 필드는 생략 가능) */
export type PolicyConfig = {
  version: string;
  offer: { eligibleSubtypes: Subtype[]; maxRate: number };
  autopilot: {
    skipCategories: Category[]; // F
    skipChannels: BoardState['channel'][]; // EXTERNAL
    minConfidence: number; // 0.7
    moneyMoves: Evaluation['move'][]; // offer, refund
  };
  abuse: { minPriorInrDisputes: number }; // F1 규칙: 이전 미수령 분쟁 2회 이상 + 배송 완료
  escalation: EscalationWeights;
  classification: { minConfidence: number };
};

/**
 * 실제 샌드박스 분쟁 ↔ 시드 연결 (v2.5). 값은 config/demo-links.json. 비밀값이 아니다.
 * 표에 없는 분쟁은 화면에 내지 않고 전송도 하지 않는다.
 */
export type DemoLink = {
  paypalDisputeId: string; // 'PP-R-…'
  seedDisputeId: string | null; // 시드 분쟁 (D1·D2·D3). 연습용·시연 제외 분쟁은 null
  carrierOrderId: string | null; // 배송사 정보를 가져올 시드 주문 = 시드 분쟁의 orderId (D2 → O01). 시드 분쟁이 없으면 null
  showOnScreen: boolean; // 화면에 보임
  liveSendAllowed: boolean; // 실제 전송(send-message, make-offer) 허용
  note?: string;
};
export type DemoLinksConfig = { version: string; links: DemoLink[] };

/** 답장 정책 (v2.5). 값은 config/rules.json의 `reply` */
export type ReplyPolicy = { followUpDays: number }; // 답장 후 확인 기한 (일). 7

/**
 * 답장에서 판매자가 할 수 있는 약속 (v2.7). 값은 config/rules.json의 `reply.allowedCommitments`.
 * 여기 없는 돈이 드는 약속(재발송·환불·할인·무료 배송·보상 등)은 AI 초안이 스스로 만들 수 없다.
 */
export type ReplyCommitment = {
  id: string; // 예: 'forward_customs_code'
  text: string; // 프롬프트에 넘기는 영어 한 줄. 날짜·금액을 넣지 않는다
  subtypes: Subtype[]; // 이 약속을 쓸 수 있는 원인 세부 유형
};

/** 답장 초안 정책 (v2.7). `ReplyPolicy`와 같은 설정 덩어리(`reply`)의 다른 칸 */
export type ReplyDraftPolicy = {
  followUpDateMeaning: string; // ⟦DATE_1⟧의 뜻 한 줄. "판매자가 확인해서 다시 연락하는 날. 도착 예상일이 아니다"
  allowedCommitments: ReplyCommitment[];
};

// ───────────────────────────── 4부: PayPal 클라이언트 (v1.1 그대로) ─────────────────────────────

/** 서버에서만 만든다. baseUrl은 https://api-m.sandbox.paypal.com만 허용 */
export type PayPalEnv = { clientId: string; clientSecret: string; baseUrl: string };

/** 테스트에서 시간·대기·네트워크를 바꿔 끼우기 위한 주입 함수 */
export type ClientDeps = {
  fetch: typeof fetch;
  now: () => number; // ms
  sleep: (ms: number) => Promise<void>;
  log?: (line: string) => void; // 비밀값을 넘기지 않는다
};

export type PayPalClient = {
  /** POST. PayPal-Request-Id = req.requestId */
  call: PayPalCaller;
  /** GET. path는 baseUrl 뒤에 붙는 경로 (예: /v1/customer/disputes) */
  get: (path: string) => Promise<{ status: number; body: unknown }>;
};

// ───────────────────────────── 5부: 정책·오토파일럿·확대 위험 (v2) ─────────────────────────────

export type AutopilotRule = 'suspected_abuse' | 'card_company_case' | 'low_confidence' | 'money_moves' | 'seller_review' | 'common_questions';

export type AutopilotDecision = {
  verdict: 'auto' | 'awaiting_approval' | 'skipped';
  rule: AutopilotRule;
  reason: string; // 로그 문구 (영어, 숫자는 코드가 채움)
};

export type EscalationWeights = {
  cardCompanyMention: number; // +3
  unanswered: number; // +2 (두 번째 문의 무응답 또는 24시간 넘게 무응답, 둘 중 하나만)
  angryTone: number; // +1
  dueWithin72h: number; // +1
  watchFrom: number; // 3
  highFrom: number; // 5
};

/** 확대 위험 신호. angryTone만 LLM 판별이고 나머지는 코드가 데이터로 정한다 */
export type EscalationSignals = {
  mentionsCardCompany: boolean;
  secondMessageUnanswered: boolean;
  unansweredOver24h: boolean;
  angryTone: boolean | null; // null = 판정 보류 (판매자 답장 후 구매자 다음 메시지 전)
  hoursToDue: number;
};

export type EscalationRisk = {
  score: number;
  band: 'Low' | 'Watch' | 'High';
  parts: { signal: keyof EscalationWeights; points: number }[];
};

// ───────────────────────────── 6부: AI 분류·토큰 (v2) ─────────────────────────────

/** 분류 입력. 이메일·주소·개인통관고유부호는 넣지 않는다 */
export type ClassifyInput = {
  reason: string;
  buyerMessages: string[]; // 원문 (한국어 포함)
  trackingEvents: string[]; // 택배사 이벤트 텍스트
  hasTracking: boolean;
  hasDeliveredTracking: boolean;
  buyerPriorInrDisputes: number;
};

/** LLM 호출 주입. 서버에서만. 응답은 JSON 스키마 검증 전의 원시 값 */
export type LlmCaller = (req: { system: string; user: string; jsonSchema: Record<string, unknown> }) => Promise<unknown>;

/** 사실값 토큰 (⟦DATE_1⟧, ⟦AMOUNT_1⟧, ⟦TRACKING_1⟧, ⟦CUSTOMS_STATUS_1⟧) */
export type FactToken = { token: string; kind: 'DATE' | 'AMOUNT' | 'TRACKING' | 'CUSTOMS_STATUS'; value: string };

/** 토큰 검사 결과. ok가 false면 전송 버튼 비활성 */
export type TokenCheck = {
  ok: boolean;
  missing: string[]; // 초안에 있는데 전송본에 없는 토큰
  extra: string[]; // 전송본에만 있는 토큰
  literalFacts: string[]; // 토큰이 아니라 값을 직접 쓴 부분 (예: "$24", "11월 17일")
  newPromises: string[]; // 초안에 없는 약속 표현 ("보장", "반드시" 등)
};

// ───────────────────────────── 7부: 상품 진단 시뮬레이션 (v2) ─────────────────────────────

export type SimInput = {
  sku: string;
  priceCents: number;
  stock: number; // 남은 재고 = 시뮬레이션할 주문 수
  rates: Partial<Record<Subtype, number>>; // 주문 1건당 세부 유형 확률
  fixes: FixId[]; // 켠 처방
  futures: number; // 500
  seed: number; // 상품별 고정 시드
};

export type SimSummary = {
  meanLossCents: number;
  p10LossCents: number;
  p90LossCents: number;
  meanDisputes: number;
};

export type SimResult = {
  before: SimSummary; // 지금 그대로
  after: SimSummary; // 켠 처방 적용
  histogram: { fromCents: number; toCents: number; before: number; after: number }[];
  waterfall: { step: 'as_is' | FixId; meanLossCents: number }[]; // 처방을 순서대로 더한 평균 손실
};

// ───────────────────────────── 8부: 시드 데이터 (v2, 원문 6장) ─────────────────────────────

export type SeedProduct = { sku: string; itemName: string; priceCents: number; stock: number; orders90d: number; disputes90d: number; checklistGaps: string[] };
export type SeedBuyer = { id: string; name: string; country: string; language: 'KO' | 'EN' | 'JA' | 'DE'; sandbox: boolean; role: string };
/** 시연용 배송사 추적 이벤트 (v2.5). PayPal 데이터가 아니다 — 화면에서 늘 'Demo data' 배지 */
export type SeedCarrierEvent = {
  orderId: string; // 시드 주문 (O01, O08 …)
  date: string; // YYYY-MM-DD
  status: 'shipped' | 'in_transit' | 'customs_hold' | 'out_for_delivery' | 'delivered';
  text: string; // 배송사 표기 그대로. 분류 입력의 trackingEvents로 들어간다
  isDemo: true;
};
export type SeedInquiry = { date: string; buyerId: string; original: string; english: string; signal?: Subtype; isDemo: true };
export type SeedDispute = {
  id: string; // D1~D9
  buyerId: string;
  sku: string;
  reason: string;
  subtype: Subtype;
  status: 'open' | 'closed';
  lossCents: number | null; // 종결 건만. 전액 환불 = 상품 가격, 패소 = 상품 가격 + f, 승소 = 0 (수수료는 질 때만, SPEC 12장)
  source: 'sandbox' | 'seed';
  orderId: string; // 이 분쟁이 걸린 주문 (SeedOrder.id). 구매자·상품이 같아야 한다 (v2.2)
};
export type SeedOrder = {
  id: string;
  buyerId: string;
  sku: string;
  amountCents: number;
  country: string;
  tracked: boolean;
  source: 'sandbox' | 'seed';
  date: string; // 주문일 YYYY-MM-DD. 시연 시점(2026-11-10) 기준 90일 창 안 (v2.2)
};

// ───────────────────────────── 공개 함수 시그니처 ─────────────────────────────
// 구현 파일은 `export const recommend = (...) => ... satisfies RecommendFn` 처럼 맞춘다.
// params·rules를 넘기지 않으면 엔진이 config/params.json·config/rules.json을 읽는다.

/** src/engine/recommend.ts */
export type RecommendFn = (board: BoardState, params?: Params, rules?: PolicyConfig) => Recommendation;

/** src/engine/plan.ts. 차단됐거나 apiMove가 null인 평가면 예외 */
export type PlanMoveFn = (board: BoardState, evaluation: Evaluation, params?: Params, rules?: PolicyConfig) => ActionPlan;

/** src/engine/escalation.ts */
export type EscalationRiskFn = (signals: EscalationSignals, rules?: PolicyConfig) => EscalationRisk;

/**
 * src/engine/followup.ts (v2.5). 답장에 넣을 확인 기한 날짜를 코드가 만든다 (YYYY-MM-DD, UTC 날짜).
 * now의 날짜 + followUpDays. 그 날짜가 disputeDueDate의 날짜보다 늦으면 기한 하루 전으로 당긴다 (now의 날짜보다 앞서지는 않는다).
 * disputeDueDate가 빈 문자열이면 당기지 않는다. policy를 안 주면 config/rules.json의 `reply`.
 */
export type FollowUpDateFn = (input: { now: string; disputeDueDate: string }, policy?: ReplyPolicy) => string;

/** src/engine/sim.ts. 같은 입력이면 같은 결과 (Math.random 금지) */
export type SimulateFn = (input: SimInput, params?: ParamsConfig, rules?: PolicyConfig) => SimResult;

/** src/ai/classify.ts. 규칙 먼저, 그 외 LLM. 실패해도 예외 대신 needsReview */
export type ClassifyFn = (input: ClassifyInput, deps: { llm: LlmCaller }, rules?: PolicyConfig) => Promise<Cause>;

/** src/ai/tokens.ts. 초안(토큰 포함)과 전송본을 비교 */
export type CheckTokensFn = (draft: string, outgoing: string, facts: FactToken[]) => TokenCheck;

/** src/paypal/client.ts. 샌드박스 외 baseUrl이면 만들 때 예외 */
export type CreatePayPalClientFn = (env: PayPalEnv, deps: ClientDeps) => PayPalClient;

/** src/exec/execute.ts */
export type ExecuteMoveFn = (input: ExecuteInput, deps: { call: PayPalCaller }) => Promise<ExecuteResult>;
