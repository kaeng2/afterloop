# T002 검증 (2026-11-09 21:38 KST)
- 판정: **통과** (병합 차단 문제 없음. 병합 후 수정 4건, 컨트롤 타워 결정 8건)
- 검증 대상: lane/paypal-client `b8b90f2` (구현 커밋 `2f54eda`) · 기준 SPEC v2.1 (`SPEC.md` 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)` 확인)
- 판정 근거 한 줄: AC14 14/14, 지시서 동작 표 10행 모두 일치, 범위 밖 수정 0, 계약에 맞는 입력(`/`로 시작하는 path, 올바른 baseUrl)에서는 로그·에러·반환값에 비밀값 노출 0건.
- **판정이 바뀔 수 있는 조건**: 아래 문제 2·3(계약 밖 입력에서 Secret·토큰이 에러 문구에 실리거나 토큰이 다른 호스트로 나가는 경로)을 컨트롤 타워가 "비밀값 노출"로 보면 판정은 실패다. 나는 "지금 그런 입력을 만드는 호출자가 없고 지시서 표에 조항이 없다"는 이유로 병합 후 수정으로 분류했다.
- 검증 방법: 코드·설정·테스트는 고치지 않았다. 실제 PayPal 호출 없음 (가짜 `fetch`·`now`·`sleep`만 주입, 전역 `fetch`는 불리면 실패하도록 막아 두고 0회 확인). 구현 보고서(`reports/T002-impl.md`)는 독립 판단을 마친 뒤에 읽었다.
- 임시 스크립트 (worktree 밖): `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T002/scenarios.ts`, `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T002/scenarios2.ts`

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-status main...HEAD` | — | — | 추가 3개뿐: `src/paypal/client.ts`, `tests/unit/client.test.ts`, `reports/T002-impl.md`. 모두 지시서 범위 안 |
| `git diff main...HEAD -- package.json package-lock.json src/types.ts tests/acceptance SPEC.md config` | — | — | 출력 0줄. 계약 파일·의존성 변경 없음 |
| `git rev-list --left-right --count main...HEAD` | — | — | `2 2`. 레인이 2개 앞이고 **main도 2개 앞** (`c3af7e7`, `83a159b`: `TASKS.md`, `tasks/T001·T005·T007·T018.md`만 변경, 레인 파일과 겹치지 않음) |
| `npx vitest run tests/acceptance/ac14.client.test.ts` | 14 | 0 | 완료 기준 충족 |
| `npm test` | 88 | 0 | 4개 파일. `tests/unit/client.test.ts` 22개 포함, 28ms |
| `npx tsc --noEmit` | — | 3 | 모두 TS2307 (`@/engine/plan`, `@/engine/escalation`, `@/exec/execute` 없음, 다른 레인). `src/paypal/`, `tests/unit/client.test.ts` 오류 0 |
| `npm run test:acceptance` | 41 | 2 | 9 skip. 파일 4개 실패: ac04·ac07·ac11-12는 모듈 없음(수집 실패), ac13 2건은 `.env.example` 없음 (T001). **모두 범위 밖**, AC14는 14/14 |
| `npx eslint src/paypal/client.ts tests/unit/client.test.ts` | — | 0 | 종료 코드 0 |
| `npx tsx …/verify-T002/scenarios.ts` (독립 시나리오) | 88 | 15 | 정보성 13. 실패 15건 분류: 실제 발견 14건(문제 1~5에 정리) + 내 가짜 시계 탓 1건(5f, 아래 scenarios2에서 정상 확인) |
| `npx tsx …/verify-T002/scenarios2.ts` (가상 타이머 동시성, URL 해석) | — | — | 속도 제한은 동시 호출에서도 60초 창 최대 30회. 토큰 중복 발급 재현 |

구현 보고서의 테스트 숫자(14 / 41·2·9 skip / 88 / tsc 3 / eslint 0)는 내가 돌린 결과와 같다.

## 독립 시나리오
가짜 Secret `VERIFY-FAKE-SECRET-do-not-leak-zzzz`, 가짜 토큰 `VERIFY-FAKE-TOKEN-…` 4개로 확인했다. "토큰"은 `/v1/oauth2/token` 호출 수, "api"는 그 밖의 호출 수.

| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 40분 동안 GET 5회 | 토큰 1회 | 토큰 1, api 5 | 예 |
| 토큰 발급 요청 꼴 | POST, Basic, client_credentials | POST, `Basic base64(id:secret)`, `application/x-www-form-urlencoded`, `grant_type=client_credentials` | 예 |
| 만료 60초 1ms 전 / 정확히 60초 전 | 재사용 / 재발급 | 토큰 1 / 토큰 2, 새 토큰으로 호출 | 예 |
| 만료 뒤 호출 | 재발급 | 토큰 2 | 예 |
| **동시 GET 5개 (토큰 없는 상태)** | 토큰 1회 | **토큰 5회** (가상 타이머로도 5회. 동시 31개 → 31회, 100개 → 100회) | **아니오** (문제 1) |
| 동시 GET 5개 (토큰 있는 상태) | 추가 발급 0 | 0 | 예 |
| 동시 GET 5개가 모두 401 | 갱신 1회가 이상적 | 갱신 5회, 모두 성공 | 해석 필요 (문제 1) |
| 401 → 200 | 갱신 1회, 대기 없음 | 토큰 2, api 2, sleep 0회 | 예 |
| 401 계속 | 에러, 무한 루프 없음 | 에러(status 401), 토큰 2, api 2 | 예 |
| 401로 실패한 뒤 다음 호출 | 정상 | 정상 (상태 안 망가짐) | 예 |
| 토큰 엔드포인트가 401 | 에러, api 0 | 에러, 토큰 1, api 0 | 예 |
| 429 `Retry-After: 3` / 없음 | 3000ms / 30000ms | 3000 / 30000 | 예 |
| 429 `Retry-After` 이상한 값: `abc`, `-5`, HTTP 날짜, `Infinity` | 30000ms | 모두 30000 | 예 |
| 429 `Retry-After: ""` (빈 값) | 30000ms ("없으면 30초") | **0ms** (바로 재시도) | 아니오 (문제 4) |
| 429 `Retry-After`: `1.5` / `0` / `1e3` / `0x10` / `86400` | (조항 없음) | 1500 / 0 / 1,000,000 / 16,000 / 86,400,000ms. 상한 없음 | 해석 필요 (문제 4) |
| 429 계속 (`Retry-After: 7`) | 재시도 2회 뒤 에러 | api 3, sleep [7000, 7000], 에러(status 429) | 예 |
| 토큰 엔드포인트 429 → 200 | 대기 후 발급 | sleep [2000], 토큰 2, api 1 | 예 |
| 500·502·503·504·599 계속 | api 3, sleep [2000, 4000] | 모두 api 3, sleep [2000, 4000], 그 뒤 **에러**(status 포함, 응답 본문은 버림) | 예 (소진 뒤 처리는 결정 1) |
| 503, 503, 200 | 성공 | 성공, sleep [2000, 4000] | 예 |
| 네트워크 예외 계속 / 1회 뒤 200 | api 3 뒤 에러 / 성공 | api 3, sleep [2000, 4000], 에러(status null) / sleep [2000] 성공 | 예 |
| 429·503이 번갈아 계속 | (조항: 종류별 최대 2회) | api 5회 (재시도 합계 4회) 뒤 에러 | 해석 필요 (결정 8) |
| 503·401이 번갈아 계속 | 유한 횟수 뒤 에러 | api 4, 토큰 2 뒤 에러 | 예 |
| 400·403·404·422 | 재시도 없이 `{status, body}` | 각각 api 1회, 그대로 반환 | 예 |
| 빈 본문(204) / 공백만 / JSON 아님 | null / null / (조항 없음) | null / null / 원문 문자열 그대로 | 예 (JSON 아님은 결정 7) |
| 순차 GET 31회 | 31번째가 `deps.sleep`으로 대기 | **30번째 GET**에서 sleep 60000 1회 (토큰 발급도 창에 세기 때문). api[30]−api[0] = 60000 | 예 (결정 2) |
| 순차 GET 100회, 임의의 60초 창 | fetch ≤ 30 | 최대 30 (토큰 포함), sleep 3회 합 180초 | 예 |
| 30자리 쓴 뒤 60초 지나고 30회 더 | 대기 없음 | sleep 0회 | 예 |
| 토큰 있는 상태에서 동시 GET 45회 (가상 타이머) | 창 안 fetch ≤ 30 | 최대 30, 가상 경과 60초 | 예 |
| `sleep`이 시계를 옮기지 않는 가짜일 때 30번째 GET | (조항 없음) | `sleep`을 끝없이 부른다 (1000회에서 내 보호 장치로 중단) | 해석 필요 (문제 5) |
| POST: 503 → 429 → 네트워크 예외 → 401 → 201 | 5회 모두 같은 Request-Id·본문 | 5회 모두 `PayPal-Request-Id` 같음, 본문 같음, `Content-Type: application/json`, URL 같음 | 예 |
| 토큰 발급 호출의 Request-Id | 없음 | 없음 | 예 |
| GET | Request-Id·Content-Type·body 없음 | 없음, method GET | 예 |
| `requestId: ''` / `'   '` | (조항 없음) | 거부(비동기, fetch 0회) / 공백만은 통과 | 해석 필요 (결정 3) |
| baseUrl 21종: `https://api-m.paypal.com`, `http://api-m.sandbox.paypal.com`, `https://api-m.sandbox.paypal.com.evil.example`, `…/v1`, `…:443`, `…:8443`, `…@evil.example`, `https://evil.example/https://api-m.sandbox…`, `?x=1`, `#x`, 앞 공백, 끝 줄바꿈, 대문자, 스킴 없음, `''` 등 | 만들 때 예외, fetch 0회 | 21종 모두 예외, fetch 0회 | 예 |
| baseUrl `undefined` | 예외, fetch 0회 | 예외(TypeError), fetch 0회 | 예 |
| baseUrl 끝 슬래시 `…com/`, `…com///` | 지시서 문언대로면 예외 | **허용**. 실제 호출 URL은 `https://api-m.sandbox.paypal.com/v1/…` (호스트 같음) | 해석 필요 (결정 4) |
| 올바른 baseUrl로 만들기만 | fetch 0회 | 0회 | 예 |
| path `//evil.example/steal`, `/\evil.example/steal`, `/v1/../../steal`, `/%2F%2Fevil.example` | 다른 호스트로 안 나감 | 모두 호스트 `api-m.sandbox.paypal.com` (`new Request(url)`로 해석 확인) | 예 |
| path `https://evil.example/steal` (절대 URL) | 거부 또는 같은 호스트 | 거부하지 않음. `https://api-m.sandbox.paypal.comhttps://evil.example/steal`로 fetch → 호스트 `api-m.sandbox.paypal.comhttps` (evil.example은 아니지만 샌드박스도 아님), Bearer 헤더 포함 | **아니오** (문제 2) |
| path `.evil.example/steal`, `:8443/steal`, `v1/customer/disputes` (`/`로 시작하지 않음) | 거부 | 거부하지 않음. 호스트가 `api-m.sandbox.paypal.com.evil.example` / `…com:8443` / `…comv1`로 바뀌고 Bearer 토큰이 실린다 | **아니오** (문제 2) |
| path `@evil.example/steal` | 거부 | 클라이언트는 거부하지 않음 (가짜 fetch에는 Bearer와 함께 전달). 실제 `Request`는 userinfo URL을 TypeError로 거부하므로 전송은 안 됨 | 아니오 (문제 2) |
| 비밀값: 정상 GET·POST의 로그·반환값 | 없음 | 없음 | 예 |
| 비밀값: 토큰 발급 401·400·500 계속·429 계속·access_token 없음·JSON 아님 (본문이 Secret·Basic·토큰을 되돌려줌) | 없음 | 로그, 에러 message·stack·cause·열거 속성·비열거 속성 모두 없음 | 예 |
| 비밀값: 토큰 발급 네트워크 예외 (예외 message·cause·속성에 Basic·Secret) | 없음 | 없음 (message는 `[redacted]`, cause는 붙이지 않음) | 예 |
| 비밀값: API 401 계속·429 계속·500 계속 (본문이 토큰을 되돌려줌) | 없음 | 없음 (본문을 읽지 않고 버림) | 예 |
| 비밀값: API 네트워크 예외 (message·cause·속성·문자열 예외에 Bearer 토큰), 401 뒤 두 번째 토큰 포함 | 없음 | 없음 | 예 |
| 비밀값: 속도 제한 대기 로그, 빈 requestId 에러, 샌드박스 외 baseUrl 에러 | 없음 | 없음 | 예 |
| 비밀값: 클라이언트 객체 속성·함수 소스 | 없음 | 속성은 `call`, `get`뿐, 없음 | 예 |
| 비밀값: API 200·400·403 **응답 본문**이 Secret·Basic·토큰을 되돌려줄 때 **반환값** | 없음 | 반환 `body`에 그대로 들어 있다 (본문은 가공 없이 넘김). 로그에는 없음 | 해석 필요 (결정 6) |
| 비밀값: baseUrl 값 안에 Secret이 들어 있을 때 (`.env`에서 줄을 바꿔 넣음, 또는 `https://id:secret@api-m…`) | 없음 | **생성 예외 message에 Secret이 그대로** ("받은 값: …") | **아니오** (문제 3) |
| 비밀값: path 안에 토큰이 들어 있을 때 | 없음 | 로그는 `[redacted]`, **에러 message·`path` 속성에는 그대로** | 아니오 (문제 3) |
| `log` 미주입 / `log`가 예외를 던짐 | 동작 / (조항 없음) | 동작 / 호출이 실패한다 | 예 / 의견 |
| 실제 타이머·시계·전역 fetch | 0회 | `client.ts`에서 `setTimeout` 0, `Date.now` 0, 전역 `fetch` 0. 전체 시나리오 116개가 32ms에 끝남 | 예 |
| 서버 전용 | `'use client'` 없음, 브라우저 전역 없음 | 없음. `window`·`document`·`localStorage`·`process.env`·`console` 사용 없음 (`Buffer`, 없으면 `btoa`만 사용). `src/app/`에서 import하는 곳 없음 | 예 |

## SPEC·지시서 대조
| 조항 | 판정 | 근거 |
|---|---|---|
| 지시서: 수정 가능 폴더 (`src/paypal/client.ts`, `tests/unit/client.test.ts`) | 일치 | `git diff --name-status main...HEAD` 추가 3개 (보고서 포함) |
| 지시서: 공개 함수 `createPayPalClient` (`CreatePayPalClientFn`) | 일치 | `src/paypal/client.ts:90`, 타입 고정 `:281` |
| 지시서: 시간·대기는 `deps.now`·`deps.sleep`만 | 일치 | `client.ts:124, 132, 158, 169, 180, 220, 227`. 소스에 `Date.now(`·`setTimeout(` 없음, 실행 중 감시로도 0회 |
| 지시서 표: 첫 호출 토큰 발급 (Basic, client_credentials) | 일치 | `client.ts:191-204` |
| 지시서 표: 만료 60초 전까지 재사용 | 일치 (순차 호출). 동시 호출은 해석 필요 | `client.ts:226-229`. 동시 호출 중복 발급은 문제 1 |
| 지시서 표: 401 → 1회 갱신, 또 401이면 에러 | 일치 | `client.ts:252-260` |
| 지시서 표: 429 → `Retry-After`초(없으면 30초), 최대 2회, 그래도면 에러 | 일치 (빈 값 헤더는 문제 4) | `client.ts:76-82, 162-171` |
| 지시서 표: 5xx·네트워크 → 2초 → 4초, 최대 2회 | 일치. 소진 뒤 처리는 해석 필요 | `client.ts:38, 151-160, 173-182` (결정 1) |
| 지시서 표: 최근 60초 30회 초과 시 `deps.sleep` | 일치 (토큰 발급 포함이라 더 엄격) | `client.ts:122-134` (결정 2) |
| 지시서 표: POST에 `PayPal-Request-Id`·`Content-Type`, 재시도에 같은 값 | 일치 | `client.ts:244-248`, 같은 `init` 재전송 `:141-186` |
| 지시서 표: 응답 `{status, body}`, JSON 파싱, 빈 본문 null | 일치. JSON 아닌 본문은 해석 필요 | `client.ts:65-73, 262-264` (결정 7) |
| 지시서 표: baseUrl이 샌드박스가 아니면 만들 때 에러 (호출 0회) | 일치. 끝 슬래시 허용은 해석 필요 | `client.ts:91-94` (결정 4) |
| 지시서 표: 로그·에러 메시지에 Secret·토큰·Authorization 값 없음 | 일치 (계약에 맞는 입력). 계약 밖 입력은 불일치 | `client.ts:99-116`. 예외 경로: `:93` (baseUrl 원문), `:51, :115` (path는 가리지 않음) → 문제 3 |
| 지시서: polling 루프 없음 | 일치 | 반복문은 재시도·속도 제한 대기뿐 (`:123, :145, :236`), 모두 횟수가 유한 |
| 지시서: 서버 코드 전용 | 일치 | `'use client'` 없음, AC14 "프론트 코드…" 테스트 통과 |
| 지시서 완료 기준: AC14 14개, `npm test`, tsc 자기 파일 오류 없음 | 일치 | 위 "실행한 명령" |
| 지시서: 하지 않을 것 (분쟁 API·mapper, check.ts, 실행 로직, 실호출) | 일치 | 해당 파일 변경 없음, 네트워크 코드 경로는 `deps.fetch`뿐 (`:150`) |
| SPEC 9-2: 토큰 재사용, 401 1회 갱신, 429·5xx 재시도, 분당 30회, PayPal-Request-Id, 샌드박스만, 비밀값 비노출, 서버 전용 | 일치 | 위 행들과 같음 |
| SPEC 3장: 생성과 판정 분리 (숫자 계산·판정은 엔진) | 일치 (해당 없음) | 클라이언트는 금액·확률을 계산하지 않고 본문을 그대로 전송 (`:247`) |
| SPEC 10장: 개인정보를 앱 로그에 넣지 않음 | 일치 | 요청·응답 본문을 로그에 쓰지 않음 (`:157, :168, :179, :221, :258, :263`은 메서드·경로·상태·횟수만). path는 로그에 실림 (의견 c) |
| CLAUDE.md: 가정값·정책값은 `config/`에서 | 해석 필요 | 60초·30회·2초·4초·30초·60초 상수가 `client.ts:24-41`에 있다. 지시서가 값을 직접 정했고 `config/`는 이 레인 수정 범위 밖이라 구현자 설명이 타당해 보인다 |
| `src/types.ts` 4부 계약 | 일치 | 변경 없음. `call`·`get` 시그니처 일치, `tsc` 자기 파일 오류 0 |

## 발견한 문제
1. **[병합 후 수정] 동시 호출이 토큰 발급을 중복한다.** 토큰이 없거나 만료된 상태에서 `Promise.all`로 N개를 부르면 `/v1/oauth2/token`을 N번 부른다 (5개 → 5회, 100개 → 100회). 동시에 401을 받은 호출 5개도 각자 갱신한다 (5회). 진행 중인 발급을 공유하지 않기 때문 (`client.ts:226-229`, `:257`). 결과는 모두 성공이고 60초 30회 창은 지켜지지만(최대 30 확인), 토큰 호출이 창의 자리를 먹어 대기가 길어진다 (동시 31개: 가상 120초). 보드가 분쟁 목록·상세를 동시에 부르면 바로 나타날 상황이다. AC14·지시서 표에는 동시 호출 조항이 없다.
2. **[병합 후 수정] `get`/`call`의 path를 검사하지 않는다.** `${baseUrl}${path}`를 그대로 이어 붙인다 (`client.ts:150`). path가 `/`로 시작하지 않으면 호스트가 바뀌고 Bearer 토큰이 함께 나간다: `.evil.example/x` → `api-m.sandbox.paypal.com.evil.example`, `:8443/x` → 다른 포트, `v1/…`(슬래시 빠뜨림) → `api-m.sandbox.paypal.comv1`, 절대 URL → `api-m.sandbox.paypal.comhttps`. `//host`와 `/`로 시작하는 path는 안전하다 (호스트 그대로). 지금은 이 클라이언트를 부르는 코드가 없고 계약 주석이 "baseUrl 뒤에 붙는 경로 (예: /v1/customer/disputes)"라서 현재 도달 경로는 없다. 다만 "샌드박스만"을 한 곳에서 강제한다는 목표에는 구멍이다 (path가 `/`로 시작하는지 한 줄 검사로 막힌다).
3. **[병합 후 수정] 계약 밖 입력에서 에러 문구가 가려지지 않는다.** (a) 샌드박스 외 baseUrl 예외가 받은 값을 그대로 적는다 (`client.ts:93`, `redact` 정의 전). `.env`에서 Secret을 `PAYPAL_BASE_URL` 줄에 잘못 붙이거나 baseUrl에 `id:secret@`을 넣으면 Secret이 예외 message에 나온다 (재현함). (b) `PayPalCallError`의 message와 `path` 속성은 path를 가리지 않는다 (`:51, :115`. 로그 줄은 가린다). 구현 보고서의 "로그·에러 문구는 모두 `redact`를 지난다"는 이 두 곳에서 사실과 다르다. 올바른 설정과 일반 path에서는 노출이 없다.
4. **[의견] `Retry-After` 경계값.** 빈 값 헤더는 0ms로 해석되어 바로 재시도한다 (`Number('')`이 0, `client.ts:79`). 지시서의 "없으면 30초"와 어긋난다. `1e3`·`0x10` 같은 표기도 숫자로 받아들이고, 상한이 없어 `86400`이면 24시간을 `deps.sleep`으로 기다린다.
5. **[의견] 그 밖.**
   a. `deps.sleep`이 시계(`deps.now`)를 옮기지 않는 가짜면 30번째 호출에서 `waitForSlot`이 끝없이 돈다 (`client.ts:123-133`). 뒤 작업(T003·T008·T026) 테스트가 `sleep: async () => {}`와 고정 시계를 쓰면 테스트가 멈춘다. 계약(`ClientDeps`)에는 맞는 동작이다.
   b. 재시도로 버리는 응답(401·429·5xx)의 본문을 읽거나 닫지 않는다 (`bodyUsed: false` 확인). 실제 fetch에서는 연결이 잠시 붙잡힐 수 있다.
   c. 로그와 에러에 path(쿼리 포함)가 실린다. 호출자가 쿼리에 구매자 식별값을 넣으면 로그에 남는다.
   d. `redirect` 옵션을 정하지 않아 기본값(follow)이고, 요청 시간 제한(AbortSignal)이 없다. 가짜 fetch로는 확인할 수 없어 코드만 읽고 적는다.
   e. `deps.log`가 예외를 던지면 PayPal 호출 자체가 실패한다.
   f. 5xx 소진 에러가 응답 본문을 버려 PayPal `debug_id`를 볼 수 없다 (결정 1과 연결).
6. **[의견] 단위 테스트의 질.** 22개 모두 가짜 `fetch`·`now`·`sleep`만 쓰고 실제 대기·네트워크가 없다 (28ms). AC14와 겹치지 않는 세부(빈 본문, GET 헤더, 네트워크 오류, 토큰 5xx, 창 해제, 본문 비로그)를 본다. 빠진 경계: 동시 호출(문제 1), path 검사(문제 2), 생성 예외 문구의 비밀값(문제 3), 만료 정확히 60초 전, 429·5xx 혼합, 빈·과대 `Retry-After`, 재시도가 창에 세어지는지, 에러의 `stack`·`cause` 검색. 비밀값 테스트는 message·`String(err)`·열거 속성만 본다. "Date.now·setTimeout을 직접 부르지 않는다"는 소스 문자열 검색이라 다른 이름으로 부르면 놓친다 (실행 감시로는 0회였다).
7. **[참고] 문서 표기.** 잠금 파일 `tests/acceptance/ac14.client.test.ts:4`의 "기준: SPEC v1.1 5-1장"은 지금 SPEC에서는 9-2장이다 (동작과 무관). 구현 보고서 제목 시각(21:35)이 보고서 커밋 시각(21:31)보다 늦다.

병합 차단 문제: **없음.**

## 컨트롤 타워가 결정할 것
구현자가 스스로 정한 것 3가지(1~3)와 검증에서 나온 것(4~8). 모두 AC14·`src/types.ts`와는 충돌하지 않는다. 지시서 문언과 다르게 읽힐 수 있는 것은 4·7이다.

1. **재시도를 다 쓴 5xx·네트워크 오류**: 지시서는 429만 "에러"라고 적었다. 구현은 에러를 던진다 (status·path 포함, 응답 본문은 버림). 선택지: (가) 그대로 둔다. T008이 예외를 잡아 `ExecuteResult { ok: false }`로 바꿔야 한다 (AC11-12는 `call`이 던지는 경우를 다루지 않는다). (나) 5xx는 `{status, body}`로 돌려주고 네트워크 오류만 던진다 (`debug_id`가 남는다). (다) 그대로 두되 에러에 PayPal `debug_id`만 싣는다.
2. **토큰 발급을 60초 30회 창에 세는 것**: 구현은 센다. 그래서 첫 창에서는 31번째가 아니라 **30번째 API 호출**이 기다린다. 선택지: (가) 그대로 (더 보수적, AC14 통과). (나) API 호출만 센다 (지시서 문장 "31번째"와 글자 그대로 맞음).
3. **빈 `requestId` 거부**: 구현은 `''`만 호출 전에 거부한다 (거부된 Promise, fetch 0회). 공백만 있는 값은 통과한다. 선택지: (가) 그대로. (나) 공백만 있는 값도 거부. (다) 거부하지 않고 T008 책임으로 둔다.
4. **baseUrl 끝 슬래시 허용**: 지시서는 "`https://api-m.sandbox.paypal.com`이 아님 → 에러". 구현은 끝의 `/`를 떼고 비교해 `…com/`, `…com///`를 받는다 (단위 테스트가 이 동작을 고정함. 실제 호출 호스트는 같다). 선택지: (가) 허용 유지. (나) 글자 그대로 일치만 허용.
5. **문제 1·2·3의 처리 시점**: (가) 이대로 병합하고 후속 작업으로 등록 (T003이 이 클라이언트를 쓰기 전에 문제 2·3, 보드가 동시 조회를 하기 전에 문제 1). (나) 문제 2·3을 "비밀값 노출 / 샌드박스만 위반"으로 보고 병합 전 1회 재시도로 돌린다 (그러면 이 보고서 판정은 실패로 읽는다). 고치는 범위는 모두 `src/paypal/client.ts`와 단위 테스트 안이고 계약 변경은 필요 없다.
6. **응답 본문에 비밀값이 되돌아올 때**: 반환 `body`는 가공 없이 넘긴다. 로그·에러에는 안 나온다. 선택지: (가) 그대로 (PayPal이 토큰을 되돌려주는 일은 보통 없고, 호출자가 `body`를 통째로 로그·화면에 내지 않는다는 규칙을 T003·T008 지시서에 적는다). (나) 반환 `body`의 문자열에도 가리기를 적용한다.
7. **JSON이 아닌 본문**: 지시서는 "body는 JSON 파싱, 빈 본문은 null". 구현은 JSON이 아니면 원문 문자열을 돌려준다 (예: HTML 오류 페이지). 선택지: (가) 그대로. (나) null 또는 에러.
8. **429와 5xx 재시도 횟수를 따로 세는 것**: 한 요청에서 429 2회 + 5xx 2회가 섞이면 호출이 최대 5회, 401 갱신까지 겹치면 API 호출 최대 10회다 (모두 유한). 선택지: (가) 그대로 (종류별 최대 2회). (나) 합쳐서 최대 2회.

## 재검증 (2026-11-09 21:59 KST)
- 판정: **통과**   (기준: 요구한 수정 (1)~(5) 충족 + AC14·회귀 없음 + 비밀값 노출 0건 + 범위 밖 수정 없음)
- 검증 대상: lane/paypal-client `b629501` (재시도 코드 커밋 `2543790`, 범위 `git diff 8e4058f..HEAD`) · SPEC 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)` 확인
- 판정 근거 한 줄: 요구한 수정 (1)~(5)를 가짜 `fetch`·`now`·`sleep`으로 모두 재현했고, 지시받은 실패 경로 전부에서 가짜 Secret·Basic·토큰 노출 0건, AC14 14/14, 1차에서 일치했던 핵심 동작 그대로, 범위 밖 수정 0.
- **판정이 바뀔 수 있는 조건**: 아래 "발견한 문제" 1번. 호출자가 path 안에 Secret을 넣고 그 Secret 중간에 제어문자(줄바꿈·탭·NUL 등)가 끼어 있으면, 거부 에러의 `message`와 `path` 속성에 Secret 원문이 다시 이어 붙어 나온다 (재현함, 로그에는 없음). 지시받은 시나리오 밖에서 내가 추가로 만든 입력이고, 그런 path를 만드는 호출자가 없으며(액세스 토큰은 호출자가 얻을 방법도 없다), 호출자가 이미 넘긴 값이 되돌아오는 것이라 **병합 후 수정**으로 분류했다. 컨트롤 타워가 이것을 "비밀값 노출 1건"으로 세면 판정은 실패다.
- 검증 방법: 코드·설정·테스트는 고치지 않았다. 실제 네트워크 호출 없음 (전역 `fetch`는 불리면 실패하도록 막고 0회 확인). `.env`는 찾거나 읽지 않았다. 구현의 단위 테스트는 근거로 쓰지 않았다.
- 임시 스크립트 (worktree 밖): `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T002/recheck.ts`, `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T002/recheck2.ts`, `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T002/recheck3.ts`

### 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-status main...HEAD` | — | — | 추가 4개뿐: `src/paypal/client.ts`, `tests/unit/client.test.ts`, `reports/T002-impl.md`, `reports/T002-verify.md` |
| `git diff --name-status 8e4058f..HEAD` | — | — | 재시도 범위는 `src/paypal/client.ts`, `tests/unit/client.test.ts`, `reports/T002-impl.md` 3개 |
| `git diff main...HEAD -- package.json package-lock.json src/types.ts tests/acceptance SPEC.md config CLAUDE.md tasks TASKS.md DECISIONS.md README.md .claude` | — | — | 출력 0줄. 계약 파일·의존성 변경 없음. `client.ts`의 import는 `@/types` 타입 1줄뿐 (새 의존성 없음) |
| `git rev-list --left-right --count main...HEAD` | — | — | `14 6`. main이 14개 앞 (`src/exec/`, `seed/`, `package.json`, 보고서 등). main 쪽 변경 파일과 이 레인 파일 4개는 겹치지 않는다 |
| `npx vitest run tests/acceptance/ac14.client.test.ts` | 14 | 0 | 기대 14개 그대로 |
| `npm test` | 152 | 0 | 4개 파일. `tests/unit/client.test.ts` 86개, 45ms |
| `npx tsc --noEmit` | — | 3 | 1차와 같은 TS2307 3개 (`@/engine/plan`, `@/engine/escalation`, `@/exec/execute`, 다른 레인). `src/paypal/`, `tests/unit/client.test.ts` 오류 0 |
| `npm run test:acceptance` | 41 | 2 | 9 skip, 파일 4개 실패. 1차와 같다 (ac04·ac07·ac11-12 모듈 없음, ac13 2건 `.env.example`). 모두 범위 밖 |
| `npx eslint src/paypal/client.ts tests/unit/client.test.ts` | — | 0 | 종료 코드 0 |
| `npx tsx …/verify-T002/recheck.ts` (재검증 시나리오) | 213 | 2 | 225행 (정보성 10). 실패 2행: 문제 1 (쪼갠 비밀값), 문제 4 (400자리 `Retry-After`). 미처리 Promise 거부 0건, 실제 실행 0.23초 |
| `npx tsx …/verify-T002/recheck2.ts`, `recheck3.ts` (보충) | — | — | 교착 확인, 같은 토큰 재발급, 변형된 비밀값, 버리는 본문 닫기. 결과는 아래 표 |

### 요구한 수정 확인
가짜 Secret `VERIFY-FAKE-SECRET-do-not-leak-zzzz`, 가짜 토큰 `VERIFY-FAKE-TOKEN-…` 12개. "토큰"은 `/v1/oauth2/token` fetch 수, "api"는 그 밖의 fetch 수. 동시성은 가상 타이머(가짜 `sleep`이 가상 시계에 등록, 진행이 멈추면 시계를 다음 타이머로 옮김)로 돌렸다.

| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| (1) | 토큰 없는 상태 동시 GET 5개 | 토큰 1 | 토큰 1, api 5, 성공 5/5, Bearer 1종 | 예 |
| (1) | 토큰 없는 상태 동시 GET 100개 | 토큰 1 | 토큰 1, api 100, 성공 100/100, 60초 창 최대 fetch 30, 가상 경과 180초 (1차: 토큰 100회) | 예 |
| (1) | 토큰 만료 뒤 동시 GET 5개 | 추가 발급 1 | 토큰 합계 2, 5개 모두 새 토큰 | 예 |
| (1) | 동시 GET 5개가 모두 401 | 갱신 1 | 토큰 합계 2 (갱신 1회), 성공 5/5, 재시도 5회 모두 새 토큰 (1차: 갱신 5회) | 예 |
| (1) | 동시 GET 40개가 모두 401 | 갱신 1 | 토큰 합계 2, 성공 40/40 | 예 |
| (1) | 발급 5xx 계속, 동시 5개가 공유 | 5개 모두 실패, 다음 호출은 다시 발급 | 실패 5/5, 토큰 fetch 3 (발급 1건의 재시도), api 0. 다음 호출: 토큰 fetch 3회 더 하고 실패. 복구 뒤 호출: 성공 | 예 |
| (1) | 발급 네트워크 예외 계속, 동시 5개 | 위와 같음 | 실패 5/5, 토큰 fetch 3 → 6 → 복구 뒤 성공 (누계 7) | 예 |
| (1) | 발급 401 / 200인데 `access_token` 없음, 동시 5개 | 위와 같음 | 실패 5/5, 토큰 fetch 1 → 2 → 복구 뒤 성공 (누계 3) | 예 |
| (1) | 동시 401 5개의 갱신이 5xx로 실패 | 5개 모두 실패, 다음 호출은 옛 토큰을 안 씀 | 실패 5/5, 다음 호출은 새로 발급받은 토큰으로 api 1회 성공 | 예 |
| (1) | 401 갱신 응답을 붙잡아 둔 동안 새 GET·POST 2개 | 옛 토큰으로 fetch 0 | 붙잡힌 동안 새 호출의 api fetch 0회. 풀린 뒤 3회 모두 새 토큰, 토큰 합계 2 | 예 |
| (1) | 만료(정확히 60초 전) 재발급을 붙잡아 둔 동안 새 호출 | 옛 토큰으로 fetch 0 | 0회. 풀린 뒤 2회 모두 새 토큰, 토큰 합계 2 | 예 |
| (1) | 다른 호출이 이미 갱신한 뒤 늦게 도착한 401 | 추가 발급 0 | 추가 발급 0, 새 토큰으로 재시도해 성공 | 예 |
| (1) | 창이 30/30으로 찬 상태 + 토큰 만료 + 동시 5개 (교착 확인) | 끝남 | 성공 5/5, 토큰 2, `sleep` 1회, 가상 60초, 창 최대 30 | 예 |
| (1) | 발급 재시도 중 `deps.sleep`이 거부 | 영구 실패 없음 | 공유한 2개 실패, 다음 호출 성공 | 예 |
| (1) | 재발급해도 같은 토큰 값이 올 때 동시 401 5개 | 유한 횟수 뒤 에러 | 에러 5/5 (status 401), 토큰 fetch 2, api 11. 그 뒤 다른 호출은 정상 | 예 |
| (2) | 1차에서 뚫린 path: `.evil.example/x`, `:8443/x`, `v1/customer/disputes`, `https://evil.example/x`, `@evil.example/x` | 예외, fetch 0 | GET·POST 모두 예외(거부된 Promise). fetch 0회 (토큰 없는 상태·있는 상태 모두, 토큰 발급 포함) | 예 |
| (2) | `//evil.example/x`, `/\evil.example`, `/\\evil.example`, `\\evil.example/x` | 예외, fetch 0 | 예외, fetch 0회 | 예 |
| (2) | `/x\n`, CRLF + `Host:`, 탭(중간·시작), 공백(중간·시작), NUL, DEL, NBSP, U+2028, 전각 공백 | 예외, fetch 0 | 예외, fetch 0회 | 예 |
| (2) | 빈 문자열, `?x=1`, `#x`, `/x/http://evil.example`, `HTTPS://evil.example/x`, `javascript:alert(1)` | 예외, fetch 0 | 예외, fetch 0회 | 예 |
| (2) | 문자열이 아닌 path: `undefined`, `null`, `123`, `toString`을 가진 객체, 배열 | 예외, fetch 0 | 예외, fetch 0회 | 예 |
| (2) | 통과하는 변형: `/%2F%2Fevil.example`, `/..//evil.example`, `/.//evil.example`, `/v1/../../steal`, `/@evil.example`, `/;@evil.example`, `/%5Cevil.example`, `/%0d%0aHost:evil.example` | 통과한다면 호스트는 샌드박스 | 통과. 요청 호스트는 모두 `api-m.sandbox.paypal.com` (`new URL`과 `new Request` 둘 다로 해석). `/..//evil.example`은 같은 호스트의 경로 `//evil.example`이 된다 | 예 |
| (2) | 유니코드 혼동 문자: 전각 슬래시 U+FF0F, 나눗셈 슬래시 U+2215, 전각 마침표 U+3002, 전각 @ U+FF20, 폭 없는 공백 U+200B, 한글 경로 | 통과한다면 호스트는 샌드박스 | 통과. 호스트 샌드박스, 경로에 퍼센트 인코딩되어 들어간다 | 예 |
| (2) | `/` 뒤 `?`만(`/?`), `/`, `/#frag`, 2만 자 경로 | 통과한다면 호스트는 샌드박스 | 통과, 호스트 샌드박스 | 예 |
| (2) | 정상 경로: `/v1/customer/disputes?page_size=1`, `/v2/checkout/orders/ABC/track`, `/v1/customer/disputes/PP-D-12345/make-offer`, `…?start_time=2026-11-01T00:00:00.000Z&page_size=50&dispute_state=A,B`, `/v1/reporting/transactions?start_date=…-0700&fields=all`, `/v2/payments/captures/…/refund`, `…/provide-evidence`, `…?q=a%20b%2Bc` | 통과 | GET·POST 모두 통과, 호스트 샌드박스 | 예 |
| (3) | 샌드박스 외 baseUrl 11종: Secret이 baseUrl 자리에, `https://id:secret@api-m.sandbox…`, `https://id:secret@evil…`, 쿼리에 Secret, Basic 값이 섞임, 줄바꿈·공백 뒤 Secret, Secret 뒤 baseUrl, live 주소, http, 빈 문자열 | 예외, fetch 0, 문구에 받은 값 없음 | 예외 11/11, fetch 0회. 문구는 1종뿐(고정 문구), 받은 값이 실린 경우 0건, 비밀값 0건 | 예 |
| (3) | 토큰 발급 401·400 (본문이 Secret·Basic을 되돌려줌) | 노출 0 | 에러 표면·로그 0건 | 예 |
| (3) | 토큰 발급 5xx 계속 (`debug_id` 값이 Secret) / 429 계속 | 노출 0 | 0건. `debug_id`는 `[redacted]`로 나온다 | 예 |
| (3) | 토큰 발급 네트워크 예외 (예외 message·cause·속성에 Basic·Secret), 문자열·객체 throw | 노출 0 | 0건 (`cause` 붙이지 않음, Error가 아니면 고정 문구) | 예 |
| (3) | 토큰 응답 200인데 `access_token` 없음·JSON 아님 (본문에 Secret) | 노출 0 | 0건 | 예 |
| (3) | API 400·403·404·422 (본문이 Secret·Basic·토큰을 되돌려줌) | 로그 노출 0 | 로그 0건 (반환 `body`는 결정 6 현행 유지라 보지 않음) | 예 |
| (3) | API 5xx 계속 (본문·`debug_id`에 토큰) / 429 계속 / 401 계속 | 노출 0 | 0건. `debug_id` 안에 섞인 토큰도 `[redacted]` | 예 |
| (3) | API 네트워크 예외 (message·cause·속성에 Bearer 토큰), 401 갱신 뒤 두 번째 토큰 포함 | 노출 0 | 0건 | 예 |
| (3) | path 예외: 거부되는 path 6종에 Secret·Basic·발급된 토큰 | 노출 0 | 0건 (`PayPal x/[redacted]: …` 꼴) | 예 |
| (3) | 통과하는 path에 Secret·Basic·토큰이 든 채 5xx 소진 (120자 경계에 걸친 경우 포함) | 노출 0 | 에러·로그 0건 | 예 |
| (3) | `requestId` 예외 (path에 Secret·토큰·쿼리) | 노출 0 | 0건 | 예 |
| (3) | 정상 GET·POST 40회 + 속도 제한 대기 로그 52줄 (본문에 Secret) | 노출 0 | 0건 | 예 |
| (3) | 쿼리 문자열: path `/v1/customer/disputes?buyer=…&page_size=1#frag`로 위 실패 경로 전부 | 에러의 path·로그에 쿼리 없음 | `path` 속성은 `/v1/customer/disputes`. 로그 0건. 에러 message는 **네트워크 예외일 때만** 예외 문구에 든 URL·쿼리가 그대로 실린다 (문제 2) | 예 (path·로그). 네트워크 예외 문구는 문제 2 |
| (3) | 검색한 표면 | — | 에러마다 `message`, `String(err)`, `stack`, `name`, `cause`(재귀), 자기 속성 전부(비열거 포함, 재귀), `JSON.stringify(err)`, `JSON.stringify({...err})`, `util.inspect(showHidden)` + `deps.log` 전체 | — |
| (3) | **추가**: path 안의 Secret·토큰이 `\n`·`\r`·`\t`·NUL·DEL로 쪼개져 있을 때 (거부되는 path) | 노출 0 | **에러 `message`와 `path` 속성에 Secret·토큰 원문이 이어 붙어 나온다.** 로그 0건, fetch 0회. 공백·역슬래시·`?`·`#`로 쪼갠 경우는 나오지 않는다 | **아니오** (문제 1) |
| (4) | `Retry-After: "5"` | 5000ms | 5000 | 예 |
| (4) | `"0"` | 0ms | 0 | 예 |
| (4) | `""` | 30000ms | 30000 (1차: 0) | 예 |
| (4) | `" 5 "` | 5000ms (양끝 공백은 다듬음) | 5000 | 예 |
| (4) | `"-5"` | 30000ms | 30000 | 예 |
| (4) | `"1.5"` | 30000ms | 30000 (1차: 1500) | 예 |
| (4) | `"1e3"` | 30000ms | 30000 (1차: 1,000,000) | 예 |
| (4) | `"0x10"` | 30000ms | 30000 (1차: 16,000) | 예 |
| (4) | `"86400"` | 60000ms (상한) | 60000 (1차: 86,400,000) | 예 |
| (4) | HTTP 날짜 | 30000ms | 30000 | 예 |
| (4) | 헤더 없음 | 30000ms | 30000 | 예 |
| (4) | 그 밖: `"60"`·`"61"`·25자리 숫자 / `"+5"`·`"Infinity"`·`"abc"`·`"5, 10"`·공백뿐·아랍 숫자·전각 숫자 / `"00005"` | 60000 / 30000 / 5000 | 60000 / 30000 / 5000. 토큰 엔드포인트의 429도 모든 값에서 같은 대기 | 예 |
| (4) | 400자리 숫자 | 60000ms (정수이므로 상한) | 30000 | 아니오 (문제 4, 의견) |
| (5) | `requestId` `""`, `"   "`, `"\t\n"` | 호출 전 거부, fetch 0 | 셋 다 거부된 Promise(동기 throw 아님), fetch 0회 (토큰 없는 상태·있는 상태 모두). 1차: 공백뿐은 통과 | 예 |
| (5) | `undefined`, `null`, `123`, NBSP, 전각 공백 | 거부, fetch 0 | 거부, fetch 0회 | 예 |
| (5) | 값이 있는 `requestId` | 그대로 전송 | `PayPal-Request-Id: plan-1:send-message` | 예 |
| 권장 | 재시도를 다 쓴 5xx 에러 | status와 `debug_id`만 | 열거 속성 `name`, `status`, `path`, `debugId`. `debugId: "dbg-7f3a9c"`, 본문의 다른 필드·구매자 값 없음. 본문이 JSON이 아니면 `debugId: null` | 예 |
| 권장 | 버리는 응답 본문 닫기 (가짜 응답의 `cancel`·`text` 호출 기록) | 닫음 | API 401·429·재시도하는 5xx: 닫음. 토큰 발급 401·429·재시도하는 5xx: 닫음. 마지막 5xx는 `debug_id`를 읽느라 읽음. 200·404는 읽음. 실제 `Response` 객체로도 예외·미처리 거부 없음 | 예 |

### 회귀 확인
| 동작 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 40분 동안 GET 5회 | 토큰 1 | 토큰 1, api 5 | 예 |
| 토큰 발급 요청 꼴 | POST, Basic, `grant_type=client_credentials`, Request-Id 없음 | 그대로 | 예 |
| 만료 60초 1ms 전 / 정확히 60초 전 | 재사용 / 재발급 | 토큰 1 / 2, 새 토큰 사용 | 예 |
| 401 → 200 | 갱신 1회, 대기 없음 | 토큰 2, api 2, `sleep` 0회 | 예 |
| 401 계속 | 에러, 무한 루프 없음 | 에러(status 401), 토큰 2, api 2 | 예 |
| 429 계속 (`Retry-After: 7`) | api 3, 대기 [7000, 7000], 에러 | 그대로 (status 429) | 예 |
| 500·502·503·504 계속 | api 3, 대기 [2000, 4000], 에러 | 그대로 (status 포함) | 예 |
| 네트워크 예외 계속 / 503, 503, 200 | api 3 뒤 에러(status null) / 성공 | 그대로 | 예 |
| 429·503 번갈아 계속 | api 5회 뒤 에러 (결정 8 현행 유지) | api 5, 에러 | 예 |
| 순차 GET 31회 | 30번째 GET에서 60000ms 1회 대기 (결정 2 현행 유지) | 대기한 GET 순번 [30], `sleep` [60000] | 예 |
| 순차 GET 100회 / 토큰 있는 상태 동시 45회 | 60초 창 안 fetch ≤ 30 | 최대 30 / 최대 30, 성공 45/45 | 예 |
| POST: 503 → 429 → 네트워크 예외 → 401 → 201 | 5회 모두 같은 `PayPal-Request-Id`·본문·URL | Request-Id 1종, 본문 1종, URL 1종, 201 | 예 |
| GET | Request-Id·Content-Type·body 없음 | 헤더는 `authorization`, `accept`뿐 | 예 |
| 샌드박스 외 baseUrl 21종 (1차와 같은 꼴) | 만들 때 예외, fetch 0 | 예외 21/21, fetch 0회 | 예 |
| 올바른 baseUrl, 끝 슬래시 `…com/`, `…com///` | 생성됨 (결정 4 현행 유지) | 생성 3/3, 요청 호스트 샌드박스 | 예 |
| 만들기만 / 객체 속성 | fetch 0 / `call`, `get`뿐 | 그대로 | 예 |
| 400·403·404·422, 204, 공백 본문, JSON 아님 | 재시도 없이 반환, null, null, 원문 (결정 7 현행 유지) | 그대로, `sleep` 0회 | 예 |
| `deps.log` 미주입 | 동작 | 동작 | 예 |
| 실제 타이머·시계·전역 fetch | 0회 | `client.ts` 스택에서 `setTimeout`·`setInterval`·`setImmediate`·`Date.now`·`performance.now`·전역 `fetch` 0회 (감시 장치가 `client.ts` 스택을 알아보는 것도 확인). 소스에 해당 호출·`process.env`·`console`·`'use client'` 없음 (주석 2줄뿐) | 예 |
| 기존 단위 테스트 22개의 기대값 | 그대로 | 재시도 diff에서 지워진 줄은 3줄뿐 (`OK_TOKEN` 상수를 `tokenReply()` 헬퍼로 바꾼 것, 값은 같다) | 예 |
| 로그의 디버깅 정보 | 메서드·경로·상태·재시도 횟수가 남음 | 예: `GET /v1/customer/disputes/PP-D-27803 → 404`, `GET /v1/customer/disputes → 503 · retry 1/2 after 2000ms`. 정상 Secret에서는 지나친 가리기 없음 | 예 |

### 발견한 문제
1. **[병합 후 수정] 제어문자로 쪼개진 비밀값이 가리기 뒤에 다시 이어 붙는다.** `labelPath`가 비밀값을 가린 **뒤에** 제어문자를 지운다 (`src/paypal/client.ts:170-172`). path가 `/v1/x/<Secret 앞부분>\n<Secret 뒷부분>` 꼴이면 가리기는 글자 그대로 일치하지 않아 지나가고, 그다음 줄바꿈이 지워지면서 Secret 원문이 거부 에러의 `message`와 `path` 속성에 나온다. `\n`, `\r`, `\t`, NUL, DEL 5가지에서 Secret과 발급된 토큰 모두 재현했다. 로그에는 나오지 않고(거부된 path는 로그에 가지 않는다) fetch도 0회다. 조건이 좁다: 호출자가 path에 Secret을 넣어야 하고 그 중간에 제어문자가 있어야 한다. 지금 `get`·`call`을 부르는 코드는 없고(main의 `src/exec/request.ts:41`은 `/v1/customer/disputes/<분쟁 ID>/<끝점>`만 만든다), 액세스 토큰은 클라이언트 밖으로 나가지 않아 호출자가 path에 넣을 수 없다. 두 단계의 순서를 바꾸면(제어문자를 먼저 지우고 가림) 막힌다.
   - 같은 뿌리의 의견: 가리기는 원문 그대로 일치만 잡는다. 퍼센트 인코딩된 Secret이 path에 있으면 인코딩된 꼴이 에러 `message`·`path` 속성·로그에 남는다 (가짜 Secret `fake+secret/with=chars&more`로 확인. 원문은 나오지 않는다).
2. **[의견] 네트워크 예외 문구가 에러 사유에 그대로 실린다.** `reasonOf`가 `error.message`를 통째로 쓴다 (`client.ts:139-141`, `:245`). 비밀값은 가려지지만, 가짜 fetch가 URL을 넣은 문구(`fetch failed for https://…?buyer=…`)를 던지면 쿼리 문자열과 구매자 값이 에러 `message`에 들어간다 (`path` 속성과 로그에는 없다). 길이 제한도 없다 (5만 자 문구 → message 50,036자). Node 내장 fetch가 실제로 어떤 문구를 던지는지는 네트워크 호출 금지라 확인하지 않았다.
3. **[의견] `debug_id` 값에 길이·줄바꿈 제한이 없다.** 5000자 + 줄바꿈이 든 `debug_id`가 에러 `message`(5,062자, 줄바꿈 포함)와 `debugId`에 그대로 실린다 (`client.ts:270-272`). 비밀값은 가려진다.
4. **[의견] 400자리 `Retry-After`는 60초가 아니라 30초.** `Number()`가 Infinity가 되어 기본값으로 떨어진다 (`client.ts:133-134`). 어느 쪽이든 60초 이하라 해는 없다. 구현 보고서의 "초대형 값은 상한"은 21자리까지만 테스트했다.
5. **[의견] path 검사가 인코딩하지 않은 쿼리를 막는다.** `/v1/x?return_url=https://merchant.example/cb`(`://`)와 `/v1/x?note=a b`(공백)는 예외다. 퍼센트 인코딩하면 통과한다. 위 표의 PayPal 정상 경로 8종은 모두 통과하므로 지금 막히는 호출은 없다. T003 등 쿼리를 만드는 호출자는 값을 인코딩해야 한다.
6. **[의견] 그 밖.**
   a. 폭 없는 공백(U+200B)뿐인 `requestId`는 통과한다 (`trim()`이 지우지 않는 문자).
   b. Secret이 1글자면(`"/"`, `"a"`) 가리기가 경로·`debug_id`를 조각낸다 (`[redacted]v1[redacted]customer…`). 빈 Secret은 생성 때 거부하지 않는다. 실제 Secret 길이에서는 생기지 않는다.
   c. 1차 의견 5a(시계를 옮기지 않는 가짜 `sleep`), 5d(`redirect`·`AbortSignal`), 5e(`deps.log` 예외)는 지시에 없어 그대로다. 다시 판정하지 않았다.
7. **[참고] 구현 보고서 "재시도" 절과 다른 곳.**
   - "에러 `message`·`stack`과 열거 속성, 로그 줄이 모두 가려진 뒤에 만들어진다"는 문제 1의 입력에서 사실과 다르다 (가린 뒤 제어문자를 지우면서 다시 생긴다).
   - "초대형 값 → 상한"은 문제 4의 범위(약 309자리 이상)에서는 30초다.
   - 절 제목 시각(21:52)이 보고서 커밋 시각(21:50)보다 늦다.
   - 그 밖의 주장(테스트 숫자 14 / 152·86 / 41·2·9 skip / tsc 3 / eslint 0, 고친 것 표 1~7, 기존 22개 기대값 유지, 유지한 결정 6건)은 내가 확인한 결과와 같다.

병합 차단 문제: **없음.**

### 컨트롤 타워가 결정할 것
1. **문제 1의 처리**: (가) 이대로 병합하고 후속 작업으로 등록한다 (`labelPath`에서 제어문자 제거를 가리기 앞으로 옮기는 수정, `src/paypal/client.ts`와 단위 테스트 안에서 끝나고 계약 변경 없음). (나) "비밀값 노출 1건"으로 세어 판정을 실패로 읽는다. 이 경우 T002는 2회 연속 실패가 되어 CLAUDE.md 규칙상 사람을 불러야 한다.
2. **쿼리 값 인코딩 규칙** (문제 5): path 검사가 공백과 `://`를 막으므로, 쿼리를 만드는 뒤 작업(T003 등) 지시서에 "쿼리 값은 퍼센트 인코딩한다"를 적을지.
