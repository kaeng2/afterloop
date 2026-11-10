판정: 통과

# T020 독립 검증 (HEAD 47dda9e, lane/ai)

## 근거
- SPEC 첫 줄 v2.8. 범위: `main...HEAD`는 `reports/T020-impl.md`, `src/ai/color-note.ts`, `src/ai/prompts/color-note.ts`, `tests/unit/color-note.test.ts` 4개뿐. `tokens.ts`·`reply.ts`·`commitments.ts`·`llm.ts`·`types.ts`·`config/`·`seed/` 변경 0줄.
- 실행: `npm test` 33파일 1631 통과 / `npx tsc --noEmit` 종료 0 / `npm run lint` 출력 없음(오류 0) / `npm run test:acceptance` 12파일 155 통과·9 skip·실패 0 / `color-note.test.ts` 64 통과.
- 기본 문구 없음: 코드에 4개 언어 고정 문장 상수 없음(25자 이상 문자열 검색, 있는 것은 타입 코드 이름뿐). 모든 실패는 `{ok:false, reason, detail}`이고 문구 필드가 없다.
- 호출 수(가짜 LlmCaller로 확인): 성공 2, 검사 실패 1, 색 불만 아님(`false`) 1, 글 없음/공백 0, 던짐은 그 호출 시점에서 멈춤(1번 던짐 1회, 2번 던짐 2회). 재시도 없음, `console.*` 0회, 예외 없음(`complaints: null`도 `ok:false unknown_error`).
- `detail`: 던진 오류 메시지에 `SECRETMSG sk-ant-xxx 구매자글`을 넣어도 `unknown_error`/`llm_failed:*`/`llm_refused` 같은 고정 코드만 나옴.
- 역번역: ko·ja·de 각각 `backTranslationEn`이 있고 en은 null. 표식(`ZZENMARK`, `ZZFINDINGMARK`)을 영어 문구·finding에 넣었더니 역번역 호출의 system·user에 없음. 한국어 문구는 들어 있음. 역번역 결과에 숫자·빈 값·환불·보장이 있으면 `check_failed`(호출 2회).
- 입력 방어: 주입 문장과 `</buyer_messages>`는 `&lt;/buyer_messages&gt;`로 무력화되어 닫는 태그 1개(정상)만 존재, 시스템 프롬프트에 구매자 글 없음. `P123456789012`·이메일·전화는 system·user 모두에서 `⟦PCCC⟧·⟦EMAIL⟧·⟦PHONE⟧`로 바뀜(상품명·설명·사실 칸 포함). 2만 자 글 + 30개 → user 958자(10개·500자 상한 동작), 호출함. 빈 배열 → 0회. 배송 지연만 있는 글은 모델이 `false`를 주면 `no_color_issue` 1회.

## 표 1: 가짜 응답 → 결과 (`ok:false`면 거부)
| 문구 | 결과 |
|---|---|
| en `30%`, `2 shades` | 거부 (digits) |
| ko `11월 17일` | 거부 (digits·tokens·promise) |
| de `$5`, ja `五ドル`, en `five dollars` | 거부 (tokens 등) |
| ko `두 가지`, `두 단계` / ja `二段階` / de `zwei Nuancen` / en `two shades`, `three days`, `hundred percent`, `Twenty percent` | **통과** (수 낱말) |
| en `photos taken in daylight` / ko `자연광 사진에 가까워요` (knownFacts 없음) | **통과** (코드가 사실 근거를 보지 않음) |
| `⟦DATE_1⟧`, `{{offerAmount}}` | 거부 |
| en `free returns` | 거부 (effect_claim) |
| en `guaranteed`, `definitely` / ko `반드시` / de `Garantie` | 거부 (promise) |
| ko `환불` / ja `返金` / de `Rückerstattung` / en `exchange` | 거부 (commitment) |
| en `You will love it.`, `Order with no worries.` | **통과** |

"빈 초안과 비교" 검사(`checkTokens('', 글, [])`의 `newPromises`)는 영어 문구 자체에 있는 `guaranteed`·`definitely`를 잡는다. 지시서대로 `checkTokens(en, 번역, [])`만 쓰면 놓쳤을 구멍을 막았다.

## 반환 타입 판단
`{ok:true, finding, notes} | {ok:false, reason, detail}`은 결정 3("기본 문구 없음, 실패는 `ok:false`, S2는 숨김")과 맞는다. S2(T013 규칙 4, 8번 줄)에 필요한 것은 한국어 한 줄(`notes.ko.text`), EN·JA·DE와 `backTranslationEn`(펼침), 'AI suggests' 배지(`ok:true`일 때만), 없으면 숨김이다. 모자란 것 없음. `source` 필드가 없어져도 배지는 `ok`로 정한다. 계약(`types.ts`)에는 아직 없고 T013 후속 지시서에 적어야 한다(보고서가 이미 요청함).

## 발견한 문제
- 병합 차단: 없음.
- 병합 후 수정(실제 AI 시험 때 판매자 확인에 의존, 필요하면 후속):
  1. 수 낱말(`two`, `three`, `二`, `두 가지`, `zwei`, `hundred percent`, `Twenty percent`)이 네 언어와 영어 역번역 검사 모두에서 통과한다. SPEC은 "사실값은 쓰지 않는다"인데 숫자 글자만 막는다. 구현 보고서는 이를 "`literalFacts`가 잡는 꼴만 막힌다"로 적었지만 `two shades`·`hundred percent` 같은 흔한 꼴이 모두 빠진다는 점은 구체적이지 않다.
  2. 코드는 `knownFacts`/설명에 없는 상품 사실("photos taken in daylight")을 걸러내지 못한다. `knownFacts` 입력은 프롬프트에만 쓰이고 결과 검사에는 쓰이지 않는다. 결정 2의 "AI가 지어내지 않는다"는 프롬프트에만 의존한다. 구현 보고서는 "확인되지 않은 사실이 통과할 수 있다"고만 적었다.
  3. 효과·장담의 돌려 쓴 표현(`You will love it`, `Order with no worries`)은 통과. 구현 보고서가 인정한 한계와 같다.
- 기록만: (a) `return`이라는 낱말이 들어간 정상 문구("when you return to the page")도 effect_claim으로 거부(막는 쪽 오류, 보고서가 밝힘). (b) 아는 `Llm*Error`가 아닌 일반 `Error`는 `ai_unavailable/unknown_error`. (c) 모델이 `color_issue_found: true`로 거짓말하면(배송 지연만 있는 글) 코드는 못 막는다. 글 내용을 코드가 판정하지 않는다. (d) 역번역 검사는 영어 목록을 쓰므로 `back_*:commitment`로 한국어 문구의 숨은 약속을 한 겹 더 잡는다(확인됨).

## 구현 보고서 대조
- 주장 대부분 사실. 테스트 수(1631, 64), 호출 수, 고정 코드 `detail`, 역번역 격리, 주입·개인정보 방어 모두 확인됨.
- 과장·불충분: "확언 ... 숫자를 낱말로 쓴 것('three days', '세 번')도 `literalFacts`가 잡는 꼴만 막힌다" — 실제로는 `three days`, `two shades`, `hundred percent`, `二`, `두 가지`, `zwei` 모두 통과. "반대 방향 막는 쪽으로 틀린다"는 효과 낱말 목록에는 맞다.
- 지시서 완료 기준 중 "기본 문구 상수 검사"는 결정 3으로 삭제되어 해당 없음(정당).

## 확인하지 못한 것
- 실제 AI 품질(문구 자연스러움, 존댓말, 일본어·독일어 정확도, `LLM_MAX_TOKENS = 1024`에 네 언어가 들어가는지, 모델이 문구 끝 `!`나 세 문장을 쓰는 빈도)은 확인하지 못했다. 가짜 호출기만 썼다.
- 병합 뒤 실제 AI 시험, S2 화면 연결(ui 레인)은 범위 밖.
- `.env`를 열거나 만들지 않았다. 탐침 스크립트는 scratchpad의 `t020-verify/`에만 있다.
