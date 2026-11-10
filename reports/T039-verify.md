판정: 통과

# T039 독립 검증 (2026-11-10 10:25 KST)

- 대상: `lane/paypal` 최신 커밋 `eec1217` (분리된 HEAD), 기준 `main` `435d7ca`, merge-base `a676042`
- 기준 SPEC: `SPEC.md` 첫 줄 `# SPEC v2.3 (2026-11-10 09:56 KST)` — 지시서의 v2.3과 같다
- 방법: 지시서·SPEC 9-3·9-5·manifest·AC13을 먼저 읽고, 가짜 클라이언트 탐침을 직접 만들어 돌렸다. 구현 보고서는 마지막에 주장 대조용으로만 읽었다.
- 실제 PayPal 호출 0회 (`npm run sandbox:*` 실행하지 않음, `.env` 없음·찾지 않음, 셸에 `PAYPAL_*` 환경 변수 0개 확인)
- 병합 차단 문제는 없다. 다만 아래 "발견한 문제 1"은 완료 기준 문장을 글자 그대로 읽으면 일부만 충족이다 (안전 규칙 자체는 충족). 차단으로 볼지는 컨트롤 타워가 정한다.

## 근거

### 1. 범위 (`git diff main...HEAD --stat`)

```
reports/T039-impl.md           |  79 +++++
scripts/sandbox/check-steps.ts |  54 +++-
scripts/sandbox/manifest.ts    |  10 +-
scripts/sandbox/setup-steps.ts | 167 +++++++++--
scripts/sandbox/setup.ts       |  14 +-
tests/unit/sandbox-v23.test.ts | 646 ++++++++
6 files changed, 938 insertions(+), 32 deletions(-)
```

- 전부 수정 가능 폴더 + `reports/T039-impl.md` 안이다.
- `git diff main...HEAD --stat -- tests/sandbox src seed tests/acceptance package.json` 출력 0줄.

### 2. 실행 결과

| 명령 | 결과 | 종료 코드 |
|---|---|---|
| `npm test` | Test Files 19 passed (19) · Tests 1051 passed (1051) | 0 |
| `npx tsc --noEmit` | 출력 없음 | 0 |
| `npm run lint` | 출력 없음 | 0 |
| `npm run test:acceptance` | Test Files 9 passed (9) · Tests 120 passed, 9 skipped (129) — 건너뛴 9건은 AC13의 `RUN_SANDBOX=1` 묶음 | 0 |
| `npx vitest run tests/unit/sandbox-*.test.ts` | 171 passed (기존 4개 파일 24+27+63+26 = 140, 새 파일 31) | 0 |

### 3. 탐침 (가짜 클라이언트, 임시 폴더만 씀)

스크립트: `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/t039-verify/probe.ts`
결과: 확인 160개 중 PASS 158 · FAIL 2 (FAIL 2건은 "발견한 문제 1"). 가짜 클라이언트가 받은 요청 220건의 method·path를 전부 기록해 검사했다.

요청 모양별 합계: `POST /v2/checkout/orders` 2 · `POST …/orders/{id}/capture` 2 · `POST …/orders/{id}/track` 27 · `GET …/orders/{id}` 135 · `GET /v1/customer/disputes`(목록) 34 · `GET /v1/customer/disputes/{id}` 16 · `GET /v1/reporting/transactions` 4. **`/v1/customer/disputes`로 가는 POST 0회.**

| 지시서 항목 | 확인한 것 | 결과 |
|---|---|---|
| 1. manifest 형식 | 저장소의 실제 `manifest.json`을 `readManifest`로 읽어 `JSON.stringify(…, null, 2) + '\n'` 한 문자열이 파일과 바이트 단위로 같다. 주문 13·분쟁 4. `D2-old`의 `demoExcluded: true`·`note` 보존. 임시 폴더에 쓰고 다시 읽기를 두 번 해도 파일이 같다 | 통과 |
| 2. O13 보존 — 주문 생성 기본 | `main([], …, {root: 임시})`. 13건 그대로일 때 요청 0회·파일 그대로. O05를 뺀 manifest로 쓰기 경로를 강제 → POST는 `afterloop-order-O05` 1회뿐, 쓴 뒤 O13 항목·`D2-old`(메모 포함)·분쟁 4건 그대로, O13 ID가 들어간 요청(GET 포함) 0회 | 통과 |
| 2. O13 보존 — `--fresh` | 전부 COMPLETED: POST 0회, 조회한 키는 O01~O12뿐(O13 조회 0회), 파일 그대로. 전부 404로 답해도 POST 0회(캡처 ID 보호, 종료 코드 1). O05만 만료시켜 쓰기 경로 강제 → POST 1회(O05), O13·분쟁 그대로 | 통과 |
| 2. `--status` | GET 13회(O13 포함), POST 0회, 파일 그대로 | 통과 |
| 2. O13 보존 — 캡처 | 실제 manifest로 `runCapture`: 요청 0회, `{...manifest, orders}`로 쓴 파일이 원본과 같다. O05의 캡처 ID를 지워 쓰기 경로 강제 → POST는 O05 캡처 1회뿐, O13·분쟁 그대로 | 통과 |
| 2. O13 보존 — setup 두 단계 | `track`은 manifest를 쓰지 않는다 (코드 확인). `disputes`는 `{...manifest, disputes}`만 쓰고 주문 13건이 그대로다 (탐침) | 통과 |
| 3. `check` | 보고 주문 13건, 분쟁 4건, `demoExcluded` 1건(`PP-R-GAH-10197649`). 한 줄 JSON을 AC13 방식(마지막 줄 파싱)으로 읽으면 orders 항목 키 = key·orderId·status·itemNames·payerId·payerCountry·captureId·tracked, 시연 분쟁 항목 키 = key·disputeId·reason·stage·status·captureIds (시연 제외 항목만 `demoExcluded` 한 칸 더). AC13의 단언(13건, 추적 7/6, manifest와 일치, 분쟁 3건의 캡처 연결)을 가짜 보고에 적용하면 통과. `last-run.md`용 출력에서 `PP-R-GAH-10197649`가 나오는 줄 2개 모두 "시연 제외"가 있다. 분쟁 ID 4개 전부 있음. 보고·출력에 구매자 이름·이메일·토큰 문구 없음. POST 0회. 고정 숫자(12·7·5) 비교 코드는 `check.ts`·`check-steps.ts`에 없다 (`ORDERS_PER_BUYER`·`TRACKED_COUNT`는 주문 생성의 시드 검사에만 쓰인다) | 통과 |
| 4. `setup -- disputes` 재실행 | 정상 재실행: 조회한 캡처는 O02·O13·O08 (O01은 조회하지 않음), D2 = `PP-R-GMS-10197661`/O13 유지, `D2-old` 그대로, 종료 코드 0, POST 0회. 목록마다 `PP-R-GAH-10197649`가 섞여 나와도, O13 목록에 GAH만 나와도 D2로 배정되지 않는다. 전부 빈 목록(새 분쟁 없음): manifest를 쓰지 않고 파일 그대로. D2만 목록에 안 보임(지연)·D2 조회 500·네트워크 오류: 기존 D2 그대로. 두 번 돌린 파일이 서로 같다(멱등). D2 항목이 아예 없는 manifest: GAH를 D2로 배정하지 않고 모자란 키 `D2`·종료 코드 1 | 통과 |
| 5. `track` 안전 규칙 | 실제 manifest: `/track` POST는 O06·O09·O10·O11·O12 5건뿐. O01·O02·O08·O13에는 GET·POST 모두 0회. O01·O08 행에 "분쟁 진행 중이라 제외" (O01은 "(D2-old · 시연 제외)"까지). 분쟁 주문을 전부 `tracked: true`로 바꾼 가정에서도 4건 모두 요청 0회 + `disputed` 행. 분쟁 0건: `tracked: true` 7건만 호출. 모든 주문에 분쟁: 요청 0회. `planTrack`은 입력을 바꾸지 않는다 | 호출 0회는 통과. **표시는 O01·O08만** (문제 1) |
| 6. `tracked: false` | 실제 manifest의 `tracked: false` 6건(O02·O03·O04·O05·O07·O13) 요청 0회. 전부 `false`인 manifest: 요청 0회 | 통과 |
| 분쟁 POST 경로 없음 | `scripts/` 전체에서 `method: 'POST'`는 5곳: 주문 생성 2(`create-sandbox-orders.ts` 353·569), 캡처 1(`capture-sandbox-orders.ts` 155), 추적 등록 1(`setup-steps.ts` 146), 요청 ID 확인용 주문 생성 1(`check-steps.ts` 249). `/v1/customer/disputes`를 쓰는 곳은 전부 `client.get`. 탐침 요청 기록에서도 분쟁 POST 0회, GAH가 들어간 요청은 `check`의 GET 1종뿐 | 통과 |

### 4. AC13이 실제 샌드박스에서 통과할 조건 (코드로 확인, 실행하지 않음)

AC13은 `npx tsx scripts/sandbox/check.ts --json`을 저장소 루트에서 실행하고, 종료 코드·stdout 마지막 줄(JSON)·stderr·`tests/sandbox/last-run.md`를 읽는다. `check.ts`는 `--json`에서도 `last-run.md`의 "조회" 절을 다시 쓴다.

1. 종료 코드 0 = 토큰 성공 + 기능 조회 2개가 200 + `problems`가 비어 있음. `problems`에는 **manifest 주문 13건과 분쟁 4건의 조회가 하나라도 200이 아니면** 한 줄이 들어간다.
   - **시연 제외 분쟁(`PP-R-GAH-10197649`) GET이 200이 아니면 (404·403·네트워크 오류 모두 탐침으로 확인) 종료 코드 1 → AC13 "종료 코드 0" 실패.** 이때도 시연 분쟁 3건은 보고에 있고 `last-run.md`에는 GAH ID가 "시연 제외"와 함께 남는다. 기존 `last-run.md`(09:00 KST 실행 기록)에는 이 분쟁의 GET이 200이었다고 적혀 있다.
2. 주문 13건 전부 `COMPLETED`·캡처 ID 있음·상품명이 원문 4개 중 하나.
3. 결제자: 구매자마다 1명, 서로 다른 5명, 국가 일치.
4. 추적: 주문 상세 기준 등록 7건·미등록 6건이고 manifest `tracked`와 건별로 같다. `setup -- track`은 이제 O01·O08을 호출하지 않으므로 **O01·O08의 추적은 이미 등록돼 있어야 한다** (기존 `last-run.md`에는 둘 다 "등록"으로 적혀 있다).
5. D1·D2·D3: reason·단계가 표와 맞고 `captureIds`에 manifest 주문의 캡처 ID가 있다. D2의 주문(O13)은 `tracked: false`.
6. `last-run.md`에 manifest 분쟁 ID 4개가 모두 있다 (`checkSection`이 manifest 분쟁 전부를 적으므로 조회 실패여도 충족). stdout·stderr·`last-run.md`에 Secret·`access_token`·`Bearer …`가 없다.

### 5. 기존 단위 테스트 기대값

`git diff main...HEAD --stat -- tests/unit` → `tests/unit/sandbox-v23.test.ts` 새 파일 1개뿐 (646줄 추가). 기존 테스트 파일의 기대값 변경·검사 삭제 0건.

### 6. 비밀값

새로 생긴 출력 문구는 주문 키·분쟁 키·분쟁 ID·manifest의 `note`뿐이다 (`trackDisputedNote`, `runDisputes`의 비고, `checkSection`의 "시연" 칸과 제외 사유 줄). 토큰·Secret·Authorization이 들어갈 새 경로는 없다. 예외 문구는 전부터 있던 `failureLine(error)` 그대로이고 새로 추가된 `catch`는 없다 (가리기는 기존 `createPayPalClient`에 맡겨져 있다 — 이번 변경 범위 밖).

## 발견한 문제

### 병합 차단
없음.

### 병합 후 수정

1. **`track` 결과 표에 O02·O13의 "분쟁 진행 중이라 제외" 행이 없다.**
   `planTrack`이 `tracked: false`를 먼저 걸러(`setup-steps.ts` 65행) 분쟁이 있어도 `blocked`에 넣지 않는다. 그래서 표시는 O01·O08 2건뿐이다 (탐침 결과 표: `O01:disputed | O06:added | O08:disputed | O09 | O10 | O11 | O12`).
   - 호출 0회는 4건 모두 충족하므로 안전 규칙은 지켜진다. SPEC 9-3의 "일괄 등록 목록에서 빼고 표시" 기준으로는 O02·O13이 애초에 목록에 없으니 맞다고 읽을 수도 있다.
   - 완료 기준 문장("분쟁이 걸린 주문(O01·O02·O08·O13) 호출 0회 + '분쟁 진행 중이라 제외' 표시")을 글자 그대로 읽으면 절반만 충족이다.
   - `TrackPlan.blocked`의 주석 "(`tracked`와 무관하게 분쟁이 있는 주문 전부)"(49행)는 코드와 다르다.

### 기록만

2. `sandbox:check`는 시연 제외 분쟁 조회 실패도 `problems`로 세어 종료 코드 1을 낸다 (위 4-1). 구현 보고서 "남은 문제"에도 적혀 있다.
3. `setup -- disputes`가 분쟁을 찾아 manifest를 쓰면 분쟁 순서가 `D1, D2, D2-old, D3`으로 바뀐다 (지금 파일은 `D1, D2, D3, D2-old`). 내용은 같고 두 번째 실행부터는 파일이 같다. 키 순 정렬(`mergeDisputes`)은 `main`에도 있던 동작이다. AC13은 순서를 보지 않는다.
4. `sandbox:capture`는 시드에 있는 주문인지 구분하지 않는다. 지금 O13은 캡처 ID가 있어 요청 0회지만, **가정**으로 O13의 캡처 ID가 없고 주문이 APPROVED이면 O13에 캡처 POST 1회가 나간다 (탐침 확인). 지금 manifest에서는 일어나지 않는다.
5. manifest에서 D2 항목이 사라지면 `runDisputes`는 기본 표(O01)로 돌아가 GAH만 만나고 D2를 찾지 못한다 (배정하지 않고 종료 코드 1 — 안전하다). O13에서 자동으로 다시 찾지는 못하므로 사람이 `orderKey: O13`으로 적어야 한다.
6. O13의 캡처에 다른 분쟁 ID가 새로 나오면 D2가 그 ID로 바뀐다 (`D2-old`는 그대로). 다시 접수한 경우를 위한 의도된 동작으로 보인다 (추측).
7. 스키마: 분쟁의 `note`가 빈 문자열이면 manifest 읽기가 실패한다 (`min(1)`). 모르는 칸은 여전히 버려진다 (분쟁·주문 모두).
8. 남은 옛 문구: `setup.ts` 82행·`capture-sandbox-orders.ts` 267행·`create-sandbox-orders.ts` 932행의 "주문 12건", `check.ts` 머리말의 "SPEC v2.2" (동작에는 영향 없음).

## 구현 보고서(`reports/T039-impl.md`)와 다른 점

- 완료 기준 표의 `track` 행을 "통과"로만 적었다. 실제 표시는 O01·O08뿐이고 구현자의 테스트도 `disputed` 키를 `['O01', 'O08']`로 기대한다. 보고서에는 O02·O13이 표시되지 않는다는 말이 없다 (문제 1).
- 보고서 제목의 시각 "2026-11-10 19:20"은 커밋 시각(10:16~10:17 KST)과 맞지 않는다.
- 근거로 든 기존 테스트 이름은 정확히는 "tracked: true인 주문만 등록하고, 미등록 주문은 건드리지 않는다"이다 (`sandbox-setup.test.ts` 64행. 내용은 맞다).
- 그 밖의 주장(테스트 수 1051·31·140, 인수 120/9, POST 5곳, 줄 번호 391·628·108·114, `tests/sandbox/` 변경 0줄, O13 보존에 코드 변경이 필요 없었다는 설명)은 확인한 결과와 같다.

## 확인하지 못한 것

- 실제 샌드박스 동작 전부: `npm run sandbox:check`, `RUN_SANDBOX=1` AC13, 시연 제외 분쟁 GET이 지금도 200인지, O01·O08에 추적이 지금도 붙어 있는지 (기존 `last-run.md` 기록으로만 봤다).
- `setup.ts`·`capture-sandbox-orders.ts`·`check.ts`의 진입점(`main`)은 폴더 주입이 없어 직접 실행하지 않았다. 같은 조립(`{...manifest, disputes: merged}`, `{...manifest, orders}`, 종료 코드 식)을 탐침에서 그대로 재현했고 코드 읽기로 대조했다. `printTrack`의 화면 출력도 코드 읽기로만 봤다.
- 실제 PayPal의 `GET /v1/customer/disputes?disputed_transaction_id=…` 응답 모양 (가짜 응답은 `items[].dispute_id` 가정).
- `createPayPalClient`의 비밀값 가리기 (이번 변경 범위 밖).

## 작업 뒤 상태

`git status -s` → `?? reports/T039-verify.md` 한 줄. 저장소의 `tests/sandbox/manifest.json`은 탐침 뒤에도 바이트 그대로다.
