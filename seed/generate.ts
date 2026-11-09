/**
 * `npm run seed` — 시드 파일을 다시 만들고 zod로 검증한 뒤 요약을 출력한다 (T007).
 *
 * DB 적재는 하지 않는다 (배포 작업 T025).
 * 결정적이다: 두 번 실행해도 같은 파일이 나온다.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildSeed } from './data';
import {
  disputeOrderProblems,
  seedBuyersSchema,
  seedDisputesSchema,
  seedInquiriesSchema,
  seedOrdersSchema,
  seedProductsSchema,
} from './schemas';

const SEED_DIR = path.resolve(__dirname);

/** 파일마다 zod 검증 후 쓴다. 줄 끝 개행 하나, 들여쓰기 2칸 (두 번 실행해도 바이트가 같다) */
function writeChecked<T>(file: string, rows: unknown, schema: { parse: (v: unknown) => T }): T {
  const parsed = schema.parse(rows);
  writeFileSync(path.join(SEED_DIR, file), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  return parsed;
}

const countBy = <T>(rows: T[], key: (t: T) => string): Record<string, number> =>
  rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [key(r)]: (acc[key(r)] ?? 0) + 1 }), {});

const asMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function main(): void {
  const seed = buildSeed();

  const products = writeChecked('products.json', seed.products, seedProductsSchema);
  const buyers = writeChecked('buyers.json', seed.buyers, seedBuyersSchema);
  const inquiries = writeChecked('inquiries.json', seed.inquiries, seedInquiriesSchema);
  const disputes = writeChecked('disputes.json', seed.disputes, seedDisputesSchema);
  const orders = writeChecked('orders.json', seed.orders, seedOrdersSchema);

  const problems = disputeOrderProblems(disputes, orders);
  if (problems.length > 0) throw new Error(`분쟁 → 주문 연결이 어긋났다:\n  ${problems.join('\n  ')}`);

  const closedLossCents = disputes.reduce((sum, d) => sum + (d.lossCents ?? 0), 0);
  const tracked = orders.filter((o) => o.tracked).length;
  const orderDates = orders.map((o) => o.date).sort();
  const byMonth = countBy(orders, (o) => o.date.slice(0, 7));

  const lines = [
    'seed 다시 생성 완료 (원문 6장, SPEC v2.2)',
    `  products.json   ${products.length}건  ${products.map((p) => `${p.sku} ${asMoney(p.priceCents)}`).join(' · ')}`,
    `  buyers.json     ${buyers.length}건  샌드박스 ${buyers.filter((b) => b.sandbox).length}명`,
    `  inquiries.json  ${inquiries.length}건  (표 8 + 자동 생성 ${inquiries.length - 8})`,
    `  disputes.json   ${disputes.length}건  진행 중 ${disputes.filter((d) => d.status === 'open').length} · 종결 ${disputes.filter((d) => d.status === 'closed').length} · 종결 손실 합 ${closedLossCents}¢ (${asMoney(closedLossCents)})`,
    `  orders.json     ${orders.length}건  샌드박스 ${orders.filter((o) => o.source === 'sandbox').length} · 시드 ${orders.filter((o) => o.source === 'seed').length}`,
    `  주문 상품별      ${Object.entries(countBy(orders, (o) => o.sku)).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
    `  주문 국가별      ${Object.entries(countBy(orders, (o) => o.country)).map(([k, v]) => `${k} ${v}`).join(' · ')}`,
    `  추적 등록        ${tracked} / ${orders.length} (${((tracked / orders.length) * 100).toFixed(1)}%)`,
    `  주문일           ${orderDates[0]} ~ ${orderDates[orderDates.length - 1]}  월별 ${Object.entries(byMonth).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}`,
    `  분쟁 → 주문      ${disputes.map((d) => `${d.id} ${d.orderId}`).join(' · ')}`,
  ];
  console.log(lines.join('\n'));
}

main();
