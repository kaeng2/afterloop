/** 옛 주소 `/intro` → `/demo/seller-dashboard` (308, 쿼리 그대로, 상대 경로). T115 */
import { movedPermanently } from '../_server/moved';
import { SELLER_DASHBOARD_PATH } from '../_shared/routes';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return movedPermanently(request, SELLER_DASHBOARD_PATH);
}
