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
}: {
  label: string;
  action: () => Promise<TrackingOutcome>;
  /** 테스트·견본용 처음 결과. */
  initial?: TrackingOutcome | null;
  /** T091 "+$N just now" 값 (엔진 `trackingSavings` 표기). 등록이 끝나면(가짜 포함) 이번 주 카드에 넘긴다. */
  savings?: string | null;
}) {
  const t = useT();
  const { report } = useSavings();
  const [outcome, setOutcome] = useState<TrackingOutcome | null>(initial);
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const next = await action();
      setOutcome(next);
      if (countsAsDone(next.kind)) report(savings);
    });
  };

  return (
    <div className="tracking-register">
      <button type="button" className="tracking-button" onClick={onClick} disabled={pending}>
        {pending ? t('today.tracking.adding') : label}
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
