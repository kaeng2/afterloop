# 시안 인벤토리 (T097, 자동 생성)

- 만든 시각: 2026-11-12 00:49 KST
- 만든 방법: `npx tsx scripts/design/inventory.ts` (손으로 고른 목록이 아님. 다시 돌려도 채운 칸은 유지)
- 시안 파일 해시 (sha256 앞 12자)와 행 수:
  - `docs/design/mockup-v4/Desk.dc.html` — `ede4e90a474e` — 행 162 (표 1~5: 47/40/13/34/28)
  - `docs/design/mockup-v4/scene1/Scene1.dc.html` — `f9d69355534c` — 행 35 (표 1~5: 25/6/0/3/1)
  - `docs/design/mockup-v4/scene3/Main.dc.html` — `2f1123eb8f2a` — 행 119 (표 1~5: 48/27/13/14/17)
- 행 수 합계: 316
- 칸 설명: **상태** = `구현함` / `예외`. **근거** = 구현 파일·시험, 또는 예외 이유(DECISIONS 11/11 22:55 예외 목록 중 무엇인지). 빈칸이 없어야 끝.
- 파일 순서·행 정렬은 고정이다 (같은 시안 → 같은 출력).
- 색 토큰의 그라디언트는 안쪽 색도 따로 센다. 모션 표에는 hover·focus 규칙과 `setTimeout`·`setInterval`·`this.later(fn, ms)`가 같이 있다.

## docs/design/mockup-v4/Desk.dc.html

### 1. 색 토큰 (47행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `#000000` | 23 | L20 .b-black |  | 구현함 | src/app/globals.css `--color-ink`·`--color-heading` #000000 — 주 버튼 `.reply-button`·`.tracking-button`·`.cprog-btn`·[+ Add] `.reply-lint-button`, 제목·목록 글자. tests/unit/app-t098b.test.ts ③ |
| `#000000A1` | 1 | L27 .nav |  | 예외 | DECISIONS 11/11 22:55 예외 "진입점(탭 없음, /demo/store/new-product·~~/products~~ 주소로만)": (~~/products~~: 11/12 11:15 결정으로 /products 제거 — T114, `/`로 308) 시안 `.nav` 탭 글자색. T096에서 위쪽 막대 탭을 지워 대응하는 요소가 없다 (`src/app/_shared/top-bar.tsx`, 시험 `tests/unit/app-t087-listing.test.ts` T096 진입점) |
| `#001C64` | 1 | L124 <section> |  | 구현함 | src/app/globals.css `--gradient-week` 첫 칸 → `today.css .weekly` (이번 주 카드). tests/unit/app-t067 T089 토큰 값 |
| `#002991` | 23 | L25 .c-blue |  | 구현함 | src/app/globals.css `--color-accent-deep` — 상품 아이콘 선 `shell.css .product-icon path`, Prevent 막대, 고른 상품 칩 테두리, "AI read"·"89% → x" 글자, 머리 알약 글자 `.shell-for`, 토스트 ✓ 글자, Watch 점(T098b sevCol med). 보낸 말풍선 `case-progress.css --cprog-navy`. tests/unit/app-t067 T089 |
| `#003087` | 1 | L101 <stop> |  | 구현함 | T107 (사람 결정 11/12 09:25 시안 CSS 통째 복사): `src/app/(app)/desk.css` 시안 L101 값 그대로 — "Dispute" #0B0F14 · "Less" #0070E0 · 밑줄 linearGradient #003087→#0070E0→#00A8EA (`top-bar.tsx` `#dlg-desk`, Desk에서만 `body:has(.dk)`). 다른 화면 로고는 강조색 그대로. tests/unit/app-t107.test.ts |
| `#0066F5` | 11 | L26 .ai |  | 구현함 | src/app/globals.css `--color-accent` — 곡선 점선·Your draft 점·Send 뒤 단계 점·ping(`case.css .curve-draft/.curve-dot-draft/.curve-ping`), 위험 % low, 반응 막대 기다림, 고른 줄 띠 `--shadow-row-on`(T098b), AI 그라데이션. tests/unit/app-t067 T089 |
| `#0070E0` | 2 | L101 <span> |  | 구현함 | T107 (사람 결정 11/12 09:25 시안 CSS 통째 복사): `src/app/(app)/desk.css` 시안 L101 값 그대로 — "Dispute" #0B0F14 · "Less" #0070E0 · 밑줄 linearGradient #003087→#0070E0→#00A8EA (`top-bar.tsx` `#dlg-desk`, Desk에서만 `body:has(.dk)`). 다른 화면 로고는 강조색 그대로. tests/unit/app-t107.test.ts |
| `#00A8EA` | 1 | L101 <stop> |  | 구현함 | T107 (사람 결정 11/12 09:25 시안 CSS 통째 복사): `src/app/(app)/desk.css` 시안 L101 값 그대로 — "Dispute" #0B0F14 · "Less" #0070E0 · 밑줄 linearGradient #003087→#0070E0→#00A8EA (`top-bar.tsx` `#dlg-desk`, Desk에서만 `body:has(.dk)`). 다른 화면 로고는 강조색 그대로. tests/unit/app-t107.test.ts |
| `#05378214` | 2 | L21 .b-tint |  | 구현함 | T098b src/app/globals.css `--color-tint` → `shell.css .desk-button-tint` (Try a rushed reply·Use AI draft·Clear·Replay = 시안 `.b-tint`), 머리 알약 `.shell-for`. 전에는 #E3F3FF. tests/unit/app-t098b.test.ts ③ |
| `#05378227` | 1 | L21 .b-tint:hover |  | 구현함 | T098b src/app/globals.css `--color-tint-hover` → `shell.css .desk-button-tint:hover` (전에는 #C9E3FF). tests/unit/app-t098b.test.ts ③ |
| `#097FF5` | 3 | L23 .btn:focus-visible,.it:focus-visible,.pf:focus-visible,.npa… |  | 구현함 | T098b src/app/globals.css `--color-focus` — 포커스 규칙(`globals.css` T098b 블록: 버튼·목록 줄·상품 칩·선택지·[+ Add]·Forward), `--shadow-editor-focus`, `.reply-details-toggle:focus-visible`, `case-progress.css --cprog-focus`. 전에는 #0066F5. tests/unit/app-t098b.test.ts ③, tests/unit/app-shared-design.test.ts B-3 |
| `#0A1B3D` | 12 | L49 .nstep |  | 구현함 | src/app/globals.css `--color-navy-ink` — 단계 번호 원 `.desk-step-num`, 라디오·고른 카드 `.choice[data-on]`, 알약 `.reply-editor-pill`, 입력칸 테두리 ok, %p 글자, ✓ 칩 글자 `.reply-chip-good`(T098b), 사건 요약 글자 `.history-summary`(T098b) |
| `#0B0F14` | 1 | L101 <span> |  | 구현함 | T107 (사람 결정 11/12 09:25 시안 CSS 통째 복사): `src/app/(app)/desk.css` 시안 L101 값 그대로 — "Dispute" #0B0F14 · "Less" #0070E0 · 밑줄 linearGradient #003087→#0070E0→#00A8EA (`top-bar.tsx` `#dlg-desk`, Desk에서만 `body:has(.dk)`). 다른 화면 로고는 강조색 그대로. tests/unit/app-t107.test.ts |
| `#0B48C4` | 1 | L124 <section> |  | 구현함 | src/app/globals.css `--gradient-week` 끝 칸 → `today.css .weekly`. tests/unit/app-t067 T089 |
| `#333333` | 1 | L20 .b-black:hover |  | 구현함 | T098b src/app/globals.css `--color-ink-hover` → `reply.css .reply-button:hover:not(:disabled)`, `today.css .tracking-button:hover`, `case-progress.css .cprog-btn:hover` (--cprog-ink-hover). tests/unit/app-t098b.test.ts ③ |
| `#3F4144` | 25 | L25 .c-n |  | 구현함 | src/app/globals.css `--color-text` — 본문·`.case-meta`·목록 상품·기한, `.desk-chip` 회색 칩 글자, 범례, 구매자 점 `.history-dot-buyer`·`.curve-dot-buyer`(T105: 곡선·점줄이 같은 whoCol 규칙 `desk-model.ts toneOf` buyer/bad/sys). tests/unit/app-t067 T089 app-t105 |
| `#60CDFF` | 7 | L26 .ai |  | 구현함 | src/app/globals.css `--color-flash` (flash 시작 색·"+$N just now"·토스트 ✓ 원) + `--gradient-ai` 끝 칸. `case-progress.css --cprog-light` |
| `#6C7378` | 22 | L56 .stph .sub |  | 구현함 | T098b src/app/globals.css `--color-sub` — Desk css(today·case·reply)의 보조 글을 모두 이 색으로 (`.desk-card-sub`·`.desk-step-sub`·묶음 (N)·힌트·구매자 줄·날짜·Her mood now·lint 빈 글·autoTr·`.choice:hover` 테두리). 시안에 없는 #5a5e66(`--color-muted`)은 Desk 화면에서 안 씀. Today 왼쪽 칸도 시안처럼 흰 바탕(`.today-page`). tests/unit/app-t098b.test.ts ③ |
| `#99C2FF` | 1 | L775 ~refund |  | 구현함 | src/app/globals.css `--color-bar-refund` → `reply.css .reaction-seg-refund`·범례 (시안 COL.refund) |
| `#9AA0A6` | 9 | L32 .pf:hover |  | 구현함 | src/app/globals.css `--color-dot-neutral` — `.product-filter-chip:hover` 테두리(`.pf:hover`), 라디오 테두리, 곡선 눈금 글자, sys 점, Low 점(T098b sevCol low), Routine 막대. typing 점·Simulated 점선 `--cprog-dot-color`·`--cprog-dash` |
| `#9E2414` | 7 | L25 .c-bad |  | 구현함 | src/app/globals.css `--color-pill-high-text` — `.desk-chip-bad`·`.today-pill-high`(c-bad), [Remove] 글자 `.reply-lint-button-ghost`, 경고 칩. 대기 줄 '!' `--cprog-act-ink`, 높은 위험 칩 |
| `#C4321F` | 13 | L76 .nic-bad |  | 구현함 | src/app/globals.css `--color-dot-high`·`--color-bar-chargeback` — High 점, Reply needed 막대, 상품 칩 건수 배지, 곡선 선, 위험 % high, 차지백 막대·알약 high, lint '!' 원, 기분 나쁨 |
| `#C9E3FF` | 4 | L125 <span> |  | 구현함 | src/app/globals.css `--color-on-accent-muted` — 이번 주 카드 작은 글 `.weekly-sub`·`.weekly-label`, 보낸 말풍선 아래 글 `--cprog-on-navy-muted` |
| `#CFD3D8` | 9 | L52 .rline |  | 구현함 | src/app/globals.css `--color-line` — 단계 세로 줄 `.desk-rail-line`, 입력칸 빈 글 테두리, Show history 테두리 `.desk-button-outline`(.hbtn), 진행 칸 줄 `--cprog-line` |
| `#E3F3FF` | 5 | L25 .c-blue |  | 구현함 | src/app/globals.css `--color-accent-soft` — 고른 목록 줄 `.today-item[aria-current]`(.it.on), c-blue 칩, 진행 칸 위험 칩 `--cprog-chip-bg` |
| `#E4E6E9` | 20 | L31 .pf |  | 구현함 | src/app/globals.css `--color-border` — 카드·`.sec`·곡선 카드 테두리, 위쪽 막대 아래 선, Details hover 바탕, 반응 막대 바탕, `--shadow-hairline`(T098b ✓ 칩·tsum. T104 F4-36: ✓ 칩은 `.reply-chip`의 회색 바탕에 덮여 있었음 → `.reply-chip.reply-chip-good`로 고침). tests/unit/app-shared-design B-3 |
| `#E8796B` | 2 | L78 .nmini.ghost |  | 구현함 | src/app/globals.css `--color-editor-high` (입력칸 50%↑ 테두리) + T098b `--shadow-ghost` inset 2px → `reply.css .reply-lint-button-ghost` (전에는 2px 테두리). tests/unit/app-t098b.test.ts ③, tests/unit/app-shared-design.test.ts B-3 |
| `#ECEEF0` | 3 | L25 .c-n |  | 구현함 | src/app/globals.css `--color-pill-neutral-bg` — `.desk-chip`·`.today-pill-neutral`(c-n), lint '+' 원 `.reply-lint-icon-missing` |
| `#EEF1F5` | 1 | L43 .zone-buyer |  | 구현함 | T098b src/app/globals.css `--color-zone` #eef1f5 → `case.css .case-conversation` (.zone-buyer). 전에는 #eef0f3. tests/unit/app-t098b.test.ts ③ |
| `#F1EFEA` | 6 | L33 .ptile |  | 구현함 | src/app/globals.css `--color-list-bg` — 상품 아이콘 칸 `shell.css .product-tile`(.ptile), 목록 줄 사이 선, 곡선 눈금 선 `.curve-grid`, 펼친 기록 위 선. 손님 단계 원 `--cprog-buyer-bg` |
| `#F3F5F9` | 1 | L69 .npath.on |  | 구현함 | src/app/globals.css `--color-choice-on` → `case.css .choice[data-on='true']` (.npath.on) |
| `#F5F7FB` | 1 | L39 .it:hover |  | 구현함 | T098b src/app/globals.css `--color-row-hover` → `today.css .today-item:hover` (.it:hover). 전에는 #F6F7F9. tests/unit/app-t098b.test.ts ③ |
| `#F5F9FF` | 3 | L32 .pf.on |  | 구현함 | src/app/globals.css `--color-accent-pale` — 고른 상품 칩 `.product-filter-chip[aria-current]`(.pf.on), 사건 요약 줄 `.history-summary`(T098b, 전에는 그라데이션). tests/unit/app-t098b.test.ts ③ |
| `#F6F7F9` | 5 | L36 .sech |  | 구현함 | src/app/globals.css `--color-panel` — 상품 거르개 줄, 묶음 머리 `.today-group-head`(.sech), 칩 받침 `.reply-tray`, 예상 반응 `.reaction`, "will see (Korean)" `.reply-box` |
| `#FBE7E4` | 5 | L25 .c-bad |  | 구현함 | src/app/globals.css `--color-pill-high-bg` — c-bad 알약, 대기 줄 '!' `--cprog-act-bg`, 높은 위험 칩 `.cprog-chip-high` |
| `#FFFFFF` | 45 | L20 .b-black |  | 구현함 | src/app/globals.css `--color-surface`·`--color-on-accent` — 카드·말풍선·입력칸 바탕, 짙은 바탕 위 글자, `--shadow-focus` 흰 띠. T098b: Today 바탕 흰색(`today.css .today-page`, 시안 `.dk`) |
| `linear-gradient(120deg,#002991 0%,#0066F5 55%,#60CDFF 100%)` | 1 | L26 .ai |  | 구현함 | T098b src/app/globals.css `--gradient-ai` = 시안 `.ai` 값 그대로 (전에는 60% 칸) → `.ai-pill`·"Best" `.choice-best-tag`. tests/unit/app-t067 T089 |
| `linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF)` | 2 | L805 ~color |  | 예외 | DECISIONS 11/11 22:55 Send 이후: "Auto" 단계 없음 → [Forward to carrier]. 이 그라데이션은 시안 stepRows의 st.auto 아이콘('A')과 cbDone "Refunded $72" 줄(환불 실행 — 안전장치·약속 예외)에만 쓰인다. tests/unit/app-t092 |
| `linear-gradient(120deg,#E3F3FF,#F5F9FF)` | 1 | L851 ~resKey |  | 예외 | DECISIONS 11/11 22:55 데이터: 결과 상자(resBg) 없음 — 표 4 `sc-if resOn`·표 5 `resBg` 행과 같은 이유 |
| `linear-gradient(150deg,#001C64 0%,#002991 55%,#0B48C4 100%)` | 1 | L124 <section> |  | 구현함 | src/app/globals.css `--gradient-week` → `today.css .weekly`. tests/unit/app-t067 T089 |
| `linear-gradient(90deg,#002991,#0066F5,#60CDFF)` | 1 | L48 .zone-work::before |  | 구현함 | T098b src/app/globals.css `--gradient-ai-line` = 시안 값 그대로 (전에는 60% 칸) → `case.css .work::before`·`reply.css .offer-card::before`. tests/unit/app-t067 T089 |
| `rgba(0,0,0,0.05)` | 2 | L44 .bub-in |  | 구현함 | T098b src/app/globals.css `--shadow-bubble` → `case.css .case-bubble`·`case-progress.css .cprog-typing` (.bub-in, 전에는 1px 테두리) + `--shadow-work` 둘째 겹. tests/unit/app-t098b.test.ts ③, tests/unit/app-shared-design.test.ts B-3 |
| `rgba(0,0,0,0.25)` | 1 | L92 .toast |  | 구현함 | T098b src/app/globals.css `--shadow-toast` (시안 값 그대로) → `today.css .savings-toast`·`case-progress.css .cprog-toast`. T067 "그림자 하나" 규칙(T047 B-3)은 22:55 결정으로 "시안 그림자 목록"으로 바뀜 — tests/unit/app-shared-design.test.ts B-3. 나머지 토스트 값(#000·#60CDFF 원·16px·14px 20px·bottom 28px)은 그대로 |
| `rgba(0,102,245,0.35)` | 1 | L26 .ai |  | 구현함 | T098b src/app/globals.css `--shadow-ai` → `case.css .work-head > .ai-pill`·`case-progress.css .cprog-top > .ai-pill`·`reply.css .offer-card > .ai-pill` (시안에서 box-shadow:none이 아닌 .ai 자리만). tests/unit/app-t098b.test.ts ③ |
| `rgba(0,41,145,0.10)` | 1 | L47 .zone-work |  | 구현함 | T098b src/app/globals.css `--shadow-work` → `case.css .work`·`reply.css .offer-card` (.zone-work 두 겹, 전에는 --shadow-selected). tests/unit/app-t098b.test.ts ③, tests/unit/app-shared-design.test.ts B-3 |
| `rgba(196,50,31,0.08)` | 1 | L179 <polygon> |  | 구현함 | T098b src/app/globals.css `--color-curve-area` → `case.css .curve-area` (전에는 #FBE7E4 × opacity .6). tests/unit/app-t098b.test.ts ③ |
| `rgba(255,255,255,0.08)` | 1 | L128 div.{{d.cls}} |  | 구현함 | T098b src/app/globals.css `--color-on-accent-cell` → `today.css .weekly-cell` (전에는 color-mix 10%). tests/unit/app-t098b.test.ts ③ |

### 2. 모션·타이밍 (hover·focus 포함) (40행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `.b-black:hover` | 1 | L20 | background:#333333 | 구현함 | T098b `reply.css .reply-button:hover:not(:disabled)`·`today.css .tracking-button:hover:not(:disabled)` = `--color-ink-hover` #333333, `.cprog-btn:hover`. 같이 `.btn:disabled{opacity:.45}`도 시안 그대로. tests/unit/app-t098b.test.ts ③ |
| `.b-tint:hover` | 1 | L21 | background:#05378227 | 구현함 | T098b `shell.css .desk-button-tint:hover` = `--color-tint-hover` #05378227. tests/unit/app-t098b.test.ts ③ |
| `.btn:focus-visible,.it:focus-visible,.pf:focus-visible,.npath:focus-visible,.nmini:focus-visible,.ndraft:focus-visible,.hbtn:focus-visible,.nav:focus-visible` | 1 | L23 | box-shadow:#FFFFFF 0 0 0 2px;outline:2px solid #097FF5;outline-offset:2px | 구현함 | T098b `globals.css` 포커스 블록: `.reply-button`·`.tracking-button`·`.desk-button-tint/-outline`(.btn·.hbtn)·`.today-item`(.it)·`.product-filter-chip`(.pf)·`.choice-button`(.npath)·`.reply-lint-button`(.nmini)·`.cprog-btn` = outline 2px solid `--color-focus` #097FF5 + offset 2px + box-shadow `--shadow-focus`(#FFFFFF 0 0 0 2px). .ndraft는 `.reply-textarea`가 `.editor:focus-within` 행으로 대신. `.nav`만 예외 (DECISIONS 22:55 "진입점(탭 없음)", T096). tests/unit/app-t098b.test.ts ③ |
| `.editor:focus-within` | 1 | L59 | box-shadow:#FFFFFF 0 0 0 2px,#097FF5 0 0 0 4px | 구현함 | T098b `reply.css .reply-editor:focus-within` box-shadow `--shadow-editor-focus` = #FFFFFF 0 0 0 2px, #097FF5 0 0 0 4px (시안 값 그대로. T091의 outline 대체를 되돌림). tests/unit/app-shared-design.test.ts B-3 "시안 그림자 자리마다" |
| `.gmore:focus-visible` | 1 | L66 | outline:2px solid #097FF5;outline-offset:2px | 구현함 | T098b `reply.css .reply-details-toggle:focus-visible` outline 2px solid `--color-focus` #097FF5, offset 2px. tests/unit/app-t098b.test.ts ③ |
| `.gmore:hover` | 1 | L65 | background:#E4E6E9 | 구현함 | `reply.css .reply-details-toggle:hover` background `--color-border` #E4E6E9 (T090) |
| `.hbtn:hover` | 1 | L81 | border-color:#000000 | 구현함 | `shell.css .desk-button-outline:hover` border-color `--color-heading` #000000 ([Show history], T090) |
| `.it:hover` | 1 | L39 | background:#F5F7FB | 구현함 | T098b `today.css .today-item:hover` = `--color-row-hover` #F5F7FB. tests/unit/app-t098b.test.ts ③ |
| `.nav:hover` | 1 | L29 | color:#000000 | 예외 | DECISIONS 11/11 22:55 예외 "진입점(탭 없음)": `.nav` 탭 hover. T096에서 탭과 `.shell-tab*` CSS를 지웠다 (`src/app/_shared/shell.css`) |
| `.npath:hover` | 1 | L69 | border-color:#6C7378 | 구현함 | `case.css .choice:not(.choice-blocked):hover` (T090) — T091에서 카드가 버튼(`choice-cards.tsx`) |
| `.pf:hover` | 1 | L32 | border-color:#9AA0A6 | 구현함 | `today.css .product-filter-chip:hover` border-color `--color-dot-neutral` #9AA0A6 (T076) |
| `@keyframes flash` | 1 | L90 | 0%{background:#60CDFF}100%{background:transparent} | 구현함 | T091 `globals.css @keyframes motion-flash` (시작 색 `--color-flash` #60cdff) → `today.css .weekly-cell-flash` · src/app/cases/progress/case-progress.css @keyframes cprog-flash (#60cdff → transparent), "이번 주" 카드 숫자 칸 3개에 붙임 (src/app/cases/progress/case-progress.tsx). tests/unit/app-t092.test.ts |
| `@keyframes ndot` | 1 | L85 | 0%,80%,100%{opacity:.3;transform:none}40%{opacity:1;transform:translateY(-3px)} | 구현함 | src/app/cases/progress/case-progress.css @keyframes cprog-ndot (같은 값). tests/unit/app-t092.test.ts |
| `@keyframes ping` | 1 | L88 | 0%{r:7;opacity:.6}100%{r:20;opacity:0} | 구현함 | `globals.css @keyframes motion-ping` r `--motion-ping-from-r`(7) → `--motion-ping-to-r`(20), opacity .6 → 0 (`config/motion.json desk.ping`, T090) |
| `@keyframes pop` | 1 | L63 | 0%{opacity:0;transform:scale(.7)}100%{opacity:1;transform:none} | 구현함 | T091 `globals.css @keyframes motion-pop` (값 그대로) |
| `@keyframes rise` | 1 | L86 | from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} | 구현함 | T091 `globals.css @keyframes motion-rise` (값 그대로). 알림은 가운데 정렬 transform을 지키려고 `today.css @keyframes motion-toast-rise`(translate(-50%, 8px) → translateX(-50%)) · Send 뒤 칸: src/app/cases/progress/case-progress.css @keyframes cprog-rise (같은 값) — 단계·말풍선. 토스트는 가운데 맞춤을 지키는 cprog-toast-rise(같은 이동 + translateX(-50%)) |
| `animation-delay: ' + (n * 0.12) + 's'` | 1 | L838 ~st |  | 구현함 | T091 `reply-panel.tsx LintTray` style `animationDelay: chipPopDelay(index)` (`motion.json desk.chipPop.staggerS` 0.12), 시험 `app-t091` 모션 |
| `animation-delay: .15s` | 1 | L84 .ndots span:nth-child(2) |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-dots span:nth-child(2) animation-delay: var(--cprog-dot-stagger) = config/motion.json caseProgress.typingDot.stagger 0.15s |
| `animation-delay: .3s` | 1 | L84 .ndots span:nth-child(3) |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-dots span:nth-child(3) calc(var(--cprog-dot-stagger) * 2) = 0.3s |
| `animation: flash 1.6s ease` | 1 | L91 .flash |  | 구현함 | T091 `today.css .weekly-cell-flash { animation: motion-flash var(--motion-flash) }` (`motion.json desk.flash` 1.6s ease), `savings.tsx WeeklyBumpCell` · src/app/cases/progress/case-progress.css .cprog-flash animation: cprog-flash var(--cprog-flash) = config/motion.json caseProgress.flash 1.6s ease. tests/unit/app-t092.test.ts |
| `animation: ndot 1s infinite ease-in-out` | 1 | L84 .ndots span |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-dots span = config/motion.json caseProgress.typingDot 1s ease-in-out infinite. tests/unit/app-t092.test.ts |
| `animation: ping 1.4s ease-out infinite` | 1 | L89 .ping |  | 구현함 | `case.css .curve-ping` animation motion-ping `desk.ping` 1.4s ease-out infinite (T090). T098b: Send 뒤에는 마지막 단계 점에 붙는다 (`risk-curve.tsx` end). tests/unit/app-t098b ① |
| `animation: pop .45s cubic-bezier(.2,1.4,.4,1) both` | 1 | L62 .gchip |  | 구현함 | T091 `reply.css .reply-goods .reply-chip-good` (`--motion-pop` = `motion.json desk.chipPop`) |
| `animation: rise .35s ease` | 1 | L92 .toast |  | 구현함 | T091 `today.css .savings-toast` (`--motion-toast` = `desk.toast.riseDuration` .35s ease) · `case-progress.css .cprog-toast` = `caseProgress.toast` 0.35s ease. 그림자 rgba(0,0,0,.25)도 T098b에서 시안 그대로(`--shadow-toast`). 움직임 줄이기면 애니메이션만 끄고 3초 숨김은 그대로(T098b ②). tests/unit/app-t092, app-t098b ② |
| `animation: rise .35s ease both` | 1 | L87 .rise |  | 구현함 | T091 Show history 펼친 목록 `case.css .history-list:not([hidden])`, Details `reply.css .reply-details:not([hidden])` (`--motion-fold` = `desk.fold`) · Send 뒤 말풍선(bub-out·typing·bub-sim): src/app/cases/progress/case-progress.css .cprog-bubble-wrap = config/motion.json caseProgress.bubble 0.35s ease both |
| `animation: rise .3s ease both` | 1 | L73 .nlint |  | 구현함 | T091 `reply.css .reply-lint` (`--motion-lint-rise` = `desk.lintRise`) |
| `animation: rise .45s cubic-bezier(.2,1.2,.4,1) both` | 1 | L82 .step |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-step = config/motion.json caseProgress.step. tests/unit/app-t092.test.ts |
| `later 1300 * (k - 1) + 400` | 1 | L666 ~ | this.later(() => { | 구현함 | src/app/cases/progress/progress-model.ts stepDelayMs(k) = stepMs·(k−1)+firstStepMs (config/motion.json caseProgress 1300·400). 손님 답장 k=2 → 1700ms, 전달 뒤 세관 통과는 stepMs. 예외(DECISIONS 22:55): k=3 Auto 대신 [Forward to carrier]에서 멈춤. tests/unit/app-t092.test.ts |
| `later 3000` | 1 | L638 ~id | toast(txt) { this.setState({ toast: txt }); const id = txt; this.later(() => { if (this.state.toast === id) this.setState({ toast: null }); }, 3000); } | 구현함 | T091 `savings.tsx SavingsProvider.report` setTimeout `toastDurationMs()` (`desk.toast.durationMs` 3000) · `case-progress.tsx hideLater` 3초 = `caseProgress.toast.hideMs` 3000. T098b ②: 움직임 줄이기여도 3초 (전에는 0ms로 바로 사라짐). tests/unit/app-t098b ② |
| `setInterval 34` | 1 | L652 ~iv | this.iv = setInterval(() => { | 구현함 | T091 `reply-panel.tsx typeOut` (`typeOutTiming()` = `desk.typeOut` 34ms·2글자, `desk-actions.ts typeOutFrames`). 타이핑 중 Send·카드·도구 꺼짐, 움직임 줄이기면 바로 전체 — 시험 `app-t091` 모션 |
| `setTimeout ms` | 1 | L637 later(fn, ms) | later(fn, ms) { this.tm = (this.tm \|\| []).concat([setTimeout(fn, ms)]); } | 구현함 | `case-progress.tsx later(fn, ms)` — 타이머를 모아 Replay·떠날 때 모두 지운다 (시안 this.tm). prefers-reduced-motion이면 단계 간격만 0ms, 토스트 숨김은 `hideLater` 3초 그대로 (T098b ②) |
| `transition: all .3s ease` | 1 | L181 <polyline> |  | 구현함 | `case.css .curve-draft`(점선 polyline)만 transition all `--motion-curve` (`desk.curve` .3s ease). 점·물결 원(`.curve-dot-draft`·`.curve-ping`)은 시안처럼 즉시 이동 (T105) |
| `<svg viewBox="0 0 640 150" preserveAspectRatio="none">` | 1 | L181 곡선 svg |  | 예외 (의도적 개선) | 시안 SVG 늘림 버그 수정 = 의도적 개선 (사람 결정 11/12 10:55, T112). `risk-curve.tsx`: ResizeObserver로 잰 실제 px 폭 = viewBox 폭(서버 렌더는 640), `preserveAspectRatio="none"` 없음, 선·점선·눈금선 `vector-effect="non-scaling-stroke"`. x는 시안 비율 그대로(`desk-model.ts curveView` xStep = 폭/12, 오른쪽 눈금 글자 자리 `CURVE_X.tickGutter`). tests/unit/app-t112 |
| `transition: background-color .15s` | 1 | L37 .it |  | 구현함 | `today.css .today-item` transition background-color `--motion-hover` (`desk.hover` .15s ease) |
| `transition: background-color .15s ease` | 1 | L18 .btn |  | 구현함 | `reply.css .reply-button`·`shell.css .desk-button-tint/-outline`·`today.css .tracking-button`(T098b)·`.cprog-btn` transition background-color `--motion-hover` (.15s ease) |
| `transition: background-color .3s ease` | 1 | L840 ~pointer-events |  | 구현함 | `reply.css .reply-editor-pill` (T090 전환) + T091 50% 이상 `.reply-editor-pill-high` |
| `transition: border-color .15s,background-color .15s` | 1 | L68 .npath |  | 구현함 | `case.css .choice` (T090, `desk.choiceCard`) — T091 고른 카드 `.choice[data-on='true']` |
| `transition: border-color .3s ease` | 1 | L57 .editor |  | 구현함 | `reply.css .reply-editor` (T090) + T091 테두리 색 `.reply-editor-empty/-high/-ok` |
| `transition: color .3s ease` | 2 | L748 ~font-variant-numeric |  | 구현함 | T091 위험 % `case.css .curve-headline` · 기분 `reply.css .reaction-mood-value` (`--motion-color` = `desk.colorFade`) |
| `transition: transform .2s ease` | 2 | L829 ~display |  | 구현함 | T091 Show history `case.css .desk-caret` · Details `reply.css .reply-details-caret` (`--motion-caret` = `desk.caret`) |
| `transition: width .35s ease` | 1 | L776 ~height |  | 구현함 | `reply.css .reaction-seg` 세 칸 모두 (T090, `desk.reactionBar`) — 시험 `app-t091` 보충 22:50 |

### 3. 누를 수 있는 것과 결과 상태 (13행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `onChange onType` | 1 | L271 <textarea> | setState: draft, path | 구현함 | T091 `reply-panel.tsx` textarea onChange → 글 + `desk.setPath('custom')` (예측·칩이 다시 나온다) |
| `onClick clear` | 1 | L265 button.btn | setState: draft, path | 구현함 | T091 `reply-panel.tsx` [Clear] → 빈 글 + path custom ("Start typing — each sentence is checked.") |
| `onClick it.pick` | 1 | L141 button.{{it.cls}} | setState: busy, draft, path, sel, sku · 호출: typeOut | 구현함 | T106: 목록 줄 = `<button>` → 화면 안 상태(`today/selection.tsx`, 서버 왕복 없음). 상세는 첫 요청에 모두 그려 두고 고른 것만 보임(`DetailPane`). 주소 `?item=`은 `history.replaceState`로 맞춰 새로고침·공유해도 같은 항목. 고른 줄 `aria-current`. (T106 전에는 링크 `?item=` 서버 재렌더였다 — 차이 목록 F1-47) |
| `onClick l.act` | 1 | L278 button.{{l.actCls}} | (정의 못 찾음) | 구현함 | T091 `reply-panel.tsx LintTray` [+ Add] = `config/reply-snippets.json` 문장 글 끝에(`applyChip` → 엔진 `appendSentence`), [Remove] = 걸린 문장 삭제(엔진 `removeSentence`). %p = 엔진 `replyFeatureEffects`. 시험 `app-t091` 만들 것 2 |
| `onClick oc.run` | 1 | L354 button.btn | setState: dash, done, flash · 호출: bump | 구현함 | T106: 지호·추적·Prevent·Routine 상세 = 시안 L345-357 틀(52px 타일 + 제목 + 범주 칩 + who, `.zone-work` 카드, `today/work-card.tsx`. AI 알약은 AI 글이 있는 지호·추적만). 지호 [Send offer] = 기존 제안 관문(`canSendOffer` → `sendReplyAction` kind offer, `today/offer-work.tsx`) → 꺼진 채 "Offer sent ✓" + Simulated, 추적 [Add all N] = 기존 `addTrackingAction`(공개 모드 Simulated) → 꺼진 채 "Added ✓". 끝나면 `useSavings().report` → "+$N just now"(엔진 `actionSavings`·`trackingSavings`), 금액 0이면 금액 없는 알림. (T106 전에는 지호 = 전체 사건 데스크, 추적 버튼이 끝난 뒤 다시 켜졌다 — 차이 목록 F1-55·56·58·59·63) Prevent 행(시안 kc 자리)은 T099에서 ~~`/products` 링크~~(11/12 11:15 결정으로 /products 제거 — T114) 대신 오른쪽 짧은 카드(`src/app/today/prevent-card.tsx`, 숫자 = 엔진 `pickPreventProduct`·`fixSavings`, 버튼 없음·쓰기 0, 시험 `tests/unit/app-t099.test.ts`). 시안 kc의 "Ask 3 Korean buyers…" 문구·[Send in Korean]·save 72는 근거 없는 숫자·데이터라 쓰지 않았다. 나머지 카드(Lena 환불·Yuki·bm 증빙)는 **예외(데이터: Lena·Yuki 없음, 실제 시드·샌드박스 사건만 — DECISIONS 22:55)** |
| `onClick p.pick` | 2 | L111 button.{{p.cls}} | setState: busy, draft, path, sel, sku · 호출: typeOut | 구현함 | T106: 상품 칩 = `<button aria-pressed>` → 화면 안 상태(`today/product-filter.tsx`, 고른 항목 유지 — 시안 L688), 주소 `?sku=`는 `history.replaceState`. 칩 줄 sticky 없음(시안 L109 정적). 배지·"N open cases"는 done이 아닌 분쟁 수(화면 상태). (T106 전에는 링크 `?sku=`가 `?item`을 버리고 칩 줄이 sticky였다 — 차이 목록 F1-16·18·19·22) · 선택지 카드 = T091 `choice-cards.tsx` 버튼 → `typeOut`(그 수의 초안), 막힌 수 `aria-disabled` |
| `onClick refundNow` | 1 | L324 button.btn | setState: cbDone, dash, done, flash · 호출: bump | 구현함(예외 포함) | T104: 'cb' 분기 있음 — 화난 답장 뒤 승인 대기 줄 + [Approve refund] (`case-progress.tsx approve`, 화면 상태만 · Simulated, 쓰기 0회) → "Refund approved" → 끝(Done today). 예외 그대로: 환불 실행·"POST …/refund · 201" 줄·"$72"·"−$82" 숫자 없음 (DECISIONS 22:55 안전장치·약속). tests/unit/app-t104.test.ts 2. 이전 기록: DECISIONS 22:55 안전장치·약속: 'cb' 결과 분기 없음 — 환불 실행·"POST …/refund · 201" 줄 없음 (쓰기 0회). T100 6번: 환불 카드 상태(또는 "환불했다"는 고친 글)에서는 Send 꺼짐 + "Refund is simulated in this demo — nothing is sent" (`editGate` refund), 서버 입구 `prepareEditedReply`도 refundNow 글을 AI 호출 전에 거부. tests/unit/app-t100.test.ts |
| `onClick replay` | 1 | L339 button.btn | setState: cbDone, done, draft, path, phase, shown, typing | 구현함 | src/app/cases/progress/case-progress.tsx [Replay this case] → 타이머 지움 + 답장 칸 처음(again() + AI 초안), 곡선 값 되돌림. tests/unit/app-t092.test.ts |
| `onClick rushed` | 1 | L263 button.btn | setState: busy, draft, path · 호출: typeOut | 구현함 | T091 `reply-panel.tsx` [Try a rushed reply] → `typeOut(case.reply.rushedExample, 'custom')` |
| `onClick send` | 1 | L305 button.btn | setState: cbDone, dash, done, flash, out, phase, refundNowF, sentKo, sentP, sentTxt, shown, typing · 호출: blocked, bump, fc, send | 구현함 | Send 뒤 (T092 몫): reply-panel.tsx 전환 지점 한 곳(sendState done && ok) → CaseProgress (phase 'sent', shown 1, typing). T104: out 분기 있음 — 보낸 글의 엔진 `forecastReply` pWait·pRefund·pChargeback 중 큰 것(`scenarioOutcome`, 같으면 ok > refund > cb). refund·cb 단계는 Simulated + 승인 버튼, 계약 밖 단계에는 위험 칩 없음. "+$N"·토스트·flash·Done today는 마지막 단계 때 한 번(`onFinish` → T102 상자). 예외: dash bump 고정 숫자 없음 (데이터·안전장치), 대시보드 숫자는 엔진 actionSavings만 (refund·cb는 0이라 "+$N"·토스트 없음). Send 버튼·관문 자체는 T090/T091. T100: 고친 글도 보낼 수 있다 — [Translate & check] → 서버 `prepareEditedReply`(값→토큰 되돌리기 · 이름 조각 남으면 AI 안 부름 · `translateReply` · 보낼 글 기준 검사 다시) → 통과한 글만 기억한 번호로 기존 `sendReply` 관문(공개 Simulated, 녹화만 실제). 번역 중 "Translating…"·AI 없음 "AI unavailable — use the AI draft". tests/unit/app-t100.test.ts |
| `onClick toggleGoods` | 1 | L283 button.gmore | setState: goodsOpen | 구현함 | "Details ⌄" `reply-panel.tsx DetailsToggle` (T090) — T091 안에 ✓ 칩별 %p·문장. **예외(안전장치)**: 검사가 실패하면 늘 펼침(닫을 수 없음) |
| `onClick toggleHist` | 1 | L202 button.hbtn | setState: histOpen | 구현함 | `case-history.tsx` [Show history] (T076·T090), T091 화살표 회전·펼침 rise |
| `onClick useAi` | 1 | L264 button.btn | setState: busy, draft, path · 호출: typeOut | 구현함 | T091 `reply-panel.tsx` [Use AI draft] → `typeOut(AI 초안, 최선 수)` (새 AI 호출 없음) |

### 4. 접힘·펼침 (34행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `aria-expanded {{goodsOpen}}` | 1 | L283 button.gmore |  | 구현함 | `reply-panel.tsx DetailsToggle` aria-expanded (T090) |
| `aria-expanded {{histOpen}}` | 1 | L202 button.hbtn |  | 구현함 | `case-history.tsx` aria-expanded (T076) |
| `more/less .gmore` | 4 | L64 ~ |  | 구현함 | `reply.css .reply-details-toggle` (T090: 오른쪽 끝, 투명 바탕, 12px 700, hover) |
| `more/less .less` | 1 | L838 ~goodsLabel |  | 구현함 | 문구 `case.reply.detailsHide` "Hide" (T090) |
| `more/less .more` | 1 | L838 ~less |  | 구현함 | 문구 `case.reply.details` "Details" (T090) |
| `more/less gmore` | 2 | L65 ~ |  | 구현함 | 위 `.gmore`와 같은 단추 (T090) |
| `more/less less` | 3 | L406 ~more |  | 구현함 | `case.reply.detailsHide` (en "Hide" / ko "접기") |
| `more/less more` | 2 | L406 ~sumOk |  | 구현함 | `case.reply.details` (en "Details" / ko "자세히 보기") |
| `rotate(180deg)` | 2 | L829 ~transform |  | 구현함 | T091 `case.css .desk-caret-open` · `reply.css .reply-details-caret-open` (transition .2s) |
| `sc-if goodsOpen` | 1 | L285 <sc-if> |  | 구현함 | Details 칸 `hidden` (T090) + T091 ✓ 칩별 %p 목록 `.reply-details-effects` |
| `sc-if h.hasFlag` | 1 | L210 <sc-if> |  | 구현함 | `case-history.tsx` 빨간 "Before DisputeLess · <표시>" (T090, 실제 기록의 표시만) |
| `sc-if hasGoods` | 1 | L280 <sc-if> |  | 구현함 | T091 `LintTray` ✓ 칩 줄 (`.reply-goods`, 칩 없으면 줄도 비움). Details 단추는 칩이 없어도 남긴다(**예외: 안전장치** — 검사 실패 시 Details를 펼쳐야 한다) |
| `sc-if histOpen` | 1 | L204 <sc-if> |  | 구현함 | `case-history.tsx` `hidden={!open}` + T091 rise |
| `sc-if isOther` | 1 | L345 <sc-if> |  | 구현함 | 지호 = 짧은 제안 카드(`reply-panel.tsx` 제안 먼저), 추적 = `tracking-detail.tsx` "Add tracking to N orders in PayPal" + [Add all N] (T091) |
| `sc-if isSeo` | 1 | L157 <sc-if> |  | 구현함 | `case-view.tsx` 전체 사례 화면 (제안 먼저가 아닌 분쟁) |
| `sc-if isTyping` | 1 | L234 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx Bubbles: state.typing일 때 "<이름> is typing" + 점 세 개. tests/unit/app-t092.test.ts |
| `sc-if l.hasAct` | 1 | L278 <sc-if> |  | 구현함 | T091 `LintTray` 빠진 것 [+ Add] / 나쁜 것 [Remove] (걸린 문장이 있을 때만) |
| `sc-if lintEmpty` | 1 | L276 <sc-if> |  | 구현함 | T091 빈 글이면 `case.reply.lintEmpty` "Start typing — each sentence is checked." |
| `sc-if m.hasTags` | 1 | L231 <sc-if> |  | 구현함 | `conversation.tsx` 말풍선 아래 `.case-read` "AI read" + 칩 (T090, 2개까지) · Send 뒤 손님 답장 아래 `case-progress.tsx` Bubbles `.case-read` (T092). tests/unit/app-t090 4번 |
| `sc-if m.isSim` | 1 | L227 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx 손님 답장 말풍선 "Simulated reply" 머리 + 점선 테두리(.cprog-bubble-sim). tests/unit/app-t092.test.ts |
| `sc-if notSent` | 1 | L238 <sc-if> |  | 구현함 | reply-panel.tsx 전환 지점 + src/app/cases/progress/case-progress.css .work:has(.cprog) — 보낸 뒤 "지금 대응" 머리 줄·선택지 카드·답장 칸을 숨긴다 |
| `sc-if p.hasCase` | 1 | L112 <sc-if> |  | 구현함 | 상품 칩 빨간 건수 배지 `ProductTile badge` (T076, 엔진 목록 값) |
| `sc-if p.rec` | 1 | L249 <sc-if> |  | 구현함 | "Best" 알약 = 엔진 `recommend` 최선 수 (`choice-cards.tsx`) |
| `sc-if resOn` | 1 | L330 <sc-if> |  | 예외 | DECISIONS 22:55 데이터: 결과 상자("5 days · $0 lost", "23 days · 4 messages", "−$82")는 근거 없는 성과 숫자라 없음. 끝은 엔진 actionSavings 토스트 + 카드 flash |
| `sc-if risk.hasFrom` | 1 | L191 <sc-if> |  | 구현함 | `risk-curve.tsx` "89% → x" (`curveView.fromTo`, 엔진 값, 답장 예측이 있고 글이 있을 때만. 빈 글 = 무응답이면 숨김 + "if no reply by {date}", T105) |
| `sc-if s.act` | 1 | L324 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx [Forward to carrier] 대기 줄(시안 act 줄 모양 '!' #FBE7E4) — 판매자가 누를 때까지 멈춤 (DECISIONS 22:55). 시안의 cb "Refund now" 용도는 예외(refundNow 행) |
| `sc-if s.auto` | 1 | L321 <sc-if> |  | 예외 | DECISIONS 22:55 Send 이후: "Auto" 없음 → [Forward to carrier] 승인 버튼, 배송사 연동·"POST carrier/… 200"·추적 동기화 줄 없음. tests/unit/app-t092.test.ts |
| `sc-if s.hasP` | 1 | L321 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx 단계 칩 "Risk N%" = 엔진 scenarioRisk (보낸 답장 줄은 시안처럼 없음) + 머리 Assumption. tests/unit/app-t092.test.ts |
| `sc-if sent` | 1 | L313 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx CaseProgress 칸 (AI 알약 + 제목 "What happens next · Simulated" — DECISIONS 22:55 제목 예외) |
| `sc-if showKo` | 1 | L293 <sc-if> |  | 구현함 | "She'll see (Korean)" 칸 (T090). T091: 글을 바꾸면 `case.reply.autoTr` "Translated to Korean when you send." (회색). T100: 번역 중 "Translating…", 번역·검사가 끝나면 고친 글의 한국어 전송본(보낼 때와 같은 채움 `screenText`) + 역번역·검사는 Details / "{이름} will see (Korean)" 칸 (T090 → T099: 제목에 구매자 이름 `case.reply.sheSees` `{{name}}`, 대명사 없음. `reply-panel.tsx`, 시험 `tests/unit/app-t099.test.ts`). T091: 글을 바꾸면 `case.reply.autoTr` "Translated to Korean when you send." (회색) |
| `sc-if stepsRunning` | 1 | L328 <sc-if> |  | 구현함 | src/app/cases/progress/progress-model.ts progressRunning (끝나지 않았고 Forward 대기도 아닐 때) → src/app/cases/progress/case-progress.css .cprog-running 점 세 개 (padding-left 46px). tests/unit/app-t092.test.ts |
| `sc-if toastOn` | 1 | L361 <sc-if> |  | 구현함 | T091 `savings.tsx` `.savings-toast` role=status (3000ms). T104: Send 뒤 토스트는 이것 하나만, 마지막 단계 때 한 번 (`case-progress.tsx` 자기 토스트 삭제 → `onFinish` → `report`). tests/unit/app-t104.test.ts 3 |
| `state goodsOpen` | 8 | L283 button.gmore |  | 구현함 | `reply-panel.tsx detailsOpen` (T090) |
| `state histOpen` | 12 | L202 button.hbtn |  | 구현함 | `case-history.tsx open` (T076) |

### 5. 조건부 스타일 (28행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `/\\+/.test(d.sub) ? '#60CDFF' : '#C9E3FF'` | 1 | L698 ~color |  | 구현함 | T091 "+$N just now" `today.css .weekly-bump` (`--color-flash` #60cdff). 나머지 줄은 지금 색(`--color-on-accent-muted`) |
| `c.empty ? '#CFD3D8' : fc.p.cb >= 0.5 ? '#E8796B' : '#0A1B3D'` | 2 | L837 ~border-color |  | 구현함 | T091 `reply-panel.tsx` `.reply-editor-empty/-high/-ok` (기준값 `motion.json desk.riskColor.highFrom` 0.5, 색 토큰 `--color-line`·`--color-editor-high`·`--color-navy-ink`) |
| `draftGrid: LANG === 'en' ? 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' : 'display:grid;grid-template-columns:minmax(0,1fr);gap:12px'` | 1 | L836 ~LANG |  | 구현함 | `reply.css .reply-pair` 2열 gap 12px(`--space-3`), 좁은 폭 1열. 시안의 두 갈래는 showKo와 같은 조건(판매자 글 언어 ≠ 구매자 언어)이다 — 앱은 판매자 입력이 늘 영어(`reply-panel.tsx` textarea lang="en")라 미리보기 칸이 늘 있고 2열 (ko 화면 글자여도 같음) |
| `fc.mood >= -0.5 ? '#000000' : '#C4321F'` | 1 | L844 ~color |  | 구현함 | T091 `.reaction-mood-bad` = 엔진 기분 단계 `angry`(mood < annoyedFrom −0.5, `config/reply-model.json`) → `reactionView.moodBad` |
| `fc.p.cb >= 0.5 ? '#C4321F' : '#0A1B3D'` | 1 | L840 ~background |  | 구현함 | T091 `.reply-editor-pill-high` (`reactionView.chargebackHigh` = `riskTone` high) |
| `fn riskCol: p >= 0.5 ? '#C4321F' : p >= 0.2 ? '#000000' : '#0066F5'` | 1 | L747 ~ |  | 구현함 | T091 `motion.ts riskTone` (기준값 `desk.riskColor` 0.5·0.2) → `risk-curve.tsx` `data-tone` + `case.css .curve-headline[data-tone]` |
| `i.risk === 'high' ? 'background:#FBE7E4;color:#9E2414' : 'background:#ECEEF0;color:#3F4144'` | 1 | L704 ~risk |  | 구현함 | `today/model.ts categoryTone` high\|neutral (엔진 위험 High만 high) → `today.css .today-pill-high`(#FBE7E4/#9E2414) / `.today-pill-neutral`(#ECEEF0/#3F4144). 사례 머리 `desk-model.ts categoryTone` → `.desk-chip-bad`/`.desk-chip` |
| `k === 'cb' && fc.p.cb >= 0.5 ? '#C4321F' : '#000000'` | 1 | L843 ~k |  | 구현함 | T091 반응 막대 범례 `.reaction-legend-high` (차지백 칸만, `chargebackHigh`) |
| `kind === 'bad' ? ' ghost' : ''` | 1 | L788 ~kind |  | 구현함 | T091 [Remove] `.reply-lint-button-ghost` — T098b: 시안 inset 2px #E8796B 그대로 `--shadow-ghost` (전에는 2px 테두리). tests/unit/app-shared-design.test.ts B-3 |
| `kind === 'bad' ? '#C4321F' : '#0A1B3D'` | 1 | L787 ~kind |  | 구현함 | T091 %p 글자 `.reply-lint-pp` / `.reply-lint-pp-bad`. T104 F4-47: bad 줄 부호도 시안 `eff(k,true)` 대로 "+N pts" (`desk-actions.ts shownDeltaPp`, 엔진 deltaPp 부호만 뒤집음) |
| `line: i === 0 ? 'display:none' : 'flex:1;height:2px;background:#E4E6E9;min-width:6px'` | 1 | L752 ~i |  | 구현함 | `case-history.tsx` 첫 점은 줄 없음(`index === 0 ? null`), `case.css .history-dot-line` flex 1·2px·`--color-border` #E4E6E9 |
| `lineSt: isLast ? 'display:none' : 'flex:1;width:2px;min-height:14px;background:#CFD3D8;margin:4px 0'` | 1 | L807 ~lineSt |  | 구현함 | src/app/cases/progress/case-progress.tsx row.last면 줄 없음, src/app/cases/progress/case-progress.css .cprog-line 같은 값 |
| `n === 0 ? 'No cases' : n + (n === 1 ? ' case' : ' cases')` | 1 | L372 ~n |  | 구현함 | `config/copy.*.json today.filter.subNone` "No cases" / `subOne` "case" / `sub` "cases" → `today-list.tsx ProductFilterBar` (건수는 엔진 목록 값) |
| `n === 1 ? ' case' : ' cases'` | 1 | L372 ~n |  | 구현함 | 위 행과 같음 (`today.filter.subOne`·`today.filter.sub`) |
| `p >= 0.5 ? '#C4321F' : p >= 0.2 ? '#000000' : '#0066F5'` | 2 | L747 ~riskCol |  | 구현함 | 위 `riskCol`과 같음 (T091 `riskTone`, 시험 `app-t091` 보충 22:50) |
| `pSt: st.p !== null && st.p >= 0.5 ? 'background:#FBE7E4;color:#9E2414' : 'background:#E3F3FF;color:#002991'` | 1 | L808 ~pSt |  | 구현함 | src/app/cases/progress/progress-model.ts riskHigh (p ≥ 0.5, 그림 기준) → src/app/cases/progress/case-progress.css .cprog-chip / .cprog-chip-high 같은 색 |
| `pf[k].p.cb >= 0.5 ? '#C4321F' : '#0A1B3D'` | 1 | L781 ~color |  | 구현함 | T091 선택지 카드 "Chargeback N%" `.choice-cb-high/-low` (`ChoiceView.chargebackTone`, 엔진 `forecastMoves` 값) |
| `resBg: resKey === 'cb' ? '#FBE7E4' : 'linear-gradient(120deg,#E3F3FF,#F5F9FF)'` | 1 | L851 ~resKey |  | 예외 | DECISIONS 22:55 데이터: 결과 상자 없음 (resOn 행과 같은 이유) |
| `resKey === 'cb' ? '#9E2414' : '#002991'` | 1 | L851 ~resKey |  | 예외 | DECISIONS 22:55 데이터: 결과 상자 없음 (resOn 행과 같은 이유) |
| `s.done[i.id] ? ' done' : ''` | 1 | L709 ~sel | `today-item-done` (opacity .55), 점·막대 #CFD3D8, 맨 아래 "Done today" 묶음 | 반영 (T102) | 사람 결정 11/12 "Yes, show it": 화면 상태만. 모두 Simulated면 제목 "Done today · Simulated" |
| `s.done[i.id] ? '#CFD3D8' : sevCol[i.risk]` | 1 | L708 ~background |  | 예외 | 위 `s.done` 행과 같은 이유 (Done 회색 점 없음). sevCol 자체는 구현함: T098b `today.css .today-dot-high`(#C4321F)·`.today-dot-watch`(#002991, 시안 med)·`.today-dot-low`(#9AA0A6). tests/unit/app-t098b ③ |
| `s.goodsOpen ? 'transform:rotate(180deg)' : ''` | 1 | L838 ~transition |  | 구현함 | `reply.css .reply-details-caret-open` + T091 transition .2s |
| `s.histOpen ? 'transform:rotate(180deg)' : ''` | 1 | L829 ~transition |  | 구현함 | T091 `case.css .desk-caret-open` (전에는 규칙이 없어 돌지 않았다) |
| `s.path === k ? ' on' : ''` | 2 | L780 ~path |  | 구현함 | T091 `choice-cards.tsx` `data-on` + `aria-pressed` + `.choice-radio-on` (`case.css .choice[data-on='true']` = 시안 `.npath.on` #0A1B3D·#F3F5F9) |
| `s.sel === i.id ? ' on' : ''` | 1 | L709 ~sel |  | 구현함 | 목록 고른 줄 `aria-current` (T076 `today.css`) |
| `s.sku === p.sku ? ' on' : ''` | 1 | L686 ~sku |  | 구현함 | 상품 칩 `aria-current` (T076 `today.css .product-filter-chip[aria-current='true']`) |
| `same ? '' : 'color:#6C7378'` | 1 | L841 ~font-size |  | 구현함 | T091 `.reply-auto-tr` (`--color-muted`) |
| `st.buyer ? '#F1EFEA;color:#000000' : st.auto ? 'linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF);color:#FFFFFF' : st.act ? '#FBE7E4;color:#9E2414' : '#002991;color:#FFFFFF'` | 3 | L805 ~bg |  | 구현함 | `case-progress.css .cprog-icon-buyer`(#F1EFEA/#000) · `.cprog-icon-pending`(act, #FBE7E4/#9E2414) · 기본 `.cprog-icon`(#002991/#FFF). **st.auto 갈래만 예외** (DECISIONS 22:55 Send 이후: Auto 없음 → [Forward to carrier]). tests/unit/app-t092 |

## docs/design/mockup-v4/scene1/Scene1.dc.html

### 1. 색 토큰 (25행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `#000000` | 15 | L20 .tab.on |  | 구현함 | src/app/demo/seller-dashboard/intro.css:11 `--i-text` → .intro-tab.on(115) 글자, .intro-coach(232) 바탕, .intro-btn-black(387), .intro-btn-line(394) 글자 |
| `#002991` | 3 | L20 .tab.on |  | 구현함 | src/app/demo/seller-dashboard/intro.css:24 `--i-deep` → .intro-tab.on(115) 밑줄·.intro-logo(84) 글자(T098a에서 강조색→시안 값), src/app/demo/seller-dashboard/intro.css:27 Handle all 그라디언트. 시험 `tests/unit/app-t098a-scenes.test.ts` "L20". 로고 자리 글자 "Seller dashboard"는 예외 /demo/seller-dashboard |
| `#0066F5` | 4 | L18 .pp a |  | 구현함 | src/app/demo/seller-dashboard/intro.css:8 `--color-accent` → .intro-rlink(423, 시안 .pp a), .intro-bar-last(508), 그라디언트 src/app/demo/seller-dashboard/intro.css:27·28 |
| `#00A8EA` | 1 | L55 <path> |  | 예외 | DECISIONS 11/11 22:55 예외 "/demo/seller-dashboard(PayPal 로고 없음)" — 시안 로고 안 색(#00A8EA, 지시서 T098 규칙 2): L55 아이콘 마크 선색. 앱 마크 선은 강조색 (src/app/demo/seller-dashboard/intro.css:203 .intro-mark-accent) |
| `#097FF5` | 1 | L27 .al-icon:focus-visible,.btn:focus-visible,.tab:focus-visibl… |  | 구현함 | src/app/demo/seller-dashboard/intro.css:25 `--i-focus` → src/app/demo/seller-dashboard/intro.css:413 focus-visible outline 2px solid (T098a에서 강조색→시안 값). 시험 `tests/unit/app-t098a-scenes.test.ts` "L27" |
| `#0B0F14` | 1 | L26 .al-icon |  | 구현함 | src/app/demo/seller-dashboard/intro.css:20 `--i-ink` → .intro-al-icon(162) 바탕 |
| `#333333` | 1 | L23 .b-black:hover |  | 구현함 | src/app/demo/seller-dashboard/intro.css:26 `--i-black-hover` → .intro-btn-black:hover(391) (T098a 추가). 시험 `tests/unit/app-t098a-scenes.test.ts` "L23" |
| `#3F4144` | 15 | L19 .tab |  | 구현함 | src/app/demo/seller-dashboard/intro.css:12 `--i-body` → .intro-tab(103), .intro-ico(150), .intro-small·.intro-label, .intro-chip-mock(484) |
| `#60CDFF` | 2 | L64 <span> |  | 구현함 | src/app/demo/seller-dashboard/intro.css:27·28 그라디언트 → .intro-btn-accent(407), .intro-new(262) (T098a: 단색→시안 그라디언트). 시험 `tests/unit/app-t098a-scenes.test.ts` "L62·L64", "L104" |
| `#9E2414` | 7 | L96 span.chip |  | 구현함 | src/app/demo/seller-dashboard/intro.css:16 `--i-risk` → .intro-amount-hold(463), .intro-due-urgent(470), .intro-chip-risk(492) |
| `#C4321F` | 2 | L51 span.chip |  | 구현함 | src/app/demo/seller-dashboard/intro.css:19 `--i-risk-dot` → .intro-chip-count(488), .intro-al-badge(186) |
| `#C9D3E0` | 1 | L174 ~i |  | 구현함 | src/app/demo/seller-dashboard/intro.css:22 `--i-bar` → .intro-bar(503) |
| `#CFD3D8` | 1 | L24 .b-line |  | 구현함 | src/app/demo/seller-dashboard/intro.css:21 `--i-line-btn` → .intro-btn-line(394) 테두리 2px |
| `#E4E6E9` | 2 | L21 .card |  | 구현함 | src/app/demo/seller-dashboard/intro.css:13 `--i-line` → .intro-card(312) 테두리 1px, .intro-header 아래 선 |
| `#ECEEF0` | 1 | L44 span.chip |  | 구현함 | src/app/demo/seller-dashboard/intro.css:15 `--i-chip-bg` → .intro-chip-mock(484), src/app/demo/seller-dashboard/intro-screen.tsx:75 "Demo mock" 칩 (T098a 추가, 문구 config/intro.*.json `mock`). 시험 `tests/unit/app-t098a-scenes.test.ts` "L44" |
| `#F1EFEA` | 4 | L32 .row |  | 구현함 | src/app/demo/seller-dashboard/intro.css:9·14 → 화면 바탕, .intro-row(435) 위 선, .intro-avatar(213) |
| `#F2B8AF` | 1 | L95 section.card |  | 구현함 | src/app/demo/seller-dashboard/intro.css:18 `--i-risk-border` → .intro-card-rc(325) 테두리 2px |
| `#FBE7E4` | 1 | L96 span.chip |  | 구현함 | src/app/demo/seller-dashboard/intro.css:17 `--i-risk-bg` → .intro-chip-risk(492) |
| `#FFFFFF` | 15 | L21 .card |  | 구현함 | src/app/demo/seller-dashboard/intro.css:10 `--i-surface` → 카드·머리·버튼 글자, src/app/demo/seller-dashboard/intro.css:31 focus 흰 고리 |
| `linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF)` | 1 | L104 a.btn |  | 구현함 | src/app/demo/seller-dashboard/intro.css:27 `--i-grad-cta` → .intro-btn-accent(407, gap 10px) (T098a 고침). 시험 `tests/unit/app-t098a-scenes.test.ts` "L104" |
| `linear-gradient(120deg,#0066F5,#60CDFF)` | 1 | L64 <span> |  | 구현함 | src/app/demo/seller-dashboard/intro.css:28 `--i-grad-new` → .intro-new(262) (T098a 고침). 시험 `tests/unit/app-t098a-scenes.test.ts` "L62·L64" |
| `rgba(0,0,0,0.25)` | 1 | L62 div.rise |  | 구현함 | src/app/demo/seller-dashboard/intro.css:34 `--i-shadow-coach` → .intro-coach(232) box-shadow 0 12px 32px (T098a 추가). 시험 `tests/unit/app-t098a-scenes.test.ts` "L62·L64" |
| `rgba(0,102,245,.55)` | 1 | L28 ~box-shadow |  | 구현함 | src/app/demo/seller-dashboard/intro.css:32 `--i-shadow-pulse-from` → @keyframes intro-pulse(178) 0% (T098a: 테두리 확대→시안 box-shadow 고리). 시험 `tests/unit/app-t098a-scenes.test.ts` "L26·L28·L29" |
| `rgba(0,102,245,0)` | 1 | L28 100% |  | 구현함 | src/app/demo/seller-dashboard/intro.css:33 `--i-shadow-pulse-to` (0 0 0 16px) → @keyframes intro-pulse(178) 100%. 시험 `tests/unit/app-t098a-scenes.test.ts` "L26·L28·L29" |
| `rgba(0,112,224,0.45)` | 1 | L26 .al-icon |  | 구현함 | src/app/demo/seller-dashboard/intro.css:30 `--i-shadow-icon` → .intro-al-icon(162) box-shadow 0 4px 14px (T098a 추가 — 로고 밖 아이콘 그림자라 로고 예외 아님). 시험 `tests/unit/app-t098a-scenes.test.ts` "L26·L28·L29" |

### 2. 모션·타이밍 (hover·focus 포함) (6행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `.al-icon:focus-visible,.btn:focus-visible,.tab:focus-visible,.rlink:focus-visible` | 1 | L27 | box-shadow:#FFFFFF 0 0 0 2px;outline:2px solid #097FF5;outline-offset:2px | 구현함 | src/app/demo/seller-dashboard/intro.css:413 (.intro-btn·.intro-tab·.intro-rlink·.intro-al-icon) box-shadow var(--i-shadow-focus)=#FFFFFF 0 0 0 2px + outline 2px solid #097FF5 + offset 2px (T098a 고침). 시험 `tests/unit/app-t098a-scenes.test.ts` "L27" |
| `.b-black:hover` | 1 | L23 | background:#333333 | 구현함 | src/app/demo/seller-dashboard/intro.css:391 background #333333 (T098a 추가). 시험 `tests/unit/app-t098a-scenes.test.ts` "L104" |
| `@keyframes pulse` | 1 | L28 | 0%{box-shadow:0 0 0 0 rgba(0,102,245,.55)}100%{box-shadow:0 0 0 16px rgba(0,102,245,0)} | 구현함 | src/app/demo/seller-dashboard/intro.css:178 @keyframes intro-pulse 0% box-shadow 0 0 0 0 rgba(0,102,245,.55) → 100% 0 0 0 16px rgba(0,102,245,0) (T098a 고침). 시험 `tests/unit/app-t098a-scenes.test.ts` "L26·L28·L29" |
| `@keyframes rise` | 1 | L30 | from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} | 구현함 | src/app/demo/seller-dashboard/intro.css:274 @keyframes intro-rise translateY(8px)·opacity 0 → none·1 |
| `animation: pulse 1.6s ease-out infinite` | 1 | L29 .pulse |  | 구현함 | src/app/demo/seller-dashboard/intro.css:175 .intro-pulse (src/app/demo/seller-dashboard/intro-screen.tsx:95 아이콘), 움직임 줄이기 src/app/demo/seller-dashboard/intro.css:557에서 끔. 시험 `tests/unit/app-t098a-scenes.test.ts` |
| `animation: rise .5s ease both .3s` | 1 | L31 .rise |  | 구현함 | src/app/demo/seller-dashboard/intro.css:232 .intro-coach animation intro-rise 0.5s ease both 0.3s, 움직임 줄이기 src/app/demo/seller-dashboard/intro.css:557에서 끔 |

### 3. 누를 수 있는 것과 결과 상태 (0행)

_(자동 추출 0행 — 시안의 링크는 onClick이 아니라 href라서 빠졌다. T098a가 시안 L54·L66·L101·L104를 직접 보고 더한 행. 스크립트를 다시 돌리면 아래 행은 "사라진 행" 절로 옮겨지며 값은 유지된다.)_

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `href {{deskHref}} a.al-icon` | 1 | L54 a.al-icon | DisputeLess 아이콘 → Desk | 구현함 | src/app/demo/seller-dashboard/intro-screen.tsx:95 Link → Today 서연(`/?item=PP-R-GMS-10197661`, 앱의 Desk). 맥박 고리 src/app/demo/seller-dashboard/intro.css:175. 시험 `tests/unit/app-t098a-scenes.test.ts` "누를 수 있는 것 4개", `tests/unit/app-intro.test.ts` |
| `href {{deskHref}} a.btn (말풍선 Open DisputeLess →)` | 1 | L66 a.btn | 말풍선 버튼 → Desk | 구현함 | src/app/demo/seller-dashboard/intro-screen.tsx:122 Link → Today 서연 (.intro-btn-white 흰 바탕·38px·14px). 시험 `tests/unit/app-t098a-scenes.test.ts` "누를 수 있는 것 4개" |
| `href {{deskHref}} a.rlink (Respond →)` | 3 | L101 a.rlink | 사건 줄 Respond → Desk | 구현함 | src/app/demo/seller-dashboard/intro-screen.tsx:178 Link → Today 서연 (사건마다). T115: 사건 줄 3개(서연·지호·마이크 PP-R-FYT-10197651) = Desk와 같은 출처(연결 표 → 시드, 기한은 읽기 캐시, `src/app/_server/intro-data.ts`), 건수 3은 사건 줄 수에서. 시험 `tests/unit/app-t098a-scenes.test.ts` "누를 수 있는 것 4개", `tests/unit/app-t115.test.ts` |
| `href="#" a.tab ×5, a.rlink (See all)` | 6 | L49 a.tab | 껍데기 링크 | 예외 | **껍데기 버튼은 동작 없음 (사람 결정 11/12 11:20)**: 시안처럼 `<a href="#">`, 누르면 preventDefault라 주소에 `#`가 붙지 않는다 (시안은 붙음). 벨·도움말·Transfer money·Request payment = 일반 `<button type="button">`, aria-disabled 없음, cursor pointer(시안 값). T115, 시험 `tests/unit/app-t115.test.ts` |
| `href {{deskHref}} a.btn (Handle all N with DisputeLess)` | 1 | L104 a.btn | Handle all → Desk | 구현함 | src/app/demo/seller-dashboard/intro-screen.tsx:183 Link → Today 서연, 그라디언트 src/app/demo/seller-dashboard/intro.css:27. 시험 `tests/unit/app-t098a-scenes.test.ts` "L104"·"누를 수 있는 것 4개" |

### 4. 접힘·펼침 (3행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `rotate(45deg)` | 1 | L63 <span> |  | 구현함 | src/app/demo/seller-dashboard/intro.css:248 .intro-coach-arrow transform rotate(45deg) (src/app/demo/seller-dashboard/intro-screen.tsx:116) |
| `state alOpen` | 4 | L54 a.al-icon |  | 구현함 | 상태가 아니라 문구 키 v.alOpen ("Open DisputeLess"): src/app/demo/seller-dashboard/intro-screen.tsx:95 아이콘 aria-label, src/app/demo/seller-dashboard/intro-screen.tsx:122–123 말풍선 버튼. 시험 `tests/unit/app-intro.test.ts` |
| `state rcOpen` | 3 | L96 ~color |  | 구현함 | 상태가 아니라 문구 키 v.rcOpen 칩: src/app/demo/seller-dashboard/intro-screen.tsx:168 .intro-chip-risk(#FBE7E4/#9E2414). 건수 "2 open"은 예외 "데이터(실제 샌드박스 사건, Lena 없음)" |

### 5. 조건부 스타일 (1행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `i === SALES.length - 1 ? '#0066F5' : '#C9D3E0'` | 1 | L174 ~i |  | 구현함 | src/app/demo/seller-dashboard/intro-screen.tsx:193 마지막 막대만 .intro-bar-last(src/app/demo/seller-dashboard/intro.css:508, #0066F5), 나머지 .intro-bar(src/app/demo/seller-dashboard/intro.css:503, #C9D3E0) |

## docs/design/mockup-v4/scene3/Main.dc.html

> **T109 (2026-11-12, 사람 결정 09:25 "시안 CSS 통째 복사")**: `src/app/demo/store/new-product/listing.css`를 새로 썼다 — `--ls-*` 변수가 없어지고 시안 `<style>`(L15–L62)이 `.ls ` 범위로 그대로, 인라인 style 값은 `ls-*` class 규칙(줄 주석 = 시안 줄 번호)으로 옮겨졌다. 아래 표의 "구현함" 근거에 적힌 **listing.css 줄 번호·변수 이름은 T109 이전 것**이다. 시안 값 ↔ 앱 요소 대응은 `reports/T109-impl.md` "대응표"가 기준이다. 상태(구현함/예외)는 바뀌지 않았다. 예외 행: `#00A8EA`(마크 선 → #60CDFF 유지), `p.hasDelta` 칩(그리지 않음 유지), 화면 안 계수들(엔진·config 유지).

### 1. 색 토큰 (48행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `#000000` | 7 | L20 .b-black |  | 구현함 | src/app/demo/store/new-product/listing.css:28 `--ls-black` → .ls-b-black(695) (T098a: #0B0F14→시안 #000000), src/app/demo/store/new-product/listing.css:19 `--ls-text` 글자. 시험 `tests/unit/app-t098a-scenes.test.ts` "L20" |
| `#002991` | 16 | L22 .b-ai |  | 구현함 | src/app/demo/store/new-product/listing.css:8 `--ls-accent-deep` → .ls-b-ai(709)·.ls-ai(544) 그라디언트, .ls-ins(564)·.ls-kicker(1060)·.ls-status(940)·.ls-check-s.on(1003)·.ls-chip-peak(539)·.ls-peak.on(491) 글자, .ls-big.good(776)·.ls-done-prob.good(1410) (T098a 고침), .ls-spg-a(1098) |
| `#0066F5` | 14 | L22 .b-ai |  | 구현함 | src/app/demo/store/new-product/listing.css:7 `--ls-accent` → .ls-check-ic.on(994), .ls-fix-plus(1313), .ls-fix-s(1326), .ls-bar-fill.down(937), .ls-step.done(1128), .ls-pulse-line(1104), 그라디언트 |
| `#00A8EA` | 3 | L75 <path> |  | 예외 | DECISIONS 11/11 22:55 예외 "/demo/seller-dashboard(PayPal 로고 없음)" — 시안 로고 안 색(#00A8EA, 지시서 T098 규칙 2): L75·L117·L167 DisputeLess 마크 선색. 앱 마크 선은 src/app/demo/store/new-product/listing.css:240 .ls-mark-line(#60CDFF) |
| `#05378214` | 1 | L21 .b-tint |  | 구현함 | src/app/demo/store/new-product/listing.css:30 `--ls-tint` (T098a: rgba 근삿값→시안 8자리 값 그대로) → .ls-b-tint(702). 시험 `tests/unit/app-t098a-scenes.test.ts` "L20" |
| `#05378227` | 1 | L21 .b-tint:hover |  | 구현함 | src/app/demo/store/new-product/listing.css:31 `--ls-tint-hover` → .ls-b-tint:hover(706). 시험 `tests/unit/app-t098a-scenes.test.ts` "L20" |
| `#097FF5` | 2 | L38 .btn:focus-visible,.fld:focus-visible,.ins:focus-visible |  | 구현함 | src/app/demo/store/new-product/listing.css:14 `--ls-focus` → .ls :focus-visible(90), .ls-addph:focus-within(421). 시험 `tests/unit/app-t098a-scenes.test.ts` "L38" |
| `#0A1B3D` | 3 | L46 .addph |  | 구현함 | src/app/demo/store/new-product/listing.css:15 `--ls-navy` → .ls-addph(398) 글자, .ls-addph:hover(417) 테두리, .ls-addic(431) 바탕 |
| `#0B0F14` | 5 | L30 .tipb |  | 구현함 | src/app/demo/store/new-product/listing.css:26 `--ls-ink` → .ls-tipb(811), .ls-apib b(645), .ls-apib-ic(247) |
| `#1F3A2E` | 1 | L67 <span> |  | 구현함 | src/app/demo/store/new-product/listing.css:56 `--ls-store` → .ls-store-logo(128). 가게 이름은 예외 "/demo/store/new-product(Fernwood Knits)" → 머리글자 F |
| `#1F9D55` | 1 | L37 .livedot |  | 구현함 | src/app/demo/store/new-product/listing.css:58 `--ls-live` → .ls-livedot(649) |
| `#333333` | 1 | L20 .b-black:hover |  | 구현함 | src/app/demo/store/new-product/listing.css:27 `--ls-ink-hover` → .ls-b-black:hover(699) |
| `#3F4144` | 18 | L29 .tipq |  | 구현함 | src/app/demo/store/new-product/listing.css:20 `--ls-body` → .ls-lab(332), .ls-sub(343), .ls-tipq(796), .ls-snav(207), .ls-an-s(1111), .ls-hero-sub(1219), .ls-loss-how(1346), .ls-done-s/disp/note(1380–1388) |
| `#60CDFF` | 6 | L22 .b-ai |  | 구현함 | src/app/demo/store/new-product/listing.css:9·10 → .ls-ai(544), .ls-b-ai(709), .ls-prog-fill(963), .ls-done-ic(1364), .ls-spg-b(1101) (T098a 회전 고리 그라디언트 추가) |
| `#6C7378` | 13 | L67 <span> |  | 구현함 | src/app/demo/store/new-product/listing.css:21 `--ls-muted` → .ls-tiny(347), .ls-crumb(262), .ls-basis-k(1197), .ls-panel .ls-sub(779)·.ls-run-t(1144)·.ls-top-of(1278) (T098a: 시안 글자 크기·색 그대로) |
| `#7A1A0F` | 1 | L484 ~A1 |  | 구현함 | src/app/demo/store/new-product/listing.css:47 `--ls-t-a1` → 유형 A1 색(858–861) |
| `#99C2FF` | 1 | L52 .ins |  | 구현함 | src/app/demo/store/new-product/listing.css:39 `--ls-shadow-ins` → .ls-ins(564) box-shadow inset 0 0 0 2px (T098a: border→시안 그림자). 시험 `tests/unit/app-t098a-scenes.test.ts` "시안 그림자" |
| `#9AA0A6` | 5 | L46 .addph |  | 구현함 | src/app/demo/store/new-product/listing.css:51·54 → .ls-addph(398) 점선, .ls-cell.on(1163), .ls-step.todo(1135), .ls-check-ic(980) 글자, 유형 X(882) |
| `#9E2414` | 2 | L108 span.chip |  | 구현함 | src/app/demo/store/new-product/listing.css:43 `--ls-risk-text` → .ls-chip-gap(535), .ls-status.dirty(953) |
| `#C4321F` | 5 | L207 <span> |  | 구현함 | src/app/demo/store/new-product/listing.css:42 `--ls-risk` → .ls-big(768), .ls-hero-n(1211), .ls-top-n b(1273), .ls-done-prob(1401), 유형 B2(876) |
| `#CFD3D8` | 3 | L40 .fld |  | 구현함 | src/app/demo/store/new-product/listing.css:23 `--ls-line-strong` → .ls-fld(462) 테두리, .ls-grab(1053); src/app/demo/store/new-product/listing.css:40 체크 inset 그림자 |
| `#D9DCE0` | 1 | L508 ~background |  | 구현함 | src/app/demo/store/new-product/listing.css:52 `--ls-dot` → .ls-dot(851) |
| `#E3E7EC` | 2 | L69 <span> |  | 구현함 | src/app/demo/store/new-product/listing.css:55 `--ls-avatar` → .ls-avatar(176). (L76 "P" 아이콘 바탕은 로고 예외 — 아이콘 없음, `tests/unit/app-t087-listing.test.ts` "PayPal payments") |
| `#E3F3FF` | 4 | L58 ~background |  | 구현함 | src/app/demo/store/new-product/listing.css:11·13 → @keyframes ls-flashA/B(502·510) 0%, .ls-peak.on(491), .ls-chip-peak(539) |
| `#E4E6E9` | 16 | L29 .tipq |  | 구현함 | src/app/demo/store/new-product/listing.css:22 `--ls-line` → .ls-card(291), .ls-tipq(796), .ls-prog(957), .ls-spin-track(1089), .ls-basis(1176); src/app/demo/store/new-product/listing.css:38 inset 1px (.ls-snav.on·.ls-ph) |
| `#E8796B` | 2 | L41 .fld.gap |  | 구현함 | src/app/demo/store/new-product/listing.css:46·48 → .ls-fld-gap(476) 테두리, 유형 A2(864) |
| `#EEF0F2` | 1 | L523 ~background |  | 구현함 | src/app/demo/store/new-product/listing.css:53 `--ls-cell` → .ls-cell(1153) |
| `#EEF0F3` | 1 | L33 .snav:hover |  | 구현함 | src/app/demo/store/new-product/listing.css:24 `--ls-hover` → .ls-snav:hover(221) |
| `#EEF1F5` | 1 | L126 <aside> |  | 구현함 | src/app/demo/store/new-product/listing.css:29 `--ls-panel` → .ls-panel(720) (T098a: #EEF0F3→시안 값). 시험 `tests/unit/app-t098a-scenes.test.ts` "L126" |
| `#F1EFEA` | 3 | L151 <div> |  | 구현함 | src/app/demo/store/new-product/listing.css:41 `--ls-warm` → .ls-peak(480), .ls-bar(916), .ls-bf(1282) |
| `#F2B8AF` | 2 | L484 ~B1 |  | 구현함 | src/app/demo/store/new-product/listing.css:49 `--ls-t-b1` → 유형 B1(870), .ls-bar-ghost(930) |
| `#F3EBDD` | 1 | L67 <span> |  | 구현함 | src/app/demo/store/new-product/listing.css:57 `--ls-store-text` → .ls-store-logo(128) |
| `#F3F4F6` | 1 | L68 <label> |  | 구현함 | src/app/demo/store/new-product/listing.css:25 `--ls-field-bg` → .ls-search(155) |
| `#F3F5F9` | 1 | L35 .apib |  | 구현함 | src/app/demo/store/new-product/listing.css:59 `--ls-pill` → .ls-apib(632) |
| `#F5F9FF` | 4 | L52 .ins |  | 구현함 | src/app/demo/store/new-product/listing.css:12 `--ls-accent-pale` → .ls-ins(564), .ls-status(940), .ls-fix(1304), .ls-done-box(1392) |
| `#F6F7F9` | 3 | L47 .addph:hover |  | 구현함 | src/app/demo/store/new-product/listing.css:16 `--ls-bg` → 화면 바탕(.ls 6), .ls-addph:hover(417, T098a 추가), .ls-hero(1202) |
| `#FAFAFB` | 1 | L72 <nav> |  | 구현함 | src/app/demo/store/new-product/listing.css:18 `--ls-side` → .ls-side(194) |
| `#FBE7E4` | 1 | L108 span.chip |  | 구현함 | src/app/demo/store/new-product/listing.css:44 `--ls-risk-bg` → .ls-chip-gap(535) |
| `#FFFBFA` | 2 | L41 .fld.gap |  | 구현함 | src/app/demo/store/new-product/listing.css:45 `--ls-risk-field` → .ls-fld-gap(476), .ls-status.dirty(953) |
| `#FFFFFF` | 24 | L20 .b-black |  | 구현함 | src/app/demo/store/new-product/listing.css:17·63 → .ls-card, .ls-fld(읽기 전용 칸도 흰 바탕 — T098a에서 [readonly] 덧칠 지움), flashA/B 100%(502·510, T098a: transparent→#FFFFFF), src/app/demo/store/new-product/listing.css:33 focus 흰 고리. 시험 `tests/unit/app-t098a-scenes.test.ts` "L58·L59" |
| `linear-gradient(120deg,#002991 0%,#0066F5 55%,#60CDFF 100%)` | 1 | L43 .ai |  | 구현함 | src/app/demo/store/new-product/listing.css:544 .ls-ai (gap 4px — T098a 추가). 시험 `tests/unit/app-t098a-scenes.test.ts` "L42" |
| `linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF)` | 2 | L22 .b-ai |  | 구현함 | src/app/demo/store/new-product/listing.css:709 .ls-b-ai, src/app/demo/store/new-product/listing.css:1364 .ls-done-ic |
| `linear-gradient(90deg,#002991,#0066F5,#60CDFF)` | 2 | L522 ~background |  | 구현함 | src/app/demo/store/new-product/listing.css:963 .ls-prog-fill (모달 진행·Recalculate 진행 막대 둘 다) |
| `rgba(0,0,0,0.25)` | 2 | L30 .tipb |  | 구현함 | src/app/demo/store/new-product/listing.css:34 `--ls-shadow-tip` → .ls-tipb(811) 0 8px 24px, src/app/demo/store/new-product/listing.css:35 `--ls-shadow-sheet` → .ls-sheet(1014) 0 -12px 40px (T098a: --shadow-selected→시안 값). 시험 `tests/unit/app-t098a-scenes.test.ts` "시안 그림자" |
| `rgba(0,0,0,0.38)` | 1 | L176 <div> |  | 구현함 | src/app/demo/store/new-product/listing.css:61 `--ls-scrim` → .ls-scrim(1008) |
| `rgba(10,27,61,0.25)` | 1 | L49 .addic |  | 구현함 | src/app/demo/store/new-product/listing.css:36 `--ls-shadow-addic` → .ls-addic(431) 0 4px 10px (T098a 추가). 시험 `tests/unit/app-t098a-scenes.test.ts` "시안 그림자" |
| `rgba(255,255,255,0.85)` | 1 | L50 .phl |  | 구현함 | src/app/demo/store/new-product/listing.css:62 `--ls-ph-label` → .ls-phl(385) |
| `rgba(31,157,85,.18)` | 1 | L37 .livedot |  | 구현함 | src/app/demo/store/new-product/listing.css:37 `--ls-shadow-live` → .ls-livedot(649) box-shadow 0 0 0 3px (T098a: outline→시안 그림자). 시험 `tests/unit/app-t098a-scenes.test.ts` "시안 그림자" |

### 2. 모션·타이밍 (hover·focus 포함) (27행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `.addph:focus-within` | 1 | L48 | outline:2px solid #097FF5;outline-offset:2px | 구현함 | src/app/demo/store/new-product/listing.css:421 outline 2px solid #097FF5 offset 2px — src/app/demo/store/new-product/listing-view.tsx:236 label 안 파일 입력 (T098a: aria-disabled span→시안 label+input). 시험 `tests/unit/app-t098a-scenes.test.ts` "L93" |
| `.addph:hover` | 1 | L47 | border-color:#0A1B3D;background:#F6F7F9 | 구현함 | src/app/demo/store/new-product/listing.css:417 border-color #0A1B3D, background #F6F7F9 (T098a 추가). 시험 `tests/unit/app-t098a-scenes.test.ts` "L93" |
| `.b-black:hover` | 1 | L20 | background:#333333 | 구현함 | src/app/demo/store/new-product/listing.css:699 .ls-b-black:hover:not(:disabled) background #333333 |
| `.b-tint:hover` | 1 | L21 | background:#05378227 | 구현함 | src/app/demo/store/new-product/listing.css:706 background #05378227 |
| `.btn:focus-visible,.fld:focus-visible,.ins:focus-visible` | 1 | L38 | box-shadow:#FFFFFF 0 0 0 2px;outline:2px solid #097FF5;outline-offset:2px | 구현함 | src/app/demo/store/new-product/listing.css:95 box-shadow #FFFFFF 0 0 0 2px (T098a 추가) + src/app/demo/store/new-product/listing.css:90 outline 2px solid #097FF5 offset 2px. 시험 `tests/unit/app-t098a-scenes.test.ts` "L38" |
| `.snav:hover` | 1 | L33 | background:#EEF0F3 | 구현함 | src/app/demo/store/new-product/listing.css:221 background #EEF0F3 |
| `.tipw:hover .tipb,.tipw:focus-within .tipb` | 1 | L31 | display:block | 구현함 | src/app/demo/store/new-product/listing.css:829 display:block |
| `@keyframes flashA` | 1 | L58 | 0%{background:#E3F3FF}100%{background:#FFFFFF} | 구현함 | src/app/demo/store/new-product/listing.css:502 #E3F3FF → #FFFFFF (T098a: 끝 transparent→#FFFFFF). 시험 `tests/unit/app-t098a-scenes.test.ts` "L58·L59" |
| `@keyframes flashB` | 1 | L59 | 0%{background:#E3F3FF}100%{background:#FFFFFF} | 구현함 | src/app/demo/store/new-product/listing.css:510 #E3F3FF → #FFFFFF (T098a 고침). 시험 `tests/unit/app-t098a-scenes.test.ts` "L58·L59" |
| `@keyframes pl` | 1 | L27 | 0%,100%{opacity:.5;transform:scale(.92)}50%{opacity:1;transform:scale(1.06)} | 구현함 | src/app/demo/store/new-product/listing.css:664 @keyframes ls-pulse 0%,100% opacity .5·scale(.92) / 50% 1·scale(1.06). `tests/unit/app-t087-listing.test.ts` "시안 모션 값" |
| `@keyframes rise` | 1 | L56 | from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} | 구현함 | src/app/demo/store/new-product/listing.css:1040 @keyframes ls-rise |
| `@keyframes spin` | 1 | L25 | to{transform:rotate(360deg)} | 구현함 | src/app/demo/store/new-product/listing.css:1084 @keyframes ls-spin to rotate(360deg) |
| `@keyframes up` | 1 | L55 | from{transform:translate(-50%,100%)}to{transform:translate(-50%,0)} | 구현함 | src/app/demo/store/new-product/listing.css:1032 @keyframes ls-up translate(-50%,100%) → (-50%,0) |
| `animation: flashA 1.2s ease` | 1 | L60 .flA |  | 구현함 | src/app/demo/store/new-product/listing.css:518 .ls-flA (src/app/demo/store/new-product/listing-view.tsx:108, 넣기 뒤 칸 깜빡임) |
| `animation: flashB 1.2s ease` | 1 | L60 .flB |  | 구현함 | src/app/demo/store/new-product/listing.css:521 .ls-flB (src/app/demo/store/new-product/listing-view.tsx:108) |
| `animation: pl 1.2s ease-in-out infinite` | 1 | L26 .pulse |  | 구현함 | src/app/demo/store/new-product/listing.css:658 .ls-pulse-ic — src/app/demo/store/new-product/listing-view.tsx:440 점검 모달 회전 고리 가운데 그래프 아이콘(시안 L184 자리). T098a: 예전엔 .ls-livedot에 잘못 붙어 있던 것을 옮김. `tests/unit/app-t087-listing.test.ts` "시안 모션 값", 시험 `tests/unit/app-t098a-scenes.test.ts` "L183·L184" |
| `animation: rise .4s ease both` | 1 | L57 .rise |  | 구현함 | src/app/demo/store/new-product/listing.css:1050 .ls-rise (src/app/demo/store/new-product/listing-view.tsx:479 결과, src/app/demo/store/new-product/listing-view.tsx:597 완료 카드) |
| `animation: spin 1.2s linear infinite` | 1 | L24 .spin |  | 구현함 | src/app/demo/store/new-product/listing.css:1080 .ls-spin transform-origin 48px 48px |
| `animation: up .45s cubic-bezier(.2,1,.3,1)` | 1 | L54 .sheet |  | 구현함 | src/app/demo/store/new-product/listing.css:1014 .ls-sheet animation ls-up 0.45s cubic-bezier(0.2,1,0.3,1) |
| `setInterval 60` | 1 | L570 ~iv | recalc: () => { if (this.iv) clearInterval(this.iv); let n = 0; this.setState({ rprog: 1 }); this.iv = setInterval(() => { n = Math.min(500, n + 25); this.setS… | 구현함 | config/motion.json scene3.recalc = {intervalMs: 60, step: 25} (T098a: 70→시안 60) → src/app/demo/store/new-product/progress.ts paceFor('recalc'). 값은 config에서 읽는다(예외 "/demo/store/new-product 점검 진행 시간 config"의 기본값 = 시안 값). `tests/unit/app-t087-listing.test.ts` "진행 n은 step 결과 그대로" |
| `setInterval 70` | 1 | L465 ~iv | this.iv = setInterval(() => { n = Math.min(500, n + 5); this.setState({ prog: n }); if (n >= 500) { clearInterval(this.iv); this.iv = null; onDone(); } }, 70); | 구현함 | config/motion.json scene3.check = {intervalMs: 70, step: 5} → progress.ts paceFor('check'). `tests/unit/app-t087-listing.test.ts` "진행 n은 step 결과 그대로" |
| `transition: background-color .15s ease` | 1 | L18 .btn |  | 구현함 | src/app/demo/store/new-product/listing.css:676 .ls-btn transition background-color 0.15s ease |
| `transition: background-color .3s ease,transform .3s ease` | 1 | L523 ~border-radius |  | 구현함 | src/app/demo/store/new-product/listing.css:1153 .ls-cell (scale .7 → 1, src/app/demo/store/new-product/listing-view.tsx:460) |
| `transition: background-color .4s ease` | 1 | L508 ~border-radius |  | 구현함 | src/app/demo/store/new-product/listing.css:851 .ls-dot transition background-color 0.4s ease |
| `transition: border-color .15s,background-color .15s` | 1 | L46 .addph |  | 구현함 | src/app/demo/store/new-product/listing.css:398 .ls-addph (T098a 추가). 시험 `tests/unit/app-t098a-scenes.test.ts` "L93" |
| `transition: width .07s linear` | 1 | L522 ~background |  | 구현함 | src/app/demo/store/new-product/listing.css:963 .ls-prog-fill. `tests/unit/app-t087-listing.test.ts` "시안 모션 값" |
| `transition: width .5s ease` | 1 | L543 ~border-radius |  | 구현함 | src/app/demo/store/new-product/listing.css:934 .ls-bar-fill |

### 3. 누를 수 있는 것과 결과 상태 (13행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `onChange addPhoto` | 1 | L93 <input> | setState: userPhotos | 구현함 | src/app/demo/store/new-product/listing-view.tsx:236–246 파일 입력 → handlers.addPhoto → src/app/demo/store/new-product/listing-screen.tsx userPhotos(blob URL, 서버로 보내지 않음, 계산과 무관) → src/app/demo/store/new-product/listing-view.tsx:230 "Your photo" 사진 칸 (T098a 추가, 문구 config/listing.*.json `yours`). 시험 `tests/unit/app-t098a-scenes.test.ts` "L93" |
| `onChange on.from` | 1 | L102 input.fld | setState: f · 호출: setField | 구현함 | src/app/demo/store/new-product/listing-view.tsx:274 edit('from') → reducer. `tests/unit/app-t087-listing.test.ts` 흐름 시험 |
| `onChange on.title` | 1 | L97 input.fld | setState: f · 호출: setField | 구현함 | src/app/demo/store/new-product/listing-view.tsx:260 edit('title') |
| `onChange on.to` | 1 | L103 input.fld | setState: f · 호출: setField | 구현함 | src/app/demo/store/new-product/listing-view.tsx:278 edit('to') |
| `onChange x.on` | 1 | L109 textarea.{{x.cls}} | setState: f · 호출: setField | 구현함 | src/app/demo/store/new-product/listing-view.tsx:122 textarea edit(칸) → 결과판 "Changed — recalculate". `tests/unit/app-t087-listing.test.ts` 흐름 시험 |
| `onClick backEdit` | 1 | L268 button.btn | setState: calcF, calcPeak, screen | 구현함 | src/app/demo/store/new-product/listing-view.tsx:613 → reducer backEdit (상세로). `tests/unit/app-t087-listing.test.ts` 흐름 시험 |
| `onClick i.run` | 1 | L111 button.ins | setState: f, fl, flash, prog · 호출: insert | 구현함 | src/app/demo/store/new-product/listing-view.tsx:127 insert(fix) → reducer insert (칸 깜빡임 flA/flB). 넣는 글은 AI 고칠 문구(정직성 ⑤: 영어, 숫자 [__]). `tests/unit/app-t087-listing.test.ts` "AI 넣기(ok인 칸만)" |
| `onClick publish` | 1 | L119 button.btn | setState: basePeak, f, fl, flash, prog, screen · 호출: run | 구현함 | src/app/demo/store/new-product/listing-view.tsx:301 → 점검 모달 + 진행 (progress.ts). `tests/unit/app-t087-listing.test.ts` |
| `onClick publishAnyway` | 1 | L248 button.btn | setState: published, screen | 구현함 | src/app/demo/store/new-product/listing-view.tsx:578 → 완료 카드. `tests/unit/app-t087-listing.test.ts` |
| `onClick publishFinal` | 1 | L167 button.btn | setState: published, screen | 구현함 | src/app/demo/store/new-product/listing-view.tsx:404 → 완료 카드. `tests/unit/app-t087-listing.test.ts` |
| `onClick recalc` | 1 | L158 button.btn | setState: calcF, calcPeak, rprog · 호출: feats, peak | 구현함 | src/app/demo/store/new-product/listing-view.tsx:380 → recalc 진행 (config 60ms·+25). `tests/unit/app-t087-listing.test.ts` |
| `onClick restart` | 1 | L268 button.btn | setState: (함수형 setState) · 호출: fresh | 구현함 | src/app/demo/store/new-product/listing-view.tsx:616 → 처음 상태. `tests/unit/app-t087-listing.test.ts` |
| `onClick toDetail` | 1 | L249 button.btn | setState: calcF, calcPeak, rprog, screen | 구현함 | src/app/demo/store/new-product/listing-view.tsx:581 → 상세 (입력칸 + 결과판). `tests/unit/app-t087-listing.test.ts` |

### 4. 접힘·펼침 (14행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `rotate(360deg)` | 1 | L25 ~transform |  | 구현함 | src/app/demo/store/new-product/listing.css:1084 @keyframes ls-spin |
| `sc-if b.hasChip` | 1 | L202 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:486 기준 칸 "Includes Black Friday week" 칩 (.ls-chip-peak) |
| `sc-if isDetail` | 2 | L86 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:213 상세 머리글, src/app/demo/store/new-product/listing-view.tsx:637 상세 배치(.ls-layout-detail) + 결과판(model panel = screen 'detail') |
| `sc-if isDone` | 1 | L257 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx Done (model done = screen 'done'), src/app/demo/store/new-product/listing-view.tsx:597 완료 카드 |
| `sc-if isEdit` | 1 | L115 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:295 screen 'edit'·'sheet'일 때 Save draft·Publish 줄 |
| `sc-if isSheet` | 1 | L175 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:419–420 점검 모달 (model sheet = screen 'sheet') |
| `sc-if p.hasDelta` | 1 | L132 <sc-if> |  | 예외 | DECISIONS 11/11 22:55 예외 "데이터(엔진 숫자)": 시안 "−x pts" 칩(L132·L538)은 화면 코드가 두 확률을 빼서 만든다. 숫자 계산은 src/engine에서만(CLAUDE.md 공통 규칙)이고 엔진 결과에 그 차이 값이 없어 칩을 그리지 않는다 — 대신 "Before x%"(src/app/demo/store/new-product/listing-view.tsx:340)와 좋아진 확률 색 #002991(src/app/demo/store/new-product/listing.css:776). 보고서 "컨트롤 타워에 요청할 결정" 1 |
| `sc-if p.running` | 1 | L160 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:384 Recalculate 진행 막대 |
| `sc-if sh.peak` | 1 | L228 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:534 Black Friday 배송 안내 (문구는 정직성 ③ 숫자 없음) |
| `sc-if sh.ready` | 1 | L198 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:426 kind 'ready' 결과 (.ls-rise) |
| `sc-if sh.running` | 1 | L180 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:426 kind 'running' 진행 (회전 고리·단계·칸·막대) |
| `sc-if showEditor` | 1 | L82 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:637 screen ≠ 'done'일 때 편집기 |
| `sc-if x.hasGap` | 1 | L108 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:111 "Missing: …" 칩 + src/app/demo/store/new-product/listing-view.tsx:119 .ls-fld-gap (src/app/demo/store/new-product/listing.css:476) |
| `sc-if x.hasIns` | 1 | L110 <sc-if> |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:124 상세에서 빠진 칸마다 넣기 버튼 — AI 고칠 문구가 준비된 것만(src/app/demo/store/new-product/model.ts inserts, 정직성 ⑤). `tests/unit/app-t087-listing.test.ts` "AI 넣기(ok인 칸만)" |

### 5. 조건부 스타일 (17행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `B1: x.color ? 0.45 : 0.3` | 1 | L419 ~B1 |  | 예외 | DECISIONS 11/11 22:55 예외 "데이터(엔진 숫자)": 시안 화면 코드 안 계산 계수(이길 확률). 앱 계수는 src/engine/listing.ts + config/listing-model.json에서만 (화면은 옮기기만) |
| `LANG === 'ko' ? '%p' : ' pts'` | 1 | L538 ~LANG |  | 예외 | DECISIONS 11/11 22:55 예외 "데이터(엔진 숫자)": "−x pts" 확률 차이 칩(p.hasDelta)의 단위 — 칩과 같은 이유로 없음. 고칠 점 줄의 같은 단위는 구현함(config/listing.*.json probCut "chance −{{x}} pts"/"%p") |
| `at[i] ? TC[at[i]] : (gap \|\| '#D9DCE0')` | 1 | L508 ~background |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:81 .ls-dot + 유형 색(src/app/demo/store/new-product/listing.css:858–885), 빈 점 #D9DCE0(src/app/demo/store/new-product/listing.css:851) |
| `cur.cntK[k] < base.cntK[k] - 0.02 ? '#0066F5' : TC[k]` | 1 | L543 ~background |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:372 .ls-bar-fill.down(src/app/demo/store/new-product/listing.css:937 #0066F5) / 유형 색 — 내려갔는지는 model.ts types.down(엔진 결과 비교) |
| `cur.disputes < base.disputes - 0.05 ? '#002991' : '#C4321F'` | 1 | L537 ~color |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:333 .ls-big.good(src/app/demo/store/new-product/listing.css:776, T098a: #0066F5→시안 #002991) / .ls-big(#C4321F). 시험 `tests/unit/app-t098a-scenes.test.ts` "L126" |
| `dirty ? '#9E2414' : '#002991'` | 1 | L545 ~color |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:378 .ls-status.dirty(src/app/demo/store/new-product/listing.css:953) / .ls-status(src/app/demo/store/new-product/listing.css:940) |
| `i / N * 500 < s.prog ? 'background:#9AA0A6;transform:scale(1)' : 'background:#EEF0F2;transform:scale(.7)'` | 1 | L523 ~transition |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:460 .ls-cell.on(src/app/demo/store/new-product/listing.css:1163) / .ls-cell(src/app/demo/store/new-product/listing.css:1153) |
| `i < step ? '#0066F5' : i === step ? '#000000' : '#9AA0A6'` | 2 | L521 ~color |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:450 .ls-step.done/now/todo(src/app/demo/store/new-product/listing.css:1128–1135, 굵기 now만 700). 1~3단계는 엔진이 만들 때 끝내 done (model.ts:341) |
| `i ? 'border-left:1px solid #E4E6E9' : ''` | 1 | L518 ~padding |  | 구현함 | src/app/demo/store/new-product/listing.css:1190 .ls-basis-cell + .ls-basis-cell border-left 1px |
| `improved ? '#002991' : '#C4321F'` | 1 | L555 ~color |  | 구현함 | .ls-done-prob.good(src/app/demo/store/new-product/listing.css:1410, T098a: #0066F5→#002991) / .ls-done-prob(src/app/demo/store/new-product/listing.css:1401). 시험 `tests/unit/app-t098a-scenes.test.ts` "L126" |
| `layoutSt: isDetail ? 'display:grid;grid-template-columns:minmax(0,6fr) minmax(0,5fr);gap:24px;align-items:start;max-width:1320px;margin:0 auto;padding:18px 32px 48px'` | 1 | L564 ~layoutSt |  | 구현함 | src/app/demo/store/new-product/listing.css:285 .ls-layout-detail / src/app/demo/store/new-product/listing.css:277 .ls-layout (960px 한 줄) |
| `peak ? 'background:#E3F3FF;color:#002991' : 'background:#F1EFEA;color:#3F4144'` | 1 | L561 ~white-space |  | 구현함 | .ls-peak.on(src/app/demo/store/new-product/listing.css:491) / .ls-peak(src/app/demo/store/new-product/listing.css:480) |
| `showGap ? ' gap' : ''` | 1 | L495 ~cls |  | 구현함 | src/app/demo/store/new-product/listing-view.tsx:119 .ls-fld-gap(src/app/demo/store/new-product/listing.css:476) |
| `statusBg: dirty ? '#FFFBFA' : '#F5F9FF'` | 1 | L544 ~statusBg |  | 구현함 | .ls-status.dirty(src/app/demo/store/new-product/listing.css:953) / .ls-status(src/app/demo/store/new-product/listing.css:940) |
| `x.color ? 0.45 : 1` | 1 | L417 ~B1 |  | 예외 | DECISIONS 11/11 22:55 예외 "데이터(엔진 숫자)": 시안 화면 코드 안 발생 배수. 앱은 src/engine/listing.ts listingRates + config/listing-model.json |
| `x[k] ? '#002991' : '#0066F5'` | 1 | L550 ~color |  | 구현함 | .ls-check-s.on(src/app/demo/store/new-product/listing.css:1003) / .ls-check-s(src/app/demo/store/new-product/listing.css:999) |
| `x[k] ? 'background:#0066F5;color:#FFFFFF' : 'background:#FFFFFF;color:#9AA0A6;box-shadow:inset 0 0 0 2px #CFD3D8'` | 1 | L549 ~flex-shrink |  | 구현함 | .ls-check-ic.on(src/app/demo/store/new-product/listing.css:994) / .ls-check-ic(src/app/demo/store/new-product/listing.css:980, T098a: border→시안 inset 그림자 src/app/demo/store/new-product/listing.css:40). 시험 `tests/unit/app-t098a-scenes.test.ts` "시안 그림자" |
