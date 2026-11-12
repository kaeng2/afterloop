# T122f 보고 (2026-11-12 21:01)

- 기준 SPEC: v2.16   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-scenes / (이 보고서와 같은 커밋)

## 결과
완료 — 화면까지. repair 수가 AI 초안·번역 경로를 타서 지호 카드의 "What the buyer will receive (Korean)" 미리보기에 기간이 채워지고 화면의 [Send] 관문(`canSend`)이 켜진다. Lena·Yuki 상세는 `DemoItemCard`로 그린다.
**다만 서버 전송(`src/app/_server/send.ts`)은 repair를 아직 받지 않는다** — 아래 "컨트롤 타워에 요청할 결정" 1. 그 파일은 이 지시서의 수정 범위 밖이라 고치지 않았다.

실제 AI·PayPal 호출, 개발 서버 실행, `.env` 읽기는 하지 않았다 (가짜 LLM·가짜 PayPal 읽기로만 시험).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/view/load.ts` | `withMoveFacts(both, move)` 추가 (export): repair면 날짜·이름 토큰 뒤에 `⟦DAYS_1⟧` 사실값을 붙인다. 토큰·종류는 `repairFacts`(`src/ai/repair.ts`), 값은 `reply.repairDays`(5)의 **원래 값 `"5"`**. `loadCaseDraft`의 "T120b 전" repair 제외 줄을 풀고 이 함수로 초안 사실값을 만든다 |
| `src/app/cases/reply/load.ts` | "T120b 전" `move = repair ? null` 줄을 풀었다 (repair도 번역 경로). 사실값을 같은 `withMoveFacts`로 만든다 (초안 검사와 전송본 검사가 같은 토큰을 보게). 쓰기 관문·약속 검사·Simulated는 손대지 않았다 |
| `src/app/(app)/page.tsx` | 상세 `Pane` 분기만: `demoItemFor(id)`(시드 `seedDemoDisplay.demoItems`에서 `key`로 찾기)가 있으면 `<DemoItemCard item={demo} row={item.row} doneId={item.id} />`, 없으면 지금처럼 `CaseDetail`. 목록 쪽은 건드리지 않았다 |
| `tests/unit/app-t122f.test.ts` | 새 테스트 7개 (아래) |

`src/app/today/demo-item-card.tsx`는 고칠 것이 없었다 (시드 줄을 그대로 받는다). Lena 초안 문장은 시안 그대로 (지시서 3번).

### 값이 "원래 값"인 이유
`repairFacts(locale)`는 현지 표기 값("5영업일")을 낸다. 그런데 화면·전송 경로의 `fillFactTokens`(`reply-model.ts`, `send.ts`도 같은 함수)는 사실값을 **원래 값**으로 받아 `formatFact`로 언어별 표기를 만든다 (날짜 토큰과 같은 규칙). 현지 표기 값을 넣으면 `formatBusinessDays`가 예외를 던져 미리보기가 "채우지 못함"이 되고 [Send]가 꺼진다 (처음 시험에서 확인). 그래서 토큰·종류는 `repairFacts`에서 가져오고 값만 `String(repairDaysFromConfig())`로 둔다. `checkTokens`는 원래 값에서 언어별 표기를 모두 만들어 직접 쓴 값을 찾으므로 검사는 그대로 걸린다. 설정에 기간이 없으면 사실값을 넣지 않는다 (프롬프트가 기간 문장을 뺀다).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| `npm run test:acceptance` | 182 (9 skipped) | 0 | 16 파일 |
| `npx vitest run tests/unit` | 2724 | 2 | 아래 — 둘 다 이 작업과 무관 |
| `npx vitest run tests/unit/app-t122f.test.ts` | 7 | 0 | |
| `npx tsc --noEmit` | 통과 | 0 | |

새 테스트 (`app-t122f.test.ts`):
- 전제: 지호(B3) 보드 추천 = repair, `repairDaysFromConfig()` = 5
- `loadReply`: 가짜 LLM 3회(초안·번역·역번역), 프롬프트에 `move: repair`·`⟦DAYS_1⟧ (DAYS)`만 있고 "영업일·business days" 값은 없다
- 미리보기: 영어 "about 5 business days", 한국어 "받은 날부터 5영업일 정도", 남은 토큰 없음, `replyId` 있음, plan = repair/`send_message`, mode = simulated, `canSend` ok
- 약속 검사 그대로: 환불을 약속한 repair 초안 → `outsidePolicy`에 refund, 확인 전 `canSend` 꺼짐
- 두 load 파일에 "T120b 전" 임시 코드 없음
- page.tsx `Pane`이 `CaseDetail` 앞에서 `DemoItemCard`를 그린다 / 시드 Lena·Yuki 줄로 카드가 그려진다 (Demo data · Simulated)

실패 2개 (이 작업과 무관):
- `app-t091.test.ts` "타이핑 34ms마다 2글자": `config/motion.json`이 bc19d4c(컨트롤 타워 "v6 typing 32ms/1")에서 32ms/1로 바뀌어 기대값 34/2와 다르다. 테스트 쪽 갱신이 필요하다 (T122d 또는 컨트롤 타워).
- `storefront.test.ts` "결정론 100회": 전체 실행 때만 시간 초과. 단독 실행에서는 통과 (3.4초).

## 남은 문제
- **서버 전송이 repair를 막는다 (코드 읽기로 확인, 테스트는 하지 않음).** 화면의 [Send]는 켜지지만 누르면 서버 `sendReply`가 거부할 것이다:
  1. `src/app/_server/send.ts:366` `wantMove = kind === 'offer' ? 'offer' : 'fight'` → repair 추천이면 `best.move !== wantMove` → `case.send.error.noPlan`.
  2. 그것을 지나도 `send.ts:383` 사실값을 `caseReplyFacts(...).outgoing`으로 다시 만들어 화면 때 값(`⟦DAYS_1⟧` 포함)과 비교한다(`sameFacts`) → `case.send.error.factsChanged`.
  3. 고친 글 다시 번역(`send.ts:542` `best.move !== 'fight'` → noPlan)도 같다.
- `withMoveFacts`는 `view/load.ts`에서 export했다. 서버 전송이 같은 함수를 부르면 사실값이 맞는다.
- AI 캐시(`data/ai-cache`)에 repair 초안이 없다 — 컨트롤 타워가 다시 만든다 (지시서대로).
- 병합 충돌 예상: T122d(lane/ui-desk 2faf5cb)가 같은 `Pane` 자리에 `if (item.kind === 'demo') return null;`을 넣었다. 병합 때 그 줄 대신 이 브랜치의 `demoItemFor` 두 줄을 남기면 된다 (`item.kind === 'demo'`와 상관없이 id로 찾으므로 T122d의 `kind` 추가와 같이 써도 된다).

## 컨트롤 타워에 요청할 결정
1. **`src/app/_server/send.ts`에서 repair 전송 허용 (ui 레인 다른 태스크, 몇 줄).** ① 메시지 전송의 `wantMove`를 "추천이 repair면 repair"로(`plan.apiMove === 'send_message'`는 엔진이 이미 보장 — `src/engine/plan.ts:78`), ② 7번 사실값을 `withMoveFacts(caseReplyFacts(...), best.move).outgoing`로 다시 만들기, ③ 고친 글 경로(`best.move !== 'fight'`)도 같이. 그래야 지호 [Send]가 Simulated로 끝까지 간다. 그 전까지 지호 [Send]를 누르면 "noPlan" 오류 문구가 보인다.
2. `FactToken['kind']`(`src/types.ts`)에 `'DAYS'`가 아직 없다 (`src/ai/tokens.ts` 주석 "컨트롤 타워 결정 대기"). 이 작업은 `repairFacts`가 만든 값의 종류를 그대로 써서 계약을 건드리지 않았다.
