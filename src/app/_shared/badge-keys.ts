/**
 * 배지 종류와 문구 키 (T047). 그리지 않는 부분만 떼어 둔 파일이다
 * (`badges.tsx`가 가져다 쓰고, 단위 테스트는 이 파일을 부른다).
 */
import type { EscalationRisk } from '@/types';

/** 배지 종류. `globals.css`의 `.badge-*` 클래스 이름과 1:1이다. */
export type BadgeTone = 'demo' | 'assumption' | 'ai' | 'code' | 'risk-low' | 'risk-watch' | 'risk-high';

/** 위험 구간 → 배지 문구 키와 색. 구간은 엔진(`escalationRisk`)이 정한 값을 옮기기만 한다. */
export const RISK_BADGE: Record<EscalationRisk['band'], { copyKey: string; tone: BadgeTone }> = {
  Low: { copyKey: 'badge.riskLow', tone: 'risk-low' },
  Watch: { copyKey: 'badge.riskWatch', tone: 'risk-watch' },
  High: { copyKey: 'badge.riskHigh', tone: 'risk-high' },
};

/** 이 작업이 쓰는 배지 문구 키 전부 (문구 파일 정적 검사용). */
export const BADGE_COPY_KEYS: readonly string[] = [
  'badge.demo',
  'badge.assumption',
  'badge.aiSuggests',
  'badge.codeDecides',
  ...Object.values(RISK_BADGE).map((badge) => badge.copyKey),
];
