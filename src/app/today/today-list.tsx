/**
 * Today 왼쪽 칸 (T060 → T067 → T076 시안 v4). 위에서 아래로:
 *  1. "DisputeLess this week" 카드 — 계산 가능한 숫자만 (`WeeklyView`: 열린 분쟁 수 · 지킬 수 있는 돈 · AI 초안 수).
 *     예측 어댑터가 없으면 열린 분쟁 수 + 사실 한 줄만. 시드 값이 섞이면 Demo data
 *  2. 묶음 카드 세 개 (Reply needed / Prevent / Routine) — 머리 줄(이름 (N) + 한 줄 설명) + 항목 줄.
 *     T102: 이 화면에서 끝낸 항목은 맨 아래 "Done today" 묶음 (`today-groups.tsx`, 화면 상태만)
 *
 * 항목 한 줄 (시안 v4): 상품 아이콘(오른쪽 위 점 = 위험 등급) · "PP-R-… · Wool Sweater" · 범주 알약 ·
 * "Reply by Nov 30" · "Seo-yeon Kim · KR". 고른 줄은 옅은 강조색 바탕 + 왼쪽 띠.
 *
 * **계산하지 않는다** — 모든 글자·숫자는 `buildToday`·`weeklyView`(엔진 결과를 옮긴 값)에서 온다. 항목은 버튼이라서
 * 키보드로 고를 수 있고(T106, 화면 안 상태), 고른 항목에는 `aria-current`가 붙는다.
 * T106 (F1-33): 카드 아래 "Stock left could cost …" 링크 줄은 없다 (시안에 없음. /products 화면은 T114로 지웠다).
 */
import { AiPill, Badge } from '../_shared/badges';
import { t } from '../_shared/copy';
import { weeklyView, type TodayView, type WeeklyView } from './model';
import { WeeklyBumpCell } from './savings';
import { TodayGroups } from './today-groups';

// T106: 상품 거르개 줄은 화면 안 상태로 바뀌는 클라이언트 칩 (`product-filter.tsx`)
export { ProductFilterBar } from './product-filter';

/** "DisputeLess this week" 카드. 숫자는 `WeeklyView` 그대로 (없는 칸은 그리지 않는다). */
export function WeeklyCard({ weekly }: { weekly: WeeklyView }) {
  return (
    <section className="weekly" aria-labelledby="weekly-title">
      <div className="weekly-head">
        <div className="weekly-titles">
          <h2 className="weekly-title" id="weekly-title">
            {/* T124a: 시안 L147처럼 글자는 안쪽 span (`<b>{{v.dashT}}</b>` 등) */}
            <span>{t('today.weekly.title')}</span>
          </h2>
          {/* T110: Demo data(예외)는 부제 줄 끝에. 오른쪽에 두면 1440 폭에서 제목이 두 줄로 꺾이거나 배지·알약이 쌓여
              카드가 시안(L125 제목 한 줄 + 오른쪽 AI 알약 하나)보다 길어진다 */}
          <span className="weekly-sub-row">
            <span className="weekly-sub">
              <span>{t('today.weekly.sub')}</span>
            </span>
            {weekly.usesDemoData ? <Badge kind="demo" /> : null}
          </span>
        </div>
        {/* T107 시안 L125: 오른쪽 AI 알약 (그림자 없음) */}
        <span className="weekly-head-end">
          <AiPill decorative />
        </span>
      </div>
      <div className="weekly-grid">
        {/* T116 F1-35: 시안 L695-700 앞 3칸(Open·Money·Replies) 모두 끝에 한 번 깜빡인다. "+$N"은 Money 칸만 */}
        <WeeklyBumpCell className="weekly-cell" showAmount={false}>
          <span className="weekly-label">
            <span>{t('today.weekly.open')}</span>
          </span>
          <span className="weekly-value num">
            <span>{weekly.openDisputes}</span>
          </span>
          <span className="weekly-note">
            <span>{t('today.weekly.openNote')}</span>
          </span>
        </WeeklyBumpCell>
        {weekly.keepable === null ? null : (
          // T091: 액션이 끝나면 "+$N just now" (엔진 actionSavings·trackingSavings 값, 화면 상태만)
          <WeeklyBumpCell className="weekly-cell">
            <span className="weekly-label">
              <span>{t('today.weekly.keepable')}</span>
            </span>
            <span className="weekly-value num">
              <span>{weekly.keepable}</span>
            </span>
            <span className="weekly-note">
              <span>{t('today.weekly.keepableNote')}</span> <Badge kind="assumption" />
            </span>
          </WeeklyBumpCell>
        )}
        {weekly.aiDrafts === null ? null : (
          <WeeklyBumpCell className="weekly-cell" showAmount={false}>
            <span className="weekly-label">
              <span>{t('today.weekly.drafts')}</span>
            </span>
            <span className="weekly-value num">
              <span>{weekly.aiDrafts}</span>
            </span>
            <span className="weekly-note">
              <span>{t('today.weekly.draftsNote')}</span>
            </span>
          </WeeklyBumpCell>
        )}
        {weekly.keepable === null ? (
          <WeeklyBumpCell className="weekly-cell weekly-fact">
            <span className="weekly-note">
              <span>{t('today.weekly.fact')}</span>
            </span>
          </WeeklyBumpCell>
        ) : (
          <div className="weekly-cell weekly-fact">
            <span className="weekly-note">
              <span>{t('today.weekly.fact')}</span>
            </span>
          </div>
        )}
      </div>
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
      <WeeklyCard weekly={card} />

      {paypalNotice === null ? null : <p className="notice">{paypalNotice}</p>}

      <nav aria-label={t('today.listLabel')} className="today-groups">
        {view.groups.length === 0 ? <p className="small muted">{t('today.empty')}</p> : null}
        {/* T102: 묶음 카드는 클라이언트 (이 화면에서 끝낸 항목을 맨 아래 "Done today"로 옮긴다. 화면 상태만) */}
        <TodayGroups groups={view.groups} selectedId={selectedId} />
      </nav>
    </div>
  );
}
