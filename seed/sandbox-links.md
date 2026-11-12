# 샌드박스 승인 링크 (지호 품질 사례, 표시 번호 #1038)

승인은 사람이 한다. 링크는 `sandbox.paypal.com` 도메인이다 — 다른 도메인(특히 live `www.paypal.com`)이 나오면 즉시 멈춘다.
캡처는 승인 뒤 컨트롤 타워가 `npm run sandbox:capture`로 한다 (manifest의 나머지 주문은 captureId가 있어 건너뛴다).

| 주문번호 | 구매자 | 금액 | 주문 ID | approve URL |
| --- | --- | --- | --- | --- |
| O20 (#1038) | Ji-ho Park (jiho) | $48.00 | 6R4577433P6975506 | https://www.sandbox.paypal.com/checkoutnow?token=6R4577433P6975506 |
