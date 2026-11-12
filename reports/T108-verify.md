# T108 검증 (verify-tmp3, 9b6453e)

판정: **통과** (결함 없음, 참고 2건)

1. 시안 `<style>` 복사: L17–L35를 기계 대조(시안에서 `.pp `→`.intro `, 나머지 `:where(.intro)` 접두만 적용 후 diff) → 완전 동일. 바뀐 값 0. `body{margin:0}`만 뺌(globals가 이미 0).
2. 인라인 style: header, 로고, 칩, nav, al-icon 뱃지, 말풍선(+화살표, NEW, 버튼), main, h1, 잔액 카드(44px/-1.2px), 활동 행 아바타, RC 카드(2px #F2B8AF), due 색, 그라디언트 버튼, 막대(14개, 높이 round(x/380*90) = config 값과 일치, 마지막 #0066F5) 등 20곳 이상 시안과 값 일치. 차이는 보고서의 예외 목록 안(h1 color:inherit, 숫자 tabular 제거 등).
3. 루트 기본값 = 시안 루트(100vh, #F1EFEA, #000, Figtree 스택, 15px, 1.5) + overflow-wrap/smoothing 재설정. scene1.css 규칙은 모두 `.intro`/`:where(.intro)` 아래, import는 intro-screen.tsx 한 곳뿐. `@keyframes pulse/rise`는 전역 이름이나 src 안에 같은 이름 없음(충돌 없음).
4. 동작: Respond →, Open DisputeLess →, Handle all, 아이콘 모두 TODAY_HREF 그대로(테스트 확인). 언어 선택 코드 무변경. Demo mock 띠·"Seller dashboard" 유지, PayPal 로고/글자 없음("PayPal balance" 문구는 기존 데이터 자리).
5. 테스트 수정: app-intro·app-t079는 마크업 변경(style 속성 추가, class 정규식)에 맞춘 것으로 타당. app-t098a는 옛 `--i-*` 변수 단언을 시안 규칙 단언 + app-t108 파일 대조로 대체(동치, 동작 시험 아님). 링크 목적지 단언은 유지. app-shared-design의 intro/** 제외는 "시안 그대로 복사" 결정과 모순되지 않아 타당. 참고: 제외가 폴더 전체라 시안에 없는 intro.css 추가 색(#0b0f14 띠, #cfd3d8 언어 선택 등)도 변수 검사 밖이 됨 (결함 아님, 파일 단위 제외로 좁히면 더 엄격).
6. 실행: tsc 0 오류, lint 0, acceptance 177 통과/9 skip, 지정 4파일 48 통과, npm test 2553 통과 1 실패(storefront "결정론 100회", 부하 흔들림) → 단독 재실행 31/31 통과, build 성공.

참고
- tabs/See all이 button이라 시안 `<a>` 파랑을 별도 규칙으로 맞춤(예외 목록에 있음).
- 픽셀 비교는 미수행(범위 밖).
