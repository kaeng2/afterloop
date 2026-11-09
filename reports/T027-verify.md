# T027 검증 (2026-11-09 22:22 KST)
- 판정: **통과**
- 검증 대상: lane/paypal-exec `bc90670` (T027 범위 `2d62da8..bc90670`: 구현 `5774813`, 보고 `bc90670`) · 기준 SPEC v2.1 (`SPEC.md` 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)` 확인)
- 검증 방법: 코드·설정·테스트를 고치지 않았다. 실제 PayPal 호출 없음 (`deps.call`에 가짜 함수만 주입). `.env`를 찾거나 읽지 않았다. 독립 시나리오는 worktree 밖 임시 스크립트로 `executeMove`를 직접 불러 확인했다. 구현자 보고(`reports/T027-impl.md`)는 독립 판단 뒤에 대조했다.
- 병합 차단 문제: **없음.** AC11·AC12 10개 통과, 지시서 "고칠 것" 1~7 문언 충족, T008 동작 회귀 없음, 범위 밖 수정 없음. 다만 금액 판정의 구멍(통과 24종)과 과차단(11종 + 추가 9종), 보이지 않는 문자만 있는 메시지 전송은 "병합 후 수정"·"결정할 것"에 적었다.

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-only 2d62da8..HEAD` | — | — | 6개 파일: `src/exec/{copy,execute,message,request}.ts`, `tests/unit/execute.test.ts`, `reports/T027-impl.md`. 모두 수정 가능 범위 안 |
| `git diff 2d62da8..HEAD -- src/types.ts tests/acceptance config package.json package-lock.json` | — | — | 0줄. 계약·설정·의존성 변경 없음. `src/paypal`·`src/engine`·`src/app`·`seed`·`tasks`·`SPEC.md`도 변경 없음 |
| `grep -rn "fetch\|process.env\|console\.\|require(" src/exec/` | — | — | 결과 없음. `src/exec/`의 import는 `@/types`(타입만)와 같은 폴더 파일뿐 |
| `npx vitest run tests/acceptance/ac11-12.exec.test.ts` | 10 | 0 | AC11 6개 + AC12 4개 |
| `npm test` | 320 | 0 | 6파일. `tests/unit/execute.test.ts` 130개 |
| `npx tsc --noEmit` | — | 0 (대상 파일) | 전체 오류 2건은 범위 밖 TS2307: `tests/acceptance/ac04.plan.test.ts`(`@/engine/plan` 없음), `ac07.escalation.test.ts`(`@/engine/escalation` 없음). `src/exec/`·`tests/unit/execute.test.ts` 오류 0건 |
| `npm run test:acceptance` (전체) | 51 | 2 (+ 파일 2개 로드 실패, 9개 skip) | 실패는 모두 범위 밖. ① `ac04`·`ac07` 로드 실패: engine 레인 모듈 미구현 ② `ac13.sandbox.test.ts` 2건: 루트 `.env.example` 없음 / `.env.example`이 git 무시 대상 (T001 레인). `src/exec/`와 무관 |
| `npx eslint src/exec tests/unit/execute.test.ts` | — | 0 | 출력 없음 (참고용) |
| 독립 시나리오 스크립트 (`npx tsx <worktree 밖 스크립트>`) | — | — | 아래 표. 금액 65 + 비금액 42 + 데모 문장 17 + 토큰 31 + 빈 메시지 13×3수 + 순서 20 + 상태 23 + 문구(거부·실패 결과 144건) + T008 회귀 24. 가짜 `call`만 사용 |
| `git status -s` (끝) | — | — | `?? reports/T027-verify.md` 한 줄 |

## 독립 시나리오
모든 행은 `executeMove`를 가짜 `call`로 직접 실행한 결과다. (1)의 "막아야 할 것"은 720센트 제안 계획(`make_offer`, 본문 금액 `7.20`), "막지 말아야 할 것"은 금액 없는 `send_message` 계획으로 돌렸다.

### (1) 직접 쓴 금액 — 막아야 할 것 65개 (거부 41, 통과 24)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 기호 + 숫자 (18개) | `$7.20`, `$ 7.20`, `US$7.20`, `＄７.２０`, `₩9600`, `€7`, `£7`, `¥800`, `$7.2`, `$1,234.56`, `$`+줄바꿈+`7.20`, `$7.`+제로폭+`20`, `$7`, `＄ ７`, `₩ 9,600`, `¢50`, `$`+NBSP+`7`, `{{offerAmount}} 또는 $9.99` | 거부·호출 0 | 모두 거부·호출 0 (`a currency symbol before a number`) | 예 |
| 숫자 + 통화 이름·코드 (18개) | `7.20 USD`, `7 USD`, `7USD`, `7.20 dollars`, `7 dollars`, `7 Dollar`, `7 U.S. dollars`, `7 US dollars`, `7`+NBSP+`dollars`, `7 bucks`, `720 cents`, `7.20달러`, `7달러`, `7 달러`, `７달러`, `7달러 20센트`, `7 euros`, `7 EUR` | 거부·호출 0 | 모두 거부·호출 0 (`a number followed by a currency name`) | 예 |
| 통화 코드 + 숫자 (2개) | `USD 7.20`, `usd 7` | 거부·호출 0 | 거부·호출 0 (`a currency code before a number`) | 예 |
| 기호 없는 소수 둘째 자리 (3개) | `7.20`, `７．２０`, `&#36;7.20` (HTML 엔티티는 `7.20` 때문에 걸림) | 거부·호출 0 | 거부·호출 0 (`a number with two decimal places`) | 예 |
| 통과 1 | `seven dollars` (영어 수사) | 거부 | **통과**·호출 1. 구매자 메시지 `We will refund seven dollars today.` / 본문 7.20 | 아니오 |
| 통과 2 | `7,20 €` (기호가 뒤, 독일식) | 거부 | **통과**. `Wir erstatten 7,20 € heute.` / 본문 7.20 | 아니오 |
| 통과 3 | `7€`, `7$` (기호가 뒤) | 거부 | **통과**. `Wir erstatten 7€.` / `We will refund 7$ today.` / 본문 7.20 | 아니오 |
| 통과 4 | `$`+제로폭(U+200B)+`7` (정수) | 거부 | **통과**. 화면에는 `$7`로 보이는 메시지 / 본문 7.20 | 아니오 |
| 통과 5 | `&#36;7` (엔티티, 정수), `$<b>7</b>` (마크업) | 거부 | **통과**. 원문 그대로 전송 / 본문 7.20 | 아니오 |
| 통과 6 | `7-dollar`, `$ seven`, `USD: 7`, `7 (USD)` | 거부 | **통과** / 본문 7.20 | 아니오 |
| 통과 7 | `9,600원`, `9600원`, `7불`, `7유로`, `800엔`, `7 won`, `7 미국 달러`, `칠 달러`, `CAD 7` | 거부 | **통과** (예: `9,600원을 환불해 드릴게요.`) / 본문 7.20 | 아니오 |
| 통과 8 | `7,20` (쉼표 소수), `7.2` (소수 한 자리), `７ＵＳＤ` (전각 영문) | 거부 | **통과** / 본문 7.20 | 아니오 |
| 통과 9 | `50%` (제안률 15%와 다른 비율을 "환불"한다고 쓴 문장) | 참고 | **통과**. `We will refund 50% of the price.` / 본문 7.20 | 참고 |
| 채운 뒤 숫자 붙음 | `{{offerAmount}}0`, `{{offerAmount}}5`, `1{{offerAmount}}`, `{{offerAmount}},000`, `{{offerAmount}}{{offerAmount}}`, `{{offerAmount}} x 2` | 참고 | **통과**. 메시지 `$7.200`, `$7.205`, `1$7.20`, `$7.20,000`, `$7.20$7.20`, `$7.20 x 2` / 본문 7.20 (금액 판정은 채우기 **전** 초안에만 한다) | 참고 |

통과한 것의 분류: 위 "통과" 행은 모두 **호출이 1회 나가고 구매자 메시지에 초안의 금액 표기가 그대로 실린다.** API 본문 금액은 언제나 `plan.amountCents`(7.20)이므로 실제로 움직이는 돈은 틀리지 않지만, 구매자가 읽는 금액과 API 금액이 달라질 수 있는 경로다. 조건은 "LLM 초안(또는 그 앞 단계)이 금액을 자리표시자가 아닌 이 표기들로 써서 `executeMove`까지 온다"이다. 요청서 목록 25개 중에서는 `seven dollars`, `7,20 €` 2개가 통과하고 23개는 거부된다. 지시서 1의 예시 표기(`USD 7.20`·`7.20 USD`·`US$7.20`·`7.20 dollars`·`7 dollars`·`7.20달러`·`7달러`·`＄７`·`7.20`·`₩`/`€`/`£`/`¥` + 숫자)는 전부 거부된다.

### (1) 직접 쓴 금액 — 막지 말아야 할 것 42개 (통과 31, 과차단 11)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 통과 (31개) | `11/12`, `2026-11-12`, `Nov 12`, `11월 17일`, `17. November`, `2026. 11. 17.`(공백 있는 점 날짜), `3 weeks`, `3주`, `24 hours`, `7 days`, `15%`, `100% wool`, `order 4821973`, 추적번호 `1Z999AA10123456784`·`SP100234567US`·`EE123456789KR`, 분쟁 ID `PP-D-20002`, 거래 ID `8MC585209K746392H`, `2 items`, `size 7`, `size 7 US`, `v2.1`, `17:00`, 전화번호 `010-1234-5678`·`+82 2-123-4567`, `1st`, `No. 3`, `30 cm`, `62cm`, `4.5 stars`, `3.5 mm` | 통과·호출 1 | 모두 통과·호출 1 | 예 |
| 과차단 1 | `11.12` (점 날짜) | 통과 | **거부**·호출 0 (`a number with two decimal places`) | 아니오 |
| 과차단 2 | `2026.11.17` (한국식 점 날짜), `11.17.` | 통과 | **거부** (같은 사유) | 아니오 |
| 과차단 3 | `17.00` (점 시각), `1.25 kg`, `12.50%`, `v1.10` | 통과 | **거부** (같은 사유) | 아니오 |
| 과차단 4 | `5 centimeters`, `3 centers` | 통과 | **거부** (`a number followed by a currency name`: 숫자 뒤 `cent`로 시작하는 단어) | 아니오 |
| 과차단 5 | `2 buckets` | 통과 | **거부** (숫자 뒤 `buck`으로 시작하는 단어) | 아니오 |
| 과차단 6 | `2 European orders` | 통과 | **거부** (숫자 뒤 `EUR`로 시작하는 단어, 대소문자 무시) | 아니오 |
| 추가 과차단 (별도 실행 9개) | `2 Europe-bound parcels`, `18 century`, `Row 3 centre panel`, `size 38 EUR`, `EU size 38 EUR`, `EUR 38`(유럽 사이즈 표기), `amateur 5 pattern`, `Order #5 USDA certified`, 추적번호 `RR12345678USD9` | 통과 | 모두 **거부** (통화 코드·이름 앞뒤에 단어 경계가 없다) | 아니오 |

### (1) 데모 대본 문장 (PRD 원문 S3·S5·10-5·장면 3·4의 문장과 그 변형)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 서연 한국어 전송본 (PRD S5 그대로, `11월 17일`) | `send_message` | 전송 | 전송·호출 1 | 예 |
| Hannah 영어 초안 (PRD S5 그대로, `Nov 17`) | `send_message` | 전송 | 전송·호출 1 | 예 |
| 한국 통관 안내 (PRD S3 그대로) | `send_message` | 전송 | 전송·호출 1 | 예 |
| 서연 답장에 기간·추적번호·날짜 (`3주`, `SP100234567US`, `10월 30일`, `24시간`) | `send_message` | 전송 | 전송·호출 1 | 예 |
| 서연 답장의 날짜가 `11/17`로 복원된 경우 | `send_message` | 전송 | 전송·호출 1 | 예 |
| 서연 답장의 날짜가 `11.17`로 복원된 경우 | `send_message` | 참고 | **거부** (`a number with two decimal places`) | 참고 |
| 서연 답장의 날짜가 `2026.11.17`로 복원된 경우 | `send_message` | 참고 | **거부** (같은 사유) | 참고 |
| 서연 답장에 `⟦DATE_1⟧`이 복원되지 않고 남은 경우 | `send_message` | 거부 | 거부 (`tokensRemaining`) | 예 |
| 서연 답장에 `⟦AMOUNT_1⟧`이 `$72.00`으로 복원돼 들어온 경우 | `send_message` | 참고 | **거부** (`a currency symbol before a number`) | 참고 |
| 서연 답장에 `{{disputeAmount}}` (분쟁 금액 7200센트) | `send_message` | 전송 | 전송, 메시지 `결제하신 $72.00 스웨터는…` | 예 |
| 지호 제안 (AC11 초안) | `make_offer` | 전송 | 전송, `note`에 `$7.20`, 본문 7.20 | 예 |
| 지호 제안 + 날짜·수량·기간 (`10월 20일`, `1벌`, `3일 안에`) | `make_offer` | 전송 | 전송 | 예 |
| 지호 제안 + `결제 금액의 15%인 {{offerAmount}}` | `make_offer` | 전송 | 전송, `15%인 $7.20` | 예 |
| 지호 제안 + `주문하신 2개 중 1개` | `make_offer` | 전송 | 전송 | 예 |
| 지호 제안 + `{{disputeAmount}} 중 {{offerAmount}}` | `make_offer` | 전송 | 전송, `$48.00 중 $7.20` | 예 |
| 지호 전액 환불 (`{{refundAmount}}`, `영업일 기준 3~5일`) | `accept_claim` | 전송 | 전송, `$48.00`, 본문 48.00 | 예 |
| Lena 독일어 안내 (PRD 장면 4 `…über 24,00 USD.`, 금액 직접 표기) | `send_message` | 거부 | 거부 (`a number followed by a currency name`) | 예 |

PRD에 적힌 데모 문장 그대로는 모두 전송된다. 막히는 것은 날짜를 점으로 복원하는 경우(`11.17`, `2026.11.17`)와 금액 사실값 토큰을 달러 표기로 복원해 넘기는 경우다.

### (2) 남은 토큰
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 모르는 자리표시자 | `{{unknown}}`, `{{OfferAmount}}`, `{{}}`, `{{constructor}} {{__proto__}} {{toString}}` | 거부·호출 0 | 거부·호출 0 (`unknownPlaceholder` → `nextFixDraft`) | 예 |
| 사실값 토큰 | `⟦DATE_1⟧`(채워진 `{{offerAmount}}`와 함께), `⟦PCCC⟧` | 거부·호출 0, "초안을 다시 만들라" | 거부·호출 0 (`tokensRemaining` → `nextRegenerateDraft`) | 예 |
| 한쪽 괄호 | `⟦DATE_1`, `DATE_1⟧`, `{{offerAmount`, `offerAmount}}`, `{{offer{{offerAmount}}Amount}}` | 거부·호출 0 | 거부·호출 0 (`tokensRemaining` → `nextRegenerateDraft`) | 예 |
| 정상 자리표시자 3종 | `{{offerAmount}}`(make_offer), `{{refundAmount}}`(accept_claim), `{{disputeAmount}}`(send_message), 3종 섞어 반복 | 채움 | `$7.20` / `$48.00` / `$48.00` / `$48.00 중 $7.20 ($7.20), 다시 $7.20`, 본문 금액과 일치 | 예 |
| 금액 없는 계획의 금액 자리표시자 | `send_message` 계획 + `{{offerAmount}}` | 거부·호출 0 | 거부 (`placeholderWithoutAmount` → `nextFixPlan`) | 예 |
| 안쪽 공백 | `{{ offerAmount }}`, `{{offerAmount }}`, `{{`+줄바꿈+`offerAmount`+줄바꿈+`}}` | 요청서: 거부 / 지시서 2: 남지 않으면 됨 | **채워져 전송** (`$7.20`, 본문 7.20). 토큰은 남지 않고 금액은 일치한다 | 해석 필요 |
| 치환 패턴 | `$&`, `` $` ``, `$'`, `$$`, `$<name>`이 초안에 있고 자리표시자를 채움 | 글자 그대로, 금액 한 번만 | `A $& B $7.20 C` 등 글자 그대로 (함수 치환이라 특수 패턴이 풀리지 않는다) | 예 |
| 치환 패턴 `$1` | `A $1 B {{offerAmount}} C` | 안전 | 거부 (`literalAmount`: `$` 뒤 숫자) | 예 |
| 비슷한 모양 (지시서 2 범위 밖) | `{offerAmount}`, `{ {offerAmount} }`, `{{{offerAmount}}}`, `[[DATE_1]]`, `〚DATE_1〛`, `【DATE_1】`, `｛｛offerAmount｝｝`, `{`+제로폭+`{offerAmount}`+제로폭+`}` | 참고 | **전송**. 원문 그대로 구매자에게 간다 (`{{{offerAmount}}}`는 `{$7.20}`) | 참고 |

### (3) 빈 메시지 (각 초안 × `make_offer`·`send_message`·`accept_claim`)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 빈 문자열·공백 (7종) | `''`, 공백, 줄바꿈, `\t\r\n` 혼합, NBSP(U+00A0), 전각 공백(U+3000), BOM(U+FEFF) | 세 수 모두 거부·호출 0 | 세 수 모두 거부·호출 0 (`messageEmpty` → `nextFixDraft`) | 예 |
| 보이지 않는 문자만 (6종) | 제로폭 공백(U+200B), U+200B/200C/200D/2060 조합, 공백+제로폭 혼합, 소프트 하이픈(U+00AD), 한글 채움 문자(U+3164), 점자 빈칸(U+2800) | 요청서: 거부 | **세 수 모두 전송됨** (`ok: true`, 호출 1회). `make_offer`·`accept_claim`은 보이지 않는 `note`와 함께 돈이 움직이는 요청이 나간다 | 아니오 (해석 필요) |

### (4) 검증 순서 (한 번 성공시킨 뒤 같은 `planId`·같은 `call`로 다시 실행)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 승인 없음 | `approval: null` | `ok: false` | `ok: false` (`approvalMissing`), 총 호출 1 | 예 |
| planId 불일치 | 다른 계획의 승인 | `ok: false` | `ok: false` (`approvalMismatch`), 총 호출 1 | 예 |
| 허용되지 않은 수 | `allowedMoves: ['send_message']` / `[]` | `ok: false` | `ok: false` (`moveNotAllowed`), 총 호출 1 | 예 |
| 직접 쓴 금액 | `$9.99를 환불해 드릴게요.` | `ok: false` | `ok: false` (`literalAmount`), 총 호출 1 | 예 |
| 남은 토큰 | `{{offerAmount}}를 ⟦DATE_1⟧까지` | `ok: false` | `ok: false` (`tokensRemaining`), 총 호출 1 | 예 |
| 그 밖의 거부 대상 | 모르는 자리표시자 / 빈 메시지 / 분쟁 ID 불일치 / 금액 7.5 / `refundType: null` / `apiMove`를 `provide_evidence`로 / `accept_claim`으로 바꾸고 확인란 없음 | `ok: false` | 모두 `ok: false` (`unknownPlaceholder`, `messageEmpty`, `disputeMismatch`, `amountNotInteger`, `refundTypeMissing`, `evidenceUnsupported`, `acceptClaimUnconfirmed`), 총 호출 1 | 예 |
| `accept_claim` 성공 뒤 확인란 | `confirmAcceptClaim` 없음 / 문자열 `"true"` | `ok: false` | `ok: false` (`acceptClaimUnconfirmed`), 총 호출 1 | 예 |
| 같은 입력 | 그대로 다시 실행 (3회까지) | 호출 없이 이전 결과 | 이전 결과와 같은 값(같은 객체 참조), 총 호출 1 | 예 |
| 같은 `planId`, 다른 유효 입력 | 초안만 다른 문장 / 금액만 999센트 | 참고 (T008 5항: 같은 `planId`면 이전 결과) | 호출 없이 이전 결과. 새 초안·새 금액은 나가지 않는다 | 참고 |
| 다른 `call` 참조 | 같은 계획을 `call` A·B로 | 지시서 "그대로 둘 것": `call`별 기억 | 각 1회 호출, `requestId` 동일 (`<planId>:make-offer`) | 예 |
| 동시 실행 | 첫 응답 전에 같은 계획 2회 | 참고 | 호출 2회, `requestId` 동일 | 참고 |

### (5) 응답 상태 (같은 계획을 두 번 실행)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 2xx 정수 | 200, 201, 204, 299 | 성공, 기억 (총 호출 1) | `ok: true`, `sent: [{ path, status }]`, 총 호출 1 | 예 |
| 2xx 밖 정수 | 199, 300, 400, 500 | 실패, 기억 안 함 (총 호출 2) | `ok: false` (`callFailed`: `The make-offer call failed (status code 500).`), 총 호출 2 | 예 |
| 상태 없음·수 아님 | `status` 없음, `"200"`, `NaN`, `200.5`, `null`, `true`, `Infinity` | 실패, 기억 안 함 | `ok: false` (`callNoStatus`), 총 호출 2. 문구에 `undefined`·`NaN` 없음 | 예 |
| 응답 자체가 이상 | `null`, `undefined`, 문자열 `"200"`, 수 `200` | 실패, 기억 안 함 | `ok: false` (`callNoStatus`), 총 호출 2. 예외 없음 | 예 |
| `call` 예외 | 비동기 예외 / 동기 예외 | 예외를 던지지 않고 실패, 기억 안 함 | `ok: false` (`callErrored` → `nextRetry`), 비동기 경우 총 호출 2 | 예 |
| 실패 뒤 재시도 | 500 → 200 → 다시 실행 | 실패, 성공, 이전 결과 | `false, true, true`, 총 호출 2, 두 호출의 `requestId` 동일 | 예 |
| 음수 정수 | `status: -200` | 실패 | `ok: false`, 문구 `status code -200` (`callFailed`) | 예 |

### (6) 문구
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 한글 | 위 시나리오 전체에서 모은 거부·실패 결과 144건의 `error`·`nextAction` 288문장을 `[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-퟿]`로 검사 | 0건 | 한글 0건, 비ASCII 문자 0건, 빈 문장 0건 | 예 |
| 상수 한 곳 | 288문장을 `EXEC_COPY` 값(자리표시자 포함)과 대조 | 전부 상수에서 나옴 | 상수에서 나오지 않은 문장 0건. `EXEC_COPY` 31개 키 전부 실행으로 확인 (문장 26 + 조각 5). 값 중 비ASCII 0건 | 예 |
| 자리표시자 남음 | `error`·`nextAction`에 `{{`·`}}` | 0건 | 0건 | 예 |
| 응답 본문 | 401·422·500·302 + 본문에 `access_token`·`debug_id`·이메일·`Bearer …` | 싣지 않음, 상태 코드만 | 누출 없음. `The make-offer call failed (status code 401).` | 예 |
| 예외 메시지 | `throw new Error('Bearer … seoyeon@example.com')` | 싣지 않음 | 누출 없음. `The make-offer call ended with an error.` | 예 |
| 초안 원문·토큰 이름 | 표식 문자열·이메일·전화번호가 든 초안 + `$9.99` / `{{ZZTOKENZZ}}` / `⟦ZZTOKENZZ_1⟧` | 싣지 않음 | 누출 없음 (고정 문구만. 금액 값 `9.99`도 실리지 않는다) | 예 |
| 계약 타입 밖 값 | `plan.apiMove`·`board.allowedMoves`에 임의 문자열 | 참고 | `moveNotAllowed` 문구에 그 문자열이 그대로 실린다 (`…: ZZ_weird_move buyer@example.com (allowed: …)`). 계약 타입(`MoveType`)을 지키면 4개 고정 값뿐이다 | 참고 |

### T008 동작 회귀
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 승인 없이는 호출 0회 | 세 수 × (승인 없음 / `planId` 다름) | 거부·0회 | 6건 모두 `ok: false`, 호출 0 | 예 |
| 한 계획에 호출 1회 | 같은 계획 3번 실행 | 1회 `['make-offer']` | 1회 `["make-offer"]` | 예 |
| 메시지 금액 = 본문 금액 | 1·5·99·100·720·1005·123456센트 × `make_offer`·`accept_claim`·`send_message` (기대값은 검증자가 정수 나눗셈으로 따로 계산) | `$0.01`/`0.01` … `$1,234.56`/`1234.56` | 21건 모두 일치 (`$0.01`, `$0.05`, `$0.99`, `$1.00`, `$7.20`, `$10.05`, `$1,234.56`) | 예 |
| 요청 경로·본문·`requestId` | `make_offer`·`accept_claim` × `REFUND`·`REFUND_WITH_RETURN`, `send_message` | `POST /v1/customer/disputes/{id}/{엔드포인트}`, `requestId = <planId>:<엔드포인트>`, 본문 키는 지시서 표와 같음 | 5건 모두 기대 객체와 일치. `offer_type`/`accept_claim_type` = `plan.refundType`, `send_message` 본문은 `{ message }`뿐 | 예 |
| 성공 결과 | `ok: true`의 `sent` | `[{ path, status: 200 }]` | 일치 | 예 |
| 입력 불변 | 깊게 얼린(`Object.freeze`) 입력으로 세 수 실행 | 예외 없음, 입력 그대로 | 3건 모두 성공, 입력 JSON 동일 | 예 |
| AC11·AC12 | 인수 테스트 | 10개 통과 | 10개 통과 | 예 |

## 지시서 대조
| 항목 | 판정 | 근거 |
|---|---|---|
| 고칠 것 1. 직접 쓴 금액 거부 범위 | **충족** (해석 필요 1건) | `src/exec/message.ts:42-51` 4종 판정, `:67-71`에서 호출 전에 거부. 지시서에 적힌 표기 전부 거부, 적힌 비금액(`11/12`, `2026-11-12`, 긴 숫자열, `3 weeks`, `3주`) 전부 통과, 경계는 `tests/unit/execute.test.ts:291-360` 표(거부 28행 + 통과 14행). 해석 필요: "`₩`·`€`·`£`·`¥` 금액"을 기호가 **앞**에 올 때만 잡는다 (`7,20 €`·`7€`는 통과) |
| 고칠 것 2. 남은 토큰 거부 | **충족** | `message.ts:54`, `:88-90`. 채운 뒤 `{{`·`}}`·`⟦`·`⟧`가 있으면 `tokensRemaining` → `nextRegenerateDraft`("Generate the draft message again…", `copy.ts:53-54`). `⟦…⟧`를 채우는 코드는 없다 |
| 고칠 것 3. 빈 메시지 거부 | **충족** (해석 필요 1건) | `message.ts:91-93`, `request.ts:48-50`. 빈 문자열·공백 7종은 세 수 모두 호출 0회 거부. 해석 필요: `trim()`이 지우지 않는 보이지 않는 문자(U+200B 등)만 있는 초안은 전송된다. 지시서 문언은 "비었거나 공백뿐" |
| 고칠 것 4. 검증 순서 | **충족** | `src/exec/execute.ts:52-74`(거부 검사 전부) 뒤 `:76-78`(중복 기억). 시나리오 (4)의 거부 대상 15종이 성공 뒤에도 `ok: false` |
| 고칠 것 5. 응답 상태 | **충족** | `execute.ts:45-47`(`Number.isInteger` + 200~299), `:91-101`. 성공만 `remember` |
| 고칠 것 6. 문구를 영어로 | **충족** | `src/exec/copy.ts:21-65` 한 곳의 상수, 이름이 키(`exec.<이름>`, `:18-19`). 288문장 한글·비ASCII 0건. 자리표시자에 넣는 값은 엔드포인트·상태 코드·`apiMove`·`allowedMoves`·모양 이름뿐 (`execute.ts:60-61, 86-96`, `message.ts:69`, `request.ts:34-46`). 응답 본문은 읽지 않는다 (`execute.ts:84` `catch`에 변수 없음, `:91`에서 `status`만 읽음) |
| 고칠 것 7. 단위 테스트 보강 | **충족** | `tests/unit/execute.test.ts:232-284`(본문 전체 `toEqual`, `REFUND`·`REFUND_WITH_RETURN`), `:758-791`(토큰처럼 보이는 응답 본문·예외 메시지), `:291-590`(1~5 경계). 130개 통과 |
| 그대로 둘 것 1. 중복 기억은 `call` 참조별 | **충족** | `execute.ts:30` `WeakMap<PayPalCaller, Map<planId, result>>`. 다른 `call`이면 각 1회 호출, `requestId` 동일 (`request.ts:25-27`). AC12 "대조" 테스트 통과 |
| 그대로 둘 것 2. 방어 거부 유지 | **충족** | `disputeId` 불일치 `execute.ts:57`, 금액 비정수 `:39-42, 66`, 금액 null·`refundType` null `request.ts:33-38`, 금액 없는 계획의 금액 자리표시자 `message.ts:78-82`. 시나리오로 모두 호출 0회 확인 |
| 완료 기준 | **충족** | AC11·AC12 10/10, `npm test` 320/320, `tsc` 대상 파일 오류 0, 실제 호출 없음 (`src/exec/`에 네트워크·환경 변수 코드 없음) |
| 수정 가능 폴더 | **충족** | 변경 6개 파일 모두 `src/exec/`, `tests/unit/execute.test.ts`, `reports/T027-impl.md` |

구현자 보고와의 대조: 보고의 테스트 숫자(10 / 320 / 51+2 / tsc 2건)와 "남은 문제" 7항목은 내가 직접 확인한 결과와 같다. 보고에 없는 것은 아래 문제 1·2·3(일부)·4·6이다.

## 발견한 문제
병합 차단: **없음.**

| # | 심각도 | 문제 | 재현 | 근거 |
|---|---|---|---|---|
| 1 | 병합 후 수정 | 보이지 않는 문자만 있는 초안이 세 수 모두 전송된다. `make_offer`·`accept_claim`이면 구매자에게 빈 것으로 보이는 `note`와 함께 돈이 움직인다 | `messageTemplate: '​'` (또는 U+200C/200D/2060/00AD/3164/2800) → `ok: true`, 호출 1회 | `message.ts:91`, `request.ts:48`의 `trim()`은 유니코드 공백만 지운다. 지시서 3 문언("공백뿐")은 충족. 구현자 보고에 없음 |
| 2 | 병합 후 수정 (범위는 결정 3) | 직접 쓴 금액 중 24종이 통과해 구매자 메시지 금액과 API 금액이 달라질 수 있다. 유형: ① 기호가 뒤 (`7,20 €`, `7€`, `7$`) ② 지시서 밖 통화 이름 (`9,600원`, `7불`, `7유로`, `800엔`, `7 won`, `CAD 7`, `7 미국 달러`) ③ 숫자가 아닌 금액 (`seven dollars`, `칠 달러`) ④ 사이에 다른 글자 (`$`+제로폭+`7`, `&#36;7`, `$<b>7</b>`, `7-dollar`, `USD: 7`, `7 (USD)`) ⑤ 기호 없는 `7,20`·`7.2`·전각 영문 `７ＵＳＤ` | (1) 표의 "통과" 행. 모두 호출 1회, 본문은 `7.20` | `message.ts:42-51`. 움직이는 돈은 항상 `plan.amountCents`라 틀리지 않는다. 구현자 보고는 `7,20`·`9,600원`·`7불`·`칠 달러`만 적었다 |
| 3 | 병합 후 수정 | 금액 판정을 채우기 **전** 초안에만 해서, 자리표시자에 숫자가 붙으면 채운 뒤 다른 금액으로 읽힌다 | `{{offerAmount}}0` → `note: "$7.200"`, `{{offerAmount}},000` → `"$7.20,000"`, `1{{offerAmount}}` → `"1$7.20"` (본문 7.20). AC11의 금액 추출 정규식으로 읽으면 `7.200` ≠ `7.20` | `message.ts:67-71`(채우기 전) vs `:84-86`(채우기). 채운 뒤에는 토큰·빈 메시지 검사만 있다 |
| 4 | 병합 후 수정 (결정 1·2) | 과차단. ① 소수 둘째 자리 판정이 점 날짜·시각·무게·비율·버전을 막는다 (`11.12`, `2026.11.17`, `17.00`, `1.25 kg`, `12.50%`, `v1.10`) ② 통화 코드·이름 판정에 단어 경계가 없어 `5 centimeters`, `3 centers`, `18 century`, `2 buckets`, `2 European orders`, `size 38 EUR`·`EUR 38`, `amateur 5`, `5 USDA`가 막힌다 | (1) 표 "과차단" 행. 거부이므로 돈은 움직이지 않고, 판매자는 "amount directly" 문구를 본다 | `message.ts:46, 48`(대소문자 무시, 뒤에 `\b` 없음), `:50`. 구현자 보고는 `11.12` 1건만 적었다 |
| 5 | 의견 | 비슷한 모양의 채워지지 않은 토큰이 그대로 구매자에게 간다: `{offerAmount}`, `{ {offerAmount} }`, `[[DATE_1]]`, `〚DATE_1〛`, `｛｛offerAmount｝｝`. `{{{offerAmount}}}`는 `{$7.20}` | (2) 표 마지막 행 | `message.ts:26, 54`. 지시서 2는 `{{…}}`·`⟦…⟧`만 요구. 구현자 보고에 일부 있음 |
| 6 | 의견 | `{{ offerAmount }}`처럼 안쪽에 공백·줄바꿈이 있는 자리표시자는 거부가 아니라 채워진다. 금액은 일치하고 토큰도 남지 않는다 | (2) 표 "안쪽 공백" 행 | `message.ts:26` (의도된 동작으로 주석·단위 테스트 `:339`에 있음). 요청서의 기대(거부)와 다르다 |
| 7 | 의견 | 같은 `planId`가 한 번 성공하면, 초안이나 금액이 달라진 유효한 입력도 호출 없이 이전 결과를 돌려준다. 이때 `nextFixDraft` 문구("Fix the draft message, approve it again, and run it.")를 따라 초안을 고쳐도 같은 `planId`면 다시 나가지 않는다 (이미 한 번 보냈으므로 중복 전송은 없다) | (4) 표 "같은 `planId`, 다른 유효 입력" | `execute.ts:76-78`. T008 5항과 같은 동작 |
| 8 | 의견 | `moveNotAllowed`·`moveUnsupported`·`amountMissing`·`refundTypeMissing` 문구에 `plan.apiMove`, `board.allowedMoves` 값을 그대로 싣는다. 계약 타입을 지키면 고정 값이지만, PayPal 응답 `links[].rel`을 변환 없이 넣는 배선이면 응답에서 온 문자열이 화면 문구에 실린다 | (6) 표 마지막 행 | `execute.ts:60-61`, `request.ts:34-46`, `copy.ts:11` |
| 9 | 의견 | 동시 실행(첫 응답 전 2회)은 호출 2회 (같은 `requestId`). 중복 실행 때 같은 객체 참조를 돌려준다. 금액 0·음수·`1e21`은 그대로 나간다 (`$0.00`/`0.00`, `-$7.20`/`-7.20`, `$1e+.21`/`1e+.21`) | (4) 표, 별도 실행 | T008 검증 의견 4·6·11과 같고 T027 범위 밖. 구현자 보고에 있음 |
| 10 | 의견 | `src/exec/amount.ts:11`의 예외 메시지가 한글이다. `executeMove`에서는 `execute.ts:66`이 먼저 막아 도달하지 않지만, `centsToDisplay`를 직접 부르는 코드에는 한글 예외가 나간다 | 코드 확인 | T027에서 바뀌지 않은 파일 |

### 단위 테스트의 질 (`tests/unit/execute.test.ts`, 130개)
- 지시서 7의 세 항목이 모두 있다: 본문 전체를 `toEqual`로 고정(`:232-284`), 토큰처럼 보이는 응답 본문과 예외 메시지 누출 검사(`:758-791`), 1~5 경계 표. T008 검증이 빠졌다고 적은 항목(`REFUND_WITH_RETURN`, `confirmAcceptClaim: false`, 상태 경계, 누출 테스트의 빈 본문)이 채워졌다.
- 계획마다 새 `planId`(`freshPlan`)를 써서 중복 기억이 테스트 사이에 섞이지 않는다.
- 빠진 경계: 보이지 않는 문자만 있는 메시지(문제 1), 기호가 뒤에 오는 금액(`7 €`), 자리표시자에 붙은 숫자(문제 3), 단어 경계 과차단(`5 centimeters`), 성공 뒤 `planId` 불일치·분쟁 ID 불일치 재실행, 같은 `planId`에 다른 유효 입력, 입력 불변. 과차단은 `11.12` 1행만 표에 있다.
- 거부 문구 검사는 대부분 `toBe(EXEC_COPY.x)`라 키 배선은 고정하지만 문장 내용은 고정하지 않는다 (문구를 `config/`로 옮길 때는 유리하다). 한글 검사는 11개 경로 + 상태·예외 경로를 돈다.

## 컨트롤 타워가 결정할 것
확인한 사실과 선택지만 적는다.

1. **점으로 쓴 날짜·소수 둘째 자리 수의 과차단** (구현자 요청 2, 문제 4①)
   - 사실: `11.12`, `11.17.`, `2026.11.17`, `17.00`, `1.25 kg`, `12.50%`, `v1.10`은 거부된다. `11/17`, `2026-11-12`, `11월 17일`, `Nov 17`, `17. November`, `2026. 11. 17.`(공백 있음)은 통과한다. PRD의 서연 한국어 전송본·영어 초안·통관 안내 문장 그대로는 전송된다. PRD 10-5는 날짜를 "한국어 11월 17일, 독일어 17. November"로 복원한다고 적었고 두 표기 모두 통과한다.
   - 선택지: (a) 지금대로 두고, 날짜 복원 표기를 `11월 17일`·`Nov 17`·`11/17`로 한정한다고 T010 지시서에 적는다 (b) 기호 없는 소수 둘째 자리 판정을 좁히거나 뺀다 (지시서 1의 `7.20` 항목 변경) (c) 지금대로 두고 화면이 거부 문구에 날짜 표기 안내를 덧붙인다.
2. **통화 코드·이름 판정의 단어 경계** (문제 4②. 구현자 보고에 없음)
   - 사실: `5 centimeters`, `3 centers`, `18 century`, `2 buckets`, `2 European orders`, `size 38 EUR`, `EUR 38`, `Order #5 USDA…`가 거부된다. `30 cm`, `62cm`, `size 7 US`는 통과한다.
   - 선택지: (a) 받아들인다 (거부는 돈이 움직이지 않는 쪽) (b) 후속 작업으로 단어 경계를 넣는다 (`EUR 38` 같은 사이즈 표기를 금액으로 볼지는 따로 정해야 한다).
3. **지시서 목록 밖 금액 표기를 이 층에서 막을지** (구현자 요청 3, 문제 2·3)
   - 사실: `7,20 €`·`7€`·`7$`, `9,600원`·`7불`·`7유로`·`800엔`·`7 won`·`CAD 7`, `seven dollars`·`칠 달러`, `$`+제로폭+`7`·`&#36;7`, `7,20`·`7.2`가 통과하고, `{{offerAmount}}0`은 `$7.200`으로 나간다. 본문 금액은 항상 계획 금액이다. `7 euros`·`7 EUR`은 이미 거부된다.
   - 선택지: (a) 이 층은 지시서 범위로 두고, 나머지는 `src/ai/tokens.ts`의 `literalFacts` 검사(T010)가 막는다고 정한다. 이 경우 화면(T009)이 토큰 검사를 통과한 전송본만 `executeMove`에 넘기는지 확인이 필요하다 (b) 후속 작업으로 넓힌다: 기호가 뒤에 오는 경우, `원`·`엔`·`유로`·`불`·`won`·`yen`, 제로폭 문자 제거 뒤 판정, 채운 뒤 자리표시자 앞뒤 숫자 검사 (c) 수사(`seven`, `칠`)는 정규식으로 막을 수 없으므로 어느 쪽이든 T010 몫으로 적어 둔다.
4. **빈 메시지 거부 통일과 보이지 않는 문자** (구현자 요청 4, 문제 1)
   - 사실: 세 수 모두 빈 문자열·공백이면 호출 0회로 거부하고, `note`는 항상 들어간다 (T008은 `make_offer`·`accept_claim`에서 `note` 없이 보냈다). 엔진이 `messageRequired: false`인 제안을 메시지 없이 실행하려 하면 `messageEmpty`로 거부된다. 제로폭 문자 등 보이지 않는 문자만 있는 초안은 전송된다.
   - 선택지: (a) 거부 통일을 확정하고, 화면·엔진이 제안·환불에도 항상 메시지 초안을 넘기게 한다 (b) 보이지 않는 문자만 있는 메시지도 빈 메시지로 볼지 후속 작업으로 정한다 (c) 그대로 둔다.
5. **금액 사실값 토큰(`⟦AMOUNT_n⟧`)과 `executeMove`의 관계** (구현자 보고에 없음)
   - 사실: `src/types.ts:247`의 `FactToken.kind`에 `'AMOUNT'`가 있다. `executeMove`는 `⟦AMOUNT_1⟧`이 남아 있으면 `tokensRemaining`으로, 그것이 `$72.00`으로 복원돼 들어오면 `literalAmount`로 거부한다. 즉 `executeMove`를 거치는 메시지에 금액을 넣는 방법은 `{{offerAmount}}`·`{{refundAmount}}`·`{{disputeAmount}}` 3종뿐이고, 날짜·추적번호 토큰은 `executeMove` 전에 복원돼 있어야 하며 `{{…}}`는 복원 단계에서 건드리지 않아야 한다.
   - 선택지: (a) T010·T009 지시서에 "`executeMove`로 보내는 초안의 금액은 `{{…}}` 3종만 쓴다. `⟦AMOUNT_n⟧`는 쓰지 않거나 복원하지 않는다. `⟦DATE⟧`·`⟦TRACKING⟧`·`⟦CUSTOMS_STATUS⟧`는 넘기기 전에 복원한다"를 적는다 (b) `executeMove`가 계획·분쟁 금액과 같은 값의 직접 표기는 통과시키게 한다 (지시서 1 변경).
6. **문구를 `config/copy.*.json`으로 옮기는 작업** (구현자 요청 1)
   - 사실: 문구는 `src/exec/copy.ts`의 `EXEC_COPY` 31개 키(문장 26 + 조각 5)에 모여 있고 전부 ASCII 영어다. 문구 안 자리표시자는 `{{endpoint}}`·`{{status}}`·`{{apiMove}}`·`{{allowed}}`·`{{shape}}`. `ExecuteResult`에는 오류 코드가 없어 화면은 지금 `error`·`nextAction` 문자열을 그대로 받는다.
   - 선택지: (a) 지금대로 두고 화면이 문자열을 그대로 보여준다 (b) ui 레인 작업으로 `exec.*` 키를 `config/copy.en.json`에 옮기고 `src/exec/`가 읽게 한다 (c) `ExecuteResult`에 코드를 추가한다 (계약 변경).
7. **같은 `planId`의 재실행과 문구** (문제 7)
   - 사실: 한 번 성공한 `planId`는 초안·금액이 달라도 유효하면 호출 없이 이전 결과를 돌려준다. 엔진의 `planId`가 초안 내용과 무관하게 정해지면, 보낸 뒤 초안을 고쳐 다시 보내는 흐름은 없다.
   - 선택지: (a) 지금대로 (한 계획은 한 번만 나간다) (b) 화면이 "이미 보냄"을 구분해 보여줄 수 있게 후속 작업에서 다룬다.
