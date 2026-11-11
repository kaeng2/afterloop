# T084 검증 (43e1eb3, 기준 a123f1c)

판정: 통과. 문제 없음 (참고 2건).

1. 관문: 가짜 fetch로 직접 시험. public에서 `client()`·`reader()` 양쪽으로 send-message·make-offer·추적 등록 → 실제 POST 0회. 모드 public → recording(POST 1회 나감) → public(다시 막힘) → 이상한 값(public 취급, 막힘). 묶음 열쇠 = 모드 + baseUrl + 키 채움 여부(0/1), 비밀값 없음. 열쇠가 바뀌면 클라이언트·캐시 새로 만듦. 감싸는 순서: 클라이언트 → blockWrites → recordClient → 읽기 캐시(바깥).
2. 기록기: 캐시 적중 때 서랍 줄 수 불변 확인. 쓰기 뒤 같은 상세 다시 호출(녹화 모드) 확인.
3. 캐시: TTL 90초, 2xx만, 키=경로(쿼리 포함), 값={status, body}, 꺼낼 때 structuredClone. send.ts의 readDetail·추적 대상 고르기·transactions-line은 getPayPalClient(캐시 없음). 읽기 입구(getPayPalReadClient)는 disputes.ts·today.ts뿐.
4. 병렬: 이전 disputes.ts를 임시로 꺼내 가짜 분쟁 3건 × LLM(늘 실패/프롬프트별 답) × D2 조회 실패 유무 4가지로 비교 → toEqual 전부 통과 (임시 파일 삭제).
5. 빌드 .next/static에 금지어 0건. 열쇠·로그에 비밀값 없음.
6. build 통과, tsc 0, lint 0, test:acceptance 167 통과(9 skip), npm test 2227/2228 — storefront 결정론 5초 시간 초과 1건, 단독 재실행 31/31 통과(부하성).
7. 범위: src/app, config/copy.*(common.loading 한 키 en·ko), tests/unit, reports만. src/paypal·engine·ai·types·acceptance·send.ts·mode.ts·activity.ts 변경 0.

참고:
- send.ts의 모듈 변수 `liveClient`가 공유 클라이언트(쓰기 뒤 캐시 지움 붙은 것)를 계속 붙잡는다. 예전부터 있던 동작이고, 모드 전환은 매 호출 resolve에서 처리되지 않으나 실제 운영에서 모드는 프로세스 환경값이라 고정.
- 속도 제한(60초 30회)이 요청 사이 공유됨: 캐시가 빈 상태에서 읽기가 몰리면 기다림 가능 (구현 보고서에도 적힘). 실제 시간 재기 때 확인.

## 컨트롤 타워 시간 재기 (실제 샌드박스, 로컬 `next start` 공개 모드, 2026-11-11 22:30)
탭 이동과 같은 RSC 요청(`RSC: 1`)을 curl로 4번씩. 단위 초.

| 경로 | 병합 전 (main 36dd94d, T083 포함) | T084 뒤: 캐시 찬 상태 | T084 뒤: 95초 쉬고(캐시 만료, 토큰 재사용) |
|---|---|---|---|
| `/` | 3.59 · 3.66 · 4.51 · 3.52 | 0.05 · 0.04 · 0.05 · 0.04 | **3.18** · 0.03 · 0.07 · 0.03 |
| `/products` | 5.73 · 4.96 · 5.14 · 4.43 | 1.01 · 0.07 · 0.07 · 0.06 | 0.06 · 0.06 · 0.06 · 0.06 |
| 서연 상세 `/?item=PP-R-GMS-10197661` | 4.12 · 4.57 · 5.21 · 3.50 | 0.05 · 0.03 · 0.03 · 0.03 | 0.05 · 0.03 · 0.03 · 0.03 |

- 반복 클릭: 목표 0.5초 이하 **달성** (0.03~0.07초).
- 첫 클릭: 캐시가 빈 뒤 첫 요청은 **3.2초** — 목표 2초 **미달**. 분쟁 목록 → 상세 → 주문 조회가 차례로 이어지는 샌드박스 왕복 시간이다. 그 한 번이 캐시를 채워서 다른 탭은 바로 빨라진다.
