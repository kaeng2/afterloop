/**
 * T112 단위 테스트: 위험 곡선 늘림(찌그러짐) 수정 — viewBox 폭 = 실제 px 폭.
 *
 * 기대값 출처: `tasks/T112.md` "고칠 것"·"완료 기준", T105 규칙(시안 M:727 `xStep = W / 12`, `x = i * xStep + 8`).
 * **실호출 0회** (AI·PayPal 없음), 개발 서버 없음 (`renderToStaticMarkup`), `.env`를 읽지 않는다.
 * 확률은 다루지 않는다 — 점 y 값은 폭과 상관없이 같은지만 본다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { RiskPoint } from '@/types';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { React?: typeof React }).React = React;

const { curveView, curveWidthOf, nextCurveWidth, CURVE_BOX, CURVE_X } = await import('@/app/cases/desk-model');
const { RiskCurveGraphic, RiskCurveCard } = await import('@/app/cases/view/risk-curve');

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const html = (element: React.ReactElement) => renderToStaticMarkup(element);
const tenth = (v: number) => Math.round(v * 10) / 10;

const POINTS: RiskPoint[] = Array.from({ length: 8 }, (_, i) => ({
  at: `2026-11-0${(i % 9) + 1}T00:00:00Z`,
  kind: i % 2 === 0 ? 'buyer_message' : 'seller_reply',
  pChargeback: 0.05 + i * 0.1,
}));
const TRAIL = [0.4, 0.3, 0.2, 0.05];
/** 데스크톱 넓은 창 (1280·1440·1920·2560에서 곡선 칸 폭 대략) + 좁은 폭. */
const WIDTHS = [360, 480, 640, 760, 900, 1200, 1700];
/** 눈금 글자 "100%" (10px) 폭 어림 — 그리기 자리 값. */
const TICK_TEXT = 26;

describe('T112: 폭 W에서 x = 시안 비율 (W/12 칸)', () => {
  it('사건 i의 x = i × W/12 + 8, 초안 점 = 마지막 사건 + 칸, 단계 점 = 칸 × 0.8씩', () => {
    for (const width of [640, 760, 900, 1200, 1700]) {
      const step = width / 12;
      const curve = curveView(POINTS, 0.4, TRAIL, { width })!;
      expect(curve.width).toBe(width);
      expect(curve.dots.map((dot) => dot.x)).toEqual(POINTS.map((_, i) => tenth(i * step + 8)));
      expect(curve.draft!.x).toBe(tenth(POINTS.length * step + 8));
      curve.steps.forEach((point, index) => {
        expect(point.x).toBeCloseTo(POINTS.length * step + 8 + (index + 1) * step * 0.8, 0);
      });
    }
  });

  it('y(확률 자리)는 폭과 상관없다 — 세로 늘림 없음', () => {
    const a = curveView(POINTS, 0.4, TRAIL, { width: 640 })!;
    const b = curveView(POINTS, 0.4, TRAIL, { width: 1700 })!;
    expect(b.dots.map((dot) => dot.y)).toEqual(a.dots.map((dot) => dot.y));
    expect(b.draft!.y).toBe(a.draft!.y);
    expect(b.steps.map((point) => point.y)).toEqual(a.steps.map((point) => point.y));
  });

  it('폭을 안 주면(서버 렌더) 시안 기준 640, 이상한 폭(0·NaN)도 640', () => {
    expect(curveView(POINTS, 0.4)!.width).toBe(CURVE_BOX.width);
    expect(CURVE_BOX.width).toBe(640);
    expect(curveWidthOf(0)).toBe(640);
    expect(curveWidthOf(Number.NaN)).toBe(640);
    expect(curveWidthOf(812.4)).toBe(812);
  });

  it('넓은 폭·좁은 폭 모두 끝점 + 물결 원(r 20)이 오른쪽 눈금 글자 자리(tickGutter) 안으로 들어가지 않는다', () => {
    for (const width of WIDTHS) {
      for (const count of [3, 8, 9, 12]) {
        const points = POINTS.concat(POINTS).slice(0, count);
        const curve = curveView(points, 0.4, TRAIL, { width })!;
        const end = curve.steps[curve.steps.length - 1];
        // "100%" 10px 글자 폭 ≈ 26px (오른쪽 끝). 끝점 + 물결 원 최대 r 20이 그 왼쪽에서 끝난다
        expect(end.x + 20).toBeLessThanOrEqual(width - TICK_TEXT);
        expect(end.x).toBeLessThanOrEqual(width - CURVE_X.tickGutter);
        expect(curve.draft!.x + 20).toBeLessThan(width - TICK_TEXT);
      }
    }
  });
});

describe('T112: SVG — 늘림 없음, 선 두께 고정, 점 r 그대로', () => {
  const markup = (width: number) => html(createElement(RiskCurveGraphic, { curve: curveView(POINTS, 0.4, TRAIL, { width })! }));

  it('viewBox 폭 = 폭, 높이 = 150 px, preserveAspectRatio="none" 없음', () => {
    for (const width of [640, 1200]) {
      const out = markup(width);
      expect(out).toContain(`viewBox="0 0 ${width} ${CURVE_BOX.height}"`);
      expect(out).not.toMatch(/preserveAspectRatio/);
      expect(out).toContain(`x2="${width}"`);
    }
    expect(strip(read('src/app/cases/view/risk-curve.tsx'))).not.toMatch(/preserveAspectRatio/);
  });

  it('곡선 선·점선·눈금선에 vector-effect="non-scaling-stroke"', () => {
    const out = markup(900);
    const tags = out.match(/<(line|polyline)\b[^>]*>/g) ?? [];
    expect(tags.length).toBe(5); // 눈금 2 + 바닥 1 + 곡선 1 + 초안 점선 1
    for (const tag of tags) expect(tag).toContain('vector-effect="non-scaling-stroke"');
  });

  it('점 r 4.5(사건)·5(초안·단계), ping 시작 r 7 — px 그대로', () => {
    const out = markup(1700);
    expect((out.match(/class="curve-dot curve-dot-[a-z]+"[^>]*r="4\.5"/g) ?? []).length).toBe(POINTS.length);
    expect((out.match(/class="curve-dot-draft[^"]*"[^>]*r="5"/g) ?? []).length).toBe(TRAIL.length);
    expect(out).toMatch(/class="curve-ping"[^>]*r="7"/);
    const css = read('src/app/(app)/desk.css');
    expect(css).toMatch(/@keyframes ping\{0%\{r:7;[^}]*\}100%\{r:20;/);
  });

  it('카드 서버 렌더 = 640 기준 (폭을 재기 전)', () => {
    expect(html(createElement(RiskCurveCard, { points: POINTS }))).toContain(`viewBox="0 0 640 ${CURVE_BOX.height}"`);
  });
});

describe('T112: 폭 재기 — 루프 없음 (T103 교훈)', () => {
  it('폭이 같으면(반올림 기준) 지금 값을 그대로 돌려준다 → setState가 다시 그리지 않음', () => {
    expect(nextCurveWidth(900, 900)).toBe(900);
    expect(nextCurveWidth(900, 900.3)).toBe(900);
    expect(nextCurveWidth(900, 899.6)).toBe(900);
    expect(nextCurveWidth(900, 1201)).toBe(1201);
    expect(nextCurveWidth(900, 0)).toBe(640);
  });

  it('ResizeObserver + layout effect, 의존성은 칸 요소뿐, 갱신은 nextCurveWidth로만, 끝나면 disconnect', () => {
    const src = strip(read('src/app/cases/view/risk-curve.tsx'));
    expect(src).toMatch(/new ResizeObserver/);
    expect(src).toMatch(/useLayoutEffect/);
    expect(src).toMatch(/setWidth\(\(current\) => nextCurveWidth\(current, measured\)\)/);
    expect(src).toMatch(/\}, \[element\]\);/);
    expect(src).toMatch(/observer\.disconnect\(\)/);
    // 재는 칸(.curve-plot)은 svg가 아니라 바깥 div — svg 폭이 바뀌어도 잰 값이 따라 변하지 않는다
    expect(src).toMatch(/<div className="curve-plot" ref=\{plotRef\}>/);
  });
});
