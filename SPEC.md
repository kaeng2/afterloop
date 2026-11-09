# SPEC v1 (2026-11-09 17:00 KST)

> **계약 변경 규칙.** 이 문서, `src/types.ts`, `tests/acceptance/`는 계약이다. 바꿔야 하면 컨트롤 타워가 변경 내용·이유·영향받는 작업을 `DECISIONS.md`에 먼저 적고, 사람이 승인한 뒤에만 바꾼다. 바꿀 때마다 위 버전을 올린다 (v1 → v2). 작업 세션은 이 세 곳과 `DECISIONS.md`, `TASKS.md`, `tasks/`를 고치지 않는다 (`.claude/settings.json`에서 편집이 막혀 있다).

## 1. 제품 한 줄
판매자에게 들어온 PayPal 분쟁 1건을 바둑판처럼 놓고, PayPal이 허용한 대응(수)마다 기대 손실을 계산해 가장 손실이 적은 수를 추천한다. 판매자가 승인하면 그 수를 PayPal API로 실행한다.

## 2. 처리 순서
| # | 단계 | 레인 | 결정론 |
|---|---|---|---|
| 1 | 분쟁 조회 (`GET /v1/customer/disputes/{id}`) | paypal | — |
| 2 | 응답 → `BoardState` (`allowedMoves`는 `links[].rel`, 환불 세부 유형은 `allowed_response_options`) | paypal | ✅ |
| 3 | LLM 원인 분류 → `cause` (zod 검증) | ai | ✗ (LLM) |
| 4 | 규칙 검사 R1~R5, 허용되지 않은 수 제외 | engine | ✅ |
| 5 | 기대 손실 계산 | engine | ✅ |
| 6 | 추천 (`Recommendation`) + 실행 계획 (`ActionPlan`) | engine | ✅ |
| 7 | 판매자 승인 (`Approval`) | ui | 사람 |
| 8 | API 실행 (메시지 자리표시자 채우기 포함) | paypal (`src/exec/`) | ✅ |

## 3. 계산식 (PRD 6-2)
기호: A 분쟁 금액, p_win 싸웠을 때 이길 확률, f 패소 수수료, t 대응 시간 비용, V 재구매 가치, c 선택 후 이탈 확률, x 제안 비율

- L_fight = (1 − p_win)(A + f) + t_fight + c_fight·V
- L_offer(x) = p_acc(x)·(x·A + c_acc·V) + (1 − p_acc(x))·L_fight + t_offer
- L_refund = A + c_refund·V
- p_acc(x) = min(pAcceptCap, pAcceptBase + pAcceptSlope·x) (기본 min(0.9, 0.35 + 2.5x))
- 원인 F이면 V = 0
- p_win = `params.pWinBase`. 배송 추적 여부로 엔진이 p_win을 자동 조정하지 않는다.
- **반올림:** 계산식을 그대로 푼 뒤 마지막에 센트 정수로 사사오입(0.5는 올림). 중간값은 반올림하지 않는다. AC1 offer = 4031.5¢ → **4032¢** (PRD 화면값 4178¢는 p_acc 0.7 반올림값이라 쓰지 않음).
- **동점:** 기대 손실이 같으면 fight → offer → refund 순서.

가정값은 모두 `config/params.json`에 있다 (9장). 확률은 0~1, 금액은 0 이상 센트 정수. 벗어나면 zod 에러.

### 수 → API 대응
| 수 | apiMove | 조건 |
|---|---|---|
| fight | `provide_evidence` | 허용될 때 |
| fight | `send_message` | `provide_evidence`가 없고 `send_message`가 허용될 때 (INQUIRY에는 증빙 링크가 없음). R5에서는 쓰지 않음 |
| offer | `make_offer` | 허용될 때 |
| refund | `accept_claim` | 허용될 때 |

대응할 API가 `allowedMoves`에 없는 수는 `all`에서 뺀다. 남는 수가 없으면 `best = null` ("직접 처리").

## 4. 정책 규칙 (PRD S7, 값은 `config/rules.json`)
| ID | 조건 | 결과 |
|---|---|---|
| R1 | A ≤ $50 이고 원인 B | 제안 비율 x를 최대 0.20으로 제한 |
| R2 | A ≥ $150 | 환불 계열은 반품 조건 (`refundType = 'REFUND_WITH_RETURN'`) |
| R3 | 원인 A이고 `hasDeliveredTracking` | 추천을 fight(증빙)로 고정, `messageRequired = true` |
| R4 | 원인 F 또는 `buyerDisputeCount90d ≥ 2` | offer 차단 (`blockedBy: 'R4'`) |
| R5 | `channel = 'EXTERNAL'` | offer 차단 (`blockedBy: 'R5'`), fight는 `provide_evidence`로만 |

- 차단된 수: `expectedLossCents = null`, `blockedBy = 규칙 ID`, `branches = []`. 여러 규칙이 걸리면 번호가 작은 규칙 ID.
- `allowedMoves`에 없는 수는 평가 제외. 원인 E·F와 `accept_claim`은 항상 사람 승인 (`requiresApproval`은 언제나 `true`, 자동 실행 없음).
- `cause.needsReview = true`면 추천은 계산하되 "판매자 확인 필요" 표시. `cause`가 없으면 원인 조건이 있는 규칙(R1·R3·R4의 원인 부분)은 적용하지 않는다.

## 5. 실행 계약 (`types.ts` 2부)
- `planMove(board, evaluation, params?, rules?)` → `ActionPlan`. 금액은 엔진이 정한다: offer = round(x·A), refund = A. `planId`는 입력만으로 정해진다.
- `executeMove({ board, plan, messageTemplate, approval }, { call })`
  - `approval`이 없거나 `approval.planId ≠ plan.planId`이면 **네트워크 호출 전에** 거부.
  - `plan.apiMove`가 `board.allowedMoves`에 없으면 호출 전에 거부.
  - `accept_claim`은 `approval.confirmAcceptClaim === true`일 때만.
  - 메시지 자리표시자를 `plan` 값으로 채워 보낸다. 메시지 금액과 API 본문 금액은 같은 `plan.amountCents`에서 나온다.

## 6. LLM이 하는 일 / 하지 않는 일
| 한다 | 하지 않는다 |
|---|---|
| 구매자 메시지와 분쟁 사유로 원인(`RootCause`) 분류, confidence, signals | 기대 손실, 확률, 금액, 제안 비율 계산 |
| 판매자가 보낼 메시지 초안 작성 (자리표시자 사용), 번역 | 어떤 수를 둘지 결정, R1~R5 판단 |
| | API 호출, 승인 판단 |
| | 메시지에 숫자 금액 직접 쓰기 |

- 분류 출력은 zod로 검증. 위반이면 1회만 재요청, 또 실패하면 `needsReview = true`. confidence < `rules.classification.minConfidence`(0.7)이면 `needsReview = true`.
- LLM 출력에 금액·확률 같은 필드가 섞여 있어도 스키마에서 버린다.

## 7. 메시지 초안 규칙
- 금액은 자리표시자로만: `{{offerAmount}}`, `{{refundAmount}}`, `{{disputeAmount}}`.
- 숫자는 실행 단계에서 코드가 `ActionPlan`·`BoardState` 값으로 채운다. 표기는 `$7.20`.
- 초안에 `$` 뒤 숫자, 숫자 뒤 `USD`/`달러`처럼 금액을 직접 쓴 부분이 있거나, 모르는 자리표시자가 있으면 실행을 거부한다. 번역본에도 같은 검사를 한다 (번역 토큰 검사).

## 8. 레인과 폴더 소유권
| 레인 | 폴더 (수정 가능) |
|---|---|
| engine | `src/engine/`, `config/params.json`, `config/rules.json` |
| paypal | `src/paypal/`, `src/exec/`, `scripts/sandbox/`, `tests/sandbox/`, `tests/fixtures/` |
| ai | `src/ai/` (분류, 번역, 토큰 검사), `scripts/eval-classifier.ts` |
| ui | `src/app/`, `config/copy.*.json` |
| data | `seed/` |

- 각 레인은 자기 모듈의 단위·통합 테스트를 `tests/unit/`, `tests/integration/`에 둔다. 파일 이름은 모듈 이름을 따른다 (예: `tests/unit/oracle.test.ts`는 engine). 정확한 범위는 작업 지시서의 "수정 가능 폴더"가 정한다.
- 숫자 계산은 engine 레인(`src/engine/`)에서만 한다. 다른 레인은 엔진 결과를 옮기기만 한다.
- **컨트롤 타워만 수정:** `SPEC.md`, `DECISIONS.md`, `TASKS.md`, `tasks/`, `src/types.ts`, `tests/acceptance/`, `CLAUDE.md`, `README.md`, `docs/`, `.claude/`.
- **사람만 넣음:** `inbox/` (기획 변경). **작업 세션은 `reports/`에만 보고를 쓴다.**

## 9. 설정 파일
| 파일 | 내용 | 소유 |
|---|---|---|
| `config/params.json` | 모든 가정값. 값마다 `source` ("가정", "공개 통계: 출처", "PayPal 데이터") | engine |
| `config/rules.json` | 정책 규칙 R1~R5 기준값, 승인 조건, 분류 신뢰도 기준, 제외 사유 | engine |
| `config/copy.en.json`, `config/copy.ko.json` | 화면 문구 | ui |

- `src/engine/`은 이 파일들을 읽기만 하고 값을 코드에 직접 쓰지 않는다.
- 인수 테스트는 라이브 설정을 읽지 않는다. `tests/acceptance/params.fixture.json`, `tests/acceptance/rules.fixture.json`(고정 사본)을 `recommend`·`planMove`에 직접 넘긴다. 라이브 설정을 바꿔도 인수 테스트는 그대로이고, 고정 사본을 바꾸는 것은 계약 변경이다.

## 10. 열린 질문 (사람 결정 필요)
1. R5에서 refund(accept_claim)도 막을지. 지금은 offer만 막는다.
2. R2에서 offer(make_offer)의 `offer_type`도 반품 조건으로 할지. 지금은 refund만 검사한다.
3. `rules.excludedReasons`에 넣을 분쟁 사유.

변경 이력은 `DECISIONS.md`에 있다.
