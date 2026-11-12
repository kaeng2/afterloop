/**
 * Today 오른쪽 상세 — Prevent 항목의 짧은 카드 (T099, 시안 `Desk.dc.html`의 Prevent(kc) 항목 모양 → T106 zone-work 틀).
 * 머리(목록 줄 그대로) + 카드: 제목 + 한 줄 설명 + 처방별 절감 몇 줄. **계산하지 않는다**: 손실은 엔진 `pickPreventProduct`,
 * 절감은 `fixSavings`(`PreventDetail`에 담겨 온 센트 값)을 달러로 바꿔 보일 뿐이다. 버튼이 없다 — PayPal·AI를 부르거나
 * 쓰는 것이 없다 (공개 모드 쓰기 0). AI가 만든 글이 아니라 AI 알약을 달지 않는다. `/products`로 가는 링크도 없다
 * (진입점 결정 2026-11-11).
 */
import { Badge } from '../_shared/badges';
import { t } from '../_shared/copy';
import { toDollarsRounded } from '../_shared/money';
import type { PreventDetail, TodayRowView } from './model';
import { WorkCard, WorkDetail } from './work-card';

export function PreventCard({ detail, row = null }: { detail: PreventDetail; row?: TodayRowView | null }) {
  return (
    <WorkDetail row={row} className="prevent-card">
      <WorkCard
        titleId="prevent-title"
        ai={false}
        title={t('today.prevent.title', { name: detail.name })}
        body={
          <>
            {t('today.prevent.body', {
              stock: detail.stock,
              before: toDollarsRounded(detail.beforeCents),
              after: toDollarsRounded(detail.afterCents),
              percent: detail.cutPercent,
            })}{' '}
            <Badge kind="assumption" />
          </>
        }
      >
        {detail.fixes.length === 0 ? null : (
          <div className="prevent-fixes-block">
            <h4 className="small muted">{t('today.prevent.fixesLabel')}</h4>
            <ul className="prevent-fixes">
              {detail.fixes.map((fix) => (
                <li key={fix.fix} className="prevent-fix">
                  <span>{t(`product.fix.${fix.fix}.title`)}</span>
                  <span className="num muted">
                    {t('today.prevent.fixSaving', { amount: toDollarsRounded(fix.savingCents) })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </WorkCard>
      <p className="small muted">{t('today.prevent.note')}</p>
    </WorkDetail>
  );
}
