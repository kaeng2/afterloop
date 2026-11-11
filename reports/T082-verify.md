# T082 검증 (66e3576, 기준 6d16001)

판정: **통과**

## 1. 명령
- npm test: 61파일 2287건 통과 (이번에는 storefront도 통과; 단독도 31건 통과)
- npm run build 통과, npx tsc --noEmit 0, npm run lint 0, npm run test:acceptance 177 통과(9 skip)

## 2. 완료 기준
- Mike(O08) 등록됨 → tracking_missing 없음, 서연·지호 미등록 → 있음, 조회 실패(예외·404) → 없음(모름): 구현 시험 5건이 확인.
- 서연 보드·신호는 모름일 때와 실제 false일 때 toEqual 동일 (시험 + 내 가짜 입력으로 buildCaseView 전체 JSON 동일 확인). 지호도 동일.

## 3. Mike 값 변화 (가짜 입력: 모름(false 자리값) → 실제 등록됨)
- "PayPal data only" 기대 손실(선택지 fight): $77.65 ($78) → $37.60 ($38). 승률 0.15 → 0.60 (lose 0.85 → 0.40).
- 자동 처리 판정: awaiting_approval → skipped(low_confidence). 가짜 환경에서 AI 분류가 없어 원인 신뢰도 0.00이 되는 부수 효과라, 실제 AI가 붙으면 다를 수 있음(이 판정 변화는 검증 불가).
- "With carrier data"(보드 후 칸)는 변화 없음. 지시서 3번이 요구한 변화이며 값만 기록.

## 4. GET·캐시·관문
- 새 조회는 `client.get`만 사용(POST 0회: 가짜 call 호출 시 예외, 카운트 0). 실제 경로는 `getPayPalReadClient()`(= 읽기 캐시 reader)를 거침. 경로 `/v2/checkout/orders/<id>`는 캐시 대상 정규식과 일치.
- 읽기 캐시를 씌운 가짜로 loadDemoDisputes 2회 호출: 첫 호출 GET 7회(주문 3 포함) → 두 번째 호출 추가 0회. 같은 호출 안에서도 주문은 1회씩.
- 공개 모드 관문(mode.ts, paypal.ts) 변경 0.

## 5. 범위
변경: disputes.ts, history.ts, dispute-view.ts(+2줄), 새 시험 t082-tracking-real.test.ts, impl 보고서. send·mode·activity·engine·ai·paypal·types·acceptance 변경 0.
dispute-view.ts의 `trackingUnknown?: boolean`은 화면 내부 타입(`LoadedDispute`, src/app/_shared)이고 계약 `src/types.ts`가 아님. 선택 필드라 기존 사용처 호환. 의견: 허용 가능 (모름과 거짓을 구분할 다른 길이 boardReal.hasTracking의 3값화인데 이는 계약 변경이라 더 나쁨).

## 문제/주의
- 없음 (차단 수준). 실제 샌드박스 호출은 하지 않았다.
