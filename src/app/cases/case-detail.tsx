/**
 * 분쟁 상세 (S5 1부 보기 + 2부 답장 칸)를 한 덩어리로 (T060). Today 탭 오른쪽 칸이 부른다.
 *
 * 옛 `/cases/[disputeId]`의 `page.tsx`(1부)와 `layout.tsx`(2부 답장 칸)가 하던 일을 그대로 옮겼다 —
 * 구조를 바꾸는 것은 T061이다. 이 파일은 POST를 보내지 않는다 (전송은 답장 칸 버튼 → 서버 액션 `./actions.ts`만).
 *
 * - 화면에 내지 않는 분쟁(연습용·시연 제외·표 밖)이면 PayPal을 읽지 않고 아무것도 그리지 않는다 (`null`).
 * - PayPal을 읽지 못했으면 "PayPal unavailable"을 보이고 답장 칸을 그리지 않는다.
 * - 보기용 값은 `buildCaseView`가 엔진 결과를 옮겨 만든다 (화면은 계산하지 않는다).
 */
import { reasonCopyKey } from '../_shared/availability';
import { t } from '../_shared/copy';
import { buildCaseView } from './model';
import { loadReply } from './reply/load';
import { ReplyPanel } from './reply/reply-panel';
import { CaseView } from './view/case-view';
import { loadCase } from './view/load';

export async function CaseDetail({ disputeId }: { disputeId: string }) {
  const loaded = await loadCase(disputeId);
  if (loaded.kind === 'not_found') return null;

  if (loaded.kind === 'paypal_unavailable') {
    return (
      <div className="notice stack">
        <span>{t('common.paypalUnavailable')}</span>
        {loaded.paypal.reason === undefined ? null : <span>{t(reasonCopyKey(loaded.paypal.reason))}</span>}
      </div>
    );
  }

  const view = <CaseView view={buildCaseView(loaded.input)} llmOk={loaded.llm.ok} />;
  const reply = await loadReply(disputeId);
  if (reply === null) return view;

  return (
    <div className="case-shell">
      <div className="case-shell-main">{view}</div>
      <aside className="case-shell-reply">
        <ReplyPanel disputeId={reply.disputeId} base={reply.base} replyId={reply.replyId} languageKey={reply.languageKey} />
      </aside>
    </div>
  );
}
