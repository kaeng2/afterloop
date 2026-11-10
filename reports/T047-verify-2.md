판정: 통과

# T047 보완 독립 검증 (2차)

기준: `tasks/T047.md` "보완" 절, 브랜치 `lane/ui`. 화면 모양은 보지 않았다 (개발 서버 없음). 코드·테스트·설정은 한 글자도 고치지 않았다.

## 1. 범위
- `git diff main...HEAD --stat`: 25개 파일. 전부 `src/app/`, `config/copy.en.json`·`copy.ko.json`, `tests/unit/app-*.test.ts` 3개, `reports/T047-impl.md` 안이다.
- `package.json`·`vitest.config.ts`·`next.config.ts`·`src/engine`·`src/paypal`·`src/ai`·`config/rules.json`·`config/demo-links.json` 변경: **0줄**.
- 작업 트리: 시작할 때 깨끗했다.

## 2. 실행
| 명령 | 결과 |
|---|---|
| `npm test` | 29 파일, 1359 통과, 0 실패 |
| `npx tsc --noEmit` | 종료 0 |
| `npm run lint` | 종료 0 |
| `npm run test:acceptance` | 12 파일, 155 통과 + 9 skip, 종료 0 |
| `npm run build` | 종료 0. 경로: `/`, `/_not-found`, **`/preview/styleguide`** (모두 정적) |

## 3. A 버그
- `src/app/page.tsx`: 제목 + 안내 문구뿐이다. 메뉴를 반복하는 목록 없음.
- `.main`: `width: 100%; max-width: var(--content-max); min-width: 0`. 고정 px 폭·`100vw` 없음 (`globals.css` 검색: `100vw` 0건).
- `overflow-x: hidden` 0건. `overflow-x: auto`는 `.nav` 하나뿐이고 의도된 메뉴 가로 넘김이다.
- `white-space: nowrap` 4곳: `.brand-note`("PayPal sandbox only", 짧음), `.nav-link`(메뉴 칸, 부모가 스크롤), `.badge`, `.risk` — 모두 작은 요소다. 머리글은 `flex-wrap`이라 넘치면 메뉴가 둘째 줄로 내려간다.
- `body`에 `overflow-wrap: anywhere`, `.card`·`.stack`·`.row`·`.grid`에 `min-width: 0`. `.grid`는 `minmax(min(100%, 16rem), 1fr)`.
- 가장 넓은 고정 폭: `.brand-name::before` 0.6em, `.swatch`는 변수 간격. 360px을 넘는 고정 폭 없음.
- 실제로 넘치는지는 보지 못했다 (코드로만 확인).

## 4. B 디자인 기준
**색 값 검색**: `src/app/` 전체에서 `#…`, `rgb(`, `hsl(`, `oklch`, 색 이름을 검색했다. `--color-*` 변수 정의 줄을 빼면 남는 것은 `globals.css` 5번째 줄의 주석(`#003087`·`#0070E0` 언급)뿐이다. 코드·규칙에 색 값 0건. 인라인 `style=` 0건.

**글꼴**: `--font-sans`는 시스템 글꼴 묶음. `PayPal`은 주석에만 있고 글꼴 이름에는 없다. `next/font`·`@import`·`<link … fonts` 0건 (1차의 Geist 삭제 확인).

**강조색과 PayPal 파랑의 RGB 거리** (직접 계산):
| 강조색 | #003087 | #0070E0 | #0070BA | #009CDE | #001C64 | 최소 |
|---|---|---|---|---|---|---|
| 밝은 `#5b3cc4` | 110.2 | 108.5 | 105.3 | 134.8 | 136.1 | **105.3** |
| 어두운 `#a996f0` | 223.6 | 174.0 | 181.4 | 170.1 | 251.1 | **170.1** |
기준 90 이상 충족. 구현 보고서의 105.3 / 170.1과 일치.

**뜻 있는 색**: `--color-risk-high/watch/low`, `--color-success`, `--color-danger`는 `--color-accent`와 다른 변수이고 두 모드 모두 값이 다르다 (확인).

**명암 대비 (WCAG, 기준 4.5:1)**
| 글자색 \ 바탕 | 밝은: bg `#f6f6f3` | 밝은: surface `#fff` | 어두운: bg `#111214` | 어두운: surface `#1a1c1f` |
|---|---|---|---|---|
| 본문 text | 15.59 | 16.88 | 16.00 | 14.58 |
| 보조 muted (배지 글자색) | 6.01 | 6.51 | 7.76 | 7.07 |
| 강조색 accent | 6.72 | 7.27 | 7.41 | 6.76 |
| risk-high | 6.07 | 6.57 | 6.73 | 6.13 |
| risk-watch | **4.79** | 5.19 | 10.18 | 9.28 |
| risk-low | 5.26 | 5.69 | 9.25 | 8.43 |
| success | — | 6.10 | — | 7.73 |
| danger | — | 6.54 | — | 6.77 |
모두 4.5 이상. 가장 낮은 것은 밝은 모드 risk-watch on bg 4.79 (여유 0.29). 못 넘는 조합 없음. 배지 글자(muted)는 배지 바탕이 `--color-bg`인 `fill` 꼴에서도 6.01.

**숫자·크기·카드**
- `.num { font-variant-numeric: tabular-nums }` 공용 클래스 있음 (`.hero-number`·`.compare-value`도 tabular-nums).
- 글자 크기 변수 5개: xs·sm·md·lg·hero (지시 "4~5개" 충족).
- 카드 규칙 하나: `.card` = `--card-padding`·`--card-border`·`--card-radius`, `box-shadow` 없음. 카드 간격 `--card-gap` 하나. (`.notice`는 같은 변수로 만든 안내 상자이고 규칙은 같다.)

**배지 5종 비교** (`badge-keys.ts`·`globals.css`)
| 배지 | 글자색 | 바탕 | 테두리 | 기호 | 기타 |
|---|---|---|---|---|---|
| AI suggests | muted | 없음 | 점선 muted | ◇ | |
| Code decides | muted | 없음 | 실선 muted | = | |
| Demo data | muted | `--color-bg` | 실선 `--color-border`(옅음) | ◌ | 옅은 바탕 |
| Assumption | muted | 없음 | 점(dotted) muted | ≈ | |
| cached | muted | 없음 | 없음 | ↺ | 기울임 |
다섯 개 모두 같은 무채색 글자·거의 같은 바탕이고, 테두리 꼴과 기호가 서로 다르다. 채도 높은 색 면 없음. 흑백 인쇄해도 기호로 구분된다. 참고: `Demo data`와 `cached`는 테두리가 아주 옅거나 없어 점선/실선보다 눈에 덜 띈다 (기록만 — 스크린샷에서 볼 것).
위험 3종은 `RiskLevel`(`.risk`)로 배지와 다른 부품이며 색 + 글자 + 기호(▲ ◆ ●)로 구분된다.

**문구 키**: `badge.*` 8개(배지 5 + riskHigh/Watch/Low)가 두 문구 파일에 있다. 두 파일의 전체 키 집합이 같다 (77 = 77, 차이 0). 설명 키 `badge.hint.*` 5개도 있다.

## 5. C 견본 화면
- `src/app/preview/styleguide/page.tsx` 있음. `nav-items.ts`의 메뉴는 `/`, `/products`, `/orders`, `/inbox` 4개뿐이라 견본은 메뉴에 없다.
- `src/app/_shared/compare-card.tsx` 있음 (계산하지 않고 글자만 받는다).
- `src/app/`에서 `\b(74|37|7400|3680)\b` 검색: `money.ts`의 주석 예시 2줄(`7400 → "$74"` 등, 변환 설명)뿐이고 화면 값이 아니다. 견본 코드·tsx에는 없다.
- 탐침(`.../scratchpad/t047-verify-2/p1.ts`): `compareSample()` = before 7400¢ `$74`(refund), after 3680¢ `$37`(fight). 보드를 내가 따로 만들어 `recommend`에 넣은 값 7400 / 3680과 같다.
- import: `@/engine/recommend`, `@/types`, `../../_shared/money`, 배지·문구 부품뿐. PayPal·LLM·네트워크·시드 import 없음.

## 6. D
- (a) 탐침(`p3.ts`, `server-only`를 빈 모듈로 바꿔 끼움): 고정 응답 `dispute-detail.inquiry-waiting-seller.json`은 messages 1 + evidences 1(같은 글). `buyerMessagesWithTime` = **1건**. 그 입력으로 `buildEscalationSignals`를 부르면 `secondMessageUnanswered: false`. 규칙은 `@/paypal/mapper`의 `buyerTexts`와 같다 (시각 순 → 공백 뺀 글 중복 제거). 단위 테스트(245~275행)도 있다.
- (b) `src/app/_server/`의 3개 파일(`disputes.ts`·`llm.ts`·`paypal.ts`) 모두 첫 import가 `import 'server-only'` (주석 다음 첫 구문). 실제 `server-only` 패키지는 RSC 밖에서 import하면 던진다 (탐침으로 확인). 테스트는 파일 안에서 `vi.mock('server-only', () => ({}))`만 쓰고 `vitest.config.ts`는 변경 0줄이다. 판단: 이 import는 번들 경계 방어용이고 테스트 대상 로직과 무관해서, 모듈 하나를 빈 모듈로 바꿔도 테스트의 의미가 해쳐지지 않는다. 다만 "브라우저 번들에 들어가면 빌드가 막힌다"는 성질은 단위 테스트가 못 본다. 지금은 `_server/`를 import하는 화면이 없다 (기록만).
- (c) 탐침: `get`·`call`과 LLM이 모두 `SECRET_MARKER_XYZ`를 던지게 하고 `loadDemoDisputes` 결과를 직렬화하면 표식 **0건**, `paypal: {ok:false, reason:'request_failed'}`. `getPayPalClient({})` → `not_configured`, 샌드박스 아닌 주소 → `not_sandbox`, `getLlm({})` → `not_configured`, `unavailableLlm()`이 던지는 메시지는 사유 코드뿐. 사유는 `UNAVAILABLE_REASONS` 고정 코드다.

## 7. 빌드 묶음 검색
`.next/static/`에서 `PAYPAL_CLIENT_SECRET` 0, `PAYPAL_CLIENT_ID` 0, `LLM_API_KEY` 0, `api-m.sandbox.paypal.com` 0, `client_credentials` 0 (파일 수 기준).

## 8. 1차 통과 항목 유지
`npm test` 1359 통과에 1차 시험이 모두 들어 있다: 분쟁 읽기에서 POST 0회·연습용/옛 서연 제외·D2가 목록에 없어도 번호로 읽기·표에 없는 분쟁 제외(`app-shared-disputes.test.ts` 172~210행), `isLiveSendAllowed`(D1·D2 true 등, `app-shared.test.ts`), 금액 표시 함수. 인수 테스트 155 통과. 깨진 것 없음.

## 9. 구현 보고서 "보완" 절 주장 대조
- 거리 105.3 / 170.1, 대비 4.5 이상, 테스트 수(`app-shared` 27), 빌드 경로, 번들 검색, `$74 → $37`: **사실**.
- 결정 요청 1(청록 후보 제외 근거): 청록 `#0f766e`를 내가 계산하면 `#0070BA`와 77.7, `#003087`과 75.8, `#001C64`와 91.8 — 모두 "약 76"이라는 주장에 가깝고 일부는 90 미만이다. 그러나 이는 그 한 가지 청록에만 해당하는 값이다 (다른 청록은 가능). **주장은 대체로 사실**이되 "청록 계열 전체가 안 된다"는 뜻은 아니다. 강조색 확정은 사람 몫.
- 결정 요청 2(SPEC 3장의 배지 색): `SPEC.md` 43행에 "`AI suggests`(보라)와 `Code decides`(회색) 배지"가 실제로 있고, 지금 구현은 모양 구분이라 문구가 어긋난다. **사실**. 컨트롤 타워가 SPEC 문구를 맞추면 된다 (기록만).
- 보고서의 "`Geist` 삭제": 현재 `layout.tsx`에 `next/font` 없음. **사실**.
- 사실과 다른 주장: **찾지 못했다.**

## 발견한 문제
- 병합 차단: 없음.
- 병합 후 수정: 없음.
- 기록만:
  1. SPEC 3장 43행의 배지 색 표기(보라/회색) 불일치.
  2. 밝은 모드 risk-watch on bg 대비 4.79로 기준에 가장 가깝다 (통과).
  3. `Demo data`·`cached` 배지의 테두리가 약해 화면에서 너무 흐린지 스크린샷 확인 필요.
  4. `server-only` 때문에 vitest에서 빈 모듈 처리 필요. `_server/`를 import하는 화면이 생기면 빌드로 경계 확인 필요.
  5. `buyerMessagesWithTime`가 `mapper.buyerTexts`를 부르지 않고 같은 규칙을 한 벌 더 가진다 (규칙이 갈라질 위험. 지시서가 허용한 방식).

## 확인하지 못한 것
- 화면 모양 전부: 360·390px 가로 넘침, 머리글 접힘, 메뉴 가로 넘김, 비교 카드 세로 쌓임, 배지의 실제 구분감, 밝은·어두운 모드 모습. 개발 서버·`npm run start`를 띄우지 않았다.
- 실제 PayPal·LLM 호출 (하지 않음, `.env` 없음).

탐침 스크립트: `/private/tmp/claude-501/-Users-kaeng2-repositories-paypal-hackathon/68e4e97b-9470-41c8-aa12-f4a21f8164f5/scratchpad/t047-verify-2/` (`c.py` 계산, `p1.ts` 견본 대조, `p2.ts`·`p3.ts` 분쟁 읽기·사유).
