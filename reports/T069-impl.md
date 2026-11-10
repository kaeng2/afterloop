# T069 보고 (2026-11-10 16:36)

- 기준 SPEC: v2.10 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ai / (커밋 후 `git log -1` 참조)

## 결과
완료. 초안 응답에 `chips`를 더하고 코드가 걸러낸다. 실제 AI 호출·`.env` 열람 없음 (가짜 `LlmCaller`만).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/ai/prompts/reply.ts` | JSON 스키마에 `chips`(`required`에도), 프롬프트에 칩 규칙·예시 꼴 |
| `src/ai/reply.ts` | `cleanChips`, zod `chips`(없으면 `[]`), `ReplyDraft.chips` |
| `tests/unit/reply.test.ts` | 칩 테스트 5건, 가짜 응답에 `chips` 추가, `required` 기대값에 `chips` 추가 |

## 칩 검사 규칙
- 한 줄로 접고 개인정보 가림. 버리는 칩: 빈 칩, 마침표로 끝남, 24자 초과, `{{`, 숫자 포함, 글자로 쓴 사실값/금액(`checkTokens.literalFacts`), `<facts>`에 없는 토큰(`checkTokens.extra`), `findCommitments`가 하나라도 찾는 칩(어느 수에서도 → 환불 낱말 칩 모두 버림, `Offer in PayPal`은 통과).
- **길이 세는 법: `⟦…⟧` 토큰 하나를 한 글자로 센다.**
- 5개 초과면 앞 5개. 3개 미만이면 `chips: []` (초안은 성공).
- 날짜 칩이 숫자 검사에 걸리지 않도록 숫자 검사는 토큰을 뺀 글자에만 한다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm test | 1835 | 0 | |
| npx tsc --noEmit | - | 0 | |
| npm run lint | - | 0 | |
| npm run test:acceptance | 158 (9 skip) | 0 | |

## 남은 문제
- 기존 테스트 기대값 1건 변경: `required`가 `['buyer_message_en','coaching','chips','draft_en']`가 됨 (지시서가 `required`에 넣으라고 해서 불가피).
- 실제 AI에서 칩이 제대로 나오는지는 컨트롤 타워가 확인 (서연·지호 각 2회).

## 컨트롤 타워에 요청할 결정
- `ReplyDraft.chips`를 **선택(`chips?: string[]`)** 으로 뒀다. 지시서는 `chips: string[]`(필수)인데, 필수로 하면 수정 가능 폴더 밖인 `src/app/cases/reply/load.ts`(비상 고정 초안 `draftSource==='fixed'`)와 `tests/unit/app-send.test.ts`에서 tsc가 깨진다. `draftReply`는 항상 값을 채운다. T068(ui)이 필수로 바꾸려면 그쪽에서 위 두 곳에 `chips: []`를 더해야 한다.
