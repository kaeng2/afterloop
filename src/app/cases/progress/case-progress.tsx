'use client';

/**
 * Send 뒤 "What happens next · Simulated" 칸 (T092, SPEC v2.15 8-4장, 시안 Desk.dc.html phase 'sent').
 * 답장 칸(`../reply/reply-panel.tsx`)이 보내기에 성공하면(공개 모드는 Simulated 성공) 이 칸으로 바뀐다.
 *
 * T104: 흐름은 보낸 답장의 예측으로 고른 분기(`outcome`, 시안 L661 `out` = `scenarioOutcome`)를 따른다.
 *  - ok: 보낸 말풍선 + typing → 1300·(k−1)+400ms 뒤 손님 답장(통관번호, 가림) → [Forward to carrier](판매자, Simulated)
 *    → 1300ms 뒤 세관 통과 (끝)
 *  - refund: 보낸 말풍선(typing 없음) → 환불 승인 대기 [Approve refund](Simulated) → 1300ms 뒤 손님 환불 확인 (끝)
 *  - cb: 보낸 말풍선 + typing → 화난 손님 답장(차지백 언급) + 환불 승인 대기 [Approve refund](Simulated) → 끝
 * 승인 버튼은 **화면 상태만 바꾼다** (환불·전달 쓰기 0회).
 *
 * 끝(마지막 단계)에서 한 번만: 부르는 쪽 `onFinish` (이번 주 카드 "+$N just now"·토스트·Done today — T102 상자) +
 * ok 분기면 "이번 주" 카드 숫자 칸 flash (시안 bump, 마지막 단계 때 한 번). 이 칸은 따로 토스트를 띄우지 않는다.
 *
 * 단계별 위험 %는 엔진 `scenarioRisk`(어댑터 `progress-client.ts`) + Assumption. 계약 단계(`ScenarioStepKind`)가 아닌
 * 줄에는 위험 칩이 없다. 곡선 카드 끝점·큰 %도 같은 값으로 옮긴다 (`useDraftForecast`).
 * **PayPal·배송사·AI 호출 0회, PayPal activity 서랍에 아무것도 남기지 않는다** — 이 파일은 서버 액션·fetch를 부르지
 * 않는다. 숫자를 만들지 않는다. `prefers-reduced-motion`이면 간격 0·애니메이션 끔.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { ReplyForecast } from '@/types';

import { AiPill, Badge } from '../../_shared/badges';
import { useT } from '../../_shared/locale-context';
import { useDraftForecast } from '../view/draft-forecast';
import { scenarioRiskClient, type ScenarioInput, type ScenarioRiskClient } from './progress-client';
import {
  approveStep,
  awaitingForward,
  buyerBubble,
  buyerReplied,
  currentRisk,
  customsCleared,
  progressFinished,
  progressMotion,
  progressMotionVars,
  progressRunning,
  progressStart,
  riskTrail,
  stepAfterApproval,
  stepDelayMs,
  stepRows,
  type ProgressState,
  type ScenarioOutcome,
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
  /** 엔진 `scenarioRisk` 입력 (보낸 글 = input.text). 없으면 위험 % 없음. */
  scenarioInput: ScenarioInput | null;
  /** T104: 보낸 답장의 예측으로 고른 분기 (`scenarioOutcome`). 없으면 ok. */
  outcome?: ScenarioOutcome;
  /** 보내기 직전 예측 (곡선 카드에 되돌릴 값). */
  baseForecast: ReplyForecast | null;
  /** T104: 마지막 단계 때 한 번 (이번 주 카드·토스트·Done today는 부르는 쪽이 T102 상자로). */
  onFinish?: (outcome: ScenarioOutcome) => void;
  onReplay: () => void;
  /** 시험용 주입. */
  initial?: ProgressState;
  scenario?: ScenarioRiskClient;
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

function Step({ row, onApprove }: { row: StepRow; onApprove: () => void }) {
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
        {row.pending && row.actionKey !== null ? (
          <div className="cprog-act">
            {/* 화면 상태만 바꾼다 (Simulated) — 서버 액션·fetch 없음 */}
            <button type="button" className="cprog-btn" onClick={onApprove}>
              {t(row.actionKey)}
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
  outcome,
  live,
  language,
  buyerShort,
  sentText,
  sentLocale,
  style,
}: {
  state: ProgressState;
  outcome: ScenarioOutcome;
  live: boolean;
  language: string;
  buyerShort: string | null;
  sentText: string | null;
  sentLocale: string | null;
  style: CSSProperties;
}) {
  const t = useT();
  const reply = buyerBubble(state, outcome);
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
      {reply === null ? null : (
        <li className="cprog-bubble-wrap" style={style} data-source="simulated" data-outcome={outcome}>
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
            {reply.tags.map((tag) => (
              <span key={tag.key} className={tag.bad ? 'desk-chip desk-chip-bad' : 'desk-chip'}>
                {t(tag.key)}
              </span>
            ))}
          </div>
        </li>
      )}
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
  outcome = 'ok',
  baseForecast,
  onFinish,
  onReplay,
  initial,
  scenario = scenarioRiskClient,
}: CaseProgressProps) {
  const t = useT();
  const motion = progressMotion();
  const varMap = useMemo(() => progressMotionVars(motion), [motion]);
  const vars = varMap as CSSProperties;
  const [state, setState] = useState<ProgressState>(() => initial ?? progressStart(outcome));
  const [thread, setThread] = useState<Element | null>(null);
  const [at] = useState(() => new Date().toISOString());
  const root = useRef<HTMLElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  });
  const { setForecast, setTrail } = useDraftForecast();

  const points = useMemo(() => (scenarioInput === null ? null : scenario(scenarioInput)), [scenario, scenarioInput]);
  const rows = stepRows({ state, points, live, disputeId, language, buyerName: buyerShort, at, outcome });
  const risk = currentRisk(state, points, outcome);
  const finished = progressFinished(state, outcome);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, prefersReducedMotion() ? 0 : ms));
  }

  // 대화 목록(서버가 그린 `.case-thread`)을 찾는다 — 찾으면 말풍선을 그 끝에 붙인다 (시안 thread.push)
  useEffect(() => {
    const page = root.current?.closest('.case-page') ?? null;
    setThread(page?.querySelector('.case-thread') ?? null);
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.length = 0;
    };
  }, []);

  // 시안 send(): k = 2는 1300·(2−1)+400ms 뒤. 그 다음은 판매자가 승인 버튼을 누를 때까지 멈춘다
  useEffect(() => {
    if (state.shown !== 1) return;
    later(() => setState(buyerReplied), stepDelayMs(2, motion));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만 (시안 send())
  }, []);

  // 곡선 카드: 단계마다 점이 하나씩 늘어난다 (T098b, 시안 liveP — 값은 엔진 scenarioRisk, 큰 % = 마지막 값).
  // 칸을 떠나면(Replay) 점을 지우고 보내기 전 예측으로 되돌린다
  const trail = useMemo(() => riskTrail(state, points, outcome), [state, points, outcome]);
  useEffect(() => {
    setTrail(trail);
  }, [trail, setTrail]);
  useEffect(() => {
    if (baseForecast !== null && risk !== null) setForecast(baseForecast);
  }, [baseForecast, risk, setForecast]);
  useEffect(
    () => () => {
      setTrail([]);
      setForecast(baseForecast);
    },
    [baseForecast, setForecast, setTrail],
  );

  // 끝 (마지막 단계 때 한 번, 시안 L668-670 bump): ok면 "이번 주" 카드 숫자 칸 flash. 금액·토스트·Done today는 onFinish
  useEffect(() => {
    if (!finished) return;
    if (outcome === 'ok' && !prefersReducedMotion()) {
      const cells = Array.from(document.querySelectorAll<HTMLElement>(WEEKLY_CELLS)).slice(0, FLASH_CELLS);
      for (const cell of cells) {
        cell.classList.remove(FLASH_CLASS);
        cell.style.setProperty('--cprog-flash', varMap['--cprog-flash']);
        void cell.offsetWidth; // 같은 칸을 다시 번쩍이게 (시안 flash 키 바꾸기)
        cell.classList.add(FLASH_CLASS);
        cell.addEventListener('animationend', () => cell.classList.remove(FLASH_CLASS), { once: true });
      }
    }
    finishRef.current?.(outcome);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 끝날 때 한 번
  }, [finished]);

  /** 승인 ([Forward to carrier] · [Approve refund]) — 화면 상태만 (Simulated, 쓰기 0). */
  function approve() {
    if (!awaitingForward(state)) return;
    setState(approveStep);
    if (stepAfterApproval(outcome)) later(() => setState(customsCleared), motion.stepMs);
  }

  function replay() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    onReplay();
  }

  const bubbles = (
    <Bubbles
      state={state}
      outcome={outcome}
      live={live}
      language={language}
      buyerShort={buyerShort}
      sentText={sentText}
      sentLocale={sentLocale}
      style={vars}
    />
  );
  const threadNode: ReactNode = thread === null ? <ol className="case-thread cprog-thread">{bubbles}</ol> : createPortal(bubbles, thread);

  return (
    <section
      ref={root}
      className="cprog"
      aria-labelledby={`cprog-title-${disputeId}`}
      style={vars}
      data-shown={state.shown}
      data-outcome={outcome}
    >
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
          <Step key={`${row.step}-${row.pending ? 'pending' : 'done'}`} row={row} onApprove={approve} />
        ))}
      </ol>
      {progressRunning(state, outcome) ? (
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
    </section>
  );
}
