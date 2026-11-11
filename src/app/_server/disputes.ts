/**
 * 실제 분쟁 읽기 (T047, SPEC v2.6 9-4·9-5·10장). S5·S4·S1이 함께 쓴다.
 *
 * **조회만 한다.** 이 파일에는 PayPal로 POST를 보내는 코드가 없다 (`client.call`을 부르지 않는다).
 * 전송은 T009의 `_server/send.ts`가 맡고, "보내도 되는가"는 `_shared/demo-links.ts`의
 * `isLiveSendAllowed`가 답한다.
 *
 * **서버에서만 부른다** (PayPal·LLM 비밀값이 브라우저 묶음에 들어가지 않게).
 *
 * 읽는 순서 (지시서 T047):
 *  1. 분쟁 목록 → 연결 표의 `showOnScreen`으로 걸러 낸다 (연습용·시연 제외 분쟁은 여기서 빠진다).
 *     표에 있는데 목록에 없는 분쟁은 번호로 직접 읽는다 (방금 접수된 분쟁은 목록에 늦게 나온다).
 *  2. 이전 미수령 분쟁 수는 **걸러 낸 뒤의 목록**으로 센다 (안 빼면 서연이 1로 나온다).
 *  3. LLM은 규칙이 정하지 못한 보드에만 불린다 (`classifyDispute`가 규칙 먼저 본다).
 *  4. 돌려주는 값에 구매자 이메일·주소·`payer_id`·PayPal 응답 원문이 없다. 구매자 글은 `maskPersonal`을 거친다.
 *  5. 같은 요청 안에서 두 번 불려도 PayPal을 한 번만 읽는다 (`loadDemoDisputesForRequest`).
 *
 * 숫자를 만들지 않는다: 기대 손실·추천·위험 점수는 화면이 `src/engine/`을 불러 구한다. 이 파일은
 * 엔진이 받을 **입력**(보드·신호)까지만 만든다.
 *
 * `paypal.reason`·`llm.reason`은 고정 코드다 (`_shared/availability.ts`). 예외 문장을 싣지 않는다.
 */
import 'server-only';

import { cache } from 'react';

import { maskPersonal } from '@/ai/prompts/classify';
import { classifyDispute } from '@/ai/classify';
import { judgeTone } from '@/ai/tone';
import { buildEscalationSignals } from '@/engine/signals';
import { getDispute, listDisputes, type DisputeDetail, type DisputeSummary } from '@/paypal/disputes';
import { INR_REASON, buyerKeyOf, countPriorInrDisputes, toBoardState, toClassifyInput } from '@/paypal/mapper';
import type {
  BoardState,
  Cause,
  DemoLink,
  EscalationSignals,
  LlmCaller,
  PayPalClient,
  SeedBuyer,
  SeedCarrierEvent,
  SeedProduct,
} from '@/types';
import { carrierEventsFor, seedBuyers, seedDisputes, seedInquiries, seedOrders, seedProducts } from '../../../seed/index';

import type { Availability } from '../_shared/availability';
import { demoLinks, screenLinks, withoutDemoExcluded } from '../_shared/demo-links';
import type { DemoField, DisputeTimeline, LoadedDispute } from '../_shared/dispute-view';
import { getLlm, unavailableLlm } from './llm';
import { getPayPalClient } from './paypal';

/** 추적 정보 (실제 값). 분쟁 응답에는 없어서 밖에서 받는다. */
export type RealTracking = { hasTracking: boolean; hasDeliveredTracking: boolean };

export type LoadDemoDisputesDeps = {
  /** 가짜 PayPal 클라이언트 (단위·인수 테스트). 없으면 `getPayPalClient()`. */
  client?: PayPalClient;
  /** 가짜 LLM. 없으면 `getLlm()`. 쓸 수 없으면 규칙 결과만 쓴다. */
  llm?: LlmCaller;
  /** 연결 표. 없으면 `config/demo-links.json`. */
  links?: DemoLink[];
  /** 지금 시각 (ISO 8601). 확대 위험 신호에만 쓴다. 없으면 `new Date()`. */
  now?: string;
  /**
   * 분쟁이 걸린 주문의 **실제** 추적 등록 여부. PayPal 분쟁 응답에는 추적 정보가 없고, 실제 값은
   * 주문 상세(SPEC 9-3)를 읽어야 안다 — 이 작업은 분쟁만 조회하므로 기본값은 "없음"이다.
   * 서연 장면의 실제 분쟁이 걸린 주문 O13에는 추적번호가 없다 (SPEC 2장: 판매자가 등록을 빠뜨렸다).
   * 주문을 함께 읽는 화면(T016)은 이 함수로 실제 값을 넣는다.
   */
  realTracking?: (disputeId: string) => RealTracking;
};

export type { Availability };

export type LoadDemoDisputesResult = {
  /** 화면에 낼 분쟁. 연결 표 순서 (D1 → D2 → D3). */
  disputes: LoadedDispute[];
  /** PayPal을 읽을 수 있었는지. 거짓이면 화면은 `common.paypalUnavailable`을 보인다. */
  paypal: Availability;
  /** LLM을 쓸 수 있었는지. 거짓이면 화면은 `common.llmUnavailable`을 보인다. */
  llm: Availability;
};

/** 추적 정보를 모를 때의 값 (위 `realTracking` 설명 참고). */
const NO_TRACKING: RealTracking = { hasTracking: false, hasDeliveredTracking: false };

// ── 시드에서 가져오는 값 ─────────────────────────────────────────────────────

function seedDisputeOf(seedDisputeId: string | null) {
  return seedDisputeId === null ? undefined : seedDisputes.find((d) => d.id === seedDisputeId);
}

function buyerOf(buyerId: string | undefined): SeedBuyer | null {
  return buyerId === undefined ? null : (seedBuyers.find((b) => b.id === buyerId) ?? null);
}

function productOf(sku: string | undefined): SeedProduct | null {
  return sku === undefined ? null : (seedProducts.find((p) => p.sku === sku) ?? null);
}

/**
 * 시드에 적힌 같은 구매자의 이전 미수령(INR) 분쟁 수 (이번 건 제외). 시연용 값이다 —
 * buyer_m의 과거 미수령 분쟁 2건은 SPEC 10장 ③의 시연용 데이터다. 세기만 한다.
 */
function seedPriorInrDisputes(buyerId: string | undefined, seedDisputeId: string | null): number {
  if (buyerId === undefined) return 0;
  return seedDisputes.filter((d) => d.buyerId === buyerId && d.reason === INR_REASON && d.id !== seedDisputeId).length;
}

/** 배송사 이벤트에 배송 완료 기록이 있는지 (판정이 아니라 줄 읽기다). */
function deliveredIn(events: SeedCarrierEvent[]): boolean {
  return events.some((event) => event.status === 'delivered');
}

// ── 분쟁 상세에서 시각이 붙은 글 모으기 (확대 위험 신호용) ──────────────────

/** 시각을 읽을 수 있는 글만 모은다. 시각을 모르는 글은 시간 순서에 둘 수 없어 뺀다. */
function timedText(raw: string | undefined, text: string): { text: string; at: string } | null {
  if (raw === undefined || raw.trim() === '' || text.trim() === '') return null;
  return { text, at: raw };
}

/**
 * 구매자 글 (시각 포함). PayPal은 접수 글을 `messages`와 `evidences[].notes`에 **같은 글로 함께** 준다 —
 * `@/paypal/mapper`의 `buyerTexts`(T037)와 같은 규칙으로 한 번만 센다: 시각 순으로 늘어놓고,
 * 앞뒤 공백을 뺀 글이 같으면 먼저 오는 것 하나만 남긴다 (T047 보완 D-1).
 */
export function buyerMessagesWithTime(detail: DisputeDetail): { text: string; at: string }[] {
  const collected: { text: string; at: string; order: number }[] = [];
  for (const message of detail.messages) {
    if (message.posted_by.toUpperCase() !== 'BUYER') continue;
    const timed = timedText(message.time_posted, message.content);
    if (timed !== null) collected.push({ ...timed, order: collected.length });
  }
  for (const evidence of detail.evidences) {
    if ((evidence.source ?? '').toUpperCase() !== 'SUBMITTED_BY_BUYER') continue;
    const timed = timedText(evidence.date, evidence.notes ?? '');
    if (timed !== null) collected.push({ ...timed, order: collected.length });
  }

  const timeOf = (at: string): number => {
    const ms = Date.parse(at);
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms; // 읽을 수 없는 시각은 뒤로
  };
  const sorted = [...collected].sort((a, b) => {
    const diff = timeOf(a.at) - timeOf(b.at);
    return diff !== 0 && !Number.isNaN(diff) ? diff : a.order - b.order;
  });

  const seen = new Set<string>();
  const out: { text: string; at: string }[] = [];
  for (const { text, at } of sorted) {
    const key = text.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, at });
  }
  return out;
}

function sellerRepliesWithTime(detail: DisputeDetail): { at: string }[] {
  return detail.messages
    .filter((message) => message.posted_by.toUpperCase() === 'SELLER')
    .map((message) => timedText(message.time_posted, message.content))
    .filter((timed): timed is { text: string; at: string } => timed !== null)
    .map(({ at }) => ({ at }));
}

// ── 보드 하나 만들기 ────────────────────────────────────────────────────────

type BoardParts = { tracking: RealTracking; priorInr: number; trackingEvents: string[]; isDemo: boolean };

async function buildBoard(detail: DisputeDetail, parts: BoardParts, llm: LlmCaller): Promise<BoardState> {
  // 분류 입력에는 구매자 글 원문이 들어간다 (가리는 것은 분류기의 일, `src/paypal/mapper.ts`).
  // `classifyDispute`는 규칙으로 정해지면 LLM을 부르지 않고, 실패해도 예외 없이 needsReview로 내려간다.
  const cause: Cause = await classifyDispute(
    toClassifyInput(detail, {
      hasTracking: parts.tracking.hasTracking,
      hasDeliveredTracking: parts.tracking.hasDeliveredTracking,
      buyerPriorInrDisputes: parts.priorInr,
      trackingEvents: parts.trackingEvents,
    }),
    { llm },
  );

  return toBoardState(detail, {
    hasTracking: parts.tracking.hasTracking,
    hasDeliveredTracking: parts.tracking.hasDeliveredTracking,
    buyerPriorInrDisputes: parts.priorInr,
    isDemo: parts.isDemo,
    cause,
  });
}

// ── 확대 위험 신호 ──────────────────────────────────────────────────────────

type SignalPair = { signals: EscalationSignals | null; signalsAfterReply: EscalationSignals | null };

/**
 * 신호 두 벌: 지금 상태와 "판매자가 지금 답장했다고 볼 때".
 * 시각을 읽을 수 없는 값이 섞여 `buildEscalationSignals`가 거부하면 둘 다 `null`이다
 * (점수를 맞추려고 날짜를 지어내지 않는다).
 */
function buildSignalPair(
  buyerMessages: { text: string; at: string }[],
  sellerReplies: { at: string }[],
  now: string,
  disputeDueDate: string,
  angryTone: boolean | null,
): SignalPair {
  try {
    return {
      signals: buildEscalationSignals({ buyerMessages, sellerReplies, now, disputeDueDate, angryTone }),
      signalsAfterReply: buildEscalationSignals({
        buyerMessages,
        sellerReplies: [...sellerReplies, { at: now }],
        now,
        disputeDueDate,
        angryTone,
      }),
    };
  } catch {
    return { signals: null, signalsAfterReply: null };
  }
}

// ── 공개 함수 ───────────────────────────────────────────────────────────────

/**
 * 화면용 분쟁 묶음. PayPal을 읽을 수 없으면 예외 대신 빈 목록 + `paypal.ok === false`다.
 *
 * `client.call`(POST)은 부르지 않는다 — `client.get`만 쓴다.
 */
export async function loadDemoDisputes(deps: LoadDemoDisputesDeps = {}): Promise<LoadDemoDisputesResult> {
  const links = deps.links ?? demoLinks;
  const wanted = screenLinks(links);
  const now = deps.now ?? new Date().toISOString();
  const realTracking = deps.realTracking ?? (() => NO_TRACKING);

  // LLM: 쓸 수 없으면 늘 실패하는 호출기를 넣는다 (분류기·어조 판정이 규칙 결과로 내려간다)
  let llmAvailability: Availability = { ok: true };
  let llm: LlmCaller;
  if (deps.llm !== undefined) {
    llm = deps.llm;
  } else {
    const resolved = getLlm();
    llmAvailability = resolved.ok ? { ok: true } : { ok: false, reason: resolved.reason };
    llm = resolved.ok ? resolved.llm : unavailableLlm(resolved.reason);
  }

  // PayPal
  let client: PayPalClient;
  if (deps.client !== undefined) {
    client = deps.client;
  } else {
    const resolved = getPayPalClient();
    if (!resolved.ok) return { disputes: [], paypal: { ok: false, reason: resolved.reason }, llm: llmAvailability };
    client = resolved.client;
  }

  // 1. 목록 → 연결 표로 걸러 낸다. 걸러 낸 뒤의 목록만 아래에서 쓴다
  let onScreen: DisputeSummary[];
  try {
    onScreen = withoutDemoExcluded(await listDisputes(client), links);
  } catch {
    // 예외 문장은 싣지 않는다 (PayPal 응답 문장이 섞일 수 있다). 고정 코드만.
    return { disputes: [], paypal: { ok: false, reason: 'request_failed' }, llm: llmAvailability };
  }

  // 표에 있는 분쟁의 상세를 번호로 읽는다 (목록에 아직 없는 분쟁도 바로 나온다, SPEC 9-4).
  // 연습용·시연 제외 분쟁은 `wanted`에 없으므로 상세를 읽지도 않는다.
  const details = new Map<string, DisputeDetail>();
  const failed: string[] = [];
  for (const link of wanted) {
    try {
      details.set(link.paypalDisputeId, await getDispute(client, link.paypalDisputeId));
    } catch {
      // 한 건을 읽지 못해도 나머지는 보여 준다 (번호만 적는다 — 응답 값은 싣지 않는다)
      failed.push(link.paypalDisputeId);
    }
  }

  // 2. 이전 미수령 분쟁을 셀 목록: 걸러 낸 목록 + 목록에 없던 상세 (상세도 목록 항목의 모양을 담고 있다)
  const seenInList = new Set(onScreen.map((summary) => summary.dispute_id));
  const countingList: DisputeSummary[] = [
    ...onScreen,
    ...[...details.values()].filter((detail) => !seenInList.has(detail.dispute_id)),
  ];

  const disputes: LoadedDispute[] = [];
  for (const link of wanted) {
    const detail = details.get(link.paypalDisputeId);
    if (detail === undefined) continue;

    const seed = seedDisputeOf(link.seedDisputeId);
    const buyer = buyerOf(seed?.buyerId);
    const product = productOf(seed?.sku);

    // 구매자 식별자는 세는 데만 쓰고 돌려주는 값에는 넣지 않는다 (SPEC 10장)
    let priorInrReal = 0;
    try {
      priorInrReal = countPriorInrDisputes(countingList, buyerKeyOf(detail), detail.dispute_id);
    } catch {
      priorInrReal = 0; // 구매자를 가릴 수 없으면 세지 않는다
    }

    const trackingReal = realTracking(detail.dispute_id);
    const boardReal = await buildBoard(
      detail,
      { tracking: trackingReal, priorInr: priorInrReal, trackingEvents: [], isDemo: false },
      llm,
    );

    // 시연용으로 덧씌울 값 (T045 배송사 이벤트 + 시드의 이전 분쟁 기록)
    const carrierEvents = link.carrierOrderId === null ? [] : carrierEventsFor(link.carrierOrderId);
    const trackingDemo: RealTracking = {
      hasTracking: carrierEvents.length > 0 || trackingReal.hasTracking,
      hasDeliveredTracking: deliveredIn(carrierEvents) || trackingReal.hasDeliveredTracking,
    };
    // 실제로 센 값보다 적게 덧씌우지 않는다 (시연용 기록이 실제 기록을 지우지 않게)
    const priorInrDemo = Math.max(priorInrReal, seedPriorInrDisputes(seed?.buyerId, link.seedDisputeId));

    const demoFields: DemoField[] = [];
    if (carrierEvents.length > 0) demoFields.push('carrierEvents');
    if (trackingDemo.hasTracking !== trackingReal.hasTracking) demoFields.push('hasTracking');
    if (trackingDemo.hasDeliveredTracking !== trackingReal.hasDeliveredTracking) demoFields.push('hasDeliveredTracking');
    if (priorInrDemo !== priorInrReal) demoFields.push('buyerPriorInrDisputes');

    let boardDemo: BoardState | null = null;
    if (demoFields.length > 0) {
      boardDemo = await buildBoard(
        detail,
        {
          tracking: trackingDemo,
          priorInr: priorInrDemo,
          trackingEvents: carrierEvents.map((event) => event.text),
          isDemo: true,
        },
        llm,
      );
      if (boardDemo.cause?.subtype !== boardReal.cause?.subtype) demoFields.push('cause');
    }

    // 구매자 글: 화면·어조 판정에 쓰는 것은 가린 글이다 (원문은 분류 입력에만 들어간다)
    const buyerMessages = toClassifyInput(detail, {
      hasTracking: trackingReal.hasTracking,
      hasDeliveredTracking: trackingReal.hasDeliveredTracking,
      buyerPriorInrDisputes: priorInrReal,
      trackingEvents: [],
    }).buyerMessages.map(maskPersonal);

    // 확대 위험 신호: 실제 분쟁 글 + 이 구매자의 시연용 이전 문의 (SPEC 10장 ②)
    const earlierInquiries = seed === undefined ? [] : seedInquiries.filter((inquiry) => inquiry.buyerId === seed.buyerId);
    if (earlierInquiries.length > 0) demoFields.push('earlierInquiries');

    const signalMessages = [
      ...earlierInquiries.map((inquiry) => ({ text: inquiry.english, at: inquiry.date })),
      ...buyerMessagesWithTime(detail).map(({ text, at }) => ({ text: maskPersonal(text), at })),
    ];
    const { angryTone } = await judgeTone({ buyerMessages }, { llm });
    const { signals, signalsAfterReply } = buildSignalPair(
      signalMessages,
      sellerRepliesWithTime(detail),
      now,
      boardReal.dueDate,
      angryTone,
    );

    // 사건 기록 재료 (T076). 실제 값(샌드박스 시각)과 시드 주문일만 — 지어내지 않는다
    const seedOrder = seed === undefined ? undefined : seedOrders.find((order) => order.id === seed.orderId);
    const timeline: DisputeTimeline = {
      openedAt: detail.create_time ?? null,
      buyerMessages: buyerMessagesWithTime(detail).map(({ text, at }) => ({ text: maskPersonal(text), at })),
      sellerReplies: sellerRepliesWithTime(detail),
      orderDate: seedOrder?.date ?? null,
    };

    disputes.push({
      timeline,
      key: link.seedDisputeId ?? link.paypalDisputeId,
      disputeId: detail.dispute_id,
      statusCode: detail.status ?? '',
      buyer,
      product,
      buyerMessages,
      boardReal,
      boardDemo,
      demoFields,
      carrierEvents,
      signals,
      signalsAfterReply,
      liveSendAllowed: link.liveSendAllowed,
    });
  }

  const paypal: Availability = failed.length === 0 ? { ok: true } : { ok: true, reason: 'partial' };

  return { disputes, paypal, llm: llmAvailability };
}

/**
 * 한 요청 안에서 PayPal을 한 번만 읽는 입구 (S5는 화면과 답장 칸이 따로 부른다).
 * React의 `cache`가 같은 요청 안에서는 결과를 돌려쓴다. 인수가 없어야 같은 키가 되므로
 * 주입이 필요한 테스트는 `loadDemoDisputes`를 직접 부른다.
 */
export const loadDemoDisputesForRequest = cache(
  async (): Promise<LoadDemoDisputesResult> => loadDemoDisputes(),
);
