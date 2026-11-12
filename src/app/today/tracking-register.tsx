'use client';

/**
 * [Add both to PayPal] 버튼 + 결과 줄 (T067). 누르면 서버 액션(`addTrackingAction`)만 부른다 — 이 파일은 PayPal을
 * 부르지 않고 주문 키를 보내지 않는다. 결과 글자는 서버가 문구 키로 만든 값을 그대로 보인다.
 * 서버 액션은 부모(`page.tsx`)가 넘긴다 (단위 테스트는 가짜 함수를 넣는다).
 */
import { useState, useTransition } from 'react';

import { useT } from '../_shared/locale-context';
import { useSavings } from './savings';
import type { TrackingOutcome, TrackingOutcomeKind } from './tracking-result';

/** "+$N just now"를 다는 결과: 모두 등록됨(added) 또는 가짜 등록(simulated). 일부 실패·실패·없음은 달지 않는다. */
export function countsAsDone(kind: TrackingOutcomeKind): boolean {
  return kind === 'added' || kind === 'simulated';
}

export function TrackingRegister({
  label,
  action,
  initial = null,
  savings = null,
  doneId = null,
}: {
  label: string;
  action: () => Promise<TrackingOutcome>;
  /** 테스트·견본용 처음 결과. */
  initial?: TrackingOutcome | null;
  /** T091 "+$N just now" 값 (엔진 `trackingSavings` 표기). 등록이 끝나면(가짜 포함) 이번 주 카드에 넘긴다. */
  savings?: string | null;
  /** T102: 등록이 끝나면(가짜 포함) 왼쪽 목록에서 "Done today"로 옮길 항목 id. 없으면 옮기지 않는다. */
  doneId?: string | null;
}) {
  const t = useT();
  const { report, markDone, unmarkDone } = useSavings();
  const [outcome, setOutcome] = useState<TrackingOutcome | null>(initial);
  const [pending, startTransition] = useTransition();
  /** T116 F1-45: 누르는 즉시 "Added ✓"·Done today (시안 동기 setState). 서버 결과가 실패면 되돌린다. */
  const [optimistic, setOptimistic] = useState(false);
  const finished = outcome !== null && countsAsDone(outcome.kind);
  const shownDone = finished || optimistic;

  const onClick = () => {
    if (pending || shownDone) return;
    setOptimistic(true);
    // 결과를 모르는 동안은 Simulated로 둔다 (실제로 넣었다고 먼저 말하지 않는다). 실제 등록이면 아래에서 고친다
    if (doneId !== null) markDone(doneId, { simulated: true });
    startTransition(async () => {
      let next: TrackingOutcome;
      try {
        next = await action();
      } catch {
        next = { kind: 'error', line: t('today.tracking.reason.failed'), rows: [] };
      }
      setOutcome(next);
      setOptimistic(false);
      if (countsAsDone(next.kind)) {
        report(savings);
        // T102: dry run(simulated)은 Simulated로 표시한다 (실제로 넣지 않은 것을 끝난 것처럼 말하지 않는다)
        if (doneId !== null) markDone(doneId, { simulated: next.kind === 'simulated' });
      } else if (doneId !== null) {
        // 실패·일부 실패·없음: Done today에서 되돌리고 결과 줄(실패 글)을 보인다 — 실패를 성공처럼 남기지 않는다
        unmarkDone(doneId);
      }
    });
  };

  return (
    <div className="tracking-register">
      {/* T106 (F1-59): 끝나면(가짜 포함) 꺼진 채 "Added ✓" — 다시 누를 수 없다. Simulated 결과 줄은 아래에 그대로 */}
      <button type="button" className="tracking-button" onClick={onClick} disabled={pending || shownDone}>
        {shownDone ? t('today.tracking.addedDone') : pending ? t('today.tracking.adding') : label}
      </button>
      {outcome === null ? null : (
        <div className={`tracking-result tracking-result-${outcome.kind}`} role="status">
          <p className="tracking-result-line">{outcome.line}</p>
          {outcome.rows.length === 0 ? null : (
            <ul className="tracking-result-rows">
              {outcome.rows.map((row) => (
                <li key={row.key} className={row.ok ? 'tracking-result-ok' : undefined}>
                  <span className="num">{row.key}</span> · {row.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
