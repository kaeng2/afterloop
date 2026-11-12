/**
 * 위험 평균 (T120d, SPEC v2.16) — All products "Avg. dispute risk".
 * 화면이 상품 줄마다 최고 위험(엔진 값)을 모아 넘기고, 평균만 여기서 낸다.
 * 0~1 확률의 산술평균. 빈 목록 또는 유한수가 아니거나 0~1 밖인 값이 있으면 null (값을 지어내지 않는다).
 */
export function meanRisk(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return null;
    sum += v;
  }
  return sum / values.length;
}
