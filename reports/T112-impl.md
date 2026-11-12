# T112 보고 (2026-11-12 10:59)

- 기준 SPEC: v2.15   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/ui-scenes / 26c99d2 (코드) + 이 보고서 커밋

## 결과
완료 — 위험 곡선 SVG가 넓은 창에서 가로로 늘어나던 문제를 고쳤다. `.curve-plot` 폭을 ResizeObserver로 재서 viewBox 폭 = 실제 px 폭으로 그린다 (서버 렌더는 640). `preserveAspectRatio="none"`을 없앴고, x는 시안 비율(xStep = 폭/12) 그대로다. 점 값(y)은 엔진 값 그대로이고 폭과 상관없다.

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/app/cases/desk-model.ts` | 곡선 좌표만: `CurveOptions.width`(기본 640), `CurveView.width`, `curveStep(n, width)` = min(W/12, (W − 8 − tickGutter)/(n + 3)), `CURVE_X.tickGutter = 44`(눈금 글자 ≈26px + 물결 원 r 20 − 여유), `curveWidthOf`(반올림, 0·NaN → 640), `nextCurveWidth`(같은 폭이면 같은 값 → 다시 그리지 않음) |
| `src/app/cases/view/risk-curve.tsx` | `useCurveWidth()` 훅: 콜백 ref + useLayoutEffect(서버에서는 useEffect) + ResizeObserver, `setWidth(current => nextCurveWidth(current, measured))`, 정리할 때 disconnect. viewBox `0 0 {width} 150`, `preserveAspectRatio` 없음, 눈금선·바닥선·곡선·초안 점선에 `vectorEffect="non-scaling-stroke"`. 점 r 4.5·5, ping r 7(→20 keyframes)은 그대로 |
| `tests/unit/app-t112.test.ts` | 새 시험 10개: 폭 W에서 x = i·W/12 + 8, 초안·단계 점 위치(칸 × 0.8), y는 폭과 무관, 서버 렌더 640, 360~1700px × 사건 3·8·9·12개에서 끝점+ping이 눈금 글자 자리와 안 겹침, viewBox = 폭, `preserveAspectRatio` 없음, 선 5개 모두 non-scaling-stroke, 점 r 값, 같은 폭 → 갱신 없음 (루프 없음), ResizeObserver·disconnect·의존성 `[element]` |
| `tests/unit/app-t105.test.ts` | 소스 정규식 한 줄: 카드가 `{ tones, noReplyBy }` 뒤에 `, width`도 넘기는 것을 허용 (뜻은 같음) |
| `reports/design-match/inventory.md` | 곡선 svg 행 한 줄 추가: "시안 SVG 늘림 버그 수정 = 의도적 개선 (사람 결정 11/12 10:55)" |

CSS는 고치지 않았다 (`.curve-svg { width:100%; height:150px }`가 이미 실제 px이고, 잰 폭과 viewBox가 같아 늘림이 없다).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 skipped) | 0 | 15 파일 |
| npm test | 2584 | 1 | `storefront.test.ts > 결정론 > 같은 입력 100회` (6.1s, 알려진 흔들림). 따로 돌리면 31/31 통과 |
| npx tsc --noEmit | ✓ | 0 | |
| npm run lint | ✓ | 0 errors | 경고 2개는 기존 `app-t098a-scenes.test.ts` (이번 변경 아님) |
| npm run build | ✓ | 0 | |
| T105·T103·T104·T098b·T076·T091·T079 시험 | 전부 통과 | 0 | |

실제 AI·PayPal 호출 0회, 개발 서버 실행 안 함, `.env` 읽지 않음, `_server/*` 무변경.

## 남은 문제
- 폭 재기는 jsdom이 없어 단위 시험에서 실제로 돌리지 못했다 (순수 함수 `nextCurveWidth` + 소스 검사로만 봄). 스크린샷(1280·1440·1920·2560 × DPR 2, `reports/screens/curve-fix/`)으로 확인 부탁드린다.
- 사건이 아주 많거나 폭이 좁아 칸이 줄 때는 xStep < W/12가 된다 (전과 같은 규칙에 눈금 글자 자리 44px만 더 뺐다). 640px·사건 8개(데모)는 시안 값 그대로(초안 x 434.7).

## 컨트롤 타워에 요청할 결정
- 없음
