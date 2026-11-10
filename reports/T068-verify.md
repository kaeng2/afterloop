판정: 실패

사유 한 줄: 병합 상태(dde4d40)에서 `npm test`가 4개 실패한다. T068 단독(d54e9af)에서는 통과했던 테스트가 T069 병합 뒤 깨졌다.

## 1. 범위
- T068 diff(a8a5ae5..d54e9af) 14파일 모두 허용 폴더 안: copy 2개(`case.reply.covers` 한 키), src/app/cases/**, tests/unit/**, reports/T068-impl.md. 통과.
- `src/app/_server` 0줄, src/ai·engine·paypal·exec·types·rules·params·seed·tests/acceptance·package.json 0줄. 통과.
- en/ko 키: 둘 다 `case.reply.covers` 한 줄씩 추가, 같음. `.env` 류는 `.env.example`만 있고 열지 않음.
- 기존 테스트 수정 4파일(6곳): 머리글 금액/상품 꼴, 요약 section→div, 두 칸 컨테이너 질의 삭제, 코칭 접기→칩, 모드 글자 위치. 안전·관문 단언을 약한 곳 없음(오히려 모드 글자 단언은 더 구체적). 통과.

## 2. 실행 (dde4d40)
| 명령 | 결과 |
|---|---|
| npm test | 실패: 4 failed / 1958 passed (2 파일) |
| npx tsc --noEmit | 0 |
| npm run lint | 0 |
| npm run test:acceptance | 158 passed, 0 failed, 9 skipped |
| npm run build | 0 |
- `.next/static`에서 Hannah·Fernwood·AFTERLOOP_·client_credentials·api-m.sandbox 모두 0건.

실패 4개:
- app-case-reply.test.ts "코칭·영어 초안·…": 화면에 'Say sorry for the wait first.' 없음
- app-t068.test.ts "순서: …칩…": `class="reply-chips"` 없음
- app-t068.test.ts "chips가 없으면 코칭 줄을 그대로": replyChips가 [] 반환
- app-t068.test.ts "코칭 줄 대체에서도 토큰은 채운다": view.chips 비어 있음

원인: T069 병합 뒤 `draftReply`가 항상 `chips`를 돌려준다(응답에 chips가 없거나 3개 미만이면 `chips: []`). `replyChips`는 빈 배열도 "chips가 있음"으로 보고 [] 반환(칩 줄 숨김) -> 코칭 줄로 되돌아가는 일이 실제 경로에서 없고, 코칭 접기도 없앴으므로 이 경우 화면에 코칭도 칩도 안 나온다.
부수 발견(결정 필요): 지시 충돌. T068 지시서는 "빈 배열이면 칩 줄 숨김", T069 지시서는 "chips: []이면 화면이 코칭 줄로 대신한다". 어느 쪽으로 할지 컨트롤 타워가 정해야 한다. 어느 쪽이든 위 4개 테스트(칩 없을 때 코칭 대체를 기대)는 병합 상태에 맞게 고쳐야 한다. 코드·테스트는 고치지 않았다.

## 3. 완료 기준 (테스트·코드 확인, 통과한 것)
- 한 열, 회색 요약 상자 없음, 요약이 비교 카드 footer 안, 답장 두 칸 `repeat(2,1fr)`, 두 칸 글자 `--reply-text-size` 하나(=text-md), 모드 글자가 `reply-actions` 안 버튼 옆: T068 테스트 통과(위 4개 외).
- 머리글 "Case … · Wool Sweater $72 · …": 상품은 `productShortName`, 금액은 `toDollarsRounded(분쟁 금액)`. 화면 코드(case-view.tsx·model.ts)에 리터럴 72 없음. (case-view.tsx:29 주석에 옛 예시 "$72.00"이 남아 있음 - 코드 아님.)
- 출처 배지 4종 테스트 통과. 단 "칩 줄 순서" 테스트는 위 실패에 포함되어 칩 줄 위치는 병합 상태에서 테스트로 확인 못 함.

## 4. 칩 연결 (dde4d40, 가짜 LlmCaller 스크립트로 직접 확인, 스크립트 삭제함)
- 입력 칩 ["Apology","Customs hold","Ask for code","Follow-up: ⟦DATE_1⟧"] -> draft.chips 그대로 -> 화면 데이터 view.chips = ["Apology","Customs hold","Ask for code","Follow-up: November 17"]. 날짜가 채워짐(길게 "November 17", T068 보고서가 미리 알린 점).
- 환불 칩 포함 ["Apology","Full refund","Refund $74","Customs hold","Follow-up: ⟦DATE_1⟧"] -> "Full refund"·"Refund $74" 빠지고 ["Apology","Customs hold","Follow-up: November 17"].
- 환불 칩 제거 뒤 3개 미만 -> chips [] -> 화면 [] (칩 줄 숨김, 코칭 대체 없음).
- chips 필드 없는 응답 -> chips [] -> 화면 [] (위 충돌과 같은 문제).
- `replyChips` 자체: chips 배열이 있으면 그것, 아예 없으면 코칭 줄, 빈 배열이면 [] (지시서 문구대로 구현됨).

## 5. 보내기 관문
- `src/app/_server/send.ts` 변경 0줄. app-send.test.ts 37개·app-case-reply-retry.test.ts 20개·app-t061.test.ts 36개 통과, test:acceptance 158 통과 -> 스위치 "1"만 live, 표 밖·HEY·GAH 0회, 지호 make-offer 1회/send-message 0회, 가짜 모드 반복 연습 관련 기존 테스트 그대로 통과. 별도 탐침 스크립트는 따로 만들지 않고 기존 테스트로 대신함.

## 요약
범위·관문·빌드·lint·tsc·acceptance·번들 유출 검사는 모두 깨끗. 하지만 병합 상태 `npm test` 4개 실패(칩이 빈 배열일 때의 처리와 T068 테스트가 T069 이후 현실과 안 맞음). 해결: (a) 빈 chips일 때 코칭 줄 대체로 할지(T069 지시) 숨길지(T068 지시) 결정 후 `replyChips`/테스트 정리.
