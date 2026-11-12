# DisputeLess 영상 재료 (기획자용)

> ## Official requirements (공식 규칙 — paypalaihackathon.devpost.com/rules, 사람 결정 2026-11-12 08:00)
> - **3분 미만** (목표 2:30 안팎)
> - **YouTube 공개 링크** — Devpost 양식에 넣는다
> - **배포된 앱을 직접 녹화한다.** 시안 화면 녹화는 안 된다 ("design mockup, static prototype, or non-functional demo"는 요건 미달)
> - **무료 라이선스 음악만.** 허락 없는 타사 상표·저작권 화면 금지
> - **AG Grid 상품 표(`/products`)를 2~3초** 넣는다 (스폰서상 근거)
> - **실제 전송 장면**은 녹화하는 동안만 Render를 recording 모드로 바꾼다 (경희가 전환). **서연 전송은 한 번뿐**이다
> - **화면 고정 13:00**, 녹화는 그 뒤. **녹화 중에는 재배포하지 않는다**
> - 녹화는 **09:00 KST 이후**에 (서버가 UTC 날짜를 써서 그 전에는 날짜·"다시 연락할 날"이 하루 이르게 나온다 — 3차 리뷰)


2026-11-11 · 컨트롤 타워 작성. 영상은 기획자가 만들고, **실제 전송 장면만 경희가 녹화용 모드로 따로 찍는다.** 숫자는 모두 엔진이 지금 계산한 값이다 (`config/params.json` 가정값 기준. 가정값이 바뀌면 숫자도 바뀐다 — 녹화 전에 화면과 이 표를 한 번 더 대조한다).

## 1. 링크

| 무엇 | 링크 | 비고 |
|---|---|---|
| 공개 데모 (Render) | **https://disputeless.onrender.com** (`/api/health` → `{"ok":true,"mode":"public"}`) | `DEMO_MODE=public` — PayPal 쓰기 호출 0회, 버튼은 "Simulated" 결과만. 읽기(분쟁·거래 조회)는 실제 샌드박스. 화면 녹화는 이 링크로 해도 된다 (전송 장면만 빼고) |
| 실제 전송 장면 | 경희가 따로 찍음 (아래 4절) | `DEMO_MODE=recording` 로컬/별도 환경 |

## 2. 장면 순서 (PRD v3 15장 기준, Autopilot 없음, 3분 미만 — 목표 2:30 안팎)

| # | 길이(안) | 화면 | 하는 일 | 말로 밝힐 것 |
|---|---|---|---|---|
| 1 | ~8초 | 타이틀 | 로고 + 한 줄 | "Fictional seller, PayPal sandbox." (가상 판매자) |
| 2 | ~30초 | **Products** 탭 → Knit Cardigan, Oat | 큰 숫자 $216 · 점 그림 빨간 점 4개 → 처방 4개 켜기 → $44 · 빨간 점 2개. 처방을 켤 때 **왼쪽 상품 표(AG Grid) 셀이 깜빡이며 바뀌는 순간**에 "built on AG Grid" | **가정**: "under our assumed rates" 한 번. 통관 안내 카드는 "Simulated" 배지 — "two of the fixes run in PayPal" 정도로만 |
| 3 | ~14초 | **Today** 탭 → "2 orders without tracking" | [Add both to PayPal] → "✓ 2 trackers added · Orders tracking API · 201" | 공개 링크에서 찍으면 "Simulated"로 나온다 → **201 화면은 녹화용 모드에서** (4절) |
| 4 | ~10초 | Today → **서연** 선택 | 한국어 원문 말풍선, "카드사에 이의제기" 강조 | — |
| 5 | ~20초 | 서연 비교 카드 | "PayPal data only · Full refund ~~$74~~ → With carrier data · Reply **$37**", 카드 안 "It's not lost — it's held at Korean customs…" | **데모 데이터**: "The carrier record — *demo data here* — shows a customs hold." (필수, 1.5차 리뷰). **가정**: 기대 손실은 가정값으로 계산 |
| 6 | ~18초 | 서연 칩·답장 두 칸·검사 줄 | 칩(Apology · Customs hold · Ask for code · Follow-up: 날짜), You write / Seo-yeon reads, ✓ Facts match · ✓ No new promises · Follow-up date | "Code fills in the date" — 날짜는 "다시 연락하는 날"이지 도착일이 아니다 |
| 7 | **≤10초** | **실제 전송** (경희 녹화분) | [Send in Korean] → "Sent · send-message 200 · PP-R-GMS-10197661", 위험 6 → 3 | — |
| 8 | ~5초 | PayPal 샌드박스 분쟁 화면 (경희 녹화분) | 같은 한국어 문장 2~3초. **메시지 부분만** (주문일 안 보이게) | — |
| 9 | ~8초 | 위쪽 막대 **PayPal activity** 서랍 | 맨 위 **Send message 200**, 그 아래 Add tracking 201(O05·O07), Read sales 200 cached, Read your open cases 200 (최신이 위). 화면을 열 때마다 생기는 실제 조회 줄(Read order·Read case 등)도 정직하게 남으므로 **위 2~3줄만 잡거나 서랍을 연 직후 위쪽을 확대** | "Every PayPal step you just saw was a real sandbox call." (배송사 기록은 실제 호출이 아니므로 "모든 단계"라고 하지 않는다) |
| 10 | ~15초 | 로드맵 + 로고 | — | — |

**넣지 않는 것**: Autopilot, 지호 장면, Mike 장면, 가게 전체 숫자($717 / $253)를 말로 하기.

## 3. 장면별 숫자 대조표 (엔진 값 그대로)

| 장면 | 화면 글자 | 엔진 값 (센트) | 출처 |
|---|---|---|---|
| 2 | as-is **$216** | 21619 | `simulate` 가디건, 처방 0 → `before.meanLossCents` |
| 2 | with fixes **$44** | 4366 | 처방 4개 → `after.meanLossCents` (약 80% 감소) |
| 2 | 범위 as-is **$67–$360** | 6700–36000 | P10–P90 |
| 2 | 범위 with fixes **$0–$104** | 0–10380 | P10–P90 |
| 2 | 분쟁 수 **about 4.5 → 2.1** | 4.46 → 2.07 | `meanDisputes` |
| 2 | 점 그림 빨간 점 **4 → 2** | — | `pickRepresentativeFuture` |
| 2 | 처방 카드 "could save" | 모두 꺼진 처음 상태에서: 추적 **$46** · 색상 문구 **$66** · 통관 안내 **$19** · 합의 우선 **$79** (엔진 `fixSavings`, 4637·6602·1917·7862¢). 하나씩 켤 때마다 남은 카드 값이 바뀐다 (4개 모두 켠 뒤 "끄면 늘어나는 값"은 $46·$28·$11·$45) | **화면 값대로 읽는다**. 처방 토글 처음 상태 = 모두 꺼짐 (T062 후속) |
| 2 | 상품 표 가디건 행 "$216 → $44" | 같은 값 | — |
| 3 | **2** trackers (O05·O07) | — | 분쟁 없는 미등록 주문. 분쟁 주문(O02·O13)은 회색 "In dispute — excluded" |
| Today 맨 위 | "**17** days to Black Friday" | — | 11/10 기준 17. **녹화일에 따라 바뀐다** (11/12 녹화면 15) |
| Today 맨 위 | "$717 … $253 with fixes" | 71718 → 25316 | `simulateStore` — 화면에는 보이지만 말로 하지 않는다 |
| 5 | 머리글 "Wool Sweater **$72**" | 분쟁 금액 7200 | PayPal 분쟁 금액 |
| 5 | Full refund **$74** "incl. $2 of your time" | 7400 | 엔진: 환불 7200 + 대응 시간 200 (가정) |
| 5 | Reply **$37** | 3680 | 엔진: 통관 보류 A2, 추적 있음 승률 0.60 (가정) → 0.40 × (7200+1500) + 200 |
| 6 | Follow-up **녹화일 + 7일** | — | 서연 응답 기한(11/30)보다 앞이면 그대로. 11/12 녹화면 "Nov 19" / "11월 19일". 화면대로 읽는다 |
| 7 | 위험 **6 → 3** | — | `escalationRisk` (보내기 전 6 = 카드사 언급 +3 · 무응답 +2 · 화난 어조 +1, 보낸 뒤 3 — 엔진 값, 화면대로) |

## 4. 말로 밝혀야 하는 곳 (데모 데이터·가정)

- **데모 데이터** (시드에서 온 것, 화면에 Demo data 배지):
  - 배송사 추적·통관 기록 ("Oct 30 · Carrier: Customs hold – recipient customs ID missing") → 장면 5에서 **"demo data here"를 말로**
  - 서연 11/2 문의 말풍선, Mike의 이전 주장, 종결 분쟁 이력
- **가정** (화면에 Assumption 배지): 분쟁 확률, 승률, 처방 효과, 제안 수락률 0.72, 제안 15%, 대응 시간 $2, 지금 습관(환불 50%·다툼 50%) → 장면 2에서 "assumed rates" 한 번
- **실제 PayPal 샌드박스**: 분쟁 조회, 추적 등록(201), 거래 조회, 한국어 send-message(200). 가상 판매자·샌드박스라는 것은 타이틀에서
- 하지 말 말: "guarantees", "predicts accurately", "AI found the customs hold"(원인은 코드가 판단)

## 5. 실제 전송 장면 (경희가 따로 찍음)

- **녹화용 모드** `DEMO_MODE=recording` + 전송·추적 스위치 켬. 공개 링크(`public`)로는 실제 전송이 되지 않는다.
- 찍는 것: 장면 3의 추적 등록 201, 장면 7의 [Send in Korean] → "Sent · 200", 장면 8의 PayPal 분쟁 화면. **장면 7은 10초 이내.**
- 서연 전송은 **딱 한 번**. 녹화가 켜진 것을 확인한 뒤 누르고, 누른 순간부터 "Sent"까지 컷 없이.
- 녹화 직전: 서연 화면을 열어 그 초안을 팀이 한국어로 검수 → 그대로 녹화 → 누름 (검사에 걸리면 다시 연다). 전송 모드 글자가 "Simulated send"에서 "Live · PayPal sandbox"로 바뀌었는지 확인. 연습용 분쟁이 목록·서랍에 없는지 확인. 가짜 응답으로 같은 동선 3번 이상 연습. 백업 녹화.
- 경희 녹화분을 기획자에게 넘기면 장면 7·8(·3의 201 화면) 자리에 끼운다.

## 6. 녹화 체크 (기획자 쪽)

- [ ] 화면 숫자 = 3절 표 (특히 $216/$44, 4→2, $74/$37, 2 trackers)
- [ ] "demo data here"가 내레이션에 있다
- [ ] Autopilot·지호·Mike 장면 없음
- [ ] 3분 미만
