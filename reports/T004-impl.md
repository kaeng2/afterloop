# T004 보고 (2026-11-09 21:14)

- 기준 SPEC: v2.1 (시작할 때 SPEC.md 첫 줄과 같았는지: 예 — `SPEC v2.1 (2026-11-09 21:02 KST)`)
- 브랜치 / 마지막 커밋: lane/engine / `d2c8106` (보고서 커밋은 그 뒤)
- 작업 폴더: `afterloop-wt/engine` (worktree, 잠금 적용)

## 결과
완료 — `recommend(board, params?, rules?)`를 SPEC v2.1 5장·6장 기준으로 새로 썼다 (v0 파일은 구조만 참고). T004 인수 테스트 27개와 자기 단위 테스트 66개가 통과하고, `npx tsc --noEmit`에 내 파일 오류는 없다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/params.ts` | `config/params.json`·`config/rules.json` 읽기, zod 스키마(보드·가정값·규칙), 제안률 한도 검사. 값은 전부 config에서 온다 |
| `src/engine/oracle.ts` | L_fight·L_offer·L_refund, p_win 선택(추적 기록), 트리 분기, 센트 사사오입(`roundCents`) |
| `src/engine/policy.ts` | 수 → API 표, `allowedMoves` 필터, 제안 대상(B1·B2) 판정, 동점 처리(`pickBest`), 차단 상수 `BLOCKED` |
| `src/engine/autopilot.ts` | 6장 규칙 5개를 순서대로 적용, 영어 로그 문구(`reason`) |
| `src/engine/recommend.ts` | 공개 함수 `recommend` (`RecommendFn`). 검증 → 평가 → 추천 → 오토파일럿 |
| `tests/unit/oracle.test.ts` | 반올림, p_win 선택, 식, 분기 불변식(금액 12종 × p_win 7종) — 26개 |
| `tests/unit/recommend.test.ts` | config 기본값 경로, zod 오류 7종, 원인 없음, API 필터, 동점, 불변 — 23개 |
| `tests/unit/autopilot.test.ts` | 규칙 순서, 기준값 읽기, 로그 문구 형식 — 17개 |

수정 가능 폴더(`src/engine/`, `tests/unit/`) 밖은 건드리지 않았다. `config/params.json`·`config/rules.json`은 값을 바꾸지 않았다(읽기만).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac01-03.recommend.test.ts tests/acceptance/ac05-06-08.policy.test.ts tests/acceptance/ac09-10.general.test.ts` | 27 | 0 | T004 완료 기준의 27개 |
| `npm run test:acceptance` (전체) | 27 | 2 (+5 파일 import 실패) | 실패는 모두 다른 태스크 몫 (아래) |
| `npm test` | 66 | 0 | `tests/unit/` 3개 파일 |
| `npx tsc --noEmit` | — | 0 (내 파일) | 남은 오류 4건은 아직 없는 모듈 import (아래) |
| `npm run lint` | — | 0 | 경고 없음 |

전체 인수 테스트에서 통과하지 못한 항목은 모두 아직 구현되지 않은 다른 레인·태스크의 모듈이다. 내가 만든 파일 때문이 아니다.
- `ac04.plan.test.ts` → `@/engine/plan` 없음 (T005)
- `ac07.escalation.test.ts` → `@/engine/escalation` 없음 (T018)
- `ac11-12.exec.test.ts` → `@/exec/execute` 없음 (paypal 레인)
- `ac14.client.test.ts` → `@/paypal/client` 없음 (paypal 레인)
- `ac13.sandbox.test.ts` → `.env.example`·`tests/sandbox/manifest.json` 등 샌드박스 세팅 (사람·paypal 레인)

`npx tsc --noEmit`의 오류 4건도 같은 4개 모듈의 `TS2307: Cannot find module`이다.

### 확인한 핵심 기대값
- AC1 D1 박지호($48, B1, 추적 없음): fight 4610¢ / offer 1953¢ / refund 5000¢, 추천 offer(`make_offer`), 오토파일럿 `awaiting_approval` / `money_moves`
- AC2 D3 buyer_m($35, F1, 추적·배송 완료): fight 1200¢ / refund 3700¢, offer `OFFER_SCOPE`(null·분기 없음), 추천 fight(`send_message`), 오토파일럿 `skipped` / `suspected_abuse`
- AC3 B1 ↔ F1만 바꾸면 판정이 `awaiting_approval` ↔ `skipped`로 바뀜
- AC9 `make_offer`가 없으면 offer 평가 자체가 빠지고, `allowedMoves`가 비면 `all = []`·`best = null`
- AC10 100회 결정론, `Math.random`·`Date.now` 미호출, 입력 객체 불변

## 구현에서 내린 판단 (SPEC에 적혀 있지 않아 고른 것)
1. **제안 금액 x·A를 먼저 센트로 반올림한다.** SPEC 5장은 "식을 그대로 푼 뒤 마지막에 사사오입"이면서 동시에 트리 분기가 `Σ 확률 × lossCents = expectedLossCents`(오차 0.5¢ 이내)여야 한다고 요구한다. x·A가 정수 센트가 아닌 금액(예: A = 1050¢ → 157.5¢)에서는 두 요구가 충돌한다. 분기 금액을 센트 정수로 반올림하면 가중합 오차(최대 0.36¢)와 합계 반올림 오차(최대 0.5¢)가 겹쳐 0.5¢를 넘기 때문이다(실측 A = 1050¢에서 0.76¢).
   그래서 **실제로 PayPal로 보내는 돈인 x·A만 식에 넣기 전에 센트로 사사오입**했다. 이렇게 하면 분기 불변식이 항상 정확히 성립하고, 분기 금액도 센트 정수로 남는다. AC1($48, x·A = 720¢처럼 x·A가 이미 정수인 금액)에서는 식을 그대로 푼 값과 완전히 같다(1953¢). 차이가 생기는 경우에도 L_offer는 최대 1¢다.
   T005의 `planMove`가 제안 금액을 `Math.round(x·A)`로 만들면 화면 금액과 기대 손실이 완전히 일치한다 (AC4의 720¢·960¢는 양쪽 다 같다).
2. **원인이 없으면(`board.cause` 없음) 세 수 모두 `expectedLossCents: null`, `blockedBy: 'NO_CAUSE'`.** 지시서 2번의 "원인이 없으면 계산하지 않고 `best = null`"을 그대로 따랐다. refund는 p_win 없이도 계산할 수 있지만, 계산하면 `best`가 refund가 되어 "`best = null`"과 어긋난다. `OFFER_SCOPE`처럼 `blockedBy`는 자유 문자열이라 계약 변경은 아니다 (`BLOCKED` 상수로 모았다).
3. **차단된 offer의 `apiMove`는 `null`.** SPEC 5장 표의 offer → `make_offer` 조건이 "허용 + B1·B2"이므로 B1·B2가 아니면 부를 API가 없다고 봤다. `all`에서 빼는 기준은 SPEC대로 `allowedMoves`에만 두어서, `make_offer`가 허용된 F1 건(AC2)에서는 차단 표시로 남는다.
4. **`AutopilotDecision.verdict: 'auto'`(`common_questions`)는 `recommend`가 내지 않는다.** SPEC 6장 표의 마지막 줄은 "분쟁이 아닌 자주 묻는 질문"이고 `recommend`의 입력은 항상 분쟁(`BoardState`)이다. 받은 메일을 다루는 쪽에서 판정할 몫으로 남겼다.
5. **로그 문구(`reason`)는 영어 한 문장, 숫자만 코드가 채운다** (원문 8장 S4 문체). 구매자 이름·이메일·분쟁 ID는 넣지 않는다. 예: `Waiting for your approval: offer is the lowest expected-loss option ($19.53) and it moves money.` / `Skipped: cause F1 is suspected abuse (3rd "not received" claim with delivery proof), so autopilot never acts on this dispute.`

## 남은 문제
- `pWinWithTracking`은 A1·A2·A3·A4·F1만 있고, 나머지 유형은 추적 기록이 있어도 `pWin` 기본값을 쓴다 (지시서 2번 그대로, SPEC 13장 Q5 미확정). 값 추가는 config 소유자(engine 레인) 판단이 아니라 Q5 확정 사항이라 건드리지 않았다.
- `escalation`(T018)·`plan`(T005)·`sim`(T015)은 범위 밖이라 만들지 않았다. `src/engine/params.ts`의 스키마·로더는 그 태스크들이 그대로 쓸 수 있게 `resolveEngineInput`으로 묶어 두었다.

## 컨트롤 타워에 요청할 결정
- **(확인만 필요, 막힘 아님) SPEC 5장 반올림 문구.** 위 "구현에서 내린 판단" 1번. 지금 SPEC은 "식을 그대로 푼 뒤 마지막에 사사오입"과 "분기 합 오차 0.5¢ 이내"를 함께 요구하는데, 제안 금액 x·A가 정수 센트가 아닌 금액에서는 둘이 동시에 성립할 수 없다. 엔진은 "x·A를 먼저 센트로 반올림한다"로 구현했다. 인수 테스트 기대값은 바뀌지 않으므로 계약 변경은 필요 없지만, SPEC 5장에 한 줄("제안 금액 x·A는 센트 정수로 반올림한 뒤 식에 넣는다")을 넣으면 다음 세션이 헷갈리지 않는다. 넣을지 여부는 컨트롤 타워가 결정.
- **(공유) 원인 없음 차단 이유 `NO_CAUSE`**를 새로 썼다 (`blockedBy`는 자유 문자열). UI(T0xx)가 문구를 붙여야 하면 `config/copy.*.json`에 이 키가 필요하다.
- 그 밖에 계약(`src/types.ts`)·인수 테스트·SPEC을 바꿔야 할 사항은 없음.
