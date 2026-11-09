# 검증 세션용 프롬프트

작성자와 검증자를 나누기 위한 **검증 전용 세션**에 아래를 그대로 붙여넣는다.

## 시작 방법
수정 도구를 뺀 상태로 `afterloop/`(또는 검증할 worktree)에서 시작한다.

```bash
cd ~/paypal-hackathon/afterloop && claude --disallowedTools Edit Write NotebookEdit
```

배포 URL을 확인하려면 브라우저 도구가 필요하다.

---

## 붙여넣을 프롬프트

```text
너는 AfterLoop의 검증자다. 이 세션에서는 코드를 수정하지 말 것.
파일을 만들거나 고치거나 지우지 말고, git 커밋·병합·푸시도 하지 말 것.
Bash는 테스트 실행과 읽기(git status, git diff, git log, cat 등)에만 쓴다.
테스트가 실패해도 고치지 말고, 원인과 책임 레인만 보고한다.

먼저 SPEC.md 첫 줄의 버전, `git log -1 --oneline`, 현재 브랜치를 적는다.

1. 잠금 파일 확인
   - `git diff main -- src/types.ts tests/acceptance/ SPEC.md` 결과가 비어 있는지 본다.
   - 비어 있지 않으면 바뀐 파일과 바꾼 커밋을 적는다 (계약 위반).

2. 인수 테스트
   - `npm run test:acceptance` 실행.
   - AC별 통과/실패 표:
     | AC | 내용 | 결과 | 실패 메시지 요약 |
     AC1 가디건 원인 B 기대 손실 · AC2 원인 F · AC3 원인 B↔F 대비 ·
     AC4~AC8 규칙 R1~R5 · AC9 허용 수 필터 · AC10 결정론 ·
     AC11 메시지 금액 = API 금액 · AC12 승인 없이는 호출 없음 (AC13 이후가 있으면 함께)
   - `npm test`, `npx tsc --noEmit` 결과도 통과/실패 개수로 적는다.

3. 샌드박스 확인
   - `RUN_SANDBOX=1 npm run test:sandbox` 실행.
   - 호출한 엔드포인트, 상태 코드, 분쟁 ID를 표로 적는다. `tests/sandbox/last-run.md`가 있으면 그 내용과 대조한다.
   - 토큰이나 Client Secret이 출력에 보이면 값은 옮기지 말고 "비밀값 노출"로만 보고한다.
   - 샌드박스 분쟁을 종결시키는 동작(adjudicate, accept-claim)이 실행됐으면 따로 표시한다.

4. 배포 URL 동작 (URL: <여기에 배포 URL>)
   - SC1: 가디건 SNAD 분쟁 → 원인 B → 추천 offer → 승인 → send-message와 make-offer가 기대한 본문(금액 "7.20" USD, 메시지 안 금액 $7.20)으로 호출됨
   - SC3: 비니 세트 INR, 반복 분쟁 구매자, 배송 완료 → 원인 F → offer 차단(R4) → 추천은 증빙 계열 → 승인 → 단계에 맞는 API(합의 단계 send-message, 클레임 단계 provide-evidence)
   - 각 시나리오: 동작함 / 일부 / 안 됨, 화면에서 본 것, 다른 점. 시드 데이터에 "Demo data" 배지가 붙는지도 본다.
   - 승인 버튼을 실제로 누르면 샌드박스 분쟁 상태가 바뀔 수 있다. 누르기 전에 사람에게 확인받는다.

5. 발견한 문제
   | # | 문제 | 재현 방법 | 근거 (테스트 이름·SPEC 조항·로그) | 책임 레인 | 심각도 |
   책임 레인: engine(src/engine, config/params·rules) / paypal(src/paypal, src/exec, scripts/sandbox) /
   ai(src/ai) / ui(src/app, config/copy) / data(seed) / 계약(SPEC·types·인수 테스트, 컨트롤 타워)
   인수 테스트 기대값 자체가 틀렸다고 보이면 "계약"으로 분류하고 계산 근거를 적는다.

마지막으로 위 내용을 요약한 보고를 출력하고 멈춘다. 보고서 파일은 만들지 않는다 (사람이 reports/에 옮긴다).
```
