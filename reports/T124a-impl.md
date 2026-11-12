# T124a 보고 (2026-11-12 21:58)

- 기준 SPEC: v2.16 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서 커밋 — 구현은 `c7c0f14`, `26187c7`)
- 입력: `reports/design-match/v6/round2/{initial,knit-cardigan,1047,show-history}/styles.md` + png. **입력 폴더는 커밋하지 않았다.**

## 결과
일부 완료 — 범위(위쪽 막대·상품 칩 줄·왼쪽 목록·이번 주 카드)의 "설명 없음" 스타일 줄은 원인을 하나로 찾아 고쳤다. 개발 서버 금지라 도구를 다시 돌려 0개인지 **확인하지 못했다** (컨트롤 타워가 round3로 다시 돌려 확인해야 한다). 데이터·접근성·동작 때문에 남는 줄은 아래 "예외 줄 제안"에 적었다.

### 원인 (이 범위 대부분의 줄)
시안 런타임(`support.js` `ye()`)은 `{{…}}` 글자를 **`<span class="sc-interp">` 안쪽 span**으로 그린다. 도구(`page-scripts.ts` CAPTURE)는 "자기 글자 노드를 가진 요소"로 짝을 짓기 때문에, 시안에서는 그 안쪽 span(장식 없음: padding 0·배경 없음·radius 0·margin 0·inline 높이)과, 앱에서는 알약 span 자체(padding·배경·radius)가 짝이 된다. 그래서 "for PayPal sellers"·배지 1·2·범주 칩·91% · High·A buyer is waiting(margin)·날짜 줄(height 19.5↔15) 같은 줄이 생겼다. 앱 겉 요소의 CSS는 이미 시안 값과 같았다 (스크린샷도 같은 알약).
→ 고친 방법: 시안처럼 **글자를 안쪽 `<span>`에 넣었다** (겉 요소 CSS는 그대로).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_shared/top-bar.tsx` | "for PayPal sellers"·날짜 줄 글자를 안쪽 span으로. 로고 "Dispute"는 시안 L123처럼 role=img 알약의 글자 그대로(감싸는 span 제거 — role=img라 읽히는 이름은 aria-label 그대로) |
| `src/app/_shared/product-icon.tsx` | 상품 칩 숫자 배지 글자를 안쪽 span으로 (배지는 이 파일에서만 그려져 지시서 파일 목록 밖이지만 한 줄 수정. `badge`를 쓰는 곳은 `product-filter.tsx` 하나) |
| `src/app/today/product-filter.tsx` | 칩 이름·칩 아래 글·"N products · … open cases" 글자를 안쪽 span으로 (시안 L135·L138) |
| `src/app/today/today-groups.tsx` | 묶음 머리(제목·"(N)"의 N·hint), 항목 줄(#번호·"· 상품"·범주 칩·Reply by·구매자·위험 % 칩) 글자를 안쪽 span으로 (시안 L161·L166-168) |
| `src/app/today/today-list.tsx` | 이번 주 카드 제목·부제·칸 이름·값·아래 글을 안쪽 span으로 (시안 L147·L151-153) |
| `src/app/(app)/desk.css` | ① `.dk .today-items .it{border-top:1px solid #F1EFEA}` — 시안 .it는 .sech 다음 형제라 `:first-child`가 안 맞아 **첫 줄에도** 위 선이 있다(styles.md `button\|#1042` border-top). 앱은 `<li>`로 감싸 늘 first-child라 다시 준다 (기존 `li+li` 규칙 대체) ② `.dk .it .today-pill-high` 회색 — v6 L852 `catSt`는 늘 `#ECEEF0/#3F4144` (v4의 high 빨강 규칙이 남아 있었다) ③ 배지 `line-height:1.5` (시안 badgeSt에 line-height 없음 → .dk 1.5 물려받음, `span\|2` line-height 16.5px) ④ `.dk .ai-pill{border-radius:1000px}` (시안 `.ai` 1000px, 앱 999px — `span\|AI` 줄) |
| `tests/unit/app-t076·t102·t106·t122b·today.test.ts` | 마크업 문자열 단언만 안쪽 span에 맞게 고침 (값·조건은 그대로) |

동작·관문·Simulated·쓰기 0·데이터 무변경. 렌더 루프·조건부 위치 변경 없음 (span을 같은 자리에서 감싸기만).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (9 skipped) | 0 | |
| npm test | 2752 | 1 | `storefront.test.ts` 결정론 100회 5초 시간 초과 — 기계 부하(load average 52~63, 다른 세션 동시 실행). `--testTimeout=60000`으로 따로 돌리면 31/31 통과. 이 작업은 엔진·storefront를 건드리지 않았다. 앞선 실행에서는 `sim.test.ts` 성능(50ms)·결정론도 같은 이유로 가끔 실패 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 0 errors | 0 | 기존 경고 5개 그대로 |
| npm run build | 통과 | 0 | |

## 남은 문제
- **도구로 다시 확인 못 함** (개발 서버 금지). round3에서 확인 필요. 예상: 위 칩·알약·margin·line-height·border-top·cursor 이외 스타일 줄이 사라지고, 위치(x·y·height) 줄은 아래 데이터 차이(앱 줄의 Demo data 배지·PP-R 보조 줄)만큼 남는다.
- 1047 상태 `button\|#1042` background `#F5F7FB`(앱) ↔ 흰색(시안): 앱 `.it:hover` 색 — 도구가 #1047을 누른 뒤 마우스가 남은 자리에 레이아웃이 달라 #1042가 hover된 것으로 보인다(스타일 규칙은 시안 L39와 같다). 위치 차이가 줄면 같이 사라질 것.
- `span\|Knit Cardigan#2` color·font-weight, `span\|2#2` cursor, `span\|3` font-size 등은 데이터가 달라 다른 요소끼리 짝지어진 줄(아래 데이터 차이)이다.

## 예외 줄 제안 (exceptions.json은 컨트롤 타워가)
| 근거 DECISIONS 줄 | 매칭할 요소 · 항목 | 이유 |
|---|---|---|
| 2026-11-11 22:55 v2.15 "예외: 데이터(엔진 숫자, 실제 시드·샌드박스 …)" + 2026-11-12 20:35 v2.16 ④·20:40 "PayPal 값 실제" | 상품 칩 `span\|120 units · 1 case`/`2 cases`, `span\|150 units · No cases`/`1 case`, `span\|4 products · 375 units · 3 open cases`/`7 open cases`, `button\|Beanie + Scarf Set`/`Beanie + Scarf`, 배지 `span\|1`·`span\|2`의 x(칩 위치), `button\|Knit Cardigan` width | 칩 개수 = done이 아닌 실제 분쟁 항목 수(T106 F1-22 결정), 상품 이름은 시드 값. 시안 사본은 다른 개수(7건)를 센다 |
| 같은 줄 + 20:40 "Assumption·Demo data·Simulated 유지", T122e(#1042/#1047 표시 번호 + PP-R 보조 줄) | 목록 `button\|#1042`·`#1047` height·y와 그 아래 모든 y, `span\|buyer_m · US` width, `span\|Seo-yeon Kim · KR` y | 앱 줄에는 Demo data 배지·"PP-R-…" 보조 줄이 더 있다 (정직성 예외) |
| WEEK-01 (이미 있음: 11/11 22:55·20:35 ④·20:40 성과 숫자) — **매칭 넓히기** | `span\|3`·`span\|4`·`span\|$68` 등 이번 주 카드 값과 그 값으로 잘못 짝지어진 줄(font-size·letter-spacing·line-height), 칸 이름·아래 글 문구 | 지금 WEEK-01은 "시안에만 span\|4"만 덮는다. 앱 값이 다른 글자라 다른 요소와 짝지어진 줄도 같은 이유 |
| (새 예외 필요 — 근거 DECISIONS 줄 없음, 결정 요청) | 앱에만 `heading\|Today`(sr-only h1), `heading\|DisputeLess this week`, `heading\|Reply needed` 등 묶음 제목 h2, `link\|Skip to content`, 목록 `.today-sr-only` 상태 글(`span\|Seo-yeon · customs hold · High` 등) | 접근성(제목 구조·건너뛰기 링크·화면 읽기 상태 글). 시안은 `<b>`라 역할 없음. 글자는 이제 안쪽 span으로 시안과 짝이 맞고, 남는 것은 역할 줄뿐 |
| (새 예외 필요 — 결정 요청) | `img\|Dispute`·`span\|Less` cursor pointer↔auto, 앱에만 `link\|Dispute` | 앱 로고는 홈 링크(동작). 시안 로고는 링크 아님 |

## 컨트롤 타워에 요청할 결정
- 위 표의 마지막 두 줄(접근성 역할, 로고 링크)을 예외로 둘지, 아니면 시안처럼 바꿀지(h2 → b, 로고 링크 제거). 동작·접근성 변경이라 이 작업에서는 하지 않았다.
- `product-icon.tsx`(지시서 파일 목록 밖, `_shared`) 한 줄을 고쳤다 — 배지가 이 파일에서만 그려지기 때문. 문제 있으면 알려 달라.
