# T120 보고 (2026-11-12 20:35)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/engine / (이 보고서와 같은 커밋)

## 결과
완료. 엔진에 새 선택지 `repair`(B3 품질 무료 수선)를 넣었다. 공식은 AC35 머리 주석을 그대로 따른다. `rules.repair.eligibleSubtypes`(B3) 사건에서만 `all`에 들어가고, 그 밖의 사건에는 repair가 아예 없다. 그래서 B3가 아닌 사건의 기존 결과(순서·값·best)는 바뀌지 않는다. 인수 테스트는 AC35 포함 전부 통과했다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/oracle.ts` | `repairLoss`: pRep×R + (1−pRep)(1−pWin)(a+f) + t, 분기 accept / reject_win / reject_lose (Σ = 기대 손실) |
| `src/engine/recommend.ts` | 평가 순서 `ALL_MOVE_ORDER`(fight→offer→refund→repair). repair는 대상 유형일 때만 평가하고, 가정값이 없으면 `REPAIR_PARAMS`로 막는다 |
| `src/engine/policy.ts` | `ALL_MOVE_ORDER`(동점 순서, repair가 맨 뒤), `isRepairInScope`, `apiMoveFor('repair')` = `send_message`(허용될 때만), `BLOCKED.repairParams`. `MOVE_ORDER`(세 수)는 그대로 둬서 `sim.ts`가 바뀌지 않는다 |
| `src/engine/params.ts` | zod: `repairCostCents`·`pAcceptRepair`(선택), `rules.repair`(선택), `moveSchema`에 'repair'. 이 항목을 넣지 않으면 parse할 때 값이 빠진다 |
| `src/engine/plan.ts` | `planMove` repair → `send_message`, 금액 null, refundType null, 메시지 필요 |
| `src/engine/forecast.ts` | `forecastMoves`: repair의 pChargeback = (1−pAcceptRepair)×fightP. 원래 코드는 offer의 pAccept를 썼다 |
| `config/params.json` | `repairCostCents` 700 (가정, ≈$7 시안 v6), `pAcceptRepair` 0.8 (가정) — AC35 fixture와 같은 값 |
| `config/rules.json` | `repair.eligibleSubtypes: ["B3"]`. `autopilot.moneyMoves`는 바꾸지 않았다(repair 없음) → 판정은 seller_review, 사람 승인은 그대로 필요 |
| `tests/unit/repair.test.ts` | 새 파일: 실제 config로 1642¢·분기·대상 밖·원인 없음·send_message 미허용·규칙/가정값 없음·오토파일럿·Keeps 3358¢·planMove |
| `tests/unit/recommend.test.ts` | 동점 시험(fight=refund 5000¢)의 유형을 B3 → B4로 바꿨다. 이 시험이 실제 rules를 쓰고 있어서 B3에서는 이제 repair(1642¢)가 best가 된다. 시험의 뜻(세 수 동점 순서)은 그대로다 |

`savings.ts`(`actionSavings`)는 코드를 바꾸지 않았다. 이미 move마다 "refund − 그 수" 값을 주기 때문에, repair도 그대로 3358¢가 나온다(단위 시험으로 확인).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (16 파일) | 0 | AC35 5개 포함, 9 skipped(기존) |
| npm test | 2614 | 1 | 아래 시간 제한 시험 |
| npx tsc --noEmit | `src/engine`·`config`·`tests/unit` 오류 0 | | 남은 오류는 아래 |

- `npm test` 실패: `tests/unit/storefront.test.ts > 결정론 > 같은 입력 100회` 시험이 5초 제한을 넘었다(전체를 병렬로 돌릴 때). 이 시험은 실행할 때마다 결과가 달라진다. 1회차에는 이것과 `sim.test.ts` 성능(50ms) 시험이 실패했고, 2회차에는 storefront만 실패했다. 두 파일만 따로 돌리면 모두 통과한다(storefront 3.2~4.9초). 이 경로에서 바뀐 것은 zod 선택 항목 두 개뿐이다. `sim`/`storefront`는 repair를 평가하지 않고, `resolveEngineInput`도 입력마다 한 번만 부른다. 그래서 이번 변경 때문에 느려진 것은 아니라고 판단한다. 다만 기준 커밋과의 시간 비교는 하지 못했다(임시 worktree 승인 없음).
- tsc 남은 오류(내 수정 범위 밖, 지시서대로 보고만):
  - `src/app/cases/model.ts:224` — `Record<move, string>`에 'repair'가 없다 (T120b)
  - `src/app/cases/reply/load.ts:108,121`, `src/app/cases/view/load.ts:94` — `ReplyMove`에 'repair'가 없다 (T120b·T120c)
  - `.next/types/validator.ts` — 오래된 빌드 산출물이 지워진 페이지를 가리킨다 (기존 문제)

## 남은 문제
- storefront·sim의 시간 제한 시험이 전체 실행 부하에서 가끔 실패한다(위). 엔진 쪽 성능 문제가 아니라 시험 시간 제한 문제로 보인다.
- 화면·AI(`src/app`, `src/ai`)는 아직 'repair'를 처리하지 않는다 → T120b·T120c.

## 컨트롤 타워에 요청할 결정
- 없음
