판정: 통과

대상: T078 커밋 44cddbf (6675c49..44cddbf)

1. 범위: 바뀐 파일 7개 = src/app/intro/{page.tsx,intro-screen.tsx,intro.css}, config/intro.en.json, config/intro.ko.json, tests/unit/app-intro.test.ts, reports/T078-impl.md. 그 밖 0줄 (copy.*.json, _shared, _server, 엔진, 설정, 시드, 인수 테스트 모두 무변경).
2. 실행: npm test 2155/2155 통과(53파일), tsc 0, lint 0, acceptance 167 통과·9 skip·실패 0, build 성공, 빌드 표에 `ƒ /intro 3.85 kB` 있음.
3. 완료 기준:
 - intro 코드 import는 next/link, react, config/intro.*.json, css뿐. 서버 액션·fetch·@/engine·@/ai·@/paypal·_server 없음.
 - PayPal 파랑 5종 grep 0건(코드·css·json). 로고 자리 글자 "Seller dashboard". 띠는 EN "Demo mock — not a real PayPal page", KO "데모용 화면 — 실제 PayPal 페이지가 아닙니다"; 문구 파일에서 오고 조건 없이 렌더, display:none은 CSS 520·538행(반응형)뿐이며 띠와 무관.
 - 이동 링크: 아이콘, "Open DisputeLess →"(말풍선), Respond →(2곳), Handle all 2만 TODAY_HREF=/?item=PP-R-GMS-10197661. 나머지(탭5, 알림, 도움말, 송금, 결제 요청, See all)는 Inert(type=button, aria-disabled, 핸들러 없음). onClick은 EN/KO 전환뿐.
 - Lena 0건. 서연 PP-R-GMS-10197661·Nov 30(DECISIONS 135행 2026-11-30T00:37Z 일치). 지호 PP-R-MBJ-10197650(demo-links.json 일치)·Nov 29(DECISIONS 121행 2026-11-29T23:45Z 일치, 한국시간으로는 11/30이라는 구현 보고서 설명 있음).
 - Handle all 2 = 화면의 분쟁 카드 2건 = "2 open"·배지·말풍선 2 (Mike는 시안에 없음). 일관됨.
 - 고정 데모 숫자($4,218.40, $3,940, 71 orders, 막대 14개, 활동 금액)는 시안값을 config/intro.en.json note에 출처 명시 (시안 문구 일부 현재 시각과 안 맞음: "Black Friday in 17 days"는 11/11 기준 16일, 사소).
4. 실제 PayPal 흉내 여부: 시안의 "PayPal" 로고·"PayPal balance"·#002991 제거됨 (문구 파일에 "Balance"/"잔액"). 남은 PayPal식 표현: "Resolution Center"/"분쟁 해결 센터"(실제 PayPal 메뉴명), "Transfer money"·"Request payment" 버튼, 탭 Home/Activity/Reports/Money, "Recent activity", "Respond within 20 days or the case may close in the buyer's favor" 문구. 로고·색·이름은 없고 상단 띠가 있어 중대하진 않으나 구조가 PayPal 판매자 대시보드와 비슷함 (참고 사항). 또한 서연 줄 "mentions chargeback"은 시안 문구 그대로이며 실제 서연 분쟁(INQUIRY, WAITING_FOR_SELLER_RESPONSE)과 맞는지 확인되지 않음 (구현 보고서도 열어둔 질문).
5. 루트 layout: src/app/layout.tsx는 모든 경로에서 `await loadTodayForRequest()`, `loadReplyNames()`, TopBar를 렌더 (force-dynamic). /intro도 예외 없이 Today 데이터를 읽고 위쪽 막대를 그림. intro.css가 .intro를 position:fixed; z-index:1000으로 덮어 막대만 가림. 구현 보고서 설명과 코드가 일치. 화면 자체는 서버 호출이 없으나 요청 시 layout의 Today 읽기(서버측 PayPal 읽기가 있다면 그것)는 막지 못함 → 컨트롤 타워가 (app)/(intro) 라우트 그룹 분리 여부를 결정해야 함. 덮개는 스크린 리더/탭 순서에서 아래 막대·skip-link를 완전히 막지 못함(미확인).

미확인: 시각·390폭 가로 넘침은 브라우저 확인 안 함 (개발 서버 금지).
