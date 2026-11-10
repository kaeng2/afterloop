'use client';

/**
 * 머리글 메뉴 (T047). 글자는 `nav.*` 문구에서 읽는다.
 *
 * 메뉴는 4개다 — Case(S5)는 메뉴에 없고 Inbox에서 들어간다 (주소는 `/cases/[disputeId]`).
 * 지금 보고 있는 화면을 표시하려고 주소를 읽으므로 클라이언트 컴포넌트다. 서버 전용 코드
 * (`_server/`)를 import하지 않는다. 항목과 판정은 `./nav-items`에 있다 (그리지 않는 부분).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { t } from './copy';
import { NAV_ITEMS, isActive } from './nav-items';

export function Nav() {
  const pathname = usePathname() ?? '/';
  return (
    <nav className="nav" aria-label={t('nav.appName')}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="nav-link"
          aria-current={isActive(pathname, item.href) ? 'page' : undefined}
        >
          {t(item.copyKey)}
        </Link>
      ))}
    </nav>
  );
}
