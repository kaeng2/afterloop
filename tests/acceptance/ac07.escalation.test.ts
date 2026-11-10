/**
 * 인수 테스트 AC7 (+ AC10 확대 위험 결정론): 확대 위험 점수 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: PRD v2 10-4 + 검토 M4 / 기획자 승인 2026-11-09 + 사람 결정 2026-11-10 (Q2: 실제 분쟁 값 사용 → 6 → 3)
 * 기준: SPEC v2.3 7장. 작업: T018
 */
import { describe, expect, it } from 'vitest';

import { escalationRisk } from '@/engine/escalation';
import type { EscalationSignals } from '@/types';

import { R } from './boards';

/** 실제 분쟁 D2의 응답 기한(2026-11-30T00:37Z)은 시연 시점(11/10 17:00Z)에서 약 464시간 뒤다 → 기한 점수 0 */
const SEOYEON_HOURS_TO_DUE = 464;

/** 서연 D2 시작: 카드사 언급, 두 번째 문의 무응답, 24시간 넘게 무응답, 화난 어조, 기한까지 464시간 */
const SEOYEON_START: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: true,
  unansweredOver24h: true,
  angryTone: true,
  hoursToDue: SEOYEON_HOURS_TO_DUE,
};

/** Hannah가 답장한 뒤: 무응답 신호 사라짐, 어조는 구매자 다음 메시지까지 판정 보류 */
const SEOYEON_AFTER_REPLY: EscalationSignals = {
  mentionsCardCompany: true,
  secondMessageUnanswered: false,
  unansweredOver24h: false,
  angryTone: null,
  hoursToDue: SEOYEON_HOURS_TO_DUE,
};

// 기대값 출처: 검토 M4 / 기획자 승인 2026-11-09, 사람 결정 2026-11-10 (점수를 맞추려고 데이터를 바꾸지 않는다)
// 시작 3 + 2 + 1 + 0 = 6 (High) → 답장 후 3 + 0 + 0 + 0 = 3 (Watch)
describe('AC7 확대 위험 점수', () => {
  it('서연 시작: 6점, High', () => {
    const risk = escalationRisk(SEOYEON_START, R);
    expect(risk.score).toBe(6);
    expect(risk.band).toBe('High');
  });

  it('서연 답장 후: 3점, Watch', () => {
    const risk = escalationRisk(SEOYEON_AFTER_REPLY, R);
    expect(risk.score).toBe(3);
    expect(risk.band).toBe('Watch');
  });

  it('무응답 두 신호가 함께 있어도 +2만 더한다', () => {
    const both = escalationRisk({ ...SEOYEON_AFTER_REPLY, secondMessageUnanswered: true, unansweredOver24h: true }, R);
    const one = escalationRisk({ ...SEOYEON_AFTER_REPLY, secondMessageUnanswered: true }, R);
    expect(both.score).toBe(5);
    expect(one.score).toBe(5);
  });

  it('응답 기한이 72시간 이내면 +1: 같은 신호에 기한 48시간이면 7점', () => {
    expect(escalationRisk({ ...SEOYEON_START, hoursToDue: 48 }, R).score).toBe(7);
    expect(escalationRisk({ ...SEOYEON_START, hoursToDue: 72 }, R).score).toBe(7);
    expect(escalationRisk({ ...SEOYEON_AFTER_REPLY, hoursToDue: 48 }, R).score).toBe(4);
  });

  it('parts의 점수 합이 score와 같다', () => {
    for (const s of [SEOYEON_START, SEOYEON_AFTER_REPLY]) {
      const risk = escalationRisk(s, R);
      expect(risk.parts.reduce((sum: number, p: { points: number }) => sum + p.points, 0)).toBe(risk.score);
    }
  });
});

// 기대값 출처: SPEC v2 7장 / 기획자 승인 2026-11-09
describe('AC10 결정론 (확대 위험)', () => {
  it('같은 입력으로 100번 계산해도 결과가 같다', () => {
    const first = JSON.stringify(escalationRisk(SEOYEON_START, R));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(escalationRisk(SEOYEON_START, R))).toBe(first);
  });
});
