/**
 * 상태 확인 (T070). `/api/health`가 부른다. **서버에서만**.
 *
 * 돌려주는 것: `ok`, 모드 이름(`public`|`recording`), 배포된 커밋의 앞 7자리(Render가 주는
 * `RENDER_GIT_COMMIT`이 16진 글자일 때만). env 값·비밀값·스위치 값은 싣지 않는다.
 * PayPal·AI를 부르지 않는다.
 */
import 'server-only';

import { resolveDemoMode, type DemoMode } from './mode';

export type Health = { ok: true; mode: DemoMode; commit?: string };

export function healthBody(env: Record<string, string | undefined> = process.env): Health {
  const body: Health = { ok: true, mode: resolveDemoMode(env) };
  const commit = (env.RENDER_GIT_COMMIT ?? '').trim().toLowerCase();
  if (/^[0-9a-f]{7,40}$/.test(commit)) body.commit = commit.slice(0, 7);
  return body;
}
