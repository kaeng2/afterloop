# T077 보고 (2026-11-11 20:40)

- 기준 SPEC: v2.11 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ai / (커밋 후 `git log -1`)

## 결과
완료. `summarizeCaseHistory`를 만들었다. 가짜 `LlmCaller`로만 시험했다 (실제 AI 호출·`.env` 접근 없음).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/ai/history.ts` | `summarizeCaseHistory` + 코드 검사 (날짜·숫자가 입력 사건에 있는지, `findCommitments`, 길이 240자·2문장, 꺾쇠 제거, 개인정보·알 수 없는 토큰 거부) |
| `src/ai/prompts/history.ts` | 시스템 프롬프트, JSON 스키마, 사건 목록 프롬프트 (시각·난수 없음, 최근 30건, 한 줄 200자) |
| `tests/unit/history.test.ts` | 8개 테스트 |

## 화면이 부르는 방법
1. `const r = await summarizeCaseHistory({ events, buyerFirstNameToken?: '⟦BUYER_NAME_1⟧', locale: 'en' }, { llm })` — 사례를 읽는 서버 함수 안에서, `events`는 `CaseEvent[]`(실제 기록).
2. 캐시 키는 `HISTORY_SYSTEM`+`buildHistoryUser(events, token)` 글자(같은 입력이면 같음)에서 만든다. 둘 다 `@/ai/prompts/history`에서 export.
3. `r.ok`면 `r.summary`를 보여 주고, `ok:false`(`ai_unavailable`|`invalid_output`)면 그 줄을 숨긴다. 예외는 던지지 않는다. 이름 값은 모델에 가지 않으니 `⟦BUYER_NAME_1⟧`가 있으면 화면에서 코드가 채운다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm test | 2088 | 0 | 50 파일 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run test:acceptance | 159 (17 skipped) | 0 | |

## 남은 문제
- 날짜 검사는 숫자 표기("Nov 3", "11/3", 숫자)만 본다. "the third of November"처럼 낱말로 쓴 날짜는 못 잡는다 (프롬프트가 금지).
- 꺾쇠는 공백으로 바꾼 뒤 접는다 (`<b>x</b>` → `b x /b`). 태그 글자는 남지 않지만 태그 이름은 글로 남는다.
- 실제 AI 출력으로 검사에 자주 걸리는지는 병합 후 컨트롤 타워가 확인한다.

## 컨트롤 타워에 요청할 결정
- 없음
