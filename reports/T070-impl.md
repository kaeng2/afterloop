# T070 보고 (2026-11-11 19:20)

- 기준 SPEC: v2.10   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ops / e2da178 (구현) + 이 보고서 커밋

## 결과
**일부 완료 (검증 막힘).** 지시서 "만들 것" 1~4를 모두 구현하고 단위 테스트를 썼다. 하지만 이 worktree에 `node_modules`가 없고
`npm ci`가 권한 승인을 요구해(비대화 세션이라 승인 불가) **`npm test`·`tsc`·`lint`·`test:acceptance`·`build`를 한 번도 돌리지 못했다.**
테스트 통과 여부는 확인되지 않았다. 컨트롤 타워가 `npm ci` 뒤 아래 명령을 돌려 확인해야 한다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/_server/mode.ts` (새) | `resolveDemoMode(env)` — 정확히 `"recording"`만 recording, 나머지(없음·빈 값·대소문자·공백·오타) public. `server-only` |
| `src/app/_server/paypal.ts` | 모드 관문: recording이 아니면 `getPayPalClient`가 `blockWrites(client)`를 돌려준다 — `call`(GET 아닌 모든 요청)은 네트워크 0회, `{status:200, body:{simulated:true}}`(지금 가짜 호출기 꼴). `get`은 실제 샌드박스 그대로 |
| `src/app/_server/send.ts` | `resolveSendMode` 맨 앞에 모드 관문 한 줄: public이면 `AFTERLOOP_REAL_SEND`와 무관하게 `simulated`. 그 뒤 판단 순서·규칙은 그대로. `SendEnv`에 `DEMO_MODE` 추가 |
| `src/app/_server/tracking-register.ts` | 모드 관문: recording일 때만 `liveGateFromEnv(deps.env, …)`, public이면 `DRY_RUN_GATE` (POST 0회, 결과 "Simulated") |
| `src/app/_server/llm-cache.ts` (새) | 캐시 키 `sha256(system\0user\0JSON(jsonSchema))`, 파일 읽기·쓰기(`data/ai-cache/llm-cache.json`, zod 검증, 깨지면 빈 캐시), 시간당 한도(`AI_LIVE_LIMIT_PER_HOUR`, 0 이상 정수만, 기본 20, 움직이는 1시간 창, 프로세스 기준), `cachedLlm`, 스크립트용 기록 세션 |
| `src/app/_server/llm.ts` | `getLlm`이 캐시 감싼 호출기를 돌려준다 (적중이면 호출 0, public은 한도 넘으면 예외 = 지금 `unavailableLlm` 꼴, recording은 제한 없음). 키 없으면 지금처럼 `not_configured`. 기록 세션 중이면 기록 호출기 |
| `src/app/_server/health.ts` (새), `src/app/api/health/route.ts` (새) | `GET /api/health` → `{ ok: true, mode, commit? }` (commit은 `RENDER_GIT_COMMIT`이 16진일 때 앞 7자리). PayPal·AI 호출 없음, env 값 없음 |
| `src/app/layout.tsx` | public일 때 위쪽 막대 아래 한 줄 `mode.public` ("Public demo · simulated sends", 기존 `muted small` 클래스). 화면 폴더는 고치지 않았다 |
| `config/copy.en.json`·`copy.ko.json` | `mode.public` 키 1개 |
| `scripts/ai-cache/build-lib.ts` (새), `build.ts` (새) | 캐시 만들기: 기록 세션을 켜고 앱의 같은 서버 함수 `loadDemoDisputes`(분류·어조) → 화면 분쟁마다 `loadCase`(초안) → `loadReply`(번역·역번역). `server-only` 때문에 `--conditions=react-server`를 붙여 자기 자신을 한 번 다시 띄운다. 출력은 건수·분쟁 번호·사유 코드만, PayPal/AI 불가·기록 0개면 파일을 쓰지 않고 1 |
| `data/ai-cache/README.md` (새) | 캐시 파일 자리·꼴 설명 (캐시 파일 자체는 만들지 않았다) |
| `render.yaml` (새) | 웹 서비스 1개, `npm ci && npm run build` / `npm run start -- -p $PORT`, `/api/health`, `NODE_VERSION=22`, `DEMO_MODE=public`, `AI_LIVE_LIMIT_PER_HOUR=20`, `PAYPAL_BASE_URL`=샌드박스 주소(비밀 아님), 비밀 이름 셋(`PAYPAL_CLIENT_ID`·`PAYPAL_CLIENT_SECRET`·`LLM_API_KEY`)은 `sync: false`. 녹화 스위치 없음. `plan: free`·`region: oregon`·`autoDeploy: false`는 자리 값 |
| `reports/deploy.md` (새) | 환경변수 이름·뜻 (값 없음), 배포 순서, 캐시 만들기 명령과 기록되는 것, 녹화 날·녹화 뒤 되돌리기 |
| `package.json` | `scripts`에 `ai-cache:build`만 추가 (의존성·engines 그대로. Node 22는 `render.yaml`의 `NODE_VERSION`으로 맞춤) |
| `tests/unit/ops-t070-gates.test.ts` (새) | 모드 값, 전송 모드, public/recording 클라이언트, **서버 액션과 같은 길(`loadReply` → `sendFromScreen`)로 서연 보내기·지호 제안**, 추적 등록, 이중 잠금. PayPal은 `fetch`를 바꿔 끼운 가짜로 모든 HTTP 요청을 센다 |
| `tests/unit/ops-t070-cache.test.ts` (새) | 캐시 키, 다른 `now` → 같은 키(실제 `draftReply`·`translateReply` 프롬프트로), 적중 0회, public 한도·recording 무제한, 파일 꼴, `getLlm`, public GET + HEY·GAH 숨김, 빌드 스크립트(가짜 LlmCaller) 기록·재실행 0회, health, `render.yaml`·`deploy.md` 정적 검사 |
| 기존 테스트 3개 | 아래 "기존 테스트에 더한 입력" — `DEMO_MODE: 'recording'`을 **입력으로만** 더했다. 기대값은 바꾸지 않았다 |

### 기존 테스트에 더한 입력 (기대값 변경 없음)
| 파일 | 자리 | 더한 것 |
|---|---|---|
| `tests/unit/app-send.test.ts` | AC18 8번 "`"1"`만 live" | `resolveSendMode({ AFTERLOOP_REAL_SEND: '1', DEMO_MODE: 'recording' })` |
| `tests/unit/app-t061.test.ts` | "꺼짐 / 켜짐 / 연결 표 불허"의 `on` | 같음 |
| `tests/unit/app-t061.test.ts` | "실제 모드에서는 변수를 읽지 않고"의 Proxy env | `DEMO_MODE: 'recording'` (없으면 public → simulated라 `AFTERLOOP_SIMULATE_FAILURE`를 읽게 돼 Proxy가 던진다) |
| `tests/unit/app-t067.test.ts` | 상수 `ON`, "스위치 일부만" env | `DEMO_MODE: 'recording'` (`OFF`는 그대로 — public에서도 같은 dry run 결과) |

`app-case-reply-retry`는 `sendReply`에 모드를 직접 넣으므로 바꿀 필요가 없었다.

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | ? | ? | **돌리지 못함** (`node_modules` 없음) |
| npm test | ? | ? | **돌리지 못함** |
| npx tsc --noEmit | ? | ? | **돌리지 못함** — 코드를 읽어 타입을 맞췄지만 컴파일러로 확인하지 않았다 |
| npm run lint | ? | ? | **돌리지 못함** |
| npm run build | ? | ? | **돌리지 못함** |

막힌 이유: worktree가 새로 만들어져 `node_modules`가 없다. `npm ci`·`npm ci --no-audit --no-fund`는 "requires approval"로 막혔고,
main 체크아웃의 `node_modules`를 링크하는 `ln -s`도 승인이 필요해 막혔다. `npx vitest`는 `vitest/config`를 찾지 못해 시작하지 못했다.

## 남은 문제
- **검증이 한 번도 돌지 않았다.** 컨트롤 타워가 이 worktree에서 `npm ci` 뒤 `npm test && npx tsc --noEmit && npm run lint && npm run test:acceptance && npm run build`를 돌려야 한다. 실패하면 이 세션(재시도)에 넘겨 달라.
- 테스트 중 확신이 낮은 곳:
  - `ops-t070-cache` "scripts/ai-cache/build"는 실제 분쟁 읽기 경로를 가짜 `fetch` + 고정 글(색·크기 SNAD)로 돌린다. 세 분쟁 모두 같은 고정 글이라 추천이 기대와 다를 수 있어, 번역·역번역 확인은 "전송본까지 간 분쟁이 있으면"으로 걸어 두었다 (초안 기록은 꼭 확인).
  - `ops-t070-gates` recording 지호 테스트는 실제 PayPal 클라이언트(가짜 `fetch`)로 토큰 → 상세 GET → make-offer POST를 지난다. 클라이언트의 요청 간격 대기(`waitForSlot`)가 실제 타이머라 몇백 ms 걸릴 수 있다.
- `build.ts`의 자기 재실행(`--conditions=react-server`)은 tsx 아래에서 실제로 돌려 보지 못했다 (단위 테스트는 `build-lib`만 vitest로). 컨트롤 타워가 캐시를 만들 때 처음 확인된다. 막히면 `NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env scripts/ai-cache/build.ts`로 직접 붙여도 된다 (스크립트는 `NODE_OPTIONS`도 본다).
- "쓰기 0회"는 토큰 발급(`POST /v1/oauth2/token`)을 뺀 수다 — 읽기(GET)를 하려면 토큰이 필요하다. public에서 `call`만 부르면 토큰도 받지 않는다 (테스트로 확인하게 해 두었다).
- 캐시는 프로세스 기억에도 더한다 (캐시 밖 응답을 한 번 받으면 그 프로세스에서는 다시 부르지 않는다). 재시작하면 파일 내용만 남는다.
- 화면 경로의 AI 호출은 분류·어조(`_server/disputes.ts`), 초안(`cases/view/load.ts`), 번역·역번역(`cases/reply/load.ts`)뿐이다. 색상 문구(`src/ai/color-note.ts`)는 지금 `src/app`에서 부르지 않는다 — T062~T065 Products가 붙으면 `build-lib`에 그 경로를 더해야 한다.
- 모드 표시는 `layout.tsx`에 한 줄로 넣었다 (`globals.css`는 수정 가능 폴더 밖이라 기존 `muted small` 클래스만 썼다. 모양은 UI 확인 필요).

## 컨트롤 타워에 요청할 결정
- **dependencies 설치 권한**: 작업 세션에서 `npm ci`가 승인 대기로 막힌다. 새 worktree를 만들 때 컨트롤 타워가 미리 `npm ci`를 하거나, 레인 세션에 `npm ci` 허용을 주는 것을 제안한다.
- **인수 테스트로 올릴 만한 항목** (인수 테스트는 고치지 않았다):
  1. `DEMO_MODE`가 정확히 `"recording"`이 아니면(없음·`public`·`Recording`·공백) 실제 전송 스위치를 모두 켜도 서연 보내기·지호 제안·추적 등록의 PayPal 쓰기 호출 0회, 결과 Simulated (`ops-t070-gates` 3절).
  2. public에서도 분쟁 GET은 나가고 HEY·GAH는 상세도 읽지 않고 결과에도 없다.
  3. AI 캐시 키는 같은 분쟁이면 `now`가 달라도 같다 (프롬프트에 날짜·이름 값 없음).
  4. `/api/health`는 `{ok, mode, commit?}`만 낸다.
- `render.yaml`의 `plan`·`region`·`autoDeploy: false`는 자리 값이다 — 사람이 정한다.

---

## 재시도 (1회, 2026-11-11)

기준 SPEC v2.10 = `SPEC.md` 첫 줄 v2.10 (일치). 컨트롤 타워가 `npm ci`를 해 둔 상태에서 시작했다.

### 원인
1. **tsc TS2559 2개** — `process.env`(`ProcessEnv`)를 선택 칸만 있는 타입(`LlmEnv`, `Partial<Record<'AI_LIVE_LIMIT_PER_HOUR', string>>`)에 그대로 넘겨 "약한 타입" 검사에 걸렸다. 앱의 기존 꼴(`src/app/_server/llm.ts`의 `process.env as GetLlmEnv`, `src/ai/llm.ts`의 `process.env as LlmEnv`)과 똑같이 캐스팅했다.
   - `scripts/ai-cache/build.ts`: `createLlmCaller(process.env as LlmEnv)` + `import type { LlmEnv }`
   - `src/app/_server/llm-cache.ts`: `resolveLiveLimit`의 기본 인자에 캐스팅
2. **단위 테스트 실패 2개 — 둘 다 같은 원인: 테스트의 가짜 LLM 답이 `draftReply` 계약을 지키지 않았다.**
   - 가짜는 코칭 1줄만 냈는데 `src/ai/reply.ts`는 코칭 3~5줄(`COACHING_MIN = 3`)을 요구한다 → `draftReply`가 `{ ok: false, reason: 'invalid_output', detail: 'coaching_too_few' }`. 또 T069(`8b8aa3f`)가 출력 꼴에 `chips`를 더했다.
   - 그래서 1번 테스트는 키 비교 전 `expect(draft.ok).toBe(true)`에서, 2번 테스트는 `built.cases.some((c) => c.draft)`에서 false였다. **키가 달라서 실패한 것이 아니다.**
   - 고침: 가짜의 초안 답을 계약대로 바꿨다 (코칭 3줄, 칩 3개). 단언은 하나도 줄이거나 바꾸지 않았다.

### "프롬프트에 날짜·이름 값이 없다" 전제 확인
- 직접 확인했다: `caseReplyFacts({ now: '2026-11-11T03:00:00Z', … })`의 값은 `⟦DATE_1⟧ = 2026-11-18`, `⟦BUYER_NAME_1⟧ = Seo-yeon` / `서연 님`, `⟦SELLER_NAME_1⟧ = Hannah, Fernwood Knits`. 초안 요청의 `user`에는 토큰과 그 뜻(`the date the seller will check… Not a delivery date.`)만 있고 값은 없다.
- 테스트도 이것을 직접 단언한다 (모든 요청의 system·user에 사실값이 없음) — 이제 통과한다. `now` 두 개(11/11, 11/14)에서 초안·번역·역번역 3개 요청 키가 같다.
- **전제는 맞다.** 프롬프트(ai 레인)를 고칠 일도, 캐시 키 방식을 바꿀 일도 없다.

### 고친 파일
- `scripts/ai-cache/build.ts`, `src/app/_server/llm-cache.ts` (타입 캐스팅만, 동작 변화 없음)
- `tests/unit/ops-t070-cache.test.ts` (가짜 LLM 초안 답만)

### 결과
| 명령 | 결과 |
|---|---|
| npm test | 45 파일, 2004 통과, 실패 0 |
| npx tsc --noEmit | 오류 0 |
| npm run lint | 통과 (exit 0) |
| npm run test:acceptance | 158 통과, 9 건너뜀, 실패 0 |
| npm run build | 통과 (exit 0) |

실제 AI·PayPal 호출 없음, `.env` 열지 않음, 개발 서버 띄우지 않음.

### 남은 문제
- `ops-t070-cache` build 테스트의 번역·역번역 확인은 여전히 "전송본까지 간 분쟁이 있으면"으로 걸려 있다 (처음 보고서에 적은 그대로). 이번에 그 조건이 참인지는 따로 찍어 보지 않았다. 번역·역번역 키가 `now`와 무관한 것은 1번 테스트가 따로 꼭 확인한다.
- 이 테스트처럼 ai 레인의 출력 꼴(`COACHING_MIN`, `chips`)이 바뀌면 다른 레인 테스트의 가짜 답이 조용히 틀어질 수 있다. 가짜 답을 `src/ai/reply.ts` 쪽 공용 고정값으로 두는 것은 ai 레인 일이라 여기서 하지 않았다.

### 컨트롤 타워에 요청할 결정
- 없음 (처음 보고서의 "인수 테스트로 올릴 만한 항목"·`render.yaml` 자리 값은 그대로 유효).
