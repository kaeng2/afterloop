# T067 보고 (2026-11-10 16:20)

- 기준 SPEC: v2.10 (시작할 때 SPEC.md 첫 줄 `SPEC v2.10`과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 37dd2a7 (구현). 이 보고서는 다음 커밋

## 결과
완료. 공용 틀을 시안 v3 값에 맞췄고(전체 폭, Figtree + Noto Sans KR, 2px 카드, 알약, 그림자 하나), 목록은 점 = 위험 등급 · 알약 = 상태로 나눴다. 추적 상세에 [Add both to PayPal] 버튼(게이트 `liveGateFromEnv`, 꺼지면 dry run)을 붙였고, Prevent 고르기를 엔진 `pickPreventProduct`로 바꿨다. 스위치를 켜지 않았고, 개발 서버를 띄우지 않았고, 실제 PayPal·AI 호출도 하지 않았다 (테스트는 가짜 호출기만 썼다).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/globals.css` | 시안 값 변수: `--color-list-bg #F1EFEA`, `--color-divider #E4E6E9`, `--color-text-body #3F4144`(`--color-text`도 같은 값), `--color-heading #000`, `--color-border #E4E6E9`, 점 색 4개 `--color-dot-*`, 알약 색 6개 `--color-pill-*`, `--shadow-selected`, `--radius-pill`, `--card-border 2px`, `--card-radius 20px`, `--content-max: none`(가운데 고정 폭 상자 없앰), `--font-sans`/`--font-ko`. 어두운 모드 값은 같은 이름으로 (아래). `body`는 본문색, `h1–h3`은 제목색, `:lang(ko)`는 Noto Sans KR이 먼저 |
| `src/app/layout.tsx` | `next/font/google` Figtree + Noto_Sans_KR (`variable` 두 개를 `<html>`에 붙인다). 빌드 때 받아 자체 제공한다 (빌드 결과에 woff2 127개, css에 fonts.googleapis 0건) |
| `src/app/_shared/top-bar.tsx`, `shell.css` | 28px 원형 로고 마크(인라인 SVG: 원 = 강조색, 고리 = 카드 바탕색) + 굵은 "AfterLoop"(800). 막대 `width:100%`, 아래 선 `--color-divider`. 알약 모서리는 `--radius-pill` |
| `src/app/today/model.ts` | `TodayItem.chipKey` → `dot`(위험 등급) + `status`({문구 키, tone}). 고르는 규칙은 `disputeStatus`: Routine → Skipped, 위험 High → High, Watch → Watch, 엔진 판정 `awaiting_approval` → Waiting approval, 그 밖 → Skipped. 추적 = Watch, Prevent = 회색 "Prevent". Routine·Prevent 점은 회색. 화면 쪽 `pickPrevent`를 지우고 엔진 `pickPreventProduct(store)`를 부른다 |
| `src/app/today/today-list.tsx`, `today.css` | 한 줄 = 점(`aria-hidden`) + 이름/아래 줄 + 상태 알약. 고른 항목은 흰 카드 + `box-shadow: var(--shadow-selected)`. 목록 칸 바탕 `--color-list-bg`, 340px(21.25rem), 왼쪽 끝, `height: calc(100vh - 4.5rem)` + 그 칸만 스크롤 (T061 배치 유지). 상세 글 최대 폭 80rem(T061 값) 유지 |
| `src/app/today/tracking-result.ts` (새 파일) | `registerTrackers` 결과를 문구 키 글자로 옮긴다: dry run "Simulated · nothing was sent to PayPal"(추적번호 안 보임), 모두 등록 "✓ N trackers added · Orders tracking API · 201" + 행마다 추적번호, 실패 "x of y not added · …" + 행마다 이유(문구 키. PayPal 응답 문장·debug_id·한국어 메모는 싣지 않는다). 버튼 글자: 1건 "Add to PayPal" / 2건 "Add both to PayPal" / 3건 이상 "Add all N to PayPal" |
| `src/app/_server/tracking-register.ts` (새 파일, `server-only`) | 대상은 서버가 다시 정한다: `listUntracked`(GET만)에서 분쟁 없는 미등록 주문 = O05·O07. 그 뒤 `registerTrackers(client, { data, selectedKeys, live: liveGateFromEnv(env, manifest 키) })`. `registerTrackers`가 분쟁 판정을 한 번 더 한다 |
| `src/app/today/actions.ts` (새 파일, `'use server'`) | `addTrackingAction()`: 브라우저 값을 받지 않는다. `registerTrackingFromScreen({ paypal: getPayPalClient(), env: process.env })`. 하나라도 실제로 등록되면 `revalidatePath('/')`로 다시 읽는다 (Today 추적 항목 수가 줄어든다). 예외 문장은 싣지 않는다 |
| `src/app/today/tracking-register.tsx` (새 파일, client) | 버튼 + 결과 줄(`role="status"`). 서버 액션만 부르고 주문 키를 보내지 않는다. 서버 코드를 import하지 않는다 (서버 액션은 `page.tsx`가 prop으로 넘긴다) |
| `src/app/today/tracking-detail.tsx`, `src/app/page.tsx` | 설명 줄 아래에 버튼 (`register` prop이 있을 때만). 회색 줄(O02·O13)은 T061에서 이미 같은 4열 표였다. 확인 테스트만 더했다 |
| `src/app/products/products.css`, `cases/reply/reply.css`, `cases/view/case.css` | 하드코딩한 16px·999px 모서리, 1px 카드 테두리를 `--card-radius`·`--radius-pill`·`--card-border` 변수로 바꿨다 (새 카드 규칙 하나로) |
| `config/copy.en.json`, `copy.ko.json` | 추가만: `today.status.waitingApproval`·`today.status.prevent`, `today.tracking.add*`·`result.*`·`row.*`·`reason.*`·`error.*` (두 파일 같은 키) |
| `tests/unit/app-t067.test.ts` (새 파일) | 21개: 추적 등록(가짜 호출기·가짜 env), 추적 상세 마크업, 배치·색·알약·그림자·로고 값, 파랑 계열 금지 |
| `tests/unit/app-today.test.ts` | `pickPrevent` → 엔진 `pickPreventProduct`. 점·알약 테스트 4개 추가. "등록 버튼 없음" → "서버 액션을 안 넘기면 버튼 없음". css 검사에서 `box-shadow: var(--shadow-selected)` 하나만 허용 |
| `tests/unit/app-t061.test.ts` | Mike 회색 칩 테스트를 `status`/`dot`·`today-pill-neutral`로 바꿨다 (뜻은 같다) |
| `tests/unit/app-shared-design.test.ts` | 아래 "디자인 테스트에서 바꾼 줄" |

### 디자인 테스트(`app-shared-design.test.ts`)에서 바꾼 줄 — 글꼴·그림자·카드 규칙뿐
| 규칙 | 전 | 후 | 이유 |
|---|---|---|---|
| B-2 글꼴 | 모든 파일 `next/font/google` 금지 | `layout.tsx` 한 곳만 허용 + Figtree·Noto_Sans_KR import, `--font-figtree`/`--font-noto-kr` 변수, `--font-sans` 순서, `:lang(ko)` 규칙을 검사. `@import url`·`fonts.googleapis`·PayPal 글꼴 금지는 그대로 | T067 사람 결정 (T047 "외부 글꼴 금지" 변경) |
| B-3 카드 | `box-shadow` 전면 금지 (테스트 1개) | 테스트 2개로: ① 카드 변수 + `--card-border = 2px solid var(--color-border)`, `--color-border = #e4e6e9`, 모서리 16~24px, `--radius-pill = 999px` ② 모든 css의 `box-shadow` 값은 `var(--shadow-selected)`뿐 + 값이 `rgba(0, 0, 0, 0.14) 4px 4px 28px 6px`, tsx에 `boxShadow` 없음 | T067 사람 결정 (그림자 하나만 허용, 카드 값 변경) |

그 밖의 규칙(색은 변수만, 강조색과 PayPal 파랑 거리 90 이상, 위험·성공·실패 색 분리, 대비 4.5:1, 어두운 모드 재정의, 글자 크기 변수 5개, `.num`·`.hero-number`, 배지 5종 모양, 360px 고정 폭, 메뉴 넘김, `.main`의 `max-width: var(--content-max)` + `min-width: 0`)은 고치지 않았다. 모두 통과한다.

### 어두운 모드 값 (시안에 없어 정했다)
`--color-text`/`--color-text-body #e3e5e8`, `--color-heading #ffffff`, `--color-divider #2e3136`(테두리와 같다), `--color-list-bg #141517`(카드 `#1a1c1f`보다 조금 어둡게. 밝은 모드처럼 목록이 상세보다 한 단 낮다), 점 `#f97066 / #fdb022 / #47cd89 / #80868b`(위험 3색은 기존 어두운 모드 위험색과 같다), 알약 High `#45201c`/`#ffb4a9`, Watch `#3d2f0d`/`#fdd47b`, 중립 `#2a2d31`/`#d5d8dc`, `--shadow-selected: rgba(0, 0, 0, 0.55) 4px 4px 28px 6px`(어두운 바탕에서도 보이게 진하게).

### 목록 배지 (지금 보기용 데이터)
| 항목 | 점 | 알약 |
|---|---|---|
| 서연 | 빨강 (High) | "High" 연분홍 |
| 추적 2건 | 노랑 (고정 Watch, T061) | "Watch" 연노랑 |
| 지호 | 엔진 위험 등급 색 | "Waiting approval" 회색 (엔진 `awaiting_approval`) |
| 가디건 (Prevent) | 회색 | "Prevent" 회색 |
| Mike | 회색 | "Skipped" 회색 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 158 | 0 | 9 skipped (기존과 같다) |
| npm test | 1934 (42 파일) | 0 | 새 테스트 `app-t067` 21개 포함 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | 빌드 때 Google 글꼴을 받았다 (네트워크 필요). 결과 css에 `fonts.googleapis`/`gstatic` 0건 |

추적 버튼 완료 기준을 묶은 테스트 (`app-t067.test.ts`):
- 스위치 꺼짐(env 없음) → POST 0회 + "Simulated · nothing was sent to PayPal", 추적번호 안 보임
- 스위치 일부만(`AFTERLOOP_TRACK_RECORDING` 없음) → POST 0회, 행마다 "Not turned on for this order"
- 테스트 안 가짜 env로 켜짐 → O05·O07만 POST(`/v2/checkout/orders/{id}/track`), "✓ 2 trackers added · Orders tracking API · 201" + 행마다 추적번호
- 허용 목록에 O01·O02·O04·O08·O13을 넣어도 분쟁 주문은 POST 0회 (GET도 0회)
- 실패(422) → "1 of 2 not added · …" + 행마다 "PayPal did not accept it (422)", 응답 문장·debug_id 없음
- 결과 줄 세 가지(실제/가짜/실패)가 서로 다르다

## 남은 문제
- **T064 기록기(PayPal activity)가 아직 없다.** 등록 결과는 기록기를 지나지 않는다. T064가 `registerTrackingFromScreen` 결과(또는 `registerTrackers` 배치 결과)를 기록기에 연결해야 "Add tracking 201"이 서랍에 남는다 (T067 지시서 3번 괄호대로).
- T063의 나머지("4× more likely" 줄, 발송일 열)는 이 작업 범위가 아니라 넣지 않았다 (T067은 버튼만 당겼다).
- `tasks/T063.md`는 스위치 이름을 `AFTERLOOP_RECORDING`이라고 적었는데, 실제 코드(`src/paypal/track.ts` `liveGateFromEnv`)는 **`AFTERLOOP_TRACK_RECORDING`**을 읽는다. 녹화 때 이 이름으로 켜야 한다. 이 작업은 코드를 따랐다.
- `--color-text`와 `--color-text-body`가 같은 값이다. 기존 화면 코드가 `--color-text`를 쓰고 대비 테스트도 그 이름을 보므로 둘 다 두었다.
- `--content-max: none`이라서 Products·견본 화면도 가운데 상자 없이 전체 폭(좌우 여백 24px)으로 그려진다. 스크린샷 때 Products 화면도 봐 주면 좋겠다.
- 화면 스크린샷은 찍지 않았다 (컨트롤 타워가 찍는다). 버튼도 누르지 않았다.

## 컨트롤 타워에 요청할 결정
- 없음. (참고: T063 지시서의 스위치 이름 `AFTERLOOP_RECORDING`을 실제 코드 이름 `AFTERLOOP_TRACK_RECORDING`으로 고쳐 두면 녹화 때 덜 헷갈린다.)
