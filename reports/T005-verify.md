# T005 검증 (2026-11-09 22:11 KST)
- 판정: **통과**   (인수 테스트 AC4·AC10 5/5, T004 인수 테스트 27/27 그대로, T004 계산 결과 변경 0건, 범위 밖 수정 없음, 지시서 동작 1~6과 "같이 고칠 것" 2건 충족)
- 검증 대상: lane/engine `2ab4a4f` (구현 `5155765` + 보고 `2ab4a4f`, 기준점 `6c7884b`) · 기준 SPEC v2.1 (`SPEC.md` 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)` 확인)
- 검증 방법: 코드·설정·테스트는 읽고 실행만 했다. 독립 스크립트 3개는 worktree 밖 scratchpad `verify-T005/`에 두었다 (`compare.ts`: 변경 전후 비교 + SPEC 식 직접 계산, `plan.ts`: planMove 시나리오, `misc.ts`: 로그 문구·동점·실행 연결). 변경 전 엔진은 `git show 6c7884b:src/engine/*.ts`를 scratchpad에 꺼내 같은 입력으로 돌렸다. 구현자 보고(`reports/T005-impl.md`)는 내 판단을 끝낸 뒤 마지막에 읽고 대조했다.

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-only 6c7884b..HEAD` | — | — | 8개 파일: `src/engine/{plan,oracle,params,autopilot}.ts`, `tests/unit/{plan,autopilot,recommend}.test.ts`, `reports/T005-impl.md`. 모두 지시서 "수정 가능 폴더" 안 |
| `git diff --name-only 6c7884b..HEAD -- src/types.ts tests/acceptance SPEC.md config package.json src/exec src/paypal src/ai src/app seed scripts` | — | — | 출력 없음 (계약 파일·다른 레인 변경 0건) |
| `git diff --numstat 6c7884b..HEAD` | — | — | `tests/unit/autopilot.test.ts` +66/−0, `recommend.test.ts` +22/−0 (사례 추가만). `oracle.ts` +9/−1, `params.ts` +3/−2, `autopilot.ts` +21/−4 (`abuseDetail` 주변만) |
| `npx vitest run tests/acceptance/ac04.plan.test.ts` | 5 | 0 | AC4 4개 + AC10 planMove 1개 |
| `npx vitest run tests/acceptance/ac01-03.recommend.test.ts tests/acceptance/ac05-06-08.policy.test.ts tests/acceptance/ac09-10.general.test.ts` | 27 | 0 | 11 + 9 + 7 |
| `npm test` | 156 | 0 | `tests/unit/` 6개 파일 (oracle 26, autopilot 22, execute 20, recommend 25, plan 25, seed 38) |
| `npx tsc --noEmit` | — | 2 | TS2307 2건: `@/engine/escalation`(ac07, T018), `@/paypal/client`(ac14, 이 브랜치에 없음). `src/engine/`·`tests/unit/` 오류 0건 |
| `npm run test:acceptance` (전체) | 42 | 2 (건너뜀 9) | 파일 8개 중 5개 통과, 3개 실패. 실패는 모두 T005 범위 밖 (아래 분류) |
| `npx eslint src/engine tests/unit` | — | 0 | 출력 없음 (지시 밖 추가 확인) |
| `npx tsx .../verify-T005/compare.ts` | 51,000 + 280 + 30,000 | 0 | 변경 전후 `recommend` 비교, SPEC 식 직접 계산, 전수 (아래) |
| `npx tsx .../verify-T005/plan.ts` | 70 | 0 | planMove 독립 시나리오 (아래) |
| `npx tsx .../verify-T005/misc.ts` | 288 (문구 격자) | 0 | 로그 문구, 동점 2종, planMove → executeMove 연결 |
| `git status -s` (끝) | — | — | `?? reports/T005-verify.md` 한 줄 |

전체 인수 테스트에서 통과하지 못한 것의 분류:
| 파일 | 원인 | 책임 |
|---|---|---|
| `ac07.escalation.test.ts` | `@/engine/escalation` 없음 (파일 로드 실패) | engine, T018 |
| `ac14.client.test.ts` | `@/paypal/client` 없음 (이 레인 브랜치에는 없음) | paypal |
| `ac13.sandbox.test.ts` | 테스트 2개 실패: `.env.example` 없음, `.env.example`이 git 무시 대상. 9개는 `RUN_SANDBOX=1`이 아니라 건너뜀 | paypal · 사람 (샌드박스 세팅) |

T004 검증 때 실패하던 `ac04.plan.test.ts`(모듈 없음)는 이제 통과한다. 위 3개는 이번 변경과 무관하다.

## 독립 시나리오
### `oracle.ts`·`params.ts` 변경이 계산 결과를 바꾸지 않았는지
diff 내용: `oracle.ts`는 `offerAmountCents(board, params) = roundCents(params.offerRate * board.amountCents)`를 새로 내보내고, `offerLoss`의 `roundCents(params.offerRate * a)`를 그 호출로 바꿨다 (같은 식). `params.ts`는 `apiMoveSchema`·`moveSchema`에 `export`를 붙이고 주석 한 줄을 넣었다.

| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 변경 전(`6c7884b`) vs 변경 후 `recommend()`의 `best`·`all`·`requiresApproval` JSON. 금액 15종(4800·7200·18900·3500·1050·3333·4999·1·7·2·9·50·90·0·123457) × 유형 16개 + 원인 없음 × 추적 유무 × `allowedMoves` 5종 × 분쟁 사유 2종 × 이전 미수령 0·2 × 가정값 5종 (x 0.15·0.20·0.10·0, f·t·p_acc 변경) = 51,000건 | 차이 0 | 차이 0 | 일치 |
| 같은 51,000건의 `autopilot.verdict`·`rule` | 차이 0 | 차이 0 | 일치 |
| 같은 51,000건의 `autopilot.reason` | F 유형에서만 달라짐 ("같이 고칠 것" 1번) | 4,125건 다름, 모두 F1·F2 (11가지 조합, 아래 문구 표) | 일치 |
| 변경 전후 오류 동작 (x = 0.2000001, 0.21, 0.25, −0.1, 1.5, NaN) | 같은 종류의 예외 | 6건 모두 ZodError로 같음 | 일치 |
| SPEC 5장 식을 정수(BigInt)로 직접 푼 값 vs HEAD. 금액 7종(4800·7200·18900·3500·1050·3333·4999) × A1·A2·B1·B2·F1 × 추적 유무 = 70건, fight·offer·refund·추천 280항목 | 불일치 0 | 불일치 0 | 일치 |
| 전수 B1, A = 1..30000: 변경 전후 JSON 전체, offer 기대 손실 = 내 계산, accept 분기 − t = 내 제안 금액 | 불일치 0 | 불일치 0 | 일치 |

대표값 (내 계산 = 엔진): 4800·B1 4610 / 1953 / 5000 → offer, 7200·B1 6290 / 2683 / 7400 → offer, 18900·B2 14480 / 6240 / 19100 → offer, 3500·B1 3700 / 1558 / 3700 → offer, 3500·F1·추적 있음 1200 / 차단 / 3700 → fight, 1050·B1 1985 / 814 / 1250, 3333·B1 3583 / 1507 / 3533, 4999·B1 4749 / 2014 / 5199. (offer는 지시서 "하지 않을 것"대로 제안 금액을 먼저 센트로 사사오입하는 현 구현 기준으로 풀었다. Q9는 그대로다.)

### planMove
| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| offer 계획 (D1과 같은 보드, 분쟁 ID `PP-R-VER-1`) | `make_offer`, 720, `REFUND`, `messageRequired: false`, `disputeId` 보드와 같음, `USD`, `requiresApproval: true` | 같음. planId `plan-PP-R-VER-1-offer-make_offer-720-refund` | 일치 |
| refund 계획 | `accept_claim`, 4800 (A, 기대 손실 5000이 아님), `REFUND`, `false` | 같음. planId `plan-PP-R-VER-1-refund-accept_claim-4800-refund` | 일치 |
| fight 계획 (합의 단계) | `send_message`, 금액 `null`, `refundType` `null`, `messageRequired: true` | 같음. planId `plan-PP-R-VER-1-fight-send_message-none-none` | 일치 |
| fight 계획 (`provide_evidence` 허용) | `provide_evidence`, `null`, `null`, `true` | 같음 | 일치 |
| 계획의 키 | `ActionPlan` 9개 필드만 | 9개 (`planId`·`disputeId`·`move`·`apiMove`·`amountCents`·`currency`·`refundType`·`messageRequired`·`requiresApproval`) | 일치 |
| `params`·`rules` 생략 | config를 넘긴 결과와 같음 | JSON 동일 | 일치 |
| 제안 금액 = accept 분기 손실 − t = `round(0.15·A)` (내 정수 계산). A = 4800·7200·3500·1050·3333·4999·1·7 | 720·1080·525·158·500·750·0·1 | 같음 (두 값 모두) | 일치 |
| 같은 검사 전수 A = 0..30000 (x 0.15), x 6종(0.20·0.10·0.05·0.123·0.175·0.01) × A = 0..5000 | 불일치 0, 금액은 항상 정수 | 불일치 0 | 일치 |
| x = 0.15 / x = 0.20 (한도와 같음) | 720 / 960 | 720 / 960 | 일치 |
| x = 0.2000001, 0.25 | 예외 (설정 오류) | ZodError | 일치 |
| x = −0.1, 1.5, NaN, Infinity | 예외 | ZodError (확률 0~1 검증) | 일치 |
| x = 0.25일 때 refund 계획 | 예외 (설정 오류는 수와 무관) | ZodError | 일치 |
| `maxRate`를 0.10으로 낮춤 / 0.15로 맞춤 | 예외 / 720 | ZodError / 720 | 일치 |
| x = 0 | (지시서에 없음) | 예외 없음, `make_offer` 0¢ 계획 | — (발견 2) |
| `blockedBy: 'OFFER_SCOPE'` 평가 (A1 보드의 offer) | 예외 | Error (문구에 `OFFER_SCOPE`) | 일치 |
| `blockedBy`만 있고 `apiMove`는 정상, `blockedBy: ''` | 예외 | Error | 일치 |
| `apiMove: null` | 예외 | Error | 일치 |
| 수와 API 불일치: refund + `make_offer`, refund + `send_message`, offer + `accept_claim`, fight + `make_offer`, fight + `accept_claim` | 예외 | 5건 모두 Error | 일치 |
| 모르는 `move`·`apiMove`, 평가 `null`, `branches` 누락 | 예외 | ZodError | 일치 |
| 보드 금액 48.5·−1, 통화 EUR | 예외 | ZodError | 일치 |
| 원인 없는 보드에서 `recommend`가 만든 평가 (`NO_CAUSE`) | 예외 | Error | 일치 |
| 평가는 `make_offer`인데 `board.allowedMoves`에 없음 / `allowedMoves: []`에 refund 평가 | (지시서에 없음. SPEC 9-1은 실행 단계에서 거부) | 예외 없음, 계획이 만들어짐 | — (발견 1) |
| 원인 없는 보드·A1 보드에 다른 보드의 정상 offer 평가를 넘김 | (지시서에 없음. SPEC 5장은 제안을 B1·B2로 한정) | 예외 없음, `make_offer` 720 계획 | — (발견 1) |
| 낡은 평가 (평가는 x 0.15·A 4800, 호출은 x 0.20 또는 A 7200) | 금액은 지금 보드·가정값 기준 | 960 / 1080 (평가가 아니라 보드·가정값에서 계산) | 일치 |
| 같은 입력 100회 | 계획 JSON 전체 동일 | 동일 | 일치 |
| 내용이 같은 새 객체(참조 다름)로 호출 | 같은 planId | 같음 | 일치 |
| `disputeId`만 / `amountCents`만 (x 0.20, A 7200) / `move`+`apiMove` / `apiMove`만 (fight의 `send_message` vs `provide_evidence`) 다름 | 다른 planId | 5건 모두 다름 | 일치 |
| 같은 분쟁·같은 금액 4800, 수만 다름 (A 32000의 offer vs A 4800의 refund) | 다른 planId | `…-offer-make_offer-4800-refund` vs `…-refund-accept_claim-4800-refund` | 일치 |
| `refundType`만 다름 | 다른 planId | 직접 만들 수 없음 (`REFUND_WITH_RETURN`을 내는 경로 없음). 형식상 마지막 조각이 환불 종류라 달라진다 (`plan.ts:84-85`) | 일치 (코드 근거) |
| 충돌 탐색: 하이픈·숫자·수 이름·API 이름·`none`·빈 문자열을 섞은 `disputeId` 4,372종 × 금액 6종 × 허용 2종 × 수 = 계획 157,392건 (서로 다른 입력 56,836종) | 서로 다른 (`disputeId`, `move`, `apiMove`, `amountCents`, `refundType`)이 같은 planId가 되는 경우 0 | 0 | 일치 |
| `PP-R-1` + offer vs `PP-R-1-offer` + offer·fight·refund | 4개 모두 다름 | `plan-PP-R-1-offer-make_offer-720-refund` / `plan-PP-R-1-offer-offer-make_offer-720-refund` / … 4개 다름 | 일치 |
| planId에 들어가는 값 | 분쟁 ID·수·API·금액·환불 종류뿐 | 보드의 사유·기한·원인 근거(`evidence`)·`causeNote`·추적·이전 분쟁 수를 바꿔도 planId 동일. 계획 JSON에 근거 문자열 없음 | 일치 |
| 실행 중 `Math.random`·`Date.now`·`new Date`·`performance.now` 호출 수 (전역 가로채기) | 0 | 0 | 일치 |
| 다른 계획 호출을 사이에 끼움 (전역 카운터 여부) | 같은 planId | 같음. `plan.ts`에 모듈 수준 변수는 `const` 2개(문구, 스키마)뿐 | 일치 |
| 호출 뒤 `board`·`evaluation`·`params`·`rules` JSON (수 3종) | 그대로 | 그대로 | 일치 |
| 깊게 얼린(`Object.freeze`) 입력 4개로 호출 | 예외 없음 | 예외 없음 | 일치 |
| 결과 계획을 바꾼 뒤 다시 호출 | 보드·다음 결과 그대로 | 그대로 | 일치 |

`grep -nE 'Math\.random|Date|performance|let |var ' src/engine/plan.ts` → 주석 2줄(8~9행)뿐.

### 실행 레인과의 연결 (`tests/acceptance/ac11-12.exec.test.ts`의 계획 모양)
| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| `planMove` offer 계획 vs AC11 `OFFER_PLAN` | `planId`만 다르고 나머지 8개 필드 같음 | 같음 | 일치 |
| `planMove` refund 계획 vs AC11 `REFUND_PLAN` | 같음 | 같음 | 일치 |
| `planMove` fight 계획 vs AC11 send_message 계획 | 같음 | 같음 | 일치 |
| offer 계획 → `executeMove` (mock) | make-offer 1회, `offer_amount` `"7.20"` USD, `offer_type` `REFUND`, note에 `$7.20` | 같음. `requestId` `plan-PP-R-TEST-D1-offer-make_offer-720-refund:make-offer` | 일치 |
| refund 계획 → `executeMove` (`confirmAcceptClaim: true`) | accept-claim 1회, `refund_amount` `"48.00"`, `accept_claim_type` `REFUND` | 같음 | 일치 |
| fight 계획 → `executeMove` | send-message 1회, 메시지에 `$48.00` | 같음 | 일치 |
| `provide_evidence` 계획 → `executeMove` | 거부, 호출 0회 (SPEC 9-1 P1) | 거부, 0회 | 일치 |
| 같은 분쟁에 내용이 다른 두 번째 메시지 (같은 fight 계획) | (계약에 없음) | 같은 planId라 실행 레인이 이전 결과를 돌려주고 호출하지 않음 (총 1회) | — (결정 1) |

어긋나는 필드는 없다. 실행 레인은 `planId`(승인 대조·중복 기억·`requestId`), `disputeId`, `apiMove`, `amountCents`, `currency`, `refundType`만 읽고 `messageRequired`·`move`·`requiresApproval`은 읽지 않는다 (`src/exec/execute.ts`, `src/exec/request.ts`).

### "같이 고칠 것" (a) `suspected_abuse` 로그 문구
격자: F1·F2 × 사유 3종(INR·SNAD·UNAUTHORISED) × 이전 미수령 12종(0·1·2·3·10·11·12·20·21·22·100·110) × 배송 완료 유무 × 추적 유무 = 288건. 문구에서 "N번째 미수령 주장", "이전 N건", "delivery proof"를 뽑아 보드 값과 대조했다.

| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 288건의 `verdict`·`rule` | 모두 `skipped`·`suspected_abuse`, 변경 전과 같음 | 다른 건 0 | 일치 |
| 288건 문구가 보드 사실과 맞는지 (서수 숫자·접미사, 이전 분쟁 수, 배송 완료, 유형, 미수령 여부, 영어 한 문장·ASCII, 분쟁 ID 미포함) | 어긋나는 건 0 | 0 | 일치 |
| F1 + INR + 이전 2 + 배송 완료 (D3) | `3rd "not received" claim with delivery proof` (변경 전과 같음) | 같음 | 일치 |
| F1 + INR + 이전 3 + 배송 완료 | `4th "not received" claim with delivery proof` | 같음 | 일치 |
| F1 + INR + 이전 2 + 배송 완료 없음 | 배송 기록을 근거로 적지 않음 | `(3rd "not received" claim)` | 일치 |
| F1 + INR + 이전 0·1 | 근거 없음 (기준 2건 미만) | `Skipped: cause F1 is suspected abuse, so autopilot never acts on this dispute.` | 일치 |
| F1 + SNAD + 이전 2 + 배송 완료 | "3번째 미수령 주장"이 아님 | `(2 earlier "not received" disputes from this buyer with delivery proof)` | 일치 |
| F1 + SNAD + 이전 0·1 | 근거 없음 | 근거 없음 | 일치 |
| F2 + (INR·SNAD) + 이전 0·2·3 + 배송 완료 유무 | 미수령 문구 없음, 유형에 맞는 문구 | `(the cause check flagged a partial-refund pattern)` | 일치 |
| 서수 11·12·13·21·22·23·101·111번째 | `11th`·`12th`·`13th`·`21st`·`22nd`·`23rd`·`101st`·`111th` | 같음 | 일치 |

틀린 사실을 말하는 조합은 남아 있지 않다.

### "같이 고칠 것" (b) 동점 테스트 2개가 실제 동점인지
| 시나리오 | 기대 (SPEC 식 직접 계산) | 실제 (엔진) | 일치 |
|---|---|---|---|
| `recommend.test.ts:167-176`: B1, A 4800, f 1500, t 200, x 0.15, p_acc 0.72, p_win = 1 − 720/6300 | (1 − p_win)(A + f) = 720. L_fight = 720 + 200 = **920**. L_offer = 0.72 × 720 + 0.28 × 720 + 200 = **920**. L_refund = 5000. 반올림 전에도 같은 값(실수 계산 920.0000000000002 vs 920)이라 반올림으로 만든 동점이 아니다. 추천 fight | 920 / 920 / 5000, fight | 일치 |
| `recommend.test.ts:178-186`: B1, A 3500, f 7650, p_win 0 | 제안 금액 525. L_offer = (72 × 525 + 28 × 11150)/100 + 200 = 350000/100 + 200 = **3700**. L_refund = 3500 + 200 = **3700**. L_fight = 11150 + 200 = 11350. 추천 offer | 11350 / 3700 / 3700, offer | 일치 |

두 테스트 모두 세 수의 값을 상수로 단언하고 추천까지 확인한다.

## SPEC·지시서 대조
| 조항 | 판정 | 근거 |
|---|---|---|
| SPEC 5장 수 → API: offer → `make_offer` | 일치 | `src/engine/plan.ts:51-59` |
| SPEC 5장 수 → API: refund → `accept_claim` | 일치 | `plan.ts:61-64` |
| SPEC 5장 수 → API: fight → `provide_evidence` 또는 `send_message` | 일치 | `plan.ts:66-69` (평가의 `apiMove`를 그대로 씀. 선택은 `src/engine/policy.ts:26-30`) |
| SPEC 5장 제안은 B1·B2만 | 해석 필요 | `plan.ts:96`은 평가의 `blockedBy`만 본다. `recommend`가 만든 평가를 같은 보드로 넘기면 일치. 직접 만든 평가나 다른 보드의 평가면 대상이 아닌 유형에도 제안 계획이 나온다 (발견 1). 지시서 동작 1이 요구한 범위는 충족 |
| SPEC 5장 금액은 센트 정수 | 일치 | `src/engine/oracle.ts:40-42` (`roundCents`). A = 0..30000에서 계획 금액이 모두 정수 |
| SPEC 5장 "마지막에 사사오입" (Q9) | 해석 필요 (기존, 변동 없음) | 제안 금액을 먼저 사사오입하는 현 구현 유지. 지시서 "하지 않을 것"과 일치. 새 사실 없음 |
| SPEC 5장 실행은 항상 판매자 승인 후 | 일치 | `plan.ts:105` (`requiresApproval: true` 고정) |
| SPEC 6장 제안률 정책값 0.15, 한도 0.20, 초과는 zod 에러 | 일치 | `src/engine/params.ts:118-129`, `plan.ts:93`. 0.20 통과(960), 0.2000001·0.25 ZodError. 값은 `config/`에서 (`plan.ts`에 숫자 리터럴 없음) |
| SPEC 9-1장 `planId`가 승인과 계획을 묶는 키 | 일치 | `plan.ts:82-86, 105`. 실행 레인에서 승인 대조·`requestId`로 쓰임을 확인 |
| SPEC 9-1장 `make_offer`의 메시지는 `note` | 일치 | offer 계획 `messageRequired: false` (`plan.ts:57`). mock 실행에서 note로 나감 |
| SPEC 9-1장 `provide_evidence`는 아직 실행하지 않음 | 일치 | 계획은 만들고(`plan.ts:66-69`) 실행 레인이 거부. 지시서 동작 2 표와 같음 |
| `src/types.ts` `PlanMoveFn`: 차단됐거나 `apiMove`가 null이면 예외 | 일치 | `plan.ts:92, 96-97` |
| `src/types.ts` `ActionPlan` 9개 필드 | 일치 | `plan.ts:99-105`. 키 집합 확인 |
| 지시서 동작 1: T004와 같은 zod, 한도 초과·차단·`apiMove: null` 예외 | 일치 | `plan.ts:93` (`resolveEngineInput`), `plan.ts:94-97`. 평가도 zod로 검증 (`plan.ts:33-39`) |
| 지시서 동작 2: 수별 계획 표 | 일치 | `plan.ts:50-70`. 시나리오 표 |
| 지시서 동작 3: 제안 금액은 `oracle.ts`가 L_offer에 쓰는 값과 같은 함수 | 일치 | `oracle.ts:40-42`를 `oracle.ts:73`과 `plan.ts:55`가 같이 호출. 전수 일치 |
| 지시서 동작 4: `disputeId`, `currency: 'USD'`, `requiresApproval: true` | 일치 | `plan.ts:100, 105` |
| 지시서 동작 5: planId 결정론, 5개 값으로 구성, 난수·시각·카운터 금지, 사람이 읽는 형태 | 일치 | `plan.ts:82-86`. 뒤 네 조각(`move`·`apiMove`·금액·환불 종류)에 하이픈이 없어 뒤에서부터 끊으면 한 가지로만 읽힌다. 충돌 0 |
| 지시서 동작 6: 입력 불변 | 일치 | zod `parse`가 만든 사본만 읽음. 얼린 입력 통과 |
| 지시서 "같이 고칠 것" 1: F1 + 미수령일 때만 "N번째 주장", 그 외 F는 유형에 맞게, 판정 불변, 단위 테스트 | 일치 | `src/engine/autopilot.ts:31-53`. 격자 288건. 테스트 5개 추가 (`tests/unit/autopilot.test.ts:154-212`) |
| 지시서 "같이 고칠 것" 2: 동점 fight = offer, offer = refund | 일치 | `tests/unit/recommend.test.ts:167-186`. 실제 동점임을 계산으로 확인 |
| 지시서 수정 가능 폴더: `oracle.ts`·`params.ts`는 공유를 위한 export 추가만, 계산 결과 불변 | 일치 | diff는 함수 추출 1개 + `export` 2개. 51,000건 + 전수 30,000건 결과 동일 |
| 지시서 수정 가능 폴더: `autopilot.ts`는 로그 문구만 | 일치 | diff가 `abuseDetail`과 보조 함수 `isNotReceived`에 한정. `verdict`·`rule` 51,000건 동일 |
| 지시서 수정 가능 폴더: 기존 단위 테스트는 사례 추가만 | 일치 | 두 파일 모두 삭제 0줄 |
| 지시서 완료 기준 4개 (AC4 5개, T004 AC 27개, 단위 테스트, tsc 자기 파일) | 일치 | 위 명령 표 |
| 지시서 하지 않을 것 (실행, 초안, 확대 위험, 시뮬레이션, 제안률 최적화, `config/` 변경, Q9) | 일치 | 해당 파일·변경 없음 |
| CLAUDE.md 공통: 숫자는 `config/`, 금액 계산은 `src/engine/`에서만 | 일치 | `plan.ts` 숫자 리터럴 0개. 금액은 `oracle.ts` 한 곳 |
| CLAUDE.md 공통: 비밀값·구매자 개인정보를 남기지 않음 | 일치 | planId·예외 문구에 분쟁 ID·수·API·금액 외의 값 없음. diff에 secret·token·이메일 패턴 없음 |
| 구현자 보고의 주장 (바뀐 파일, 테스트 수, planId 형식, 문구 전후 표, 남은 문제) | 일치 | 내 실행 결과와 숫자가 모두 같다 (5 / 27 / 42·2·9 / 156 / tsc 2건). 과장·누락 없음 |

## 발견한 문제
병합 차단: **없음**

| # | 심각도 | 문제 | 근거 |
|---|---|---|---|
| 1 | 병합 후 수정 | `planMove`가 평가를 보드와 대조하지 않는다. `blockedBy`가 없는 평가를 직접 만들거나 다른(이전) 보드의 평가를 넘기면 ① 제안 대상이 아닌 유형(A1)·원인 없는 보드에도 `make_offer` 720 계획이 나오고 ② `allowedMoves`에 없는 수의 계획도 나온다. ②는 실행 레인이 거부하지만(SPEC 9-1) 판매자는 실행되지 않을 계획을 보고 승인하게 된다. ①은 뒤에서 막는 곳이 없다 (`executeMove`는 유형을 보지 않는다). `recommend(board).all`의 항목을 같은 보드·같은 설정으로 넘기면 일어나지 않고, 지시서 동작 1이 요구한 검사는 모두 있다. 화면(T009·T010)이 분쟁을 다시 불러온 뒤 예전 평가로 계획을 만드는 경우가 실제 경로다. `policy.ts`의 `apiMoveFor`·`isOfferInScope`로 다시 확인하면 닫힌다 | `plan.ts:92-103`. `plan.ts` 시나리오 D의 INFO 5건. 구현 보고 "남은 문제" 1번은 ②만 적고 ①은 적지 않았다 |
| 2 | 의견 | 0¢ 제안 계획이 만들어진다: A ≤ 3¢ (x·A < 0.5) 또는 x = 0. 실행 레인도 `offer_amount "0.00"`으로 보낸다 (mock 기준). 실제 분쟁 금액에서는 나오지 않는다 | `oracle.ts:40-42`, `misc.ts` (c) |
| 3 | 의견 (확인 못 함) | planId가 길어졌다: 실제 분쟁 ID 길이(예 `PP-R-ABC-10112233`)면 planId 50자, 실행 레인의 `PayPal-Request-Id`(`<planId>:<엔드포인트>`)는 약 61자. 분쟁 API가 이 헤더 길이를 제한하는지는 이 저장소에서 확인할 수 없었다. 샌드박스 실행(T026) 때 볼 것. 또 `disputeId`를 그대로 넣으므로 공백·줄바꿈이 있는 ID면 planId에도 들어간다 (PayPal ID에는 없다) | `plan.ts:85`, `src/exec/request.ts:23-25` |
| 4 | 의견 | `planMove` 예외 문구가 한국어다 (`plan.ts:20-27`). 화면이 이 문구를 그대로 보여 줄 계획이면 T027(실행 문구 영어화)과 같은 처리가 필요하다. 던지는 예외라 지금은 화면 문구로 보지 않았다 | `plan.ts:20-27` |
| 5 | 의견 | 평가의 `expectedLossCents: null`이면서 `blockedBy`가 없는 평가도 계획이 만들어진다 (`recommend`는 이런 평가를 만들지 않는다) | `plan.ts:36, 96-97` |

단위 테스트의 질 (의견):
- 좋은 점: 수 3종의 필드를 상수로 단언하고, 제안 금액을 x·A가 정수가 아닌 금액(1050 → 158)에서 트리의 수락 분기와 맞춰 본다. planId를 전체 문자열로 고정한 사례가 2개 있어 형식이 바뀌면 바로 드러난다. 동점 2종은 손으로 푼 값이다.
- 빠진 경계: 한도 바로 위(0.2000001)와 x = 0, 음수·NaN 제안률 / 같은 금액·다른 수의 planId (offer 4800 vs refund 4800) / 평가의 수가 `board.allowedMoves`에 없는 경우와 제안 대상이 아닌 보드에 정상 offer 평가를 넘기는 경우 (발견 1의 동작을 고정하는 테스트가 없다) / 금액이 0이 되는 제안 / `blockedBy: ''` / 서수 11th~13th.
- 약한 테스트: `plan.test.ts:199-209` "환불 종류가 바뀌면 planId도 바뀐다"는 실제로 다른 환불 종류를 만들지 못해 끝 조각 문자열만 본다. `plan.test.ts:217-228` 불변 테스트는 `P`·`R`을 얼리지 않고 JSON 비교만 한다 (내 스크립트에서 깊게 얼려 확인함).

## 컨트롤 타워가 결정할 것
1. **같은 분쟁에서 같은 수를 두 번 실행하는 경우의 planId.** 지시서가 정한 구성(분쟁·수·API·금액·환불 종류)대로면 한 분쟁의 fight 계획은 항상 `plan-<id>-fight-send_message-none-none`이다. 내용이 다른 두 번째 메시지를 승인해도 실행 레인이 "이미 성공한 계획"으로 보고 호출하지 않고 이전 성공 결과를 돌려준다 (mock으로 확인: 호출 1회, 두 번째 결과도 `ok: true`). `PayPal-Request-Id`도 같아진다. 같은 금액의 제안을 다시 보내는 경우도 같다. 데모 흐름(분쟁마다 수 1회)에는 영향이 없다. 한 분쟁에 메시지를 여러 번 보내는 흐름을 넣을 계획이면 planId에 회차나 메시지 구분값을 넣을지(계약·지시서 변경), 실행 레인의 중복 기억을 바꿀지(T027) 정해야 한다. 구현 결함이 아니라 지시서 정의의 결과다.
2. **발견 1을 engine 레인 후속 수정으로 넘길지.** 넘긴다면 화면 작업(T009·T010)이 `planMove`를 부르기 전이 좋다.
3. SPEC 5장 반올림(Q9): 새 사실 없음. 제안 금액과 기대 손실이 `offerAmountCents` 한 함수에서 나오므로, ②안(식 그대로)을 고르면 `plan.ts`도 같이 지시해야 한다는 구현 보고의 지적은 맞다.
