# design-diff — 시안 ↔ 앱 자동 비교 (DECISIONS 2026-11-12 20:45)

"구현함"이라는 자기 체크 대신 이 도구 결과를 근거로 쓴다. 다음 시안에도 그대로 쓴다.

## 준비 (한 번)

```bash
npm i -D pixelmatch pngjs playwright-core   # T123 세션은 설치 권한이 없어 동적 import로만 연결해 두었다
```

- 브라우저: 기본은 설치된 Chrome(`--channel chrome`). 다른 Chromium은 `--chrome <실행 파일>`.
- 시안 런타임: 시안 폴더에 `vendor/react.js`, `vendor/react-dom.js`(react@18.3.1 UMD)가 있어야 한다.
  저장소의 `react`는 19라 UMD가 없다. 없으면 `--vendor <폴더>`로 준다
  (`react.development.js`·`react.production.min.js`·`react-dom.*` 이름도 알아본다). 도구는 자동으로 내려받지 않는다.
- 시안은 저장소 밖 임시 폴더로 복사해 로컬 정적 서버로 연다 (원본은 건드리지 않는다).

## 실행

```bash
# 상태 목록만 (브라우저 없음)
npx tsx scripts/design-diff/run.ts --mock docs/design/mockup-v6 --out reports/design-match/v6/auto --analyze-only

# 전체 비교
npx tsx scripts/design-diff/run.ts --mock docs/design/mockup-v6 --app http://localhost:3000/ \
  --out reports/design-match/v6/auto [--states initial,all-products] [--widths 1440,1920] \
  [--exceptions reports/design-match/v6/exceptions.json] [--vendor <react UMD 폴더>]
```

| 인자 | 뜻 |
|---|---|
| `--mock <dir>` | 시안 폴더. 첫 `*.dc.html`을 연다 (`--entry`로 바꿈) |
| `--app <url>` | 앱 시작 URL. 상태별 `appPath`가 있으면 그 뒤에 붙인다 |
| `--out <dir>` | 결과 폴더 |
| `--app-ready <css>` | (기본 없음) 앱 페이지를 연 뒤 이 요소가 보일 때까지 기다린다(최대 20초). Next `loading.tsx` 뼈대 화면 뒤 본 화면에서 시작하려고 쓴다. 예: `--app-ready '[role=switch]'` 또는 `--app-ready '.zone-work'`. 시안 쪽에는 안 쓴다 |
| `--states a,b` | 이 상태만 |
| `--widths 1440,1920` | 폭. 높이는 1440→1000, 1920→1080 |
| `--states-file` | 상태 파일 (기본 `<out>/states.json`) |
| `--exceptions` | 예외 파일 (기본 `<out>/exceptions.json`, 없으면 예외 0줄) |
| `--max-depth` `--max-states` | 탐색 깊이(기본 4)·상한(기본 120) |
| `--regen` | `<out>/states.json`을 새로 만든 목록으로 덮어쓴다 (기본은 사람이 고친 파일을 지킨다) |
| `--headed` | 브라우저 창을 띄운다 |
| `--loose-tags` | (기본 꺼짐) key로 짝 못 찾은 요소 중 태그만 다르고 글자가 같은 것(h1~h6 ↔ b/strong/span)을 `tag` 차이 한 줄로 짝짓고 스타일 비교는 계속한다. 꺼져 있으면 예전처럼 시안에만/앱에만 두 줄 |

종료 코드: 0 통과 · 1 설명 없는 차이 있음 · 2 실행 오류.

## 무엇을 하나

1. **상태 목록** (`analyze.ts`, `template.ts`): `<x-dc>` 템플릿을 파싱하고(`sc-for`·`sc-if`·`{{…}}`), logic class를
   `node:vm` 샌드박스(가짜 타이머)에서 돌려 버튼을 하나씩 눌러 본다. state가 달라지면 새 상태.
   정렬·접기처럼 새 버튼이 안 생기는 클릭은 끝 상태로 두고 더 넓히지 않는다. 앞 단계와 상관없는 클릭의 조합은 만들지 않는다.
   → `states.md`(상태표 + 정적 분석: onClick 바인딩·탐색에서 눌렸는지, setState 키, 타이머 식), `states.json`(사람이 고침), `states.generated.json`(매번 새로).
2. **재현** (`browser.ts`): 상태마다·폭마다·쪽마다 새 브라우저 컨텍스트(녹화 켬)에서 페이지를 열고 `document.fonts.ready` 뒤
   같은 순서로 누른다(앱은 `--app-ready` 요소가 보인 뒤). 단계마다 후보가 나올 때까지 최대 10초(0.25초 간격) 다시 찾고, 그래도 없으면 실패다 — 단계의 `waitMs`는 클릭 뒤 기다림이다. 요소 찾기 규칙(`page-scripts.ts` `FIND_TARGET`)은 양쪽 같음: `selector`가 있으면 그것,
   없으면 역할(`role`) + 이름표(`text`: 자기 글자, 없으면 자손 중 처음 나오는 숫자 아닌 자기 글자) + `nth`. `contains: true`면 부분 일치.
3. **비교** → `<out>/<state>/`
   - `styles.md`: 보이는 요소를 `역할|이름표`(같은 것이 여럿이면 `#n`)로 짝지어 color, background, border, border-radius, box-shadow,
     font-family(첫 글꼴), font-size, font-weight, line-height, letter-spacing, padding, margin, gap, width, height, x, y, opacity, transform, cursor 비교.
     허용 오차: 스타일 숫자 0.5px, 위치·크기 1px. 짝이 없는 요소(시안에만/앱에만)도 차이.
     시안 런타임의 `<span class="sc-interp">`(`{{…}}` 값)는 따로 잡지 않고 그 글자를 부모의 자기 글자로 합친다(요소 찾기도 같다).
     화면 읽기 전용 글자(sr-only: `clip-path: inset(50%)` 이상 · `clip: rect(…)` 넓이 0 · 1px 이하 + overflow hidden/clip, 조상 포함)는 보이는 요소로 세지 않는다.
   - `mock-<w>.png`·`app-<w>.png`·`diff-<w>.png`(pixelmatch, 다른 곳 빨강, 크기가 다르면 넓힌 곳은 자홍색 = 차이) + 비율.
   - `motion.md`: 상태를 바꾸는 동안 `document.getAnimations()` 표본(40ms)·transition/animation 이벤트·setTimeout/setInterval 간격.
     시안 타이머 간격(16ms 이상)이 앱에 없으면 차이. 앱에만 있는 타이머는 프레임워크 내부일 수 있어 참고로만 적는다.
   - `mock-<w>.webm`·`app-<w>.webm`: 상태 전환 녹화.
4. **예외 대조** (`compare.ts`): `exceptions.json`(예: `exceptions.example.json`)의 줄마다 `match`의 모든 조건이 맞으면 그 줄 id를 차이에 붙인다.
   조건: `kind`(style·missing·extra·tag·pixel·motion·repro), `state`(`*` 가능), `width`, `role`, `text`(부분 일치, `/정규식/`), `key`, `prop`, `selector`(페이지에서 요소나 조상이 맞는지 본다).
   **판정: 설명 없는 차이 0개, 픽셀은 상태당 ≤0.5%(넘으면 `pixel` 차이가 되어 예외로 원인을 적어야 통과).**
5. **사람용 한 장** `index.html`: 요약표 + 상태별 [시안 | 앱 | 차이] + 녹화 나란히. 상대 경로라 `reports/design-match/v6/`로 통째 복사해도 열린다.
   `summary.json`에 숫자 요약.

## 한계

- 글자 입력(onChange)으로만 가는 상태는 자동 탐색하지 않는다 → `states.json`에 손으로 더한다.
- 앱의 같은 상태로 가는 클릭이 다르면(문구·역할이 다름) `states.json`의 `app` 단계를 고친다.
- 시안 쪽 탐색은 템플릿·logic만 본다. CSS `:hover`처럼 클릭 없는 상태는 대상이 아니다.
