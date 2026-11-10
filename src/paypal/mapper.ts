/**
 * PayPal 분쟁 응답 → 엔진 입력 (SPEC v2.2 9-4장). 변환만 한다.
 *
 * 금액은 **문자열 자리 연산**으로 센트 정수를 만든다 (`"48.00"` → 4800). 부동소수 곱셈을 쓰지 않는다.
 * 새 금액·확률·비율을 계산하지 않는다 (그것은 `src/engine/`의 일이다).
 *
 * 모르는 값(단계·채널·통화)은 조용히 기본값으로 바꾸지 않고 예외다. 예외 문구에는 **필드 이름만** 싣고
 * 응답 값은 싣지 않는다 (구매자 정보가 섞여 나오지 않게, SPEC 10장).
 *
 * `BoardState`에는 구매자 이름·이메일·주소·메시지 원문이 들어가지 않는다. 구매자 식별은 `payer_id`뿐이다.
 * 메시지 원문이 필요한 분류 입력은 `toClassifyInput`만 만든다 (가리는 것은 분류기 T006의 일이다).
 */
import type { BoardState, Cause, ClassifyInput, MoveType } from '@/types';

import { type DisputeDetail, type DisputeLink, type DisputeSummary, parseDisputeDetail } from './disputes';

/** `BoardState['stage']`가 받는 값. 그 밖은 예외. */
const STAGES: readonly BoardState['stage'][] = ['INQUIRY', 'CHARGEBACK', 'PRE_ARBITRATION', 'ARBITRATION'];

/** `BoardState['channel']`가 받는 값. `EXTERNAL`(카드사 분쟁)은 오토파일럿이 건너뛴다. */
const CHANNELS: readonly BoardState['channel'][] = ['INTERNAL', 'EXTERNAL'];

/** `allowedMoves`의 고정 순서 (`MoveType` 선언 순서). 그 밖의 rel(`self`, `escalate` 등)은 버린다. */
const MOVE_ORDER: readonly MoveType[] = ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'];

/** 이 앱이 다루는 통화 (`BoardState['currency']`). */
const CURRENCY = 'USD';

/** 미수령(INR) 분쟁의 PayPal reason. `countPriorInrDisputes`가 센다. */
export const INR_REASON = 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED';

/** API 금액 꼴: 0 이상, 소수점 아래 두 자리까지. */
const AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

/** 센트로 바꾼 뒤 안전한 정수로 남는 자리수 상한. */
const MAX_AMOUNT_DIGITS = 15;

/** PayPal 응답에 없어 밖에서 받는 값 (추적은 주문 상세, 이전 분쟁 수는 목록, 원인은 분류기에서 온다). */
export type BoardExtra = {
  hasTracking: boolean;
  hasDeliveredTracking: boolean;
  buyerPriorInrDisputes: number;
  isDemo: boolean;
  cause?: Cause;
};

/** 분류 입력에서 밖에서 받는 값. `trackingEvents`는 택배사 이벤트 텍스트 (T011). */
export type ClassifyExtra = {
  hasTracking: boolean;
  hasDeliveredTracking: boolean;
  buyerPriorInrDisputes: number;
  trackingEvents: string[];
};

// ── 값 변환 ──────────────────────────────────────────────────────────────────

/**
 * API 금액 문자열 → 센트 정수. 자리를 이어 붙여 한 번만 정수로 읽는다 (부동소수 곱셈 금지).
 * `"48.00"` → 4800, `"35"` → 3500, `"0.07"` → 7, `"1234.5"` → 123450.
 */
export function apiValueToCents(value: unknown): number {
  if (typeof value !== 'string' || !AMOUNT_PATTERN.test(value)) {
    throw new Error('금액 꼴이 아니다 (소수점 아래 두 자리까지의 0 이상 숫자 문자열만 받는다)');
  }
  const [whole, fraction = ''] = value.split('.');
  const digits = `${whole}${fraction.padEnd(2, '0')}`;
  if (digits.length > MAX_AMOUNT_DIGITS) throw new Error('금액이 너무 크다');
  const cents = Number(digits);
  if (!Number.isSafeInteger(cents)) throw new Error('금액이 너무 크다');
  return cents;
}

/** 금액 객체 → 센트 정수. USD가 아니면 예외 (받은 통화 값은 싣지 않는다). */
function moneyToCents(money: { currency_code: string; value: string }, field: string): number {
  if (money.currency_code !== CURRENCY) {
    throw new Error(`${field}.currency_code가 ${CURRENCY}가 아니다 (이 앱은 ${CURRENCY}만 다룬다)`);
  }
  try {
    return apiValueToCents(money.value);
  } catch (error) {
    throw new Error(`${field}.value: ${error instanceof Error ? error.message : '금액을 읽을 수 없다'}`);
  }
}

function toStage(raw: string): BoardState['stage'] {
  const stage = STAGES.find((known) => known === raw);
  if (stage === undefined) {
    throw new Error(`모르는 dispute_life_cycle_stage (받는 값: ${STAGES.join(', ')})`);
  }
  return stage;
}

function toChannel(raw: string): BoardState['channel'] {
  const channel = CHANNELS.find((known) => known === raw);
  if (channel === undefined) {
    throw new Error(`모르는 dispute_channel (받는 값: ${CHANNELS.join(', ')})`);
  }
  return channel;
}

/** `links[].rel` → 허용된 수. 중복은 한 번만, 순서는 `MoveType` 선언 순서로 고정한다. */
export function toAllowedMoves(links: DisputeLink[]): MoveType[] {
  const rels = new Set(links.map((link) => link.rel));
  return MOVE_ORDER.filter((move) => rels.has(move));
}

/**
 * 응답 기한. `seller_response_due_date`가 없으면 `buyer_response_due_date`,
 * 둘 다 없으면 빈 문자열 (`BoardState['dueDate']`는 `string`이라 null을 담을 수 없다.
 * 화면·확대 위험은 빈 값을 "기한 없음"으로 읽는다. 날짜를 지어내지 않는다).
 */
function toDueDate(detail: DisputeDetail): string {
  const seller = detail.seller_response_due_date?.trim() ?? '';
  if (seller !== '') return seller;
  return detail.buyer_response_due_date?.trim() ?? '';
}

function requireBoolean(value: boolean, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`extra.${field}는 boolean이어야 한다`);
  return value;
}

function requireCount(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`extra.${field}는 0 이상의 정수여야 한다`);
  return value;
}

// ── 구매자 글 모으기 ────────────────────────────────────────────────────────

/** 구매자가 낸 증빙의 `source`. 판매자·PayPal이 낸 증빙의 `notes`는 구매자 글이 아니다. */
const BUYER_EVIDENCE_SOURCE = 'SUBMITTED_BY_BUYER';

/** 구매자 글 1건. `order`는 모은 순서(`messages` 먼저, 그다음 `evidences`)다. */
type BuyerText = { content: string; postedAt: number | null; order: number };

/** 시각 문자열 → 비교용 수. 없거나 읽을 수 없으면 null ("시각 없음"으로 본다). */
function postedAtOf(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = Date.parse(raw); // 문자열 비교 금지: `...25Z`와 `...25.608Z`가 거꾸로 선다
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * 구매자가 쓴 글. `messages`(`posted_by: BUYER`)와 `evidences`(`source: SUBMITTED_BY_BUYER`)를 함께 읽는다
 * (실제 분쟁에는 `messages` 키가 아예 없고 접수 글이 `evidences[].notes`에만 있는 건이 있다 — T037).
 *
 * 순서: 시각을 읽을 수 있는 글을 이른 것부터, 그 뒤에 시각 없는 글을 모은 순서대로. 시각이 같으면 모은 순서.
 * 같은 글(앞뒤 공백을 뺀 뒤 같은 문자열)은 먼저 오는 것만 남긴다. 같은 입력이면 항상 같은 순서가 나온다.
 */
function buyerTexts(detail: DisputeDetail): string[] {
  const collected: BuyerText[] = [];

  for (const message of detail.messages) {
    if (message.posted_by.toUpperCase() !== 'BUYER') continue;
    if (message.content.trim() === '') continue;
    collected.push({ content: message.content, postedAt: postedAtOf(message.time_posted), order: collected.length });
  }

  for (const evidence of detail.evidences) {
    if ((evidence.source ?? '').toUpperCase() !== BUYER_EVIDENCE_SOURCE) continue;
    const notes = evidence.notes ?? '';
    if (notes.trim() === '') continue;
    collected.push({ content: notes, postedAt: postedAtOf(evidence.date), order: collected.length });
  }

  const sorted = [...collected].sort((a, b) => {
    if (a.postedAt !== null && b.postedAt !== null && a.postedAt !== b.postedAt) return a.postedAt - b.postedAt;
    if (a.postedAt === null && b.postedAt !== null) return 1; // 시각 없는 글은 뒤로
    if (a.postedAt !== null && b.postedAt === null) return -1;
    return a.order - b.order; // 시각이 같거나 둘 다 없으면 모은 순서
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of sorted) {
    const key = text.content.trim();
    if (seen.has(key)) continue; // 같은 글이 `messages`·`evidences` 양쪽에 있으면 1건 (먼저 오는 것)
    seen.add(key);
    out.push(text.content);
  }
  return out;
}

// ── 공개 변환 함수 ───────────────────────────────────────────────────────────

/** 분쟁 상세 + 밖에서 받은 값 → `BoardState`. */
export function toBoardState(detail: DisputeDetail, extra: BoardExtra): BoardState {
  const d = parseDisputeDetail(detail); // 손으로 만든 값이 들어와도 꼴을 다시 확인한다

  const board: BoardState = {
    disputeId: d.dispute_id,
    reason: d.reason,
    stage: toStage(d.dispute_life_cycle_stage),
    channel: toChannel(d.dispute_channel),
    dueDate: toDueDate(d),
    amountCents: moneyToCents(d.dispute_amount, 'dispute_amount'),
    currency: CURRENCY,
    allowedMoves: toAllowedMoves(d.links),
    hasTracking: requireBoolean(extra.hasTracking, 'hasTracking'),
    hasDeliveredTracking: requireBoolean(extra.hasDeliveredTracking, 'hasDeliveredTracking'),
    buyerPriorInrDisputes: requireCount(extra.buyerPriorInrDisputes, 'buyerPriorInrDisputes'),
    isDemo: requireBoolean(extra.isDemo, 'isDemo'),
  };
  // 원인은 분류기(T006)가 정한다. 여기서는 받은 값을 옮기기만 한다.
  if (extra.cause !== undefined) board.cause = extra.cause;
  return board;
}

/**
 * 구매자 식별자. 이름·이메일은 쓰지 않는다 (SPEC 10장).
 * `disputed_transactions[].buyer.payer_id`가 없으면 예외.
 */
export function buyerKeyOf(dispute: DisputeDetail | DisputeSummary): string {
  for (const transaction of dispute.disputed_transactions) {
    const key = transaction.buyer?.payer_id;
    if (typeof key === 'string' && key.trim() !== '') return key;
  }
  throw new Error('구매자 식별자가 없다 (disputed_transactions[].buyer.payer_id)');
}

/**
 * 같은 구매자의 이전 미수령(INR) 분쟁 수 (이번 건 제외).
 * 다른 구매자·다른 reason은 세지 않고, 같은 분쟁이 여러 쪽에 겹쳐 와도 한 번만 센다.
 */
export function countPriorInrDisputes(disputes: DisputeSummary[], buyerKey: string, currentDisputeId: string): number {
  if (typeof buyerKey !== 'string' || buyerKey.trim() === '') {
    throw new Error('buyerKey가 비어 있다 (구매자를 가릴 수 없으면 세지 않는다)');
  }

  const counted = new Set<string>();
  for (const dispute of disputes) {
    if (dispute.dispute_id === currentDisputeId) continue;
    if (dispute.reason !== INR_REASON) continue;
    const sameBuyer = dispute.disputed_transactions.some((t) => t.buyer?.payer_id === buyerKey);
    if (!sameBuyer) continue;
    counted.add(dispute.dispute_id);
  }
  return counted.size;
}

/**
 * 분류 입력 (`ClassifyInput`). 구매자 글 원문이 들어가는 유일한 변환이다
 * (`messages`와 `evidences[].notes`를 함께 읽는다 — `buyerTexts`).
 * 개인통관고유부호 모양(`P` + 숫자 12자리)도 가리지 않고 그대로 넘긴다 (가리는 것은 분류기 T006의 일).
 * 이 값은 로그에 남기지 않는다.
 */
export function toClassifyInput(detail: DisputeDetail, extra: ClassifyExtra): ClassifyInput {
  const d = parseDisputeDetail(detail);

  if (!Array.isArray(extra.trackingEvents) || extra.trackingEvents.some((e) => typeof e !== 'string')) {
    throw new Error('extra.trackingEvents는 문자열 배열이어야 한다');
  }

  return {
    reason: d.reason,
    buyerMessages: buyerTexts(d),
    trackingEvents: [...extra.trackingEvents],
    hasTracking: requireBoolean(extra.hasTracking, 'hasTracking'),
    hasDeliveredTracking: requireBoolean(extra.hasDeliveredTracking, 'hasDeliveredTracking'),
    buyerPriorInrDisputes: requireCount(extra.buyerPriorInrDisputes, 'buyerPriorInrDisputes'),
  };
}
