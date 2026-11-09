/**
 * 단위 테스트: 샌드박스 주문 생성·캡처 스크립트 (T026) + `--status`·`--fresh` 옵션 (T029).
 * 가짜 PayPal 클라이언트로만 돈다 — 실제 샌드박스를 부르지 않는다.
 *
 * 확인하는 것
 *  - 시드 읽기: 샌드박스 12건, 구매자별 주문 수(T001 표), 추적 7건, 상품명·금액
 *  - 요청 본문: intent CAPTURE, 상품명, 금액(USD), 요청 ID가 주문 키 기준
 *  - 다시 실행: 같은 요청 ID → 200으로 같은 주문 ID → manifest에 중복이 생기지 않는다
 *  - 승인 링크: approve/payer-action 고르기, 샌드박스가 아닌 도메인이면 멈춤, 링크 파일 형식
 *  - 캡처: APPROVED면 캡처, COMPLETED면 건너뜀, 승인 전이면 "not approved yet"
 *  - `--status`(T029): 조회만, 만료는 "expired or not found"
 *  - `--fresh`(T029): 새 요청 ID, 캡처된 주문 보존, manifest·링크 파일 갱신, 같은 접미사면 중복 없음
 *  - 출력·링크 파일·manifest에 비밀값(Secret·토큰·Authorization)이 없다
 */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUYER_DISPLAY_NAME,
  CAPTURED_CELL,
  EXPIRED_NOTE,
  KEPT_NOTE,
  NotSandboxLinkError,
  ORDERS_PER_BUYER,
  TRACKED_COUNT,
  amountText,
  approveUrlFrom,
  approveUrlKind,
  buildOrderBody,
  buyerCell,
  freshLinkRows,
  freshSuffix,
  looksGone,
  orderRequestId,
  parseOrdersMode,
  readSandboxOrderSpecs,
  renderApproveLinks,
  runCreateOrders,
  runFreshOrders,
  runOrderStatus,
  writeApproveLinks,
  type CreateRow,
  type OrderSpec,
} from '../../scripts/create-sandbox-orders';
import { captureRequestId, runCapture } from '../../scripts/capture-sandbox-orders';
import { ManifestSchema, type Manifest } from '../../scripts/sandbox/manifest';
import type { ApiRequest, PayPalClient } from '@/types';

type Seen = { method: 'GET' | 'POST'; path: string; requestId?: string; body?: Record<string, unknown> };
type Reply = { status: number; body?: unknown };

/** 경로(그리고 POST면 메서드)로 답을 고르는 가짜 클라이언트. 모르는 경로는 404. */
function fakeClient(replies: Record<string, Reply | (() => Reply)>): { client: PayPalClient; seen: Seen[] } {
  const seen: Seen[] = [];
  const answer = (key: string): Reply => {
    const reply = replies[key];
    if (reply === undefined) return { status: 404, body: { name: 'NOT_FOUND' } };
    return typeof reply === 'function' ? reply() : reply;
  };
  const client: PayPalClient = {
    get: async (p: string) => {
      seen.push({ method: 'GET', path: p });
      const { status, body = {} } = answer(`GET ${p}`);
      return { status, body };
    },
    call: async (req: ApiRequest) => {
      seen.push({ method: 'POST', path: req.path, requestId: req.requestId, body: req.body });
      const { status, body = {} } = answer(`POST ${req.path}`);
      return { status, body };
    },
  };
  return { client, seen };
}

const SANDBOX_APPROVE = 'https://www.sandbox.paypal.com/checkoutnow?token=';

/** `POST /v2/checkout/orders` 응답 한 건. */
const orderCreated = (orderId: string, approveHost = 'https://www.sandbox.paypal.com') => ({
  id: orderId,
  status: 'CREATED',
  links: [
    { href: `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}`, rel: 'self', method: 'GET' },
    { href: `${approveHost}/checkoutnow?token=${orderId}`, rel: 'approve', method: 'GET' },
  ],
});

const emptyManifest: Manifest = { orders: [], disputes: [] };

const specOf = (key: string, buyer: string, itemName: string, amount: string, tracked = false): OrderSpec => ({
  key,
  buyer,
  sku: 'FK-BN-SET',
  itemName,
  amount,
  tracked,
});

describe('readSandboxOrderSpecs (시드 읽기)', () => {
  const specs = readSandboxOrderSpecs();

  it('시드의 샌드박스 주문 12건을 키 순서(O01~O12)로 읽는다', () => {
    expect(specs).toHaveLength(12);
    expect(specs.map((s) => s.key)).toEqual(['O01', 'O02', 'O03', 'O04', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10', 'O11', 'O12']);
  });

  it('구매자별 주문 수가 T001 표와 같다 (서연 1·지호 1·Yuki 3·Lena 2·buyer_m 5)', () => {
    const byBuyer = specs.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.buyer]: (acc[s.buyer] ?? 0) + 1 }), {});
    expect(byBuyer).toEqual(ORDERS_PER_BUYER);
    expect(specs.filter((s) => s.tracked)).toHaveLength(TRACKED_COUNT);
  });

  it('상품명·금액은 seed/products.json에서 온다 (O01 Wool Sweater $72, O02 Knit Cardigan $48)', () => {
    expect(specs[0]).toEqual({ key: 'O01', buyer: 'seoyeon', sku: 'FK-SW-NV', itemName: 'Wool Sweater, Navy', amount: '72.00', tracked: true });
    expect(specs[1]).toMatchObject({ key: 'O02', buyer: 'jiho', itemName: 'Knit Cardigan, Oat', amount: '48.00', tracked: false });
    expect(specs.find((s) => s.key === 'O05')).toMatchObject({ buyer: 'yuki', itemName: 'Beanie + Scarf Set', amount: '35.00' });
  });

  it('금액 문자열은 센트를 그대로 옮긴다', () => {
    expect(amountText(7200)).toBe('72.00');
    expect(amountText(3500)).toBe('35.00');
  });

  it('시드가 T001 표와 다르면 만들지 않고 던진다 (추측하지 않는다)', () => {
    const products = [{ sku: 'FK-BN-SET', itemName: 'Beanie + Scarf Set', priceCents: 3500 }];
    const oneOrder = [{ id: 'O01', buyerId: 'B01', sku: 'FK-BN-SET', amountCents: 3500, tracked: true, source: 'sandbox' }];

    expect(() => readSandboxOrderSpecs(oneOrder, products)).toThrow(/12건/);
    expect(() =>
      readSandboxOrderSpecs([{ ...oneOrder[0], buyerId: 'B99' }], products),
    ).toThrow(/T001 표에 없다/);
    expect(() =>
      readSandboxOrderSpecs([{ ...oneOrder[0], amountCents: 100 }], products),
    ).toThrow(/금액이 상품/);
    expect(() => readSandboxOrderSpecs([{ ...oneOrder[0], sku: 'FK-NONE' }], products)).toThrow(/products.json에 없다/);
  });
});

describe('buildOrderBody (요청 본문)', () => {
  it('intent CAPTURE · 상품명 · 상품 가격(USD)을 담는다', () => {
    expect(buildOrderBody(specOf('O01', 'seoyeon', 'Wool Sweater, Navy', '72.00'))).toEqual({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'O01',
          amount: { currency_code: 'USD', value: '72.00', breakdown: { item_total: { currency_code: 'USD', value: '72.00' } } },
          items: [{ name: 'Wool Sweater, Navy', quantity: '1', unit_amount: { currency_code: 'USD', value: '72.00' } }],
        },
      ],
    });
  });

  it('구매자 이름·이메일은 본문에 넣지 않는다', () => {
    const text = JSON.stringify(buildOrderBody(specOf('O01', 'seoyeon', 'Wool Sweater, Navy', '72.00')));
    for (const name of Object.values(BUYER_DISPLAY_NAME)) expect(text).not.toContain(name);
    expect(text).not.toContain('seoyeon');
    expect(text).not.toContain('@');
  });

  it('요청 ID는 주문 키 기준이라 다시 실행해도 같다', () => {
    expect(orderRequestId('O01')).toBe('afterloop-order-O01');
    expect(orderRequestId('O01')).not.toBe(orderRequestId('O02'));
  });
});

describe('runCreateOrders (주문 생성)', () => {
  const specs = readSandboxOrderSpecs();

  it('12건을 한 건씩 POST하고 주문 ID·승인 링크를 모은다', async () => {
    let n = 0;
    const { client, seen } = fakeClient({
      'POST /v2/checkout/orders': () => {
        n += 1;
        return { status: 201, body: orderCreated(`ORDER-${n}`) };
      },
    });

    const { rows, orders, problems } = await runCreateOrders(client, specs, emptyManifest);

    expect(seen).toHaveLength(12);
    expect(seen.every((s) => s.method === 'POST' && s.path === '/v2/checkout/orders')).toBe(true);
    expect(seen.map((s) => s.requestId)).toEqual(specs.map((s) => orderRequestId(s.key)));
    expect(seen[0].body).toEqual(buildOrderBody(specs[0]));
    expect(rows.every((r) => r.result === 'created' && r.approveUrl.startsWith(SANDBOX_APPROVE))).toBe(true);
    expect(problems).toEqual([]);

    // manifest 모양: AC13이 읽는 키·주문 ID·구매자·SKU·추적만
    expect(orders).toHaveLength(12);
    expect(orders[0]).toEqual({ key: 'O01', orderId: 'ORDER-1', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true });
    expect(orders.filter((o) => o.tracked)).toHaveLength(TRACKED_COUNT);
    expect(JSON.stringify(orders)).not.toContain('@');
  });

  // T030: 다시 실행해도 manifest에 있는 주문은 POST하지 않는다 (전에는 12건을 다시 POST하고 PayPal 멱등에 맡겼다).
  it('다시 실행하면 이미 있는 주문은 POST하지 않는다 (호출 0회)', async () => {
    const first = await runCreateOrders(
      fakeClient({ 'POST /v2/checkout/orders': { status: 201, body: orderCreated('ORDER-SAME') } }).client,
      specs,
      emptyManifest,
    );

    const { client, seen } = fakeClient({
      'POST /v2/checkout/orders': () => {
        throw new Error('이미 있는 주문을 다시 POST하면 안 된다');
      },
    });
    const second = await runCreateOrders(client, specs, { orders: first.orders, disputes: [] });

    expect(seen).toEqual([]);
    expect(second.rows.every((r) => r.result === 'kept')).toBe(true);
    expect(second.orders).toEqual(first.orders);
    expect(second.problems).toEqual([]);
  });

  it('manifest에 주문 ID가 있는 키는 건드리지 않는다 (captureId·previousOrderIds 그대로)', async () => {
    const { client, seen } = fakeClient({ 'POST /v2/checkout/orders': { status: 201, body: orderCreated('ORDER-NEW') } });
    const before = {
      key: 'O01',
      orderId: 'ORDER-OLD',
      buyer: 'seoyeon',
      sku: 'FK-SW-NV',
      tracked: true,
      captureId: 'CAP-OLD',
      previousOrderIds: ['ORDER-OLDEST'],
    };

    const { rows, orders, problems } = await runCreateOrders(client, [specs[0]], { orders: [before], disputes: [] });

    expect(seen).toEqual([]);
    expect(orders).toEqual([before]);
    expect(rows[0].result).toBe('kept');
    expect(rows[0].orderId).toBe('ORDER-OLD');
    expect(rows[0].note).toBe(KEPT_NOTE);
    expect(problems).toEqual([]);
  });

  it('manifest에 없는 키만 만든다 (일부만 비어 있을 때)', async () => {
    const { client, seen } = fakeClient({ 'POST /v2/checkout/orders': { status: 201, body: orderCreated('ORDER-NEW') } });
    const kept = { key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true, captureId: 'CAP-O01' };

    const { rows, orders } = await runCreateOrders(client, specs.slice(0, 2), { orders: [kept], disputes: [] });

    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(1);
    expect(seen[0].requestId).toBe(orderRequestId('O02'));
    expect(rows.map((r) => r.result)).toEqual(['kept', 'created']);
    expect(orders).toEqual([kept, { key: 'O02', orderId: 'ORDER-NEW', buyer: 'jiho', sku: 'FK-CD-OAT', tracked: false }]);
  });

  it('시드에 없는 키의 manifest 항목도 지우지 않는다', async () => {
    const { client } = fakeClient({ 'POST /v2/checkout/orders': { status: 201, body: orderCreated('ORDER-NEW') } });
    const stranger = { key: 'O99', orderId: 'ORDER-O99', buyer: 'buyer_m', sku: 'FK-BN-SET', tracked: false, captureId: 'CAP-O99' };

    const { orders } = await runCreateOrders(client, [specs[0]], { orders: [stranger], disputes: [] });

    expect(orders).toContainEqual(stranger);
  });

  it('한 건이 422면 오류 name·issue를 적고 나머지는 계속 만든다', async () => {
    let n = 0;
    const { client } = fakeClient({
      'POST /v2/checkout/orders': () => {
        n += 1;
        if (n === 1) return { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'CURRENCY_NOT_SUPPORTED' }], debug_id: 'dbg-9' } };
        return { status: 201, body: orderCreated(`ORDER-${n}`) };
      },
    });

    const { rows, orders, problems } = await runCreateOrders(client, specs, emptyManifest);

    expect(rows[0].result).toBe('failed');
    expect(rows[0].note).toBe('UNPROCESSABLE_ENTITY · CURRENCY_NOT_SUPPORTED · debug_id=dbg-9');
    expect(rows.slice(1).every((r) => r.result === 'created')).toBe(true);
    expect(orders).toHaveLength(11);
    expect(problems[0]).toContain('O01 주문 생성 → 422');
  });

  it('승인 링크 도메인이 샌드박스가 아니면 그 자리에서 멈춘다 (live 금지)', async () => {
    const { client, seen } = fakeClient({
      'POST /v2/checkout/orders': { status: 201, body: orderCreated('ORDER-LIVE', 'https://www.paypal.com') },
    });

    await expect(runCreateOrders(client, specs, emptyManifest)).rejects.toThrow(NotSandboxLinkError);
    expect(seen).toHaveLength(1); // 남은 주문은 만들지 않는다
  });

  it('멈출 때의 문구에는 도메인만 담고 링크 전체는 담지 않는다', async () => {
    const { client } = fakeClient({
      'POST /v2/checkout/orders': { status: 201, body: orderCreated('ORDER-LIVE', 'https://www.paypal.com') },
    });

    await expect(runCreateOrders(client, [specs[0]], emptyManifest)).rejects.toThrow(
      /live PayPal 도메인\(www\.paypal\.com\)/,
    );
    await expect(runCreateOrders(client, [specs[0]], emptyManifest)).rejects.not.toThrow(/checkoutnow/);
  });
});

describe('승인 링크 고르기', () => {
  it('approve가 없으면 payer-action을 쓴다', () => {
    expect(approveUrlFrom({ links: [{ rel: 'approve', href: 'https://a' }, { rel: 'payer-action', href: 'https://b' }] })).toBe('https://a');
    expect(approveUrlFrom({ links: [{ rel: 'self', href: 'https://s' }, { rel: 'payer-action', href: 'https://b' }] })).toBe('https://b');
    expect(approveUrlFrom({ links: [{ rel: 'self', href: 'https://s' }] })).toBe('');
    expect(approveUrlFrom({})).toBe('');
  });

  it('샌드박스 도메인만 sandbox로 본다', () => {
    expect(approveUrlKind('https://www.sandbox.paypal.com/checkoutnow?token=X')).toBe('sandbox');
    expect(approveUrlKind('https://sandbox.paypal.com/checkoutnow?token=X')).toBe('sandbox');
    expect(approveUrlKind('https://www.paypal.com/checkoutnow?token=X')).toBe('live');
    expect(approveUrlKind('https://www.paypal.com.evil.test/checkoutnow')).toBe('unknown');
    expect(approveUrlKind('http://www.sandbox.paypal.com/checkoutnow')).toBe('unknown');
    expect(approveUrlKind('not-a-url')).toBe('unknown');
  });
});

describe('reports/sandbox-approve-links.md', () => {
  const rowsOf = async (): Promise<CreateRow[]> => {
    let n = 0;
    const { client } = fakeClient({
      'POST /v2/checkout/orders': () => {
        n += 1;
        return { status: 201, body: orderCreated(`ORDER-${n}`) };
      },
    });
    const { rows } = await runCreateOrders(client, readSandboxOrderSpecs(), emptyManifest);
    return rows;
  };

  it('안내 뒤에 `주문번호 | 구매자 | 금액 | approve URL` 12행이 온다', async () => {
    const text = renderApproveLinks(await rowsOf(), new Date('2026-11-09T14:00:00Z'));
    const lines = text.split('\n');
    const header = lines.findIndex((l) => l.startsWith('| 주문번호 |'));

    expect(header).toBeGreaterThan(0);
    expect(lines[header]).toBe('| 주문번호 | 구매자 | 금액 | approve URL |');
    const body = lines.slice(header + 2).filter((l) => l.startsWith('|'));
    expect(body).toHaveLength(12);
    expect(body[0]).toBe(`| O01 | seoyeon = Seoyeon Kim | $72.00 | ${SANDBOX_APPROVE}ORDER-1 |`);
    expect(body[11]).toBe(`| O12 | buyer_m = Mike Morgan | $48.00 | ${SANDBOX_APPROVE}ORDER-12 |`);
    expect(lines.slice(0, header).join('\n')).toContain('브라우저 에이전트');
    expect(text).toContain('2026-11-09 23:00 KST');
  });

  it('구매자 칸에 시드 키와 표시 이름이 함께 들어가고 이메일은 없다', async () => {
    const text = renderApproveLinks(await rowsOf());
    expect(buyerCell('yuki')).toBe('yuki = Yuki Tanaka');
    for (const [key, name] of Object.entries(BUYER_DISPLAY_NAME)) expect(text).toContain(`${key} = ${name}`);
    expect(text).not.toContain('@');
  });

  it('승인 URL 12개가 모두 sandbox.paypal.com이다', async () => {
    const text = renderApproveLinks(await rowsOf());
    const urls = [...text.matchAll(/https?:\/\/[^\s|]+/g)].map((m) => m[0]);
    expect(urls).toHaveLength(12);
    for (const url of urls) expect(approveUrlKind(url)).toBe('sandbox');
  });

  it('비밀값·토큰 꼴은 들어가지 않는다', async () => {
    const text = renderApproveLinks(await rowsOf());
    expect(text).not.toMatch(/access_token/i);
    expect(text).not.toMatch(/client_secret/i);
    expect(text).not.toMatch(/authorization/i);
    expect(text).not.toMatch(/Bearer\s/i);
    expect(text).not.toMatch(/Basic\s/i);
  });

  it('승인 링크가 없는 행은 사유를 적는다 (링크 자리에 빈 칸을 두지 않는다)', () => {
    const failed: CreateRow = {
      key: 'O01',
      buyer: 'seoyeon',
      sku: 'FK-SW-NV',
      itemName: 'Wool Sweater, Navy',
      amount: '72.00',
      tracked: true,
      result: 'failed',
      httpStatus: 422,
      orderId: '',
      orderStatus: '',
      approveUrl: '',
      note: 'UNPROCESSABLE_ENTITY',
    };
    expect(renderApproveLinks([failed])).toContain('| O01 | seoyeon = Seoyeon Kim | $72.00 | 승인 링크 없음 — UNPROCESSABLE_ENTITY |');
  });

  it('파일을 덮어쓴다', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'afterloop-links-'));
    mkdirSync(path.join(root, 'reports'), { recursive: true });
    const rows = await rowsOf();

    const file = writeApproveLinks(rows, new Date('2026-11-09T14:00:00Z'), root);
    writeApproveLinks(rows.slice(0, 1), new Date('2026-11-09T15:00:00Z'), root);

    const text = readFileSync(file, 'utf8');
    expect(text).toContain('승인 링크 1건 / 주문 1건');
    expect(text).not.toContain('ORDER-12');
  });
});

describe('runCapture (캡처)', () => {
  const manifest: Manifest = {
    orders: [
      { key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true },
      { key: 'O02', orderId: 'ORDER-O02', buyer: 'jiho', sku: 'FK-CD-OAT', tracked: false },
      { key: 'O03', orderId: 'ORDER-O03', buyer: 'yuki', sku: 'FK-CD-OAT', tracked: false },
    ],
    disputes: [],
  };

  const detail = (status: string, captureId?: string) => ({
    id: 'ORDER-X',
    status,
    purchase_units: [{ payments: { captures: captureId === undefined ? [] : [{ id: captureId, status: 'COMPLETED' }] } }],
  });

  /** 캡처 응답 (T030: 캡처 자체의 상태를 담는다). */
  const captureBody = (captureId: string, status = 'COMPLETED', reason?: string) => ({
    id: 'ORDER-O01',
    status: 'COMPLETED',
    purchase_units: [
      {
        payments: {
          captures: [{ id: captureId, status, ...(reason === undefined ? {} : { status_details: { reason } }) }],
        },
      },
    ],
  });

  it('APPROVED면 캡처하고, COMPLETED면 건너뛰고, 승인 전이면 넘어간다', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: detail('APPROVED') },
      'POST /v2/checkout/orders/ORDER-O01/capture': { status: 201, body: captureBody('CAP-O01') },
      'GET /v2/checkout/orders/ORDER-O02': { status: 200, body: detail('COMPLETED', 'CAP-O02') },
      'GET /v2/checkout/orders/ORDER-O03': { status: 200, body: detail('CREATED') },
    });

    const notes: string[] = [];
    const { rows, orders, problems } = await runCapture(client, manifest, (line) => notes.push(line));

    expect(notes).toEqual(['O03 (ORDER-O03): not approved yet · 주문 상태 CREATED']);
    expect(rows.map((r) => [r.key, r.result, r.captureId])).toEqual([
      ['O01', 'captured', 'CAP-O01'],
      ['O02', 'skipped', 'CAP-O02'],
      ['O03', 'not_approved', ''],
    ]);
    expect(rows[0].label).toBe('captured · ok');
    expect(rows[2].note).toBe('not approved yet');
    expect(problems).toEqual([]);
    expect(orders.map((o) => o.captureId)).toEqual(['CAP-O01', 'CAP-O02', undefined]);
    // 승인 전·이미 캡처된 주문에는 POST하지 않는다
    expect(seen.filter((s) => s.method === 'POST').map((s) => s.path)).toEqual(['/v2/checkout/orders/ORDER-O01/capture']);
  });

  it('캡처 요청 ID는 주문 키 기준이고 본문은 비어 있다', async () => {
    const { client, seen } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: detail('APPROVED') },
      'POST /v2/checkout/orders/ORDER-O01/capture': { status: 201, body: captureBody('CAP-O01') },
    });

    await runCapture(client, { orders: [manifest.orders[0]], disputes: [] });

    const post = seen.find((s) => s.method === 'POST');
    expect(post?.requestId).toBe('afterloop-capture-O01');
    expect(captureRequestId('O01')).toBe('afterloop-capture-O01');
    expect(post?.body).toEqual({});
  });

  it('이미 캡처됨(422 ORDER_ALREADY_CAPTURED)이면 주문을 다시 읽어 캡처 ID를 적는다', async () => {
    let gets = 0;
    const { client } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': () => {
        gets += 1;
        return { status: 200, body: detail(gets === 1 ? 'APPROVED' : 'COMPLETED', gets === 1 ? undefined : 'CAP-O01') };
      },
      'POST /v2/checkout/orders/ORDER-O01/capture': {
        status: 422,
        body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] },
      },
    });

    const { rows, problems } = await runCapture(client, { orders: [manifest.orders[0]], disputes: [] });

    expect(rows[0].result).toBe('skipped');
    expect(rows[0].captureId).toBe('CAP-O01');
    expect(problems).toEqual([]);
  });

  it('캡처가 실패하면 오류 name·issue를 적고 다음 주문으로 넘어간다', async () => {
    const { client } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: detail('APPROVED') },
      'POST /v2/checkout/orders/ORDER-O01/capture': {
        status: 422,
        body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'INSTRUMENT_DECLINED' }], debug_id: 'dbg-2' },
      },
      'GET /v2/checkout/orders/ORDER-O02': { status: 200, body: detail('COMPLETED', 'CAP-O02') },
    });

    const { rows, orders, problems } = await runCapture(client, { orders: manifest.orders.slice(0, 2), disputes: [] });

    expect(rows[0].result).toBe('failed');
    expect(rows[0].note).toBe('UNPROCESSABLE_ENTITY · INSTRUMENT_DECLINED · debug_id=dbg-2');
    expect(rows[1].result).toBe('skipped');
    expect(problems[0]).toContain('O01 캡처 → 422');
    expect(orders[0].captureId).toBeUndefined();
  });

  it('주문 조회가 실패해도 manifest의 주문은 지우지 않는다', async () => {
    const { client } = fakeClient({ 'GET /v2/checkout/orders/ORDER-O01': { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } } });

    const { rows, orders } = await runCapture(client, { orders: [manifest.orders[0]], disputes: [] });

    expect(rows[0].result).toBe('failed');
    expect(orders).toEqual([manifest.orders[0]]);
  });

  it('결과에 비밀값·구매자 개인정보가 들어가지 않는다', async () => {
    const { client } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': {
        status: 200,
        body: {
          ...detail('COMPLETED', 'CAP-O01'),
          payer: { email_address: 'buyer@example.test', payer_id: 'PAYER1', name: { given_name: 'Seoyeon' } },
        },
      },
    });

    const { rows, orders } = await runCapture(client, { orders: [manifest.orders[0]], disputes: [] });

    const text = JSON.stringify({ rows, orders });
    expect(text).not.toContain('@');
    expect(text).not.toContain('PAYER1');
    expect(text).not.toMatch(/access_token|authorization|bearer/i);
  });
});

// ── T029: `--status`·`--fresh` ──────────────────────────────────────────────────

/** manifest 12건 (주문 ID는 `ORDER-O01` 꼴로 단순화). */
const manifest12 = (): Manifest => ({
  orders: readSandboxOrderSpecs().map((spec) => ({
    key: spec.key,
    orderId: `ORDER-${spec.key}`,
    buyer: spec.buyer,
    sku: spec.sku,
    tracked: spec.tracked,
  })),
  disputes: [],
});

/** 주문 상세 응답 1건. */
const orderDetail = (status: string, options: { captureId?: string; trackerStatus?: string } = {}) => ({
  id: 'ORDER-X',
  status,
  purchase_units: [
    {
      ...(options.trackerStatus === undefined ? {} : { shipping: { trackers: [{ status: options.trackerStatus }] } }),
      payments: { captures: options.captureId === undefined ? [] : [{ id: options.captureId }] },
    },
  ],
});

describe('parseOrdersMode (명령줄)', () => {
  it('인자가 없으면 주문 만들기, `--status`·`--fresh`는 그 모드다', () => {
    expect(parseOrdersMode([])).toEqual({ mode: 'create' });
    expect(parseOrdersMode(['--status'])).toEqual({ mode: 'status' });
    expect(parseOrdersMode(['--fresh'])).toEqual({ mode: 'fresh' });
  });

  it('모르는 인자나 두 개를 같이 주면 호출하지 않고 쓰는 법을 알려 준다', () => {
    expect(parseOrdersMode(['--status', '--fresh'])).toMatchObject({ error: expect.stringContaining('쓰는 법') });
    expect(parseOrdersMode(['--capture'])).toMatchObject({ error: expect.stringContaining('--capture') });
    expect(parseOrdersMode(['status'])).toMatchObject({ error: expect.stringContaining('status') });
  });
});

describe('runOrderStatus (`-- --status`)', () => {
  it('manifest 주문마다 GET 1회로 상태를 읽고 아무것도 만들지 않는다', async () => {
    const manifest = manifest12();
    const replies: Record<string, Reply> = {};
    for (const order of manifest.orders) {
      replies[`GET /v2/checkout/orders/${order.orderId}`] = { status: 200, body: orderDetail('CREATED') };
    }
    const { client, seen } = fakeClient(replies);

    const { rows, problems } = await runOrderStatus(client, manifest);

    expect(rows).toHaveLength(12);
    expect(seen).toHaveLength(12);
    expect(seen.every((s) => s.method === 'GET')).toBe(true);
    expect(rows.every((r) => r.status === 'CREATED' && r.httpStatus === 200 && r.note === 'ok')).toBe(true);
    expect(rows.map((r) => r.key)).toEqual(manifest.orders.map((o) => o.key));
    expect(problems).toEqual([]);
  });

  it('상태·캡처 ID·추적 여부를 그대로 옮긴다 (취소된 추적은 미등록)', async () => {
    const manifest: Manifest = { orders: manifest12().orders.slice(0, 3), disputes: [] };
    const { client } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': { status: 200, body: orderDetail('COMPLETED', { captureId: 'CAP-O01', trackerStatus: 'SHIPPED' }) },
      'GET /v2/checkout/orders/ORDER-O02': { status: 200, body: orderDetail('APPROVED') },
      'GET /v2/checkout/orders/ORDER-O03': { status: 200, body: orderDetail('COMPLETED', { captureId: 'CAP-O03', trackerStatus: 'CANCELLED' }) },
    });

    const { rows } = await runOrderStatus(client, manifest);

    expect(rows.map((r) => [r.key, r.status, r.captureId, r.tracked])).toEqual([
      ['O01', 'COMPLETED', 'CAP-O01', true],
      ['O02', 'APPROVED', '', false],
      ['O03', 'COMPLETED', 'CAP-O03', false],
    ]);
  });

  it('404·만료로 보이는 응답은 "expired or not found"로 적고 나머지는 계속 읽는다', async () => {
    const manifest: Manifest = { orders: manifest12().orders.slice(0, 3), disputes: [] };
    const { client } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': { status: 404, body: { name: 'RESOURCE_NOT_FOUND', debug_id: 'dbg-1' } },
      'GET /v2/checkout/orders/ORDER-O02': { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_EXPIRED' }] } },
      'GET /v2/checkout/orders/ORDER-O03': { status: 200, body: orderDetail('PAYER_ACTION_REQUIRED') },
    });

    const { rows, problems } = await runOrderStatus(client, manifest);

    expect(rows.map((r) => [r.key, r.status, r.note])).toEqual([
      ['O01', '', EXPIRED_NOTE],
      ['O02', '', EXPIRED_NOTE],
      ['O03', 'PAYER_ACTION_REQUIRED', 'ok'],
    ]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('O01 주문 조회 → 404');
  });

  it('만료가 아닌 오류는 그대로 요약한다 (멋대로 만료로 읽지 않는다)', async () => {
    const { client } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': { status: 403, body: { name: 'NOT_AUTHORIZED', debug_id: 'dbg-3' } },
    });

    const { rows } = await runOrderStatus(client, { orders: manifest12().orders.slice(0, 1), disputes: [] });

    expect(rows[0].note).toBe('NOT_AUTHORIZED · debug_id=dbg-3');
    expect(looksGone(403, { name: 'NOT_AUTHORIZED' })).toBe(false);
    expect(looksGone(404, {})).toBe(true);
    expect(looksGone(422, { details: [{ issue: 'ORDER_EXPIRED' }] })).toBe(true);
  });

  it('호출이 예외로 끝나도 나머지 주문을 계속 읽는다', async () => {
    const manifest: Manifest = { orders: manifest12().orders.slice(0, 2), disputes: [] };
    const client: PayPalClient = {
      get: async (p: string) => {
        if (p.endsWith('ORDER-O01')) throw new Error('PayPal GET /v2/checkout/orders 실패: 네트워크');
        return { status: 200, body: orderDetail('CREATED') };
      },
      call: async () => {
        throw new Error('POST를 보내면 안 된다');
      },
    };

    const { rows, problems } = await runOrderStatus(client, manifest);

    expect(rows.map((r) => [r.key, r.httpStatus])).toEqual([
      ['O01', null],
      ['O02', 200],
    ]);
    expect(problems[0]).toContain('O01 주문 조회 실패');
  });

  it('구매자 개인정보는 결과에 담지 않는다', async () => {
    const { client } = fakeClient({
      'GET /v2/checkout/orders/ORDER-O01': {
        status: 200,
        body: {
          ...orderDetail('COMPLETED', { captureId: 'CAP-O01' }),
          payer: { email_address: 'buyer@example.test', payer_id: 'PAYER1', name: { given_name: 'Seoyeon' } },
        },
      },
    });

    const { rows } = await runOrderStatus(client, { orders: manifest12().orders.slice(0, 1), disputes: [] });

    const text = JSON.stringify(rows);
    expect(text).not.toContain('@');
    expect(text).not.toContain('PAYER1');
  });
});

describe('freshSuffix (요청 ID 접미사)', () => {
  it('KST 분 단위 `r<YYYYMMDDHHmm>`이다', () => {
    expect(freshSuffix(new Date('2026-11-09T22:31:00Z'))).toBe('r202611100731');
    expect(freshSuffix(new Date('2026-11-09T14:00:59Z'))).toBe('r202611092300');
  });

  it('같은 분이면 같고, 다른 분이면 다르다', () => {
    expect(freshSuffix(new Date('2026-11-09T14:00:00Z'))).toBe(freshSuffix(new Date('2026-11-09T14:00:59Z')));
    expect(freshSuffix(new Date('2026-11-09T14:00:00Z'))).not.toBe(freshSuffix(new Date('2026-11-09T14:01:00Z')));
  });

  it('요청 ID는 접미사를 붙여도 주문 키마다 다르고, 접미사가 없으면 T026의 꼴 그대로다', () => {
    expect(orderRequestId('O01')).toBe('afterloop-order-O01');
    expect(orderRequestId('O01', 'r202611100731')).toBe('afterloop-order-O01-r202611100731');
    expect(orderRequestId('O01', 'r202611100731')).not.toBe(orderRequestId('O02', 'r202611100731'));
    // T001이 확인한 상한(61자)을 넘지 않는다
    expect(orderRequestId('O12', freshSuffix(new Date())).length).toBeLessThanOrEqual(61);
  });
});

describe('runFreshOrders (`-- --fresh`)', () => {
  const SUFFIX = 'r202611100731';

  /** 12건 모두: 기존 주문은 만료(404), 새 주문은 `FRESH-<키>`로 만들어진다. */
  const freshReplies = (options: { completed?: string[]; captureId?: string } = {}): Record<string, Reply | (() => Reply)> => {
    const replies: Record<string, Reply | (() => Reply)> = {};
    for (const order of manifest12().orders) {
      replies[`GET /v2/checkout/orders/${order.orderId}`] = (options.completed ?? []).includes(order.key)
        ? { status: 200, body: orderDetail('COMPLETED', { captureId: options.captureId ?? `CAP-${order.key}` }) }
        : { status: 404, body: { name: 'RESOURCE_NOT_FOUND' } };
    }
    let n = 0;
    replies['POST /v2/checkout/orders'] = () => {
      n += 1;
      return { status: 201, body: orderCreated(`FRESH-${n}`) };
    };
    return replies;
  };

  it('만료된 12건을 접미사 붙은 새 요청 ID로 다시 만든다', async () => {
    const { client, seen } = fakeClient(freshReplies());
    const specs = readSandboxOrderSpecs();

    const { rows, orders, problems } = await runFreshOrders(client, specs, manifest12(), SUFFIX);

    const posts = seen.filter((s) => s.method === 'POST');
    expect(posts).toHaveLength(12);
    expect(posts.map((s) => s.requestId)).toEqual(specs.map((s) => `afterloop-order-${s.key}-${SUFFIX}`));
    expect(posts[0].body).toEqual(buildOrderBody(specs[0]));
    expect(rows.every((r) => r.result === 'recreated' && r.approveUrl.startsWith(SANDBOX_APPROVE))).toBe(true);
    expect(orders.map((o) => o.orderId)).toEqual(Array.from({ length: 12 }, (_, i) => `FRESH-${i + 1}`));
    expect(problems).toEqual([]);
  });

  it('이미 캡처된(COMPLETED) 주문은 새로 만들지 않고 manifest 항목을 그대로 둔다', async () => {
    const { client, seen } = fakeClient(freshReplies({ completed: ['O01', 'O08'] }));
    const before = manifest12();
    before.orders[0] = { ...before.orders[0], captureId: 'CAP-O01' };

    const { rows, orders } = await runFreshOrders(client, readSandboxOrderSpecs(), before, SUFFIX);

    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(10);
    const kept = rows.filter((r) => r.result === 'kept-captured').map((r) => r.key);
    expect(kept).toEqual(['O01', 'O08']);
    expect(rows.find((r) => r.key === 'O01')?.note).toContain('이미 캡처됨');
    expect(orders.find((o) => o.key === 'O01')).toEqual({
      key: 'O01',
      orderId: 'ORDER-O01',
      buyer: 'seoyeon',
      sku: 'FK-SW-NV',
      tracked: true,
      captureId: 'CAP-O01',
    });
  });

  it('이전 주문 ID는 manifest의 previousOrderIds에 남는다 (캡처되지 않은 주문)', async () => {
    const { client } = fakeClient(freshReplies());
    const before = manifest12();
    // 캡처 ID가 있는 주문은 아예 새로 만들지 않는다 (T030) — 여기서는 캡처되지 않은 주문을 본다
    before.orders[0] = { ...before.orders[0], previousOrderIds: ['ORDER-OLDEST'] };

    const { rows, orders } = await runFreshOrders(client, readSandboxOrderSpecs().slice(0, 1), before, SUFFIX);

    expect(orders[0]).toEqual({
      key: 'O01',
      orderId: 'FRESH-1',
      buyer: 'seoyeon',
      sku: 'FK-SW-NV',
      tracked: true,
      previousOrderIds: ['ORDER-OLDEST', 'ORDER-O01'],
    });
    expect(orders[0].captureId).toBeUndefined();
    expect(rows[0].previousOrderId).toBe('ORDER-O01');
    expect(rows[0].note).toContain('이전 주문을 밀어냈다');
    expect(ManifestSchema.parse({ orders, disputes: [] }).orders[0].previousOrderIds).toEqual(['ORDER-OLDEST', 'ORDER-O01']);
  });

  it('같은 접미사로 다시 돌리면 200으로 같은 주문이 와서 중복이 생기지 않는다', async () => {
    const first = await runFreshOrders(fakeClient(freshReplies()).client, readSandboxOrderSpecs(), manifest12(), SUFFIX);

    const replies = freshReplies();
    for (const order of first.orders) {
      replies[`GET /v2/checkout/orders/${order.orderId}`] = { status: 200, body: orderDetail('CREATED') };
    }
    let n = 0;
    replies['POST /v2/checkout/orders'] = () => {
      n += 1;
      return { status: 200, body: orderCreated(`FRESH-${n}`) }; // 같은 요청 ID → 같은 주문
    };
    const { client, seen } = fakeClient(replies);

    const second = await runFreshOrders(client, readSandboxOrderSpecs(), { orders: first.orders, disputes: [] }, SUFFIX);

    expect(seen.filter((s) => s.method === 'POST').map((s) => s.requestId)).toEqual(
      readSandboxOrderSpecs().map((s) => `afterloop-order-${s.key}-${SUFFIX}`),
    );
    expect(second.rows.every((r) => r.result === 'existing')).toBe(true);
    expect(second.orders.map((o) => o.orderId)).toEqual(first.orders.map((o) => o.orderId));
    // 이전 주문 기록은 1회차 그대로다 — 같은 ID가 두 번 쌓이지 않는다
    expect(second.orders.map((o) => o.previousOrderIds)).toEqual(first.orders.map((o) => o.previousOrderIds));
    expect(second.orders[0].previousOrderIds).toEqual(['ORDER-O01']);
    expect(second.problems).toEqual([]);
  });

  it('접미사를 주지 않으면 호출하지 않고 던진다 (실수로 같은 주문을 돌려받지 않게)', async () => {
    const { client, seen } = fakeClient(freshReplies());
    await expect(runFreshOrders(client, readSandboxOrderSpecs(), manifest12(), '')).rejects.toThrow(/접미사/);
    expect(seen).toEqual([]);
  });

  it('한 건이 실패하면 그 주문의 manifest 항목은 그대로 두고 나머지는 계속 만든다', async () => {
    const replies = freshReplies();
    let n = 0;
    replies['POST /v2/checkout/orders'] = () => {
      n += 1;
      if (n === 1) return { status: 422, body: { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'CURRENCY_NOT_SUPPORTED' }] } };
      return { status: 201, body: orderCreated(`FRESH-${n}`) };
    };
    const { client } = fakeClient(replies);

    const { rows, orders, problems } = await runFreshOrders(client, readSandboxOrderSpecs(), manifest12(), SUFFIX);

    expect(rows[0].result).toBe('failed');
    expect(rows[0].note).toBe('UNPROCESSABLE_ENTITY · CURRENCY_NOT_SUPPORTED');
    expect(orders[0]).toEqual({ key: 'O01', orderId: 'ORDER-O01', buyer: 'seoyeon', sku: 'FK-SW-NV', tracked: true });
    expect(orders).toHaveLength(12);
    expect(problems[0]).toContain('O01 주문 생성 → 422');
  });

  it('승인 링크 도메인이 샌드박스가 아니면 그 자리에서 멈춘다 (live 금지)', async () => {
    const replies = freshReplies();
    replies['POST /v2/checkout/orders'] = { status: 201, body: orderCreated('FRESH-LIVE', 'https://www.paypal.com') };
    const { client, seen } = fakeClient(replies);

    await expect(runFreshOrders(client, readSandboxOrderSpecs(), manifest12(), SUFFIX)).rejects.toThrow(NotSandboxLinkError);
    expect(seen.filter((s) => s.method === 'POST')).toHaveLength(1);
  });

  it('링크 파일을 새 주문 ID로 바꿔 쓴다 (캡처된 주문은 링크 대신 상태를 적는다)', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'afterloop-fresh-'));
    mkdirSync(path.join(root, 'reports'), { recursive: true });
    const { client } = fakeClient(freshReplies({ completed: ['O01'] }));

    const { rows } = await runFreshOrders(client, readSandboxOrderSpecs(), manifest12(), SUFFIX);
    const file = writeApproveLinks(freshLinkRows(rows, new Map()), new Date('2026-11-09T22:31:00Z'), root, `접미사 ${SUFFIX}`);

    const text = readFileSync(file, 'utf8');
    expect(text).toContain('승인 링크 11건 / 주문 12건');
    expect(text).toContain(`접미사 ${SUFFIX}`);
    expect(text).toContain(`| O01 | seoyeon = Seoyeon Kim | $72.00 | ${CAPTURED_CELL} |`);
    expect(text).toContain(`${SANDBOX_APPROVE}FRESH-1`);
    expect(text).not.toContain('ORDER-O02'); // 이전 주문 링크는 남지 않는다
    expect(text).not.toContain('@');
  });

  it('결과에 비밀값·구매자 개인정보가 들어가지 않는다', async () => {
    const replies = freshReplies();
    replies['GET /v2/checkout/orders/ORDER-O01'] = {
      status: 200,
      body: {
        ...orderDetail('APPROVED'),
        payer: { email_address: 'buyer@example.test', payer_id: 'PAYER1', name: { given_name: 'Seoyeon' } },
      },
    };
    const { client } = fakeClient(replies);

    const { rows, orders } = await runFreshOrders(client, readSandboxOrderSpecs().slice(0, 1), manifest12(), SUFFIX);

    const text = JSON.stringify({ rows, orders });
    expect(text).not.toContain('@');
    expect(text).not.toContain('PAYER1');
    expect(text).not.toMatch(/access_token|authorization|bearer/i);
  });
});
