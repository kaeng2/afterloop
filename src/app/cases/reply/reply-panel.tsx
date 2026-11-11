'use client';

/**
 * 답장 칸 (T009 2부 → T061 → T068 → T076 시안 v4 "2 Your reply"). 위에서 아래로:
 *
 *  - 머리 줄: "Your reply" + [Try a rushed reply] [Use AI draft] [Clear]
 *  - 두 칸 나란히: 왼쪽 **입력칸**(처음 글 = AI 영어 초안을 실제 값으로 채운 미리보기) + 모서리 차지백 %(예측) +
 *    아래 "As you type" 칩(엔진 특징 판정, 어댑터. 없으면 지금 "Suggested reply covers" 칩) · 오른쪽
 *    "<이름> reads (<언어>)" = **검사받은 전송본**
 *  - 입력칸 글이 초안과 다르면 "Edited text can't be sent — use AI draft" (보내기 꺼짐, `editGate`)
 *  - "Her likely reaction" 막대(기다림·환불·차지백) + Expected cost + Her mood next (예측 어댑터, Assumption. 없으면 숨김)
 *  - 맨 아래 한 줄: 검사(Facts match · No new promises · 확인 기한 + "More checks ▸") · 전송 모드 글자 · 보내기 버튼
 *  - 결과 한 줄 · 답장 후 위험
 *
 * 제안이 먼저인 분쟁은 시안의 짧은 카드: "Offer N% back ($X), the buyer keeps it" + 한 줄 + 전송본 접기 +
 * 검사 줄 + [Send offer · $7] (금액·비율은 엔진 값, 관문은 그대로).
 *
 * **보내는 글은 바뀌지 않는다.** 버튼은 서버가 기억한 답장 번호(`replyId`)만 보낸다 — 입력칸 글은 서버로 가지 않고
 * 예측을 바꾸는 데만 쓴다. 관문(`canSend`·`canSendOffer`)·확인 창·전송 모드·서버 액션은 T068 그대로다.
 *
 * - **판정하지 않는다.** 보기용 값은 `buildReplyView`, 버튼은 `canSend`(+ `editGate`)가 정한다.
 * - 예측은 브라우저 어댑터(`../forecast-client.ts`)만 부른다. 지금은 `null` → 예측 칸이 숨는다.
 * - 글자는 모두 문구 파일에서. 답장 문장은 AI(또는 사람이 켠 고정 초안)가 쓴 것만 보인다 — "Try a rushed reply"
 *   예시 글(문구 키)은 예측을 보여 주는 용도이고 보낼 수 없다.
 *
 * 서버 전용 코드를 import하지 않는다 (서버 액션 `../actions`만 부른다).
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import type { CommitmentCategory } from '@/ai/reply';
import type { EscalationSignals, ReplyForecast } from '@/types';

import { Badge, RiskLevel } from '../../_shared/badges';
import { t } from '../../_shared/copy';
import { toDollarsCents } from '../../_shared/money';
import { toPercentRounded } from '../../_shared/percent';
import { sendReplyAction } from '../actions';
import { featureChips, reactionView, type FeatureChipView, type ReactionView } from '../desk-model';
import {
  detectReplyFeaturesClient,
  forecastReplyClient,
  type ReplyFeatureDetector,
  type ReplyForecaster,
} from '../forecast-client';
import {
  BLOCK_KEYS,
  buildReplyView,
  canSend,
  canSendOffer,
  editGate,
  REPLY_KEYS,
  visibleChecks,
  type CheckRowView,
  type FactRowView,
  type ReplyView,
  type ReplyViewInput,
  type SendGate,
  type SendKind,
  type SendOutcome,
  type SendState,
} from '../reply-model';
import { useDraftForecast } from '../view/draft-forecast';
import { useSent } from '../view/sent-state';

import './reply.css';

export type ReplyPanelProps = {
  disputeId: string;
  base: Omit<ReplyViewInput, 'confirmed' | 'sendState' | 'outcome'>;
  replyId: string | null;
  languageKey: string | null;
  /** "<이름> reads (<언어>)"의 이름 (데이터에서). 모르면 `null` (대명사를 쓰지 않고 "The buyer"). */
  buyerShort?: string | null;
  /** 예측 입력의 나머지 (엔진 신호 + 늦은 날 수). 없으면 예측을 부르지 않는다. */
  forecastBase?: { signals: EscalationSignals; delayDays: number } | null;
  /** 제안 비율 (엔진 가정값, 제안 카드 표시만). */
  offerRate?: number | null;
  /** 시험용 주입 (기본 = 브라우저 어댑터). */
  forecaster?: ReplyForecaster;
  detector?: ReplyFeatureDetector;
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

/** 접기 한 줄 ("More checks ▸"). 화살표는 장식이고 펼치면 돈다 (css). */
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

/** "As you type" 칩 (엔진 특징 판정). */
export function FeatureChips({ chips }: { chips: FeatureChipView[] }) {
  const good = chips.filter((chip) => chip.good).length;
  return (
    <div className="reply-tray-chips">
      <span className="reply-tray-title">{t('case.reply.asYouType')}</span>
      {chips.length === 0 ? null : <span className="reply-tray-sum num">{t('case.reply.goodCount', { count: good })}</span>}
      <Badge kind="codeDecides" />
      <ul className="reply-chip-list">
        {chips.map((chip) => (
          <li
            key={chip.key}
            className={chip.good ? 'reply-chip reply-chip-good' : 'reply-chip reply-chip-warn'}
            title={chip.hit ?? undefined}
          >
            <span aria-hidden="true">{chip.good ? '✓ ' : '! '}</span>
            {t(chip.labelKey)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Her likely reaction" 막대 + Expected cost + Her mood next. 값은 `reactionView`(엔진 예측) 그대로. */
export function ReactionBox({ reaction, name }: { reaction: ReactionView; name: string | null }) {
  return (
    <div className="reaction" role="group" aria-labelledby="reaction-title">
      <div className="reaction-main">
        <div className="reaction-head">
          <strong id="reaction-title">
            {name === null ? t('case.reaction.titleUnknown') : t('case.reaction.title', { name })}
          </strong>
          <span className="num">{t('case.reaction.cost', { amount: reaction.cost })}</span>
          <Badge kind="assumption" />
        </div>
        <div className="reaction-bar" aria-hidden="true">
          {reaction.parts.map((part) => (
            <span key={part.key} className={`reaction-seg reaction-seg-${part.key}`} style={{ flexGrow: part.p }} />
          ))}
        </div>
        <ul className="reaction-legend">
          {reaction.parts.map((part) => (
            <li key={part.key}>
              <span className={`reaction-swatch reaction-seg-${part.key}`} aria-hidden="true" />
              {t(part.labelKey)} <strong className="num">{part.display}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="reaction-mood">
        <span className="reaction-mood-label">{t('case.reaction.moodNext')}</span>
        <strong className="reaction-mood-value">{t(reaction.moodKey)}</strong>
        {reaction.nowMoodKey === null ? null : (
          <span className="reaction-mood-now">{t('case.reaction.moodNow', { mood: t(reaction.nowMoodKey) })}</span>
        )}
      </div>
    </div>
  );
}

/** 맨 아래 검사 줄 (Code decides). */
function ChecksLine({ view }: { view: ReplyView }) {
  const checks = visibleChecks(view.checkRows);
  const shownFacts = view.factRows.filter((fact) => fact.primary);
  const foldedFacts = view.factRows.filter((fact) => !fact.primary);
  const hasFolded = checks.folded.length > 0 || foldedFacts.length > 0;
  if (!view.available || view.checkRows.length === 0) return <span className="reply-checks" />;
  return (
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
  );
}

export function ReplyPanel({
  disputeId,
  base,
  replyId,
  languageKey,
  buyerShort = null,
  forecastBase = null,
  offerRate = null,
  forecaster = forecastReplyClient,
  detector = detectReplyFeaturesClient,
}: ReplyPanelProps) {
  const [confirmed, setConfirmed] = useState<CommitmentCategory[]>([]);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const inFlight = useRef(false);
  const { setSent } = useSent();
  const { setForecast } = useDraftForecast();

  const view = buildReplyView({ ...base, confirmed, sendState, outcome });
  // 입력칸: 처음 글 = 화면의 영어 초안 (실제 값 채운 미리보기). 초안이 없으면 입력칸 없음
  const anchor = view.draftEn?.text ?? null;
  const [text, setText] = useState<string>(anchor ?? '');
  const edited = anchor !== null && text !== anchor;

  const noReply = replyId === null && view.gate.hasDraft;
  const gate: SendGate = editGate(
    noReply ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation } : canSend(view),
    text,
    view.offer === null ? anchor : null,
  );
  const offerGate: SendGate | null =
    view.offer === null ? null : noReply ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation } : canSendOffer(view);
  const language = languageKey === null ? t('case.send.languageUnknown') : t(languageKey);
  const readsLabel =
    buyerShort === null
      ? t('case.reply.buyerReadsUnknown', { language })
      : t('case.reply.buyerReads', { name: buyerShort, language });

  // 예측 (어댑터. 지금은 null → 칸이 숨는다). 입력 글이 바뀔 때마다 다시 받는다
  const board = base.board ?? null;
  const forecast: ReplyForecast | null = useMemo(() => {
    if (forecastBase === null || anchor === null || board === null || view.offer !== null) return null;
    return forecaster({ text, anchorText: anchor, board, signals: forecastBase.signals, delayDays: forecastBase.delayDays });
  }, [forecaster, forecastBase, anchor, board, text, view.offer]);
  useEffect(() => {
    setForecast(forecast);
  }, [forecast, setForecast]);
  const chips = useMemo(() => (anchor === null ? null : featureChips(detector(text))), [detector, text, anchor]);
  const reaction = reactionView(forecast, forecastBase?.signals.angryTone ?? null);

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
  const busy = sendState !== 'idle';

  const commitmentsBlock = (
    <>
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
  );

  const resultBlock = (
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
  );

  const riskAfterBlock =
    view.riskAfterReply === null ? null : (
      <p className="row small reply-risk-after">
        <span className="label">{t('case.reply.riskAfter')}</span>
        <RiskLevel band={view.riskAfterReply.band} />
        <span className="num">{t('case.view.riskScore', { score: view.riskAfterReply.score })}</span>
      </p>
    );

  const modeLine = (
    <span className={view.modeKey === REPLY_KEYS.modeLive ? 'reply-mode reply-mode-live' : 'reply-mode'}>
      {t(view.modeKey)}
    </span>
  );

  // ── 제안이 먼저: 시안의 짧은 카드 ───────────────────────────────────────────
  if (view.offer !== null && offerGate !== null) {
    const keeps = base.plan?.refundType !== 'REFUND_WITH_RETURN';
    const amount = toDollarsCents(view.offer.amountCents);
    const title =
      offerRate === null
        ? t(keeps ? 'case.offer.titleNoRate.keep' : 'case.offer.titleNoRate.return', { amount })
        : t(keeps ? 'case.offer.title.keep' : 'case.offer.title.return', { percent: toPercentRounded(offerRate), amount });
    return (
      <section className="reply offer-card" aria-labelledby="reply-title">
        <span className="work-ai" aria-hidden="true">
          {t('case.work.ai')}
        </span>
        <h2 className="offer-title num" id="reply-title">
          {title}
        </h2>
        <p className="offer-line">{t('case.offer.line', { language })}</p>
        <p className="offer-badges">
          <Badge kind="codeDecides" />
          <Badge kind="assumption" />
        </p>

        {view.unavailableKey === null ? null : <p className="notice">{t(view.unavailableKey)}</p>}
        {view.available && view.outgoing !== null ? (
          <details className="reply-fold">
            <FoldSummary label={readsLabel} />
            <p className="reply-text reply-outgoing" lang={base.buyerLocale ?? undefined}>
              {view.outgoing.text}
            </p>
            {view.sourceBadges.map((kind) => (
              <Badge key={kind} kind={kind} />
            ))}
          </details>
        ) : null}
        {view.available ? commitmentsBlock : null}

        <div className="reply-foot">
          <ChecksLine view={view} />
          <div className="reply-actions">
            {modeLine}
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
          </div>
        </div>
        {resultBlock}
        {riskAfterBlock}
      </section>
    );
  }

  // ── 답장 ────────────────────────────────────────────────────────────────
  return (
    <section className="reply desk-step" aria-labelledby="reply-title">
      <div className="desk-rail" aria-hidden="true">
        <span className="desk-step-num">2</span>
      </div>
      <div className="desk-step-body">
        <div className="desk-step-head">
          {anchor === null ? (
            <h3 className="desk-step-title" id="reply-title">
              {t('case.reply.title')}
            </h3>
          ) : (
            <label className="desk-step-title" id="reply-title" htmlFor={`reply-input-${disputeId}`}>
              {t('case.reply.title')}
            </label>
          )}
          {anchor === null ? null : <span className="desk-step-sub">{t('case.reply.editSub')}</span>}
          {anchor === null ? null : (
            <span className="reply-tools">
              <button type="button" className="desk-button-tint" disabled={busy} onClick={() => setText(t('case.reply.rushedExample'))}>
                {t('case.reply.rushed')}
              </button>
              <button type="button" className="desk-button-tint" disabled={busy} onClick={() => setText(anchor)}>
                <span className="work-ai work-ai-small" aria-hidden="true">
                  {t('case.work.ai')}
                </span>
                {t('case.reply.useAiDraft')}
              </button>
              <button type="button" className="desk-button-tint" disabled={busy} onClick={() => setText('')}>
                {t('case.reply.clear')}
              </button>
            </span>
          )}
        </div>

        {view.unavailableKey === null ? null : <p className="notice">{t(view.unavailableKey)}</p>}

        {view.available ? (
          <>
            {view.fixedDraftKey === null ? null : <p className="notice reply-fixed">{t(view.fixedDraftKey)}</p>}

            <div className="reply-pair">
              {anchor === null ? null : (
                <div className={edited ? 'reply-editor reply-editor-edited' : 'reply-editor'}>
                  <div className="reply-editor-field">
                    <textarea
                      id={`reply-input-${disputeId}`}
                      className="reply-textarea"
                      lang="en"
                      rows={5}
                      value={text}
                      readOnly={busy}
                      placeholder={t('case.reply.placeholder')}
                      onChange={(event) => setText(event.target.value)}
                    />
                    {reaction === null ? null : (
                      <span className="reply-editor-pill num">
                        {t('case.choice.chargeback', { percent: reaction.chargeback })}
                      </span>
                    )}
                  </div>
                  <div className="reply-tray">
                    {chips !== null ? (
                      <FeatureChips chips={chips} />
                    ) : view.chips.length === 0 ? null : (
                      <div className="reply-tray-chips">
                        <span className="reply-tray-title">{t('case.reply.covers')}</span>
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
                  </div>
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
                {edited ? <p className="reply-edited small">{t('case.reply.editedNote')}</p> : null}
              </div>
            </div>

            {view.backTranslationEn === null ? null : (
              <details className="reply-fold">
                <FoldSummary label={t('case.reply.backTranslation')} />
                <p className="reply-text small">{view.backTranslationEn}</p>
              </details>
            )}

            {commitmentsBlock}

            {reaction === null ? null : <ReactionBox reaction={reaction} name={buyerShort} />}
          </>
        ) : null}

        <div className="reply-foot">
          <ChecksLine view={view} />
          <div className="reply-actions">
            {modeLine}
            <div className="reply-send">
              <button
                type="button"
                className="reply-button"
                disabled={!gate.ok}
                aria-describedby="reply-send-why"
                onClick={() => send('message')}
              >
                {sendState === 'sending' ? t('case.send.sending') : t('case.send.button', { language })}
              </button>
              <span id="reply-send-why" className="small muted reply-why">
                {gate.ok || gate.reasonKey === null || result !== null ? null : t(gate.reasonKey)}
              </span>
            </div>
          </div>
        </div>

        {resultBlock}
        {riskAfterBlock}
      </div>
    </section>
  );
}
