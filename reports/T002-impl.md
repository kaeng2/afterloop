# T002 보고 (2026-11-09 21:35)

- 기준 SPEC: v2.1 (시작할 때 SPEC.md 첫 줄과 같았는지: 예 — `# SPEC v2.1 (2026-11-09 21:02 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal-client / `2f54eda` (이 보고서 커밋은 그 뒤)
- 작업 폴더: `afterloop-wt/paypal-client` (worktree, `pwd` 확인)

## 결과
완료 — `createPayPalClient` 하나로 토큰 재사용·401 1회 갱신·429/5xx·네트워크 재시도·분당 30회 속도 제한·PayPal-Request-Id·샌드박스 전용·비밀값 비노출을 모두 처리한다. AC14 14개와 단위 테스트 22개가 모두 통과하고, 실제 PayPal 호출이나 실제 시간 대기는 없다 (`deps.fetch` / `deps.now` / `deps.sleep`만 사용).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/paypal/client.ts` (새 파일) | `createPayPalClient(env, deps)`. 토큰 발급·재사용, 401·429·5xx·네트워크 재시도, 60초 30회 속도 제한, POST 헤더·본문, 응답 파싱, 샌드박스 baseUrl 검사, 로그·에러 비밀값 가리기 |
| `tests/unit/client.test.ts` (새 파일) | 단위 테스트 22개. 가짜 `fetch`·`now`·`sleep`만 주입 |

수정 가능 폴더 밖은 건드리지 않았다 (`src/types.ts`, `tests/acceptance/`, `scripts/sandbox/`, `src/exec/`, `config/` 모두 그대로).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac14.client.test.ts` | 14 | 0 | 완료 기준 AC14 |
| `npm run test:acceptance` | 41 | 2 (+ 3 파일 수집 실패, 9 skip) | 모두 **다른 작업** 몫. 아래 참고 |
| `npm test` (tests/unit) | 88 | 0 | 이 중 `client.test.ts` 22개가 이번 작업 |
| `npx tsc --noEmit` | — | 3 | 모두 다른 작업의 미구현 모듈. 내 파일 오류 0 |
| `npx eslint src/paypal/client.ts tests/unit/client.test.ts` | — | 0 | |

이번 작업과 무관한 기존 실패 (건드리지 않음):
- `ac04.plan.test.ts` → `@/engine/plan` 없음 (T005)
- `ac07.escalation.test.ts` → `@/engine/escalation` 없음 (T006)
- `ac11-12.exec.test.ts` → `@/exec/execute` 없음 (T008)
- `ac13.sandbox.test.ts` 2건 → `.env.example` 없음 / `.gitignore` (T001)
- `npx tsc --noEmit`의 3개 오류는 위 세 모듈 부재와 같은 원인이다.

## 설계 메모 (지시서 표 ↔ 구현)
| 지시서 항목 | 구현 |
|---|---|
| 첫 호출 / 재사용 | `POST /v1/oauth2/token`(Basic, `grant_type=client_credentials`). `deps.now() < expiresAt - 60_000`이면 재사용 |
| 401 | 토큰을 버리고 1회만 새로 받아 같은 `init`(= 같은 요청 ID·본문)으로 재시도. 또 401이면 에러 |
| 429 | `Retry-After`초(숫자가 아니거나 없으면 30초) `deps.sleep` 후 재시도, 최대 2회 (호출 3회) → 에러 |
| 5xx·네트워크 | 2초 → 4초 후 재시도, 최대 2회 |
| 속도 제한 | 최근 60초 호출 시각을 담아 두고 30회를 넘으면 가장 오래된 호출이 창을 벗어날 때까지 `deps.sleep` |
| POST | `PayPal-Request-Id`, `Content-Type: application/json`. 재시도는 같은 `init`을 다시 보내므로 값이 같다 |
| 응답 | `{ status, body }`. 빈 본문 null, JSON이 아니면 원문 문자열 |
| baseUrl | `https://api-m.sandbox.paypal.com`만 허용 (끝 슬래시만 허용). 아니면 생성 시 에러, 호출 0회 |
| 비밀값 | 로그·에러 문구는 모두 `redact`를 지난다 (Secret, Basic 값, 받은 모든 액세스 토큰 → `[redacted]`). 요청·응답 본문은 로그에 남기지 않는다 (구매자 개인정보, SPEC 10장) |
| 시간 | `Date.now`·`setTimeout`·`setInterval`을 쓰지 않는다 (단위 테스트가 소스를 검사한다) |

지시서 표가 정하지 않아 **판단한 것 3가지** (계약 변경은 아니다. 다르게 원하면 알려주면 바꾼다):
1. **재시도를 다 쓴 5xx·네트워크 오류는 에러로 던진다** (429와 같은 처리). 표는 429만 "그래도 429면 에러"라고 적어 5xx 소진 후를 정하지 않았다. 호출한 쪽이 상태를 볼 수 있게 에러에 `status`(네트워크 오류는 `null`)와 `path`를 달아 둔다. 401·429·5xx가 아닌 상태(404·422 등)는 에러로 만들지 않고 `{ status, body }`로 그대로 돌려준다 — T008이 `ExecuteResult`로 옮길 수 있게.
2. **토큰 발급 호출도 60초 30회 창에 센다** (PayPal로 나가는 실제 호출이므로). AC14의 속도 제한 테스트는 세는 쪽·안 세는 쪽 모두 통과한다.
3. **POST의 `requestId`가 빈 문자열이면 호출 전에 거부한다** (중복 실행 방지 장치가 빠진 호출을 내보내지 않기 위해). 동기로 던지지 않고 거부된 Promise로 돌려준다.

속도 제한·재시도 간격·토큰 조기 갱신 시간은 SPEC 9-2에서 정한 기술 상수라 `src/paypal/client.ts` 맨 위 상수로 두었다 (`config/`는 가정값·정책 기준값·문구용이고 이 레인이 수정할 수 있는 폴더도 아니다).

## 남은 문제
- 실제 샌드박스 호출로 확인한 적은 없다 (`.env` 없음, 지시서 범위 밖). 토큰 응답 모양(`access_token`, `expires_in`)과 429 `Retry-After`가 실제와 같다고 가정했다. 첫 실호출은 T001/T003에서 확인된다.
- `Retry-After`가 HTTP 날짜 형식으로 오면 해석하지 않고 30초 대기로 떨어진다 (샌드박스는 초 단위로 보낸다고 가정).
- 분쟁 API 함수·mapper(T003), 실행 로직(T008), `scripts/sandbox/check.ts` 교체(T003)는 지시서대로 하지 않았다.
- 상위 폴더의 Python 실습 `paypal_client.py`는 worktree 밖이라 권한 제한으로 열지 못했다. 지시서 표만 기준으로 구현했다 (표가 기준이라고 적혀 있어 작업에 지장은 없었다).

## 컨트롤 타워에 요청할 결정
- 없음 (계약·인수 테스트·SPEC을 바꿀 필요가 없었다). 위 "판단한 것 3가지"만 확인해 주면 된다.

---

# 재시도 (2026-11-09 21:52 KST)

- 기준 SPEC: v2.1 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `# SPEC v2.1 (2026-11-09 21:02 KST)`)
- 작업 폴더: `afterloop-wt/paypal-client` (worktree, `pwd` 확인) / 브랜치 `lane/paypal-client`
- 커밋: `2543790` (코드·테스트) + 이 보고서 커밋
- 지시: 컨트롤 타워가 `reports/T002-verify.md`의 "발견한 문제" 1~3을 병합 전 수정으로 결정했고, 거기에 4~7을 더해 배분했다. 수정 범위는 `src/paypal/client.ts`와 `tests/unit/client.test.ts`뿐이고 그 밖은 건드리지 않았다 (`git status`로 확인: 두 파일만 변경).

## 고친 것

| # | 항목 | 바뀐 점 (`src/paypal/client.ts`) |
|---|---|---|
| 1 | [필수] 토큰 발급 단일화 | 진행 중인 발급을 `issuing` Promise 하나로 모은다 (`issueOnce`). 토큰이 없거나 만료 60초 안인 상태에서 동시 호출 N개가 들어오면 `/v1/oauth2/token`은 **1회**. 401을 동시에 받은 호출들도 `replaceToken(지금쓴토큰)`으로 같은 발급 하나를 기다린다. 이미 다른 호출이 새 토큰을 받아 뒀으면 발급하지 않고 그 토큰을 쓴다. 401 재시도는 `replaceToken`이 돌려준 토큰을 바로 쓰므로 한 번의 401에 발급은 1회뿐이다 (`expires_in`이 없는 토큰에서도 중복 발급이 없다) |
| 2 | [필수] path 검사 | `assertSafePath`를 `request` 맨 앞(= 토큰 발급·fetch보다 먼저)에서 부른다. 거부: 빈 값, `/`로 시작하지 않음, `//`로 시작, `://`(스킴) 포함, 공백·제어문자·역슬래시 포함. 그리고 `new URL(baseUrl + path).origin`이 샌드박스 origin과 다르면 거부한다. 쿼리 문자열이 붙은 정상 경로(`?page_size=10`)는 그대로 통과한다 (AC14가 쓰는 꼴) |
| 3 | [필수] 비밀값 비노출 | (a) 샌드박스 외 baseUrl 예외는 **고정 문구**로 바꿨다 (받은 값을 적지 않는다). (b) `fail()`이 사유를 `redact`하고 경로를 `labelPath`로 만든다: 비밀값 가리기 → 쿼리·프래그먼트 제거 → 제어문자 제거 → 120자 절단. 그래서 에러 `message`·`stack`과 열거 속성(`path`, `status`, `debugId`), 로그 줄이 모두 가려진 뒤에 만들어진다. 로그 라벨도 같은 `labelPath`를 쓴다. `cause`는 붙이지 않는다 |
| 4 | [필수] Retry-After | `^\d+$`(0 이상 10진 정수 초)만 받아들인다. 빈 값·공백·`-5`·`1.5`·`1e3`·`0x10`·`+5`·HTTP 날짜·`Infinity`는 모두 기본 30초. 상한은 상수 `RETRY_AFTER_MAX_MS = 60_000` |
| 5 | [필수] requestId | `trim()`이 빈 값(`''`, 공백, 탭·줄바꿈)이면 호출 전에 거부한다 (fetch 0회). 거부 에러도 `fail()`을 지나 경로의 쿼리·비밀값이 없다 |
| 6 | [권장] 5xx 소진 에러 | 마지막 응답에서 `debug_id`만 뽑아 에러 `message`와 `debugId` 속성에 싣는다 (본문이 JSON이고 문자열 `debug_id`가 있을 때만). 응답 본문 전체는 싣지 않는다 (JSON이 아니면 `debugId`는 null) |
| 7 | [권장] 버리는 본문 닫기 | `discardBody()`: 401·429·5xx로 버리는 응답과 토큰 발급 실패 응답의 `body.cancel`을 부른다 (`bodyUsed`가 아니고 `cancel`이 함수일 때만, 실패해도 흐름은 계속) |

유지한 것 (컨트롤 타워 결정대로 바꾸지 않았다): 검증 보고서 "컨트롤 타워가 결정할 것" (1) 5xx·네트워크 소진 시 에러 던지기, (2) 토큰 발급도 60초 30회 창에 세기, (4) baseUrl 끝 슬래시 허용, (6) 응답 `body`는 가공 없이 넘기기, (7) JSON이 아닌 본문은 원문 문자열, (8) 429와 5xx 재시도 횟수를 따로 세기. 의견 5a(시계를 옮기지 않는 가짜 `sleep`), 5c의 로그 경로(쿼리는 이제 뺀다), 5d(`redirect`·`AbortSignal`), 5e(`deps.log` 예외)는 지시에 없어 그대로 두었다.

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac14.client.test.ts` | 14 | 0 | 완료 기준 AC14, 그대로 통과 |
| `npm test` (tests/unit) | 152 | 0 | `client.test.ts` 22 → **86개** |
| `npm run test:acceptance` | 41 | 2 (+ 3 파일 수집 실패, 9 skip) | 재시도 전과 같다 (ac04·ac07·ac11-12 모듈 없음, ac13 2건 `.env.example`). 모두 다른 작업 몫 |
| `npx tsc --noEmit` | — | 3 | 재시도 전과 같은 TS2307 3개(`@/engine/plan`, `@/engine/escalation`, `@/exec/execute`). 내 파일 오류 0 |
| `npx eslint src/paypal/client.ts tests/unit/client.test.ts` | — | 0 | 종료 코드 0 |

추가한 단위 테스트 64개 (모두 가짜 `fetch`·`now`·`sleep`만. 실제 네트워크·실제 대기 없음):
- 동시 호출: 토큰 없는 상태 동시 5개 → 발급 1회 / 동시 20개 → 1회 / 만료 뒤 동시 5개 → 추가 1회(합계 2) / 동시에 401 5개 → 합계 2회, 10회 호출 모두 성공하고 재시도는 새 토큰 사용
- path 검사: 잘못된 13종(빈 값, `v1/…`, `.evil.example/…`, `:8443/…`, `@evil.example/…`, `//…`, 절대 URL, 경로 안 스킴, 역슬래시, 공백, 줄바꿈, 탭, NUL)을 GET·POST 각각 → 거부 + `fetch` 0회 + 토큰 발급 0회. 정상 경로·쿼리는 통과
- 비밀값: 샌드박스 외 baseUrl 4종(Secret·Basic이 섞인 값)의 예외 문구에 받은 값·비밀값 없음 / path에 액세스 토큰·Secret이 들어간 경우 / 거부된 path / 쿼리 제거(`err.path === '/v1/customer/disputes'`, `buyer=` 없음) / 빈 requestId 에러. 검사 표면은 `message`·`String(err)`·`stack`·`JSON.stringify({...err})`·`cause`·열거 속성 값 전부 + 로그
- Retry-After: 기본 30초로 떨어지는 11종, 그대로 기다리는 `0`·`3`·`60`, 상한으로 깎이는 `61`·`86400`·초대형 값
- requestId: `''`·공백·탭/줄바꿈 거부(fetch 0회), 값이 있으면 전송
- 5xx 소진 에러: `debug_id` 싣기, 본문의 다른 필드(`INTERNAL_SERVER_ERROR`, 구매자 식별값)는 안 싣기, JSON 아님·`debug_id` 없음 → null
- 버리는 응답 본문 닫기: 401·429·503 응답의 `cancel` 1회씩, 본문을 읽은 200 응답은 닫지 않음 (가짜 응답 객체로 확인)

처음 쓴 새 테스트 2개의 기대값이 틀려 바로잡았다 (구현을 고친 것이 아니다): 헤더 값 양끝 공백은 전송 규칙대로 다듬어지므로 `' unit-plan:send-message '` → `'unit-plan:send-message'`로 기대하도록, 그리고 토큰 워밍업 호출에 200을 먼저 주도록 가짜 응답 순서를 고쳤다. **기존 22개 테스트의 기대값은 하나도 바꾸지 않았다.**

## 남은 문제
- 실제 샌드박스 호출로 확인한 적은 여전히 없다 (`.env`를 찾거나 읽지 않았다). `debug_id` 필드 이름과 `Retry-After`가 초 단위라는 가정은 그대로다. 첫 실호출은 T001/T003에서 확인된다.
- 가짜 `sleep`이 `deps.now`를 옮기지 않으면 30번째 호출에서 `waitForSlot`이 끝없이 돈다 (검증 보고서 의견 5a). 지시에 없어 그대로 두었다. 뒤 작업의 테스트는 `sleep`이 시계를 옮기게 만들어야 한다.
- `redirect: 'manual'`과 요청 시간 제한(`AbortSignal`)은 넣지 않았다 (의견 5d, 지시 범위 밖).

## 컨트롤 타워에 요청할 결정
- 없음 (계약·`src/types.ts`·인수 테스트·SPEC을 바꾸지 않았다).
