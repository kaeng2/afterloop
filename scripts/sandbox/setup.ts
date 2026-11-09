/**
 * `npm run sandbox:setup -- <단계>` — 샌드박스 구성 중 추적 등록과 분쟁 ID 수집 (T001, SPEC v2.2 9-5장).
 *
 *   track    : manifest에서 `tracked: true`인 주문에 POST /v2/checkout/orders/{id}/track 1회씩
 *              (가상 추적번호, carrier OTHER). 이미 추적이 붙은 주문은 건너뛴다.
 *   disputes : 주문 캡처에 걸린 분쟁을 GET /v1/customer/disputes로 찾아 D1~D3 ID를 manifest에 적는다.
 *
 * `orders`·`capture` 단계는 T026(`scripts/create-sandbox-orders.ts`, `scripts/capture-sandbox-orders.ts`)이 한다.
 * 하는 일은 `setup-steps.ts`에 있다 (여기는 명령줄·출력·종료 코드만).
 * 출력에 Client ID·Secret·액세스 토큰·구매자 개인정보를 적지 않는다.
 */
import { SandboxEnvError, loadSandboxEnv } from './env';
import { readManifest, writeManifest } from './manifest';
import { createSandboxClient, failureLine } from './paypal';
import { DISPUTE_ORDER_KEY, runDisputes, runTrack, type DisputeOutcome, type TrackOutcome } from './setup-steps';
import type { PayPalEnv } from '@/types';

const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`;

function printTrack(outcomes: TrackOutcome[]): void {
  console.log(row(['키', '주문 ID', '결과', '상태', '추적번호', '비고']));
  console.log(row(['---', '---', '---', '---', '---', '---']));
  for (const o of outcomes) {
    console.log(row([o.key, o.orderId, o.result, o.status ?? '호출 실패', o.trackingNumber ?? '-', o.note]));
  }
  const count = (result: TrackOutcome['result']) => outcomes.filter((o) => o.result === result).length;
  console.log(`\n등록 ${count('added')} · 건너뜀 ${count('skipped')} · 실패 ${count('failed')}`);
}

function printDisputes(outcomes: DisputeOutcome[]): void {
  console.log(row(['키', '주문 키', '분쟁 ID', '상태', '비고']));
  console.log(row(['---', '---', '---', '---', '---']));
  for (const o of outcomes) {
    console.log(row([o.key, o.orderKey, o.disputeId ?? '-', o.status ?? '호출 실패', o.note]));
  }
}

/** 이 스크립트가 하지 않는 단계. */
const HANDED_OFF: Record<string, string> = {
  orders: 'T026 scripts/create-sandbox-orders.ts',
  capture: 'T026 scripts/capture-sandbox-orders.ts',
};

async function main(): Promise<number> {
  const step = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))[0] ?? '';

  if (step in HANDED_OFF) {
    console.error(`${step} 단계는 여기서 하지 않는다. ${HANDED_OFF[step]}가 한다.`);
    return 1;
  }
  if (step !== 'track' && step !== 'disputes') {
    console.error('쓰는 법: npm run sandbox:setup -- <track | disputes>');
    return 1;
  }

  let env: PayPalEnv;
  try {
    env = loadSandboxEnv();
  } catch (error) {
    console.error(error instanceof SandboxEnvError ? error.message : '자격 증명을 읽지 못했다.');
    return 1;
  }

  const manifest = readManifest();
  if (manifest.orders.length === 0) {
    console.error('manifest에 주문이 없다. T026이 주문 12건을 만들고 캡처한 뒤에 이 단계를 돌린다.');
    return 1;
  }

  const client = createSandboxClient(env, (line) => console.log(`  · ${line}`));

  if (step === 'track') {
    const outcomes = await runTrack(client, manifest);
    console.log('');
    printTrack(outcomes);
    return outcomes.some((o) => o.result === 'failed') ? 1 : 0;
  }

  const { outcomes, disputes } = await runDisputes(client, manifest);
  console.log('');
  printDisputes(outcomes);
  if (disputes.length > 0) {
    writeManifest({ ...manifest, disputes });
    console.log(`\nmanifest에 분쟁 ${disputes.length}건을 적었다.`);
  }
  return disputes.length === Object.keys(DISPUTE_ORDER_KEY).length ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(failureLine(error));
    process.exitCode = 1;
  },
);
