# T092 보고 (2026-11-12 01:15)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-progress / ac93bbd (구현). 이 보고서는 그 뒤 커밋

## 결과
완료 — Send 성공(공개 모드는 Simulated 성공) 뒤 "지금 대응" 칸이 "What happens next · Simulated" 진행 칸으로 바뀐다. 순서: 보낸 말풍선 → typing → 손님 답장(Simulated, 통관번호 가림) → [Forward to carrier](판매자가 누를 때까지 멈춤) → 세관 통과 → "이번 주" 카드 숫자 칸 flash + 토스트 → [Replay this case]. 단계 % = 엔진 `scenarioRisk`, 토스트 금액 = 엔진 `actionSavings`. PayPal·AI·배송사 호출 0회, 서랍 기록 0줄.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/progress/case-progress.tsx` (새) | 진행 칸. 시안 `send()` 타이밍(`1300·(k−1)+400`), `shown`·`typing`, 끝나면 flash + 토스트(3초), Replay. 말풍선은 서버가 그린 대화 목록(`.case-thread`) 끝에 portal로 붙인다(시안 thread.push. 못 찾으면 칸 안에 그림). 곡선 카드 끝점·큰 %는 `useDraftForecast`로 지금 단계 엔진 값을 넘기고, 칸을 떠나면 보내기 전 예측으로 되돌린다. reduced-motion이면 간격 0 |
| `src/app/cases/progress/progress-model.ts` (새) | 순수 함수: 상태 기계(buyerReplied · forwardToCarrier · customsCleared), 단계 줄(`stepRows`, `CaseEvent.source = 'simulated'`), `currentRisk`, `maskCustomsIds`(`P•••••••9012`), motion 설정 읽기(zod) |
| `src/app/cases/progress/progress-client.ts` (새) | 브라우저 어댑터: `scenarioRisk`·`actionSavings` 그대로 호출 (예외면 `null` → 칩·토스트 숨김) |
| `src/app/cases/progress/case-progress.css` (새) | 시안 `.step`·`.sic`·`.ndots`·`.bub-out`·`.bub-sim`·`.flash`·`.toast` 값. 시간은 `--cprog-*` 변수만, 색은 변수 정의 줄에만. `.work:has(.cprog)`로 보낸 뒤 선택지 카드·머리 줄 숨김 |
| `src/app/cases/reply/reply-panel.tsx` | **전환 지점 한 곳만**: `sendState === 'done' && outcome.ok`이면 `<CaseProgress>` 반환 (+ import 한 줄). 제안 카드(지호) 경로·관문·서버 액션은 무변경 |
| `config/copy.en.json`, `config/copy.ko.json` | `case.progress.*` 28키 (en=ko 키 집합) |
| `config/motion.json` | `caseProgress` 키 추가 (firstStepMs 400, stepMs 1300, step .45s cubic-bezier(.2,1.2,.4,1), bubble .35s, typingDot 1s/0.15s, flash 1.6s, toast .35s/3000ms). 기존 `desk`·`scene3` 무변경 |
| `tests/unit/app-t092.test.ts` (새) | 17개: 순서·Forward 전 멈춤, 시안 값 = 설정 값, 호출 0회·서랍 0줄(fetch·서버 액션 spy, `listActivity()`), 통관번호 원문 없음, % = scenarioRisk, Assumption, Simulated 표시 규칙, simulated 사건, 토스트 금액 |
| `tests/unit/app-t081.test.ts` | "ko 값이 영어 그대로" 허용 목록에 2키 추가: 손님 답장 원문(한국어 그대로)과 그 영어 번역 줄 |
| `reports/design-match/inventory.md` | Desk 표에서 이 태스크 몫 31행 상태·근거 채움 (구현함 23 · 예외 8) |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | |
| npm test | 2389 | 0 | 처음 돌릴 때 T087 `.next/static` 검사 1건이 실패 — 예전 빌드 산출물 때문. `npm run build` 뒤 다시 돌려 0 실패 |
| npx tsc --noEmit | ✓ | 0 | |
| npm run lint | ✓ | 0 | |
| npm run build | ✓ | 0 | |

실제 AI·PayPal 호출 없음, 개발 서버 없음, `.env` 안 읽음. 브라우저에서 눌러 본 확인(스크린샷)은 하지 않았다 — 단계별 화면은 `initial` 상태로 정적 렌더해 시험했다 (jsdom 없음).

## 시안과 다른 점 (DECISIONS 2026-11-11 22:55 예외 그대로)
- 제목 "What happens next · Simulated" (시안 "Case progress · Live"). 손님 답장부터 모든 단계에 "Simulated" 꼬리표. 공개 모드는 보낸 답장 줄·말풍선에도 Simulated, 녹화 모드는 보낸 답장만 실제 ("PayPal sandbox · <분쟁 번호>").
- 시안 3단계 "DisputeLess forwarded the ID · Auto · POST carrier/customs-clearance · 200" → [Forward to carrier] 대기 줄(시안 act 줄 모양). 누르면 "forwarded · You approved · nothing was sent to a carrier". 시안 5·6단계(추적 동기화 `POST /v1/shipping/trackers`, Delivered)는 없다 — 세관 통과에서 끝 (지시서 단계 목록대로).
- 결과 상자(resOn: "Resolved in 5 days · $0 lost", "23 days · 4 messages", "−$82")와 dash 고정 숫자 bump 없음 — 근거 없는 성과 숫자. 끝 표시는 엔진 `actionSavings` 토스트("Dashboard updated · +$37 kept", 서연 fight 3720¢ → 반올림 표기)와 카드 flash.
- 시안의 결과 분기(out 'refund'·'cb', [Refund $72 now])는 없다 — 보낼 수 있는 글은 검사 통과한 AI 초안뿐(editGate)이라 'ok' 경로 하나. 환불 실행 없음.
- 단계 시각("Nov 10 · 16:40" 등)은 지어낸 시각이라 쓰지 않는다. 시뮬레이션 사건의 `at`은 보낸 시각.
- 토스트 그림자: 시안 `rgba(0,0,0,.25) 0 8px 24px` 대신 `--shadow-selected` (T067 사람 결정 "그림자는 변수 하나", `app-shared-design` 시험). 토스트 rise는 가운데 맞춤(translateX(-50%))을 지키도록 같은 이동에 -50%를 함께 둔 키프레임 (시안은 애니메이션 동안 가운데에서 벗어남).
- typing 말풍선: 시안 bub-in 그림자 대신 1px 테두리 (같은 이유).

## 다른 사례 (지시서 만들 것 3)
- **지호(제안이 먼저)**: 진행 칸을 쓰지 않는다 — 제안 카드 경로는 전환 지점 앞에서 먼저 반환되고 지금 그대로(결과 한 줄). 손님 답장 문구가 통관번호용이라 일반화하지 않았다.
- **Mike(Routine)**: 답장 칸 자체가 없어 해당 없음.
- 일반화하려면: 사례 원인(subtype)별 시뮬레이션 손님 답장 문구 키 + 단계 목록을 copy·`config/reply-model.json scenario`에 두면 같은 컴포넌트로 된다. 이번 범위 밖.

## 남은 문제
- **곡선 카드의 "점이 이어진다"는 일부만**: 곡선 끝점(점선 끝)과 큰 %가 단계마다 `scenarioRisk` 값으로 내려가지만, 시안처럼 단계마다 점이 하나씩 **늘어나지는** 않는다. `RiskCurveCard`/`curveView`(`view/risk-curve.tsx`, `desk-model.ts`)가 끝점 하나만 받기 때문이고, 두 파일은 이 태스크의 수정 가능 범위(새 파일 + 전환 지점) 밖이다. 곡선 옆 작은 글("with your draft")도 보낸 뒤 그대로다. → T098(또는 T091 병합 뒤 후속)에서 `curveView`에 시뮬레이션 점 목록을 받게 하면 된다.
- **"이번 주" 카드 "+$N just now" 줄**은 그리지 않았다 — 카드는 `src/app/today/today-list.tsx`(수정 가능 범위 밖)이다. 숫자 칸 flash는 진행 칸이 DOM에서 `.weekly-cell` 앞 3칸에 클래스를 붙여 낸다(카드 코드는 무변경). 금액은 토스트로만 보인다.
- `config/motion.json`은 지시서 "수정 가능 폴더" 목록에 없지만, 지시서 모션 절이 "이 태스크 몫 (`config/motion.json` 값)"이라 새 키(`caseProgress`)만 더했다. 기존 키는 손대지 않았다.
- T091이 같은 `reply-panel.tsx`를 고치는 중이라 병합 때 충돌이 날 수 있다. 이 태스크의 변경은 import 한 줄 + "답장" return 바로 앞 `if (sendState === 'done' …) return <CaseProgress …/>` 블록 하나다. T091이 `again`·`text`·`forecast`·`board`·`anchor`·`translated` 이름을 바꾸면 그 블록만 맞추면 된다.
- 브라우저에서 시안과 나란히 눌러 본 확인(Playwright)은 T098 몫으로 남김.

## 컨트롤 타워에 요청할 결정
- 곡선 카드에 시뮬레이션 점을 단계마다 더하는 일(`curveView`·`RiskCurveCard` 수정)을 어느 태스크에 둘지 (T098 권장). 계약 변경은 필요 없다 (`ScenarioPoint[]`를 화면 안에서 넘기기만 하면 됨).
- "이번 주" 카드의 "+$N just now" 줄(SPEC 8-4)을 Today 카드 쪽 태스크에서 할지 — 진행 칸은 이미 엔진 값(`actionSavingsClient`)을 갖고 있어 공유 상태(예: 작은 context) 하나면 된다.
