/**
 * S5 Case 1부 보기 (T009 1부 + 2부에 함께 넣는 것 1~3번). 머리글 · 전 → 후 비교(주인공) · 원인 한 줄 ·
 * 대화 · 배송사 정보. 답장 칸은 `../[disputeId]/layout.tsx`가 이 화면 옆에 그린다.
 *
 * 배치 원칙 (리뷰 승인 2026-11-10): **가운데의 주인공은 "전 → 후" 한 줄 비교다.** 화면에서 가장 크게
 * 보인다. 원인 줄은 그보다 작다. 위험 점수는 머리글의 작은 배지이고, 배지를 누르면 신호별 점수가
 * 펼쳐진다 (아래쪽 "Escalation risk" 카드는 없앴다 — 같은 점수가 두 번 보이던 문제).
 *
 * **계산하지 않는다.** 모든 숫자·판정은 `buildCaseView`(엔진 결과를 옮긴 값)에서 온다.
 * 글자는 모두 `case.*`·`badge.*`·`common.*` 문구에서 읽는다.
 */
import type { BadgeKind } from '../../_shared/badge-keys';
import { Badge } from '../../_shared/badges';
import { CompareCard } from '../../_shared/compare-card';
import { t } from '../../_shared/copy';
import type { CaseView as CaseViewData, CauseView, CompareSideView } from '../model';
import { Conversation } from './conversation';
import { RiskToggle } from './risk-toggle';

import './case.css';

function sideCaption(side: CompareSideView): string {
  return t('case.view.sideCaption', { source: t(side.sourceKey), action: t(side.actionKey) });
}

/** 원인 칸의 한쪽: "PayPal data only: A1 Not shipped". 상세 문구(`causeNote`)는 배송사 카드에만 둔다. */
function CauseSide({ sourceKey, cause, demo }: { sourceKey: string; cause: CauseView | null; demo?: boolean }) {
  return (
    <span className="case-cause-side">
      <span className="label">{t('case.view.causeSide', { source: t(sourceKey) })}</span>
      {cause === null ? (
        <span className="small muted">{t('case.view.causeNone')}</span>
      ) : (
        <span className="case-cause-value">
          <span className="case-subtype num">{cause.subtype}</span>
          <span title={t(cause.subtypeKey)}>{t(cause.shortKey)}</span>
          {cause.needsReview ? <span className="small muted">{t('board.needsReview')}</span> : null}
        </span>
      )}
      {demo === true ? <Badge kind="demo" /> : null}
    </span>
  );
}

/** 원인 한 줄 카드. 화살표는 비교 카드와 같은 모양·같은 읽기용 글자. 판정 배지는 줄 끝에 한 번. */
function CauseCard({ view }: { view: CaseViewData }) {
  const { cause, compare } = view;
  const after = compare.after === null ? null : cause.after;
  const deciders: BadgeKind[] = [];
  for (const side of [cause.before, after]) {
    if (side !== null && !deciders.includes(side.badge)) deciders.push(side.badge);
  }

  return (
    <section className="card case-cause-card" aria-label={t('case.view.cause')}>
      <h2 className="label case-cause-title">{t('case.view.cause')}</h2>
      <div className={compare.after === null ? 'case-cause-line case-cause-single' : 'case-cause-line'}>
        <CauseSide sourceKey="case.view.paypalOnly" cause={cause.before} />
        {compare.after === null ? null : (
          <>
            <span className="case-cause-arrow" role="img" aria-label={t('case.view.arrow')}>
              →
            </span>
            <CauseSide sourceKey="case.view.withCarrier" cause={after} demo />
          </>
        )}
        <span className="case-cause-badges">
          {deciders.map((kind) => (
            <Badge key={kind} kind={kind} />
          ))}
        </span>
      </div>
      {compare.after === null ? <p className="small muted">{t('case.view.noCarrier')}</p> : null}
    </section>
  );
}

export function CaseView({ view, llmOk }: { view: CaseViewData; llmOk: boolean }) {
  const { header, compare, carrier, risk } = view;
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
          <RiskToggle risk={risk} riskAfterReply={view.riskAfterReply} />
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
            <dd className="case-status">
              {header.statusCode === '' ? (
                t('case.view.statusUnknown')
              ) : header.statusKey === null ? (
                <span className="num">{header.statusCode}</span>
              ) : (
                <>
                  <span>{t(header.statusKey)}</span>
                  <span className="case-status-code num">{header.statusCode}</span>
                </>
              )}
            </dd>
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
      </div>

      <CauseCard view={view} />

      <div className="case-stack">
        <Conversation messages={view.messages} />

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
      </div>
    </div>
  );
}
