/**
 * "Avg. dispute risk" 평균 자리 (T122d, 시안 v6 `avgR` = 상품 줄마다 최고 위험의 평균).
 *
 * 평균은 엔진 `meanRisk`(T120d, `src/engine/mean-risk.ts`)만 낸다 — 화면 산술 금지 (DECISIONS 2026-11-12 컨트롤 타워).
 * 이 브랜치(lane/ui-desk)에는 T120d가 아직 병합되지 않았다 → 엔진 함수가 들어올 자리만 두고 `null`("—")을 돌려준다.
 *
 * T120d 병합 뒤 바꿀 곳은 이 파일 한 곳이다:
 *   import { meanRisk } from '@/engine/mean-risk';
 *   export const dashboardMeanRisk: MeanRiskFn = meanRisk;
 *
 * 화면은 상품 줄마다 최고 위험(엔진 무응답 pChargeback) 목록을 넘기기만 한다 (`overview-model.ts` `topRisks`).
 */
export type MeanRiskFn = (values: readonly number[]) => number | null;

/** 엔진 함수가 아직 없다 → 값 없음 ("—"). */
export const dashboardMeanRisk: MeanRiskFn = () => null;
