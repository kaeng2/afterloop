# T093 보고 (2026-11-11 22:35)

- 기준 SPEC: v2.14   (시작할 때 SPEC.md 첫 줄과 같았는지: 예)
- 브랜치 / 마지막 커밋: lane/engine / 3ef0644 (구현), 이 보고서는 다음 커밋

## 결과
완료 — 계약 v2.14의 `replyFeatureEffects`·`scenarioRisk`·`actionSavings`·`trackingSavings`와 `config/reply-snippets.json`을 만들었다. 기존 함수(`forecastReply`·`riskCurve`·`recommend`·`simulate`)의 결과는 바뀌지 않았다 (AC 전부 통과, 기존 단위 테스트 그대로).

## 바뀐 파일
| 파일 | 내용 |
|---|---|
| `src/engine/forecast.ts` | `replyFeatureEffects`, `scenarioRisk` 추가. 도우미 `removeSentence`·`appendSentence` (화면이 칩 Add/Remove에 같은 동작을 쓰도록 export). 설정 검증에 `scenario`를 선택 필드(unknown)로만 추가 — 기존 계산은 읽지 않는다 |
| `src/engine/savings.ts` (새) | `actionSavings`, `trackingSavings` |
| `src/engine/sim.ts` | `expectedOrderLossCents` 추가 (주문 1건 기대 손실, 난수 없음). 기존 함수 무변경 |
| `src/engine/snippets.ts` (새) | `replySnippetsFromConfig`, `replySnippetsFor(subtype)` (설정 읽기·zod 검증, 기본 + 유형별 덮어쓰기) |
| `config/reply-model.json` | `scenario` 블록 추가만 (source "가정(기획 시안)"). 기존 값 무변경 |
| `config/reply-snippets.json` (새) | source "가정(기획 시안)". 기본(서연 A2) 4문장 + `bySubtype.B1`(색상) 4문장 |
| `tests/unit/t093-chips.test.ts` (새) | 18개 |

## 식과 정한 것

### replyFeatureEffects
같은 `prepare`(같은 보정 c, 같은 상황) 위에서 `core`로 pChargeback을 두 번 구한 차이 × 100 (퍼센트포인트, 반올림 안 함). 지금 글의 pChargeback은 `forecastReply(input).pChargeback`과 같은 값이다.
- good(apology·cause·ask·date): `(p(지금) − p(hits[k] 문장을 뺀 글)) × 100`. lang은 번역 때문에 문장을 빼도 남으므로 특징 lang 하나만 끈 값과 비교.
- missing(apology·cause·ask·date, snippets에 문장 있음): `(p(글 끝에 문장을 붙인 글) − p(지금)) × 100`. lang은 missing으로 내지 않음. refundNow는 칩 없음.
- bad(blame·vague): `(p(hits[k] 문장을 뺀 글) − p(지금)) × 100`.
- snippets는 **자리표시자를 채운 문장**을 넘겨야 한다 (안 채운 `⟦DATE_1⟧`은 날짜 규칙에 걸리지 않는다). 엔진은 채우지 않는다 — 화면의 토큰 채움(`fillTokens`/`formatFact`)을 쓴다.
- 서연 값 (delayDays 1, 시험의 신호): 기본 초안 apology −9.51, cause −11.98, ask −11.98, date −21.94. rushed 글: apology(missing) −2.91, ask(missing) −2.91, date(missing) −8.14, blame(bad) −9.43, vague(bad) −4.76, cause(good) 0.
- 알아 둘 점: 한 문장이 두 특징에 걸리면(기본 초안 "…customs code."는 cause와 ask 둘 다) 두 칩의 hits 문장이 같고 효과도 같다. rushed 글의 cause는 "contact customs yourself" 문장에도 걸려 있어 cause 문장 하나를 빼도 특징이 남아 0이다 (지어내지 않고 그대로 낸다).

### scenarioRisk
보낸 글의 특징·보정 c·상황(신호, delayDays)에서 시작해 steps 순서대로 `scenario.steps[단계]`를 **앞 단계 위에 누적**한다: threat·unanswered·tone은 값이 있으면 바꾸고, delayDays는 바꾸고, shift는 z에 더한다(누적). 단조를 강제하지 않는다.
- 설정 (가정): sent `{}` (forecastReply가 이미 "이 답장을 보냈을 때" 예측 → 첫 점 = forecastReply), buyer_reply `{unanswered:false, tone:false, delayDays:0, shift:-0.3}`, forwarded `{threat:false, shift:-0.5}`, cleared `{shift:-2.0}`.
- 서연 기본 초안: 34.5% → 10.1% → 2.7% → 0.4%. rushed 글: 93.5% → 75.2% → 42.8% → 9.2%.
- 넘긴 model에 scenario가 없으면 `config/reply-model.json`의 scenario를 쓴다.

### actionSavings
`recommend(board).all`에서 `refund 기대 손실 − 그 수 기대 손실`, 0 이상. 그 수가 refund, 막힘, 값 없음, 또는 refund 평가가 막혔으면 0. 서연 fight 7400 − 3680 = **3720¢**.

### trackingSavings
주문마다 `E(처방 없음) − E(tracking_24h)`를 더하고 합을 한 번 `roundCents`, 0 이상. productRates에 없는 SKU는 0.
주문 1건 기대 손실 (`expectedOrderLossCents`, `runPass`의 손실 식을 기대값으로 푼 것, 금액 A = 주문 금액):
```
E = Σ_k P(첫 분쟁 = k) · L_k,   P(첫 분쟁 = k) = q_k · Π_{j<k} (1 − q_j)   (k는 SUBTYPES 고정 순서, 주문당 최대 1건)
q_k = productRates[sku][k] × (tracking_24h면 rateMultiplier[k], 없으면 1)
L_k = h·(A + t) + (1 − h)·(p_win·t + (1 − p_win)·(A + f + t))
p_win = tracking_24h면 pWinOverride[k] (있을 때), 아니면 params.pWin[k];  h = habitRefundShare, f = feeCents, t = timeCostCents
```
분기 손실은 `oracle.ts`의 트리 분기(`lossTableFor`)에서 그대로 가져온다. 시험: 재고 200 × 미래 500 시뮬레이션의 평균과 10% 안에서 맞는다. 예: FK-SW-NV $72 + FK-CD-OAT $68 두 주문 = 93¢.

### reply-snippets 구조
`{ version, source, note, snippets: {apology, cause, ask, date}, bySubtype: { <세부 유형>: {…} } }`. 계약 `ReplySnippets`(version·source·snippets)에 `bySubtype`(선택)를 더했다. `replySnippetsFor(subtype)` = 기본 위에 유형별을 덮어쓴다. 지금은 기본 = 서연(A2 통관) 문장(지시서 예문 그대로), B1 = 지호(색상). 다른 유형은 기본 — 화면이 A2/B1 밖에서 칩을 쓰면 cause·ask 문장이 맞지 않을 수 있다 (남은 문제).

## 테스트 결과
| 명령 | 통과 | 실패 | 비고 |
|---|---|---|---|
| npm run test:acceptance | 177 (9 건너뜀) | 0 | |
| npm test | 2313 | 1 | `tests/unit/storefront.test.ts` "결정론 > 같은 입력 100회" 5000ms 시간 초과. 단독 실행 31/31 통과, 내 새 시험 파일을 빼고 돌려도 같은 실패 → 부하 때문에 시간이 초과되는 플레이크(T082 등 이전 보고에도 있음). storefront·sim의 기존 코드는 바꾸지 않았다 |
| npx tsc --noEmit | 예 | 0 | |
| npm run lint | 예 | 0 | 경고 0 |
| npm run build | 예 | 0 | |
| tests/unit/t093-chips.test.ts | 18 | 0 | |

실제 AI·PayPal 호출, 개발 서버 없음.

## 남은 문제
- storefront 결정론 시험이 전체 실행에서 5초 제한을 넘는다 (기존 플레이크, 이 태스크 범위 밖). 시험 시간 제한을 늘릴지는 engine 레인 다음 작업에서 정하면 된다.
- snippets는 A2·B1만 맞춤 문장이다. A1(추적 없음) 등에서는 기본 문장이 맞지 않는다 — 지금 칩을 쓰는 사례(서연·지호)에는 문제 없음.

## 컨트롤 타워에 요청할 결정
- 없음. (참고: `ReplyModelConfig` 타입에 `scenario`가 없어 엔진은 설정의 추가 필드로 읽는다. 타입에 넣을지는 컨트롤 타워가 판단.)
