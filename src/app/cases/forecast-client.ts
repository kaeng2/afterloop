/**
 * 예측 자리 — **브라우저용 어댑터** (T076, SPEC v2.11 8-2장, 계약 9부). 답장 칸이 글을 바꿀 때마다 부른다.
 *
 * 엔진 예측(T075: `detectReplyFeatures`·`forecastReply`)이 아직 이 브랜치에 없다. **지금은 둘 다 `null`** 을
 * 돌려준다 → 답장 칸은 "As you type" 칩 대신 지금의 "Suggested reply covers" 칩을, 예상 반응 막대·기대 비용·
 * 기분·입력칸 모서리의 차지백 %를 숨긴다.
 *
 * **T079(연결)에서 바꿀 곳은 이 파일의 함수 몸통뿐이다**: 엔진 순수 함수를 그대로 부른다 (Products 토글처럼
 * 브라우저에서 엔진을 부르는 방식. 엔진은 `config/`를 JSON으로 읽어 브라우저 묶음에서도 돈다).
 * - `forecastReplyClient` → `forecastReply(input)` (`@/engine/forecast`)
 * - `detectReplyFeaturesClient` → `detectReplyFeatures(text)` (`@/engine/reply-features`)
 *
 * 이 파일은 서버 전용 코드를 import하지 않는다. 숫자를 만들지 않는다.
 */
import type { ReplyFeatureHits, ReplyFeatures, ReplyForecast, ReplyForecastInput } from '@/types';

export type ReplyForecaster = (input: ReplyForecastInput) => ReplyForecast | null;
export type ReplyFeatureDetector = (text: string) => { features: ReplyFeatures; hits: ReplyFeatureHits } | null;

/** 답장 하나의 예측. 쓸 수 없으면 `null`. */
export const forecastReplyClient: ReplyForecaster = (input) => {
  void input;
  return null;
};

/** 답장 글의 특징 판정 (코드 규칙). 쓸 수 없으면 `null`. */
export const detectReplyFeaturesClient: ReplyFeatureDetector = (text) => {
  void text;
  return null;
};
