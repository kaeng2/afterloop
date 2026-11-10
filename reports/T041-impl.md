# T041 보고 (2026-11-10 10:52)

- 기준 SPEC: v2.4 (시작할 때 `SPEC.md` 첫 줄과 같았는지: **예** — `# SPEC v2.4 (2026-11-10 10:44 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal-exec / `743f1c3`

## 결과
완료 — `PayPal-Request-Id`를 `hash(계획 ID + 엔드포인트 이름 + 보내는 본문)`에서 만든 **정확히 36자** 값으로 바꿨다. 형식은 `al-` + SHA-256 16진수 앞 33자 (예: `al-0e316720cbb33eb35ab9e63cadae2648e`, 36자, 문자 집합 `[a-z0-9-]`). 본문을 먼저 만들고 그 본문에서 번호를 만들도록 `buildRequest`를 재배치했으므로, 같은 분쟁의 두 번째 메시지는 다른 요청 번호로 나간다. 계약(`src/types.ts`의 `ApiRequest.requestId: string`)과 `src/engine/`의 `planId` 만드는 방식은 건드리지 않았다.

참고로 옛 형식(`<planId>:<엔드포인트 이름>`)은 실제 길이의 계획 ID에서 49~64자가 된다 (지시서가 적은 61자 확인값과 일치).

### 요청 번호를 만드는 곳
`src/exec/` 안에서 `planId`를 요청 번호로 이어 붙이던 곳은 **`src/exec/request.ts`의 `requestIdFor` 한 곳뿐**이었다 (`grep -rn "planId" src/exec/`로 확인. `copy.ts`·`execute.ts`의 `planId`는 승인 대조·중복 실행 기억용이고 요청 번호와 무관하다). `scripts/`의 주문·캡처·배송 요청 번호(`afterloop-order-O01` 등)는 지시서대로 범위 밖이라 고치지 않았다.

### 구현 요점
- **결정적**: 시각·난수·프로세스 정보를 섞지 않는다. 입력은 계획 ID, 엔드포인트 이름, 본문뿐이다.
- **경계 모호성 제거**: 본문은 키를 사전순으로 정렬한 JSON(`canonicalJson`, 중첩 객체·배열 포함)으로 직렬화하고, 세 조각을 `길이:값` 접두로 이어 붙인다(`lengthPrefixed`). 메시지 안에 `:`나 `{"message":"..."}`가 들어 있어도 다른 입력과 같은 재료 문자열이 되지 않는다.
- **원문 노출 없음**: 접두 뒤는 16진수뿐이므로 메시지 글자·대문자·점·밑줄이 남을 수 없다. 분쟁 ID(`PP-R-GMS-10197661`), 계획 ID, 금액 표기(`7.20`, `48.00`)가 들어 있지 않음을 테스트로 확인했다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/exec/request.ts` | `requestIdFor(planId, endpoint, body)` = `al-` + sha256 앞 33자. `canonicalJson`·`lengthPrefixed` 추가, `REQUEST_ID_MAX_LENGTH`(36) export. 본문 생성을 `bodyFor`로 분리해 `buildRequest`가 본문 → 요청 번호 순서로 만들게 함. 모듈 주석의 옛 형식 설명을 v2.4 규칙으로 교체 |
| `tests/unit/exec-request-id.test.ts` | 신규. 길이·문자 집합·결정성(100회)·입력별 차이·원문 비노출 16건 |
| `tests/unit/execute.test.ts` | 옛 형식(`unit-offer-id:make-offer`, `unit-accept-id:accept-claim`)을 기대하던 단정 **2건**을 새 규칙(`/^al-[0-9a-f]{33}$/`, 길이 ≤ 36, 문자 집합, 재실행 시 동일)으로 교체 |

### 바꾼 기존 단정 2건 (지시서 요구)
1. `describe('요청 ID') > '같은 계획을 다시 실행하면 같은 requestId가 나간다 (<planId>:<엔드포인트>)'`
   → 제목을 `'같은 계획을 같은 메시지로 다시 실행하면 같은 requestId가 나간다'`로 바꾸고, `toBe('unit-offer-id:make-offer')`를 `toMatch(/^al-[0-9a-f]{33}$/)`로 교체. 두 번 실행이 같은 값인지 보는 단정은 그대로 남겼다.
2. `describe('요청 ID') > '수마다 엔드포인트 이름이 붙는다'`
   → 요청 번호에는 엔드포인트 이름이 더 이상 드러나지 않으므로 제목을 `'수마다 엔드포인트가 경로에 붙고 요청 번호는 36자 이하다'`로 바꾸고, `toBe('unit-accept-id:accept-claim')`를 길이 ≤ 36 + 문자 집합 단정으로 교체. 경로(`/v1/customer/disputes/{id}/accept-claim`) 단정은 그대로다.

`tests/unit/client.test.ts`와 `tests/acceptance/ac14.client.test.ts`에도 `'unit-plan:send-message'` 같은 문자열이 있지만, 이들은 클라이언트가 헤더를 그대로 넣는지 보는 임의 고정값이고 `request.ts`의 형식을 기대하는 곳이 아니라 수정하지 않았다 (그리고 수정 가능 폴더 밖이다). 전부 통과한다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 121 | **1** | 지시서가 예고한 그 1건만 (아래) · 9건 skip(기존) |
| `npm test` | 1067 | 0 | 20개 파일. `exec-request-id.test.ts` 16건 신규, `execute.test.ts` 130건 |
| `npx tsc --noEmit` | 출력 없음 | 0 | |
| `npm run lint` | 출력 없음 | 0 | `eslint` |
| `npx vitest run tests/unit/exec-request-id.test.ts tests/unit/execute.test.ts` | 146 | 0 | |

### 인수 테스트 실패 1건 (예고된 것)
`tests/acceptance/ac05-06-08.policy.test.ts > AC8 수 → API > 합의 단계에 증빙 링크와 메시지 링크가 함께 있으면: fight는 send_message (실제 D2의 링크 구성)`
→ `expected 'provide_evidence' to be 'send_message'`.
지시서 완료 기준에 적힌 대로 **T040(엔진)이 main에 병합되기 전이라 실패하는 1건**이고, 원인은 `src/engine/recommend`(이 작업의 수정 범위 밖)이다. 내 변경은 `src/exec/`와 `tests/unit/`만 건드렸으므로 이 실패와 무관하다. 실패는 이 1건뿐이다.

### 완료 기준 대조
| 기준 | 결과 |
|---|---|
| send-message·make-offer·accept-claim 모두 길이 ≤ 36, 문자 집합 `[A-Za-z0-9-]` | 통과 (세 엔드포인트 모두 36자) |
| 같은 입력 100번 → 같은 값, 시각·난수·프로세스 정보 불사용 | 통과 (`'같은 계획·같은 메시지로 100번 만들어도 같은 값이다'`) |
| 메시지만 다름 / 금액만 다름 / 엔드포인트만 다름 → 다른 값 | 통과 (환불 유형·계획 ID 차이도 추가 확인) |
| 2000자·한국어·이모지 메시지, `PP-R-GMS-10197661`과 실제 길이 계획 ID에서도 ≤ 36 | 통과 (줄바꿈·따옴표·JSON 흉내 메시지도 확인) |
| 요청 번호에 메시지 조각·분쟁 ID·금액 없음 | 통과 |
| 기존 단위 테스트 통과 | 통과 (옛 형식 단정 2건 교체, 위에 적음) |
| `npm run test:acceptance` 실패 0 (예고된 AC8 1건 제외) | 통과 (실패 정확히 그 1건) |
| `npm test`, `npx tsc --noEmit`, `npm run lint` | 통과 |
| 실제 PayPal 호출 0회 (`.env` 찾지 않음) | 통과 — `buildRequest`는 순수 함수다. MCP·네트워크·`.env` 접근 없음 |

## 남은 문제
- **16진수에 숫자가 섞이는 건 금액 노출이 아니다**: 해시는 16진수이므로 `720` 같은 짧은 숫자 조각이 우연히 들어갈 수 있다 (실제 예시 `al-0e316720...`에 `720`이 들어 있다). 금액 표기(`7.20`, `48.00`)는 점을 포함해 구조적으로 들어갈 수 없고, 짧은 숫자 우연 일치로는 원문을 되돌릴 수 없다. 그래서 테스트는 금액을 **표기 형태**(`7.20`, `48.00`)와 접두 뒤 16진수 구조로 검사하고, 맨 숫자 `720` 부분 문자열은 단정하지 않았다 (우연 일치로 거짓 실패가 날 단정이라 넣지 않는 게 맞다고 판단했다).
- **엔드포인트 단독 차이는 간접 확인**: `requestIdFor`는 내부 함수라 테스트에서 직접 부르지 않고 `buildRequest`로만 확인했다. 세 엔드포인트는 본문 키도 서로 다르므로 "엔드포인트만 다르고 본문은 같다"를 완전히 격리해 보지는 못했다. 엔드포인트 이름은 해시 재료에 들어가 있고(`lengthPrefixed([planId, endpoint, canonicalJson(body)])`), 관측 가능한 기준("엔드포인트가 다르면 다른 값")은 통과한다.
- `scripts/`의 요청 번호(`afterloop-order-O01`, `afterloop-capture-O01`, `afterloop-track-O06`)는 범위 밖이라 그대로다. 36자 미만이라 길이 문제는 없다. 단, `tests/unit/sandbox-setup.test.ts:389`가 길이 `[61, 61, 36]`을 기대하는 건 `scripts/sandbox/check-steps.ts`의 **길이 탐침(probe)** 값이고 분쟁 요청 번호와 무관하다 (그대로 통과).

## 컨트롤 타워에 요청할 결정
- 없음. 계약(`src/types.ts`)·인수 테스트·SPEC 변경 없이 끝났다. `ApiRequest.requestId`의 주석(`// PayPal-Request-Id (같은 계획을 재시도하면 같은 값)`)이 이제는 "같은 계획 + 같은 본문"이 더 정확하지만, `src/types.ts`는 수정 금지 파일이고 동작에 영향이 없어 손대지 않았다. 문구를 맞추고 싶으면 컨트롤 타워가 판단해 주면 된다.
