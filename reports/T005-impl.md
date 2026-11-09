# T005 보고 (2026-11-09 22:04 KST)

- 기준 SPEC: v2.1   (시작할 때 `SPEC.md` 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)`과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/engine / `5155765` (worktree `afterloop-wt/engine`, `pwd` 확인)

## 결과
완료 — `planMove`를 새로 만들고(`src/engine/plan.ts`), 제안 금액 계산을 `oracle.ts`의 `offerAmountCents` 하나로 모아 기대 손실과 계획이 같은 금액을 쓰게 했다. 지시서 "같이 고칠 것" 2건(악용 의심 로그 문구, 동점 사례 2종)도 했다. AC4(5개) 통과, T004 인수 테스트 27개 그대로 통과, 단위 테스트 156개 통과.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/plan.ts` (신규) | `planMove`: 입력 zod 검증(`resolveEngineInput`) + 평가 모양 검증 → 수별 계획(offer `make_offer`·x·A·`REFUND`, refund `accept_claim`·A·`REFUND`, fight 평가의 `apiMove`·금액 없음·`messageRequired: true`) → 결정론 `planId`. 차단된 평가·`apiMove: null`·수와 API 불일치는 예외 |
| `src/engine/oracle.ts` | `offerAmountCents(board, params)` export 추가(`roundCents(offerRate × A)`)하고 `offerLoss`가 그 함수를 쓰게 함. 계산식·결과는 그대로 (기존 `roundCents(params.offerRate * a)`와 같은 식) |
| `src/engine/params.ts` | `moveSchema`·`apiMoveSchema`에 `export`만 추가 (plan.ts의 평가 검증이 같은 스키마를 쓰도록). 검증 동작 변화 없음 |
| `src/engine/autopilot.ts` | `abuseDetail` 문구만 수정 (아래 "같이 고칠 것 1"). `verdict`·`rule`과 다른 4개 규칙 문구는 그대로 |
| `tests/unit/plan.test.ts` (신규) | 25개: 수 3종 계획 필드, 제안 금액 = 트리 수락 분기, 예외 5종, 제안률 한도·zod, planId 결정론·구분 7종, 입력 불변 |
| `tests/unit/autopilot.test.ts` | 사례 5개 추가 (F2 문구, F1인데 미수령 분쟁 아님, 기준 미만, 배송 기록 없음, F 외 대분류 설정). 기존 17개는 그대로 |
| `tests/unit/recommend.test.ts` | 동점 2개 추가 (fight = offer → fight, offer = refund → offer). 기존 23개는 그대로 |

구현 결정 (근거):
- **제안 금액의 단일 출처**: 지시서 3번. `offerLoss`가 쓰던 `roundCents(x·A)` 식을 `offerAmountCents`로 빼고 양쪽에서 호출한다. 단위 테스트에서 `plan.amountCents === accept 분기 lossCents − t`를 x·A가 정수가 아닌 금액(1050¢ → 157.5 → 158¢)으로 확인했다. 지시서 "하지 않을 것"대로 SPEC 5장 반올림 문구(Q9)는 손대지 않고 현재 구현(먼저 센트로 반올림)을 유지했다.
- **planId 형식**: `plan-<disputeId>-<move>-<apiMove>-<금액|none>-<환불종류 소문자|none>` (예: `plan-PP-R-TEST-D1-offer-make_offer-720-refund`, `plan-U-1-fight-send_message-none-none`). 뒤에서부터 네 조각이 수·API·금액·환불 종류로 고정이라 분쟁 ID에 하이픈이 있어도 두 계획이 겹치지 않는다. 난수·시각·전역 카운터를 쓰지 않는다 (`src/engine/plan.ts`에 `Math.random`·`Date`·`performance.now` 없음, 주석 외).
- **평가 검증**: 평가가 화면에서 직접 올 수도 있어 `plan.ts` 안에 작은 zod 스키마를 두고 `params.ts`의 `moveSchema`·`apiMoveSchema`를 재사용한다. 수와 실행 API가 SPEC 5장 표와 어긋나면(예: offer를 `send_message`로) 예외. `allowedMoves` 재확인은 SPEC 9-1장대로 `executeMove`가 하므로 중복하지 않았다.

### 같이 고칠 것 1 — 악용 의심 로그 문구 (T004 검증 2번)
보드에 있는 사실만 적도록 `abuseDetail`을 고쳤다. 판정은 그대로다.

| 경우 | 전 | 후 |
|---|---|---|
| F1 + 미수령(INR) + 이전 2건 + 배송 완료 (D3) | `(3rd "not received" claim with delivery proof)` | 같음 (변화 없음) |
| F2 + 이전 2건 + 배송 완료 | `(3rd "not received" claim with delivery proof)` | `(the cause check flagged a partial-refund pattern)` |
| F1 + 미수령 아님(SNAD) + 이전 2건 + 배송 완료 | `(3rd "not received" claim with delivery proof)` | `(2 earlier "not received" disputes from this buyer with delivery proof)` |
| F1 + 미수령 + 이전 3건 + 배송 기록 없음 | 근거 없음 | `(4th "not received" claim)` |
| F1 + 이전 0건 | 근거 없음 | 같음 (근거 없음) |
| F 외 대분류를 `skipCategories`에 넣은 설정 (예: B1) | `(3rd …)` 가능 | 근거 없음 |

미수령 분쟁 판정은 `board.reason`에 `NOT_RECEIVED`가 들어 있는지로 본다 (`MERCHANDISE_OR_SERVICE_NOT_RECEIVED`). 문구는 여전히 영어 한 문장·ASCII이고 분쟁 ID·구매자 정보를 넣지 않는다 (기존 테스트가 새 사례까지 포함해 확인).

### 같이 고칠 것 2 — 동점 사례
| 사례 | 설정 | fight / offer / refund | 기대 추천 | 결과 |
|---|---|---|---|---|
| fight = offer | B1, p_win = 1 − 720/6300 | 920 / 920 / 5000 | fight | fight |
| offer = refund | B1, A = 3500, f = 7650, p_win = 0 | 11350 / 3700 / 3700 | offer | offer |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac04.plan.test.ts` | 5 | 0 | AC4 4개 + AC10 planMove 1개 |
| `npx vitest run tests/acceptance/ac01-03.recommend.test.ts tests/acceptance/ac05-06-08.policy.test.ts tests/acceptance/ac09-10.general.test.ts` | 27 | 0 | T004 인수 테스트 그대로 통과 |
| `npm run test:acceptance` (전체) | 42 | 2 (건너뜀 9) | 통과 5개 파일(ac01-03, ac04, ac05-06-08, ac09-10, ac11-12). 실패는 모두 T005 범위 밖 (아래) |
| `npm test` | 156 | 0 | `tests/unit/` 6개 파일 (plan 25, oracle 26, autopilot 22, recommend 25, execute 20, seed 38) |
| `npx tsc --noEmit` | — | 2 | TS2307 2건: `@/engine/escalation` (ac07, T018), `@/paypal/client` (ac14). `src/engine/`·`tests/unit/` 오류 0건. T004 때 있던 `@/engine/plan` 오류는 없어졌다 |
| `npx eslint src/engine tests/unit` | — | 0 | 출력 없음 |

전체 인수 테스트에서 통과하지 못한 것 (T005 범위 밖, 내 변경과 무관):
| 파일 | 원인 | 책임 |
|---|---|---|
| `ac07.escalation.test.ts` | `@/engine/escalation` 없음 (파일 로드 실패) | engine, T018 |
| `ac14.client.test.ts` | `@/paypal/client` 없음 — 이 레인 브랜치에는 아직 없다 (main에는 병합됨) | paypal |
| `ac13.sandbox.test.ts` | 테스트 2개 실패: `.env.example` 없음, `.env.example`이 `.gitignore`의 `.env*`에 걸림. 9개는 `RUN_SANDBOX=1`이 아니라 건너뜀 | paypal · 사람 (샌드박스 세팅) |

## 남은 문제
- `planMove`는 `plan.apiMove`가 `board.allowedMoves`에 있는지 다시 확인하지 않는다 (SPEC 9-1장대로 `executeMove`가 확인). `recommend`가 만든 평가를 그대로 넘기면 문제가 없고, 화면이 평가를 직접 만들어 넘기는 경우에만 실행 단계에서 거부된다.
- `REFUND_WITH_RETURN`을 내는 경로는 없다 (SPEC 5장 표에 `REFUND`만 있다). `planId`에는 환불 종류가 들어가므로, 나중에 반품 조건 제안을 쓰게 되면 `planId`도 자동으로 달라진다.
- T004 검증 1번(L_offer 반올림, SPEC 5장 문구)은 지시서 "하지 않을 것"에 따라 손대지 않았다. 아래 결정 1번에 영향 범위만 적는다.

## 컨트롤 타워에 요청할 결정
1. **(알림, 결정은 이미 대기 중) T004 검증 1번(L_offer 반올림, Q9)이 (나) 안으로 정해지면 `planMove`의 제안 금액도 같이 봐야 한다.** 지금은 제안 금액과 기대 손실이 `offerAmountCents` 하나에서 나온다. (나) 안(식을 그대로 풀고 마지막에 사사오입)을 고르면 기대 손실 쪽만 바뀌고 계획 금액은 그대로여도 되지만, 두 값이 x·A가 정수 센트가 아닌 금액에서 최대 1¢ 어긋나게 된다. 지시서가 "같은 함수에서 나와야 한다"(3번)고 했으므로 그때 다시 지시가 필요하다. 영향 파일: `src/engine/oracle.ts`, `tests/unit/oracle.test.ts`, `tests/unit/plan.test.ts`.
2. **`ActionPlan`에 `refundType: 'REFUND_WITH_RETURN'`을 쓸 계획이 있는지.** 계약에는 있지만 SPEC 5장 표에는 `REFUND`만 있어 지금은 쓰지 않는다. 계약 변경이 아니라 확인만 필요하다.

그 밖에 계약(`src/types.ts`)·인수 테스트·SPEC을 바꿔야 한다고 판단한 것: 없음.
