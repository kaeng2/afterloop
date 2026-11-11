# T071 구현 보고 — fixSavings

- 기준 SPEC v2.10 일치. 모델 sonnet-5-5. 브랜치 lane/engine.
- 변경: `src/engine/sim.ts`에 `FixSaving` 타입, `fixSavings(input, params?, rules?)` 추가 (FIX_ORDER 순서). `tests/unit/sim.test.ts`에 3건 추가.
- 계산: 켜진 처방 = meanLoss(그것만 끔) − meanLoss(지금), 꺼진 처방 = meanLoss(지금) − meanLoss(지금+그것). `runPass`를 직접 써서 `simulate`와 같은 시드·미래·표를 쓴다. 패스 최대 5회.
- 테스트: 처방 0개·4개(가디건 FK-CD-OAT)에서 `simulate` 차이와 일치, 0 이상 확인, 결정성, 500ms 미만.
- 결과: `npm test` 1975 통과, `tsc` 0, `lint` 0, `test:acceptance` 실패 0 (9 skipped는 기존).
- 컨트롤 타워에 요청할 결정: 없음. UI는 `fixSavings`를 import해 "could save $X"에 `savingCents`를 옮기면 된다.
