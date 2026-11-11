# T093 검증 보고 (독립 검증)

판정: **통과** (문제 없음, 참고 3건)

대상: `lane/engine` 140b307, 기준 21724ad. verify-tmp2에서 `git checkout --detach 140b307`.

## 1. 명령
| 명령 | 결과 |
|---|---|
| npm run build | 성공 |
| npx tsc --noEmit (build 뒤) | 0 오류 |
| npm run lint | 0 |
| npm run test:acceptance | 177 통과, 9 건너뜀, 0 실패 (ac33 포함) |
| npm test (전체) | 2312 통과, 2 실패 = 시간 초과(storefront 5초, app-product 토글 <500ms 697ms). 두 파일을 t093 시험·ac33과 단독 실행하면 96/96 통과 (플레이크, 이 변경과 무관) |

## 2. 기존 함수 결과 무변경
기준 커밋(git archive 사본)과 새 커밋에서 같은 임시 시험으로 68개 결과를 JSON으로 뽑아 비교: **바이트 단위로 동일**.
- forecastReply (서연·지호 × 글 3종[기본·rushed·빈 글] × delayDays 0/1/5 × 고정 사본·라이브 설정), forecastMoves, riskCurve, recommend (서연·지호, 고정 사본·라이브)
- simulate (상품 4개 × 처방 4조합, 전체 결과 포함 histogram·waterfall), simulateStore (처방 4조합)
- diff 확인: forecast.ts·sim.ts·reply-model.json 모두 추가만 있고 삭제·수정 0줄. `ReplyModelSchema`에 `scenario: unknown optional` 한 줄 추가뿐. sim.ts의 `expectedOrderLossCents`는 새 export로 기존 함수가 부르지 않는다.

## 3. 완료 기준 (서연 보드, delayDays 1)
- 기본 초안 good 칩: apology −9.51, cause −11.98, ask −11.98, date −21.94 (모두 ≤ 0). refundNow 칩 없음, missing 없음.
- rushed 글: bad blame −9.43, vague −4.76 (< 0). missing 문장을 넣으면 apology −2.91, ask −2.91, date −8.14 (위험 내려감). cause는 good 0 (다른 문장에도 걸려 있어 하나를 빼도 남음 — 보고서에 적힌 대로).
- scenarioRisk 첫 점 0.3454349721076055 = forecastReply.pChargeback (완전히 같음). 이후 0.1007 → 0.0269 → 0.0037.
- actionSavings 서연: fight 3720, refund 0, offer 0 (서연 보드는 offer가 막힌 수). allowedMoves에서 make_offer를 빼고 accept_claim만 둔 보드에서도 offer 0. 참고: 지호 fight 390, offer 3047.

## 4. config/reply-snippets.json
- 기본 4문장·B1 4문장 모두 자리표시자를 채운 글에서 자기 특징으로 걸림. cause·ask는 서로 다른 특징에도 같이 걸림(서로의 문장에 걸리는 것으로 보고서에 있는 점과 일치. ask 문장이 cause에도 걸리고 그 반대도 같음) — 자기 특징은 모두 걸림.
- 날짜 문장은 "I will check with the carrier and contact you again by ⟦DATE_1⟧." (다시 연락하는 날). 채우기 전에는 date로 안 걸림(그래서 화면이 채운 문장을 넘겨야 함 — 보고서에 명시).
- 숫자·금액 없음 (숫자 검출은 토큰 이름의 `_1`뿐). refund·arrive·delivery by·guarantee·$ 없음.
- source "가정(기획 시안)".

## 5. config/reply-model.json
diff는 `scenario` 블록 추가(+10줄)뿐, 기존 값 변경 0. source "가정(기획 시안)".

## 6. trackingSavings 식
코드: 주문마다 E(처방 없음) − E(tracking_24h) 합, 한 번 반올림. E는 `runPass`의 `lossTableFor` 분기 손실을 쓴 기대값으로 Σ_k [Π_{j<k}(1−q_j) q_k] × L_k, L_k = h·환불 + (1−h)(p_win·이김 + (1−p_win)·짐). 보고서 식과 코드가 일치하고, SPEC 8장(난수 < q이면 분쟁, 주문당 최대 1건, 50% 환불/50% 다툼)의 기대값과 같은 뜻.
시뮬레이션 비교 (재고 전체를 주문으로, 시드 8개 평균, simulate before−after[tracking_24h만]):
| 상품 | trackingSavings | simulate 평균(시드 8개) |
|---|---|---|
| FK-CD-OAT (120) | 4332 | 4435 |
| FK-SW-NV (80) | 3562 | 3501 |
| FK-CT-GR (25) | 1882 | 1686 (시드별 1509~1887) |
| FK-BN-SET (150) | 11736 | 11673 |
몬테카를로 오차 안. 편향 없음.

## 7. 범위
`git diff 21724ad 140b307 --stat`: config/reply-model.json, config/reply-snippets.json, reports/T093-impl.md, src/engine/{forecast,savings,sim,snippets}.ts, tests/unit/t093-chips.test.ts — 지시한 범위 안. `src/types.ts` 등은 안 건드림.

## 참고 (실패 아님)
1. `ReplyModelConfig` 타입에 `scenario`가 없어 엔진이 unknown으로 읽는다 (구현 보고서에 이미 컨트롤 타워 결정 사항으로 적혀 있음).
2. snippets는 A2·B1만 맞춤 문장. 다른 유형은 기본(서연) 문장이라 화면이 그 밖의 유형에서 칩을 쓰면 안 맞을 수 있음 (구현 보고서의 남은 문제와 같음).
3. 검증 준비: verify-tmp2의 untracked `reports/T088-verify.md`가 체크아웃을 막아 `reports/T088-verify.md.untracked-copy`로 옮김 (원본 내용은 그 파일과 스크래치 `keep/`에 보존). 임시 시험·기준 사본은 삭제 (스크래치의 base/·old.json·new.json 제외).
