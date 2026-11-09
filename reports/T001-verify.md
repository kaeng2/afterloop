# T001 1단계 검증 (2026-11-09 23:12 KST)
- 판정: **통과**
- 검증 대상: 커밋 e653e2b (lane/paypal의 T001 1단계, 범위 `git diff 206e95d..HEAD` = eb169f4 + e653e2b) · 기준 SPEC v2.2 (첫 줄 확인) · 실호출 없이 검증
- 검증 위치: `.env`가 없는 별도 사본(`afterloop-wt/verify-tmp`, 분리된 HEAD). `afterloop-wt/paypal`에는 들어가지 않았고 어떤 `.env`도 열지 않았다.
- 병합 차단 문제: 없음. 2단계 실행 전에 볼 것 1건(아래 "발견한 문제" 1번), 컨트롤 타워가 결정할 것 4건.

검증의 한계 (직접 확인하지 못한 것):
- 진입점 `scripts/sandbox/check.ts`·`setup.ts`는 **실행하지 않았다** (import하면 실호출이 시작된다). 명령줄 처리·출력·종료 코드는 코드 읽기 + 같은 흐름을 옮긴 임시 스크립트(가짜 `fetch`)로 확인했다.
- `process.loadEnvFile`로 `.env` 파일을 실제로 읽는 길은 실행하지 않았다 (코드 읽기만). 환경 변수로 값이 들어오는 길만 가짜 값으로 돌렸다.
- 구현자가 한 실호출(토큰, 기능 2종, 요청 ID 3건, 잘못된 Secret 1회)은 재현하지 않았다. 기록끼리 앞뒤가 맞는지만 봤다.

## 실행한 명령과 결과
모두 `verify-tmp`에서, `RUN_SANDBOX` 없이, `PAYPAL_*` 환경 변수 없이 실행.

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac13.sandbox.test.ts` | 2 | 0 | 샌드박스 묶음 9개 건너뜀. 1단계 완료 기준 충족 |
| `npm test` | 410 | 0 | 파일 9개. `tests/unit/sandbox-setup.test.ts` 24개 포함 |
| `npx vitest run tests/unit/sandbox-setup.test.ts` | 24 | 0 | |
| `npm run test:acceptance` | 104 | 15 | 9개 건너뜀. 실패 15개는 전부 `ac17.seed.test.ts` (data 레인 몫). T001 파일과 무관 |
| `npx tsc --noEmit` | — | 16 | 전부 `seed/data.ts` 11 · `seed/index.ts` 2 · `seed/schemas.ts` 3. `scripts/sandbox/`·`tests/unit/sandbox-setup.test.ts` 오류 0 |
| `npm run lint` | 통과 | — | 출력 없음 |
| 임시 스크립트 `harness.ts` (가짜 `fetch` + 실제 `createPayPalClient` + 로직 모듈) | 67 | 2 | 총 69항목. 어긋난 2개는 아래 S5(가상 조건), S10c(재실행 덮어쓰기). 진짜 `fetch` 호출 0회 (전역 `fetch`를 막아 두고 셌다) |
| 임시 타입 확인 (`tsc -p` 임시 tsconfig) | — | — | 구현의 `CheckReport`와 AC13의 `CheckReport`가 서로 대입 가능. `Manifest`도 서로 대입 가능 (`captureId`는 선택 필드) |
| `npm run sandbox:check`, `npm run sandbox:setup` | — | — | **실행하지 않음** (지시) |

임시 스크립트 위치: `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T001/` (`harness.ts`, `lastrun.ts`, `typecheck/`). 저장소 밖이다.

## 비밀값·샌드박스 확인
| 항목 | 판정 | 근거 |
|---|---|---|
| 추적 파일에 `.env`가 없다 | 통과 | `git ls-files`에서 `.env`로 걸리는 것은 `.env.example`뿐. `git log --all -- .env .env.local '.env.*' ':!.env.example'` 결과 없음 |
| `.env`는 무시, `.env.example`은 추적 | 통과 | `git check-ignore`: `.env`·`.env.local` → `.gitignore:34 .env*`. `.env.example`은 무시되지 않음 |
| `.env.example` 값 | 통과 | 8줄. `PAYPAL_CLIENT_ID=`, `PAYPAL_CLIENT_SECRET=`, `PAYPAL_BASE_URL=`, `LLM_API_KEY=` 네 개 모두 `=` 뒤가 비어 있다 (길이 0). `PAYPAL_BASE_URL`도 비어 있고, 바로 윗줄 주석에 공개 샌드박스 주소가 적혀 있다. 키마다 한 줄 주석 있음 |
| T001 파일에 Client ID 꼴의 긴 문자열(영숫자·`-`·`_` 40자 이상) | 통과 | 걸린 것 1곳: `scripts/sandbox/check-steps.ts:207` (50자). 코드에 고정된 가짜 요청 ID 상수(`PROBE_ID_61`)이고 자격 증명이 아니다. `tests/sandbox/last-run.md`·`manifest.json`·`reports/T001-impl.md`·단위 테스트에는 없음 (20자 이상으로 낮춰도 보고서의 경로·명령 이름만 걸림) |
| `Bearer `·`Basic ` 뒤의 값 | 통과 | T001 파일 0곳. 저장소 전체(20자 이상 값)도 0곳 |
| `access_token` 값 | 통과 | T001 파일에서 단어가 나오는 곳은 `reports/T001-impl.md:55` 한 줄 (검사에 쓴 검색어 목록이고 값이 아니다) |
| `PAYPAL_CLIENT_*=<값>` 꼴 | 통과 | `reports/T001-impl.md:54`, `tasks/T001.md:113` 두 곳. 둘 다 지시서가 허용한 시험용 문자열 `wrong-secret-for-test`다 |
| `scripts/sandbox/`의 출력 경로 | 통과 | 아래 표 |
| 환경 변수 덤프 | 통과 | `process.env`를 쓰는 곳은 `env.ts` 48~67행뿐 (키 3개를 이름으로 읽음). `console.log(process.env)` 꼴 없음. 자식 프로세스 실행 없음 |
| `.env` 값이 변수 밖으로 나가는 길 | 통과 (코드 읽기) | `env.ts`: 오류 문구는 키 이름과 고정 문구뿐. `loadEnvFile`의 예외는 삼킨다(36행). 값은 `PayPalEnv`로만 돌려주고 `check.ts`·`setup.ts`는 그것을 `createSandboxClient`에만 넘긴다 |
| 샌드박스가 아닌 `PAYPAL_BASE_URL` | 통과 | S1: 13가지 값 × 2(조회, `--probe`) 모두 호출 0회 · 종료 1 · 받은 값은 문구에 안 실림. `createPayPalClient`도 따로 거부(S1d) |
| live로 나갈 수 있는 하드코딩 URL | 통과 | `scripts/sandbox/`의 `paypal.com`은 `env.ts:12`(샌드박스 주소) 한 곳. 호출은 전부 `createPayPalClient`를 지나고 path는 `/`로 시작하는 상대 경로. `fetch`를 직접 쓰는 곳은 `paypal.ts:13`(클라이언트에 주입)뿐 |
| 조회 범위 | 통과 | `client.call`(POST)은 2곳: `check-steps.ts:238`(`--probe-request-id`일 때만), `setup-steps.ts:65`(`/track`). 분쟁 상태를 바꾸는 경로(send-message, make-offer, accept-claim, provide-evidence, escalate, adjudicate)와 캡처·승인 경로는 코드에 없다 |

`scripts/sandbox/`가 밖으로 내보내는 것:

| 위치 | 어디로 | 실리는 것 |
|---|---|---|
| `check.ts:31` | stderr | 모르는 옵션 이름(사용자가 친 인자) |
| `check.ts:40`, `setup.ts:60` | stderr | `SandboxEnvError` 문구(키 이름·고정 문구) 또는 고정 문구 |
| `check.ts:44`, `setup.ts:70` | stdout | 클라이언트 로그 줄. 클라이언트가 `redact`(Secret·Basic·받은 토큰)를 거쳐 넘긴다. 쿼리 문자열은 뗀다. `--json`이면 꺼짐 |
| `check.ts:51` | stdout | `--probe-request-id --json`: `{ probe: [...] }` 한 줄 (ID 길이, 상태, 주문 ID, 오류 요약) |
| `check.ts:52`, `61` | stdout | `last-run.md`에 쓰는 절과 같은 글 + 기록 파일 경로 |
| `check.ts:60` | stdout | `--json`: `CheckReport` 한 줄. `payerId`·`payerCountry` 포함 (AC13 계약 필드). 이름·이메일 없음 |
| `check.ts:72`, `setup.ts:94` | stderr | 잡히지 않은 오류의 `message` (클라이언트 오류는 가려져 있음, manifest 모양 오류는 필드 경로만) |
| `setup.ts:21~36`, `84` | stdout | 주문 키·주문 ID·결과·상태·가상 추적번호·분쟁 ID·오류 요약 |
| `last-run.ts:70` | `tests/sandbox/last-run.md` | 시각, 엔드포인트 이름표(`{O01}` 꼴), 상태 코드, 주문·캡처·분쟁 ID, 오류 요약. `payer_id`·이름·이메일 없음 (S7e) |
| `manifest.ts:52` | `tests/sandbox/manifest.json` | 주문·분쟁 키와 ID (`setup -- disputes`일 때만 쓴다) |
| `env.ts:31`, `56`, `62` | 던지는 오류 | 키 이름, 샌드박스 주소 상수 |
| `manifest.ts:46` | 던지는 오류 | 틀린 필드 경로 |

오류 요약(`paypal.ts`의 `errorSummary`)은 PayPal 오류 본문에서 `name`(없으면 `error`), `details[].issue`, `debug_id`만 뽑는다. `message`·`description`·`error_description`은 싣지 않는다.

## 시나리오 (가짜 클라이언트)
가짜 Client ID·가짜 Secret·가짜 토큰(각 80자 안팎)을 넣고, stdout·stderr·`last-run.md` 내용·`--json` 줄·오류 `message`에서 그 문자열, Basic 값(base64), `access_token` 단어, `Bearer <20자 이상>` 꼴을 찾았다. "흐름"은 `check.ts`의 `main()`을 그대로 옮기고 `createSandboxClient` 자리에 가짜 `fetch`를 끼운 것이다.

| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| S1 | `PAYPAL_BASE_URL` = live(`api-m.paypal.com`), `api.paypal.com`, 빈 값, 없음, 공백만, `http://` 샌드박스, 접미 도메인, userinfo(`…@다른 호스트`), 경로 붙음, 포트, 대문자 호스트, 임의 문자열(가짜 Secret 포함), `api.sandbox…` — 조회·`--probe` 각각 | 호출 0 · 종료 1 · 값 비노출 | 26건 모두 호출 0 · 종료 1 · 누출 없음. 문구는 "샌드박스가 아니다. 호출하지 않고 멈춘다" 또는 ".env에 PAYPAL_BASE_URL가 없다" | 예 |
| S1b | 끝 슬래시, 앞뒤 공백이 붙은 샌드박스 주소 | 샌드박스로만 호출 | 호출 3회, origin은 샌드박스 하나 | 예 |
| S1c | `PAYPAL_CLIENT_ID` 또는 `PAYPAL_CLIENT_SECRET` 없음 | 호출 0 · 종료 1 | 호출 0 · 종료 1 · 키 이름만 출력 | 예 |
| S2 | 정상, 빈 manifest, `--json` | stdout 1줄 JSON, `orders: []`·`disputes: []`, 종료 0 | `{"token":{"ok":true},"features":{"disputes":200,"transactionSearch":200},"orders":[],"disputes":[]}` 1줄 · 종료 0. 호출: 토큰 POST 1 + GET 2 (`/v1/customer/disputes?page_size=1`, `/v1/reporting/transactions?start_date=…&end_date=…&fields=transaction_info&page_size=1&page=1`). 누출 없음 | 예 |
| S2 | 정상, 빈 manifest, 사람용 출력 | 종료 0, "건너뛰었다" 문구, 비밀값 없음 | 로그 3줄(`token issued · valid for 32400s`, 두 GET의 상태) + 표 + "manifest가 비어 있어 … 건너뛰었다 (1단계)". 누출 없음 | 예 |
| S3 | 토큰 401, 응답 본문에 가짜 ID·Secret·Basic 값이 되돌아옴 | `token.ok` false · 종료 1 · 뒤 호출 없음 · 비밀값 없음 | `token.ok` false · 종료 1 · 호출 1회(토큰) · 누출 없음. 문제: "토큰 발급 실패: PayPal /v1/oauth2/token → 401: 액세스 토큰 발급 실패 (…)". `--json` 줄은 `features` 0/0 | 예 |
| S4 | `GET /v1/customer/disputes` 403, 본문 `message`·`description`에 토큰·Secret이 되돌아옴 | `features.disputes` 403 · 종료 ≠ 0 · 반영 대기 문구 · 비밀값 없음 | 403 · 종료 1 · "GET /v1/customer/disputes → 403 (앱 기능 반영 대기일 수 있음 · 최대 10분). 10분 뒤 다시 실행한다." · 누출 없음. 나머지 기능 확인은 계속함 | 예 |
| S4b | Transaction search만 403, `--json` | `features.transactionSearch` 403 · 종료 ≠ 0 | 403 · 종료 1 | 예 |
| S5 | (가상) 오류 본문의 `name`·`details[].issue`·`debug_id` 자리에 토큰·Secret이 들어 있음 | 가려짐 | **가려지지 않고** 출력과 `last-run.md`에 실린다 (`errorSummary`는 `redact`를 지나지 않는다). PayPal이 이 세 필드에 토큰을 넣는 응답은 확인된 바 없다 | 아니오 (의견, 아래 3번) |
| S6a | 토큰 발급 중 네트워크 예외, 예외 문구에 Basic 값·Secret | 종료 1 · 가려짐 | 종료 1 · 재시도 뒤 실패 · 문구에서 `[redacted]`로 바뀜 · 누출 없음 | 예 |
| S6b | 토큰은 받았고 기능 호출에서 네트워크 예외, 문구에 `Bearer <토큰>` | 종료 1 · 가려짐 | 종료 1 · `[redacted]` · 누출 없음. 이때 `token.ok`는 false로 남는다 (아래 4번) | 예 |
| S6c | 같은 조건, `--json` | stdout 1줄 JSON · 종료 1 | 1줄 · 종료 1 · 누출 없음 | 예 |
| S6d | 호출이 계속 401, 본문에 Authorization 값이 되돌아옴 (토큰 2종) | 종료 1 · 비밀값 없음 | 종료 1 · "토큰을 새로 받은 뒤에도 401" · 누출 없음 | 예 |
| S7a | manifest 주문 5건 (추적 있음 / 없음 / 취소된 추적만 / 캡처 없는 APPROVED / 상품 2개·캡처 2개), 응답에 가짜 이름·이메일 | 상태·상품명·`payerId`·`payerCountry`·첫 캡처 ID·추적 여부 | 기대 표와 완전히 같음 (취소된 추적만 있으면 `tracked` false, 캡처 없으면 `captureId` 빈 문자열) | 예 |
| S7b | manifest 분쟁 3건 (SNAD / INR / 캡처 2개·CHARGEBACK) | reason·stage·status·captureIds | 기대 표와 완전히 같음 | 예 |
| S7c | 위 조회의 호출 | 토큰 외 전부 GET | GET 10회(기능 2 + 주문 5 + 분쟁 3), POST 0 | 예 |
| S7e | 구매자 이름·이메일·`payer_id` | stdout·`last-run.md`에 이름·이메일 없음 | 없음. `last-run.md`에 `payer_id`도 없음. `--json`에는 계약대로 `payerId` 포함 | 예 |
| S7f | `last-run.md`에 분쟁 ID | 3개 포함 (AC13이 확인) | 포함 | 예 |
| S7g | `CheckReport` 필드 | 주문 8필드·분쟁 6필드, AC13과 같은 이름·타입 | 일치 (실행값 + 타입 확인 둘 다) | 예 |
| S7h | manifest의 주문·분쟁이 404 | 종료 1, 보고에서 빠지고 문제로 기록 | 종료 1 · `orders: []`·`disputes: []` · `last-run.md`에 "### 문제" | 예 |
| S8a | `--probe-request-id`가 보내는 요청 | `POST /v2/checkout/orders` 3건만 | 3건, 전부 그 경로. GET·캡처·승인 없음 | 예 |
| S8b | 실제 `PayPal-Request-Id` 헤더 | 길이 61, 61, 36. 앞 두 개는 같은 값 | 61, 61, 36 · 1번째 = 2번째 · 3번째는 다름 | 예 |
| S8c | 요청 본문 | intent CAPTURE, USD 1.00, 상품명 `Request-Id length probe` | 일치 (`purchase_units` 1개, `amount` 1.00 + `breakdown.item_total` 1.00, `items` 1개 수량 1) | 예 |
| S8d | 201 → 200(같은 주문 ID) → 201 | 표 3행 + 멱등 문구 + 종료 0 | 일치 | 예 |
| S8e | manifest | 그대로 | `tests/sandbox/manifest.json` 변화 없음. `check.ts`는 `writeManifest`를 import하지 않는다 | 예 |
| S8g | 거부(400) | `name`·`issue` 기록 | `INVALID_REQUEST · INVALID_STRING_LENGTH · debug_id=…` 기록. 종료 코드는 0 (상태 코드를 받았으면 0, 호출 자체가 실패하면 1) | 예 |
| S9a~b | `track`: 지시서 표대로 만든 12건 manifest | `/track` POST 7건 = O01, O06, O08~O12. 나머지 5건은 건드리지 않음 | POST 7건, 대상 일치. O02~O05·O07에는 GET도 없음 | 예 |
| S9c | `PayPal-Request-Id` | 주문 키 기준 | `afterloop-track-O01` 꼴 7개 | 예 |
| S9d | 본문 | 캡처 ID, 가상 추적번호, carrier OTHER | `capture_id`(그 주문의 캡처), `tracking_number` `FKAL<번호>2026`(7개 서로 다름), `carrier: OTHER`, `carrier_name_other`, `notify_payer: false` | 예 |
| S9f | 다시 실행 (추적이 이미 붙음) | POST 0 | POST 0 · 7건 `skipped` | 예 |
| S10a | `disputes`: 캡처별 분쟁 1건씩 | D1 = O02, D2 = O01, D3 = O08 | manifest 모양으로 일치 | 예 |
| S10b | `disputes`의 호출 | 조회만 | GET 6회(주문 상세 3 + `GET /v1/customer/disputes?disputed_transaction_id=<캡처>&page_size=10` 3), POST 0 | 예 |
| S10c | 분쟁 3건이 이미 적힌 manifest로 다시 실행, D2 조회만 5xx | 이미 적힌 것은 남음 | `runDisputes`가 D1·D3만 돌려주고, `setup.ts:83`이 그 배열로 `manifest.disputes`를 통째로 바꾼다 → 적혀 있던 D2가 지워진다 (종료 코드 1) | 아니오 (아래 1번) |
| — | `last-run.md` 절 쓰기 | 한 절을 다시 써도 다른 절은 그대로 | 커밋된 파일을 복사해 조회 절만 다시 썼을 때 요청 ID 절이 바이트 단위로 같음. 커밋된 파일은 스크립트가 쓰는 꼴과 같음 | 예 |

## 지시서 대조 (1단계)
| 항목 | 판정 | 근거 |
|---|---|---|
| 범위: 수정 가능 폴더 | 통과 (1건은 결정 대기) | 바뀐 파일 15개: `.env.example`, `.gitignore`, `package.json`, `scripts/sandbox/` 8개, `tests/sandbox/` 2개, `reports/T001-impl.md`, `tests/unit/sandbox-setup.test.ts`. 마지막 것만 지시서 목록 밖 (구현자가 결정 요청에 올림) |
| `.gitignore` | 통과 | `!.env.example` 한 줄 추가뿐 (+1 −0) |
| `package.json` | 통과 | `scripts`에 `sandbox:check`, `sandbox:setup` 두 줄 추가뿐 (+2 −0). 의존성 변경 없음, `package-lock.json` 변경 없음. `tsx`·`zod`는 원래 있던 것 |
| 계약·다른 레인 | 통과 | `src/`, `config/`, `seed/`, `SPEC.md`, `tests/acceptance/`, `tasks/`, `TASKS.md`, `DECISIONS.md`, `CLAUDE.md`, `README.md`, `docs/`, `inbox/`, `.claude/` 변경 0 |
| `.env.example` | 통과 | 키 4개, 값 비움, 키마다 한 줄 주석 |
| `createPayPalClient` 사용, `fetch` 직접 호출 없음 | 통과 | `paypal.ts`의 `createSandboxClient`가 유일한 통로. path는 `/`로 시작, 쿼리는 `URLSearchParams`, ID는 `encodeURIComponent` |
| `check`: 토큰 → 기능 2종 → 주문 → 분쟁, 조회만 | 통과 | S2, S7c |
| `check`: Transaction search 기간 | 차이 있음 (의견) | 지시서 "최근 30일", 구현 29일 (`check-steps.ts:24`, 주석에 이유). 구현 보고서에도 29일로 적혀 있다 |
| `--json` 한 줄, AC13 형식 | 통과 | S2, S7g, 타입 확인 |
| 빈 manifest → `orders: []`, `disputes: []`, 오류 아님 | 통과 | S2 (종료 0) |
| 기능 403 → 문구 + 종료 코드 ≠ 0 | 통과 | S4. 문구는 "(앱 기능 반영 대기일 수 있음 · 최대 10분)"으로 지시서의 "기능 반영 대기일 수 있음 (최대 10분)"과 구두점만 다르다 |
| 샌드박스가 아니면 호출 없이 종료 1 | 통과 | S1 |
| `last-run.md`에 엔드포인트·상태 코드·ID·시각 | 통과 | 커밋된 파일과 S7 출력 |
| `--probe-request-id` | 통과 | S8. 61자 2회 + 36자 1회, manifest에 넣지 않음, 캡처·승인 없음 |
| 요청 ID 확인 결과 기록 | 통과 (기록 일치) | `tests/sandbox/last-run.md`와 `reports/T001-impl.md` 모두: 61자 201 → 같은 ID 200·같은 주문 ID → 36자 201, 시각 23:00 KST. 기능 확인 200/200, 23:01 KST도 양쪽 일치. 커밋 시각(eb169f4 23:02:30)과도 순서가 맞다 |
| 잘못된 Secret 1회 실행 | 기록만 확인 | 보고서 54~55행에 결과가 있다. 재현하지 않았고, 같은 조건을 가짜로 돌린 S3에서 누출 없음 |
| `setup`: `track`·`disputes`만, 단위 테스트로 확인 | 통과 | S9, S10, 단위 테스트 24개 중 13개가 이 둘을 다룬다. `orders`·`capture`는 "T026이 한다"는 안내 뒤 종료 1 (`setup.ts:39~50`). 주문 생성·캡처 코드는 없다 |
| manifest | 통과 | `{"orders":[],"disputes":[]}`. 이메일·이름·토큰 없음 |
| 하지 않을 것 | 통과 | 분쟁 상태를 바꾸는 호출, OAuth 재시도·속도 제한 구현, `.env` 커밋 모두 없음 |
| `npm test`, `tsc`(자기 파일) | 통과 | 위 "실행한 명령과 결과" |

## 발견한 문제
병합 차단: **없음**

병합 후 수정 (2단계에서 `sandbox:setup -- disputes`를 돌리기 전):
1. **`disputes`를 다시 돌릴 때 일부만 찾으면 이미 적힌 분쟁이 지워진다.** `scripts/sandbox/setup.ts:82~84`는 이번에 찾은 분쟁이 1건 이상이면 `manifest.disputes`를 그 배열로 통째로 바꾼다. 3건이 적힌 상태에서 한 건의 조회만 실패하면 그 건이 manifest에서 빠진다 (S10c). 종료 코드는 1이고 다시 돌려 3건을 다 찾으면 복구되지만, 지시서의 "다시 실행해도 안전"과는 어긋난다. 2단계 실행 전에 고치거나, 실행 뒤 manifest의 분쟁이 3건인지 확인한다.

의견:
2. `runDisputes`는 캡처에 걸린 분쟁이 여러 건이면 첫 건을 적는다(비고에 전체 ID를 남김). reason이 표(D1 SNAD, D2·D3 INR)와 맞는지는 보지 않는다 — AC13 샌드박스 묶음이 나중에 확인한다. `disputed_transaction_id`에 캡처 ID를 넣는 질의가 실제 샌드박스에서 통하는지는 구현 보고서에 적힌 대로 2단계에서 처음 확인된다.
3. `errorSummary`가 뽑는 `name`·`details[].issue`·`debug_id`는 클라이언트의 `redact`를 지나지 않는다 (S5). PayPal이 이 세 필드에 토큰이나 Secret을 넣는 응답은 확인된 바 없어 실제 누출 길로 보지는 않았다. `message`·`description`·`error_description`에 되돌아오는 경우(S3, S4, S6d)는 모두 실리지 않는다.
4. `token.ok`는 "기능 호출에서 상태 코드를 한 번이라도 받았는가"로 정해진다. 토큰은 발급됐는데 두 기능 호출이 모두 네트워크 오류로 끝나면 `token.ok: false`, `last-run.md`에는 "토큰 발급: 실패"로 적힌다 (S6b). 종료 코드는 어느 쪽이든 1.
5. `runTrack`의 대상은 코드에 고정된 7건이 아니라 manifest의 `tracked: true`다. T026이 지시서 표대로 `tracked`를 적어야 7건(O01, O06, O08~O12)이 된다.
6. `--json`에서 주문·분쟁 조회가 실패하면 이유는 `last-run.md`에만 남고 stderr는 비어 있다 (AC13은 실패 시 stderr 앞 500자를 보여 준다).
7. Transaction search 기간이 29일이다 (지시서는 30일).

`reports/T001-impl.md`와 다른 곳:
- 54행 "출력은 `PayPal /v1/oauth2/token → 401: …` 한 줄": 코드상 사람용 출력은 한 줄이 아니다. 시각·"토큰 발급: 실패"·표 1행·"### 문제" 1줄·기록 파일 경로가 함께 나온다 (S3). 비밀값이 없다는 결론은 S3과 같다.
- 1행 보고 시각 23:05는 그 보고서를 담은 커밋(e653e2b, 23:03:52 +0900)보다 뒤다.
- 그 밖의 숫자는 직접 실행한 결과와 같다: AC13 2 통과, `test:acceptance` 104 통과·15 실패, `npm test` 410, `tsc` 16(전부 `seed/`), 단위 테스트 24개.

검증이 남긴 것: `npx tsc --noEmit`이 `verify-tmp/tsconfig.tsbuildinfo`를 만들었다 (`.gitignore` 대상이라 `git status -s`에 나오지 않는다).

## 컨트롤 타워가 결정할 것
1. **단위 테스트 위치 (`tests/unit/sandbox-setup.test.ts`).** 사실: 지시서 "수정 가능 폴더"에 `tests/unit/`이 없다. 지시서 완료 기준은 "가짜 클라이언트 단위 테스트로 확인"과 `npm test`를 요구한다. `npm test`는 `tests/unit`·`tests/integration`만 돌고, `tests/sandbox`는 `test:sandbox`(`RUN_SANDBOX=1`)에서만 돈다. SPEC 11장 끝줄은 "자기 모듈의 테스트는 `tests/unit/`, `tests/integration/`". 새 파일 1개이고 기존 테스트 파일은 바뀌지 않았다. 이 테스트는 `.env`를 읽지 않는다 (`loadSandboxEnv`를 키 3개가 모두 채워진 상태로만 부른다).
2. **manifest의 선택 필드 `captureId`.** 사실: AC13의 `Manifest` 타입과 지시서의 manifest 예시에는 없다. 타입은 서로 대입 가능하고 AC13은 이 필드를 읽지 않는다. 지시서는 "주문·분쟁 ID만 넣는다. 이메일·이름·토큰은 넣지 않는다"이고 캡처 ID는 개인정보가 아니다. `tasks/T026.md` 41행은 "캡처 ID를 manifest에 기록"이라고만 하고 필드 이름을 정하지 않았다 — T026이 다른 이름으로 적으면 `track`·`disputes`는 주문 상세에서 캡처 ID를 다시 읽는다(동작은 한다). 지금 manifest는 비어 있어 이 필드가 쓰인 적은 없다.
3. **`tests/sandbox/last-run.md`를 커밋에 둘지.** 실행할 때마다 바뀌는 파일이다 (구현자가 물음). AC13 샌드박스 묶음은 이 파일이 있고 분쟁 ID가 들어 있는지를 실행 직후에 읽는다.
4. **"발견한 문제" 1번을 2단계 전에 고칠지**, 아니면 2단계 실행 절차에 "manifest 분쟁 3건 확인"을 넣을지.

참고 (2단계로 넘어가는 사람 작업, 구현 보고서 체크리스트): 비즈니스 계정이 US인지 사람 확인이 아직 없다. 요청 ID 확인으로 만들어진 버려지는 주문 2건은 승인·캡처하지 않는다.
