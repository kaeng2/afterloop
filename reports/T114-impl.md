# T114 보고 (2026-11-12 11:20)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-desk / (이 보고서와 같은 커밋)

## 결과
완료 — `/products` 화면과 그 화면 전용 코드·CSS·시험을 지웠고, 공용 AG Grid 설정(테마·셀 깜빡임·기본 열 설정)은 `src/app/_shared/grid/grid.ts`로 옮겨 남겼다. `/products`(쿼리·하위 경로 포함)는 `/`로 308. 엔진·ag-grid 패키지 무변경.

**지시서와 다른 점 1개**: `next.config.ts`는 이 worktree 권한 설정에서 편집이 막혀 있다 (Write 거부: "denied by your permission settings"). 지시서가 허용한 "같은 효과"로 **라우트 핸들러** `src/app/products/[[...rest]]/route.ts`(GET → `NextResponse.redirect('/'+쿼리, 308)`)를 두었다. `/products`, `/products?sku=…`, `/products/…` 모두 받는다. 빌드 표에 `ƒ /products/[[...rest]]`로 나온다.

## 지우기 전 확인 (grep)
- `src/app/products/**`·`src/app/(app)/products/page.tsx`를 import하는 곳: `src/` 안에서는 `(app)/products/page.tsx` 자기뿐. `scripts/`·`tests/acceptance/`는 0 (acceptance의 `products`는 `seed/products.json`).
- 그래서 `transactions-line.ts`·`color-note*.ts(x)`·`actions.ts`·`model.ts`·`views.tsx`·`products-screen.tsx`·`products.css`·`grid.ts`·`product-grid.tsx` 모두 화면 전용 → 지움. Desk·/listing·_shared로 옮길 것은 `grid.ts`의 화면 무관 부분(모듈·테마·기본 열 설정·키보드 판정)뿐.
- 문구: `product.*` 47키 중 `product.fix.<id>.title` 4키는 Today Prevent 카드(`src/app/today/prevent-card.tsx:39`, `` t(`product.fix.${fix.fix}.title`) ``)가 써서 남김. 나머지 43키를 en/ko 둘 다 지움 (줄 삭제만, 다른 줄 무변경 — T113과 충돌 최소). en/ko 키 집합 같음.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/(app)/products/page.tsx` | 지움 |
| `src/app/products/{actions,color-note,color-note-card,grid,model,product-grid,products-screen,transactions-line,views}.ts(x)`, `products.css` | 지움 (화면 전용) |
| `src/app/_shared/grid/grid.ts` | 새 파일. 공용 AG Grid 설정: `GRID_MODULES`(HighlightChangesModule 포함), `GRID_THEME_PARAMS`/`gridTheme`(디자인 변수만), `GRID_DEFAULT_COL_DEF`, `FLASH_ON_CHANGE`, `baseGridOptions()`, `isSelectKey`. 화면에 붙지 않음 |
| `src/app/products/[[...rest]]/route.ts` | 새 파일. `/products*` → `/` 308 (쿼리 유지. 데이터·PayPal·AI 호출 없음) |
| `config/copy.en.json`, `config/copy.ko.json` | products 전용 43키 삭제 |
| `src/app/(app)/layout.tsx`, `(app)/desk.css`, `today/today-list.tsx`, `lang/route.ts` | 주석의 `/products` 언급만 고침 (코드 변경 없음) |
| `tests/unit/app-product.test.ts`, `app-product-grid.test.ts`, `app-product-t073.test.ts` | 지움 (/products 화면 고정 시험) |
| `tests/unit/app-t114.test.ts` | 새 시험 14개: 308 이동(쿼리·하위 경로), 화면 파일 없음, `src/app` 코드에 `/products` 주소·옛 모듈 import 0, 문구 키, 공용 그리드 테마·깜빡임·기본 열 설정(T065 시험에서 옮김), ag-grid 패키지 남음 |
| `tests/unit/app-t076/t079/t081/t084-perf/t107/today/shared/lang-route.test.ts` | 지운 파일을 읽던 줄만 빼거나 다른 주소로 바꿈 (`/products` 링크 0 시험은 그대로) |
| `reports/design-match/inventory.md` | /products 언급 2곳에 "11/12 11:15 결정으로 /products 제거 — T114" 표시 |
| `reports/screens/design-match/README.md` | /products 관련 행·문장이 없어 무변경 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skip) | 0 | 15 파일 |
| npm test | 2540 | 1 | 실패 1 = `storefront.test.ts > 결정론 > 같은 입력 100회` 시간 흔들림 (5.4s). 단독 실행 31/31 통과 — 지시서 "storefront·sim 흔들림은 따로" |
| npx tsc --noEmit | 통과 | 0 | 빌드 전에는 낡은 `.next/types`가 지운 page를 찾아 1건 났고, `npm run build` 뒤 0 |
| npm run lint | 0 error | 0 | 기존 경고 2 (`app-t098a-scenes.test.ts`, 이 작업과 무관) |
| npm run build | 통과 | 0 | `/products/[[...rest]]` 라우트, `/products` 페이지 없음 |
| 쓰기 관문: `ops-t070-gates`, `app-t064-activity` (+ `app-t114`) | 43 | 0 | 그대로 통과 |

## /products가 사라져 아무 데서도 안 쓰게 된 export (지우지 않음)
`src/`·`scripts/` 기준 (tests 제외), 정의 파일 밖 참조 0개가 된 것만.

| 파일:이름 | 원래 쓰던 곳 |
|---|---|
| `src/engine/storefront.ts:pickRepresentativeFuture` | `src/app/products/model.ts` (점 그림 대표 미래) |
| `src/ai/color-note.ts:writeColorNote` | `src/app/products/color-note.ts` (→ `actions.ts` → `(app)/products/page.tsx`) |
| `src/ai/color-note.ts:ColorNote`, `ColorNoteLocale` (타입) | `src/app/products/model.ts` |
| `src/paypal/transactions.ts:TransactionsResult` (타입) | `src/app/products/model.ts` |
| `src/paypal/transactions.ts:TransactionCache` (타입), `lastDays`, `createMemoryTransactionCache` | `src/app/products/transactions-line.ts` |
| `src/app/_server/activity.ts:getTransactionsRecorded` | `src/app/products/transactions-line.ts` (주석 `activity.ts:258`도 옛 파일을 가리킨다 — 무변경 파일이라 그대로) |
| `src/app/_shared/badges.tsx:CachedBadge` | `src/app/products/views.tsx` |
| `src/app/_shared/grid/grid.ts` 전부 | 새 공용 모듈 — 지시서대로 화면에 붙지 않음 |

엔진의 `simulate`·`fixSavings`·`simulateStore`·`simInputFor`·`FIX_ORDER`·`pickPreventProduct`·`paramsConfigFromFile`은 Today·/listing 등에서 계속 쓴다. `src/ai/color-note.ts`·`src/ai/prompts/color-note.ts`는 `tests/unit/color-note.test.ts`가 계속 시험한다.

## 남은 문제
- `tests/unit/app-t081.test.ts`의 "ko가 영어 그대로여도 되는 키" 허용 목록에 지운 `product.row.values`가 남아 있다. 허용 목록이라 해가 없고, T113(lane/ui)이 같은 파일 근처를 고칠 수 있어 건드리지 않았다.
- 브라우저 확인(308·링크 0)은 컨트롤 타워 몫. 개발 서버는 띄우지 않았다 (단위 시험에서 라우트 GET을 직접 불러 308·Location 확인).

## 컨트롤 타워에 요청할 결정
- `next.config.ts` 편집이 이 레인 권한에서 막혀 있다. 라우트 핸들러로 같은 효과를 냈으니 그대로 두거나, `next.config` redirects로 옮기려면 권한을 풀어 달라 (그때는 `src/app/products/[[...rest]]/route.ts`와 `app-t114` 308 시험 3개를 함께 바꾼다).

## 재시도(후속)
- 문제: `route.ts`가 `new URL('/', request.url)` 절대 주소로 Location을 만들어, Render 프록시 뒤에서 `https://localhost:10000/`로 나갔다 (11/12 11:20 (2)-6과 같은 버그).
- 수정: 라우트가 `new NextResponse(null, { status: 308, headers: { Location: '/' + request.nextUrl.search } })`로 상대 경로를 낸다. 쿼리는 그대로 넘긴다.
- 시험: `app-t114.test.ts`에 "Location이 http로 시작하지 않는 상대 경로이고, request.url 호스트가 localhost:10000이어도 그 호스트가 들어가지 않는다" 추가. 기존 308 시험은 상대 Location을 base로 풀어 읽도록 맞췄다.
- 확인: app-t114 14개 통과, tsc 통과, lint 에러 0 (기존 경고 2개, 무관). 실호출·개발 서버 없음.
