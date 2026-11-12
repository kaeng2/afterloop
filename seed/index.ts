/**
 * 화면·테스트가 쓰는 시드 데이터 입구 (T007).
 *
 * JSON 파일을 그대로 읽고 zod로 한 번 검증해서 돌려준다. 값을 고치거나 계산하지 않는다.
 * `source: 'seed'` 행에는 화면이 'Demo data' 배지를 붙인다 (SPEC 10장).
 */
import type { SeedBuyer, SeedCarrierEvent, SeedDispute, SeedInquiry, SeedOrder, SeedProduct } from '@/types';
import buyersJson from './buyers.json';
import carrierEventsJson from './carrier-events.json';
import demoDisplayJson from './demo-display.json';
import { type DemoDisplay, demoDisplaySchema } from './demo-schema';
import disputesJson from './disputes.json';
import inquiriesJson from './inquiries.json';
import ordersJson from './orders.json';
import productsJson from './products.json';
import {
  seedBuyersSchema,
  seedCarrierEventsSchema,
  seedDisputesSchema,
  seedInquiriesSchema,
  seedOrdersSchema,
  seedProductsSchema,
} from './schemas';

export const seedProducts: SeedProduct[] = seedProductsSchema.parse(productsJson);
export const seedBuyers: SeedBuyer[] = seedBuyersSchema.parse(buyersJson);
export const seedInquiries: SeedInquiry[] = seedInquiriesSchema.parse(inquiriesJson);
export const seedDisputes: SeedDispute[] = seedDisputesSchema.parse(disputesJson);
export const seedOrders: SeedOrder[] = seedOrdersSchema.parse(ordersJson);

/**
 * 시연용 배송사 추적 이벤트 (v2.5, SPEC 12장). PayPal 데이터가 아니라 시연용이고 전부
 * `isDemo: true`다 — 화면은 이 줄에 늘 'Demo data' 배지를 붙인다 (SPEC 10장).
 */
export const seedCarrierEvents: SeedCarrierEvent[] = seedCarrierEventsSchema.parse(carrierEventsJson);

/**
 * 시안 v6 표시용 데이터 (T121, SPEC v2.16). 전부 Demo data. 서연 기록 8줄·표시용 주문 번호(#1042·#1038·#1047, PP-R-… 보조)·
 * 상품·손님 표기·예방 줄·데모 항목(Lena #1029·Yuki #1051). 옮기기만 한다 — 위험·금액 계산은 엔진.
 */
export const seedDemoDisplay: DemoDisplay = demoDisplaySchema.parse(demoDisplayJson);

/** 시드 행인지 (화면 'Demo data' 배지) */
export const isDemoRow = (row: { source: 'sandbox' | 'seed' }): boolean => row.source === 'seed';

/**
 * 한 주문의 배송사 이벤트를 날짜순으로 돌려준다. 그 주문의 이벤트가 없으면 빈 배열이다.
 * 옮기기만 한다 — 판정·계산은 하지 않는다 (분류는 ai 레인, 숫자는 engine 레인).
 */
export const carrierEventsFor = (orderId: string): SeedCarrierEvent[] =>
  seedCarrierEvents.filter((e) => e.orderId === orderId).sort((a, b) => a.date.localeCompare(b.date));
