'use client';

/**
 * T116 F5-3: "Respond now" 바깥 칸 (`<section class="work zone-work">`).
 * Send 뒤(`useSent().sent`)에는 시안 L312 `sc-if sent`처럼 랜드마크 이름을 "Case progress"로 바꾼다.
 * T118 ③: Send 뒤에는 "Respond now" 머리(`head`)도 그리지 않는다 (내용 없는 머리가 "What happens next · Simulated"
 * 위에 남지 않게. 시안 L310–L312: Send 뒤 Zone A가 통째로 빠진다). 안쪽 칸 제목은 예외 결정대로 그대로다.
 */
import type { ReactNode } from 'react';

import { useT } from '../../_shared/locale-context';
import { useSent } from './sent-state';

export function WorkZone({ titleId, head, children }: { titleId: string; head?: ReactNode; children?: ReactNode }) {
  const t = useT();
  const { sent } = useSent();
  // 두 갈래 JSX 금지: children은 항상 같은 section 안 같은 자리에 있어야 Send 때 다시 마운트되지 않는다.
  return (
    <section
      className="work zone-work"
      aria-label={sent ? t('case.progress.zone') : undefined}
      aria-labelledby={sent ? undefined : titleId}
    >
      {sent ? null : head}
      {children}
    </section>
  );
}
