판정: 통과

# T052 검증 (2026-11-10 11:46)

- 대상: `lane/engine` `bf501b2` (코드 커밋 `5f28923`), 기준 `main` `4e66d3e`, 갈라진 지점 `03c5381`
- 기준 SPEC: v2.6 (`SPEC.md` 첫 줄 `# SPEC v2.6 (2026-11-10 11:37 KST)`)
- 검증자는 코드·테스트·문서를 고치지 않았다. 만든 파일은 이 보고서와 scratchpad의 탐침 2개뿐이다. 작업 폴더는 검증 전후 모두 깨끗했다 (`git status --short` 출력 없음, 이 보고서 제외).

## 1. 범위

`git diff main...HEAD --numstat`

| 파일 | + | − | 허용 여부 |
|---|---|---|---|
| `src/engine/policy.ts` | 16 | 1 | 수정 가능 폴더 |
| `tests/unit/offer-first.test.ts` (신규) | 178 | 0 | 수정 가능 폴더 (지시서가 허용한 새 파일) |
| `reports/T052-impl.md` (신규) | 63 | 0 | 보고서 |

- 그 밖의 변경 없음. `src/types.ts`, `tests/acceptance/`, `SPEC.md`, `config/`, `seed/`, 기존 테스트 파일은 그대로다.
- `policy.ts`에서 지워진 줄은 1줄, import 줄뿐이다 (`Recommendation` 타입을 추가하면서 바뀜). 나머지 15줄은 `isOfferInScope`와 `pickBest` 사이에 새로 들어간 주석 + `offerComesFirst` 함수다. `fightApiMove`·`apiMoveFor`·`isOfferInScope`·`categoryOf`·`pickBest`·`BLOCKED`·`MOVE_ORDER`는 한 줄도 바뀌지 않았다.
- 탐침으로도 확인: main과 브랜치의 `policy.ts` export를 비교하면 차이는 `offerComesFirst` 하나이고, 기존 함수 5개의 (컴파일된) 소스 문자열과 상수 2개의 값이 main과 같다.

## 2. 실행한 명령

| 명령 | 종료 코드 | 결과 |
|---|---|---|
| `npm run test:acceptance` | 0 | 파일 11개 통과, 테스트 144 통과 / 9 건너뜀 / **실패 0** |
| `npm test` | 1 | 파일 26개 중 25 통과, 테스트 1242 통과 / **실패 1** (아래) |
| `npx tsc --noEmit` | 0 | 출력 없음 |
| `npm run lint` | 0 | 출력 없음 |

`npm test`의 실패 1건은 미리 알려진 그 테스트다: `tests/unit/sandbox-v23.test.ts > T039 1. manifest 형식 (demoExcluded·note) > 정본 manifest는 주문 13건·분쟁 4건이고 시연 제외가 1건이다` (`expected … to have a length of 4 but got 5`). 다른 실패는 없다. 이 브랜치의 diff는 그 테스트·`tests/sandbox/manifest.json`을 건드리지 않는다.

새 테스트 `tests/unit/offer-first.test.ts`는 17건 모두 통과했고, `tests/unit/recommend.test.ts` 30건·`sim.test.ts` 38건 등 기존 테스트 파일은 diff에 없다 (기대값 변경 없음).

## 3. 탐침 1: `offerComesFirst` 직접 호출

`node_modules/.bin/tsx <scratchpad>/t052-verify/probe-offer-first.ts` (cwd = 작업 폴더) → 검사 35개 모두 OK, 종료 코드 0. `recommendation`은 매번 같은 보드로 `recommend(board)`를 불러 만들었다 (설정은 `config/` 기본값).

| 경우 | `recommend` 결과 | `offerComesFirst` | 기대 |
|---|---|---|---|
| 지호 꼴 (INQUIRY, SNAD, 4800¢, B1 0.9, 링크 `send_message`·`make_offer`·`accept_claim`) | best = offer / `make_offer`, 1953¢ | **참** | 참 |
| 같은 보드, 링크 `send_message`·`accept_claim`만 (구매자 답 대기) | best = fight, `all` = fight·refund (offer 없음) | 거짓 | 거짓 |
| 서연 꼴 (INQUIRY, INR, 7200¢, A2 규칙 확신도 1, `hasTracking: true`, 네 링크) | best = fight / `send_message`, 3680¢ | 거짓 | 거짓 |
| INR, 추적 없음, A1 | best = refund | 거짓 | 거짓 |
| 허용된 수 0개 | best = null, `all` 비어 있음 | 거짓 | 거짓 |
| 원인 없음 (`make_offer` 링크는 있음) | best = null | 거짓 | 거짓 |
| 어긋남: offer 추천 + `make_offer` 없는 보드 (링크 2개 / 0개) | - | 거짓 | 거짓 |
| 어긋남: fight·refund·null 추천 + `make_offer` 있는 보드 | - | 거짓 | 거짓 |

- **전수 대조**: 세부 유형 16종 + 원인 없음 × 단계 4종 × 링크 부분집합 16가지 × 금액 6가지 × 추적 3가지 × 채널 2가지 = **39,168개 보드**. 결과가 `(best?.move === 'offer') && allowedMoves.includes('make_offer')`와 다른 경우 0건, 반환값이 boolean이 아닌 경우 0건. 참은 1,920건이고 전부 B1·B2다 (SPEC 5장 "제안은 B1·B2만"과 맞는다). `recommend`가 best = offer를 내면서 보드에 `make_offer`가 없는 경우도 0건이다.
- **교차 대조**: 추천 5종(offer·fight·refund·null 2종)을 링크 16가지 × 단계 4종 보드와 일부러 섞어 320건, 불일치 0건.
- **입력 불변**: 4가지 보드에서 호출 전후 `JSON.stringify(board)`·`JSON.stringify(recommendation)`이 같다. 깊게 얼린(`Object.freeze`) 입력으로도 예외 없이 같은 값이다. Proxy로 기록한 접근은 `recommendation.best`, `best.move`, `board.allowedMoves` 읽기 세 가지뿐이고 쓰기는 없다.
- **결정성**: 같은 입력으로 100번 불러 모두 같은 결과.
- **다시 계산하지 않음**: 함수 본문은 한 줄(`return recommendation.best?.move === 'offer' && board.allowedMoves.includes('make_offer');`)이고 `recommend(` 호출이 없다. `policy.ts`는 `./recommend`를 import하지 않는다. 동작으로도 확인: `recommend`가 refund를 낼 A1 보드(`make_offer` 있음)에 offer 추천을 넘기면 참이 나온다 (다시 계산했다면 거짓).

## 4. 탐침 2: `recommend`·`planMove`·`simulate`가 main과 같은가

`node_modules/.bin/tsx <scratchpad>/t052-verify/probe-main-equal.ts` (cwd = 작업 폴더) → 검사 17개 모두 OK, 종료 코드 0. main 체크아웃(`/Users/kaeng2/repositories/paypal-hackathon/afterloop`, `4e66d3e`, 작업 트리 깨끗함)의 엔진 파일과 이 브랜치의 엔진 파일을 한 프로세스에서 따로 불러 비교했다 (엔진은 서로를 상대 경로로 import하므로 두 벌이 섞이지 않는다. 함수 객체가 서로 다른 것도 확인).

| 함수 | 입력 | 불일치 |
|---|---|---|
| `recommend` | 보드 48,960개 (세부 유형 16 + 원인 없음 × 단계 4 × 링크 16 × 금액 5 × 추적 3 × 채널·확신도·이전 분쟁 3) | 0 |
| `planMove` | 위 보드의 `all` 평가 전부 85,680건 (그중 차단된 평가로 예외가 나는 25,776건은 예외 메시지까지 비교) | 0 |
| `simulate` | 시드 상품 4개 (`FK-CD-OAT`·`FK-SW-NV`·`FK-CT-GR`·`FK-BN-SET`) × 처방 조합 16가지 = 64건, `simInputFor` 입력과 결과 JSON | 0 |

- `recommend` + `planMove` 결과 전체의 SHA-256 앞 16자리: 브랜치 `7a5c6ee20a148d32` = main `7a5c6ee20a148d32`.
- `config/params.json`·`config/rules.json`·`seed/products.json`은 두 체크아웃에서 내용이 같다. `git diff HEAD main --stat -- src config seed`에 나오는 파일은 `src/engine/policy.ts` 하나뿐이다.

## 5. SPEC·지시서 대조

| 조항 | 확인 | 결과 |
|---|---|---|
| SPEC 9-4 "제안이 먼저": 추천이 제안이고 `make_offer`가 허용돼 있으면 참 | 탐침 1 전수 39,168건 + 교차 320건 | 일치 |
| SPEC 9-4: 판정은 엔진 함수 하나가 한다 | `src/engine/policy.ts`에 export 하나. 화면·서버 쪽 변경 없음 | 일치 |
| SPEC 5장 "수 → API" 표 (fight·offer·refund의 apiMove, 허용 안 된 수는 `all`에서 뺀다) | `fightApiMove`·`apiMoveFor` 무변경, `recommend` 48,960건 main과 동일. 답 대기 보드의 `all`에 offer 없음, 링크 0개면 best = null | 일치 (바뀐 것 없음) |
| 지시서 서명 `offerComesFirst(board: BoardState, recommendation: Recommendation): boolean` | diff | 일치 (지시서의 JSDoc 문구도 들어 있다) |
| 지시서 "그리고" 조건 | 어긋난 입력 5가지 | 일치 |
| 지시서: `recommend`를 안에서 부르지 않는다 | 소스 + 동작 | 일치 |
| 지시서: 순수 함수, 입력 불변 | JSON 비교, 얼린 입력, Proxy | 일치 |
| 지시서 완료 기준 6개 (지호 참 / 링크 없음 거짓 / 서연 거짓 / refund·null 거짓 / 불변·결정성 / 기존 테스트 무변경 통과) | `offer-first.test.ts` 17건 + 탐침 | 모두 충족 |
| 지시서: `src/types.ts` 계약 그대로 | diff에 없음 | 일치 |

## 6. 구현 보고서(`reports/T052-impl.md`) 주장 대조

사실과 다른 주장은 **보고서 머리의 시각 하나**뿐이다.

| 주장 | 대조 |
|---|---|
| 보고 시각 "2026-11-10 11:45" | **다름 (사소).** 보고서를 담은 커밋 `bf501b2`의 시각은 11:41:26이다. 보고서 시각이 커밋보다 약 4분 늦다 |
| 마지막 커밋 `5f28923` | 코드 커밋으로는 맞다. 브랜치 끝은 보고서 커밋 `bf501b2`다 (보고서가 자기 커밋 해시를 적을 수는 없다) |
| 단위 테스트 17건, 새 파일 | 맞다 (`it(` 12개 + 표로 돌린 6건 − 그 `it` 1개 = 17. 실행 결과 `17 tests`) |
| `test:acceptance` 144 통과 (+9 skip) / 0 실패 | 맞다 |
| `npm test` 1242 통과 / 1 실패, 실패는 `sandbox-v23` 1건 | 맞다 |
| `tsc`·`lint` 출력 없이 통과 | 맞다 (둘 다 종료 코드 0) |
| 실패 원인은 커밋 `c961e06`이 `tests/sandbox/manifest.json`에 `P1`을 넣고 테스트를 갱신하지 않은 것 | 맞다 (`c961e06`은 `config/demo-links.json`·`tests/sandbox/manifest.json`만 바꿨다) |
| 서연 꼴: "$72, 추적 미등록, pWin 0.30 → fight 6290¢ < refund 7400¢" | 계산은 맞다 (0.7 × 8700 + 200 = 6290, 7200 + 200 = 7400). 다만 테스트의 서연 보드는 실제 서연과 다르다 — 아래 "기록만" 2번 |
| refund 보드: "A1, 추적 없음 → refund 5000¢" | 맞다 (fight 5555¢ > refund 5000¢) |
| `offerComesFirst`를 쓰는 곳은 아직 없다 | 맞다 (`src`·`tests`·`scripts`에서 정의와 새 테스트, AC18 초안 문서뿐) |
| AC18 초안에 "메시지 보내기가 꺼져 있고 이유 문구 키가 있다" | 맞다 (`tests/acceptance/drafts/AC18.md` 48행) |
| 기존 함수는 손대지 않음, `types.ts`·`recommend`·`planMove`·`simulate` 결과 불변 | 맞다 (1장, 4장) |

## 7. 발견한 문제

### 병합 차단
없음.

### 병합 후 수정
없음.

### 기록만
1. **가정이 깨졌을 때의 동작은 호출하는 쪽 책임이다.** 함수는 추천을 다시 계산하지 않으므로, 옛 추천을 새 보드와 함께 넘기면 그대로 믿는다. 옛 추천이 offer이고 새 보드에 `make_offer`가 없으면 거짓(안전한 쪽)이지만, 옛 추천이 fight인데 새 보드에서는 offer가 추천될 상황이면 거짓이 나와 메시지가 막히지 않는다. 지시서가 정한 설계("같은 `board`로 만든 것이라고 가정")이므로 결함은 아니다. 화면·앱 서버(ui 레인)가 분쟁을 다시 읽을 때 추천도 같은 보드로 다시 만들어 넘겨야 한다.
2. **테스트의 서연 보드가 실제 서연과 다르다.** `offer-first.test.ts`의 `seoyeon()`은 `hasTracking: false`, 원인 `source: 'llm'`·확신도 0.9다. 지시서 완료 기준은 "합의 단계, INR, 원인 A2, 네 링크 모두"만 요구하므로 기준은 충족한다. 실제 꼴(규칙 확신도 1, `hasTracking: true`)은 탐침에서 따로 확인했고 결과는 같다 (best = fight 3680¢ → 거짓).
3. **테스트의 refund 보드는 reason과 원인이 어긋난다.** `jiho(subtype('A1'))`은 reason이 SNAD인 채 원인만 A1(미수령)이다. `reason`은 오토파일럿 문구 쪽에서만 쓰이고 best 계산에는 쓰이지 않아 결과에 영향이 없다. reason을 INR로 맞춘 보드는 탐침에서 확인했다 (best = refund → 거짓).
4. 구현 보고서 머리의 시각(11:45)이 커밋 시각(11:41)보다 늦다.
5. `policy.ts` 파일 머리 주석은 여전히 "SPEC v2.1 5장"이라고 적혀 있다 (이 작업 이전부터 그랬고 이번에 바뀌지 않았다).
6. 지시서는 "컨트롤 타워가 `main`을 이 브랜치에 병합해 두었다"고 하지만, 지금 `main`(`4e66d3e`)은 갈라진 지점(`03c5381`)보다 앞서 있다. 그 사이 main에서 바뀐 15개 파일(`DECISIONS.md`, `TASKS.md`, `package.json`, `package-lock.json`, `reports/` 3개, `tasks/` 6개, `tests/unit/sandbox-disputes-read.test.ts`, `tests/unit/sandbox-v23.test.ts`)은 이 브랜치가 바꾼 3개 파일과 겹치지 않는다.

## 8. 확인하지 못한 것
- **main에 병합한 뒤의 `npm test` 전체 통과.** git 상태를 바꾸지 않는 조건이라 병합을 해 보지 않았다. 겹치는 파일이 없다는 것과, 이 브랜치의 유일한 실패가 main에서 고쳐졌다는 전달받은 사실까지만 안다 (main에서 `npm test`를 직접 돌리지는 않았다).
- **화면·앱 서버가 이 함수를 올바로 쓰는지.** 쓰는 곳이 아직 없다 (ui 레인 작업, AC18 초안).
- **실제 PayPal 동작** (메시지를 보내면 `make_offer` 링크가 사라지고 구매자가 답하면 다시 열린다). SPEC 9-4장의 기록을 그대로 믿었고 샌드박스 호출은 하지 않았다.
- `recommend`의 main 동등성은 `config/` 기본값(`params`·`rules`를 넘기지 않음)으로만 비교했다. 사용자 지정 `params`·`rules`를 넘긴 경우는 비교하지 않았다 (엔진 코드 차이가 새 함수 하나뿐이라 달라질 경로는 없다).
