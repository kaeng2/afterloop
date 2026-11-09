# T029 검증 (2026-11-09 23:49 KST)
- 판정: **통과**
- 검증 대상: 커밋 d2fea0f (lane/paypal의 T029, 범위 `5060a80..d2fea0f` = e46b3e4 + d2fea0f) · 기준 SPEC v2.2 (`SPEC.md` 첫 줄 확인) · 실호출 없이 검증
- 병합 차단 문제: 없음. 다만 **`--fresh`를 실제로 돌리기 전에 알아야 할 것 4건**(아래 "발견한 문제" 1~4번)이 있다. 지금처럼 캡처된 주문이 0건인 상태에서 `--fresh`를 쓰는 데는 지장이 없고, 캡처가 한 건이라도 끝난 뒤에 쓰려면 1번을 먼저 고쳐야 한다.

검증의 한계 (직접 확인하지 못한 것):
- 실제 PayPal은 한 번도 부르지 않았다. `npm run sandbox:*`는 실행하지 않았다. 구현자가 한 실호출 2건(분쟁 0건, 주문 12건 `CREATED`)은 재현하지 않고 기록끼리 맞는지만 봤다.
- 진입점 `scripts/sandbox/disputes.ts`·`setup.ts`는 import하면 `main()`이 돌기 때문에 **import하지 않았다**. 두 파일의 `main()` 흐름(각각 39~52행, 89~106행)을 임시 스크립트에 그대로 옮겨 가짜 `fetch`로 돌렸다. `scripts/create-sandbox-orders.ts`는 실행 파일 이름이 같을 때만 `main()`이 도는 것을 코드(803행)로 확인한 뒤, 저장소 밖 사본에서 **진짜 `main(args, now)`** 을 가짜 전역 `fetch`로 돌렸다 (파일 쓰기·종료 코드까지 그대로).
- "같은 요청 ID면 PayPal이 같은 주문을 200으로 돌려준다", "만료된 주문은 404로 답한다", "캡처된 주문은 계속 200 `COMPLETED`로 조회된다"는 PayPal 쪽 동작이라 가짜가 그렇게 답하도록 만들고 돌렸다. 실제 그런지는 이 검증으로 확인되지 않는다.
- `.env`는 어디에 있는 것도 열거나 찾지 않았다. 검증 폴더와 사본에는 `.env`가 없다 (가짜 자격 증명은 프로세스 환경 변수로만 넣었다).

## 실행한 명령과 결과
모두 `verify-tmp`에서, `PAYPAL_*` 환경 변수 없이 실행.

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 629 | 0 | 파일 14개. `sandbox-disputes-read.test.ts` 23, `sandbox-orders.test.ts` 49, `sandbox-setup.test.ts` 24 포함 |
| `npm run test:acceptance` | 119 | 0 | 9개 건너뜀 (AC13 샌드박스 묶음, `RUN_SANDBOX` 없음) |
| `npx tsc --noEmit` | — | 0 | 출력 없음, 종료 0 |
| `npm run lint` | 통과 | — | 출력 없음, 종료 0 |
| `git diff --name-status 5060a80..HEAD` | — | — | 12개 파일 (아래 "지시서 대조") |
| `git diff --stat 5060a80..HEAD -- tests/sandbox/manifest.json reports/sandbox-approve-links.md` | — | — | 출력 없음 = 두 파일 모두 바뀌지 않았다 |
| 임시 스크립트 `h-disputes.ts` (실제 `createPayPalClient` + 가짜 `fetch` + 가짜 시계) | 35 | 2 | 총 37항목. 어긋난 2개는 A2b(출력 필드 1개 추가), A3g(꼴이 틀린 분쟁 ID 원문 출력) |
| 임시 스크립트 `h-orders.ts` (사본에서 진짜 `main()` + 가짜 전역 `fetch`) | 63 | 8 | 총 71항목. 어긋난 8개는 C5 5개(캡처 ID가 적힌 주문의 상태 조회가 `COMPLETED`가 아닐 때), C9b(전부 실패 시 링크 파일), F1·F2(옵션 없는 재실행) |
| `npm run lint --fresh` (npm이 `--` 없는 옵션을 넘기는지 확인용) | — | — | npm 10.8.2는 `--fresh`를 **조용히 삼키고** 스크립트에 넘기지 않는다 (`eslint`만 실행됨). 아래 문제 3번 |
| `npm run sandbox:disputes`, `sandbox:orders`, `sandbox:setup`, `sandbox:capture`, `sandbox:check` | — | — | **실행하지 않음** (지시) |

두 임시 스크립트 모두: 가짜가 설치되지 않은 상태에서 나간 `fetch` 0회, 샌드박스가 아닌 origin으로 나간 요청 0회.
임시 스크립트 위치 (저장소 밖): `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T029/copy/harness/` (`lib.ts`, `h-disputes.ts`, `h-orders.ts`, 출력 `orders.out`). `copy/`는 `scripts/`·`src/`·`seed/`·manifest·링크 파일의 사본이고 `--fresh`가 쓴 파일은 전부 이 사본 안에 있다.

검증이 끝난 뒤 `git status -s`: `?? reports/T029-verify.md` 한 줄 (`tsconfig.tsbuildinfo`는 `.gitignore` 대상).

## 지시서 대조
| 항목 | 판정 | 근거 |
|---|---|---|
| 범위: 수정 가능 폴더 | 통과 | 바뀐 12개: `package.json`, `scripts/create-sandbox-orders.ts`, `scripts/sandbox/` 6개(`disputes.ts`·`disputes-read.ts` 새 파일, `setup.ts`·`setup-steps.ts`·`manifest.ts`·`last-run.ts` 수정), `tests/unit/sandbox-disputes-read.test.ts`(새 파일)·`sandbox-orders.test.ts`, `tests/sandbox/last-run.md`, `reports/T029-impl.md`. 모두 지시서 목록 안 |
| `package.json` | 통과 | `git diff --numstat`: +1 −0 (`"sandbox:disputes"` 한 줄). `package-lock.json` 변화 없음 |
| `src/`·`seed/`·`config/`·계약 파일 | 통과 | `src`, `seed`, `config`, `tests/acceptance`, `SPEC.md`, `DECISIONS.md`, `TASKS.md`, `tasks`, `CLAUDE.md`, `README.md`, `docs`, `inbox`, `.claude`, `.gitignore`, `.env.example` 변경 0 |
| manifest·링크 파일이 이번에 바뀌지 않음 | 통과 | 위 `git diff --stat` 출력 없음. manifest는 주문 12건·`previousOrderIds` 없음 그대로 |
| T003 함수를 그대로 쓴다 | 통과 | `disputes-read.ts` 16~17행이 `listDisputes`·`getDispute`(`@/paypal/disputes`), `toBoardState`·`buyerKeyOf`·`countPriorInrDisputes`(`@/paypal/mapper`)를 import해 76·83·84행에서 부른다. 금액·단계·채널·허용된 수 변환 코드는 이 파일에 없다 (출력용 문자열 조립만) |
| 1번 출력 필드 | 차이 있음 (의견) | 지시서의 7개에 더해 `buyerPriorInrDisputes`(같은 구매자의 이전 INR 건수)가 줄·표에 하나 더 나온다. 건수이고 구매자 식별값은 아니다 (A2b) |
| 0건 → "0 disputes (empty list)" + 종료 0 | 통과 | A1 |
| 변환 불가 → ID·필드 이름만, 나머지 계속, 종료 1 | 통과 | A3 |
| `last-run.md` "분쟁 읽기" 절 | 통과 | A1c·A2g. 다른 두 절은 바이트 단위로 그대로 |
| 2번 `--status` 조회만 | 통과 | B1~B13 |
| 3번 `--fresh` (코드 + 단위 테스트, 실행 안 함) | 통과 | C1~C10. 지시서가 요구한 단위 테스트 4가지(새 요청 ID, 캡처된 주문 보존, 링크 파일·manifest 갱신, 같은 접미사 재실행)가 `sandbox-orders.test.ts` 685~820행에 있다 |
| 4번 `setup -- disputes` 덧붙이기 + 단위 테스트 | 통과 | D-a~D-e. 단위 테스트 5개(372~435행), S10c 재현 포함 |
| 하지 않을 것 | 통과 | 새·바뀐 코드에 캡처·추적 등록·분쟁 상태 변경 경로 추가 없음. `client.call`(POST)은 `create-sandbox-orders.ts` 291행(기존 생성)·487행(`--fresh`)과 기존 `setup-steps.ts` 65행(`/track`)뿐 |

## 시나리오 (가짜 클라이언트)
가짜 Client ID·Secret·토큰(각 80자 안팎)과 가짜 구매자 이름·이메일·주소·메시지 원문·전화번호·`payer_id` 표식을 응답 곳곳에 넣고, stdout·stderr·클라이언트 로그·`last-run.md`·manifest·링크 파일 문자열에서 그 표식, Basic 값, `access_token` 단어, `Bearer <20자 이상>` 꼴을 찾았다.

| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| A1 | `sandbox:disputes`, 분쟁 0건 | "0 disputes (empty list)", 종료 0 | 출력 그대로 + 종료 0. 호출은 토큰 POST 1 + `GET /v1/customer/disputes?page_size=50` 1. `last-run.md`에 "분쟁 0건 · 변환 성공 0건 · 변환 실패 0건" | 예 |
| A2 | 분쟁 3건 (SNAD $48 · INR $72 · INR $35, 합의 단계 `INQUIRY`·`INTERNAL`, 허용된 수 링크 포함). 목록·상세 응답에 구매자 이름·이메일·주소·메시지 원문·`payer_id` | 건별 줄에 7개 필드만, 개인정보 표식 없음, 종료 0, GET만 | "3 disputes" + 3줄. 금액 4800·7200·3500, 허용된 수는 고정 순서·중복 제거(`send_message,make_offer,accept_claim` 등), 판매자 기한이 없으면 구매자 기한. stdout·stderr·로그·`last-run.md`에 표식 0. 토큰 외 호출 GET 4(목록 1 + 상세 3), POST 0, send-message·make-offer·accept-claim·escalate 경로 0 | 예 (필드는 A2b) |
| A2b | 같은 시나리오의 필드 목록 | `disputeId`·`reason`·`stage`·`channel`·`amountCents`·`dueDate`·`allowedMoves`만 | 위 7개 + `buyerPriorInrDisputes` | 아니오 (의견 7번) |
| A3 | 10건 중 8건이 변환 불가: 모르는 단계, KRW, 모르는 채널, 금액 꼴(`48.005`), `dispute_amount` 없음, 상세 404, 상세 500, 분쟁 ID 꼴 아님 | 그 건의 ID + 필드 이름만, 나머지 계속, 종료 1 | 성공 2건 출력 + "변환하지 못한 분쟁:" 8줄 + 종료 1. 문구는 `모르는 dispute_life_cycle_stage (받는 값: …)`, `dispute_amount.currency_code가 USD가 아니다`, `분쟁 상세 조회 실패 (HTTP 404)` 꼴. 받은 값(가짜 단계 이름, `KRW`, `48.005`)은 안 실림. POST 0 | 예 |
| A3g | 목록의 `dispute_id`가 `PP-…` 꼴이 아닌 임의 문자열 | 받은 값은 싣지 않는다 | 상세 호출은 나가지 않는다(T003이 막음). 다만 문제 줄 앞머리에 목록에서 받은 `dispute_id` 원문이 그대로 찍힌다 | 아니오 (의견 8번) |
| A4a | 목록이 3쪽 (`links[rel=next]`, 마지막 쪽의 next는 제자리) | 끝까지 읽고 멈춤 | 4건 모두 읽음. 목록 GET 3 + 상세 4, POST 0, 종료 0 | 예 |
| A4b | next 링크가 live 도메인 | 따라가지 않음 | "다음 쪽 링크가 샌드박스 주소를 벗어난다" + 종료 1. 나간 호출은 샌드박스 목록 1회뿐 | 예 |
| A4c | 같은 분쟁이 두 쪽에 겹쳐 옴 | — | 두 번 읽고 두 줄 출력한다 (중복 제거 없음. `listed=2`) | 참고 |
| A5 | 목록 조회 403 / 500 / 네트워크 예외 / 토큰 401 (본문·예외 문구에 토큰·Secret·Basic·이메일) | 종료 1, 비밀값 없음, `last-run.md` 그대로 | 네 경우 모두 종료 1, `last-run.md` 바이트 그대로, 표식 0 (`[redacted]`로 바뀜) | 예 |
| A6 | `PAYPAL_BASE_URL` 13가지(live, `api.paypal.com`, 빈 값, 공백, `http://`, 접미 도메인, userinfo, 경로·포트 붙음, 대문자, Secret이 섞인 주소 등) — `disputes.ts`·`setup.ts`·주문 스크립트가 함께 쓰는 `loadSandboxEnv` | 호출 0, 받은 값 비노출 | 13건 모두 `SandboxEnvError`, 호출 0, 문구에 받은 값 없음. `createSandboxClient`도 live 주소면 만들 때 던진다 | 예 |
| B1~B9 | `--status`: 12건이 각각 `CREATED`·`PAYER_ACTION_REQUIRED`·`APPROVED`·`COMPLETED`(캡처 있음)·404·422 `ORDER_EXPIRED`·403·500·네트워크 예외·`VOIDED`·(200인데 `status` 없음)·`CREATED` | GET만, 상태별 표, 파일 불변 | 토큰 외 호출은 전부 `GET /v2/checkout/orders/{id}`(재시도 포함 16회), POST 0. 상태 칸 그대로, `COMPLETED`는 캡처 ID 표시. 404·`ORDER_EXPIRED` → "expired or not found". 403 → `NOT_AUTHORIZED · PERMISSION_DENIED · debug_id=…`(만료로 읽지 않음). 500·네트워크 → "호출 실패" + 사유, 나머지 계속. 종료 1. manifest·링크 파일 바이트 그대로. 개인정보·비밀값 표식 0 | 예 |
| B10~B11 | `--status`: 12건 모두 `CREATED` | 종료 0 | 호출 = 토큰 1 + GET 12, "주문 12건: CREATED 12", 종료 0, 파일 그대로 (구현 보고서의 실호출 기록과 같은 꼴) | 예 |
| B12~B13 | 빈 manifest / 모르는 인자(`--frseh`, `fresh`, `--fresh=1`) / `--status --fresh` 동시 | 호출 0, 종료 1 | 다섯 경우 모두 호출 0 · 종료 1 · 파일 그대로 · 쓰는 법 출력 | 예 |
| E | `main()` 세 모드(옵션 없음·`--status`·`--fresh`) × `PAYPAL_BASE_URL` 5가지(live 2종, `http://`, 접미 도메인, 없음) | 호출 0, 종료 1 | 15건 모두 호출 0 · 종료 1 · manifest·링크 파일 그대로 · 받은 값 비노출 | 예 |
| C1 | `--fresh`: 12건이 모두 만료(상태 GET 404), manifest에 분쟁 3건이 적혀 있음. 시각 주입 2026-11-10 07:30 KST | 새 요청 ID 12개, manifest·링크 파일 갱신, 이전 ID 보존 | 요청 ID `afterloop-order-O01-r202611100730` … `O12`(33자, 12건 같은 접미사). 호출 = 토큰 1 + 상태 GET 12 + `POST /v2/checkout/orders` 12 (건마다 GET이 먼저). manifest: `orderId` 12개 새 값, `previousOrderIds`에 옛 ID 1개씩, `key`·`buyer`·`sku`·`tracked` 보존, `disputes` 3건 보존. 링크 파일: 12행 새 링크(샌드박스 도메인), 옛 ID 0, 머리말에 접미사·시각. 종료 0. 표식 0 | 예 |
| C2 | 같은 시각(같은 접미사)으로 다시 실행 | 같은 요청 ID → 중복 없음 | 같은 요청 ID 12개가 다시 나가고(가짜가 200·같은 주문으로 답함) manifest 바이트 그대로(`previousOrderIds` 안 늘어남), 링크 12행 그대로, 종료 0 | 예 |
| C2d | (가정) 그 200 재응답에 `approve` 링크가 없다면 | — | manifest는 그대로, 링크 파일 12행이 "승인 링크 없음"으로 덮이고 종료 1. 실제 PayPal의 재응답에 링크가 들어 있는지는 확인된 바 없다 | 참고 |
| C3 | 1분 뒤(접미사 `r…0731`)에 다시 실행 | — | 12건이 **또 새로** 생긴다 (POST 누적 24, 주문 24개). `previousOrderIds`에 [원래 ID, 1차 ID] 순서로 쌓인다. 종료 0 | 참고 (문제 2번) |
| C4a~d | `COMPLETED` 3건(O01·O02·O08, manifest에 `captureId` 있음) + 나머지 만료 | 3건은 새로 만들지 않고 그대로 | 상태 GET 12 → POST 9건만(그 3건의 요청 ID는 안 나감). 3건의 manifest 항목 그대로(`orderId`·`captureId` 같고 `previousOrderIds` 안 생김). 링크 파일은 9건 새 링크 + 3건 "승인 링크 없음 — 이미 캡처됨". 종료 0 | 예 |
| C4e | manifest에는 `captureId`가 없지만 PayPal은 `COMPLETED` | 그대로 둠 | 그대로 둠, POST 11 | 예 |
| C5 | manifest에 `captureId`가 적힌 주문의 상태 조회가 `COMPLETED`로 오지 않음 | 덮어쓰지 않는다 | **네트워크 예외·500(재시도 뒤)**: POST 안 나감, `orderId`·`captureId` 유지, 그 행 `failed`, 종료 1 → 예. **404 · 403 · 400 · (200인데 `status` 없음) · (200 `APPROVED`)**: POST가 나가고 `orderId`가 새 값으로 바뀌며 **`captureId`가 사라진다** (옛 `orderId`는 `previousOrderIds`에 남음). 종료 0, 경고 없음 | 일부 아니오 (문제 1번) |
| C6 | `APPROVED`(승인됐지만 캡처 전) 주문 | — | 새 주문으로 바뀐다 (승인을 다시 받아야 한다). 지시서는 `COMPLETED`만 보존하라고 했으므로 지시서대로다 | 참고 (문제 2번) |
| C7 | 12건 중 O05 생성 422, O07 500, O09 응답에 ID 없음, O11 네트워크 예외, O10은 생성됐지만 응답에 승인 링크 없음 | 성공한 건만 새 ID, 실패한 건은 옛 ID + 표시, 종료 1 | manifest: 실패 4건은 옛 항목 그대로, 성공 8건(O10 포함)은 새 ID + `previousOrderIds`, 12건·키 순서·`disputes` 유지. 링크 파일: 실패 4건과 O10은 "승인 링크 없음 — <사유>"(옛 링크는 남지 않음), 7건 새 링크. stderr "승인 링크가 7/12건만 모였다", 종료 1. 표식 0 | 예 |
| C8 | O04의 승인 링크가 `www.paypal.com`(live) / 다른 도메인 / `http://` 샌드박스 | 그 자리에서 멈춤 | 세 경우 모두 O04까지(POST 4)만 나가고 뒤 호출 0. manifest·링크 파일 바이트 그대로, 종료 1, 도메인만 출력(링크 전체는 출력 안 함). 이때 이미 만들어진 O01~O03의 새 주문은 manifest에 적히지 않는다 (같은 분에 다시 돌리면 같은 주문이 돌아온다) | 예 |
| C9a | 토큰 401 | 주문 호출 0, manifest 그대로 | 주문 호출 0, manifest 바이트 그대로, 종료 1, 표식 0 | 예 |
| C9b | 같은 경우의 링크 파일 | 그대로 남는다 | **12행이 전부 "승인 링크 없음 — …"으로 덮인다** (옛 링크 0개 남음) | 아니오 (문제 4번) |
| C10 | 빈 manifest + `--fresh` | — | 상태 GET 0, POST 12(접미사 붙은 ID), manifest 12건, `previousOrderIds` 없음, 종료 0 | 참고 |
| F1~F2 | **옵션 없는** `sandbox:orders`를 캡처 3건이 끝난 manifest로 다시 실행 (멱등 창이 지난 뒤) | (T026 검증 지적이 고쳐졌다면) 캡처된 주문은 POST하지 않고 `captureId` 유지 | **T026 때와 같다.** 상태 조회 없이 12건을 모두 POST(`afterloop-order-O01` 꼴)하고, 캡처된 주문의 `orderId`가 새 값으로 덮이며 `captureId`가 사라진다. `previousOrderIds`도 남지 않는다. 종료 0 | 아니오 (문제 3번) |
| F3 | `--fresh`를 한 뒤 옵션 없이 다시 실행 | — | 원래 요청 ID의 멱등 창 안: manifest·링크 파일이 **원래(만료됐을 수 있는) 주문 ID로 되돌아가고** `previousOrderIds`가 사라진다. 창 밖: 또 다른 새 주문 12건이 생기고 `previousOrderIds`가 사라진다. 두 경우 모두 종료 0 | 참고 (문제 3번) |
| D-a | `setup -- disputes`: 3건이 적힌 manifest, D1은 새 ID로 조회됨, D2 조회만 5xx | D2 유지, D1 갱신 | `D1=새 ID, D2=옛 ID, D3=옛 ID`. 주문 12건(`captureId`·`previousOrderIds` 포함) 그대로. GET만(POST 0). 종료 코드는 0 (3건이 모두 manifest에 있으므로) | 예 |
| D-b | 0건 적힌 상태, 2건만 찾음 | 2건 적고 모자란 키 알림, 종료 1 | 2건 적음, "manifest에 아직 없는 분쟁: D3", 종료 1 | 예 |
| D-c | D3만 적힌 상태, D1 찾음, D2 404, D3는 이번에 0건 | D1 더함, D3 유지, 종료 1 | `D1,D3` 적힘, 모자란 키 D2, 종료 1 | 예 |
| D-d | 3건 적힌 상태, 조회가 전부 네트워크 오류 | manifest 그대로 | 파일 바이트 그대로(쓰지 않음). 종료 코드 0 | 예 (의견 6번) |
| D-e | 0건 → 3건 모두 찾음 | 종료 0 | `D1:O02, D2:O01, D3:O08` 키 순서, 종료 0. manifest·로그에 구매자 이름 없음 | 예 |

## 비밀값·개인정보·샌드박스 확인
| 항목 | 판정 | 근거 |
|---|---|---|
| 저장소에 40자 이상 토큰 모양 문자열 | 통과 | `tests/sandbox/last-run.md`, `reports/T029-impl.md`, `scripts/sandbox/disputes.ts`·`disputes-read.ts`·`setup.ts`·`setup-steps.ts`·`manifest.ts`·`last-run.ts`, `scripts/create-sandbox-orders.ts`, 두 단위 테스트 파일에서 영숫자·`-`·`_` 40자 이상 0곳. `last-run.md`와 구현 보고서는 24자 이상으로 낮춰도 0곳 |
| `Bearer `·`Basic ` 뒤의 값 | 통과 | 위 11개 파일에서 0곳 |
| `access_token`·`client_secret` | 통과 | 걸리는 곳은 "없어야 한다"는 검사식과 검색어 목록뿐: `reports/T029-impl.md:110`, `tests/unit/sandbox-disputes-read.test.ts:309`, `tests/unit/sandbox-orders.test.ts:334·335·494·836`. 값이 아니다 |
| 이메일 | 통과 | 걸리는 곳 4줄 모두 단위 테스트의 가짜 응답: `tests/unit/sandbox-disputes-read.test.ts:284`, `tests/unit/sandbox-orders.test.ts:484·633·826` (`example.test` 도메인의 가짜 주소). `last-run.md`·구현 보고서·스크립트에는 0곳 |
| 구매자 이름 | 통과 | `last-run.md`·구현 보고서에 0곳. `scripts/create-sandbox-orders.ts:52~56`의 샌드박스 계정 표시 이름 5개는 T026 때부터 있던 것(링크 파일에 "어느 계정으로 승인할지" 적는 용도)이고 이번 변경이 아니다. 단위 테스트의 이름은 가짜 응답과 "출력에 없어야 한다"는 검사다 |
| `sandbox:disputes` 출력에 개인정보 | 통과 | A2·A3·A5: 이름·이메일·주소·메시지 원문·전화번호·`payer_id` 표식이 stdout·stderr·클라이언트 로그·`last-run.md` 문자열 어디에도 없다. T003 스키마가 선언하지 않은 필드를 떼고, 출력은 `BoardState`에서 고른 8개 값만 쓴다. 예외: A3g (꼴이 틀린 `dispute_id` 원문) |
| `--status`·`--fresh` 출력·manifest·링크 파일에 개인정보 | 통과 | B9·C1h·C4d·C7f: 주문 상세의 `payer` 이름·이메일·주소·`payer_id`를 넣었지만 출력·파일에 0. 출력되는 것은 주문 키·시드 구매자 키·주문 ID·상태·HTTP 코드·캡처 ID·추적 여부·오류 요약(`name`·`issue`·`debug_id`) |
| 비밀값이 출력에 나오는 길 | 통과 | 토큰 401(본문에 Secret·Basic 되돌아옴), 네트워크 예외 문구에 `Bearer <토큰>`·Secret, 403 본문 `message`에 토큰: 모두 `[redacted]` 또는 미출력 (A5, B6, C7f, C9a). `errorSummary`가 `name`·`issue`·`debug_id`를 가리지 않고 싣는 점은 T001 검증 의견 3번 그대로다 (이번 변경 아님) |
| 샌드박스가 아닌 `PAYPAL_BASE_URL` → 호출 0 | 통과 | 주문 스크립트 세 모드는 진짜 `main()`으로 15건 확인(E). `sandbox:disputes`·`sandbox:setup`은 같은 `loadSandboxEnv`를 클라이언트를 만들기 전에 부른다 (`disputes.ts` 28~34행 → 36행, `setup.ts` 66~72행 → 80행; 코드 읽기) + 그 함수와 `createSandboxClient`를 13가지 값으로 확인(A6) |
| live로 나갈 수 있는 길 | 통과 | 새 코드의 호출은 전부 `PayPalClient.get`·`call`에 `/`로 시작하는 상대 경로를 넘긴다. 분쟁 목록의 next 링크는 T003이 origin을 확인(A4b). 승인 링크는 `--fresh`에서도 `sandboxApproveUrl`을 지난다(C8) |
| 조회 범위 (`sandbox:disputes`·`--status`·`setup -- disputes`) | 통과 | 세 경로 모두 `client.get`만 부른다 (코드 읽기 + A2e·A3i·B1·D-a3에서 POST 0). 토큰 발급 POST는 클라이언트가 보낸다 |
| 구현 보고서의 실호출 기록 | 앞뒤 맞음 (재현 안 함) | `last-run.md` "분쟁 읽기" 절(23:30 KST, 분쟁 0건·성공 0·실패 0, "0 disputes (empty list)")과 보고서 1절이 같다. 보고서의 로그 `GET /v1/customer/disputes → 200`은 클라이언트가 쿼리를 떼고 적는 꼴과 맞고, 호출 수(토큰 1 + GET 1 / 토큰 1 + GET 12)는 A1b·B10의 가짜 실행과 같다. 토큰 수명 30590초는 32400초에서 약 30분이 빠진 값이라, 같은 앱으로 23:00쯤 토큰을 받았다는 `last-run.md`의 T001 기록과 어긋나지 않는다 (추정). 주문 ID 12개는 manifest와 같다. "POST 0회"는 두 명령의 코드 경로(GET만)와 맞고, manifest·링크 파일이 안 바뀐 것과도 모순이 없다. PayPal 쪽 상태 자체는 확인하지 못했다 |

새·바뀐 스크립트가 밖으로 내보내는 것:

| 위치 | 어디로 | 실리는 것 |
|---|---|---|
| `disputes.ts:24` | stderr | 받은 인자(사용자가 친 것) |
| `disputes.ts:32`, `create-sandbox-orders.ts:686` | stderr | `SandboxEnvError` 문구(키 이름·고정 문구) |
| `disputes.ts:36`, `create-sandbox-orders.ts:690` | stdout | 클라이언트 로그 줄 (`redact`를 지나고 쿼리 문자열은 떼어짐) |
| `disputes.ts:42`·`60` | stderr | 오류 `message` (클라이언트 오류는 가려져 있고 T003 오류는 필드 이름·HTTP 상태만) |
| `disputes.ts:47` | stdout | 분쟁 수, 건별 줄(분쟁 ID·reason·단계·채널·금액·기한·허용된 수·이전 INR 건수), 변환 실패 줄(분쟁 ID + 사유), 추적 가정 안내 |
| `disputes.ts:49` → `last-run.ts` | `tests/sandbox/last-run.md` | 위와 같은 값의 표 + 시각 |
| `create-sandbox-orders.ts` `printStatus` | stdout | 주문 키·주문 ID·상태·HTTP·캡처 ID·추적 여부·비고(오류 요약) |
| `create-sandbox-orders.ts` `printFresh`, 760행 | stdout | 요청 ID 접미사, 주문 키·시드 구매자 키·금액·결과·HTTP·새 주문 ID·이전 주문 ID·상태·비고 |
| `create-sandbox-orders.ts` 775·777행 | manifest, 링크 파일 | 주문 키·ID·`previousOrderIds` / 주문 키·구매자 키와 표시 이름·금액·승인 링크 또는 사유 |
| `setup.ts` 97·102·105행 | stdout·stderr | 분쟁 건수, 모자란 분쟁 키 |

## 발견한 문제
병합 차단: **없음**

### `--fresh`를 실행하기 전에 알아야 할 것
1. **[병합 후 수정 · 캡처가 한 건이라도 끝난 뒤 `--fresh`를 쓰기 전에는 반드시] manifest에 `captureId`가 적힌 주문도 상태 조회가 "200 + `COMPLETED`"가 아니면 새로 만들어 덮는다.** `runFreshOrders`(`scripts/create-sandbox-orders.ts` 468~484행)는 PayPal이 `COMPLETED`라고 답할 때만 건너뛰고, manifest의 `captureId`는 보지 않는다. 상태 조회가 예외로 끝나면(네트워크, 5xx·429 재시도 소진, 401 두 번) 그 주문은 `failed`로 남고 덮이지 않는다. 그러나 **404·403·400처럼 예외 없이 돌아오는 응답**이면 POST가 나가 `orderId`가 바뀌고 `captureId`가 지워지며 종료 코드는 0이다 (C5). 옛 `orderId`는 `previousOrderIds`에 남지만 `captureId`는 git 기록에서만 되살릴 수 있다. PayPal이 캡처된 주문에 404를 주는 일이 실제로 있는지는 확인되지 않았고, 아침에 캡처가 0건인 상태에서는 일어날 수 없다. 고치려면 "`before.captureId`가 있는데 `COMPLETED`를 확인하지 못했으면 만들지 않고 문제로 적는다"를 넣으면 된다. 단위 테스트도 이 경우(404)를 다루지 않는다 (700행 테스트는 200 `COMPLETED`만 본다). 구현 보고서 78행·코드 주석 443행의 "조회 실패면 새로 만든다"는 절반만 맞다 (예외면 만들지 않는다).
2. **[운영] `--fresh`는 `COMPLETED`만 지킨다. 승인된(`APPROVED`) 주문과 직전 `--fresh`가 만든 주문은 다시 돌리면 버려진다.** 접미사가 분 단위라 "같은 분"에만 중복이 없다. 1분이 지나 다시 돌리면 성공했던 건까지 12건이 또 새로 생기고(C3), 그 사이 사람이 승인한 주문은 승인 전 상태의 새 주문으로 바뀐다(C6). 일부 실패 때 stderr의 안내("다시 실행한다 (같은 분이면 중복 생성되지 않는다)")를 따라 다시 돌리는 시점은 5xx 재시도(건당 6초)만으로도 분이 넘어가기 쉽다. → **승인을 한 건이라도 시작한 뒤에는 `--fresh`를 다시 돌리지 않는다.** 다시 돌렸다면 그 전에 나눠 준 링크는 전부 버리고 마지막 링크 파일만 쓴다.
3. **[병합 후 수정 · T026 검증 지적 2번은 그대로다] 옵션 없는 `npm run sandbox:orders`는 여전히 캡처된 주문도 다시 POST한다.** `runCreateOrders`는 이번에 바뀌지 않았다 (구현 보고서 62행 "기존 생성 경로는 그대로다"와 일치). 멱등 창이 지난 뒤 다시 실행하면 manifest가 새 ID로 덮이고 `captureId`가 사라진다(F1·F2). 이번에 생긴 조합도 있다: `--fresh` 뒤에 옵션 없이 실행하면 `previousOrderIds`가 지워지고, 원래 요청 ID의 멱등 창 안이면 manifest·링크 파일이 **만료됐을 수 있는 원래 주문으로 되돌아간다**(F3). 그리고 **`npm run sandbox:orders --fresh`처럼 가운데 `--`를 빼면 npm이 옵션을 조용히 삼켜 이 옵션 없는 경로가 돈다** (npm 10.8.2에서 확인. 스크립트는 인자를 받지 못하므로 막을 수 없다). 구분법: `--fresh`가 제대로 들어가면 첫 줄에 "요청 ID 접미사: r…"가 찍힌다.
4. **[의견] 전부 실패한 실행도 링크 파일을 덮는다.** 토큰 401처럼 한 건도 만들지 못한 `--fresh`도 `reports/sandbox-approve-links.md`의 12행을 "승인 링크 없음 — …"으로 바꾼다 (manifest는 그대로, C9b). 일부 실패 때도 실패한 행의 옛 링크는 남지 않는다(C7). 링크는 `https://www.sandbox.paypal.com/checkoutnow?token=<manifest의 orderId>` 꼴이라 되살릴 수 있고 `git checkout`으로도 돌아온다. T026 검증 의견 3번과 같은 성질이다.
5. **[의견 · 확인 불가] 같은 접미사 재실행 때 PayPal의 200 재응답에 승인 링크가 들어 있는지는 모른다.** 없다면 manifest는 맞지만 링크 파일 12행이 "승인 링크 없음"이 되고 종료 1이다(C2d). 이때도 4번의 꼴로 링크를 만들 수 있다. 또 새 주문도 문서상 3시간 안에 캡처해야 한다는 T026 검증 1번은 그대로 적용된다 (`--fresh` 직후부터 3시간).

### 그 밖
6. **[의견] `setup -- disputes`는 조회가 실패해도 manifest에 D1~D3이 있으면 종료 0이다.** 3건이 적힌 상태에서 조회 3건이 모두 실패해도 "분쟁 D1·D2·D3이 모두 manifest에 있다" + 종료 0이다(D-a, D-d). 지시서("모자라면 종료 1")대로이고 실패는 표의 "호출 실패" 행에 보이지만, 종료 코드만 보면 "이번에 다시 확인됐다"와 "전에 적힌 값이 남아 있다"를 구분할 수 없다. 이번에 0건으로 조회된(분쟁이 사라진) 키의 옛 값도 남는다.
7. **[의견] `sandbox:disputes` 출력에 지시서에 없는 `buyerPriorInrDisputes`가 하나 더 있다.** 구매자 식별값이 아닌 건수다. 지시서의 "한 줄에 7개"와 글자 그대로는 다르다(A2b). 그리고 변환에 `hasTracking`·`hasDeliveredTracking`을 false로 넣는다는 안내가 출력·`last-run.md`에 적힌다 (구현 보고서 117행과 일치).
8. **[의견] 꼴이 틀린 `dispute_id`는 원문이 문제 줄에 찍힌다.** 목록 응답의 `dispute_id`가 `PP-…` 꼴이 아니면 상세 호출은 막히지만 `- <받은 값>: 분쟁 ID 꼴이 아니다`로 그 값이 stdout과 `last-run.md`에 들어간다(A3g). `reason`·기한도 응답 문자열 그대로 찍힌다. PayPal이 이 자리에 개인정보를 넣는 응답은 확인된 바 없다.
9. **[의견] 같은 분쟁이 두 쪽에 겹쳐 오면 두 번 읽고 두 줄 찍는다**(A4c). `--status`는 200인데 `status`가 없는 응답을 "-"·`ok`·종료 0으로 적는다(B의 O11 행).
10. **[병합 후 수정] 단위 테스트의 빈 곳.** `main()`(`--status`·`--fresh`의 종료 코드, 파일 쓰기, 샌드박스 외 주소 0회 호출)과 `disputes.ts`·`setup.ts`의 `main()`은 테스트가 없다 (T026 검증 9번과 같은 지적). 이번 검증에서 가짜 `fetch`로 돌려 본 결과는 위 표와 같다. 캡처 요청 ID가 주문 키 기준(`afterloop-capture-O01`)이라 `--fresh` 전에 같은 키로 캡처를 시도한 적이 있으면 같은 요청 ID가 다른 주문으로 나간다는 T026 검증의 지적도 그대로다 (캡처를 시도한 적 없는 아침 흐름에는 해당 없음).

### `reports/T029-impl.md`와 다른 곳
- 69행 "`sandbox-orders.test.ts` 단위 테스트 +25개 … 기존 24개": 실제는 **기존 29개, +20개**다 (`5060a80`의 `it(` 29개 → 지금 49개. 늘어난 것은 `parseOrdersMode` 2, `--status` 6, `freshSuffix` 3, `--fresh` 9). 92행의 "(24 → 49)"도 같다. 합계 49와 `npm test` 629는 맞다.
- 78행 "그 밖(만료·미승인·조회 실패)이면 새로 만든다": 조회가 예외로 끝나면 만들지 않고 `failed`로 남긴다 (문제 1번).
- 53행 "링크 12건은 아직 쓸 수 있다 → 아침에 사람이 그 파일을 그대로 쓰면 된다": 근거는 생성 18분 뒤의 `CREATED` 조회 1회다. 아침에도 살아 있다는 근거는 아니다 (바로 아래 55행에서 구현자도 만료 시점은 확인하지 못했다고 적었다. T026 검증 1번은 문서 기준 3시간이라고 봤다).
- 107행 "샌드박스 외 주소 거부는 T001의 단위 테스트가 본다": 그 테스트는 `loadSandboxEnv`를 보고, 주문 스크립트 `main()`의 세 모드는 보지 않는다. 동작은 이번 검증(E)에서 문제없었다.
- 1행 보고 시각 23:35는 그 보고서를 담은 커밋(d2fea0f, 23:33:43 +0900)보다 뒤다. 내용에는 영향 없다.
- 그 밖의 숫자는 직접 실행한 결과와 같다: `npm test` 629, `test:acceptance` 119 통과·9 건너뜀, `tsc` 오류 0, lint 통과, `sandbox-disputes-read.test.ts` 23개, 요청 ID 33자, `package.json` +1 −0, 바뀐 파일 목록.

## 아침에 `--fresh`를 실행하는 사람을 위한 순서
1. `.env`가 있는 worktree에서, 승인을 시작하기 **전에** `npm run sandbox:orders -- --status`(조회만)부터 돌린다. 12건이 모두 `CREATED`면 `--fresh` 없이 지금 링크 파일을 쓴다. "expired or not found"가 보이면 2로 간다.
2. `npm run sandbox:orders -- --fresh` — **가운데 `--`를 반드시 넣는다.** 첫 줄에 "요청 ID 접미사: r…"가 찍혔는지, 끝에 "새로 만듦 12 · … · 실패 0"과 종료 코드 0인지 본다. 접미사 줄이 없으면 옵션 없는 생성이 돈 것이다.
3. 종료 1이면 표의 실패 행을 본다. **승인을 아직 시작하지 않았을 때만** 다시 돌린다 (1분이 지나면 성공했던 건도 또 새로 생긴다). 언제나 마지막 실행이 쓴 `reports/sandbox-approve-links.md`만 쓰고, 그 전 링크는 버린다.
4. 승인이 한 건이라도 시작된 뒤에는 `--fresh`도, 옵션 없는 `npm run sandbox:orders`도 **다시 돌리지 않는다** (승인된 주문이 새 주문으로 바뀌고, 옵션 없는 실행은 캡처된 주문의 `captureId`까지 지운다). 캡처가 한 건이라도 끝난 뒤 `--fresh`가 꼭 필요하면 문제 1번을 먼저 고친다.
5. `--fresh` 뒤 3시간 안에 12건 승인 → `npm run sandbox:capture` → `npm run sandbox:orders -- --status`로 12건 `COMPLETED` 확인 → 바뀐 manifest·링크 파일을 그 worktree에서 커밋한다.

## 컨트롤 타워가 결정할 것
1. **문제 1번(캡처 ID가 적힌 주문을 404·403에서 덮는 길)을 병합 전에 고칠지.** 사실: 지시서 문장("이미 `COMPLETED`인 주문은 새로 만들지 않고 그대로 둔다")과 그 단위 테스트는 충족한다. 덮이는 것은 PayPal이 캡처된 주문에 "200 `COMPLETED`"가 아닌 4xx를 줄 때뿐이고, 그런 응답이 실제로 오는지는 확인되지 않았다. 캡처가 0건인 지금 상태에서는 일어날 수 없다. 이 길을 "`--fresh`가 캡처된 주문을 덮어씀"으로 읽어 실패로 볼지는 컨트롤 타워의 기준에 달려 있다 — 이 보고서는 지시서 범위 밖의 경우로 보고 통과로 판정했다.
2. **옵션 없는 `sandbox:orders`의 재실행 보호(문제 3번)를 후속 작업으로 낼지**, "캡처·`--fresh` 뒤에는 옵션 없이 실행하지 않는다 + `-- --fresh`의 `--` 확인"을 운영 규칙으로만 둘지. T026 검증 결정 2번이 아직 열려 있고, `--fresh`가 생기면서 되돌아가는 조합(F3)이 하나 늘었다.
3. **manifest의 선택 필드 `previousOrderIds`** (구현 보고서 결정 2번). 사실: 지금 커밋된 manifest에는 쓰여 있지 않다. zod 스키마에 선택 필드로 들어가 `setup`·`capture`·`--fresh`가 manifest를 다시 쓸 때 보존된다(D-a2, 캡처 스크립트는 항목을 통째로 이어 쓴다). 옵션 없는 `sandbox:orders`만 이 필드를 지운다(F3). AC13은 이 필드를 읽지 않고 오프라인 2개가 통과한다. 지시서 34행이 이 방식을 예로 들어 허용했다.
4. **아침 절차에 `--status` → (만료면) `--fresh`를 넣을지** (구현 보고서 결정 1번). 위 "아침에 `--fresh`를 실행하는 사람을 위한 순서"가 이 코드 기준의 안전한 순서다. `--fresh`는 주문 12건을 새로 만드는 POST이고 manifest·링크 파일을 덮어쓴다.
5. **`sandbox:disputes` 출력의 `buyerPriorInrDisputes`를 둘지** (문제 7번), **`sandbox:disputes`를 AC13 샌드박스 묶음에 넣을지** (구현 보고서 결정 3번. 인수 테스트 변경이다).
