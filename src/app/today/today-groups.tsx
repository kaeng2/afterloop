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
import { Badge } from '../_shared/badges';
import { useT } from '../_shared/locale-context';
import { ProductTile } from '../_shared/product-icon';
import { regroupDone, type DoneMap, type ListGroup, type ListRow } from './done-groups';
import type { TodayGroup } from './model';
import { useSavings } from './savings';
import { filterGroups } from './screen-model';
import { riskChipParts, useRiskValues, type ListRiskValues } from './risk-values';
import { useTodaySelection } from './selection';

type OnSelect = (itemId: string) => void;
const NO_SELECT: OnSelect = () => undefined;
const NO_RISK: ListRiskValues = {};

function ItemRow({
  row: listRow,
  selected,
  onSelect,
  risk,
}: {
  row: ListRow;
  selected: boolean;
  onSelect: OnSelect;
  risk: ListRiskValues;
}) {
  const t = useT();
  const { item, done, simulatedLabel } = listRow;
  const { row } = item;
  const chip = done || !Object.hasOwn(risk, item.id) ? null : riskChipParts(risk[item.id]);
  return (
    <li>
      {/* T106 (F1-47, 시안 L141 `<button>`): 화면 안 상태로 바로 고른다 (서버 왕복 없음, 키보드로 고를 수 있다) */}
      <button
        type="button"
        className={`today-item it${selected ? ' on' : ''}${done ? ' today-item-done done' : ''}`}
        aria-current={selected ? 'true' : undefined}
        data-item={item.id}
        onClick={() => onSelect(item.id)}
      >
        <ProductTile kind={row.icon} size="sm" dot={`today-dot today-dot-${done ? 'done' : item.dot}`} />
        <span className="today-item-body">
          <span className="today-item-top">
            {/* T124a: 시안 L166-168처럼 글자는 안쪽 span (`{{it.order}}`·`· {{it.prod}}`·`{{it.cat}}`·…) */}
            {/* T125a: 시안 L166 `<b>{{it.order}}</b>`·`<span>· {{it.prod}}</span>` — 글자 주인은 b / 한 span */}
            <b className="today-item-name num">
              <span>{row.head}</span>
            </b>
            {row.product === null ? null : <span className="today-item-product">{`· ${row.product}`}</span>}
          </span>
          <span className="today-item-tags">
            {row.category === null ? null : (
              <span className={`today-pill chip today-pill-${row.categoryTone}`}>
                <span>{row.category}</span>
              </span>
            )}
            {row.due === null ? null : (
              <span className="today-item-due num">
                <span>{row.due}</span>
              </span>
            )}
            {simulatedLabel ? <span className="today-item-simulated">{t('case.progress.simulated')}</span> : null}
            {/* T122e: 표시용 번호·건수(시드 demo-display)면 Demo data, 실제 PayPal 분쟁 번호는 보조 글로 */}
            {row.demo === true ? <Badge kind="demo" /> : null}
          </span>
          {row.ref === undefined || row.ref === null ? null : (
            <span className="today-item-ref small muted num" title={t('today.row.refLabel', { ref: row.ref })}>
              {row.ref}
            </span>
          )}
          {/* T122b 시안 v6 L148: 아래 줄 = 구매자 + 오른쪽 위험 % 칩 (엔진 무응답 pChargeback. 값이 없거나 끝낸 항목은 칩 없음) */}
          {row.who === null && chip === null ? null : (
            <span className="today-item-subrow">
              <span className="today-item-sub">
                <span>{row.who ?? ''}</span>
              </span>
              {chip === null ? null : (
                <span className={`today-risk today-risk-${chip.level}`} title={t('today.risk.tip')}>
                  <span>{t('today.risk.chip', { percent: chip.percent, level: t(chip.levelKey) })}</span>
                </span>
              )}
            </span>
          )}
          <span className="today-sr-only">
            {item.name}
            {item.label === null ? '' : ` · ${item.label}`} · {t(item.status.key)}
          </span>
        </span>
      </button>
    </li>
  );
}

function GroupCard({
  group,
  selectedId,
  onSelect,
  risk,
}: {
  group: ListGroup;
  selectedId: string | null;
  onSelect: OnSelect;
  risk: ListRiskValues;
}) {
  const t = useT();
  const title = group.titleKey === null ? group.title : t(group.titleKey);
  return (
    <section className={`today-group sec today-group-${group.key}`} aria-labelledby={`today-group-${group.key}`}>
      <div className="today-group-head sech">
        <span className="today-group-bar" aria-hidden="true" />
        <h2 className="today-group-title" id={`today-group-${group.key}`}>
          {/* T124a: 시안 L161 `<b>{{g.title}} <span>({{g.count}})</span></b>` — 글자는 안쪽 span */}
          {/* T125a: round5 — 시안 `<b>제목 <span>(N)</span></b>`: 제목 글자 주인 b, "(N)"은 한 span */}
          <b>
            {`${title} `}
            <span className="today-group-count num">{`(${group.rows.length})`}</span>
          </b>
        </h2>
        {group.hint === null ? null : (
          <span className="today-group-hint">
            <span>{group.hint}</span>
          </span>
        )}
      </div>
      <ul className="today-items">
        {group.rows.map((row) => (
          <ItemRow key={row.item.id} row={row} selected={row.item.id === selectedId} onSelect={onSelect} risk={risk} />
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
  // T122b: 위험 % 칩 값은 값 상자(`risk-values.tsx`)에서 읽는다
  const risk = useRiskValues();
  return (
    <TodayGroupsView
      groups={selection === null ? groups : filterGroups(groups, selection.sku)}
      done={done}
      selectedId={selection === null ? selectedId : selection.itemId}
      onSelect={selection?.select}
      risk={risk}
    />
  );
}

/** 끝낸 항목 표를 직접 받는 모양 (테스트·견본용). */
export function TodayGroupsView({
  groups,
  done,
  selectedId,
  onSelect = NO_SELECT,
  risk = NO_RISK,
}: {
  groups: TodayGroup[];
  done: DoneMap;
  selectedId: string | null;
  onSelect?: OnSelect;
  /** 항목 id → 엔진 무응답 pChargeback. 없는 항목은 칩 없음. */
  risk?: ListRiskValues;
}) {
  return (
    <>
      {regroupDone(groups, done).map((group) => (
        <GroupCard key={group.key} group={group} selectedId={selectedId} onSelect={onSelect} risk={risk} />
      ))}
    </>
  );
}
