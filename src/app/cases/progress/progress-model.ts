/**
 * Send 뒤 "What happens next · Simulated" 칸의 상태와 보기용 값 (T092, SPEC v2.15 8-4장, 시안 Desk.dc.html phase 'sent').
 *
 * 시안 로직(`send()`의 `shown`·`typing`, `this.later(…, 1300 * (k - 1) + 400)`, `replay`)을 그대로 따르되,
 * DECISIONS 2026-11-11 22:55 예외만 다르다:
 *  - 제목 "What happens next · Simulated", 손님 답장부터 모든 단계에 "Simulated" (공개 모드는 Send도 Simulated)
 *  - 시안의 "Auto" 단계 대신 [Forward to carrier] — 판매자가 누를 때까지 멈춘다. "POST carrier/… 200" 줄 없음
 *  - 통관번호는 가린다 (`maskCustomsIds`, 손님 답장 문장 안에서도)
 *  - 결과 상자("23 days · 4 messages", "−$82")·배송·추적 동기화 단계는 근거 없는 숫자·약속이라 없다
 *
 * **계산하지 않는다.** 위험 %는 엔진 `scenarioRisk` 값을 `toPercentRounded`로 옮기기만 한다.
 * 이 파일은 순수 함수만 둔다 (타이머·DOM 없음 — 화면 `case-progress.tsx`가 부른다).
 */
import { z } from 'zod';

import type { CaseEvent, CaseEventKind, ScenarioPoint, ScenarioStepKind } from '@/types';

import motionJson from '../../../../config/motion.json';
import { t } from '../../_shared/copy';
import { toPercentRounded } from '../../_shared/percent';

// ───────────────────────────── 모션 값 (config/motion.json `caseProgress`) ─────────────────────────────

const TIME = /^\d+(\.\d+)?m?s$/;
const timing = z.object({ duration: z.string().regex(TIME), easing: z.string().min(1) });

const ProgressMotionSchema = z.object({
  firstStepMs: z.number().int().nonnegative(),
  stepMs: z.number().int().nonnegative(),
  step: timing,
  bubble: timing,
  typingDot: timing.extend({ stagger: z.string().regex(TIME) }),
  flash: timing,
  toast: timing.extend({ hideMs: z.number().int().nonnegative() }),
});

export type ProgressMotion = z.infer<typeof ProgressMotionSchema>;

let cachedMotion: ProgressMotion | null = null;

/** 설정을 검사해 읽는다 (틀리면 예외). */
export function progressMotion(raw?: unknown): ProgressMotion {
  if (raw !== undefined) return ProgressMotionSchema.parse(raw);
  cachedMotion ??= ProgressMotionSchema.parse((motionJson as { caseProgress?: unknown }).caseProgress);
  return cachedMotion;
}

/** css 변수 (진행 칸·말풍선·토스트에 붙인다). css는 `var(--cprog-…)`만 쓴다. */
export function progressMotionVars(m: ProgressMotion = progressMotion()): Record<string, string> {
  return {
    '--cprog-step': `${m.step.duration} ${m.step.easing}`,
    '--cprog-bubble': `${m.bubble.duration} ${m.bubble.easing}`,
    '--cprog-dot': `${m.typingDot.duration} ${m.typingDot.easing}`,
    '--cprog-dot-stagger': m.typingDot.stagger,
    '--cprog-flash': `${m.flash.duration} ${m.flash.easing}`,
    '--cprog-toast': `${m.toast.duration} ${m.toast.easing}`,
  };
}

/** 시안 `1300 * (k - 1) + 400`: k번째 단계(1부터)가 보내기 뒤 몇 ms에 보이나. */
export function stepDelayMs(k: number, m: ProgressMotion = progressMotion()): number {
  return m.stepMs * (k - 1) + m.firstStepMs;
}

// ───────────────────────────── 상태 (시안 `shown`·`typing`) ─────────────────────────────

/**
 * shown: 1 = 보낸 답장, 2 = 손님 답장 (+ [Forward to carrier] 대기), 3 = 배송사에 전달함, 4 = 세관 통과 (끝).
 * typing: 손님이 입력 중 (shown 1에서만 참 — 시안 `typing: out !== 'refund'`, 다음 단계에서 false).
 */
export type ProgressState = { shown: 1 | 2 | 3 | 4; typing: boolean };

export const PROGRESS_START: ProgressState = { shown: 1, typing: true };

/** 타이머: 손님 답장 도착 (시안 k = 2). */
export function buyerReplied(state: ProgressState): ProgressState {
  return state.shown === 1 ? { shown: 2, typing: false } : state;
}

/** [Forward to carrier] (판매자가 누름). 손님 답장 뒤에만 된다. */
export function forwardToCarrier(state: ProgressState): ProgressState {
  return state.shown === 2 ? { shown: 3, typing: false } : state;
}

/** 타이머: 세관 통과 (전달 뒤 한 간격). */
export function customsCleared(state: ProgressState): ProgressState {
  return state.shown === 3 ? { shown: 4, typing: false } : state;
}

export const awaitingForward = (state: ProgressState): boolean => state.shown === 2;
export const progressFinished = (state: ProgressState): boolean => state.shown === 4;
/** 시안 `stepsRunning`: 끝나지 않았고 판매자를 기다리지도 않을 때 점 세 개. */
export const progressRunning = (state: ProgressState): boolean => !progressFinished(state) && !awaitingForward(state);

// ───────────────────────────── 통관번호 가리기 ─────────────────────────────

/** 통관번호 꼴 (P + 숫자 8자리 이상). */
const CUSTOMS_ID = /\bP(\d{8,})\b/g;
/** 가린 꼴의 점 수 (`P•••••••9012`, 사람 결정 22:55). */
const MASK_DOTS = 7;
const KEEP_LAST = 4;

/** 글 안의 통관번호를 `P•••••••9012`처럼 가린다. 가짜 번호도 온전히 쓰지 않는다. */
export function maskCustomsIds(text: string): string {
  return text.replace(CUSTOMS_ID, (_match, digits: string) => `P${'•'.repeat(MASK_DOTS)}${digits.slice(-KEEP_LAST)}`);
}

/** 가리지 않은 통관번호가 남아 있나 (시험·방어용). */
export function hasRawCustomsId(text: string): boolean {
  return new RegExp(CUSTOMS_ID.source).test(text);
}

// ───────────────────────────── 단계 줄 ─────────────────────────────

/** 위험 칩을 빨강으로 그리는 경계 (시안 `pSt: st.p >= 0.5`). 그림 기준이고 판정이 아니다. */
const HIGH_CHIP = 0.5;

export type StepIcon = 'sent' | 'buyer' | 'pending' | 'done';

export type StepRow = {
  step: ScenarioStepKind;
  title: string;
  sub: string;
  /** 손님 답장 단계의 따옴표 글 (가린 꼴). */
  quote: string | null;
  simulated: boolean;
  /** "Risk 4%" (엔진 값). 시안처럼 보낸 답장 줄에는 없다. 엔진 값이 없으면 `null`. */
  risk: string | null;
  riskHigh: boolean;
  icon: StepIcon;
  /** 손님 이름 첫 글자 (시안 'S'). 이름을 모르면 `null` → 기호. */
  initial: string | null;
  /** [Forward to carrier] 대기 줄. */
  pending: boolean;
  last: boolean;
  /** 이 줄의 사건 (`source: 'simulated'` — 실제 기록 아님). 대기 줄은 `null`. */
  event: CaseEvent | null;
};

export type StepRowsInput = {
  state: ProgressState;
  points: readonly ScenarioPoint[] | null;
  live: boolean;
  disputeId: string;
  language: string;
  buyerName: string | null;
  /** 보낸 시각 (ISO). 시뮬레이션 사건의 `at`. */
  at: string;
};

const KIND: Record<ScenarioStepKind, CaseEventKind> = {
  sent: 'seller_reply',
  buyer_reply: 'buyer_message',
  forwarded: 'carrier_event',
  cleared: 'carrier_event',
};

function pointOf(points: readonly ScenarioPoint[] | null, step: ScenarioStepKind): ScenarioPoint | null {
  return points?.find((point) => point.step === step) ?? null;
}

function riskOf(points: readonly ScenarioPoint[] | null, step: ScenarioStepKind): { risk: string | null; riskHigh: boolean } {
  const point = pointOf(points, step);
  if (point === null) return { risk: null, riskHigh: false };
  return { risk: t('case.progress.risk', { percent: toPercentRounded(point.pChargeback) }), riskHigh: point.pChargeback >= HIGH_CHIP };
}

function simulatedEvent(step: ScenarioStepKind, at: string, text: string): CaseEvent {
  return { at, kind: KIND[step], source: 'simulated', text };
}

/** 손님 답장 문구 (고정 문구는 copy, 가린 꼴). */
export function buyerReplyText(): { original: string; english: string } {
  return { original: maskCustomsIds(t('case.progress.buyer.original')), english: maskCustomsIds(t('case.progress.buyer.english')) };
}

/** 지금 보이는 단계 줄 (시안 `stepRows`). */
export function stepRows(input: StepRowsInput): StepRow[] {
  const { state, points, live, disputeId, language, buyerName, at } = input;
  const initial = buyerName === null || buyerName.length === 0 ? null : buyerName.slice(0, 1).toUpperCase();
  const english = (key: string, params?: Record<string, string>) => t(key, params, 'en');
  const rows: Omit<StepRow, 'last'>[] = [
    {
      step: 'sent',
      title: t('case.progress.sent.title', { language }),
      sub: live ? t('case.progress.sent.subLive', { disputeId }) : t('case.progress.sent.subSimulated'),
      quote: null,
      simulated: !live,
      risk: null,
      riskHigh: false,
      icon: 'sent',
      initial: null,
      pending: false,
      event: simulatedEventOrReal('sent', live, at, english('case.progress.sent.title', { language })),
    },
  ];
  if (state.shown >= 2) {
    const titleKey = buyerName === null ? 'case.progress.buyer.titleUnknown' : 'case.progress.buyer.title';
    const params = buyerName === null ? undefined : { name: buyerName };
    rows.push({
      step: 'buyer_reply',
      title: t(titleKey, params),
      sub: '',
      quote: buyerReplyText().original,
      simulated: true,
      ...riskOf(points, 'buyer_reply'),
      icon: 'buyer',
      initial,
      pending: false,
      event: simulatedEvent('buyer_reply', at, english(titleKey, params)),
    });
  }
  if (state.shown === 2) {
    rows.push({
      step: 'forwarded',
      title: t('case.progress.forward.title'),
      sub: t('case.progress.forward.sub'),
      quote: null,
      simulated: true,
      risk: null,
      riskHigh: false,
      icon: 'pending',
      initial: null,
      pending: true,
      event: null,
    });
  }
  if (state.shown >= 3) {
    rows.push({
      step: 'forwarded',
      title: t('case.progress.forwarded.title'),
      sub: t('case.progress.forwarded.sub'),
      quote: null,
      simulated: true,
      ...riskOf(points, 'forwarded'),
      icon: 'done',
      initial: null,
      pending: false,
      event: simulatedEvent('forwarded', at, english('case.progress.forwarded.title')),
    });
  }
  if (state.shown >= 4) {
    rows.push({
      step: 'cleared',
      title: t('case.progress.cleared.title'),
      sub: t('case.progress.cleared.sub'),
      quote: null,
      simulated: true,
      ...riskOf(points, 'cleared'),
      icon: 'done',
      initial: null,
      pending: false,
      event: simulatedEvent('cleared', at, english('case.progress.cleared.title')),
    });
  }
  return rows.map((row, index) => ({ ...row, last: index === rows.length - 1 }));
}

/**
 * 보낸 답장 줄의 사건. 녹화 모드(실제 샌드박스 전송)면 실제 기록은 서버가 남기므로 여기서는 만들지 않는다 (`null`).
 * 공개 모드(가짜 전송)면 시뮬레이션 사건.
 */
function simulatedEventOrReal(step: ScenarioStepKind, live: boolean, at: string, text: string): CaseEvent | null {
  return live ? null : simulatedEvent(step, at, text);
}

/** 지금 보이는 단계 (shown 순서). */
function visibleSteps(state: ProgressState): ScenarioStepKind[] {
  const visible: ScenarioStepKind[] = ['sent'];
  if (state.shown >= 2) visible.push('buyer_reply');
  if (state.shown >= 3) visible.push('forwarded');
  if (state.shown >= 4) visible.push('cleared');
  return visible;
}

/** 지금 단계까지의 위험 (곡선 끝점·큰 %). 시안 `curP`: 보인 단계 중 마지막 값. 엔진 값이 없으면 `null`. */
export function currentRisk(state: ProgressState, points: readonly ScenarioPoint[] | null): number | null {
  const trail = riskTrail(state, points);
  return trail.length === 0 ? null : trail[trail.length - 1];
}

/**
 * T098b: 곡선에 그릴 Send 뒤 점 (시안 liveP — 보낸 답장 + 보인 단계마다 값이 있으면 하나씩). 엔진 `scenarioRisk`
 * 값을 순서대로 옮기기만 한다. 엔진 값이 없으면 빈 배열 (곡선은 보내기 전 모양 그대로).
 */
export function riskTrail(state: ProgressState, points: readonly ScenarioPoint[] | null): number[] {
  if (points === null) return [];
  const out: number[] = [];
  for (const step of visibleSteps(state)) {
    const point = pointOf(points, step);
    if (point !== null) out.push(point.pChargeback);
  }
  return out;
}
