# T009 보고 — 1부 보기 (2026-11-10 13:10 KST)

- 기준 SPEC: v2.7 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 7158b9f (코드). 이 보고서는 그다음 커밋
- 범위: **1부(보기)만**. 2부(답장·전송)는 만들지 않았다. 지시서 "지금 상태" 절 기준 (선행 작업 모두 main에 있음)

## 결과
완료 — `/cases/[disputeId]`에 머리글·대화(원문↔영어)·배송사 정보·**전 → 후 비교(주인공)**·원인·작은 위험 배지를 그렸다. 숫자는 모두 `buildCaseView`가 엔진(`recommend`·`escalationRisk`·`offerComesFirst`)을 그대로 불러 옮긴 값이다. "비교 카드 다듬기" 1~5번을 공용 부품과 견본 화면에 반영했다. 실제 PayPal·LLM 호출 0회, 개발 서버 실행 없음 (`npm run build`로 확인).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/model.ts` (새) | 순수 함수. `buildCaseView(input, params?, rules?)`, `caseMessages(...)`(대화 글 모으기), `segmentsOf`(카드사 언급 조각), `actionKeyFor(move)` |
| `src/app/cases/[disputeId]/page.tsx` (새) | 서버 컴포넌트. 표 밖·연습용·시연 제외 번호는 `notFound()` (PayPal 안 읽음). PayPal을 못 읽으면 `common.paypalUnavailable` + 사유 |
| `src/app/cases/view/load.ts` (새, `server-only`) | `isOnScreen`, `loadCase`, `loadCaseDraft`(T042 `draftReply`를 `react` `cache`로 감쌈 — **2부도 이 함수를 부르면 LLM 호출이 요청당 1회**) |
| `src/app/cases/view/case-view.tsx` (새) | 화면 배치. 머리글 / 비교 카드 + 원인 / 대화 · 배송사 · 위험(신호별 점수는 `<details>`로 펼쳐야 보임) |
| `src/app/cases/view/conversation.tsx` (새, client) | 원문 ↔ 영어 토글. 서버 코드 import 없음 |
| `src/app/cases/view/segments.tsx`, `case.css` (새) | 카드사 언급 `<mark>`, 화면 스타일 (globals.css 변수만) |
| `src/app/_shared/compare-card.tsx` (고침) | 다듬기 1~5번: 칸 이름 + 행동, 왼쪽 `<del>` + 읽기용 "Previous value", 오른쪽 `.hero-number`, 화살표 가운데, 칸별 배지(`CompareSide.badge`), `after: null`이면 왼쪽만 |
| `src/app/_shared/compare-card.css` (새) | 비교 카드 배치 (subgrid로 두 숫자 한 줄·화살표 숫자 줄 가운데, `width: fit-content`, 30rem 아래는 왼쪽 → 화살표(90° 회전) → 오른쪽으로 쌓임) |
| `src/app/preview/styleguide/page.tsx` (고침) | 새 카드 API. 머리 배지 `Assumption`만, `Demo data`는 오른쪽 칸. 행동 글자는 `actionKeyFor(sample.*.move)` |
| `config/copy.en.json`, `copy.ko.json` | `case.view.*`·`case.badge.fromPaypal` 키 추가 (두 파일 키 같음). 숫자 없음 |
| `tests/unit/app-case-view.test.ts` (새) | 40개. AC18 초안 1~5·12번, 제안이 먼저 3개, 비교 카드 부품, 화면 글자, 404, 정적 검사 |

### 지시서 항목 → 구현
| # | 항목 | 어디서 |
|---|---|---|
| 1 | 머리글 | `loaded.buyer.name`·`product.itemName`, `toDollarsCents(boardReal.amountCents)`, 언어(`case.view.lang.*`), 분쟁 번호, `statusCode` |
| 2 | 대화 | 실제 글 = `loaded.buyerMessages` + "From PayPal". 영어 = `draftReply().buyerMessageEn` ('AI suggests'), 없으면 같은 글의 시드 문의 `english`('Demo data'), 그것도 없으면 "English translation unavailable". 시연용 글 = 같은 구매자의 시드 문의(실제 글과 같은 글 제외) + 'Demo data', 날짜 순으로 앞에. 카드사 언급은 `signals.mentionsCardCompany === true`일 때만 엔진의 `CARD_COMPANY_TERMS`로 표시 |
| 3 | 배송사 정보 | `loaded.carrierEvents` + 'Demo data'. `boardDemo === null`이면 그리지 않음 |
| 4 | 전 → 후 | `recommend(boardReal).best` / `recommend(boardDemo).best`. "PayPal data only · Full refund" `~~$74~~` → "With carrier data · Reply" `$37` (고정 사본 기준) |
| 5 | 원인 | `cause.subtype`(+ `case.view.subtype.*`)·`causeNote`. `source: 'rule'` → 'Code decides', `llm` → 'AI suggests'. 후 원인 줄에 'Demo data' |
| 6 | 위험 배지 | `escalationRisk(signals)` → `RiskLevel` + "Score n". 무응답 줄 'Demo data'(시드 문의가 신호에 들어갔을 때). 카드사 언급 줄은 표시된 낱말이 시연용 글에만 있을 때 'Demo data' |
| — | 제안이 먼저 | `offerComesFirst(후 보드 ?? 전 보드, 그 보드로 방금 만든 추천)` → `view.messageSend { blocked, reasonKey: 'case.view.offerFirst' }`. 1부는 이유 문구만 보인다 (버튼은 2부) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 155 (9 skipped) | 0 | AC18은 아직 `.test.ts`가 없어 초안 항목을 단위 테스트로 확인 |
| npm test | 1607 | 0 | 새 파일 `app-case-view.test.ts` 40개 포함, `app-shared-design.test.ts` 그대로 통과 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | — | `ƒ /cases/[disputeId]`, `○ /preview/styleguide` 있음 |
| `.next/static/`에서 `PAYPAL_CLIENT_SECRET`·`LLM_API_KEY`·`AFTERLOOP_REAL_SEND`·`AFTERLOOP_FIXED_DRAFT` | 없음 | — | 시험용 개인통관고유부호·구매자 글도 없음 |

### 완료 기준 (1부) 대조
| 기준 | 결과 | 근거 (단위 테스트) |
|---|---|---|
| AC18 초안 1~5·12번 | 확인 | `AC18 1번`~`AC18 12번` describe |
| 전·후 금액·수 = 같은 보드의 `recommend`, 7400·3680 / `$74`·`$37`, 가정값 바꾸면 따라 바뀜 | 확인 | 1번·2번 |
| 비교가 가장 큰 요소, "Expected loss" + Assumption | 확인 | `.hero-number`가 화면에 1개뿐 (비교 카드 오른쪽 숫자) |
| 위험 점수·구간·신호별 점수 = `escalationRisk`, 신호 없으면 빈칸 | 확인 | 4번·5번(가) |
| Demo data(배송사·11/02 문의·무응답·후 칸), From PayPal, Code decides | 확인 | 12번 |
| `boardDemo` 없을 때 전 칸만, 안 깨짐 | 확인 | 5번(나) (보기 값 + 화면 그리기) |
| 개인통관고유부호 가림, 로그·보고서에 구매자 글 원문 없음 | 확인 | 12번 (원문·영어 모두 `maskPersonal`). 이 보고서에 구매자 글 없음 |
| 연습용·시연 제외 번호 → 찾을 수 없음 | 확인 | `PP-R-HEY-…`·`PP-R-GAH-…`·표 밖 → `not_found`, PayPal 읽기 0회 |
| 행동 글자 키 ← `best.move` (refund → Full refund, fight → Reply, offer → Offer) | 확인 | 1번, 제안이 먼저 (지호 꼴 후 = "Offer") |
| Demo data는 오른쪽 칸에만, 머리에는 Assumption만 | 확인 | 1번 + 비교 카드 부품 |
| 화면 코드에 `74`·`37`·`7400`·`3680` 없음 | 확인 | T047 검사 + `src/app/cases/**`(`.ts` 포함, `7200`까지) |
| 문구 `case.*`에서, 금지 문구 없음 | 확인 | 12번 |

## 사람 확인용: 1부 화면 보는 순서 (스크린샷은 컨트롤 타워)
1. `/preview/styleguide` — 맨 위 비교 카드: "PayPal data only · Full refund" 흐린 취소선 `$74` → (가운데 화살표) → "With carrier data · Reply" `◌ Demo data` 큰 `$37`. 카드 머리에는 `≈ Assumption`만. 카드 폭이 내용에 맞고 오른쪽 빈칸이 없는지.
2. Inbox에서 서연 행 → `/cases/PP-R-GMS-10197661` (`.env`가 있는 곳에서). 머리글(이름·상품·`$72.00`·Korean·분쟁 번호·PayPal 상태·작은 위험 배지 High · Score n).
3. 주인공 비교 카드 → 오른쪽에 원인 두 줄 (A1 → A2 + 통관 보류 한 줄, 둘 다 `= Code decides`, 후 줄에 Demo data).
4. 대화: 11/02 문의(Demo data) → 실제 글(From PayPal). [Show original]/[Show English] 토글. 카드사 언급에 밑줄.
5. 배송사 추적(Demo data) · 확대 위험 카드 → "Signal points" 펼치면 +3·+2·+1·+0, 무응답 줄 Demo data.
6. `/cases/PP-R-HEY-10197767`, `/cases/PP-R-GAH-10197649` → 404.
7. 1440 밝은·어두운, 390 밝은 (390에서는 비교 카드가 왼쪽 → ↓ → 오른쪽으로 쌓인다).

## 비워 둔 칸 / 선행 작업
| 칸 | 비는 때 | 관련 |
|---|---|---|
| 실제 글의 영어 | LLM 키가 없거나 `draftReply` 실패 → 시드 문의에 같은 글이 있을 때만 그 영어, 아니면 "English translation unavailable" + 화면 위 "AI unavailable — showing rules only" | T042 (main에 있음. 이 worktree에는 `.env`가 없어 실제로는 확인 못 함) |
| 위험 배지 | `signals === null` → "Risk signals unavailable" | T044 |
| 후 칸·배송사 줄 | `boardDemo === null` → 전 칸만 + "No carrier data linked…" | T045 |
| 원인 풀어 쓴 문장 (P1) | 넣지 않음. `causeNote` 한 줄만 | — |

## 남은 문제
- **실제 데이터로 화면을 띄워 보지 못했다.** 개발 서버 금지 + `.env` 없음. 빌드·단위 테스트(가짜 입력 렌더링)로만 확인했다. 실제 D2의 `statusCode`·구매자 글 모양은 스크린샷에서 확인 필요.
- `globals.css`는 고치지 않았다 (T047 파일). 비교 카드 스타일은 새 파일 `src/app/_shared/compare-card.css`에 두고 부품이 import한다. `globals.css`의 옛 `.compare*` 규칙은 이제 아무도 쓰지 않는다 — 지울지는 컨트롤 타워 판단.
- 지시서 수정 가능 목록에 정확히 없는 새 파일 두 개: `src/app/_shared/compare-card.css`(다듬기 2·3번에 CSS가 필요해서 부품 옆에 둠), `src/app/cases/view/load.ts`(서버 읽기. `view/` 폴더 안). 문제가 되면 알려 달라.
- 단위 테스트에서 화면을 그리려고 테스트 파일 안에서만 `globalThis.React`를 둔다 (vitest가 tsconfig `jsx: preserve` 때문에 고전 JSX로 옮긴다. `vitest.config.ts`는 고치지 않았다).
- `draftReply`의 `buyerMessageEn`은 실제 글 전체를 한 번에 옮긴 글이다. 실제 글이 둘 이상이면 마지막 실제 글 칸에 붙인다.
- 카드사 언급 표시는 엔진 신호가 참일 때 엔진의 낱말 목록(`CARD_COMPANY_TERMS`)으로 글 조각을 가른다 (화면에 따로 낱말 목록을 두지 않았다).
- 2부용: `view.compare.after.evaluation`(planMove 입력), `view.riskAfterReply`, `view.messageSend`, `view.header.buyerLocale`, `loadCaseDraft(disputeId)`를 그대로 쓰면 된다. `loadCaseDraft`의 `facts`는 `replyFacts({ now, disputeDueDate })`, `buyerFirstName`·`sellerName`은 비워 두었다 (2부가 정한다).

## 컨트롤 타워에 요청할 결정
- 없음 (계약·인수 테스트·SPEC 변경 필요 없음). 위 "남은 문제"의 새 파일 두 개 위치만 승인 바람.
