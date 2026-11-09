# TASKS (작업 보드)

- 기준: SPEC v1 · 갱신 2026-11-09 17:10 KST · 컨트롤 타워만 수정
- **초안**: PRD가 아직 `inbox/`에 없다. 아래는 빌드 순서 지시와 기존 테스트 지시서(수읽기 버전 B), 샌드박스 사전 확인 결과로 만든 것이다. PRD가 들어오면 "inbox 반영해줘"로 다시 쪼갠다.
- 상태: 대기 / 진행중 / 검토 / 완료 / 보류. 작업 하나는 2시간 이내.
- 인수 테스트: AC1~AC12는 작성·잠금 완료. **AC13~AC26은 작성 예정** (컨트롤 타워가 쓰고 사람 승인 후 잠금).

| ID | 작업 | 레인 | 상태 | 기준 SPEC | 의존 | 비고 |
|---|---|---|---|---|---|---|
| T000 | 하네스: 계약·인수 테스트·잠금·운영 문서 | 컨트롤 타워 | 검토 | v1 | — | 이 세션. AC1~AC12 |
| T001 | 샌드박스 세팅: `.env.example`, `scripts/sandbox/check.ts`(토큰 발급 + 분쟁 목록 1회), fixture 정리 | paypal | 대기 | v1 | — | AC13. 분쟁 PP-R-XWI-10197379 사용. 구매자는 비 KR 계정 |
| T002 | OAuth 클라이언트: 토큰 재사용, 401 갱신 1회, 429 재시도, 분당 30회 제한, PayPal-Request-Id, 비밀값 비노출 | paypal | 대기 | v1 | T001 | AC14 |
| T003 | 분쟁 조회 + mapper: 목록·상세 → `BoardState` (`links[].rel` → allowedMoves, escalate 무시) | paypal | 대기 | v1 | T002 | AC15. fixture 2종(UNDER_REVIEW 초기 / 판매자 응답 대기) |
| T004 | 엔진 v1 맞춤: `@/types` 사용, `config/params.json`·`rules.json` 읽기, `recommend(board, params?, rules?)`, p_acc 곡선 설정화 | engine | 대기 | v1 | — | AC1~AC3, AC9, AC10. ⚠ 세션 95e9c98f가 SPEC v0 기준으로 `src/engine/` 작업 중 → 그 결과를 이 작업의 출발점으로 삼는다 |
| T005 | 엔진 실행 계획: `planMove` (금액, refundType, messageRequired, planId) + R1~R5 기준값 설정화 | engine | 대기 | v1 | T004 | AC4~AC8, AC10 |
| T006 | 원인 분류: `src/ai/classify.ts` (zod, 1회 재요청, confidence < 0.7 → needsReview, 숫자 필드 제거) | ai | 대기 | v1 | — | AC16. LLM은 mock으로 테스트 |
| T007 | 시드 분쟁 30건 (A9 B8 C4 D2 E3 F4), `isDemo: true` | data | 대기 | v1 | — | AC17. 분류 평가(T006 이후)와 분쟁함·리포트가 사용 |
| T008 | 실행: `src/exec/execute.ts` (승인 확인, 자리표시자 채우기, make-offer·send-message·accept-claim 본문, 중복 승인 1회 호출) | paypal | 대기 | v1 | — | AC11, AC12. 타입만 의존 (호출은 주입) |
| T009 | 분쟁 상세 화면: 보드·트리·추천·승인 버튼 → 실행 | ui | 대기 | v1 | T003, T005, T008 | AC18(SC1), AC19(SC3). 배포 URL에서 SC1·SC3 확인 |
| T010 | 번역 토큰 검사: 초안 번역 후 자리표시자 보존·금액 직접 표기 검출 | ai | 대기 | v1 | T006 | AC20 |
| T011 | 추적번호 일괄 등록: Orders v2 `/track` | paypal | 대기 | v1 | T002 | AC21. legacy trackers-batch는 403이라 쓰지 않음. 상태는 SHIPPED만 가능 |
| T012 | 분쟁함: 분쟁 목록·마감일 정렬·원인 배지·Demo 배지 | ui | 대기 | v1 | T003, T007 | AC22 |
| T013 | 상품 진단 리허설 | ui · data | 보류 | v1 | T007 | AC23. PRD 정의 필요 |
| T014 | 홈 | ui | 보류 | v1 | T012 | AC24. PRD 정의 필요 |
| T015 | 원인 리포트: 집계(engine) + 화면(ui)로 나눔 | engine · ui | 보류 | v1 | T006, T007 | AC25. 숫자 집계는 engine. PRD 정의 필요 |
| T016 | P1 기능 | — | 보류 | v1 | — | AC26. PRD 정의 필요 |

## 지금 시작할 수 있는 작업 (의존 없음)
T001 (paypal), T004 (engine), T006 (ai), T007 (data), T008 (paypal). 같은 레인 작업은 한 번에 하나: paypal은 T001 → T008 순서 또는 worktree 2개.

## 작성 예정 인수 테스트
| ID | 내용 | 연결 작업 |
|---|---|---|
| AC13 | `RUN_SANDBOX=1`: 토큰 발급 + 분쟁 목록 200 | T001 |
| AC14 | 클라이언트: 토큰 재사용, 401 1회 갱신, 429 대기·최대 2회, Request-Id 재사용, 로그에 비밀값 없음 | T002 |
| AC15 | fixture → BoardState 필드 일치, "48.00" → 4800, 빠진 필드는 예외 없이 기본값+경고 | T003 |
| AC16 | 분류 스키마 통과/재요청/needsReview, 숫자 필드 무시 | T006 |
| AC17 | 시드 30건 분포·스키마·isDemo | T007 |
| AC18 | SC1 가디건 SNAD → 원인 B → offer → 승인 → send-message·make-offer 본문 | T009 |
| AC19 | SC3 비니 INR 반복 분쟁 → 원인 F → offer 차단 → 증빙 계열 → 단계별 API | T009 |
| AC20 | 번역본 자리표시자 보존, 금액 직접 표기 거부 | T010 |
| AC21 | 추적번호 일괄 등록 요청 본문·부분 실패 처리 | T011 |
| AC22~AC26 | 분쟁함, 상품 진단, 홈, 원인 리포트, P1 | T012~T016 (PRD 후) |
