/**
 * 짧은 날짜 표시 (`YYYY-MM-DD…` → "Oct 30"). **표시만 바꾼다** — 날짜를 계산하지 않는다.
 * 대화 날짜(`cases/model.ts`)와 칩 안의 날짜(`cases/reply-model.ts`, T068 재시도 4번)가 함께 쓴다.
 * 순수 함수라 브라우저 묶음에도 들어간다. 날짜 꼴이 아니면 받은 그대로. 시간대 영향 없이 UTC로 읽는다.
 */
export function shortDate(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (match === null) return ymd;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(date);
}
