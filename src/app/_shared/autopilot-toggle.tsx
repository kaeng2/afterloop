/**
 * Autopilot 토글 자리 (T060). 기록·동작은 T064가 채운다 — 지금은 **꺼진 채 비활성**이고 툴팁으로 이유를 보인다.
 * 나중에 숨기기 쉽게 이 파일 하나에만 둔다 (`top-bar.tsx`에서 한 줄을 빼면 사라진다).
 */
import { t } from './copy';

export function AutopilotToggle() {
  const hint = t('shell.autopilotHint');
  return (
    <span className="shell-autopilot" title={hint}>
      <button type="button" role="switch" aria-checked={false} disabled className="shell-switch" aria-describedby="shell-autopilot-hint">
        <span className="shell-switch-knob" aria-hidden="true" />
      </button>
      <span className="shell-autopilot-label">{t('shell.autopilot')}</span>
      <span id="shell-autopilot-hint" className="shell-sr-only">
        {hint}
      </span>
    </span>
  );
}
