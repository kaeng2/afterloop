판정: 통과

대상: verify-tmp2 @ 10f98e8 (diff c7cafd4..10f98e8). 코드·설정·테스트 수정 0줄, 개발 서버 없음, 실호출 없음.

## 1. 범위
- 바뀐 12파일: src/app/_shared/short-date.ts(신규), src/app/cases/{model,reply-model}.ts, reply-panel.tsx, reply.css, case-view.tsx, case.css, conversation.tsx, tests/unit 2개, reports/T068-impl.md, tasks/T068.md. 모두 허용 범위. copy 파일은 이번 diff에 변경 없음(en/ko 키 같음 유지).
- send.ts 0줄. 금지 폴더(ai·engine·paypal·exec·types·rules·params·seed·acceptance·package.json) 0줄.
- 기존 테스트 수정은 app-case-reply.test.ts(주석 1줄)와 app-t068.test.ts(T068 자체 테스트)뿐. 안전·관문 단언 약화 없음(오히려 칩 날짜·지호 순서 단언 추가). app-send, app-case-reply-retry, app-t061은 수정 0줄.

## 2. 실행
- npm test: 43 파일, 1972 passed, 0 failed (이전 실패 4개 해소)
- tsc 0, lint 0, test:acceptance 158 passed / 9 skipped / 0 failed, build 0
- .next/static: Hannah·Fernwood·AFTERLOOP_·client_credentials·api-m.sandbox 모두 0건

## 3. 재시도 항목 (코드 diff + 테스트)
- 영어 원문이면 english=null, 번역 줄·AI suggests 숨김. 판단은 구매자 언어 EN / 번역=원문 / KO·JA인데 CJK 문자 없고 라틴만. 독일어+다른 번역, 서연(한국어)은 번역 줄 유지(테스트).
- 지호 아래 줄: [Send in Korean](조용) -> 꺼짐 안내 -> [Send offer · $7] 오른쪽 끝, 뒤에 버튼 없음. .reply-send column, .reply-foot nowrap (테스트가 CSS까지 확인).
- 칩 날짜 "Nov 17" (chipText: 날짜 토큰만 shortDate로, 계산 없음). 영어 초안 "November 17", 검사 줄 "11월 17일" 그대로.
- 세로 줄이기(Conversation 제목 sr-only, 꼬리 줄 같은 줄, 답장 칸 align-items:start)는 마크업/CSS 테스트로만 확인. 실제 1920x1080 화면 높이(약 1000px 이하)는 스크린샷 미확인 - 컨트롤 타워 몫.

## 4. replyChips 보충 (가짜 LlmCaller, 스크립트 삭제함)
- 칩 4개 -> 그대로, 화면 "Follow-up: Nov 17"
- 칩 1개(3개 미만이라 draft.chips=[]), 빈 배열, 필드 없음 -> 코칭 5줄, 토큰 채움("Give a follow-up date: Nov 17.")
- 환불 칩 포함 -> Full refund·Refund $74 빠지고 3개
- 초안 실패 -> replyChips []
- 참고: 코칭 줄이 칩이 될 때도 날짜가 "Nov 17" 짧은 꼴(지시서 허용 범위로 판단).

## 5. 보내기 관문
app-send 37, app-case-reply-retry 20, app-t061 36 = 93 passed, 수정 없이 통과. acceptance 158 통과.

## 비고
case-view.tsx 옛 "$72.00" 주석도 수정됨. 문제 없음.
