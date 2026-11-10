# T042 보고 (2026-11-10 11:05)

- 기준 SPEC: v2.4 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `# SPEC v2.4 (2026-11-10 10:44 KST)`)
- 브랜치 / 마지막 커밋: lane/ai / `4b2e035`

## 결과
완료. 화면(S5)이 부르는 `draftReply`(코칭 + 영어 초안 + 구매자 글 영어 번역)와 `translateReply`(전송본 + 역번역 + 검사)를 만들고, 가짜 `LlmCaller`만 쓰는 단위 테스트 38개를 붙였다. 실제 AI 호출과 `.env` 읽기는 한 번도 하지 않았다. 사실값 검사는 `src/ai/tokens.ts`의 `checkTokens`를 그대로 쓰고 다시 구현하지 않았다.

## 화면이 부르는 방법
1. `draftReply({ buyerMessages, buyerLocale, buyerFirstName, sellerName, cause, move, facts }, { llm })` — `buyerMessages`는 `src/paypal/mapper.ts`의 `toClassifyInput`이 쓰는 분쟁 메시지와 같은 값, `cause`는 `classifyDispute` 결과(`BoardState.cause`), `move`는 `recommend(...).best.move`(`'fight' | 'offer' | 'refund'`, `types.ts` `Evaluation`와 같은 낱말)다.
2. `facts`는 **서버가 만든다** — 추적 이벤트의 예상 도착일·통관 상태·추적번호를 `⟦DATE_1⟧` 꼴 토큰으로 묶은 `FactToken[]`. 금액은 사실값 토큰이 아니라 `{{offerAmount}}`·`{{refundAmount}}`·`{{disputeAmount}}` 자리표시자로 간다.
3. 화면은 `coaching`·`buyerMessageEn`·`draftEn`을 그대로 보여 준다. 판매자가 `draftEn`을 고치면 그 글로 `translateReply({ draftEn, buyerLocale, facts }, { llm })`를 다시 부른다 (초안과 분리해 둔 이유).
4. 전송 버튼은 `sendable`(= `check.ok`)로만 켠다. 끄는 이유는 `check.missing`·`extra`·`literalFacts`·`newPromises`에 있다.
5. 전송 직전에 `fillTokens(outgoing, facts)`로 값을 채우고 실행 층(`src/exec/message.ts`)이 `{{…}}`를 채운다. 이 작업은 값을 채우지 않는다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/ai/reply.ts` (새 파일) | `draftReply`·`translateReply`, 입출력 타입(`ReplyInput`·`ReplyDraft`·`TranslateInput`·`ReplyTranslation`), 초안 검증, 실패 접기 |
| `src/ai/prompts/reply.ts` (새 파일) | 호출 세 가지의 고정 시스템 프롬프트·응답 JSON 스키마·user 쪽 조립 (`DRAFT_*`, `TRANSLATE_*`, `BACK_TRANSLATE_*`) |
| `tests/unit/reply.test.ts` (새 파일) | 단위 테스트 38개. 가짜 `LlmCaller`만 쓴다 |

## 지시서 완료 기준 대조
| 기준 | 테스트 | 결과 |
|---|---|---|
| 서연 건(A2·fight·ko·`⟦DATE_1⟧`) `draftReply` → `translateReply`가 `sendable: true` | "초안 → 전송본이 전송 가능하다" | 통과 |
| 초안에 글자로 쓴 날짜(`Nov 17`)·금액(`$72`) → `invalid_output` | "날짜를 글자로 쓰면…", "금액을 글자로 쓰면…" | 통과 (`detail: draft_literal_facts`) |
| 전송본에서 토큰이 빠지거나 늘면 `ok: true` + `sendable: false` + 이유 | "토큰을 풀어 쓰면…", "토큰이 늘면…" | 통과 (`missing`·`extra`·`literalFacts`) |
| 초안에 없는 약속이 생기면 `check.newPromises` | "초안에 없는 약속이 생기면…" | 통과 (`반드시`) |
| `facts`에 없는 토큰 → `invalid_output` | "facts에 없는 토큰을 쓰면…", "토큰 형식이 틀리면…" | 통과 (`draft_unknown_tokens`) |
| LLM 던짐·스키마 위반·빈 문자열 → `ok: false`, 예외 없음, `detail`에 구매자 글 없음 | "LLM 실패" 묶음 8건 | 통과 |
| 구매자 글의 지시가 데이터 태그 안에만 들어간다 | "구매자 글의 지시는…", "각괄호는…" | 통과 |
| 개인통관고유부호·이메일이 프롬프트에 그대로 들어가지 않는다 | "개인통관고유부호·이메일·전화번호를…" | 통과 (`⟦PCCC⟧`·`⟦EMAIL⟧`·`⟦PHONE⟧`) |
| 역번역 프롬프트에 영어 초안 문장이 없다 | "역번역 호출에는 영어 초안을 주지 않는다" | 통과 |
| `buyerLocale: 'en'`이면 호출 0회 | "구매자 언어가 영어면 호출하지 않고…" | 통과 |
| 지호 건(offer): `{{offerAmount}}` 있고 글자로 쓴 금액 없음 | "금액은 {{offerAmount}} 자리표시자로만 쓴다" | 통과 |
| 호출 수 고정 (`draftReply` 1회, `translateReply` 2회) | 위 흐름 테스트 + "실패해도 다시 묻지 않는다" | 통과 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 121 | 1 | 실패 1건은 AC8 "합의 단계에 증빙 링크와 메시지 링크가 함께 있으면: fight는 send_message" — 지시서가 미리 적어 둔 그 1건뿐이다 (T040 병합 전). 9건 skip은 원래부터 skip |
| `npm test` | 1089 | 0 | `tests/unit/reply.test.ts` 38건 포함 |
| `npx tsc --noEmit` | — | 0 | 출력 없음 |
| `npm run lint` | — | 0 | 출력 없음 |

## 만들면서 한 판단 (검증 세션이 볼 자리)
1. **사실값의 값은 프롬프트에 넣지 않는다.** `<facts>`에는 `<fact token="⟦DATE_1⟧" kind="DATE"/>`만 간다. 값을 보여 주지 않으면 모델이 "by Nov 17"로 옮겨 쓸 재료가 아예 없고, 추적번호·통관 상태가 모델에 가지도 않는다. 대가: 모델은 토큰의 뜻을 종류(`DATE`·`TRACKING`…)로만 아므로 사실값이 여러 개면 어느 자리에 무엇을 넣을지 헷갈릴 수 있다. `FactToken`에 설명 칸을 더하는 것은 계약 변경이라 하지 않았다 (아래 "요청할 결정" 없음 — 지금은 서연 건처럼 토큰 1~2개라 문제가 없다).
2. **초안 자기 검사에 `checkTokens(draftEn, draftEn, facts)`를 쓴다.** 같은 글을 둘 다에 주면 `missing`·`newPromises`는 늘 비고, `extra`에 "`facts`에 없는 토큰 + 형식 오류", `literalFacts`에 "글자로 쓴 사실값"만 남는다. 지시서가 말한 "`literalFacts`를 쓰고 다시 구현하지 않는다"를 지키는 가장 작은 길이다.
3. **가리기 함수는 `src/ai/prompts/classify.ts`의 `maskPersonal`·`sanitizeUntrusted`를 그대로 썼다.** 둘 다 이미 `export`되어 있어 그 파일을 고치지 않았다 (지시서 "내보내져 있지 않으면…" 조건에 해당하지 않았다).
4. **LLM이 돌려준 글에도 `maskPersonal`을 한 번 더 거친다.** 초안에 개인통관고유부호가 섞여 오면 `⟦PCCC⟧`로 바뀌고, 그것은 토큰 형식이 아니므로 `checkTokens`가 형식 오류로 잡아 `invalid_output`이 된다 (막는 쪽으로 틀린다). 테스트 "초안에 개인통관고유부호가 있으면…"이 그 자리다.
5. **수별로 쓸 수 있는 실행 자리표시자를 정했다**: `offer` → `{{offerAmount}}`, `refund` → `{{refundAmount}}`, 세 수 모두 `{{disputeAmount}}`. 이름은 `src/exec/message.ts`의 `SOURCES`와 같다 — 거기 없는 이름은 실행 층이 어차피 거부하므로 여기서 먼저 막는다. `move === 'offer'`일 때 `{{offerAmount}}`가 **반드시 있어야 한다고는 하지 않았다** (지시서는 "금액은 자리표시자로만 쓴다"까지다. 없다고 거부하면 멀쩡한 초안이 "AI unavailable"로 내려간다).
6. **`translateReply`에 들어온 판매자 초안도 프롬프트에 넣기 전에 가린다.** 판매자가 초안에 이메일을 적으면 프롬프트에는 `⟦EMAIL⟧`으로 가고, 전송본에 그 표기가 남아 `check.extra`로 전송이 막힌다. SPEC 3장("프롬프트에 이메일을 넣지 않는다")을 지키는 대신 판매자가 가게 메일 주소를 적는 길이 막혀 있다 (아래 "남은 문제").
7. **고정 사유 코드만 `detail`에 쓴다** (`llm_failed:LlmApiError`, `output_schema`, `draft_literal_facts`…). 예외 메시지·`literalFacts` 내용·프롬프트는 싣지 않는다. 길이는 모두 80자 이하이고 테스트가 구매자 글이 섞이지 않았는지 확인한다.
8. **미리보기 도우미는 만들지 않았다.** 지시서가 "둘 수 있다"고 한 자리인데, `fillTokens(outgoing, facts)`를 그대로 부르면 되고 감싸면 새 표기 규칙을 만들 위험만 생긴다. 화면은 `fillTokens`를 직접 부르면 된다.

## 남은 문제
- 판매자가 영어 초안에 **자기 가게 이메일·전화번호**를 적으면 프롬프트에서 가려지고, 전송본에 남은 `⟦EMAIL⟧` 표기가 `check.extra`로 전송을 막는다. 개인정보 쪽으로 안전하게 틀린 선택이지만, 데모에서 판매자가 연락처를 적으려 하면 막힌다. 고치려면 "판매자 자신의 연락처는 가리지 않는다"는 기준이 필요하고 그건 SPEC 10장 쪽 결정이라 하지 않았다.
- 코칭·초안의 **어조는 판정하지 않는다** (T043 몫). 초안이 "반드시"급 약속을 쓰면 프롬프트로만 막고 있다 — `newPromises`는 초안 대비 전송본만 보므로 초안 자체의 과장은 코드가 잡지 않는다.
- 세부 유형 한 줄 설명(`SUBTYPE_LABELS`)이 `src/ai/prompts/classify.ts`의 16개 정의와 **같은 내용을 줄여 적은 것**이라 한쪽만 고치면 어긋날 수 있다. 분류는 유형을 고르는 프롬프트, 답장은 읽는 프롬프트라 한 파일로 묶지 않았다.
- 전송본·역번역·구매자 글 번역의 길이 상한은 초안 상한(1200자)의 두 배인 2400자로 정했다. 지시서에 없는 값이라 임시값이다 (근거: 같은 뜻을 옮기면 언어에 따라 길어지지만 두 배를 넘으면 번역이 아니다).
- `fight`일 때 `{{disputeAmount}}`를 허용한다. "돈 얘기를 하지 말라"는 프롬프트와 겹쳐 보일 수 있지만, 분쟁 금액은 구매자가 이미 낸 돈이고 실행 층도 `board`에서 채운다.

## 컨트롤 타워에 요청할 결정
없음. 계약(`src/types.ts`)·인수 테스트·SPEC을 고치지 않았고, 고쳐야 할 자리도 찾지 못했다. (`ReplyInput`·`ReplyDraft` 등은 지시서대로 `src/ai/reply.ts`에서 `export`했다 — 계약 파일에 넣을 시점은 UI가 붙은 뒤가 맞다고 본다.)
