'use client';

/**
 * 제안이 먼저인 분쟁(지호)의 짧은 zone-work 카드 (T106, 시안 L345-357 · 차이 목록 F1-55 · F1-56).
 *
 *   AI 알약 · "Offer 15% back ($7.20), the buyer keeps it" · 한 줄 설명 · [Send offer] → "Offer sent ✓"(꺼짐) + Simulated
 *
 * **관문은 답장 칸과 같다**: 보기용 값은 `buildReplyView`, 버튼을 켤지는 `canSendOffer`, 보내기는 서버 액션
 * `sendReplyAction`({ kind: 'offer', replyId, confirmedCommitments })만 — 금액·글은 보내지 않는다(서버가 엔진으로 다시
 * 만든다). 실제 전송 모드면 확인 창을 거친다. 전송 모드(Simulated/Live) 글은 서버가 정한 `modeKey` 그대로 보인다.
 * 금액은 제목·확인 창·버튼 모두 같은 표기(엔진 `amountCents` → `toDollarsCents`, 부르는 쪽이 넘긴다).
 * 이 파일은 PayPal·AI를 부르지 않고 숫자를 만들지 않는다.
 */
import { useRef, useState } from 'react';

import { useT } from '../_shared/locale-context';
import { sendReplyAction } from '../cases/actions';
import {
  BLOCK_KEYS,
  buildReplyView,
  canSendOffer,
  REPLY_KEYS,
  type ReplyViewInput,
  type SendGate,
  type SendOutcome,
  type SendState,
} from '../cases/reply-model';
import { useSavings } from './savings';
import { WorkCard } from './work-card';

/** 판매자가 확인한 약속 범주 (답장 칸과 같은 값). */
type CommitmentCategory = ReplyViewInput['confirmed'][number];

export type OfferWorkProps = {
  disputeId: string;
  base: Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;
  /** 서버가 기억한 답장 번호. 없으면 보낼 수 없다. */
  replyId: string | null;
  /** 카드 제목 (엔진 제안 금액·비율로 서버가 만든 글). */
  title: string;
  /** 한 줄 설명. */
  body: string;
  /** 엔진 제안 금액 표기 (제목과 같은 표기). 확인 창에 쓴다. */
  amount: string;
  /** 구매자가 받을 글 접힘 제목 ("Ji-ho will see (Korean)"). */
  readsLabel: string;
  /** T091 "+$N just now" (엔진 actionSavings 표기). 없으면 금액 없는 완료 알림만. */
  savings?: string | null;
  /** 테스트용 서버 액션 대신. */
  action?: (form: unknown) => Promise<SendOutcome>;
};

export function OfferWork({
  disputeId,
  base,
  replyId,
  title,
  body,
  amount,
  readsLabel,
  savings = null,
  action = sendReplyAction,
}: OfferWorkProps) {
  const t = useT();
  const [confirmed, setConfirmed] = useState<CommitmentCategory[]>([]);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const inFlight = useRef(false);
  const { report, markDone, unmarkDone } = useSavings();
  /** T116 F1-45: 누르는 즉시 "Offer sent ✓"·Done today (시안 동기 setState). 실패·차단이면 되돌린다. */
  const [optimistic, setOptimistic] = useState(false);

  const view = buildReplyView({ ...base, confirmed, sendState, outcome });
  const gate: SendGate =
    replyId === null && view.gate.hasDraft ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation } : canSendOffer(view);
  const sent = sendState === 'done' && outcome !== null && outcome.ok;

  async function send() {
    if (!gate.ok || replyId === null || inFlight.current || sent) return;
    inFlight.current = true;
    setSendState('sending');
    if (view.mode === 'live' && !window.confirm(t('case.send.confirmLiveOffer', { disputeId, amount }))) {
      inFlight.current = false;
      setSendState('idle');
      return;
    }
    // 결과를 모르는 동안은 Simulated로 둔다 (실제로 보냈다고 먼저 말하지 않는다). 실제 전송이면 아래에서 고친다
    setOptimistic(true);
    markDone(disputeId, { simulated: true });
    let next: SendOutcome;
    try {
      next = await action({ disputeId, kind: 'offer', replyId, confirmedCommitments: confirmed });
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

  return (
    <WorkCard titleId={titleId} title={title} body={body} className="offer-work">
      {view.unavailableKey === null ? null : <p className="notice">{t(view.unavailableKey)}</p>}
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

      <div className="offer-work-foot">
        <button
          type="button"
          className="tracking-button"
          disabled={!gate.ok || sendState === 'sending' || sent}
          aria-describedby={whyId}
          onClick={() => void send()}
        >
          {sent || optimistic ? t('today.offer.sent') : sendState === 'sending' ? t('case.send.sending') : t('today.offer.send')}
        </button>
        {/* 전송 모드 표시 (Simulated / Live) — 서버가 정한 값 그대로 */}
        <span className={view.modeKey === REPLY_KEYS.modeLive ? 'offer-work-mode offer-work-mode-live' : 'offer-work-mode'}>
          {t(view.modeKey)}
        </span>
        <span id={whyId} className="small muted">
          {gate.ok || gate.reasonKey === null || result !== null ? null : t(gate.reasonKey)}
        </span>
      </div>

      <div className="offer-work-result" aria-live="polite">
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

      {view.available && view.outgoing !== null ? (
        <details className="offer-work-note">
          <summary className="small">{readsLabel}</summary>
          <p className="small" lang={base.buyerLocale ?? undefined}>
            {view.outgoing.text}
          </p>
        </details>
      ) : null}
    </WorkCard>
  );
}
