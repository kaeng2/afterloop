# T095 구현 보고

- 기준 SPEC: v2.15 (일치). 레인 `ops`, 브랜치 `lane/ops`.

## 한 일
- `scripts/ai-cache/build-lib.ts`: `buildAiCache`가 분쟁 사례 뒤에 `/listing` 고칠 문구를 en·ko 폼 기본값(`initialForm(locale)`의 상품명·설명)으로 한 번씩 부른다. 화면 서버 액션과 같은 `listingFixesFor` + `getLlm()`을 그대로 쓴다 → 같은 캐시 키. 결과에 `listingFixes: { en, ko }`(칸별 ok 수/전체, AI 없으면 null) 추가.
- `scripts/ai-cache/build.ts`: 요약에 `listing fixes en/ko: 칸별 ok n/6` 줄 출력 (글·키 없음).
- `tests/unit/ops-t095-listing-cache.test.ts`: 가짜 LLM이 받은 user 문자열이 `draftListingFixesAction` 경로의 것과 같음 (en·ko). 두 언어 문자열이 서로 다름도 확인.

## 확인
- 새 시험 + 기존 `ops-t070-cache` 19개 통과. `npm run lint`, `npm run test:acceptance`(177 통과·9 skip), `npm run build` 통과. `npx tsc --noEmit`은 build 후 0 오류 (처음엔 낡은 `.next/types`로 오류가 났고 build가 다시 만들어 해소).
- `npm test`: **1건 실패** — `tests/unit/storefront.test.ts` "결정론 > 같은 입력 100회" 가 5000ms 제한 초과(6~7.5초, 재실행해도 동일). 내가 고친 파일과 무관한 느린 기계 탓 시간 초과로 보이나 원인은 확정하지 않았다. 나머지 2339개 통과.
- 실제 AI·PayPal 호출, 개발 서버, `.env` 읽기 없음.

## 컨트롤 타워에 요청할 결정
- `storefront.test.ts` 결정론 시험의 시간 제한(5초) 조정 또는 이 기계에서의 예외 처리 여부 (수정 가능 폴더 밖이라 손대지 않음).
