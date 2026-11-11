# T064 보고 (2026-11-11 19:50)

- 기준 SPEC: v2.10   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / f2153c7 (구현) + 이 보고서 커밋

## 결과
**일부 완료.** 기록기·서랍·숨김·가짜 전송 표시·토큰 제외·건수는 다 됐고, 명령 5개 모두 실패 0이다.
**한 가지가 아직 화면에 연결되지 않았다: "Read sales · cached" 줄.** 캐시 적중을 기록하는 함수(`getTransactionsRecorded`)는 만들었지만, 그것을 부를 자리인 `src/app/products/transactions-line.ts`가 수정 가능 폴더 밖이다. 한 줄만 바꾸면 된다 (아래 "컨트롤 타워에 요청할 결정" 1). 그 전까지는 캐시 적중 때 서랍에 줄이 생기지 않는다. 처음 읽은 "Read sales 200"은 지금도 남는다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_server/activity.ts` (새) | 기록기. 프로세스 메모리, 최근 50개, 최신이 앞. `recordClient`(get·call 감싸기), `recordCaller`(POST 호출기 감싸기, `simulated` 선택), `recordCall`, `recordCachedSalesRead`, `getTransactionsRecorded`(`getTransactions`와 같음 + 캐시 적중이면 cached 한 줄), `listActivity`, `resetActivityForTest`. 경로 → 제목 분류, 쿼리 문자열·조각을 떼고 전체 주소면 경로만 남긴다. 응답 본문은 건수만 세고 버린다 |
| `src/app/_server/paypal.ts` | `getPayPalClient`가 `recordClient(gated)`를 돌려준다. **T070 관문(`blockWrites`) 바깥**에서 감싼다. 관문 동작은 그대로 |
| `src/app/_server/send.ts` | 연결만: `SIMULATED_CALLER = recordCaller(createSimulatedCaller(), { simulated: true })`. 관문·판단 순서는 그대로. 실제 전송은 `liveClientOrNull()` → `getPayPalClient`라서 이미 기록기를 지난다 |
| `src/app/_shared/activity-view.ts` (새) | 기록 꼴(`ActivityRecord`)과 서랍 줄 만들기(`buildActivityView`, 순수 함수). 문구는 `activity.*`, 시각은 판매자 시간대(`today.sellerTimeZone`) |
| `src/app/_shared/activity-actions.ts` (새) | 서버 액션 `loadActivityView()`. PayPal을 부르지 않는다 |
| `src/app/_shared/activity-drawer.tsx` | 줄 목록: 제목 · 응답 코드 배지(2xx `--color-success`, 그 밖·응답 없음 `--color-danger`, 가짜 전송은 중립 점선) · `METHOD /path`(`<code>`, 고정폭) · 시각 · 요약 · 접힌 호출 수 · cached. 서버 액션으로 읽는 때: 처음 그릴 때, 화면 이동, 창 포커스, **서랍을 열 때**, 열려 있는 동안 3초마다. 포커스 가둠·Esc·닫기는 T060 그대로 |
| `src/app/_shared/top-bar.tsx` | 빈 목록(`NO_RECORDS`) 대신 `<ActivityDrawer />`. 서랍이 직접 읽는다 |
| `src/app/_shared/shell.css` | `.activity-*` 규칙 (변수 색만, 새 색 값 없음) |
| `config/copy.en.json`·`copy.ko.json` | `activity.*` 키 17개 (제목 9, 요약 2, cached·simulated·noResponse·calls·listLabel·cachedHint). 맨 위 설명은 원래 있던 `shell.drawer.note`("Every call AfterLoop makes on your behalf. Sandbox.")를 그대로 쓴다 |
| `tests/unit/app-t064-activity.test.ts` (새) | 17개. 가짜 `fetch`로 녹화 순서를 그대로 돌린다 (분쟁 목록+상세 → 거래 조회 → 캐시 적중 → `registerTrackingFromScreen` 추적 2건 → 상세 다시 읽기 + send-message) |

### 기록에 남는 것 / 남지 않는 것
- 남는 것: `id, at, method, path, title, shortId?, status, summary?, cached, simulated` (테스트가 칸 목록을 확인한다)
- 요약: 분쟁 목록은 연결 표 `showOnScreen` 분쟁만 센 건수, 거래 조회는 `transaction_details` 건수, 주문은 주문 키(O05 등. `tests/sandbox/manifest.json`에서)
- 남지 않는 것: 요청·응답 본문, 토큰, 쿼리 문자열, 이메일·이름·주소·추적 번호·캡처 ID (가짜 응답에 일부러 넣고 기록·화면 줄 모두에 없음을 확인)
- **숨김**: 연결 표 `showOnScreen: false` 분쟁(HEY, GAH)과, 제외 분쟁에만 걸린 주문(O04)이 경로에 있으면 **남기지 않는다** (호출 자체는 그대로 나간다). O01은 서연(D2) 주문이라 숨기지 않는다
- **토큰 발급**은 클라이언트 안에서 일어나 감싸개를 지나지 않는다. 경로로도 한 번 더 거른다
- **가짜 전송**: public에서 관문이 막은 쓰기(`{simulated:true}`)와 `send.ts`의 가짜 호출기는 `status: null, simulated: true` → 배지 "Simulated · not sent" (숫자 배지 없음). public 추적 등록(dry run)은 POST가 없으니 줄도 없다

### 줄 접기 (서랍을 깔끔하게)
실제 화면 흐름은 지시서의 4종보다 GET이 훨씬 많다 (분쟁마다 상세 GET, Today 추적 요약의 주문 GET 등). 그래서 `buildActivityView`가 **이어서 일어난** 같은 묶음만 한 줄로 접는다. 호출 수는 그대로 센다:
- 분쟁 목록 바로 뒤의 상세 읽기 → "Read your open cases · 3 cases · 4 calls"
- 잇단 주문 읽기 → "Read order · O02, O05, … · N calls"
- 쓰기 바로 앞의 같은 대상 읽기(추적 등록 전 주문 확인, 실제 전송 전 분쟁 다시 읽기) → 그 쓰기 줄에 붙인다
- 위쪽 막대 건수 = 보이는 기록 수 = 줄 `calls`의 합

녹화 순서를 흉내 낸 결과 (최신이 위, 테스트가 그대로 확인):
```
Send message 200          POST /v1/customer/disputes/PP-R-GMS-…/send-message
Add tracking 201          O07
Add tracking 201          O05
Read order 200            (등록 전 미등록 주문 찾기 GET들을 접은 줄)
Read sales 200 cached     3 transactions      ← 화면 연결 전에는 생기지 않음 (위 "결과")
Read sales 200            3 transactions
Read your open cases 200  3 cases · 4 calls
```
지시서 4번의 모양과 다른 점: Add tracking과 Read sales 사이에 **"Read order" 한 줄**이 낀다. 추적 등록이 먼저 주문을 GET으로 훑기(`listUntracked`) 때문이다. 실제 호출이라 숨기지 않았다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 (9 건너뜀) | 0 | |
| npm test | 2079 (49 파일) | 0 | 새 파일 17개 포함 |
| npx tsc --noEmit | 오류 0 | 0 | |
| npm run lint | 통과 | 0 | 경고 0 |
| npm run build | 통과 | 0 | |

실제 AI·PayPal 호출 없음 (가짜 `fetch`만). `.env`를 열지 않았다. 개발 서버를 띄우지 않았다.

## 남은 문제
- **Read sales cached 줄은 아직 화면에 연결되지 않았다** (결정 1).
- **실제 화면에서는 확인하지 않았다** (개발 서버 금지). 기록은 모듈 메모리라, Next가 RSC 렌더·서버 액션을 같은 Node 프로세스·같은 모듈 인스턴스에서 돌린다는 가정에 기댄다. `next start` 한 프로세스(Render 웹 서비스 1개)면 맞을 것이다. 여러 인스턴스로 늘리면 인스턴스마다 기록이 따로 생긴다. 사람이 녹화 전에 한 번 열어 봐야 한다.
- 실제 녹화 흐름에는 화면 렌더마다 읽기(GET)가 더 생긴다. layout의 Today 요약은 요청마다 분쟁 목록+상세와 주문 상세를 읽고, 추적 등록 뒤 `revalidatePath('/')`도 다시 읽는다. 그래서 "Add tracking"과 "Send message" 사이에 "Read your open cases"·"Read order" 줄이 더 낄 수 있다. 맨 위 줄(Send message 200)은 늘 맞다. 녹화 때 첫 화면이 지시서 모양과 꼭 같아야 하면 결정 2를 정해 달라.
- 서랍이 열려 있는 동안 3초마다 서버 액션을 부른다. Next는 서버 액션을 한 줄로 차례대로 돌리므로, 열린 채로 보내기를 누르면 잠깐 기다릴 수 있다 (PayPal 호출 없는 짧은 읽기라 체감은 작을 것이다). 서랍이 닫혀 있으면 주기적으로 읽지 않는다.
- 캐시 적중 줄의 건수는 캐시된 요약의 `saleCount + refundCount`다. 새로 읽은 줄은 응답의 `transaction_details` 건수다 (판매·환불이 아닌 거래가 섞이면 두 수가 다를 수 있다).
- 화면 모양은 공용 틀 그대로다 (배분 메모: 병합 전 스크린샷 생략).

## 컨트롤 타워에 요청할 결정
1. **`src/app/products/transactions-line.ts` 한 줄 연결 허가** (지금은 수정 가능 폴더 밖): `getTransactions(client, …)` → `getTransactionsRecorded(client, …)` (`../_server/activity`에서 import, 인자·결과는 같다). 이것이 있어야 영상의 "Read sales · cached" 줄이 생긴다. 허가해 주면 이 레인에서 바로 고치겠다. 아니면 컨트롤 타워가 직접 바꿔도 된다.
2. (선택) 녹화 첫 화면을 지시서 4번과 **똑같이** 맞추려면 둘 중 하나를 골라 달라. (a) 페이지 렌더 때 생기는 읽기(Today 요약 등)를 서랍에서 빼기. 단 "Every call AfterLoop makes"라는 문구와 어긋난다. (b) 지금처럼 모두 보이고 영상은 맨 위 2~3줄만 보여 주기. 이 보고서의 구현은 (b)다.
