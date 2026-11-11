/** T081 재시도: `/lang?next=` 열린 리다이렉트 방지 — 모두 같은 사이트 경로로만 간다. */
import { describe, expect, it } from 'vitest';

import { safeNext } from '@/app/_server/safe-next';

const BASE = 'http://localhost:3000/lang?set=ko';

describe('safeNext', () => {
  it.each([
    ['/\\evil.com'],
    ['/\t/evil.com'],
    ['/ /evil.com'],
    ['//evil.com'],
    ['https://evil.com'],
    ['javascript:alert(1)'],
    ['\\\\evil.com'],
    ['/\n/evil.com'],
    [''],
    [null],
  ])('거부 %j → /', (next) => {
    expect(safeNext(next as string | null, BASE)).toBe('/');
  });

  it('같은 사이트 경로는 pathname+search로', () => {
    expect(safeNext('/products?x=1', BASE)).toBe('/products?x=1');
    expect(safeNext('/', BASE)).toBe('/');
  });

  it('결과는 언제나 한 개의 / 로 시작하고 origin이 같다', () => {
    for (const n of ['/%09/evil.com', '/%5Cevil.com', '/a/../../evil.com', '/%2F/evil.com']) {
      const out = safeNext(n, BASE);
      expect(new URL(out, BASE).origin).toBe('http://localhost:3000');
      expect(out.startsWith('//')).toBe(false);
    }
  });
});
