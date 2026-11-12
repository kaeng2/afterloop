/**
 * 일회성 확인 (T119 재시도, 분쟁 확인). GET만: 분쟁 목록 + 분쟁 1건 상세.
 * 출력: 상태·금액·거래 ID·메시지 글자 수와 첫 줄. 구매자 이름·이메일·주소·payer_id·Secret·토큰은 출력하지 않는다.
 */
import { loadSandboxEnv } from './env';
import { asArray, asRecord, asText, createSandboxClient, failureLine } from './paypal';

const DISPUTE_ID = 'PP-R-ZOK-10200237';
const ORDER_ID = '6R4577433P6975506';
const CAPTURE_ID = '0GS51093S92438905';

async function main(): Promise<void> {
  const client = createSandboxClient(loadSandboxEnv());

  const list = await client.get('/v1/customer/disputes?page_size=50');
  const items = asArray(asRecord(list.body).items).map(asRecord);
  console.log(`목록 HTTP ${list.status} · ${items.length}건`);
  console.log(`목록에 ${DISPUTE_ID} 있음: ${items.some((i) => asText(i.dispute_id) === DISPUTE_ID)}`);
  console.log(`목록 ID: ${items.map((i) => asText(i.dispute_id)).join(', ')}`);

  const res = await client.get(`/v1/customer/disputes/${DISPUTE_ID}`);
  console.log(`상세 HTTP ${res.status}`);
  const d = asRecord(res.body);
  for (const k of ['dispute_id', 'reason', 'status', 'dispute_state', 'dispute_life_cycle_stage', 'dispute_channel', 'create_time', 'update_time', 'seller_response_due_date', 'buyer_response_due_date']) {
    console.log(`${k}: ${asText(d[k]) || '(없음)'}`);
  }
  const amt = asRecord(d.dispute_amount);
  console.log(`dispute_amount: ${asText(amt.value)} ${asText(amt.currency_code)}`);
  const txs = asArray(d.disputed_transactions).map(asRecord);
  txs.forEach((t, i) => {
    const g = asRecord(t.gross_amount);
    console.log(`tx[${i}] seller_transaction_id=${asText(t.seller_transaction_id)} buyer_transaction_id=${asText(t.buyer_transaction_id)} status=${asText(t.transaction_status)} gross=${asText(g.value)} ${asText(g.currency_code)}`);
    console.log(`tx[${i}] capture(${CAPTURE_ID}) 일치: ${asText(t.seller_transaction_id) === CAPTURE_ID}`);
  });
  const msgs = asArray(d.messages).map(asRecord);
  console.log(`messages: ${msgs.length}건`);
  msgs.forEach((m, i) => {
    const c = asText(m.content);
    console.log(`msg[${i}] posted_by=${asText(m.posted_by)} time=${asText(m.time_posted)} 글자수=${c.length} 첫줄=${JSON.stringify(c.split('\n')[0].slice(0, 200))}`);
  });
  const ev = asArray(d.evidences).map(asRecord);
  console.log(`evidences: ${ev.length}건`);
  ev.forEach((e, i) => {
    const n = asText(e.notes);
    console.log(`ev[${i}] type=${asText(e.evidence_type)} source=${asText(e.source)} notes글자수=${n.length} 첫줄=${JSON.stringify(n.split('\n')[0].slice(0, 200))}`);
  });
  console.log(`(참고) 주문 ${ORDER_ID} 대응은 capture ID 일치로 판단`);
}

main().catch((e: unknown) => {
  console.error(failureLine(e));
  process.exitCode = 1;
});
