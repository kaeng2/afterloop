판정: 통과

# T019 독립 검증 (2026-11-10)

## 근거
- 범위: `git diff main...HEAD --stat`은 4개 파일(`reports/T019-impl.md`, `src/paypal/transactions.ts`, `tests/unit/transactions.test.ts`, `tests/fixtures/transaction-search.json`)뿐이다. `src/types.ts`·`config/`·`tests/acceptance/`·`scripts/`·`package.json` 변경은 0줄이다.
- 고정 사본: 이메일은 `@example.test`, 이름은 Fakegiven 등, 주소는 "123 Fake Street, Faketown", `account_id`는 FAKEPAYERID처럼 모두 명백한 가짜다. 실제처럼 보이는 개인정보는 없다.
- 실행: `npm test` 33 파일 / 1585 통과 / 실패 0. `npx tsc --noEmit` 출력 없음(종료 0). `npm run lint` 출력 없음(통과). `npm run test:acceptance` 155 통과, 9 skipped, 실패 0.
- 조회만: 코드에 `.call(`·POST·`console.*`·`Date.now()` 호출이 없다(주석 언급뿐). 탐침에서 `call`을 단 가짜 클라이언트의 POST 호출은 모든 시나리오에서 0회였다. 모든 `get` 경로는 `/v1/reporting/transactions?`로 시작한다.
- 기간 나누기: 31일 이하는 1조각, 32일은 31일 + 1일, 93일은 31일 단위 3조각(겹침 없음, 처음·끝 일치)이었다. 94일 이상, 시작 > 끝, 날짜가 아닌 글자, 달력에 없는 날(2월 30일)은 호출 0회로 `invalid_range`를 돌려준다. `splitRange`는 빈 배열을 돌려준다. 쿼리는 `start_date=...T00:00:00%2B0000`, `end_date=...T23:59:59%2B0000`, `fields=all`, `page_size`, `page` 순으로, UTC 기준이며 PayPal 문서 꼴(`+0000`)이다.
- 여러 쪽: `total_pages` 3이면 3번 부르고 합친다(3건, 해당 상품 주문 3·수량 6). `total_pages` 1000이면 20번에서 멈추고 `unexpected_response`로 실패한다(일부만 세지 않음).
- 변환: "72.00"은 7200, "0.5"는 50, 음수는 `refundCount`에만 들어가고 `sales`에는 없다. 상태가 P인 거래는 세지 않는다. 금액 "1,234.50"은 `unexpected_response`다. 상품별·국가별 합계는 판매 행과 일치했다.
- 개인정보: `payer_info`(이름·이메일·주소·`account_id`)와 `shipping_info`에 넣은 표식 PII가 성공 결과, 실패 결과, 캐시 저장값 어디에도 없었다.
- 실패: 401·403은 `not_permitted`, 429는 `rate_limited`, 500은 `paypal_unavailable`이다. 예외는 `status`가 있으면 그 상태로 가르고, `status`가 없거나 문자열·null이 던져져도 `paypal_unavailable`이다. 이상한 모양 5종은 모두 `unexpected_response`다. 예외나 응답 본문의 "Bearer TOK"·SECRET 문구는 결과에 옮겨지지 않았다.
- 캐시: 14분 뒤 재호출은 호출 0회, `cached: true`, `fetchedAt`이 처음 읽은 시각이었다. 16분 뒤에는 다시 읽었다(`cached: false`). 범위가 다른 두 요청은 키가 달라 섞이지 않았다(`startDate_endDate`). 새로 읽다 429로 실패하면 옛 값 + `cached: true` + `refreshFailed: rate_limited`다. `client === null`이면 호출 없이 캐시만 보고, 캐시가 없으면 `paypal_unavailable`이다. 시각은 `deps.now()`로만 들어오므로 시험이 쉽다.

## 구현 보고서 대조
- 사실과 다른 주장은 찾지 못했다. 테스트 수치(18개, 1585, 155/9 skipped)와 동작 설명이 모두 맞다. "SPEC 첫 줄과 같았는지: 예"도 v2.8로 맞다. 마지막 커밋 칸은 "(커밋 직후 확인)"으로 비어 있다.
- "지시서에 없던 판단": `unexpected_response`일 때 옛 캐시가 있으면 `refreshFailed`를 `paypal_unavailable`로 돌리는 것은 합리적이다. 지시서의 `refreshFailed` 타입에 해당 값이 없고, 화면 입장에서는 새로 읽지 못했다는 신호만 필요하다. 다만 원인(응답 꼴 변경)이 이 신호에서 사라지므로, 실호출 때 꼴 문제인지는 캐시 없이 한 번 확인하면 구분된다.
- `client === null`이고 캐시가 TTL을 지났으면 옛 값에 `refreshFailed: paypal_unavailable`을 붙이는 판단도 지시서 취지(실패 시 캐시)에 맞는다.
- 품목 금액 대체, `lastRefreshedAt`을 조각 중 가장 이른 값으로 두는 것 등 나머지 판단도 모순이 없다.

## 발견한 문제
- 병합 차단: 없음.
- 병합 후 수정: 없음.
- 기록만:
  1. 거래 날짜가 UTC로 바뀌어 `-0700` 늦은 시각은 다음 날로 표시된다. 의도된 동작이고 보고서에도 적혀 있다.
  2. `end_date`가 `T23:59:59`이고 `page_size` 기본 100이라 하루 100건이 넘으면 쪽이 늘지만, 20쪽 상한이 있다. 샌드박스 규모에서는 문제가 없다.
  3. 실패 시 `invalid_range`는 `fetchTransactions`를 직접 부르면 일반 `Error`로 던져진다(공개 진입점 `getTransactions`는 정상). 화면은 `getTransactions`만 부르므로 영향이 없다.

## 확인하지 못한 것
- 실제 PayPal 응답 꼴. 컨트롤 타워의 실호출 결과로 칸 이름이 맞는다고 전해 받았을 뿐 직접 확인하지 않았다.
- `src/app/`에서의 실제 연결(이 작업 범위가 아님).
- 다중 조각에서 조각 경계 중복 거래 한 번만 세기와 `lastRefreshedAt`은 탐침으로 새로 돌리지 않았다. 단위 테스트가 있고 통과했다는 것까지만 봤다.
