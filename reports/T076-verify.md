판정: 통과

# T076 검증 (73c89f9·c8cd2d4, 작업 사본 verify-tmp2)

## 1. 범위
- 바뀐 파일 44개: src/app/**, config/copy.{en,ko}.json, tests/unit/**, reports/T076-impl.md 뿐. 엔진·AI·PayPal·exec·types.ts·rules/params/reply-model.json·seed·acceptance·package.json diff 0줄.
- send.ts·mode.ts·activity.ts diff 0줄. actions.ts 무변경. 보내기 액션 인자 = {disputeId, kind, replyId, confirmedCommitments} (입력칸 글 없음).
- copy en/ko 키 집합 동일. 사본에 .env 없음(.env.example만).

## 2. 기존 테스트 7개 재작성 (단언 단위 비교)
- 안전 단언(관문 canSend, 엔진 금액 = recommend 값, 이름 토큰·마스킹, 배지 5종, 데모 모드) 약해진 것 없음. 모두 같은 뜻으로 옮김(예: 서연 화면 기대 손실 = recommend 값, "PayPal data only: Full refund $74" + Demo data, Assumption 배지 유지).
- 제거/완화된 것(구조 변경에 따른 것, 안전과 무관):
  - 비교 카드의 hero-number 1개 단언, "With carrier data · Reply" 문구 단언 → 선택지 카드 Best 1개 단언으로 대체.
  - 지호 카드: "꺼진 Send in Korean 버튼 + offerFirst 안내" 단언 → 버튼 자체를 그리지 않는 단언(`not.toContain('Send in Korean')`, 버튼 1개)으로 바뀜. 메시지 보내기가 더 못 일어나는 방향이라 약화 아님.
  - case-body @container 전면 금지 → .case-body에만 금지로 완화(좁은 폭 접기용).
- PayPal 파랑 금지 테스트(app-t067): 금지 색 6개 → 11개(#001C64·#0B48C4·#097FF5·#00A8EA·#009CDE 추가), 검사 대상 css → css+tsx+ts로 강화. 유지·강화 확인.

## 3. 실행
- npm test: 2111 통과 / 1 실패 — tests/unit/storefront.test.ts "결정론 100회"가 5000ms 시간 초과(변경 파일 아님, 엔진 시험). 단독 재실행 31/31 통과 → 부하로 인한 시간 초과(플레이크)로 판단. 새 32개 포함 나머지 전부 통과.
- npx tsc --noEmit: 처음엔 .next 잔여 타입(src/app/intro/page 없음) 오류, 빌드 후 재실행 종료 0 (오류는 사본의 낡은 .next 캐시 탓, 소스 문제 아님).
- npm run lint: 종료 0.
- npm run test:acceptance: 159 통과, 17 건너뜀(AC33 8 + AC13 9), 실패 0.
- npm run build: 종료 0.
- .next/static: AFTERLOOP_ 0, DEMO_MODE 0, client_credentials 0, api-m.sandbox 0, LLM_API_KEY 0 파일.

## 4. 완료 기준 (직접 만든 가짜 스크립트, 삭제함)
- 어댑터 null: curveView(null/[])·reactionView(null)·featureChips(null)·선택지 차지백 % 모두 null → 숨김. 어댑터 파일 3개 몸통은 null 반환(t076 테스트 + 코드 확인).
- 가짜 값 그대로: 점 3개+초안 점 → 점 수 일치, 큰 % "20%", "100% → 20%"(0.999→100% 반올림만); 반응 막대 p=0.333/0.4/0.267 → 33/40/27%, 비용 $12(=1234센트), 선택지 차지백 4%·50%·막힌 수 null. 반올림 외 계산 없음(t076 정적 검사로 숫자 상수 없음 확인).
- 선택지 카드 기대 손실 = recommend(7595·막힘·7400), best = 엔진 best. "PayPal data only" 줄 = recommend(전 보드).best (서연 Full refund $74, Demo data 배지) — 테스트(app-t068/app-case-view/t076)로 확인.
- CaseEvent: 서연 9건 = 주문 10/17(seed)·발송 10/18(seed)·추적 없음 10/18(sandbox)·배송사 10/21·10/30(seed)·시드 문의 11/2(seed)·11/9(seed)·실제 글 11/9 13:12(sandbox)·접수(sandbox). 판매자 답장·약속 없음. 날짜 전부 seed/입력 데이터와 동일. "11/9 두 줄"은 시드 문의(영어 긴 글)와 샌드박스 한국어 글이 다른 데이터라서 그대로 나온 것 — 지어낸 것 아님, 보고서 설명 맞음.
- 입력칸 ≠ 초안 → editGate가 {ok:false, 'case.reply.editedCantSend'} (공백 한 글자·빈 칸 포함), = 초안 → 받은 관문 그대로. reply-panel: gate = editGate(canSend…), send()는 gate.ok 아니면 return, 서버로 가는 값에 글 없음 → 서버가 기억한 검사받은 초안(replyId)만 전송.
- 목록: Lena·Yuki·통관부호 묶음·HEY·GAH 없음(src/app·copy.en grep; HEY/GAH는 제외 규칙 주석에만), 번호 PP-R-…, 서연 마감 11/30 (테스트 통과).
- PayPal 파랑 11개 값: src·config의 css·ts·tsx 코드에 0. 다만 src/app/globals.css 5행 주석에 "#003087·#0070E0·#0066F5"를 금지 설명으로 적어 둠(코드 아님, 테스트는 주석 제외하고 검사) — 경미.
- "Refund backup"·"refund you in full"·"Expected delivery"(화면 문구) 없음 (src/ai/prompts/classify.ts의 분류 설명 한 줄만 있고 무변경), $312·14 min 없음.
- 지호 카드: 제목 "Offer {percent} back ({amount})" — percent = paramsFromConfig().offerRate(엔진), amount = 엔진 계획 금액. 화면에 숫자 상수 없음(diff 추가 줄 grep).

## 5. delayDays
- 계산 위치: src/app/cases/history.ts `unansweredDays(events, now)` (case-detail.tsx:78에서 호출 → forecastBase.delayDays → 예측 입력). 정의: 마지막 판매자 답장 뒤 첫 구매자 글부터(답장 없으면 첫 구매자 글부터) 오늘까지 달력 일수(UTC 날짜 차), 답장 뒤 구매자 글 없으면 0. 서연: 11/2 → 11/11 = 9, 답장 뒤 글 없으면 0. types.ts의 "0 이상, 코드가 데이터에서 셈"과 일치.
- 참고: SPEC에는 delayDays 정의 문구가 없어 types.ts 주석만이 계약. 엔진 정의가 달라지면 history.ts 한 곳만 수정.

## 기타
- 스크린샷·390폭 확인은 이 검증 범위 밖(개발 서버 금지).
