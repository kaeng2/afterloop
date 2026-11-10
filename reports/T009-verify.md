판정: 통과

# T009 1부(보기) 독립 검증 (lane/ui, HEAD 1c12479, 2026-11-10)

화면 모양은 보지 않았다 (개발 서버 금지, 스크린샷은 컨트롤 타워). 실제 PayPal·LLM 호출 0회, `.env` 사용 없음. 코드·테스트·문서는 수정하지 않았다.

## 1. 범위
- `git diff main...HEAD --stat`: 14개 파일, +2050 / -36.
- 1부 수정 가능 파일 안: `page.tsx`, `model.ts`, `view/*`, `_shared/compare-card.tsx`, `preview/styleguide/page.tsx`, `tests/unit/app-case-view.test.ts`(새 파일, 허용 패턴 `app-case-view*`), `config/copy.en/ko.json`, `reports/T009-impl.md`.
- 목록 밖: `src/app/_shared/compare-card.css`, `src/app/cases/view/load.ts` (구현자가 밝힌 2개). 그 밖의 목록 밖 변경 없음.
- `src/engine`·`src/paypal`·`src/exec`·`src/ai`·`seed`·`config/rules.json`·`config/demo-links.json`·`package.json`·`vitest.config.ts`·`tests/acceptance` 변경: 0줄 (`git diff --stat`가 비어 있음). `globals.css`, `tests/unit/app-shared-design.test.ts`, `styleguide/sample.ts`도 변경 없음.
- 문구 파일: en·ko 모두 `case.` 밖 키 변경 0, 삭제 0, 추가 67개(모두 `case.view.*`/`case.badge.fromPaypal`). en/ko 키 144개로 동일.
- 새 파일 2개 판단: 취지에 맞다. `compare-card.css`는 지시서 비교 카드 다듬기 2·3번(나란히/폭 맞춤)이 CSS를 요구하고 수정 허용 부품 `compare-card.tsx` 바로 옆에 있다. `globals.css`(T047 파일)를 건드리지 않으려 따로 둔 것이라 오히려 범위 보존에 가깝다. `load.ts`는 `src/app/cases/view/` 안(수정 가능 폴더)이고 2부 파일·엔진·PayPal·AI 코드를 고치지 않는다. 둘 다 승인해도 된다.

## 2. 실행 결과
| 명령 | 결과 |
|---|---|
| `npm test` | 33 파일, 1607 통과, 실패 0, 종료 0 (`app-case-view.test.ts` 40개) |
| `npx tsc --noEmit` | 종료 0 |
| `npm run lint` | 종료 0 |
| `npm run test:acceptance` | 12 파일, 155 통과, 9 skipped, 종료 0 |
| `npm run build` | 성공. 경로: `ƒ /cases/[disputeId]` (1.16 kB), `○ /preview/styleguide`, `/`, `/_not-found` |

## 3. 화면은 계산하지 않는다
- `src/app/` 전체에서 `74`·`37`·`7400`·`3680`·`6`·`3` 리터럴 검색: 주석 제외 일치 0건 (`money.ts`의 `\d{3}` 정규식·`padStart(3` 만 T047 파일에서 나옴, 이번 변경 아님). 곱셈·나눗셈·`Math.round/floor/ceil`·`toFixed`·`/100`: 이번 변경 파일에 0건 (`money.ts` T047, `disputes.ts` `Math.max`는 T047).
- 탐침(`.../scratchpad/t009-verify/probe.ts`, 서연 꼴 보드 + `P`·`R` 고정 사본):
  - 전: `refund`, 7400¢, `$74`. `recommend(before).best` = refund 7400 / `toDollarsRounded` = `$74`. 일치.
  - 후: `fight`, apiMove `send_message`, 3680¢, `$37`. `recommend(after).best` 동일. 일치.
  - 위험: 지금 6 High, 답장 후 3 Watch, `escalationRisk` 결과와 같다 (parts 3·2·1·0).
  - `feeCents` 1500 → 800: 전 7000¢ `$70`, 후 3400¢ `$34`로 따라 바뀌고 `recommend(보드, P2, R)`와 같다.
  - 신호 `null`, 후 보드 `null`: `risk`·`riskAfterReply`·`compare.after`·`carrier`·`cause.after` 모두 `null`, 예외 없음.

## 4. 비교 카드 다듬기 (지시서 1~5번)
1. 행동 글자: `actionKeyFor(best.move)`. 서연 전 `case.view.action.refund`("Full refund"), 후 `case.view.action.fight`("Reply"). 지호 꼴(`D1_JIHO` + 규칙 원인): 엔진 best = `offer`, 후 칸 `case.view.action.offer`("Offer"). 일치.
2. 배지: 카드 머리 `['assumption']`, 왼쪽 칸 `[]`, 오른쪽 칸 `['demo']`. 렌더 결과(실제 `CompareCard`를 `renderToStaticMarkup`)에서도 `Demo data` 자리는 오른쪽 `.cc-caption` 안에만 있다.
3. 취소선: `<del class="cc-value cc-previous num"><span class="cc-sr-only">Previous value </span>$74</del>`. 의미 있는 요소 + 읽기용 글자 있음. 화살표 `role="img"`, `aria-label`은 `t('case.view.arrow')`(문구 키) 값.
4. `compare-card.css`/`case.css`: `#hex`·`rgb(`·`hsl(` 0건, 색은 `var(--…)`만. 숫자는 `num`(= `globals.css`의 `tabular-nums` 공용 클래스)를 쓰고, `.cc-previous`에는 `font-variant-numeric: tabular-nums`가 중복으로 한 번 더 있다 (무해, 기록만).
5. 좁은 폭(30rem 아래) 규칙: 왼쪽 → 화살표 → 오른쪽 순서 유지(`@media`에 화살표 `rotate(90deg)`). 모양 자체는 확인하지 못했다.

## 5. 장면의 사실과 정직성
- 원인 배지: 탐침에서 전·후 모두 `decidedBy: 'code'`, `badge: 'codeDecides'`. `cause.source === 'rule'` 기준이고 LLM 원인이면 `aiSuggests`로 간다 (단위 테스트 있음).
- 시연용 표시: 배송사 카드 `badges: ['demo']`, 11/02 문의 `['demo']`, 영어가 시드면 `demo`, 무응답 신호 줄 `demo: true` (시드 문의가 있을 때만), 후 칸·후 원인 줄 `Demo data`. 실제 글: `badges: []`, `sourceKey = case.badge.fromPaypal`("From PayPal").
- 가림: 원문·영어 모두 `maskPersonal` (`P123456789012` → `⟦PCCC⟧` 확인).
- 404: `linkFor`로 확인 — `PP-R-HEY-10197767` false, `PP-R-GAH-10197649` false, 표 밖 번호 `undefined`. `loadCase`는 `isOnScreen` 거짓이면 `loadDemoDisputesForRequest`를 부르기 전에 `not_found`를 돌려주고 페이지가 `notFound()`. 단위 테스트가 읽기 0회를 가짜 호출 횟수로 확인.
- POST: `src/app` 전체에서 `client.call`·`executeMove`·`method: 'POST'` 없음 (`_server/paypal.ts`의 `fetch` 래퍼는 T047 파일, 이 화면은 GET 읽기만 부른다).

## 6. 제안이 먼저
- 지호 꼴: `messageSend = { blocked: true, reasonKey: 'case.view.offerFirst' }`, 화면에 `notice`로 이유 문구가 그려진다 (`case-view.tsx`). 버튼은 2부라 없음(정상).
- 서연 꼴: `blocked: false`. 제안 링크 없는 지호 꼴(`make_offer` 제외): `blocked: false`.
- `buildCaseView`가 같은 보드로 방금 `recommend`한 결과(`recDemo ?? recReal`)를 `offerComesFirst`에 넘긴다. 옛 추천 재사용 없음.

## 7. 비밀값·서버 전용
- 빌드 뒤 `.next/static/`에서 `PAYPAL_CLIENT_SECRET`·`PAYPAL_CLIENT_ID`·`LLM_API_KEY`·`AFTERLOOP_TRACK`·`api-m.sandbox.paypal.com`·`client_credentials`·`AFTERLOOP_REAL_SEND`: 일치 파일 0개.
- `load.ts` 14번째 줄 `import 'server-only'` 있음. `'use client'` 파일은 `conversation.tsx`(그리고 T047 `nav.tsx`)뿐이고, `_server/`·`load.ts` import 없음 (`model.ts`는 type import만).
- `globalThis.React`: `tests/unit/app-case-view.test.ts` 37번째 줄 한 곳에서만 설정, 설정 파일·소스 변경 없음. 테스트 의미에는 영향 없음 (렌더 입력 준비용).

## 8. LLM
- 1부는 `loadCaseDraft`로 `draftReply`를 요청당 1회 부른다(`react cache`로 같은 분쟁 중복 호출 방지, `loadCase`에서 한 번). 번역·어조·분류 호출은 1부에 없다.
- 키가 없으면 `getLlm()`이 `not_configured`를 돌려주고 `loadCaseDraft`가 호출 없이 `{ ok:false, reason:'ai_unavailable', detail:'llm_failed:LlmConfigError' }`를 돌려준다. 화면은 `common.llmUnavailable` 문구. 가짜 호출기가 `LlmConfigError`로 던지는 경우 `draftReply`가 `{"ok":false,"reason":"ai_unavailable","detail":"llm_failed:LlmConfigError"}`로 접었고 호출 1회, 예외 문장("boom secret")은 결과에 없음 (고정 코드).
- `load.ts`는 `server-only`라 tsx 탐침에서 직접 부르지 못했다. 단위 테스트(가짜 `getLlm`)와 코드 읽기로 대신했다.

## 9. 구현 보고서 대조
- 주장한 숫자(1607 / 155 / 40개 / 경로)는 모두 사실이다. 보고서 5번째 항목 "원인 두 줄 모두 Code decides" 등 위 항목도 사실.
- 보고서 맨 끝 "컨트롤 타워에 요청할 결정: 없음"과 같은 문서의 "새 파일 두 개 위치만 승인 바람"이 서로 어긋난다 (기록만).
- 4가지 요청: (1) 새 파일 2개 위치: 위 판단대로 승인 가능. (2) 안 쓰는 `.compare*`: `globals.css` 392·412줄 등에 남아 있고 `src`에서 참조 0건 — 사실. 지우는 것은 T047 파일 수정이므로 컨트롤 타워가 정한다. (3) `globalThis.React`: 사실이며 테스트 파일 안에서만. (4) `loadCaseDraft` 2부 재사용: `export const loadCaseDraft = cache(...)` 로 존재, `buyerFirstName`·`sellerName` 없이 부르는 것도 사실 (2부가 정함).

## 발견한 문제
- 병합 차단: 없음.
- 병합 후 수정: 없음.
- 기록만:
  1. 브랜치가 최신 main보다 뒤에 있다 (SPEC 첫 줄이 v2.7, main은 v2.8). main 쪽 차이는 `CLAUDE.md`·`DECISIONS.md`·`SPEC.md`·`reports/STATUS.md`·`tests/acceptance/ac13…`·`tests/sandbox/*`뿐이고 `src/app`·문구·단위 테스트와 겹치는 파일은 없다. 병합 때 충돌 가능성은 낮다.
  2. 구현 보고서의 SPEC 기준 표기가 v2.7이다 (지시서는 v2.8 기준 검증 요청).
  3. `globals.css`의 옛 `.compare*` 규칙이 죽은 코드로 남음.
  4. `.cc-previous`에 `tabular-nums` 중복 선언(공용 `num` 클래스와 함께).
  5. 실제 LLM 키가 있을 때 페이지 요청마다 `draftReply`가 1회 실제 호출된다 (`force-dynamic`). 시연 중 새로고침마다 호출 비용이 든다는 점을 컨트롤 타워가 알아 둘 것.

## 확인하지 못한 것
- 화면 모양 전체 (배치, 비교 카드 폭/중앙 정렬, 1440/390 밝은·어두운, 대비). 스크린샷은 컨트롤 타워.
- 실제 D2 데이터로 렌더 (`.env` 없음): 실제 `statusCode`, 실제 구매자 글 모양, 실제 `draftReply` 영어.
- `load.ts`의 `loadCase`/`loadCaseDraft` 실행 (`server-only`) — 단위 테스트의 가짜 입력 범위까지만.
- `Conversation` 토글의 클릭 동작 (브라우저 상호작용 시험 도구 없음).
