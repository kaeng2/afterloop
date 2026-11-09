# T026 검증 (2026-11-09 23:30 KST)
- 판정: **통과**
- 검증 대상: 커밋 5706ce1 (lane/paypal의 T026, 범위 `18b61f5..5706ce1`) · 기준 SPEC v2.2 (첫 줄 확인) · 실호출 없이 검증
- 검증 방법: `.env`가 없는 별도 사본(`afterloop-wt/verify-tmp`)에서만 실행. PayPal 호출 0회, 승인 링크 접속 0회, `npm run sandbox:*` 실행 0회. 스크립트 로직은 가짜 PayPal(가짜 `fetch`)을 넣어 돌렸다.
- 한 줄 요약: 결과물(manifest·링크 파일)은 T001 표와 12행 모두 같고, 비밀값·이메일은 저장소·출력 어디에도 없으며, 샌드박스 밖 주소는 호출 0회로 멈춘다. 캡처 로직은 승인 전 주문을 건드리지 않는다. **다만 지금 만들어 둔 주문 12건은 아침에는 만료돼 있을 가능성이 높다** (아래 "발견한 문제" 1번 — 코드 결함이 아니라 운영 순서 문제).

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 493 | 0 | 파일 11개. `tests/unit/sandbox-orders.test.ts` 29개 포함 |
| `npx vitest run tests/acceptance/ac13.sandbox.test.ts` | 2 | 0 | 오프라인 2개 통과, 샌드박스 묶음 9개 건너뜀 (`RUN_SANDBOX` 없음) |
| `npx tsc --noEmit` | 종료 0 | — | 오류 0 |
| `npm run lint` | 종료 0 | — | 출력 없음 |
| `git diff --name-only 18b61f5..HEAD` | — | — | 7개 파일, 모두 지시서 "수정 가능 폴더" + `reports/T026-impl.md` |
| 결과물 대조 스크립트 (파일만 읽음) | 12행 | 0 | manifest·링크 파일·구현 보고서 표를 T001 표·시드와 행별 비교 |
| 함수 수준 하네스 (실제 `createPayPalClient` + 가짜 `fetch`, 가짜 시계) | 65 | 0 | `runCreateOrders`·`runCapture`·`readSandboxOrderSpecs`·`loadSandboxEnv` 등. 원본 코드를 그대로 import |
| `main()` 수준 하네스 (스크래치 사본) | 25 | 0 | 아래 "main() 수준을 돌린 방법" 참고 |
| 진입점 가드 확인 (스크래치 사본, 자격 증명 없음) | 2 | 0 | `tsx scripts/capture-sandbox-orders.ts`·`create-…` → 둘 다 "`.env`에 … 없다" 한 줄 + 종료 코드 1, 파일 쓰기 없음. 진입점이 실제로 `main()`을 시작한다는 확인 |
| `git status -s` (끝) | — | — | `?? reports/T026-verify.md` 한 줄 |

**main() 수준을 돌린 방법 (투명하게 적는다).** `main()`은 클라이언트를 주입받지 않으므로, `scripts/`·`seed/`·`src/`를 스크래치 폴더에 그대로 복사하고(`diff -r`로 동일 확인, `.env` 없음) 그 사본에서 `main()`을 불렀다. 전역 `fetch`를 가짜 PayPal로 바꾸고, 자격 증명은 프로세스 안에서 만든 가짜 값만 넣었으며, 프로세스 전체를 OS 수준에서 외부 IP 연결 차단(`sandbox-exec … deny network-outbound`) 상태로 돌렸다 (차단 확인: 일반 `fetch`가 `EPERM`). 파일 쓰기는 사본 안에서만 일어났다. 원본 저장소에서는 `main()`을 부르지 않았다.

## 결과물 대조 (manifest, 링크 파일)
기준: `tasks/T001.md` "주문 12건 배정" 표. 금액은 `seed/products.json` 가격. 구현 보고서의 주문 ID 표도 함께 대조했다.

| 주문 | 구매자 | 상품·금액 | 추적 | 링크 도메인·token 일치 | 판정 |
|---|---|---|---|---|---|
| O01 `9ET81805AB9247946` | seoyeon = Seoyeon Kim | Wool Sweater, Navy · FK-SW-NV · $72.00 | 등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O02 `5J704232P71983619` | jiho = Jiho Park | Knit Cardigan, Oat · FK-CD-OAT · $48.00 | 미등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O03 `4BC01975WG886551L` | yuki = Yuki Tanaka | Knit Cardigan, Oat · FK-CD-OAT · $48.00 | 미등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O04 `0LA77641A9101490G` | yuki = Yuki Tanaka | Wool Sweater, Navy · FK-SW-NV · $72.00 | 미등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O05 `9W409470WN743960Y` | yuki = Yuki Tanaka | Beanie + Scarf Set · FK-BN-SET · $35.00 | 미등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O06 `60A07934HY930524R` | lena = Lena Mueller | Beanie + Scarf Set · FK-BN-SET · $35.00 | 등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O07 `2GK62605DF520833E` | lena = Lena Mueller | Knit Cardigan, Oat · FK-CD-OAT · $48.00 | 미등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O08 `4E5425170D714234X` | buyer_m = Mike Morgan | Beanie + Scarf Set · FK-BN-SET · $35.00 | 등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O09 `1VU57699F6239261R` | buyer_m = Mike Morgan | Beanie + Scarf Set · FK-BN-SET · $35.00 | 등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O10 `1KG27296T6352720H` | buyer_m = Mike Morgan | Beanie + Scarf Set · FK-BN-SET · $35.00 | 등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O11 `37M54694X6556714J` | buyer_m = Mike Morgan | Beanie + Scarf Set · FK-BN-SET · $35.00 | 등록 | www.sandbox.paypal.com · 일치 | 일치 |
| O12 `8K5917389U7016629` | buyer_m = Mike Morgan | Knit Cardigan, Oat · FK-CD-OAT · $48.00 | 등록 | www.sandbox.paypal.com · 일치 | 일치 |

- `tests/sandbox/manifest.json`: 주문 12건, 키 O01~O12 순서, 주문 ID 12개 서로 다름·모두 영대문자+숫자 17자(PayPal 주문 ID 모양), 필드는 `key,orderId,buyer,sku,tracked`뿐, `disputes: []`. AC13 `Manifest` 타입에 맞는다. 구매자별 주문 수 1·1·3·2·5, 추적 등록 7건(O01, O06, O08~O12)·미등록 5건.
- `reports/sandbox-approve-links.md`: 머리 `| 주문번호 | 구매자 | 금액 | approve URL |`, 12행·4열, 구매자 칸은 12행 모두 "시드 키 = 표시 이름", 금액 12행 모두 상품 가격과 같음, URL 12개 모두 `https://www.sandbox.paypal.com/`로 시작하고 쿼리는 `token` 하나이며 그 행의 manifest 주문 ID와 같다. live 도메인 0건, `@` 0건. (URL에는 접속하지 않았다. 형식만 봤다.)
- `reports/T026-impl.md`의 주문 ID 표 12행 = manifest 12행.
- 시드(`seed/orders.json`의 `source: 'sandbox'` 12건)도 T001 표와 행별로 같다 (구매자·SKU·금액·추적).
- PayPal 쪽에 실제로 그 주문이 있는지, 상태가 `CREATED`인지는 **확인하지 않았다** (실호출 금지). 파일끼리의 일치만 확인했다.

## 시나리오 (가짜 클라이언트)
가짜 PayPal은 토큰·주문 생성(요청 ID 멱등)·주문 조회·캡처를 흉내 내고, 응답에 가짜 이메일·payer_id·이름을, 오류 본문의 `message`·`description`과 예외 메시지에 가짜 토큰·Basic 값·Secret을 일부러 심었다.

### create (`scripts/create-sandbox-orders.ts`)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 시드 읽기 | 실제 시드 → 명세 12건을 T001 표와 행별 비교 | 12행 같음 | 12행 같음 | 예 |
| 시드 읽기 | 입력 시드의 O01 상품을 Beanie($35)로 바꿈 | 시드를 읽으므로 명세가 바뀜 (하드코딩 표가 아님) | O01 = Beanie + Scarf Set 35.00 | 예 |
| 시드 어긋남 | 11건 / yuki 2·lena 3 / 추적 8건 / 금액≠상품 가격 / 샌드박스 구매자 아님 / 금액이 정수 아님 | 만들지 않고 던짐 | 6가지 모두 던짐 (사유 문구 포함) | 예 |
| 시드 어긋남 | O01↔O02 추적 여부 맞바꿈 (합 7 유지), 상품 맞바꿈 (건수 유지) | (관찰) | **던지지 않는다** — 건수만 본다. 행별 대조는 `tests/unit/seed.test.ts`가 한다 | — (문제 7) |
| 요청 본문 | 12건 | `intent: CAPTURE`, 상품명이 원문 4종 안, 수량 `"1"`, 금액 문자열, `breakdown.item_total` = 합, USD, 구매자 정보 없음 | 문제 0. O01 = `{"intent":"CAPTURE","purchase_units":[{"reference_id":"O01","amount":{"currency_code":"USD","value":"72.00","breakdown":{"item_total":{…"72.00"}}},"items":[{"name":"Wool Sweater, Navy","quantity":"1","unit_amount":{…"72.00"}}]}]}` | 예 |
| 금액 문자열 | `amountText(1..2,000,000센트)`를 정수 나눗셈 결과와 비교 | 불일치 0 | 불일치 0 (`(cents/100).toFixed(2)`이지만 이 범위에서 어긋나는 값 없음. 7200→`72.00`) | 예 |
| 호출 | 정상 12건 (실제 클라이언트 + 가짜 fetch) | 토큰 1회 + POST 12회, 모두 `https://api-m.sandbox.paypal.com/v2/checkout/orders`, 본문 = `buildOrderBody` | 그대로 | 예 |
| Request-Id | 12건의 `PayPal-Request-Id` 헤더 | `afterloop-order-O01`…`O12`, 서로 다름 | 그대로 | 예 |
| 재실행 | manifest에 12건이 있는 상태로 다시 실행 | 같은 Request-Id → 200 같은 주문, 새 주문 0, manifest 그대로 | Request-Id 동일, `existing` 12, 서버 주문 12건 그대로. **로컬에서 건너뛰지는 않는다 — 12건 모두 다시 POST하고 PayPal 멱등에 맡긴다** | 예 (문제 2) |
| 재실행 | 이미 캡처된 O01(captureId 있음)에 PayPal이 새 주문(201)을 돌려줌 (멱등 보관 기간이 지난 경우) | (관찰) | manifest의 O01이 새 주문 ID로 **바뀌고 captureId가 사라진다**. problems에 한 줄 적힌다 | — (문제 2) |
| 승인 링크 규칙 | approve+payer-action / payer-action만 / 대문자 rel / 없음 / null | approve 우선, 없으면 payer-action, 없으면 빈 값 | 그대로. 링크가 없으면 주문 ID는 manifest에 적고 링크 칸에 사유, 종료 코드 1 | 예 |
| 승인 링크 도메인 | `approveUrlKind` 11가지 (live, `…sandbox.paypal.com.evil.test`, 샌드박스 호스트를 userinfo 자리에 넣은 주소, http, 대문자 등) | 샌드박스만 `sandbox` | 11가지 모두 기대대로 | 예 |
| 승인 링크 도메인 | 첫 응답의 approve 링크가 `www.paypal.com` / 유사 도메인 | 그 자리에서 멈춤, 문구에 도메인만 | `NotSandboxLinkError`, POST 1회에서 멈춤. main: 종료 코드 1, manifest·링크 파일 쓰지 않음 | 예 |
| 부분 실패 | O03→422, O07→네트워크 예외, O09→500×3, 나머지 201 (manifest에 O03 이전 ID 있음) | 실패 건만 failed, 나머지 계속, 이전 ID 유지 | failed 3·created 9, O03 이전 ID 유지, 비고는 `name · issue · debug_id`만 | 예 |
| 부분 실패 (main) | 재실행 중 O03→422, O07→네트워크 예외 | 종료 코드 1, manifest 12건 유지 | 종료 코드 1, manifest 그대로, stderr "승인 링크가 10/12건만 모였다". **링크 파일의 O03·O07 행은 "승인 링크 없음 — 사유"로 덮인다 (이전 링크가 사라짐)** | 예 (문제 3) |
| main 정상 | 12건 | 종료 코드 0, manifest 12건, 링크 12행 | 그대로. fetch 13회. manifest에 있던 `disputes`는 보존 | 예 |

### capture (`scripts/capture-sandbox-orders.ts`, 실행된 적 없는 코드)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 분기 | 12건: APPROVED×5, COMPLETED×2, CREATED×2, PAYER_ACTION_REQUIRED×1, 404×1, VOIDED×1 | 캡처 5, 건너뜀 2, 승인 전 3(+VOIDED), 실패 1. GET 12·POST 5 | `captured`×5 `skipped`×2 `pending`×4 `failed`×1 · GET 12 · POST 5 | 예 |
| 승인 전 | CREATED·PAYER_ACTION_REQUIRED | POST 없음, 건별 "not approved yet" 출력 후 계속 | `O08 (주문 ID): not approved yet · 주문 상태 CREATED` 꼴 4줄, 캡처 POST는 승인된 5건에만 | 예 |
| 404 | 주문 조회 → 404 `RESOURCE_NOT_FOUND` | failed로 적고 계속, manifest 항목 유지 | `주문 조회 → RESOURCE_NOT_FOUND · INVALID_RESOURCE_ID · debug_id=…`, 다음 주문 계속, 항목 그대로 | 예 |
| 그 밖의 상태 | VOIDED, status 없음 | (관찰) | 둘 다 `pending · not approved yet`으로 분류 (표의 "주문 상태" 칸에 `VOIDED`가 보인다) | — (문제 5) |
| 캡처 요청 | 실제 클라이언트가 보낸 캡처 1건 | `POST …/v2/checkout/orders/{id}/capture`, `PayPal-Request-Id: afterloop-capture-O01`, `Content-Type: application/json`, 본문 `{}` | 그대로 | 예 |
| 캡처 ID | manifest에 적히는 값 | 캡처 응답의 `purchase_units[].payments.captures[].id`. COMPLETED면 주문 상세에서 | 그대로. 다른 필드(키·주문 ID·구매자·SKU·추적)와 순서, `disputes`는 그대로 | 예 |
| 일부만 승인 (main) | 12건 중 O01~O05만 승인 | 캡처 5, 나머지는 건별 안내, 종료 코드 1 | 요약 `캡처 5 · 이미 캡처됨 0 · 승인 전 7 · 실패 0`, stderr `아직 승인 전인 주문 7건(O06, …, O12)`, manifest에 캡처 ID 5개, **종료 코드 1** | 예 |
| 재실행 (main) | 나머지 7건 승인 뒤 다시 | 나머지만 캡처 | POST 7회(나머지만), 앞 5건은 `skipped`·캡처 ID 그대로, 12건 모두 캡처 ID, 종료 코드 0 | 예 |
| 재실행 (main) | 12건 모두 캡처된 뒤 한 번 더 | POST 0회 | POST 0회, manifest 그대로, 종료 코드 0 | 예 |
| 응답 유실 | PayPal에서는 캡처됐는데 응답이 끊김 | 재시도는 같은 Request-Id, 다시 실행하면 건너뛰며 캡처 ID 기록 | 1차 failed(POST 3회 모두 같은 Request-Id), 2차 `skipped` + 캡처 ID 기록 | 예 |
| 캡처 오류 | 422 `ORDER_NOT_APPROVED` / 500×3 / 조회 401 반복 / 조회 네트워크 예외 | 그 건만 failed, 다음 주문 계속 | 네 가지 모두 failed + 다음 주문 계속. 캡처 ID 기록 없음 | 예 |
| 경합 | 422 `ORDER_ALREADY_CAPTURED` | 주문을 다시 읽어 캡처 ID 기록 | `skipped`, 캡처 ID 기록 | 예 |
| 재전송 | 캡처 POST → 200 (같은 Request-Id에 이전 결과) | 캡처 ID 기록 | `captured`, 캡처 ID 기록 | 예 |
| 캡처 ID 없음 | 201인데 `captures` 없음 / COMPLETED인데 상세에 `captures` 없음 | 문제로 적고 종료 코드 1 | problems에 한 줄, 캡처 ID 없음 → main 종료 코드 식에서 1 | 예 |
| 캡처 상태 | 201, `captures[0].status`가 `DECLINED` / `PENDING` | (관찰) | **`captured · ok`로 적고 캡처 ID를 기록한다 — 캡처 자체의 상태는 보지 않는다** | — (문제 4) |
| path | manifest 주문 ID가 `../../v1/…`, `A B`, `ID?x=1#y`, `https://evil.test/a`, `..` | 다른 경로·호스트로 새지 않음 | `encodeURIComponent`로 `%2F`·`%20`·`%3F` 처리, 모두 샌드박스 origin. 형식(영숫자 17자) 검증은 없다 (`..`은 그대로 들어간다) | 예 (문제 8) |
| 빈 manifest (main) | 주문 0건 | 호출 0회, 종료 코드 1 | fetch 0회, "manifest에 주문이 없다 …", 종료 코드 1 | 예 |
| 틀린 manifest (main) | `orderId` 없는 항목 | 호출 0회로 실패 | `readManifest`가 던짐(필드 경로만), fetch 0회 | 예 |
| 만료 (main) | 12건 모두 404 | 종료 코드 1, manifest 그대로 | 요약 `실패 12`, POST 0회, manifest 그대로, 종료 코드 1 | 예 |

## 비밀값·샌드박스 확인
| 항목 | 판정 | 근거 |
|---|---|---|
| 저장소에 `.env` 없음 | 통과 | `git ls-files`에서 `.env`로 시작하는 것은 `.env.example`뿐 (값 비어 있음). `.gitignore`가 `.env*`를 무시 |
| 추적 파일에 Client ID 꼴(영숫자·`-`·`_` 40자 이상) | 통과 | T026 파일 7개 + `tests/sandbox/last-run.md`, 그리고 diff 추가 줄 전체에서 0건 |
| `Bearer `·`Basic ` 뒤의 값, `access_token` 값 | 통과 | 0건. `access_token`이라는 낱말은 "없어야 한다"는 테스트 정규식과 보고서 설명에만 있다 |
| 이메일 주소 | 통과 | 결과물(manifest·링크 파일·last-run·보고서)·스크립트에 0건. `tests/unit/sandbox-orders.test.ts` 476행에 가짜 주소 1개(`…@example.test`, 예약 도메인)가 "새지 않는다"를 확인하는 테스트 입력으로 있다 — 실제 주소가 아니다 |
| live 도메인 | 통과 | 결과물 0건. 단위 테스트 4곳에만 "거부되는지" 보는 입력으로 있다 |
| 샌드박스 외 `PAYPAL_BASE_URL` → 호출 0회 (`sandbox:orders`·`sandbox:capture` 둘 다) | 통과 | `main()`에 `https://api-m.paypal.com`, `…sandbox.paypal.com.evil.test`, `http://…`, 값 없음을 넣음 → 8가지 모두 종료 코드 1, **fetch 0회**, manifest·링크 파일 그대로, 받은 값은 출력하지 않음 |
| 그 거부가 코드로 보장되는지 | 통과 | 3겹이다. ① `loadSandboxEnv`가 `https://api-m.sandbox.paypal.com`과 **완전 일치**(끝 슬래시만 허용)가 아니면 클라이언트를 만들기 전에 던진다 ② `createPayPalClient`가 같은 검사를 다시 한다 ③ 호출마다 path를 붙인 URL의 origin을 확인한다. 단위 테스트: `tests/unit/sandbox-setup.test.ts`의 `loadSandboxEnv` 3개, `tests/unit/client.test.ts`의 샌드박스 외 baseUrl 묶음. (`sandbox-orders.test.ts`에는 `main()` 수준 테스트가 없다 — 문제 6) |
| 구현 세션의 거부된 명령 (`PAYPAL_BASE_URL=https://api-m.paypal.com npm run sandbox:orders`) | 문제 없음 | 실행됐더라도 위 ①에서 호출 0회로 끝난다 (같은 값을 `main()`에 넣어 확인) |
| 환경 변수 덤프 | 통과 | 두 스크립트에 `process.env` 사용 0곳. `scripts/sandbox/env.ts`만 읽고, 오류 문구에는 키 이름만 넣는다 |
| 가짜 Secret·토큰 누출: 정상 실행 | 통과 | create·capture의 rows·problems·로그 줄·stdout·stderr·manifest·링크 파일에서 가짜 Secret·Basic 값·토큰·Client ID 0건 |
| 〃 401 (잘못된 Secret) | 통과 | create·capture `main()` 모두 종료 코드 1, 주문 호출 0회, manifest 그대로. 문구는 `PayPal /v1/oauth2/token → 401: 액세스 토큰 발급 실패 …`뿐 |
| 〃 네트워크 예외 (메시지에 토큰·Basic·Secret을 심음) | 통과 | 클라이언트의 `redact`가 `[redacted]`로 바꾼다 |
| 〃 PayPal 오류 본문 (`message`에 토큰, `description`에 이메일을 심음) | 통과 | `errorSummary`가 `name`·`details[].issue`·`debug_id`만 뽑는다. `message`·`description`은 싣지 않는다 |
| 구매자 개인정보 | 통과 | 응답의 payer 이메일·payer_id·이름·주소는 어떤 출력·파일에도 실리지 않는다. 링크 파일의 표시 이름 5개는 스크립트 상수(지시서의 샌드박스 계정 이름) |

### 출력 경로에 실리는 것
| 스크립트 | 경로 | 실리는 것 |
|---|---|---|
| orders | stdout: 클라이언트 로그 줄 (`  · …`) | `token issued · valid for Ns`(값 없음), `POST /v2/checkout/orders → 201`, 재시도·속도 제한 안내. 모두 `redact`를 지난다 |
| orders | stdout: 결과 표 | 키, 구매자 키, 상품명, 금액, 결과, HTTP 상태, 주문 ID, 주문 상태, 비고(`ok` / `name · issue · debug_id` / 클라이언트 오류 문구 / 이전 주문 ID) |
| orders | stdout: 요약·문제 | 건수, 링크 파일 상대 경로, 문제 줄(표의 비고와 같은 내용) |
| orders | stderr | 시드 오류 문구, `SandboxEnvError` 문구(키 이름·허용 주소만), 승인 링크 도메인 경고(주문 키 + 호스트 이름만), "승인 링크가 n/12건만 모였다" |
| orders | `tests/sandbox/manifest.json` | 키, 주문 ID, 구매자 키, SKU, 추적 여부 (있으면 캡처 ID) |
| orders | `reports/sandbox-approve-links.md` | 덮어쓴 시각, 안내 3줄, 12행(키, 구매자 키 = 표시 이름, 금액, 승인 URL 또는 "승인 링크 없음 — 사유") |
| capture | stdout: 클라이언트 로그 줄 | `GET /v2/checkout/orders/{주문 ID} → 200`, `POST …/capture → 201` |
| capture | stdout: 승인 전 안내 | `O06 (주문 ID): not approved yet · 주문 상태 CREATED` |
| capture | stdout: 결과 표·요약·문제 | 키, 주문 ID, 결과, 주문 상태, HTTP 상태, 캡처 ID, 비고 / `캡처 n · 이미 캡처됨 n · 승인 전 n · 실패 n` |
| capture | stderr | `SandboxEnvError` 문구, "manifest에 주문이 없다", 승인 전 주문 키 목록 |
| capture | `tests/sandbox/manifest.json` | 위와 같음 + `captureId` |
| 둘 다 | 실리지 않는 것 | Client ID, Secret, Basic 값, 액세스 토큰, Authorization 헤더, 응답 본문, payer 정보, `PAYPAL_BASE_URL` 값 |

## 발견한 문제
**병합 차단: 없음.**

### 캡처 실행(아침) 전에 알아야 할 것
1. **[운영 · 가장 중요] 지금 만든 주문 12건은 아침에는 만료돼 있을 가능성이 높다.** 주문은 2026-11-09 23:13 KST에 만들어졌다. PayPal 문서(웹 검색으로 확인. 샌드박스에서 직접 확인하지는 않았다)에 따르면 주문은 만든 뒤 **3시간 안에** 캡처해야 하고(연장은 계정 담당자를 통해서만), Orders v2의 `PayPal-Request-Id`는 **6시간** 보관된다. 즉 02:13 KST쯤 주문이 만료되고, 05:13 KST쯤부터는 같은 요청 ID로도 새 주문이 만들어진다.
   - 만료된 채로 진행하면: 승인 화면이 오류를 내거나, 승인이 안 된 채 `sandbox:capture`가 12건을 `failed`(404) 또는 `not approved yet`으로 적고 종료 코드 1로 끝난다. manifest는 바뀌지 않는다 (가짜로 확인).
   - 권장 순서: 아침에 **승인 직전에 `npm run sandbox:orders`를 다시 실행** → 새 주문 ID 12개가 나오면 스크립트가 "문제:" 12줄(이전 ID 대신 새 주문이 생겼다)을 출력하지만 **종료 코드는 0**이고 manifest·링크 파일이 새 ID로 바뀐다 (정상 동작이다) → **3시간 안에** 12건 승인 + `npm run sandbox:capture` → 바뀐 manifest·링크 파일 커밋.
   - 걸릴 수 있는 지점: 재실행했는데 12건이 모두 `existing`(200, 같은 ID)으로 돌아오면 PayPal이 아직 예전 주문을 돌려주는 것이다. 그 주문이 만료 상태라면 **새 주문을 강제로 만들 방법이 코드에 없다** (요청 ID가 주문 키로 고정, 회차를 붙이는 옵션 없음). 시간이 더 지난 뒤 다시 실행하거나 코드 수정이 필요하다.
   - 출처: [Orders v2 통합 안내 (3시간)](https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/standard/), [Orders v2 API 참조 (요청 ID 6시간)](https://developer.paypal.com/docs/api/orders/v2/orders-capture), [멱등성 안내](https://developer.paypal.com/api/rest/reference/idempotency/)
2. **[병합 후 수정] `sandbox:orders`는 이미 있는 주문을 로컬에서 건너뛰지 않는다.** 항상 12건을 다시 POST하고 PayPal 멱등(6시간)에 맡긴다. 보관 기간이 지난 뒤 다시 실행하면 새 주문 12건이 생기고 manifest가 새 ID로 **덮이며 `captureId`가 사라진다** (가짜로 확인). 캡처·분쟁 접수가 끝난 뒤에 실수로 다시 실행하면 manifest와 분쟁 3건의 연결이 끊어진다. → **캡처가 끝난 뒤에는 `sandbox:orders`를 다시 실행하지 않는다.** 코드로 막으려면 `captureId`가 있는 키는 건너뛰게 하면 된다.
3. **[의견] 재실행이 실패하면 링크 파일의 그 행이 "승인 링크 없음"으로 덮인다.** 토큰 401이면 12행 전부가 덮인다 (manifest는 그대로). 링크는 `https://www.sandbox.paypal.com/checkoutnow?token=<주문 ID>` 꼴이라 manifest로 되살릴 수 있고, 성공한 재실행이 다시 채운다.
4. **[병합 후 수정] 캡처 스크립트는 캡처 자체의 상태를 보지 않는다.** 응답이 201이고 캡처 ID가 있으면 `captured · ok`, 종료 코드 0이다. `captures[0].status`가 `PENDING`(결제 보류)이나 `DECLINED`여도 같다. 아침에 `sandbox:capture`가 0으로 끝난 뒤에도 `npm run sandbox:check`로 12건이 `COMPLETED`인지 한 번 더 봐야 한다.
5. **[의견] `VOIDED` 같은 "승인될 수 없는" 상태도 `not approved yet`으로 분류된다.** 표의 "주문 상태" 칸에 실제 상태가 찍히므로 구분은 된다. 같은 주문이 계속 승인 전으로 나오면 그 칸을 본다.
6. **[그 밖에 아침에 실패할 수 있는 지점]**
   - `.env`와 최신 manifest가 **같은 worktree**에 있어야 한다. `.env`가 없는 폴더에서 돌리면 "`.env`에 … 없다" + 종료 코드 1 (호출 0회). 캡처 결과는 그 폴더의 manifest에 쓰이므로 커밋도 거기서 해야 한다.
   - 일부만 승인된 채 실행하면 종료 코드 1이 정상이다. 승인 전 주문 키가 stderr에 나오고, 다시 실행하면 나머지만 캡처한다 (확인됨).
   - 주문 본문에 `return_url`이 없다. 승인 뒤 브라우저에 완료 화면이 뚜렷하게 나오지 않을 수 있다. 승인 여부는 화면이 아니라 `sandbox:capture`의 건별 결과로 판단한다.
   - 한국 개인 계정이 샌드박스 결제에서 막히면(SPEC 9-5) 그 주문은 `CREATED`로 남아 `not approved yet`이 된다.
   - 캡처가 422(예: 결제 수단 거절)로 실패하면 그 건만 `failed`이고 `name · issue · debug_id`가 찍힌다. 다시 실행할 때 요청 ID가 같다(`afterloop-capture-Oxx`) — PayPal이 6시간 안의 같은 요청 ID에 이전 오류를 그대로 돌려주는지는 실호출 없이 확인할 수 없었다.
   - 캡처 요청 ID가 주문 ID가 아니라 주문 키 기준이다. 캡처를 한 번 시도한 뒤 6시간 안에 주문을 새로 만들어 다시 캡처하면 같은 요청 ID가 다른 주문 URL로 나간다. 첫 캡처에는 해당 없다.
   - 호출 수는 토큰 1 + 조회 12 + 캡처 12 = 25회라 분당 30회 제한에 걸리지 않는다.

### 코드·테스트
7. **[의견] 시드 대조가 건수 기준이다.** `readSandboxOrderSpecs`는 총 12건·구매자별 주문 수·추적 7건만 확인한다. 건수를 유지한 채 행이 바뀌면(추적 여부나 상품 맞바꿈) 통과한다. 행별 대조는 `tests/unit/seed.test.ts`가 하고 있어 `npm test`가 잡는다. 지금 시드는 T001 표와 행별로 같다.
8. **[의견] manifest의 주문 ID 형식을 검증하지 않는다.** path에 넣을 때 `encodeURIComponent`만 한다 (`/`·공백·`?`는 인코딩되고 origin은 클라이언트가 지킨다). manifest는 스크립트가 PayPal 응답으로 쓰는 파일이라 실제 위험은 낮다.
9. **[병합 후 수정] 단위 테스트의 빈 곳.** 지시서 완료 기준은 "가짜 `fetch` 주입"인데 `sandbox-orders.test.ts`는 가짜 **클라이언트**를 넣는다. 그래서 ⓐ "비밀값이 출력에 없다" 테스트는 비밀값을 가진 적이 없는 가짜를 검사한다 (실패할 수 없는 테스트) ⓑ `PayPal-Request-Id`·`Content-Type` 헤더는 HTTP 수준에서 보지 않는다 ⓒ `main()`(종료 코드, 파일 쓰기, 샌드박스 외 주소 0회 호출)은 테스트가 없다. 동작 자체는 이번 검증에서 실제 클라이언트 + 가짜 fetch로 확인했고 문제가 없었다 (90개 확인). 테스트만 보강하면 된다.

### 구현 보고서와 다른 곳
- 틀린 주장은 찾지 못했다. 테스트 수(29 / 493), `tsc`·lint 결과, 바뀐 파일 목록, 주문 ID 표, 링크 형식이 직접 확인한 것과 같다.
- **확인할 수 없었던 주장**: "12건 모두 201 CREATED", "실호출 13회", "종료 코드 0". 실호출을 하지 않아 PayPal 쪽 상태는 보지 못했다. 파일(주문 ID 12개, 링크 12개)과 모순은 없다.
- "비밀값·개인정보 없음을 단위 테스트가 확인"은 문제 9ⓐ의 한계가 있다 (결론은 맞지만 그 테스트가 증명하는 것은 아니다).
- "주문은 오래 두면 만료된다"는 구체적인 시간이 빠져 있다. 문서 기준 3시간이고, 아침 승인 계획과 맞지 않는다 (문제 1).
- 보고서 머리 시각(23:20)이 그 보고서를 담은 커밋 시각(23:15)보다 늦다. 내용에는 영향 없다.

## 컨트롤 타워가 결정할 것
1. **아침 진행 순서** (문제 1): 승인 직전에 `sandbox:orders`를 다시 실행해 새 링크로 승인하고 3시간 안에 캡처할지. 그 경우 지금 커밋된 manifest·링크 파일의 주문 ID 12개는 버려지고 새 ID로 다시 커밋해야 한다. 브라우저 에이전트에게는 **다시 만든 뒤의** 링크 파일을 줘야 한다. (먼저 지금 링크 1개로 만료 여부를 사람이 확인하는 방법도 있다.)
2. **`sandbox:orders` 재실행 보호** (문제 2·4·9): 캡처된 주문 건너뛰기, 캡처 상태 확인, 테스트 보강을 후속 작업으로 낼지, "캡처 뒤 재실행 금지 + 캡처 뒤 `sandbox:check`"를 운영 규칙으로만 둘지.
3. **`reports/sandbox-approve-links.md`를 커밋에 둘지** (구현 보고서의 질문): 비밀값·이메일은 없다. 다만 재실행마다 바뀌고, 문제 1 때문에 지금 커밋된 내용은 곧 쓸모없어진다.
4. manifest의 `captureId` 필드를 AC13 계약에 적을지 (구현 보고서 요청 2번): AC13은 이 필드를 읽지 않고, 있어도 통과에 영향이 없다. 계약 변경 없이 진행할 수 있다.
