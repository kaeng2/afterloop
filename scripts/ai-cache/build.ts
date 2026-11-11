/**
 * AI 캐시 만들기 — 진입점 (T070).
 *
 *   npx tsx --env-file=.env scripts/ai-cache/build.ts            # data/ai-cache/llm-cache.json 에 쓴다
 *   npx tsx --env-file=.env scripts/ai-cache/build.ts --out <파일>
 *
 * **컨트롤 타워가 병합 뒤에** 실제 AI·실제 PayPal 샌드박스(읽기만)로 돌린다. 작업 세션은 돌리지 않는다.
 * 무엇을 하는지는 `./build-lib.ts`, 순서는 `reports/deploy.md`.
 *
 * - 앱의 서버 함수는 `import 'server-only'`가 있어 `react-server` 조건에서만 읽힌다. 그 조건 없이 시작했으면
 *   같은 node 인수에 `--conditions=react-server`를 더해 자기 자신을 한 번 다시 띄운다.
 * - 출력은 건수·분쟁 번호·사유 코드만. 응답 글·요청 글·환경변수 값·키 값은 찍지 않는다.
 * - PayPal이나 AI를 쓸 수 없으면 파일을 쓰지 않고 1로 끝난다 (빈 캐시로 덮어쓰지 않는다).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { LlmEnv } from '@/ai/llm';

const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_OUT = path.join(ROOT, 'data', 'ai-cache', 'llm-cache.json');

function outPath(argv: string[]): string {
  const at = argv.indexOf('--out');
  if (at === -1) return DEFAULT_OUT;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith('--')) throw new Error('--out 다음에 파일 경로가 필요하다');
  return path.resolve(value);
}

/** `react-server` 조건으로 시작했는가 (node 인수 또는 NODE_OPTIONS). */
function hasReactServerCondition(): boolean {
  return [...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' ').includes('react-server');
}

async function main(): Promise<number> {
  if (!hasReactServerCondition()) {
    if (process.env.AI_CACHE_BUILD_CHILD === '1') {
      console.error('react-server 조건을 붙여 다시 띄웠는데도 조건이 보이지 않는다. 중단한다.');
      return 1;
    }
    const child = spawnSync(
      process.execPath,
      [...process.execArgv, '--conditions=react-server', __filename, ...process.argv.slice(2)],
      { stdio: 'inherit', env: { ...process.env, AI_CACHE_BUILD_CHILD: '1' } },
    );
    return child.status ?? 1;
  }

  const out = outPath(process.argv.slice(2));

  const { createLlmCaller } = await import('@/ai/llm');
  const { getPayPalClient } = await import('@/app/_server/paypal');
  const { serializeLlmCache } = await import('@/app/_server/llm-cache');
  const { buildAiCache } = await import('./build-lib');

  // 키는 있는지만 본다 (값을 찍지 않는다)
  if ((process.env.LLM_API_KEY ?? '').trim() === '') {
    console.error('LLM_API_KEY가 없다 — .env를 확인한다 (값은 찍지 않는다). 파일을 쓰지 않았다.');
    return 1;
  }
  const paypal = getPayPalClient();
  if (!paypal.ok) {
    console.error(`PayPal 샌드박스를 쓸 수 없다 (사유 코드: ${paypal.reason}). 파일을 쓰지 않았다.`);
    return 1;
  }

  const built = await buildAiCache({ inner: createLlmCaller(process.env as LlmEnv) });
  if (!built.paypal.ok) {
    console.error(`분쟁을 읽지 못했다 (사유 코드: ${built.paypal.reason ?? 'unknown'}). 파일을 쓰지 않았다.`);
    return 1;
  }

  const entries = Object.keys(built.cache.entries).length;
  console.log(`AI 호출 ${built.calls}회 → 캐시 항목 ${entries}개`);
  for (const item of built.cases) {
    console.log(`  ${item.disputeId}: 초안 ${item.draft ? 'O' : 'X'} · 번역·역번역 ${item.reply ? 'O' : 'X'}`);
  }
  if (entries === 0) {
    console.error('기록된 항목이 없다. 파일을 쓰지 않았다.');
    return 1;
  }

  mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.tmp`;
  writeFileSync(tmp, serializeLlmCache(built.cache), 'utf8');
  renameSync(tmp, out);
  console.log(`썼다: ${path.relative(ROOT, out)}`);
  return 0;
}

/** 단위 테스트가 import할 때는 돌지 않는다. */
if (process.argv[1] !== undefined && path.basename(process.argv[1]) === path.basename(__filename)) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      // 예외 글에 응답 글이 섞일 수 있어 이름만 찍는다
      console.error(`실패: ${error instanceof Error ? error.name : 'Error'}`);
      process.exitCode = 1;
    },
  );
}
