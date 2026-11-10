/**
 * 단위 테스트: followUpDate·replyFacts (SPEC v2.5 3장). 작업 T044.
 * 인수 테스트(AC30)가 보는 날짜 계산 말고, 잘못된 입력 예외·정책 거부·토큰 글자·시간대 표기·
 * 윤년·입력 불변을 본다.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { FOLLOW_UP_DATE_TOKEN, followUpDate, parseUtcInstant, replyFacts } from '@/engine/followup';
import type { ReplyPolicy } from '@/types';

/** 시연 시점 (SPEC 7장) */
const NOW = '2026-11-10T17:00:00Z';
/** 실제 서연 분쟁 D2의 응답 기한 */
const SEOYEON_DUE = '2026-11-30T00:37:46.766Z';
const POLICY: ReplyPolicy = { followUpDays: 7 };

describe('AC30의 경우 (정본은 tests/acceptance/ac30.followup.test.ts)', () => {
  it('서연: 11/10 + 7일 = 2026-11-17', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: SEOYEON_DUE }, POLICY)).toBe('2026-11-17');
  });

  it('기한보다 늦으면 하루 전, 같은 날이면 그대로, 오늘보다 앞서지는 않는다', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-15T10:00:00Z' }, POLICY)).toBe('2026-11-14');
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-17T23:59:59Z' }, POLICY)).toBe('2026-11-17');
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-11T00:00:00Z' }, POLICY)).toBe('2026-11-10');
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-01-02T00:00:00Z' }, POLICY)).toBe('2026-11-10');
  });

  it('기한이 없으면 당기지 않는다', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '' }, POLICY)).toBe('2026-11-17');
  });

  it('정책을 안 주면 config/rules.json의 reply (7일)', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '' })).toBe('2026-11-17');
  });
});

describe('날짜 계산 (UTC만 쓴다)', () => {
  it('날짜만 주면 그날 00:00 UTC로 본다', () => {
    expect(followUpDate({ now: '2026-11-10', disputeDueDate: '' }, POLICY)).toBe('2026-11-17');
  });

  it('하루의 양 끝에서 날짜가 같다 (로컬 시간대를 쓰지 않는다)', () => {
    expect(followUpDate({ now: '2026-11-10T00:00:00Z', disputeDueDate: '' }, POLICY)).toBe('2026-11-17');
    expect(followUpDate({ now: '2026-11-10T23:59:59.999Z', disputeDueDate: '' }, POLICY)).toBe('2026-11-17');
  });

  it('시간대 표기를 UTC로 옮긴다 (+09:00의 11/11 02:00은 UTC 11/10)', () => {
    expect(followUpDate({ now: '2026-11-11T02:00:00+09:00', disputeDueDate: '' }, POLICY)).toBe('2026-11-17');
    expect(followUpDate({ now: '2026-11-10T20:00:00-09:00', disputeDueDate: '' }, POLICY)).toBe('2026-11-18');
    expect(followUpDate({ now: '2026-11-11T02:00:00+0900', disputeDueDate: '' }, POLICY)).toBe('2026-11-17');
  });

  it('시간대 표기가 없는 시각도 UTC로 본다', () => {
    expect(followUpDate({ now: '2026-11-10T17:00:00', disputeDueDate: '' }, POLICY)).toBe('2026-11-17');
  });

  it('달·해가 바뀌어도 맞다', () => {
    expect(followUpDate({ now: '2026-11-27T23:30:00Z', disputeDueDate: '' }, POLICY)).toBe('2026-12-04');
    expect(followUpDate({ now: '2026-12-28T00:10:00Z', disputeDueDate: '' }, POLICY)).toBe('2027-01-04');
  });

  it('윤년 2월을 지나도 맞다 (2028-02-25 + 7일)', () => {
    expect(followUpDate({ now: '2028-02-25T12:00:00Z', disputeDueDate: '' }, POLICY)).toBe('2028-03-03');
    expect(followUpDate({ now: '2027-02-25T12:00:00Z', disputeDueDate: '' }, POLICY)).toBe('2027-03-04');
  });

  it('기한을 날짜로만 줘도 그날 00:00 UTC 기준으로 당긴다', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-15' }, POLICY)).toBe('2026-11-14');
    expect(followUpDate({ now: NOW, disputeDueDate: '2026-11-17' }, POLICY)).toBe('2026-11-17');
  });

  it('같은 입력으로 100번 계산해도 같다', () => {
    const answers = new Set<string>();
    for (let i = 0; i < 100; i++) answers.add(followUpDate({ now: NOW, disputeDueDate: SEOYEON_DUE }, POLICY));
    expect([...answers]).toEqual(['2026-11-17']);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const input = { now: NOW, disputeDueDate: SEOYEON_DUE };
    const policy: ReplyPolicy = { followUpDays: 7 };
    followUpDate(input, policy);
    expect(input).toEqual({ now: NOW, disputeDueDate: SEOYEON_DUE });
    expect(policy).toEqual({ followUpDays: 7 });
  });
});

describe('잘못된 입력은 예외', () => {
  it('now가 날짜가 아니면 예외', () => {
    for (const now of ['', 'tomorrow', '2026-11', '11/10/2026', '2026-11-10T17:00:00Z ', 'Nov 10 2026']) {
      expect(() => followUpDate({ now, disputeDueDate: '' }, POLICY)).toThrow();
    }
  });

  it('없는 날짜는 예외', () => {
    for (const now of ['2026-02-30', '2026-13-01', '2026-11-00', '2027-02-29']) {
      expect(() => followUpDate({ now, disputeDueDate: '' }, POLICY)).toThrow();
    }
  });

  it('범위를 넘는 시각·시간대는 예외', () => {
    expect(() => followUpDate({ now: '2026-11-10T24:00:00Z', disputeDueDate: '' }, POLICY)).toThrow();
    expect(() => followUpDate({ now: '2026-11-10T17:60:00Z', disputeDueDate: '' }, POLICY)).toThrow();
    expect(() => followUpDate({ now: '2026-11-10T17:00:00+24:00', disputeDueDate: '' }, POLICY)).toThrow();
  });

  it('disputeDueDate가 비어 있지 않은데 날짜가 아니면 예외', () => {
    expect(() => followUpDate({ now: NOW, disputeDueDate: 'unknown' }, POLICY)).toThrow();
    expect(() => followUpDate({ now: NOW, disputeDueDate: '2026-02-30' }, POLICY)).toThrow();
  });

  it('예외 문구에 입력값을 싣지 않는다 (어느 입력인지만 알려 준다)', () => {
    expect(() => followUpDate({ now: '2026-99-99', disputeDueDate: '' }, POLICY)).toThrow(/^now/);
    expect(() => followUpDate({ now: NOW, disputeDueDate: '2026-99-99' }, POLICY)).toThrow(/^disputeDueDate/);
  });

  it('입력이 문자열이 아니면 ZodError', () => {
    expect(() => followUpDate({ now: 20261110, disputeDueDate: '' } as unknown as { now: string; disputeDueDate: string }, POLICY)).toThrow(ZodError);
  });

  it('followUpDays가 0·음수·소수·문자열인 정책은 거부한다', () => {
    for (const followUpDays of [0, -7, 7.5, Number.NaN]) {
      expect(() => followUpDate({ now: NOW, disputeDueDate: '' }, { followUpDays })).toThrow(ZodError);
    }
    expect(() => followUpDate({ now: NOW, disputeDueDate: '' }, { followUpDays: '7' } as unknown as ReplyPolicy)).toThrow(ZodError);
  });

  it('followUpDays가 1 이상 정수면 받는다 (설정값을 코드에 박지 않는다)', () => {
    expect(followUpDate({ now: NOW, disputeDueDate: '' }, { followUpDays: 1 })).toBe('2026-11-11');
    expect(followUpDate({ now: NOW, disputeDueDate: '' }, { followUpDays: 30 })).toBe('2026-12-10');
  });
});

describe('parseUtcInstant', () => {
  it('ISO 날짜·날짜시각을 UTC 밀리초로 바꾼다', () => {
    expect(parseUtcInstant('1970-01-01', 'at')).toBe(0);
    expect(parseUtcInstant('2026-11-10T17:00:00Z', 'at')).toBe(Date.UTC(2026, 10, 10, 17, 0, 0));
    expect(parseUtcInstant('2026-11-30T00:37:46.766Z', 'at')).toBe(Date.UTC(2026, 10, 30, 0, 37, 46, 766));
    expect(parseUtcInstant('2026-11-10T02:00:00+09:00', 'at')).toBe(Date.UTC(2026, 10, 9, 17, 0, 0));
  });

  it('소수점 자리수가 달라도 밀리초 세 자리로 읽는다', () => {
    expect(parseUtcInstant('2026-11-10T00:00:00.7Z', 'at')).toBe(Date.UTC(2026, 10, 10, 0, 0, 0, 700));
    expect(parseUtcInstant('2026-11-10T00:00:00.766999Z', 'at')).toBe(Date.UTC(2026, 10, 10, 0, 0, 0, 766));
  });
});

describe('replyFacts', () => {
  it('확인 기한 날짜 하나를 DATE 토큰으로 낸다', () => {
    expect(replyFacts({ now: NOW, disputeDueDate: SEOYEON_DUE }, POLICY)).toEqual([
      { token: '⟦DATE_1⟧', kind: 'DATE', value: '2026-11-17' },
    ]);
  });

  it('기한이 가까우면 당긴 날짜가 값으로 들어간다', () => {
    expect(replyFacts({ now: NOW, disputeDueDate: '2026-11-15T10:00:00Z' }, POLICY)[0].value).toBe('2026-11-14');
  });

  it('정책을 안 주면 config/rules.json의 reply를 쓴다', () => {
    expect(replyFacts({ now: NOW, disputeDueDate: '' })[0].value).toBe('2026-11-17');
  });

  it('값은 ISO 날짜다 (src/ai/tokens.ts의 formatFact가 받는 꼴)', () => {
    expect(replyFacts({ now: NOW, disputeDueDate: '' }, POLICY)[0].value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('토큰 글자가 src/ai/tokens.ts의 토큰 문법과 같다 (⟦ U+27E6, ⟧ U+27E7)', () => {
    expect(FOLLOW_UP_DATE_TOKEN).toBe('⟦DATE_1⟧');
    expect([...FOLLOW_UP_DATE_TOKEN].map((c) => c.codePointAt(0))).toEqual([
      0x27e6, 0x44, 0x41, 0x54, 0x45, 0x5f, 0x31, 0x27e7,
    ]);
    // tokens.ts의 WELL_FORMED_TOKEN과 같은 모양 (그 파일을 import하지 않고 글자만 맞춘다)
    expect(FOLLOW_UP_DATE_TOKEN).toMatch(/^⟦(?:DATE|AMOUNT|TRACKING|CUSTOMS_STATUS)_[1-9][0-9]*⟧$/);
  });

  it('잘못된 입력은 followUpDate와 똑같이 예외', () => {
    expect(() => replyFacts({ now: 'tomorrow', disputeDueDate: '' }, POLICY)).toThrow();
  });
});
