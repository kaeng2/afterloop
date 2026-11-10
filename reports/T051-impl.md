# T051 보고 (2026-11-10 11:35)

- 기준 SPEC: v2.5 (시작할 때 `SPEC.md` 첫 줄과 같았다: 예 — `SPEC v2.5 (2026-11-10 10:52 KST)`)
- 브랜치 / 마지막 커밋: lane/paypal / `52b2a37`

## 결과
완료. 정본 manifest를 읽는 단위 테스트에서 고정 수(주문 13건·분쟁 4건)를 뺐고, 연습용 분쟁(`P…`)을 0건·1건·3건 넣은 가짜 manifest로 지시서 2번의 세 경우를 확인했다. **스크립트는 고칠 것이 없었다** — 세 경우가 모두 지금 코드로 통과해서 테스트만 더했다 (`scripts/` 변경 0줄).

`.env`를 열지 않았고, `npm run sandbox:*`를 실행하지 않았다 (실호출 0회). `tests/sandbox/`·`config/`는 1줄도 바꾸지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `tests/unit/sandbox-v23.test.ts` | ① 정본 manifest 검사에서 고정 수 제거 → 변하지 않는 성질만 본다. ② 고정 수가 필요한 검사는 가짜 manifest로 옮김. ③ 연습용 분쟁용 가짜 manifest 만들기(`manifestWithPractice`)와 T051 1~3 describe 3개 추가. ④ 공용 가짜 클라이언트(`checkClient`)·`capOf`·`listPath`를 모듈 바깥으로 올려 재사용 |
| `tests/unit/sandbox-disputes-read.test.ts` | 지시서 3번: 커밋된 `last-run.md`의 **절 수**(`toHaveLength(4)`)에 묶여 있던 검사를 절 이름 기준으로 바꿈 |

### 1번 — 정본 manifest에서 수를 고정하지 않는다
없앤 검사: `orders).toHaveLength(13)`, `disputes).toHaveLength(4)`, 시연 제외 ID 목록을 `[EXCLUDED_DISPUTE_ID]` 한 건으로 못박던 `toEqual`.

대신 보는 것 (`T039 1.` describe):
- 스키마 통과 + 다시 직렬화하면 파일과 글자까지 같다 (원래 있던 검사, 그대로 둠)
- 시연 제외를 뺀 분쟁 키가 정확히 `D1`·`D2`·`D3`
- `missingDisputeKeys(manifest.disputes) === []` (스크립트의 마지막 확인과 같은 함수)
- 시연 제외가 아닌 분쟁의 키는 `D…`뿐이고 `P…` 꼴이 아니다
- `P…` 키는 모두 `demoExcluded: true`
- 분쟁 ID가 겹치지 않고, 가리키는 `orderKey`가 모두 manifest의 주문에 있다
- `D2-old`가 시연 제외로 있다 (`toMatchObject`), `D2`는 O13의 분쟁, O13은 `tracked: false` (SPEC 9-5)
- 주문은 수 대신 **시드 주문 전부 + O13이 있는지**로 본다 (`readSandboxOrderSpecs()` 기준)

고정 수가 필요한 검사는 새 테스트 "가짜 manifest에서는 수를 본다 (연습용 0건·1건·3건)"으로 옮겼다 (`manifestWithPractice(count)`: 주문 13건, 분쟁 `4 + count`건, 시연 제외 `1 + count`건).

> 연습용 분쟁을 더 넣어도 이 검사들은 그대로 통과한다. 반대로 `D4`를 시연 분쟁으로 넣거나 `P2`에서 `demoExcluded`를 빼면 실패한다.

### 2번 — 세 경우 확인 (가짜 클라이언트, 실호출 0회)
`PRACTICE_COUNTS = [0, 1, 3]`으로 `it.each`를 돌렸다. 연습용 분쟁은 `P1`→O04, `P2`→O05, `P3`→O06으로 걸었다 (O04·O05는 `tracked: false`, **O06은 `tracked: true`** — 추적 등록 제외 경로까지 지나가게 했다).

| 경우 | 확인한 것 | 결과 |
|---|---|---|
| `sandbox:check` | manifest의 분쟁 전부를 조회하고(`report.disputes` 길이 = manifest 길이), 연습용에 `demoExcluded: true`가 붙고, 시연 분쟁 키는 여전히 `D1`·`D2`·`D3`, 호출은 GET만 | 지금 코드로 통과 |
| `last-run.md` | 연습용 분쟁의 표 행과 아래 설명 줄이 `D2-old`와 똑같이 `시연 제외`로 적힌다 (`- P1 (…): 시연 제외`). 시연 분쟁 행에는 안 붙는다. 조회가 전부 403이어도 ID와 "시연 제외"가 남는다 | 지금 코드로 통과 |
| `setup -- disputes` 재실행 | ① 연습용 항목이 메모까지 글자 하나 안 바뀌고 남는다 ② 연습용 ID가 D2의 캡처 목록에 **첫 번째로** 섞여 돌아와도 D2에 배정되지 않고(`PP-R-GMS-10197661`이 들어간다) 원래 키에만 남는다 ③ 연습용 분쟁만 걸려 있으면 D2를 비우고 전에 적어 둔 D2가 보존된다 ④ 마지막 확인 `missingDisputeKeys(merged) === []` ⑤ 연습용 주문의 캡처로는 조회하지 않는다 ⑥ 두 번 돌려도 같다 (멱등) | 지금 코드로 통과 |
| `setup -- track` | O04 등 연습용 분쟁의 주문에 **호출 0회** (주문 ID가 들어간 호출이 0건). `planTrack`의 `targets`에 없고, `tracked: true`인 O06은 `blocked`에 들어간다. POST는 `planTrack().targets`와 정확히 같은 목록에만 나간다. O06 행은 `분쟁 진행 중이라 제외 (P3 · 시연 제외)` | 지금 코드로 통과 |

고친 데가 없는 이유: `demoExcludedDisputeIds`·`disputedOrderKeys`·`mergeDisputes`·`missingDisputeKeys`·`readDispute`·`checkSection`이 모두 **키 이름이 아니라 `demoExcluded` 플래그**로 판정한다. 그래서 `P…`가 `D2-old`와 같은 길을 탄다. 반대로 어딘가 `key.startsWith('D')` 같은 판정이 섞이면 위 테스트가 깨진다.

### 3번 — 같은 종류의 검사
`tests/unit/sandbox-disputes-read.test.ts`의 "커밋된 `last-run.md`의 기존 절을 읽어도 모양이 깨지지 않는다"가 `text.split('<!-- afterloop:last-run:')).toHaveLength(4)`로 **지금 절 수**에 묶여 있었다. 절 이름을 뽑아 "커밋된 파일에 있던 절 + `disputes`가 그대로 있고, 절마다 머리글이 하나씩"으로 바꿨다. 다른 `sandbox-*.test.ts`의 `toHaveLength(12)` 등은 모두 **테스트가 만든 가짜 manifest·시드 명세** 기준이라 정본 파일에 묶여 있지 않다 (확인함: `sandbox-orders.test.ts`·`sandbox-orders-protect.test.ts`·`sandbox-setup.test.ts`는 모두 `mkdtempSync` 임시 폴더를 쓴다).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 144 | 0 | 9건 skip (AC13의 실호출 부분 — 환경변수 없을 때 건너뛴다. 원래부터 skip) |
| `npm test` | 1205 | 0 | 작업 전 main 기준 1177 통과 / **1 실패**(`정본 manifest는 주문 13건·분쟁 4건…`) → 실패 0. `sandbox-v23.test.ts`는 30 → 58건 |
| `npx tsc --noEmit` | - | 0 | 출력 없음 |
| `npm run lint` | - | 0 | 출력 없음 |

`git diff --stat`: `tests/unit/` 2개 파일만 (+325 / -33). `tests/sandbox/`·`config/` 0줄. 실제 PayPal 호출 0회.

## 남은 문제
- 지시서 2번의 세 경우를 **가짜 클라이언트로만** 확인했다. 실제 `npm run sandbox:check`·`setup -- disputes`·`setup -- track`을 돌려 보지는 않았다 (지시서의 "실호출 금지" 때문). 사람이 다음에 `sandbox:check`를 돌릴 때 `tests/sandbox/last-run.md`의 분쟁 표에 `P1` 행이 `시연 제외`로 나오는지 눈으로 한 번 확인하면 좋겠다.
- 새 테스트가 실제로 그 로직에 걸려 있는지 **돌연변이 시험**(스크립트를 일부러 틀리게 고쳐 테스트가 깨지는지)으로 보려 했는데, 이 worktree의 잠금이 `scripts/` 임시 수정과 스크래치 스크립트 실행을 막아 못 했다. 대신 코드를 읽어 판정 경로가 `demoExcluded` 플래그 하나뿐임을 확인했고, 연습용 ID를 **목록의 첫 번째**로 돌려주게 해서 걸러지지 않으면 `ids[0]`로 뽑혀 바로 실패하도록 입력을 짰다 (기존 `D2-old` 테스트와 같은 방식).
- `scripts/sandbox/setup-steps.ts`의 `DISPUTE_ORDER_KEY`는 `D1`~`D3` 세 키에 묶여 있다. 지금 설계(시연 분쟁 3건)에서는 맞지만, 시연 분쟁을 늘리려면 여기도 같이 봐야 한다. 이번 범위는 아니라 손대지 않았다.

## 컨트롤 타워에 요청할 결정
없음. 계약(`src/types.ts`)·인수 테스트·SPEC을 바꿀 필요가 없었다. manifest 키 규칙(`D1`~`D3` 시연 / `P…` 연습용 / 그 밖 시연 제외)은 AC29의 `isPractice`(`/^P\d+$/`)와 같은 정규식을 그대로 썼다.
