판정: 통과

# T077 검증 (817fd8a, lane/ai)

## 1. 범위
`git diff main...lane/ai` = `src/ai/history.ts`, `src/ai/prompts/history.ts`, `tests/unit/history.test.ts`, `reports/T077-impl.md` 4개뿐. 범위 밖 변경 없음. 검증 중 코드·테스트 수정 없음, `.env` 열지 않음, 실제 AI 호출 없음.

## 2. 실행
| 명령 | 종료 코드 | 결과 |
|---|---|---|
| npm test | 0 | 50 파일, 2088 통과, 실패 0 |
| npx tsc --noEmit | 0 | |
| npm run lint | 0 | |
| npm run test:acceptance | 0 | 159 통과, 17 skipped, 실패 0 |

## 3. 완료 기준 탐침 (가짜 LlmCaller, 사건 날짜 11/3·11/7·11/9, 본문 "2 weeks")
| 입력 | 결과 |
|---|---|
| 입력 날짜만 쓴 요약 ("Nov 3", "11/7"), "2 weeks" | ok |
| "Nov 5" / "11/5" / "November 5" | invalid_output (3건 모두) |
| "23 days" (입력에 23 없음) | invalid_output |
| refund / reship / discount / free shipping | invalid_output (4건 모두) |
| 이메일, P+12자리 통관부호 (출력, 사건 글에 있어도) | invalid_output |
| 입력에 없는 토큰 ⟦BUYER_NAME_2⟧ | invalid_output; 주어진 ⟦BUYER_NAME_1⟧은 ok |
| LLM async 예외 / 동기 예외 | ai_unavailable (던지지 않음) |
| 스키마 틀린 응답 | invalid_output |
| 같은 입력 두 번 | system·user 글자 동일 (true) |
| 꺾쇠 `<b>held</b>` | 꺾쇠 제거되어 ok ("b held /b") — 보고서에 적힌 한계와 일치 |

## 프롬프트와 사람 이름
- 이름이 없는 사건 글: "Seo-yeon", "서연", "Hannah" 모두 프롬프트에 없음 (true 아님). 구매자는 `<buyer>⟦BUYER_NAME_1⟧</buyer>` 토큰만.
- 사건 글(buyer_message 본문)에 이름이 있으면: 3개 이름 모두 그대로 프롬프트에 들어감. 코드가 사건 글의 이름을 가리지 않는다 (`sanitizeUntrusted`는 이메일·통관부호 등만 처리). 지시서는 "이름 값은 넘기지 않는다 (필요하면 토큰만)"인데, 사건 본문 속 이름까지 마스킹하라는 문구는 없다. 입력 사건이 이미 T056 토큰화를 거쳐 온다는 전제라면 문제없고, 아니라면 호출 쪽(T076)에서 사건 글의 이름을 토큰으로 바꿔 넘겨야 한다. 컨트롤 타워 확인 권장 (실패 사유 아님).

## 4. 긴 입력 (10만 자) 시간
사건 글과 LLM 출력 각각에 '1 ' 반복, 'Nov ' 반복, '1/' 반복, 'x' 10만, '3 of ' 반복, 'Nov'+공백 10만, 'P' 10만 자를 넣음. 모두 20ms 이하 (최대 20ms). 정규식 폭주 없음.

## 남은 관찰
- 낱말 날짜("the third of November")는 못 잡음 (구현 보고서에 기재됨, 프롬프트가 금지).
- 위 사건 글 이름 처리 (판정에 영향 없음).
