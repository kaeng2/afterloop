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
| `#000000` | 23 | L20 .b-black |  |  |  |
| `#000000A1` | 1 | L27 .nav |  |  |  |
| `#001C64` | 1 | L124 <section> |  |  |  |
| `#002991` | 23 | L25 .c-blue |  |  |  |
| `#003087` | 1 | L101 <stop> |  |  |  |
| `#0066F5` | 11 | L26 .ai |  |  |  |
| `#0070E0` | 2 | L101 <span> |  |  |  |
| `#00A8EA` | 1 | L101 <stop> |  |  |  |
| `#05378214` | 2 | L21 .b-tint |  |  |  |
| `#05378227` | 1 | L21 .b-tint:hover |  |  |  |
| `#097FF5` | 3 | L23 .btn:focus-visible,.it:focus-visible,.pf:focus-visible,.npa… |  |  |  |
| `#0A1B3D` | 12 | L49 .nstep |  |  |  |
| `#0B0F14` | 1 | L101 <span> |  |  |  |
| `#0B48C4` | 1 | L124 <section> |  |  |  |
| `#333333` | 1 | L20 .b-black:hover |  |  |  |
| `#3F4144` | 25 | L25 .c-n |  |  |  |
| `#60CDFF` | 7 | L26 .ai |  |  |  |
| `#6C7378` | 22 | L56 .stph .sub |  |  |  |
| `#99C2FF` | 1 | L775 ~refund |  |  |  |
| `#9AA0A6` | 9 | L32 .pf:hover |  |  |  |
| `#9E2414` | 7 | L25 .c-bad |  |  |  |
| `#C4321F` | 13 | L76 .nic-bad |  |  |  |
| `#C9E3FF` | 4 | L125 <span> |  |  |  |
| `#CFD3D8` | 9 | L52 .rline |  |  |  |
| `#E3F3FF` | 5 | L25 .c-blue |  |  |  |
| `#E4E6E9` | 20 | L31 .pf |  |  |  |
| `#E8796B` | 2 | L78 .nmini.ghost |  |  |  |
| `#ECEEF0` | 3 | L25 .c-n |  |  |  |
| `#EEF1F5` | 1 | L43 .zone-buyer |  |  |  |
| `#F1EFEA` | 6 | L33 .ptile |  |  |  |
| `#F3F5F9` | 1 | L69 .npath.on |  |  |  |
| `#F5F7FB` | 1 | L39 .it:hover |  |  |  |
| `#F5F9FF` | 3 | L32 .pf.on |  |  |  |
| `#F6F7F9` | 5 | L36 .sech |  |  |  |
| `#FBE7E4` | 5 | L25 .c-bad |  |  |  |
| `#FFFFFF` | 45 | L20 .b-black |  |  |  |
| `linear-gradient(120deg,#002991 0%,#0066F5 55%,#60CDFF 100%)` | 1 | L26 .ai |  |  |  |
| `linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF)` | 2 | L805 ~color |  |  |  |
| `linear-gradient(120deg,#E3F3FF,#F5F9FF)` | 1 | L851 ~resKey |  |  |  |
| `linear-gradient(150deg,#001C64 0%,#002991 55%,#0B48C4 100%)` | 1 | L124 <section> |  |  |  |
| `linear-gradient(90deg,#002991,#0066F5,#60CDFF)` | 1 | L48 .zone-work::before |  |  |  |
| `rgba(0,0,0,0.05)` | 2 | L44 .bub-in |  |  |  |
| `rgba(0,0,0,0.25)` | 1 | L92 .toast |  | 예외 | T067 사람 결정(그림자는 --shadow-selected 하나, tests/unit/app-shared-design) — 토스트는 src/app/cases/progress/case-progress.css .cprog-toast box-shadow: var(--shadow-selected). 나머지 토스트 값(#000·#60CDFF 원·16px·14px 20px·bottom 28px)은 그대로 |
| `rgba(0,102,245,0.35)` | 1 | L26 .ai |  |  |  |
| `rgba(0,41,145,0.10)` | 1 | L47 .zone-work |  |  |  |
| `rgba(196,50,31,0.08)` | 1 | L179 <polygon> |  |  |  |
| `rgba(255,255,255,0.08)` | 1 | L128 div.{{d.cls}} |  |  |  |

### 2. 모션·타이밍 (hover·focus 포함) (40행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `.b-black:hover` | 1 | L20 | background:#333333 |  |  |
| `.b-tint:hover` | 1 | L21 | background:#05378227 |  |  |
| `.btn:focus-visible,.it:focus-visible,.pf:focus-visible,.npath:focus-visible,.nmini:focus-visible,.ndraft:focus-visible,.hbtn:focus-visible,.nav:focus-visible` | 1 | L23 | box-shadow:#FFFFFF 0 0 0 2px;outline:2px solid #097FF5;outline-offset:2px |  |  |
| `.editor:focus-within` | 1 | L59 | box-shadow:#FFFFFF 0 0 0 2px,#097FF5 0 0 0 4px |  |  |
| `.gmore:focus-visible` | 1 | L66 | outline:2px solid #097FF5;outline-offset:2px |  |  |
| `.gmore:hover` | 1 | L65 | background:#E4E6E9 |  |  |
| `.hbtn:hover` | 1 | L81 | border-color:#000000 |  |  |
| `.it:hover` | 1 | L39 | background:#F5F7FB |  |  |
| `.nav:hover` | 1 | L29 | color:#000000 |  |  |
| `.npath:hover` | 1 | L69 | border-color:#6C7378 |  |  |
| `.pf:hover` | 1 | L32 | border-color:#9AA0A6 |  |  |
| `@keyframes flash` | 1 | L90 | 0%{background:#60CDFF}100%{background:transparent} | 구현함 | src/app/cases/progress/case-progress.css @keyframes cprog-flash (#60cdff → transparent), "이번 주" 카드 숫자 칸 3개에 붙임 (src/app/cases/progress/case-progress.tsx). tests/unit/app-t092.test.ts |
| `@keyframes ndot` | 1 | L85 | 0%,80%,100%{opacity:.3;transform:none}40%{opacity:1;transform:translateY(-3px)} | 구현함 | src/app/cases/progress/case-progress.css @keyframes cprog-ndot (같은 값). tests/unit/app-t092.test.ts |
| `@keyframes ping` | 1 | L88 | 0%{r:7;opacity:.6}100%{r:20;opacity:0} |  |  |
| `@keyframes pop` | 1 | L63 | 0%{opacity:0;transform:scale(.7)}100%{opacity:1;transform:none} |  |  |
| `@keyframes rise` | 1 | L86 | from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} | 구현함 | Send 뒤 칸: src/app/cases/progress/case-progress.css @keyframes cprog-rise (같은 값) — 단계·말풍선. 토스트는 가운데 맞춤을 지키는 cprog-toast-rise(같은 이동 + translateX(-50%)) |
| `animation-delay: ' + (n * 0.12) + 's'` | 1 | L838 ~st |  |  |  |
| `animation-delay: .15s` | 1 | L84 .ndots span:nth-child(2) |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-dots span:nth-child(2) animation-delay: var(--cprog-dot-stagger) = config/motion.json caseProgress.typingDot.stagger 0.15s |
| `animation-delay: .3s` | 1 | L84 .ndots span:nth-child(3) |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-dots span:nth-child(3) calc(var(--cprog-dot-stagger) * 2) = 0.3s |
| `animation: flash 1.6s ease` | 1 | L91 .flash |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-flash animation: cprog-flash var(--cprog-flash) = config/motion.json caseProgress.flash 1.6s ease. tests/unit/app-t092.test.ts |
| `animation: ndot 1s infinite ease-in-out` | 1 | L84 .ndots span |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-dots span = config/motion.json caseProgress.typingDot 1s ease-in-out infinite. tests/unit/app-t092.test.ts |
| `animation: ping 1.4s ease-out infinite` | 1 | L89 .ping |  |  |  |
| `animation: pop .45s cubic-bezier(.2,1.4,.4,1) both` | 1 | L62 .gchip |  |  |  |
| `animation: rise .35s ease` | 1 | L92 .toast |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-toast = config/motion.json caseProgress.toast 0.35s ease. tests/unit/app-t092.test.ts |
| `animation: rise .35s ease both` | 1 | L87 .rise |  | 구현함 | Send 뒤 말풍선(bub-out·typing·bub-sim): src/app/cases/progress/case-progress.css .cprog-bubble-wrap = config/motion.json caseProgress.bubble 0.35s ease both |
| `animation: rise .3s ease both` | 1 | L73 .nlint |  |  |  |
| `animation: rise .45s cubic-bezier(.2,1.2,.4,1) both` | 1 | L82 .step |  | 구현함 | src/app/cases/progress/case-progress.css .cprog-step = config/motion.json caseProgress.step. tests/unit/app-t092.test.ts |
| `later 1300 * (k - 1) + 400` | 1 | L666 ~ | this.later(() => { | 구현함 | src/app/cases/progress/progress-model.ts stepDelayMs(k) = stepMs·(k−1)+firstStepMs (config/motion.json caseProgress 1300·400). 손님 답장 k=2 → 1700ms, 전달 뒤 세관 통과는 stepMs. 예외(DECISIONS 22:55): k=3 Auto 대신 [Forward to carrier]에서 멈춤. tests/unit/app-t092.test.ts |
| `later 3000` | 1 | L638 ~id | toast(txt) { this.setState({ toast: txt }); const id = txt; this.later(() => { if (this.state.toast === id) this.setState({ toast: null }); }, 3000); } | 구현함 | src/app/cases/progress/case-progress.tsx 토스트 3초 뒤 사라짐 = config/motion.json caseProgress.toast.hideMs 3000. tests/unit/app-t092.test.ts |
| `setInterval 34` | 1 | L652 ~iv | this.iv = setInterval(() => { |  |  |
| `setTimeout ms` | 1 | L637 later(fn, ms) | later(fn, ms) { this.tm = (this.tm \|\| []).concat([setTimeout(fn, ms)]); } | 구현함 | src/app/cases/progress/case-progress.tsx later(fn, ms) — 타이머를 모아 Replay·떠날 때 모두 지운다 (시안 this.tm). prefers-reduced-motion이면 0ms |
| `transition: all .3s ease` | 1 | L181 <polyline> |  |  |  |
| `transition: background-color .15s` | 1 | L37 .it |  |  |  |
| `transition: background-color .15s ease` | 1 | L18 .btn |  |  |  |
| `transition: background-color .3s ease` | 1 | L840 ~pointer-events |  |  |  |
| `transition: border-color .15s,background-color .15s` | 1 | L68 .npath |  |  |  |
| `transition: border-color .3s ease` | 1 | L57 .editor |  |  |  |
| `transition: color .3s ease` | 2 | L748 ~font-variant-numeric |  |  |  |
| `transition: transform .2s ease` | 2 | L829 ~display |  |  |  |
| `transition: width .35s ease` | 1 | L776 ~height |  |  |  |

### 3. 누를 수 있는 것과 결과 상태 (13행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `onChange onType` | 1 | L271 <textarea> | setState: draft, path |  |  |
| `onClick clear` | 1 | L265 button.btn | setState: draft, path |  |  |
| `onClick it.pick` | 1 | L141 button.{{it.cls}} | setState: busy, draft, path, sel, sku · 호출: typeOut |  |  |
| `onClick l.act` | 1 | L278 button.{{l.actCls}} | (정의 못 찾음) |  |  |
| `onClick oc.run` | 1 | L354 button.btn | setState: dash, done, flash · 호출: bump |  |  |
| `onClick p.pick` | 2 | L111 button.{{p.cls}} | setState: busy, draft, path, sel, sku · 호출: typeOut |  |  |
| `onClick refundNow` | 1 | L324 button.btn | setState: cbDone, dash, done, flash · 호출: bump | 예외 | DECISIONS 22:55 안전장치·약속: 'cb' 결과 분기 없음 — 보낼 수 있는 글은 검사 통과한 AI 초안뿐(editGate), 환불 실행·"POST …/refund · 201" 줄 없음 (쓰기 0회) |
| `onClick replay` | 1 | L339 button.btn | setState: cbDone, done, draft, path, phase, shown, typing | 구현함 | src/app/cases/progress/case-progress.tsx [Replay this case] → 타이머 지움 + 답장 칸 처음(again() + AI 초안), 곡선 값 되돌림. tests/unit/app-t092.test.ts |
| `onClick rushed` | 1 | L263 button.btn | setState: busy, draft, path · 호출: typeOut |  |  |
| `onClick send` | 1 | L305 button.btn | setState: cbDone, dash, done, flash, out, phase, refundNowF, sentKo, sentP, sentTxt, shown, typing · 호출: blocked, bump, fc, send | 구현함 | Send 뒤 (T092 몫): reply-panel.tsx 전환 지점 한 곳(sendState done && ok) → CaseProgress (phase 'sent', shown 1, typing). 예외: out 'refund'·'cb' 분기·dash bump 고정 숫자 없음 (데이터·안전장치), 대시보드 숫자는 엔진 actionSavings 토스트만. Send 버튼·관문 자체는 T090/T091 |
| `onClick toggleGoods` | 1 | L283 button.gmore | setState: goodsOpen |  |  |
| `onClick toggleHist` | 1 | L202 button.hbtn | setState: histOpen |  |  |
| `onClick useAi` | 1 | L264 button.btn | setState: busy, draft, path · 호출: typeOut |  |  |

### 4. 접힘·펼침 (34행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `aria-expanded {{goodsOpen}}` | 1 | L283 button.gmore |  |  |  |
| `aria-expanded {{histOpen}}` | 1 | L202 button.hbtn |  |  |  |
| `more/less .gmore` | 4 | L64 ~ |  |  |  |
| `more/less .less` | 1 | L838 ~goodsLabel |  |  |  |
| `more/less .more` | 1 | L838 ~less |  |  |  |
| `more/less gmore` | 2 | L65 ~ |  |  |  |
| `more/less less` | 3 | L406 ~more |  |  |  |
| `more/less more` | 2 | L406 ~sumOk |  |  |  |
| `rotate(180deg)` | 2 | L829 ~transform |  |  |  |
| `sc-if goodsOpen` | 1 | L285 <sc-if> |  |  |  |
| `sc-if h.hasFlag` | 1 | L210 <sc-if> |  |  |  |
| `sc-if hasGoods` | 1 | L280 <sc-if> |  |  |  |
| `sc-if histOpen` | 1 | L204 <sc-if> |  |  |  |
| `sc-if isOther` | 1 | L345 <sc-if> |  |  |  |
| `sc-if isSeo` | 1 | L157 <sc-if> |  |  |  |
| `sc-if isTyping` | 1 | L234 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx Bubbles: state.typing일 때 "<이름> is typing" + 점 세 개. tests/unit/app-t092.test.ts |
| `sc-if l.hasAct` | 1 | L278 <sc-if> |  |  |  |
| `sc-if lintEmpty` | 1 | L276 <sc-if> |  |  |  |
| `sc-if m.hasTags` | 1 | L231 <sc-if> |  |  |  |
| `sc-if m.isSim` | 1 | L227 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx 손님 답장 말풍선 "Simulated reply" 머리 + 점선 테두리(.cprog-bubble-sim). tests/unit/app-t092.test.ts |
| `sc-if notSent` | 1 | L238 <sc-if> |  | 구현함 | reply-panel.tsx 전환 지점 + src/app/cases/progress/case-progress.css .work:has(.cprog) — 보낸 뒤 "지금 대응" 머리 줄·선택지 카드·답장 칸을 숨긴다 |
| `sc-if p.hasCase` | 1 | L112 <sc-if> |  |  |  |
| `sc-if p.rec` | 1 | L249 <sc-if> |  |  |  |
| `sc-if resOn` | 1 | L330 <sc-if> |  | 예외 | DECISIONS 22:55 데이터: 결과 상자("5 days · $0 lost", "23 days · 4 messages", "−$82")는 근거 없는 성과 숫자라 없음. 끝은 엔진 actionSavings 토스트 + 카드 flash |
| `sc-if risk.hasFrom` | 1 | L191 <sc-if> |  |  |  |
| `sc-if s.act` | 1 | L324 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx [Forward to carrier] 대기 줄(시안 act 줄 모양 '!' #FBE7E4) — 판매자가 누를 때까지 멈춤 (DECISIONS 22:55). 시안의 cb "Refund now" 용도는 예외(refundNow 행) |
| `sc-if s.auto` | 1 | L321 <sc-if> |  | 예외 | DECISIONS 22:55 Send 이후: "Auto" 없음 → [Forward to carrier] 승인 버튼, 배송사 연동·"POST carrier/… 200"·추적 동기화 줄 없음. tests/unit/app-t092.test.ts |
| `sc-if s.hasP` | 1 | L321 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx 단계 칩 "Risk N%" = 엔진 scenarioRisk (보낸 답장 줄은 시안처럼 없음) + 머리 Assumption. tests/unit/app-t092.test.ts |
| `sc-if sent` | 1 | L313 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx CaseProgress 칸 (AI 알약 + 제목 "What happens next · Simulated" — DECISIONS 22:55 제목 예외) |
| `sc-if showKo` | 1 | L293 <sc-if> |  |  |  |
| `sc-if stepsRunning` | 1 | L328 <sc-if> |  | 구현함 | src/app/cases/progress/progress-model.ts progressRunning (끝나지 않았고 Forward 대기도 아닐 때) → src/app/cases/progress/case-progress.css .cprog-running 점 세 개 (padding-left 46px). tests/unit/app-t092.test.ts |
| `sc-if toastOn` | 1 | L361 <sc-if> |  | 구현함 | src/app/cases/progress/case-progress.tsx 토스트 (document.body로, role=status, "Dashboard updated · +$N kept", N = actionSavings). tests/unit/app-t092.test.ts |
| `state goodsOpen` | 8 | L283 button.gmore |  |  |  |
| `state histOpen` | 12 | L202 button.hbtn |  |  |  |

### 5. 조건부 스타일 (28행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `/\\+/.test(d.sub) ? '#60CDFF' : '#C9E3FF'` | 1 | L698 ~color |  |  |  |
| `c.empty ? '#CFD3D8' : fc.p.cb >= 0.5 ? '#E8796B' : '#0A1B3D'` | 2 | L837 ~border-color |  |  |  |
| `draftGrid: LANG === 'en' ? 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px' : 'display:grid;grid-template-columns:minmax(0,1fr);gap:12px'` | 1 | L836 ~LANG |  |  |  |
| `fc.mood >= -0.5 ? '#000000' : '#C4321F'` | 1 | L844 ~color |  |  |  |
| `fc.p.cb >= 0.5 ? '#C4321F' : '#0A1B3D'` | 1 | L840 ~background |  |  |  |
| `fn riskCol: p >= 0.5 ? '#C4321F' : p >= 0.2 ? '#000000' : '#0066F5'` | 1 | L747 ~ |  |  |  |
| `i.risk === 'high' ? 'background:#FBE7E4;color:#9E2414' : 'background:#ECEEF0;color:#3F4144'` | 1 | L704 ~risk |  |  |  |
| `k === 'cb' && fc.p.cb >= 0.5 ? '#C4321F' : '#000000'` | 1 | L843 ~k |  |  |  |
| `kind === 'bad' ? ' ghost' : ''` | 1 | L788 ~kind |  |  |  |
| `kind === 'bad' ? '#C4321F' : '#0A1B3D'` | 1 | L787 ~kind |  |  |  |
| `line: i === 0 ? 'display:none' : 'flex:1;height:2px;background:#E4E6E9;min-width:6px'` | 1 | L752 ~i |  |  |  |
| `lineSt: isLast ? 'display:none' : 'flex:1;width:2px;min-height:14px;background:#CFD3D8;margin:4px 0'` | 1 | L807 ~lineSt |  | 구현함 | src/app/cases/progress/case-progress.tsx row.last면 줄 없음, src/app/cases/progress/case-progress.css .cprog-line 같은 값 |
| `n === 0 ? 'No cases' : n + (n === 1 ? ' case' : ' cases')` | 1 | L372 ~n |  |  |  |
| `n === 1 ? ' case' : ' cases'` | 1 | L372 ~n |  |  |  |
| `p >= 0.5 ? '#C4321F' : p >= 0.2 ? '#000000' : '#0066F5'` | 2 | L747 ~riskCol |  |  |  |
| `pSt: st.p !== null && st.p >= 0.5 ? 'background:#FBE7E4;color:#9E2414' : 'background:#E3F3FF;color:#002991'` | 1 | L808 ~pSt |  | 구현함 | src/app/cases/progress/progress-model.ts riskHigh (p ≥ 0.5, 그림 기준) → src/app/cases/progress/case-progress.css .cprog-chip / .cprog-chip-high 같은 색 |
| `pf[k].p.cb >= 0.5 ? '#C4321F' : '#0A1B3D'` | 1 | L781 ~color |  |  |  |
| `resBg: resKey === 'cb' ? '#FBE7E4' : 'linear-gradient(120deg,#E3F3FF,#F5F9FF)'` | 1 | L851 ~resKey |  | 예외 | DECISIONS 22:55 데이터: 결과 상자 없음 (resOn 행과 같은 이유) |
| `resKey === 'cb' ? '#9E2414' : '#002991'` | 1 | L851 ~resKey |  | 예외 | DECISIONS 22:55 데이터: 결과 상자 없음 (resOn 행과 같은 이유) |
| `s.done[i.id] ? ' done' : ''` | 1 | L709 ~sel |  |  |  |
| `s.done[i.id] ? '#CFD3D8' : sevCol[i.risk]` | 1 | L708 ~background |  |  |  |
| `s.goodsOpen ? 'transform:rotate(180deg)' : ''` | 1 | L838 ~transition |  |  |  |
| `s.histOpen ? 'transform:rotate(180deg)' : ''` | 1 | L829 ~transition |  |  |  |
| `s.path === k ? ' on' : ''` | 2 | L780 ~path |  |  |  |
| `s.sel === i.id ? ' on' : ''` | 1 | L709 ~sel |  |  |  |
| `s.sku === p.sku ? ' on' : ''` | 1 | L686 ~sku |  |  |  |
| `same ? '' : 'color:#6C7378'` | 1 | L841 ~font-size |  |  |  |
| `st.buyer ? '#F1EFEA;color:#000000' : st.auto ? 'linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF);color:#FFFFFF' : st.act ? '#FBE7E4;color:#9E2414' : '#002991;color:#FFFFFF'` | 3 | L805 ~bg |  |  |  |

## docs/design/mockup-v4/scene1/Scene1.dc.html

### 1. 색 토큰 (25행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `#000000` | 15 | L20 .tab.on |  |  |  |
| `#002991` | 3 | L20 .tab.on |  |  |  |
| `#0066F5` | 4 | L18 .pp a |  |  |  |
| `#00A8EA` | 1 | L55 <path> |  |  |  |
| `#097FF5` | 1 | L27 .al-icon:focus-visible,.btn:focus-visible,.tab:focus-visibl… |  |  |  |
| `#0B0F14` | 1 | L26 .al-icon |  |  |  |
| `#333333` | 1 | L23 .b-black:hover |  |  |  |
| `#3F4144` | 15 | L19 .tab |  |  |  |
| `#60CDFF` | 2 | L64 <span> |  |  |  |
| `#9E2414` | 7 | L96 span.chip |  |  |  |
| `#C4321F` | 2 | L51 span.chip |  |  |  |
| `#C9D3E0` | 1 | L174 ~i |  |  |  |
| `#CFD3D8` | 1 | L24 .b-line |  |  |  |
| `#E4E6E9` | 2 | L21 .card |  |  |  |
| `#ECEEF0` | 1 | L44 span.chip |  |  |  |
| `#F1EFEA` | 4 | L32 .row |  |  |  |
| `#F2B8AF` | 1 | L95 section.card |  |  |  |
| `#FBE7E4` | 1 | L96 span.chip |  |  |  |
| `#FFFFFF` | 15 | L21 .card |  |  |  |
| `linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF)` | 1 | L104 a.btn |  |  |  |
| `linear-gradient(120deg,#0066F5,#60CDFF)` | 1 | L64 <span> |  |  |  |
| `rgba(0,0,0,0.25)` | 1 | L62 div.rise |  |  |  |
| `rgba(0,102,245,.55)` | 1 | L28 ~box-shadow |  |  |  |
| `rgba(0,102,245,0)` | 1 | L28 100% |  |  |  |
| `rgba(0,112,224,0.45)` | 1 | L26 .al-icon |  |  |  |

### 2. 모션·타이밍 (hover·focus 포함) (6행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `.al-icon:focus-visible,.btn:focus-visible,.tab:focus-visible,.rlink:focus-visible` | 1 | L27 | box-shadow:#FFFFFF 0 0 0 2px;outline:2px solid #097FF5;outline-offset:2px |  |  |
| `.b-black:hover` | 1 | L23 | background:#333333 |  |  |
| `@keyframes pulse` | 1 | L28 | 0%{box-shadow:0 0 0 0 rgba(0,102,245,.55)}100%{box-shadow:0 0 0 16px rgba(0,102,245,0)} |  |  |
| `@keyframes rise` | 1 | L30 | from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} |  |  |
| `animation: pulse 1.6s ease-out infinite` | 1 | L29 .pulse |  |  |  |
| `animation: rise .5s ease both .3s` | 1 | L31 .rise |  |  |  |

### 3. 누를 수 있는 것과 결과 상태 (0행)

_(없음)_

### 4. 접힘·펼침 (3행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `rotate(45deg)` | 1 | L63 <span> |  |  |  |
| `state alOpen` | 4 | L54 a.al-icon |  |  |  |
| `state rcOpen` | 3 | L96 ~color |  |  |  |

### 5. 조건부 스타일 (1행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `i === SALES.length - 1 ? '#0066F5' : '#C9D3E0'` | 1 | L174 ~i |  |  |  |

## docs/design/mockup-v4/scene3/Main.dc.html

### 1. 색 토큰 (48행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `#000000` | 7 | L20 .b-black |  |  |  |
| `#002991` | 16 | L22 .b-ai |  |  |  |
| `#0066F5` | 14 | L22 .b-ai |  |  |  |
| `#00A8EA` | 3 | L75 <path> |  |  |  |
| `#05378214` | 1 | L21 .b-tint |  |  |  |
| `#05378227` | 1 | L21 .b-tint:hover |  |  |  |
| `#097FF5` | 2 | L38 .btn:focus-visible,.fld:focus-visible,.ins:focus-visible |  |  |  |
| `#0A1B3D` | 3 | L46 .addph |  |  |  |
| `#0B0F14` | 5 | L30 .tipb |  |  |  |
| `#1F3A2E` | 1 | L67 <span> |  |  |  |
| `#1F9D55` | 1 | L37 .livedot |  |  |  |
| `#333333` | 1 | L20 .b-black:hover |  |  |  |
| `#3F4144` | 18 | L29 .tipq |  |  |  |
| `#60CDFF` | 6 | L22 .b-ai |  |  |  |
| `#6C7378` | 13 | L67 <span> |  |  |  |
| `#7A1A0F` | 1 | L484 ~A1 |  |  |  |
| `#99C2FF` | 1 | L52 .ins |  |  |  |
| `#9AA0A6` | 5 | L46 .addph |  |  |  |
| `#9E2414` | 2 | L108 span.chip |  |  |  |
| `#C4321F` | 5 | L207 <span> |  |  |  |
| `#CFD3D8` | 3 | L40 .fld |  |  |  |
| `#D9DCE0` | 1 | L508 ~background |  |  |  |
| `#E3E7EC` | 2 | L69 <span> |  |  |  |
| `#E3F3FF` | 4 | L58 ~background |  |  |  |
| `#E4E6E9` | 16 | L29 .tipq |  |  |  |
| `#E8796B` | 2 | L41 .fld.gap |  |  |  |
| `#EEF0F2` | 1 | L523 ~background |  |  |  |
| `#EEF0F3` | 1 | L33 .snav:hover |  |  |  |
| `#EEF1F5` | 1 | L126 <aside> |  |  |  |
| `#F1EFEA` | 3 | L151 <div> |  |  |  |
| `#F2B8AF` | 2 | L484 ~B1 |  |  |  |
| `#F3EBDD` | 1 | L67 <span> |  |  |  |
| `#F3F4F6` | 1 | L68 <label> |  |  |  |
| `#F3F5F9` | 1 | L35 .apib |  |  |  |
| `#F5F9FF` | 4 | L52 .ins |  |  |  |
| `#F6F7F9` | 3 | L47 .addph:hover |  |  |  |
| `#FAFAFB` | 1 | L72 <nav> |  |  |  |
| `#FBE7E4` | 1 | L108 span.chip |  |  |  |
| `#FFFBFA` | 2 | L41 .fld.gap |  |  |  |
| `#FFFFFF` | 24 | L20 .b-black |  |  |  |
| `linear-gradient(120deg,#002991 0%,#0066F5 55%,#60CDFF 100%)` | 1 | L43 .ai |  |  |  |
| `linear-gradient(120deg,#002991,#0066F5 60%,#60CDFF)` | 2 | L22 .b-ai |  |  |  |
| `linear-gradient(90deg,#002991,#0066F5,#60CDFF)` | 2 | L522 ~background |  |  |  |
| `rgba(0,0,0,0.25)` | 2 | L30 .tipb |  |  |  |
| `rgba(0,0,0,0.38)` | 1 | L176 <div> |  |  |  |
| `rgba(10,27,61,0.25)` | 1 | L49 .addic |  |  |  |
| `rgba(255,255,255,0.85)` | 1 | L50 .phl |  |  |  |
| `rgba(31,157,85,.18)` | 1 | L37 .livedot |  |  |  |

### 2. 모션·타이밍 (hover·focus 포함) (27행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `.addph:focus-within` | 1 | L48 | outline:2px solid #097FF5;outline-offset:2px |  |  |
| `.addph:hover` | 1 | L47 | border-color:#0A1B3D;background:#F6F7F9 |  |  |
| `.b-black:hover` | 1 | L20 | background:#333333 |  |  |
| `.b-tint:hover` | 1 | L21 | background:#05378227 |  |  |
| `.btn:focus-visible,.fld:focus-visible,.ins:focus-visible` | 1 | L38 | box-shadow:#FFFFFF 0 0 0 2px;outline:2px solid #097FF5;outline-offset:2px |  |  |
| `.snav:hover` | 1 | L33 | background:#EEF0F3 |  |  |
| `.tipw:hover .tipb,.tipw:focus-within .tipb` | 1 | L31 | display:block |  |  |
| `@keyframes flashA` | 1 | L58 | 0%{background:#E3F3FF}100%{background:#FFFFFF} |  |  |
| `@keyframes flashB` | 1 | L59 | 0%{background:#E3F3FF}100%{background:#FFFFFF} |  |  |
| `@keyframes pl` | 1 | L27 | 0%,100%{opacity:.5;transform:scale(.92)}50%{opacity:1;transform:scale(1.06)} |  |  |
| `@keyframes rise` | 1 | L56 | from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none} |  |  |
| `@keyframes spin` | 1 | L25 | to{transform:rotate(360deg)} |  |  |
| `@keyframes up` | 1 | L55 | from{transform:translate(-50%,100%)}to{transform:translate(-50%,0)} |  |  |
| `animation: flashA 1.2s ease` | 1 | L60 .flA |  |  |  |
| `animation: flashB 1.2s ease` | 1 | L60 .flB |  |  |  |
| `animation: pl 1.2s ease-in-out infinite` | 1 | L26 .pulse |  |  |  |
| `animation: rise .4s ease both` | 1 | L57 .rise |  |  |  |
| `animation: spin 1.2s linear infinite` | 1 | L24 .spin |  |  |  |
| `animation: up .45s cubic-bezier(.2,1,.3,1)` | 1 | L54 .sheet |  |  |  |
| `setInterval 60` | 1 | L570 ~iv | recalc: () => { if (this.iv) clearInterval(this.iv); let n = 0; this.setState({ rprog: 1 }); this.iv = setInterval(() => { n = Math.min(500, n + 25); this.setS… |  |  |
| `setInterval 70` | 1 | L465 ~iv | this.iv = setInterval(() => { n = Math.min(500, n + 5); this.setState({ prog: n }); if (n >= 500) { clearInterval(this.iv); this.iv = null; onDone(); } }, 70); |  |  |
| `transition: background-color .15s ease` | 1 | L18 .btn |  |  |  |
| `transition: background-color .3s ease,transform .3s ease` | 1 | L523 ~border-radius |  |  |  |
| `transition: background-color .4s ease` | 1 | L508 ~border-radius |  |  |  |
| `transition: border-color .15s,background-color .15s` | 1 | L46 .addph |  |  |  |
| `transition: width .07s linear` | 1 | L522 ~background |  |  |  |
| `transition: width .5s ease` | 1 | L543 ~border-radius |  |  |  |

### 3. 누를 수 있는 것과 결과 상태 (13행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `onChange addPhoto` | 1 | L93 <input> | setState: userPhotos |  |  |
| `onChange on.from` | 1 | L102 input.fld | setState: f · 호출: setField |  |  |
| `onChange on.title` | 1 | L97 input.fld | setState: f · 호출: setField |  |  |
| `onChange on.to` | 1 | L103 input.fld | setState: f · 호출: setField |  |  |
| `onChange x.on` | 1 | L109 textarea.{{x.cls}} | setState: f · 호출: setField |  |  |
| `onClick backEdit` | 1 | L268 button.btn | setState: calcF, calcPeak, screen |  |  |
| `onClick i.run` | 1 | L111 button.ins | setState: f, fl, flash, prog · 호출: insert |  |  |
| `onClick publish` | 1 | L119 button.btn | setState: basePeak, f, fl, flash, prog, screen · 호출: run |  |  |
| `onClick publishAnyway` | 1 | L248 button.btn | setState: published, screen |  |  |
| `onClick publishFinal` | 1 | L167 button.btn | setState: published, screen |  |  |
| `onClick recalc` | 1 | L158 button.btn | setState: calcF, calcPeak, rprog · 호출: feats, peak |  |  |
| `onClick restart` | 1 | L268 button.btn | setState: (함수형 setState) · 호출: fresh |  |  |
| `onClick toDetail` | 1 | L249 button.btn | setState: calcF, calcPeak, rprog, screen |  |  |

### 4. 접힘·펼침 (14행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `rotate(360deg)` | 1 | L25 ~transform |  |  |  |
| `sc-if b.hasChip` | 1 | L202 <sc-if> |  |  |  |
| `sc-if isDetail` | 2 | L86 <sc-if> |  |  |  |
| `sc-if isDone` | 1 | L257 <sc-if> |  |  |  |
| `sc-if isEdit` | 1 | L115 <sc-if> |  |  |  |
| `sc-if isSheet` | 1 | L175 <sc-if> |  |  |  |
| `sc-if p.hasDelta` | 1 | L132 <sc-if> |  |  |  |
| `sc-if p.running` | 1 | L160 <sc-if> |  |  |  |
| `sc-if sh.peak` | 1 | L228 <sc-if> |  |  |  |
| `sc-if sh.ready` | 1 | L198 <sc-if> |  |  |  |
| `sc-if sh.running` | 1 | L180 <sc-if> |  |  |  |
| `sc-if showEditor` | 1 | L82 <sc-if> |  |  |  |
| `sc-if x.hasGap` | 1 | L108 <sc-if> |  |  |  |
| `sc-if x.hasIns` | 1 | L110 <sc-if> |  |  |  |

### 5. 조건부 스타일 (17행)

| 값 | 횟수 | 첫 자리 | 내용 | 상태 | 근거 |
|---|---|---|---|---|---|
| `B1: x.color ? 0.45 : 0.3` | 1 | L419 ~B1 |  |  |  |
| `LANG === 'ko' ? '%p' : ' pts'` | 1 | L538 ~LANG |  |  |  |
| `at[i] ? TC[at[i]] : (gap \|\| '#D9DCE0')` | 1 | L508 ~background |  |  |  |
| `cur.cntK[k] < base.cntK[k] - 0.02 ? '#0066F5' : TC[k]` | 1 | L543 ~background |  |  |  |
| `cur.disputes < base.disputes - 0.05 ? '#002991' : '#C4321F'` | 1 | L537 ~color |  |  |  |
| `dirty ? '#9E2414' : '#002991'` | 1 | L545 ~color |  |  |  |
| `i / N * 500 < s.prog ? 'background:#9AA0A6;transform:scale(1)' : 'background:#EEF0F2;transform:scale(.7)'` | 1 | L523 ~transition |  |  |  |
| `i < step ? '#0066F5' : i === step ? '#000000' : '#9AA0A6'` | 2 | L521 ~color |  |  |  |
| `i ? 'border-left:1px solid #E4E6E9' : ''` | 1 | L518 ~padding |  |  |  |
| `improved ? '#002991' : '#C4321F'` | 1 | L555 ~color |  |  |  |
| `layoutSt: isDetail ? 'display:grid;grid-template-columns:minmax(0,6fr) minmax(0,5fr);gap:24px;align-items:start;max-width:1320px;margin:0 auto;padding:18px 32px 48px'` | 1 | L564 ~layoutSt |  |  |  |
| `peak ? 'background:#E3F3FF;color:#002991' : 'background:#F1EFEA;color:#3F4144'` | 1 | L561 ~white-space |  |  |  |
| `showGap ? ' gap' : ''` | 1 | L495 ~cls |  |  |  |
| `statusBg: dirty ? '#FFFBFA' : '#F5F9FF'` | 1 | L544 ~statusBg |  |  |  |
| `x.color ? 0.45 : 1` | 1 | L417 ~B1 |  |  |  |
| `x[k] ? '#002991' : '#0066F5'` | 1 | L550 ~color |  |  |  |
| `x[k] ? 'background:#0066F5;color:#FFFFFF' : 'background:#FFFFFF;color:#9AA0A6;box-shadow:inset 0 0 0 2px #CFD3D8'` | 1 | L549 ~flex-shrink |  |  |  |
