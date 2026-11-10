/**
 * S5 Case 서버 읽기 (T009 1부). **서버에서만** 부른다 (PayPal·LLM 비밀값이 브라우저 묶음에 들어가지 않게).
 *
 * 순서:
 *  1. 주소의 분쟁 번호를 연결 표(`config/demo-links.json`)에서 찾는다. 표에 없거나 `showOnScreen`이 거짓
 *     (연습용·시연 제외 분쟁)이면 **PayPal을 읽지 않고** "찾을 수 없음"이다.
 *  2. T047 `loadDemoDisputesForRequest` (같은 요청 안에서 PayPal을 한 번만 읽는다. GET만).
 *  3. 구매자 글 영어: T042 `draftReply`의 `buyerMessageEn`. LLM을 쓸 수 없으면 부르지 않는다.
 *     같은 요청 안에서 한 번만 부르도록 `cache`로 감싼다 — 2부의 답장 칸도 `loadCaseDraft`를 부르면
 *     LLM 호출이 한 번으로 끝난다.
 *
 * 이 파일은 POST를 보내지 않는다. 숫자를 만들지 않는다 (보기용 값은 `../model.ts`가 엔진을 불러 만든다).
 */
import 'server-only';

import { cache } from 'react';

import { draftReply, type ReplyDraft } from '@/ai/reply';
import { recommend } from '@/engine/recommend';
import type { FactToken } from '@/types';

import { seedInquiries } from '../../../../seed/index';
import type { Availability } from '../../_shared/availability';
import { linkFor } from '../../_shared/demo-links';
import { pickBoard, type LoadedDispute } from '../../_shared/dispute-view';
import { loadDemoDisputesForRequest } from '../../_server/disputes';
import { getLlm } from '../../_server/llm';
import { caseMessages, type CaseViewInput } from '../model';
import { buyerLocaleOf, caseReplyFacts } from '../reply-facts';

export type CaseLoad =
  | { kind: 'not_found' }
  | { kind: 'paypal_unavailable'; paypal: Availability }
  | {
      kind: 'ok';
      loaded: LoadedDispute;
      input: CaseViewInput;
      /** T042 초안. LLM을 쓸 수 없거나 실패하면 `ok: false`. */
      draft: ReplyDraft;
      llm: Availability;
    };

/** 화면에 내도 되는 분쟁 번호인가 (연결 표의 `showOnScreen`). 표에 없으면 거짓. */
export function isOnScreen(disputeId: string): boolean {
  return linkFor(disputeId)?.showOnScreen === true;
}

/**
 * T042 초안 (구매자 글 영어 + 코칭 + 영어 초안). 한 요청 안에서 분쟁마다 한 번만 부른다.
 * LLM을 쓸 수 없으면 부르지 않고 `ai_unavailable`이다 (화면은 "AI unavailable — showing rules only").
 */
export const loadCaseDraft = cache(async (disputeId: string): Promise<ReplyDraft> => {
  const unavailable: ReplyDraft = { ok: false, reason: 'ai_unavailable', detail: 'llm_failed:LlmConfigError' };
  if (!isOnScreen(disputeId)) return unavailable;

  const resolved = getLlm();
  if (!resolved.ok) return unavailable;

  const result = await loadDemoDisputesForRequest();
  const loaded = result.disputes.find((dispute) => dispute.disputeId === disputeId);
  if (loaded === undefined) return unavailable;

  const board = pickBoard(loaded);
  const best = recommend(board).best;
  if (board.cause === undefined || best === null) return unavailable;

  // 사실값 = 날짜 + 이름 토큰 (초안은 영어 꼴). 이름 값은 AI에 가지 않는다 — 토큰 이름·뜻만 간다 (T056)
  const buyerLocale = buyerLocaleOf(loaded.buyer) ?? 'en';
  let facts: FactToken[];
  try {
    facts = caseReplyFacts({
      now: new Date().toISOString(),
      dueDate: board.dueDate,
      buyerId: loaded.buyer?.id ?? null,
      buyerLocale,
    }).draft;
  } catch {
    return unavailable; // 날짜를 만들 수 없거나 이름 설정이 깨졌다 → 초안 없음 (지어내지 않는다)
  }

  return draftReply(
    { buyerMessages: loaded.buyerMessages, buyerLocale, cause: board.cause, move: best.move, facts },
    { llm: resolved.llm },
  );
});

/** S5 1부 화면 값의 입력. */
export async function loadCase(disputeId: string): Promise<CaseLoad> {
  // 1. 연습용·시연 제외·표 밖 분쟁은 PayPal을 읽지도 않는다
  if (!isOnScreen(disputeId)) return { kind: 'not_found' };

  // 2. 실제 분쟁 (GET만)
  const result = await loadDemoDisputesForRequest();
  if (!result.paypal.ok) return { kind: 'paypal_unavailable', paypal: result.paypal };
  const loaded = result.disputes.find((dispute) => dispute.disputeId === disputeId);
  if (loaded === undefined) {
    // 표에는 있는데 읽지 못했다 (상세 읽기 실패) → 지어내지 않고 "쓸 수 없음"
    return { kind: 'paypal_unavailable', paypal: { ok: false, reason: result.paypal.reason ?? 'partial' } };
  }

  // 3. 구매자 글 영어 (AI). 없으면 시드 문의의 영어만
  const draft = await loadCaseDraft(disputeId);

  const input: CaseViewInput = {
    disputeId: loaded.disputeId,
    statusCode: loaded.statusCode,
    buyer: loaded.buyer,
    product: loaded.product,
    messages: caseMessages({
      buyerMessages: loaded.buyerMessages,
      buyerMessageEn: draft.ok ? draft.buyerMessageEn : null,
      buyerId: loaded.buyer?.id ?? null,
      inquiries: seedInquiries,
      includeInquiries: loaded.demoFields.includes('earlierInquiries'),
    }),
    boardReal: loaded.boardReal,
    boardDemo: loaded.boardDemo,
    carrierEvents: loaded.carrierEvents,
    signals: loaded.signals,
    signalsAfterReply: loaded.signalsAfterReply,
    demoFields: loaded.demoFields,
  };

  // 초안이 없으면 (키 없음·호출 실패·출력 거부 모두) 화면은 "AI unavailable — showing rules only"
  return { kind: 'ok', loaded, input, draft, llm: draft.ok ? { ok: true } : { ok: false } };
}
