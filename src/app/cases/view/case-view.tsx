/**
 * 분쟁 상세 (T061 → T068 → T076 시안 v4). 한 열, 위에서 아래로:
 *
 *  1. 머리글 — 상품 아이콘 + "PP-R-… · Wool Sweater" + 범주 알약 / "$72 · 이름 · 나라 · reads Korean · Open N days"
 *     + 오른쪽 작은 위험 배지(펼침, 지금 것)
 *  2. 위험 곡선 카드 (어댑터 `RiskPoint[]`. 없으면 카드 없음)
 *  3. 사건 기록 카드 (실제 데이터의 `CaseEvent[]` + AI 요약 어댑터)
 *  4. 구매자 메시지 (말풍선 + 배송사 줄 + "AI read" 태그 — 있는 판정만)
 *  5. Respond now — 1 선택지 카드(엔진 `recommend` 수별 기대 손실, 최선 "Best", 막힌 수 흐리게) + "PayPal data only" 한 줄
 *     → 2 답장 칸(`reply`로 받는다)
 *
 * "제안이 먼저"인 분쟁(지호)은 시안의 짧은 카드: 머리글 + 제안 카드(`reply`가 짧은 모양으로 그린다)만.
 *
 * **계산하지 않는다.** 모든 숫자·판정은 `buildCaseView`·`CaseDesk`(엔진·어댑터 결과를 옮긴 값)에서 온다.
 * 글자는 모두 `case.*`·`badge.*`·`common.*` 문구에서 읽는다.
 */
import type { ReactNode } from 'react';

import { Badge } from '../../_shared/badges';
import { t } from '../../_shared/copy';
import { ProductTile } from '../../_shared/product-icon';
import { deskFromView, type CaseDesk, type ChoiceView } from '../desk-model';
import type { CaseView as CaseViewData, SummaryView } from '../model';
import { CaseHistoryCard } from './case-history';
import { Conversation } from './conversation';
import { RiskCurveCard } from './risk-curve';
import { RiskToggle } from './risk-toggle';

import './case.css';

export type { CaseDesk };

/** 머리글 첫 줄 (옛 꼴, 화면 읽기·시험용): "Case … · Wool Sweater $72 · Waiting for your reply". */
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

/** 머리글 (시안 v4). Mike 상세도 같은 머리글을 쓴다. */
export function CaseHeader({ view, desk: deskInput }: { view: CaseViewData; desk?: CaseDesk }) {
  const { header } = view;
  const desk = deskInput ?? deskFromView(view);
  const status =
    header.statusCode === '' ? null : header.statusKey === null ? header.statusCode : t(header.statusKey);
  return (
    <header className="case-head">
      <div className="case-head-main">
        <ProductTile kind={desk.icon} size="lg" />
        <div className="case-head-text">
          <div className="case-head-line">
            <h2 className="case-title num" title={header.statusCode === '' ? undefined : header.statusCode}>
              {desk.title}
            </h2>
            {desk.category === null ? null : (
              <span className={`desk-chip ${desk.categoryTone === 'high' ? 'desk-chip-bad' : ''}`}>{desk.category}</span>
            )}
          </div>
          <p className="case-meta num">
            {desk.meta.join(' · ')}
            {status === null ? null : <span className="case-status"> · {status}</span>}
          </p>
        </div>
      </div>
      <RiskToggle risk={view.risk} riskAfterReply={view.riskAfterReply} />
    </header>
  );
}

/**
 * 한 줄 요약 (T061 → T076: 선택지 카드 아래). 엔진 원인 전환(전 → 후 세부 유형)의 문구 + 판정 배지 + 보조 코드.
 * 배송사 기록이 없으면 "배송사 정보 없음" 한 줄.
 */
function Summary({ summary, noCarrier }: { summary: SummaryView | null; noCarrier: boolean }) {
  return (
    <div className="case-summary" role="group" aria-label={t('case.view.summaryLabel')}>
      <p className="case-summary-line">
        <span className="case-summary-text">{summary === null ? t('case.view.causeNone') : t(summary.key)}</span>
        {summary === null ? null : (
          <>
            <Badge kind={summary.badge} />
            <span className="case-summary-codes num">
              {summary.codes.before === null
                ? summary.codes.after
                : t('case.view.causeCodes', { before: summary.codes.before, after: summary.codes.after })}
            </span>
            {summary.needsReview ? <span className="case-summary-meta">{t('board.needsReview')}</span> : null}
          </>
        )}
      </p>
      {noCarrier ? <p className="case-summary-meta">{t('case.view.noCarrier')}</p> : null}
    </div>
  );
}

/** 1 Pick a way to resolve — 엔진 수별 카드. 고르기는 엔진의 최선 수 (화면이 고르지 않는다). */
export function ChoiceCards({
  choices,
  paypalOnly,
  summary,
}: {
  choices: ChoiceView[];
  paypalOnly: string | null;
  /** 카드 아래 한 줄 요약 (없으면 그리지 않는다). */
  summary?: ReactNode;
}) {
  if (choices.length === 0) return null;
  return (
    <div className="desk-step">
      <div className="desk-rail" aria-hidden="true">
        <span className="desk-step-num">1</span>
        <span className="desk-rail-line" />
      </div>
      <div className="desk-step-body">
        <div className="desk-step-head">
          <h3 className="desk-step-title">{t('case.choice.title')}</h3>
          <span className="desk-step-sub">{t('case.choice.sub', { count: choices.length })}</span>
          <Badge kind="codeDecides" />
          <Badge kind="assumption" />
        </div>
        <ul className="choice-list">
          {choices.map((choice) => (
            <li
              key={choice.move}
              className={['choice', choice.best ? 'choice-best' : '', choice.blocked ? 'choice-blocked' : '']
                .filter((name) => name !== '')
                .join(' ')}
              aria-current={choice.best ? 'true' : undefined}
            >
              <span className="choice-top">
                <span className={choice.best ? 'choice-radio choice-radio-on' : 'choice-radio'} aria-hidden="true" />
                <span className="choice-title">{t(choice.titleKey)}</span>
                {choice.best ? <span className="choice-best-tag">{t('case.choice.best')}</span> : null}
              </span>
              <span className="choice-how">{choice.blockedKey === null ? t(choice.howKey) : t(choice.blockedKey)}</span>
              {choice.expectedLoss === null ? null : (
                <span className="choice-numbers num">
                  {choice.chargeback === null ? null : (
                    <>
                      <strong className="choice-cb">{t('case.choice.chargeback', { percent: choice.chargeback })}</strong>
                      {' · '}
                    </>
                  )}
                  {t('case.choice.cost', { amount: choice.expectedLoss.display })}
                </span>
              )}
            </li>
          ))}
        </ul>
        {summary ?? null}
        {paypalOnly === null ? null : (
          <p className="choice-paypal-only small">
            <span className="num">{paypalOnly}</span>
            <Badge kind="demo" title={t('case.choice.paypalOnlyHint')} />
          </p>
        )}
      </div>
    </div>
  );
}

export function CaseView({
  view,
  desk: deskInput,
  llmOk,
  reply,
}: {
  view: CaseViewData;
  /** 시안 v4 칸의 값. 없으면 `deskFromView` (머리글만). */
  desk?: CaseDesk;
  llmOk: boolean;
  reply?: ReactNode;
}) {
  const desk = deskInput ?? deskFromView(view);
  const offerFirst = view.messageSend.blocked;
  const summaryNode = <Summary summary={view.summary} noCarrier={view.compare.after === null} />;

  return (
    <div className="case-page">
      <CaseHeader view={view} desk={desk} />

      {llmOk ? null : <p className="notice">{t('common.llmUnavailable')}</p>}

      {offerFirst ? (
        // 지호: 시안의 짧은 카드 (제안 카드는 답장 칸이 그린다)
        reply === undefined ? null : <div className="case-offer">{reply}</div>
      ) : (
        <>
          <RiskCurveCard points={desk.curvePoints} />
          {desk.history === null ? null : <CaseHistoryCard history={desk.history} />}

          <div className="case-body">
            <Conversation
              messages={view.messages}
              carrierLine={view.carrierLine}
              locale={view.header.buyerLocale}
              signals={view.signals}
              languageKey={view.header.languageKey}
            />
          </div>

          <section className="work" aria-labelledby="work-title">
            <div className="work-head">
              <span className="work-ai" aria-hidden="true">
                {t('case.work.ai')}
              </span>
              <h2 className="desk-card-title" id="work-title">
                {t('case.work.title')}
              </h2>
              <span className="desk-card-sub">{t('case.work.sub')}</span>
            </div>
            <ChoiceCards choices={desk.choices} paypalOnly={desk.paypalOnly} summary={summaryNode} />
            {/* 선택지 카드가 없으면(엔진 추천 없이 그릴 때) 요약 한 줄만 */}
            {desk.choices.length === 0 ? summaryNode : null}
            {reply === undefined ? null : <div className="case-body-reply">{reply}</div>}
          </section>
        </>
      )}
    </div>
  );
}
