# T098b 검증 (9e11f58, 기준 1fb18b8)

판정: 통과 (참고 2건)

1. 안전장치: send.ts·mode.ts·activity.ts diff 0 (1fb18b8..9e11f58). tests/acceptance·config·src/engine diff 0. 공개 모드 쓰기 0회·검사 실패 Send 막기·환불 Send 막기(app-t100)·타이핑 중 Send 꺼짐·고친 글 번역 시험 모두 npm test에서 통과.
2. 숫자: 곡선 점은 riskTrail이 scenarioRisk 값을 순서대로 옮김, curveView는 자리만 계산(TRAIL_GAP=시안 0.8). 화면 계산·새 숫자 없음. 단계 줄 source='simulated' 변경 없음.
3. inventory Desk 162행: 구현함 147 / 예외 15 / 빈 상태·근거 0. 예외 15행: .nav 색·hover 2(진입점), 로고 안 색 4(지시서 규칙 2), Auto 그라데이션 1·s.auto 1(Send 이후), refundNow 1(안전장치), resOn·resBg·resKey·결과 그라데이션 4(데이터), s.done 2. 앞 13행은 22:55 목록에 해당. s.done 2행("Done today" 묶음)은 근거가 "데이터"로 약함: 시안의 화면 상태 동작이라 엄밀히는 22:55 목록 밖이고, 구현자가 컨트롤 타워 결정을 요청해 둔 상태. 구현함 무작위 15행(색 토큰·keyframes·gmore·categoryTone·notSent 등) 근거 파일과 시안 값 일치 확인(#6C7378, #CFD3D8, #F1EFEA, #9AA0A6, #333333, #ECEEF0, rgba(196,50,31,.08), @keyframes rise, .gmore 등).
4. 시험 변경: T047 B-3·T067·T090·today 기대값을 시안 box-shadow/그라데이션 값으로 교체. B-3은 시안 파일을 읽어 변수 값이 모두 시안 값인지 검사(지어낸 값 금지 유지)로 오히려 구체화. 안전장치·숫자 시험 약화 없음.
5. 토스트: later(0ms) 대신 hideLater로 hideMs 3000 유지, 애니메이션만 css로 끔. 그림자 9종(ai, row-on, bubble, work, focus, editor-focus, hairline, ghost, toast)이 시안 box-shadow와 문자 그대로 일치.
6. 명령: npm test 2472/2473 (storefront '결정론 100회' 5초 시간 초과 1건, 단독 재실행 31/31 통과), tsc 0, lint 0, test:acceptance 177 통과(9 skip), build 0. .next/static 금지어 0.
7. 범위: 282f41f diff는 src/app(intro·listing 제외), inventory, tests/unit, reports만. 지시서 허용 범위 안.

참고: (a) s.done 예외 2행 근거 약함, 결정 필요. (b) 위험 % 큰 숫자 40px(시안 44px)·판매자 점 색은 구현자가 의도적으로 남김(보고서에 명시).
