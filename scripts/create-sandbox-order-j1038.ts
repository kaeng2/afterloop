/**
 * `npm run sandbox:order-j1038` — 지호 품질 사례용 새 샌드박스 주문 1건 (T119, SPEC v2.16).
 *
 *   주문   : Knit Cardigan (`seed/products.json`의 FK-CD-OAT 이름·가격), USD, intent CAPTURE, 추적번호 등록 안 함.
 *   호출   : `POST /v2/checkout/orders` 딱 1회. `PayPal-Request-Id` = `afterloop-order-J1038` (고정 — 다시 실행해도 중복 생성 안 됨).
 *   출력   : 주문 ID·승인 링크를 `seed/sandbox-links.md`에 적는다. manifest는 건드리지 않는다 (O20을 넣으면 앱의 추적 등록 대상에 잡혀 T060·T067이 깨진다).
 *   안 함  : 승인·캡처·추적 등록·분쟁 호출. 승인은 사람이 한다.
 *   가드   : `seed/sandbox-links.md`가 이미 있으면 호출하지 않는다. 응답 승인 링크가 샌드박스 도메인이 아니면 파일에 쓰지 않고 멈춘다.
 *
 * 비밀값은 출력하지 않는다 (`.env`는 `loadSandboxEnv`가 런타임에만 읽는다).
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import productsJson from '../seed/products.json';
import { amountText, approveUrlFrom, approveUrlKind, buildOrderBody, type OrderSpec } from './create-sandbox-orders';
import { ROOT, SandboxEnvError, loadSandboxEnv } from './sandbox/env';
import { asRecord, asText, createSandboxClient, errorSummary, failureLine } from './sandbox/paypal';
import type { PayPalEnv } from '@/types';

export const J1038_KEY = 'O20';
export const J1038_REQUEST_ID = 'afterloop-order-J1038';
export const J1038_SKU = 'FK-CD-OAT';
export const linksPath = (root: string = ROOT): string => path.join(root, 'seed/sandbox-links.md');

export function j1038Spec(products: unknown = productsJson): OrderSpec {
  const product = (Array.isArray(products) ? products : []).map(asRecord).find((p) => p.sku === J1038_SKU);
  const cents = product?.priceCents;
  if (product === undefined || typeof cents !== 'number') throw new Error(`seed/products.json에 ${J1038_SKU}가 없다.`);
  return { key: J1038_KEY, buyer: 'jiho', sku: J1038_SKU, itemName: asText(product.itemName), amount: amountText(cents), tracked: false };
}

export function renderLinks(orderId: string, approveUrl: string, spec: OrderSpec): string {
  return [
    '# 샌드박스 승인 링크 (지호 품질 사례, 표시 번호 #1038)',
    '',
    '승인은 사람이 한다. 링크는 `sandbox.paypal.com` 도메인이다 — 다른 도메인(특히 live `www.paypal.com`)이 나오면 즉시 멈춘다.',
    '캡처는 승인 뒤 컨트롤 타워가 컨트롤 타워가 따로 요청한다 (보고서 참고).',
    '',
    '| 주문번호 | 구매자 | 금액 | 주문 ID | approve URL |',
    '| --- | --- | --- | --- | --- |',
    `| ${spec.key} (#1038) | Ji-ho Park (jiho) | $${spec.amount} | ${orderId} | ${approveUrl} |`,
    '',
  ].join('\n');
}

export async function main(root: string = ROOT): Promise<number> {
  if (existsSync(linksPath(root))) {
    console.log('seed/sandbox-links.md가 이미 있다 — 호출하지 않았다.');
    return 0;
  }
  let env: PayPalEnv;
  try {
    env = loadSandboxEnv();
  } catch (error) {
    console.error(error instanceof SandboxEnvError ? error.message : '자격 증명을 읽지 못했다.');
    return 1;
  }
  const spec = j1038Spec();
  const client = createSandboxClient(env);
  const res = await client.call({ method: 'POST', path: '/v2/checkout/orders', requestId: J1038_REQUEST_ID, body: buildOrderBody(spec) });
  if (res.status >= 300) {
    console.error(`주문 생성 실패 → ${res.status}: ${errorSummary(res.body)}`);
    return 1;
  }
  const orderId = asText(asRecord(res.body).id);
  const approveUrl = approveUrlFrom(res.body);
  const kind = approveUrl === '' ? 'unknown' : approveUrlKind(approveUrl);
  console.log(`주문 생성 → ${res.status} · 주문 ID ${orderId} · 상태 ${asText(asRecord(res.body).status)} · 링크 도메인 ${kind}`);
  if (orderId === '' || kind !== 'sandbox') {
    console.error('주문 ID가 없거나 승인 링크가 샌드박스가 아니다. 파일에 쓰지 않고 멈춘다 — 사람에게 알린다.');
    return 1;
  }
  writeFileSync(linksPath(root), renderLinks(orderId, approveUrl, spec), 'utf8');
  console.log('승인 링크 → seed/sandbox-links.md · 승인·캡처는 하지 않았다.');
  console.log(approveUrl);
  return 0;
}

if (process.argv[1] !== undefined && path.basename(process.argv[1]) === path.basename(__filename)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(failureLine(error));
      process.exitCode = 1;
    },
  );
}
