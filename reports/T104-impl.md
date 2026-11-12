# T104 보고 (2026-11-12 09:55)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 1a97867 (구현) + 이 보고서 커밋

## 결과
완료 — 지시서 "고칠 것" 1~7 모두 했다. 3차 리뷰 ③ 버그(SELLER_NAME)는 `src/app/cases/edited-reply.ts` 안에서 고쳤다 (`send.ts`·`src/ai` 무변경). 브라우저 확인은 하지 않았다 (개발 서버 금지 — 컨트롤 타워 몫).

## 항목별
| # | 차이 | 한 일 | 테스트 (`tests/unit/app-t104.test.ts`) |
|---|---|---|---|
| 1 | F4-47 | bad 줄 %p = 시안 `eff(k,true)` = p(지금) − p(뺀 글) → "+N pts" 빨강. `desk-actions.ts shownDeltaPp`가 bad만 엔진 `deltaPp` 부호를 뒤집는다 (표시만, 엔진 정의 그대로). good·missing은 원래도 시안 부호와 같았다 | 1 (순수 함수 + 급한 답장 화면) |
| 2 | F5-15·16 | `progress-model.ts scenarioOutcome` = 보낸 글의 엔진 `forecastReply` pWait·pRefund·pChargeback 중 큰 것, 같으면 ok > refund > cb (시안 L661 그대로). 답장 칸이 보낸 순간의 글·예측(`sentSnap`)을 잡아 Send 뒤 칸의 `scenarioInput.text`·분기로 넘긴다 (이전에는 늘 AI 초안 = 늘 ok). **refund**: 보낸 답장 → 승인 대기 "Refund the order in full" [Approve refund] → "Refund approved" (Simulated) → 손님 환불 확인 (typing 없음). **cb**: 보낸 답장 + typing → 화난 답장(“답이 이게 다예요? 카드사에 이의제기할게요.”, 빨강 칩 Will file chargeback · Angry) + 승인 대기 [Approve refund] → "Refund approved" (끝). 승인 버튼은 화면 상태만 (서버 액션·fetch 없음). 위험 칩: 첫 줄만 보낸 답장의 엔진 pChargeback(`scenarioRisk` 'sent'), 계약 밖 줄은 칩 없음, 곡선 점도 하나. 급한 답장(지금 가정값 cb 93%)은 cb 분기, AI 초안은 ok. 새 문구 18키 (en·ko), 금액·약속 없음 | 2 (동률 4가지, 엔진 값 분기, 상태 기계, 화면 3분기, 쓰기 0·서랍 0, 칩, 문구) |
| 3 | F5-25·28·29 | 메시지 Send 성공 순간의 `report`·`markDone`을 없애고 Send 뒤 칸의 마지막 단계 때 `onFinish` → `completeAction`(T091·T102 상자 그대로)으로 한 번. 진행 칸 자기 토스트 삭제 → 토스트 1번. flash는 끝날 때 한 번 (3칸 DOM flash + "+$N" 칸 자체 flash가 같은 순간). 금액은 ok 분기만 (refund·cb는 엔진 actionSavings(refund) = 0 → "+$N"·토스트 없음, Done today만). 제안(지호)은 뒤 칸이 없어 지금처럼 성공 순간 | 3 (정적: send()에 report·markDone 없음, 토스트 코드 없음, onFinish 1곳) |
| 4 | F4-52 | Details 역번역 = `reply-model.ts detailsBackTranslation`: 안 고친 글 = 원래 역번역, 고친 글 = Translate & check 결과의 역번역, 아직 없으면 줄 숨김 | 4 (순수 함수 + 화면) |
| 5 | 3차 리뷰 ③ | 원인: 번역 프롬프트(`src/ai/prompts/reply.ts`)가 "⟦SELLER_NAME_1⟧ stays as the sign-off"이고 `<facts>`에 서명이 들어가서, 서명 없는 고친 글을 번역하면 번역이 서명 토큰을 붙인다 → 초안 0개·전송본 1개 → `checkTokens` extra. 고침: `revertToTokens` 끝에 `keepSignOff` — 검사받은 AI 초안에 서명 토큰이 있었는데 고친 글에 없으면 서명 토큰을 글 끝에 남긴다. `checkTokens`는 그대로 엄격 (서명을 빼거나 두 번 써도, 다른 토큰을 더해도 실패). 전송본 미리보기에 채운 서명이 보이므로 숨는 글은 없다 | 5 (재현: 서명 붙이는 가짜 번역기로 예전 결과 실패 → `prepareEditedReply` 통과·번호 발급, AI에 이름 값 없음, 검사 엄격 유지) |
| 6 | F4-36·37 | `.reply-chip.reply-chip-good`(·`-warn`) 두 클래스로 → 흰 바탕 + inset 1px #E4E6E9가 `.reply-chip` 회색에 덮이지 않음. `.reply-chip` gap 4px·padding 2px 9px (시안 `.chip`) → "✓" 뒤 띄움 | 6 (CSS 정적) |
| 7 | F4-69 | `editGate`: 빈 글이면 `reasonKey: null` (이유 글 없이 꺼짐) | 7 (함수 + 화면) |

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| src/app/cases/desk-actions.ts | `shownDeltaPp`, bad 줄 표시 부호 |
| src/app/cases/progress/progress-model.ts | `scenarioOutcome`, 분기별 상태(`progressStart`·`PROGRESS_STEPS`·`approveStep`·`stepAfterApproval`), 분기별 단계 줄·말풍선(`buyerBubble`)·위험 점 |
| src/app/cases/progress/case-progress.tsx | `outcome`·`onFinish` props, 승인 버튼 문구, 자기 토스트 삭제, 끝 효과 한 번. `board`·`move`·`savings` props 삭제 (금액은 답장 칸이 넘긴다) |
| src/app/cases/reply/reply-panel.tsx | 보낸 순간 글·예측 `sentSnap`, 분기 전달, `completeAction`(report+markDone 한 곳), Details 역번역 |
| src/app/cases/reply-model.ts | `editGate` 빈 글, `detailsBackTranslation` |
| src/app/cases/edited-reply.ts | `keepSignOff` (SELLER_NAME 버그) |
| src/app/cases/reply/reply.css | ✓ 칩 우선순위·gap·padding |
| config/copy.en.json · copy.ko.json | `case.progress.refundAsk/cbAsk/refundApprove/refunded/refundBuyer/angryBuyer.*` 18키 (en=ko 키 집합 같음) |
| tests/unit/app-t104.test.ts | 새 테스트 26개 |
| tests/unit/app-t076·t081·t091·t092·t098b·t102 | 이번 결정으로 바뀐 기대만 고침: 빈 글 이유 null, ko=en 허용 목록 4키(손님 원문·영어 줄), bad 부호, CaseProgress props, 진행 칸 토스트 없음·trail에 outcome, report·markDone 위치 |
| reports/design-match/inventory.md | 행 5개 갱신: `onClick refundNow`(cb 분기 생김), `onClick send`(분기·끝 시점), `sc-if toastOn`(토스트 1개), bad %p 행, `#E4E6E9`(✓ 칩 실제로 회색이었음) |

건드리지 않음: 위험 곡선 SVG·`desk-model.ts`·`draft-forecast.tsx`(T105), `today/**`·`(app)/page.tsx`(T106), `_server/send.ts`·`mode.ts`·`activity.ts`, `src/ai`·`src/engine`.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | 15 파일 |
| npm test | 2520 | 1 | 실패 1 = `storefront.test.ts` "결정론 100회" (부하 때 흔들리는 시험). 따로 돌리면 31/31 통과 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | |

T103 회귀 없음: `app-t103` 통과 (`scenarioInput`은 여전히 useMemo, 의존성에 보낸 글만 더함 — 보낸 뒤에는 바뀌지 않는다).

## 남은 문제
- 브라우저 확인 전: 급한 답장 → 칩 → Translate & check → Send가 실제 AI 번역에서도 통과하는지는 가짜 번역기로만 확인했다. 실제 번역이 서명 말고 ⟦BUYER_NAME_1⟧ 인사말까지 붙이면 같은 꼴로 막힐 수 있다 (급한 답장은 "Hi,"로 시작, 이름 토큰 없음) — 그건 고치지 않았다 (원래 초안에 이름이 있어도 판매자가 뺀 인사말을 코드가 넣는 것은 글을 바꾸는 일이라).
- refund·cb 분기에서는 "+$N"·토스트·이번 주 카드 flash가 없다 (엔진 actionSavings(refund) = 0, 시안의 +$10은 근거 없는 숫자). Done today 이동만 한다.
- `case-progress.css .cprog-toast` 규칙과 `progress-client.ts actionSavingsClient`, copy `case.progress.toast`는 이제 화면에서 안 쓴다 (기존 테스트가 읽고 있어 남김).
- cb 분기 손님 답장 단계는 계약 `ScenarioStepKind`의 'buyer_reply'와 이름은 비슷하지만 엔진 `scenario`의 buyer_reply 신호 변화(통관번호를 보내 진정됨)와 뜻이 반대라 엔진 값을 쓰지 않고 칩을 그리지 않았다.

## 컨트롤 타워에 요청할 결정
- (선택) SELLER_NAME 버그의 근본 원인은 번역 단계다: `_server/send.ts prepareEditedReply`가 `translateReply`에 `facts: reply.facts`(전부)를 넘기고, 프롬프트가 서명을 "sign-off로 둔다"고 해서 영어에 없는 토큰을 붙일 여지가 있다. 이번에는 ui 레인 안(`keepSignOff`)에서 막았지만, 더 곧은 고침은 ai/서버 쪽에서 "영어 글에 있는 토큰만 `<facts>`에 넘기기" 또는 프롬프트 "⟦SELLER_NAME_1⟧은 영어에 있을 때만"이다 (같은 꼴로 ⟦BUYER_NAME_1⟧이 붙는 경우도 막힌다). 계약 변경은 아님.
- (선택) cb·refund 분기 단계의 위험 %를 보이려면 `ScenarioStepKind`에 단계 종류(예: 'buyer_angry'·'refund')와 `config/reply-model.json scenario` 값을 더해야 한다 (계약 변경). 지금은 칩 없음으로 두었다.
