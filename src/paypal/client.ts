/**
 * PayPal 공통 클라이언트 (SPEC v2.1 9-2장). 모든 PayPal 호출은 이 파일 하나를 지난다.
 *
 *   토큰 재사용 → 만료 60초 전까지 같은 액세스 토큰을 쓴다
 *   401        → 토큰을 1회만 새로 받아 재시도, 또 401이면 에러
 *   429        → Retry-After초(없으면 30초) 기다린 뒤 재시도, 최대 2회
 *   5xx·네트워크 → 2초 → 4초 기다린 뒤 재시도, 최대 2회
 *   속도 제한   → 최근 60초 동안 30회를 넘지 않게 기다린다
 *   POST       → PayPal-Request-Id는 재시도해도 같은 값 (중복 실행 방지)
 *   샌드박스만  → baseUrl이 https://api-m.sandbox.paypal.com이 아니면 만들 때 에러
 *
 * 시간과 대기는 `deps.now` / `deps.sleep`만 쓴다. `Date.now`·`setTimeout`을 직접 쓰면
 * 테스트가 실제로 기다리게 되므로 쓰지 않는다.
 *
 * 비밀값(Client Secret, Basic 값, 액세스 토큰)은 로그·에러 메시지에 넣지 않는다.
 * 나가는 모든 문구는 `redact`를 지나므로 실수로 섞여도 `[redacted]`로 바뀐다.
 * 구매자 개인정보가 들어 있을 수 있는 요청·응답 본문도 로그에 남기지 않는다 (SPEC 10장).
 *
 * 서버 코드에서만 쓴다. `src/app/`의 `'use client'` 파일에서 import하지 않는다.
 */
import type { ApiRequest, ClientDeps, CreatePayPalClientFn, PayPalClient, PayPalEnv } from '@/types';

/** 허용하는 단 하나의 baseUrl. live(실거래)는 쓰지 않는다. */
const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';
const TOKEN_PATH = '/v1/oauth2/token';

/** 만료 이 시간 전에 들어오면 토큰을 새로 받는다. */
const TOKEN_EARLY_REFRESH_MS = 60_000;

/** 속도 제한: 최근 RATE_WINDOW_MS 동안 RATE_LIMIT회까지 (토큰 발급 호출도 센다). */
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;

/** 429에 Retry-After가 없을 때 기다리는 시간. */
const RETRY_AFTER_FALLBACK_MS = 30_000;

/** 5xx·네트워크 오류 재시도 간격 (1회차 → 2회차). 길이가 최대 재시도 횟수다. */
const SERVER_BACKOFF_MS = [2_000, 4_000] as const;

/** 429 최대 재시도 횟수 (처음 호출 1회 + 재시도 2회 = 호출 3회). */
const MAX_RATE_LIMIT_RETRIES = 2;

/** 호출 1건을 끝내 실패했을 때 던지는 에러. 비밀값은 담지 않는다. */
class PayPalCallError extends Error {
  /** HTTP 상태. 네트워크 오류처럼 응답이 없으면 null */
  readonly status: number | null;
  /** 호출 경로 (baseUrl 뒤). */
  readonly path: string;

  constructor(reason: string, path: string, status: number | null) {
    super(status === null ? `PayPal ${path}: ${reason}` : `PayPal ${path} → ${status}: ${reason}`);
    this.name = 'PayPalCallError';
    this.status = status;
    this.path = path;
  }
}

/** Basic 인증 문자열. Node에서는 Buffer, 그 밖에서는 btoa를 쓴다. */
function toBase64(text: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
  return btoa(text);
}

/** 응답 본문: JSON으로 읽고, 빈 본문은 null, JSON이 아니면 원문 그대로. */
async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** `Retry-After`(초) → ms. 없거나 숫자가 아니면 30초. */
function retryAfterMs(res: Response): number {
  const raw = res.headers.get('retry-after');
  if (raw === null) return RETRY_AFTER_FALLBACK_MS;
  const seconds = Number(raw.trim());
  if (!Number.isFinite(seconds) || seconds < 0) return RETRY_AFTER_FALLBACK_MS;
  return Math.round(seconds * 1000);
}

/** 네트워크 오류를 한 줄 사유로. 본문·헤더는 담지 않는다. */
function reasonOf(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message;
  return '원인을 알 수 없는 네트워크 오류';
}

export function createPayPalClient(env: PayPalEnv, deps: ClientDeps): PayPalClient {
  const baseUrl = env.baseUrl.replace(/\/+$/, '');
  if (baseUrl !== SANDBOX_BASE_URL) {
    throw new Error(`PayPal baseUrl은 샌드박스(${SANDBOX_BASE_URL})만 허용한다. 받은 값: ${env.baseUrl}`);
  }

  const basic = toBase64(`${env.clientId}:${env.clientSecret}`);

  /** 바깥으로 나가면 안 되는 값들. 토큰은 받을 때마다 더한다. */
  const secrets = new Set<string>([env.clientSecret, basic]);

  /** 로그·에러 문구에서 비밀값을 가린다. */
  function redact(text: string): string {
    let out = text;
    for (const secret of secrets) {
      if (secret !== '') out = out.split(secret).join('[redacted]');
    }
    return out;
  }

  function log(line: string): void {
    deps.log?.(redact(line));
  }

  function fail(reason: string, path: string, status: number | null): PayPalCallError {
    return new PayPalCallError(redact(reason), path, status);
  }

  // ── 속도 제한 ──────────────────────────────────────────────────────────────
  /** 최근 호출 시각 (오래된 것부터). 토큰 발급도 PayPal 호출이므로 함께 센다. */
  const recent: number[] = [];

  async function waitForSlot(): Promise<void> {
    for (;;) {
      const now = deps.now();
      while (recent.length > 0 && now - recent[0] >= RATE_WINDOW_MS) recent.shift();
      if (recent.length < RATE_LIMIT) {
        recent.push(now);
        return;
      }
      const waitMs = recent[0] + RATE_WINDOW_MS - now;
      log(`rate guard · ${recent.length} calls in the last 60s · waiting ${waitMs}ms`);
      await deps.sleep(waitMs);
    }
  }

  // ── HTTP 1건 (속도 제한 + 429·5xx·네트워크 재시도) ─────────────────────────
  /**
   * 같은 `init`을 그대로 다시 보내므로 PayPal-Request-Id도 그대로다.
   * 401은 여기서 다루지 않는다 (토큰을 아는 `request`가 맡는다).
   */
  async function send(path: string, init: RequestInit, label: string): Promise<Response> {
    let rateLimitRetries = 0;
    let serverRetries = 0;

    for (;;) {
      await waitForSlot();

      let res: Response;
      try {
        res = await deps.fetch(`${baseUrl}${path}`, init);
      } catch (error) {
        const waitMs = SERVER_BACKOFF_MS[serverRetries];
        if (waitMs === undefined) {
          throw fail(`네트워크 오류로 ${SERVER_BACKOFF_MS.length}회 재시도 후 실패: ${reasonOf(error)}`, path, null);
        }
        serverRetries += 1;
        log(`${label} network error · retry ${serverRetries}/${SERVER_BACKOFF_MS.length} after ${waitMs}ms`);
        await deps.sleep(waitMs);
        continue;
      }

      if (res.status === 429) {
        if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
          throw fail(`속도 제한(429)이 ${MAX_RATE_LIMIT_RETRIES}회 재시도 후에도 풀리지 않았다`, path, 429);
        }
        const waitMs = retryAfterMs(res);
        rateLimitRetries += 1;
        log(`${label} → 429 · retry ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES} after ${waitMs}ms`);
        await deps.sleep(waitMs);
        continue;
      }

      if (res.status >= 500) {
        const waitMs = SERVER_BACKOFF_MS[serverRetries];
        if (waitMs === undefined) {
          throw fail(`서버 오류가 ${SERVER_BACKOFF_MS.length}회 재시도 후에도 이어졌다`, path, res.status);
        }
        serverRetries += 1;
        log(`${label} → ${res.status} · retry ${serverRetries}/${SERVER_BACKOFF_MS.length} after ${waitMs}ms`);
        await deps.sleep(waitMs);
        continue;
      }

      return res;
    }
  }

  // ── 액세스 토큰 ────────────────────────────────────────────────────────────
  let token: { value: string; expiresAt: number } | null = null;

  async function issueToken(): Promise<string> {
    const res = await send(
      TOKEN_PATH,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
      },
      'POST /v1/oauth2/token',
    );

    if (res.status !== 200) {
      throw fail('액세스 토큰 발급 실패 (Client ID·Secret과 앱 설정을 확인한다)', TOKEN_PATH, res.status);
    }

    const body = await readBody(res);
    const fields = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const accessToken = fields.access_token;
    if (typeof accessToken !== 'string' || accessToken === '') {
      throw fail('토큰 응답에 access_token이 없다', TOKEN_PATH, res.status);
    }
    secrets.add(accessToken);

    const expiresIn = fields.expires_in;
    const lifetimeMs = typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn * 1000 : 0;
    token = { value: accessToken, expiresAt: deps.now() + lifetimeMs };
    log(`token issued · valid for ${Math.round(lifetimeMs / 1000)}s`);
    return accessToken;
  }

  /** 쓸 수 있는 토큰. 없거나 만료 60초 안으로 들어오면 새로 받는다. */
  async function currentToken(): Promise<string> {
    if (token !== null && deps.now() < token.expiresAt - TOKEN_EARLY_REFRESH_MS) return token.value;
    return issueToken();
  }

  // ── 호출 1건 (401 재시도 포함) ─────────────────────────────────────────────
  async function request(req: ApiRequest | { method: 'GET'; path: string }): Promise<{ status: number; body: unknown }> {
    const label = `${req.method} ${req.path}`;
    let refreshedOnce = false;

    for (;;) {
      const accessToken = await currentToken();

      const headers: Record<string, string> = {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      };
      const init: RequestInit = { method: req.method, headers };
      if (req.method === 'POST') {
        headers['content-type'] = 'application/json';
        headers['paypal-request-id'] = req.requestId;
        init.body = JSON.stringify(req.body);
      }

      const res = await send(req.path, init, label);

      if (res.status === 401) {
        if (refreshedOnce) {
          throw fail('토큰을 새로 받은 뒤에도 401 (권한·앱 설정을 확인한다)', req.path, 401);
        }
        refreshedOnce = true;
        token = null; // 다음 차례에 새로 받는다
        log(`${label} → 401 · refreshing the access token once`);
        continue;
      }

      const body = await readBody(res);
      log(`${label} → ${res.status}`);
      return { status: res.status, body };
    }
  }

  return {
    // 동기로 던지지 않는다 (호출하는 쪽은 언제나 Promise로 받는다).
    call: async (req: ApiRequest) => {
      if (req.requestId === '') {
        throw new Error(`PayPal POST ${req.path}: requestId가 비어 있다 (PayPal-Request-Id는 반드시 보낸다)`);
      }
      return request(req);
    },
    get: (path: string) => request({ method: 'GET', path }),
  };
}

/** 계약 확인: 위 함수가 `CreatePayPalClientFn`과 같은 꼴인지 타입 검사로 못 박는다. */
const contract: CreatePayPalClientFn = createPayPalClient;
void contract;
