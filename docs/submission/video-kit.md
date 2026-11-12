# DisputeLess 영상 재료 (기획자용)

> ## Official requirements (공식 규칙 — paypalaihackathon.devpost.com/rules, 사람 결정 2026-11-12 08:00)
> - **3분 미만** (목표 2:30 안팎)
> - **YouTube 공개 링크** — Devpost 양식에 넣는다
> - **배포된 앱을 직접 녹화한다.** 시안 화면 녹화는 안 된다 ("design mockup, static prototype, or non-functional demo"는 요건 미달)
> - **무료 라이선스 음악만.** 허락 없는 타사 상표·저작권 화면 금지
> - **[시안 확정 대기] AG Grid 장면** — `/products` 화면은 11/12 11:15 결정으로 없앴다. AG Grid가 들어갈 화면의 시안이 오면 이 줄을 채운다 (스폰서상은 아직 미정: AG Grid 또는 Render)
> - **배포 주소(disputeless.onrender.com)가 화면에 한 번 보이게** 한다 (브라우저 주소창 등)
> - **실제 전송 장면**은 녹화하는 동안만 Render를 recording 모드로 바꾼다 (경희가 전환). **서연 전송은 한 번뿐**이다
> - **화면 고정 13:00**, 녹화는 그 뒤. **녹화 중에는 재배포하지 않는다**
> - 녹화는 **09:00 KST 이후**, 가능하면 **14:00 KST 이후** (Follow-up 날짜는 서버 UTC 날짜 기준이라 09:00 전에는 하루 이르고, 위쪽 날짜 줄은 판매자 시간대(미국 동부) 기준이라 14:00 전에는 전날이다 — 아래 3절 "날짜 규칙")


2026-11-12 · 컨트롤 타워가 다시 씀 (3차 리뷰 고칠 것 ①). **13:00 고정 화면 기준**이다. 배포본과 같은 로컬 빌드(공개 모드, http://localhost:3111)를 1920×1080에서 Playwright로 직접 눌러 보고 화면 글자를 그대로 옮겼다 (11/12 오전 KST). 영상은 기획자가 만들고, **실제 전송 장면만 경희가 녹화 모드로 따로 찍는다.**

- 숫자는 모두 엔진이 지금 계산한 값이다. 바탕은 가정값이다: `config/params.json`, `config/reply-model.json`, `config/listing-model.json` (뒤의 두 파일은 "가정(기획 시안)"). **가정값이 바뀌면 숫자도 바뀐다.**
- **날짜가 들어간 글자는 녹화하는 날·시각에 따라 바뀐다** (3절 아래 "날짜 규칙"). 녹화 직전에 화면과 3절 표를 한 번 더 대조한다.
- 확인하지 못한 것은 **[확인 필요]**라고 적었다.

## 1. 링크

| 무엇 | 링크 | 비고 |
|---|---|---|
| 공개 데모 (Render) | **https://disputeless.onrender.com** (`/api/health` → `{"ok":true,"mode":"public"}`) | `DEMO_MODE=public` — PayPal 쓰기 호출 0회, 버튼은 "Simulated" 결과만. 읽기(분쟁·주문·거래 조회)는 실제 샌드박스. 실제 전송 장면을 빼고는 이 링크로 찍어도 된다 |
| 화면 주소 | `/intro` → `/` (Desk) · `/listing` | 화면끼리 링크가 없다. **`/listing`은 주소창에 직접 쳐서 들어간다** (탭 없음). `/products`는 없앴다 (→ `/`로 이동) |
| 서연 화면 바로 가기 | `/?item=PP-R-GMS-10197661` | /intro에서 누르면 여기로 온다 |
| 실제 전송 장면 | 경희가 따로 찍음 (아래 5절) | `DEMO_MODE=recording` 별도 환경 |

## 2. 장면 순서 (3분 미만, 목표 2:30 안팎)

PRD v3와 DECISIONS 11/11 20:40 이후 결정 기준. **장면 1 = /intro, 장면 2 = Desk(`/`), 장면 3 = /listing** (Black Friday 리허설은 /listing으로 바뀌었다). 화면 모양은 시안 v4다. Autopilot 없음.

| # | 길이(안) | 화면 / 주소 | 하는 일 (화면 글자 그대로) | 말로 밝힐 것 |
|---|---|---|---|---|
| 1 | ~8초 | 타이틀 | 로고 + 한 줄 | "Fernwood Knits is a **fictional seller** on the **PayPal sandbox**." |
| 2 | ~10초 | **/intro** | 맨 위 검은 띠 "**Demo mock — not a real PayPal page**". 오른쪽 "Resolution Center · 2 open", 서연 줄 "Respond by Nov 30 · mentions chargeback". 오른쪽 위 검은 말풍선 "2 cases need a reply. One buyer mentioned a chargeback — DisputeLess has a plan ready." → 파란 버튼 **[Handle all 2 with DisputeLess]** 클릭 → 서연 화면으로 간다 | "This seller dashboard is **a mock, not PayPal's page**." (화면 띠에도 적혀 있다) |
| 3 | ~18초 | **Desk** 서연 위쪽 (`/?item=PP-R-GMS-10197661`) | 오른쪽 위 큰 숫자 "**Dispute risk 40%** · with your draft · **80% → 40%**" (Assumption 배지). 한국어 원문의 "**카드사에 이의제기**" 빨간 밑줄 → [Show history ▾] → "**Oct 30 · Carrier: Customs hold – recipient customs ID missing**" 줄 (Demo data 배지) | **필수**: "The carrier record — **demo data here** — shows a customs hold." |
| 4 | ~25초 | Desk 아래 "Respond now" (천천히 아래로 스크롤) | ① 선택지 카드 3개: "**Reply with the facts · Best · Chargeback 40% · cost ~$37**", "Offer a partial refund · Not offered for this case type (your policy)", "**Refund in full · Chargeback 3% · cost ~$74**" ② **[Try a rushed reply]** → 빨간 알약 "**Chargeback 95%**", 칩 "Blames buyer or customs +8 pts", "Vague timing +4 pts", "Missing: A date −7 pts" 등, 예상 비용 "**Expected cost $85**" ③ **[AI Use AI draft]** → 글자가 타이핑되며(약 9초, 편집에서 빨리 감기) "**Chargeback 40%**", "**5 good**" ✓ 칩 5개 ④ **[Details ⌄]** → 첫 줄 "**PayPal data only: Full refund $74**", ✓ Facts match · ✓ No new promises · Follow-up date "11월 19일", 오른쪽 "**Seo-yeon will see (Korean)**" 한국어 글 | **가정**: "These percentages come from **our assumed model**, not statistics." 날짜: "Code fills in the date — **a date to write back, not a delivery promise**." 헤드라인 대비: "PayPal data alone says refund $74; with the carrier record, a reply is expected to cost about $37 — under our assumptions." |
| 5 | **≤10초** | **실제 전송** (경희 녹화분, 5절) | [Send in Korean] → 브라우저 확인 창 OK → 진행 첫 줄 "Reply sent in Korean · PayPal sandbox · PP-R-GMS-10197661" | — (화면이 말한다) |
| 6 | ~5초 | PayPal 샌드박스 분쟁 화면 (경희 녹화분) | 같은 한국어 문장 2~3초. **메시지 부분만** (주문일 안 보이게) | — |
| 7 | ~15초 | Send 뒤 "**What happens next · Simulated**" (경희 녹화분에서 이어서) | "Expected steps after your reply — not real events" → "Seo-yeon replied with the customs ID · Simulated · Risk 0%" (통관번호는 P•••••••9012로 가려짐) → **[Forward to carrier]** 클릭 → "Customs ID forwarded to the carrier", "Customs released the parcel" → 토스트 "**Dashboard updated · +$37 kept**", 왼쪽 "**Done today · Simulated (1)**"(녹화 모드 글자는 [확인 필요]), 이번 주 카드 "+$37 just now" | "What happens next is **a simulated scenario** — expected steps, not real events." |
| 8 | ~8초 | Desk 왼쪽 Prevent "2 orders · Missing tracking" (경희 녹화분) | 상세 "Add tracking to 2 orders in PayPal" → **[Add all 2]** → 녹화 모드 "**✓ 2 trackers added · Orders tracking API · 201**", 버튼 "Added ✓" | — |
| 9 | ~7초 | 위쪽 막대 **[PayPal activity]** 서랍 (경희 녹화분) | 서랍 맨 위(최신)부터 Send message 200, Add tracking 201, 그 아래 Read … 200. **위 2~3줄만** 잡는다 | "The PayPal calls in this drawer are **real sandbox calls**." ("모든 단계"라고 하지 않는다 — 배송사 기록과 Send 뒤 시나리오는 실제가 아니다) |
| 10 | ~32초 | **/listing** (주소창에 직접) | "Demo mock — sample store admin, not a real shop" 띠. 상품 "Ribbed Wool Crewneck, Ivory · $89 · 200 units · Nov 20–Dec 2" → **[Publish product]** → 창 "DisputeLess API · quick check before you publish", "Simulating 500 sale periods · N / 500"(약 7초, 편집에서 줄임) → "**Chance of a dispute per order 4.5%** · About 9.0 disputes", "Expected loss **$770** · $472–$1,140 (P10–P90)" → **[See details and fix →]** → AI Insert 6개 클릭 → **`[__]` 칸을 실제 값으로 채운다** (5절 아래 예시) → **[Recalculate]** → "**2.1%**", "**$327**" → **[Publish product]** → "Published · Chance of a dispute **4.5% → 2.1%** · Expected loss $770 → $327 · Disputes ~9.0 → ~4.1" | "**Assumed rates, demo store** — nothing is published to a real shop." 창 머리의 DisputeLess API는 우리 `POST /api/listing-check`다 (PayPal 호출 없음) |
| 11 | ~6초 | **[시안 확정 대기] AG Grid 장면** | `/products`는 11/12 11:15 결정으로 없앴다. AG Grid가 들어갈 화면의 시안이 오면 채운다 | — |
| 12 | ~10초 | 로드맵 + 로고 | — | — |

합계 약 2:34. 길면 4번 장면의 타이핑과 10번의 진행 표시를 편집에서 빨리 감는다.

**넣지 않는 것**: Autopilot, Mike 장면, 가게 전체 숫자를 말로 하기, **Desk에서 [한국어] 누르기** (지금 화면이 깨진다 — 7절), /intro의 지호 "Respond →" (서연 화면으로 간다).

### 2-1. 다른 장면 (선택 — 시간이 남거나 4번 대신 쓸 때)

모두 **공개 링크(public)에서만** 찍는다. 녹화 모드의 서연 건에서는 절대 하지 않는다.

| 장면 | 하는 일 | 화면 글자 | 비고 |
|---|---|---|---|
| A. 급한 답장을 칩으로 고치기 | [Try a rushed reply] → "+ Add" 3번 → "Remove" 2번 → 95% → **40%**, "5 good" → [Translate & check] → "Checked — this is what will be sent" → [Send in Korean] | 진행은 7번과 같은 "Seo-yeon replied with the customs ID" 흐름 | Translate & check는 실시간 AI 번역 1회 (약 7초, 공개 링크 시간당 한도를 쓴다). 3차 리뷰 버그 ①(⟦SELLER_NAME_1⟧로 막힘)은 11/12 로컬 빌드에서 **재현되지 않았다** (통과, Send 켜짐) |
| B. 급한 답장을 그대로 보내면 (차지백 갈래) | [Try a rushed reply] → [Translate & check] → [Send in Korean] | "Reply sent in Korean · Simulated · **Risk 95%**" → "**Seo-yeon replied angrily**" “답이 이게 다예요? 카드사에 이의제기할게요.” → "Consider a full refund before it becomes a chargeback" **[Approve refund]** → "Refund approved · You approved · no refund was made, nothing was sent to PayPal" | 보낸 답장의 예측(ok / refund / cb)에 따라 갈래가 나뉜다 (DECISIONS 11/12 09:30). refund 갈래("Refund the order in full")는 이번에 화면으로 만들어 보지 못했다 [확인 필요] |
| C. 지호 카드 | 왼쪽 Reply needed의 "PP-R-MBJ-10197650 · Knit Cardigan" → "**Offer 15% back ($7.20), the buyer keeps it**" → [Send offer] → "Offer sent ✓ · Simulated · nothing was sent", 이번 주 카드 "+$30 just now" | 버튼 글자는 "Send offer" (금액 없음) | 녹화 모드에서 실제 제안(make-offer)은 **한 번만** 보낼 수 있다 (사람 규칙: 서연·지호 실제 전송은 녹화 때 한 번만, 제안은 보내기만 하고 수락하지 않는다). 연습은 공개 링크에서만 |

## 3. 숫자 대조표 (화면 글자 ↔ 나온 곳)

| 장면 | 화면 글자 | 나온 곳 | 바뀌는 조건 |
|---|---|---|---|
| 2 /intro | "$4,218.40", "$3,940 · 71 orders", "**Black Friday in 17 days**" | `config/intro.en.json` **고정 데모 값** (서버·엔진 값 아님) | 바뀌지 않는다. Desk 날짜 줄과 다를 수 있다 → 날짜를 말로 읽지 않는다 |
| 2 /intro | 서연 "$72.00 · Respond by Nov 30", 지호 "$48.00 · Respond by Nov 29" | 실제 PayPal 분쟁 번호·응답 기한(UTC 날짜)을 고정 문구로 | — |
| 3 Desk 위 | "Wed, Nov 11 · Black Friday in 16 days" 같은 날짜 줄 | 판매자 시간대(America/New_York) 오늘 날짜, 대목 2026-11-27 | **14:00 KST 전에는 전날**이 보인다 (아래 날짜 규칙) |
| 3 이번 주 카드 | Open disputes **3** · real PayPal sandbox cases | 실제 샌드박스 분쟁 수 | — |
| 3 이번 주 카드 | Money you can keep **$68** · vs refunding every case | 엔진: 열린 분쟁마다 (전액 환불 기대 손실 − 최선의 수 기대 손실)의 합. Assumption | 가정값. 보낸 뒤에도 $68은 그대로이고 옆에 "+$37 just now"가 붙는다 (그 건의 몫) |
| 3 이번 주 카드 | Replies drafted by AI **3** | 캐시된 AI 초안 수 | — |
| 3 머리 | "$72 · Seo-yeon Kim · Korea · Open 2 days", "8 events · 26 days" | 분쟁 금액(PayPal), 기록(시드 + 실제) | "Open N days", "N days"는 녹화일에 따라 바뀔 수 있다 |
| 3 곡선 | Dispute risk **40%** · **80% → 40%** | 엔진 위험 곡선 + `config/reply-model.json` 가중치 (가정(기획 시안)). Assumption | 가정값 |
| 4 선택지 | Reply with the facts **Chargeback 40% · cost ~$37** | 엔진 답장 기대 손실 3680¢ = 0.40 × (7200 + 1500) + 200 (승률 0.60, 수수료 $15, 시간 $2) | 가정값 |
| 4 선택지 | Refund in full **Chargeback 3% · cost ~$74** | 7200 환불 + 200 시간 | 시간 비용 $2는 가정 |
| 4 선택지 | Offer a partial refund — Not offered for this case type (your policy) | 정책(미수령 건에는 제안 안 함) | — |
| 4 급한 답장 | **Chargeback 95%**, **Expected cost $85**, Waits calmly 5% · Ends in refund 0% · Chargeback 95%, mood Angry | 코드 규칙으로 답장 특징 판정 + reply-model.json 가중치 | 가정값 |
| 4 급한 답장 칩 | Blames buyer or customs +8 pts · Vague timing +4 pts · Missing: A date −7 pts · Missing: Apology −2 pts · Missing: Next step for the buyer −2 pts · "2 to fix · 3 missing · 2 good" | 같은 모델 | 가정값 |
| 4 AI 초안 | **Chargeback 40%**, **Expected cost $37**, Waits calmly 60% · Ends in refund 0% · Chargeback 40%, Seo-yeon's mood next Annoyed (now: Angry), "5 good" | 같은 모델. 기본 초안의 비용 = 선택지 카드 $37 (일부러 맞춤, DECISIONS 11/11 T075) | 가정값 |
| 4 Details | "PayPal data only: Full refund $74" | 배송사 기록 없이 계산하면 전액 환불이 최선 ($74 vs 다툼 $75.95) | 가정값 |
| 4 Details 칩 | Apology −10 pts · Why it's held 0 pts · Next step for the buyer −10 pts · A date −22 pts · Buyer's language −12 pts | reply-model.json | 가정값 |
| 4 Details / 한국어 글 | Follow-up date **11월 19일** ("November 19") | 코드: 녹화일(UTC) + 7일. 서연 응답 기한(11/30)보다 늦으면 당긴다 | **녹화일 + 7**. 11/12 09:00 KST 이후면 11월 19일, 11/13이면 11월 20일 |
| 7 진행 | Risk 0% (각 단계), 토스트 **+$37 kept**, "+$37 just now" | 엔진 시나리오 위험 + 엔진 절감액. Assumption | 가정값 |
| 8 추적 | **2** orders (O05·O07), "Orders (4)" 안의 분쟁 주문은 "In dispute — excluded" | 분쟁 없는 미등록 주문 | 녹화 모드에서 한 번 등록하면 다음에는 "Already has tracking in PayPal"이 된다 [확인 필요] |
| 8 추적 | 공개: "Simulated · nothing was sent to PayPal / O05 · Not sent (simulated) / O07 · Not sent (simulated)", 이번 주 카드 "+$1 just now" · 녹화: "✓ 2 trackers added · Orders tracking API · 201" | PayPal 추적 API 응답 코드 | 녹화 모드 화면은 코드 문구로 확인, 화면으로는 [확인 필요] |
| 10 /listing | 4.5% · About 9.0 disputes · **$770** · $472–$1,140 · 유형 Doesn't fit 1.6% / Stuck at customs 0.9% / Color looks different 0.8% | `config/listing-model.json` (가정(기획 시안)) + 수수료 $15·시간 $2, 500회 고정 시드 | 가정값. 같은 입력이면 같은 숫자 |
| 10 /listing | 고칠 점 Add measurements −0.9 pts · customs ID −0.5 · color note −0.4 · delivery time + tracking −0.3 · peak-season −0.3 · return policy −0.2 | 같은 모델 | 가정값 |
| 10 /listing | 고친 뒤 **2.1%** · About 4.1 · **$327** · $106–$576 · "4.5% → 2.1% · $770 → $327 · ~9.0 → ~4.1" | 같은 모델 (6개 모두 고침) | `[__]`를 채운 뒤에도 2.1% / $327 (11/12 확인) |

### 날짜 규칙 (녹화 시각을 정할 때)

- **Follow-up 날짜(답장 속 "11월 19일")** = 서버 UTC 날짜 + 7일. **09:00 KST 전**에는 하루 이르게 나온다 (공식 규칙 상자).
- **Desk 위쪽 날짜 줄** = 판매자 시간대(미국 동부) 날짜. **14:00 KST 전**에는 전날이다. 예) 11/12 13:30 KST에 찍으면 "Wed, Nov 11 · Black Friday in 16 days", 14:00 KST 이후면 "Thu, Nov 12 · Black Friday in 15 days".
- 그래서 **11/12 14:00 KST 이후**에 찍으면 날짜 줄(Nov 12)과 Follow-up(Nov 19 = +7)이 서로 맞는다. 그 전에 찍으면 날짜 줄이 Nov 11이라 "8일 뒤"처럼 보인다.
- /intro의 "Black Friday in 17 days"는 고정 문구다. Desk 숫자와 다르다 → **며칠 남았는지는 말로 읽지 않는다.**
- **녹화 중에는 재배포하지 않는다.** (재배포하면 서버 메모리의 서랍 기록과 캐시가 비워진다.)

## 4. 말로 밝혀야 하는 곳 (데모 데이터 · 가정 · 실제)

- **데모 데이터** (시드에서 온 것, 화면에 Demo data 배지):
  - 배송사 추적·통관 기록 ("Oct 30 · Carrier: Customs hold – recipient customs ID missing") → 장면 3에서 **"demo data here"를 말로** (필수)
  - 서연의 11/2 문의 말풍선, 이번 주 카드, Mike의 이전 주장, 종결 분쟁 이력
  - /intro 판매자 대시보드와 /listing 쇼핑몰은 **데모용 껍데기 화면** (화면 띠에 "Demo mock")
- **가정** (화면에 Assumption 배지): 위험 %(곡선 80% → 40%, 차지백 95%·40%·3%), 손님 반응 막대, 비용 $37·$74·$85, Send 뒤 단계의 Risk %, /listing의 4.5% → 2.1%·$770 → $327. 출처는 `config/params.json`, `config/reply-model.json`, `config/listing-model.json` (뒤의 둘은 기획 시안의 가중치이고 통계가 아니다) → **장면 4에서 "our assumed model" 한 번, 장면 10에서 "assumed rates" 한 번**
- **시뮬레이션** (Simulated 배지): Send 뒤 "What happens next" 단계 전부(손님 답장·Forward to carrier·세관 통과), 공개 링크의 모든 쓰기 버튼, /listing 게시
- **실제 PayPal 샌드박스**: 분쟁 목록·상세 조회, 주문 조회, 거래 조회(200), 녹화 모드의 한국어 send-message(200)와 추적 등록(201). 가상 판매자·샌드박스라는 것은 타이틀에서
- **AI가 하는 일**: 한국어 번역, 답장 초안과 역번역, 화난 어조 판단, 사건 기록 요약, /listing 고칠 문구. **코드가 하는 일**: 원인 판정(통관 보류), 기대 손실과 추천, 날짜, 위험 %, 검사 3개, 보내도 되는지
- **하지 말 말**: "guarantees", "predicts accurately", "AI found the customs hold"(원인은 코드가 판단), "every step was a real PayPal call", "analyzes your PayPal dispute history"(/listing은 PayPal 이력을 읽지 않는다)

## 5. 실제 전송 장면 (녹화 모드, 경희가 따로 찍음)

- **녹화용 모드** `DEMO_MODE=recording` + 전송·추적 스위치 켬. 공개 링크(`public`)로는 실제 전송이 되지 않는다. 녹화 모드에서는 위쪽 막대의 "Public demo · simulated sends" 글자가 사라진다.
- **서연 전송은 딱 한 번.** 녹화가 켜진 것을 확인한 뒤 누르고, 누른 순간부터 첫 진행 줄까지 컷 없이. **장면 5는 10초 이내.**
- **서연 실제 분쟁에서 하지 않는 것**: 수락(accept), 환불(Refund in full 카드, Approve refund), 급한 답장 보내기, Translate & check로 고친 글 보내기. 녹화 모드에서는 **AI 초안 그대로**만 보낸다.
- **한 번에 이어 찍기를 권한다** (기획자가 잘라 쓴다): [Send in Korean] → 브라우저 확인 창 "This sends a real message to PayPal sandbox dispute PP-R-GMS-10197661." **OK** → "What happens next" → [Forward to carrier] → 토스트 → 왼쪽 "2 orders · Missing tracking" → [Add all 2] → 201 → [PayPal activity] 서랍. 이렇게 하면 장면 5·7·8·9가 같은 녹화 모드 화면에서 나온다. 공개 링크에서 찍은 Send 뒤 화면을 이어 붙이면 첫 줄이 "Simulated send — nothing went to PayPal"이라 실제 전송 장면과 어긋난다.
- 녹화 모드에서 바뀌는 글자 (코드 문구로 확인, **화면으로는 [확인 필요]**):
  - 보내기 줄: "Simulated send — nothing goes to PayPal" → "**Live · PayPal sandbox**"
  - 진행 첫 줄 아래: "**PayPal sandbox · PP-R-GMS-10197661**"
  - 추적: "**✓ 2 trackers added · Orders tracking API · 201**"
  - 서랍 맨 위: Send message **200**, Add tracking **201**
  - 왼쪽 묶음 제목: 실제 전송이 섞이면 "Done today" + 시뮬레이션 줄에만 "Simulated" (DECISIONS 11/12)
  - 손님 답장·Forward to carrier·세관 통과는 녹화 모드에서도 **Simulated**다
- 장면 6: PayPal 샌드박스 분쟁 화면에서 같은 한국어 문장 2~3초. 메시지 부분만 (주문일 안 보이게).
- O05·O07 추적 등록도 실제로는 한 번만 된다 (두 번째부터는 이미 등록됨). 연습은 공개 링크에서.
- 녹화 직전: 서연 화면을 열어 AI 초안의 한국어를 팀이 검수 → 그대로 녹화 → 누름 (검사에 걸리면 다시 연다). 보내기 줄이 "Live · PayPal sandbox"로 바뀌었는지 확인. 연습용 분쟁이 목록·서랍에 없는지 확인. 공개 링크로 같은 동선 3번 이상 연습. 백업 녹화.
- 경희 녹화분을 기획자에게 넘기면 장면 5·6·7·8·9 자리에 끼운다.

### /listing `[__]` 칸 채우기 예시 (장면 10)

AI Insert를 누르면 Sizes·Shipping·Returns 칸에 `[__]` 빈칸이 들어가고 노란 안내 "AI text added. Fill in each [__] with your real details before you publish."가 뜬다. 게시 전에 칸 안의 `[__]`를 지운다 (예: Size S: chest 104 cm, length 64 cm, sleeve 58 cm / Size M: chest 110 cm, length 66 cm, sleeve 60 cm, "within 2 business days", "within 30 days"). 숫자는 바뀌지 않는다. 다만 **칸 아래 파란 "AI" 상자(AI가 넣은 원문)와 노란 안내에는 `[__]`가 그대로 남는다** — 화면은 왼쪽 입력칸과 오른쪽 결과를 잡는다.

## 6. 녹화 체크 (기획자 쪽)

- [ ] 녹화 시각: 09:00 KST 이후 (가능하면 **14:00 KST 이후** — 날짜 줄과 Follow-up이 맞는다). 녹화 중 재배포 없음
- [ ] 녹화 전에 공개 링크의 네 화면을 한 번씩 열어 둔다 (첫 로드 3~7초). 서랍도 한 번 연다
- [ ] 1920×1080, 확대 100%, 밝은 화면. 언어는 **EN** 그대로
- [ ] 화면 숫자 = 3절 표 (특히 80% → 40%, 95%, $37 / $74 / $85, 4.5% → 2.1%, $770 → $327, $216 → $44)
- [ ] Follow-up 날짜 = 녹화일 + 7 (11/12면 "11월 19일")
- [ ] "demo data here"가 내레이션에 있다 (장면 3)
- [ ] "assumed" 한 번씩 (장면 4, 10), "simulated" 한 번 (장면 7)
- [ ] /intro에서는 [Handle all 2 with DisputeLess]나 서연 줄의 Respond만 누른다
- [ ] /listing `[__]` 입력칸을 채우고 Recalculate → Publish
- [ ] [시안 확정 대기] AG Grid 장면
- [ ] 배포 주소(disputeless.onrender.com)가 화면에 한 번 보인다
- [ ] 실제 전송 장면(5·6·7·8·9)은 경희 녹화분. 서연 전송 한 번뿐, 서연에게 수락·환불 없음
- [ ] Autopilot·Mike 장면 없음, 화면에 없는 기능을 말하지 않는다
- [ ] 무료 라이선스 음악, 3분 미만, YouTube 공개 링크

## 7. 확인 필요 · 알려진 문제 (11/12 로컬 빌드에서 본 것)

- **[한국어] 버튼을 Desk에서 누르면 화면이 깨진다** ("Application error: a client-side exception…"). 원인: `config/copy.ko.json`의 `case.reply.editSub`에 `{{name}}` 자리가 없다. `/products?lang=ko`도 오류가 난다. /intro와 /listing의 한국어는 정상. → 영상에서 언어 바꾸기를 쓰지 않는다. 공개 링크를 누르는 심사위원도 볼 수 있으므로 고칠지 사람 판단 필요.
- 녹화 모드 화면 글자 (5절 목록) — 코드로만 확인 [확인 필요]
- refund 갈래 진행 화면 [확인 필요]
- 추적 두 번째 등록 시 화면 글자 [확인 필요]
- 이번 주 카드 $68은 보낸 뒤에도 그대로이고 "+$N just now"만 붙는다 (3차 리뷰 ⑤). 영상에서 $68을 말로 읽지 않는다.
