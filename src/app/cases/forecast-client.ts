/**
 * 예측 자리 — **브라우저용 어댑터** (T076 → T079, SPEC v2.11 8-2장, 계약 9부). 답장 칸이 글을 바꿀 때마다 부른다.
 *
 * 엔진 순수 함수를 그대로 부른다 (Products 토글처럼 브라우저에서 엔진을 부르는 방식. 엔진은 `config/`를 JSON으로
 * 읽어 브라우저 묶음에서도 돈다). 엔진이 예외를 던지면 `null` → 그 칸만 숨는다.
 * - `forecastReplyClient` → `forecastReply(input)` (`@/engine/forecast`)
 * - `detectReplyFeaturesClient` → `detectReplyFeatures(text)` (`@/engine/reply-features`)
 *
 * `translated`(계약 밖 선택 값): 보낼 때 구매자 언어로 번역되면 참. 서버의 곡선·선택지 예측과 같은 값을 넘긴다
 * (`case-detail.tsx`가 정한다) — 그래야 보정이 같다.
 *
 * 이 파일은 서버 전용 코드를 import하지 않는다 (엔진 순수 함수와 설정 JSON만). 숫자를 만들지 않는다.
 */
import { forecastReply } from '@/engine/forecast';
import { detectReplyFeatures } from '@/engine/reply-features';
import type { ReplyFeatureHits, ReplyFeatures, ReplyForecast, ReplyForecastInput } from '@/types';

export type ReplyForecastClientInput = ReplyForecastInput & { translated?: boolean };
export type ReplyForecaster = (input: ReplyForecastClientInput) => ReplyForecast | null;
export type ReplyFeatureDetector = (
  text: string,
  opts?: { translated?: boolean },
) => { features: ReplyFeatures; hits: ReplyFeatureHits } | null;

/** 답장 하나의 예측. 쓸 수 없으면 `null`. */
export const forecastReplyClient: ReplyForecaster = (input) => {
  try {
    return forecastReply(input);
  } catch {
    return null;
  }
};

/** 답장 글의 특징 판정 (코드 규칙). 쓸 수 없으면 `null`. */
export const detectReplyFeaturesClient: ReplyFeatureDetector = (text, opts) => {
  try {
    return detectReplyFeatures(text, opts);
  } catch {
    return null;
  }
};
