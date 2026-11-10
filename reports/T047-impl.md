# T047 보고 (2026-11-10 12:05)

- 기준 SPEC: v2.6 (시작할 때 `SPEC.md` 첫 줄과 같았는지: **예** — `SPEC v2.6 (2026-11-10 11:37 KST)`)
- 브랜치 / 마지막 커밋: `lane/ui` / `6041622`

## 결과
**완료.** 레이아웃·문구 읽기·금액 표시·배지·서버 도구·실제 분쟁 읽기 함수를 모두 만들었다.
실제 PayPal·LLM 호출 0회, `.env`를 찾지 않았고 개발 서버도 띄우지 않았다 (`npm run build`로 확인).
화면 5개의 내용은 손대지 않았다 (각 지시서의 몫). 수정 가능 폴더 밖은 고치지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/layout.tsx` | 머리글(앱 이름 + "PayPal sandbox only") + 메뉴 + 본문 자리. 글자는 `nav.*` |
| `src/app/_shared/nav.tsx` | 메뉴 (클라이언트 컴포넌트, 지금 화면 표시). 메뉴 4개 — Case는 Inbox에서 들어간다 |
| `src/app/_shared/nav-items.ts` | 메뉴 항목·`isActive` (그리지 않는 부분. 단위 테스트가 본다) |
| `src/app/globals.css` | 공용 스타일 + 배지 색 토큰 (밝은/어두운 모드). 예시 스타일 삭제 |
| `src/app/page.tsx` | 메뉴만 있는 임시 S1 화면 (T014가 바꾼다). create-next-app 예시 삭제 |
| `src/app/page.module.css` | **삭제** (예시 화면 스타일) |
| `src/app/_shared/copy.ts` | `t(key, params?)`, `copyKeys`, `copyTables` |
| `src/app/_shared/money.ts` | `toDollarsRounded`, `toDollarsCents` |
| `src/app/_shared/badges.tsx` | `DemoBadge`·`AssumptionBadge`·`AiSuggestsBadge`·`CodeDecidesBadge`·`RiskBandBadge` |
| `src/app/_shared/badge-keys.ts` | `BadgeTone`·`RISK_BADGE`·`BADGE_COPY_KEYS` (그리지 않는 부분) |
| `src/app/_shared/demo-links.ts` | 연결 표 zod 검증 + `withoutDemoExcluded`·`isLiveSendAllowed`·`screenLinks`·`linkFor` |
| `src/app/_shared/dispute-view.ts` | `LoadedDispute`·`DemoField` 타입 + `pickBoard`·`hasDemoValues` |
| `src/app/_server/paypal.ts` | `getPayPalClient()` (던지지 않는다. 샌드박스만) |
| `src/app/_server/llm.ts` | `getLlm()`, `unavailableLlm()` |
| `src/app/_server/disputes.ts` | `loadDemoDisputes(deps?)`, `loadDemoDisputesForRequest` |
| `config/copy.en.json`, `config/copy.ko.json` | `nav.`·`badge.`·`common.` 키 추가 (두 파일 키가 같다). 남의 키는 손대지 않았다 |
| `tests/unit/app-shared.test.ts` | 문구·금액·연결 표·보드 고르기·메뉴 (27건) |
| `tests/unit/app-shared-disputes.test.ts` | `loadDemoDisputes` 가짜 클라이언트 시험 (22건) |

## 다른 화면 지시서가 부를 함수

### `src/app/_shared/copy.ts`
| 함수 | 인수 | 돌려주는 값 |
|---|---|---|
| `t` | `(key: string, params?: Record<string, string \| number>)` | `string`. 없는 키·못 채운 자리표시자·안 쓰인 `params` 키는 **예외** |
| `copyKeys` | `(table?)` | `string[]` (`version`·`note` 제외, 정렬됨) |
| `copyTables` | — | `{ en, ko }` 문구 표 (정적 검사용) |

### `src/app/_shared/money.ts` — 화면 코드에서 `/ 100`·`toFixed`를 쓰지 않는다
| 함수 | 인수 | 돌려주는 값 |
|---|---|---|
| `toDollarsRounded` | `(cents: number)` | `"$74"`. 사사오입, 천 단위 구분, 음수는 `-$37`. 정수가 아니면 예외 |
| `toDollarsCents` | `(cents: number)` | `"$72.00"` (`centsToDisplay` 그대로) |

### `src/app/_shared/badges.tsx` (React 컴포넌트)
| 컴포넌트 | props |
|---|---|
| `DemoBadge` | `{ fields?: readonly string[] }` — 주면 "Demo values: …"를 `title`로 |
| `AssumptionBadge` | `{ source?: string }` |
| `AiSuggestsBadge` / `CodeDecidesBadge` | 없음 |
| `RiskBandBadge` | `{ band: 'Low' \| 'Watch' \| 'High'; title?: string }` — 구간은 엔진이 정한 값 |

### `src/app/_shared/demo-links.ts`
| 함수 | 인수 | 돌려주는 값 |
|---|---|---|
| `withoutDemoExcluded` | `(disputes: {dispute_id}[], links?)` | 같은 배열 타입. `showOnScreen`인 분쟁만, **받은 순서 그대로** |
| `isLiveSendAllowed` | `(disputeId: string, links?)` | `boolean`. 표에 없으면 `false`. **T009의 전송 코드가 이것을 본다** |
| `screenLinks` | `(links?)` | `DemoLink[]` (지금 D1·D2·D3, 파일 순서) |
| `linkFor` | `(disputeId, links?)` | `DemoLink \| undefined` |
| `parseDemoLinks` | `(value: unknown)` | `DemoLinksConfig`. 모양이 틀리거나 번호가 겹치면 예외 |
| `demoLinks`, `demoLinksConfig` | — | 검증된 라이브 설정 |

### `src/app/_shared/dispute-view.ts`
| 함수 | 인수 | 돌려주는 값 |
|---|---|---|
| `pickBoard` | `({ boardReal, boardDemo })` | `BoardState` = `boardDemo ?? boardReal` (고치지 않는다) |
| `hasDemoValues` | `({ demoFields })` | `boolean` ('Demo data' 배지를 붙일지) |

### `src/app/_server/` (서버에서만 부른다)
| 함수 | 인수 | 돌려주는 값 |
|---|---|---|
| `getPayPalClient` | `(env?, deps?)` | `{ ok: true, client }` 또는 `{ ok: false, reason }`. **던지지 않는다**. 샌드박스 아닌 주소는 거부 |
| `getLlm` | `(env?)` | `{ ok: true, llm }` 또는 `{ ok: false, reason }` |
| `unavailableLlm` | `(reason?)` | 늘 실패하는 `LlmCaller` (분류·어조가 규칙 결과로 내려간다) |
| `loadDemoDisputes` | `({ client?, llm?, links?, now?, realTracking? })` | `{ disputes: LoadedDispute[], paypal: {ok,reason?}, llm: {ok,reason?} }` |
| `loadDemoDisputesForRequest` | 없음 | 같은 값. **한 요청 안에서 PayPal을 한 번만 읽는다** (`react`의 `cache`). S5는 이것을 쓴다 |

### `LoadedDispute` 한 건
| 값 | 타입 | 내용 |
|---|---|---|
| `key` | `string` | 연결 표의 시드 키 (`D1`·`D2`·`D3`) |
| `disputeId` | `string` | 실제 PayPal 분쟁 번호 |
| `statusCode` | `string` | 분쟁 상세 `status` (`WAITING_FOR_SELLER_RESPONSE`·`UNDER_REVIEW`). 없으면 `''` |
| `buyer` / `product` | `SeedBuyer \| null` / `SeedProduct \| null` | 연결 표 → 시드 분쟁 → 시드 구매자·상품 |
| `buyerMessages` | `string[]` | 구매자 글. **`maskPersonal`을 거친 것** |
| `boardReal` | `BoardState` | 실제 값만 쓴 보드 (`isDemo: false`) |
| `boardDemo` | `BoardState \| null` | 시연용 값을 덧씌운 보드 (`isDemo: true`). 덧씌울 것이 없으면 `null` |
| `demoFields` | `DemoField[]` | `hasTracking`·`hasDeliveredTracking`·`buyerPriorInrDisputes`·`carrierEvents`·`cause`·`earlierInquiries` 중 섞인 것. 화면은 `common.field.<이름>` 문구로 옮긴다 |
| `carrierEvents` | `SeedCarrierEvent[]` | `carrierEventsFor(carrierOrderId)`. 없으면 `[]` |
| `signals` / `signalsAfterReply` | `EscalationSignals \| null` | `buildEscalationSignals` 결과 두 벌. 시각을 읽을 수 없으면 둘 다 `null` |
| `liveSendAllowed` | `boolean` | 연결 표 값 (T009의 전송 코드가 본다) |

실제로 나온 값 (가짜 클라이언트 + 라이브 시드·연결 표):

| | D1 지호 | D2 서연 | D3 buyer_m |
|---|---|---|---|
| `boardReal.cause.subtype` | (사유만으론 규칙 밖 → LLM) | `A1` (추적 없음) | `A1` |
| `boardDemo` | `null` (O02에 배송사 이벤트 없음) | `A2` (통관 보류), `hasTracking: true` | `F1`, 이전 미수령 2건 + 배송 완료 |
| `boardReal.buyerPriorInrDisputes` | 0 | **0** (옛 서연 분쟁을 세지 않는다) | 0 |
| `liveSendAllowed` | true | true | false |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 144 (+9 skip) | 0 | AC29(연결 표) 8건 포함. 기대값을 고치지 않았다 |
| `npm test` | 1302 | 0 | 이 작업이 더한 49건 포함 |
| `npx tsc --noEmit` | — | 0 | 출력 없음 |
| `npm run lint` | — | 0 | 경고도 0 |
| `npm run build` | 성공 | 0 | `/`와 `/_not-found` 정적 생성 |

### 완료 기준 확인
- `t`: 있는 키·자리 채우기·없는 키 예외 ✅. 두 문구 파일 키 같음 ✅. 금지 문구(`guarantee`·`보장`·`예측 정확도`) 없음 ✅. 문구 값에 `$`+숫자 없음 ✅ (AC19 초안 12번 정적 검사도 함께 넣었다)
- `toDollarsRounded`: 7400 → `$74`, 3680 → `$37`, 3650 → `$37`, 3649 → `$36`, 0 → `$0` ✅. 나눗셈·`toFixed` 안 씀 (자리수 문자열) ✅. 큰 값(`700000000050` → `$7,000,000,001`)도 확인
- 가짜 PayPal 클라이언트로 `loadDemoDisputes`: `call`(POST) **0회** ✅. 연습용(`PP-R-HEY-…`)·시연 제외(`PP-R-GAH-…`) 분쟁이 결과에 없고 **그 상세 경로로 `get`도 가지 않음** ✅. 목록에 없는 D2를 번호로 읽음 ✅. 서연 `buyerPriorInrDisputes` = 0 ✅ (AC19 초안 1·9·10·11번)
- 시연용 값이 없을 때: `boardDemo`가 `null`이고(D1) 화면이 깨지지 않음 ✅. LLM을 못 쓰면 어조는 `null`, 분류는 규칙 결과 + `needsReview` ✅. 시각을 못 읽으면 `signals`가 `null` ✅
- `npm run build` 뒤 `.next/` 어디에도 `PAYPAL_CLIENT_SECRET`·`LLM_API_KEY` 글자 없음 ✅ (`grep -rl`, `.next/static/` 포함)
- 스크린샷 확인 없음 (빈 화면 + 메뉴뿐) — 첫 화면 병합(T009) 때 사람이 함께 본다

## 남은 문제
1. **`boardReal`의 추적 정보는 "없음"이 기본값이다.** PayPal 분쟁 응답에는 추적 정보가 없고, 실제 값은 주문 상세(`GET /v2/checkout/orders/{id}`, SPEC 9-3)를 읽어야 안다 — 이 작업은 분쟁만 조회한다. 서연 장면의 실제 분쟁이 걸린 주문 O13에는 추적번호가 없으므로(SPEC 2장) 시연에서는 맞는 값이지만, 지호·buyer_m의 주문에는 추적번호가 등록돼 있다. 주문을 함께 읽는 화면(T016)이 `loadDemoDisputes({ realTracking })`로 실제 값을 넣을 수 있게 주입 자리를 뚫어 두었다. **지어낸 값은 넣지 않았다.**
2. **`demoFields`에 `earlierInquiries`가 들어가면 `boardDemo`가 `null`이어도 비어 있지 않다.** 지호(D1)는 보드에 덧씌울 것이 없지만 위험 신호가 시연용 문의(10/20)에 기대므로 `demoFields = ['earlierInquiries']`가 된다. AC19 초안 8번은 "D1 행에는 [Demo data 배지가] 없다"고 적혀 있다 — 그 항목은 `demoFields`를 시험이 직접 넣는 형태라 지금 구현과 충돌하지는 않지만, 배지를 보드 값에만 붙일지 신호까지 포함할지는 컨트롤 타워가 정해 주면 좋겠다 (아래 요청 1번).
3. **비밀값 누출 검사가 아직 약하다.** `_server/`를 import하는 화면이 없어서 서버 코드가 클라이언트 묶음에 들어갈 경로 자체가 없다. `server-only` 패키지는 `package.json`을 고칠 수 없어 들이지 않고, `src/ai/llm.ts`와 같은 방식(`typeof window !== 'undefined'`면 거부)으로 막았다. 화면이 실제로 `_server/`를 쓰기 시작하는 T009 병합 때 이 `grep`을 다시 돌려야 한다.
4. **어조 판정(T043) 호출 횟수.** `loadDemoDisputes`가 분쟁 1건마다 `judgeTone`을 1회 부른다 (분류는 규칙으로 정해져 0회). 화면 3개가 같은 요청에서 쓰면 `loadDemoDisputesForRequest`가 묶어 주지만, 요청마다 LLM 3회가 나간다. 캐시(T019)가 생기면 그쪽에 얹는 것이 맞다.
5. `config/copy.*.json`의 SPEC v1 잔여 키(`blocked.R1`·`R3`·`R4`·`R5`) 정리는 지시서대로 **하지 않았다** (사람 확인 뒤).

## 컨트롤 타워에 요청할 결정
1. **'Demo data' 배지의 범위** (남은 문제 2번): 보드에 덧씌운 값만 볼지, 위험 신호가 기대는 시연용 문의까지 볼지. 지금 구현은 후자(더 정직한 쪽)다. AC19를 잠글 때 8번 항목과 함께 정하면 좋겠다.
2. **AC19 초안 1번의 함수 이름.** 초안은 `withoutDemoExcluded(disputes, links)`로 적혀 있고 연결 표의 필드 이름은 `showOnScreen`이다 (`demoExcluded`는 `tests/sandbox/manifest.json` 쪽 이름). 함수 이름은 초안 그대로 두고 판정은 `showOnScreen`으로 했다 — 인수 테스트로 옮길 때 그대로 쓰면 맞는다.
3. 계약(`src/types.ts`)·인수 테스트·SPEC을 바꿔야 할 일은 **없었다.** `DemoLink`·`DemoLinksConfig`·`BoardState`·`EscalationSignals`를 그대로 썼다.

## 보완 (재시도 1회 — 사람의 스크린샷 확인 결과, 2026-11-10 12:25)

- 기준 SPEC: **v2.7** (`SPEC v2.7 (2026-11-10 11:55 KST)`). 지시서 "보완" 절의 안내대로 버전 차이로 멈추지 않았다
- 브랜치 / 구현 커밋: `lane/ui` / `0c3d90e`. 시작할 때 작업 트리는 깨끗했다 (이전 세션의 미완성 변경 없음)
- 실제 PayPal·LLM 호출 0회, `.env`를 찾지 않았고 개발 서버·`npm run start`를 띄우지 않았다 (`npm run build`로 확인)
- 수정 가능 폴더 밖은 고치지 않았다 (`src/app/` 이 작업 몫, `config/copy.*.json`의 `nav.`·`badge.`·`common.` 키, `tests/unit/app-shared*.test.ts`)

### 결과
**완료.** A 버그 2개, B 디자인 기준, C 견본 화면, D 검증 지적 3건을 모두 반영했다.

### A. 버그
| # | 무엇 | 고친 것 |
|---|---|---|
| 1 | 본문 아래 반복 메뉴 | `page.tsx`에서 메뉴 목록 삭제 (제목 + "아직 없음" 안내만) |
| 2 | 390px에서 본문 상자 잘림 | 원인 후보였던 `html, body { max-width: 100vw; overflow-x: hidden }` 삭제 (100vw는 세로 스크롤바 폭만큼 넘치고, 넘친 것을 숨겨 잘려 보였다). `.main`은 `width: 100%; max-width: var(--content-max); min-width: 0`. 머리글은 `flex-wrap`으로 두 줄까지 접히고, 메뉴는 `flex-wrap: nowrap; overflow-x: auto` (좁으면 메뉴만 가로로 넘겨 본다). 긴 글은 `overflow-wrap: anywhere`. css 어디에도 360px보다 넓은 고정 폭이 없다 (테스트) |

### B. 디자인 기준 (`src/app/globals.css` 한 곳)
| 항목 | 정한 값 |
|---|---|
| 강조색 1개 | 밝은 `#5b3cc4` / 어두운 `#a996f0` (보라 기 남색). PayPal 파랑 5색과의 최소 RGB 거리: 밝은 **105.3**, 어두운 **170.1** (기준 90). 메뉴 활성 밑줄·브랜드 표시·초점 테두리에만 쓴다 |
| 바탕 | 밝은 `#f6f6f3`(따뜻한 회백) + 카드 `#ffffff` / 어두운 `#111214` + 카드 `#1a1c1f`. 글자 `--color-text`·`--color-muted` |
| 뜻 있는 색 (강조색과 따로) | `--color-risk-high`·`-watch`·`-low`, `--color-success`·`--color-danger` (두 모드 모두 정의) |
| 대비 | 두 모드에서 글자색 8종(본문·흐린 글·강조·위험 3·성공·실패) × 바탕 2종 모두 **4.5:1 이상** (테스트가 계산) |
| 글꼴 | 시스템 글꼴 묶음 `--font-sans`. **`next/font/google`(Geist) 삭제** — 빌드 때 외부에서 내려받던 글꼴이다. PayPal 글꼴 없음 |
| 숫자 | `.num` (tabular-nums) 공용 클래스 1개. 주인공 숫자 `.hero-number` (`--text-hero`) |
| 글자 크기 5단계 | `--text-xs` 0.75 / `--text-sm` 0.875 / `--text-md` 1 / `--text-lg` 1.375 / `--text-hero` 2.5 rem. 다른 규칙의 `font-size`는 이 변수(또는 em)만 쓴다 (테스트) |
| 간격 | `--space-1`~`--space-5`, `--gutter`, `--content-max` |
| 카드 규칙 1개 | `.card` = `--card-padding` + `--card-border`(1px 실선) + `--card-radius`(8px), 그림자 없음 (`box-shadow` 0건, 테스트). 카드 사이 `--card-gap` |
| 배치 | 머리글 가로 한 줄 (이름 + 메뉴 탭). 왼쪽 세로 메뉴·파란 머리띠 없음 |

**배지 5종** (`_shared/badge-keys.ts` `BADGES`, `_shared/badges.tsx`). 모두 `--text-xs`, 글자색은 `--color-muted` 하나, 채도 높은 면 없음. 테두리 꼴 5개와 앞머리 기호 5개가 모두 서로 다르다 (테스트):

| 배지 | 테두리 | 기호 | 문구 키 |
|---|---|---|---|
| AI suggests | 긴 점선 (`dashed`) | ◇ | `badge.aiSuggests` |
| Code decides | 실선 (`solid`) | = | `badge.codeDecides` |
| Demo data | 옅은 바탕, 테두리 바탕색 (`fill`) | ◌ | `badge.demo` |
| Assumption | 점 (`dotted`) | ≈ | `badge.assumption` |
| cached (**새로**) | 없음, 기울임 (`none`) | ↺ | `badge.cached` |

배지마다 "언제 쓰는지" 한 줄 `badge.hint.*` (5개) — 기본 `title`과 견본 화면에 쓴다.

**위험 단계 3종** = 배지와 다른 부품 `RiskLevel` (`.risk`): 색 + 글자 + 기호 (High ▲ / Watch ◆ / Low ●). 1차 이름 `RiskBandBadge`는 같은 부품의 별칭으로 남겼다.

### C. 견본 화면 `/preview/styleguide` (메뉴에 없음, `robots: noindex`)
- 비교 카드 (`_shared/compare-card.tsx` `CompareCard`, T009가 그대로 쓴다): 이름표 "Expected loss" + `Assumption`·`Demo data` 배지, 왼쪽 "PayPal data only" → 오른쪽 "With carrier data"(주인공 숫자)
- 두 값은 `src/app/preview/styleguide/sample.ts` `compareSample()`이 **엔진으로 계산**한다: 서연 꼴 보드(INQUIRY · 미수령 · 7200¢ · 링크 4개)를 `hasTracking:false`+A1(규칙) / `hasTracking:true`+A2(규칙)로 `recommend`에 넣은 `best.expectedLossCents` → `toDollarsRounded`. 지금 설정으로 **7400¢ `$74`(refund) → 3680¢ `$37`(fight)**, 빌드된 HTML에서도 `$74`·`$37` 확인. 화면 코드(`src/app/**/*.tsx`, `preview/**/*.ts`)에 `74`·`37`·`7400`·`3680` 없음 (테스트). 가정값 `feeCents`를 바꾸면 견본 값도 바뀐다 (테스트)
- 그 밖: 배지 5종(이름 + 언제 쓰는지), 위험 단계 3종, 기본 카드 규칙, 글자 크기 5단계, 색 견본 6개. 글자는 모두 `common.preview.*`·`badge.*` 문구

| 다른 화면 지시서가 쓸 것 | 인수 | 내용 |
|---|---|---|
| `CompareCard` | `{ label, badges?, before: {caption, display, note?}, after: {…}, footer?, arrowLabel }` | 계산하지 않는다. `display`는 부르는 쪽이 `toDollarsRounded`로 만든 글자 |
| `Badge` | `{ kind: 'aiSuggests'\|'codeDecides'\|'demo'\|'assumption'\|'cached', title? }` | + `DemoBadge`·`AssumptionBadge`·`AiSuggestsBadge`·`CodeDecidesBadge`·`CachedBadge` |
| `RiskLevel` | `{ band: 'High'\|'Watch'\|'Low', title? }` | 엔진이 정한 구간만 옮긴다 |
| 클래스 | `.card` `.stack` `.row` `.grid` `.num` `.hero-number` `.label` `.muted` `.small` `.page-title` `.section-title` `.notice` `.text-success` `.text-danger` | 색은 `var(--color-*)`만 |
| `reasonCopyKey` (`_shared/availability.ts`) | `(reason)` | 사유 코드 → `common.reason.<code>` |

### D. 독립 검증이 찾은 것
1. **구매자 글 두 번 세기**: `buyerMessagesWithTime`을 `@/paypal/mapper`의 `buyerTexts`와 같은 규칙으로 바꿨다 (시각 순 정렬 → 앞뒤 공백 뺀 글이 같으면 먼저 오는 것 하나). 시험: `tests/fixtures/dispute-detail.inquiry-waiting-seller.json`(messages 1 + evidences 1, 같은 글) → 1건, 시드 문의 없는 구매자(연결 표 `seedDisputeId: null`)로 `loadDemoDisputes` → `secondMessageUnanswered: false`
2. **`server-only`**: `src/app/_server/` 3개 파일 맨 위에 `import 'server-only';`. vitest(node 환경)에서는 이 import가 예외를 던지므로 **테스트 파일 안에서** `vi.mock('server-only', () => ({}))`로 빈 모듈을 끼웠다 (`tests/unit/app-shared-disputes.test.ts`). `vitest.config.ts`는 고치지 않았다. 빌드는 `_server/`를 import하는 화면이 아직 없어 영향 없음
3. **사유 고정 코드**: `paypal.reason`·`llm.reason`은 `not_configured`·`not_sandbox`·`client_error`·`server_only`·`request_failed`·`partial`만 (`_shared/availability.ts` `UNAVAILABLE_REASONS`). 목록 조회 예외 문장(한국어 포함)은 싣지 않는다 (테스트). 화면 문구 `common.reason.*` 6개. `common.paypalUnavailable`은 "credentials are not set" → **"PayPal sandbox unavailable"**로 바꿨다 (조회 실패 때도 맞는 문장. 검증 기록 10번)

### 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm test` | 1359 | 0 | T047 몫: `app-shared` 27, `app-shared-disputes` 26 (+4), `app-shared-design` 19 (새로) |
| `npx tsc --noEmit` | — | 0 | 출력 없음 |
| `npm run lint` | — | 0 | 경고 0 |
| `npm run test:acceptance` | 155 (+9 skip) | 0 | 기대값을 고치지 않았다 |
| `npm run build` | 성공 | 0 | 경로 `/`, `/_not-found`, **`/preview/styleguide`** (모두 정적) |

- `.next/static/`에서 `PAYPAL_CLIENT_SECRET`·`LLM_API_KEY` 0건 (`grep -rlE`)

### 완료 기준 (보완) 확인
- [x] `/`와 `/preview/styleguide`가 빌드 경로 목록에 있다
- [x] 색·글자 크기·간격·카드 규칙이 `globals.css` 변수. `src/app/`의 tsx·ts·css에 변수 정의 밖 `#…`·`rgb(…)` 0건 (테스트가 파일을 읽어 검사)
- [x] 강조색 거리 105.3 / 170.1 (≥ 90). 글꼴 이름에 `PayPal` 없음. 위험 3·성공·실패가 강조색과 다른 변수·다른 값
- [x] 배지 문구 키 8개(배지 5 + 위험 3) 두 파일에 있음. 배지 5종 테두리 꼴·기호 모두 다름
- [x] 비교 카드 값 = `recommend` 결과 (테스트). 화면 코드에 `74`·`37`·`7400`·`3680` 없음
- [x] 본문 컨테이너 `max-width` + `min-width: 0`, 고정 폭 없음 (코드 검사). 실제 360·390px 화면은 컨트롤 타워가 스크린샷으로 본다
- [x] D의 세 가지 테스트
- [x] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과. 개발 서버 띄우지 않음

### 남은 문제
1. **화면은 눈으로 보지 않았다.** 개발 서버를 띄우지 않는 규칙이라 360·390·1440px, 밝은·어두운 모드 모습은 컨트롤 타워의 배포용 빌드 스크린샷이 처음이다. 특히 볼 곳: 390px 머리글(이름 줄 + 메뉴 줄로 접힘), 메뉴 가로 넘김, 비교 카드가 30rem 아래에서 세로로 쌓이는 것, 배지 `cached`(테두리 없음)가 너무 흐리지 않은지
2. **강조색을 보라 기 남색으로 골랐다.** 청록(`#0f766e`)도 후보였지만 PayPal `#0070BA`·`#003087`과의 거리가 76 정도라 기준 90을 넘지 못했다. 초록 계열은 Low 위험·성공 색과 뜻이 겹쳐 뺐다. 사람이 보고 바꾸려면 `--color-accent` 두 줄만 고치면 되고, 테스트가 거리·대비를 다시 잰다
3. 1차 때 `AI suggests`(보라)·`Code decides`(회색)로 적힌 색 구분은 B-4("색보다 글자와 모양") 지시로 없앴다 — 이제 다섯 배지 모두 같은 회색 글자다. SPEC 3장 문구가 색을 말하면 컨트롤 타워가 맞춰 주면 좋겠다
4. 1차 "남은 문제" 1·2·4번(추적 정보 기본값, `Demo data` 배지 범위, LLM 호출 횟수)은 이번 범위가 아니라 그대로다. buyer_m(D3) 실제 보드 "추적 없음"도 지시서대로 고치지 않았다

### 컨트롤 타워에 요청할 결정
1. 강조색 확정 (남은 문제 2) — 스크린샷 확인 때
2. SPEC 3장의 배지 색 표기("보라"·"회색")를 모양 구분으로 바꿀지 (남은 문제 3)
3. 계약(`src/types.ts`)·인수 테스트·SPEC을 바꿔야 할 일은 이번에도 **없었다**
