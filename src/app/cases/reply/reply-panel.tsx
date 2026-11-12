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
 *  - 입력칸 글이 초안과 다르면 [Translate & check] → 서버가 토큰으로 되돌려 번역·역번역·검사(T100, `prepareEditedAction`).
 *    번역 중 "Translating…" + Send 꺼짐, 끝나면 전송본·역번역·검사가 고친 글 기준. 통과하면 Send (`editGate`)
 *  - 환불 카드 상태에서는 Send 꺼짐 ("Refund is simulated in this demo — nothing is sent", T100 6번)
 *  - "Her likely reaction" 막대(기다림·환불·차지백) + Expected cost + Her mood next (예측 어댑터, Assumption. 없으면 숨김)
 *  - 맨 아래 한 줄: 전송 모드 작은 글씨("Simulated send …") · 보내기 버튼 (검사 줄은 T090부터 Details 안)
 *  - 결과 한 줄 · 답장 후 위험
 *
 * 제안이 먼저인 분쟁은 시안의 짧은 카드: "Offer N% back ($X), the buyer keeps it" + 한 줄 + 전송본 접기 +
 * 검사 줄 + [Send offer · $7] (금액·비율은 엔진 값, 관문은 그대로).
 *
 * **보내기 버튼은 서버가 기억한 답장 번호만 보낸다.** AI 초안이면 `replyId`, 고친 글이면 서버가 그 글을 검사하고 기억한
 * 번호다 (T100). 입력칸 글은 번역·검사 서버 액션으로만 가고, 보내기 관문(`canSend`·`canSendOffer`)·확인 창·전송 모드·
 * 보내기 서버 액션은 T068 그대로다.
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
import type { EscalationSignals, Evaluation, ReplyForecast } from '@/types';

import { AiPill, Badge, RiskLevel } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import { toDollarsCents } from '../../_shared/money';
import { chipPopDelay, prefersReducedMotion, typeOutTiming } from '../../_shared/motion';
import { toPercentRounded } from '../../_shared/percent';
import { useSavings } from '../../today/savings';
import { prepareEditedAction, sendReplyAction } from '../actions';
import {
  applyChip,
  draftForMove,
  effectRows,
  filledSnippets,
  lintSummary,
  quoteCut,
  refundMoveText,
  typeOutFrames,
  type DeskPath,
  type EffectRows,
  type EffectRowView,
  type MoveDrafts,
} from '../desk-actions';
import { featureChips, reactionView, type FeatureChipView, type ReactionView } from '../desk-model';
import {
  detectReplyFeaturesClient,
  forecastReplyClient,
  replyFeatureEffectsClient,
  snippetsForClient,
  type ReplyEffectsClient,
  type ReplyFeatureDetector,
  type ReplyForecaster,
} from '../forecast-client';
import {
  BLOCK_KEYS,
  buildReplyView,
  canSend,
  canSendOffer,
  detailsBackTranslation,
  detailsChecks,
  detailsMustOpen,
  editGate,
  EDIT_KEYS,
  REPLY_KEYS,
  type EditedGate,
  type CheckRowView,
  type FactRowView,
  type ReplyView,
  type ReplyViewInput,
  type SendGate,
  type SendKind,
  type SendOutcome,
  type SendState,
  type EditStatus,
  type EditedPrepareOutcome,
} from '../reply-model';
import { CaseProgress } from '../progress/case-progress';
import type { ScenarioInput } from '../progress/progress-client';
import { scenarioOutcome, type ScenarioOutcome } from '../progress/progress-model';
import { useDeskSelection } from '../view/desk-selection';
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
  /** T091 "+$N just now" 값 (엔진 `actionSavings` 표기, 서버가 만든다). 보내기에 성공하면 이번 주 카드로. */
  savings?: string | null;
  /** 시험용 주입 (기본 = 브라우저 어댑터). */
  forecaster?: ReplyForecaster;
  detector?: ReplyFeatureDetector;
  effects?: ReplyEffectsClient;
  /** 시험용: 입력칸 처음 글 (기본 = AI 초안). 보내는 글은 바뀌지 않는다 (관문이 그대로 막는다). */
  initialText?: string;
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

/** %p 글자 ("−12 pts"). 값은 엔진 `deltaPp`의 반올림 (`ppText`). */
function PpText({ row }: { row: EffectRowView }) {
  const t = useT();
  return (
    <span className={row.kind === 'bad' ? 'reply-lint-pp reply-lint-pp-bad num' : 'reply-lint-pp num'}>
      {t('case.reply.pts', { value: row.pp })}
    </span>
  );
}

/**
 * T091 칩 받침 (시안 `.tray`: `lints` 줄 + ✓ 칩 + Details). 위에서 아래로:
 *  - "As you type" + 요약 알약 ("1 to fix · 2 missing · 3 good", 0은 뺀다)
 *  - 나쁜 것 줄 "! Blames buyer … “문장” +9 pts [Remove]" → 그 문장을 지운다
 *  - 빠진 것 줄 "+ Missing: A date  문장  −14 pts [+ Add]" → `config/reply-snippets.json` 문장을 글 끝에 넣는다
 *  - ✓ 칩 (pop, 칩마다 0.12s씩 늦게) + "Refund done · Simulated" + 오른쪽 "Details ⌄"
 * 숫자는 엔진 `replyFeatureEffects` 값 그대로 (표기만). 빈 글이면 "Start typing — each sentence is checked."
 */
export function LintTray({
  rows,
  empty,
  refundDone,
  busy,
  onChip,
  toggle,
}: {
  rows: EffectRows;
  empty: boolean;
  refundDone: boolean;
  busy: boolean;
  onChip: (row: EffectRowView) => void;
  toggle?: ReactNode;
}) {
  const t = useT();
  const summary = empty ? [] : lintSummary(rows);
  const lines = empty ? [] : [...rows.bad, ...rows.missing];
  const goods = empty ? [] : rows.good;
  return (
    <>
      <div className="reply-tray-chips" data-part="head">
        <svg className="reply-tray-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M4 6h16M4 12h10M4 18h7" />
        </svg>
        <span className="reply-tray-title">{t('case.reply.asYouType')}</span>
        {summary.map((item) => (
          <span key={item.key} className="reply-tray-sum num">
            {t(item.key, { count: item.count })}
          </span>
        ))}
      </div>
      {empty ? <span className="reply-lint-empty">{t('case.reply.lintEmpty')}</span> : null}
      {lines.map((row) => (
        <div key={`${row.kind}-${row.key}`} className={`reply-lint reply-lint-${row.kind}`} data-chip={row.key}>
          <span className={`reply-lint-icon reply-lint-icon-${row.kind}`} aria-hidden="true">
            {row.kind === 'bad' ? '!' : '+'}
          </span>
          <strong className="reply-lint-label">
            {row.kind === 'missing' ? t('case.reply.missing', { label: t(row.labelKey) }) : t(row.labelKey)}
          </strong>
          <span className="reply-lint-detail">{row.kind === 'bad' ? quoteCut(row.sentence) : row.sentence}</span>
          <PpText row={row} />
          {row.action === null ? null : (
            <button
              type="button"
              className={row.kind === 'bad' ? 'reply-lint-button reply-lint-button-ghost' : 'reply-lint-button'}
              disabled={busy}
              onClick={() => onChip(row)}
            >
              {t(row.action === 'add' ? 'case.reply.add' : 'case.reply.remove')}
            </button>
          )}
        </div>
      ))}
      <div className="reply-tray-chips reply-goods">
        {goods.length === 0 && !refundDone ? null : (
          <ul className="reply-chip-list">
            {goods.map((row, index) => (
              <li
                key={row.key}
                className="reply-chip reply-chip-good"
                style={{ animationDelay: chipPopDelay(index) }}
                title={row.sentence ?? undefined}
              >
                <span aria-hidden="true">✓ </span>
                {t(row.labelKey)}
              </li>
            ))}
            {refundDone ? (
              <li
                className="reply-chip reply-chip-good"
                data-chip="refundNow"
                style={{ animationDelay: chipPopDelay(goods.length) }}
              >
                <span aria-hidden="true">✓ </span>
                {t('case.reply.refundDone')}
              </li>
            ) : null}
          </ul>
        )}
        {toggle ?? null}
      </div>
    </>
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
  backTranslationEn,
  paypalOnly,
  hidden,
  goods = [],
}: {
  id: string;
  view: ReplyView;
  /** T104 F4-52: 보일 역번역 (`detailsBackTranslation`). 고친 글인데 검사 결과가 없으면 `null` → 줄 없음. */
  backTranslationEn: string | null;
  paypalOnly: string | null;
  hidden: boolean;
  /** T091: ✓ 칩마다 기여한 %p(엔진 `replyFeatureEffects`)와 그 문장 (시안 goodsOpen 목록). */
  goods?: EffectRowView[];
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
      {backTranslationEn === null ? null : (
        <div className="reply-details-back">
          <span className="reply-details-label">{t('case.reply.backTranslation')}</span>
          <p className="reply-text" lang="en">
            {backTranslationEn}
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
      {/* T091: ✓ 칩마다 기여한 %p와 그 문장 (시안 goodsOpen 목록). 검사 줄 뒤 */}
      {goods.length === 0 ? null : (
        <ul className="reply-details-effects">
          {goods.map((row) => (
            <li key={row.key} className="reply-lint reply-lint-good" data-effect={row.key}>
              <span className="reply-lint-icon reply-lint-icon-good" aria-hidden="true">
                ✓
              </span>
              <strong className="reply-lint-label">{t(row.labelKey)}</strong>
              <span className="reply-lint-detail reply-lint-detail-wrap">{quoteCut(row.sentence, Number.POSITIVE_INFINITY)}</span>
              <PpText row={row} />
            </li>
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
              {/* 시안 legend pSt: 차지백 칸이 50% 이상이면 빨강 */}
              {t(part.labelKey)}{' '}
              <strong
                className={part.key === 'chargeback' && reaction.chargebackHigh ? 'num reaction-legend-high' : 'num'}
              >
                {part.display}
              </strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="reaction-mood">
        <span className="reaction-mood-label">{t('case.reaction.moodNext')}</span>
        {/* 시안 moodSt: 기분이 나쁘면(엔진 기분 단계 angry = mood < -0.5) 빨강, transition color .3s */}
        <strong className={reaction.moodBad ? 'reaction-mood-value reaction-mood-bad' : 'reaction-mood-value'}>
          {t(reaction.moodKey)}
        </strong>
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
  effects: effectsFn = replyFeatureEffectsClient,
  savings = null,
  initialText,
}: ReplyPanelProps) {
  const t = useT();
  const detailsId = useId();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<CommitmentCategory[]>([]);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  /** T100: 고친 글 하나의 번역·검사 결과 (그 글자에 묶인다). */
  const [editRun, setEditRun] = useState<{ text: string; result: EditedPrepareOutcome | 'translating' } | null>(null);
  /** T104: 보낸 순간의 입력칸 글과 그 예측 (Send 뒤 분기·단계 위험의 입력). 다시 쓰기면 비운다. */
  const [sentSnap, setSentSnap] = useState<{ text: string; forecast: ReplyForecast | null } | null>(null);
  const inFlight = useRef(false);
  const { setSent } = useSent();
  const { setForecast } = useDraftForecast();
  const { report, markDone, unmarkDone } = useSavings();
  const desk = useDeskSelection();

  const view = buildReplyView({ ...base, confirmed, sendState, outcome });
  // 입력칸: 처음 글 = 화면의 영어 초안 (실제 값 채운 미리보기). 초안이 없으면 입력칸 없음
  const anchor = view.draftEn?.text ?? null;
  const [text, setText] = useState<string>(initialText ?? anchor ?? '');
  const edited = anchor !== null && text !== anchor;

  // ── T091 타이핑 효과 (시안 typeOut: 34ms마다 2글자, config/motion.json). 타이핑 중에는 Send·카드·도구가 꺼진다 ──
  const [typing, setTyping] = useState(false);
  const typer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (typer.current !== null) clearInterval(typer.current);
    },
    [],
  );
  const setBusyBoth = (value: boolean) => {
    setTyping(value);
    desk.setBusy(value);
  };
  function typeOut(next: string, path: DeskPath) {
    if (typer.current !== null) clearInterval(typer.current);
    typer.current = null;
    desk.setPath(path);
    const { intervalMs, step } = typeOutTiming();
    // 움직임 줄이기면 바로 전체 (시안 모션 끔)
    const frames = typeOutFrames(next, step, prefersReducedMotion());
    if (frames.length <= 1) {
      setText(next);
      setBusyBoth(false);
      return;
    }
    setText('');
    setBusyBoth(true);
    let index = 0;
    typer.current = setInterval(() => {
      setText(frames[index]);
      index += 1;
      if (index >= frames.length) {
        if (typer.current !== null) clearInterval(typer.current);
        typer.current = null;
        setBusyBoth(false);
      }
    }, intervalMs);
  }

  // 수마다 넣을 초안 (새 AI 호출 없음): 최선 수 = AI 초안(anchor), 환불 = "Refund done · Simulated" 안내 글(문구 키, 이름만 채움)
  const bestMove: Evaluation['move'] = base.plan?.move ?? 'fight';
  const refundNote =
    buyerShort === null ? t('case.reply.refundDraftNoName') : t('case.reply.refundDraft', { name: buyerShort });
  const drafts: MoveDrafts = { [bestMove]: anchor, ...(bestMove === 'refund' ? {} : { refund: refundNote }) };
  const pickMove = (move: Evaluation['move']) => {
    const next = draftForMove(move, drafts);
    if (next === null) {
      desk.setPath(move);
      return;
    }
    typeOut(next, move);
  };
  const pickerRef = desk.pickerRef;
  useEffect(() => {
    pickerRef.current = pickMove;
    return () => {
      pickerRef.current = null;
    };
  });

  // 글 특징 (엔진 규칙). 환불 상태 판정과 칩이 함께 쓴다
  const detectedNow = useMemo(
    () => (anchor === null ? null : detector(text, { translated: forecastBase?.translated === true })),
    [detector, text, anchor, forecastBase?.translated],
  );

  const noReply = replyId === null && view.gate.hasDraft;
  // T091: 타이핑 중에는 Send를 막는다 (시안 `sendOff: s.busy || …`). 이유 글은 내지 않는다 (곧 끝난다)
  const screenGate: SendGate = typing
    ? { ok: false, reasonKey: null }
    : noReply
      ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation }
      : canSend(view);
  // T100: 고친 글은 서버에서 토큰 되돌리기 → 번역·역번역·검사를 지나야 보낼 수 있다. 결과는 그 글자에만 묶인다
  // (한 글자라도 다시 바꾸면 검사 전으로 돌아간다). 보기용 값은 같은 함수(`buildReplyView`)로 고친 글 기준으로 다시 낸다
  const run = editRun !== null && editRun.text === text ? editRun : null;
  const editedView: ReplyView | null =
    edited && run !== null && run.result !== 'translating' && run.result.ok && base.draft.ok
      ? buildReplyView({
          ...base,
          draft: { ...base.draft, draftEn: run.result.draftEn },
          translation: run.result.translation,
          confirmed,
          sendState,
          outcome,
        })
      : null;
  const editStatus: EditStatus =
    run === null
      ? { state: 'idle' }
      : run.result === 'translating'
        ? { state: 'translating' }
        : !run.result.ok
          ? { state: 'failed', reasonKey: run.result.reasonKey }
          : editedView === null
            ? { state: 'failed', reasonKey: EDIT_KEYS.aiUnavailable }
            : {
                state: 'ready',
                // 서버가 검사 통과 글로 기억하지 않았으면(번호 없음) 화면 관문과 상관없이 끈다
                gate: run.result.replyId === null && canSend(editedView).ok ? { ok: false, reasonKey: BLOCK_KEYS.checkFailed } : canSend(editedView),
              };
  const editedReplyId = run !== null && run.result !== 'translating' && run.result.ok ? run.result.replyId : null;
  // T100 6번: 환불 카드 상태(또는 고친 글이 "환불했다"고 말함)에서는 보내지 않는다 — 환불은 시뮬레이션뿐이다
  const refundState = desk.path === 'refund' || (edited && detectedNow?.features.refundNow === true);
  const gate: EditedGate = editGate(screenGate, text, view.offer === null ? anchor : null, {
    refund: view.offer === null && refundState,
    status: editStatus,
  });
  // 보이는 값(전송본·Details·검사·약속 확인)은 고친 글이면 고친 글 기준
  const shownView: ReplyView = editedView ?? view;
  const offerGate: SendGate | null =
    view.offer === null ? null : noReply ? { ok: false, reasonKey: BLOCK_KEYS.noTranslation } : canSendOffer(view);
  const language = languageKey === null ? t('case.send.languageUnknown') : t(languageKey);
  // 시안 "She'll see (Korean)" — 언어 이름은 데이터(구매자 언어)에서
  const readsLabel =
    buyerShort === null ? t('case.reply.buyerReadsUnknown', { language }) : t('case.reply.sheSees', { name: buyerShort, language });

  // Details ⌄ (T090): 검사가 하나라도 실패하면 자동으로 펼친다 (닫을 수 없다). [Send]는 관문이 이미 끈다
  const detailsForced = detailsMustOpen(shownView);
  const detailsShown = detailsOpen || detailsForced;
  const detailsToggle = view.available ? (
    <DetailsToggle
      open={detailsShown}
      forced={detailsForced}
      controls={detailsId}
      onToggle={() => setDetailsOpen((value) => !value)}
    />
  ) : null;
  const detailsPanel = (goods: EffectRowView[]) =>
    view.available ? (
      <DetailsPanel
        id={detailsId}
        view={shownView}
        backTranslationEn={detailsBackTranslation(edited, view, editedView)}
        paypalOnly={paypalOnly}
        hidden={!detailsShown}
        goods={goods}
      />
    ) : null;

  // 예측 (브라우저 어댑터 = 엔진 순수 함수. 쓸 수 없으면 null → 칸이 숨는다). 입력 글이 바뀔 때마다 다시 받는다
  const board = base.board ?? null;
  const translated = forecastBase?.translated === true;
  // 환불 카드를 고른 상태(path 'refund' — 글을 고치면 custom이 된다): 카드에 보인 그 수의 엔진 값(forecastMoves refund)을 보인다.
  // 환불 안내 글 자체가 아니라 AI 초안 + 그 글의 refundNow 문장을 예측한다 (`refundMoveText`, 컨트롤 타워 결정 2026-11-12)
  const refundPath = desk.path === 'refund';
  const forecastText = useMemo(() => {
    if (!refundPath || anchor === null) return text;
    return refundMoveText(anchor, detector(refundNote, { translated })?.hits.refundNow) ?? text;
  }, [refundPath, anchor, text, detector, refundNote, translated]);
  const forecast: ReplyForecast | null = useMemo(() => {
    if (forecastBase === null || anchor === null || board === null || view.offer !== null) return null;
    return forecaster({
      text: forecastText,
      anchorText: anchor,
      board,
      signals: forecastBase.signals,
      delayDays: forecastBase.delayDays,
      translated,
    });
  }, [forecaster, forecastBase, anchor, board, forecastText, view.offer, translated]);
  useEffect(() => {
    setForecast(forecast);
  }, [forecast, setForecast]);
  const detected = detectedNow;
  const chips = useMemo(() => featureChips(detected), [detected]);
  // T091: 칩마다 효과 (엔진 replyFeatureEffects). 넣을 문장 = config/reply-snippets.json (자리표시자는 영어 초안과 같은 채움)
  const subtype = board?.cause?.subtype ?? null;
  const draftFacts = base.draftFacts;
  const snippets = useMemo(() => filledSnippets(snippetsForClient(subtype), draftFacts ?? []), [subtype, draftFacts]);
  const rows = useMemo(() => {
    // 예측 어댑터를 쓸 수 없으면(null) 칩 효과도 내지 않는다 (같은 엔진) → 지금 칩으로 돌아간다
    if (forecast === null || forecastBase === null || anchor === null || board === null || view.offer !== null) return null;
    const list = effectsFn(
      { text, anchorText: anchor, board, signals: forecastBase.signals, delayDays: forecastBase.delayDays, translated },
      snippets,
    );
    return effectRows(list, detected?.features.refundNow === true);
  }, [effectsFn, forecast, forecastBase, anchor, board, view.offer, text, translated, snippets, detected]);
  const empty = text.trim() === '';
  const reaction = reactionView(forecast, forecastBase?.signals.angryTone ?? null);
  // T103: Send 뒤 칸의 엔진 입력은 렌더마다 같은 객체여야 한다. 새 객체면 그 칸이 점(scenarioRisk)을 다시 내고
  // 곡선 상자(`setTrail`)를 갱신 → 이 칸이 다시 그려짐 → 또 새 객체 … 로 끝없이 돌아 목록 링크 이동이 막혔다
  // T104 F5-15·16: 보낸 글(보낸 순간의 입력칸 글)에서 시작한다 — 고친 글(급한 답장 등)이면 그 글의 예측대로
  const sentText = sentSnap?.text ?? anchor;
  const scenarioInput: ScenarioInput | null = useMemo(
    () =>
      forecastBase === null || anchor === null || board === null || sentText === null
        ? null
        : { text: sentText, anchorText: anchor, board, signals: forecastBase.signals, delayDays: forecastBase.delayDays, translated },
    [forecastBase, anchor, board, translated, sentText],
  );
  // 분기 (시안 L661 `out`): 보낸 글의 엔진 예측 중 큰 것 (같으면 ok > refund > cb). 예측이 없으면 ok
  const sentOutcome: ScenarioOutcome = useMemo(() => scenarioOutcome(sentSnap?.forecast ?? null), [sentSnap]);

  function onChip(row: EffectRowView) {
    if (typing) return;
    setText((now) => applyChip(now, row));
    desk.setPath('custom');
  }

  function toggle(category: CommitmentCategory) {
    setConfirmed((now) => (now.includes(category) ? now.filter((c) => c !== category) : [...now, category]));
  }

  async function send(kind: SendKind) {
    const allowed = kind === 'offer' ? offerGate?.ok === true : gate.ok;
    // 고친 글이면 서버가 그 글을 검사하고 기억한 번호, 아니면 AI 초안의 번호 (글자는 보내지 않는다 — 번호만)
    const sendId = kind === 'message' && edited ? editedReplyId : replyId;
    if (!allowed || sendId === null || inFlight.current) return;
    inFlight.current = true;
    // T104: 보낸 순간의 글·예측 (Send 뒤 분기와 단계 위험의 입력)
    const snap = { text, forecast };
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
      next = await sendReplyAction({ disputeId, kind, replyId: sendId, confirmedCommitments: confirmed });
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
    if (next.ok) setSentSnap(snap);
    setOutcome(next);
    setSendState(next.ok ? 'done' : 'failed');
    setSent(next.ok);
    // T104 F5-25·28·29: 메시지는 Send 뒤 칸의 **마지막 단계 때 한 번** (CaseProgress onFinish → completeAction).
    // 제안은 뒤 칸이 없으므로 성공한 순간에 (T091·T102 그대로)
    if (next.ok && kind === 'offer') completeAction(next.mode === 'simulated', savings);
  }

  /**
   * T091·T102 상자: 이번 주 카드 "+$N just now"·토스트 (엔진 actionSavings 값, 화면 상태만) + Today 목록 "Done today"
   * (가짜 전송은 Simulated로 표시). 성공한 보내기에서만 부른다.
   */
  function completeAction(simulated: boolean, amount: string | null) {
    report(amount);
    markDone(disputeId, { simulated });
  }

  /** T100: 고친 글을 서버에서 번역·검사한다 (보내지 않는다). 결과는 지금 글자에 묶는다. */
  async function translateEdited() {
    if (!gate.translate || replyId === null || typing || sendState !== 'idle') return;
    const sentFor = text;
    setEditRun({ text: sentFor, result: 'translating' });
    let result: EditedPrepareOutcome;
    try {
      result = await prepareEditedAction({ disputeId, replyId, text: sentFor });
    } catch {
      result = { ok: false, reasonKey: EDIT_KEYS.aiUnavailable };
    }
    setEditRun((now) => (now !== null && now.text === sentFor ? { text: sentFor, result } : now));
  }

  function again() {
    setSentSnap(null);
    setOutcome(null);
    setSendState('idle');
    setSent(false);
    unmarkDone(disputeId);
  }

  const result = view.result;
  const busy = sendState !== 'idle';

  const commitmentsBlock = (
    <>
      {shownView.addedInTranslation.length === 0 ? null : (
        <div className="notice reply-alert" role="alert">
          <p>{t('case.reply.addedInTranslation')}</p>
          <ul className="reply-list">
            {shownView.addedInTranslation.map((item) => (
              <li key={item.category}>{t(item.labelKey)}</li>
            ))}
          </ul>
        </div>
      )}

      {shownView.commitments.length === 0 ? null : (
        <fieldset className="notice reply-commitments">
          <legend className="small">{t('case.reply.outsidePolicy')}</legend>
          {shownView.commitments.map((commitment) => (
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
        {detailsPanel([])}

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

  // ── T092: 보내기 성공(공개 모드는 Simulated 성공) 뒤 → "What happens next · Simulated" 칸 (Replay면 여기로 돌아온다)
  if (sendState === 'done' && outcome !== null && outcome.ok) {
    return (
      <CaseProgress
        disputeId={disputeId}
        live={outcome.mode === 'live'}
        language={language}
        buyerShort={buyerShort}
        sentText={shownView.outgoing?.text ?? null}
        sentLocale={base.buyerLocale ?? null}
        scenarioInput={scenarioInput}
        outcome={sentOutcome}
        baseForecast={forecast}
        onFinish={(out) => {
          // 금액은 ok 분기만 (refund·cb는 환불로 끝나 엔진 actionSavings(refund) = 0 → "+$N"·토스트 없음)
          completeAction(outcome.mode === 'simulated', out === 'ok' ? savings : null);
        }}
        onReplay={() => {
          again();
          setText(anchor ?? '');
        }}
      />
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
              {/* 시안: rushed·Use AI draft = typeOut, Clear = 바로 비움. 타이핑 중에는 모두 꺼진다 */}
              <button
                type="button"
                className="desk-button-tint"
                disabled={busy || typing}
                onClick={() => typeOut(t('case.reply.rushedExample'), 'custom')}
              >
                {t('case.reply.rushed')}
              </button>
              <button
                type="button"
                className="desk-button-tint"
                disabled={busy || typing}
                onClick={() => typeOut(anchor, bestMove)}
              >
                <AiPill small decorative />
                {t('case.reply.useAiDraft')}
              </button>
              <button
                type="button"
                className="desk-button-tint"
                disabled={busy || typing}
                onClick={() => {
                  setText('');
                  desk.setPath('custom');
                }}
              >
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
                // 시안 editorSt: 빈 글 = 회색, 위험 50% 이상 = 빨강, 아니면 남색 (transition border-color .3s)
                <div
                  className={`reply-editor ${
                    empty ? 'reply-editor-empty' : reaction?.chargebackHigh === true ? 'reply-editor-high' : 'reply-editor-ok'
                  }`}
                  data-edited={edited ? 'true' : undefined}
                >
                  <div className="reply-editor-field">
                    <textarea
                      id={`reply-input-${disputeId}`}
                      className="reply-textarea"
                      lang="en"
                      rows={5}
                      value={text}
                      readOnly={busy || typing}
                      aria-busy={typing ? 'true' : undefined}
                      placeholder={t('case.reply.placeholder')}
                      onChange={(event) => {
                        setText(event.target.value);
                        desk.setPath('custom');
                      }}
                    />
                    {/* T090: 알약 안 Assumption은 뺀다. T091: 50% 이상이면 빨강 (시안 pillSt, transition background-color .3s) */}
                    {reaction === null ? null : (
                      <span
                        className={reaction.chargebackHigh ? 'reply-editor-pill reply-editor-pill-high num' : 'reply-editor-pill num'}
                      >
                        {t('case.choice.chargeback', { percent: reaction.chargeback })}
                      </span>
                    )}
                  </div>
                  <div className="reply-tray">
                    {rows !== null ? (
                      <LintTray
                        rows={rows}
                        empty={empty}
                        refundDone={!empty && detected?.features.refundNow === true}
                        busy={busy || typing}
                        onChip={onChip}
                        toggle={detailsToggle}
                      />
                    ) : chips !== null ? (
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
                    {detailsPanel(rows === null || empty ? [] : rows.good)}
                  </div>
                </div>
              )}

              <div className="reply-block reply-box">
                <h3 className="reply-box-title">{readsLabel}</h3>
                {edited && editedView !== null && editedView.outgoing !== null ? (
                  // T100: 고친 글을 서버가 번역·검사했다 → 그 전송본 (실제로 나갈 글자와 같은 채움 `screenText`)
                  <>
                    <p className="reply-text reply-outgoing" lang={base.buyerLocale ?? undefined} data-edited-outgoing="true">
                      {editedView.outgoing.text}
                    </p>
                    {gate.ok ? <p className="small muted reply-edited-checked">{t('case.reply.editedChecked')}</p> : null}
                  </>
                ) : edited ? (
                  // 시안 koTxt: 글을 바꾸면(카드·Add·Remove·직접 입력) "Translated to Korean when you send." (회색).
                  // 번역 중이면 "Translating…". 검사 전·중에는 관문(editGate)이 Send를 끄고 이유를 보인다
                  <p className="reply-text reply-outgoing reply-auto-tr" aria-busy={editStatus.state === 'translating' ? 'true' : undefined}>
                    {editStatus.state === 'translating' ? t('case.reply.translating') : t('case.reply.autoTr', { language })}
                  </p>
                ) : view.outgoing === null ? (
                  <p className="small muted">{t('case.reply.outgoingUnavailable')}</p>
                ) : (
                  <p className="reply-text reply-outgoing" lang={base.buyerLocale ?? undefined}>
                    {view.outgoing.text}
                  </p>
                )}
              </div>
            </div>

            {/* 입력칸이 없으면(초안 글 없음) Details를 여기 둔다 */}
            {anchor === null ? (
              <>
                {detailsToggle}
                {detailsPanel([])}
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
              {/* T100: 고친 글은 먼저 서버에서 번역·검사 (보내지 않는다). 검사 전일 때만 보인다 */}
              {gate.translate ? (
                <button
                  type="button"
                  className="reply-button-quiet reply-translate"
                  disabled={busy || typing || replyId === null}
                  onClick={() => void translateEdited()}
                >
                  {t('case.reply.translateCheck')}
                </button>
              ) : null}
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
