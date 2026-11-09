# T003 검증 (2026-11-09 23:06 KST)
- 판정: **통과**   (실패 = 지시서·SPEC 위반, 금액 변환 오류, 개인정보·비밀값 노출, AC14 실패, 범위 밖 수정 중 하나라도 있을 때. AC15는 아직 없어 제외)
- 검증 대상: lane/paypal-client `875ccf7` (코드 커밋 `b8d7b22`, 범위 `git diff 206e95d..HEAD`) · 기준 SPEC v2.2 (첫 줄 `# SPEC v2.2 (2026-11-09 22:31 KST)` 확인, 지시서의 "기준 SPEC"과 같음)
- 판정 근거 한 줄: 범위 밖 수정 0, AC14 14/14, 단위 479/479, fixture 3개의 손 대조 24필드 전부 일치, 금액 변환 오류 0 (0.00~99.99 전수 10,000개 포함), 가짜 표식으로 본 개인정보·가짜 비밀값 노출 0건.
- 검증 방법: 코드·설정·테스트·fixture를 고치지 않았다. 실제 네트워크 호출 없음 (가짜 `PayPalClient.get`, 실제 `createPayPalClient`에는 가짜 `fetch`·`now`·`sleep`만). `.env`는 찾거나 읽지 않았다. 구현의 단위 테스트는 "돌아간다"는 사실만 쓰고 판정 근거는 아래 독립 스크립트로 만들었다. `reports/T003-impl.md`는 마지막에 읽었다.
- 임시 스크립트 (worktree 밖): `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T003/v1-mapper.mts`, `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T003/v2-fetch.mts`, `/private/tmp/claude-501/-Users-kaeng2--claude-spares-spare-ynZJEi/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/verify-T003/v3-client.mts` (+ 고치기 전 `client.ts`를 `git show`로 꺼낸 사본에 같은 시나리오를 돌린 `v3-old.mts`)
- 이 보고서에는 fixture의 구매자 이름·이메일·주소·메시지 원문을 옮기지 않았다. 표식 문자열은 전부 내가 만든 가짜 값이다.

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-only 206e95d..HEAD` | — | — | 7개: `src/paypal/client.ts`, `src/paypal/disputes.ts`, `src/paypal/mapper.ts`, `tests/unit/client.test.ts`, `tests/unit/disputes.test.ts`, `tests/unit/mapper.test.ts`, `reports/T003-impl.md`. 전부 지시서의 "수정 가능 폴더" + 보고서 |
| `git diff --name-only 206e95d..HEAD -- package.json package-lock.json config scripts tests/fixtures tests/acceptance src/types.ts SPEC.md src/engine src/exec src/app seed tasks TASKS.md DECISIONS.md CLAUDE.md README.md .claude` | — | — | 0줄. 계약 파일·fixture·설정·의존성·다른 레인 폴더 변경 없음 |
| `git diff 206e95d..HEAD -- src/paypal/client.ts` | — | — | `labelPath` 한 함수(+주석)뿐: 가리기 → 제어문자 지우기 → 다시 가리기 → 쿼리 떼기 → 자르기. 다른 함수·상수 변경 없음 |
| `git diff --numstat 206e95d..HEAD -- tests/unit/client.test.ts` | — | — | `40 0` (추가만, 삭제 0줄) |
| 새 파일의 import | — | — | `disputes.ts`: `zod`(이미 있는 의존성), `@/types`(타입). `mapper.ts`: `@/types`(타입), `./disputes`. 새 의존성 없음 |
| `npm test` | 479 | 0 | 10개 파일. `disputes.test.ts` 31, `mapper.test.ts` 54, `client.test.ts` 94 |
| `npx vitest run tests/acceptance/ac14.client.test.ts` | 14 | 0 | 기대 14개 그대로 |
| `npm run test:acceptance` | 102 | 17 | 9 skip. 실패는 `ac17.seed` 15개 + `ac13.sandbox` 2개뿐 (판정 제외 대상). 나머지 7개 파일 통과 |
| `npx tsc --noEmit` | — | 0 (대상 파일) | `error TS` 16줄 전부 `seed/` (`data.ts` 11, `index.ts` 2, `schemas.ts` 3). `src/paypal/`, `tests/unit/disputes.test.ts`·`mapper.test.ts`·`client.test.ts` 오류 0 |
| `npx eslint src/paypal tests/unit/{disputes,mapper,client}.test.ts` | — | 0 | 종료 코드 0 |
| `grep -rn "parseFloat\|\* *100\|Math.round\|toFixed" src/paypal/` | — | — | `mapper.ts`·`disputes.ts`에 0건 (`client.ts`의 `* 1000` 3건은 시간 계산, T002 코드). `mapper.ts`에서 숫자로 읽는 곳은 자리만 이어 붙인 문자열에 대한 `Number(digits)` 한 번 |
| `grep -n "\.call\|console\.\|log(" src/paypal/disputes.ts src/paypal/mapper.ts` | — | — | 0건. POST(`call`)·로그 출력 코드 없음 |
| `npx tsx …/verify-T003/v1-mapper.mts` | 94 | 0 | 손 대조·금액·단계·채널·허용된 수·기한·이전 분쟁 수. 불일치 0건 |
| `npx tsx …/verify-T003/v2-fetch.mts` | — | — | 조회 함수·개인정보 표식 시나리오 (결과는 아래 표) |
| `npx tsx …/verify-T003/v3-client.mts` / `v3-old.mts` | — | — | 쪼갠 가짜 비밀값: 지금 코드 0건, 고치기 전 코드에서는 같은 입력에 이어 붙은 값이 나온다 (재현 확인) |
| `git status -s` (끝날 때) | — | — | `?? reports/T003-verify.md` 한 줄 |

## 독립 대조·시나리오
fixture 3개에서 구매자 정보가 아닌 필드(`dispute_id`, `reason`, 단계, 채널, 기한, 금액, `links[].rel`)만 읽어 기대값을 먼저 정한 뒤 `toBoardState` 결과와 비교했다.

| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 변환 | `dispute-detail.inquiry-waiting-seller.json` | `PP-R-XWI-10197379` / `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` / `INQUIRY` / `INTERNAL` / `2026-11-29T06:09:25.608Z` / 4800 / `USD` / `[send_message, make_offer, accept_claim]` (links의 rel은 self·make_offer·send_message·accept_claim·escalate) | 8필드 같음. 결과 키는 `BoardState` 12개뿐 (`cause` 키 없음) | 예 |
| 변환 | `dispute-detail.inquiry-under-review-initial.json` (기한 필드 둘 다 없음, links는 self뿐) | 같은 ID·reason / `INQUIRY` / `INTERNAL` / 기한 없음 / 4800 / `USD` / `[]` | 8필드 같음. `dueDate`는 `''` | 예 |
| 변환 | `dispute-list.json`의 `items[0]` (links는 self뿐) | 같은 ID·reason / `INQUIRY` / `INTERNAL` / `2026-11-29T06:09:25.000Z` / 4800 / `USD` / `[]` | 8필드 같음 | 예 |
| 변환 | 입력 객체 변경 여부 | 바꾸지 않음 | 변환 전후 JSON 같음 | 예 |
| 금액 | `"48.00"`, `"35"`, `"0.07"`, `"1234.5"` | 4800, 3500, 7, 123450 | 같음 | 예 |
| 금액 | 부동소수 함정: `"0.1"`, `"0.2"`, `"0.3"`, `"0.29"`, `"0.57"`, `"1.15"`, `"4.35"`, `"8.20"`, `"19.99"`, `"64.10"` | 10, 20, 30, 29, 57, 115, 435, 820, 1999, 6410. `"0.1"`+`"0.2"`의 센트 합 30 | 같음 | 예 |
| 금액 | `0.00`~`99.99` 두 자리 값 전수 10,000개 | 불일치 0 | 0 | 예 |
| 금액 | `"48.001"`, `"1.005"`, `"-1"`, `"-0"`, `"abc"`, `""`, `" 48 "`, `"4,800.00"`, `"1e3"`, `"48."`, `".5"`, `"0x10"`, `"NaN"`, `"Infinity"`, 전각 숫자, 아랍 숫자, `"48\n"`, 숫자 `48`, `null` | 예외 | 전부 예외. 문구에 받은 값 없음 | 예 |
| 금액 | 매우 큰 값: 22자리 `"9999…9.99"`, `"90071992547409.93"`(센트 16자리) / 경계 `"9007199254740.99"`(센트 15자리) | 예외 / 900719925474099 | 예외("금액이 너무 크다") / 같음 | 예 |
| 금액 | `"007.50"` (앞자리 0) | 정해진 기대 없음 | 750으로 받는다 | — (참고) |
| 금액 | `toBoardState` 경유: `value`가 `""`·`"48.001"` / 숫자 48 | 예외 | `dispute_amount.value: 금액 꼴이 아니다 …` / `… 꼴이 다르다 (dispute_amount.value)` | 예 |
| 통화 | `EUR`, `KRW`, `usd`, `""`, `"USD "` | 예외, 받은 값 없음 | 전부 `dispute_amount.currency_code가 USD가 아니다 …` (받은 통화 값 없음) | 예 |
| 단계 | `CHARGEBACK`·`PRE_ARBITRATION`·`ARBITRATION` / 모르는 값·소문자·앞 공백 | 그대로 / 예외 (기본값으로 바꾸지 않음) | 그대로 / 예외. 문구는 필드 이름 + 받는 값 목록뿐 | 예 |
| 채널 | `EXTERNAL` / 모르는 값·소문자 | 그대로 / 예외 | 그대로 / 예외. 받은 값 없음 | 예 |
| 필수 필드 | `dispute_id`·`reason`·단계·채널·`dispute_amount`를 하나씩 뺌 | 어떤 필드인지 알 수 있는 예외 | `분쟁 상세: … (필드 이름)` 5종 | 예 |
| allowedMoves | 네 가지 + `self`·`escalate`·`acknowledge_return_item`·`appeal`·`provide_supporting_info`를 역순으로 | `[send_message, make_offer, provide_evidence, accept_claim]` (타입 선언 순서) | 같음 | 예 |
| allowedMoves | 중복 rel / `links` 없음 / `[]` / 대문자 `MAKE_OFFER` / 앞뒤 공백 | `[make_offer]` / `[]` / `[]` / `[]` / `[]` | 같음 | 예 |
| allowedMoves | `links: null` / `rel` 없는 항목 | 예외 | `… (links)` / `… (links.0.rel)` | 예 |
| dueDate | 판매자·구매자 기한 둘 다 / 판매자만 없음 / 판매자 빈 문자열 | 판매자 값 / 구매자 값 / 구매자 값 | 같음. 값은 재서식 없이 그대로 | 예 |
| dueDate | 둘 다 없음 | 타입이 허용하는 방식 | `''` (빈 문자열) | 예 (아래 사실 확인) |
| dueDate | ISO가 아닌 문자열 | 정해진 기대 없음 | 검증 없이 그대로 통과 | — (참고) |
| dueDate `''` | `BoardState.dueDate`는 `string`, `src/engine/params.ts`의 `BoardStateSchema.dueDate`는 `z.string()` | 통과 | `safeParse` 통과 | 예 |
| dueDate `''` | `recommend()` — 허용된 수 없음(검토 중 fixture) / 허용된 수 3개(대기 fixture에서 기한만 뺌), 원인 B1 직접 부여 | 예외 없음 | 예외 없음. 앞: `best: null`, `seller_review`. 뒤: `best: offer / make_offer`, `money_moves` | 예 |
| dueDate `''` | 그 보드로 `planMove(board, best)` | 예외 없음 | 예외 없음 (`make_offer`, 720¢, 기한을 읽지 않는다) | 예 |
| dueDate `''` | 기한을 읽는 코드 | — | 지금 `src/`에서 `dueDate`를 읽는 곳은 `types.ts`와 `params.ts` 스키마뿐 (화면 코드는 아직 없음). `new Date('').getTime()`은 `NaN`이고, `escalationRisk({ …, hoursToDue: NaN })`는 zod 예외를 던진다 (`hoursToDue: z.number().finite()`) | — (결정 1) |
| 엔진 맞물림 | 대기 fixture + 원인 B1 → `recommend()` → `planMove()` | 예외 없음 | fight/`send_message`, offer/`make_offer`, refund/`accept_claim` 세 수가 평가되고 `best`는 offer. `planMove` 통과 | 예 |
| 엔진 맞물림 | 원인 없음 / `EXTERNAL` | 예외 없음 | `low_confidence` / `card_company_case` | 예 |
| listDisputes | 옵션 전부 (`disputedTransactionId`에 공백·`&`·`=`·`#`·`/../`·`?`를 넣음, `startTime`에 `+09:00`) | path가 `/` 한 개로 시작, 쿼리 인코딩, 디코딩하면 넣은 값 그대로 | `/v1/customer/disputes?page_size=7&dispute_state=…%2C…&start_time=…%3A…%2B09%3A00&disputed_transaction_id=a+b%26c%3Dd%23e%2F..%2Fx%3Fy`. 디코딩 값 일치. 공백은 `%20`이 아니라 `+`로 나간다 | 예 |
| listDisputes | 옵션 없음 | `page_size` 포함 | `/v1/customer/disputes?page_size=50` | 예 |
| listDisputes | 3쪽 (`next` 2번) | 3쪽 이어 읽음 | 3건, get 3회, 2·3쪽 경로는 `next`의 경로+쿼리 | 예 |
| listDisputes | `next`가 끝없이 이어짐 | 상한에서 멈춤 | get 20회(`MAX_PAGES`)에서 멈추고 그때까지 20건을 돌려준다 (예외·표시 없음) | 예 (의견 2) |
| listDisputes | `next`가 지금 쪽을 가리킴 / A→B→A 순환 | 멈춤 | get 1회 / 2회 | 예 |
| listDisputes | `next`가 다른 호스트·live 호스트·`http`·`userinfo@`·다른 포트 | 따라가지 않음 | 예외("샌드박스 주소를 벗어난다"), 추가 get 0회 | 예 |
| listDisputes | `next`가 상대 경로·해석 불가 문자열 | 따라가지 않음 | 예외("해석할 수 없다"), 추가 get 0회 | 예 |
| listDisputes | `next`가 **같은 호스트의 다른 경로** (`/v1/oauth2/token`, `/v2/checkout/orders/…`, `/v1/customer/disputes/PP-1/accept-claim`) | 정해진 기대 없음 | **GET으로 따라간다** (POST 0회). origin만 보고 경로는 보지 않는다 | — (의견 1) |
| listDisputes | 상태 204·401·403·404·429·500 (본문에 가짜 이름·이메일) | 예외, 본문 없음 | `분쟁 목록 조회 실패 (HTTP nnn)`. `message`·`stack`에 표식 0건 | 예 |
| listDisputes | 본문이 `null`·문자열·배열·숫자 / `items`가 객체 / 항목이 문자열 / 항목 필드 꼴 틀림 / `links`가 문자열 / `dispute_id` 빈 값 | 필드 이름만 든 예외 | `… ((응답 전체))`, `(items)`, `(items.0)`, `(items.0.reason, items.0.dispute_amount.currency_code)`, `(links)`, `(items.0.dispute_id)`. 값 0건 | 예 |
| listDisputes | 본문 `{}` | 빈 배열 | `[]` | 예 |
| listDisputes | `pageSize` 0·51·1.5·NaN·`"10"`·-3 | 호출 전 예외 | 예외, get 0회 | 예 |
| getDispute | `PP-R-ABC-123`, `PP-D-27803`, `PP-1` | `/v1/customer/disputes/{id}` | 같음, POST 0회 | 예 |
| getDispute | `../x`, 공백, 앞·뒤 공백, `PP-1?x=1`, `PP-1/../../v1/oauth2/token`, `""`, 5,003자, `PP-`, 소문자, `#`, `%2F`, 줄바꿈, NUL, 전각 숫자, `;`, 역슬래시, `D1`, `null`·`undefined`·숫자·배열·객체 | 호출 0회 예외 | 전부 예외, get 0회. 문구에 받은 값 없음 | 예 |
| getDispute | 길이 경계: `PP-` + 60자 / 61자 | — | 통과 / 예외 | — (참고) |
| getDispute | 상태 204·404·500 / 본문 `null`·문자열·`messages` 꼴 틀림 | 예외 | `분쟁 상세 조회 실패 (HTTP nnn)` / 필드 이름만 든 예외 | 예 |
| getDispute | 요청한 ID와 다른 `dispute_id`가 돌아옴 | 정해진 기대 없음 | 그대로 돌려준다 (비교하지 않는다) | — (의견 3) |
| 조회만 | 위 모든 시나리오에서 `client.call` | 0회 | 0회. 실제 클라이언트로 돌렸을 때 POST는 토큰 발급 1회뿐 | 예 |
| 실제 클라이언트 | `createPayPalClient` + 가짜 `fetch`: 목록 2쪽 + 상세 1건 | path 검사 통과, 로그에 쿼리·본문 없음 | 요청 4건 (토큰 POST 1 + GET 3). 로그 4줄: `GET /v1/customer/disputes → 200` 꼴. 가짜 이름·이메일·메시지·payer·`next_page_token`·`start_time` 0건 | 예 |
| 실제 클라이언트 | 끝없는 `next` 20쪽 (가짜 시계) | 멈추지 않음 | get 20회, 실제 경과 1ms | 예 |
| countPriorInrDisputes | 같은 구매자 INR 2건 + 이번 건 | 2 | 2 | 예 |
| countPriorInrDisputes | 이번 건 + 같은 구매자 INR 1 + 다른 구매자 INR + 같은 구매자 SNAD + 구매자 키 없는 INR + 같은 구매자 `UNAUTHORISED` | 1 | 1 | 예 |
| countPriorInrDisputes | 이번 건이 SNAD이고 같은 구매자 INR 2건 / 빈 목록 / 같은 ID 중복 / `disputed_transactions` 없는 항목 / 대소문자만 다른 키 | 2 / 0 / 1 / 0 / 0 | 같음 | 예 |
| countPriorInrDisputes | `buyerKey`가 `''` / 키 없는 분쟁에 `buyerKeyOf` | 예외 | `buyerKey가 비어 있다 …` / `구매자 식별자가 없다 (disputed_transactions[].buyer.payer_id)` | 예 |
| countPriorInrDisputes | 이번 건보다 **나중에** 만들어진 같은 구매자 INR | 정해진 기대 없음 | 1로 센다 (`create_time`·종결 여부를 보지 않는다) | — (의견 4) |
| 같이 고칠 것 | 가짜 Secret·Basic·액세스 토큰을 `\n`·`\r`·`\t`·NUL·DEL·`\r\n\t`·U+001F·U+000B로 3개 위치(앞·가운데·끝)에서 쪼갠 path, GET·POST 각각 (72조합 × 2) | 거부, fetch 0, 이어 붙은 값 0 | 전부 거부, 새 fetch 0회. `message`·`stack`·`path`·열거 속성·자기 속성·로그 어디에도 이어 붙은 값 0건. `path`는 `…/[redacted]` | 예 |
| 같이 고칠 것 | 글자마다 `\n`으로 쪼갠 Secret / 쿼리 안에 쪼갠 Secret | 0건 | 0건 (`path`: `/v1/customer/disputes/[redacted]`, `/v1/customer/disputes`) | 예 |
| 같이 고칠 것 | 같은 입력을 고치기 전 `client.ts`(206e95d)에 | 이어 붙은 값이 나와야 재현 성립 | 조합마다 2건씩 나온다 (GET·POST). 수정으로 사라진 것이 맞다 | 예 |
| T002 회귀 | 정상 path + 쿼리 | 통과, 로그에 쿼리 없음 | 통과. 로그 `GET /v1/customer/disputes → 200` | 예 |
| T002 회귀 | 쪼개지 않은 Secret이 든 path | 로그에 `[redacted]` | `GET /v1/customer/disputes/[redacted] → 200` | 예 |
| T002 회귀 | `v1/x`, `//evil.example/x`, 공백, `https://…`, 역슬래시, `""` | 거부, fetch 0 | 6종 모두 거부, fetch 0회 | 예 |
| T002 회귀 | 300자 path의 로그 | 120자에서 잘림 | `…` 붙어 잘림 | 예 |

### 개인정보 표식 (가짜 응답에 넣은 가짜 값이 어디에 남는가)
넣은 표식: 구매자 이름·이메일·주소(`buyer.address`, `shipping_address`, `extensions`), 구매자 메시지(가짜 개인통관고유부호 `P123456789012` 포함), 판매자 메시지, 판매자 이름·이메일, `items[].notes`, `evidences[].notes`, `payer_id`.

| 나가는 곳 | 구매자 이름 | 이메일 | 주소 | 구매자 메시지 | `P123456789012` | 판매자 메시지 | 판매자 이름·이메일 | `payer_id` |
|---|---|---|---|---|---|---|---|---|
| `toBoardState` 결과 (검증값·원본 응답 둘 다) | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 |
| `toClassifyInput` 결과 | 없음 | 없음 | 없음 | **있음** (`buyerMessages`, 지시서대로) | **있음** (가리지 않음, 지시서대로) | 없음 | 없음 | 없음 |
| `getDispute` 반환값 | 없음 | 없음 | 없음 | 있음 (`messages[].content`) | 있음 (메시지 안) | 있음 (`messages[]`는 작성자 구분 없이 전부) | 없음 | 있음 |
| `listDisputes` 반환값 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 | 있음 |
| `buyerKeyOf` | — | — | — | — | — | — | — | `payer_id`와 같은 값 |
| 예외 10종의 `message`·`stack`·열거 속성·`cause` (단계·채널·통화·금액에 표식을 넣거나 `messages`·`buyer`·`payer_id`·`links` 꼴을 깨뜨림, 상세·목록·분류 입력 각각) | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 |
| 상태 400·404 + 본문에 표식 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 | 없음 |
| 조회·변환 중 `console` 출력 | 0줄 | | | | | | | |

- `toClassifyInput.buyerMessages`: `posted_by`가 `BUYER`(대소문자 무시)인 `content`만. `SELLER`·`ARBITER` 메시지, 빈 메시지는 빠진다. 결과 키는 `ClassifyInput` 6개뿐.
- `getDispute` 반환값의 최상위 키: `dispute_id`, `reason`, `status`, `dispute_state`, 단계, 채널, `dispute_amount`, 기한, `disputed_transactions`(거래 ID와 `buyer.payer_id`만), `links`, `messages`. 스키마에 없는 필드(`evidences`, `extensions`, `items` 등)는 떨어진다.
- 예외의 열거 속성은 `[]` (일반 `Error`, `cause` 없음).

## 지시서 대조
| 항목 | 판정 | 근거 |
|---|---|---|
| 수정 가능 폴더 안에서만 수정 | 충족 | diff 7개 파일. 금지 경로 diff 0줄 |
| `client.ts`는 "같이 고칠 것"만 | 충족 | `labelPath` 한 함수. AC14 14/14, 기존 단위 테스트 삭제 0줄 |
| `client.test.ts`는 사례 추가만 | 충족 | numstat `40 0` |
| `listDisputes(client, opts?)`: `GET /v1/customer/disputes?page_size=…`, 쿼리 퍼센트 인코딩, `next` 따라가기, 최대 쪽 수 상수 | 충족 | 시나리오 표. `MAX_PAGES = 20` |
| `getDispute(client, disputeId)`: zod 검증 값, `PP-` 꼴만, 그 밖은 호출 전 예외 | 충족 | 정상 3종 통과, 이상한 값 25종 호출 0회 |
| `toBoardState(detail, extra)` / `extra` 5개 필드를 받기만 함 | 충족 | `extra`는 꼴만 확인하고 옮긴다. `cause`는 준 경우에만 키가 생긴다 |
| `countPriorInrDisputes(disputes, buyerKey, currentDisputeId)` | 충족 | 지시서 사례 일치 (시간 순서는 의견 4) |
| 변환 규칙 표 8행 (`disputeId`·`reason`·`stage`·`channel`·`dueDate`·`amountCents`·`currency`·`allowedMoves`) | 충족 | 손 대조 24필드 + 규칙별 시나리오 |
| 금액: 부동소수로 곱하지 않음, 문자열 자리 연산, USD 외 예외 | 충족 | grep 0건, 코드 확인(정규식 → 자리 이어 붙이기 → `Number` 1회 → 안전 정수 검사), 전수 10,000개 |
| 모르는 단계·채널 → 예외 (기본값 금지) | 충족 | 시나리오 표 |
| zod로 필요한 필드만, 모르는 필드 무시, 없으면 필드 이름만 든 예외 | 충족 | 예외 문구 전수에서 값 0건 |
| 개인정보: 이름·이메일·주소·메시지 원문을 `BoardState`·로그·예외에 넣지 않음, `buyerKey`는 `payer_id` | 충족 | 표식 표 |
| `toClassifyInput`: 구매자 `content`만, 개인통관고유부호 모양은 그대로, 로그에 남기지 않음 | 충족 | 표식 표. (결정 2: `types.ts` 6부 주석과의 표현 차이) |
| 완료 기준: fixture 3개 변환 일치 | 충족 | 손 대조 |
| 완료 기준: `make_offer` 없으면 없다 / 합의 단계 fixture에 `provide_evidence` 없다 | 충족 | 검토 중 fixture `[]`, 대기 fixture에 `provide_evidence` 없음 |
| 완료 기준: 금액 문자열 표 | 충족 | 8개 값 전부 |
| 완료 기준: 모르는 단계·채널·통화 예외, 문구에 응답 값 없음 | 충족 | |
| 완료 기준: `listDisputes` 2쪽, 퍼센트 인코딩, `/`로 시작 | 충족 | |
| 완료 기준: `getDispute` 이상한 ID 호출 0회 | 충족 | |
| 완료 기준: `countPriorInrDisputes` | 충족 | |
| 완료 기준: `recommend()`에 넣어도 예외 없음 | 충족 | `planMove()`까지 확인 |
| 완료 기준: 가짜 `sleep`은 가짜 시계도 옮긴다 | 충족 | `disputes.test.ts`·`client.test.ts`의 harness가 `sleep`에서 시계를 옮긴다. 내 스크립트도 같은 방식으로 20쪽을 1ms에 읽음 |
| 완료 기준: `tsc` 자기 파일 오류 없음, AC14 그대로 | 충족 | |
| 완료 기준: AC15 | 판정 제외 | 아직 없음 |
| 하지 않을 것: 실제 PayPal 호출, 상태를 바꾸는 호출, 분류·추적·화면 | 충족 | 새 코드에 `call`·`fetch`·`process.env` 없음 |
| 같이 고칠 것: 가리기 전에 제어문자 제거 + 단위 테스트 | 충족 | 지금 코드 0건, 고치기 전 코드에서는 재현됨 |

### `reports/T003-impl.md`와 다른 곳
| 보고서의 주장 | 확인한 사실 |
|---|---|
| `tsc`: "`seed/`의 기존 오류 14줄만 남는다" | `error TS` 줄은 16개다 (`seed/data.ts` 11, `seed/index.ts` 2, `seed/schemas.ts` 3). 대상 파일 오류 0이라는 결론은 같다 |
| "쿼리 값을 퍼센트 인코딩" | 맞다. 다만 공백은 `URLSearchParams` 방식이라 `%20`이 아니라 `+`로 나간다 (이 API의 쿼리 값에는 공백이 들어갈 일이 없다) |
| "`next` 링크는 샌드박스 origin만 따라간다" | 맞다. 경로는 보지 않으므로 같은 호스트의 다른 경로도 GET으로 따라간다 (의견 1) |
| 그 밖 (파일 목록, 테스트 수 479·14·102/17/9 skip, 테스트 파일별 31·54·94, 기한 `''`, 쪽 상한 동작) | 직접 실행한 결과와 같다 |

## 발견한 문제
병합 차단: **없음**

병합 후 수정: **없음**

의견 (동작은 지시서 범위 안이고, 고칠지 말지는 다음 작업에서 정하면 된다):
1. **`next` 링크의 경로를 확인하지 않는다.** `links[rel=next].href`가 샌드박스 호스트의 다른 경로(`/v1/oauth2/token`, `/v2/checkout/orders/…`, `…/accept-claim` 등)를 가리키면 그 경로로 GET을 보낸다. 나가는 호스트는 샌드박스뿐이고(클라이언트도 다시 검사), POST는 나가지 않으며, PayPal 응답이 조작됐을 때만 생기는 일이라 영향은 작다. `url.pathname === DISPUTES_PATH` 확인 한 줄로 막을 수 있다.
2. **쪽 상한(20쪽 = 최대 1,000건)에 걸려도 표시가 없다.** 그때까지 모은 배열만 돌려주므로 호출하는 쪽은 잘렸는지 알 수 없다. 이전 분쟁 수(`countPriorInrDisputes`)를 이 목록으로 세면 적게 셀 수 있다. 샌드박스 분쟁 3건에서는 해당 없음.
3. **`getDispute`가 응답의 `dispute_id`를 요청한 ID와 비교하지 않는다.** 다른 분쟁이 돌아와도 그대로 돌려준다.
4. **`countPriorInrDisputes`는 시간 순서와 종결 여부를 보지 않는다.** "이번 건이 아닌 같은 구매자의 INR 분쟁"을 모두 센다 (이번 건보다 나중에 접수된 것도 센다). 지시서 사례와는 일치한다. SPEC 4장의 "이전 미수령 분쟁 2회 이상(이번이 3번째 이상)"을 엄밀히 보려면 `create_time` 비교가 필요하다.
5. `dueDate`는 ISO 8601인지 검증하지 않고 받은 문자열을 그대로 옮긴다 (지시서 "ISO 8601 그대로"). 깨진 값이 와도 예외가 아니다.
6. 금액 `"007.50"`처럼 앞자리에 0이 붙은 값은 750으로 받는다. PayPal이 그런 값을 보내는 사례는 확인하지 않았다.
7. `buildListPath`는 `startTime`과 `disputedTransactionId`를 함께 넣는 것을 막지 않는다. PayPal 문서상 두 값은 함께 쓸 수 없는 것으로 기억하지만, 실호출로 확인하지 않았다 (이 검증은 네트워크를 쓰지 않는다).
8. (T002 코드, 이번 수정 범위 밖) 비밀값을 제어문자가 **아닌** 문자(공백, 역슬래시, U+0085, U+200B)로 쪼갠 path는 두 조각이 떨어진 채 에러·로그에 남는다. 이어 붙지는 않으며 T002 재검증에서 이미 본 동작이다.

## 컨트롤 타워가 결정할 것
1. **기한이 없을 때 `dueDate: ''`를 계약으로 둘 것인지.** 타입(`string`)과 엔진 스키마(`z.string()`)는 받고, `recommend()`·`planMove()`는 기한을 읽지 않아 예외 없이 돈다. 문제가 될 지점은 기한으로 시간을 계산하는 쪽이다: `new Date('')`는 Invalid Date라 `hoursToDue`가 `NaN`이 되고, `escalationRisk`는 `NaN`을 zod 예외로 거부한다. PayPal 검토 중인 분쟁(검토 중 fixture)이 바로 이 경우다. 화면(S4·S5)과 확대 위험 입력을 만드는 작업 지시서에 "`dueDate === ''`이면 기한 없음으로 그리고 `escalationRisk`를 `NaN`으로 부르지 않는다"를 적을지, 아니면 `types.ts`의 `dueDate` 주석·타입을 바꿀지 결정이 필요하다. (`buyer_response_due_date`로 대신 채우는 경우 그 값은 구매자의 기한이라는 점도 화면 문구에서 구분할지 함께.)
2. **`ClassifyInput`의 개인통관고유부호.** `types.ts` 6부 주석은 "분류 입력. 이메일·주소·개인통관고유부호는 넣지 않는다"이고, T003 지시서는 "`P` + 숫자 12자리는 가리지 않고 그대로 넘긴다 (가리는 것은 분류기 T006의 일)"이다. 구현은 지시서를 따랐다 (가짜 `P123456789012`가 `buyerMessages`에 그대로 있다). SPEC 10장("LLM 프롬프트에 넣지 않으며")을 지키려면 T006 지시서에 "프롬프트를 만들기 전에 가린다"가 완료 기준으로 들어가야 하고, `getDispute` 반환값(`messages[].content`)을 화면이 그릴 때의 마스킹도 화면 작업의 몫으로 적어야 한다.
3. **데모의 D3(buyer_m, F1) 이전 분쟁 수.** `seed/data.ts`를 보면 buyer_m의 이전 INR 2건(D7·D8)은 `source: 'seed'`이고 샌드박스에는 D3 한 건만 접수된다 (SPEC 9-5). `listDisputes` 결과만으로 `countPriorInrDisputes`를 세면 0이 되어 F1 규칙(이전 2회 이상)이 걸리지 않는다. `buyerPriorInrDisputes`에 시드 건수를 더하는 곳(화면·오토파일럿 입력 조립)을 어느 작업이 맡을지 정해야 한다. T003의 범위는 아니다.
4. AC15 작성 시 넣을 만한 것: 위 의견 1(`next` 경로), 의견 4(시간 순서)를 계약으로 삼을지 여부.
