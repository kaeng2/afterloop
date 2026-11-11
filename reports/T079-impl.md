# T079 보고 (2026-11-11 21:30)

- 기준 SPEC: v2.11 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui / f7bc361 (구현). 이 보고서는 그 다음 커밋
- 작업 폴더: `afterloop-wt/ui` (worktree). 실제 AI·PayPal POST 호출 0회 (가짜 LlmCaller·가짜 PayPal 읽기), 개발 서버 실행 없음

## 결과
완료 — 어댑터 6개를 엔진(T075)·AI 요약(T077)으로 연결했다. `/intro`는 라우트 그룹 밖으로 빼 Today 읽기·PayPal 조회 0회. 이번 주 카드 Demo data 배지를 짙은 바탕용으로 고쳤다. 보내기 관문(`send.ts`)·데모 모드(`mode.ts`)·`activity.ts`·승인 버튼·검사 줄은 바꾸지 않았다 (`editGate`·`canSend`·`sendReplyAction` 호출 그대로).

## 연결한 어댑터
| 어댑터 | 지금 | 비고 |
|---|---|---|
| `loadRiskCurve(events, board, anchor?)` | `riskCurve(events, board, …, { calibration })` | 보정 = `replyCalibration(기준 초안·신호·늦은 날·translated)` = 답장 예측 `parts.calibration`과 같은 값. 기준 초안이 없으면 c = 0. 사건 0개·예외면 `null` |
| `loadWeeklySummary` | `weeklySummary({ boards, aiDrafts, usesDemoData })` | `aiDrafts` = `countCachedDrafts()`: `data/ai-cache/llm-cache.json`에서 `draft_en` 글자 칸이 있는 항목 수 (지금 파일 = 3). 파일 없음·깨짐·항목 0개면 `null` → 초안 칸만 숨김 (`weeklyView(…, { aiDraftsCounted })`). 파일 기준이라 실행 중 새로 받은 응답은 세지 않는다 |
| `loadMoveForecasts` | `forecastMoves(...)` 의 `pChargeback`만 | 막힌 수(null)는 빼고 넘긴다. 신호·기준 초안이 없으면 `null` |
| `forecastReplyClient` | `forecastReply(input)` | 브라우저. 엔진 순수 함수 + 설정 JSON만 import |
| `detectReplyFeaturesClient` | `detectReplyFeatures(text, { translated })` | 브라우저 |
| `loadHistorySummary(events, who, deps?)` | `summarizeCaseHistory(토큰화한 사건, { llm: getLlm() })` | `loadCase`의 AI 초안 길(`draft !== false`)에서만 → AI 캐시 만들기 경로 안. Routine(Mike)은 안 부름 |

**`translated` (한 가지로 정함)**: `replyTranslated(buyerLocale)` = 구매자 언어를 알고 영어가 아니면 참 (보낼 때 번역되므로). `case-detail.tsx`가 한 번 정해 곡선·선택지(서버)와 답장 칸(`forecastBase.translated`, 브라우저)에 같은 값을 준다 → 보정이 같다. 서연(ko)은 참 → "구매자 언어" 칩이 켜진다.

**이름 토큰화** (`tokenizeHistoryNames`, AI에 넘기는 사본만. 화면 사건 글은 그대로): 시드 이름의 각 낱말(김서연·Seo-yeon·Kim) + `reply.names.buyers[id]`의 꼴(Seo-yeon, 서연 님→서연) → `⟦BUYER_NAME_1⟧` (긴 것 먼저. 라틴은 낱말 경계, 한글은 조사가 붙어도). 판매자 서명(Hannah, Fernwood Knits와 각 낱말) → "the seller" (요약 검사가 구매자 토큰만 받으므로 토큰이 아닌 말). 요약에 나온 토큰은 코드가 `names.buyers[id].en`으로 채우고, 없으면 "the buyer".

## /intro — 고른 방법: 라우트 그룹
- 루트 `src/app/layout.tsx` = `<html>`·`<body>`·글꼴·제목만 (데이터 읽기 없음).
- 새 `src/app/(app)/layout.tsx` = skip-link·위쪽 막대·`loadTodayForRequest`·`<main>` (옛 루트 layout 내용 그대로).
- 페이지 파일만 그룹으로 옮겼다 (주소 그대로): `(app)/page.tsx`, `(app)/products/page.tsx`, `(app)/cases/[disputeId]/{page,layout}.tsx`, `(app)/preview/styleguide/page.tsx`. import는 `@/app/...`로. 나머지 모듈(`today/`, `products/`, `cases/` …)은 제자리.
- `/intro`는 그룹 밖 → 빌드 표에서 `○ /intro`(정적)로 바뀜. T078 덮개(`position: fixed; inset; z-index; overflow`) 걷음. 화면 내용·문구는 그대로.

## 이번 주 카드 배지
`.weekly .badge-border-fill { background: var(--color-on-accent-fill); border-color: var(--color-on-accent-muted) }` — 채운 꼴(fill)·기호는 그대로, 흰 상자 대신 반투명 흰 바탕. 새 색 변수 `--color-on-accent-fill`은 밝은·어두운 모드 둘 다 정의. 배지 모양 규칙 테스트(`app-shared-design`) 그대로 통과.

## Assumption 배지 확인
위험 곡선 카드 ✓ (있었음), 선택지 머리(차지백 %) ✓ (있었음), 반응 막대·기대 비용 ✓ (있었음), **입력칸 모서리 "Chargeback N%"에는 없어서 더했다**, 이번 주 "지킬 수 있는 돈" ✓.

## 서연 예시값 (시험의 가짜 AI 초안, 기본 설정 P·R, 신호 4개, 늦은 날 9, translated 참)
- fight 기대 손실 3680¢ → 반응 막대 "$37" = 선택지 Reply "$37" = recommend fight 3680¢ (센트까지 같음)
- 답장 예측 pChargeback 40% (= 선택지 Reply 차지백 %), refund 3%, offer 막힘 → % 없음
- 위험 곡선 9점: 3%, 3%, 3%, 3%, 3%, 4%, 73%, 80%, 80% → "Your draft" 40%
- 탓하는 문장을 더하면 64%로 오르고, 관문은 `EDITED_KEY`("Edited text can't be sent")로 막음

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/forecast-source.ts` | 서버 어댑터 3개 → 엔진. `ForecastAnchor`, `replyTranslated`, `countCachedDrafts`(+ 시험용 `resetCachedDraftCount`), `WeeklyLoad` |
| `src/app/cases/forecast-client.ts` | 브라우저 어댑터 2개 → 엔진 (예외면 null). 입력에 `translated` |
| `src/app/cases/history-summary-source.ts` | `summarizeCaseHistory` 연결, `tokenizeHistoryNames`, 토큰 채우기. `deps.llm` 시험 주입 |
| `src/app/cases/view/load.ts` | `loadHistorySummary(events, { buyerId, buyerName })` |
| `src/app/cases/case-detail.tsx` | 기준 상황(`anchor`) 하나를 곡선·선택지·답장 칸에 같이 넘김 |
| `src/app/cases/reply/reply-panel.tsx` | `forecastBase.translated`를 예측·칩에 넘김, 모서리 % 옆 Assumption 배지. 관문·전송 코드 무변경 |
| `src/app/_server/today.ts`, `src/app/today/model.ts` | `weeklyView(…, { aiDraftsCounted })` |
| `src/app/layout.tsx`, `src/app/(app)/layout.tsx` (새), 페이지 5개 이동 | /intro 정리 (위) |
| `src/app/intro/intro.css` | 덮개 걷음 |
| `src/app/globals.css`, `src/app/today/today.css` | 짙은 바탕 배지 |
| `tests/unit/app-t079.test.ts` (새, 20개) | 완료 기준 전부 (아래) |
| `tests/unit/app-t076`·`app-t068`·`app-case-reply` | 대체안(어댑터 null) 시험은 `forecaster/detector: () => null` 주입으로 같은 뜻 유지. "브라우저 어댑터 = null" → "= 엔진 결과", 서버 어댑터 "몸통 null" 검사 삭제(server-only 검사는 유지), 예측 입력에 `translated: false` |
| `tests/unit/app-today`·`app-t061`·`app-t067`·`app-shared-design`·`app-product-t073` | 옮긴 페이지 경로만 고침 (검사 내용 그대로, `(app)/layout.tsx`도 검사 대상에 추가) |

## 완료 기준 대조 (app-t079.test.ts)
| 기준 | 결과 |
|---|---|
| 숫자 일치: 반응 막대 기대 비용 = 선택지 Reply = recommend fight | ✓ 센트·글자 모두. 기본 어댑터로 그린 답장 칸 글자도 같음 |
| 곡선 "Your draft" 점 = 답장 예측 pChargeback (같은 보정) | ✓ `loadRiskCurve` = `riskCurve(…, { calibration: forecast.parts.calibration })`, 보정 없는 곡선과 다름, draft 점·큰 % = 예측 값 |
| 입력칸 글 바꾸면 예측 바뀜(탓하는 문장 → 위험 오름), Send 꺼짐 | ✓ |
| 사건 기록 요약: 가짜 LlmCaller가 받은 글에 Seo-yeon·서연·김서연·Kim·Hannah·Fernwood 없음, 실패(예외·스키마·날짜·환불 약속)면 null | ✓ |
| `/intro`에서 Today 읽기·PayPal 조회 0회 (가짜 클라이언트로 셈), 화면 그대로 | ✓ 루트 layout + intro 페이지 그림 = 0회 / 0회. 비교: `(app)` layout은 > 0 |
| `.next/static`에 AFTERLOOP_·DEMO_MODE·LLM_API_KEY·client_credentials·api-m.sandbox·llm-cache.json 없음 | ✓ `npm run build` 뒤 grep 0건 (엔진 모델 가중치는 브라우저 묶음에 들어감 — 의도대로) |
| npm test·tsc·lint·acceptance(AC33 포함)·build 실패 0 | ✓ 아래 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 167 | 0 | 건너뜀 9 = AC13 샌드박스 실호출용 (전과 같음). AC33 건너뜀 없음 |
| npm test | 2207 | 0 | 55 파일 (전 2187 + 새 20) |
| npx tsc --noEmit | ✓ | 0 | 빌드 뒤 (`.next/types`가 옛 페이지 경로를 들고 있어 빌드 전에는 그 5줄 오류) |
| npm run lint | ✓ | 0 | |
| npm run build | ✓ | 0 | `ƒ /` 37.4 kB, `○ /intro` 7.22 kB (정적) |

## 남은 문제
- **스크린샷 없음** (개발 서버 금지). 배지 색·/intro 배치는 컨트롤 타워 스크린샷으로 확인 필요.
- 엔진 칩이 켜지면 입력칸 아래 칩 받침은 "As you type"(엔진 판정, Code decides)으로 바뀌고 **AI 코칭 칩("Suggested reply covers" + AI suggests)은 더 보이지 않는다** — T076 설계("특징 판정이 있으면 As-you-type, 없으면 지금 칩") 그대로. 영상 대본이 AI 칩을 보여 준다면 확인 필요.
- 사건 기록 요약의 프롬프트 글이 바뀌었으므로(이름 토큰화) 컨트롤 타워가 캐시를 다시 만들어야 요약 줄이 공개 배포에 나온다 (지시서 "다음"대로).
- 곡선 마지막 점(빈 글 위험)과 답장 예측의 늦은 날 수 정의가 다르다: 곡선은 엔진 규칙(‘unanswered’ 표시 메시지부터 사건 시각까지), 답장 칸은 `unansweredDays(events, now)`. 그래서 곡선 끝 80% ≠ "빈 글 답장" 예측 값일 수 있다 (기준에는 없음, "Your draft" 점은 같은 보정으로 일치).
- AI 캐시 초안 수는 프로세스에 한 번 센 값을 기억한다 (배포 때 파일이 바뀌면 재시작으로 반영).

## 컨트롤 타워에 요청할 결정
- 없음 (계약·인수 테스트·SPEC 변경 불필요). 참고: `translated`를 "구매자 언어가 영어가 아니면 참"으로 정했다 (T075 보고서가 한 가지로 정하라고 한 부분) — 바꾸려면 `forecast-source.ts`의 `replyTranslated` 한 곳.
