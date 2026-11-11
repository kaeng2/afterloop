# T082 보고 (2026-11-11 22:05)

- 기준 SPEC: v2.11 (지시서) / 실제 SPEC.md는 v2.12 — 아니오(다름). 바뀐 것은 8-3장(Scene 3)뿐이라 컨트롤 타워 결정으로 진행
- 브랜치 / 마지막 커밋: lane/ui-perf (ui 레인 임시 사본) / 커밋 해시는 `git log -1` 참고

## 결과
완료. 분쟁 읽기가 분쟁이 걸린 주문의 실제 추적 등록 여부를 주문 상세 GET으로 읽고, 사건 기록은 "확실히 없음(false)"일 때만 "No tracking in PayPal"을 만든다. 읽지 못하면 "모름"이라 만들지 않는다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_server/disputes.ts` | `readOrderTracking`: manifest(disputes.orderKey → orders.orderId)로 주문을 찾아 `GET /v2/checkout/orders/{id}` → `isOrderUntracked` 반대값. 한 번의 `loadDemoDisputes`에서 같은 주문 1회만 조회, 실패·404·주문 못 찾음 = 모름. `deps.realTracking`을 주입하면 기존처럼 그 값 사용 |
| `src/app/_shared/dispute-view.ts` | **(지시서 수정 가능 폴더 밖, 아래 요청 참고)** `LoadedDispute.trackingUnknown?: boolean` 선택 필드 추가 |
| `src/app/cases/history.ts` | `trackingUnknown`이면 `hasTrackingInPayPal = null` (사건 안 만듦) |
| `tests/unit/t082-tracking-real.test.ts` | 새 시험 5건 (가짜 클라이언트) |

엔진 보드(`boardReal.hasTracking`): 서연·지호 false(실제 미등록), Mike true. 모름이면 기존 자리값(false) 유지 → 서연 보드·신호·"PayPal data only" 값은 모름일 때와 완전히 같음을 시험으로 확인(`toEqual`).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm test | 2286 | 1 | `storefront.test.ts` 결정론 100회가 5초 제한 초과(병렬 부하). 단독 실행은 31건 통과. 이 작업과 무관 |
| vitest 전체(`npx vitest run`) 1회차 | 2458 | 1 | 같은 시험 시간 초과 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run test:acceptance | 177 (+9 skip) | 0 | |
| npm run build | 통과 | 0 | |

완료 기준 대조: Mike→등록됨→tracking_missing 없음 / 서연·지호→있음 / 조회 실패→없음 ✔; 서연 값·선택지 불변 ✔; POST 0회(`callCount`=0) ✔.

## 남은 문제
- `storefront.test.ts` 결정론 시험이 부하 때 5초 제한에 걸려 간헐 실패(엔진 레인, 이번 변경과 무관).
- 이 환경에서 실제 PayPal을 부르지 않았다(가짜만). 실제 샌드박스에서 Mike 사건이 사라지는지는 확인하지 않음.
- 기존 시험들의 가짜 클라이언트는 주문 경로에 404를 돌려주므로 "모름" 경로를 탄다(값은 이전과 동일).
- `RealTracking.hasDeliveredTracking`은 주문 조회로 알 수 없어 실제 조회 경로에서는 false로 둔다(이전 기본값과 같음).

## 컨트롤 타워에 요청할 결정
- 사건 기록에서 "모름"을 구분하려면 `LoadedDispute`에 표지가 필요해 `src/app/_shared/dispute-view.ts`에 선택 필드 1개를 추가했다. 지시서 수정 가능 폴더 밖이므로 병합 전에 허용 여부를 확인해 달라(타입 계약 `src/types.ts`는 건드리지 않음). 불허하면 되돌리고 다른 방식을 정해 달라.
