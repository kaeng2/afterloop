# T122e 보고 (2026-11-12 21:40)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서 커밋. 구현 마지막 커밋 0ec28bd)

## 결과
완료 — 표시 데이터 5개 항목을 `seed/demo-display`(`seedDemoDisplay`)에서 읽어 연결했다. 화면은 값을 만들지 않는다. 표시 값에는 모두 Demo data 배지를 단다. 실제 추적 등록 대상(O05·O07)과 버튼·서버 액션은 바꾸지 않았다.

## 한 일 (지시서 번호)
1. **표시용 주문 번호**: 목록 줄 머리, All products 표(같은 `row.head`), 카드 머리(`WorkHeader`가 받는 `row`), 사례 머리글 제목이 #1042(서연)·#1047(마이크)이다. 실제 PayPal 분쟁 번호는 `row.ref`·`desk.ref`에 담았다. 목록 줄에서는 아래 보조 줄, 사례 머리글에서는 둘째 줄 끝에 보인다. 짝은 시드 `orderLabels[].paypalRef`가 `config/demo-links.json`의 `paypalDisputeId`와 같은 줄이다. 코드에 번호를 직접 쓰지 않았다.
   - **#1038(지호)은 아직 연결하지 않았다**: 시드 `paypalRef: null`(T119 뒤 컨트롤 타워 지시 대기)이다. 그래서 지호 줄은 실제 번호 `PP-R-MBJ-10197650`을 그대로 보이고 Demo data 배지도 달지 않는다. 시드에 `paypalRef`가 들어오면 코드 변경 없이 #1038이 된다.
2. **손님·상품 표기**: `who`(Seo-yeon Kim · KR / buyer_m · US)와 상품(Wool Sweater)은 시드 값이고 en·ko 둘 다 있다. 상품 거르개도 표시 상품(`displaySku`)을 따른다. 그래서 마이크(실제 시드 주문 O08은 비니 세트)는 스웨터 칩에 걸린다(시안 bm.sku = sweater, 스웨터 칩 2건). 가격·위험·판정·기한·범주 알약은 엔진·실제 값 그대로다.
3. **서연 사건 기록 8줄**: `seoyeonHistoryRows`와 `demoHistoryView`로 만든다. 시드 줄은 Demo data다. `source:'paypal'`(Nov 9) 줄은 실제 샌드박스 분쟁의 **마지막 구매자 글**과 그 실제 게시 날짜로 바꾸고 배지를 달지 않는다. 실제 글이 없으면 시드 문장을 쓰되 Demo data를 단다. 실제 `dispute_opened` 줄은 날짜 순서에 맞춰 더한다. "Before DisputeLess · …" 칩은 `actor:'bad'` 줄 3개에만 단다. sys 줄의 "Promise missed"는 칩이 아니다. 위험 곡선은 실제 사건(`loaded.events`)으로 그대로 그린다. 줄 수가 다르면 곡선은 자기 색 규칙(`curveView`)을 쓴다.
4. **예방 줄**:
   - 추적 줄의 머리는 "5 orders"(Demo data)이고, 아래 줄은 "Shipped 3+ days ago · 4 countries · The order count is Demo data. The button adds tracking to the 2 real sandbox orders."이다. 이 줄은 카드 머리(`WorkHeader`)에도 그대로 보인다. 카드 제목·설명·버튼·항목 이름(화면 읽기)은 실제 수 2를 쓴다. 등록 코드는 바꾸지 않았다.
   - 새 줄 "3 orders · Customs ID missing"(id `customs-id`, kind `prevent`, Demo data)을 추적 줄 다음에 넣었다. 상세 카드는 없다. 오른쪽에는 머리 + "Demo data · nothing to send from here yet." 한 줄만 보인다(`page.tsx`, 기존 `WorkDetail` 재사용, 보내는 것 0).
5. `tests/unit/app-t091.test.ts`의 타이핑 기대값을 시안 v6·config 값인 32ms·1글자로 맞췄다.

카드 파일(`work-card.tsx`·`offer-work.tsx`·`tracking-detail.tsx`·`prevent-card.tsx`)은 고치지 않았다. 데이터(`TodayRowView`)만 넘긴다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_shared/demo-display.ts` (새 파일) | 시드 읽기: `displayLabelFor`, `preventRowLabel`, `seoyeonHistoryRows` (언어 고르기·짝 찾기만, 계산 없음) |
| `src/app/today/model.ts` | `TodayRowView.ref?`·`demo?`, `withDisplayLabel`(분쟁 줄), `withPreventLabel`(추적 줄), `customsIdItem` + 예방 순서 |
| `src/app/today/today-groups.tsx` | 목록 줄의 Demo data 배지와 PP-R-… 보조 줄 |
| `src/app/(app)/page.tsx` | 상세 카드가 없는 예방 줄(통관번호)은 머리와 안내 한 줄만 |
| `src/app/cases/desk-model.ts` | `CaseDesk.ref?`·`demoTitle?`, `CaseDeskInput.display?`, `HistoryRowView.flags?`, `demoHistoryView` |
| `src/app/cases/case-detail.tsx` | `display: displayLabelFor(...)`, 서연 기록 갈래(`caseHistory`). 지호 분기는 건드리지 않았다 |
| `src/app/cases/view/case-history.tsx` | 표시 글 칩(`row.flags`) |
| `src/app/cases/view/case-view.tsx` | 머리글의 Demo data 배지와 `· PP-R-…` |
| `config/copy.en.json`·`copy.ko.json` | `today.row.customsIdMissing`, `today.row.refLabel`, `today.prevent.demoCount(One)`, `today.prevent.noAction` |
| `tests/unit/app-t122e.test.ts` (새 파일) | 10개 (표시 줄·en/ko, 기록 8줄·실제 줄 대체·칩 규칙·카드 마크업, 추적 5↔2 정직 문구, 통관번호 줄, 머리글) |
| `tests/unit/app-t061/t076/today/t099.test.ts` | 새 기대값(#1042 머리, 통관번호 줄로 항목 수 +1, 스웨터 칩 2건, prevent 찾기는 `prevent` 값이 있는 항목) |
| `tests/unit/app-t091.test.ts` | 32ms·1글자 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 | 0 | 건너뜀 9 (기존) |
| npx vitest run tests/unit | 2709 | 1 | `storefront.test.ts > 결정론 100회`가 전체 병렬 실행 중 시간 초과. 따로 실행하면 31/31 통과한다. 엔진 파일이고 이번 변경과 무관하다 |
| npx tsc --noEmit | 통과 | 0 | |
| npx eslint (바뀐 파일) | 통과 | 0 | 경고 0 |

실행하지 않은 것: `npm run build`(Next 빌드가 `.env`를 자동으로 읽기 때문에 지시대로 하지 않았다), 개발 서버, 실제 AI·PayPal 호출.

## 남은 문제
- **병합 충돌 가능성**: T122d(lane/ui-desk)도 `today/model.ts`의 `buildToday`(Lena·Yuki)와 같은 단위 테스트의 항목 수·묶음 기대값을 고친다. 병합할 때 Prevent 묶음 순서(추적 → 통관번호 → 상품)와 항목 수를 합쳐야 한다. T122c는 `case-detail.tsx` 지호 분기를 고친다. 내 변경은 `headerDesk`·`buildCaseDesk` 인자 두 곳뿐이다.
- 통관번호 줄은 kind가 `prevent`인데 `prevent` 상세 값이 없다. kind로만 Prevent 상세를 찾는 코드는 `item.prevent !== undefined`도 함께 봐야 한다(테스트는 그렇게 고쳤다).
- 서연 기록의 Nov 9 줄은 실제 분쟁의 **마지막** 샌드박스 구매자 글로 바뀐다. 날짜도 실제 게시일이라 Nov 9가 아닐 수 있다. 시드 날짜를 실제처럼 붙이지 않으려는 선택이다.
- AI 기록 요약(`historySummary`)은 지금처럼 실제 사건으로 만든 값이다. 시드 8줄 내용과 조금 다를 수 있다.
- 시각 대조(T123 도구)는 돌리지 않았다. 목록 줄에 보조 줄 1줄과 Demo data 배지가 늘어 시안과 픽셀 차이가 생긴다(Demo data 예외).

## 컨트롤 타워에 요청할 결정
- 지호 #1038 연결: 시드 `orderLabels.jiho.paypalRef`(T119 뒤)만 채우면 화면은 바로 따라온다. 코드 변경은 필요 없다.
- 목록 줄의 Demo data 배지를 줄마다 달지, 머리글에만 달지 정해 주세요. 지금은 정직 규칙을 따라 줄마다 단다.

## 병합 (2026-11-12, main → lane/ui, 커밋 e0e7cc1)
main(T122d·T122f·T122g)을 lane/ui(T122e)에 병합. 충돌 7개를 **양쪽 기능을 모두 살려** 풀었다.

| 파일 | 푼 방법 |
|---|---|
| `src/app/(app)/page.tsx` | `Pane`: T122e의 Prevent 분기(통관번호 표시 줄 = `WorkDetail` 머리 + `today.prevent.noAction`, 실제 대상 없음) 뒤에 T122f의 `demoItemFor(item.id)` → `DemoItemCard` 분기를 둔다. 그 뒤 `CaseDetail` |
| `src/app/cases/case-detail.tsx` | import 합침(`CaseEvent, Recommendation`, `currentLocale, t`, `displayLabelFor, seoyeonHistoryRows`). T122e `caseHistory`(서연 8줄)와 main의 `jihoWork`(T122c repair/offer 두 갈래) 주석·함수를 둘 다 둔다 |
| `src/app/today/model.ts` | import 합침(`currentLocale` + `displayLabelFor, preventRowLabel`). 본문은 자동 병합 그대로 |
| `tests/unit/app-today.test.ts` | 묶음 = Reply needed [서연·지호·Lena·Mike] / Prevent [추적·customs-id·가디건] / Questions [Yuki]. 항목 수 8 (추적 없음 7, 분쟁 0건 4 = lena·customs-id·가디건·yuki, 데모 항목도 없음 2) |
| `tests/unit/app-t061.test.ts` | 8줄: needsYou 4 · prevent 3 · routine 1 |
| `tests/unit/app-t076.test.ts` | 묶음은 위와 같다 + 힌트 3개. #10xx = #1029·#1042·#1047·#1051, "Customs ID missing" 있음, 데모 항목 lena·yuki 확인 유지. Mike 줄 위치 2 → 3 (Lena가 앞) |
| `tests/unit/app-t091.test.ts` | T122e의 v6 typeOut(32ms·1글자) 시험을 남기고, main 쪽 step 2 함수 확인 2줄을 덧붙였다 (v4 시안 34ms 원문 확인은 v6 기준이라 뺐다) |

충돌 밖에서 고친 것 1건: `tests/unit/app-t122d.test.ts`가 `page.tsx`에 `item.kind === 'demo') return null`을 기대했는데, T122f가 그 줄을 `demoItemFor` → `DemoItemCard`로 바꿨다 (`reports/T122f-impl.md` "병합 충돌 예상"이 그렇게 하라고 적어 둠). 기대값을 T122f 동작(`demoItemFor(item.id)` 다음 `DemoItemCard`)으로 바꿨다. 인수 테스트가 아니라 단위 테스트다.

판단 근거: 통관번호 예방 줄은 DECISIONS v2.16 20:35 ③("3 orders · Customs ID missing")과 T122e 지시서 4번에 있다. main 쪽 T122d 시험의 "Customs ID 없음"은 T122e 전에 쓴 것이라 T122e 쪽을 따랐다. 통관부호 *문의* 항목이 없다는 시험(`/customs code/`)은 그대로 둔다.

### 검사
| 검사 | 결과 |
|---|---|
| npx tsc --noEmit | 0 오류 |
| npm run lint | 0 오류, 경고 5 (이 병합과 상관없는 `app-t098a-scenes`, `repair` 시험 파일. 원래 있던 경고) |
| npx vitest run tests/unit | 2749 통과 / 1 실패 = storefront "결정론 100회" (전체 실행 때 시간 흔들림. 따로 돌리면 31/31 통과) |
| npm run test:acceptance | 16 파일, 182 통과 · 9 건너뜀 · 0 실패 |

실제 AI·PayPal 호출, 개발 서버, `.env` 읽기는 하지 않았다.
