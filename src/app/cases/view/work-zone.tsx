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
  return sent ? (
    <section className="work zone-work" aria-label={t('case.progress.zone')}>
      {children}
    </section>
  ) : (
    <section className="work zone-work" aria-labelledby={titleId}>
      {head}
      {children}
    </section>
  );
}
