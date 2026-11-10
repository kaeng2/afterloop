/**
 * 분쟁 상세 (T061). Today 탭 오른쪽 칸이 부른다. 머리글 · 비교 카드 + 한 줄 요약 · [대화 | 답장 칸].
 * 이 파일은 POST를 보내지 않는다 (전송은 답장 칸 버튼 → 서버 액션 `./actions.ts`만).
 *
 * - 화면에 내지 않는 분쟁(연습용·시연 제외·표 밖)이면 PayPal을 읽지 않고 아무것도 그리지 않는다 (`null`).
 * - PayPal을 읽지 못했으면 "PayPal unavailable"을 보이고 답장 칸을 그리지 않는다.
 * - **Routine 분쟁**(엔진 `decideAutopilot`이 악용 의심으로 건너뛴 분쟁 = 목록의 Routine 묶음, Mike)은 머리글 +
 *   상태 문장만 (`RoutineDetail`). AI 초안·답장 칸을 만들지 않는다 (LLM 호출 0회).
 * - 보기용 값은 `buildCaseView`가 엔진 결과를 옮겨 만든다 (화면은 계산하지 않는다).
 * - `SentProvider`: 답장 칸이 보내기에 성공하면 머리글 위험 배지가 답장 뒤 엔진 값으로 바뀐다.
 */
import { reasonCopyKey } from '../_shared/availability';
import { t } from '../_shared/copy';
import { pickBoard } from '../_shared/dispute-view';
import { decideFor, routineLine } from '../today/model';
import { buildCaseView } from './model';
import { loadReply } from './reply/load';
import { ReplyPanel } from './reply/reply-panel';
import { RoutineDetail } from './routine-detail';
import { CaseView } from './view/case-view';
import { loadCase } from './view/load';
import { SentProvider } from './view/sent-state';

export async function CaseDetail({ disputeId }: { disputeId: string }) {
  // 먼저 AI 없이 읽는다 (Routine이면 여기서 끝난다). PayPal 읽기는 요청 안에서 한 번이다
  const light = await loadCase(disputeId, { draft: false });
  if (light.kind === 'not_found') return null;

  if (light.kind === 'paypal_unavailable') {
    return (
      <div className="notice stack">
        <span>{t('common.paypalUnavailable')}</span>
        {light.paypal.reason === undefined ? null : <span>{t(reasonCopyKey(light.paypal.reason))}</span>}
      </div>
    );
  }

  const board = pickBoard(light.loaded);
  const routine = routineLine(board, decideFor(board));
  if (routine !== null) return <RoutineDetail view={buildCaseView(light.input)} line={routine} />;

  const loaded = await loadCase(disputeId);
  if (loaded.kind !== 'ok') return null;

  const caseView = buildCaseView(loaded.input);
  const reply = await loadReply(disputeId);

  return (
    <SentProvider>
      <CaseView
        view={caseView}
        llmOk={loaded.llm.ok}
        reply={
          reply === null ? undefined : (
            <ReplyPanel
              disputeId={reply.disputeId}
              base={reply.base}
              replyId={reply.replyId}
              languageKey={reply.languageKey}
              buyerShort={reply.buyerShort}
            />
          )
        }
      />
    </SentProvider>
  );
}
