# 배포 안내 — Render 공개 데모 (T070)

> **값은 이 문서에 쓰지 않는다.** 아래는 환경변수 **이름**과 뜻뿐이다. 값은 사람이 Render 화면(Environment)에
> 직접 넣는다. Client Secret·AI 키는 어떤 AI도 읽거나 출력하지 않는다 (CLAUDE.md).

## 1. 모드

| `DEMO_MODE` | 뜻 |
|---|---|
| (없음) · `public` · 그 밖의 모든 값 | **공개 데모 (기본).** PayPal 쓰기 호출 0회 — 답장 보내기·제안·추적 등록 버튼은 "Simulated" 결과만. 읽기(분쟁 목록·상세·주문 조회)는 실제 샌드박스. AI는 캐시를 먼저 보고, 없으면 시간당 `AI_LIVE_LIMIT_PER_HOUR`회까지만. 화면 위쪽 막대 아래에 "Public demo · simulated sends" 한 줄 |
| 정확히 `recording` | 녹화용. 실제 전송 스위치를 볼 수 있다 (스위치·연결 표 `liveSendAllowed`·판매자 승인 버튼을 지금처럼 모두 거친 뒤에만). AI 한도 없음 (캐시는 쓴다) |

대소문자·공백·오타(`Recording`, ` recording`)는 모두 public이다.

## 2. Render에 넣는 환경변수 이름

### 공개 배포 (늘 넣는다)

| 이름 | 비밀? | 뜻 |
|---|---|---|
| `PAYPAL_CLIENT_ID` | 예 (`sync: false`) | PayPal **샌드박스** 앱 Client ID |
| `PAYPAL_CLIENT_SECRET` | 예 (`sync: false`) | PayPal **샌드박스** 앱 Client Secret. 사람만 입력 |
| `PAYPAL_BASE_URL` | 아니오 (`render.yaml`에 샌드박스 주소로 고정) | PayPal API 주소. 샌드박스 주소가 아니면 앱이 PayPal을 쓰지 않는다 |
| `LLM_API_KEY` | 예 (`sync: false`) | AI 키 (캐시에 없는 요청만 실제로 부른다) |
| `DEMO_MODE` | 아니오 (`render.yaml` 기본 `public`) | 위 1장 |
| `AI_LIVE_LIMIT_PER_HOUR` | 아니오 (`render.yaml` 기본 `20`) | public에서 캐시에 없을 때 실제 AI를 부르는 시간당 최대 횟수 (프로세스 기준). 0 이상의 정수만, 그 밖은 20. 넘으면 화면은 "AI unavailable — showing rules only" |
| `NODE_VERSION` | 아니오 (`render.yaml`에 `22`) | `.nvmrc`와 같은 Node 버전 |

선택 (넣지 않으면 기본값): `LLM_MODEL`, `LLM_EFFORT`, `LLM_TIMEOUT_MS`, `LLM_MAX_RETRIES` — 뜻은 `src/ai/llm.ts` 머리 주석.

Render가 스스로 넣는 `RENDER_GIT_COMMIT`은 `/api/health`가 앞 7자리만 보인다 (16진 글자일 때만).

### 녹화 날에만 넣는다 — **공개 배포에는 넣지 않는다**

| 이름 | 뜻 |
|---|---|
| `AFTERLOOP_REAL_SEND` | 정확히 `1`이면 답장·제안 실제 전송 (recording일 때만 읽힌다) |
| `AFTERLOOP_TRACK_LIVE` | 정확히 `1`이면 추적번호 실제 등록 (recording일 때만) |
| `AFTERLOOP_TRACK_LIVE_ORDERS` | 추적 등록을 허용할 주문 키 (쉼표로) |
| `AFTERLOOP_TRACK_RECORDING` | 정확히 `1`이면 녹화용 주문(O05·O07)을 허용 목록에 넣을 수 있다 |

이 넷은 `DEMO_MODE=recording`이 아니면 켜져 있어도 쓰기 0회다. 그래도 공개 배포에는 넣지 않는다 (두 겹으로 막는다).

## 3. 배포 순서 (사람 / 브라우저 에이전트)

1. **Blueprint 연결**: Render → New → Blueprint → 이 저장소, 브랜치 `main` → `render.yaml`을 읽는다. 지역·요금제(`plan: free`, `region: oregon`)는 자리만 둔 값이다 — 결제는 사람이 정한다.
2. **이름 입력**: Render가 `sync: false` 이름(`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `LLM_API_KEY`)의 값을 묻는다. 사람이 직접 넣는다.
3. **첫 배포**: `npm ci && npm run build` → `npm run start -- -p $PORT`. (`autoDeploy: false` — 배포는 사람이 누른다)
4. **상태 확인**: `GET /api/health` → `{"ok":true,"mode":"public","commit":"<7자리>"}`. `mode`가 `public`인지 본다. 이 경로는 PayPal·AI를 부르지 않고 env 값을 내지 않는다.
5. **캐시 데우기**: 아래 4장 캐시 파일이 main에 들어가 있으면 배포만으로 끝난다 (앱이 처음 한 번 읽는다). 확인으로 Today → 서연 → 지호 → Mike 상세를 한 번씩 연다 — AI 실제 호출은 캐시에 없는 요청만 생긴다.

## 4. AI 캐시 만들기 (컨트롤 타워, 병합 뒤)

```bash
npx tsx --env-file=.env scripts/ai-cache/build.ts
# 다른 곳에 쓰려면: ... build.ts --out <파일>
```

- 하는 일: 앱과 **같은 서버 함수**를 그대로 돌리며, 그동안 `getLlm()`이 기록 호출기를 돌려준다.
  1. `loadDemoDisputes()` — 분쟁 읽기 (PayPal **GET만**) + 규칙이 못 정한 보드의 분류 + 구매자 글 어조 판정
  2. 화면 분쟁마다 (연결 표 `showOnScreen` = 서연·지호·Mike) `loadCase` — 구매자 글 영어 + 코칭 + 영어 초안
  3. 같은 분쟁마다 `loadReply` — 전송본 번역 + 역번역
- 쓰는 파일: `data/ai-cache/llm-cache.json` = `{ version, entries: { <sha256 키>: { response, createdAt } } }`. **키·응답·만든 시각만** (환경변수·헤더·요청 글 없음).
- 키: `sha256(system + "\u0000" + user + "\u0000" + JSON.stringify(jsonSchema))`. 프롬프트에는 날짜·금액·이름 값이 없고 토큰만 있으므로 날짜가 바뀌어도 같은 키다. 분쟁 글·상태가 바뀌면 키가 바뀐다 → 다시 만든다.
- 출력: AI 호출 횟수, 항목 수, 분쟁 번호별 초안·번역 여부 (O/X), 사유 코드. 응답 글·키 값은 찍지 않는다.
- PayPal이나 AI를 쓸 수 없거나 기록이 0개면 파일을 쓰지 않고 1로 끝난다 (빈 캐시로 덮어쓰지 않는다).
- 서버 모듈(`server-only`) 때문에 스크립트가 `--conditions=react-server`를 더해 자기 자신을 한 번 다시 띄운다 (자동).
- 실행 뒤 `data/ai-cache/llm-cache.json`을 main에 커밋 → 배포.
- 지금 화면 경로에 색상 문구(`src/ai/color-note.ts`) 호출은 없다 (Products 탭이 붙으면 다시 본다).

## 5. 녹화 날 바꾸는 것

1. Render Environment에서 `DEMO_MODE`를 `recording`으로 바꾼다.
2. 녹화에 필요한 스위치만 넣는다: `AFTERLOOP_REAL_SEND=1`, (추적 장면이면) `AFTERLOOP_TRACK_LIVE=1`, `AFTERLOOP_TRACK_LIVE_ORDERS`, `AFTERLOOP_TRACK_RECORDING=1`.
3. 저장 → 재배포 → `/api/health`가 `"mode":"recording"`인지 본다. 화면의 "Public demo" 줄이 사라진다.
4. 녹화 중 실제 전송은 지금과 같다: 연결 표 `liveSendAllowed` + 판매자 글이 없는 분쟁 + 판매자 승인 버튼. (지호 제안 = make-offer 1회, send-message 0회)
5. 녹화하는 동안은 공개 URL을 다른 사람에게 알리지 않는다.

## 6. 녹화 뒤 되돌리기

1. 위 2번의 스위치 넷을 **지운다** (값을 `0`으로 두지 말고 이름째 지운다).
2. `DEMO_MODE`를 `public`으로 되돌린다.
3. 재배포 → `/api/health`가 `"mode":"public"`인지, 화면에 "Public demo · simulated sends"가 다시 보이는지 본다.
4. `reports/STATUS.md`에 한 줄 남긴다.
