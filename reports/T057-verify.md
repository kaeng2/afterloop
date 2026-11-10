판정: 통과

# T057 검증 (커밋 0ef1274, 검증 시점 HEAD f3df0e8 = main 병합 포함)

## 1. 범위
`git diff main...lane/ai`: `src/ai/prompts/reply.ts`, `tests/unit/reply.test.ts`, `reports/T057-impl.md` 3개뿐. `src/ai/reply.ts`는 바뀌지 않음(구현 보고와 일치). 범위 안.

## 2. 실행
- `npm test`: 종료 0 — 39 파일, 1826 통과. 한 번은 `tests/unit/storefront.test.ts`의 "같은 입력 100회" 결정론 테스트가 5초 시간 초과로 실패(3회 중 1회, 병렬 부하 탓로 보이는 무관한 불안정). 이 변경과 무관.
- `npx tsc --noEmit`: 종료 0
- `npm run lint`: 종료 0 (구현 보고의 lint 오류는 main의 `docs/design` ignore 병합 뒤 사라짐)
- `npm run test:acceptance`: 종료 0 — 158 통과, 9 스킵, 실패 0

## 3. 완료 기준
- offer: system 글 `- offer:` 줄에 "The buyer accepts the offer in PayPal, not by replying to you", 예시 문장 "If you accept the offer in PayPal, the partial refund of {{offerAmount}} is sent right away and this case is closed.", 금지("Never ask the buyer to accept by reply or message: no reply to accept, ..., no let me know if you accept")가 있다. 코칭 줄에도 "Explain how to accept the offer in PayPal" + 답장 수락 줄 금지가 있다. 있음.
- 시스템 프롬프트는 고정 문자열이라 move와 상관없이 같다(가짜 호출로 offer/fight/refund 세 번 확인: system 글 동일). 수는 user 쪽 `move: <수>` 한 줄로만 전달된다. 수락 규칙은 `- offer:` 줄 안에만 있고, `- fight:`·`- refund:` 줄에는 accept/PayPal이 없다. 코칭 쪽 규칙도 "When the move is offer"로 조건이 붙어 있다. 줄이 수별로 나뉘어 있어 fight·refund 초안에 offer 규칙이 섞일 여지는 구조상 낮다(모델이 다른 수의 줄을 따라 쓸 가능성까지 0으로 증명하는 것은 불가능; 병합 뒤 실제 AI 확인 몫).
- 예시 문장에 숫자·날짜·이름 값 없음({{offerAmount}} 자리표시자만). 테스트가 offer 줄에서 자리표시자 제거 후 숫자 없음을 확인.
- 번역 프롬프트: "Do not change where the buyer accepts an offer ... never adds by replying or by message" 추가됨.
- 기존 테스트 기대값 변경 없음: 테스트 파일 diff는 끝에 새 describe 4개 추가(+30줄)뿐, 삭제 0.

## 4. 가짜 LlmCaller 직접 확인
임시 스크립트로 `draftReply`를 move offer·fight·refund로 호출(실제 AI 호출·.env 접근 없음). 받은 글: user 쪽에는 `move: offer` / `move: fight` / `move: refund` 줄만 달랐고 PayPal·accept 언급 없음. 규칙은 모두 system에 있음(위 3번). 스크립트 삭제함, git 작업 트리 변경 없음.

## 참고
- 구현 보고의 "lint 실패" 서술은 현재 HEAD에서는 해당 없음(main 병합으로 해결).
