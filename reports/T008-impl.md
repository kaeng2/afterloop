# T008 보고 (2026-11-09 21:50)

- 기준 SPEC: v2.1 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `SPEC v2.1 (2026-11-09 21:02 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal-exec / `42601bd` (이 보고서 커밋은 그 다음)
- 실행 위치: `afterloop-wt/paypal-exec` (worktree 확인함). 실제 PayPal 호출 없음, `.env`를 찾거나 읽지 않음.

## 결과
완료 — 승인된 `ActionPlan`을 PayPal 요청 1건으로 바꿔 보내는 `executeMove`를 구현했다. 승인·허용 수·확인 플래그·초안 검사는 모두 네트워크 호출 전에 끝나고, 메시지 안 금액과 API 본문 금액은 같은 센트 값 하나에서 나온다. 인수 테스트 AC11·AC12 10개와 단위 테스트 20개가 통과한다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/exec/execute.ts` (새 파일) | 공개 함수 `executeMove` (`ExecuteMoveFn`). 거부 판정 순서 → 자리표시자 채우기 → 요청 1건 → 호출 1회. 거부·실패 문구를 `COPY` 한 곳에 모았다 |
| `src/exec/amount.ts` (새 파일) | 센트 → `"7.20"`(본문) / `"$1,234.56"`(메시지). 자리수를 문자열로 잘라 쓰고 `/100`·`toFixed`를 쓰지 않는다 |
| `src/exec/message.ts` (새 파일) | `{{offerAmount}}`·`{{refundAmount}}` ← `plan.amountCents`, `{{disputeAmount}}` ← `board.amountCents`. 직접 쓴 금액(`$` 뒤 숫자, 숫자 뒤 USD·달러)과 모르는 자리표시자 판정 |
| `src/exec/request.ts` (새 파일) | `make-offer` / `send-message` / `accept-claim` 경로·본문, `requestId = <planId>:<엔드포인트 이름>` |
| `tests/unit/execute.test.ts` (새 파일) | 단위 테스트 20개 |

`src/types.ts`, `tests/acceptance/`, `config/`, `src/paypal/`, `src/engine/`은 건드리지 않았다.

### 동작 요약 (지시서 "동작" 대조)
| 지시서 항목 | 구현 |
|---|---|
| 1. 거부 (호출 0회) | 승인 없음 / `planId` 불일치 / `apiMove`가 `allowedMoves`에 없음 / `accept_claim`인데 `confirmAcceptClaim !== true` / 초안의 직접 금액·모르는 자리표시자 / `provide_evidence`(`nextAction`: "PayPal 화면에서 직접 증빙 제출을 진행하세요.") 모두 `{ ok:false, error, nextAction }`, 호출 0회 |
| 2. 자리표시자 | `plan`/`board`에서 채우고 표기는 `$7.20`. 센트 → 문자열은 정수·문자열 연산만. 새 금액을 계산하지 않는다 |
| 3. 요청 1회 | `make_offer` → make-offer(메시지는 `note`, send-message 호출 없음), `send_message` → send-message, `accept_claim` → accept-claim. 경로 `/v1/customer/disputes/{disputeId}/...` |
| 4. 요청 ID | `<planId>:<엔드포인트 이름>` (예: `unit-offer-id:make-offer`) |
| 5. 중복 승인 | 성공한 `planId`를 프로세스 메모리에 기억하고 두 번째 실행은 호출 없이 이전 결과를 돌려준다. **주입된 `call` 함수별로** 기억한다 (아래 "판단한 부분" 1번) |
| 6. 실패 | 2xx가 아니면 `error`에 엔드포인트와 상태 코드, `nextAction`에 사람이 할 일. `call`이 예외를 던져도 예외를 올리지 않고 거부로 돌려준다 |
| 7. 비밀값 | 로그를 남기지 않고, 결과·문구에 토큰·구매자 이메일·응답 본문을 넣지 않는다 (단위 테스트로 확인) |

### 판단한 부분 (계약은 바꾸지 않았다)
1. **중복 승인의 기억 범위**: `planId`만으로 기억하면 인수 테스트 AC12의 마지막 케이스(`plan-test-offer`를 AC11에서 이미 성공시킨 뒤 "같은 계획에 맞는 승인이 있으면 호출한다")가 호출 0회가 되어 깨진다. 그래서 `WeakMap<PayPalCaller, Map<planId, result>>`로 **주입된 `call`(= 클라이언트 1개)별**로 기억했다. 운영에서는 클라이언트가 하나라 "프로세스 메모리 기준"과 같고, 테스트는 가짜 호출마다 분리된다. 서버 쪽 중복은 `PayPal-Request-Id`가 막는다.
2. **중복 검사 위치**: 승인 검사 바로 뒤, 나머지 검증 앞에 둔다 ("이미 성공했으면 다시 호출하지 않고 이전 결과를 돌려준다"를 그대로). 실패한 호출은 기억하지 않는다.
3. **방어 거부 2건 추가** (지시서 거부 목록에 없지만 호출 전에 걸러야 본문을 만들 수 없는 경우): ① `make_offer`·`accept_claim`인데 `plan.amountCents`나 `plan.refundType`이 null ② `plan.disputeId !== board.disputeId` (다른 분쟁으로 요청이 나가지 않게) ③ 금액이 센트 정수가 아님. 모두 호출 0회 거부다.
4. **`send_message`의 빈 메시지**는 거부하고, `make_offer`·`accept_claim`은 메시지가 비면 `note`를 넣지 않는다 (금액 본문은 그대로 보낸다).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac11-12.exec.test.ts` | 10 | 0 | 완료 기준의 AC11·AC12. 호출 목록이 정확히 `['make-offer']` / `['accept-claim']` / `['send-message']` |
| `npm run test:acceptance` (전체) | 37 | 2 (+ 로드 실패 3파일, 9 skip) | 실패는 모두 **내 작업과 무관한 미병합 레인**: `ac04`·`ac07`은 `@/engine/plan`·`@/engine/escalation` 없음, `ac14`는 `@/paypal/client` 없음(T002), `ac13` 2건은 루트 `.env.example`이 없고 `.gitignore`의 `.env*`가 그 파일까지 무시해서 실패 (둘 다 내 수정 가능 폴더 밖) |
| `npm test` (단위 전체) | 124 | 0 | 그중 `tests/unit/execute.test.ts` 20개 |
| `npx tsc --noEmit` | — | 0 (내 파일) | 남은 오류 3건은 위와 같은 미병합 모듈(`@/engine/plan`, `@/engine/escalation`, `@/paypal/client`) import 뿐 |
| `npx eslint src/exec tests/unit/execute.test.ts` | — | 0 | 출력 없음 |

단위 테스트 항목 대조: 중복 승인 시 호출 1회 ✓ / `provide_evidence` 거부 + 증빙 안내 ✓ / 2xx 아님 → `error`에 `make-offer`·`422`, `nextAction`에 다음 행동 ✓ / 같은 계획 재실행 시 같은 `requestId` ✓ / `$0.05`·`$1,234.56`·`$48.00` 표기 (함수 단위 + `executeMove` 본문·메시지 동시 확인) ✓

## 남은 문제
- `provide_evidence`(multipart 증빙 업로드)는 구현하지 않았다. 지시서대로 거부하고 PayPal 화면 안내만 한다 (T017·P1).
- 중복 승인 기억은 프로세스 메모리라 서버를 재시작하면 사라진다 (서버 쪽 중복은 `PayPal-Request-Id`가 막는다). SPEC 범위대로 둔다.
- `src/paypal/client.ts`(T002)가 병합되면 `deps.call`에 실제 클라이언트를 꽂는 배선(화면·API 라우트)이 필요하다. T008 범위 밖이다.

## 컨트롤 타워에 요청할 결정
- **실행 결과 문구의 위치**: CLAUDE.md는 "화면 문구는 `config/`에서 읽는다"인데 `config/copy.ko.json`에는 실행 거부·실패 문구 키가 없고 `config/`는 이 작업의 수정 가능 폴더 밖이다. 지금은 `src/exec/execute.ts`의 `COPY` 상수 한 곳에 모아 두었다. 화면이 이 문구를 그대로 보여줄 것이라면 `config/copy.*.json`에 `exec.*` 키를 추가하는 작업(엔진/UI 레인)을 따로 내려 주시면 그 때 옮기겠다. 영어 화면(`copy.en.json`)도 같은 결정이 필요하다.
- 그 밖에 계약(`src/types.ts`)·인수 테스트·SPEC을 바꿔야 할 부분은 없음.
