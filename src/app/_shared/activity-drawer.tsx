'use client';

/**
 * PayPal activity 버튼 + 오른쪽 서랍 (T060 껍데기). 기록은 T064가 채운다 — 지금은 빈 상태만 (건수 0).
 *
 * - 서랍이 열리면 닫기 버튼에 포커스가 가고, Tab이 서랍 밖으로 나가지 않는다 (포커스 가둠).
 * - Esc·닫기 버튼·뒤 배경 누름으로 닫힌다. 닫히면 포커스가 여는 버튼으로 돌아간다.
 * - 서버 전용 코드를 import하지 않는다. 글자는 `shell.*` 문구.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { t } from './copy';

/** 서랍에 보일 호출 기록 (T064가 채운다). */
export type ActivityRecord = { id: string };

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function ActivityDrawer({ records }: { records: readonly ActivityRecord[] }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = records.length;

  const close = useCallback(() => {
    setOpen(false);
    openerRef.current?.focus();
  }, []);

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
            {count === 0 ? <p className="drawer-empty muted">{t('shell.drawer.empty')}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
