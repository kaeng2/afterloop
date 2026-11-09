# T001 보고 (2026-11-09 23:05)

- 기준 SPEC: v2.2 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/paypal / eb169f4 (구현) + 이 보고서 커밋

## 결과
**1단계 완료.** `.env.example`·`.gitignore`·`package.json` 스크립트, `scripts/sandbox/`(check·setup), 빈 manifest, 단위 테스트 24개를 만들었고 실호출 3가지(토큰 발급, 기능 확인 2종, 요청 ID 길이 확인)를 끝냈다. AC13 오프라인 2개 통과. 2단계(`track`·`disputes` 실행, `RUN_SANDBOX=1` AC13 11개)는 T026의 주문 12건 캡처 + 사람의 분쟁 3건 접수를 기다린다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `.env.example` | `PAYPAL_CLIENT_ID`·`PAYPAL_CLIENT_SECRET`·`PAYPAL_BASE_URL`·`LLM_API_KEY` 빈 값 + 한 줄 주석 |
| `.gitignore` | `!.env.example` 한 줄 추가 (`.env`는 그대로 무시) |
| `package.json` | `scripts`에 `sandbox:check`, `sandbox:setup` 두 줄 추가 |
| `scripts/sandbox/env.ts` | `.env`를 런타임에 `process.loadEnvFile`로만 읽는다. 셸 값이 `.env`보다 우선. 샌드박스가 아니면 호출 전에 던진다. 오류 문구에 값을 담지 않는다 |
| `scripts/sandbox/paypal.ts` | `createPayPalClient` 래퍼(실제 fetch·시계), 응답 읽기 도움 함수, 오류 요약(`name`·`issue`·`debug_id`만), 쿼리 퍼센트 인코딩 |
| `scripts/sandbox/manifest.ts` | `tests/sandbox/manifest.json` 읽기·쓰기 (zod 검증, 없으면 빈 manifest) |
| `scripts/sandbox/last-run.ts` | `last-run.md`를 **절별로** 덮어쓴다 (조회 / 요청 ID 확인). 한쪽을 다시 돌려도 다른 쪽 기록이 남는다 |
| `scripts/sandbox/check-steps.ts` | `runCheck`(토큰·기능·주문·분쟁 조회), `probeRequestId`, `last-run` 절 작성. 진입점 없음 |
| `scripts/sandbox/check.ts` | `npm run sandbox:check` 진입점 (`--json`, `--probe-request-id`, 종료 코드) |
| `scripts/sandbox/setup-steps.ts` | `runTrack`(추적 7건), `runDisputes`(캡처로 분쟁 찾기), 분쟁↔주문 키 표. 진입점 없음 |
| `scripts/sandbox/setup.ts` | `npm run sandbox:setup -- <track\|disputes>` 진입점. `orders`·`capture`는 T026으로 넘긴다는 안내만 |
| `tests/sandbox/manifest.json` | 빈 상태 (`{"orders":[],"disputes":[]}`) |
| `tests/sandbox/last-run.md` | 실호출 기록 (조회 + 요청 ID 길이 확인) |
| `tests/unit/sandbox-setup.test.ts` | 단위 테스트 24개. 가짜 클라이언트만 쓴다 (실호출 없음) |

진입점(`check.ts`·`setup.ts`)과 로직(`*-steps.ts`)을 나눈 이유: 단위 테스트가 모듈을 import할 때 `main()`이 돌아 실제 PayPal을 부르면 안 된다.

`tests/unit/`은 T001 "수정 가능 폴더" 목록에 없지만 SPEC v2.2 11장 끝줄("자기 모듈의 테스트는 `tests/unit/`, `tests/integration/`")에 따라 거기에 새 파일 하나만 더했다. 기존 테스트 파일은 건드리지 않았다.

## 요청 ID 길이 확인 결과 (2026-11-09 23:00 KST)
`POST /v2/checkout/orders` (intent CAPTURE, USD 1.00, 상품명 `Request-Id length probe`). 승인·캡처하지 않았고 manifest에도 넣지 않았다 (버려지는 주문).

| 시도 | ID 길이 | 상태 | 주문 ID | 결과 |
|---|---|---|---|---|
| 1회차 | 61 | 201 | 4VU53650HC418403N | 받아들였다 |
| 2회차 (같은 61자 ID) | 61 | 200 | 4VU53650HC418403N | **같은 주문 ID → 멱등이 걸린다** |
| 비교용 | 36 | 201 | 7SB1374355564260G | 받아들였다 |

- **결론: 61자 `PayPal-Request-Id`는 Orders API에서 그대로 쓸 수 있다.** 길이 때문에 실행 계획의 요청 ID 꼴(`plan-<분쟁 ID>-<수>-<API>-<금액>-<환불 종류>:<엔드포인트>`)을 줄일 필요가 없다. 거부(400·422)는 없었다.
- 쓴 ID는 실행마다 같은 값이다(`scripts/sandbox/check-steps.ts`의 `PROBE_ID_61`·`PROBE_ID_36`). 다시 돌려도 PayPal이 같은 주문을 돌려주므로 버려지는 주문이 쌓이지 않는다.
- Orders API에서의 확인이다. 분쟁 API(send-message 등)의 길이 허용은 첫 실호출(T009) 때 다시 확인해야 한다 (지시서대로).

## 기능 확인 실호출 (2026-11-09 23:01 KST)
| 엔드포인트 | 상태 |
|---|---|
| `GET /v1/customer/disputes?page_size=1` | **200** |
| `GET /v1/reporting/transactions` (최근 29일) | **200** |

토큰 발급 성공. 403 없음 — 앱의 Customer disputes·Transaction search가 둘 다 켜져 있다. 종료 코드 0.
`--json`은 AC13이 읽는 한 줄만 출력한다: `{"token":{"ok":true},"features":{"disputes":200,"transactionSearch":200},"orders":[],"disputes":[]}`

## 비밀값 확인
- `PAYPAL_CLIENT_SECRET=wrong-secret-for-test npm run sandbox:check` → 종료 코드 1, 출력은 `PayPal /v1/oauth2/token → 401: 액세스 토큰 발급 실패 (Client ID·Secret과 앱 설정을 확인한다)` 한 줄. Secret·토큰·Authorization 값 없음.
- 그 뒤 `tests/sandbox/last-run.md`를 `access_token|bearer|authorization|basic|client_secret|wrong-secret-for-test`로 검사 → 하나도 없음. (내가 넘긴 값 `wrong-secret-for-test`가 파일에 안 들어갔다는 것이 직접 증거다)
- 이 세션은 `.env`를 읽지 않았다. 스크립트도 런타임에 `process.loadEnvFile`로만 읽고 값을 출력하지 않는다.
- `git status`에 `.env`가 뜨지 않는다 (`.gitignore`). 커밋은 파일을 하나씩 `git add`했다.
- `last-run.md`에는 엔드포인트·상태 코드·주문/분쟁/캡처 ID·시각만 적는다. `payer_id`·이메일·이름은 적지 않는다 (SPEC 10장).

## 실호출 범위
지시서 1단계에 적힌 것만 불렀다: 토큰 발급, `GET /v1/customer/disputes`, `GET /v1/reporting/transactions`, `POST /v2/checkout/orders` 3건(61자 2회 + 36자 1회). 캡처·추적 등록·분쟁 상태 변경(send-message·make-offer·accept-claim·escalate)·추적 조회는 하지 않았다. `PAYPAL_BASE_URL`은 샌드박스였고 live 화면·응답은 없었다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac13.sandbox.test.ts` | 2 | 0 | 샌드박스 9개는 건너뜀 (`RUN_SANDBOX` 없음) = 1단계 완료 기준 |
| `npm run test:acceptance` | 104 | 15 | 실패 15개는 전부 `ac17.seed.test.ts` (seed 레인). 내 파일과 무관 — 아래 "남은 문제" |
| `npm test` | 410 | 0 | 새 `tests/unit/sandbox-setup.test.ts` 24개 포함 |
| `npx tsc --noEmit` | — | 16 | 전부 `seed/data.ts`·`seed/index.ts`·`seed/schemas.ts`. `scripts/`·`tests/`에는 오류 0 |
| `npm run lint` | 통과 | — | 경고 없음 |
| `npm run sandbox:check` | 종료 0 | — | 위 "기능 확인" |
| `npm run sandbox:check -- --probe-request-id` | 종료 0 | — | 위 "요청 ID 길이" |
| `npm run sandbox:setup` / `-- orders` / `-- track` | 종료 1 | — | 쓰는 법 안내 / T026으로 넘김 / "manifest에 주문이 없다". PayPal 호출 없음 |

실패한 테스트: `ac17.seed.test.ts`의 15개. 원인은 `SeedDispute.orderId`와 `SeedOrder.date`가 `seed/`에 아직 없는 것(SPEC v2.2가 더한 시드 계약 필드 Q10). `seed/`는 data 레인이고 내 수정 가능 폴더가 아니라 손대지 않았다. 내 작업 전부터 있던 실패다 (`tsc` 오류 16개도 같은 원인·같은 파일).

## 남은 문제
- **2단계가 남았다**: T026이 주문 12건을 만들고 캡처한 뒤 + 사람이 분쟁 3건을 접수한 뒤에 `npm run sandbox:setup -- track`, `-- disputes`를 돌리고 `RUN_SANDBOX=1`로 AC13 11개를 확인해야 한다. `track`·`disputes`는 지금 가짜 클라이언트 단위 테스트로만 확인했다 (실호출 0회).
- `runDisputes`는 캡처 ID를 `GET /v1/customer/disputes?disputed_transaction_id=<캡처 ID>`로 질의해 분쟁을 찾는다. 분쟁 **목록** 응답에는 `seller_transaction_id`가 없어서(`tests/fixtures/dispute-list.json`) 질의 조건으로 거는 쪽을 골랐다. 실제 샌드박스에서 이 질의가 먹는지는 2단계에서 처음 확인된다.
- `runTrack`의 `carrier_name_other`(`Fernwood Knits demo carrier`)와 추적번호 꼴(`FKAL<주문 번호>2026`)은 가상값이다. 샌드박스가 거부하면 2단계에서 문구를 바꿔야 한다.
- `tests/sandbox/last-run.md`를 커밋에 넣었다 (지시서 "수정 가능 폴더"에 있고 AC13 2단계가 읽는다). 실행 기록이라 매번 바뀐다 — 커밋에서 빼는 쪽이 낫다면 알려 주면 `.gitignore`에 넣는다.
- `seed/`의 `tsc` 오류 16개 + `ac17` 실패 15개는 data 레인(T007) 몫으로 남아 있다.

## 사람 작업 체크리스트 (2단계 전에)
- [x] US 비즈니스 샌드박스 계정 (Fernwood Knits)
- [x] REST 앱에서 Customer disputes·Transaction search 켬 — **API로 200 확인됨 (403 아님)**
- [x] 개인 계정 5개
- [x] `.env` 입력 (사람이 직접. 이 세션은 읽지 않았다)
- [ ] **비즈니스 계정이 US인지 사람이 확인** — API로는 볼 수 없다. 아직 확인받지 못했다
- [ ] T026 `sandbox:orders`가 만든 승인 링크 12개 승인 (브라우저 에이전트)
- [ ] Resolution Center에서 분쟁 3건 접수 (D1 지호 SNAD / D2 서연 INR / D3 buyer_m INR). D2 메시지는 지시서 문구 그대로
- [ ] 버려지는 확인용 주문 2건(`4VU53650HC418403N`, `7SB1374355564260G`)은 승인·캡처하지 않는다. 그냥 두면 만료된다

## 컨트롤 타워에 요청할 결정
1. **단위 테스트 위치.** T001 "수정 가능 폴더"에 `tests/unit/`이 없는데 완료 기준은 `setup.ts`의 단위 테스트를 요구한다. SPEC 11장 끝줄을 근거로 `tests/unit/sandbox-setup.test.ts`를 새로 만들었다 (`npm test`가 거기만 돈다. `tests/sandbox/`에 두면 `RUN_SANDBOX=1` 없이는 돌지 않는다). 지시서 쪽을 고치는 게 맞다면 다음 지시서에 `tests/unit/`을 더해 주기 바란다.
2. **요청 ID 61자는 Orders API에서 확인됐다** (멱등 포함). 분쟁 API는 T009에서 확인해야 하니, 그 전까지 실행 계획 요청 ID 꼴을 바꾸지 않기를 권한다. SPEC·계약 변경은 필요 없다.
3. `manifest.json`에 `captureId`(선택 필드)를 넣을 수 있게 zod 스키마를 열어 뒀다. AC13의 `Manifest` 타입에는 없지만 AC13이 그 필드를 읽지 않으므로 통과에 영향이 없다. T026의 `capture` 단계가 캡처 ID를 적으면 `track`·`disputes`가 주문 상세를 다시 부르지 않는다. 계약(`tests/acceptance/ac13.sandbox.test.ts`)에 적어 넣을지는 컨트롤 타워가 결정해 주기 바란다.
