/**
 * 옛 주소 → 새 주소 308 (T115, 사람 결정 2026-11-12 11:20 (3)). 쿼리(`?lang=`, `?item=` …)는 그대로 붙인다.
 * Location은 **상대 경로** — 프록시 안쪽 주소(`https://localhost:10000`)로 튕기지 않게 (`/lang`과 같은 방식).
 * (`next.config.ts` redirects는 이 worktree에서 편집이 잠겨 있어 라우트 핸들러로 둔다.)
 */
export function movedPermanently(request: Request, to: string): Response {
  const search = new URL(request.url).search;
  return new Response(null, { status: 308, headers: { Location: to + search } });
}
