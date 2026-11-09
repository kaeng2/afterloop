/**
 * 화면·테스트가 쓰는 시드 데이터 입구 (T007).
 *
 * JSON 파일을 그대로 읽고 zod로 한 번 검증해서 돌려준다. 값을 고치거나 계산하지 않는다.
 * `source: 'seed'` 행에는 화면이 'Demo data' 배지를 붙인다 (SPEC 10장).
 */
import type { SeedBuyer, SeedDispute, SeedInquiry, SeedOrder, SeedProduct } from '@/types';
import buyersJson from './buyers.json';
import disputesJson from './disputes.json';
import inquiriesJson from './inquiries.json';
import ordersJson from './orders.json';
import productsJson from './products.json';
import {
  seedBuyersSchema,
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

/** 시드 행인지 (화면 'Demo data' 배지) */
export const isDemoRow = (row: { source: 'sandbox' | 'seed' }): boolean => row.source === 'seed';
