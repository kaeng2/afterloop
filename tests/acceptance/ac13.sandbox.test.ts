/**
 * 인수 테스트 AC13: 샌드박스 세팅 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD v2 6-5 + 검토 M8 / 기획자 확정 2026-11-09
 * 기준: SPEC v2 9-5장. 작업: T001
 *
 * - "오프라인" 묶음은 항상 돈다: .env.example이 저장소에 들어가고 .env는 무시되는지.
 * - "샌드박스" 묶음은 RUN_SANDBOX=1일 때만 돈다: scripts/sandbox/check.ts --json을 실제로 실행한다.
 *   조회만 한다. 분쟁·주문 상태를 바꾸지 않는다.
 * - 샌드박스 개인 계정은 API로 목록을 볼 수 없으므로, T001이 기록한 tests/sandbox/manifest.json의
 *   주문·분쟁 ID를 조회하고 주문 상세의 결제자(payer)로 구매자 5명을 확인한다.
 * - 비즈니스 계정이 US(Fernwood Knits)인지는 API로 확인할 수 없어 사람이 확인한다 (T001 보고서).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const RUN_SANDBOX = process.env.RUN_SANDBOX === '1';
const SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';

/** 원문 6-1 상품명 (purchase_units[].items[].name) */
const PRODUCT_NAMES = ['Knit Cardigan, Oat', 'Wool Sweater, Navy', 'Cashmere Coat, Grey', 'Beanie + Scarf Set'];

/** 원문 6-2: 샌드박스 구매자별 주문 수 (합 12) */
const ORDERS_PER_BUYER: Record<string, number> = { seoyeon: 1, jiho: 1, yuki: 3, lena: 2, buyer_m: 5 };

/** 검토 M8: 결제자 국가. 한국 계정이 막히면 US 계정으로 대체 가능 */
const BUYER_COUNTRY: Record<string, string[]> = {
  seoyeon: ['KR', 'US'],
  jiho: ['KR', 'US'],
  yuki: ['JP'],
  lena: ['DE'],
  buyer_m: ['US'],
};

/** 원문 6-4·6-5: 샌드박스 분쟁 3건 */
const DISPUTES: Record<string, { buyer: string; reason: string }> = {
  D1: { buyer: 'jiho', reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' },
  D2: { buyer: 'seoyeon', reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED' },
  D3: { buyer: 'buyer_m', reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED' },
};

type Manifest = {
  orders: { key: string; orderId: string; buyer: string; sku: string; tracked: boolean }[];
  disputes: { key: string; disputeId: string; orderKey: string }[];
};

type CheckReport = {
  token: { ok: boolean };
  features: { disputes: number; transactionSearch: number };
  orders: {
    key: string;
    orderId: string;
    status: string;
    itemNames: string[];
    payerId: string;
    payerCountry: string;
    captureId: string;
    tracked: boolean;
  }[];
  disputes: { key: string; disputeId: string; reason: string; stage: string; status: string; captureIds: string[] }[];
};

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

const countBy = <T>(items: T[], key: (t: T) => string) =>
  items.reduce<Record<string, number>>((acc, t) => ({ ...acc, [key(t)]: (acc[key(t)] ?? 0) + 1 }), {});

// 기대값 출처: PRD v2 6-5 + 검토 M8 / 기획자 확정 2026-11-09
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

// 기대값 출처: PRD v2 6-5 + 검토 M8 / 기획자 확정 2026-11-09
describe.skipIf(!RUN_SANDBOX)('AC13 샌드박스 세팅: 실제 샌드박스 (RUN_SANDBOX=1)', () => {
  const env = { ...process.env, ...readDotEnv() } as Record<string, string | undefined>;
  const secret = env.PAYPAL_CLIENT_SECRET ?? '';
  let manifest: Manifest;
  let report: CheckReport;
  let stdout = '';
  let stderr = '';
  let exitCode: number | null = null;

  beforeAll(() => {
    manifest = JSON.parse(readFileSync(path.join(ROOT, 'tests/sandbox/manifest.json'), 'utf8')) as Manifest;
    const r = spawnSync('npx', ['tsx', 'scripts/sandbox/check.ts', '--json'], {
      cwd: ROOT,
      env: env as NodeJS.ProcessEnv,
      encoding: 'utf8',
      timeout: 180_000,
    });
    stdout = r.stdout ?? '';
    stderr = r.stderr ?? '';
    exitCode = r.status;
    const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '{}';
    report = JSON.parse(line) as CheckReport;
  }, 240_000);

  it('.env에 샌드박스 자격 증명이 있다', () => {
    expect(env.PAYPAL_CLIENT_ID, 'PAYPAL_CLIENT_ID').toBeTruthy();
    expect(secret.length, 'PAYPAL_CLIENT_SECRET').toBeGreaterThan(0);
    expect(env.PAYPAL_BASE_URL).toBe(SANDBOX_BASE);
  });

  it('check.ts 종료 코드 0, 토큰 발급 성공', () => {
    expect(exitCode, stderr.slice(0, 500)).toBe(0);
    expect(report.token.ok).toBe(true);
  });

  it('앱에서 Customer disputes와 Transaction search 기능이 켜져 있다 (둘 다 200)', () => {
    expect(report.features.disputes).toBe(200);
    expect(report.features.transactionSearch).toBe(200);
  });

  it('manifest에 주문 12건(구매자별 서연 1·지호 1·Yuki 3·Lena 2·buyer_m 5)과 분쟁 3건이 있다', () => {
    expect(manifest.orders).toHaveLength(12);
    expect(countBy(manifest.orders, (o) => o.buyer)).toEqual(ORDERS_PER_BUYER);
    expect(manifest.disputes.map((d) => d.key).sort()).toEqual(['D1', 'D2', 'D3']);
  });

  it('주문 12건이 모두 캡처 완료이고 상품명이 원문 4개 중 하나다', () => {
    expect(report.orders).toHaveLength(12);
    for (const o of report.orders) {
      expect(o.status, o.key).toBe('COMPLETED');
      expect(o.captureId, o.key).toBeTruthy();
      expect(o.itemNames.length, o.key).toBeGreaterThan(0);
      for (const name of o.itemNames) expect(PRODUCT_NAMES, `${o.key}: ${name}`).toContain(name);
    }
  });

  it('개인 계정 5개: 구매자마다 결제자 1명, 서로 다르고 국가가 맞다', () => {
    const byKey = new Map(report.orders.map((o) => [o.key, o]));
    const payerOf: Record<string, Set<string>> = {};
    for (const m of manifest.orders) {
      const o = byKey.get(m.key);
      expect(o, m.key).toBeDefined();
      (payerOf[m.buyer] ??= new Set()).add(o!.payerId);
      expect(BUYER_COUNTRY[m.buyer], `${m.key} ${m.buyer}`).toContain(o!.payerCountry);
    }
    for (const [buyer, ids] of Object.entries(payerOf)) expect(ids.size, buyer).toBe(1);
    const allPayers = new Set(Object.values(payerOf).flatMap((s) => [...s]));
    expect(allPayers.size).toBe(5);
  });

  it('추적번호: 7건 등록, 5건 미등록이고 manifest와 일치한다 (주문 상세 기준)', () => {
    const byKey = new Map(report.orders.map((o) => [o.key, o]));
    expect(report.orders.filter((o) => o.tracked)).toHaveLength(7);
    expect(report.orders.filter((o) => !o.tracked)).toHaveLength(5);
    for (const m of manifest.orders) expect(byKey.get(m.key)?.tracked, m.key).toBe(m.tracked);
  });

  it('합의 단계 분쟁 3건: D1 지호 SNAD, D2 서연 INR, D3 buyer_m INR이 해당 주문의 캡처에 걸려 있다', () => {
    const orderByKey = new Map(report.orders.map((o) => [o.key, o]));
    const manifestOrder = new Map(manifest.orders.map((o) => [o.key, o]));
    for (const md of manifest.disputes) {
      const d = report.disputes.find((x) => x.key === md.key);
      expect(d, md.key).toBeDefined();
      expect(d!.disputeId).toBe(md.disputeId);
      expect(d!.reason, md.key).toBe(DISPUTES[md.key].reason);
      expect(d!.stage, md.key).toBe('INQUIRY');
      expect(manifestOrder.get(md.orderKey)?.buyer, md.key).toBe(DISPUTES[md.key].buyer);
      expect(d!.captureIds, md.key).toContain(orderByKey.get(md.orderKey)?.captureId);
    }
  });

  it('출력과 last-run.md에 Client Secret, 토큰, Authorization 값이 없다', () => {
    const basic = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${secret}`).toString('base64');
    const out = stdout + stderr;
    expect(out.includes(secret)).toBe(false);
    expect(out.includes(basic)).toBe(false);
    expect(out).not.toMatch(/access_token/i);
    expect(out).not.toMatch(/Bearer\s+[A-Za-z0-9._\-$]{20,}/);

    const file = path.join(ROOT, 'tests/sandbox/last-run.md');
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    for (const d of manifest.disputes) expect(text).toContain(d.disputeId);
    expect(text.includes(secret)).toBe(false);
    expect(text).not.toMatch(/access_token/i);
  });
});
