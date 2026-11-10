# T019 보고 (2026-11-10)

- 기준 SPEC: v2.8   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/paypal-client / (커밋 직후 `git log -1`로 확인)

## 결과
완료. 거래 조회(GET만) + 변환 + 서버 메모리 캐시를 `src/paypal/transactions.ts`에 만들었고, 가짜 `PayPalClient`만 쓰는 단위 테스트 18개가 통과한다. 실제 PayPal 호출·`.env` 접근은 하지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/paypal/transactions.ts` | 새 파일. `lastDays`·`splitRange`·`buildTransactionsPath`, `fetchTransactions`, `createMemoryTransactionCache`, `getTransactions`, 타입 export |
| `tests/unit/transactions.test.ts` | 새 파일. 18개 |
| `tests/fixtures/transaction-search.json` | 새 파일. 손으로 만든 가짜 응답 (실제 응답 복사 아님) |

## 쓴 상수 (설정 파일을 못 고쳐 `transactions.ts` 안에 둠)
`TRANSACTION_CACHE_TTL_MS = 15분`(결정 3번), `MAX_RANGE_DAYS_PER_CALL = 31`, `MAX_RANGE_DAYS_TOTAL = 93`, `MAX_PAGES_PER_CHUNK = 20`(넘으면 일부만 세지 않고 `unexpected_response`), 기본 `page_size` 100(최대 500).

## 가짜 응답이 맞춘 PayPal 칸 이름
`GET /v1/reporting/transactions` 응답: `transaction_details[].transaction_info.{transaction_id, transaction_initiation_date, transaction_amount.{currency_code,value}, transaction_status, transaction_event_code}`, `payer_info.country_code`(+ 걸러내기 시험용 가짜 이름·이메일·`account_id`·전화), `shipping_info`(가짜 주소), `cart_info.item_details[].{item_name, item_quantity, total_item_amount}`, 최상위 `total_pages`·`page`·`last_refreshed_datetime`. 실제 응답과 다를 수 있다 — 실호출 때 확인 필요(아래).
요청 `start_date`/`end_date`는 `YYYY-MM-DDT00:00:00+0000` / `T23:59:59+0000`.

## 화면(S2)이 부르는 방법
1. 서버 코드가 `getTransactions(client, lastDays(Date.now(), 30 또는 90), { now: Date.now, cache })`를 부른다 (캐시는 프로세스에 하나, `createMemoryTransactionCache()`). 결정 1번은 "지난 30일"이다.
2. `ok`이면 `summary.saleCount`로 "PayPal sandbox · 거래 N건"을 보이고 `cached`이면 'cached' 배지 + `fetchedAt`을 붙인다. `refreshFailed`가 있으면 "새로 읽지 못함"으로 알린다.
3. `summary.byItem`을 `seedProducts[].itemName`과 맞추는 일·배지 문구는 ui 레인 일이다. 녹화 직전 실호출로 캐시를 데운다(T025).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/unit/transactions.test.ts` | 18 | 0 | |
| `npm test` | 1585 (33 파일) | 0 | |
| `npx tsc --noEmit` | 통과 | - | 출력 없음 |
| `npm run lint` | 통과 | - | 경고·오류 없음 |
| `npm run test:acceptance` | 155 (9 skipped) | 0 | skipped는 이 작업과 무관 |

## 구현 판단 (지시서에 없던 것)
- 품목 행 금액: `total_item_amount`가 있으면 그것, 없고 품목이 하나뿐이면 거래 금액, 그 밖은 `null`. USD 아니면 `null`.
- `byItem.orderCount`는 그 품목이 든 **서로 다른 거래 수**(같은 거래에 같은 품목 2행이어도 1).
- `lastRefreshedAt`은 조각들 중 **가장 이른** `last_refreshed_datetime`(가장 늦게 반영된 쪽 기준).
- `date`는 `transaction_initiation_date`를 UTC로 바꾼 날짜(예: `-0700` 23:30 → 다음 날).
- 나라 코드는 대문자 2글자일 때만 받고 아니면 `null`.
- 상태 `S`가 아니거나 금액이 0인 거래는 세지 않는다. 이벤트 코드는 판정에 쓰지 않았다(상태+금액 부호만).
- 새로 읽다 응답 꼴이 틀렸을 때(`unexpected_response`) 옛 캐시가 있으면 `refreshFailed`는 `paypal_unavailable`로 돌려준다(타입에 `unexpected_response`가 없어서). 캐시가 없으면 `unexpected_response` 그대로.
- `client === null`이고 캐시가 TTL을 지났으면 옛 값을 `cached: true` + `refreshFailed: 'paypal_unavailable'`로 돌려준다.
- T002 클라이언트는 403/429(재시도 소진 후)를 예외 없이 상태로 돌려주고 401 반복·5xx 소진은 `status`를 단 예외를 던진다. 둘 다 처리한다.

## 실호출 때 컨트롤 타워가 볼 것 (조회만)
- 기간: 지난 30일, 조각 1개(≤31일), `fields=all`.
- `ok`/`reason`: 401·403이면 앱에서 'Transaction search' 미사용 또는 반영 전(SPEC 9-4).
- 건수: `saleCount`, `refundCount`, `byItem`(시드 상품명과 맞는지). 샌드박스 주문은 13건뿐(시드 214건과 다름).
- `lastRefreshedAt`(응답의 `last_refreshed_datetime`)과 `fetchedAt`. 최근 거래가 몇 시간 늦게 반영될 수 있다.
- 실제 응답에서 `item_quantity`·`total_item_amount`·`item_name`이 가정대로 오는지(틀리면 `unexpected_response`로 실패하므로 바로 드러난다). `cart_info`가 없는 거래는 `saleCount`에는 들어가고 `sales` 행은 없다.

## 남은 문제
- 실제 응답 꼴은 문서 기준 추정이라 실호출 전까지 미확인.

## 컨트롤 타워에 요청할 결정
- 없음 (결정 1~4는 반영함. 계약 `src/types.ts`는 건드리지 않았다).
