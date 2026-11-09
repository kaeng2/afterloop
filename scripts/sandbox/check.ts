/**
 * `npm run sandbox:check` — 샌드박스 구성을 API로 **조회만** 해서 확인한다 (T001, SPEC v2.2 9-5장).
 *
 *   1. 토큰 발급
 *   2. 기능 확인: GET /v1/customer/disputes, GET /v1/reporting/transactions (최근 29일)
 *   3. manifest 주문마다 GET /v2/checkout/orders/{id}
 *   4. manifest 분쟁마다 GET /v1/customer/disputes/{id}
 *
 * 옵션
 *   --json              AC13이 읽는 한 줄 JSON만 출력한다 (로그를 끈다)
 *   --probe-request-id  요청 ID 길이 확인만 한다 (`check-steps.ts`의 probeRequestId 참고)
 *
 * 하는 일은 `check-steps.ts`에 있다 (여기는 명령줄·출력·종료 코드만).
 * 상태를 바꾸는 호출은 하지 않는다 (캡처·추적 등록·분쟁 응답 없음).
 * PAYPAL_BASE_URL이 샌드박스가 아니면 호출하지 않고 종료 코드 1.
 * 출력·last-run.md·에러 문구에 Client ID·Secret·액세스 토큰·Authorization 값을 넣지 않는다.
 */
import { checkSection, probeRequestId, probeSection, runCheck } from './check-steps';
import { SandboxEnvError, loadSandboxEnv } from './env';
import { writeLastRunSection } from './last-run';
import { readManifest } from './manifest';
import { createSandboxClient, failureLine } from './paypal';
import type { PayPalEnv } from '@/types';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const jsonOnly = args.includes('--json');
  const probeOnly = args.includes('--probe-request-id');
  const unknown = args.filter((arg) => arg !== '--json' && arg !== '--probe-request-id');
  if (unknown.length > 0) {
    console.error(`모르는 옵션: ${unknown.join(' ')} (쓸 수 있는 것: --json, --probe-request-id)`);
    return 1;
  }

  let env: PayPalEnv;
  try {
    env = loadSandboxEnv();
  } catch (error) {
    // 값이 담기지 않은 문구만 보여 준다.
    console.error(error instanceof SandboxEnvError ? error.message : '자격 증명을 읽지 못했다.');
    return 1;
  }

  const client = createSandboxClient(env, jsonOnly ? undefined : (line) => console.log(`  · ${line}`));
  const now = new Date();

  if (probeOnly) {
    if (!jsonOnly) console.log('요청 ID 길이 확인 (POST /v2/checkout/orders, 버려지는 주문)');
    const { rows, notes } = await probeRequestId(client);
    const file = writeLastRunSection('probe', probeSection(rows, notes, now));
    if (jsonOnly) console.log(JSON.stringify({ probe: rows }));
    else console.log(`\n${probeSection(rows, notes, now)}\n\n기록: ${file}`);
    return rows.every((r) => r.status !== null) ? 0 : 1;
  }

  const manifest = readManifest();
  const outcome = await runCheck(client, manifest, now);
  const file = writeLastRunSection('check', checkSection(outcome, manifest, now));

  if (jsonOnly) console.log(JSON.stringify(outcome.report));
  else console.log(`\n${checkSection(outcome, manifest, now)}\n\n기록: ${file}`);

  const featuresOk = outcome.report.features.disputes === 200 && outcome.report.features.transactionSearch === 200;
  return outcome.report.token.ok && featuresOk && outcome.problems.length === 0 ? 0 : 1;
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
