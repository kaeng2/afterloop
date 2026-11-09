# T018 검증 (2026-11-09 22:28 KST)
- 판정: **통과**
- 검증 대상: lane/engine `2f72aab` (구현 `fd5b755` + 보고 `2f72aab`, 범위 `c702bd1..HEAD`) · 기준 SPEC v2.1 (`SPEC.md` 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)`, 지시서 기준 SPEC과 같음)
- 방법: 코드·설정·테스트를 고치지 않았다. 스크립트는 worktree 밖 scratchpad(`verify-T018/`)에만 두었다. 구현 보고는 내 확인을 끝낸 뒤 마지막에 읽었다.

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-only c702bd1..HEAD` | — | — | 6개 파일: `reports/T018-impl.md`, `src/engine/escalation.ts`, `src/engine/params.ts`, `src/engine/plan.ts`, `tests/unit/escalation.test.ts`, `tests/unit/plan.test.ts`. 모두 지시서 "수정 가능 폴더" 안 |
| `git diff --name-only c702bd1..HEAD -- SPEC.md DECISIONS.md TASKS.md tasks src/types.ts tests/acceptance config package.json … src/ai src/paypal src/exec src/app seed scripts` | — | — | 0줄. 계약 파일·`config/`·`package.json`·다른 레인 폴더 변경 없음 |
| `git diff c702bd1..HEAD -- src/engine/params.ts` | — | — | +3 / −0. `export const nonNegativeIntSchema = count;` 한 줄과 주석뿐. 기존 스키마·함수는 그대로 |
| `git diff --numstat c702bd1..HEAD` | — | — | `plan.ts` +40 / −2, `tests/unit/plan.test.ts` +73 / −0 (기존 단위 테스트 삭제·수정 없음) |
| `npx vitest run tests/acceptance/ac07.escalation.test.ts` | 5 | 0 | AC7 4개 + AC10(확대 위험 결정론) 1개 |
| `npx vitest run tests/acceptance/ac04.plan.test.ts` | 5 | 0 | AC4 4개 + AC10(planMove 결정론) 1개 |
| `npx vitest run tests/acceptance/ac01-03.recommend.test.ts tests/acceptance/ac05-06-08.policy.test.ts tests/acceptance/ac09-10.general.test.ts` | 27 | 0 | T004 인수 테스트 11 + 9 + 7 그대로 |
| `npm test` | 276 | 0 | 8개 파일. `escalation.test.ts` 25개, `plan.test.ts` 34개 (T005 때 25개 + 9개) |
| `npx tsc --noEmit` | — | 0 | 출력 없음, 종료 코드 0 |
| `npm run test:acceptance` (전체) | 61 | 2 | 건너뜀 9. 실패 2개는 모두 `ac13.sandbox.test.ts` (아래 분류) |
| `npx eslint src/engine tests/unit` | — | 0 | 출력 없음 (지시 밖 추가 확인) |
| `npx tsx <scratchpad>/verify-T018/esc.ts` | 49 | 0 | 확대 위험 독립 재계산 (아래 표) |
| `npx tsx <scratchpad>/verify-T018/plan.ts` | 121 | 0 | `planMove` 시나리오 + T005 스냅숏 비교 (아래 표) |
| `npx vitest run --root <scratchpad>/verify-T018/strict` | 22 | 1 | **검증용 사본**(worktree 밖)에 `expectedLossCents` 값 비교 4줄을 넣고 잠금 테스트 원본을 그대로 돌린 것. AC4 두 번째 테스트만 실패 (아래 "알아 둘 사실") |

범위 밖 실패 분류 (`npm run test:acceptance`):
| 파일 | 실패 | 원인 | 담당 |
|---|---|---|---|
| `ac13.sandbox.test.ts` | `.env.example이 있고 PayPal 키 자리가 있다 (값은 비어 있음)`, `.env는 git이 무시하고 .env.example은 무시하지 않는다` | 저장소에 `.env.example`이 없고 git 무시 대상임. T005 검증 때와 같은 상태이고 T018 변경 파일과 무관 | paypal 레인 · 사람 |

## 독립 재계산·시나리오
독립 계산은 SPEC 7장 표와 지시서 동작 표를 scratchpad에 직접 옮긴 함수다 (엔진 코드를 import하지 않음).

### 확대 위험 (`escalationRisk`)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 전수 조합 | 카드사 2 × 두 번째 무응답 2 × 24시간 무응답 2 × 어조 3(true/false/null) × `hoursToDue` 8종(−10, 0, 48, 71.99, 72, 72.01, 100, 1e9) = 192건, 기본 가중치 (config, fixture 각각) | `score`·`band`·`parts` 전체가 독립 계산과 같음 | 192 / 192, 192 / 192 | 일치 |
| 전수 조합 (바꾼 rules) | 같은 192건 × 7종: 카드사 5 / `watchFrom` 1 / `watchFrom`·`highFrom` 1 / 가중치 전부 0 / 가중치·구간 전부 0 / (7, 11, 13, 17 · 20, 40) / `watchFrom` = `highFrom` = 3 | 식대로 | 1,344 / 1,344 (합계 1,728건 불일치 0) | 일치 |
| 서연 시작 | 카드사·무응답 둘 다·화난 어조·48시간 | 3 + 2 + 1 + 1 = 7, High | 7, High, parts [3, 2, 1, 1] | 일치 |
| 서연 답장 후 | 카드사만, 어조 `null`, 48시간 | 3 + 0 + 0 + 1 = 4, Watch | 4, Watch, parts [3, 0, 0, 1] | 일치 |
| 무응답 중복 | 답장 후 + 무응답 둘 다 / 두 번째만 / 24시간만 | 6 / 6 / 6 | 6 / 6 / 6 | 일치 |
| 구간 경계 | 기본 가중치로 점수 0~7을 하나씩 만듦 | 0·1·2 Low, 3·4 Watch, 5·6·7 High | 0:Low 1:Low 2:Low 3:Watch 4:Watch 5:High 6:High 7:High | 일치 |
| 72시간 경계 | 71.99 / 72 / 72.01 / −10 / 1e9 (전수 조합 안) | +1 / +1 / 0 / +1 / 0 | 같음 | 일치 |
| `parts` | 1,728건 전부 | 항상 4개, 순서 `cardCompanyMention, unanswered, angryTone, dueWithin72h`, 합 = `score`, 해당 없으면 0 | 같음. 반환 키는 `score, band, parts`뿐 | 일치 |
| 잘못된 신호 | `hoursToDue` NaN·Infinity·−Infinity·문자열 "48"·누락, 불리언 필드 누락·"true"·1·null, `angryTone` "angry"·누락, 신호 `null`·`undefined` (13건) | 예외 | 13건 모두 `ZodError` | 일치 |
| 잘못된 가중치 | 음수, 소수, NaN, Infinity, 문자열, `watchFrom` 음수, `highFrom` 4.5, `watchFrom` 6 > `highFrom` 5, 가중치 누락, `escalation` 없음, `rules = {}` (11건) | 예외 | 11건 모두 `ZodError` | 일치 |
| 허용되어야 하는 것 | `watchFrom` = `highFrom`, 가중치 0, `hoursToDue` −0.25 | 예외 없음 | 예외 없음 | 일치 |
| `rules` 생략 | 192건을 `rules` 없이 호출 | `config/rules.json` 가중치의 독립 계산과 같음 | 192 / 192 | 일치 |
| `rules` 생략이 실제로 파일을 읽는지 | scratchpad에 엔진 사본 + `config/rules.json` 사본(카드사 9, `highFrom` 12)을 두고 `rules` 없이 호출 | 9 + 2 + 1 + 1 = 13, High | 13, High | 일치 |
| 하드코딩 | `escalation.ts`에서 주석이 아닌 줄의 숫자 grep | 가중치·구간 숫자(3, 2, 1, 5) 없음, 72는 이름 붙인 상수 하나 | `const DUE_SOON_HOURS = 72;` (`escalation.ts:23`) 하나. 그 외 숫자는 `0`(해당 없는 신호 점수, 합의 초깃값)뿐 | 일치 |
| 결정론 | 192조합 × 100회 | 매번 같은 JSON | 불일치 0 / 19,200 | 일치 |
| 입력 불변 | 신호·rules를 깊게 얼려서 호출, 결과 객체를 고친 뒤 재호출 | 예외 없음, 입력 그대로, 다음 결과 그대로 | 같음 | 일치 |
| 금지 API | `Math.random`·`Date`·`performance.now` grep (`escalation.ts`, `plan.ts`) | 코드에 없음 | 주석 3줄에만 나옴 | 일치 |
| 참고 (지시서에 없는 동작) | 신호에 모르는 필드 추가 / `rules = null` | — | 무시하고 계산 / `config` 사용 | — |

### `planMove` 보강
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 제안 대상이 아닌 유형 | A1·A2·B3·F1 포함 B1·B2 외 14개 유형 × 합의/클레임 단계 보드에 ① 손으로 만든 offer 평가 ② B1 보드에서 만든 offer 평가, + D3(F1, 추적 있음) (57건) | 예외 | 57건 모두 `평가가 이 보드의 것이 아님 (… OFFER_SCOPE)` | 일치 |
| 원인 없는 보드 | 합의/클레임 단계 × 손으로 만든 offer·fight·refund, B1 보드의 offer 평가, 그 보드의 `recommend` 평가(차단됨) (14건) | 예외 | 14건 모두 예외 (`NO_CAUSE`) | 일치 |
| `allowedMoves`에 없는 수 | `make_offer` 없음 + offer, `accept_claim` 없음 + refund, 메시지·증빙 없음 + fight, `allowedMoves: []` + 3수 (7건) | 예외 | 7건 모두 `평가가 이 보드의 것이 아님 (… 이 보드에서 둘 수 없는 수)` | 일치 |
| `blockedBy`가 있는 평가 | 손으로 만든 차단 평가, 정상 평가에 `blockedBy`만 붙임, `apiMove: null` (4건) | 예외 | 4건 모두 예외 | 일치 |
| `apiMove`가 다시 계산한 것과 다름 | 합의 단계 보드 + fight/`provide_evidence`, 클레임 단계 보드 + fight/`send_message`, offer/`accept_claim`, refund/`make_offer`, fight/`make_offer` 등 (7건) | 예외 | 7건 모두 `… 이 보드의 실행 API는 <다시 계산한 값>` | 일치 |
| 0¢ 이하 제안 | A = 0·1·2·3¢ (x 0.15) × 평가 2종, x = 0 × 상품가 4종 (12건) | 예외 | 12건 모두 `제안 금액이 0¢ 이하…` | 일치 |
| 0¢ 경계 | A = 4¢ (0.6¢ → 1¢) / A = 0¢ 보드의 refund | 1¢ 계획 / T005와 같은 계획 | 같음 | 일치 |
| 한도 초과 | x 0.25, x 0.2000001 | 설정 오류 | `ZodError` | 일치 |
| 정상 흐름 (지시 범위) | B1·B2·A1·F1 × 상품가 4종(4800, 7200, 18900, 3500) × 합의/클레임 단계 × 추적 유무 = 보드 64개. `recommend(board)`의 `all` 각 평가와 `best`를 같은 보드로 넘김 | 예외 없음, 계획·`planId`가 T005(`c702bd1`)와 같음 | 계획 224건(그중 `best` 128건) 모두 T005와 같은 JSON. 새 구현만 예외 0. 차단 평가 32건은 둘 다 예외 | 일치 |
| 정상 흐름 (넓힘) | 16개 유형 × 상품가 4종 × 2단계 × 추적 유무 × x {0.15, 0.20, 0.10} (보드 768) / 16개 유형 × 금액 7종(4 ~ 999999) × `allowedMoves` 6종 × 추적 유무 (보드 1,344) | 같음 | 2,400건 / 3,052건 모두 T005와 같음, 다름 0, 새 구현만 예외 0. 수/API 4종(fight/`provide_evidence`, fight/`send_message`, offer/`make_offer`, refund/`accept_claim`) 모두 나옴 | 일치 |
| `params`·`rules` 생략 | D1의 3수를 설정 없이 계획 | T005와 같음 | `plan-PP-R-TEST-D1-fight-send_message-none-none`, `…-offer-make_offer-720-refund`, `…-refund-accept_claim-4800-refund` | 일치 |
| AC4 흐름 | D1, x 0.15로 만든 평가 → x 0.15 계획 / x 0.20 계획 | 720¢ / 960¢ | 720 / 960 (`plan-PP-R-TEST-D1-offer-make_offer-960-refund`, T005와 같음) | 일치 |
| 결정론·불변 | D1 offer 100회 / 보드·가정값·규칙·평가를 깊게 얼려서 호출 | 같은 JSON / 입력 그대로 | 같음 | 일치 |
| 다른 보드의 평가 (금액·유형이 다름) | 위 보드 64종의 차단 안 된 평가를 서로 다른 보드에 넘김 (10,080쌍) | 지시서 문구대로면 전부 예외 | 예외 3,072 (`OFFER_SCOPE` 1,024, 실행 API 불일치 2,048), **통과 7,008** (그중 평가의 기대 손실이 그 보드 값과 다른 것 5,696). 통과한 계획은 7,008건 모두 **그 보드 자신의 평가로 만든 계획과 같은 JSON** | **해석 필요** (아래) |
| `expectedLossCents: null`인데 `blockedBy`가 없는 손으로 만든 평가 | B1 보드 + `{refund, accept_claim, null}` / `{offer, make_offer, null}` | 지시서 1번 문구대로면 예외 | 계획이 만들어짐 (T005 때와 같은 동작) | **불일치 (병합 차단 아님)** |

### "알아 둘 사실": 값 비교와 AC4의 충돌
- **충돌은 사실이다.** `tests/acceptance/ac04.plan.test.ts:17`은 `recommend(D1_JIHO, P, R).best`(x 0.15)를 한 번 만들고, `:29`에서 그 평가를 `{ ...P, offerRate: 0.2 }`의 `planMove`에 넘겨 960을 기대한다. D1(A 4800¢, B1, 추적 없음)의 offer 기대 손실은 x 0.15에서 0.72 × 720 + 0.28 × 0.7 × 6300 + 200 = **1953**, x 0.20에서 0.72 × 960 + 1234.8 + 200 = **2126**이다 (엔진 값과 내 손계산이 같다).
- 직접 확인: worktree 밖 사본의 `assertEvaluationFromBoard`에 `current.expectedLossCents !== evaluation.expectedLossCents`면 예외를 던지는 4줄만 넣고 잠금 테스트 원본을 그대로 돌렸다. 결과는 `AC4 … x 0.20 (한도와 같음) → 960¢` **1개 실패** (`STRICT expectedLossCents 1953 != 2126`), 나머지 AC4 4개와 T004 18개(같이 넣은 2개 파일)는 통과. 지시서 "같이 고칠 것" 1번의 `expectedLossCents` 대조와 같은 지시서의 "AC4 … 그대로 통과"는 동시에 만족할 수 없다.
- 값 비교 없이 지시서의 목적이 달성되는지:
  - 지시서 2번이 이름으로 든 세 가지(제안 대상이 아닌 유형의 offer, 원인 없는 보드, `allowedMoves`에 없는 수)는 위 표의 78건에서 모두 예외다. 구현은 넘겨받은 평가가 아니라 **다시 계산한 평가**의 존재·`blockedBy`·`apiMove`를 본다 (`plan.ts:109-122`).
  - 계획의 모든 필드는 평가가 아니라 지금 보드·가정값·(수, 실행 API)에서 나온다 (`plan.ts:56-79, 137-143`). 그래서 값 비교가 없어 통과하는 낡은 평가 7,008건의 계획이 전부 "지금 보드에서 `recommend`를 새로 돌려 만든 계획"과 같았다. 실행되면 안 되는 계획이나 금액이 틀린 계획은 한 건도 나오지 않았다.
  - 남는 차이는 하나다: 판매자가 화면에서 본 기대 손실(낡은 평가의 숫자)과 지금 기대 손실이 다를 수 있는데 `planMove`가 이를 알려 주지 않는다. 계획 자체에는 기대 손실이 들어가지 않는다.
- 판단: 값 비교 생략은 잠금 테스트를 지킨 결과이고, 지시서의 차단 목적은 달성됐다. 실패 사유로 보지 않았다. 다만 "넘겨받은 평가의 `expectedLossCents`가 `null`인지"는 AC4와 충돌하지 않고도 볼 수 있는데 빠져 있다 (발견한 문제 1).

## SPEC·지시서 대조
| 조항 | 판정 | 근거 |
|---|---|---|
| SPEC 7장 표: 카드사 언급 +3 | 일치 | `escalation.ts:77, 85` (`weights.cardCompanyMention`), 전수 조합 |
| SPEC 7장: 무응답 두 신호는 둘 중 하나만 +2 | 일치 | `escalation.ts:78` (`||`), AC7 세 번째 테스트, 전수 조합 |
| SPEC 7장: 화난 어조 +1, 판매자 답장 뒤(`null`)는 0 | 일치 | `escalation.ts:79` (`=== true`). `null`과 `false`의 결과가 같음 |
| SPEC 7장: 응답 기한 72시간 이내 +1 | 일치 | `escalation.ts:23, 80` (`<= DUE_SOON_HOURS`). 72 포함, 72.01 제외, 음수 포함 (지시서 표) |
| SPEC 7장: 0~2 Low · 3~4 Watch · 5 이상 High | 일치 | `escalation.ts:88-89`. 점수 0~7 전부 확인 |
| SPEC 7장: 서연 7 (High) → 4 (Watch) | 일치 | AC7 5 / 5, 내 재계산 |
| 지시서: `export const escalationRisk: EscalationRiskFn` | 일치 | `escalation.ts:72`. `tsc` 오류 없음 |
| 지시서: `rules` 생략 시 `config/rules.json` | 일치 | `escalation.ts:74` → `params.ts:143-145`. 사본 config로 확인 (13점) |
| 지시서: `parts`는 네 신호를 이 순서로 항상 4개, 합 = `score` | 일치 | `escalation.ts:26, 83-87` |
| 지시서: zod 검증 (가중치 0 이상 정수, `watchFrom <= highFrom`, `hoursToDue` 유한) | 일치 | `escalation.ts:34-51, 57-63`. 잘못된 입력 24건 모두 `ZodError` |
| 지시서: 가중치·구간 숫자는 코드에 쓰지 않음, 72는 이름 붙인 상수 하나 | 일치 | grep 결과 `escalation.ts:23` 하나 |
| 지시서·CLAUDE.md: `Math.random`·`Date`·`performance.now` 금지, 입력 불변 | 일치 | grep, 동결 입력 |
| CLAUDE.md: 기준값은 `config/`에서 읽는다 (72시간) | 해석 필요 | 지시서가 상수로 두라고 정했고 구현은 그대로 따랐다. 컨트롤 타워 결정 2 |
| "같이 고칠 것" 1: 같은 보드·가정값·규칙으로 `recommend`를 다시 돌려 같은 `move`의 평가와 대조, 없거나 다르면 예외("평가가 이 보드의 것이 아님") | 해석 필요 | `plan.ts:108-123`. 존재·`blockedBy`·`apiMove`는 대조한다. `expectedLossCents`는 **다시 계산한 쪽이 null인지만** 보고(`plan.ts:117`) 넘겨받은 값과는 비교하지 않는다. 값 비교는 AC4와 충돌(위 절). 넘겨받은 평가의 `null` 여부는 충돌 없이 볼 수 있으나 빠짐 |
| "같이 고칠 것" 2: 제안 대상이 아닌 유형의 offer, 원인 없는 보드, `allowedMoves`에 없는 수 차단 | 일치 | 시나리오 78건 모두 예외 |
| "같이 고칠 것" 3: 0¢ 이하 offer 계획은 예외 | 일치 | `plan.ts:59-61`. A 0~3¢, x = 0. refund·fight는 건드리지 않음 |
| "같이 고칠 것": 계획을 만들기 전에 확인 | 일치 | `plan.ts:135`가 `movePlan`·`planIdFor`(`plan.ts:137-143`)보다 앞. 0¢ 검사는 `movePlan` 안이지만 계획을 돌려주기 전 |
| "같이 고칠 것": AC4·AC10·T004 27개·기존 단위 테스트 그대로, `planId` 형식과 정상 입력의 계획 불변 | 일치 | 인수 5 + 27 통과, 기존 단위 테스트 삭제 0줄, T005 스냅숏과 5,676건 동일 |
| "같이 고칠 것": 단위 테스트 추가 (다른 보드의 평가, 손으로 만든 평가, 0¢ 제안) | 일치 | `tests/unit/plan.test.ts:131-202` 9개 |
| SPEC 5장 "수 → API", `src/types.ts` `PlanMoveFn` ("차단됐거나 apiMove가 null인 평가면 예외") | 일치 | `plan.ts:133-134` 그대로. `apiMove` 불일치는 `plan.ts:120-122`에서 먼저 걸림 |
| SPEC 6장: 한도를 넘는 제안률은 설정 오류 | 일치 | `ZodError` (T005 동작 그대로) |
| 지시서 "수정 가능 폴더", `params.ts`는 export 추가만 | 일치 | diff 6개 파일, `params.ts` +3 / −0 |
| 지시서 "하지 않을 것" (어조 판별, 시간 계산, 서연 임시값 변경) | 일치 | `escalation.ts`는 신호 → 점수만. `config/`·`tests/acceptance/` 변경 없음 |
| 완료 기준: 단위 테스트 범위 (구간 2/3·4/5, 72·72.01·음수, 어조 세 값, 바꾼 rules, 잘못된 설정, 입력 불변) | 일치 | `tests/unit/escalation.test.ts` 25개에 모두 있음 |

## 발견한 문제
병합 차단: **없음**

| # | 심각도 | 문제 | 근거 |
|---|---|---|---|
| 1 | 병합 후 수정 | 손으로 만든 평가가 `expectedLossCents: null`인데 `blockedBy`가 없으면 여전히 계획이 만들어진다 (T005 검증 "발견한 문제" 5번이 그대로 남음). `plan.ts:117`은 다시 계산한 평가의 `null`만 보는데, `recommend`는 `blockedBy` 없이 `null`을 만들지 않으므로 이 줄은 실제로는 닿지 않는다. 넘겨받은 평가의 `null` 검사는 AC4와 충돌하지 않는다. 만들어지는 계획 자체는 정상 계획과 같다 (금액 720 / 4800) | scratchpad `probe.ts`: `{refund, accept_claim, null}` → `plan-…-refund-accept_claim-4800-refund`. 구현 보고 "남은 문제" 마지막 줄은 "`recommend`가 만든 평가 경로에서는 닫혔다"고만 적음 |
| 2 | 의견 (결정 1과 연결) | 값 비교가 없어, 금액·유형이 다른 보드에서 만든 평가도 그 수가 지금 보드에서 둘 수 있는 수면 통과한다 (10,080쌍 중 7,008쌍). 계획 내용은 모두 지금 보드 기준이라 틀린 계획은 없다. 화면이 보여 준 기대 손실과 지금 값이 다를 수 있다는 점만 남는다 | scratchpad `plan.ts` C절. 예: B1 $48의 offer 평가(1953) → B2 $35 보드 → 525¢ 계획 (그 보드의 기대 손실은 1558) |
| 3 | 의견 | x = 0이면 `recommend`의 `best`가 offer(기대 손실 1435)인데 `planMove(best)`는 0¢ 예외를 던진다. A ≤ 3¢인 B1·B2 보드의 offer 평가도 같다 (그때 `best`는 refund). 지시서 3번대로의 동작이고 실제 설정(x 0.15)·실제 금액에서는 나오지 않는다. `recommend`는 이번 범위가 아니다 | scratchpad `probe.ts` |
| 4 | 의견 | `planMove`가 호출마다 `recommend`를 한 번 더 돈다 (오토파일럿 판정 포함). 측정: 1회 평균 약 25µs (T005 약 10µs). 부작용(로그·전역 상태)은 없다 | `plan.ts:109`, scratchpad `probe.ts` |
| 5 | 의견 | `recommend`·`planMove` 경로의 `PolicyConfigSchema`는 `escalation` 값을 `z.number()`로만 본다. 같은 `rules`(카드사 −1.5, `watchFrom` 9 > `highFrom` 2)를 `recommend`는 받아들이고 `escalationRisk`는 `ZodError`를 던진다. 반대로 `escalationRisk`는 `rules.escalation`만 보므로 다른 절(`offer` 등)이 없는 `rules`도 받아들인다 | `params.ts:81-88`, `escalation.ts:74`, scratchpad `probe2.ts` |
| 6 | 의견 | 구현 보고의 사소한 부정확: ① 실패한 AC13 테스트 이름을 "`.env.example이 있고 자리표시자만 들어 있다`"로 적었으나 실제 이름은 "`.env.example이 있고 PayPal 키 자리가 있다 (값은 비어 있음)`" ② 결정 1의 "`tests/unit/plan.test.ts:136`의 '한도와 같은 0.20은 통과' 사례"는 그 줄에 없다 (0.20을 쓰는 테스트는 `:173-180`). 숫자(통과·실패 개수, +/− 줄 수, 1953·2126)는 내 실행 결과와 모두 같다 | `reports/T018-impl.md` |

단위 테스트의 질 (의견):
- 좋은 점: `escalation.test.ts`는 기본 가중치 테스트와 별도로 가중치를 서로 다른 값(10, 4, 2, 3)으로 바꿔 `parts`를 `[10, 0, 2, 3]`으로 단언하므로, 값이 같은 두 가중치(어조 1, 기한 1)를 뒤바꿔 읽는 실수가 드러난다. 구간 경계(2/3, 4/5), `watchFrom` = `highFrom`, 72 / 72.01 / 음수, 어조 세 값, 동결 입력, 결과 변조 뒤 재호출까지 있다. `plan.test.ts`의 새 9개는 예외 문구(`OFFER_SCOPE`, `NO_CAUSE`, `보드의 것이 아님`, `0¢`)를 정규식으로 구분해서, 엉뚱한 이유로 던진 예외를 통과로 세지 않는다.
- 약한 점: "`rules`를 안 넘기면 `config/rules.json`을 쓴다"는 기대값도 `rulesFromConfig()`에서 와서, 기본 경로가 다른 파일을 읽어도 값이 같으면 통과한다 (나는 사본 config로 따로 확인했다). `R`이 라이브 `config/rules.json`이라 리터럴 기대값(1, 2, 3, 7) 테스트는 설정값을 바꾸면 깨진다.
- 빠진 경계: 71.99, 제안 대상이 아닌 유형 중 A1 외(F1·B3), 클레임 단계 보드, 원인 없는 보드의 fight·refund, `expectedLossCents: null` 평가(발견 1), 금액이 다른 보드의 refund·fight 평가가 통과한다는 사실(발견 2의 동작을 고정하는 테스트는 가정값이 다른 경우 하나뿐: `plan.test.ts:173-180`).
- 참고: `plan.test.ts:173-180`는 "낡은 평가를 막지 않는다"를 고정한다. 결정 1에서 값 비교를 넣기로 하면 AC4와 함께 이 테스트도 바꿔야 한다.

## 컨트롤 타워가 결정할 것
1. **`planMove`의 `expectedLossCents` 값 대조 (지시서 "같이 고칠 것" 1번 vs 잠금 테스트 AC4).** 확인한 사실: 값 비교를 넣으면 `ac04.plan.test.ts:29`가 실패한다 (1953 ≠ 2126, 사본으로 실행 확인). 값 비교 없이도 지시서 2번의 세 가지 차단과 0¢ 차단은 모두 동작하고, 통과하는 낡은 평가의 계획은 전부 지금 보드 기준 계획과 같다. 선택지:
   - ① 지금 구현을 그대로 둔다 (지시서 1번의 `expectedLossCents` 문구를 정정). 계약 변경 없음.
   - ② 값 일치까지 요구한다. AC4 두 번째 테스트를 "x 0.20으로 평가를 다시 만든 뒤 계획"으로 바꿔야 하므로 인수 테스트 변경(사람 승인) + `tests/unit/plan.test.ts:173-180` 수정 + engine 후속 작업이 필요하다.
   - ③ 중간: 넘겨받은 평가의 `expectedLossCents`가 `null`인 경우만 예외로 한다 (발견 1). AC4와 충돌하지 않는다. engine 후속 한 줄.
   - 화면(T009·T010)이 "분쟁을 다시 불러오면 평가도 다시 만든다"를 지키면 ①로도 화면의 기대 손실과 계획이 어긋나지 않는다.
2. **72시간 기준을 `PolicyConfig`로 옮길지.** 확인한 사실: 지금은 `src/engine/escalation.ts:23`의 상수 하나다 (지시서 지시). `config/rules.json`과 `src/types.ts`의 `EscalationWeights`에는 시간 값 필드가 없고, 가중치 필드 이름 자체가 `dueWithin72h`라 72가 계약 이름에 들어 있다. 선택지: ① 그대로 둔다 ② `EscalationWeights`에 시간 필드를 더한다 (`src/types.ts`·`config/rules.json`·`rules.fixture.json` 변경 = 계약 변경, SPEC 버전 올림. 필드 이름 `dueWithin72h`와 값이 어긋날 수 있다는 점도 같이 정해야 함).
3. **`PolicyConfigSchema`의 `escalation` 검증을 조일지.** 확인한 사실: 발견 5. 지금 `escalation`을 읽는 코드는 `escalationRisk`뿐이라 (`src/` grep: `types.ts`, `params.ts`, `escalation.ts`) 실제 계산에 미치는 영향은 없다. 선택지: ① 그대로 둔다 ② `params.ts`의 `PolicyConfigSchema.escalation`을 0 이상 정수 + `watchFrom <= highFrom`으로 조인다 (잘못된 `escalation`이 든 `rules`에서 `recommend`·`planMove`도 예외를 던지게 되므로 기존 동작 변경, 별도 engine 작업).
4. **발견 3 (x = 0 또는 A ≤ 3¢에서 `recommend`는 offer를 평가·추천하는데 `planMove`는 거부).** 실제 설정·금액에서는 나오지 않는다. 맞추려면 `recommend`가 0¢ 제안을 `blockedBy`로 빼도록 하는 engine 작업이 필요하다 (T004 인수 테스트 영향 여부 확인 필요). 데모 범위에서는 그대로 두어도 된다.
