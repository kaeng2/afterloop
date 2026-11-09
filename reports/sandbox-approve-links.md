# 샌드박스 승인 링크 (주문 12건)

> `npm run sandbox:orders`가 2026-11-09 23:13 KST에 덮어썼다. 승인 링크 12건 / 주문 12건.

**브라우저 에이전트**: 아래 링크를 한 건씩 열어 그 행의 샌드박스 구매자 계정으로 로그인해 결제를 승인한다 (계정 비밀번호는 사람이 넣는다).
링크는 모두 `sandbox.paypal.com` 도메인이다 — 다른 도메인(특히 live `www.paypal.com`)이 나오면 즉시 멈추고 사람에게 알린다.
**12건을 모두 승인한 뒤** 컨트롤 타워가 `npm run sandbox:capture`로 캡처한다 (승인 전에는 캡처되지 않는다).

| 주문번호 | 구매자 | 금액 | approve URL |
| --- | --- | --- | --- |
| O01 | seoyeon = Seoyeon Kim | $72.00 | https://www.sandbox.paypal.com/checkoutnow?token=9ET81805AB9247946 |
| O02 | jiho = Jiho Park | $48.00 | https://www.sandbox.paypal.com/checkoutnow?token=5J704232P71983619 |
| O03 | yuki = Yuki Tanaka | $48.00 | https://www.sandbox.paypal.com/checkoutnow?token=4BC01975WG886551L |
| O04 | yuki = Yuki Tanaka | $72.00 | https://www.sandbox.paypal.com/checkoutnow?token=0LA77641A9101490G |
| O05 | yuki = Yuki Tanaka | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=9W409470WN743960Y |
| O06 | lena = Lena Mueller | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=60A07934HY930524R |
| O07 | lena = Lena Mueller | $48.00 | https://www.sandbox.paypal.com/checkoutnow?token=2GK62605DF520833E |
| O08 | buyer_m = Mike Morgan | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=4E5425170D714234X |
| O09 | buyer_m = Mike Morgan | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=1VU57699F6239261R |
| O10 | buyer_m = Mike Morgan | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=1KG27296T6352720H |
| O11 | buyer_m = Mike Morgan | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=37M54694X6556714J |
| O12 | buyer_m = Mike Morgan | $48.00 | https://www.sandbox.paypal.com/checkoutnow?token=8K5917389U7016629 |
