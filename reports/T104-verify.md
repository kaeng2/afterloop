# T104 검증 (7779ff5)

판정: **통과** (결함 없음, 참고 2건)

1. F4-47 통과 — `desk-actions.ts` `shownDeltaPp`는 bad만 부호를 뒤집는다. 엔진 `deltaPp`는 그대로다. bad 줄은 "+N pts" 빨강으로 표시된다.
2. F5-15·16 통과 — `progress-model.ts scenarioOutcome`은 시안 L661과 같은 argmax이고, 동률이면 ok > refund > cb이다. `sentSnap`(Send 순간의 입력칸 글과 예측)에서 시작하므로 보낸 글 기준이다. refund·cb의 승인 버튼은 `approve()`로 화면 상태만 바꾼다. progress 파일에는 서버 액션·fetch·activity 호출이 없다. 환불 약속·금액·"POST … 200" 줄도 없다. 손님 글에는 Simulated 표시가 붙고, 통관번호 가림은 유지된다. 위험 칩은 refund·cb의 첫 줄(엔진 `scenarioRisk` 'sent')에만 있고, 계약 밖 줄(buyer_angry·refund·buyer_refund)에는 `NO_RISK`다.
3. F5-25·28·29 통과 — 메시지의 `report`·`markDone`은 `completeAction` 한 곳에서 `onFinish`(`[finished]` effect, 1회)로만 불린다. 진행 칸의 자체 토스트는 삭제됐다. 지호 제안 카드는 progress 분기 앞에서 return 하므로 CaseProgress에 닿지 않는다. 그래서 성공 순간의 `completeAction` 호출과 onFinish가 겹치지 않는다. refund·cb는 flash와 금액이 없고 Done today만 처리한다(엔진 값 없음 → 근거 있는 선택).
4. F4-52 통과 — `detailsBackTranslation`은 안 고친 글이면 원본 역번역, 고친 글이면 editedView의 역번역, 없으면 null(줄 숨김)을 돌려준다.
5. 리뷰 ③ `keepSignOff` 통과 — 원래 초안에 서명 토큰이 있는데 고친 글에 없으면 끝에 토큰을 붙인다.
   - `checkTokens`는 무변경이고, 테스트가 서명 제거·중복·다른 토큰 추가가 여전히 실패함을 확인한다.
   - 토큰만 붙이므로 AI에 이름 값이 가지 않는다. `nameLeftovers` 검사는 그 뒤에 돈다.
   - 전송본 미리보기에 채운 서명이 보인다. 원래 초안에 서명이 없거나 글이 비었으면 아무것도 더하지 않는다.
   - 참고: 판매자가 서명을 일부러 뺀 경우에도 `keepSignOff`가 서명을 되붙인다(`edited-reply.ts:103`). 영어 입력칸에는 안 보이고 한국어 전송본에만 보인다. 의도된 동작이다. 칸 책임자가 알고 있으면 충분하다.
6. F4-36·37·69 통과 — `.reply-chip.reply-chip-good`·`.reply-chip.reply-chip-warn` 두 클래스로 흰 바탕과 hairline이 회색에 덮이지 않는다. `.reply-chip`에 gap 0.25rem이 있다. 빈 글은 `editGate`가 `reasonKey: null`을 준다.
7. 범위 통과 — `_server`·`src/ai`·`src/engine`·`today`·`cases/view` 변경 0줄이다(`git diff 862a3b3..bd8217c --stat`). 변경 파일은 `cases/**`, config copy, tests, inventory뿐이다. 수정한 기존 테스트는 모두 이 작업의 결정으로 설명된다(빈 글 이유 null, bad 부호, completeAction·onFinish 위치, 진행 칸 토스트 삭제, `CaseProgress` props 삭제, ko=en 허용 4키). 회귀를 숨기는 변경은 없다. 새 copy 키 18개는 en·ko 키 집합이 같다(app-t081 통과). inventory는 관련 5행만 바뀌었다.
8. 렌더 루프 통과 — `scenarioInput`은 useMemo이고 의존성에 `sentText`만 더했다. 보낸 뒤에는 바뀌지 않는다. `sentOutcome`은 useMemo다. `onFinish`는 ref 경유 + `[finished]` 의존이다. app-t103 통과.
9. 실행 결과
   - `tsc` 통과, `lint` 통과, `build` 통과.
   - `test:acceptance` 177 통과 · 9 skipped.
   - app-t104·t103·t105·t102는 64개 모두 통과.
   - `npm test`는 2537 통과 · 1 실패. 실패는 storefront "결정론 100회"이고, 단독 실행하면 31/31 통과한다(부하로 흔들리는 시험).

참고
- 데드 코드 `actionSavingsClient`, `.cprog-toast`, copy `case.progress.toast`가 남아 있다. 보고서에 이미 적혀 있고 기능에는 영향이 없다.
- 브라우저 확인은 하지 않았다(범위 밖).
