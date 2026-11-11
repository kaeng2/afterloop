# T087 보고 (2026-11-11 22:20)

- 기준 SPEC: v2.12   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / c99bc42 (구현) + 이 보고서 커밋

## 결과
완료 — `/listing`(Scene 3)을 시안 흐름대로 만들었다: 상품 추가 폼 → Publish → 점검 모달(진행 → 결과) → See details and fix → Missing 표시 + AI 넣기 → Recalculate → Publish → 완료 카드. Publish anyway·Replay도 있다. `POST /api/listing-check`도 만들었고, 메뉴는 "Black Friday rehearsal" → `/listing`, "Products" → `/products`로 바꿨다. 숫자는 모두 엔진 결과다. 진행 표시는 requestAnimationFrame 한 번마다 `sim.step(progressChunkRuns)`가 돌려준 값이다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/listing/page.tsx` (새) | route group `(app)` 밖. `applyLangParam('/listing')`(T081 쿠키·?lang) 뒤 `ListingScreen` |
| `src/app/listing/listing-screen.tsx` (새) | 클라이언트. `useReducer` + 진행 effect(run id마다 1회) + Publish 때 AI 서버 액션 1회 |
| `src/app/listing/model.ts` (새) | 순수 reducer(edit/publish/progress/finished/toDetail/publishAnyway/recalc/publishFinal/backEdit/restart/drafts/insert)와 `buildView`(표기만). 판정은 `detectListingFeatures`·`isPeak`, 입력칸 연결은 `listing-model.json` rules[k].field |
| `src/app/listing/progress.ts` (새) | `runListingCheck`: `createListingSim` → rAF마다 `step(chunk)` → `onProgress(done)` → 끝나면 `result()` + `listingFixGains` |
| `src/app/listing/listing-view.tsx` (새) | 그림만 (정적 렌더 시험용). 쇼핑몰 껍데기는 `aria-disabled`. "PayPal payments"는 글자만 |
| `src/app/listing/format.ts` (새) | 표기: `4.5%`, `−0.9 pts`, `9.0`, 날짜, `{{}}` 채우기 |
| `src/app/listing/fixes.ts`, `actions.ts` (새) | 서버 액션 → zod(상품명·설명) → `getLlm()` 호출기(캐시·횟수 제한 그대로) → `draftListingFixes` 1회. AI가 없으면 null |
| `src/app/listing/listing.css` (새) | 색은 변수 정의 줄에만. 강조색 #5b3cc4 계열. 시안의 파랑 그라데이션도 강조색으로 바꿈. 1100px 이하 상세 1열, 900px 이하 왼쪽 메뉴 숨김, 640px 이하 모든 칸 1열 |
| `src/app/api/listing-check/route.ts` (새) | zod(strict, 날짜 순서, units ≤ `LISTING_MAX_UNITS`, 글 4000자) → `checkListing` → `{ result }`. 잘못되면 400 `{error:'invalid_input'}` |
| `src/app/_shared/top-bar.tsx` | 메뉴 연결만: `TOP_TABS = Today · /listing(nav.listing) · /products`. `nav-items.ts`는 수정 가능 폴더 밖이라 그대로 두었다 |
| `config/copy.{en,ko}.json` | 메뉴 이름 키만: `nav.products` "Products"/"상품", `nav.listing` 추가 "Black Friday rehearsal"/"블랙프라이데이 리허설" |
| `config/listing.{en,ko}.json` (새) | 이 화면 문구 + 고정 데모 값(가격 8900¢·수량 200·사진 4장). 키 집합 같음. ko는 시안 LI.ko 기준 |
| `public/listing/{front,back,detail,colors}.jpg` (새) | 시안 assets 사진 4장 복사 |
| `tests/unit/app-t087-listing.test.ts` (새) | 아래 23건 |
| `tests/unit/app-today.test.ts` | 메뉴 이름 기대값 1줄: `nav.products`가 "Products"로 바뀌어서 |

정직성 (DECISIONS "Scene 3 정직성"):
- ① 분석 3단계 "Applying assumed dispute rates by type", 기준 Data "Assumed rates (planning draft) · 500 simulations"(500은 `result.runs`) + Assumption 배지.
- ② 계산 방법 설명의 `{{fee}}`·`{{refundShare}}`·`{{time}}`은 `listingParamsFromConfig()`로 채운다 ($15, 50%, $2).
- ③ Black Friday 안내는 숫자 없는 문장이다.
- ④ API 알약 설명: "Same check as POST /api/listing-check… no PayPal or AI call".
- ⑤ AI 문구는 영어 그대로, `[__]`는 `<mark>`로 표시한다. 시안의 "Knot & Co."·"Uses your PayPal dispute and sales data"는 쓰지 않았다.
- 분석 단계 1~3 표시: `createListingSim`이 만들어질 때 판정·성수기·확률을 이미 끝낸다. 그래서 실행 중에는 1~3을 ✓로 두고, 4번에 실제 n / 500을 보인다.
- 시안에 있던 "−x pts" 변화 칩, 완료 카드의 손실 −p%는 화면이 뺄셈을 해야 하는 숫자라 넣지 않았다. 대신 "Before 4.5%"와 "이전 → 이후"로 보인다. 고칠 점별 "chance −x pts"는 엔진 `listingFixGains` 값이다.
- 상세에서 글을 바꾼 채 Publish를 누르면, 계산하지 않은 숫자를 보이지 않으려고 같은 진행 규칙으로 다시 계산한 뒤 완료 카드로 간다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 | 0 | 9 skipped = ac13 샌드박스 (RUN_SANDBOX, 원래부터) |
| npm test | 2304 + T087 보강 | 0 | 61 파일. T087 23건 (마지막 실행 23/23) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | `/listing` 16 kB, `/api/listing-check` 동적 |

T087 시험이 확인하는 것:
- 흐름: 기본 입력 = AC34 BASE. Publish 뒤 첫 프레임은 20/500이다. 이후 진행 값 목록은 따로 `step(20)`한 목록과 같고, 500에서 결과가 나온다.
- 결과: `checkListing(BASE)`와 같다 (4.5%, $770, $472–$1,140, 약 9.0건). 점 200개, 상위 3개 유형, 고칠 점 상위 4개 = `listingFixGains` 순서·표기.
- 상세: Missing 칩 4칸. AI 가짜 응답의 ret("Free returns")은 코드가 막아 넣기 버튼이 없다. 넣으면 입력칸 끝에 붙고 Missing이 사라진다. 그 뒤 Changed → Recalculate(20/500부터) → 확률이 내려가고 → Publish → 완료 카드 "4.5% → x%" → Replay로 처음 값.
- 글을 바꾸고 바로 Publish하면 다시 계산한다. Publish anyway, AI 없음(버튼 없음), ko(문구 다름·숫자 같음)도 본다.
- 정적: listing 폴더에 setInterval·setTimeout이 없고, `done`은 progress 액션으로만 바뀐다.
- API: 결과 = `checkListing` = 화면 모달 결과. 잘못된 입력 10종은 400이고, 라우트에 PayPal·AI import가 없다.
- `/listing` page를 그려도 Today·PayPal·LLM 가짜 모듈이 0회 불린다. 서버 액션은 LLM을 1회 부르고, 빈 상품명이면 0회다.
- 색·문구: PayPal 파랑 없음. "Knot & Co."·"PayPal disputes & sales"·"Comparing with your PayPal dispute history" 없음. BF 안내에 숫자 없음. lossTip은 자리표시자를 쓴다. en/ko 키 집합(중첩 포함)이 같다. 사진 4장, 메뉴 3개(en/ko)를 확인한다.
- `.next/static`: 빌드가 있으면 키 이름·AI 프롬프트·샌드박스 주소·PayPal 파랑을 검사한다 (빌드 뒤 통과).

## 남은 문제
- **화면 배치 눈 확인은 못 했다**: 1920×1080·1440·390 폭. 개발 서버 금지라 브라우저로 띄우지 않았다. css로 시안 배치(상세 6fr/5fr, 최대 1320px; 모달 최대 1040px)를 옮겼고, 좁은 폭 규칙과 `.ls { overflow-x: clip }`도 넣었다. 스크린샷(컨트롤 타워 몫)으로 확인이 필요하다.
- 계산은 브라우저 메인 스레드에서 돈다. 진행 뒤 `listingFixGains`(7회분 시뮬레이션)를 한 번에 돌리므로, 결과가 뜨기 직전에 짧게 멈출 수 있다 (200장 기준 수십~백수십 ms 예상, 실측 안 함).
- AI 고칠 문구 캐시는 아직 없다 (지시서 "다음": 컨트롤 타워가 만든다). 캐시 없이 public 모드에서는 시간당 한도 안에서 실제 호출이 날 수 있다. 키가 없으면 넣기 버튼이 숨는다.
- 사진 추가 칸·Save draft·검색창·왼쪽 메뉴는 동작하지 않는 데모 껍데기다 (`aria-disabled`).

## 컨트롤 타워에 요청할 결정
- `src/app/_shared/nav-items.ts`는 수정 가능 폴더 밖이라 `NAV_ITEMS`를 바꾸지 않았다. `/listing` 탭은 `top-bar.tsx`의 `TOP_TABS`가 끼운다. 한 곳에 모으려면 다음 작업에서 `nav-items.ts`를 허용해 주면 옮기겠다 (지금도 동작·시험에는 문제없음).
