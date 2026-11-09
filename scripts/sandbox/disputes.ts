/**
 * `npm run sandbox:disputes` — 실제 샌드박스의 분쟁 목록을 읽어 `BoardState`로 바꿔 본다 (T029).
 *
 * 조회만 한다: `GET /v1/customer/disputes`와 `GET /v1/customer/disputes/{id}`뿐이다.
 * POST는 보내지 않는다 (분쟁 상태를 바꾸는 호출은 `src/exec/`가 맡는다).
 * 하는 일은 `disputes-read.ts`에 있다 (여기는 명령줄·출력·종료 코드만).
 *
 * 종료 코드: 분쟁이 0건이어도 0 (아직 접수 전이면 정상이다).
 * 변환하지 못한 분쟁이 있거나 목록 조회가 실패하면 1.
 *
 * 비밀값: `.env`는 `env.ts`가 런타임에만 읽는다. 출력·기록에 Client ID·Secret·토큰·
 * 구매자 개인정보(이름·이메일·주소·메시지 원문)를 적지 않는다.
 */
import path from 'node:path';
import { disputeReadLines, disputesSection, runDisputesRead, type DisputeReadOutcome } from './disputes-read';
import { ROOT, SandboxEnvError, loadSandboxEnv } from './env';
import { writeLastRunSection } from './last-run';
import { createSandboxClient, failureLine } from './paypal';
import type { PayPalEnv } from '@/types';

async function main(): Promise<number> {
  const unknown = process.argv.slice(2).filter((arg) => arg !== '');
  if (unknown.length > 0) {
    console.error(`쓰는 법: npm run sandbox:disputes (옵션 없음. 받은 것: ${unknown.join(' ')})`);
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

  let outcome: DisputeReadOutcome;
  try {
    outcome = await runDisputesRead(client);
  } catch (error) {
    console.error(`분쟁 목록을 읽지 못했다: ${failureLine(error)}`);
    return 1;
  }

  console.log('');
  for (const line of disputeReadLines(outcome)) console.log(line);

  const file = writeLastRunSection('disputes', disputesSection(outcome));
  console.log(`\n기록: ${path.relative(ROOT, file)}`);

  return outcome.problems.length > 0 ? 1 : 0;
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
