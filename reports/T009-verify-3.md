판정: 통과

# T009 2부 독립 검증 (verify-3)

대상: `lane/ui` (`git log main..HEAD` = 762cad6, 48dc9a7). 코드·테스트·문서 수정 0, 서버 미기동, 실제 PayPal·LLM 호출 0회, `.env` 미사용.

## 근거
| 항목 | 결과 |
|---|---|
| 범위 (`git diff main...HEAD --stat`) | 16파일. 2부 수정 가능 파일(layout.tsx, reply-model.ts, actions.ts, reply/, _server/send.ts), 허용된 1부 파일(model.ts, view/case-view.tsx, view/case.css, view/risk-toggle.tsx), `config/copy.*.json`, 새 테스트 2개, `reports/T009-impl.md`. 밖의 변경 없음. `page.tsx`·`view/load.ts` 변경 없음 |
| 금지 폴더 변경 | `src/engine`·`src/paypal`·`src/exec`·`src/ai`·`seed`·`config/rules.json`·`config/demo-links.json`·`package.json`·`tests/acceptance` 모두 0줄 |
| 문구 파일 | `config/copy.*.json` 변경은 `case.` 키만. 두 파일 키 242개씩, 차이 0. 금지 문구(guarantee·보장·예측 정확도) 없음 |
| `npm test` | 37 파일, 1764 통과, 0 실패, 종료 0 |
| `npx tsc --noEmit` | 종료 0 |
| `npm run lint` | 종료 0 |
| `npm run test:acceptance` | 12 파일, 155 통과 + 9 건너뜀, 종료 0 |
| `npm run build` | 종료 0. `/cases/[disputeId]` (ƒ)와 `/preview/styleguide` (○) 있음 |
| 비밀값 검색 | `.next/static/`에서 `PAYPAL_CLIENT_SECRET`·`PAYPAL_CLIENT_ID`·`LLM_API_KEY`·`AFTERLOOP_`·`api-m.sandbox.paypal.com`·`client_credentials` 0건 |
| 화면이 계산하는지 | `src/app/`에서 74·37·7400·3680·1500 리터럴은 주석·`preview/styleguide/sample.ts`(1부 이전 파일, 이번 diff 밖)뿐. 점수·센트에 사칙연산 없음. 답장 문장(Sorry/죄송/refund 등)이 코드·문구 파일에 없음 |

## 안전 탐침 (`scratchpad/t009-verify-3/probe.ts`, `NODE_OPTIONS=--conditions=react-server`로 `sendReply`를 가짜 호출기로 직접 실행. 실제 연결 표 분쟁 번호 사용)
- 스위치: `undefined`, `"true"`, `"yes"`, `"0"`, `" "`, `"1 "` 모두 simulated. 정확히 `"1"`만 live.
- 가짜 전송(D2): 실제 호출기 0회, 가짜 호출기 1회, `readDetail` 0회. 결과 `mode: simulated` (화면은 "Simulated — nothing was sent to PayPal", "Sent · send-message 200" 표기 없음).
- 실제 전송(D2 `PP-R-GMS-10197661`): 첫 호출 1회. 같은 `call` 인스턴스로 두 번째 실행은 호출 1회 그대로 (같은 요청 번호 `al-6309…`로 이전 결과 반환). 호출기는 프로세스에 하나(`SIMULATED_CALLER`, 캐시된 `liveClient.call`)라 중복 방지가 유지됨. 요청마다 새 `call`을 만들지 않음.
- 판매자 글(`SELLER`)이 이미 있으면 호출 0회, `already_replied`.
- 승인 없음: 호출 0회 (`executeMove`가 거부).
- 거부(호출 0회): Mike `PP-R-FYT-10197651`(live, `liveNotAllowed`), 옛 서연 `PP-R-GAH-10197649`, 연습용 `PP-R-HEY-10197767`, 표에 없는 `PP-R-NOPE-1`. 연습용·옛 서연은 `showOnScreen:false`라 live·simulated 모두 `notOnScreen`으로 막히고, 이 화면으로 열 수도 없음 (코드: `linkFor`/`showOnScreen`).
- D1 `PP-R-MBJ-10197650`은 live 허용 (정상 흐름은 호출 1회).
- 제안이 먼저: 지호 꼴 보드(추천 offer, `make_offer` 허용)는 live·simulated 모두 호출 0회로 거부. 서버가 `loadDemoDisputes` → `pickBoard` → `recommend` → `offerComesFirst`를 같은 보드로 방금 다시 만들어 넘김. 화면 쪽 `offerFirst`는 1부 `buildCaseView`의 `offerComesFirst` 결과(같은 로드, 같은 보드의 추천)를 옮기고, 버튼 이유 키는 `case.view.offerFirst`.
- 정책 밖 약속: `outsidePolicy:['refund']` 미확인 시 0회 거부, 확인하면 1회. `addedInTranslation`이 있으면 확인해도 0회 거부. 서버 액션도 같은 판정 (`sendReply` 3번 단계, 서버 기억의 값 사용).
- 토큰 검사: 전송본에 날짜를 직접 씀 / 토큰을 뺌 → 0회 거부 (`checkTokens`를 서버에서 다시 돔). 화면 로드 때와 다른 `facts` → 0회 거부. 다른 분쟁의 답장 번호·`null` 답장 → 0회 거부.
- 날짜: `replyFacts` 값은 `2026-11-17`(ISO). 실제 나가는 본문은 "…11월 17일까지 다시 연락드릴게요" (`formatFact` → `fillTokens`). ISO 값이 그대로 나가지 않음. 화면용 `filledText`도 `formatFact`를 거침.
- 실패 두 가지 직접 확인: 422 → `paypal_error` + "…will not send twice", 예외 → `network` + 다시 시도 안내. 오류 문구에 토큰·응답 본문·예외 문장이 없음 (가짜가 던진 "Bearer abc secret"·`SECRET` 글자가 결과에 안 나옴).
- 서버 액션이 브라우저에서 받는 것은 분쟁 번호·답장 번호(`r-`+32 hex)·확인한 범주뿐 (zod). 금액·계획·`liveSendAllowed`·전송본을 받지 않음. 계획·승인(`planId`+시각)·사실값·연결 표는 서버가 다시 만듦. 글은 서버 기억(`rememberReply`)에서만 읽음.
- "판매자 메시지가 이미 있으면 거부": 실제 전송 직전 `getDispute`로 `posted_by==='SELLER'`가 있으면 막음. 서버 재시작 뒤·새로고침 뒤 재전송과 이미 답장한 분쟁을 막는 장치다. 서연 첫 답장은 판매자 글이 없으면 막히지 않음 (탐침에서 BUYER 글만 있을 때 1회 전송).

## "2부에 함께 넣는 것" 1~3 (코드 읽기 + 단위 테스트 통과)
1. 아래쪽 "Escalation risk" 카드 삭제됨 (`case-view.tsx`에서 `RiskDetails`·카드 제거, 주석에만 언급). 머리글 배지는 `<button aria-expanded aria-controls>` (`risk-toggle.tsx`), 펼친 내용은 `risk.parts`(엔진 `escalationRisk` 결과를 옮긴 값)와 `riskAfterReply`.
2. 상태 쉬운 말: `statusKeyFor`가 `copyTables.en`에 `case.status.<코드>`가 있을 때만 키를 돌려주고 없으면 `null` → 원래 코드만 표시. 키는 OPEN, WAITING_FOR_SELLER_RESPONSE("Waiting for your reply"), WAITING_FOR_BUYER_RESPONSE, UNDER_REVIEW, RESOLVED.
3. 원인 칸: `.card` 한 줄(`CauseCard`), 짧은 이름 `case.view.subtypeShort.*`, 화살표 `role="img"` + `case.view.arrow`, `Code decides` 배지 줄 끝에 한 번, `Demo data`는 오른쪽 칸. 통관 보류 상세(`causeNote`)는 원인 칸에서 빠지고 배송사 카드(`carrier.events`)에만 있음.

## 구현 보고서 주장 대조
- 맞음: 테스트 수(1764), build 결과, `.next/static` 0건, 가짜 전송은 `getDispute` 미호출·실제만 호출, 실패 네 가지 문구.
- 요청 1 (SPEC 기준 버전): 사실. 지시서 머리는 v2.7, `SPEC.md`는 v2.8. v2.8에서 바뀐 것은 O03 추적 등록 시험·AC13·T019/T020·2부 지시 자체이고 2부 범위와 충돌 없음.
- 요청 2 (AC18 6번 초안의 환불 문장): 사실. `findCommitments`로 "I'll refund you in full."(en)과 "전액 환불해 드릴게요."(ko) 모두 `['refund']`로 나옴 → 정책 밖 약속. 초안 대역 글 그대로면 확인 없이는 전송 불가.
- 요청 3 (인사말·서명): 사실. `draftReply` 입력의 `buyerFirstName`·`sellerName`은 선택값이고(`src/ai/reply.ts`), 호출 자리 `view/load.ts`는 이번 브랜치에서 수정되지 않았으며 이 값을 넘기지 않음. 2부 수정 허용 범위 밖.

## 발견한 문제
- 병합 차단: 없음.
- 병합 후 수정 / 결정 필요:
  1. AC18 6번 초안의 환불 문장 처리와 `view/load.ts`의 인사말·서명 입력은 컨트롤 타워 결정 사항 (구현 보고서 요청 2·3).
  2. 답장 서버 기억(`rememberReply`)이 프로세스 메모리다. 서버 재시작이나 인스턴스가 나뉘면 "reload" 안내로 거부된다 (호출 0회로 안전한 쪽). 녹화는 인스턴스 1개·재시작 없이.
- 기록만:
  - 지시서 머리 SPEC 버전(v2.7)이 현행(v2.8)과 다름.
  - 새로고침마다 LLM 3회 안팎(`draftReply` 1 + `translateReply` 2 + 어조 판정)이 돈다. 비용·지연 참고.
  - 가짜 전송에서도 분쟁 다시 읽기(PayPal GET)는 한다 (지시서 허용 범위의 읽기).
  - `already_replied` 판정은 `posted_by`가 `SELLER`인 글이 하나라도 있으면 막는다. 실제 D2에 이미 판매자 글이 있는지는 PayPal을 부르지 않아 확인하지 못했다. 있으면 녹화 때 첫 답장도 막힌다.

## 확인하지 못한 것
- 화면 모양은 보지 않았다 (서버·브라우저 미기동, 스크린샷 없음). 레이아웃·색·좁은 폭·키보드 포커스 모양은 판단하지 않았다.
- 실제 PayPal 전송, 실제 LLM 응답, 실제 D2의 메시지 목록, Next 서버 액션과 레이아웃이 `send.ts`의 메모리를 같은 모듈 인스턴스로 공유하는지(서버를 띄우지 않아 확인 불가. 공유하지 않아도 거부로 끝나는 안전한 실패).
- `tests/acceptance/drafts/AC18.md` 6~11번은 구현자의 단위 테스트와 내 탐침으로 대응시켰을 뿐, 컨트롤 타워가 옮긴 `.test.ts`는 아직 없다.
