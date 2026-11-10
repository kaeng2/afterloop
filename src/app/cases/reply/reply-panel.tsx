'use client';

/**
 * 답장 칸 (T009 2부 → T061 → T068 한 줄기). 위에서 아래로:
 *
 *  - 칩 줄: "Suggested reply covers:" + 알약 칩 + AI suggests (`view.chips` = `replyChips`. 빈 배열이면 숨김).
 *    코칭 접기("5 coaching tips ▸")는 칩으로 대체했다
 *  - 본문 두 칸 나란히: 왼쪽 "You write (English)" · 오른쪽 "<이름> reads (<언어>)". 두 칸 글자 크기 같다
 *    (`--reply-text-size`). 역번역은 두 칸 아래 "Back-translation ▸" 접기
 *  - 맨 아래 한 줄: 왼쪽 검사(Facts match · No new promises · 확인 기한 날짜 + "More checks ▸" 접기.
 *    **실패한 검사는 접기와 상관없이 늘 보인다** — `visibleChecks`), 오른쪽 끝 전송 모드 작은 글씨
 *    ("Simulated send — nothing goes to PayPal" / "Live · PayPal sandbox") + 보내기 버튼
 *  - 결과 한 줄 · 답장 후 위험
 *
 * - **판정하지 않는다.** 보기용 값은 `buildReplyView`, 버튼은 `canSend`가 정한다 (확인 상자·전송 상태가
 *   바뀔 때마다 다시 부른다). 서버 액션도 같은 판정을 서버에서 다시 한다.
 * - 누르면 바로 버튼이 꺼진다. 실제 전송이면 확인 창을 한 번 거친다. 결과는 버튼 바로 아래에 뜨고
 *   주소는 바뀌지 않는다. 실패 뒤에는 [Try again]을 눌러야 다시 켜진다. [Reset]은 가짜 전송에만 있다.
 * - 보내기에 성공하면 머리글의 위험 배지가 답장 뒤 엔진 값으로 바뀐다 (`useSent`).
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
  canSendOffer,
  REPLY_KEYS,
  visibleChecks,
  type CheckRowView,
  type FactRowView,
  type ReplyViewInput,
  type SendGate,
  type SendKind,
  type SendOutcome,
  type SendState,
} from '../reply-model';
import { useSent } from '../view/sent-state';

import './reply.css';

export type ReplyPanelProps = {
  disputeId: string;
  base: Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;
  replyId: string | null;
  languageKey: string | null;
  /** "<이름> reads (<언어>)"의 이름 (데이터에서). 모르면 `null` (대명사를 쓰지 않고 "The buyer"). */
  buyerShort?: string | null;
};

function CheckGlyph({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'reply-glyph text-success' : 'reply-glyph text-danger'} aria-hidden="true">
      {ok ? '✓' : '✕'}
    </span>
  );
}

function CheckRow({ row }: { row: CheckRowView }) {
  return (
    <li className={row.ok ? 'reply-check' : 'reply-check reply-check-failed'}>
      <CheckGlyph ok={row.ok} />
      <span>{t(row.labelKey)}</span>
      <span className="reply-sr-only">{t(row.ok ? 'case.reply.check.passed' : 'case.reply.check.failed')}</span>
      {row.items.length === 0 ? null : <span className="muted num">{row.items.join(', ')}</span>}
    </li>
  );
}

function FactRow({ fact }: { fact: FactRowView }) {
  return (
    <li className="reply-check">
      <span className="reply-glyph muted" aria-hidden="true">
        ·
      </span>
      <span>{t(fact.labelKey)}</span>
      <span className="num reply-fact">{fact.value}</span>
    </li>
  );
}

/** 접기 한 줄 ("5 coaching tips ▸"). 화살표는 장식이고 펼치면 돈다 (css). */
function FoldSummary({ label }: { label: string }) {
  return (
    <summary className="reply-fold-summary">
      <span>{label}</span>
      <span className="reply-fold-caret" aria-hidden="true">
        ▸
      </span>
    </summary>
  );
}

export function ReplyPanel({ disputeId, base, replyId, languageKey, buyerShort = null }: ReplyPanelProps) {
  const [confirmed, setConfirmed] = useState<CommitmentCategory[]>([]);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const inFlight = useRef(false);
  const { setSent } = useSent();

  const view = buildReplyView({ ...base, confirmed, sendState, outcome });
  const noReply = replyId === null && view.gate.hasDraft;
  const gate: SendGate = noReply ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation } : canSend(view);
  const offerGate: SendGate | null =
    view.offer === null ? null : noReply ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation } : canSendOffer(view);
  const language = languageKey === null ? t('case.send.languageUnknown') : t(languageKey);
  const readsLabel =
    buyerShort === null
      ? t('case.reply.buyerReadsUnknown', { language })
      : t('case.reply.buyerReads', { name: buyerShort, language });

  const checks = visibleChecks(view.checkRows);
  const shownFacts = view.factRows.filter((fact) => fact.primary);
  const foldedFacts = view.factRows.filter((fact) => !fact.primary);
  const hasFolded = checks.folded.length > 0 || foldedFacts.length > 0;

  function toggle(category: CommitmentCategory) {
    setConfirmed((now) => (now.includes(category) ? now.filter((c) => c !== category) : [...now, category]));
  }

  async function send(kind: SendKind) {
    const allowed = kind === 'offer' ? offerGate?.ok === true : gate.ok;
    if (!allowed || replyId === null || inFlight.current) return;
    inFlight.current = true;
    setSendState('sending');
    const confirmText =
      kind === 'offer' && view.offer !== null
        ? t('case.send.confirmLiveOffer', { disputeId, amount: view.offer.amountDisplay })
        : t('case.send.confirmLive', { disputeId });
    if (view.mode === 'live' && !window.confirm(confirmText)) {
      inFlight.current = false;
      setSendState('idle');
      return;
    }
    let next: SendOutcome;
    try {
      next = await sendReplyAction({ disputeId, kind, replyId, confirmedCommitments: confirmed });
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
    setSent(next.ok);
  }

  function again() {
    setOutcome(null);
    setSendState('idle');
    setSent(false);
  }

  const result = view.result;

  return (
    <section className="reply" aria-labelledby="reply-title">
      <h2 className="reply-sr-only" id="reply-title">
        {t('case.reply.title')}
      </h2>

      {view.unavailableKey === null ? null : <p className="notice">{t(view.unavailableKey)}</p>}

      {view.available ? (
        <>
          {view.fixedDraftKey === null ? null : <p className="notice reply-fixed">{t(view.fixedDraftKey)}</p>}

          {/* 4. "Suggested reply covers:" 칩 줄 (칩 글자는 `replyChips` — AI 칩 또는 코칭 줄 그대로) */}
          {view.chips.length === 0 ? null : (
            <div className="reply-chips">
              <h3 className="reply-chips-title">{t('case.reply.covers')}</h3>
              <ul className="reply-chip-list">
                {view.chips.map((chip, index) => (
                  <li key={index} className="reply-chip">
                    {chip}
                  </li>
                ))}
              </ul>
              {view.sourceBadges.map((kind) => (
                <Badge key={kind} kind={kind} />
              ))}
            </div>
          )}

          {/* 5. 답장 두 칸 나란히: 왼쪽 판매자 영어 · 오른쪽 구매자가 받는 글. 두 칸 글자 크기 같다 */}
          <div className="reply-pair">
            {view.draftEn === null ? null : (
              <div className="reply-block reply-box">
                <div className="row">
                  <h3 className="reply-box-title">{t('case.reply.youWrite')}</h3>
                  {view.sourceBadges.map((kind) => (
                    <Badge key={kind} kind={kind} />
                  ))}
                </div>
                <p className="reply-text reply-english" lang="en">
                  {view.draftEn.text}
                </p>
              </div>
            )}

            <div className="reply-block reply-box">
              <div className="row">
                <h3 className="reply-box-title">{readsLabel}</h3>
                {view.outgoing === null ? null : view.sourceBadges.map((kind) => <Badge key={kind} kind={kind} />)}
              </div>
              {view.outgoing === null ? (
                <p className="small muted">{t('case.reply.outgoingUnavailable')}</p>
              ) : (
                <p className="reply-text reply-outgoing" lang={base.buyerLocale ?? undefined}>
                  {view.outgoing.text}
                </p>
              )}
            </div>
          </div>

          {view.backTranslationEn === null ? null : (
            <details className="reply-fold">
              <FoldSummary label={t('case.reply.backTranslation')} />
              <p className="reply-text small">{view.backTranslationEn}</p>
            </details>
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

      {/* 6. 맨 아래 한 줄: 왼쪽 검사(Code decides) · 오른쪽 끝 전송 모드 작은 글씨 + 보내기 버튼 */}
      <div className="reply-foot">
        {view.available && view.checkRows.length > 0 ? (
          <div className="reply-checks">
            <h3 className="reply-sr-only">{t('case.reply.checks')}</h3>
            <ul className="reply-inline small">
              {checks.shown.map((row) => (
                <CheckRow key={row.labelKey} row={row} />
              ))}
              {shownFacts.map((fact) => (
                <FactRow key={fact.token} fact={fact} />
              ))}
            </ul>
            <Badge kind="codeDecides" />
            {hasFolded ? (
              <details className="reply-fold">
                <FoldSummary label={t('case.reply.moreChecks')} />
                <ul className="reply-list small">
                  {checks.folded.map((row) => (
                    <CheckRow key={row.labelKey} row={row} />
                  ))}
                  {foldedFacts.map((fact) => (
                    <FactRow key={fact.token} fact={fact} />
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : (
          <span className="reply-checks" />
        )}

        <div className="reply-actions">
          <span className={view.modeKey === REPLY_KEYS.modeLive ? 'reply-mode reply-mode-live' : 'reply-mode'}>
            {t(view.modeKey)}
          </span>

          {view.offer === null || offerGate === null ? null : (
            <div className="reply-send">
              <button
                type="button"
                className="reply-button"
                disabled={!offerGate.ok}
                aria-describedby="reply-offer-why"
                onClick={() => send('offer')}
              >
                {sendState === 'sending' ? t('case.send.sending') : t('case.send.offerButton', { amount: view.offer.amountDisplay })}
              </button>
              <span id="reply-offer-why" className="small muted reply-why">
                {offerGate.ok || offerGate.reasonKey === null || result !== null ? null : t(offerGate.reasonKey)}
              </span>
            </div>
          )}

          <div className="reply-send">
            <button
              type="button"
              className={view.offer === null ? 'reply-button' : 'reply-button-quiet'}
              disabled={!gate.ok}
              aria-describedby="reply-send-why"
              onClick={() => send('message')}
            >
              {sendState === 'sending' && view.offer === null ? t('case.send.sending') : t('case.send.button', { language })}
            </button>
            <span id="reply-send-why" className="small muted reply-why">
              {gate.ok || gate.reasonKey === null || (result !== null && view.offer === null) ? null : t(gate.reasonKey)}
            </span>
          </div>
        </div>
      </div>

      <div className="reply-result" aria-live="polite">
        {result === null ? null : result.kind === 'simulated' ? (
          <p className="reply-outcome">
            <CheckGlyph ok />
            <span>{t('case.send.simulated')}</span>
          </p>
        ) : result.kind === 'sent' ? (
          <p className="reply-outcome">
            <CheckGlyph ok />
            <span className="num">
              {t('case.send.sent', { endpoint: result.endpoint, status: result.status, disputeId: result.disputeId })}
            </span>
          </p>
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
