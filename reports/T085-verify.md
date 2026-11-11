# T085 검증 (a364ce8, 기준 088488d)

판정: 통과

| 항목 | 결과 |
|---|---|
| npm test | 2220 통과 / 1 실패 — tests/unit/storefront.test.ts "결정론 100회" 5초 시간 초과. 단독 실행은 통과(4.8초), 기준 088488d에서도 같은 시험이 같은 방식으로 실패 → 기존 부하 의존 문제, T085와 무관. listing.test.ts 14/14 통과 |
| tsc --noEmit | 오류 0 (build 전·후) |
| lint | 오류 0 |
| test:acceptance | 177 통과, AC34 10/10, 건너뛰기 0 (전체 9개는 ac13 샌드박스 기존) |
| build | 성공 |
| SPEC 8-3 대조 | 일치. 독립 구현(스크래치, 삭제함)과 무작위 입력 40개 비교: features·peak·평균 분쟁·평균 손실·P10·P90·유형별 건수/확률/손실 전부 같음 |
| 모델 값 | 코드에 박힌 값 없음 (units 상한 5000, 날짜 형식, 0.1/0.9 분위는 SPEC·지시서 값). f·t·refundShare는 params.json |
| 브라우저 | import는 zod, config JSON 2개, ./rng, 타입뿐. fs·path·process·Date·Math.random 없음. rng.ts도 순수 |
| createListingSim | 나눠 step(0~69 무작위) 40회 모두 결과 = checkListing (JSON 동일). step 반환값 = 누적 끝낸 횟수 (0,1,500,500…; 20,40,500), 끝나기 전 result() 매번 예외 |
| listingFixGains | 이미 참 → 0, 성수기 밖 bf → null 확인 |
| 범위 | listing.ts, tests/unit/listing.test.ts, reports/T085-impl.md만 (+410). 인수 테스트·types·config 변경 0 |

메모: 보고서의 커밋 01f08a0은 코드 커밋, a364ce8은 보고서 커밋 (문제 아님). saleFrom > saleTo는 막지 않음 (보고서에 명시).
