'use client';

/**
 * Send 뒤 "What happens next · Simulated" 칸 (T092, SPEC v2.15 8-4장, 시안 Desk.dc.html phase 'sent').
 * 답장 칸(`../reply/reply-panel.tsx`)이 보내기에 성공하면(공개 모드는 Simulated 성공) 이 칸으로 바뀐다.
 *
 * 순서 (시안 `send()` 그대로, 간격은 config/motion.json `caseProgress`):
 *  1. 보낸 말풍선(보낸 글 = 구매자 언어 전송본) + "typing" 점 세 개 → 대화 목록 끝에 붙는다
 *  2. 1300·(k−1)+400ms 뒤 손님 답장 (Simulated, 고정 문구는 copy, 통관번호 가림)
 *  3. [Forward to carrier] — **판매자가 누를 때까지 멈춘다** (시안의 Auto 대신, 사람 결정 22:55). 누르면 Simulated
 *  4. 1300ms 뒤 세관 통과 (Simulated) → "이번 주" 카드 숫자 칸 flash + 토스트 "+$N kept" (N = 엔진 `actionSavings`)
 *  5. [Replay this case] → 처음(답장 칸)으로
 *
 * 단계별 위험 %는 엔진 `scenarioRisk`(어댑터 `progress-client.ts`) + Assumption. 곡선 카드 끝점·큰 %도 같은 값으로
 * 옮긴다 (`useDraftForecast`). **PayPal·배송사·AI 호출 0회, PayPal activity 서랍에 아무것도 남기지 않는다** — 이 파일은
 * 서버 액션·fetch를 부르지 않는다. 숫자를 만들지 않는다. `prefers-reduced-motion`이면 간격 0·애니메이션 끔.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { BoardState, Evaluation, ReplyForecast } from '@/types';

import { AiPill, Badge } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import { toDollarsRounded } from '../../_shared/money';
import { useDraftForecast } from '../view/draft-forecast';
import {
  actionSavingsClient,
  scenarioRiskClient,
  type ActionSavingsClient,
  type ScenarioInput,
  type ScenarioRiskClient,
} from './progress-client';
import {
  awaitingForward,
  buyerReplied,
  buyerReplyText,
  currentRisk,
  customsCleared,
  forwardToCarrier,
  PROGRESS_START,
  progressFinished,
  progressMotion,
  progressMotionVars,
  progressRunning,
  stepDelayMs,
  stepRows,
  type ProgressState,
  type StepRow,
} from './progress-model';

import './case-progress.css';

export type CaseProgressProps = {
  disputeId: string;
  /** 실제 샌드박스로 보냈나 (녹화 모드). 거짓이면 보낸 답장도 Simulated. */
  live: boolean;
  /** 구매자 언어 이름 ("Korean"). */
  language: string;
  /** 손님 짧은 이름 (데이터에서). 모르면 `null`. */
  buyerShort: string | null;
  /** 보낸 글 (구매자 언어 전송본). */
  sentText: string | null;
  sentLocale: string | null;
  /** 엔진 `scenarioRisk` 입력 (보낸 글 = 기준 초안). 없으면 위험 % 없음. */
  scenarioInput: ScenarioInput | null;
  /** 토스트 금액용 (엔진 `actionSavings`). 없으면 토스트 없음. */
  board: BoardState | null;
  move: Evaluation['move'] | null;
  /** 보내기 직전 예측 (곡선 카드에 되돌릴 값). */
  baseForecast: ReplyForecast | null;
  onReplay: () => void;
  /** 시험용 주입. */
  initial?: ProgressState;
  scenario?: ScenarioRiskClient;
  savings?: ActionSavingsClient;
};

const REDUCED = '(prefers-reduced-motion: reduce)';
/** "이번 주" 카드의 숫자 칸 (시안 `dash` 앞 3칸 flash). 사실 한 줄 칸은 빼고. */
const WEEKLY_CELLS = '.weekly-cell:not(.weekly-fact)';
const FLASH_CELLS = 3;
const FLASH_CLASS = 'cprog-flash';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(REDUCED).matches;
}

function Dots() {
  return (
    <span className="cprog-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function SimTag() {
  const t = useT();
  return <span className="cprog-sim">{t('case.progress.simulated')}</span>;
}

function StepIconView({ row }: { row: StepRow }) {
  const glyph = row.icon === 'buyer' ? (row.initial ?? '·') : row.icon === 'pending' ? '!' : '✓';
  return (
    <span className={`cprog-icon cprog-icon-${row.icon}`} aria-hidden="true">
      {glyph}
    </span>
  );
}

function Step({ row, onForward }: { row: StepRow; onForward: () => void }) {
  const t = useT();
  return (
    <li className="cprog-step" data-step={row.step} data-source={row.event?.source ?? undefined}>
      <div className="cprog-rail">
        <StepIconView row={row} />
        {row.last ? null : <span className="cprog-line" />}
      </div>
      <div className="cprog-body">
        <div className="cprog-head">
          <b className="cprog-title">{row.title}</b>
          {row.simulated ? <SimTag /> : null}
          {row.risk === null ? null : (
            <span className={row.riskHigh ? 'cprog-chip cprog-chip-high num' : 'cprog-chip num'} title={t('case.progress.riskHint')}>
              {row.risk}
            </span>
          )}
        </div>
        {row.quote === null ? null : (
          <span className="cprog-sub" lang="ko">
            “{row.quote}”
          </span>
        )}
        {row.sub === '' ? null : <span className="cprog-sub">{row.sub}</span>}
        {row.pending ? (
          <div className="cprog-act">
            <button type="button" className="cprog-btn" onClick={onForward}>
              {t('case.progress.forward.button')}
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** 대화 목록 끝에 붙는 말풍선 (시안 thread push: bub-out → typing → bub-sim). */
function Bubbles({
  state,
  live,
  language,
  buyerShort,
  sentText,
  sentLocale,
  style,
}: {
  state: ProgressState;
  live: boolean;
  language: string;
  buyerShort: string | null;
  sentText: string | null;
  sentLocale: string | null;
  style: CSSProperties;
}) {
  const t = useT();
  const reply = buyerReplyText();
  return (
    <>
      {sentText === null ? null : (
        <li className="cprog-bubble-wrap cprog-bubble-wrap-out" style={style} data-source={live ? undefined : 'simulated'}>
          <div className="cprog-bubble cprog-bubble-out">
            <p className="cprog-bubble-text" lang={sentLocale ?? undefined}>
              {sentText}
            </p>
            <p className="cprog-bubble-sub">
              {t('case.progress.sentBubble', { language })}
              {live ? null : ` · ${t('case.progress.simulated')}`}
            </p>
          </div>
        </li>
      )}
      {state.typing ? (
        <li className="cprog-bubble-wrap" style={style}>
          <div className="cprog-bubble cprog-typing">
            {buyerShort === null ? t('case.progress.typingUnknown') : t('case.progress.typing', { name: buyerShort })}
            <Dots />
          </div>
        </li>
      ) : null}
      {state.shown >= 2 ? (
        <li className="cprog-bubble-wrap" style={style} data-source="simulated">
          <div className="cprog-bubble cprog-bubble-sim">
            <span className="cprog-bubble-tag">{t('case.progress.simReply')}</span>
            <p className="cprog-bubble-text" lang="ko">
              {reply.original}
            </p>
            <p className="cprog-bubble-sub">
              {t('case.view.translated')} · <span lang="en">{reply.english}</span> · {t('case.progress.simulated')}
            </p>
          </div>
          <div className="case-read">
            <span className="case-read-label">{t('case.read.label')}</span>
            <span className="desk-chip">{t('case.progress.buyer.tagSent')}</span>
            <span className="desk-chip">{t('case.progress.buyer.tagCalm')}</span>
          </div>
        </li>
      ) : null}
    </>
  );
}

export function CaseProgress({
  disputeId,
  live,
  language,
  buyerShort,
  sentText,
  sentLocale,
  scenarioInput,
  board,
  move,
  baseForecast,
  onReplay,
  initial = PROGRESS_START,
  scenario = scenarioRiskClient,
  savings = actionSavingsClient,
}: CaseProgressProps) {
  const t = useT();
  const motion = progressMotion();
  const varMap = useMemo(() => progressMotionVars(motion), [motion]);
  const vars = varMap as CSSProperties;
  const [state, setState] = useState<ProgressState>(initial);
  const [toast, setToast] = useState<string | null>(null);
  const [thread, setThread] = useState<Element | null>(null);
  const [body, setBody] = useState<Element | null>(null);
  const [at] = useState(() => new Date().toISOString());
  const root = useRef<HTMLElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { setForecast } = useDraftForecast();

  const points = useMemo(() => (scenarioInput === null ? null : scenario(scenarioInput)), [scenario, scenarioInput]);
  const rows = stepRows({ state, points, live, disputeId, language, buyerName: buyerShort, at });
  const risk = currentRisk(state, points);
  const finished = progressFinished(state);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, prefersReducedMotion() ? 0 : ms));
  }

  // 대화 목록(서버가 그린 `.case-thread`)을 찾는다 — 찾으면 말풍선을 그 끝에 붙인다 (시안 thread.push)
  useEffect(() => {
    const page = root.current?.closest('.case-page') ?? null;
    setThread(page?.querySelector('.case-thread') ?? null);
    setBody(document.body);
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.length = 0;
    };
  }, []);

  // 시안 send(): k = 2 (손님 답장)는 1300·(2−1)+400ms 뒤. 그 다음은 판매자가 [Forward to carrier]를 누를 때까지 멈춘다
  useEffect(() => {
    if (state.shown !== 1) return;
    later(() => setState(buyerReplied), stepDelayMs(2, motion));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만 (시안 send())
  }, []);

  // 곡선 카드 끝점·큰 % = 지금 단계의 엔진 값. 칸을 떠나면(Replay) 보내기 전 예측으로 되돌린다
  useEffect(() => {
    if (baseForecast === null || risk === null) return;
    setForecast({ ...baseForecast, pChargeback: risk });
  }, [baseForecast, risk, setForecast]);
  useEffect(() => () => setForecast(baseForecast), [baseForecast, setForecast]);

  // 끝: "이번 주" 카드 숫자 칸 flash + 토스트 (시안 bump + toast, 3초 뒤 사라짐). 금액은 엔진 값만
  useEffect(() => {
    if (!finished) return;
    if (!prefersReducedMotion()) {
      const cells = Array.from(document.querySelectorAll<HTMLElement>(WEEKLY_CELLS)).slice(0, FLASH_CELLS);
      for (const cell of cells) {
        cell.classList.remove(FLASH_CLASS);
        cell.style.setProperty('--cprog-flash', varMap['--cprog-flash']);
        void cell.offsetWidth; // 같은 칸을 다시 번쩍이게 (시안 flash 키 바꾸기)
        cell.classList.add(FLASH_CLASS);
        cell.addEventListener('animationend', () => cell.classList.remove(FLASH_CLASS), { once: true });
      }
    }
    const cents = board === null || move === null ? null : savings(board, move);
    if (cents !== null && cents > 0) {
      const text = t('case.progress.toast', { amount: toDollarsRounded(cents) });
      setToast(text);
      later(() => setToast((now) => (now === text ? null : now)), motion.toast.hideMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 끝날 때 한 번
  }, [finished]);

  function forward() {
    if (!awaitingForward(state)) return;
    setState(forwardToCarrier);
    later(() => setState(customsCleared), motion.stepMs);
  }

  function replay() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    onReplay();
  }

  const bubbles = (
    <Bubbles
      state={state}
      live={live}
      language={language}
      buyerShort={buyerShort}
      sentText={sentText}
      sentLocale={sentLocale}
      style={vars}
    />
  );
  const threadNode: ReactNode = thread === null ? <ol className="case-thread cprog-thread">{bubbles}</ol> : createPortal(bubbles, thread);
  const toastNode =
    toast === null ? null : (
      <div className="cprog-toast" role="status" style={vars}>
        <span className="cprog-toast-check" aria-hidden="true">
          ✓
        </span>
        <span className="num">{toast}</span>
      </div>
    );

  return (
    <section ref={root} className="cprog" aria-labelledby={`cprog-title-${disputeId}`} style={vars} data-shown={state.shown}>
      <div className="cprog-top">
        <AiPill />
        <h2 className="desk-card-title" id={`cprog-title-${disputeId}`}>
          {t('case.progress.title')}
        </h2>
        <span className="desk-card-sub">{t('case.progress.sub')}</span>
        {points === null ? null : <Badge kind="assumption" />}
      </div>
      {threadNode}
      <ol className="cprog-steps">
        {rows.map((row) => (
          <Step key={`${row.step}-${row.pending ? 'pending' : 'done'}`} row={row} onForward={forward} />
        ))}
      </ol>
      {progressRunning(state) ? (
        <p className="cprog-running">
          <Dots />
          <span className="case-sr-only">{t('case.progress.running')}</span>
        </p>
      ) : null}
      <div className="cprog-foot">
        <button type="button" className="desk-button-tint" onClick={replay}>
          {t('case.progress.replay')}
        </button>
      </div>
      {body === null ? toastNode : toastNode === null ? null : createPortal(toastNode, body)}
    </section>
  );
}
