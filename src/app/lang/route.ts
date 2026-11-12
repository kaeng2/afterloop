/**
 * 언어 쿠키 쓰기 (T081). `/lang?set=ko&next=/listing` → 쿠키 저장 후 `next`(같은 사이트 안 경로만)로 돌려보낸다.
 * 데이터·PayPal·AI를 부르지 않는다.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { safeNext } from '../_server/safe-next';
import { LOCALE_COOKIE, parseLocale } from '../_shared/copy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('set'));
  const safe = safeNext(request.nextUrl.searchParams.get('next'), request.url);
  const res = NextResponse.redirect(new URL(safe, request.url));
  res.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
