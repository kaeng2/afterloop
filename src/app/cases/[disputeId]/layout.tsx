/**
 * S5 Case 한 화면 합치기 (T009 2부). 1부 화면(`page.tsx` = children) 옆에 답장 칸을 그린다.
 *
 * - 답장 칸은 스스로 읽는다 (`../reply/load.ts`). PayPal 읽기·AI 초안은 1부와 같은 요청 안에서 한 번만이다.
 * - 화면에 내지 않는 분쟁(연습용·시연 제외·표 밖)이거나 PayPal을 읽지 못했으면 답장 칸을 그리지 않는다 —
 *   1부 화면이 "찾을 수 없음" 또는 "PayPal unavailable"을 보인다. 이때 어떤 POST도 나가지 않는다.
 * - 이 파일은 POST를 보내지 않는다. 전송은 답장 칸의 버튼 → 서버 액션(`../actions.ts`)만.
 */
import type { ReactNode } from 'react';

import { loadReply } from '../reply/load';
import { ReplyPanel } from '../reply/reply-panel';

export const dynamic = 'force-dynamic';

type Props = { children: ReactNode; params: Promise<{ disputeId: string }> };

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function CaseLayout({ children, params }: Props) {
  const { disputeId } = await params;
  const reply = await loadReply(decode(disputeId));
  if (reply === null) return <>{children}</>;

  return (
    <div className="case-shell">
      <div className="case-shell-main">{children}</div>
      <aside className="case-shell-reply">
        <ReplyPanel disputeId={reply.disputeId} base={reply.base} replyId={reply.replyId} languageKey={reply.languageKey} />
      </aside>
    </div>
  );
}
