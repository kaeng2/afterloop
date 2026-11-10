/**
 * S5 Case 1부 보기 (T009 1부). 머리글 · 전 → 후 비교(주인공) · 원인 · 대화 · 배송사 정보 · 위험 배지.
 *
 * 배치 원칙 (리뷰 승인 2026-11-10): **가운데의 주인공은 "전 → 후" 한 줄 비교다.** 화면에서 가장 크게
 * 보인다. 원인·근거 줄은 그보다 작다. 위험 점수는 작은 배지이고 신호별 점수는 펼쳐야 보인다.
 *
 * **계산하지 않는다.** 모든 숫자·판정은 `buildCaseView`(엔진 결과를 옮긴 값)에서 온다.
 * 글자는 모두 `case.*`·`badge.*`·`common.*` 문구에서 읽는다.
 */
import { Badge, RiskLevel } from '../../_shared/badges';
import { CompareCard } from '../../_shared/compare-card';
import { t } from '../../_shared/copy';
import type { CaseView as CaseViewData, CauseView, CompareSideView, RiskView } from '../model';
import { Conversation } from './conversation';

import './case.css';

function sideCaption(side: CompareSideView): string {
  return t('case.view.sideCaption', { source: t(side.sourceKey), action: t(side.actionKey) });
}

function CauseLine({ sourceKey, cause, demo }: { sourceKey: string; cause: CauseView | null; demo?: boolean }) {
  return (
    <div className="case-cause">
      <span className="row">
        <span className="label">{t(sourceKey)}</span>
        {demo === true ? <Badge kind="demo" /> : null}
      </span>
      {cause === null ? (
        <span className="small muted">{t('case.view.causeNone')}</span>
      ) : (
        <span className="row small">
          <span className="case-subtype num">{cause.subtype}</span>
          <span>{t(cause.subtypeKey)}</span>
          {cause.note === null ? null : <span className="muted case-note">{cause.note}</span>}
          <Badge kind={cause.badge} />
          {cause.needsReview ? <span className="muted">{t('board.needsReview')}</span> : null}
        </span>
      )}
    </div>
  );
}

/** 작은 위험 배지 (점수 · 구간). 신호가 없으면 빈칸 문구. */
export function RiskSummary({ risk }: { risk: RiskView | null }) {
  if (risk === null) return <span className="small muted">{t('case.view.riskNone')}</span>;
  return (
    <span className="row case-risk">
      <span className="label">{t('case.view.risk')}</span>
      <RiskLevel band={risk.band} />
      <span className="small num">{t('case.view.riskScore', { score: risk.score })}</span>
    </span>
  );
}

function RiskDetails({ risk }: { risk: RiskView }) {
  return (
    <details className="case-details">
      <summary className="small">{t('case.view.riskDetails')}</summary>
      <ul className="case-parts">
        {risk.parts.map((part) => (
          <li key={part.signal} className="row small">
            <span className="num case-points">{t('case.view.points', { points: part.points })}</span>
            <span className={part.points === 0 ? 'muted' : undefined}>{t(part.labelKey)}</span>
            {part.demo ? <Badge kind="demo" /> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function CaseView({ view, llmOk }: { view: CaseViewData; llmOk: boolean }) {
  const { header, compare, cause, carrier, risk } = view;
  const noValue = t('common.noValue');

  return (
    <div className="stack case-page">
      {/* 머리글 */}
      <header className="stack case-head">
        <div className="case-title-row">
          <div className="case-title">
            <h1 className="page-title">{header.buyerName ?? t('case.view.buyerUnknown')}</h1>
            <span className="muted">{header.productName ?? t('case.view.productUnknown')}</span>
          </div>
          <RiskSummary risk={risk} />
        </div>
        <dl className="case-meta small">
          <div>
            <dt className="muted">{t('case.view.amount')}</dt>
            <dd className="num">{header.amount.display}</dd>
          </div>
          <div>
            <dt className="muted">{t('case.view.language')}</dt>
            <dd>{header.languageKey === null ? noValue : t(header.languageKey)}</dd>
          </div>
          <div>
            <dt className="muted">{t('case.view.disputeId')}</dt>
            <dd className="num">{header.disputeId}</dd>
          </div>
          <div>
            <dt className="muted">{t('case.view.status')}</dt>
            <dd className="num">{header.statusCode === '' ? t('case.view.statusUnknown') : header.statusCode}</dd>
          </div>
        </dl>
      </header>

      {llmOk ? null : <p className="notice">{t('common.llmUnavailable')}</p>}

      {/* 주인공: 전 → 후 비교 */}
      <div className="case-hero">
        <CompareCard
          label={t(compare.labelKey)}
          badges={compare.badges.map((kind) => (
            <Badge key={kind} kind={kind} />
          ))}
          before={{
            caption: sideCaption(compare.before),
            display: compare.before.expectedLoss?.display ?? noValue,
            badge:
              compare.before.badges.length === 0
                ? undefined
                : compare.before.badges.map((kind) => <Badge key={kind} kind={kind} />),
          }}
          after={
            compare.after === null
              ? null
              : {
                  caption: sideCaption(compare.after),
                  display: compare.after.expectedLoss?.display ?? noValue,
                  badge: compare.after.badges.map((kind) => <Badge key={kind} kind={kind} />),
                }
          }
          arrowLabel={t('case.view.arrow')}
          previousLabel={t('case.view.previous')}
          footer={t('case.view.compareNote')}
        />

        <section className="stack case-cause-list" aria-label={t('case.view.cause')}>
          <h2 className="label">{t('case.view.cause')}</h2>
          <CauseLine sourceKey="case.view.paypalOnly" cause={cause.before} />
          {compare.after === null ? null : <CauseLine sourceKey="case.view.withCarrier" cause={cause.after} demo />}
          {compare.after === null ? <p className="small muted">{t('case.view.noCarrier')}</p> : null}
          {view.messageSend.reasonKey === null ? null : (
            <p className="notice">{t(view.messageSend.reasonKey)}</p>
          )}
        </section>
      </div>

      <div className="case-columns">
        <Conversation messages={view.messages} />

        <div className="stack">
          {carrier === null ? null : (
            <section className="card stack" aria-labelledby="case-carrier">
              <div className="case-card-head">
                <h2 className="section-title" id="case-carrier">
                  {t('case.view.carrier')}
                </h2>
                {carrier.badges.map((kind) => (
                  <Badge key={kind} kind={kind} />
                ))}
              </div>
              <ol className="case-events small">
                {carrier.events.map((event, index) => (
                  <li key={index} className="case-event">
                    <span className="muted num">{event.date}</span>
                    <span className="case-event-status">{t(event.statusKey)}</span>
                    <span className="muted">{event.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card stack" aria-labelledby="case-risk">
            <h2 className="section-title" id="case-risk">
              {t('case.view.risk')}
            </h2>
            <RiskSummary risk={risk} />
            {risk === null ? null : <RiskDetails risk={risk} />}
          </section>
        </div>
      </div>
    </div>
  );
}
