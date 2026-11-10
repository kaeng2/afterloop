/**
 * 단위 테스트: 요청 번호(`PayPal-Request-Id`) — T041, SPEC v2.4 9-1장 (Q11)
 *
 * 요청 번호는 hash(계획 ID + 엔드포인트 이름 + 보내는 본문)에서 만든 36자 이하 값이다.
 * 실제 PayPal 호출은 없다 (`buildRequest`는 순수 함수다. `.env`를 읽지 않는다).
 */
import { describe, expect, it } from 'vitest';

import { buildRequest } from '@/exec/request';
import type { ActionPlan } from '@/types';

/** 실제 길이의 분쟁 ID·계획 ID (최악 길이 확인용). */
const REAL_DISPUTE_ID = 'PP-R-GMS-10197661';
const REAL_PLAN_ID = 'plan-PP-R-GMS-10197661-make_offer-2026-11-12T17:00:00.000Z-0720';

const OFFER_PLAN: ActionPlan = {
  planId: REAL_PLAN_ID,
  disputeId: REAL_DISPUTE_ID,
  move: 'offer',
  apiMove: 'make_offer',
  amountCents: 720,
  currency: 'USD',
  refundType: 'REFUND',
  messageRequired: false,
  requiresApproval: true,
};

const MESSAGE_PLAN: ActionPlan = {
  ...OFFER_PLAN,
  apiMove: 'send_message',
  move: 'fight',
  amountCents: null,
  refundType: null,
  messageRequired: true,
};

const ACCEPT_PLAN: ActionPlan = { ...OFFER_PLAN, apiMove: 'accept_claim', move: 'refund', amountCents: 4800 };

const MESSAGE = 'We are sorry about the fit. We can refund $7.20 of the $48.00 you paid.';

/** 요청 번호만 꺼낸다. 거부되면 테스트를 실패시킨다. */
function requestIdOf(plan: ActionPlan, message = MESSAGE): string {
  const built = buildRequest(plan, message);
  expect(built.ok).toBe(true);
  if (!built.ok) throw new Error(built.error);
  return built.request.requestId;
}

describe('요청 번호: 길이와 문자 집합', () => {
  it.each([
    ['send-message', MESSAGE_PLAN],
    ['make-offer', OFFER_PLAN],
    ['accept-claim', ACCEPT_PLAN],
  ])('%s의 요청 번호는 36자 이하이고 [A-Za-z0-9-]만 쓴다', (_label, plan) => {
    const id = requestIdOf(plan);
    expect(id.length).toBeLessThanOrEqual(36);
    expect(id).toMatch(/^[A-Za-z0-9-]+$/);
  });

  it.each([
    ['2000자 메시지', 'x'.repeat(2000)],
    ['한국어 메시지', '사이즈가 맞지 않아 불편을 드려 죄송합니다. 결제하신 $48.00 중 $7.20를 환불해 드리겠습니다.'],
    ['이모지 메시지', '죄송합니다 🙏 환불 진행해 드릴게요 ✅🛍️'],
    ['줄바꿈·탭·따옴표가 섞인 메시지', 'line1\nline2\t"quoted" {"message":"fake"}'],
  ])('%s에서도, 실제 길이의 분쟁 ID·계획 ID에서도 36자 이하다', (_label, message) => {
    for (const plan of [MESSAGE_PLAN, OFFER_PLAN, ACCEPT_PLAN]) {
      const id = requestIdOf(plan, message);
      expect(id.length).toBeLessThanOrEqual(36);
      expect(id).toMatch(/^[A-Za-z0-9-]+$/);
    }
  });
});

describe('요청 번호: 결정적', () => {
  it('같은 계획·같은 메시지로 100번 만들어도 같은 값이다', () => {
    const first = requestIdOf(OFFER_PLAN);
    for (let i = 0; i < 100; i += 1) expect(requestIdOf(OFFER_PLAN)).toBe(first);
  });

  it('계획 객체를 새로 만들어도(같은 값) 같은 요청 번호가 나온다', () => {
    expect(requestIdOf({ ...OFFER_PLAN })).toBe(requestIdOf(OFFER_PLAN));
  });
});

describe('요청 번호: 다른 입력 → 다른 값', () => {
  it('메시지만 다르면 다른 값이다 (같은 분쟁의 두 번째 메시지가 나간다)', () => {
    const a = requestIdOf(MESSAGE_PLAN, 'Could you share a photo of the item?');
    const b = requestIdOf(MESSAGE_PLAN, 'Could you share a photo of the item？');
    const c = requestIdOf(MESSAGE_PLAN, 'Could you share a photo of the item?.');
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('한 글자(공백 하나)만 달라도 다른 값이다', () => {
    expect(requestIdOf(MESSAGE_PLAN, `${MESSAGE} `)).not.toBe(requestIdOf(MESSAGE_PLAN, MESSAGE));
  });

  it('금액만 다른 두 제안은 다른 값이다', () => {
    const a = requestIdOf({ ...OFFER_PLAN, amountCents: 720 });
    const b = requestIdOf({ ...OFFER_PLAN, amountCents: 721 });
    expect(a).not.toBe(b);
  });

  it('환불 유형만 다르면 다른 값이다', () => {
    const a = requestIdOf({ ...OFFER_PLAN, refundType: 'REFUND' });
    const b = requestIdOf({ ...OFFER_PLAN, refundType: 'REFUND_WITH_RETURN' });
    expect(a).not.toBe(b);
  });

  it('엔드포인트가 다르면 다른 값이다', () => {
    const ids = [requestIdOf(MESSAGE_PLAN), requestIdOf(OFFER_PLAN), requestIdOf({ ...ACCEPT_PLAN, amountCents: 720 })];
    expect(new Set(ids).size).toBe(3);
  });

  it('계획 ID만 다르면 다른 값이다', () => {
    const a = requestIdOf({ ...OFFER_PLAN, planId: `${REAL_PLAN_ID}-a` });
    const b = requestIdOf({ ...OFFER_PLAN, planId: `${REAL_PLAN_ID}-b` });
    expect(a).not.toBe(b);
  });
});

describe('요청 번호: 원문이 드러나지 않는다', () => {
  it('메시지 조각·분쟁 ID·계획 ID·금액이 요청 번호에 들어 있지 않다', () => {
    for (const plan of [MESSAGE_PLAN, OFFER_PLAN, ACCEPT_PLAN]) {
      const id = requestIdOf(plan);
      for (const secret of [REAL_DISPUTE_ID, REAL_PLAN_ID, 'sorry', 'refund', '7.20', '48.00', 'REFUND', 'USD']) {
        expect(id).not.toContain(secret);
      }
      // 접두 뒤는 16진수뿐이다 → 사람 글자·대문자·점·밑줄이 남을 수 없다.
      expect(id).toMatch(/^al-[0-9a-f]+$/);
    }
  });
});
