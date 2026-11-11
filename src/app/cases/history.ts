/**
 * 사건 기록 (T076, SPEC v2.11 2장 "사건 기록", 계약 9부 `CaseEvent`). **순수 함수만 둔다** (DOM·네트워크·시계 없음).
 *
 * **실제 데이터에서만 만든다 — 없는 사건을 넣지 않는다.** 들어오는 것:
 * - 주문일: 시드 주문(`SeedOrder.date`) → `order_paid`, source `seed` (날짜를 시드 파일이 정했다)
 * - 발송·배송사 기록: 시드 배송사 이벤트 → 첫 `shipped`는 `shipped`, 나머지는 `carrier_event`, source `seed` (Demo data)
 * - PayPal 추적 없음: 실제 보드(`boardReal.hasTracking === false`)일 때 한 줄, source `sandbox`. 날짜는 발송일
 *   (발송 기록이 없으면 주문일. 둘 다 없으면 넣지 않는다 — 날짜를 지어내지 않는다)
 * - 구매자 글: 시드 문의(source `seed`, 날짜 그대로) + 샌드박스 분쟁 글(source `sandbox`, 게시 시각 그대로).
 *   같은 글이면 샌드박스 것 하나만 (`caseMessages`와 같은 규칙: 가린 글이 같으면 같은 글)
 * - 판매자 답장: 샌드박스 분쟁의 판매자 글 시각 (source `sandbox`). 글 내용은 싣지 않는다
 * - 분쟁 접수: 샌드박스 분쟁 `create_time` (source `sandbox`)
 *
 * 표시(`flags`)도 데이터·기존 판정에서만: `threat` = 엔진 카드사 낱말(`CARD_COMPANY_TERMS`)이 글에 있음,
 * `angry` = AI 어조 판정(`signals.angryTone`)이 참일 때 마지막 실제 구매자 글, `unanswered` = 그 뒤에 판매자 답장이 없음.
 *
 * 날짜 차(접수 뒤 며칠, 기록이 며칠에 걸쳤나, 답이 며칠 늦었나)는 달력 날짜 빼기만 한다 (돈·확률 계산이 아니다).
 */
import { maskPersonal } from '@/ai/prompts/classify';
import { CARD_COMPANY_TERMS } from '@/engine/signals';
import type { CaseEvent, CaseEventKind, SeedCarrierEvent } from '@/types';

import { t } from '../_shared/copy';
import type { LoadedDispute } from '../_shared/dispute-view';

/** 사건 기록을 만들 재료 (서버가 읽은 값). */
export type CaseHistoryInput = {
  /** 시드 주문일 (`YYYY-MM-DD`). 모르면 `null`. */
  orderDate: string | null;
  /** 시드 배송사 이벤트 (Demo data). */
  carrierEvents: readonly SeedCarrierEvent[];
  /** 실제 보드의 추적 등록 여부 (PayPal). 모르면 `null` → 추적 없음 줄을 넣지 않는다. */
  hasTrackingInPayPal: boolean | null;
  /** 같은 구매자의 시드 문의 (Demo data). */
  inquiries: readonly { date: string; original: string; english: string }[];
  /** 샌드박스 분쟁의 구매자 글 (가린 글, 게시 시각). */
  buyerMessages: readonly { text: string; at: string }[];
  /** 샌드박스 분쟁의 판매자 글 시각. */
  sellerReplies: readonly { at: string }[];
  /** 샌드박스 분쟁 접수 시각. 모르면 `null`. */
  openedAt: string | null;
  /** AI 어조 판정 (`EscalationSignals.angryTone`). */
  angryTone: boolean | null;
};

const MS_PER_DAY = 86_400_000;

/** 정렬용 시각. 날짜만 있으면 그 날 0시 UTC. 읽을 수 없으면 `null`. */
function timeOf(at: string): number | null {
  const ms = Date.parse(at.length === 10 ? `${at}T00:00:00Z` : at);
  return Number.isNaN(ms) ? null : ms;
}

/** 날짜만 (`YYYY-MM-DD`)인 값은 그 날 0시 UTC ISO로 (계약: `at`은 ISO 날짜시각). */
function isoOf(at: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(at) ? `${at}T00:00:00.000Z` : at;
}

const sameText = (a: string, b: string): boolean => maskPersonal(a).trim() === maskPersonal(b).trim();

function mentionsCardCompany(text: string): boolean {
  const lower = text.toLowerCase();
  return CARD_COMPANY_TERMS.some((term) => term !== '' && lower.includes(term.toLowerCase()));
}

/** 한 줄 글자 (영어, 사실 그대로). 문구 파일 `case.history.event.*`에서 읽는다. */
const line = (kind: Exclude<CaseEventKind, 'carrier_event' | 'buyer_message'>): string => t(`case.history.event.${kind}`);

/**
 * 사건 기록 (시각 순). 같은 시각이면 넣은 순서 (주문 → 발송 → 추적 없음 → 배송사 → 글 → 접수).
 * 시각을 읽을 수 없는 값은 넣지 않는다.
 */
export function buildCaseEvents(input: CaseHistoryInput): CaseEvent[] {
  const events: (CaseEvent & { order: number })[] = [];
  const push = (event: CaseEvent) => {
    if (timeOf(event.at) === null) return;
    events.push({ ...event, at: isoOf(event.at), order: events.length });
  };

  if (input.orderDate !== null) push({ at: input.orderDate, kind: 'order_paid', source: 'seed', text: line('order_paid') });

  const carrier = [...input.carrierEvents].sort((a, b) => a.date.localeCompare(b.date));
  const shipped = carrier.find((event) => event.status === 'shipped') ?? null;
  if (shipped !== null) push({ at: shipped.date, kind: 'shipped', source: 'seed', text: line('shipped') });

  if (input.hasTrackingInPayPal === false) {
    const at = shipped?.date ?? input.orderDate;
    if (at !== null && at !== undefined) push({ at, kind: 'tracking_missing', source: 'sandbox', text: line('tracking_missing') });
  }

  for (const event of carrier) {
    if (event === shipped) continue;
    push({ at: event.date, kind: 'carrier_event', source: 'seed', text: t('case.history.event.carrier_event', { text: event.text }) });
  }

  // 구매자 글: 시드 문의 중 실제 글과 같은 것은 뺀다 (실제 것이 남는다)
  const seededMessages = input.inquiries.filter(
    (inquiry) => !input.buyerMessages.some((message) => sameText(message.text, inquiry.original)),
  );
  const buyer: { at: string; source: CaseEvent['source']; english: string; original: string }[] = [
    ...seededMessages.map((inquiry) => ({
      at: inquiry.date,
      source: 'seed' as const,
      english: inquiry.english,
      original: inquiry.original,
    })),
    ...input.buyerMessages.map((message) => ({
      at: message.at,
      source: 'sandbox' as const,
      english: message.text,
      original: message.text,
    })),
  ];
  const replyTimes = input.sellerReplies.map((reply) => timeOf(reply.at)).filter((ms): ms is number => ms !== null);
  const lastSandboxBuyer = [...input.buyerMessages]
    .map((message) => timeOf(message.at))
    .filter((ms): ms is number => ms !== null)
    .sort((a, b) => a - b)
    .pop();

  for (const message of buyer) {
    const ms = timeOf(message.at);
    if (ms === null) continue;
    const flags: NonNullable<CaseEvent['flags']> = [];
    if (mentionsCardCompany(message.original) || mentionsCardCompany(message.english)) flags.push('threat');
    if (input.angryTone === true && message.source === 'sandbox' && ms === lastSandboxBuyer) flags.push('angry');
    if (!replyTimes.some((reply) => reply > ms)) flags.push('unanswered');
    push({
      at: message.at,
      kind: 'buyer_message',
      source: message.source,
      text: t('case.history.event.buyer_message', { text: maskPersonal(message.english).trim() }),
      ...(flags.length === 0 ? {} : { flags }),
    });
  }

  for (const reply of input.sellerReplies) push({ at: reply.at, kind: 'seller_reply', source: 'sandbox', text: line('seller_reply') });

  if (input.openedAt !== null) push({ at: input.openedAt, kind: 'dispute_opened', source: 'sandbox', text: line('dispute_opened') });

  return events
    .sort((a, b) => (timeOf(a.at) ?? 0) - (timeOf(b.at) ?? 0) || a.order - b.order)
    .map((event): CaseEvent => {
      const copy: CaseEvent & { order?: number } = { ...event };
      delete copy.order;
      return copy;
    });
}

/**
 * 화면이 받은 분쟁 1건(`LoadedDispute`)의 사건 기록. 시드 문의는 그 구매자의 것만, `demoFields`에
 * `earlierInquiries`가 있을 때만 넣는다 (대화 말풍선과 같은 규칙).
 */
export function caseEventsFor(
  loaded: Pick<LoadedDispute, 'buyer' | 'carrierEvents' | 'boardReal' | 'demoFields' | 'signals' | 'timeline' | 'trackingUnknown'>,
  inquiries: readonly { date: string; buyerId: string; original: string; english: string }[],
): CaseEvent[] {
  const buyerId = loaded.buyer?.id ?? null;
  const own =
    buyerId === null || !loaded.demoFields.includes('earlierInquiries')
      ? []
      : inquiries.filter((inquiry) => inquiry.buyerId === buyerId);
  return buildCaseEvents({
    orderDate: loaded.timeline?.orderDate ?? null,
    carrierEvents: loaded.carrierEvents,
    hasTrackingInPayPal: loaded.trackingUnknown === true ? null : loaded.boardReal.hasTracking,
    inquiries: own,
    buyerMessages: loaded.timeline?.buyerMessages ?? [],
    sellerReplies: loaded.timeline?.sellerReplies ?? [],
    openedAt: loaded.timeline?.openedAt ?? null,
    angryTone: loaded.signals?.angryTone ?? null,
  });
}

/** 두 시각 사이 달력 날 수 (UTC 날짜 기준, 0 이상). 읽을 수 없으면 `null`. */
export function daysBetween(from: string, to: string): number | null {
  const a = timeOf(from.slice(0, 10));
  const b = timeOf(to.slice(0, 10));
  if (a === null || b === null) return null;
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
}

/** "N events · D days" 의 D: 첫 사건부터 오늘까지. 사건이 없으면 `null`. */
export function historySpanDays(events: readonly CaseEvent[], now: string): number | null {
  const first = events[0];
  return first === undefined ? null : daysBetween(first.at, now);
}

/**
 * 판매자 응답이 늦은 날 수 (`ReplyForecastInput.delayDays`): 마지막 판매자 답장 뒤 **첫** 구매자 글부터 오늘까지.
 * 답장 뒤 구매자 글이 없으면 0. 사건 기록(`buildCaseEvents`)에서만 센다.
 */
export function unansweredDays(events: readonly CaseEvent[], now: string): number {
  const lastReply = [...events].reverse().find((event) => event.kind === 'seller_reply');
  const lastReplyMs = lastReply === undefined ? null : timeOf(lastReply.at);
  const firstWaiting = events.find(
    (event) => event.kind === 'buyer_message' && (lastReplyMs === null || (timeOf(event.at) ?? 0) > lastReplyMs),
  );
  if (firstWaiting === undefined) return 0;
  return daysBetween(firstWaiting.at, now) ?? 0;
}
