판정: 통과

# T047 검증 (2026-11-10, 독립 검증자)

- 대상: `lane/ui` `453812b` (구현 커밋 `6041622`), 기준 `main`, SPEC v2.6 (`SPEC.md` 첫 줄 확인)
- 방법: 지시서·SPEC·계약을 읽고 결과만 대조했다. 코드·테스트·문서·설정은 고치지 않았다. 실제 PayPal·LLM 호출 0회 (가짜 클라이언트·가짜 LLM), `.env`를 찾거나 만들지 않았고 개발 서버를 띄우지 않았다.
- 병합 차단 문제는 없다. 병합 후 고칠 것 4건, 기록 12건이 있다 (아래).

## 1. 범위 (`git diff main...HEAD --stat`)
20개 파일, +1974 / −290. 모두 지시서의 수정 가능 폴더 안이다.

- `src/app/layout.tsx`·`globals.css`·`page.tsx`·`page.module.css`(삭제), `src/app/_shared/` 8개, `src/app/_server/{paypal,llm,disputes}.ts`, `config/copy.{en,ko}.json`, `tests/unit/app-shared.test.ts`·`app-shared-disputes.test.ts`, `reports/T047-impl.md`
- `package.json`·`package-lock.json`·`src/engine`·`src/paypal`·`src/exec`·`src/ai`·`seed`·`config/demo-links.json`·`config/rules.json`·`config/params.json`·`tests/acceptance`·`tests/sandbox`·`src/types.ts`·`SPEC.md`·`tasks`: 변경 0줄
- 문구 파일을 키 단위로 비교: 바뀐 키 28개 중 `nav.`·`badge.`·`common.` 밖은 `version` 값 하나뿐 (두 파일 모두). `badge.demo`는 자리만 옮겨졌고 값은 같다
- 작업 폴더는 검증 전후 모두 깨끗하다 (`git status --short` 빈 출력. 이 보고서 파일만 새로 생김)

## 2. 실행 결과
| 명령 | 결과 | 종료 코드 |
|---|---|---|
| `npm test` | 27개 파일, 1302 통과 / 0 실패 (`app-shared.test.ts` 27건, `app-shared-disputes.test.ts` 22건) | 0 |
| `npx tsc --noEmit` | 출력 없음 | 0 |
| `npm run lint` | 오류·경고 0 | 0 |
| `npm run test:acceptance` | 11개 파일, 144 통과 / 9 건너뜀(AC13 샌드박스) / 0 실패 | 0 |
| `npm run build` | 성공. 경로는 `/`와 `/_not-found`뿐 | 0 |

## 3. 비밀값이 브라우저로 가지 않는지
- `'use client'` 파일은 `src/app/_shared/nav.tsx` 하나. import는 `next/link`·`next/navigation`·`./copy`·`./nav-items`뿐이다
- `src/app/_server/`를 import하는 곳은 단위 테스트뿐이다 (화면 코드 0곳). `_shared/`의 어느 파일도 `_server/`·`@/paypal/client`·`@/ai/llm`을 import하지 않는다
- 빌드 뒤 `.next/static/` 검색: `PAYPAL_CLIENT_SECRET` 0, `PAYPAL_CLIENT_ID` 0, `LLM_API_KEY` 0, `api-m.sandbox.paypal.com` 0, `client_credentials` 0, `PAYPAL_BASE_URL` 0, `PP-R-` 0. `.next/` 전체(cache 제외)에서도 앞의 세 글자는 0건
- `NEXT_PUBLIC_`을 쓰는 곳: `src/`·`config/`·설정 파일 0곳 (AC14 테스트의 검사 문장에만 있다)
- **장치는 약하다 (병합 후 수정 3번)**: `server-only` 패키지는 설치돼 있지 않고 import도 없다. 막는 것은 `typeof window !== 'undefined'`이면 "쓸 수 없음"을 돌려주는 실행 시점 검사와 주석 약속뿐이다. 지금 묶음 검색이 0건인 것은 `_server/`를 쓰는 화면이 아직 없어서다 (서버 코드가 아예 빌드에 들어가지 않았다)

## 4. 화면은 계산하지 않는다
`src/app/`에서 곱셈·나눗셈·`toFixed`·`parseFloat`·`/ 100`·`reduce`: 0곳. 산술은 두 곳뿐이다.

- `money.ts:40` `dollars + 1` (사사오입 올림. 자리수 문자열로 갈라 정수만 쓴다)
- `_server/disputes.ts:294` `Math.max(실제로 센 이전 분쟁 수, 시드의 이전 분쟁 수)` — 건수 비교이고 금액·확률·점수가 아니다 (기록 5번)
- `hoursToDue`·신호 값은 `src/engine/signals.ts`가 만든 것을 그대로 옮긴다. 기대 손실·추천·위험 점수는 이 작업 코드에 없다

금액 함수를 직접 불렀다.

| 입력 | `toDollarsRounded` | 입력 | `toDollarsCents` |
|---|---|---|---|
| 7400 | `$74` | 1080 | `$10.80` |
| 3680 | `$37` | 7200 | `$72.00` |
| 3650 / 3649 | `$37` / `$36` | 0 / 5 / 99 / 100 | `$0.00` / `$0.05` / `$0.99` / `$1.00` |
| 21619 | `$216` | 123456 | `$1,234.56` |
| 0 / 49 / 50 / 99 / 100 | `$0` / `$0` / `$1` / `$1` / `$1` | −720 | `-$7.20` |
| 1080 | `$11` | 0.5, NaN | 예외 |
| 99949 / 99950 | `$999` / `$1,000` | 1e21 | `$1e+.21` (예외 아님. `src/exec` 코드) |
| −3650 / −3649 / −50 | `-$37` / `-$36` / `-$1` | | |
| −49 | `-$0` (기록 4번) | | |
| 0.5, 36.5, NaN, Infinity, `"7400"`, null | 예외 ("금액은 센트 정수여야 한다") | | |
| 9007199254740991 | `$90,071,992,547,410` | | |
| 1e21 | `$NaN` (예외 아님, 기록 4번) | | |

## 5. 문구 읽기
- `t('nav.today')` → `Today`. 없는 키·빈 키·`version`·`note`·`toString`·`constructor`·`__proto__` → 모두 예외
- 자리표시자: 인수 없이 `common.demoFields` → 예외, `{fields}` → `Demo values: a, b`, 남는 인수 → 예외
- 키 집합: 영어 41개 = 한국어 41개. 한쪽에만 있는 키 0, 자리표시자가 다른 키 0, 빈 값 0
- 금지 문구(`보장`·`guarantee`·`예측 정확도`·`prediction accuracy`): 두 파일 모두 0건. 값에 `$`+숫자 0건
- `src/app/`의 tsx 4개(`layout`·`page`·`badges`·`nav`)에서 JSX 글자·`title`·`aria-label` 리터럴: 0건. 모두 `t()`를 지난다
- 서버 코드에는 영어 문장이 직접 들어 있다 (`reason` 값 7곳, 병합 후 수정 4번)

## 6. 연결 표와 분쟁 읽기 (가짜 클라이언트로 직접 호출)
가짜 목록에 6건을 넣었다: D1·D2·D3 + 옛 서연 `PP-R-GAH-10197649`(서연과 같은 구매자, INR) + 연습용 `PP-R-HEY-10197767` + 표에 없는 `PP-R-ZZZ-99999999`(서연과 같은 구매자, INR).

| 확인 | 결과 |
|---|---|
| 화면용 결과 | `D1`·`D2`·`D3` 3건만. 결과 JSON에 옛 서연·연습용·낯선 분쟁 번호 없음 |
| 조회 경로 | 목록 1회 + D1·D2·D3 상세 3회. 제외 분쟁의 상세는 읽지 않는다 |
| POST(`call`) | 0회 (모든 시나리오) |
| 서연 `boardReal.buyerPriorInrDisputes` | **0** (같은 구매자의 옛 분쟁·낯선 분쟁이 목록에 있어도) |
| 목록에 D2가 없을 때 | D2가 상세 조회로 나온다. 목록이 완전히 비어도 3건 다 나온다 |
| 한 건 상세 500 | 나머지 2건이 나온다. `paypal = { ok: true, reason: '1 dispute(s) could not be read' }` (D1·D2·D3 각각 확인) |
| 목록 조회 500 / 예외 | 예외 없이 `disputes: []`, `paypal.ok: false` (`reason`에 오류 문장이 그대로 실린다, 병합 후 수정 4번) |
| 환경 변수 없음 | 예외 없이 `disputes: []`, `paypal: { ok: false, reason: '.env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL not set' }`, `llm.ok: false`. 지시서 "만들 것 5"와 같다. 시드로 대신 채우는 동작은 없다 (지시서도 요구하지 않는다, 기록 9번) |
| live 주소 | `getPayPalClient` 거부. 가짜 값으로 만든 결과에 Secret 값 없음 |
| `isLiveSendAllowed` | D1 참, D2 참, D3 거짓, 연습용 참, 옛 서연 거짓, 표에 없음 거짓, 빈 문자열 거짓 (소문자·앞뒤 공백·`undefined`도 거짓) |
| 연결 표 모양 | `showOnScreen` 문자열, `liveSendAllowed` 누락·숫자, `paypalDisputeId`·`seedDisputeId`·`carrierOrderId` 누락, `links`·`version` 누락, `null`, 같은 번호 두 줄, 번호 꼴 틀림 → 모두 예외. 모르는 필드는 떼어 낸다 |
| POST 코드 검색 | `src/app/`에 `.call(`·`executeMove`·`POST`·`send-message`·`make-offer`·`accept-claim` 0건 |
| 서연 배송사 정보 | `carrierEvents` = 발송 → 이동 중 → 통관 보류, 전부 `isDemo: true`. `demoFields = [carrierEvents, hasTracking, cause, earlierInquiries]` |
| 서연 보드 두 개 | `boardReal`: 추적 없음, A1(규칙), `isDemo: false` / `boardDemo`: 추적 있음, A2(규칙), `isDemo: true`. 금액은 둘 다 7200¢ 그대로 |
| buyer_m | `boardDemo`: 이전 미수령 2 + 배송 완료 → F1(규칙) |
| 지호 | `boardDemo: null`, `pickBoard` = `boardReal` |
| 개인정보 | 결과 JSON에 `payer_id`·이메일·이름·응답 원문·거래 번호 없음. 구매자 글의 이메일 → `⟦EMAIL⟧`, 통관부호 → `⟦PCCC⟧` |

## 7. 배지·메뉴
- 배지 5종 있음: `DemoBadge`·`AssumptionBadge`·`AiSuggestsBadge`·`CodeDecidesBadge`·`RiskBandBadge`(Low/Watch/High). 글자는 `badge.*` 7개 키에서 온다 (`Demo data`·`Assumption`·`AI suggests`·`Code decides`·`Low`·`Watch`·`High`)
- 메뉴 4개: `/` Today, `/products` Product check, `/orders` At-risk orders, `/inbox` Inbox. Case는 메뉴에 없다
- 지금 있는 경로는 `/`뿐이다. `/products`·`/orders`·`/inbox` 링크는 화면이 생길 때까지 404다 (기록 1번)

## 8. 구현 보고서 대조
"컨트롤 타워에 요청할 결정" 2건은 모두 사실이다.

1. 배지 범위: 지호(D1)는 `boardDemo`가 `null`인데 `demoFields = ['earlierInquiries']`라 `hasDemoValues`가 참이다 (직접 확인). AC19 초안 8번에 "D1 행에는 없다"가 적혀 있다 (초안을 읽어 확인)
2. 함수 이름: `withoutDemoExcluded(disputes, links)`는 초안 이름 그대로이고 판정은 `showOnScreen`이다. `demoExcluded`는 `tests/sandbox/manifest.json`의 이름이다

보고서 주장 중 사실과 다른 것:

- **"지호·buyer_m의 주문에는 추적번호가 등록돼 있다" (남은 문제 1)**: manifest에서 지호 주문 O02는 `tracked: false`다. 등록된 것은 buyer_m의 O08뿐이다
- **"분류는 규칙으로 정해져 0회 … 요청마다 LLM 3회" (남은 문제 4)**: 지호(D1)는 규칙으로 정해지지 않아 분류에도 LLM이 불린다. 정상 응답하는 가짜 LLM으로 재니 4회(분류 1 + 어조 3), 분류가 실패하면 다시 시도해 5회다
- 나머지 숫자(테스트 49건, 1302, 144 + 9 건너뜀, 빌드 경로 2개, 표의 D1·D2·D3 값)는 맞다

## 발견한 문제

### 병합 차단
없음.

### 병합 후 수정
1. **같은 구매자 글이 두 번 세어진다** (`src/app/_server/disputes.ts:119-132` `buyerMessagesWithTime`). PayPal 응답은 접수 글을 `messages`와 `evidences[].notes`에 같은 시각·같은 글로 함께 준다. `src/paypal/mapper.ts`의 `buyerTexts`는 겹친 글을 1건으로 줄이지만 이 함수는 줄이지 않는다. 실제 고정 응답 `tests/fixtures/dispute-detail.inquiry-waiting-seller.json`(구매자가 한 번 쓴 분쟁)을 넣으면 `secondMessageUnanswered: true`가 나온다 (맞는 값은 거짓, 위험 점수 +2). 지금 D1·D2·D3는 시드 문의가 1건 이상 있어 결과가 같다. T009·T012가 신호를 화면에 잇기 전에 고친다
2. **buyer_m(D3)의 `boardReal`이 실제 값이 아니다.** 추적 정보 기본값이 "없음"이라 D3 실제 보드가 "추적 없음 → A1(규칙, 확신도 1)"이고 `demoFields`에 `hasTracking`이 시연용으로 적힌다. manifest에서 O08은 `tracked: true`다. `realTracking`을 넣으면 고쳐지는 것은 확인했지만 (`hasTracking: true`, `demoFields`에서 빠짐) 넣어 줄 화면이 정해져 있지 않다 (S5·S4·S1은 주문을 읽지 않는다). 서연(O13, 추적 없음)과 지호(O02, 추적 없음)는 맞다. 누가 넣을지 컨트롤 타워 결정이 필요하다
3. **서버 전용 장치가 약하다.** `server-only`가 없다 (`package.json`은 이 작업이 고칠 수 없다). AC14의 정적 검사는 `'use client'` 파일이 `@/paypal/client`를 직접 import하는지만 본다 — `@/app/_server/*`를 거쳐 들어오면 잡지 못한다. T009 병합 때 `.next/static/` 검색을 다시 돌리고, `server-only` 설치나 AC14 확장을 컨트롤 타워가 정한다
4. **`paypal.reason`·`llm.reason`이 화면용 문구가 아니다.** 타입 설명은 "화면에 보여도 되는 한 줄 (키 이름만)"인데 목록 조회 실패 때는 예외 문장이 그대로 실린다 (가짜 예외 문장이 그대로 나오는 것을 확인. `src/paypal`의 한국어 문장 "분쟁 목록 조회 실패 (HTTP 500)"도 그대로). 나머지 6곳은 코드에 박힌 영어 문장이다. 화면은 `reason`을 찍지 말고 `common.paypalUnavailable`·`common.llmUnavailable`만 쓰도록 T009 지시서에 적거나 `reason`을 문구 키로 바꾼다

### 기록만
1. 메뉴의 `/products`·`/orders`·`/inbox`는 아직 없는 경로다 (404). `nav.case` 키는 쓰이지 않는다
2. 문구 파일의 `version` 값이 올라갔다 (`…2026-11-10.1`). 앞머리 규칙 밖이지만 문구가 아니다
3. `nav.tsx`(클라이언트)가 `copy.ts`를 거쳐 영어·한국어 문구 파일을 통째로 브라우저 묶음에 넣는다 (v1 잔여 키 포함). 비밀값은 없다
4. `toDollarsRounded(-49)` → `-$0`, `toDollarsRounded(1e21)` → `$NaN` (예외 아님). 실제 금액 범위 밖이다
5. `disputes.ts:294`의 `Math.max`는 건수 비교다 (계산 금지 규칙의 대상인 금액·확률·점수가 아니다)
6. 구매자의 시드 문의가 주문을 가리지 않고 모두 신호에 들어간다 (buyer_m 4건, 지호 1건, 서연 2건 — 서연의 11/09 문의는 분쟁 접수 글과 같은 글). 그래서 D1·D3도 `secondMessageUnanswered: true`다. AC19 초안 "확인 필요 4"가 정할 일이다
7. 구매자 글 속 주소는 가려지지 않는다 (화면용 글과 분류 프롬프트에 그대로 들어가는 것을 확인). `maskPersonal`은 ai 레인 코드이고 이 작업 범위 밖이다. SPEC 3장은 프롬프트에 주소를 넣지 않는다고 적는다
8. `loadDemoDisputes`를 직접 두 번 부르면 PayPal을 두 번 읽는다 (조회 4회 → 8회). 한 번만 읽는 것은 `loadDemoDisputesForRequest`(React `cache`)의 몫인데 단위 테스트가 없다
9. PayPal을 쓸 수 없으면 분쟁 목록이 빈다. `.env`가 없는 ui worktree에서는 S4·S5에 분쟁이 나오지 않는다 (스크린샷 확인 때 참고)
10. `common.paypalUnavailable`은 "credentials are not set"이라고 말하는데, 목록 조회 실패 때도 `paypal.ok`가 거짓이다
11. 상세가 일부 실패하면 `paypal = { ok: true, reason }`이다 (전부 실패해도 `ok: true`에 빈 목록). 화면이 `reason`의 유무도 봐야 한다
12. `withoutDemoExcluded`는 `dispute_id` 필드가 있는 값만 받는다 (PayPal 목록 항목 모양). AC19로 옮길 때 입력 모양을 맞춘다

## 확인하지 못한 것
- **화면 모양은 보지 않았다** (개발 서버를 띄우지 않았다. 레이아웃·배지 색·어두운 모드·메뉴 강조는 컨트롤 타워의 스크린샷 확인 몫)
- `loadDemoDisputesForRequest`가 한 요청 안에서 PayPal을 한 번만 읽는지: tsx에서는 React `cache`가 묶어 주지 않아 실행으로 확인하지 못했다. 코드 읽기로만 확인했다 (서버 컴포넌트 렌더 안에서만 묶인다)
- 실제 PayPal 응답으로의 동작 (실호출 금지). 가짜 응답과 `tests/fixtures/` 고정 응답으로만 봤다
- main(v2.7)과의 병합 결과. 문구 파일은 main과 분기점이 같아 충돌이 없다는 것만 확인했다
- 구현 세션이 실호출·개발 서버 실행을 하지 않았다는 보고서 주장 (코드에서는 확인할 수 없다)

## 탐침 스크립트 (저장소 밖)
- `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/t047-verify/probe.ts` (연결 표·분쟁 읽기·금액·문구·배지·메뉴)
- `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/t047-verify/probe2.ts` (실제 고정 응답, 어조, LLM 프롬프트)
- `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/t047-verify/probe3.ts` (LLM 호출 횟수)
- `_server/` 모듈은 `server-only`를 쓰지 않아 tsx로 직접 불러졌다
