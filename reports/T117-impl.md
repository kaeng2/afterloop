# T117 보고 (2026-11-12 14:40)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서와 같은 커밋 — `git log -1 lane/ui`)

## 결과
완료 — 고친 글을 번역할 때 넘기는 사실값을 토큰 글에 실제로 있는 토큰만으로 줄였다(`factsInText`). 번역기가 `<facts>`의 토큰을 모두 붙이는 최악의 경우에도, 이름 없는 고친 글(급한 답장 그대로 / 칩으로 고친 뒤 이름을 지운 글)이 통과하고 번호를 받는다. 이 테스트는 고침을 빼면 실패한다(직접 확인).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/edited-reply.ts` | `factsInText(tokenized, facts)` 추가: 글에 토큰이 있는 사실값만 원래 순서대로 남긴다. BUYER_NAME·SELLER_NAME·DATE 모두 같은 규칙 |
| `src/app/_server/send.ts` | `prepareEditedReply`의 `translateReply` 호출에서 `facts: reply.facts` → `facts: factsInText(tokenized, reply.facts)`. 이를 위해 import 줄에 `factsInText`만 더했다. 관문, `checkTokens`, `editAdditions`, `screenText`, `rememberReply`(전체 facts), `sendReply` 서버 재검사는 바꾸지 않았다 |
| `tests/unit/app-t117.test.ts` | 새 시험 7개 (아래) |

시험 내용:
- 재현: 전체 facts일 때 `⟦BUYER_NAME_1⟧`을 붙이면 `extra`로 실패한다.
- `factsInText`: 고르는 규칙과 순서, 입력을 바꾸지 않음.
- 이름 없는 고친 글 2종(급한 답장 그대로 / 칩으로 고친 뒤 이름을 지운 글): 통과하고 번호를 받는다. 번역 프롬프트 `<facts>`에 영어 글에 없는 토큰이 없다. AI 입력에 실제 이름 값이 없다.
- 칩으로 고친 글(칩이 이름을 넣음): 이름이 토큰으로 돌아가 통과한다.
- 이름 있는 글: 그대로 통과하고 facts가 전부 간다.
- `checkTokens` 엄격: 토큰을 빼거나, 두 번 쓰거나, 다른 토큰을 더하면 실패한다. 줄인 facts로 검사해도 목록 밖 토큰은 `extra`로 잡힌다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skip) | 0 | |
| npm test | 2596 | 1 | `storefront.test.ts > 결정론 > 같은 입력 100회`: 전체 실행에서 시간 흔들림. 따로 돌리면 31/31 통과 (지시서의 "storefront 흔들림은 따로") |
| T100·T104·T113·T117 | 66 | 0 | |
| npx tsc --noEmit | ✓ | 0 | `npm run build`로 `.next/types`를 새로 만든 뒤 (이전 빌드에 없어진 `/intro`·`/listing` 페이지 타입이 남아 있었다) |
| npm run lint | — | 1 error | **이 작업과 무관한 기존 오류**: `tests/unit/app-t116.test.ts:186` `react/no-children-prop`. T116 커밋 `dd575e9`("fix test typing")가 tsc 때문에 일부러 `children` prop으로 바꾼 줄이다. 인자로 넘기면 tsc TS2769가 나서 손대지 않았다. 내 파일에는 lint 문제가 없다 |
| npm run build | ✓ | 0 | |

실제 AI·PayPal 호출 0회 (가짜 LlmCaller, 가짜 `load`). 개발 서버를 띄우지 않았고 `.env`를 읽지 않았다.

## 남은 문제
- `keepSignOff`(T104)는 남겼다. 원래 초안에 서명이 있으면 고친 글에도 `⟦SELLER_NAME_1⟧` 서명 줄을 남기는 동작(T104 시험이 이 동작을 기대함)이고, 이번 고침과 충돌하지 않는다. 서명 토큰이 글에 있으니 SELLER_NAME 사실값도 번역에 간다.
- 줄인 facts로 돌리면 번역 단계 안의 `literalFacts` 검사도 글에 있는 사실값만 본다. 다만 AI가 목록에 없는 값을 받지 않으니 글자로 쓸 수도 없다. 보낼 때 `sendReply`가 전체 facts로 `checkTokens`를 다시 돌리는 것도 그대로라 최종 관문은 약해지지 않았다.
- 위의 t116 lint 오류는 그 작업 쪽에서 정리해야 한다 (예: 시험 파일에 eslint-disable 한 줄, 또는 `WorkZone`의 children 타입 조정).

## 컨트롤 타워에 요청할 결정
- 없음 (send.ts는 지시서가 허용한 facts 인자 한 곳과 그에 필요한 import 이름 하나만 바꿨다 — 확인 부탁).
