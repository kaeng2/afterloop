/**
 * PayPal activity 서랍의 기록 꼴과 화면 줄 만들기 (T064). 서버·브라우저 어디서나 import할 수 있다 (순수).
 *
 * 기록(`ActivityRecord`)은 서버 메모리에만 있다 (`_server/activity.ts`). 기록에 남기는 것은 제목 키, 메서드,
 * 경로(쿼리 문자열 없음), 응답 코드, 시각, 한 줄 요약(코드가 센 건수·주문 키), cached / simulated 표시뿐이다.
 * 요청·응답 본문, 토큰, 비밀값, 구매자 개인정보는 기록 꼴에 칸이 없다.
 *
 * 화면 줄(`ActivityRow`)은 기록을 문구(`activity.*`)로 옮긴 것이다. 잇달아 일어난 같은 묶음 읽기는 한 줄로 접는다:
 *  - 분쟁 목록 읽기 바로 뒤의 분쟁 상세 읽기 → 목록 줄 하나 ("Read your open cases · N cases")
 *  - 잇단 주문 읽기 → 한 줄 ("Read order" · 주문 키들)
 *  - 쓰기 바로 앞에서 같은 대상을 읽은 것(추적 등록 전 주문 확인, 실제 전송 전 분쟁 다시 읽기) → 그 쓰기 줄에 붙인다
 * 접어도 호출 수(`calls`)는 그대로 센다. 위쪽 막대 건수 = 보이는 기록 수 = 줄의 `calls` 합.
 */
import { t } from './copy';

export type ActivityTitleKey =
  | 'readCases'
  | 'readCase'
  | 'sendMessage'
  | 'sendOffer'
  | 'addTracking'
  | 'readOrder'
  | 'readSales'
  | 'other';

export type ActivitySummary =
  | { kind: 'cases'; count: number }
  | { kind: 'transactions'; count: number }
  | { kind: 'order'; orderKey: string };

/** 서버 메모리에 남는 기록 한 줄. 본문·토큰·쿼리 문자열·개인정보 칸이 없다. */
export type ActivityRecord = {
  id: string;
  /** ISO 시각 */
  at: string;
  method: string;
  /** 쿼리 문자열·조각을 뗀 경로 */
  path: string;
  title: ActivityTitleKey;
  /** `readCase`의 짧은 분쟁 번호 */
  shortId?: string;
  /** 응답 코드. 응답을 받지 못했으면(네트워크 오류) null. 가짜 전송이면 null */
  status: number | null;
  summary?: ActivitySummary;
  /** 거래 조회를 캐시에서 준 값 (PayPal 호출 없음) */
  cached: boolean;
  /** 가짜 전송 (PayPal로 나가지 않았다) */
  simulated: boolean;
};

export type ActivityTone = 'ok' | 'bad' | 'none';

/** 서랍에 보이는 줄 한 개 (글자는 모두 문구 파일에서). */
export type ActivityRow = {
  id: string;
  title: string;
  /** 배지 글자: 응답 코드, 가짜 전송이면 "Simulated · not sent", 응답 없음이면 "No response" */
  badge: string;
  tone: ActivityTone;
  /** "METHOD /path" */
  request: string;
  time: string;
  summary: string | null;
  cached: boolean;
  simulated: boolean;
  /** 이 줄에 접힌 호출 수 (1 이상) */
  calls: number;
};

export type ActivityView = { count: number; rows: ActivityRow[] };

const isRead = (r: ActivityRecord) => r.method === 'GET';
const ok2xx = (r: ActivityRecord) => r.status !== null && r.status >= 200 && r.status < 300;

type Group = { head: ActivityRecord; last: ActivityRecord; calls: number; orderKeys: string[] };

function groupRecords(chronological: ActivityRecord[]): Group[] {
  // 1. 쓰기 바로 앞의 같은 대상 읽기는 그 쓰기에 붙인다
  const attachedTo = new Map<number, number>();
  chronological.forEach((record, i) => {
    const next = chronological[i + 1];
    if (next === undefined || !isRead(record) || isRead(next) || next.simulated) return;
    if ((record.title === 'readOrder' || record.title === 'readCase') && next.path.startsWith(`${record.path}/`)) {
      attachedTo.set(i, i + 1);
    }
  });

  const groups: Group[] = [];
  const extraCalls = new Map<number, number>();
  for (const [, writeIndex] of attachedTo) extraCalls.set(writeIndex, (extraCalls.get(writeIndex) ?? 0) + 1);

  chronological.forEach((record, i) => {
    if (attachedTo.has(i)) return;
    const prev = groups[groups.length - 1];
    const calls = 1 + (extraCalls.get(i) ?? 0);
    const orderKeys = record.summary?.kind === 'order' ? [record.summary.orderKey] : [];

    if (prev !== undefined && isRead(record) && isRead(prev.last) && ok2xx(record) && ok2xx(prev.last) && !record.cached) {
      const caseFamily = record.title === 'readCase' && (prev.head.title === 'readCases' || prev.head.title === 'readCase');
      const orderFamily = record.title === 'readOrder' && prev.head.title === 'readOrder';
      if (caseFamily || orderFamily) {
        prev.last = record;
        prev.calls += calls;
        for (const key of orderKeys) if (!prev.orderKeys.includes(key)) prev.orderKeys.push(key);
        return;
      }
    }
    groups.push({ head: record, last: record, calls, orderKeys });
  });
  return groups;
}

function titleOf(group: Group): string {
  const { head } = group;
  if (head.title === 'readCase') {
    return group.calls > 1 ? t('activity.title.readCaseMany', { count: group.calls }) : t('activity.title.readCase', { id: head.shortId ?? '' });
  }
  return t(`activity.title.${head.title}`);
}

function summaryOf(group: Group): string | null {
  const s = group.head.summary;
  if (group.orderKeys.length > 0) return group.orderKeys.join(', ');
  if (s === undefined) return null;
  if (s.kind === 'cases') return t('activity.summary.cases', { count: s.count });
  if (s.kind === 'transactions') return t('activity.summary.transactions', { count: s.count });
  return s.orderKey;
}

function badgeOf(record: ActivityRecord): { badge: string; tone: ActivityTone } {
  if (record.simulated) return { badge: t('activity.simulated'), tone: 'none' };
  if (record.status === null) return { badge: t('activity.noResponse'), tone: 'bad' };
  return { badge: String(record.status), tone: ok2xx(record) ? 'ok' : 'bad' };
}

/** 판매자 시간대의 시각 (예: "3:04:05 PM"). */
export function formatActivityTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(date);
}

/**
 * 기록(최신이 앞) → 서랍 줄(최신이 위). 같은 입력이면 같은 결과.
 * 줄의 응답 코드·시각은 그 줄의 **마지막** 호출 것이다 (쓰기 줄은 쓰기 자신의 것).
 */
export function buildActivityView(newestFirst: readonly ActivityRecord[], timeZone: string = t('today.sellerTimeZone')): ActivityView {
  const groups = groupRecords([...newestFirst].reverse());
  const rows = groups
    .map((group): ActivityRow => {
      const shown = isRead(group.head) ? group.last : group.head;
      const { badge, tone } = badgeOf(shown);
      return {
        id: group.head.id,
        title: titleOf(group),
        badge,
        tone,
        request: `${group.head.method} ${group.head.path}`,
        time: formatActivityTime(shown.at, timeZone),
        summary: summaryOf(group),
        cached: group.head.cached,
        simulated: group.head.simulated,
        calls: group.calls,
      };
    })
    .reverse();
  return { count: rows.reduce((sum, row) => sum + row.calls, 0), rows };
}
