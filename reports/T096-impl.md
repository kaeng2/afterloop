# T096 구현 보고 — 화면 진입점 정정 + 밝은 모드 고정

- 브랜치: `lane/ui-entry` (지시서의 `lane/ui` 대신 — ui worktree가 T091 사용 중, 사람 지시). 기준 SPEC v2.15 일치 확인.
- 모델: claude-sonnet-5-5. 실제 AI·PayPal 호출 없음, 개발 서버 없음, `.env` 읽지 않음.

## 한 일
1. **위쪽 막대 탭 제거** — `src/app/_shared/top-bar.tsx`: `TOP_TABS`·탭 `<nav>`·`todayCount`·`usePathname` 삭제. 왼쪽 = 로고·"for PayPal sellers"·날짜, 오른쪽 = 공개 데모 표시·PayPal activity·EN/KO·판매자. 로고 → `/` 링크만 남음.
2. **Today 데이터 읽기 제거** — `src/app/(app)/layout.tsx`: `TopBarWithCount`·`Suspense`·`loadTodayForRequest` 삭제. 막대 날짜는 `dateLine(new Date())`(T084 fallback과 같은 값). 막대가 Today/PayPal을 더 이상 읽지 않는다.
3. **Desk 왼쪽 "Stock left could cost … →" 링크 → 글자** — `src/app/today/today-list.tsx` (`<p className="weekly-link">`), 밑줄 제거 (`today.css`).
4. **밝은 모드 고정** — `src/app/globals.css`: `@media (prefers-color-scheme: dark)` 블록(토큰 전체)을 지우고 `html { color-scheme: light }` 추가. intro.css·listing.css는 이미 `color-scheme: light`.
5. 쓰지 않게 된 `.shell-tabs`/`.shell-tab*` CSS 삭제 (`_shared/shell.css`).
6. `/listing` "DisputeLess" 메뉴: 이미 `<button type="button" aria-disabled="true">`, 핸들러·href 없음 — 변경 없이 시험으로 고정. `/intro` 버튼은 전부 `/`(TODAY_HREF)만. `/products`·`/listing` 주소·화면은 그대로.
7. 시험 갱신 (탭·Suspense·다크 모드를 전제하던 것): `app-shared-design`, `app-t087-listing`(T096 진입점 3건), `app-t090`, `app-t079`, `app-t084-perf`, `app-t081`, `app-t061`, `app-t067`, `app-today`. 문구 키(`shell.todayTab`, `nav.listing`, `shell.tabs`)는 config에 남겼다 (config 무변경).

## 결과
`npx tsc --noEmit` 0 오류 · `npm run lint` 0 · `npm test` 67 파일 / 2374 통과 · `npm run test:acceptance` 15 파일 177 통과(9 skip, 기존) · `npm run build` 성공.

## inventory (`reports/design-match/inventory.md`)
- Desk `.nav` 색(L27), `.nav:hover`(L29), `.nav:focus-visible`(L23 묶음 중 해당 선택자만) → **예외** (DECISIONS 22:55 "진입점(탭 없음)").
- 시안에는 `color-scheme`/다크 모드 규칙이 없어 "밝은 모드" 행은 따로 없다 (시험으로 고정).
- 위쪽 막대 나머지 요소(로고·날짜 배치 등)는 T090이 채운 행/시안 `.nav` 외 행이라 건드리지 않았다.

## 컨트롤 타워에 요청할 결정
- **Today의 Prevent 행은 아직 `/products?sku=…`로 가는 링크다** (`src/app/today/model.ts` `preventItem.href`, 목록 줄이 `<Link>`). 지시서 완료 기준 "Desk에 /products 링크 없음"을 엄격히 보면 이것도 해당되지만, 목록의 한 줄이고 화면을 지우는 일이라 손대지 않았다. 지금은 이 줄이 Products 화면으로 가는 유일한 길이다. 없애려면 결정 필요 (기존 시험 `app-today.test.ts`가 이 주소를 기대함).
- `src/app/(app)/cases/**` 등 다른 화면의 `/products` 링크는 확인 못 함(Desk·/intro 범위만 점검).
