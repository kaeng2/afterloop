# T106 보고 (2026-11-12 09:50)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-desk / 63c6c94 (구현) + 이 보고서 커밋

## 결과
완료 — 지시서 1~6번 전부 구현했다. 선택 항목이던 Mike(routine)·상품(prevent) 상세도 같은 틀로 바꿨다. 건드리지 않는다 목록(`cases/reply/**`, `cases/progress/**`, 위험 곡선·`desk-model.ts`·`draft-forecast.tsx`, `_server/send.ts`·`mode.ts`·`activity.ts`)은 수정하지 않았다 (`git diff 862a3b3 --stat`으로 확인).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/today/selection.tsx` (새) | 화면 안 고르기 상자 `TodaySelectionProvider` (itemId·sku). `select`/`setSku`는 상태만 바꾸고 `history.replaceState`로 `?item`·`?sku`를 맞춘다 (다른 값 `lang` 등은 둔다). `setSku`는 고른 항목을 바꾸지 않는다 (시안 L688). `DetailPane`(고른 것만 보임, 나머지 `hidden`), `DetailEmpty` |
| `src/app/today/screen-model.ts` (새) | 순수 함수: `filterGroups`(buildToday와 같은 거르기), `casesOf`·`openCaseCount`(done이 아닌 분쟁 항목을 센다 — 빼기 아님), `todaySearch`. 타입 말고 import 없음 |
| `src/app/today/product-filter.tsx` (새) | 칩 = `<button aria-pressed>` (시안 L111). 배지·칩 아래 글·"N open cases"를 done이 아닌 분쟁 수로 (F1-22). `ProductFilterBarView`(값 직접 받는 모양) |
| `src/app/today/today-groups.tsx` | 항목 = `<button>` (시안 L141), `onClick → select(id)`. 링크 제거. 상자가 있으면 거르개·고른 항목을 상자에서 읽는다 |
| `src/app/today/today-list.tsx` | 옛 링크 칩 줄 삭제(새 파일 다시 내보내기), 이번 주 카드 아래 "Stock left could cost …" 줄 삭제 (F1-33). `WeeklyCard`의 `storeLine` prop 삭제 (`view.storeLine` 값은 모델에 남김) |
| `src/app/(app)/page.tsx` | 거르지 않은 목록을 한 번 읽고(`loadTodayScreen(undefined)`), 목록 항목 **모두**의 상세를 `DetailPane`으로 그린다. 고른 분쟁은 지금처럼 바로, 고르지 않은 분쟁 상세는 `Suspense`로 나중에 흘려 보낸다. 처음 상태 = 주소 `?item`·`?sku` (모르는 값이면 첫 항목/All) |
| `src/app/today/work-card.tsx` (새) | 시안 L345-357 틀: `WorkHeader`(52px 타일 + 제목 24px 900 + 범주 칩 + who 14px, 목록 줄 `TodayRowView` 그대로), `WorkCard`(`.zone-work` + AI 알약 + 제목 20px + 설명 15px), `WorkDetail` |
| `src/app/today/offer-work.tsx` (새) | 지호 카드: 제목 = 엔진 제안(`case.offer.title.keep`, 이름 대명사 없음), [Send offer] → `buildReplyView`·`canSendOffer` 관문 → 서버 액션 `sendReplyAction({kind:'offer', replyId, confirmedCommitments})` (live면 확인 창). 끝나면 꺼진 "Offer sent ✓" + 전송 모드 글(Simulated) + 결과 줄. 약속 확인 칸·번역 추가 약속 경고는 답장 칸과 같은 값으로 유지. 구매자가 받을 글은 접힘 안 |
| `src/app/cases/case-detail.tsx` | 지호 분기만 추가: `messageSend.blocked`(제안이 먼저) + `make_offer` 계획 → `OfferWork` (곡선·사건 기록·예측을 만들기 전에 돌아간다). 제목·확인 창 금액은 같은 표기 `toDollarsCents(plan.amountCents)`. Routine에 `row` 전달. 서연 경로는 그대로 |
| `src/app/cases/routine-detail.tsx` | `row`가 오면 같은 틀 (상태 문장 카드, AI 알약 없음 — 코드 판정). 없으면(사례 주소) 예전 그대로 |
| `src/app/today/tracking-detail.tsx` | 머리 + zone-work 카드("Add tracking to N orders in PayPal" · 설명 · [Add all N]). 주문 표는 카드 아래 `<details>` "Orders (N)" 안 (데이터 그대로) |
| `src/app/today/tracking-register.tsx` | 끝나면(added·simulated) 꺼진 채 "Added ✓", 다시 누를 수 없음 (F1-59). 일부 실패·실패면 다시 켜짐. Simulated 결과 줄은 그대로 |
| `src/app/today/prevent-card.tsx` | 같은 틀 (AI 알약 없음 — 엔진 값, 버튼 없음 그대로) |
| `src/app/today/savings.tsx` | 금액이 없어도 완료 알림 "Dashboard updated" (F1-63, `toastText`). 칸 깜빡임·"+$N"은 금액 있을 때만 |
| `src/app/today/model.ts` | `ProductChipView.units`, `ProductFilterView.products/units` 추가 (화면이 요약을 다시 쓰는 데만) |
| `src/app/today/today.css` | 칩 줄 sticky 삭제 (F1-16), `.weekly-link` 삭제, 칩 선택 `[aria-pressed='true']`, 버튼 초기화, `.zone-work`(r24·22/22/20·gap18·`--shadow-work`·`::before` 4px `--gradient-ai-line`)·`.work-head*`·추적 접힘·제안 카드 |
| `config/copy.en.json`·`copy.ko.json` | 새 키 5개: `today.tracking.addedDone`, `today.tracking.ordersLabel`, `today.offer.send`, `today.offer.sent`, `today.weekly.toastDone` |
| `reports/design-match/inventory.md` | "구현함"인데 실제와 달랐던 3행(`onClick it.pick`, `onClick oc.run`, `onClick p.pick`)만 T106 구현으로 고침 |
| `tests/unit/app-t106.test.ts` (새) | 15개 (아래) |
| `tests/unit/app-t067·t076·t079·t091·t102·app-today.test.ts` | 옛 구조를 고정한 정적 검사만 새 구조로 (아래 이유) |

### 옛 시험을 고친 이유 (지시서가 바꾸라고 한 구조를 고정하고 있었다)
- `app-t091` "상품 칩 줄은 sticky" → F1-16이 sticky 제거를 지시. **없음**을 검사하게 바꿈
- `app-t067` 칩 CSS 선택자 `[aria-current='true']` → 칩이 `<button aria-pressed>`(F1-18)이라 `[aria-pressed='true']`. 같은 토큰 값 검사는 그대로
- `app-t067` page.tsx의 `<TrackingDetail …savings=… />` 정규식 → 머리용 `row={item.row}`가 붙음. 서버 액션·게이트 검사는 그대로
- `app-t076` `ProductFilterBar({view})` → 새 props(`filter`, `cases`), `aria-current` → `aria-pressed`
- `app-t102` done 줄 `href="/?item=…"` → 버튼 `data-item="…"` (다시 누를 수 있다는 뜻은 그대로)
- `app-today` 고른 항목 `aria-current … href` → 버튼, `weekly-link` 있음 → **없음**(F1-33)
- `app-t079` `WeeklyCard`의 `storeLine` prop 제거에 맞춤

### 새 시험 (`app-t106`) 이 보는 것
항목·칩·고르기 파일에 Link·router·fetch·href 없음 + 버튼이 상자 함수를 부름 / 항목 `<button>`·칩 `<button aria-pressed>` 정적 그리기 / 상자 안에서 처음 SKU로 거르고 고른 상세 유지(거르개로 빠진 항목의 상세도 보임), setSku가 itemId를 바꾸지 않음 / page.tsx가 모든 항목 상세를 `DetailPane`으로 그림 + Suspense / `filterGroups`·`todaySearch` / 추적·지호·Prevent zone-work 구조와 CSS 값 / 지호 버튼 = `canSendOffer` + `sendReplyAction` offer + live 확인 창, 버튼에 금액 없음, 옛 "Escalation risk · Score" 줄 없음 / "Added ✓" 꺼짐(simulated)·실패면 켜짐 / 0원 알림 / 배지·open cases 감소(done 빼고 셈, 추적 안 셈) / sticky·링크 줄 없음 / en·ko 키 같음.
테스트 환경이 `node`(DOM 없음)라 클릭 뒤 상태 변화("Offer sent ✓"로 바뀜)는 정적 검사 + `initial` 결과 그리기로 봤다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | 15 파일 |
| npm test | 2509 | 1 | `storefront.test.ts > 결정론 100회` — 전체 실행 부하 때 시간 초과. 따로 돌리면 31/31 통과 (지시서가 말한 흔들리는 시험) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | `/` First Load JS 196 kB |

## 남은 문제
- **첫 화면 속도 (측정 못 함)**: 개발 서버 금지라 수치를 재지 못했다. 고른 상세는 지금처럼 기다린 뒤 그리고, 나머지 분쟁 상세는 Suspense로 뒤에 흘려 보내므로 첫 화면은 늘지 않을 것으로 본다. 다만 **한 요청에서 고르지 않은 분쟁(지호·Mike)도 읽는다** — 지호는 `loadCase`(AI 초안) + `loadReply`(번역)를 부른다. AI 캐시가 있으면 비용이 작지만, 캐시가 없으면 첫 요청마다 LLM 호출이 늘어난다. 브라우저 확인 때 네트워크·서버 로그로 확인 부탁.
- 칩 아래 글("240 units · 2 cases")도 배지와 같이 화면 상태로 줄인다 (배지만 줄면 같은 칩 안 숫자가 달라서). 지시서보다 한 칸 넓다.
- 거르개로 목록에서 빠진 항목이 골라져 있으면 상세는 그대로 보이고 목록에는 고른 줄이 없다 (시안 L688 동작 그대로).
- Prevent·Routine 카드에는 AI 알약을 달지 않았다 (AI가 만든 글이 아니라 엔진 값·코드 판정 — 출처 표시 정직 규칙). 시안은 모든 카드에 알약이 있다.
- 지호 [Send offer] 버튼은 시안처럼 금액 없이 "Send offer" (제목에 엔진 금액 $7.20 하나만 — 3차 리뷰 $7/$7.20 불일치 해소). 확인 창도 같은 표기.
- 상세 머리는 `h2`로 했다 (시안 h1, 화면에 숨은 h1 "Today"가 이미 있고 숨은 상세가 여러 개라 h1 여러 개를 피함). 크기·굵기는 시안 값.
- 브라우저 확인(데스크톱·휴대폰 폭, Done today 오가기, 새로고침 주소)은 컨트롤 타워.

## 컨트롤 타워에 요청할 결정
- 없음
