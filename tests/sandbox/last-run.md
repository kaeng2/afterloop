# 샌드박스 마지막 실행 기록

> 스크립트가 덮어쓴다. 비밀값(Secret·토큰)과 구매자 개인정보는 적지 않는다.

<!-- afterloop:last-run:check -->
## 조회 (`npm run sandbox:check`)

- 시각: 2026-11-10 10:26 KST
- 토큰 발급: 성공

| 엔드포인트 | 상태 | 비고 |
| --- | --- | --- |
| GET /v1/customer/disputes | 200 | ok |
| GET /v1/reporting/transactions | 200 | ok |
| GET /v2/checkout/orders/{O01} | 200 | ok |
| GET /v2/checkout/orders/{O02} | 200 | ok |
| GET /v2/checkout/orders/{O03} | 200 | ok |
| GET /v2/checkout/orders/{O04} | 200 | ok |
| GET /v2/checkout/orders/{O05} | 200 | ok |
| GET /v2/checkout/orders/{O06} | 200 | ok |
| GET /v2/checkout/orders/{O07} | 200 | ok |
| GET /v2/checkout/orders/{O08} | 200 | ok |
| GET /v2/checkout/orders/{O09} | 200 | ok |
| GET /v2/checkout/orders/{O10} | 200 | ok |
| GET /v2/checkout/orders/{O11} | 200 | ok |
| GET /v2/checkout/orders/{O12} | 200 | ok |
| GET /v2/checkout/orders/{O13} | 200 | ok |
| GET /v1/customer/disputes/{D1} | 200 | ok |
| GET /v1/customer/disputes/{D2} | 200 | ok |
| GET /v1/customer/disputes/{D3} | 200 | ok |
| GET /v1/customer/disputes/{D2-old} | 200 | ok |

### 주문
| 키 | 주문 ID | 상태 | 캡처 ID | 추적 |
| --- | --- | --- | --- | --- |
| O01 | 18F52416PA5694135 | COMPLETED | 26293576ME0859205 | 등록 |
| O02 | 87436118KN796644C | COMPLETED | 9KU39751DX242312R | 미등록 |
| O03 | 0JN52716E5842762V | COMPLETED | 37J49051UW395951T | 미등록 |
| O04 | 41X347446X091012H | COMPLETED | 6R443601WV1920918 | 미등록 |
| O05 | 2C989125PP696130D | COMPLETED | 5XB31780D18665716 | 미등록 |
| O06 | 0RY57472G86366311 | COMPLETED | 738093067J894224T | 등록 |
| O07 | 2D396872WH366462F | COMPLETED | 7F134873EX1248734 | 미등록 |
| O08 | 8NW11847PM518611D | COMPLETED | 8HD61398JA389940N | 등록 |
| O09 | 228264493L078564R | COMPLETED | 3424812144307901H | 등록 |
| O10 | 3Y154370758458431 | COMPLETED | 2B206465U2185293S | 등록 |
| O11 | 8CW55649ER1719626 | COMPLETED | 1JM434082D896493B | 등록 |
| O12 | 2AJ52151YM544454G | COMPLETED | 514617893J4519255 | 등록 |
| O13 | 02C95899V2403943M | COMPLETED | 2J918760HG520343S | 미등록 |

### 분쟁
| 키 | 분쟁 ID | reason | 단계 | 상태 | 캡처 ID | 시연 |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | PP-R-MBJ-10197650 | MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED | INQUIRY | WAITING_FOR_SELLER_RESPONSE | 9KU39751DX242312R | 포함 |
| D2 | PP-R-GMS-10197661 | MERCHANDISE_OR_SERVICE_NOT_RECEIVED | INQUIRY | WAITING_FOR_SELLER_RESPONSE | 2J918760HG520343S | 포함 |
| D3 | PP-R-FYT-10197651 | MERCHANDISE_OR_SERVICE_NOT_RECEIVED | CHARGEBACK | UNDER_REVIEW | 8HD61398JA389940N | 포함 |
| D2-old | PP-R-GAH-10197649 | MERCHANDISE_OR_SERVICE_NOT_RECEIVED | CHARGEBACK | UNDER_REVIEW | 26293576ME0859205 | 시연 제외 |

- D2-old (PP-R-GAH-10197649): 시연 제외 — 조회만 하고 아무 조치도 하지 않는다 (시연 제외 (2026-11-10): 접수 몇 분 뒤 PayPal 심사 단계(CHARGEBACK)로 넘어감. 아무 조치도 하지 않는다 (환불 수락 금지).)

<!-- afterloop:last-run:probe -->
## 요청 ID 길이 확인 (`npm run sandbox:check -- --probe-request-id`)

- 시각: 2026-11-09 23:00 KST
- 엔드포인트: POST /v2/checkout/orders (intent CAPTURE, USD 1.00, 상품명 "Request-Id length probe")
- 이 주문은 승인·캡처하지 않고 manifest에도 넣지 않는다 (버려지는 주문).

| 시도 | ID 길이 | 상태 | 주문 ID | 비고 |
| --- | --- | --- | --- | --- |
| 61자 (1회차) | 61 | 201 | 4VU53650HC418403N | ok |
| 61자 (2회차, 같은 ID = 멱등 확인) | 61 | 200 | 4VU53650HC418403N | ok |
| 36자 (UUID, 비교용) | 36 | 201 | 7SB1374355564260G | ok |

- 멱등: 같은 61자 ID로 두 번 보내 같은 주문 ID가 돌아왔다.

<!-- afterloop:last-run:disputes -->
## 분쟁 읽기 (`npm run sandbox:disputes`)

- 시각: 2026-11-10 09:51 KST
- 엔드포인트: GET /v1/customer/disputes → GET /v1/customer/disputes/{id} (조회만)
- 분쟁 4건 · 변환 성공 4건 · 변환 실패 0건

| 분쟁 ID | reason | status | 단계 | 채널 | 금액(센트) | 기한 | 허용된 수 | 다른 링크 | 구매자 글 수 | 이전 INR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PP-R-GMS-10197661 | MERCHANDISE_OR_SERVICE_NOT_RECEIVED | WAITING_FOR_SELLER_RESPONSE | INQUIRY | INTERNAL | 7200 | 2026-11-30T00:37:46.766Z | send_message,make_offer,provide_evidence,accept_claim | escalate | 1 | 1 |
| PP-R-FYT-10197651 | MERCHANDISE_OR_SERVICE_NOT_RECEIVED | UNDER_REVIEW | CHARGEBACK | INTERNAL | 3500 | - | accept_claim | adjudicate,require_evidence,provide_supporting_info | 1 | 0 |
| PP-R-MBJ-10197650 | MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED | WAITING_FOR_SELLER_RESPONSE | INQUIRY | INTERNAL | 4800 | 2026-11-29T23:45:07.079Z | send_message,make_offer,accept_claim | escalate | 1 | 0 |
| PP-R-GAH-10197649 | MERCHANDISE_OR_SERVICE_NOT_RECEIVED | UNDER_REVIEW | CHARGEBACK | INTERNAL | 7200 | - | accept_claim | adjudicate,require_evidence,provide_supporting_info | 1 | 1 |

> 추적·배송 기록(hasTracking·hasDeliveredTracking)은 주문 상세에서 오는 값이라 여기서는 false로 두고 변환했다 (`npm run sandbox:check`가 읽는다).
