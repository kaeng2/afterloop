'use client';

/**
 * 머리글의 확대 위험 배지 (T009 2부에 함께 넣는 것 1번, 사람 결정 2026-11-10).
 *
 * "▲ High · Score 6" 배지 자체가 펼침 버튼이다 (키보드로도 — `<button>` + `aria-expanded`). 펼치면 신호별
 * 점수와 답장 뒤 점수가 같은 자리에 보인다. 값은 모두 `escalationRisk(...)`를 옮긴 보기용 값이다
 * (화면이 점수를 계산하지 않는다). 신호가 없으면 빈칸 문구만 보인다.
 *
 * 서버 전용 코드를 import하지 않는다.
 */
import { useId, useState } from 'react';

import { RISK_LEVEL } from '../../_shared/badge-keys';
import { Badge, RiskLevel } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import type { RiskView } from '../model';
import { useSent } from './sent-state';

export function RiskToggle({ risk, riskAfterReply }: { risk: RiskView | null; riskAfterReply: RiskView | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // 이 화면에서 보낸 뒤에는 배지가 엔진의 답장 뒤 값으로 바뀐다 ("Score 6 → 3")
  const { sent } = useSent();

  if (risk === null) return <span className="small muted">{t('case.view.riskNone')}</span>;
  const shown = sent && riskAfterReply !== null ? riskAfterReply : risk;

  return (
    <div className="case-risk-wrap">
      <button
        type="button"
        className="case-risk-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('case.view.riskToggle', { score: shown.score, band: t(RISK_LEVEL[shown.band].copyKey) })}
        onClick={() => setOpen((value) => !value)}
      >
        <RiskLevel band={shown.band} />
        <span className="small num">
          {shown === risk
            ? t('case.view.riskScore', { score: risk.score })
            : t('case.view.riskScoreAfter', { before: risk.score, after: shown.score })}
        </span>
        <span className="case-risk-caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>
      <div id={panelId} className="card case-risk-panel" hidden={!open}>
        <p className="label">{t('case.view.riskDetails')}</p>
        <ul className="case-parts">
          {risk.parts.map((part) => (
            <li key={part.signal} className="row small">
              <span className="num case-points">{t('case.view.points', { points: part.points })}</span>
              <span className={part.points === 0 ? 'muted' : undefined}>{t(part.labelKey)}</span>
              {part.demo ? <Badge kind="demo" /> : null}
            </li>
          ))}
        </ul>
        {riskAfterReply === null ? null : (
          <p className="row small case-risk-after">
            <span className="label">{t('case.view.riskAfterReply')}</span>
            <RiskLevel band={riskAfterReply.band} />
            <span className="num">{t('case.view.riskScore', { score: riskAfterReply.score })}</span>
          </p>
        )}
      </div>
    </div>
  );
}
