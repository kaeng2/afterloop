# T123 보고 (2026-11-12 20:42)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ops / (이 보고와 같은 커밋 — `git log -1 lane/ops`)

## 결과
일부 완료. 지시서 1–6은 모두 코드로 들어갔고, 브라우저 없이 돌 수 있는 부분(정적 분석·상태 탐색·짝짓기·예외 대조·md/html 생성)은 단위 시험으로 확인했다. **`npm install`은 이 세션에서 승인을 받지 못해 실행하지 못했다.** 그래서 `pixelmatch`·`pngjs`·`playwright-core`는 실행할 때 동적 import로만 불러오고(설치 전에도 tsc는 통과), `package.json`은 고치지 않았다. 실제 브라우저 실행은 하지 않았다 (지시서대로 컨트롤 타워가 한다).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `scripts/design-diff/template.ts` | `<x-dc>` 템플릿 파서·렌더러 (`sc-for`·`sc-if`·`{{경로}}`), 클릭 가능한 요소 목록, 역할·이름표 규칙, 정적 바인딩 목록 |
| `scripts/design-diff/analyze.ts` | 시안 HTML에서 템플릿·logic 뽑기. 정적 분석(onClick 바인딩, setState 키, setTimeout/setInterval/later 간격 식). logic class를 `node:vm`에서 가짜 타이머로 돌려 버튼을 눌러 보며 넓이 우선으로 상태 탐색 → 이름·클릭 순서·대기 시간·타이머·바뀐 키 |
| `scripts/design-diff/page-scripts.ts` | 브라우저 안 코드(문자열): 단계 찾기(`FIND_TARGET`), 계산된 스타일 캡처(`CAPTURE`), 모션 훅(`HOOKS`: 타이머 간격, transition/animation 이벤트, `getAnimations()` 40ms 표본) |
| `scripts/design-diff/browser.ts` | playwright-core 동적 로드, 상태·폭·쪽마다 녹화 컨텍스트로 재현 → png·webm·스타일·모션 |
| `scripts/design-diff/compare.ts` | 스타일 비교(허용 오차 0.5px / 위치·크기 1px), 모션 비교, 픽셀 0.5% 판정, `exceptions.json` 대조, 판정 |
| `scripts/design-diff/pixel.ts` | pixelmatch·pngjs 동적 로드, 크기가 다르면 자홍색으로 채워 비교, `diff.png`(빨강) |
| `scripts/design-diff/server.ts` | 시안을 저장소 밖 임시 폴더로 복사 + vendor react UMD 갖추기 + 로컬 정적 서버 |
| `scripts/design-diff/report.ts` | `states.md`·`styles.md`·`motion.md`·`index.html`(상대 경로만) |
| `scripts/design-diff/args.ts`, `run.ts` | CLI (`--mock --app --out [--states] [--widths]` 외, `--analyze-only` 포함) |
| `scripts/design-diff/README.md` | 사용법·동작·한계 |
| `scripts/design-diff/exceptions.example.json` | 예외 파일 예 |
| `tests/unit/design-diff.test.ts` | 단위 시험 20개 |

### 결과물 구조 (`--out <dir>`)
- `states.md`, `states.json`(사람이 고침, 있으면 덮어쓰지 않음 — `--regen`), `states.generated.json`
- `<state>/mock-<폭>.png`·`app-<폭>.png`·`diff-<폭>.png`·`mock-<폭>.webm`·`app-<폭>.webm`·`styles.md`·`motion.md`
  (지시서의 `out/<state>/` 아래에 폭 두 개를 파일 이름 접미사로 나눴다)
- `index.html`, `summary.json`. 종료 코드: 0 통과 / 1 설명 없는 차이 있음 / 2 실행 오류

### mockup v6에 돌린 결과 (`--analyze-only`, 브라우저 없음)
- 상태 66개 (깊이 4, 상한 120에 안 걸림). 예: `initial`, `all-products`, 상품 4개, `show-history`, `respond-now`(AI 초안 타이핑 interval 32ms, 끝까지 7.6초), `respond-now__send`(단계 타이머 1700/3000/4300/5600/6900ms = `1300 * (k - 1) + 400` + 토스트 3000ms), `respond-now__try-a-rushed-reply__send`(차지백 결과) → `__refund-72-now` / `__replay-this-case`, 표 정렬 14개, 다른 케이스 실행 버튼들.
- 템플릿 onClick 바인딩 21개 모두 탐색에서 한 번 이상 눌렸다. 입력(onChange) 2개는 자동 탐색 대상이 아니다.
- 참고: 지시서의 "타이핑 34ms"와 달리 시안 v6 소스는 `setInterval(…, 32)`이다. 도구는 소스 값(32)을 쓴다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npx vitest run tests/unit/design-diff.test.ts` | 20 | 0 | |
| `npm test` | 2624 | 1 | `storefront.test.ts > 결정론 > 같은 입력 100회` 5초 시간 초과. **내 시험을 빼고 돌려도 똑같이 실패**(2604/1). 혼자 돌리면 통과(4.45초). 원래 있던 문제 |
| `npm run test:acceptance` | 179 (+9 건너뜀) | 3 | 모두 `ac35.repair-offer.test.ts` — v2.16 repair 계약을 엔진이 아직 안 따름 (T120 범위) |
| `npx tsc --noEmit` | — | 7개 | `scripts/`·`tests/` 오류 0. 남은 것: `src/app/cases/model.ts`·`reply/load.ts`·`view/load.ts`의 repair 계약 오류 4개(지시서대로 보고만), 오래된 `.next/types/validator.ts` 3개(없는 페이지 참조, 빌드 산출물) |
| `npm run lint` | — | 0 오류 | 경고 2개는 원래 있던 `app-t098a-scenes.test.ts` |

## 남은 문제
- **devDependency 설치를 못 했다.** 실행 전에 `npm i -D pixelmatch pngjs playwright-core`가 필요하다 (`package.json`·`package-lock.json` 변경). 지시서는 `pixelmatch`·`pngjs`만 허용했는데, Playwright 도구도 실행하려면 `playwright-core`가 필요하다 — 아래 결정 요청 참고.
- **react@18.3.1 UMD가 저장소에 없다.** `docs/design/mockup-v6/`에 `vendor/`가 없고 저장소의 react는 19(UMD 빌드 없음)다. 도구는 시안 안 `vendor/` → `--vendor <폴더>` → `node_modules/react{,-dom}/umd` 순서로 찾고, 없으면 멈추며 안내한다. 자동으로 내려받지는 않는다.
- 브라우저 쪽 코드(`browser.ts`, `page-scripts.ts`, `pixel.ts`, `server.ts`의 서버 부분)는 실제로 돌려 보지 않았다. 처음 실행할 때 다음을 확인해 달라: Chrome 채널로 실행되는지, 시안이 `document.fonts.ready` 뒤 그려지는지, 앱 쪽 단계가 같은 글자·역할로 찾아지는지(안 되면 `states.json`의 `app` 단계를 고친다).
- 앱 쪽 시작 경로: 상태마다 `appPath`를 쓸 수 있지만 자동 생성은 비워 둔다(모두 `--app` URL에서 시작).
- 글자 입력으로만 가는 상태(예: 직접 타이핑한 답장)는 자동 목록에 없다 → `states.json`에 손으로 더한다.
- 상태 수 66 × 폭 2 × 양쪽 = 264번 페이지를 연다. 오래 걸리면 `--states`로 나눠 돌린다.

## 컨트롤 타워에 요청할 결정
- `playwright-core` devDependency 추가 승인 (지시서 허용 목록은 `pixelmatch`·`pngjs`뿐, 그런데 도구 자체가 "Node(playwright-core)"로 지정됨). 승인되면 세 개를 한 번에 설치하면 된다.
- react@18.3.1 UMD 파일(`react.js`, `react-dom.js`)을 어디서 가져올지: 시안 원본 내보내기의 `vendor/`를 받아 저장소 밖에 두고 `--vendor`로 줄지, 저장소에 넣을지.

## 후속 (앱 로딩 뼈대 대응)
- 문제: 앱은 처음에 Next `loading.tsx` 뼈대 화면이 보이고 데이터가 오면 본 화면으로 바뀐다. 기존 도구는 `document.fonts.ready` 직후 첫 단계를 찾아 "1번째 단계를 못 찾음 (switch Respond now, 후보 0개)"로 재현에 실패했다.
- 고침:
  1. `--app-ready <css selector>` 인자 추가(기본 없음). 앱 페이지를 연 뒤 그 요소가 보일 때까지 기다린다(최대 20초, 못 보이면 `repro` 차이로 "--app-ready 요소가 20초 안에 안 보임"). 시안 쪽에는 적용하지 않는다.
  2. 각 단계 찾기를 `retryFind`로 감쌌다: 후보가 나올 때까지 0.25초 간격으로 최대 10초 다시 찾는다. `waitMs`는 여전히 클릭 뒤 기다림.
  3. README에 `--app-ready` 설명과 예(`'[role=switch]'`, `'.zone-work'`) 추가.
- 수정 파일: `scripts/design-diff/{args,browser,run}.ts`, `README.md`, `tests/unit/design-diff.test.ts`(parseArgs 3줄 + retryFind 3건).
- 확인: `npx vitest run tests/unit/design-diff.test.ts`, `npx tsc --noEmit`(scripts/·tests/ 오류 0), `npm run lint`(오류 0). 실제 브라우저·개발 서버는 쓰지 않았다(지시) — 실물 재현은 컨트롤 타워/브라우저 쪽에서 `--app-ready`를 주고 확인해 달라.

## 후속 2 (앱 switch "Respond now" 후보 0개)
- **재현 결과(정직하게)**: 가짜 DOM 단위 시험(`tests/unit/design-diff-find.test.ts`)에서 기존 `FIND_TARGET`의 역할·이름표 계산은 앱 모양(`<button role=switch><span aria-hidden>AI</span>Respond now<span aria-hidden>…`)과 시안 모양 양쪽에서 똑같이 `Respond now`를 돌려준다. 즉 **역할·이름표 계산 자체의 차이는 찾지 못했다.** 실제 브라우저는 쓰지 않았다(지시).
- **가장 유력한 원인(추정)**: `--app-ready '[role=switch]'`는 상단바의 비활성 Autopilot 스위치(`src/app/_shared/autopilot-toggle.tsx`, 항상 보임)로 즉시 만족된다. 실제 "Respond now" 스위치는 `.work-head` 안에 있어 케이스 데이터가 온 뒤에야 나타나므로, 첫 컴파일이 느린 개발 서버에서는 10초 재시도를 넘길 수 있다. → `--app-ready '.work-head .tg'`를 권한다. (실패 스크린샷에 스위치가 이미 켜진 채인 것은 설명되지 않음 — 실물 확인 필요.)
- **고친 것(방어적)**:
  1. 이름표 비교 후보를 셋으로: 자기 글자(기존) · `aria-label` · `aria-hidden` 아닌 자손 글자 전부. NBSP·0폭 글자(U+200B–D, FEFF)는 정리.
  2. 못 찾으면 에러에 "같은 역할 요소: ["", "Respond now (안 보임)"]"처럼 이름표와 보임 여부를 덧붙인다.
  3. 짝짓기 key(CAPTURE)는 건드리지 않았다.
- 수정 파일: `scripts/design-diff/{page-scripts,browser}.ts`, `tests/unit/design-diff-find.test.ts`(신규 6건).
- 확인: `npx vitest run tests/unit/design-diff*.test.ts` 29/29 통과, `npx tsc --noEmit`·eslint에서 scripts/·tests/ 오류 0.
- **요청**: 실물 재실행은 `--app-ready '.work-head .tg'`로. 그래도 실패하면 새 에러 문구의 "같은 역할 요소" 목록을 보내 달라.

## 후속 3 (sc-interp span · sr-only 글자 · 태그만 다른 요소)
- 근거: `reports/T124c-impl.md` '도구 문제' A·B (main). 이 세션은 그 파일 읽기 권한이 없어 **지시문의 요약**을 근거로 했다.
- **(A) 시안 `<span class="sc-interp">`**: `page-scripts.ts` 공통 `__ddOwn`(자기 글자)이 직계 `span.sc-interp`의 글자를 문서 순서대로 합친다. CAPTURE는 `span.sc-interp` 자체를 건너뛴다. → 시안 `<h2><span class=sc-interp>Case history</span></h2>`가 앱 `<h2>Case history</h2>`와 같은 key `heading|Case history`가 된다. 같은 함수를 쓰는 FIND_TARGET 이름표도 같이 맞춰진다(앱 쪽은 sc-interp가 없어 영향 없음).
- **(B) 화면 읽기 전용 글자**: CAPTURE에서 자기 또는 조상이 sr-only면 세지 않는다 — `clip-path: inset(≥50%)` · `clip: rect(…)` 넓이 0 · 너비·높이 1px 이하 + overflow hidden/clip. 조상 판정은 한 번 캡처 안에서 memo. FIND_TARGET(클릭 대상)에는 적용하지 않았다(숨긴 체크박스 같은 입력을 누르는 단계를 깨지 않으려고).
- **(C) `--loose-tags`(기본 꺼짐)**: key로 짝 못 찾은 것 중 태그가 h1~h6/b/strong/span이고(역할 없음 또는 heading) 글자가 같은 것을 문서 순서로 짝짓는다. 새 차이 종류 `tag` 한 줄(시안 태그 ↔ `앱 태그 (앱 key)`) + 스타일 비교는 계속(key는 시안 쪽). styles.md에 "태그만 다른 요소" 절. 예외 `kind: "tag"`로 설명 가능. 꺼져 있으면 예전과 똑같다.
- 수정 파일: `scripts/design-diff/{page-scripts,compare,types,args,run,report}.ts`, `scripts/design-diff/README.md`, `tests/unit/design-diff-capture.test.ts`(신규 15건: 가짜 DOM으로 CAPTURE·FIND_TARGET 실행, loose 짝짓기, parseArgs).
- 확인: `npx vitest run tests/unit/design-diff` 44/44 통과. `npx tsc --noEmit`은 `.next/types/validator.ts`(오래된 생성물, 이 작업과 무관) 3줄 외 오류 0. eslint(scripts/design-diff, 새 시험) 오류 0. 개발 서버·실제 브라우저·`.env`는 쓰지 않았다(지시).
- 남은 것: 실물 재실행(v6 round2)으로 가짜 차이가 줄었는지는 컨트롤 타워/브라우저 쪽에서 확인해 달라. `--loose-tags`를 기본으로 켤지는 그 결과를 보고 사람이 정한다.

## 후속 4 (투명 감싸개 span, 양쪽 공통)
- 문제: 후속 3의 sc-interp 합치기는 시안 쪽만이었다. 앱(T124a)은 글자를 겉 알약 요소 안의 클래스 없는 안쪽 `<span>`에 넣어서 '시안: 겉 span이 글자 주인' ↔ '앱: 안쪽 맨 span이 글자 주인'으로 짝이 어긋났다 (`span|for PayPal sellers` 배경 rgba(5,55,130,.08) ↔ transparent, `span|2` 배지, `span|Not received · Customs hold` 칩).
- 고침 (`page-scripts.ts` 공통 `__ddBare`/`__ddWrap`): `span`이 자기 상자 스타일이 없고(배경색 투명 · background-image none · 네 변 테두리 두께 0 · padding 0 · margin 0 · display inline · sr-only 아님) 부모의 유일한 요소 자식이며 부모 글자 전체(공백 정리 후)와 같은 글자를 가지면 **투명 감싸개**다. `__ddOwn`이 감싸개 글자를 부모 자기 글자로 합치고, CAPTURE는 감싸개를 건너뛴다. 여러 겹도 차례로 합쳐진다. sc-interp는 이 규칙의 한 경우다(조건 없이 언제나 감싸개, 글자와 섞여도 합친다 — 후속 3 그대로). FIND_TARGET 이름표도 같은 함수를 써서 같이 맞춰진다.
- 감싸개가 아닌 경우(예전처럼 따로 잡음): 안쪽 span에 배경·padding·테두리가 있거나 display가 inline이 아님 · 형제 요소가 있음 · 부모에 다른 글자가 더 있음(`Total: <span>$5</span>`).
- 시험: `tests/unit/design-diff-capture.test.ts`에 5건 추가 (가짜 DOM: 겉 알약>안쪽 맨 span ↔ 겉 알약>sc-interp가 같은 key `span|for PayPal sellers`로 짝지어지고 겉 배경 rgba(5,55,130,0.08)끼리 비교되어 차이 0 · 배지 `2`와 여러 겹 칩 · 스타일 있는 안쪽 span 4종 · 형제/부분 글자 · FIND_TARGET 버튼). `npx vitest run tests/unit/design-diff` 49/49 통과. tsc는 `.next/types` 생성물 외 오류 0, eslint 오류 0. 개발 서버·브라우저·`.env`는 쓰지 않았다.
- 남은 것: 실물 재실행(v6 round2)에서 가짜 차이가 줄었는지는 컨트롤 타워/브라우저 쪽에서 확인해야 한다.

## 후속 5 (flex 부모 안 맨 span도 감싸개)
- 문제: 후속 4의 감싸개 조건이 `display: inline`만 허용해서, 부모가 `display:flex`/`grid`이면 자식 span이 flex item으로 blockify(계산값 `block`)되어 합쳐지지 않았다. 앱 예: `<span class="today-pill chip" style="display:flex;padding:2px 9px;background:#ECEEF0;border-radius:1000px"><span>Not received · Customs hold</span></span>`.
- 고침 (`page-scripts.ts` `__ddBare`): display는 `inline`이거나, 계산값이 `block`이면서 **부모 display가 flex·inline-flex·grid·inline-grid**일 때(blockify된 flex item) 허용. 나머지 조건은 그대로: 자기 상자 스타일 없음(배경 투명·background-image none·테두리 0·padding 0·margin 0), 부모의 유일한 요소 자식, 부모 보이는 글자 전부, sr-only 아님. 부모가 flex/grid가 아닌데 `block`이거나 `inline-block`이면 예전처럼 감싸개가 아니다.
- 시험: `tests/unit/design-diff-capture.test.ts`에 1건 추가 (flex 부모+block 맨 span → key `span|Not received · Customs hold`, 겉 배경 rgb(236,238,240) 유지 · inline-grid 부모 · 일반 block 부모는 감싸개 아님). `npx vitest run tests/unit/design-diff` 50/50, tsc(.next 생성물 제외) 오류 0, eslint 오류 0. 개발 서버·브라우저·`.env` 미사용.

## 후속 6 (안 보이는 테두리·outline 소음 제거)
- 고침 (`scripts/design-diff/compare.ts`): `border-top/right/bottom/left`와 `outline` 값은 비교 전에 `normalizeEdge`로 정리한다. 두께가 0이거나 style이 none/hidden이면 색·스타일과 상관없이 `none`으로 본다. 그래서 `0px none rgb(0,0,0)` ↔ `0px solid rgb(9,9,9)`는 차이가 아니다. 보이는 테두리의 두께·색·스타일 차이는 그대로 잡는다.
- 참고: `outline`은 현재 `STYLE_PROPS`(수집 목록)에 없어서 지금은 수집되지 않는다. 수집 목록에 추가하면 이 정리가 바로 적용된다. 목록은 이번에 건드리지 않았다.
- 시험: `tests/unit/design-diff-edge.test.ts` 신규 3건. `npx vitest run tests/unit/design-diff` 53/53 통과, tsc(.next 생성물 제외) 오류 0, eslint 오류 0. 개발 서버·브라우저·`.env` 미사용.
