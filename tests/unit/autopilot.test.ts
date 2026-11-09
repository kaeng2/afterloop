/**
 * 단위 테스트: 오토파일럿 판정 (SPEC v2.1 6장). 작업 T004.
 * 규칙 순서(첫 번째로 걸리는 규칙)와 로그 문구 형식을 본다.
 */
import { describe, expect, it } from 'vitest';

import { decideAutopilot } from '@/engine/autopilot';
import { paramsFromConfig, rulesFromConfig } from '@/engine/params';
import { recommend } from '@/engine/recommend';
import type { BoardState, Params, PolicyConfig } from '@/types';

const P: Params = paramsFromConfig();
const R: PolicyConfig = rulesFromConfig();

function board(over: Partial<BoardState> = {}): BoardState {
  return {
    disputeId: 'U-1',
    reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
    stage: 'INQUIRY',
    channel: 'INTERNAL',
    dueDate: '2026-11-12T17:00:00Z',
    amountCents: 4800,
    currency: 'USD',
    allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
    hasTracking: false,
    hasDeliveredTracking: false,
    buyerPriorInrDisputes: 0,
    isDemo: false,
    cause: { subtype: 'B1', confidence: 0.9, evidence: ['color'], needsReview: false, source: 'llm' },
    ...over,
  };
}

const F1_BOARD = board({
  reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
  amountCents: 3500,
  hasTracking: true,
  hasDeliveredTracking: true,
  buyerPriorInrDisputes: 2,
  cause: { subtype: 'F1', confidence: 1, evidence: ['3rd claim'], needsReview: false, source: 'rule' },
});

describe('규칙 순서: 첫 번째로 걸리는 규칙만 적용한다', () => {
  it('F + EXTERNAL이면 suspected_abuse (1번이 먼저)', () => {
    const rec = recommend({ ...F1_BOARD, channel: 'EXTERNAL' }, P, R);
    expect(rec.autopilot.rule).toBe('suspected_abuse');
  });

  it('EXTERNAL + 확신도 0.5면 card_company_case (2번이 먼저)', () => {
    const b = board({
      channel: 'EXTERNAL',
      cause: { subtype: 'B1', confidence: 0.5, evidence: [], needsReview: true, source: 'llm' },
    });
    expect(recommend(b, P, R).autopilot.rule).toBe('card_company_case');
  });

  it('확신도 0.5 + best가 offer면 low_confidence (3번이 먼저)', () => {
    const b = board({ cause: { subtype: 'B1', confidence: 0.5, evidence: [], needsReview: true, source: 'llm' } });
    const rec = recommend(b, P, R);
    expect(rec.best?.move).toBe('offer');
    expect(rec.autopilot.rule).toBe('low_confidence');
    expect(rec.autopilot.verdict).toBe('skipped');
  });

  it('F2(부분환불 노림)도 대분류 F라 건너뛴다', () => {
    const b = board({ cause: { subtype: 'F2', confidence: 0.9, evidence: [], needsReview: false, source: 'llm' } });
    expect(recommend(b, P, R).autopilot.rule).toBe('suspected_abuse');
  });
});

describe('돈이 움직이는 수와 판매자 검토', () => {
  it('best가 refund면 money_moves', () => {
    // A1 추적 없음: fight 5555¢ > refund 5000¢, offer는 제안 대상 아님
    const b = board({ cause: { subtype: 'A1', confidence: 0.9, evidence: [], needsReview: false, source: 'llm' } });
    const rec = recommend(b, P, R);
    expect(rec.best?.move).toBe('refund');
    expect(rec.autopilot.rule).toBe('money_moves');
    expect(rec.autopilot.verdict).toBe('awaiting_approval');
  });

  it('best가 fight면 seller_review (돈이 움직이지 않음)', () => {
    const rec = recommend(F1_BOARD, { ...P, pWin: { ...P.pWin, F1: 0.9 } }, { ...R, autopilot: { ...R.autopilot, skipCategories: [] } });
    expect(rec.best?.move).toBe('fight');
    expect(rec.autopilot.rule).toBe('seller_review');
  });

  it('허용된 수가 없으면 seller_review (직접 처리)', () => {
    const rec = recommend(board({ allowedMoves: [] }), P, R);
    expect(rec.best).toBeNull();
    expect(rec.autopilot.verdict).toBe('awaiting_approval');
    expect(rec.autopilot.rule).toBe('seller_review');
  });
});

describe('확신도 기준값은 rules에서 읽는다', () => {
  it('기준값 0.7: 0.69는 건너뜀, 0.70은 아니다', () => {
    const at = (confidence: number) =>
      recommend(
        board({ cause: { subtype: 'B1', confidence, evidence: [], needsReview: false, source: 'llm' } }),
        P,
        R,
      ).autopilot;
    expect(R.autopilot.minConfidence).toBe(0.7);
    expect(at(0.69).rule).toBe('low_confidence');
    expect(at(0.7).rule).toBe('money_moves');
  });

  it('기준값을 0.95로 올리면 0.9도 건너뛴다', () => {
    const rules: PolicyConfig = { ...R, autopilot: { ...R.autopilot, minConfidence: 0.95 } };
    expect(recommend(board(), P, rules).autopilot.rule).toBe('low_confidence');
  });
});

describe('로그 문구 (영어 한 문장, 숫자는 코드가 채운다)', () => {
  const cases: BoardState[] = [
    board(),
    F1_BOARD,
    board({ channel: 'EXTERNAL' }),
    board({ cause: undefined }),
    board({ cause: { subtype: 'B1', confidence: 0.69, evidence: [], needsReview: true, source: 'llm' } }),
    board({ allowedMoves: [] }),
    board({
      hasDeliveredTracking: true,
      buyerPriorInrDisputes: 2,
      cause: { subtype: 'F2', confidence: 0.9, evidence: [], needsReview: false, source: 'llm' },
    }),
    { ...F1_BOARD, reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED' },
  ];

  it('모두 영어 한 문장으로 끝난다', () => {
    for (const b of cases) {
      const { reason } = recommend(b, P, R).autopilot;
      expect(reason).toMatch(/^[A-Z][\x20-\x7E]*\.$/);
      expect(reason.split('. ').length).toBe(1);
    }
  });

  it('돈이 움직이는 수는 금액을 달러로 적는다 (offer 1953¢ → $19.53)', () => {
    const { reason } = recommend(board(), P, R).autopilot;
    expect(reason).toContain('$19.53');
    expect(reason).toContain('offer');
  });

  it('확신도 미달이면 확신도와 기준값을 적는다', () => {
    const b = board({ cause: { subtype: 'B1', confidence: 0.69, evidence: [], needsReview: true, source: 'llm' } });
    expect(recommend(b, P, R).autopilot.reason).toContain('0.69');
    expect(recommend(b, P, R).autopilot.reason).toContain('0.70');
  });

  it('반복 미수령 주장은 몇 번째인지와 배송 기록을 적는다 (이전 2건 → 3rd)', () => {
    expect(recommend(F1_BOARD, P, R).autopilot.reason).toContain('3rd "not received" claim with delivery proof');
  });

  // T004 검증 2번: F1·미수령 분쟁이 아닌 건에 "3번째 미수령 주장"이라고 쓰면 사실과 다르다.
  it('F2는 미수령 주장 문구를 쓰지 않고 유형에 맞는 문구를 쓴다', () => {
    const b = board({
      hasTracking: true,
      hasDeliveredTracking: true,
      buyerPriorInrDisputes: 2,
      cause: { subtype: 'F2', confidence: 0.9, evidence: [], needsReview: false, source: 'llm' },
    });
    const { reason, rule, verdict } = recommend(b, P, R).autopilot;
    expect(rule).toBe('suspected_abuse');
    expect(verdict).toBe('skipped');
    expect(reason).toContain('F2');
    expect(reason).toContain('partial-refund');
    expect(reason).not.toContain('not received');
    expect(reason).not.toContain('3rd');
  });

  it('F1이지만 미수령 분쟁이 아니면 "몇 번째 주장" 대신 이전 분쟁 수를 적는다', () => {
    const b = board({
      reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
      hasTracking: true,
      hasDeliveredTracking: true,
      buyerPriorInrDisputes: 2,
      cause: { subtype: 'F1', confidence: 1, evidence: [], needsReview: false, source: 'rule' },
    });
    const { reason, rule } = recommend(b, P, R).autopilot;
    expect(rule).toBe('suspected_abuse');
    expect(reason).toContain('2 earlier "not received" disputes from this buyer with delivery proof');
    expect(reason).not.toContain('3rd');
  });

  it('F1인데 이전 미수령 분쟁이 기준 미만이면 근거를 붙이지 않는다', () => {
    const b = board({
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      cause: { subtype: 'F1', confidence: 1, evidence: [], needsReview: false, source: 'rule' },
    });
    const { reason, rule } = recommend(b, P, R).autopilot;
    expect(rule).toBe('suspected_abuse');
    expect(reason).toBe('Skipped: cause F1 is suspected abuse, so autopilot never acts on this dispute.');
  });

  it('배송 완료 기록이 없으면 배송 기록을 근거로 적지 않는다', () => {
    const b = board({
      reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
      buyerPriorInrDisputes: 3,
      cause: { subtype: 'F1', confidence: 1, evidence: [], needsReview: false, source: 'rule' },
    });
    const { reason } = recommend(b, P, R).autopilot;
    expect(reason).toContain('4th "not received" claim)');
    expect(reason).not.toContain('delivery proof');
  });

  it('F 외 대분류를 건너뛰게 설정해도 악용 근거 문구를 붙이지 않는다', () => {
    const rules: PolicyConfig = { ...R, autopilot: { ...R.autopilot, skipCategories: ['B'] } };
    const b = board({ hasDeliveredTracking: true, buyerPriorInrDisputes: 2 });
    const { reason, rule } = recommend(b, P, rules).autopilot;
    expect(rule).toBe('suspected_abuse');
    expect(reason).toBe('Skipped: cause B1 is suspected abuse, so autopilot never acts on this dispute.');
  });

  it('원인이 없으면 유형 확인을 요청한다', () => {
    expect(recommend(board({ cause: undefined }), P, R).autopilot.reason).toContain('no cause');
  });

  it('구매자 정보나 분쟁 ID는 문구에 넣지 않는다', () => {
    for (const b of cases) {
      expect(recommend(b, P, R).autopilot.reason).not.toContain(b.disputeId);
    }
  });
});

describe('decideAutopilot 단독 호출', () => {
  it('best를 넘기지 않아도 판정한다 (seller_review)', () => {
    expect(decideAutopilot(board(), null, R).rule).toBe('seller_review');
  });

  it('같은 입력이면 같은 판정', () => {
    const first = JSON.stringify(decideAutopilot(F1_BOARD, null, R));
    for (let i = 0; i < 20; i++) expect(JSON.stringify(decideAutopilot(F1_BOARD, null, R))).toBe(first);
  });
});
