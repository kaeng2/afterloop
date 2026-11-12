/**
 * 비-서연 항목 상세의 공통 틀 (T106, 시안 `Desk.dc.html` L345-357 "Other cases", 차이 목록 F1-55).
 *
 *   머리: 52px 상품 타일 + 굵은 제목(24px 900) + 범주 칩 + 아래 한 줄(who 14px)
 *   카드: `.zone-work` (r24 · padding 22/22/20 · 그림자 · 위 4px 그라데이션 띠) — AI 알약 · 제목 20px · 설명 15px · 버튼
 *
 * **그리기만 한다.** 머리 글자는 목록 줄(`TodayRowView`, `buildToday`가 데이터·문구에서 만든 값)을 그대로 옮기고,
 * 카드 제목·설명·버튼은 부르는 쪽이 넘긴다. 읽기·쓰기·계산 없음 (서버·브라우저 어느 쪽에서도 그릴 수 있다).
 */
import type { ReactNode } from 'react';

import { AiPill } from '../_shared/badges';
import { ProductTile } from '../_shared/product-icon';
import type { TodayRowView } from './model';

/** 상세 머리 (시안 타일 + h1 + 범주 칩 + who). */
export function WorkHeader({ row }: { row: TodayRowView }) {
  return (
    <div className="work-head">
      <ProductTile kind={row.icon} size="lg" />
      <div className="work-head-text">
        <div className="work-head-top">
          <h2 className="work-head-title num">
            {row.head}
            {row.product === null ? null : <span className="work-head-product"> · {row.product}</span>}
          </h2>
          {row.category === null ? null : (
            <span className={`today-pill today-pill-${row.categoryTone}`}>{row.category}</span>
          )}
        </div>
        {row.who === null ? null : <span className="work-head-who">{row.who}</span>}
      </div>
    </div>
  );
}

/** `.zone-work` 카드. `children` = 버튼·결과 줄. */
export function WorkCard({
  titleId,
  title,
  body = null,
  className,
  ai = true,
  children,
}: {
  titleId: string;
  title: ReactNode;
  body?: ReactNode;
  className?: string;
  /** AI 알약. AI가 만든 글이 없는 카드(코드 판정·엔진 계산만: Routine·Prevent)는 `false` (출처 표시 정직 규칙). */
  ai?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={className === undefined ? 'zone-work' : `zone-work ${className}`} aria-labelledby={titleId}>
      {ai ? <AiPill /> : null}
      <div className="zone-work-text">
        <h3 className="zone-work-title num" id={titleId}>
          {title}
        </h3>
        {body === null ? null : <div className="zone-work-body">{body}</div>}
      </div>
      {children}
    </section>
  );
}

/** 상세 칸 전체 (머리 + 카드 + 그 아래 작은 것들). 시안 `section{gap:16px}`. */
export function WorkDetail({ row, className, children }: { row?: TodayRowView | null; className?: string; children?: ReactNode }) {
  return (
    <div className={className === undefined ? 'work-detail' : `work-detail ${className}`}>
      {row === undefined || row === null ? null : <WorkHeader row={row} />}
      {children}
    </div>
  );
}
