import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { pAccept } from '@/engine/oracle';
import { DEFAULT_PARAMS, resolveParams } from '@/engine/params';
import { pickBest, recommend } from '@/engine/recommend';
import type { BoardState, Evaluation } from '@/engine/types';

/** 가디건 SNAD 분쟁. 필드 형태는 tests/fixtures/dispute-detail.inquiry-waiting-seller.json(실제 샌드박스 응답)을 따른다. */
const cardigan: BoardState = {
  disputeId: 'PP-R-TEST-CARDIGAN',
  reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED',
  stage: 'INQUIRY',
  channel: 'INTERNAL',
  dueDate: '2026-11-29T06:09:25.608Z',
  amountCents: 4800,
  currency: 'USD',
  allowedMoves: ['send_message', 'make_offer', 'accept_claim'],
  buyerDisputeCount90d: 0,
  hasDeliveredTracking: false,
  cause: { rootCause: 'B_EXPECTATION', confidence: 0.9, signals: ['color and size differ'], needsReview: false },
};

const byMove = (evals: Evaluation[], move: Evaluation['move']) => {
  const found = evals.find((e) => e.move === move);
  if (!found) throw new Error(`${move} 평가가 없음`);
  return found;
};

describe('O1 가디건 $48, 원인 B, 기본 가정값', () => {
  const rec = recommend(cardigan);

  it('fight 7780¢', () => {
    expect(byMove(rec.all, 'fight').expectedLossCents).toBe(7780);
  });

  it('offer 4032¢ (p_acc 0.725 그대로 계산한 4031.5¢를 반올림)', () => {
    // PRD의 4178¢($41.8)는 p_acc를 0.7로 반올림한 값이다. 작업 지시대로 계산식 그대로의 값을 기준으로 한다.
    expect(byMove(rec.all, 'offer').expectedLossCents).toBe(4032);
  });

  it('refund 5700¢', () => {
    expect(byMove(rec.all, 'refund').expectedLossCents).toBe(5700);
  });

  it('추천은 offer, 실행 API는 make_offer, 항상 사람 승인', () => {
    expect(rec.best?.move).toBe('offer');
    expect(rec.best?.apiMove).toBe('make_offer');
    expect(rec.requiresApproval).toBe(true);
  });

  it('합의 단계(INQUIRY)의 fight는 send_message로, refund는 accept_claim으로 실행된다', () => {
    expect(byMove(rec.all, 'fight').apiMove).toBe('send_message');
    expect(byMove(rec.all, 'refund').apiMove).toBe('accept_claim');
  });
});

describe('O2 같은 분쟁, 원인 F, p_win 0.55, V = 0', () => {
  const board: BoardState = {
    ...cardigan,
    hasDeliveredTracking: true,
    cause: { rootCause: 'F_ABUSE', confidence: 0.85, signals: ['repeat claims'], needsReview: false },
  };
  const rec = recommend(board, { pWinBase: 0.55 });

  it('fight 3835¢', () => {
    expect(byMove(rec.all, 'fight').expectedLossCents).toBe(3835);
  });

  it('offer는 R4로 차단 (expectedLoss null, blockedBy "R4")', () => {
    const offer = byMove(rec.all, 'offer');
    expect(offer.expectedLossCents).toBeNull();
    expect(offer.blockedBy).toBe('R4');
  });

  it('refund 4800¢ (원인 F이면 재구매 가치 0)', () => {
    expect(byMove(rec.all, 'refund').expectedLossCents).toBe(4800);
  });

  it('추천은 fight', () => {
    expect(rec.best?.move).toBe('fight');
  });
});

describe('O3 p_acc 경계', () => {
  it.each([
    [0, 0.35],
    [0.15, 0.725],
    [0.3, 0.9],
    [0.5, 0.9],
    [1, 0.9],
  ])('x=%s → %s', (x, expected) => {
    expect(pAccept(x)).toBeCloseTo(expected, 12);
  });

  it('x가 0~1 밖이면 에러', () => {
    expect(() => pAccept(-0.01)).toThrow();
    expect(() => pAccept(1.01)).toThrow();
    expect(() => pAccept(Number.NaN)).toThrow();
  });
});

describe('O4 동점 처리', () => {
  const ev = (move: Evaluation['move'], loss: number | null): Evaluation => ({
    move,
    apiMove: null,
    expectedLossCents: loss,
    branches: [],
  });

  it('기대 손실이 같으면 fight → offer → refund 순서로 고른다 (입력 순서와 무관)', () => {
    const orders = [
      [ev('refund', 5000), ev('offer', 5000), ev('fight', 5000)],
      [ev('offer', 5000), ev('refund', 5000), ev('fight', 5000)],
      [ev('fight', 5000), ev('offer', 5000), ev('refund', 5000)],
    ];
    for (const evals of orders) expect(pickBest(evals)?.move).toBe('fight');
    expect(pickBest([ev('refund', 5000), ev('offer', 5000)])?.move).toBe('offer');
  });

  it('차단된(null) 평가는 동점 비교에서 빠진다', () => {
    expect(pickBest([ev('fight', null), ev('refund', 5000), ev('offer', 5000)])?.move).toBe('offer');
  });

  it('실제 계산에서 fight와 refund가 같으면 fight', () => {
    // pWin 0, 수수료·시간 0, c_fight = c_refund → fight = refund = 4800 + 0.15·6000 = 5700. offer는 시간 비용으로 밀어냄.
    const rec = recommend(cardigan, {
      pWinBase: 0,
      feeCents: 0,
      tFightCents: 0,
      cFight: 0.15,
      cRefund: 0.15,
      tOfferCents: 100_000,
    });
    expect(byMove(rec.all, 'fight').expectedLossCents).toBe(5700);
    expect(byMove(rec.all, 'refund').expectedLossCents).toBe(5700);
    expect(rec.best?.move).toBe('fight');
  });
});

describe('O5 결정론', () => {
  it('같은 입력으로 100번 호출해도 결과가 완전히 같다', () => {
    const first = JSON.stringify(recommend(cardigan));
    for (let i = 0; i < 100; i++) expect(JSON.stringify(recommend(cardigan))).toBe(first);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const snapshot = JSON.stringify(cardigan);
    recommend(cardigan, { pWinBase: 0.55 });
    expect(JSON.stringify(cardigan)).toBe(snapshot);
  });

  it('src/engine 코드에 Math.random, Date, performance.now가 없다', () => {
    const dir = path.resolve(__dirname, '../../src/engine');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(path.join(dir, file), 'utf8');
      expect(src, file).not.toMatch(/Math\.random|\bDate\b|performance\.now/);
    }
  });
});

describe('O6 가정값 검증', () => {
  it('기본값은 통과한다', () => {
    expect(resolveParams()).toEqual(DEFAULT_PARAMS);
  });

  it.each([
    ['pWinBase', 1.2],
    ['pWinBase', -0.1],
    ['cFight', 1.5],
    ['cAccept', -0.01],
    ['cRefund', 2],
    ['offerRate', 1.01],
    ['pWinBase', Number.NaN],
  ])('확률 %s = %s → ZodError', (key, value) => {
    expect(() => resolveParams({ [key]: value })).toThrow(ZodError);
  });

  it.each([
    ['feeCents', -1],
    ['tFightCents', -100],
    ['tOfferCents', -5],
    ['repurchaseValueCents', -6000],
  ])('금액 %s = %s → ZodError', (key, value) => {
    expect(() => resolveParams({ [key]: value })).toThrow(ZodError);
  });

  it('recommend도 잘못된 가정값이면 ZodError를 던진다', () => {
    expect(() => recommend(cardigan, { pWinBase: 1.2 })).toThrow(ZodError);
  });
});

describe('O7 트리 분기', () => {
  const rec = recommend(cardigan);

  it('offer: [수락 0.725 → 1920¢, 거절 0.275 → 7780¢]', () => {
    const { branches } = byMove(rec.all, 'offer');
    expect(branches).toHaveLength(2);
    expect(branches[0].label).toBe('accept');
    expect(branches[0].prob).toBeCloseTo(0.725, 12);
    expect(branches[0].lossCents).toBe(1920);
    expect(branches[1].label).toBe('reject');
    expect(branches[1].prob).toBeCloseTo(0.275, 12);
    expect(branches[1].lossCents).toBe(7780);
  });

  it('분기 확률의 합은 1, Σ(확률×손실) + 시간 비용 = 기대 손실 (fight·offer·refund 모두)', () => {
    const timeCost = { fight: DEFAULT_PARAMS.tFightCents, offer: DEFAULT_PARAMS.tOfferCents, refund: 0 };
    for (const e of rec.all) {
      const probSum = e.branches.reduce((s, b) => s + b.prob, 0);
      expect(probSum, e.move).toBeCloseTo(1, 12);
      const total = e.branches.reduce((s, b) => s + b.prob * b.lossCents, 0) + timeCost[e.move];
      expect(Math.abs(total - (e.expectedLossCents ?? Number.NaN)), e.move).toBeLessThanOrEqual(0.5);
    }
  });

  it('차단된 수는 분기가 비어 있다', () => {
    const blocked = recommend(
      { ...cardigan, cause: { ...cardigan.cause!, rootCause: 'F_ABUSE' } },
      { pWinBase: 0.55 },
    );
    expect(byMove(blocked.all, 'offer').branches).toEqual([]);
  });
});
