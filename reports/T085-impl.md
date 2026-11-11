# T085 보고 (2026-11-11 21:50)

- 기준 SPEC: v2.12   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/engine / 01f08a0 (코드), 이 보고서는 다음 커밋

## 결과
완료 — SPEC 8-3장 절차(시드 seedBase + units, `mulberry32` 하나, run → 주문 → 유형 순서로 매번 u·v·w 3개, 이미 분쟁 난 주문에서도 뽑음, 실수 비교)를 그대로 구현했다. AC34는 처음 실행에서 10개 모두 통과(건너뛰기 0). 고정 숫자와 다른 곳이 없어 인수 테스트에 이의 없음.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/listing.ts` (새) | `detectListingFeatures`, `checkListing`, `createListingSim`(step/done/result), `listingFixGains`, 도우미 `listingParamsFromConfig`·`listingModelFromConfig`·`isPeak`·`listingRates`, 상수 `LISTING_FIX_KEYS`·`LISTING_MAX_UNITS`. 순수 함수, 설정 JSON은 import (fs·서버 코드 없음 → 브라우저에서 돈다). 입력·params zod 검사 |
| `tests/unit/listing.test.ts` (새) | 14개: params 기본값, 성수기 경계(겹침 하루 / 하루 차이로 안 겹침), 배수·승률 바뀜, 입력칸별 판정(다른 칸 글은 무시, 한국어), step 경계(0·1·501·끝난 뒤), progressChunkRuns 나눠 돌리기 = 한 번에, 같은 입력 같은 결과, fixGains 0·숫자, 잘못된 입력 예외 |

## 구현 메모
- 난수를 배열에 쌓지 않고 순서대로 뽑는다 (메모리 = 횟수별 손실 500개뿐).
- 유형별 `meanLossCents` = round(그 유형 손실 합 / runs). 전체 평균 손실도 round(합 / runs). P10·P90 = 오름차순 정렬의 floor(runs×0.1)·floor(runs×0.9)번째.
- `listingFixGains`: 같은 입력(같은 시드)으로 판정만 그 하나를 참으로 바꿔 다시 돌린 주문당 확률 차이. 이미 참이면 0, 성수기 아님 + bf면 null.
- bf 배수는 SPEC 식대로 성수기 여부와 상관없이 판정이 참이면 곱한다 (fixGains만 성수기 밖 bf를 null로 둔다).
- `result()`는 부를 때마다 새 객체를 만든다 (호출한 쪽이 고쳐도 계산기 상태는 그대로).
- **입력 검사**: priceCents·units 양의 정수, **units 상한 5000** (`LISTING_MAX_UNITS`), saleFrom·saleTo `YYYY-MM-DD` 형식. params: fee·time 0 이상 정수, refundShare 0~1. 어기면 ZodError. saleFrom > saleTo는 막지 않는다 (지시서에 없음. 겹침 식이 그대로 판정).
- `step(n)`: n을 0 이상 정수로 내림, 무한대면 끝까지, 남은 횟수보다 크면 끝까지. 돌려주는 값 = 실제로 끝낸 횟수.

## 계산 시간 (node v20.20.0, 이 기계, tsx)
| 계산 | 시간 |
|---|---|
| `checkListing` 200개 × 500회 (워밍업 뒤 20회 평균) | 8.7 ms |
| `listingFixGains` (기본 1회 + 고칠 점 6회 = 7번 계산) | 63.3 ms |
| `checkListing` 5000개 × 500회 (상한) | 246 ms |

한 프레임 20회(progressChunkRuns) ≈ 0.35 ms (200개 기준)라 화면 진행 표시에 여유가 있다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 | 0 | AC34 10/10, 건너뛰기 0. 전체 건너뛰기 9개는 ac13 샌드박스(RUN_SANDBOX) 기존 것 |
| npm test | 2221 | 0 | 새 listing.test.ts 14개 포함 |
| npx tsc --noEmit | 오류 0 | | |
| npm run lint | 오류 0 | | |
| npm run build | 성공 | | |

실제 AI·PayPal 호출 없음, 개발 서버 실행 없음.

## 남은 문제
- 없음. T087 화면은 `createListingSim(input).step(model.progressChunkRuns)`를 프레임마다 부르고 돌려받은 수를 "n / 500"으로 보이면 된다.

## 컨트롤 타워에 요청할 결정
- 없음
