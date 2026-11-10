# T048 보고 (2026-11-10 12:42)

- 기준 SPEC: v2.7   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/engine / f4c655d (구현), 이 보고서는 다음 커밋

## 결과
완료 — `src/engine/storefront.ts`에 `simulateStore`(가게 합계, 센트 정수 합)와 `pickRepresentativeFuture`(점 그림용 대표 미래)를 만들었다. `sim.ts`는 `SimPass`에 `disputeSubtypes` 칸만 더했고 난수 소비·`simulate` 결과는 그대로다 (`sim.test.ts` 변경 0줄, 전부 통과).

## 화면이 부르는 방법
```ts
import { simulateStore, pickRepresentativeFuture } from '@/engine/storefront';
const store = simulateStore(seedProducts, [...FIX_ORDER]);   // S1: store.beforeCents → toDollarsRounded, store.afterCents, store.products(정렬됨)
const dots = pickRepresentativeFuture(simInputFor(sku, product, fixes)); // S2: dots.orders[i].disputedBefore / disputedAfter / subtypeBefore / subtypeAfter
```
이름은 지시서 제안 그대로 (`StoreTotal`, `StoreProductResult`, `DotOrder`, `RepresentativeFuture`). 바꾼 이름 없음.

## 계산 결과 (고정 사본 `params.fixture.json`·`rules.fixture.json`, 처방 4개 모두 켬)
| 상품 | before ¢ | after ¢ | 대표 미래 | 분쟁 전 → 후 |
|---|---|---|---|---|
| FK-BN-SET | 25460 | 7078 | 5 | 6 → 6 |
| FK-CD-OAT | 21619 | 4366 | 1 | 4 → 2 |
| FK-CT-GR | 13651 | 11310 | 1 | 1 → 1 |
| FK-SW-NV | 10988 | 2562 | 0 | 2 → 1 |
| **합계** | **71718** | **25316** | | (표시 `$717 → $253`) |

표 순서 = `store.products` 순서 (before 큰 순서). 지시서의 직접 계산값과 모두 일치 (단위 테스트에 고정).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/sim.ts` | `SimPass.disputeSubtypes: Subtype[][]` 추가 (`disputeOrders`와 같은 모양). `runPass`에서 걸린 유형을 push만. 난수 순서·개수·비교 변경 없음. `simulate` 반환값에는 넣지 않음 |
| `src/engine/storefront.ts` (새) | `simulateStore`, `pickRepresentativeFuture`와 타입 4개 |
| `tests/unit/storefront.test.ts` (새) | 27개 테스트 (완료 기준 전 항목 + `disputeSubtypes` 모양 확인) |

## 구현이 정한 것
- `futures: 0` → `pickRepresentativeFuture`는 `Error('… futures가 0이라 고를 미래가 없습니다')`를 던진다. `stock: 0`은 던지지 않고 `{ futureIndex: 0, orders: [], disputesBefore: 0, disputesAfter: 0 }`.
- `simulateStore([])` → `{ beforeCents: 0, afterCents: 0, products: [] }`. 상품 입력은 zod(`sku` 비어 있지 않음, `priceCents`·`stock` 음이 아닌 정수)로 검증하고 다른 칸(`itemName` 등)은 무시한다. `productRates`에 없는 sku는 `simInputFor`의 기존 예외.
- 대표 미래 거리 비교는 `|분쟁 수 × futures − Σ 분쟁 수|` 정수 비교, 동점이면 작은 번호 (테스트 안의 단순 구현·동점 사례로 확인).
- 처방 후 유형이 바뀌는 경우: **생긴다.** 손으로 만든 입력(`rates {A1: 0.5, B1: 0.5}`, `tracking_24h`)에서 Before A1 → After B1 주문이 나온다 (테스트로 확인). 시드 상품 4개의 대표 미래에서 실제로 생기는지는 따로 고정하지 않았다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 155 | 0 | 9 skipped (기존) |
| npm test | 1477 | 0 | 28 파일 |
| npx tsc --noEmit | 통과 | 0 | 출력 없음 |
| npm run lint | 통과 | 0 | 출력 없음 |

## 남은 문제
- 없음. (FK-BN-SET 6 → 6, FK-CT-GR 1 → 1처럼 빨간 점이 줄지 않는 상품의 화면 처리는 지시서 3번대로 T013 몫)

## 컨트롤 타워에 요청할 결정
- 없음
