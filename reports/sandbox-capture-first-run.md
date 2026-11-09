# 샌드박스 캡처 첫 실행 결과 (2026-11-10 08:17 KST)

컨트롤 타워가 `npm run sandbox:capture`를 처음 실행했을 때의 출력이다 (긴 문자열은 가림). 캡처를 다시 실행하면 보류·실패 표시가 사라져 구분할 수 없으므로 이 표를 보관한다.

```
| 키 | 주문 ID | 결과 | 주문 상태 | 상태 | 캡처 ID | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| O01 | 18F52416PA5694135 | captured · ok | COMPLETED | 201 | 26293576ME0859205 | ok |
| O02 | 87436118KN796644C | captured · ok | COMPLETED | 201 | 9KU39751DX242312R | ok |
| O03 | 0JN52716E5842762V | captured · ok | COMPLETED | 201 | 37J49051UW395951T | ok |
| O04 | 41X347446X091012H | captured · ok | COMPLETED | 201 | 6R443601WV1920918 | ok |
| O05 | 2C989125PP696130D | captured · ok | COMPLETED | 201 | 5XB31780D18665716 | ok |
| O06 | 0RY57472G86366311 | captured · ok | COMPLETED | 201 | 738093067J894224T | ok |
| O07 | 2D396872WH366462F | captured · ok | COMPLETED | 201 | 7F134873EX1248734 | ok |
| O08 | 8NW11847PM518611D | captured · ok | COMPLETED | 201 | 8HD61398JA389940N | ok |
| O09 | 228264493L078564R | captured · pending (ECHECK) | COMPLETED | 201 | 3424812144307901H | 정산 전이다 — `npm run sandbox:check`로 COMPLETED가 되는지 확인한다 |
| O10 | 3Y154370758458431 | captured · pending (ECHECK) | COMPLETED | 201 | 2B206465U2185293S | 정산 전이다 — `npm run sandbox:check`로 COMPLETED가 되는지 확인한다 |
| O11 | 8CW55649ER1719626 | captured · pending (ECHECK) | COMPLETED | 201 | 1JM434082D896493B | 정산 전이다 — `npm run sandbox:check`로 COMPLETED가 되는지 확인한다 |
| O12 | 2AJ52151YM544454G | captured · ok | COMPLETED | 201 | 514617893J4519255 | ok |

주문 12건: captured · ok 9 · captured · pending 3

문제:
- O09 캡처 → 201인데 캡처가 끝나지 않았다 (ECHECK). 캡처 ID는 manifest에 적었다.
- O10 캡처 → 201인데 캡처가 끝나지 않았다 (ECHECK). 캡처 ID는 manifest에 적었다.
- O11 캡처 → 201인데 캡처가 끝나지 않았다 (ECHECK). 캡처 ID는 manifest에 적었다.

캡처가 보류(PENDING)인 주문 3건(O09, O10, O11). 캡처 ID는 manifest에 적었지만 아직 정산 전이다 — `npm run sandbox:check`로 COMPLETED가 되는지 확인한다. 다시 캡처하지는 않는다.
```
