# seed/ — 데모 시드 데이터 (T007, data 레인)

모든 화면이 쓰는 데모 데이터다. 기준: **SPEC v2.1**, 원문(PRD v2) 6장.

```
npm run seed    # 아래 JSON 5개를 다시 만들고 zod 검증 후 요약 출력 (DB 적재는 T025)
npm test        # tests/unit/seed.test.ts — 원문 표와 대조
```

| 파일 | 건수 | 원문 |
|---|---|---|
| `products.json` | 4 | 6-1 |
| `buyers.json` | 12 (B01~B12) | 6-2 |
| `inquiries.json` | 31 (표 8 + 자동 생성 23) | 6-3 |
| `disputes.json` | 9 (D1~D9) | 6-4 |
| `orders.json` | 214 (샌드박스 12 + 시드 202) | 4-1, 6-1, 6-5 |

소스: `schemas.ts` (zod, `src/types.ts` 8부와 1:1) · `data.ts` (표 값 + 결정적 자동 생성) · `generate.ts` (CLI) · `index.ts` (화면·테스트용 입구).

## 규칙

- **결정적이다.** `Math.random`을 쓰지 않는다. 고정 시드 난수(mulberry32)로 순서만 섞고 건수는 할당량으로 못 박는다. 두 번 돌리면 바이트까지 같은 파일이 나온다 (단위 테스트가 확인).
- **LLM을 쓰지 않는다.** 자동 생성 문의는 `data.ts`의 고정 템플릿이다. 한국어는 존댓말 템플릿이고 팀이 검수한다.
- **계산하지 않는다.** 주문 금액은 원문 6-1의 상품 가격을 옮기기만 한다. 분쟁 확률·기대 손실은 engine 레인(`config/params.json`)이다.
- **이름은 모두 가상이다.** 이메일·주소·개인통관고유부호 값은 넣지 않는다 (단위 테스트가 확인).
- `source: 'sandbox'`는 T001이 샌드박스에 실제로 만드는 행, `source: 'seed'`는 화면에 **'Demo data' 배지**가 붙는 행이다 (SPEC 10장).

## 값을 정할 때 쓴 해석

| 항목 | 원문 | 시드에 넣은 값 | 근거 |
|---|---|---|---|
| 국가 | "한국 · 미국 · 일본 · 독일 · 영국" (6-2) | ISO 코드 `KR` `US` `JP` `DE` `GB` | SPEC 9-5·AC13이 ISO 코드를 쓴다 |
| 체크리스트 빈 항목 | 자연광 사진 / 색상 고지 / cm 사이즈표 / 한국어 통관 안내 / 서명 배송 기준 (6-1) | `Natural-light photos` / `Color disclosure` / `Size chart in cm` / `Korean customs notice` / `Signature on delivery` | 화면이 영어다 (SPEC 4장). UI 레인이 문구 키로 받길 원하면 컨트롤 타워 결정 필요 |
| 자동 생성 문의 유형 | 배송 12 · 사이즈 6 · 색상 3 · 기타 2 (6-3) | `data.ts`의 `type` (배열 순서로 묶음) | `SeedInquiry`에 유형 필드가 없다. 파일에서는 앞 8건이 표, 뒤 23건이 자동 생성 |
| 자동 생성 구매자 | 없음 | `X001`~`X192` | 6-2는 '핵심 12명'만 적는다. 나머지 주문의 구매자는 `X` 접두사로 구분한다 |
| 자동 생성 문의가 붙는 구매자 | 없음 | 문장이 가리키는 상품·추적 상태와 맞는 주문이 있는 구매자 | 문장(`data.ts`의 `requireSkus`·`requireTracked`)과 그 구매자의 주문이 어긋나지 않게 한다. 한국어는 한국 주문, 영어는 미국 주문 구매자에게 붙는다 |
| 국가 비율 | US 45 · KR 25 · JP 15 · DE 15 (4-1) | US 95 · KR 53 · JP 31 · DE 31 · GB 4 (= 214) | 6-2의 B12(Sophie B.)가 영국이라 GB 4건을 먼저 빼고 남은 210건을 최대 잉여법으로 나눴다. 각 비율 오차 0.6%p 이하 |
| 추적 등록 | "60%" (4-1), 샌드박스 7/12 (6-5) | 128 / 214 (59.8%) | 샌드박스 7 + 6-2 구매자 7 + 자동 생성 114 |
| 종결 분쟁 손실 | 합 $408 (6-4) | 5600 · 5600 · 5600 · 4300 · 0 · 19700 = 40800¢ | SPEC 13장 Q8 "원문 그대로" |

## T001(paypal 레인)과 맞물리는 부분

`orders.json`의 샌드박스 12건은 **자리표시자**다. `id`가 `O01`~`O12`이고, T001이 쓰는
`tests/sandbox/manifest.json`의 `orders[].key`와 같은 값이어야 한다 (AC13이 그 키로 조회한다).

**배정의 정본은 `tasks/T001.md`의 "주문 12건 배정" 표다.** 시드는 그 표의 키·구매자·상품·추적
여부를 행마다 그대로 옮겨 적는다 (T026의 주문 생성 스크립트도 같은 표를 따른다). 아래 표는
옮겨 적은 결과이고, 단위 테스트(`tests/unit/seed.test.ts`의 "샌드박스 12건이 tasks/T001.md 배정
표와 행마다 같다")가 표 값과 직접 비교한다. 배정을 바꿔야 하면 시드가 아니라 `tasks/T001.md`를
먼저 고친다 (컨트롤 타워 결정).

| id | 구매자 | manifest `buyer` | SKU | 추적 | 분쟁 |
|---|---|---|---|---|---|
| O01 | B01 김서연 | `seoyeon` | FK-SW-NV | ✓ (D2 통관 보류 메모) | D2 INR |
| O02 | B02 박지호 | `jiho` | FK-CD-OAT | — | D1 SNAD |
| O03 | B03 Yuki T. | `yuki` | FK-CD-OAT | — | — |
| O04 | B03 Yuki T. | `yuki` | FK-SW-NV | — | — |
| O05 | B03 Yuki T. | `yuki` | FK-BN-SET | — | — |
| O06 | B05 Lena K. | `lena` | FK-BN-SET | ✓ | — |
| O07 | B05 Lena K. | `lena` | FK-CD-OAT | — | — |
| O08 | B04 buyer_m*** | `buyer_m` | FK-BN-SET | ✓ | D3 INR |
| O09 | B04 buyer_m*** | `buyer_m` | FK-BN-SET | ✓ | — |
| O10 | B04 buyer_m*** | `buyer_m` | FK-BN-SET | ✓ | — |
| O11 | B04 buyer_m*** | `buyer_m` | FK-BN-SET | ✓ | — |
| O12 | B04 buyer_m*** | `buyer_m` | FK-CD-OAT | ✓ | — |

추적: 등록 7 (O01, O06, O08~O12) · 미등록 5 (O02~O05, O07).

D3은 F1(반복 주장) 규칙이 걸려야 하므로 배송 완료 기록이 있는 주문에 붙는다
(`config/rules.json`의 `abuse.minPriorInrDisputes`). 표대로면 buyer_m의 비니 주문 4건
(O08~O11)이 모두 추적 등록이고, 분쟁 D3·D7·D8이 그 중 세 건에 걸린다. `SeedDispute`에 주문
ID가 없어서 **어느 주문인지는 시드에서 고정하지 않는다** (계약에 `orderId`를 넣을지는 컨트롤
타워 결정 사항이다).

샌드박스 12건이 바뀌어도 전체 합계는 그대로다: 나머지 202건은 상품별(62·48·33·71)·국가별·추적
할당량에서 남은 몫을 자동으로 채우므로, 샌드박스 쪽 상품·추적 배정이 바뀌면 자동 생성 주문의
상품·추적만 그만큼 반대로 움직인다.
