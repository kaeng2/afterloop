/**
 * 시안 v6 표시용 데이터 스키마 (T121, SPEC v2.16). `seed/demo-display.json`의 모양.
 *
 * 계약(`src/types.ts`)에 없는 시드 전용 모양이다. 전부 Demo data(`isDemo: true`). 계산 필드(위험 %·금액 기대값)는 없다.
 */
import { z } from 'zod';
import type { SeedBuyer, SeedDispute, SeedOrder } from '@/types';
import { countrySchema } from './schemas';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 한다');
const text = z.string().min(1);
const buyerId = z.string().regex(/^B\d{2}$/);

export const demoHistoryLineSchema = z
  .object({
    date: isoDate,
    actor: z.enum(['sys', 'bad', 'buyer']),
    text,
    textKo: text,
    flag: text.optional(),
    flagKo: text.optional(),
    /** "Before DisputeLess" 칩은 판매자 실수 줄(`actor: 'bad'`)에만 */
    merchantMistake: z.boolean(),
    /** 'paypal' = 실제 PayPal 값이 이 줄을 대신한다 (시드 문장은 실제 글이 없을 때만 쓴다) */
    source: z.enum(['seed', 'paypal']),
  })
  .strict();

export const demoOrderLabelSchema = z
  .object({
    key: z.enum(['seoyeon', 'jiho', 'mike']),
    displayNo: z.string().regex(/^#\d{4}$/),
    /** 보조 줄에 남길 PayPal 분쟁 번호. 아직 연결 전이면 null */
    paypalRef: z.string().regex(/^PP-R-[A-Z]{3}-\d+$/).nullable(),
    seedDisputeId: z.string().regex(/^D[1-9]$/).nullable(),
    orderId: z.string().regex(/^O\d{2}$/).nullable(),
    buyerId,
    /** 화면에 보이는 상품 (시안 표기). 실제 시드 주문의 상품과 다를 수 있다 */
    displaySku: text,
    buyerLabel: text,
    buyerLabelKo: text,
    productName: text,
    productNameKo: text,
    category: text,
    categoryKo: text,
  })
  .strict();

export const demoPreventRowSchema = z
  .object({
    key: z.enum(['tracking', 'customs-id']),
    count: z.number().int().positive(),
    line: text,
    lineKo: text,
    who: text,
    whoKo: text,
    /** 실제로 추적 등록을 하는 시드 주문. 표시 건수(`count`)와 다를 수 있다 */
    realTrackingTargets: z.array(z.string().regex(/^O\d{2}$/)),
  })
  .strict();

export const demoItemSchema = z
  .object({
    key: z.enum(['lena', 'yuki']),
    displayNo: z.string().regex(/^#\d{4}$/),
    /** PayPal 사건이 아니다 */
    paypalRef: z.null(),
    buyerId,
    displaySku: text,
    country: countrySchema,
    category: text,
    categoryKo: text,
    buyerLabel: text,
    buyerLabelKo: text,
    body: text,
    bodyKo: text,
    action: text,
    actionKo: text,
    // Lena
    refundCents: z.number().int().positive().optional(),
    promisedDate: isoDate.optional(),
    title: text.optional(),
    titleKo: text.optional(),
    // Yuki
    aiAnswer: text.optional(),
    aiAnswerKo: text.optional(),
  })
  .strict();

export const demoDisplaySchema = z
  .object({
    version: text,
    note: text,
    isDemo: z.literal(true),
    seoyeonHistory: z.array(demoHistoryLineSchema).length(8),
    orderLabels: z.array(demoOrderLabelSchema),
    jihoPurchase: z
      .object({ orderDate: isoDate, returnWindowDays: z.number().int().positive(), weeksAgo: z.number().int().positive() })
      .strict(),
    productNames: z
      .array(z.object({ sku: text, key: z.enum(['cardigan', 'sweater', 'coat', 'beanie']), name: text, nameKo: text }).strict())
      .length(4),
    guestLabels: z.array(z.object({ buyerId, label: text, labelKo: text }).strict()),
    preventRows: z.array(demoPreventRowSchema),
    demoItems: z.array(demoItemSchema),
  })
  .strict();

export type DemoDisplay = z.infer<typeof demoDisplaySchema>;
export type DemoHistoryLine = z.infer<typeof demoHistoryLineSchema>;

/**
 * 표시용 데이터 ↔ 실제 시드 맞물림. 어긋난 줄마다 메시지를 돌려준다 (빈 배열이면 통과).
 * ① 판매자 실수 칩은 `bad` 줄에만 ② 날짜 오름차순 ③ 가리키는 구매자·주문·분쟁·상품이 있다
 * ④ 실제 추적 등록 대상은 시드에서 추적 미등록인 주문이다 ⑤ 지호 구매일은 시연일(2026-11-10) 5주 전·반품 기간 지남.
 */
export function demoDisplayProblems(
  d: DemoDisplay,
  orders: readonly SeedOrder[],
  buyers: readonly SeedBuyer[],
  disputes: readonly SeedDispute[],
): string[] {
  const problems: string[] = [];
  const orderIds = new Set(orders.map((o) => o.id));
  const buyerIds = new Set(buyers.map((b) => b.id));
  const skus = new Set(d.productNames.map((p) => p.sku));

  let last = '';
  for (const h of d.seoyeonHistory) {
    if (h.date < last) problems.push(`기록 ${h.date}: 앞 줄보다 앞이다`);
    last = h.date;
    if (h.merchantMistake !== (h.actor === 'bad')) problems.push(`기록 ${h.date}: 판매자 실수 칩은 bad 줄에만 (${h.actor})`);
    if ((h.flag === undefined) !== (h.flagKo === undefined)) problems.push(`기록 ${h.date}: flag와 flagKo는 같이 있어야 한다`);
  }
  for (const l of d.orderLabels) {
    if (!buyerIds.has(l.buyerId)) problems.push(`${l.key}: 구매자 ${l.buyerId}이 없다`);
    if (!skus.has(l.displaySku)) problems.push(`${l.key}: 상품 ${l.displaySku}이 없다`);
    if (l.orderId !== null && !orderIds.has(l.orderId)) problems.push(`${l.key}: 주문 ${l.orderId}이 없다`);
    if (l.seedDisputeId !== null && !disputes.some((x) => x.id === l.seedDisputeId)) problems.push(`${l.key}: 분쟁 ${l.seedDisputeId}이 없다`);
  }
  for (const i of d.demoItems) {
    if (!buyerIds.has(i.buyerId)) problems.push(`${i.key}: 구매자 ${i.buyerId}이 없다`);
    if (!skus.has(i.displaySku)) problems.push(`${i.key}: 상품 ${i.displaySku}이 없다`);
  }
  for (const r of d.preventRows) {
    for (const id of r.realTrackingTargets) {
      const o = orders.find((x) => x.id === id);
      if (!o) problems.push(`${r.key}: 주문 ${id}이 없다`);
      else if (o.tracked) problems.push(`${r.key}: ${id}는 이미 추적 등록이라 대상이 아니다`);
    }
  }
  const days = Math.round((Date.parse('2026-11-10') - Date.parse(d.jihoPurchase.orderDate)) / 86_400_000);
  if (days !== d.jihoPurchase.weeksAgo * 7) problems.push(`지호 구매일이 시연일 ${d.jihoPurchase.weeksAgo}주 전이 아니다 (${days}일)`);
  if (days <= d.jihoPurchase.returnWindowDays) problems.push('지호 구매일이 반품 기간 안이다 (시안은 30일 지남)');
  return problems;
}
