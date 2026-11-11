# T083 검증 보고 (독립 검증)

대상: `lane/paypal-client` 886ef52 (기준 a123f1c). 판정: **통과**

## 1. 명령 (886ef52 분리 체크아웃)
| 명령 | 결과 |
|---|---|
| npm test | 55 파일, 2210 통과, 실패 0 |
| npx tsc --noEmit | 오류 0 (build 전 오래된 .next/types 때문에 한 번 오류가 났으나 build 후 재실행 0) |
| npm run lint | 오류 0 |
| npm run test:acceptance | 167 통과 (+9 skipped), 실패 0 |
| npm run build | 성공 |

## 2. 이전 구현과 결과 동일
a123f1c의 `track.ts`를 임시 파일로 꺼내 새 구현과 같은 가짜 클라이언트에 넣었다 (끝나고 삭제).
n = 0, 1, 5, 6, 7, 13, 20건 × 지연 3종(뒤 주문이 먼저 끝남 / 앞이 먼저 / 0ms) = 21건 + 예외 1건, 전부 `toEqual` 일치, GET 경로 집합도 같음.
섞은 입력: 성공, 404(debug_id), 503 예외(status·debugId), 문자열 throw, 본문 null 200, 500 텍스트 본문, 추적 있음(tracked), 분쟁 주문(2개짜리 포함).

## 3. 실패 처리
- 한 건 실패(비200 / throw / 문자열 throw) → 그 행만 unknown + 이전과 같은 note, 나머지 계속. 동일 확인.
- `client.get`이 동기로 던져도 try 안이라 행 단위로 잡힘 (이전과 같음).
- 행 함수 밖(`disputes`가 null 등)에서 던지는 경우: 이전·새 구현 모두 같은 TypeError로 reject (같음).
- 행 함수 안에서 try 밖의 예외는 없다 (분쟁 행 만들기는 순수 계산).

## 4. client.ts와 충돌 여부 (코드 확인)
- `waitForSlot`: `deps.now()` 확인과 `recent.push`가 await 없이 이어져 동시 호출이 자리를 겹쳐 잡지 않는다. 가득 차면 각자 sleep 후 다시 확인 (30회/60초 보장).
- 토큰: `issueOnce`가 `issuing` Promise를 공유 → 동시 6건이어도 발급 1회. 401은 `replaceToken`이 같은 방식으로 공유.
- 429·5xx 재시도는 요청 1건 안에서만 일어나 동시성과 무관. 토큰 발급 호출도 속도 제한에 포함됨.
- 상한 6 ≤ 속도 제한 30. 동시 실행으로 클라이언트 불변식이 깨지는 곳 없음.
- 참고: 한 호출이 429 대기 등으로 오래 걸려도 풀(worker)은 다음 주문을 못 가져갈 뿐 결과 순서는 유지됨.

## 5. 범위
`git diff a123f1c 886ef52 --stat`: reports/T083-impl.md, src/paypal/track.ts, tests/unit/track.test.ts 3개만. 범위 밖 변경 없음.

## 문제
- 없음. (구현 보고서가 적은 커밋 해시 e5d28dd는 886ef52와 다르나 다음 커밋이 보고서라 정상.)
- 검증 후 임시 파일 삭제, 작업 트리 깨끗. 시작 시 `reports/T081-verify.md`가 수정 상태여서 스크래치에 백업해 두고 되돌렸다.
