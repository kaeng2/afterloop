# T109 보고 (2026-11-12 10:12)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예 — `# SPEC v2.15 (2026-11-12 00:05 KST)`)
- 브랜치 / 마지막 커밋: lane/ui-desk / (이 보고서를 넣은 커밋. 직전 HEAD 7ee3bbf)
- 모델: claude-opus-5-5

## 결과
완료 — `/listing` 전용 CSS를 시안 `docs/design/mockup-v4/scene3/Main.dc.html` 기준으로 새로 썼다. 화면 전체(껍데기·편집·결과판·점검 모달·완료)가 대상이고, 남겨 둔 구역은 없다.
- ① 시안 L15–L62 `<style>` 규칙 49개를 모두 그대로 옮겼다 (값·선택자·keyframes 이름 그대로, 범위를 묶으려고 `.ls `만 앞에 붙였다).
- ② 화면 루트 `.ls` = 시안 L64 값.
- ③ 시안 인라인 style과 `{{…St}}` 값은 그 요소의 `ls-*` class 규칙으로 옮겼다 (줄 주석 = 시안 줄 번호).
- 동작(reducer·서버 액션·진행·Simulated·시험)은 바꾸지 않았다. 엔진·문구·config도 그대로이고, `_server/*`, `globals.css`, copy·motion json 모두 무변경이다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/listing/listing.css` | 1511줄 → 약 295줄. 첫 줄은 `/* @mockup-copy docs/design/mockup-v4/scene3/Main.dc.html */`. ① 시안 `<style>` 그대로 ② 루트 ③ 인라인 값 ④ 예외 ⑤ 좁은 화면·움직임 줄이기. `--ls-*` 변수는 없앴다 |
| `src/app/listing/listing-view.tsx` | class 이름만 시안 것으로 바꿨다 (`ls-btn ls-b-black`→`btn b-black`, `ls-card`→`card`, `ls-fld`→`fld`, `ls-lab`→`lab`, `ls-ph`→`ph`, `ls-addph`→`addph`, `ls-snav`→`snav`, `ls-sheet`→`sheet`, `ls-rise`→`rise`, `ls-flA`→`flA`, `ls-tipw/q/b`→`tipw/tipq/tipb`, `ls-ai`→`ai`, `ls-chip`→`chip`, `ls-ins`→`ins`, `ls-apib`→`apib`, `ls-livedot`→`livedot`, `ls-spin`→`spin`, 아이콘 `pulse`). 여러 곳에 같이 쓰던 `ls-group-tight`·`ls-sub`는 시안 요소마다 다른 값이라 요소별 class로 나눴다. 요소 구조·data 속성·핸들러는 같다 |
| `tests/unit/app-t109-listing-css.test.ts` (새 파일) | ① 시안 `<style>` 규칙이 하나도 빠짐없이 같은 값으로 있고 줄 주석이 있다 ② 루트 = 시안 L64 값이고 globals body 값을 끊는다 ③ 모든 선택자가 `.ls` 범위 안이고, CSS를 import하는 곳은 listing-screen.tsx 하나다 ④ 화면이 시안 class를 쓰고, 화면 코드에 색 값이 없다 |
| `tests/unit/app-t098a-scenes.test.ts` | Scene 3 정적 기대값을 바꿨다. 같은 시안 줄을 보되, 옛 기대(변수 이름 `--ls-black` 등)를 시안 값(`#000000` 등)으로 바꿨다. 마크업 class 기대도 `ls-addph`→`addph`, `ls-snav`→`snav`로 바꿨다 (이유: 지시서 규칙 4) |
| `tests/unit/app-t087-listing.test.ts` | 정적 2곳: pulse keyframes를 시안 이름·값 `pl`로, 진행 막대 transition을 시안 L522 시트 막대로, 메뉴 class를 `snav`로. 동작 시험은 무변경 |
| `tests/unit/app-t067.test.ts` | `/listing` 부분: `--ls-accent:` 등 변수 기대 → 같은 색이 시안 규칙 그대로 있는지 (`.ls .b-ai{…}`, flashA, `.ins` 그림자, addph focus, addic 바탕) |
| `tests/unit/app-shared-design.test.ts` | "색은 변수로만"·"그림자는 변수로만" 시험에 `@mockup-copy` 표시 파일 예외를 넣었다. 그런 파일은 대신 **모든 색·rgba·box-shadow 값이 그 시안 파일 안에 있어야** 한다 (지어낸 값 금지 — 더 엄격하다). "T098a 시안 그림자" 표에서 listing 줄을 지웠다 (`--ls-shadow-*` 변수가 없다. 위 시험이 대신 본다) |
| `reports/design-match/inventory.md` | Scene 3 절 머리에 T109 안내 한 단락만 넣었다 (옛 줄 번호·변수 이름은 T109 이전 것이고 대응은 이 보고서가 기준이라는 것). 행은 그대로 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | 15 files |
| npm test (`vitest run tests/unit tests/integration`) | 2556 | 1 | 실패 1건은 `storefront.test.ts > 결정론 > 같은 입력 100회` **5000ms 시간 초과**(흔들리는 시험). 따로 돌리면 `storefront.test.ts` 31/31 통과 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | `/listing` 18.3 kB |

개발 서버·실제 AI·PayPal 호출은 하지 않았고 `.env`도 읽지 않았다. 화면을 눈으로는 확인하지 못했다 (그림 비교는 컨트롤 타워가 한다).

## 시안 class ↔ 앱 요소 대응표 (그림 비교용)
시안 줄 → listing.css 규칙 → listing-view.tsx 요소. CSS 안의 `/* Lnn */` 주석에 같은 번호가 있다.

| 시안 | 시안 class / 인라인 | 앱 class (listing.css) | 앱 요소 |
|---|---|---|---|
| L64 | `.ls` 루트 인라인 | `.ls` | `Shell` 바깥 div |
| L66 | header 인라인 | `.ls-header` | header |
| L67 | 가게 로고·이름 | `.ls-store` `.ls-store-logo` `.ls-store-name` (b·span) | 가게 표시 |
| L68 | 검색 label·input | `.ls-search` `.ls-search input` | 검색창 (readOnly) |
| L69 | SM 아바타 | `.ls-avatar` | 아바타 |
| L71 | 본문 flex | `.ls-body` | 메뉴+본문 |
| L72 | nav 인라인 | `.ls-side` | 왼쪽 메뉴 |
| L32–34·L73 | `.snav` / `.snav.on` | `.ls .snav` (+ `.ls button.snav` 버튼 기본값 지우기) | 메뉴 버튼 6개 + DisputeLess + PayPal payments |
| L74 | Apps 머리 | `.ls-side-h` | "Apps" |
| L75·L117·L167 | 마크 상자 | `.ls-apib-ic` `.ls-mark-line` `.ls-mark-dot` | DisputeLess 마크 |
| L78·L79 | 본문·경로 | `.ls-main` `.ls-crumb` `.ls-crumb-a` `.ls-crumb b` | 경로 줄 |
| L564·L565 | `layoutSt` | `.ls-layout` / `.ls-layout.ls-layout-detail` | 편집 / 상세 두 칸 |
| L51·L85 | `.card` gap 18 | `.ls .card` + `.ls .card.ls-editor` | 편집 카드 |
| L86 | 상세 머리 | `.ls-head` | detailT/detailS |
| L87–L89 | 사진 묶음·격자 | `.ls-photo-block` `.ls-photos` | 사진 줄 |
| L44·L45·L91·L50 | `.ph` img `.phl` | `.ls .ph` `.ls .ph img` `.ls .phl` | 사진 4장 + Your photo |
| L46–49·L93 | `.addph` `.addic` input·글자 | `.ls .addph` `.ls .addic` `.ls .addph input` `.ls-addph-t` `.ls-addph-h` | Add photo |
| L39·L40 | `.lab` `.fld` | `.ls .lab` `.ls .fld` | 모든 칸 이름·입력 |
| L96·L97 | 3칸 격자, label 묶음 | `.ls-grid3` `.ls-group` | 상품명·가격·수량 |
| L101 | 날짜 격자 | `.ls-grid-dates` | 판매 시작·끝 |
| L561 | `peakChipSt` | `.ls-peak` / `.ls-peak.on` | 시즌 칩 |
| L107·L58–60 | 칸 묶음, `flA/flB` | `.ls-field` + `.ls .flA/.flB` | 설명·사이즈·배송·반품 |
| L108·L41·L42 | gap 칩·`.fld.gap` | `.ls-lab-row` `.ls .chip.ls-chip-gap` `.ls .fld.gap` | "Missing" 표시 |
| L111·L52·L53 | `.ins` + 작은 `.ai` | `.ls-ins-row` `.ls .ins` `.ls .ai.ls-ai-sm` | Insert 버튼 |
| L116–119 | 동작 줄, `.apib`, `.btn` | `.ls-actions` `.ls .apib` `.ls .livedot` `.ls .btn.b-tint/.b-black` | Save draft·Publish |
| L126·L127 | aside·머리 | `.ls-panel` `.ls-panel-h` | 결과판 |
| L128 | 카드 gap14 pad18 | `.ls .card.ls-card-risk` | 확률 카드 |
| L129–133 | 위 격자·확률 | `.ls-panel-top` `.ls-prob-col` `.ls-big-row` `.ls-prob-sub` | 확률·Before |
| L537 | `bigSt` | `.ls-big` / `.ls-big.good` | 큰 확률 |
| L135–138·L28–31 | `.tipw` `.tipq` `.tipb` | `.ls .tipw.ls-tipw` `.ls-tip-l` `.ls .tipq` `.ls .tipb` `.ls-loss` | 예상 손실 + i 툴팁 |
| L141–143·L508 | 점 그림 | `.ls-dots-block` `.ls-dots-sm` `.ls-dot` (+ `t-*` 색 L484) `.ls-tiny` | 점 200개 |
| L145–152·L485·L542·L543 | 유형 막대 | `.ls-types` `.ls-type-row` `.ls-sw` `.ls-ellipsis` `.ls-bar` `.ls-bar-ghost` `.ls-bar-fill(.down)` `.ls-num` | 유형 5줄 |
| L156·L544·L545 | 상태 줄 | `.ls-status(.dirty)` `.ls-status-t` | Up to date / Changed |
| L158·L22·L23 | `.btn.b-ai.b-sm` | `.ls .b-ai` `.ls .b-sm` | Recalculate |
| L160·L547 | 진행 막대 | `.ls-prog` `.ls-prog-fill` | 다시 계산 진행 |
| L162–167·L549·L550 | 체크 카드 | `.ls .card.ls-checks` `.ls-check` `.ls-check-ic(.on)` `.ls-grow` `.ls-check-s(.on)` `.ls-actions-split` | To reduce disputes + Publish |
| L176 | 흐린 덮개 | `.ls-scrim` | 덮개 |
| L54·L55 | `.sheet` `up` | `.ls .sheet` | 점검 모달 |
| L178·L179 | 손잡이·kicker | `.ls-grab` `.ls-kicker` | 모달 머리 |
| L181–185·L24–27 | 회전 고리 `.spin` 아이콘 `.pulse` | `.ls-an` `.ls-spin-wrap` `.ls .spin` `.ls-spin-track` `.ls-spin-arc` `.ls-spg-a/b` `.ls .pulse.ls-pulse-ic` `.ls-pulse-line/dot` | 분석 중 |
| L186–189·L521 | 글·단계 | `.ls-an-col` `.ls-an-t` `.ls-an-s` `.ls-steps` `.ls-step(.done/.now)` | 단계 4개 (앱은 `<ol>`) |
| L192–195·L522·L523 | 칸·진행·글 | `.ls-run` `.ls-cells` `.ls-cell(.on)` `.ls-run .ls-prog-fill` `.ls-run-t` | 500회 진행 |
| L199·L56·L57 | `.rise` 결과 | `.ls .rise.ls-result` `.ls-res-t` | 결과 |
| L201·L202·L518 | 기준 4칸 | `.ls-basis` `.ls-basis-cell` `.ls-basis-k` `.ls .chip.ls-chip-peak` | 분석 기준 |
| L204–213 | 주인공 확률·점·범례 | `.ls-hero` `.ls-hero-l` `.ls-hero-n` `.ls-hero-sub` `.ls-hero-r` `.ls-dots-md` `.ls-legend` | 확률 + 점 |
| L216–224·L529 | 상위 3 유형 | `.ls-top-block` `.ls-top` `.ls-top-card` `.ls-top-h` `.ls-rank` `.ls-top-n` `.ls-top-of` `.ls-top-why` | 유형 카드 3개 |
| L229–231 | 블프 배송 | `.ls-bf` `.ls-bf svg` `.ls-bf-col` | 블프 안내 |
| L234–245 | 고칠 점·손실 상자 | `.ls-split` `.ls-fix-col` `.ls-fix` `.ls-fix-plus` `.ls-fix-s` `.ls-loss-box` `.ls-loss-row` `.ls-loss-how` `.ls-loss-tip` | 고칠 점 + 손실 |
| L247–249 | 모달 버튼 | `.ls-sheet-actions` `.ls .btn.b-tint` `.ls .btn.b-ai` | Publish anyway / See details |
| L258–268·L555 | 완료 | `.ls-done-wrap` `.ls .card.rise.ls-done` `.ls-done-ic` `.ls-done-t` `.ls-done-s` `.ls-done-box` `.ls-done-prob(.good)` `.ls-done-disp` `.ls-done-note` `.ls-done-actions` | 완료 카드 |
| L16 | `body{margin:0}` | `body:has(.ls){margin:0}` | (globals도 이미 0) |
| L61 | `.ko` | `.ls .ko` 그대로 + `.ls:lang(ko)` | 한국어 글꼴 |

## 예외로 남긴 곳 (시안과 다르게 둔 것)
| # | 자리 | 시안 | 앱 | 근거 |
|---|---|---|---|---|
| E1 | 글꼴 이름 (L64·L61) | `Figtree, 'Noto Sans KR'` 이름 | `var(--font-figtree), var(--font-noto-kr)` (같은 두 글꼴) | next/font가 글꼴 이름을 바꿔 싣는다. 이름 그대로면 글꼴이 안 걸린다 (T067 글꼴 결정). `.ls .ko` 규칙 원문은 남겼다 |
| E2 | 맨 위 띠 `.ls-band` | 없음 | 검은 띠 (Simulated / 데모 가게 표시) | v2.15 이후 결정 "Simulated 표시". 색은 시안 값 (#0B0F14·#FFFFFF) |
| E3 | AI 고친 글 `.ls-inserted` `.ls-blank` `.ls-note` | 없음 (넣으면 칸 글이 바로 바뀜) | "AI suggests" 배지 + 약속 없는 글 + `[__]` 자리표시자 | 약속 금지·AI 정직성 결정. `[__]` 바탕은 옛 노랑 `#FFF1B8` 대신 시안 L108 Missing 칩 바탕 `#FBE7E4` (시안에 없는 색을 쓰지 않으려고) |
| E4 | Assumption·Demo data 배지, 데이터 줄 `.ls-panel-data` | 없음 | 숫자 옆 배지 | 사람 결정 11/12 "Keep as is" |
| E5 | 손실 범위 줄 `.ls-range` | 없음 | 엔진 p10–p90 범위 (L133 보조 글 값 13px #6C7378) | 엔진 값 정직성 (T087 이후) |
| E6 | 좁은 화면 `@media` | 시안은 1440 폭 한 장 | 1100·900·640px 규칙 (예전과 같은 구조) | 휴대폰 폭 규칙 (앱 규칙). 값은 시안 값만 사용 |
| E7 | 마크 선색 `.ls-mark-line` | `#00A8EA` | `#60CDFF` | inventory 예외 행 그대로 (DECISIONS 11/11 22:55 "PayPal 로고 없음", T098 규칙 2) |
| E8 | 메뉴 `.snav` | `<a href="#">` | `<button aria-disabled>` (버튼 기본 모양만 지움) | 고정 데모 껍데기 (T087). 값은 L32–34 그대로 |
| E9 | "PayPal payments" 메뉴 | P 아이콘 상자 (L76) | 글자만 | T087 규칙 3 |
| E10 | 확률 차이 칩 (L132 `p.hasDelta`) | "−x pts" 칩 | 그리지 않음 (대신 Before x%) | inventory 예외 행 (계산은 엔진에서만) |
| E11 | Insert 버튼 글 | 고칠 점 이름만 | "Insert: …" / "… · Added ✓" | T106 결정 그대로 (동작 무변경) |
| E12 | 숫자·문구 | 시안 하드코딩 (Knot & Co., $89, 8 수수료 등) | 엔진(SPEC 8-3)·config 값 (Fernwood Knits, 수수료 $15 등) | 지시서 "데이터 자리만 바꿔 끼운다" |
| E13 | 진행 단계 목록 | span 묶음 | `<ol>` (list-style none, 값 L189·L521 그대로) | 접근성 (예전과 같음) |
| E14 | 움직임 줄이기 | 없음 | `.ls *` 움직임 끔 | T094 |

## 남은 문제
- **keyframes 이름이 전역이다**: `spin`, `pl`, `up`, `rise`, `flashA`, `flashB`를 시안 그대로 두었다 (규칙 1). 지금 src/app 안에는 같은 이름이 없다. 하지만 T107·T108이 다른 시안의 같은 이름(`rise` 등)을 다른 값으로 복사하면 화면을 오갈 때 나중에 불러온 쪽 값이 이긴다. 병합할 때 `@keyframes` 이름이 겹치는지 확인해야 한다.
- **범위 없는 시안 class가 새어 들어올 수 있다**: /listing의 시안 class(`.btn` `.card` `.chip` `.ai` …)는 모두 `.ls ` 아래에만 있다. 다른 화면 CSS가 같은 이름을 범위 없이 정의하면, 우리가 정하지 않은 속성(예: `transition`)이 /listing 안에도 걸린다. globals `.card`는 확인했다 (모든 속성을 `.ls .card`가 덮는다).
- `tests/unit/app-shared-design.test.ts`의 `@mockup-copy` 예외는 T107·T108도 같은 방식으로 쓸 수 있게 일반 규칙으로 만들었다. 다른 레인도 같은 시험을 고치면 병합 때 충돌할 수 있다.
- 실제 화면(픽셀)은 확인하지 못했다 (개발 서버 금지).

## 컨트롤 타워에 요청할 결정
- 없음. 다만 위 "keyframes 이름 전역" 문제는 T107·T108 병합 때 확인이 필요하다.
