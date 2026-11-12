'use client';

/**
 * T116 F5-3: "Respond now" 바깥 칸 (`<section class="work zone-work">`).
 * Send 뒤(`useSent().sent`)에는 시안 L312 `sc-if sent`처럼 랜드마크 이름을 "Case progress"로 바꾼다.
 * 보이는 제목은 그대로다 (안쪽 칸 제목 "What happens next · Simulated"는 예외 결정대로). aria 이름만 바뀐다.
 */
import type { ReactNode } from 'react';

import { useT } from '../../_shared/locale-context';
import { useSent } from './sent-state';

export function WorkZone({ titleId, children }: { titleId: string; children: ReactNode }) {
  const t = useT();
  const { sent } = useSent();
  return sent ? (
    <section className="work zone-work" aria-label={t('case.progress.zone')}>
      {children}
    </section>
  ) : (
    <section className="work zone-work" aria-labelledby={titleId}>
      {children}
    </section>
  );
}
