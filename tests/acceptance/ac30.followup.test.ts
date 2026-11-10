/**
 * 인수 테스트 AC30: 답장 속 확인 기한 날짜 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: SPEC v2.5 3장 "답장 속 확인 기한 날짜" / 사람 승인 2026-11-10
 *   - 날짜 = 지금 날짜 + 7일. 코드가 만들고 AI는 쓰지 않는다
 *   - 만든 날짜가 그 분쟁의 PayPal 응답 기한보다 늦으면 응답 기한 하루 전으로 당긴다
 * 작업: T044 (`src/engine/followup.ts`)
 */
import { describe, expect, it } from 'vitest';

import { followUpDate } from '@/engine/followup';
import type { ReplyPolicy } from '@/types';

import rulesFixture from './rules.fixture.json';

const POLICY = (rulesFixture as unknown as { reply: ReplyPolicy }).reply; // { followUpDays: 7 }

/** 시연 시점 (SPEC 7장) */
const NOW = '2026-11-10T17:00:00Z';
/** 실제 서연 분쟁 D2의 응답 기한 */
const SEOYEON_DUE = '2026-11-30T00:37:46.766Z';

describe('AC30 답장 속 확인 기한 날짜', () => {
  it('고정 사본의 답장 후 확인 기한은 7일이다', () => {
    expect(POLICY.followUpDays).toBe(7);
  });

  it('서연: 11/10 + 7일 = 2026-11-17 (원문 예시 "by Nov 17"). 응답 기한 11/30보다 앞이라 그대로', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: SEOYEON_DUE }, POLICY)).toBe('2026-11-17');
  });

  it('만든 날짜가 응답 기한보다 늦으면 응답 기한 하루 전으로 당긴다', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-15T10:00:00Z' }, POLICY)).toBe('2026-11-14');
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-16T00:00:00Z' }, POLICY)).toBe('2026-11-15');
  });

  it('만든 날짜가 응답 기한과 같은 날이면 당기지 않는다 (늦을 때만)', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-17T23:00:00Z' }, POLICY)).toBe('2026-11-17');
  });

  it('당긴 날짜가 오늘보다 앞서지는 않는다', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-11T08:00:00Z' }, POLICY)).toBe('2026-11-10');
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-09T08:00:00Z' }, POLICY)).toBe('2026-11-10');
  });

  it('응답 기한이 없으면(빈 문자열) 당기지 않는다', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '' }, POLICY)).toBe('2026-11-17');
  });

  it('달이 바뀌어도 맞다 (UTC 날짜 기준)', () => {
    expect(followUpDate({ now: '2026-11-27T23:30:00Z', disputeDueDate: '' }, POLICY)).toBe('2026-12-04');
    expect(followUpDate({ now: '2026-12-28T00:10:00Z', disputeDueDate: '' }, POLICY)).toBe('2027-01-04');
  });

  it('정책을 주지 않으면 config/rules.json의 reply를 쓴다 (7일)', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: SEOYEON_DUE })).toBe('2026-11-17');
  });

  it('같은 입력으로 100번 계산해도 같다', () => {
    for (let i = 0; i < 100; i++) expect(followUpDate({ now: NOW, disputeDueDate: SEOYEON_DUE }, POLICY)).toBe('2026-11-17');
  });
});
