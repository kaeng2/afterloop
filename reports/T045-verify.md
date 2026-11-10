# T045 검증 (2026-11-10 11:10)

판정: 통과

- 대상: `lane/data` @ `6bfeed8` (구현 커밋 `1e1c05d` + 보고서 커밋). 기준 SPEC v2.5 (`SPEC.md` 첫 줄 `# SPEC v2.5 (2026-11-10 10:52 KST)`).
- 검증자는 코드·시드·테스트·문서를 고치지 않았다. 탐침은 scratchpad `t045-verify/` 아래에만 두었다 (`probe-index.ts`, `probe-classify.ts`, `probe-schema.ts`). 검증 뒤 `git status -s`는 비어 있었다 (이 파일을 쓰기 전).
- 병합 차단 문제 없음. 병합 후 수정 없음. 기록만 9건.

## 1. 범위

`git diff main...HEAD --stat` → 8 files changed, 317 insertions(+), 16 deletions(-)

| 파일 | 상태 | 수정 가능 범위 안인가 |
|---|---|---|
| `seed/carrier-events.json` | A | 예 |
| `seed/data.ts`, `seed/generate.ts`, `seed/index.ts`, `seed/schemas.ts`, `seed/README.md` | M | 예 |
| `tests/unit/seed.test.ts` | M | 예 |
| `reports/T045-impl.md` | A | 예 (보고서) |

범위 밖 변경 0.

기존 시드 JSON 5개: `products`·`buyers`·`inquiries`·`disputes`·`orders` 모두 main(`a464399`)의 blob 해시 = HEAD blob 해시 = 작업 폴더 `git hash-object`가 같고, `cmp`로도 바이트 동일.

## 2. 실행 결과

| 명령 | 종료 코드 | 결과 |
|---|---|---|
| `npm run test:acceptance` | 0 | 10 파일, 135 통과 · 9 skipped · **실패 0** |
| `vitest run tests/acceptance/ac17.seed.test.ts -t "시연용 배송사 데이터"` | 0 | 5 통과 (묶음의 5건 전부) |
| `npm test` | 0 | 20 파일, 1081 통과 · 실패 0 (`tests/unit/seed.test.ts` 60건, 그중 T045 묶음 8건) |
| `npx tsc --noEmit` | 0 | 출력 0줄 |
| `npm run lint` | 0 | 경고·오류 출력 없음 |
| `npm run seed` 1회차 | 0 | `seed/*.json` 6개 sha256이 실행 전과 같음 |
| `npm run seed` 2회차 | 0 | 1회차와 sha256·콘솔 출력 모두 같음. `git status -s` 비어 있음 (`seed/` 변경 없음) |

## 3. `seed/carrier-events.json` 대조 (지시서 "만들 것" 2번)

파일 내용 (7건, 키는 전부 `orderId|date|status|text|isDemo`):

| 주문 | 날짜 | status | text |
|---|---|---|---|
| O01 | 2026-10-18 | shipped | Shipment picked up |
| O01 | 2026-10-21 | in_transit | In transit to destination country |
| O01 | 2026-10-30 | customs_hold | Customs hold – recipient customs ID missing |
| O08 | 2026-10-17 | shipped | Shipment picked up |
| O08 | 2026-10-19 | in_transit | In transit to destination facility |
| O08 | 2026-10-21 | out_for_delivery | Out for delivery |
| O08 | 2026-10-22 | delivered | Delivered – left at front door |

| 요구 | 결과 |
|---|---|
| O01 shipped가 10/17~10/19 | 10/18. 맞음 (주문일 10/17) |
| O01 shipped → in_transit → customs_hold | 맞음 |
| customs_hold 날짜 2026-10-30 | 맞음 |
| 글이 정확히 `Customs hold – recipient customs ID missing` | 맞음. 길이 43, 13번째 문자 코드포인트 **U+2013** (en dash), 나머지는 전부 ASCII. `"Customs hold – recipient customs ID missing"`과 `===` |
| O01 배송 완료 없음 | 맞음 |
| O08 shipped → … → delivered | 맞음 (in_transit, out_for_delivery 포함. 지시서가 허용) |
| O08 배송 완료가 주문일(10/16) 이후, 10/27 이전 | 10/22. 맞음 |
| 그 밖의 주문에 없음 | 이벤트가 있는 주문은 `O01`, `O08`뿐 |
| 합계 5건 이상 | 7건 |
| 전부 `isDemo: true` | 7건 모두 불리언 `true` |
| 주문마다 날짜 오름차순 | 맞음 |
| 이름·이메일·주소·개인통관고유부호 값 없음 | `P\d{12}` 없음, `@` 없음, 숫자 0개, 한글 0개. 사람 이름·주소로 읽힐 낱말 없음 |
| 짧은 영어 한 줄 | 맞음 (최장 43자) |

`seed/README.md`: "시연용 배송사 데이터" 절이 추가됐고 지시서 3번의 세 가지(PayPal 데이터 아님 / `trackingEvents` / 서연 화면 "배송사 정보 반영 후" / buyer_m 배송 완료 기록)를 모두 적었다. 표의 날짜는 파일과 같다.

## 4. `seed/index.ts` 탐침 (`probe-index.ts`)

| 호출 | 결과 |
|---|---|
| `seedCarrierEvents` | 배열, 7건 |
| `carrierEventsFor('O01')` | 3건, 10-18 → 10-21 → 10-30 날짜순 |
| `carrierEventsFor('O08')` | 4건, 10-17 → 10-19 → 10-21 → 10-22 날짜순 |
| `carrierEventsFor('O99')` | `[]` |
| `carrierEventsFor('')` | `[]` |
| `'o01'`(소문자), `' O01 '`(공백), `'O13'`, `undefined` | 모두 `[]` (예외 없음) |
| 돌려받은 배열에 `push`·`reverse` | 원본 `seedCarrierEvents` 그대로. 다시 부르면 3건. 호출마다 새 배열 |
| 돌려받은 **원소**의 `text`를 고침 | **원본이 바뀐다** (원소 객체를 공유한다. frozen 아님). 다시 부른 결과에도 고친 값이 나온다 → 기록 2 |

## 5. 이야기와 맞는지

시드 값: O01 = B01 김서연, KR, 주문일 2026-10-17, D2(A2, open). O08 = B04 buyer_m, US, 주문일 2026-10-16, D3(F1, open). B04의 이전 미수령 분쟁은 D7(O09)·D8(O10) 2건 (둘 다 closed).

- **O01 날짜 흐름**: 주문 10/17 → 발송 10/18 → 이동 중 10/21 → 통관 보류 10/30 → 문의 11/02 → 문의 11/09. 순서는 어긋나지 않는다.
- **11/09 "벌써 3주째"**: 주문일에서 23일. 맞는다. "며칠째 같은 단계에서 멈춰 있고"도 10/30부터 열흘이라 어긋나지 않는다.
- **11/02 "배송 조회가 일주일째 그대로예요"**: 배송사 기록으로는 10/30에 통관 보류로 **바뀐 지 사흘 뒤**다. 글자 그대로 읽으면 어색하다 (일주일 전인 10/26 무렵에는 '이동 중'이었고 10/30에 한 번 바뀌었다). 다만 10/30은 SPEC 12장과 AC17이 고정한 날짜이고 11/02 문의는 기존 시드라, 이 작업이 고를 수 있던 값이 아니다 → 기록 1
- **O08**: 주문 10/16 → 발송 10/17 → 배송 완료 10/22 → 문의 10/28 "Same problem again - the package is not here." 배송 완료가 문의보다 엿새 앞이다. "배송 완료 기록이 뜬 뒤 못 받았다고 했다"는 흐름이 선다. 미국 내 배송이라 "destination facility" 표현도 어색하지 않다.

## 6. 분류 규칙과 맞물리는지 (`probe-classify.ts`, 완료 기준 밖)

main 체크아웃의 `src/ai/classify.ts`의 `classifyDispute`를 import. LLM은 부르면 던지는 가짜. 사유는 `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`. (`classify.ts`, `prompts/classify.ts`, `engine/params.ts`, `config/rules.json`, `types.ts`는 두 체크아웃에서 내용이 같다. `abuse.minPriorInrDisputes` = 2)

| 입력 | 결과 | LLM 호출 |
|---|---|---|
| O01 이벤트 3건, `hasTracking: true`, `hasDeliveredTracking: false`, 이전 0 | **A2**, `source: 'rule'`, `confidence: 1`, evidence `tracking_event:customs_hold`, `causeNote: "Customs hold – recipient customs ID missing"` | 0 |
| 이벤트 없음, `hasTracking: false` (서연 "반영 전") | A1 (rule, `no_tracking`) | 0 |
| O08 이벤트 4건, `hasDeliveredTracking: true`, 이전 2 | **F1**, rule, evidence `prior_inr_disputes:2`, `delivered_tracking` | 0 |
| O08, 이전 1 | 규칙 안 걸림 → LLM 경로 (가짜가 던져 `classifier_unavailable`) | 2 |
| O01 이벤트 3건인데 `hasTracking: false` | A1 (규칙 3이 규칙 4보다 먼저) → 기록 9 |  0 |

화면이 쓰려는 두 경로(O01 → A2, O08 → F1) 모두 규칙으로 정해진다.

## 7. 스키마가 잘못된 데이터를 거부하는지 (`probe-schema.ts`)

| 잘못된 데이터 | 어디서 걸리나 | 결과 |
|---|---|---|
| 모르는 status (`lost`) | `seedCarrierEventSchema` | 거부 |
| `isDemo: false` / 없음 / 문자열 `"true"` | 스키마 | 거부 |
| 계약에 없는 필드 | 스키마 (strict) | 거부 |
| 날짜 형식 틀림, `2026-13-45`, 창 밖(`2026-11-11`, `2026-08-11`) | 스키마 | 거부 |
| `text` 빈 문자열, `orderId` 빈 문자열 | 스키마 | 거부 |
| 없는 주문 `O99` | `carrierEventProblems` | 거부 ("주문 O99이 orders에 없다") |
| 주문일(10-17)보다 앞선 10-16 | `carrierEventProblems` | 거부 |
| 날짜 순서 뒤집힘 | `carrierEventProblems` | 거부 |

지시가 든 다섯 가지는 모두 거부된다. 다만 뒤의 세 가지는 zod 스키마가 아니라 `carrierEventProblems`가 잡고, 이 함수는 `seed/generate.ts`(생성 때)와 단위 테스트에서만 불린다 → 기록 3.

받아들여지는 것 (사실만): `text`가 공백뿐인 줄, `text`에 이메일이나 `P` + 숫자 12자리가 든 줄, 같은 날짜 2건, 상태 순서가 거꾸로인 줄(delivered → shipped, 날짜는 오름차순), 주문이 섞여 적힌 파일 → 기록 4·5.

## 8. 구현 보고서(`reports/T045-impl.md`) 주장 대조

| 주장 | 사실 |
|---|---|
| 인수 테스트 135 통과 + 9 skipped, 실패 0 | 맞음 |
| AC17 배송사 묶음 5건 통과 | 맞음 |
| `npm test` 1081 (20 파일) | 맞음 |
| **`tests/unit/seed.test.ts` 61건 (기존 53 + T045 8)** | **틀림. 60건이다 (기존 52 + T045 8).** vitest 출력 `seed.test.ts (60 tests)`, main의 같은 파일은 `it(` 52개 |
| `tsc`·`lint` 통과, 출력 없음 | 맞음 |
| `npm run seed` 2회 바이트 동일, 기존 JSON 5개 변화 없음 | 맞음 |
| `git diff main --stat`: `seed/` 6개 + `tests/unit/seed.test.ts`뿐 | 보고 시점 기준으로는 맞음 (세 점 diff로 그 7개 + 보고서). **지금 두 점 `git diff main --stat`은 16 files**로 나온다 — 구현 뒤 main이 `4e4f4a3` → `a464399`로 움직였기 때문이고(T042 병합), 이 브랜치의 변경이 아니다 |
| 마지막 커밋 `1e1c05d` | 구현 커밋은 맞음. HEAD는 그 뒤 보고서 커밋 `6bfeed8` |
| 작업 전 인수 테스트가 그 5건만 실패 | 확인하지 못함 (아래) |

## 9. 발견한 문제

### 병합 차단
없음.

### 병합 후 수정
없음.

### 기록만
1. **11/02 문의와 10/30 통관 보류의 간격.** "배송 조회가 일주일째 그대로예요"(11/02)는 배송사 기록상 상태가 바뀐 지 사흘 뒤다. 화면에서 두 줄이 나란히 보이면 심사위원이 물을 수 있다. 날짜 둘 다 계약(SPEC 12장·AC17, 기존 시드)이라 이 작업에서 고칠 수 없었다. 고치려면 컨트롤 타워 결정이 필요하다 (예: 통관 보류 날짜를 앞당기거나 문의 문장을 바꾸는 것 — 어느 쪽이든 계약 변경).
2. **`carrierEventsFor`가 원소 객체를 공유한다.** 배열은 호출마다 새로 만들지만 안의 객체는 `seedCarrierEvents`와 같은 객체다. 받은 쪽이 원소 필드를 고치면 원본과 이후 모든 호출 결과가 바뀐다. 기존 `seedOrders` 등도 얼지 않은 배열이라 같은 성질이다.
3. **주문 맞물림 검사는 불러올 때 돌지 않는다.** `seed/index.ts`는 zod 스키마만 통과시킨다. JSON을 손으로 고쳐 없는 주문·주문일보다 앞선 날짜·뒤집힌 순서를 넣어도 앱은 그대로 읽는다 (걸리는 곳은 `npm run seed`, 단위 테스트, AC17). main의 `seed/index.ts`도 `disputeOrderProblems`를 부르지 않으므로 기존 방식과 같다.
4. **스키마가 `text` 내용을 보지 않는다.** 공백뿐인 글, 이메일, 개인통관고유부호 모양이 스키마를 통과한다. 지금 파일은 AC17과 단위 테스트의 개인정보 검사가 막고 있다.
5. **`carrierEventProblems`가 상태 순서를 보지 않는다.** 날짜만 오름차순이면 delivered → shipped도 통과한다. 지시서가 요구한 것은 날짜 순서뿐이다.
6. **거부 쪽 단위 테스트가 없다.** `tests/unit/seed.test.ts`의 T045 8건은 모두 올바른 파일이 통과하는지만 본다. `carrierEventProblems`가 잘못된 줄을 잡는지는 이 검증의 탐침으로만 확인했다. 지시서 완료 기준에는 없는 항목이다.
7. **오류 문구 조사.** `windowedDateSchema('배송사 이벤트 날짜')`의 메시지가 "배송사 이벤트 날짜**은** … 안이어야 한다"로 나온다 ("날짜는"이 맞다). 사용자 화면에는 나오지 않는 개발자용 문구다.
8. **구현 보고서의 테스트 수 오기.** 61(53 + 8)이 아니라 60(52 + 8).
9. **화면이 `hasTracking`을 직접 정해야 한다.** `orders.json`의 O01은 `tracked: true`인데 서연 "반영 전"은 추적 없음(A1)이다. O01 이벤트를 넣어도 `hasTracking: false`면 A1이 나온다 (규칙 3이 먼저). 전·후 입력을 만드는 쪽(ui 레인)이 `hasTracking`을 전 false / 후 true로 넘겨야 한다. 시드의 문제는 아니다 (SPEC 10장 ④).

## 10. 확인하지 못한 것

- **구현 전 상태**: "작업 전 인수 테스트는 그 5건만 실패했다"는 주장. 브랜치를 옮기지 않아 재현하지 않았다.
- **최신 main과 병합한 뒤의 결과**: 검증 도중 main이 `4e4f4a3` → `d4560ef` → `a464399`로 움직였다 (T042 병합·완료 기록). 그 사이 main의 변경은 `seed/`, `tests/unit/seed.test.ts`, `tests/acceptance/`, `src/types.ts`, `SPEC.md`, `tasks/T045.md`를 건드리지 않아 충돌 가능성은 낮지만, 병합한 상태에서 테스트를 돌려 보지는 않았다 (git 상태를 바꾸지 않는 규칙).
- **화면에서의 실제 사용**: `src/app/`이 이 데이터를 읽어 'Demo data' 배지를 붙이는지는 이 작업 범위 밖이라 보지 않았다.
- **루트 `README.md` 정직성 표**에 배송사 데이터가 적혔는지 (컨트롤 타워 소유 파일).
- **실제 LLM 경로**: 분류 탐침은 규칙 경로만 봤다.
