판정: 통과

# T069 검증 (커밋 8b8aa3f, lane/ai)

1. 범위: 바뀐 파일은 `src/ai/reply.ts`, `src/ai/prompts/reply.ts`, `tests/unit/reply.test.ts`, `reports/T069-impl.md` 넷뿐.
2. 실행 (종료 코드 모두 0): `npm test` 1835 통과/0 실패, `npx tsc --noEmit` 0, `npm run lint` 0, `npm run test:acceptance` 158 통과(9 skip)/0 실패. 구현 보고서 수치와 같다.
3. 완료 기준 (임시 테스트로 가짜 LlmCaller만 사용, 실제 AI·.env 없음; 파일은 지웠고 git 상태 깨끗):
   - 프롬프트에 `chips:` 규칙·예시 꼴, JSON 스키마에 `chips`(+required): 있음.
   - `["Apology","Customs hold","Ask for code","Follow-up: ⟦DATE_1⟧"]` -> 그대로.
   - `Full refund`, `Refund $74`, `{{offerAmount}} back`, 마침표 문장, `⟦DATE_9⟧`, 25자 칩: 각각 하나씩 넣어도 모두 버려짐. 24자 칩은 남음.
   - 3개 미만이면 `chips: []`, 초안 ok:true.
   - 지호(offer)에서 `Offer in PayPal` 남고 `Full refund`는 버려짐 (refund/fight 수에서도 Offer in PayPal 남음 - 지시서 2번과 일치).
   - 칩 필드가 없으면 `[]`(테스트 있음).
4. 두 결정:
   - ① 사실. 임시 복사본에서 `chips: string[]`(필수)로 바꾸고 tsc를 돌리니 `src/app/cases/reply/load.ts:97`, `tests/unit/app-send.test.ts:263,369,447`에서 오류. 선택 칸 유지는 타당 (T068이 그 두 곳에 `chips: []`를 더해야 필수로 바꿀 수 있음).
   - ② 사실. 삭제된 기대값은 1줄뿐(`required` 배열에 `chips` 추가). 스키마 `required`에 넣으라는 지시 때문이며 다른 기존 기대값 변경 없음 (나머지는 추가: 가짜 응답에 chips, 새 테스트 5건).
5. 성능: 칩은 `oneLine(chip,200)`으로 200자로 잘린 뒤 정규식을 탄다. 10만 자 입력(a 반복, 공백 반복, `⟦` 반복, `a.` 반복, `{{` 반복) 각 1~18ms.

참고(결함 아님): `cleanChips(asked.value.chips ?? [],input.facts)` 쉼표 뒤 공백 없음(스타일).
