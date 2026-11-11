판정: 통과

# T062 검증 (커밋 11f219d, 사본 verify-tmp2)

## 1. 범위
- 바뀐 파일 13개: src/app/products/* 9개, config/copy.en·ko.json, tests/unit/app-product.test.ts, reports/T062-impl.md. `_shared`도 안 바뀜(탭 연결 불필요했음).
- `src/app/_server/`, 엔진, AI, PayPal, params/rules json, seed, 인수 테스트, package.json: 0줄.
- copy: en/ko 키 387 = 387, 같은 집합. `product.` 키 43개 (보고서는 42개로 적음, 사소한 차이). 사본에 .env 없음 (.env.example만).

## 2. 실행
npm test 2004 통과 0 실패 / tsc 0 / lint 0 / test:acceptance 158 통과 + 9 skip, 0 실패 / build 종료 0 (/products 25 kB).
`.next/static` 검색: AFTERLOOP_ 0, client_credentials 0, api-m.sandbox 0, LLM_API_KEY 0, PAYPAL_CLIENT 0, getTransactions·PayPalClient·getLlm·loadTransactionLine·colorNoteFor·oauth2/token·Authorization·process.env·server-only 모두 0. 비밀값·서버 전용 코드 없음.
- "Hannah"·"Fernwood" 각 1곳(같은 청크): 엔진이 `config/rules.json` 전체를 import해서 들어간 `names.sellerSignature: "Hannah, Fernwood Knits"` 데모 서명. 비밀값 아님. 다만 엔진 쪽 구조 때문이라 이번 작업 범위 밖이고, 브라우저에서 엔진을 다시 계산하는 설계의 부수 효과다. 참고로만 기록.
- `writeColorNote` 1건은 클라이언트 prop 이름이고, 서버 AI 함수는 아니다.

## 3. 완료 기준 (직접 스크립트로 엔진과 대조 후 삭제)
- 처방 0개: 엔진 $216 / $67–$360 / 4.46 → 화면 $216 / $67 / $360 / 4.5, after=null (as-is 하나만).
- 처방 4개: 엔진 after $44 / $0–$104 / 2.07 → 화면 $44 / $0 / $104 / 2.1. 달러 반올림과 일치 (분쟁 수는 소수 첫째 자리 표기).
- 점 그림: 점 120개, 빨간 점 0개 처방 4→4, 4개 처방 4→2 = `pickRepresentativeFuture` 전·후 값과 동일, 화면 점 수와도 같음.
- 처방 카드 4개 FIX_ORDER 순서, 배지: Runs in PayPal / You add it · AI writes it / "Simulated — not sent in this demo"(점선 2px 스타일 CSS) / Runs in PayPal after your OK.
- 색상 문구: 서버 액션이 null이거나 예외면 자리(state hidden) 전체 사라짐, 기본 문구 없음. 한국어 한 줄 크게, 나머지는 `<details>`.
- 폭포·분포·전후 막대: 소스에 waterfall/histogram/distribution 0건.
- 왼쪽 목록: 가디건 `$216 → $44`, 비니+스카프 $255→$71, 코트 $137→$113, 스웨터 $110→$26 (엔진 simulateStore 값·순서). 행마다 as-is와 with fixes가 함께.
- 정적 검사: 화면 코드(`products/*.ts(x)`)에 `$숫자`, 세 자리 이상 정수, 소수, toFixed, Math.round, /100 없음. product 문구의 숫자는 제목 "24h"와 자리표시자뿐 (금액·건수 없음). guarantee/보장/예측 정확도 없음.
- 재계산: 토글 1회(가운데 + 카드 4 + 목록 4행) 이 환경에서 평균 약 45ms (구현 보고서 최악 77.7ms). 서버 왕복 없이 브라우저에서 `model.ts` 호출. 0.5초 기준 충분.

## 4. 거래 조회 한 줄
- `transactions-line.ts`는 `import 'server-only'`, `page.tsx`(서버 컴포넌트)에서만 부름. 브라우저 묶음에 PayPal 클라이언트·getTransactions 없음(위 검색 0). GET 조회만, 예외·실패면 null → 줄 숨김. `cached`면 CachedBadge. 예상 손실 카드 밖에 둠. 문구 "PayPal sandbox · {{count}} transactions (last {{days}} days)". 서버 코드는 `_server/paypal`의 `getPayPalClient`를 읽기만 함.

## 5. 구현 보고서 사실 확인
- "could save" 대신 두 엔진 값 나란히: 사실. 꺼진 카드 "Turn on: $216 → $170", 켜진 카드 "On. If off: $44 → $90" 형태, 두 값 모두 엔진 `simulate().after.meanLossCents`이고 화면이 빼지 않음. 지시서 문구와는 다르므로 컨트롤 타워가 수용 여부를 정해야 함 (엔진이 처방별 절감 함수를 안 내줌, 지시서 규칙 1·T013 "절감액은 적지 않는다"와는 일치).
- 색상 문구는 색상(B1) 분쟁 이력이 있는 상품만: 사실 (`colorComplaintsFor`; 현재 가디건만).
- 토글 상태는 새로고침하면 4개 모두 켬: 사실 (`useState([...ALL_FIXES])`, 주소에 안 둠. 상품을 바꿔도 유지).
- **기본값 "4개 모두 켬" vs 지시서**: 지시서는 기본 켬/끔 상태를 명시하지 않는다. "켠 처방이 없으면 as-is 하나만 + Turn on a fix…"와 "Turn all on" 링크만 규정. 기본 4개 켬이면 첫 화면은 큰 숫자 "$216 → $44"를 둘 다 동시에 보인다(as-is $216이 왼쪽 큰 숫자로 항상 보임). 다만 영상 흐름("$216을 보고 켜서 $44")을 하려면 녹화 때 카드 4개를 먼저 끄거나(처방 0개 상태는 $216 하나만 보임) 처방 하나씩 켜서 시작해야 한다. 지시서 위반은 아니지만 영상용 기본값을 "모두 끔"으로 할지는 컨트롤 타워 결정 사항.
- 보고서의 "토글 클릭 동작은 브라우저에서 직접 확인 필요": 맞음. 이번 검증도 서버·브라우저를 띄우지 않았고 클릭 동작은 미확인.

## 기타
- 실제 AI·PayPal 호출 0회. 코드·설정 수정 0 (git status 깨끗, 임시 스크립트 삭제).
