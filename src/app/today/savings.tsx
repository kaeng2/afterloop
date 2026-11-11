'use client';

/**
 * "이번 주" 카드의 "+$N just now" (T091, SPEC v2.14 8-4장, 시안 `bump`·`toast`·`.flash`).
 *
 * - 액션(답장 전송·제안·추적 등록)이 **성공(가짜 전송 포함)**하면 그 자리가 엔진 값 N(`actionSavings`·
 *   `trackingSavings`, 서버가 계산해 표기까지 끝낸 글자)을 `report`로 넘긴다. 이 파일은 더하거나 계산하지 않는다 —
 *   마지막 액션의 N 하나만 보인다.
 * - 서버 데이터는 바꾸지 않는다 (화면 상태만. 새로고침하면 원래 값 — 시안과 같다).
 * - N이 없으면(0 또는 계산할 수 없음) 아무것도 하지 않는다 (시안 `if (save)`).
 * - 알림(toast)은 `config/motion.json` `desk.toast.durationMs` 뒤에 사라진다.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { useT } from '../_shared/locale-context';
import { toastDurationMs } from '../_shared/motion';

export type SavingsBump = { amount: string; n: number };

type SavingsState = { bump: SavingsBump | null; report: (amount: string | null) => void };

const SavingsContext = createContext<SavingsState>({ bump: null, report: () => undefined });

export function SavingsProvider({ children }: { children?: ReactNode }) {
  const t = useT();
  const [bump, setBump] = useState<SavingsBump | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const report = useCallback(
    (amount: string | null) => {
      if (amount === null || amount === '') return;
      setBump((now) => ({ amount, n: (now?.n ?? 0) + 1 }));
      const text = t('today.weekly.toast', { amount });
      setToast(text);
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), toastDurationMs());
    },
    [t],
  );

  const value = useMemo(() => ({ bump, report }), [bump, report]);
  return (
    <SavingsContext.Provider value={value}>
      {children}
      {toast === null ? null : (
        <div className="savings-toast" role="status">
          <span className="savings-toast-check" aria-hidden="true">
            ✓
          </span>
          <span>{toast}</span>
        </div>
      )}
    </SavingsContext.Provider>
  );
}

export function useSavings(): SavingsState {
  return useContext(SavingsContext);
}

/** 이번 주 카드의 칸 하나. 액션이 끝나면 깜빡이고(시안 `.flash`) "+$N just now"를 단다. */
export function WeeklyBumpCell({ className, children }: { className: string; children?: ReactNode }) {
  const t = useT();
  const { bump } = useSavings();
  return (
    <div
      // 깜빡임을 매번 다시 틀도록 n마다 key를 바꾼다
      key={bump?.n ?? 0}
      className={bump === null ? className : `${className} weekly-cell-flash`}
      data-bump={bump === null ? undefined : String(bump.n)}
    >
      {children}
      {bump === null ? null : (
        <span className="weekly-bump num" aria-live="polite">
          {t('today.weekly.bump', { amount: bump.amount })}
        </span>
      )}
    </div>
  );
}
