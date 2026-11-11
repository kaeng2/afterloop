판정: 통과

대상: lane/ops 7df6bc5 (e2da178·678b27c·7df6bc5), diff 3212372..7df6bc5. 코드·설정·테스트 수정 0.

1. 범위: 통과
- 바뀐 파일 23개 모두 허용 폴더 안 (src/app/_server, api/health, layout.tsx 모드 한 줄, scripts/ai-cache, data/ai-cache/README, render.yaml, reports, package.json scripts에 ai-cache:build 한 줄, copy mode.public 키, tests/unit).
- 엔진·AI·PayPal·실행·계약·시드·인수 테스트 변경 0줄. 의존성 변경 0 (engines도 ">=20" 그대로).
- send.ts diff: import 1줄 + resolveSendMode 맨 앞 `if (resolveDemoMode(env) !== 'recording') return 'simulated'` + 타입에 DEMO_MODE 추가뿐. 판단 순서·규칙 변경 없음.
- 기존 테스트 수정(app-send, app-t061, app-t067)은 DEMO_MODE: 'recording' 입력 추가뿐, 기대값 변경 0.
2. 실행: 전부 종료 코드 0
- npm test 45 파일 2004 통과 / tsc 0 / lint 0 / test:acceptance 158 통과·9 skip / build 0.
- .next/static에 AFTERLOOP_, DEMO_MODE, client_credentials, api-m.sandbox, LLM_API_KEY, AI_LIVE_LIMIT 모두 0건.
3. 안전 탐침 (내가 짠 스크립트, 전역 fetch를 가짜로 바꿔 모든 요청 계수, 앱의 getPayPalClient 실제 경로): 81건 전부 통과, 실패 0. 스크립트 삭제함.
- DEMO_MODE 없음·빈 값·public·Recording·" recording"·"recording "·RECORDING·오타 -> public. 정확히 "recording"만 recording.
- public + REAL_SEND=1 + 추적 스위치 3개 모두 켬: POST/PATCH/PUT/DELETE 호출 전부 Simulated, 가짜 fetch에 닿은 쓰기 0회. 추적 등록도 0회. GET(분쟁 조회)은 나감.
- recording + 스위치 켬 -> 추적 O05·O07 POST 2회만, sendMode live. recording + 스위치 꺼짐 -> 0회, simulated.
- 우회 경로 탐색: src에서 fetch(는 paypal.ts liveDeps 한 곳, client.call 직접 사용은 src/paypal/track.ts(클라이언트를 인자로 받음)와 exec(주입 호출기)뿐. 앱의 send·추적·today·disputes 모두 getPayPalClient를 지남 -> 우회 없음.
- 서연 send-message / 지호 make-offer 1회·send-message 0회 / public 쓰기 0 / HEY·GAH 숨김(showOnScreen:false): 구현자의 ops-t070-gates·cache 테스트(32건, 화면과 같은 loadReply -> sendFromScreen 경로, 가짜 fetch 계수)가 통과함을 직접 재실행으로 확인. 나는 이 서버 액션 전체 경로를 별도 스크립트로 재현하지는 않았다 (클라이언트·추적·모드 관문 층만 직접 탐침).
4. AI 캐시: 통과 (탐침)
- 적중 시 실제 호출 0. 캐시에 없을 때 public 한도 2 설정 -> 실제 2회 후 예외 2회. recording은 한도 0이어도 30회 제한 없음. AI_LIVE_LIMIT_PER_HOUR 없음·빈 값·글자·음수·소수 -> 20, "5"->5, "0"->0.
- 키는 system+user+schema의 sha256, now가 키에 안 들어감 (프롬프트가 토큰만 — 구현자 테스트가 같은 분쟁·다른 now 같은 키 확인, 통과).
- 캐시 파일 형식: {version, entries:{key:{response,createdAt}}}만 직렬화. 환경변수·헤더 없음. 지금 llm-cache.json은 없음(README만) -> 빈 캐시, 컨트롤 타워가 병합 뒤 생성 예정.
5. /api/health: 통과. {ok, mode, commit?}만. commit은 RENDER_GIT_COMMIT이 16진일 때 앞 7자리, 이상한 값이면 생략. 탐침에서 비밀 env 값 미노출 확인. PayPal·AI 호출 없음.
6. render.yaml·deploy.md: 통과
- 비밀(PAYPAL_CLIENT_ID/SECRET, LLM_API_KEY)은 sync: false 이름만. 값 있는 항목은 NODE_VERSION "22"(.nvmrc 22와 일치), DEMO_MODE public, AI_LIVE_LIMIT_PER_HOUR 20, PAYPAL_BASE_URL(공개 샌드박스 주소). 녹화 스위치는 render.yaml에 없고 deploy.md에 "녹화 날만, 공개 배포에는 넣지 않는다"로 기재.
- 빌드 `npm ci && npm run build`, 시작 `npm run start -- -p $PORT`, health /api/health, autoDeploy false.
- 40자 이상 영숫자·sk-·EL…/AY… 꼴 grep: render.yaml·deploy.md·README 0건.
참고(비차단): package.json engines는 >=20 (이 머신 Node 20.20)이라 Render NODE_VERSION=22로 맞춘 구조. plan: free는 자리표시 — 결제는 사람이 결정.
