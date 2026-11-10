# T034 검증 (2026-11-10 08:37 KST)
- 판정: **통과**
- 검증 대상: 커밋 8b8eb03 (lane/paypal의 T034) · 기준 SPEC v2.2 · 실호출 없이 검증
- 검증 위치: 비밀값 파일이 없는 별도 사본 `afterloop-wt/verify-tmp` (분리된 HEAD `ac2bb40`). `afterloop-wt/paypal`에는 들어가지 않았다. `npm run sandbox:*`는 한 번도 실행하지 않았다.
- 방법: 저장소 테스트 실행 + scratchpad의 임시 스크립트 4개(가짜 클라이언트·가짜 fetch 주입, 임시 폴더 `root`). 임시 스크립트는 전역 `fetch`를 "부르면 던지는" 함수로 바꿔 놓고 돌렸고, 네 개 모두 실제 fetch 호출 0회였다.
- 판정 근거 한 줄: 실패 조건 6가지(본문 필드 누락·값 다름 / `shipping_preference` 들어감 / `payer-action` 못 고름 / 샌드박스 주소 검사 약해짐 / T030 보호 회귀 / 범위 밖 수정) 가운데 해당하는 것이 없다. 아래 "발견한 문제"는 모두 병합을 막지 않는 것들이다.

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git show --stat 8b8eb03` / `git diff --name-only 8b8eb03~1 8b8eb03` | - | - | 바뀐 파일 3개뿐: `scripts/create-sandbox-orders.ts`(변경 39줄), `tests/unit/sandbox-orders.test.ts`(변경 193줄), `tests/unit/sandbox-orders-protect.test.ts`(변경 56줄). 합 278줄 추가 · 10줄 삭제 |
| `git diff --stat 8b8eb03~1 8b8eb03 -- scripts/capture-sandbox-orders.ts src package.json tests/sandbox reports seed config tests/acceptance` | - | - | 출력 없음 = 변경 0. (`ac2bb40`은 `reports/T034-impl.md` 1개만 추가) |
| `npm test` | 970 | 0 | 18 파일. `sandbox-orders.test.ts` 63건, `sandbox-orders-protect.test.ts` 26건 |
| `npm run test:acceptance` | 119 | 0 | 9 파일, 9건 skipped (`RUN_SANDBOX` 없음 → 샌드박스 묶음은 돌지 않았다) |
| `npx tsc --noEmit` | 종료 0 | - | 출력 없음 |
| `npm run lint` | 종료 0 | - | 경고·오류 0 |
| `npx tsx <scratchpad>/probe1-body.ts` | 33 | 0 | 실제 클라이언트(`createPayPalClient`)에 가짜 fetch 주입 — 전선에 나가는 URL·헤더·본문 확인 |
| `npx tsx <scratchpad>/probe2-response.ts` | 39 | 0 | 응답 처리 · 샌드박스 안전장치 · 링크 파일 |
| `npx tsx <scratchpad>/probe3-t030.ts` | 26 | 0 | 실제 manifest·링크 파일을 임시 폴더로 복사해 T030 보호 동작 확인 + 캡처 스크립트 |
| `npx tsx <scratchpad>/probe4-200.ts` | 2 | 0 | 문서 샘플처럼 HTTP 200으로 오는 새 주문 응답 |
| `git status -s` (끝) | - | - | `?? reports/T034-verify.md` 한 줄 |

임시 스크립트 위치: `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T034/` (`helper.ts`, `probe1-body.ts` ~ `probe4-200.ts`, 이전 코드 사본 `old-create.ts`).

### 바뀌거나 지워진 기존 기대값 (`git show 8b8eb03 -- tests/unit/ | grep '^-[^-]'` → 7줄, 테스트 3건)
| 테스트 | 바뀐 것 | 지시된 동작 변경과 맞는가 |
|---|---|---|
| `buildOrderBody › intent CAPTURE …` (본문 전체 `toEqual`) | 제목만 바뀌고 기대값에 `payment_source` 블록이 더해졌다. 기존 기대값 줄은 그대로 | 맞다 (지시서 완료 기준 5가 예고한 변경) |
| `승인 링크 고르기 › approve가 없으면 payer-action을 쓴다` | 1건 → 5건(둘 다 / approve만 / payer-action만 / 없음 / 대소문자). 지워진 단정 4개는 새 테스트에 같은 뜻으로 남아 있다 | 맞다 (지시서 2번) |
| `reports/… › 승인 URL 12개가 모두 sandbox.paypal.com이다` | 파일 전체를 `https?://` 정규식으로 긁던 것을 **표 행(`| Oxx |`)의 링크 칸만** 읽도록 바꿨다 | 바꿀 이유는 실재한다 — 이전 검사를 새 파일에 적용하면 URL이 13개(안내의 `example.com` 1개 포함)라 실패한다(직접 확인). **다만 검사 범위는 좁아졌다** → 아래 "발견한 문제 1" |

## 요청 본문·응답 처리 (가짜 클라이언트)
`main()`에 `loadEnv`·`makeClient`·`root`를 주입해 돌렸다. "이전 코드"는 `git show 8b8eb03~1:scripts/create-sandbox-orders.ts`를 scratchpad에 꺼내 같은 시드로 `buildOrderBody`를 부른 값이다.

| 항목 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 옵션 없음(빈 manifest): `POST /v2/checkout/orders` 횟수 | 12 | 12 (+ 토큰 1회, 모두 `api-m.sandbox.paypal.com`) | 예 |
| `--fresh`(manifest 12건·`captureId` 없음, 조회 상태 `PAYER_ACTION_REQUIRED` 6·`CREATED` 3·404 3): POST 횟수 | 12 | 12 (GET 12 + POST 12 + 토큰 1) | 예 |
| `payment_source.paypal.experience_context` (두 실행 × 12건) | `{return_url: 'https://example.com/afterloop/return', cancel_url: 'https://example.com/afterloop/cancel', user_action: 'PAY_NOW'}` 정확히 3키 | 24/24 그대로 | 예 |
| `shipping_preference` | 본문 어디에도 없음 | 본문 JSON 문자열 24개에 0회 | 예 |
| `application_context` | 없음 | 0회 | 예 |
| 최상위 키 | `intent`·`purchase_units`·`payment_source`뿐, `payment_source`는 `{paypal: {experience_context}}`뿐 | 24/24 | 예 |
| `payment_source`를 뺀 나머지 = 이전 코드 본문 | 필드별로 같음 | 24/24 같음 | 예 |
| `intent` | `CAPTURE` | 24/24 | 예 |
| `purchase_units` (1개, `reference_id`=주문 키, `items[0].name`=시드 상품명, `quantity: '1'`, 금액 문자열, `breakdown.item_total`, 모두 `USD`) | 시드와 같음 | 24/24 | 예 |
| `PayPal-Request-Id` 헤더 (옵션 없음) | `afterloop-order-O01` … `afterloop-order-O12` | 12/12 | 예 |
| `PayPal-Request-Id` 헤더 (`--fresh`, 09:31 KST) | `afterloop-order-Oxx-r202611100931` (12건 같은 접미사) | 12/12 | 예 |
| `orderRequestId`·`readSandboxOrderSpecs` 결과 | 이전 코드와 같음 | 같음 | 예 |
| 응답 `201` + `status: PAYER_ACTION_REQUIRED` + `links: [self, payer-action(www.sandbox.paypal.com/checkoutnow?token=…)]` | 종료 0, manifest 12건, 링크 파일 12행 | 종료 0 · manifest 12건(`key·orderId·buyer·sku·tracked`) · 링크 12행 · 출력 표의 주문 상태 칸 `PAYER_ACTION_REQUIRED` 12 | 예 |
| 고르기: `approve`만 | approve | approve | 예 |
| 고르기: `payer-action`만 | payer-action | payer-action | 예 |
| 고르기: 둘 다 (순서 무관) | approve | approve | 예 |
| 고르기: 둘 다 없음 / `links` 없음 / `null` / 배열 아님 | 빈 문자열 | 빈 문자열 | 예 |
| 고르기: `rel` 대소문자 (`PAYER-ACTION`, `Payer-Action`, `APPROVE`) | 고른다 | 고른다 | 예 |
| 고르기: `payer-action`인데 `href` 없음·숫자·빈 문자열 | 빈 문자열 (만들어 내지 않음) | 빈 문자열 | 예 |
| 고르기: `approve`에 `href`가 없고 `payer-action`에 있음 | payer-action | payer-action | 예 |
| 링크가 없는 응답 12건 (`links: [self]`) | 주문은 manifest에 적고 사유를 남김, 종료 1 | manifest 12건 · 링크 칸 "승인 링크 없음 — 응답에 승인 링크(approve·payer-action)가 없다" · "승인 링크 0건 / 주문 12건" · 종료 1 | 예 |
| 응답이 HTTP `200` + `PAYER_ACTION_REQUIRED` + `payer-action` (PayPal 문서 샘플의 모양) | manifest·링크 파일 정상 기록 | 두 모드 모두 종료 0 · 12건 기록. 요약 문구만 "같은 요청 ID로 돌려받음 12" / "recreated (same suffix) 12"로 찍힌다 | 예 (문구는 "발견한 문제 2") |
| 링크 파일 안내 줄 | "승인하면 `https://example.com/afterloop/return?...`으로 넘어간다. 그 화면이 뜨면 승인이 끝난 것이다." 가 표 위에 | 지시서 문장 그대로, 10번째 줄 (표 머리는 13번째 줄) | 예 |
| 링크 파일 표 | 머리 `| 주문번호 | 구매자 | 금액 | approve URL |`, 12행 4칸 | 그대로. 이전 코드 출력과의 차이는 안내 1줄 추가뿐(추가 1 · 삭제 0). `readApproveLinkCells`도 12칸을 읽는다 | 예 |
| 캡처 스크립트 (`runCapture`): `PAYER_ACTION_REQUIRED`·`CREATED` | "not approved yet", POST 없음, `captureId` 적지 않음 | 그대로 (건별 안내에 상태 `PAYER_ACTION_REQUIRED` 표시) | 예 |
| 캡처 스크립트: `APPROVED` / `COMPLETED` | 캡처 / 건너뜀 | POST는 `APPROVED` 2건의 `/capture`뿐(`afterloop-capture-Oxx`), `COMPLETED`는 skipped | 예 |

## 안전장치·T030 회귀
"실제 manifest"는 이 사본의 `tests/sandbox/manifest.json`(주문 12건 모두 `captureId` 있음, 분쟁 0건)과 `reports/sandbox-approve-links.md`를 **임시 폴더로 복사한 것**이다. 원본 두 파일은 프로브 전후 바이트가 같았다.

| 시나리오 | 보낸 요청 | 파일 변화 | 종료 코드 | 기대와 일치 |
|---|---|---|---|---|
| 승인 링크가 샌드박스가 아님 — 9종(`https://www.paypal.com/…`, `https://paypal.com.evil.example/…`, `http://www.sandbox.paypal.com/…`, `https://www.sandbox.paypal.com.evil.example/…`, `https://www.sandbox.paypal.com@evil.example/…`, `https://evilsandbox.paypal.com.example/…`, `https://xsandbox.paypal.com/…`, 해석 불가 문자열, `javascript:`) × `rel` 2종(`approve`, `payer-action`) × 모드 2종(옵션 없음, `--fresh`) = 36가지 | 36가지 모두 POST 1회에서 멈춤 | 없음 (manifest·링크 파일 그대로 또는 생기지 않음) | 1 | 예. 출력에 링크 전체(`token=`)는 실리지 않는다 |
| `approve`=live, `payer-action`=sandbox 둘 다 있음 | POST 1 | 없음 | 1 | 예 (고른 쪽이 live라 멈춤) |
| `approve`=sandbox, `payer-action`=live 둘 다 있음 | POST 12 | manifest·링크 파일에 sandbox `approve`만 기록, live 주소는 들어가지 않음 | 0 | 예 (멈추지는 않는다 → "발견한 문제 3") |
| 본문에 `example.com`이 들어 있는 정상 실행 | POST 12 | manifest 12건 · 링크 12행 | 0 | 예 (`example.com` 때문에 멈추지 않는다) |
| `PAYPAL_BASE_URL`이 `https://api-m.paypal.com` / `https://api-m.sandbox.paypal.com.evil.example` / `http://api-m.sandbox.paypal.com` × (옵션 없음, `--fresh`, `--status`) = 9가지. 가짜 값만 넣은 `process.env` + `.env` 없는 빈 임시 폴더로 `loadSandboxEnv` 호출 | 0 (클라이언트 생성 0회) | 없음 | 1 | 예. 오류 문구에 받은 주소는 실리지 않는다 |
| live `baseUrl`이 `loadEnv`를 지나쳐 클라이언트까지 감 | 0 (`createPayPalClient`가 만들 때 던짐) | 없음 | 예외 | 예 |
| 실제 manifest · 옵션 없음 | GET 0 · POST 0 | 불변 | 0 | 예 ("already created …" 안내) |
| 실제 manifest · `--fresh` (조회 200 `COMPLETED`) | GET 12 · POST 0 | 불변 | 0 | 예 (`kept (captured) 12`) |
| 실제 manifest · `--fresh` (조회가 404 / 200 `PAYER_ACTION_REQUIRED` / 200 `CREATED` / 네트워크 실패) | GET 12 · POST 0 (네 경우 모두) | 불변 | 1 | 예 (`captureId`가 있으면 어떤 응답에도 다시 만들지 않는다) |
| 실제 manifest · `--status` | GET 12 · POST 0 | 불변 | 0 | 예 |
| `npm_config_fresh=true` + 옵션 없음 / `npm_config_status=true` + 옵션 없음 | 0 (자격 증명 읽기 0회, 클라이언트 생성 0회) | 불변 | 1 | 예 ("옵션은 `--` 뒤에: …") |
| 가상 manifest(12건, `captureId` 없음) · 옵션 없음 | 0 | 불변 | 0 | 예 |
| 가상 manifest · `--fresh` · 12건 모두 `PAYER_ACTION_REQUIRED` | GET 12 · POST 12 (접미사 요청 ID, 새 본문) | manifest 새 주문 ID 12 + `previousOrderIds`, 분쟁 그대로 | 0 | 예 ("승인 전"으로 보고 다시 만든다) |
| 가상 manifest · `--fresh` · 12건 모두 `APPROVED` | GET 12 · POST 0 | 불변 | 0 | 예 (`kept (approved) 12`) |
| 가상 manifest · `--fresh` · 섞임 (`PAYER_ACTION_REQUIRED`×2, `CREATED`, 404, `APPROVED`×2, `COMPLETED`, 500, `VOIDED`, `SAVED`, 소문자 상태, 조회 실패) | POST 4 — `PAYER_ACTION_REQUIRED`·`CREATED`·404만 | 4행만 새 링크, 승인 2행·캡처 1행은 상태 문구, 나머지는 지난 링크. 새 파일에 T034 안내 줄 있음 | 1 | 예 (`recreated 4 · kept (approved) 2 · kept (captured) 1 · skipped (status unknown) 5`) |
| 가상 manifest 10건(O03·O11 없음) · 옵션 없음 | POST 2 (`afterloop-order-O03`, `afterloop-order-O11`) | manifest 12건 | 0 | 예 |

`approveUrlKind`·`sandboxApproveUrl`·`NotSandboxLinkError`의 코드는 이번 커밋에서 주석만 바뀌었다 (diff 확인). 샌드박스 주소 검사는 약해지지 않았다.

## PayPal 문서 대조
웹 열람 도구로 `developer.paypal.com`의 Orders v2 명세(`/api/orders/v2/schema.yaml`, 약 92만 자를 10만 자씩 10조각)와 `/api/orders/v2/orders-create` 페이지를 읽었다. 도구가 페이지를 요약해 돌려주는 방식이라, 아래 인용은 **그 요약이 옮겨 준 문구**다 (원문 YAML을 내가 직접 본 것은 아니다).

읽은 것
- `paypal_wallet_experience_context`에 `return_url`("The URL where the customer will be redirected upon approving a payment."), `cancel_url`, `user_action`(enum `CONTINUE`·`PAY_NOW`, 기본값 `CONTINUE`), `shipping_preference`(enum `GET_FROM_FILE`·`NO_SHIPPING`·`SET_PROVIDED_ADDRESS`, 기본값 `GET_FROM_FILE`)가 있다. → 코드가 보내는 필드 이름·값(`PAY_NOW`)이 명세와 맞고, `shipping_preference`를 넣지 않으면 기본값 `GET_FROM_FILE`(구매자 배송지 사용)이다.
- 주문 상태 enum에 `PAYER_ACTION_REQUIRED`("The order requires an action from the payer (e.g. 3DS authentication).")가 있다.
- 명세의 첫 주문 생성 샘플 "Create Order - PayPal Wallet as Payment Source, Resulting in PAYER_ACTION_REQUIRED Response": `payment_source.paypal.experience_context`(`user_action: PAY_NOW`, `return_url`, `cancel_url` 등)를 보내면 응답이 `status: PAYER_ACTION_REQUIRED`, 링크는 `rel: self`와 `rel: payer-action`(`…/checkoutnow?token=…`)이다. 이 샘플은 **`200` 응답 아래**에 실려 있다.
- `PayPal-Request-Id` 헤더 정의는 `required: false`, 설명 "A unique ID identifying the request header for idempotency purposes."
- `order_application_context`의 필드들은 DEPRECATED이고 `experience_context`에 쓰라고 되어 있다 → `application_context`가 아니라 `payment_source.paypal.experience_context`를 쓴 것이 명세 방향과 맞다.

확인하지 못한 것
- `payment_source`를 보낼 때 `PayPal-Request-Id`가 **필수가 되는지**: 명세 10조각 어디에서도 그런 문장(예: `PAYPAL_REQUEST_ID_REQUIRED`)을 찾지 못했다. 있다/없다를 단정하지 못한다. 다만 이 스크립트는 12건 모두 헤더를 보낸다 (probe1에서 헤더 확인, 클라이언트는 `requestId`가 비면 호출 전에 던진다).
- 실제 샌드박스가 `payment_source`를 받은 새 주문에 `201`을 주는지 `200`을 주는지, `approve` 링크를 함께 주는지 (문서 샘플은 `200` + `payer-action`만).
- 이미 쓴 `PayPal-Request-Id`를 **다른 본문**으로 다시 보냈을 때의 동작 (Orders v2 명세 밖이라 읽지 않았다).
- `return_url`이 있으면 승인 화면의 마지막 버튼이 실제로 넘어가는지 — 실호출·화면 조작 금지라 확인하지 않았다 (구현 보고서도 미검증으로 적었다).

## 발견한 문제
1. **[병합 후 수정] 링크 파일 테스트의 검사 범위가 표 안으로 좁아졌다.** `표의 승인 URL 12개가 모두 sandbox.paypal.com이다`는 이제 표 행의 링크 칸만 본다. 표 밖(안내 문구·`note` 줄)에 live 주소가 섞인 파일을 만들어 두 검사에 넣어 보니 이전 검사는 잡고 새 검사는 못 잡는다. 표 밖 URL을 보는 다른 테스트도 없다. 표 안의 live 주소는 새 검사도 잡는다(확인). 실행 중 안전장치(응답 링크의 도메인 검사)는 그대로이고 표 밖 문구는 코드의 고정 문자열이라 지금 당장 live 주소가 들어갈 경로는 없다 — 그래서 병합 차단은 아니다. 고치는 방법 하나: "파일 전체의 URL에서 `RETURN_URL` 안내만 빼면 12개이고 모두 sandbox" — 이 검사는 지금 출력에서 통과하고 표 밖 live도 잡는다 (probe3에서 확인).
2. **[의견] 새 주문 응답이 HTTP 200으로 오면 요약 문구가 "같은 요청 ID로 돌려받음" / "recreated (same suffix)"로 찍힌다.** PayPal 명세 샘플은 `payment_source`를 보낸 주문 생성 응답을 `200`으로 보여 준다. manifest·링크 파일·종료 코드는 정상이고 문구만 다르다. 실제 샌드박스가 무엇을 주는지는 확인하지 못했다.
3. **[의견] `approve`와 `payer-action`이 둘 다 있으면 고른 쪽(`approve`)의 도메인만 검사한다.** `approve`가 sandbox이고 `payer-action`만 live인 응답에서는 멈추지 않는다 (live 주소가 파일·manifest에 들어가지는 않는다). T034 이전부터 같은 동작이다.
4. **[의견] `rel`의 앞뒤 공백은 다듬지 않는다** (`" payer-action"` → 링크 없음으로 처리, 종료 1 + 사유 표시). 안전한 쪽으로 실패한다.
5. **[의견] 구현 보고서와 다른 곳 2가지.** (a) 보고서 제목 시각이 `2026-11-10 17:30`인데 커밋은 08:24·08:26 KST이고 지금이 08:37 KST다. (b) `sandbox-orders.test.ts`가 "+14건"이라 했는데 `it(` 줄 수로는 50 → 63, +13이다 (추가 16 · 삭제 3. 합계 63건·970건은 맞다).
6. **[확인하지 못함] 구현 보고서의 "`tests/sandbox/last-run.md`가 커밋되지 않은 채 바뀌어 있다"** 는 `afterloop-wt/paypal` 폴더의 상태라 볼 수 없었다 (그 폴더에 들어가지 않았다). 이 사본에는 커밋된 내용만 있다.

그 밖에 구현 보고서의 주장(바뀐 파일 3개, 278줄 추가·10줄 삭제, 지시서 1~5번 대조, 테스트 970 / 119(9 skipped), tsc·lint 출력 없음, 기대값을 바꾼 테스트 3건, 캡처 스크립트 미수정)은 직접 확인한 사실과 같다.

덧붙임: 검증 중 `verify-tmp` 폴더 목록에 `.env`라는 이름이 있는지 세는 명령을 한 번 실행했다 (결과 0, 어떤 파일도 열지 않았다). 지시의 "`.env`를 찾지 않는다"에 닿는 행동이라 적어 둔다.

## 컨트롤 타워가 결정할 것
1. **이 고침을 실제 샌드박스에서 확인할지, 한다면 어떤 경로로 할지.** 지금 manifest(12건 모두 `captureId`)로는 옵션 없는 실행도 `--fresh`도 POST를 0회 보낸다 (위 표). 즉 새 본문이 실제로 나가는 경로가 지금은 없다. 확인하려면 manifest에 없는 주문 키가 있어야 하는데, 옵션 없는 실행은 11/9~10에 이미 쓴 요청 ID(`afterloop-order-Oxx`)를 다른 본문으로 다시 보내게 된다 — 그때 PayPal이 무엇을 돌려주는지는 확인하지 못했다.
2. "발견한 문제 1"(테스트 검사 범위)을 후속 작업으로 낼지.
