판정: 통과

# T040 검증 (2026-11-10 10:58)

- 대상: `lane/engine` @ `a3aaac6` (코드 커밋 `f965e25`, 보고서 커밋 `a3aaac6`), 갈라진 지점 `f4b0d4d` (SPEC v2.4)
- 기준: `tasks/T040.md`, `SPEC.md` 5장 "수 → API" 표 (v2.4)
- 검증자는 코드·테스트·문서를 고치지 않았다. 만든 파일은 이 보고서와 스크래치 폴더의 탐침뿐이다. 검증 뒤 `git status --short`는 이 보고서 외에 비어 있다.

## 1. 범위

`git diff main...HEAD --stat`:

| 파일 | 줄 | 수정 가능 폴더 안인가 |
|---|---|---|
| `src/engine/policy.ts` | +7 / -2 | 예 |
| `tests/unit/plan.test.ts` | +14 / -4 | 예 (엔진 테스트) |
| `tests/unit/recommend.test.ts` | +40 | 예 (엔진 테스트) |
| `reports/T040-impl.md` | +68 | 예 (보고서) |

범위 밖 변경 0건. `tests/acceptance/`, `src/types.ts`, `SPEC.md`, `src/exec/`, `sim.test.ts`·`oracle.test.ts`·`autopilot.test.ts` 변경 없음.
main이 갈라진 뒤 바꾼 파일(v2.5)과 이 브랜치가 바꾼 파일의 교집합은 0개다 (병합 충돌 요인 없음).

## 2. 실행 결과

| 명령 | 결과 | 종료 코드 |
|---|---|---|
| `npm run test:acceptance` | 9 파일, 122 통과 / 0 실패 / 9 skip (샌드박스 실호출) | 0 |
| `npm test` | 19 파일, 1057 통과 / 0 실패 | 0 |
| `npx tsc --noEmit` | 출력 없음 | 0 |
| `npm run lint` | 경고·오류 없음 | 0 |

AC8 4건을 이름으로 확인했다 (`--reporter=verbose`): "합의 단계에 증빙 링크와 메시지 링크가 함께 있으면: fight는 send_message (실제 D2의 링크 구성)" 통과.

## 3. 탐침 (스크래치: `…/scratchpad/t040-verify/`)

비교 대상 3개를 같은 스크립트(`dump.ts`)로 돌렸다.
- **new**: 이 브랜치 작업 폴더
- **old**: 이 브랜치 HEAD를 스크래치에 풀고 `policy.ts`만 `git show main:src/engine/policy.ts`로 바꾼 사본 (정책 변경만 분리)
- **main**: main 체크아웃(`afterloop`, v2.5, 읽기만)

### 3-1. SPEC 표 대조 — `fightApiMove` 직접 호출과 `recommend` 경유, 둘 다 같은 값

| 단계 | 둘 다 | `send_message`만 | `provide_evidence`만 | 둘 다 없음 |
|---|---|---|---|---|
| `INQUIRY` | `send_message` | `send_message` | `provide_evidence` | `null` (fight가 `all`에 없음) |
| `CHARGEBACK` | `provide_evidence` | `send_message` | `provide_evidence` | `null` |
| `PRE_ARBITRATION` | `provide_evidence` | `send_message` | `provide_evidence` | `null` |
| `ARBITRATION` | `provide_evidence` | `send_message` | `provide_evidence` | `null` |

SPEC v2.4 5장 표 3행과 지시서의 4단계 순서와 모두 일치. 링크 순서를 뒤집어도(`provide_evidence` 먼저) 같고, `make_offer`·`accept_claim` 유무와도 무관하다 (40칸 전부 확인).

### 3-2. 기대 손실이 바뀌지 않았다

`recommend`를 보드 **73,984개**로 돌렸다: 단계 4 × `allowedMoves` 부분집합 16 × (세부 유형 16 + 원인 없음) × 금액 8개(0·1·333·3500·4800·7200·18900·123457¢) × 추적 유무 2 × 채널 2 × 확신도 2 (고정 fixture 가정값) + 설정 파일 기본값으로 줄인 격자.

| 비교 | `apiMove`를 뺀 결과 (`best`, 모든 수의 `expectedLossCents`·`branches`·`blockedBy`, `autopilot`) | 전체 결과 |
|---|---|---|
| old vs new | **바이트 단위로 같음** (sha256 `80a666aa…` 동일) | 4,352줄 다름 |
| main vs new | **바이트 단위로 같음** (같은 해시) | 4,352줄 다름 |

다른 4,352줄을 한 줄씩 대조: 전부 `INQUIRY` + 두 링크 보드이고, old 쪽의 `"apiMove":"provide_evidence"`를 `"send_message"`로 바꾸면 new와 완전히 같다 (설명되지 않는 차이 0줄, 다른 단계·다른 링크 구성에서의 차이 0줄). `INQUIRY` + 두 링크 보드는 4,624개이고 나머지 272개는 원인 없음(`NO_CAUSE`, `apiMove: null`)이라 원래 같다.

### 3-3. `simulate`가 main과 같다

시드 상품 4개(`seed/products.json`) × 처방 부분집합 16개 = 64회를 `simInputFor` → `simulate`로 돌린 결과 JSON, 그리고 `simulatePass`(미래별 손실 전체)의 해시가 **old·main·new 셋 다 바이트 단위로 같다** (sha256 `846bf394…`, `0c102631…`).
시뮬레이션 보드는 `stage: 'INQUIRY'` + 네 링크 전부라 안에서 fight의 `apiMove`는 바뀌지만, 결과에는 `apiMove`가 나오지 않고 고르는 수도 같다.

### 3-4. 서연 분쟁 꼴 (`seoyeon.ts`)

보드: `INQUIRY`, `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`, 7200¢, 링크 `send_message`·`make_offer`·`provide_evidence`·`accept_claim`, 원인 A2(`source: 'rule'`, 확신도 1), `hasTracking: true`. fixture 가정값과 설정 파일 기본값 둘 다 같은 결과.

| | new (이 브랜치) | old (main의 policy) |
|---|---|---|
| `recommend().best` | fight / `send_message` / 3680¢ | fight / `provide_evidence` / 3680¢ |
| refund | 7400¢ | 7400¢ |
| `planMove(best)` | `apiMove: 'send_message'`, 금액 없음, `messageRequired: true`, `planId` `plan-…-fight-send_message-none-none` | `apiMove: 'provide_evidence'` |
| `executeMove` (가짜 `call`, `Approval{planId, approvedBy, approvedAt}`) | `ok: true`, 호출 **1회**, `POST /v1/customer/disputes/PP-R-PROBE-D2/send-message`, 본문 키 `message` | `ok: false` ("Evidence upload … is not sent from this app"), 호출 0회 |
| 승인 `null` | 거부, 호출 0회 | 거부, 호출 0회 |

SPEC 2장의 서연 "후" 값(3680¢, 환불 7400¢)과도 맞는다.

### 3-5. 새 테스트가 옛 동작을 잡는가

- old(main의 policy) + 이 브랜치의 테스트: AC8 새 검사 1건, `recommend.test.ts` "두 링크가 함께 있으면…" 1건, `plan.test.ts` "합의 단계에 두 링크가 함께 있으면…" 1건이 `expected 'provide_evidence' to be 'send_message'`로 실패한다. 새 테스트는 허수아비가 아니다.
  (스크래치 사본에서만 나는 AC13 오프라인 2건·스크립트 테스트 파일 실패는 사본에 `.env.example`·`scripts/`를 풀지 않아서 생긴 것으로 이 작업과 무관하다.)

## 4. 기존 단위 테스트의 기대값 변경 (`git diff main...HEAD -- tests/unit`)

- **숫자(금액·확률·기대 손실) 기대값 변경: 0건.** 바뀐 `expect`의 값도 0건이다 — 기존 3건은 기대값을 그대로 두고 보드에 `stage: 'CHARGEBACK'`만 넣었다.
- 새 정책 + main의 단위 테스트로 돌려 보면 **1048 통과 / 3 실패 (1051)**, 실패는 정확히 그 3건이다. 숫자 단정 실패는 없다.

| 테스트 (`plan.test.ts`) | 바뀐 것 | 원래 보던 것을 여전히 보는가 |
|---|---|---|
| "증빙 링크가 있으면 fight는 provide_evidence로 계획한다" → "합의 단계가 아니고 …" | 보드 `stage: 'CHARGEBACK'`, 이름 | 예. `planMove`가 `provide_evidence` 계획을 만드는 경로를 그대로 본다. 합의 단계 쪽은 새 테스트가 따로 본다 |
| "이 보드의 실행 API와 다른 평가를 넘기면 예외" | 평가를 만드는 보드만 `CHARGEBACK` | 예. `provide_evidence` 평가를 `send_message` 보드에 넘기면 `/send_message/` 예외가 나는지 그대로 본다 |
| "planId: 실행 API가 다르면 다른 값" | 비교 대상 보드만 `CHARGEBACK` | 예. `planId`에는 단계가 들어가지 않으므로(`plan-<id>-<move>-<apiMove>-<금액>-<환불종류>`) 두 값의 차이는 여전히 `apiMove`에서만 나온다 |

새로 추가된 테스트 6건은 지시서 완료 기준(4경우 × 4단계, `planMove`의 합의 단계 `send_message` 계획)을 덮는다.

## 5. 지시서 완료 기준 대조

| 기준 | 결과 |
|---|---|
| `npm run test:acceptance` 실패 0, AC8 새 검사 통과 | 충족 (122 / 0) |
| 단위 테스트 4경우 × 4단계, `planMove` 합의 단계 + 두 링크 → `send_message` | 충족 (`recommend.test.ts` 5건, `plan.test.ts` 1건) |
| `simulate` 기존 단위 테스트가 기대값 변경 없이 통과, 숫자 불변 | 충족 (`sim.test.ts` 변경 없음 38건 통과 + 3-3 직접 비교) |
| 기대값 변경 보고 (`apiMove` 외 변경 없음) | 충족 (4장) |
| `npm test`, `tsc`, `lint` | 충족 |
| 어떤 수의 `expectedLossCents`도 바뀌지 않음 | 충족 (3-2) |

## 6. 구현 보고서와 다른 점

사실과 다른 주장은 찾지 못했다 (122/9 skip, 1057, "변경 전 1048 통과 / 3 실패", `sim.test.ts`에 `apiMove` 단정 0건, `stage`를 읽는 곳 목록 모두 직접 확인). 부정확한 표현 두 가지만 적는다.

- "변경 전 깨진 3건도 전부 `apiMove` 문자열 단정" — 2건은 `apiMove` 단정이고 1건은 `planId`가 서로 다른지 보는 단정이다 (원인은 `apiMove`이고 숫자 단정이 아닌 것은 맞다).
- "마지막 커밋 `f965e25`" — 코드 커밋이고, 브랜치 끝은 보고서 커밋 `a3aaac6`이다.

## 발견한 문제

### 병합 차단
- 없음.

### 병합 후 수정
- 없음.

### 기록만
- 서연 탐침에서 나간 `PayPal-Request-Id`는 `plan-PP-R-PROBE-D2-fight-send_message-none-none:send-message` (60자)다. SPEC v2.4 9-1장(Q11)의 "36자 이하 해시"는 아직 `src/exec/request.ts`에 들어가 있지 않다. T040 범위 밖(실행 레인)이고 이 브랜치가 만든 문제도 아니다.
- 합의 단계 + 두 링크에서 `planId`가 `…-provide_evidence-…`에서 `…-send_message-…`로 바뀐다 (의도된 결과). 이전 `planId`로 저장해 둔 승인이 있다면 맞지 않게 된다. 저장소 안에서 그런 저장값은 찾지 못했다.
- 합의 단계에 `provide_evidence`만 있는 보드는 여전히 `provide_evidence`로 계획되고 `executeMove`가 거부한다. SPEC 표대로이고 AC8에도 그 검사가 있다.

## 확인하지 못한 것
- 실제 샌드박스 호출(AC13의 skip 9건, 서연 D2로의 실제 `send-message`)은 하지 않았다. `executeMove`는 가짜 `call`로만 확인했다.
- main 체크아웃에서 인수 테스트를 직접 돌려 "main에서 AC8 1건 실패"를 재현하지는 않았다 (main 폴더는 읽기만). 대신 main의 `policy.ts`를 넣은 스크래치 사본에서 그 1건이 실패하는 것을 확인했다.
- v2.5 main과 병합한 뒤의 전체 테스트는 돌리지 않았다 (git 상태를 바꾸지 않는 조건). 바뀐 파일이 겹치지 않고, main 체크아웃의 엔진으로 돌린 `recommend`·`simulate` 결과가 `apiMove` 외에 이 브랜치와 같다는 것까지만 확인했다.
- 화면(`src/app/`)이 `apiMove: 'send_message'` 계획을 어떻게 보여 주는지는 보지 않았다.
