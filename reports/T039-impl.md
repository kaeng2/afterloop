# T039 보고 (2026-11-10 19:20)

- 기준 SPEC: v2.3 (시작할 때 `SPEC.md` 첫 줄과 같았다: 예 — `SPEC v2.3 (2026-11-10 09:56 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal / `6a4b85e`

## 결과

완료. 샌드박스 스크립트를 SPEC v2.3 구성(주문 13건, 시연 제외 분쟁, 분쟁 걸린 주문은 추적 등록 제외)에 맞췄다.
**실제 PayPal 호출은 하지 않았다** (`npm run sandbox:*`를 어떤 옵션으로도 실행하지 않았다). `.env`를 열지 않았고
`tests/sandbox/` 아래 파일은 읽기만 했다 (`git diff --stat -- tests/sandbox/` 0줄).

지시서 "고칠 것" 2번(시드에 없는 주문 O13 보존)은 **코드 변경이 필요하지 않았다.** 이미 그렇게 동작하고 있어서
(T029/T030의 `unknownKeyOrders`와 `runCapture`의 manifest 순회) 동작을 테스트로 고정했다. 근거는 아래 "대조" 표에 적었다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `scripts/sandbox/manifest.ts` | 분쟁 항목에 선택 칸 `demoExcluded?: boolean`, `note?: string` 추가 (지시서 1번). 주문 항목은 그대로 |
| `scripts/sandbox/check-steps.ts` | `DisputeRow`에 `demoExcluded`(참일 때만 붙는다), `readDispute(…, demoExcluded)`. `checkSection`의 분쟁 표를 **manifest 분쟁 전부** 기준으로 바꾸고 `시연` 칸 + 제외 사유 줄 추가 (지시서 3번) |
| `scripts/sandbox/setup-steps.ts` | 순수 함수 `disputedOrderKeys`·`planTrack`·`orderKeyForDispute`·`demoExcludedDisputeIds` 추가. `runTrack`이 분쟁 걸린 주문을 호출 전에 뺀다(결과 `disputed`). `runDisputes`가 manifest의 `orderKey`를 우선하고 시연 제외 ID를 배정하지 않는다. `mergeDisputes`·`missingDisputeKeys`가 `demoExcluded`를 안다 (지시서 4·5번) |
| `scripts/sandbox/setup.ts` | `track` 요약에 `분쟁 진행 중이라 제외 n` 추가. 머리말 설명 갱신 |
| `tests/unit/sandbox-v23.test.ts` (새 파일) | 31개 테스트: manifest 왕복, O13 보존, check 보고, disputes 재실행, track 안전 규칙, POST 경로 감사 |

바꾸지 않은 것: `scripts/create-sandbox-orders.ts`, `scripts/capture-sandbox-orders.ts`(이미 O13을 보존한다 — 아래 참고),
`src/`, `seed/`, `tests/acceptance/`, `tests/sandbox/`, `package.json`.

## 완료 기준 대조

| 완료 기준 | 결과 | 근거 |
|---|---|---|
| manifest 왕복 뒤 `demoExcluded`·`note` 그대로. 저장소 정본이 스키마 통과하고 재직렬화 결과가 파일과 같다 | 통과 | `T039 1.` 3개. 정본 파일 내용과 `JSON.stringify(parsed, null, 2) + '\n'`이 **글자 단위로 같다** (파일은 쓰지 않았다) |
| 주문 생성(기본·`--fresh`)·캡처·setup 각 단계 뒤 O13이 그대로 있고 O13 POST 0회 | 통과 | `T039 2.` 5개. 기본·`--fresh`는 임시 폴더 + 가짜 클라이언트로 돌려 `ORDER-O13`·`CAP-O13`을 포함한 호출이 0건임을 확인. `--status`는 O13도 GET하고 manifest 파일 바이트가 안 바뀜 |
| `check` 보고 주문 13건, 분쟁 4건(그중 `demoExcluded` 1건) | 통과 | `T039 3.` 4개. 추적 수도 manifest 기준으로 비교 (고정 숫자 없음) |
| `setup -- disputes` 재실행: `D2-old` 보존, D2는 O13의 분쟁, 목록에 `PP-R-GAH-…`가 다시 나와도 D2로 배정되지 않는다 | 통과 | `T039 4.` 8개. 목록이 `[제외 ID, 새 ID]`든 `[제외 ID]`만이든 제외 ID는 배정되지 않는다. 두 번 돌려도 결과가 같다(멱등) |
| `track`: O01·O02·O08·O13 호출 0회 + "분쟁 진행 중이라 제외" 표시, 분쟁 없는 `tracked: true`만 호출 | 통과 | `T039 5.` 6개. 호출되는 것은 O06·O09·O10·O11·O12 5건뿐 (`/track` POST 경로 목록으로 확인) |
| `tracked: false`인 주문에는 어떤 경로로도 추적 등록 호출이 없다 | 통과 | `T039 6.` 2개 (새로 추가) + 기존 `sandbox-setup.test.ts`의 "tracked: true인 주문만 등록한다" |
| 실제 분쟁에 대한 POST 경로가 이 스크립트들에 없다 | 통과 | `T039 7.` 3개. 스크립트 13개 파일에서 ① 분쟁 조치 엔드포인트 11종(`send-message`·`make-offer`·`accept-claim`·`escalate` …) 문자열 0건 ② `method: 'POST'`의 경로가 주문 생성·캡처·추적 등록 5곳뿐 ③ `PP-R-GAH-10197649`가 스크립트에 하드코딩되어 있지 않다 |
| `git diff --stat`에서 `tests/sandbox/` 변경 0줄, 실호출 0회 | 통과 | `git diff --stat -- tests/sandbox/` 출력 0줄. `npm run sandbox:*`를 실행하지 않았다 |

### 지시서 2번(O13 보존)이 이미 되어 있던 이유

- `sandbox:orders` 기본·`--fresh`: `runCreateOrders`·`runFreshOrders`가 돌려주는 주문 목록 끝에
  `unknownKeyOrders(existing, specs)`(시드 규격에 없는 manifest 항목)를 붙인다 (`create-sandbox-orders.ts:391·628`).
  두 함수 모두 `specs`만 순회하므로 O13에는 POST도, 조회도 나가지 않는다.
- `sandbox:capture`: `runCapture`가 manifest 주문을 순회하고, `captureId`가 적힌 주문은 호출 없이 `skipped`로 넘긴다
  (`capture-sandbox-orders.ts:108·114`). O13에는 `captureId`가 있으므로 호출 0회다.
- `sandbox:setup`의 두 단계는 주문 목록을 쓰지 않는다 (`disputes`는 `{ ...manifest, disputes }`만 쓴다).
- `--status`·`sandbox:check`는 원래부터 manifest 주문 전부를 조회하고, 상품명·구매자 검사는 AC13이 manifest의
  `buyer`·`sku`로 한다.

그래서 코드는 그대로 두고 위 4개 경로를 각각 테스트로 고정했다 (`T039 2.`).

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 120 | 0 | 9 skipped = AC13의 `RUN_SANDBOX=1` 묶음 (실호출이라 돌리지 않았다 — 병합 뒤 컨트롤 타워가 돌린다) |
| `npm test` | 1051 | 0 | 그중 새 `tests/unit/sandbox-v23.test.ts` 31건 |
| `npx tsc --noEmit` | - | 0 | 출력 없음 |
| `npm run lint` | - | 0 | 출력 없음 |

기존 단위 테스트는 **기대값을 하나도 바꾸지 않았다** (140건 그대로 통과). `tests/acceptance/`는 실행만 했다.

## 남은 문제

- `sandbox:check`는 manifest 분쟁을 전부 조회하므로, 시연 제외 분쟁 `PP-R-GAH-10197649`의 `GET`이 200이 아니면
  `problems`에 들어가 종료 코드가 1이 된다 (AC13은 0을 기대한다). 지금 샌드박스에서 그 분쟁은 살아 있으니(CHARGEBACK)
  200이 돌아올 것으로 보지만, 실호출은 하지 않았으므로 **확인되지 않았다**. 병합 뒤 `npm run sandbox:check`로 확인한다.
  (조회가 실패해도 `last-run.md`에는 분쟁 ID가 남게 해 두었다 — AC13의 "ID가 적혀 있다" 검사는 통과한다.)
- `sandbox:orders`의 승인 링크 파일(`reports/sandbox-approve-links.md`)은 시드 12건만 적는다 (제목도 "주문 12건").
  O13은 이미 캡처된 주문이라 승인할 것이 없어 그대로 두었다. 수정 가능 폴더 안이지만 지시서에 없어 손대지 않았다.
- `setup -- track`의 결과 `disputed`는 종료 코드를 1로 만들지 않는다 (정상 상태이지 실패가 아니다).
  현재 manifest에서는 분쟁 없는 `tracked: true` 5건만 호출 대상이고, 이미 등록된 주문은 `skipped`가 된다.

## 컨트롤 타워에 요청할 결정

없음. (계약(`src/types.ts`)·인수 테스트·SPEC을 바꿀 필요가 없었다. `CheckReport.disputes` 항목에 선택 칸
`demoExcluded?: boolean`이 붙지만 AC13의 타입 선언은 추가 칸을 읽지 않으므로 그대로 통과한다.)
