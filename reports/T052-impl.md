# T052 보고 (2026-11-10 11:45)

- 기준 SPEC: v2.6 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `# SPEC v2.6 (2026-11-10 11:37 KST)`)
- 브랜치 / 마지막 커밋: lane/engine / `5f28923`

## 결과
완료 — `offerComesFirst(board, recommendation)`을 `src/engine/policy.ts`에 추가하고 단위 테스트 17건을 새 파일에 썼다. `src/types.ts`와 `recommend`·`planMove`·`simulate`의 결과는 건드리지 않았다.

구현은 지시서의 계약 그대로 한 줄 판정이다:

```ts
export function offerComesFirst(board: BoardState, recommendation: Recommendation): boolean {
  return recommendation.best?.move === 'offer' && board.allowedMoves.includes('make_offer');
}
```

- `recommend`를 안에서 부르지 않는다 (같은 `board`로 만든 추천이라고 가정). 계산을 다시 하지 않으므로 보드와 어긋난 추천을 주면 그 추천을 그대로 믿는다 — 이 동작도 테스트로 고정했다.
- `board.allowedMoves`·`recommendation`을 읽기만 한다 (순수 함수, 입력 불변).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/policy.ts` | `offerComesFirst` 추가 (+ `Recommendation` 타입 import). 기존 함수는 손대지 않음 |
| `tests/unit/offer-first.test.ts` (신규) | 단위 테스트 17건 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 144 (+9 skip) | 0 | 전체 통과. AC1~AC3·AC4·AC5·AC6·AC8 기대값 변경 없음 |
| `npm test` | 1242 | 1 | 유일한 실패는 T052와 무관한 기존 실패 (아래) |
| `npx tsc --noEmit` | 통과 | - | 출력 없음 |
| `npm run lint` | 통과 | - | 출력 없음 |
| `npx vitest run tests/unit/offer-first.test.ts` | 17 | 0 | 새 테스트 |

### `npm test`의 실패 1건 — T052와 무관한 기존 실패
`tests/unit/sandbox-v23.test.ts > T039 1. manifest 형식 (demoExcluded·note) > 정본 manifest는 주문 13건·분쟁 4건이고 시연 제외가 1건이다`
— `expect(manifest.disputes).toHaveLength(4)`가 5를 받는다 (`tests/unit/sandbox-v23.test.ts:159`).

원인: 커밋 `c961e06`("Practice dispute P1 ... manifest demoExcluded")에서 `tests/sandbox/manifest.json`에 연습용 분쟁 `P1`이 5번째로 들어갔는데, 같은 커밋이 분쟁 4건을 기대하는 이 단위 테스트를 갱신하지 않았다. 내가 바꾼 파일(`src/engine/policy.ts`, `tests/unit/offer-first.test.ts`)과 접점이 없고, `tests/unit/sandbox-v23.test.ts`·`tests/sandbox/manifest.json`·`scripts/sandbox/`는 내 수정 가능 폴더 밖이라 고치지 않았다.

### 완료 기준 대조
| 완료 기준 | 결과 |
|---|---|
| 지호 꼴 (합의 단계, SNAD, B1, `send_message`·`make_offer`·`accept_claim`) → 참 | 통과. `recommend`의 best가 `offer`/`apiMove = make_offer`인 것도 같은 테스트에서 확인 |
| 같은 보드에서 링크에 `make_offer`가 없으면 → 거짓 | 통과. 두 갈래로 확인: ① 그 보드로 다시 추천하면 best가 offer가 아니다 ② 메시지 전에 만든 offer 추천을 링크가 사라진 보드에 대고 물어도 거짓 (`allowedMoves` 조건이 실제로 동작하는지) |
| 서연 꼴 (합의 단계, INR, A2, 네 링크 모두) → best가 fight → 거짓 | 통과 ($72, 추적 미등록, pWin A2 = 0.30 → fight 6290¢ < refund 7400¢) |
| best가 refund인 보드 → 거짓 | 통과 (A1, 추적 기록 없음 → refund 5000¢) |
| `best = null`인 보드 → 거짓 | 통과 (`cause` 없음 → 세 수 모두 `NO_CAUSE`) |
| 입력 불변, 같은 입력이면 같은 결과 | 통과 (`board`·`recommendation` 직렬화 비교 + 5가지 보드를 반복 호출) |
| `recommend`·`planMove`·`simulate` 기존 테스트가 기대값 변경 없이 통과 | 통과 (`recommend` 30건, `plan` ·`sim` 전부. 인수 테스트 144건 전부) |
| `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run test:acceptance` | 위 표. `npm test`의 알려진 실패 1건만 남음 |

추가로 넣은 경계 (지시서에 없지만 같은 조항 범위):
- 제안이 차단된 보드(B3 → `OFFER_SCOPE`) → 거짓
- 네 링크가 모두 있어도 추천이 제안이면 참 (증빙 링크는 판정에 영향 없음)
- 링크 조합 6가지 (`[make_offer]`, `[make_offer, send_message]`, `[make_offer, provide_evidence, accept_claim]` → 참 / `[send_message]`, `[provide_evidence, accept_claim]`, `[]` → 거짓)

## 남은 문제
- `tests/unit/sandbox-v23.test.ts`의 분쟁 4건 기대값이 연습용 분쟁 `P1`이 들어간 정본 manifest와 어긋난다 (위 설명). data 레인 또는 컨트롤 타워가 기대값을 5건으로 고치거나 `P1`을 세지 않도록 정해야 한다. T052 범위 밖이라 손대지 않았다.
- `offerComesFirst`를 쓰는 곳(화면·앱 서버)은 아직 없다. AC18 초안(`tests/acceptance/drafts/AC18.md`)의 "메시지 보내기가 꺼져 있고 이유 문구 키가 있다"는 ui 레인 작업이고, 이유 문구는 `config/`에서 읽어야 한다 (SPEC 3장).

## 컨트롤 타워에 요청할 결정
- 없음 (계약·인수 테스트·SPEC 변경 불필요. `src/types.ts`는 그대로 쓸 수 있었다 — `Recommendation`·`BoardState`만 읽는다).
