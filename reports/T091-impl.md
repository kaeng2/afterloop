# T091 보고 (2026-11-12 01:22)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 61af87c (구현). 이 보고서는 다음 커밋

## 결과
완료 — 지시서 "만들 것" 1~7, 모션 절, 보충(22:50)을 구현했다. 숫자는 모두 엔진(`forecastReply`·`replyFeatureEffects`·`forecastMoves`·`riskCurve`·`actionSavings`·`trackingSavings`·`recommend`)에서 오고, 화면은 표기(반올림·색 단계)만 한다. 보내기 관문(`canSend`·`canSendOffer`·`editGate`)·`send.ts`·`mode.ts`·`activity.ts`·서버 액션은 손대지 않았다. Send 뒤 진행 칸(T092)과 위쪽 막대·밝은 모드(T096)는 건드리지 않았다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/desk-actions.ts` (새) | 순수 함수: `draftForMove`(카드 → 초안, 새 AI 호출 없음), `typeOutFrames`/`nextTyped`(시안 typeOut), `filledSnippets`(snippets 자리표시자를 영어 초안과 같은 `screenText`로 채움, 못 채우면 뺌), `effectRows`(엔진 효과 → 나쁜 것/빠진 것(효과 큰 순)/좋은 것, refundNow면 빠진 것 없음), `applyChip`(엔진 `appendSentence`·`removeSentence` 그대로), `ppText`·`quoteCut`·`lintSummary` |
| `src/app/cases/view/choice-cards.tsx` (새, 클라이언트) | 선택지 카드 = 버튼 (`aria-pressed`, 고른 카드 `data-on`), 막힌 수 `aria-disabled="true"` + onClick 없음, 타이핑 중 `disabled`, 환불 카드 고르면 "Refund done · Simulated", 차지백 % 50% 이상 빨강 |
| `src/app/cases/view/desk-selection.tsx` (새) | 카드 ↔ 답장 칸 연결 (path·busy·pick). 값을 만들지 않는다 |
| `src/app/cases/view/case-view.tsx` | `ChoiceCards`를 새 파일에서 다시 내보내기 |
| `src/app/cases/reply/reply-panel.tsx` | 타이핑 효과(34ms·2글자, reduced-motion이면 바로 전체, 중에는 Send·카드·도구·입력칸 꺼짐), 카드 고르기 처리, `LintTray`(As you type + 요약 알약 + "! … [Remove]" + "+ Missing: … [+ Add]" + ✓ 칩 pop·0.12s 지연 + Details), Details 안 ✓ 칩별 %p·문장(검사 줄 뒤), 입력칸 테두리·알약·기분·범례 색(시안 editorSt·pillSt·moodSt·pSt), 글을 바꾸면 미리보기 "Translated to Korean when you send.", 보내기 성공 시 "+$N" 보고 |
| `src/app/cases/forecast-client.ts` | `replyFeatureEffectsClient`, `snippetsForClient` (엔진 그대로, 예외면 null/빈 값) |
| `src/app/cases/desk-model.ts` | `ChoiceView.chargebackTone`, `CurveView.headlineTone`, `ReactionView.chargebackHigh`·`moodBad` (색 단계만, 기분은 엔진 `moodBand`) |
| `src/app/cases/view/risk-curve.tsx` | 위험 % 큰 숫자 `data-tone` (시안 riskCol) |
| `src/app/cases/case-detail.tsx` | `DeskSelectionProvider`(처음 = 엔진 최선 수), `actionSavingsDisplay(board, best)` → 답장 칸 |
| `src/app/today/savings.tsx` (새, 클라이언트) | `SavingsProvider`(마지막 액션의 N 하나만 — 화면에서 더하지 않는다, 알림 3000ms), `WeeklyBumpCell`(깜빡임 1.6s + "+$N just now") |
| `src/app/today/savings-values.ts` (새) | `actionSavingsDisplay`·`trackingSavingsDisplay` (엔진 값 → `toDollarsRounded`, 0이면 null) |
| `src/app/today/today-list.tsx` | 이번 주 카드 "Money you can keep" 칸에 `WeeklyBumpCell` (그 칸이 없으면 사실 줄 칸) |
| `src/app/today/tracking-detail.tsx`, `tracking-register.tsx`, `tracking-result.ts` | 제목 "Add tracking to N orders in PayPal", 버튼 "Add all N", 등록 끝(added·simulated)이면 "+$N" (같은 서버 액션·관문) |
| `src/app/today/tracking.ts`, `model.ts` | 추적 주문에 `sku`·`amountCents`(시드 주문 → 없으면 시드 상품 가격, 선택 칸) — `trackingSavings` 입력 |
| `src/app/(app)/page.tsx` | `SavingsProvider`로 감쌈, 추적 상세에 `savings` |
| `src/app/_shared/motion.ts`, `config/motion.json` | `desk.typeOut`(34/2)·`chipPop`(.45s cubic-bezier(.2,1.4,.4,1), 0.12s)·`lintRise`(.3s)·`fold`(.35s)·`caret`(.2s)·`colorFade`(.3s)·`flash`(1.6s)·`toast`(3000ms, .35s)·`riskColor`(0.5/0.2), css 변수, `riskTone`·`chipPopDelay`·`typeOutTiming`·`toastDurationMs`·`prefersReducedMotion` |
| `src/app/globals.css` | `@keyframes motion-pop/-rise/-flash`, 토큰 `--color-flash`·`--color-choice-on`·`--color-editor-high`(어두운 모드도), reduced-motion에 새 변수 0s |
| `src/app/cases/view/case.css`, `reply/reply.css`, `today/today.css` | 위 모양 (시안 값). 상품 칩 줄 sticky(`top: calc(4.5rem + 1px)`, 좁은 화면은 해제), 알림, 고른 카드 `.choice[data-on='true']`(최선 수 강조는 Best 알약만), `.desk-caret` 회전(전에는 규칙이 없었다) |
| `config/copy.en.json`, `copy.ko.json` | 새 키 15개 (en=ko 키 같음), `today.tracking.addMany` = "Add all {{count}}" |
| `tests/unit/app-t091.test.ts` (새) | 완료 기준 1~5 + 만들 것 7 + 모션·보충 (22개) |
| `tests/unit/app-t067·t076·t081·today.test.ts` | 바뀐 동작에 맞춤: 고른 카드 css, "Add all 2", page.tsx `savings` 인자, ko 영어 허용 키 2개(환불 카드 영어 입력칸 글), 추적 주문 `toMatchObject`, T076 특징 칩 시험은 `effects: () => null`(효과 어댑터가 없을 때의 길). 숫자 단언은 바꾸지 않았다 |
| `reports/design-match/inventory.md` | Desk 표 2~5에서 이 태스크가 다룬 행 64개의 상태·근거 |

손대지 않은 것: `_server/send.ts`·`mode.ts`·`activity.ts`, 서버 액션, 엔진, `tests/acceptance/`, 위쪽 막대(`top-bar.tsx`·`shell.css`), Send 뒤 칸(`sent-state.tsx` 등).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | 15 파일 |
| npm test | 2395 | 0 | 68 파일. (T090 보고의 `storefront 결정론 100회` 시간 초과는 이번 실행에서는 나지 않았다) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | |

완료 기준 대조 (`app-t091`):
- 카드 → 위험 %·반응 막대·곡선 끝점·칩 = 엔진 값, 환불 = Simulated·PayPal 호출 0, 막힌 수 못 누름: "만들 것 1" 4개
- Add → snippets 문장이 들어가고 위험 내려감, Remove → 문장 빠짐, 넣는 문장은 snippets만: "만들 것 2" 5개
- Details 칩별 %p = 엔진 `deltaPp` 반올림: "만들 것 3"
- 지호 Send offer·Add all N 기존 관문: "만들 것 5" (관문·서버 액션 무변경 정적 검사. 공개 모드 POST 0회는 기존 `app-send`·`ops-t070-gates` 그대로 통과)
- +$N = 엔진 값: "만들 것 6"
- 모션: 34ms·2글자·reduced-motion 즉시·타이핑 중 Send 막음·pop·rise·화살표·색·깜빡임·알림 3000ms를 시안 파일 글자와 motion.json 비교

## 남은 문제
- **화면 스크린샷·실제 눌러 보기를 하지 않았다** (개발 서버 금지, 시험 환경에 DOM 없음). 클릭·타이핑은 순수 함수와 정적 그림으로만 시험했다. UI 병합 전 스크린샷·녹화 확인이 필요하다 (T098 Playwright 몫).
- **글을 바꾸면 보낼 수 없다** (기존 관문 `editGate` 그대로): 카드·Add·Remove로 바꾼 글은 예측만 바꾸고, [Send]는 "Edited text can't be sent — use AI draft"로 꺼진다 (SPEC v2.11 컨트롤 타워 해석 ①). 그런데 지시서대로 미리보기는 "Translated to Korean when you send."로 바뀐다 — 보낼 수 없는데 "보낼 때 번역"이라고 읽힐 수 있다. 아래 결정 요청.
- **환불 카드의 글**: 서연의 환불 수에는 AI 캐시 초안이 없다 (캐시 초안은 분쟁마다 최선 수 하나). 그래서 문구 키 `case.reply.refundDraft` "Sorry for the trouble, {{name}}. I have refunded the full amount of your order." (이름만 코드가 채움, 금액 없음)를 넣었다. 지시서 "넣는 문장은 snippets만"은 칩 Add에 대한 규칙으로 읽었다. 이 글은 보낼 수 없고(관문), 실제 환불도 없다("Refund done · Simulated").
- **환불 카드의 % ≠ 고른 뒤 큰 %**: 카드 % = `forecastMoves`(기본 초안 특징 + refundNow), 고른 뒤 % = 환불 안내 글의 `forecastReply`라 숫자가 다르다 (시안은 같은 글로 둘 다 구해서 같다). AI 기본 초안(답장 카드)은 숫자가 맞는다(AC33 그대로).
- 시안의 그림자 2개(입력칸 focus 링, 알림 그림자)와 [Remove] inset 그림자는 "그림자는 `--shadow-selected` 하나만" 기존 시험(T047 B-3) 때문에 outline·테두리로 그렸다 (inventory 근거 칸에 적음).
- "+$N just now"는 마지막 액션의 N 하나만 보인다 (시안은 누적해서 큰 값에 더한다). 화면에서 금액을 더하지 않으려고 이렇게 했다. "Money you can keep" 큰 값은 그대로다.
- 상품 칩 줄 sticky 위치는 위쪽 막대 최소 높이(4.5rem+1px) 기준이다. 막대가 여러 줄로 꺾이는 폭에서는 막대가 칩 줄 위를 덮는다 (40rem 아래는 sticky 해제). T096이 막대를 바꾸면 값을 다시 봐야 한다.
- `config/motion.json`은 지시서 "수정 가능 폴더"에 없지만 모션 절이 그 파일 값을 쓰라고 해서 고쳤다 (T090과 같은 상황).
- inventory에서 비워 둔 Desk 행: Send 뒤 진행(T092: `step`·`ndots`·`later 1300…`·`onClick send/refundNow/replay`·`sc-if sent/isTyping/stepsRunning/resOn/s.*`·`m.isSim/m.hasTags`), 위쪽 막대·색 토큰(T096·T098), 목록 "Done today"(`s.done`), `draftGrid`. scene1·scene3 표는 다루지 않았다.

## 컨트롤 타워에 요청할 결정
- **글을 바꾼 뒤의 Send**: 지금은 관문 그대로(보낼 수 없음)인데, 미리보기는 지시서대로 "Translated to Korean when you send."다. ① 이대로 두기(꺼진 Send 옆 이유 글로 설명), ② 글을 바꾸면 미리보기를 "Use AI draft to send" 계열 문구로 바꾸기, ③ 바꾼 글도 번역·검사해서 보내게 하기(서버 액션·`send.ts`·계약 변경 필요 — 이 레인 밖) 중 하나를 정해 주면 된다. ②는 문구 키 하나(`case.reply.autoTr`)만 바꾸면 된다.
- 환불 카드 % 불일치를 없애려면 환불 카드 글을 "AI 초안 + 환불 완료 문장"으로 하면 엔진 `forecastMoves`와 정확히 같아진다 (글은 어색해진다). 지금 방식이 괜찮은지 정해 주면 된다.

## main 병합 (2026-11-12)
기준 SPEC v2.15 (확인). main(`da3babc` T092 merged — T090 A·T096 진입점·밝은 모드·T092 Send 뒤 진행)을 lane/ui에 병합했다. 병합 커밋 `9a4e492`.

충돌 4개 처리:
| 파일 | 처리 |
|---|---|
| `src/app/cases/reply/reply-panel.tsx` | import 충돌만 났다. T091 `useDeskSelection`과 T092 `CaseProgress`를 둘 다 둔다. T092 전환 블록(`sendState === 'done' && outcome.ok` → `<CaseProgress …/>`)은 자동 병합으로 들어왔고, T091 카드 고르기·typeOut·칩·Details도 그대로다 |
| `src/app/globals.css` | main 쪽(T096 밝은 모드 고정 `html { color-scheme: light }`)을 썼다. 어두운 모드 `@media (prefers-color-scheme: dark)` 분기·토큰은 다시 넣지 않았다(`src/app`에 `prefers-color-scheme` 0건). T091이 더한 밝은 토큰(`--color-choice-on`·`--color-editor-high`·`--color-flash` 등)과 `@keyframes motion-*`는 그대로 남아 있다 |
| `tests/unit/app-t081.test.ts` | en=ko 허용 목록에 두 쪽 키를 다 넣었다 (T091 `case.reply.refundDraft`·`refundDraftNoName` + T092 `case.progress.buyer.original`·`english`) |
| `reports/design-match/inventory.md` | 행 키(첫 칸)로 합쳤다. 상태가 한쪽만 차 있으면 그 값을 쓰고, 근거는 두 쪽을 ` · `로 이어 붙였다. 두 쪽이 다 채운 행은 7개(`@keyframes flash`·`@keyframes rise`·`animation: flash 1.6s ease`·`animation: rise .35s ease`·`animation: rise .35s ease both`·`later 3000`·`sc-if toastOn`)이고, 모두 상태가 "구현함"으로 같았다. 한쪽에만 있는 행이나 기본 칸이 다른 행은 없었다 |

컨트롤 타워 결정 반영 (환불 카드 숫자 일치):
- 환불 카드를 고른 상태(`desk.path === 'refund'`, 글을 직접 고치거나 Clear·칩을 쓰면 `custom`이 된다)에서는 큰 위험 %, 반응 막대, 곡선 끝점, 입력칸 테두리 색이 같은 예측 하나를 쓴다. 그 예측은 환불 안내 글이 아니라 **AI 초안 + 환불 안내 글의 refundNow 문장**을 엔진 `forecastReply`에 넣은 값이다. 특징은 문장마다 판정해서 합치므로(`detectReplyFeatures`) 이 값은 엔진 `forecastMoves`의 refund 값(기본 초안 특징 + refundNow)과 정확히 같다. 화면에서 숫자를 계산하지 않고, 엔진에 넘길 글만 고른다 (`desk-actions.ts refundMoveText`, 엔진 `appendSentence`).
- 입력칸에 보이는 글은 지금처럼 환불 안내 글이다. 칩·Details %p는 지금처럼 보이는 글 기준이다 (결정 범위가 "큰 위험 %·반응 막대"라서 바꾸지 않았다).
- 시험: `app-t091`에 "환불 카드를 고른 상태: 큰 위험 %·반응 막대 = 카드 숫자"를 더했다. `forecastMoves` refund pChargeback과 화면 예측이 소수 12자리까지 같은지, 카드 표기 %와 반응 막대 `--seg` 값이 같은지, 환불 안내 글 자체의 예측과는 다른지 본다. 기존 시험(길 없이 환불 안내 글을 넣은 경우)은 그대로 통과한다.
- 숫자·관문(`editGate`·`canSend`)·데모 모드·`send.ts`·엔진은 바꾸지 않았다. 실제 AI·PayPal 호출과 개발 서버 실행은 하지 않았고, `.env`는 읽지 않았다.

시험 결과 (병합 뒤):
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm test | 2415 | 0 | 69 파일 (storefront 시간 초과 없음) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run test:acceptance | 177 (9 skipped) | 0 | 15 파일 |
| npm run build | 통과 | 0 | |

남은 문제:
- 환불 상태에서 큰 %는 카드와 같지만, 칩·Details %p는 보이는 환불 안내 글 기준이라 두 숫자가 다른 글을 바탕으로 한다. 이게 문제라면 칩도 같은 글로 맞출지 정해 주면 된다.
- 위 "컨트롤 타워에 요청할 결정" 두 번째 항목(환불 카드 % 불일치)은 이번 결정으로 끝났다. 첫 번째(글을 바꾼 뒤 Send)는 아직 정해지지 않았다.
- 화면 스크린샷 확인은 여전히 하지 않았다 (개발 서버 금지).
