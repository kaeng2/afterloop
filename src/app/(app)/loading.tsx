/**
 * 탭을 누르면 바로 보이는 로딩 표시 (T084). 본문(Today·Products)이 PayPal을 읽는 동안 `(app)` 뼈대 안 본문 자리에 나온다.
 * 색은 강조색 css 변수, 글자는 `config/copy.*.json`의 `common.loading`. 숫자를 내지 않는다.
 */
import { t } from '@/app/_shared/copy';

import '@/app/_shared/shell.css';

export default function Loading() {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <span className="app-loading-bar" aria-hidden="true" />
      <span className="app-loading-text small muted">{t('common.loading')}</span>
    </div>
  );
}
