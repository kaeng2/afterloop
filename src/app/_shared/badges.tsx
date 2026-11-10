/**
 * 배지 5종 + 위험 단계 (T047 보완 B-4·B-5, SPEC 3·9-4·10장).
 *
 * 배지 (작고 조용하게. 색이 아니라 테두리 꼴 + 앞머리 기호로 구분 — `badge-keys.ts`):
 * - `AI suggests` ◇ 점선(긴) 테두리: AI가 낸 제안 (SPEC 3장)
 * - `Code decides` = 실선 테두리: 코드가 낸 판정 (SPEC 3장)
 * - `Demo data` ◌ 옅은 바탕: 시드·시연용 값 (SPEC 10장)
 * - `Assumption` ≈ 점 테두리: 가정값에서 나온 숫자 (`config/params.json`의 `source`)
 * - `cached` ↺ 테두리 없음: 캐시에서 읽은 값 (SPEC 9-4장)
 *
 * 위험 단계 `High` / `Watch` / `Low`는 배지와 다른 부품이다 (`RiskLevel`). 색 + 글자 + 기호.
 *
 * 글자는 모두 `badge.*` 문구에서 읽는다. 이 파일은 **판정하지 않는다** — 어느 배지를 붙일지는
 * 부르는 화면이 엔진·연결 표 값으로 정한다.
 */
import { BADGES, RISK_LEVEL, type BadgeKind, type RiskBand } from './badge-keys';
import { t } from './copy';

/** 배지 하나. `title`을 주지 않으면 "언제 쓰는지" 설명이 붙는다. */
export function Badge({ kind, title }: { kind: BadgeKind; title?: string }) {
  const spec = BADGES[kind];
  return (
    <span className={`badge badge-border-${spec.border}`} title={title ?? t(spec.hintKey)}>
      <span className="badge-glyph" aria-hidden="true">
        {spec.glyph}
      </span>
      {t(spec.copyKey)}
    </span>
  );
}

/** 시드·시연용 데이터. `fields`를 주면 어느 값이 시연용인지 설명으로 덧붙인다. */
export function DemoBadge({ fields }: { fields?: readonly string[] }) {
  const note =
    fields === undefined || fields.length === 0 ? undefined : t('common.demoFields', { fields: fields.join(', ') });
  return <Badge kind="demo" title={note} />;
}

/** 가정값에서 나온 숫자 (기대 손실·절감액 등). `source`를 주면 설명으로 붙인다. */
export function AssumptionBadge({ source }: { source?: string }) {
  return <Badge kind="assumption" title={source} />;
}

/** AI가 낸 제안. */
export function AiSuggestsBadge() {
  return <Badge kind="aiSuggests" />;
}

/** 코드가 낸 판정. */
export function CodeDecidesBadge() {
  return <Badge kind="codeDecides" />;
}

/** 캐시에서 읽은 값 (SPEC 9-4장). */
export function CachedBadge({ title }: { title?: string }) {
  return <Badge kind="cached" title={title} />;
}

/** 확대 위험 단계. `band`는 `src/engine/escalation.ts`가 정한 값이다. */
export function RiskLevel({ band, title }: { band: RiskBand; title?: string }) {
  const level = RISK_LEVEL[band];
  return (
    <span className={`risk ${level.className}`} title={title}>
      <span className="risk-mark" aria-hidden="true">
        {level.mark}
      </span>
      {t(level.copyKey)}
    </span>
  );
}

/** 1차 이름 (호환용). 새 코드는 `RiskLevel`을 쓴다. */
export const RiskBandBadge = RiskLevel;
