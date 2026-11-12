'use client';

/**
 * "Case history · N events · D days" 카드 (T076, 시안 v4). 점 줄 + [Show history] 펼침 목록 + AI 요약 한 줄.
 *
 * 사건은 **실제 데이터에서만** 만든 `CaseEvent[]`를 옮긴 `HistoryView`다 (`../history.ts`). 시드 사건 줄에는
 * Demo data. 요약은 어댑터(`history-summary-source.ts`) 값이 있을 때만 'AI suggests'와 함께 보인다.
 */
import { useId, useState } from 'react';

import { AiPill, Badge } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import type { HistoryView } from '../desk-model';

export function CaseHistoryCard({ history }: { history: HistoryView }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const sub =
    history.spanDays === null
      ? t(history.count === 1 ? 'case.history.subOneNoDays' : 'case.history.subNoDays', { count: history.count })
      : t(history.count === 1 ? 'case.history.subOne' : 'case.history.sub', { count: history.count, days: history.spanDays });

  return (
    <section className="history-card" aria-labelledby="history-title">
      <div className="history-head">
        <h2 className="desk-card-title" id="history-title">
          {/* T125a: 시안 `<b>Case history</b>` — 글자 주인을 b로 (제목 역할은 h2 그대로) */}
          <b>{t('case.history.title')}</b>
        </h2>
        <span className="history-sub num">{sub}</span>
        <span className="history-dots" aria-hidden="true">
          {history.rows.map((row, index) => (
            <span key={index} className="history-dot-wrap">
              {index === 0 ? null : <span className="history-dot-line" />}
              <span className={`history-dot history-dot-${row.tone}`} title={`${row.date} · ${row.text}`} />
            </span>
          ))}
        </span>
        <button
          type="button"
          className="desk-button-outline hbtn"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
        >
          {t(open ? 'case.history.hide' : 'case.history.show')}
          <span className={open ? 'desk-caret desk-caret-open' : 'desk-caret'} aria-hidden="true">
            ▾
          </span>
        </button>
      </div>

      <ol id={listId} className="history-list" hidden={!open}>
        {history.rows.map((row, index) => (
          <li key={index} className="history-row">
            <span className="history-date num">{row.date}</span>
            <span className={`history-dot history-dot-${row.tone}`} aria-hidden="true" />
            {/* T125a: 시안 L294 `<div style="display:flex…"><span>{{h.t}}</span>…</div>` — 글 칸은 div */}
            <div className="history-text">
              <span>{row.text}</span>
              {/* T090 시안: 빨간 "Before DisputeLess · <표시>" 알약 (표시는 실제 기록의 판정만) */}
              {row.flagKeys.map((key) => (
                <span key={key} className="desk-chip desk-chip-bad">
                  {t('case.history.beforeTag', { flag: t(key) })}
                </span>
              ))}
              {/* T122e: 시드 기록의 판매자 실수 줄 표시 글 (이미 언어를 고른 값) */}
              {(row.flags ?? []).map((flag) => (
                <span key={flag} className="desk-chip desk-chip-bad">
                  {t('case.history.beforeTag', { flag })}
                </span>
              ))}
              {row.demo ? <Badge kind="demo" /> : null}
            </div>
          </li>
        ))}
      </ol>

      {history.summary === null ? null : (
        <p className="history-summary">
          <AiPill />
          <span>
            <strong>{t('case.history.summaryLabel')}</strong> {history.summary}
          </span>
        </p>
      )}
    </section>
  );
}
