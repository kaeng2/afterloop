# T026 보고 (2026-11-09 23:20)

- 기준 SPEC: v2.2 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/paypal / 09ab38a (구현·주문 생성 결과) + 이 보고서 커밋

## 결과
**완료 (사람 작업 대기).** `npm run sandbox:orders`를 한 번 실행해 샌드박스 주문 12건(O01~O12)을 만들었다 — 12건 모두 `201 CREATED`, 승인 링크 12개를 `reports/sandbox-approve-links.md`에 썼고 주문 ID를 `tests/sandbox/manifest.json`에 적었다. 캡처 스크립트(`npm run sandbox:capture`)는 만들고 가짜 클라이언트 단위 테스트까지만 했다 (지시대로 **실행하지 않았다**). 다음은 브라우저 에이전트의 승인 12회다.

## 만든 주문 12건 (2026-11-09 23:13 KST)
`POST /v2/checkout/orders` · intent CAPTURE · USD · `items[].name`은 원문 6-1 상품명 · 배정은 `tasks/T001.md` 표.

| 키 | 구매자 | 상품 | 금액 | 요청 ID | 주문 ID | HTTP | 주문 상태 |
|---|---|---|---|---|---|---|---|
| O01 | seoyeon | Wool Sweater, Navy | $72.00 | `afterloop-order-O01` | 9ET81805AB9247946 | 201 | CREATED |
| O02 | jiho | Knit Cardigan, Oat | $48.00 | `afterloop-order-O02` | 5J704232P71983619 | 201 | CREATED |
| O03 | yuki | Knit Cardigan, Oat | $48.00 | `afterloop-order-O03` | 4BC01975WG886551L | 201 | CREATED |
| O04 | yuki | Wool Sweater, Navy | $72.00 | `afterloop-order-O04` | 0LA77641A9101490G | 201 | CREATED |
| O05 | yuki | Beanie + Scarf Set | $35.00 | `afterloop-order-O05` | 9W409470WN743960Y | 201 | CREATED |
| O06 | lena | Beanie + Scarf Set | $35.00 | `afterloop-order-O06` | 60A07934HY930524R | 201 | CREATED |
| O07 | lena | Knit Cardigan, Oat | $48.00 | `afterloop-order-O07` | 2GK62605DF520833E | 201 | CREATED |
| O08 | buyer_m | Beanie + Scarf Set | $35.00 | `afterloop-order-O08` | 4E5425170D714234X | 201 | CREATED |
| O09 | buyer_m | Beanie + Scarf Set | $35.00 | `afterloop-order-O09` | 1VU57699F6239261R | 201 | CREATED |
| O10 | buyer_m | Beanie + Scarf Set | $35.00 | `afterloop-order-O10` | 1KG27296T6352720H | 201 | CREATED |
| O11 | buyer_m | Beanie + Scarf Set | $35.00 | `afterloop-order-O11` | 37M54694X6556714J | 201 | CREATED |
| O12 | buyer_m | Knit Cardigan, Oat | $48.00 | `afterloop-order-O12` | 8K5917389U7016629 | 201 | CREATED |

- 실패 0건. 종료 코드 0. `CREATED` = 아직 구매자 승인 전이라는 뜻이다 (승인하면 `APPROVED`, 캡처하면 `COMPLETED`).
- 구매자별 주문 수: 서연 1 · 지호 1 · Yuki 3 · Lena 2 · buyer_m 5 (합 12, 원문 6-2). 추적 대상 7건(O01, O06, O08~O12)은 manifest의 `tracked: true`로 들어갔다 — 등록 자체는 T001 2단계(`sandbox:setup -- track`)가 캡처 뒤에 한다.
- 승인 링크 12개는 전부 `https://www.sandbox.paypal.com/checkoutnow?token=<주문 ID>` 꼴이다. 비(非)샌드박스 도메인은 0건 (`grep`으로 확인). live PayPal 응답·URL은 한 번도 보지 못했다.
- T001이 길이 확인용으로 만든 버려진 주문 2건(`4VU53650HC418403N`, `7SB1374355564260G`)은 건드리지 않았다. manifest에도 없다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `scripts/create-sandbox-orders.ts` | `npm run sandbox:orders`. 시드(`seed/orders.json`·`seed/products.json`)에서 샌드박스 12건을 읽어 T001 표(건수·구매자별 주문 수·추적 7건)와 대조한 뒤 `POST /v2/checkout/orders` 12회. 승인 링크 파일과 manifest를 쓴다. 승인 링크가 샌드박스가 아니면 그 자리에서 멈춘다 |
| `scripts/capture-sandbox-orders.ts` | `npm run sandbox:capture`. manifest 주문마다 상태 조회 → `APPROVED`면 캡처, `COMPLETED`면 건너뜀, 그 밖이면 `not approved yet`을 적고 계속. 캡처 ID를 manifest에 적는다. **이번에 실행하지 않았다** |
| `tests/unit/sandbox-orders.test.ts` | 단위 테스트 29개. 가짜 PayPal 클라이언트만 쓴다 (실호출 0회) |
| `package.json` | `scripts`에 `sandbox:orders`, `sandbox:capture` 두 줄 추가 |
| `tests/sandbox/manifest.json` | `orders` 12건 기록 (키·주문 ID·구매자 키·SKU·추적). `disputes`는 빈 채로 둠 (T001 `disputes` 단계 몫) |
| `reports/sandbox-approve-links.md` | 승인 안내 3줄 + `주문번호 \| 구매자 \| 금액 \| approve URL` 12행 (스크립트가 덮어쓴다) |

- PayPal 호출은 `createPayPalClient`(`@/paypal/client`)만 쓴다 (`scripts/sandbox/paypal.ts`의 `createSandboxClient`). `fetch`를 직접 쓴 곳은 없다.
- T001 1단계의 `scripts/sandbox/`(`env`·`paypal`·`manifest`·`last-run`)를 그대로 재사용했다. 그 폴더의 파일은 고치지 않았다.
- 두 스크립트는 진입점을 `process.argv[1]`의 파일명으로 구분한다 — 단위 테스트가 import할 때 `main()`이 돌아 실제 PayPal을 부르지 않게 하려는 것이다 (`check.ts`/`check-steps.ts`처럼 파일을 둘로 나누면 `scripts/sandbox/`에 새 파일을 만들어야 하는데 그 폴더는 T026 "수정 가능 폴더"가 아니다).

## 재실행 안전성 (중복 생성 방지)
- `PayPal-Request-Id`가 주문 키 기준(`afterloop-order-O01` …)이라 같은 명령을 다시 돌리면 PayPal이 같은 주문을 `200`으로 돌려준다 (T001이 61자 ID로 확인한 멱등 동작). 단위 테스트가 "두 번째 실행 → 전부 `existing`, manifest 주문 ID 그대로, 12건 유지"를 확인한다.
- 지시대로 **실제 실행은 1회만** 했다 (12 POST). 멱등은 샌드박스에서 다시 확인하지 않았다 — T001 보고서의 확인 결과를 근거로 삼았다.
- 만약 멱등 창이 지나 다른 주문 ID가 돌아오면 스크립트가 "manifest에 있던 주문 ID와 다른 ID가 돌아왔다"를 문제로 출력하고 새 주문 ID를 적는다 (조용히 넘기지 않는다).

## 비밀값 확인
- 이 세션은 `.env`를 읽지 않았다 (Read·cat·grep 모두 쓰지 않았다). 스크립트만 런타임에 `process.loadEnvFile`로 읽고, 값은 어디에도 출력하지 않는다.
- 실행 출력은 `token issued · valid for 31593s`(토큰 값 없음), `POST /v2/checkout/orders → 201` 12줄, 결과 표뿐이다. Client ID·Secret·액세스 토큰·Authorization 헤더는 없다.
- `reports/sandbox-approve-links.md`와 `tests/sandbox/manifest.json`을 `access_token|bearer|authorization|client_secret|basic`으로 검사 → 0건.
- 링크 파일의 구매자 칸은 시드 키 + 샌드박스 계정 표시 이름(`seoyeon = Seoyeon Kim` …)만 적는다. 이메일·`payer_id`·이름 원문은 없다 (`@` 문자 0건, 단위 테스트도 확인).
- manifest에는 주문 ID·키·SKU·추적 여부만 들어간다 (T001 형식 그대로. AC13이 읽는 모양).
- `git status`에 `.env`가 뜨지 않는다. 커밋은 파일을 하나씩 `git add`했다. `main`에는 커밋·병합·푸시하지 않았다.
- `PAYPAL_BASE_URL`이 샌드박스가 아니면 `loadSandboxEnv`가 호출 전에 던진다 (T001의 단위 테스트가 확인). 환경 변수를 앞에 붙인 명령은 이 worktree 잠금이 막아 실행하지 못했고, 그 길로 돌아가지 않았다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/unit/sandbox-orders.test.ts` | 29 | 0 | 시드 대조, 요청 본문·요청 ID, 재실행 멱등, 승인 링크 도메인, 링크 파일 형식, 캡처 3분기, 비밀값·개인정보 없음 |
| `npm test` | 493 | 0 | 위 29개 포함 |
| `npm run test:acceptance` | — | — | 돌리지 않았다. AC13은 `RUN_SANDBOX=1`일 때만 샌드박스 9개를 보는데 캡처·분쟁이 아직 없어 통과할 수 없다 (T001 2단계 몫). 오프라인 2개는 T001에서 이미 통과 |
| `npx tsc --noEmit` | 오류 0 | — | 저장소 전체 0건 (T001 때 있던 `seed/` 오류 16개는 그 뒤 해결됨) |
| `npm run lint` | 통과 | — | 경고 없음 |
| `npm run sandbox:orders` | 종료 0 | — | 위 "만든 주문 12건". 실호출 13회 (토큰 1 + POST 12) |

## 실호출 범위
토큰 발급 1회와 `POST /v2/checkout/orders` 12회만 불렀다. 캡처·추적 등록·분쟁 조회·분쟁 상태 변경은 한 번도 부르지 않았다. `PAYPAL_BASE_URL`은 샌드박스였고 live 화면·응답·URL은 없었다.

## 남은 문제
- **사람·브라우저 에이전트 승인 12회가 남았다.** `reports/sandbox-approve-links.md`의 링크를 각 구매자 계정으로 승인해야 주문이 `APPROVED`가 된다. 승인 전에는 캡처가 되지 않는다 (`not approved yet`).
- **캡처 스크립트는 실호출 0회다.** 가짜 클라이언트 단위 테스트로만 확인했다. 승인 뒤 컨트롤 타워가 `npm run sandbox:capture`를 돌릴 때 처음 실제로 확인된다. 캡처 응답에서 캡처 ID를 읽는 경로(`purchase_units[].payments.captures[].id`)는 T001의 `firstCaptureId`를 그대로 쓴다.
- 샌드박스 주문은 승인하지 않고 오래 두면 만료된다. 승인이 크게 늦어지면 `npm run sandbox:orders`를 다시 돌려야 할 수 있고, 그때 멱등 창이 지났으면 주문 ID가 바뀐다 (스크립트가 그 사실을 문제로 출력하고 manifest·링크 파일을 새 ID로 갱신한다).
- `application_context`(return_url·shipping_preference)를 넣지 않았다. 승인 뒤 브라우저가 PayPal 기본 화면에 머무르는데, 캡처는 주문 ID로 하니 흐름에는 문제가 없다. 브라우저 에이전트가 승인 완료를 확인하기 어렵다고 하면 `return_url`을 넣는 쪽으로 바꿀 수 있다.
- `reports/sandbox-approve-links.md`를 커밋에 넣었다 (지시서 "수정 가능 폴더"에 있다). 승인 토큰이 들어 있는 링크라 재실행마다 바뀐다 — 커밋에서 빼는 쪽이 낫다면 알려 주면 된다.

## 사람·브라우저 에이전트가 할 일 (다음 단계)
- [ ] 승인 링크 12개를 각 구매자 계정으로 승인 (브라우저 에이전트. `sandbox.paypal.com`만, live 화면이 나오면 중단)
- [ ] 승인 뒤 컨트롤 타워가 `npm run sandbox:capture` (12건 캡처 → manifest에 캡처 ID)
- [ ] 그 뒤 분쟁 3건 접수(사람) → T001 2단계 `sandbox:setup -- track`, `-- disputes` → `RUN_SANDBOX=1` AC13

## 컨트롤 타워에 요청할 결정
1. **단위 테스트 위치.** T026 "수정 가능 폴더"의 `tests/unit/sandbox-orders.test.ts` 그대로 썼다 — 추가 결정 필요 없음. (T001 보고서의 같은 항목이 이미 반영된 것으로 본다)
2. **manifest의 `captureId`.** 캡처 스크립트가 `captureId`(T001이 열어 둔 선택 필드)를 적는다. AC13 계약에는 없는 필드이고 AC13이 읽지도 않으므로 통과에 영향은 없다. 계약(`tests/acceptance/ac13.sandbox.test.ts`)에 적어 넣을지는 T001 보고서 3번과 같은 결정 사항이다.
3. SPEC·`src/types.ts`·인수 테스트는 바꿀 필요가 없었다. 계약 변경 요청 없음.
