/**
 * 단위 테스트: escalationRisk (SPEC v2.1 7장). 작업 T018.
 * 인수 테스트(AC7)가 보는 서연 건 7점 → 4점 말고, 구간 경계·72시간 경계·어조 세 값·
 * 가중치를 바꾼 rules·잘못된 설정 예외·입력 불변을 본다.
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { escalationRisk } from '@/engine/escalation';
import { rulesFromConfig } from '@/engine/params';
import type { EscalationSignals, PolicyConfig } from '@/types';

const R: PolicyConfig = rulesFromConfig();

/** 아무 신호도 없는 상태 (기한도 멀다). */
function signals(over: Partial<EscalationSignals> = {}): EscalationSignals {
  return {
    mentionsCardCompany: false,
    secondMessageUnanswered: false,
    unansweredOver24h: false,
    angryTone: false,
    hoursToDue: 100,
    ...over,
  };
}

/** 가중치만 바꾼 rules. */
function withEscalation(over: Partial<PolicyConfig['escalation']>): PolicyConfig {
  return { ...R, escalation: { ...R.escalation, ...over } };
}

describe('신호별 점수 (SPEC 7장 표, 값은 config/rules.json)', () => {
  it('신호가 없으면 0점 Low', () => {
    const risk = escalationRisk(signals(), R);
    expect(risk.score).toBe(0);
    expect(risk.band).toBe('Low');
    expect(risk.parts.every((p) => p.points === 0)).toBe(true);
  });

  it('카드사 언급 +3, 어조 +1, 기한 임박 +1', () => {
    expect(escalationRisk(signals({ mentionsCardCompany: true }), R).score).toBe(R.escalation.cardCompanyMention);
    expect(escalationRisk(signals({ angryTone: true }), R).score).toBe(R.escalation.angryTone);
    expect(escalationRisk(signals({ hoursToDue: 10 }), R).score).toBe(R.escalation.dueWithin72h);
  });

  it('무응답 두 신호는 둘 중 하나만 더한다', () => {
    const second = escalationRisk(signals({ secondMessageUnanswered: true }), R);
    const over24h = escalationRisk(signals({ unansweredOver24h: true }), R);
    const both = escalationRisk(signals({ secondMessageUnanswered: true, unansweredOver24h: true }), R);
    expect(second.score).toBe(R.escalation.unanswered);
    expect(over24h.score).toBe(R.escalation.unanswered);
    expect(both.score).toBe(R.escalation.unanswered);
  });

  it('모든 신호가 있으면 가중치 네 개의 합', () => {
    const e = R.escalation;
    const all = signals({
      mentionsCardCompany: true,
      secondMessageUnanswered: true,
      unansweredOver24h: true,
      angryTone: true,
      hoursToDue: 0,
    });
    expect(escalationRisk(all, R).score).toBe(e.cardCompanyMention + e.unanswered + e.angryTone + e.dueWithin72h);
  });
});

describe('화난 어조 세 값 (LLM 판별)', () => {
  it('true면 +1, false와 null(판정 보류)은 0', () => {
    expect(escalationRisk(signals({ angryTone: true }), R).score).toBe(1);
    expect(escalationRisk(signals({ angryTone: false }), R).score).toBe(0);
    expect(escalationRisk(signals({ angryTone: null }), R).score).toBe(0);
  });

  it('null과 false의 결과가 완전히 같다 (판정 보류를 벌점으로 쓰지 않는다)', () => {
    const held = JSON.stringify(escalationRisk(signals({ angryTone: null }), R));
    expect(JSON.stringify(escalationRisk(signals({ angryTone: false }), R))).toBe(held);
  });
});

describe('응답 기한 72시간 경계', () => {
  it('72시간은 "이내"에 든다', () => {
    expect(escalationRisk(signals({ hoursToDue: 72 }), R).score).toBe(R.escalation.dueWithin72h);
  });

  it('72시간을 조금만 넘으면 0점', () => {
    expect(escalationRisk(signals({ hoursToDue: 72.01 }), R).score).toBe(0);
    expect(escalationRisk(signals({ hoursToDue: 73 }), R).score).toBe(0);
  });

  it('기한이 이미 지난 음수 시간도 "이내"에 든다', () => {
    for (const hoursToDue of [0, -0.5, -48]) {
      expect(escalationRisk(signals({ hoursToDue }), R).score).toBe(R.escalation.dueWithin72h);
    }
  });
});

describe('구간 (0~2 Low · 3~4 Watch · 5 이상 High)', () => {
  it('2점은 Low, 3점은 Watch (watchFrom 경계)', () => {
    expect(escalationRisk(signals({ secondMessageUnanswered: true }), R).score).toBe(2);
    expect(escalationRisk(signals({ secondMessageUnanswered: true }), R).band).toBe('Low');
    expect(escalationRisk(signals({ mentionsCardCompany: true }), R).score).toBe(3);
    expect(escalationRisk(signals({ mentionsCardCompany: true }), R).band).toBe('Watch');
  });

  it('4점은 Watch, 5점은 High (highFrom 경계)', () => {
    const watch = escalationRisk(signals({ mentionsCardCompany: true, hoursToDue: 48 }), R);
    const high = escalationRisk(signals({ mentionsCardCompany: true, unansweredOver24h: true }), R);
    expect(watch.score).toBe(4);
    expect(watch.band).toBe('Watch');
    expect(high.score).toBe(5);
    expect(high.band).toBe('High');
  });

  it('구간 기준을 바꾸면 같은 점수의 구간도 바뀐다', () => {
    const strict = withEscalation({ watchFrom: 1, highFrom: 2 });
    expect(escalationRisk(signals({ angryTone: true }), strict).band).toBe('Watch');
    expect(escalationRisk(signals({ secondMessageUnanswered: true }), strict).band).toBe('High');
    const loose = withEscalation({ watchFrom: 8, highFrom: 9 });
    expect(escalationRisk(signals({ mentionsCardCompany: true, unansweredOver24h: true }), loose).band).toBe('Low');
  });

  it('watchFrom과 highFrom이 같으면 그 점수부터 High', () => {
    const rules = withEscalation({ watchFrom: 3, highFrom: 3 });
    expect(escalationRisk(signals({ mentionsCardCompany: true }), rules).band).toBe('High');
    expect(escalationRisk(signals({ secondMessageUnanswered: true }), rules).band).toBe('Low');
  });
});

describe('가중치는 config에서 읽는다', () => {
  it('가중치를 바꾸면 점수도 같이 바뀐다', () => {
    const rules = withEscalation({ cardCompanyMention: 10, unanswered: 4, angryTone: 2, dueWithin72h: 3 });
    const risk = escalationRisk(signals({ mentionsCardCompany: true, angryTone: true, hoursToDue: 1 }), rules);
    expect(risk.score).toBe(15);
    expect(risk.parts.map((p) => p.points)).toEqual([10, 0, 2, 3]);
  });

  it('가중치 0은 신호가 있어도 0점', () => {
    const rules = withEscalation({ cardCompanyMention: 0 });
    expect(escalationRisk(signals({ mentionsCardCompany: true }), rules).score).toBe(0);
  });

  it('rules를 안 넘기면 config/rules.json을 쓴다', () => {
    const start = signals({ mentionsCardCompany: true, unansweredOver24h: true, angryTone: true, hoursToDue: 48 });
    expect(JSON.stringify(escalationRisk(start))).toBe(JSON.stringify(escalationRisk(start, R)));
  });
});

describe('parts', () => {
  const start = signals({ mentionsCardCompany: true, secondMessageUnanswered: true, angryTone: true, hoursToDue: 48 });

  it('해당 없는 신호도 포함해 항상 네 개, 고정 순서', () => {
    for (const s of [signals(), start]) {
      expect(escalationRisk(s, R).parts.map((p) => p.signal)).toEqual([
        'cardCompanyMention',
        'unanswered',
        'angryTone',
        'dueWithin72h',
      ]);
    }
  });

  it('점수 합이 score와 같다', () => {
    const risk = escalationRisk(start, R);
    expect(risk.parts.reduce((sum, p) => sum + p.points, 0)).toBe(risk.score);
    expect(risk.score).toBe(7);
  });
});

describe('잘못된 설정·신호는 예외 (zod)', () => {
  it('가중치가 정수가 아니거나 음수면 ZodError', () => {
    const s = signals({ mentionsCardCompany: true });
    expect(() => escalationRisk(s, withEscalation({ cardCompanyMention: 2.5 }))).toThrow(ZodError);
    expect(() => escalationRisk(s, withEscalation({ unanswered: -1 }))).toThrow(ZodError);
    expect(() => escalationRisk(s, withEscalation({ highFrom: Number.NaN }))).toThrow(ZodError);
  });

  it('watchFrom이 highFrom보다 크면 ZodError', () => {
    expect(() => escalationRisk(signals(), withEscalation({ watchFrom: 6, highFrom: 5 }))).toThrow(ZodError);
    expect(() => escalationRisk(signals(), withEscalation({ watchFrom: 5, highFrom: 5 }))).not.toThrow();
  });

  it('가중치가 빠져 있으면 ZodError', () => {
    const broken = { ...R, escalation: { cardCompanyMention: 3 } } as unknown as PolicyConfig;
    expect(() => escalationRisk(signals(), broken)).toThrow(ZodError);
    const noEscalation = { ...R, escalation: undefined } as unknown as PolicyConfig;
    expect(() => escalationRisk(signals(), noEscalation)).toThrow(ZodError);
  });

  it('hoursToDue가 유한한 수가 아니면 ZodError', () => {
    for (const hoursToDue of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => escalationRisk(signals({ hoursToDue }), R)).toThrow(ZodError);
    }
    expect(() => escalationRisk(signals({ hoursToDue: '48' as unknown as number }), R)).toThrow(ZodError);
  });

  it('신호 모양이 깨져 있으면 ZodError', () => {
    expect(() => escalationRisk({ ...signals(), angryTone: 'angry' } as unknown as EscalationSignals, R)).toThrow(ZodError);
    const missing = { mentionsCardCompany: true } as unknown as EscalationSignals;
    expect(() => escalationRisk(missing, R)).toThrow(ZodError);
  });
});

describe('불변과 결정론', () => {
  it('신호·규칙을 바꾸지 않는다 (동결된 객체도 통과)', () => {
    const s = signals({ mentionsCardCompany: true, angryTone: true, hoursToDue: 48 });
    Object.freeze(s);
    const frozenRules = withEscalation({});
    Object.freeze(frozenRules);
    Object.freeze(frozenRules.escalation);
    const before = JSON.stringify({ s, frozenRules });
    expect(() => escalationRisk(s, frozenRules)).not.toThrow();
    expect(JSON.stringify({ s, frozenRules })).toBe(before);
  });

  it('결과를 바꿔도 다음 호출 결과는 그대로다', () => {
    const s = signals({ mentionsCardCompany: true });
    const risk = escalationRisk(s, R);
    const before = JSON.stringify(risk);
    risk.score = 99;
    risk.parts[0].points = 99;
    expect(JSON.stringify(escalationRisk(s, R))).toBe(before);
  });
});
