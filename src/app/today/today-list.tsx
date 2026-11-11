/**
 * Today 왼쪽 칸 (T060 → T067 → T076 시안 v4). 위에서 아래로:
 *  1. "DisputeLess this week" 카드 — 계산 가능한 숫자만 (`WeeklyView`: 열린 분쟁 수 · 지킬 수 있는 돈 · AI 초안 수).
 *     예측 어댑터가 없으면 열린 분쟁 수 + 사실 한 줄만. 시드 값이 섞이면 Demo data
 *  2. 묶음 카드 세 개 (Reply needed / Prevent / Routine) — 머리 줄(이름 (N) + 한 줄 설명) + 항목 줄
 *
 * 항목 한 줄 (시안 v4): 상품 아이콘(오른쪽 위 점 = 위험 등급) · "PP-R-… · Wool Sweater" · 범주 알약 ·
 * "Reply by Nov 30" · "Seo-yeon Kim · KR". 고른 줄은 옅은 강조색 바탕 + 왼쪽 띠.
 *
 * **계산하지 않는다** — 모든 글자·숫자는 `buildToday`·`weeklyView`(엔진 결과를 옮긴 값)에서 온다. 항목은 링크라서
 * 키보드로 고를 수 있고, 고른 항목에는 `aria-current`가 붙는다.
 */
import Link from 'next/link';

import { Badge } from '../_shared/badges';
import { t } from '../_shared/copy';
import { ProductTile } from '../_shared/product-icon';
import { weeklyView, type TodayGroup, type TodayItem, type TodayView, type WeeklyView } from './model';
import { WeeklyBumpCell } from './savings';

function ItemRow({ item, selected }: { item: TodayItem; selected: boolean }) {
  const { row } = item;
  return (
    <li>
      <Link
        href={item.href}
        className="today-item"
        aria-current={selected ? 'true' : undefined}
        scroll={item.kind === 'prevent'}
      >
        <ProductTile kind={row.icon} size="sm" dot={`today-dot today-dot-${item.dot}`} />
        <span className="today-item-body">
          <span className="today-item-top">
            <span className="today-item-name num">{row.head}</span>
            {row.product === null ? null : <span className="today-item-product"> · {row.product}</span>}
          </span>
          <span className="today-item-tags">
            {row.category === null ? null : (
              <span className={`today-pill today-pill-${row.categoryTone}`}>{row.category}</span>
            )}
            {row.due === null ? null : <span className="today-item-due num">{row.due}</span>}
          </span>
          {row.who === null ? null : <span className="today-item-sub">{row.who}</span>}
          <span className="today-sr-only">
            {item.name}
            {item.label === null ? '' : ` · ${item.label}`} · {t(item.status.key)}
          </span>
        </span>
      </Link>
    </li>
  );
}

function GroupCard({ group, selectedId }: { group: TodayGroup; selectedId: string | null }) {
  return (
    <section className={`today-group today-group-${group.key}`} aria-labelledby={`today-group-${group.key}`}>
      <div className="today-group-head">
        <span className="today-group-bar" aria-hidden="true" />
        <h2 className="today-group-title" id={`today-group-${group.key}`}>
          {group.title} <span className="today-group-count num">({group.items.length})</span>
        </h2>
        <span className="today-group-hint">{group.hint}</span>
      </div>
      <ul className="today-items">
        {group.items.map((item) => (
          <ItemRow key={item.id} item={item} selected={item.id === selectedId} />
        ))}
      </ul>
    </section>
  );
}

/** "DisputeLess this week" 카드. 숫자는 `WeeklyView` 그대로 (없는 칸은 그리지 않는다). */
export function WeeklyCard({ weekly, storeLine }: { weekly: WeeklyView; storeLine: string }) {
  return (
    <section className="weekly" aria-labelledby="weekly-title">
      <div className="weekly-head">
        <div className="weekly-titles">
          <h2 className="weekly-title" id="weekly-title">
            {t('today.weekly.title')}
          </h2>
          <span className="weekly-sub">{t('today.weekly.sub')}</span>
        </div>
        {weekly.usesDemoData ? <Badge kind="demo" /> : null}
      </div>
      <div className="weekly-grid">
        <div className="weekly-cell">
          <span className="weekly-label">{t('today.weekly.open')}</span>
          <span className="weekly-value num">{weekly.openDisputes}</span>
          <span className="weekly-note">{t('today.weekly.openNote')}</span>
        </div>
        {weekly.keepable === null ? null : (
          // T091: 액션이 끝나면 "+$N just now" (엔진 actionSavings·trackingSavings 값, 화면 상태만)
          <WeeklyBumpCell className="weekly-cell">
            <span className="weekly-label">{t('today.weekly.keepable')}</span>
            <span className="weekly-value num">{weekly.keepable}</span>
            <span className="weekly-note">
              {t('today.weekly.keepableNote')} <Badge kind="assumption" />
            </span>
          </WeeklyBumpCell>
        )}
        {weekly.aiDrafts === null ? null : (
          <div className="weekly-cell">
            <span className="weekly-label">{t('today.weekly.drafts')}</span>
            <span className="weekly-value num">{weekly.aiDrafts}</span>
            <span className="weekly-note">{t('today.weekly.draftsNote')}</span>
          </div>
        )}
        {weekly.keepable === null ? (
          <WeeklyBumpCell className="weekly-cell weekly-fact">
            <span className="weekly-note">{t('today.weekly.fact')}</span>
          </WeeklyBumpCell>
        ) : (
          <div className="weekly-cell weekly-fact">
            <span className="weekly-note">{t('today.weekly.fact')}</span>
          </div>
        )}
      </div>
      <p className="weekly-link">{storeLine}</p>
    </section>
  );
}

export function TodayList({
  view,
  weekly,
  selectedId,
  paypalNotice,
}: {
  view: TodayView;
  /** 이번 주 카드. 없으면 목록에서 센 열린 분쟁 수만 (`weeklyView(…, null, …)`). */
  weekly?: WeeklyView;
  selectedId: string | null;
  paypalNotice: string | null;
}) {
  const card = weekly ?? weeklyView(view.openDisputes, null, false);
  return (
    <div className="today-list">
      <h1 className="today-sr-only">{t('today.title')}</h1>
      <WeeklyCard weekly={card} storeLine={view.storeLine.text} />

      {paypalNotice === null ? null : <p className="notice">{paypalNotice}</p>}

      <nav aria-label={t('today.listLabel')} className="today-groups">
        {view.groups.length === 0 ? <p className="small muted">{t('today.empty')}</p> : null}
        {view.groups.map((group) => (
          <GroupCard key={group.key} group={group} selectedId={selectedId} />
        ))}
      </nav>
    </div>
  );
}

/** 상품 거르개 줄 (위쪽 막대 아래 가로 한 줄). 누르면 왼쪽 목록을 그 상품으로 거른다 (`?sku=`). */
export function ProductFilterBar({ view }: { view: TodayView }) {
  const { filter } = view;
  return (
    <nav className="product-filter" aria-label={t('today.filter.label')}>
      <ul className="product-filter-list">
        {filter.chips.map((chip) => (
          <li key={chip.sku ?? 'all'}>
            <Link
              href={chip.href}
              className="product-filter-chip"
              aria-current={chip.selected ? 'true' : undefined}
              scroll={false}
            >
              <ProductTile kind={chip.icon} badge={chip.sku === null ? undefined : chip.cases} />
              <span className="product-filter-text">
                <span className="product-filter-name">{chip.name}</span>
                <span className="product-filter-sub num">{chip.sub}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <span className="product-filter-summary num">{filter.summary}</span>
    </nav>
  );
}
