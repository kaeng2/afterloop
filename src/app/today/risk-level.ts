/**
 * 위험 단계 기준 (T122d, 시안 v6 `riskLvl(p) = p >= 45 ? 'high' : p >= 20 ? 'med' : 'low'`, riskTip "High 45%+").
 * 기준값은 `config/motion.json` `desk.riskLevel`(컨트롤 타워 2026-11-12)에서만 읽는다.
 *
 * 목록 위험 % 칩 · All products 표(막대·`.hi` 줄) · 사례 위험 상자 "지금 %" 글자색이 같은 기준을 쓴다.
 * (알약·입력칸 테두리 빨강은 따로 `desk.riskColor` — `../_shared/motion.ts` `riskTone`.)
 *
 * 확률 값(엔진)을 바꾸지 않고 단계만 고른다. 브라우저 묶음에 들어가도 되는 값만 있다.
 */
import { z } from 'zod';

import motionJson from '../../../config/motion.json';

export type RiskLevel = 'high' | 'med' | 'low';

const RiskLevelSchema = z
  .object({ highFrom: z.number().min(0).max(1), midFrom: z.number().min(0).max(1) })
  .refine((value) => value.midFrom <= value.highFrom, { message: 'midFrom must not exceed highFrom' });

export type RiskLevelConfig = z.infer<typeof RiskLevelSchema>;

let cached: RiskLevelConfig | null = null;

/** 설정을 검사해 읽는다 (틀리면 예외). `raw`는 `config/motion.json` 통째 (시험용). */
export function loadRiskLevel(raw?: unknown): RiskLevelConfig {
  const pick = (json: unknown) =>
    RiskLevelSchema.parse((json as { desk?: { riskLevel?: unknown } } | null)?.desk?.riskLevel);
  if (raw !== undefined) return pick(raw);
  cached ??= pick(motionJson);
  return cached;
}

/** 단계: `p >= highFrom` → high, `p >= midFrom` → med, 그 밖 → low. */
export function riskLevelOf(p: number, config: RiskLevelConfig = loadRiskLevel()): RiskLevel {
  return p >= config.highFrom ? 'high' : p >= config.midFrom ? 'med' : 'low';
}

/** 사례 화면 글자색 단계 이름(`high`·`mid`·`low`)으로 — 위험 상자 "지금 %" (`data-tone`). */
export function riskLevelTone(p: number, config: RiskLevelConfig = loadRiskLevel()): 'high' | 'mid' | 'low' {
  const level = riskLevelOf(p, config);
  return level === 'med' ? 'mid' : level;
}
