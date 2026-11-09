/**
 * `npm run sandbox:capture` — 승인된 샌드박스 주문을 캡처한다 (T026, SPEC v2.2 9-5장).
 *
 * 브라우저 에이전트가 `reports/sandbox-approve-links.md`의 승인 링크 12건을 승인한 **뒤**에 돌린다.
 *
 *   주문마다 `GET /v2/checkout/orders/{id}`로 상태를 보고
 *     APPROVED  → `POST /v2/checkout/orders/{id}/capture` (요청 ID는 주문 키 기준)
 *     COMPLETED → 건너뜀 (이미 캡처됨. 다시 실행해도 안전하다)
 *     그 밖     → "not approved yet"을 적고 다음 주문으로 넘어간다
 *   캡처 ID를 `tests/sandbox/manifest.json`에 적고 건별 결과를 표로 출력한다.
 *
 * 캡처 결과는 응답의 `purchase_units[].payments.captures[].status`로 가른다 (T030):
 *   COMPLETED        → `captured · ok` (캡처 ID를 적는다)
 *   PENDING          → `captured · pending (사유)` — 캡처 ID는 적지만 정산 전이다
 *   DECLINED·FAILED  → `capture failed` (캡처 ID를 적지 않는다, 종료 코드 1)
 * manifest에 `captureId`가 이미 있는 주문은 **호출하지 않고** 건너뛴다 (두 번 캡처하지 않는다).
 *
 * 주문 생성은 하지 않는다 (`npm run sandbox:orders`). 추적 등록·분쟁 조회도 하지 않는다
 * (`npm run sandbox:setup -- track | disputes`, T001).
 *
 * 비밀값: `.env`는 런타임에 `process.loadEnvFile`로만 읽는다. Client ID·Secret·액세스 토큰·
 * Authorization 헤더는 출력·manifest·에러 문구에 넣지 않는다. 구매자 개인정보도 적지 않는다 (SPEC 10장).
 */
import path from 'node:path';
import { SandboxEnvError, loadSandboxEnv } from './sandbox/env';
import { readManifest, writeManifest, type Manifest, type ManifestOrder } from './sandbox/manifest';
import { asArray, asRecord, asText, child, createSandboxClient, errorSummary, failureLine, firstCaptureId, orderCaptures } from './sandbox/paypal';
import type { PayPalClient, PayPalEnv } from '@/types';

/** 캡처 요청 ID: 주문 키 기준이라 재시도·재실행해도 같다. */
export const captureRequestId = (orderKey: string): string => `afterloop-capture-${orderKey}`;

/** 캡처할 수 있는 주문 상태. */
const APPROVED = 'APPROVED';
/** 이미 캡처가 끝난 주문 상태. */
const COMPLETED = 'COMPLETED';

/**
 * 건별 결과 (T030).
 *   `captured`         캡처가 끝났다 (`captures[].status` = COMPLETED)
 *   `captured_pending` 캡처는 받아들여졌지만 아직 정산 전이다 (PENDING) — 사람이 확인해야 한다
 *   `skipped`          이미 캡처돼 있어 캡처하지 않았다
 *   `not_approved`     아직 승인 전이다
 *   `failed`           캡처가 거절·실패했거나 호출이 실패했다
 */
export type CaptureResult = 'captured' | 'captured_pending' | 'skipped' | 'not_approved' | 'failed';

/** 표에 적는 이름 (지시서 6번 문장 그대로). */
export const CAPTURE_LABEL: Record<CaptureResult, string> = {
  captured: 'captured · ok',
  captured_pending: 'captured · pending',
  skipped: 'skipped (already captured)',
  not_approved: 'not approved yet',
  failed: 'capture failed',
};

/** 표에 적는 이름 + 사유 (`captured · pending (PENDING_REVIEW)`). */
export const captureLabel = (result: CaptureResult, reason = ''): string =>
  reason === '' ? CAPTURE_LABEL[result] : `${CAPTURE_LABEL[result]} (${reason})`;

/** 캡처가 끝난 상태. */
const CAPTURE_COMPLETED = 'COMPLETED';
/** 보류 상태 (캡처 ID는 생기지만 돈은 아직 움직이지 않았다). */
const CAPTURE_PENDING = 'PENDING';
/** 캡처가 안 된 상태. */
const CAPTURE_BAD = ['DECLINED', 'FAILED'];

export type CaptureRow = {
  key: string;
  orderId: string;
  result: CaptureResult;
  /** 표에 그대로 찍는 이름 (`captured · pending (…)` 처럼 사유가 붙는다) */
  label: string;
  orderStatus: string;
  httpStatus: number | null;
  captureId: string;
  note: string;
};

export type CaptureOutcome = { rows: CaptureRow[]; orders: ManifestOrder[]; problems: string[] };

/** 422 응답에 "이미 캡처됨"이 들어 있는지 (`details[].issue`). */
function alreadyCaptured(body: unknown): boolean {
  return asArray(asRecord(body).details).some((detail) => asText(asRecord(detail).issue) === 'ORDER_ALREADY_CAPTURED');
}

/** 캡처 응답의 첫 캡처: ID·상태·보류 사유 (없으면 빈 문자열). */
export function firstCapture(body: unknown): { id: string; status: string; reason: string } {
  const capture = asRecord(orderCaptures(body)[0]);
  return {
    id: asText(capture.id),
    status: asText(capture.status).toUpperCase(),
    reason: asText(child(capture, 'status_details').reason),
  };
}

/**
 * manifest의 주문마다 상태를 보고 승인된 것만 캡처한다.
 * 한 건이 실패하거나 아직 승인 전이어도 나머지는 계속한다 (다시 실행해도 안전하다).
 *
 * `note`를 주면 건별 한 줄(아직 승인 전 등)을 바로 보여 준다 (진입점은 `console.log`을 넘긴다).
 */
export async function runCapture(client: PayPalClient, manifest: Manifest, note?: (line: string) => void): Promise<CaptureOutcome> {
  const rows: CaptureRow[] = [];
  const orders: ManifestOrder[] = [];
  const problems: string[] = [];

  for (const entry of manifest.orders) {
    const orderPath = `/v2/checkout/orders/${encodeURIComponent(entry.orderId)}`;
    const base = { key: entry.key, orderId: entry.orderId };
    let captureId = entry.captureId ?? '';

    // manifest에 캡처 ID가 있으면 호출하지 않고 건너뛴다 — 두 번 캡처하지 않는다 (T030 지시서 6번).
    if (captureId !== '') {
      rows.push({
        ...base,
        result: 'skipped',
        label: CAPTURE_LABEL.skipped,
        orderStatus: '',
        httpStatus: null,
        captureId,
        note: 'manifest에 캡처 ID가 있다 — 조회·캡처를 하지 않았다',
      });
      orders.push(entry);
      continue;
    }

    try {
      const detail = await client.get(orderPath);
      if (detail.status !== 200) {
        rows.push({ ...base, result: 'failed', label: CAPTURE_LABEL.failed, orderStatus: '', httpStatus: detail.status, captureId, note: `주문 조회 → ${errorSummary(detail.body)}` });
        problems.push(`${entry.key} 주문 조회 → ${detail.status}: ${errorSummary(detail.body)}`);
        orders.push(entry);
        continue;
      }

      const orderStatus = asText(asRecord(detail.body).status);

      if (orderStatus === COMPLETED) {
        captureId = firstCaptureId(detail.body) || captureId;
        rows.push({ ...base, result: 'skipped', label: CAPTURE_LABEL.skipped, orderStatus, httpStatus: 200, captureId, note: '이미 캡처됨' });
        orders.push({ ...entry, ...(captureId === '' ? {} : { captureId }) });
        if (captureId === '') problems.push(`${entry.key}: 주문이 COMPLETED인데 캡처 ID를 읽지 못했다`);
        continue;
      }

      if (orderStatus !== APPROVED) {
        rows.push({ ...base, result: 'not_approved', label: CAPTURE_LABEL.not_approved, orderStatus, httpStatus: 200, captureId, note: 'not approved yet' });
        note?.(`${entry.key} (${entry.orderId}): not approved yet · 주문 상태 ${orderStatus || '(없음)'}`);
        orders.push(entry);
        continue;
      }

      const res = await client.call({
        method: 'POST',
        path: `${orderPath}/capture`,
        requestId: captureRequestId(entry.key),
        body: {},
      });

      if (res.status >= 300) {
        if (res.status === 422 && alreadyCaptured(res.body)) {
          const after = await client.get(orderPath);
          captureId = (after.status === 200 ? firstCaptureId(after.body) : '') || captureId;
          rows.push({ ...base, result: 'skipped', label: CAPTURE_LABEL.skipped, orderStatus, httpStatus: res.status, captureId, note: '이미 캡처됨 (ORDER_ALREADY_CAPTURED)' });
          orders.push({ ...entry, ...(captureId === '' ? {} : { captureId }) });
          continue;
        }
        rows.push({ ...base, result: 'failed', label: CAPTURE_LABEL.failed, orderStatus, httpStatus: res.status, captureId, note: errorSummary(res.body) });
        problems.push(`${entry.key} 캡처 → ${res.status}: ${errorSummary(res.body)}`);
        orders.push(entry);
        continue;
      }

      // 2xx여도 캡처가 됐다고 단정하지 않는다 — 캡처 자체의 상태를 본다 (T030 지시서 6번).
      const capture = firstCapture(res.body);
      const orderAfter = asText(asRecord(res.body).status) || orderStatus;

      if (CAPTURE_BAD.includes(capture.status)) {
        rows.push({
          ...base,
          result: 'failed',
          label: captureLabel('failed', capture.status),
          orderStatus: orderAfter,
          httpStatus: res.status,
          captureId: '', // 캡처되지 않았다 — manifest에 적지 않는다
          note: `캡처 상태 ${capture.status}${capture.reason === '' ? '' : ` (${capture.reason})`} — 돈이 움직이지 않았다`,
        });
        problems.push(
          `${entry.key} 캡처 → ${res.status}인데 캡처 상태가 ${capture.status}다${capture.reason === '' ? '' : ` (${capture.reason})`}. 캡처 ID를 manifest에 적지 않았다.`,
        );
        orders.push(entry);
        continue;
      }

      captureId = capture.id || captureId;
      if (capture.status === CAPTURE_COMPLETED) {
        rows.push({
          ...base,
          result: 'captured',
          label: CAPTURE_LABEL.captured,
          orderStatus: orderAfter,
          httpStatus: res.status,
          captureId,
          note: capture.id === '' ? '응답에서 캡처 ID를 읽지 못했다' : 'ok',
        });
        if (capture.id === '') problems.push(`${entry.key} 캡처 → ${res.status}인데 응답에 캡처 ID가 없다`);
      } else {
        // PENDING(정산 전) 또는 상태를 읽지 못한 경우. 캡처 ID는 적되 "끝났다"고 적지 않는다.
        const reason =
          capture.status === CAPTURE_PENDING
            ? capture.reason || '사유 없음'
            : `캡처 상태 ${capture.status || '(없음)'}`;
        rows.push({
          ...base,
          result: 'captured_pending',
          label: captureLabel('captured_pending', reason),
          orderStatus: orderAfter,
          httpStatus: res.status,
          captureId,
          note: `정산 전이다 — \`npm run sandbox:check\`로 COMPLETED가 되는지 확인한다${capture.id === '' ? ' (응답에서 캡처 ID를 읽지 못했다)' : ''}`,
        });
        problems.push(`${entry.key} 캡처 → ${res.status}인데 캡처가 끝나지 않았다 (${reason}). 캡처 ID는 manifest에 적었다.`);
      }
      orders.push({ ...entry, ...(captureId === '' ? {} : { captureId }) });
    } catch (error) {
      rows.push({ ...base, result: 'failed', label: CAPTURE_LABEL.failed, orderStatus: '', httpStatus: null, captureId, note: failureLine(error) });
      problems.push(`${entry.key} 캡처 실패: ${failureLine(error)}`);
      orders.push(entry);
    }
  }

  return { rows, orders, problems };
}

// ── 출력 ───────────────────────────────────────────────────────────────────────

const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`;

function printRows(rows: CaptureRow[]): void {
  console.log(row(['키', '주문 ID', '결과', '주문 상태', '상태', '캡처 ID', '비고']));
  console.log(row(['---', '---', '---', '---', '---', '---', '---']));
  for (const r of rows) {
    console.log(row([r.key, r.orderId, r.label, r.orderStatus || '-', r.httpStatus ?? '호출 실패', r.captureId || '-', r.note]));
  }
  const count = (result: CaptureResult) => rows.filter((r) => r.result === result).length;
  const summary = (Object.keys(CAPTURE_LABEL) as CaptureResult[])
    .filter((result) => count(result) > 0)
    .map((result) => `${CAPTURE_LABEL[result]} ${count(result)}`)
    .join(' · ');
  console.log(`\n주문 ${rows.length}건: ${summary}`);
}

// ── 진입점 ─────────────────────────────────────────────────────────────────────

export async function main(): Promise<number> {
  let env: PayPalEnv;
  try {
    env = loadSandboxEnv();
  } catch (error) {
    console.error(error instanceof SandboxEnvError ? error.message : '자격 증명을 읽지 못했다.');
    return 1;
  }

  const manifest = readManifest();
  if (manifest.orders.length === 0) {
    console.error('manifest에 주문이 없다. `npm run sandbox:orders`로 주문 12건을 먼저 만든다.');
    return 1;
  }

  const client = createSandboxClient(env, (line) => console.log(`  · ${line}`));
  const outcome = await runCapture(client, manifest, (line) => console.log(line));

  writeManifest({ ...manifest, orders: outcome.orders });

  console.log('');
  printRows(outcome.rows);
  if (outcome.problems.length > 0) {
    console.log('\n문제:');
    for (const problem of outcome.problems) console.log(`- ${problem}`);
  }

  const notApproved = outcome.rows.filter((r) => r.result === 'not_approved');
  if (notApproved.length > 0) {
    console.error(
      `\n아직 승인 전인 주문 ${notApproved.length}건(${notApproved.map((r) => r.key).join(', ')}). ` +
        '브라우저 에이전트가 승인한 뒤 다시 실행한다 (이미 캡처된 건은 건너뛴다).',
    );
  }
  const failed = outcome.rows.filter((r) => r.result === 'failed');
  if (failed.length > 0) {
    console.error(
      `\n캡처가 안 된 주문 ${failed.length}건(${failed.map((r) => r.key).join(', ')}). 위 "문제"의 사유를 보고 사람이 판단한다.`,
    );
  }
  const stillPending = outcome.rows.filter((r) => r.result === 'captured_pending');
  if (stillPending.length > 0) {
    console.error(
      `\n캡처가 보류(PENDING)인 주문 ${stillPending.length}건(${stillPending.map((r) => r.key).join(', ')}). ` +
        '캡처 ID는 manifest에 적었지만 아직 정산 전이다 — `npm run sandbox:check`로 COMPLETED가 되는지 확인한다. 다시 캡처하지는 않는다.',
    );
  }

  const left = outcome.orders.filter((order) => (order.captureId ?? '') === '').length;
  return left === 0 && failed.length === 0 && stillPending.length === 0 ? 0 : 1;
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
