'use client';

/**
 * T116 F5-3 → T122a (시안 v6 L323–L332): 답장 바깥 칸. Send 전에는 두 갈래다 (같은 `section` 하나 — class만 바뀐다):
 *
 *  - 스위치 꺼짐 (`showSimple`, 처음 상태): 흰 카드 (`.work-simple`). 머리 = "Your reply" + 오른쪽 "✦ AI Respond now" 스위치.
 *    본문 = 답장 칸이 그리는 빈 입력칸 하나 (선택지 카드 없음).
 *  - 스위치 켜짐 (`showAi`): `.zone-work` 카드. 머리 = "Your reply" + 부제 + 스위치. 본문 = 1 선택지 카드 → 2 Write and check.
 *
 * Send 뒤(`useSent().sent`)에는 시안 L312 `sc-if sent`처럼 랜드마크 이름을 "Case progress"로 바꾸고 머리를 그리지 않는다 (T118 ③).
 * T118 교훈: children(답장 칸)은 늘 같은 section 안 같은 자리 — 스위치·Send 때 다시 마운트되지 않는다.
 * 선택지 카드(`ai`)도 늘 같은 자리이고, 꺼짐이면 그 자리가 비어 있을 뿐이다.
 */
import type { ReactNode } from 'react';

import { AiPill } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import { useDeskSelection } from './desk-selection';
import { useSent } from './sent-state';

/** "✦ AI Respond now" 스위치 (시안 v6 L325 · L332 `.tg`). role=switch, aria-checked = 켜짐. */
export function AiSwitch() {
  const t = useT();
  const { aiOn, toggleAi } = useDeskSelection();
  return (
    <button type="button" className={aiOn ? 'tg on' : 'tg'} role="switch" aria-checked={aiOn} onClick={toggleAi}>
      <AiPill decorative />
      {t('case.work.title')}
      <span className="tg-tr" aria-hidden="true">
        <span className="tg-kn" />
      </span>
    </button>
  );
}

export function WorkZone({ titleId, ai, children }: { titleId: string; ai?: ReactNode; children?: ReactNode }) {
  const t = useT();
  const { sent } = useSent();
  const { aiOn } = useDeskSelection();
  // 두 갈래 JSX 금지: children은 항상 같은 section 안 같은 자리에 있어야 Send·스위치 때 다시 마운트되지 않는다.
  return (
    <section
      className={aiOn || sent ? 'work zone-work' : 'work work-simple'}
      aria-label={sent ? t('case.progress.zone') : aiOn ? t('case.work.title') : undefined}
      aria-labelledby={sent || aiOn ? undefined : titleId}
    >
      {sent ? null : (
        <div className="work-head">
          <div className="work-head-left">
            <h2 className="desk-card-title" id={titleId}>
              {t('case.reply.title')}
            </h2>
            {aiOn ? <span className="desk-card-sub">{t('case.work.sub')}</span> : null}
          </div>
          <AiSwitch />
        </div>
      )}
      {aiOn ? ai : null}
      {children}
    </section>
  );
}
