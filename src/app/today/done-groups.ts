/**
 * "Done today" 묶음 (T102, 시안 v4 `Desk.dc.html` secs·mkItem). **화면 상태만** — 서버가 만든 묶음(`TodayGroup[]`,
 * 상품 거르개까지 끝난 값)을 이 화면에서 끝낸 항목 표(`DoneMap`)로 다시 묶기만 한다. 항목 값(상태 글·위험 점·숫자)은
 * 그대로 옮긴다. 계산·읽기·쓰기 없음.
 *
 * - 끝낸 항목은 원래 묶음에서 빠지고 맨 아래 `done` 묶음에 들어간다 (원래 목록 순서). 빈 묶음은 없다.
 * - done 묶음 안 항목이 **모두** simulated면 제목은 `today.group.doneSimulated`, 하나라도 실제 전송이면
 *   `today.group.done` + simulated 항목 줄에만 작은 Simulated 글 (정직 규칙: 보내지 않은 것을 끝난 것처럼 말하지 않는다).
 * - 서버 묶음에 없는 항목(거르개로 빠진 항목)은 done 묶음에도 없다 → 상품 거르개가 done에도 똑같이 적용된다.
 */
import type { TodayGroup, TodayGroupKey, TodayItem } from './model';

/** 이 화면에서 끝낸 항목 (항목 id → 가짜 전송이었는지). */
export type DoneMap = Readonly<Record<string, { simulated: boolean }>>;

export type ListGroupKey = TodayGroupKey | 'done';

export type ListRow = {
  item: TodayItem;
  done: boolean;
  /** 줄에 작은 "Simulated" 글을 단다 (done 묶음이 섞였을 때 simulated 항목만). */
  simulatedLabel: boolean;
};

export type ListGroup = {
  key: ListGroupKey;
  /** 원래 묶음은 서버가 만든 제목 글자, done 묶음은 `null` (`titleKey`를 쓴다). */
  title: string | null;
  titleKey: 'today.group.done' | 'today.group.doneSimulated' | null;
  /** done 묶음은 힌트 없음 (시안 빈 칸). */
  hint: string | null;
  rows: ListRow[];
};

export function regroupDone(groups: readonly TodayGroup[], done: DoneMap): ListGroup[] {
  const isDone = (item: TodayItem) => Object.hasOwn(done, item.id);
  const open: ListGroup[] = groups
    .map((group) => ({
      key: group.key,
      title: group.title,
      titleKey: null,
      hint: group.hint,
      rows: group.items.filter((item) => !isDone(item)).map((item) => ({ item, done: false, simulatedLabel: false })),
    }))
    .filter((group) => group.rows.length > 0);

  const doneItems = groups.flatMap((group) => group.items).filter(isDone);
  if (doneItems.length === 0) return open;
  const allSimulated = doneItems.every((item) => done[item.id]?.simulated === true);
  const doneGroup: ListGroup = {
    key: 'done',
    title: null,
    titleKey: allSimulated ? 'today.group.doneSimulated' : 'today.group.done',
    hint: null,
    rows: doneItems.map((item) => ({ item, done: true, simulatedLabel: !allSimulated && done[item.id]?.simulated === true })),
  };
  return [...open, doneGroup];
}
