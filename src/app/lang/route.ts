/**
 * 언어 쿠키 쓰기 (T081). `/lang?set=ko&next=/demo/seller-dashboard` → 쿠키 저장 후 `next`(같은 사이트 안 경로만)로 돌려보낸다.
 * 데이터·PayPal·AI를 부르지 않는다.
 *
 * T115: Location은 **상대 경로**다. `new URL(safe, request.url)`은 Render 프록시 안쪽 주소(`https://localhost:10000`)를
 * 써서 브라우저가 접속하지 못했다. 브라우저가 지금 보는 주소 기준으로 풀도록 경로만 보낸다.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { safeNext } from '../_server/safe-next';
import { LOCALE_COOKIE, parseLocale } from '../_shared/copy';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams.get('set'));
  const safe = safeNext(request.nextUrl.searchParams.get('next'), request.url);
  const res = new NextResponse(null, { status: 307, headers: { Location: safe } });
  res.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return res;
}
