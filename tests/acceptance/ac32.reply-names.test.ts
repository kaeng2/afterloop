/**
 * AC32 답장 이름 (SPEC v2.9 3장 "이름 토큰", 사람 결정 2026-11-10)
 * 데이터만 본다 (코드 없음): config/rules.json의 `reply.names`
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ReplyNames } from '@/types';

const ROOT = path.resolve(__dirname, '../..');
const names = (JSON.parse(readFileSync(path.join(ROOT, 'config/rules.json'), 'utf8')) as { reply: { names: ReplyNames } }).reply.names;

describe('AC32 답장 이름', () => {
  it('판매자 서명은 "Hannah, Fernwood Knits"', () => {
    expect(names.sellerSignature).toBe('Hannah, Fernwood Knits');
  });
  it('서연(B01)은 영어 "Seo-yeon", 한국어 "서연 님" / 지호(B02)는 "Ji-ho", "지호 님"', () => {
    expect(names.buyers.B01).toEqual({ en: 'Seo-yeon', ko: '서연 님' });
    expect(names.buyers.B02).toEqual({ en: 'Ji-ho', ko: '지호 님' });
  });
  it('buyer_m(B04)처럼 표에 없는 구매자는 이름이 없다 (마스킹된 아이디를 이름으로 쓰지 않는다)', () => {
    expect(names.buyers.B04).toBeUndefined();
    for (const forms of Object.values(names.buyers)) {
      for (const v of Object.values(forms)) {
        expect(v).not.toMatch(/\*|⟦|⟧|\{\{/);
        expect(v.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
