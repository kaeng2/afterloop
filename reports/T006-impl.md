# T006 보고 (2026-11-10 00:40)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `SPEC v2.2 (2026-11-09 22:31 KST)`)
- 브랜치 / 마지막 커밋: lane/ai / `3f70437`
- 작업 폴더: `/Users/kaeng2/repositories/paypal-hackathon/afterloop-wt/ai` (worktree 안에서 시작)
- **실제 LLM 호출: 없음.** `.env`·API 키를 찾지도 읽지도 않았다. 단위 테스트는 가짜 SDK 클라이언트만 쓰고 네트워크로 나가는 길이 없다. 환경 변수 값을 출력한 곳도 없다.
- `src/ai/tokens.ts`(T010·T031)는 건드리지 않았다. `src/paypal/mapper.ts`의 `toClassifyInput`은 읽기만 했다.
- `claude-api` 스킬을 먼저 읽고(TypeScript), 문서에 없던 모양(`fallbacks: 'default'`의 TS 타입, `output_config.format` 꼴, `BetaOutputConfig`)은 `node_modules/@anthropic-ai/sdk`의 `.d.ts`에서 확인했다. `package.json`은 고치지 않았다.

## 결과

완료 — `classifyDispute`(규칙 4개 + LLM 경로 + 실패 시 기본 유형)와 `createLlmCaller`(SDK 호출, 구조화 출력, 거절·오류 처리)를 구현하고 단위 테스트 57개를 넣었다. 지시서의 완료 기준 중 인수 테스트 AC16만 남았다 (아직 작성되지 않음).

핵심 동작:

1. **규칙 먼저** (`source: 'rule'`, `confidence: 1`, LLM 호출 0회) — 순서대로 ① `UNAUTHORISED` → E1 ② INR + 이전 미수령 ≥ `rules.abuse.minPriorInrDisputes` + 배송 완료 → F1 ③ INR + 추적 없음 → A1 ④ 추적 이벤트에 `customs hold`(대소문자 무시) → A2 + `causeNote`.
2. **LLM** (`source: 'llm'`) — 고정 시스템 프롬프트 + user 쪽 구분 태그, 구조화 출력 JSON 스키마로 받아 zod로 검증. 스키마에 없는 키(금액·확률·손실)는 zod가 버린다.
3. **실패** — 스키마 위반·오류면 **1회만** 다시 묻고, 그래도 안 되면 사유별 기본 유형 + `confidence: 0` + `needsReview: true` + `evidence: ['classifier_unavailable']`. 예외를 던지지 않는다. 거절(`LlmRefusalError`)은 같은 프롬프트를 다시 보내도 같은 결과이므로 재요청 없이 바로 기본 유형으로 내려간다 (호출 1회).
4. `confidence < rules.classification.minConfidence`(0.7)면 `needsReview: true`.
5. **개인정보** (SPEC 10장) — 프롬프트에 넣기 전에 구매자 메시지·추적 이벤트·사유의 `P`+숫자 12자리를 `⟦PCCC⟧`로 가린다. LLM이 돌려준 `evidence`·`cause`와 규칙이 만든 `causeNote`도 같은 가림을 거친다.

### LLM 호출 (`src/ai/llm.ts`)

| 항목 | 값 |
|---|---|
| 호출 | `client.beta.messages.create` (`@anthropic-ai/sdk` 1.6.0) |
| 기본 모델 | **`claude-opus-5`** (`LLM_MODEL`로 바꿈) — 지시서의 `claude-opus-5-5`를 쓰지 않은 이유는 아래 "컨트롤 타워에 요청할 결정" 1번 |
| 추론 깊이 | `output_config.effort`, 기본 **`low`** (`LLM_EFFORT`로 바꿈. 다섯 값 밖이면 호출하지 않고 예외) |
| 응답 형식 | `output_config.format = { type: 'json_schema', schema: req.jsonSchema }`. 어시스턴트 프리필 없음 |
| 서버 쪽 거절 대체 | **켰다.** `fallbacks: 'default'` + 베타 헤더 `server-side-fallback-2026-07-01` (스킬 문서 권장. 배열 꼴의 `-2026-06-01`과 섞으면 400) |
| 안 보내는 것 | `thinking`, `temperature`, `top_p`, `top_k`, `budget_tokens` (이 모델에서 400) |
| `max_tokens` | 1024 |
| 거절 | `stop_reason === 'refusal'`이면 `content`를 읽지 않고 `LlmRefusalError`(+`stop_details.category`) |
| 오류 | SDK 타입 예외를 좁은 것부터 구분해 `LlmApiError`의 `kind`(`auth`/`bad_request`/`rate_limit`/`connection`/`api`/`unknown`)로 접는다. 429·5xx는 SDK 기본 재시도(2회)에 맡기고 그 뒤 실패하면 예외 |
| 키 | `.env`의 `LLM_API_KEY`만 읽는다. 없으면 호출하지 않고 `LLM_API_KEY is not set` 예외. 키 값은 로그·예외 메시지에 싣지 않는다 |
| 로그 | `model` / `effort` / `stop_reason` / 토큰 수만. 프롬프트 전문·깨진 응답 본문은 남기지 않는다 |
| 프롬프트 캐시 | 고정 시스템 프롬프트만 `cache_control: { type: 'ephemeral' }`. 분쟁별 값은 user에만 |
| 서버 전용 | `typeof window !== 'undefined'`면 호출 거부 |

`createLlmCaller(env?, deps?)`는 **만들 때 아무것도 던지지 않는다**. 모델·effort·키는 호출할 때 읽고 틀리면 그 호출이 거부된다 — 분류기가 그 예외를 받아 기본 유형 + `needsReview`로 내려가므로 설정 실수로 화면이 멈추지 않는다. `deps.client`로 SDK 클라이언트를 주입할 수 있어 단위 테스트가 네트워크 없이 돈다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `src/ai/classify.ts` (새 파일) | `classifyDispute`: 규칙 4개 → LLM(1회 재요청) → 사유별 기본 유형. 기준값은 `config/rules.json`에서 읽고(zod로 필요한 두 값만 검증) 숫자 판정은 하지 않는다 |
| `src/ai/prompts/classify.ts` (새 파일) | 고정 시스템 프롬프트(16개 세부 유형 정의 + 출력 규칙 + 주입 방어), `buildClassifyUser`(구분 태그), 구조화 출력 JSON 스키마, `maskPccc`·각괄호 무력화 |
| `src/ai/llm.ts` (새 파일) | `createLlmCaller`, 예외 클래스 5개(`LlmError`·`LlmConfigError`·`LlmRefusalError`·`LlmApiError`·`LlmResponseError`) |
| `tests/unit/classify.test.ts` (새 파일) | 34개: 규칙 4건·규칙 순서·기준값 읽기·needsReview·숫자 필드 버리기·재요청 횟수·거절·사유별 기본 유형·프롬프트(고정 시스템, PCCC 가림, 주입) |
| `tests/unit/llm.test.ts` (새 파일) | 23개: 보낸 요청(모델·`output_config`·`fallbacks`·베타 헤더·금지 필드), 키 없음, 거절·깨진 JSON·텍스트 없음·길이 초과, SDK 예외 구분, 로그에 키·프롬프트 없음 |

`src/types.ts`·`tests/acceptance/`·`config/`·`seed/`·`src/engine/`·`src/paypal/`·`src/ai/tokens.ts`는 고치지 않았다.

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 119 (+9 skipped) | 0 | AC16은 아직 없음. skip 9개는 전부터 있던 샌드박스 실호출(AC13) |
| `npm test` | 794 | 0 | 그중 새 테스트 57개 (`classify` 34, `llm` 23) |
| `npx tsc --noEmit` | 오류 0 | — | |
| `npm run lint` | 오류 0 | — | |

## 지시서 완료 기준 대조

| 항목 | 결과 |
|---|---|
| D9 UNAUTHORISED → E1, D3 buyer_m(이전 2건·배송 완료) → F1, 추적 없는 INR → A1, 서연 D2 `Customs hold – recipient customs ID (PCCC) missing` → A2, 모두 LLM 호출 0회 | 통과 (`classify.test.ts` "규칙") |
| 지호 D1 색상 → mock B1 0.9 → `needsReview: false` | 통과 |
| mock 0.65 → `needsReview: true` | 통과 |
| 스키마 두 번 위반 → 호출 2회, 예외 없이 기본 유형 + `needsReview` | 통과 |
| 프롬프트에 `P123456789012` 없음 | 통과 (시스템·user 둘 다 확인) |
| 메시지 안의 지시가 규칙 분류를 바꾸지 못하고, LLM 경로에서는 구분 태그 안에만 들어간다 | 통과 (태그 닫기 시도도 `&lt;`로 막힌다) |
| `llm.ts` 단위 테스트 (가짜 SDK 클라이언트) | 통과 |
| 인수 테스트 AC16 | **미작성** (지시서대로 컨트롤 타워가 작성·승인 후 추가) |
| `npx tsc --noEmit` 자기 파일 오류 없음 | 통과 |

## 남은 문제

- **AC16 없음.** 지시서의 ⚠ 항목이라 체크 항목 + 단위 테스트까지만 했다. AC16이 들어오면 돌려 봐야 한다.
- 분류 정확도 평가는 범위 밖이다 (`package.json`에 `eval:classifier` 스크립트 자리는 있지만 T007 이후 작업이고 실호출이 필요하다).
- `causeNote`는 규칙 4번에서 **통관 보류 이벤트 한 줄**을 그대로 쓴다 (개인정보 가림 + 공백 정리 + 120자 제한). 지시서의 예 "PCCC missing"처럼 더 짧게 줄이려면 요약 규칙을 정해야 한다 — 코드로 요약하면 택배사 문구마다 다르게 깨지고, LLM에 맡기면 규칙 경로에서 LLM을 부르게 된다. 지금은 서연 D2에서 `Customs hold – recipient customs ID (PCCC) missing`이 그대로 들어간다.
- 가린 표기가 두 곳에서 다르다: 이 분류기는 `⟦PCCC⟧`(지시서 4번), `src/ai/tokens.ts`는 `P************`. 각자 쓰는 자리가 달라(프롬프트 vs 전송본 검사) 지금은 부딪히지 않지만, 화면에 둘 다 보일 수 있으면 하나로 맞추는 게 좋다.
- `export const classifyDispute: ClassifyFn = …` 꼴로 썼다 (지시서는 "export function"). `src/types.ts` 311~313줄과 `recommend`·`executeMove`·`checkTokens`가 모두 이 꼴이라 저장소 관례를 따랐다. 가져다 쓰는 쪽은 차이가 없다.

## 컨트롤 타워에 요청할 결정

1. **기본 모델 이름.** 지시서는 기본값을 `claude-opus-5-5`로 적었지만 그 ID는 `claude-api` 스킬의 모델 표(그리고 `shared/models.md`)에 없다. Opus 계열 현행 ID는 `claude-opus-5`이고, 스킬 문서는 "표에 있는 ID만 쓰고 만들어 붙이지 말라"를 못 박는다 (날짜 접미사도 금지). 지시서가 "스킬 문서에 나온 형태만 쓴다"고도 했으므로 **`claude-opus-5`를 기본값으로 두고** `LLM_MODEL`로 바꿀 수 있게 했다. `claude-opus-5-5`가 실제로 쓸 수 있는 ID라면 `.env`의 `LLM_MODEL`만 바꾸면 되고, 코드 기본값을 바꿀 거면 알려 주면 한 줄이다. 확인이 필요하다.
2. **표에 없는 사유 코드의 기본 유형.** 지시서는 6개 사유의 기본 유형만 정했다. 그 밖의 코드(예: 새 PayPal 사유)는 `B3` + `needsReview: true`로 뒀다 (SNAD 기본값과 같게). 다른 값이 맞으면 알려 주면 바꾼다.
3. **거절은 다시 묻지 않는다.** 지시서의 "1회만 다시 요청"은 스키마 위반에 대한 것이고, 거절은 같은 프롬프트로 다시 물어도 같은 거절이라 호출을 아끼려고 바로 기본 유형으로 내려간다 (호출 1회). 거절도 1회 재시도를 원하면 알려 주면 된다.
4. **AC16 작성 시 참고.** 규칙 경로는 LLM 호출 0회가 관찰 가능하다 (가짜 `LlmCaller`의 호출 횟수). 기본 유형·`needsReview`·`evidence: ['classifier_unavailable']`도 값으로 고정돼 있어 AC로 쓰기 좋다. 다만 LLM이 고른 `confidence` 값 자체는 mock이 정하는 값이므로 AC에서 특정 숫자를 기대하려면 mock 응답을 AC가 함께 정해야 한다.
