import { describe, expect, it } from 'vitest';

import { meanRisk } from '@/engine/mean-risk';

describe('meanRisk', () => {
  it('산술평균', () => {
    expect(meanRisk([0.2, 0.4, 0.6])).toBeCloseTo(0.4, 12);
    expect(meanRisk([0.5])).toBe(0.5);
    expect(meanRisk([0, 1])).toBe(0.5);
  });
  it('빈 목록은 null', () => {
    expect(meanRisk([])).toBeNull();
  });
  it('유한수가 아니거나 0~1 밖이면 null', () => {
    expect(meanRisk([0.1, NaN])).toBeNull();
    expect(meanRisk([Infinity])).toBeNull();
    expect(meanRisk([-0.1, 0.3])).toBeNull();
    expect(meanRisk([1.2])).toBeNull();
  });
  it('결정론 + 입력 불변', () => {
    const xs = [0.3, 0.1, 0.2];
    expect(meanRisk(xs)).toBe(meanRisk(xs));
    expect(xs).toEqual([0.3, 0.1, 0.2]);
  });
});
