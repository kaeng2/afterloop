# 엔진 v0 보관 보고서 (참고용, 미완성)

- 브랜치: `engine-v0-ref` (main `54b695e`에서 분기)
- 작성: 엔진 세션 95e9c98f, 2026-11-09
- 상태: SPEC v1.1에 맞추지 않은 채 보관. **SPEC v2(계산식 변경, 원인 분류 16개 세부 유형)가 나오면 Lane 1 작업 세션이 이 브랜치를 참고해 다시 맞춘다.**
- 보관한 파일: `src/engine/{types,params,oracle,rules,recommend}.ts`, `tests/unit/{oracle,rules}.test.ts`, 이 보고서

## 1. 구현한 것과 테스트 현황

| 묶음 | 통과 | 실패 | 원인 |
|---|---|---|---|
| 내 단위 테스트 (1번 오라클 37개 + 2번 규칙 26개) | 63 | 0 | — |
| 인수 AC1~3 (오라클) | 9 | 0 | O1과 같은 4032¢ 기준 |
| 인수 AC4~8, AC9~10 | — | 파일 로드 실패 | 아직 없는 `@/engine/plan`(planMove)을 불러옴 |
| 인수 AC11~12 | — | 파일 로드 실패 | 아직 없는 `@/exec/execute`를 불러옴 (6번 범위) |
| 타입 검사 | — | 3건 | 위의 모듈 없음 오류뿐 |

### 1번 오라클 (tests/unit/oracle.test.ts, 37개)
| ID | 결과 | 확인 내용 |
|---|---|---|
| O1 | ✅ 5/5 | fight 7780¢, offer 4032¢(계산식 값 4031.5¢를 반올림, PRD 4178¢는 p_acc 0.7 기준값), refund 5700¢, 추천 offer |
| O2 | ✅ 4/4 | fight 3835¢, offer는 R4로 차단, refund 4800¢, 추천 fight |
| O3 | ✅ 6/6 | p_acc 경계 0.35 / 0.725 / 0.9(상한), 범위 밖이나 NaN이면 에러 |
| O4 | ✅ 3/3 | 동점이면 fight → offer → refund 순서 (입력 순서와 무관) |
| O5 | ✅ 3/3 | 100번 같은 결과, 입력 객체를 바꾸지 않음, `src/engine`에 Math.random·Date 없음 |
| O6 | ✅ 13/13 | 확률이 범위 밖이거나 금액이 음수면 ZodError |
| O7 | ✅ 3/3 | offer 분기는 [accept 0.725 → 1920¢, reject 0.275 → 7780¢], Σ(확률×손실) + 시간 비용 = 기대 손실 |

### 2번 규칙 (tests/unit/rules.test.ts, 26개)
R1a·R1b·경계, R2·경계, R3(합의/클레임 단계, 미적용), R4a·R4b·1회, R5(차단, provide_evidence만), G1~G4, 규칙이 여럿 걸린 판의 결정론. 모두 통과.

## 2. 제 구현과 SPEC이 다른 점

| 항목 | 내 구현 | SPEC |
|---|---|---|
| 계약 위치 | `src/engine/types.ts`, 선택 필드 추가 | `src/types.ts`(잠금). `Evaluation`·`Recommendation`은 원문 그대로 |
| R2·R3 표시 | 평가에 `offerType`, `attachMessage` | `planMove()`가 만드는 `ActionPlan.refundType`, `messageRequired` |
| G2·G3·G4 표시 | `status`, `strictApproval`, `needsSellerReview`, `appliedRules` | 별도 필드 없음. 엄격 승인은 `Approval.confirmAcceptClaim`으로 처리 |
| fight의 실행 API | 단계로 정함 (INQUIRY면 send_message) | 허용 대응으로 정함 (provide_evidence가 있으면 그것, 없으면 send_message) |
| 차단 규칙이 겹칠 때 | R4 → R5 → R3 순 | 번호가 작은 규칙 우선 (R3 → R4 → R5) |
| R2 적용 범위 | offer와 refund 둘 다 | 지금은 refund만 (SPEC 열린 질문 3번) |

## 3. SPEC을 따른다면 할 일
- `src/engine/types.ts`를 지우고 `@/types`에서 가져오기
- 계약에 추가했던 선택 필드를 빼고, R2·R3 결과는 새로 만들 `src/engine/plan.ts`의 `planMove`로 옮기기
- fight의 실행 API 정하는 방식과 차단 규칙 우선순위를 SPEC에 맞추기
- 단위 테스트(`rules.test.ts`) 중 위 필드를 검사하던 부분을 SPEC 형태로 다시 쓰기. 바꾸는 이유는 계약 형태를 맞추는 것이고, 숫자 기대값은 그대로 둔다
- 잠금 파일(`src/types.ts`, `tests/acceptance/`, `SPEC.md`)은 건드리지 않기

## 4. 재사용할 만한 부분

### 계산 함수 (`src/engine/oracle.ts`)
- `roundCents(value)`: 소수 6자리에서 먼저 정리한 뒤 반올림한다. `0.725 × 1920`이 `1391.9999…`가 되는 부동소수 오차를 막고, 4031.5 → 4032를 안정적으로 낸다. v2 계산식이 바뀌어도 그대로 쓸 수 있다.
- 중간 계산은 실수로 하고 내보낼 때만 센트로 반올림하는 구조(`rawLosses` → `evaluateAll`). 계산식만 v2로 바꾸면 된다.
- 분기 표현 규칙: 시간 비용(t)은 분기에 넣지 않고 Σ(prob × lossCents) + t = expectedLossCents가 되게 한다. 트리 화면 숫자 검산에 쓸 수 있다.
- `repurchaseValue(board, params)`: 원인 F이면 V = 0. v2에서 원인이 16개 세부 유형으로 바뀌면 이 함수와 아래 규칙 판정의 원인 조건만 바꾸면 된다.

### 가정값 (`src/engine/params.ts`)
- `ParamsSchema`(zod, `.strict()`): 확률 0~1, 금액은 0 이상의 센트 정수, 모르는 키는 거부. `resolveParams(overrides)`가 기본값에 판매자 설정을 덮어쓰고 검증한다.

### 규칙 판정 로직 (`src/engine/rules.ts`)
- 규칙별 판정 함수 `r1Applies`~`r5Applies`와 경계 상수(`R1_MAX_AMOUNT_CENTS = 5000`, `R1_MAX_OFFER_RATE = 0.2`, `R2_RETURN_REQUIRED_FROM_CENTS = 15000`, `R4_REPEAT_DISPUTE_THRESHOLD = 2`). SPEC과 다른 점은 출력 형태와 우선순위이고, 조건 판정 자체는 같다.
- 두 단계 적용 구조: 계산 전에 가정값을 조정(`adjustParams`, R1)하고, 계산 후 평가를 차단·제외(`applyRules`)한다. 차단된 수는 목록에 남기되 `expectedLossCents: null`, `branches: []`, `blockedBy`로 표시한다(SPEC과 같은 방식).

### 추천 (`src/engine/recommend.ts`)
- `pickBest(evals)`: 차단·null 제외 → 기대 손실 → 고정 순서(`MOVE_ORDER`)로 정렬. 입력 순서와 무관하게 결과가 같다. SPEC에서도 그대로 쓸 수 있다.

### 테스트 케이스
- `tests/unit/oracle.test.ts`
  - O4 실제 계산 동점 판: `pWinBase 0, feeCents 0, tFightCents 0, cFight = cRefund = 0.15, tOfferCents 100000` → fight = refund = 5700
  - O5 소스 검사: `src/engine/*.ts`에 `Math.random`, `Date`, `performance.now`가 없는지 정규식으로 확인
  - O5 입력 불변 검사, O6 잘못된 가정값 표(`it.each`), O7 분기 검산
- `tests/unit/rules.test.ts`
  - 경계 케이스: $50.00 / $50.01 (R1), $150.00 / $149.99 (R2), 90일 내 분쟁 1회 / 2회 (R4)
  - "모든 수가 규칙에 막혀 best = null" 판: 원인 A, 배송 완료, `allowedMoves: ['make_offer','accept_claim']`
  - R5에서 `provide_evidence`가 허용되지 않으면 fight를 send_message로 대신하지 않는지
  - 여러 규칙이 걸린 판(외부 분쟁 + $189 + 반복 구매자 + 원인 E)의 결정론

## 5. 0번 사전 확인에서 얻은 사실 (엔진 작업 때 참고)
- 실제 분쟁 응답의 허용 대응은 `links[].rel`(self, make_offer, send_message, accept_claim, escalate)과 `allowed_response_options`(accept_claim_types, make_offer.offer_types)에 들어 있다. fixture는 main의 `tests/fixtures/`에 있다.
- 합의 단계(INQUIRY)에는 `provide_evidence` 링크가 없다.
- 새 분쟁은 처음 약 3분 동안 `UNDER_REVIEW` 상태이고 `self` 링크만 있다. 이때 `allowedMoves`가 비어 "직접 처리" 상태가 된다.
- Orders v2 `/track`으로는 추적 상태를 SHIPPED로만 넣을 수 있다. "배송 완료 추적 있음"은 샌드박스 값으로 만들기 어렵다.
