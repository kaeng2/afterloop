# AfterLoop 작업 규칙 (모든 세션 공통)

이 저장소는 **컨트롤 타워 1개 + 작업 세션 여러 개**로 운영한다. 원칙: ① 생성(LLM)과 판정(코드) 분리 ② 계약을 먼저 고정하고 병렬 개발 ③ 작성자와 검증자 분리.

## 시작할 때 (모든 세션)
1. `SPEC.md` 첫 줄의 버전(`SPEC vN`)을 확인한다.
2. 작업 세션이면 자기 작업 지시서(`tasks/T0xx.md`)의 "기준 SPEC"과 비교한다. **다르면 작업하지 말고** `reports/`에 "SPEC 버전 불일치"로 보고하고 멈춘다.
3. `SPEC.md`, `src/types.ts`를 읽는다. 작업 세션은 자기 지시서도 읽는다.

## 공통 규칙
- 숫자 계산(기대 손실, 확률, 금액, 제안 비율)은 `src/engine/`에서만 한다. 다른 곳은 엔진 결과를 옮기기만 한다.
- 가정값·정책 기준값·화면 문구는 `config/`에서 읽는다. 코드에 직접 쓰지 않는다.
- `tests/acceptance/`는 **실행만** 한다 (`npm run test:acceptance`). 실패하면 코드를 고친다. 기대값이 틀렸다고 판단되면 고치지 말고 근거(계산식, SPEC 조항)와 함께 보고한다.
- PayPal은 샌드박스(`api-m.sandbox.paypal.com`)만 쓴다. Client Secret, 토큰, 구매자 개인정보를 로그·보고서·커밋에 남기지 않는다.
- LLM 출력은 신뢰하지 않는 입력이다. zod로 검증하고, 금액은 자리표시자로만 받는다.

## 작업 세션
- 자기 지시서의 **"수정 가능 폴더" 밖은 수정하지 않는다.**
- 다음은 수정하지 않는다: `SPEC.md`, `DECISIONS.md`, `TASKS.md`, `tasks/`, `src/types.ts`, `tests/acceptance/`, `CLAUDE.md`, `README.md`, `docs/`, `inbox/`, `.claude/`. (대부분 `.claude/settings.json`에서 편집이 막혀 있다.)
- 계약(타입, 인수 테스트, SPEC)이 바뀌어야 한다고 판단되면 고치지 말고 보고서의 "컨트롤 타워에 요청할 결정"에 적는다.
- 자기 레인 브랜치(`lane/<레인>`)에만 커밋한다. `main`에 직접 커밋하거나 병합하지 않는다.
- 끝나면 `reports/T0xx-<YYYYMMDD-HHMM>.md`에 `reports/README.md` 형식으로 보고하고 **멈춘다.** 다음 작업을 스스로 시작하지 않는다.

## 컨트롤 타워
- 사람이 "컨트롤 타워"로 지정한 세션이다. 잠금 설정을 받지 않도록 상위 폴더(`paypal-hackathon/`)에서 시작한다.
- **기능 코드를 직접 작성하지 않는다** (`src/engine`, `src/paypal`, `src/exec`, `src/ai`, `src/app`, `seed/`, `scripts/` 구현).
- 하는 일: SPEC·계약(`src/types.ts`)·인수 테스트 관리, `DECISIONS.md`·`TASKS.md`·작업 지시서 작성, `inbox/` 반영, `reports/` 검토, 레인 브랜치 병합, 인수 테스트 실행.
- 인수 테스트 기대값이나 계약을 바꿀 때는 `DECISIONS.md`에 먼저 적고 사람 승인을 받는다. 승인 후 SPEC 버전을 올린다.
- 운영 명령("inbox 반영해줘", "작업 쪼개줘", "T0xx 병합해줘", "상태 보고")은 `README.md` "운영" 절을 따른다.

## 레인과 폴더
`SPEC.md` 8장 표가 기준이다: engine / paypal / ai / ui / data.
