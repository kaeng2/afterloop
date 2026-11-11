# TASKS (작업 보드)

- 기준: SPEC v2.2 · 갱신 2026-11-09 21:02 KST · 컨트롤 타워만 수정
- 기준 문서: `inbox/2026-11-09-prd-v2.md` + `inbox/2026-11-09-prd-v2-review.md` (검토 우선)
- 상태: 대기 / 진행중 / 검토 / 완료 / 보류. 작업 하나는 2시간 이내. P1은 P0가 끝난 뒤.
- 인수 테스트: AC1~AC14, AC17 잠금 (AC1~AC10 v2 승인 2026-11-09, AC17 v2.2). 그 밖의 AC15 이후는 작성 예정. 완료된 작업의 기준 SPEC은 병합 시점 값(v2.1)을 그대로 둔다.
- **동시에 돌리는 작업 세션은 2개까지.** 컨트롤 타워가 자동 배분한다 (CLAUDE.md "운영 모드: 자동 배분"). 순서: ① T004 + T007 → ② T002 + T008 → 그다음은 컨트롤 타워가 정한다
- 진행 기록: `reports/STATUS.md`

## P0

| ID | 작업 | 레인 | 상태 | 기준 SPEC | 의존 | 완료 기준 · 비고 |
|---|---|---|---|---|---|---|
| T000 | 하네스: 계약·인수 테스트·잠금·운영 문서 | 컨트롤 타워 | 완료 | v2.1 | — | AC1~AC14 |
| T001 | 샌드박스 세팅 (M8): US 비즈니스 + 개인 5, 주문 12·추적 7·분쟁 3, manifest, `sandbox:check` | paypal | 완료 | v2.2 | — | **1단계 완료** (병합 2026-11-09 23:15): AC13 오프라인 2개 통과, PayPal 연결 정상, 요청 ID 61자 통과. **주문 12건 승인·캡처 완료 (2026-11-10 08:18), 추적번호 7건 등록 완료 (08:25).** **분쟁 3건 접수·manifest 기록 완료 (2026-11-10 09:00).** `RUN_SANDBOX=1` AC13: 11개 중 10개 통과, **1개 실패 — D2·D3(미수령)가 `INQUIRY`가 아니라 `CHARGEBACK`(PayPal 심사) 단계** → Q14 결정: 서연 분쟁을 추적 없는 O13에 다시 접수(성공), AC13 기대값을 v2.3으로 고침. **2단계 완료 (2026-11-10 10:26): `RUN_SANDBOX=1` AC13 11/11 통과** (주문 13건 캡처, 구매자 5명, 추적 7·미등록 6, 분쟁 D1·D2 합의 단계 · D3 PayPal 심사, 비밀값 없음). `reports/T001-impl.md`, `reports/T001-verify.md` |
| T002 | OAuth 클라이언트 | paypal | 완료 | v2.1 | — | AC14 통과 (14개), 단위 86. 병합 2026-11-09 22:02 (검증 통과 뒤 비밀값·경로 보강 재시도 → 재검증 통과). `reports/T002-impl.md`, `reports/T002-verify.md` |
| T003 | 분쟁 읽기: 목록·상세 조회 + mapper → `BoardState` | paypal | 완료 | v2.2 | T002 | 병합 2026-11-09 23:09. 단위 85개 (fixture 기준). 실제 분쟁 3건으로의 확인은 분쟁 접수 뒤. AC15는 작성 예정. `reports/T003-impl.md`, `reports/T003-verify.md` |
| T004 | 엔진: 기대 손실·추천·오토파일럿 판정 | engine | 완료 | v2.1 | — | AC1~3·5·6·8~10 통과 (27개). 병합 2026-11-09 21:24. `reports/T004-impl.md`, `reports/T004-verify.md` |
| T005 | 엔진: 실행 계획 `planMove` + 제안률 정책 검증 | engine | 완료 | v2.1 | T004 | AC4, AC10 통과 (5개). 병합 2026-11-09 22:14. 후속(평가와 보드 대조)은 T018에서. `reports/T005-impl.md`, `reports/T005-verify.md` |
| T006 | 원인 분류: 규칙 우선 + LLM (16개 세부 유형) | ai | 완료 | v2.2 | — | 병합 2026-11-10 00:53. 단위 57개 (가짜 응답만, 실제 LLM 호출 없음). AC16은 작성 예정. 다듬기는 T032. `reports/T006-impl.md`, `reports/T006-verify.md` |
| T032 | 원인 분류 다듬기: 기본 모델 `claude-opus-5-5`, 개인통관고유부호 변형 표기 가림, LLM 제한 시간, 다시 묻지 않을 오류 | ai | 완료 | v2.2 | T006 | 병합 2026-11-10 02:10 (1차 검증 실패 → 재시도 → 재검증 통과). 단위 170개. `reports/T032-impl.md`, `reports/T032-verify.md` |
| T007 | 시드 데이터 (원문 6장) | data | 완료 | v2.1 | — | 병합 2026-11-09 21:41 (1차 검증 실패 → 재시도 통과). 단위 38개. **AC17은 Q10 결정 뒤 작성·승인.** `reports/T007-impl.md`, `reports/T007-verify.md` |
| T008 | 실행 `executeMove` | paypal | 완료 | v2.1 | — | AC11, AC12 통과 (10개). 병합 2026-11-09 21:57. `reports/T008-impl.md`, `reports/T008-verify.md` |
| T027 | 실행 보강: 직접 쓴 금액·남은 토큰·빈 메시지 거부, 검증 순서, 영어 문구 | paypal | 완료 | v2.1 | T008 | AC11·AC12 유지 (10개), 단위 130. 병합 2026-11-09 22:26. 남은 다듬기는 P1 (DECISIONS). `reports/T027-impl.md`, `reports/T027-verify.md` |
| T010 | 사실값 토큰 + 번역 검사 (모든 AI 초안에 적용, 결정 4) | ai | 완료 | v2.2 | — | 병합 2026-11-10 00:06 (1차 검증 실패 → 재시도 → 재검증 통과). 단위 94개. AC20은 작성 예정. 다듬기는 T031. `reports/T010-impl.md`, `reports/T010-verify.md` |
| T031 | 토큰 검사 다듬기: 한국어 정상 문장이 금액으로 잡히는 오탐, 자리표시자 속 개인통관고유부호 가림, `100%` 약속 기준 | ai | 완료 | v2.2 | T010 | **사람 결정(Q13)으로 병합 2026-11-10 07:43.** 검증 3회는 실패 판정이었음. 남은 것: 띄어 쓴 `원`·`불` 금액 일부를 놓침 → T033, `100%` 상품 설명 일부가 막힘 → 그대로 둠. `reports/T031-impl.md`, `reports/T031-verify.md` |
| T033 | 토큰 검사: 띄어 쓴 `원`·`불` 금액을 놓치지 않게 (`24 불이었습니다`, `5 불이`, `칠 불`) | ai | 완료 | v2.2 | T031 | 병합 2026-11-10 08:26. 지시된 꼴 12,000개 중 놓침 0 (이전 7,810). 단위 147개. `reports/T033-impl.md`, `reports/T033-verify.md` |
| T035 | 토큰 검사: `만일 원치 않으시면` 오탐, 목록 낱말과 첫 글자가 겹치는 금액(`24 원하고`, `24 원인 경우`, `24 불가량`) | ai | 완료 | v2.2 | T033 | 병합 2026-11-10 09:07. `만일` 문장 50/50 통과, 지시된 겹침 꼴 330/330 막힘. 단위 161개. 새로 막힌 정상 문장 1개(`…생긴 일이 원인인 만큼…`) — 막는 쪽이라 둠. `reports/T035-impl.md`, `reports/T035-verify.md` |
| T026 | 샌드박스 주문 생성·캡처 스크립트: `scripts/create-sandbox-orders.ts`(시드 주문 12건 → Orders v2 create, 승인 링크를 `reports/sandbox-approve-links.md`에) + `scripts/capture-sandbox-orders.ts`(승인 뒤 캡처) | paypal | 완료 | v2.2 | T002, T007 | 병합 2026-11-09 23:33. 주문 12건 생성(201 × 12), 링크 12개 모두 sandbox. **캡처는 아직 실행 안 함** (사람 승인 뒤). 주문은 만든 지 3시간쯤 지나면 만료될 수 있어 아침에 링크를 다시 만들어야 할 수 있음. `reports/T026-impl.md`, `reports/T026-verify.md` |
| T029 | 샌드박스 보조: 실제 분쟁 목록 읽기 확인(빈 목록), 주문 12건 상태 확인, 링크 다시 만들기(`--fresh`), `disputes` 단계 수정 | paypal | 완료 | v2.2 | T001, T003, T026 | 병합 2026-11-09 23:51. 실제 샌드박스에서 분쟁 0건(빈 목록) 확인, 주문 12건 모두 CREATED (만든 지 20분 뒤). `reports/T029-impl.md`, `reports/T029-verify.md` |
| T030 | 주문 스크립트 보호: 캡처·승인된 주문을 덮어쓰지 않게, `--` 빠진 실행 막기, 캡처 결과 구분 | paypal | 완료 | v2.2 | T026, T029 | 병합 2026-11-10 00:28. 실호출 0회. 실제 manifest 사본 + 가짜 PayPal 확인 369개. 아침 실행 순서는 `reports/T030-verify.md`. `reports/T030-impl.md` |
| T036 | 시드의 서연 분쟁 문장을 실제 접수 문장과 같게 (PayPal 120자 요구로 늘린 문장) | data | 완료 | v2.2 | T028 | 사람 지시 2026-11-10. AC17 기대 문장은 컨트롤 타워가 먼저 바꿈. 병합 2026-11-10 09:15. 바뀐 것은 서연 11/09 문의 1건의 두 칸뿐, 독립 검증 통과. `reports/T036-impl.md`, `reports/T036-verify.md` |
| T037 | 구매자 글을 `evidences[].notes`에서도 읽기 (실제 INR 분쟁 2건은 `messages`가 없다) | paypal (클라이언트) | 완료 | v2.2 | T003 | 1차는 `lane/paypal`에 잘못 배분되어 `src/**` 잠금에 막힘 (배분 실수) → `lane/paypal-client`로 재시도. 병합 2026-11-10 09:27. 독립 검증 통과 (탐침 74항목). 실제 분쟁 3건에서 구매자 글 1건씩 읽힘 확인. `reports/T037-impl.md`, `reports/T037-verify.md` |
| T038 | `sandbox:disputes` 출력에 `status`·`buyerTexts`·`otherActions` 칸 | paypal | 완료 | v2.2 | T037 | 실호출 없음. 병합 2026-11-10 09:40. 독립 검증 통과 (탐침 36개). 실제 조회로 새 칸 확인. `reports/T038-impl.md`, `reports/T038-verify.md` |
| T039 | 샌드박스 스크립트를 v2.3 구성에 맞추기: manifest `demoExcluded`, 시드에 없는 주문(O13) 보존, check 13건, 분쟁 걸린 주문은 추적 등록 제외 | paypal | 완료 | v2.3 | T038 | 실호출 없음. 병합 뒤 컨트롤 타워가 실제 AC13 재실행. 병합 2026-11-10 10:26. 독립 검증 통과 (탐침 160개 중 158). 실제 AC13 11/11. `reports/T039-impl.md`, `reports/T039-verify.md` |
| T040 | 합의 단계에서는 답장(fight)을 `send_message`로 (Q15) | engine | 완료 | v2.4 | T004 | AC8 새 검사 1건. 병합 2026-11-10 11:00. 독립 검증 통과: 보드 73,984개에서 기대 손실 불변, 시뮬레이션 결과 동일. `reports/T040-impl.md`, `reports/T040-verify.md` |
| T041 | 요청 번호를 36자 이하 해시로 (Q11) | paypal (실행) | 완료 | v2.4 | T008, T027 | 계약 변경 없음. 병합되면 사람에게 "O04 분쟁 걸 차례" 알림 → 연습용 분쟁에서 실제 전송 시험. 병합 2026-11-10 11:00. 독립 검증 통과: 요청 번호 정확히 36자, 10만 개 충돌 0. 후속 T049. `reports/T041-impl.md`, `reports/T041-verify.md` |
| T042 | **AI 답장 만들기**: 코칭, 영어 초안, 구매자 언어 전송본, 역번역 (선행 1순위) | ai | 완료 | v2.4 | T006, T010 | 실제 AI 호출 없음 (병합 뒤 컨트롤 타워가 서연 건으로 시험). 병합 2026-11-10 11:09. 독립 검증 통과 (실패 응답 46가지 예외 0). 실제 AI로 서연 건 시험: 전송 가능, 14초. 후속 T050. `reports/T042-impl.md`, `reports/T042-verify.md` |
| T049 | 실행의 중복 방지 기억을 요청 번호 기준으로 (지금은 계획 ID 기준이라 같은 분쟁의 두 번째 메시지가 같은 `call`에서 나가지 않는다) | paypal (실행) | 완료 | v2.5 | T041 | T041 검증 후속. 화면이 `call`을 재사용하면 드러난다. 병합 2026-11-10 11:27. 독립 검증 통과 (탐침 26개). `reports/T049-impl.md`, `reports/T049-verify.md` |
| T050 | AI 답장 다듬기 (T042 검증 후속 5건): 시스템 프롬프트의 예시 값이 서연 건 실제 값, 이름·메모 줄바꿈으로 지시 줄 끼워 넣기, 판매자가 글자로 적은 날짜·금액이 조용히 빠짐, 코칭 줄 검사 없음, 실패 사유 코드 | ai | 완료 | v2.5 | T042, T043 (같은 레인) | 화면 전에. 병합 2026-11-10 11:49. 독립 검증 통과. 실제 AI 재시험: 전송 가능. `reports/T050-impl.md`, `reports/T050-verify.md` |
| T051 | 단위 테스트가 실제 manifest의 분쟁 수(4건)에 묶여 있어 연습용 분쟁을 넣자 1건 실패 → 수에 묶이지 않게 + `sandbox:check`·`setup`이 연습용 분쟁(`P…`)을 다루는지 확인 | paypal | 완료 | v2.5 | T039 | 병합 2026-11-10 11:39. 독립 검증 통과 (탐침 637개, 변조 20종 중 19종을 테스트가 잡음). main 단위 테스트 실패 0. `reports/T051-impl.md`, `reports/T051-verify.md` |
| T052 | 제안이 먼저: 엔진 함수 `offerComesFirst(board, recommendation)` (추천이 제안이고 `make_offer`가 허용되면 참) | engine | 완료 | v2.6 | T040 | 사람 지시 2026-11-10. 화면(T009)과 서버 액션이 이 판정을 옮긴다. 병합 2026-11-10 11:47. 독립 검증 통과 (보드 39,168개 대조, 추천·계획·시뮬레이션 결과 불변). `reports/T052-impl.md`, `reports/T052-verify.md` |
| T053 | 답장 속 날짜의 뜻을 프롬프트에 넘기기 + 정책 밖 약속(재발송·환불·할인·무료 배송 등) 막기 | ai | 완료 | v2.7 | T042, T050 | 사람 결정 2026-11-10. 병합 뒤 실제 AI로 서연 답장 3번 비교. 병합 2026-11-10 12:20. 독립 검증 통과. 실제 AI 3번 비교: 날짜의 뜻·약속이 매번 같음. 후속 T054. `reports/T053-impl.md`, `reports/T053-verify.md` |
| T054 | 약속 낱말 보강: 돌려 쓴 약속을 놓친다 ("send you a new sweater", "send it out again", "pay you back", "cover the shipping", "10 percent off", "새 제품을 보내", "돈을 돌려", "お返しします") | ai | 완료 | v2.7 | T053 | 모델 `claude-sonnet-5-5` (작은 수정). T053 검증 후속. 병합 2026-11-10 12:29. 1차 검증 실패(느려지는 식) → 재시도 → 재검증 통과. `reports/T054-impl.md`, `reports/T054-verify.md`, `reports/T054-verify-2.md` |
| T055 | 시드의 서연 11/02 문의 문구를 배송사 기록과 맞추기 ("며칠째 '통관 보류'에서 그대로") | data | 완료 | v2.8 | T045 | 모델 `claude-sonnet-5-5`. 사람 결정 2026-11-10. `tasks/T055.md`. 병합. 독립 검증 통과(Sonnet). `reports/T055-impl.md`, `reports/T055-verify.md` |
| T043 | 어조 판정 (화난 어조 +1, LLM) | ai | 완료 | v2.5 | T042 (같은 레인) | 서연 선행 2. 병합 2026-11-10 11:25. 독립 검증 통과. 실제 AI: 서연 화남, 지호·Mike 아님. `reports/T043-impl.md`, `reports/T043-verify.md` |
| T044 | 확대 위험 신호 뽑기 (`EscalationSignals`) + **답장 속 확인 기한 날짜** (`followUpDate`, AC30) | engine | 완료 | v2.5 | T040 (같은 레인), T018 | 서연 선행 3. AC30 파일은 컨트롤 타워가 `lane/engine`에 먼저 넣는다 (main의 타입 검사를 깨지 않으려고). 병합 2026-11-10 11:24. 독립 검증 통과, AC30 9건. `reports/T044-impl.md`, `reports/T044-verify.md` |
| T045 | 시연용 배송사 데이터 `seed/carrier-events.json` (서연 O01: 발송 → 이동 중 → 통관 보류, Mike O08: 발송 → 배송 완료) | data | 완료 | v2.5 | T028 | 서연 선행 4. 계약 승인됨 (v2.5). AC17 새 검사 5건 통과. 병합 2026-11-10 11:15. 독립 검증 통과. `reports/T045-impl.md`, `reports/T045-verify.md` |
| T046 | 실제 분쟁 ↔ 시드 연결 표 `config/demo-links.json` (화면에 보임 · 실제 전송 허용) | 컨트롤 타워 | 완료 | v2.5 | T039 | 데이터 + AC29 (8건 통과). 읽는 코드는 T047. 연습용 분쟁이 걸리면 한 줄 추가 |
| T047 | 화면 공용 뼈대 (레이아웃·배지·문구 읽기·실제 분쟁 읽기 서버 함수). AG Grid 설치는 컨트롤 타워 | ui | 완료 | v2.6 | T046 | 화면 5개의 맨 앞 (1시간) 병합 2026-11-10 (사람 스크린샷 확인 2차 뒤). 디자인 기준의 정본. `reports/T047-impl.md`, `reports/T047-verify.md`, `reports/T047-verify-2.md`, `reports/screens/T047/` |
| T048 | 가게 합계를 내는 엔진 함수 + 점 그림용 "미래 하나 고르기" | engine | 완료 | v2.7 | T015 | S1·S2 선행. 모델 `claude-opus-5-5`. 가게 합계는 센트 합(71718¢ → 25316¢ = $717 → $253). `tasks/T048.md`. 병합 2026-11-10 12:43. 독립 검증 통과(Sonnet): 기존 시뮬레이션 결과 불변(192건 대조). `reports/T048-impl.md`, `reports/T048-verify.md` |
| T034 | 주문 생성 본문에 승인 뒤 돌아갈 주소 추가 (`return_url`·`cancel_url`·`user_action: PAY_NOW`), `payer-action` 링크 처리 | paypal | 완료 | v2.2 | T026, T030 | 병합 2026-11-10 08:39. 실호출 없이 검증 (지금 12건은 캡처 완료라 새 본문이 실제로 나간 적은 없음). `reports/T034-impl.md`, `reports/T034-verify.md` |
| T011 | 추적번호 일괄 등록: 주문 상세로 미등록 판정 → `/track` 주문별 반복, 건별 결과 | paypal | 완료 | v2.7 | T002 | AC21 (작성 예정). M3 **안전 규칙 (v2.3, SPEC 9-3)**: 분쟁 걸린 주문(O01·O02·O08·O13) 제외, 실호출 시험은 O03·O04·O05·O07만. 모델 `claude-sonnet-5-5`, `lane/paypal-client`. 기본은 dry run, 실호출 허용은 O03뿐. `tasks/T011.md`. 병합 2026-11-10 12:43. 독립 검증 통과(Sonnet). 실제 등록 시험(O03 1건)은 사람 확인 뒤. `reports/T011-impl.md`, `reports/T011-verify.md` |
| T015 | 시뮬레이션 `sim` (원문 9장): 500개 미래, 같은 난수, P10~P90, 폭포 | engine | 완료 | v2.2 | T004 | 병합 2026-11-09 23:00. 가디건 $216 → $44, 합계 $718 → $254 (기획자 공유 필요). **AC22는 Q12 결정 뒤 작성·승인.** `reports/T015-impl.md`, `reports/T015-verify.md` |
| T028 | 시드 v2.2: 종결 손실 재계산 (합 40800 → 41300¢), `SeedDispute.orderId`, `SeedOrder.date` | data | 완료 | v2.2 | T007 | AC17 통과 (56개). 병합 2026-11-09 22:52. `reports/T028-impl.md`, `reports/T028-verify.md` |
| T018 | 확대 위험 점수 (원문 10-4 + M4) + `planMove` 보강 | engine | 완료 | v2.1 | T005 | AC7 통과 (5개). Q2 미확정 (임시 7 → 4). 병합 2026-11-09 22:31. `reports/T018-impl.md`, `reports/T018-verify.md` |
| T019 | Transaction Search 조회 + 캐시 ('cached' 배지) | paypal | 완료 | v2.8 | T002 | AC25 (작성 예정). 실호출 4종 중 하나 (M7) 모델 `claude-sonnet-5-5`, `lane/paypal-client`. `tasks/T019.md`. 병합. 독립 검증 통과(Sonnet). 실제 조회 1회: 200, 지난 30일 판매 거래가 상품명·금액·국가와 함께 읽힘. `reports/T019-impl.md`, `reports/T019-verify.md` |
| T020 | AI 색상 문구: 분쟁 메시지에서 공통 불만 → EN·KO·JA·DE + 역번역 | ai | 완료 | v2.8 | T010 | AC26 (작성 예정). F5 모델 `claude-opus-5-5`. 기본 문구 없음(실패 시 S2가 숨김). `tasks/T020.md`. 병합. 독립 검증 통과(Sonnet). 실제 AI 2회 모두 성공(7~9초). 후속: 수 낱말·지어낸 사실·돌려 쓴 장담을 코드가 못 거름(기록). `reports/T020-impl.md`, `reports/T020-verify.md` |
| T021 | FAQ 자동 답변 (오토파일럿 `common_questions`, Yuki 사이즈 문의) | ai | 보류 (범위 제외) | v2.2 | T010 | AC27 (작성 예정). 이메일은 시뮬레이션 지시서 초안 `tasks/T021.md`. 판매자 정책 데이터와 FAQ 판정 코드가 없어 범위 결정 필요 **2026-11-10 사람 결정: 이번 범위에서 뺀다** (SPEC v2.9) |
| T009 | **S5 Case** (서연 SC4): 대화 토글, AI 원인 ↔ 코드 점수, 코칭 → 영어 초안 → 한국어 전송본 → 토큰 검사 → send-message | ui | 진행중 (2부) | v2.2 | T003, T006, T008, T010, T018 | AC18 (작성 예정). 대표 시나리오 **v2.3**: 배송사 정보 반영 전(환불 추천) → 후(답장 추천) 두 값을 나란히 (SPEC 2장). 실제 전송은 시연 녹화 때 한 번만 (SPEC 9-4). 2부 재시도 중 (배치·이름 토큰·미리보기 채움·지호 제안 버튼, SPEC v2.9) |
| T056 | 답장 이름 토큰 ⟦BUYER_NAME_1⟧·⟦SELLER_NAME_1⟧ (`nameFactsPair`, 프롬프트에 이름 값 없음, 호칭 겹침 막기) | ai | 완료 | v2.9 | 계약 v2.9 | AC32 | 모델 `claude-opus-5-5`. T009 2부 재시도 앞. `tasks/T056.md` |
| T057 | 제안 답장 문장 꼴: "PayPal에서 제안을 수락하면 바로 환불" (답장으로 수락 금지) | ai | 완료 | v2.9 | T056 | 실제 AI 3회(컨트롤 타워) | 모델 `claude-sonnet-5-5`. `tasks/T057.md` |
| T058 | 확인 칸: 초안에 쓰이지 않은 사실값 줄 숨기기 (지호 Follow-up date) | ui | 완료 | v2.9 | T009 | — | 모델 `claude-sonnet-5-5`. `tasks/T058.md` |
| T059 | 시드 B04 이름 "buyer_m***" → "Mike Morgan" | data | 완료 | v2.10 | — | — | 모델 `claude-sonnet-5-5`. `tasks/T059.md` |
| T060 | **공용 틀**: 위쪽 막대(Today(N)/Products, Autopilot, PayPal activity, 판매자 칩) + Today 목록·상세 틀 + 서랍 껍데기 | ui | 완료 | v2.10 | T058, T059 | 스크린샷 1440 | 모델 `claude-opus-5-5`. `tasks/T060.md` |
| T061 | **서연 상세 합치기** (오른쪽 칸 한 프레임 1920×1080: 머리글 → 비교 카드(+incl. $2) → 한 줄 요약 → 한국어 말풍선+배송사 줄 → 코칭 접기·한국어 크게 → 검사 3줄 → 보내기), 전송 모드 표시, 연습용 실패 화면, Mike 한 줄, Autopilot 토글 숨김 | ui | 완료 | v2.10 | T060 | 스크린샷 1440·1920 | 모델 `claude-opus-5-5`. `tasks/T061.md` |
| T062 | **Products**: 큰 숫자($216 → $44) + 점 그림(4 → 2) + 처방 카드 4개(통관 안내 Simulated) + 거래 조회 한 줄. 폭포·분포 막대 없음 | ui | 완료 | v2.10 | T061 | 스크린샷 1440 | 모델 `claude-opus-5-5`. `tasks/T062.md` |
| T063 | **추적 항목 상세**: [Add both to PayPal], O05·O07은 녹화 때만 실제, 분쟁 주문 회색 | ui | 대기 (T065 뒤) | v2.10 | T065 | 스크린샷 1440 | 모델 `claude-opus-5-5`. `tasks/T063.md` 등록 버튼은 T067로 당김 — 남은 것은 등록 뒤 목록 갱신·기록 연결 확인 |
| T066 | 엔진: Today Prevent 상품 고르기 `pickPreventProduct` (줄어드는 비율 최대) | engine | 완료 | v2.10 | — | — | 모델 `claude-sonnet-5-5`. `tasks/T066.md` |
| T067 | **공용 틀 디자인 = 시안 값** (전체 폭, 목록 #F1EFEA·상세 흰색, Figtree+Noto Sans KR, 카드 2px·16~24px, 알약, 점=위험 등급·배지=상태, 고른 항목 그림자, 로고 마크) + 추적 표 "Add both to PayPal" 버튼(T063에서 당김) | ui | 완료 | v2.10 | T061, T066 | 스크린샷 1920·1440 | 모델 `claude-opus-5-5`. `tasks/T067.md` |
| T068 | **서연·지호 상세 한 줄기 재배치** (머리글 → 전체 폭 비교 카드+요약 한 줄 → 말풍선 → 칩 → 답장 좌우 두 칸 같은 글자 크기 → 검사 한 줄+Send) | ui | 완료 | v2.10 | T067 | 스크린샷 1920 서연·지호 + 시안 비교 | 모델 `claude-opus-5-5`. `tasks/T068.md` |
| T069 | 답장 칩 `chips` (짧은 이름 3~5개, 금액·환불 칩 없음, 지호 Offer in PayPal) | ai | 완료 | v2.10 | — | 실제 AI 서연·지호 각 2회(컨트롤 타워) | 모델 `claude-sonnet-5-5`. `tasks/T069.md` |
| T070 | **배포 준비**: DEMO_MODE(public 기본 = PayPal 쓰기 0회·AI 캐시+횟수 제한 / recording만 실제 전송), render.yaml, /api/health, reports/deploy.md(환경변수 이름만) | ops | 완료 | v2.10 | — | 쓰기 0회 테스트 | 모델 `claude-opus-5-5`. 새 레인 `lane/ops`. `tasks/T070.md` |
| T071 | 엔진: 처방별 절감액 `fixSavings` (처방 카드 "could save $X") | engine | 완료 | v2.10 | — | — | 모델 `claude-sonnet-5-5`. `tasks/T071.md` |
| T072 | Products 후속: 처방 처음 상태 모두 꺼짐 + "could save $X" 한 숫자(엔진 fixSavings) | ui | 완료 | v2.10 | T065, T071 | — | 모델 `claude-sonnet-5-5`. `tasks/T072.md` |
| T073 | Products 표 폭·값 잘림 + 공개 모드 줄 정렬 | ui | 완료 | v2.10 | T072 | — | 모델 `claude-sonnet-5-5`. `tasks/T073.md` |
| T074 | 화면에 보이는 제품 이름 AfterLoop → DisputeLess (문구 파일, 탭 제목) | ui | 완료 | v2.10 | — | 테스트 결과 같음 | 모델 `claude-sonnet-5-5`. `tasks/T074.md` |
| T075 | 엔진: 답장 예측 모델(코드 규칙 특징 + 로지스틱, 숫자 일치 보정) + 위험 곡선 + 이번 주 요약 + 수별 예측 | engine | 완료 | v2.11 | 계약 v2.11 | AC33 | 모델 `claude-opus-5-5`. `tasks/T075.md` |
| T076 | 화면: 시안 v4 배치(Today·사례·Rehearsal·서랍), 예측 자리는 어댑터(null이면 숨김 = 대체안) | ui | 완료 | v2.11 | 계약 v2.11 | 스크린샷 | 모델 `claude-opus-5-5`. `tasks/T076.md` |
| T077 | AI: 사건 기록 요약(입력 사실만, 약속 금지, 캐시) | ai | 완료 | v2.11 | 계약 v2.11 | — | 모델 `claude-sonnet-5-5`. `tasks/T077.md` |
| T078 | /intro 껍데기 화면(첫 장면 시안 scene1) | ops | 완료 | v2.11 | — | 스크린샷 | 모델 `claude-sonnet-5-5` |
| T079 | 연결: 화면 어댑터 → 엔진 예측·AI 요약, AI 캐시 다시 만들기 | ui | 완료 | v2.11 | T075, T076, T077 | AC33·스크린샷 | 주의: 사건 글에 이름이 있으면 summarizeCaseHistory에 넘기기 전에 ⟦BUYER_NAME_1⟧ 토큰으로 바꾼다 (T077 검증) 함께: /intro에서 루트 layout의 위쪽 막대·Today 읽기를 건너뛰기(라우트 그룹 또는 조건) — T078은 덮개로 가림 |
| T080 | 엔진: 한국어 답장 특징 정규식 보강(격식체·탓하기) | engine | 완료 | v2.11 | T075 | AC33 | 모델 `claude-sonnet-5-5`. `tasks/T080.md` |
| T081 | 화면 언어 바꾸기 EN \| 한국어 (1단계: 화면 글자만, 쿠키·?lang, 기본 영어) | ui | 완료 | v2.11 | T079 | — | 모델 `claude-sonnet-5-5`. `tasks/T081.md`. 병합(T084 뒤). 검증 1회 실패(열린 리다이렉트) → 재시도 → 재검증 통과 |
| T082 | 사건 기록 "추적 없음"은 실제 확인한 경우만 (Mike O08은 등록됨 — 요약이 틀린 사실을 씀) | ui | 진행중 | v2.11 | T081 | — | 모델 `claude-sonnet-5-5`. `tasks/T082.md` |
| T083 | 속도 ①: listUntracked 주문 조회 병렬 (결과 같게) | paypal | 완료 | v2.11 | — | — | 모델 `claude-opus-5-5`. worktree paypal-client. 병합. 독립 검증 통과(Sonnet, 이전 구현과 21가지 입력 toEqual). `tasks/T083.md` |
| T084 | 속도 ②: 요청 사이 캐시 90초·클라이언트 하나·병렬·Suspense·loading·startTransition | ui | 완료 | v2.11 | — | 시간 재기 | 병합. 독립 검증 통과(Sonnet, public 쓰기 0회 직접 시험). 시간: 반복 0.03~0.07초(목표 달성), 캐시 빈 뒤 첫 클릭 3.2초(목표 2초 미달). 모델 `claude-opus-5-5`. 임시 worktree ui-perf (lane/ui-perf). 병합 T084 → T081. `tasks/T084.md` |
| T085 | 엔진: 새 상품 등록 전 점검 계산 (listing) | engine | 완료 | v2.12 | 계약 v2.12 | AC34 | 모델 `claude-opus-5-5`. `tasks/T085.md`. 병합. 독립 검증 통과(Sonnet, 별도 구현과 무작위 입력 40개 일치) |
| T086 | AI: 새 상품 고칠 문구 6개 (약속 금지, 숫자 자리표시자, 정규식 판정) | ai | 완료 | v2.12 | 계약 v2.12 | — | 모델 `claude-sonnet-5-5`. `tasks/T086.md`. 병합. 독립 검증 통과(Sonnet). 실제 AI 1회: 5칸 통과, color만 rule_mismatch → 후속: color 칸을 "Color note:"로 시작 |
| T087 | 화면: /listing Scene 3 (점검 모달·고치기·다시 계산·등록, /api/listing-check) | ui | 진행중 | v2.12 | T085, T086, T084, T081 | 스크린샷 | 모델 `claude-opus-5-5`. `tasks/T087.md` |
| T064 | **PayPal activity 서랍**: 실제 호출 기록(최신 위, 비밀값·개인정보·본문 없음, HEY·GAH 없음, 가짜 전송은 실제로 안 보이게) | ui | 완료 | v2.10 | T062 | 스크린샷 1440 | 모델 `claude-opus-5-5`. `tasks/T064.md`. Autopilot은 빼고 시간 남으면 맨 나중 |
| T065 | **Products 상품 표 AG Grid** (As-is → With fixes, 처방 토글 시 셀 깜빡임) | ui | 대기 (T064 뒤) | v2.10 | T062 | 스크린샷 1440 | 모델 `claude-opus-5-5`. `tasks/T065.md` |
| T012 | **S4 Inbox + Autopilot** (P0 가벼운 버전): AG Grid 표, [Run autopilot], 규칙 3줄, 로그 | ui | 대체됨 | v2.2 | T003, T004, T007 | AC19 (작성 예정). M7, Q3 확정 (P0). AG Grid Community만 **2026-11-10 화면 구조 변경으로 T060~T064로 다시 쪼갬.** 이 지시서의 세부 규칙(리허설·색상 문구·거래 조회 한 줄·추적 등록 안전 규칙·로그 규칙)은 새 지시서가 참조한다 |
| T013 | **S2 Product check**: 리허설(점 그림·폭포·분포 막대), 처방 토글 0.5초 내 재계산, 색상 문구 | ui | 대체됨 | v2.2 | T015, T019, T020 | AC23 (작성 예정). F3·F4 **2026-11-10 화면 구조 변경으로 T060~T064로 다시 쪼갬.** 이 지시서의 세부 규칙(리허설·색상 문구·거래 조회 한 줄·추적 등록 안전 규칙·로그 규칙)은 새 지시서가 참조한다 |
| T016 | **S3 At-risk orders**: 미등록 5건 선택 → 일괄 등록 결과, 통관 안내·환불 자리(P1) | ui | 대체됨 | v2.2 | T011 | AC28 (작성 예정). M3 문구 **안전 규칙 (v2.3, SPEC 9-3)**: 분쟁 걸린 주문은 목록에서 빼고 "분쟁 진행 중이라 제외" 표시. **2026-11-10 화면 구조 변경으로 T060~T064로 다시 쪼갬.** 이 지시서의 세부 규칙(리허설·색상 문구·거래 조회 한 줄·추적 등록 안전 규칙·로그 규칙)은 새 지시서가 참조한다 |
| T014 | **S1 Today**: 브리핑, 할 일 3개, KPI 4개 (숫자는 `sim` 합계) | ui | 대체됨 | v2.2 | T015, T012 | AC24 (작성 예정) **2026-11-10 화면 구조 변경으로 T060~T064로 다시 쪼갬.** 이 지시서의 세부 규칙(리허설·색상 문구·거래 조회 한 줄·추적 등록 안전 규칙·로그 규칙)은 새 지시서가 참조한다 |
| T025 | 배포 (Render) + 데모 리허설 체크 (원문 16장) | 운영 | 대기 | v2.2 | T009, T012, T013, T014, T016 | 녹화 백업, 숫자 대조표 |

## P1

| ID | 작업 | 레인 | 상태 | 기준 SPEC | 의존 | 비고 |
|---|---|---|---|---|---|---|
| T017 | 증빙 제출 provide-evidence (multipart) | paypal | 보류 | v2.2 | T002, T008 | P1. 합의 단계에서는 send-message로 증빙 안내 |
| T022 | 환불 실행 (Lena, `POST /v2/payments/captures/{id}/refund`, Request-Id) | paypal | 보류 | v2.2 | T002 | P1. F11. 샌드박스 주문 O06 또는 O07을 Lena 건으로 |
| T023 | 한국 통관 안내: 개인통관고유부호 없는 KR 주문 탐지 + 한국어 안내 미리보기 | ai · ui | 보류 | v2.2 | T010 | P1. F12. M9 개인정보 원칙 |
| T024 | 웹훅 수신·서명 검증 (`CUSTOMER.DISPUTE.*`) | paypal | 보류 | v2.2 | T003 | P1. M7 |

## 로드맵 (만들지 않음, 영상 끝 10초)
택배사 비교, 정책 설정 전용 화면, 원인 분석 리포트, 기한 타임라인, 부분 환불 제안 UI, 재발 예방(원문 10-7).

## 다음 순서 (자동 배분, 동시에 2개까지)
1. **T004** (engine) + **T007** (data): 의존 없음, 지시서 있음
2. **T002** (paypal-client) + **T008** (paypal-exec): worktree 다시 만들기, 지시서 있음
3. 그다음 (2026-11-09 `.env` 입력됨): **T001 1단계 → T003 → T026 → 승인 링크 만들고 멈춤 (브라우저 승인)**. 그 사이 T028, T015, 이어서 T010, T006 (ai)
- 2026-11-09 21:02: 자동 배분 시작. 1라운드 T007 + T004

## 인수 테스트 목록
| ID | 내용 | 상태 | 작업 |
|---|---|---|---|
| AC1 | D1 박지호 B1: fight 4610 / offer 1953 / refund 5000, 오토파일럿 승인 대기 | 잠금 (v2.1, f 1500¢) | T004 |
| AC2 | D3 buyer_m F1: fight 1200 / refund 3700, offer 차단, 오토파일럿 건너뜀 | 잠금 (v2.1, f 1500¢) | T004 |
| AC3 | B1 ↔ F1만 바꾸면 오토파일럿 판정이 바뀜 | 잠금 (v2) | T004 |
| AC4 | 제안률 정책 고정·한도 | 잠금 (v2) | T005 |
| AC5 | 제안은 B1·B2만 | 잠금 (v2) | T004 |
| AC6 | 오토파일럿 건너뜀 규칙 (EXTERNAL, 확신도, F2) | 잠금 (v2) | T004 |
| AC7 | 확대 위험: 서연 7 → 4, 무응답 중복 가산 없음 | 잠금 (v2) | T018 |
| AC8 | 수 → API (합의 단계 send-message, 클레임 단계 provide_evidence) | 잠금 (v2) | T004 |
| AC9 | allowedMoves에 없는 수는 평가 제외 | 잠금 (v2) | T004 |
| AC10 | 결정론 100회 | 잠금 (v2) | T004, T005, T018 |
| AC11 | 메시지 금액 = API 금액, 호출 1회 | 잠금 | T008 |
| AC12 | 승인 없이는 호출 없음 | 잠금 | T008 |
| AC13 | 샌드박스 세팅 (M8 구성) | 잠금 (v2) | T001 |
| AC14 | OAuth 클라이언트 | 잠금 | T002 |
| AC17 | 시드: 상품 4·구매자 12·문의 31·분쟁 9·주문 214, 샌드박스 12건 = T001 표, 종결 손실 합 41300 (수수료는 질 때만), 분쟁 → 주문 연결, 주문일 90일 창, 국가 95·53·31·31·4 | 잠금 (v2.2) | T007, T028 |
| AC15~AC16, AC18~AC28 | mapper, 분류, SC4, S4, 토큰, 추적, sim, S2, S1, Transaction Search, 색상 문구, FAQ, S3 | 작성 예정 | 각 작업 |
