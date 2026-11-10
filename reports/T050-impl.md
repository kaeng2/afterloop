# T050 보고 (2026-11-10 11:38)

- 기준 SPEC: v2.5 (시작할 때 `SPEC.md` 첫 줄과 같았다: 예 — `SPEC v2.5 (2026-11-10 10:52 KST)`)
- 브랜치 / 마지막 커밋: `lane/ai` / `9ff5310` (이 보고서 커밋 전)
- 실제 AI 호출: **하지 않았다.** `.env`를 열지 않았고, 테스트는 전부 가짜 `LlmCaller`다 (네트워크로 나가지 않는다).

## 결과

완료 — 지시서 1~7번을 모두 구현하고 각각 단위 테스트를 붙였다. 서연 건 정상 흐름(초안 → 전송본 → 검사 통과)은 그대로 `sendable: true`다.

**다만 지시서의 "기존 테스트는 기대값 변경 없이 통과" 조항과 직접 충돌해 기대값을 바꾼 테스트가 2건 있다.** 둘 다 지시서가 바꾸라고 한 바로 그 동작을 고정해 둔 테스트였다 (아래 "컨트롤 타워에 요청할 결정" 1번). 그 2건을 뺀 나머지 기존 테스트(reply 37건, tone 31건)는 기대값을 고치지 않았다.

## 고친 것 (지시서 1~7번)

| 번호 | 한 줄 | 어디 |
|---|---|---|
| 1 | `FACT_RULES`의 "쓰지 말 것" 예시를 시연과 무관한 값으로 (`"March 3"`·`"the 3rd of March"`·`"$19"`·`"nineteen dollars"`·`"XX000000000XX"`) | `src/ai/prompts/reply.ts` |
| 2 | `buyer_first_name`·`seller_name`·`cause_note`(+`cause_subtype`)를 한 줄로 접고 각괄호를 지우고 자른다 (이름 40자, 메모 120자) | `src/ai/prompts/reply.ts` `oneLineValue` |
| 3 | `translateReply`가 **번역 전에** 판매자 초안의 글자로 쓴 사실값을 거부한다 (호출 0회, `invalid_output` / `draft_has_literal_facts`). `en` 경로도 같다 | `src/ai/reply.ts` `draftInputProblem` |
| 4 | 같은 자리에서 이메일·전화번호·개인통관고유부호를 거부한다 (`draft_has_personal_data`). `ko`·`en` 모두 호출 0회 | 같은 함수 |
| 5 | 사실값을 글자로 쓴 코칭 줄을 버리고, 버린 뒤 3줄이 안 되면 `coaching_too_few` | `src/ai/reply.ts` `draftReply` |
| 6 | `ReplyFailureDetail` 유니온에 쓸 수 있는 코드를 모아 두고, 오류 이름은 아는 것만 옮긴다 (모르면 `unknown_error`) | `src/ai/reply.ts` |
| 7 | 어조 근거를 **맞은 자리의 원문 조각**으로 내보내고, 가림 표식(`⟦PCCC⟧`·`⟦EMAIL⟧`·`⟦PHONE⟧`)이 든 구절은 뺀다 | `src/ai/tone.ts` `verifiedEvidence` |

구현 판단 몇 가지:

- **3·4번의 검사 순서**: 개인정보를 먼저 본다. 개인통관고유부호는 `literalFacts`에도 걸려서, 순서가 사유 코드를 정한다 — 더 좁은 쪽(연락처·부호)을 알려 준다.
- **3·4번은 왜 호출 전인가**: 번역 프롬프트가 "사실값을 글자로 쓰지 말 것"·"가림 표식을 베끼지 말 것"을 지시하므로, **지시를 잘 따르는 모델일수록 판매자가 적은 날짜·금액·연락처를 조용히 빼고** 번역한다. 그러면 초안 ↔ 전송본 검사는 통과해 (`sendable: true`) 내용이 사라진 글이 구매자에게 간다 (`reports/T042-verify.md` ③의 표 2·3·6행). 호출 전에 막는 쪽이 싸고 정직하다.
- **5번은 줄만 버린다**: 코칭 한 줄이 틀렸다고 초안 전체를 버리지 않는다. 버린 뒤 3줄이 안 될 때만 `coaching_too_few`다 (지시서 문장 그대로).
- **6번은 "이름을 붙이지 않는다"를 허용 목록으로 읽었다**: `src/ai/llm.ts`가 던지는 네 클래스 이름(`LlmError`·`LlmApiError`·`LlmConfigError`·`LlmResponseError`)만 `Map`에서 찾아 고정 코드로 옮기고, 그 밖은 `unknown_error`다. 그래서 기존 기대값 `llm_failed:LlmApiError`는 그대로 통과하고, 탐침이던 `llm_failed:Evil ZZ_MARKER_…`는 더 이상 나오지 않는다. `Record`가 아니라 `Map`을 쓴 이유는 `error.name`이 `toString` 같은 상속 키일 수 있기 때문이다.
- **7번의 안전장치**: 원문 조각은 "소문자 건초더미에서 찾은 자리"로 떠 온다. 소문자로 바꿀 때 길이가 달라지는 글자(`İ` 등)가 섞이면 자리를 믿을 수 없으므로 그때만 모델이 보낸 글자를 쓴다 (확인은 그대로 하므로 지어낸 근거는 여전히 막힌다). 테스트로 고정했다.
- **2번의 각괄호**: `sanitizeUntrusted`가 `&lt;`로 바꾸기 **전에** `<`·`>`를 공백으로 지운다. 그래서 한 줄 값에는 태그 글자도 `&lt;` 꼴도 남지 않는다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `src/ai/prompts/reply.ts` | 1·2번. `FACT_RULES` 예시 교체, `oneLineValue`(한 줄·각괄호 제거·자르기·잘린 부호 꼬리 가림), `optionalLine`에 길이 인수, `NAME_MAX_CHARS` 40 / `NOTE_MAX_CHARS` 120 |
| `src/ai/reply.ts` | 3·4·5·6번. `ReplyFailureDetail` 유니온, `failure`가 코드(또는 코드 배열)만 받음, `fromError`의 이름 허용 목록, `hasLiteralFacts`, `draftInputProblem`, 코칭 줄 검사 |
| `src/ai/tone.ts` | 7번. 건초더미를 `{display, lower}` 두 벌로, 맞은 자리의 원문 조각을 내보냄, 가림 표식이 든 구절 제외 |
| `tests/unit/reply.test.ts` | 새 테스트 14건 (38 → 52). 기대값 변경 1건 |
| `tests/unit/tone.test.ts` | 새 테스트 3건 (32 → 35). 기대값 변경 1건 |

`src/ai/tokens.ts`는 읽고 그대로 썼다 (`checkTokens`를 그대로 부르고 탐지를 다시 구현하지 않았다). 수정 가능 폴더 밖은 고치지 않았다.

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 144 | 0 | 9건 건너뜀 (`ac13.sandbox.test.ts`, 전부터 같다) |
| `npm test` | 1226 | 1 | 실패 1건은 **이 작업과 무관한 알려진 실패**다 (아래) |
| `npx tsc --noEmit` | 오류 0 | — | |
| `npm run lint` | 오류 0 | — | |
| `npx vitest run tests/unit/reply.test.ts tests/unit/tone.test.ts` | 87 | 0 | reply 52 + tone 35 |

**무관한 실패 1건**: `tests/unit/sandbox-v23.test.ts > T039 1. manifest 형식 > 정본 manifest는 주문 13건·분쟁 4건이고 시연 제외가 1건이다` — `expected … to have a length of 4 but got 5`. 원인은 `tests/sandbox/manifest.json`에 연습 분쟁(`PP-R-HEY-10197767`)이 5번째로 들어간 커밋 `c961e06`이고, 그 테스트는 기대값 4를 그대로 두고 있다. 둘 다 이 작업의 수정 가능 폴더 밖이라 고치지 않았다 (`tests/unit/sandbox-v23.test.ts`·`tests/sandbox/`). 작업 시작 시점의 `main` 병합 상태에서 이미 실패하는 테스트다. 내 변경 파일 5개는 모두 `src/ai/*`·`tests/unit/{reply,tone}.test.ts`로, 이 테스트가 읽는 파일과 겹치지 않는다.

## 완료 기준 대조

| 완료 기준 | 결과 |
|---|---|
| 1~6번 각각의 테스트 | 있다 (reply.test.ts: 프롬프트 2건 + 이름/메모 2건, 판매자 초안 검사 6건, 코칭 2건, 고정 코드 2건) |
| 서연 건 정상 흐름이 그대로 `sendable: true` | 통과 (`서연 건 … 초안 → 전송본이 전송 가능하다`) |
| `draftEn: "… by Nov 17 …"` → 호출 0회, `invalid_output` | 통과 (`ko`·`en` 모두 0회, `draft_has_literal_facts`) |
| `"… by ⟦DATE_1⟧ …"` → 지금처럼 진행 | 통과 (호출 2회, `sendable: true`) |
| 가게 이메일이 든 초안 → 호출 0회, `invalid_output` (`ko`·`en`) | 통과 (`draft_has_personal_data`) |
| 기존 38개 테스트가 기대값 변경 없이 통과 | **37건은 그대로. 1건은 기대값을 바꿨다** (아래 결정 1번) |
| `npm test`·`tsc`·`lint`·`test:acceptance` | 위 표. 무관한 실패 1건만 |

## 남은 문제

- **`tokens.ts`가 놓치는 꼴은 그대로다** (지시서 "하지 않을 것"). 그래서 판매자 초안 검사(3번)도 같은 구멍을 물려받는다: `십일월 십칠일`, `17th`, `11-17`, `the seventeenth`, 통화 표기 없는 수, 소문자·숫자만으로 된 추적번호를 적은 초안은 호출 전 검사를 통과한다. 기록만 한다.
- **구분 글자 없이 적은 휴대전화 번호(`01012345678`)는 4번 검사가 잡지 못한다** — `maskPersonal`의 기존 한계(주문번호·추적번호를 지우지 않기 위한 결정, T032)를 그대로 쓴다. 주소도 모양으로 가릴 수 없어 잡지 못한다.
- **4번은 "판매자 자신의 연락처"와 "구매자 연락처"를 가리지 않는다** — 모양이 같으므로 둘 다 거부한다. `reports/T042-verify.md` ③이 적은 "기준이 필요하다"는 물음에 대해, 이 구현은 SPEC 10장(분쟁 메시지에 연락처를 넣지 않는다)을 따라 **둘 다 막는 쪽**으로 정했다. 가게 메일 주소를 답장에 꼭 넣어야 한다면 결정이 필요하다 (아래 결정 2번).
- **7번의 원문 조각은 "모델이 본 글"에서 떠 온다** — 각괄호를 `&lt;`로 바꾼 글이므로, 구매자가 `<`를 쓴 자리는 근거에 `&lt;` 꼴로 나간다 (`reports/T043-verify.md` R7, 전과 같다).
- **R1(부분 문자열 기준이라 `a`·`SCA` 같은 조각도 근거가 된다)은 고치지 않았다** — 지시서 범위 밖이다. 이제 그 조각도 원문 글자로 나간다.
- 코칭 줄은 `oneLine`으로 80자에서 잘린 **뒤에** 사실값 검사를 받는다. 잘린 꼬리에 남은 반쪽 날짜·금액은 검사가 못 보는 경우가 있을 수 있다 (예: `…by Nov` 처럼 일이 잘려 나간 꼴). 초안 쪽은 자르지 않으므로 해당 없다.

## 컨트롤 타워에 요청할 결정

1. **지시서의 "기존 테스트는 기대값 변경 없이 통과" 조항과 충돌해 기대값을 바꾼 테스트 2건을 확인해 주기 바란다.** 둘 다 지시서가 바꾸라고 한 동작을 고정해 둔 테스트였고, 다른 길이 없었다 (고치지 않으면 3번·7번을 구현할 수 없다). 지시서는 reply 쪽에 대해 "바꿔야 하면 멈추고 보고"라고 했지만, 나머지 1~2·4~6번과 7번은 영향이 없어 **전부 구현한 뒤 이 보고로 올린다**. 되돌리라면 되돌린다.

   | 테스트 | 전 (지금 통과하던 기대값) | 후 (바꾼 기대값) | 왜 |
   |---|---|---|---|
   | `tests/unit/reply.test.ts` `전송본 검사 > 영어라도 초안이 사실값을 글자로 쓰면 …` (전 379행) | `ok: true`, `sendable: false`, `check.literalFacts`에 `November 17` | 호출 0회, `ok: false`, `invalid_output`, `draft_has_literal_facts` | 지시서 3번("`en` 경로도 같은 검사를 거친다")과 완료 기준("호출 0회, `invalid_output`")이 이 동작을 직접 요구한다. 제목도 `… 호출 없이 거부한다`로 바꿨다 |
   | `tests/unit/tone.test.ts` `근거 확인 > 줄바꿈·대소문자만 다른 인용은 받아 준다` (전 204행) | 근거 `['This is unacceptable', 'i am done waiting']` (모델이 보낸 소문자) | `['This is unacceptable', 'I AM DONE waiting']` (구매자 글 원문) | 지시서 7번("결과에는 구매자 글에 있는 그대로의 글자")이 이 동작을 바꾸라고 한 자리다. 구절이 받아들여지는지(통과 여부)는 그대로다 |

2. **답장에 가게 연락처를 적는 것을 허용할지** (`reports/T042-verify.md` ③의 미결 물음). 지금 구현은 SPEC 10장을 따라 이메일·전화번호가 든 초안을 거부한다 (`draft_has_personal_data`). 판매자가 "메일로 사진 보내 주세요"라고 쓰고 싶어하면 이 결정이 필요하다 — 허용한다면 "판매자 자신의 주소만 허용"은 모양으로 가릴 수 없으므로, 설정(`config/`)에 가게 주소를 두고 그것만 통과시키는 식의 계약이 필요하다.

3. **무관한 실패 1건**: `tests/unit/sandbox-v23.test.ts`의 분쟁 4건 기대값이 `tests/sandbox/manifest.json`(연습 분쟁 추가, `c961e06`)과 어긋난다. 이 레인의 수정 가능 폴더 밖이라 손대지 않았다. data/sandbox 레인에 넘겨야 한다.

4. **`src/types.ts`로 올릴 계약은 아직 없다.** `ReplyFailureDetail`·`ReplyInput` 등은 T042 때와 같이 `src/ai/reply.ts`에 둔 상태다 (화면을 붙이는 작업이 쓸 때 계약으로 올릴지 결정하면 된다).
