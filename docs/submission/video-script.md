<!-- 영상 대본 초안. 영어 내레이션 + 한국어 화면 지시. 총 2:35 (155초). Autopilot·지호 장면 없음. -->

# AfterLoop demo video script (target 2:35, limit under 3:00)

Numbers come from the repo now: cardigan **$216 → $44**, Seo-yeon **$74 → $37**, **2** tracking orders (O05, O07). The follow-up date is **recording day + 7**, so read whatever the screen shows (recorded Nov 12 means Nov 19).

| Time | Screen (한국어 지시) | Narration (English) |
|---|---|---|
| 0:00–0:08 | 타이틀 카드: AfterLoop 로고, 한 줄 "PayPal after-purchase copilot" | "Hannah runs a two-person knit shop in Portland. More of her buyers are in Korea now, and she can't read their messages. (Fictional seller, PayPal sandbox.)" |
| 0:08–0:38 | **Products 탭.** 가디건 선택: 큰 숫자 $216, 점 그림 빨간 점 4개. 처방 4개를 켠다: 숫자가 $44로, 점 2개로. 처방을 켤 때 왼쪽 AG Grid 상품 표의 셀이 깜빡이며 바뀌는 순간을 크게 잡는다 | "She has 120 cardigans left. AfterLoop replays the next 120 sales 500 times: about $216 in dispute losses, mostly 'the color looks different'. Turn on four fixes and the same 500 futures cost $44, about 80% less, under our assumed rates. The product table is built on AG Grid." |
| 0:38–0:52 | **Today 탭.** 목록의 "2 orders without tracking" 선택 → [Add both to PayPal] 클릭 → "✓ 2 trackers added · 201" 확인 | "Two orders have no tracking in PayPal. One click registers both through PayPal's API. A third order without tracking has already turned into a dispute: Seo-yeon's." |
| 0:52–1:02 | 목록에서 **서연** 선택. 한국어 원문 말풍선, "카드사에 이의제기" 강조 | "Seo-yeon writes in Korean. She'll go to her card company." |
| 1:02–1:22 | 비교 카드 확대: "PayPal data only: Full refund $74" → "With carrier data: Reply $37". 말풍선 사이 "Customs hold" 줄과 Demo data 배지를 잠깐 비춘다 | "On PayPal data alone, the safe move is a full refund: $74. The carrier record, demo data here, shows a customs hold, so the code switches to a reply: $37. The cause comes from code, not from AI." |
| 1:22–1:40 | 영어 번역 → 답장 칸(좌 You write, 우 Seo-yeon reads Korean). 칩과 검사 3줄(Facts match · No new promises · Follow-up date) 비춤. 날짜는 화면에 보이는 그대로 읽는다 | "AI translates her message and writes the reply in natural Korean. Code fills in the date, and checks it means 'I'll check and write back', not a delivery promise. No refund promise sneaks in." |
| 1:40–2:00 | [Send in Korean] 클릭 (녹화 켠 것을 확인한 뒤 한 번만, 누른 순간부터 "Sent"까지 컷 없이) → "Sent · send-message 200 · PP-R-GMS-10197661", 위험 6 → 3 | "Hannah sends it in Korean. PayPal answers 200, and the risk score drops from 6 to 3." |
| 2:00–2:06 | PayPal 샌드박스 분쟁 화면: 메시지 부분만 비춰 같은 한국어 문장을 2~3초 (주문일이 찍히지 않게) | "Here it is in the PayPal sandbox dispute: the same Korean message." |
| 2:06–2:18 | 위쪽 막대 **PayPal activity** 서랍을 2~3초 연다: Send message 200 · Add tracking 201 · Read sales 200 cached · Read cases 200 | "Every PayPal step you just saw was a real sandbox call." |
| 2:18–2:35 | 로드맵 텍스트 → 로고 | "Next: every closed case feeds next month's check, and carrier data comes from a real integration. AfterLoop. Prevent the dispute, keep the customer." |

Total: **2:35 (155 s)**. 약 10초 여유가 있다. Narration is about 270 words at a calm pace; trim a sentence in Products if it runs long.

## Notes for the editor
- Do not show or say anything about Autopilot or Ji-ho. The drawer is shown only at the end.
- "Demo data here" in the 1:02 line is required (1.5차 리뷰). Keep it in the narration, not only in the badge.
- Do not say the whole-store number ($717 / $253).
- Say "assumed rates" once; avoid "guarantees" or "accurate predictions".

## Recording checklist
- [ ] **Recording mode, not public demo mode** (`DEMO_MODE=recording`), plus the send and tracking switches on. The public deployment must not be used for recording.
- [ ] The send-mode text changed from "Simulated send" to "Live · PayPal sandbox" before recording.
- [ ] Team reviewed the Seo-yeon Korean draft before recording. If a check fails, reopen the case and review again.
- [ ] Practice dispute (O04) and the old Seo-yeon dispute do not appear in the list or the drawer.
- [ ] Seo-yeon send happens **once**. Confirm recording is running first. No edit cut from the click to "Sent". Rehearse the same path on fake responses beforehand (at least 3 times).
- [ ] PayPal screen shows only the message (the real order date, Nov 9–10, must not appear).
- [ ] Follow-up date is read as shown on screen (recording day + 7).
- [ ] Numbers on screen match the script: $216/$44, 2 trackers, $74/$37, Nov N.
- [ ] Before recording: wake Render, warm the sales read cache, confirm O05 and O07 are still unregistered. Keep a backup recording.
- [ ] Drawer lists Send message 200, Add tracking 201, Read sales 200 cached, Read cases 200 (newest first).
- [ ] Video under 3:00.
