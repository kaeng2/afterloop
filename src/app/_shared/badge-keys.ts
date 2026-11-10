/**
 * 배지 종류·모양·문구 키 (T047 보완 B-4·B-5). 그리지 않는 부분만 떼어 둔 파일이다
 * (`badges.tsx`가 가져다 쓰고, 단위 테스트는 이 파일을 부른다).
 *
 * 배지 5종은 **색이 아니라 모양으로** 구분한다: 테두리 꼴(`border`) + 앞머리 기호(`glyph`)가
 * 다섯 개 모두 서로 다르다 (흑백으로 인쇄해도 구분된다). 색은 모두 `--color-muted` 하나다.
 * 기호는 장식이다 (`aria-hidden`). 읽히는 글자는 문구 파일(`badge.*`)에서 온다.
 *
 * 위험 단계 3종은 배지와 **다른 부품**이다 (`RISK_LEVEL`). 색 + 글자 + 기호로 구분한다.
 */
import type { EscalationRisk } from '@/types';

export type BadgeKind = 'aiSuggests' | 'codeDecides' | 'demo' | 'assumption' | 'cached';

/** `globals.css`의 `.badge-border-*` 클래스 이름과 1:1. */
export type BadgeBorder = 'solid' | 'dashed' | 'dotted' | 'fill' | 'none';

export type BadgeSpec = {
  /** 배지 글자 (`badge.*`). */
  copyKey: string;
  /** 언제 쓰는지 한 줄 (`badge.hint.*`). 견본 화면과 `title`에 쓴다. */
  hintKey: string;
  border: BadgeBorder;
  glyph: string;
};

export const BADGES: Record<BadgeKind, BadgeSpec> = {
  aiSuggests: { copyKey: 'badge.aiSuggests', hintKey: 'badge.hint.aiSuggests', border: 'dashed', glyph: '◇' },
  codeDecides: { copyKey: 'badge.codeDecides', hintKey: 'badge.hint.codeDecides', border: 'solid', glyph: '=' },
  demo: { copyKey: 'badge.demo', hintKey: 'badge.hint.demo', border: 'fill', glyph: '◌' },
  assumption: { copyKey: 'badge.assumption', hintKey: 'badge.hint.assumption', border: 'dotted', glyph: '≈' },
  cached: { copyKey: 'badge.cached', hintKey: 'badge.hint.cached', border: 'none', glyph: '↺' },
};

/** 견본 화면이 늘어놓는 순서. */
export const BADGE_ORDER: readonly BadgeKind[] = ['aiSuggests', 'codeDecides', 'demo', 'assumption', 'cached'];

export type RiskBand = EscalationRisk['band'];

/** 위험 단계 → 문구 키·클래스·기호. 단계는 엔진(`escalationRisk`)이 정한 값을 옮기기만 한다. */
export const RISK_LEVEL: Record<RiskBand, { copyKey: string; className: string; mark: string }> = {
  High: { copyKey: 'badge.riskHigh', className: 'risk-high', mark: '▲' },
  Watch: { copyKey: 'badge.riskWatch', className: 'risk-watch', mark: '◆' },
  Low: { copyKey: 'badge.riskLow', className: 'risk-low', mark: '●' },
};

export const RISK_ORDER: readonly RiskBand[] = ['High', 'Watch', 'Low'];

/** 배지 5 + 위험 3 = 문구 키 8개 (문구 파일 정적 검사용). */
export const BADGE_COPY_KEYS: readonly string[] = [
  ...BADGE_ORDER.map((kind) => BADGES[kind].copyKey),
  ...RISK_ORDER.map((band) => RISK_LEVEL[band].copyKey),
];

/** 배지 설명 문구 키 5개. */
export const BADGE_HINT_KEYS: readonly string[] = BADGE_ORDER.map((kind) => BADGES[kind].hintKey);
