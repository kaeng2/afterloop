# T057 구현 보고

- 기준 SPEC v2.9 = 현재 SPEC v2.9 (일치)
- 수정 파일: `src/ai/prompts/reply.ts`, `tests/unit/reply.test.ts` (범위 안)
- `src/ai/reply.ts`는 바꾸지 않았다 (프롬프트만으로 충분)

## 변경
1. 초안 `offer` 수 설명: PayPal에서 수락, 수락하면 부분 환불 즉시 처리·건 종료, 예시 문장(`{{offerAmount}}` 자리표시자만), 답장·메시지로 수락받는 문장 금지.
2. 코칭 규칙: "Explain how to accept the offer in PayPal", 답장 수락 줄 금지.
3. 번역 프롬프트: 수락하는 곳(PayPal)을 바꾸지 말고 "by replying/by message"를 더하지 않는다.
4. `fight`·`refund` 줄은 그대로.

## 설계 메모
시스템 프롬프트는 캐시 때문에 고정 문자열이고 기존 테스트가 `toBe(DRAFT_SYSTEM)`으로 확인한다. 그래서 "fight·refund일 때 없다"는 규칙이 `- offer:` 줄에만 있다는 뜻으로 구현하고 테스트했다 (수는 user 쪽 `move:`로 전달). 기존 테스트 기대값은 바꾸지 않았다.

## 결과
- npm test: 39 파일 1826 통과 (새 테스트 4개 포함)
- tsc --noEmit: 오류 0
- test:acceptance: 실패 0 (158 통과, 9 스킵)
- lint: 오류 1건은 `docs/design/mockup-v3/vendor/react-dom.js`(수정 금지 폴더, 이번 변경과 무관). 내 파일은 새 오류 없음.
- 실제 AI 호출 없음, `.env` 접근 없음.

## 컨트롤 타워에 요청할 결정
- lint가 `docs/design/mockup-v3/vendor/`를 검사해 실패한다. eslint ignore 처리 필요 (`docs/`는 수정 금지라 요청만 한다).
