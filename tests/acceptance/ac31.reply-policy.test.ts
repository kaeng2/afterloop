/**
 * 인수 테스트 AC31: 답장 초안 정책 — 날짜의 뜻과 허용한 약속 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: SPEC v2.7 3장 "날짜의 뜻", "정책 밖 약속 막기" / 사람 결정 2026-11-10
 * 데이터만 본다 (코드 없음): config/rules.json의 `reply`, 고정 사본 rules.fixture.json
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ReplyCommitment, ReplyDraftPolicy, ReplyPolicy } from '@/types';

import rulesFixture from './rules.fixture.json';

const ROOT = path.resolve(__dirname, '../..');
type ReplyConfig = ReplyPolicy & ReplyDraftPolicy;
const live = (JSON.parse(readFileSync(path.join(ROOT, 'config/rules.json'), 'utf8')) as { reply: ReplyConfig }).reply;
const fixture = (rulesFixture as unknown as { reply: ReplyConfig }).reply;

const SUBTYPES = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'B5', 'C1', 'C2', 'C3', 'D1', 'E1', 'F1', 'F2'];
/** 돈이 드는 약속 낱말 (SPEC 3장: 재발송·환불·할인·무료 배송·보상). 허용한 약속의 글에 있으면 안 된다 */
const MONEY_WORDS = /refund|reship|re-ship|resend|re-send|replace|replacement|discount|coupon|free shipping|compensat|store credit|money back/i;

for (const [name, reply] of [
  ['config/rules.json', live],
  ['rules.fixture.json', fixture],
] as const) {
  describe(`AC31 답장 초안 정책 (${name})`, () => {
    it('날짜의 뜻: 한 줄이고, "다시 확인해서 연락하는 날"이며 도착 예상일이 아니라고 적혀 있다', () => {
      const m = reply.followUpDateMeaning;
      expect(typeof m).toBe('string');
      expect(m.trim().length).toBeGreaterThan(20);
      expect(m).not.toMatch(/[\r\n]/);
      expect(m).toMatch(/check/i);
      expect(m).toMatch(/contact the buyer again/i);
      expect(m).toMatch(/not a delivery date/i);
      expect(m).not.toMatch(/\d/); // 날짜·금액 값을 적지 않는다
    });

    it('허용한 약속: 모양이 계약과 같고 id가 겹치지 않으며 세부 유형이 16개 중 하나다', () => {
      const list: ReplyCommitment[] = reply.allowedCommitments;
      expect(Array.isArray(list)).toBe(true);
      expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
      for (const c of list) {
        expect(c.id, c.id).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(c.text.trim().length, c.id).toBeGreaterThan(10);
        expect(c.text, c.id).not.toMatch(/[\r\n]/);
        expect(c.subtypes.length, c.id).toBeGreaterThan(0);
        for (const s of c.subtypes) expect(SUBTYPES, `${c.id}: ${s}`).toContain(s);
      }
    });

    it('허용한 약속의 글에 돈이 드는 약속·날짜·금액이 없다', () => {
      for (const c of reply.allowedCommitments) {
        expect(c.text, c.id).not.toMatch(MONEY_WORDS);
        expect(c.text, c.id).not.toMatch(/\d/);
        expect(c.text, c.id).not.toMatch(/\$|⟦|\{\{/);
      }
    });

    it('통관 보류(A2)에 허용한 약속은 두 가지다: 통관부호를 운송사에 전달, 운송사에 직접 확인', () => {
      const a2 = reply.allowedCommitments.filter((c) => c.subtypes.includes('A2'));
      expect(a2.map((c) => c.id).sort()).toEqual(['check_with_carrier', 'forward_customs_code']);
      const byId = (id: string) => a2.find((c) => c.id === id)!.text;
      expect(byId('forward_customs_code')).toMatch(/customs/i);
      expect(byId('forward_customs_code')).toMatch(/carrier/i);
      expect(byId('check_with_carrier')).toMatch(/carrier/i);
    });

    it('답장 후 확인 기한은 그대로 7일이다 (AC30)', () => {
      expect(reply.followUpDays).toBe(7);
    });
  });
}

describe('AC31 설정과 고정 사본이 같다', () => {
  it('날짜의 뜻과 허용한 약속이 config/rules.json과 rules.fixture.json에서 같다', () => {
    expect(live.followUpDateMeaning).toBe(fixture.followUpDateMeaning);
    expect(live.allowedCommitments).toEqual(fixture.allowedCommitments);
  });
});
