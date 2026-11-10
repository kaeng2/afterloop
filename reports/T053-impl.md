# T053 보고 (2026-11-10 12:14)

- 기준 SPEC: v2.7 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `SPEC v2.7 (2026-11-10 11:55 KST)`)
- 브랜치 / 마지막 커밋: lane/ai / `5c3c3c6`
- 실제 AI 호출: 없음. `.env`를 열지 않았다. 단위 테스트는 가짜 `LlmCaller`만 쓴다

## 결과

완료. 프롬프트가 토큰의 **뜻**과 **허용한 약속**을 받고, 돈이 드는 약속은 코드가 찾아
전송을 판매자 확인 뒤로 미룬다. 서연 흐름(초안 → 전송본 → 검사)은 그대로 전송 가능이다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `src/ai/commitments.ts` (새 파일) | `CommitmentCategory` 6개와 `findCommitments(text, locale)`. 범주별 낱말을 이름 붙인 상수로 네 언어(영어 = 초안, 한국어·일본어·독일어 = 전송본)에 두었다. 라틴 문자는 대소문자 무시 + 낱말 앞 경계, `credit`만 낱말 단위 + 뒤에 `card`가 오면 제외. 토큰(`⟦…⟧`)·자리표시자(`{{…}}`) 안의 글자는 공백으로 지우고 본다. 부정문도 잡는다 |
| `src/ai/reply.ts` | 정책 읽기(`replyDraftPolicy`, zod. 설정이 틀리면 예외), `draftReply`·`translateReply`의 선택 인자 `policy`, `ReplyInput.factMeanings?`, `ReplyDraft.outsidePolicy`, `TranslateInput.move`(필수)·`confirmedCommitments?`·`factMeanings?`, `ReplyTranslation.outsidePolicy`·`addedInTranslation`, 새 `sendable` 판정, 코칭 줄에서 정책 밖 약속 줄 버리기 |
| `src/ai/prompts/reply.ts` | `<facts>` 줄을 `⟦DATE_1⟧ (DATE) = 뜻` 꼴로 바꾸고(값은 그대로 넣지 않는다), `<allowed_commitments>` 절 추가, 시스템 프롬프트에 날짜 뜻 규칙·좋은 꼴 예시·돈이 드는 약속 금지·번역에서 날짜 옆 동사의 뜻 유지 규칙 추가. 뜻·약속 줄은 `oneLineValue`로 한 줄로 접고 각괄호를 지운다 |
| `tests/unit/commitments.test.ts` (새 파일) | 70개. 범주 × 네 언어 낱말 표, 약속이 아닌 글 표(`credit card`·`card company`·`customs clearance code`·`carrier`·운송사 문장), 부정문, 자리표시자·토큰 무시, 고정 순서·중복 없음, 입력 글 불변 |
| `tests/unit/reply.test.ts` | 69개(전 46개). 뜻·허용한 약속 프롬프트, 재발송 초안 → 확인 → 전송, 번역이 더한 약속, 수별 환불 처리, 코칭 줄 버리기, 정책 스키마 |

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 155 (+ 9 skip) | 0 | AC31(답장 초안 정책) 포함. 인수 테스트는 실행만 했다 |
| `npm test` | 1374 | 0 | `tests/unit/reply.test.ts` 69, `tests/unit/commitments.test.ts` 70 |
| `npx tsc --noEmit` | — | 0 | |
| `npm run lint` | — | 0 | |

## 완료 기준 대조

| 기준 | 결과 |
|---|---|
| `<facts>`에 뜻이 있고 값은 없다, `FOLLOW_UP_DATE_TOKEN`의 뜻 = 정책, A2 두 줄 / B1 `<none/>` | 통과 (`프롬프트: 토큰의 뜻과 허용한 약속`) |
| 재발송 초안 → `outsidePolicy: ['reship']`, 전송본 "재발송" → `sendable: false`, 확인 후 `true` | 통과 |
| 바라는 꼴 초안 → `outsidePolicy: []`, `sendable: true` | 통과 |
| 번역이 더한 "전액 환불" → `addedInTranslation: ['refund']`, 확인해도 `sendable: false` | 통과 |
| `move: 'offer'`의 `{{offerAmount}}` 환불은 정책 안, `fight`는 정책 밖 | 통과 (`fight` 쪽은 `translateReply`로 확인했다 — 아래 "남은 문제" 1번) |
| `findCommitments` 낱말·제외·부정문·자리표시자 | 통과 |
| 코칭 줄 "Offer a refund if it is late"가 `fight`에서 버려진다 | 통과 (`offer`에서는 남는다) |
| 설정 정책이 스키마를 통과하고, 틀린 모양은 예외 | 통과 |

## 화면(S5)이 부르는 방법

1. `draftReply(input, { llm }, policy?)` → `outsidePolicy`가 비어 있지 않으면 초안 아래에
   "이 약속은 판매자 정책에 없습니다: 환불 / 재발송 …"을 범주별로 보여 주고 체크박스로 확인을 받는다.
2. 판매자가 확인한 범주를 `translateReply({ …, move, confirmedCommitments: [...] }, { llm }, policy?)`에
   그대로 넘긴다 (초안을 고쳐 약속을 지웠으면 범주도 사라져 확인이 필요 없다).
3. 전송 버튼은 `sendable`만 본다. `addedInTranslation`이 비어 있지 않으면 **확인 체크박스를 주지 말고**
   "번역이 없던 약속을 더했습니다 — 다시 만들기"만 보여 준다 (확인으로 풀리지 않는다).
4. 범주 → 화면 문구는 `config/copy.*.json`에 ui 레인이 넣는다 (이 보고서의 위 문구는 뜻 설명이다).

## 기대값이 바뀐 곳 (지시서 완료 기준 마지막 항목)

지시서가 지시한 범위 안에서 **두 곳**이 바뀌었다. 멈추는 대신 그대로 진행하고 여기에 적는다.

1. `tests/unit/reply.test.ts`의 서연 대역 초안·전송본·역번역 글을 바꿨다. 전에는 `fight` 답장이
   "그때까지 도착하지 않으면 전액 환불해 드릴게요"로 끝났는데, SPEC v2.7 3장에서 그 환불은 정책 밖
   약속이라 판매자 확인 없이는 전송 가능이 아니다. 사람이 정한 바라는 꼴("⟦DATE_1⟧까지 운송사
   상황을 확인해서 다시 연락드릴게요")로 고쳤다 — **가짜 LLM이 돌려주는 입력 글**이 바뀐 것이고
   기대값(`sendable: true`, `check.ok: true`)은 그대로다. 같은 이유로 "초안에 없는 약속이 생기면
   전송할 수 없다" 테스트가 바꿔 치는 어절을 `받으실 수 있을 거예요` → `다시 연락드릴게요`로 옮겼다
   (기대값 `newPromises`에 `반드시`는 그대로).
2. 프롬프트 `<facts>` 줄의 꼴이 `<fact token="…" kind="…"/>` → `⟦TRACKING_1⟧ (TRACKING) = 뜻`으로
   바뀌어서 그 줄을 확인하는 단언 1개를 새 꼴로 고쳤다 (지시서 2번이 이 꼴을 정한다).

그 밖에 `TranslateInput`에 `move`를 더하면서 기존 호출 입력을 고친 것은 지시서가 허용한 변경이다.

## 남은 문제

1. `move: 'fight'`에서 `{{offerAmount}}`가 든 초안은 `draftReply`가 자리표시자 규칙으로 먼저
   거부한다(`draft_unknown_placeholder`). 그래서 "같은 문장을 `fight`에서 보면 정책 밖"은
   `translateReply`로 확인했다 (판정 코드는 두 함수가 같은 `outsidePolicy`를 쓴다).
2. 약속 낱말은 목록이라 돌려 쓴 말은 놓친다. 독일어 재발송이 특히 좁다 — `erneut senden`·
   `neu versenden` 같은 붙은 꼴만 잡고 "versenden den Artikel erneut"처럼 떨어진 꼴은 못 잡는다
   (사이를 정규식으로 열면 "melde mich erneut"(다시 연락) 같은 정상 문장을 막는다). 전송본의 마지막
   겹은 판매자가 읽는 역번역이다.
3. 영어 낱말은 어느 언어에서나 함께 본다 (번역이 `refund`를 영어로 남기는 경우). 덕분에 전송본에
   영어 약속 낱말이 남으면 잡히지만, 구매자 글을 베낀 영어 조각이 전송본에 섞이면 확인을 한 번 더
   물을 수 있다 — 막는 쪽으로 틀린 것이다.
4. `ReplyInput.factMeanings`는 지금 아무도 채우지 않는다 (확인 기한 토큰 하나뿐이고 그 뜻은 정책이
   정한다). 추적번호·통관 상태 토큰이 답장에 들어가면 그때 화면·서버가 채운다.

## 컨트롤 타워에 요청할 결정

- 없음. 계약(`src/types.ts`)·인수 테스트·SPEC은 고치지 않았다.
- 참고로 남겨 둔다: 약속 낱말 목록을 설정 파일로 옮기는 것은 지시서가 "하지 않을 것"에 둔 범위이고,
  옮기려면 계약(설정 스키마)이 늘어난다. 지금은 코드 상수로 두는 쪽이 맞다고 본다 — AC31이 설정의
  허용 약속 글에 이 낱말들이 **없음**을 지키고 있어서, 두 곳이 서로를 가리키게 되면 규칙이 꼬인다.
- 병합 뒤 실제 AI 3회 비교에서 볼 것: `⟦DATE_1⟧`이 "다시 연락하는 날"로만 쓰이는지, 초안에
  재발송·환불이 다시 나타나는지(나타나면 `outsidePolicy`에 실려 화면이 확인을 묻는다).
