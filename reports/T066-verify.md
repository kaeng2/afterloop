판정: 통과

# T066 검증 (커밋 84eeb73, 브랜치 lane/engine)

## 1. 범위
- `git diff main...lane/engine` 파일: `src/engine/storefront.ts`(+33), `tests/unit/storefront.test.ts`(+31/-1), `reports/T066-impl.md`. 이 셋뿐.
- `storefront.ts` 변경은 타입 `PreventPick`과 함수 `pickPreventProduct` 추가뿐. `simulateStore`, `pickRepresentativeFuture` 본문 변경 0.
- 테스트 파일은 import 한 줄 수정과 새 `describe` 추가뿐. 기존 테스트 변경 없음.
- SPEC 첫 줄: v2.10 일치.

## 2. 실행
| 명령 | 종료 코드 | 결과 |
|---|---|---|
| npm test | 0 | 39 파일, 1830 통과, 실패 0 (storefront 31건, 시간 초과 실패 없이 첫 실행에 통과) |
| npx tsc --noEmit | 0 | 오류 없음 |
| npm run lint | 0 | 경고·오류 없음 |
| npm run test:acceptance | 0 | 158 통과, 9 skipped (기존), 실패 0 |

## 3. 완료 기준
- 현재 설정·시드 `simulateStore(전 상품, [...FIX_ORDER])` -> `FK-CD-OAT`, `cutPercent` 80: 단위 테스트 통과로 확인.
- 교차 곱 비교: 코드 `(before-after)*best.before` 대 `(best.before-best.after)*before`, 정수만 사용 (나눗셈 없음). 경계 스크립트로 확인.
  - 3/1 vs 10/6 -> 앞쪽(비율 2/3) 선택.
  - 거의 같은 큰 정수(9007199/4503599 vs 9007198/4503599) -> 엄밀한 비교 결과 대로 선택.
- 동률: 비율 같고 before 다르면 큰 쪽 (200/100 이 100/50 보다 앞/뒤 어디에 있어도 B). 비율·before 같으면 입력 순서 앞 (A,B -> A / B,A -> B).
- before 0 제외: [Z(0,0), A] -> A. 전부 0 -> null. 빈 목록 -> null.
- 기타: after 가 before 보다 커도 예외 없음 (cutPercent 음수가 아니라 비교상 선택됨; 위 입력에서는 0%), after 0 -> 100. 입력 배열 불변 확인.
- 순수 함수: 함수 본문에 설정·파일 읽기 없음 (`paramsConfigFromFile` 등 미사용), `Math.random`/`Date` 없음. 가짜 StoreTotal 로 호출해도 동작.
- 스크립트는 작업 후 삭제, `git status` 깨끗.

## 반올림 0.5 경계 (`Math.round(((b-a)*100)/b)`)
| before / after | 정확값 % | cutPercent |
|---|---|---|
| 200 / 101 | 49.5 | 50 |
| 200 / 99 | 50.5 | 51 |
| 1000 / 995 | 0.5 | 1 |
| 1000 / 994 | 0.6 | 1 |
| 8 / 3 | 62.5 | 63 |
| 3 / 1 | 66.67 | 67 |
| 1000 / 501 | 49.9 | 50 |
- 정확히 .5 는 위로 올림 (half up, 양수 기준). 작업 지시의 `round(...)` 와 일치. (비정수 나눗셈 오차 우려는 없음: 분자 `(b-a)*100` 이 정수이고 .5 는 이진 부동소수로 정확히 표현됨.)

## 지적 사항
없음 (차단 사항 없음).
