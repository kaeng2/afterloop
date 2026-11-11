판정: 통과

# T060 검증 (lane/ui, 커밋 a25e6f5 · 56b1036 · aac53f0)

## 1. 범위
- `src/ai`·`src/engine`·`src/paypal`·`src/exec`·`src/types.ts`·`config/rules.json`·`config/params.json`·`seed/`·`tests/acceptance/`·`package.json`·`src/app/_server/send.ts`: `4e0c064..HEAD`와 `main...lane/ui` 둘 다 변경 0줄.
- 바뀐 파일은 `src/app/**`, `config/copy.*.json`, `tests/unit/`, `reports/`뿐. main 대비 추가분 `src/app/cases/reply-model.ts`, `tests/unit/app-case-reply.test.ts`, `reports/T058-*`는 T058(5f46c61)이라 범위에서 구분했다.
- 문구 파일 en/ko 키 집합이 같다 (303개, 차이 0).
- 디자인 테스트 `tests/unit/app-shared-design.test.ts`는 변경 0줄. 수정된 테스트는 `app-shared.test.ts` 한 곳(4칸 메뉴 -> 두 탭)뿐이고 지시서가 허용한 변경이다. `src/app` CSS에 `box-shadow` 없음. 서랍 폭은 `width:100%; max-width:25rem`.
- 보내기 관문: `send.ts`와 `app-send` 테스트 변경 없음. 전체 unit 통과.
- 흠(사소): 안 쓰는 옛 `src/app/_shared/nav.tsx`가 남아 있다. import하는 곳 0, 빌드·lint 통과. 병합 전에 지울 것.

## 2. 실행
| 명령 | 결과 |
|---|---|
| npm test | 종료 0, 40 파일 / 1868 통과 / 0 실패 |
| npx tsc --noEmit | 종료 0 |
| npm run lint | 종료 0 |
| npm run test:acceptance | 13 파일 / 158 통과 / 9 skipped / 0 실패 |
| npm run build | 성공 (5개 경로 모두 동적) |

`.next/static`에서 "Hannah" 0, "Fernwood" 0, "AFTERLOOP_" 0, "client_credentials" 0, "api-m.sandbox" 0개 파일.

## 3. 완료 기준 (가짜 PayPal·가짜 LLM으로 직접 확인. 스크립트는 지웠다)
- Today 목록: Needs you = 서연(customs hold, High) -> 추적 "2 orders without tracking"(Watch) -> 지호(Low), Prevent = Knit Cardigan, Oat ("120 left · fixes cut likely loss by about 80%"), Routine = Mike Morgan (3rd claim, skipped · suspected abuse). 연습용(PP-R-HEY-10197767)·옛 서연(PP-R-GAH-10197649)을 가짜 목록에 넣어도 항목·건수·GET에서 빠진다 (상세 GET은 3건만). Lena·Yuki·통관부호 항목 없음.
- 서연 아래 줄은 "Korean · mentions the card company" (대명사 없음). 가짜 지호는 상세 신호가 없어 "skipped · check the type first"로 나왔다. 지시서 문구("offer waiting for your approval")는 엔진이 지호를 추천 대기로 판정할 때 나온다. 이건 가짜 데이터 때문이고 코드 문제가 아니다.
- Today(N): 위 목록 5개 = `count` 5. 한 줄 "$717 · $253", 날짜 줄 "Tue, Nov 10 · 17 days to Black Friday" (daysUntil = 17).
- 추적: 가짜 주문 GET이 모두 500이면 항목이 숨겨지고(count 4) POST 0회. 정상일 때 분쟁 걸린 주문(O01·O02·O04·O08·O13)은 GET도 하지 않고 8건만 조회(O03·O05·O06·O07·O09~O12). 모든 시나리오에서 `call`(POST) 0회.
- 판매자 칩은 `loadReplyNames().sellerSignature`를 가른 값. `/cases/<id>`는 `redirect('/?item=<id>')`만 한다 (PayPal을 읽지 않음). 보내기 관문 테스트 통과.
- 서랍(코드로 판단): 열기 버튼 -> 서랍 + 닫기 버튼 포커스, Esc(document keydown)·닫기·배경 클릭으로 닫힘, Tab 가둠, 닫으면 여는 버튼으로 포커스 복귀, 건수 0이면 빈 상태 문구. 브라우저로는 못 봤다.
- 정적 검사: `src/app`에서 "Hannah"·"Fernwood" 0건. 화면 코드(.tsx)에 금액·건수 숫자 없음 (정적 검사 테스트도 통과).

## 4. 구현 보고서의 결정 요청 두 건 - 둘 다 사실
- 추적 항목 Watch 배지: `src/app/today/model.ts`의 `const TRACKING_BAND = 'Watch'` 고정값. 정책 값이 config 밖에 있다.
- Prevent 비율: `pickPrevent`가 화면 코드(model.ts)에서 `(before-after)/before` 비교와 `Math.round(x*100/before)`를 계산한다. 입력은 엔진 `simulateStore` 결과뿐이고 결과는 가디건 80%.
- 화면 코드에서 숫자를 계산하는 다른 곳: `daysUntil`/`dateLine`(달력 날 수. 금액 아님), `ordinal`(buyerPriorInr+1 서수), `count`(그룹 항목 수 합), 정렬 비교기(위험 단계·점수·기한). 금액 계산은 `toDollarsRounded` 표시 변환 외에 없다.

## 5. 요청당 PayPal GET (가짜 클라이언트로 센 값)
`loadTodayForRequest` 한 번의 호출 = 분쟁 목록 1 + 분쟁 상세 3 + 주문 8 = **12회** (POST 0). 위쪽 막대·페이지·사례 상세가 같은 요청 안에서 React `cache`로 합쳐지는 것을 전제로 한 값이다.
| 요청 | PayPal GET |
|---|---|
| `/products` | 12 (목록 1 + 상세 3 + 주문 8) |
| `/` (기본 = 서연) | 12 |
| `/?item=PP-R-MBJ-10197650` (지호) | 12 |
| `/?item=tracking` | 12 |
- 이전(T060 이전)에는 `/products`가 PayPal을 읽지 않았고 `/`도 목록 1 + 상세 3 = 4회였으니, 모든 화면에서 주문 GET 8회가 늘었다. 보고서의 "요청마다 PayPal 조회가 늘었다"는 사실이다.
- `cache`가 없는 환경(내 가짜 실행)에서는 `/`와 `/?item=지호`가 32회, `/?item=tracking`이 24회였다. 중복 제거는 Next 서버 렌더에서 React `cache`가 켜진 경우에만 성립한다. 개발 서버를 띄우지 않아 실제 Next 안에서의 중복 제거는 직접 확인하지 못했다.
