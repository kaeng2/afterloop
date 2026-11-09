# 샌드박스 마지막 실행 기록

> 스크립트가 덮어쓴다. 비밀값(Secret·토큰)과 구매자 개인정보는 적지 않는다.

<!-- afterloop:last-run:check -->
## 조회 (`npm run sandbox:check`)

- 시각: 2026-11-09 23:01 KST
- 토큰 발급: 성공

| 엔드포인트 | 상태 | 비고 |
| --- | --- | --- |
| GET /v1/customer/disputes | 200 | ok |
| GET /v1/reporting/transactions | 200 | ok |

manifest가 비어 있어 주문·분쟁 조회는 건너뛰었다 (1단계).

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

- 시각: 2026-11-09 23:30 KST
- 엔드포인트: GET /v1/customer/disputes → GET /v1/customer/disputes/{id} (조회만)
- 분쟁 0건 · 변환 성공 0건 · 변환 실패 0건

0 disputes (empty list)
