/**
 * 분쟁 상세 (T061 "서연 상세 합치기" — Today 오른쪽 칸 한 프레임). 위에서 아래로:
 *
 *  1. 머리글 두 줄 — "Case … · 상품 금액 · 상태" / "구매자 이름 · writes in <언어>" + 오른쪽 작은 위험 배지(펼침)
 *  2. 비교 카드(주인공) — 전 칸 아래 "incl. $N of your time"(가정값 대응 시간 비용) + 한 줄 요약(옛 원인 칸 대체)
 *  3. 아래 두 칸 (넓은 폭): 왼쪽 대화(말풍선, 배송사 줄 포함) · 오른쪽 답장 칸(`reply`로 받는다)
 *
 * 1920×1080에서 비교 카드와 보내기 버튼이 스크롤 없이 함께 보이게, 따로 있던 원인 카드·배송사 카드는 없앴다.
 *
 * **계산하지 않는다.** 모든 숫자·판정은 `buildCaseView`(엔진 결과를 옮긴 값)에서 온다.
 * 글자는 모두 `case.*`·`badge.*`·`common.*` 문구에서 읽는다.
 */
import type { ReactNode } from 'react';

import { Badge } from '../../_shared/badges';
import { CompareCard } from '../../_shared/compare-card';
import { t } from '../../_shared/copy';
import type { CaseView as CaseViewData, CompareSideView, SummaryView } from '../model';
import { Conversation } from './conversation';
import { RiskToggle } from './risk-toggle';

import './case.css';

function sideCaption(side: CompareSideView): string {
  return t('case.view.sideCaption', { source: t(side.sourceKey), action: t(side.actionKey) });
}

/** 머리글 첫 줄: "Case PP-R-… · Wool Sweater, Navy $72.00 · Waiting for your reply". */
export function headLine(header: CaseViewData['header']): string {
  const status =
    header.statusCode === ''
      ? t('case.view.statusUnknown')
      : header.statusKey === null
        ? header.statusCode
        : t(header.statusKey);
  return t('case.view.headLine', {
    disputeId: header.disputeId,
    product: header.productName ?? t('case.view.productUnknown'),
    amount: header.amount.display,
    status,
  });
}

/** 머리글 (두 줄 + 위험 배지). Mike 상세도 같은 머리글을 쓴다. */
export function CaseHeader({ view }: { view: CaseViewData }) {
  const { header } = view;
  return (
    <header className="case-head">
      <div className="case-head-text">
        <p className="case-headline num" title={header.statusCode === '' ? undefined : header.statusCode}>
          {headLine(header)}
        </p>
        <h2 className="case-name">
          {header.buyerName ?? t('case.view.buyerUnknown')}
          {header.languageKey === null ? null : (
            <span className="case-writes"> · {t('case.view.writesIn', { language: t(header.languageKey) })}</span>
          )}
        </h2>
      </div>
      <RiskToggle risk={view.risk} riskAfterReply={view.riskAfterReply} />
    </header>
  );
}

/** 한 줄 요약 + 판정 배지. 세부 유형 코드는 보조 글자. */
function Summary({ summary, noCarrier }: { summary: SummaryView | null; noCarrier: boolean }) {
  return (
    <section className="case-summary" aria-label={t('case.view.summaryLabel')}>
      {summary === null ? (
        <p className="case-summary-text">{t('case.view.causeNone')}</p>
      ) : (
        <>
          <p className="case-summary-text">{t(summary.key)}</p>
          <p className="case-summary-meta">
            <Badge kind={summary.badge} />
            <span className="case-summary-codes num">
              {summary.codes.before === null
                ? summary.codes.after
                : t('case.view.causeCodes', { before: summary.codes.before, after: summary.codes.after })}
            </span>
            {summary.needsReview ? <span>{t('board.needsReview')}</span> : null}
          </p>
        </>
      )}
      {noCarrier ? <p className="case-summary-meta">{t('case.view.noCarrier')}</p> : null}
    </section>
  );
}

export function CaseView({ view, llmOk, reply }: { view: CaseViewData; llmOk: boolean; reply?: ReactNode }) {
  const { compare } = view;
  const noValue = t('common.noValue');
  const before = compare.before;

  return (
    <div className="case-page">
      <CaseHeader view={view} />

      {llmOk ? null : <p className="notice">{t('common.llmUnavailable')}</p>}

      {/* 주인공: 전 → 후 비교 + 한 줄 요약 */}
      <div className="case-hero">
        <CompareCard
          label={t(compare.labelKey)}
          badges={compare.badges.map((kind) => (
            <Badge key={kind} kind={kind} />
          ))}
          before={{
            caption: sideCaption(before),
            display: before.expectedLoss?.display ?? noValue,
            badge: before.badges.length === 0 ? undefined : before.badges.map((kind) => <Badge key={kind} kind={kind} />),
            note: before.timeCost === null ? undefined : t('case.view.timeCost', { amount: before.timeCost.display }),
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
        />
        <Summary summary={view.summary} noCarrier={compare.after === null} />
      </div>

      <div className={reply === undefined ? 'case-body case-body-single' : 'case-body'}>
        <Conversation messages={view.messages} carrierLine={view.carrierLine} locale={view.header.buyerLocale} />
        {reply === undefined ? null : <div className="case-body-reply">{reply}</div>}
      </div>
    </div>
  );
}
