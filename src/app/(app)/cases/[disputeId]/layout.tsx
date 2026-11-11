/**
 * 옛 주소 `/cases/[disputeId]`의 뼈대 (T060). `page.tsx`가 곧바로 `/?item=<번호>`로 보내므로 아무것도 더하지 않는다
 * (답장 칸은 Today 오른쪽 칸의 `../case-detail.tsx`가 그린다).
 */
import type { ReactNode } from 'react';

export default function CaseLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
