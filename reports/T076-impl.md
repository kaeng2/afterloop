# T076 보고 (2026-11-11 22:10)

- 기준 SPEC: v2.11 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 73c89f9 (구현). 이 보고서는 그 다음 커밋
- 작업 폴더: `afterloop-wt/ui` (worktree). 실제 AI·PayPal POST 호출 0회, 개발 서버 실행 없음 (그림은 `renderToStaticMarkup` 시험으로만 확인)

## 결과
완료 — 시안 v4 배치(위쪽 막대·상품 거르개·이번 주 카드·목록 줄·사례 머리글·위험 곡선·사건 기록·구매자 메시지·Respond now·지호 짧은 카드·서랍·Rehearsal ⑤)를 넣었다. 예측 자리는 어댑터 3개로 두었고 **지금은 모두 `null`** 이라 예측 칸만 숨은 대체안 화면이 된다. 보내기 관문·데모 모드·승인 버튼·검사 줄·전송 경로는 바꾸지 않았다.

## 어댑터 함수 목록과 T079에서 바꿀 곳

**T079는 아래 함수 몸통만 바꾸면 된다** (부르는 쪽·보기용 값·화면은 그대로).

| 파일 | 함수 | 지금 | T079에서 | 부르는 곳 |
|---|---|---|---|---|
| `src/app/cases/forecast-source.ts` (server-only) | `loadRiskCurve(events, board)` → `RiskPoint[] \| null` | `null` | `riskCurve(events, board)` | `case-detail.tsx` |
| 〃 | `loadWeeklySummary({ boards, usesDemoData })` → `WeeklySummary \| null` | `null` | `weeklySummary({ boards, aiDrafts, usesDemoData })` — **aiDrafts(AI 캐시의 답장 초안 수)는 어댑터 안에서 센다** (지금 세는 함수 없음) | `_server/today.ts` `loadTodayScreen` |
| 〃 | `loadMoveForecasts({ board, signals, delayDays, anchorText })` → `MoveForecast[] \| null` (`{ move, pChargeback }`) | `null` | T075의 수별 예측(예: `forecastMoves`)에서 `pChargeback`만 옮긴다. 기대 손실은 화면이 `recommend` 값을 쓴다 | `case-detail.tsx` |
| `src/app/cases/forecast-client.ts` (브라우저) | `forecastReplyClient(input: ReplyForecastInput)` → `ReplyForecast \| null` | `null` | `forecastReply(input)` | `reply-panel.tsx` (입력칸 글이 바뀔 때마다) |
| 〃 | `detectReplyFeaturesClient(text)` → `{ features, hits } \| null` | `null` | `detectReplyFeatures(text)` | `reply-panel.tsx` |
| `src/app/cases/history-summary-source.ts` (server-only) | `loadHistorySummary(events)` → `Promise<string \| null>` | `null` | `getLlm()` → `summarizeCaseHistory({ events, locale: 'en' }, { llm })` → ok면 `summary`, 아니면 `null` (예시 코드는 파일 머리 주석) | `view/load.ts` `loadCase` — **AI 초안과 같은 길**(`options.draft !== false`)이라 AI 캐시 만들기 경로에 들어간다. Routine(Mike)은 부르지 않는다 |

예측 입력 값 (화면이 데이터에서 센 것, 숫자 계산 아님):
- `anchorText` = 화면에 보이는 영어 초안(`buildReplyView(...).draftEn.text`, 사실값을 채운 글) = 입력칸의 처음 글 (`reply/load.ts`의 `anchorText`). AC33 숫자 일치 조건의 "기준 초안"이 이 글이다.
- `delayDays` = `unansweredDays(events, now)`: 마지막 판매자 답장 뒤 **첫** 구매자 글부터 오늘까지 달력 날 수 (답장한 적 없으면 첫 구매자 글부터. 서연은 시드 문의 11/2부터). 엔진이 다른 정의를 원하면 `cases/history.ts` 한 곳만 바꾼다.
- `board` = `pickBoard`(배송사 기록 반영 보드), `signals` = 기존 확대 위험 신호.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/forecast-source.ts`, `forecast-client.ts`, `history-summary-source.ts` (새) | 위 어댑터 (지금 `null`) |
| `src/app/cases/history.ts` (새) | `buildCaseEvents`·`caseEventsFor`: **실제 데이터만**으로 `CaseEvent[]` (시드 주문일 `order_paid`·발송 `shipped`·나머지 배송사 `carrier_event`는 source `seed`, PayPal 추적 없음 `tracking_missing`·샌드박스 구매자/판매자 글·분쟁 접수는 `sandbox`, 시드 문의는 `seed`). 표시: `threat`(엔진 카드사 낱말) · `angry`(AI 어조, 마지막 실제 글) · `unanswered`. 날짜 차 함수(`daysBetween`·`historySpanDays`·`unansweredDays`) |
| `src/app/cases/desk-model.ts` (새) | 순수 보기용 값: 범주 알약·머리글 둘째 줄·선택지 카드(`recommend` 그대로)·사건 기록·곡선 좌표·"AI read" 태그·As-you-type 칩·예상 반응·`buildCaseDesk` |
| `src/app/_shared/percent.ts` (새) | 확률 → "8%" 표기만 (반올림 한 곳) |
| `src/app/_shared/product-icon.tsx` (새) | 상품 아이콘 5개 (시안 선 그림, 색은 강조색 변수) |
| `src/app/cases/view/risk-curve.tsx`, `case-history.tsx`, `draft-forecast.tsx` (새) | 위험 곡선 카드(점 없으면 카드 없음), 사건 기록 카드(펼침 + 요약 줄), 답장 예측을 곡선 카드와 함께 쓰는 context |
| `src/app/cases/view/case-view.tsx` | 시안 v4 순서: 머리글 → 곡선 → 사건 기록 → 구매자 메시지 → Respond now(1 선택지 카드 + 한 줄 요약(엔진 원인 전환) + "PayPal data only: Full refund $74"[Demo data] → 2 답장). 제안이 먼저면 머리글 + 제안 카드만. 비교 카드는 사례 화면에서 뺐다(파일은 남음) |
| `src/app/cases/reply/reply-panel.tsx` | 입력칸(처음 = AI 영어 초안) + [Try a rushed reply][Use AI draft][Clear] + 모서리 차지백 % + As-you-type 칩(없으면 지금 칩) + 오른쪽 검사받은 전송본 + 예상 반응 막대. **입력칸 ≠ 초안 → Send 꺼짐**("Edited text can't be sent — use AI draft"). 지호: 짧은 카드 "Offer 15% back ($7.20), the buyer keeps it" + [Send offer · $7] (메시지만 보내는 늘 꺼진 버튼은 그리지 않음). `send()`·확인 창·서버 액션 호출은 그대로 |
| `src/app/cases/reply-model.ts` | `editGate`(입력칸 관문) 추가. 기존 `canSend`·`canSendOffer`·`contentGate` 무변경 |
| `src/app/cases/reply/load.ts` | `anchorText`, `offerRate`(엔진 `paramsFromConfig().offerRate`) 추가 |
| `src/app/cases/view/load.ts` | `loadCase`가 `events`·`historySummary`(어댑터) 반환 |
| `src/app/_server/disputes.ts`, `_shared/dispute-view.ts` | `LoadedDispute.timeline`(선택 칸): 분쟁 `create_time`, 시각 붙은 구매자 글(가린 글)·판매자 글 시각, 시드 주문일. 조회만, POST 없음 |
| `src/app/cases/model.ts` | `CaseView.signals` 추가 (태그용) |
| `src/app/cases/view/conversation.tsx` | "Buyer messages" 제목 + "AI read" 태그(있는 판정만) |
| `src/app/cases/case-detail.tsx`, `routine-detail.tsx` | 어댑터·사건 기록을 모아 `buildCaseDesk`, 새 머리글 |
| `src/app/today/model.ts`, `today-list.tsx`, `page.tsx`, `_server/today.ts` | 묶음 Reply needed(서연·지호)/Prevent(추적 2건·가디건)/Routine(Mike), 줄 = 아이콘·PayPal 분쟁 번호·상품·범주 알약·"Reply by Nov 30"·이름·나라, 이번 주 카드, 상품 거르개(`?sku=`, 숫자는 시드 재고·분쟁 수를 센 것) |
| `src/app/_shared/top-bar.tsx`, `layout.tsx` | 글자 로고(강조색 "Less" + 밑줄 곡선) + "for PayPal sellers" + 날짜 줄 |
| css (`globals`·`shell`·`today`·`case`·`reply`·`products`) | 시안 값(모서리 16·20·24, 간격, 52/38/36px 아이콘, 검정 주 버튼, 4px 강조 띠). 새 색 변수는 강조색 계열(`--color-accent-soft/tint/deep/strong`, `--color-on-accent*`) + 회색(`--color-panel/zone/line/ink`), 어두운 모드 모두 다시 정함. 그림자는 `--shadow-selected` 하나 그대로. ⑤ 서랍 `.drawer-close` 한 줄, AG Grid 상품 이름 낱말 단위 꺾임·줄 간격 1.3 |
| `config/copy.en.json`·`copy.ko.json` | 새 문구 키 (같은 키 두 파일). 값 변경: `nav.products` "Black Friday rehearsal", `today.dateLine` "… · Black Friday in N days", `today.group.needsYou` "Reply needed", `case.view.conversation` "Buyer messages", `case.reply.title` "Your reply" |
| `tests/unit/app-t076.test.ts` (새, 32개) | 완료 기준 1~8 |
| `tests/unit/app-today`·`app-t061`·`app-t067`·`app-t068`·`app-case-view`·`app-case-reply`·`app-case-reply-retry` | 옛 배치 기대값(비교 카드·"Needs you"·원형 로고·"You write" 칸·지호 조용한 버튼)을 v4로 고침. 안전 기대값(관문·금액 = 엔진·이름 토큰·배지)은 그대로 두거나 같은 뜻으로 옮김. **PayPal 파랑 검사는 강화**: 시안 파랑 5개(#001C64·#0B48C4·#097FF5·#00A8EA·#009CDE) 추가 + css만이 아니라 tsx·ts도 검사 |

## 완료 기준 대조
| 기준 | 결과 | 근거 (app-t076.test.ts) |
|---|---|---|
| 어댑터 null → 예측 칸만 숨음 | ✓ | 곡선 카드·예상 반응·모서리 %·요약 줄·차지백 %·이번 주 돈/초안 칸 없음, 선택지·입력칸·전송본·검사·보내기는 있음 |
| 가짜 값 → 그대로 | ✓ | 곡선 점 수 = RiskPoint 수, 큰 %, draft 점·"from → to", 막대 `flex-grow` = 확률 그대로, 기대 비용·기분·지금 기분, 칩, 이번 주 카드, 선택지 차지백 % |
| 선택지 기대 손실 = recommend, PayPal only = 전 보드 엔진 값 | ✓ | 수마다 센트 같음, best·blockedBy 같음, 서연 "Full refund $74" |
| CaseEvent[] 실제 데이터만 | ✓ | 서연 9개(주문·발송·추적 없음·배송사 2·문의 2·실제 글·접수), 판매자 답장·약속 없음, 날짜 = 데이터, 시드 = `seed` |
| 입력칸 ≠ 초안 → Send 꺼짐, = 초안 → 관문 그대로 | ✓ | `editGate` 단위 + 처음 그림에서 Send 켜짐(계획 있을 때). 보내기 테스트(`app-send`·`ops-t070-*`) 그대로 통과 |
| Lena·Yuki·통관부호·HEY·GAH 없음, PP-R-…, 서연 11/30 | ✓ | |
| PayPal 파랑 없음 | ✓ | `app-t067` 강화 검사 + `app-shared-design` 그대로 |
| 금액·확률 숫자·근거 없는 성과·"Refund backup"·"refund you in full" 없음 | ✓ | 화면 파일 정적 검사 + 문구 파일 검사 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 159 | 0 | 건너뜀 17: AC33 8개(엔진 예측 T075가 이 브랜치에 없어 건너뜀 — 설계대로), AC13 9개(샌드박스 실호출용, 전과 같음) |
| npm test | 2112 | 0 | 전 2080 + 새 32 |
| npx tsc --noEmit | ✓ | 0 | |
| npm run lint | ✓ | 0 | 경고 0 |
| npm run build | ✓ | 0 | `/` 14.6 kB |

## 남은 문제
- **스크린샷은 찍지 않았다** (개발 서버 금지). 390 폭 가로 넘침 없음은 css로만 맞췄다: 거르개 줄만 그 안에서 가로 스크롤, 56rem 아래 한 열, 곡선·선택지·반응은 컨테이너 질의/미디어 질의로 한 열, 답장 두 칸 40rem 아래 위아래. 컨트롤 타워 스크린샷으로 확인 필요.
- 서연 사건 기록에 11/9 같은 날 구매자 글이 2줄 나온다: 시드 문의(영어로 긴 글)와 실제 분쟁 글(한국어 짧은 글)이 글자가 달라 같은 글로 보지 않았다 (데이터 그대로). 하나로 보이려면 시드 문의 글을 실제 글과 같게 맞추는 데이터 쪽 결정이 필요.
- 이번 주 카드의 `aiDrafts`는 T079 어댑터 안에서 AI 캐시를 세야 한다 (지금 세는 함수 없음).
- 비교 카드 컴포넌트(`_shared/compare-card.tsx`)는 사례 화면에서 쓰지 않지만 견본 화면·시험에서 쓰므로 남겼다. `case.reply.youWrite` 문구 키도 지금 화면에서 안 쓴다.
- "Try a rushed reply" 예시 글은 문구 키(`case.reply.rushedExample`, 시안 예시 글 그대로)다 — 보낼 수 없다(관문이 막는다).
- Products(Rehearsal) 화면은 위쪽 막대·공용 색 변수·⑤ 고침만 반영했다 (시안에 이 화면이 없다).

## 컨트롤 타워에 요청할 결정
- 없음 (계약·인수 테스트·SPEC 변경 필요 없음). 참고: 사람 결정의 지호 카드 문구 "she keeps it"은 대명사를 피해 "the buyer keeps it"으로 했다 (성별 데이터 없음 — 기존 화면 규칙).
