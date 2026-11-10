# T037 보고 (2026-11-10 09:15)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: **예**)
- 브랜치 / 마지막 커밋: `lane/paypal` / `6e9e3ae`

## 결과

**막힘** — 이 worktree의 `.claude/settings.local.json`이 `Edit(/src/**)`를 막아서 T037의 핵심인
`src/paypal/disputes.ts`·`src/paypal/mapper.ts`를 고칠 수 없다. 지시서의 "수정 가능 폴더"보다 잠금이 더 좁다.
작업 세션은 `.claude/`를 고치지 않으므로(`Edit(/.claude/**)`도 막혀 있다) 스스로 풀 수 없다.
할 수 있는 것(새 예시 자료)만 넣고, 반쪽짜리로 깨지는 커밋은 만들지 않았다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `tests/fixtures/dispute-detail.claim-under-review.json` | 새로 추가. 지시서 4번의 D2 꼴 (`messages` 키 없음, `evidences` 1건 `SUBMITTED_BY_BUYER`, `links`는 `self`·`provide_supporting_info`, 기한 없음, 72.00 USD, `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`, `CHARGEBACK`/`INTERNAL`, `UNDER_REVIEW`/`UNDER_PAYPAL_REVIEW`). 이름·이메일·`payer_id`는 지어낸 값(`TESTBUYER00001` 등) |

손대지 못한 파일: `src/paypal/disputes.ts`, `src/paypal/mapper.ts` (잠김).
그 두 곳이 먼저 바뀌어야 뜻이 있는 `scripts/sandbox/disputes-read.ts`와 단위 테스트 3개는 손대지 않았다
(먼저 고치면 컴파일되지 않는 커밋이 된다).

## 막힌 두 가지 (사람이 풀어야 한다)

1. **`Edit(/src/**)` 잠금.** `.claude/settings.local.json`의 deny 목록에
   `Edit(/src/**)`, `Edit(/seed/**)`, `Edit(/config/**)`가 있다. 다른 레인(ai·ui)의 잠금이 이 worktree에
   남아 있는 것으로 보인다. `src/paypal/disputes.ts`와 `src/paypal/mapper.ts` 둘 다 Edit이 거부됐다
   (실제로 시도해서 확인: "File is in a directory that is denied by your permission settings").
   → `Edit(/src/**)`를 `Edit(/src/engine/**)`·`Edit(/src/ai/**)`·`Edit(/src/app/**)`처럼 좁히거나,
   paypal 레인용 잠금으로 바꿔야 한다.
2. **`git merge main`이 권한 대기로 거부됐다** (이 세션은 승인 프롬프트를 받을 수 없다).
   다만 `HEAD..main`을 읽어 확인한 결과 main에 더 있는 것은 T035뿐이고
   (`src/ai/tokens.ts`, `tests/unit/tokens.test.ts`, `DECISIONS.md`, `TASKS.md`, `reports/`),
   **`src/paypal`·`scripts/sandbox`·`tests/fixtures`는 건드리지 않는다.** 그래서 병합이 안 된 것 자체가
   T037의 내용을 막지는 않는다.

## 테스트 결과

예시 자료만 더한 상태(= 기준선)에서 돌렸다. 실제 PayPal 호출(`npm run sandbox:*`)은 **한 번도 하지 않았다.**

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 118 (건너뜀 9) | 1 | 아래 AC17 1건만. 지시서가 적어 둔 그 1건이다 |
| `npm test` | 986 | 0 | |
| `npx tsc --noEmit` | 통과 | 0 | 출력 없음 |
| `npm run lint` | 통과 | 0 | 출력 없음 |

실패 1건: `tests/acceptance/ac17.seed.test.ts > AC17 문의 31건 (원문 6-3) > 서연의 대표 문의 원문이 그대로 있다`.
원인은 T036(서연 문장)이 아직 `lane/paypal`에 병합되지 않은 것 — 지시서 완료 기준이 "그 1건만이면 정상"이라고
적어 둔 경우와 같다. T037이 만든 것과는 상관없다.

## 남은 문제

T037의 1·2·3번(스키마, `buyerMessages`, 출력 칸 3개)과 그에 딸린 단위 테스트가 그대로 남아 있다.
잠금이 풀리면 바로 이어 할 수 있도록, 읽어 보고 정한 것을 적어 둔다.

- **스키마**: `disputeDetailSchema`에 `evidences: z.array(evidenceSchema).optional().default([])`를 더하고,
  `evidenceSchema`는 `evidence_type`·`notes`·`source`·`date` 모두 `z.string().optional()`.
  항목 안의 `dispute_life_cycle_stage`처럼 모르는 키는 지금처럼 zod가 떼낸다.
- **`buyerMessages` 순서 규칙 (지시서를 읽고 정한 해석 — 확인 필요)**: 지시서는 "시각이 있으면 이른 것부터,
  없으면 `messages` 먼저 그다음 `evidences`"라고만 적혀 있어서 **섞여 있을 때**가 정해지지 않는다.
  시각이 있는 글을 시각 순으로 먼저 늘어놓고, 시각이 없는 글을 그 뒤에 원래 순서(`messages`→`evidences`)로
  붙이는 쪽으로 하려 했다. 이러면 순서가 전이적이고 같은 입력에 항상 같은 결과가 나온다.
  시각 비교는 문자열 비교가 아니라 `Date.parse`로 한다 (`...25Z`와 `...25.608Z`를 문자열로 비교하면
  `.`(0x2E) < `Z`라서 거꾸로 선다). 읽을 수 없는 시각은 "시각 없음"으로 본다.
- **개수만 내보내기**: 구매자 글이 스크립트 쪽으로 흘러가지 않게, `mapper`에서 배열이 아니라
  `countBuyerTexts(detail): number`만 내보내려 했다 (`toClassifyInput`은 안쪽 함수를 그대로 쓴다).
  `otherActions`는 `otherLinkRels(links): string[]` (`self`와 `MoveType` 4개를 뺀 rel, 처음 나온 순서, 중복 1회).

## 컨트롤 타워에 요청할 결정

1. **(막힘) `.claude/settings.local.json`의 `Edit(/src/**)`를 paypal 레인에 맞게 풀어 달라.** 1순위다.
   지금 상태로는 누가 다시 시도해도 같은 데서 막힌다.
2. **`tests/unit/mapper.test.ts`의 기존 `toClassifyInput` 테스트 3건은 입력을 손봐야 한다** (기대값은 그대로).
   완료 기준의 "`messages`만 있는 분쟁 → 기존 테스트 기대값 변경 없이 통과"가 지금 코드에서는 그대로 되지 않는다.
   이유: 그 3건은 `detail(over)` 도움 함수로 `dispute-detail.inquiry-waiting-seller.json`에 덮어쓰는데,
   **이 fixture에는 이미 `evidences[0]`(`source: SUBMITTED_BY_BUYER`, `notes`는 `messages[0].content`와 같은 글)이
   있다.** 그래서 `evidences`를 읽기 시작하면 그 3건의 입력은 더 이상 "`messages`만 있는 분쟁"이 아니다
   (예: `detail({ messages: [] })`의 기대값 `buyerMessages: []`가 1건이 된다).
   → 입력에 `evidences: []`를 더해 "`messages`만"이라는 원래 뜻대로 좁히고 **기대값은 손대지 않는** 쪽으로
   하려 한다. 기대값을 바꾸는 것이 아니라 입력을 뜻에 맞추는 것이라 범위 안이라고 봤지만, 완료 기준 문장과
   맞물리므로 적어 둔다.
3. **`tests/unit/sandbox-disputes-read.test.ts`는 기대값이 바뀐다** (수정 가능 폴더 안이라 범위 안이지만 알려 둔다).
   `:313`이 `DisputeReadRow`의 키 집합을 그대로 비교하고 `:161`이 `disputeLine` 한 줄을 그대로 비교하므로,
   칸 3개를 더하면 두 곳을 같이 고쳐야 한다.
4. `toBoardState`는 지시서대로 그대로 뒀다. 실제 D2·D3의 `provide_supporting_info`는 계약의 `MoveType`에 없어서
   `allowedMoves`가 빈 배열로 남는다 — 계약을 바꿀지는 사람이 정할 일이라 건드리지 않았다.

---

# 재시도 (2026-11-10 09:20)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: **예**)
- 브랜치 / 마지막 커밋: `lane/paypal-client` / `35eb113`

## 결과

**완료.** `lane/paypal-client` worktree에서는 `src/paypal/**`를 고칠 수 있어서 1차 시도가 막혔던 1·2번
(스키마, `buyerMessages`)을 구현했다. 3번(출력 칸)은 지시서대로 T038로 빠져 손대지 않았다.
실제 PayPal 호출과 `npm run sandbox:*`는 **한 번도 하지 않았다.** `.env`를 찾지도 만들지도 않았다.
가짜 클라이언트와 예시 자료만 쓴 단위 테스트다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `src/paypal/disputes.ts` | `evidenceSchema`(비공개)를 더하고 `disputeDetailSchema`에 `evidences: z.array(...).optional().default([])`를 더했다. 항목의 `evidence_type`·`notes`·`source`·`date`는 모두 선택 문자열이고, 항목 안의 모르는 키(`dispute_life_cycle_stage`, `documents` 등)는 지금처럼 zod가 떼낸다 |
| `src/paypal/mapper.ts` | `buyerTexts(detail)`(비공개)를 더하고 `toClassifyInput`의 `buyerMessages`가 그것을 쓴다. `messages`(`posted_by: BUYER`) + `evidences`(`source: SUBMITTED_BY_BUYER`, `notes` 비어 있지 않음)를 함께 읽는다 |
| `tests/unit/disputes.test.ts` | 스키마 테스트 4건 추가(선택 필드·기본값, 모르는 키 떼냄, 꼴이 다르면 필드 이름만 담은 예외, D2 꼴 fixture는 `messages` 빈 배열·`evidences` 1건·기한 없음·이름·이메일 걸러짐). 기존 "빈 배열" 테스트에 `evidences` 한 줄을 더했다 |
| `tests/unit/mapper.test.ts` | `toClassifyInput: evidences의 구매자 글도 읽는다` describe 11건 추가. 기존 테스트 입력 4곳 손봄(아래) |
| `tests/fixtures/dispute-detail.claim-under-review.json` | 1차 시도가 만든 것을 확인만 했다. 지시서 4번 표와 같아 **고치지 않았다** (`messages` 키 없음, `evidences` 1건 `SUBMITTED_BY_BUYER`, `links`는 `self`·`provide_supporting_info`, 기한 없음, 72.00 USD, `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`, `CHARGEBACK`/`INTERNAL`, 이름·이메일·`payer_id`는 지어낸 값) |

`src/types.ts`, `tests/acceptance/`, `src/engine/`, `src/exec/`, `src/ai/`, `scripts/`, `seed/`, `config/`,
`tests/sandbox/`는 손대지 않았다. 계약(`ClassifyInput`)과 `toBoardState`는 그대로다.

## 정한 것 (지시서 2번 순서 규칙을 그대로 옮긴 것)

- 시각(`time_posted` / `date`)은 `Date.parse`로 비교한다. 읽을 수 없거나 빈 값은 "시각 없음"으로 본다.
- 시각 있는 글을 이른 것부터, 그 뒤에 시각 없는 글을 모은 순서(`messages` → `evidences`)로 붙인다.
  시각이 같으면 모은 순서. 비교가 전이적이라 같은 입력이면 항상 같은 순서가 나온다 (테스트로 고정).
- 같은 글(앞뒤 공백을 뺀 뒤 같은 문자열)은 **그 순서에서 먼저 오는 것**만 남기고, 남기는 값은 원문 그대로다.
- `source` 비교는 기존 `posted_by`와 똑같이 대문자로 맞춰 본다.

## 입력을 손본 기존 테스트 (기대값은 바꾸지 않았다)

1차 시도가 찾아낸 대로, `tests/unit/mapper.test.ts`의 `toClassifyInput` 테스트는
`dispute-detail.inquiry-waiting-seller.json`을 바탕으로 쓰는데 그 fixture에는 이미 `evidences[0]`
(구매자 글, `messages[0].content`와 같은 글)이 있다. "`messages`만 있는 분쟁"이라는 원래 뜻을 지키려고
**입력에만** `evidences: []`를 더했다. 기대값은 한 줄도 바꾸지 않았다.

| 테스트 | 손본 것 |
|---|---|
| `구매자가 보낸 메시지만 원문으로 넘긴다` | 입력에 `evidences: []` |
| `개인통관고유부호 모양도 가리지 않고 그대로 넘긴다` | 입력에 `evidences: []` |
| `메시지가 없으면 빈 배열, trackingEvents는 복사한다` | 입력에 `evidences: []` |
| `목록 항목도 같은 값으로 변환된다 (dispute-list.json)` | `toBoardState({ ...item, messages: [] })` → `evidences: []` 추가. `DisputeDetail`에 필드가 늘어 타입이 맞지 않아서다 (`npx tsc --noEmit`가 잡았다). `BoardState` 기대값은 그대로 |
| `links·disputed_transactions·messages가 없으면 빈 배열` (disputes.test.ts) | 이름에 `evidences`를 더하고 `expect(detail.evidences).toEqual([])` 한 줄 추가 |

## 완료 기준 대조

| 기준 | 결과 |
|---|---|
| `messages`만 있는 분쟁 → 지금과 같은 결과 | 통과 (위 표대로 입력만 좁혔다) |
| `messages` 없고 `evidences`에 구매자 글 1건 → 1건 | 통과 (새 fixture, `messages` 키 자체가 없다) |
| 같은 글 → 1건 / 다른 글 → 2건, 시각순 | 통과 (앞뒤 공백만 다른 경우도 1건) |
| 판매자 증빙 `notes`, 빈 `notes`, `notes` 없는 항목 → 제외 | 통과 (`source`가 없는 항목도 제외) |
| `evidences` 키 없는 응답 → 예외 없음 | 통과 |
| 예외 문구·로그에 구매자 글이 들어가지 않는다 | 통과 (`BoardState`에도 들어가지 않는 것까지 봤다) |

구매자 글 원문은 테스트 파일에도 베끼지 않고 fixture에서 읽어 쓴다 (`CLAIM_NOTE`). 이 보고서에도 싣지 않았다.

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 1016 | 0 | 1차 시도 때 986 → 새 단위 테스트 15건과 기존 손본 것들 포함 |
| `npm run test:acceptance` | 118 (건너뜀 9) | 1 | 아래 AC17 1건뿐. 지시서가 적어 둔 그 1건이다 |
| `npx tsc --noEmit` | 통과 | 0 | 출력 없음 |
| `npm run lint` | 통과 | 0 | 출력 없음 |

실패 1건: `tests/acceptance/ac17.seed.test.ts > AC17 문의 31건 (원문 6-3) > 서연의 대표 문의 원문이 그대로 있다`.
`seed/`의 문의 원문을 보는 테스트이고, T036(서연 문장)이 아직 이 브랜치에 병합되지 않아서다.
1차 시도(예시 자료만 있던 기준선)에서도 똑같이 실패했고, T037은 `seed/`를 손대지 않았다 — 이번 변경과 무관하다.

## 남은 문제

- 지시서 3번(`npm run sandbox:disputes` 출력 칸)은 T038로 빠져 있다. `src/paypal/mapper.ts`에는 구매자 글
  **개수**만 내보내는 공개 함수가 아직 없다. T038이 개수 칸을 넣으려면 `buyerTexts`를 그대로 쓰지 말고
  `countBuyerTexts(detail): number` 같은 개수만 돌려주는 공개 함수를 더하는 쪽이 안전하다 (원문 배열이
  스크립트 쪽으로 흘러가지 않게). 이번 작업 범위가 아니라 더하지 않았다.
- 병합 뒤 컨트롤 타워가 `npm run sandbox:disputes`를 한 번 돌려 실제 D2·D3에서 구매자 글이 읽히는지
  확인해야 한다 (이 세션은 실제 호출을 하지 않았다).

## 컨트롤 타워에 요청할 결정

1. **없음** (계약·인수 테스트·SPEC을 바꾸지 않았고, 바꿀 필요도 찾지 못했다).
2. 1차 시도의 요청 2번(기존 테스트 입력에 `evidences: []`를 더하는 것)은 지시서 재배분 때 완료 기준에
   그대로 적혀 있어 그대로 했다. 요청 1번(`src/**` 잠금)은 이 worktree에서는 해당되지 않았다.
3. (알려 두는 것) 실제 D2·D3의 `provide_supporting_info`는 계약의 `MoveType`에 없어서 `allowedMoves`가
   빈 배열로 남는다. 지시서대로 그대로 뒀고, 그 현재 동작을 테스트로 고정해 두었다
   (`D2 꼴의 BoardState는 지금 그대로다`). 계약을 바꿀지는 사람이 정할 일이다.
