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
| T001 | 샌드박스 세팅 (M8): US 비즈니스 + 개인 5, 주문 12·추적 7·분쟁 3, manifest, `sandbox:check` | paypal | 대기 | v2.2 | — | AC13. **1단계**(`.env.example`, check, 요청 ID 61자 확인)는 지금, **2단계**(track, disputes, RUN_SANDBOX=1)는 주문 캡처·분쟁 접수 뒤. `.env` 입력됨 (2026-11-09). `tasks/T001.md` |
| T002 | OAuth 클라이언트 | paypal | 완료 | v2.1 | — | AC14 통과 (14개), 단위 86. 병합 2026-11-09 22:02 (검증 통과 뒤 비밀값·경로 보강 재시도 → 재검증 통과). `reports/T002-impl.md`, `reports/T002-verify.md` |
| T003 | 분쟁 읽기: 목록·상세 조회 + mapper → `BoardState` | paypal | 대기 | v2.2 | T002 | AC15 (작성 예정). 브랜치 `lane/paypal-client` (`.env` 없이 fixture로). T002 후속 포함 (`client.ts` 제어문자). `check.ts`는 T001이 처음부터 클라이언트로 만든다. `tasks/T003.md` |
| T004 | 엔진: 기대 손실·추천·오토파일럿 판정 | engine | 완료 | v2.1 | — | AC1~3·5·6·8~10 통과 (27개). 병합 2026-11-09 21:24. `reports/T004-impl.md`, `reports/T004-verify.md` |
| T005 | 엔진: 실행 계획 `planMove` + 제안률 정책 검증 | engine | 완료 | v2.1 | T004 | AC4, AC10 통과 (5개). 병합 2026-11-09 22:14. 후속(평가와 보드 대조)은 T018에서. `reports/T005-impl.md`, `reports/T005-verify.md` |
| T006 | 원인 분류: 규칙 우선 + LLM (16개 세부 유형) | ai | 대기 | v2.2 | — | AC16 (작성 예정). `tasks/T006.md` |
| T007 | 시드 데이터 (원문 6장) | data | 완료 | v2.1 | — | 병합 2026-11-09 21:41 (1차 검증 실패 → 재시도 통과). 단위 38개. **AC17은 Q10 결정 뒤 작성·승인.** `reports/T007-impl.md`, `reports/T007-verify.md` |
| T008 | 실행 `executeMove` | paypal | 완료 | v2.1 | — | AC11, AC12 통과 (10개). 병합 2026-11-09 21:57. `reports/T008-impl.md`, `reports/T008-verify.md` |
| T027 | 실행 보강: 직접 쓴 금액·남은 토큰·빈 메시지 거부, 검증 순서, 영어 문구 | paypal | 완료 | v2.1 | T008 | AC11·AC12 유지 (10개), 단위 130. 병합 2026-11-09 22:26. 남은 다듬기는 P1 (DECISIONS). `reports/T027-impl.md`, `reports/T027-verify.md` |
| T010 | 사실값 토큰 + 번역 검사 (모든 AI 초안에 적용, 결정 4) | ai | 대기 | v2.2 | — | AC20 (작성 예정). `CheckTokensFn`. `tasks/T010.md` |
| T026 | 샌드박스 주문 생성·캡처 스크립트: `scripts/create-sandbox-orders.ts`(시드 주문 12건 → Orders v2 create, 승인 링크를 `reports/sandbox-approve-links.md`에) + `scripts/capture-sandbox-orders.ts`(브라우저 에이전트 승인 뒤 캡처) | paypal | 대기 | v2.2 | T002, T007 | 새 `.env`(Q6, 사람) 필요. Secret은 `.env`에서만 읽고 출력·로그 금지. T001의 `orders`·`capture` 단계를 대신함. `tasks/T026.md` |
| T011 | 추적번호 일괄 등록: 주문 상세로 미등록 판정 → `/track` 주문별 반복, 건별 결과 | paypal | 대기 | v2.2 | T002 | AC21 (작성 예정). M3 |
| T015 | 시뮬레이션 `sim` (원문 9장): 500개 미래, 같은 난수, P10~P90, 폭포 | engine | 완료 | v2.2 | T004 | 병합 2026-11-09 23:00. 가디건 $216 → $44, 합계 $718 → $254 (기획자 공유 필요). **AC22는 Q12 결정 뒤 작성·승인.** `reports/T015-impl.md`, `reports/T015-verify.md` |
| T028 | 시드 v2.2: 종결 손실 재계산 (합 40800 → 41300¢), `SeedDispute.orderId`, `SeedOrder.date` | data | 완료 | v2.2 | T007 | AC17 통과 (56개). 병합 2026-11-09 22:52. `reports/T028-impl.md`, `reports/T028-verify.md` |
| T018 | 확대 위험 점수 (원문 10-4 + M4) + `planMove` 보강 | engine | 완료 | v2.1 | T005 | AC7 통과 (5개). Q2 미확정 (임시 7 → 4). 병합 2026-11-09 22:31. `reports/T018-impl.md`, `reports/T018-verify.md` |
| T019 | Transaction Search 조회 + 캐시 ('cached' 배지) | paypal | 대기 | v2.2 | T002 | AC25 (작성 예정). 실호출 4종 중 하나 (M7) |
| T020 | AI 색상 문구: 분쟁 메시지에서 공통 불만 → EN·KO·JA·DE + 역번역 | ai | 대기 | v2.2 | T010 | AC26 (작성 예정). F5 |
| T021 | FAQ 자동 답변 (오토파일럿 `common_questions`, Yuki 사이즈 문의) | ai | 대기 | v2.2 | T010 | AC27 (작성 예정). 이메일은 시뮬레이션 |
| T009 | **S5 Case** (서연 SC4): 대화 토글, AI 원인 ↔ 코드 점수, 코칭 → 영어 초안 → 한국어 전송본 → 토큰 검사 → send-message | ui | 대기 | v2.2 | T003, T006, T008, T010, T018 | AC18 (작성 예정). 대표 시나리오 |
| T012 | **S4 Inbox + Autopilot** (P0 가벼운 버전): AG Grid 표, [Run autopilot], 규칙 3줄, 로그 | ui | 대기 | v2.2 | T003, T004, T007 | AC19 (작성 예정). M7, Q3 확정 (P0). AG Grid Community만 |
| T013 | **S2 Product check**: 리허설(점 그림·폭포·분포 막대), 처방 토글 0.5초 내 재계산, 색상 문구 | ui | 대기 | v2.2 | T015, T019, T020 | AC23 (작성 예정). F3·F4 |
| T016 | **S3 At-risk orders**: 미등록 5건 선택 → 일괄 등록 결과, 통관 안내·환불 자리(P1) | ui | 대기 | v2.2 | T011 | AC28 (작성 예정). M3 문구 |
| T014 | **S1 Today**: 브리핑, 할 일 3개, KPI 4개 (숫자는 `sim` 합계) | ui | 대기 | v2.2 | T015, T012 | AC24 (작성 예정) |
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
