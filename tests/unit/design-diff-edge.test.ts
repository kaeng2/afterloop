import { describe, expect, it } from 'vitest';
import { compareStyles, normalizeEdge } from '../../scripts/design-diff/compare';
import type { ElementSnap } from '../../scripts/design-diff/types';

const el = (styles: Record<string, string>): ElementSnap =>
  ({ key: 'div|x', role: '', text: 'x', tag: 'div', matches: [], styles }) as unknown as ElementSnap;

describe('design-diff 테두리·outline 소음 제거', () => {
  it('두께 0 또는 style none이면 모두 none', () => {
    expect(normalizeEdge('0px none rgb(0, 0, 0)')).toBe('none');
    expect(normalizeEdge('0px solid rgb(255, 0, 0)')).toBe('none');
    expect(normalizeEdge('2px none rgb(1, 2, 3)')).toBe('none');
    expect(normalizeEdge('1px solid rgb(1, 2, 3)')).toBe('1px solid rgb(1, 2, 3)');
  });
  it('안 보이는 변은 색·스타일이 달라도 차이 아님', () => {
    for (const prop of ['border-top', 'border-left', 'outline']) {
      const d = compareStyles('s', 1, [el({ [prop]: '0px none rgb(0, 0, 0)' })], [el({ [prop]: '0px solid rgb(9, 9, 9)' })]);
      expect(d).toEqual([]);
    }
  });
  it('보이는 테두리의 색 차이는 여전히 차이', () => {
    const d = compareStyles('s', 1, [el({ 'border-top': '1px solid rgb(1, 1, 1)' })], [el({ 'border-top': '1px solid rgb(2, 2, 2)' })]);
    expect(d).toHaveLength(1);
    const e = compareStyles('s', 1, [el({ outline: '2px solid rgb(1, 1, 1)' })], [el({ outline: '0px none rgb(0, 0, 0)' })]);
    expect(e).toHaveLength(1);
  });
});
