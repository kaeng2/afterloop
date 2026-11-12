# T119 구현 보고 — 지호 품질 사례 새 샌드박스 주문 + 승인 링크

기준 SPEC v2.16 · 레인 paypal · 브랜치 lane/paypal

## 결과
- 샌드박스 주문 생성 호출 **1회** (`POST /v2/checkout/orders`, intent CAPTURE, USD, `PayPal-Request-Id: afterloop-order-J1038`).
- 응답 **HTTP 200** (지시서는 201 기대). 같은 요청 ID를 PayPal이 이미 알고 있어 기존 주문을 돌려줬을 수 있다 — 이전에 같은 키로 만든 주문이 있었는지는 이 세션이 확인하지 못했다. 상태는 `PAYER_ACTION_REQUIRED`(승인 전)라 그대로 쓸 수 있다.
- 주문 ID: `6R4577433P6975506` · Knit Cardigan, Oat · $48.00 · 추적 등록 안 함
- 승인 링크(www.sandbox.paypal.com): https://www.sandbox.paypal.com/checkoutnow?token=6R4577433P6975506
- 링크는 `seed/sandbox-links.md`에도 적었다. 승인·capture·추적·분쟁 호출은 하지 않았다. 기존 주문·분쟁 무변경.

## 변경
- `scripts/create-sandbox-order-j1038.ts` (신규, `npm run sandbox:order-j1038`): 시드 `FK-CD-OAT`의 이름·가격으로 주문 1건. 링크 도메인이 샌드박스가 아니면 파일에 쓰지 않고 멈춘다. `seed/sandbox-links.md`가 있으면 다시 호출하지 않는다.
- `tests/unit/sandbox-order-j1038.test.ts` (신규), `package.json` 스크립트 1줄.
- `seed/orders.json`·`tests/sandbox/manifest.json`은 **변경하지 않았다** (아래 이유).

## capture 실행 방법 (컨트롤 타워가 승인 뒤 요청)
`scripts/capture-sandbox-orders.ts`는 manifest의 주문을 돌며 `captureId`가 있는 것은 호출 없이 건너뛴다. 기존 13건은 모두 `captureId`가 있어서, manifest에 O20을 넣으면 **새 주문만** 조회·capture된다 (키·옵션은 따로 없음).
단, manifest에 O20(`tracked:false`)을 넣어 보니 앱이 O20을 추적 등록 대상으로 잡아 `app-t067`·`app-t060` 테스트 8건이 깨졌다 (기대값 O05·O07만). 그래서 되돌렸다.

**컨트롤 타워에 요청할 결정**: 승인 뒤 capture 방법 택일 — (a) 앱 쪽 추적 대상 계산이 O20을 제외하도록 정하고 manifest에 O20 추가 후 `npm run sandbox:capture`, (b) capture 스크립트에 `--order-id` 옵션을 새 태스크로 추가. 또 시드 `seed/orders.json`에 O20 줄을 넣으면 `readSandboxOrderSpecs`(12건 고정 검증)와 시드 테스트에 영향이 있어 넣지 않았다.

## 검사
- 새 단위 테스트 3건 통과. `npm test`: 전체 실행에서 `storefront.test.ts` 결정론 1건이 5초 제한을 넘겨 실패했으나 단독 실행은 31건 모두 통과 (부하 때문인 것으로 보이며 이 작업 파일과 무관).
- `tsc`: 오류 4건 모두 `src/app/cases/**` (main의 계약 변경 `repair`). 이 작업 밖이라 보고만.
- lint: 오류 0, 경고 2 (기존 파일).
- 비밀값·토큰·구매자 개인정보 출력·기록 없음.

## 재시도(capture)
- 실행 전 확인: manifest에 O20을 더한 뒤 `captureId`가 없는 주문은 **O20 하나뿐**이었다 (나머지 13건은 호출 없이 건너뜀).
- `npm run sandbox:capture` 1회 (샌드박스만). 주문 `6R4577433P6975506` (Knit Cardigan, Oat) → HTTP 201 · 캡처 상태 **COMPLETED** · 주문 상태 COMPLETED · capture ID **0GS51093S92438905** · 금액 $48.00 (주문 생성 시 금액, USD).
- 추적번호 등록·환불·분쟁·다른 주문 호출 없음.
- **앱의 추적 대상 계산 확인**: `registerTargets`(`src/app/_server/tracking-register.ts`)와 Today 입력(`src/app/today/tracking.ts`)은 manifest의 모든 주문을 GET으로 보고 "분쟁 없는 미등록 주문"을 대상으로 잡는다. O20을 manifest에 `tracked:false`로 두면 **O20도 대상에 들어간다** (O05·O07만이 아니게 된다 — 앞서 `app-t067`·`app-t060` 8건이 깨진 이유). 그래서 manifest 변경은 **커밋하지 않고 되돌렸다.** 캡처 ID는 이 보고서에만 남긴다.
- **컨트롤 타워에 요청할 결정**: O20을 manifest에 영구 반영하려면 앱 쪽 추적 대상에서 O20을 제외하는 규칙(예: manifest 필드 `trackExcluded`, 계약 변경)이나 테스트 기대값 변경이 필요하다. 지금은 manifest에 O20이 없어 앱 동작·테스트는 그대로다.
- 비밀값·토큰·구매자 개인정보 출력·기록 없음.

## 재시도(분쟁 확인)
GET만 호출 (`scripts/sandbox/dispute-confirm-t119.ts`, 샌드박스 `api-m.sandbox.paypal.com`). 목록 1회 + 상세 1회. POST·다른 분쟁 상세 호출 없음. 구매자 이름·이메일·주소·payer_id 출력·기록 없음.

- **목록** `GET /v1/customer/disputes` → HTTP 200, 6건. **PP-R-ZOK-10200237 포함: 예.** (나머지 5건: PP-R-HEY-10197767, PP-R-GMS-10197661, PP-R-FYT-10197651, PP-R-MBJ-10197650, PP-R-GAH-10197649)
- **상세** `GET /v1/customer/disputes/PP-R-ZOK-10200237` → HTTP 200
  - reason: `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED`
  - status: `UNDER_REVIEW` / dispute_state: `UNDER_PAYPAL_REVIEW`
  - dispute_life_cycle_stage: `INQUIRY` / dispute_channel: `INTERNAL`
  - 금액: 48.00 USD
  - create_time: 2026-11-12T13:43:41.570Z (update_time 13:46:43.683Z)
  - seller_response_due_date: **없음** (buyer_response_due_date도 없음)
  - disputed_transactions 1건: seller_transaction_id `0GS51093S92438905`, buyer_transaction_id `40N78712DT2384148`, transaction_status `HELD`, gross 48.00 USD
- **지호 주문과 일치: 예.** seller_transaction_id가 capture `0GS51093S92438905`와 같고 금액 $48.00도 같다 (주문 `6R4577433P6975506`은 응답에 직접 나오지 않아 capture ID 일치로 판단).
- **messages**: 1건, posted_by=BUYER, 117자. 첫 줄: "사진은 따로 첨부하지 못했어요. 세탁 표시대로 손세탁만 했고, 서너 번 입은 뒤부터 오른쪽 소매 끝 올이 풀리기 시작했어요. 지금은 실이 길게 빠져 나와서 작은 구멍이 생겼어요. 필요하면 사진을 보내 드릴게요." (줄바꿈 없는 한 줄)
- evidences 1건 (type CREATE, SUBMITTED_BY_BUYER, 같은 117자 글).
- **주의**: seller_response_due_date가 응답에 없다. 앱이 기한을 이 필드로 읽는다면 빈 값 처리(또는 기한 표시 방식)를 컨트롤 타워가 결정해야 한다. 채널이 `INTERNAL`, 단계가 `INQUIRY`, reason이 NOT_AS_DESCRIBED(INR 아님)인 점도 데모 분류 가정과 맞는지 확인 필요.
