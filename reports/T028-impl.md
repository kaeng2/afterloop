# T028 보고 (2026-11-09 22:55)

- 기준 SPEC: v2.2 (시작할 때 `SPEC.md` 첫 줄과 같았는지: 예 — `# SPEC v2.2 (2026-11-09 22:31 KST)`)
- 브랜치 / 마지막 커밋: lane/data / `d45003c`
- 작업 폴더: `/Users/kaeng2/repositories/paypal-hackathon/afterloop-wt/data` (`pwd` 확인, data 레인 worktree)

## 결과

완료 — 시드를 SPEC v2.2 계약(`src/types.ts` 8부)에 맞췄다. 종결 분쟁 손실을 결과 종류·상품
가격·f에서 다시 만들고(합 41300¢), 분쟁 9건에 `orderId`를, 주문 214건에 `date`를 넣었다.
AC17 56건이 모두 통과한다. 수정 가능 폴더(`seed/`, `tests/unit/seed.test.ts`) 밖은 건드리지 않았다.

### 1. 종결 분쟁 손실 (Q8)

수수료 f는 `config/params.json`의 `params.feeCents.value`(1500¢)를 읽기만 하고, 손실은
결과 종류에서 만든다 (`seed/data.ts`의 `closedLossCents`). 결과 종류는 `seed/data.ts`의
draft에만 있고 JSON에는 들어가지 않는다. 대응 시간 비용 t는 더하지 않았다.

| 분쟁 | 원문 결과 | 손실 식 | 이전 | 바뀐 값 |
|---|---|---|---|---|
| D4 | 전액 환불 | 가격(4800) | 5600 | **4800** |
| D5 | 증빙 제출 후 패소 | 가격(4800) + f(1500) | 5600 | **6300** |
| D6 | 대응 지연 패소 | 가격(4800) + f(1500) | 5600 | **6300** |
| D7 | 전액 환불 | 가격(3500) | 4300 | **3500** |
| D8 | 배송 증빙으로 승소 | 0 | 0 | **0** |
| D9 | 셀러 보호 아님 (패소) | 가격(18900) + f(1500) | 19700 | **20400** |
| 합계 | | | 40800¢ ($408) | **41300¢ ($413)** |

진행 중 3건(D1·D2·D3)은 `lossCents: null` 그대로다.

### 2. 분쟁 → 주문 연결 9건 (Q10)

| 분쟁 | 주문 | 구매자 · 상품 | 추적 | 주문일 | 어떻게 정했나 |
|---|---|---|---|---|---|
| D1 | O02 | B02 지호 · 가디건 | — | 2026-10-15 | 지시서 표대로 못 박음 |
| D2 | O01 | B01 서연 · 스웨터 | ✓ | 2026-10-17 | 지시서 표대로 못 박음 |
| D3 | O08 | B04 buyer_m · 비니 세트 | ✓ | 2026-10-16 | 세 번째 주장. 못 박음 (추적 등록 확인) |
| D4 | SO003 | B08 Olivia · 가디건 | ✓ | 2026-09-02 | B08의 같은 상품 시드 주문 1건을 찾음 |
| D5 | SO002 | B07 이수민 · 가디건 | ✓ | 2026-08-25 | B07의 같은 상품 시드 주문 1건 |
| D6 | SO004 | B09 Mia · 가디건 | — | 2026-09-10 | B09의 주문. **추적 미등록**을 코드가 검사 |
| D7 | O09 | B04 buyer_m · 비니 세트 | ✓ | 2026-08-20 | 이전 주장 1 (전액 환불). 못 박음 |
| D8 | O10 | B04 buyer_m · 비니 세트 | ✓ | 2026-09-14 | 이전 주장 2 (배송 증빙 승소). 못 박음 |
| D9 | SO006 | B11 Alex · 코트 | ✓ | 2026-09-18 | B11의 주문 |

buyer_m의 주장 순서는 주문일로도 O09(08-20) → O10(09-14) → O08(10-16)이다. 9건의
`orderId`가 서로 다르다 (한 주문에 분쟁 하나). 구매자·상품 일치와 중복은 `seed/schemas.ts`의
`disputeOrderProblems`가 검사하고 `npm run seed`가 생성할 때마다 돌린다.

### 3. 주문일 (Q10)

창 2026-08-12 ~ 2026-11-10 (양끝 포함, 91일). 기준값은 `seed/schemas.ts`의
`ORDER_DATE_WINDOW` 하나이고 생성과 검증이 같이 쓴다. `Date.now`·`Math.random`은 쓰지
않고 날짜는 UTC 기준 문자열 연산으로만 만든다.

- 샌드박스 12건 + 원문 6-2 구매자 10건(SO001~SO010): `data.ts` draft에 손으로 적었다.
  서연 O01은 10-17(11/09 "벌써 3주째" 문의보다 3주 이상 앞), 진행 중 분쟁의 주문은 최근
  4주 안(10-15·10-16·10-17), 종결 분쟁의 주문은 08-20 ~ 09-18(창의 앞쪽·중간).
- 자동 생성 192건: `창 시작 + (i × 33) mod 91`일. 33과 91이 서로소라 91일을 한 바퀴 다 돌고
  다시 시작한다 → 날짜마다 2~3건. 그 구매자가 "배송이 안 온다"는 문의(A1·A2·A3·A4·F1
  신호)를 했는데 규칙 날짜가 문의일 이후면 문의일 3주 전으로 당긴다 (해당 2건: SO016, SO022).

| 월 | 건수 |
|---|---|
| 2026-08 (12일부터) | 46 |
| 2026-09 | 73 |
| 2026-10 | 74 |
| 2026-11 (10일까지) | 21 |
| 합계 | 214 |

서로 다른 주문일 91일(창 전체), 한 날짜 최대 5건, 창 밖 0건.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `seed/data.ts` | f를 `config/params.json`에서 읽음. `disputeDrafts`(결과 종류·주문 연결) + `buildDisputes(orders)`로 분쟁 생성. 주문 draft에 `date` 추가, `buildUndatedOrders`·`withOrderDates`(자동 생성 주문일 규칙 + 배송 문의 제약) 추가, `addDays`·`daysBetween` 헬퍼. `buildSeed`가 주문 → 문의 → 주문일 → 분쟁 순으로 만든다 |
| `seed/schemas.ts` | `ORDER_DATE_WINDOW`, `SeedOrder.date`(형식 + 창 범위), `SeedDispute.orderId`, 분쟁 → 주문 참조 무결성 `disputeOrderProblems` |
| `seed/generate.ts` | 생성 때마다 참조 무결성 검사(어긋나면 중단), 요약에 주문일 범위·월별 건수·분쟁 → 주문 연결 추가, SPEC v2.2 표기 |
| `seed/disputes.json` | 종결 손실 6건 재계산 + `orderId` 9건 (재생성) |
| `seed/orders.json` | `date` 214건 추가 (재생성, 다른 필드 변경 없음) |
| `seed/README.md` | 손실 식·$413, `orderId` 표, 주문일 절 추가. "orderId가 없어 고정하지 않음"·"원문 그대로"·v2.1 표기 수정 |
| `tests/unit/seed.test.ts` | 6-4 표를 새 손실·결과 종류·`orderId`로 갱신, 손실 식·f 출처·주문 연결·주문일(창·분포·이야기 순서·배송 문의 선행)·결정성 테스트 추가 |

`seed/index.ts`는 바뀐 것이 없다 (JSON을 스키마로 읽는 입구 그대로).

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/acceptance/ac17.seed.test.ts` | 56 | 0 | AC17 전부 통과 |
| `npm run test:acceptance` | 117 | 2 | 실패 2건은 AC13(paypal 레인, `.env.example` 파일 없음) — T028과 무관하며 작업 전부터 그 상태다 (9건 skip은 샌드박스 호출) |
| `npm test` | 400 | 0 | `tests/unit/seed.test.ts` 52건 포함 |
| `npx tsc --noEmit` | — | 0 | 출력 없음 |
| `npx eslint seed tests/unit/seed.test.ts` | — | 0 | 출력 없음 |

AC13 실패 2건: `.env.example이 있고 PayPal 키 자리가 있다`, `.env는 git이 무시하고
.env.example은 무시하지 않는다`. 두 테스트는 `.env.example`과 `.gitignore`만 본다 (시드를
읽지 않는다). 이 브랜치에는 `.env.example`이 아직 없다 — `ls -a | grep -i env`와
`git ls-files | grep -i env` 둘 다 빈 결과. paypal 레인에서 만들 파일이라 T028과 무관하다.

### 완료 기준 확인

- [x] AC17 통과 (56/56)
- [x] `npm test` 통과, `npx tsc --noEmit` 오류 없음
- [x] `npm run seed` 두 번 실행해도 같은 파일 — `shasum seed/*.json`을 두 실행 사이에 비교,
  5개 파일 해시 동일 (바이트 단위)
- [x] `seed/inquiries.json`·`buyers.json`·`products.json` 변경 0줄 —
  `git diff --numstat seed/products.json seed/buyers.json seed/inquiries.json`이 빈 결과
- [x] `seed/orders.json`은 `date` 추가 외 변경 없음 — 새 파일에서 `date`를 뺀 뒤 HEAD 버전과
  `JSON.stringify` 비교: 동일(true), `date` 없는 행 0건. (JSON 들여쓰기라 diff에는 행마다
  `"source"` 줄의 쉼표 추가와 `"date"` 줄 추가가 같이 보인다 — 값이 바뀐 필드는 없다)
- [x] 보고서에 손실 표·연결 9건·월별 분포

## 남은 문제

- 자동 생성 주문일은 "고르게 퍼뜨린다"는 기준만 맞춘 값이다 (주말·블프 전 수요 같은 계절성은
  없다). 화면에서 추세선을 그릴 계획이면 ui 레인이 보고 판단하면 된다. 지금은 월별 46·73·74·21,
  한 날짜 2~5건이다.
- 종결 분쟁의 주문일만 있고 **분쟁 발생일·종결일은 계약에 없다**. 화면이 "90일 안에 종결"
  같은 문구를 쓰려면 필드가 더 필요하다 (지금 범위 밖이라 넣지 않았다).
- AC13 실패 2건(`.env.example`)은 paypal 레인에서 채워야 한다.

## 컨트롤 타워에 요청할 결정

없음. 계약(`src/types.ts`)·AC17·`config/`는 읽기만 했고 고치지 않았다.

참고로 적어 두는 한 가지: `seed/data.ts`가 `config/params.json`의 `feeCents`를 직접 import
한다 (engine의 `src/engine/params.ts`와 같은 방식). CLAUDE.md "숫자 계산은 `src/engine/`에서만"
규칙과 겹쳐 보일 수 있지만, 이것은 **이미 끝난** 종결 분쟁의 실제 손실을 지시서 지시대로
결과 종류 + 가격 + f에서 만든 것이고 기대 손실·확률 계산은 하지 않는다. f가 바뀌면
`npm run seed`만 다시 돌리면 된다. 이 결합이 싫으면 컨트롤 타워가 f를 시드 전용 상수로
내려주는 쪽으로 바꿀 수 있다.
