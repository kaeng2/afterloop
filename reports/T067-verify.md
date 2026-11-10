판정: 통과

# T067 검증 (aed9187, 사본 verify-tmp2)

1. 범위: 바뀐 파일은 src/app/**, config/copy.{en,ko}.json, tests/unit/, reports/T067-impl.md뿐. src/paypal·engine·ai·exec·types.ts·rules/params·seed·tests/acceptance·package.json 0줄. send.ts diff 0줄. 사본에 .env 없음(.env.example만).
2. 디자인 테스트 diff: B-2(글꼴: next/font/google은 layout.tsx만 허용 + Figtree/Noto 검사 추가, @import url·fonts.googleapis·PayPal 글꼴 금지는 그대로), B-3(카드 2px #e4e6e9, 16~24px, 알약 999px, 그림자는 var(--shadow-selected)만)뿐. 360px 고정 폭, 색 변수, 글자 크기 변수, 숫자 폭, 배지 모양 줄은 diff에 없음(그대로).
3. 실행: npm test 1934 통과/0 실패(42 파일), tsc 0, lint 0, test:acceptance 158 통과·9 skipped·0 실패, build 성공(Google Fonts 받기 성공). .next/static에 Hannah·Fernwood·AFTERLOOP_·client_credentials·api-m.sandbox 모두 0.
4. 완료 기준: 가운데 상자 없음(--content-max:none, Today는 padding 0 전체 폭), 목록 칸 21.25rem(340px) 왼쪽 끝·calc(100vh-4.5rem) 높이·자체 스크롤, 막대 width:100%. layout.tsx에 Figtree·Noto_Sans_KR. 시안 색 8개가 globals.css 변수로 존재. 그림자는 today.css 한 곳 var(--shadow-selected)뿐. css에서 #0066F5/#0070E0/#003087은 globals.css 5행 주석(금지 안내 문구, 기준 커밋에도 있던 줄)에만 있고 실제 값으로는 없음; 파랑 계열 색 값 없음(강조색 #5b3cc4). 배지 문구·점 구성은 model.ts·copy 확인 및 테스트 통과. model.ts가 pickPreventProduct 사용, 화면 쪽 pickPrevent 없음.
5. 추적 버튼 탐침(가짜 호출기, 끝나고 스크립트 삭제):
 - 스위치 전부 꺼짐: POST 0, "Simulated · nothing was sent to PayPal"
 - 일부만(LIVE만 / LIVE+목록, RECORDING 없음): POST 0, 행마다 "Not turned on for this order" (켜짐 상태라 Simulated가 아니라 "not added" 줄 — 안전상 문제 없음)
 - RECORDING만: POST 0, Simulated
 - 값 부정확(LIVE=true, " 1", RECORDING=yes): POST 0
 - 세 스위치 정확(LIVE=1, RECORDING=1, ORDERS=O05,O07): O05·O07만 POST, "✓ 2 trackers added · Orders tracking API · 201" + 추적번호
 - 허용 목록에 O02·O04·O13(+O01·O08) 넣고 전부 미등록으로 속인 가짜: 분쟁 주문 POST 0(서버가 대상에서 먼저 제외), O05·O07만 POST
 - 실패 422: "2 of 2 not added…" + 행마다 이유, 응답 문장 없음
 - 서버 액션 addTrackingAction()은 인자 없음, 클라이언트 버튼은 action()만 호출 → 브라우저 주문 목록 안 씀
 - 녹화 스위치 이름: 코드 liveGateFromEnv는 AFTERLOOP_TRACK_RECORDING을 읽음(보고서와 일치). tasks/T063.md의 AFTERLOOP_RECORDING 표기는 틀림.

참고(실패 사유 아님): 일부만 켜짐 때 결과 줄이 "2 of 2 not added"로 나옴(Simulated 아님). 상세 pickPrevent 이름 잔재 없음.
