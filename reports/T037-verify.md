판정: 통과

# T037 검증 (2026-11-10)

- 대상: `lane/paypal-client` @ `ba26e12` (코드 커밋 `35eb113`), 기준 `main` @ `0c4bc6b`, 갈라진 곳 `783635f`
- 기준 SPEC: 지시서 v2.2 = `SPEC.md` 첫 줄 `SPEC v2.2 (2026-11-09 22:31 KST)` — 같다
- 검증자는 코드·테스트·문서를 고치지 않았다. 실제 PayPal 호출(`npm run sandbox:*`)을 하지 않았고 `.env`를 찾거나 만들지 않았다.
- 구매자 글 원문은 이 보고서에 싣지 않는다 (개수·길이만).

## 1. 범위

`git log main..HEAD --oneline` — 3건: `df9eddd`(1차 시도: fixture + 보고서), `35eb113`(구현), `ba26e12`(재시도 보고서).

`git diff main...HEAD --name-status` — 6개 파일, 모두 허용 범위 안:

| 파일 | 상태 | 범위 |
|---|---|---|
| `src/paypal/disputes.ts` | M (+14 −1) | 허용 |
| `src/paypal/mapper.ts` | M (+59 −5) | 허용 |
| `tests/unit/disputes.test.ts` | M | 허용 |
| `tests/unit/mapper.test.ts` | M | 허용 |
| `tests/fixtures/dispute-detail.claim-under-review.json` | A (새 파일) | 허용 |
| `reports/T037-impl.md` | A | 허용 |

- `src/types.ts`, `tests/acceptance/`, `tests/sandbox/`, `scripts/`, `src/engine/`, `src/exec/`, `src/ai/` 변경: 0줄 (`git diff main...HEAD --stat -- <경로들>` 출력 없음).
- 기존 fixture 3개(`dispute-detail.inquiry-waiting-seller.json`, `dispute-detail.inquiry-under-review-initial.json`, `dispute-list.json`) 변경: 없음.
- 작업 폴더 `git status --short`: 검증 전 깨끗함 (검증 뒤에는 이 보고서만 추적되지 않는 파일로 남는다).

## 2. 실행 결과

| 명령 | 결과 | 종료 코드 |
|---|---|---|
| `npm test` | Test Files 18 passed (18), Tests **1016 passed (1016)** | 0 |
| `npx tsc --noEmit` | 출력 없음 | 0 |
| `npm run lint` | 출력 없음 (eslint) | 0 |
| `npm run test:acceptance` | Test Files 1 failed \| 8 passed (9), Tests **1 failed \| 118 passed \| 9 skipped (128)** | 1 |

인수 테스트 실패 1건: `tests/acceptance/ac17.seed.test.ts > AC17 문의 31건 (원문 6-3) > 서연의 대표 문의 원문이 그대로 있다` (`ac17.seed.test.ts:96`). 다른 실패는 없다.

원인을 직접 확인했다 — 이 태스크와 무관하다:
- `git diff main HEAD -- tests/acceptance` 0줄 (테스트는 양쪽이 같다).
- 테스트가 찾는 문장이 `main`의 `seed/inquiries.json`에는 1번 있고, 이 브랜치의 `seed/inquiries.json`에는 0번 있다. `git diff HEAD main -- seed/inquiries.json`이 바로 그 B01 `2026-11-09` 문의 한 건(`original`·`english`)을 바꾼다.
- 그 변경은 `main`의 `6019749`(T036)이고 `git log HEAD..main`에 들어 있다 (이 브랜치에 아직 없는 6개 커밋 중 하나).
- T037의 diff는 `seed/`를 건드리지 않는다.

## 3. 지시서 대조 (탐침 스크립트로 직접 확인)

탐침: `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/t037-verify/probe.ts` (저장소 밖). 결과 **ok 74 / FAIL 0**, 종료 코드 0. `main`의 `src/paypal/mapper.ts`·`disputes.ts`를 `git show`로 같은 폴더의 `main/`에 꺼내 놓고 나란히 불러 비교했다.

### 고칠 것 1 — 스키마

| 항목 | 결과 |
|---|---|
| `evidences` 선택 필드, 없으면 `[]` | 맞음 (`z.array(evidenceSchema).optional().default([])`) |
| 항목의 `evidence_type`·`notes`·`source`·`date` 모두 선택 문자열 | 맞음. `{}` 항목도 예외 없음 |
| 모르는 키 | 예외 없이 받는다. 결과에는 네 필드만 남는다 (zod 기본 동작 — 기존 스키마와 같은 방식). 아래 "기록만 6" 참고 |
| `evidences` 없음 / 빈 배열 | 둘 다 예외 없음 |

### 고칠 것 2 — `toClassifyInput`의 `buyerMessages`

| 경우 | 결과 |
|---|---|
| `messages`만 (`evidences: []` / 키 없음) | `main` 코드와 같은 결과 (BUYER 글만, 공백뿐인 글 제외, `posted_by` 소문자도 받음 — 예전 그대로) |
| `evidences`만 (새 fixture, `messages` 키 자체가 없음) | 1건, `evidences[0].notes`와 같은 문자열. 같은 입력에 `main` 코드는 0건 (고치기 전 문제 재현됨) |
| 둘 다 같은 글 | 1건 (기존 `inquiry-waiting-seller` fixture 그대로 넣어도 1건) |
| 둘 다 다른 글 | 2건, 시각 이른 것부터 |
| `evidences` 키 없음 / 빈 배열 / `messages`·`evidences` 둘 다 없음 | 예외 없음, `[]` |
| 중복: 앞뒤 공백(스페이스·탭·개행)만 다름 | 1건 |
| 중복: 대소문자만 다름 | 2건 (다른 글로 본다) |
| 중복: 가운데 공백 수가 다름 | 2건 |
| 중복: 같은 글 3번 (`messages` 2 + `evidences` 1 / `evidences` 3, 시각 제각각) | 1건 |
| 중복 중 무엇을 남기나 | 정렬한 뒤 먼저 오는 것. 남긴 값은 trim하지 않은 원래 문자열 |
| 순서: `...25Z` vs `...25.608Z` (밀리초 유무 섞임, 양방향) | `Date.parse` 기준으로 바르게 선다 (문자열 비교였다면 뒤집힐 배치로 확인) |
| 순서: `+09:00`과 `Z` 섞임 | 실제 시각 기준으로 선다 |
| 순서: 시각 없음 · `"not a date"` · 빈 문자열 | 시각 있는 글 뒤에, 원래 순서(`messages` 먼저, 그다음 `evidences`)로 |
| 순서: 시각이 같음 | 원래 순서 |
| 같은 입력 100번 (24건, 시각 있음·없음·못 읽음 섞음) | 100번 모두 같은 결과. 따로 짠 기준 구현과도 같은 순서 |
| 입력 객체를 바꾸는지 | 바꾸지 않는다 |
| `source` = `SUBMITTED_BY_SELLER` / `SUBMITTED_BY_PAYPAL` / `REQUESTED_FROM_BUYER` / 없음 / 빈 문자열 | 모두 제외 |
| `source` = `submitted_by_buyer` (소문자) | **구매자 글로 넣는다** (대문자로 바꿔 비교한다 — 기존 `posted_by` 처리와 같은 방식). 앞뒤에 공백이 붙은 `" SUBMITTED_BY_BUYER "`는 넣지 않는다 |
| `notes` 없음 / 빈 문자열 / 공백만 | 모두 제외 |
| 계약 `ClassifyInput` | 키 6개 그대로 (`src/types.ts` 변경 없음) |

### 이상한 입력 (표식 문자열을 `messages[].content`와 `evidences[].notes`에 넣고 검사)

모두 `parseDisputeDetail`에서 예외가 나고, 문구는 `분쟁 상세: 응답에 필요한 필드가 없거나 꼴이 다르다 (<필드 경로>)` 꼴이다. 예외 문구·스택·예외 객체의 속성 어디에도 표식이 없다 (14가지 + `extra` 오류 3가지 + 필수 필드 누락 1가지).

| 입력 | 결과 |
|---|---|
| `evidences`가 문자열 / 객체 / null / 숫자 | 예외, 경로 `evidences` |
| 항목이 null / 문자열 | 예외, 경로 `evidences.0` |
| `notes`가 숫자 / 객체 / 배열 | 예외, 경로 `evidences.0.notes` |
| `source`·`date`가 숫자, `evidence_type`이 객체 | 예외, 경로 `evidences.0.<필드>` |
| `extra.trackingEvents`에 숫자 등 `extra` 오류 | 예외, 표식 없음 |

### 고칠 것 4 — 예시 자료

`tests/fixtures/dispute-detail.claim-under-review.json`:
- `messages` 키 없음, `evidences` 1건(`evidence_type: CREATE`, `source: SUBMITTED_BY_BUYER`), `links[].rel` = `self`, `provide_supporting_info`, `seller_response_due_date`·`buyer_response_due_date` 없음 — 지시서 D2 꼴과 같다.
- `dispute_amount` 72.00 USD (거래 `gross_amount`도 72.00 USD), `reason` `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`, `CHARGEBACK` / `INTERNAL`, `UNDER_REVIEW` / `UNDER_PAYPAL_REVIEW`.
- `notes`는 지시서 코드 블록의 문장과 글자 단위로 같다 (스크립트로 비교, 길이 130자).
- 개인정보·비밀값: 이메일은 `testbuyer2@example.com`, `testseller@example.com`(예약 도메인)뿐. `payer_id` `TESTBUYER00001`, `merchant_id` `TESTSELLER00001`, 거래 ID `TESTBUYERTXN0002`·`TESTCAPTURE00002`, 분쟁 ID `PP-R-TST-20000002`, 이름 `Test Buyer Two`·`Test Seller` — 모두 지어낸 꼴이다. 20자 이상 영숫자 덩어리는 필드 이름과 reason 값뿐이고 토큰처럼 보이는 것은 없다. `href`는 샌드박스 주소다.

### 바꾸지 않는 것 — `toBoardState`

- `git diff main...HEAD -- src/paypal/mapper.ts`의 hunk 3개는 `buyerTexts` 추가(새 줄만), `toClassifyInput` 주석, `toClassifyInput` 본문이다. `toBoardState`·`toStage`·`toDueDate`·`toAllowedMoves` 줄은 바뀌지 않았다.
- 실행 비교: 기존 fixture 2개 + 새 fixture + `dispute-list.json` 항목 1건에서 HEAD와 `main`의 `toBoardState` 결과가 같다. `buyerKeyOf`도 같다.
- 새 fixture의 `BoardState`: `CHARGEBACK`, `INTERNAL`, `dueDate: ""`, `allowedMoves: []`, `amountCents: 7200`. 구매자 글은 들어 있지 않다.
- 단, 꼴이 틀린 `evidences`가 오면 달라진다 — 아래 "기록만 2".

### 완료 기준

| 기준 | 결과 |
|---|---|
| `messages`만 있는 분쟁 → 지금과 같은 결과 | 통과 (`main` 코드와 실행 비교) |
| `messages` 없고 `evidences`에 구매자 글 1건 → 1건 | 통과 |
| 같은 글 → 1건 / 다른 글 → 2건, 시각순 | 통과 |
| 판매자 증빙 `notes`, 빈 `notes`, `notes` 없는 항목 → 제외 | 통과 |
| `evidences` 키 없는 응답 → 예외 없음 | 통과 |
| 예외 문구·로그에 구매자 글 없음 | 통과 (아래 5절) |
| `npm test`·`tsc`·`lint`·인수 테스트 | 통과 (인수 테스트는 지시서가 허용한 AC17 서연 문장 1건만 실패) |

## 4. 기존 테스트의 기대값 (`git diff main...HEAD -- tests/unit`)

지워진 줄은 4줄뿐이고 모두 같은 자리에서 다시 쓰였다. **기대값을 바꾸거나 검사를 지운 곳은 없다.**

| 테스트 | 바뀐 것 |
|---|---|
| `mapper.test.ts` `구매자가 보낸 메시지만 원문으로 넘긴다` | 입력에 `evidences: []` (지시서 허용) |
| `mapper.test.ts` `개인통관고유부호 모양도 가리지 않고 그대로 넘긴다` | 입력에 `evidences: []` (지시서 허용). 줄바꿈만 달라짐 |
| `mapper.test.ts` `메시지가 없으면 빈 배열, trackingEvents는 복사한다` | 입력에 `evidences: []` (지시서 허용) |
| `mapper.test.ts` `목록 항목도 같은 값으로 변환된다 (dispute-list.json)` | `toBoardState({ ...item, messages: [] })` → `{ ...item, messages: [], evidences: [] }`. `toClassifyInput` 테스트가 아니라 지시서가 콕 집어 허용한 범위 밖이지만, `DisputeDetail` 타입에 필드가 늘어서 생긴 입력 변경이고 기대값은 그대로다 |
| `disputes.test.ts` `links·disputed_transactions·messages가 없으면 빈 배열` | 이름에 `·evidences`를 더하고 `expect(detail.evidences).toEqual([])` 1줄 추가. 기존 검사 3줄은 그대로 |

새 테스트: `disputes.test.ts` 3건, `mapper.test.ts` 13건 (합 16건).

## 5. 로그·예외

- `src/paypal/mapper.ts`, `src/paypal/disputes.ts`에 `console.` 0건 (`grep -c`). diff의 추가 줄에 `console`·`logger`·`process.std` 0건.
- 탐침에서 `console.*`와 `process.stdout/stderr.write`를 가로채고 모든 호출을 돌린 결과 출력 0회.
- 새로 더한 코드(`buyerTexts`, `postedAtOf`, `evidenceSchema`)에는 `throw`가 없다. 예외는 기존 `parseOrThrow`(필드 경로만)와 `extra` 검사(고정 문구)에서만 난다.
- 구현 보고서(`reports/T037-impl.md`)와 테스트 파일에 fixture의 구매자 문장은 들어 있지 않다 (테스트는 fixture에서 읽어 쓴다).

## 6. 발견한 문제

병합 차단: **없음.**
병합 후 수정: **없음.**

기록만:

1. **구현 보고서의 숫자가 실제와 다르다.**
   - "`mapper.test.ts` … describe 11건 추가" → 실제 새 `it` 13건.
   - "`disputes.test.ts` 스키마 테스트 4건 추가" → 실제 새 `it` 3건 + 기존 1건에 검사 1줄 추가 (괄호 안 네 항목 중 "선택 필드·기본값"이 그 기존 테스트라서 두 번 세었다).
   - "`npm test` 1016 … 986 → 새 단위 테스트 15건" → 새 테스트는 16건이다. 986은 1차 시도 때 다른 브랜치(`lane/paypal`)에서 잰 수라 이 브랜치의 기준선이 아니다 (1016 − 16 = 1000이 이 브랜치의 기준선일 것으로 추측. 직접 재지는 않았다).
   - 1016 통과·인수 118/1/9·tsc·lint 결과 자체는 내가 돌린 것과 같다.
2. **`evidences`의 꼴이 틀리면 이제 `toBoardState`·`getDispute`도 예외를 던진다.** 예: `evidences: [{ notes: null }]`, `evidences: null`, 항목이 null → HEAD는 예외(`evidences.0.notes` 등), `main`은 값을 돌려준다. 스키마는 지시서("모두 선택 문자열")대로이고 실제 응답 3건의 꼴에서는 문제가 없지만, `BoardState`가 쓰지도 않는 필드 때문에 분쟁 한 건 전체가 읽히지 않을 수 있는 범위가 넓어졌다. PayPal이 `null`을 실어 보내는지는 확인하지 못했다. 병합 뒤 컨트롤 타워의 `npm run sandbox:disputes`가 실제 3건에 대해 이것을 확인해 준다 (`scripts/sandbox/disputes-read.ts`는 건별 예외를 `problems`에 필드 이름만 담아 쌓는다).
3. `source`는 대소문자를 가리지 않는다 (`submitted_by_buyer`도 구매자 글로 넣는다). 지시서는 `SUBMITTED_BY_BUYER`라고만 적었다. 기존 `posted_by` 처리와 같은 방식이다.
4. 중복 제거 뒤 남기는 글은 trim하지 않은 원문이다 (앞뒤 공백이 있으면 공백째로 넘어간다). `main`도 `messages[].content`를 trim하지 않고 넘겼으므로 동작이 바뀐 것은 아니다.
5. `src/paypal/disputes.ts` 파일 맨 위 주석은 여전히 "구매자 메시지 원문(`messages[].content`)만 … 받아 두고"라고 적혀 있다. 이제 `evidences[].notes`도 `DisputeDetail`에 실린다 (스키마 옆 주석은 고쳐져 있다). 동작에는 영향이 없다.
6. 지시서의 "모르는 키는 지금처럼 통과시킨다"를 "예외 없이 받되 결과에서는 떼낸다"로 구현했다 (기존 스키마들과 같은 zod 기본 동작). "결과에 그대로 남긴다"는 뜻이었다면 다르다 — 지시서 문장만으로는 어느 쪽인지 정해지지 않는다.
7. fixture의 `create_time`·`evidences[0].date` (`2026-11-09T23:40:09.334Z`)는 지시서 예시 JSON의 `date`와 같은 값이다. 실제 분쟁의 시각일 수 있다 (추측). 개인정보는 아니고 지시서에 이미 적힌 값이다.
8. ISO 8601이 아닌 시각 문자열(예: `Nov 9, 2026 06:00`)은 `Date.parse`가 실행 환경의 시간대로 읽는다. PayPal 응답은 ISO 8601이라 실제 영향은 없을 것으로 본다 (추측).

## 7. 확인하지 못한 것

- 실제 PayPal 응답으로는 확인하지 않았다 (호출 금지). 실제 D2·D3에서 구매자 글이 1건씩 읽히는지는 병합 뒤 `npm run sandbox:disputes`로 봐야 한다 — 다만 그 스크립트는 지금 `buyerMessages` 개수를 출력하지 않는다 (T038).
- `main`에 병합한 뒤의 테스트 결과. `main`에만 있는 변경(`DECISIONS.md`, `TASKS.md`, `reports/STATUS.md`, `reports/T036-*`, `seed/*`, `tasks/T001.md`, `tests/unit/seed.test.ts`)과 이 브랜치의 6개 파일이 겹치지 않으므로 충돌은 없고 AC17도 통과할 것으로 추측한다. 직접 병합해 보지는 않았다 (git 상태를 바꾸지 않는 조건).
- 이 브랜치 기준선(`783635f`)의 `npm test` 수는 재지 않았다.
- 탐침은 `npx tsx` 대신 저장소의 `node_modules/.bin/tsx`를 절대경로로 불렀다 (저장소 밖 폴더에서 `npx`가 패키지를 내려받으려 하지 않게). 같은 tsx다. `main` 쪽 사본이 `zod`를 찾도록 탐침 폴더에 저장소 `node_modules`로 가는 심볼릭 링크를 하나 만들었다 (저장소 밖).
