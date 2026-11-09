/**
 * AfterLoop 데이터 계약 (잠금 파일)
 *
 * 이 파일은 Claude Code 설정(.claude/settings.json permissions.deny)으로 편집이 막혀 있다.
 * 바꿔야 하면 SPEC.md "계약 변경 기록"에 이유를 적고 사람 승인을 받은 뒤 사람이 직접 고친다.
 *
 * 기준: SPEC v1.1. 바뀌면 SPEC 버전을 올리고 DECISIONS.md에 기록한다.
 * 1부: 테스트 지시서(수읽기 버전 B) "데이터 계약" 원문 + v1에서 Params에 p_acc 곡선 3개 추가.
 * 2부: 인수 테스트 AC5·AC11·AC12를 쓰기 위해 추가한 실행 계약. (SPEC.md 5장, 2026-11-09 승인)
 * 3부: config/*.json 형태.
 * 4부: PayPal 클라이언트 (v1.1, 2026-11-09 승인).
 *
 * 금액은 모두 센트 정수. API로 보낼 때만 "7.20" 같은 문자열로 바꾼다.
 */

// ───────────────────────────── 1부: 원문 계약 ─────────────────────────────

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
  allowedMoves: MoveType[]; // PayPal 응답의 허용 대응에서 변환 (links[].rel)
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
  offerRate: number; // MVP는 판매자 설정 고정값, 기본 0.15 (최적화하지 않음)
  // SPEC v1 추가: p_acc(x) = min(pAcceptCap, pAcceptBase + pAcceptSlope·x). 값은 config/params.json
  pAcceptBase: number;
  pAcceptSlope: number;
  pAcceptCap: number;
};

export type Evaluation = {
  move: 'fight' | 'offer' | 'refund';
  apiMove: MoveType | null;
  expectedLossCents: number | null;
  blockedBy?: string;
  branches: { label: string; prob: number; lossCents: number }[]; // 트리 화면용
};

export type Recommendation = { best: Evaluation | null; all: Evaluation[]; requiresApproval: true };

// ───────────────────────────── 2부: 실행 계약 (추가) ─────────────────────────────

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
  messageRequired: boolean; // R3: 증빙과 함께 안내 메시지를 보내야 함
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

// ───────────────────────────── 3부: 설정 파일 계약 (SPEC v1) ─────────────────────────────

/** config/params.json의 값 하나. source: "가정" | "공개 통계: <출처>" | "PayPal 데이터" */
export type SourcedValue = { value: number; unit: 'cents' | 'prob' | 'ratio' | 'count'; source: string; note?: string };

/** config/params.json 전체 */
export type ParamsConfig = { version: string; note?: string; params: { [K in keyof Params]: SourcedValue } };

/** config/rules.json 전체 (note 필드는 생략 가능) */
export type RulesConfig = {
  version: string;
  R1: { maxAmountCents: number; cause: RootCause; maxOfferRate: number };
  R2: { minAmountCents: number; refundType: 'REFUND_WITH_RETURN' };
  R3: { cause: RootCause; requiresDeliveredTracking: boolean };
  R4: { causes: RootCause[]; minBuyerDisputes90d: number };
  R5: { channels: BoardState['channel'][] };
  approval: { autoExecute: false; alwaysRequireCauses: RootCause[]; alwaysRequireMoves: MoveType[] };
  classification: { minConfidence: number };
  excludedReasons: { values: string[] };
};

// ───────────────────────────── 4부: PayPal 클라이언트 (SPEC v1.1, 5-1장) ─────────────────────────────

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

// ───────────────────────────── 공개 함수 시그니처 ─────────────────────────────
// 구현 파일은 `export const recommend = (...) => ... satisfies RecommendFn` 처럼 맞춘다.
// params·rules를 넘기지 않으면 엔진이 config/params.json·config/rules.json을 읽는다.

/** src/engine/recommend.ts: export function recommend */
export type RecommendFn = (board: BoardState, params?: Partial<Params>, rules?: RulesConfig) => Recommendation;

/** src/engine/plan.ts: export function planMove. 차단됐거나 apiMove가 null인 평가면 예외 */
export type PlanMoveFn = (
  board: BoardState,
  evaluation: Evaluation,
  params?: Partial<Params>,
  rules?: RulesConfig,
) => ActionPlan;

/** src/paypal/client.ts: export function createPayPalClient. 샌드박스 외 baseUrl이면 만들 때 예외 */
export type CreatePayPalClientFn = (env: PayPalEnv, deps: ClientDeps) => PayPalClient;

/** src/exec/execute.ts: export function executeMove */
export type ExecuteMoveFn = (input: ExecuteInput, deps: { call: PayPalCaller }) => Promise<ExecuteResult>;
