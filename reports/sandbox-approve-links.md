# 샌드박스 승인 링크 (주문 12건)

> `npm run sandbox:orders`가 2026-11-10 07:41 KST에 덮어썼다. 승인 링크 12건 / 주문 12건.

> `-- --fresh`로 12건을 다시 만들었다 (요청 ID 접미사 r202611100741). 나머지 행은 그대로다 — 승인·캡처된 주문은 링크 대신 상태를, 손대지 않은 주문은 지난 링크를 적었다. 이전 주문 ID는 manifest의 previousOrderIds에 남아 있다.

**이 파일은 마지막 실행이 쓴 것만 쓴다. 승인을 시작한 뒤에는 `--fresh`를 다시 실행하지 않는다.**
(`--fresh`는 아직 승인 전인 주문을 새 주문으로 바꾼다. 승인·캡처된 주문은 그대로 두고 링크 자리에 상태를 적는다.)

**브라우저 에이전트**: 아래 링크를 한 건씩 열어 그 행의 샌드박스 구매자 계정으로 로그인해 결제를 승인한다 (계정 비밀번호는 사람이 넣는다).
링크는 모두 `sandbox.paypal.com` 도메인이다 — 다른 도메인(특히 live `www.paypal.com`)이 나오면 즉시 멈추고 사람에게 알린다.
**12건을 모두 승인한 뒤** 컨트롤 타워가 `npm run sandbox:capture`로 캡처한다 (승인 전에는 캡처되지 않는다).

| 주문번호 | 구매자 | 금액 | approve URL |
| --- | --- | --- | --- |
| O01 | seoyeon = Seoyeon Kim | $72.00 | https://www.sandbox.paypal.com/checkoutnow?token=18F52416PA5694135 |
| O02 | jiho = Jiho Park | $48.00 | https://www.sandbox.paypal.com/checkoutnow?token=87436118KN796644C |
| O03 | yuki = Yuki Tanaka | $48.00 | https://www.sandbox.paypal.com/checkoutnow?token=0JN52716E5842762V |
| O04 | yuki = Yuki Tanaka | $72.00 | https://www.sandbox.paypal.com/checkoutnow?token=41X347446X091012H |
| O05 | yuki = Yuki Tanaka | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=2C989125PP696130D |
| O06 | lena = Lena Mueller | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=0RY57472G86366311 |
| O07 | lena = Lena Mueller | $48.00 | https://www.sandbox.paypal.com/checkoutnow?token=2D396872WH366462F |
| O08 | buyer_m = Mike Morgan | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=8NW11847PM518611D |
| O09 | buyer_m = Mike Morgan | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=228264493L078564R |
| O10 | buyer_m = Mike Morgan | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=3Y154370758458431 |
| O11 | buyer_m = Mike Morgan | $35.00 | https://www.sandbox.paypal.com/checkoutnow?token=8CW55649ER1719626 |
| O12 | buyer_m = Mike Morgan | $48.00 | https://www.sandbox.paypal.com/checkoutnow?token=2AJ52151YM544454G |

## 추가 주문 O13 (2026-11-10 09:11 KST, Q14-B 시도)

> 서연의 미수령 분쟁을 **추적번호 없는 주문**에 다시 접수해 보기 위한 주문 1건이다. 위 12건은 캡처가 끝났으니 건드리지 않는다.
> 승인하면 `https://example.com/afterloop/return?...`으로 넘어간다. 그 화면이 뜨면 승인이 끝난 것이다.
> 추적번호는 등록하지 않는다. 승인 뒤 컨트롤 타워가 이 주문만 캡처한다.

| 주문번호 | 구매자 | 금액 | approve URL |
| --- | --- | --- | --- |
| O13 | seoyeon = Seoyeon Kim | $72.00 (Wool Sweater, Navy) | https://www.sandbox.paypal.com/checkoutnow?token=02C95899V2403943M |
