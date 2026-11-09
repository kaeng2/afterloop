/**
 * 인수 테스트 AC13: 샌드박스 세팅 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09 (AC13 작성 승인 2026-11-09)
 * 기준: SPEC v1.1. 작업: T001
 *
 * - "오프라인" 묶음은 항상 돈다: .env.example이 저장소에 들어가고 .env는 무시되는지.
 * - "샌드박스" 묶음은 RUN_SANDBOX=1일 때만 돈다: scripts/sandbox/check.ts --json을 실제로 실행한다.
 *   조회만 한다 (토큰 발급, 분쟁 목록, 분쟁 상세). 분쟁 상태를 바꾸지 않는다.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const RUN_SANDBOX = process.env.RUN_SANDBOX === '1';
const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
/** 2026-11-09 테스트 구매자가 접수한 합의 단계 SNAD 분쟁 */
const DISPUTE_ID = 'PP-R-XWI-10197379';

/** .env를 읽는다 (값은 테스트 안에서만 쓰고 출력하지 않는다) */
function readDotEnv(): Record<string, string> {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return {};
  const pairs = readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] as const;
    });
  return Object.fromEntries(pairs);
}

const gitIgnored = (file: string) => spawnSync('git', ['check-ignore', '-q', file], { cwd: ROOT }).status === 0;

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe('AC13 샌드박스 세팅: 오프라인 확인', () => {
  it('.env.example이 있고 PayPal 키 자리가 있다 (값은 비어 있음)', () => {
    const file = path.join(ROOT, '.env.example');
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    for (const key of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_BASE_URL']) {
      expect(text, key).toMatch(new RegExp(`^${key}=`, 'm'));
    }
    expect(text).not.toMatch(/^PAYPAL_CLIENT_SECRET=\S+/m);
  });

  it('.env는 git이 무시하고 .env.example은 무시하지 않는다', () => {
    expect(gitIgnored('.env')).toBe(true);
    expect(gitIgnored('.env.example')).toBe(false);
  });
});

// 기대값 출처: PRD 6-3 / 기획자 확정 2026-11-09
describe.skipIf(!RUN_SANDBOX)('AC13 샌드박스 세팅: 실제 샌드박스 (RUN_SANDBOX=1)', () => {
  const env = { ...process.env, ...readDotEnv() } as Record<string, string | undefined>;
  let stdout = '';
  let stderr = '';
  let exitCode: number | null = null;

  beforeAll(() => {
    const r = spawnSync('npx', ['tsx', 'scripts/sandbox/check.ts', '--json'], {
      cwd: ROOT,
      env: env as NodeJS.ProcessEnv,
      encoding: 'utf8',
      timeout: 90_000,
    });
    stdout = r.stdout ?? '';
    stderr = r.stderr ?? '';
    exitCode = r.status;
  }, 120_000);

  const report = () => {
    const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '';
    return JSON.parse(line) as {
      token: { ok: boolean };
      list: { status: number; count: number };
      detail: { status: number; disputeId: string; rels: string[] };
    };
  };

  it('.env에 샌드박스 자격 증명이 있다', () => {
    expect(env.PAYPAL_CLIENT_ID, 'PAYPAL_CLIENT_ID').toBeTruthy();
    expect(env.PAYPAL_CLIENT_SECRET, 'PAYPAL_CLIENT_SECRET').toBeTruthy();
    expect(env.PAYPAL_BASE_URL).toBe(SANDBOX_BASE);
  });

  it('check.ts --json: 종료 코드 0, 토큰·분쟁 목록·분쟁 상세 모두 성공', () => {
    expect(exitCode, stderr.slice(0, 500)).toBe(0);
    const r = report();
    expect(r.token.ok).toBe(true);
    expect(r.list.status).toBe(200);
    expect(r.list.count).toBeGreaterThanOrEqual(1);
    expect(r.detail.status).toBe(200);
    expect(r.detail.disputeId).toBe(DISPUTE_ID);
    expect(Array.isArray(r.detail.rels)).toBe(true);
    expect(r.detail.rels).toContain('self');
  });

  it('출력에 Client Secret, 토큰, Authorization 값이 없다', () => {
    const secret = env.PAYPAL_CLIENT_SECRET ?? '';
    const basic = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${secret}`).toString('base64');
    const out = stdout + stderr;
    expect(secret.length).toBeGreaterThan(0);
    expect(out.includes(secret)).toBe(false);
    expect(out.includes(basic)).toBe(false);
    expect(out).not.toMatch(/access_token/i);
    expect(out).not.toMatch(/Bearer\s+[A-Za-z0-9._\-$]{20,}/);
  });

  it('tests/sandbox/last-run.md에 분쟁 ID가 기록되고 비밀값은 없다', () => {
    const file = path.join(ROOT, 'tests/sandbox/last-run.md');
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    expect(text).toContain(DISPUTE_ID);
    expect(text.includes(env.PAYPAL_CLIENT_SECRET ?? '')).toBe(false);
    expect(text).not.toMatch(/access_token/i);
  });
});
