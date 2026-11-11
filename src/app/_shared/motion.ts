/**
 * 모션 값 (T090, SPEC v2.15 8-4장). 값은 `config/motion.json`(시안 값 그대로)에서만 읽는다 — css에 시간을 직접 쓰지 않는다.
 *
 * `motionVars()`가 css 변수(`--motion-*`)를 만들고 루트 `<html style>`에 붙인다. css는 `var(--motion-…)`만 쓴다.
 * `prefers-reduced-motion: reduce`이면 `globals.css`가 변수를 모두 `0s`로 덮고 반복 애니메이션을 끈다.
 *
 * 이 파일은 그림 값만 옮긴다 (숫자 계산 없음). 브라우저 묶음에 들어가도 되는 값만 있다.
 */
import { z } from 'zod';

import motionJson from '../../../config/motion.json';

const TIME = /^\d+(\.\d+)?m?s$/;

const timing = z.object({
  duration: z.string().regex(TIME),
  easing: z.string().min(1),
});

/** Desk 몫 키 (T090). Scene 3 키(`scene3`)는 T094가 더한다 — 여기서는 읽지 않고 통과시킨다. */
const MotionSchema = z
  .object({
    desk: z.object({
      hover: timing,
      choiceCard: timing,
      curve: timing,
      ping: timing.extend({
        fromRadius: z.number().positive(),
        toRadius: z.number().positive(),
        fromOpacity: z.number().min(0).max(1),
      }),
      reactionBar: timing,
      editorBorder: timing,
      // T091
      typeOut: z.object({ intervalMs: z.number().int().positive(), step: z.number().int().positive() }),
      chipPop: timing.extend({ staggerS: z.number().min(0) }),
      lintRise: timing,
      fold: timing,
      caret: timing,
      colorFade: timing,
      flash: timing,
      toast: z.object({ durationMs: z.number().int().positive(), riseDuration: z.string().regex(TIME), easing: z.string().min(1) }),
      riskColor: z.object({ highFrom: z.number().min(0).max(1), midFrom: z.number().min(0).max(1) }),
    }),
  })
  .passthrough();

export type MotionConfig = z.infer<typeof MotionSchema>;

let cached: MotionConfig | null = null;

/** 설정을 검사해 읽는다 (틀리면 예외 — 빈 값으로 조용히 넘어가지 않는다). 기본 설정은 한 번만 검사한다. */
export function loadMotion(raw?: unknown): MotionConfig {
  if (raw !== undefined) return MotionSchema.parse(raw);
  cached ??= MotionSchema.parse(motionJson);
  return cached;
}

/** css 변수 이름 → 값. `<html style>`에 그대로 넣는다. */
export function motionVars(config: MotionConfig = loadMotion()): Record<string, string> {
  const d = config.desk;
  return {
    '--motion-hover': `${d.hover.duration} ${d.hover.easing}`,
    '--motion-hover-duration': d.hover.duration,
    '--motion-choice': d.choiceCard.duration,
    '--motion-choice-easing': d.choiceCard.easing,
    '--motion-curve': `${d.curve.duration} ${d.curve.easing}`,
    '--motion-ping-duration': d.ping.duration,
    '--motion-ping-easing': d.ping.easing,
    '--motion-ping-from-r': `${d.ping.fromRadius}px`,
    '--motion-ping-to-r': `${d.ping.toRadius}px`,
    '--motion-ping-from-opacity': String(d.ping.fromOpacity),
    '--motion-bar': `${d.reactionBar.duration} ${d.reactionBar.easing}`,
    '--motion-editor': d.editorBorder.duration,
    '--motion-editor-easing': d.editorBorder.easing,
    // T091
    '--motion-pop': `${d.chipPop.duration} ${d.chipPop.easing}`,
    '--motion-lint-rise': `${d.lintRise.duration} ${d.lintRise.easing}`,
    '--motion-fold': `${d.fold.duration} ${d.fold.easing}`,
    '--motion-caret': `${d.caret.duration} ${d.caret.easing}`,
    '--motion-color': `${d.colorFade.duration} ${d.colorFade.easing}`,
    '--motion-flash': `${d.flash.duration} ${d.flash.easing}`,
    '--motion-toast': `${d.toast.riseDuration} ${d.toast.easing}`,
  };
}

/** 타이핑 효과 값 (시안 `typeOut`: 34ms마다 2글자). */
export function typeOutTiming(config: MotionConfig = loadMotion()): { intervalMs: number; step: number } {
  return config.desk.typeOut;
}

/** ✓ 칩 pop의 n번째 지연 (시안 `animation-delay: n × 0.12s`). 그림 값이다. */
export function chipPopDelay(index: number, config: MotionConfig = loadMotion()): string {
  return `${Math.round(index * config.desk.chipPop.staggerS * 100) / 100}s`;
}

/** 알림(toast)이 떠 있는 시간 (ms). */
export function toastDurationMs(config: MotionConfig = loadMotion()): number {
  return config.desk.toast.durationMs;
}

export type RiskTone = 'high' | 'mid' | 'low';

/**
 * 위험 % 글자색 단계 (시안 `riskCol`). 확률 값(엔진)을 바꾸지 않고 색 단계만 고른다. 기준값은 config.
 * 알약·입력칸 테두리는 `high`인지만 본다 (시안 `p >= 0.5`).
 */
export function riskTone(p: number, config: MotionConfig = loadMotion()): RiskTone {
  const { highFrom, midFrom } = config.desk.riskColor;
  return p >= highFrom ? 'high' : p >= midFrom ? 'mid' : 'low';
}

/** 사용자가 움직임 줄이기를 켰는가 (브라우저에서만. 서버·시험 환경은 거짓). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** 끝점 물결 원의 처음 반지름 (SVG `r` 속성 — 애니메이션이 꺼져도 이 크기로 그린다). */
export function pingStartRadius(config: MotionConfig = loadMotion()): number {
  return config.desk.ping.fromRadius;
}
