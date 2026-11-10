/**
 * 단위 테스트: offerComesFirst (SPEC v2.6 9-4장 "제안이 먼저"). 작업 T052.
 *
 * 판매자가 메시지를 보내면 분쟁이 구매자 답 대기 상태가 되고 `make_offer` 링크가 사라진다
 * (2026-11-10 연습용 분쟁에서 확인). 그래서 제안 추천인 분쟁에서는 메시지를 먼저 보내면 안 된다.
 * 판정은 이 엔진 함수가 하고 화면·앱 서버는 결과를 옮기기만 한다.
 */
import { describe, expect, it } from 'vitest';

import { paramsFromConfig, rulesFromConfig } from '@/engine/params';
import { BLOCKED, offerComesFirst } from '@/engine/policy';
import { recommend } from '@/engine/recommend';
import type { BoardState, MoveType, Params, PolicyConfig, Recommendation, Subtype } from '@/types';

const P: Params = paramsFromConfig();
const R: PolicyConfig = rulesFromConfig();

/** 지호 꼴 (D1): 가디건 $48, SNAD → B1 색상, 합의 단계, 추적 미등록 */
function jiho(over: Partial<BoardState> = {}): BoardState {
  return {
    disputeId: 'T052-D1',
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

/** 서연 꼴 (D2): 스웨터 $72, INR → A2 통관 보류, 합의 단계, 네 링크 모두 */
function seoyeon(over: Partial<BoardState> = {}): BoardState {
  return jiho({
    disputeId: 'T052-D2',
    reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
    amountCents: 7200,
    allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'],
    cause: { subtype: 'A2', confidence: 0.9, evidence: ['customs'], needsReview: false, source: 'llm' },
    ...over,
  });
}

function subtype(s: Subtype): Partial<BoardState> {
  return { cause: { subtype: s, confidence: 0.9, evidence: ['x'], needsReview: false, source: 'llm' } };
}

describe('참: 추천이 제안이고 make_offer가 허용돼 있다', () => {
  it('지호 꼴 (합의 단계, SNAD, B1, 링크 send_message·make_offer·accept_claim) → 참', () => {
    const board = jiho();
    const rec = recommend(board, P, R);
    expect(rec.best?.move).toBe('offer');
    expect(rec.best?.apiMove).toBe('make_offer');
    expect(offerComesFirst(board, rec)).toBe(true);
  });

  it('네 링크가 모두 있어도 추천이 제안이면 참 (증빙 링크는 상관없다)', () => {
    const board = jiho({ allowedMoves: ['send_message', 'make_offer', 'provide_evidence', 'accept_claim'] });
    const rec = recommend(board, P, R);
    expect(rec.best?.move).toBe('offer');
    expect(offerComesFirst(board, rec)).toBe(true);
  });
});

describe('거짓: make_offer가 허용돼 있지 않다 (구매자 답 대기 상태)', () => {
  it('같은 지호 보드에서 링크에 make_offer가 없으면 거짓', () => {
    const board = jiho({ allowedMoves: ['send_message', 'accept_claim'] });
    const rec = recommend(board, P, R);
    expect(rec.best?.move).not.toBe('offer');
    expect(offerComesFirst(board, rec)).toBe(false);
  });

  it('추천이 제안이어도 지금 보드에 make_offer가 없으면 거짓 (링크가 사라진 뒤)', () => {
    // 메시지를 보내기 전에 만든 추천을, 링크가 사라진 보드에 대고 묻는 경우.
    // 제안할 방법이 없으므로 메시지를 막을 이유도 없다.
    const before = jiho();
    const rec = recommend(before, P, R);
    expect(rec.best?.move).toBe('offer');

    const waitingForBuyer = jiho({ allowedMoves: ['send_message', 'accept_claim'] });
    expect(offerComesFirst(waitingForBuyer, rec)).toBe(false);
  });
});

describe('거짓: 추천이 제안이 아니다', () => {
  it('서연 꼴 (합의 단계, INR, A2, 네 링크 모두) → best는 답장 → 거짓', () => {
    const board = seoyeon();
    const rec = recommend(board, P, R);
    expect(rec.best?.move).toBe('fight');
    expect(offerComesFirst(board, rec)).toBe(false);
  });

  it('추천이 환불인 보드 (A1, 추적 기록 없음) → 거짓', () => {
    const board = jiho(subtype('A1'));
    const rec = recommend(board, P, R);
    expect(rec.best?.move).toBe('refund');
    expect(offerComesFirst(board, rec)).toBe(false);
  });

  it('best = null인 보드 (원인이 없어 어느 수도 계산하지 않는다) → 거짓', () => {
    const board = jiho({ cause: undefined });
    const rec = recommend(board, P, R);
    expect(rec.best).toBe(null);
    expect(rec.all.every((e) => e.blockedBy === BLOCKED.noCause)).toBe(true);
    expect(offerComesFirst(board, rec)).toBe(false);
  });

  it('제안이 차단된 보드 (B1·B2 밖, 제안 평가가 OFFER_SCOPE) → 거짓', () => {
    const board = jiho(subtype('B3'));
    const rec = recommend(board, P, R);
    expect(rec.all.find((e) => e.move === 'offer')?.blockedBy).toBe(BLOCKED.offerScope);
    expect(offerComesFirst(board, rec)).toBe(false);
  });
});

describe('순수 함수', () => {
  it('입력을 변형하지 않는다', () => {
    const board = jiho();
    const rec = recommend(board, P, R);
    const boardBefore = JSON.stringify(board);
    const recBefore = JSON.stringify(rec);

    offerComesFirst(board, rec);

    expect(JSON.stringify(board)).toBe(boardBefore);
    expect(JSON.stringify(rec)).toBe(recBefore);
  });

  it('같은 입력이면 같은 결과 (여러 번 불러도 바뀌지 않는다)', () => {
    const cases: { board: BoardState; expected: boolean }[] = [
      { board: jiho(), expected: true },
      { board: jiho({ allowedMoves: ['send_message', 'accept_claim'] }), expected: false },
      { board: seoyeon(), expected: false },
      { board: jiho(subtype('A1')), expected: false },
      { board: jiho({ cause: undefined }), expected: false },
    ];

    for (const { board, expected } of cases) {
      const rec = recommend(board, P, R);
      expect(offerComesFirst(board, rec), board.disputeId).toBe(expected);
      expect(offerComesFirst(board, rec), board.disputeId).toBe(expected);
      expect(offerComesFirst(board, recommend(board, P, R)), board.disputeId).toBe(expected);
    }
  });

  it('recommend를 안에서 다시 부르지 않는다: 보드와 어긋난 추천도 그대로 믿는다', () => {
    // 제안이 차단되는 보드(A1)에 제안 추천을 대고 물으면, 다시 계산하지 않으므로 참이다.
    const board = jiho(subtype('A1'));
    expect(recommend(board, P, R).best?.move).toBe('refund');

    const offerRec: Recommendation = recommend(jiho(), P, R);
    expect(offerComesFirst(board, offerRec)).toBe(true);
  });
});

describe('make_offer 말고 다른 링크는 보지 않는다', () => {
  const offerRec = recommend(jiho(), P, R);
  const cases: { allowedMoves: MoveType[]; expected: boolean }[] = [
    { allowedMoves: ['make_offer'], expected: true },
    { allowedMoves: ['make_offer', 'send_message'], expected: true },
    { allowedMoves: ['make_offer', 'provide_evidence', 'accept_claim'], expected: true },
    { allowedMoves: ['send_message'], expected: false },
    { allowedMoves: ['provide_evidence', 'accept_claim'], expected: false },
    { allowedMoves: [], expected: false },
  ];

  for (const { allowedMoves, expected } of cases) {
    it(`[${allowedMoves.join(', ')}] → ${expected ? '참' : '거짓'}`, () => {
      expect(offerComesFirst(jiho({ allowedMoves }), offerRec)).toBe(expected);
    });
  }
});
