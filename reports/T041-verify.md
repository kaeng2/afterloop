판정: 통과

# T041 검증 (2026-11-10 10:58)

- 대상: `lane/paypal-exec` @ `def40d9` (기준 `main` @ `8f41645`, 갈라진 곳 `f4b0d4d`)
- 기준 SPEC: 브랜치의 `SPEC.md` 첫 줄 `# SPEC v2.4 (2026-11-10 10:44 KST)`
- 방법: 지시서(`tasks/T041.md`)·SPEC 9-1장·`src/types.ts`와 실제 결과만 대조. 코드·테스트·문서 수정 0, git 상태 변경 0 (검증 전후 `git status --short` 0줄). 실제 PayPal 호출 0회, `.env`를 찾지 않았다.
- 판정 이유 한 줄: 지시서 완료 기준 9개가 모두 재현되고 범위 위반이 없다. 다만 **"같은 분쟁의 두 번째 메시지가 나간다"는 요청 번호 값에서만 참이고, 같은 `call`(같은 서버 프로세스·같은 클라이언트)로 실행하면 두 번째 메시지는 여전히 나가지 않는다** (아래 문제 1, 병합 후 수정).

## 1. 범위

`git diff main...HEAD --stat` → 4개 파일, +270 −30.

| 파일 | 상태 | 수정 가능 범위 안인가 |
|---|---|---|
| `src/exec/request.ts` | 수정 | 예 |
| `tests/unit/exec-request-id.test.ts` | 신규 | 예 (`tests/unit/exec-*.test.ts`) |
| `tests/unit/execute.test.ts` | 수정 | 예 |
| `reports/T041-impl.md` | 신규 | 예 |

`git diff main...HEAD --name-only -- src/engine src/types.ts tests/acceptance SPEC.md` → 0줄. 범위 위반 없음.

## 2. 실행한 명령

| 명령 | 결과 | 종료 코드 |
|---|---|---|
| `npm test` | 20개 파일, 1067 통과 / 0 실패 | 0 |
| `npx tsc --noEmit` | 출력 없음 | 0 |
| `npm run lint` | 출력 없음 | 0 |
| `npm run test:acceptance` | 9개 파일 중 1개 실패. 121 통과 / **1 실패** / 9 건너뜀 | 1 |
| `npx vitest run tests/unit/exec-request-id.test.ts tests/unit/execute.test.ts` | 146 통과 / 0 실패 | 0 |

### 인수 테스트 실패 1건 — 원인은 `src/engine`
- 실패: `tests/acceptance/ac05-06-08.policy.test.ts > AC8 수 → API > 합의 단계에 증빙 링크와 메시지 링크가 함께 있으면: fight는 send_message (실제 D2의 링크 구성)` — `expected 'provide_evidence' to be 'send_message'`. 실패는 이 1건뿐이다.
- 직접 확인한 근거:
  - 이 테스트가 부르는 것은 `@/engine/recommend`의 `recommend`뿐이다 (import 8행). `src/exec/`를 import하지 않는다.
  - 값을 정하는 곳은 `src/engine/policy.ts:27` — `if (board.allowedMoves.includes('provide_evidence')) return 'provide_evidence';` (증빙 링크가 있으면 단계와 무관하게 `provide_evidence`를 고른다).
  - 이 브랜치는 `src/engine/`·`tests/acceptance/`를 한 줄도 바꾸지 않았다 (위 diff 0줄). 따라서 T041 변경과 무관하다.

## 3. 탐침 (`executeMove`를 가짜 `call`로 직접 호출)

스크립트: `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/t041-verify/probe.ts`, `probe2.ts` (저장소 밖). 계획은 `recommend`·`planMove`로 만들었다 (보드 = 인수 테스트의 D1 보드에 분쟁 ID만 `PP-R-GMS-10197661`로 바꿈, 가정값·규칙은 fixture). 판정 43건 모두 PASS, 종료 코드 0.

엔진이 만든 계획 ID: `plan-PP-R-GMS-10197661-fight-send_message-none-none`, `…-offer-make_offer-720-refund`, `…-refund-accept_claim-4800-refund`.

| 항목 | 결과 |
|---|---|
| 길이·문자 집합 (세 엔드포인트) | 통과. `al-d955086913baeee758bac530df73c4fd2` (send-message), `al-3c1f33a4fc68047a811a3b61152cce5f7` (make-offer), `al-54ecc1472af66e4479d547f4e9b46df81` (accept-claim). 모두 정확히 36자, `^al-[0-9a-f]{33}$`. 옛 형식이었다면 64 / 61 / 67자 |
| 같은 입력 100번 | 통과. 세 엔드포인트 모두 서로 다른 값 1개 |
| 프로세스를 새로 띄워도 같은 값 | 통과. 탐침을 2번 실행한 출력 51줄이 `diff`로 완전히 같다. `TZ=Asia/Tokyo LANG=C`로 바꾼 3번째 실행도 같다 |
| 메시지 한 글자만 다름 | 통과. 3개 메시지 → 3개 값 |
| 앞뒤 공백만 다른 메시지 (사실) | **서로 다른 값이다.** 원문 / 끝 공백 / 앞 공백 / 끝 줄바꿈 4개가 모두 다르다. 실행 층은 메시지를 다듬지(trim) 않고 공백째 본문에 싣는다 (`{"message":"  Could you …?  "}`) |
| 제안 금액만 다름 (계획 ID 같게 고정, 720 vs 721) | 통과. 메시지에 금액 자리표시자가 없어도 다르다 (본문의 `offer_amount.value`가 해시에 들어간다). 환불 유형만 달라도 다르다 |
| 엔드포인트만 다름 (계획 ID·메시지·금액 같음) | 통과. 3개 값. 다만 엔드포인트마다 본문 키가 달라 이것만으로는 분리가 안 되므로, 독립 재계산으로 따로 확인했다: 엔드포인트 이름을 넣어 계산한 값 = 실제 값, 이름만 바꾸거나 빼면 ≠ 실제 값 |
| 분쟁 ID만 다름 + 계획 ID 같음 (사실) | **같은 요청 번호가 나온다.** 경로는 `/disputes/PP-R-GMS-10197661/…`와 `/disputes/PP-R-GMS-10197662/…`로 다른데 요청 번호는 둘 다 `al-34b991d08feadda064df7a02e3dcbf19c`. 분쟁 ID·경로는 해시 재료가 아니다. 엔진이 만든 계획은 계획 ID에 분쟁 ID가 들어 있어 다른 값이 나온다 (`al-d955…` vs `al-c91e…`). 손으로 만든 계획 ID에서만 생기는 일이다 (문제 3) |
| 2000자 / 한국어 / 이모지 / 한국어+자리표시자 × 3 엔드포인트 | 통과 12건. 모두 36자. 계획 ID 500자 이상 + 2000자 메시지에서도 36자 |
| 원문 비노출 | 통과. 12개 요청 번호에서 `PP-R-GMS-10197661`, `10197661`, `7.20`, `48.00`, `plan`, `photo`, `color`, `refund`, `USD`, `:`, `.`, `_`, `$` 등 24개 조각을 찾았고 0건. 맨 숫자 `720`·`4800`의 우연 일치도 이번 표본에서는 0건 |
| 중복 전송 방지 | 통과. (a) 같은 `call`로 두 번 → 실제 호출 1회, 두 번째는 이전 결과. (b) 서로 다른 `call` 두 개(프로세스 재시작 흉내) → 두 호출의 `requestId`가 같다 (`al-3c1f…`). (c) 500 뒤 재시도 → 호출 2회, `requestId` 같음 |
| 두 번째 메시지 | 요청 번호는 다르다: 같은 계획 ID(`…-fight-send_message-none-none`)에 다른 메시지, 새 `call` → `al-5011b9c5…` vs `al-e67656f3…`. **같은 `call`이면 두 번째 메시지는 나가지 않는다** (문제 1) |
| 충돌 | 통과. 서로 다른 입력 100,000개(계획 ID 고정. send-message 메시지 34,000개 + make-offer·accept-claim 각 메시지 330개 × 금액 100개) → 요청 번호 100,000개, 충돌 0. 모두 36자 |
| 채운 메시지로 해시하는가 | **채운 메시지다** (SPEC과 같다). ① 문서화된 식을 탐침에서 따로 구현해 "실제로 나간 본문(`note`에 `$7.20`·`$48.00`이 채워진 글)"으로 계산한 값이 실제 `requestId`와 같고, 채우기 전 템플릿으로 계산한 값과는 다르다. ② 템플릿은 다르지만 채운 결과가 같으면(`{{offerAmount}}` vs `{{  offerAmount  }}`) 같은 값. ③ 템플릿·계획이 같고 채워지는 보드 금액만 다르면(4800 vs 4801) 다른 값. ④ 본문 키 순서를 뒤집어 계산해도 같은 값 |

## 4. 요청 번호를 만드는 곳·옛 형식 문구

- `src/exec/`에서 `requestId`·`createHash`·`randomUUID`·`Date.now`·`Math.random`·`process.pid/env/hrtime`·`planId` 이어 붙이기를 검색 → `requestId`를 만드는 곳은 `src/exec/request.ts:54` `requestIdFor` 한 곳, 쓰는 곳은 `:113` 한 곳. 시각·난수·프로세스 정보 사용 0건.
- 옛 형식 설명(`<planId>:<엔드포인트>`): `src/` 안 0건. 남은 1건은 `tests/unit/execute.test.ts:167`의 "옛 형식을 기대했던 두 단정을 새 규칙으로 바꿨다"는 변경 기록이라 사실과 맞다.

## 5. 기존 단위 테스트에서 바뀐 기대값

`git diff main...HEAD -- tests/unit/execute.test.ts` → `describe('요청 ID')` 안 2건뿐이다 (+8 −4).
1. `toBe('unit-offer-id:make-offer')` → `toMatch(/^al-[0-9a-f]{33}$/)`. 두 실행이 같은 값인지 보는 단정은 그대로.
2. `toBe('unit-accept-id:accept-claim')` → 길이 ≤ 36 + 문자 집합. 경로 단정은 그대로.

요청 번호 형식에 한정된다. 다른 단정(중복 승인, 거부 순서, 금액 표기 등)은 손대지 않았다.

## 6. 지시서 완료 기준 대조

| 기준 | 결과 |
|---|---|
| 세 엔드포인트 길이 ≤ 36, `[A-Za-z0-9-]` | 통과 (36자) |
| 같은 입력 100번 같은 값, 시각·난수·프로세스 정보 불사용 | 통과 (재실행·환경 변경 포함) |
| 메시지만 / 금액만 / 엔드포인트만 다름 → 다른 값 | 통과 |
| 2000자·한국어·이모지, `PP-R-GMS-10197661`에서도 ≤ 36 | 통과 |
| 요청 번호에 메시지 조각·분쟁 ID·금액 없음 | 통과 |
| 기존 단위 테스트 통과, 바꾼 곳 보고 | 통과 (2건, 보고서에 적혀 있음) |
| `npm run test:acceptance` 실패 0 (예고된 AC8 1건 제외) | 통과 (실패 정확히 그 1건, 원인 `src/engine/policy.ts`) |
| `npm test`, `npx tsc --noEmit`, `npm run lint` | 통과 (1067 / 0, 종료 코드 0·0·0) |
| 실제 PayPal 호출 0회 | 통과 (새 테스트는 `buildRequest`만 부른다) |
| 고칠 것 2 (만드는 곳 한 곳) / 3 (옛 형식 문구) | 통과 |

## 7. 발견한 문제

### 병합 차단
- 없음.

### 병합 후 수정
1. **같은 `call`로는 같은 분쟁의 두 번째 메시지가 여전히 나가지 않고, 보냈다고 답한다.**
   - 재현: 엔진이 만든 send_message 계획(계획 ID는 메시지와 무관하게 `plan-<분쟁 ID>-fight-send_message-none-none` 하나)을 같은 `call`로 메시지만 바꿔 두 번 실행 → 실제 호출 1회, 나간 본문은 첫 메시지뿐, 두 번째 결과도 `{ ok: true, sent: [{ path: …/send-message, status: 200 }] }`.
   - 원인: `src/exec/execute.ts:77`의 중복 승인 기억이 `planId`만 키로 쓴다 (`succeeded.get(deps.call)?.get(plan.planId)`). 요청 번호는 메시지마다 달라졌지만 이 기억이 먼저 걸린다.
   - 영향: `tasks/T027.md:31`은 "화면(T009)은 같은 클라이언트의 `call`을 재사용한다"고 적는다. 그대로면 서버 프로세스가 살아 있는 동안 SPEC 9-1장의 "메시지가 다르면 … 같은 분쟁의 두 번째 메시지도 나간다"가 화면에서 성립하지 않는다. 시연에서 한 분쟁에 메시지를 두 번 보내면 두 번째는 전송되지 않은 채 성공으로 보인다.
   - T041 이전부터 있던 동작이고(회귀 아님) 지시서의 "고칠 것"·완료 기준은 요청 번호 값만 다루므로 병합을 막지는 않는다. 다만 `request.ts:51` 주석("같은 분쟁의 두 번째 메시지가 실제로 나간다")과 구현 보고서의 같은 문장은 이 조건을 빼고 적었다.
   - 고칠 방향은 컨트롤 타워 결정이 필요하다 (예: 기억의 키를 `planId` 대신 요청 번호로). T008·T027의 "같은 `planId`가 이미 성공했으면 다시 호출하지 않는다"와 맞물린다.

### 기록만
2. **앞뒤 공백만 다른 메시지는 다른 요청 번호가 된다.** 초안을 다시 만들 때 끝 공백·줄바꿈만 달라져도 PayPal 쪽 중복 방지가 걸리지 않는다. 지시서의 "한 글자라도 다르면 다른 값"과는 맞는다.
3. **분쟁 ID·경로는 해시 재료가 아니다.** 계획 ID·본문이 같고 분쟁 ID만 다르면 요청 번호가 같다. 엔진의 계획 ID에는 분쟁 ID가 들어 있어 실제 흐름에서는 생기지 않는다 (`planIdFor` 형식이 바뀌면 다시 봐야 한다).
4. **실패 후 메시지를 고쳐 다시 실행하면 다른 요청 번호로 나간다.** `src/exec/copy.ts:61·64`의 안내("Running the same plan again reuses the same PayPal-Request-Id, so it will not send twice")는 이제 메시지가 같을 때만 참이다. 응답 없이 끊긴 호출이 PayPal에서는 처리됐고 판매자가 초안을 고쳐 다시 실행하면 두 번 나갈 수 있다. SPEC v2.4 설계의 결과다.
5. **새 테스트의 `REAL_PLAN_ID`는 엔진 형식이 아니다.** `plan-PP-R-GMS-10197661-make_offer-2026-11-12T17:00:00.000Z-0720` (63자)는 지어낸 꼴이고, 엔진 형식은 `plan-PP-R-GMS-10197661-offer-make_offer-720-refund`다. 길이 검사 목적에는 지장이 없다.
6. **새 테스트 "엔드포인트가 다르면 다른 값"은 엔드포인트 이름이 해시에서 빠져도 통과한다** (본문 키가 달라서). 구현 보고서도 "간접 확인"이라고 적었다. 이번 검증의 독립 재계산으로는 이름이 재료에 들어가 있음을 확인했다.
7. **새 테스트는 `buildRequest`만 부른다.** `executeMove`를 거친 "두 번째 메시지" 경로(문제 1)를 보는 테스트는 없다.
8. `scripts/sandbox/check-steps.ts:208` 주석 "실행 계획의 `PayPal-Request-Id`는 약 61자다"는 이제 사실이 아니다 (범위 밖 파일, 지시서가 `scripts/`는 고치지 말라고 했다). `src/types.ts:119` 주석 "같은 계획을 재시도하면 같은 값"도 "같은 계획 + 같은 본문"이 정확하다 (계약 파일, 구현 보고서가 이미 적었다).
9. 짝 없는 대리쌍(잘못된 UTF-16)이 **계획 ID**에 들어가면 서로 다른 두 계획 ID가 같은 요청 번호가 된다 (`update(…, 'utf8')`이 둘 다 U+FFFD로 바꾼다). 메시지 쪽은 JSON 직렬화가 `\ud800`으로 풀어 써서 구분된다. 계획 ID는 엔진이 ASCII로 만들므로 실제로는 생기지 않는다.

## 8. 구현 보고서의 주장 중 사실과 다른 것

| 주장 | 확인 결과 |
|---|---|
| "같은 분쟁의 두 번째 메시지는 다른 요청 번호로 나간다" | 요청 번호 값은 다르다. 하지만 같은 `call`로 실행하면 호출 자체가 나가지 않는다 (문제 1). 보고서는 `execute.ts`의 `planId` 기억을 "요청 번호와 무관하다"고만 적고 이 결과를 적지 않았다 |
| "옛 형식은 실제 길이의 계획 ID에서 49~64자" | 엔진 형식의 계획 ID + `PP-R-GMS-10197661`로 재면 send-message 64, make-offer 61, **accept-claim 67**, 반품 포함 제안은 73자다. 상한 64는 맞지 않는다 |
| 예시 `al-0e316720cbb33eb35ab9e63cadae2648e` | 새 테스트의 계획·메시지로 만든 값은 `al-72ca5a45…` / `al-002c1815…` / `al-b252b774…`이다. 예시가 어느 입력에서 나왔는지 재현하지 못했다 (형식은 맞다) |
| "`tests/acceptance/ac14.client.test.ts`에도 `'unit-plan:send-message'` 같은 문자열" | ac14에 있는 것은 `'ac14-plan:make-offer'`다 (`unit-plan:send-message`는 `tests/unit/client.test.ts`에만 있다). 임의 고정값이라 고칠 필요가 없다는 결론은 맞다 |
| "마지막 커밋 `743f1c3`" | 코드 커밋은 맞고, 브랜치 끝은 보고서 커밋 `def40d9`다 |

테스트 숫자(1067 / 0, 121 / 1 / 9 건너뜀, 146 / 0, 새 테스트 16건, `execute.test.ts` 130건)와 바꾼 단정 2건, 요청 번호를 만드는 곳이 한 곳이라는 주장은 사실과 같다.

## 9. 확인하지 못한 것

- **실제 PayPal이 이 형식을 받는지는 확인할 수 없다.** `al-` + 16진수 33자(36자, UUID 꼴이 아님)를 분쟁 API(send-message·make-offer·accept-claim)가 받는지, 같은 번호의 재전송을 한 번만 처리하는지는 실제 호출 없이는 알 수 없다. 이 검증은 실제 호출을 하지 않았다.
- 화면(`src/app/`)이 `call`을 어떻게 넘기는지: 이 브랜치와 `main`의 `src/` 어디에도 `executeMove`를 부르는 코드가 아직 없다. 문제 1이 화면에서 실제로 드러나는지는 T009 구현에 달려 있다.
- T040이 병합된 뒤 AC8 실패가 없어지는지 (이 브랜치에는 T040이 없다).
- `main`(v2.5)에 병합한 뒤의 테스트 결과. 이 검증은 브랜치 끝(`def40d9`)에서만 돌렸다.
- 구현 보고서의 예시 요청 번호가 어느 입력에서 나왔는지.
