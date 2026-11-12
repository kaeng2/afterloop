'use client';

/**
 * 지호(#1038) 한 장 카드 (T106 → T122c 시안 v6 L443–L478, 차이 목록 V6-B45 ~ V6-B51). 두 갈래를 **데이터로** 고른다
 * (`case-detail.tsx`가 엔진 최선 수로):
 *
 *   - `kind: 'message'` = 새 품질 사건 + 엔진 `repair` 수 → 실행 send-message (돈이 움직이지 않음)
 *   - `kind: 'offer'`   = 기존 색상 사례 + 엔진 `offer` 수 (15% $7.20) → 실행 make-offer
 *
 *   [구매자 대화] · AI 알약 · 제목 · 설명 · "Keeps ≈$N" · "How AI handled this" 4단계 ·
 *   "What the buyer will receive (L)" + Translated · "On approval" + 호출 이름 · [Send] → "Sent ✓"(꺼짐) + Simulated
 *
 * **관문은 답장 칸과 같다**: 보기용 값은 `buildReplyView`, 버튼을 켤지는 `canSendOffer`(제안) / `canSend`(메시지),
 * 보내기는 서버 액션 `sendReplyAction`({ kind, replyId, confirmedCommitments })만 — 금액·글은 보내지 않는다(서버가
 * 엔진으로 다시 만든다). 실제 전송 모드면 확인 창을 거친다. 전송 모드(Simulated/Live) 글은 서버가 정한 `modeKey` 그대로.
 * 보낼 글은 서버가 검사한 전송본(`view.outgoing`)만 보인다 — 없으면 상자 대신 "AI 답장이 준비되지 않음" 알림.
 * 이 파일은 PayPal·AI를 부르지 않고 숫자를 만들지 않는다.
 */
import { useRef, useState } from 'react';

import { useLocale, useT } from '../_shared/locale-context';
import { sendReplyAction } from '../cases/actions';
import {
  BLOCK_KEYS,
  buildReplyView,
  canSend,
  canSendOffer,
  REPLY_KEYS,
  type ReplyViewInput,
  type SendGate,
  type SendOutcome,
  type SendState,
} from '../cases/reply-model';
import { OneCard, translatedFor, type OneCardMessage } from './one-card';
import { useSavings } from './savings';

/** 판매자가 확인한 약속 범주 (답장 칸과 같은 값). */
type CommitmentCategory = ReplyViewInput['confirmed'][number];

export type OfferWorkProps = {
  disputeId: string;
  base: Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;
  /** 서버가 기억한 답장 번호. 없으면 보낼 수 없다. */
  replyId: string | null;
  /** 갈래: `offer` = make-offer (기존 색상 사례), `message` = send-message (repair). 서버가 엔진 계획으로 고른다. */
  kind?: 'offer' | 'message';
  /** 카드 제목 (엔진 값·데이터로 서버가 만든 글). */
  title: string;
  /** 한 줄 설명. */
  body: string;
  /** 엔진 제안 금액 표기 (제목과 같은 표기). 제안 확인 창에 쓴다. 메시지 갈래는 `null`. */
  amount: string | null;
  /** 구매자 언어 이름 ("Korean"). "What the buyer will receive (Korean)". */
  languageName: string;
  /** "Keeps ≈$N" (엔진 `actionSavings` 표기를 문구에 넣은 글). 없으면 알약 없음. */
  keep?: string | null;
  /** "How AI handled this" 단계 글 (서버가 엔진·데이터 값으로 채운 문구). */
  steps?: string[];
  /** 구매자 대화 (실제 분쟁 글). 없으면 칸 없음. */
  message?: OneCardMessage | null;
  /** "On approval" 호출 이름 (실제 이름만: make-offer / send-message). */
  api: string;
  /** T091 "+$N just now" (엔진 actionSavings 표기). 없으면 금액 없는 완료 알림만. */
  savings?: string | null;
  /** 테스트용 서버 액션 대신. */
  action?: (form: unknown) => Promise<SendOutcome>;
};

export function OfferWork({
  disputeId,
  base,
  replyId,
  kind = 'offer',
  title,
  body,
  amount,
  languageName,
  keep = null,
  steps = [],
  message = null,
  api,
  savings = null,
  action = sendReplyAction,
}: OfferWorkProps) {
  const t = useT();
  const uiLocale = useLocale();
  const [confirmed, setConfirmed] = useState<CommitmentCategory[]>([]);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const inFlight = useRef(false);
  const { report, markDone, unmarkDone } = useSavings();
  /** T116 F1-45: 누르는 즉시 "Sent ✓"·Done today (시안 동기 setState). 실패·차단이면 되돌린다. */
  const [optimistic, setOptimistic] = useState(false);

  const view = buildReplyView({ ...base, confirmed, sendState, outcome });
  const gate: SendGate =
    replyId === null && view.gate.hasDraft
      ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation }
      : kind === 'offer'
        ? canSendOffer(view)
        : canSend(view);
  const sent = sendState === 'done' && outcome !== null && outcome.ok;

  async function send() {
    if (!gate.ok || replyId === null || inFlight.current || sent) return;
    inFlight.current = true;
    setSendState('sending');
    const confirmText =
      kind === 'offer' && amount !== null
        ? t('case.send.confirmLiveOffer', { disputeId, amount })
        : t('case.send.confirmLive', { disputeId });
    if (view.mode === 'live' && !window.confirm(confirmText)) {
      inFlight.current = false;
      setSendState('idle');
      return;
    }
    // 결과를 모르는 동안은 Simulated로 둔다 (실제로 보냈다고 먼저 말하지 않는다). 실제 전송이면 아래에서 고친다
    setOptimistic(true);
    markDone(disputeId, { simulated: true });
    let next: SendOutcome;
    try {
      next = await action({ disputeId, kind, replyId, confirmedCommitments: confirmed });
    } catch {
      next = {
        ok: false,
        mode: view.mode,
        failure: 'network',
        error: t('case.send.error.unexpected'),
        nextAction: t('case.send.next.tryLater'),
      };
    }
    inFlight.current = false;
    setOutcome(next);
    setSendState(next.ok ? 'done' : 'failed');
    setOptimistic(false);
    if (next.ok) {
      // T091 · T102: 이번 주 카드 알림 + 목록에서 "Done today"로 (화면 상태만. 가짜 전송은 Simulated)
      report(savings);
      markDone(disputeId, { simulated: next.mode === 'simulated' });
    } else {
      // 실패·차단: Done today에서 되돌리고 실패 글(아래 결과 줄)을 보인다 — 실패를 성공처럼 남기지 않는다
      unmarkDone(disputeId);
    }
  }

  function retry() {
    setOutcome(null);
    setSendState('idle');
  }

  const toggle = (category: CommitmentCategory) =>
    setConfirmed((now) => (now.includes(category) ? now.filter((c) => c !== category) : [...now, category]));

  const result = view.result;
  const titleId = `offer-work-title-${disputeId}`;
  const whyId = `offer-work-why-${disputeId}`;
  const done = sent || optimistic;
  const code = base.buyerLocale === null ? null : base.buyerLocale.slice(0, 2).toLowerCase();
  const draftText = view.available && view.outgoing !== null ? view.outgoing.text : null;
  // Translated 줄 = 영어 역번역. 화면이 영어이고 보낼 글이 영어가 아닐 때만 (KO 화면은 시안 ko 사전처럼 비운다)
  const draftTr = uiLocale === 'en' ? translatedFor(view.backTranslationEn, code, uiLocale) : null;

  return (
    <OneCard
      titleId={titleId}
      title={title}
      body={body}
      keep={keep}
      message={message}
      steps={steps}
      className="offer-work"
      draft={
        draftText === null
          ? null
          : {
              title: t(done ? 'card.draftSentT' : 'card.draftT', { language: languageName }),
              code,
              original: draftText,
              translated: draftTr,
              sent: done,
            }
      }
      approval={{ label: t('card.apiT'), api }}
      action={
        <>
          <button
            type="button"
            className="btn b-black"
            disabled={!gate.ok || sendState === 'sending' || sent}
            aria-describedby={whyId}
            onClick={() => void send()}
          >
            {done ? t('card.sent') : sendState === 'sending' ? t('case.send.sending') : t('card.send')}
          </button>
          {/* 전송 모드 표시 (Simulated / Live) — 서버가 정한 값 그대로 */}
          <span className={view.modeKey === REPLY_KEYS.modeLive ? 'oc-mode offer-work-mode offer-work-mode-live' : 'oc-mode offer-work-mode'}>
            {t(view.modeKey)}
          </span>
        </>
      }
    >
      {draftText === null ? <p className="notice">{t(view.unavailableKey ?? 'card.noDraft')}</p> : null}
      {view.addedInTranslation.length === 0 ? null : (
        <div className="notice" role="alert">
          <p>{t('case.reply.addedInTranslation')}</p>
          <ul className="reply-list">
            {view.addedInTranslation.map((item) => (
              <li key={item.category}>{t(item.labelKey)}</li>
            ))}
          </ul>
        </div>
      )}
      {view.commitments.length === 0 ? null : (
        <fieldset className="notice offer-work-commitments">
          <legend className="small">{t('case.reply.outsidePolicy')}</legend>
          {view.commitments.map((commitment) => (
            <label key={commitment.category} className="small offer-work-confirm">
              <input
                type="checkbox"
                checked={commitment.confirmed}
                disabled={sendState !== 'idle'}
                onChange={() => toggle(commitment.category)}
              />
              <span>{t('case.reply.confirmCommitment', { promise: t(commitment.labelKey) })}</span>
            </label>
          ))}
        </fieldset>
      )}
      <span id={whyId} className="small muted" hidden={gate.ok || gate.reasonKey === null || result !== null}>
        {gate.ok || gate.reasonKey === null || result !== null ? null : t(gate.reasonKey)}
      </span>
      {/* 빈 칸이 카드 gap(18px)을 차지하지 않게 결과가 없으면 숨긴다 (자리는 그대로 — T118) */}
      <div className="offer-work-result" aria-live="polite" hidden={result === null}>
        {result === null ? null : result.kind === 'simulated' ? (
          <p className="small">{t('case.send.simulated')}</p>
        ) : result.kind === 'sent' ? (
          <p className="small num">
            {t('case.send.sent', { endpoint: result.endpoint, status: result.status, disputeId: result.disputeId })}
          </p>
        ) : (
          <div role="alert" className="small">
            <p>{result.error}</p>
            {result.nothingSent ? <p>{t('case.send.nothingSent')}</p> : null}
            <p className="muted">
              {t('case.send.next')} {result.nextAction}
            </p>
            {view.canRetry ? (
              <button type="button" className="reply-button-quiet" onClick={retry}>
                {t('case.send.tryAgain')}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </OneCard>
  );
}
