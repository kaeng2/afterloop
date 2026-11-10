# T060 보고 (2026-11-10 15:18)

- 기준 SPEC: v2.10   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서 커밋. 코드 변경 없음)

## 결과
막힘 — 지시서 3절 "Prevent 항목: 처방을 다 켰을 때 줄어드는 금액이 가장 큰 상품 … 지금 가디건이 나와야 한다 — 나오지 않으면 손으로 고르지 말고 멈추고 보고"에 걸렸다. 지금 엔진·시드로는 **Beanie + Scarf Set (FK-BN-SET)** 이 나온다. 지시서대로 화면 코드를 쓰기 전에 멈췄다.

## 근거 (엔진 실행값, `simulateStore(seedProducts, fixes)`, 가정값 `config/params.json` 그대로)

| 상품 | 처방 없음 (`before.meanLossCents`) | 처방 4개 (`after.meanLossCents`) | 줄어드는 금액 | 줄어드는 비율 |
|---|---|---|---|---|
| FK-BN-SET Beanie + Scarf Set | 25460 | 7078 | **18382** | 72.2% |
| FK-CD-OAT Knit Cardigan, Oat | 21619 | 4366 | 17253 | **79.8%** |
| FK-SW-NV Wool Sweater, Navy | 10988 | 2562 | 8426 | 76.7% |
| FK-CT-GR Cashmere Coat, Grey | 13651 | 11310 | 2341 | 17.1% |
| 합계 | 71718 ($717) | 25316 ($253) | | |

- 맨 위 한 줄 숫자 ($717 · $253)는 지시서 기대값과 같다.
- 가디건은 "줄어드는 금액"으로도, "처방 없음 손실"로도 1등이 아니다 (둘 다 Beanie set). 가디건이 1등인 기준은 "줄어드는 비율"뿐이다.
- 확인 방법: 임시 단위 테스트 파일로 엔진을 한 번 불러 값만 읽고 지웠다 (저장소에 남긴 것 없음).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `reports/T060-impl.md` | 이 보고서 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | - | - | 코드 변경이 없어 돌리지 않았다 |
| npm test | - | - | 같음 |
| npx tsc --noEmit | - | - | 같음 |

## 남은 문제 (재시도 때 참고 — 읽기 중 확인한 것)
- 추적 항목 기대값 2: manifest의 미등록 주문 O02·O04·O05·O07·O13 중 분쟁 걸린 O02(D1)·O04(P1)·O13(D2)을 빼면 O05·O07 → 2. 지시서와 맞다.
- 이름 규칙 안: 시드 이름에 한글 부분이 있으면 로마자 첫 낱말 ("김서연 Seo-yeon Kim" → "Seo-yeon"), 아니면 이름 전체 ("Mike Morgan"). 지금 브랜치 시드는 `buyer_m***`라 그대로 나온다 (T059 병합 후 Mike Morgan).
- "3rd claim"은 보드의 `buyerPriorInrDisputes + 1`의 서수다 (엔진 `decideAutopilot` 로그 문구와 같은 규칙).
- 기존 단위 테스트가 막는 것: `tests/unit/app-shared-design.test.ts`가 `globals.css`의 `box-shadow`와 360px 넘는 고정 폭을 금지한다 → 고른 카드의 옅은 그림자·서랍 400px는 화면별 css 파일에 두거나 테스트를 손봐야 한다. `tests/unit/app-shared.test.ts`가 메뉴 4칸(`/`, `/products`, `/orders`, `/inbox`)을 기대한다 → 두 탭으로 바꿀 때 같이 고친다 (tests/unit은 수정 가능 범위).

## 컨트롤 타워에 요청할 결정
- **Prevent 항목 고르는 기준** 중 하나를 정해 달라:
  1. 기준을 "처방을 다 켰을 때 **줄어드는 비율**이 가장 큰 상품"으로 바꾼다 → 가디건 (79.8%). 엔진 결과만으로 정해진다.
  2. 기준은 그대로 두고 Beanie + Scarf Set을 Prevent에 낸다 (아래 줄 "150 left · …"). PRD v3·시안 대본과 달라진다.
  3. 가정값·시드(데이터 레인)를 바꿔 가디건이 감소액 1등이 되게 한다 — 이 레인에서는 할 수 없다.
- 결정이 나면 나머지(위쪽 막대·라우트·목록·상세 틀·서랍)는 그대로 지시서대로 구현한다.

---

## 재시도 (2026-11-10 15:33)

- 기준 SPEC: v2.10   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 코드 커밋: lane/ui / a25e6f5 (이 보고서는 그 뒤 커밋)
- 따른 것: 지시서 "재시도" 절 1~4번 (Prevent = 줄어드는 비율 1등, 이름 규칙, 기존 테스트 처리, Autopilot 비활성)

### 결과
완료 — 위쪽 막대 · `/` Today(목록 + 오른쪽 상세 틀) · `/products` 최소판 · `/cases/<id>` → `/?item=<id>` · PayPal activity 서랍 껍데기. 실제 AI·PayPal 호출 0회 (가짜 호출기만), 개발 서버는 띄우지 않았다. 스크린샷은 찍지 않았다 (컨트롤 타워 몫).

### 만든 것 (지시서 절 번호)
1. **위쪽 막대** (`_shared/top-bar.tsx`, `shell.css`): 로고 · 알약 탭 묶음 `Today (N)` / `Products` (고른 탭 흰 바탕) · Autopilot 토글(꺼짐 + `disabled` + 툴팁 `shell.autopilotHint`, `_shared/autopilot-toggle.tsx` 한 파일 — 숨길 때 `top-bar.tsx`에서 한 줄 빼면 된다) · PayPal activity 버튼(건수 동그라미 = 기록 배열 길이 0) · 판매자 칩(`loadReplyNames().sellerSignature`를 `sellerChip`이 갈라 "H" + "Fernwood Knits"). N = `buildToday(...).count` (layout과 page가 같은 요청 안에서 `cache`로 한 번만 읽는다).
2. **라우트**: `/?item=<분쟁 번호>`·`/?item=tracking`, 없거나 모르는 값이면 목록 첫 항목(서연). `/cases/[disputeId]/page.tsx`는 `redirect('/?item=…')`만 (PayPal을 읽지 않는다). 옛 `layout.tsx`의 답장 칸 일은 `cases/case-detail.tsx`로 옮기고 layout은 빈 통과로 남겼다. `/preview/styleguide` 그대로.
3. **왼쪽 목록** (`today/model.ts` 계산 없는 옮기기 + `today/today-list.tsx`):
   - 날짜 줄: `Intl`로 `today.sellerTimeZone`의 오늘 → `today.peakDate`까지 달력 날 수 (11/10 → 17). 1일이면 단수 문구, 지나면 날짜만.
   - 가게 한 줄: `simulateStore(seedProducts, [...FIX_ORDER])` 합계 → `toDollarsRounded` = "$717 · $253" (테스트는 엔진 값과 같은지로 본다). 누르면 `/products`.
   - 분쟁 항목: `loadDemoDisputesForRequest()` 결과(연결 표로 이미 걸러짐) → `pickBoard` → `recommend` → `decideAutopilot`. `skipped/suspected_abuse` → Routine, 그 밖 → Needs you. 위험 배지 = `escalationRisk(signals).band`.
   - 순서(Needs you): 위험 단계 높은 순 → 같은 단계면 추적 항목 먼저 → 엔진 점수 높은 순 → 응답 기한 이른 순.
   - 유형 짧은 이름 `today.kind.A2/B1/F1` ("3rd claim" = 보드 `buyerPriorInrDisputes + 1`의 서수), 없는 유형은 사례 화면의 `case.view.subtypeShort.*`.
   - 아래 줄: 건너뜀 → `today.sub.skipped.<rule>`, 카드사 신호(`mentionsCardCompany`) → "Korean · mentions the card company"(언어는 `case.view.lang.*`, 대명사 없음), 그 밖 → `today.sub.<rule>` + 추천 수 ("offer waiting for your approval").
   - 추적 항목: `today/tracking.ts`의 `summarizeTracking` → `listUntracked`(GET만). 분쟁 걸린 주문은 조회하지 않고 빠진다 → O05·O07 = 2. 분쟁 안 걸린 주문을 하나라도 읽지 못하면(응답 실패·예외·목록 모양 오류) `null` → 항목 숨김. PayPal 설정이 없어도 숨김. 0건이어도 숨김.
   - Prevent: `pickPrevent` — 처방 전 손실 0은 빼고 `(before − after) / before`가 가장 큰 상품 (정수 곱셈으로 비교, 같으면 처방 전 손실 큰 쪽). 지금 가디건, 아래 줄 "120 left · fixes cut likely loss by about 80%". 누르면 `/products?sku=FK-CD-OAT`.
   - 이름 규칙 `buyerShortName`: 한글 낱말이 있으면 한글이 아닌 첫 낱말, 없으면 전체 ("Seo-yeon", "Ji-ho", "Mike Morgan").
   - Lena·Yuki 문의·통관부호 항목은 만들지 않는다 (데이터 출처에 그런 항목이 없다 — 빈 자리 없음).
   - 고른 항목: 흰 바탕 + 테두리 (그림자 없음), 링크 + `aria-current="true"`.
4. **오른쪽 상세**: 분쟁 = 지금의 `CaseView` + `ReplyPanel` 그대로 (`CaseDetail`). 오른쪽 칸 안에서는 답장 칸이 아래로 간다 (`.today-detail .case-shell` 한 열). 추적 = 한 줄 설명 + 주문 표 (주문 키 · 구매자 · 상품), 분쟁 걸린 미등록 주문(O02 지호, O13 서연)은 회색 "In dispute — excluded". 연습용 분쟁만 걸린 O04는 넣지 않았다. 등록 버튼 없음.
5. **서랍** (`_shared/activity-drawer.tsx`): 오른쪽에서 열림 (`width: 100%; max-width: 25rem` — 고정 폭 검사에 걸리지 않는다), 제목·한 줄 설명·닫기 버튼·빈 상태 문구, Esc·배경 누름으로 닫힘, Tab 가둠, 닫으면 여는 버튼으로 포커스 복귀.
6. **디자인**: 강조색 하나(`--color-accent`) — 로고 표시·링크·판매자 머리글자 바탕. 새 색 변수 없음 (왼쪽 칸 바탕은 기존 `--color-bg`). 그림자 없음. 카드 둥근 16~20px, 알약 999px, 제목 1.625em(26px), 본문 14px, 보조 12px. 56rem 아래에서는 목록 위·상세 아래 한 열. 글꼴 그대로.
7. **Products 최소판** (`products/page.tsx`): 같은 틀 안에 시드 상품 카드(이름·SKU·남은 재고, Demo data 배지), `?sku=` 상품은 강조색 테두리 + `aria-current`.

### 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/layout.tsx` | 옛 머리글 → `TopBar` (N·판매자 칩을 서버에서 넘김), `force-dynamic` |
| `src/app/page.tsx` | Today 탭 (목록 + 오른쪽 상세) |
| `src/app/today/model.ts` (새) | `buildToday`·`selectItem`·`pickPrevent`·`buyerShortName`·`dateLine`·`daysUntil`·`ordinal` |
| `src/app/today/tracking.ts` (새) | `summarizeTracking` (`listUntracked` GET만, 실패 시 `null`) |
| `src/app/today/today-list.tsx`·`tracking-detail.tsx`·`today.css` (새) | 목록·추적 상세·스타일 |
| `src/app/_server/today.ts` (새) | `loadTodayForRequest`·`loadTrackingForRequest` (요청당 한 번) |
| `src/app/_shared/top-bar.tsx`·`activity-drawer.tsx`·`autopilot-toggle.tsx`·`shell.css` (새) | 위쪽 막대·서랍·토글 |
| `src/app/_shared/nav-items.ts` | 탭 두 개 + `sellerChip` |
| `src/app/cases/case-detail.tsx` (새) | 옛 page(1부)+layout(답장 칸)을 한 컴포넌트로 (구조 변경 없음) |
| `src/app/cases/[disputeId]/page.tsx`·`layout.tsx` | `/?item=`로 redirect · 빈 통과 |
| `src/app/products/page.tsx`·`products.css` (새) | Products 최소판 |
| `config/copy.en.json`·`copy.ko.json` | `shell.*`·`today.*` 새 키, `nav.orders`·`nav.inbox` 삭제, `nav.products` = "Products" |
| `tests/unit/app-today.test.ts` (새) | 아래 완료 기준 전부 (40개) |
| `tests/unit/app-shared.test.ts` | 4칸 메뉴 기대 → 두 탭 (재시도 3번 허용 범위) |

`tests/unit/app-shared-design.test.ts`(그림자 금지·360px 고정 폭 금지)는 **고치지 않았다** — 그대로 통과한다.

### 완료 기준 대조
| 기준 | 결과 | 확인한 테스트 |
|---|---|---|
| Today(N)의 N = 목록 항목 수, 판매자 칩 글자가 설정에서 | 예 | `Today (N)의 N = …`(그린 HTML의 항목 수까지), `판매자 칩 글자는 설정의 서명에서` |
| 목록이 데이터에서: Needs you = 서연·추적(2)·지호, Prevent = 가디건, Routine = Mike, Lena·Yuki·통관부호 없음 | 예 | `Needs you = 서연 · 추적(2) · 지호 순…`, `Lena 환불 · Yuki …가 없다`, 위험이 바뀌면 순서도 바뀌는 시험 |
| 맨 위 숫자 = `simulateStore` 합계 달러 반올림 ($717 · $253) | 예 | `맨 위 숫자 = simulateStore 합계의 달러 반올림` |
| 남은 날 수 = 문구 파일 날짜와 지금 시각 (11/10 → 17) | 예 | `날짜 줄` 3개 (판매자 시간대 경계 포함) |
| 추적 조회 실패 → 숨김, 분쟁 걸린 주문은 수에서 빠짐 | 예 | `추적 항목 조회 (GET만)` 5개 (POST 0회, 분쟁 주문 GET 0회) |
| `/cases/<id>` → `/?item=<id>`, 서연·지호 상세 그대로, 보내기 관문 테스트 통과 | 예 (정적 검사 + 기존 `app-send`·`app-case-*` 테스트 그대로 통과) | 실제 화면은 컨트롤 타워 스크린샷으로 확인 필요 |
| 서랍: 열기·닫기(Esc)·빈 상태 | 예 (닫힌 상태 렌더 + 코드 검사. DOM 도구가 없어 열린 상태 상호작용은 시험하지 못했다) | `서랍:` 3개 |
| 화면 코드에 금액·건수 숫자, "Hannah"·"Fernwood" 없음 | 예 | `화면 코드에 금액·건수 숫자가 없다`, `판매자 이름 글자가 없다` (src/app 전체) |
| `npm test`·`tsc`·`lint`·`test:acceptance`·`build` 실패 0 | 예 | 아래 표 |

### 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 | 0 | 9 skipped (기존과 같음) |
| npm test (vitest tests/unit) | 1868 | 0 | 40 파일. 새 `app-today.test.ts` 40개 포함 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | 모든 경로 ƒ(동적). 이 worktree에 `.env`가 없어 빌드 중 PayPal 호출 없음 |

### 남은 문제
- `src/app/_shared/nav.tsx`(옛 4칸 메뉴 컴포넌트)를 지우지 못했다 — `git rm`이 권한 대기로 막혔다. 지금은 아무 데서도 import하지 않는 죽은 파일이다 (빌드·lint 통과). 병합 전에 지우면 된다.
- 지호의 실제 위험 단계는 실제 분쟁 글로 정해진다. 지금 규칙(High 서연 → Watch 추적 → 지호)은 지호가 Watch 이하일 때 지시서 순서와 같다. 지호가 실제로 High가 되면 지호가 맨 위로 온다 (엔진이 정한 순서를 따른다 — 의도한 동작).
- 레이아웃이 모든 화면에서 Today 목록을 읽는다 (N 때문). `/products`·`/preview/styleguide`에서도 분쟁 GET + 주문 GET 10건이 요청마다 한 번 나간다 (요청 안에서는 `cache`로 한 번). LLM은 기존 `loadDemoDisputes`처럼 규칙이 못 정한 보드·어조 판정에만 불린다.
- 추적 상세의 회색 줄은 샌드박스 기록(`tests/sandbox/manifest.json`의 `tracked: false`)으로 고른다 — 분쟁 걸린 주문은 `listUntracked`가 조회하지 않기 때문이다.
- 오른쪽 사례 상세에 `h1`(구매자 전체 이름 "김서연 Seo-yeon Kim")이 남아 목록 제목 "Today"와 `h1`이 둘이다. 구조 변경은 T061 몫이라 손대지 않았다.
- 문구 파일 `version` 값은 올리지 않았다 (`sed -i`가 권한 대기로 막혔다. 키는 두 파일이 같다).

### 컨트롤 타워에 요청할 결정
- **추적 항목의 위험 배지 "Watch"**: 미등록 주문은 엔진 점수가 없어 `today/model.ts`에 상수 `TRACKING_BAND = 'Watch'`로 두었다 (지시서 3절 "Watch 배지"). 정책 값이므로 `config/rules.json`(이 레인은 읽기만)에 두는 것이 CLAUDE.md "정책 기준값은 config/에서"에 맞다 — 옮길지 정해 달라.
- **Prevent 비율 계산 위치**: 재시도 1번대로 엔진 결과(처방 전·후 평균 손실)로만 계산했지만, 비율·반올림은 `src/app/today/model.ts`의 `pickPrevent`에 있다. "숫자 계산은 `src/engine/`에서만" 규칙을 엄격히 지키려면 engine 레인에 `simulateStore` 상품별 감소율을 돌려주는 함수를 요청해야 한다 (지금 결과는 같다: 가디건 80%).
