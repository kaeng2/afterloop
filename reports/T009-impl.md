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

---

# 재시도 — 1부 화면 버그 (2026-11-10 13:20 KST)

계기: 코드 검증(`reports/T009-verify.md`)은 통과. 컨트롤 타워가 배포용 빌드로 찍은 스크린샷(`reports/screens/T009-r1/case-1440-light.png`, `case-jiho-1440-light.png`)에서 화면 버그 3건.

## 결과
- 3건 모두 고침. 단위 테스트로 고정. `npm run build` 성공. 화면은 다시 띄워 보지 않았다 (개발 서버·`npm run start` 금지) — 빌드 CSS에서 배치 규칙을 확인했다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_shared/compare-card.css` | (1) `.cc-before { grid-column: 1 }`, `.cc-arrow { grid-column: 2; grid-row: 2 }`, `.cc-after { grid-column: 3 }`. 좁은 폭(30rem 아래)에서는 세 요소 모두 `grid-column: 1` (+ 화살표 `grid-row: auto`) → DOM 순서대로 `$74 → ↓ → $37`. 머리 주석에 원인 기록 |
| `src/app/cases/view/conversation.tsx` | (2) 영어 배지 중 글 배지에 이미 있는 것은 빼고 그린다 → 시연용 문의는 'Demo data' 하나. 실제 글의 'AI suggests'는 그대로 |
| `src/app/globals.css` | (3) 안 쓰는 `.compare`, `.compare-side`, `.compare-value`, `.compare-arrow`, `.compare-hero` 및 해당 `@media` 블록 삭제 (한 줄 안내 주석만 남김). 다른 규칙은 건드리지 않음 |
| `tests/unit/app-case-view.test.ts` | 테스트 3개 추가 (아래) |

## 원인 (1)
`.cc-arrow`만 `grid-row: 2`로 줄이 정해져 있고 열은 없었다. CSS 격자 자동 배치는 위치가 정해진 항목을 먼저 놓으므로 화살표가 (2줄, 1열)을 차지하고, `.cc-before`(span 3줄)는 1열에 들어갈 수 없어 2열로, `.cc-after`는 3열로 밀렸다. 그래서 `→ $74 $37` 순서 + 1열(화살표만 있는 넓은 1fr 칸)이 카드 왼쪽 빈 공간이 됐다. 세 열을 명시하자 빈 열이 없어지고, 카드는 `fit-content`라 두 칸 + 화살표 폭으로 줄어든다.

## 빌드 결과에서 확인한 규칙 (`.next/static`)
```
.cc-before{grid-column:1}
.cc-after{grid-column:3}
.cc-arrow{…;grid-area:2/2;place-self:center}
@media: .cc-before,.cc-after{grid-column:1}  .cc-arrow{grid-area:auto/1;…;transform:rotate(90deg)}
```
빌드 CSS에 `.compare-*` 규칙 없음.

## 테스트 결과
- `npx vitest run tests/unit/app-case-view.test.ts`: 43 통과 (추가 3개)
  - 넓은 폭: `.cc-before` 1열 · `.cc-arrow` 2열 · `.cc-after` 3열이 CSS(`@media` 앞)에 있다 / 좁은 폭: 세 요소 1열
  - `globals.css`에 `.compare*` 선택자가 없다
  - 시연용 문의를 `Conversation`으로 그렸을 때 그 줄에 'Demo data'가 정확히 1번
- `npm test`: 33 파일, 1610 통과
- `npm run test:acceptance`: 155 통과, 9 건너뜀 (기존과 같음)
- `npx tsc --noEmit`: 오류 없음
- `npm run build`: 성공

## 사람 확인용
- 1440: 비교 카드가 `PayPal data only · Full refund ~~$74~~ → With carrier data · Reply [Demo data] $37` 순서, 왼쪽 빈칸 없음.
- 390: `$74` → ↓ → `$37` 세로 쌓기.
- 대화의 2026-11-02(서연)·2026-10-20(지호) 줄에 'Demo data' 하나.

## 남은 문제
- 실제 화면 재촬영은 컨트롤 타워 몫 (이 세션은 서버를 띄우지 않음).
- `.cc-single`(후 칸 없음, 지호 화면)은 `.cc-before`가 1열 그대로라 영향 없음.

## 컨트롤 타워에 요청할 결정
- 없음.

---

# 2부 — 답장 쓰기·보내기 (2026-11-10 14:05 KST)

- 기준 SPEC: 지시서 v2.7 / `SPEC.md` 첫 줄 **v2.8** (같았는지: **아니오**). v2.7 → v2.8에서 바뀐 것은 `DECISIONS.md` 176~182행: O03 추적 등록 시험·AC13 기대값, 리뷰 일정, T019·T020, 그리고 **이 2부 지시 자체**(182행 "T009 1부 병합 + 2부 지시")다. 2부 범위와 부딪치는 변경이 없고 2부 지시가 v2.8에서 나왔으므로 멈추지 않고 진행했다 — 판단이 틀렸으면 아래 "결정 요청" 1번으로 되돌려 달라.
- 브랜치 / 마지막 커밋: `lane/ui` / `762cad6` (보고서 커밋은 그 다음)
- 실호출: PayPal 0회, LLM 0회. `.env`를 찾거나 읽지 않음. 개발 서버·`npm run start` 실행 안 함.

## 결과
완료. 답장 칸(코칭 · 영어 초안 · 한국어 전송본 · 역번역 · 검사 · 정책 밖 약속 확인 · 전송 버튼 · 결과 · 답장 후 위험)을 1부 화면 옆에 붙였고, 기본은 가짜 전송이다. "2부에 함께 넣는 것" 1~3번(위험 배지 펼침, 상태 쉬운 말, 원인 한 줄 카드)도 반영했다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/[disputeId]/layout.tsx` (새) | 1부 화면(children) 옆에 답장 칸. 화면에 내지 않는 분쟁·PayPal 읽기 실패면 답장 칸 없이 children만 |
| `src/app/cases/reply-model.ts` (새, 순수) | `buildReplyView`, `canSend`, 전송 결과 꼴(`SendOutcome`)·전송 방식 타입. 브라우저 묶음에 들어간다 (서버 코드·스위치 이름 없음) |
| `src/app/cases/reply/load.ts` (새, server-only) | 답장 칸 서버 읽기: `loadCase`(1부, 요청당 1회) → `recommend` → `planMove` → `replyFacts` → 초안(AI 또는 고정) → `translateReply` → `rememberReply` |
| `src/app/cases/reply/reply-panel.tsx`·`reply.css` (새) | 답장 칸 (클라이언트). 넓은 폭(64rem~)은 오른쪽 붙박이 칸, 좁은 폭은 아래 |
| `src/app/cases/actions.ts` (새, `'use server'`) | `sendReplyAction`: 분쟁 번호·답장 번호·확인 범주만 받아 zod 검사 → `sendFromScreen`. `redirect`·`revalidatePath` 없음 |
| `src/app/_server/send.ts` (새, server-only) | `resolveSendMode`, `resolveDraftSource`, `loadFixedDraft`(지금 `null`), `createSimulatedCaller`, `guardLiveSend`, `fixedTranslation`, `rememberReply`/`recallReply`, 전송 본체 `sendReply`(주입 가능), 입구 `sendFromScreen` |
| `src/app/cases/view/risk-toggle.tsx` (새) | 머리글 "▲ High · Score 6" = 펼침 버튼(`aria-expanded`). 신호별 점수 + 답장 뒤 점수 |
| `src/app/cases/view/case-view.tsx` | 아래 "Escalation risk" 카드 삭제, 상태 쉬운 말 + 작은 회색 코드, 원인 한 줄 카드(`CauseCard`), "제안이 먼저" 안내는 답장 칸 버튼 자리로 옮김 |
| `src/app/cases/model.ts` | `header.statusKey`(`statusKeyFor`), `CauseView.shortKey` 추가 (계산 없음) |
| `src/app/cases/view/case.css` | 원인 한 줄 카드·상태·위험 버튼 스타일 (변수만) |
| `config/copy.en.json`·`copy.ko.json` | `case.` 키 98개 추가 (두 파일 같은 키): `case.reply.*`, `case.send.*`, `case.status.*`, `case.view.subtypeShort.*`(16), `case.view.causeSide`·`riskToggle`·`riskAfterReply` |
| `tests/unit/app-case-reply.test.ts` (새, 35개) | 보기용 값·버튼 조건·그리기·2부에 함께 넣는 것 1~3·정적 검사 |
| `tests/unit/app-send.test.ts` (새, 37개) | 스위치·가짜 전송·실제 전송 + 가짜 호출기·실패 네 가지·서버 재판정·정책 밖 약속·문지기 |

## 설계에서 정한 것 (지시서에 없던 자리)
1. **브라우저가 보낸 글을 믿지 않는 방법**: 화면을 그릴 때 서버가 만든 답장(초안·전송본·사실값·`outsidePolicy`·`addedInTranslation`)을 서버 메모리(`rememberReply`, 최대 64개)에 두고, 브라우저에는 해시 번호(`r-` + 32자)만 준다. 전송 때 서버가 그 글로 `checkTokens`부터 다시 한다. 서버를 다시 켜면 기억이 사라져 "reload" 안내로 거부된다 (호출 0회).
2. **확인한 약속 반영**: `translateReply`의 `sendable`은 확인 없이 부른 값이라, 확인한 뒤의 판정은 모듈 결과 칸만 엮어 다시 맞춘다 — `check.ok` · `addedInTranslation` 없음 · `outsidePolicy` ⊆ 확인 범주 (`translateReply` 안의 `sendableNow`와 같은 규칙). 낱말 찾기는 하지 않는다. 확인할 약속이 없으면 `sendable`을 그대로 쓴다. 서버도 같은 규칙.
3. **사실값**: 서버가 전송 때 `replyFacts`를 다시 만들고, 화면을 그릴 때의 값과 다르면(UTC 자정을 넘김) "follow-up date changed"로 거부한다. 값은 `formatFact(kind, value, 'ko')` 사본으로 `fillTokens`해서 `messageTemplate`이 된다.
4. **중복 방지 기억**: `executeMove`의 기억은 호출기 함수별이라 실제·가짜 호출기를 프로세스에 하나씩 둔다 (실제는 처음 만든 PayPal 클라이언트를 다시 씀).
5. **실패 종류 가르기**: `executeMove`는 문장만 돌려주므로 `nextAction`이 `src/exec/copy.ts`의 `nextCheckPayPal`이면 `paypal_error`, `nextRetry`면 `network`, 나머지는 `rejected`. 문장은 그대로 보인다.
6. **버튼 이유 순서**: 제안이 먼저 → 답장 계획 없음 → 초안 없음 → 전송본 없음 → 번역이 더한 약속 → 토큰 검사 → 확인 안 한 약속 → 전송 상태. (지호 화면은 AI가 없어도 "Send the offer first …"가 보인다.)
7. 가짜 전송은 분쟁 다시 읽기(`loadDemoDisputes`, GET)는 하고 전송 직전 `getDispute`(판매자 글 확인)는 하지 않는다. 실제 전송만 그 GET을 한 번 더 한다.

## 서버가 다시 하는 순서 (`sendReply`, 모든 거부는 호출 전)
연결 표 `showOnScreen` → (실제) `liveSendAllowed` → 서버 기억의 답장 → 번역이 더한 약속 → 확인 안 한 정책 밖 약속 → `loadDemoDisputes` → `pickBoard` → `recommend` → `offerComesFirst` → `planMove`(fight · `send_message`만) → `replyFacts` 비교 → `checkTokens` → `formatFact` + `fillTokens` → (실제) 호출기 있음 · `getDispute` · `guardLiveSend`(표 + 판매자 글 없음) → 승인(누른 시각 + `planId`, 서버가 만듦) → `executeMove`.

## 실패 화면 네 가지 (가짜 호출기로 만든 것, `app-send.test.ts` "AC18 11번")
| 경우 | 만든 방법 | 결과 자리에 뜨는 것 | 버튼 |
|---|---|---|---|
| ① 호출 전 거부 (승인 없음) | `approved: false` | `This plan has not been approved, so nothing was sent to PayPal.` / Next: `Review this plan on the dispute screen, approve it, and run it again.` (executeMove 문장 그대로) | 꺼짐, [Try again] |
| ② PayPal 4xx·5xx | 실제 호출기가 422(또 500) | `The send-message call failed (status code 422).` + `Nothing was sent.` / Next: `… reuses the same PayPal-Request-Id, so it will not send twice.` | 꺼짐, [Try again] |
| ③ 호출 예외 | 실제 호출기가 throw | `The send-message call ended with an error.` / Next: `Run the same plan again in a moment. …` | 꺼짐, [Try again] |
| ④ 이미 답장함 | `getDispute`에 `posted_by: SELLER` | `This dispute already has a seller message on PayPal (already replied), so nothing was sent.` / Next: `Check the conversation on the PayPal sandbox dispute screen.` | 꺼짐, [Try again] |
네 경우 모두 답장 후 위험 배지를 보이지 않는다. [Try again]을 누르기 전에는 `canSend`가 `case.send.blocked.failed`로 꺼져 있다.

## 완료 기준 (2부) 대조
| 기준 | 확인 |
|---|---|
| AC18 6~11번 | `app-case-reply`(6·7·12) + `app-send`(7~11). 6번은 아래 "결정 요청" 2번 참고 |
| 토큰 검사 실패 → 버튼 꺼짐 + 서버 액션 직접 불러도 호출 0회 | 7번 세 경우 × 실제·가짜 모두 호출 0회 |
| 환경 변수 없이 = 가짜 전송, 실제 호출기 0회, "Simulated" | `resolveSendMode({})`, 9번 |
| 실제 방식 + 가짜 호출기: 두 번 → 1회 / 판매자 글 → 0회 / 연습용·시연 제외·목록 밖 → 0회 / 승인 없음 → 0회 | 10번 (가)~(바) |
| 결과가 같은 화면·같은 자리, 성공에 "PayPal sandbox"와 분쟁 번호 | 버튼 바로 아래 `aria-live` 자리. 주소 안 바뀜(서버 액션이 `redirect`·`revalidatePath`를 부르지 않음 — 정적 검사) |
| 실패 화면 네 가지 + 버튼 저절로 안 켜짐 | 위 표 |
| AI 초안 없음: "AI unavailable", 1부 그대로, 버튼만 꺼짐 / 스위치 없이 고정 초안 안 나옴 / 켜면 "Demo draft", AI suggests 없음 | 단위 테스트. `loadFixedDraft()`는 지금 `null`이라 켜도 "AI unavailable"로 남는다 |
| 화면 코드·문구 파일에 답장 문장 없음 | 정적 검사 (대역 글 조각 4개를 파일에서 찾음) |
| 제안이 먼저: 지호 꼴 꺼짐 + 이유 키 / 서연 꼴 켜짐 / 서버 액션 거부(가짜, 0회) | 단위 테스트 |
| 정책 밖 약속: 꺼짐 → 확인 뒤 켜짐 / 번역이 더한 약속은 확인해도 꺼짐 | 보기용 값·서버 둘 다 |
| 2부에 함께 넣는 것 1: "Escalation risk" 카드 없음, 머리글 배지 = 펼침 버튼, 펼친 내용 = `escalationRisk(...).parts`, 답장 뒤 점수 같은 자리 | 단위 테스트 (그린 화면) |
| 2: 상태 쉬운 말은 `case.status.*`, 표에 없는 상태는 코드만 | 단위 테스트 (4개 + `OPEN`) |
| 3: 원인 한 줄 "PayPal data only: A1 Not shipped → With carrier data: A2 Customs delay", Code decides 한 번, Demo data 오른쪽, 통관 보류 상세 문구는 배송사 카드에만, 좁은 폭 세로 | 단위 테스트 (그린 화면에서 글자 순서) + CSS |
| 문구 `case.*`, 금지 문구 없음 | 단위 테스트 |
| `.next/static`에 `PAYPAL_CLIENT_SECRET`·`LLM_API_KEY`·`AFTERLOOP_REAL_SEND`·`AFTERLOOP_FIXED_DRAFT` 없음 | `npm run build` 뒤 grep: 0건 (`executeMove`·`createHash`·`api-m.sandbox`·`server-only`·대역 글도 0건) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 1764 | 0 | 2부 새 테스트 72개 포함 (이전 1692) |
| `npm run test:acceptance` | 155 (+9 건너뜀) | 0 | AC18은 아직 `.test.ts`가 아니다 (초안) |
| `npx tsc --noEmit` | 통과 | — | |
| `npm run lint` | 통과 | — | 경고 0 |
| `npm run build` | 통과 | — | `/cases/[disputeId]` ƒ, `/preview/styleguide` ○ |

## 사람 확인용: 가짜 전송으로 처음부터 끝까지 눌러 보는 순서 (스크린샷은 컨트롤 타워)
서버를 띄우는 곳에 `AFTERLOOP_REAL_SEND`를 **넣지 않는다** (가짜 전송). PayPal·LLM 키는 `.env`에 사람이 넣는다.
1. Inbox → 서연 행 → `/cases/PP-R-GMS-10197661`. 왼쪽: 머리글(상태 "Waiting for your reply" + 작은 코드), 비교 카드 `$74` → `$37`, 원인 한 줄, 대화·배송사. 오른쪽 답장 칸 머리에 "Simulated send".
2. 머리글 "▲ High · Score 6 ▾"를 누름(또는 Tab + Enter) → 신호 +3·+2·+1·+0과 "After your reply ● Watch · Score 3".
3. 답장 칸: How to reply(AI suggests) → Your reply in English(날짜는 "November 17" 꼴) → What the buyer gets (Korean)(날짜 "11월 17일" 꼴) → Back-translation 펼침 → Checks before sending(Code decides) 세 줄 ✓ + Follow-up date.
4. 초안에 정책 밖 약속이 있으면 확인 상자가 보이고, 모두 체크해야 버튼이 켜진다. "번역이 약속을 더했다"가 보이면 체크해도 꺼져 있다 (새로고침으로 다시 번역).
5. [Send in Korean] → 버튼이 바로 꺼지고, 버튼 아래 "✓ Simulated — nothing was sent to PayPal" + "Escalation risk after reply ● Watch · Score 3". 주소 그대로, 비교 카드 그대로.
6. [Reset] → 다시 [Send in Korean]이 켜진다 (가짜 전송만).
7. 지호 `/cases/PP-R-MBJ-10197650` → 버튼 꺼짐 + "Send the offer first — …".
8. 녹화 때(실제 전송): 서버 환경에 `AFTERLOOP_REAL_SEND=1` → 머리에 "Live · PayPal sandbox" → 누르면 확인 창 "This sends a real message to PayPal sandbox dispute PP-R-GMS-10197661." → 성공이면 "✓ Sent · send-message <상태>" + "PayPal sandbox · PP-R-GMS-10197661". 보낸 뒤 버튼은 꺼져 있고, 새로고침 뒤 다시 누르면 "already replied"(판매자 글 확인)로 막힌다. [Reset] 없음.

## 비워 둔 칸 / 선행 작업
| 칸 | 지금 | 무엇이 있어야 |
|---|---|---|
| 비상용 고정 초안 | `loadFixedDraft()` = `null` → 스위치를 켜도 "AI unavailable" | 사람이 초안 파일 위치·문장 결정 (지시서 "비상용 고정 초안") |
| 초안 인사말·서명 (`buyerFirstName`·`sellerName`) | 넘기지 않음 | 1부 `view/load.ts`의 `loadCaseDraft`가 `draftReply`를 부른다. 2부가 고칠 수 있는 1부 파일은 "함께 넣는 것 1~3"용뿐이라 손대지 않았다 (결정 요청 3번) |
| 역번역·초안 고치기 | 역번역은 펼쳐 보기만, 초안 고치기 없음 (P1) | — |

## 남은 문제
- 화면 하나를 그릴 때 LLM 호출: `draftReply` 1 + `translateReply` 2 (+ 1부의 어조 판정). 새로고침마다 다시 부른다. 가짜 전송 버튼을 누르면 분쟁 다시 읽기(PayPal GET)와 어조 판정 LLM 1회가 함께 돈다 (같은 보드를 만들려고 1부와 같은 읽기 함수를 쓴다).
- 서버 기억은 프로세스 메모리다. 여러 인스턴스로 띄우면 화면을 그린 인스턴스와 전송을 받은 인스턴스가 달라 "reload" 거부가 날 수 있다 (녹화는 인스턴스 1개 전제).
- 답장 칸 머리 "Live · PayPal sandbox" 글자에 위험 색 변수를 썼다 (새 색 아님). 디자인 판단이 필요하면 바꾼다.
- 실제 화면은 아직 아무도 보지 않았다 (개발 서버 금지). 스크린샷 확인 필요: 서연 1440 밝은·어두운, 390, 지호 1440. 특히 1440에서 오른쪽 답장 칸(26rem) 때문에 왼쪽 비교 카드·원인 칸이 좁아진 모습.

## 컨트롤 타워에 요청할 결정
1. **SPEC 버전 불일치 판단**: 지시서 머리 "기준 SPEC v2.7"인데 `SPEC.md`는 v2.8이다. 위 이유로 진행했다. 지시서 머리를 v2.8로 올려 주거나, 멈췄어야 했다면 알려 달라.
2. **AC18 초안 6번의 대역 글**: 영어 초안 끝 "If not, I'll refund you in full."은 v2.7(T053) 뒤로 **정책 밖 약속(refund, 수 = fight)** 이다. 그래서 그 글 그대로는 `canSend.ok`가 `false`(확인 필요)이고, 판매자가 `refund`를 확인해야 `true`다 (`app-case-reply` "AC18 대역 글…" 테스트). AC18을 `.test.ts`로 옮길 때 ① 6번에 "refund 확인 뒤 `canSend.ok === true`"를 적거나 ② 대역 글에서 환불 문장을 빼는 것 중 하나를 정해 달라. (근거: SPEC v2.7 3장 "정책 밖 약속 막기", `src/ai/reply.ts` `outsidePolicy`.) 단위 테스트는 환불 문장 없는 판(정책 안 약속 "운송사에 전달"·"확인해서 다시 연락")으로 6번을 확인했다.
3. **`loadCaseDraft`의 인사말·서명 입력**: 지시서 2부 106행은 `buyerFirstName`·`sellerName`을 넘기라고 하지만 그 호출은 1부 파일(`view/load.ts`)에 있다. 고쳐도 되는지 (값의 출처: 구매자 이름 = 시드 `buyer.name`, 판매자 이름 = 문구 키 새로 필요).
4. 스위치 변수 이름 `AFTERLOOP_REAL_SEND`·`AFTERLOOP_FIXED_DRAFT`는 지시서 제안 그대로 썼다 (사람 확인 필요 2번).
