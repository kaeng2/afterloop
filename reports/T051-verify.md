판정: 통과

# T051 검증 (2026-11-10)

- 대상: `lane/paypal` `670435a` (코드 커밋 `52b2a37`), 기준 `main` `ab926ef`, 갈라진 지점 `6d3b70b`
- 기준 SPEC: v2.5 (`SPEC.md` 첫 줄과 지시서가 같다)
- 검증자는 코드·테스트·문서·`tests/sandbox/`·`config/`를 수정하지 않았다. `.env`를 찾지 않았고 `npm run sandbox:*`를 실행하지 않았다 (실호출 0회). 끝난 뒤 `git status --short`는 이 보고서 파일 말고 비어 있다.
- 탐침·돌연변이 시험은 모두 스크래치 폴더(`…/scratchpad/t051-verify/`)에서만 했다 (`git archive`로 뽑은 복사본. 저장소 파일은 읽기만 했다).

## 1. 범위

`git diff main...HEAD --numstat`

| 파일 | + | - |
|---|---|---|
| `reports/T051-impl.md` | 65 | 0 |
| `tests/unit/sandbox-disputes-read.test.ts` | 6 | 1 |
| `tests/unit/sandbox-v23.test.ts` | 319 | 32 |

- 수정 가능 폴더 밖 변경 0건. `tests/sandbox/`·`config/`·`scripts/` 변경 0줄 (`git diff main...HEAD --stat -- tests/sandbox config` 출력 없음).
- `main`이 갈라진 뒤 앞서 나갔다 (T043·T049 병합, 13개 파일). 이 브랜치가 바꾼 3개 파일과 겹치는 파일은 0개다.

## 2. 실행 결과

| 명령 (작업 폴더, HEAD `670435a`) | 통과 | 실패 | 종료 코드 |
|---|---|---|---|
| `npm test` | 1205 (파일 23) | 0 | 0 |
| `npx tsc --noEmit` | 출력 없음 | 0 | 0 |
| `npm run lint` | 출력 없음 | 0 | 0 |
| `npm run test:acceptance` | 144 (파일 11), 건너뜀 9 | 0 | 0 |

- 건너뛴 9건은 AC13의 `RUN_SANDBOX=1` 실호출 부분이다 (이 브랜치가 건드리지 않았다).
- 비교 기준 (스크래치 복사본에서 실행):
  - 갈라진 지점 `6d3b70b`: `npm test` 1177 통과 / **1 실패** (1178건). 실패는 `정본 manifest는 주문 13건·분쟁 4건이고 시연 제외가 1건이다` (`expected … to have a length of 4 but got 5`).
  - 지금 `main` `ab926ef`: 1225 통과 / 1 실패 (같은 테스트).
  - **병합 모의** (`main` 복사본 + 이 브랜치의 테스트 파일 2개): `npm test` 1253 통과 / 0 실패, `tsc --noEmit` 종료 코드 0.

## 3. 테스트가 약해졌는지 (`git diff main...HEAD -- tests/unit/`)

`it` 수: `sandbox-v23` 31 → 58건(실행 기준), `expect(` 줄 89 → 145. `sandbox-disputes-read` 27건 그대로, `expect(` 80 → 81.

### 지워진 `expect` 4개

| 지워진 검사 | 지금 같은 것을 보는 방법 | 판단 |
|---|---|---|
| `expect(manifest.disputes).toHaveLength(4)` (정본) | 시연 제외를 뺀 키가 정확히 `D1·D2·D3`, `missingDisputeKeys(...) === []`, 시연 제외가 아닌 키는 `D…`뿐, `P…`는 모두 `demoExcluded: true`, 분쟁 ID 중복 없음, `orderKey`가 모두 manifest 주문에 있음 | 지시서 1번대로다. 수 대신 불변 성질로 바뀌었다 |
| `expect(시연 제외 ID 목록).toEqual([EXCLUDED_DISPUTE_ID])` (정본) | `D2-old`가 `{ disputeId: EXCLUDED…, demoExcluded: true }`로 있다(`toMatchObject`) + 시연 제외 목록에 그 ID가 들어 있다(`toContain`) + 위의 "시연 분쟁은 D1~D3뿐" | 지시서대로다. "시연 제외가 정확히 1건"만 의도대로 빠졌다 |
| `expect(manifest.orders).toHaveLength(13)` (정본) | 시드 주문 키 전부 + O13이 있다 (`readSandboxOrderSpecs()` 기준, `o13Of(...).tracked === false`) | **아래 한계는 지켜지고 위 한계는 사라졌다** — 아래 "발견한 문제" 1번 |
| `expect(text.split('<!-- afterloop:last-run:')).toHaveLength(4)` (`sandbox-disputes-read`) | 절 이름 집합 = 커밋된 파일의 절 ∪ `disputes`, 그리고 절 이름에 중복이 없다 | 지금 커밋된 파일(절 3개)에서는 옛 검사와 같은 뜻이다. 아래 돌연변이 L1·L2에서 둘 다 문다 |

그대로 남은 정본 검사: 스키마 통과 + 다시 직렬화한 문자열이 파일과 같다(안 바뀜), `D2.orderKey === 'O13'`, `O13.tracked === false`.
`checkClient`·`capOf`·`listPath`는 describe 안에서 모듈 바깥으로 **옮기기만** 했다 (본문 같음). 기존 T039 테스트 30건은 줄 하나 안 바뀌었다.

### 돌연변이 시험 (스크래치 복사본에서만)

정본 manifest 복사본을 일부러 틀리게 고쳤을 때 `sandbox-v23.test.ts`:

| 돌연변이 | 결과 |
|---|---|
| `P2`를 `demoExcluded` 없이 추가 | 1건 실패 (잡는다) |
| `P2`를 `demoExcluded: true`로 추가 | 58건 통과 (의도대로 수에 안 묶인다) |
| `D4`를 시연 분쟁으로 추가 | 1건 실패 |
| `D2-old`의 `demoExcluded` 제거 | 2건 실패 |
| `D2-old` 항목 삭제 | 1건 실패 |
| `D3` 삭제 | 1건 실패 |
| `P1`의 `demoExcluded`를 `false`로 | 1건 실패 |
| `P1`의 분쟁 ID를 D1과 같게 | 1건 실패 |
| `P1`의 `orderKey`를 없는 주문으로 | 1건 실패 |
| `D2`의 `orderKey`를 O01로 | 1건 실패 |
| 주문 `O05` 삭제 | 1건 실패 |
| 주문 `O14` 추가 | **58건 통과** (옛 `toHaveLength(13)`은 잡았다) |
| 시연 제외 `X1`(키가 `D…`·`P…` 아님) 추가 | 58건 통과 (키 규칙 "그 밖 = 시연 제외"와 맞다) |

스크립트 복사본을 일부러 틀리게 고쳤을 때 (새 T051 테스트가 실제로 그 로직에 걸려 있는지):

| 돌연변이 | 결과 |
|---|---|
| 시연 제외 ID 걸러내기에서 `P…` 제외 (재배정 허용) | T051 2 — 3건 실패 |
| `planTrack`이 `P…` 분쟁을 무시 | T051 3 — 4건 실패 |
| `mergeDisputes`가 `P…`를 버림 | T051 2 — 4건 실패 |
| check 보고에서 `P…`의 `demoExcluded` 빠짐 | T051 1 — 2건 실패 |
| last-run 표에서 `P…` 행이 "포함" | T051 1 — 2건 실패 |
| last-run 아래 설명 줄에서 `P…` 빠짐 | T051 1 — 3건 실패 |
| check가 `P…` 분쟁을 조회하지 않음 | T051 1 — 2건 실패 |
| `missingDisputeKeys`가 시연 제외도 "있다"로 셈 | T039 4 — 1건 실패 |
| last-run을 쓸 때 절 머리글이 두 번 (`sandbox-disputes-read`) | 1건 실패 |
| last-run의 기존 `probe` 절을 버림 (`sandbox-disputes-read`) | 2건 실패 |

돌연변이 뒤 복사본은 원본과 `diff`가 0이다 (되돌림 확인).

## 4. 탐침 (가짜 클라이언트 + 임시 폴더, 지시서 2번)

`…/scratchpad/t051-verify/probe.ts` — **검사 637개, 실패 0, 종료 코드 0.**
가짜 manifest 6벌: (합성 13주문 / 실제 manifest에서 `P…`를 떼고 다시 붙인 것) × 연습용 0건·1건·3건. 연습용은 `P1`→O04(`tracked: false`), `P2`→O06, `P3`→O09(둘 다 `tracked: true`). 추가로 실제 manifest 그대로(`P1` on O04)도 한 번 돌렸다.

| 경우 | 확인한 것 | 결과 |
|---|---|---|
| `check` 보고 (`--json`이 내보내는 `report`) | manifest의 분쟁이 전부 나오고, `P…`에 `demoExcluded: true`, 시연 제외가 아닌 키는 `D1·D2·D3` | 6벌 모두 통과 |
| `last-run.md` (임시 폴더에 `writeLastRunSection`으로 쓰고 다시 읽음) | `P…` 행의 마지막 칸이 `시연 제외`, 아래 설명 줄 `- P1 (…): 시연 제외`, 시연 분쟁 행은 `포함` | 6벌 모두 통과 |
| `setup -- disputes` 재실행 (`setup.ts`의 `main`과 같은 순서: 읽기 → `runDisputes` → `mergeDisputes` → 쓰기 → `missingDisputeKeys`) | 연습용·`D2-old`의 분쟁 ID를 D1·D2·D3 **세 캡처 목록 모두의 맨 앞**에 두었다. ① 시연 분쟁 ID가 그 뒤에 있는 경우 ② 새 분쟁 ID로 바뀐 경우 ③ 모든 분쟁이 모든 목록에 나오는 경우. `P…` 항목이 글자 그대로 남고, 그 ID는 자기 키에만 있고, D1~D3은 올바른 ID·`orderKey`, 마지막 확인 `[]`(종료 코드 0 경로), 한 번 더 돌려도 같음 | 6벌 × 3가지 모두 통과 |
| `setup -- track` | 연습용 분쟁의 주문 ID가 들어간 요청 0건. 그 주문을 `tracked: true`로 바꿔도 0건이고 행은 `disputed · … P? · 시연 제외`. POST는 분쟁 없는 `tracked: true` 주문의 `/track`뿐 | 6벌 × 2가지 모두 통과 |
| 요청 기록 | check: GET만. disputes: GET 3건(D 키마다 목록 1번)뿐, 연습용 분쟁 ID가 들어간 요청 0건. track: `/v1/customer/disputes` 경로 요청 0건. **분쟁에 대한 POST 0회** (전 경우) | 통과 |

실제 manifest 그대로: `P1` 보존, `P1`의 ID는 `P1`에만, 마지막 확인 통과, track 요청 10건 중 O04 관련 0건.

## 5. 실제 `tests/sandbox/manifest.json` (읽기만)

- `ManifestSchema.safeParse` 통과.
- `JSON.stringify(parsed, null, 2) + '\n'` === 파일 내용 (글자까지 같다).
- 주문 13건, 분쟁 키 `D1, D2, D3, D2-old, P1`. 시연 제외를 뺀 키 = `D1·D2·D3`, `D2-old`·`P1`은 `demoExcluded: true`.
- 탐침 뒤 파일 내용이 그대로인지도 확인했다.

## 6. 지시서 대조

| 지시서 | 결과 |
|---|---|
| 1. 정본을 읽는 검사는 수를 고정하지 않고 불변 성질만 본다 | 충족 (3절) |
| 1. 고정 수가 필요한 검사는 가짜 manifest로 | 충족 (기존 `manifest13()` 검사 + 새 `manifestWithPractice`) |
| 2. `check` 보고·`last-run`에 연습용이 "시연 제외" | 충족 — 테스트 7건 + 탐침. 스크립트 수정 없이 통과 |
| 2. `setup -- disputes` 재실행: `P…` 보존·재배정 없음·마지막 확인 | 충족 — 테스트 10건 + 탐침 |
| 2. `setup -- track`: 연습용 분쟁의 주문에 호출 0회 | 충족 — 테스트 8건 + 탐침 |
| 3. 다른 `sandbox-*.test.ts`의 같은 종류 검사 | `sandbox-disputes-read`의 절 수 1곳을 고쳤다. `sandbox-orders`·`sandbox-orders-protect`·`sandbox-setup`은 저장소의 정본 파일을 읽지 않는다 (검색으로 확인) |
| 완료 기준: `npm test` 실패 0, 0건·1건·3건, tsc·lint·acceptance, `tests/sandbox/`·`config/` 0줄 | 모두 충족 |

## 발견한 문제

### 병합 차단
없음.

### 병합 후 수정
1. **(낮음, 컨트롤 타워 판단) 정본 manifest의 주문 수 위쪽 한계가 사라졌다.** 옛 `expect(manifest.orders).toHaveLength(13)`은 주문이 잘못 더해지는 것도 잡았는데, 지금은 "시드 주문 전부 + O13이 있다"만 본다 (돌연변이: `O14`를 넣어도 58건 통과). 지시서 1번("수를 고정하지 않는다")에 맞춘 결과이고 지시서 배경은 분쟁 수만 말하므로 실패로 보지 않는다. 주문 13건은 AC13이 보지만 `RUN_SANDBOX=1`일 때만 돈다. 주문 수는 늘 이유가 없다고 본다면 "시연 분쟁이 가리키지 않는 주문은 시드 주문뿐" 같은 성질 검사를 하나 더하면 된다.

### 기록만
- 새 테스트 "가짜 manifest에서는 수를 본다 (연습용 0건·1건·3건)"는 테스트가 만든 가짜 manifest의 길이를 다시 세는 것이라, 스키마 통과 한 줄 말고는 제품 코드를 보지 않는다. 해는 없다 (실제 수 검사는 기존 `주문 13건·분쟁 4건을 모두 조회하고…`와 T051 1이 한다).
- 연습용 1건(O04, `tracked: false`)의 track 검사는 분쟁이 없어도 통과한다 (`planTrack`이 `P…`를 무시하게 한 돌연변이에서 1건 경우는 안 깨졌다). 3건 경우(O06)와 `tracked: true` 전용 테스트 2건이 그 경로를 잡으므로 빈틈은 아니다.
- (T051 범위 밖, 원래 있던 동작) 실제 manifest로 `setup -- disputes`를 다시 돌리면 `mergeDisputes`의 키 정렬 때문에 파일의 분쟁 순서가 `D1,D2,D3,D2-old,P1` → `D1,D2,D2-old,D3,P1`로 바뀐다. 내용은 같고 파일 차이만 생긴다. `P10`은 `P2` 앞에 온다.
- 구현 보고서와 다른 점은 아래 7절.

## 7. 구현 보고서(`reports/T051-impl.md`) 대조

| 주장 | 사실 |
|---|---|
| `scripts/` 변경 0줄, `tests/sandbox/`·`config/` 0줄 | 맞다 |
| `tests/unit/` 2개 파일 (+325 / -33) | 맞다 (319+6 / 32+1) |
| `npm test` 1205 통과 / 0 실패, 작업 전 1177 통과 / 1 실패 | 맞다 (갈라진 지점에서 다시 돌려 확인) |
| `test:acceptance` 144 / 0, skip 9 | 맞다 |
| "`sandbox-v23.test.ts`는 30 → 58건" | **부정확.** 작업 전은 31건(30 통과 + 1 실패)이다. 31 → 58 |
| 마지막 커밋 `52b2a37` | 코드 커밋이 그렇고, 브랜치 끝은 보고서 커밋 `670435a`다 (문제 아님) |
| "`D4`를 넣거나 `P2`에서 `demoExcluded`를 빼면 실패한다" | 맞다 (돌연변이로 확인) |
| "연습용 ID를 목록의 첫 번째로 돌려준다", "연습용 주문의 캡처로는 조회하지 않는다" | 맞다 (테스트 코드와 탐침) |
| "판정 경로가 `demoExcluded` 플래그 하나뿐" | 맞다 (`setup-steps.ts`·`check-steps.ts`에 키 이름으로 가르는 곳 없음. `DISPUTE_ORDER_KEY`의 `D1`~`D3`만 키 기준) |
| "돌연변이 시험을 못 했다" | 검증자가 스크래치 복사본에서 대신 했다 (3절). 새 테스트는 모두 문다 |
| 다른 `sandbox-*.test.ts`는 임시 폴더만 쓴다 | 맞다 |

## 확인하지 못한 것

- 실제 PayPal 호출 (`sandbox:check`, `setup -- disputes`, `setup -- track`) — 금지라 돌리지 않았다. 실제 `last-run.md`에는 아직 `P1` 행이 없다 (다음에 사람이 `sandbox:check`를 돌릴 때 `P1`이 `시연 제외`로 적히는지 눈으로 확인).
- `setup.ts`·`check.ts`의 `main()` 자체 (자격 증명 읽기 + 실제 클라이언트)는 실행하지 않았다. 같은 함수들을 같은 순서로 불러 확인했다.
- 병합 뒤의 `npm run lint`와 `npm run test:acceptance`는 진짜 저장소에서 돌리지 못했다. 스크래치 복사본에서는 인수 테스트 143 통과 / 1 실패였는데, 그 1건(`AC13 … .env는 git이 무시하고…`)은 복사본이 git 저장소가 아니라 `git check-ignore`가 실패한 것이다 (이 브랜치와 무관). 병합 뒤 컨트롤 타워가 한 번 돌려 확인한다.
