'use client';

/**
 * "Dispute risk across this case" 카드 (T076, 시안 v4). 사건마다 점 하나(엔진 `RiskPoint`, 어댑터) + 답장 예측이
 * 있으면 맨 끝 "Your draft" 점선 + 오른쪽 큰 % + "with your draft" + Assumption 배지.
 *
 * **점이 없으면(어댑터 `null`) 카드 자체를 그리지 않는다.** 숫자·좌표는 `curveView`가 만든 값을 그대로 그린다.
 * 색은 css 클래스(변수)만.
 */
import type { RiskPoint } from '@/types';

import { Badge } from '../../_shared/badges';
import { t } from '../../_shared/copy';
import { CURVE_BOX, curveView, type CurveView } from '../desk-model';
import { useDraftForecast } from './draft-forecast';

export function RiskCurveGraphic({ curve }: { curve: CurveView }) {
  return (
    <svg
      className="curve-svg"
      viewBox={`0 0 ${CURVE_BOX.width} ${CURVE_BOX.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <line className="curve-grid" x1="0" x2={CURVE_BOX.width} y1={CURVE_BOX.top} y2={CURVE_BOX.top} />
      <line className="curve-base" x1="0" x2={CURVE_BOX.width} y1={CURVE_BOX.bottom} y2={CURVE_BOX.bottom} />
      <polygon className="curve-area" points={curve.area} />
      <polyline className="curve-line" points={curve.line} />
      {curve.draft === null ? null : (
        <polyline
          className="curve-draft"
          points={`${curve.draft.from.x},${curve.draft.from.y} ${curve.draft.x},${curve.draft.y}`}
        />
      )}
      {curve.dots.map((dot, index) => (
        <circle key={index} className={`curve-dot curve-dot-${dot.kind}`} cx={dot.x} cy={dot.y} r="5" />
      ))}
      {curve.draft === null ? null : <circle className="curve-dot-draft" cx={curve.draft.x} cy={curve.draft.y} r="6" />}
    </svg>
  );
}

export function RiskCurveCard({ points }: { points: RiskPoint[] | null }) {
  const { forecast } = useDraftForecast();
  const curve = curveView(points, forecast?.pChargeback ?? null);
  if (curve === null) return null;
  return (
    <section className="curve-card" aria-labelledby="curve-title">
      <div className="curve-main">
        <h2 className="desk-card-title" id="curve-title">
          {t('case.curve.title')}
        </h2>
        <RiskCurveGraphic curve={curve} />
        <p className="case-sr-only">{t('case.curve.points', { count: curve.dots.length })}</p>
      </div>
      <div className="curve-side">
        <span className="curve-side-label">{t('case.curve.risk')}</span>
        <span className="curve-headline num">{curve.headline}</span>
        <span className="curve-side-sub">{t(curve.headlineKey)}</span>
        {curve.fromTo === null ? null : <span className="curve-fromto num">{curve.fromTo}</span>}
        <Badge kind="assumption" />
      </div>
    </section>
  );
}
