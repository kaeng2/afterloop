# 디자인 시안 v4 ↔ 지금 화면 — 차이표 (2026-11-11, 구현 전)

- 시안: `docs/design/mockup-v4/Desk.dc.html` (README: "Scene 2 · DisputeLess desk"). 스크린샷 `reports/screens/design-v4/` (서연 위·답장, 전체, 지호)
- 지금: main (배포 커밋 4253596 + 이름 변경). 스크린샷 `reports/screens/review-2/` (Today 서연·추적·지호·Mike, Products, 서랍, 390)
- **원칙 (사람 결정 11/11 20:25)**: 계산·숫자·안전장치(데모 모드, 승인 버튼)는 시안과 달라도 바꾸지 않는다. 2차 리뷰 ⑤(AG Grid 상품 이름 꺾임, 서랍 Close 꺾임)는 이 작업에 넣는다.
- 바꿀 양: **작음** = 문구·색·간격만 / **중간** = 배치·부품 모양 / **큼** = 새 화면·새 기능·새 계산

**먼저 알아 둘 것 — 시안에 없는 화면:** v4는 Today(목록+사례 상세) 한 장면뿐이다. **Products(리허설)와 PayPal activity 서랍이 없다** (문구표에 `navRehearsal: 'Black Friday rehearsal'`만 정의돼 있고 화면은 없음). 아래 표는 둘을 "지금 그대로 + 색·글꼴만 맞춤"으로 둔다.

## 1. 차이표

| # | 화면 | 시안 v4 | 지금 | 바꿀 양 | 컨트롤 타워 의견 |
|---|---|---|---|---|---|
| 1 | 위쪽 막대 — 로고 | "DisputeLess" 글자 로고 + 밑줄 곡선, 옆에 "for PayPal sellers" 알약, 날짜 줄("Tue, Nov 10 · Black Friday in 17 days")이 막대 안 | 원형 고리 마크 + "DisputeLess", 날짜 줄은 왼쪽 목록 맨 위 | 작음 | 반영 |
| 2 | 위쪽 막대 — 탭·버튼 | Today/Products 탭 없음, PayPal activity 버튼 없음, Autopilot 없음, 오른쪽 "Fernwood Knits" | Today (5) / Products 탭, "Public demo · simulated sends", PayPal activity (N), H 칩 | 중간 | **탭·서랍 버튼은 유지** (Products·서랍은 결정된 범위, 서랍은 영상 증거 장면). 모양만 시안에 맞춤 |
| 3 | 상품 거르개 줄 (새) | 위쪽 막대 아래 상품 알약: All products 4 items·375 units / Knit Cardigan 120 units·2 cases … 빨간 건수 동그라미, 누르면 왼쪽 목록을 그 상품으로 거름 | 없음 | 중간 | 선택. 숫자는 시드 재고·분쟁 수로 만들 수 있다 (계산 아님). 시간 남으면 |
| 4 | 왼쪽 맨 위 카드 "DisputeLess this week — What AI handled for you" | Disputes prevented 4 · Money kept $312 · Replies drafted by AI 18 in 4 languages · First reply time 14 min (was 2 days), 짙은 파랑 그라데이션 | 날짜 줄 + "Today" + "Stock left could cost $717 · $253 with fixes →" | 큼 | **반영하지 않기를 권함** — 네 숫자 모두 우리 데이터·엔진에 근거가 없다 (정직성 표와 충돌). 지금의 엔진 숫자 줄 유지 |
| 5 | 왼쪽 목록 묶음 | Reply needed (3): 서연·지호·**Lena(환불 약속)** / Prevent (2): **5 orders missing tracking**·**3 orders customs ID missing** / Routine (2): **Yuki(사이즈 문의)**·Mike | Needs you: 서연·추적 2건·지호 / Prevent: 가디건 / Routine: Mike | 큼 | **묶음 내용은 지금 그대로** (Lena·통관부호·Yuki는 범위 밖 결정 11/10, 추적은 실제 2건). 묶음 이름만 시안 꼴("Reply needed"·"Routine") 선택 |
| 6 | 목록 한 줄 모양 | 상품 아이콘 + "#1042 · Wool Sweater", 빨간/회색 범주 알약("Not received · Customs hold"), "Reply by Nov 12", 구매자 이름 · 나라, 고른 줄은 연파랑 바탕 + 왼쪽 파란 띠 | 위험 색 점 + "Seo-yeon · customs hold" + 상태 알약, 고른 줄 흰 카드+그림자 | 중간 | 반영 (상품 아이콘, 응답 기한 "Reply by" — 기한은 PayPal 데이터, 범주 알약). 주문 번호는 시드 주문 키로 |
| 7 | 사례 머리글 | 상품 아이콘 + "#1042 · Wool Sweater" + 범주 알약, 아래 "$72 · Seo-yeon Kim · Korea · reads Korean · Open 23 days" | "Case PP-R-GMS-… · Wool Sweater $72 · Waiting for your reply" / "김서연 Seo-yeon Kim · writes in Korean" / 위험 배지 | 작음 | 반영 (내용은 같다. "Open N days"는 분쟁 접수일에서 — 계산 아닌 날짜 차) |
| 8 | "Dispute risk across this case" 꺾은선 | 시간에 따른 분쟁 위험 %, 지금 89% → "with your draft" **8%** | 없음 (위험 점수 6 → 보낸 뒤 3, 작은 배지) | 큼 | **반영하지 않기를 권함** — 엔진에 "분쟁 위험 %"와 시간 흐름 계산이 없다 (새 계산). 지금 배지 유지 |
| 9 | "Case history" 타임라인 + AI 요약 | 8 events·23 days 점 타임라인, "History summary: Your Nov 5 promise was missed, you replied late in English…" | 없음 (대화 말풍선 사이 배송사 줄만) | 큼 | **반영하지 않기를 권함** — 요약 속 사실(11/5 약속, 영어로 늦게 답함)이 우리 데이터에 없다. 새 AI 기능 |
| 10 | 구매자 메시지 | 회색 상자 안 말풍선: 한국어 원문 + "Translated · …" + 날짜, 아래 **"AI read" 태그** (Asks for update · Worried / Threatens chargeback · Angry) | 말풍선: 한국어 크게 + 영어 작게 + AI suggests, 가운데 "Oct 30 · Carrier: Customs hold…" + Demo data, "카드사에 이의제기" 강조 | 작음~중간 | 반영 (상자·말풍선 모양). 태그는 **있는 판정만**: 어조(AI 어조 판정 결과)·카드사 언급(엔진 신호). 배송사 줄·Demo data 배지는 유지 (사람 결정) |
| 11 | 비교 카드 ($74 → $37) | **없음.** 대신 "Pick a way to resolve" 선택지 3개: Ask for her customs ID (Best, Chargeback 8% · cost ~$15) / Ask the carrier to check (57% · ~$60) / Refund now (2% · ~$72) | 비교 카드가 주인공(PayPal data only · Full refund ~~$74~~ → With carrier data · Reply **$37**) + "It's not lost…" | 큼 | **사람 결정 필요.** 비교 카드는 1차·1.5차 리뷰와 사람 결정으로 "주인공". 시안의 "차지백 %"는 엔진에 없다. 할 수 있는 것: 선택지 카드 모양으로 바꾸되 숫자는 **엔진의 수별 예상 손실**(답장 $37 · 환불 $74 · 제안은 이 분쟁에서 막힘)만, "%"는 넣지 않음 — 이러면 "PayPal 정보만 vs 배송사 기록" 대비가 사라진다 |
| 12 | 답장 칸 | **고칠 수 있는 입력칸**("Edit freely — her reaction updates as you type"), [Try a rushed reply] [Use AI draft] [Clear], "As you type 5 good" 칩(Apology · Why it's held · Her next step · A date · **Refund backup**), 오른쪽 "She'll see (Korean)" | 읽기 전용 영어 초안 / 한국어 전송본 두 칸, "Suggested reply covers" 칩(Apology · Customs hold · Ask for code · Follow-up: Nov 17), 역번역 접기 | 큼 | 두 칸 배치·칩 모양은 반영(작음). **입력칸 편집·rushed reply는 새 기능**(편집하면 토큰·약속 검사를 다시 돌려야 함) — 권하지 않음. **"Refund backup" 칩과 시안 초안 문장("Expected delivery: Nov 17… I'll refund you in full")은 우리 결정과 반대**(날짜는 다시 연락하는 날, 정책 밖 환불 약속 금지) — 넣지 않음 |
| 13 | "Her likely reaction" 막대 | Waits calmly 82% · Ends in refund 10% · Chargeback 8%, "Her mood next: Okay (now: angry)", Expected cost $15 | 없음 | 큼 | **넣지 않음** — 사람 결정으로 제외한 "답장 실시간 확률 점검" 기능 그 자체 |
| 14 | 검사·보내기 줄 | 검사 줄 없음(칩이 대신), 오른쪽 검은 [Send in Korean] | ✓ Facts match · ✓ No new promises · Follow-up date + More checks, "Simulated send — …" 작은 글씨, 강조색 [Send in Korean] | 작음 | **검사 줄·전송 모드 글자·승인 버튼은 유지 (안전장치)**. 버튼 모양만 시안 꼴(검정 대신 지금 강조색 — 아래 3번 결정에 따름) |
| 15 | 지호 상세 | 한 장 요약: "Offer 15% back ($7.20), she keeps it · Lowest-cost option for a color case. AI drafted the message in Korean." + [Send offer] | 서연과 같은 틀 전체 (비교 카드·대화·칩·두 칸·검사·[Send offer · $7]) | 중간 | 선택. 줄이면 화면이 간결해진다 — 단 금액은 엔진 값, 제안 버튼의 관문 그대로. 영상에 지호 장면이 없으니 낮은 우선 |
| 16 | Mike·추적 상세 | (시안에서 Routine·Prevent 줄만 보이고 상세는 따로 없음) | Mike 한 줄 상태 / 추적 표 + Add both to PayPal | — | 지금 그대로, 색·글꼴만 |
| 17 | Products (리허설) | **시안에 없음** | 큰 숫자·점 그림·처방 카드·AG Grid 표 | 작음 | 색·글꼴·간격만 시안 값으로. **⑤ AG Grid 상품 이름 꺾임 고침** (이름 한 줄 또는 두 줄, 줄 간격 좁게) |
| 18 | PayPal activity 서랍 | **시안에 없음** | 오른쪽 서랍, 호출 목록 | 작음 | 색·글꼴만. **⑤ "Close" 글자 꺾임 고침** |
| 19 | 색 | 강조 **#0066F5 파랑**, 짙은 **#002991**·#0A1B3D (머리 카드 그라데이션), 빨강 #C4321F, 주 버튼 **검정**, 바탕 흰색·#F1EFEA·#E4E6E9 | 강조 보라빛 남색 하나, 주 버튼 강조색, 같은 회색·#F1EFEA·#E4E6E9 | 작음(값) / 결정 필요 | **사람 결정 필요** — 11/10 결정 "PayPal 공식 파랑(#003087, #0070E0 계열) 쓰지 않는다"와 충돌. #0066F5는 #0070E0과 거의 같고 #002991은 #003087 계열 |
| 20 | 글꼴·모서리 | Figtree + Noto Sans KR, 모서리 16·20·24px, 알약 1000px | 같다 (T067) | 없음 | — |

## 2. 정리 — 세 묶음

**A. 바로 해도 되는 것 (계산·안전장치 무관, 작음~중간)** — 1, 6, 7, 10(태그는 있는 판정만), 12의 배치·칩 모양, 14의 버튼 모양, 17·18의 ⑤ 고침, 색·간격 값(19는 결정 뒤)
**B. 사람 결정이 필요한 것** — 2(탭·서랍 유지 — 컨트롤 타워는 유지 권함), 11(비교 카드 → 선택지 카드?), 19(파랑 색), 3·15(선택)
**C. 넣지 않기를 권하는 것 (근거 없는 숫자·새 계산·제외한 기능·결정과 반대)** — 4(이번 주 성과 숫자), 8(위험 % 꺾은선), 9(사례 이력 + AI 요약), 12의 편집 입력칸·rushed reply·"Refund backup", 13(반응 예측 막대)

## 3. 예상 작업량 (A만 할 때)
Opus 1건(약 2시간) — Today 목록 줄·머리글·말풍선·답장 두 칸·버튼 모양 + Products·서랍 ⑤. 숫자·관문·데모 모드 코드는 건드리지 않는다. 병합하면 Render 재배포 필요.
