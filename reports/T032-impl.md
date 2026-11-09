# T032 보고 (2026-11-10 01:25 KST)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄 `# SPEC v2.2 (2026-11-09 22:31 KST)` — 지시서의 기준 SPEC과 같음: 예)
- 브랜치 / 마지막 커밋: `lane/ai` / `1ee3c2d` (이 보고서 커밋은 그 뒤)
- 작업 폴더: `/Users/kaeng2/repositories/paypal-hackathon/afterloop-wt/ai` (`pwd` 확인)
- **실제 LLM 호출 없음.** 가짜 SDK 클라이언트와 가짜 `LlmCaller`만 쓴다. `.env`·API 키를 찾거나 읽지 않았다. 새 의존성 없음 (`package.json` 0줄)
- 같은 세션에서 먼저 한 T031 재시도와 파일을 섞지 않았다 (`src/ai/tokens.ts`는 건드리지 않았고, 커밋도 따로다)

## 결과
완료 — 필수 1·2·3·4와 권장 5·6을 모두 했다. 기존 57개 테스트는 기대값을 하나도 고치지 않고 통과한다 (classify 34 + llm 23 → 56 + 45 = 101개).

## 고친 내용

### 1. 기본 모델 `claude-opus-5-5` (필수)
- `DEFAULT_LLM_MODEL = 'claude-opus-5-5'` (날짜 접미사 없음). `LLM_MODEL`로 덮어쓰는 것은 그대로다.
- "표에 없다"는 주석을 지우고, 이 요청 모양이 이 모델과 맞는 이유를 한 줄로 적었다: `thinking`을 보내지 않음(생각을 끌 수 없고 `output_config.effort`로만 조절), `effort`를 명시(이 모델의 기본값은 `medium`), 강제 `tool_choice` 없이 구조화 출력, 거절은 `fallbacks: 'default'`가 서버에서 받음.
- 확인한 근거: 설치된 SDK(`@anthropic-ai/sdk` 1.6.0) `resources/messages/messages.d.ts:3910`의 `Model` 타입에 `'claude-opus-5-5'`가 있고, 같은 파일의 예제도 `model: 'claude-opus-5-5'`를 쓴다. (이 세션이 읽은 `claude-api` 스킬 번들은 2.1.278 / 모델 표 "cached: 2026-06-24" 판이어서 표에 `claude-opus-5-5`가 없었다. 지시서대로 `claude-opus-5-5`를 썼다 — 지시서가 "표에 없더라도 지시서가 맞다"고 못 박았고 SDK 타입 선언이 그것을 받친다.)

### 2. 개인통관고유부호 변형 표기 (필수)
- 정규식을 `P`/`p`/전각 `Ｐ`·`ｐ` + 숫자 12개(사이에 공백·`-`·`.` 한 자리 허용, 전각 숫자 포함)로 넓혔다. 구분 글자를 한 자리로 묶어 긴 입력에서도 역추적이 늘지 않는다.
- 가려지는 것(테스트 10가지): `P123456789012`, `p123456789012`, `P 1234 5678 9012`, `P1234-5678-9012`, `P-123456789012`, `P.123.456.789.012`, 전각 `Ｐ１２３４５６７８９０１２`, 섞인 꼴 `P1234 5678-9012`, `PCCC:P123456789012.`, 한글에 붙은 `부호P123456789012입니다`.
- 가리지 않는 것(테스트 6가지): `P1234567890123`(13자리), `123456789012`(숫자만), `IDP123456789012`(영문 바로 앞), 추적번호 `1Z999AA10123456784`·`EE123456789KR`, `1234567890`. 뒤에 숫자가 더 붙으면(구분 글자를 끼고 있어도) 부호로 보지 않는다.
- 가리는 자리: `system`·`user` 프롬프트(`sanitizeUntrusted`), `Cause.evidence`·`causeNote`(`classify.ts`의 `snippet`·`causeNoteOf`가 같은 가림을 거친다 — LLM이 근거로 되돌려 준 값도 한 번 더 가린다), 규칙 4의 `causeNote`, `llm.ts`의 로그 한 줄(아래).
- 로그: 로그 줄은 지금도 모델·effort·`stop_reason`·토큰 수뿐이지만, `createLlmCaller`가 로그 콜백을 가림 함수로 한 번 감싼다. 나중에 줄을 늘려도 부호·이메일·전화번호가 로그에 남지 않는다.

### 3. 제한 시간·재시도 (필수)
- 옵션 이름을 추측하지 않고 두 곳에서 확인했다: `claude-api` 스킬의 "Client config" 절("`timeout` default 10 min; TypeScript: **milliseconds**", "`max_retries`/`maxRetries` default 2")과 SDK의 `client.d.ts` `ClientOptions`(`timeout?: number` `@unit milliseconds`, `maxRetries?: number` `@default 2`).
- `new Anthropic({ apiKey, timeout, maxRetries })`. `LLM_TIMEOUT_MS`(기본 20000), `LLM_MAX_RETRIES`(기본 1). `readClientOptions(env)`를 내보내 단위 테스트가 값만 확인할 수 있게 했고, `deps.createClient`로 클라이언트를 만들 때 들어가는 옵션도 본다 (실제 클라이언트는 만들지 않는다).
- 잘못된 값(`-1`, `soon`, `20.5`, 제한 시간 `0`, 재시도 `-2`)은 **호출 없이** `LlmConfigError`다. 분류기는 이 오류를 재요청 없이 기본 유형으로 내려보낸다.
- 제한 시간에 걸리면 `APIConnectionTimeoutError`·`RequestTimeoutError`(408) → `LlmApiError('timeout')` → 분류기가 기본 유형 + `needsReview` (예외 없음).

### 4. 다시 묻지 않을 오류 (필수)
- 예외마다 `retryable`을 달았다. 분류기는 SDK를 끌어오지 않으려고 클래스가 아니라 이 속성(과 거절의 `name`)만 본다.
- `retryable: false` — `LlmConfigError`(키 없음·값 틀림), `LlmRefusalError`, `LlmApiError`의 `auth`(401)·`permission`(403)·`bad_request`(400).
- `retryable: true` — `rate_limit`(429), `server`(5xx), `connection`, `timeout`, `LlmResponseError`(깨진 JSON·텍스트 블록 없음·`max_tokens` 잘림), 그리고 종류를 알 수 없는 예외. 상태 코드가 500 이상이면 종류와 무관하게 다시 묻는다.
- 오류 종류를 늘렸다: `permission`(403, `PermissionDeniedError`), `server`(5xx, `InternalServerError`), `timeout`(`APIConnectionTimeoutError`·`RequestTimeoutError`). 하위 클래스를 먼저 보도록 순서를 잡았다.
- 호출 횟수 표(단위 테스트): 400·401·403·키 없음·거절 → **1회**, 429·500·연결 오류·제한 시간·스키마 위반·깨진 JSON → **2회**. 모든 경우 예외 없이 기본 유형 + `confidence: 0` + `needsReview: true` + `evidence: ['classifier_unavailable']`.

### 5. `causeNote`는 요약 (권장)
- `CAUSE_NOTE_MAX = 80`. 규칙 4(통관 보류)의 `causeNote`와 LLM이 보낸 `cause`를 모두 가림 + 한 줄 + 80자로 깎는다(넘치면 `…`). 근거(`evidence`)는 120자 그대로다.

### 6. 메시지 본문의 이메일·전화번호 (권장)
- `maskPersonal`이 `⟦EMAIL⟧`·`⟦PHONE⟧`까지 가린다. `sanitizeUntrusted`(프롬프트)와 `snippet`·`causeNoteOf`(화면·보고)가 모두 이 함수를 쓴다.
- 전화번호는 좁게 본다: `0`으로 시작하는 국내 표기(`010-1234-5678`, `01012345678`, `02-123-4567`)와 `+`로 시작하는 국제 표기(`+82 10 1234 5678`). 추적번호·10자리 숫자열·13자리 이상 숫자열·금액(`24,000원`)·날짜(`2026-11-17`)는 걸리지 않는다 (앞뒤 경계 + 자리수 상한).
- 주소는 모양으로 가릴 수 없어 하지 않았다 (아래 "남은 문제").
- 시스템 프롬프트의 "Personal data is already masked as …" 줄에 세 표기를 모두 적었다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/ai/llm.ts` | 기본 모델 `claude-opus-5-5` + 이유 주석, `LLM_TIMEOUT_MS`·`LLM_MAX_RETRIES`와 `readClientOptions`, `deps.createClient`, 예외의 `retryable`, 오류 종류 `permission`·`server`·`timeout` 추가, 로그 가림 (+130 / −26) |
| `src/ai/classify.ts` | `canRetry`로 재요청 정책 교체, `causeNoteOf`(80자), `maskPersonal` 사용 (+54 / −11) |
| `src/ai/prompts/classify.ts` | 부호 변형 정규식, `maskPersonal`(이메일·전화번호), 시스템 프롬프트의 가림 안내 한 줄 (+60 / −6) |
| `tests/unit/llm.test.ts` | T032 절 22개: 기본 모델 2, 제한 시간·재시도 10, 오류 종류·`retryable` 9, 로그 가림 1 |
| `tests/unit/classify.test.ts` | T032 절 22개: 부호 변형 10가지·부호 아닌 것 6가지, 이메일·전화번호, `causeNote` 80자, 오류 종류별 호출 횟수 11가지 |

지시서의 "수정 가능 폴더" 밖은 고치지 않았다. `src/ai/tokens.ts`·`src/types.ts`·`tests/acceptance/`·`config/`·`package.json`은 0줄이다 (`git show --stat 1ee3c2d`가 위 5개 파일뿐).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/unit/classify.test.ts tests/unit/llm.test.ts` | 101 | 0 | 기존 57 + 새 44. **기대값을 고친 기존 테스트 0건** |
| `npm test` | 878 | 0 | 18개 파일 |
| `npx tsc --noEmit` | — | 0 | 출력 없음, 종료 코드 0 |
| `npm run lint` | — | 0 | 출력 없음, 종료 코드 0 |
| `npx vitest run tests/acceptance --exclude '**/ac13*'` | 117 | 0 | `ac13`은 `.env`를 읽으므로 돌리지 않았다 (지시: `.env`를 찾지 않는다) |
| 실호출·네트워크 확인 | — | — | 두 테스트 파일에 `new Anthropic`·`fetch(`·URL 없음. 클라이언트를 주입하지 않는 테스트는 "키 없음" 예외까지만 간다 (`createLlmCaller({})`). 새 테스트는 `deps.client`·`deps.createClient`만 쓴다 |

**기본 모델 문자열이 바뀐 것은 정상이다** (지시서 1). 기존 테스트는 상수 `DEFAULT_LLM_MODEL`을 참조하고, 로그 테스트가 보는 `model=claude-opus-5`는 가짜 응답이 돌려준 값이라 영향이 없다.

## 남은 문제
- **`src/ai/tokens.ts`의 부호 정규식은 그대로다** (좁은 `P` + 숫자 12자리). 이번 변형 가림은 분류 프롬프트 쪽(`src/ai/prompts/classify.ts`)만 넓혔다. 지시서가 `tokens.ts`를 건드리지 말라고 해서다 — 전송본 검사(`checkTokens`)의 보고 문자열에는 `P 1234 5678 9012` 같은 변형이 아직 원문으로 남을 수 있다. 아래 결정 요청 1번.
- **주소는 가리지 않는다.** 구매자 메시지에 도로명·지번 주소가 있으면 그대로 LLM에 간다. 모양으로 가르기 어렵고(상품·색상 설명과 겹친다) 지시서도 하지 않기로 했다.
- **전화번호 가림은 좁다.** 구분 글자가 없는 국제 표기(`821012345678`)나 괄호를 쓴 꼴(`(02)123-4567`), 한글 섞인 꼴(`010에 1234`)은 걸리지 않는다. 넓히면 추적번호·주문번호를 가릴 위험이 커진다.
- **제한 시간의 최악 대기 시간은 80초다**: `timeout 20초 × (maxRetries 1 + 1) × 분류기 재요청 2회`. 화면이 분쟁 하나를 여는 동안으로는 아직 길다. 더 줄이려면 `.env`에서 `LLM_TIMEOUT_MS`를 내리거나 분류기 재요청을 끄는 결정이 필요하다 (아래 2번).
- **종류를 알 수 없는 예외는 다시 묻는다.** 지시서 4의 "다시 묻지 않을 오류" 목록(설정·401·403·400)에 없으므로 일시적 오류 쪽으로 뒀다. 이 선택 덕분에 기존 테스트("오류가 두 번 나도 예외 없이 기본 유형", 일반 `Error`로 호출 2회)의 기대값을 고치지 않았다.
- `max_tokens` 1024는 그대로다 (T006 검증 의견 2). 첫 실호출에서 `stop_reason=max_tokens`가 보이면 올려야 한다.
- 실호출로 200을 확인한 것은 아니다 (지시: 실호출 금지). `claude-opus-5-5`로 가는 첫 요청은 사람이 키를 넣은 뒤 확인해야 한다.

## 컨트롤 타워에 요청할 결정
1. **`src/ai/tokens.ts`의 부호 정규식도 변형까지 넓힐지.** 지금은 분류 프롬프트(`prompts/classify.ts`)만 `P 1234 5678 9012`·전각까지 가리고, 전송본 검사(`tokens.ts`)는 좁은 꼴만 가린다. 두 곳의 정의가 달라졌다 (T006 검증 "컨트롤 타워가 결정할 것" 5번과 같은 사안). 넓히려면 T031/T033 쪽 태스크로 지시서가 필요하다 — 이 세션은 지시서대로 건드리지 않았다.
2. **제한 시간 기본값과 분류기 재요청의 조합.** 사실: 최악 80초(20초 × 2 × 2). 선택지 — (가) 지금대로 (나) `LLM_TIMEOUT_MS`를 10000으로 내린다 (다) 분류기 재요청을 스키마 위반에만 두고 일시적 오류는 SDK 재시도에만 맡긴다.
3. **전화번호·이메일 가림의 범위.** 사실: 위 "남은 문제"의 걸리지 않는 꼴. SPEC 3장을 "모양으로 가릴 수 있는 것만 가린다"로 읽으면 지금이 맞고, 더 넓히면 주문번호·추적번호를 가릴 위험이 있다.
- 계약(`src/types.ts`)·인수 테스트·SPEC을 바꿔야 할 것은 **없다.** `Cause`·`LlmCaller`·`ClassifyFn`의 모양과 판정 기준은 그대로다 (`causeNote`는 길이만 짧아졌다).
