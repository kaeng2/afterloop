# T004 검증 (2026-11-09 21:21 KST)
- 판정: **통과**   (인수 테스트 27/27, 범위 밖 수정 없음, 지시서 동작 1~9 충족. SPEC 5장 반올림 문구와 어긋나는 지점 1건은 계약 안의 요구끼리 충돌해서 생긴 것이라 "해석 필요"로 분류했고, 아래 "컨트롤 타워가 결정할 것" 1번에 올린다)
- 검증 대상: lane/engine `168f691` (구현 커밋 `d2c8106` + 보고 커밋 `168f691`, main `440cc7e`보다 2개 앞) · 기준 SPEC v2.1 (`SPEC.md` 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)` 확인)
- 검증 방법: 코드·설정·테스트는 읽고 실행만 했다. 독립 재계산 스크립트는 worktree 밖 scratchpad에 두었다 (`.../scratchpad/verify-T004/recalc.ts`, `edge.ts`). 구현자 보고(`reports/T004-impl.md`)는 내 판단을 끝낸 뒤 마지막에 읽고 대조했다.

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-only main..HEAD` | — | — | 9개 파일: `src/engine/{autopilot,oracle,params,policy,recommend}.ts`, `tests/unit/{autopilot,oracle,recommend}.test.ts`, `reports/T004-impl.md`. 모두 지시서 "수정 가능 폴더" 안 |
| `git diff --name-only main..HEAD -- src/types.ts tests/acceptance SPEC.md config` | — | — | 출력 없음 (계약·설정 파일 변경 0건) |
| `npx vitest run tests/acceptance/ac01-03.recommend.test.ts tests/acceptance/ac05-06-08.policy.test.ts tests/acceptance/ac09-10.general.test.ts` | 27 | 0 | 파일 3개 통과 (11 + 9 + 7) |
| `npm test` | 66 | 0 | `tests/unit/` 3개 파일 (oracle 26, autopilot 17, recommend 23). `tests/integration/`은 아직 없음 |
| `npx tsc --noEmit` | — | 4 | 4건 모두 TS2307 (없는 모듈): `@/engine/plan`, `@/engine/escalation`, `@/exec/execute`, `@/paypal/client`. `src/engine/`·`tests/unit/` 오류 0건 |
| `npm run test:acceptance` (전체) | 27 | 2 (건너뜀 9) | 파일 8개 중 3개 통과, 5개 실패. 실패는 모두 T004 범위 밖 (아래 분류) |
| `npx eslint src/engine tests/unit` | — | 0 | 출력 없음 (지시 밖 추가 확인) |
| `npx tsx .../verify-T004/recalc.ts` | 18,307 | 0 | 내 독립 계산과 엔진 비교 (아래) |

전체 인수 테스트에서 통과하지 못한 것의 분류:
| 파일 | 원인 | 책임 |
|---|---|---|
| `ac04.plan.test.ts` | `@/engine/plan` 없음 (파일 로드 실패) | engine, T005 |
| `ac07.escalation.test.ts` | `@/engine/escalation` 없음 | engine, T018 |
| `ac11-12.exec.test.ts` | `@/exec/execute` 없음 | paypal |
| `ac14.client.test.ts` | `@/paypal/client` 없음 | paypal |
| `ac13.sandbox.test.ts` | 테스트 2개 실패: `.env.example` 없음, `.env.example`이 `.gitignore`의 `.env*`에 걸려 무시됨. 9개는 `RUN_SANDBOX=1`이 아니라 건너뜀 | paypal · 사람 (샌드박스 세팅) |

main에는 `src/app/`과 `src/types.ts`만 있고 위 모듈들이 아직 없으므로, 이 실패는 이번 변경과 무관하다.

## 독립 재계산
방법: `config/params.json`·`config/rules.json`을 내가 직접 읽고, SPEC 5장 식을 BigInt 유리수로 정확히 푼 다음 마지막에 사사오입했다 (부동소수 오차 없음, 엔진 코드 미사용). 추천·오토파일럿도 SPEC 5장·6장 표대로 따로 구현해 `recommend()` 결과와 비교했다. 검사 18,307건 중 내 구현과 다른 결과 0건. 단, offer는 "식 그대로"와 다른 금액이 있어서 아래에 따로 적는다.

### 인수 테스트 분쟁
| 입력 | 수 | 내 계산 | 엔진 | 일치 |
|---|---|---|---|---|
| D1 $48, B1, 추적 없음 (p_win 0.30) | fight | 0.7 × 6300 + 200 = 4610 | 4610 | 일치 |
| | offer | 518.4 + 1234.8 + 200 = 1953.2 → 1953 | 1953 | 일치 |
| | refund | 5000 | 5000 | 일치 |
| | 추천 / 오토파일럿 | offer / `awaiting_approval`·`money_moves` | 같음 | 일치 |
| D3 $35, F1, 추적·배송 완료 (p_win 0.80) | fight | 0.2 × 5000 + 200 = 1200 | 1200 | 일치 |
| | offer | 대상 아님 (`OFFER_SCOPE`, null, 분기 없음) | 같음 | 일치 |
| | refund | 3700 | 3700 | 일치 |
| | 추천 / 오토파일럿 | fight / `skipped`·`suspected_abuse` | 같음 | 일치 |

### 가격 4종 × 유형 7개 × 추적 유무 (56건)
가격 4800·7200·18900·3500 × A1·A2·B1·B2·C1·E1·F1 × 추적 없음/있음. fight·offer·refund 기대 손실, 차단 여부, 추천, 오토파일럿 규칙이 56건 모두 일치 (불일치 0). 대표값:
| A(¢) | 유형 | 추적 | p_win | fight | offer | refund | 추천 | 오토파일럿 |
|---|---|---|---|---|---|---|---|---|
| 4800 | A1 | 없음 | 0.15 | 5555 | 대상 아님 | 5000 | refund | money_moves |
| 4800 | A1 | 있음 | 0.80 | 1460 | 대상 아님 | 5000 | fight | seller_review |
| 7200 | A2 | 있음 | 0.60 | 3680 | 대상 아님 | 7400 | fight | seller_review |
| 7200 | B1 | 없음 | 0.30 | 6290 | 2683 | 7400 | offer | money_moves |
| 18900 | B2 | 있음 | 0.30 | 14480 | 6240 | 19100 | offer | money_moves |
| 18900 | C1 | 없음 | 0.10 | 18560 | 대상 아님 | 19100 | fight | seller_review |
| 3500 | E1 | 없음 | 0.10 | 4700 | 대상 아님 | 3700 | refund | money_moves |
| 3500 | A2 | 없음 | 0.30 | 3700 | 대상 아님 | 3700 | fight (동점) | seller_review |
| 3500 | F1 | 없음 | 0.15 | 4450 | 대상 아님 | 3700 | refund | suspected_abuse |

추가 전수 확인: fight는 16개 유형 × 추적 유무 × A = 1, 8, 15, … 30000 (137,152건) 불일치 0. B1에서 A = 1..30000 전부 fight·refund 불일치 0.

### x·A가 정수 센트가 아닌 금액: 엔진 값이 "식 그대로"와 다른 경우 (불일치)
엔진은 x·A를 먼저 센트로 사사오입한 뒤 식에 넣는다 (`src/engine/oracle.ts:65-67`). SPEC 5장 "계산식을 그대로 푼 뒤 마지막에 센트로 사사오입"대로 푼 값과 비교하면:
| A(¢) | x·A | 식 그대로 (반올림 전 → 사사오입) | 엔진 | 차이 |
|---|---|---|---|---|
| 1050 | 157.5 | 813.2 → 813 | 814 | +1 |
| 3333 | 499.95 | 1507.232 → 1507 | 1507 | 0 |
| 4999 | 749.85 | 2013.696 → 2014 | 2014 | 0 |
| 50 | 7.5 | 509.2 → 509 | 510 | +1 |
| 90 | 13.5 | 521.36 → 521 | 522 | +1 |
| 2 | 0.3 | 494.608 → 495 | 494 | −1 |
| 9 | 1.35 | 496.736 → 497 | 496 | −1 |

- 전수 (B1, p_win 0.30, A = 1..30000): offer가 다른 금액 **5,400건 (18%)**, 차이는 항상 ±1¢ (+1¢ 3,000건, −1¢ 2,400건). **추천(`best`)이 바뀌는 금액은 0건.**
- x·A가 정수인 금액(20¢ 배수, 1,500개)에서는 차이 0건. 인수 테스트·상품 가격 4종(4800, 7200, 18900, 3500)은 모두 20¢ 배수라 영향이 없다.
- 엔진 값은 "x·A를 먼저 사사오입한 변형"을 유리수로 푼 값과 30,000건 모두 같다 (부동소수 오차로 인한 다른 어긋남은 없음).
- 이렇게 한 이유의 검증: 식을 그대로 풀고 분기 손실만 센트 정수(x·A 사사오입 + t)로 두면, 지시서 4번의 "Σ prob × lossCents = 기대 손실 ±0.5¢"를 벗어나는 금액이 30,000개 중 5,340개 나온다 (예: A = 2¢에서 0.608¢, A = 1050¢에서 0.56¢). 즉 "식 그대로 마지막에 사사오입" + "분기 금액은 센트 정수" + "Σ 오차 0.5¢ 이내" 세 요구가 20¢ 배수가 아닌 금액에서는 동시에 성립하지 않는다. 구현은 셋 중 첫 번째를 1¢ 범위에서 양보했다.

### 동점·필터·원인 없음
| 사례 | 엔진 fight / offer / refund | 기대 추천 | 엔진 추천 | 일치 |
|---|---|---|---|---|
| fight = refund = 1200, offer 800 | 1200 / 800 / 1200 | offer | offer | 일치 |
| fight = refund = 1200 (make_offer 불허) | 1200 / — / 1200 | fight | fight | 일치 |
| fight = offer = 400, refund 1200 | 400 / 400 / 1200 | fight | fight | 일치 |
| offer = refund = 1200, fight 2000 | 2000 / 1200 / 1200 | offer | offer | 일치 |
| 세 수 모두 1200 | 1200 / 1200 / 1200 | fight | fight | 일치 |
| offer = refund = 1200 (fight 불허) | — / 1200 / 1200 | offer | offer | 일치 |
| `allowedMoves: []` | all = [] | null | null | 일치 |
| `[send_message, accept_claim]` | 4610 / — / 5000 | fight | fight | 일치 |
| `[send_message, make_offer]` | 4610 / 1953 / — | offer | offer | 일치 |
| `[make_offer]`, A1 (제안 대상 아님) | — / 차단 / — | null | null | 일치 |
| `[provide_evidence]` 만 | fight만, apiMove `provide_evidence` | fight | fight | 일치 |
| `provide_evidence` + `send_message` 둘 다 | fight apiMove `provide_evidence` | — | — | 일치 |
| 원인 없음, INTERNAL, 수 3개 허용 | 세 수 모두 null, `blockedBy: 'NO_CAUSE'`, 분기 없음 | null | null, `skipped`·`low_confidence` | 일치 |
| 원인 없음, EXTERNAL | 같음 | null | null, `skipped`·`card_company_case` (2번 규칙이 먼저) | 일치 |

### 오토파일럿·검증·불변
- 오토파일럿 격자 980건 (유형 B1·B3·A1·A2·F1·F2·없음 × 채널 2 × 확신도 0, 0.5, 0.69, 0.6999999, 0.7, 0.71, 1 × 추적 2 × allowedMoves 5종): 내 판정(SPEC 6장 표 순서)과 불일치 0. `auto`·`common_questions`는 한 번도 나오지 않음.
- 규칙 값을 바꾼 설정(제안 대상 A1, skipCategories B, minConfidence 0.95, moneyMoves fight)과 가정값을 바꾼 설정(f 800, t 300, x 0.10, p_acc 0.5 → fight 4220 / offer 2500 / refund 5100)에서도 내 계산과 일치. 값이 코드가 아니라 넘긴 설정에서 온다는 뜻이다.
- zod 16종: offerRate 0.21 (한도 0.20) → ZodError, 0.20 → 통과, maxRate를 0.10으로 낮추면 0.15도 ZodError, 제안을 안 하는 A1에서도 한도 초과는 ZodError, 확률 범위 밖(p_win 1.1, −0.1, p_acc −0.01, 확신도 1.01, minConfidence 1.5), 금액 −1·10.5·NaN, f 1500.5, t −1, pWin 유형 누락 → 모두 ZodError. 금액 0은 통과.
- params·rules 생략 결과 = `config/*.json`을 직접 넘긴 결과 (JSON 동일).
- 깊게 얼린(`Object.freeze`) board·params·rules로 호출: 예외 없음, 내용 그대로. 결과 객체를 바꿔도 입력이 바뀌지 않음.
- 보드 5종 × 200회 결과 동일. 실행 중 `Math.random`·`Date.now`·`new Date`·`performance.now` 호출 0회 (전역을 가로채서 셈).

## SPEC·지시서 대조
| 조항 | 판정 | 근거 |
|---|---|---|
| 5장 L_fight = (1 − p_win)(A + f) + t | 일치 | `src/engine/oracle.ts:45`. 전수 137,152건 일치 |
| 5장 L_offer = p_acc·x·A + (1 − p_acc)(1 − p_win)(A + f) + t, t 한 번 | 해석 필요 | `oracle.ts:65-67`. x·A를 먼저 사사오입. 20¢ 배수가 아닌 금액의 18%에서 ±1¢ (위 표). 코드 주석과 구현 보고에 밝혀 둠 |
| 5장 L_refund = A + t (f 없음) | 일치 | `oracle.ts:77-82` |
| 5장 f는 질 때만 (수락 분기·환불에 f 없음) | 일치 | `oracle.ts:69` accept = x·A + t, `oracle.ts:78` |
| 5장 기본값은 `config/params.json`에서 | 일치 | `src/engine/params.ts:12-13, 133-136, 147-152`. `src/engine/`에 800·1500·200·0.15·0.72·0.7·0.2 리터럴 없음 (grep) |
| 5장 p_win: 추적 있으면 별도 값, 없으면 기본값 | 일치 | `oracle.ts:29-34` (`hasTracking` 기준, 지시서 2번 그대로. `??`라서 값 0도 존중) |
| 5장 제안은 B1·B2만, 그 외 `OFFER_SCOPE`·null | 일치 | `src/engine/policy.ts:40-43` (`rules.offer.eligibleSubtypes`), `src/engine/recommend.ts:45-51`. AC5 통과 |
| 5장 V·c·p_acc 곡선 미사용 | 일치 | `src/engine/` 전체에 해당 변수 없음 |
| 5장 센트 정수, 마지막에 사사오입 | 해석 필요 | fight·refund는 일치 (`oracle.ts:21-23`, 0.5 올림). offer만 위 사유. 모든 `expectedLossCents`·`lossCents`가 정수임을 확인 |
| 5장 동점 fight → offer → refund | 일치 | `policy.ts:15, 49-57`. 동점 6종 확인 |
| 5장 최소 기대 손실이 `best`, 항상 승인 필요 | 일치 | `recommend.ts:64-68` (`requiresApproval: true` 고정) |
| 5장 수 → API 표 (fight: provide_evidence 우선, 없으면 send_message / offer: make_offer / refund: accept_claim) | 일치 | `policy.ts:26-37`. AC8 통과 |
| 5장 API가 `allowedMoves`에 없으면 `all`에서 뺌, 없으면 `best = null` | 일치 | `recommend.ts:32-33`, `policy.ts:51`. AC9 통과 |
| 6장 제안률 한도 초과는 zod 에러 | 일치 | `params.ts:117-128` (`offerRate > rules.offer.maxRate` → ZodError). 같으면 통과 |
| 6장 규칙 1 F → `skipped`·`suspected_abuse` | 일치 | `src/engine/autopilot.ts:47-53` |
| 6장 규칙 2 EXTERNAL → `skipped`·`card_company_case` | 일치 | `autopilot.ts:55-61` |
| 6장 규칙 3 확신도 < 0.7 또는 원인 없음 → `skipped`·`low_confidence` | 일치 | `autopilot.ts:63-77`. 0.69 건너뜀, 0.70 통과 (기준값은 `rules.autopilot.minConfidence`) |
| 6장 규칙 4 best가 offer·refund → `awaiting_approval`·`money_moves` | 일치 | `autopilot.ts:79-85` (`rules.autopilot.moneyMoves`) |
| 6장 규칙 5 그 외 → `awaiting_approval`·`seller_review` | 일치 | `autopilot.ts:87-93` (best fight 또는 null) |
| 6장 순서대로 첫 번째 규칙 | 일치 | 코드 순서 1 → 2 → 3 → 4 → 5. 격자 980건 일치 |
| 6장 분쟁에는 자동 실행 없음 | 일치 | `recommend`가 `auto`를 내는 경로 없음 |
| 지시서 1 zod 검증 | 일치 | `params.ts:54-128`, `recommend.ts:62` |
| 지시서 2 p_win 선택, 원인 없으면 계산하지 않고 `best = null` | 일치 | `oracle.ts:29-34`, `recommend.ts:35-38`. 차단 이유로 `'NO_CAUSE'`를 새로 씀 (결정 2번) |
| 지시서 3 기대 손실 | 해석 필요 | offer 반올림 (위와 같음) |
| 지시서 4 분기 라벨·확률·손실, 확률 합 1, Σ ±0.5¢ | 일치 | `oracle.ts:46-49, 68-72, 81`. 라벨 `win`·`lose`·`accept`·`reject_win`·`reject_lose`·`refund`. 전 사례에서 확률 합 1 (1e-9), Σ 오차 0.5¢ 이내 |
| 지시서 5 제안 대상 아니면 null·`OFFER_SCOPE`·`branches: []` | 일치 | `recommend.ts:17-19`. 이때 `apiMove`는 null (SPEC 표의 "허용 + B1·B2"와 맞음) |
| 지시서 6 수 → API, 없는 수는 `all`에서 뺌 | 일치 | 위 5장 표와 같음 |
| 지시서 7 추천 | 일치 | `policy.ts:49-57` |
| 지시서 8 오토파일럿, `reason` 영어 한 문장 | 일치 | 5개 규칙의 문구가 모두 ASCII 한 문장. 원문 8장 S4 문체와의 대조는 원문이 저장소에 없어 하지 못함 |
| 지시서 9 `Math.random`·`Date`·`performance.now` 금지, 입력 불변 | 일치 | `grep -rnE 'Math\.random\|Date\b\|performance\.now' src/engine/` → 주석 1줄(`recommend.ts:5`)과 필드 이름 `dueDate`(`params.ts:94`)뿐. 실행 중 호출 0회. zod `parse`가 새 객체를 돌려주고 엔진은 그 사본만 읽음 |
| 공통 규칙: 숫자는 config에서 | 일치 | `src/engine/`의 숫자 리터럴은 `1e6`(반올림 보정), `100`·`toFixed(2)`(달러 표기), 서수 접미사 계산뿐 |
| 공통 규칙: 비밀값·개인정보 없음 | 일치 | diff 전체에 secret·token·이메일·전화 패턴 없음. `reason`에 분쟁 ID·구매자 정보 없음 |
| 범위: 수정 가능 폴더 | 일치 | 9개 파일 모두 `src/engine/`, `tests/unit/`, `reports/T004-impl.md` |
| 하지 않을 것 (planMove, 확대 위험, 시뮬레이션) | 일치 | 해당 파일 없음 |

## 발견한 문제
병합 차단: **없음**

| # | 심각도 | 문제 | 근거 |
|---|---|---|---|
| 1 | 병합 후 수정 (결정 필요) | L_offer가 SPEC 5장 문구("식을 그대로 푼 뒤 마지막에 사사오입")와 최대 1¢ 다르다. 20¢ 배수가 아닌 금액의 18%. 추천은 바뀌지 않고, 인수 테스트·상품 가격 4종에는 영향이 없다 | `oracle.ts:65-67`, 위 "x·A가 정수 센트가 아닌 금액" 표 |
| 2 | 병합 후 수정 | 악용 의심 로그 문구가 F1이 아닌 건에도 "not received" 주장으로 적힌다. 예: F2 + SNAD + 이전 미수령 분쟁 2건 + 배송 완료 → `Skipped: cause F2 is suspected abuse (3rd "not received" claim with delivery proof), …`. 이번 분쟁이 미수령이 아닌데 "3번째 미수령 주장"이라고 쓰는 것은 사실과 다르다. 판정(`skipped`·`suspected_abuse`)은 맞고 문구만의 문제다 | `autopilot.ts:32-36` (`abuseDetail`이 `cause.subtype`·`board.reason`을 보지 않음) |
| 3 | 의견 | `roundCents`가 소수 6자리에서 먼저 정리하므로 X.4999995 ~ X.4999999 구간은 올림된다 (예: 1952.4999996 → 1953). 지금 설정값(소수 2자리)에서는 식의 값이 1e-4 단위라 나올 수 없다. 소수 자릿수가 많은 가정값을 쓰게 되면 다시 볼 것 | `oracle.ts:21-23` |
| 4 | 의견 | 동점은 센트로 반올림한 뒤에 판정한다 (반올림 전 0.5¢ 미만 차이는 동점으로 보고 fight 우선). SPEC이 금액을 센트 정수로 정의하므로 타당하다고 본다 | `policy.ts:52-56` |
| 5 | 의견 | `reason` 영어 문장이 `src/engine/autopilot.ts`에 직접 들어 있다. CLAUDE.md는 "화면 문구는 `config/`"라고 하지만 `src/types.ts:204`가 "로그 문구 (영어, 숫자는 코드가 채움)"라고 하고 `config/copy.*.json`은 ui 레인 소유라, 위반으로 보지 않았다 | `autopilot.ts:51, 59, 67, 75, 83, 91-92` |
| 6 | 의견 (구현 보고의 사소한 부정확) | 보고서의 "실측 A = 1050¢에서 0.76¢"는 내 계산으로 0.56¢다 (Σ 813.56 vs 813). 0.5¢를 넘는다는 결론은 같다. 또 전체 인수 테스트의 "+5 파일 import 실패"는 정확히는 import 실패 4개 + `ac13` 테스트 2개 실패다 | `reports/T004-impl.md` |

단위 테스트의 질 (의견):
- 좋은 점: 핵심 기대값(4610, 1953, 5000, 동점 5000)을 식에서 손으로 푼 상수로 적었고, 가정값은 config에서 읽는다. 규칙 순서(1 > 2 > 3 > 4), 기준값 변경, zod 오류 7종, 얼린 입력까지 본다. 분기 불변식은 금액 12종 × p_win 7종의 성질 검사다.
- 구현을 따라간 기대값: `recommend.test.ts:50-52` (엔진과 같은 `Math.round` 식), `oracle.test.ts:94` (`roundCents`를 기대값 계산에 사용), `oracle.test.ts:97-102` (x·A 선반올림 158¢를 고정. 결정 1번이 바뀌면 이 테스트도 바뀌어야 한다).
- 빠진 경계: fight = offer 동점, offer = refund 동점, 세 수 동점 (내 스크립트로는 확인함). `amountCents: 0`. `pWinWithTracking` 값이 0인 유형. F2 + 이전 미수령 분쟁이 있을 때의 문구 (문제 2). `maxRate`를 낮췄을 때의 한도 오류.

## 컨트롤 타워가 결정할 것
1. **SPEC 5장 반올림과 지시서 4번의 충돌 (offer).** "식 그대로 풀고 마지막에 사사오입", "분기 금액은 센트 정수", "Σ prob × lossCents = 기대 손실 ±0.5¢"는 x·A가 정수 센트가 아닌 금액에서 동시에 성립하지 않는다 (내 계산으로 30,000개 금액 중 5,340개). 선택지:
   - (가) 지금 구현을 인정: "제안 금액 x·A는 센트로 사사오입한 뒤 식에 넣는다"를 SPEC 5장에 한 줄 추가 (SPEC 변경이므로 `DECISIONS.md` 기록·사람 승인·버전 올림 필요). 화면의 제안 금액(T005 `planMove`의 `amountCents`)과 기대 손실이 같은 금액을 쓰게 되는 장점이 있다. T005가 같은 반올림을 쓰도록 지시서에 적을 것. x = 0.15에서는 `Math.round(x·A)`와 엔진의 반올림이 A = 1..30000 전부 같다.
   - (나) SPEC 문구를 유지: L_offer를 식 그대로 풀고, 분기 검사 허용 오차를 1¢로 넓히거나 accept 분기 손실을 정수가 아닌 값으로 허용 (인수 테스트의 `expectBranchesConsistent`와 지시서 4번 변경 필요). 이 경우 엔진 재작업 + `oracle.test.ts:97-102` 수정.
   - 어느 쪽이든 인수 테스트 기대값(1953¢ 등)은 바뀌지 않는다.
2. **원인 없음일 때 `all`의 모양.** 엔진은 허용된 수마다 `{ expectedLossCents: null, blockedBy: 'NO_CAUSE', apiMove: null, branches: [] }`를 넣는다. SPEC·types에는 `'NO_CAUSE'`가 없다 (`blockedBy`는 자유 문자열이라 계약 위반은 아님). 이대로 둘지(그러면 UI 문구 키가 필요), `all = []`로 할지, refund는 p_win 없이도 계산 가능하니 값을 보여줄지 결정 필요. 지시서 2번("계산하지 않고 `best = null`")과는 지금 구현이 맞는다.
3. **문제 2 (F2 문구)** 를 engine 레인 후속 수정으로 넘길지. 판정에는 영향이 없다.
