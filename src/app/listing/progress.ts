/**
 * 점검 진행 (T087 → T094, SPEC v2.15 8-3장 "진행 표시"). 계산은 `createListingSim`이 실제로 한다:
 * 타이머가 한 번 울릴 때마다 `config/motion.json`의 `scene3` 값만큼 `sim.step()`을 부르고,
 * **`step`이 돌려준 끝낸 횟수**를 그대로 알린다 (시안: 70ms마다 +5, Recalculate는 +25). 숫자를 따로 세지 않는다.
 * 다 끝나면 `sim.result()`(= `checkListing` 같은 입력 결과)와 `listingFixGains`를 묶어 돌려준다.
 * 움직임 줄이기(`prefers-reduced-motion`)이면 기다리지 않고 바로 끝까지 계산해 결과를 준다.
 */
import motion from '../../../config/motion.json';
import { createListingSim, listingFixGains } from '@/engine/listing';
import type { ListingCheckInput } from '@/types';

import type { Calc, RunPurpose } from './model';

export type TimerApi = {
  every: (cb: () => void, ms: number) => number;
  clear: (handle: number) => void;
};

/** 브라우저 타이머. 시험은 가짜 타이머를 넘긴다. */
export const browserTimer: TimerApi = {
  every: (cb, ms) => window.setInterval(cb, ms),
  clear: (handle) => window.clearInterval(handle),
};

export type Pace = { intervalMs: number; step: number };

/** `config/motion.json`의 scene3 속도 */
export function paceFor(purpose: RunPurpose): Pace {
  const p = purpose === 'recalc' ? motion.scene3.recalc : motion.scene3.check;
  return { intervalMs: p.intervalMs, step: p.step };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type RunCallbacks = {
  onProgress: (done: number, total: number) => void;
  onDone: (calc: Calc) => void;
};

/** 계산을 타이머마다 나눠 돌린다. 돌려준 함수를 부르면 멈춘다 (타이머 해제). */
export function runListingCheck(
  input: ListingCheckInput,
  callbacks: RunCallbacks,
  timer: TimerApi = browserTimer,
  pace: Pace = paceFor('check'),
  reduced: boolean = prefersReducedMotion(),
): () => void {
  let stopped = false;
  let handle: number | null = null;
  // 입력칸 판정·판매 기간·유형별 확률은 여기서 끝난다 (분석 단계 1~3)
  const sim = createListingSim(input);
  const finish = () => callbacks.onDone({ input, result: sim.result(), gains: listingFixGains(input) });

  if (reduced) {
    // 움직임 줄이기: 기다리지 않고 바로 결과
    while (!sim.done()) sim.step(sim.total);
    callbacks.onProgress(sim.total, sim.total);
    finish();
    return () => {
      stopped = true;
    };
  }

  const tick = () => {
    if (stopped) return;
    const done = sim.step(pace.step);
    callbacks.onProgress(done, sim.total);
    if (sim.done()) {
      if (handle !== null) timer.clear(handle);
      handle = null;
      finish();
    }
  };
  handle = timer.every(tick, pace.intervalMs);

  return () => {
    stopped = true;
    if (handle !== null) timer.clear(handle);
    handle = null;
  };
}
