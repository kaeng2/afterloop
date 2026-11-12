# T116 보고 (2026-11-12 11:39)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / 이 보고서 커밋 (구현 마지막 dd575e9)

## 결과
일부 완료 — 1–11 중 10개 다 했고, 7번(F4-67)은 "새 약속" 경고만 넣었다. "주문 금액보다 큰 금액" 경고는 넣지 않았다. 기존 코드에 금액을 주문액과 비교하는 검사 함수가 없고, 금액 비교는 숫자 판정이라 엔진 몫이다 (아래 결정 요청).

## 항목별
| # | 항목 | 한 일 | 파일 |
|---|---|---|---|
| 1 | F1-35 | 이번 주 카드 앞 3칸(Open·Money·Replies)을 모두 `WeeklyBumpCell`로 감쌌다. 지호 Send offer·추적 Add all 끝(`report` → bump)에 3칸 모두 flash/rise가 걸린다. "+$N just now"는 Money 칸에만 붙는다(`showAmount={false}`). 서연은 T104 `cprog-flash`도 그대로 걸린다 | `today/today-list.tsx`, `today/savings.tsx` |
| 2 | F1-45 | 추적: 누르는 즉시 "Added ✓"로 바뀌고 Done today로 간다(`markDone(simulated: true)`). 결과가 실제 등록이면 simulated=false로 바꾸고, 실패·일부 실패·없음·예외면 `unmarkDone` + 결과 줄(실패 글)로 되돌린다. 지호 Send offer: live 확인을 거친 뒤 즉시 "Offer sent ✓" + Done today로 가고, 실패하면 `unmarkDone` + 실패 결과 줄. 결과를 모르는 동안은 **Simulated로 둔다** (실제로 보냈다고 먼저 말하지 않는다). "+$N"·토스트(`report`)는 지금처럼 성공 뒤에만 뜬다(금액을 되돌릴 수 없어서). 서연 메시지 Send는 T104 그대로 | `today/tracking-register.tsx`, `today/offer-work.tsx` |
| 3 | F3-36 | EN 화면 사건 기록의 샌드박스 구매자 글 줄을 대화 칸의 "Translated" 글과 같은 값(`caseMessages`의 english)으로 바꿨다. 새로 번역하지 않는다. 번역이 없으면 원문 그대로. **화면용(`eventsShown`)에만** 쓴다 — AI 요약 입력·위험 곡선·늦은 날 수는 원래 `events` 그대로(요약 캐시와 예측 입력이 흔들리지 않게). KO 화면은 원문 | `cases/history.ts`(`englishOf`·`englishLookup`), `cases/view/load.ts`, `cases/case-detail.tsx` |
| 4 | F4-41 | `case.feature.refundNow`: EN "Refund done", KO "환불 완료"(시안 DI.ko) | `config/copy.*.json` |
| 5 | F4-46 | `applyChip`의 Remove가 엔진 `removeSentence`를 반복한다. 다음 문장은 엔진 특징 판정(detector)의 같은 규칙 hit로만 찾는다. 엔진은 고치지 않았다 | `cases/desk-actions.ts`, `cases/reply/reply-panel.tsx` |
| 6 | F4-65 | "now: angry" 소문자. 새 키 `case.moodNow.*`(EN 소문자, KO 시안 DI.ko "화남")를 쓰고 `nowMoodKey`를 바꿨다 | `cases/desk-model.ts`, `config/copy.*.json` |
| 7 | F4-67 | **일부**: 입력할 때마다 "! New promise — needs your approval"(KO "! 새 약속 — 승인 필요") 경고를 맨 아래 왼쪽에 빨간 13px 700으로 보인다. 판정은 서버(`send.ts` → `withEditChecks`)가 쓰는 `editAdditions`(AI 초안 → 지금 글)를 그대로 쓴다. 보내기 관문은 바꾸지 않았다. **금액 경고는 넣지 않았다** | `cases/reply/reply-panel.tsx`, `reply.css`, `config/copy.*.json` |
| 8 | F5-3 | 바깥 `section.work`를 클라이언트 `WorkZone`으로 바꿨다. Send 뒤(`useSent().sent`)에는 `aria-label="Case progress"`(KO "사건 진행"), 보내기 전에는 지금처럼 `aria-labelledby="work-title"`. 보이는 제목은 그대로 | `cases/view/work-zone.tsx`(새 파일), `cases/view/case-view.tsx` |
| 9 | F5-19 | 고친 글을 보냈으면 "Auto-translated to {{language}}", 아니면 "Sent in {{language}}". 판정은 보낸 글 ≠ AI 초안. "· Simulated"는 그대로 (KO는 시안대로 둘 다 "…로 보냄") | `progress/case-progress.tsx`, `reply-panel.tsx`, copy |
| 10 | F5-21 | 시뮬레이션 답장 말풍선 아래 "Translated · … · Simulated" 줄을 뺐다. 태그 "Simulated reply"는 그대로고, 영어 뜻은 원문 `title`에 넣었다 | `progress/case-progress.tsx` |
| 11 | F5-24 | 단계 key를 `row.step`만으로 바꿨다 (대기 → 완료로 바뀔 때 다시 rise하지 않는다) | `progress/case-progress.tsx` |

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| src/app/today/today-list.tsx, savings.tsx | F1-35 |
| src/app/today/tracking-register.tsx, offer-work.tsx | F1-45 |
| src/app/cases/history.ts, view/load.ts, case-detail.tsx | F3-36 |
| src/app/cases/desk-actions.ts | F4-46 |
| src/app/cases/desk-model.ts | F4-65 |
| src/app/cases/reply/reply-panel.tsx, reply.css | F4-46·F4-67·F5-19 |
| src/app/cases/view/work-zone.tsx (새 파일), view/case-view.tsx | F5-3 |
| src/app/cases/progress/case-progress.tsx | F5-19·21·24 |
| config/copy.en.json, copy.ko.json | 고친 키 `case.feature.refundNow`. 새 키 `case.moodNow.{calm,okay,annoyed,angry}`, `case.progress.sentAutoBubble`, `case.progress.zone`, `case.reply.warnPromise` (en/ko 둘 다, 자리표시자 일치) |
| tests/unit/app-t116.test.ts (새 파일) | 항목 1–11 시험 21개 |
| tests/unit/app-t076.test.ts | moodNow 키 갱신. 금지어 "Case progress" 검사에서 `case.progress.zone` 한 키만 뺐다 (아래 결정 요청) |
| tests/unit/app-t091.test.ts, app-t106.test.ts | 낙관적 표시로 코드 모양이 바뀌어 정규식만 갱신 (`next = await action()`, `sent \|\| optimistic`, `shownDone`). 검사하는 뜻은 같다 |

`_server/send.ts`·`mode.ts`·`activity.ts`, `src/engine`, `/intro`·`/listing`·`lang/route.ts`·`next.config`는 건드리지 않았다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 | 0 | 9 skipped |
| npm test (vitest tests/unit) | 2572 | 1 | 실패는 `storefront.test.ts` 결정론 100회 시간 초과(5s) — 알려진 부하 흔들림. 따로 돌리면 통과 |
| npx tsc --noEmit | 0 오류 | | build 뒤 `.next/types`가 새로 만들어진 상태 기준. 빌드 전에는 지난 /products 페이지가 남은 `.next/types/validator.ts` 오류가 나는데, 이 작업 전부터 있던 것이다 |
| npm run lint | 0 오류 | | 경고 2개(`app-t098a-scenes.test.ts`, 이 작업 전부터 있던 것) |
| npm run build | 성공 | | |

실제 AI·PayPal 호출, 개발 서버, `.env` 읽기 없음. 브라우저 확인은 하지 않았다 (컨트롤 타워 몫).

## 남은 문제
- F4-67 금액 경고("$X is more than the order ($72)")는 넣지 않았다. 이유는 아래 결정 요청에 적었다.
- F1-45: "+$N just now"·토스트·카드 flash는 서버 성공 뒤에 뜬다 (bump를 되돌릴 방법이 없어 낙관적으로 띄우지 않았다). 그래서 Done today 이동·버튼 글자보다 조금 늦게 나온다.
- F1-45: live 모드에서 결과를 받기 전 잠깐 Done today 줄에 Simulated 표시가 붙었다가, 실제 성공이면 떨어진다. 공개 데모(Simulated)에서는 차이가 없다.
- 케이스 화면 `reply-panel`의 offer 보내기(지호가 아닌 옛 경로)에는 낙관적 표시를 넣지 않았다. 지호 상세는 `offer-work` 카드를 쓴다. T102·T104 시험이 그 파일의 `markDone` 호출을 한 곳으로 묶어 두기도 했다.

## 컨트롤 타워에 요청할 결정
1. **F4-67 금액 경고**: 시안 `c.d.amt > N_PRICE` 판정(고친 글의 금액이 주문액보다 큰가)이 지금 코드 어디에도 없다. `tokens.ts`의 `literalFacts`는 "값을 직접 썼다"만 보고 크기는 보지 않는다. 금액 비교는 숫자 계산이라 CLAUDE.md상 `src/engine/`에서 해야 한다. 엔진에 `exceedsOrderAmount(text, board)` 같은 함수를 만들지(엔진 레인), 이 경고를 빼기로 할지 정해 달라.
2. **"Case progress" 금지어 (app-t076)**: DECISIONS 2026-11-11 ②(가상 진행 "Case progress" 넣지 않음)를 지키는 시험이 화면 코드·문구 전체에서 "Case progress"를 금지한다. T116 8번이 aria-label "Case progress"를 지시해서, 그 시험에서 `case.progress.zone` 키 하나만 뺐다. 보이는 제목이나 다른 문구로 들어오면 여전히 걸린다. 이 예외가 맞는지 확인해 달라. 아니면 aria 이름을 보이는 제목 "What happens next · Simulated"와 같게 바꾸면 된다.
