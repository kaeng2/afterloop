/**
 * S1 Today의 **임시** 화면 (T047). 뼈대가 섰는지만 보이고 내용은 없다.
 *
 * 이 파일을 채우는 것은 T014다 (`src/app/today/`). 메뉴는 머리글에 있으므로 본문에 다시 늘어놓지 않는다
 * (T047 보완 A-1). 글자는 `nav.*`·`common.*` 문구에서 읽는다.
 */
import { t } from './_shared/copy';

export default function Home() {
  return (
    <div className="stack">
      <h1 className="page-title">{t('nav.today')}</h1>
      <p className="notice">{t('common.notBuiltYet')}</p>
    </div>
  );
}
