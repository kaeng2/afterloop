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
import { recordClient } from './activity';
import { resolveDemoMode } from './mode';
import { createReadCache, type ReadCache } from './read-cache';

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
 * 환경 변수로 PayPal 클라이언트를 새로 만든다. 던지지 않는다. 감싸는 순서: 클라이언트 → (public이면) `blockWrites` → `recordClient`.
 *
 * - 키가 빠졌으면 `not_configured`
 * - `PAYPAL_BASE_URL`이 샌드박스가 아니면 호출하지 않고 `not_sandbox` (받은 값은 적지 않는다)
 */
function buildPayPalClient(env: PayPalEnvVars, deps: ClientDeps): PayPalAvailability {
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
    const client = createPayPalClient(paypalEnv, deps);
    // 모드 관문: recording이 아니면 쓰기는 PayPal로 나가지 않는다 (스위치 값과 무관)
    const gated = resolveDemoMode(env) === 'recording' ? client : blockWrites(client);
    // 기록기 (T064)는 관문 바깥: 막힌 쓰기는 "Simulated · not sent", 실제로 나간 요청만 응답 코드와 함께 남는다
    return { ok: true, client: recordClient(gated) };
  } catch {
    // 클라이언트가 설정을 거부했다 (샌드박스 밖 주소 등). 예외 문구를 그대로 올리지 않는다.
    return { ok: false, reason: 'client_error' };
  }
}

// ───────────────────────────── 프로세스당 클라이언트 하나 (T084) ─────────────────────────────

/**
 * 같은 설정인지 가르는 열쇠. **비밀값을 넣지 않는다** — 모드 이름, 샌드박스 주소, 키가 채워졌는지(0·1)만.
 * 열쇠가 바뀌면(모드가 바뀌는 등) 클라이언트와 읽기 캐시를 새로 만든다.
 */
function sharedKeyOf(env: PayPalEnvVars): string {
  const filled = KEYS.map((key) => ((env[key] ?? '').trim() === '' ? '0' : '1')).join('');
  return `${resolveDemoMode(env)}|${(env.PAYPAL_BASE_URL ?? '').trim()}|${filled}`;
}

export type SharedPayPal = {
  /** 토큰을 함께 쓰는 클라이언트. 읽기는 캐시를 보지 않는다(보내기 직전 다시 읽기용). 쓰기가 끝나면 관련 읽기 캐시를 지운다. */
  client: () => PayPalAvailability;
  /** 같은 클라이언트 + 읽기 캐시 (분쟁 목록·상세·주문 조회 90초). 화면 읽기용. */
  reader: () => PayPalAvailability;
};

/**
 * 프로세스에 하나 두는 클라이언트 묶음을 만든다. 화면은 아래 기본 묶음을 쓰고, 시험은 가짜 `env`·`deps`로 따로 만든다.
 *
 * 요청 사이에 함께 쓰게 되는 상태: 액세스 토큰(만료 60초 전까지 재사용, 동시 발급 1회), 최근 60초 호출 시각
 * (속도 제한 30회/60초 — PayPal 앱 하나의 한도라 함께 세는 것이 맞다). 재시도 횟수(429·5xx·401)는 호출 1건 안의
 * 지역 값이라 요청 사이에 섞이지 않는다.
 */
export function createSharedPayPal(opts: { env: () => PayPalEnvVars; deps: () => ClientDeps; cache: ReadCache }): SharedPayPal {
  let held: { key: string; client: PayPalClient; reader: PayPalClient } | null = null;

  function resolve(): { ok: true; client: PayPalClient; reader: PayPalClient } | { ok: false; reason: UnavailableReason } {
    const env = opts.env();
    const key = sharedKeyOf(env);
    if (held !== null && held.key === key) return { ok: true, client: held.client, reader: held.reader };
    held = null;
    opts.cache.clear();
    const made = buildPayPalClient(env, opts.deps());
    if (!made.ok) return made; // 실패는 붙잡아 두지 않는다
    // 둘 다 같은 바탕(관문 + 기록기)을 감싼다. 읽기 캐시는 기록기 바깥 → 캐시 적중은 서랍에 새 줄을 남기지 않는다
    held = { key, client: opts.cache.wrapWritesOnly(made.client), reader: opts.cache.wrap(made.client) };
    return { ok: true, client: held.client, reader: held.reader };
  }

  return {
    client: () => {
      const r = resolve();
      return r.ok ? { ok: true, client: r.client } : r;
    },
    reader: () => {
      const r = resolve();
      return r.ok ? { ok: true, client: r.reader } : r;
    },
  };
}

/** 화면 읽기 캐시와 클라이언트 묶음 (프로세스에 하나). */
const READ_CACHE = createReadCache();
const SHARED = createSharedPayPal({ env: () => process.env as PayPalEnvVars, deps: () => liveDeps(), cache: READ_CACHE });

/**
 * 화면용 PayPal 클라이언트. 던지지 않는다.
 *
 * - 인수 없이 부르면(= `process.env`, 실제 네트워크) 프로세스에 하나인 클라이언트 — 요청마다 토큰을 새로 받지 않는다.
 *   읽기 캐시는 보지 않는다 (보내기 직전 다시 읽기·추적 등록 대상 고르기는 언제나 새로 읽는다). 쓰기가 끝나면 관련 읽기 캐시를 지운다.
 * - `env`나 `deps`를 넘기면(시험) 매번 새로 만든다 (캐시 없음, 예전과 같다).
 */
export function getPayPalClient(env: PayPalEnvVars = process.env as PayPalEnvVars, deps?: ClientDeps): PayPalAvailability {
  if (typeof window !== 'undefined') {
    return { ok: false, reason: 'server_only' };
  }
  if (env === process.env && deps === undefined) return SHARED.client();
  return buildPayPalClient(env, deps ?? liveDeps());
}

/** 읽기 캐시에 담긴 응답 본문만 꺼낸다 (T115, /demo/seller-dashboard). PayPal을 부르지 않는다. 없으면 undefined. */
export function peekCachedRead(path: string): unknown {
  return READ_CACHE.peek(path)?.body;
}

/** 화면 읽기용 (분쟁 목록·상세, 주문 조회): 프로세스에 하나인 클라이언트 + 요청 사이 90초 캐시. 쓰기는 `getPayPalClient`와 같다. */
export function getPayPalReadClient(): PayPalAvailability {
  if (typeof window !== 'undefined') {
    return { ok: false, reason: 'server_only' };
  }
  return SHARED.reader();
}
