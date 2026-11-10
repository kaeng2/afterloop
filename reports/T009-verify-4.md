판정: 통과

# T009 2부 재시도 검증 (커밋 1ecb305·99aa2e2·2ebf8f0, 기준 4d50ca7..HEAD)

## 1. 범위
- `git diff 4d50ca7..HEAD`: 15개 파일. 전부 `src/app/**`, `config/copy.{en,ko}.json`, `reports/T009-impl.md`, `tests/unit/`.
- `src/ai/ src/exec/ src/engine/ src/paypal/ src/types.ts config/rules.json config/demo-links.json seed/ tests/acceptance/ package.json` 변경 0줄 (확인).
- 문구 파일: 변경된 줄이 모두 `case.` 키(각 11줄 추가, 삭제 0). en/ko 키 각 253개, 차집합 없음.

## 2. 실행
- `npm test`: 종료 0, 39 파일 / 1822 통과.
- `npx tsc --noEmit`: 종료 0, 출력 없음.
- `npm run lint`: 종료 0.
- `npm run test:acceptance`: 13 파일 통과, 158 통과 / 9 skipped, 실패 0.
- `npm run build`: 성공 (라우트 표 출력, `.next/BUILD_ID` 있음).
- `.next/static`에서 "Hannah" "Fernwood" "AFTERLOOP_" "client_credentials" "api-m.sandbox": 모두 0개 파일.

## 3. 완료 기준 (직접 짠 탐침, 가짜 호출기·가짜 LLM만, 실제 호출 없음; 탐침 파일은 지움)
(가) 지호 제안: 스위치 정확히 "1"만 live ("true"," 1","1 ","","0",없음 → simulated). simulated → 실제 호출 0회. live+liveSendAllowed → make-offer 정확히 1회, send-message 0회, 본문 `note` = "안녕하세요 지호 님, … $7.20을 … 11월 17일까지 …\n\nHannah, Fernwood Knits" (⟦·{{ 없음), offer_amount 7.20 REFUND. 같은 계획 두 번 → 1회. 0회 확인: D3(liveSendAllowed false), HEY 연습용, GAH 옛 서연, 표 밖 ID, 상태 UNDER_REVIEW, 승인 없음, 판매자 글 이미 있음, kind=message(제안 먼저), 사실값 변조, nameProblems 있음.
(나) 서연 보내기: simulated 0회 / live send-message 1회 / 두 번 → 1회 / D3·HEY·GAH·표 밖·승인 없음·이미 답함·kind=offer(제안 아닌 분쟁) → 모두 0회.
(다) 미리보기 = 전송 글자: 지호 `view.outgoing.text` === make-offer `note`, 서연 `view.outgoing.text` === send-message `message` (금액 자리표시자 포함 글로도 확인, $72.00 채워짐).
(라) 가짜 LlmCaller가 받은 모든 요청에 "Seo-yeon" "서연" "Hannah" "Fernwood" "Ji-ho" "지호" 없음, `BUYER_NAME_1`·`SELLER_NAME_1` 토큰은 있음. 영어 "Hello Seo-yeon," + "Hannah, Fernwood Knits", 한국어 "안녕하세요 서연 님," (님 님 아님). 호칭 겹침("⟦BUYER_NAME_1⟧ 님") → nameProblems=[honorific_after_name], sendable false, canSend 꺼짐(`case.send.blocked.nameHonorific`), 서버 호출 0회. D3/B04는 BUYER_NAME 없이 DATE·SELLER_NAME만.
(마) 영어 초안·전송본·역번역·코칭에 `{{`·`⟦` 없음 (코칭의 {{disputeAmount}}도 $로 채워짐).
(바) 서버 액션 `sendReplyAction`은 zod로 disputeId(정규식)·kind('message'|'offer')·replyId(r-+32hex)·confirmedCommitments(범주 enum)만 받고 나머지는 버림. 금액·이름·본문은 서버 기억(`recallReply`)과 엔진·설정에서 다시 만들며 사실값이 다르면 거부(변조 탐침 0회). 브라우저로 넘기는 "후 보드"는 BoardState(분쟁 ID·사유·단계·기한·금액·허용 수·추적 여부·구매자 이전 분쟁 수·cause.subtype/evidence 근거 단어/causeNote)뿐. 이메일·주소·통관부호·구매자 실명 필드 없음. 이름 사실값(설정의 호칭 "서연 님"·서명)은 화면 미리보기에 어차피 보이는 값이며 `config/rules.json`에서 옴.
(사) `case-view.tsx`의 `.case-stack`(세로 flex, `case.css`)이 대화→배송사를 한 열에 쌓음. 순서 머리글→비교→원인→스택. grid `.case-columns` 참조 0건. 오른쪽 답장은 기존 `.case-shell-reply`.
(아) `src/app/cases`, `src/app/_server`의 ts·tsx에서 주석 제외 7·700·720·74·37·7400·3680 리터럴 0건. 제안 금액은 `plan.amountCents` → `toDollarsRounded`("$7").

## 4. 기존 테스트 기대값 변경
- `app-case-reply.test.ts`: 검사 줄 3개 → 4개(`case.reply.check.nameHonorific` 추가) — 지시서 2번(호칭 겹침 사유 표시)에 해당.
- `app-send.test.ts`: 사실값 생성을 `caseReplyFacts`로, `nameProblems` 필드 추가 — 구조 변경에 따른 것. 기대값 약화 없음.

## 비고 (실패 아님)
- 코칭 줄의 금액은 `fillMessage` 결과(달러.센트, 예 $48.00)로 채워짐. 지시서는 반올림 표시도 허용하므로 문제 없음.
- 스크린샷 시각 확인은 하지 않음(범위 밖).
