/**
 * 상품 아이콘 (T076, 시안 v4의 선 그림 5개). 장식이다 (`aria-hidden`) — 상품 이름은 옆 글자로 읽힌다.
 * 색은 css 변수(`.product-icon` → `--color-accent`)만 쓴다. 어느 그림인지는 `productIconOf`(상품 이름 낱말)가 고른다.
 */
import type { ProductIconKind } from '../cases/desk-model';

const PATHS: Record<ProductIconKind, string> = {
  cardigan: 'M8 4L4 7l2 4 2-1v10h8V10l2 1 2-4-4-3-4 6zM12 10v10M10.5 13h.01M10.5 16h.01',
  sweater: 'M8 4L4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-1 1.4-2.3 2-4 2S9 5.4 8 4zM8 18h8',
  coat: 'M8 3L4 6l2 5 2-1v12h8V10l2 1 2-5-4-3-4 6zM12 9v13M9 15h2',
  beanie: 'M5 15a7 7 0 0 1 14 0zM4 15h16v3H4zM12 8V6M12 6a1.2 1.2 0 1 0 0-.01',
  multi: 'M4 8h16v12H4zM4 8l2-4h12l2 4M10 12h4',
};

/** 둥근 네모 바탕 + 선 그림. `size`는 바탕 크기 (sm 36 · md 38 · lg 52). `dot`이 있으면 오른쪽 위 점(위험 등급). */
export function ProductTile({
  kind,
  size = 'md',
  dot,
  badge,
}: {
  kind: ProductIconKind;
  size?: 'sm' | 'md' | 'lg';
  dot?: string;
  badge?: number;
}) {
  return (
    <span className={`product-tile ptile product-tile-${size}`} aria-hidden="true">
      <svg className="product-icon" viewBox="0 0 24 24" focusable="false">
        <path d={PATHS[kind]} />
      </svg>
      {dot === undefined ? null : <span className={`product-tile-dot sev ${dot}`} />}
      {badge === undefined || badge === 0 ? null : <span className="product-tile-badge num">{badge}</span>}
    </span>
  );
}
