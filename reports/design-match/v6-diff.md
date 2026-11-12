# 시안 v4 → v6 차이 목록 (Desk)

- 기준: 옛 `docs/design/mockup-v4/Desk.dc.html` (859줄) → 새 `docs/design/mockup-v6/Desk.dc.html` (1074줄). `diff` 전체를 읽고 두 파일을 확인해 정리했다.
- 줄 번호 표기: `v4:줄 / v6:줄`. `~`는 블록 시작 줄.
- 결정 근거: DECISIONS.md 2026-11-12 v2.16 (경희 20:40). "예외 후보" 열은 그 결정의 예외(성과 숫자는 엔진·실제만, Send 이후 예외, 서연 AI 초안 금지어/칩, PayPal 값 실제, Assumption·Demo data·Simulated)가 걸릴 수 있는 행에 적었다. 비어 있으면 해당 없음.
- "구현 상태" 열은 구현자가 채운다(빈칸 0이어야 끝).
- v4와 v6에서 **같은** 것(위쪽 바, 상품 칩 모양, 이번 주 카드, 사건 서연 상세의 선택지 카드·예상 반응 막대·곡선·타임라인, 토스트 모양, 모든 키프레임)은 아래에서 "변경 없음"으로만 명시한다.

---

## A. CSS 블록 규칙 (helmet style)

v4 CSS는 v6 CSS의 부분집합이다. 삭제·변경된 규칙은 없고 아래 22줄이 추가됐다(v4:48 뒤 / v6:49~70).

| id | 변경 내용 (옛 → 새) | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-A1 | 추가 `.tg`(v6:49): AI 스위치 알약. inline-flex, gap 10, padding 6/6/6/14, radius 1000, 배경 #0A1B3D, 글자 14px/700 흰색, 그림자 `rgba(10,27,61,.25) 0 4px 12px`. `.tg:hover` 배경 #13284F | "" | |
| V6-A2 | 추가 `.tg-tr`(v6:49): 스위치 트랙 44×26, radius 1000, 배경 #4A5878, `transition: background .2s ease` | "" | |
| V6-A3 | 추가 `.tg-kn`(v6:49): 손잡이 20×20 원, 위치 top3/left3, 흰색, 그림자 `rgba(0,0,0,.25) 0 1px 3px`, `transition: left .2s ease` | "" | |
| V6-A4 | 추가 `.tg.on .tg-tr` 배경 #0070E0, `.tg.on .tg-kn` left 21px (v6:49) | "" | 색 #0070E0은 PayPal 파랑 계열. 6.11 결정(우리 강조색 남보라로 치환) 적용 여부 구현자가 판단 |
| V6-A5 | 추가 `.zone-buyer .chip`(inset 1px #CFD3D8 테두리), `.zone-buyer .c-n`(흰 배경·#3F4144), `.zone-buyer .c-bad`(흰 배경·#9E2414·테두리 #F2B8AF), `.zone-buyer .c-blue`(흰 배경·#002991·테두리 #B9D9F7) (v6:50) | "" | |
| V6-A6 | 추가 `.ov-k`(v6:51): 요약 카드. flex 1 1 0, min-width 150, radius 16, 테두리 #E4E6E9, 흰 배경, padding 12/14, 세로 flex gap 2 | "" | |
| V6-A7 | 추가 `.ag`(v6:52): 표 바깥. 테두리 #DDE2EB, radius 12, overflow hidden, 흰 배경, 14px | "" | AG Grid(스폰서상): 래퍼 공용 |
| V6-A8 | 추가 `.ag-h`(v6:53): 머리행. grid, 배경 #F8F9FB, 아래 테두리 #DDE2EB | "" | |
| V6-A9 | 추가 `.ag-hc`(v6:54): 머리 칸 버튼. 12px/700 #3F4144, padding 10/14, 오른쪽 테두리 #EBEEF2, 투명 배경, nowrap, 좌측 정렬. `:last-child`(v6:55) 오른쪽 테두리 없음. `:hover`(v6:56) #EEF2F7. `.on`(v6:57) 색 #002991. `.num`(v6:58) 오른쪽 정렬 | "" | |
| V6-A10 | 추가 `.ag-ind`(v6:59): 정렬 화살표 칸, 11px #002991 폭 10 | "" | |
| V6-A11 | 추가 `.ag-r`(v6:60): 본문 행 버튼. grid, 최소 높이 52, 흰 배경, 아래 테두리 #EEF0F3, cursor pointer. `:last-child`(v6:61) 테두리 없음. `:hover`(v6:62) #F3F7FF. `.hi`(v6:63) 배경 #FFF7F6, `.hi:hover`(v6:64) #FDEFED. `.dn`(v6:65) 글자 #9AA0A6 | "" | |
| V6-A12 | 추가 `.ag-c`(v6:66): 셀. padding 8/14, 줄임표, nowrap, flex 가운데 gap 8. `.ag-c.num`(v6:67) 오른쪽 정렬+tabular-nums | "" | |
| V6-A13 | 추가 `.ag-f`(v6:68): 표 꼬리. 12px #6C7378, 배경 #F8F9FB, 위 테두리 #DDE2EB, 좌우 양끝 정렬 | "" | |
| V6-A14 | 추가 `.ag-tag`(v6:69): "AG Grid" 꼬리표 알약. 배경 #F1F3F6, 12px/700 #3F4144, padding 4/10 | "" | AG Grid 꼬리표 유지(결정 5) |
| V6-A15 | 변경 없음 확인: `.ai`, `.chip`, `.c-bad`, `.c-n`, `.bub-*`, `.zone-work`, `.stp`, `.tray`, `.editor`, `.toast`, `.pf`, `.ptile` 등 v4 규칙은 v6에서 글자 그대로 동일(diff에 안 나옴) | "" | |

---

## B. 레이아웃·템플릿 (영역별)

### B1. 위쪽 바
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B1 | 로고 SVG 그라디언트 id만 `dlg-skdchtml` → `dlg-_tplhtml`(v4:101 / v6:123). 화면에는 차이 없음(무시 가능) | "" | |
| V6-B2 | 그 밖의 위쪽 바(메뉴·언어 전환·공개 데모 표시 자리) 변경 없음 | "" | |

### B2. 상품 칩 (제품 필터)
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B3 | 칩 마크업·스타일 변경 없음. 칩의 `pick`이 `setState({sku})`(v4:688) → `this.pickProduct(p.sku)`(v6:836)로 바뀜. 동작은 E 섹션 | "" | |
| V6-B4 | 처음 선택 상품 칩: `sku:'all'`(v4:632) → `sku:'sweater'`(v6:772). 처음 열면 "All products" 칩이 아니라 첫 상품 칩이 눌린 상태 | "" | |
| V6-B5 | 칩 배지 숫자(`nCase`: reply+routine 건수)·부제 계산식은 동일. 단 ITEMS 변경(D3) 때문에 sweater 배지가 reply 2건(서연+bm)으로 달라진다 | "" | 값은 엔진·실제 목록에서 |

### B3. 왼쪽 목록
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B6 | 목록 줄 둘째 줄: `<span>{{it.who}}</span>`(v4:146) → flex 행(gap 8): 왼쪽 `who`(12px #6C7378, flex 1, 줄임표) + 오른쪽 위험 % 칩 `<span style="{{it.riskSt}}" title="{{v.riskTip}}">{{it.riskTxt}}</span>`(v6:168) | "" | 칩 값은 엔진(RISKP는 시안 임시값, D2) |
| V6-B7 | 위험 칩 스타일(`it.riskSt`, v6:857~858): padding 2/8, radius 1000, 12px/900, nowrap, tabular-nums. high(≥45) 배경 #FBE7E4 글자 #9E2414, med(20~44) 배경 #E3F3FF 글자 #002991, low(<20) 배경 #ECEEF0 글자 #3F4144. 완료 항목은 `display:none` | "" | 파랑 #E3F3FF/#002991은 시안 값 그대로 쓰되 색 치환 규칙 확인 |
| V6-B8 | 칩 글자 `riskTxt` = `{RISKP}% · {높음/중간/낮음 또는 High/Medium/Low}`(v6:857). 툴팁 `riskTip`(C) | "" | |
| V6-B9 | 묶음 이름·힌트 변경: `routine` "Routine"(일상) → "Questions"(단순 문의), 힌트 "Low risk, quick to clear" → "AI answered · just check"(C). 묶음 순서·마크업은 동일 | "" | |
| V6-B10 | 묶음 소속 변경: bm(#1047)이 `routine` → `reply`(D3). 그 결과 Reply needed 묶음 4건(서연·지호·Lena·bm), Questions 묶음은 Yuki 1건 | "" | |
| V6-B11 | 목록 줄의 분류 칩 색(`catSt`)이 항상 회색 `background:#ECEEF0;color:#3F4144`로 통일(v4:704의 high=빨강 규칙 삭제, v6:852). 서연 상세 제목 옆 칩도 `c-bad`→`c-n`(v4:164 / v6:249) | "" | |

### B4. 이번 주 카드
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B12 | 이번 주 DisputeLess 카드(마크업·`DASH0`·`bump`) 변경 없음 | "" | 성과 숫자(막은 분쟁 4·$312·18건)는 DECISIONS상 엔진·실제만. 시안 값 그대로 쓰면 안 됨(기존 결정 유지) |
| V6-B13 | 값 `DASH0={prevented:4,saved:312,drafted:18,reply:14}`는 두 버전 동일(v4:? / v6:766) | "" | 성과 숫자 금지 |

### B5. 전체 현황 화면 (All products overview) — 전부 신규
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B14 | 새 섹션 `sc-if isAll`(v4:156 뒤 / v6:179~229). `isAll = sku==='all' && !sel`. 세로 flex gap 16 | "" | |
| V6-B15 | 제목 줄(v6:182~185): 왼쪽 `h2` "All products"(24px/900, -0.4px) + 부제 `ovS`(14px #3F4144), 오른쪽 `ag-tag`(표 아이콘 SVG 14px + "AG Grid") | "" | AG Grid 꼬리표 유지 |
| V6-B16 | 요약 카드 5개(v6:187~191, `kpis`): 각 카드 `.ov-k`. 위줄 점(8px 원)+라벨 16px/700, 값 26px/900, 보조 13px #6C7378. 카드: Open cases(점 #0B0F14, 보조 "4 products · 375 units"), Reply needed(점 #C4321F, 보조 secHint.reply), Prevent(점 #002991), Questions(점 #9AA0A6, 보조 secHint.routine), Avg. dispute risk(값 %, 점/값 색: 45 이상 #C4321F, 아니면 점 #0070E0·값 #002991, 보조 "Riskiest case · N products") | "" | 값은 실제 목록·엔진. 평균 위험은 RISKP 기반(D2), "4 products · 375 units"는 하드코드(`prodSum(4,375,…)`) → Demo data 후보 |
| V6-B17 | 표 1 "Products"(v6:193~211): 제목 `gP`(16px/700)+보조 `gPHint · gHint`(12px). `.ag role=grid` | "" | |
| V6-B18 | 표 1 머리(v6:196): `.ag-h`에 `pCols` grid-template-columns `minmax(170px,2fr) 104px 112px 84px 92px minmax(132px,1.2fr) minmax(160px,1.5fr)`. 7칸: Product / Open cases(num) / Reply needed(num) / Prevent(num) / Questions(num) / Dispute risk / Riskiest case. 각 칸 `button.ag-hc`, `aria-sort`, 정렬 화살표 `.ag-ind` | "" | |
| V6-B19 | 표 1 행(v6:197~210, `pRows`): 버튼 `.ag-r`(위험 45 이상이면 `.hi`). 칸1 상품 타일 32×32(`ptile`+아이콘 SVG 20px 선 #002991 1.6)+상품명(14px bold)+장수(12px #6C7378). 칸2~5 숫자: Open(bold), Reply(0 초과면 빨간 알약 `min-width 24; padding 1/8; #FBE7E4/#9E2414; 900`, 0이면 #9AA0A6), Prevent, Questions. 칸6 위험 막대(56×6, 배경 #E9ECF0, 채움 폭 `max(p,2)%`, 색 45↑ #C4321F/20↑ #0070E0/그 외 #9AA0A6)+`p%`(14px/900, 45↑ #C4321F, 0 #9AA0A6, 그 외 #0B0F14). 칸7 가장 위험한 건: "Order #…"(13px bold)+분류명(12px #6C7378) | "" | 상품 장수는 `PRODS.units`. 값 실제 |
| V6-B20 | 표 1 행 구성: 상품 4개(sweater·cardigan·beanie·scarf 등 `PRODS`)+"Several products"(여러 상품 묶음, 부제 "Prevention tasks", `ICON.multi`). 열린 건수 0이면 위험 0·"—"·"No open cases" | "" | |
| V6-B21 | 표 1 꼬리(v6:209): 왼쪽 "N rows", 오른쪽 "Sorted by {열} ↓/↑" (`ag-f`) | "" | |
| V6-B22 | 표 2 "Cases by risk"(v6:213~228, `cRows`): 제목 `gC`+`gHint`. 머리 6칸 `cCols`=`132px minmax(150px,1.5fr) minmax(170px,1.5fr) 128px minmax(120px,1.1fr) 120px`: Dispute risk / Case / Dispute type / Status / Buyer / Due | "" | |
| V6-B23 | 표 2 행: 칸1 위험 막대+% (표1과 같은 `riskCells`). 칸2 주문번호(14px bold tabular)+상품명(12px #6C7378). 칸3 분류 칩(`chip`+`catSt` 회색). 칸4 상태 알약(Reply needed #FBE7E4/#9E2414, Prevent #E3F3FF/#002991, Questions #ECEEF0/#3F4144, Done today #F1F3F6/#9AA0A6, 12px/700). 칸5 구매자(13px #3F4144). 칸6 기한("Due Nov 12" 형식, `v.due(fmtD())`, 없으면 "—"). 완료 행 `.dn`, 위험 45 이상 `.hi`. 위험 0(완료)이면 막대는 폭 2% | "" | 기한은 실제 마감(서연 11/30은 DECISIONS 11/11). 시안 `due:[0,12]`는 시안 값이라 실제 마감과 대조 필요 |
| V6-B24 | 표 2 꼬리(v6:227): "7 rows"/"Sorted by … ↓" | "" | |
| V6-B25 | 정렬 규칙(`sortHead`, v6:~873): 머리 클릭 → 같은 열이면 방향 반전, 다른 열이면 기본 방향(숫자 열·risk는 내림차순, 그 외 오름차순). 초기: 표1·표2 모두 `risk` 내림차순. 표1 7번째 열은 `topk`(주문번호) 기준. 현재 열 `.on`(#002991)+`↓/↑`, `aria-sort` | "" | |
| V6-B26 | 행 클릭: 표1 상품 행 → `pickProduct(sku)`(상품 칩 선택+첫 항목 열기), "Several products" 행 → 그 묶음 최고 위험 항목 열기. 표2 행 → `sel=id` (sku는 그대로 'all' → "← All products overview" 뒤로가기 버튼이 보임). 고른 행의 별도 `.hi` 강조는 위험 45 이상 행만(v6에는 "선택 행 강조" 별도 클래스 없음, 행 클릭 시 상세로 전환) | "" | 결정문에 "고른 행 강조"가 있으나 v6 파일에는 위험 45↑ `.hi`뿐. 구현자는 v6 파일 기준으로 |
| V6-B27 | 뒤로가기 버튼(v6:231): `showBack = sku==='all' && !!sel`일 때 `← All products overview`(`btn b-tint b-sm`, 왼쪽 정렬) → `sel=null`로 개요 복귀 | "" | |

### B6. 빈 상품 화면 — 신규
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B28 | 새 섹션 `sc-if isEmpty`(v6:234~241): 열린 항목 없는 상품 선택 시. 점선 테두리 `1px dashed #CFD3D8`, radius 24, 배경 #F6F7F9, 최소 높이 460, 가운데 정렬. 72×72 타일(radius 24, 흰 배경, 상자 SVG 36px)+`h2` "No disputes yet"(22px/900)+문단 `{상품} has no open disputes or questions. DisputeLess will keep watching new orders.`(15px, 최대 폭 420) | "" | |

### B7. 사건 상세 (서연 #1042)
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B29 | 제목 칩 `c-bad`(v4:164) → `c-n`(v6:249) (빨강 → 회색) | "" | |
| V6-B30 | 구매자 대화 말풍선 보조줄(v4:229 / v6:314): `{{m.sub}}`만 → `hasTr`이면 `<b color #0070E0>Translated</b> · ` 접두 + `m.sub`. 데이터 `sub` 값은 "번역 라벨 + en + d" → "en + d"로 바뀜(v4:759 / v6:962). 보낸 말풍선·Simulated 말풍선은 `hasTr:false` | "" | Simulated 표기 유지 |
| V6-B31 | 위험 박스(v4:301 / v6:393): 열 폭 `140px` → `200px`(v4:295 / v6:392). 오른쪽 칸 구성 변경: v4 "다음 반응(moodNext) 라벨 / mood 22px / moodNow 11px" → v6 "Dispute risk(riskT, 12px/700) / `89%`(취소선 16px/700 #9AA0A6) → 화살표 → 새 값(30px/900, 45% 이상 #C4321F 아니면 #002991, color 전환 .3s) / "{moodNext} · {mood 12px}"". 값 `rFrom`=`'89%'` 고정, `rTo`=빈 답장이면 89 아니면 `round(fc.p.cb*100)`% | "" | `rFrom '89%'`는 시안 고정값 → 엔진의 무응답 위험으로(결정 1 "if no reply by {date}"). Assumption 배지 |
| V6-B32 | 답장 편집 영역 배치(v4:261~295 → v6:353~392): v4는 좌 `editor`+우 `tray`+그 옆/아래 한국어 박스(`showKo` 별도 칸, radius 18, 배경 #F6F7F9, padding 12/14). v6는 `showKo` 박스를 `editor` 안쪽 하단으로(v6:366, 배경 #F6F7F9, 위 테두리 #E4E6E9, padding 10/14/12), `tray`에 `border:1px solid #E4E6E9; border-radius:18px; align-self:stretch; min-width:0` 추가(v6:368), 별도 칸 삭제 | "" | |
| V6-B33 | `draftGrid`(v4:836 / v6:1050): 영어만 2열·한국어 1열 → 항상 `repeat(2,minmax(0,1fr))` + `align-items:start` | "" | |
| V6-B34 | 나머지 서연 상세(선택지 3칸 카드 `paths`, 단계 레일 `nstep`, 점검 줄 `nlint`, 예상 반응 막대, 위험 곡선, 시간선, 보낸 뒤 결과)는 변경 없음 | "" | 보낸 뒤 예외(자동 없음·Forward 승인·POST 줄 없음·환불 약속 없음·통관번호 가림·"What happens next · Simulated") 전부 유지 |

### B8. "✦ AI Respond now" 스위치 / 답장 카드 분기 — 신규
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B35 | 답장 영역을 두 갈래로: `showSimple = !sent && !aiOn` (v6:323~329), `showAi = !sent && aiOn` (v6:330~). v4는 `notSent` 하나(v4:238) | "" | |
| V6-B36 | 스위치 버튼(v6:325, 332 두 곳에 동일): `button.tg` role=switch aria-checked=`aiOn` → 안: `AI` 알약(`.ai`, box-shadow none, 반짝 SVG 12px)+텍스트 `workT`("AI Respond now")+`tg-tr/tg-kn`. 켜면 `.tg.on`(트랙 #0070E0, 손잡이 오른쪽 21px) | "" | |
| V6-B37 | 꺼짐 상태 카드(v6:324~329, 단순 답장): 흰 카드, radius 24, 테두리 #E4E6E9, padding 18/20, 그림자 `rgba(0,0,0,.04) 0 2px 8px`. 윗줄 제목 `replyT`("Your reply", 18px bold) + 스위치. 본문 `textarea` rows 4(radius 16, 테두리 #CFD3D8, padding 14/16, 15px, 줄간격 1.5), placeholder "Write a reply…". 아랫줄: 힌트 "Write in any language. It is translated for the buyer when you send."(12px #6C7378) + `Send` 검정 버튼(`disabled = busy || 빈 글`) | "" | 안전장치(검사·Translate & check·Simulated) 유지. 이 단순 카드의 Send도 `send()`의 `blocked()` 검사를 그대로 통과해야 함 |
| V6-B38 | 켜짐 상태 카드(v6:330~) = v4의 `zone-work` 카드(v4:238~)와 같은 틀이나 머리줄이 바뀜: v4 `[AI 알약][workT 18px bold][workS 13px]`(v4:240) → v6 `[replyT 18px bold("Your reply")][workS 13px]`가 왼쪽, 오른쪽에 스위치(v6:332). 카드 aria-label은 `workT` 그대로 | "" | |
| V6-B39 | 켜짐 상태의 단계 1("Ways to respond" 선택지 3칸)·단계 2는 v4와 같은 마크업. 단계 2 라벨 `replyT`("Your reply") → `writeT`("Write and check")(v4:261 / v6:353) | "" | |
| V6-B40 | Send 버튼 라벨: 켜짐 상태 `sendLabel=v.send`(v4 "Send in Korean"/"보내기" → v6 "Send"/"보내기"). 위치(v6:397)는 동일 | "" | |

### B9. 답장 상자 / 점검 / 한국어 박스
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B41 | 한국어 번역 박스 제목 `sheSees` "She'll see (Korean)" → "Translation (Korean)"(C). 박스는 editor 안쪽 하단(B32) | "" | Translate & check, Simulated 유지 |
| V6-B42 | 점검 트레이: 테두리·radius 추가(B32). 칩/줄 마크업은 동일 | "" | |

### B10. 보낸 뒤 (after-Send)
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B43 | 단계 `steps`, 보낸 뒤 결과, 타임라인, `cbDone` 부분 마크업·문구 변경 없음 (v4:? 구간은 diff에 안 나옴). 다만 보낸 말풍선 라벨 문구 변경(C: `sentKo`, `sentAuto`) | "" | 예외: Auto 없음·Forward 승인·POST 줄 없음·환불 약속 없음·통관번호 가림·"What happens next · Simulated" |
| V6-B44 | 보낸 말풍선 데이터에 `hasTr:false` 추가(v6:965), Simulated 말풍선도 `hasTr:false`(v6:970) | "" | Simulated |

### B11. 한 장 카드 상세 (지호 #1038 / Lena #1029 / Yuki #1051 + trk·kc·bm)
v4는 `isOther`일 때 "AI 알약 + 제목/본문 + 버튼" 3칸이 전부였다(v4:350~355). v6는 같은 `isOther` 블록을 아래처럼 확장한다(v6:443~478). 대상은 `v.ai`에 항목이 있는 jiho, lena, yuki, bm, trk, kc 전부.

| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B45 | 구매자 대화 섹션 신규(v6:443~449, `oc.hasMsg`): `.zone-buyer`(`convT` 제목 16px bold + 언어 이름 12px). 말풍선 `bub-in`: 원문(15px, `lang` 속성) + 번역이 있으면 줄 "Translated · …"(13px #3F4144, 라벨 #0070E0). 아래 줄: "AI read"(11px/900 #002991) + 태그 칩 2개(첫 칩은 `tone`이 bad일 때 `c-bad`, 그 외 `c-n`) | T122c 구현함 (`one-card.tsx` `OneCardBuyer`). 지호·Mike = 실제 PayPal 글(번역 줄은 EN 화면만), Lena·Yuki = 시안 문장 + Demo data 배지. AI read 칩은 데모 항목만 — 실제 사건은 판정 태그가 없어 줄 없음(예외: 있는 판정만) | Demo data: 구매자 메시지 원문은 시안 값. 실제 시드·샌드박스 대화와 대조 |
| V6-B46 | 윗부분(v6:451~454): 가로 flex 양끝(wrap). 왼쪽 세로(gap 6): `AI` 알약(align-self flex-start) / 제목 20px bold / 본문 15px #3F4144. 오른쪽(`oc.hasKeep`일 때): "Keeps ≈$N" 알약(padding 6/12, radius 1000, 배경 #E3F3FF, 글자 #002991 13px/900, `flex-shrink:0`). v4는 [알약][제목·본문][버튼] 세로 3줄 | T122c 구현함. Keeps = 엔진 `actionSavings`(지호, AC35 repair $34 · 색상 offer 값) / `trackingSavings`(추적). Lena·Yuki·Mike는 엔진 값이 없어 알약 없음 (예외: 성과 숫자 엔진만) | "Keeps ≈$N" 숫자는 엔진·실제. 시안 `save`(41·8·120·72·35)는 Demo data/Assumption |
| V6-B47 | "How AI handled this" 단계 목록 신규(v6:455~460): 제목 16px bold + 보조 "DisputeLess did each step. You only approve."(12px). 각 단계: 24×24 원 번호(배경 #0A1B3D, 흰 글자 12px/900)+문장 14px 줄간격 1.5. 항목별 단계 수: jiho 4, lena 4, yuki 4, bm 4, trk 4, kc 3 | T122c 구현함. 지호 4(repair·offer 문장 틀, 금액 = 엔진 기대 손실, 30일·5주 = 시드), Lena 4, Yuki 4(4번 "자동 답변" → "확인 전 보내지 않음", Auto 없음 예외), 추적 4, Mike 3(코드 판정, 증빙 단계 없음). kc는 이 화면에 항목 없음 | 문장 속 수치(≈$7, $48, 64cm 등)는 Demo data. 환불 약속 문구 없는지 확인 |
| V6-B48 | 표 블록 신규(v6:461~466, `oc.hasRows`, trk·kc만): `.ag` 표. 머리 `ag-hc`(cursor default)와 행 `ag-r`(cursor default, min-height 44, 셀 13px) 고정. trk 4열 `90px 90px 130px 1fr`(Order/Country/Carrier/Tracking number) 5행, kc 3열 `90px 1fr 1fr`(Order/Buyer/Product) 3행 | T122c 구현함 (`.oc-ag`, 머리·행 cursor default, 행 44px, 셀 13px). 추적 표 = 실제 미등록 주문 3열(주문·구매자·상품, 90px 1fr 1fr) — 시안의 나라·택배사·추적번호는 실제 값에 없어 뺌(예외: 데이터 실제), 분쟁 걸린 주문은 회색 줄. kc 표 없음 | 추적번호는 Demo data |
| V6-B49 | 보낼 메시지 신규(v6:467~473, `oc.hasDraft`): 제목 `draftT`("What the buyer will receive (Korean)", 보냈거나 자동 발송이면 "Sent to the buyer (…)", 14px #3F4144) + 상자(radius 18, padding 14/16). 보내기 전: 배경 #F3F7FF + 테두리 #CFE0FA, 보낸 뒤/자동: 배경 #002991 + 흰 글자. 원문 15px 줄간격 1.6 + 번역 있으면 구분선 `1px rgba(127,140,170,.35)` 아래 13px, 투명도 .86, "Translated"(보내기 전 #0070E0 / 보낸 뒤 #9FD8FF) | T122c 구현함. 지호 = 서버가 검사한 전송본(`view.outgoing`) + 영어 역번역(EN 화면만), 없으면 상자 대신 알림. Lena·Yuki = 시안 문장(Demo data). 보낸 뒤(가짜 포함) #002991 상자 + "Sent to the buyer (L)" + Translated #9FD8FF | Simulated(공개 모드). 서연 AI 초안 금지어("Expected delivery", "refund in full")는 서연 한정 |
| V6-B50 | "On approval" 줄 신규(v6:474~476): 위 `border-top 1px #E4E6E9`. 왼쪽 라벨(`apiT` "On approval", 자동이면 "Already sent", 12px bold)+`code` 호출 이름(monospace 12px, 배경 #F1F3F6, radius 8, padding 3/8). 오른쪽 실행 버튼 `btn b-black`(`oc.a`/`oc.done`) | T122c 구현함. 지호 repair = send-message / 색상 offer = make-offer, Lena = refund 호출 이름 + "Simulated · no money moved"(호출 없음), 추적 = 실제 `POST /v2/checkout/orders/{id}/track · N orders`(시안 trackers-batch는 실제 호출 아님), Yuki = "Simulated · not sent". Mike·Prevent는 실행 없음 → 줄 없음 | 호출 이름은 실제만(수선=`POST /v1/customer/disputes/{id}/send-message`, 제안=make-offer). 공개 모드 Simulated. v4 시안에는 POST 줄이 없었음 → 서연 보낸 뒤에는 "POST 줄 없음" 예외 유지 |
| V6-B51 | 버튼 위치: 단독 `div` 안 `btn b-black`(v4:354) → "On approval" 줄 오른쪽(v6:476). 라벨 `oc.a`는 jiho "Send", kc "Send" 등(C) | T122c 구현함 (On approval 줄 오른쪽 `btn b-black` + 전송 모드 표시) | |
| V6-B52 | 빈 데이터 방어: `v.ai[sel]`이 없는 항목(서연 `seo`)은 `hasMsg/steps/hasRows/hasDraft` 모두 false이므로 서연 상세는 영향 없음 | T122c 구현함 — 서연 상세 영향 없음 (case-detail 분기는 `jihoBranch` repair/offer만) | |

### B12. 토스트
| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-B53 | 토스트 마크업·`toastDash` 문구("Dashboard updated · +$N kept") 변경 없음. 지속 시간 3000ms도 동일 | "" | 성과 숫자 |

---

## C. 문구 변경 (DI.en / DI.ko)

| id | 키 | 옛(v4) → 새(v6) | 구현 상태 | 예외 후보 |
|---|---|---|---|---|
| V6-C1 | en `secs.routine` | "Routine" → "Questions" (v4:377 / v6:507) | "" | |
| V6-C2 | ko `secs.routine` | "일상" → "단순 문의" (v4:476 / v6:614) | "" | |
| V6-C3 | en `secHint.routine` | "Low risk, quick to clear" → "AI answered · just check" (v4:378 / v6:508) | "" | |
| V6-C4 | ko `secHint.routine` | "위험 낮음 · 빠르게 처리" → "AI가 답했어요 · 확인만" (v4:477 / v6:615) | "" | |
| V6-C5 | en `cats` | `quality: 'Not as described · Quality'` 추가 (v4:380 / v6:510) | "" | |
| V6-C6 | ko `cats` | `quality: '설명과 다름 · 품질'` 추가 (v4:479 / v6:617) | "" | |
| V6-C7 | en `sentKo` | "Sent in Korean" → "Sent · translated" (v4:404 / v6:534) | "" | 보낸 뒤 예외 유지 |
| V6-C8 | en `sentAuto` | "Auto-translated to Korean" → "Sent · auto-translated" (v4:404 / v6:534) | "" | 보낸 뒤 예외: "Auto" 표기 정책 확인(Auto 없음) |
| V6-C9 | en `sheSees` | "She'll see (Korean)" → "Translation (Korean)" (v4:420 / v6:550) | "" | |
| V6-C10 | ko `sheSees` | "" (빈 문자열) → "번역 (한국어)" (v4:515 / v6:653) | "" | |
| V6-C11 | en `send` | "Send in Korean" → "Send" (v4:428 / v6:558) | "" | |
| V6-C12 | ko `send` | "보내기" 그대로(변경 없음). 단, ko `other.jiho.a`·`kc.a` "한국어로 보내기"/"제안 보내기" → "보내기" | "" | |
| V6-C13 | en 신규 `phSimple` | "Write a reply…" (v6:558) | "" | |
| V6-C14 | ko 신규 `phSimple` | "답변하기…" (v6:661) | "" | |
| V6-C15 | en 신규 `simpleHint` | "Write in any language. It is translated for the buyer when you send." (v6:558) | "" | |
| V6-C16 | ko 신규 `simpleHint` | "어떤 언어로 써도 돼요. 보낼 때 구매자 언어로 번역돼요." (v6:661) | "" | |
| V6-C17 | en/ko `workT` | 변경 없음 값 "AI Respond now"/기존 ko 문구(v4와 동일). 사용처가 제목 → 스위치 라벨로 이동(B36) | "" | |
| V6-C18 | en/ko `replyT` | 값 변경 없음("Your reply"/"내 답장"). 사용처가 단계 2 라벨 → 카드 제목으로 이동(B38/B39) | "" | |
| V6-C19 | en 신규 `writeT` | "Write and check" (v6:~504, `kOpen` 줄) | "" | |
| V6-C20 | ko 신규 `writeT` | "쓰고 점검하기" (v6:~611) | "" | |
| V6-C21 | en 신규 `aiT`/`aiS` | "How AI handled this" / "DisputeLess did each step. You only approve." (v6:494) | T122c 구현함 (`card.aiT`/`card.aiS`) | |
| V6-C22 | ko 신규 `aiT`/`aiS` | "AI가 처리한 방법" / "모든 단계를 DisputeLess가 했어요. 판매자는 승인만 하면 돼요." (v6:601) | T122c 구현함 (`card.aiT`/`card.aiS` ko) | |
| V6-C23 | en/ko 신규 `apiT`/`apiAuto` | "On approval"/"Already sent" ; "승인 시 실행"/"이미 보냄" (v6:494 / v6:601) | T122c 구현함 `card.apiT`. `apiAuto`("Already sent")는 안 씀 (Auto 없음 예외) | |
| V6-C24 | en/ko 신규 `lvl` | High/Medium/Low ; 높음/중간/낮음 (v6:494 / v6:601) | "" | 기준 high 45% 이상, med 20~44%, low 20% 미만 |
| V6-C25 | en/ko 신규 `riskTip` | "Dispute risk: chance this becomes a chargeback or dispute. High 45%+, Medium 20–44%, Low under 20%" ; "분쟁 위험: 분쟁·차지백으로 이어질 확률. 높음 45% 이상, 중간 20~44%, 낮음 20% 미만" | "" | |
| V6-C26 | en/ko 신규 `langOf` | {ko:Korean, de:German, ja:Japanese, en:English} ; {한국어, 독일어, 일본어, 영어} | T122c 구현함 (`card.langOf.*`) | 언어 이름 시안 그대로(결정 9) |
| V6-C27 | en/ko 신규 `draftT(l, sent)` | "What the buyer will receive (L)" / "Sent to the buyer (L)" ; "구매자가 받을 메시지 (L)" / "구매자에게 보낸 메시지 (L)" | T122c 구현함 (`card.draftT`/`card.draftSentT`) | |
| V6-C28 | en/ko 신규 `keepT(x)` | "Keeps ≈$x" ; "≈$x 지킴" | T122c 구현함 (`card.keep`, 값은 엔진) | 값은 엔진/Demo data |
| V6-C29 | en/ko 신규 개요 문구 `ovT/ovS/agTag/gP/gC/gHint` | "All products" / "Disputes across everything you sell, sorted by risk" / "AG Grid" / "Products" / "Cases by risk" / "Click a column to sort · click a row to open" ; "전체 상품" / "판매 중인 모든 상품의 분쟁 현황 · 위험도순" / "AG Grid" / "상품별" / "위험도순 케이스" / "열을 누르면 정렬 · 행을 누르면 열기" | "" | |
| V6-C30 | en/ko 신규 카드 라벨 `kOpen/kReply/kPrevent/kRoutine/kTop/kTopSub` | "Open cases"/"Reply needed"/"Prevent"/"Questions"/"Avg. dispute risk"/"Riskiest case · N products" ; "진행 중 케이스"/"답장 필요"/"예방"/"단순 문의"/"평균 분쟁 위험"/"상품 N개의 최고 위험 평균" | "" | |
| V6-C31 | en/ko 신규 `ordNo`, `gPHint` | "Order #…" ; "주문 #…" / "Open cases = disputes, buyer questions and prevention tasks still open" ; "진행 중 케이스 = 아직 끝나지 않은 분쟁·구매자 문의·예방 작업" | "" | |
| V6-C32 | en/ko 신규 열 이름 `colProd/colOpen/colRisk/colTop/cRisk/cCase/cType/cStatus/cBuyer/cDue` | Product/Open cases/Dispute risk/Riskiest case/Dispute risk/Case/Dispute type/Status/Buyer/Due ; 상품/진행 중 케이스/분쟁 위험/위험이 가장 큰 건/분쟁 위험/케이스/분쟁 유형/상태/구매자/기한 | "" | |
| V6-C33 | en/ko 신규 `rows(n)`, `sorted(c,d)` | "N rows" / "Sorted by C ↓|↑" ; "N행" / "C 높은 순 ↓ | 낮은 순 ↑" | "" | |
| V6-C34 | en/ko 신규 `ovNone/ovNoneS/ovPrevOnly/backAll` | "—"/"No open cases"/"Prevention tasks"/"All products overview" ; "—"/"진행 중 케이스 없음"/"예방 작업"/"전체 상품 현황으로" | "" | |
| V6-C35 | en/ko 신규 `emptyT/emptyS(p)` | "No disputes yet" / "{p} has no open disputes or questions. DisputeLess will keep watching new orders." ; "등록된 분쟁이 없어요" / "{p}에는 열린 분쟁이나 문의가 없어요. 새 주문은 DisputeLess가 계속 살펴볼게요." | "" | |
| V6-C36 | en `other.jiho` | t "Offer 15% back ($7.20), she keeps it" → "Offer a free repair, she covers shipping"; b "Lowest-cost option for a color case. AI drafted the message in Korean." → "Past the 30-day return window, so no return. A free repair keeps the sale and fixes her problem."; a "Send offer" → "Send"; done "Offer sent ✓" → "Sent ✓" (v4:457 / v6:587). save 41 유지 | T122c 구현함 (repair 갈래 `card.jiho.repair.t/b`, 30일 = 시드, 버튼 "Send"/"Sent ✓"). save 41 대신 엔진 Keeps. 색상 갈래는 기존 엔진 제목 "Offer 15% back ($7.20)…" | 값: 수선 비용 ≈$7(엔진 repair 값이 없으면 기존 색상 사례 15% $7.20 make-offer 틀 — 결정 7 대체안). 환불 약속 아님 확인 |
| V6-C37 | ko `other.jiho` | t "15%($7.20) 부분 환불 제안, 반품 없음" → "배송비는 구매자 부담, 수선은 무료로 제안"; b "색상 건의 최저 비용 대응이에요. AI가 한국어 메시지를 써 뒀어요." → "반품 기간(30일)이 지나 반품은 안 돼요. 무료 수선으로 판매를 지키고 문제도 해결해요."; a "제안 보내기" → "보내기" (v4:551 / v6:689) | T122c 구현함 (ko 같은 키) | 같음 |
| V6-C38 | en `other.kc.a` | "Send in Korean" → "Send" (v4:460 / v6:590) | T122c 해당 없음 — kc 항목이 이 화면에 없다(목록은 T122b). 공용 버튼 문구 `card.send` "Send" | |
| V6-C39 | ko `other.kc.a` | "한국어로 보내기" → "보내기" (v4:554 / v6:692) | T122c 해당 없음 (C38과 같음, `card.send` "보내기") | |
| V6-C40 | en/ko 신규 `ai` 사전(항목별 steps/msg/draft/api) — jiho | steps 4, msg(한국어 원문 "산 지 5주 정도 됐는데…", 번역, 태그 "Quality issue","Upset"/"품질 문제","속상함"), draft(한국어 "지호 님, 산 지 얼마 안 됐는데…" + 번역), api `POST /v1/customer/disputes/{id}/send-message` (v6:492~498 / v6:599) | T122c 구현함 — 단계는 시안 문장 틀 + 엔진·시드 값, 구매자 글·초안은 실제 분쟁 글·AI 초안(시안 문장 그대로 쓰지 않음, 예외: PayPal 값 실제). 호출 이름 send-message. ko 화면 번역 줄 없음 | 호출 이름 실제만. 공개 모드 Simulated. ko 모드에서 번역(`tr`)은 빈 문자열(원문이 이미 한국어) |
| V6-C41 | `ai` 사전 — lena | steps 4(약속 $24, 11월 6일, C1 약속한 환불 미처리, 돈은 버튼을 눌러야), msg 독일어(번역 포함, 태그 "Asks for refund","Waiting"/"환불 요청","기다리는 중"), draft 독일어("…24 $ über PayPal erstattet…3–5 Werktagen…"), api `POST /v2/payments/captures/{id}/refund · $24` | T122c 구현함 (Demo data, $24·Nov 6 = 시드, Simulated, 실제 환불 호출 없음). 초안 "soeben … erstattet" 문장은 시안 그대로 — 보고서 결정 요청 | $24·11/6은 시드의 실제 약속일 때만. 이미 환불을 보냈다고 쓰는 초안 문장은 "환불 약속" 예외 검토(실제 환불 호출 승인 뒤에만) |
| V6-C42 | `ai` 사전 — yuki | steps 4, msg 일본어("Mサイズの着丈は…"), draft 일본어(M 64cm, 키 160cm 안내), api "Auto-sent · Nov 10, 09:12"/"자동 발송 · 11/10 09:12", `auto:true`(보낸 상태 표시) | T122c 예외 구현 (결정 충돌 ②): "Auto-sent" 대신 [Looks good] 승인 버튼 + "Simulated · not sent", 4단계 "자동 답변" 문장 바꿈 | "Auto-sent" 문구는 DECISIONS 보낸 뒤 예외(Auto 없음)와 충돌 가능 → 구현자 판단. 사이즈표 64cm는 Demo data |
| V6-C43 | `ai` 사전 — bm | steps 4(F1 반복 신고, 90일 내 3번째, 11/4 오후 2:14, 현관 사진), msg 영어(tone bad, 태그 "Asks for refund","3rd claim in 90 days"), draft 영어, api `POST /v1/customer/disputes/{id}/provide-evidence · 3 files` | T122c 부분: Mike 구매자 글 = 실제, 단계 = 코드 판정 3. 증빙 초안·provide-evidence 줄·[Send proof] 없음 (실행 미지원 `src/exec` ENDPOINTS — 실제 호출 이름만) | Demo data. 증빙 파일·사진 실제 여부 |
| V6-C44 | `ai` 사전 — trk | steps 4, `rows` 5행(#1044 US USPS …, #1045 DE DHL …, #1048 JP Japan Post …, #1049 KR EMS …, #1050 GB Royal Mail …), api `POST /v1/shipping/trackers-batch · 5 trackers`/"· 5건" | T122c 구현함 — 실제 미등록 주문·실제 호출 이름으로 (B48·B50) | Demo data |
| V6-C45 | `ai` 사전 — kc | steps 3, `rows` 3행(#1052 Min-ji Lee Wool Sweater, #1053 Hyun-woo Choi Knit Cardigan, #1055 Su-bin Jang Beanie + Scarf), draft 한국어(개인통관고유부호 요청 문구, P로 시작하는 13자리), api "PayPal messages · 3 buyers"/"PayPal 메시지 · 구매자 3명" | T122c 해당 없음 — kc 항목이 이 화면에 없다 (T122b 목록·컨트롤 타워) | 통관번호 가림 예외 확인. Demo data |
| V6-C46 | `thread` 보조줄 라벨 구조 | v4 `sub`에 `Translated · ` 접두 포함 → v6 `sub`에서 접두 제거하고 마크업에서 파란 굵은 `Translated` 별도 표시 (B30). en `tr` "Translated"/ko `tr` 값 자체는 동일 | "" | |
| V6-C47 | ko 신규 `phSimple/simpleHint` 외 위 ko 항목 모두 영문 쌍과 1:1 (`ko`의 `aiT`..`emptyS` 위 표에 병기) | "" | |
| V6-C48 | `riskT`("Dispute risk"), `riskNow`("if no reply by Nov 12"), `riskDraft`("with your draft"), `riskAfter`("now")는 v4와 동일(v6:513, 참고). 즉 무응답 예측 문구는 v4에 이미 있음 | "" | |

---

## D. 데이터 상수

| id | 상수 | 옛(v4) → 새(v6) | 구현 상태 | 예외 후보 |
|---|---|---|---|---|
| V6-D1 | `ITEMS[jiho].cat` | `'color'` → `'quality'` (v4:619 / v6:757). 위 분류 "Not as described · Quality" | "" | |
| V6-D2 | 신규 `RISKP` | `{ seo: 89, jiho: 38, lena: 31, trk: 27, kc: 22, bm: 12, yuki: 6 }` (v6:764) | "" | 임시 시안 값. 결정: "값 엔진". 서연 89는 엔진 무응답 위험(기존 NNONE.p.cb), 나머지는 엔진/Assumption 배지. 성과 숫자 금지와 무관하나 숫자 출처 표기 필요 |
| V6-D3 | 신규 `riskLvl(p)` | `p>=45 → 'high'`, `p>=20 → 'med'`, 그 외 `'low'` (v6:765). 목록 칩·평균 카드·표 색에 공통 사용 | "" | |
| V6-D4 | `ITEMS[bm]` | `sec:'routine'`, 기한 없음 → `sec:'reply'`, `due:[0,15]` (v4:624 / v6:762) | "" | 기한 11/15는 시안 값 → 실제 마감과 대조 |
| V6-D5 | `DASH0` | 변경 없음 `{prevented:4,saved:312,drafted:18,reply:14}` | "" | 성과 숫자: 엔진·실제만 |
| V6-D6 | `PRODS` | 변경 없음 (4종·375장 하드코드: `prodSum(4, 375, …)` 사용처 v6:906·1035) | "" | Demo data |
| V6-D7 | `v.other.*.save` | 값 변경 없음(jiho 41, lena 8, trk 120, kc 72, yuki 0, bm 35). 사용처가 신규 "Keeps ≈$N"(B46) | "" | 성과 숫자 금지: 엔진 값만. Demo data/Assumption |
| V6-D8 | `v.who` | 변경 없음 | "" | |
| V6-D9 | NW, GOOD/BAD, `NCOST`, `N_*` (예측 모델) | 변경 없음 | "" | |
| V6-D10 | `histT`, `RISK 곡선 점`, `v.msgs`, `v.paths` | diff에 나오지 않음 = v4와 동일 | "" | |
| V6-D11 | 개요용 상수 | 신규 문자열 상수 없음. 아이콘은 기존 `ICON`(`ICON.multi`)·`PRODS`만 사용. 고정 문자열: `pCols`, `cCols`, `stSt`(상태 알약 색), `secOrd {reply:0,prevent:1,routine:2}`, 위험 색 임계 45/20(#C4321F/#0070E0/#9AA0A6) (v6:~870~915) | "" | |

---

## E. 상태·로직

| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-E1 | 새 state `aiOn:false`(v6:773): AI Respond now 스위치. 처음 꺼짐 | "" | |
| V6-E2 | 새 state `goodsOpen:true`(v6:773). v4에는 키 없음. v6 템플릿에서 읽는 곳은 `goods` 접기(기존 `goodsOpen:` 값 계산 줄 v6:1052 참고) | "" | |
| V6-E3 | 새 state `pSort:{k:'risk',d:-1}`, `cSort:{k:'risk',d:-1}` (v6:774) | "" | |
| V6-E4 | 초기값 변경: `sku:'all'`→`'sweater'`; `draft: v.paths.ai.draft`→`''`; `path:'ai'`→`'custom'` (v4:632~633 / v6:772~773). 즉 처음엔 빈 답장+무응답 예측 | "" | |
| V6-E5 | 새 메서드 `pickProduct(sku)`(v6:777~784): `'all'`이면 `{sku:'all', sel:null}`(개요). 아니면 그 상품 항목만 모아 `reply→prevent→routine` 순으로 첫 미완료 항목, 없으면 첫 항목, 항목 자체가 없으면 `sel:null`(빈 상품 화면). `setState({sku, sel})` | "" | |
| V6-E6 | `typeOut` 타이핑 속도: 한 번에 2글자 / 34ms 간격 (v4:653,656) → 1글자 / 32ms 간격 (v6:801,804). 끝나면 `busy:false` | "" | |
| V6-E7 | 새 핸들러 `toggleAi`(v6:1047): `aiOn`을 뒤집고, **켜면서 빈 답장이면** `typeOut(v.paths.ai.draft,'ai')`로 AI 초안 타이핑 시작. 끄는 경우 답장 내용은 지우지 않음(v6 코드 기준). 결정문의 "끄면 빈 답장"과 다를 수 있으니 시안 파일 기준 vs 결정문 구현자 확인 | "" | 결정 2 "끄면 빈 답장" ↔ 시안 코드 불일치 후보 |
| V6-E8 | 새 값 `simpleOff = busy || !draft.trim()`(v6:1046): 단순 카드 Send 비활성. 켜짐 상태 `sendOff = busy || blocked(c)`는 변경 없음 | "" | 안전장치: 단순 카드에서도 `send()`가 `blocked()`를 다시 검사(v6:~807) |
| V6-E9 | 새 값 `showSimple`, `showAi`, `aiOn`, `tgCls`(`'tg'+(on?' on':'')`) (v6:1044~1045) | "" | |
| V6-E10 | `renderVals` 신규 개요 계산(v6:867~919): `rp`(완료면 0), `rCol`, `riskCells`, `sortHead`, `cmp`, `groups`(PRODS+multi), `pData`, `pRows`, `pHead`, `cData`, `cRows`, `cHead`, `colName`, `openAll`, `tops`(상품별 최고 위험), `avgR`(평균 반올림), `kpis`, `sortTxt`, `ov{isAll, showBack, backAll, …}` | "" | 숫자는 실제 목록·엔진 |
| V6-E11 | `isAll = sku==='all' && !sel`, `showBack = sku==='all' && !!sel`, `backAll = sel:null`(v6:~917), `isEmpty = sel!=='seo' && !oc && !ov.isAll`, `isSeo`/`isOther` 조건은 v4와 동일 형태(v6:1036~1037) | "" | |
| V6-E12 | 목록 줄 `riskTxt/riskSt`(B6~B8)을 `items` 변환에 추가(v6:857~858) | "" | |
| V6-E13 | 개요 정렬 비교 `cmp(st)(a,b)`: `a[k]` 대 `b[k]` 단순 비교 × 방향. 표 1 키 `name, open, reply, prevent, routine, risk, topk`; 표 2 키 `risk, case, type, status, buyer, due`(due 없으면 99, status는 `secOrd`/완료 3) | "" | |
| V6-E14 | `thread` 변환에 `hasTr` 추가, `sub` 문자열 재구성(v4:759,762,767 / v6:962,965,970) | "" | |
| V6-E15 | `oc` 객체에 신규 필드(v6:1021~1030): `hasMsg, msgLang, msgCode, msgOrig, msgTr, msgHasTr, tags, steps, hasRows, rowHead, rows, rowCols, hasDraft, draftT, draftCode, draftOrig, draftTr, draftHasTr, draftSt, api, trLabSt, apiLab, hasKeep, keep`. `ax=v.ai[s.sel]`; `ax.auto`이면 "이미 보냄" 상태로 표시 | "" | Simulated(공개 모드) |
| V6-E16 | 새 값 `rFrom:'89%'`, `rTo`, `rToSt`(v6:1059). `moodSt` 글자 크기 22px→12px, `line-height` 속성 삭제(v4:844 / v6:1058). `rToSt`는 45% 이상 #C4321F | "" | `rFrom` 고정 89%는 엔진 무응답 값으로 대체 |
| V6-E17 | 타이머·간격 변경 목록: ① `typeOut` setInterval 34ms→32ms, 2글자→1글자 (E6). ② 나머지는 변경 없음: `toast` 3000ms 자동 닫힘(v6:786), `send`의 단계 setTimeout `1300*(k-1)+400`(v6:814~818). 새 타이머는 없음 | "" | |
| V6-E18 | `send()` 로직 변경 없음 (`blocked(c)` 검사, 결과 분기 ok/refund/cb, `bump(82,1,1)`/`bump(10,1,1)`) | "" | 보낸 뒤 예외·성과 숫자 |
| V6-E19 | `rushed`, `useAi`(`typeOut(v.paths.ai.draft,'ai')`), `clear`(`draft:'',path:'custom'`), `onType` 변경 없음 | "" | |

---

## F. 모션 (keyframes · transition · animation)

| id | 변경 내용 | 구현 상태 | 예외 후보 |
|---|---|---|---|
| V6-F1 | 새 transition: `.tg-tr` 배경 `background .2s ease` (v6:49) | "" | |
| V6-F2 | 새 transition: `.tg-kn` 손잡이 `left .2s ease`, 꺼짐 3px ↔ 켜짐 21px (v6:49) | "" | |
| V6-F3 | AI 초안 글자 타이핑(스위치 켤 때): 32ms마다 1글자(v4는 34ms마다 2글자). 이전에는 화면 첫 진입 시 이미 채워진 초안, 이제는 스위치를 켤 때만 타이핑 (E6, E7) | "" | |
| V6-F4 | 새 `@keyframes`·`animation`은 없음. 기존 `pop`(.45s), `rise`(.35s/.45s), `ndot`(1s), `ping`(1.4s), `flash`(1.6s) 모두 v4와 동일. `.rise`를 보낸 말풍선·Simulated 말풍선에 사용하는 부분도 동일 | "" | |
| V6-F5 | 새 hover: `.tg:hover` 배경 #13284F, `.ag-hc:hover` #EEF2F7, `.ag-r:hover` #F3F7FF, `.ag-r.hi:hover` #FDEFED (A) | "" | |
| V6-F6 | 위험 값 색 전환 `transition: color .3s ease`는 기존 위험 큰 숫자(v4:748)에 있고, 새 `rToSt`에도 동일 값 적용(v6:1059) | "" | |
| V6-F7 | 목록 위험 칩, 표 위험 막대 폭 변화에는 transition 없음(즉시 변경) | "" | |

---

## 부록: diff 전체 요약 줄 번호 대응표 (v4 → v6)

| v4 | v6 | 영역 |
|---|---|---|
| 48 뒤 | 49~70 | CSS 추가 |
| 101 | 123 | 로고 gradient id |
| 146 | 168 | 목록 위험 칩 |
| 156 뒤 | 179~241 | 개요·뒤로가기·빈 상품 |
| 164 | 249 | 서연 제목 칩 색 |
| 229 | 314 | 말풍선 보조줄 |
| 238 | 323~330 | 답장 카드 분기 |
| 240 | 332 | 켜짐 카드 머리 |
| 261 | 353 | 단계 2 라벨 |
| 274 | 366~368 | 한국어 박스 이동·트레이 테두리 |
| 293~295 | 387 | 한국어 칸 삭제·위험 박스 폭 |
| 301 | 393 | 위험 박스 오른쪽 칸 |
| 350 뒤 | 443~449 | 구매자 대화 |
| 352~355 | 451~477 | 한 장 카드 상세 |
| 369 뒤 | 492~498 | DI.en `ai` |
| 371 뒤 | 501 | DI.en `emptyT/S` |
| 377~380 | 507~510 | secs·secHint·cats(en) |
| 404 | 534 | sentKo/sentAuto |
| 420 | 550 | sheSees |
| 428 | 558 | send·phSimple·simpleHint |
| 457, 460 | 587, 590 | other.jiho, other.kc (en) |
| 468 뒤 | 599~605 | DI.ko `ai` |
| 470 뒤 | 608 | DI.ko `emptyT/S` |
| 476~479 | 614~617 | secs·secHint·cats(ko) |
| 515, 523 | 653, 661 | sheSees, send(ko) |
| 551, 554 | 689, 692 | other.jiho, other.kc (ko) |
| 619, 624 | 757, 762 | ITEMS jiho·bm |
| 625 뒤 | 764~765 | RISKP, riskLvl |
| 632~634 | 772~774 | 초기 state |
| 636 뒤 | 777~784 | pickProduct |
| 653, 656 | 801, 804 | typeOut 속도 |
| 688 | 836 | 칩 pick |
| 704 | 852 | catSt |
| 708 뒤 | 857~858 | 목록 riskTxt/riskSt |
| 716 뒤 | 867~919 | 개요 계산 |
| 759, 762, 767 | 962, 965, 970 | thread hasTr |
| 817 뒤 | 1021 | `ax` |
| 819 뒤 | 1024~1030 | oc 신규 필드 |
| 825 | 1036~1037 | isAll·isEmpty 등 |
| 832 | 1044~1046 | showSimple/showAi/tg/simpleOff/toggleAi |
| 836 | 1050 | draftGrid |
| 844 | 1058~1059 | moodSt·rFrom/rTo |
