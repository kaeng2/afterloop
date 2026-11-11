# T086 구현 보고 — 새 상품 고칠 문구 6개 (AI)

- SPEC v2.12 확인, 브랜치 `lane/ai`.
- 새 파일: `src/ai/listing-fixes.ts`, `src/ai/prompts/listing-fixes.ts`, `tests/unit/listing-fixes.test.ts` (10개). 다른 파일은 안 고침 (T020 검사 함수는 import만).

## 동작
- `draftListingFixes(input, { llm })`: AI 1회 호출(재호출 없음), zod로 6칸 검증, 예외·로그 없음.
- 칸별 판정(코드): 비어 있음 → 글자 수(≤300) → 줄 수(≤3, 비어 있지 않은 줄) → 숫자(\p{Nd}) → 토큰 → 개인정보(maskPersonal) → 약속(`checkTokens` newPromises + 추가 영어 패턴: will arrive/arrives by, free returns·shipping·exchange·refund, guarantee, promise, 100%, definitely, money-back, full refund) → `findCommitments` → `config/listing-model.json` `rules[칸]` 정규식. 실패 칸은 `{ ok:false, reason }` (코드: empty·too_long·too_many_lines·digits·tokens·personal_data·promise·commitment·rule_mismatch).
- 호출 실패·거절·스키마 깨짐 → 6칸 모두 ok:false (`ai_unavailable`·`refused`·`invalid_output`). 기본 문구 없음.
- 프롬프트: 상품명·설명만(각 120·1200자 상한), `sanitizeUntrusted`로 개인정보 가림·태그 무력화. 시스템 프롬프트 고정, 숫자 자리는 `[__]`.

## 길이 상한 (컨트롤 타워 확인용)
칸 하나 300자 이하, 3줄 이하.

## 검증
- `npx tsc --noEmit` 0, `npm run lint` 0, `npm run test:acceptance` 169 통과(17 skip, 기존), `npm run build` 성공.
- `npm test`: 2216 통과 / 1 실패 = `tests/unit/storefront.test.ts` "같은 입력 100회" 5초 시간 초과. 전체를 병렬로 돌릴 때만 나고(단독 실행은 31개 모두 통과, 약 3.7초) 이번 변경과 무관한 기존의 느린 시험이다. 컨트롤 타워에서 한 번 더 확인 바람.

## 컨트롤 타워에 요청할 결정
- 없음. 실제 AI로 캐시를 만들 때 6칸 중 `rule_mismatch`가 나오는 칸이 있으면 프롬프트 문구 조정이 필요할 수 있다.

## 후속 — color 칸 rule_mismatch 수정
- 원인: 실제 AI가 "may look slightly different depending on the screen and the lighting"처럼 써서 color 정규식(daylight|indoor|natural light|color note|…)에 안 걸림.
- 수정: `src/ai/prompts/listing-fixes.ts`의 color 지시만 바꿨다. 칸이 반드시 "Color note:"로 시작하고, 예시 문장 "Color note: Ivory may look slightly different depending on your screen and indoor or natural light."을 넣었다. 정규식·config·판정 코드·다른 칸 지시는 그대로.
- 단위 테스트 2개 추가: 프롬프트 color 지시에 `Color note:` 있음 / 예시 문장이 config color 정규식 통과.
- 실제 AI·PayPal 호출, 개발 서버 없음.
