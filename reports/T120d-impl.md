# T120d 보고 (2026-11-12 20:55)

- 기준 SPEC: v2.16 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/engine / (이 보고서와 같은 커밋)

## 결과
완료. `meanRisk(values)` 추가: 0~1 확률의 산술평균, 빈 목록 null, 유한수가 아니거나 0~1 밖의 값이 있으면 null. 순수 함수, 입력 불변. 다른 엔진 코드는 건드리지 않음.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| src/engine/mean-risk.ts | `meanRisk` |
| tests/unit/mean-risk.test.ts | 단위 시험 4건 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (9 skipped) | 0 | 16 파일 전부 통과 |
| npm test | 2698 | 2 | 아래 참고 (내 변경과 무관) |
| npx tsc --noEmit | - | - | `.next/types/validator.ts`의 기존 오류만 (src 오류 없음) |

실패 2건:
- `tests/unit/app-t091.test.ts` 모션 "타이핑 34ms마다 2글자": 기대값이 v6 변경(타이핑 32ms/1글자, 커밋 bc19d4c) 이전 값. UI 레인 소관.
- `tests/unit/storefront.test.ts` 결정론 100회: 전체 실행 중 부하로 시간 초과. 단독 실행은 통과 (31/31).

## 남은 문제
- 위 app-t091 기대값 갱신 필요 (UI 레인).
- 화면이 `meanRisk`를 쓰도록 연결하는 일은 이 작업 범위 밖.

## 컨트롤 타워에 요청할 결정
- 없음
