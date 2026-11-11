# T096 검증 (c0e3775, 기준 ad9fd7b)

판정: **통과 (남은 링크 1건은 구현자가 이미 보고한 결정 대기 항목)**

1. 시험: npm test 67파일/2374 통과 (첫 실행에서 결정론 시험 1건 시간 초과 → 재실행 2회 모두 통과, 흔들림), tsc 0, lint 0, acceptance 15파일 177 통과(9 skip), build 성공. 실패 0.
2. 위쪽 막대(top-bar.tsx): 탭·nav 없음. 왼쪽 로고·"for PayPal sellers"·날짜, 오른쪽 공개 데모 표시·PayPal activity·EN/KO·판매자.
3. /listing·/products로 가는 링크 (src/app 전체 grep):
   - /listing 링크: 0건 (page.tsx의 applyLangParam 문자열만).
   - /products: `src/app/today/model.ts:393` Today Prevent 행 `/products?sku=…` (Desk 목록 줄, today-list.tsx가 href로 렌더) — **문제: Desk→/products 링크 1건 남음**. products 화면 내부 행 링크(productHref)는 자기 화면 안.
   - `_shared/nav-items.ts:14` `{href:'/products'}` 항목은 정의만 있고 사용처 없음 (sellerChip만 import) — 죽은 코드.
   - /intro: 0건. Desk "Stock left…" 링크는 글자로 바뀜.
4. 빌드 라우트에 /products·/listing 남아 있음.
5. /listing 왼쪽 메뉴 DisputeLess: `<button type="button" aria-disabled="true">`, onClick·href 없음.
6. src/app CSS에 prefers-color-scheme 0건. color-scheme: light가 globals.css·intro.css·listing.css에 있음. globals.css diff: 추가는 html color-scheme 한 블록뿐, 삭제는 다크 토큰 블록뿐 — 밝은 색 값 무변경.
7. send.ts·mode.ts·activity.ts diff 0 (src/app/_server).
8. 범위: 17파일 (src/app 7, tests 9, reports 2 포함 inventory). config 무변경. 범위 밖 변경 없음.
