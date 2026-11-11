'use client';

/**
 * 답장 칸 (T009 2부 → T061 → T068 → T076 시안 v4 "2 Your reply"). 위에서 아래로:
 *
 *  - 머리 줄: "Your reply" + [Try a rushed reply] [Use AI draft] [Clear]
 *  - 두 칸 나란히: 왼쪽 **입력칸**(처음 글 = AI 영어 초안을 실제 값으로 채운 미리보기) + 모서리 차지백 %(예측) +
 *    아래 "As you type · N good" 칩(엔진 특징 판정, 어댑터. 없으면 지금 "Suggested reply covers" 칩) + 오른쪽
 *    "Details ⌄" · 오른쪽 칸 "She'll see (<언어>)" = **검사받은 전송본** (회색 바탕, 테두리 없음)
 *  - Details 안 (T090): "PayPal data only" 한 줄 → 역번역(영어) → 검사 3개(Facts match · No new promises · Follow-up date).
 *    **검사가 하나라도 실패하면 자동으로 펼치고**(`detailsMustOpen`) [Send]는 관문(`canSend`)이 끈다.
 *  - 입력칸 글이 초안과 다르면 "Edited text can't be sent — use AI draft" (보내기 꺼짐, `editGate`)
 *  - "Her likely reaction" 막대(기다림·환불·차지백) + Expected cost + Her mood next (예측 어댑터, Assumption. 없으면 숨김)
 *  - 맨 아래 한 줄: 전송 모드 작은 글씨("Simulated send …") · 보내기 버튼 (검사 줄은 T090부터 Details 안)
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
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import type { CommitmentCategory } from '@/ai/reply';
import type { EscalationSignals, ReplyForecast } from '@/types';

import { AiPill, Badge, RiskLevel } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
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
  detailsChecks,
  detailsMustOpen,
  editGate,
  REPLY_KEYS,
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
  /**
   * 예측 입력의 나머지 (엔진 신호 + 늦은 날 수 + 보낼 때 번역되는지). 없으면 예측을 부르지 않는다.
   * 서버의 위험 곡선·선택지 예측과 같은 값이어야 보정이 같다 (`case-detail.tsx`가 한 번 정한다).
   */
  forecastBase?: { signals: EscalationSignals; delayDays: number; translated?: boolean } | null;
  /** 제안 비율 (엔진 가정값, 제안 카드 표시만). */
  offerRate?: number | null;
  /**
   * Details 첫 줄 "PayPal data only: Full refund $74" (`CaseDesk.paypalOnly`, 엔진 값). 배송사 기록이 없는 분쟁은
   * "No carrier data linked …" 한 줄 (선택지 카드 아래에서 옮겨 왔다). 없으면 줄 없음.
   */
  paypalOnly?: string | null;
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
  const t = useT();
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
  const t = useT();
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

/**
 * "As you type · N good" + ✓ 칩 (경고 칩은 빨강 글자) + 오른쪽 "Details ⌄" (T090 시안 v4).
 * 칩을 눌러 넣기·빼기(Add/Remove)와 칩별 %p는 T091 몫이다 — 지금은 모양만.
 */
export function FeatureChips({ chips, toggle }: { chips: FeatureChipView[]; toggle?: ReactNode }) {
  const t = useT();
  const good = chips.filter((chip) => chip.good).length;
  return (
    <div className="reply-tray-chips">
      <span className="reply-tray-title">{t('case.reply.asYouType')}</span>
      {chips.length === 0 ? null : <span className="reply-tray-sum num">{t('case.reply.goodCount', { count: good })}</span>}
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
      {toggle ?? null}
    </div>
  );
}

/** "Details ⌄" 단추 (펼침 여부는 부르는 쪽이 정한다 — 검사 실패면 늘 펼침). */
function DetailsToggle({
  open,
  forced,
  controls,
  onToggle,
}: {
  open: boolean;
  forced: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      className="reply-details-toggle"
      aria-expanded={open}
      aria-controls={controls}
      data-forced={forced ? 'true' : undefined}
      onClick={forced ? undefined : onToggle}
    >
      {t(open ? 'case.reply.detailsHide' : 'case.reply.details')}
      <svg
        className={open ? 'reply-details-caret reply-details-caret-open' : 'reply-details-caret'}
        width="12"
        height="12"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

/**
 * Details 안 (T090): "PayPal data only" 한 줄 → 역번역(영어) → 검사 3개(Facts match · No new promises · Follow-up date).
 * 실패한 보조 검사(직접 쓴 값·호칭)도 여기 보인다. 칩별 %p는 T091이 더한다.
 */
function DetailsPanel({
  id,
  view,
  paypalOnly,
  hidden,
}: {
  id: string;
  view: ReplyView;
  paypalOnly: string | null;
  hidden: boolean;
}) {
  const t = useT();
  const checks = detailsChecks(view.checkRows);
  const facts = view.factRows.filter((fact) => fact.primary);
  return (
    <div id={id} className="reply-details" role="group" aria-label={t('case.reply.checks')} hidden={hidden}>
      {paypalOnly === null ? null : (
        <p className="reply-details-paypal num" title={t('case.choice.paypalOnlyHint')}>
          {paypalOnly}
        </p>
      )}
      {view.backTranslationEn === null ? null : (
        <div className="reply-details-back">
          <span className="reply-details-label">{t('case.reply.backTranslation')}</span>
          <p className="reply-text" lang="en">
            {view.backTranslationEn}
          </p>
        </div>
      )}
      {checks.length === 0 && facts.length === 0 ? null : (
        <ul className="reply-list small">
          {checks.map((row) => (
            <CheckRow key={row.labelKey} row={row} />
          ))}
          {facts.map((fact) => (
            <FactRow key={fact.token} fact={fact} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Her likely reaction" 막대 + Expected cost + Her mood next. 값은 `reactionView`(엔진 예측) 그대로. */
export function ReactionBox({ reaction, name }: { reaction: ReactionView; name: string | null }) {
  const t = useT();
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
            // 시안: 막대 칸 너비 = 확률 (그리기 자리 값), transition width .35s (config/motion.json desk.reactionBar)
            <span key={part.key} className={`reaction-seg reaction-seg-${part.key}`} style={{ '--seg': part.p } as CSSProperties} />
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

export function ReplyPanel({
  disputeId,
  base,
  replyId,
  languageKey,
  buyerShort = null,
  forecastBase = null,
  offerRate = null,
  paypalOnly = null,
  forecaster = forecastReplyClient,
  detector = detectReplyFeaturesClient,
}: ReplyPanelProps) {
  const t = useT();
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  // 시안 "She'll see (Korean)" — 언어 이름은 데이터(구매자 언어)에서
  const readsLabel =
    buyerShort === null ? t('case.reply.buyerReadsUnknown', { language }) : t('case.reply.sheSees', { language });

  // Details ⌄ (T090): 검사가 하나라도 실패하면 자동으로 펼친다 (닫을 수 없다). [Send]는 관문이 이미 끈다
  const detailsForced = detailsMustOpen(view);
  const detailsShown = detailsOpen || detailsForced;
  const detailsToggle = view.available ? (
    <DetailsToggle
      open={detailsShown}
      forced={detailsForced}
      controls={detailsId}
      onToggle={() => setDetailsOpen((value) => !value)}
    />
  ) : null;
  const detailsPanel = view.available ? (
    <DetailsPanel id={detailsId} view={view} paypalOnly={paypalOnly} hidden={!detailsShown} />
  ) : null;

  // 예측 (브라우저 어댑터 = 엔진 순수 함수. 쓸 수 없으면 null → 칸이 숨는다). 입력 글이 바뀔 때마다 다시 받는다
  const board = base.board ?? null;
  const translated = forecastBase?.translated === true;
  const forecast: ReplyForecast | null = useMemo(() => {
    if (forecastBase === null || anchor === null || board === null || view.offer !== null) return null;
    return forecaster({
      text,
      anchorText: anchor,
      board,
      signals: forecastBase.signals,
      delayDays: forecastBase.delayDays,
      translated,
    });
  }, [forecaster, forecastBase, anchor, board, text, view.offer, translated]);
  useEffect(() => {
    setForecast(forecast);
  }, [forecast, setForecast]);
  const chips = useMemo(
    () => (anchor === null ? null : featureChips(detector(text, { translated }))),
    [detector, text, anchor, translated],
  );
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
        <AiPill />
        <h2 className="offer-title num" id="reply-title">
          {title}
        </h2>
        <p className="offer-line">{t('case.offer.line', { language })}</p>
        <p className="offer-badges">
          <Badge kind="assumption" />
        </p>

        {view.unavailableKey === null ? null : <p className="notice">{t(view.unavailableKey)}</p>}
        {view.available && view.outgoing !== null ? (
          <details className="reply-fold">
            <FoldSummary label={readsLabel} />
            <p className="reply-text reply-outgoing" lang={base.buyerLocale ?? undefined}>
              {view.outgoing.text}
            </p>
          </details>
        ) : null}
        {view.available ? commitmentsBlock : null}
        {detailsToggle}
        {detailsPanel}

        <div className="reply-foot">
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
                <AiPill small decorative />
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
                    {/* T090: 알약 안 Assumption은 뺀다 (Assumption은 반응 막대 쪽 하나만) */}
                    {reaction === null ? null : (
                      <span className="reply-editor-pill num">{t('case.choice.chargeback', { percent: reaction.chargeback })}</span>
                    )}
                  </div>
                  <div className="reply-tray">
                    {chips !== null ? (
                      <FeatureChips chips={chips} toggle={detailsToggle} />
                    ) : (
                      <div className="reply-tray-chips">
                        {view.chips.length === 0 ? null : (
                          <>
                            <span className="reply-tray-title">{t('case.reply.covers')}</span>
                            <ul className="reply-chip-list">
                              {view.chips.map((chip, index) => (
                                <li key={index} className="reply-chip">
                                  {chip}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                        {detailsToggle}
                      </div>
                    )}
                    {detailsPanel}
                  </div>
                </div>
              )}

              <div className="reply-block reply-box">
                <h3 className="reply-box-title">{readsLabel}</h3>
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

            {/* 입력칸이 없으면(초안 글 없음) Details를 여기 둔다 */}
            {anchor === null ? (
              <>
                {detailsToggle}
                {detailsPanel}
              </>
            ) : null}

            {commitmentsBlock}

            {reaction === null ? null : <ReactionBox reaction={reaction} name={buyerShort} />}
          </>
        ) : null}

        {/* T090: 검사 줄은 Details 안으로. 맨 아래는 "Simulated send" 작은 글씨 + [Send] */}
        <div className="reply-foot">
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
