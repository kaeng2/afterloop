/**
 * 인수 테스트 AC4 (+ AC10 planMove 결정론): 제안률 정책 고정·한도 (잠금 파일, 실행만 하고 수정하지 않는다)
 * 기대값 출처: 검토 결정 3·M1 / 기획자 승인 2026-11-09
 * 기준: SPEC v2 5장·6장·9-1장. 작업: T005
 */
import { describe, expect, it } from 'vitest';

import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';

import type { Evaluation } from '@/types';

import { D1_JIHO, P, R } from './boards';

// 기대값 출처: 검토 결정 3 / 기획자 승인 2026-11-09. $48 × 0.15 = 720¢, × 0.20 = 960¢
describe('AC4 제안률은 정책값으로 고정, 한도 20%', () => {
  const offer: Evaluation = recommend(D1_JIHO, P, R).best!;

  it('x 0.15 → 제안 금액 720¢, make_offer, REFUND', () => {
    expect(offer.move).toBe('offer');
    const plan = planMove(D1_JIHO, offer, P, R);
    expect(plan.apiMove).toBe('make_offer');
    expect(plan.amountCents).toBe(720);
    expect(plan.refundType).toBe('REFUND');
    expect(plan.requiresApproval).toBe(true);
  });

  it('x 0.20 (한도와 같음) → 960¢', () => {
    expect(planMove(D1_JIHO, offer, { ...P, offerRate: 0.2 }, R).amountCents).toBe(960);
  });

  it('x 0.25 (한도 0.20 초과) → 설정 오류', () => {
    expect(() => planMove(D1_JIHO, offer, { ...P, offerRate: 0.25 }, R)).toThrow();
  });

  it('refund 계획 → accept_claim, 4800¢', () => {
    const refund = recommend(D1_JIHO, P, R).all.find((e: Evaluation) => e.move === 'refund')!;
    const plan = planMove(D1_JIHO, refund, P, R);
    expect(plan.apiMove).toBe('accept_claim');
    expect(plan.amountCents).toBe(4800);
  });
});

// 기대값 출처: SPEC v2 5장 / 기획자 승인 2026-11-09
describe('AC10 결정론 (planMove)', () => {
  it('같은 입력으로 100번 만들어도 계획(planId 포함)이 같다', () => {
    const offer = recommend(D1_JIHO, P, R).best!;
    const first = JSON.stringify(planMove(D1_JIHO, offer, P, R));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(planMove(D1_JIHO, offer, P, R))).toBe(first);
  });
});
