/**
 * 배지 (T047, SPEC v2.6 3·10장).
 *
 * - `Demo data`: 시드·시연용 데이터 줄 (SPEC 10장)
 * - `Assumption`: 가정값에서 나온 숫자 (`config/params.json`의 `source`)
 * - `AI suggests`(보라) · `Code decides`(회색): 제안과 판정을 나란히 보인다 (SPEC 3장)
 * - 위험 구간 `Low` / `Watch` / `High`: 엔진이 정한 `EscalationRisk.band`를 옮기기만 한다
 *
 * 글자는 모두 `badge.*` 문구에서 읽는다 (코드에 직접 쓰지 않는다). 색은 `globals.css`의 `.badge-*`다.
 * `cached` 배지는 T019가 생길 때 더한다 (지금 만들지 않는다).
 *
 * 이 파일은 **판정하지 않는다** — 어느 배지를 붙일지는 부르는 화면이 엔진·연결 표 값으로 정한다.
 */
import type { EscalationRisk } from '@/types';

import { RISK_BADGE, type BadgeTone } from './badge-keys';
import { t } from './copy';

type BadgeProps = { tone: BadgeTone; label: string; title?: string };

function Badge({ tone, label, title }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {label}
    </span>
  );
}

/** 시드·시연용 데이터 줄. `fields`를 주면 어느 값이 시연용인지 설명으로 덧붙인다. */
export function DemoBadge({ fields }: { fields?: readonly string[] }) {
  const note =
    fields === undefined || fields.length === 0 ? undefined : t('common.demoFields', { fields: fields.join(', ') });
  return <Badge tone="demo" label={t('badge.demo')} title={note} />;
}

/** 가정값에서 나온 숫자 (기대 손실·절감액 등). `source`를 주면 설명으로 붙인다. */
export function AssumptionBadge({ source }: { source?: string }) {
  return <Badge tone="assumption" label={t('badge.assumption')} title={source} />;
}

/** AI가 낸 제안 (보라). */
export function AiSuggestsBadge() {
  return <Badge tone="ai" label={t('badge.aiSuggests')} />;
}

/** 코드가 낸 판정 (회색). */
export function CodeDecidesBadge() {
  return <Badge tone="code" label={t('badge.codeDecides')} />;
}

/** 확대 위험 구간. `band`는 `src/engine/escalation.ts`가 정한 값이다. */
export function RiskBandBadge({ band, title }: { band: EscalationRisk['band']; title?: string }) {
  const { copyKey, tone } = RISK_BADGE[band];
  return <Badge tone={tone} label={t(copyKey)} title={title} />;
}
