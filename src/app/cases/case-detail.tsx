/**
 * 분쟁 상세 (T061 → T076 시안 v4). Today 탭 오른쪽 칸이 부른다. 머리글 · 위험 곡선 · 사건 기록 · 구매자 메시지 ·
 * Respond now(선택지 카드 + 답장 칸). 이 파일은 POST를 보내지 않는다 (전송은 답장 칸 버튼 → 서버 액션 `./actions.ts`만).
 *
 * - 화면에 내지 않는 분쟁(연습용·시연 제외·표 밖)이면 PayPal을 읽지 않고 아무것도 그리지 않는다 (`null`).
 * - PayPal을 읽지 못했으면 "PayPal unavailable"을 보이고 답장 칸을 그리지 않는다.
 * - **Routine 분쟁**(엔진 `decideAutopilot`이 악용 의심으로 건너뛴 분쟁 = 목록의 Routine 묶음, Mike)은 머리글 +
 *   상태 문장만 (`RoutineDetail`). AI 초안·답장 칸·AI 요약을 만들지 않는다 (LLM 호출 0회).
 * - 보기용 값은 `buildCaseView`·`buildCaseDesk`가 엔진 결과와 예측 어댑터(`forecast-source.ts`) 값을 옮겨 만든다
 *   (화면은 계산하지 않는다). 어댑터가 `null`이면 그 칸만 숨는다.
 * - `SentProvider`: 답장 칸이 보내기에 성공하면 머리글 위험 배지가 답장 뒤 엔진 값으로 바뀐다.
 * - `DraftForecastProvider`: 답장 칸의 지금 예측(브라우저 어댑터)을 위험 곡선 카드가 함께 읽는다.
 */
import { recommend } from '@/engine/recommend';

import { reasonCopyKey } from '../_shared/availability';
import { t } from '../_shared/copy';
import { pickBoard, type LoadedDispute } from '../_shared/dispute-view';
import { decideFor, routineLine } from '../today/model';
import { buildCaseDesk, historyView, type CaseDesk } from './desk-model';
import { loadMoveForecasts, loadRiskCurve, replyTranslated, type ForecastAnchor } from './forecast-source';
import { daysBetween, historySpanDays, unansweredDays } from './history';
import { buildCaseView, type CaseView as CaseViewData } from './model';
import { loadReply } from './reply/load';
import { ReplyPanel } from './reply/reply-panel';
import { RoutineDetail } from './routine-detail';
import { CaseView } from './view/case-view';
import { DraftForecastProvider } from './view/draft-forecast';
import { loadCase } from './view/load';
import { SentProvider } from './view/sent-state';

/** 머리글만 쓰는 화면(Routine)의 묶음: 선택지·사건 기록·곡선 없음. */
function headerDesk(view: CaseViewData, loaded: LoadedDispute, now: string): CaseDesk {
  const openedAt = loaded.timeline?.openedAt ?? null;
  return buildCaseDesk({
    view,
    board: pickBoard(loaded),
    buyer: loaded.buyer,
    productName: loaded.product?.itemName ?? null,
    openDays: openedAt === null ? null : daysBetween(openedAt, now),
    recommendation: null,
    moveForecasts: null,
    history: null,
    curvePoints: null,
    band: view.risk?.band ?? null,
  });
}

export async function CaseDetail({ disputeId }: { disputeId: string }) {
  const now = new Date().toISOString();
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
  if (routine !== null) {
    const routineView = buildCaseView(light.input);
    return <RoutineDetail view={routineView} desk={headerDesk(routineView, light.loaded, now)} line={routine} />;
  }

  const loaded = await loadCase(disputeId);
  if (loaded.kind !== 'ok') return null;

  const caseView = buildCaseView(loaded.input);
  const reply = await loadReply(disputeId);

  // 예측 (어댑터 → 엔진). 곡선·선택지·답장 칸이 **같은 기준 상황**(같은 보정)을 쓴다. 쓸 수 없으면 null → 칸이 숨는다
  const delayDays = unansweredDays(loaded.events, now);
  const anchor: ForecastAnchor = {
    signals: loaded.loaded.signals,
    delayDays,
    anchorText: reply?.anchorText ?? null,
    translated: replyTranslated(reply?.base.buyerLocale),
  };
  const curvePoints = loadRiskCurve(loaded.events, board, anchor);
  const moveForecasts = loadMoveForecasts({ board, ...anchor });
  const openedAt = loaded.loaded.timeline?.openedAt ?? null;

  const desk = buildCaseDesk({
    view: caseView,
    board,
    buyer: loaded.loaded.buyer,
    productName: loaded.loaded.product?.itemName ?? null,
    openDays: openedAt === null ? null : daysBetween(openedAt, now),
    recommendation: recommend(board),
    moveForecasts,
    history: historyView(loaded.events, historySpanDays(loaded.events, now), loaded.historySummary),
    curvePoints,
    band: caseView.risk?.band ?? null,
  });

  return (
    <SentProvider>
      <DraftForecastProvider>
        <CaseView
          view={caseView}
          desk={desk}
          llmOk={loaded.llm.ok}
          reply={
            reply === null ? undefined : (
              <ReplyPanel
                disputeId={reply.disputeId}
                base={reply.base}
                replyId={reply.replyId}
                languageKey={reply.languageKey}
                buyerShort={reply.buyerShort}
                forecastBase={
                  loaded.loaded.signals === null
                    ? null
                    : { signals: loaded.loaded.signals, delayDays, translated: anchor.translated }
                }
                offerRate={reply.offerRate}
              />
            )
          }
        />
      </DraftForecastProvider>
    </SentProvider>
  );
}
