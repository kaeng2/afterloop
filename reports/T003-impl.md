# T003 보고 (2026-11-09 23:05)

- 기준 SPEC: v2.2   (시작할 때 SPEC.md 첫 줄과 같았는지: 예 — `# SPEC v2.2 (2026-11-09 22:31 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal-client / `b8d7b22` (보고서 커밋은 그 다음 커밋)
- 실제 PayPal 호출: 0회. `.env`를 찾거나 읽지 않았다. 가짜 `PayPalClient`·가짜 `fetch`와 `tests/fixtures/`만 썼다.

## 결과
완료 — 분쟁 목록·상세 조회(`src/paypal/disputes.ts`)와 `BoardState`·`ClassifyInput` 변환(`src/paypal/mapper.ts`)을 만들고, T002 재검증 보고 문제 1(제어문자로 쪼갠 비밀값이 가리기 뒤에 다시 이어 붙는 것)을 `labelPath`에서 고쳤다. 지시서의 완료 기준 체크 항목은 AC15(작성 예정)을 빼고 모두 단위 테스트로 덮었다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/paypal/disputes.ts` (새 파일) | `listDisputes`(쿼리 퍼센트 인코딩, `links[rel=next]` 이어 읽기, `MAX_PAGES`=20 상한, 샌드박스 밖 링크 거부), `getDispute`(`PP-` 꼴만, 호출 전 거부), zod 스키마(`disputeSummarySchema`·`disputeDetailSchema`), `buildListPath`·`nextPath`·`assertDisputeId`·`parseDisputeDetail`·`parseDisputeSummary` |
| `src/paypal/mapper.ts` (새 파일) | `toBoardState`, `toClassifyInput`, `buyerKeyOf`, `countPriorInrDisputes`, `apiValueToCents`, `toAllowedMoves`, `BoardExtra`·`ClassifyExtra` 타입 |
| `src/paypal/client.ts` | `labelPath`만 고쳤다: 제어문자 제거를 가리기 **앞**으로 옮기고(지시서 "같이 고칠 것"), 비밀값 자체에 제어문자가 섞인 경우까지 보려고 지우기 전에도 한 번 가린다. 다른 동작·상수·주석은 그대로 |
| `tests/unit/disputes.test.ts` (새 파일) | 31개. 경로·쿼리 인코딩, 쪽 넘기기(2쪽·순환·상한·샌드박스 밖), 응답 검증, 이상한 분쟁 ID, 개인정보 버리기, 실제 클라이언트와 맞물리는지 |
| `tests/unit/mapper.test.ts` (새 파일) | 54개. fixture 3개 변환, 금액 문자열 표, 모르는 값 예외, `allowedMoves` 순서, `countPriorInrDisputes`, `toClassifyInput`, `recommend()` 연결 |
| `tests/unit/client.test.ts` | 사례 8개 추가(기존 86 → 94). 제어문자 6종으로 쪼갠 Secret·토큰, 정상 경로 로그 회귀 |

지시서의 "수정 가능 폴더" 밖은 건드리지 않았다 (`git status`로 확인: 위 6개 파일뿐). `src/types.ts`·`tests/acceptance/`·`tests/fixtures/`·`config/`·`package.json`은 읽기만 했다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac14.client.test.ts` | 14 | 0 | AC14 14개 그대로 |
| `npm run test:acceptance` | 102 | 17 | 9 skip. 실패는 전부 범위 밖 — `ac13.sandbox` 2개(`.env.example`이 아직 없다. T001), `ac17.seed` 15개(`seed/`의 `orderId`·`date`. T028 진행 중). 두 파일 모두 `src/paypal/`을 import하지 않는다 |
| `npm test` | 479 | 0 | 10개 파일. 새 파일 85개(disputes 31 + mapper 54), `client.test.ts` 94 |
| `npx tsc --noEmit` | — | 0 (내 파일) | `seed/`의 기존 오류 14줄만 남는다 (T028이 고치는 중이라 건드리지 않았다). `src/paypal/`·`tests/unit/`의 새 파일 오류 0 |
| `npx eslint` (바뀐 6개 파일) | — | 0 | 종료 코드 0 |

### 고친 것 확인 (T002 재검증 문제 1)
새 사례 7개를 **고치기 전 코드**(`labelPath`의 옛 순서)에 돌려 7개 모두 실패하는 것을 확인하고, 고친 뒤 94개 전부 통과하는 것을 확인했다. 검사 표면은 기존 `surfaces()` 그대로(`message`, `String(err)`, `stack`, `JSON.stringify({...err})`, `cause`, 자기 속성 전부, `deps.log` 전체)이고, 가짜 Secret·Basic·토큰 4종이 어디에도 없다. 거부된 path라 fetch는 0회다.

### 완료 기준 대조
| 지시서 체크 항목 | 어디서 |
|---|---|
| fixture 3개 변환 (금액·단계·채널·기한·허용된 수) | `mapper.test.ts` "fixture 변환" 6개. 대기 fixture → 4800 / INQUIRY / INTERNAL / `2026-11-29T06:09:25.608Z` / `['send_message','make_offer','accept_claim']`, 검토 중 fixture → 4800 / INQUIRY / INTERNAL / `''` / `[]`, 목록 항목 → 4800 / INQUIRY / INTERNAL / `2026-11-29T06:09:25.000Z` / `[]` |
| `make_offer` 없으면 `allowedMoves`에 없다 / 합의 단계에 `provide_evidence` 없다 | 같은 절 2개 |
| 금액 문자열 표 (`"48.00"`→4800 … `"abc"`·빈 값 → 예외) | `apiValueToCents` 절. 지시서 값 8개 + 예외 12개 + 문자열 아닌 값 6개 |
| 모르는 `stage`·`channel`·통화 → 예외, 문구에 응답 값 없음 | "모르는 값은 예외" 절 5개. 받은 값과 구매자 정보 4종이 문구에 없는 것까지 본다 |
| `listDisputes` 2쪽 이어 읽기, 쿼리 퍼센트 인코딩, `/`로 시작 | `disputes.test.ts` "경로와 쿼리"·"쪽 넘기기" 9개 |
| `getDispute` 이상한 ID → 호출 0회 예외 | 같은 파일 "getDispute" 11개(`../x`, 공백, `PP-1?x=1`, 빈 값, 소문자, 슬래시, 줄바꿈, 퍼센트 인코딩 등) |
| `countPriorInrDisputes` INR 2건 → 2, 다른 구매자·SNAD 제외 | `mapper.test.ts` 5개 (겹친 건 1회만, 여러 거래 중 하나라도 같은 구매자면 셈 포함) |
| 변환 결과를 `recommend()`에 넣어도 돈다 | "엔진과 맞물린다" 3개 (`cause`는 테스트에서 직접 넣는다) |
| 가짜 `sleep`은 가짜 시계도 옮긴다 | `disputes.test.ts` 마지막 절의 harness (`sleep: ms => clock += ms`) |
| `npx tsc --noEmit` 내 파일 오류 없음, AC14 그대로 | 위 표 |
| AC15 통과 | **아직 작성 전** (지시서대로 범위 밖) |

## 구현에서 정한 것 (SPEC 범위 안, 계약 변경 없음)
1. **기한이 둘 다 없으면 `dueDate: ''`.** `BoardState['dueDate']`는 `string`(필수)이고 `src/engine/params.ts`의 `BoardStateSchema`도 `z.string()`이라 빈 문자열이 통과한다. 검토 중 fixture에는 `seller_response_due_date`·`buyer_response_due_date`가 둘 다 없는데, 지시서가 그 fixture의 변환을 완료 기준으로 뒀으므로 예외로 막지 않고 "기한 없음"을 빈 문자열로 옮긴다 (날짜를 지어내지 않는다). 화면·확대 위험 작업이 빈 값을 읽어야 한다.
2. **금액 변환은 자리 이어 붙이기.** `"1234.5"` → `"1234" + "50"` → `123450`. 소수부를 `padEnd(2,'0')`로 채우고 한 번만 `Number()`로 읽는다. 16자리 이상이거나 안전한 정수를 넘으면 예외. `src/exec/amount.ts`의 반대 방향(`centsToApiValue`)과 같은 규칙이지만 그 파일은 이 작업의 수정 범위가 아니라 `mapper.ts`에 두었다 (나중에 한곳으로 모으는 것은 컨트롤 타워 판단).
3. **쪽 상한에 걸리면 예외 대신 그때까지 모은 것을 돌려준다** (`MAX_PAGES` = 20, 같은 경로를 다시 가리키는 `next`는 멈춤). 호출하는 쪽이 조건(`dispute_state`, `start_time`)을 좁혀 다시 부른다.
4. **`next` 링크는 샌드박스 origin만 따라간다.** 응답이 live 주소나 다른 호스트를 가리키면 예외다 (응답은 신뢰하지 않는 입력).
5. **쿼리는 `URLSearchParams`로 인코딩**한다 (T002 재검증 의견 5: 클라이언트 path 검사가 공백·`://`를 막는다). `dispute_state`는 쉼표로 이어 `%2C`로 나간다.
6. **개인정보**: zod 스키마에 구매자 이름·이메일·주소를 선언하지 않아 조회 단계에서 떨어진다. 구매자 식별은 `disputed_transactions[].buyer.payer_id`뿐이고(없으면 `buyerKeyOf`가 예외), 메시지 원문은 `toClassifyInput`에만 들어간다(마스킹은 T006). 실패 예외 문구에는 필드 이름만 싣는다.
7. **스키마 엄격도**: 목록·상세 모두 `dispute_id`·`reason`·`dispute_life_cycle_stage`·`dispute_channel`·`dispute_amount`를 필수로 본다 (fixture 3개 모두 가지고 있다). 샌드박스 실호출에서 이 필드가 빠진 항목이 오면 그 쪽 전체가 예외가 된다 — 실호출 확인(분쟁 3건 접수 후)에서 다시 볼 지점이다.

## 남은 문제
- AC15(인수 테스트)가 아직 없다. 지시서대로 단위 테스트까지만 했다. AC15가 추가되면 통과 확인이 필요하다.
- `toBoardState`에 목록 항목(`DisputeSummary`)을 넣으려면 `messages`를 채워야 한다 (상세 타입에만 있는 필드). 테스트에서는 `{ ...item, messages: [] }`로 넣었다. 화면이 목록만으로 보드를 만들 일이 있으면 작은 도움 함수가 하나 더 필요할 수 있다 (지금 계약으로는 불필요).
- `src/paypal/client.ts`에 남은 T002 재검증 의견 2~6(네트워크 예외 문구 길이, `debug_id` 길이, 400자리 `Retry-After`, 폭 없는 공백 `requestId` 등)은 지시서의 "같이 고칠 것"에 없어 그대로 두었다.
- 추적 정보(`hasTracking`·`hasDeliveredTracking`)와 원인(`cause`)은 받기만 한다 (T011·T006).

## 컨트롤 타워에 요청할 결정
- 없음. (위 "구현에서 정한 것" 1번 — 기한이 없을 때 `dueDate: ''` — 는 타입·엔진 스키마가 허용하는 범위 안이라 계약 변경이 아니지만, 화면 작업이 빈 값을 "기한 없음"으로 그려야 하므로 UI 레인 지시서에 한 줄 적어 두면 좋다.)
