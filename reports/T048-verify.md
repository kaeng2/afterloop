판정: 통과

# T048 검증 (독립 검증자)

## 범위
- `git diff main...HEAD --stat`: `reports/T048-impl.md`, `src/engine/sim.ts`(+10/-1), `src/engine/storefront.ts`(새), `tests/unit/storefront.test.ts`(새). 허용 밖 변경 없음.
- `src/types.ts`, `config/`, `tests/acceptance/`, `tests/unit/sim.test.ts` 변경 0줄. SPEC 첫 줄 v2.7.
- `sim.ts` diff: `SimPass.disputeSubtypes` 칸 + `runPass`의 `subtypes` 배열 push 한 줄과 반환값뿐. 난수 소비 줄은 그대로. `simulate` 반환 키는 `before, after, histogram, waterfall` 그대로.

## 실행
- `npm test` 종료 0 (28 파일, 1477 통과). `npx tsc --noEmit` 0. `npm run lint` 0. `npm run test:acceptance` 0 (155 통과, 9 skipped).

## simulate 불변 (핵심)
- main 체크아웃(`afterloop`, sim.ts가 main 브랜치와 동일 확인)의 `simulate`/`simulatePass`와 이 브랜치를 비교. 시드 4상품 x 처방 16조합 x 미래 수 100·500·1000 = 192건.
- `simulate` JSON 문자열 비교 192건 모두 같음. `simulatePass`는 새 칸을 뺀 나머지가 JSON 같음, 차이 0.
- `Math.random`·`Date.now`·`performance.now`·`new Date`: `storefront.ts`·`sim.ts`에 호출 없음(주석 문구만).

## 가게 합계
- 고정 사본으로 71718 / 25316. 상품별 FK-CD-OAT 21619/4366, FK-SW-NV 10988/2562, FK-CT-GR 13651/11310, FK-BN-SET 25460/7078. 합계는 상품별 합과 일치(Before·After 각각 true). 상품별 `simulate`를 직접 불러 `result`와 JSON 비교도 일치.
- 사실: 라이브 `config/params.json`·`rules.json`은 고정 사본과 `diff` 결과 동일. 라이브 설정으로 불러도 같은 값.
- 정렬: 순서 BN-SET, CD-OAT, CT-GR, SW-NV. 입력을 뒤집어도 같은 순서. 센트가 같은 동점은 재고 0인 가짜 상품 A·B·C(결과 0)로 확인: ABC → ABC, CBA → CBA (입력 순서 유지). 재고 0이 섞이면 0원이 뒤로 감.
- 돌려주는 숫자: 정수여야 할 칸은 모두 정수. 소수는 `meanDisputes`뿐(상품별 값 그대로). 엔진에서 `toDollarsRounded`를 import하지 않음.
- 같은 입력 100회 JSON 동일. deep-freeze 입력 통과, 입력 불변.
- 빈 배열: `{0,0,[]}`. 재고 0 + 정상 상품: 재고 0 상품은 `0/0`, 합계는 정상 상품만. 재고 -1: `simulate`와 같은 ZodError.

## 대표 미래
| 상품 | 평균 | 내 계산(최소 거리, 동점이면 작은 번호) | 구현 | 분쟁 전 → 후 |
|---|---|---|---|---|
| FK-CD-OAT | 4.458 | 1 | 1 | 4 → 2 |
| FK-SW-NV | 1.588 | 0 | 0 | 2 → 1 |
| FK-CT-GR | 0.746 | 1 | 1 | 1 → 1 |
| FK-BN-SET | 6.312 | 5 | 5 | 6 → 6 |
- 처방 조합 `[]`, 일부, 전부로 바꿔도 `futureIndex`와 `disputedBefore` 동일(4상품). `fixes: []`이면 After 칸이 Before와 동일.
- 주문 정보 개수 = 재고(120/80/25/(시드 BN-SET 재고)), Before·After 분쟁 true 개수가 `simulatePass` 값과 일치, 번호별 true/false도 `simulatePass`의 `disputeOrders`와 정확히 일치. 분쟁이면 유형이 있고 아니면 null, 유형은 모두 해당 상품 `rates`에 있는 것.
- After ⊆ Before: 고른 미래 4개 모두 After에만 분쟁이 난 주문 0개. 전체로 봐도(처방 15조합 x 500 미래 x 4상품) After에만 생긴 분쟁 0건.
- 유형이 바뀌는 주문: 고른 미래 4개에는 0개. 다른 미래에서는 있음(15조합 합산: CD-OAT 96, CT-GR 16, BN-SET 96, SW-NV 0). 즉 "빨간 점 4개 → 2개" 설명과 화면 점 그림은 고른 미래에서는 어긋나지 않는다. 판단: 기록만(색을 유형별로 칠할 때만 의미 있음).
- 경계: `stock: 0` → 빈 `orders`, 던지지 않음. `futures: 0` → 일반 `Error`(메시지 명확). 음수 재고 → ZodError. 모두 지시서가 허용한 선택.

## 새 타입
- `StoreProductResult`, `StoreTotal`, `DotOrder`, `RepresentativeFuture`는 `storefront.ts`에서 export. `src/types.ts`의 `Subtype`, `SimResult` 등만 import하고 계약은 안 바꿈. `SimPass`는 `sim.ts` export.

## 발견한 문제
- 병합 차단: 없음.
- 병합 후 수정: 없음.
- 기록만:
  1. 구현 보고서는 "시드 4상품의 대표 미래에서 유형 변경이 실제로 생기는지 따로 고정하지 않았다"고 적었다. 사실 확인 결과 4개 모두 0건이다(위 표). 보고서 주장과 모순은 아님.
  2. `futures: 0`에서 `simulateStore`는 `simulate`가 던지는지에 의존한다(이번에 별도 확인하지 않음).

## 구현 보고서 주장 대조
- 숫자(71718/25316, 상품별 값, 대표 미래 번호, 분쟁 전후), 테스트 통계(1477/155), "변경 없음" 주장 모두 사실과 일치. 사실과 다른 주장은 찾지 못했다.

## 확인하지 못한 것
- `futures: 0`일 때 `simulateStore`/`simulate`의 동작(탐침하지 않음).
- 라이브 설정이 나중에 바뀌었을 때의 값(현재는 고정 사본과 동일).
- 화면(T013/T014) 연결은 범위 밖.
- 탐침 스크립트: 스크래치패드 `t048-verify/p1.mts`, `p2.mts`, `p3.mts`.
