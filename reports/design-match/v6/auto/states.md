# 상태 목록 (자동 생성)

- 시안: `docs/design/mockup-v6/Desk.dc.html`
- 만든 때: 2026-11-12T11:42:56.190Z
- 상태 66개
- 사람이 고칠 곳: `states.json` (상태 이름 → `mock` 시안 클릭 단계 / `app` 앱 클릭 단계: role·text·selector·nth·contains·waitMs, `appPath`)

## 상태

| # | 이름 | 클릭 순서 | 마지막 클릭 뒤 타이머 | 바뀐 state |
|---|---|---|---|---|
| 1 | `initial` | (처음 화면) | — | — |
| 2 | `all-products` | button “All products” | — | sel, sku |
| 3 | `knit-cardigan` | button “Knit Cardigan” | — | sel, sku |
| 4 | `cashmere-coat` | button “Cashmere Coat” | — | sel, sku |
| 5 | `beanie-scarf` | button “Beanie + Scarf” | — | sel, sku |
| 6 | `1047` | button “#1047” | — | sel |
| 7 | `show-history` | button “Show history” | — | histOpen |
| 8 | `respond-now` | switch “Respond now” | interval 32ms×1 (끝까지 7616ms) | aiOn, draft, path |
| 9 | `all-products__1042` | button “All products” → button “#1042” | — | sel |
| 10 | `all-products__1038` | button “All products” → button “#1038” | — | sel |
| 11 | `all-products__1029` | button “All products” → button “#1029” | — | sel |
| 12 | `all-products__1047` | button “All products” → button “#1047” | — | sel |
| 13 | `all-products__5-orders` | button “All products” → button “5 orders” | — | sel |
| 14 | `all-products__3-orders` | button “All products” → button “3 orders” | — | sel |
| 15 | `all-products__1051` | button “All products” → button “#1051” | — | sel |
| 16 | `all-products__product` | button “All products” → columnheader “Product” | — | pSort |
| 17 | `all-products__open-cases` | button “All products” → columnheader “Open cases” | — | pSort |
| 18 | `all-products__reply-needed` | button “All products” → columnheader “Reply needed” | — | pSort |
| 19 | `all-products__prevent` | button “All products” → columnheader “Prevent” | — | pSort |
| 20 | `all-products__questions` | button “All products” → columnheader “Questions” | — | pSort |
| 21 | `all-products__dispute-risk` | button “All products” → columnheader “Dispute risk” | — | pSort |
| 22 | `all-products__riskiest-case` | button “All products” → columnheader “Riskiest case” | — | pSort |
| 23 | `all-products__dispute-risk-2` | button “All products” → columnheader “Dispute risk” #2 | — | cSort |
| 24 | `all-products__case` | button “All products” → columnheader “Case” | — | cSort |
| 25 | `all-products__dispute-type` | button “All products” → columnheader “Dispute type” | — | cSort |
| 26 | `all-products__status` | button “All products” → columnheader “Status” | — | cSort |
| 27 | `all-products__buyer` | button “All products” → columnheader “Buyer” | — | cSort |
| 28 | `all-products__due` | button “All products” → columnheader “Due” | — | cSort |
| 29 | `knit-cardigan__1051` | button “Knit Cardigan” → button “#1051” | — | sel |
| 30 | `knit-cardigan__send` | button “Knit Cardigan” → button “Send” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 31 | `beanie-scarf__refund-24` | button “Beanie + Scarf” → button “Refund $24” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 32 | `1047__send-proof` | button “#1047” → button “Send proof” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 33 | `respond-now__respond-now` | switch “Respond now” → switch “Respond now” | — | aiOn |
| 34 | `respond-now__ask-the-carrier-to-check` | switch “Respond now” → button “Ask the carrier to check” | interval 32ms×1 (끝까지 3552ms) | draft, path |
| 35 | `respond-now__refund-now` | switch “Respond now” → button “Refund now” | interval 32ms×1 (끝까지 4128ms) | draft, path |
| 36 | `respond-now__try-a-rushed-reply` | switch “Respond now” → button “Try a rushed reply” | interval 32ms×1 (끝까지 3904ms) | draft, path |
| 37 | `respond-now__clear` | switch “Respond now” → button “Clear” | — | draft, path |
| 38 | `respond-now__hide` | switch “Respond now” → button “Hide” | — | goodsOpen |
| 39 | `respond-now__send` | switch “Respond now” → button “Send” | timeout 1700ms×1, timeout 3000ms×2, timeout 4300ms×1, timeout 5600ms×1, timeout 6900ms×1 (끝까지 9900ms) | dash, done, flash, phase, sentKo, sentP, sentTxt, shown |
| 40 | `all-products__1038__send` | button “All products” → button “#1038” → button “Send” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 41 | `all-products__1029__refund-24` | button “All products” → button “#1029” → button “Refund $24” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 42 | `all-products__1047__send-proof` | button “All products” → button “#1047” → button “Send proof” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 43 | `all-products__5-orders__add-all-5` | button “All products” → button “5 orders” → button “Add all 5” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 44 | `all-products__3-orders__send` | button “All products” → button “3 orders” → button “Send” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 45 | `all-products__1051__looks-good` | button “All products” → button “#1051” → button “Looks good” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 46 | `knit-cardigan__1051__looks-good` | button “Knit Cardigan” → button “#1051” → button “Looks good” | timeout 3000ms×1 (끝까지 3000ms) | dash, done, flash |
| 47 | `respond-now__ask-the-carrier-to-check__respond-now` | switch “Respond now” → button “Ask the carrier to check” → switch “Respond now” | — | aiOn |
| 48 | `respond-now__ask-the-carrier-to-check__add` | switch “Respond now” → button “Ask the carrier to check” → button “+ Add” | — | draft, path |
| 49 | `respond-now__ask-the-carrier-to-check__add-2` | switch “Respond now” → button “Ask the carrier to check” → button “+ Add” #2 | — | draft, path |
| 50 | `respond-now__ask-the-carrier-to-check__add-3` | switch “Respond now” → button “Ask the carrier to check” → button “+ Add” #3 | — | draft, path |
| 51 | `respond-now__ask-the-carrier-to-check__add-4` | switch “Respond now” → button “Ask the carrier to check” → button “+ Add” #4 | — | draft, path |
| 52 | `respond-now__ask-the-carrier-to-check__hide` | switch “Respond now” → button “Ask the carrier to check” → button “Hide” | — | goodsOpen |
| 53 | `respond-now__ask-the-carrier-to-check__send` | switch “Respond now” → button “Ask the carrier to check” → button “Send” | timeout 1700ms×1, timeout 3000ms×1 (끝까지 3000ms) | out, phase, sentKo, sentP, sentTxt, shown |
| 54 | `respond-now__try-a-rushed-reply__respond-now` | switch “Respond now” → button “Try a rushed reply” → switch “Respond now” | — | aiOn |
| 55 | `respond-now__try-a-rushed-reply__remove` | switch “Respond now” → button “Try a rushed reply” → button “Remove” | — | draft |
| 56 | `respond-now__try-a-rushed-reply__remove-2` | switch “Respond now” → button “Try a rushed reply” → button “Remove” #2 | — | draft |
| 57 | `respond-now__try-a-rushed-reply__add` | switch “Respond now” → button “Try a rushed reply” → button “+ Add” | — | draft |
| 58 | `respond-now__try-a-rushed-reply__add-2` | switch “Respond now” → button “Try a rushed reply” → button “+ Add” #2 | — | draft |
| 59 | `respond-now__try-a-rushed-reply__add-3` | switch “Respond now” → button “Try a rushed reply” → button “+ Add” #3 | — | draft |
| 60 | `respond-now__try-a-rushed-reply__add-4` | switch “Respond now” → button “Try a rushed reply” → button “+ Add” #4 | — | draft |
| 61 | `respond-now__try-a-rushed-reply__hide` | switch “Respond now” → button “Try a rushed reply” → button “Hide” | — | goodsOpen |
| 62 | `respond-now__try-a-rushed-reply__send` | switch “Respond now” → button “Try a rushed reply” → button “Send” | timeout 1700ms×1, timeout 3000ms×1 (끝까지 3000ms) | out, phase, sentP, sentTxt, shown |
| 63 | `respond-now__ask-the-carrier-to-check__send__refund-72-now` | switch “Respond now” → button “Ask the carrier to check” → button “Send” → button “Refund $72 now” | timeout 3000ms×1 (끝까지 3000ms) | cbDone, dash, done, flash |
| 64 | `respond-now__ask-the-carrier-to-check__send__replay-this-case` | switch “Respond now” → button “Ask the carrier to check” → button “Send” → button “Replay this case” | — | draft, path, phase, shown |
| 65 | `respond-now__try-a-rushed-reply__send__refund-72-now` | switch “Respond now” → button “Try a rushed reply” → button “Send” → button “Refund $72 now” | timeout 3000ms×1 (끝까지 3000ms) | cbDone, dash, done, flash |
| 66 | `respond-now__try-a-rushed-reply__send__replay-this-case` | switch “Respond now” → button “Try a rushed reply” → button “Send” → button “Replay this case” | — | draft, path, phase, shown |

## 정적 분석

### 템플릿 이벤트 바인딩

| 줄 | 이벤트 | 핸들러 | 태그 | 위치(sc-for/sc-if) | 탐색에서 눌림 |
|---|---|---|---|---|---|
| 133 | onClick | `p.pick` | button | for p in {{prods}} | 예 |
| 163 | onClick | `it.pick` | button | for g in {{secs}} › for it in {{g.items}} | 예 |
| 195 | onClick | `h.pick` | button | if {{isAll}} › for h in {{pHead}} | 예 |
| 197 | onClick | `r.pick` | button | if {{isAll}} › for r in {{pRows}} | 예 |
| 214 | onClick | `h.pick` | button | if {{isAll}} › for h in {{cHead}} | 예 |
| 216 | onClick | `r.pick` | button | if {{isAll}} › for r in {{cRows}} | 예 |
| 231 | onClick | `backAll` | button | if {{showBack}} | 예 |
| 287 | onClick | `toggleHist` | button | if {{isSeo}} | 예 |
| 325 | onClick | `toggleAi` | button | if {{isSeo}} › if {{showSimple}} | 예 |
| 326 | onChange | `onType` | textarea | if {{isSeo}} › if {{showSimple}} | 해당 없음(입력) |
| 327 | onClick | `send` | button | if {{isSeo}} › if {{showSimple}} | 예 |
| 332 | onClick | `toggleAi` | button | if {{isSeo}} › if {{showAi}} | 예 |
| 340 | onClick | `p.pick` | button | if {{isSeo}} › if {{showAi}} › for p in {{paths}} | 예 |
| 355 | onClick | `rushed` | button | if {{isSeo}} › if {{showAi}} | 예 |
| 356 | onClick | `useAi` | button | if {{isSeo}} › if {{showAi}} | 예 |
| 357 | onClick | `clear` | button | if {{isSeo}} › if {{showAi}} | 예 |
| 363 | onChange | `onType` | textarea | if {{isSeo}} › if {{showAi}} | 해당 없음(입력) |
| 372 | onClick | `l.act` | button | if {{isSeo}} › if {{showAi}} › for l in {{lints}} › if {{l.hasAct}} | 예 |
| 377 | onClick | `toggleGoods` | button | if {{isSeo}} › if {{showAi}} › if {{hasGoods}} | 예 |
| 397 | onClick | `send` | button | if {{isSeo}} › if {{showAi}} | 예 |
| 416 | onClick | `refundNow` | button | if {{isSeo}} › if {{sent}} › for s in {{steps}} › if {{s.act}} | 예 |
| 431 | onClick | `replay` | button | if {{isSeo}} › if {{sent}} | 예 |
| 475 | onClick | `oc.run` | button | if {{isOther}} | 예 |

> 모든 onClick 바인딩을 탐색에서 적어도 한 번 눌렀다.

### setState를 부르는 메서드·핸들러

| 줄 | 이름 | 바꾸는 키 | 부르는 메서드 |
|---|---|---|---|
| 776 | `pickProduct` | sku, sel | — |
| 785 | `toast` | toast | later |
| 786 | `bump` | dash, flash | toast |
| 795 | `typeOut` | draft, path, busy | — |
| 805 | `send` | phase, out, sentTxt, sentKo, sentP, refundNowF, shown, typing, cbDone, done | fc, blocked, later, bump |
| 836 | `pick` | — | pickProduct |
| 859 | `pick` | sel | — |
| 875 | `pick` | [key] | — |
| 888 | `pick` | sel | pickProduct |
| 898 | `pick` | sel | — |
| 916 | `backAll` | sel | — |
| 985 | `pick` | — | typeOut |
| 1031 | `run` | done | bump, toast |
| 1042 | `toggleHist` | histOpen | — |
| 1046 | `toggleAi` | aiOn | typeOut |
| 1048 | `onType` | draft, path | — |
| 1049 | `rushed` | — | typeOut |
| 1049 | `useAi` | — | typeOut |
| 1049 | `clear` | draft, path | — |
| 1052 | `toggleGoods` | goodsOpen | — |
| 1061 | `send` | — | send |
| 1064 | `refundNow` | cbDone, done | bump |
| 1067 | `replay` | phase, shown, typing, cbDone, done, draft, path | — |

### 타이머

| 줄 | 호출 | 간격 식 | 들어 있는 메서드 |
|---|---|---|---|
| 785 | setTimeout | `ms` | later |
| 786 | later | `3000` | toast |
| 800 | setInterval | `32` | typeOut |
| 814 | later | `1300 * (k - 1) + 400` | send |

> 글자 입력(onChange/onInput)으로만 가는 상태는 자동 탐색하지 않는다.
