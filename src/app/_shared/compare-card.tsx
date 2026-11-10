/**
 * 큰 숫자 비교 카드 (T047 보완 C). 서연 화면(S5, T009)의 주인공 부품이다.
 *
 *   [이름표 + 배지]
 *   왼쪽 (보조 숫자)   →   오른쪽 (주인공 숫자, 크게)
 *
 * **계산하지 않는다.** 두 값은 부르는 쪽이 엔진(`recommend`) 결과를 `toDollarsRounded`로 바꿔
 * 넘긴 **글자**다. 이 부품은 늘어놓기만 한다. 글자도 부르는 쪽이 `t()`로 읽어 넘긴다.
 */
import type { ReactNode } from 'react';

export type CompareSide = {
  /** 칸 이름 (예: "PayPal data only"). */
  caption: string;
  /** 표시 글자 (예: `toDollarsRounded(best.expectedLossCents)`). */
  display: string;
  /** 칸 아래 한 줄 (선택. 예: 추천 수). */
  note?: ReactNode;
};

export type CompareCardProps = {
  /** 카드 이름표 (예: "Expected loss"). */
  label: string;
  /** 이름표 옆 배지 (예: `<AssumptionBadge />`). */
  badges?: ReactNode;
  before: CompareSide;
  /** 주인공 숫자. */
  after: CompareSide;
  /** 카드 맨 아래 (선택). */
  footer?: ReactNode;
  /** 화살표 읽기용 글자 (`aria-label`). */
  arrowLabel: string;
};

export function CompareCard({ label, badges, before, after, footer, arrowLabel }: CompareCardProps) {
  return (
    <section className="card">
      <div className="row">
        <span className="section-title">{label}</span>
        {badges}
      </div>
      <div className="compare">
        <div className="compare-side">
          <span className="label">{before.caption}</span>
          <span className="compare-value num">{before.display}</span>
          {before.note === undefined ? null : <span className="label">{before.note}</span>}
        </div>
        <span className="compare-arrow" role="img" aria-label={arrowLabel}>
          →
        </span>
        <div className="compare-side compare-hero">
          <span className="label">{after.caption}</span>
          <span className="hero-number">{after.display}</span>
          {after.note === undefined ? null : <span className="label">{after.note}</span>}
        </div>
      </div>
      {footer === undefined ? null : <div className="label">{footer}</div>}
    </section>
  );
}
