'use client';

/**
 * "Dispute risk across this case" 카드 (T076, 시안 v4). 사건마다 점 하나(엔진 `RiskPoint`, 어댑터) + 답장 예측이
 * 있으면 맨 끝 "Your draft" 점선 + 오른쪽 큰 % + "with your draft" + Assumption 배지.
 *
 * **점이 없으면(어댑터 `null`) 카드 자체를 그리지 않는다.** 숫자·좌표는 `curveView`가 만든 값을 그대로 그린다.
 * 색은 css 클래스(변수)만.
 */
import type { CSSProperties } from 'react';

import type { RiskPoint } from '@/types';

import { Badge } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import { pingStartRadius } from '../../_shared/motion';
import { CURVE_BOX, curveView, type CurveView } from '../desk-model';
import { useDraftForecast } from './draft-forecast';

/** 50% 눈금의 높이 (그림 자리 값: 위 100% ~ 아래 0%의 가운데). */
const MID_Y = (CURVE_BOX.top + CURVE_BOX.bottom) / 2;
/** 눈금 글자 자리 (상자 높이에 대한 몫 → css `--tick-at` — 글자가 늘어나지 않게 SVG 밖 html로 둔다). */
const tickAt = (y: number): CSSProperties => ({ '--tick-at': y / CURVE_BOX.height }) as CSSProperties;

/**
 * 곡선 그림 (T090 시안 v4): 100%·50% 눈금 글자, 끝점 둘레 연한 물결 원(`curve-ping`, 1.4s 반복 — 움직임 줄이기면 멈춤),
 * 점선·끝점은 값이 바뀌면 부드럽게 옮긴다 (`--motion-curve`). 좌표는 `curveView` 값 그대로.
 */
export function RiskCurveGraphic({ curve }: { curve: CurveView }) {
  const t = useT();
  const end = curve.steps[curve.steps.length - 1] ?? curve.draft ?? curve.dots[curve.dots.length - 1];
  // 시안 curve.live: 마지막 사건 점 → 보낸 답장(또는 Your draft) 점 → Send 뒤 단계 점들 (보낸 뒤 실선)
  const live =
    curve.draft === null
      ? null
      : [curve.draft.from, curve.draft, ...curve.steps].map((point) => `${point.x},${point.y}`).join(' ');
  return (
    <div className="curve-plot">
      <svg
        className="curve-svg"
        viewBox={`0 0 ${CURVE_BOX.width} ${CURVE_BOX.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <line className="curve-grid" x1="0" x2={CURVE_BOX.width} y1={CURVE_BOX.top} y2={CURVE_BOX.top} />
        <line className="curve-grid" x1="0" x2={CURVE_BOX.width} y1={MID_Y} y2={MID_Y} />
        <line className="curve-base" x1="0" x2={CURVE_BOX.width} y1={CURVE_BOX.bottom} y2={CURVE_BOX.bottom} />
        <polygon className="curve-area" points={curve.area} />
        <polyline className="curve-line" points={curve.line} />
        {live === null ? null : (
          <polyline className={curve.sent ? 'curve-draft curve-draft-sent' : 'curve-draft'} points={live} />
        )}
        {curve.dots.map((dot, index) => (
          <circle key={index} className={`curve-dot curve-dot-${dot.kind}`} cx={dot.x} cy={dot.y} r="4.5" />
        ))}
        {curve.draft === null ? null : <circle className="curve-dot-draft" cx={curve.draft.x} cy={curve.draft.y} r="5" />}
        {curve.steps.map((point, index) => (
          <circle key={`step-${index}`} className="curve-dot-draft curve-dot-step" cx={point.x} cy={point.y} r="5" />
        ))}
        {end === undefined ? null : (
          <circle className="curve-ping" cx={end.x} cy={end.y} r={pingStartRadius()} data-testid="curve-ping" />
        )}
      </svg>
      <span className="curve-tick" style={tickAt(CURVE_BOX.top)} aria-hidden="true">
        {t('case.curve.tick100')}
      </span>
      <span className="curve-tick" style={tickAt(MID_Y)} aria-hidden="true">
        {t('case.curve.tick50')}
      </span>
    </div>
  );
}

export function RiskCurveCard({ points }: { points: RiskPoint[] | null }) {
  const t = useT();
  const { forecast, trail } = useDraftForecast();
  const curve = curveView(points, forecast?.pChargeback ?? null, trail);
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
        {/* 시안 `risk.st`: 값별 색(riskCol) + transition color .3s (--motion-color) */}
        <span data-tone={curve.headlineTone} className="curve-headline num">
          {curve.headline}
        </span>
        <span className="curve-side-sub">{t(curve.headlineKey)}</span>
        {curve.fromTo === null ? null : <span className="curve-fromto num">{curve.fromTo}</span>}
        <Badge kind="assumption" />
      </div>
    </section>
  );
}
