# DECISIONS

계약·가정값·정책·운영 방식에 대한 결정 기록. 컨트롤 타워만 쓴다. 최신이 아래.

| 날짜 | SPEC 버전 | 결정 | 이유 | 영향받은 작업 |
|---|---|---|---|---|
| 2026-11-09 | v1 | AC1 offer 기대값 = 4032¢ (계산식 4031.5¢ 사사오입). PRD 화면값 4178¢는 쓰지 않음 | PRD 값은 p_acc를 0.7로 반올림한 결과. 기획자 선택 | T004 |
| 2026-11-09 | v1 | `types.ts` 2부 실행 계약 추가 (ActionPlan, Approval, ApiRequest, PayPalCaller, ExecuteInput, ExecuteResult, 함수 시그니처) | 기존 7개 타입만으로는 AC5(R2)·AC11·AC12를 검사할 수 없음. 기획자 승인 | T005, T008 |
| 2026-11-09 | v1 | `Params`에 p_acc 곡선 3개(`pAcceptBase`, `pAcceptSlope`, `pAcceptCap`) 추가, 모든 가정값을 `config/params.json`으로 분리 (값마다 `source`) | 추가 지시: 자주 바뀌는 값을 설정 파일로 | T004 |
| 2026-11-09 | v1 | 정책 기준값을 `config/rules.json`으로 분리. `recommend`·`planMove`에 `rules?` 인자 추가 | 추가 지시: 정책 규칙 설정 파일 | T004, T005 |
| 2026-11-09 | v1 | 인수 테스트는 `params.fixture.json`과 **`rules.fixture.json`** 고정 사본을 직접 넘긴다 | 지시는 params만이었으나, rules를 고정하지 않으면 라이브 `rules.json` 수정이 AC4~AC8을 조용히 바꿈. 컨트롤 타워 제안 (확인 필요) | 전체 인수 테스트 |
| 2026-11-09 | v1 | 레인 5개(engine, paypal, ai, ui, data)와 폴더 소유권 (SPEC 8장) | 추가 지시 4 | 전체 |
| 2026-11-09 | v1 | 레인 브랜치(`lane/*`)만 미리 만들고, worktree는 작업을 배정할 때 만든다 | worktree마다 `npm ci`가 필요해서 미리 5개 만들 이유가 없음 | 전체 |
| 2026-11-09 | v1 | 컨트롤 타워는 상위 폴더 `paypal-hackathon/`에서 시작, 작업 세션은 `afterloop/` 또는 그 worktree에서 시작 | `.claude/settings.json`의 deny는 allow로 예외를 만들 수 없음. 상위 폴더에서 시작한 세션만 잠금 설정을 읽지 않음 (2026-11-09 시험으로 확인) | 전체 |
