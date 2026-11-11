# T074 구현 보고

- 기준 SPEC v2.10 일치. 브랜치 lane/ui.
- 바꾼 것: `config/copy.en.json`·`copy.ko.json`의 값 6개씩(`nav.appName`, `shell.drawer.note`, `case.send.error.notOnScreen`, `case.routine.F1.delivered`, `case.routine.F1`, `case.routine.other`)에서 AfterLoop → DisputeLess. 키 이름은 그대로. 한국어 조사만 맞춤("AfterLoop이" → "DisputeLess가").
- 화면 코드에 직접 쓰인 "AfterLoop"은 없음(주석만 남음, 안 고침).
- 단위 테스트 3개(`app-t064-activity`, `app-today`, `app-t061`)는 `t('nav.appName')`로 단언하게 고침. 다른 기대값은 그대로.
- 안 건드림: `src/ai/`, `src/app/_server/`, 변수·패키지·환경변수 이름, 주석.
- 확인: `grep AfterLoop config/copy.*.json` 0건. `npm test` 2080 통과(변경 전과 같음), `tsc --noEmit`·`lint`·`build` 오류 0, 인수 158 통과·9 건너뜀(같음).
- 실제 AI·PayPal 호출, 개발 서버 실행 없음.
- 컨트롤 타워에 요청할 결정: 없음.
