/**
 * Today 왼쪽 할 일 목록 (T060 → T067). 날짜 줄 · 제목 · 가게 전체 한 줄 링크 · 묶음 세 개(Needs you / Prevent / Routine).
 *
 * **계산하지 않는다** — 모든 글자·숫자는 `buildToday`(엔진 결과를 옮긴 값)에서 온다. 항목은 링크라서 키보드로 고를 수
 * 있고, 고른 항목에는 `aria-current`가 붙는다. 고른 항목은 흰 카드 + 그림자 하나(`--shadow-selected`), 나머지는 투명.
 *
 * 한 줄 (T067, 시안 v3): 왼쪽 **점 = 위험 등급 색**, 오른쪽 **알약 = 상태** (High · Watch · Waiting approval ·
 * Prevent · Skipped). 점은 장식이라 읽히지 않고(`aria-hidden`), 상태는 알약 글자로 읽힌다.
 */
import Link from 'next/link';

import { t } from '../_shared/copy';
import type { TodayItem, TodayView } from './model';

function ItemRow({ item, selected }: { item: TodayItem; selected: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className="today-item"
        aria-current={selected ? 'true' : undefined}
        scroll={item.kind === 'prevent'}
      >
        <span className={`today-dot today-dot-${item.dot}`} aria-hidden="true" />
        <span className="today-item-body">
          <span className="today-item-top">
            <span className="today-item-name">
              {item.name}
              {item.label === null ? null : <span className="today-item-label"> · {item.label}</span>}
            </span>
            <span className={`today-pill today-pill-${item.status.tone}`}>{t(item.status.key)}</span>
          </span>
          {item.sub === null ? null : <span className="today-item-sub">{item.sub}</span>}
        </span>
      </Link>
    </li>
  );
}

export function TodayList({
  view,
  selectedId,
  paypalNotice,
}: {
  view: TodayView;
  selectedId: string | null;
  paypalNotice: string | null;
}) {
  return (
    <div className="today-list">
      <div className="today-head">
        <p className="today-date">{view.dateLine}</p>
        <h1 className="today-title">{t('today.title')}</h1>
        <Link href="/products" className="today-store-link">
          {view.storeLine.text}
        </Link>
      </div>

      {paypalNotice === null ? null : <p className="notice">{paypalNotice}</p>}

      <nav aria-label={t('today.listLabel')} className="today-groups">
        {view.groups.length === 0 ? <p className="small muted">{t('today.empty')}</p> : null}
        {view.groups.map((group) => (
          <section key={group.key} className="today-group" aria-labelledby={`today-group-${group.key}`}>
            <h2 className="today-group-title" id={`today-group-${group.key}`}>
              {group.title}
            </h2>
            <ul className="today-items">
              {group.items.map((item) => (
                <ItemRow key={item.id} item={item} selected={item.id === selectedId} />
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}
