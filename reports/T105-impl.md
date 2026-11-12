# T105 보고 (2026-11-12 09:40)

- 기준 SPEC: v2.15 (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-scenes / f4a7d52 (구현) + 이 보고서 커밋

## 결과
완료 — 고칠 것 1~5 모두 반영. 브라우저 확인은 하지 않았다 (개발 서버 금지 → 컨트롤 타워가 확인).

## 고친 것 (차이 목록 번호)
| 번호 | 내용 |
|---|---|
| F3-10 | `curveView` x = i × (640/12) + 8 고정, 초안 점 = 마지막 사건 + 칸 (8사건이면 434.7). 오른쪽 약 1/3이 비어 끝점·물결 원이 100%/50% 눈금 글자와 겹치지 않는다. 사건이 아주 많아 초안+단계 자리(4칸)가 폭을 넘을 때만 칸을 줄인다 (사건 수로만 정함). 좌표는 시안처럼 소수 한 자리. |
| F3-11 | 칸 너비가 trail 길이와 상관없음 → Send 뒤 단계 점은 칸 × 0.8씩 덧붙기만 하고 앞 점은 그대로. trail 접점(`setTrail`/`trail` 배열) 모양은 바꾸지 않았다. |
| F3-17 | `.curve-ping`의 cx/cy transition, `.curve-dot-draft`의 `transition: all` 제거. 점선 polyline `.curve-draft`만 `transition: all var(--motion-curve)` 그대로. `config/motion.json` 바꾸지 않음. |
| F3-13 | 색 규칙 하나: `desk-model.ts toneOf` (buyer / bad / sys). 곡선 점 클래스 `curve-dot-{tone}`, 점줄 `history-dot-{tone}`. 사례 화면이 사건 기록 줄의 tone을 `RiskCurveCard tones`로 넘겨 같은 사건 = 같은 색 (곡선 점과 사건이 1:1 — 엔진 `riskCurve`가 events.map). seller 파랑(`history-dot-seller`)·검정(`curve-dot-seller_reply`) 삭제. |
| F3-22 · F4-32 | 빈 글 = 무응답 예측: 답장 칸이 엔진 `forecastReply`에 빈 글 + `delayDays + noReplyDays(2)`를 넘긴다 → 답장 칸 알약·예상 반응·곡선 초안 점·큰 %가 모두 이 값. 곡선 아래 글 "if no reply by {date}"(새 키 `case.curve.ifNoReply`, 날짜 = 오늘 + 2일, `shortDate`), "N% → M%" 숨김. 글이 생기면 지금처럼. |

## 설정값 확인 (지시서 규칙 2)
- 엔진 로더: `ReplyModelSchema`는 `zod.object(...)`(strict 아님) → 모르는 키는 버린다. 그래서 `config/reply-model.json`에 새 키 `noReplyDays: 2` 하나만 더했다. 엔진·계약은 바꾸지 않았다.
- 시험으로 확인: 이 키가 있는 설정과 뺀 설정의 `forecastReply` 결과가 같다 (`app-t105`).
- 화면은 `desk-model.ts noReplyDaysOf()`로 읽고, 0 이상 정수가 아니면 `null` → 무응답 상태를 따로 보이지 않는다 (지금처럼).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| src/app/cases/desk-model.ts | `CURVE_X`·`curveStep`·x 배치, `toneOf` 공개(whoCol), `CurveDot.tone`, `curveView(…, options {tones, noReplyBy})`, `headlineVars`, `NO_REPLY_DAYS`·`noReplyDaysOf`·`noReplyByLabel` |
| src/app/cases/view/risk-curve.tsx | 점 클래스 tone 기준, `tones` prop, `noReplyBy` 읽기, 아래 글에 vars |
| src/app/cases/view/draft-forecast.tsx | 상자에 `noReplyBy`/`setNoReplyBy` 추가 (기존 `setForecast`·`setTrail` 모양 그대로) |
| src/app/cases/view/case-view.tsx | `RiskCurveCard`에 사건 기록 tone 넘김 (한 줄) |
| src/app/cases/view/case.css | 곡선 점 색 whoCol, 점·ping transition 제거, `history-dot-seller` → `history-dot-sys` |
| src/app/cases/reply/reply-panel.tsx | **빈 글 예측 부분만**: `emptyDraft`일 때 delayDays + noReplyDays, 효과에서 `setNoReplyBy`. 칩·Details·Send 경로·진행 단계는 건드리지 않음 |
| config/reply-model.json | 새 키 `noReplyDays: 2` 하나 |
| config/copy.en.json · copy.ko.json | 새 키 `case.curve.ifNoReply` ("if no reply by {{date}}" / "{{date}}까지 무응답 시") |
| reports/design-match/inventory.md | "구현함"인데 달랐던 3행만 고침 (`#3F4144` 곡선 점 클래스, `transition: all .3s ease` 대상, `sc-if risk.hasFrom` 빈 글 조건) |
| tests/unit/app-t105.test.ts | 새 시험 17개 |

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skip) | 0 | |
| npm test | 2511 | 1 | `storefront.test.ts` "같은 입력 100회" 5초 시간 초과 (부하). 따로 돌리면 통과 |
| npx vitest run storefront·app-t103·app-t098b | 44 | 0 | T103 회귀 없음, T098b 통과 |
| npx vitest run tests/unit/app-t105.test.ts | 17 | 0 | x 좌표·단계 추가 시 기존 점 고정·색 규칙 일치·transition 없음·빈 글 예측 = 엔진 값·"if no reply by"·fromTo 없음·en/ko 키 같음 |
| npx tsc --noEmit | 통과 | 0 | |
| npm run lint | 통과 | 0 | 경고 0 |
| npm run build | 통과 | 0 | |

## 남은 문제
- 판매자 답장(`seller_reply`)을 bad(빨강)로 칠한다. 시안 whoCol에는 판매자 색이 없고 시안의 판매자 사건 2개가 모두 bad라서 그렇게 했다. DisputeLess 전 판매자 답장이 늘 "잘못"은 아니므로 화면에서 어색하면 sys(회색)로 바꾸는 한 줄 수정이다 (`toneOf`).
- 무응답 날짜는 브라우저의 오늘 + 2일 (서버 `now`는 `case-detail.tsx`라 수정 가능 폴더 밖). 글을 비운 뒤에만 보이므로 서버·브라우저 렌더 차이는 없다.
- 정적 렌더 시험은 효과가 돌지 않아, 곡선 카드의 무응답 문구는 `curveView` 값과 소스 연결로 확인했다. 실제 Clear 클릭 화면은 컨트롤 타워 브라우저 확인이 필요하다.
- 다른 세션과 겹칠 수 있는 파일: `reply-panel.tsx` (예측 useMemo·효과 몇 줄만, T104 영역 아님).

## 컨트롤 타워에 요청할 결정
- 없음 (위 seller 색은 화면 확인 뒤 판단만).
