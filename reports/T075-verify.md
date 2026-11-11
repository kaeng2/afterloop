판정: 통과

# T075 검증 (HEAD e1fd55f, 대상 fa34965·581edad)

## 1. 범위
`git diff db025e3..581edad` = forecast.ts, reply-features.ts, 두 단위 테스트, T075-impl.md 5개뿐. params.ts·types.ts·config·기존 엔진·인수 테스트 변경 0 (추가 963줄, 삭제 0).

## 2. 실행
| 명령 | 결과 |
|---|---|
| npm test | 52 파일, 2144 통과, 실패 0 |
| npx tsc --noEmit | 종료 0 |
| npm run lint | 종료 0 |
| npm run test:acceptance | 14 파일, 167 통과, 9 건너뜀(전부 AC13 샌드박스). **ac33 9개 모두 통과, 건너뜀 0** (main의 b6fd209가 최상위 await로 고친 뒤 병합된 HEAD 기준) |

## 3. 정적 점검
코드의 숫자는 이분법 상수(±60, 200회, 알고리즘용)·정규식 길이 한도·하루 ms 환산뿐. 가중치·비용은 config와 params/board에서만 읽음. Math.random·fetch·AI 호출 없음.

## 4. 탐침 (서연 A2, 추적 있음, $72, 신호 4개 켜짐)
- 숫자 일치: 기본 초안 5종(짧은 사과, 탓하는 글, "It should arrive soon.", 한국어, 긴 좋은 글) x 늦은 날 0·3 = 10건 모두 expectedCostCents = 3680 = recommend fight. 보정 c는 -3.63 ~ +0.61로 초안마다 다름.
- 지호(B1, 제안이 최선, 카드사·화남·무응답 없음): fight 4610(pCB 0.46~0.54), offer 1953, refund 5000. 깨지지 않음. forecastMoves: fight 4610/0.460, offer 1953/0.129, refund 5000/0.041.
- 서연 forecastMoves: fight 3680/0.323, offer null(OFFER_SCOPE 막힘)/null, refund 7400/0.023. 기대 손실은 recommend와 같고 막힌 수는 null.
- 확률 합 = 1, 0..1, 같은 입력 JSON 동일.
- 특징: 영어 apology·cause·ask·date·blame·vague 각각 판정됨, 한국어 apology·cause·ask·date·vague(+lang)도 됨. 키 8개뿐, backup·noRefund 없음.
- 10만 자 입력 8종: 1~5ms.
- 위험 곡선: 5사건 -> 5점 (0.378 0.378 0.378 0.475 0.992), 빈 목록 -> 0점. 위협·화남·무응답이 쌓이면 오름. tracking_missing 사건은 위험 효과 0 (shipped와 같은 값 0.378; 그 사건을 빼도 나머지 점 동일). 보고서 설명과 일치.
- 극단: 서연 pWin(추적) 0.001~0.999 x 초안 3종 15건 모두 정확히 일치.

## 발견 (통과를 막지 않음)
1. 한국어 탓하기 정규식이 좁다: "저희 책임이 아닙니다. 택배사 잘못입니다."는 blame이 꺼져 있다 (규칙은 "책임이 아니"만 보는데 격식체 "아닙니다"는 "아니" 부분 문자열이 없고, "택배사 잘못"도 규칙 밖). 한국어 초안의 탓하기 판정이 약함. 계약·가중치 문제는 아님, 정규식 보강 후보.
2. "We will refund you now."만으로는 refundNow 아님 ("issued a refund" 꼴 필요) - 보고서 규칙대로.
3. 보정 c가 기본 초안에 따라 달라 빈 글 위험도 달라짐(보고서에 기재됨). riskCurve 보정은 계약 밖 opts.calibration 필요(화면 T076에 전달 필요).

## 5. 보정 방법 판단
타당하다. 기대 비용 = t + A·pR + (A+f)·pCB에서 c를 z와 qz에 함께 더하면 d비용/dc ∝ (1-pCB)·[f·pCB + A(pCB(1-q) + q(1-q))] > 0 이므로 엄격히 단조 증가(해가 최대 하나). c->-inf에서 t, +inf에서 A+f+t로 가므로 0<pWin<1이면 fight 손실 (1-pWin)(A+f)+t가 항상 그 범위 안에 있어 해가 존재한다(탐침으로 pWin 0.001/0.999까지 확인; 아주 모호한/나쁜 초안도 해 있음, c는 +-60 안). 해가 없는 경우는 (a) pWin이 정확히 0 또는 1 (경계로 붙음, 이때 보정은 근사), (b) 기본 초안에 refundNow가 있어 하한이 t+0.97A가 되는 경우 - 서연에서 3680 대신 7184, c=-60으로 붙음을 직접 확인. 보고서가 이를 밝혔고 AI 초안은 환불 약속 금지라 실제로는 생기지 않는다. 다만 이분법은 [-60,60] 한정이라 pWin이 1e-26보다 극단이면 센트 단위로 어긋날 수 있다(비현실).
