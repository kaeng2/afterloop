# HANDOFF — 다른 컴퓨터로 옮기기 (2026-11-09 19:30 KST)

AfterLoop(PayPal AI Hackathon, 마감 KST 2026-11-13 05:00) 작업 환경을 새 컴퓨터로 옮길 때 읽는 문서. 비밀값은 이름만 적는다.

## 1. 지금 상태 한눈에
| 항목 | 값 |
|---|---|
| SPEC | **v2.2** (2026-11-09 22:31 KST. v2.1: f = 1500¢, v2.2: 제안 금액 반올림 문구·시드 계약 필드). 기준 문서 `inbox/2026-11-09-prd-v2.md` + `inbox/2026-11-09-prd-v2-review.md` (검토가 우선) |
| main | 이 문서가 들어간 커밋 (`git log --oneline -1`) |
| 인수 테스트 | AC1~AC14 잠금. AC1~AC10은 v2 기대값으로 승인됨. AC15 이후는 작성 예정 |
| 기능 코드 | **아직 없음.** 엔진·PayPal·AI·화면 구현 전. 테스트는 모듈이 없어서 실패하는 것이 정상 |
| 진행 중 작업 세션 | 자동 배분 중 (2026-11-09 21시부터). 지금 상태는 `reports/STATUS.md`와 `TASKS.md` |
| 원격 저장소 | **https://github.com/kaeng2/afterloop** (비공개, 기본 브랜치 main). main과 레인 브랜치 전부, `engine-v0-ref`까지 push됨 |

## 2. 대기 중인 결정
| ID | 내용 | 지금 쓰는 임시값 | 누가 |
|---|---|---|---|
| Q1 | 기대 손실 식에 재구매 가치가 없는 게 의도인지 | 재구매 없음 | 기획자 확인 중 |
| Q2 | 서연 확대 위험 7 → 4로 할지, 응답 기한을 옮겨 6 → 3을 유지할지 | 7 → 4 | 기획자 확인 중 |
| Q7 | 판매자가 이겨도 분쟁 수수료가 부과되는지, claim 단계 이후 환불 시 수수료가 붙는지 | 질 때만 부과. 답이 오면 5장 식과 시드 종결 손실($413)에 함께 반영 | 기획자 확인 중 |
| Q11 | 같은 분쟁의 두 번째 메시지가 중복으로 처리됨 | 보류 (P1). 방향은 DECISIONS.md | 데모 경로 완성 뒤 |
| Q12 | 시뮬레이션 숫자가 원문과 다름 (가디건 $216 → $44, 합계 $718 → $254. 원문 $195 → $43, $481 → $143). 가디건 외 3개 상품의 분쟁 확률이 임시값. 코트는 처방 후 범위 상단이 더 큼 | 지금 계산 결과를 화면에 쓰고 Assumption 배지 | 기획자 공유 필요. AC22가 여기에 달림 |
| Q13 | 한국어 문장 검사 다듬기(T031)를 main에 넣을지. 검증 3회 실패 판정이지만 main보다 한국어 정상 문장 오탐은 줄어듦 | 넣지 않음 (작업은 `lane/ai`에 있음) | 기획자·경희 결정. 근거는 DECISIONS.md |

결정 끝난 것 (참고): **Q6 해결 (2026-11-09): 기존 US 비즈니스 샌드박스 계정을 Fernwood Knits로 사용, 개인 계정 5개 생성, `.env`는 `afterloop-wt/paypal/.env`에 사람이 입력** · **Q8 종결 손실은 질 때만 수수료, 합 $413 · Q9 제안 금액은 센트로 반올림한 뒤 식에 넣음 · Q10 국가 비율·`X…` 구매자 유지, `SeedDispute.orderId`·`SeedOrder.date` 추가 (모두 SPEC v2.2)** · **Q4 화면 숫자는 PRD 값을 하드코딩하지 않고 sim·엔진 계산 결과 사용 (2026-11-09, T015 보류 해제)** · Q3 오토파일럿 가벼운 버전 P0 확정 · Q5 임시 가정값 승인(화면에 Assumption 배지) · **T011 추적번호는 Orders v2 `/track` 주문별 반복 호출**, 등록 여부는 주문 상세 조회 (trackers-batch는 지원 중단, 이 앱에서 403). PRD 원문의 trackers-batch 문구는 검토 파일 M3로 대체됨.

전체 기록: [DECISIONS.md](DECISIONS.md).

## 3. 작업 상태와 다음 단계
- 보드: [TASKS.md](TASKS.md). P0 21개 + P1 4개, 전부 대기 또는 보류.
- **미완성 커밋(WIP)**: 브랜치 `engine-v0-ref` (커밋 `38a6f3b` "엔진 v0 참고용, 미완성"). SPEC v0 기준 엔진과 단위 테스트 63개. **main에 병합하지 않는다.** T004의 참고 자료로만 쓴다.
- 레인 브랜치 `lane/engine`, `lane/paypal`, `lane/paypal-client`, `lane/paypal-exec`, `lane/ai`, `lane/ui`, `lane/data`는 모두 main과 같고 자기 커밋이 없다.

### 다음 순서 (동시에 작업 세션 2개까지)
| 순서 | 작업 | 레인 / 브랜치 | worktree | 지시서 |
|---|---|---|---|---|
| 1 | T004 엔진: 기대 손실·추천·오토파일럿 | engine / `lane/engine` | `../afterloop-wt/engine` | [tasks/T004.md](tasks/T004.md) |
| 1 | T007 시드 데이터 | data / `lane/data` | `../afterloop-wt/data` | [tasks/T007.md](tasks/T007.md) |
| 2 | T002 OAuth 클라이언트 | paypal / `lane/paypal-client` | `../afterloop-wt/paypal-client` | [tasks/T002.md](tasks/T002.md) |
| 2 | T008 실행 executeMove | paypal / `lane/paypal-exec` | `../afterloop-wt/paypal-exec` | [tasks/T008.md](tasks/T008.md) |
| 그다음 | T001(사람 작업 먼저), T005, T006, T010, T018 | | | T001·T006 지시서 있음 |

2026-11-09 21시부터는 컨트롤 타워가 자동 배분한다 (6장). 아래는 사람이 직접 띄울 때의 첫 입력 (worktree 폴더에서 `claude` 실행 후):
> CLAUDE.md 규칙에 따라 tasks/T004.md를 읽고 작업해줘. 시작 전에 현재 폴더와 SPEC 버전(v2)을 확인하고, 끝나면 reports/에 보고하고 멈춰.

(T004 자리에 T007, T002, T008을 넣어 쓴다.)

## 4. 운영 방식 (요약)
- **컨트롤 타워** 세션은 상위 폴더(`~/paypal-hackathon`)에서 시작한다. 그래야 `afterloop/.claude/settings.json` 잠금을 받지 않는다. 기능 코드는 쓰지 않는다. 명령은 [README.md](README.md) "운영" 절 ("inbox 반영해줘", "작업 쪼개줘", "T0xx 병합해줘", "상태 보고").
- **작업 세션**은 반드시 자기 worktree 안에서 시작한다. 계약 파일(SPEC, types.ts, tests/acceptance 등)은 편집이 막혀 있다. 끝나면 `reports/`에 보고하고 멈춘다.
- 컨트롤 타워가 커밋하기 전에 공유 폴더(`afterloop/`)가 `main`인지 확인한다.

## 5. 새 컴퓨터 세팅 순서
### 1단계: 원격 (완료)
`https://github.com/kaeng2/afterloop` (비공개)에 모든 브랜치를 push했다 (2026-11-09). 새 컴퓨터에서 `gh auth login`으로 kaeng2 계정에 로그인해야 clone할 수 있다.

### 2단계: 도구
- Node **20 이상** (`package.json` engines `>=20`, `.nvmrc`는 22. 예전 컴퓨터와 경희 노트북은 v20.20.0), npm, git, GitHub CLI(`gh auth login`)
- Claude Code (이 컴퓨터는 2.1.318) 로그인

### 3단계: clone과 브랜치
```bash
mkdir -p ~/paypal-hackathon && cd ~/paypal-hackathon
gh repo clone kaeng2/afterloop afterloop
cd afterloop
for b in lane/engine lane/paypal lane/paypal-client lane/paypal-exec lane/ai lane/ui lane/data engine-v0-ref; do git branch --track "$b" "origin/$b"; done
npm ci
echo '.claude/settings.local.json' >> .git/info/exclude
```

### 4단계: worktree 다시 만들기 (필요한 것만)
```bash
cd ~/paypal-hackathon/afterloop
git worktree add ../afterloop-wt/engine lane/engine && npm --prefix ../afterloop-wt/engine ci
git worktree add ../afterloop-wt/data lane/data && npm --prefix ../afterloop-wt/data ci
```
(2순위 때 `paypal-client`, `paypal-exec`, T001 때 `paypal`도 같은 방식)

worktree마다 다른 레인 폴더를 막는 로컬 설정 `.claude/settings.local.json` (git에 없음, 다시 만든다):

| worktree | deny 목록 |
|---|---|
| `engine` | `Edit(/src/paypal/**)`, `Edit(/src/exec/**)`, `Edit(/src/ai/**)`, `Edit(/src/app/**)`, `Edit(/seed/**)`, `Edit(/scripts/**)`, `Edit(/config/copy.*.json)` |
| `data` | `Edit(/src/**)`, `Edit(/config/**)`, `Edit(/scripts/**)` |
| `paypal` (T001, T026) | `Edit(/src/**)`, `Edit(/seed/**)`, `Edit(/config/**)`, `Edit(/scripts/eval-classifier.ts)` + **`.env` 보호** (2026-11-09, `.env`가 이 worktree에 있음): `Read(/.env)`, `Read(/.env.local)`, `Edit(/.env)`, `Edit(/.env.local)`, `Bash(*.env)`, `Bash(*.env *)`, `Bash(*.env;*)`, `Bash(*.env|*)`, `Bash(*.env&*)`, `Bash(*.env.local*)`, `Bash(printenv*)`, `Bash(env)`, `Bash(env *)`, `Bash(export*)`, `Bash(set)` |
| `paypal-client` (T002) | `Edit(/src/exec/**)`, `Edit(/src/engine/**)`, `Edit(/src/ai/**)`, `Edit(/src/app/**)`, `Edit(/scripts/**)`, `Edit(/seed/**)`, `Edit(/config/**)`, `Edit(/package.json)`, `Edit(/.gitignore)` |
| `paypal-exec` (T008) | `Edit(/src/paypal/**)`, `Edit(/src/engine/**)`, `Edit(/src/ai/**)`, `Edit(/src/app/**)`, `Edit(/scripts/**)`, `Edit(/seed/**)`, `Edit(/config/**)`, `Edit(/package.json)`, `Edit(/.gitignore)` |
| `ai` (T006 이후) | `Edit(/src/engine/**)`, `Edit(/src/paypal/**)`, `Edit(/src/exec/**)`, `Edit(/src/app/**)`, `Edit(/seed/**)`, `Edit(/config/**)`, `Edit(/scripts/sandbox/**)`, `Edit(/tests/sandbox/**)`, `Edit(/tests/fixtures/**)`, `Edit(/public/**)`, `Edit(/package.json)`, `Edit(/package-lock.json)`, `Edit(/.gitignore)`, `Edit(/.nvmrc)`, `Edit(/tsconfig.json)`, `Edit(/vitest.config.ts)`, `Edit(/next.config.ts)`, `Edit(/eslint.config.mjs)` |
| `ui` (T009 이후) | `Edit(/src/engine/**)`, `Edit(/src/paypal/**)`, `Edit(/src/exec/**)`, `Edit(/src/ai/**)`, `Edit(/seed/**)`, `Edit(/scripts/**)`, `Edit(/config/params.json)`, `Edit(/config/rules.json)`, `Edit(/tests/sandbox/**)`, `Edit(/tests/fixtures/**)`, `Edit(/package.json)`, `Edit(/package-lock.json)`, `Edit(/.gitignore)`, `Edit(/.nvmrc)`, `Edit(/tsconfig.json)`, `Edit(/vitest.config.ts)`, `Edit(/next.config.ts)`, `Edit(/eslint.config.mjs)` |

형식: `{ "permissions": { "deny": [ ...위 목록... ] } }`

- `ai`는 `src/ai/`와 `scripts/eval-classifier.ts`만, `ui`는 `src/app/`과 `config/copy.*.json`만 고친다 (2026-11-09 결정). deny는 예외를 둘 수 없어서 "그 밖의 알려진 경로"를 하나씩 막는 방식이다. 자기 모듈 테스트(`tests/unit/`, `tests/integration/`)와 `reports/`는 열려 있고, `ui`는 `public/`도 열려 있다.
- 두 레인 모두 `package.json`과 루트 설정 파일(`tsconfig.json`, `next.config.ts` 등)이 막혀 있다. 의존성 추가(AG Grid, LLM SDK 등)나 설정 변경이 필요하면 작업 세션이 고치지 말고 보고한다.
- 경희 노트북(2026-11-09)에는 worktree 7개(`engine`, `data`, `paypal`, `paypal-client`, `paypal-exec`, `ai`, `ui`)를 모두 만들고 위 표대로 잠갔다. 상위 폴더는 `~/repositories/paypal-hackathon` (이 문서의 `~/paypal-hackathon` 자리).

### 5단계: `.env` (값은 새로 받는다. 이 문서와 git에 값을 쓰지 않는다)
| 변수 | 필요한 곳 | 받는 곳 |
|---|---|---|
| `PAYPAL_CLIENT_ID` | `afterloop-wt/paypal`(T001), 이후 PayPal 레인 | 새 US 비즈니스 앱 (Q6) |
| `PAYPAL_CLIENT_SECRET` | 같음 | 같음 |
| `PAYPAL_BASE_URL` | 같음 | 값은 `https://api-m.sandbox.paypal.com` |
| `LLM_API_KEY` | `afterloop-wt/ai`(T006 이후) | Anthropic 콘솔에서 새 키 |
| `PAYPAL_WEBHOOK_ID` | P1 웹훅(T024) 때 | PayPal 앱 웹훅 설정 |

상위 폴더의 예전 Python 실습용 `.env`에는 `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `ANTHROPIC_API_KEY`가 있다 (KR 비즈니스 앱). v2에서는 쓰지 않는다.

### 6단계: 플러그인과 토큰
- Claude Code 플러그인: **figma** (`figma@claude-plugins-official`, `/plugin`으로 설치), **paypal**·**cowork-plugin-management** (claude.ai 계정에서 동기화되므로 로그인하면 다시 생김)
- PayPal MCP(`paypal-sandbox`)는 이 컴퓨터에서 401 "Token signature verification failed"였다. 새 앱 자격 증명으로 `/paypal:setup` 다시 실행
- 토큰 재발급: PayPal은 새 앱 Client ID·Secret(Q6), Anthropic은 새 API 키, GitHub은 `gh auth login`. 예전 값을 메신저·메일로 옮기지 않는다
- Claude Code 사용자 설정(이 컴퓨터): `effortLevel: high`, `tui: fullscreen`, `theme: light-ansi`, `agentPushNotifEnabled: true`, figma 플러그인 켜짐

### 7단계: 확인 명령과 기대 결과 (구현 전 기준)
| 명령 (`afterloop/`에서) | 기대 결과 |
|---|---|
| `git log --oneline -1` | 이 문서가 들어간 커밋 |
| `head -1 SPEC.md` | `# SPEC v2.2 (2026-11-09 22:31 KST)` |
| `npm run test:acceptance` (구현 전) | **Test Files 8 failed**, Tests 2 failed / 9 skipped. 실패 원인은 모듈 없음(`@/engine/*`, `@/exec/execute`, `@/paypal/client`)과 AC13 오프라인 2개(`.env.example` 없음, T001이 만듦) |
| `npx tsc --noEmit` | 오류는 모두 TS2307 "Cannot find module" 5종 (`@/engine/recommend`, `@/engine/plan`, `@/engine/escalation`, `@/exec/execute`, `@/paypal/client`) |
| 잠금 확인 (worktree 안): `claude -p --permission-mode acceptEdits 'Edit SPEC.md: replace "# SPEC v2" with "# SPEC v9". Report ALLOWED or DENIED.'` | DENIED |

구현이 들어오면: T004 → `ac01-03`, `ac05-06-08`, `ac09-10` 통과 (27개), T005 → `ac04` (5개), T018 → `ac07` (5개), T008 → `ac11-12` (10개), T002 → `ac14` (14개), T001 → `ac13` (`RUN_SANDBOX=1`일 때 11개).

## 6. 자동 배분 시작
규칙은 [CLAUDE.md](CLAUDE.md) "운영 모드: 자동 배분". 사람은 작업 지시문을 붙여넣지 않는다.

1. 컨트롤 타워 세션을 상위 폴더에서 시작하고 "자동 배분 시작"이라고 한다. 컨트롤 타워는 `TASKS.md`와 `reports/STATUS.md` 마지막 줄을 읽고 이어서 한다.
2. 컨트롤 타워가 태스크마다 실행하는 것 (동시에 최대 2개):
   ```bash
   # 구현: 레인 worktree 안에서 (잠금 적용). 허용 명령은 npm·npx·git 읽기/커밋 정도로 제한
   cd ../afterloop-wt/<레인> && git merge --ff-only main
   claude -p --permission-mode acceptEdits --allowedTools "Bash(npm run *)" "Bash(npx vitest *)" "Bash(git commit *)" ... \
     'CLAUDE.md 규칙에 따라 tasks/T0xx.md를 읽고 작업해줘. ... reports/T0xx-impl.md에 보고하고 멈춰.'
   ```
   - 검증: 구현을 모르는 새 서브에이전트 (코드 수정 금지) → `reports/T0xx-verify.md`
   - 통과: `git merge --no-ff lane/<레인>` → `npm run test:acceptance`, `npm test`, `npx tsc --noEmit` → 푸시
   - 기록: `reports/STATUS.md` 한 줄 + 푸시
3. 터미널 `claude`가 로그인되어 있어야 한다 (`claude auth status`). 만료되면 구현 세션이 바로 실패한다.
4. 모바일에서는 GitHub의 `reports/STATUS.md`만 보면 된다.
5. 컨트롤 타워가 멈추고 사람을 부르는 경우: 계약·인수 테스트 변경 필요, 같은 태스크 2회 연속 실패, 사람 전용 작업, UI 병합 전 스크린샷 확인, 마일스톤 완료, 권한 대기.

## 7. 브라우저 작업
규칙은 [CLAUDE.md](CLAUDE.md) "브라우저 작업". 웹 화면은 브라우저 에이전트가 맡고, Secret은 사람만 다룬다. live PayPal 화면이 나오면 즉시 중단한다.

| 순서 | 할 일 | 누가 | 끝나면 |
|---|---|---|---|
| 1 | developer.paypal.com에서 US 비즈니스 샌드박스 계정(Fernwood Knits) + 새 REST 앱. Customer disputes·Transaction search 켜기. 개인 계정 5개 (서연 KR, 지호 KR, Yuki JP, Lena DE, buyer_m US) | 브라우저 에이전트 (사람 확인) | Q6 해결 |
| 2 | 새 앱의 Client ID·Secret을 `afterloop-wt/paypal/.env`에 **사람이 직접** 입력 (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`). AI는 Secret을 읽거나 출력하지 않는다 | 사람 | T026·T001 시작 가능 |
| 3 | `reports/sandbox-approve-links.md`의 승인 링크 12건을 구매자 계정으로 승인 (T026 `sandbox:orders` 뒤) | 브라우저 에이전트 | `npm run sandbox:capture` |
| 4 | Resolution Center에서 분쟁 3건 접수: D1 지호 SNAD(O02), D2 서연 INR(O01, 한국어 메시지는 `tasks/T001.md` 그대로), D3 buyer_m INR(O08) | 브라우저 에이전트 | T001 `disputes`, `sandbox:check` |

배포(Render)와 제출(Devpost) 화면도 브라우저 에이전트가 맡는다 (T025).

## 8. 이 컴퓨터에만 있고 git에 없는 것
| 항목 | 위치 | 새 컴퓨터에서 |
|---|---|---|
| 예전 Python 실습 (git 저장소 아님) | `~/paypal-hackathon/` (`paypal_client.py`, `orders.py`, `rules.py` 등, `.venv`) | 필요하면 폴더째 복사. T002 참고용 |
| `.env` (Python 실습용) | `~/paypal-hackathon/.env` | 옮기지 않음. 새로 발급 |
| worktree 3개 | `~/paypal-hackathon/afterloop-wt/{paypal,paypal-client,paypal-exec}` | 4단계로 다시 만듦 (커밋 안 된 변경 없음) |
| worktree 로컬 잠금 | 각 worktree `.claude/settings.local.json` | 4단계 표로 다시 만듦 |
| git 로컬 제외 설정 | `.git/info/exclude` (`.claude/settings.local.json`) | 3단계 |
| 의존성·빌드 캐시 | `node_modules/`, `.next/`, `*.tsbuildinfo`, `next-env.d.ts` | `npm ci` |
| Claude Code 사용자 설정 | `~/.claude/settings.json` | 6단계 값으로 다시 설정 |
| Claude Code 메모리 | `~/.claude/projects/-Users-hee---yaa-paypal-hackathon/memory/` (샌드박스 상태, 컨트롤 타워 상태) | 옮기지 않아도 됨. 핵심은 이 문서와 DECISIONS.md에 있음 |
| 세션 기록 | `~/.claude/projects/*/` (*.jsonl) | 옮기지 않음 |
| 검증용 참조 구현 | 세션 scratchpad (임시 폴더) | 필요 없음 (AC11~AC14, AC1~AC10이 통과 가능한지 확인하는 데만 썼음) |
| GitHub 로그인 | macOS 키체인 (`gh`) | `gh auth login` |
| PayPal 샌드박스 상태 | PayPal 쪽 (KR 앱, 분쟁 PP-R-XWI-10197379) | v2에서 쓰지 않음. 새 US 앱으로 T001에서 다시 만듦 |

## 9. 이동 전 점검 결과 (2026-11-09 19:30)
- worktree 3개와 레인 브랜치: 커밋 안 된 변경 없음, main보다 앞선 커밋 없음
- git 기록 전체(모든 브랜치)와 커밋 전 변경: 실제 `.env` 값 3개(PayPal Client ID·Secret, Anthropic 키) 0건, 토큰·키 형식 0건, `.env` 류 파일 커밋 이력 없음
- 원격 저장소: `kaeng2/afterloop` 만들고 브랜치 9개 push, 로컬과 원격 커밋 일치 확인
