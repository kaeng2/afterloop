/**
 * 디자인 견본 화면 `/preview/styleguide` (T047 보완 C). 메뉴에는 없다 — 디자인 확인용이다.
 *
 * 보여 주는 것: 배지 5종 · 위험 단계 3종 · 큰 숫자 비교 카드 · 기본 카드 · 글자 크기 단계 · 색.
 * 데이터를 읽지 않는다. 비교 카드의 두 값만 엔진(`recommend`)으로 계산한다 (`./sample.ts`).
 * 글자는 모두 문구 파일(`badge.*`·`common.*`)에서 읽는다.
 */
import type { Metadata } from 'next';

import { BADGES, BADGE_ORDER, RISK_ORDER } from '../../_shared/badge-keys';
import { AssumptionBadge, Badge, DemoBadge, RiskLevel } from '../../_shared/badges';
import { CompareCard } from '../../_shared/compare-card';
import { t } from '../../_shared/copy';
import { compareSample } from './sample';

export const metadata: Metadata = {
  title: t('common.preview.title'),
  robots: { index: false, follow: false },
};

const TYPE_STEPS = [
  { className: 'text-hero', key: 'common.preview.typeHero' },
  { className: 'text-lg', key: 'common.preview.typeLg' },
  { className: 'text-md', key: 'common.preview.typeMd' },
  { className: 'text-sm', key: 'common.preview.typeSm' },
  { className: 'text-xs', key: 'common.preview.typeXs' },
] as const;

const SWATCHES = [
  { className: 'swatch-accent', key: 'common.preview.colorAccent' },
  { className: 'swatch-risk-high', key: 'badge.riskHigh' },
  { className: 'swatch-risk-watch', key: 'badge.riskWatch' },
  { className: 'swatch-risk-low', key: 'badge.riskLow' },
  { className: 'swatch-success', key: 'common.preview.colorSuccess' },
  { className: 'swatch-danger', key: 'common.preview.colorDanger' },
] as const;

export default function StyleguidePage() {
  const sample = compareSample();
  const noValue = t('common.noValue');

  return (
    <div className="stack">
      <div className="stack">
        <h1 className="page-title">{t('common.preview.title')}</h1>
        <p className="muted small">{t('common.preview.intro')}</p>
      </div>

      <CompareCard
        label={t('common.preview.expectedLoss')}
        badges={
          <>
            <AssumptionBadge />
            <DemoBadge />
          </>
        }
        before={{ caption: t('common.preview.paypalOnly'), display: sample.before.display ?? noValue }}
        after={{ caption: t('common.preview.withCarrier'), display: sample.after.display ?? noValue }}
        arrowLabel={t('common.preview.arrow')}
        footer={t('common.preview.compareNote')}
      />

      <div className="grid">
        <section className="card stack">
          <h2 className="section-title">{t('common.preview.badges')}</h2>
          <dl className="def-list">
            {BADGE_ORDER.map((kind) => (
              <div key={kind} className="def-item">
                <dt>
                  <Badge kind={kind} />
                </dt>
                <dd className="small muted">{t(BADGES[kind].hintKey)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card stack">
          <h2 className="section-title">{t('common.preview.risk')}</h2>
          <div className="row">
            {RISK_ORDER.map((band) => (
              <RiskLevel key={band} band={band} />
            ))}
          </div>
          <p className="small muted">{t('common.preview.riskNote')}</p>
        </section>

        <section className="card stack">
          <h2 className="section-title">{t('common.preview.card')}</h2>
          <p className="small">{t('common.preview.cardNote')}</p>
        </section>
      </div>

      <section className="card stack">
        <h2 className="section-title">{t('common.preview.type')}</h2>
        {TYPE_STEPS.map((step) => (
          <div key={step.key} className={step.className}>
            {t(step.key)}
          </div>
        ))}
      </section>

      <section className="card stack">
        <h2 className="section-title">{t('common.preview.colors')}</h2>
        <div className="swatch-row">
          {SWATCHES.map((swatch) => (
            <div key={swatch.key} className="row small">
              <span className={`swatch ${swatch.className}`} aria-hidden="true" />
              {t(swatch.key)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
