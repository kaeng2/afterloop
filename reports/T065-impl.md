# T065 보고 (2026-11-11 19:25)

- 기준 SPEC: v2.10 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / c3103b4 (구현). 이 보고서는 다음 커밋

## 결과
완료. `/products` 왼쪽 임시 목록(T062)을 AG Grid Community 표로 바꿨다. 열 3개 Product · Left · As-is → With fixes, 행 = `buildProductRows`(T062) 결과 그대로, 행 ID = sku, With fixes 열만 `enableCellChangeFlash`. 행 클릭·Enter·Space로 `?sku=` 이동. 정렬·필터·메뉴 끔. 테마 = Quartz + 우리 디자인 변수 (강조색 `--color-accent` 하나, 기본 파랑 없음). 서버 렌더와 첫 그림은 같은 행의 단순 링크 목록(T062 것)이고 브라우저에 붙은 뒤 AG Grid로 바뀐다 (SSR 안전, 자바스크립트 없이도 고를 수 있음). `src/app/_server/`는 건드리지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/products/grid.ts` | 새 파일. AG Grid 설정만 (계산 없음): `productGridColumns`, `productGridOptions`, `productGridRowId`(sku), `PRODUCT_GRID_THEME_PARAMS`/`productGridTheme`, `PRODUCT_GRID_MODULES`(ClientSideRowModel·HighlightChanges·RowStyle·CellStyle·RowAutoHeight — AllCommunityModule 안 씀), `SELECTED_ROW_CLASS`, `isSelectKey` |
| `src/app/products/product-grid.tsx` | 새 파일 (`'use client'`). `ProductGrid`: 마운트 전 `ProductRowsFallback`(T062 링크 목록), 마운트 후 `AgGridReact`. `onRowClicked`·`onCellKeyDown`(Enter/Space) → `router.push(row.href, { scroll: false })` |
| `src/app/products/views.tsx` | `ProductList`가 제목·Demo 배지 + `ProductGrid`를 그린다. 옛 `<ul>` 목록과 `product.list.columns` 줄은 뺐다 (열 머리글이 대신한다) |
| `src/app/products/products.css` | 표 스타일 (행 커서, 이름 굵게, 고른 행 = 강조색 옅은 바탕 + 이름 강조색). 왼쪽 칸 폭 18rem → 20rem (상품 이름이 덜 줄바뀜) |
| `config/copy.en.json`, `config/copy.ko.json` | `product.grid.label`, `product.grid.col.product/left/values` 4개 추가 (두 파일 같은 키) |
| `tests/unit/app-product-grid.test.ts` | 새 파일. 14개 |
| `tests/unit/app-product.test.ts` | `next/navigation` 가짜 한 줄 추가 (표가 앱 라우터를 쓴다. 기대값은 바꾸지 않음) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 (+ 9 skip) | 0 | 실행만 했다 |
| npm test | 2018 | 0 | `app-product-grid.test.ts` 14. 중간 실행에서 `storefront.test.ts` "같은 입력 100회"가 5초 시간 초과로 1번 실패 — 기계 부하(load 34) 때문, 엔진 코드는 안 건드림. 단독 재실행·전체 재실행 모두 통과 |
| npx tsc --noEmit | — | 0 | |
| npm run lint | — | 0 | |
| npm run build | — | 0 | `/products` 25 kB → **268 kB** (AG Grid 포함, First Load 400 kB) |

실제 AI·PayPal 호출 0회. 개발 서버를 띄우지 않았다.

## 완료 기준 대조
| 기준 | 결과 | 근거 |
|---|---|---|
| 행 데이터 = T062 보기용 함수 결과 | 통과 | 표 열의 `field` 값 = `buildProductRows` 행 값, 순서 = `simulateStore`, 서버 렌더 마크업에 행마다 `valuesText`·`data-sku` |
| 토글 뒤 With fixes 값 = 엔진 결과 | 통과 | 처방 조합 4가지 × 4행: `row.withFixes.cents` = `simulate(simInputFor(...)).after.meanLossCents`, 셀 글자 = `t('product.row.values', 두 엔진 값)` |
| 깜빡임 설정 켜짐 | 통과 | values 열만 `enableCellChangeFlash: true`, `HighlightChangesModule` 포함, `getRowId` = sku, 토글 전후 행 ID 같음·값 바뀐 행 있음·상품/재고 열은 그대로 |
| 화면 코드에 금액 숫자 없음, 기본 파랑 없음 | 통과 | 새 파일에 `$숫자`·세 자리 이상 정수·소수·`/100`·`toFixed`·`Math.round` 없음 (T062 정적 검사도 통과). `#2196f3`/`rgb(33,150,243)` 없음, 색 파라미터는 모두 `var(--…)` 또는 `--color-accent`를 섞은 `color-mix` |
| 정렬·필터 메뉴 숨김 | 통과 | `defaultColDef` sortable/filter/resizable false, suppressMovable, suppressHeaderMenuButton |
| 서버 렌더에서 안 깨짐 | 통과 | 클라이언트 컴포넌트 + 마운트 전 대체 목록, `renderToStaticMarkup` 테스트, `npm run build` 통과 |
| 명령 5개 실패 0 | 통과 | 위 표 |

## 남은 문제
- **실제 브라우저 확인이 필요하다** (DOM 시험 도구 없음): ① 처방 토글 시 With fixes 셀이 강조색으로 깜빡이는지 ② 행 클릭·Enter/Space 이동 ③ 첫 그림(대체 목록)에서 표로 바뀔 때 높이 차이 ④ 어두운 화면에서 테마 변수가 따라가는지. 컨트롤 타워 스크린샷 때 함께 봐 주길.
- 깜빡임 시간은 AG Grid 기본값(flash 500ms + fade 1000ms). 화면 코드 정적 검사(세 자리 숫자 금지) 때문에 직접 적지 않았다. 영상에서 더 길게 보이게 하려면 `config/`에 값을 두는 방식으로 정해 주면 옮긴다.
- 상품을 바꾸면 `router.push`로 주소만 바뀌고 서버 컴포넌트가 다시 렌더된다 (처방 토글 상태는 T062처럼 유지됨). 바뀐 행 데이터의 `selected`만 달라져 깜빡임은 일어나지 않는다 (값 변화 없음).
- 번들이 커졌다 (`/products` 268 kB). 필요한 모듈만 실었지만 AG Grid 본체 크기다.
- `product.list.columns` 문구 키는 이제 쓰이지 않는다 (지우지 않고 둠).

## 컨트롤 타워에 요청할 결정
- 없음
