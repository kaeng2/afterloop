/**
 * `/lang?next=` 검사 (T081). 같은 사이트 경로(pathname+search)만 돌려주고, 아니면 '/'.
 * 역슬래시·제어문자·공백이 있으면 거부하고, `new URL(next, base)`의 origin이 요청 origin과 다르면 거부한다.
 */
const FORBIDDEN = /[\\\u0000- \u007f-\u009f]/;

export function safeNext(next: string | null | undefined, base: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || FORBIDDEN.test(next)) return '/';
  try {
    const url = new URL(next, base);
    if (url.origin !== new URL(base).origin) return '/';
    if (url.pathname.startsWith('//')) return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}
