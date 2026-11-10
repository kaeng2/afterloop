/**
 * 큰 숫자 비교 카드 (T047 보완 C → T009 1부 "비교 카드 다듬기", 사람 결정 2026-11-10).
 * 서연 화면(S5)의 주인공 부품이고, 견본 화면(`/preview/styleguide`)도 같은 부품을 쓴다.
 *
 *   [이름표 + 머리 배지(Assumption)]
 *   왼쪽 칸 이름 · 행동           오른쪽 칸 이름 · 행동  [칸 배지(Demo data)]
 *   ~~왼쪽 숫자~~ (흐리게)   →   오른쪽 숫자 (크게, .hero-number)
 *
 * - 두 숫자는 같은 줄에 나란히 놓이고, 화살표는 두 숫자 사이 가운데(세로로도 숫자 줄 가운데)다.
 * - 카드 폭은 내용에 맞춘다 (화면 폭 전체로 늘어나 숫자 오른쪽에 빈칸이 생기지 않게). 두 칸은 같은 폭.
 * - 좁은 폭(30rem 아래)에서는 왼쪽 → 화살표 → 오른쪽 순서로 세로로 쌓인다.
 * - 왼쪽 숫자는 `<del>` + 읽기용 글자(`previousLabel`)라 화면 읽기에서도 "이전 값"으로 읽힌다.
 *
 * **계산하지 않는다.** 숫자는 부르는 쪽이 엔진(`recommend`) 결과를 `toDollarsRounded`로 바꿔 넘긴
 * **글자**다. 칸 이름·행동 글자도 부르는 쪽이 `t()`로 읽어 넘긴다 (어느 행동인지는 엔진의 `best.move`).
 * 스타일은 `./compare-card.css` (색은 `globals.css`의 변수만 쓴다).
 */
import type { ReactNode } from 'react';

import './compare-card.css';

export type CompareSide = {
  /** 칸 이름 + 행동 (예: "PayPal data only · Full refund"). 부르는 쪽이 문구로 만든다. */
  caption: string;
  /** 표시 글자 (예: `toDollarsRounded(best.expectedLossCents)`). */
  display: string;
  /** 칸 이름 옆 배지 (선택. 예: 오른쪽 칸의 `<DemoBadge />`). */
  badge?: ReactNode;
  /** 칸 아래 한 줄 (선택). */
  note?: ReactNode;
};

export type CompareCardProps = {
  /** 카드 이름표 (예: "Expected loss"). */
  label: string;
  /** 이름표 옆 배지 (예: `<AssumptionBadge />`). 칸에만 해당하는 배지는 `CompareSide.badge`에 둔다. */
  badges?: ReactNode;
  /** 이전 값 (흐리게 + 취소선). */
  before: CompareSide;
  /** 주인공 숫자. `null`이면 왼쪽 칸만 그린다 (취소선·화살표 없음). */
  after: CompareSide | null;
  /** 카드 맨 아래 (선택). */
  footer?: ReactNode;
  /** 화살표 읽기용 글자 (`aria-label`). */
  arrowLabel: string;
  /** 취소선 숫자 앞에 붙는 읽기용 글자 (화면에는 보이지 않는다. 예: "Previous value"). */
  previousLabel: string;
};

function SideCaption({ side }: { side: CompareSide }) {
  return (
    <span className="cc-caption">
      <span className="label">{side.caption}</span>
      {side.badge}
    </span>
  );
}

export function CompareCard({ label, badges, before, after, footer, arrowLabel, previousLabel }: CompareCardProps) {
  return (
    <section className="card cc-card" aria-label={label}>
      <div className="row">
        <span className="section-title">{label}</span>
        {badges}
      </div>
      <div className={after === null ? 'cc-grid cc-single' : 'cc-grid'}>
        <div className="cc-side cc-before">
          <SideCaption side={before} />
          {after === null ? (
            <span className="cc-value hero-number">{before.display}</span>
          ) : (
            <del className="cc-value cc-previous num">
              <span className="cc-sr-only">{previousLabel} </span>
              {before.display}
            </del>
          )}
          {before.note === undefined ? null : <span className="cc-note label">{before.note}</span>}
        </div>
        {after === null ? null : (
          <>
            <span className="cc-arrow" role="img" aria-label={arrowLabel}>
              →
            </span>
            <div className="cc-side cc-after">
              <SideCaption side={after} />
              <span className="cc-value hero-number">{after.display}</span>
              {after.note === undefined ? null : <span className="cc-note label">{after.note}</span>}
            </div>
          </>
        )}
      </div>
      {footer === undefined ? null : <div className="label cc-footer">{footer}</div>}
    </section>
  );
}
