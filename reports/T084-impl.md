# T084 보고 (2026-11-11 21:52)

- 기준 SPEC: v2.11   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-perf / f702a67 (구현). 이 보고서는 그다음 커밋

## 결과
완료 — PayPal 클라이언트를 프로세스당 하나로 묶고(토큰 재사용), 분쟁 목록·상세·주문 조회에 요청 사이 90초 캐시를 붙였다. 분쟁 상세 3건·보드·어조 판정은 병렬로 돌고, Today (N)은 Suspense로 떼어 냈으며, `(app)/loading.tsx` 로딩 표시와 Products 토글 `startTransition`을 넣었다. 화면 숫자·문구·순서는 그대로다. 관문(`blockWrites`)과 기록기(`recordClient`)는 순서를 바꾸지 않고 그대로 감싼다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_server/paypal.ts` | `createSharedPayPal`: 프로세스에 하나. 감싸는 순서는 그대로(클라이언트 → public이면 `blockWrites` → `recordClient`), 읽기 캐시는 그 **바깥**에 둔다. 묶음 열쇠 = 모드 이름 + 샌드박스 주소 + 키 3개의 채움 여부(0/1). 비밀값·Client ID는 넣지 않는다. `getPayPalClient()`를 인수 없이 부르면 공유 클라이언트(읽기 캐시 없음, 쓰기 뒤 캐시 지움)를 준다. `env`나 `deps`를 넘기면(시험) 예전처럼 매번 새로 만든다. 새 입구 `getPayPalReadClient()`는 공유 클라이언트에 90초 읽기 캐시를 붙인 것 |
| `src/app/_server/read-cache.ts` (새 파일) | 90초 TTL 캐시. 대상은 `/v1/customer/disputes…`와 `/v2/checkout/orders/<id>`, 2xx만 담는다. 동시에 들어온 같은 조회는 진행 중 Promise 하나를 함께 쓴다. 꺼낼 때마다 복사본(`structuredClone`)을 준다. 쓰기(`call`)가 끝나면 성공·실패 상관없이 관련 키를 지운다: 분쟁 쓰기는 목록 + 그 분쟁 상세, 추적 등록은 그 주문, 모르는 경로는 전부. 세대 번호를 둬서, 지우는 중에 진행 중이던 읽기가 옛 값을 다시 넣지 못한다 |
| `src/app/_server/disputes.ts` | 읽기 클라이언트를 `getPayPalReadClient()`로 바꿨다. 상세 3건은 `Promise.all`로 함께 읽고 결과는 연결 표 순서대로 모은다. 분쟁마다의 처리도 `Promise.all`로 돌리고, 한 분쟁 안의 `buildBoard` 실제·시연 두 벌과 `judgeTone`도 함께 기다린다. `demoFields` 순서(`cause`가 `earlierInquiries` 앞)는 그대로 |
| `src/app/_server/today.ts` | 추적 조회도 `getPayPalReadClient()`로 바꿨다 |
| `src/app/_server/llm-cache.ts` | `cachedLlm`·`startCacheRecording`에 같은 키 동시 호출 공유를 더했다. 병렬로 바꾼 뒤 같은 프롬프트(실제·시연 보드 분류 등)가 동시에 캐시를 놓치면 실제 호출과 public 시간당 한도를 두 번 썼다. 기존 시험 `ops-t070-cache`가 이것을 잡았다(11 → 15) |
| `src/app/(app)/layout.tsx` | 위쪽 막대를 `<Suspense>`로 뗐다. 읽는 동안은 같은 막대에 "Today"만 보이고(날짜 줄은 `dateLine(new Date())`로 같은 값), 다 읽으면 지금과 같은 "Today (N)"이 된다 |
| `src/app/(app)/loading.tsx` (새 파일) | 탭 이동 로딩 표시: 강조색 막대 + `common.loading` 문구 |
| `src/app/_shared/top-bar.tsx` | `todayCount`를 선택값으로 바꿨다(없으면 `nav.today`). 값이 있을 때 출력은 그대로 |
| `src/app/_shared/shell.css` | `.app-loading` 스타일. 강조색 변수만 쓰고, `prefers-reduced-motion`이면 움직이지 않는다 |
| `src/app/products/products-screen.tsx` | `onToggle`·`onAllOn`을 `startTransition`으로 감쌌다. 계산은 그대로 |
| `config/copy.en.json`, `config/copy.ko.json` | `common.loading` 키를 더했다 ("Loading…" / "불러오는 중…"). 두 파일 키 집합은 같다. 지시서 4번이 정한 대로 수정 가능 폴더 밖이다 |
| `tests/unit/app-t084-perf.test.ts` (새 파일) | 완료 기준 시험 21개 |
| `tests/unit/app-t079.test.ts` | layout이 Today를 읽는지 세는 시험이 Suspense 자식까지 그리도록 바꿨다. mock에 `getPayPalReadClient`를 더했다 |

`_server/send.ts`, `mode.ts`, `activity.ts`, `src/paypal/**`는 바꾸지 않았다. 쓰기 뒤 캐시 지우기는 send.ts가 아니라 공유 클라이언트의 `call` 감싸개가 한다. 그래서 보내기·제안·추적 등록이 모두 같은 길로 지운다.

## 완료 기준 대조
| 기준 | 결과 | 근거 |
|---|---|---|
| 공개 모드 쓰기 0회 | 통과 | `T084 3`: public에서 `client()`·`reader()` 두 입구로 send-message·make-offer·track 각 3회 → 실제 POST 0회, 토큰도 0회. 서랍에는 "Simulated · not sent"(status null)로 남는다. `registerTrackingFromScreen` 두 번 → POST 0회. 기존 T070·T064 관문 시험도 모두 통과 |
| 캐시 (가짜 시계) | 통과 | 90초 안 → 실제 호출 1회, 정확히 90초 뒤 → 다시 호출, 쓰기 성공 뒤 → 목록·그 분쟁만 다시 호출(다른 분쟁·주문은 캐시 유지), 추적 등록 뒤 → 그 주문만 다시 호출. 동시 3건 → 1회, 4xx는 담지 않음 |
| 캐시 키·값에 비밀값 없음 | 통과 | 실제로 Bearer 토큰이 나간 뒤의 `snapshot()`에 토큰·Secret·Basic 값·`client_secret`·`client_credentials`·`Authorization`·`Bearer`·`access_token`이 없다. 묶음 열쇠 함수 원문에도 secret·clientId가 없다 |
| 클라이언트 하나 | 통과 | 요청 두 번(+ 다른 GET 하나)에 토큰 발급 1회. 바탕 클라이언트 생성 1회 |
| 병렬 = 순차 (`toEqual`) | 통과 | 시험: 응답이 거꾸로 끝나게 늦춰도 결과가 같다. 추가로 한 번만 확인: HEAD의 순차 `disputes.ts` 사본과 새 코드를 실제 `demoLinks` + LLM 두 종류(늘 실패 / 답함)로 돌려 `toEqual` 통과. 사본은 확인 뒤 지웠다 |
| `.next/static`에 서버 전용 값 없음 | 통과 | `grep -rlE "AFTERLOOP_\|DEMO_MODE\|LLM_API_KEY\|client_credentials\|api-m\.sandbox" .next/static` → 0건 |
| 명령 실패 0 | 통과 (아래 표, storefront 시간 초과 1건은 설명 참고) | |

## 요청 사이에 함께 쓰게 된 상태 (지시서 1번 확인 요청)
- **액세스 토큰**: 만료 60초 전까지 다시 쓰고, 동시 발급은 1회로 모은다(`src/paypal/client.ts` 그대로). 401이면 호출 1건 안에서 1회만 새로 받는다. 다른 요청이 이미 새로 받아 두었으면 그것을 쓴다. 문제 없다.
- **속도 제한(최근 60초 30회)**: 이제 요청 사이에 함께 센다. PayPal 한도는 앱 하나 기준이라 함께 세는 쪽이 맞다. 캐시 없이 세면 화면 한 번에 약 15회(목록 1 + 상세 3 + 주문 조회 약 10 + 토큰)다. 캐시가 있으면 90초 안 반복 클릭은 0회이고, 쓰기 뒤에는 관련 키만 지우므로 다시 읽기는 2~3회로 끝난다. 다만 **캐시가 비어 있을 때 다른 화면 읽기(추적 등록의 미등록 조회는 캐시를 보지 않는다) 3번 이상이 60초 안에 몰리면** 지금은 기다림이 생길 수 있다. 예전에는 요청마다 계수기가 새로 시작해서 이 기다림이 없었다. 실제 샌드박스 시간 재기 때 확인해 달라.
- **재시도 횟수(429·5xx·401)**: 호출 1건 안의 지역 값이라 요청 사이에 섞이지 않는다.
- **기록기 서랍**: 캐시는 기록기 바깥이라 캐시 적중은 새 줄을 남기지 않는다. 그래서 "N PayPal calls recorded"는 실제로 나간 호출 수 그대로다. 기존 거래 조회 15분 캐시의 "cached" 줄은 바꾸지 않았다(거래 조회는 이 캐시 대상이 아니다).
- **보내기 직전 다시 읽기**: send.ts의 `readDetail`(판매자 답장 여부 검사)과 추적 등록 대상 고르기는 캐시를 보지 않는 `getPayPalClient()`로 언제나 새로 읽는다. 문지기가 최대 90초 묵은 값을 보지 않는다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 167 | 0 | 9 skipped (원래 skip) |
| npm test | 2228 | 0 / 1 | 두 번 돌렸다. 1회차 전부 통과, 2회차 `storefront.test.ts > 결정론 > 같은 입력 100회`가 5초 시간 초과로 1건 실패. 엔진 시험이고 이 작업과 닿는 곳이 없다. 따로 돌리면 약 3.9초로 통과한다(한도 5초 가까이라 부하에 따라 넘는다). 같은 이유로 `sim.test.ts` 50ms 성능 시험도 한 번 넘었다가 다시 돌리면 통과 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | 경고 0 |
| npm run build | 통과 | 0 | |

## 남은 문제
- 시간 재기(실제 샌드박스: `/`, `/products`, 서연 상세의 첫 클릭과 반복 클릭)는 하지 않았다. 지시서대로 병합 전에 컨트롤 타워가 잰다.
- 위 속도 제한 공유: 캐시가 비어 있을 때 60초 안에 읽기가 몰리면 기다림이 생길 수 있다. 잴 때 확인할 것.
- 클라이언트 탐색으로 탭을 옮길 때는 Next가 공유 layout을 다시 그리지 않을 수 있다. 그러면 Today (N)은 처음 그린 값이 유지된다. 예전 동작과 같고, 이 작업에서 바꾸지 않았다.
- `storefront`·`sim` 시간 한도 시험이 부하에 따라 가끔 넘는다(엔진 레인).
- T081(언어 바꾸기)이 copy 파일을 고치고 있다면, 병합할 때 `common.loading` 한 줄이 충돌할 수 있다.

## 컨트롤 타워에 요청할 결정
- 없음
