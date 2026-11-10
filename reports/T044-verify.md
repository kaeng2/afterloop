판정: 통과

# T044 검증 (2026-11-10 11:20)

- 대상: `lane/engine` @ `57d3a8a` (기준 `main` @ `a464399`, 갈라진 곳 `4e4f4a3`)
- 기준 SPEC: 브랜치의 `SPEC.md` 첫 줄 `# SPEC v2.5 (2026-11-10 10:52 KST)`
- 방법: 지시서(`tasks/T044.md`)·SPEC 3장 "답장 속 확인 기한 날짜"·7장·`src/types.ts`·`src/engine/escalation.ts`와 실제 결과만 대조했다. 구현 보고서는 마지막에 주장 대조용으로만 읽었다. 코드·테스트·문서 수정 0, git 상태 변경 0 (검증 전후 `git status --short` 0줄. 이 파일만 새로 생겼고 커밋하지 않았다). `.env`를 찾지 않았다. 탐침 스크립트는 저장소 밖 scratchpad에만 두었다.
- 판정 이유 한 줄: 지시서 완료 기준이 모두 재현되고 범위 위반이 없다. 병합을 막을 문제는 없다. 다만 **카드사 언급 낱말이 "낱말 안쪽 부분 문자열"로도 걸린다** (`my banking app`, `postcard company`, `카드사진` → +3. 아래 문제 1, 병합 후 수정).

## 1. 범위

`git diff main...HEAD --stat` → 6개 파일, +925 −0.

| 파일 | 상태 | 범위 안인가 |
|---|---|---|
| `src/engine/followup.ts` | 신규 (134줄) | 예 |
| `src/engine/signals.ts` | 신규 (156줄) | 예 |
| `tests/unit/followup.test.ts` | 신규 (180줄) | 예 |
| `tests/unit/signals.test.ts` | 신규 (344줄) | 예 |
| `reports/T044-impl.md` | 신규 | 예 |
| `tests/acceptance/ac30.followup.test.ts` | 신규 (61줄) | 컨트롤 타워가 넣은 것 |

- AC30: `git log -- tests/acceptance/ac30.followup.test.ts` → 커밋 `147e09e` 하나뿐. `git diff 147e09e HEAD -- tests/acceptance/ac30.followup.test.ts` → 0줄 (구현자가 고치지 않았다).
- 구현자 커밋 2개(`0d3a7b2`, `57d3a8a`)의 변경 `git diff 25f0ae7 HEAD --stat` → 위 표에서 AC30을 뺀 5개 파일뿐.
- `git diff main...HEAD --numstat -- src/engine/escalation.ts src/engine/params.ts config src/types.ts` → 0줄. `git diff main HEAD`(두 점)로 같은 경로를 봐도 0줄.
- `main`이 갈라진 뒤 앞서갔다 (T042 병합, 19개 파일). `git diff 4e4f4a3 main --stat -- src/engine config src/types.ts SPEC.md tests/acceptance tests/unit/followup.test.ts tests/unit/signals.test.ts` → 0줄이라 겹치는 파일은 없다. 실제 병합은 해 보지 않았다 (git 상태를 바꾸지 않는 규칙).

## 2. 실행한 명령

| 명령 | 결과 | 종료 코드 |
|---|---|---|
| `npm run test:acceptance` | 11개 파일 중 1개 실패. 139 통과 / **5 실패** / 9 건너뜀 (합 153) | 1 |
| `npx vitest run tests/acceptance/ac30.followup.test.ts` | **9 통과 / 0 실패** | 0 |
| `npm test` | 22개 파일, 1132 통과 / 0 실패 | 0 |
| `npx tsc --noEmit` | 출력 없음 | 0 |
| `npm run lint` | 출력 없음 | 0 |
| `npx vitest run tests/unit/followup.test.ts tests/unit/signals.test.ts` | 29 + 30 = 59 통과 | 0 |
| 위 두 파일 + AC30을 `TZ=America/Los_Angeles`, `TZ=Asia/Seoul`로 각각 | 68 통과 / 0 실패 (둘 다) | 0 |

실패 5건은 모두 `tests/acceptance/ac17.seed.test.ts`의 `AC17 시연용 배송사 데이터 (v2.5)`이고 원인은 전부 `ENOENT … seed/carrier-events.json` (T045 몫). 그 밖의 실패 없음. 건너뛴 9건은 전부 AC13 실제 샌드박스(`RUN_SANDBOX=1`).

## 3. `followUpDate`·`replyFacts` 탐침

탐침 스크립트 `followup.probe.ts`: 기대값을 적어 둔 78개 비교 중 불일치 0. (기대값 없이 사실만 적은 줄은 따로 표시.)

| 항목 | 결과 |
|---|---|
| AC30의 경우 10개를 직접 다시 호출 | 전부 일치 (`2026-11-17`, `11-14`, `11-15`, 같은 날 `11-17`, `11-10`×2, 기한 없음 `11-17`, `12-04`, `2027-01-04`, 정책 생략 `11-17`) |
| `now` `2026-11-10T23:59:59Z` / `…23:59:59.999Z` | `2026-11-17` |
| `now` `2026-11-11T00:00:00Z` | `2026-11-18` |
| `now` `2026-11-10T23:30:00-05:00` (사실만) | **`2026-11-18`** — 오프셋을 UTC로 바꾼 뒤(11/11 04:30Z) 그 UTC 날짜에 7일을 더한다. `-0500`(콜론 없음)도 같다 |
| `now` `2026-11-11T02:00:00+09:00` (사실만) | `2026-11-17` (UTC 11/10 17:00) |
| `now` `2026-11-10T17:00:00` 시간대 표기 없음 / `2026-11-10 17:00:00` (사실만) | `2026-11-17` — UTC로 읽는다 |
| `disputeDueDate` `2026-11-16T23:30:00-05:00` (UTC 11/17) | `2026-11-17` (같은 날이라 당기지 않음) |
| `disputeDueDate` `2026-11-17T02:00:00+09:00` (UTC 11/16) | `2026-11-15` (하루 전으로 당김) |
| `disputeDueDate` 날짜만 `2026-11-16` / `2026-11-17` | `2026-11-15` / `2026-11-17` |
| 윤년 `2028-02-22` + 7 | `2028-02-29`. `2028-02-23` → `03-01`, 평년 `2027-02-22` → `03-01`, `2100-02-22` → `03-01`, `2000-02-22` → `02-29` |
| 연말 `2026-12-31T23:59:59Z` + 7 / `2026-12-25` + 7 | `2027-01-07` / `2027-01-01` |
| `followUpDays` 1 / 30 / 365 | `2026-11-11` / `2026-12-10` / `2027-11-10`. 30일 + 서연 기한 → `2026-11-29` |
| `now` `""`, `"not a date"`, `"2026-13-40"`, `"2026-02-30"`, `"2027-02-29"`, `T24:00:00Z`, 끝 공백, `11/10/2026`, `+25:00`, 숫자, `undefined`, `Date` 객체 | 전부 예외 (형식 오류는 `Error`, 타입 오류는 `ZodError`) |
| `disputeDueDate` `"abc"`, `" "`, `null`, `undefined`, `"2026-11-31"` | 전부 예외. 당길 필요가 없는 경우(`followUpDays: 1`)에도 `"abc"`는 예외 |
| 정책 `followUpDays` 0, -1, 1.5, `"7"`, 누락(`{}`), `NaN`, `Infinity`, `null` | 전부 `ZodError`. `replyFacts`도 같다 |
| 정책 생략 시 설정을 읽는가 | 코드: `ReplyPolicySchema.parse(policy ?? replyPolicyFromConfig())`, `replyPolicyFromConfig`는 `config/rules.json`의 `reply`. 탐침에서 같은 JSON 모듈 객체를 **메모리 안에서만** 3으로 바꾸니 `2026-11-13`, 0으로 바꾸니 `ZodError`, 되돌리니 `2026-11-17` (파일은 건드리지 않았다) |
| 금지 호출 검색 (`Date.now`, `new Date()`, `getDate`·`getHours`·`getMonth`·`getFullYear`·`getDay`·`getMinutes`, `toLocale*`, `getTimezoneOffset`, `Intl.`, `Math.random`, `process.env`, `performance`) | `followup.ts`·`signals.ts` 코드에 0건 (걸린 2줄은 주석). `Date`는 `Date.UTC(...)`와 `new Date(ms).toISOString()` 두 곳뿐 |
| `TZ=Asia/Seoul`, `America/Los_Angeles`, `Pacific/Kiritimati`, `UTC`, 미지정 | 탐침 출력 5개가 바이트 단위로 같다 (`shasum` `204d36d3…` 동일) |
| 같은 입력 100번 (동결한 입력·정책) | 결과 1종 |
| `replyFacts` | `[{"token":"⟦DATE_1⟧","kind":"DATE","value":"2026-11-17"}]` (정책 생략도 같다) |
| 토큰 코드포인트 | `U+27E6 U+0044 U+0041 U+0054 U+0045 U+005F U+0031 U+27E7`, 길이 8, NFC·NFKC 불변 |
| main 체크아웃의 `src/ai/tokens.ts`와 맞물림 | `extractTokens(초안)` → `["⟦DATE_1⟧"]`이고 `replyFacts` 토큰과 `===`. `checkTokens("…update you by ⟦DATE_1⟧.", "…⟦DATE_1⟧까지 알려 드리겠습니다.", facts)` → `ok: true`, 네 배열 모두 빈 배열. 전송본에 `11월 17일`을 직접 쓰면 `ok: false` |
| `formatFact('DATE', '2026-11-17', …)` | ko `11월 17일`, en `November 17`, ja `11月17日`, de `17. November` |
| `fillTokens(전송본, 한국어 표기로 바꾼 facts)` | `…배송사에 확인하고 11월 17일까지 알려 드리겠습니다.` |
| 엔진이 `src/ai/`를 import하는가 | `grep` 0건 (`src/engine/` 전체). `followup.ts`의 import는 `zod`, `config/rules.json`, `@/types`(타입)뿐. `signals.ts`는 `zod`, `@/types`(타입), `./followup` |

## 4. `buildEscalationSignals` 탐침

탐침 스크립트 `signals.probe.ts`: 기대값을 적어 둔 113개 비교 중 불일치 1 (내가 고른 글 `I paid with my banking app`. 문제 1). 점수는 `escalationRisk`에 이어 넣어 봤다 (가중치 `tests/acceptance/rules.fixture.json`, 기본 설정도 같은 결과. 두 JSON은 내용이 같다).

| 지시서·SPEC 문장 | 입력 | 결과 |
|---|---|---|
| 서연 6 (High) | 지시서 입력 그대로 | 신호 `true, true, false(16.4h), true, 463.63h` → **6 High** `[3,2,1,0]` |
| 답장 후 3 (Watch) | 답장 1건 (`16:59Z`, 또 `now`와 같은 시각) | `true, false, false, null` → **3 Watch** `[3,0,0,0]` |
| `angryTone: null` / `false` | 서연 | **5 High** `[3,2,0,0]` |
| 지호 17h / 25h | 글 1건, 언급 없음 | 무응답 둘 다 거짓 (0 Low) / `unansweredOver24h` 참 (2 Low) |
| 24시간 경계 | 정확히 24h / +1초 / +1ms / −1초 | 거짓 / 참 / 참 / 거짓 |
| 무응답 둘 중 하나만 +2 | 두 신호 모두 참 / 한쪽만 참 | 세 경우 모두 무응답 점수 2 |
| 기한 48h 뒤 | | `hoursToDue` 48, 기한 점수 +1 |
| 기한 72h / 72h+1초 | | 72 → +1 / 72.0003 → 0 (`escalationRisk` 몫) |
| 지난 기한 | −24h | `hoursToDue` −24, +1 |
| 기한 없음 | `''` | `HOURS_TO_DUE_NONE` = 876000 (유한, export됨), 기한 점수 0 |
| 판매자 답장 뒤 | 마지막 글 뒤 답장 | 무응답 둘 다 거짓, `angryTone` null. `now`를 이틀 뒤로 밀어도 무응답 거짓. `mentionsCardCompany`는 유지 |
| 그 뒤 구매자 새 글 | 5h 전 새 글 1건 | `angryTone` 입력값 그대로 (true / false), second 거짓, 24h 거짓 → 4 Watch. 새 글 뒤 25h → 24h 참. 새 글 2건 → second 참 |
| 답장이 두 글 사이 | | 무응답 글 1건으로 센다 (second 거짓) |
| 순서 뒤섞임 | 글·답장 순서 섞기 | 정렬 입력과 결과가 같다 |
| 같은 시각의 글과 답장 | 마지막 글과 같은 시각 답장 | 답하지 않은 것으로 본다 (`angryTone` 유지, 25h 지나면 24h 참). `+09:00`·`Z`로 표기만 다른 같은 시각도 같다. 1ms 뒤 답장은 "뒤"로 본다 |
| 날짜만 있는 `at` | `2026-11-02` | `2026-11-02T00:00:00Z`와 결과가 같다 |
| 구매자 글 0건 / 판매자 답장만 | | 언급·무응답 거짓, `angryTone` null (입력이 true여도), 0 Low |
| 잘못된 날짜 (사실만) | `at` `"nope"`·`""`, 답장 `2026-02-30`, `now` `""`, 기한 `"abc"` | 전부 `Error`. `angryTone` undefined·문자열, 배열 누락, `text` 누락은 `ZodError`. 예외 문구에 글 내용·시각 값은 실리지 않는다 (필드 이름만) |
| 결정론·불변 | 같은 입력 100번, 동결 입력 | 결과 1종, 호출 전후 입력 JSON 동일 |

낱말: 지시서 목록 12개 전부 단독·문장 속·대문자에서 참. `ChargeBack`, `My Bank`, `MEINE BANK`, `RÜCKBUCHUNG`, `credit card\ncompany`(줄바꿈)도 참.
잡히면 안 되는 글: `카드로 결제했어요`, `bank holiday`(문장 속 포함), `banking app`, `I paid with the banking app`, `online banking`, `bank transfer`, `discard`, `이의 없습니다`, `card`·`credit card` 단독, `카드`, `체크카드로 결제했어요`, 빈 글 → 전부 거짓.

시드 글 확인: `seed/disputes.json`·`seed/inquiries.json`의 문자열 225개에 낱말 목록을 대 보니 걸리는 것은 서연 문의 원문·영어 번역 2개뿐이다 (오탐 0).

## 5. 지시서 목록 밖으로 더한 것

- **`이의 제기`(띄어 쓴 꼴) 1개**: SPEC 7장이 못 박은 `이의제기`의 표준 띄어쓰기 꼴이고 같은 말이다. SPEC과 어긋나지 않는다. 공백을 한 칸으로 줄이는 처리 덕에 `이의  제기`(두 칸)도 잡힌다. 이 항목 때문에 새로 생기는 오탐은 찾지 못했다 (`이의 없습니다`는 거짓).
- 공백·줄바꿈을 한 칸으로 줄이는 정규화: 지시서에 없지만 낱말 뜻을 바꾸지 않는다.
- export가 지시서보다 많다: `FOLLOW_UP_DATE_TOKEN`, `parseUtcInstant`, `MS_PER_HOUR`, `FollowUpInput`(이상 `followup.ts`), `CARD_COMPANY_TERMS`, `SignalInput`(`signals.ts`). 계약(`src/types.ts`)에는 손대지 않았다.

## 6. 구현 보고서 대조

- 숫자(인수 139/5/9, AC30 9/9, `npm test` 1132·22파일, 추가 59건 = 29 + 30, tsc·lint 0)는 내가 돌린 결과와 같다.
- "컨트롤 타워에 요청할 결정" 4개는 모두 사실이다: `signals.ts`가 `./followup`에서 `parseUtcInstant`·`MS_PER_HOUR`를 import한다 / `SignalInput`은 `src/types.ts`에 없다 (`grep` 0건) / `PolicyConfig`에 `reply`가 없고 `rulesFromConfig()` 반환 타입이 `PolicyConfig`다 / `DUE_SOON_HOURS`(72)는 `escalation.ts` 상수, `HOURS_TO_DUE_NONE`은 `signals.ts` 상수다.
- 같은 시각 처리 설명("마지막 글과 같은 시각 답장 → 그 글만 무응답, 연달아 1건이라 second는 거짓")은 탐침 결과와 같다.
- **사실과 다른 주장은 찾지 못했다.** 빠진 것 하나: "낱말 목록은 고정 문자열 포함 검사"라고 쓰고 못 잡는 쪽(`차지백`, `은행에 문의`)만 적었다. 잘못 잡는 쪽(문제 1)은 적지 않았고, "`bank`·`card` 한 낱말은 넣지 않았다 — `bank holiday`가 걸린다"는 문장은 `my bank holiday plans`·`my banking app`이 여전히 걸린다는 점을 가린다.

## 7. 발견한 문제

### 병합 차단
없음.

### 병합 후 수정
1. **낱말이 다른 낱말의 일부여도 걸린다 (+3 오탐).** 포함 검사에 낱말 경계가 없다.
   - `I paid with my banking app` → 참 (`my bank` + `ing`). `my bankroll`, `my bank holiday plans`, `Meine Bankverbindung hat sich geändert` → 참
   - `postcard company`, `discard company`, `I work at a greeting card company` → 참 (`card company`)
   - `카드사진 보내드려요`, `포토카드사은품은 왔어요` → 참 (`카드사`)
   - 영향: 확대 위험 점수가 3 올라 Low가 Watch로 보인다 (높게 보는 쪽이고, 오토파일럿 판정에는 쓰이지 않는다). 시드 글에서는 오탐 0건이라 시연 3건의 점수는 그대로다. 지시서 완료 기준의 글(`카드로 결제했어요`, `bank holiday`)은 통과한다.
   - 고칠 곳: `src/engine/signals.ts`의 `mentionsCardCompanyIn` — 라틴 문자 낱말에는 앞뒤 경계(글자가 아닌 것)를 요구한다. `카드사진`은 한국어라 경계로 못 가르므로 받아들일지 컨트롤 타워가 정한다.

### 기록만
2. `my bank account was charged twice`(결제 설명), `이의제기 안 할게요`(부정)도 참이다. 낱말 목록 방식의 한계이고 지시서가 정한 방식이다.
3. 못 잡는 꼴: `charge back`·`charge-back`(띄어 씀), `Rueckbuchung`, 결합 문자로 쓴 `Rückbuchung`(NFD), 전각 `ｃｈａｒｇｅｂａｃｋ`, 반각 가나 `ｶｰﾄﾞ会社`, `my credit card issuer`, `the bank`, `은행에 신고할게요`, `銀行`. SPEC 7장 표는 "은행" 언급도 +3이라고 하지만 지시서 목록에 `은행` 낱말은 없다 (지시서대로 구현됨).
4. `now`보다 **뒤** 시각의 판매자 답장도 답한 것으로 본다 (`now`와 비교하지 않는다). 같은 `text`·`at`의 글이 두 번 들어오면 2건으로 세어 `secondMessageUnanswered`가 참이 된다 — 글을 모으는 쪽(ui/data)이 중복을 넣지 않아야 한다.
5. `followUpDate` 특이값: `followUpDays: 1e9` → `ZodError`가 아니라 `RangeError: Invalid time value` (예외이긴 하다). `now` `9999-12-31` → `+010000-01` (YYYY-MM-DD 아님). `now` `0050-01-01` → `1950-01-08` (`Date.UTC`의 두 자리 연도 해석). 정책에 `null`을 넘기면 설정값으로 계산한다. 소문자 `t`·`z`, 분이 없는 `T17`은 예외.
6. `CARD_COMPANY_TERMS`는 타입만 `readonly`이고 런타임 동결은 아니다. 비교에는 모듈을 읽을 때 만든 사본(`NORMALIZED_TERMS`)을 쓰므로 나중에 배열을 바꿔도 결과는 바뀌지 않는다.
7. `signals.ts`가 `followup.ts`에 기댄다 (날짜 파서 공유). 구현 보고서가 `src/engine/date.ts`로 옮길 허락을 요청했다 — 사실이고 결정은 컨트롤 타워 몫이다.

## 8. 확인하지 못한 것

- `main`(`a464399`, T042 포함)과 병합한 뒤의 테스트 결과. 겹치는 파일이 없다는 것만 확인했다.
- `config/rules.json` **파일**을 바꿨을 때의 동작 (파일 수정 금지라 메모리 안 객체로만 확인).
- 화면·서버가 실제로 부르는 경로. `src/` 안에 `followup`·`signals`를 쓰는 곳이 아직 없다 (`src/types.ts`의 주석과 `escalation.ts` 주석뿐).
- 실제 PayPal 응답의 날짜 표기 전부 (확인한 꼴: `…Z`, 밀리초, `±hh:mm`, `±hhmm`, 날짜만, 시간대 표기 없음).
- `angryTone`을 만드는 LLM 판별 (T043)과의 연결.
