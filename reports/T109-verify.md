# T109 검증 (독립) — 683d639

판정: **통과** (결함 0, 경미한 참고 3건)

1. 시안 L16–L61 vs listing.css: 스크립트로 줄 단위 기계 비교 — 46줄 전부 `.ls ` 접두(및 `body:has(.ls)`, keyframes 그대로)만 다르고 값 변경 0. 통과.
2. 인라인·`{{…St}}` 값 대조 20곳 이상(header L66–69, nav L72–74, 폼 L96·101·107·108·111·116, 결과판 L126–137·142–152·156·160·162–167, 시트 L176–195·199–249, 완료 L258–268, JS 484–565): 모두 같은 값. 통과.
3. 루트 `.ls` = L64 값(15px, 1.5, #000, #F6F7F9; 글꼴은 next/font 변수로 예외 E1), 글꼴 굵기·자간·overflow-wrap·smoothing을 다시 정해 globals body 상속 차단. CSS import는 listing-screen.tsx:19 하나뿐. 선택자는 `.ls`/`ls-*`/`body:has(.ls)`/keyframes뿐. keyframes `rise`는 intro scene1.css와 이름이 같지만 본문 동일(영향 없음). 통과.
4. 동작: listing-view.tsx 변경은 class 이름·보조 span 추가뿐, data-*·onClick·disabled·aria 그대로. reducer·서버 액션·progress·send/mode/activity·config 무변경(diff에 없음). DisputeLess는 onClick 없음. Assumption/Demo data 배지 유지(E4). 통과.
5. 테스트 수정: t098a·t087·t067은 변수 이름 기대를 같은 시안 값 기대로 바꾼 것으로 오히려 더 구체적, 동작 시험 무변경. 통과.
   - 병합(683d639) app-shared-design: T108 `isMockupCopy`(intro 폴더 전체 건너뜀)와 T109 `mockupCopyOf`(@mockup-copy 첫 줄 CSS는 시안 파일 안의 값만 허용)가 공존. listing tsx는 여전히 색/boxShadow 규칙 적용. 빠진 것은 "T098a 시안 그림자" 시험의 cases가 `[]`가 되어 내용 없는 시험이 된 것(참고 a). intro의 .tsx 색 값은 이제 어느 시험도 시안과 대조하지 않음(참고 b, T108 범위).
6. 실행: tsc 0 에러 / lint 에러 0(경고 2: tests/unit/app-t098a-scenes.test.ts:27 `rule`, :31 `v` 미사용 — T109가 남김, 참고 c) / acceptance 177 통과·9 skip / 지정 5개 vitest 72 통과 / npm test 2557 통과 1 실패(storefront "결정론 100회" 시간 초과, 단독 31/31 통과) / build 통과.

참고(결함 아님): (a) tests/unit/app-shared-design.test.ts "T098a 시안 그림자" 시험이 빈 cases로 공회전 — 지우거나 이름 정리 권장. (b) intro tsx 색 대조 공백. (c) 미사용 변수 경고 2건.
눈으로 본 확인(픽셀)은 안 했다 — 컨트롤 타워 몫.
