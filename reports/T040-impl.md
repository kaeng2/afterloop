# T040 보고 (2026-11-10 10:52)

- 기준 SPEC: v2.4 (시작할 때 `SPEC.md` 첫 줄과 같았는지: **예** — `# SPEC v2.4 (2026-11-10 10:44 KST)`)
- 브랜치 / 마지막 커밋: lane/engine / `f965e25`

## 결과
완료 — `fightApiMove`를 SPEC v2.4 5장 "수 → API" 표 순서로 고쳤다. 합의 단계(`INQUIRY`)이고 `send_message`가 허용되면 `provide_evidence` 링크가 함께 있어도 `send_message`를 고른다. 실패하던 AC8 1건이 통과하고, 기대 손실 숫자는 어디서도 바뀌지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/policy.ts` | `fightApiMove`를 표 순서 4단계로 고침 (INQUIRY+send_message → send_message → provide_evidence → send_message → null). 주석을 v2.4·Q15 기준으로 갱신 |
| `tests/unit/recommend.test.ts` | 링크 구성 4종 × 단계 4종 매트릭스 + 단계별 기대 손실 동일 확인 테스트 5건 추가 |
| `tests/unit/plan.test.ts` | `provide_evidence` 계획을 보는 기존 3건을 `stage: 'CHARGEBACK'` 보드로 옮김 (아래 "기대값을 바꾼 곳"), 합의 단계 `send_message` 계획 1건 추가 |

고친 로직:

```ts
const canSendMessage = board.allowedMoves.includes('send_message');
if (board.stage === 'INQUIRY' && canSendMessage) return 'send_message';
if (board.allowedMoves.includes('provide_evidence')) return 'provide_evidence';
if (canSendMessage) return 'send_message';
return null;
```

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 122 | 0 | 9건 skip (샌드박스 실호출). 작업 전 실패했던 AC8 "합의 단계에 증빙 링크와 메시지 링크가 함께 있으면: fight는 send_message"가 통과 |
| `npm test` | 1057 | 0 | 변경 전 1048 통과 / 3 실패 (모두 `apiMove` 단정) |
| `npx tsc --noEmit` | OK | — | |
| `npm run lint` | OK | — | eslint 경고 없음 |

## 기대 손실이 바뀌지 않았다는 근거
지시서의 "어떤 수의 `expectedLossCents`도 바뀌면 안 된다"를 세 가지로 확인했다.

1. **`null` 조건이 그대로다.** 전: `provide_evidence`도 `send_message`도 없을 때만 `null`. 후: 같은 조건에서만 `null` (앞의 두 분기는 각각 `send_message`·`provide_evidence`가 허용될 때만 값을 낸다). `recommend`·`sim`은 `apiMove === null`인 수만 `all`에서 빼므로 **목록에 남는 수의 집합이 바뀌지 않는다.** 바뀌는 것은 남은 `fight` 수의 `apiMove` 문자열 하나뿐이다.
2. **`stage`는 숫자 계산에 쓰이지 않는다.** `src/` 전체에서 `stage`를 읽는 곳은 `types.ts`(타입), `params.ts`(zod enum), `paypal/mapper.ts`(변환), `sim.ts`(보드 생성 `'INQUIRY'`)뿐이고, `oracle.ts`·`recommend.ts`·`plan.ts`의 계산식에는 없다. 그래서 테스트에서 보드의 `stage`를 바꿔도 기대 손실·제안 금액이 달라지지 않는다. 이 성질을 회귀 테스트로 고정해 두었다 (`recommend.test.ts` "단계만 다른 보드는 기대 손실이 같다").
3. **숫자 기대값을 하나도 고치지 않았다.** 단위 1057건 + 인수 122건의 모든 금액·확률·`planId` 기대값이 그대로 통과한다. 변경 전 깨진 3건도 전부 `apiMove` 문자열 단정이었다 (금액·기대 손실 단정은 0건).

## 시뮬레이션
`simulate`의 보드는 `stage: 'INQUIRY'` + 네 링크 전부 허용이라, 그 안의 `fight` `apiMove`는 `provide_evidence` → `send_message`로 바뀐다. 다만 `sim.ts`에서 `apiMove`는 `settleMoveFor`가 평가를 만들 때 담기만 하고, 수를 고르는 `pickBest`는 `blockedBy`와 `expectedLossCents`만 본다. `send_message`도 `provide_evidence`도 `null`이 아니므로 고르는 수가 같다. `tests/unit/sim.test.ts` 38건(100회 결정론 테스트 포함)이 **기대값 변경 없이** 통과했고, 그 파일에는 `apiMove` 단정이 없다. 결과 숫자는 하나도 바뀌지 않았다.

## 기대값을 바꾼 곳과 이유
`plan.test.ts`의 3건은 **합의 단계 보드에서 `provide_evidence`를 기대하던** 테스트다. v2.4에서는 합의 단계 + 두 링크면 `send_message`가 맞으므로 그대로 둘 수 없다. 기대값(`provide_evidence`)을 `send_message`로 바꾸면 세 테스트가 각각 잃는 커버리지가 있어서 — 각각 `plan.ts`의 `provide_evidence` 계획 생성, 실행 API 불일치 예외, `apiMove`에 따라 `planId`가 달라지는지를 본다 — **기대값은 그대로 두고 보드를 `stage: 'CHARGEBACK'`으로 옮겼다.** 위 2번대로 `stage`는 숫자에 영향이 없어서 금액·`planId` 기대값은 손대지 않았다.

| 테스트 | 바꾼 것 | 이유 |
|---|---|---|
| `수별 계획` > `증빙 링크가 있으면 fight는 provide_evidence로 계획한다` | 보드에 `stage: 'CHARGEBACK'` 추가, 이름을 "합의 단계가 아니고 증빙 링크가 있으면…"으로 | 합의 단계에서는 더 이상 `provide_evidence`가 나오지 않는다. `plan.ts`가 `provide_evidence`를 계획으로 만드는지 보는 커버리지를 유지 |
| `평가가 이 보드의 것인지…` > `이 보드의 실행 API와 다른 평가를 넘기면 예외` | 같음 (`stage: 'CHARGEBACK'`) | 두 보드의 `apiMove`가 달라야 불일치 예외를 볼 수 있다. 둘 다 합의 단계면 모두 `send_message`가 되어 테스트가 성립하지 않는다 |
| `planId` > `실행 API가 다르면 다른 값` | 같음 (`stage: 'CHARGEBACK'`) | 같은 이유. 합의 단계면 두 `planId`가 같아진다 |

새로 추가한 단위 테스트 (지시서 완료 기준의 4경우 × 4단계):

| 테스트 | 보는 것 |
|---|---|
| `두 링크가 함께 있으면: 합의 단계만 send_message, 나머지 단계는 provide_evidence` | 경우 1·2, 단계 4종 |
| `증빙 링크만 있으면: 모든 단계에서 provide_evidence` | 경우 2, 단계 4종 |
| `메시지 링크만 있으면: 모든 단계에서 send_message` | 경우 3, 단계 4종 |
| `둘 다 없으면: 모든 단계에서 fight 평가가 없다` | 경우 4 (`null` → `all`에서 빠진다), 단계 4종 |
| `단계만 다른 보드는 기대 손실이 같다` | `stage`가 숫자를 바꾸지 않는다는 회귀 고정 |
| `plan.test.ts` > `합의 단계에 두 링크가 함께 있으면 fight는 send_message로 계획한다` | `planMove`가 합의 단계 + 두 링크에서 `apiMove: 'send_message'` 계획을 만든다 |

## 남은 문제
- 없음. 실제 D2(서연) 보드가 이제 `send-message`로 나가는지는 샌드박스 실호출(AC13, skip 상태)에서 확인할 일이다 — 이 작업 범위 밖이고, `src/exec`도 건드리지 않았다.

## 컨트롤 타워에 요청할 결정
- 없음.
