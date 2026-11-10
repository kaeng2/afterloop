# T056 보고 (2026-11-10 14:30)

- 기준 SPEC: v2.9   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ai / 66e8071 (구현). 이 보고서는 그 다음 커밋

## 결과
완료 — 이름 토큰 `⟦BUYER_NAME_1⟧`·`⟦SELLER_NAME_1⟧`를 토큰 문법·검사·프롬프트에 넣고, 이름 사실값을 만드는 `src/ai/names.ts`를 더했다. 이름 값은 어느 AI 호출에도 가지 않는다. main에서 실패하던 `npx tsc`(`DEFAULT_FACT_MEANINGS`)가 통과한다. 실제 AI 호출 없음 (가짜 `LlmCaller`만), `.env`는 열지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/ai/tokens.ts` | 종류 목록에 `BUYER_NAME`·`SELLER_NAME`. `isNameFact` 공개. `formatFact`는 이름 값을 그대로 돌려준다. `checkTokens`의 개수 비교(`missing`/`extra`)는 다른 토큰과 같고, 이름 값 글자는 `literalFacts`로 세지 않는다 |
| `src/ai/names.ts` (새) | `loadReplyNames(source?)` (zod. 빈 글·`*`·`⟦⟧`·`{{}}` 거부, 틀리면 예외), `nameFacts({names, buyerId?, locale})`, `nameFactsPair({names, buyerId?, draftLocale, outgoingLocale})`, 상수 `BUYER_NAME_TOKEN`·`SELLER_NAME_TOKEN`. 상속 키(`toString`·`__proto__`)를 구매자로 읽지 않는다 |
| `src/ai/prompts/reply.ts` | `buyer_first_name`·`seller_name` 줄과 입력 칸 삭제. `DEFAULT_FACT_MEANINGS`에 지시서 문구 그대로 두 줄. 초안 규칙: `⟦BUYER_NAME_1⟧`이 있으면 `Hello ⟦BUYER_NAME_1⟧,`, 없으면 `Hello,` / `⟦SELLER_NAME_1⟧`은 끝에 한 번 / 이름을 글자로 쓰지 않는다. 번역 규칙: 이름 토큰 옆에 님·씨·様·さん·さま·Herr·Frau를 붙이지 않는다 |
| `src/ai/reply.ts` | `ReplyInput`의 `buyerFirstName`·`sellerName` 삭제 (`src/app/`에서 쓰는 곳 없음 — grep 확인). `ReplyTranslation`(ok)에 `nameProblems: ReplyNameProblem[]` 추가, 코드 `'honorific_after_name'`. 비어 있지 않으면 `sendable: false`. 고치지 않고 받은 전송본을 그대로 둔다 |
| `tests/unit/names.test.ts` (새) | 토큰 문법, `formatFact`, `checkTokens` 개수·literal 제외, `nameFacts`·`nameFactsPair`, `loadReplyNames` (실제 설정 통과, 빈 서명 예외 등) |
| `tests/unit/reply.test.ts` | 이름 토큰 묶음 추가 (아래). 이름 입력 칸을 뺀 자리 정리 (아래 "기존 테스트 변경") |

### 호칭 겹침 검사 범위
전송본에서 `⟦BUYER_NAME_n⟧` **바로 뒤**(공백 0~4자)의 `님`·`씨`·`様`·`さん`·`さま`·`殿`, **바로 앞**의 독일어 `Herr`·`Frau`. 지시서의 ko `님`, ja `様`·`さん`·`さま`에 `씨`·`殿`·`Herr/Frau`를 더했다 (번역 프롬프트가 금지하는 목록과 맞췄다). `님께`처럼 조사가 붙어도 걸린다. 문장 속 `고객님`처럼 토큰에 붙지 않은 호칭은 막지 않는다. 영어 구매자 경로(호출 0회)도 같은 검사를 받는다.

## 화면(T009)이 부르는 방법
1. 서버에서 `const names = loadReplyNames()` → `const pair = nameFactsPair({ names, buyerId: 시드 구매자 ID(예 'B01'), draftLocale: 'en', outgoingLocale: buyerLocale })`.
2. 초안: `draftReply({ …, facts: [...사실값, ...pair.draft] })` (이름 칸은 없다).
3. 전송본: `translateReply({ …, facts: [...사실값, ...pair.outgoing] })` → `sendable`(이제 `nameProblems`도 반영)으로 버튼을 켠다.
4. 채우기: 영어 초안 미리보기는 `fillTokens(draftEn, [...사실값, ...pair.draft])`, 보내는 글·미리보기는 `fillTokens(outgoing, [...사실값, ...pair.outgoing])`.
5. 표에 없는 구매자(B04 buyer_m)는 `buyerId`를 그대로 넘기면 서명 토큰만 나온다 (인사말 `Hello,`).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 | 0 | 9 건너뜀 = AC13 실제 샌드박스(`RUN_SANDBOX=1`일 때만). AC32 통과 |
| npm test | 1730 | 0 | 36 파일 |
| npx tsc --noEmit | 통과 | 0 | main에서 실패하던 `DEFAULT_FACT_MEANINGS` 해결 |
| npm run lint | 통과 | 0 | |

완료 기준 대조:
- [x] `nameFacts`: B01+en → "Seo-yeon" + 서명 / B01+ko → "서연 님" / B04 → 서명만 / `buyerId` 없음 → 서명만. `nameFactsPair`: 전송본 언어 꼴이 없으면 양쪽 모두 이름 토큰 없음 (영어 꼴이 없는 경우도)
- [x] `loadReplyNames`가 실제 설정 통과, `sellerSignature`가 빈 글(공백만 포함)이면 예외
- [x] 가짜 `LlmCaller`가 받은 세 호출의 system·user에 "Seo-yeon"·"서연"·"Hannah"·"Fernwood" 없음. `<facts>`에 `⟦BUYER_NAME_1⟧ (BUYER_NAME) = …`, `⟦SELLER_NAME_1⟧ (SELLER_NAME) = …` 줄 있음 (초안·번역 호출 둘 다)
- [x] 지시서의 초안·전송본 꼴 → `sendable: true`, 채우면 "Hello Seo-yeon," · 끝 "Hannah, Fernwood Knits" · "안녕하세요 서연 님,"
- [x] 전송본에서 `⟦BUYER_NAME_1⟧`이 빠지면 `missing`에 있고 `sendable: false` (`⟦SELLER_NAME_1⟧`도 같은 테스트 추가)
- [x] `⟦BUYER_NAME_1⟧ 님` → `sendable: false`, `nameProblems: ['honorific_after_name']`
- [x] 서연 흐름(초안 → 전송본 → 검사 → 정책 밖 약속) 기존 테스트 그대로 통과

### 기존 테스트 변경 (T053·T054까지의 테스트)
기대값을 바꾼 것은 **없앤 이름 줄을 직접 보던 테스트뿐**이다 (지시서가 그 줄을 없애라고 했으므로 그 결과다). 다른 기대값은 바꾸지 않았다.
- 입력의 `buyerFirstName`·`sellerName` 삭제 (서연·지호 입력).
- "초안 호출의 user에 수·언어·원인이 들어간다": `buyer_first_name: Seo-yeon`·`seller_name: Hannah`가 **있다** → **없다**로.
- "이름·메모의 줄바꿈이 지시 줄을 만들지 못한다" → 메모만 남김 (메모에 `</reply_task>`를 넣어 태그 무력화 확인은 유지).
- "긴 이름·메모는 자른다" → 메모 120자만. "이름이 없으면 빈 줄을 넣지 않는다" → "메모가 비어 있으면 빈 줄을 넣지 않는다".

## 남은 문제
- `honorific_after_name`은 `ReplyFailureDetail`이 아니라 `ReplyTranslation.nameProblems`(성공 결과 안)에 둔다 — 글은 만들어졌고 막는 것은 전송이기 때문이다 (`outsidePolicy`·`addedInTranslation`과 같은 자리). 화면이 사유 문구를 보이려면 이 칸을 읽어야 한다 (T009 몫. 문구는 `config/copy.*`).
- 독일어·일본어 이름 꼴은 설정에 아직 없다. 그 구매자는 `nameFactsPair`가 양쪽 이름 토큰을 만들지 않아 "Hello,"로 나간다.
- 실제 모델이 "Hello ⟦BUYER_NAME_1⟧,"를 지키는지는 실제 호출로 확인하지 않았다 (이 작업은 가짜 호출만). 지키지 않아도 토큰 개수 검사·`draft_unknown_tokens`가 막는 쪽으로 틀린다.

## 컨트롤 타워에 요청할 결정
- 없음
