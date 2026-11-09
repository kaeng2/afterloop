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
 * 주문 생성은 하지 않는다 (`npm run sandbox:orders`). 추적 등록·분쟁 조회도 하지 않는다
 * (`npm run sandbox:setup -- track | disputes`, T001).
 *
 * 비밀값: `.env`는 런타임에 `process.loadEnvFile`로만 읽는다. Client ID·Secret·액세스 토큰·
 * Authorization 헤더는 출력·manifest·에러 문구에 넣지 않는다. 구매자 개인정보도 적지 않는다 (SPEC 10장).
 */
import path from 'node:path';
import { SandboxEnvError, loadSandboxEnv } from './sandbox/env';
import { readManifest, writeManifest, type Manifest, type ManifestOrder } from './sandbox/manifest';
import { asArray, asRecord, asText, createSandboxClient, errorSummary, failureLine, firstCaptureId } from './sandbox/paypal';
import type { PayPalClient, PayPalEnv } from '@/types';

/** 캡처 요청 ID: 주문 키 기준이라 재시도·재실행해도 같다. */
export const captureRequestId = (orderKey: string): string => `afterloop-capture-${orderKey}`;

/** 캡처할 수 있는 주문 상태. */
const APPROVED = 'APPROVED';
/** 이미 캡처가 끝난 주문 상태. */
const COMPLETED = 'COMPLETED';

export type CaptureRow = {
  key: string;
  orderId: string;
  /** captured: 이번에 캡처 · skipped: 이미 캡처됨 · pending: 아직 승인 전 · failed: 호출 실패 */
  result: 'captured' | 'skipped' | 'pending' | 'failed';
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

    try {
      const detail = await client.get(orderPath);
      if (detail.status !== 200) {
        rows.push({ ...base, result: 'failed', orderStatus: '', httpStatus: detail.status, captureId, note: `주문 조회 → ${errorSummary(detail.body)}` });
        problems.push(`${entry.key} 주문 조회 → ${detail.status}: ${errorSummary(detail.body)}`);
        orders.push(entry);
        continue;
      }

      const orderStatus = asText(asRecord(detail.body).status);

      if (orderStatus === COMPLETED) {
        captureId = firstCaptureId(detail.body) || captureId;
        rows.push({ ...base, result: 'skipped', orderStatus, httpStatus: 200, captureId, note: '이미 캡처됨' });
        orders.push({ ...entry, ...(captureId === '' ? {} : { captureId }) });
        if (captureId === '') problems.push(`${entry.key}: 주문이 COMPLETED인데 캡처 ID를 읽지 못했다`);
        continue;
      }

      if (orderStatus !== APPROVED) {
        rows.push({ ...base, result: 'pending', orderStatus, httpStatus: 200, captureId, note: 'not approved yet' });
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
          rows.push({ ...base, result: 'skipped', orderStatus, httpStatus: res.status, captureId, note: '이미 캡처됨 (ORDER_ALREADY_CAPTURED)' });
          orders.push({ ...entry, ...(captureId === '' ? {} : { captureId }) });
          continue;
        }
        rows.push({ ...base, result: 'failed', orderStatus, httpStatus: res.status, captureId, note: errorSummary(res.body) });
        problems.push(`${entry.key} 캡처 → ${res.status}: ${errorSummary(res.body)}`);
        orders.push(entry);
        continue;
      }

      const newCaptureId = firstCaptureId(res.body);
      captureId = newCaptureId || captureId;
      rows.push({
        ...base,
        result: 'captured',
        orderStatus: asText(asRecord(res.body).status) || orderStatus,
        httpStatus: res.status,
        captureId,
        note: newCaptureId === '' ? '응답에서 캡처 ID를 읽지 못했다' : 'ok',
      });
      orders.push({ ...entry, ...(captureId === '' ? {} : { captureId }) });
      if (newCaptureId === '') problems.push(`${entry.key} 캡처 → ${res.status}인데 응답에 캡처 ID가 없다`);
    } catch (error) {
      rows.push({ ...base, result: 'failed', orderStatus: '', httpStatus: null, captureId, note: failureLine(error) });
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
    console.log(row([r.key, r.orderId, r.result, r.orderStatus || '-', r.httpStatus ?? '호출 실패', r.captureId || '-', r.note]));
  }
  const count = (result: CaptureRow['result']) => rows.filter((r) => r.result === result).length;
  console.log(
    `\n캡처 ${count('captured')} · 이미 캡처됨 ${count('skipped')} · 승인 전 ${count('pending')} · 실패 ${count('failed')}`,
  );
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

  const pending = outcome.rows.filter((r) => r.result === 'pending');
  if (pending.length > 0) {
    console.error(
      `\n아직 승인 전인 주문 ${pending.length}건(${pending.map((r) => r.key).join(', ')}). ` +
        '브라우저 에이전트가 승인한 뒤 다시 실행한다 (이미 캡처된 건은 건너뛴다).',
    );
  }
  const left = outcome.orders.filter((order) => (order.captureId ?? '') === '').length;
  return left === 0 ? 0 : 1;
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
