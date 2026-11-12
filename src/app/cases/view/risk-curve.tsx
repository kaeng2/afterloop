'use client';

/**
 * "Dispute risk across this case" 카드 (T076, 시안 v4). 사건마다 점 하나(엔진 `RiskPoint`, 어댑터) + 답장 예측이
 * 있으면 맨 끝 "Your draft" 점선 + 오른쪽 큰 % + "with your draft" + Assumption 배지.
 *
 * **점이 없으면(어댑터 `null`) 카드 자체를 그리지 않는다.** 숫자·좌표는 `curveView`가 만든 값을 그대로 그린다.
 * 색은 css 클래스(변수)만.
 */
import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';

import type { RiskPoint } from '@/types';

import { Badge } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import { pingStartRadius } from '../../_shared/motion';
import { CURVE_BOX, curveView, nextCurveWidth, type CurveView, type HistoryTone } from '../desk-model';
import { useDraftForecast } from './draft-forecast';

/** 50% 눈금의 높이 (그림 자리 값: 위 100% ~ 아래 0%의 가운데). */
const MID_Y = (CURVE_BOX.top + CURVE_BOX.bottom) / 2;
/** 눈금 글자 자리 (상자 높이에 대한 몫 → css `--tick-at` — 글자가 늘어나지 않게 SVG 밖 html로 둔다). */
const tickAt = (y: number): CSSProperties => ({ '--tick-at': y / CURVE_BOX.height }) as CSSProperties;

/** 서버에서는 useEffect(경고 없음), 브라우저에서는 그리기 전에 도는 useLayoutEffect (깜빡임 없이 폭 반영). */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * T112: 그림 칸(`.curve-plot`)의 실제 px 폭. 서버 렌더·재기 전에는 시안 기준 640.
 * 폭이 바뀔 때만 상태를 바꾼다 (`nextCurveWidth`가 같은 값을 돌려주면 React가 다시 그리지 않는다 — T103 렌더 루프 교훈).
 * 칸 요소는 콜백 ref로 받아서, 카드가 나중에 나타나도 그때 재기 시작한다.
 */
export function useCurveWidth(): [(element: HTMLDivElement | null) => void, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(CURVE_BOX.width);
  useIsomorphicLayoutEffect(() => {
    if (element === null) return;
    const apply = (measured: number) => setWidth((current) => nextCurveWidth(current, measured));
    apply(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry !== undefined) apply(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width];
}

/**
 * 곡선 그림 (T090 시안 v4): 100%·50% 눈금 글자, 끝점 둘레 연한 물결 원(`curve-ping`, 1.4s 반복 — 움직임 줄이기면 멈춤),
 * 점선 polyline만 시안 값 `transition: all .3s`(--motion-curve)를 갖고, 점·물결 원은 시안처럼 즉시 옮긴다 (T105 —
 * 미끄러지면 0.3초 동안 점이 점선 끝에서 떨어져 보였다). 좌표는 `curveView` 값 그대로.
 */
export function RiskCurveGraphic({
  curve,
  plotRef,
}: {
  curve: CurveView;
  /** T112: 폭을 잴 칸 (`useCurveWidth`). 없으면 재지 않는다 (정적 그림). */
  plotRef?: (element: HTMLDivElement | null) => void;
}) {
  const t = useT();
  const end = curve.steps[curve.steps.length - 1] ?? curve.draft ?? curve.dots[curve.dots.length - 1];
  // 시안 curve.live: 마지막 사건 점 → 보낸 답장(또는 Your draft) 점 → Send 뒤 단계 점들 (보낸 뒤 실선)
  const live =
    curve.draft === null
      ? null
      : [curve.draft.from, curve.draft, ...curve.steps].map((point) => `${point.x},${point.y}`).join(' ');
  return (
    <div className="curve-plot" ref={plotRef}>
      {/* T112: viewBox 폭·높이 = 실제 px (늘림 없음 — preserveAspectRatio="none"을 쓰지 않는다), 선 두께 고정 */}
      <svg
        className="curve-svg"
        viewBox={`0 0 ${curve.width} ${CURVE_BOX.height}`}
        aria-hidden="true"
        focusable="false"
      >
        <line className="curve-grid" vectorEffect="non-scaling-stroke" x1="0" x2={curve.width} y1={CURVE_BOX.top} y2={CURVE_BOX.top} />
        <line className="curve-grid" vectorEffect="non-scaling-stroke" x1="0" x2={curve.width} y1={MID_Y} y2={MID_Y} />
        <line className="curve-base" vectorEffect="non-scaling-stroke" x1="0" x2={curve.width} y1={CURVE_BOX.bottom} y2={CURVE_BOX.bottom} />
        <polygon className="curve-area" points={curve.area} />
        <polyline className="curve-line" vectorEffect="non-scaling-stroke" points={curve.line} />
        {live === null ? null : (
          <polyline
            className={curve.sent ? 'curve-draft curve-draft-sent' : 'curve-draft'}
            vectorEffect="non-scaling-stroke"
            points={live}
          />
        )}
        {/* T105: 점 색 = 사건 기록 점줄과 같은 규칙 (시안 whoCol, `dot.tone`) */}
        {curve.dots.map((dot, index) => (
          <circle key={index} className={`curve-dot curve-dot-${dot.tone}`} cx={dot.x} cy={dot.y} r="4.5" />
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

export function RiskCurveCard({
  points,
  tones = null,
}: {
  points: RiskPoint[] | null;
  /** 사건마다 색 (사건 기록 줄의 `tone` 그대로 — 곡선·점줄이 같은 색). */
  tones?: readonly HistoryTone[] | null;
}) {
  const t = useT();
  const { forecast, trail, noReplyBy } = useDraftForecast();
  const [plotRef, width] = useCurveWidth();
  const curve = curveView(points, forecast?.pChargeback ?? null, trail, { tones, noReplyBy, width });
  if (curve === null) return null;
  return (
    <section className="curve-card" aria-labelledby="curve-title">
      <div className="curve-main">
        <h2 className="desk-card-title" id="curve-title">
          <b>{t('case.curve.title')}</b>
        </h2>
        <RiskCurveGraphic curve={curve} plotRef={plotRef} />
        <p className="case-sr-only">{t('case.curve.points', { count: curve.dots.length })}</p>
      </div>
      <div className="curve-side">
        <span className="curve-side-label">{t('case.curve.risk')}</span>
        {/* 시안 `risk.st`: 값별 색(riskCol) + transition color .3s (--motion-color) */}
        <span data-tone={curve.headlineTone} className="curve-headline num">
          {curve.headline}
        </span>
        <span className="curve-side-sub">{t(curve.headlineKey, curve.headlineVars)}</span>
        {curve.fromTo === null ? null : <span className="curve-fromto num">{curve.fromTo}</span>}
        <Badge kind="assumption" />
      </div>
    </section>
  );
}
