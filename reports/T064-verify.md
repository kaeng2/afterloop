판정: 통과

대상: 17df793 (f2153c7·9ac2d03·17df793), 검증용 사본, 코드 수정 0.

1. 범위: 통과. 바뀐 파일은 _server/paypal.ts(5줄)·activity.ts(새)·send.ts(1줄), _shared/**, products/transactions-line.ts(2줄), copy activity. 키(+ 앞 키 쉼표 1개), tests/unit, reports/T064-impl.md뿐. 엔진·AI·src/paypal·exec·계약·설정 json·시드·인수 테스트 0줄.
   T070 관문: paypal.ts는 `resolveDemoMode(env)==='recording' ? client : blockWrites(client)` 판정과 blockWrites 본문이 그대로이고 그 바깥에 recordClient만 씌움. send.ts는 SIMULATED_CALLER를 recordCaller(...,{simulated:true})로 감싼 것뿐. 관문 동작 변경 없음.
2. 실행: npm test 49파일 2080 통과(종료 0), tsc 0, lint 0, test:acceptance 13파일 158 통과·9 skip, build 0. .next/static 에 AFTERLOOP_·DEMO_MODE·client_credentials·api-m.sandbox·LLM_API_KEY 모두 0건.
3. 탐침(가짜 fetch, tsx): 
   - 기록 항목·서랍 데이터에 본문·토큰·Authorization·쿼리 문자열(?x=a@b.com 등)·이메일·주소·추적번호 없음. 통관부호(P+12자리)도 없음. oauth 토큰 호출은 기록 0.
   - HEY·GAH 경로 읽기 기록 없음. 목록 요약 "2 cases"(가짜 응답 4건 중 보이는 2건).
   - public: 막힌 send-message·추적 2건은 "Simulated · not sent"(응답 코드 없음), 실제 POST 0회(토큰 발급 제외). recording(스위치 켜짐/꺼짐 무관): 200/201 실제 코드.
   - 녹화 순서 흉내: 위에서 Send message 200 · Add tracking 201 ×2 (주문 읽기 접어 calls 2) · Read sales 200 cached · Read sales 200 · Read your open cases 200 (목록+상세 접힘).
   - 70번 호출 후 기록 50개, 위쪽 막대 건수 = 기록 수(9=9, 50=50).
   참고(결함 아님): 같은 대상 읽기를 쓰기 줄에 접는 표시 정책이 있어 줄 수는 호출 수보다 적지만 건수는 calls 합으로 정확히 일치.
4. 서랍 접근성(코드): role=dialog·aria-modal·aria-labelledby, 열면 닫기 버튼에 포커스, Esc 닫기, Tab/Shift+Tab 서랍 안 순환(밖이면 되돌림), 닫으면 여는 버튼으로 포커스 복귀, 배경 클릭 닫기. 열 때·3초마다·focus 때 서버 액션으로 새로 읽음.
스크립트는 삭제함.
