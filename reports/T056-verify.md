판정: 통과

# T056 검증 (독립 확인, 코드·설정·테스트 수정 0줄)

대상: lane/ai 커밋 66e8071, ecea113. 기준 `git diff main...lane/ai`. SPEC 첫 줄 v2.9.

## 1. 범위
`git diff main...lane/ai --stat`: reports/T056-impl.md, src/ai/names.ts(새), src/ai/prompts/reply.ts, src/ai/reply.ts, src/ai/tokens.ts, tests/unit/names.test.ts(새), tests/unit/reply.test.ts. 모두 허용 범위.
`src/types.ts`·`config/`·`src/engine/`·`src/app/`·`tests/acceptance/` 변경 0줄 (stat 출력 0).

## 2. 실행 (종료 코드)
- npm test => 0 (36 파일, 1730 통과, 0 실패)
- npx tsc --noEmit => 0
- npm run lint => 0
- npm run test:acceptance => 0 (13 파일, 158 통과, 9 건너뜀 = 실제 샌드박스, 0 실패)

## 3. 완료 기준 직접 확인
임시 vitest 파일(scratchpad `v056.test.ts`를 tests/unit에 잠시 복사해 실행 후 삭제, git status 깨끗)로 가짜 LlmCaller만 사용. `.env`는 열지 않음.
- (가) draftReply 1회 + translateReply 2회(번역·역번역)의 system·user 모두 `Seo-yeon|서연|Hannah|Fernwood|Ji-ho|지호` 없음. user의 `<facts>`에 `⟦BUYER_NAME_1⟧ (BUYER_NAME) = the buyer's name, already including the right honorific…`, `⟦SELLER_NAME_1⟧ (SELLER_NAME) = the seller's signature…` 줄 있음. 통과.
- (나) nameFacts B01/en = Seo-yeon + 서명, B01/ko = 서연 님 + 서명, B04(표에 없음) = 서명만, buyerId 없음 = 서명만. nameFactsPair(B01, en→ja)와 (B04, en→ko) 모두 양쪽 서명만. 값에 언어 꼴 표시 없음. 통과.
- (다) 전송본 `⟦BUYER_NAME_1⟧ 님,` → sendable false, nameProblems ['honorific_after_name'] (check.ok는 true, 호칭 검사가 막음). 통과.
- (라) 전송본에서 BUYER_NAME 토큰 누락 → check.missing = ['⟦BUYER_NAME_1⟧'], sendable false. 통과.
- (마) 정상 초안·전송본 → sendable true. fillTokens: "Hello Seo-yeon," / 끝 "Hannah, Fernwood Knits" / "안녕하세요 서연 님,". loadReplyNames 실제 설정 통과, sellerSignature 공백이면 예외. 통과.
- (바) `src/`에서 이름 값 직접 쓰기 없음: 코드 줄 매치는 types.ts 주석, `src/paypal/track.ts`의 기존 `CARRIER_NAME_OTHER`(이번 변경 아님)뿐. src/ai의 매치는 전부 주석. 통과.

## 4. 기존 테스트 기대값 변경 (tests/unit/reply.test.ts diff의 삭제 줄)
삭제된 것: `buyerFirstName`·`sellerName` 입력 두 칸, `buyer_first_name: Seo-yeon`·`seller_name: Hannah`가 user에 있다는 단언, 이름 줄바꿈 주입/길이 자르기/빈 줄 테스트의 이름 부분(메모 부분은 유지). 지시서가 이름 줄을 없애라고 한 결과만이다. 다른 기대값(sendable, 호출 횟수 등) 변경 없음. 통과.

## 5. 정규식 성능
`HONORIFIC_AFTER_NAME`(`⟦BUYER_NAME_n⟧` + 공백 0~4자 + 호칭)과 `HONORIFIC_BEFORE_NAME`(lookbehind + Herr/Frau + 공백 1~4자 + 토큰)은 공백에 상한 {0,4}/{1,4}가 있고 중첩 한정자 없음. 약 10만 자 입력 7종(공백 10만, 토큰 반복, `Herr ` 반복, `Herr`+공백 10만, 글자 10만, 토큰 접두 반복, 토큰+숫자 10만)과 혼합 9.5만 자 모두 0.0~0.3ms. 이차 이상 꼴 없음.

## 고칠 것
없음.

## 참고 (고칠 필요 없음)
- 구현 보고의 설명대로 nameProblems는 성공 결과 안에 있어 화면(T009)이 읽어야 사유 문구를 보인다.
- 실제 모델이 `Hello ⟦BUYER_NAME_1⟧,`를 지키는지는 가짜 호출만이라 미확인 (범위 밖).
