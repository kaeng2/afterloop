# T107 보고 (2026-11-12 10:20)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / (이 보고서 커밋. 바로 앞 구현 커밋 `fff7b83`)

## 결과
완료 (화면 위쪽부터 아래쪽까지 한 바퀴). 시안 `Desk.dc.html` L16–L93 `<style>`을 `src/app/(app)/desk.css`에 그대로 복사하고(선택자 앞에 `.dk `만 붙였다), 화면 루트 `.dk`에 시안 L96 값을 두었다. 시안 인라인 style 값은 앱 요소 class 규칙으로 옮겼다(같은 파일 2부, 줄마다 시안 줄 번호 주석). 동작·서버 액션·관문·Simulated는 바꾸지 않았다. 개발 서버를 돌리지 않아서 **그림은 보지 못했다** — 픽셀 비교는 컨트롤 타워 몫으로 남긴다.

## 방법 (그림 비교할 때 읽을 것)
- **범위 묶기**: 규칙은 모두 `.dk …` 또는 `body:has(.dk) …` 아래에 있다(시험으로 확인). 위쪽 막대·토스트는 `.dk` 밖에 그려져서 `body:has(.dk)`로 바꿨다. → `/products`·`/intro`·`/listing`에는 영향이 없다. desk.css는 `src/app/(app)/page.tsx`에서만 import한다.
- **keyframes 이름**은 시안 그대로(`pop`·`ndot`·`rise`·`ping`·`flash`). 전역 이름이다. scene3 시안 `rise`는 Desk와 같은 값이라 겹쳐도 같다. T108/T109가 다른 값의 `pop`·`ping`·`flash`를 만들면 충돌하니 병합 때 확인해 달라.
- **글꼴 이름**만 바꿨다: 시안 `Figtree, 'Noto Sans KR'` → next/font 변수 `var(--font-figtree), var(--font-noto-kr)` (같은 글꼴, 이름이 빌드 때 바뀌기 때문). 1부 L93 `.ko` 규칙은 그대로 두고 2부에서 같은 선택자로 변수 글꼴을 다시 정했다.
- **em 크기**: 루트가 16→15px가 되어 em으로 정한 크기(제목 1.5em 등)가 줄어들어서, 시안 px 값으로 다시 정했다.
- **앱 클래스 이름을 지우지 않았다**: 정적 시험 100여 개가 앱 클래스 이름을 고정하고 있고, 이름을 바꾸면 다른 레인(T108/T109)과 같은 시험 파일에서 충돌이 커진다. 시안 클래스는 **뒤에 덧붙였다**(아래 대응표 "붙인 시안 클래스"). 덧붙이지 않은 요소는 앱 클래스에 시안 값을 `.dk` 규칙으로 줬다(우선순위가 높아 옛 규칙을 덮는다). 옛 규칙은 지우지 않았다 — 다른 화면(견본 `/preview`, `/cases/…` 옛 주소)이 쓰기 때문.

## 시안 클래스 ↔ 앱 요소 대응표

| 시안 (줄) | 앱 요소 (파일) | 붙인 시안 클래스 | 값 출처 |
|---|---|---|---|
| `.dk` 루트 (L96) | `<div class="dk today-page">` (`(app)/page.tsx`) | `dk` | 2부 `.dk{…}` |
| header (L99–L105) | `.shell-bar` · `.shell-bar-inner` · `.shell-wordmark(-accent/-curve)` · `.shell-divider` · `.shell-for` · `.shell-date` (`_shared/top-bar.tsx`) | — | `body:has(.dk) …` (L99 padding 12px 28px · gap 14px 24px · z 6 · 로고 22px #0B0F14/#0070E0 · 밑줄 그라데이션 `#dlg-desk` · 알약 13px · 날짜 13px) |
| 상품 줄 section (L109, L116) | `.product-filter` · `.product-filter-list` · `.product-filter-summary` | — | L109 gap 10px · padding 14px 28px, 목록 padding 0, 요약 13px |
| `.pf` / `.pf.on` (L31–L32, L111) | `.product-filter-chip` (`today/product-filter.tsx`) | `pf`, `on` | 1부 |
| `.ptile` (L33, L112, L142, L162) | `.product-tile` (`_shared/product-icon.tsx`) | `ptile` | 1부 + 2부 크기(36/38/52, svg 22/24/30, stroke 1.6/1.5) |
| 칩 배지 (L687 badgeSt) | `.product-tile-badge` | — | 2부 (20px · 11px 900 · 2px #FFF) |
| `.sev` (L41, L142) | `.product-tile-dot` | `sev` | 1부 + L705 sevCol |
| aside (L122) / main (L155) | `.today-list` / `.today-detail` | — | flex 1 1 360px · max 400 · min 300 / flex 999 1 640px · gap 18px (휴대폰 폭은 앱 추가) |
| 이번 주 카드 (L124–L135, L698) | `.weekly*` (`today/today-list.tsx`) + AI 알약 추가 | — | 제목 16px 700, 칸 라벨 11px #C9E3FF, 값 24px 900, sub 11px 700 #C9E3FF / bump #60CDFF |
| flash/rise 번갈아 (L700) | `WeeklyBumpCell` (`today/savings.tsx`) | `weekly-cell-flash` / `weekly-cell-rise` | 홀수 bump = flash, 짝수 = rise |
| `.sec` · `.sech` (L35–L36, L138–L139) | `.today-group` · `.today-group-head` (`today/today-groups.tsx`) | `sec`, `sech` | 1부 + 제목 15px 700 · 힌트 12px |
| `.it` / `.it.on` / `.it.done` (L37–L40, L141–L146) | `.today-item` | `it`, `on`, `done` | 1부 + 주문 14px 700, 상품 14px #3F4144, due 12px, who 12px #6C7378 |
| `.chip` (L24, L145 catSt) | `.today-pill` | `chip` | 1부 + L704 catSt |
| 머리글 (L160–L167) | `.case-head*` · `.case-title` · `.case-meta` (`cases/view/case-view.tsx`) | — | h1 24px 900 -0.4px lh 1.5, 메타 14px |
| `.chip.c-bad` / `.c-n` / `.c-blue` (L25) | `.desk-chip` · `.desk-chip-bad` · **`.desk-chip-blue`(새)** | — | 2부 (진행 칸 "Sent customs ID" = c-blue, L768) |
| 곡선 카드 (L170–L193, L748) | `.curve-card` · `.curve-*` (`cases/view/risk-curve.tsx`) | — | 라벨 13px, 큰 % 44px, sub 12px, fromTo 12px 700; 점·ping transition 없음 (L181 polyline만) |
| History (L197–L219, L752) | `.history-*` (`cases/view/case-history.tsx`) | `hbtn` (보기 단추) | 점줄 선 min-width 6px, 점 margin-top 6px, 글 14px #000, 단추 13px gap 6 transition 없음 |
| `.zone-buyer` · `.bub-in` · `.ko` (L43–L44, L93, L222–L231, L759) | `.case-conversation` · `.case-bubble` · `.case-bubble-original` · `.case-read-label` (`cases/view/conversation.tsx`) | `zone-buyer` | 원문 15px #000 Noto Sans KR, sub 12px, AI read 11px 900 |
| `.zone-work` (L47–L48, L239) | `.work` (`cases/view/case-view.tsx`) · `.zone-work` (`today/work-card.tsx`) | `zone-work` | 1부 + 머리 부제 13px, 머리 AI 알약만 그림자 |
| `.stp` `.rail` `.nstep` `.rline` `.stpc` `.stph` (L49–L56) | `.desk-step` · `.desk-rail` · `.desk-step-num` · `.desk-rail-line` · `.desk-step-body` · `.desk-step-head` | `rail`, `nstep`, `rline`, `stpc` | 1부 + 제목 17px 900 -0.2px, sub 13px |
| `.npath` (L68–L71, L248–L251, L781) | `.choice` · `.choice-button` (`cases/view/choice-cards.tsx`) | — | 제목 14px 1.3, how 12px 1.35, Chargeback % 900, 타이핑 중 opacity .6 |
| `.btn.b-tint.b-sm` (L18–L22, L263–L265, L339) | `.desk-button-tint` (답장 도구 3개 · Replay) | `btn`, `b-tint`, `b-sm` | 1부 (13px) |
| `.editor` · textarea · pill (L57–L59, L271–L272, L840) | `.reply-editor` · `.reply-textarea` · `.reply-editor-pill` | — | 글 15px 1.55 #000, 알약 bottom 12px 13px 900 |
| `.tray` · `.tsum` · `.gchip` (L60–L67, L275–L283) | `.reply-tray-*` · `.reply-tray-sum` · `.reply-chip(-good)` | — | 머리 12px, tsum 11px, 칩 2px 9px gap 4 |
| 미리보기 칸 (L293) | `.reply-box` · `.reply-box-title` · `.reply-outgoing` | — | 제목 12px 700, 본문 14px Noto Sans KR |
| 예상 반응 · 기분 (L295–L302, L843–L844) | `.reaction*` (`cases/reply/reply-panel.tsx`) | — | 머리 [제목 … 비용 · Assumption] 왼쪽/오른쪽, 범례 % #000 (cb≥.5 빨강), 기분 22px 700 lh 1.2, now 11px |
| Send `.btn.b-black` (L305) | `.reply-button` | — | 15px · border 0 · gap 8 · 44px |
| 다른 항목 (L345–L356) | `.work-detail` · `.work-head*` · `.zone-work-title/-body` · `.tracking-button` (`today/work-card.tsx`) | — | h1 24px 900(상품 이름 포함 전부 900), who 14px, 제목 20px, 설명 15px, 버튼 `.btn.b-black` |
| `.toast` (L92, L362) | `.savings-toast` (`today/savings.tsx`, `.dk` 밖) | — | `body:has(.dk)` (루트 글자 15px 포함) |

## 시안과 다르게 남긴 곳 (예외 목록)
- **예외 목록(22:55·v2.15 결정) 그대로**: 오른쪽 위 "Public demo · simulated sends"·PayPal activity·EN/한국어·판매자 칩 / 탭 없음 / 이번 주 카드 숫자·부제("What's on your desk")·Demo data·Assumption 배지 / 사건 번호·날짜·곡선 값 등 엔진·실제 데이터 / Simulated 표시 / 통관번호 가림 / 약속 금지(Refund backup·Expected delivery 없음) / Send 뒤 단계(Forward to carrier)·결과 상자 없음 / 고친 글 Translate & check.
- **카드사 문구 강조(`.case-mark`)**: 시안에 없지만 사람 결정 2026-11-10 v2.10 ①("카드사에 이의제기" 강조)이라 남겼다. 22:55 "기준은 시안 파일"이 이것을 덮는지는 컨트롤 타워 판단.
- **머리글 상태 꼬리 " · Waiting for your reply"**: 시안 L165에 없어서 화면에서는 숨기고 화면 읽기 글자로만 남겼다(`.dk .case-status` = sr-only).
- **제목 태그**: 시안 `<h1>` / 앱 `<h2>`(목록 위 숨은 h1 "Today"가 이미 있음). 크기·굵기·행간은 시안 값.
- **"Her …" 대명사**: v2.15 이름 결정으로 `{{name}}'s mood next`, `Edit freely — {{name}}'s reaction updates as you type` (이름 없으면 "Mood next"/"…the reaction…"). KO는 시안 DI.ko 그대로.
- **글꼴 이름**: next/font 변수 (위 "방법").
- **휴대폰 폭**: 56rem 아래 옆 여백 16px·왼쪽 칸 폭 제한 없음 (앱 추가, 시안은 1440 고정).
- **감속 모드**: `prefers-reduced-motion`이면 `.dk` 안 애니메이션·전환을 끈다 (앱 추가).

## 차이 목록(inbox/2026-11-12-desk-diff.md) 대조
이 작업으로 맞춘 줄: ①1·2·3·4·6·7·8·9·10·12·13(크기)·17·21·23·27·29·31·32·37·39·41·42 / ②1·2(행간)·4·5·19·20·29·31·34·42·45·46·48·50·52·17 / ③1·3·5·6·11·12·13·20·21·27·28·31·35·56·60·62·63·64·71 / ④22.
이미 앞 태스크(T104–T106)로 고쳐져 있던 것(코드로 확인): ①16(sticky 없음)·18·19·22·33·47 / ②10·11(곡선 x 고정 칸)·22(빈 글 "if no reply") / ③36·37(✓ 칩 바탕·띄움)·69(빈 글 이유 없음).
**남은 것 (이번에 안 함)**:
- ①35·36·27(④): bump 때 앞 3칸 숫자·깜빡임, 누적 "+$N" — 숫자는 데이터 예외, 3칸 깜빡임은 진행 칸 끝(`cprog-flash`)에만 있음. ④25 토스트 2번(Send 즉시 + 끝날 때), ④28 깜빡임 2번 — 동작 변경이라 손대지 않음.
- ①45·47: Done 이동·항목 고르기 서버 왕복 차이(T106에서 고르기는 화면 안으로 바뀜, Done 이동은 서버 응답 뒤 그대로).
- ②7 KO 머리글 이름(라틴 이름), ②36 EN 화면 기록 줄의 한국어 원문, ②41 KO 요약 영어 — 데이터·AI 출력이라 그대로.
- ②13·30 곡선·점줄 색 규칙 — T105가 같은 tone을 넘기게 고쳤다고 주석에 있으나 그림으로 확인 못 함.
- ③41·43·47 특징 이름·noRefund 감지·bad 줄 %p 부호 — 엔진·계약 쪽(아래 결정 요청).
- ③65 "now: Angry" 대문자, ③67 실시간 경고 글(날짜·금액·약속) — 문구·동작 추가라 안 함.
- ④ Send 뒤 나머지(제목·단계·결과 상자 등)는 예외 목록.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/(app)/desk.css` (새) | 1부 시안 `<style>` 복사(줄 번호 주석, `.dk` 아래) + 2부 루트·인라인 값 |
| `src/app/(app)/page.tsx` | 루트 `dk` 클래스, desk.css import |
| `src/app/_shared/top-bar.tsx` | 밑줄 그라데이션 `<defs>` (색은 desk.css, Desk에서만) |
| `src/app/_shared/product-icon.tsx` | `ptile`·`sev` 클래스 |
| `src/app/_shared/copy.ts` | `currentLocale()` (화면 언어 읽기, 새 함수) |
| `src/app/today/product-filter.tsx` · `today-groups.tsx` · `today-list.tsx` · `savings.tsx` | 시안 클래스(`pf on`·`sec`·`sech`·`it on done`·`chip`), 이번 주 카드 AI 알약, flash/rise 번갈아 |
| `src/app/cases/view/case-view.tsx` · `conversation.tsx` · `case-history.tsx` · `choice-cards.tsx` | `zone-work`·`zone-buyer`·`hbtn`·`rail`·`nstep`·`rline`·`stpc`; 한국어 화면 말풍선은 날짜만 |
| `src/app/cases/reply/reply-panel.tsx` | `rail`·`nstep`·`stpc`·`btn b-tint b-sm`; 기분 라벨·편집 부제에 이름 |
| `src/app/cases/progress/case-progress.tsx` | Replay `btn b-tint b-sm`, 시뮬레이션 답장 첫 태그 c-blue |
| `config/copy.en.json` · `copy.ko.json` | 시안 문구 (아래), 새 키 `case.reply.editSubUnknown`·`case.reaction.moodNextUnknown` (en/ko 둘 다, 키 집합 같음) |
| `tests/unit/app-t107.test.ts` (새) | 시안 블록 그대로·루트 값·범위·import 자리, 한국어 화면 말풍선 |
| `tests/unit/app-shared-design.test.ts` | B-1(색 변수만)·B-3(그림자 변수만)에서 `(app)/desk.css` 제외 (`MOCKUP_COPIES`) — 09:25 결정 "토큰으로 옮기지 않는다"와 정면으로 부딪히기 때문. 값이 시안에 있는지는 app-t107이 본다 |
| `tests/unit/app-today.test.ts` · `app-t102.test.ts` · `app-t106.test.ts` | 정적 마크업 기대의 class 문자열만 시안 클래스 포함으로 (동작 기대는 그대로) |
| `reports/design-match/inventory.md` | Desk 로고 색 4행 (`#0B0F14`·`#0070E0`·`#003087`·`#00A8EA`) 예외 → 구현함 |

문구 (en = 시안 DI.en, ko = DI.ko): `case.view.conversationSub` "Original, in {{language}} · AI translation below" / "원문({{language}})"; `case.choice.cost` "cost ~{{amount}}" / "비용 ~{{amount}}"; `case.reply.placeholder` "Type a reply in any language…"; `case.reply.editSub`; `case.reaction.moodNext`; KO 히스토리 "이 건의 히스토리"·"{{count}}개 이벤트 · {{days}}일"·"히스토리 보기/접기"·"히스토리 요약:"; KO bump "+{{amount}} 방금". 약속·근거 없는 숫자는 넣지 않았다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (+9 skip) | 0 | |
| npm test | 2558 | 1 | `storefront.test.ts` 결정론 100회 — 전체 병렬 실행 때만 시간 초과. 따로 돌리면 `storefront`+`sim` 72/72 통과 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | 빌드 CSS에 `body:has(.dk)`·`@keyframes pop` 그대로 남는 것 확인 |

## 남은 문제
- 그림을 보지 못했다(개발 서버 금지). 특히 확인할 곳: 위쪽 막대 높이(오른쪽 서랍·언어·판매자 칩 때문에 53px보다 클 수 있음), 왼쪽 칸 360px, 이번 주 카드 머리(AI 알약 + Demo data 함께), 곡선 카드 44px 숫자 줄바꿈, 반응 칸 머리 정렬.
- `app-shared-design.test.ts`는 T108/T109도 같은 이유로 고칠 가능성이 높다 — 병합 때 `MOCKUP_COPIES`에 `intro/…`·`listing/…`을 합치면 된다.
- 옛 CSS 규칙(today.css·case.css·reply.css·shell.css)은 지우지 않았다. `.dk` 규칙이 덮는다. 견본·옛 주소 화면이 같은 클래스를 써서다.

## 컨트롤 타워에 요청할 결정
- ③47 bad 줄 %p 부호(시안 "+17 pts" = 이 문장이 위험을 올림 / 앱 "−8 pts")와 ③43 noRefund 감지는 엔진(`src/engine/forecast.ts`)·계약 쪽이라 ui 레인에서 고치지 않았다. 바꿀지 결정이 필요하다.
- 카드사 문구 강조(v2.10 ①)를 시안 기준으로 뺄지.
