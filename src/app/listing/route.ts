/** 옛 주소 `/listing` → `/demo/store/new-product` (308, 쿼리 그대로, 상대 경로). T115. `/listing/*.jpg` 사진은 public이 먼저라 그대로 */
import { movedPermanently } from '../_server/moved';
import { NEW_PRODUCT_PATH } from '../_shared/routes';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return movedPermanently(request, NEW_PRODUCT_PATH);
}
