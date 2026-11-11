/**
 * T073 단위 테스트: Products 표 열 폭 설정(말줄임 없음)과 공개 모드 줄 위치. 실호출 0회.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PRODUCT_COL_MIN_WIDTH, productGridColumns } from '@/app/products/grid';

const ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

describe('T073: 열 최소 폭·말줄임 없음·공개 모드 줄', () => {
  it('세 열에 최소 폭이 있고 값 칸은 "$255 → $71"이 들어갈 폭 이상이다', () => {
    const cols = productGridColumns();
    for (const id of ['product', 'left', 'values'] as const) {
      expect(cols.find((c) => c.colId === id)?.minWidth).toBe(PRODUCT_COL_MIN_WIDTH[id]);
    }
    expect(PRODUCT_COL_MIN_WIDTH.values).toBeGreaterThanOrEqual(100);
  });

  it('말줄임 설정이 없고 상품 이름은 줄을 바꿔 보인다', () => {
    const cols = productGridColumns();
    expect(JSON.stringify(cols)).not.toMatch(/ellipsis/i);
    expect(cols.find((c) => c.colId === 'product')?.wrapText).toBe(true);
    expect(read('src/app/products/products.css')).not.toMatch(/text-overflow:\s*ellipsis/);
  });

  it('왼쪽 칸 폭은 clamp()로 준다 (고정 폭 아님)', () => {
    expect(read('src/app/products/products.css')).toMatch(/minmax\(0, clamp\(/);
  });

  it('공개 모드 줄은 위쪽 막대 안에 있고 layout 본문 앞에 따로 없다', () => {
    expect(read('src/app/layout.tsx')).not.toContain('mode-note');
    expect(read('src/app/(app)/layout.tsx')).not.toContain('mode-note');
    expect(read('src/app/_shared/top-bar.tsx')).toContain('shell-mode-note');
  });
});
