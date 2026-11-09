# T029 보고 (2026-11-09 23:35)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `# SPEC v2.2 (2026-11-09 22:31 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal / e46b3e4
- 실호출: **GET 두 가지 + 토큰 발급뿐이다. POST 0회.** `npm run sandbox:disputes` 1회, `npm run sandbox:orders -- --status` 1회. `--fresh`·캡처·추적 등록·`setup`의 `disputes`·`track`은 실행하지 않았다 (코드와 가짜 클라이언트 단위 테스트까지만).
- live PayPal로 보이는 응답: 없음. 응답·로그는 모두 샌드박스(`api-m.sandbox.paypal.com`) 경로였다.

## 결과
완료 — 지시서 4건(분쟁 읽기 명령, `--status`, `--fresh`, `setup`의 `disputes` 덧붙이기)을 모두 만들었고, 실행하라고 한 조회 2건을 각각 1회 돌렸다. 분쟁은 **0건**(아직 접수 전이라 정상), 주문 12건은 모두 살아 있고 **전부 `CREATED`**(승인 전)다. 만료된 링크는 없어서 `--fresh`를 돌릴 이유가 없었다.

## 1. 분쟁 읽기 결과 (`npm run sandbox:disputes`, 실호출 1회)

```
  · token issued · valid for 30590s
  · GET /v1/customer/disputes → 200

0 disputes (empty list)

기록: tests/sandbox/last-run.md
```

| 항목 | 값 |
|---|---|
| 시각 | 2026-11-09 23:30 KST |
| 호출 | 토큰 발급 1회(POST `/v1/oauth2/token`, 클라이언트가 보낸다) + `GET /v1/customer/disputes?page_size=50` 1회 |
| 분쟁 수 | **0건** (`items`가 빈 배열) |
| 건별 상세(`GET /v1/customer/disputes/{id}`) | 0회 (읽을 분쟁이 없다) |
| 종료 코드 | 0 (지시서: 0건이면 정상) |

분쟁이 0건이므로 `disputeId`·`reason`·`stage`·`channel`·`amountCents`·`dueDate`·`allowedMoves` 줄은 나올 것이 없었다. 변환 경로(`listDisputes` → `getDispute` → `toBoardState`)가 실제 응답으로 확인된 것은 **목록 조회까지**다 — 상세 조회와 변환은 가짜 클라이언트 단위 테스트 23개로만 확인했다. 사람이 분쟁 3건(D1~D3)을 접수한 뒤 이 명령을 다시 돌리면 건별 줄이 나온다.

`tests/sandbox/last-run.md`에 "분쟁 읽기" 절이 붙었고, 기존 "조회"·"요청 ID 길이" 절은 바이트 단위로 그대로다 (diff가 추가 9줄뿐).

## 2. 주문 12건 상태 (`npm run sandbox:orders -- --status`, 실호출 1회)

시각 2026-11-09 23:31 KST · 호출: 토큰 발급 1회 + `GET /v2/checkout/orders/{id}` 12회 (전부 200) · POST 0회 · 종료 코드 0

| 키 | 주문 ID | 주문 상태 | HTTP | 캡처 ID | 추적 | 비고 |
|---|---|---|---|---|---|---|
| O01 | 9ET81805AB9247946 | CREATED | 200 | - | 미등록 | ok |
| O02 | 5J704232P71983619 | CREATED | 200 | - | 미등록 | ok |
| O03 | 4BC01975WG886551L | CREATED | 200 | - | 미등록 | ok |
| O04 | 0LA77641A9101490G | CREATED | 200 | - | 미등록 | ok |
| O05 | 9W409470WN743960Y | CREATED | 200 | - | 미등록 | ok |
| O06 | 60A07934HY930524R | CREATED | 200 | - | 미등록 | ok |
| O07 | 2GK62605DF520833E | CREATED | 200 | - | 미등록 | ok |
| O08 | 4E5425170D714234X | CREATED | 200 | - | 미등록 | ok |
| O09 | 1VU57699F6239261R | CREATED | 200 | - | 미등록 | ok |
| O10 | 1KG27296T6352720H | CREATED | 200 | - | 미등록 | ok |
| O11 | 37M54694X6556714J | CREATED | 200 | - | 미등록 | ok |
| O12 | 8K5917389U7016629 | CREATED | 200 | - | 미등록 | ok |

- **만료·404는 0건이다.** T026이 만든 주문 12건이 모두 그대로 있고, `reports/sandbox-approve-links.md`의 링크 12건은 아직 쓸 수 있다 → 아침에 사람이 그 파일을 그대로 쓰면 된다.
- 12건 모두 `CREATED` = 아직 아무도 승인하지 않았다. 그래서 캡처 ID도 추적도 없다 (정상 순서).
- 이번 조회는 주문 생성(23:0x) 직후였다. 승인되지 않은 주문이 언제 만료되는지는 내가 확인한 바가 없다 (PayPal 문서를 읽지 않았고, 만료 응답을 실제로 받아 보지도 않았다 — 지어내지 않는다). 아침에 사람이 승인하려 할 때 링크가 죽어 있으면 그때 `--status`로 확인하고 `--fresh`를 돌려야 한다 — 아래 "컨트롤 타워에 요청할 결정" 1번.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `scripts/sandbox/disputes.ts` (새 파일) | `npm run sandbox:disputes` 진입점. 명령줄(옵션 없음)·출력·종료 코드·`last-run.md` 쓰기만 한다 |
| `scripts/sandbox/disputes-read.ts` (새 파일) | 분쟁 읽기 본체. `listDisputes` → `getDispute` → `toBoardState`(T003 함수 그대로) + 출력 줄·`last-run.md` 절 만들기 |
| `scripts/create-sandbox-orders.ts` | `--status`(`runOrderStatus`, `looksGone`)·`--fresh`(`runFreshOrders`, `freshSuffix`, `pushPreviousOrderId`) 추가, `parseOrdersMode`로 인자 해석, `main(args, now)`로 모드 분기. 기존 생성 경로는 그대로다 |
| `scripts/sandbox/setup-steps.ts` | `mergeDisputes`·`missingDisputeKeys` 추가 (기존 `runDisputes`는 바꾸지 않았다) |
| `scripts/sandbox/setup.ts` | `disputes` 단계가 manifest를 통째로 바꾸지 않고 덧붙인다. D1~D3이 다 모이지 않으면 모자란 키를 알리고 종료 1 |
| `scripts/sandbox/last-run.ts` | 절 이름에 `disputes` 추가 (`## 분쟁 읽기 …`) |
| `scripts/sandbox/manifest.ts` | `ManifestOrder`에 선택 필드 `previousOrderIds?: string[]` 추가 (`--fresh`가 밀어낸 주문 ID) |
| `package.json` | `scripts`에 `"sandbox:disputes"` 한 줄 (+1 −0). 의존성·`package-lock.json` 변화 없음 |
| `tests/unit/sandbox-disputes-read.test.ts` (새 파일) | 단위 테스트 23개 |
| `tests/unit/sandbox-orders.test.ts` | 단위 테스트 +25개 (`--status` 6, `freshSuffix` 3, `--fresh` 8, `parseOrdersMode` 2 등). 기존 24개는 그대로 통과 |
| `tests/sandbox/last-run.md` | 스크립트가 쓴 "분쟁 읽기" 절 (+9줄) |

**바꾸지 않은 것**: `tests/sandbox/manifest.json`, `reports/sandbox-approve-links.md` (`git diff --stat`에 나오지 않는다 — 지금 있는 주문 12건과 링크를 그대로 뒀다), `src/`, `tests/acceptance/`, `seed/`, `config/`, `SPEC.md`, `tasks/`, 그 밖 잠긴 파일 전부.

## 만든 것 (실행하지 않은 2건)

### `npm run sandbox:orders -- --fresh` (코드만)
- 요청 ID: `afterloop-order-O01-r<YYYYMMDDHHmm>` (KST 분 단위). 시각은 **진입점에서 한 번만** 읽어 12건에 같은 접미사를 주입한다 → 같은 분에 다시 돌리면 PayPal이 200으로 같은 주문을 돌려주므로 중복 생성이 없다. 접미사가 없으면(`''`) 호출하지 않고 던진다. 길이는 33자로 T001이 확인한 상한(61자) 안이다.
- 건마다 먼저 기존 주문을 `GET`해서 **`COMPLETED`(캡처됨)이면 새로 만들지 않고** manifest 항목(캡처 ID 포함)을 그대로 둔다. 그 밖(만료·미승인·조회 실패)이면 새로 만든다.
- 밀려난 주문 ID는 manifest의 `previousOrderIds`에 오래된 것부터 쌓인다. 주문이 바뀌면 `captureId`는 이어 쓰지 않는다 (캡처를 다시 해야 하므로).
- 링크 파일은 새 주문 ID로 덮어쓰고, 머리글에 접미사를 적는다. 캡처된 주문 행은 "승인 링크 없음 — 이미 캡처됨 …"으로 사유를 적는다.
- 승인 링크 도메인이 샌드박스가 아니면 그 자리에서 멈춘다 (기존 `NotSandboxLinkError` 그대로).

### `setup -- disputes` 고침
- `mergeDisputes(manifest.disputes, 이번에 찾은 것)`: 같은 키는 갱신, 이번에 못 찾은 키는 전에 적힌 값을 남긴다. 결과는 키 순서로 정렬한다.
- 끝에 `missingDisputeKeys`로 D1·D2·D3을 확인하고, 모자라면 그 키를 stderr에 적고 종료 1. 다 있으면 종료 0.
- T001 검증 보고서의 S10c(분쟁 3건이 적힌 상태에서 D2 조회만 5xx)를 `runDisputes` + `mergeDisputes`로 이어 돌리는 단위 테스트를 넣었다 — 이제 D2가 남는다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 119 | 0 | 9개 건너뜀(`RUN_SANDBOX` 없는 샌드박스 묶음, AC13). T001 검증 때 실패했던 `ac17.seed` 15건은 data 레인 병합으로 지금 전부 통과한다 |
| `npm test` | 629 | 0 | 파일 14개. 이번에 늘어난 것: `sandbox-disputes-read.test.ts` 23 + `sandbox-orders.test.ts` 25 (24 → 49) |
| `npx vitest run tests/unit/sandbox-disputes-read.test.ts` | 23 | 0 | |
| `npx vitest run tests/unit/sandbox-orders.test.ts` | 49 | 0 | |
| `npx tsc --noEmit` | — | 0 | 이번 작업 파일 오류 0. 저장소 전체에서도 `seed/` 밖 오류가 없다 (T001 검증 때 있던 `seed/` 16건도 지금은 없다) |
| `npm run lint` | 통과 | — | 출력 없음 |
| `npm run sandbox:disputes` | 1회 | — | 위 1절 |
| `npm run sandbox:orders -- --status` | 1회 | — | 위 2절 |
| `npm run sandbox:orders -- --fresh`, `sandbox:setup -- disputes/track`, `sandbox:capture` | — | — | **실행하지 않음** (지시) |

단위 테스트는 모두 가짜 클라이언트로만 돈다 (전역 `fetch`를 타지 않는다). `--fresh`·`setup` 쪽 테스트가 보는 것: 새 요청 ID 12건·접미사 꼴·캡처된 주문 보존(POST 10회만)·`previousOrderIds` 누적·같은 접미사 재실행 시 중복 없음·링크 파일과 manifest 갱신·한 건 실패 시 나머지 계속·live 도메인이면 멈춤·분쟁 덧붙이기(S10c).

## 비밀값·개인정보 확인
| 항목 | 판정 | 근거 |
|---|---|---|
| `.env` | 열지 않았다 | 어떤 명령으로도 읽거나 출력하지 않았다. 스크립트가 런타임에 `process.loadEnvFile`로만 읽는다 (`env.ts`, T001) |
| `PAYPAL_BASE_URL` 바꿔 실행 | 하지 않았다 | 샌드박스 외 주소 거부는 T001의 단위 테스트가 본다 |
| 스크립트 실행 방법 | `npm run`만 | `tsx`·`node`를 직접 부르지 않았다 |
| 새 파일에 40자 이상 영숫자 문자열 | 없음 | `disputes.ts`·`disputes-read.ts`·`last-run.md` 0건 |
| `Bearer `·`Basic `·`access_token`·`client_secret` | 없음 | 걸리는 곳은 "이런 문자열이 **없어야 한다**"는 단위 테스트의 검사식 5줄뿐 |
| 구매자 개인정보 | 없음 | `DisputeReadRow`는 `BoardState`의 8개 값만 담는다 (`payer_id`·이름·이메일·주소·메시지 원문을 담는 자리가 없다). `StatusRow`도 상태·캡처 ID·추적 여부만 담는다. 가짜 응답에 이름·이메일·메시지·`payer_id`를 넣고 출력·`last-run.md`에서 찾는 테스트 3개로 확인했다 |
| 변환 실패 문구 | 필드 이름만 | T003의 예외 문구를 그대로 쓴다. 받은 값(`MEDIATION`, `KRW` 등)이 섞이지 않는지 단위 테스트로 확인했다 |
| 보고서 | 주문 ID·분쟁 수만 | 주문 ID는 이미 `tests/sandbox/manifest.json`에 있는 값이다 (개인정보가 아니다) |

## 남은 문제
- **분쟁 읽기의 상세·변환 경로는 아직 실제 응답으로 확인되지 않았다.** 분쟁이 0건이라 `GET /v1/customer/disputes/{id}`와 `toBoardState`는 가짜 응답으로만 돌았다. 사람이 D1~D3을 접수한 뒤 `npm run sandbox:disputes`를 한 번 더 돌려야 실제 `reason`·`stage`·`channel`·`amountCents`·`dueDate`·`allowedMoves`를 볼 수 있다. 특히 `allowedMoves`가 PayPal 응답의 `links[].rel`에서 실제로 어떤 값으로 오는지(`send_message`·`make_offer`·`provide_evidence`·`accept_claim`)는 그때 처음 확인된다.
- `disputes-read.ts`는 `hasTracking`·`hasDeliveredTracking`을 **false로 두고** 변환한다 (주문 상세에서 와야 하는 값이고, 이 명령은 분쟁만 읽는다). 출력·`last-run.md`에 그 사실을 한 줄로 적는다. 이 값이 필요한 판정은 `npm run sandbox:check`나 앱 쪽에서 주문 상세를 읽어야 한다 — 이 명령의 출력을 엔진 입력으로 그대로 쓰면 안 된다.
- `setup -- disputes`의 고침은 단위 테스트까지만 확인했다 (분쟁 접수 전이라 실행하지 않았다).
- 주문 12건이 전부 `CREATED`여서 `--status`가 `APPROVED`·`COMPLETED`·만료 응답을 실제로 받아 본 적은 없다. 그 경로는 가짜 응답으로만 확인했다 (만료 판정은 404 또는 오류 요약의 `NOT_FOUND`/`EXPIRED`/`INVALID_RESOURCE_ID`).

## 컨트롤 타워에 요청할 결정
1. **아침에 링크가 만료됐을 때 누가 `--fresh`를 돌릴지.** 사실: 지금 12건은 모두 살아 있고 `CREATED`다 (위 2절). 승인되지 않은 주문의 만료 시점은 확인하지 못했다. 만료되면 `--status`가 "expired or not found"로 보여 준다. `--fresh`는 **새 주문 12건을 만드는 POST**라서 이번 세션에서는 돌리지 않았다. 지시서는 "만료됐을 때만 컨트롤 타워가 실행한다"로 적어 두었다 — 사람이 승인하기 직전에 `--status`를 한 번 돌려 보고 만료면 `--fresh`, 그다음 링크 파일로 승인하는 순서를 운영 절차에 넣을지 결정이 필요하다. `--fresh`는 `reports/sandbox-approve-links.md`와 `tests/sandbox/manifest.json`을 덮어쓴다.
2. **manifest의 선택 필드 `previousOrderIds`.** 사실: `tests/sandbox/manifest.json`의 모양을 늘리는 변경이다(선택 필드 1개, 지금 파일에는 쓰여 있지 않다). AC13(`tests/acceptance/ac13.sandbox.test.ts`)은 manifest를 `JSON.parse(...) as Manifest`로 읽고 `orders`의 `key`·`orderId`·`buyer`·`sku`·`tracked`와 `disputes`만 보므로 선택 필드가 늘어도 통과한다 (방금 119건 통과 확인). 지시서 34행이 "이전 주문 ID는 manifest의 선택 필드(예: `previousOrderIds`)나 보고서에 남긴다"로 둘 다 허용했고, 나는 manifest 쪽을 골랐다 (`--fresh`를 여러 번 돌려도 기록이 남는다). 계약(`src/types.ts`)은 건드리지 않았다. 다른 선택을 원하면 알려 주면 된다.
3. **`sandbox:disputes`를 AC13 샌드박스 묶음에 넣을지.** 사실: 지금 이 명령은 `npm test`·`test:acceptance`에 들어가지 않고 사람·컨트롤 타워가 손으로 돌린다. AC13은 `tests/sandbox/last-run.md`에 분쟁 ID가 있는지 확인하지만, 그 파일의 분쟁 ID는 `sandbox:check`가 쓰는 "조회" 절에서 온다 ("분쟁 읽기" 절은 내가 새로 붙인 것이다). 인수 테스트를 바꾸는 일이라 손대지 않았다.
4. **분쟁 접수 뒤 실행 순서.** 제안: ① 사람이 D1~D3 접수 → ② `npm run sandbox:setup -- disputes` (manifest에 D1~D3 적기, 이제 덧붙이기라 다시 돌려도 안전하다) → ③ `npm run sandbox:disputes` (목록·상세·변환 실호출 확인) → ④ `npm run sandbox:check` (AC13이 읽는 "조회" 절 쓰기). ②는 캡처가 있어야 돌아가므로 승인·캡처가 먼저다.
