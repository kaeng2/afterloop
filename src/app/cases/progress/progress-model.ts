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
 * T104: 흐름은 보낸 답장의 예측으로 고른 분기(ok·refund·cb, `scenarioOutcome` = 시안 L661 `out`)를 따른다. refund·cb의
 * 동작 줄(환불)은 모두 Simulated + 판매자 승인 버튼(화면 상태만, 쓰기 0). 계약 단계(`ScenarioStepKind`) 밖 줄에는 위험 칩 없음.
 *
 * **계산하지 않는다.** 위험 %는 엔진 `scenarioRisk` 값을 `toPercentRounded`로 옮기기만 한다.
 * 이 파일은 순수 함수만 둔다 (타이머·DOM 없음 — 화면 `case-progress.tsx`가 부른다).
 */
import { z } from 'zod';

import type { CaseEvent, CaseEventKind, ReplyForecast, ScenarioPoint, ScenarioStepKind } from '@/types';

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

// ───────────────────────────── 결과 분기 (시안 L661 `out`) ─────────────────────────────

/**
 * T104 F5-15·16: 보낸 답장의 예측으로 진행 흐름을 나눈다 (시안 `send()`:
 * `out = 'ok'; if (p.refund > p.ok) out = 'refund'; if (p.cb > p[out]) out = 'cb'`).
 * ok = 기다림(`pWait`), refund = 환불로 끝남(`pRefund`), cb = 차지백(`pChargeback`) 중 큰 것. 같으면 ok > refund > cb.
 * 엔진 `forecastReply` 결과를 비교만 한다 (argmax, 계산 아님). 예측이 없으면 ok (지금 흐름).
 */
export type ScenarioOutcome = 'ok' | 'refund' | 'cb';

export function scenarioOutcome(forecast: Pick<ReplyForecast, 'pWait' | 'pRefund' | 'pChargeback'> | null): ScenarioOutcome {
  if (forecast === null) return 'ok';
  let out: ScenarioOutcome = 'ok';
  let top = forecast.pWait;
  if (forecast.pRefund > top) {
    out = 'refund';
    top = forecast.pRefund;
  }
  if (forecast.pChargeback > top) out = 'cb';
  return out;
}

// ───────────────────────────── 상태 (시안 `shown`·`typing`) ─────────────────────────────

/**
 * shown: 단계 번호 (1 = 보낸 답장). 분기마다 (`PROGRESS_STEPS`):
 *  - ok: 2 = 손님 답장 (+ [Forward to carrier] 대기), 3 = 배송사에 전달함, 4 = 세관 통과 (끝)
 *  - refund: 2 = 환불 승인 대기, 3 = 환불 승인함(Simulated), 4 = 손님이 환불 확인 (끝). 시안처럼 typing 없음
 *  - cb: 2 = 화난 손님 답장 (+ 환불 승인 대기), 3 = 환불 승인함(Simulated) (끝)
 * typing: 손님이 입력 중 (shown 1에서만 참 — 시안 `typing: out !== 'refund'`, 다음 단계에서 false).
 */
export type ProgressState = { shown: 1 | 2 | 3 | 4; typing: boolean };

export const PROGRESS_START: ProgressState = { shown: 1, typing: true };

/** 분기마다 마지막 단계 번호. */
export const PROGRESS_STEPS: Record<ScenarioOutcome, ProgressState['shown']> = { ok: 4, refund: 4, cb: 3 };

/** 분기의 첫 상태 (시안 `typing: out !== 'refund'`). */
export function progressStart(outcome: ScenarioOutcome = 'ok'): ProgressState {
  return outcome === 'refund' ? { shown: 1, typing: false } : PROGRESS_START;
}

/** 타이머: 첫 자동 단계 (시안 k = 2 — ok·cb는 손님 답장, refund는 환불 승인 대기). */
export function buyerReplied(state: ProgressState): ProgressState {
  return state.shown === 1 ? { shown: 2, typing: false } : state;
}

/** 판매자 승인 ([Forward to carrier] · [Approve refund], 둘 다 Simulated). 대기 줄(shown 2)에서만 된다. */
export function forwardToCarrier(state: ProgressState): ProgressState {
  return state.shown === 2 ? { shown: 3, typing: false } : state;
}

/** 승인 단계 (분기와 상관없이 같다: 대기 줄 → 다음). */
export const approveStep = forwardToCarrier;

/** 타이머: 승인 뒤 한 간격 (ok = 세관 통과, refund = 손님 환불 확인). cb는 승인이 마지막이라 쓰지 않는다. */
export function customsCleared(state: ProgressState): ProgressState {
  return state.shown === 3 ? { shown: 4, typing: false } : state;
}

/** 승인 뒤 자동 단계가 더 있나 (ok·refund 예, cb 아니오). */
export const stepAfterApproval = (outcome: ScenarioOutcome = 'ok'): boolean => PROGRESS_STEPS[outcome] > 3;

export const awaitingForward = (state: ProgressState): boolean => state.shown === 2;
export const progressFinished = (state: ProgressState, outcome: ScenarioOutcome = 'ok'): boolean =>
  state.shown >= PROGRESS_STEPS[outcome];
/** 시안 `stepsRunning`: 끝나지 않았고 판매자를 기다리지도 않을 때 점 세 개. */
export const progressRunning = (state: ProgressState, outcome: ScenarioOutcome = 'ok'): boolean =>
  !progressFinished(state, outcome) && !awaitingForward(state);

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

/**
 * 줄의 이름. 엔진 `ScenarioStepKind`(계약) 4개 + T104 refund·cb 분기의 줄 3개. 계약에 없는 줄은
 * 엔진 단계 값이 없으므로 **위험 칩을 그리지 않는다** (지어내지 않는다).
 */
export type ProgressStepId = ScenarioStepKind | 'refund' | 'buyer_refund' | 'buyer_angry';

export type StepRow = {
  step: ProgressStepId;
  title: string;
  sub: string;
  /** 손님 답장 단계의 따옴표 글 (가린 꼴). */
  quote: string | null;
  simulated: boolean;
  /** "Risk 4%" (엔진 값). 시안처럼 ok 분기 보낸 답장 줄에는 없다. 엔진 값이 없으면 `null`. */
  risk: string | null;
  riskHigh: boolean;
  icon: StepIcon;
  /** 손님 이름 첫 글자 (시안 'S'). 이름을 모르면 `null` → 기호. */
  initial: string | null;
  /** 판매자 승인 대기 줄 ([Forward to carrier] · [Approve refund]). */
  pending: boolean;
  /** 대기 줄 버튼의 문구 키. 대기 줄이 아니면 `null`. */
  actionKey: string | null;
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
  /** T104: 보낸 답장의 예측으로 고른 분기 (`scenarioOutcome`). 없으면 ok. */
  outcome?: ScenarioOutcome;
};

const KIND: Record<ProgressStepId, CaseEventKind> = {
  sent: 'seller_reply',
  buyer_reply: 'buyer_message',
  forwarded: 'carrier_event',
  cleared: 'carrier_event',
  refund: 'seller_reply',
  buyer_refund: 'buyer_message',
  buyer_angry: 'buyer_message',
};

function pointOf(points: readonly ScenarioPoint[] | null, step: ScenarioStepKind): ScenarioPoint | null {
  return points?.find((point) => point.step === step) ?? null;
}

function riskOf(points: readonly ScenarioPoint[] | null, step: ScenarioStepKind): { risk: string | null; riskHigh: boolean } {
  const point = pointOf(points, step);
  if (point === null) return { risk: null, riskHigh: false };
  return { risk: t('case.progress.risk', { percent: toPercentRounded(point.pChargeback) }), riskHigh: point.pChargeback >= HIGH_CHIP };
}

const NO_RISK = { risk: null, riskHigh: false } as const;

function simulatedEvent(step: ProgressStepId, at: string, text: string): CaseEvent {
  return { at, kind: KIND[step], source: 'simulated', text };
}

/** 손님 답장 문구 (고정 문구는 copy, 가린 꼴). ok 분기 = 통관번호를 보냄. */
export function buyerReplyText(): { original: string; english: string } {
  return { original: maskCustomsIds(t('case.progress.buyer.original')), english: maskCustomsIds(t('case.progress.buyer.english')) };
}

/** 손님 말풍선의 AI read 칩 한 개 (`bad` = 빨강 칩). */
export type BubbleTag = { key: string; bad: boolean };

/** 대화 목록 끝에 붙는 손님 말풍선 (Simulated). 분기마다 글·칩이 다르고, 없는 단계면 `null`. 모든 글은 통관번호를 가린다. */
export type BuyerBubble = { original: string; english: string; tags: BubbleTag[] };

const BUBBLE_KEYS: Record<ScenarioOutcome, { prefix: string; tags: BubbleTag[]; from: ProgressState['shown'] }> = {
  ok: {
    prefix: 'case.progress.buyer',
    tags: [
      { key: 'case.progress.buyer.tagSent', bad: false },
      { key: 'case.progress.buyer.tagCalm', bad: false },
    ],
    from: 2,
  },
  refund: {
    prefix: 'case.progress.refundBuyer',
    tags: [
      { key: 'case.progress.refundBuyer.tagConfirmed', bad: false },
      { key: 'case.progress.buyer.tagCalm', bad: false },
    ],
    from: 4,
  },
  cb: {
    prefix: 'case.progress.angryBuyer',
    tags: [
      { key: 'case.progress.angryBuyer.tagThreat', bad: true },
      { key: 'case.progress.angryBuyer.tagAngry', bad: false },
    ],
    from: 2,
  },
};

/** 시안 thread의 `bstep` 말풍선 (ok: 통관번호 보냄·Calm, refund: 환불 확인·Calm, cb: 차지백 예고·Angry). */
export function buyerBubble(state: ProgressState, outcome: ScenarioOutcome = 'ok'): BuyerBubble | null {
  const spec = BUBBLE_KEYS[outcome];
  if (state.shown < spec.from) return null;
  return {
    original: maskCustomsIds(t(`${spec.prefix}.original`)),
    english: maskCustomsIds(t(`${spec.prefix}.english`)),
    tags: spec.tags,
  };
}

type RowDraft = Omit<StepRow, 'last'>;

/** 지금 보이는 단계 줄 (시안 `stepRows`). */
export function stepRows(input: StepRowsInput): StepRow[] {
  const { state, points, live, disputeId, language, buyerName, at } = input;
  const outcome = input.outcome ?? 'ok';
  const initial = buyerName === null || buyerName.length === 0 ? null : buyerName.slice(0, 1).toUpperCase();
  const english = (key: string, params?: Record<string, string>) => t(key, params, 'en');
  const nameParams = buyerName === null ? undefined : { name: buyerName };
  const rows: RowDraft[] = [
    {
      step: 'sent',
      title: t('case.progress.sent.title', { language }),
      sub: live ? t('case.progress.sent.subLive', { disputeId }) : t('case.progress.sent.subSimulated'),
      quote: null,
      simulated: !live,
      // T104: refund·cb 분기의 첫 줄 = 보낸 답장의 엔진 위험 (계약 단계 'sent'). ok 분기는 시안처럼 칩 없음
      ...(outcome === 'ok' ? NO_RISK : riskOf(points, 'sent')),
      icon: 'sent',
      initial: null,
      pending: false,
      actionKey: null,
      event: simulatedEventOrReal('sent', live, at, english('case.progress.sent.title', { language })),
    },
  ];
  const buyerRow = (step: ProgressStepId, titleKey: string, unknownKey: string, quote: string, risk: typeof NO_RISK | ReturnType<typeof riskOf>): RowDraft => {
    const key = buyerName === null ? unknownKey : titleKey;
    return {
      step,
      title: t(key, nameParams),
      sub: '',
      quote,
      simulated: true,
      ...risk,
      icon: 'buyer',
      initial,
      pending: false,
      actionKey: null,
      event: simulatedEvent(step, at, english(key, nameParams)),
    };
  };
  const pendingRow = (step: ProgressStepId, prefix: string, actionKey: string): RowDraft => ({
    step,
    title: t(`${prefix}.title`),
    sub: t(`${prefix}.sub`),
    quote: null,
    simulated: true,
    ...NO_RISK,
    icon: 'pending',
    initial: null,
    pending: true,
    actionKey,
    event: null,
  });
  const doneRow = (step: ProgressStepId, prefix: string, risk: typeof NO_RISK | ReturnType<typeof riskOf>): RowDraft => ({
    step,
    title: t(`${prefix}.title`),
    sub: t(`${prefix}.sub`),
    quote: null,
    simulated: true,
    ...risk,
    icon: 'done',
    initial: null,
    pending: false,
    actionKey: null,
    event: simulatedEvent(step, at, english(`${prefix}.title`)),
  });

  if (outcome === 'ok') {
    if (state.shown >= 2) {
      rows.push(
        buyerRow('buyer_reply', 'case.progress.buyer.title', 'case.progress.buyer.titleUnknown', buyerReplyText().original, riskOf(points, 'buyer_reply')),
      );
    }
    if (state.shown === 2) rows.push(pendingRow('forwarded', 'case.progress.forward', 'case.progress.forward.button'));
    if (state.shown >= 3) rows.push(doneRow('forwarded', 'case.progress.forwarded', riskOf(points, 'forwarded')));
    if (state.shown >= 4) rows.push(doneRow('cleared', 'case.progress.cleared', riskOf(points, 'cleared')));
  } else if (outcome === 'refund') {
    // 시안 steps.refund: 환불 안내 → 환불 처리(Auto) → 손님 환불 확인. 환불 처리는 판매자 승인 + Simulated (쓰기 0)
    if (state.shown === 2) rows.push(pendingRow('refund', 'case.progress.refundAsk', 'case.progress.refundApprove'));
    if (state.shown >= 3) rows.push(doneRow('refund', 'case.progress.refunded', NO_RISK));
    if (state.shown >= 4) {
      const bubble = buyerBubble(state, 'refund');
      rows.push(
        buyerRow('buyer_refund', 'case.progress.refundBuyer.title', 'case.progress.refundBuyer.titleUnknown', bubble?.original ?? '', NO_RISK),
      );
    }
  } else {
    // 시안 steps.cb: 화난 답장(차지백 언급) → 승인 대기 (시안 [Refund $72 now]) → 환불 승인함. 모두 Simulated
    if (state.shown >= 2) {
      const bubble = buyerBubble(state, 'cb');
      rows.push(
        buyerRow('buyer_angry', 'case.progress.angryBuyer.title', 'case.progress.angryBuyer.titleUnknown', bubble?.original ?? '', NO_RISK),
      );
    }
    if (state.shown === 2) rows.push(pendingRow('refund', 'case.progress.cbAsk', 'case.progress.refundApprove'));
    if (state.shown >= 3) rows.push(doneRow('refund', 'case.progress.refunded', NO_RISK));
  }
  return rows.map((row, index) => ({ ...row, last: index === rows.length - 1 }));
}

/**
 * 보낸 답장 줄의 사건. 녹화 모드(실제 샌드박스 전송)면 실제 기록은 서버가 남기므로 여기서는 만들지 않는다 (`null`).
 * 공개 모드(가짜 전송)면 시뮬레이션 사건.
 */
function simulatedEventOrReal(step: ProgressStepId, live: boolean, at: string, text: string): CaseEvent | null {
  return live ? null : simulatedEvent(step, at, text);
}

/** 지금 보이는 엔진 단계 (shown 순서). refund·cb 분기는 계약 단계가 보낸 답장뿐이다. */
function visibleSteps(state: ProgressState, outcome: ScenarioOutcome): ScenarioStepKind[] {
  const visible: ScenarioStepKind[] = ['sent'];
  if (outcome !== 'ok') return visible;
  if (state.shown >= 2) visible.push('buyer_reply');
  if (state.shown >= 3) visible.push('forwarded');
  if (state.shown >= 4) visible.push('cleared');
  return visible;
}

/** 지금 단계까지의 위험 (곡선 끝점·큰 %). 시안 `curP`: 보인 단계 중 마지막 값. 엔진 값이 없으면 `null`. */
export function currentRisk(
  state: ProgressState,
  points: readonly ScenarioPoint[] | null,
  outcome: ScenarioOutcome = 'ok',
): number | null {
  const trail = riskTrail(state, points, outcome);
  return trail.length === 0 ? null : trail[trail.length - 1];
}

/**
 * T098b: 곡선에 그릴 Send 뒤 점 (시안 liveP — 보낸 답장 + 보인 단계마다 값이 있으면 하나씩). 엔진 `scenarioRisk`
 * 값을 순서대로 옮기기만 한다. 엔진 값이 없으면 빈 배열 (곡선은 보내기 전 모양 그대로).
 * T104: refund·cb 분기는 엔진 단계 값이 보낸 답장뿐이라 점 하나 (계약에 없는 단계의 값을 지어내지 않는다).
 */
export function riskTrail(state: ProgressState, points: readonly ScenarioPoint[] | null, outcome: ScenarioOutcome = 'ok'): number[] {
  if (points === null) return [];
  const out: number[] = [];
  for (const step of visibleSteps(state, outcome)) {
    const point = pointOf(points, step);
    if (point !== null) out.push(point.pChargeback);
  }
  return out;
}
