/**
 * "Avg. dispute risk" 평균 (T122d, 시안 v6 `avgR` = 상품 줄마다 최고 위험의 평균).
 *
 * 평균은 엔진 `meanRisk`(T120d, `src/engine/mean-risk.ts`)만 낸다 — 화면 산술 금지 (DECISIONS 2026-11-12 컨트롤 타워).
 * 화면은 상품 줄마다 최고 위험(엔진 무응답 pChargeback) 목록을 넘기기만 한다 (`overview-model.ts` `topRisks`).
 */
import { meanRisk } from '@/engine/mean-risk';

export type MeanRiskFn = (values: readonly number[]) => number | null;

export const dashboardMeanRisk: MeanRiskFn = meanRisk;
