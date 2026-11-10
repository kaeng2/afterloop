/**
 * S1 Today의 **임시** 화면 (T047). 뼈대가 섰는지만 보이고 내용은 없다.
 *
 * 이 파일을 채우는 것은 T014다 (`src/app/today/`). T047은 create-next-app 예시 화면을 지우고
 * 메뉴만 남긴다. 글자는 `nav.*`·`common.*` 문구에서 읽는다.
 */
import Link from 'next/link';

import { t } from './_shared/copy';
import { NAV_ITEMS } from './_shared/nav-items';

export default function Home() {
  return (
    <div className="stack">
      <h1 className="page-title">{t('nav.today')}</h1>
      <p className="notice">{t('common.notBuiltYet')}</p>
      <ul className="stack">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link className="nav-link" href={item.href}>
              {t(item.copyKey)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
