/**
 * Routine 항목 상세 (T061 "Mike 상세" → T076 시안 v4 머리글). 머리글 + 한 줄 상태 문장 + 'Code decides'.
 * **답장 칸·보내기 없음.**
 *
 * 그리기만 한다. 상태 문장은 엔진 판정(`decideAutopilot`)과 규칙 이름에서 고른 문구다 (`today/model.ts`의
 * `routineLine`). 언제 이 화면을 쓰는지는 `case-detail.tsx`가 같은 판정으로 정한다 (목록의 Routine 묶음과 같은 규칙).
 */
import { Badge } from '../_shared/badges';
import { t } from '../_shared/copy';
import type { CaseDesk } from './desk-model';
import type { CaseView as CaseViewData } from './model';
import { CaseHeader } from './view/case-view';

import './view/case.css';

export function RoutineDetail({ view, desk, line }: { view: CaseViewData; desk: CaseDesk; line: string }) {
  return (
    <div className="case-page">
      <CaseHeader view={view} desk={desk} />
      <section className="case-summary case-routine" aria-label={t('case.routine.label')}>
        <p className="case-summary-text">{line}</p>
        <p className="case-summary-meta">
          <Badge kind="codeDecides" />
        </p>
      </section>
    </div>
  );
}
