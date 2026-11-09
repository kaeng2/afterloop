# T008 검증 (2026-11-09 21:54 KST)
- 판정: **통과**
- 검증 대상: lane/paypal-exec `0a33c65` (구현 커밋 `42601bd`, main `56da16f`보다 2개 앞) · 기준 SPEC v2.1 (`SPEC.md` 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)`, 지시서 "기준 SPEC v2.1"과 같음)
- 방법: 코드·설정·테스트를 고치지 않았다. 실제 PayPal 호출 없음 (`deps.call`에 가짜 함수만 주입, `RUN_SANDBOX` 해제). `.env`를 찾거나 읽지 않았다. 독립 시나리오는 worktree 밖 임시 스크립트(107건)로 돌렸다. 구현 보고(`reports/T008-impl.md`)는 내 판단을 끝낸 뒤 마지막에 읽고 대조했다.
- 병합 차단 문제: **없음**. 병합 후 수정 4건, 컨트롤 타워 결정 6건 (아래).

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-status main...HEAD` | — | — | 추가 6개뿐: `src/exec/{amount,execute,message,request}.ts`, `tests/unit/execute.test.ts`, `reports/T008-impl.md`. 수정·삭제 없음. `src/types.ts`·`tests/acceptance/`·`SPEC.md`·`config/`·`package.json`·`package-lock.json`·`src/engine/`·`src/paypal/` 변경 0건 → 범위 안, 새 의존성 없음 |
| `npx vitest run tests/acceptance/ac11-12.exec.test.ts` | 10 | 0 | AC11 6개 + AC12 4개 |
| `npm test` | 124 | 0 | 5파일. 그중 `tests/unit/execute.test.ts` 20개 |
| `npx tsc --noEmit` | — | 0 (대상 파일) | 오류 3건 모두 TS2307이고 다른 레인의 미구현 모듈: `ac04`(`@/engine/plan`), `ac07`(`@/engine/escalation`), `ac14`(`@/paypal/client`). `src/exec/`, `tests/unit/execute.test.ts` 오류 0건 |
| `npm run test:acceptance` (전체, `RUN_SANDBOX` 없음) | 37 | 2 (+ 파일 3개 로드 실패, 9개 skip) | 모두 범위 밖. ① `ac04`·`ac07`·`ac14` 로드 실패 = 위 미구현 모듈 (main에도 없음을 `git ls-tree main`으로 확인) ② `ac13` 오프라인 2건 = 루트 `.env.example`이 없고 `.gitignore`의 `.env*`가 그 파일까지 무시 (T001 레인). ③ skip 9건 = `RUN_SANDBOX=1` 전용. 통과 파일: ac01-03(11), ac05-06-08(9), ac09-10(7), ac11-12(10) |
| `npx eslint src/exec tests/unit/execute.test.ts` | — | 0 | 출력 없음 |
| `grep` (`src/exec/`에서 `Math.random`·`Date`·`toFixed`·`/100`·`*`·`parseFloat`·`console.`·`process.env`·`fetch(`) | — | — | 주석 1줄과 `Math.abs`(`amount.ts:12`, 부호 떼기)뿐. 곱셈·비율·반올림·로그·환경변수·네트워크 코드 없음 |
| 독립 시나리오 스크립트 (`npx tsx`, 가짜 `call`) | 106 | 1 | 불일치 1건은 타입 위반 입력(`status` 없는 응답) 관찰 항목. 아래 "발견한 문제" 2번 |
| `git status -s` (끝날 때) | — | — | `?? reports/T008-verify.md` 한 줄 |

## 독립 시나리오
모든 행은 내가 만든 가짜 `call`로 직접 실행한 결과다. "관찰"은 지시서·SPEC에 규정이 없어 동작만 기록한 것.

### A. 승인 없이는 호출 0회
| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| `approval: null` | `{ok:false,error,nextAction}`, 호출 0 | 그대로. error "판매자 승인이 없어 실행하지 않았습니다" | 예 |
| `planId` 불일치 (완전히 다름 / 대소문자만 / 뒤 공백만) | 거부, 호출 0 | 3건 모두 거부, 호출 0 (엄격 비교) | 예 |
| `accept_claim`, `confirmAcceptClaim` 없음 / `false` | 거부, 호출 0 | 거부, 호출 0. nextAction "전액 환불 확인란을 체크한 뒤 다시 실행하세요." | 예 |
| `accept_claim`, `confirmAcceptClaim`이 `"true"`·`1` (타입 위반) | 거부, 호출 0 | 거부, 호출 0 (`!== true`) | 예 |
| `plan.apiMove`가 `board.allowedMoves`에 없음 (make_offer / accept_claim / 빈 배열) | 거부, 호출 0 | 3건 모두 거부, 호출 0. error에 허용 목록 표시 | 예 |
| `plan.disputeId !== board.disputeId` | 거부, 호출 0 | 거부, 호출 0 | 예 |
| `approval: undefined` (타입 위반, 관찰) | 호출 0 | 호출 0. 단 `{ok:false}`가 아니라 `TypeError` 예외 | 예 (호출 0) |

### B. 한 계획에 호출 1회, 경로·본문
| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| `make_offer` | make-offer 1회, send-message 없음, 본문 `{note, offer_amount:{currency_code:'USD',value:'7.20'}, offer_type:'REFUND'}`, 경로 `/v1/customer/disputes/PP-V-1/make-offer`, `requestId 'plan-1:make-offer'` | 요청 1건, 키·값 정확히 일치 (추가 키 없음). 결과 `{ok:true,sent:[{path,status:200}]}` | 예 |
| `make_offer`, `refundType: 'REFUND_WITH_RETURN'` | `offer_type: 'REFUND_WITH_RETURN'` | 그대로 | 예 |
| `send_message` | send-message 1회, 본문 `{message}`만, `requestId 'plan-2:send-message'` | 그대로 (`"$48.00 결제 건 안내드립니다."`) | 예 |
| `accept_claim` (확인 플래그 true) | accept-claim 1회, 본문 `{note, accept_claim_type: plan.refundType, refund_amount:{currency_code:'USD',value:'48.00'}}`, `requestId 'plan-3:accept-claim'` | 그대로 | 예 |
| `provide_evidence` (허용됨·승인됨) | 실행 안 함, 호출 0, nextAction에 PayPal 화면 직접 증빙 제출 안내 | `{ok:false, error:"증빙 제출(provide_evidence)은 이 앱에서 보내지 않습니다", nextAction:"PayPal 화면에서 직접 증빙 제출을 진행하세요."}`, 호출 0 | 예 |
| `provide_evidence` (허용 안 됨) | 거부, 호출 0 | 같은 문구로 거부, 호출 0 | 예 |
| `make_offer`인데 `amountCents` null / `refundType` null | 호출 0 거부 (본문을 만들 수 없음) | 2건 모두 거부, 호출 0 | 예 |
| `send_message`인데 빈 메시지 | 호출 0 거부 | 거부, 호출 0 | 예 |
| `make_offer`인데 빈 메시지 (관찰) | 규정 없음 | **호출 1회**, 본문에 `note` 키 없음 (`{offer_amount, offer_type}`) | 해석 필요 |
| `make_offer`인데 초안에 금액 자리표시자가 없음 (관찰) | 규정 없음 | 호출 1회. `note`에 금액 없이 나감 (본문 금액은 7.20) | 해석 필요 |
| `plan.currency: 'EUR'` (타입 위반, 관찰) | `currency_code`는 `'USD'` | `currency_code: 'EUR'`로 나가고 메시지는 `$7.20` (`request.ts:52`가 상수가 아니라 `plan.currency`를 옮김) | 의견 |

### C. 메시지 금액 = API 본문 금액
| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 1·5·99·100·720·1005·123456·99999999센트 × (`make_offer` `{{offerAmount}}` / `accept_claim` `{{refundAmount}}` / `{{disputeAmount}}`) = 24회 실행. 메시지 표기에서 `$`·쉼표를 뗀 값, 본문 `value`, BigInt로 따로 만든 값 세 개를 비교 | 모두 같음, 소수 둘째 자리, 반올림 없음 | `$0.01/"0.01"` · `$0.05/"0.05"` · `$0.99/"0.99"` · `$1.00/"1.00"` · `$7.20/"7.20"` · `$10.05/"10.05"` · `$1,234.56/"1234.56"` · `$999,999.99/"999999.99"` 전부 일치 | 예 |
| 자리표시자 섞어 쓰기 `{{disputeAmount}} 중 {{offerAmount}}, 다시 {{offerAmount}} / {{ refundAmount }}` | `$48.00 중 $7.20, 다시 $7.20 / $7.20` | 그대로 | 예 |
| `amountCents` 7.5 / NaN / Infinity / `"720"`, `board.amountCents` 48.5 | 호출 0 거부 | 5건 모두 "금액이 센트 정수가 아닙니다", 호출 0 | 예 |
| `amountCents` 0 (관찰) | 규정 없음 | 호출 1회, `$0.00` / `"0.00"` | 의견 |
| `amountCents` -720 (관찰) | 규정 없음 | 호출 1회, `-$7.20` / `"-7.20"` | 의견 |
| `amountCents` 1e21, 2^53+2 (안전 정수 초과, 관찰) | 규정 없음 | 호출 1회. 1e21은 `"1e+.21"`이라는 깨진 값이 메시지와 본문에 같이 나감 | 의견 |
| 금액 계산 코드 | `src/exec/`에 곱셈·비율·반올림 없음 | 없음. `amount.ts:12-13`은 `String(Math.abs(cents)).padStart(3,'0')` 뒤 문자열 자르기뿐. 메시지(`centsToDisplay`)와 본문(`centsToApiValue`)이 같은 `digitsOf`에서 나옴 | 예 |

### D. 자리표시자·직접 쓴 금액 (초안 → 결과)
| 초안 | 기대 | 실제 | 일치 |
|---|---|---|---|
| `{{offerAmount}}` / `{{refundAmount}}` / `{{disputeAmount}}` | 통과 | 통과 (`$7.20` / `$7.20` / `$48.00`) | 예 |
| `{{offerAmount}}` 세 번 | 통과, 모두 같은 값 | `$7.20 $7.20 $7.20` | 예 |
| `{{ offerAmount }}` (공백) | 규정 없음 | 통과 (`$7.20`). 이름 앞뒤 공백만 허용 | 관찰 |
| 금액 없는 문장 ("3일 안에", "주문 2건", "15%") | 통과 | 통과 (오탐 없음) | 예 |
| `$7.20` / `$ 7.20` / `US$7` / `$`+줄바꿈+`7.20` | 거부, 호출 0 | 모두 거부, 호출 0 | 예 |
| `7.20 USD` / `7.20USD` / `5 usd` | 거부, 호출 0 | 모두 거부, 호출 0 | 예 |
| `7달러` / `7 달러` / `7달러 20센트` | 거부, 호출 0 | 모두 거부, 호출 0 | 예 |
| `{{offerAmount}} 또는 $9.99` (섞임) | 거부 | 거부, 호출 0 | 예 |
| `{{discount}}` / `{{OfferAmount}}` / `{{}}` | 거부 (모르는 자리표시자) | 모두 거부, 호출 0 | 예 |
| `{{offerAmount` (닫히지 않음) | 거부 | 거부 ("닫히지 않은 자리표시자"), 호출 0 | 예 |
| `{{offerAmount}}`인데 `send_message` 계획 (금액 null) | 거부 | 거부 ("계획에 금액이 없어 … 채울 수 없습니다"), 호출 0 | 예 |
| `$1 {{offerAmount}}` (치환 패턴 모양) | — | 거부 (`$` 뒤 숫자). 금액 표기로 봐도 맞는 거부 | 예 |
| `$& {{offerAmount}}` / `$$`·`` $` ``·`$'` | 글자 그대로 나가야 함 | `감사합니다 $& $7.20`, `a $$ b`… 글자 그대로 (치환이 함수라 패턴 해석 없음, `message.ts:52`) | 예 |
| **`USD 7.20`** (통화가 앞) | 지시서 목록에 없음 | **통과**, 그대로 전송 | 해석 필요 |
| **`7.20 dollars`** / `7.20 bucks` / `7 U.S. dollars` | 지시서 목록에 없음 | **통과** | 해석 필요 |
| **`$７`** (반각 `$` + 전각 숫자), `＄７.２０`, `７달러` | 지시서 목록에 없음 | **통과** (`\d`가 전각 숫자를 잡지 않음) | 해석 필요 |
| `7,20` / `7.20 을` (기호 없는 숫자) | 지시서 목록에 없음 | 통과 | 해석 필요 |
| `칠 달러 이십 센트` / `7불` / `9,600원` / `₩9600` / `€7`·`7 EUR` / `$*7.20` | 지시서 목록에 없음 | 통과 | 해석 필요 |
| `⟦AMOUNT_1⟧을 ⟦DATE_1⟧까지` (SPEC 3장 사실값 토큰) | 규정 없음 | 통과, 토큰이 채워지지 않은 채 전송 | 해석 필요 |
| `{offerAmount}` (중괄호 하나) | 규정 없음 | 통과, `{offerAmount}` 그대로 전송 | 관찰 |
| `{{{offerAmount}}}` | 규정 없음 | 통과, `{$7.20}`로 전송 | 관찰 |
| `{{buyer@example.com}}` | 거부 | 거부, 호출 0. 단 error에 `{{buyer@example.com}}`가 그대로 실림 | 예 (의견 있음) |

### E·F. 요청 ID, 중복 승인
| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 같은 계획을 다른 `call` 2개로 실행 | 같은 `requestId` | 둘 다 `plan-rid:make-offer` | 예 |
| 503 실패 뒤 같은 `call`로 재시도 | 호출 2회, 같은 `requestId`, 두 번째 `ok:true` | 그대로 | 예 |
| 같은 `call`로 같은 계획 3번 | 호출 1회, 2·3번째는 이전 결과 | 호출 1회, 같은 결과 (같은 객체 참조를 돌려줌) | 예 |
| 500 실패 뒤 재시도 / 예외 뒤 재시도 → 성공 → 한 번 더 | 실패는 기억하지 않음 | 500: 호출 2회. 예외: 호출 2회 뒤 세 번째는 이전 결과 | 예 |
| 초안 거부(`$5`) 뒤 고친 초안으로 재실행 | 호출 1회, `ok:true` | 그대로 | 예 |
| 성공 뒤 같은 계획을 `approval: null`로 재실행 | 거부 (이전 성공을 돌려주지 않음) | 거부, 추가 호출 0 (승인 검사가 중복 검사보다 앞, `execute.ts:72-77`) | 예 |
| 성공 뒤 같은 `planId`인데 이번 입력은 거부 대상 (허용 수 없음 + 직접 금액 / `accept_claim`인데 확인 플래그 없음 / 금액이 다른 계획) | 추가 호출 0 | 추가 호출 0. **반환은 이전 `{ok:true}`** (중복 검사가 나머지 검증보다 앞, `execute.ts:76-86`) | 해석 필요 |
| 같은 계획을 서로 다른 `call` 2개로 한 번씩 | AC12 "대조" 테스트가 요구: 새 `call`이면 호출 | a 1회, b 1회 (합계 2회, 같은 `requestId`) | 예 (AC 기준) |
| 같은 클라이언트를 매번 새 화살표 함수로 감싸서 2번 (`{ call: (r) => client.call(r) }`) | "프로세스 메모리 기준"이면 1회 | **PayPal 쪽 호출 2회** (같은 `requestId`) | 해석 필요 |
| 같은 `call`로 같은 계획을 동시에 2번 (첫 호출이 끝나기 전) | 지시서는 "이미 성공했으면"만 규정 | PayPal 쪽 호출 2회 (같은 `requestId`), 둘 다 `ok:true` | 관찰 |

### G·H. 오류 응답, 부수효과
| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 상태 199·300·302·400·401·403·404·409·422·429·500·503, 응답 본문에 구매자 이메일·토큰·debug_id·오류 이름 | `{ok:false}`, error에 엔드포인트·상태 코드, nextAction 있음, 본문 내용 없음, 호출 1회 | 12건 모두 그대로. 예: `"make-offer 호출이 실패했습니다 (상태 코드 422)"` + `"PayPal 분쟁 화면에서 make-offer 결과를 확인하세요. …"` | 예 |
| 상태 200·201·202·204·299 | `{ok:true,sent:[{path,status}]}`, 응답 본문은 결과에 없음 | 5건 모두 그대로 | 예 |
| `call`이 예외를 던짐 (메시지에 `Bearer` 토큰·이메일) | 예외를 올리지 않고 `{ok:false}`, 예외 메시지 미포함 | `"make-offer 호출이 오류로 끝났습니다"` + `"잠시 뒤 같은 계획을 다시 실행하세요. …"` | 예 |
| `call`이 Error가 아닌 값을 던짐 / `null`을 돌려줌 | `{ok:false}` | 2건 모두 `{ok:false}` | 예 |
| `call`이 `status` 없는 객체를 돌려줌 (타입 위반) | 성공으로 보지 않아야 안전 | **`{ok:true, sent:[{path}]}`** 이고 성공으로 기억되어 재실행해도 호출 안 함 | **아니오** |
| `call`이 `status: "200"`(문자열) (타입 위반, 관찰) | — | `{ok:true}`, `status:"200"` 그대로 | 관찰 |
| 입력 전체를 `Object.freeze`(깊게)하고 실행 | 예외 없음, 입력 JSON 동일 | `ok:true`, 동일 | 예 |
| `Math.random`·`Date` 호출 횟수 (성공·거부 경로) | 0 / 0 | 0 / 0 | 예 |
| `console.*` 출력 (실패·성공 경로) | 0 | 0 | 예 |

## SPEC·지시서 대조
| 조항 | 판정 | 근거 |
|---|---|---|
| SPEC 9-1 ① `approval`이 없거나 `planId`가 다르면 호출 전 거부 | 일치 | `execute.ts:72-73` (함수의 첫 두 줄). 시나리오 A |
| SPEC 9-1 ① `apiMove`가 허용되지 않으면 거부 | 일치 | `execute.ts:82` |
| SPEC 9-1 ① `accept_claim`은 `confirmAcceptClaim === true`일 때만 | 일치 | `execute.ts:83-85` (`!== true`) |
| SPEC 9-1 ② 한 계획에 호출 1회, `make_offer` → make-offer (메시지는 `note`) | 일치 | `request.ts:55-60`, `execute.ts:99` (`deps.call` 호출은 이 한 곳). send-message를 따로 부르는 코드 없음. AC11 `['make-offer']` |
| SPEC 9-1 ② `send_message` → send-message, `accept_claim` → accept-claim | 일치 | `request.ts:45-48`, `63-67` |
| SPEC 9-1 ② `provide_evidence` → 아직 실행하지 않음 | 일치 | `execute.ts:81`, `request.ts:12-16` (엔드포인트 표에 없음) |
| SPEC 9-1 ③ 메시지 토큰을 `plan`·`board` 값으로 채운다 | 일치 | `message.ts:12-16`, `52-54` |
| SPEC 9-1 ③ 메시지 안 금액 = API 본문 금액 | 일치 (자리표시자로 들어온 금액 한정) / 해석 필요 (지시서 목록 밖 표기) | 자리표시자 금액과 본문은 같은 `digitsOf`(`amount.ts:10-14`). 다만 `USD 7.20`·`7.20 dollars`·`$７` 같은 직접 표기는 통과하므로 이 불변식을 `executeMove` 혼자 보장하지는 않는다 (발견한 문제 1) |
| 지시서 1. 거부는 `{ok:false,error,nextAction}`, 호출 0회 | 일치 | `execute.ts:34-36`. 계약 타입 입력에서는 예외를 던지지 않음 |
| 지시서 1. 직접 쓴 금액 (`$` 뒤 숫자, 숫자 뒤 `USD`·`달러`) 거부 | 일치 | `message.ts:22-25`, `34-38`. 채우기 **전** 초안에 검사하므로 채운 `$7.20`가 걸리지 않음 |
| 지시서 1. 모르는 자리표시자 거부 | 일치 | `message.ts:40-44`, `56-58` |
| 지시서 1. `provide_evidence` 거부 + "PayPal 화면에서 직접 증빙 제출" 안내 | 일치 | `execute.ts:29`, `81` |
| 지시서 2. `{{offerAmount}}`·`{{refundAmount}}` ← `plan.amountCents`, `{{disputeAmount}}` ← `board.amountCents`, 표기 `$7.20` | 일치 | `message.ts:12-16`, `amount.ts:23-27` |
| 지시서 2. 센트 → 문자열은 정수 연산, 새 금액 계산 금지 | 일치 | `amount.ts:10-14` (문자열 자르기). `src/exec/`에 `/100`·`toFixed`·곱셈 없음 (grep) |
| 지시서 3. 경로 `/v1/customer/disputes/{disputeId}/...`, 본문 표 | 일치 | `request.ts:41`, `47`, `59`, `66`. `disputeId`는 URL 인코딩 없이 넣는다 (의견) |
| 지시서 3. `currency_code: 'USD'` | 일치 (계약 타입 입력) | `request.ts:52`는 `plan.currency`를 옮긴다. 타입이 `'USD'`뿐이라 결과는 같다 |
| 지시서 3. 본문 `note: message` | 해석 필요 | 메시지가 비면 `note`를 빼고 보낸다 (`request.ts:53`). 지시서 표는 항상 `note`가 있는 모양 |
| 지시서 4. `requestId = <planId>:<엔드포인트 이름>`, 재실행 시 같은 ID | 일치 | `request.ts:23-25`, `42` |
| 지시서 5. 같은 `planId`가 이미 성공했으면 다시 호출하지 않고 이전 결과 (프로세스 메모리 기준) | 해석 필요 | `execute.ts:54-60`, `76-77`. `planId`가 아니라 **(`call` 함수, `planId`)** 로 기억한다. 같은 `call`이면 지시서대로, `call`이 다르면 다시 호출 (컨트롤 타워 결정 1) |
| 지시서 6. 2xx가 아니면 `{ok:false}`, error에 엔드포인트·상태 코드, nextAction에 사람이 할 일 | 일치 | `execute.ts:43-48`, `106` |
| 지시서 7 / CLAUDE.md: 로그·결과에 토큰·구매자 이메일 없음 | 일치 | 로그 코드 없음. 응답 본문·예외 메시지를 읽지 않음 (`execute.ts:99-100`, `catch`에 변수 없음). 시나리오 G |
| 지시서: 공개 함수 `src/exec/execute.ts`의 `executeMove` (`ExecuteMoveFn`), 타입은 `@/types`에서 | 일치 | `execute.ts:10`, `68`. 새 타입(`FillResult`, `BuildResult`)은 `src/exec/` 안에만 |
| 지시서: 수정 가능 폴더 | 일치 | `git diff --name-status main...HEAD` 추가 6개 (위 표) |
| 지시서 완료 기준: AC11·AC12 10개 / 단위 테스트 5항목 / `tsc` 자기 파일 오류 없음 | 일치 | 위 "실행한 명령". 단위 테스트 5항목은 `execute.test.ts:61-80`, `82-107`, `109-134`, `136-165`, `167-212` |
| 지시서 "하지 않을 것" (실제 네트워크, 금액 계산, 증빙 업로드, 초안 생성) | 일치 | `src/exec/`에 `fetch`·계산·LLM 호출 없음 |
| CLAUDE.md: 숫자 계산은 `src/engine/`에서만 | 일치 | 금액을 옮기기만 한다 |
| CLAUDE.md: 화면 문구는 `config/`에서 읽는다 | 해석 필요 | 거부·실패 문구가 `execute.ts:20-32`, `39`, `45-46`, `102-103`과 `message.ts:36`, `43`, `48`, `57`, `request.ts:29-30`, `37`, `46`에 한국어로 직접 적혀 있다 (컨트롤 타워 결정 2) |
| CLAUDE.md: LLM 출력은 신뢰하지 않는 입력, 금액은 자리표시자로만 | 일치 (지시서가 정한 판정 범위) | `message.ts:34-44`. zod는 쓰지 않았다 (입력이 문자열 하나라 정규식 판정. 새 의존성 없음) |
| SPEC 3장: 사실값 토큰(`⟦DATE_1⟧` 등)은 코드가 채우고 개수·값이 다르면 전송 불가 | 해석 필요 | `executeMove`는 `⟦…⟧`를 모른다. 남아 있으면 그대로 전송된다. 어느 층이 막는지 지시서에 없음 (컨트롤 타워 결정 5) |

### 구현 보고(`reports/T008-impl.md`)와 대조
- 테스트 숫자(10 / 124 / 전체 37 통과·2 실패·3파일 로드 실패·9 skip / tsc 3건)는 내가 직접 돌린 결과와 같다.
- "판단한 부분" 1(기억을 `call`별로): AC12 "대조" 테스트(`ac11-12.exec.test.ts:173-177`)가 AC11 첫 테스트(`:78-84`)에서 이미 성공한 `plan-test-offer`를 새 가짜 호출로 다시 실행하고 `call`이 불렸기를 요구한다는 설명은 사실이다. `planId`만으로 프로세스 전체에서 기억하면 이 인수 테스트가 깨진다.
- "운영에서는 클라이언트가 하나라 프로세스 메모리 기준과 같다"는 배선에 달린 가정이다. `call`을 매번 새 함수로 감싸면 성립하지 않음을 시나리오 F에서 확인했다.
- "방어 거부 2건 추가"라고 썼지만 나열된 것은 3건(금액·환불유형 null / `disputeId` 불일치 / 정수 아님)이고, `send_message` 빈 메시지 거부까지 더하면 4건이다. 모두 호출 0회임을 확인했다.
- "비밀값: 단위 테스트로 확인"의 근거 테스트(`execute.test.ts:255-263`)는 가짜 응답 본문이 `{}`라 새는지 검사하지 못한다. 실제로 새지 않는다는 것은 내 시나리오 G(본문·예외에 이메일·토큰을 넣음)로 확인했다.

## 발견한 문제
병합 차단: **없음.**

| # | 심각도 | 문제 | 재현 | 근거 |
|---|---|---|---|---|
| 1 | 병합 후 수정 (범위는 결정 3) | 직접 쓴 금액 판정이 지시서에 적힌 두 모양(`$` 뒤 숫자, 숫자 뒤 `USD`·`달러`)뿐이라 `USD 7.20`, `7.20 dollars`, `$７`(전각 숫자), `＄７.２０`, 기호 없는 `7.20`이 통과한다. 이런 초안이 오면 메시지 금액과 본문 금액이 다를 수 있다 | `messageTemplate: 'USD 9.99 환불'` + 720센트 제안 계획 → 호출 1회, `note`에 `USD 9.99`, 본문 `7.20` | `message.ts:22-25`. 지시서 문구는 지켰으므로 위반은 아님. SPEC 9-1 "메시지 안 금액 = API 본문 금액"을 이 함수 혼자 보장하지 못하는 구멍 |
| 2 | 병합 후 수정 | 응답 `status`가 숫자가 아니면(없음·NaN) 성공으로 처리하고 성공으로 기억한다. 돈이 움직이는 수가 실패했는데 "보냄"으로 남고 재실행도 막힌다 | `call`이 `{ body: {} }`를 돌려줌 → `{ok:true, sent:[{path}]}`, 재실행 시 호출 0회 | `execute.ts:106` (`status < 200 \|\| status >= 300`은 `undefined`에 둘 다 false). `PayPalCaller` 타입을 지키는 클라이언트에서는 일어나지 않음 |
| 3 | 병합 후 수정 (결정 4) | 중복 검사가 허용 수·확인 플래그·초안 검사보다 앞이라, 한 번 성공한 `planId`는 그 뒤 거부 대상 입력(확인 플래그 없는 `accept_claim`, 직접 금액 초안, 금액이 바뀐 계획)에도 이전 `{ok:true}`를 돌려준다. 호출은 0회라 돈은 움직이지 않는다 | 시나리오 F 7번째 행 | `execute.ts:76-77`이 `80-90`보다 앞 |
| 4 | 병합 후 수정 (결정 1) | 중복 승인 기억이 `call` 함수 참조에 묶여 있어 배선에 따라 무력해진다. 요청마다 클라이언트를 새로 만들거나 `call`을 화살표 함수로 감싸면 같은 계획이 PayPal로 두 번 나간다 (같은 `PayPal-Request-Id`라 서버 쪽 방어는 남음). 같은 `call`이어도 첫 호출이 끝나기 전의 동시 실행(더블 클릭)은 2회 나간다 | 시나리오 F 9·10번째 행 | `execute.ts:54-60` |
| 5 | 의견 | `make_offer`·`accept_claim`은 메시지가 비면 `note` 없이 보낸다. 초안에 금액 자리표시자가 하나도 없어도 보낸다 (구매자 메시지에 금액이 없는 제안) | 시나리오 B | `request.ts:53`. PayPal이 `note`를 필수로 보는지는 확인하지 않았다 (네트워크 호출 금지) |
| 6 | 의견 | 금액 0·음수·안전 정수 초과(1e21 → `"1e+.21"`)를 그대로 보낸다. 엔진이 만들 값은 아니지만 돈이 나가는 마지막 문이다 | 시나리오 C | `amount.ts:11`은 정수 여부만 본다 |
| 7 | 의견 | 모르는 자리표시자 이름을 error에 그대로 되울린다. LLM 초안이 `{{…}}` 안에 구매자 정보를 넣으면 결과 문구에 실린다 | `{{buyer@example.com}}` | `message.ts:43` |
| 8 | 의견 | `{offerAmount}`(중괄호 하나)와 `{{{offerAmount}}}`는 거부되지 않고 깨진 문장이 나간다 | 시나리오 D | `message.ts:19`, `56` |
| 9 | 의견 | `currency_code`가 상수 `'USD'`가 아니라 `plan.currency`. 메시지 기호는 항상 `$` | `plan.currency: 'EUR'` (타입 위반) | `request.ts:52`, `amount.ts:26` |
| 10 | 의견 | 경로에 `plan.disputeId`를 인코딩 없이 넣는다. `board.disputeId`와 같아야 통과하므로 PayPal이 준 값이긴 하다 | 코드 확인 | `request.ts:41` |
| 11 | 의견 | 중복 실행 때 이전 결과의 같은 객체 참조를 돌려준다. 받는 쪽이 `sent`를 고치면 기억된 결과도 바뀐다 | 시나리오 F 3번째 행 | `execute.ts:77` |
| 12 | 의견 (계약 쪽) | `tests/acceptance/ac11-12.exec.test.ts:4` 머리말이 "기준: SPEC v1.1 … SPEC.md 5장·7장"으로 남아 있다 (지금은 9-1장). 동작에는 영향 없음 | — | 잠금 파일이라 컨트롤 타워 몫 |

### 단위 테스트의 질 (`tests/unit/execute.test.ts`, 20개)
지시서가 요구한 5항목은 모두 있다. 빠진 경계 사례:
- `offer_type` / `accept_claim_type` = `plan.refundType`을 검사하는 테스트가 **인수·단위 어디에도 없다** (`REFUND_WITH_RETURN` 포함). 본문 전체를 `toEqual`로 고정한 테스트도 없다.
- `confirmAcceptClaim: false`(없음이 아니라 false), 성공 뒤 `approval: null` 재실행.
- 직접 금액 변형: `달러`, `$ 7`(공백), `US$7`, 소문자 `usd`, 자리표시자와 섞인 경우. 자리표시자 여러 번·공백 포함·닫히지 않은 중괄호·금액 없는 계획의 `{{offerAmount}}`.
- 센트 정수가 아닌 금액 거부(코드에는 있음), 0·음수.
- 상태 경계(199·300·204)와 예외 뒤 재시도, 예외 경로의 `nextAction`.
- 비밀값 테스트(`:255-263`)는 응답 본문이 `{}`라 누출을 잡지 못한다.
- 입력 불변, 서로 다른 `call` 사이의 중복 기억 분리(요청 ID 테스트 `:137-147`이 암묵적으로 기대고 있음).

## 컨트롤 타워가 결정할 것
1. **중복 승인 기억의 범위** (지시서 5 "프로세스 메모리 기준" vs AC12 "대조" 테스트)
   - (a) 지금대로 `call`별 기억을 받아들이고, `deps.call`을 넘기는 작업(T009 화면·서버 라우트, `createPayPalClient`를 쓰는 곳)의 지시서에 "모듈 수준에서 한 번 만든 같은 `call` 참조를 넘긴다 (요청마다 새로 만들거나 감싸지 않는다)"를 적는다.
   - (b) `planId`만으로 프로세스 전체에서 기억하게 바꾼다. 이 경우 AC12 "대조" 테스트가 다른 `planId`를 쓰도록 인수 테스트를 고쳐야 한다 (계약 변경, 사람 승인 필요).
   - (c) 기억을 `executeMove` 밖(화면·라우트)으로 옮기고 `PayPal-Request-Id`에만 맡긴다.
   - 함께 정할 것: 첫 호출이 끝나기 전의 동시 실행(더블 클릭)을 여기서 막을지, 화면의 버튼 비활성과 `PayPal-Request-Id`에 맡길지.
2. **실행 결과 문구의 위치** (CLAUDE.md "화면 문구는 `config/`에서")
   - (a) 지금대로 `src/exec/`에 두고, 화면은 `error`·`nextAction`을 그대로 보여준다 (한국어뿐. `config/copy.en.json`에 대응 문구 없음).
   - (b) `config/copy.{ko,en}.json`에 `exec.*` 키를 추가하는 작업을 따로 내고 `src/exec/`가 거기서 읽는다 (`config/`는 T008 수정 가능 폴더 밖).
   - (c) `ExecuteResult`에 오류 코드를 추가하고 화면이 문구를 고른다 (`src/types.ts` 계약 변경).
3. **직접 쓴 금액 판정의 범위** (발견한 문제 1)
   - (a) 지시서 범위(두 모양)로 두고, 그 밖의 표기는 `src/ai/tokens.ts`의 `literalFacts` 검사(`CheckTokensFn`, T010)가 막는다고 정한다. 이 경우 화면이 토큰 검사를 통과한 전송본만 `executeMove`에 넘기는지 T009에서 확인해야 한다.
   - (b) `src/exec/message.ts`의 판정을 넓힌다: 통화 표기가 앞에 오는 `USD 7.20`, `dollars`, 전각 숫자·`＄` 정도. 기호 없는 숫자까지 막으면 "3일", "주문 2건" 같은 문장이 오탐된다.
4. **성공한 계획의 재실행이 이번 입력 검증보다 먼저인 순서** (발견한 문제 3): 지금대로 "이미 성공했으면 이전 결과"를 우선할지, 검증을 먼저 하고 통과한 경우에만 이전 결과를 돌려줄지. 어느 쪽이든 호출은 0회다.
5. **사실값 토큰 `⟦…⟧`가 남은 초안**: SPEC 3장은 "코드가 채운다, 다르면 전송 불가"인데 `executeMove`는 `{{…}}`만 안다. `⟦…⟧`는 `executeMove`에 오기 전에 다른 층(T010 토큰 검사·T009 화면)이 채우고 검사한다고 정할지, `executeMove`가 남은 `⟦…⟧`를 거부하게 할지.
6. **지시서에 없는 호출 전 거부·허용** (구현자가 스스로 정한 것, SPEC과 충돌은 못 찾음. 확인만 필요)
   - 추가 거부: `make_offer`·`accept_claim`인데 `amountCents`·`refundType`이 null / `plan.disputeId !== board.disputeId` / 금액이 센트 정수가 아님 / `send_message`인데 빈 메시지.
   - 허용: `make_offer`·`accept_claim`은 빈 메시지면 `note` 없이 보낸다. 거부로 바꿀지 (지시서 표는 `note: message`).
