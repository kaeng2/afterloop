# T126 보고 (2026-11-12 23:40)

- 기준 SPEC: v2.16 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서와 같은 커밋)

## 결과
완료 — 지호(D1) 새 사건 ZOK·B3 결정(DECISIONS 2026-11-12 20:35 컨트롤 타워 줄)에 맞춰 **시험만** 고쳤다. 코드·config·seed는 손대지 않았다. make-offer 경로 검사는 지우지 않고 시험 안에서 B1(색상) 보드로 고정해 그대로 검사한다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `tests/unit/app-case-reply-retry.test.ts` | D1_ID → `PP-R-ZOK-10200237`. 4번 묶음(제안 금액·관문 8개)의 보드를 `cause: ruleCause('B1')`로 명시 (제안 경로 그대로 검사). "표 밖 → 0회" 목록에 옛 지호 MBJ 추가 |
| `tests/unit/ops-t070-gates.test.ts` | D1_ID → ZOK. 제안 경로 보드 `JIHO`는 B1 명시. **새 시험 2개**: 지금 시드 지호(B3) recording+스위치 → send-message 1회·make-offer 0회, public → Simulated 0회 |
| `tests/unit/app-t122f.test.ts` | D1_ID → ZOK (B3 repair·⟦DAYS_1⟧ 검사는 그대로) |
| `tests/unit/app-shared.test.ts` | 화면 분쟁 D1 = ZOK. 옛 지호 MBJ는 목록에서 빠지고 `isLiveSendAllowed` 거짓 |
| `tests/unit/app-t064-activity.test.ts` | D1 = ZOK. 가짜 목록에 MBJ 추가 → 요약 "3 cases" 유지, MBJ 상세 조회는 기록에 안 남는지 검사 추가 |
| `tests/unit/app-t115.test.ts`, `tests/unit/intro-sample.ts` | 사건 줄 지호 id = ZOK. 지호 `due` = null (아래 남은 문제 1) |
| `tests/unit/seed-demo-display.test.ts` | 표시 라벨 ↔ 연결 표 대조를 `paypalDisputeId`로 찾게 바꿈 (라벨 jiho `seedDisputeId` null이라 seedDisputeId로 찾으면 MBJ 줄이 걸렸다). ZOK 줄 = D1 검사 추가 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (+9 skipped) | 0 | |
| npx vitest run tests/unit | 2784 | 1 | 실패 1 = `storefront.test.ts` 결정론 100회 (시간 흔들림, 제외 대상). 단독 실행 31/31 통과 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 0 errors | 0 | 기존 warning 5개 |

## 남은 문제
1. **`/demo/seller-dashboard` 지호 기한이 사라짐.** `config/intro.{en,ko}.json` `fallbackDue`가 옛 MBJ 키(`2026-11-29`)만 갖고 있어, 캐시가 빌 때 지호 `due`가 null이다. 캐시가 차도 ZOK는 PayPal 응답 기한이 없어 null이다. 그래서 인트로 사건 줄에서 지호만 "Respond by …"가 안 나온다. Desk는 시드 Demo data 기한을 쓴다고 결정에 적혀 있어 두 화면이 다를 수 있다. 시험은 지금 동작(null)으로 맞췄다. 코드는 고치지 않았다.
2. `seed/demo-display` jiho 라벨이 `seedDisputeId: null, orderId: null` ("T119 뒤 연결")인데 연결 표는 ZOK = D1·O02다. data 레인에서 쓰는 값이라 그대로 뒀다.
3. 지시문 26개 중 실제로 깨진 것은 storefront 흔들림을 빼면 24개였다. 그 24개를 모두 고쳤다.

## 컨트롤 타워에 요청할 결정
- 지호 인트로 기한: `fallbackDue`에 ZOK 키로 시드 Demo data 기한을 넣을지(ui config 수정), 아니면 PayPal대로 기한 없음(null)을 둘지. 넣으면 `tests/unit/intro-sample.ts` 지호 `due`도 함께 바꿔야 한다.
