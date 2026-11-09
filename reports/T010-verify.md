# T010 검증 (2026-11-09 23:24 KST)
- 판정: **실패**
  - 사유 1건: 금액을 직접 적은 문장이 `ok: true`로 통과한다 (독일어 `24,00 $`·`24 $`·`24 US-Dollar`, 일본어 `7米ドル`, 한국어 `7불` 등. 아래 "발견한 문제" 1번). 판정 기준의 "값이 직접 적힌 문장이 통과"에 해당한다.
  - 참고: 지시서 4항의 "최소한" 목록(`$24`, `$7.20`, `USD 7.20`, `7.20 dollars`, `7달러`, `24ドル`, `24 Dollar`, 전각, 날짜 8종, 추적번호 2종)은 **전부 잡힌다.** 통과한 표기는 모두 그 목록 밖이다. 목록 밖 표기를 병합 차단으로 볼지는 컨트롤 타워가 정할 수 있다 ("컨트롤 타워가 결정할 것" 1번).
  - 나머지 기준은 문제없음: 지시서·SPEC 위반 없음(해석 필요 2건), 직접 쓴 데모 정상 문장 16개 전부 `ok: true`, 날짜는 시간대와 무관, 범위 밖 수정 없음.
- 검증 대상: lane/ai `19d3c35` (T010 범위 `2e09ca2..19d3c35`, 커밋 `5bbc569`·`19d3c35`) · 기준 SPEC v2.2 (`SPEC.md` 첫 줄 `# SPEC v2.2 (2026-11-09 22:31 KST)`, 지시서의 기준 SPEC과 같음)
- 방법: 구현 테스트 표를 쓰지 않고 직접 만든 입력으로 실행했다 (임시 스크립트는 worktree 밖 scratchpad). `src/exec/message.ts`의 `fillMessage`는 정규식을 옮기지 않고 그대로 import해서 썼다. LLM·네트워크 호출 없음.

## 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-only 2e09ca2..HEAD` | — | — | `reports/T010-impl.md`, `src/ai/tokens.ts`, `tests/unit/tokens.test.ts` 3개뿐 (+1007줄, 삭제 0) |
| `git diff 2e09ca2..HEAD -- package.json package-lock.json config src/types.ts tests/acceptance` | — | — | 0줄 (계약·설정·의존성 변경 없음) |
| `grep -nE "fetch\|anthropic\|http\|Math\.random\|Date\.now\|new Date\|performance\|process\.env\|require\(\|import " src/ai/tokens.ts` | — | — | 걸리는 것은 8행 주석과 21행 `import type … from '@/types'`뿐. `Date`를 아예 쓰지 않는다 |
| `npx vitest run tests/unit/tokens.test.ts` | 62 | 0 | |
| `npm test` | 502 | 0 | 10개 파일 |
| `npx tsc --noEmit` | — | 0 | 출력 없음, 종료 코드 0 (프로젝트 전체 오류 없음) |
| `npx eslint src/ai/tokens.ts tests/unit/tokens.test.ts` | — | 0 | 출력 없음 |
| `npm run test:acceptance` | 117 | 2 | 실패 2개는 둘 다 `ac13.sandbox.test.ts` (`.env.example` 없음, `.gitignore`의 `.env*`). 판정에서 제외. 건너뜀 9 |
| 독립 시나리오 스크립트 4개 (`npx tsx`), 기본 시간대 + `TZ=Pacific/Kiritimati`·`America/Los_Angeles`·`UTC` | — | — | 아래 표. 시간대 4개의 출력이 한 글자도 다르지 않음 (`diff`) |
| `git status -s` (끝날 때) | — | — | `?? reports/T010-verify.md` 한 줄 |

## 독립 시나리오
"일치" 칸: ○ = 기대와 같음, ✕ = 기대와 다름, — = 기대를 정하지 않고 사실만 기록.

### 토큰 문법 (같은 글을 초안·전송본에 넣고 `facts`에 네 토큰을 줌)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 문법 | `⟦DATE_1⟧`, `⟦AMOUNT_2⟧`, `⟦TRACKING_10⟧`, `⟦CUSTOMS_STATUS_1⟧` | 토큰, `ok: true` | 넷 다 `extractTokens`에 나오고 `ok: true` | ○ |
| 문법 | `⟦PCCC⟧`, `⟦date_1⟧`, `⟦DATE_0⟧`, `⟦DATE_01⟧`, `⟦DATE_1 ⟧`, `⟦ DATE_1⟧`, `⟦FOO_1⟧`, `⟦⟧`, `⟦DATE_-1⟧`, `⟦DATE_1.5⟧`, `⟦DATE_１⟧`(전각), `⟦DATE1⟧`, `⟦CUSTOMS_1⟧`, `⟦DATE␤_1⟧`(줄바꿈) | 토큰 아님, `extra`에 원문 그대로 | 전부 `extractTokens` 빈 배열, `extra`에 원문 그대로, `ok: false` | ○ |
| 문법 | 반쪽 `⟦DATE_1` / `DATE_1⟧` | 형식 오류 (원문이 무엇인지는 지시서에 없음) | `extra: ["⟦"]` / `extra: ["⟧"]` — 괄호 한 글자만 들어가고 `DATE_1`은 안 들어감. `ok: false` | — (결정 2) |
| 문법 | 겹친 `⟦⟦DATE_1⟧⟧` | — | 안쪽 `⟦DATE_1⟧`은 토큰으로 세고, 바깥 괄호는 `extra: ["⟦","⟧"]`. `ok: false`. `fillTokens`는 예외 | — |
| 문법 | 겹친 `⟦DATE_1⟦AMOUNT_2⟧⟧` | — | `⟦AMOUNT_2⟧`만 토큰, `extra: ["⟦","⟧"]`, `ok: false` | — |
| 문법 | `[DATE_1]`, `〚DATE_1〛` (다른 괄호) | 토큰도 형식 오류도 아님 | `extra: []`, `ok: true` | ○ |
| 문법 | `⟦DATE_99999999999999999999⟧` | 모양은 토큰 | 토큰으로 추출, `facts`에 없어서 `extra` | ○ |

### `missing` / `extra`
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 개수 | 초안 2번 · 전송본 1번 | `missing` 1 | `missing: ["⟦DATE_1⟧"]`, `extra: []` | ○ |
| 개수 | 초안 3번 · 전송본 1번 | `missing` 2 | `missing: ["⟦DATE_1⟧","⟦DATE_1⟧"]` | ○ |
| 개수 | 초안 1번 · 전송본 2번 | `extra` 1 | `extra: ["⟦DATE_1⟧"]`, `missing: []` | ○ |
| `facts` 밖 | `⟦DATE_2⟧`가 초안·전송본 모두에 (facts에 없음) | `extra` | `extra: ["⟦DATE_2⟧"]` (한 번), `missing: []`, `ok: false` | ○ |
| `facts` 밖 | `⟦DATE_2⟧`가 초안에만 | — | `missing`과 `extra` **둘 다**에 `⟦DATE_2⟧` | — (결정 4) |
| `facts` 밖 | `⟦DATE_2⟧`가 전송본에만 | `extra` | `extra: ["⟦DATE_2⟧"]` | ○ |
| 순서 | 초안 `DATE_1, TRACKING_10` ↔ 전송본 `TRACKING_10, DATE_1` | 통과 | `ok: true` | ○ |
| 순서 | 초안 `D, T, D` ↔ 전송본 `T, D, D` | 통과 | `ok: true` | ○ |
| 바꿔치기 | 초안 `⟦DATE_1⟧` ↔ 전송본 `⟦TRACKING_10⟧` | `missing` + `extra` | `missing: ["⟦DATE_1⟧"]`, `extra: ["⟦TRACKING_10⟧"]` | ○ |
| 형식 오류 | `⟦PCCC⟧`가 **초안에만** | — | `extra: ["⟦PCCC⟧"]`, `ok: false` (초안의 형식 오류도 전송을 막는다) | — |
| 기타 | 빈 문자열 둘 / `facts`에만 있고 글에는 없는 토큰 | `ok: true` | `ok: true` | ○ |

### `literalFacts`: 막아야 할 것 (52개 중 52개 잡힘)
`checkTokens('', '가 <값> 나', [])`로 모양만 봤다. 뒤 11개는 `facts`를 줬다.
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 금액 20개 | `$24`, `$7.20`, `USD 7.20`, `7.20 dollars`, `7달러`, `24ドル`, `24 Dollar`, `＄２４`, `２４ドル`, `７．２０`, `$ 24`, `US$24`, `24 USD`, `24.00`, `7 dollars`, `20 cents`, `24 U.S. dollars`, `₩9,600`, `9,600원`, `1,234.56` | 잡힘 | 20개 모두 잡힘. 보고 문자열은 원문 그대로이고 `1,234.56`만 `234.56`으로 일부만 보고 | ○ |
| 날짜 16개 | `11월 17일`, `11월17일`, `November 17`, `Nov 17`, `17 November`, `11/17`, `2026-11-17`, `11月17日`, `17. November`, `１１月１７日`, `2026년 11월 17일`, `Nov. 17th`, `17th November`, `11/17/2026`, `17. Nov`, `2026/11/17` | 잡힘 | 16개 모두 잡힘 (`2026년 11월 17일`→`11월 17일`, `2026/11/17`→`11/17`로 일부만 보고) | ○ |
| 추적번호 5개 | `1Z999AA10123456784`, `EE123456789KR`, `RB987654321JP`, `LX123456789DE`, `9400111899223197428490X` | 잡힘 | 5개 모두 원문 그대로 | ○ |
| `facts` 값 그대로 | `Held at customs`, 센트 `720`, `2026-11-17`, `통관 보류`, 숫자만인 추적번호 `123456789012`(모양으로는 안 잡히는 값) | 잡힘 | 5개 모두 잡힘 | ○ |
| `formatFact` 표기 | `DATE 2026-11-17`의 `11월 17일` / `November 17` / `11月17日` / `17. November`, `AMOUNT 720`의 `$7.20`, 추적번호 값 | 잡힘 | 6개 모두 잡힘 | ○ |

### `literalFacts`: 막지 말아야 할 것 (41개 중 41개 통과)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 기간·수량 | `3 weeks`, `3주`, `2 days`, `1개`, `2 items`, `24시간`, `주문 수량 2벌`, `3주가 지났는데`, `2개를 주문했는데`, `5명의 고객`, `within 48 hours`, `7〜10日`, `3 bis 5 Werktage`, `10 minutes`, `2번째 문의`, `30일 이내`, `14 Tage`, `3-5 business days` | `[]` | 전부 `[]` | ○ |
| 치수·사이즈 | `size M`, `52 cm`, `52cm`, `Größe 38`, `サイズM`, `1サイズ大きめ` | `[]` | 전부 `[]` | ○ |
| 일반 낱말 | `v2`, `COVID-19`, `iPhone 15`, `Fernwood Knits`, `Thank you for your patience`, `PayPal`, `USPS`, `DHL`, `EMS`, `Oatmeal Cardigan`, `Order #12`, `2026년`, `November`(달만), `11월`(달만), `月曜日`, `15% off` | `[]` | 전부 `[]` | ○ |
| 약속 쪽 | `100%` | `literalFacts`는 `[]` (약속 표현 쪽에서 잡는다) | `literalFacts: []` | ○ |

### `literalFacts`: 경계 탐침 (기대를 정하지 않고 결과만)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 금액인데 **안 잡힘** | `24 $`, `24$`, `7 $`, `7,20 $`, `24,00 $`, `24,- $`, `24 US$`, `24 €`, `24€`, `24,00 €`, `24 US-Dollar`, `24,00 US-Dollar`, `24米ドル`, `7USドル`, `24불`, `24 US달러`, `24 미국 달러`, `2만 4천원`, `seven dollars`, `twenty-four dollars`, `칠 달러`, `24.5` | — | 전부 `[]` | — (문제 1) |
| 금액, 일부만 보고 | `7,20 Euro`→`20 Euro`, `24,00 USD`→`00 USD`, `24,00 Dollar`→`00 Dollar`, `USD 24,00`→`USD 24` | — | 잡히지만 보고 문자열이 값의 일부 | — |
| 날짜인데 **안 잡힘** | `17일`, `17日`, `the 17th`, `17th of November`, `November the 17th`, `11-17`, `17. Dez`, `9. Okt`, `十一月十七日`, `November seventeenth` | — | 전부 `[]` | — (문제 2) |
| 날짜, 소수 모양으로 잡힘 | `17.11.`, `17.11.2026`, `11.17` | — | `17.11` / `17.11` / `11.17` (금액 소수 모양으로 잡힘) | — |
| 날짜 아님 | `March 2026`, `May 2026` | — | `[]` | — |
| 추적번호 변형 | 소문자 `ee123456789kr`(`facts`에 대문자 값이 있어도), 띄어 쓴 `EE 123 456 789 KR`, 숫자만 `123456789012`(`facts`에 없을 때), `1234-5678-9012` | — | 전부 `[]` | — |
| 추적번호 모양 오탐 | 쿠폰 코드 `FERNWOOD15`(10자), PayPal 주문 ID `5O190127TN364715T` | — | 둘 다 잡힘. `WELCOME10`(9자), `FW-CARD-OAT-M`, `PP-D-12345`는 `[]` | — |
| 날짜 모양 오탐 | `24/7`, `1/2`, `3/4 sleeve`, `50/50` | — | 전부 날짜(`dateSlash`)로 잡힘 | — (문제 3) |
| 달 이름 오탐 | `Size 8 may run small`→`8 may`, `Item 2 may arrive later`→`2 may`, `you may 1) return it`→`may 1` | — | 조동사 `may`가 달 이름으로 잡힘 (대소문자 무시) | — (문제 3) |
| 통화 낱말 오탐 | `96 centimeters`→`96 cent`, `30 centimeter`→`30 cent`, `2 europäische Länder`→`2 euro`, `사이즈 2 원하시면`→`2 원`, `3 원단`→`3 원`, `3 円形`→`3 円`, `5 bucket`→`5 buck` | — | 통화 낱말 뒤에 낱말 경계가 없어 잡힘 | — (문제 3) |
| 소수 둘째 자리 오탐 | `0.45 kg`, `2.54 cm`, `10.30 Uhr`, `v1.25` | — | 잡힘 (`96.5cm`, `7.205`는 `[]`). 실행 층도 같은 기준으로 거부 | — |
| `facts` 값과 우연히 같은 수 | `AMOUNT` 값 `24` + 글 `24시간`, 값 `100` + `100%`, 값 `2026` + `2026년` | — | 셋 다 잡힘. 값이 한 글자(`7`)면 그대로 찾지 않아 `7일`은 `[]` | — |
| `facts` 값이 흔한 낱말 | `CUSTOMS_STATUS` 값 `cleared` + 글 `has cleared customs` | — | `["cleared"]` | — |

### 데모 문장 (직접 쓴 16개. 초안 영어 ↔ 전송본 구매자 언어)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| D01 서연 ko | 통관·추적 안내, `⟦DATE_1⟧`·`⟦CUSTOMS_STATUS_1⟧`·`⟦TRACKING_1⟧` | `ok: true` | `ok: true`, 네 배열 빈 값 | ○ |
| D02 서연 ko | 후속 안내 ("영업일 기준 2~3일", "3~5일", 카드사 언급) | `ok: true` | `ok: true` | ○ |
| D03 지호 ko | 부분 환불 제안, `{{offerAmount}}` | `ok: true` | `ok: true` | ○ |
| D04 지호 ko | 색상 설명 (사실값 없음) | `ok: true` | `ok: true` | ○ |
| D05 Yuki ja | 사이즈 안내 ("1サイズ大きめ", "身幅は52cm、着丈は64cm") | `ok: true` | `ok: true` | ○ |
| D06 Yuki ja | 발송 안내, `⟦DATE_1⟧`·`⟦TRACKING_1⟧`, "7〜10日" | `ok: true` | `ok: true` | ○ |
| D07 Lena de | 환불 안내, `{{refundAmount}}`, "3 bis 5 Werktagen" | `ok: true` | `ok: true` | ○ |
| D08 Lena de | 반품 도착, `⟦DATE_1⟧` + `{{refundAmount}}` | `ok: true` | `ok: true` | ○ |
| D09 buyer_m en | 미수령 안내, `⟦DATE_1⟧`·`⟦TRACKING_1⟧`, "7 to 10 business days" | `ok: true` | `ok: true` | ○ |
| D10 buyer_m en | 택배 상태 ("in 1-2 days") | `ok: true` | `ok: true` | ○ |
| D11 ko FAQ | 통관 안내 ("P로 시작하는 13자리") | `ok: true` | `ok: true` | ○ |
| D12 Yuki ja | 통관 상태, `⟦CUSTOMS_STATUS_1⟧` | `ok: true` | `ok: true` | ○ |
| D13 Lena de | 사이즈 안내 ("52 cm") | `ok: true` | `ok: true` | ○ |
| D14 지호 ko | 결제 금액 안내, `⟦AMOUNT_1⟧`·`⟦DATE_1⟧` | `ok: true` | `ok: true` | ○ |
| D15 Yuki ja | 제안, `{{offerAmount}}` | `ok: true` | `ok: true` | ○ |
| D16 서연 ko | 사과 문장 (사실값 없음) | `ok: true` | `ok: true` | ○ |

같은 문장에 값을 직접 적은 경우 (토큰·자리표시자를 값으로 바꿈). "덧붙임" = 원래 문장은 그대로 두고 끝에 값만 덧붙인 경우 (토큰 개수로는 못 잡는 경우).
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| D01·D06·D08·D09 날짜 | `11월 17일`, `11/17`, `11月17日`, `１１月１７日`, `17. November`, `17.11.`, `17.11.2026`, `17. Nov.`, `November 17`, `Nov 17` | `ok: false` | 전부 `missing` + `literalFacts`. 덧붙임도 `ok: false` | ○ |
| D01·D06·D09 날짜 | `17일`, `17日`, `the 17th of November` | `ok: false` | 토큰을 바꿔 쓴 경우는 `missing`으로 `ok: false`. `literalFacts`는 `[]`이고 **덧붙임은 `ok: true`** | ✕ (문제 2) |
| D01·D06·D09·D12 | 추적번호 `EE123456789KR`, 통관 상태 `통관 보류`·`Held at customs` | `ok: false` | `missing` + `literalFacts`, 덧붙임도 `ok: false` | ○ |
| D03 지호 ko 금액 | `{{offerAmount}}` → `$7.20`, `7.20달러`, `7달러 20센트`, `약 7달러`, `7.2달러` | `ok: false` | 전부 `literalFacts`로 `ok: false` | ○ |
| D03 지호 ko 금액 | `{{offerAmount}}` → `7불` | `ok: false` | **`ok: true`** | ✕ (문제 1) |
| D07 Lena de 금액 | `{{refundAmount}}` → `$24.00`, `24 Dollar`, `24 USD`, `24,00 USD` | `ok: false` | 전부 `ok: false` | ○ |
| D07 Lena de 금액 | `{{refundAmount}}` → `24,00 $`, `24 $`, `24 US-Dollar`, `24,00 US-Dollar` | `ok: false` | **넷 다 `ok: true`**, `literalFacts: []` | ✕ (문제 1) |
| D14 지호 ko 금액 | `⟦AMOUNT_1⟧` → `$7.20`, `7.20달러`, 센트 `720` | `ok: false` | `missing` + `literalFacts` | ○ |
| D15 Yuki ja 금액 | `{{offerAmount}}` → `7.20ドル`, `7ドル`, `7.20米ドル`, `＄７．２０` | `ok: false` | 전부 `ok: false` | ○ |
| D15 Yuki ja 금액 | `{{offerAmount}}` → `7米ドル` | `ok: false` | **`ok: true`** | ✕ (문제 1) |

### `newPromises`
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 새 약속 20개 | 초안에 약속 없음 ↔ `보장`, `반드시`, `guarantee`, `promise`, `definitely`, `100%`, `必ず`, `garantiert`, `without fail`, `틀림없이`, `무조건`, `약속드립니다`, `保証`, `お約束`, `garantieren`, `verspreche`, `auf jeden Fall`, `GUARANTEED`, `Definitely`, `Auf Jeden Fall` | 잡힘 | 20개 모두 잡힘 (보고 문자열은 전송본에 적힌 대소문자 그대로, 낱말의 목록 부분만: `garantiert`→`garantier`) | ○ |
| 같은 뜻 12쌍 | `guarantee`↔`보장`/`保証`/`garantieren`, `promise`↔`약속드`/`約束`/`verspreche`, `definitely`↔`반드시`/`必ず`/`auf jeden Fall`/`100%`, `100%`↔`무조건`, `without fail`↔`틀림없이` | 통과 | 12쌍 모두 `[]` | ○ |
| 다른 묶음 | 초안 `guarantee` ↔ 전송본 `반드시` / 초안 `promise` ↔ `보장` / 초안 `definitely` ↔ `약속드` | 잡힘 | 셋 다 잡힘 | ○ |
| 여러 개 | 초안에 없음 ↔ "반드시 보장하고 또 보장합니다. Guarantee!" | — | `["반드시","보장","Guarantee"]` (나온 순서, 같은 낱말은 한 번) | — |

부정문·다른 뜻 (판단 없이 사실만):
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 오탐 쪽 | 전송본 `Let us find a compromise.` | — | `["promise"]` (낱말 안에 들어 있어도 잡힘) | — |
| 오탐 쪽 | 전송본 `It is delayed indefinitely.` | — | `["definitely"]` | — |
| 오탐 쪽 | 전송본 `날짜를 보장하지는 못하지만 …` (부정문) | — | `["보장"]` | — |
| 오탐 쪽 | 전송본 `We cannot guarantee the date.` (초안은 "not sure") | — | `["guarantee"]` | — |
| 오탐 쪽 | 전송본 `必ずしも届くとは限りません。` (부분 부정) | — | `["必ず"]` | — |
| 오탐 쪽 | 전송본 `It is 100% wool.` (초안은 "pure wool") | — | `["100%"]` | — |
| 오탐 쪽 | 전송본 `품질보장 마크` | — | `["보장"]` | — |
| 통과 | `반듯이 접어 주세요` | — | `[]` | — |
| 통과 | 초안·전송본 둘 다 `100% wool` / `울 100%` | — | `[]` | — |
| 놓침 쪽 | 초안 `It is 100% wool.` ↔ 전송본 `울 100% 제품입니다. 반드시 내일 도착합니다.` | — | **`[]`** (`100%`와 `반드시`가 같은 묶음 `certainty`라서, 초안의 "100% wool"이 새로 생긴 "반드시"를 통과시킨다) | — (문제 4) |
| 놓침 쪽 | 초안 `There is no guarantee.` ↔ 전송본 `보장합니다.` | — | `[]` (뜻이 반대여도 같은 묶음이면 통과) | — |
| 놓침 쪽 | 초안 `Let us find a compromise.` ↔ 전송본 `약속드립니다.` | — | `[]` (초안의 "compromise" 안 `promise`가 묶음을 켠다) | — |
| 놓침 쪽 | 전송본 `Garantie`(명사), `versprochen`, `verspricht`, `약속합니다`, `꼭`, `확실히`, `絶対に`, `certainly`·`for sure`·`absolutely`, `unbedingt`, `100 %`(독일어식 띄어쓰기), `１００％`(전각) | — | 전부 `[]` (지시서 목록에 없는 표현·활용형) | — |
| 표시 오류 | 전송본 `İİİ guarantee` (소문자로 바꾸면 길이가 달라지는 글자 뒤) | — | `["rantee"]` — 잡히기는 하지만 보고 문자열이 밀림 | — |

### `ok`
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| `ok` | 네 배열 모두 빈 값 | `true` | `true` | ○ |
| `ok` | `missing`만 / `extra`만 / `literalFacts`만 / `newPromises`만 하나씩 | 넷 다 `false` | 넷 다 `false` | ○ |

### `fillTokens`
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 예외 | `facts`에 없는 토큰 / `facts`가 빈 배열 | 예외 | `facts에 없는 토큰: ⟦DATE_2⟧` 예외 (토큰 이름만 싣는다) | ○ |
| 채우기 | `⟦DATE_1⟧ / ⟦TRACKING_10⟧ / ⟦DATE_1⟧` | 모두 치환, 괄호 없음 | `2026-11-17 / 1Z999AA10123456784 / 2026-11-17` (`value`를 그대로 넣는다. 현지 표기는 호출부가 `formatFact`로 만들어 넘겨야 한다) | ○ |
| 자리표시자 | `{{offerAmount}} {{ refundAmount }} {{disputeAmount}} {{unknown}} ⟦DATE_1⟧` | `{{…}}` 그대로 | `{{…}}` 4개 그대로, 날짜만 치환 | ○ |
| 치환 패턴 | `value`가 `$&` / `$1 $$ $\` $'` | 글자 그대로 | 글자 그대로 들어감 (`x $& y`) | ○ |
| 재귀 | `value`가 `⟦DATE_2⟧` (그리고 `⟦DATE_2⟧`도 `facts`에 있음) | 다시 치환하지 않음 | `사실값에 ⟦ 또는 ⟧가 들어 있다` 예외 (재귀 치환 없음) | ○ |
| 반쪽 괄호 값 | `value`가 `a⟧` | 괄호가 남지 않음 | 예외 | ○ |
| 형식 오류 | `⟦PCCC⟧`, `⟦DATE_1`, `DATE_1⟧`, `⟦⟦DATE_1⟧⟧` | 예외 | 넷 다 `토큰 형식이 올바르지 않다` 예외 | ○ |
| 기타 | 토큰 없는 글 / 같은 토큰이 `facts`에 두 번 | — | 그대로 반환 / 앞의 값이 쓰임 | — |
| 기타 | `value`가 빈 문자열 | — | 예외 없이 `x  y` (빈 자리로 채워짐) | — |
| 기타 | `value`가 `{{offerAmount}}` | — | 그대로 들어가 `x {{offerAmount}} y` (이후 실행 층이 금액으로 채울 수 있는 모양) | — |

### `formatFact`
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 날짜 | `2026-11-17` ko / en / ja / de | `11월 17일` / `November 17` / `11月17日` / `17. November` | 같음 | ○ |
| 날짜 | `2026-01-01` | — | `1월 1일` / `January 1` / `1月1日` / `1. Januar` | ○ |
| 날짜 | `2026-12-31` | — | `12월 31일` / `December 31` / `12月31日` / `31. Dezember` | ○ |
| 날짜 | `2026-02-28` | — | `2월 28일` / `February 28` / `2月28日` / `28. Februar` | ○ |
| 날짜 | `2024-02-29`(윤년), `2026-03-05`, `2026-10-09` | — | `2월 29일`…, `5. März`, `9. Oktober` (앞자리 0 없음) | ○ |
| 잘못된 날짜 | `2026-13-01`, `2026-02-30`, `2026-02-29`, `2100-02-29`, `2026-00-10`, `2026-11-00`, `2026-04-31` | 예외 | `DATE 값이 없는 날짜다` 예외 | ○ |
| 잘못된 날짜 | `11/17/2026`, 빈 값, 앞뒤 공백, 끝 줄바꿈, `2026-11-17T00:00:00Z`, `2026-11-17T23:30:00-08:00`, `2026-1-7`, 전각 숫자 | 예외 | `DATE 값은 ISO 날짜(YYYY-MM-DD)여야 한다` 예외 | ○ |
| 날짜 | `2000-02-29`, `0000-01-01` | — | `2월 29일`, `1월 1일` (0000년도 받는다) | — |
| 언어 | 모르는 언어 `fr` | — | `모르는 언어다` 예외 | — |
| 시간대 | 위 전부를 기본(KST, 오프셋 −540) / `TZ=Pacific/Kiritimati`(−840) / `TZ=America/Los_Angeles`(+480) / `TZ=UTC`로 각각 실행 | 같은 결과 | 4개 출력이 `diff`로 완전히 같음. 코드에 `Date` 사용 없음 | ○ |
| 금액 | `1`, `5`, `99`, `100`, `720`, `123456`, `0` | `$0.01`, `$0.05`, `$0.99`, `$1.00`, `$7.20`, `$1,234.56`, `$0.00` | 같음. 4개 언어 모두 `$7.20` | ○ |
| 금액 | 큰 수 `100000000`, `99999999999999999999` | — | `$1,000,000.00`, `$999,999,999,999,999,999.99` (문자열 연산이라 정밀도 손실 없음) | — |
| 금액 | 음수 `-1`, `-720`, `-0` | 결과 또는 예외 | **예외 아님**: `-$0.01`, `-$7.20`, `-$0.00` | — (의견) |
| 금액 | 소수 `7.2`·`7.20`, `1e3`, `007`, `+5`, 앞 공백, 빈 값, 전각 `９９` | 예외 | `AMOUNT 값은 센트 정수여야 한다` 예외 | ○ |
| 금액 | 문자열이 아닌 숫자 `720` (타입 무시하고 넘김) | — | `raw.startsWith is not a function` (TypeError) | — |
| 그대로 | `TRACKING`, `CUSTOMS_STATUS` | 그대로 | 그대로 | ○ |

### 실행 층과 맞물림 (`src/exec/message.ts`의 `fillMessage`를 직접 호출)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 날짜 표기 | 2024년·2026년 모든 날 × 4개 언어 × (표기만 / 문장 속) = 5,848건 | 거부 0 | 거부 0 | ○ |
| 데모 문장 | D01~D16을 `formatFact` → `fillTokens` → `fillMessage` | 금액 토큰이 없는 15개는 통과 | 15개 `ok: true`, 채운 글에 `⟦`·`⟧` 없음. `{{offerAmount}}`·`{{refundAmount}}`는 실행 층이 `$7.20`으로 채움 | ○ |
| 금액 토큰 | D14 (`⟦AMOUNT_1⟧` → `$7.20`), "환불 금액은 `$72.00`입니다." | 실행 층이 거부 (설계된 동작) | 둘 다 거부: "writes an amount directly (a currency symbol before a number)" | ○ |
| 안 채운 토큰 | `⟦AMOUNT_1⟧`·`⟦DATE_1⟧`이 남은 글 | 실행 층이 거부 | "still contains unfilled tokens" | ○ |
| 전 과정 | 초안 `⟦DATE_1⟧` + `{{offerAmount}}` → `checkTokens` → `fillTokens` → `fillMessage` | 통과 | `ok: true` → "반품 상품이 11월 17일에 도착했습니다. $7.20을 제안드립니다." | ○ |
| 값이 ISO 그대로 | `facts`의 `value`를 `2026-11-17` 그대로 넘김 | — | 구매자에게 `2026-11-17에 도착했습니다`로 나감 (실행 층은 통과) | — |
| 자리표시자 누락 | 초안에 `{{offerAmount}}`, 전송본에서 사라짐 | — | `checkTokens` **`ok: true`** (지시서대로 `{{…}}`는 세지 않는다) | — (결정 5) |
| 자리표시자 추가 | 전송본에만 `{{offerAmount}}` 또는 모르는 `{{foo}}` | — | `checkTokens` `ok: true` (`{{foo}}`는 실행 층이 거부) | — (결정 5) |
| 두 층 모두 통과 | `{{refundAmount}}` 자리에 `24 $`, `24,00 $`, `24 US-Dollar`, `7 $`, `24€`, `24,- $`, `24 US$`, `7米ドル`, `7USドル`, `7불`, `twenty-four dollars` | 어느 한 층이 거부 | **`checkTokens.ok = true`이고 `fillMessage.ok = true`** — 손으로 적은 금액이 그대로 전송 본문이 된다 | ✕ (문제 1) |
| 영어 정상 문장 | `We're available 24/7 …`, `Size 8 may run small …`, `The 3/4 sleeve version …`, `Use code FERNWOOD15 …`, `Your order of 2 may arrive …` | — | `checkTokens`는 막고(`literalFacts`), 실행 층은 통과 | — (문제 3) |
| 영어 정상 문장 | `… 60 centimeters.`, `… 0.45 kg.`, `One inch is 2.54 cm.` | — | 두 층 모두 막음 | — |

### 개인통관고유부호 (예시값 `P` + 숫자 12자리)
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 가림 | 전송본에만 / 초안에만 / 양쪽 / 조사 붙음 / 한글 바로 뒤 / 소문자 `p` / 서로 다른 부호 2개 | `literalFacts: ["P************"]`, 원문 없음 | 7가지 모두 `["P************"]` 한 개, 결과 JSON 어디에도 숫자 원문 없음 | ○ |
| 가림 | 형식 오류 괄호 안 (`⟦P…⟧`, 초안의 `⟦PCCC P…⟧`) | 원문 없음 | `extra: ["⟦P************⟧"]` / `["⟦PCCC P************⟧"]` + `literalFacts: ["P************"]` | ○ (결정 3) |
| 가림 | `facts`의 `value`가 부호이거나 부호를 품고 있고 전송본에 그대로 적힘 | 원문 없음 | `literalFacts: ["P************"]`만 | ○ |
| 가림 | 부호 + 약속 표현 / 부호 + 날짜 + 금액 | 다른 배열에 원문 없음 | `newPromises: ["반드시"]`, `literalFacts: ["P************","11월 17일","$7.20"]` | ○ |
| 예외 문구 | `fillTokens('⟦P…⟧ 메모')`, 반쪽 괄호 + 부호, 부호 + 모르는 토큰 | 원문 없음 | 예외 문구에 부호·초안 내용 없음 | ○ |
| 채우기 | 토큰 없이 부호만 있는 글을 `fillTokens`에 | — | 예외 없이 그대로 반환 (부호를 막는 것은 `checkTokens`뿐) | — |
| 모양이 다른 것 | 13자리 `P` + 숫자 13개, 영문 접두 `KR` + 부호 | — | 부호로 보지 않고 추적번호 모양으로 **원문 그대로** `literalFacts`에 넣음 | — (의견) |
| 모양이 다른 것 | 띄어 쓴 `P1234 5678 9012`, 붙임표, 전각 | — | 잡지 않음 (`ok: true`) | — (의견) |

### 결정론 · 입력 불변
| 항목 | 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|---|
| 결정론 | 토큰·형식 오류·부호·금액·날짜·약속이 섞인 입력으로 `checkTokens` 100회 | 같은 결과 | 100회 같음 | ○ |
| 결정론 | 사이에 다른 입력의 `checkTokens`·`extractTokens`·`fillTokens`(예외 포함)를 끼워 100회 | 같은 결과 (전역 정규식 상태가 남지 않음) | 100회 같음 | ○ |
| 결정론 | `fillTokens`·`extractTokens`·`formatFact` 각 100회 | 같은 결과 | 같음 | ○ |
| 입력 불변 | `Object.freeze`한 `facts`(배열·원소)로 전부 실행 | 예외 없음, 내용 같음 | 예외 없음, 전후 JSON 같음 | ○ |
| 입력 불변 | 반환된 `missing`·`extra`에 값을 밀어 넣은 뒤 다시 호출 | 영향 없음 | 영향 없음 | ○ |
| 금지 호출 | `Math.random`, `Date.now`, `new Date`, `performance`, `fetch`, `http`, `anthropic`, `process.env` | 없음 | 8행 주석의 낱말 말고는 없음 | ○ |

## 지시서 대조
| 항목 | 판정 | 근거 |
|---|---|---|
| 수정 가능 폴더 | 충족 | `git diff --name-only 2e09ca2..HEAD` = `src/ai/tokens.ts`, `tests/unit/tokens.test.ts`, `reports/T010-impl.md`. 계약·`config/`·`package.json`·`src/exec/` 변경 0줄 |
| 공개 함수 4개 | 충족 | `checkTokens: CheckTokensFn` `src/ai/tokens.ts:351`, `extractTokens` `:67`, `fillTokens` `:384`, `formatFact(kind, raw, locale)` `:135` |
| 동작 1 토큰 문법 | 충족 (반쪽 괄호는 해석 필요) | `WELL_FORMED_TOKEN` `:35`, `BRACKETED` `:38`, `scan` `:53-64`. 형식 오류 14종이 `extra`에 원문 그대로. 반쪽 괄호는 `:59-62`에서 `"⟦"`/`"⟧"` 한 글자로 보고 — 지시서에 없는 경우 |
| 동작 2 `missing` | 충족 | `shortfall` `:72-82`, `:356`. 2번:1번 → 1, 3번:1번 → 2 |
| 동작 3 `extra` | 충족 | `:357-365`. 개수 초과, `facts`에 없는 토큰(초안·전송본 양쪽에서 찾음), 형식 오류 |
| 동작 4 `literalFacts` | 충족 (목록 밖 표기는 문제 1·2) | `needlesOf` `:242-256`(값 그대로 + 4개 언어), `LITERAL_SHAPES` `:180-207`. 지시서에 적힌 금액 8종·날짜 8종·추적번호 2종 전부 잡힘, "막지 않을 것" 전부 통과. 단 한 글자짜리 `value`는 그대로 찾지 않는다 (`:245`) |
| 동작 5 `newPromises` | 충족 (묶음 구성은 해석 필요) | 이름 붙인 상수 `PROMISE_EN/KO/JA/DE` `:297-303` — 지시서 목록과 글자까지 같음. 대응표 `PROMISE_GROUPS` `:317-321`, 대소문자 무시 `:325-333`. `100%`를 `반드시`와 한 묶음에 둔 것은 구현의 선택 (문제 4) |
| 동작 6 `ok` | 충족 | `:371` |
| 동작 7 순수 코드·결정론 | 충족 | `Date` 미사용 (`formatDate` `:97-116`은 정규식과 윤년 규칙만), 시간대 4개에서 같은 출력, 100회 같은 결과, `Object.freeze` 입력으로 예외 없음 |
| 동작 8 개인통관고유부호 | 충족 | `PCCC` `:44`, `PCCC_MASK` `:47`, 전송본 `:268-270`, 초안 `:290`, 형식 오류 안 `:363`. 결과·예외 문구에 원문 없음 |
| 완료: 서연 SC4 `ok: true` + `11월 17일` | 충족 | `tests/unit/tokens.test.ts:49-57`, `:403-410`. 직접 쓴 D01로도 확인 |
| 완료: 토큰 빠짐 → `missing`, `11월 17일`로 바뀜 → `missing` + `literalFacts` | 충족 | `:59-73`. D01·D06·D08·D09로도 확인 |
| 완료: `⟦AMOUNT_1⟧` 추가 → `extra`, `facts`에 없는 토큰 → `extra`, `⟦PCCC⟧` → `extra` | 충족 | `:91-106` |
| 완료: `반드시 내일 도착합니다` → `newPromises`, `guarantee` ↔ `보장` 통과 | 충족 | `:122-134` |
| 완료: 모양 표 각 10개 이상 | 충족 | 금액 20/15, 날짜 15/15, 추적번호 12/12 (`:179-289`, 개수 검사 `:300`·`:307`) |
| 완료: `fillTokens` 예외·괄호 없음 | 충족 | `:403-448` |
| 완료: 100회 같은 결과, 입력 불변 | 충족 | `:514-540` |
| 완료: AC20 | 해당 없음 | AC20 미작성 (판정 제외) |
| 완료: `npx tsc --noEmit` 자기 파일 오류 없음 | 충족 | 출력 없음, 종료 코드 0 |
| 하지 않을 것: LLM 호출, `{{…}}` 건드리기, 점 표기 날짜, `config/` 이동 | 충족 | `fillTokens`는 `⟦…⟧`만 치환 (`:392`). `formatFact` 날짜 5,848건이 실행 층 금액 검사를 통과. 약속 목록은 파일 안 상수 |
| SPEC 3장 "토큰 개수·값이 다르면 전송 불가" | 충족 | `⟦…⟧` 토큰은 개수까지 비교. `{{…}}`는 지시서대로 세지 않음 (결정 5) |
| SPEC 10장 "화면·로그에 남기지 않는다" | 충족 | 부호 모양(`P` + 숫자 12자리)은 어느 배열·예외에도 원문이 없다 |

## 발견한 문제
1. **[병합 차단 — 판정 기준 "값이 직접 적힌 문장이 통과"] 통화 기호·낱말이 수 뒤에 오는 표기 일부가 `literalFacts`에 잡히지 않는다.**
   - 통과하는 표기 (전부 `checkTokens(...).ok === true`): `24 $`, `24$`, `7 $`, `7,20 $`, `24,00 $`, `24,- $`, `24 US$`, `24 €`, `24€`, `24,00 €`, `24 US-Dollar`, `24,00 US-Dollar`, `24米ドル`, `7USドル`, `24불`, `24 US달러`, `24 미국 달러`. (글로 쓴 수 `seven dollars`·`칠 달러`도 통과.)
   - 원인: 기호 모양은 "기호 → 수" 한 방향뿐이고(`src/ai/tokens.ts:182`), 통화 낱말은 수 바로 뒤에 붙어야 한다(`:186`, `:160`). 독일어는 금액을 `24,00 $`처럼 수 뒤에 기호를 쓰는 것이 표준이고, `US-Dollar`·`米ドル`는 낱말 앞에 다른 글자가 끼어 있다.
   - 데모 영향: "Lena 독일어 환불 안내" 문장에서 `{{refundAmount}}` 자리에 `24,00 $`를 적으면 `ok: true`. 같은 문장을 `src/exec/message.ts`의 `fillMessage`에 넣어도 `ok: true`로 **그대로 전송 본문이 된다** (실행 층에도 같은 구멍이 있다 — paypal 레인 몫이라 여기서는 사실만 적는다).
   - 잡히는 경우: 초안에 `⟦AMOUNT_n⟧` 토큰이 있었고 그 자리를 값으로 바꿨다면 `missing`으로 `ok: false`가 된다. 통과하는 것은 (가) 금액 자리가 실행 자리표시자 `{{…}}`였던 경우와 (나) 초안에 없던 금액이 전송본에 새로 생긴 경우다.
   - 지시서 4항의 "최소한" 목록은 전부 충족한다. 이 문제는 목록 밖 표기다.
2. **[병합 후 수정] 날짜 표기 일부가 잡히지 않는다.** `17일`, `17日`, `the 17th`, `17th of November`, `November the 17th`, `17. Dez`, `9. Okt`, `十一月十七日`은 `literalFacts`가 `[]`. 초안의 `⟦DATE_n⟧`을 이렇게 바꿔 쓰면 `missing`으로 막히지만, 초안에 없던 날짜가 이런 표기로 새로 생기면 `ok: true`다.
3. **[병합 후 수정] 정상 문장이 막히는 경우 (보내지 못하는 쪽 오탐).** 직접 쓴 데모 문장 16개에는 없었고 탐침에서만 나왔다.
   - 달 이름 `May`를 대소문자 무시로 찾아 조동사 `may`가 걸린다: `Size 8 may run small`, `Your order of 2 may arrive …`, `you may 1) return it`.
   - `24/7`, `3/4 sleeve`, `1/2`, `50/50`이 날짜로 걸린다.
   - 통화 낱말 뒤에 낱말 경계가 없다: `60 centimeters`(`60 cent`), `2 europäische`(`2 euro`), `사이즈 2 원하시면`(`2 원`), `3 円形`, `5 bucket`.
   - 소수 둘째 자리 수: `0.45 kg`, `2.54 cm`, `10.30 Uhr` (실행 층과 같은 기준이라 실행 층도 막는다).
   - 대문자 + 숫자 10자 이상 쿠폰 코드 `FERNWOOD15`가 추적번호로 걸린다.
4. **[병합 후 수정] `100%`가 `반드시`·`definitely`와 같은 묶음이라, 초안에 "100% wool"이 있으면 전송본에 새로 생긴 "반드시 내일 도착합니다"가 `newPromises`에 안 들어간다** (`PROMISE_GROUPS` `src/ai/tokens.ts:320`). 니트 상품 설명에 "100% wool"이 나올 수 있다. 같은 구조로 초안의 "compromise"는 `promise` 묶음을, "no guarantee"는 `guarantee` 묶음을 통과시킨다 (초안에서도 낱말 안 포함·부정 여부를 가리지 않는다).
5. **[의견] `newPromises`는 부분 문자열로 찾는다.** `compromise`→`promise`, `indefinitely`→`definitely`, `必ずしも`→`必ず`, 부정문 `보장하지는 못하지만`→`보장`이 걸리고, 반대로 `Garantie`(명사), `versprochen`, `약속합니다`, `100 %`(띄어쓰기), `１００％`(전각)는 걸리지 않는다. 지시서 목록을 글자 그대로 구현한 결과다.
6. **[의견] 보고 문자열이 값의 일부인 경우.** `1,234.56`→`234.56`, `24,00 USD`→`00 USD`, `2026년 11월 17일`→`11월 17일`, `garantiert`→`garantier`, `İİİ guarantee`→`rantee`(소문자 변환으로 길이가 달라지는 글자 뒤에서 위치가 밀림, `:331-332`). 막는 데는 문제없고 화면에 보일 문구만 어색하다.
7. **[의견] `formatFact('AMOUNT', …)`가 음수를 받는다.** `-720`→`-$7.20`, `-0`→`-$0.00`. 지시서는 "센트 정수"라고만 한다.
8. **[의견] `facts` 값 그대로 찾기의 가장자리.** 한 글자 값은 찾지 않는다(`:245`). 대소문자를 가린다(소문자로 적힌 추적번호는 통과). 센트 값과 우연히 같은 수(`24시간`, `100%`, `2026년`)와 흔한 낱말인 값(`cleared`)은 걸린다 — 구현 보고서도 센트 값 건은 적어 뒀다.
9. **[의견] 개인통관고유부호와 모양이 조금 다른 것.** 숫자 13자리나 영문 접두가 붙은 열은 부호로 보지 않고 추적번호 모양으로 원문 그대로 보고한다. 띄어 쓰거나 전각으로 쓴 부호는 잡지 않는다. `fillTokens`는 부호를 검사하지 않는다(토큰만 본다).
10. **[의견] `fillTokens`는 빈 `value`와 `{{offerAmount}}` 같은 `value`를 그대로 넣는다.** `facts`는 코드가 만드는 값이라 지금은 문제가 아니지만, `value`에 `{{…}}`가 들어오면 실행 층이 그 자리를 금액으로 채운다.

## 컨트롤 타워가 결정할 것
1. **문제 1을 병합 차단으로 볼지.** 확인한 사실: 지시서 "최소한" 목록은 전부 잡힌다. 목록 밖인 수 뒤 기호(`24,00 $`)·`US-Dollar`·`米ドル`·`불`은 `checkTokens`와 실행 층 `fillMessage`를 둘 다 통과한다. 선택지: (가) 재시도에서 T010에 표기를 더한다 (수 뒤 기호, `US-Dollar`, `米ドル`, `USドル`, `불`, 쉼표 소수) (나) 지금 병합하고 후속 작업으로 넘긴다 (다) 실행 층(`src/exec/message.ts`, paypal 레인)도 같이 고친다 — 실행 층이 마지막 관문이라 (가)만으로는 `checkTokens`를 거치지 않는 경로가 남는다.
2. **반쪽 괄호 판정.** 지금: `⟦DATE_1`처럼 짝이 없으면 `extra`에 `"⟦"` 또는 `"⟧"` 한 글자만 넣는다 (같은 종류가 여러 번이어도 한 번). 지시서 1항은 `⟦…⟧` 꼴만 말한다. 선택지: (가) 지금대로 (나) 반쪽 괄호 뒤의 글자까지(`⟦DATE_1`) 넣는다 — 이 경우 구매자 글이 딸려 들어올 수 있다 (다) 형식 오류로 보지 않는다 — 이 경우 실행 층이 남은 괄호로 거부한다.
3. **형식 오류 안의 개인통관고유부호.** 지금: `⟦P…⟧`는 `extra`에 `⟦P************⟧`로 가려서 넣는다. 지시서 1항 "원문 그대로"와 8항·SPEC 10장이 겹치는 자리다. 선택지: (가) 지금대로 가린다 (나) 원문 그대로 넣는다 (SPEC 10장과 어긋남).
4. **`facts`에 없는 토큰의 검사 범위.** 지금: 초안과 전송본 양쪽에서 찾아 `extra`에 넣는다. 초안에만 있고 `facts`에도 없으면 같은 토큰이 `missing`과 `extra`에 함께 나온다. 초안에만 있는 형식 오류(`⟦PCCC⟧`)도 `extra`에 들어가 전송을 막는다. 선택지: (가) 지금대로 (나) `extra`는 전송본만 본다 (타입 주석 "전송본에만 있는 토큰"에 가깝다. 이 경우 초안 쪽 문제는 `missing`으로만 드러난다).
5. **실행 자리표시자 `{{…}}`의 누락·추가를 누가 잡는지.** 지금: 초안에 `{{offerAmount}}`가 있고 전송본에서 사라져도, 전송본에만 생겨도 `checkTokens`는 `ok: true`다 (지시서 "토큰으로도 세지 않는다" 그대로). 자리표시자가 사라진 제안 메시지는 금액 없이 나간다. 선택지: (가) 지금대로 두고 호출부(T009·T020·T021)나 실행 층이 센다 (나) `checkTokens`가 `{{…}}` 개수도 비교하도록 지시서를 바꾼다.
6. **`FactLocale`을 계약으로 올릴지.** 지금: `FactLocale = 'ko' | 'en' | 'ja' | 'de'`와 `FACT_LOCALES`, `PROMISE_TERMS`, `PROMISE_GROUPS`가 `src/ai/tokens.ts`에서 export된다 (`:29`, `:32`, `:306`, `:317`). `src/types.ts:287`의 `SeedBuyer.language`는 대문자 `'KO' | 'EN' | 'JA' | 'DE'`라 호출부에서 변환이 필요하다. `formatFact` 시그니처는 계약에 없다. 선택지: (가) 지금대로 ai 레인 파일에 둔다 (나) `src/types.ts` 6부로 올리고 대소문자 대응 위치를 정한다.
7. **`facts`의 `value`를 무엇으로 넘길지 (호출부 규칙).** `fillTokens`는 `value`를 그대로 넣는다. ISO 날짜를 그대로 넘기면 구매자에게 `2026-11-17에 도착했습니다`로 나가고, 실행 층은 이를 막지 않는다. `checkTokens`는 ISO·센트 값과 현지 표기 값 둘 다 받는다. T009·T020·T021 지시서에 "`formatFact`로 현지 표기를 만든 뒤 `fillTokens`에 넘긴다"를 적을지 정하면 된다.

## 구현 보고서(`reports/T010-impl.md`)와 다른 곳
- 테스트 숫자(62 / 502 / 117·2 / tsc 0)와 범위, AC13 실패 원인(`.env.example` 미추적, `.gitignore` 34행 `.env*`)은 직접 확인한 것과 같다.
- "마지막 커밋 `5bbc569`"로 적혀 있으나 브랜치 끝은 보고서 커밋 `19d3c35`다 (코드는 `5bbc569`에서 끝).
- "`literalFacts`: `facts`의 `value` 그대로"라고 적었으나 한 글자짜리 값은 찾지 않는다 (코드 주석 `:244`에는 있음).
- 구현 보고서에 없는 것: 수 뒤 기호 금액(문제 1), `may`·`24/7`·`centimeters` 오탐(문제 3), `100%` 묶음(문제 4), `{{…}}` 누락이 `ok: true`인 것(결정 5).

## 재검증 (2026-11-10 00:01 KST)
- 판정: **통과**   (기준: 1차 차단 문제 해소(1차에 통과했던 표기가 모두 막힘) + 자리표시자 개수 비교 동작 + 데모 정상 문장 통과 + 회귀 없음 + 범위 밖 수정 없음. 새 변형 중 일부가 통과하더라도 자리표시자 개수 비교로 막히는 경우면 차단이 아니다)
  - 1차 차단 문제: 1차에 통과했던 표기 22개(지시된 19개 + `7米ドル`·`7불`·`twenty-four dollars`)가 전부 `literalFacts`에 원문 전체로 잡힌다. `{{refundAmount}}` 자리를 값으로 바꾼 경우는 `missing`에도 잡혀 두 가지 이유로 막힌다.
  - 자리표시자 개수 비교: 동작한다 (아래 표).
  - 데모 정상 문장: 1차의 16개(같은 스크립트를 지금 코드로 다시 실행) + 새로 쓴 18개 = 34개 전부 `ok: true`. 같은 문장에 값을 직접 적은 96건(1차 42 + 새 54)은 바꿔 쓴 경우 전부 `ok: false`.
  - 회귀: 1차 시나리오 스크립트 3개를 지금 코드로 다시 돌린 출력이 의도한 변화 말고는 1차 출력과 같다 (`diff`). 범위 밖 수정 없음.
  - **단, 1차 시나리오 밖에서 재시도로 새로 생긴 문제 2건이 있다** (아래 "발견한 문제" 1·2. 둘 다 `ok: false` 쪽, 즉 전송을 막는 쪽이다). 병합 후 수정으로 분류했으나, 이것을 "회귀"로 보고 막을지는 컨트롤 타워가 정한다 ("컨트롤 타워가 결정할 것" 1·2).
- 검증 대상: lane/ai `e9d63de` (재시도 범위 `03b9312..e9d63de`, 커밋 `8db9651`·`e9d63de`) · 기준 SPEC v2.2
- 방법: 구현 테스트 표를 쓰지 않고 직접 만든 입력으로 실행 (임시 스크립트는 worktree 밖 scratchpad `verify-T010/`의 `r1.ts`~`r6.ts`, 1차 스크립트 `s1.ts`~`s3.ts`는 지금 코드로 재실행). 재시도 전 코드와의 비교는 `git show 03b9312:src/ai/tokens.ts`를 scratchpad에 복사해 나란히 불렀다. `src/exec/message.ts`의 `fillMessage`는 읽기만 하고 그대로 import했다. LLM·네트워크 호출 없음.

### 실행한 명령과 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `git diff --name-only 03b9312..HEAD` | — | — | `reports/T010-impl.md`, `src/ai/tokens.ts`, `tests/unit/tokens.test.ts` 3개뿐 (+563 / −35) |
| `git diff 03b9312..HEAD -- package.json package-lock.json config src/types.ts tests/acceptance src/exec src/engine tasks SPEC.md` | — | — | 0줄 |
| `grep -nE "fetch\|anthropic\|http\|Math\.random\|Date\.now\|new Date\|performance\|process\.env\|require\(\|^import " src/ai/tokens.ts` | — | — | 8행 주석과 23행 `import type … from '@/types'`뿐 |
| `npx vitest run tests/unit/tokens.test.ts` | 94 | 0 | `TZ=Pacific/Kiritimati`·`America/Los_Angeles`·`UTC`에서도 각각 94 / 0 |
| `npm test` | 651 | 0 | 13개 파일 |
| `npx tsc --noEmit` | — | 0 | 출력 없음, 종료 코드 0 |
| `npx eslint src/ai/tokens.ts tests/unit/tokens.test.ts` | — | 0 | 출력 없음, 종료 코드 0 |
| `npx vitest run tests/acceptance --exclude '**/ac13*'` | 117 | 0 | 8개 파일. `ac13.sandbox.test.ts`는 `.env`를 읽는 코드가 있어 실행하지 않았다 (구현 보고서의 "119 통과, 건너뜀 9"는 그대로 재현하지 않음) |
| 1차 스크립트 `s1.ts`(문법·`missing`/`extra`·`fillTokens`·`formatFact`) 재실행 | — | — | 117줄이 1차 출력과 **한 글자도 다르지 않음**. 시간대 4개(기본 KST / Kiritimati / Los_Angeles / UTC) 출력도 시간대 표시 줄 말고는 같음 |
| 1차 스크립트 `s2.ts`(`literalFacts`·데모·실행 층) 재실행 | — | — | 247줄 중 63줄이 다름. 전부 의도한 방향 (아래 "회귀 확인") |
| 1차 스크립트 `s3.ts`(`newPromises`·개인통관고유부호·결정론) 재실행 | — | — | 102줄 중 9줄이 다름. 8줄은 의도한 방향, 1줄(`100% 환불해 드립니다`가 `["100%"]` → `[]`)은 문제 3 |
| 새 스크립트 `r1`~`r6` (`npx tsx`) | — | — | 아래 표. `r3.ts`는 시간대 4개에서 같은 출력 |
| `git diff 03b9312..HEAD -- tests/unit/tokens.test.ts`의 삭제 줄 | — | — | 1줄 (`['100% safe', '무조건 괜찮습니다']` → `['definitely delivered', '무조건 괜찮습니다']`). 나머지는 추가뿐 |
| `git status -s` (끝날 때) | — | — | ` M reports/T010-verify.md` 한 줄 |

### 차단 문제 재현 (1차 표기 + 새 변형)
운반 문장 (자리표시자를 그대로 두면 네 문장 모두 `ok: true`임을 먼저 확인했다):
- de: `Hallo Lena, ich habe Ihnen heute <표기> erstattet. Der Betrag erscheint in der Regel innerhalb von 3 bis 5 Werktagen.`
- ko: `지호 님, 오늘 <표기>를 환불해 드렸습니다. 보통 영업일 기준 3~5일 안에 표시됩니다.`
- ja: `Yuki様、本日<표기>を返金いたしました。通常3〜5営業日以内に反映されます。`
- en: `Hi Mark, I refunded <표기> to you today. It usually shows up within 3 to 5 business days.`

표기마다 세 가지로 넣었다. **모양** = 초안이 빈 문자열(모양만 본다). **바꿈** = 초안 `I refunded {{refundAmount}} to you today. …`의 자리표시자 자리를 표기로 바꾼 전송본 — 경우 (가). **덧붙임** = 전송본에 `{{refundAmount}}`는 그대로 두고 끝에 `(<표기>)`를 덧붙임 — 경우 (나), 초안에 없던 금액이 새로 생긴 경우.

총 148개 (1차 24 + 새 124). **바꿈은 148개 전부 `ok: false`** (`missing: ["{{refundAmount}}"]`). 모양으로 잡힌 것 101개, 모양으로 못 잡은 것 47개.

| 표기 | 문장 | 결과 | 비고 |
|---|---|---|---|
| `24 $`, `24$`, `7 $`, `7,20 $`, `24,00 $`, `24,- $`, `24 US$` | de | 막힘: 모양·바꿈·덧붙임 모두 `ok: false`, `literalFacts`에 원문 전체 | 1차에 통과했던 표기 |
| `24 €`, `24€`, `24,00 €` | de | 막힘 (위와 같음) | 1차에 통과 |
| `24 US-Dollar`, `24,00 US-Dollar` | de | 막힘 | 1차에 통과 |
| `24米ドル`, `7USドル`, `7米ドル` | ja | 막힘 | 1차에 통과 |
| `24불`, `7불`, `24 US달러`, `24 미국 달러` | ko | 막힘 | 1차에 통과 |
| `seven dollars`, `twenty-four dollars` | en | 막힘 | 1차에 통과 |
| `칠 달러` | ko | 막힘 | 1차에 통과 |
| `2만 4천원`, `24.5` | ko / en | 모양 `[]`. 바꿈 `ok: false`(가), **덧붙임 `ok: true`**(나) | 1차 탐침 표에는 있었고 차단 목록(문제 1)에는 없던 표기. 구현 보고서 "일부러 남긴 한계"에 `2만 4천원`이 적혀 있다 |
| `$24`, `$ 24`, `$24.00`, `$1,234.56`, `US$ 24`, `$`+줄바꿈+`24` | en | 막힘 | 새 변형. 기호 앞 |
| `24.00 $`, `24`+NBSP+`$`, `24`+얇은 공백+`$`, `24`+줄바꿈+`$`, `２４＄`, `24¢` | de / ja / en | 막힘 | 기호 뒤, 공백·전각 변형 |
| `1.234,56 $`, `1 234,56 $`, `1.234,56 €` | de | 막힘, 보고 문자열은 `234,56 $` / `234,56 €` (일부) | 독일어식 천 단위(점·공백)는 값 일부만 보고 |
| `24 $US`, `CA$24` | de / en | 막힘, 보고 문자열 `24 $` / `$24` (일부) | |
| `24 USD`, `USD24`, `USD 24,00`, `24,00USD`, `24 usd`, `seven USD` | de / en | 막힘 | 통화 코드 |
| `24 Dollar`, `24 Dollars`, `24 dollar`, `24 U.S. dollars`, `24 US dollars`, `24 US Dollar`, `24 bucks`, `24 Cent` | de / en | 막힘 | 통화 낱말 |
| `24달러`, `24 달러`, `7달러 20센트`, `２４ ドル`, `24불 정도`(→`24불`) | ko / ja | 막힘 | |
| `24`+줄바꿈+`Dollar`, `24`+빈 줄+`US-Dollar` | de | 막힘 | 줄바꿈으로 나뉜 금액 |
| `€24`, `€ 24,00`, `24,50€`, `EUR 24`, `24 EUR`, `24 Euro`, `24 Euros`, `24 EURO`, `24ユーロ`, `24 유로`, `24유로`, `24`+좁은 NBSP+`€` | de / en / ja / ko | 막힘 | 유로 |
| `£24`, `24 £`, `24 GBP`, `¥2400`, `2400¥`, `2,400円`, `２４００円`, `2400 JPY` | en / ja | 막힘 | 파운드·엔 (기호·코드·`円`) |
| `₩24,000`, `24,000₩`, `24,000원`, `24000 원`, `24,000 KRW`, `2만 원`(→`만 원`), `만 원` | ko | 막힘 | 원 |
| `二十四ドル`, `七ドル`, `七 ドル`, `二千四百円` | ja | 막힘 | 한자 수 |
| `sieben Dollar`, `zwanzig Euro`, `twenty four dollars`, `Twenty-Four Dollars`, `a hundred dollars`(→`hundred dollars`), `seven bucks` | de / en | 막힘 | 글로 쓴 수 |
| `이십사 달러`, `칠 불` | ko | 막힘 | 한글 수 + 띄어쓰기 |
| `7ドル20セント`, `24,00 (in US-Dollar)` | ja / de | 막힘, 보고 문자열 `7ドル` / `24,00` | `セント`는 낱말 목록에 없고 앞의 `7ドル`로 잡힌다 |
| `24 U$`, `24,-`(통화 표기 없이), `24,– $`(en 대시), `24,— $`(em 대시), `24.- $` | de | 모양 `[]`. 바꿈 `ok: false`(가), **덧붙임 `ok: true`**(나) | 달러 표기. `24,- $`(붙임표)는 잡히지만 독일어 조판에서 쓰는 대시 꼴은 안 잡힌다 |
| `24 amerikanische Dollar`, `vierundzwanzig Dollar`, `24 ct` | de | 모양 `[]`. (가) 막힘, (나) 통과 | 수와 낱말 사이에 형용사, 목록에 없는 수 낱말, 약어 |
| `24 dólares`, `24 dolares`, `24 dollari`, `24 Doller` | en | 모양 `[]`. (가) 막힘, (나) 통과 | 다른 언어·오타 |
| `24 달라`, `칠달러`, `이십사달러`, `스물네 달러`, `24불정도`, `24불씩` | ko | 모양 `[]`. (가) 막힘, (나) 통과 | 입말 표기, 붙여 쓴 한글 수, 고유어 수, `불` 뒤 조사 목록 밖 낱말 |
| `24弗`, `24美元`, `20セント` | ja | 모양 `[]`. (가) 막힘, (나) 통과 | |
| `24`+폭 없는 공백(U+200B)+`$`, `**24** $`, `24 **$**`, `24 (USD)` | de / en | 모양 `[]`. (가) 막힘, (나) 통과 | 수와 기호 사이에 다른 글자 |
| `24 pounds`, `24 Pfund`, `24ポンド`, `24 파운드`, `2400 yen`, `2400 Yen`, `2400엔`, `24000 won`, `24000ウォン`, `2만원` | en / de / ja / ko | 모양 `[]`. (가) 막힘, (나) 통과 | 달러·유로가 아닌 통화의 낱말 |
| `CHF 24`, `24 CHF`, `24 Fr.`, `24 Franken`, `24 CAD` | de / en | 모양 `[]`. (가) 막힘, (나) 통과 | 목록에 없는 통화 코드 |
| `24원씩`, `24원쯤`, `24원어치`, `24원가량`, `24원대` | ko | 모양 `[]`. (가) 막힘, (나) 통과 | `원` 뒤에 조사 목록 밖 글자가 붙은 경우 |

정리:
- 모양으로 못 잡은 47개는 **전부 (가)에서 자리표시자 개수 비교로 막힌다.** (나)에서는 47개 모두 `ok: true`다 — 초안에 없던 금액이 이런 표기로 새로 생기는 경우다. 이 중 달러 금액으로 읽힐 표기가 25개, 통화 표기 없는 `24.5`가 1개, 나머지 21개는 다른 통화(원·파운드·엔·프랑·캐나다 달러)다.
- 실행 층(`src/exec/message.ts`, 다른 레인이라 판정 제외, 사실만): 148개 운반 문장 중 109개가 `fillMessage`를 `ok: true`로 통과한다. `checkTokens`가 모양으로 잡은 101개 중 63개(1차에 통과했던 22개 전부 포함)도 실행 층은 통과한다. 모양으로 못 잡은 47개 중 46개는 실행 층도 통과한다 (`24 dollari`만 거부).

### 자리표시자 개수 비교
초안: `I am sorry about the color. I would like to offer {{offerAmount}} as a partial refund, and you can keep the cardigan.` (다른 초안을 쓴 줄은 적어 둠)

| 시나리오 | 기대 | 실제 | 일치 |
|---|---|---|---|
| 전송본에 그대로 1개 (한국어, 어순 바뀜) | 통과 | `ok: true` | ○ |
| 전송본에 0개 | `missing` | `missing: ["{{offerAmount}}"]`, `ok: false` | ○ |
| 전송본에 2개 / 3개 | `extra` | `extra: ["{{offerAmount}}"]` / 2개 | ○ |
| 이름이 `{{refundAmount}}`로 바뀜 | `missing` + `extra` | `missing: ["{{offerAmount}}"]`, `extra: ["{{refundAmount}}"]` | ○ |
| 이름이 번역됨 `{{제안금액}}` | `missing` + `extra` | 같음 (`extra: ["{{제안금액}}"]`) | ○ |
| 공백 변형 `{{ offerAmount }}` (전송본 쪽 / 초안 쪽 / 탭·줄바꿈) | 같은 이름으로 셈 | 셋 다 `ok: true` (실행 층의 `PLACEHOLDER`와 같은 규칙) | ○ |
| 대소문자 변형 `{{OfferAmount}}`, `{{offeramount}}` | 다른 이름 | `missing` + `extra`, `ok: false` | ○ |
| 이름 안 공백 `{{offer Amount}}` | 다른 이름 | `missing` + `extra` | ○ |
| 한 겹 `{offerAmount}`, 반쪽 `{{offerAmount}`, 전각 `｛｛offerAmount｝｝` | 자리표시자 아님 | `missing: ["{{offerAmount}}"]`, `ok: false` | ○ |
| 세 겹 `{{{offerAmount}}}` | — | `ok: true` (안쪽을 자리표시자로 셈. 실행 층을 지나면 `{$24.00}`이 된다) | — (의견) |
| 초안 2개(같은 이름) → 전송본 1개 | `missing` 1 | `missing: ["{{offerAmount}}"]` | ○ |
| 초안 `{{refundAmount}}`·`{{disputeAmount}}` → 일본어에서 순서 바뀜 | 통과 | `ok: true` | ○ |
| 초안 `⟦DATE_1⟧` + `{{refundAmount}}` → 독일어에서 순서 바뀜 | 통과 | `ok: true` | ○ |
| 초안 0개 → 전송본 1개 / `{{}}` 추가 | `extra` | `extra: ["{{offerAmount}}"]` / `["{{}}"]` | ○ |
| 모르는 이름 `{{foo}}`가 양쪽에 같은 개수 | — | `ok: true` (개수만 본다. 실행 층이 모르는 이름으로 거부) | — |
| 자리표시자는 그대로 + `(24,00 $)` 덧붙임 | `literalFacts` | `literalFacts: ["24,00 $"]`, `ok: false` | ○ |
| `${{offerAmount}}`, `{{offerAmount}} 달러`, `{{offerAmount}} USD` | — | 셋 다 `ok: true`. 실행 층을 지나면 `$$24.00`, `$24.00 달러`, `$24.00 USD` | — (의견) |
| `{{24 dollars}}` (전송본만) | 막힘 | `missing` + `extra: ["{{24 dollars}}"]` | ○ |
| **Lena 독일어 환불 안내** 정상 (`{{refundAmount}}` 그대로) | 통과 | `ok: true` | ○ |
| Lena: `{{refundAmount}}` → `24,00 $` | `ok: false`, 두 가지 이유 | `missing: ["{{refundAmount}}"]` + `literalFacts: ["24,00 $"]` | ○ |
| Lena: → `24 $`, `24 US-Dollar`, `24,00 US-Dollar`, `$24.00`, `24 Dollar`, `24,00 USD`, `24 €` | `ok: false`, 두 가지 이유 | 7개 모두 `missing` + `literalFacts`(원문 전체) | ○ |
| Lena: → `vierundzwanzig Dollar`, `den vollen Betrag` | `ok: false` | `missing: ["{{refundAmount}}"]`만 (`literalFacts: []`) — 개수 비교가 잡는다 | ○ |
| `fillTokens('Am ⟦DATE_1⟧: {{refundAmount}} / {{ offerAmount }} / {{disputeAmount}} / {{unknown}} / {{}} / {offerAmount} / ⟦TRACKING_1⟧')` | `{{…}}` 그대로 | `Am 17. November: {{refundAmount}} / {{ offerAmount }} / {{disputeAmount}} / {{unknown}} / {{}} / {offerAmount} / EE123456789KR` (공백까지 그대로) | ○ |
| 전 과정: `checkTokens` → `fillTokens` → `fillMessage` (독일어, `⟦DATE_1⟧` + `{{offerAmount}}`) | 통과 | `ok: true` → `… am 17. November … Ich möchte Ihnen $24.00 anbieten.` | ○ |

### 오탐·데모 문장
**재시도 지시 (3)의 보기** — `Size 8 may run small`, `24/7`, `3/4`, `1/2`, `50/50`, `60 centimeters`, `2 europäische`, `사이즈 2 원하시면`, `5 bucket`, `FERNWOOD15`: 10개 모두 `ok: true`, 네 배열 빈 값.

**날짜 경계**: `5 May`, `May 5`, `May 17th`, `5. Mai`, `11/17`, `11/05`, `9/15`, `2026/11/17`, `the 17th`, `17. Dez`, `9. Okt`, `17th of November`, `November the 17th`, `Nov. 17`, `十一月十七日`은 잡힌다. `Size 5 may fit better.`, `You may 5 items return.`, `May I ask for 2 photos?`, `March 2026`, `2026년`은 통과한다. 안 잡히는 날짜(사실만): `MAY 17`·`may 17`(대문자 M + 소문자 ay일 때만 달로 본다), `11/5`, `17/11`, `by the 2nd`·`on the 3rd`, `17일`, `17日`. `May 2 items be combined?`는 `May 2`로 잡힌다.

**자연스러운 문장 73개** (영어 31, 독일어 13, 한국어 19, 일본어 10. 초안 = 전송본으로 넣어 모양만 봄): 56개 통과, 17개 막힘. 재시도 전 코드(`03b9312`)와 나란히 돌린 50문장 비교에서는 **새로 막힌 것 21개**, 새로 통과한 것 5개(`2 europäische`, `60 centimeters`, `Size 8 may`, `24/7`, `FERNWOOD15`), 둘 다 통과 17개, 둘 다 막힘 7개였다.

여전히 막히거나 새로 막힌 정상 문장:
| 문장 | `literalFacts` | 재시도 전 | 실행 층 | 데모에서 쓸 법한지 (의견) |
|---|---|---|---|---|
| `색상이 불만족스러우셨다면 정말 죄송합니다.` / `배송이 불만족스러우셨다면 …` / `고객님이 불만을 느끼셨다면 사과드립니다.` / `혹시 이 불만 사항이 해결되지 않으면 …` | `["이 불"]` | 통과 (**새로 막힘**) | 통과 | **쓸 법하다.** 지호(색상 불만) 한국어 사과 문장에 나올 수 있는 표현 |
| `이번 일이 원만히 해결되기를 바랍니다.` / `문의하신 사항이 원만하게 해결되도록 돕겠습니다.` | `["일이 원"]` / `["이 원"]` | 통과 (**새로 막힘**) | 통과 | **쓸 법하다.** 분쟁 안내의 맺음말로 흔한 표현 (`문제가 원만하게`처럼 앞말이 `가`로 끝나면 통과) |
| `고객님이 불이익을 받지 않도록 하겠습니다.` | `["이 불"]` | 통과 (**새로 막힘**) | 통과 | 쓸 법하다 |
| `배송이 불과 3일 만에 끝났습니다.` | `["이 불"]` | 통과 (새로 막힘) | 통과 | 드물다 |
| `택배 기사 불만 접수는 택배사에서 처리합니다.` / `택배사 불만은 저희가 대신 전달하겠습니다.` | `["사 불"]` | 통과 (새로 막힘) | 통과 | 가끔 |
| `주문 2 불만 사항을 확인했습니다.` | `["2 불"]` | 통과 (새로 막힘) | 통과 | 드물다 |
| `사이즈 1 원만하게 교환해 드리겠습니다.` | `["1 원"]` | 막힘 | 통과 | 드물다 |
| `Die Ärmel sind 1,50 m lang.` / `Das Paket wiegt 0,45 kg.` / `Ein Zoll entspricht 2,54 cm.` | `["1,50"]` 등 | 통과 (새로 막힘) | **통과** (실행 층은 점 소수만 막는다) | Lena 독일어 치수 안내에서 나올 수 있다. `52 cm`, `52,5 cm`(소수 한 자리)는 통과 |
| `Sizes 10,12 and 14 are in stock.` / `Größen 36,38 und 40 sind vorrätig.` / `사이즈 90,95 중에서 …` | `["10,12"]` 등 | 통과 (새로 막힘) | 통과 | 드물다 (쉼표 뒤를 띄우면 통과) |
| `We are celebrating the 20th anniversary of the shop.` / `Repeat the pattern until the 15th row.` | `["the 20th"]` / `["the 15th"]` | 통과 (새로 막힘) | 통과 | 드물다. `It will arrive by the 20th`은 날짜라서 막는 것이 맞다 |
| `UK size 12/14 corresponds to our M.` | `["12/14"]` | 막힘 | 통과 | 가끔 (영국식 겹사이즈. `Größe 36/38`은 통과) |
| `It weighs about 0.45 kg.` / `One inch is 2.54 cm.` / `Wir öffnen um 10.30 Uhr.` | `["0.45"]` 등 | 막힘 | 막힘 | 지시대로 남긴 것 (두 층이 같은 기준) |
| `Your PayPal order ID is 5O190127TN364715T.` | 원문 | 막힘 | 통과 | 구현 보고서 "일부러 남긴 한계"에 있음 |
| `サイズ2ドルマンスリーブのタイプもございます。` | `["2ドル"]` | 막힘 | 통과 | 드물다 |

한국어 줄의 원인 (사실): 글로 쓴 한글 수 모양(`src/ai/tokens.ts:196`, `[일이삼사오육칠팔구십백천만]{1,4}\s+`)에 앞 경계가 없어 `색상이`·`일이`·`기사`의 끝 글자가 수로 읽히고, 뒤 낱말 `불만`·`불이익`·`불과`·`원만`의 둘째 글자(`만`·`이`·`과`)가 한글 통화 꼬리(`:174` `KO_TAIL`)의 조사 목록에 들어 있다. `불편`·`불량`·`불가`·`원하시면`·`원단`·`원인`·`원래`·`원활`은 통과한다.

**데모 문장 (정상)**: 1차의 D01~D16은 1차 스크립트 재실행으로 16개 모두 `ok: true`. 새로 쓴 18개:
| 항목 | 내용 | `checkTokens` | 채운 뒤 실행 층 |
|---|---|---|---|
| N01~N04 서연 ko | 통관 보류 안내(`⟦DATE_1⟧`·`⟦CUSTOMS_STATUS_1⟧`·`⟦TRACKING_1⟧`), 개인통관고유부호 요청, 도착 예정(`⟦DATE_2⟧`, "3일"), 추적 안내("24시간") | 4개 `ok: true` | 4개 통과 |
| N05~N07 지호 ko | 부분 환불 제안(`{{offerAmount}}`), 제안 수락 확인(`{{offerAmount}}`, "영업일 기준 2일"), 교환 안내 | 3개 `ok: true` | 3개 통과 |
| N08~N11 Yuki ja | 사이즈("1サイズ大きめ", "身幅50cm、着丈62cm、袖丈58cm"), 교환("30日以内"), 발송·통관(토큰 3개), 제안(`{{offerAmount}}`) | 4개 `ok: true` | 4개 통과 |
| N12~N14 Lena de | 환불 안내(`{{refundAmount}}`, "3 bis 5 Werktagen"), 반품 도착(`⟦DATE_1⟧` + `{{refundAmount}}`), 반품 방법("14 Tagen") | 3개 `ok: true` | 3개 통과 |
| N15~N16 en | 미수령 안내(토큰 2개 + "Size 8 may run small"), 환불 안내(`{{refundAmount}}` + "available 24/7") | 2개 `ok: true` | 2개 통과 |
| N17 지호 ko | 결제 금액 안내 (`⟦AMOUNT_1⟧` + `⟦DATE_1⟧`) | `ok: true` | 거부 (설계된 동작: `$24.00`으로 채워진 금액은 실행 층이 받지 않는다) |
| N18 Lena de | "2 europäische Größen", "60 Zentimeter", "Code FERNWOOD15" | `ok: true` | 거부 — 실행 층이 `2 europäische`를 "수 + 통화 이름"으로 본다 (`2 eur`. 다른 레인, 사실만) |

**같은 문장에 값을 직접 적은 경우**: 1차 42건(재실행) + 새 54건.
- 토큰·자리표시자를 값으로 **바꿔 쓴** 96건: 전부 `ok: false` (`missing`, 대부분 `literalFacts`도).
- 원래 문장은 두고 끝에 값을 **덧붙인** 96건: 94건 `ok: false`. `ok: true`는 2건 — D01의 `17일`, D06의 `17日` (달 없는 날짜. 1차와 같고 구현 보고서 "일부러 남긴 한계"에 있음). 1차에 덧붙임으로 통과했던 `7불`·`24,00 $`·`24 $`·`24 US-Dollar`·`24,00 US-Dollar`·`7米ドル`·`the 17th of November`는 이제 막힌다.
- 새 54건에 넣은 표기: 날짜 `11월 17일`·`11/17`·`2026-11-17`·`11월24일`·`11月17日`·`１１月１７日`·`十一月十七日`·`17. November`·`17. Nov`·`17.11.`·`November 17`·`Nov 17`·`the 17th`·`17 November`, 금액 `$24.00`·`$24`·`24달러`·`24불`·`24 미국 달러`·`24 US달러`·`이십사 달러`·`24米ドル`·`24ドル`·`24USドル`·`二十四ドル`·`＄２４`·`24,00 $`·`24 $`·`24$`·`24,- $`·`24 US$`·`24 US-Dollar`·`24,00 US-Dollar`·`24,00 €`·`24€`·`24 dollars`·`twenty-four dollars`·`seven dollars`·`24 USD`·센트 값 `2400`, 추적번호, 통관 상태 값.

### 회귀 확인
| 항목 | 방법 | 결과 |
|---|---|---|
| 토큰 문법 · `missing`/`extra` · `fillTokens` · `formatFact` | 1차 `s1.ts` 재실행 후 1차 출력과 `diff` | 117줄 전부 같음 |
| `formatFact` 시간대 | `s1.ts`를 기본(KST) / `TZ=Pacific/Kiritimati` / `TZ=America/Los_Angeles` / `TZ=UTC`로 실행 | 시간대 표시 줄 말고는 같음. 4개 언어 표기 `11월 17일` / `November 17` / `11月17日` / `17. November` 그대로 |
| `literalFacts` 막을 것 | 1차 `s2.ts`의 모양 41개 + `facts` 값 11개 | 52개 모두 여전히 잡힘. 바뀐 것은 보고 문자열 2개뿐 (`1,234.56`: `234.56` → 전체, `2026/11/17`: `11/17` → 전체) |
| `literalFacts` 막지 않을 것 | 1차 `s2.ts`의 41개 | 41개 모두 여전히 `[]` |
| 1차 탐침 68개 중 바뀐 것 | `diff` | 금액 12개·날짜 6개가 새로 잡힘, 오탐 15개(`24/7`·`1/2`·`3/4`·`50/50`·`may` 3종·`centimeter` 2종·`europäische`·`2 원하시면`·`3 원단`·`3 円形`·`5 bucket`·`FERNWOOD15`)가 통과로 바뀜, `7,20 Euro`·`24,00 USD`는 전체 보고로 바뀜. 그 밖은 같음 |
| `100%` 분리 | 초안 `It is 100% wool.` + 전송본 `울 100% 제품입니다. 반드시 내일 도착합니다.` | `newPromises: ["반드시"]` (1차에는 `[]`). `definitely`·`必ず`·`auf jeden Fall`로 바꿔도 잡힘 |
| `100%` 같은 뜻 | 초안 `Your refund is 100% guaranteed.` + 전송본 `환불은 100% 보장됩니다.` / `100%保証` / `zu 100 % garantiert` | 셋 다 `ok: true` |
| `100%` 상품 설명 | 전송본에만 `100% 울 제품입니다.` / `울 100%입니다.` / `It is 100% wool.` / `zu 100 % aus Wolle` | 넷 다 `newPromises: []` |
| `100%` 새 약속 | 초안 `It is 100% wool.` + 전송본 `… 환불은 100% 보장됩니다.` / 초안에 약속 없음 + `Your refund is 100% guaranteed.` | `["100%","보장"]` / `["100%","guarantee"]` |
| `100%` 뒤에 보장류 낱말이 없는 약속 | 전송본에만 `100% 환불해 드립니다.`, `100% 내일 도착합니다.`, `I am 100% sure it will arrive tomorrow.`, `100%届きます。`, `Es kommt zu 100 % sicher morgen an.` | 다섯 다 `newPromises: []`, `ok: true` — 1차에는 `100% 환불해 드립니다`가 `["100%"]`로 잡혔다 (문제 3) |
| 약속 낱말 경계 | `compromise`, `indefinitely`, `Kompromiss` / `guaranteed, promised, Garantiert, Versprechen` / 초안 `compromise` + 전송본 `약속드립니다` | `[]` / 4개 잡힘 / `["약속드"]` (1차에는 `[]`). `İİİ guarantee`의 보고 문자열은 `guarantee` |
| 약속: 그대로인 것 | `必ずしも`, `보장하지는 못하지만`, 초안 `no guarantee` + 전송본 `보장합니다`, `non-promise`·`self-guarantee`(붙임표 뒤) | `["必ず"]`, `["보장"]`, `[]`, `["promise","guarantee"]` |
| 개인통관고유부호 가림 | 1차 `s3.ts`의 29줄 재실행 | 1차 출력과 같음 (원문이 남는 2줄은 1차와 같은 "숫자 13자리"·"영문 접두" 경우) |
| 개인통관고유부호 + 자리표시자 (새 경로) | 전송본에만 `부호 {{P123456789012}} 접수` / 초안에만 `code {{P123456789012}}` / 전송본에만 `{{pccc P123456789012}}` | **`extra: ["{{P123456789012}}"]` / `missing: ["{{P123456789012}}"]` / `extra: ["{{pccc P123456789012}}"]` — 원문이 그대로 나온다** (`literalFacts`는 `["P************"]`). 양쪽에 같은 개수로 있으면 원문 없음 (문제 2) |
| 결정론 | 1차 `s3.ts`의 100회 검사 + 자리표시자·새 모양·부호가 섞인 입력으로 100회 (사이에 다른 입력의 `checkTokens`·`extractTokens`·`fillTokens` 예외·`formatFact`를 끼움) | 모두 같은 결과 |
| 입력 불변 | `Object.freeze`한 `facts`(배열·원소) | 예외 없음, 전후 JSON 같음. 반환 배열을 바꿔도 다음 호출에 영향 없음 |
| `formatFact` 날짜 → 실행 층 | 2024·2026·2027년 모든 날 × 4개 언어 × (표기만 / 문장 속) = 8,768건을 `fillMessage`에 | 거부 0건. 같은 8,768건은 `checkTokens`가 `facts` 없이도 전부 날짜 모양으로 잡는다. 시간대 4개에서 같은 결과 |
| 날짜를 채운 데모 문장 → 실행 층 | 1차 D01~D16, 새 N01~N18을 `formatFact` → `fillTokens` → `fillMessage` | 금액 토큰 문장(D14, N17)과 N18(`2 europäische`, 실행 층 쪽 오탐) 말고는 전부 통과. 채운 글에 `⟦`·`⟧` 없음 |
| 범위 | `git diff --name-only 03b9312..HEAD` | `src/ai/tokens.ts`, `tests/unit/tokens.test.ts`, `reports/T010-impl.md` |
| 기존 테스트 기대값 | 삭제·수정된 줄 1개: `['100% safe', '무조건 괜찮습니다']` → `['definitely delivered', '무조건 괜찮습니다']` | 정당하다 — 지시 (4)가 바로 이 동작(`100%`가 `무조건`·`반드시`를 통과시키는 것)을 뒤집는다. 같은 묶음 통과는 `definitely` ↔ `무조건`으로 계속 확인한다 |
| 처리 시간 | 보통 문장 100번 반복(15,200자) / `{{` + 공백 n자(닫는 괄호 없음) | 1ms 미만 / n=200 4ms, 400 26ms, 800 175ms (세제곱꼴로 늘어남. 재시도 전 코드는 0ms, 실행 층의 같은 정규식은 183ms). 의견 5 |

### 발견한 문제
1. **[병합 후 수정 — 재시도로 새로 생김] 한국어 정상 문장이 금액으로 잡힌다.** `…이 불만…`, `…이 불만족…`, `…이 불이익…`, `…이 불과…`, `…사 불만…`, `…이 원만…` 꼴이 `literalFacts`에 `이 불`·`사 불`·`일이 원`으로 들어가 `ok: false`가 된다 (위 표). 재시도 전 코드에서는 통과하던 문장이다. 원인은 `src/ai/tokens.ts:196`(한글 수 모양에 앞 경계 없음)과 `:174`·`:183`(`원`·`불` 뒤 조사 목록에 `만`·`이`·`과`·`도` 등이 있음). 전송을 막는 쪽 오탐이라 값이 새어 나가지는 않는다. 직접 쓴 한국어 데모 문장(1차 7개 + 새 8개)에는 걸린 것이 없었지만, `색상이 불만족스러우셨다면`·`이번 일이 원만히 해결되기를`은 지호·서연 문장에 나올 법한 표현이고, 걸리면 화면에 `이 불` 같은 이유가 뜬다.
2. **[병합 후 수정 — 재시도로 새로 생김] 실행 자리표시자 안에 든 개인통관고유부호가 가려지지 않는다.** 전송본이나 초안 한쪽에만 `{{P123456789012}}`(또는 `{{pccc P123456789012}}`)가 있으면 `extra`·`missing`에 원문 그대로 들어간다. `execPlaceholders`(`src/ai/tokens.ts:46-48`)가 만든 이름을 `:506-507`에서 가리지 않고 넣기 때문이다. 형식 오류 괄호 안의 부호는 `:498`에서 가린다. 재시도 전에는 이 입력에서 원문이 나오지 않았다. SPEC 10장·지시서 8항에 닿는 자리다. 부호가 `{{…}}` 안에 들어가야 하는 드문 입력이다.
3. **[병합 후 수정] `100%`가 보장류 낱말 앞에서만 약속이다.** `100% 환불해 드립니다`, `100% 내일 도착합니다`, `I am 100% sure it will arrive tomorrow`, `100%届きます`, `zu 100 % sicher`는 초안에 약속이 없어도 `newPromises: []`다. 1차에는 `100%`가 어디에 있든 잡혔다. 지시 (4)와 "전송본에만 `100% 울` → 약속 아님"은 충족하지만, 지시서 5항의 영어 목록에는 `100%`가 조건 없이 들어 있다 (결정 3).
4. **[병합 후 수정] 초안에 없던 금액이 목록 밖 표기로 새로 생기면 통과한다 — 경우 (나).** 위 표의 47개. 달러 표기로는 `24,– $`(대시), `24,-`(통화 표기 없이), `24 U$`, `24 amerikanische Dollar`, `vierundzwanzig Dollar`, `24 ct`, `24 달라`, `칠달러`, `이십사달러`, `스물네 달러`, `24불정도`, `24弗`, `24美元`, `20セント`, `24 (USD)`, 강조 표시가 낀 `**24** $`. 자리표시자를 바꿔 쓴 경우 (가)는 전부 막힌다. 실행 층도 46개를 통과시킨다 (다른 레인, 사실만).
5. **[의견] 그 밖에 재시도로 새로 막히는 정상 표기.** 쉼표 소수 둘째 자리(`1,50 m`, `0,45 kg`, `2,54 cm` — 실행 층은 통과시켜 두 층의 기준이 이 표기에서는 다르다), 띄지 않은 쉼표 목록(`10,12`, `36,38`), `the` + 13~31 서수(`the 20th anniversary`, `the 15th row`), `einen Euro-Versand`(`einen Euro`). 그리고 `{{` 뒤에 공백이 수백 자 이어지고 닫는 괄호가 없는 입력에서 처리 시간이 세제곱꼴로 늘어난다 (자리표시자 정규식을 실행 층과 같은 `\{\{\s*([^{}]*?)\s*\}\}`로 바꾼 결과. 공백 800자에 175ms, 2만 자는 3분 넘게 끝나지 않아 중단했다. 실행 층에는 원래 같은 정규식이 있다).
6. **[의견] 재시도로 더 이상 안 잡히는 날짜·추적번호 표기.** `11/5`·`3/4`처럼 월·일이 모두 12 이하인 슬래시 날짜(재시도 전 코드는 잡음. 구현 보고서에 적혀 있음), 전부 대문자·소문자인 `MAY 17`·`may 17`(재시도 전 코드는 잡음), 숫자가 5자 이하인 대문자·숫자 열(`TRK12345ABCD`, `ABCDE12345`. 재시도 전 코드는 잡음. `facts`에 값이 있으면 값 그대로 찾기로 잡힌다). 초안의 `⟦DATE_n⟧`을 바꿔 쓴 경우는 `missing`으로 막힌다.
7. **[의견] 자리표시자 둘레의 통화 표기는 보지 않는다.** `${{offerAmount}}`, `{{offerAmount}} 달러`, `{{offerAmount}} USD`, `{{{offerAmount}}}`는 `ok: true`이고 실행 층을 지나면 `$$24.00`, `$24.00 달러`, `$24.00 USD`, `{$24.00}`이 된다. 금액 값 자체는 맞다.
8. **[의견] 보고 문자열이 값의 일부인 경우가 남아 있다.** `1.234,56 $`→`234,56 $`, `24 $US`→`24 $`, `CA$24`→`$24`, `2만 원`→`만 원`, `a hundred dollars`→`hundred dollars`, `7ドル20セント`→`7ドル`. 막는 데는 문제없다.
9. **[사실 — 판정 제외] 실행 층(`src/exec/message.ts`)에는 같은 구멍이 남아 있다.** 1차에 두 층을 모두 통과했던 표기 22개는 지금도 `fillMessage`를 `ok: true`로 통과한다. `checkTokens`를 거치지 않고 실행 층에 바로 들어오는 초안은 막히지 않는다.

### 구현 보고서(`reports/T010-impl.md` "재시도" 절)와 다른 곳
- 테스트 숫자(94 / 651 / tsc 0 / eslint 0, 시간대 3개에서 94), 범위(파일 2개 + 보고서), 기대값을 바꾼 테스트 1개, "두 층 모두 통과하던 11가지가 이제 `missing` + `literalFacts`로 막힌다", "실행 층은 여전히 통과"는 직접 확인한 것과 같다. 인수 테스트 "119 통과, 건너뜀 9"는 `ac13`을 빼고 돌려 117 통과만 확인했다.
- "`24,-`도 금액 표기로 본다": 뒤에 통화 기호·낱말이 있을 때만이다 (`24,- $`는 잡힘, `24,-`만 있으면 `[]`, 대시를 쓴 `24,– $`도 `[]`).
- "오탐 0개": 구현 보고서가 든 목록 안에서는 맞다. 목록 밖에서 재시도로 새로 막히는 정상 문장이 있다 (문제 1, 의견 5). 구현 보고서에 없는 내용이다.
- "일부만 보고하는 것은 기존과 같은 3개뿐": 목록 밖 표기에서는 더 있다 (의견 8).
- 구현 보고서에 없는 것: 자리표시자 안 개인통관고유부호가 원문으로 나오는 것(문제 2), `100% 환불해 드립니다`·`100% sure`가 더 이상 약속으로 안 잡히는 것(문제 3), `MAY 17`·`may 17`을 놓치는 것, 쉼표 소수에서 실행 층과 기준이 달라진 것, `{{` + 긴 공백의 처리 시간.

### 컨트롤 타워가 결정할 것
1. **문제 1(한국어 `…이 불만`·`…이 원만` 오탐)을 병합 전에 고칠지.** 확인한 사실: 재시도 전에는 통과하던 한국어 정상 문장 11개가 이 원인으로 막힌다. 직접 쓴 한국어 데모 문장 15개에는 걸린 것이 없다. 전송을 막는 쪽이다. 선택지: (가) 병합하고 후속 작업으로 고친다 — 그동안 데모 문장에 `불만`·`불이익`·`원만`이 `이`·`사`·`일` 등으로 끝나는 말 뒤에 오면 전송 버튼이 꺼진다 (나) 병합 전에 고친다 (한글 수 모양에 앞 경계를 두거나, `원`·`불` 뒤 조사 목록에서 `만`·`이`·`과`를 다시 본다). 이 판정은 (가)를 전제로 "통과"로 적었다. "회귀 없음"을 정상 문장의 새 오탐까지 포함해 읽는다면 판정은 실패가 된다.
2. **문제 2(자리표시자 안 개인통관고유부호 원문)를 병합 전에 고칠지.** 확인한 사실: `{{P…}}`가 초안·전송본 한쪽에만 있을 때 `extra`·`missing`에 원문이 나온다. 재시도 전에는 나오지 않았다. 형식 오류 괄호 쪽은 가린다. 선택지: (가) 병합하고 후속 작업으로 `{{…}}` 이름도 가린다 (나) 병합 전에 고친다. 문제 1과 같은 전제로 "통과"로 적었다.
3. **`100%`만 있는 약속을 어떻게 볼지.** 지금: `100%` 뒤에 `guarantee`·`보장`·`保証`·`garantie`가 올 때만 약속이다. `100% 환불해 드립니다`·`I am 100% sure …`는 통과한다. 선택지: (가) 지금대로 (나) `100%` 뒤에 소재·상품 낱말(`wool`, `울`, `Wolle`, `cotton` 등)이 올 때만 빼고 나머지는 약속으로 본다 (다) 지시서 5항 목록에서 `100%`의 조건을 글로 정한다.
4. **쉼표 소수 둘째 자리(`1,50 m`, `0,45 kg`)의 기준.** 지금: `checkTokens`는 막고 실행 층은 통과시킨다 (점 소수는 두 층 모두 막는다). 선택지: (가) 지금대로 — 독일어 금액 `24,00`을 막으려면 필요하다 (나) 실행 층 보강 작업에서 같은 기준으로 맞춘다.
