'use client';

/**
 * 목록 위험 % 칩 값 상자 (T122b, 시안 v6 `RISKP`·`riskLvl`·`mkItem.riskTxt`). 읽기·쓰기·계산 없음.
 *
 * - 값은 서버가 엔진에서 받아 넘긴다 (`risk-source.ts`, 무응답 `pChargeback`). 값이 오기 전·없는 항목은 칩을 그리지 않는다.
 * - 첫 화면을 늦추지 않으려고 서버는 값을 따로 흘려 보낸다: 값이 오면 `RiskValuesArrive`가 한 번 이 상자에 넣는다
 *   (같은 값이면 다시 넣지 않는다 — 렌더 루프 없음). 목록·표는 같은 자리에서 칩만 생긴다 (자식 위치를 바꾸지 않는다).
 * - 단계(높음·중간·낮음)와 색 단계는 설정 기준(`riskTone`, config/motion.json `desk.riskColor`)으로 고른다.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { riskTone } from '../_shared/motion';
import { toPercentRounded } from '../_shared/percent';

export type ListRiskValues = Readonly<Record<string, number>>;

export type RiskLevel = 'high' | 'med' | 'low';

type RiskBox = { values: ListRiskValues; put: (values: ListRiskValues) => void };

const NONE: ListRiskValues = {};
const RiskContext = createContext<RiskBox | null>(null);

export function RiskValuesProvider({ initial = NONE, children }: { initial?: ListRiskValues; children?: ReactNode }) {
  const [values, setValues] = useState<ListRiskValues>(initial);
  const put = useCallback(
    (next: ListRiskValues) => setValues((current) => (sameValues(current, next) ? current : { ...current, ...next })),
    [],
  );
  const box = useMemo<RiskBox>(() => ({ values, put }), [values, put]);
  return <RiskContext.Provider value={box}>{children}</RiskContext.Provider>;
}

function sameValues(current: ListRiskValues, next: ListRiskValues): boolean {
  return Object.entries(next).every(([id, value]) => current[id] === value);
}

/** 서버가 값을 다 받으면 그린다 (아무것도 보이지 않는다). */
export function RiskValuesArrive({ values }: { values: ListRiskValues }) {
  const box = useContext(RiskContext);
  const put = box?.put;
  useEffect(() => {
    put?.(values);
  }, [put, values]);
  return null;
}

/** 지금 받은 값 (상자 밖이면 빈 표). */
export function useRiskValues(): ListRiskValues {
  return useContext(RiskContext)?.values ?? NONE;
}

/** 단계: 설정 기준 색 단계를 그대로 (`riskTone` high → 높음, mid → 중간, low → 낮음). */
export function riskLevel(p: number): RiskLevel {
  const tone = riskTone(p);
  return tone === 'high' ? 'high' : tone === 'mid' ? 'med' : 'low';
}

/** 칩 글자 재료: "89%"와 단계 키. 표기만 (`toPercentRounded`). */
export function riskChipParts(p: number): { percent: string; level: RiskLevel; levelKey: string } {
  const level = riskLevel(p);
  return { percent: toPercentRounded(p), level, levelKey: `today.risk.level.${level}` };
}
