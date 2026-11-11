/**
 * 요청 사이 읽기 캐시 (T084). **서버에서만** 부른다.
 *
 * 화면이 같은 분쟁 목록·분쟁 상세·주문 조회(GET)를 탭을 옮길 때마다 다시 읽지 않게, 받은 응답을 프로세스 메모리에
 * `READ_CACHE_TTL_MS`(90초) 동안 둔다.
 *
 * stale-while-revalidate (T088): 들어온 지 90초가 지났지만 `READ_CACHE_STALE_MAX_MS`(10분) 안이면 **지난 값을 바로**
 * 돌려주고, 같은 경로의 새로 읽기를 뒤에서 한 번만 시작한다 (진행 중이면 다시 시작하지 않는다). 새로 읽기가 2xx면 바꿔 넣고,
 * 실패(4xx·5xx·예외)하면 지난 값을 그대로 둔다 — 예외는 밖으로 새지 않는다. 10분이 지난 값은 버리고 기다려서 읽는다.
 * → **화면에 최대 10분 전 값이 보일 수 있다. 쓰기 뒤에는 바로 새 값** (쓰기가 그 키를 지우므로 다음 읽기는 기다려서 새로 읽는다).
 * 뒤에서 읽기도 실제 호출이라 기록기(서랍)에 한 줄 남는다. 뒤에서 읽는 중 쓰기로 키가 지워지면 늦게 온 옛 응답은
 * 다시 채우지 않는다 (세대 번호).
 *
 * - 담는 경로: 분쟁 목록·상세(`/v1/customer/disputes…`), 주문 조회(`/v2/checkout/orders/<번호>`). 그 밖의 GET은 그대로 지나간다
 *   (거래 조회는 `src/paypal/transactions.ts`가 따로 15분 캐시를 둔다).
 * - 키 = 경로 그대로 (쿼리 포함, 토큰·비밀값 없음). 값 = `{ status, body }` (PayPal 응답 본문 — 토큰 발급 응답은 이 길을 지나지 않는다).
 * - 2xx 응답만 담는다. 실패·예외는 담지 않는다 (다음 요청이 다시 읽는다).
 * - 같은 경로가 동시에 들어오면 진행 중인 Promise 하나를 함께 기다린다 (실제 호출 1회).
 * - 쓰기(`call`)가 끝나면 그 쓰기가 바꾼 읽기를 지운다 — 분쟁 쓰기는 분쟁 목록 + 그 분쟁 상세, 주문 추적 등록은 그 주문,
 *   모르는 경로는 전부. 쓰기가 실패해도 지운다 (무해). 지우는 동안 진행 중이던 읽기는 결과를 캐시에 넣지 않는다 (세대 번호).
 * - 캐시에서 꺼낸 응답은 실제 호출이 아니므로 기록기(`recordClient`)를 지나지 않는다 → 서랍에 새 줄이 생기지 않는다.
 *   이 감싸개는 기록기 **바깥**에 둔다.
 * - 꺼낼 때마다 복사본을 준다 (받는 쪽이 고쳐도 캐시가 바뀌지 않게).
 */
import 'server-only';

import type { ApiRequest, PayPalClient } from '@/types';

export const READ_CACHE_TTL_MS = 90_000;
/** 지난 값을 바로 보여 줄 수 있는 최대 나이 (T088, 10분). 이보다 오래되면 버리고 기다려서 읽는다. */
export const READ_CACHE_STALE_MAX_MS = 600_000;

const DISPUTES = '/v1/customer/disputes';
const ORDERS = '/v2/checkout/orders/';

type Response = { status: number; body: unknown };
type Entry = { value: Response; storedAt: number };

/** 캐시에 담는 경로인가. */
export function isCachedReadPath(path: string): boolean {
  return path === DISPUTES || path.startsWith(`${DISPUTES}?`) || path.startsWith(`${DISPUTES}/`) || /^\/v2\/checkout\/orders\/[^/?#]+$/.test(path);
}

const withoutQuery = (path: string) => path.split('?')[0].split('#')[0];

/** 쓰기 경로 → 지울 읽기 키를 고르는 함수. */
export function invalidatorFor(writePath: string): (readKey: string) => boolean {
  const path = withoutQuery(writePath);
  const dispute = path.match(/^\/v1\/customer\/disputes\/([^/]+)\/[^/]+$/);
  if (dispute !== null) {
    const detail = `${DISPUTES}/${dispute[1]}`;
    return (key) => withoutQuery(key) === DISPUTES || withoutQuery(key) === detail;
  }
  const order = path.match(/^\/v2\/checkout\/orders\/([^/]+)\/[^/]+$/);
  if (order !== null) {
    const detail = `${ORDERS}${order[1]}`;
    return (key) => withoutQuery(key) === detail;
  }
  return () => true;
}

const copyOf = (value: Response): Response => ({ status: value.status, body: structuredClone(value.body) });

export type ReadCache = {
  /** 읽기(GET)는 캐시, 쓰기(`call`)는 그대로 보내고 끝나면 관련 읽기를 지운다. */
  wrap: (client: PayPalClient) => PayPalClient;
  /** 쓰기만 지우기를 붙인다 (읽기는 캐시를 보지 않는다 — 보내기 직전 다시 읽기처럼 새 값이 필요한 곳). */
  wrapWritesOnly: (client: PayPalClient) => PayPalClient;
  /** 쓰기 경로 하나에 해당하는 읽기를 지운다. */
  invalidate: (writePath: string) => void;
  clear: () => void;
  /** 시험용: 지금 담긴 키와 값. */
  snapshot: () => { key: string; value: Response }[];
};

export function createReadCache(opts: { now?: () => number; ttlMs?: number; staleMaxMs?: number } = {}): ReadCache {
  const now = opts.now ?? (() => Date.now());
  const ttlMs = opts.ttlMs ?? READ_CACHE_TTL_MS;
  const staleMaxMs = Math.max(opts.staleMaxMs ?? READ_CACHE_STALE_MAX_MS, ttlMs);
  const entries = new Map<string, Entry>();
  const pending = new Map<string, Promise<Response>>();
  let generation = 0;

  function invalidate(writePath: string): void {
    const drop = invalidatorFor(writePath);
    generation += 1;
    for (const key of [...entries.keys()]) if (drop(key)) entries.delete(key);
    for (const key of [...pending.keys()]) if (drop(key)) pending.delete(key);
  }

  function clear(): void {
    generation += 1;
    entries.clear();
    pending.clear();
  }

  /** 실제 읽기 1회를 시작한다. 시작 때와 세대가 같을 때만 2xx를 담는다. 진행 중 표시는 끝나면 스스로 지운다. */
  function startRead(client: PayPalClient, path: string): Promise<Response> {
    const startedAt = generation;
    const request = client.get(path).then((res) => {
      if (generation === startedAt && res.status >= 200 && res.status < 300) {
        entries.set(path, { value: copyOf(res), storedAt: now() });
      }
      return res;
    });
    pending.set(path, request);
    const done = () => {
      if (pending.get(path) === request) pending.delete(path);
    };
    request.then(done, done);
    return request;
  }

  function cachedGet(client: PayPalClient): PayPalClient['get'] {
    return async (path) => {
      if (!isCachedReadPath(path)) return client.get(path);

      const hit = entries.get(path);
      if (hit !== undefined) {
        const age = now() - hit.storedAt;
        if (age < ttlMs) return copyOf(hit.value);
        if (age < staleMaxMs) {
          // 지난 값을 바로 준다. 뒤에서 한 번만 새로 읽는다 (실패는 조용히 버린다 — 지난 값 유지, unhandled rejection 없음)
          if (!pending.has(path)) startRead(client, path).catch(() => {});
          return copyOf(hit.value);
        }
        entries.delete(path); // 10분 지남 → 버리고 기다려서 읽는다
      }

      const inFlight = pending.get(path);
      if (inFlight !== undefined) return copyOf(await inFlight);

      return copyOf(await startRead(client, path));
    };
  }

  function invalidatingCall(client: PayPalClient): PayPalClient['call'] {
    return async (req: ApiRequest) => {
      try {
        return await client.call(req);
      } finally {
        invalidate(req.path);
      }
    };
  }

  return {
    wrap: (client) => ({ get: cachedGet(client), call: invalidatingCall(client) }),
    wrapWritesOnly: (client) => ({ get: (path) => client.get(path), call: invalidatingCall(client) }),
    invalidate,
    clear,
    snapshot: () => [...entries.entries()].map(([key, entry]) => ({ key, value: copyOf(entry.value) })),
  };
}
