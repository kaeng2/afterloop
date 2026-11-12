# T125a 보고 (2026-11-12 23:28)

- 기준 SPEC: v2.16 (시작할 때 SPEC.md 첫 줄과 같았는지: 예. `tasks/T125a.md`는 없어서 지시 메시지의 "기준 SPEC v2.16"과 비교했다)
- 브랜치 / 마지막 커밋: lane/ui / 이 보고서 커밋 (구현은 `665c93c`, `e48f513`, `219ddb9`, `9695ca1`)
- 입력: `reports/design-match/v6/round5/{initial,knit-cardigan,1047,show-history,respond-now,all-products__1029,__1051,__5-orders,__1038}/styles.md` + png. **입력 폴더는 커밋하지 않았다.**

## 결과
일부 완료. 범위 안의 "설명 없음" 줄 중 원인이 하나로 모이는 것은 고쳤다. 개발 서버를 쓰면 안 돼서 도구를 다시 돌려 **확인하지는 못했다** (다음 round에서 확인 필요).

### 주된 원인 (round2 → round5에서 바뀐 것)
round5 도구(`page-scripts.ts` `__ddBare`, design-diff 후속 4·5)는 이제 **스타일 없는 안쪽 `<span>`을 투명 감싸개로 보고 부모에 접는다**. 그래서 T124a가 넣은 "글자는 안쪽 span"은 겉 요소가 글자 주인이 된다. 시안에서 겉 요소가 `<b>`이면(`<b>{{p.name}}</b>` 등) 앱도 겉을 `b`로 바꿔야 짝이 맞는다.
- 앱 `span|Knit Cardigan` ↔ 시안 `b|Knit Cardigan`, `span|Reply needed` ↔ `b|Reply needed`, `span|#1042` ↔ `b|#1042`, `heading|Case history` ↔ `b|Case history` 같은 짝 없는 줄과, 그 때문에 엉뚱하게 짝지어진 스타일 줄(`span|2#2`가 "(2)"의 2와 짝, `span|· Wool Sweater`가 상세 머리의 큰 글자와 짝)이 여기서 나왔다.
- 목록 구매자 줄(`buyer_m · US`, `Lena K. · DE`, `Yuki T. · JP`, `Korean buyers · ship this week`): 위험 % 칩이 없는 줄(ENG-08)은 `.today-item-subrow`의 유일한 자식이 감싸개로 접혀, 도구가 **줄 상자**(15px·검정·gap 8px·폭 230)를 잰다. 시안 who span은 12px·#6C7378·18px.

### 고친 것 (모두 표시만. 값·조건·동작 그대로)
| 줄 | 고친 방법 |
|---|---|
| `buyer_m · US`·`Lena K. · DE`·`Yuki T. · JP`·`Korean buyers …` color·font-size·line-height | `.dk .today-item-subrow{font-size:12px;line-height:18px;color:#6C7378}` |
| `#1029`·`#1051`·`5 orders`·`3 orders` height 96 ↔ 92 | 같은 줄에 `min-height:22px` (시안은 칩 높이 22가 줄 높이를 정한다) |
| `#1042`·`#1047`·`#1038` height (120/96 ↔ 144/140) | PP-R 보조 줄(DATA-01)을 12px/18px #6C7378로 — 줄어들지만 Demo data 줄·PP-R 줄(예외)만큼은 남는다 |
| `b\|Reply needed`·`span\|(2)` / 앱 `span\|Reply needed`·`span\|()`·`span\|2#2` | 묶음 머리 `<h2><b>제목 <span class=today-group-count>(N)</span></b></h2>` (시안 L161) |
| `b\|#1042`·`span\|· Wool Sweater` / 앱 `span\|#1042`·`span\|·`·`span\|Wool Sweater#2` | `<b class=today-item-name>`·`<span class=today-item-product>· 상품</span>` (시안 L166) |
| `b\|All products`·`b\|Knit Cardigan`… | 상품 칩 이름 겉 요소를 `<b class=product-filter-name>` (시안 L135) |
| `b\|DisputeLess this week`·`b\|Dispute risk across this case`·`b\|Case history`·`b\|Buyer messages`·`b\|Your reply`·`b\|Pick a way to resolve` | 제목 h2/h3 안에 `<b>` (제목 역할은 그대로). `font-weight:inherit`로 굵기 그대로 |
| `b\|As you type` | `<b class=reply-tray-title>` |
| `div\|배송 조회가 …`·`div\|· Tracking hasn't moved … · Nov 2` / 앱 `p\|…`·`p\|· ·`·`span\|Tracking…`·`span\|Nov 2` | 말풍선 원문·아래 줄을 `div`로, 강조(mark)가 없는 번역 줄은 "· 영어 · 날짜"를 줄의 맨 글자로 (시안 L313-314). 강조 있는 글은 조각 그대로(KEEP-01/02) |
| `div\|Order paid · $72` 등 기록 줄 (show-history) | `.history-text`를 `div`로 (시안 L294) |
| `span\|Dispute risk`·`if no reply by Nov 14`·`with your draft` width 173 ↔ 70 | `.dk .curve-side{align-items:stretch}` (시안 L272 flex column 기본값). Assumption 배지는 기존 `align-self:flex-start` |
| `span\|Best` border-radius·gap | `.dk .choice-best-tag{display:inline-flex;gap:4px;border-radius:1000px}` (시안 `.ai`) |

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/today/today-groups.tsx` | 묶음 머리·항목 #번호·상품 글 (위 표) |
| `src/app/today/product-filter.tsx` | 칩 이름 `b` |
| `src/app/today/today-list.tsx` | 이번 주 카드 제목 `b` |
| `src/app/cases/view/{case-history,conversation,risk-curve,work-zone,choice-cards}.tsx` | 제목 `b`, 말풍선 div·맨 글자, 기록 글 칸 div |
| `src/app/cases/reply/reply-panel.tsx` | "As you type" `b` |
| `src/app/(app)/desk.css` | T125a 절(L491 아래) + `.curve-side` stretch |
| `tests/unit/app-t068·t102·t107·t118·t122a.test.ts` | 마크업 문자열 단언만 새 태그에 맞춤 (값·조건 그대로) |

동작·관문·Simulated·쓰기 0·데이터 무변경. 렌더 루프 없음 (상태·효과 추가 없음). All products 현황(overview) 파일은 건드리지 않았다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (9 skipped) | 0 | |
| npx vitest run tests/unit | 2755 | 25 | 아래. 이 작업과 무관 |
| npx tsc --noEmit | 통과 | 0 | |
| eslint (src/app/today, src/app/cases) | 0 errors | 0 | |
| npm run build | 통과 | 0 | |

실패 25개 (손대지 않은 파일, 마크업과 무관): `app-case-reply-retry`(8)·`ops-t070-gates`(4)·`app-t122f`(3)·`app-shared`(4)·`app-t064-activity`(3)·`app-t115`(1)·`seed-demo-display`(1) — 메시지가 모두 지호 분쟁 재연결(`5d0a85a` "Link Ji-ho ZOK dispute (D1), hide MBJ")과 맞다 (`expected 'PP-R-MBJ-10197650' to be 'PP-R-ZOK-10200237'`, `'2 cases' to be '3 cases'`, 지호 답장 `null`). `storefront` 결정론 100회는 시간 초과(기계 부하, T124a 보고와 같음). 작업 전 기준선은 따로 돌리지 않았다 — 첫 수정 직후 실행에서도 이 25개 + 내 마크업 단언 5개였고, 단언 5개만 고쳐 통과시켰다.

## 남은 문제 (도구 재실행 필요 + 데이터)
- **도구로 확인 못 함** (개발 서버 금지). 예상: 위 `b`/`span` 짝 없는 줄과 그 때문에 잘못 짝지어진 `span|2#2`·`span|· Wool Sweater`·`span|· Several products`·`span|· Knit Cardigan` 줄이 사라진다.
- 데이터 차이라 고치지 않음 (UI 범위 밖 · 시드/엔진/AI 캐시): 상품 칩 건수(Knit "1 case" ↔ "2 cases", Cashmere/Beanie, 합계 "3 open cases" ↔ "7") → `button|Knit Cardigan` width·`span|2`/`span|1` 배지 짝 엇갈림, `Beanie + Scarf Set` ↔ `Beanie + Scarf`, `9 events` ↔ `8 events`, 첫 메시지 "AI read · Asks for update · Worried" 태그(엔진 신호 없음), History summary 상자(AI 캐시 값 없을 때 숨김), "Dispute message" ↔ "Nov 9"(기록 날짜), 위험 칩 값/폭(`Ji-ho Park · KR` width, ENG-01/08).
- `span|3`·`span|4`·`span|✓` (24px 원 ↔ 이번 주 카드 값): 이번 주 카드 숫자 개수(WEEK-01~03)가 달라 같은 글자의 다른 요소끼리 짝지어진 줄.
- `button|#1042` background (1047 상태): 도구가 #1047을 누른 뒤 남은 hover (`.it:hover` 규칙은 시안 L39와 같다).
- respond-now: `Use AI draft`·`Try a rushed reply`·`Clear`·`Send` opacity 0.45/cursor default, "Missing: A date … + Add" 줄, 체크 칩 4개 ✓가 시안과 다름 — 앱 상태(AI 초안 미적재·검사 결과)에 따른 동작이라 고치지 않음 (동작 무변경 지시).
- all-products__1038: 재현 2단계 실패 (`PP-R-MBJ-10197650` 버튼 없음) — 도구 상태 정의가 옛 지호 번호를 찾는다. 상태 정의를 ZOK로 바꿔야 한다 (도구는 이 레인 범위 밖).
- `button|← All products overview` width 179.5 ↔ 174.7: 시안은 `← {{…}}`가 글자 + sc-interp span 두 flex 항목이라 사이에 `.btn` gap 8px이 들어가고, 앱은 한 글자 덩어리라 공백(≈3.2px)만. 앱에서 같은 간격을 내려면 화살표를 따로 감싸야 하는데 그러면 도구의 버튼 이름이 "All products overview"로 바뀌어 짝이 깨진다.

## 컨트롤 타워에 요청할 결정 (예외 줄 제안)
- **A11Y-H (제안)**: 앱에만 있는 `heading|…` (DisputeLess this week·Reply needed·Dispute risk across this case·Case history·Buyer messages·Your reply·Pick a way to resolve·Translation (Korean)) — 시안 `<b>`를 앱은 제목 역할(h2/h3) 안의 `<b>`로 둔다. 화면 읽기 탐색용 제목이라 남긴다.
- **TOP-05 (제안)**: `img|Dispute`·`span|Less` cursor pointer ↔ auto, 앱에만 `link|Dispute` — 앱 로고는 홈 링크(동작)라 남긴다. 같은 이유로 `link|Skip to content`(건너뛰기 링크, 접근성).
- **DATA-01 확장 (제안)**: 상세 머리 `span|· PP-R-GMS-10197661` — DATA-01과 같은 PP-R 보조 글(머리 줄 끝).
- **BTN-01 (제안)**: `button|← All products overview` width 4.8px — 시안 런타임의 sc-interp flex 항목 gap (위 남은 문제).
- 도구: all-products__1038 상태 정의의 `PP-R-MBJ-10197650` → `PP-R-ZOK-10200237` 갱신 필요.
