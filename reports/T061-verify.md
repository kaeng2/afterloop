판정: 통과

대상: T061 64664fe·f83b6db (검증용 사본 f83b6db, 변경 없음). SPEC v2.10 일치.

## 1. 범위
- `git diff 2374c94..f83b6db` 30개 파일 모두 `src/app/{cases,today,_shared}`, `config/copy.{en,ko}.json`, `tests/unit/`, `reports/T061-impl.md` 안. 폴더 밖 0개.
- `src/app/_server/send.ts`, `page.tsx`, `layout.tsx`, `globals.css`, `src/ai`·`engine`·`paypal`·`exec`, `types.ts`, `rules.json`, `params.json`, `seed/`, `tests/acceptance/`, `package.json` 변경 모두 0줄.
- 사본에 `.env` 없음(`.env.example`만). 문구 en/ko 키 집합 차이 없음.
- 옛 테스트 수정은 구조가 바뀐 곳(원인 카드, case-stack, 배송사 카드 등)의 기대를 새 구조 기대로 바꾼 것이고 느슨해진 곳은 없음. 보내기 관문 테스트(`app-send.test.ts`)는 변경 0.

## 2. 실행
| 명령 | 결과 |
|---|---|
| npm test | 41 파일, 1904 통과, 0 실패 |
| npx tsc --noEmit | 오류 0 |
| npm run lint | 오류·경고 0 |
| npm run test:acceptance | 158 통과, 9 skipped, 0 실패 |
| npm run build | 종료 0 |
`.next/static` 안 Hannah·Fernwood·AFTERLOOP_·client_credentials·api-m.sandbox: 모두 0 파일.

## 3. 완료 기준
- 문구: "Not shipped" 화면 문구 0건 (문구 파일 grep. 남은 곳은 `model.ts` 주석과 AI 프롬프트 내부뿐 — 화면 아님). 요약 키 `case.view.summary.A1_A2`는 엔진 원인 전환(A1→A2)에서 나옴. "incl. {{amount}} of your time"은 가정값 `timeCostCents`에서 오고, 화면 코드 정적 검사에 2·200·$금액·Hannah·Fernwood 없음 (직접 grep도 0).
- 대화/검사/전송 모드 글자(꺼짐·켜짐·불허)/Today 5줄·HEY·GAH 없음·Mike Skipped·Autopilot 숨김(`SHOW_AUTOPILOT=false`)·`nav.tsx` 삭제(참조 0)·추적 표 `<table>` 한 개 사용(같은 열): `app-t061.test.ts` 36개가 각 항목을 단언하고 전부 통과. 단언 이름을 하나씩 읽어 지시서 문장과 대조함.
- 직접 만든 탐침(실제 연결 표 `config/demo-links.json` + 가짜 PayPal 호출기 + `sendReplyAction` 서버 액션 경유, 6개 모두 통과, 스크래치 파일은 삭제):
  - 가짜 모드 같은 답장 3번: 모두 성공, 실제 POST 0회.
  - 스위치 "1": 같은 계획 2번 → send-message POST 1회 (중복 방지 그대로).
  - 스위치 `true`·`0`·빈값·` 1`·`1 `·`2`·`yes`·`TRUE`: 모두 가짜 모드, POST 0.
  - 연습용(HEY)·옛 서연(GAH)·표 밖 ID: 가짜·실제 모두 차단, 호출 0. D3: 실제 모드 차단 (가짜 모드는 화면에 내는 분쟁이라 성공 — 설계대로).
  - `AFTERLOOP_SIMULATE_FAILURE`: 가짜 모드에서 paypal_error / already_replied / not_allowed / checks_failed 각각 실패 화면(문구는 기존 실패 문구); 빈 값·bogus·대문자 등은 무시되어 정상 성공; `AFTERLOOP_REAL_SEND=1`에서는 네 값이 있어도 정상 실제 전송 흐름(성공).
  - 지호: 실제 모드 `kind=offer` → make-offer 1회·send-message 0회, `kind=message`는 "offer first"로 차단 0회.
- 한계: 탐침의 "승인 없음" 항목은 내 가짜 응답 때문에 승인 단계 전에 다른 관문에서 막혀 단독 검증이 안 됨. 승인 없음 → 호출 0회는 변경 없는 `app-send.test.ts`(바)가 이미 통과로 확인.

## 4. 구현 보고서 "확인할 점"
- Send 버튼 ≈920px: **미확인 추정**. 개발 서버 금지라 화면 높이를 못 재었음. 컨트롤 타워 스크린샷으로 확인 필요 (초안이 길면 넘칠 수 있음, 보고서가 영어 초안도 접기로 옮기는 안을 적어 둠).
- 배송사 줄이 가장 최근 1건(Oct 30)만: 사실. `model.ts`가 마지막 이벤트 1건으로 `carrierLine`을 만든다 (Oct 18·21은 화면에서 빠짐, 지시서가 요구한 한 줄과 일치).
- Mike "in 90 days" 고정 문구: 사실 (문구 키 `case.routine.F1(.delivered)`에 90 고정, 코드가 계산하지 않음). 서수("3rd")는 보드의 이전 미수령 건수 +1로 데이터에서 옴.
- 90일 어긋남 위험: Mike(B04)의 앞선 두 주장 주문은 O09 2026-08-20(전액 환불)·O10 2026-09-14(승소), 세 번째가 O08 2026-10-16. 오늘 2026-11-10 기준 90일 창은 2026-08-12부터라 **첫 주장 주문이 82일 전 — 지금은 90일 안이나 여유 8일**. 분쟁 접수일은 주문일 이후라 더 여유는 있지만, 시연 날짜가 약 11/18 이후로 밀리면 첫 주장이 창 밖으로 나가 문장이 사실과 어긋날 수 있음 (판정 로직은 날짜가 아니라 건수라 문장만 어긋남). 위험 낮음, 영상 일정 안에서는 문제 없음.
- 미완(보고서가 이미 밝힘): T060 5번 Prevent 비율을 엔진 `pickPreventProduct`로 바꾸는 일은 T066 미병합으로 남김 (`pickPrevent` 그대로).

## 5. 막을 만한 결함
없음.
