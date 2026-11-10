/**
 * `sandbox:check`가 하는 일 (T001·T039, SPEC v2.3 9-5장). **조회와 요청 ID 길이 확인만** 한다.
 *
 * 보고(`CheckReport`)의 `orders`·`disputes`는 manifest에 적힌 전부다 — 시연 제외 분쟁도 조회해
 * 항목에 `demoExcluded`를 붙이고 `last-run.md`에 ID와 함께 "시연 제외"로 적는다.
 * 고정 숫자(주문 12건·추적 7건)와 비교하지 않는다. manifest가 기준이다.
 *
 * 여기에는 진입점이 없다 (단위 테스트가 그대로 import한다). 명령줄 처리는 `check.ts`가 한다.
 * 분쟁·주문 상태를 바꾸는 호출은 만들지 않는다.
 */
import { kstStamp } from './last-run';
import type { Manifest } from './manifest';
import {
  asArray,
  asRecord,
  asText,
  child,
  errorSummary,
  failureLine,
  firstCaptureId,
  hasTracker,
  isTokenFailure,
  query,
} from './paypal';
import type { PayPalClient } from '@/types';

/** Transaction Search가 받는 최대 기간은 31일이다. 넉넉하게 29일만 본다. */
const TRANSACTION_WINDOW_DAYS = 29;

export type OrderRow = {
  key: string;
  orderId: string;
  status: string;
  itemNames: string[];
  payerId: string;
  payerCountry: string;
  captureId: string;
  tracked: boolean;
};

export type DisputeRow = {
  key: string;
  disputeId: string;
  reason: string;
  stage: string;
  status: string;
  captureIds: string[];
  /** 시연 제외 분쟁일 때만 `true` (SPEC v2.3 9-5). 조회만 하고 아무 조치도 하지 않는다. */
  demoExcluded?: boolean;
};

/** `--json`이 한 줄로 내보내는 모양 (AC13이 읽는다). */
export type CheckReport = {
  token: { ok: boolean };
  features: { disputes: number; transactionSearch: number };
  orders: OrderRow[];
  disputes: DisputeRow[];
};

/** 사람에게 보여 줄 한 줄 기록 (엔드포인트와 상태 코드만). */
export type CallLine = { endpoint: string; status: number | null; note: string };

export type CheckOutcome = { report: CheckReport; calls: CallLine[]; problems: string[] };

// ── 응답 읽기 ──────────────────────────────────────────────────────────────────

/** Transaction Search가 받는 날짜 꼴 (`2026-10-11T00:00:00-0000`). */
function stamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}-0000`;
}

/** 주문 상세에서 AC13이 읽는 값만 뽑는다. 구매자 이름·이메일은 읽지 않는다. */
export function readOrder(key: string, orderId: string, body: unknown): OrderRow {
  const order = asRecord(body);
  const itemNames = asArray(order.purchase_units).flatMap((unit) =>
    asArray(asRecord(unit).items)
      .map((item) => asText(asRecord(item).name))
      .filter((name) => name !== ''),
  );
  return {
    key,
    orderId,
    status: asText(order.status),
    itemNames,
    payerId: asText(child(order, 'payer').payer_id),
    payerCountry: asText(child(child(order, 'payer'), 'address').country_code),
    captureId: firstCaptureId(body),
    tracked: hasTracker(body),
  };
}

/**
 * 분쟁 상세에서 필요한 값만 뽑는다 (구매자 정보는 읽지 않는다).
 * `demoExcluded`는 manifest가 그렇게 적은 항목에만 붙는다 (응답에서 읽는 값이 아니다).
 */
export function readDispute(key: string, disputeId: string, body: unknown, demoExcluded = false): DisputeRow {
  const dispute = asRecord(body);
  const captureIds = asArray(dispute.disputed_transactions)
    .map((txn) => asText(asRecord(txn).seller_transaction_id))
    .filter((id) => id !== '');
  return {
    key,
    disputeId: asText(dispute.dispute_id) || disputeId,
    reason: asText(dispute.reason),
    stage: asText(dispute.dispute_life_cycle_stage),
    status: asText(dispute.status),
    captureIds,
    ...(demoExcluded ? { demoExcluded: true } : {}),
  };
}

// ── 조회 ───────────────────────────────────────────────────────────────────────

export async function runCheck(client: PayPalClient, manifest: Manifest, now: Date = new Date()): Promise<CheckOutcome> {
  const calls: CallLine[] = [];
  const problems: string[] = [];
  const report: CheckReport = {
    token: { ok: false },
    features: { disputes: 0, transactionSearch: 0 },
    orders: [],
    disputes: [],
  };

  const start = new Date(now.getTime() - TRANSACTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const features: { name: 'disputes' | 'transactionSearch'; label: string; path: string }[] = [
    {
      name: 'disputes',
      label: 'GET /v1/customer/disputes',
      path: `/v1/customer/disputes?${query({ page_size: 1 })}`,
    },
    {
      name: 'transactionSearch',
      label: 'GET /v1/reporting/transactions',
      path: `/v1/reporting/transactions?${query({
        start_date: stamp(start),
        end_date: stamp(now),
        fields: 'transaction_info',
        page_size: 1,
        page: 1,
      })}`,
    },
  ];

  for (const feature of features) {
    try {
      const res = await client.get(feature.path);
      // 상태 코드가 돌아왔다는 것은 토큰 발급이 됐다는 뜻이다.
      report.token.ok = true;
      report.features[feature.name] = res.status;
      calls.push({ endpoint: feature.label, status: res.status, note: res.status === 200 ? 'ok' : errorSummary(res.body) });
      if (res.status === 403) {
        problems.push(`${feature.label} → 403 (앱 기능 반영 대기일 수 있음 · 최대 10분). 10분 뒤 다시 실행한다.`);
      } else if (res.status !== 200) {
        problems.push(`${feature.label} → ${res.status}: ${errorSummary(res.body)}`);
      }
    } catch (error) {
      const line = failureLine(error);
      calls.push({ endpoint: feature.label, status: null, note: line });
      if (isTokenFailure(error)) {
        // 토큰이 안 나오면 뒤 호출도 모두 실패한다. 더 두드리지 않는다.
        problems.push(`토큰 발급 실패: ${line}`);
        return { report, calls, problems };
      }
      problems.push(`${feature.label} 실패: ${line}`);
    }
  }

  for (const entry of manifest.orders) {
    const label = `GET /v2/checkout/orders/{${entry.key}}`;
    try {
      const res = await client.get(`/v2/checkout/orders/${encodeURIComponent(entry.orderId)}`);
      calls.push({ endpoint: label, status: res.status, note: res.status === 200 ? 'ok' : errorSummary(res.body) });
      if (res.status !== 200) {
        problems.push(`${entry.key} 주문 조회 → ${res.status}: ${errorSummary(res.body)}`);
        continue;
      }
      report.orders.push(readOrder(entry.key, entry.orderId, res.body));
    } catch (error) {
      const line = failureLine(error);
      calls.push({ endpoint: label, status: null, note: line });
      problems.push(`${entry.key} 주문 조회 실패: ${line}`);
    }
  }

  for (const entry of manifest.disputes) {
    const label = `GET /v1/customer/disputes/{${entry.key}}`;
    try {
      const res = await client.get(`/v1/customer/disputes/${encodeURIComponent(entry.disputeId)}`);
      calls.push({ endpoint: label, status: res.status, note: res.status === 200 ? 'ok' : errorSummary(res.body) });
      if (res.status !== 200) {
        problems.push(`${entry.key} 분쟁 조회 → ${res.status}: ${errorSummary(res.body)}`);
        continue;
      }
      report.disputes.push(readDispute(entry.key, entry.disputeId, res.body, entry.demoExcluded === true));
    } catch (error) {
      const line = failureLine(error);
      calls.push({ endpoint: label, status: null, note: line });
      problems.push(`${entry.key} 분쟁 조회 실패: ${line}`);
    }
  }

  return { report, calls, problems };
}

// ── 요청 ID 길이 확인 (2026-11-09 결정) ────────────────────────────────────────

/**
 * 실행 계획의 `PayPal-Request-Id`는 약 61자다
 * (`plan-<분쟁 ID>-<수>-<API>-<금액>-<환불 종류>:<엔드포인트>`).
 * PayPal이 그 길이를 받는지 확인한다: 61자 ID로 주문 1건을 만들고, **같은 ID로 한 번 더** 보내
 * 같은 주문 ID가 돌아오는지(멱등) 본다. 비교용으로 36자(UUID) 1건도 보낸다.
 *
 * 여기서 만든 주문은 승인·캡처하지 않고 manifest에도 넣지 않는다 (버려지는 주문).
 * ID는 실행마다 같다 — 다시 돌리면 PayPal이 같은 주문을 돌려주므로 주문이 쌓이지 않는다.
 * 분쟁 API(send-message 등)에서의 길이는 첫 실호출(T009) 때 다시 확인한다.
 */
export const PROBE_ID_61 = 'plan-PP-R-ZZZ-10000001-1-make_offer-7200-no_return:make-offer';
export const PROBE_ID_36 = '3f2b1c08-9a4d-4e7f-8b61-0d5c9a2e7f14';
export const PROBE_ITEM_NAME = 'Request-Id length probe';

export type ProbeRow = { label: string; idLength: number; status: number | null; orderId: string; note: string };

function probeBody(): Record<string, unknown> {
  const amount = { currency_code: 'USD', value: '1.00' };
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: { ...amount, breakdown: { item_total: amount } },
        items: [{ name: PROBE_ITEM_NAME, quantity: '1', unit_amount: amount }],
      },
    ],
  };
}

export async function probeRequestId(client: PayPalClient): Promise<{ rows: ProbeRow[]; notes: string[] }> {
  const rows: ProbeRow[] = [];
  const notes: string[] = [];

  const attempts: { label: string; requestId: string }[] = [
    { label: '61자 (1회차)', requestId: PROBE_ID_61 },
    { label: '61자 (2회차, 같은 ID = 멱등 확인)', requestId: PROBE_ID_61 },
    { label: '36자 (UUID, 비교용)', requestId: PROBE_ID_36 },
  ];

  for (const attempt of attempts) {
    try {
      const res = await client.call({
        method: 'POST',
        path: '/v2/checkout/orders',
        body: probeBody(),
        requestId: attempt.requestId,
      });
      rows.push({
        label: attempt.label,
        idLength: attempt.requestId.length,
        status: res.status,
        orderId: asText(asRecord(res.body).id),
        note: res.status < 300 ? 'ok' : errorSummary(res.body),
      });
      if (res.status >= 300) {
        notes.push(`${attempt.label}: POST /v2/checkout/orders → ${res.status} · ${errorSummary(res.body)}`);
      }
    } catch (error) {
      const line = failureLine(error);
      rows.push({ label: attempt.label, idLength: attempt.requestId.length, status: null, orderId: '', note: line });
      notes.push(`${attempt.label}: ${line}`);
    }
  }

  const [first, second] = rows;
  if (first !== undefined && second !== undefined && first.orderId !== '' && second.orderId !== '') {
    notes.push(
      first.orderId === second.orderId
        ? '멱등: 같은 61자 ID로 두 번 보내 같은 주문 ID가 돌아왔다.'
        : '멱등 안 걸림: 같은 61자 ID인데 주문 ID가 달랐다 (컨트롤 타워에 알린다).',
    );
  }

  return { rows, notes };
}

// ── last-run.md 절 ─────────────────────────────────────────────────────────────

const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`;

/** 시연에서 뺀 분쟁을 last-run.md에 적는 말 (SPEC v2.3 9-5). */
export const DEMO_EXCLUDED_CELL = '시연 제외';

export function checkSection(outcome: CheckOutcome, manifest: Manifest, now: Date = new Date()): string {
  const lines = [
    `- 시각: ${kstStamp(now)}`,
    `- 토큰 발급: ${outcome.report.token.ok ? '성공' : '실패'}`,
    '',
    row(['엔드포인트', '상태', '비고']),
    row(['---', '---', '---']),
    ...outcome.calls.map((call) => row([call.endpoint, call.status ?? '호출 실패', call.note])),
  ];

  if (outcome.report.orders.length > 0) {
    lines.push('', '### 주문', row(['키', '주문 ID', '상태', '캡처 ID', '추적']), row(['---', '---', '---', '---', '---']));
    for (const order of outcome.report.orders) {
      lines.push(row([order.key, order.orderId, order.status, order.captureId || '-', order.tracked ? '등록' : '미등록']));
    }
  }
  if (manifest.disputes.length > 0) {
    // manifest의 분쟁 전부를 적는다 (시연 제외 포함). 조회가 실패한 항목도 ID는 남긴다.
    const byKey = new Map(outcome.report.disputes.map((dispute) => [dispute.key, dispute]));
    lines.push(
      '',
      '### 분쟁',
      row(['키', '분쟁 ID', 'reason', '단계', '상태', '캡처 ID', '시연']),
      row(['---', '---', '---', '---', '---', '---', '---']),
    );
    for (const entry of manifest.disputes) {
      const dispute = byKey.get(entry.key);
      const demo = entry.demoExcluded === true ? DEMO_EXCLUDED_CELL : '포함';
      lines.push(
        row([
          entry.key,
          dispute?.disputeId ?? entry.disputeId,
          dispute?.reason || '-',
          dispute?.stage || '-',
          dispute?.status || '-',
          dispute?.captureIds.join(' ') || '-',
          demo,
        ]),
      );
    }
    const excluded = manifest.disputes.filter((entry) => entry.demoExcluded === true);
    if (excluded.length > 0) {
      lines.push(
        '',
        ...excluded.map(
          (entry) =>
            `- ${entry.key} (${entry.disputeId}): ${DEMO_EXCLUDED_CELL} — 조회만 하고 아무 조치도 하지 않는다` +
            `${entry.note === undefined ? '.' : ` (${entry.note})`}`,
        ),
      );
    }
  }
  if (manifest.orders.length === 0 && manifest.disputes.length === 0) {
    lines.push('', 'manifest가 비어 있어 주문·분쟁 조회는 건너뛰었다 (1단계).');
  }
  if (outcome.problems.length > 0) {
    lines.push('', '### 문제', ...outcome.problems.map((problem) => `- ${problem}`));
  }
  return lines.join('\n');
}

export function probeSection(rows: ProbeRow[], notes: string[], now: Date = new Date()): string {
  const lines = [
    `- 시각: ${kstStamp(now)}`,
    `- 엔드포인트: POST /v2/checkout/orders (intent CAPTURE, USD 1.00, 상품명 "${PROBE_ITEM_NAME}")`,
    '- 이 주문은 승인·캡처하지 않고 manifest에도 넣지 않는다 (버려지는 주문).',
    '',
    row(['시도', 'ID 길이', '상태', '주문 ID', '비고']),
    row(['---', '---', '---', '---', '---']),
    ...rows.map((r) => row([r.label, r.idLength, r.status ?? '호출 실패', r.orderId || '-', r.note])),
  ];
  if (notes.length > 0) lines.push('', ...notes.map((note) => `- ${note}`));
  return lines.join('\n');
}
