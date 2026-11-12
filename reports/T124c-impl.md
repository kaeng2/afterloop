# T124c 보고 (2026-11-12 22:00)

- 기준 SPEC: v2.16 (시작할 때 SPEC.md 첫 줄 `SPEC v2.16 (2026-11-12 20:40 KST)`과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-scenes / (이 보고서 커밋 — `git log -1 lane/ui-scenes`). 코드 커밋 `f8d5120`
- 입력: `reports/design-match/v6/round2/` (커밋하지 않음)

## 결과
일부 완료. 범위 안의 "설명 없음" 줄을 하나씩 시안 소스(`docs/design/mockup-v6/Desk.dc.html`)와 대조했다. **실제 차이 6개는 시안 값으로 고쳤다.** 나머지 대부분은 **도구가 시안 쪽을 잘못 재는 줄**(아래 "도구 문제" A)이라 앱을 고치면 오히려 시안과 달라진다. 이 줄들은 도구를 고치거나 예외로 처리해야 한다. 데이터 차이(아래 C)는 내 파일 범위 밖이라 고치지 않았다.

### 고친 것 (모두 시안 CSS 값 그대로)
| # | 상태 | 요소 | 시안 | 고치기 전 앱 | 고친 곳 |
|---|---|---|---|---|---|
| 1 | initial · show-history · respond-now | 구매자 메시지 "AI read" 태그 (`Threatens chargeback`·`Angry`) | v6 L50 `.zone-buyer .c-bad{background:#FFF;color:#9E2414;box-shadow:inset 0 0 0 1px #F2B8AF}` · `.c-n` 흰 바탕 + `#CFD3D8` 테두리 | 분홍·회색으로 채운 칩 (`.zone-buyer` 덮어쓰기가 없었음) | desk.css `.case-conversation .desk-chip(-bad)` |
| 2 | initial | 꺼짐 상태 "Your reply" 카드 위쪽 | v6 L324 section은 `.zone-work`가 아님 → 그라데이션 띠 없음 | case.css `.work::before` 4px 띠가 보임 (스크린샷 y≈948의 파란 선) | desk.css `.work.work-simple::before{content:none}` |
| 3 | initial | `button\|Send` x 1316 vs 1239 | v6 L327 힌트 … [Send] 한 줄, Send는 오른쪽 끝 | reply.css `.reply-send`의 `flex-direction:column`이 남아 Send가 "Simulated send" 글자 아래 가운데에 놓임 | desk.css `.reply-simple-foot .reply-send{flex-direction:row;…}` (전송 모드 글자 = 예외 LAB-03은 Send 왼쪽, 꺼짐 이유는 아래 줄) |
| 4 | 전 상태 | `span\|AI#2`·`#3` border-radius 1000 vs 999 | v6 L26 `.ai` 1000px | globals `.ai-pill` 999px | desk.css `.case-page .ai-pill, .oc .ai-pill` (사건 상세·한 장 카드 안만. 왼쪽 이번 주 카드 `span\|AI`는 다른 세션 범위라 손대지 않음) |
| 5 | initial · show-history | `span\|AI#2` line-height 18 vs 18.6 | v6 L216 알약은 `<p>`(1.55) 밖 형제 → 1.5 | 요약 줄 1.55를 물려받음 | desk.css `.history-summary .ai-pill{line-height:1.5}` |
| 6 | all-products__1029 (+ 지호 offer 카드) | `button\|Refund $24` x 1269 vs 1103 | v6 L476 버튼이 줄 오른쪽 끝 | "Simulated · no money moved"가 버튼 **뒤**에 있어 버튼이 왼쪽으로 밀림 | `demo-item-card.tsx`·`offer-work.tsx`: 전송 모드 글자를 버튼 **앞**으로 (글자·관문·Simulated·쓰기 0 그대로, children 자리 고정 Fragment) |

동작·관문·Simulated·쓰기 0 변경 없음. 렌더 루프 없음 (CSS와 JSX 순서만).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/(app)/desk.css` | 맨 끝 "T124c" 절 9줄 (위 1–5) |
| `src/app/today/demo-item-card.tsx` | Lena 카드 Simulated 글자를 버튼 앞으로 (위 6) |
| `src/app/today/offer-work.tsx` | 제안 카드 전송 모드 글자를 버튼 앞으로 (위 6) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 182 (9 skip) | 0 | |
| npx vitest run tests/unit | 2749 | 4 | 모두 시간 시험: `sim.test.ts` 50ms 성능·100회, `storefront.test.ts` 100회 — 전체 병렬 실행에서만 시간 초과. 혼자 돌리면 sim 41/41, storefront 31/31 통과 (이 작업 파일 아님) |
| npx tsc --noEmit | 0 오류 | | |
| npm run lint | 0 오류 | | 경고 5 (기존) |
| npm run build | 성공 | | |

실제 AI·PayPal 호출 0, 개발 서버 실행 없음, `.env` 읽지 않음. 도구 재실행은 개발 서버가 필요해 하지 않았다 → **"설명 없음" 개수는 컨트롤 타워가 다시 돌려 확인해야 한다.**

## 남은 문제

### A. 도구 문제 — 시안 `span.sc-interp` (가장 큰 덩어리, 앱으로 고치면 안 됨)
시안 런타임(`docs/design/mockup-v6/support.js`)은 `{{…}}` 값마다 **스타일 없는 `<span class="sc-interp">`**를 만든다. 도구(`scripts/design-diff/page-scripts.ts` CAPTURE)는 "자기 글자가 있는 요소"만 잡으므로, 시안 쪽은 이 안쪽 span을 재고 **실제로 스타일이 걸린 부모(`.chip`, `<b>`, `<h1>`, 인라인 style span)는 자기 글자가 없어 아예 잡히지 않는다.** 그래서 생기는 줄:
- 칩·알약 줄 (`Not received · Customs hold#2`, `Threatens chargeback`, `Angry`, `Refund promised#2`, `Asks for refund`, `Waiting` …): 시안 값이 bg 투명·padding 0·radius 0·width = 앱 − 18px. 실제 시안 칩은 `.chip` padding 2px 9px·radius 1000px로 앱과 같다.
- 높이 14 vs 18, 15 vs 19.5, 13 vs 16.5 와 그에 따른 y −2px (`Dispute risk`, `if no reply by Nov 14`, `Original, in Korean …`, `AI read`, `German`, `DisputeLess did each step …`, 기록 날짜 `Oct 19`…`Nov 5`와 그 padding 1px·width 64): 시안 쪽이 인라인 span 글자 상자, 앱은 블록 줄 상자.
- 한 장 카드 단계 글 `padding 0 vs 2px 0 0`·y −4: 시안 L459 `<span style="padding-top:2px">` 그대로 앱과 같다 (안쪽 span을 잰 것).
- 시안에만 `span|Case history`·`span|Buyer messages`·`span|Your reply`·`span|Show history`·`span|History summary:`·`heading|#1042 ·`·`span|$72`… ↔ 앱에만 `heading|Case history`·`heading|Buyer messages`·`strong|History summary:`… : 같은 글자인데 시안은 안쪽 span, 앱은 제목 요소라 짝이 안 맞음.

→ **제안 (도구, scripts/ — 컨트롤 타워/다른 레인)**: CAPTURE에서 `span.sc-interp`의 글자를 부모의 자기 글자로 합치고 `sc-interp` 자체는 건너뛰기 (`__ddOwn`이 자식 `.sc-interp`의 글자를 더하게). 이것만으로 범위 안 "설명 없음" 줄 대부분이 사라질 것으로 본다. 도구를 못 고치면 예외 줄 제안: `{"id":"TOOL-01","reason":"시안 런타임 span.sc-interp를 잼 (support.js)","match":{"kind":"style","prop":["background-color","border-radius","padding","gap","width","height","x","y","line-height","box-shadow","color","border-top","border-right","border-bottom","border-left"]}}`는 너무 넓으니 권하지 않는다.

### B. 화면 읽기 전용 글자 (도구가 보이는 것으로 셈)
- `span|· Waiting for your reply` (`.case-status`, clip-path로 숨김), `p|8 points on the curve` (곡선 설명). 시안에 없지만 눈에 보이지 않는다. 제안: 도구 `__ddVisible`이 `clip-path: inset(50%)`·1px 상자를 숨김으로 보기, 또는 예외 `{"kind":"extra","selector":".case-status, .sr-only"}` (근거 DECISIONS 줄 없음 — 사람 결정 필요).

### C. 데이터 차이 (내 파일 범위 밖 또는 근거 결정 필요 — 고치지 않음)
1. **서연 첫 메시지(Nov 2)의 AI read 태그 "Asks for update"·"Worried"** (시안에만): 앱 태그는 엔진 신호가 참일 때만 그린다 (`readTags`, "있는 판정만"). 시안 태그를 붙이면 판정을 지어내는 것이라 하지 않았다. 이 줄이 빠져 메시지 칸이 34px 짧고 그 아래(Your reply 카드, 힌트, textbox) y −27이 모두 이것 때문이다. → 결정 필요: (a) 시드 Demo data 태그로 넣는다(그 메시지는 이미 Demo data) (b) 예외 `{"kind":"missing","text":"/^(Asks for update|Worried)$/","state":"initial|show-history|respond-now"}` + 위치 차이.
2. **둘째 메시지 보조줄 "· Dispute message" vs "· Nov 9"**: 실제 PayPal 메시지에 날짜가 없어 `case.view.dateUnknown`이 나온다. DECISIONS 20:35 ③ "Nov 9 메시지는 실제 PayPal 값" → 데이터/paypal 레인에서 날짜를 채워야 한다.
3. **기록 "9 events" vs "8 events"** (시드 8줄 결정): 기록 개수가 하나 많다. 데이터 레인 확인 필요.
4. **all-products__1038**: 앱에 #1038(새 지호 품질 분쟁)이 아직 없어 클릭이 사건을 열지 못하고 All products 화면에 머문다 (목록은 `PP-R-MBJ-10197650`). DECISIONS 20:35 ① 대기 — 화면 비교 불가.
5. **5 orders**: 시안 5건·`Add all 5`·`POST /v1/shipping/trackers-batch` vs 앱 실제 2건(O05·O07)·`Add all 2` — DECISIONS 20:35 ③ "실제 추적 대상은 O05·O07만". 예외 줄 제안: `{"kind":["missing","extra"],"state":"*5-orders*","text":"/^(Add all [25]|.*trackers-batch.*|.*\\/track · 2 orders|Add tracking to [25] orders in PayPal|Ready to add all [25] to PayPal.*|Found [25] orders shipped.*)$/"}` (근거 20:35 ③).
6. 머리글 `· PP-R-GMS-10197661`은 DATA-01 패턴(`^PP-R-…( ·|$)`)이 앞의 `· `때문에 안 맞는다 → DATA-01 정규식을 `/^(· )?PP-R-[A-Z]{3}-\d{8}( ·|$)/`로 넓히기 제안.

### D. 확인 못 한 것
- 도구 재실행·스크린샷은 개발 서버 금지라 하지 못했다. UI 병합 전 사람 확인 필요.
- 켜짐(respond-now) 아랫줄 [Translate & check]가 Send 위에 쌓이는 배치는 고친 글 관문(REPRO-02 근거)과 엮여 손대지 않았다 (Send x 1314 vs 1316, 2px).
- 단위 테스트는 추가하지 않았다 (CSS 값·순서 변경만, 기존 시험 모두 통과).

## 컨트롤 타워에 요청할 결정
- 도구 수정(A: `sc-interp` 글자를 부모로 합치기, B: 화면 읽기 전용 숨김 처리)을 어느 레인이 맡을지. 이게 되면 범위 안 남은 줄 대부분이 사라진다.
- C1 서연 첫 메시지 태그: 시드 Demo data로 넣을지, 예외로 둘지.
- C5·C6 예외 줄 추가 (exceptions.json).
