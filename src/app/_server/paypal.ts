/**
 * 화면용 PayPal 클라이언트 (T047, SPEC v2.6 9-2장).
 *
 * **서버에서만 부른다.** 비밀값(`PAYPAL_CLIENT_SECRET`)이 브라우저 묶음에 들어가지 않게, 이 파일은
 * 서버 컴포넌트·서버 액션·라우트 핸들러에서만 import한다. 브라우저에서 불리면 호출 전에 거부한다.
 *
 * 환경 변수가 없거나 샌드박스가 아니면 **예외를 화면까지 올리지 않고** "쓸 수 없음"을 돌려준다
 * (화면은 `common.paypalUnavailable` 문구를 보인다). 값은 어디에도 싣지 않는다 — 키 이름만 적는다.
 *
 * `.env`는 사람이 직접 채운다 (CLAUDE.md). 이 코드는 `process.env`에서만 읽는다.
 *
 * `reason`은 고정 코드다 (`_shared/availability.ts`). 화면은 `common.reason.*` 문구로 옮긴다.
 *
 * 모드 관문 (T070): `DEMO_MODE`가 `recording`이 아니면(= public, 기본) 돌려주는 클라이언트의 쓰기
 * (`call` — GET이 아닌 모든 요청)는 **PayPal로 나가지 않는다**. 네트워크 호출 0회, 가짜 전송 호출기와 같은 꼴
 * (`{ status: 200, body: { simulated: true } }`)을 돌려준다. 읽기(`get`)는 public에서도 실제 샌드박스다.
 */
import 'server-only';

import { createPayPalClient } from '@/paypal/client';
import type { ClientDeps, PayPalClient, PayPalEnv } from '@/types';

import type { UnavailableReason } from '../_shared/availability';
import { resolveDemoMode } from './mode';

/** 허용하는 단 하나의 baseUrl. live(실거래)는 쓰지 않는다 (CLAUDE.md). */
export const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';

/** 사람이 `.env`에 채우는 키. 값은 읽기만 하고 출력·로그에 남기지 않는다. */
const KEYS = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_BASE_URL'] as const;

export type PayPalEnvVars = Partial<Record<(typeof KEYS)[number] | 'DEMO_MODE', string>>;

/** public에서 쓰기 대신 돌려주는 결과 (가짜 전송 호출기 `createSimulatedCaller`와 같은 꼴). */
export const SIMULATED_WRITE = { status: 200, body: { simulated: true } } as const;

/**
 * public이면 쓰기를 막은 클라이언트. `call`은 받은 요청을 보지도 남기지도 않고 가짜 결과만 돌려준다.
 * 읽기(`get`)는 원래 클라이언트로 그대로 간다.
 */
export function blockWrites(client: PayPalClient): PayPalClient {
  return {
    get: (path) => client.get(path),
    call: async () => ({ status: SIMULATED_WRITE.status, body: { ...SIMULATED_WRITE.body } }),
  };
}

/** 클라이언트를 만들 수 있었는지. 만들 수 없으면 `reason`은 고정 코드다 (값·문장을 담지 않는다). */
export type PayPalAvailability =
  | { ok: true; client: PayPalClient }
  | { ok: false; reason: UnavailableReason };

/** 실제 네트워크·시계. 단위 테스트는 `getPayPalClient`에 가짜 `deps`를 넣는다. */
function liveDeps(log?: ClientDeps['log']): ClientDeps {
  return {
    fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => fetch(input, init),
    now: () => Date.now(),
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    log,
  };
}

/**
 * 환경 변수로 PayPal 클라이언트를 만든다. 던지지 않는다.
 *
 * - 키가 빠졌으면 `not_configured`
 * - `PAYPAL_BASE_URL`이 샌드박스가 아니면 호출하지 않고 `not_sandbox` (받은 값은 적지 않는다)
 */
export function getPayPalClient(env: PayPalEnvVars = process.env as PayPalEnvVars, deps?: ClientDeps): PayPalAvailability {
  if (typeof window !== 'undefined') {
    return { ok: false, reason: 'server_only' };
  }

  const missing = KEYS.filter((key) => (env[key] ?? '').trim() === '');
  if (missing.length > 0) {
    return { ok: false, reason: 'not_configured' };
  }

  const baseUrl = (env.PAYPAL_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (baseUrl !== SANDBOX_BASE_URL) {
    return { ok: false, reason: 'not_sandbox' };
  }

  const paypalEnv: PayPalEnv = {
    clientId: (env.PAYPAL_CLIENT_ID ?? '').trim(),
    clientSecret: env.PAYPAL_CLIENT_SECRET ?? '',
    baseUrl,
  };

  try {
    const client = createPayPalClient(paypalEnv, deps ?? liveDeps());
    // 모드 관문: recording이 아니면 쓰기는 PayPal로 나가지 않는다 (스위치 값과 무관)
    return { ok: true, client: resolveDemoMode(env) === 'recording' ? client : blockWrites(client) };
  } catch {
    // 클라이언트가 설정을 거부했다 (샌드박스 밖 주소 등). 예외 문구를 그대로 올리지 않는다.
    return { ok: false, reason: 'client_error' };
  }
}
