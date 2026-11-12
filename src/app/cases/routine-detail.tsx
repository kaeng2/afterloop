/**
 * Routine 항목 상세 (T061 "Mike 상세" → T076 시안 v4 머리글 → T106 zone-work 틀). 머리글 + 한 줄 상태 문장.
 * T090: 'Code decides' 배지는 그리지 않는다 (출처 표시 3종 규칙. 판정은 코드에서 그대로 한다).
 * T106: Today에서 목록 줄(`row`)을 받으면 다른 항목과 같은 틀(머리 + `.zone-work` 카드). 상태 문장은 코드 판정이라
 * AI 알약을 달지 않는다. 줄이 없으면(사례 주소 화면) 예전 머리글 그대로.
 * **답장 칸·보내기 없음.**
 *
 * 그리기만 한다. 상태 문장은 엔진 판정(`decideAutopilot`)과 규칙 이름에서 고른 문구다 (`today/model.ts`의
 * `routineLine`). 언제 이 화면을 쓰는지는 `case-detail.tsx`가 같은 판정으로 정한다 (목록의 Routine 묶음과 같은 규칙).
 */
import { Badge } from '../_shared/badges';
import { t } from '../_shared/copy';
import type { TodayRowView } from '../today/model';
import { WorkCard, WorkDetail } from '../today/work-card';
import type { CaseDesk } from './desk-model';
import type { CaseView as CaseViewData } from './model';
import { CaseHeader } from './view/case-view';

import './view/case.css';

export function RoutineDetail({
  view,
  desk,
  line,
  row = null,
}: {
  view: CaseViewData;
  desk: CaseDesk;
  line: string;
  row?: TodayRowView | null;
}) {
  // T118 ②: 반복 미수령 주장(이전 분쟁 수·배송 기록)은 시드 데이터다 (정직성 표) → 다른 곳과 같은 Demo data 배지
  const claim = (
    <>
      {line} <Badge kind="demo" />
    </>
  );
  if (row !== null) {
    return (
      <WorkDetail row={row} className="routine-detail">
        <WorkCard titleId={`routine-title-${view.header.disputeId}`} ai={false} title={t('case.routine.label')} body={claim} />
      </WorkDetail>
    );
  }
  return (
    <div className="case-page">
      <CaseHeader view={view} desk={desk} />
      <section className="case-summary case-routine" aria-label={t('case.routine.label')}>
        <p className="case-summary-text">{claim}</p>
      </section>
    </div>
  );
}
