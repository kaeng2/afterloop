/**
 * S5 답장 전송 (T009 2부, SPEC v2.7 3·9-1·9-4·9-5장). **서버에서만 부른다.**
 *
 * **기본은 가짜 전송이다.** `AFTERLOOP_REAL_SEND`가 정확히 `"1"`일 때만 실제 전송(`live`)이고, 그 밖은
 * 모두 `simulated` — 네트워크를 타지 않는 `PayPalCaller`를 `executeMove`에 넘긴다. 승인·토큰·계획
 * 검사는 실제와 똑같이 돈다. (변수 이름은 사람 확인 필요. 사람이 `.env`에 직접 넣는다.)
 *
 * 브라우저가 보낸 값은 믿지 않는다. 브라우저는 **분쟁 번호, 준비해 둔 답장의 번호, 확인한 약속 범주**만
 * 보낸다. 글은 화면을 그릴 때 서버가 만들어 이 파일의 기억(`rememberReply`)에 둔 것을 쓰고, 서버가 다시
 * 한다: `loadDemoDisputes` → `recommend` → `offerComesFirst` → `planMove` → `checkTokens` → `fillTokens`
 * → `executeMove`. 승인(`Approval`)은 누른 시각과 계획 ID로 서버가 만든다.
 *
 * 두 번 보내지 않게 하는 장치 (실제 전송):
 *  1. 연결 표: 화면에 내는 분쟁(`showOnScreen`)이면서 `liveSendAllowed`인 것만. 연습용·시연 제외·표 밖은
 *     호출 전에 거부한다 (`guardLiveSend`).
 *  2. 전송 직전에 `getDispute`로 다시 읽어 판매자 글(`posted_by: SELLER`)이 있으면 거부한다 ("already
 *     replied"). 서버를 껐다 켜도 막힌다.
 *  3. `executeMove`가 같은 요청 번호의 두 번째 실행을 호출 없이 이전 결과로 돌려준다. 그 기억은 호출기
 *     함수별이므로 호출기를 프로세스에 하나만 둔다 (`liveCaller`, `SIMULATED_CALLER`).
 *
 * 제안 (T009 2부 재시도 4번): `kind: 'offer'`면 제안이 먼저인 분쟁(`offerComesFirst`)에서만, PayPal 상태가
 * `OFFER_STATUS`일 때만, `planMove`의 make-offer 계획으로 **호출 1회**를 보낸다 (전송본은 `note`.
 * send-message 없음 — `src/exec/request.ts`). 위 관문 셋과 승인·토큰·약속 검사는 메시지와 같다.
 *
 * 이름 (SPEC v2.9 3장): 사실값은 `caseReplyFacts`(날짜 + 이름 토큰)로 서버가 다시 만든다. 이름 값은
 * 설정과 시드 구매자 ID에서만 온다.
 *
 * 비상용 고정 초안: `AFTERLOOP_FIXED_DRAFT`가 정확히 `"1"`일 때만 `resolveDraftSource`가 `'fixed'`다.
 * 초안을 읽는 자리는 `loadFixedDraft()` 한 곳이고, 사람이 파일 위치와 문장을 정하기 전까지 "없음"이다.
 *
 * 남기지 않는 것: 응답 본문, 토큰, 비밀값, 구매자 글·답장 글 (결과에는 엔드포인트 이름·상태 코드·분쟁 번호만).
 */
import 'server-only';

import { createHash } from 'node:crypto';

import { findCommitments } from '@/ai/commitments';
import {
  DRAFT_INPUT_MAX_CHARS,
  translateReply,
  type CommitmentCategory,
  type ReplyMove,
  type ReplyNameProblem,
  type ReplyTranslation,
} from '@/ai/reply';
import { checkTokens, type FactLocale } from '@/ai/tokens';
import { planMove } from '@/engine/plan';
import { offerComesFirst } from '@/engine/policy';
import { recommend } from '@/engine/recommend';
import { detectReplyFeatures } from '@/engine/reply-features';
import { EXEC_COPY, format } from '@/exec/copy';
import { executeMove } from '@/exec/execute';
import { ENDPOINTS } from '@/exec/request';
import { getDispute, type DisputeDetail } from '@/paypal/disputes';
import type { ActionPlan, Approval, DemoLink, FactToken, LlmCaller, Params, PayPalCaller, PayPalClient, PolicyConfig } from '@/types';

import { editAdditions, factsInText, nameLeftovers, revertToTokens, withEditChecks } from '../cases/edited-reply';
import { caseReplyFacts } from '../cases/reply-facts';
import { withMoveFacts } from '../cases/view/load';
import {
  EDIT_KEYS,
  fillFactTokens,
  OFFER_STATUS,
  screenText,
  type EditedPrepareOutcome,
  type DraftSource,
  type SendFailure,
  type SendKind,
  type SendMode,
  type SendOutcome,
} from '../cases/reply-model';
import { t } from '../_shared/copy';
import { demoLinks, linkFor } from '../_shared/demo-links';
import { pickBoard } from '../_shared/dispute-view';
import { loadDemoDisputes, type LoadDemoDisputesResult } from './disputes';
import { recordCaller } from './activity';
import { getLlm } from './llm';
import { resolveDemoMode } from './mode';
import { getPayPalClient } from './paypal';

export type { DraftSource, SendFailure, SendKind, SendMode, SendOutcome };

// ───────────────────────────── 스위치 (순수) ─────────────────────────────

/** 두 스위치 + 모드. 사람이 `.env`에 직접 넣는다 (ui 레인은 `.env`·`.env.example`을 고치지 않는다). */
export type SendEnv = Partial<Record<'AFTERLOOP_REAL_SEND' | 'AFTERLOOP_FIXED_DRAFT' | 'DEMO_MODE', string>>;

/**
 * 실제 전송은 `AFTERLOOP_REAL_SEND`가 **정확히** `"1"`일 때만. 없음·`"true"`·`"0"`·빈 값·공백은 가짜 전송.
 * 그 앞에 모드 관문 (T070): `DEMO_MODE`가 `recording`이 아니면(public) 스위치 값과 무관하게 가짜 전송.
 */
export function resolveSendMode(env: SendEnv = process.env as SendEnv): SendMode {
  if (resolveDemoMode(env) !== 'recording') return 'simulated';
  return env.AFTERLOOP_REAL_SEND === '1' ? 'live' : 'simulated';
}

/** 고정 초안은 `AFTERLOOP_FIXED_DRAFT`가 **정확히** `"1"`일 때만. AI가 실패해도 저절로 켜지지 않는다. */
export function resolveDraftSource(env: SendEnv = process.env as SendEnv): DraftSource {
  return env.AFTERLOOP_FIXED_DRAFT === '1' ? 'fixed' : 'ai';
}

// ───────────────────────────── 고정 초안 (비상용) ─────────────────────────────

/** 고정 초안의 꼴. 날짜는 `⟦DATE_1⟧` 토큰으로만 쓴다 (값은 `replyFacts`가 채운다). */
export type FixedDraft = { coaching: string[]; draftEn: string; outgoing: string; backTranslationEn: string };

/**
 * 고정 초안을 읽는 **유일한** 자리. 파일 위치와 문장은 켤 때 사람이 정한다 — 그때까지 "없음"이다.
 * 이 파일·문구 파일·화면 코드에 초안 문장을 넣지 않는다.
 */
export function loadFixedDraft(): FixedDraft | null {
  return null;
}

/** LLM을 부르지 않는 호출기 (영어 경로의 `translateReply`는 호출 0회다. 불리면 실패로 끝난다). */
const NO_LLM = async (): Promise<unknown> => {
  throw new Error('llm_not_used');
};

/**
 * 고정 초안을 `translateReply`와 같은 꼴로 만든다. 검사는 AI 초안과 똑같이 받는다:
 * 토큰은 `checkTokens`, 초안의 정책 밖 약속은 답장 모듈(영어 경로 = 호출 0회), 전송본에 새로 생긴 약속은
 * `findCommitments`로 초안과 견준다 (`translateReply`의 `addedInTranslation`과 같은 규칙).
 */
export async function fixedTranslation(
  fixed: FixedDraft,
  input: { facts: FactToken[]; buyerLocale: FactLocale; move: ReplyMove },
): Promise<ReplyTranslation> {
  const english = await translateReply(
    { draftEn: fixed.draftEn, buyerLocale: 'en', facts: input.facts, move: input.move },
    { llm: NO_LLM },
  );
  if (!english.ok) return english;

  const outgoing = fixed.outgoing.trim();
  const check = checkTokens(fixed.draftEn.trim(), outgoing, input.facts);
  const inDraft = findCommitments(fixed.draftEn, 'en');
  const added = input.buyerLocale === 'en' ? [] : findCommitments(outgoing, input.buyerLocale).filter((c) => !inDraft.includes(c));
  // 이름 호칭 검사(T056)는 답장 모듈만 한다 — 전송본을 영어 경로(호출 0회)에 한 번 더 넣어 그 칸만 읽는다.
  // 그 경로가 글을 거부하면(전송본에 직접 쓴 값 등) 보낼 수 없는 글로 본다 (막는 쪽으로 틀린다)
  const outgoingNames = await translateReply(
    { draftEn: outgoing, buyerLocale: 'en', facts: input.facts, move: input.move },
    { llm: NO_LLM },
  );
  const nameProblems: ReplyNameProblem[] = outgoingNames.ok ? outgoingNames.nameProblems : [];
  return {
    ok: true,
    outgoing,
    backTranslationEn: fixed.backTranslationEn,
    check,
    sendable:
      check.ok && added.length === 0 && english.outsidePolicy.length === 0 && outgoingNames.ok && nameProblems.length === 0,
    outsidePolicy: english.outsidePolicy,
    addedInTranslation: added,
    nameProblems,
  };
}

// ───────────────────────────── 호출기 ─────────────────────────────

/**
 * 가짜 전송용 호출기. 네트워크를 타지 않는다 — 받은 요청을 보지도 남기지도 않고 200을 돌려준다.
 * 화면은 이 결과를 "Simulated — nothing was sent to PayPal"로 보인다 (진짜 응답처럼 읽히는 표기를 쓰지 않는다).
 */
export function createSimulatedCaller(): PayPalCaller {
  return async () => ({ status: 200, body: { simulated: true } });
}

/** 프로세스에 하나 (같은 요청 번호의 두 번째 실행을 `executeMove`가 기억으로 돌려주게). */
const SIMULATED_CALLER: PayPalCaller = recordCaller(createSimulatedCaller(), { simulated: true });

let liveClient: PayPalClient | null = null;

/** 실제 전송용 PayPal 클라이언트 (샌드박스만). 만들 수 없으면 `null`. 한 번 만들면 다시 쓴다. */
function liveClientOrNull(): PayPalClient | null {
  if (liveClient !== null) return liveClient;
  const resolved = getPayPalClient();
  if (!resolved.ok) return null;
  liveClient = resolved.client;
  return liveClient;
}

// ───────────────────────────── 실제 전송 문지기 (순수) ─────────────────────────────

export type GuardResult = { ok: true } | { ok: false; reason: 'not_allowed' | 'wrong_dispute' | 'already_replied' };

/**
 * 실제 전송 직전의 문지기. 호출하지 않는다 — 넘겨받은 값만 본다.
 * - 연결 표에서 화면에 내는 분쟁이면서 `liveSendAllowed`인 것만 (연습용·시연 제외·표 밖은 거부)
 * - `detail`(방금 다시 읽은 분쟁)이 같은 분쟁이고, 판매자 글이 하나도 없을 때만
 */
export function guardLiveSend(input: { disputeId: string; allowList: DemoLink[]; detail: DisputeDetail }): GuardResult {
  const link = linkFor(input.disputeId, input.allowList);
  if (link === undefined || !link.showOnScreen || !link.liveSendAllowed) return { ok: false, reason: 'not_allowed' };
  if (input.detail.dispute_id !== input.disputeId) return { ok: false, reason: 'wrong_dispute' };
  const replied = input.detail.messages.some((message) => message.posted_by.trim().toUpperCase() === 'SELLER');
  return replied ? { ok: false, reason: 'already_replied' } : { ok: true };
}

// ───────────────────────────── 준비해 둔 답장 (서버 기억) ─────────────────────────────

/** 화면을 그릴 때 서버가 만든 답장. 브라우저는 이 번호만 들고 있다. */
export type PreparedReply = {
  disputeId: string;
  draftSource: DraftSource;
  draftEn: string;
  /** 전송본 (토큰 그대로. 값은 보내기 직전에 채운다). */
  outgoing: string;
  outsidePolicy: CommitmentCategory[];
  addedInTranslation: CommitmentCategory[];
  /** 이름 토큰 둘레 문제 (`translateReply(...).nameProblems`, T056). 비어 있지 않으면 거부한다. */
  nameProblems: ReplyNameProblem[];
  /**
   * 화면을 그릴 때의 **전송본용** 사실값 (원래 값, 날짜 + 이름 = `caseReplyFacts(...).outgoing`).
   * 보낼 때 다시 만든 값과 다르면 거부한다.
   */
  facts: FactToken[];
  buyerLocale: FactLocale;
};

const PREPARED_MAX = 64;
const prepared = new Map<string, PreparedReply>();

/** 같은 답장이면 같은 번호 (분쟁·출처·글·사실값의 해시). 시각·난수를 섞지 않는다. */
export function preparedReplyId(reply: PreparedReply): string {
  const material = JSON.stringify([
    reply.disputeId,
    reply.draftSource,
    reply.draftEn,
    reply.outgoing,
    reply.buyerLocale,
    reply.facts.map((fact) => [fact.token, fact.kind, fact.value]),
  ]);
  return `r-${createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 32)}`;
}

export function rememberReply(reply: PreparedReply): string {
  const id = preparedReplyId(reply);
  prepared.delete(id);
  prepared.set(id, reply);
  while (prepared.size > PREPARED_MAX) {
    const oldest = prepared.keys().next().value;
    if (oldest === undefined) break;
    prepared.delete(oldest);
  }
  return id;
}

export function recallReply(id: string): PreparedReply | null {
  return prepared.get(id) ?? null;
}

// ───────────────────────────── 전송 (주입 가능한 본체) ─────────────────────────────

export type SendReplyInput = {
  disputeId: string;
  /** 보내는 수. 없으면 `message` (send-message). `offer`는 make-offer 1회 (글은 `note`). */
  kind?: SendKind;
  /** 서버가 기억해 둔 답장. 없으면(서버를 다시 켰거나 번호가 틀림) 거부한다. */
  reply: PreparedReply | null;
  confirmedCommitments: CommitmentCategory[];
  /** 판매자가 버튼을 눌렀다 (= 승인). 거짓이면 승인 없이 `executeMove`에 가서 호출 0회로 거부된다. */
  approved: boolean;
};

export type SendReplyDeps = {
  mode: SendMode;
  /** 분쟁 다시 읽기 (GET만). */
  load: () => Promise<LoadDemoDisputesResult>;
  /** 실제 전송 직전 다시 읽기 (GET만). */
  readDetail: (disputeId: string) => Promise<DisputeDetail>;
  /** 실제 호출기. 만들 수 없으면 `null`. 가짜 전송에서는 **부르지 않는다**. */
  liveCall: PayPalCaller | null;
  simulatedCall: PayPalCaller;
  /** 지금 시각 (ISO). 승인 시각과 사실값에 쓴다. */
  now: string;
  links?: DemoLink[];
  params?: Params;
  rules?: PolicyConfig;
};

const fail = (mode: SendMode, failure: SendFailure, errorKey: string, nextKey: string, params?: Record<string, string>): SendOutcome => ({
  ok: false,
  mode,
  failure,
  error: t(errorKey, params),
  nextAction: t(nextKey),
});

const sameFacts = (a: FactToken[], b: FactToken[]) =>
  a.length === b.length && a.every((fact, i) => fact.token === b[i].token && fact.kind === b[i].kind && fact.value === b[i].value);

/** `executeMove`의 다음 할 일 문장으로 실패 종류를 가른다 (문장은 `src/exec/copy.ts`의 것 그대로). */
function failureOf(nextAction: string, endpoint: string): SendFailure {
  if (nextAction === format(EXEC_COPY.nextCheckPayPal, { endpoint })) return 'paypal_error';
  if (nextAction === format(EXEC_COPY.nextRetry, { endpoint })) return 'network';
  return 'rejected';
}

/**
 * 답장 1건 전송. 모든 거부는 **호출 전에** 일어난다 (가짜 전송이면 실제 호출기는 한 번도 불리지 않는다).
 * 예외를 던지지 않는다 — 결과는 늘 `SendOutcome`이다.
 */
export async function sendReply(input: SendReplyInput, deps: SendReplyDeps): Promise<SendOutcome> {
  const { mode } = deps;
  const kind: SendKind = input.kind ?? 'message';
  const links = deps.links ?? demoLinks;
  const apiMove = kind === 'offer' ? 'make_offer' : 'send_message';
  const endpoint = ENDPOINTS[apiMove] ?? apiMove;

  // 1. 화면에 내는 분쟁만. 실제 전송은 허용 목록에 있는 분쟁만 (호출 0회)
  const link = linkFor(input.disputeId, links);
  if (link === undefined || !link.showOnScreen) {
    return fail(mode, 'blocked', 'case.send.error.notOnScreen', 'case.send.next.openFromInbox');
  }
  if (mode === 'live' && !link.liveSendAllowed) {
    return fail(mode, 'blocked', 'case.send.error.liveNotAllowed', 'case.send.next.liveNotAllowed');
  }

  // 2. 서버가 준비해 둔 답장이 이 분쟁의 것인지
  const reply = input.reply;
  if (reply === null || reply.disputeId !== input.disputeId) {
    return fail(mode, 'blocked', 'case.send.error.replyExpired', 'case.send.next.reload');
  }

  // 3. 정책 밖 약속 (답장 모듈이 준 값만 본다). 번역이 더한 약속은 확인으로 풀리지 않는다
  if (reply.addedInTranslation.length > 0) {
    return fail(mode, 'blocked', 'case.send.error.addedInTranslation', 'case.send.next.retranslate');
  }
  if (!reply.outsidePolicy.every((category) => input.confirmedCommitments.includes(category))) {
    return fail(mode, 'blocked', 'case.send.error.unconfirmed', 'case.send.next.confirm');
  }
  // 이름 호칭 겹침 ("⟦BUYER_NAME_1⟧ 님") — 답장 모듈(T056)이 준 값. 확인으로 풀리지 않는다
  if (reply.nameProblems.length > 0) {
    return fail(mode, 'blocked', 'case.send.error.nameHonorific', 'case.send.next.regenerate');
  }

  // 4. 분쟁 다시 읽기 → 보드 → 추천 (같은 보드로 방금 만든 추천)
  let loaded: LoadDemoDisputesResult;
  try {
    loaded = await deps.load();
  } catch {
    return fail(mode, 'network', 'case.send.error.paypalUnavailable', 'case.send.next.tryLater');
  }
  const dispute = loaded.disputes.find((candidate) => candidate.disputeId === input.disputeId);
  if (!loaded.paypal.ok || dispute === undefined) {
    return fail(mode, 'network', 'case.send.error.paypalUnavailable', 'case.send.next.tryLater');
  }
  const board = pickBoard(dispute);
  const recommendation = recommend(board, deps.params, deps.rules);

  // 5. 제안이 먼저면 메시지만 보내지 않는다 (화면만 믿지 않는다). 제안은 제안이 먼저인 분쟁에서만
  const offerFirst = offerComesFirst(board, recommendation);
  if (kind === 'message' && offerFirst) {
    return fail(mode, 'blocked', 'case.send.error.offerFirst', 'case.view.offerFirst');
  }
  if (kind === 'offer') {
    if (!offerFirst) return fail(mode, 'blocked', 'case.send.error.offerNotRecommended', 'case.send.next.reload');
    // make-offer는 판매자 답을 기다리는 상태에서만 된다 (방금 다시 읽은 상태로 본다)
    if (dispute.statusCode !== OFFER_STATUS) {
      return fail(mode, 'blocked', 'case.send.error.offerStatus', 'case.send.next.checkPayPal');
    }
  }

  // 6. 계획 (메시지 = 다투기 + send_message, 제안 = 제안 + make_offer. 금액은 엔진 계획의 것)
  const best = recommendation.best;
  // 메시지는 다투기(fight) 또는 무료 수선 안내(repair) 추천일 때만 — 둘 다 실행은 send_message
  const moveOk = (move: string): boolean => (kind === 'offer' ? move === 'offer' : move === 'fight' || move === 'repair');
  let plan: ActionPlan | null = null;
  if (best !== null && moveOk(best.move) && best.apiMove === apiMove) {
    try {
      plan = planMove(board, best, deps.params, deps.rules);
    } catch {
      plan = null;
    }
  }
  if (plan === null || plan.apiMove !== apiMove) {
    return fail(mode, 'blocked', 'case.send.error.noPlan', 'case.send.next.handleOnPayPal');
  }

  // 7. 사실값 (날짜 + 이름): 서버가 다시 만들고, 화면을 그릴 때의 값과 같아야 한다 (날짜가 바뀌었으면 다시 읽게).
  //    이름은 시드 연결의 구매자 ID와 설정(`reply.names`)에서만 — 브라우저에서 받지 않는다
  let facts: FactToken[];
  try {
    // 화면을 그릴 때와 같은 함수: repair면 수선 기간 `⟦DAYS_1⟧`가 더해진다 (T122g)
    facts = withMoveFacts(
      caseReplyFacts({
        now: deps.now,
        dueDate: board.dueDate,
        buyerId: dispute.buyer?.id ?? null,
        buyerLocale: reply.buyerLocale,
      }),
      best?.move ?? null,
    ).outgoing;
  } catch {
    return fail(mode, 'blocked', 'case.send.error.replyExpired', 'case.send.next.reload');
  }
  if (!sameFacts(facts, reply.facts)) {
    return fail(mode, 'blocked', 'case.send.error.factsChanged', 'case.send.next.reload');
  }

  // 8. 토큰 검사를 서버에서 다시 (화면의 결과를 믿지 않는다)
  const check = checkTokens(reply.draftEn, reply.outgoing, facts);
  if (!check.ok) {
    return fail(mode, 'blocked', 'case.send.error.checkFailed', 'case.send.next.regenerate');
  }

  // 9. 채우기: 원래 값 → 구매자 언어 표기 → 전송본의 토큰 자리. 화면 미리보기(`screenText`)와 같은 함수다.
  //    금액 자리표시자는 `executeMove`가 실행 층(`fillMessage`)에서 채운다 — 미리보기도 같은 함수를 지난다
  let messageTemplate: string;
  try {
    messageTemplate = fillFactTokens(reply.outgoing, facts, reply.buyerLocale);
  } catch {
    return fail(mode, 'blocked', 'case.send.error.checkFailed', 'case.send.next.regenerate');
  }

  // 10. 실제 전송: 연결 표 + 다시 읽은 분쟁에 판매자 글이 없을 때만
  let call: PayPalCaller;
  if (mode === 'live') {
    if (deps.liveCall === null) {
      return fail(mode, 'blocked', 'case.send.error.liveNotConfigured', 'case.send.next.liveNotConfigured');
    }
    let detail: DisputeDetail;
    try {
      detail = await deps.readDetail(input.disputeId);
    } catch {
      return fail(mode, 'network', 'case.send.error.readFailed', 'case.send.next.tryLater');
    }
    const guard = guardLiveSend({ disputeId: input.disputeId, allowList: links, detail });
    if (!guard.ok) {
      return guard.reason === 'already_replied'
        ? fail(mode, 'already_replied', 'case.send.error.alreadyReplied', 'case.send.next.checkPayPal')
        : fail(mode, 'blocked', 'case.send.error.liveNotAllowed', 'case.send.next.liveNotAllowed');
    }
    call = deps.liveCall;
  } else {
    call = deps.simulatedCall;
  }

  // 11. 승인은 서버가 만든다 (누른 시각 + 계획 ID)
  const approval: Approval | null = input.approved
    ? { planId: plan.planId, approvedBy: 'seller', approvedAt: deps.now }
    : null;

  const result = await executeMove({ board, plan, messageTemplate, approval }, { call });
  if (!result.ok) {
    return { ok: false, mode, failure: failureOf(result.nextAction, endpoint), error: result.error, nextAction: result.nextAction };
  }

  if (mode === 'simulated') return { ok: true, mode, disputeId: input.disputeId };
  const sent = result.sent[0];
  return { ok: true, mode, disputeId: input.disputeId, endpoint, status: sent.status };
}

// ───────────────────────────── 화면에서 부르는 입구 ─────────────────────────────

/**
 * 서버 액션(`src/app/cases/actions.ts`)이 부른다. 실제 의존성을 꽂는다.
 * 가짜 전송이면 실제 PayPal 클라이언트의 `call`을 넘기지도 않는다.
 */
export async function sendFromScreen(form: {
  disputeId: string;
  kind: SendKind;
  replyId: string;
  confirmedCommitments: CommitmentCategory[];
}): Promise<SendOutcome> {
  const mode = resolveSendMode();
  const client = mode === 'live' ? liveClientOrNull() : null;
  return sendReply(
    {
      disputeId: form.disputeId,
      kind: form.kind,
      reply: recallReply(form.replyId),
      confirmedCommitments: form.confirmedCommitments,
      approved: true,
    },
    {
      mode,
      load: () => loadDemoDisputes(),
      readDetail: async (disputeId) => {
        if (client === null) throw new Error('paypal_unavailable');
        return getDispute(client, disputeId);
      },
      liveCall: client === null ? null : client.call,
      simulatedCall: SIMULATED_CALLER,
      now: new Date().toISOString(),
    },
  );
}

// ───────────────────────────── 고친 글 입구 (T100) ─────────────────────────────

/**
 * 고친 글 → 토큰 되돌리기 → `translateReply` → `sendable` 확인 (T100, DECISIONS 2026-11-12 "Yes, allow edited send").
 * **보내지 않는다.** 검사를 통과한 글만 서버 기억(`rememberReply`)에 두고 번호를 돌려준다 — 보내기는 그 번호로
 * 위의 `sendReply`(관문·데모 모드·기록 규칙 그대로)를 지난다. 이 입구는 POST를 하지 않는다 (`load`는 GET만).
 *
 * 순서 (모든 거부는 **AI 호출 전에**):
 *  1. 화면에 내는 분쟁 · 서버가 기억한 AI 답장(같은 분쟁) · 글 길이
 *  2. 분쟁 다시 읽기 → 추천 → 메시지 계획만 (제안이 먼저인 분쟁·계획 없음은 거부)
 *  3. 사실값 다시 만들기 (화면을 그릴 때 값과 같아야 한다)
 *  4. 값 → 토큰 (`revertToTokens`, 영어 초안 벌)
 *  5. 환불 상태: 고친 글이 "환불했다"고 말하면(엔진 `refundNow`, AI 초안에는 없음) 거부 — 환불은 시뮬레이션뿐이다
 *  6. 이름 조각이 남았으면 거부 (AI에 이름 값을 보내지 않는다. SPEC 3장 v2.9)
 *  7. AI 없음 → 거부. `translateReply` (번역 + 역번역 + 검사) → 보낼 글 기준 검사 더하기 (`withEditChecks`)
 *  8. 채울 수 있는지(`screenText` = 보낼 때와 같은 채움)까지 통과하면 기억하고 번호를 준다
 */
export type PrepareEditedInput = {
  disputeId: string;
  /** 화면을 그릴 때 서버가 기억한 AI 답장 (검사받은 원래 초안). 없으면 거부. */
  reply: PreparedReply | null;
  /** 입력칸 글 (화면에 채워 보인 영어). 신뢰하지 않는 입력. */
  text: string;
};

export type PrepareEditedDeps = {
  load: () => Promise<LoadDemoDisputesResult>;
  /** AI 호출기. 쓸 수 없으면 `null` (공개 모드 시간당 한도·캐시는 `getLlm`이 그대로 건다). */
  llm: LlmCaller | null;
  now: string;
  links?: DemoLink[];
  params?: Params;
  rules?: PolicyConfig;
};

const editFail = (reasonKey: string): EditedPrepareOutcome => ({ ok: false, reasonKey });

export async function prepareEditedReply(input: PrepareEditedInput, deps: PrepareEditedDeps): Promise<EditedPrepareOutcome> {
  const links = deps.links ?? demoLinks;
  const link = linkFor(input.disputeId, links);
  if (link === undefined || !link.showOnScreen) return editFail(EDIT_KEYS.expired);
  const reply = input.reply;
  if (reply === null || reply.disputeId !== input.disputeId) return editFail(EDIT_KEYS.expired);
  const text = input.text.trim();
  if (text === '' || text.length > DRAFT_INPUT_MAX_CHARS) return editFail(EDIT_KEYS.invalid);

  let loaded: LoadDemoDisputesResult;
  try {
    loaded = await deps.load();
  } catch {
    return editFail(EDIT_KEYS.expired);
  }
  const dispute = loaded.disputes.find((candidate) => candidate.disputeId === input.disputeId);
  if (!loaded.paypal.ok || dispute === undefined) return editFail(EDIT_KEYS.expired);
  const board = pickBoard(dispute);
  const recommendation = recommend(board, deps.params, deps.rules);
  const best = recommendation.best;
  if (offerComesFirst(board, recommendation) || best === null || best.move !== 'fight' || best.apiMove !== 'send_message') {
    return editFail(EDIT_KEYS.noPlan);
  }
  let plan: ActionPlan;
  try {
    plan = planMove(board, best, deps.params, deps.rules);
  } catch {
    return editFail(EDIT_KEYS.noPlan);
  }

  let both: { draft: FactToken[]; outgoing: FactToken[] };
  try {
    both = caseReplyFacts({ now: deps.now, dueDate: board.dueDate, buyerId: dispute.buyer?.id ?? null, buyerLocale: reply.buyerLocale });
  } catch {
    return editFail(EDIT_KEYS.expired);
  }
  if (!sameFacts(both.outgoing, reply.facts)) return editFail(EDIT_KEYS.expired);

  const tokenized = revertToTokens(text, both.draft, { plan, board }, reply.draftEn);

  // 판정할 수 없으면 환불이라고 본다 (막는 쪽으로 틀린다)
  const saysRefunded = (value: string) => {
    try {
      return detectReplyFeatures(value).features.refundNow;
    } catch {
      return true;
    }
  };
  if (saysRefunded(tokenized) && !saysRefunded(reply.draftEn)) return editFail(EDIT_KEYS.refundSimulated);

  if (nameLeftovers(tokenized, [...both.draft, ...both.outgoing]).length > 0) return editFail(EDIT_KEYS.nameLiteral);

  if (deps.llm === null) return editFail(EDIT_KEYS.aiUnavailable);
  const raw = await translateReply(
    { draftEn: tokenized, buyerLocale: reply.buyerLocale, facts: factsInText(tokenized, reply.facts), move: best.move },
    { llm: deps.llm },
  );
  if (!raw.ok) {
    return editFail(raw.reason === 'invalid_output' && raw.detail.startsWith('draft_') ? EDIT_KEYS.invalid : EDIT_KEYS.aiUnavailable);
  }
  const checked = withEditChecks(raw, editAdditions(reply.draftEn, tokenized, reply.facts));
  if (!checked.ok) return editFail(EDIT_KEYS.aiUnavailable);

  if (!screenText(checked.outgoing, reply.facts, reply.buyerLocale, { plan, board }).filled) return editFail(EDIT_KEYS.invalid);

  const passes = checked.check.ok && checked.addedInTranslation.length === 0 && checked.nameProblems.length === 0;
  const replyId = passes
    ? rememberReply({
        disputeId: input.disputeId,
        draftSource: reply.draftSource,
        draftEn: tokenized,
        outgoing: checked.outgoing,
        outsidePolicy: checked.outsidePolicy,
        addedInTranslation: checked.addedInTranslation,
        nameProblems: checked.nameProblems,
        facts: reply.facts,
        buyerLocale: reply.buyerLocale,
      })
    : null;
  return { ok: true, replyId, draftEn: tokenized, translation: checked };
}

/** 서버 액션이 부른다. 실제 의존성(GET 읽기 · `getLlm`)을 꽂는다. PayPal 쓰기 호출기는 넘기지도 않는다. */
export async function prepareEditedFromScreen(form: { disputeId: string; replyId: string; text: string }): Promise<EditedPrepareOutcome> {
  const llm = getLlm();
  return prepareEditedReply(
    { disputeId: form.disputeId, reply: recallReply(form.replyId), text: form.text },
    { load: () => loadDemoDisputes(), llm: llm.ok ? llm.llm : null, now: new Date().toISOString() },
  );
}
