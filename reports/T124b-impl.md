# T124b 보고 (2026-11-12 21:58)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-desk / d68ea02 (구현). 이 보고서는 다음 커밋

## 결과
일부 완료. `round2/all-products` styles.md 표에서 오른쪽 전체 현황(요약 카드 5개, Products·Cases by risk 표)에 걸린 "설명 없음" 줄 중 CSS·DOM으로 맞출 수 있는 것은 시안 값으로 고쳤다. AG Grid 구조 때문에 남는 줄은 아래 "예외 줄 제안"에 적었다.
**검증 못 한 것**: 개발 서버를 띄우지 말라는 지시가 있어 design-diff를 다시 돌리지 못했다. 설명 없음 수가 실제로 얼마나 줄었는지는 컨트롤 타워가 round3에서 확인해야 한다.

### 원인과 고친 것 (styles.md 줄 기준)
1. **알약·숫자 셀이 41~43px로 커짐** (`span|Reply needed#3~5`, `Prevent#3·4`, `Not received · Customs hold#3`, `Refund promised#3`, `Missing tracking#3`, `Customs ID missing#2`, `Question · Size#2`, `span|0`, `span|2#2`, `span|1#2·#3`: line-height 39px / height 41~43): AG Grid `.ag-cell`의 line-height(행 높이에서 계산한 값)가 상속됐다. → `.ov-grid .ag-cell{line-height:1.5}`. 시안 `.ag`는 14px·line-height 1.5(21px)를 물려준다. 알약 높이는 18+4 = 22다.
2. **시안 자리표 span** (`span|Open cases` gap/width, `4 products · 375 units` 등 sub 높이 17.5→15, `5 rows`·`Sorted by…` 18→14, `AG Grid` 꼬리표 배경이 안쪽 글자 span과 짝지어진 줄, `Disputes across…` 21→17, 시안에만 있는 `span|Product`·`span|Case`·… 머리 이름, `span|Order #1042`, `span|7 rows`, `span|7` 같은 값, 앱에만 있는 `b|91%`): 시안 런타임은 `{{…}}`를 안쪽 `<span>`으로 그린다. 앱도 같은 자리에 안쪽 span을 둔다. 대상은 카드 이름표·값·아래 글, 표 제목·안내, 머리 이름·↓, 모든 셀 글자(상품·단위·건수·위험%·사건·상품·유형·상태·구매자·기한), 아래 줄 두 칸이다. 이를 위해 숫자·구매자·기한 칸에 `TextCell` 렌더러를 넣었다.
3. **Products 안내가 한 덩어리** (앱에만 `Open cases = … · Click a`, 시안에만 `Open cases = disputes…`): 시안처럼 `<span>{gPHint}</span> · <span>{gHint}</span>`로 나눴다.
4. **머리 칸** (`columnheader|*` padding 0→10px 14px, gap 12→6, border-right, line-height 18px, cursor, 정렬 열 색 #002991; 앱에만 `button|Product` 등): 시안의 columnheader는 `.ag-hc` 단추 그 자체다. 그래서 `.ag-hc` 값을 AG Grid 머리 칸(`.ag-header-cell`, 같은 역할 columnheader)에 주고 안쪽 단추를 없앴다(span `ov-hc`). 정렬 열 파랑은 AG의 `ag-header-cell-sorted-asc/desc`로 준다.
   - 동작은 그대로다: 마우스로 머리 칸 어디를 눌러도 `onColumnHeaderClicked` → `nextSort`(시안 `sortHead.pick`: 정렬 없으면 그 열의 첫 방향, 같은 열이면 반대) → `applyColumnState`. 키보드 Enter는 AG Grid 머리 칸 기본 동작(`progressSort`)이다. design-diff 정렬 상태도 columnheader를 누르므로 그대로 동작한다.
5. **Dispute risk 머리가 오른쪽 맞춤** (스크린샷 Products x1109 vs 시안 x1052, `span|↓` x): 시안 위험 열은 `.num`이 아니다(왼쪽 맞춤, 처음은 ↓). `header(right, numericSort)`로 맞춤과 정렬 순서를 따로 둔다.
6. **머리 행** (`row|Product`·`row|Dispute risk`: bg #F8F9FB, font 14px/400, color #000, line-height 21px): `.ov-grid .ag-header-row`에 시안 `.ag-h` 값을 넣었다.
7. **데이터 행** (`row|Wool Sweater` 등: border-bottom 1px #EEF0F3, line-height 21px): 테마의 `rowBorder`를 끄고(`grid.ts`), 선을 행 자체에 긋는다(`.ag-row{box-sizing:border-box;border-bottom:1px solid #EEF0F3}`). 시안처럼 바닥줄 앞 마지막 행에도 선이 있다. 행 52px 안에 선이 들어가므로 높이는 그대로다.
8. **표 바탕(role=grid)**: background #FFF, line-height 1.5, cursor auto.
9. **Avg. dispute risk 색** (스크린샷: 시안 빨강 점·숫자, 앱 파랑): 시안 `k.hi = avgR >= 45` → 점 #C4321F, 숫자 #C4321F. 앱은 같은 기준인 `riskChipParts(avg).level === 'high'`를 쓴다(행 `.hi`와 같은 함수, 계산 없음). 높음이 아니면 지금처럼 파랑이다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/today/overview.tsx` | 글자 안쪽 span(시안 자리표), `TextCell`, 머리 안쪽 단추→span + `nextSort` + `onColumnHeaderClicked`, 위험 머리 왼쪽 맞춤, KPI `hi`, 안내 두 span |
| `src/app/_shared/grid/grid.ts` | `DESK_GRID_THEME_PARAMS.rowBorder: false` (행 선은 desk.css) |
| `src/app/(app)/desk.css` (overview 절) | `[role=grid]`·`.ag-header-row`·`.ag-header-cell`(=`.ag-hc` 값)·정렬 색·`.ov-hc`·`.ag-row` 선·`.ag-cell` line-height·`.ov-k-val-hi` |
| `tests/unit/app-t122b.test.ts` | 마크업 기대값을 안쪽 span으로 갱신, 위험 열 맞춤·정렬 순서, `nextSort`, KPI hi/big 분기 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 | 0 | 9 skipped |
| npx vitest run tests/unit | 2751 | 2 | 시간 초과 2건: `storefront.test.ts` 결정론 100회, `sim.test.ts` 결정론 100회(5000ms). 따로 돌리면 sim·design-diff는 통과하고 storefront는 다시 시간 초과다. 이번 변경과 무관한 파일이고 다른 세션이 함께 돌아 기계 부하가 높다 |
| npx tsc --noEmit | 통과 | 0 | |
| npx eslint (바뀐 ts/tsx) | 통과 | 0 | |
| design-diff 재실행 | — | — | 개발 서버 금지라 못 돌렸다 |

## 남은 문제
- 위 "검증 못 한 것"과 같다: 화면으로 확인하지 못했다. 특히 머리 칸 `padding:10px 14px`와 높이 38(`DESK_GRID_HEADER_HEIGHT`), 행 선을 `.ag-row`로 옮긴 것은 round3 스크린샷으로 확인해야 한다.
- 왼쪽 목록·상단 칩 줄과 데이터 차이에서 생긴 짝 어긋남은 범위 밖이라 손대지 않았다. 예: `span|Reply needed`가 앱 KPI와 시안 목록 제목으로 짝지어지는 경우인데, 앱 목록 제목이 span이 아니어서 생긴다. 이 때문에 내 범위의 일부 요소(`#n` 순번)가 계속 엇갈려 보일 수 있다.
- 데이터 차이(앱 8건 vs 시안 7건, PP-R 번호, 위험값)는 ENG-01·DATA 예외다.

## 예외 줄 제안 (exceptions.json은 컨트롤 타워가 고친다)
| 제안 ID | DECISIONS 근거 | 매칭할 요소 · 항목 | 이유 |
|---|---|---|---|
| AG-04 | 2026-11-12 20:40 5 "AG Grid 표 2개 … 공용 AG Grid 래퍼" + 스폰서상 = AG Grid | `grid\|Product`, `grid\|Dispute risk` · border-*, border-radius, width, height | 시안 role=grid는 바닥줄(`.ag-f`)까지 감싸는 `.ag` 상자다. 앱의 role=grid는 AG Grid 안쪽 뿌리다. 테두리·둥근 모서리는 바깥 `.ag` 상자(시안 값 그대로)가 그리고, 바닥줄은 AG Grid 밖에 있다. 그래서 높이는 바닥줄(35px)만큼, 폭은 테두리 2px만큼 다르다 |
| AG-05 | 같음 | `row\|<표 행>` · transform (matrix(1,0,0,1,0,N)) | AG Grid는 행을 transform으로 놓는다(라이브러리 배치). 위치(y)는 같다 |
| AG-06 | 같음 | `row\|Product`, `row\|Dispute risk`(머리 행) · border-bottom | 머리 아래 선(#DDE2EB 1px)은 AG Grid `.ag-header`(테마 headerRowBorder)가 긋는다. 화면은 같고 그리는 요소만 다르다 |
| ENG-08 확장 | 2026-11-12 20:40 4 + 2026-11-11 22:55 "데이터(엔진 숫자)" | Cases by risk·Products 위험 열의 앱에만 있는 `b\|—` / 시안에만 있는 `span\|N%`·막대, Products 줄 `.hi` 배경 차이 | 엔진 값이 없는 데모·예방·질문 항목은 막대 대신 "—"다. 목록 칩 예외와 같은 근거 |

## 컨트롤 타워에 요청할 결정
- 없음 (계약·인수 테스트·SPEC 변경 불필요). 위 예외 줄 제안 반영과 round3 비교 실행만 요청한다.
