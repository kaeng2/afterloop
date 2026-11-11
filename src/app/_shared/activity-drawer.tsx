'use client';

/**
 * PayPal activity 버튼 + 오른쪽 서랍 (T060 껍데기 → T064 기록).
 *
 * - 기록은 서버 메모리에 있다 (기록기 `activity.ts`). 이 컴포넌트는 서버 액션(`loadActivityView`)으로 읽는다:
 *   처음 그릴 때, 화면을 옮길 때, 창으로 돌아올 때, 서랍을 열 때(보낸 직후 새 줄이 바로 보이게), 열려 있는 동안 몇 초마다.
 * - 버튼 건수 = 보이는 기록 수 (`ActivityView.count`).
 * - 서랍이 열리면 닫기 버튼에 포커스가 가고, Tab이 서랍 밖으로 나가지 않는다 (포커스 가둠).
 * - Esc·닫기 버튼·뒤 배경 누름으로 닫힌다. 닫히면 포커스가 여는 버튼으로 돌아간다.
 * - 서버 전용 코드를 직접 import하지 않는다 (서버 액션만). 글자는 `shell.*`·`activity.*` 문구.
 */
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { loadActivityView } from './activity-actions';
import type { ActivityRow } from './activity-view';
import { t } from './copy';

export type { ActivityRow };

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** 열려 있는 동안 다시 읽는 간격 (ms). 화면 동작 값이라 코드에 둔다 (가정값·정책 값 아님). */
const OPEN_REFRESH_MS = 3000;

const countOf = (rows: readonly ActivityRow[]) => rows.reduce((sum, row) => sum + row.calls, 0);

function ActivityLine({ row }: { row: ActivityRow }) {
  return (
    <li className="activity-row">
      <div className="activity-row-head">
        <span className="activity-title">{row.title}</span>
        <span className={`activity-status activity-status-${row.tone} num`}>{row.badge}</span>
      </div>
      <code className="activity-request">{row.request}</code>
      <div className="activity-meta small muted">
        <span className="num">{row.time}</span>
        {row.summary !== null ? <span>{row.summary}</span> : null}
        {row.calls > 1 ? <span className="num">{t('activity.calls', { count: row.calls })}</span> : null}
        {row.cached ? (
          <span className="activity-flag" title={t('activity.cachedHint')}>
            {t('activity.cached')}
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function ActivityDrawer({ records = [] }: { records?: readonly ActivityRow[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<readonly ActivityRow[]>(records);
  const pathname = usePathname();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = countOf(rows);

  const refresh = useCallback(() => {
    loadActivityView()
      .then((view) => setRows(view.rows))
      .catch(() => {
        // 읽지 못하면 지금 보이는 줄을 그대로 둔다
      });
  }, []);

  // 처음 그릴 때 + 화면을 옮길 때 + 창으로 돌아올 때
  useEffect(() => {
    refresh();
  }, [refresh, pathname]);
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // 열 때 바로 + 열려 있는 동안 몇 초마다
  useEffect(() => {
    if (!open) return;
    refresh();
    const timer = window.setInterval(refresh, OPEN_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || panelRef.current === null) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className="shell-pill shell-activity"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>{t('shell.activity')}</span>
        <span className="shell-count num" aria-label={t('shell.activityCount', { count })}>
          {count}
        </span>
      </button>

      {open ? (
        <div className="drawer-layer">
          <div className="drawer-backdrop" aria-hidden="true" onClick={close} />
          <div ref={panelRef} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="drawer-head">
              <div className="stack drawer-titles">
                <h2 className="drawer-title" id={titleId}>
                  {t('shell.drawer.title')}
                </h2>
                <p className="small muted">{t('shell.drawer.note')}</p>
              </div>
              <button ref={closeRef} type="button" className="shell-pill drawer-close" onClick={close}>
                {t('shell.drawer.close')}
              </button>
            </div>
            {count === 0 ? (
              <p className="drawer-empty muted">{t('shell.drawer.empty')}</p>
            ) : (
              <ol className="activity-list" aria-label={t('activity.listLabel')}>
                {rows.map((row) => (
                  <ActivityLine key={row.id} row={row} />
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
