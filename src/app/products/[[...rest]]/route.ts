/**
 * T114: /products 화면은 11/12 11:15 결정으로 지웠다. 옛 주소(`/products`, `/products?sku=…`, `/products/…`)는
 * `/`로 **308 영구 이동**한다. (`next.config` redirects와 같은 효과. 그 파일은 이 레인 설정에서 편집이 막혀 있어 라우트로 둔다.)
 *
 * 쿼리는 그대로 넘긴다 (Next redirects 기본 동작과 같다) — `/`는 `sku`를 읽지 않고, `lang`은 그대로 쓴다.
 * 데이터·PayPal·AI를 부르지 않는다.
 */
import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export const REMOVED_ROUTE_STATUS = 308;

export function GET(request: NextRequest) {
  // 상대 Location: Render 같은 프록시 뒤에서는 request.url 호스트가 내부 주소(localhost:10000)라 절대 주소를 만들면 안 된다.
  return new NextResponse(null, {
    status: REMOVED_ROUTE_STATUS,
    headers: { Location: '/' + request.nextUrl.search },
  });
}
