/**
 * `GET /api/health` (T070). Render 상태 확인 경로.
 * `{ ok: true, mode, commit? }`만 돌려준다 — env 값·비밀값 없음. PayPal·AI를 부르지 않는다.
 */
import { healthBody } from '../../_server/health';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json(healthBody(), { headers: { 'Cache-Control': 'no-store' } });
}
