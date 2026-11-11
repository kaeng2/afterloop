# T101 구현 보고 — "as soon as"는 vague가 아니다

- 기준 SPEC v2.15 일치. 브랜치 lane/engine.
- 변경: `src/engine/reply-features.ts` vague 정규식 `\bsoon\b` → `(?<!\bas )\bsoon\b` ("as soon as"만 제외, 홀로 쓴 soon은 유지). 한국어 규칙은 그대로(받는 대로/받으시면 바로는 원래 안 잡힘, 시험으로 고정).
- 시험 추가 `tests/unit/reply-features.test.ts` (T101): as soon as → false(대소문자 포함), 한국어 → false, "It should arrive soon."/"Soon."/rushed 글 → true, 서연 캐시 초안 영어 → false.
- 결과: `npx tsc --noEmit`, `npm run lint`, `npm run test:acceptance`(177 통과, AC33 포함), `npm run build` 실패 0. `npm test`: 2473/2474 — `storefront.test.ts` "100회 결정론"이 전체 실행에서 5초 타임아웃 1회(부하로 인한 것, 단독 실행 31/31 통과; 이번 변경과 무관).
- 컨트롤 타워에 요청할 결정: 없음.
