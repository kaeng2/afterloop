/**
 * `npm run sandbox:orders` — 시드의 샌드박스 주문 12건(O01~O12)을 Orders v2로 만든다 (T026, SPEC v2.2 9-5장).
 *
 *   입력   : `seed/orders.json`의 `source: 'sandbox'` 12건 + `seed/products.json`의 상품명·가격
 *            배정(키·구매자·상품·추적)의 정본은 `tasks/T001.md` "주문 12건 배정" 표다.
 *   호출   : 주문마다 `POST /v2/checkout/orders` (intent CAPTURE, USD, items[].name = 상품명)
 *            `PayPal-Request-Id`는 주문 키 기준(`afterloop-order-O01`)이라 다시 실행해도 중복 생성되지 않는다
 *            (PayPal이 같은 주문을 200으로 돌려준다 — T001 보고서의 멱등 확인).
 *   출력   : 승인 링크를 `reports/sandbox-approve-links.md`에, 주문 ID를 `tests/sandbox/manifest.json`에 적는다.
 *
 * 캡처는 하지 않는다 (사람·브라우저 에이전트가 승인한 뒤 `npm run sandbox:capture`).
 * 추적 등록·분쟁 조회도 하지 않는다 (`npm run sandbox:setup -- track | disputes`, T001).
 *
 * 비밀값: `.env`는 스크립트가 런타임에 `process.loadEnvFile`로만 읽는다 (`scripts/sandbox/env.ts`).
 * Client ID·Secret·액세스 토큰·Authorization 헤더는 출력·링크 파일·manifest·에러 문구에 넣지 않는다.
 * 구매자 개인정보도 적지 않는다: 링크 파일에는 시드 구매자 키와 샌드박스 계정 표시 이름만 적고
 * 이메일·`payer_id`는 적지 않는다 (SPEC 10장).
 *
 * 승인 링크가 샌드박스(`*.sandbox.paypal.com`)가 아니면 그 자리에서 멈춘다 (live는 쓰지 않는다).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import ordersJson from '../seed/orders.json';
import productsJson from '../seed/products.json';
import { ROOT, SandboxEnvError, loadSandboxEnv } from './sandbox/env';
import { kstStamp } from './sandbox/last-run';
import { readManifest, writeManifest, type Manifest, type ManifestOrder } from './sandbox/manifest';
import { asArray, asRecord, asText, createSandboxClient, errorSummary, failureLine } from './sandbox/paypal';
import type { PayPalClient, PayPalEnv } from '@/types';

// ── 배정 (tasks/T001.md "주문 12건 배정" 표가 정본) ──────────────────────────────

/** 시드 구매자 ID → 주문 스크립트·manifest·AC13이 쓰는 구매자 키 (T001 표). */
export const BUYER_KEY_BY_SEED_ID: Record<string, string> = {
  B01: 'seoyeon',
  B02: 'jiho',
  B03: 'yuki',
  B04: 'buyer_m',
  B05: 'lena',
};

/** 승인하는 사람이 어느 계정으로 로그인해야 하는지 (샌드박스 개인 계정의 표시 이름. 이메일은 적지 않는다). */
export const BUYER_DISPLAY_NAME: Record<string, string> = {
  seoyeon: 'Seoyeon Kim',
  jiho: 'Jiho Park',
  yuki: 'Yuki Tanaka',
  lena: 'Lena Mueller',
  buyer_m: 'Mike Morgan',
};

/** 구매자별 주문 수 (원문 6-2, 합 12). 시드가 이와 다르면 만들지 않고 멈춘다. */
export const ORDERS_PER_BUYER: Record<string, number> = { seoyeon: 1, jiho: 1, yuki: 3, lena: 2, buyer_m: 5 };

/** 추적 등록 7건 (O01, O06, O08~O12). 등록 자체는 T001의 `track` 단계가 한다. */
export const TRACKED_COUNT = 7;

/** 주문 생성 요청 ID: 주문 키 기준이라 다시 실행해도 같다 (`afterloop-track-*`과 같은 꼴). */
export const orderRequestId = (orderKey: string): string => `afterloop-order-${orderKey}`;

/** 승인 링크 파일. 사람·브라우저 에이전트가 이 파일을 보고 승인한다. */
export const approveLinksPath = (root: string = ROOT): string => path.join(root, 'reports/sandbox-approve-links.md');

// ── 시드 읽기 ──────────────────────────────────────────────────────────────────

const seedOrderRowSchema = z
  .object({
    id: z.string().min(1),
    buyerId: z.string().min(1),
    sku: z.string().min(1),
    amountCents: z.number().int().positive(),
    tracked: z.boolean(),
    source: z.enum(['sandbox', 'seed']),
  })
  .passthrough();

const seedProductRowSchema = z
  .object({
    sku: z.string().min(1),
    itemName: z.string().min(1),
    priceCents: z.number().int().positive(),
  })
  .passthrough();

export type OrderSpec = {
  /** 주문 키 O01~O12 */
  key: string;
  /** 시드 구매자 키 (seoyeon·jiho·yuki·lena·buyer_m) */
  buyer: string;
  sku: string;
  itemName: string;
  /** PayPal에 보내는 금액 문자열 ("72.00") */
  amount: string;
  tracked: boolean;
};

/** 시드 금액(센트) → API 금액 문자열. 계산이 아니라 자리 맞추기다. */
export const amountText = (cents: number): string => (cents / 100).toFixed(2);

/**
 * 시드에서 샌드박스 12건을 읽어 주문 명세로 바꾼다. 값을 고치거나 채우지 않는다.
 * 시드가 T001 표(건수·구매자별 주문 수·추적 7건)와 다르면 던진다 — 추측하지 않고 멈춘다.
 */
export function readSandboxOrderSpecs(orders: unknown = ordersJson, products: unknown = productsJson): OrderSpec[] {
  const allOrders = z.array(seedOrderRowSchema).parse(orders);
  const allProducts = z.array(seedProductRowSchema).parse(products);
  const productBySku = new Map(allProducts.map((product) => [product.sku, product]));

  const specs: OrderSpec[] = [];
  for (const row of allOrders.filter((order) => order.source === 'sandbox').sort((a, b) => a.id.localeCompare(b.id))) {
    const buyer = BUYER_KEY_BY_SEED_ID[row.buyerId];
    if (buyer === undefined) {
      throw new Error(`시드 주문 ${row.id}의 구매자 ${row.buyerId}가 T001 표에 없다 (컨트롤 타워에 알린다).`);
    }
    const product = productBySku.get(row.sku);
    if (product === undefined) {
      throw new Error(`시드 주문 ${row.id}의 상품 ${row.sku}가 seed/products.json에 없다.`);
    }
    if (product.priceCents !== row.amountCents) {
      throw new Error(`시드 주문 ${row.id}의 금액이 상품 ${row.sku} 가격과 다르다 (시드를 고쳐야 한다).`);
    }
    specs.push({
      key: row.id,
      buyer,
      sku: row.sku,
      itemName: product.itemName,
      amount: amountText(row.amountCents),
      tracked: row.tracked,
    });
  }

  const total = Object.values(ORDERS_PER_BUYER).reduce((sum, n) => sum + n, 0);
  if (specs.length !== total) {
    throw new Error(`시드의 샌드박스 주문이 ${specs.length}건이다 (T001 표는 ${total}건). 시드를 확인한다.`);
  }
  for (const [buyer, expected] of Object.entries(ORDERS_PER_BUYER)) {
    const got = specs.filter((spec) => spec.buyer === buyer).length;
    if (got !== expected) {
      throw new Error(`구매자 ${buyer}의 주문이 ${got}건이다 (T001 표는 ${expected}건). 시드를 확인한다.`);
    }
  }
  const tracked = specs.filter((spec) => spec.tracked).length;
  if (tracked !== TRACKED_COUNT) {
    throw new Error(`추적 등록 대상이 ${tracked}건이다 (T001 표는 ${TRACKED_COUNT}건). 시드를 확인한다.`);
  }
  return specs;
}

// ── 요청 본문 ──────────────────────────────────────────────────────────────────

/**
 * Orders v2 주문 1건. 금액은 상품 가격 그대로(USD), `items[].name`은 원문 6-1 상품명.
 * `reference_id`에 주문 키를 넣어 PayPal 쪽에서도 어느 주문인지 보이게 한다 (구매자 정보는 넣지 않는다).
 */
export function buildOrderBody(spec: OrderSpec): Record<string, unknown> {
  const amount = { currency_code: 'USD', value: spec.amount };
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: spec.key,
        amount: { ...amount, breakdown: { item_total: amount } },
        items: [{ name: spec.itemName, quantity: '1', unit_amount: amount }],
      },
    ],
  };
}

// ── 승인 링크 ──────────────────────────────────────────────────────────────────

/** 샌드박스 승인 화면의 도메인. 이 밖(특히 live `www.paypal.com`)이면 멈춘다. */
const SANDBOX_HOST_SUFFIX = '.sandbox.paypal.com';

/** 승인 링크가 샌드박스인지. `live`면 즉시 멈춰야 한다. */
export function approveUrlKind(href: string): 'sandbox' | 'live' | 'unknown' {
  let host: string;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:') return 'unknown';
    host = url.hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  if (host === 'sandbox.paypal.com' || host.endsWith(SANDBOX_HOST_SUFFIX)) return 'sandbox';
  if (host === 'paypal.com' || host.endsWith('.paypal.com')) return 'live';
  return 'unknown';
}

/** 샌드박스가 아닌 승인 링크를 받았을 때. 도메인만 담는다 (링크 전체는 싣지 않는다). */
export class NotSandboxLinkError extends Error {
  constructor(orderKey: string, host: string, kind: 'live' | 'unknown') {
    super(
      kind === 'live'
        ? `${orderKey}: 승인 링크가 live PayPal 도메인(${host})이다. 즉시 멈추고 사람에게 알린다.`
        : `${orderKey}: 승인 링크 도메인(${host})이 샌드박스가 아니다. 멈추고 사람에게 알린다.`,
    );
    this.name = 'NotSandboxLinkError';
  }
}

/** 응답 `links[]`에서 승인 링크를 고른다 (`approve`, 없으면 `payer-action`). 없으면 빈 문자열. */
export function approveUrlFrom(body: unknown): string {
  const links = asArray(asRecord(body).links).map(asRecord);
  const byRel = (rel: string): string =>
    asText(links.find((link) => asText(link.rel).toLowerCase() === rel)?.href);
  return byRel('approve') || byRel('payer-action');
}

/** 도메인을 확인한 승인 링크. 샌드박스가 아니면 던진다. */
function sandboxApproveUrl(orderKey: string, body: unknown): string {
  const href = approveUrlFrom(body);
  if (href === '') return '';
  const kind = approveUrlKind(href);
  if (kind !== 'sandbox') {
    let host = '(해석할 수 없는 주소)';
    try {
      host = new URL(href).hostname;
    } catch {
      // 해석이 안 되는 주소는 도메인 없이 보고한다
    }
    throw new NotSandboxLinkError(orderKey, host, kind);
  }
  return href;
}

// ── 주문 생성 ──────────────────────────────────────────────────────────────────

export type CreateRow = {
  key: string;
  buyer: string;
  sku: string;
  itemName: string;
  amount: string;
  tracked: boolean;
  /** 새로 만들었으면 `created`, 같은 요청 ID로 돌려받았으면 `existing` */
  result: 'created' | 'existing' | 'failed';
  httpStatus: number | null;
  orderId: string;
  /** 주문 상태 (`CREATED`·`APPROVED`·`COMPLETED` …) */
  orderStatus: string;
  approveUrl: string;
  note: string;
};

export type CreateOutcome = { rows: CreateRow[]; orders: ManifestOrder[]; problems: string[] };

/**
 * 주문 12건을 만든다. 같은 요청 ID라 다시 실행해도 PayPal이 같은 주문을 돌려준다(200).
 * 이미 manifest에 있던 주문 ID와 다른 ID가 돌아오면 문제로 적는다 (멱등 창이 지났을 수 있다).
 * 한 건이 실패해도 나머지는 계속한다. 승인 링크 도메인이 샌드박스가 아니면 그 자리에서 던진다.
 */
export async function runCreateOrders(client: PayPalClient, specs: OrderSpec[], existing: Manifest): Promise<CreateOutcome> {
  const previous = new Map(existing.orders.map((order) => [order.key, order]));
  const rows: CreateRow[] = [];
  const orders: ManifestOrder[] = [];
  const problems: string[] = [];

  for (const spec of specs) {
    const base = {
      key: spec.key,
      buyer: spec.buyer,
      sku: spec.sku,
      itemName: spec.itemName,
      amount: spec.amount,
      tracked: spec.tracked,
    };
    const before = previous.get(spec.key);

    try {
      const res = await client.call({
        method: 'POST',
        path: '/v2/checkout/orders',
        requestId: orderRequestId(spec.key),
        body: buildOrderBody(spec),
      });

      if (res.status >= 300) {
        rows.push({ ...base, result: 'failed', httpStatus: res.status, orderId: '', orderStatus: '', approveUrl: '', note: errorSummary(res.body) });
        problems.push(`${spec.key} 주문 생성 → ${res.status}: ${errorSummary(res.body)}`);
        if (before !== undefined) orders.push(before); // 전에 적어 둔 주문 ID는 지우지 않는다
        continue;
      }

      const orderId = asText(asRecord(res.body).id);
      if (orderId === '') {
        rows.push({ ...base, result: 'failed', httpStatus: res.status, orderId: '', orderStatus: '', approveUrl: '', note: '응답에 주문 ID가 없다' });
        problems.push(`${spec.key} 주문 생성 → ${res.status}인데 응답에 주문 ID가 없다`);
        if (before !== undefined) orders.push(before);
        continue;
      }

      const approveUrl = sandboxApproveUrl(spec.key, res.body);
      const notes: string[] = [];
      if (approveUrl === '') notes.push('응답에 승인 링크(approve·payer-action)가 없다');
      if (before !== undefined && before.orderId !== orderId) {
        notes.push(`manifest에 있던 주문 ID와 다른 ID가 돌아왔다 (멱등 창이 지났을 수 있다. 이전: ${before.orderId})`);
        problems.push(`${spec.key}: 전에 적어 둔 주문 ${before.orderId} 대신 새 주문 ${orderId}이 생겼다. 승인은 새 주문으로 한다.`);
      }

      // 캡처 ID는 같은 주문일 때만 이어 쓴다 (주문이 바뀌면 캡처도 다시 해야 한다).
      const captureId = before !== undefined && before.orderId === orderId ? before.captureId : undefined;
      orders.push({
        key: spec.key,
        orderId,
        buyer: spec.buyer,
        sku: spec.sku,
        tracked: spec.tracked,
        ...(captureId === undefined ? {} : { captureId }),
      });
      rows.push({
        ...base,
        result: res.status === 201 ? 'created' : 'existing',
        httpStatus: res.status,
        orderId,
        orderStatus: asText(asRecord(res.body).status),
        approveUrl,
        note: notes.length === 0 ? 'ok' : notes.join(' · '),
      });
      if (approveUrl === '') problems.push(`${spec.key} 주문 ${orderId}: 승인 링크가 응답에 없다`);
    } catch (error) {
      if (error instanceof NotSandboxLinkError) throw error; // live일 수 있다 — 더 부르지 않는다
      rows.push({ ...base, result: 'failed', httpStatus: null, orderId: '', orderStatus: '', approveUrl: '', note: failureLine(error) });
      problems.push(`${spec.key} 주문 생성 실패: ${failureLine(error)}`);
      if (before !== undefined) orders.push(before);
    }
  }

  return { rows, orders, problems };
}

// ── 승인 링크 파일 ─────────────────────────────────────────────────────────────

const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`;

/** 구매자 칸: 시드 키 + 샌드박스 계정 표시 이름 (이메일은 적지 않는다). */
export const buyerCell = (buyer: string): string => {
  const name = BUYER_DISPLAY_NAME[buyer];
  return name === undefined ? buyer : `${buyer} = ${name}`;
};

/** `reports/sandbox-approve-links.md` 내용. 비밀값·이메일은 들어가지 않는다. */
export function renderApproveLinks(rows: CreateRow[], now: Date = new Date()): string {
  const done = rows.filter((r) => r.approveUrl !== '');
  const lines = [
    '# 샌드박스 승인 링크 (주문 12건)',
    '',
    `> \`npm run sandbox:orders\`가 ${kstStamp(now)}에 덮어썼다. 승인 링크 ${done.length}건 / 주문 ${rows.length}건.`,
    '',
    '**브라우저 에이전트**: 아래 링크를 한 건씩 열어 그 행의 샌드박스 구매자 계정으로 로그인해 결제를 승인한다 (계정 비밀번호는 사람이 넣는다).',
    '링크는 모두 `sandbox.paypal.com` 도메인이다 — 다른 도메인(특히 live `www.paypal.com`)이 나오면 즉시 멈추고 사람에게 알린다.',
    '**12건을 모두 승인한 뒤** 컨트롤 타워가 `npm run sandbox:capture`로 캡처한다 (승인 전에는 캡처되지 않는다).',
    '',
    row(['주문번호', '구매자', '금액', 'approve URL']),
    row(['---', '---', '---', '---']),
    ...rows.map((r) => row([r.key, buyerCell(r.buyer), `$${r.amount}`, r.approveUrl === '' ? `승인 링크 없음 — ${r.note}` : r.approveUrl])),
    '',
  ];
  return `${lines.join('\n')}`;
}

/** 링크 파일을 덮어쓴다. */
export function writeApproveLinks(rows: CreateRow[], now: Date = new Date(), root: string = ROOT): string {
  const file = approveLinksPath(root);
  writeFileSync(file, renderApproveLinks(rows, now), 'utf8');
  return file;
}

// ── 출력 ───────────────────────────────────────────────────────────────────────

function printRows(rows: CreateRow[]): void {
  console.log(row(['키', '구매자', '상품', '금액', '결과', '상태', '주문 ID', '주문 상태', '비고']));
  console.log(row(['---', '---', '---', '---', '---', '---', '---', '---', '---']));
  for (const r of rows) {
    console.log(
      row([
        r.key,
        r.buyer,
        r.itemName,
        `$${r.amount}`,
        r.result,
        r.httpStatus ?? '호출 실패',
        r.orderId || '-',
        r.orderStatus || '-',
        r.note,
      ]),
    );
  }
  const count = (result: CreateRow['result']) => rows.filter((r) => r.result === result).length;
  console.log(`\n새로 만듦 ${count('created')} · 이미 있음 ${count('existing')} · 실패 ${count('failed')}`);
}

// ── 진입점 ─────────────────────────────────────────────────────────────────────

export async function main(): Promise<number> {
  let specs: OrderSpec[];
  try {
    specs = readSandboxOrderSpecs();
  } catch (error) {
    console.error(`시드를 읽지 못했다: ${failureLine(error)}`);
    return 1;
  }

  let env: PayPalEnv;
  try {
    env = loadSandboxEnv();
  } catch (error) {
    console.error(error instanceof SandboxEnvError ? error.message : '자격 증명을 읽지 못했다.');
    return 1;
  }

  const client = createSandboxClient(env, (line) => console.log(`  · ${line}`));
  const before = readManifest();

  let outcome: CreateOutcome;
  try {
    outcome = await runCreateOrders(client, specs, before);
  } catch (error) {
    if (error instanceof NotSandboxLinkError) {
      console.error(`\n${error.message}`);
      console.error('링크 파일과 manifest는 쓰지 않았다. 남은 주문도 만들지 않았다.');
      return 1;
    }
    throw error;
  }

  if (outcome.orders.length > 0) {
    writeManifest({ ...before, orders: outcome.orders });
  }
  const file = writeApproveLinks(outcome.rows);

  console.log('');
  printRows(outcome.rows);
  console.log(`\nmanifest 주문 ${outcome.orders.length}건 · 승인 링크 파일: ${path.relative(ROOT, file)}`);
  if (outcome.problems.length > 0) {
    console.log('\n문제:');
    for (const problem of outcome.problems) console.log(`- ${problem}`);
  }

  const ready = outcome.rows.filter((r) => r.result !== 'failed' && r.approveUrl !== '').length;
  if (ready !== specs.length) {
    console.error(`\n승인 링크가 ${ready}/${specs.length}건만 모였다. 위 문제를 보고 다시 실행한다 (같은 요청 ID라 중복 생성되지 않는다).`);
    return 1;
  }
  console.log('\n다음: 브라우저 에이전트가 링크 12건을 승인한 뒤 `npm run sandbox:capture`.');
  return 0;
}

/** 단위 테스트가 import할 때는 돌지 않는다 (실제 PayPal을 부르지 않게). */
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
