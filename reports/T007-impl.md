# T007 보고 (2026-11-09 21:20)

- 기준 SPEC: v2.1 (시작할 때 SPEC.md 첫 줄과 같았는지: 예 — `SPEC v2.1 (2026-11-09 21:02 KST)`)
- 브랜치 / 마지막 커밋: lane/data / `ddf2aae`
- 작업 폴더: `/Users/kaeng2/repositories/paypal-hackathon/afterloop-wt/data` (data 레인 worktree, 확인함)

## 결과

완료. 원문 6장 시드 데이터 5개 파일(상품 4 · 구매자 12 · 문의 31 · 분쟁 9 · 주문 214)과 결정적 생성기(`npm run seed`), 단위 테스트 33건을 넣었다. 지시서 완료 기준 중 AC17만 남았다(컨트롤 타워가 작성 예정). 국가 비율 한 건은 원문 두 표가 서로 어긋나서 해석이 필요했고 아래 "컨트롤 타워에 요청할 결정"에 적었다.

## 바뀐 파일

| 파일 | 내용 |
|---|---|
| `seed/products.json` | 원문 6-1 상품 4개 (SKU·상품명·가격·재고·90일 주문·분쟁·체크리스트 빈 항목) |
| `seed/buyers.json` | 원문 6-2 구매자 12명 B01~B12 (B01~B05 샌드박스) |
| `seed/inquiries.json` | 문의 31건 = 원문 6-3 표 8건(앞) + 자동 생성 23건(뒤) |
| `seed/disputes.json` | 원문 6-4 분쟁 9건 D1~D9 |
| `seed/orders.json` | 주문 214건 = 샌드박스 12건(자리표시자 O01~O12) + 시드 202건 |
| `seed/schemas.ts` | zod 스키마(strict) + `src/types.ts` 8부와 컴파일 단계 대조 |
| `seed/data.ts` | 표 값과 결정적 자동 생성 (고정 시드 난수 mulberry32, LLM 없음) |
| `seed/generate.ts` | `npm run seed`: 재생성 → zod 검증 → 요약 출력 (DB 적재 없음) |
| `seed/index.ts` | 화면·테스트용 입구. JSON을 읽어 zod 검증만 하고 돌려준다 |
| `seed/README.md` | 해석한 값(국가 코드·체크리스트 라벨·국가 비율)과 T001 manifest 맞물림 표 |
| `tests/unit/seed.test.ts` | 원문 6-1~6-5 표를 따로 옮겨 적어 파일과 대조 (33건) |
| `package.json` | `scripts`에 `"seed": "tsx seed/generate.ts"` 한 줄 추가 |

지시서의 "수정 가능 폴더"(`seed/`, `package.json` scripts 한 줄, `tests/unit/seed.test.ts`) 밖은 건드리지 않았다. `src/`, `config/`, `src/types.ts`, `tests/acceptance/`는 읽기만 했다.

## 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 0 | 2 (+ 8 파일 수집 실패) | **모두 T007 전부터 있던 실패.** 아래 설명 |
| `npm test` (= `tests/unit`) | 33 | 0 | `tests/unit/seed.test.ts` |
| `npx tsc --noEmit` | — | 0 (자기 파일) | 남은 8줄은 모두 `@/engine/*`·`@/exec/execute`·`@/paypal/client` 모듈 없음 (다른 레인 미구현) |
| `npm run lint -- seed tests/unit` | 0 오류 0 경고 | — | |
| `npm run seed` 두 번 + `shasum -a 256 seed/*.json` | 동일 | — | 5개 파일 해시가 같다 |

### 인수 테스트 실패 내역 (T007과 무관함을 확인)

- 수집 실패 8개 파일: `ac01-03`, `ac04`, `ac05-06-08`, `ac07`, `ac09-10`, `ac11-12`, `ac14`가 `@/engine/recommend`, `@/engine/plan`, `@/engine/escalation`, `@/exec/execute`, `@/paypal/client`를 import하는데 그 모듈이 아직 없다 (engine·exec·paypal 레인 미구현·미병합).
- `ac13.sandbox.test.ts` 실패 2건: ① `.env.example` 파일이 아직 없다, ② `.gitignore`의 `.env*` 줄이 `.env.example`까지 무시해서 `git check-ignore`가 true를 돌려준다. 둘 다 T001(paypal 레인) 몫이다. T007 커밋은 `.env*`·`.gitignore`를 건드리지 않았다 (`git diff --stat HEAD~1`에 `seed/`, `tests/unit/`, `package.json`만 있다).
- 어느 인수 테스트도 `seed/`를 읽지 않는다. T007 완료 기준의 **AC17은 아직 저장소에 없다** (지시서대로 컨트롤 타워가 작성·승인 후 추가).

### 완료 기준 대조

| 기준 | 결과 |
|---|---|
| 건수 상품 4 · 구매자 12 · 문의 31 · 분쟁 9 · 주문 214 (상품별 62·48·33·71) | ✅ 테스트 `T007 건수` |
| 종결 분쟁 손실 합 40800¢, 진행 중 3건 `lossCents: null` | ✅ 5600+5600+5600+4300+0+19700 = 40800, D1~D3 null |
| 6-2·6-3·6-4 표의 이름·국가·원문 문장이 한 글자도 다르지 않다 | ✅ 테스트가 표를 따로 옮겨 적어 문자열 비교 (국가는 ISO 코드로 옮김, 아래 참고) |
| 자동 생성 23건 유형 분포 12·6·3·2, 한국어 50% ±1건 | ✅ 배송 12 · 사이즈 6 · 색상 3 · 기타 2, 한국어 12 / 영어 11 |
| `npm run seed` 두 번 실행해도 결과 파일이 같다 | ✅ 해시 동일 + 테스트 `buildSeed()를 두 번` |
| 인수 테스트 AC17 통과 | ⏸ AC17 미작성 (컨트롤 타워) |
| `npx tsc --noEmit`에서 자기 파일 오류 없음 | ✅ |

`npm run seed` 출력:

```
seed 다시 생성 완료 (원문 6장, SPEC v2.1)
  products.json   4건  FK-CD-OAT $48.00 · FK-SW-NV $72.00 · FK-CT-GR $189.00 · FK-BN-SET $35.00
  buyers.json     12건  샌드박스 5명
  inquiries.json  31건  (표 8 + 자동 생성 23)
  disputes.json   9건  진행 중 3 · 종결 6 · 종결 손실 합 40800¢ ($408.00)
  orders.json     214건  샌드박스 12 · 시드 202
  주문 상품별      FK-SW-NV 48 · FK-CD-OAT 62 · FK-BN-SET 71 · FK-CT-GR 33
  주문 국가별      KR 53 · JP 31 · DE 31 · US 95 · GB 4
  추적 등록        128 / 214 (59.8%)
```

## 남은 문제

1. **국가 비율과 원문 6-2가 어긋난다.** 원문 4-1은 "미국 45% · 한국 25% · 일본 15% · 독일 15%"인데, 원문 6-2의 B12 Sophie B.는 **영국**이고 주문 4건이다. 둘을 동시에 정확히 만족시킬 수 없어서 **GB 4건을 먼저 빼고 남은 210건을 최대 잉여법으로 나눴다**: US 95 · KR 53 · JP 31 · DE 31 · GB 4 = 214. 각 나라 비율 오차는 0.6%p 이하(US 44.4% · KR 24.8% · JP 14.5% · DE 14.5%). 테스트는 이 정확한 건수와 "오차 1%p 미만"을 함께 확인한다. AC17이 `96·54·32·32`(214의 45/25/15/15)를 기대하면 실패하므로 아래 결정 요청 1번을 봐 주세요.
2. **샌드박스 12건은 T001과 손발을 맞춰야 한다.** `tests/sandbox/manifest.json`이 아직 없어서, `orders.json`의 `id`를 `O01`~`O12`로 두고 구매자(`seoyeon`/`jiho`/`yuki`/`lena`/`buyer_m`)·SKU·추적 여부까지 `seed/README.md`에 표로 못 박았다. T001이 다른 키나 다른 배분으로 만들면 둘 중 하나를 고쳐야 한다. 특히 D3(F1 반복 주장)은 배송 완료 기록이 있어야 `rules.abuse` 규칙이 걸리므로 O08은 추적 등록된 주문이어야 한다.
3. **`checklistGaps`를 영어 라벨로 넣었다** (`Natural-light photos`, `Color disclosure`, `Size chart in cm`, `Korean customs notice`, `Signature on delivery`). 화면이 영어라서인데(SPEC 4장), UI 레인이 `config/copy.*.json` 문구 키로 받길 원하면 시드 값 형식을 바꿔야 한다. 원문 한글 라벨 대응은 `seed/README.md`에 적어 뒀다.
4. **자동 생성 구매자 ID는 `X001`~`X192`다.** 원문 6-2는 '핵심 12명'만 적고 주문 214건은 그보다 많은 구매자에게서 나오므로, `buyers.json`에 없는 구매자를 `X` 접두사로 구분했다. 화면이 구매자 이름을 찾으면 `B01`~`B12`만 찾힌다.
5. 자동 생성 문의의 유형(배송/사이즈/색상/기타)은 `SeedInquiry`에 필드가 없어서 `seed/data.ts`의 `generatedInquirySpecs`에만 있다. 파일에서는 **배열 앞 8건이 원문 6-3 표, 뒤 23건이 자동 생성**이라는 순서로 구분한다.

## 컨트롤 타워에 요청할 결정

1. **AC17의 국가 비율 기대값** (위 "남은 문제" 1번). 두 가지 중 하나를 골라 주세요.
   - (가) 지금 구현대로 `US 95 · KR 53 · JP 31 · DE 31 · GB 4` — 원문 6-2(B12 영국)를 지키고 4-1 비율은 0.6%p 안에서 맞춤. **권고안**이고 코드 변경 없음.
   - (나) 4-1 비율을 정확히 (`US 96 · KR 54 · JP 32 · DE 32`) — 이 경우 B12 Sophie B.의 주문 4건을 영국이 아닌 나라로 옮겨야 해서 원문 6-2와 달라진다. SPEC·지시서 수정이 필요하다.
2. **`SeedOrder`에 날짜 필드가 없다.** `src/types.ts` 8부 `SeedOrder`에 `date`가 없어서 "90일 주문"을 건수로만 표현했다. S1(Today)·S3(At-risk orders)가 주문 날짜(예: "발송 D+n")를 필요로 하면 계약 변경이 필요하다. 지금은 필요 없다고 보고 넣지 않았다.
3. **`seed/index.ts`를 화면·테스트의 공식 입구로 쓸지.** 지시서에 없던 파일이라 추가해 뒀다(JSON 읽기 + zod 검증만, 계산 없음). UI 레인이 JSON을 직접 import하는 쪽이 낫다면 지워도 된다.
4. (참고, 결정 불필요) 종결 분쟁 손실은 지시서·SPEC 13장 Q8대로 **원문 값 40800¢**를 그대로 썼다. `config/params.json`의 `feeCents`(f = 1500¢)와는 맞지 않는다는 점만 기록해 둔다.

비밀값·구매자 개인정보는 이 보고서와 시드 파일에 없다 (단위 테스트가 이메일·개인통관고유부호 형식·긴 숫자 없음을 확인한다).

---

## 재시도 (2026-11-09 21:35)

- 기준 SPEC: v2.1 (`SPEC.md` 첫 줄 `# SPEC v2.1 (2026-11-09 21:02 KST)` 확인)
- 브랜치 / 마지막 커밋: lane/data / `bc6ec7d` (앞 커밋 `19a42c2` = main 병합)
- 작업 폴더: `/Users/kaeng2/repositories/paypal-hackathon/afterloop-wt/data` (data 레인 worktree, `pwd`로 확인)
- 받은 입력: `reports/T007-verify.md` (판정 실패, 병합 차단 1건). 그 파일은 고치지 않았다.
- 고친 범위: `seed/data.ts`, `seed/orders.json`, `seed/inquiries.json`, `seed/README.md`, `tests/unit/seed.test.ts`. 지시서 "수정 가능 폴더" 밖은 건드리지 않았다 (`git diff --stat`에 위 5개만 있다).

### 1. [필수] 샌드박스 12건을 `tasks/T001.md` 배정 표에 맞췄다 (문제 1)

T001 표를 정본으로 보고 `seed/data.ts`의 `sandboxOrderDrafts` 12행을 표와 행마다 같게 고쳤다. 바뀐 8행:

| id | 고치기 전 (상품 / 추적) | 고친 뒤 = T001 표 |
|---|---|---|
| O02 | FK-CD-OAT / 등록 | FK-CD-OAT / **미등록** |
| O03 | FK-CD-OAT / 등록 | FK-CD-OAT / **미등록** |
| O05 | FK-BN-SET / 등록 | FK-BN-SET / **미등록** |
| O06 | **FK-CD-OAT** / 등록 | **FK-BN-SET** / 등록 |
| O07 | **FK-BN-SET** / 미등록 | **FK-CD-OAT** / 미등록 |
| O09 | FK-BN-SET / **미등록** | FK-BN-SET / **등록** |
| O11 | **FK-CD-OAT** / **미등록** | **FK-BN-SET** / **등록** |
| O12 | **FK-SW-NV** / **미등록** | **FK-CD-OAT** / **등록** |

O01, O04, O08, O10은 이미 같았다. 추적은 등록 7 (O01, O06, O08~O12) · 미등록 5 (O02~O05, O07)로 표의 목록과 같다.

나머지 202건은 다시 채워졌고 **합계는 그대로다**: 상품별 62 · 48 · 33 · 71, 국가 US 95 · KR 53 · JP 31 · DE 31 · GB 4, 추적 등록 128 / 214 (59.8%). `buildAnonymousOrderDrafts`가 "총 할당량 − 이름 있는 주문"으로 자동 생성 몫을 계산하기 때문에, 샌드박스 쪽 상품·추적이 바뀌면 자동 생성 주문의 상품·추적이 그만큼 반대로 움직인다 (자동 생성 주문의 `sku`·`tracked` 일부와 자동 생성 문의가 붙는 `X…` ID가 바뀌었다. 건수·분포는 불변).

`seed/README.md`는 "구매자·상품·추적 여부도 아래와 같이 맞췄다"를 **"배정의 정본은 `tasks/T001.md`의 주문 12건 배정 표다. 시드는 그 표를 행마다 옮겨 적는다"**로 바꾸고, 표도 T001과 같게 고쳤다(분쟁 칸 추가). D7·D8을 특정 주문(O09·O10)에 못 박았던 설명은 지웠다: T001 표대로면 buyer_m의 비니 주문 4건(O08~O11)이 모두 추적 등록이고 `SeedDispute`에 주문 ID가 없어서 **어느 주문인지 시드에서 고정하지 않는다**고 적었다 (검증 보고서 "문제 2"와 같은 내용. 계약 변경은 컨트롤 타워 결정이라 손대지 않았다). `seed/data.ts`의 주석도 같게 고쳤다.

### 2. [필수] 단위 테스트에 T001 표와 행별 비교를 넣었다

`tests/unit/seed.test.ts`에 T001 표를 **따로 옮겨 적은** `TABLE_T001_SANDBOX_ORDERS`(12행: 키·구매자 키·상품 이름·금액·추적·분쟁)와 `TABLE_T001_TRACKED_KEYS`·`TABLE_T001_UNTRACKED_KEYS`, 구매자 키 대응표(`seoyeon`→B01 … `buyer_m`→B04)를 넣고 테스트 3건을 추가했다.

- `12행의 키·구매자·상품·금액·추적 여부가 표와 같다` — SKU는 표의 상품 **이름**으로 `products.json`에서 찾아 비교한다 (표의 `Beanie + Scarf Set ($35)`까지 대조).
- `추적 등록 7건(O01, O06, O08~O12) · 미등록 5건(O02~O05, O07)이 표의 목록과 같다` — 건수가 아니라 **ID 목록**을 비교한다.
- `표의 분쟁 칸(O01 D2 · O02 D1 · O08 D3)이 그 주문의 구매자·상품과 맞는다`

문의 맞물림 테스트 2건도 함께 넣었다(아래 3). 단위 테스트 33 → **38건**.

테스트가 실제로 잡는지 확인했다: O09를 일부러 `FK-SW-NV` / 미등록으로 바꾸고 `npm run seed` 후 돌리면 3건이 실패한다 (`O09 상품: expected 'FK-SW-NV' to be 'FK-BN-SET'`, 추적 목록 불일치, 기존 건수 테스트). 확인 후 되돌렸다.

### 3. [권장] 한국어 문장과 문의–주문 어긋남

- 다듬은 문장 2개 (검증 보고서 의견 3):
  - `배송 조회 번호를 알려주실 수 있나요?` → **`운송장 번호를 알려주실 수 있나요?`**
  - `스웨터 소매 길이도 알려주시면 좋겠어요.` → **`스웨터 소매 길이를 알려주실 수 있나요?`** (영어도 `Could you tell me the sleeve length of the sweater?`로 맞춤)
- 어긋난 행은 **결정적으로 맞췄다.** 자동 생성 문의 템플릿에 `requireSkus`·`requireTracked`를 넣고, 구매자를 붙일 때 그 조건에 맞는 주문을 가진 자동 생성 구매자만 고른다. 조건이 붙은 문의부터 먼저 고르고 각 단계는 주문 배열 순서대로 첫 번째로 맞는 구매자를 고르므로 결과는 결정적이다 (조건을 못 채우면 `npm run seed`가 에러로 멈춘다).
  - 상품: `오트 색상이…`·`Does the oat shade…`·`Is the cardigan true to size…` → FK-CD-OAT 주문자 / `스웨터 소매 길이…` → FK-SW-NV / 사이즈표·어깨 너비·가슴 둘레·키 문의 → 의류 3종(가디건·스웨터·코트, 비니 세트 제외)
  - 추적: `통관 중이라고 나오는데…`·`통관에서 멈춘 것 같아요…`·`My tracking hasn't updated…` → 추적 등록 주문자 / `발송 안내를 아직 못 받았는데…`·`운송장 번호를…`·`I still have no shipping confirmation…` → 미등록 주문자
  - 재입고 문의는 재고 150인 비니 세트와 어긋나서 **재고가 가장 적은 코트(25개)**로 바꿨다: `Will you restock the cashmere coat in grey?` (FK-CT-GR 주문자에게 붙는다)
  - 조건을 걸지 않은 3건: `주문한 상품이 아직 도착하지 않았어요…`(추적 여부와 무관), `화면에서 보이는 색과 실제 색이…`(4종 모두 색상이 있다), `선물 포장도 해주시나요?`
  - 유형 분포 배송 12 · 사이즈 6 · 색상 3 · 기타 2와 한국어 12 / 영어 11, 원문 6-3 표 8건, 6-2의 구매자별 문의 수(B04 4 · B09 2 …)는 그대로다.
- 손대지 않은 것: 검증 보고서 "컨트롤 타워가 결정할 것" 2~7번(국가 비율·GB, `X` 구매자, 국가·체크리스트 표기, `SeedDispute.orderId`·`SeedOrder.date`, 객단가, `seed/index.ts`)은 사람에게 묻는 중이라 그대로 뒀다. 자동 생성 문의의 `signal` 값(의견 3 마지막 줄, buyer_m 9/20·10/2의 `A1`)도 유형 분포·원문 표에 걸리지 않아 그대로 뒀다.

### 재시도 테스트 결과

| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 104 | 0 | `seed.test.ts` 38 (33 → 38) + 다른 레인 66 (oracle 26 · autopilot 17 · recommend 23) |
| `npx tsc --noEmit` | — | 4줄 (모두 다른 레인) | `tests/acceptance/*`의 TS2307: `@/engine/plan`, `@/engine/escalation`, `@/exec/execute`, `@/paypal/client`. `seed/`·`tests/unit/` 오류 0 |
| `npm run seed` 1회차·2회차 + `shasum -a 256 seed/*.json` | 동일 | — | 5개 파일 해시가 두 번 모두 같다. `git status -s`도 커밋 뒤 빈 출력 |
| `npx eslint seed tests/unit` | 오류 0 | — | |
| `npm run test:acceptance` (참고) | 27 (+9 건너뜀) | 2 (+ 파일 4개 수집 실패) | 재시도 전과 같은 실패다: 수집 실패 4개는 engine·exec·paypal 레인 모듈 없음, 실패 2건은 AC13의 `.env.example`·`.gitignore` (T001 몫). `seed/`를 읽는 인수 테스트는 없고 **AC17은 아직 저장소에 없다** |

`npm run seed` 출력 (재시도 뒤):

```
seed 다시 생성 완료 (원문 6장, SPEC v2.1)
  products.json   4건  FK-CD-OAT $48.00 · FK-SW-NV $72.00 · FK-CT-GR $189.00 · FK-BN-SET $35.00
  buyers.json     12건  샌드박스 5명
  inquiries.json  31건  (표 8 + 자동 생성 23)
  disputes.json   9건  진행 중 3 · 종결 6 · 종결 손실 합 40800¢ ($408.00)
  orders.json     214건  샌드박스 12 · 시드 202
  주문 상품별      FK-SW-NV 48 · FK-CD-OAT 62 · FK-BN-SET 71 · FK-CT-GR 33
  주문 국가별      KR 53 · JP 31 · DE 31 · US 95 · GB 4
  추적 등록        128 / 214 (59.8%)
```

### 컨트롤 타워에 요청할 결정 (재시도분)

새로 생긴 결정은 없다. 1차 보고서의 요청 1~4와 검증 보고서의 2~7번이 그대로 남아 있다. 하나만 덧붙인다: 이제 **시드는 `tasks/T001.md` 표를 그대로 따르고 단위 테스트가 표 값과 직접 비교한다.** 그래서 앞으로 샌드박스 배정이 바뀌면 그 표를 먼저 고쳐야 하고, 고치면 이 단위 테스트(`TABLE_T001_SANDBOX_ORDERS`)도 같이 옮겨 적어야 한다 (지금은 표가 저장소 파일이라 테스트가 자동으로 따라가지 않는다).

비밀값·구매자 개인정보는 이 절과 바뀐 시드 파일에도 없다 (개인정보 테스트 그대로 통과).
