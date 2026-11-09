/**
 * 샌드박스 자격 증명 읽기 (T001, SPEC v2.2 9-5장).
 *
 * `.env`는 **런타임에만** `process.loadEnvFile`로 읽는다. 값은 어디에도 출력하지 않는다.
 * 셸에서 이미 넘어온 값이 `.env`보다 우선한다 (잘못된 Secret로 한 번 돌려 보는 확인용).
 * 오류 문구에는 키 이름만 적고 값은 담지 않는다 (`.env`에 Secret이 잘못 붙어 있을 수 있다).
 */
import path from 'node:path';
import type { PayPalEnv } from '@/types';

/** 허용하는 단 하나의 baseUrl. live(실거래)는 쓰지 않는다. */
export const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';

/** 저장소 루트 (이 파일은 <root>/scripts/sandbox/ 안에 있다). */
export const ROOT = path.resolve(__dirname, '../..');

const KEYS = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_BASE_URL'] as const;

/** 값은 담지 않는 설정 오류. 호출하는 쪽은 이 문구만 보여 준다. */
export class SandboxEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxEnvError';
  }
}

/** Node 20.12+의 `process.loadEnvFile`. @types/node 버전에 따라 선언이 없을 수 있어 직접 집는다. */
function loadEnvFileInto(file: string): void {
  const load = (process as NodeJS.Process & { loadEnvFile?: (p?: string) => void }).loadEnvFile;
  if (typeof load !== 'function') {
    throw new SandboxEnvError('이 Node에는 process.loadEnvFile이 없다 (Node 20.12 이상이 필요하다).');
  }
  try {
    load.call(process, file);
  } catch {
    // .env가 없을 수 있다. 아래에서 "빠진 키" 오류로 알려 준다 (파일 경로·내용은 적지 않는다).
  }
}

/**
 * `.env`(또는 이미 들어온 환경 변수)에서 샌드박스 자격 증명을 읽는다.
 * 빠진 키가 있거나 baseUrl이 샌드박스가 아니면 `SandboxEnvError`를 던진다 (호출은 하지 않는다).
 */
export function loadSandboxEnv(root: string = ROOT): PayPalEnv {
  // 셸에서 넘어온 값을 먼저 잡아 두고, .env를 읽은 뒤 다시 덮어쓴다 (셸이 우선).
  const preset = new Map<string, string>();
  for (const key of KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== '') preset.set(key, value);
  }
  if (preset.size < KEYS.length) loadEnvFileInto(path.join(root, '.env'));
  for (const [key, value] of preset) process.env[key] = value;

  const missing = KEYS.filter((key) => (process.env[key] ?? '') === '');
  if (missing.length > 0) {
    throw new SandboxEnvError(`.env에 ${missing.join(', ')}가 없다 (.env.example을 보고 사람이 직접 채운다).`);
  }

  const baseUrl = (process.env.PAYPAL_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (baseUrl !== SANDBOX_BASE_URL) {
    // 받은 값은 적지 않는다.
    throw new SandboxEnvError(`PAYPAL_BASE_URL이 샌드박스(${SANDBOX_BASE_URL})가 아니다. 호출하지 않고 멈춘다.`);
  }

  return {
    clientId: (process.env.PAYPAL_CLIENT_ID ?? '').trim(),
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? '',
    baseUrl,
  };
}
