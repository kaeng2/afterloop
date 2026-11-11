# T100 보고 (2026-11-12 01:55)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예 — `# SPEC v2.15 (2026-11-12 00:05 KST)`)
- 브랜치 / 마지막 커밋: lane/ui / af73cf3 (구현) + 이 보고서 커밋

## 결과
완료 — 칩·손으로 고친 영어 답장을 서버에서 값→토큰으로 되돌린 뒤 `translateReply`(번역 + 역번역 + 검사)를 지나게 했고, 보낼 글 기준으로 검사를 다시 엮어 통과한 글만 기존 `sendReply` 관문으로 보낸다. 환불 카드 상태에서는 Send를 끈다 (화면 + 서버 입구 둘 다).

## 가장 중요한 규칙 대조
| 규칙 | 어떻게 지켰나 | 시험 |
|---|---|---|
| 1. 서버에서 토큰 되돌리기 → `translateReply` → `sendable`일 때만 기존 경로 | `send.ts`에 입구 하나(`prepareEditedReply` 본체 + `prepareEditedFromScreen` 연결). 검사를 통과한 글만 `rememberReply` → 번호. 보내기는 그 번호로 **기존 `sendReply` 그대로** (공개 Simulated, 녹화+스위치만 live). 입구에는 PayPal 호출기가 없다 (GET 읽기만) | (a), (e), "입구는 호출기를 받지 않는다" |
| 1. AI에 이름 값을 보내지 않음 | 되돌린 뒤 이름 조각(두 벌의 이름 값과 그 낱말, 호칭 제외, 대소문자 무시)이 남으면 **AI 호출 전** 거부 ("Write names the way the AI draft shows them"). `checkTokens.literalFacts`는 이름을 안 보므로 따로 막았다 | (c) 요청 전체에 Seo-yeon·서연·Hannah·Fernwood 없음, 다르게 쓴 이름 3가지 → 호출 0 |
| 2. 검사 3개를 보낼 글 기준으로 다시 · 새 약속은 코드가 막음 | `translateReply`는 고친 글 자체를 초안으로 보므로, 원래 AI 초안 대비 더해진 약속(`findCommitments` 범주 + `checkTokens` 확언 표현)을 `withEditChecks`가 "No new promises"에 넣고 `check.ok`·`sendable`을 끈다 → 번호 없음, `canSend` 꺼짐, `detailsMustOpen` 참 | (b) "I will refund you in full", "guarantee" |
| 3. 번역 중 "Translating…" + Send 꺼짐 · 끝나면 전송본·역번역 · 실패면 이유 | 고친 글이면 [Translate & check] (검사 전) → 번역 중 오른쪽 칸 "Translating…" + Send 꺼짐 → 끝나면 고친 글 기준 보기용 값(`buildReplyView` 같은 함수)으로 전송본·Details·약속 확인. AI 없음·한도 초과 → "AI unavailable — use the AI draft". 결과는 그 글자에 묶여 한 글자라도 바꾸면 검사 전으로 | (d), editGate 상태 시험 |
| 4. AI 초안 그대로면 지금처럼 | `editGate`는 글 = 초안이면 받은 관문 그대로. 고친 글 경로는 `getLlm()`(캐시·공개 모드 시간당 한도 그대로)을 쓴다 | 기존 t076·t079 |
| 5. 실제 호출 없음 · 개발 서버 없음 · `.env` 안 읽음 | 가짜 LlmCaller·가짜 호출기만. `npm run build`만 돌림 | — |
| 6. 환불 상태에서는 보내지 않음 | 화면: `desk.path === 'refund'` 또는 고친 글이 refundNow → `editGate` refund → Send 꺼짐 + "Refund is simulated in this demo — nothing is sent". 서버 입구: 고친 글이 refundNow(원래 초안엔 없음)면 AI 호출 전 거부 | "6. 환불 카드 상태" 3건 |

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_server/send.ts` | 끝에 "고친 글 입구 (T100)" 절 추가만: `prepareEditedReply`, `prepareEditedFromScreen`, 타입 2개 + import. 기존 `sendReply`·`sendFromScreen`·`resolveSendMode`·`guardLiveSend`·기억 규칙은 한 줄도 안 바꿈 |
| `src/app/cases/edited-reply.ts` (새) | 순수 함수: `revertToTokens`(날짜 긴 꼴·짧은 꼴, 이름, 서명, 금액 자리표시자. 긴 글자부터), `nameParts`/`nameLeftovers`, `editAdditions`, `withEditChecks` |
| `src/app/cases/reply-model.ts` | `editGate` 새 규칙(refund → 같은 글 → 검사 전/중/실패/완료), `EDIT_KEYS`, `EditStatus`, `EditedGate`, `EditedPrepareOutcome`. `EDITED_KEY`는 `case.reply.editedNeedsCheck` |
| `src/app/cases/actions.ts` | 서버 액션 `prepareEditedAction` (zod: 분쟁 번호·답장 번호·글 1~`DRAFT_INPUT_MAX_CHARS`자). `sendReplyAction` 무변경 |
| `src/app/cases/reply/reply-panel.tsx` | 고친 글 상태(`editRun`), 고친 글 보기용 값(`editedView`/`shownView`)으로 전송본·Details·약속 확인·자동 펼침, [Translate & check] 단추, 환불 상태, 보내기는 `replyId: sendId`(고친 글이면 서버가 준 번호) |
| `config/copy.en.json`, `config/copy.ko.json` | `case.reply.editedCantSend` → `case.reply.editedNeedsCheck`로 바꾸고 새 키 7개 (en=ko 키 같음) |
| `tests/unit/app-t100.test.ts` (새) | 23건: 되돌리기 3 · (a) 2 · (b) 3 · (c) 2 · (d) 3 · (e) 4 · 환불 3 · 문구·연결 3 |
| `tests/unit/app-t076/t079/t090/t091.test.ts` | 옛 규칙("고친 글은 보낼 수 없음")을 고정하던 단언을 새 규칙으로 (editGate 반환에 `translate`, 보내기 호출 `replyId: sendId`, 문구) |
| `reports/design-match/inventory.md` | Send 관련 행 근거 갱신: `onClick refundNow`·`onClick send`·`sc-if showKo` |

건드리지 않음: 미리보기 제목 문구·Today Prevent 행 (T099 몫), `src/ai/**`·엔진·계약, `.env`.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 | 0 | 9 skipped (기존 그대로) |
| npm test | 2438 | 0 | 첫 전체 실행에서 `storefront.test.ts > 결정론 100회`가 5초 시간 초과로 1회 실패 → 단독 실행 통과, 다음 전체 실행 통과 (부하 때 시간 초과. 이 작업과 무관) |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | |
| npm run build | 통과 | 0 | |

공개 모드 쓰기 0회: `app-send`·`ops-t070-gates` 시험 그대로 통과. (a)에서 실제 호출기 0회·가짜 1회.

## 남은 문제
- 화면 확인(스크린샷)은 하지 않았다 (개발 서버 금지). [Translate & check]는 `reply-button-quiet` 모양으로 Send 왼쪽에 붙는다 — UI 병합 전 스크린샷 확인 필요.
- 번역은 단추를 눌러야 시작한다 (글을 칠 때마다 자동으로 부르지 않음 — 공개 모드 시간당 AI 한도를 아끼고, 판매자가 한국어 전송본을 보고 다시 Send를 누르게). 자동 번역(멈춘 뒤 N초)이 필요하면 지연값을 `config/`에 둘 자리부터 정해야 한다.
- 이름 조각 검사는 막는 쪽으로 틀린다: 서명의 낱말("가게 이름")만 따로 써도 막힌다 (AI를 안 부르고 이유 한 줄).
- 고친 글에 원래 AI 초안에 있던 정책 밖 약속이 그대로 있으면 지금처럼 확인 상자로 푼다 (`sendReply` 3단계가 다시 본다). 고친 글이 **새로** 넣은 약속은 확인으로 풀리지 않는다.
- 고친 글 번역은 캐시에 없어 실시간 AI 2회(번역·역번역)를 쓴다 (DECISIONS 비용 항목대로).

## 컨트롤 타워에 요청할 결정
- 없음
