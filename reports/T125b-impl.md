# T125b 보고 (2026-11-12 23:25)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예. 지시서 파일 `tasks/T125b.md`는 없고 사람 지시문 기준)
- 브랜치 / 마지막 커밋: lane/ui-desk / b3d36b4 (코드), 이 보고서는 다음 커밋

## 결과
일부 완료 — All products 전체 현황에서 **스타일로 고칠 수 있는 '설명 없음' 줄**(요약 카드 라벨, AG Grid 꼬리표, 정렬된 머리글 색, ↓ 줄 높이, 표 안내 문구 줄 높이·구조)을 시안 값으로 고쳤다.
all-products 상태 '설명 없음' 620줄 중 대부분은 **데이터 차이로 생긴 짝 맞춤 어긋남**(같은 글자의 n번째끼리 짝지어 왼쪽 목록·카드 요소와 엇갈려 비교됨)과 **AG Grid 구조**에서 나온다. 이건 스타일로 고칠 수 없으므로 아래에 '예외 줄 제안'으로 적었다.
개발 서버를 띄우지 못해(지시) 고친 뒤의 자동 비교는 다시 돌리지 않았다 — 다음 회차 비교에서 확인이 필요하다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/today/overview.tsx` | 요약 카드 라벨: 점 옆 글을 안쪽 span 없이 라벨 span에 바로 (시안 L188 `<span style="display:flex;gap:8px…"><span dot/>{{k.label}}</span>`). AG Grid 꼬리표: 아이콘 옆 글을 바로 (시안 L184). Products 안내 문구: 두 span → 한 글 `{{v.gPHint}} · {{v.gHint}}` (시안 L190) |
| `src/app/(app)/desk.css` (overview 절) | 정렬된 머리글 파랑: 죽은 규칙(`.ag-header-cell-sorted-*` — 직접 만든 머리에는 AG Grid가 이 클래스를 안 붙인다)을 `.ag-header-cell[aria-sort=ascending/descending]{color:#002991}`로 교체 (시안 `.ag-hc.on`). `.ov-grid .ag-ind{line-height:1.5}` (시안 11px × 1.5 = 16.5px). `.ov-block-hint` line-height 1.5 (시안 18px) |
| `tests/unit/app-t122b.test.ts` | 위 마크업 변경에 맞춰 기대 문자열 3곳 갱신 (꼬리표·Avg 라벨·안내 문구). 동작 검사는 그대로 |

고친 '설명 없음' 줄 (all-products · all-products__dispute-risk 공통, 정렬 상태마다 반복):
- `span|Open cases`·`span|Avg. dispute risk` (및 다른 카드 라벨) gap 8px · width 170.7 · x — 측정 요소가 라벨 span 자체가 된다
- `span|AG Grid` background-color #F1F3F6 · border-radius 1000px · padding 4px 10px · gap 6px · width 83.6 · height 26 · x·y — 측정 요소가 `.ag-tag` 자체가 된다 (CSS는 이미 시안 값)
- `columnheader|Dispute risk`, `columnheader|Dispute risk#2` color rgb(0,41,145)
- `span|↓`, `span|↓#2` line-height 16.5px · height 16.5
- `span|Click a column to sort · click a row to open` height 18 (+ 짝 어긋남 x·y 해소)

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 | 0 | 9 skipped |
| npx vitest run tests/unit | 2755 | 25 | 실패 8개 파일 모두 overview·desk.css를 쓰지 않는다 (app-case-reply-retry, app-shared, app-t064-activity, app-t115, app-t122f, ops-t070-gates, seed-demo-display, storefront 시간 초과). 이번 변경 전부터 있던 실패로 보인다 (연결 표·시드 데이터 쪽). app-t122b 17/17 통과 |
| npx tsc --noEmit | 0 오류 (overview·grid) | | eslint overview.tsx 깨끗 |

## 남은 문제
- **dispute-risk 상태의 정렬 토글**: 시안은 Products의 "Dispute risk" 머리를 누르면 ↑(낮은 순)으로 바뀌는데(`시안에만 span|↑`, `Sorted by Dispute risk ↑`), 앱 캡처는 ↓ 그대로다. 코드 경로(`onColumnHeaderClicked` → `nextSort('desc', ['desc','asc'])` = 'asc' → `applyColumnState`)와 AG Grid v36 소스(머리 칸 click → `columnHeaderClicked` 발송, 기본 머리 comp가 아니므로 이중 정렬 없음)를 읽었지만 정적으로는 원인을 찾지 못했다. 동작 변경이라 이번 범위(동작 무변경)에서 손대지 않았다. 브라우저로 한 번 눌러 보고 확인해야 한다.
- 위 고침은 자동 비교를 다시 돌려 확인하지 않았다 (개발 서버 금지).
- 왼쪽 목록·주간 카드 쪽 줄(`button|#1042` 높이, `span|Lena K. · DE` 글자 크기 등)은 다른 영역이라 건드리지 않았다. 대부분 짝 어긋남이다.

## 예외 줄 제안 (고치지 않음)
1. **AG Grid 표 상자** — `grid|Product`·`grid|Dispute risk`의 border-*(1px #DDE2EB)·border-radius 12px·width·height: 시안은 `role=grid`인 `.ag`가 테두리와 바닥 줄(`.ag-f`)을 함께 품는다. 앱은 AG Grid가 `role=grid`를 안쪽 루트에 붙이고, 테두리·둥근 모서리는 바깥 `.ag.ov-grid`가 같은 값으로 그린다(그래서 width 2px·바닥 줄 높이 37px만큼 차이). 화면은 같다. 제안: `role: grid`, `selector: .ov-grid`, prop border-*·border-radius·width·height.
2. **머리 줄 아래 선** — `row|Product`·`row|Dispute risk` border-bottom 1px #DDE2EB: 앱은 AG Grid 테마 `headerRowBorder`가 같은 선을 `.ag-header`에 긋는다(같은 위치·색). 행 요소로 옮기려면 머리 높이·AG Grid 내부 상자 모델을 건드려야 해서 보지 않고는 위험. 제안: `role: row`, `selector: .ov-grid .ag-header-row`, prop border-bottom.
3. **행 위치 transform** — `row|…` transform matrix(…): AG Grid가 행을 transform으로 놓는다. 제안: `selector: .ov-grid`, prop transform.
4. **AG Grid 안쪽 요소** — 앱에만 있는 `presentation|…`·`gridcell|…`·`rowgroup|…` 와 그 opacity 400ms 전환(motion): AG Grid DOM. 제안: `kind: extra/motion`, `selector: .ov-grid`.
5. **데이터 차이** — 시안 7 cases·risk 38/31/27/22/12/6% 대 앱 8 cases(엔진 위험값이 없는 사건은 "—", 결정대로 화면에서 계산하지 않음), Knit Cardigan 81% High(행 옅은 빨강), "Beanie + Scarf Set", 요약 숫자 7/2/47% 대 8/3/86%, Cashmere 0% 막대 대 "—", 상품 행 순서. 이 때문에 같은 글자(`Prevent`, `Reply needed`, `2`, `1`, `Wool Sweater`, `5 orders` …)의 n번째 짝이 왼쪽 목록·상단 칩·카드 요소와 엇갈려 수백 줄이 생긴다(예: `span|Reply needed#2` 시안=표의 상태 알약, 앱=요약 카드 라벨). 시드·엔진 값이라 이 레인에서 고칠 것이 아니다. 제안: all-products* 상태의 `.ov-grid` 안 x·y와 짝 어긋남은 데이터 예외로 묶거나, 비교 도구가 글자 n번째 대신 영역(같은 표·같은 열) 안에서 짝짓도록.

## 컨트롤 타워에 요청할 결정
- 위 '예외 줄 제안' 1~5를 `reports/design-match/v6/exceptions.json`에 넣을지.
- dispute-risk 정렬 토글: 브라우저 확인 후 버그면 별도 지시서(동작 변경)로 낼지.
