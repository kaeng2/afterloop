/**
 * 점검 진행 (T087, SPEC v2.12 8-3장 "진행 표시"). 한 프레임(`requestAnimationFrame`)에 `progressChunkRuns`회씩
 * `sim.step()`을 부르고, **`step`이 돌려준 끝낸 횟수**를 그대로 알린다. 타이머로 늘이거나 가짜로 세지 않는다.
 * 다 끝나면 `sim.result()`(= `checkListing` 같은 입력 결과)와 `listingFixGains`를 묶어 돌려준다.
 */
import { createListingSim, listingFixGains, listingModelFromConfig } from '@/engine/listing';
import type { ListingCheckInput } from '@/types';

import type { Calc } from './model';

export type FrameApi = {
  request: (cb: () => void) => number;
  cancel: (handle: number) => void;
};

/** 브라우저 프레임. 시험은 가짜 프레임을 넘긴다. */
export const browserFrames: FrameApi = {
  request: (cb) => window.requestAnimationFrame(() => cb()),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

export type RunCallbacks = {
  onProgress: (done: number, total: number) => void;
  onDone: (calc: Calc) => void;
};

/** 계산을 프레임마다 나눠 돌린다. 돌려준 함수를 부르면 멈춘다 (다음 프레임 취소). */
export function runListingCheck(
  input: ListingCheckInput,
  callbacks: RunCallbacks,
  frames: FrameApi = browserFrames,
  chunk: number = listingModelFromConfig().progressChunkRuns,
): () => void {
  let stopped = false;
  let handle: number | null = null;
  // 입력칸 판정·판매 기간·유형별 확률은 여기서 끝난다 (분석 단계 1~3)
  const sim = createListingSim(input);

  const frame = () => {
    handle = null;
    if (stopped) return;
    const done = sim.step(chunk);
    callbacks.onProgress(done, sim.total);
    if (sim.done()) {
      callbacks.onDone({ input, result: sim.result(), gains: listingFixGains(input) });
      return;
    }
    handle = frames.request(frame);
  };
  handle = frames.request(frame);

  return () => {
    stopped = true;
    if (handle !== null) frames.cancel(handle);
  };
}
