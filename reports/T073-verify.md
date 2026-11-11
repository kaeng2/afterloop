판정: 통과

대상: T073 커밋 31227dc (diff 71ac149..31227dc). 코드 수정 없음.

1. 범위: 통과
- 바뀐 파일 7개: products/grid.ts, products/products.css, _shared/shell.css, _shared/top-bar.tsx, layout.tsx, tests/unit/app-product-t073.test.ts(신규), reports/T073-impl.md. 모두 허용 범위.
- _server·엔진·AI·PayPal·설정 json·시드·인수 테스트 0줄.
- 모드 판정: layout.tsx는 여전히 서버의 resolveDemoMode() 결과(mode)만 읽어 mode==='public'일 때 문구를 TopBar modeNote로 넘길 뿐. 판정 로직 변경 없음.

2. 디자인 규칙 테스트: 느슨해지지 않음 (app-shared-design.test.ts 변경 0줄)
- 검사는 globals.css 한 파일만 읽고(CSS = globals.css), `width|min-width: 숫자 px|rem` 형태만 360px 이하인지 본다. products.css는 애초에 대상이 아니고, `grid-template-columns` 안의 clamp(20rem, 26vw, 28rem)는 정규식(width:)에 걸리지 않는다. 이전의 minmax(0, 20rem)도 같은 이유로 검사 밖이었다.
- 즉 clamp가 규칙을 "우회"한다기보다, 이 검사는 clamp·fr·grid 열 폭을 보지 않는다(rem은 16배 환산, clamp는 해석하지 않음). 28rem=448px는 1920px에서 최대값이며 360px 규칙 문구와는 형식상 어긋나지만, 지시서가 min()·clamp() 사용을 허용했고 검사 자체는 수정되지 않았다. 참고: 검사 범위가 좁은 것은 기존 한계이며 이 커밋이 만든 것이 아님.

3. 실행 (모두 성공)
- npm test: 48 파일, 2062 통과, 실패 0
- npx tsc --noEmit: 종료 0
- npm run lint: 종료 0
- npm run test:acceptance: 158 통과, 9 skip, 실패 0
- npm run build: 성공
- git status 깨끗.

4. 완료 기준: 충족
- AG Grid 열 정의: product minWidth 96(flex 4, wrapText 유지), Left 64(flex 2), values 128(flex 5). 말줄임 설정 없음(ellipsis 문자열 없음, css text-overflow 없음). 새 테스트 4개가 이를 확인.
- 깜빡임·토글·처음 상태(모두 꺼짐) 관련 코드 diff 없음.

참고(실패 아님): 실제 화면 확인은 못 했으므로 1920/1440에서 값 잘림 여부와 상단 막대 좁은 폭 줄바꿈은 스크린샷 확인이 필요하다. 128px 최소 폭 + shell-mode-note nowrap 조합은 구현 보고서도 같은 점을 남겼다.
