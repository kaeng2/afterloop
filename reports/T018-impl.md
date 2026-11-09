# T018 보고 (2026-11-09 22:25)

- 기준 SPEC: v2.1   (시작할 때 SPEC.md 첫 줄과 같았는지: 예 — `# SPEC v2.1 (2026-11-09 21:02 KST)`)
- 브랜치 / 마지막 커밋: lane/engine / `fd5b755` (구현) + 이 보고서 커밋

## 결과
완료 — 확대 위험 점수 `escalationRisk`를 새로 만들고(AC7 5/5 통과), "같이 고칠 것"의 `planMove` 평가-보드 대조와 0¢ 제안 차단을 넣었다. AC4·AC10과 T004 인수 테스트 27개, 기존 단위 테스트는 그대로 통과한다. 다만 지시서 "같이 고칠 것" 1번의 `expectedLossCents` **값 일치** 검사는 넣지 못했다 (인수 테스트 AC4가 낡은 가정값으로 만든 평가를 넘기기 때문. 아래 "컨트롤 타워에 요청할 결정" 1번).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/escalation.ts` (새 파일) | `escalationRisk(signals, rules?)`. 신호 4개 → `score`·`band`·`parts`(항상 4개, 고정 순서). 가중치·구간 기준은 `rules.escalation`에서만 읽는다. zod 검증: 가중치 0 이상 정수, `watchFrom <= highFrom`, `hoursToDue` 유한한 수, `angryTone`은 `boolean \| null`. 72시간 기준만 이 파일의 상수 `DUE_SOON_HOURS` |
| `src/engine/params.ts` | `export const nonNegativeIntSchema = count;` 한 줄 + 주석 추가 (기존 스키마·함수·동작 그대로. +3 / −0) |
| `src/engine/plan.ts` | `assertEvaluationFromBoard`: 같은 `board`·`params`·`rules`로 `recommend`를 다시 돌려 같은 수의 평가가 ① 있고 ② 차단되지 않았고(`blockedBy`·`expectedLossCents !== null`) ③ 실행 API가 같은지 확인하고, 어기면 예외("평가가 이 보드의 것이 아님"). offer 금액이 0¢ 이하면 예외. (+40 / −2) |
| `tests/unit/escalation.test.ts` (새 파일) | 25개: 신호별 점수, 무응답 한 번만, 어조 3값, 72시간 경계(72·72.01·73·0·−0.5·−48), 구간 경계(2/3, 4/5, `watchFrom == highFrom`), 가중치·구간을 바꾼 rules, rules 생략, `parts` 순서·합, 잘못된 설정·신호 예외, 동결 입력 불변·결과 변조 |
| `tests/unit/plan.test.ts` | 9개 추가 (삭제 0줄): A1 보드에 다른 보드/손으로 만든 offer 평가, 원인 없는 보드, `allowedMoves`에 없는 수, 실행 API 불일치, 같은 보드 평가 3종 정상, 낡은 가정값 평가(AC4 동작 고정), 0¢ 제안 3종 |

`config/`, `src/types.ts`, `tests/acceptance/`, `src/ai/`는 건드리지 않았다 (`git status` 기준 바뀐 파일 5개뿐).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac07.escalation.test.ts` | 5 | 0 | 서연 시작 7(High), 답장 후 4(Watch), 무응답 두 신호 +2, `parts` 합 = `score`, 결정론 100회 |
| `npx vitest run tests/acceptance/ac04.plan.test.ts` | 5 | 0 | AC4 4개 + AC10 planMove 결정론 (변경 전과 같음) |
| `npx vitest run` AC1-3·AC5-6-8·AC9-10 | 27 | 0 | T004 인수 테스트 27개 그대로 (11 + 9 + 7) |
| `npm run test:acceptance` (전체) | 61 | 2 (건너뜀 9) | 실패 2개는 `ac13.sandbox.test.ts`: `.env.example` 없음 / `.env.example`이 git 무시 대상. T005 검증 보고와 같은 상태이고 이 작업과 무관하다 (paypal 레인 · 사람). `ac07`·`ac14`는 이제 통과 |
| `npm test` | 276 | 0 | 변경 전 242 + escalation 25 + plan 9. 8개 파일 전부 통과 |
| `npx tsc --noEmit` | — | 0 | 출력 없음 (T005 검증 때 있던 `@/engine/escalation` TS2307이 사라졌다) |
| `npx eslint src/engine tests/unit` | — | 0 | 출력 없음 (지시 밖 추가 확인) |

실패한 인수 테스트 2개: `AC13 샌드박스 세팅: 오프라인 확인 > .env.example이 있고 자리표시자만 들어 있다`, `… > .env는 git이 무시하고 .env.example은 무시하지 않는다`. 원인은 저장소에 `.env.example`이 없고 `.gitignore`가 `.env*`를 무시하는 것으로, engine 레인 범위 밖이다.

## 남은 문제
- `planMove`의 평가 대조가 `expectedLossCents` **값**은 보지 않는다. 그래서 손으로 만든 평가의 기대 손실 숫자가 틀려도(예: 1¢) 계획은 만들어진다. 계획에는 기대 손실이 들어가지 않고 금액은 지금 보드·가정값에서 다시 계산하므로 계획 내용은 틀리지 않지만, "화면이 보여 준 기대 손실"과 "지금 기대 손실"이 다를 수 있다는 점은 남는다 (아래 결정 1).
- `planMove`가 호출마다 `recommend`를 한 번 더 돈다. 분쟁 1건 기준 비용은 무시할 수준이고(단위 테스트 34개 46ms) 결과·`planId`는 그대로지만, 목록 화면에서 분쟁마다 계획을 만들면 평가 계산이 두 번씩 일어난다.
- 72시간 기준이 `config/`가 아니라 `src/engine/escalation.ts`의 상수(`DUE_SOON_HOURS`)에 있다. 지시서가 그렇게 정했지만 CLAUDE.md "기준값은 `config/`에서 읽는다"와는 어긋난다 (아래 결정 2).
- `escalationRisk`는 `rules.escalation`만 검증한다 (`PolicyConfigSchema` 전체를 쓰지 않는다). 전체를 쓰면 가중치 검증이 느슨한 쪽(`z.number()`)으로 돌아가고, `PolicyConfigSchema`를 조이면 `recommend`·`planMove`의 기존 동작이 바뀌어서 그렇게 했다 (지시서: `params.ts`는 export 추가만).
- T005 검증 보고의 "발견한 문제" 중 3번(planId·`PayPal-Request-Id` 길이), 4번(예외 문구가 한국어), 5번(`expectedLossCents: null` 평가)은 이번 범위가 아니라 그대로다. 5번은 보드 대조에서 `expectedLossCents === null`을 함께 막으므로 `recommend`가 만든 평가 경로에서는 닫혔다.

## 컨트롤 타워에 요청할 결정
1. **`expectedLossCents` 값 일치 검사는 인수 테스트 AC4와 충돌한다.** 지시서 "같이 고칠 것" 1번은 평가의 `apiMove`·`expectedLossCents`·`blockedBy`가 모두 같은 보드·가정값·규칙의 `recommend` 결과와 일치하라고 했다. 그런데 `tests/acceptance/ac04.plan.test.ts:17,29`는 `offerRate` 0.15로 만든 평가를 `offerRate` 0.20으로 `planMove`에 넘겨 금액 960¢를 기대한다. 같은 보드(D1, A = 4800¢, B1)에서 offer의 기대 손실은 x 0.15면 1953¢, x 0.20이면 2126¢라서 값을 비교하면 이 테스트가 예외로 떨어진다 (`tests/unit/plan.test.ts:136`의 "한도와 같은 0.20은 통과" 사례도 같다). T005 검증 보고도 낡은 가정값의 평가를 받아들이는 지금 동작을 "일치"로 판정했다(보고 47~86행 "낡은 평가" 줄). 그래서 **값 비교는 넣지 않고** 수 존재·차단 여부·실행 API만 대조했다. 지시서가 요구한 효과(제안 대상이 아닌 유형의 offer, 원인 없는 보드, `allowedMoves`에 없는 수 차단)는 모두 막힌다. 값 일치까지 요구하려면 AC4의 기대값(`x 0.20 → 960`)을 "평가도 같은 가정값으로 다시 만든다"로 바꾸는 인수 테스트 수정이 필요하다. 어느 쪽을 택할지 결정해 주기 바란다.
2. **확대 위험의 72시간 기준을 `PolicyConfig`에 넣을지.** 지금은 `src/engine/escalation.ts`의 상수다(지시서 지시). `EscalationWeights`에 `dueSoonHours: 72` 같은 필드를 더하면 `config/rules.json`에서 읽을 수 있고 CLAUDE.md 공통 규칙과도 맞는다. `src/types.ts`·`config/rules.json` 변경이므로 계약 변경이다. 화면에서 "72시간 이내" 문구를 쓰는 쪽(T009·T010)과 같이 보는 편이 좋다.
3. **확대 위험 가중치 검증을 `PolicyConfigSchema`에도 적용할지.** `src/engine/params.ts`의 `PolicyConfigSchema`는 `escalation` 값을 `z.number()`로만 본다(소수·음수 통과). `escalation.ts`는 0 이상 정수로 조여서 보지만, `recommend`·`planMove` 경로에서는 느슨한 쪽이 그대로 쓰인다. 지금은 `escalation`을 쓰는 곳이 `escalationRisk`뿐이라 실제 영향은 없다. 조이려면 기존 동작 변경이라 별 태스크로 지시해 주기 바란다 (이번 지시서는 `params.ts`에 export 추가만 허용).
