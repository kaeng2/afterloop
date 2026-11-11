/**
 * Products 탭 그리기 부품 (T062). **계산하지 않는다** — `model.ts`가 만든 보기용 값의 글자만 옮긴다.
 * 상태가 없는 부품만 둔다 (단위 테스트가 `renderToStaticMarkup`으로 그린다). 토글 상태는 `products-screen.tsx`.
 *
 * 배치 (지시서 T062): 왼쪽 상품 목록 · 가운데 리허설(큰 숫자 + 점 그림) · 오른쪽 처방 카드 4개.
 * 폭포 차트·분포 막대·전후 막대는 그리지 않는다.
 */
import type { ReactNode } from 'react';
import { AssumptionBadge, CachedBadge, DemoBadge } from '../_shared/badges';
import { t } from '../_shared/copy';
import type { FixId } from '@/types';
import { ProductGrid } from './product-grid';
import type { DotPlotView, FixCardView, ProductRow, ProductView, TransactionLineView } from './model';

// ── 왼쪽 상품 표 (T065: AG Grid Community, `product-grid.tsx`) ─────────────

export function ProductList({ rows }: { rows: readonly ProductRow[] }) {
  return (
    <nav className="products-list" aria-label={t('product.listLabel')}>
      <div className="products-list-head">
        <h1 className="products-title">{t('product.list.title')}</h1>
        <DemoBadge />
      </div>
      <ProductGrid rows={rows} />
    </nav>
  );
}

// ── 가운데 리허설 ───────────────────────────────────────────────────────────

function DotGrid({ plot, side }: { plot: DotPlotView; side: 'before' | 'after' }) {
  const label = side === 'before' ? plot.beforeLabel : plot.afterLabel;
  return (
    <figure className="dots-panel" data-side={side}>
      <figcaption className="small dots-caption">{label}</figcaption>
      <div className="dots" role="img" aria-label={label}>
        {plot.dots.map((dot) => {
          const red = side === 'before' ? dot.redBefore : dot.redAfter;
          return <span key={dot.index} className={red ? 'dot dot-red' : 'dot'} data-red={red ? 'true' : undefined} />;
        })}
      </div>
    </figure>
  );
}

export function DotPlot({ plot, showAfter }: { plot: DotPlotView; showAfter: boolean }) {
  return (
    <section className="dots-plot" aria-label={t('product.dots.label')}>
      <div className="dots-pair">
        <DotGrid plot={plot} side="before" />
        {showAfter ? <DotGrid plot={plot} side="after" /> : null}
      </div>
      <p className="small muted">{plot.legend}</p>
    </section>
  );
}

function BigNumbers({ view }: { view: ProductView }) {
  return (
    <div className="big-numbers">
      <div className="big-number" data-side="before" data-cents={view.before.mean.cents}>
        <span className="label">{t('product.asIs')}</span>
        <span className="hero-number num">{view.before.mean.text}</span>
      </div>
      {view.after === null ? null : (
        <>
          <span className="big-arrow" aria-hidden="true">
            →
          </span>
          <div className="big-number big-number-after" data-side="after" data-cents={view.after.mean.cents}>
            <span className="label">{t('product.withFixes')}</span>
            <span className="hero-number num">{view.after.mean.text}</span>
          </div>
        </>
      )}
      <AssumptionBadge source={view.rateSource} />
    </div>
  );
}

export function Rehearsal({ view, txLine }: { view: ProductView; txLine: TransactionLineView | null }) {
  return (
    <section className="rehearsal" aria-label={t('product.detailLabel')}>
      <div className="row">
        <p className="small muted">{view.rehearsalLine}</p>
        <DemoBadge />
      </div>
      <h2 className="rehearsal-title">{view.name}</h2>
      <div className="card rehearsal-card stack">
        <span className="label">{t('product.expectedLoss')}</span>
        <BigNumbers view={view} />
        {view.after === null ? <p className="small muted">{t('product.noFixes')}</p> : null}
        <p className="rehearsal-range">{view.rangeSentence}</p>
        <DotPlot plot={view.dots} showAfter={view.after !== null} />
      </div>
      {txLine === null ? null : (
        <p className="small muted row tx-line">
          <span>{txLine.text}</span>
          {txLine.cached ? <CachedBadge /> : null}
        </p>
      )}
    </section>
  );
}

// ── 오른쪽 처방 카드 ───────────────────────────────────────────────────────

export function FixBadge({ card }: { card: FixCardView }) {
  return (
    <span className={`fix-badge fix-badge-${card.badge.kind}`} data-badge={card.badge.kind}>
      {card.badge.text}
    </span>
  );
}

export function FixCard({
  card,
  onToggle,
  children,
}: {
  card: FixCardView;
  onToggle?: (id: FixId) => void;
  /** 색상 문구 카드에만 들어간다 (AI 문구 자리) */
  children?: ReactNode;
}) {
  const inputId = `fix-${card.id}`;
  return (
    <li className="card fix-card" data-fix={card.id} data-on={card.on ? 'true' : 'false'}>
      <div className="fix-head">
        <label htmlFor={inputId} className="fix-title">
          {card.title}
        </label>
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          className="fix-toggle"
          checked={card.on}
          onChange={() => onToggle?.(card.id)}
        />
      </div>
      <p className="small">{card.description}</p>
      <div className="row">
        <FixBadge card={card} />
      </div>
      <p className="small num fix-effect" data-from={card.effect.from.cents} data-to={card.effect.to.cents}>
        <span>{card.effect.text}</span> <AssumptionBadge source={card.source} />
      </p>
      {children}
    </li>
  );
}

export function FixCards({
  view,
  onToggle,
  onAllOn,
  colorNoteSlot,
}: {
  view: ProductView;
  onToggle?: (id: FixId) => void;
  onAllOn?: () => void;
  /** 색상 문구 카드 안에 넣을 AI 문구 자리 (없으면 아무것도 넣지 않는다) */
  colorNoteSlot?: ReactNode;
}) {
  return (
    <aside className="fixes" aria-label={t('product.fixes.title')}>
      <div className="fixes-head">
        <h2 className="section-title">{t('product.fixes.title')}</h2>
        {view.allOn ? null : (
          <button type="button" className="link-button" onClick={onAllOn}>
            {t('product.fixes.allOn')}
          </button>
        )}
      </div>
      <ul className="fixes-list">
        {view.fixes.map((card) => (
          <FixCard key={card.id} card={card} onToggle={onToggle}>
            {card.id === 'color_note' ? colorNoteSlot : null}
          </FixCard>
        ))}
      </ul>
      <p className="small muted">{t('product.fixes.footnote')}</p>
    </aside>
  );
}
