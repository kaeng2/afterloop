'use client';

/**
 * Today 왼쪽 목록의 묶음 카드들 (T060 → T076 시안 v4 → T102 "Done today").
 *
 * 서버가 만든 묶음(`TodayGroup[]`, 엔진 결과를 옮긴 값)을 그대로 받고, 이 화면에서 끝낸 항목(`useSavings().done`,
 * 화면 상태만)으로 다시 묶기만 한다 (`regroupDone`). 항목의 상태 글·위험 값·숫자는 바꾸지 않는다 — done 항목은
 * 흐리게(시안 `.it.done{opacity:.55}`) + 점 색만 회색(`#CFD3D8`)이다. 눌러서 다시 볼 수 있다.
 *
 * T106: 항목은 `<button>`이고 누르면 화면 안 상태(`selection.tsx`)만 바뀐다 (링크·서버 왕복 없음). 상품 거르개도
 * 같은 상자에서 읽어 여기서 거른다 (`filterGroups`, 서버가 준 묶음은 거르지 않은 전체).
 *
 * 정직 규칙: done 묶음이 모두 가짜 전송이면 제목에 "· Simulated", 섞였으면 가짜 전송 줄에만 작은 "Simulated".
 * 이 파일은 읽기·쓰기를 하지 않는다 (fetch·서버 액션 없음).
 */
import { useT } from '../_shared/locale-context';
import { ProductTile } from '../_shared/product-icon';
import { regroupDone, type DoneMap, type ListGroup, type ListRow } from './done-groups';
import type { TodayGroup } from './model';
import { useSavings } from './savings';
import { filterGroups } from './screen-model';
import { useTodaySelection } from './selection';

type OnSelect = (itemId: string) => void;
const NO_SELECT: OnSelect = () => undefined;

function ItemRow({ row: listRow, selected, onSelect }: { row: ListRow; selected: boolean; onSelect: OnSelect }) {
  const t = useT();
  const { item, done, simulatedLabel } = listRow;
  const { row } = item;
  return (
    <li>
      {/* T106 (F1-47, 시안 L141 `<button>`): 화면 안 상태로 바로 고른다 (서버 왕복 없음, 키보드로 고를 수 있다) */}
      <button
        type="button"
        className={done ? 'today-item today-item-done' : 'today-item'}
        aria-current={selected ? 'true' : undefined}
        data-item={item.id}
        onClick={() => onSelect(item.id)}
      >
        <ProductTile kind={row.icon} size="sm" dot={`today-dot today-dot-${done ? 'done' : item.dot}`} />
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
            {simulatedLabel ? <span className="today-item-simulated">{t('case.progress.simulated')}</span> : null}
          </span>
          {row.who === null ? null : <span className="today-item-sub">{row.who}</span>}
          <span className="today-sr-only">
            {item.name}
            {item.label === null ? '' : ` · ${item.label}`} · {t(item.status.key)}
          </span>
        </span>
      </button>
    </li>
  );
}

function GroupCard({ group, selectedId, onSelect }: { group: ListGroup; selectedId: string | null; onSelect: OnSelect }) {
  const t = useT();
  const title = group.titleKey === null ? group.title : t(group.titleKey);
  return (
    <section className={`today-group today-group-${group.key}`} aria-labelledby={`today-group-${group.key}`}>
      <div className="today-group-head">
        <span className="today-group-bar" aria-hidden="true" />
        <h2 className="today-group-title" id={`today-group-${group.key}`}>
          {title} <span className="today-group-count num">({group.rows.length})</span>
        </h2>
        {group.hint === null ? null : <span className="today-group-hint">{group.hint}</span>}
      </div>
      <ul className="today-items">
        {group.rows.map((row) => (
          <ItemRow key={row.item.id} row={row} selected={row.item.id === selectedId} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  );
}

/**
 * 화면용. 고르기 상자(`TodaySelectionProvider`)가 있으면 고른 항목·상품 거르개를 거기서 읽고, 없으면(견본·테스트)
 * 받은 `selectedId`와 거르지 않은 묶음을 그대로 쓴다.
 */
export function TodayGroups({ groups, selectedId }: { groups: TodayGroup[]; selectedId: string | null }) {
  const { done } = useSavings();
  const selection = useTodaySelection();
  return (
    <TodayGroupsView
      groups={selection === null ? groups : filterGroups(groups, selection.sku)}
      done={done}
      selectedId={selection === null ? selectedId : selection.itemId}
      onSelect={selection?.select}
    />
  );
}

/** 끝낸 항목 표를 직접 받는 모양 (테스트·견본용). */
export function TodayGroupsView({
  groups,
  done,
  selectedId,
  onSelect = NO_SELECT,
}: {
  groups: TodayGroup[];
  done: DoneMap;
  selectedId: string | null;
  onSelect?: OnSelect;
}) {
  return (
    <>
      {regroupDone(groups, done).map((group) => (
        <GroupCard key={group.key} group={group} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}
