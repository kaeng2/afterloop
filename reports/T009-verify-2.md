판정: 통과

# T009 1부 재시도(789019d) 재검증

## 범위
789019d는 reports/T009-impl.md, compare-card.css, conversation.tsx, globals.css, tests/unit/app-case-view.test.ts 5개만 바꿨다. 허용 밖의 파일 변경은 없다.

## 1. 고친 것 확인
1. 비교 카드 격자: 넓은 폭에서 `.cc-before` 1열, `.cc-arrow` 2열(2줄), `.cc-after` 3열이 명시됐다. DOM 순서는 왼쪽 → 화살표 → 오른쪽이다. 세 요소는 모두 격자의 직접 자식이다(footer는 격자 밖). 자동 배치로 흘러갈 요소는 없다.
   - `.cc-side`는 `grid-row: span 3`이고 열이 명시돼, 자동 배치가 화살표를 1열에 놓던 원인이 사라졌다.
   - `.cc-single`(오른쪽 없음)은 1열뿐이라 `.cc-before{grid-column:1}`로 충분하다.
   - 30rem 아래에서는 열이 1개이고 세 요소가 모두 `grid-column:1`, 행은 `auto`다. 그래서 DOM 순서대로 왼쪽 → 화살표(90도 회전) → 오른쪽으로 쌓인다. 엉뚱한 칸에 들어갈 여지는 없다.
2. Demo data 배지: `englishOnly`가 `englishBadges` 중 `badges`에 이미 있는 종류만 빼고, 원문 배지(`badges`)는 그대로 그린다.
   - 시연용 문의: `badges=['demo']`, `englishBadges=['demo']`라 배지가 하나만 그려진다.
   - 실제 분쟁 글 + AI 번역: `badges=[]`, `englishBadges=['aiSuggests']`라 "AI suggests"가 유지된다.
   - 실제 글 + 시드 번역: `['demo']`가 유지된다.
   - 다른 줄의 배지를 지우지 않는다. 비교는 종류(kind) 단위다.
3. globals.css: 변경은 `.compare`, `.compare-side`, `.compare-value`, `.compare-arrow`, `.compare-hero`와 그 `@media` 블록 삭제, 그리고 주석 한 줄 추가뿐이다. 다른 규칙은 건드리지 않았다. 남은 `.compare*` 사용처도 없다.

## 2. 실행 결과
- `npm test`: 33 파일, 1610 테스트 통과, 종료 코드 0
- `npx tsc --noEmit`: 종료 코드 0
- `npm run lint`: 종료 코드 0
- `npm run test:acceptance`: 12 파일, 155 통과 / 9 skipped, 종료 코드 0
- `npm run build`: 종료 코드 0
- git 상태: 미추적 `reports/T009-verify.md`만 있다(검증 전부터 있던 파일).

## 3. 새 테스트 3건이 버그를 잡는지(코드 읽기로 판단, 되돌려 실행하지는 않음)
- 세 열 지정: 1c12479의 css에는 `.cc-before`·`.cc-after` 규칙이 없고 `.cc-arrow`에 `grid-column`도 없다. 넓은 폭 정규식 3개가 모두 불일치해 실패한다. 좁은 폭 정규식도 실패한다.
- `.compare*` 없음: 1c12479의 globals.css에는 `.compare {`가 있어 `not.toMatch`가 실패한다.
- 배지 하나: 고치기 전에는 Conversation 기본 상태(영어 켜짐)에서 시연용 줄에 'Demo data'가 2번 나온다. 기대값 1과 달라 실패한다.
- 한계: 이 테스트는 정규식으로 CSS 문자열을 확인한다. 실제 배치(렌더링)를 검증하지는 않는다. 화면은 스크린샷으로 확인한 사안이다.

## 발견한 문제
- 병합 차단: 없음
- 병합 후 수정: 없음
- 기록만: 배지 하나 테스트는 시연용 문의 경우만 다룬다. 실제 글의 "AI suggests" 배지가 유지되는지는 이 테스트로는 확인되지 않는다(코드로는 유지됨을 확인). 필요하면 회귀 테스트를 한 건 더하면 된다.
