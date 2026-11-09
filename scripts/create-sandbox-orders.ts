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
 * 옵션 (T029):
 *   `-- --status` : manifest의 주문마다 `GET /v2/checkout/orders/{id}`로 지금 상태만 읽어 표로 보여 준다.
 *                   아무것도 만들거나 바꾸지 않는다 (manifest·링크 파일도 쓰지 않는다).
 *   `-- --fresh`  : 승인 링크가 만료됐을 때 쓴다. 요청 ID에 실행 시각 접미사를 붙여 주문을 **새로** 만들고
 *                   manifest의 `orderId`와 링크 파일을 새 값으로 바꾼다 (이전 ID는 `previousOrderIds`에 남는다).
 *
 * 승인·캡처된 주문 보호 (T030 — 아침에 사람이 승인·캡처하는 동안 실수로 다시 실행해도 기록이 사라지지 않게):
 *   - 옵션 없는 실행은 **manifest에 주문 ID가 있는 키를 POST하지 않는다**. 12건이 모두 있으면 아무것도
 *     만들지 않고 종료 코드 0으로 끝난다 (`captureId`·`previousOrderIds`·`disputes`를 지우지 않는다).
 *   - `--fresh`는 건마다 먼저 상태를 조회해 `APPROVED`·`COMPLETED`는 그대로 두고
 *     `CREATED`·`PAYER_ACTION_REQUIRED`·만료(404)만 새로 만든다. 상태를 읽지 못한 주문은 건드리지 않는다.
 *   - manifest에 `captureId`가 적힌 주문은 **어떤 경로로도** 새로 만들지 않는다 (조회가 4xx거나 실패해도).
 *   - 새로 만든 주문이 0건이면 manifest·링크 파일을 쓰지 않는다. 일부만 성공하면 성공한 행만 바꾸고
 *     나머지 행은 지난 실행이 적어 둔 링크를 그대로 둔다 (링크 파일은 늘 12행이다).
 *   - `--` 없이 준 옵션(`npm run sandbox:orders --fresh`)은 npm이 삼키므로 호출하지 않고 멈춘다.
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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import ordersJson from '../seed/orders.json';
import productsJson from '../seed/products.json';
import { ROOT, SandboxEnvError, loadSandboxEnv } from './sandbox/env';
import { kstStamp } from './sandbox/last-run';
import { readManifest, writeManifest, type Manifest, type ManifestOrder } from './sandbox/manifest';
import { swallowedOptionsError, type EnvVars } from './sandbox/npm-args';
import { asArray, asRecord, asText, createSandboxClient, errorSummary, failureLine, firstCaptureId, hasTracker } from './sandbox/paypal';
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

/**
 * 주문 생성 요청 ID: 주문 키 기준이라 다시 실행해도 같다 (`afterloop-track-*`과 같은 꼴).
 * `--fresh`일 때만 접미사가 붙어 PayPal이 **새 주문**을 만든다 (`afterloop-order-O01-r202611100730`).
 */
export const orderRequestId = (orderKey: string, suffix = ''): string =>
  suffix === '' ? `afterloop-order-${orderKey}` : `afterloop-order-${orderKey}-${suffix}`;

/**
 * `--fresh`의 요청 ID 접미사 (`r` + KST `YYYYMMDDHHmm`).
 * 진입점에서 **한 번만** 만들어 12건에 같은 값을 쓴다 — 같은 분에 다시 돌리면 PayPal이 같은 주문을
 * 200으로 돌려주므로 주문이 쌓이지 않는다.
 */
export function freshSuffix(now: Date): string {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `r${shifted.toISOString().slice(0, 16).replace(/[-T:]/g, '')}`;
}

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
  /**
   * `created` 새로 만듦 · `existing` 같은 요청 ID로 200으로 돌려받음 ·
   * `kept` manifest에 주문 ID가 이미 있어 POST하지 않음 (T030) · `failed` 실패
   */
  result: 'created' | 'existing' | 'kept' | 'failed';
  httpStatus: number | null;
  orderId: string;
  /** 주문 상태 (`CREATED`·`APPROVED`·`COMPLETED` …) */
  orderStatus: string;
  approveUrl: string;
  note: string;
};

export type CreateOutcome = { rows: CreateRow[]; orders: ManifestOrder[]; problems: string[] };

/** manifest에 이미 있는 키를 건너뛸 때 적는 문구 (T030). */
export const KEPT_NOTE =
  'manifest에 주문 ID가 이미 있다 — POST하지 않았다 (`-- --status`로 상태 확인, `-- --fresh`로 만료된 것만 다시 만들기)';

/** 12건이 모두 manifest에 있을 때 보여 주는 한 줄 (T030 지시서 문장 그대로). */
export const ALREADY_CREATED_NOTE = 'already created — use `-- --status` to check, `-- --fresh` to recreate expired ones';

/**
 * manifest에 **없는** 키만 만든다 (T030). 이미 주문 ID가 적힌 키는 POST하지 않고 manifest 항목을
 * 그대로 옮긴다 — 승인·캡처가 끝난 주문을 다시 실행으로 덮지 않기 위해서다
 * (`captureId`·`previousOrderIds`도 그대로 남는다).
 *
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

    // 이미 있는 주문은 건드리지 않는다 — 호출도 하지 않는다 (T030 지시서 2번).
    if (before !== undefined) {
      orders.push(before);
      rows.push({ ...base, result: 'kept', httpStatus: null, orderId: before.orderId, orderStatus: '', approveUrl: '', note: KEPT_NOTE });
      continue;
    }

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
        continue;
      }

      const orderId = asText(asRecord(res.body).id);
      if (orderId === '') {
        rows.push({ ...base, result: 'failed', httpStatus: res.status, orderId: '', orderStatus: '', approveUrl: '', note: '응답에 주문 ID가 없다' });
        problems.push(`${spec.key} 주문 생성 → ${res.status}인데 응답에 주문 ID가 없다`);
        continue;
      }

      const approveUrl = sandboxApproveUrl(spec.key, res.body);
      orders.push({ key: spec.key, orderId, buyer: spec.buyer, sku: spec.sku, tracked: spec.tracked });
      rows.push({
        ...base,
        result: res.status === 201 ? 'created' : 'existing',
        httpStatus: res.status,
        orderId,
        orderStatus: asText(asRecord(res.body).status),
        approveUrl,
        note: approveUrl === '' ? '응답에 승인 링크(approve·payer-action)가 없다' : 'ok',
      });
      if (approveUrl === '') problems.push(`${spec.key} 주문 ${orderId}: 승인 링크가 응답에 없다`);
    } catch (error) {
      if (error instanceof NotSandboxLinkError) throw error; // live일 수 있다 — 더 부르지 않는다
      rows.push({ ...base, result: 'failed', httpStatus: null, orderId: '', orderStatus: '', approveUrl: '', note: failureLine(error) });
      problems.push(`${spec.key} 주문 생성 실패: ${failureLine(error)}`);
    }
  }

  return { rows, orders: [...orders, ...unknownKeyOrders(existing, specs)], problems };
}

/**
 * 시드에 없는 키의 manifest 항목 (지우지 않고 끝에 붙인다).
 * 지시서 표가 바뀌어 키가 줄어도 전에 적어 둔 주문·캡처 기록을 잃지 않게 한다.
 */
function unknownKeyOrders(existing: Manifest, specs: OrderSpec[]): ManifestOrder[] {
  const known = new Set(specs.map((spec) => spec.key));
  return existing.orders.filter((order) => !known.has(order.key));
}

// ── 주문 상태 조회 (`--status`, T029) ──────────────────────────────────────────

/** 만료·없는 주문일 때 적는 문구 (지시서 문장 그대로). */
export const EXPIRED_NOTE = 'expired or not found';

/** 만료·없는 주문으로 읽는 오류 (PayPal은 만료된 주문도 404 RESOURCE_NOT_FOUND로 답한다). */
const GONE_PATTERN = /NOT_FOUND|EXPIRED|INVALID_RESOURCE_ID/i;

export type StatusRow = {
  key: string;
  orderId: string;
  /** `CREATED` · `PAYER_ACTION_REQUIRED` · `APPROVED` · `COMPLETED` … 읽지 못했으면 빈 문자열 */
  status: string;
  httpStatus: number | null;
  captureId: string;
  tracked: boolean;
  note: string;
};

/** 만료·없는 주문인지 (상태 코드와 오류 요약으로만 본다). */
export function looksGone(httpStatus: number, body: unknown): boolean {
  return httpStatus === 404 || GONE_PATTERN.test(errorSummary(body));
}

/**
 * manifest의 주문마다 지금 상태를 읽는다. **조회만** 한다 — 만들거나 바꾸지 않고,
 * manifest·링크 파일도 쓰지 않는다. 한 건이 실패해도 나머지는 계속 읽는다.
 */
export async function runOrderStatus(client: PayPalClient, manifest: Manifest): Promise<{ rows: StatusRow[]; problems: string[] }> {
  const rows: StatusRow[] = [];
  const problems: string[] = [];

  for (const entry of manifest.orders) {
    const base = { key: entry.key, orderId: entry.orderId };
    try {
      const res = await client.get(`/v2/checkout/orders/${encodeURIComponent(entry.orderId)}`);
      if (res.status !== 200) {
        const note = looksGone(res.status, res.body) ? EXPIRED_NOTE : errorSummary(res.body);
        rows.push({ ...base, status: '', httpStatus: res.status, captureId: '', tracked: false, note });
        problems.push(`${entry.key} 주문 조회 → ${res.status}: ${note}`);
        continue;
      }
      rows.push({
        ...base,
        status: asText(asRecord(res.body).status),
        httpStatus: 200,
        captureId: firstCaptureId(res.body),
        tracked: hasTracker(res.body),
        note: 'ok',
      });
    } catch (error) {
      rows.push({ ...base, status: '', httpStatus: null, captureId: '', tracked: false, note: failureLine(error) });
      problems.push(`${entry.key} 주문 조회 실패: ${failureLine(error)}`);
    }
  }

  return { rows, problems };
}

// ── 링크 다시 만들기 (`--fresh`, T029) ─────────────────────────────────────────

/**
 * `--fresh` 건별 판정 (T030).
 *   `recreated`      만료·미승인이라 새로 만들었다
 *   `existing`       같은 접미사로 PayPal이 같은 주문을 200으로 돌려줬다
 *   `kept-approved`  사람이 이미 승인한 주문이라 그대로 뒀다 (새로 만들면 승인이 사라진다)
 *   `kept-captured`  캡처된(또는 manifest에 캡처 ID가 있는) 주문이라 그대로 뒀다
 *   `skipped`        상태를 읽지 못해 건드리지 않았다 (종료 코드 1)
 *   `failed`         새로 만들기가 실패했다 (manifest 항목은 그대로)
 */
export type FreshResult = 'recreated' | 'existing' | 'kept-approved' | 'kept-captured' | 'skipped' | 'failed';

/** 결과 표·요약에 쓰는 이름 (지시서 3번 문장 그대로). */
export const FRESH_LABEL: Record<FreshResult, string> = {
  recreated: 'recreated',
  existing: 'recreated (same suffix)',
  'kept-approved': 'kept (approved)',
  'kept-captured': 'kept (captured)',
  skipped: 'skipped (status unknown)',
  failed: 'failed',
};

/** 새로 만들어도 되는 주문 상태 (아직 아무 일도 일어나지 않은 주문). */
export const RECREATE_STATUSES = ['CREATED', 'PAYER_ACTION_REQUIRED'];

export type FreshRow = {
  key: string;
  buyer: string;
  sku: string;
  itemName: string;
  amount: string;
  tracked: boolean;
  result: FreshResult;
  httpStatus: number | null;
  orderId: string;
  /** 이번에 밀려난 이전 주문 ID (바뀌지 않았으면 빈 문자열) */
  previousOrderId: string;
  orderStatus: string;
  approveUrl: string;
  note: string;
};

export type FreshOutcome = { rows: FreshRow[]; orders: ManifestOrder[]; problems: string[] };

/** 이전 주문 ID 목록에 한 건을 더한다 (오래된 것부터, 중복은 넣지 않는다). */
export function pushPreviousOrderId(before: ManifestOrder, orderId: string): string[] {
  const kept = before.previousOrderIds ?? [];
  return kept.includes(orderId) ? kept : [...kept, orderId];
}

/**
 * 승인 링크가 만료됐을 때 주문을 새 요청 ID로 다시 만든다 — **살아 있는 주문은 버리지 않는다** (T030).
 *
 * 건마다:
 *   1. manifest에 `captureId`가 있으면 상태만 확인하고 **절대 새로 만들지 않는다**. 조회가 4xx거나
 *      실패해도 그대로 둔다 (경고를 적는다) — 캡처·분쟁과의 연결이 끊기면 되살릴 수 없다.
 *   2. 그 밖에는 먼저 `GET`으로 상태를 본다.
 *      `COMPLETED`·`APPROVED`            → 그대로 둔다 (`kept (captured)` · `kept (approved)`)
 *      `CREATED`·`PAYER_ACTION_REQUIRED` → 새로 만든다
 *      만료·404                          → 새로 만든다
 *      그 밖의 응답·네트워크 실패         → 건드리지 않고 `skipped (status unknown)` (종료 코드 1)
 *   3. 새로 만들면 이전 주문 ID를 `previousOrderIds`에 남긴다. 캡처 ID는 주문이 바뀌면 이어 쓰지 않는다.
 *
 * `suffix`는 호출하는 쪽이 한 번만 만들어 넘긴다 — 같은 접미사로 다시 돌리면 PayPal이 같은 주문을
 * 200으로 돌려주므로 중복 주문이 생기지 않는다.
 */
export async function runFreshOrders(
  client: PayPalClient,
  specs: OrderSpec[],
  existing: Manifest,
  suffix: string,
): Promise<FreshOutcome> {
  if (suffix === '') throw new Error('--fresh에는 요청 ID 접미사가 필요하다 (진입점에서 한 번만 만들어 넘긴다).');

  const previous = new Map(existing.orders.map((order) => [order.key, order]));
  const rows: FreshRow[] = [];
  const orders: ManifestOrder[] = [];
  const problems: string[] = [];

  for (const spec of specs) {
    const base = { key: spec.key, buyer: spec.buyer, sku: spec.sku, itemName: spec.itemName, amount: spec.amount, tracked: spec.tracked };
    const before = previous.get(spec.key);

    // 1) 살아 있는 주문·캡처된 주문은 새로 만들지 않는다 (조회만 한다).
    if (before !== undefined) {
      const decision = await keepDecision(client, before);
      if (decision !== undefined) {
        orders.push(before);
        rows.push({
          ...base,
          result: decision.result,
          httpStatus: decision.httpStatus,
          orderId: before.orderId,
          previousOrderId: '',
          orderStatus: decision.orderStatus,
          approveUrl: '',
          note: decision.note,
        });
        if (decision.problem !== undefined) problems.push(`${spec.key} ${decision.problem}`);
        continue;
      }
    }

    try {
      // 2) 새 요청 ID로 다시 만든다.
      const res = await client.call({
        method: 'POST',
        path: '/v2/checkout/orders',
        requestId: orderRequestId(spec.key, suffix),
        body: buildOrderBody(spec),
      });

      if (res.status >= 300) {
        rows.push({ ...base, result: 'failed', httpStatus: res.status, orderId: '', previousOrderId: '', orderStatus: '', approveUrl: '', note: errorSummary(res.body) });
        problems.push(`${spec.key} 주문 생성 → ${res.status}: ${errorSummary(res.body)}`);
        if (before !== undefined) orders.push(before); // 전에 적어 둔 주문 ID는 지우지 않는다
        continue;
      }

      const orderId = asText(asRecord(res.body).id);
      if (orderId === '') {
        rows.push({ ...base, result: 'failed', httpStatus: res.status, orderId: '', previousOrderId: '', orderStatus: '', approveUrl: '', note: '응답에 주문 ID가 없다' });
        problems.push(`${spec.key} 주문 생성 → ${res.status}인데 응답에 주문 ID가 없다`);
        if (before !== undefined) orders.push(before);
        continue;
      }

      const approveUrl = sandboxApproveUrl(spec.key, res.body);
      const replaced = before !== undefined && before.orderId !== orderId;
      const previousOrderIds = replaced ? pushPreviousOrderId(before, before.orderId) : before?.previousOrderIds;
      // 주문이 바뀌면 캡처도 다시 해야 한다 — 같은 주문일 때만 캡처 ID를 이어 쓴다.
      const captureId = before !== undefined && before.orderId === orderId ? before.captureId : undefined;

      orders.push({
        key: spec.key,
        orderId,
        buyer: spec.buyer,
        sku: spec.sku,
        tracked: spec.tracked,
        ...(captureId === undefined ? {} : { captureId }),
        ...(previousOrderIds === undefined || previousOrderIds.length === 0 ? {} : { previousOrderIds }),
      });

      const notes: string[] = [];
      if (approveUrl === '') notes.push('응답에 승인 링크(approve·payer-action)가 없다');
      if (replaced) notes.push('이전 주문을 밀어냈다 (previousOrderIds에 남겼다)');
      rows.push({
        ...base,
        result: res.status === 201 ? 'recreated' : 'existing',
        httpStatus: res.status,
        orderId,
        previousOrderId: replaced ? before.orderId : '',
        orderStatus: asText(asRecord(res.body).status),
        approveUrl,
        note: notes.length === 0 ? 'ok' : notes.join(' · '),
      });
      if (approveUrl === '') problems.push(`${spec.key} 주문 ${orderId}: 승인 링크가 응답에 없다`);
    } catch (error) {
      if (error instanceof NotSandboxLinkError) throw error; // live일 수 있다 — 더 부르지 않는다
      rows.push({ ...base, result: 'failed', httpStatus: null, orderId: '', previousOrderId: '', orderStatus: '', approveUrl: '', note: failureLine(error) });
      problems.push(`${spec.key} 주문 다시 만들기 실패: ${failureLine(error)}`);
      if (before !== undefined) orders.push(before);
    }
  }

  return { rows, orders: [...orders, ...unknownKeyOrders(existing, specs)], problems };
}

/** `keepDecision`이 "그대로 둔다"고 할 때의 건별 결과. `undefined`면 새로 만들어도 된다. */
type KeepDecision = {
  result: Exclude<FreshResult, 'recreated' | 'existing' | 'failed'>;
  httpStatus: number | null;
  orderStatus: string;
  note: string;
  /** 사람이 봐야 하는 경고 (문제 목록에 들어가고 종료 코드를 1로 만든다) */
  problem?: string;
};

/**
 * manifest에 있는 주문을 새로 만들어도 되는지 **조회만으로** 판정한다 (T030 지시서 1·3번).
 * `undefined`를 돌려줄 때만 새로 만든다. POST는 하지 않는다.
 */
async function keepDecision(client: PayPalClient, before: ManifestOrder): Promise<KeepDecision | undefined> {
  const captured = (before.captureId ?? '') !== '';
  const orderPath = `/v2/checkout/orders/${encodeURIComponent(before.orderId)}`;

  let detail: { status: number; body: unknown };
  try {
    detail = await client.get(orderPath);
  } catch (error) {
    // 조회가 네트워크·5xx로 실패한 주문은 건드리지 않는다 (살아 있을 수 있다).
    return captured
      ? {
          result: 'kept-captured',
          httpStatus: null,
          orderStatus: '',
          note: `경고: manifest에 캡처 ID가 있는데 상태를 읽지 못했다 (${failureLine(error)}) — 새로 만들지 않았다`,
          problem: `주문 ${before.orderId}: 캡처된 주문의 상태 조회가 실패했다 (${failureLine(error)}). 새로 만들지 않았다 — 캡처 ID를 지키기 위해서다.`,
        }
      : {
          result: 'skipped',
          httpStatus: null,
          orderStatus: '',
          note: `상태를 읽지 못했다 (${failureLine(error)}) — 건드리지 않았다`,
          problem: `주문 조회 실패: ${failureLine(error)}. 새로 만들지 않았다 (`
            + `살아 있는 주문을 버리지 않기 위해서다). 조회가 될 때 다시 실행한다.`,
        };
  }

  const orderStatus = detail.status === 200 ? asText(asRecord(detail.body).status) : '';

  // 캡처 ID가 적힌 주문은 어떤 응답이 와도 새로 만들지 않는다 (지시서 1번).
  if (captured) {
    if (orderStatus === 'COMPLETED') {
      return { result: 'kept-captured', httpStatus: 200, orderStatus, note: '이미 캡처됨 — 새로 만들지 않았다 (승인 링크가 필요 없다)' };
    }
    const seen = detail.status === 200 ? `주문 상태 ${orderStatus || '(없음)'}` : `HTTP ${detail.status} ${errorSummary(detail.body)}`;
    return {
      result: 'kept-captured',
      httpStatus: detail.status,
      orderStatus,
      note: `경고: manifest에 캡처 ID가 있는데 ${seen}이다 — 새로 만들지 않았다`,
      problem: `주문 ${before.orderId}: manifest에 캡처 ID가 있는데 조회 결과가 ${seen}이다. 새로 만들지 않았다 — 캡처 ID를 지키기 위해서다. \`npm run sandbox:check\`로 확인한다.`,
    };
  }

  if (detail.status === 200) {
    if (orderStatus === 'COMPLETED') {
      return { result: 'kept-captured', httpStatus: 200, orderStatus, note: '이미 캡처됨 — 새로 만들지 않았다 (승인 링크가 필요 없다)' };
    }
    if (orderStatus === 'APPROVED') {
      return {
        result: 'kept-approved',
        httpStatus: 200,
        orderStatus,
        note: '사람이 이미 승인했다 — 새로 만들지 않았다 (다음: npm run sandbox:capture)',
      };
    }
    if (RECREATE_STATUSES.includes(orderStatus)) return undefined; // 아직 아무 일도 없었다 → 새로 만든다
    return {
      result: 'skipped',
      httpStatus: 200,
      orderStatus,
      note: `주문 상태 ${orderStatus || '(없음)'} — 다시 만들지 않았다`,
      problem: `주문 ${before.orderId}의 상태가 ${orderStatus || '(없음)'}이다. \`--fresh\`가 다루는 상태(${RECREATE_STATUSES.join(', ')})가 아니라 건드리지 않았다.`,
    };
  }

  if (looksGone(detail.status, detail.body)) return undefined; // 만료·없는 주문 → 새로 만든다

  return {
    result: 'skipped',
    httpStatus: detail.status,
    orderStatus: '',
    note: `주문 조회 → ${detail.status} ${errorSummary(detail.body)} — 건드리지 않았다`,
    problem: `주문 조회 → ${detail.status}: ${errorSummary(detail.body)}. 만료로 읽을 수 없는 응답이라 새로 만들지 않았다.`,
  };
}

// ── 승인 링크 파일 ─────────────────────────────────────────────────────────────

const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`;

/** 구매자 칸: 시드 키 + 샌드박스 계정 표시 이름 (이메일은 적지 않는다). */
export const buyerCell = (buyer: string): string => {
  const name = BUYER_DISPLAY_NAME[buyer];
  return name === undefined ? buyer : `${buyer} = ${name}`;
};

/**
 * 링크 파일이 읽는 칸만. `CreateRow`(생성)와 `FreshRow`(`--fresh`) 둘 다 이 꼴이다.
 * `linkCell`을 주면 링크 칸에 그 값을 그대로 쓴다 (T030: 승인·캡처된 행의 상태 표시, 바뀌지 않은 행의 기존 링크).
 */
export type ApproveRow = Pick<CreateRow, 'key' | 'buyer' | 'amount' | 'approveUrl' | 'note'> & { linkCell?: string };

/** 링크 칸 하나. `linkCell`이 있으면 그것, 없으면 새 링크, 그것도 없으면 사유. */
export const linkCellOf = (r: ApproveRow): string =>
  r.linkCell ?? (r.approveUrl === '' ? `승인 링크 없음 — ${r.note}` : r.approveUrl);

/** 승인·캡처된 행의 링크 칸 (링크 대신 상태를 적는다 — 이 주문은 승인할 것이 없다). */
export const APPROVED_CELL = '승인됨 — 승인 링크가 필요 없다 (다음: `npm run sandbox:capture`)';
export const CAPTURED_CELL = '이미 캡처됨 — 승인 링크가 필요 없다';
/** 바뀌지 않은 행인데 지난 실행의 링크 기록이 없을 때. */
export const NO_RECORD_CELL = '지난 링크 기록이 없다 — `npm run sandbox:orders -- --status`로 상태를 확인한다';

/** 바뀌지 않은 행: 지난 실행이 적어 둔 링크 칸을 그대로 쓴다 (없으면 사유). */
export function unchangedCell(previousCell: string, note: string): string {
  const kept = previousCell.trim();
  if (kept !== '') return kept;
  return note.trim() === '' ? NO_RECORD_CELL : `승인 링크 없음 — ${note}`;
}

/**
 * 지금 있는 링크 파일에서 주문 키별 링크 칸을 읽는다 (T030: 바뀌지 않은 행을 그대로 두기 위해).
 * 파일이 없거나 표가 아니면 빈 Map. 파일을 쓰지는 않는다.
 */
export function readApproveLinkCells(root: string = ROOT): Map<string, string> {
  const cells = new Map<string, string>();
  const file = approveLinksPath(root);
  if (!existsSync(file)) return cells;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.startsWith('|')) continue;
    const parts = line.split('|').map((cell) => cell.trim());
    // `| 키 | 구매자 | 금액 | 링크 |` → ['', 키, 구매자, 금액, 링크, '']
    if (parts.length < 6) continue;
    const key = parts[1];
    if (!/^O\d{2}$/.test(key)) continue;
    cells.set(key, parts[4]);
  }
  return cells;
}

/** 생성 결과 → 링크 파일 행 (바뀌지 않은 행은 기존 링크를 그대로 둔다). */
export function createLinkRows(rows: CreateRow[], previous: Map<string, string>): ApproveRow[] {
  return rows.map((r) => {
    const base = { key: r.key, buyer: r.buyer, amount: r.amount, approveUrl: r.approveUrl, note: r.note };
    if (r.approveUrl !== '') return base;
    return { ...base, linkCell: unchangedCell(previous.get(r.key) ?? '', r.note) };
  });
}

/** `--fresh` 결과 → 링크 파일 행 (승인·캡처된 행은 상태 표시, 바뀌지 않은 행은 기존 링크). */
export function freshLinkRows(rows: FreshRow[], previous: Map<string, string>): ApproveRow[] {
  return rows.map((r) => {
    const base = { key: r.key, buyer: r.buyer, amount: r.amount, approveUrl: r.approveUrl, note: r.note };
    if (r.result === 'kept-captured') return { ...base, linkCell: CAPTURED_CELL };
    if (r.result === 'kept-approved') return { ...base, linkCell: APPROVED_CELL };
    if (r.approveUrl !== '') return base;
    return { ...base, linkCell: unchangedCell(previous.get(r.key) ?? '', r.note) };
  });
}

/** `reports/sandbox-approve-links.md` 내용. 비밀값·이메일은 들어가지 않는다. */
export function renderApproveLinks(rows: ApproveRow[], now: Date = new Date(), note = ''): string {
  const done = rows.filter((r) => linkCellOf(r).startsWith('http'));
  const lines = [
    '# 샌드박스 승인 링크 (주문 12건)',
    '',
    `> \`npm run sandbox:orders\`가 ${kstStamp(now)}에 덮어썼다. 승인 링크 ${done.length}건 / 주문 ${rows.length}건.`,
    ...(note === '' ? [] : ['', `> ${note}`]),
    '',
    '**이 파일은 마지막 실행이 쓴 것만 쓴다. 승인을 시작한 뒤에는 `--fresh`를 다시 실행하지 않는다.**',
    '(`--fresh`는 아직 승인 전인 주문을 새 주문으로 바꾼다. 승인·캡처된 주문은 그대로 두고 링크 자리에 상태를 적는다.)',
    '',
    '**브라우저 에이전트**: 아래 링크를 한 건씩 열어 그 행의 샌드박스 구매자 계정으로 로그인해 결제를 승인한다 (계정 비밀번호는 사람이 넣는다).',
    '링크는 모두 `sandbox.paypal.com` 도메인이다 — 다른 도메인(특히 live `www.paypal.com`)이 나오면 즉시 멈추고 사람에게 알린다.',
    '**12건을 모두 승인한 뒤** 컨트롤 타워가 `npm run sandbox:capture`로 캡처한다 (승인 전에는 캡처되지 않는다).',
    '',
    row(['주문번호', '구매자', '금액', 'approve URL']),
    row(['---', '---', '---', '---']),
    ...rows.map((r) => row([r.key, buyerCell(r.buyer), `$${r.amount}`, linkCellOf(r)])),
    '',
  ];
  return `${lines.join('\n')}`;
}

/** 링크 파일을 덮어쓴다. */
export function writeApproveLinks(rows: ApproveRow[], now: Date = new Date(), root: string = ROOT, note = ''): string {
  const file = approveLinksPath(root);
  writeFileSync(file, renderApproveLinks(rows, now, note), 'utf8');
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
  console.log(
    `\n새로 만듦 ${count('created')} · 같은 요청 ID로 돌려받음 ${count('existing')} · 이미 있어 건드리지 않음 ${count('kept')} · 실패 ${count('failed')}`,
  );
}

function printStatus(rows: StatusRow[]): void {
  console.log(row(['키', '주문 ID', '주문 상태', 'HTTP', '캡처 ID', '추적', '비고']));
  console.log(row(['---', '---', '---', '---', '---', '---', '---']));
  for (const r of rows) {
    console.log(
      row([r.key, r.orderId, r.status || '-', r.httpStatus ?? '호출 실패', r.captureId || '-', r.tracked ? '등록' : '미등록', r.note]),
    );
  }
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    const label = r.status === '' ? r.note : r.status;
    byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
  }
  const summary = [...byStatus.entries()].map(([label, n]) => `${label} ${n}`).join(' · ');
  console.log(`\n주문 ${rows.length}건: ${summary}`);
}

function printFresh(rows: FreshRow[]): void {
  console.log(row(['키', '구매자', '금액', '결과', 'HTTP', '새 주문 ID', '이전 주문 ID', '주문 상태', '비고']));
  console.log(row(['---', '---', '---', '---', '---', '---', '---', '---', '---']));
  for (const r of rows) {
    console.log(
      row([
        r.key,
        r.buyer,
        `$${r.amount}`,
        FRESH_LABEL[r.result],
        r.httpStatus ?? '호출 실패',
        r.orderId || '-',
        r.previousOrderId || '-',
        r.orderStatus || '-',
        r.note,
      ]),
    );
  }
  const count = (result: FreshResult) => rows.filter((r) => r.result === result).length;
  const summary = (Object.keys(FRESH_LABEL) as FreshResult[])
    .filter((result) => count(result) > 0)
    .map((result) => `${FRESH_LABEL[result]} ${count(result)}`)
    .join(' · ');
  console.log(`\n주문 ${rows.length}건: ${summary}`);
}

// ── 명령줄 ─────────────────────────────────────────────────────────────────────

/** `create` 주문 만들기(기본) · `status` 상태만 조회 · `fresh` 새 요청 ID로 다시 만들기. */
export type OrdersMode = 'create' | 'status' | 'fresh';

export const ORDERS_USAGE = '쓰는 법: npm run sandbox:orders [-- --status | -- --fresh]';

/** `--` 없이 주면 npm이 삼키는 옵션들 (T030 지시서 5번). */
export const ORDERS_FLAGS = ['--status', '--fresh'];

/** 인자 해석. 모르는 인자나 두 개 이상이면 `error`를 돌려주고 호출하지 않는다. */
export function parseOrdersMode(args: string[]): { mode: OrdersMode } | { error: string } {
  const given = args.filter((arg) => arg !== '');
  if (given.length === 0) return { mode: 'create' };
  if (given.length === 1 && given[0] === '--status') return { mode: 'status' };
  if (given.length === 1 && given[0] === '--fresh') return { mode: 'fresh' };
  return { error: `${ORDERS_USAGE} (받은 것: ${given.join(' ')})` };
}

// ── 모드별 실행 (파일 쓰기·종료 코드) ───────────────────────────────────────────

/**
 * 모드 실행에 필요한 것만. 단위 테스트는 가짜 클라이언트와 임시 폴더를 넘긴다
 * (그래서 실제 PayPal도, 저장소의 manifest·링크 파일도 건드리지 않는다).
 */
export type OrdersDeps = { client: PayPalClient; root: string };

const printProblems = (problems: string[]): void => {
  if (problems.length === 0) return;
  console.log('\n문제:');
  for (const problem of problems) console.log(`- ${problem}`);
};

/** `-- --status`: 조회만 한다. manifest·링크 파일을 쓰지 않는다. */
export async function runStatusMode(deps: OrdersDeps, before: Manifest): Promise<number> {
  if (before.orders.length === 0) {
    console.error('manifest에 주문이 없다. 먼저 `npm run sandbox:orders`로 12건을 만든다.');
    return 1;
  }
  const { rows, problems } = await runOrderStatus(deps.client, before);
  console.log('');
  printStatus(rows);
  printProblems(problems);
  console.log('\n조회만 했다 — manifest·링크 파일은 쓰지 않았다.');
  return problems.length > 0 ? 1 : 0;
}

/**
 * 옵션 없는 실행: manifest에 **없는** 키만 만든다 (T030 지시서 2번).
 * 만든 주문이 0건이면 manifest·링크 파일을 쓰지 않는다.
 */
export async function runCreateMode(deps: OrdersDeps, specs: OrderSpec[], before: Manifest, now: Date): Promise<number> {
  let outcome: CreateOutcome;
  try {
    outcome = await runCreateOrders(deps.client, specs, before);
  } catch (error) {
    if (error instanceof NotSandboxLinkError) {
      console.error(`\n${error.message}`);
      console.error('링크 파일과 manifest는 쓰지 않았다. 남은 주문도 만들지 않았다.');
      return 1;
    }
    throw error;
  }

  const made = outcome.rows.filter((r) => r.result === 'created' || r.result === 'existing');
  const kept = outcome.rows.filter((r) => r.result === 'kept');

  console.log('');
  printRows(outcome.rows);
  printProblems(outcome.problems);

  if (made.length === 0) {
    if (kept.length === outcome.rows.length) {
      console.log(`\n${ALREADY_CREATED_NOTE}`);
      console.log('아무것도 만들지 않았다 — manifest·승인 링크 파일을 그대로 두었다 (주문 ID·캡처 ID·분쟁 기록이 남아 있다).');
      return 0;
    }
    console.error('\n만든 주문이 0건이다 — manifest·승인 링크 파일을 그대로 두었다. 위 문제를 보고 다시 실행한다.');
    return 1;
  }

  writeManifest({ ...before, orders: outcome.orders }, deps.root);
  const file = writeApproveLinks(
    createLinkRows(outcome.rows, readApproveLinkCells(deps.root)),
    now,
    deps.root,
    kept.length === 0
      ? ''
      : `이번 실행은 ${made.length}건만 새로 만들었다. 나머지 ${kept.length}건은 manifest에 이미 있어 건드리지 않았다 (링크 칸은 지난 실행이 적어 둔 값이다).`,
  );

  console.log(`\nmanifest 주문 ${outcome.orders.length}건 · 승인 링크 파일: ${path.relative(deps.root, file)}`);

  const missing = made.filter((r) => r.approveUrl === '').length;
  if (outcome.problems.length > 0 || missing > 0) {
    console.error(`\n새로 만든 ${made.length}건 가운데 ${missing}건이 승인 링크 없이 끝났다. 위 문제를 보고 다시 실행한다 (이미 있는 주문은 다시 만들지 않는다).`);
    return 1;
  }
  console.log('\n다음: 브라우저 에이전트가 링크를 승인한 뒤 `npm run sandbox:capture`.');
  return 0;
}

/**
 * `--fresh`: 접미사를 **여기서 한 번만** 만들어 넘긴다 (12건이 같은 값을 쓴다).
 * 새로 만든 주문이 0건이면 manifest·링크 파일을 그대로 둔다 (T030 지시서 4번).
 */
export async function runFreshMode(deps: OrdersDeps, specs: OrderSpec[], before: Manifest, now: Date): Promise<number> {
  const suffix = freshSuffix(now);
  console.log(`요청 ID 접미사: ${suffix} (같은 분에 다시 돌리면 같은 주문이 돌아온다)`);

  let outcome: FreshOutcome;
  try {
    outcome = await runFreshOrders(deps.client, specs, before, suffix);
  } catch (error) {
    if (error instanceof NotSandboxLinkError) {
      console.error(`\n${error.message}`);
      console.error('링크 파일과 manifest는 쓰지 않았다. 남은 주문도 만들지 않았다.');
      return 1;
    }
    throw error;
  }

  console.log('');
  printFresh(outcome.rows);

  const made = outcome.rows.filter((r) => r.result === 'recreated' || r.result === 'existing');
  if (made.length === 0) {
    console.log('\n새로 만든 주문이 0건이다 — manifest와 승인 링크 파일을 그대로 두었다 (지난 실행의 링크가 남아 있다).');
  } else {
    writeManifest({ ...before, orders: outcome.orders }, deps.root);
    const file = writeApproveLinks(
      freshLinkRows(outcome.rows, readApproveLinkCells(deps.root)),
      now,
      deps.root,
      `\`-- --fresh\`로 ${made.length}건을 다시 만들었다 (요청 ID 접미사 ${suffix}). 나머지 행은 그대로다 — 승인·캡처된 주문은 링크 대신 상태를, 손대지 않은 주문은 지난 링크를 적었다. 이전 주문 ID는 manifest의 previousOrderIds에 남아 있다.`,
    );
    console.log(`\nmanifest 주문 ${outcome.orders.length}건 · 승인 링크 파일: ${path.relative(deps.root, file)}`);
  }

  printProblems(outcome.problems);

  const missing = made.filter((r) => r.approveUrl === '').length;
  if (outcome.problems.length > 0 || missing > 0) {
    console.error(
      '\n위 문제를 사람이 본다. 그대로 둔 주문(kept·skipped)은 새로 만들지 않았다 — ' +
        '승인을 한 건이라도 시작한 뒤에는 `--fresh`를 다시 돌리지 않는다.',
    );
    return 1;
  }
  console.log('\n다음: 브라우저 에이전트가 새 링크를 승인한 뒤 `npm run sandbox:capture`.');
  return 0;
}

// ── 진입점 ─────────────────────────────────────────────────────────────────────

/** 진입점이 바깥에서 받는 것 (단위 테스트는 실제 자격 증명·네트워크 대신 이걸 넘긴다). */
export type OrdersMainDeps = {
  loadEnv?: () => PayPalEnv;
  makeClient?: (env: PayPalEnv) => PayPalClient;
  root?: string;
};

export async function main(
  args: string[] = process.argv.slice(2),
  now: Date = new Date(),
  procEnv: EnvVars = process.env,
  deps: OrdersMainDeps = {},
): Promise<number> {
  // `--` 없이 준 옵션은 npm이 삼킨다 — 자격 증명을 읽기도 전에 멈춘다 (T030 지시서 5번).
  const swallowed = swallowedOptionsError('sandbox:orders', ORDERS_FLAGS, args, procEnv);
  if (swallowed !== undefined) {
    console.error(swallowed);
    return 1;
  }

  const parsed = parseOrdersMode(args);
  if ('error' in parsed) {
    console.error(parsed.error);
    return 1;
  }
  const { mode } = parsed;
  const root = deps.root ?? ROOT;

  let env: PayPalEnv;
  try {
    env = (deps.loadEnv ?? loadSandboxEnv)();
  } catch (error) {
    console.error(error instanceof SandboxEnvError ? error.message : '자격 증명을 읽지 못했다.');
    return 1;
  }

  const client = (deps.makeClient ?? ((value: PayPalEnv) => createSandboxClient(value, (line) => console.log(`  · ${line}`))))(env);
  const before = readManifest(root);
  const ordersDeps: OrdersDeps = { client, root };

  // `--status`는 시드를 읽지 않는다 (manifest에 적힌 주문만 조회한다).
  if (mode === 'status') return runStatusMode(ordersDeps, before);

  let specs: OrderSpec[];
  try {
    specs = readSandboxOrderSpecs();
  } catch (error) {
    console.error(`시드를 읽지 못했다: ${failureLine(error)}`);
    return 1;
  }

  if (mode === 'fresh') return runFreshMode(ordersDeps, specs, before, now);
  return runCreateMode(ordersDeps, specs, before, now);
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
