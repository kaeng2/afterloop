## 요청: sandbox 주문 생성 스크립트 (새 태스크로 등록, 레인 paypal, T002 이후)
- scripts/create-sandbox-orders.ts
  - 입력: 시드(T007)의 주문 12건 (구매자, 금액, 상품)
  - Orders v2 create(intent CAPTURE) → approve 링크 수집
  - 출력: reports/sandbox-approve-links.md (주문번호 | 구매자 | 금액 | approve URL)
- scripts/capture-sandbox-orders.ts: 브라우저 에이전트가 승인한 뒤 실행
- Secret은 .env에서만 읽고 출력·로그 금지
