/**
 * PayPal 공통 클라이언트 (SPEC v2.1 9-2장). 모든 PayPal 호출은 이 파일 하나를 지난다.
 *
 *   토큰 재사용 → 만료 60초 전까지 같은 액세스 토큰을 쓴다
 *   토큰 발급   → 동시에 들어온 호출들은 진행 중인 발급 하나를 함께 기다린다 (동시 N개 → 발급 1회)
 *   401        → 토큰을 1회만 새로 받아 재시도, 또 401이면 에러
 *   429        → Retry-After초(없거나 꼴이 틀리면 30초, 최대 60초) 기다린 뒤 재시도, 최대 2회
 *   5xx·네트워크 → 2초 → 4초 기다린 뒤 재시도, 최대 2회
 *   속도 제한   → 최근 60초 동안 30회를 넘지 않게 기다린다
 *   POST       → PayPal-Request-Id는 재시도해도 같은 값 (중복 실행 방지)
 *   샌드박스만  → baseUrl이 https://api-m.sandbox.paypal.com이 아니면 만들 때 에러.
 *                path는 "/" 한 개로 시작하는 상대 경로만 받고, 붙여서 만든 URL의 origin도 확인한다
 *
 * 시간과 대기는 `deps.now` / `deps.sleep`만 쓴다. `Date.now`·`setTimeout`을 직접 쓰면
 * 테스트가 실제로 기다리게 되므로 쓰지 않는다.
 *
 * 비밀값(Client Secret, Basic 값, 액세스 토큰)은 로그·에러 메시지에 넣지 않는다.
 * 나가는 모든 문구(에러 message와 열거 가능한 속성, 로그 줄)는 `redact`를 지나므로
 * 실수로 섞여도 `[redacted]`로 바뀐다. 경로는 쿼리 문자열을 뗀 뒤에 싣는다.
 * 구매자 개인정보가 들어 있을 수 있는 요청·응답 본문도 로그에 남기지 않는다 (SPEC 10장).
 *
 * 서버 코드에서만 쓴다. `src/app/`의 `'use client'` 파일에서 import하지 않는다.
 */
import type { ApiRequest, ClientDeps, CreatePayPalClientFn, PayPalClient, PayPalEnv } from '@/types';

/** 허용하는 단 하나의 baseUrl. live(실거래)는 쓰지 않는다. */
const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';
/** 최종 URL이 벗어나면 안 되는 origin. */
const SANDBOX_ORIGIN = new URL(SANDBOX_BASE_URL).origin;
const TOKEN_PATH = '/v1/oauth2/token';

/** 만료 이 시간 전에 들어오면 토큰을 새로 받는다. */
const TOKEN_EARLY_REFRESH_MS = 60_000;

/** 속도 제한: 최근 RATE_WINDOW_MS 동안 RATE_LIMIT회까지 (토큰 발급 호출도 센다). */
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;

/** 429에 Retry-After가 없거나 꼴이 틀릴 때 기다리는 시간. */
const RETRY_AFTER_FALLBACK_MS = 30_000;
/** Retry-After가 아무리 길어도 이 시간까지만 기다린다. */
const RETRY_AFTER_MAX_MS = 60_000;
/** 받아들이는 Retry-After 꼴: 0 이상의 10진 정수 초만. */
const RETRY_AFTER_SECONDS = /^\d+$/;

/** 5xx·네트워크 오류 재시도 간격 (1회차 → 2회차). 길이가 최대 재시도 횟수다. */
const SERVER_BACKOFF_MS = [2_000, 4_000] as const;

/** 429 최대 재시도 횟수 (처음 호출 1회 + 재시도 2회 = 호출 3회). */
const MAX_RATE_LIMIT_RETRIES = 2;

/** path에 들어오면 안 되는 문자: 공백·제어문자·역슬래시 (URL을 다른 호스트로 돌릴 수 있다). */
const PATH_FORBIDDEN = /[\s\\\u0000-\u001f\u007f]/;

/** 에러·로그에 싣는 경로의 최대 길이. */
const LABEL_PATH_MAX = 120;

/** 호출 1건을 끝내 실패했을 때 던지는 에러. 비밀값은 담지 않는다. */
class PayPalCallError extends Error {
  /** HTTP 상태. 네트워크 오류나 호출 전 거부처럼 응답이 없으면 null */
  readonly status: number | null;
  /** 호출 경로 (baseUrl 뒤, 쿼리 문자열을 뺀 것. 비밀값은 가려져 있다). */
  readonly path: string;
  /** PayPal 응답의 debug_id (JSON 본문에 있을 때만). 없으면 null */
  readonly debugId: string | null;

  constructor(reason: string, path: string, status: number | null, debugId: string | null = null) {
    super(status === null ? `PayPal ${path}: ${reason}` : `PayPal ${path} → ${status}: ${reason}`);
    this.name = 'PayPalCallError';
    this.status = status;
    this.path = path;
    this.debugId = debugId;
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

/**
 * 재시도·실패로 버리는 응답의 본문을 닫는다 (연결을 붙잡지 않게).
 * 닫지 못해도 호출 흐름은 그대로 이어간다.
 */
function discardBody(res: Response): void {
  try {
    if (res.bodyUsed) return;
    const body: unknown = res.body;
    const cancel = (body as { cancel?: unknown } | null)?.cancel;
    if (typeof cancel === 'function') {
      void (cancel as () => Promise<void>).call(body).catch(() => {});
    }
  } catch {
    // 본문을 닫지 못하는 환경(가짜 응답 등)에서도 재시도는 계속한다
  }
}

/**
 * 실패한 응답에서 PayPal `debug_id`만 뽑는다 (JSON 본문에 있을 때만).
 * 본문 전체는 구매자 개인정보일 수 있어 담지 않는다.
 */
async function debugIdOf(res: Response): Promise<string | null> {
  try {
    const body = await readBody(res);
    if (typeof body === 'object' && body !== null) {
      const id = (body as Record<string, unknown>).debug_id;
      if (typeof id === 'string' && id !== '') return id;
    }
  } catch {
    // 본문을 못 읽어도 에러 사유는 남긴다
  }
  return null;
}

/** `Retry-After`(초) → ms. 0 이상의 10진 정수만 받고, 그 밖에는 30초. 상한 60초. */
function retryAfterMs(res: Response): number {
  const raw = res.headers.get('retry-after');
  if (raw === null) return RETRY_AFTER_FALLBACK_MS;
  const text = raw.trim();
  if (!RETRY_AFTER_SECONDS.test(text)) return RETRY_AFTER_FALLBACK_MS;
  const ms = Number(text) * 1000;
  if (!Number.isFinite(ms)) return RETRY_AFTER_FALLBACK_MS;
  return Math.min(ms, RETRY_AFTER_MAX_MS);
}

/** 네트워크 오류를 한 줄 사유로. 본문·헤더는 담지 않는다. */
function reasonOf(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message;
  return '원인을 알 수 없는 네트워크 오류';
}

export function createPayPalClient(env: PayPalEnv, deps: ClientDeps): PayPalClient {
  const baseUrl = env.baseUrl.replace(/\/+$/, '');
  if (baseUrl !== SANDBOX_BASE_URL) {
    // 받은 값은 적지 않는다 (설정 파일에서 잘못 붙은 Secret이 섞여 있을 수 있다).
    throw new Error(`PayPal baseUrl은 샌드박스(${SANDBOX_BASE_URL})만 허용한다. 설정을 확인한다.`);
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

  /**
   * 로그·에러에 싣는 경로.
   * 비밀값을 가리고 → 쿼리·프래그먼트를 떼고(구매자 식별값이 들어갈 수 있다) → 제어문자를 지우고 → 자른다.
   */
  function labelPath(path: string): string {
    const safe = redact(typeof path === 'string' ? path : String(path));
    const withoutQuery = safe.replace(/[?#][\s\S]*$/, '');
    const cleaned = withoutQuery.replace(/[\u0000-\u001f\u007f]/g, '');
    return cleaned.length > LABEL_PATH_MAX ? `${cleaned.slice(0, LABEL_PATH_MAX)}…` : cleaned;
  }

  function log(line: string): void {
    deps.log?.(redact(line));
  }

  function fail(reason: string, path: string, status: number | null, debugId: string | null = null): PayPalCallError {
    return new PayPalCallError(redact(reason), labelPath(path), status, debugId === null ? null : redact(debugId));
  }

  // ── path 검사 ──────────────────────────────────────────────────────────────
  /**
   * `get`·`call`의 path는 "/" 한 개로 시작하는 상대 경로만 받는다.
   * 토큰 발급·fetch보다 먼저 부른다 (틀린 path로는 토큰이 나가지 않는다).
   */
  function assertSafePath(path: string): void {
    const reject = (reason: string): never => {
      throw fail(reason, path, null);
    };

    if (typeof path !== 'string' || path === '') reject('경로가 비어 있다');
    if (!path.startsWith('/')) reject('경로는 "/"로 시작하는 상대 경로여야 한다');
    if (path.startsWith('//')) reject('경로는 "//"로 시작할 수 없다');
    if (path.includes('://')) reject('경로에 스킴(://)을 넣을 수 없다');
    if (PATH_FORBIDDEN.test(path)) reject('경로에 공백·제어문자·역슬래시를 넣을 수 없다');

    let origin: string | null = null;
    try {
      origin = new URL(`${baseUrl}${path}`).origin;
    } catch {
      reject('경로를 붙인 URL을 해석할 수 없다');
    }
    if (origin !== SANDBOX_ORIGIN) reject('경로를 붙인 URL이 샌드박스 주소를 벗어난다');
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
          discardBody(res);
          throw fail(`속도 제한(429)이 ${MAX_RATE_LIMIT_RETRIES}회 재시도 후에도 풀리지 않았다`, path, 429);
        }
        const waitMs = retryAfterMs(res);
        discardBody(res);
        rateLimitRetries += 1;
        log(`${label} → 429 · retry ${rateLimitRetries}/${MAX_RATE_LIMIT_RETRIES} after ${waitMs}ms`);
        await deps.sleep(waitMs);
        continue;
      }

      if (res.status >= 500) {
        const waitMs = SERVER_BACKOFF_MS[serverRetries];
        if (waitMs === undefined) {
          // 끝내 실패한 응답에서는 debug_id만 뽑아 둔다 (PayPal 문의용). 본문은 싣지 않는다.
          const debugId = await debugIdOf(res);
          const reason = `서버 오류가 ${SERVER_BACKOFF_MS.length}회 재시도 후에도 이어졌다`;
          throw fail(debugId === null ? reason : `${reason} (debug_id: ${debugId})`, path, res.status, debugId);
        }
        discardBody(res);
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
  /** 진행 중인 토큰 발급. 동시 호출은 이 Promise 하나를 함께 기다린다. */
  let issuing: Promise<string> | null = null;

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
      discardBody(res);
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

  /** 지금 쓸 수 있는 토큰 (없거나 만료 60초 안이면 null). */
  function usableToken(): string | null {
    if (token !== null && deps.now() < token.expiresAt - TOKEN_EARLY_REFRESH_MS) return token.value;
    return null;
  }

  /** 발급을 하나로 모은다: 이미 진행 중이면 그 Promise를 함께 기다린다 (동시 N개 → 발급 1회). */
  function issueOnce(): Promise<string> {
    if (issuing === null) {
      const pending: Promise<string> = issueToken().finally(() => {
        if (issuing === pending) issuing = null;
      });
      issuing = pending;
    }
    return issuing;
  }

  /** 쓸 수 있는 토큰. 없거나 만료 60초 안으로 들어오면 새로 받는다 (발급은 공유). */
  async function currentToken(): Promise<string> {
    return usableToken() ?? issueOnce();
  }

  /**
   * 401을 받은 뒤 토큰을 바꾼다.
   * 다른 호출이 이미 새 토큰을 받아 뒀으면 그것을 쓰고, 발급이 진행 중이면 함께 기다린다
   * (동시에 401을 받은 호출들이 발급 1회를 공유한다).
   */
  async function replaceToken(staleToken: string): Promise<string> {
    const fresh = usableToken();
    if (fresh !== null && fresh !== staleToken) return fresh;
    if (issuing === null) token = null; // 아직 아무도 새로 받지 않았다
    return issueOnce();
  }

  // ── 호출 1건 (401 재시도 포함) ─────────────────────────────────────────────
  async function request(req: ApiRequest | { method: 'GET'; path: string }): Promise<{ status: number; body: unknown }> {
    assertSafePath(req.path); // 토큰 발급·fetch보다 먼저
    const label = `${req.method} ${labelPath(req.path)}`;
    let refreshedOnce = false;
    let accessToken = await currentToken();

    for (;;) {
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
        discardBody(res);
        if (refreshedOnce) {
          throw fail('토큰을 새로 받은 뒤에도 401 (권한·앱 설정을 확인한다)', req.path, 401);
        }
        refreshedOnce = true;
        log(`${label} → 401 · refreshing the access token once`);
        accessToken = await replaceToken(accessToken);
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
      if (typeof req.requestId !== 'string' || req.requestId.trim() === '') {
        throw fail('requestId가 비어 있다 (PayPal-Request-Id는 반드시 보낸다)', req.path, null);
      }
      return request(req);
    },
    get: (path: string) => request({ method: 'GET', path }),
  };
}

/** 계약 확인: 위 함수가 `CreatePayPalClientFn`과 같은 꼴인지 타입 검사로 못 박는다. */
const contract: CreatePayPalClientFn = createPayPalClient;
void contract;
