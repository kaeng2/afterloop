'use client';
/**
 * `(app)` 화면의 `?lang=ko|en` 처리 (T113). **전체 페이지 이동**(`location.replace`)으로 `/lang`에 가서 쿠키를 쓰고
 * 같은 화면으로 돌아온다. router 이동(서버 `redirect()`가 Suspense 안에서 바뀌는 꼴)을 쓰지 않는다 — 언어가 다른
 * 트리로 소프트 이동하면서 React #310이 났다. 주소는 `langRedirectTarget`(같은 사이트 `/lang?…`)만 받는다.
 * 기다리는 동안은 로딩 문구 한 줄 (`common.loading`).
 */
import { useEffect } from 'react';

import { useT } from './locale-context';

export function LangRedirect({ href }: { href: string }) {
  const t = useT();
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return (
    <p className="small muted" role="status">
      {t('common.loading')}
    </p>
  );
}
