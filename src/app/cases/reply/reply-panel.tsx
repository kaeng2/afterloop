'use client';

/**
 * S5 답장 칸 (T009 2부 7~13번). 코칭 · 영어 초안 · 구매자 언어 전송본 · 검사 · 전송 버튼 · 결과 · 답장 후 위험.
 *
 * - **판정하지 않는다.** 보기용 값은 `buildReplyView`, 버튼은 `canSend`가 정한다 (확인 상자·전송 상태가
 *   바뀔 때마다 다시 부른다). 서버 액션도 같은 판정을 서버에서 다시 한다.
 * - 누르면 바로 버튼이 꺼진다. 실제 전송이면 확인 창을 한 번 거친다. 결과는 버튼 바로 아래에 뜨고
 *   주소는 바뀌지 않는다. 실패 뒤에는 [Try again]을 눌러야 다시 켜진다. [Reset]은 가짜 전송에만 있다.
 * - 글자는 모두 문구 파일에서. 답장 문장은 AI(또는 사람이 켠 고정 초안)가 쓴 것만 보인다.
 *
 * 서버 전용 코드를 import하지 않는다 (서버 액션 `../actions`만 부른다).
 */
import { useRef, useState } from 'react';

import type { CommitmentCategory } from '@/ai/reply';

import { Badge, RiskLevel } from '../../_shared/badges';
import { t } from '../../_shared/copy';
import { sendReplyAction } from '../actions';
import {
  BLOCK_KEYS,
  buildReplyView,
  canSend,
  type ReplyViewInput,
  type SendOutcome,
  type SendState,
} from '../reply-model';

import './reply.css';

export type ReplyPanelProps = {
  disputeId: string;
  base: Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;
  replyId: string | null;
  languageKey: string | null;
};

function CheckGlyph({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'reply-glyph text-success' : 'reply-glyph text-danger'} aria-hidden="true">
      {ok ? '✓' : '✕'}
    </span>
  );
}

export function ReplyPanel({ disputeId, base, replyId, languageKey }: ReplyPanelProps) {
  const [confirmed, setConfirmed] = useState<CommitmentCategory[]>([]);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const inFlight = useRef(false);

  const view = buildReplyView({ ...base, confirmed, sendState, outcome });
  const gate = replyId === null && view.gate.hasDraft ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation } : canSend(view);
  const language = languageKey === null ? t('case.send.languageUnknown') : t(languageKey);

  function toggle(category: CommitmentCategory) {
    setConfirmed((now) => (now.includes(category) ? now.filter((c) => c !== category) : [...now, category]));
  }

  async function send() {
    if (!gate.ok || replyId === null || inFlight.current) return;
    inFlight.current = true;
    setSendState('sending');
    if (view.mode === 'live' && !window.confirm(t('case.send.confirmLive', { disputeId }))) {
      inFlight.current = false;
      setSendState('idle');
      return;
    }
    let next: SendOutcome;
    try {
      next = await sendReplyAction({ disputeId, replyId, confirmedCommitments: confirmed });
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
  }

  function again() {
    setOutcome(null);
    setSendState('idle');
  }

  const result = view.result;

  return (
    <section className="card stack reply" aria-labelledby="reply-title">
      <div className="reply-head">
        <h2 className="section-title" id="reply-title">
          {t('case.reply.title')}
        </h2>
        <span className={view.mode === 'live' ? 'reply-mode reply-mode-live' : 'reply-mode'}>{t(view.modeKey)}</span>
      </div>

      {view.unavailableKey === null ? null : <p className="notice">{t(view.unavailableKey)}</p>}

      {view.available ? (
        <>
          {view.fixedDraftKey === null ? null : <p className="notice reply-fixed">{t(view.fixedDraftKey)}</p>}

          {view.coaching.length === 0 ? null : (
            <div className="reply-block">
              <div className="row">
                <h3 className="label">{t('case.reply.coaching')}</h3>
                {view.sourceBadges.map((kind) => (
                  <Badge key={kind} kind={kind} />
                ))}
              </div>
              <ol className="reply-coaching small">
                {view.coaching.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
            </div>
          )}

          {view.draftEn === null ? null : (
            <div className="reply-block">
              <div className="row">
                <h3 className="label">{t('case.reply.draftEn')}</h3>
                {view.sourceBadges.map((kind) => (
                  <Badge key={kind} kind={kind} />
                ))}
              </div>
              <p className="reply-text">{view.draftEn.text}</p>
            </div>
          )}

          <div className="reply-block">
            <div className="row">
              <h3 className="label">{t('case.reply.outgoing', { language })}</h3>
              {view.outgoing === null
                ? null
                : view.sourceBadges.map((kind) => <Badge key={kind} kind={kind} />)}
            </div>
            {view.outgoing === null ? (
              <p className="small muted">{t('case.reply.outgoingUnavailable')}</p>
            ) : (
              <>
                <p className="reply-text reply-outgoing" lang={base.buyerLocale ?? undefined}>
                  {view.outgoing.text}
                </p>
                {view.backTranslationEn === null ? null : (
                  <details className="reply-details">
                    <summary className="small">{t('case.reply.backTranslation')}</summary>
                    <p className="reply-text small">{view.backTranslationEn}</p>
                  </details>
                )}
              </>
            )}
          </div>

          {view.checkRows.length === 0 ? null : (
            <div className="reply-block reply-checks">
              <div className="row">
                <h3 className="label">{t('case.reply.checks')}</h3>
                <Badge kind="codeDecides" />
              </div>
              <ul className="reply-list small">
                {view.checkRows.map((row) => (
                  <li key={row.labelKey} className="reply-check">
                    <CheckGlyph ok={row.ok} />
                    <span>{t(row.labelKey)}</span>
                    <span className="reply-sr-only">{t(row.ok ? 'case.reply.check.passed' : 'case.reply.check.failed')}</span>
                    {row.items.length === 0 ? null : <span className="muted num">{row.items.join(', ')}</span>}
                  </li>
                ))}
                {view.factRows.map((fact) => (
                  <li key={fact.token} className="reply-check">
                    <span className="reply-glyph muted" aria-hidden="true">
                      ·
                    </span>
                    <span>{t(fact.labelKey)}</span>
                    <span className="num reply-fact">{fact.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {view.addedInTranslation.length === 0 ? null : (
            <div className="notice reply-alert" role="alert">
              <p>{t('case.reply.addedInTranslation')}</p>
              <ul className="reply-list">
                {view.addedInTranslation.map((item) => (
                  <li key={item.category}>{t(item.labelKey)}</li>
                ))}
              </ul>
            </div>
          )}

          {view.commitments.length === 0 ? null : (
            <fieldset className="notice reply-commitments">
              <legend className="small">{t('case.reply.outsidePolicy')}</legend>
              {view.commitments.map((commitment) => (
                <label key={commitment.category} className="reply-confirm small">
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
        </>
      ) : null}

      <div className="reply-send">
        <button type="button" className="reply-button" disabled={!gate.ok} aria-describedby="reply-send-why" onClick={send}>
          {sendState === 'sending' ? t('case.send.sending') : t('case.send.button', { language })}
        </button>
        <span id="reply-send-why" className="small muted">
          {gate.ok || gate.reasonKey === null || result !== null ? null : t(gate.reasonKey)}
        </span>
      </div>

      <div className="reply-result" aria-live="polite">
        {result === null ? null : result.kind === 'simulated' ? (
          <p className="reply-outcome">
            <CheckGlyph ok />
            <span>{t('case.send.simulated')}</span>
          </p>
        ) : result.kind === 'sent' ? (
          <div className="reply-outcome-group">
            <p className="reply-outcome">
              <CheckGlyph ok />
              <span className="num">{t('case.send.sent', { endpoint: result.endpoint, status: result.status })}</span>
            </p>
            <p className="small num">{t('case.send.sandbox', { disputeId: result.disputeId })}</p>
          </div>
        ) : (
          <div className="reply-outcome-group" role="alert">
            <p className="reply-outcome">
              <CheckGlyph ok={false} />
              <span>{result.error}</span>
            </p>
            {result.nothingSent ? <p className="small">{t('case.send.nothingSent')}</p> : null}
            <p className="small muted">
              <span className="reply-next">{t('case.send.next')}</span> {result.nextAction}
            </p>
          </div>
        )}

        {view.canRetry ? (
          <button type="button" className="reply-button-quiet" onClick={again}>
            {t('case.send.tryAgain')}
          </button>
        ) : null}
        {view.canReset ? (
          <button type="button" className="reply-button-quiet" onClick={again}>
            {t('case.send.reset')}
          </button>
        ) : null}
      </div>

      {view.riskAfterReply === null ? null : (
        <p className="row small reply-risk-after">
          <span className="label">{t('case.reply.riskAfter')}</span>
          <RiskLevel band={view.riskAfterReply.band} />
          <span className="num">{t('case.view.riskScore', { score: view.riskAfterReply.score })}</span>
        </p>
      )}
    </section>
  );
}
