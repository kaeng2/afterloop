/**
 * S5 답장 칸 서버 읽기 (T009 2부). **서버에서만** 부른다.
 *
 * 순서:
 *  1. 1부의 `loadCase` (같은 요청 안에서 PayPal 읽기·`draftReply`는 한 번만 — 1부 화면과 함께 쓴다)
 *  2. "후" 보드(`pickBoard`)로 `recommend` → `planMove` (답장 계획. 만들 수 없으면 `null`)
 *  3. 사실값 `caseReplyFacts` (원래 값. 날짜 = "판매자가 확인해서 다시 연락하는 날" + 이름 토큰. 영어 벌·전송본 벌)
 *  4. 초안: 기본은 AI(`loadCaseDraft`). `AFTERLOOP_FIXED_DRAFT`가 켜졌을 때만 `loadFixedDraft()`
 *  5. 전송본: `translateReply` (LLM 2회. 초안이 있고 구매자 언어를 알 때만)
 *  6. 전송할 수 있는 글을 서버 기억에 두고 번호만 브라우저에 준다 (`rememberReply`)
 *
 * 이 파일은 POST를 보내지 않는다. 숫자를 만들지 않는다.
 */
import 'server-only';

import { cache } from 'react';

import { translateReply, type ReplyDraft, type ReplyTranslation } from '@/ai/reply';
import { planMove } from '@/engine/plan';
import { recommend } from '@/engine/recommend';
import type { ActionPlan, FactToken } from '@/types';

import { pickBoard } from '../../_shared/dispute-view';
import { getLlm } from '../../_server/llm';
import {
  fixedTranslation,
  loadFixedDraft,
  rememberReply,
  resolveDraftSource,
  resolveSendMode,
} from '../../_server/send';
import { buildCaseView } from '../model';
import { caseReplyFacts } from '../reply-facts';
import type { ReplyViewInput } from '../reply-model';
import { loadCase } from '../view/load';

/** 브라우저로 넘기는 값 (직렬화할 수 있는 것만). 전송 상태는 답장 칸이 들고 있다. */
export type ReplyLoad = {
  disputeId: string;
  base: Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;
  /** 서버가 기억한 답장의 번호. 보낼 글이 없으면 `null`. */
  replyId: string | null;
  /** 버튼 글자용 구매자 언어 키 (`case.view.lang.KO` …). */
  languageKey: string | null;
};

const UNAVAILABLE: ReplyDraft = { ok: false, reason: 'ai_unavailable', detail: 'llm_failed:LlmConfigError' };

/** 답장 칸 값. 화면에 내지 않는 분쟁이거나 PayPal을 읽지 못했으면 `null` (1부 화면이 그 상태를 보인다). */
export const loadReply = cache(async (disputeId: string): Promise<ReplyLoad | null> => {
  const loaded = await loadCase(disputeId);
  if (loaded.kind !== 'ok') return null;

  const caseView = buildCaseView(loaded.input);
  const board = pickBoard(loaded.loaded);
  const best = recommend(board).best;

  let plan: ActionPlan | null = null;
  if (best !== null) {
    try {
      plan = planMove(board, best);
    } catch {
      plan = null; // 계획을 만들 수 없는 수 (차단·실행 API 없음). 화면이 몰래 고쳐 넘기지 않는다
    }
  }

  const buyerLocale = caseView.header.buyerLocale;

  // 사실값 = 날짜 + 이름 토큰 (SPEC v2.9 3장). 초안·코칭은 영어 벌, 전송본은 구매자 언어 벌.
  // 1부 `loadCaseDraft`와 같은 함수로 같은 값을 만든다 (초안 검사와 전송본 검사가 같은 토큰을 보게)
  let draftFacts: FactToken[] = [];
  let facts: FactToken[] = [];
  try {
    const both = caseReplyFacts({
      now: new Date().toISOString(),
      dueDate: board.dueDate,
      buyerId: loaded.loaded.buyer?.id ?? null,
      buyerLocale: buyerLocale ?? 'en',
    });
    draftFacts = both.draft;
    facts = both.outgoing;
  } catch {
    draftFacts = [];
    facts = [];
  }
  const draftSource = resolveDraftSource();
  const move = best?.move ?? null;

  let draft: ReplyDraft = UNAVAILABLE;
  let translation: ReplyTranslation | null = null;

  if (draftSource === 'fixed') {
    // 비상용. 사람이 켰을 때만 (저절로 켜지는 길이 없다). 검사는 AI 초안과 똑같이 받는다
    const fixed = loadFixedDraft();
    if (fixed !== null && buyerLocale !== null && move !== null) {
      translation = await fixedTranslation(fixed, { facts, buyerLocale, move });
      draft = {
        ok: true,
        buyerMessageEn: '',
        coaching: fixed.coaching,
        draftEn: fixed.draftEn,
        outsidePolicy: translation.ok ? translation.outsidePolicy : [],
      };
    }
  } else {
    draft = loaded.draft;
    const llm = getLlm();
    if (draft.ok && buyerLocale !== null && move !== null && llm.ok) {
      translation = await translateReply({ draftEn: draft.draftEn, buyerLocale, facts, move }, { llm: llm.llm });
    }
  }

  const replyId =
    draft.ok && translation !== null && translation.ok && buyerLocale !== null
      ? rememberReply({
          disputeId,
          draftSource,
          draftEn: draft.draftEn,
          outgoing: translation.outgoing,
          outsidePolicy: translation.outsidePolicy,
          addedInTranslation: translation.addedInTranslation,
          nameProblems: translation.nameProblems,
          facts,
          buyerLocale,
        })
      : null;

  return {
    disputeId,
    base: {
      draft,
      translation,
      facts,
      draftFacts,
      board,
      statusCode: loaded.loaded.statusCode,
      buyerLocale,
      plan,
      offerFirst: caseView.messageSend.blocked,
      mode: resolveSendMode(),
      draftSource,
      riskAfterReply: caseView.riskAfterReply,
    },
    replyId,
    languageKey: caseView.header.languageKey,
  };
});
